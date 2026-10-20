/**
 * What a route contributes to the terminal, declared on the route itself via
 * `staticData.screen`.
 *
 * - `view` is pure: (match, query cache, outlet) → text. No local state.
 * - `commands` are intents: they either navigate (change the URL) or dispatch
 *   an action (a logged mutation). Nothing else.
 * - `search` exposes the route's search-param schema to agents.
 */
import type { QueryClient } from '@tanstack/query-core'
import type { TSchema } from '@sinclair/typebox'
import type { HeadlessRouter, Snapshot } from '../headless/router.js'

export type Match = Snapshot['matches'][number]

export type DispatchResult =
  | { status: 'applied'; id: number; result: unknown }
  | { status: 'proposed'; id: number }

export type Dispatch = (action: string, input?: unknown) => Promise<DispatchResult>

export interface ViewContext {
  snapshot: Snapshot
  queryClient: QueryClient
  /** Rendered output of the child route — the headless <Outlet />. */
  outlet: string
}

export interface CommandContext {
  args: string[]
  flags: Record<string, string>
  match: Match
  snapshot: Snapshot
  queryClient: QueryClient
  navigate: HeadlessRouter['router']['navigate']
  dispatch: Dispatch
}

export interface Command {
  usage?: string
  help: string
  /** May return a string to show the actor (e.g. "proposed #12"). */
  run: (ctx: CommandContext) => unknown
}

export interface Screen {
  title?: (match: Match, qc: QueryClient) => string
  view?: (match: Match, ctx: ViewContext) => string
  commands?: Record<string, Command>
  search?: TSchema
}

declare module '@tanstack/router-core' {
  interface StaticDataRouteOption {
    screen?: Screen
  }
}
