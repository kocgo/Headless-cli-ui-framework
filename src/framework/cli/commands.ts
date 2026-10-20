/**
 * The command layer. Lookup order: framework commands, then intents on the
 * current screen (page first, then layout), then page names.
 *   search --query 1984   → a page: validate params, navigate, fetch, log a visit
 *   open 3                → an intent: navigate (to) or dispatch an action (do)
 *   do cart.add --bookId 3 → an action by name
 */
import { FRAMEWORK_COMMANDS, type App } from '../app.js'
import { defaultOf, schemaJson } from '../schema.js'
import { AppError, EXIT } from '../engine/errors.js'
import { describeEntry } from '../engine/log.js'
import { intentUsage, type Screen } from '../engine/screen.js'
import type { DispatchResult, Session } from '../engine/session.js'
import { renderFrame, stripAnsi } from './text.js'

export interface ParsedLine {
  name: string
  args: string[]
  flags: Record<string, string>
}

/** `do cart.add --bookId 3 --qty=2` → { name, args, flags } */
export function parseTokens(tokens: string[]): ParsedLine {
  const [name = '', ...rest] = tokens
  const args: string[] = []
  const flags: Record<string, string> = {}
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i]!
    if (t.startsWith('--') && t.length > 2) {
      const [k, v] = t.slice(2).split(/=(.*)/s)
      if (v !== undefined) flags[k!] = v
      else if (rest[i + 1] !== undefined && !rest[i + 1]!.startsWith('--')) flags[k!] = rest[++i]!
      else flags[k!] = 'true'
    } else args.push(t)
  }
  return { name, args, flags }
}

/** Shell-like split for interactive lines and pane commands. */
export const splitLine = (line: string) =>
  [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!)

export interface Outcome {
  message?: string
  result?: unknown
  /** Whether the actor's screen is part of the answer. */
  screen: boolean
  exit: number
}

export interface CommandEnv {
  app: App
  session: Session
  dbPath: string
  peek: (actor: string) => Promise<Session>
}

const fromDispatch = (r: DispatchResult | null, what: string): Outcome => {
  if (!r) return { screen: true, exit: EXIT.ok }
  if (r.status === 'proposed')
    return { screen: true, exit: EXIT.proposed, result: r, message: `Proposed ${what} (#${r.id}); waiting for the user to approve.` }
  if (r.status === 'checked') return { screen: false, exit: EXIT.ok, result: r, message: `${what}: check passed` }
  return { screen: true, exit: EXIT.ok, result: r, message: r.summary ?? `${what} done (#${r.id})` }
}

export async function runCommand(env: CommandEnv, line: ParsedLine): Promise<Outcome> {
  const { app, session } = env
  const { name, args, flags } = line
  const s = session.screen()
  const ok = (message?: string, result?: unknown): Outcome => ({ screen: true, exit: EXIT.ok, message, result })
  const info = (message: string, result: unknown): Outcome => ({ screen: false, exit: EXIT.ok, message, result })

  switch (name) {
    case 'go':
      if (!args[0]) throw new AppError('usage', 'usage: go <href>')
      await session.navigate(args[0])
      return ok()
    case 'back':
      await session.back()
      return ok()
    case 'forward':
      await session.forward()
      return ok()
    case 'set':
    case 'unset': {
      const patch: Record<string, unknown> = { ...flags }
      for (const a of args) {
        const [k, v] = a.split(/=(.*)/s)
        if (k) patch[k] = name === 'set' ? v : undefined
      }
      await session.setParams(patch)
      return ok()
    }
    case 'reload':
      await session.reload()
      return ok()
    case 'show':
      return ok()
    case 'do': {
      const action = args[0]
      if (!action) throw new AppError('usage', 'usage: do <action> [json | --k v …]', app.allActions.map((a) => a.name))
      const { check, ...rest } = flags
      const input = args[1] ? JSON.parse(args[1]) : rest
      return fromDispatch(await session.dispatch(action, input, {}, check === 'true'), action)
    }
    case 'pending': {
      const p = session.log.pending()
      return info(p.map(describeEntry).join('\n') || 'No pending proposals.', p)
    }
    case 'approve': {
      const r = await session.approve(Number(args[0]))
      return ok(`Approved #${args[0]}${r.summary ? `: ${r.summary}` : ''}`, r)
    }
    case 'reject': {
      const e = session.reject(Number(args[0]), args.slice(1).join(' ') || undefined)
      return ok(`Rejected #${args[0]}`, e)
    }
    case 'wait': {
      const id = Number(args[0])
      if (!id) throw new AppError('usage', 'usage: wait <id> [--timeout seconds]')
      const deadline = Date.now() + Number(flags.timeout ?? 120) * 1000
      while (Date.now() < deadline) {
        const r = session.log.resolution(id)
        if (r) return { screen: false, exit: r.kind === 'apply' ? EXIT.ok : EXIT.refused, message: describeEntry(r), result: r }
        await new Promise((res) => setTimeout(res, 250))
      }
      throw new AppError('timeout', `#${id} is still pending`)
    }
    case 'peek': {
      if (!args[0]) throw new AppError('usage', 'usage: peek <actor>')
      const other = await env.peek(args[0])
      const ps = other.screen()
      other.dispose()
      return info(stripAnsi(renderFrame(ps, { actor: args[0] })), { actor: args[0], screen: screenJson(ps) })
    }
    case 'follow':
      if (!args[0]) throw new AppError('usage', 'usage: follow <actor>')
      await session.follow(args[0])
      return ok(`Following ${args[0]}`)
    case 'unfollow':
      await session.follow(null)
      return ok('Stopped following')
    case 'log': {
      const entries = flags.since ? session.log.since(Number(flags.since), flags.actor) : session.log.tail(Number(args[0] ?? 20))
      return info(entries.map(describeEntry).join('\n') || 'Nothing logged yet.', entries)
    }
    case 'tools':
      return info(JSON.stringify(manifest(app), null, 2), manifest(app))
    case 'help': {
      const rows = [
        ...s.intents.map((i) => [i.usage, (i.description ?? '') + (i.available ? '' : ` (unavailable${i.reason ? `: ${i.reason}` : ''})`)]),
        ...app.pages.map((p) => [pageUsage(p.name, app), p.def.description ?? `go to ${p.path}`]),
        ...FRAMEWORK_COMMANDS.map((c) => [c.usage, c.help]),
      ]
      return info(rows.map(([u, h]) => `  ${u!.padEnd(34)} ${h}`).join('\n'), rows)
    }
    case 'whoami':
      return info(`${session.actor} · ${env.dbPath} · ${s.href}`, { actor: session.actor, db: env.dbPath, href: s.href })
    case 'state': {
      const queries = session.queryClient.getQueryCache().getAll().map((q) => ({ key: q.queryKey, status: q.state.status, stale: q.isStale() }))
      return info(JSON.stringify({ screen: screenJson(s), queries }, null, 2), { queries })
    }
  }

  if (s.intents.some((i) => i.name === name)) return fromDispatch(await session.runIntent(name, args, flags), name)
  const page = app.page(name)
  if (page) {
    await session.goPage(page, args, flags)
    return ok()
  }
  throw new AppError('unknown_command', `unknown command "${name}"`, [
    ...s.intents.filter((i) => i.available).map((i) => i.usage),
    ...app.pages.map((p) => p.name),
  ])
}

function pageUsage(name: string, app: App) {
  const p = app.page(name)!
  const positional = (p.def.positional as string[] | undefined) ?? []
  const required = new Set(p.params.required ?? [])
  const parts = Object.keys(p.params.properties ?? {}).map((k) => {
    const v = positional.includes(k) ? `<${k}>` : `--${k} <${k}>`
    return required.has(k) && defaultOf(p.params, k) === undefined ? v : `[${v}]`
  })
  return [name, ...parts].join(' ')
}

export function screenJson(s: Screen) {
  return {
    page: s.page,
    href: s.href,
    title: s.title,
    status: s.status,
    error: s.error,
    params: s.params,
    data: s.data,
    model: s.model,
    summary: s.summary,
    view: s.view,
    text: stripAnsi(renderFrame(s, { actor: '' }).split('\n').slice(2).join('\n')),
    intents: s.intents,
    controls: s.controls,
  }
}

/** Everything an agent needs: pages (+ params, intents), actions (+ input schemas), commands. */
export function manifest(app: App) {
  const intentsOf = (p: NonNullable<App['shell']>) =>
    Object.entries(p.def.intents ?? {}).map(([n, i]) => ({
      name: n,
      usage: intentUsage(n, i),
      description: i.description,
      kind: i.do ? 'action' : 'navigate',
      action: i.do?.name,
      args: schemaJson(i.args),
    }))
  return {
    app: app.name,
    description: app.description,
    usage: `${app.name} [--as <actor>] [--json] <command> [args…] [--flag value…]`,
    pages: app.pages.map((p) => ({
      name: p.name,
      path: p.path,
      description: p.def.description,
      usage: pageUsage(p.name, app),
      params: schemaJson(p.params),
      intents: intentsOf(p),
    })),
    everywhere: app.shell ? intentsOf(app.shell) : [],
    actions: app.allActions.map((a) => ({
      name: a.name,
      description: a.description,
      requiresApproval: Boolean(a.requiresApproval),
      input: schemaJson(a.input),
    })),
    commands: FRAMEWORK_COMMANDS,
    exitCodes: { 0: 'done', 1: 'bad input', 2: 'not found', 3: 'proposed, awaiting approval', 4: 'refused', 5: 'timed out', 6: 'not allowed', 70: 'internal error' },
  }
}
