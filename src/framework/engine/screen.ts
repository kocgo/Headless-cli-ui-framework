/**
 * Resolve what an actor is looking at: the matched pages, their data (from
 * the query cache), their model, the composed view with every control bound
 * to a concrete CLI command, and the intents available right now.
 */
import type { QueryClient } from '@tanstack/query-core'
import { tabKey, type AnyPage, type IntentDef, type PageState } from '../declare.js'
import { defaultOf, keysOf, schemaJson } from '../schema.js'
import type { ViewElement, ViewNode } from '../view.js'
import { el, walk } from '../view.js'
import { queryKeyOf } from './compile.js'
import type { HeadlessRouter } from './router.js'

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
  states: Record<string, PageState<Record<string, unknown>, unknown, unknown, unknown>>
}

interface Resolved {
  page: AnyPage
  state: PageState<Record<string, unknown>, unknown, unknown, unknown>
}

export function intentUsage(name: string, intent: IntentDef<unknown, unknown, unknown>) {
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

/** Turn names in the view (intent="next", param="query", rowIntent="open") into commands. */
function bind(node: ViewNode, r: Resolved, intents: IntentInfo[]) {
  const find = (name: string) => {
    const i = intents.find((x) => x.name === name && x.page === r.page.name)
    if (!i) throw new Error(`page "${r.page.name}": the view uses intent "${name}", which the page does not declare`)
    return i
  }
  walk(node, (el: ViewElement) => {
    const p = el.props
    if (p.boundTo) return
    p.boundTo = r.page.name
    if (el.type === 'Button') {
      const i = find(p.intent as string)
      p.command = [i.name, ...((p.args as string[] | undefined) ?? [])]
      if (!i.available) [p.disabled, p.reason] = [true, i.reason]
    } else if (el.type === 'Link') {
      p.command = ['go', p.href]
    } else if (el.type === 'Input') {
      const param = p.param as string
      if (p.page) p.submit = { argv: [p.page, `--${param}`], template: '{value}' }
      else {
        if (!(param in (r.page.params.properties ?? {})))
          throw new Error(`page "${r.page.name}": Input binds param "${param}", which the page does not declare`)
        p.submit = { argv: ['set'], template: `${param}={value}` }
        p.value ??= r.state.params[param] === undefined ? '' : String(r.state.params[param])
      }
    } else if (el.type === 'Tabs') {
      const tabsIntent = find('tab')
      for (const t of p.tabs as Array<{ key: string; command?: string[]; disabled?: boolean }>) {
        t.command = ['tab', t.key]
        if (!tabsIntent.available) t.disabled = true
      }
    } else if (el.type === 'Table') {
      const rows = p.rows as Array<{ cells: string[]; link?: string; command?: string[]; disabled?: boolean }>
      const intent = p.rowIntent ? find(p.rowIntent as string) : undefined
      rows.forEach((row, n) => {
        if (intent) {
          row.command = [intent.name, String(n + 1)]
          if (!intent.available) row.disabled = true
        } else if (row.link) row.command = ['go', row.link]
      })
    }
  })
}

function collectControls(node: ViewNode): BoundControl[] {
  const out: BoundControl[] = []
  walk(node, (el) => {
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

export function resolveScreen(router: HeadlessRouter['router'], queryClient: QueryClient, ctx: unknown): Screen {
  const s = router.state
  const base = { href: s.location.href, params: {}, data: null, model: null, view: '', intents: [], controls: [], states: {} }
  if (s.status === 'pending' || s.isLoading) return { ...base, page: null, title: 'Loading…', status: 'pending' }

  const resolved: Resolved[] = []
  for (const m of s.matches) {
    const page = m.staticData?.page
    if (!page) continue
    if (m.status === 'notFound') return { ...base, page: page.name, title: 'Not found', status: 'not_found' }
    if (m.status === 'error') {
      const msg = (m.error as Error | undefined)?.message ?? 'unknown error'
      return { ...base, page: page.name, title: 'Error', status: 'error', error: msg }
    }
    const params = (page.kind === 'layout' ? {} : (m.loaderData as Record<string, unknown>)) ?? {}
    const data = page.def.data ? (queryClient.getQueryData(queryKeyOf(page, params)) ?? null) : null
    if (page.def.data && data === null) return { ...base, page: page.name, title: 'Not found', status: 'not_found' }
    // A child sees its parent's state; top-level pages and the layout see null.
    const parent = page.parent ? (resolved.findLast((r) => r.page === page.parent)?.state ?? null) : null
    try {
      const model = page.def.model?.({ params, data, parent }, ctx)
      resolved.push({ page, state: { params, data, model, parent } })
    } catch (e) {
      return { ...base, page: page.name, title: 'Error', status: 'error', error: `model: ${(e as Error).message}` }
    }
  }
  const leaf = resolved.findLast((r) => r.page.kind === 'page')
  if (!leaf) return { ...base, page: null, title: 'Not found', status: 'not_found' }

  // Intents: the page's own first, then its ancestors', then the layout's (available everywhere).
  const intents = [...resolved].reverse().flatMap(intentInfos)

  // Views compose leaf-first: each parent receives its child's view as `outlet`,
  // and, if it has tabs, a tab bar wrapping that outlet as `tabs`.
  let view: ViewNode = ''
  try {
    const order = [...resolved].reverse()
    order.forEach((r, i) => {
      const below = order[i - 1]?.page // the child rendered in this page's outlet
      const tabs: ViewNode = r.page.tabs.length
        ? el('Tabs', { tabs: r.page.tabs.map((t: AnyPage) => ({ key: tabKey(t), label: t.label, active: t === below })) }, view)
        : ''
      if (!r.page.def.view) return
      const node = r.page.def.view({ ...(r.state as PageState<never, never, never, never>), outlet: view, tabs })
      bind(node, r, intents)
      view = node
    })
  } catch (e) {
    return { ...base, page: leaf.page.name, title: 'Error', status: 'error', error: `view: ${(e as Error).message}` }
  }

  const t = leaf.page.def.title
  const title = typeof t === 'function' ? t(leaf.state as never) : (t ?? leaf.page.name)
  let summary: string | undefined
  try {
    summary = leaf.page.def.summary?.(leaf.state as never)
  } catch {
    summary = undefined
  }
  return {
    page: leaf.page.name,
    href: s.location.href,
    title,
    status: 'ok',
    params: leaf.state.params,
    data: leaf.state.data,
    model: leaf.state.model ?? null,
    summary,
    view,
    intents,
    controls: collectControls(view),
    states: Object.fromEntries(resolved.map((r) => [r.page.name, r.state])),
  }
}
