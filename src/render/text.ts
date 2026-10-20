/**
 * Pure text renderer: (snapshot, routes, query cache) → string.
 * Composes nested route views leaf-first, each parent receiving its child's
 * output as `outlet` — the headless equivalent of <Outlet />.
 */
import type { QueryClient } from '@tanstack/query-core'
import type { Snapshot } from '../headless/router.js'
import type { Command, Screen } from '../app/screen.js'

export type ScreenLookup = (routeId: string) => Screen | undefined

export const GLOBAL_COMMANDS: Record<string, string> = {
  'go <url>': 'navigate to any URL',
  back: 'history back',
  forward: 'history forward',
  history: 'show history stack',
  refresh: 'invalidate all queries',
  state: 'dump state as JSON',
  quit: 'exit',
}

export function collectCommands(snap: Snapshot, screenOf: ScreenLookup) {
  const out: Array<{ name: string; cmd: Command; matchIndex: number }> = []
  snap.matches.forEach((m, i) => {
    for (const [name, cmd] of Object.entries(screenOf(m.routeId)?.commands ?? {}))
      out.push({ name, cmd, matchIndex: i })
  })
  return out.reverse() // leaf-most first, so child commands shadow parents
}

export function renderText(snap: Snapshot, screenOf: ScreenLookup, queryClient: QueryClient): string {
  const crumbs = snap.matches
    .map((m) => screenOf(m.routeId)?.title?.(m, queryClient))
    .filter(Boolean)
    .join(' › ')

  let body: string
  if (snap.status === 'pending') body = '  loading…'
  else if (snap.notFound) body = `  404 — nothing at ${snap.pathname}`
  else {
    const failed = snap.matches.find((m) => m.status === 'error')
    if (failed) body = `  error in ${failed.routeId}: ${failed.error}`
    else {
      body = ''
      for (let i = snap.matches.length - 1; i >= 0; i--) {
        const m = snap.matches[i]!
        const view = screenOf(m.routeId)?.view
        if (view) body = view(m, { snapshot: snap, queryClient, outlet: body })
      }
    }
  }

  const cmds = snap.status === 'idle' && !snap.notFound ? collectCommands(snap, screenOf) : []
  const hints = cmds.map(({ name, cmd }) => cmd.usage ?? name).join(' · ')

  return [
    `\x1b[2m${snap.href}\x1b[0m`,
    `\x1b[1m${crumbs || '—'}\x1b[0m`,
    '',
    body,
    '',
    `\x1b[2m${hints ? hints + ' · ' : ''}back · go <url> · help\x1b[0m`,
  ].join('\n')
}
