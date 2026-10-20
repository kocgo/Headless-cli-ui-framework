/** Render the semantic view tree as terminal text. */
import type { Tone, ViewElement, ViewNode } from '../view.js'
import { describeEntry, type LogEntry } from '../engine/log.js'
import type { Screen } from '../engine/screen.js'

const ESC = '\x1b['
const style = {
  bold: (s: string) => `${ESC}1m${s}${ESC}0m`,
  dim: (s: string) => `${ESC}2m${s}${ESC}0m`,
  underline: (s: string) => `${ESC}4m${s}${ESC}0m`,
  green: (s: string) => `${ESC}32m${s}${ESC}0m`,
  yellow: (s: string) => `${ESC}33m${s}${ESC}0m`,
  red: (s: string) => `${ESC}31m${s}${ESC}0m`,
}
export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
const vlen = (s: string) => [...stripAnsi(s)].length
const padTo = (s: string, n: number, right = false) => {
  const gap = ' '.repeat(Math.max(0, n - vlen(s)))
  return right ? gap + s : s + gap
}
const truncate = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, Math.max(0, n - 1)).join('') + '…' : s)

const toned = (s: string, tone?: Tone) =>
  tone === 'dim' ? style.dim(s)
  : tone === 'bold' ? style.bold(s)
  : tone === 'success' ? style.green(s)
  : tone === 'warning' ? style.yellow(s)
  : tone === 'danger' ? style.red(s)
  : s

const textOf = (el: ViewElement) => el.children.filter((c): c is string => typeof c === 'string').join('')

function blocks(children: ViewNode[], width: number, gap: number): string[] {
  const out: string[] = []
  children.forEach((c, i) => {
    const lines = render(c, width)
    if (!lines.length) return
    if (i > 0 && out.length) for (let g = 0; g < gap; g++) out.push('')
    out.push(...lines)
  })
  return out
}

export function render(node: ViewNode, width = 80): string[] {
  if (typeof node === 'string') return node ? node.split('\n') : []
  const p = node.props
  switch (node.type) {
    case 'Fragment':
    case 'Stack':
      return blocks(node.children, width, Number(p.gap ?? 0))
    case 'Page': {
      const head = [p.title && style.bold(String(p.title)), p.subtitle && style.dim(String(p.subtitle))].filter(Boolean) as string[]
      const body = blocks(node.children, width, 1)
      return head.length && body.length ? [...head, '', ...body] : [...head, ...body]
    }
    case 'Section':
      return [...(p.title ? [style.bold(String(p.title))] : []), ...blocks(node.children, width, 0)]
    case 'Row': {
      const cols = node.children.map((c) => render(c, width)).filter((l) => l.length)
      const widths = cols.map((l) => Math.max(...l.map(vlen)))
      const height = Math.max(0, ...cols.map((l) => l.length))
      const g = ' '.repeat(Number(p.gap ?? 2))
      return Array.from({ length: height }, (_, r) => cols.map((l, i) => padTo(l[r] ?? '', widths[i]!)).join(g).trimEnd())
    }
    case 'Text':
      return textOf(node).split('\n').map((l) => toned(l, p.tone as Tone))
    case 'Badge':
      return [toned(`[${textOf(node)}]`, (p.tone as Tone) ?? 'dim')]
    case 'Divider':
      return [style.dim('─'.repeat(Math.min(width, 48)))]
    case 'KeyValue': {
      const items = p.items as Array<[string, string]>
      const w = Math.max(0, ...items.map(([k]) => k.length))
      return items.map(([k, v]) => `${style.dim(k.padEnd(w))}  ${v}`)
    }
    case 'Link':
      return [style.underline(textOf(node) || String(p.href))]
    case 'Button': {
      const label = p.hotkey ? `[${p.hotkey}] ${p.label}` : `[ ${p.label} ]`
      return [p.disabled ? style.dim(label) : label]
    }
    case 'Input': {
      const sub = p.submit as { argv: string[]; template: string }
      const hint = `${sub.argv.join(' ')} ${sub.template.replace('{value}', '…')}`
      const value = String(p.value ?? '') || style.dim(String(p.placeholder ?? ''))
      return [`${p.label ?? p.param}: ${value}▏ ${style.dim(`(${hint})`)}`]
    }
    case 'Table': {
      const cols = p.columns as Array<{ label: string; align: 'left' | 'right' }>
      const rows = p.rows as Array<{ cells: string[]; command?: string[]; disabled?: boolean }>
      if (!rows.length) return [style.dim(String(p.empty ?? 'Nothing here.'))]
      const numbered = Boolean(p.rowIntent)
      const num = numbered ? String(rows.length).length + 2 : 0
      const widths = cols.map((c, i) => Math.max(c.label.length, ...rows.map((r) => [...(r.cells[i] ?? '')].length)))
      // Shrink the widest columns until the table fits.
      while (num + widths.reduce((a, b) => a + b + 2, 0) > width && Math.max(...widths) > 6) widths[widths.indexOf(Math.max(...widths))]!--
      const line = (cells: string[]) =>
        cells.map((c, i) => padTo(truncate(c, widths[i]!), widths[i]!, cols[i]!.align === 'right')).join('  ').trimEnd()
      return [
        style.dim(' '.repeat(num) + line(cols.map((c) => c.label))),
        ...rows.map((r, i) => {
          const l = (numbered ? `${String(i + 1).padStart(num - 2)}. ` : '') + line(r.cells)
          return r.disabled ? style.dim(l) : l
        }),
      ]
    }
    default:
      return blocks(node.children, width, 0)
  }
}

export interface Chrome {
  actor: string
  following?: string | null
  pending?: LogEntry[]
  feed?: LogEntry[]
  message?: string
  width?: number
}

export function renderFrame(s: Screen, chrome: Chrome): string {
  const width = chrome.width ?? 80
  const who = `${chrome.actor}${chrome.following ? ` · following ${chrome.following}` : ''}`
  const lines = [style.dim(`[${who}]  ${s.href}`), '']
  if (s.status === 'ok') lines.push(...render(s.view, width))
  else if (s.status === 'not_found') lines.push(style.bold('Not found'), style.dim(`Nothing at ${s.href}.`))
  else if (s.status === 'error') lines.push(style.red(`Error: ${s.error}`))
  else lines.push(style.dim('Loading…'))

  const here = s.intents.filter((i) => i.available).map((i) => i.usage)
  if (here.length) lines.push('', style.dim(here.join(' · ')))

  for (const p of chrome.pending ?? []) {
    const decide = chrome.actor === 'user' && p.actor !== chrome.actor ? `  → approve ${p.id} · reject ${p.id}` : '  (awaiting the user)'
    lines.push(style.yellow(`⚑ #${p.id} ${p.actor} wants ${p.action} ${JSON.stringify(p.input)}${decide}`))
  }
  if (chrome.feed?.length) {
    lines.push('', style.dim('activity'))
    for (const e of chrome.feed) lines.push(style.dim('  ' + describeEntry(e)))
  }
  if (chrome.message) lines.push('', chrome.message)
  return lines.join('\n')
}
