/**
 * The CLI entry point every app gets:  runCli(app)
 *
 *   <app> [--as actor] [--json] [--db path] <command> [args…] [--flag value…]
 *   <app>                                  interactive terminal UI
 */
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createInterface } from 'node:readline'
import type { App } from '../app.js'
import { openDb } from '../engine/db.js'
import { AppError, EXIT, exitCodeOf, toAppError } from '../engine/errors.js'
import { createActionLog, describeEntry, type LogEntry } from '../engine/log.js'
import { createSession } from '../engine/session.js'
import { parseTokens, runCommand, screenJson, splitLine, type CommandEnv, type Outcome } from './commands.js'
import { renderFrame, stripAnsi } from './text.js'

export async function runCli(app: App, argv = process.argv.slice(2)) {
  const NAME = app.name.toUpperCase().replace(/-/g, '_')
  const globals: Record<string, string | true> = {}
  const rest: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]!
    if (rest.length === 0 && (t === '--as' || t === '--db')) globals[t.slice(2)] = argv[++i] ?? ''
    else if (rest.length === 0 && ['--json', '-i', '--no-color', '--quiet'].includes(t)) globals[t.replace(/^-+/, '')] = true
    else rest.push(t)
  }

  // Actor: --as, then <APP>_ACTOR, then "agent" inside Claude Code's Bash tool, then "user".
  const actor = String(globals.as ?? process.env[`${NAME}_ACTOR`] ?? (process.env.CLAUDECODE ? 'agent' : 'user'))
  const asJson = Boolean(globals.json) || process.env[`${NAME}_JSON`] === '1'
  const tty = Boolean(process.stdout.isTTY)
  const color = tty && !globals['no-color'] && !process.env.NO_COLOR
  const print = (s: string) => process.stdout.write((color ? s : stripAnsi(s)) + '\n')

  const dbPath = String(globals.db ?? process.env[`${NAME}_DB`] ?? `.${app.name}/${app.name}.db`)
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = openDb(dbPath)
  const log = createActionLog(db)
  const ctx = app.context({ db, log })

  const session = await createSession({ app, actor, log, ctx })
  const env: CommandEnv = {
    app,
    session,
    dbPath,
    peek: (other) => createSession({ app, actor: other, cursorOf: other, readOnly: true, log, ctx }),
  }

  const exec = (tokens: string[]): Promise<Outcome & { error?: AppError }> =>
    session.exclusive(async () => {
      try {
        const o = await runCommand(env, parseTokens(tokens))
        await session.settle()
        const s = session.screen()
        return o.screen && s.status === 'not_found' && o.exit === EXIT.ok ? { ...o, exit: EXIT.notFound } : o
      } catch (e) {
        const err = toAppError(e)
        return { screen: false, exit: exitCodeOf(err.code), message: err.message, error: err }
      }
    })

  const envelope = (command: string, o: Outcome & { error?: AppError }) => ({
    v: 1,
    ok: !o.error,
    actor,
    command,
    message: o.message ?? null,
    result: o.result ?? null,
    ...(o.screen ? { screen: screenJson(session.screen()) } : {}),
    pending: log.pending(),
    error: o.error ? { code: o.error.code, message: o.error.message, details: o.error.details } : null,
  })

  // ── live tail of the shared log ────────────────────────────────────────────
  if (rest[0] === 'log' && rest.includes('--follow')) {
    const show = (e: LogEntry) => print(asJson ? JSON.stringify(e) : describeEntry(e))
    log.tail(10).forEach(show)
    let last = log.lastId()
    setInterval(() => {
      for (const e of log.since(last)) {
        show(e)
        last = e.id
      }
    }, 250)
    return
  }

  // ── one-shot ───────────────────────────────────────────────────────────────
  if (rest.length && !globals.i) {
    const o = await exec(rest)
    if (asJson) print(JSON.stringify(envelope(rest[0]!, o), null, 2))
    else if (o.error) process.stderr.write(`error: ${o.message}${o.error.details.length ? `\n  ${o.error.details.join('\n  ')}` : ''}\n`)
    else if (o.screen && !globals.quiet) print(renderFrame(session.screen(), { actor, pending: log.pending(), message: o.message, width: process.stdout.columns }))
    else if (o.message) print(o.message)
    session.dispose()
    process.exit(o.exit)
  }

  // ── interactive terminal UI ────────────────────────────────────────────────
  const feed: LogEntry[] = []
  let message = ''
  let lastFrame = ''
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: tty ? `${actor}› ` : '' })

  const draw = () => {
    const s = session.screen()
    if (s.status === 'pending') return
    const frame = renderFrame(s, {
      actor, following: session.following, pending: log.pending(), feed: feed.slice(-4), message, width: process.stdout.columns,
    })
    if (frame === lastFrame) return
    lastFrame = frame
    if (tty) process.stdout.write('\x1b[2J\x1b[H')
    else print('\n' + '═'.repeat(64))
    print(frame)
    if (tty) rl.prompt(true)
  }
  session.onChange(draw)

  const tick = setInterval(() => {
    void session.exclusive(async () => {
      const fresh = await session.sync()
      if (fresh.length) {
        feed.push(...fresh)
        draw()
      }
    })
  }, 300)

  draw()
  rl.prompt()
  let chain = Promise.resolve()
  rl.on('line', (line) => {
    const tokens = splitLine(line.trim())
    if (!tokens.length) return rl.prompt()
    if (tokens[0] === 'quit' || tokens[0] === 'exit') return rl.close()
    chain = chain.then(async () => {
      if (!tty) print(`${actor}› ${line.trim()}`)
      const o = await exec(tokens)
      if (!o.screen) {
        message = ''
        print(o.error ? `error: ${o.message}` : (o.message ?? ''))
      } else {
        message = o.message ?? ''
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
