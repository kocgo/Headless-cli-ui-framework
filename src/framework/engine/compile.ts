/**
 * Compile declared pages into a TanStack Router route tree:
 *   params  → validateSearch (search part) + path params
 *   data    → loader, through the TanStack Query cache under [page, params]
 *   the page itself → staticData, for screen resolution
 */
import { BaseRootRoute, BaseRoute, notFound, stripSearchParams, type AnyRoute } from '@tanstack/router-core'
import type { QueryClient } from '@tanstack/query-core'
import { Type, type TObject } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import type { App } from '../app.js'
import type { AnyPage } from '../declare.js'
import { parseInput, parseSearch } from '../schema.js'

declare module '@tanstack/router-core' {
  interface StaticDataRouteOption {
    page?: AnyPage
  }
}

export interface RouterContext {
  queryClient: QueryClient
  ctx: unknown
}

export const queryKeyOf = (page: AnyPage, params: Record<string, unknown>) => [page.name, params] as const

export function ensurePageData(rc: RouterContext, page: AnyPage, params: Record<string, unknown>) {
  return rc.queryClient.ensureQueryData({
    queryKey: queryKeyOf(page, params),
    // Query refuses `undefined`; a page's data of null/undefined means "not found".
    queryFn: async () => (await page.def.data!(params, rc.ctx)) ?? null,
  })
}

export const searchSchemaOf = (page: AnyPage): TObject =>
  page.pathKeys.length ? (Type.Omit(page.params, page.pathKeys) as unknown as TObject) : page.params

/** Keep only the keys a page declares: a parent's data is cached once for all its children. */
export const pickParams = (page: AnyPage, all: Record<string, unknown>) =>
  Object.fromEntries(Object.keys(page.params.properties ?? {}).filter((k) => all[k] !== undefined).map((k) => [k, all[k]]))

export function compileRouteTree(app: App) {
  // A factory: every router (an actor's cursor, a `peek`) gets fresh route instances.
  return () => {
    const shell = app.shell
    const root = new BaseRootRoute({
      loader: async ({ context }) => {
        if (shell?.def.data) await ensurePageData(context as RouterContext, shell, {})
      },
      staticData: { page: shell },
    })

    // Each page becomes a route under its parent's route; a child's path is relative.
    const build = (page: AnyPage, parentRoute: AnyRoute): AnyRoute => {
      const ownSearch = page.ownParams.properties ? (Type.Omit(page.ownParams, page.pathKeys) as unknown as TObject) : page.ownParams
      const route = new BaseRoute({
        getParentRoute: () => parentRoute,
        path: page.relPath,
        validateSearch: (raw: Record<string, unknown>) => parseSearch(ownSearch, raw),
        // Keep URLs short: values equal to their schema default are implied, not written.
        search: { middlewares: [stripSearchParams(Value.Default(ownSearch, {}) as Record<string, unknown>)] },
        loaderDeps: ({ search }) => search as Record<string, unknown>,
        loader: async ({ context, params, deps }) => {
          const all = parseInput(page.params, { ...deps, ...(params as object) }, 'params') as Record<string, unknown>
          const mine = pickParams(page, all)
          if (page.def.data && (await ensurePageData(context as RouterContext, page, mine)) === null) throw notFound()
          return mine
        },
        staticData: { page },
      })
      return page.children.length ? route.addChildren(page.children.map((c) => build(c, route))) : route
    }
    return root.addChildren(app.pages.filter((p) => !p.parent).map((p) => build(p, root)))
  }
}
