/**
 * What a route contributes to the terminal, declared on the route itself via
 * `staticData` (the same slot you'd use for breadcrumbs/titles on the web).
 *
 * - `view` is a pure function of (match, query cache, outlet): state in, text out.
 * - `commands` are intents. They navigate, or mutate server state through the
 *   QueryClient. They never hold UI state of their own: the URL + query cache
 *   are the whole state.
 */
import type { QueryClient } from '@tanstack/query-core'
import type { HeadlessRouter, Snapshot } from '../headless/router.js'

export type Match = Snapshot['matches'][number]

export interface ViewContext {
  snapshot: Snapshot
  queryClient: QueryClient
  /** Rendered output of the child route — the headless <Outlet />. */
  outlet: string
}

export interface CommandContext {
  args: string[]
  match: Match
  snapshot: Snapshot
  queryClient: QueryClient
  navigate: HeadlessRouter['router']['navigate']
}

export interface Command {
  usage?: string
  help: string
  run: (ctx: CommandContext) => Promise<unknown> | void
}

export interface Screen {
  title?: (match: Match, qc: QueryClient) => string
  view?: (match: Match, ctx: ViewContext) => string
  commands?: Record<string, Command>
}

declare module '@tanstack/router-core' {
  interface StaticDataRouteOption {
    screen?: Screen
  }
}
