/**
 * Pure text renderer: (snapshot, route screens, query cache, chrome) → string.
 * Route views compose leaf-first; each parent receives its child's output as
 * `outlet` — the headless equivalent of <Outlet />.
 */
import type { QueryClient } from '@tanstack/query-core'
import type { Snapshot } from '../headless/router.js'
import type { Command, Screen } from '../core/screen.js'
import { describeEntry, type LogEntry } from '../core/log.js'

export type ScreenLookup = (routeId: string) => Screen | undefined

export function collectCommands(snap: Snapshot, screenOf: ScreenLookup) {
  const out: Array<{ name: string; cmd: Command; matchIndex: number }> = []
  snap.matches.forEach((m, i) => {
    for (const [name, cmd] of Object.entries(screenOf(m.routeId)?.commands ?? {})) out.push({ name, cmd, matchIndex: i })
  })
  // Leaf-most first, so a child route's command shadows a parent's of the same name.
  return out.reverse().filter((c, i, all) => all.findIndex((o) => o.name === c.name) === i)
}

export function renderTitle(snap: Snapshot, screenOf: ScreenLookup, qc: QueryClient) {
  return snap.matches
    .map((m) => {
      try {
        return screenOf(m.routeId)?.title?.(m, qc)
      } catch {
        return undefined
      }
    })
    .filter(Boolean)
    .join(' › ')
}

export function renderBody(snap: Snapshot, screenOf: ScreenLookup, queryClient: QueryClient) {
  if (snap.status === 'pending') return '  loading…'
  if (snap.notFound) return `  404 — nothing at ${snap.pathname}`
  const failed = snap.matches.find((m) => m.status === 'error')
  if (failed) return `  error in ${failed.routeId}: ${failed.error}`
  let body = ''
  for (let i = snap.matches.length - 1; i >= 0; i--) {
    const m = snap.matches[i]!
    const view = screenOf(m.routeId)?.view
    if (view) body = view(m, { snapshot: snap, queryClient, outlet: body })
  }
  return body
}

export interface Chrome {
  actor: string
  following?: string | null
  pending?: LogEntry[]
  feed?: LogEntry[]
  message?: string
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`

export function renderText(snap: Snapshot, screenOf: ScreenLookup, qc: QueryClient, chrome: Chrome): string {
  const who = `${chrome.actor}${chrome.following ? ` · following ${chrome.following}` : ''}`
  const cmds = snap.status === 'idle' && !snap.notFound ? collectCommands(snap, screenOf) : []
  const local = cmds.filter((c) => c.matchIndex > 0).map(({ name, cmd }) => cmd.usage ?? name)

  const lines = [
    dim(`[${who}]  ${snap.href}`),
    bold(renderTitle(snap, screenOf, qc) || '—'),
    '',
    renderBody(snap, screenOf, qc),
    '',
    dim([...local, 'search', 'cart', 'account', 'back', 'help'].join(' · ')),
  ]

  if (chrome.pending?.length) {
    lines.push('')
    for (const p of chrome.pending) {
      const canDecide = chrome.actor === 'user' && p.actor !== chrome.actor
      lines.push(
        yellow(
          `⚑ #${p.id} ${p.actor} wants ${p.action} ${JSON.stringify(p.input)}` +
            (canDecide ? `  → approve ${p.id} · reject ${p.id}` : '  (awaiting user)'),
        ),
      )
    }
  }
  if (chrome.feed?.length) {
    lines.push('', dim('activity'))
    for (const e of chrome.feed) lines.push(dim('  ' + describeEntry(e)))
  }
  if (chrome.message) lines.push('', chrome.message)
  return lines.join('\n')
}

export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
