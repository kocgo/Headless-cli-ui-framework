/**
 * The bookshop pane: a thin mod. It holds no app logic. It runs the plugin's
 * own CLI (`bin/bookshop --as user --json …`) through $.process.run and draws
 * the semantic view tree from the JSON envelope with Claude Code's elements.
 * Every press, row and input submits the exact CLI command the engine bound
 * to it, so the user and Claude go through the same commands and the same log.
 */
import type { EngineInterface, Register } from 'claude-code'

type Elements = ReturnType<EngineInterface['ui']['resolve']>

const PANE = 'bookshop'

interface ViewElement {
  type: string
  props: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  children: ViewNode[]
}
type ViewNode = string | ViewElement
interface Proposal {
  id: number
  actor: string
  action: string
  input: unknown
}
interface Entry {
  id: number
  actor: string
  kind: string
  page?: string
  params?: Record<string, unknown>
  intent?: string
  action?: string
  note?: string
}
interface Envelope {
  ok: boolean
  message: string | null
  result: unknown
  screen?: { href: string; title: string; status: string; error?: string; summary?: string; view: ViewNode }
  pending: Proposal[]
  error: { code: string; message: string } | null
}

// What the pane shows. Module state: a reload starts fresh and refetches.
let current: Envelope | undefined
let message = ''
let feed: Entry[] = []
let lastSeen = -1
let contextFrom = -1
let opened = false

// ── talking to the CLI (top-level functions: they may take $) ───────────────
async function cli($: EngineInterface, argv: string[]): Promise<Envelope | undefined> {
  try {
    const r = await $.process.run([$.plugin.root + '/bin/bookshop', '--as', 'user', '--json', ...argv], { timeoutMs: 20000 })
    return JSON.parse(r.stdout) as Envelope
  } catch (err) {
    message = 'The bookshop CLI did not answer: ' + String(err)
    return undefined
  }
}

/** Run a command as the user, keep the screen it returns, and redraw. */
async function run($: EngineInterface, argv: string[]) {
  const env = await cli($, argv)
  if (env) {
    message = env.error ? env.error.message : (env.message ?? '')
    if (env.screen) current = env
    else if (current) current = { ...current, pending: env.pending }
  }
  await pullFeed($)
  $.ui.invalidate('ui.render')
}

/** Refresh the user's screen and the activity of other actors. */
async function refresh($: EngineInterface) {
  const env = await cli($, ['show'])
  if (env?.screen) current = env
  await pullFeed($)
  $.ui.invalidate('ui.render')
}

async function pullFeed($: EngineInterface) {
  if (lastSeen < 0) {
    // First look: start the feed and Claude's context from now, not from the whole history.
    const tail = ((await cli($, ['log', '1']))?.result as Entry[] | null) ?? []
    lastSeen = tail[0]?.id ?? 0
    if (contextFrom < 0) contextFrom = lastSeen
    return
  }
  const env = await cli($, ['log', '--since', String(lastSeen)])
  const entries = (env?.result as Entry[] | null) ?? []
  if (entries.length) lastSeen = entries[entries.length - 1]!.id
  feed = [...feed, ...entries.filter((e) => e.actor !== 'user')].slice(-4)
}

const describe = (e: Entry) =>
  e.kind === 'visit'
    ? `${e.actor} opened ${e.page}${e.note ? ' · ' + e.note : ''}`
    : e.kind === 'propose'
      ? `${e.actor} proposes ${e.action}`
      : `${e.actor}: ${e.action ?? e.kind}${e.note ? ' · ' + e.note : ''}`

// ── drawing (a top-level function: it may take $ for the callbacks) ─────────
function draw($: EngineInterface, els: Elements, node: ViewNode, width: number, path: string): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { Box, Text, Button } = els
  if (typeof node === 'string') return Text({ children: [node] })
  const p = node.props
  const kids = () => node.children.map((c, i) => draw($, els, c, width, path + '.' + i))
  const label = node.children.filter((c): c is string => typeof c === 'string').join('')
  const tone = (t: string | undefined) =>
    t === 'dim' ? { dimColor: true } : t === 'bold' ? { bold: true } : t === 'success' ? { color: 'success' }
    : t === 'warning' ? { color: 'warning' } : t === 'danger' ? { color: 'error' } : {}
  switch (node.type) {
    case 'Page':
      return Box({
        flexDirection: 'column',
        rowGap: 1,
        children: [
          Box({
            flexDirection: 'column',
            children: [
              ...(p.title ? [Text({ bold: true, children: [String(p.title)] })] : []),
              ...(p.subtitle ? [Text({ dimColor: true, wrap: 'truncate-end', children: [String(p.subtitle)] })] : []),
            ],
          }),
          ...kids(),
        ],
      })
    case 'Section':
      return Box({ flexDirection: 'column', children: [...(p.title ? [Text({ bold: true, children: [String(p.title)] })] : []), ...kids()] })
    case 'Row':
      return Box({ flexDirection: 'row', columnGap: 2, children: kids() })
    case 'Stack':
    case 'Fragment':
      return Box({ flexDirection: 'column', rowGap: p.gap ?? 0, children: kids() })
    case 'Text':
      return Text({ ...tone(p.tone), children: [label] })
    case 'Badge':
      return Text({ ...tone(p.tone ?? 'dim'), children: ['[' + label + ']'] })
    case 'Divider':
      return Text({ dimColor: true, children: ['─'.repeat(Math.max(4, Math.min(width - 2, 48)))] })
    case 'KeyValue': {
      const items = p.items as Array<[string, string]>
      const w = Math.max(0, ...items.map(([k]) => k.length))
      return Box({
        flexDirection: 'column',
        children: items.map(([k, v]) => Text({ children: [k.padEnd(w) + '  ' + v] })),
      })
    }
    case 'Link':
      return Button({ key: 'link' + path, label: label || String(p.href), plain: true, onPress: () => run($, p.command) })
    case 'Button':
      return Button({
        key: 'btn-' + (p.command as string[]).join('-'),
        label: String(p.label),
        ...(p.hotkey ? { hotkey: String(p.hotkey) } : {}),
        plain: true,
        dimColor: Boolean(p.disabled),
        onPress: () => (p.disabled ? $.ui.toast(p.reason ?? 'Not available right now') : run($, p.command)),
      })
    case 'Input': {
      const submit = p.submit as { argv: string[]; template: string }
      // Not every surface has a text field (VS Code, mobile): say how to do it instead.
      if (!('Input' in els)) return Text({ dimColor: true, children: [`${p.label ?? p.param}: /shop ${submit.argv.join(' ')} …`] })
      return els.Input({
        key: 'input-' + p.param,
        label: String(p.label ?? p.param),
        placeholder: p.placeholder ? String(p.placeholder) : undefined,
        value: String(p.value ?? ''),
        submitLabel: submit.argv[0] === 'set' ? 'apply' : 'search',
        onSubmit: (value: string) => run($, [...submit.argv, submit.template.replace('{value}', value)]),
      })
    }
    case 'Tabs': {
      // A tab bar (each tab runs `tab <name>`), then the active tab's view.
      const tabs = p.tabs as Array<{ key: string; label: string; active: boolean; command: string[] }>
      return Box({
        flexDirection: 'column',
        children: [
          Box({
            flexDirection: 'row',
            columnGap: 2,
            children: tabs.map((t, i) =>
              Button({
                key: 'tab-' + t.key,
                label: t.label,
                hotkey: String(i + 1),
                plain: true,
                dimColor: !t.active,
                onPress: () => run($, t.command),
              }),
            ),
          }),
          ...kids(),
        ],
      })
    }
    case 'Table': {
      const cols = p.columns as Array<{ label: string; align: string }>
      const rows = p.rows as Array<{ cells: string[]; command?: string[]; disabled?: boolean }>
      if (!rows.length) return Text({ dimColor: true, children: [String(p.empty ?? 'Nothing here.')] })
      const widths = cols.map((c, i) => Math.max(c.label.length, ...rows.map((r) => (r.cells[i] ?? '').length)))
      while (widths.reduce((a, b) => a + b + 2, 4) > width && Math.max(...widths) > 6) widths[widths.indexOf(Math.max(...widths))]! -= 1
      const fit = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(0, n - 1)) + '…' : s)
      const line = (cells: string[]) =>
        cells.map((c, i) => (cols[i]!.align === 'right' ? fit(c, widths[i]!).padStart(widths[i]!) : fit(c, widths[i]!).padEnd(widths[i]!))).join('  ').trimEnd()
      return Box({
        flexDirection: 'column',
        children: [
          Text({ dimColor: true, children: ['    ' + line(cols.map((c) => c.label))] }),
          ...rows.map((r, i) =>
            r.command
              ? Button({
                  key: 'row-' + path + '-' + i,
                  label: String(i + 1).padStart(2) + '  ' + line(r.cells),
                  plain: true,
                  dimColor: Boolean(r.disabled),
                  onPress: () => run($, r.command!),
                })
              : Text({ children: ['    ' + line(r.cells)] }),
          ),
        ],
      })
    }
    default:
      return Box({ flexDirection: 'column', children: kids() })
  }
}

function frame($: EngineInterface, els: Elements, width: number): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { Box, Text, Button } = els
  if (!current?.screen) return Text({ dimColor: true, children: [message || 'Loading the bookshop…'] })
  const s = current.screen
  const body =
    s.status === 'ok' ? draw($, els, s.view, width, 'v')
    : s.status === 'not_found' ? Text({ children: ['Nothing at ' + s.href] })
    : Text({ color: 'error', children: ['Error: ' + (s.error ?? s.status)] })
  const children: any[] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Button({ key: 'nav-back', label: '←', plain: true, hotkey: 'b', onPress: () => run($, ['back']) }),
        Text({ dimColor: true, wrap: 'truncate-end', children: [s.href] }),
      ],
    }),
    body,
  ]
  for (const p of current.pending) {
    children.push(
      Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Text({ color: 'warning', wrap: 'truncate-end', children: ['⚑ #' + p.id + ' ' + p.actor + ' wants ' + p.action] }),
          Button({ key: 'approve-' + p.id, label: 'Approve', onPress: () => run($, ['approve', String(p.id)]) }),
          Button({ key: 'reject-' + p.id, label: 'Reject', onPress: () => run($, ['reject', String(p.id)]) }),
        ],
      }),
    )
  }
  if (feed.length)
    children.push(Box({ flexDirection: 'column', children: feed.map((e) => Text({ dimColor: true, wrap: 'truncate-end', children: ['· ' + describe(e)] })) }))
  if (message) children.push(Text({ children: [message] }))
  return Box({ flexDirection: 'column', rowGap: 1, children })
}

function contextLines(entries: Entry[], here: Envelope | undefined): string {
  const did = entries.map((e) =>
    e.kind === 'visit'
      ? `- opened ${e.page}${e.params && Object.keys(e.params).length ? ' ' + JSON.stringify(e.params) : ''}${e.note ? ' (' + e.note + ')' : ''}`
      : `- ${e.kind} ${e.action ?? ''}${e.note ? ' (' + e.note + ')' : ''}`,
  )
  const where = here?.screen ? `The user's bookshop pane now shows ${here.screen.href} (${here.screen.title}).` : ''
  return ['In the bookshop pane since your last turn, the user:', ...did, where, 'Use `bookshop --json peek user` to see their screen.']
    .filter(Boolean)
    .join('\n')
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'shop', description: 'Open the bookshop pane', argumentHint: '[command]', immediate: true })
    return next(e)
  })

  // `/shop` opens the pane; `/shop search dune` also runs that command as the user.
  on('command.run', { command: 'shop' }, async ($, e) => {
    opened = true
    const args = e.args.trim()
    if (args) await run($, args.split(/\s+/))
    else await refresh($)
    await $.ui.open({ id: PANE, title: 'Bookshop', focus: true })
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    return frame($, els, e.props.bodyColumns)
  })

  // Claude used the CLI: show what it changed.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    if (opened && /\bbookshop\b/.test(e.command)) await refresh($)
    return result
  }).catch(($, e, next) => next(e)) // an observer: if refreshing fails, the tool call is untouched

  // Tell Claude what the user did in the pane since its last turn.
  on('prompt.submit', async ($, e, next) => {
    if (!opened || e.command) return next(e)
    const env = await cli($, ['log', '--since', String(Math.max(0, contextFrom)), '--actor', 'user'])
    const entries = (env?.result as Entry[] | null) ?? []
    if (entries.length) contextFrom = entries[entries.length - 1]!.id
    if (!entries.length) return next(e)
    return next({ ...e, context: [...(e.context ?? []), contextLines(entries, current)] })
  }).catch(($, e, next) => next(e)) // never block a prompt because the CLI failed
}
