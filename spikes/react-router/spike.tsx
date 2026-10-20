// Spike: @tanstack/react-router rendered headless, React used only as a renderer.
// /books/$genre (shelf) → $slug (book, in the shelf's <Outlet/>) → index | reviews (tabs, in the book's <Outlet/>)
import { createElement as h, type ReactNode } from 'react'
import TestRenderer, { act } from 'react-test-renderer'
import {
  Link, Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter, useParams,
} from '@tanstack/react-router'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
;(globalThis as { window?: unknown }).window ??= undefined // router-core reads window?.origin
;(globalThis as { scrollTo?: unknown }).scrollTo ??= () => {} // scroll restoration resets scroll after each navigation
const t0 = performance.now()

// ── host primitives: plain string element types, no DOM ─────────────────────
const Page = (p: { title: string; children?: ReactNode }) => h('Page', { title: p.title }, p.children)
const Text = (p: { children?: ReactNode }) => h('Text', null, p.children)
const Rows = (p: { children?: ReactNode }) => h('Rows', null, p.children)

// ── fake backend ───────────────────────────────────────────────────────────
const BOOKS = [
  { slug: 'the-time-machine', title: 'The Time Machine', genre: 'science' },
  { slug: 'war-of-the-worlds', title: 'The War of the Worlds', genre: 'science' },
  { slug: 'dracula', title: 'Dracula', genre: 'gothic' },
]
const REVIEWS: Record<string, Array<{ stars: number; text: string; at: number }>> = {
  'the-time-machine': [{ stars: 5, text: 'Timeless', at: 2 }, { stars: 3, text: 'Dated', at: 9 }],
}
let fetches: string[] = []
const fetchLog = (s: string) => fetches.push(s)

// ── routes, exactly as on the web ──────────────────────────────────────────
const root = createRootRoute({
  component: () => h(Page, { title: 'Bookshop' }, h(Outlet)),
})

const shelf = createRoute({
  getParentRoute: () => root,
  path: 'books/$genre',
  loader: ({ params }) => {
    fetchLog(`shelf ${params.genre}`)
    return BOOKS.filter((b) => b.genre === params.genre)
  },
  component: function Shelf() {
    const books = shelf.useLoaderData()
    const { genre } = shelf.useParams()
    return h('Section', { title: `Shelf: ${genre}` },
      h(Rows, null, books.map((b) => h(Link, { key: b.slug, to: '/books/$genre/$slug', params: { genre, slug: b.slug } }, b.title))),
      h(Outlet),
    )
  },
})

const book = createRoute({
  getParentRoute: () => shelf,
  path: '$slug',
  loader: ({ params }) => {
    fetchLog(`book ${params.slug}`)
    return BOOKS.find((b) => b.slug === params.slug)!
  },
  component: function Book() {
    const b = book.useLoaderData()
    const params = useParams({ from: book.id })
    return h('Section', { title: b.title },
      h('Tabs', null,
        h(Link, { to: '/books/$genre/$slug', params, activeOptions: { exact: true } }, 'Details'),
        h(Link, { to: '/books/$genre/$slug/reviews', params }, 'Reviews'),
      ),
      h(Outlet),
    )
  },
})

const details = createRoute({
  getParentRoute: () => book,
  path: '/',
  component: () => h(Text, null, `Details of ${book.useLoaderData().title}`),
})

const reviews = createRoute({
  getParentRoute: () => book,
  path: 'reviews',
  validateSearch: (s: Record<string, unknown>) => ({ sort: s.sort === 'new' ? ('new' as const) : ('top' as const) }),
  loaderDeps: ({ search }) => ({ sort: search.sort }),
  loader: ({ params, deps }) => {
    fetchLog(`reviews ${params.slug} ${deps.sort}`)
    const r = [...(REVIEWS[params.slug] ?? [])]
    return deps.sort === 'new' ? r.sort((a, b) => b.at - a.at) : r.sort((a, b) => b.stars - a.stars)
  },
  component: function Reviews() {
    const list = reviews.useLoaderData()
    const { sort } = reviews.useSearch()
    return h('Section', { title: `Reviews (${sort})` }, list.map((r, i) => h(Text, { key: i }, `${r.stars}★ ${r.text}`)))
  },
})

const routeTree = root.addChildren([shelf.addChildren([book.addChildren([details, reviews])])])

// ── serialise the rendered host tree (drop functions) ──────────────────────
type Json = ReturnType<TestRenderer.ReactTestRenderer['toJSON']>
function show(node: Json | string, depth = 0): string {
  if (node === null) return ''
  if (typeof node === 'string') return '  '.repeat(depth) + JSON.stringify(node)
  if (Array.isArray(node)) return node.map((n) => show(n, depth)).join('\n')
  const props = Object.entries(node.props).filter(([, v]) => typeof v !== 'function' && v !== undefined).map(([k, v]) => `${k}=${JSON.stringify(v)}`)
  const head = '  '.repeat(depth) + `<${node.type}${props.length ? ' ' + props.join(' ') : ''}>`
  return [head, ...(node.children ?? []).map((c) => show(c as Json | string, depth + 1))].join('\n')
}

async function main() {
  const router = createRouter({ routeTree, isServer: false, history: createMemoryHistory({ initialEntries: ['/books/science/the-time-machine/reviews?sort=new'] }) })
  let tr!: TestRenderer.ReactTestRenderer
  await router.load() // populate the match stores before React renders, as a browser would have
  await act(async () => {
    tr = TestRenderer.create(h(RouterProvider, { router }))
  })
  const settle = async () => {
    for (let i = 0; i < 100 && (router.state.status !== 'idle' || router.state.isLoading); i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)) })
  }
  await settle()
  console.log(`--- ${router.state.location.href}  (first render ${(performance.now() - t0).toFixed(0)} ms, fetches: ${fetches.join(', ')})`)
  console.log(show(tr.toJSON()))

  fetches = []
  await act(async () => { await router.navigate({ to: '/books/$genre/$slug', params: { genre: 'science', slug: 'the-time-machine' } }) })
  await settle()
  console.log(`--- ${router.state.location.href}  (fetches: ${fetches.join(', ') || 'none, cached'})`)
  console.log(show(tr.toJSON()))

  fetches = []
  await act(async () => { await router.navigate({ to: '/books/$genre/$slug', params: { genre: 'science', slug: 'war-of-the-worlds' } }) })
  await settle()
  console.log(`--- ${router.state.location.href}  (fetches: ${fetches.join(', ') || 'none'})`)
  console.log(show(tr.toJSON()))
  console.log(`total ${(performance.now() - t0).toFixed(0)} ms`)
  tr.unmount()
}
await main()
process.exit(0) // React's scheduler keeps a MessageChannel port open
