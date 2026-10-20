import { BaseRootRoute, BaseRoute, notFound } from '@tanstack/router-core'
import { Type } from '@sinclair/typebox'
import type { QueryClient } from '@tanstack/query-core'
import { searchParams } from '../core/actions.js'
import { describeEntry } from '../core/log.js'
import type { DispatchResult, Match } from '../core/screen.js'
import type { Backend, Book } from './backend.js'
import type { LogEntry } from '../core/log.js'

type List = ReturnType<Backend['listBooks']>
type Cart = ReturnType<Backend['getCart']>
type Orders = ReturnType<Backend['listOrders']>
import type { BookSearch, Queries } from './queries.js'

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n - 1) + '…' : s + ' '.repeat(n - s.length))
const gbp = (n: number) => `£${n.toFixed(2)}`
const qcOf = (context: unknown) => (context as { queryClient: QueryClient }).queryClient

export const describeDispatch = (r: DispatchResult) =>
  r.status === 'proposed' ? `proposed #${r.id} — waiting for the user to approve` : `done (#${r.id})`

const BookSearchSchema = Type.Object({
  q: Type.Optional(Type.String({ description: 'title, author or genre contains' })),
  genre: Type.Optional(Type.String()),
  sort: Type.Union([Type.Literal('title'), Type.Literal('price'), Type.Literal('author')], { default: 'title' }),
  page: Type.Integer({ minimum: 1, default: 1 }),
})
const ActivitySchema = Type.Object({ n: Type.Integer({ minimum: 1, maximum: 200, default: 15 }) })

/** Route tree factory: each router (own cursor, `peek`) gets fresh route instances. */
export function createRouteTree(queries: Queries) {
  return () => {
    const read = <T>(qc: QueryClient, opts: { queryKey: readonly unknown[] }) => qc.getQueryData<T>(opts.queryKey)!

    // ── root: app-wide navigation commands ─────────────────────────────────
    const root = new BaseRootRoute({
      staticData: {
        screen: {
          view: (_m, { outlet }) => outlet,
          commands: {
            search: {
              usage: 'search <text>',
              help: 'search books by title, author or genre',
              run: ({ args, navigate }) => navigate({ to: '/books', search: { q: args.join(' ') || undefined } as never }),
            },
            book: {
              usage: 'book <id>',
              help: 'open a book',
              run: ({ args, navigate }) => navigate({ to: '/books/$id', params: { id: args[0] ?? '' } as never }),
            },
            books: { help: 'browse all books', run: ({ navigate }) => navigate({ to: '/books' }) },
            cart: { help: 'view the cart', run: ({ navigate }) => navigate({ to: '/cart' }) },
            account: { help: 'account and orders', run: ({ navigate }) => navigate({ to: '/account' }) },
            activity: { help: 'shared activity log', run: ({ navigate }) => navigate({ to: '/activity' }) },
            home: { help: 'home', run: ({ navigate }) => navigate({ to: '/' }) },
          },
        },
      },
    })

    // ── / ────────────────────────────────────────────────────────────────────
    const home = new BaseRoute({
      getParentRoute: () => root,
      path: '/',
      staticData: {
        screen: {
          title: () => 'Bookshop',
          view: () =>
            [
              'Welcome to the bookshop.',
              '',
              '  search <text>   find books',
              '  books           browse everything',
              '  cart            your cart',
              '  account         email and orders',
              '  activity        what you and the agent have done',
            ].join('\n'),
        },
      },
    })

    // ── /books (layout) ──────────────────────────────────────────────────────
    const books = new BaseRoute({
      getParentRoute: () => root,
      path: 'books',
      loader: ({ context }) => qcOf(context).ensureQueryData(queries.cart()),
      staticData: {
        screen: {
          title: () => 'Books',
          // The layout wraps both list and detail through `outlet`, and reads the
          // cart query so the badge updates whenever anyone changes the cart.
          view: (_m, { outlet, queryClient }) => {
            const cart = read<Cart>(queryClient, queries.cart())
            const count = cart?.lines.reduce((s, l) => s + l.qty, 0) ?? 0
            const bar = '─'.repeat(58)
            return [`┌ Books${' '.repeat(42)}cart: ${count}`, `│ ${bar}`, ...outlet.split('\n').map((l) => `│ ${l}`), `└ ${bar}`].join(
              '\n',
            )
          },
        },
      },
    })

    // ── /books/ (list) ───────────────────────────────────────────────────────
    const listOf = (qc: QueryClient, m: Match) => read<List>(qc, queries.books(m.search as BookSearch))
    const nav = (m: Match, patch: Partial<BookSearch>) => ({
      to: '/books' as const,
      search: { ...(m.search as BookSearch), page: 1, ...patch } as never,
    })

    const bookList = new BaseRoute({
      getParentRoute: () => books,
      path: '/',
      validateSearch: searchParams(BookSearchSchema),
      loaderDeps: ({ search }) => search,
      loader: async ({ context, deps }) => {
        const qc = qcOf(context)
        await qc.ensureQueryData(queries.genres())
        return qc.ensureQueryData(queries.books(deps as BookSearch))
      },
      staticData: {
        screen: {
          search: BookSearchSchema,
          title: (m) => {
            const s = m.search as BookSearch
            return [s.q && `"${s.q}"`, s.genre].filter(Boolean).join(' · ') || 'All'
          },
          view: (m, { queryClient }) => {
            const d = listOf(queryClient, m)
            const s = m.search as BookSearch
            const genres = read<string[]>(queryClient, queries.genres())
            const filters = `sort: ${s.sort} · genre: ${s.genre ?? 'all'} (${genres.join(', ')})`
            if (!d.items.length) return [filters, '', 'No books match.'].join('\n')
            return [
              filters,
              `${d.total} book(s) · page ${s.page}/${d.pages}`,
              '',
              `     ${pad('id', 4)} ${pad('title', 30)} ${pad('author', 18)} ${'price'.padStart(7)}`,
              ...d.items.map(
                (b: Book, i) =>
                  `  ${i + 1}. ${pad(b.id, 4)} ${pad(b.title, 30)} ${pad(b.author, 18)} ${gbp(b.price).padStart(7)}${b.stock ? '' : '  sold out'}`,
              ),
            ].join('\n')
          },
          commands: {
            open: {
              usage: 'open <row>',
              help: 'open the nth book on this page',
              run: ({ args, match, queryClient, navigate }) => {
                const b = listOf(queryClient, match).items[Number(args[0]) - 1]
                if (!b) return `no row ${args[0]}`
                return navigate({ to: '/books/$id', params: { id: b.id } as never })
              },
            },
            next: {
              help: 'next page',
              run: ({ match, queryClient, navigate }) => {
                const s = match.search as BookSearch
                if (s.page >= listOf(queryClient, match).pages) return 'already on the last page'
                return navigate(nav(match, { page: s.page + 1 }))
              },
            },
            prev: {
              help: 'previous page',
              run: ({ match, navigate }) => {
                const s = match.search as BookSearch
                if (s.page <= 1) return 'already on the first page'
                return navigate(nav(match, { page: s.page - 1 }))
              },
            },
            sort: {
              usage: 'sort <title|price|author>',
              help: 'change sort order',
              run: ({ args, match, navigate }) => navigate(nav(match, { sort: args[0] as BookSearch['sort'] })),
            },
            genre: {
              usage: 'genre <name|all>',
              help: 'filter by genre',
              run: ({ args, match, navigate }) =>
                navigate(nav(match, { genre: !args[0] || args[0] === 'all' ? undefined : args[0] })),
            },
          },
        },
      },
    })

    // ── /books/$id ───────────────────────────────────────────────────────────
    const bookDetail = new BaseRoute({
      getParentRoute: () => books,
      path: '$id',
      loader: async ({ context, params }) => {
        const b = await qcOf(context).ensureQueryData(queries.book(params.id))
        if (!b) throw notFound()
        return b
      },
      staticData: {
        screen: {
          title: (m, qc) => read<Book | null>(qc, queries.book(m.params.id!))?.title ?? m.params.id!,
          view: (m, { queryClient }) => {
            const b = read<Book>(queryClient, queries.book(m.params.id!))
            return [
              b.title,
              `by ${b.author}`,
              '',
              `  genre   ${b.genre}`,
              `  price   ${gbp(b.price)}`,
              `  stock   ${b.stock ? b.stock : 'sold out'}`,
            ].join('\n')
          },
          commands: {
            add: {
              usage: 'add [qty]',
              help: 'add this book to the cart',
              run: async ({ args, match, dispatch }) =>
                describeDispatch(await dispatch('cart.add', { bookId: match.params.id, qty: args[0] ?? 1 })),
            },
          },
        },
      },
    })

    // ── /cart ────────────────────────────────────────────────────────────────
    const cart = new BaseRoute({
      getParentRoute: () => root,
      path: 'cart',
      loader: ({ context }) => qcOf(context).ensureQueryData(queries.cart()),
      staticData: {
        screen: {
          title: () => 'Cart',
          view: (_m, { queryClient }) => {
            const c = read<Cart>(queryClient, queries.cart())
            if (!c.lines.length) return 'Your cart is empty.'
            return [
              ...c.lines.map(
                (l, i) => `  ${i + 1}. ${pad(l.title, 34)} × ${l.qty}  ${gbp(l.price * l.qty).padStart(8)}`,
              ),
              `  ${' '.repeat(40)}total ${gbp(c.total).padStart(8)}`,
            ].join('\n')
          },
          commands: {
            remove: {
              usage: 'remove <row>',
              help: 'remove a line',
              run: async ({ args, queryClient, dispatch }) => {
                const line = read<Cart>(queryClient, queries.cart()).lines[Number(args[0]) - 1]
                if (!line) return `no row ${args[0]}`
                return describeDispatch(await dispatch('cart.remove', { bookId: line.bookId }))
              },
            },
            checkout: {
              help: 'place the order',
              run: async ({ dispatch }) => describeDispatch(await dispatch('order.place', {})),
            },
          },
        },
      },
    })

    // ── /account ─────────────────────────────────────────────────────────────
    const account = new BaseRoute({
      getParentRoute: () => root,
      path: 'account',
      loader: async ({ context }) => {
        const qc = qcOf(context)
        await qc.ensureQueryData(queries.orders())
        return qc.ensureQueryData(queries.account())
      },
      staticData: {
        screen: {
          title: () => 'Account',
          view: (_m, { queryClient }) => {
            const a = read<{ name: string; email: string }>(queryClient, queries.account())
            const orders = read<Orders>(queryClient, queries.orders())
            return [
              `  name    ${a.name}`,
              `  email   ${a.email}`,
              '',
              orders.length ? 'Orders' : 'No orders yet.',
              ...orders.map((o) => `  #${o.id}  ${o.at.slice(0, 16).replace('T', ' ')}  ${o.items.length} item(s)  ${gbp(o.total)}`),
            ].join('\n')
          },
          commands: {
            email: {
              usage: 'email <address>',
              help: 'change email (agent: needs approval)',
              run: async ({ args, dispatch }) => describeDispatch(await dispatch('user.updateEmail', { email: args[0] })),
            },
          },
        },
      },
    })

    // ── /activity ────────────────────────────────────────────────────────────
    const activity = new BaseRoute({
      getParentRoute: () => root,
      path: 'activity',
      validateSearch: searchParams(ActivitySchema),
      loaderDeps: ({ search }) => ({ n: (search as { n: number }).n }),
      loader: ({ context, deps }) => qcOf(context).ensureQueryData(queries.activity(deps.n)),
      staticData: {
        screen: {
          search: ActivitySchema,
          title: () => 'Activity',
          view: (m, { queryClient }) =>
            read<LogEntry[]>(queryClient, queries.activity((m.search as { n: number }).n))
              .map((e) => '  ' + describeEntry(e))
              .join('\n') || '  nothing yet',
        },
      },
    })

    return root.addChildren([home, books.addChildren([bookList, bookDetail]), cart, account, activity])
  }
}
