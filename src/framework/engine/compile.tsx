/**
 * Compile declared pages into @tanstack/react-router routes:
 *   path / parent → createRoute + getParentRoute (real nesting, real <Outlet />)
 *   params        → validateSearch (search part) + path params
 *   data          → loader, through the TanStack Query cache under [page, params]
 *   view          → the route's component, given the page's computed state
 *   the page      → staticData, for screen resolution
 */
import { createElement as h } from 'react'
import { Outlet, createRootRoute, createRoute, notFound, stripSearchParams, useRouter, useRouterState, type AnyRoute } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/query-core'
import { Type, type TObject } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import type { App } from '../app.js'
import type { AnyPage } from '../declare.js'
import { parseInput, parseSearch } from '../schema.js'
import { PageContext, Scope, Text } from '../view.js'
import { resolvePages } from './states.js'

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

/** Keep only the keys a page declares: a parent's data is cached once for all its children. */
export const pickParams = (page: AnyPage, all: Record<string, unknown>) =>
  Object.fromEntries(Object.keys(page.params.properties ?? {}).filter((k) => all[k] !== undefined).map((k) => [k, all[k]]))

/** The route component for a page: its view, called with its state, scoped for binding. */
function pageComponent(page: AnyPage) {
  function PageRoute() {
    const router = useRouter()
    // Re-render when matches, their data, or the router's status change (pending → idle).
    useRouterState({ select: (s) => s.matches })
    useRouterState({ select: (s) => s.status })
    useRouterState({ select: (s) => s.isLoading })
    const { queryClient, ctx } = router.options.context as RouterContext
    const r = resolvePages(router, queryClient, ctx)
    const state = r.kind === 'ok' ? r.resolved.find((x) => x.page === page)?.state : undefined
    // Mid-transition React may re-render a page that is no longer matched: render nothing.
    if (!state) return null
    if (!page.def.view) return h(Outlet)
    return h(PageContext.Provider, { value: page }, h(Scope, { page: page.name }, page.def.view(state as never)))
  }
  PageRoute.displayName = `Page(${page.name})`
  return PageRoute
}

export function compileRouteTree(app: App) {
  // A factory: every router (an actor's cursor, a `peek`) gets fresh route instances.
  return () => {
    const shell = app.shell
    const root = createRootRoute({
      loader: async ({ context }) => {
        if (shell?.def.data) await ensurePageData(context as RouterContext, shell, {})
      },
      component: shell ? pageComponent(shell) : () => h(Outlet),
      notFoundComponent: () => h(Text, null, 'Not found'),
      errorComponent: ({ error }: { error: unknown }) => h(Text, { tone: 'danger' }, `Error: ${(error as Error)?.message ?? error}`),
      staticData: { page: shell },
    })

    const build = (page: AnyPage, parentRoute: AnyRoute): AnyRoute => {
      const ownSearch = Type.Omit(page.ownParams, page.pathKeys) as unknown as TObject
      const route = createRoute({
        getParentRoute: () => parentRoute,
        path: page.relPath,
        validateSearch: (raw: Record<string, unknown>) => parseSearch(ownSearch, raw),
        // Keep URLs short: values equal to their schema default are implied, not written.
        search: { middlewares: [stripSearchParams(Value.Default(ownSearch, {}) as Record<string, unknown>)] },
        loaderDeps: ({ search }: { search: Record<string, unknown> }) => search,
        loader: async ({ context, params, deps }: { context: unknown; params: Record<string, string>; deps: Record<string, unknown> }) => {
          const all = parseInput(page.params, { ...deps, ...params }, 'params') as Record<string, unknown>
          const mine = pickParams(page, all)
          if (page.def.data && (await ensurePageData(context as RouterContext, page, mine)) === null) throw notFound()
          return mine
        },
        component: pageComponent(page),
        staticData: { page },
      } as never) as AnyRoute
      return page.children.length ? route.addChildren(page.children.map((c) => build(c, route))) : route
    }
    return root.addChildren(app.pages.filter((p) => !p.parent).map((p) => build(p, root)))
  }
}
