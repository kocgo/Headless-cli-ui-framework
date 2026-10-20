/**
 * The view layer: semantic primitives as React components. Each renders a
 * host element ('Page', 'Table', 'Button', …) that the framework's renderer
 * turns into plain data. Controls never hold callbacks: they name an intent
 * or a param of their page, and the engine binds them to CLI commands. The
 * same tree renders as terminal text, as JSON for the agent, and as Claude
 * Code elements in the pane.
 *
 * Routing components come straight from TanStack Router: <Outlet /> renders
 * the matched child route; <Link> renders a link with active state.
 */
import { createContext, createElement as h, useContext, type ReactNode } from 'react'
import { Outlet, useRouter, useRouterState } from '@tanstack/react-router'
import type { AnyPage } from './declare.js'

export interface ViewElement {
  type: string
  props: Record<string, unknown>
  children: ViewNode[]
}
export type ViewNode = string | ViewElement

/** A typed link to a page, made by `somePage.link(params)`. */
export interface Href {
  page: string
  href: string
  params: Record<string, unknown>
}

export type Tone = 'default' | 'dim' | 'bold' | 'success' | 'warning' | 'danger'

type WithChildren<P = object> = P & { children?: ReactNode }

/** The page whose view is rendering, so controls know whose intents they name. */
export const PageContext = createContext<AnyPage | null>(null)

// ── layout ──────────────────────────────────────────────────────────────────
export const Page = ({ children, ...p }: WithChildren<{ title?: string; subtitle?: string }>) => h('Page', p, children)
export const Section = ({ children, ...p }: WithChildren<{ title?: string }>) => h('Section', p, children)
export const Row = ({ children, ...p }: WithChildren<{ gap?: number }>) => h('Row', p, children)
export const Stack = ({ children, ...p }: WithChildren<{ gap?: number }>) => h('Stack', p, children)
export const Divider = () => h('Divider', {})

// ── content ─────────────────────────────────────────────────────────────────
export const Text = ({ children, ...p }: WithChildren<{ tone?: Tone }>) => h('Text', p, children)
export const Badge = ({ children, ...p }: WithChildren<{ tone?: Tone }>) => h('Badge', p, children)

export const KeyValue = ({ items }: { items: Record<string, string | number> | Array<[string, string | number]> }) =>
  h('KeyValue', { items: (Array.isArray(items) ? items : Object.entries(items)).map(([k, v]) => [k, String(v)]) })

export interface Column<R> {
  key: string
  label: string
  align: 'left' | 'right'
  format: (row: R) => string
}

/** A table column. `format` runs in the engine, so the tree stays plain data. */
export function col<R, K extends keyof R & string>(
  key: K,
  opts: { label?: string; align?: 'left' | 'right'; format?: (value: R[K], row: R) => string } = {},
): Column<R> {
  return {
    key,
    label: opts.label ?? key,
    align: opts.align ?? 'left',
    format: (row) => (opts.format ? opts.format(row[key], row) : String(row[key] ?? '')),
  }
}

export function Table<R>(p: {
  rows: readonly R[]
  columns: Column<R>[]
  /** Pressing a row runs this intent with the row number (1-based) as its first argument. */
  rowIntent?: string
  /** Or: each row links to a page. */
  rowLink?: (row: R) => Href
  empty?: string
}) {
  return h('Table', {
    columns: p.columns.map((c) => ({ key: c.key, label: c.label, align: c.align })),
    rows: p.rows.map((r) => ({ cells: p.columns.map((c) => c.format(r)), link: p.rowLink?.(r).href })),
    rowIntent: p.rowIntent,
    empty: p.empty,
  })
}

// ── controls (bound to intents, params and pages by name) ──────────────────
/** A link to a page made with `page.link(…)`. TanStack's own <Link> works too. */
export const Link = ({ to, children }: WithChildren<{ to: Href }>) => h('a', { href: to.href }, children)

export const Button = (p: { intent: string; label: string; args?: Array<string | number>; hotkey?: string }) =>
  h('Button', { ...p, args: p.args?.map(String) })

/** A text field. Submitting sets `param` on this page, or navigates to `page` with it. */
export const Input = (p: { param: string; label?: string; placeholder?: string; page?: { name: string }; value?: string }) =>
  h('Input', { param: p.param, label: p.label, placeholder: p.placeholder, page: p.page?.name, value: p.value })

/**
 * The page's tab bar, then the active tab (a TanStack <Outlet />).
 * Tabs are child routes declared with `page.tab(…)`; each is bound to `tab <name>`.
 */
export function Tabs() {
  const page = useContext(PageContext)
  const router = useRouter()
  const matched = useRouterState({ select: (s) => s.matches.map((m) => m.routeId) })
  const routes = router.routesById as Record<string, { options: { staticData?: { page?: AnyPage } } }>
  const tabs = (page?.tabs ?? []).map((t) => ({
    key: t.label.toLowerCase(),
    label: t.label,
    active: matched.some((id) => routes[id]?.options.staticData?.page === t),
  }))
  return h('Tabs', { tabs }, h(Outlet))
}

/** Marks the part of the tree a page rendered; transparent to every renderer. */
export const Scope = ({ page, children }: WithChildren<{ page: string }>) => h('Scope', { page }, children)

export { Outlet }

/** Walk a tree, depth first. */
export function walk(node: ViewNode, fn: (el: ViewElement) => void) {
  if (typeof node === 'string') return
  fn(node)
  node.children.forEach((c) => walk(c, fn))
}
