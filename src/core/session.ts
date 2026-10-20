/**
 * A session = one actor in one process: a headless router positioned at that
 * actor's cursor (replayed from the log), a QueryClient, and a dispatcher.
 *
 * Writes go to the shared log; `sync()` reads other processes' entries and
 * converges: invalidate queries for their mutations, move this cursor when the
 * same actor navigated elsewhere (another terminal), or when following someone.
 */
import { randomUUID } from 'node:crypto'
import type { AnyRoute } from '@tanstack/router-core'
import { QueryClient } from '@tanstack/query-core'
import { createHeadlessRouter, type Snapshot } from '../headless/router.js'
import type { ActionLog, LogEntry, NavType } from './log.js'
import { needsApproval, parseInput, ValidationError, type ActionRegistry, type QueryKey } from './actions.js'
import type { DispatchResult, Screen } from './screen.js'

export interface SessionOptions {
  actor: string
  log: ActionLog
  actions: ActionRegistry
  /** A factory, so several routers (own cursor, `peek`) never share route instances. */
  createRouteTree: () => AnyRoute
  /** Start at someone else's cursor without logging (used by `peek`). */
  readOnly?: boolean
  cursorOf?: string
}

export const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } })

export async function createSession(opts: SessionOptions) {
  const { actor, log, actions } = opts
  const sid = randomUUID().slice(0, 8)
  const queryClient = createQueryClient()
  const cursor = log.cursor(opts.cursorOf ?? actor)

  // Serialise everything that touches the router: commands, sync, follow.
  let chain: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(fn: () => Promise<T> | T): Promise<T> => {
    const next = chain.then(fn)
    chain = next.catch(() => {})
    return next
  }

  const app = createHeadlessRouter({
    routeTree: opts.createRouteTree(),
    initialEntries: cursor.entries,
    initialIndex: cursor.index,
    context: { queryClient, dispatch: (a: string, i?: unknown) => dispatch(a, i) },
    externalSources: [(notify) => queryClient.getQueryCache().subscribe(notify)],
  })
  const { router, history } = app

  async function settle() {
    await app.settled()
    while (queryClient.isFetching()) await new Promise((r) => setTimeout(r, 5))
    await new Promise((r) => setImmediate(r))
  }

  await app.start()
  await settle()

  // Log this actor's own navigations (PUSH/REPLACE/BACK/FORWARD) from now on.
  let replaying = false
  if (!opts.readOnly) {
    history.subscribe(({ action }) => {
      if (replaying) return
      log.append({ actor, sid, kind: 'navigate', href: history.location.href, nav: action.type as NavType })
    })
  }

  async function invalidate(keys: QueryKey[]) {
    // Headless there are no QueryObservers, so nothing counts as "active":
    // refetch every matching query, not just active ones.
    await Promise.all(
      [...keys, ['log']].map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: 'all' })),
    )
    await router.invalidate() // re-run loaders so loaderData matches the cache
  }

  async function execute(name: string, input: unknown, ref?: number): Promise<DispatchResult> {
    const def = actions[name]!
    try {
      const result = await def.run(input)
      const entry = log.append({ actor, sid, kind: 'apply', action: name, input, result, ref })
      await invalidate(def.invalidates(input))
      return { status: 'applied', id: entry.id, result }
    } catch (e) {
      log.append({ actor, sid, kind: 'fail', action: name, input, ref, note: (e as Error).message })
      throw e
    }
  }

  async function dispatch(name: string, raw?: unknown): Promise<DispatchResult> {
    const def = actions[name]
    if (!def) throw new Error(`unknown action "${name}". Known: ${Object.keys(actions).join(', ')}`)
    const input = parseInput(def.input, raw)
    const refusal = def.precheck?.(input)
    if (refusal) throw new ValidationError(refusal)
    if (needsApproval(actor, def)) {
      const entry = log.append({ actor, sid, kind: 'propose', action: name, input })
      await queryClient.invalidateQueries({ queryKey: ['log'] })
      return { status: 'proposed', id: entry.id }
    }
    return execute(name, input)
  }

  function pendingProposal(id: number) {
    const p = log.get(id)
    if (!p || p.kind !== 'propose') throw new Error(`#${id} is not a proposal`)
    const resolved = log.resolution(id)
    if (resolved) throw new Error(`#${id} was already resolved (#${resolved.id} ${resolved.kind})`)
    if (p.actor === actor) throw new Error('an actor cannot approve or reject its own proposal')
    if (actor !== 'user') throw new Error('only the user can approve or reject proposals')
    return p
  }

  async function approve(id: number) {
    const p = pendingProposal(id)
    return execute(p.action!, p.input, id)
  }

  function reject(id: number, reason?: string) {
    pendingProposal(id)
    return log.append({ actor, sid, kind: 'reject', ref: id, note: reason })
  }

  async function navigateTo(href: string, replace = false) {
    if (href === router.state.location.href) return
    await router.navigate({ href, replace })
    await settle()
  }

  let following: string | null = null
  async function follow(other: string | null) {
    following = other
    if (other) {
      const c = log.cursor(other)
      await navigateTo(c.entries[c.index]!)
    }
  }

  // ── sync: converge with entries written by other processes ──────────────
  let lastSeen = log.lastId()
  async function sync(): Promise<LogEntry[]> {
    const fresh = log.since(lastSeen).filter((e) => e.sid !== sid)
    if (!fresh.length) return fresh
    lastSeen = fresh.at(-1)!.id
    const keys: QueryKey[] = []
    let moveTo: string | undefined
    let moveIsMine = false
    for (const e of fresh) {
      if (e.kind === 'apply' && e.action && actions[e.action]) {
        keys.push(...actions[e.action]!.invalidates(e.input as never))
      }
      if (e.kind === 'navigate') {
        if (e.actor === actor) {
          moveTo = e.href // same actor, other terminal: this cursor moved
          moveIsMine = true
        } else if (e.actor === following) {
          moveTo = e.href
          moveIsMine = false
        }
      }
    }
    await invalidate(keys)
    if (moveTo) {
      // Replaying our own actor's move must not be logged again; following is a
      // real move of *our* cursor, so it is logged.
      replaying = moveIsMine
      try {
        await navigateTo(moveTo)
      } finally {
        replaying = false
      }
    }
    return fresh
  }

  const screenOf = (routeId: string): Screen | undefined =>
    (router.routesById as Record<string, { options: { staticData?: { screen?: Screen } } }>)[routeId]?.options
      .staticData?.screen

  return {
    actor,
    sid,
    app,
    router,
    history,
    queryClient,
    log,
    actions,
    screenOf,
    settle,
    exclusive,
    dispatch,
    approve,
    reject,
    sync,
    follow,
    get following() {
      return following
    },
    snapshot: (): Snapshot => app.snapshot(),
    dispose: () => app.dispose(),
  }
}

export type Session = Awaited<ReturnType<typeof createSession>>
