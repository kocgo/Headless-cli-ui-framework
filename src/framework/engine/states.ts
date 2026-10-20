/**
 * The state of every matched page: params (from the loader), data (from the
 * query cache, so invalidations show up), model, and the parent's state.
 * Shared by the page components (React) and screen resolution (JSON/CLI).
 */
import type { QueryClient } from '@tanstack/query-core'
import type { AnyRouter } from '@tanstack/react-router'
import type { AnyPage, PageState } from '../declare.js'
import { queryKeyOf } from './compile.js'

export type State = PageState<Record<string, unknown>, unknown, unknown, unknown>

export interface Resolved {
  page: AnyPage
  state: State
}

export type Resolution =
  | { kind: 'ok'; resolved: Resolved[] }
  | { kind: 'pending' }
  | { kind: 'not_found'; page?: string }
  | { kind: 'error'; page?: string; message: string }

export function resolvePages(router: AnyRouter, queryClient: QueryClient, ctx: unknown): Resolution {
  const s = router.state
  if (s.status === 'pending' || s.isLoading) return { kind: 'pending' }
  const resolved: Resolved[] = []
  for (const m of s.matches) {
    const page = (router.routesById as Record<string, { options: { staticData?: { page?: AnyPage } } }>)[m.routeId]?.options.staticData?.page
    if (!page) continue
    if (m.status === 'notFound') return { kind: 'not_found', page: page.name }
    if (m.status === 'error') return { kind: 'error', page: page.name, message: (m.error as Error | undefined)?.message ?? 'unknown error' }
    if (m.status === 'pending') return { kind: 'pending' }
    const params = (page.kind === 'layout' ? {} : (m.loaderData as Record<string, unknown> | undefined)) ?? {}
    const data = page.def.data ? (queryClient.getQueryData(queryKeyOf(page, params)) ?? null) : null
    if (page.def.data && data === null) return { kind: 'not_found', page: page.name }
    const parent = page.parent ? (resolved.findLast((r) => r.page === page.parent)?.state ?? null) : null
    try {
      const model = page.def.model?.({ params, data, parent }, ctx)
      resolved.push({ page, state: { params, data, model, parent } })
    } catch (e) {
      return { kind: 'error', page: page.name, message: `model: ${(e as Error).message}` }
    }
  }
  if (!resolved.some((r) => r.page.kind === 'page')) return { kind: 'not_found' }
  return { kind: 'ok', resolved }
}
