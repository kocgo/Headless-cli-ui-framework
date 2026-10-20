#!/usr/bin/env node
/**
 * bookshop — a web-like terminal app shared by a user and an agent.
 *
 *   bookshop search dune                        one-shot (as the user)
 *   bookshop --as agent --json book 3           one-shot, JSON screen for agents
 *   bookshop --as agent do user.updateEmail --email a@b.co   → proposal
 *   bookshop                                    interactive terminal UI (user)
 *   bookshop log --follow                       tail the shared action log
 *
 * Every process opens the same SQLite file (BOOKSHOP_DB or --db). The action
 * log in it is the only sync channel between actors.
 */
import { createInterface } from 'node:readline'
import { openDb } from './core/db.js'
import { createActionLog, describeEntry, type LogEntry } from './core/log.js'
import { createSession, type Session } from './core/session.js'
import { parseTokens, runCommand, splitLine, type CommandEnv, type CommandOutcome } from './core/commands.js'
import { ValidationError } from './core/actions.js'
import { collectCommands, renderBody, renderText, renderTitle, stripAnsi } from './render/text.js'
import { createBackend } from './shop/backend.js'
import { createActions } from './shop/actions.js'
import { createQueries } from './shop/queries.js'
import { createRouteTree } from './shop/routes.js'

// ── args: global flags first, the rest is the command ───────────────────────
const raw = process.argv.slice(2)
const globals: Record<string, string | true> = {}
const rest: string[] = []
for (let i = 0; i < raw.length; i++) {
  const t = raw[i]!
  if (rest.length === 0 && ['--as', '--db'].includes(t)) globals[t.slice(2)] = raw[++i] ?? ''
  else if (rest.length === 0 && ['--json', '-i', '--interactive', '--no-color'].includes(t)) globals[t.replace(/^-+/, '')] = true
  else rest.push(t)
}
const actor = String(globals.as ?? 'user')
const asJson = Boolean(globals.json)
const tty = Boolean(process.stdout.isTTY)
const color = tty && !globals['no-color']
const out = (s: string) => process.stdout.write((color ? s : stripAnsi(s)) + '\n')

// ── wiring ───────────────────────────────────────────────────────────────────
const db = openDb(String(globals.db ?? process.env.BOOKSHOP_DB ?? 'bookshop.db'))
const log = createActionLog(db)
const api = createBackend(db)
const actions = createActions(api)
const queries = createQueries(api, log)
const tree = createRouteTree(queries)

const session = await createSession({ actor, log, actions, createRouteTree: tree })
const env: CommandEnv = {
  session,
  peek: (other) => createSession({ actor: other, cursorOf: other, readOnly: true, log, actions, createRouteTree: tree }),
}

async function exec(tokens: string[]): Promise<CommandOutcome> {
  try {
    const outcome = await session.exclusive(async () => {
      const o = await runCommand(env, parseTokens(tokens))
      await session.settle()
      return o
    })
    return outcome
  } catch (e) {
    const msg = e instanceof ValidationError ? `invalid input: ${e.message}` : `error: ${(e as Error).message}`
    return { message: msg, exitCode: 1, screen: false }
  }
}

function screenJson(s: Session, outcome?: CommandOutcome) {
  const snap = s.snapshot()
  const leaf = snap.matches.at(-1)
  return {
    actor: s.actor,
    href: snap.href,
    title: renderTitle(snap, s.screenOf, s.queryClient),
    notFound: snap.notFound,
    params: leaf?.params ?? {},
    search: snap.search,
    screen: stripAnsi(renderBody(snap, s.screenOf, s.queryClient)),
    data: leaf?.loaderData ?? null,
    commands: collectCommands(snap, s.screenOf).map(({ name, cmd }) => ({ name: cmd.usage ?? name, help: cmd.help })),
    pending: s.log.pending(),
    message: outcome?.message,
    result: outcome?.data,
  }
}

// ── `log --follow`: a live tail of the shared log ───────────────────────────
if (rest[0] === 'log' && rest.includes('--follow')) {
  log.tail(10).forEach((e) => out(asJson ? JSON.stringify(e) : describeEntry(e)))
  let last = log.lastId()
  setInterval(() => {
    for (const e of log.since(last)) {
      out(asJson ? JSON.stringify(e) : describeEntry(e))
      last = e.id
    }
  }, 250)
}

// ── one-shot ────────────────────────────────────────────────────────────────
else if (rest.length && !globals.i && !globals.interactive) {
  const outcome = await exec(rest)
  if (asJson) out(JSON.stringify(outcome.screen === false ? { message: outcome.message, result: outcome.data } : screenJson(session, outcome), null, 2))
  else {
    if (outcome.screen !== false)
      out(renderText(session.snapshot(), session.screenOf, session.queryClient, { actor, pending: log.pending(), message: outcome.message }))
    else if (outcome.message) out(outcome.message)
  }
  session.dispose()
  process.exit(outcome.exitCode ?? (session.snapshot().notFound ? 2 : 0))
}

// ── interactive terminal UI ─────────────────────────────────────────────────
else {
  const feed: LogEntry[] = []
  let message = ''
  let lastFrame = ''

  const draw = () => {
    const snap = session.snapshot()
    if (snap.status === 'pending' && !tty) return
    const frame = renderText(snap, session.screenOf, session.queryClient, {
      actor,
      following: session.following,
      pending: log.pending(),
      feed: feed.slice(-4),
      message,
    })
    if (frame === lastFrame) return
    lastFrame = frame
    if (tty) process.stdout.write('\x1b[2J\x1b[H')
    else out('\n' + '═'.repeat(64))
    out(frame)
    if (tty) rl.prompt(true)
  }

  session.app.onChange(draw)

  // Tail the log: other processes' entries invalidate queries and move cursors.
  const tick = setInterval(() => {
    void session.exclusive(async () => {
      const fresh = await session.sync()
      if (fresh.length) {
        feed.push(...fresh)
        draw()
      }
    })
  }, 300)

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: tty ? `${actor}› ` : '' })
  draw()
  rl.prompt()

  let chain = Promise.resolve()
  rl.on('line', (line) => {
    const tokens = splitLine(line.trim())
    if (!tokens.length) return rl.prompt()
    if (tokens[0] === 'quit' || tokens[0] === 'exit') return rl.close()
    chain = chain.then(async () => {
      if (!tty) out(`${actor}› ${line.trim()}`)
      const outcome = await exec(tokens)
      if (outcome.screen === false) {
        message = ''
        out(outcome.message ?? '')
      } else {
        message = outcome.message ?? ''
        lastFrame = ''
        draw()
      }
      rl.prompt()
    })
  })
  rl.on('close', () => {
    void chain.then(() => {
      clearInterval(tick)
      session.dispose()
      process.exit(0)
    })
  })
}
