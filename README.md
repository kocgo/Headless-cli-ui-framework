# Headless CLI UI framework: the bookshop demo

A web-like terminal app that a **user and an agent use together**. It runs on a
headless TanStack Router (`@tanstack/router-core`) and TanStack Query
(`@tanstack/query-core`). The URL is each actor's UI state, and a shared,
append-only **action log** is the only thing that keeps them in sync.

```
npm i
npm run bookshop                                   # interactive terminal UI (as the user)
npm run bookshop -- search gothic                  # one-shot: navigate, print the screen, exit
npm run bookshop -- --as agent --json book 4       # what an agent sees: JSON screen + data + commands
npm run bookshop -- --as agent do user.updateEmail --email a@b.co   # → proposal, exit code 3
npm run bookshop -- approve 8                      # user approves (or do it in the terminal UI)
npm run bookshop -- log --follow                   # tail the shared log
./scripts/demo.sh                                  # scripted user + agent session, side by side
```

Every process opens the same SQLite file (`bookshop.db`, or `--db` /
`BOOKSHOP_DB`). SQLite is built into Node 22 (`node:sqlite`).

## The model

| Concept | What it is |
| --- | --- |
| **Read** | Navigation. `search gothic`, `book 4` and `set sort=price` only change a URL. |
| **Write** | A named, typed **action** (`cart.add`, `user.updateEmail`, `order.place`). |
| **Action log** | Append-only entries: `navigate`, `propose`, `apply`, `reject`, `fail`. Nothing is updated in place. |
| **Cursor** | Each actor has their own location, rebuilt by replaying their `navigate` entries. Run any one-shot command and it continues where that actor left off. |
| **Sync** | Each process tails the log. Another actor's `apply` invalidates the matching queries, so the screen updates. The same actor navigating in another terminal moves this one too. |
| **Follow** | `follow agent` moves your cursor with the agent's, Figma-style. Cursors are separate by default, so the agent never yanks your screen. |
| **Approval** | Actions marked `requiresApproval` can only be *proposed* by non-user actors. The user sees `⚑ #8 agent wants …` and runs `approve 8` or `reject 8 reason`. `precheck` refuses proposals that are bound to fail, such as checking out an empty cart. |
| **Agent interface** | `--json` returns the screen as text plus the leaf route's data and available commands. `tools` returns a manifest of routes, search-param schemas, actions and their JSON Schemas, because TypeBox schemas *are* JSON Schema. `peek user` shows what the user is looking at, and `wait <id>` blocks until a proposal is decided. |

## Layout

```
src/headless/router.ts   headless TanStack Router: memory history, non-reactive stores, history→load driver
src/core/log.ts          the shared action log (SQLite), cursor replay, pending proposals
src/core/actions.ts      defineAction, TypeBox validation/coercion, approval policy, searchParams()
src/core/session.ts      one actor in one process: router + QueryClient + dispatch/approve/sync/follow
src/core/commands.ts     framework commands (go, back, set, do, approve, peek, wait, tools, …)
src/core/screen.ts       what a route contributes: title, view (pure), commands (intents)
src/render/text.ts       pure renderer; nested views compose through `outlet`
src/shop/*               the app: backend, actions, queries, routes
src/cli.ts               one-shot, --json, interactive terminal UI, log --follow
```

App code (`src/shop`) never sees the log, the sync loop or the router quirks.
Routes declare `staticData.screen = { title, view, commands, search }`. Loaders
prime the query cache with `ensureQueryData`, views read it with
`getQueryData`, and commands either `navigate()` or `dispatch()`.

## Gotchas handled by the wrapper
1. **Run Node with `--conditions=development`.** Under the `node` export
   condition, router-core hard-codes `isServer = true` and takes the SSR
   (server-side rendering) path, where `navigate()` never commits. The
   `npm run bookshop` script sets the flag.
2. The router constructor reads `window?.origin`. The wrapper declares
   `window = undefined`.
3. `@tanstack/history`'s `createMemoryHistory` ignores `initialIndex: 0`,
   because it uses a truthiness check. The wrapper steps back manually so a
   cursor that went back to its first entry restores correctly.
4. With no query observers headless, nothing counts as "active", so
   invalidation uses `refetchType: 'all'`.
5. Query functions must not return `undefined`. Return `null` and throw
   `notFound()` in the loader.

Pinned to router-core 1.171.x, query-core 5.104.x and TypeBox 0.34.x.

## Ideas for next steps
- A Model Context Protocol (MCP) server that exposes `tools` directly, so an
  agent doesn't have to shell out.
- An Ink renderer on the same snapshot and screens.
- Undo, via inverse actions recorded in `apply` entries.
- Per-action policies beyond user/agent, for example limits on order totals.
