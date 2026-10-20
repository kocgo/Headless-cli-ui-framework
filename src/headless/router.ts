/**
 * Headless TanStack Router for Node.
 *
 * Runs @tanstack/router-core's full *client* pipeline (loaders, validateSearch,
 * beforeLoad redirects, notFound, caching, back/forward) with no DOM and no UI
 * framework. Anything that wants to show the app — a text renderer, Ink, a test,
 * a JSON consumer — just reads `snapshot()` and listens to `onChange`.
 */
import {
  RouterCore,
  createNonReactiveMutableStore,
  createNonReactiveReadonlyStore,
  type AnyRoute,
  type AnyRouteMatch,
} from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import { createMemoryHistory } from '@tanstack/history'

/**
 * Gotcha #1: under Node, the package's "node" export condition hard-codes
 * isServer = true, which routes everything through the SSR path (no redirects,
 * no notFound handling, navigate() never commits). The "development" condition
 * leaves it undefined so our `isServer: false` option wins.
 */
if (isServer === true) {
  throw new Error(
    'router-core resolved its SSR build. Run Node with --conditions=development ' +
      '(e.g. `tsx --conditions=development src/cli.ts`).',
  )
}

/**
 * Gotcha #2: the constructor reads `window?.origin`, which throws when `window`
 * is undeclared. Declaring it as `undefined` is enough; `typeof window` stays
 * 'undefined' so nothing else mistakes this for a browser.
 */
;(globalThis as { window?: unknown }).window ??= undefined

/** Plain, serialisable view of where the app is. This is the whole UI contract. */
export interface Snapshot {
  href: string
  pathname: string
  search: Record<string, unknown>
  status: 'idle' | 'pending'
  notFound: boolean
  matches: Array<{
    routeId: string
    params: Record<string, string>
    search: Record<string, unknown>
    status: AnyRouteMatch['status']
    loaderData: unknown
    error?: string
  }>
  history: { index: number; length: number; entries: string[] }
}

export interface HeadlessOptions<TTree extends AnyRoute> {
  routeTree: TTree
  initialEntries?: string[]
  initialIndex?: number
  /** Router context, available in beforeLoad/loader (e.g. { queryClient }). */
  context?: Record<string, unknown>
  /**
   * Anything else that should trigger a re-render when it changes, e.g. a
   * TanStack Query cache: `(notify) => queryClient.getQueryCache().subscribe(notify)`.
   */
  externalSources?: Array<(notify: () => void) => () => void>
}

export function createHeadlessRouter<TTree extends AnyRoute>(opts: HeadlessOptions<TTree>) {
  const entries = opts.initialEntries?.length ? opts.initialEntries : ['/']
  const history = createMemoryHistory({
    initialEntries: entries,
    initialIndex: opts.initialIndex ?? entries.length - 1,
  })

  const router = new RouterCore(
    { routeTree: opts.routeTree, history, isServer: false, context: opts.context } as never,
    // No reactivity system needed: we re-read state on router events.
    () => ({
      createMutableStore: createNonReactiveMutableStore,
      createReadonlyStore: createNonReactiveReadonlyStore,
      batch: (fn) => fn(),
    }),
  )

  // The React adapter's <Transitioner> does this; headless, we do it ourselves.
  // Every history change (navigate, back, forward, redirect) triggers a load.
  history.subscribe(() => {
    void router.load()
  })

  const listeners = new Set<(s: Snapshot) => void>()
  let resolvedOnce = false // nothing meaningful to show before the first resolve
  const emit = () => {
    if (!resolvedOnce) return
    const snap = snapshot()
    listeners.forEach((l) => l(snap))
  }
  router.subscribe('onResolved', () => {
    resolvedOnce = true
    emit()
  })
  router.subscribe('onBeforeLoad', emit) // lets UIs show a pending state

  // Coalesce bursts from external stores (a query cache fires many events per fetch).
  let scheduled = false
  const scheduleEmit = () => {
    if (scheduled) return
    scheduled = true
    setImmediate(() => {
      scheduled = false
      if (router.state.status === 'idle') emit()
    })
  }
  const unsubs = (opts.externalSources ?? []).map((src) => src(scheduleEmit))

  function snapshot(): Snapshot {
    const s = router.state
    const leaf = s.matches.at(-1)
    return {
      href: s.location.href,
      pathname: s.location.pathname,
      search: s.location.search as Record<string, unknown>,
      status: s.isLoading || s.status === 'pending' ? 'pending' : 'idle',
      // No route claimed the path: only the root matched.
      notFound:
        (leaf?.routeId === '__root__' && s.location.pathname !== '/') ||
        s.matches.some((m) => m.status === 'notFound'),
      matches: s.matches.map((m) => ({
        routeId: m.routeId,
        params: m.params as Record<string, string>,
        search: m.search as Record<string, unknown>,
        status: m.status,
        loaderData: m.loaderData,
        error: m.error ? String((m.error as Error).message ?? m.error) : undefined,
      })),
      history: historyEntries(),
    }
  }

  // Memory history doesn't expose its stack, so we track it alongside.
  const stack = [...entries]
  let index = opts.initialIndex ?? entries.length - 1
  history.subscribe(({ action }) => {
    const href = history.location.href
    if (action.type === 'PUSH') {
      stack.splice(index + 1, Infinity, href)
      index++
    } else if (action.type === 'REPLACE') stack[index] = href
    else if (action.type === 'BACK') index = Math.max(0, index - 1)
    else if (action.type === 'FORWARD') index = Math.min(stack.length - 1, index + 1)
    else if (action.type === 'GO') index = Math.min(stack.length - 1, Math.max(0, index + action.index))
  })
  function historyEntries() {
    return { index, length: stack.length, entries: [...stack] }
  }

  return {
    router,
    history,
    snapshot,
    start: () => router.load(),
    dispose: () => unsubs.forEach((u) => u()),
    onChange(fn: (s: Snapshot) => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    /** Settle: resolves once the current navigation (incl. redirects) is done. */
    async settled() {
      while (router.state.status === 'pending' || router.state.isLoading) {
        await new Promise((r) => setTimeout(r, 5))
      }
    },
  }
}

export type HeadlessRouter = ReturnType<typeof createHeadlessRouter>
