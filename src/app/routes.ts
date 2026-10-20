import { BaseRootRoute, BaseRoute, notFound, redirect } from '@tanstack/router-core'
import type { QueryClient } from '@tanstack/query-core'
import { nameOf, renameDataset, type Dataset } from './data.js'
import { datasetQuery, datasetsQuery, type AppContext } from './queries.js'
import type { Match } from './screen.js'

const TABS = ['schema', 'lineage', 'owners'] as const
type Tab = (typeof TABS)[number]
type ListSearch = { q?: string; page: number }
type List = Awaited<ReturnType<ReturnType<typeof datasetsQuery>['queryFn']>>

const pad = (s: string, n: number) => (s.length >= n ? s : s + ' '.repeat(n - s.length))
const qcOf = (context: unknown) => (context as AppContext).queryClient

// Views read from the query cache (not loaderData), so a background refetch or
// an invalidation re-renders the screen without any navigation.
const listOf = (qc: QueryClient, m: Match) => {
  const s = m.search as ListSearch
  return qc.getQueryData<List>(datasetsQuery(s.q ?? '', s.page).queryKey)!
}
const datasetOf = (qc: QueryClient, m: Match) =>
  qc.getQueryData<Dataset>(datasetQuery(m.params.id!).queryKey)!

// ── root ────────────────────────────────────────────────────────────────────
const rootRoute = new BaseRootRoute({
  staticData: { screen: { view: (_m, { outlet }) => outlet } },
})

// ── / ───────────────────────────────────────────────────────────────────────
const homeRoute = new BaseRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  staticData: {
    screen: {
      title: () => 'Home',
      view: () =>
        [
          'Metadata catalog (headless demo)',
          '',
          '  catalog          browse datasets',
          '  go <url>         jump anywhere, e.g. go /datasets/104?tab=lineage',
        ].join('\n'),
      commands: {
        catalog: { help: 'browse datasets', run: ({ navigate }) => navigate({ to: '/datasets' }) },
      },
    },
  },
})

// ── /datasets (layout: wraps both children via outlet) ──────────────────────
const datasetsRoute = new BaseRoute({
  getParentRoute: () => rootRoute,
  path: 'datasets',
  staticData: {
    screen: {
      title: () => 'Datasets',
      view: (_m, { outlet, queryClient }) => {
        const busy = queryClient.isFetching() ? '  ↻ refreshing' : ''
        const bar = '─'.repeat(52)
        return [`┌ Catalog${busy}`, `│ ${bar}`, ...outlet.split('\n').map((l) => `│ ${l}`), `└ ${bar}`].join('\n')
      },
    },
  },
})

// ── /datasets/ (list) ───────────────────────────────────────────────────────
const datasetListRoute = new BaseRoute({
  getParentRoute: () => datasetsRoute,
  path: '/',
  validateSearch: (s: Record<string, unknown>): ListSearch => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    page: Math.max(1, Number(s.page) || 1),
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? '', page: search.page }),
  loader: ({ context, deps }) => qcOf(context).ensureQueryData(datasetsQuery(deps.q, deps.page)),
  staticData: {
    screen: {
      title: (m) => (m.search.q ? `Search "${m.search.q}"` : 'All'),
      view: (m, { queryClient }) => {
        const d = listOf(queryClient, m)
        const { q, page } = m.search as ListSearch
        if (!d.items.length) return `No datasets match "${q}".`
        return [
          `${d.total} dataset(s)${q ? ` matching "${q}"` : ''} · page ${page}/${d.pages}`,
          '',
          `     ${pad('id', 5)} ${pad('name', 16)} ${pad('domain', 10)} owner`,
          ...d.items.map(
            (it, i) => `  ${i + 1}. ${pad(it.id, 5)} ${pad(it.name, 16)} ${pad(it.domain, 10)} ${it.owner}`,
          ),
        ].join('\n')
      },
      commands: {
        open: {
          usage: 'open <row|id>',
          help: 'open a dataset',
          run: ({ args, match, queryClient, navigate }) => {
            const d = listOf(queryClient, match)
            const n = Number(args[0])
            const id = n >= 1 && n <= d.items.length ? d.items[n - 1]!.id : args[0]
            if (id) return navigate({ to: '/datasets/$id', params: { id }, search: { tab: 'schema' } })
          },
        },
        search: {
          usage: 'search <text>',
          help: 'filter by name or domain',
          run: ({ args, navigate }) =>
            navigate({ to: '/datasets', search: { q: args.join(' ') || undefined, page: 1 } }),
        },
        next: {
          help: 'next page',
          run: ({ match, queryClient, navigate }) => {
            const s = match.search as ListSearch
            if (s.page < listOf(queryClient, match).pages)
              return navigate({ to: '/datasets', search: { ...s, page: s.page + 1 } })
          },
        },
        prev: {
          help: 'previous page',
          run: ({ match, navigate }) => {
            const s = match.search as ListSearch
            if (s.page > 1) return navigate({ to: '/datasets', search: { ...s, page: s.page - 1 } })
          },
        },
      },
    },
  },
})

// ── /datasets/$id ───────────────────────────────────────────────────────────
const datasetRoute = new BaseRoute({
  getParentRoute: () => datasetsRoute,
  path: '$id',
  validateSearch: (s: Record<string, unknown>): { tab: Tab } => ({
    tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : 'schema',
  }),
  loader: async ({ context, params }) => {
    const ds = await qcOf(context).ensureQueryData(datasetQuery(params.id))
    if (!ds) throw notFound()
    return ds
  },
  staticData: {
    screen: {
      title: (m, qc) => datasetOf(qc, m)?.name ?? m.params.id!,
      view: (m, { queryClient }) => {
        const ds = datasetOf(queryClient, m)
        const { tab } = m.search as { tab: Tab }
        const tabs = TABS.map((t) => (t === tab ? `[${t}]` : ` ${t} `)).join(' ')
        let body: string[]
        if (tab === 'schema') body = ds.columns.map((c) => `  ${pad(c.name, 22)} ${c.type}`)
        else if (tab === 'lineage')
          body = ds.upstream.length
            ? ['  upstream:', ...ds.upstream.map((u, i) => `    ${i + 1}. ${u} ${nameOf(u)}`)]
            : ['  no upstream (source dataset)']
        else body = [`  owner:  ${ds.owner}`, `  domain: ${ds.domain}`]
        return [`${ds.name}  (${ds.id})`, tabs, '', ...body].join('\n')
      },
      commands: {
        tab: {
          usage: `tab <${TABS.join('|')}>`,
          help: 'switch tab (search param)',
          run: ({ args, match, navigate }) =>
            navigate({ to: '/datasets/$id', params: { id: match.params.id! }, search: { tab: args[0] as Tab } }),
        },
        up: {
          usage: 'up <n>',
          help: 'open the nth upstream dataset',
          run: ({ args, match, queryClient, navigate }) => {
            const id = datasetOf(queryClient, match).upstream[Number(args[0] ?? 1) - 1]
            if (id) return navigate({ to: '/datasets/$id', params: { id }, search: { tab: 'lineage' } })
          },
        },
        rename: {
          usage: 'rename <name>',
          help: 'mutate, then invalidate the query cache (no navigation)',
          run: async ({ args, match, queryClient }) => {
            if (!args[0]) return
            await renameDataset(match.params.id!, args.join('-'))
            // Same pattern as on the web: invalidate and let Query refetch.
            await queryClient.invalidateQueries({ queryKey: ['datasets'] })
          },
        },
        list: { help: 'back to the list', run: ({ navigate }) => navigate({ to: '/datasets' }) },
      },
    },
  },
})

// ── /ds/$id → /datasets/$id (alias via beforeLoad redirect) ─────────────────
const aliasRoute = new BaseRoute({
  getParentRoute: () => rootRoute,
  path: 'ds/$id',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/datasets/$id', params: { id: params.id }, search: { tab: 'schema' } })
  },
})

export const routeTree = rootRoute.addChildren([
  homeRoute,
  datasetsRoute.addChildren([datasetListRoute, datasetRoute]),
  aliasRoute,
])
