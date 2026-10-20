/**
 * The declaration API: page, layout, action, actions.
 *
 * A page declares where it lives (path + params), what it fetches (data),
 * what it means (model), what you can do on it (intents) and how it looks
 * (view). The CLI command, URL, query, JSON output and log entry are all
 * derived from it.
 */
import type { Static, TObject } from '@sinclair/typebox'
import { EmptyObject, defaultOf, stringifyQuery } from './schema.js'
import type { Href, ViewElement, ViewNode } from './view.js'

// ── intents ────────────────────────────────────────────────────────────────
export interface PageState<Pr, D, M> {
  params: Pr
  data: D
  model: M
}

/** What `to` and `input` receive: the page state, the parsed args, and a link to this page. */
export type IntentState<Pr, D, M, A extends TObject> = PageState<Pr, D, M> & {
  args: Static<A>
  /** Link to this same page with other params: `link({ ...params, page: 2 })`. */
  link: (params?: Partial<Pr>) => Href
}

export interface IntentDef<Pr, D, M, A extends TObject = TObject> {
  description?: string
  /** Typed arguments. Their order is the positional order on the CLI. */
  args?: A
  /** Is this intent available right now? A string explains why not. */
  when?: (s: PageState<Pr, D, M>) => boolean | string
  /** Navigate: return a link to another page (or this one with new params). */
  to?: (s: IntentState<Pr, D, M, A>) => Href
  /** Or write: run this action. */
  do?: AnyAction
  /** Input for the action; defaults to the intent's args. */
  input?: (s: IntentState<Pr, D, M, A>) => unknown
}

// ── pages ──────────────────────────────────────────────────────────────────
export interface PageDef<Ctx, P extends TObject, D, M, I extends Record<string, unknown>> {
  path: string
  description?: string
  /** Path params (`$id`) and search params together. */
  params?: P
  /** Params that can be given without a flag, in order: `book 3` → { id: '3' }. */
  positional?: (keyof Static<P> & string)[]
  title?: string | ((s: PageState<Static<P>, NonNullable<D>, M>) => string)
  /** Fetch. Cached by TanStack Query under [page name, params]. Return null for "not found". */
  data?: (params: Static<P>, ctx: Ctx) => D | Promise<D>
  /** Business logic over the fetched data. Pure; part of the JSON output. */
  model?: (s: { params: Static<P>; data: NonNullable<D> }, ctx: Ctx) => M
  /** Refetch whenever anyone writes to the activity log (e.g. a page showing the log). */
  refreshOnActivity?: boolean
  /** One line for the activity log: what visiting this page found. */
  summary?: (s: PageState<Static<P>, NonNullable<D>, M>) => string
  intents?: { [K in keyof I]: IntentDef<Static<P>, NonNullable<D>, M, I[K] extends TObject ? I[K] : TObject<{}>> } // eslint-disable-line @typescript-eslint/no-empty-object-type
  view?: (s: PageState<Static<P>, NonNullable<D>, M> & { outlet: ViewNode }) => ViewElement
}

export interface Page<Ctx = any, P extends TObject = TObject, D = any, M = any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  kind: 'page' | 'layout'
  name: string
  path: string
  params: P
  pathKeys: string[]
  def: PageDef<Ctx, P, D, M, Record<string, TObject>>
  /** A typed link to this page. Params left out take their defaults. */
  link(params?: Partial<Static<P>>): Href
}
export type AnyPage = Page<any, any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function makePage<Ctx, P extends TObject, D, M, I extends Record<string, unknown>>(
  kind: 'page' | 'layout',
  name: string,
  def: PageDef<Ctx, P, D, M, I>,
): Page<Ctx, P, D, M> {
  const params = (def.params ?? EmptyObject) as P
  const pathKeys = [...def.path.matchAll(/\$([A-Za-z0-9_]+)/g)].map((m) => m[1]!)
  return {
    kind,
    name,
    path: def.path,
    params,
    pathKeys,
    def: def as unknown as PageDef<Ctx, P, D, M, Record<string, TObject>>,
    link(p = {}) {
      const given = p as Record<string, unknown>
      for (const k of pathKeys) if (given[k] === undefined) throw new Error(`${name}.link: missing path param "${k}"`)
      const pathname = def.path.replace(/\$([A-Za-z0-9_]+)/g, (_, k: string) => encodeURIComponent(String(given[k])))
      const search: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(given)) {
        if (pathKeys.includes(k) || v === undefined) continue
        if (v === defaultOf(params, k)) continue // keep URLs short: defaults are implied
        search[k] = v
      }
      return { page: name, href: pathname + stringifyQuery(search), params: given }
    },
  }
}

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
    page<P extends TObject = TObject<{}>, D = null, M = undefined, I extends Record<string, unknown> = {}>( // eslint-disable-line @typescript-eslint/no-empty-object-type
      name: string,
      def: PageDef<Ctx, P, D, M, I>,
    ) {
      return makePage('page', name, def)
    },
    /** A layout wraps every page; its view receives the page's view as `outlet`. */
    layout<D = null, M = undefined, I extends Record<string, unknown> = {}>( // eslint-disable-line @typescript-eslint/no-empty-object-type
      name: string,
      def: Omit<PageDef<Ctx, TObject<{}>, D, M, I>, 'path' | 'params' | 'positional'>,
    ) {
      return makePage('layout', name, { ...def, path: '' } as PageDef<Ctx, TObject<{}>, D, M, I>)
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
