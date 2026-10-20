/**
 * Framework-level commands, shared by one-shot CLI calls and the interactive
 * terminal UI. App commands come from the matched routes' `screen.commands`.
 */
import type { Session } from './session.js'
import { describeActions } from './actions.js'
import { describeEntry } from './log.js'
import { collectCommands, renderBody, renderTitle, stripAnsi } from '../render/text.js'

export interface CommandOutcome {
  /** Text to show the actor (in addition to, or instead of, the screen). */
  message?: string
  /** Show the screen after this command? (false for log/tools/help/…) */
  screen?: boolean
  /** Machine-readable payload for --json. */
  data?: unknown
  exitCode?: number
}

export const FRAMEWORK_COMMANDS: Record<string, string> = {
  'go <url>': 'navigate anywhere, e.g. go /books?genre=gothic&sort=price',
  back: 'history back',
  forward: 'history forward',
  'set k=v …': "change the current route's search params",
  'unset k …': 'remove search params',
  'do <action> [--k v | json]': 'run an action, e.g. do cart.add --bookId 3 --qty 2',
  'approve <id>': 'approve a proposal (user only)',
  'reject <id> [reason]': 'reject a proposal (user only)',
  pending: 'list open proposals',
  'wait <id>': 'block until a proposal is approved or rejected',
  'peek <actor>': "see another actor's screen without moving",
  'follow <actor>': "move with another actor's cursor (interactive)",
  unfollow: 'stop following',
  'log [n]': 'recent entries in the shared action log',
  tools: 'JSON manifest of routes and actions (for agents)',
  state: 'dump router + query state',
  help: 'this help',
}

const parseValue = (v: string): unknown => {
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

export interface ParsedLine {
  name: string
  args: string[]
  flags: Record<string, string>
}

/** `do cart.add --bookId 3 --qty=2 extra` → { name, args, flags } */
export function parseTokens(tokens: string[]): ParsedLine {
  const [name = '', ...rest] = tokens
  const args: string[] = []
  const flags: Record<string, string> = {}
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i]!
    if (t.startsWith('--')) {
      const [k, v] = t.slice(2).split(/=(.*)/s)
      if (v !== undefined) flags[k!] = v
      else if (rest[i + 1] !== undefined && !rest[i + 1]!.startsWith('--')) flags[k!] = rest[++i]!
      else flags[k!] = 'true'
    } else args.push(t)
  }
  return { name, args, flags }
}

/** Shell-ish split that respects quotes, for interactive lines. */
export const splitLine = (line: string) =>
  [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!)

export interface CommandEnv {
  session: Session
  /** Build a read-only session positioned at another actor's cursor. */
  peek: (actor: string) => Promise<Session>
}

export async function runCommand(env: CommandEnv, line: ParsedLine): Promise<CommandOutcome> {
  const { session } = env
  const { name, args, flags } = line
  const { router, history, log } = session
  const snap = session.snapshot()

  switch (name) {
    case 'go':
      if (!args[0]) return { message: 'usage: go <url>', exitCode: 1 }
      await router.navigate({ href: args[0] })
      return {}
    case 'back':
      history.back()
      return {}
    case 'forward':
      history.forward()
      return {}
    case 'set':
    case 'unset': {
      const patch: Record<string, unknown> = {}
      for (const a of args) {
        const [k, v] = a.split(/=(.*)/s)
        if (k) patch[k] = name === 'set' ? parseValue(v ?? '') : undefined
      }
      await router.navigate({ to: snap.pathname, search: { ...snap.search, ...patch } } as never)
      return {}
    }
    case 'do': {
      const action = args[0]
      if (!action) return { message: `usage: do <action>. Actions: ${Object.keys(session.actions).join(', ')}`, exitCode: 1 }
      const input = args[1] ? JSON.parse(args[1]) : flags
      const r = await session.dispatch(action, input)
      return r.status === 'proposed'
        ? { message: `proposed #${r.id} — waiting for the user to approve`, data: r, exitCode: 3 }
        : { message: `done (#${r.id}) ${JSON.stringify(r.result)}`, data: r }
    }
    case 'approve': {
      const r = await session.approve(Number(args[0]))
      return { message: `approved #${args[0]} → done (#${r.id})`, data: r }
    }
    case 'reject': {
      const e = session.reject(Number(args[0]), args.slice(1).join(' ') || undefined)
      return { message: `rejected #${args[0]}`, data: e }
    }
    case 'pending': {
      const p = log.pending()
      return { screen: false, data: p, message: p.map(describeEntry).join('\n') || 'no pending proposals' }
    }
    case 'wait': {
      const id = Number(args[0])
      const deadline = Date.now() + Number(flags.timeout ?? 120) * 1000
      while (Date.now() < deadline) {
        const r = log.resolution(id)
        if (r) return { screen: false, data: r, message: describeEntry(r), exitCode: r.kind === 'apply' ? 0 : 4 }
        await new Promise((res) => setTimeout(res, 250))
      }
      return { screen: false, message: `#${id} still pending`, exitCode: 5 }
    }
    case 'peek': {
      const other = args[0]
      if (!other) return { message: 'usage: peek <actor>', exitCode: 1 }
      const s = await env.peek(other)
      const ps = s.snapshot()
      const view = {
        actor: other,
        href: ps.href,
        title: renderTitle(ps, s.screenOf, s.queryClient),
        screen: stripAnsi(renderBody(ps, s.screenOf, s.queryClient)),
      }
      s.dispose()
      return { screen: false, data: view, message: `[${other}]  ${view.href}\n${view.title}\n\n${view.screen}` }
    }
    case 'follow':
      if (!args[0]) return { message: 'usage: follow <actor>', exitCode: 1 }
      await session.follow(args[0])
      return { message: `following ${args[0]}` }
    case 'unfollow':
      await session.follow(null)
      return { message: 'stopped following' }
    case 'log': {
      const entries = log.tail(Number(args[0] ?? 20))
      return { screen: false, data: entries, message: entries.map(describeEntry).join('\n') || 'log is empty' }
    }
    case 'tools':
      return { screen: false, data: manifest(session), message: JSON.stringify(manifest(session), null, 2) }
    case 'state': {
      const data = {
        ...snap,
        queries: session.queryClient
          .getQueryCache()
          .getAll()
          .map((q) => ({ key: q.queryKey, status: q.state.status, stale: q.isStale() })),
      }
      return { screen: false, data, message: JSON.stringify(data, null, 2) }
    }
    case 'help': {
      const local = collectCommands(snap, session.screenOf).map(({ name: n, cmd }) => [cmd.usage ?? n, cmd.help])
      const rows = [...local, ...Object.entries(FRAMEWORK_COMMANDS)]
      return { screen: false, message: rows.map(([u, h]) => `  ${u!.padEnd(28)} ${h}`).join('\n') }
    }
  }

  // App commands, declared by the matched routes.
  const found = collectCommands(snap, session.screenOf).find((c) => c.name === name)
  if (!found) return { message: `unknown command "${name}" — try help`, exitCode: 1 }
  const result = await found.cmd.run({
    args,
    flags,
    match: snap.matches[found.matchIndex]!,
    snapshot: snap,
    queryClient: session.queryClient,
    navigate: router.navigate,
    dispatch: session.dispatch,
  })
  if (typeof result === 'string')
    return { message: result, exitCode: result.startsWith('proposed') ? 3 : undefined }
  return {}
}

/** Everything an agent needs to drive the app: routes (+ search schemas) and actions. */
export function manifest(session: Session) {
  const routes = Object.values(
    session.router.routesById as Record<string, { id: string; fullPath: string; options: { staticData?: { screen?: import('./screen.js').Screen } } }>,
  )
    .filter((r) => r.id !== '__root__')
    .map((r) => {
      const screen = r.options.staticData?.screen
      return {
        path: r.fullPath,
        search: screen?.search ? JSON.parse(JSON.stringify(screen.search)) : undefined,
        commands: Object.entries(screen?.commands ?? {}).map(([n, c]) => ({ name: c.usage ?? n, help: c.help })),
      }
    })
  const rootCommands = Object.entries(
    (session.router.routesById as Record<string, { options: { staticData?: { screen?: import('./screen.js').Screen } } }>)
      .__root__?.options.staticData?.screen?.commands ?? {},
  ).map(([n, c]) => ({ name: c.usage ?? n, help: c.help }))
  return {
    usage: 'bookshop --as <actor> [--json] <command> [args]',
    commands: [...rootCommands, ...Object.entries(FRAMEWORK_COMMANDS).map(([name, help]) => ({ name, help }))],
    routes,
    actions: describeActions(session.actions),
  }
}
