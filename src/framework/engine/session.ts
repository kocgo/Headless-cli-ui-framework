/**
 * A session = one actor in one process: a headless router at that actor's
 * cursor (replayed from the log), a QueryClient, and the operations every
 * front end uses — go to a page, run an intent, dispatch an action,
 * approve/reject, sync with other processes.
 */
import { randomUUID } from 'node:crypto'
import { QueryClient } from '@tanstack/query-core'
import type { App } from '../app.js'
import { positionalOf, type AnyAction, type AnyPage } from '../declare.js'
import { EmptyObject, keysOf, parseInput, parseQuery, stringifyQuery } from '../schema.js'
import { compileRouteTree, queryKeyOf, type RouterContext } from './compile.js'
import { AppError } from './errors.js'
import type { ActionLog, LogEntry, NavType } from './log.js'
import { createRuntime } from './runtime.js'
import { resolveScreen, type Screen } from './screen.js'

export type DispatchResult =
  | { status: 'applied'; id: number; value: unknown; summary?: string }
  | { status: 'proposed'; id: number }
  | { status: 'checked' }

export interface SessionOptions {
  app: App
  actor: string
  log: ActionLog
  ctx: unknown
  /** Look at another actor's cursor without logging anything (`peek`). */
  readOnly?: boolean
  cursorOf?: string
}

export const needsApproval = (actor: string, a: AnyAction) => Boolean(a.requiresApproval) && actor !== 'user'

/** Map positional args onto schema keys in order, then overlay --flags. */
export function argsToObject(keys: string[], positional: string[], flags: Record<string, string>) {
  const raw: Record<string, unknown> = {}
  if (positional.length > keys.length)
    throw new AppError('usage', `too many arguments: expected at most ${keys.length} (${keys.join(', ') || 'none'})`)
  positional.forEach((v, i) => (raw[keys[i]!] = v))
  return { ...raw, ...flags }
}

export async function createSession(opts: SessionOptions) {
  const { app, actor, log, ctx } = opts
  const sid = randomUUID().slice(0, 8)
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } })
  const cursor = log.cursor(opts.cursorOf ?? actor)
  const rc: RouterContext = { queryClient, ctx }

  const runtime = await createRuntime({
    routeTree: compileRouteTree(app)(),
    initialEntries: cursor.entries,
    initialIndex: cursor.index,
    context: rc as unknown as Record<string, unknown>,
    externalSources: [(notify) => queryClient.getQueryCache().subscribe(notify)],
    routerOptions: { parseSearch: parseQuery, stringifySearch: stringifyQuery },
  })
  const { router, history } = runtime

  // Serialise everything that touches the router: commands, sync, follow.
  let chain: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(fn: () => Promise<T> | T): Promise<T> => {
    const next = chain.then(fn)
    chain = next.catch(() => {})
    return next
  }

  async function settle() {
    await runtime.settled()
    while (queryClient.isFetching()) await new Promise((r) => setTimeout(r, 5))
    await runtime.settled()
  }
  await settle()

  const screen = (): Screen => resolveScreen(router, runtime.snapshot(), queryClient, ctx)
  let replaying = false

  function recordVisit(nav: NavType, intent?: string) {
    if (opts.readOnly || replaying) return
    const s = screen()
    log.append({
      actor, sid, kind: 'visit', nav, intent,
      page: s.page ?? undefined, params: s.params, href: s.href,
      note: s.status === 'ok' ? s.summary : s.status.replace('_', ' '),
    })
  }

  async function navigate(href: string, nav: NavType = 'PUSH', intent?: string) {
    await router.navigate({ href, replace: nav === 'REPLACE' })
    await settle()
    recordVisit(nav, intent)
  }

  async function back() {
    history.back()
    await settle()
    recordVisit('BACK')
  }
  async function forward() {
    history.forward()
    await settle()
    recordVisit('FORWARD')
  }

  /** `search --query 1984` → validate params, build the link, navigate. */
  async function goPage(page: AnyPage, positional: string[], flags: Record<string, string>) {
    const keys = positionalOf(page)
    const raw = argsToObject(keys, positional, flags)
    const unknown = Object.keys(raw).filter((k) => !(k in (page.params.properties ?? {})))
    if (unknown.length) throw new AppError('usage', `${page.name} has no param ${unknown.map((k) => `--${k}`).join(', ')}`, Object.keys(page.params.properties ?? {}).map((k) => `--${k}`))
    const params = parseInput(page.params, raw, 'params')
    await navigate(page.link(params).href)
  }

  /** Change search params of the current page (`set sort=price`). */
  async function setParams(patch: Record<string, unknown>) {
    const s = screen()
    const page = s.page ? app.page(s.page) : undefined
    if (!page) throw new AppError('usage', 'no page to change params on')
    const merged = { ...s.params, ...patch }
    const params = parseInput(page.params, merged, 'params')
    await navigate(page.link(params).href, 'REPLACE')
  }

  async function invalidatePages(pages: AnyPage[]) {
    const live = app.pages.filter((p) => p.def.refreshOnActivity)
    const keys: Array<readonly unknown[]> = [...new Set([...pages, ...live])].map((p) => [p.name])
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'all' })))
    await router.invalidate()
    await settle()
  }

  async function reload() {
    const s = screen()
    const page = s.page ? app.page(s.page) : undefined
    if (page) await queryClient.invalidateQueries({ queryKey: queryKeyOf(page, s.params), refetchType: 'all' })
    await router.invalidate()
    await settle()
  }

  const pagesFor = (a: AnyAction, input: unknown, result: unknown): AnyPage[] =>
    (typeof a.invalidates === 'function' ? a.invalidates(input, result) : (a.invalidates ?? []))
      .map((n: string) => (app.shell?.name === n ? app.shell : app.page(n)))
      .filter((p: AnyPage | undefined): p is AnyPage => Boolean(p))

  async function execute(a: AnyAction, input: unknown, origin: { page?: string; intent?: string; ref?: number }) {
    let value: unknown
    try {
      value = await a.run(input, ctx)
    } catch (e) {
      log.append({ actor, sid, kind: 'fail', action: a.name, input, ...origin, note: (e as Error).message })
      throw new AppError('precheck', (e as Error).message)
    }
    let summary: string | undefined
    try {
      summary = a.summary?.(input, value)
    } catch {
      summary = undefined
    }
    const entry = log.append({ actor, sid, kind: 'apply', action: a.name, input, result: value, note: summary, ...origin })
    await invalidatePages([...pagesFor(a, input, value), ...(app.shell ? [app.shell] : [])])
    return { status: 'applied' as const, id: entry.id, value, summary }
  }

  async function dispatch(
    name: string,
    raw: unknown,
    origin: { page?: string; intent?: string } = {},
    check = false,
  ): Promise<DispatchResult> {
    const a = app.action(name)
    if (!a) throw new AppError('unknown_action', `unknown action "${name}"`, app.allActions.map((x) => x.name))
    const input = parseInput(a.input, raw, `input for ${name}`)
    const refusal = await a.precheck?.(input, ctx)
    if (refusal) throw new AppError('precheck', refusal)
    if (check) return { status: 'checked' }
    if (needsApproval(actor, a)) {
      const entry = log.append({ actor, sid, kind: 'propose', action: a.name, input, ...origin })
      await invalidatePages([])
      return { status: 'proposed', id: entry.id }
    }
    return execute(a, input, origin)
  }

  /** Run an intent on the current screen: `open 3`, `next`, `add 2`, `checkout`. */
  async function runIntent(name: string, positional: string[], flags: Record<string, string>): Promise<DispatchResult | null> {
    const s = screen()
    const info = s.intents.find((i) => i.name === name)
    if (!info) throw new AppError('unknown_command', `"${name}" is not available on ${s.page ?? s.href}`)
    if (!info.available) throw new AppError('unavailable', info.reason ?? `"${name}" is not available right now`)
    const page = app.shell?.name === info.page ? app.shell : app.page(info.page)!
    const intent = page.def.intents![name]!
    const args = parseInput(intent.args ?? EmptyObject, argsToObject(keysOf(intent.args), positional, flags), `arguments for ${name}`) as Record<string, unknown>
    // The intent runs against the state of the page that declares it (the leaf, an ancestor, or the layout).
    const state: Record<string, unknown> = { ...(s.states[page.name] ?? { params: {}, data: null, model: null, parent: null }) }
    if (intent.to) {
      const link = intent.to({ ...state, args, link: page.link } as never)
      await navigate(link.href, 'PUSH', name)
      return null
    }
    const input = intent.input ? intent.input({ ...state, args, link: page.link } as never) : args
    return dispatch(intent.do!.name, input, { page: page.name, intent: name })
  }

  function decidable(id: number) {
    const p = log.get(id)
    if (!p || p.kind !== 'propose') throw new AppError('usage', `#${id} is not a proposal`)
    const done = log.resolution(id)
    if (done) throw new AppError('conflict', `#${id} was already decided (#${done.id} ${done.kind})`)
    if (actor !== 'user') throw new AppError('forbidden', 'only the user can approve or reject proposals')
    if (p.actor === actor) throw new AppError('forbidden', 'an actor cannot decide its own proposal')
    return p
  }

  async function approve(id: number) {
    const p = decidable(id)
    const a = app.action(p.action!)!
    const refusal = await a.precheck?.(p.input as never, ctx) // the world may have changed since
    if (refusal) {
      log.append({ actor, sid, kind: 'fail', action: a.name, input: p.input, ref: id, note: refusal })
      throw new AppError('precheck', `#${id} can no longer run: ${refusal}`)
    }
    return execute(a, p.input, { ref: id, page: p.page, intent: p.intent })
  }

  function reject(id: number, reason?: string) {
    decidable(id)
    return log.append({ actor, sid, kind: 'reject', ref: id, note: reason })
  }

  let following: string | null = null
  async function follow(other: string | null) {
    following = other
    if (other) {
      const c = log.cursor(other)
      const href = c.entries[c.index]!
      if (href !== router.state.location.href) await navigate(href, 'PUSH', `follow ${other}`)
    }
  }

  // ── sync: converge with entries other processes wrote ──────────────────
  let lastSeen = log.lastId()
  async function sync(): Promise<LogEntry[]> {
    const fresh = log.since(lastSeen).filter((e) => e.sid !== sid)
    if (!fresh.length) return fresh
    lastSeen = fresh.at(-1)!.id
    const pages: AnyPage[] = []
    let moveTo: { href: string; mine: boolean } | undefined
    for (const e of fresh) {
      const a = e.action ? app.action(e.action) : undefined
      if (e.kind === 'apply' && a) pages.push(...pagesFor(a, e.input, e.result))
      if (e.kind === 'visit' && e.href) {
        if (e.actor === actor) moveTo = { href: e.href, mine: true } // same actor, another process
        else if (e.actor === following) moveTo = { href: e.href, mine: false }
      }
    }
    await invalidatePages([...pages, ...(app.shell ? [app.shell] : [])])
    if (moveTo && moveTo.href !== router.state.location.href) {
      replaying = moveTo.mine // our own actor's move is already logged; following is a real move
      try {
        await navigate(moveTo.href, 'PUSH', moveTo.mine ? undefined : `follow ${following}`)
      } finally {
        replaying = false
      }
    }
    return fresh
  }

  return {
    app, actor, sid, log, ctx, queryClient, router, history,
    screen, settle, exclusive,
    navigate, back, forward, goPage, setParams, reload,
    runIntent, dispatch, approve, reject, follow, sync,
    get following() {
      return following
    },
    onChange: runtime.onChange,
    dispose: runtime.dispose,
  }
}

export type Session = Awaited<ReturnType<typeof createSession>>
