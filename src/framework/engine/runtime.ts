/**
 * Headless @tanstack/react-router: a real router and a real <RouterProvider>,
 * rendered by the framework's React renderer into a plain view tree.
 *
 * Node workarounds (all needed because TanStack assumes a browser on the client path):
 *   1. The `node` export condition hard-codes isServer = true (SSR path, navigate() never
 *      commits). Run with --conditions=development (the bundle bakes it in).
 *   2. The router constructor reads `window?.origin`: declare `window` as undefined.
 *   3. Scroll restoration calls the global `scrollTo` after each navigation: make it a no-op.
 *   4. createMemoryHistory ignores `initialIndex: 0` (a truthiness check): step back by hand.
 *   5. The React adapter expects loading to have started before the first render: load first.
 */
import { createElement as h } from 'react'
import { RouterProvider, createMemoryHistory, createRouter, type AnyRoute } from '@tanstack/react-router'
import { isServer } from '@tanstack/router-core/isServer'
import { createRoot } from '../react/renderer.js'

if (isServer === true) {
  throw new Error(
    'TanStack Router resolved its SSR build. Run Node with --conditions=development (e.g. `tsx --conditions=development …`).',
  )
}
;(globalThis as { window?: unknown }).window ??= undefined
;(globalThis as { scrollTo?: unknown }).scrollTo ??= () => {}

export interface RuntimeOptions {
  routeTree: AnyRoute
  initialEntries: string[]
  initialIndex: number
  context: Record<string, unknown>
  routerOptions?: Record<string, unknown>
  /** Other things that should trigger a re-render (e.g. the query cache). */
  externalSources?: Array<(notify: () => void) => () => void>
}

export async function createRuntime(opts: RuntimeOptions) {
  const entries = opts.initialEntries.length ? opts.initialEntries : ['/']
  const history = createMemoryHistory({ initialEntries: entries, initialIndex: opts.initialIndex })
  const actual = history.location.state.__TSR_index as number | undefined
  if (actual !== undefined && actual !== opts.initialIndex) history.go(opts.initialIndex - actual)

  const router = createRouter({
    ...opts.routerOptions,
    routeTree: opts.routeTree,
    history,
    isServer: false,
    context: opts.context,
    defaultPendingMs: 0,
    // A component that throws is caught by TanStack's boundaries; CUI_DEBUG=1 prints why.
    defaultOnCatch: (error: unknown) => {
      if (process.env.CUI_DEBUG) console.error('[cui] render error:', error)
    },
  } as never)

  const root = createRoot()
  const listeners = new Set<() => void>()
  let started = false
  const emit = () => {
    if (started) listeners.forEach((l) => l())
  }
  root.onCommit(emit)
  const unsubs = (opts.externalSources ?? []).map((src) => src(() => setImmediate(emit)))

  async function settled() {
    for (let i = 0; i < 400; i++) {
      await root.flush()
      if (router.state.status === 'idle' && !router.state.isLoading) {
        await root.flush() // let the render triggered by the final state commit
        return
      }
    }
  }

  await router.load()
  root.render(h(RouterProvider, { router }))
  await settled()
  started = true

  return {
    router,
    history,
    root,
    settled,
    snapshot: () => root.snapshot(),
    onChange(fn: () => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    dispose() {
      unsubs.forEach((u) => u())
      root.unmount()
    },
  }
}

export type Runtime = Awaited<ReturnType<typeof createRuntime>>
