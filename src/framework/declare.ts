/**
 * The declaration API: page, layout, child, tab, action, actions.
 *
 * A page declares where it lives (path + params), what it fetches (data),
 * what it means (model), what you can do on it (intents) and how it looks
 * (view). The CLI command, URL, query, JSON output and log entry are all
 * derived from it.
 *
 * Pages nest: `shelf.child('book', { path: '$slug', … })` is a route under
 * `/books/$genre`, rendered into the shelf's `{outlet}`. `book.tab('reviews', …)`
 * is a child that also appears in the parent's `{tabs}` bar. Children inherit
 * the parent's params and see its state as `parent`.
 */
import { Type, type Static, type TObject, type TProperties } from '@sinclair/typebox'
import { EmptyObject, defaultOf, stringifyQuery } from './schema.js'
import type { Href, ViewElement, ViewNode } from './view.js'

// ── state passed to every function of a page ───────────────────────────────
export interface PageState<Pr, D, M, Par = null> {
  params: Pr
  data: D
  model: M
  /** The parent page's state (children only). */
  parent: Par
}

/** What `to` and `input` receive: the page state, the parsed args, and a link to this page. */
export type IntentState<Pr, D, M, Par, A extends TObject> = PageState<Pr, D, M, Par> & {
  args: Static<A>
  /** Link to this same page with other params: `link({ ...params, page: 2 })`. */
  link: (params?: Partial<Pr>) => Href
}

export interface IntentDef<Pr, D, M, Par = null, A extends TObject = TObject> {
  description?: string
  /** Typed arguments. Their order is the positional order on the CLI. */
  args?: A
  /** Is this intent available right now? A string explains why not. */
  when?: (s: PageState<Pr, D, M, Par>) => boolean | string
  /** Navigate: return a link to another page (or this one with new params). */
  to?: (s: IntentState<Pr, D, M, Par, A>) => Href
  /** Or write: run this action. */
  do?: AnyAction
  /** Input for the action; defaults to the intent's args. */
  input?: (s: IntentState<Pr, D, M, Par, A>) => unknown
}

// ── pages ──────────────────────────────────────────────────────────────────
type NoArgs = TObject<{}> // eslint-disable-line @typescript-eslint/no-empty-object-type

export interface PageDef<Ctx, P extends TObject, D, M, I extends Record<string, unknown>, Par = null> {
  path: string
  description?: string
  /** Path params (`$id`) and search params together. */
  params?: P
  /** Params that can be given without a flag, in order: `book 3` → { id: '3' }. */
  positional?: (keyof Static<P> & string)[]
  title?: string | ((s: PageState<Static<P>, NonNullable<D>, M, Par>) => string)
  /** Fetch. Cached by TanStack Query under [page name, params]. Return null for "not found". */
  data?: (params: Static<P>, ctx: Ctx) => D | Promise<D>
  /** Business logic over the fetched data. Pure; part of the JSON output. */
  model?: (s: { params: Static<P>; data: NonNullable<D>; parent: Par }, ctx: Ctx) => M
  /** Refetch whenever anyone writes to the activity log (e.g. a page showing the log). */
  refreshOnActivity?: boolean
  /** One line for the activity log: what visiting this page found. */
  summary?: (s: PageState<Static<P>, NonNullable<D>, M, Par>) => string
  intents?: { [K in keyof I]: IntentDef<Static<P>, NonNullable<D>, M, Par, I[K] extends TObject ? I[K] : NoArgs> }
  /**
   * `outlet`: the active child's view ('' when none).
   * `tabs`: the tab bar with the active tab's view under it ('' when the page has no tabs).
   */
  view?: (s: PageState<Static<P>, NonNullable<D>, M, Par> & { outlet: ViewNode; tabs: ViewNode }) => ViewElement
}

type Props<T> = T extends TObject<infer X> ? X : never
/** Parent params + child params, as one object schema type. */
export type Merged<A extends TObject, B extends TObject> = TObject<Props<A> & Props<B>>

export type ChildDef<Ctx, PP extends TObject, P extends TObject, D, M, I extends Record<string, unknown>, Par> =
  Omit<PageDef<Ctx, Merged<PP, P>, D, M, I, Par>, 'path' | 'params'> & {
    /** Relative to the parent: '$slug', 'reviews'. Omit for the index child. */
    path?: string
    /** The child's own params; the parent's are inherited. */
    params?: P
    /** Shown when the parent itself is the URL (`/books/5`). */
    index?: boolean
    /** Tab label; defaults to the name. */
    label?: string
  }

export interface Page<Ctx = any, P extends TObject = TObject, D = any, M = any, Par = any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  kind: 'page' | 'layout'
  name: string
  /** The full path: '/books/$genre/$slug'. */
  path: string
  /** The path relative to the parent ('$slug'), or the full path for a top-level page. */
  relPath: string
  /** All params: inherited and own. */
  params: P
  /** The params this page declares itself (its data is cached under these plus the parent's). */
  ownParams: TObject
  pathKeys: string[]
  parent?: AnyPage
  children: AnyPage[]
  tabs: AnyPage[]
  index: boolean
  label: string
  def: PageDef<Ctx, P, D, M, Record<string, TObject>, Par>
  /** A typed link to this page. Params left out take their defaults. */
  link(params?: Partial<Static<P>>): Href
  /** A nested page rendered into this page's `{outlet}`. */
  child<P2 extends TObject = NoArgs, D2 = null, M2 = undefined, I2 extends Record<string, unknown> = {}>( // eslint-disable-line @typescript-eslint/no-empty-object-type
    name: string,
    def: ChildDef<Ctx, P, P2, D2, M2, I2, PageState<Static<P>, NonNullable<D>, M, Par>>,
  ): Page<Ctx, Merged<P, P2>, D2, M2, PageState<Static<P>, NonNullable<D>, M, Par>>
  /** A child that also appears in this page's `{tabs}` bar, with a `tab <name>` intent. */
  tab<P2 extends TObject = NoArgs, D2 = null, M2 = undefined, I2 extends Record<string, unknown> = {}>( // eslint-disable-line @typescript-eslint/no-empty-object-type
    name: string,
    def: ChildDef<Ctx, P, P2, D2, M2, I2, PageState<Static<P>, NonNullable<D>, M, Par>>,
  ): Page<Ctx, Merged<P, P2>, D2, M2, PageState<Static<P>, NonNullable<D>, M, Par>>
}
export type AnyPage = Page<any, any, any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const joinPath = (a: string, b: string) => ('/' + [a, b].map((s) => s.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')).replace(/\/$/, '') || '/'

function makePage(
  kind: 'page' | 'layout',
  name: string,
  def: PageDef<any, TObject, any, any, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  parent?: AnyPage,
  extra: { index?: boolean; label?: string; ownParams?: TObject } = {},
): AnyPage {
  const ownParams = extra.ownParams ?? def.params ?? EmptyObject
  const params = parent ? Type.Object({ ...parent.params.properties, ...ownParams.properties } as TProperties) : ownParams
  const path = parent ? joinPath(parent.path, def.path) : def.path
  const pathKeys = [...path.matchAll(/\$([A-Za-z0-9_]+)/g)].map((m) => m[1]!)
  const self: AnyPage = {
    kind,
    name,
    path,
    relPath: def.path,
    params,
    ownParams,
    pathKeys,
    parent,
    children: [],
    tabs: [],
    index: Boolean(extra.index),
    label: extra.label ?? name.replace(/^.*[.-]/, '').replace(/^./, (c) => c.toUpperCase()),
    def,
    link(p = {}) {
      const given = p as Record<string, unknown>
      for (const k of pathKeys) if (given[k] === undefined) throw new Error(`${name}.link: missing path param "${k}"`)
      const pathname = path.replace(/\$([A-Za-z0-9_]+)/g, (_, k: string) => encodeURIComponent(String(given[k])))
      const search: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(given)) {
        if (pathKeys.includes(k) || v === undefined) continue
        if (v === defaultOf(params, k)) continue // keep URLs short: defaults are implied
        search[k] = v
      }
      return { page: name, href: pathname + stringifyQuery(search), params: given }
    },
    child(childName, childDef) {
      const { path: rel, params: own, index, label, ...rest } = childDef as ChildDef<any, any, any, any, any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      const c = makePage('page', childName, { ...rest, path: index ? '/' : (rel ?? childName) } as PageDef<any, TObject, any, any, any, any>, self, { // eslint-disable-line @typescript-eslint/no-explicit-any
        index,
        label,
        ownParams: own ?? EmptyObject,
      })
      self.children.push(c)
      return c as never
    },
    tab(childName, childDef) {
      const c = self.child(childName, childDef as never)
      self.tabs.push(c)
      addTabIntent(self)
      return c as never
    },
  }
  return self
}

/** Every page with tabs gets a `tab <name>` intent, so tabs are commands too. */
function addTabIntent(page: AnyPage) {
  const intents = (page.def.intents ??= {}) as Record<string, IntentDef<any, any, any, any, any>> // eslint-disable-line @typescript-eslint/no-explicit-any
  intents.tab = {
    description: `switch tab: ${page.tabs.map((t) => t.name.replace(/^.*[.-]/, '')).join(', ')}`,
    args: Type.Object({ name: Type.String({ description: page.tabs.map((t) => tabKey(t)).join(' | ') }) }),
    to: ({ params, args }) => {
      const t = page.tabs.find((x) => tabKey(x) === args.name || x.name === args.name)
      if (!t) throw new Error(`no tab "${args.name}"; tabs: ${page.tabs.map(tabKey).join(', ')}`)
      return t.link(params as never)
    },
  }
}
export const tabKey = (t: AnyPage) => t.label.toLowerCase()

// ── actions ────────────────────────────────────────────────────────────────
export interface ActionDef<Ctx, S extends TObject, R> {
  /** Set by `actions(namespace, …)`, e.g. "cart.add". */
  name: string
  description: string
  input: S
  /** Non-user actors can only propose it; the user approves. */
  requiresApproval?: boolean
  /** Return a reason to refuse. Runs before applying, before proposing, and again on approval. */
  precheck?: (input: Static<S>, ctx: Ctx) => string | void | undefined | Promise<string | void | undefined>
  run: (input: Static<S>, ctx: Ctx) => R | Promise<R>
  /**
   * Names of pages (or the layout) whose data this changes; their cached
   * queries refetch in every process. Names, not objects, so actions and
   * pages can reference each other without circular imports.
   */
  invalidates?: string[] | ((input: Static<S>, result: R) => string[])
  /** One line for the activity log. */
  summary?: (input: Static<S>, result: R) => string
}
export type AnyAction = ActionDef<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Bind the declaration helpers to your app's context type once:
 *   export const { page, layout, action, actions } = declare<ShopContext>()
 */
export function declare<Ctx>() {
  return {
    page<P extends TObject = NoArgs, D = null, M = undefined, I extends Record<string, unknown> = {}>( // eslint-disable-line @typescript-eslint/no-empty-object-type
      name: string,
      def: PageDef<Ctx, P, D, M, I>,
    ): Page<Ctx, P, D, M, null> {
      return makePage('page', name, def as never)
    },
    /** A layout wraps every page; its view receives the page's view as `outlet`. */
    layout<D = null, M = undefined, I extends Record<string, unknown> = {}>( // eslint-disable-line @typescript-eslint/no-empty-object-type
      name: string,
      def: Omit<PageDef<Ctx, NoArgs, D, M, I>, 'path' | 'params' | 'positional'>,
    ): Page<Ctx, NoArgs, D, M, null> {
      return makePage('layout', name, { ...def, path: '' } as never)
    },
    action<S extends TObject, R>(def: Omit<ActionDef<Ctx, S, R>, 'name'>): ActionDef<Ctx, S, R> {
      return { ...def, name: '' }
    },
    /** Group actions under a namespace: actions('cart', { add }) → "cart.add". */
    actions<T extends Record<string, AnyAction>>(namespace: string, defs: T): T {
      for (const [k, a] of Object.entries(defs)) a.name = `${namespace}.${k}`
      return defs
    },
  }
}

/** A page and all its descendants, parents first. */
export const withDescendants = (p: AnyPage): AnyPage[] => [p, ...p.children.flatMap(withDescendants)]

/** The page's ancestors, root first (not including the page). */
export function ancestors(p: AnyPage): AnyPage[] {
  const out: AnyPage[] = []
  for (let a = p.parent; a; a = a.parent) out.unshift(a)
  return out
}
