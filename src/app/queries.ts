// TanStack Query (query-core): framework-agnostic, same QueryClient API you use with React.
import { QueryClient } from '@tanstack/query-core'
import { getDataset, listDatasets } from './data.js'

export const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })

export const datasetsQuery = (q: string, page: number) => ({
  queryKey: ['datasets', 'list', { q, page }] as const,
  queryFn: () => listDatasets(q, page),
})

export const datasetQuery = (id: string) => ({
  queryKey: ['datasets', 'detail', id] as const,
  queryFn: () => getDataset(id),
})

export interface AppContext {
  queryClient: QueryClient
}
