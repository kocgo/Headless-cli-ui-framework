#!/usr/bin/env node
/**
 * Usage:
 *   catalog /datasets?q=risk            one-shot: resolve URL, print screen, exit
 *   catalog /datasets/104 --json        one-shot, machine-readable state
 *   catalog -i [url]                    interactive (also accepts piped commands)
 *   catalog -i --resume                 reopen last session's history stack
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createHeadlessRouter, type Snapshot } from './headless/router.js'
import { routeTree } from './app/routes.js'
import { createQueryClient } from './app/queries.js'
import type { Screen } from './app/screen.js'
import { collectCommands, GLOBAL_COMMANDS, renderText } from './render/text.js'

const SESSION_FILE = '.catalog-session.json'
const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('-')))
const url = argv.find((a) => !a.startsWith('-'))
const interactive = flags.has('-i') || flags.has('--interactive')
const asJson = flags.has('--json')
const tty = Boolean(process.stdout.isTTY)
const color = tty && !flags.has('--no-color')

const strip = (s: string) => (color ? s : s.replace(/\x1b\[[0-9;]*m/g, ''))
const out = (s: string) => process.stdout.write(strip(s) + '\n')

// ── wire up ─────────────────────────────────────────────────────────────────
let initialEntries = [url ?? '/']
let initialIndex: number | undefined
if (flags.has('--resume') && existsSync(SESSION_FILE)) {
  const saved = JSON.parse(readFileSync(SESSION_FILE, 'utf8')) as { entries: string[]; index: number }
  initialEntries = url ? [...saved.entries.slice(0, saved.index + 1), url] : saved.entries
  initialIndex = url ? undefined : saved.index
}

const queryClient = createQueryClient()
const app = createHeadlessRouter({
  routeTree,
  initialEntries,
  initialIndex,
  context: { queryClient },
  // Query cache changes (refetch, invalidate, setQueryData) re-render the screen.
  externalSources: [(notify) => queryClient.getQueryCache().subscribe(notify)],
})
const { router } = app
const screenOf = (routeId: string) =>
  (router.routesById as Record<string, { options: { staticData?: { screen?: Screen } } }>)[routeId]?.options
    .staticData?.screen

const dumpState = (s: Snapshot) => ({
  ...s,
  queries: queryClient
    .getQueryCache()
    .getAll()
    .map((q) => ({ key: q.queryKey, status: q.state.status, fetching: q.state.fetchStatus, stale: q.isStale() })),
})

async function settle() {
  await app.settled()
  while (queryClient.isFetching()) await new Promise((r) => setTimeout(r, 5))
  await new Promise((r) => setImmediate(r)) // flush coalesced re-render
}

// ── one-shot ────────────────────────────────────────────────────────────────
if (!interactive) {
  await app.start()
  await settle()
  const snap = app.snapshot()
  out(asJson ? JSON.stringify(dumpState(snap), null, 2) : renderText(snap, screenOf, queryClient))
  process.exit(snap.notFound ? 2 : 0)
}

// ── interactive ─────────────────────────────────────────────────────────────
let last = ''
app.onChange((snap) => {
  if (snap.status === 'pending' && !tty) return // keep piped logs clean
  const frame = renderText(snap, screenOf, queryClient)
  if (frame === last) return
  last = frame
  if (tty) process.stdout.write('\x1b[2J\x1b[H')
  else out('\n' + '═'.repeat(60))
  out(frame)
  if (snap.status === 'idle') {
    writeFileSync(SESSION_FILE, JSON.stringify({ entries: snap.history.entries, index: snap.history.index }))
  }
})

await app.start()
await settle()

const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: tty ? '› ' : '' })

async function run(line: string) {
  const [name, ...args] = line.trim().split(/\s+/)
  if (!name) return
  if (!tty) out(`› ${line.trim()}`)
  const snap = app.snapshot()
  switch (name) {
    case 'quit':
    case 'exit':
      rl.close()
      return
    case 'back':
      return router.history.back()
    case 'forward':
      return router.history.forward()
    case 'go':
      return router.navigate({ href: args[0] ?? '/' })
    case 'refresh':
      return queryClient.invalidateQueries()
    case 'history':
      return out(snap.history.entries.map((e, i) => `${i === snap.history.index ? '→' : ' '} ${e}`).join('\n'))
    case 'state':
      return out(JSON.stringify(dumpState(snap), null, 2))
    case 'help': {
      const local = collectCommands(snap, screenOf).map(({ name, cmd }) => [cmd.usage ?? name, cmd.help])
      return out(
        [...local, ...Object.entries(GLOBAL_COMMANDS)].map(([u, h]) => `  ${u!.padEnd(18)} ${h}`).join('\n'),
      )
    }
  }
  const found = collectCommands(snap, screenOf).find((c) => c.name === name)
  if (!found) return out(`unknown command "${name}" — try help`)
  return found.cmd.run({
    args,
    match: snap.matches[found.matchIndex]!,
    snapshot: snap,
    queryClient,
    navigate: router.navigate,
  })
}

// Serialise commands so piped scripts behave deterministically.
let chain = Promise.resolve()
rl.on('line', (line) => {
  chain = chain
    .then(() => run(line))
    .then(settle)
    .catch((e) => out(`error: ${(e as Error).message}`))
    .then(() => rl.prompt())
})
rl.on('close', () => {
  void chain.then(() => {
    app.dispose()
    process.exit(0)
  })
})
rl.prompt()
