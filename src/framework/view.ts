/**
 * The view layer: a small set of semantic primitives that build a plain,
 * serialisable tree. Controls never hold callbacks; they name an intent or a
 * param of their page, and the engine binds them to CLI commands. The same
 * tree then renders as terminal text, as JSON for the agent, and as mod
 * elements in the Claude Code pane.
 */

export interface ViewElement {
  type: string
  props: Record<string, unknown>
  children: ViewNode[]
}
export type ViewNode = string | ViewElement

export type Child = ViewNode | Child[] | number | boolean | null | undefined

/** A typed link to a page, made by `somePage.link(params)`. */
export interface Href {
  page: string
  href: string
  params: Record<string, unknown>
}

export type Tone = 'default' | 'dim' | 'bold' | 'success' | 'warning' | 'danger'

export function flatten(children: Child): ViewNode[] {
  if (children === null || children === undefined || typeof children === 'boolean') return []
  if (Array.isArray(children)) return children.flatMap(flatten)
  if (typeof children === 'number') return [String(children)]
  if (typeof children !== 'string' && children.type === 'Fragment') return children.children
  return [children]
}

export function el(type: string, props: Record<string, unknown>, children?: Child): ViewElement {
  return { type, props, children: flatten(children) }
}

type WithChildren<P = object> = P & { children?: Child }

// ── layout ──────────────────────────────────────────────────────────────────
export const Page = ({ children, ...p }: WithChildren<{ title?: string; subtitle?: string }>) => el('Page', p, children)
export const Section = ({ children, ...p }: WithChildren<{ title?: string }>) => el('Section', p, children)
export const Row = ({ children, ...p }: WithChildren<{ gap?: number }>) => el('Row', p, children)
export const Stack = ({ children, ...p }: WithChildren<{ gap?: number }>) => el('Stack', p, children)
export const Divider = () => el('Divider', {})

// ── content ─────────────────────────────────────────────────────────────────
export const Text = ({ children, ...p }: WithChildren<{ tone?: Tone }>) =>
  el('Text', p, [flatten(children).filter((c): c is string => typeof c === 'string').join('')])
export const Badge = ({ children, ...p }: WithChildren<{ tone?: Tone }>) =>
  el('Badge', p, [flatten(children).filter((c): c is string => typeof c === 'string').join('')])

export const KeyValue = ({ items }: { items: Record<string, string | number> | Array<[string, string | number]> }) =>
  el('KeyValue', { items: (Array.isArray(items) ? items : Object.entries(items)).map(([k, v]) => [k, String(v)]) })

export interface Column<R> {
  key: string
  label: string
  align: 'left' | 'right'
  format: (row: R) => string
}

/** A table column. `format` runs now, in the engine, so the tree stays plain data. */
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
  return el('Table', {
    columns: p.columns.map((c) => ({ key: c.key, label: c.label, align: c.align })),
    rows: p.rows.map((r) => ({ cells: p.columns.map((c) => c.format(r)), link: p.rowLink?.(r).href })),
    rowIntent: p.rowIntent,
    empty: p.empty,
  })
}

// ── controls (bound to intents, params and pages by name) ──────────────────
export const Link = ({ to, children }: WithChildren<{ to: Href }>) =>
  el('Link', { href: to.href, page: to.page }, children)

export const Button = (p: { intent: string; label: string; args?: Array<string | number>; hotkey?: string }) =>
  el('Button', { ...p, args: p.args?.map(String) })

/** A text field. Submitting sets `param` on this page, or navigates to `page` with it. */
export const Input = (p: { param: string; label?: string; placeholder?: string; page?: { name: string }; value?: string }) =>
  el('Input', { param: p.param, label: p.label, placeholder: p.placeholder, page: p.page?.name, value: p.value })

export const Fragment = ({ children }: WithChildren) => el('Fragment', {}, children)

/** Walk a tree, depth first. */
export function walk(node: ViewNode, fn: (el: ViewElement) => void) {
  if (typeof node === 'string') return
  fn(node)
  node.children.forEach((c) => walk(c, fn))
}
