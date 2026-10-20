/**
 * Compile declared pages into a TanStack Router route tree:
 *   params  → validateSearch (search part) + path params
 *   data    → loader, through the TanStack Query cache under [page, params]
 *   the page itself → staticData, for screen resolution
 */
import { BaseRootRoute, BaseRoute, notFound, stripSearchParams } from '@tanstack/router-core'
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
    const routes = app.pages.map(
      (page) =>
        new BaseRoute({
          getParentRoute: () => root,
          path: page.path,
          validateSearch: (raw: Record<string, unknown>) => parseSearch(searchSchemaOf(page), raw),
          // Keep URLs short: values equal to their schema default are implied, not written.
          search: { middlewares: [stripSearchParams(Value.Default(searchSchemaOf(page), {}) as Record<string, unknown>)] },
          loaderDeps: ({ search }) => search as Record<string, unknown>,
          loader: async ({ context, params, deps }) => {
            const full = parseInput(page.params, { ...deps, ...(params as object) }, 'params') as Record<string, unknown>
            if (page.def.data && (await ensurePageData(context as RouterContext, page, full)) === null) throw notFound()
            return full
          },
          staticData: { page },
        }),
    )
    return root.addChildren(routes)
  }
}
