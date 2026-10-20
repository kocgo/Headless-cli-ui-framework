/**
 * Resolve what an actor is looking at: the matched pages and their state,
 * the rendered view (React → plain tree) with every control bound to a
 * concrete CLI command, and the intents available right now.
 */
import type { QueryClient } from '@tanstack/query-core'
import type { AnyRouter } from '@tanstack/react-router'
import type { AnyPage, IntentDef } from '../declare.js'
import { defaultOf, keysOf, schemaJson } from '../schema.js'
import type { ViewElement, ViewNode } from '../view.js'
import { walk } from '../view.js'
import { resolvePages, type Resolved, type State } from './states.js'

export interface IntentInfo {
  name: string
  page: string
  usage: string
  description?: string
  kind: 'navigate' | 'action'
  action?: string
  args?: unknown
  available: boolean
  reason?: string
}

export interface BoundControl {
  kind: 'link' | 'button' | 'input' | 'row' | 'tab'
  label: string
  /** The exact CLI argv that performs it (without the binary). */
  command?: string[]
  /** Inputs: the argv prefix, and how the typed value is appended. */
  submit?: { argv: string[]; template: string }
  disabled?: boolean
  reason?: string
}

export interface Screen {
  page: string | null
  href: string
  title: string
  status: 'ok' | 'not_found' | 'error' | 'pending'
  error?: string
  params: Record<string, unknown>
  data: unknown
  model: unknown
  summary?: string
  view: ViewNode
  intents: IntentInfo[]
  controls: BoundControl[]
  /** Internal: every matched page's state, for running an ancestor's intent. */
  states: Record<string, State>
}

export function intentUsage(name: string, intent: IntentDef<unknown, unknown, unknown, unknown>) {
  const required = new Set(intent.args?.required ?? [])
  const needed = (k: string) => required.has(k) && defaultOf(intent.args!, k) === undefined
  return [name, ...keysOf(intent.args).map((k) => (needed(k) ? `<${k}>` : `[${k}]`))].join(' ')
}

function intentInfos(r: Resolved): IntentInfo[] {
  return Object.entries(r.page.def.intents ?? {}).map(([name, intent]) => {
    let available = true
    let reason: string | undefined
    try {
      const w = intent.when?.(r.state as never)
      if (w === false) available = false
      else if (typeof w === 'string') [available, reason] = [false, w]
    } catch (e) {
      ;[available, reason] = [false, (e as Error).message]
    }
    return {
      name,
      page: r.page.name,
      usage: intentUsage(name, intent),
      description: intent.description,
      kind: intent.do ? 'action' : 'navigate',
      action: intent.do?.name,
      args: schemaJson(intent.args),
      available,
      reason,
    }
  })
}

/**
 * Turn names in the view into commands. Each page's view is wrapped in a
 * Scope, so a control names the intents and params of the page that drew it.
 */
function bind(node: ViewNode, scope: AnyPage | undefined, pages: Map<string, Resolved>, intents: IntentInfo[]) {
  if (typeof node === 'string') return
  if (node.type === 'Scope') {
    const r = pages.get(node.props.page as string)
    node.children.forEach((c) => bind(c, r?.page ?? scope, pages, intents))
    return
  }
  const p = node.props
  const owner = scope?.name ?? '(none)'
  const find = (name: string) => {
    const i = intents.find((x) => x.name === name && x.page === owner)
    if (!i) throw new Error(`page "${owner}": the view uses intent "${name}", which the page does not declare`)
    return i
  }
  if (node.type === 'Button') {
    const i = find(p.intent as string)
    p.command = [i.name, ...((p.args as string[] | undefined) ?? [])]
    if (!i.available) [p.disabled, p.reason] = [true, i.reason]
  } else if (node.type === 'Link') {
    p.command = ['go', p.href]
  } else if (node.type === 'Input') {
    const param = p.param as string
    if (p.page) p.submit = { argv: [p.page, `--${param}`], template: '{value}' }
    else {
      if (!scope || !(param in (scope.params.properties ?? {})))
        throw new Error(`page "${owner}": Input binds param "${param}", which the page does not declare`)
      p.submit = { argv: ['set'], template: `${param}={value}` }
      const current = pages.get(scope.name)?.state.params[param]
      p.value ??= current === undefined ? '' : String(current)
    }
  } else if (node.type === 'Tabs') {
    const tabsIntent = find('tab')
    for (const t of p.tabs as Array<{ key: string; command?: string[]; disabled?: boolean }>) {
      t.command = ['tab', t.key]
      if (!tabsIntent.available) t.disabled = true
    }
  } else if (node.type === 'Table') {
    const rows = p.rows as Array<{ cells: string[]; link?: string; command?: string[]; disabled?: boolean }>
    const intent = p.rowIntent ? find(p.rowIntent as string) : undefined
    rows.forEach((row, n) => {
      if (intent) {
        row.command = [intent.name, String(n + 1)]
        if (!intent.available) row.disabled = true
      } else if (row.link) row.command = ['go', row.link]
    })
  }
  node.children.forEach((c) => bind(c, scope, pages, intents))
}

function collectControls(node: ViewNode): BoundControl[] {
  const out: BoundControl[] = []
  walk(node, (el: ViewElement) => {
    const p = el.props
    const text = el.children.filter((c): c is string => typeof c === 'string').join('')
    if (el.type === 'Button')
      out.push({ kind: 'button', label: p.label as string, command: p.command as string[], disabled: p.disabled as boolean | undefined, reason: p.reason as string | undefined })
    else if (el.type === 'Link') out.push({ kind: 'link', label: text, command: p.command as string[] })
    else if (el.type === 'Input') out.push({ kind: 'input', label: (p.label as string) ?? (p.param as string), submit: p.submit as BoundControl['submit'] })
    else if (el.type === 'Tabs')
      for (const t of p.tabs as Array<{ label: string; command: string[]; active: boolean }>)
        out.push({ kind: 'tab', label: t.label + (t.active ? ' (active)' : ''), command: t.command })
    else if (el.type === 'Table')
      for (const row of p.rows as Array<{ cells: string[]; command?: string[]; disabled?: boolean }>)
        if (row.command) out.push({ kind: 'row', label: row.cells.join(' · '), command: row.command, disabled: row.disabled })
  })
  return out
}

export function resolveScreen(router: AnyRouter, tree: ViewNode, queryClient: QueryClient, ctx: unknown): Screen {
  const href = router.state.location.href
  const base = { href, params: {}, data: null, model: null, view: '', intents: [], controls: [], states: {} }
  const r = resolvePages(router, queryClient, ctx)
  if (r.kind === 'pending') return { ...base, page: null, title: 'Loading…', status: 'pending' }
  if (r.kind === 'not_found') return { ...base, page: r.page ?? null, title: 'Not found', status: 'not_found' }
  if (r.kind === 'error') return { ...base, page: r.page ?? null, title: 'Error', status: 'error', error: r.message }

  const resolved = r.resolved
  const leaf = resolved.findLast((x) => x.page.kind === 'page')!
  // Intents: the page's own first, then its ancestors', then the layout's (available everywhere).
  const intents = [...resolved].reverse().flatMap(intentInfos)

  // The view is what React rendered; a deep clone, because binding writes into it.
  const view = JSON.parse(JSON.stringify(tree)) as ViewNode
  try {
    bind(view, undefined, new Map(resolved.map((x) => [x.page.name, x])), intents)
  } catch (e) {
    return { ...base, page: leaf.page.name, title: 'Error', status: 'error', error: `view: ${(e as Error).message}` }
  }

  // A tab or child without its own title/summary uses its nearest ancestor's.
  const chain = resolved.filter((x) => x.page.kind === 'page').reverse()
  const titled = chain.find((x) => x.page.def.title !== undefined)
  const t = titled?.page.def.title
  const title = typeof t === 'function' ? t(titled!.state as never) : (t ?? leaf.page.name)
  let summary: string | undefined
  try {
    const summed = chain.find((x) => x.page.def.summary)
    summary = summed?.page.def.summary?.(summed.state as never)
  } catch {
    summary = undefined
  }
  return {
    page: leaf.page.name,
    href,
    title,
    status: 'ok',
    params: leaf.state.params,
    data: leaf.state.data,
    model: leaf.state.model ?? null,
    summary,
    view,
    intents,
    controls: collectControls(view),
    states: Object.fromEntries(resolved.map((x) => [x.page.name, x.state])),
  }
}
