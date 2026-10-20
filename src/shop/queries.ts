import type { QueryClient } from '@tanstack/query-core'
import type { ActionLog } from '../core/log.js'
import type { Backend } from './backend.js'

export type BookSearch = { q?: string; genre?: string; sort: 'title' | 'price' | 'author'; page: number }

/** Query option factories, bound to the backend and log. Keys match action `invalidates`. */
export const createQueries = (api: Backend, log: ActionLog) => ({
  books: (s: BookSearch) => ({
    queryKey: ['books', 'list', s] as const,
    queryFn: async () => api.listBooks(s),
  }),
  genres: () => ({ queryKey: ['books', 'genres'] as const, queryFn: async () => api.genres() }),
  book: (id: string) => ({ queryKey: ['books', 'detail', id] as const, queryFn: async () => api.getBook(id) }),
  cart: () => ({ queryKey: ['cart'] as const, queryFn: async () => api.getCart() }),
  account: () => ({ queryKey: ['account'] as const, queryFn: async () => api.getAccount() }),
  orders: () => ({ queryKey: ['orders'] as const, queryFn: async () => api.listOrders() }),
  activity: (n: number) => ({ queryKey: ['log', n] as const, queryFn: async () => log.tail(n), staleTime: 0 }),
})

export type Queries = ReturnType<typeof createQueries>

export interface ShopContext {
  queryClient: QueryClient
  queries: Queries
}
