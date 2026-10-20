# Headless CLI UI framework

A declarative framework for apps that **a person and an AI agent use together**.
You declare pages, intents, views and actions once. From those declarations you get:

- a **CLI** the agent drives (`bookshop search --query 1984`)
- an **interactive terminal UI** for people
- a **JSON contract** with the screen, its data, its business-logic model and every control's command
- a **shared activity log** that keeps actors in sync and records what each one did and found
- a **pane in Claude Code**, shipped as a plugin, drawing the same views

It runs [`@tanstack/react-router`](https://tanstack.com/router) headless: real routes, real `<Outlet />`, `<Link>` and hooks, rendered by a small custom React renderer into a plain view tree instead of the DOM. Data goes through [TanStack Query](https://tanstack.com/query) (`@tanstack/query-core`); params, args and inputs are [TypeBox](https://github.com/sinclairzx81/typebox) schemas.

## Install the example as a Claude Code plugin

```
/plugin install bookshop --marketplace kocgo/headless-cli-ui-framework
```

Then run `/shop` to open the pane, and ask Claude about books. Claude uses the `bookshop` CLI through its Bash tool (the plugin puts it on the PATH), guided by the plugin's skill. Requires Claude Code 2.1.287 or later (mods) and Node.js 22.13 or later.

## One declaration, everything derived

```tsx
export const search = page('search', {
  path: '/search',
  params: Type.Object({
    query: Type.Optional(Type.String()),
    page: Type.Integer({ minimum: 1, default: 1 }),
  }),
  data: (p, { api }) => api.searchBooks(p),                  // fetch
  summary: ({ data, params }) => `${data.total} results for "${params.query}"`,
  intents: {
    open: {                                                   // what you can do here
      args: Type.Object({ row: Type.Integer({ minimum: 1 }) }),
      to: ({ data, args }): Href => book.link({ id: data.items[args.row - 1]!.id }),
    },
    next: {
      when: ({ data, params }) => params.page < data.pages || 'already on the last page',
      to: ({ params, link }) => link({ ...params, page: params.page + 1 }),
    },
  },
  view: ({ data, params }) => (                               // how it looks
    <Page title={`Results for "${params.query}"`}>
      <Table rows={data.items} rowIntent="open" columns={[col('title'), col('author')]} />
      <Button intent="next" label="Next" hotkey="n" />
    </Page>
  ),
})
```

`bookshop search --query 1984` then:

| Concern | Derived from | Result |
| --- | --- | --- |
| Command and flags | page name + `params` | `search [--query <query>] [--page <page>]`, validated and coerced |
| URL | `path` + `params` | `/search?query=1984`, pushed to this actor's history |
| Request | `data` | through the TanStack Query cache, key `['search', params]` |
| Output | `data`, `model`, `view` | the JSON envelope's `screen` |
| Log | page + params + `summary` | `agent → search {"query":"1984"} · 1 result for "1984"` |
| Next steps | `intents` | `open <row>`, `next`, with availability and reasons |

### The layers of a page

| Layer | Holds | Notes |
| --- | --- | --- |
| `params` | path and search params (TypeBox) | also the CLI flags, and the agent's schema |
| `data` | fetching | return `null` for "not found" |
| `model` | business logic over the data | pure; part of the JSON, so the agent reads facts, not pixels |
| `intents` | what you can do: `to` (navigate) or `do` (action) | `when` decides availability for the user and the agent at once |
| `view` | presentation only, as React | `Page`, `Section`, `Row`, `Stack`, `Text`, `Table`, `KeyValue`, `Badge`, `Link`, `Button`, `Input`, `Divider`, `Tabs`, plus TanStack's `<Outlet />` |
| `summary` | one line for the activity log | |

### Nested routes, outlets and tabs

Pages nest as real TanStack routes. A child inherits its parent's params, sees its state as `parent`, and renders in the parent's `<Outlet />`; a tab is a child that also appears in the parent's `<Tabs />` bar and gets a `tab <name>` intent.

```tsx
export const shelf = page('shelf', {
  path: '/books/$genre',
  params: Type.Object({ genre: Type.String() }),
  data: ({ genre }, { api }) => api.getShelf(genre),
  view: ({ data }) => (
    <Page title="Shelf">
      <Table rows={data} rowIntent="open" columns={[col('title')]} />
      <Outlet />                                   {/* the selected book */}
    </Page>
  ),
  intents: { open: { /* … */ } },
})

export const book = shelf.child('book', {         // /books/science/the-time-machine
  path: '$slug',
  params: Type.Object({ slug: Type.String() }),
  data: ({ genre, slug }, { api }) => api.getBookBySlug(genre, slug),
  view: ({ data }) => <Section title={data.title}><Tabs /></Section>,
})

export const details = book.tab('details', { index: true, view: ({ parent }) => <KeyValue items={{ Price: parent.data.price }} /> })
export const reviews = book.tab('reviews', {     // /books/science/the-time-machine/reviews?sort=new
  params: Type.Object({ sort: Type.Union([Type.Literal('top'), Type.Literal('new')], { default: 'top' }) }),
  data: ({ slug, sort }, { api }) => api.getReviews(slug, sort),
  view: ({ data }) => <Table rows={data} columns={[col('stars'), col('text')]} />,
})
```

On the CLI: `shelf science`, then `open 1`, then `tab reviews`, then `sort new`. Or go straight there with `reviews science the-time-machine --sort new`. `screen.intents` lists the intents of every level (`reviews.sort`, `book.add`, `book.tab`, `shelf.open`).

Domain rules live in plain modules (`src/bookshop/domain/`) that `model`, `when` and an action's `precheck` all call, so the screen and the write can't disagree.

Controls in a view name an intent or a param instead of holding a callback (`<Button intent="next">`, `rowIntent="open"`, `<Input param="query">`). The engine binds each one to the exact CLI command that performs it. The view is plain data, so it renders as terminal text, as JSON for the agent, and as Claude Code elements in the pane, and a press anywhere runs the same command.

### Actions

```ts
export const order = actions('order', {
  place: action({
    description: 'Place an order for everything in the cart',
    input: Type.Object({}),
    requiresApproval: true,                       // the agent can only propose it
    precheck: async (_i, { api }) => checkoutBlockers(await api.getCart())[0],
    run: async (_i, { api }) => api.placeOrder(…),
    invalidates: ['cart', 'account', 'shell'],    // pages whose queries refetch everywhere
    summary: (_i, r) => `order #${r.orderId} placed`,
  }),
})
```

## The CLI

```
bookshop [--as <actor>] [--json] [--db <path>] <command> [args…] [--flag value…]
bookshop                        # interactive terminal UI
```

Commands are looked up in this order: framework commands, then intents on the current screen, then page names.

- **Pages:** `search --query dune`, `book 4`, `cart`, `account`, `activity`
- **Intents** (current page): `open 2`, `next`, `add 2`, `checkout`, `email a@b.co`
- **Framework:** `go <href>`, `back`, `forward`, `set k=v`, `unset k`, `reload`, `show`, `do <action> [--check]`, `pending`, `approve <id>`, `reject <id> [reason]`, `wait <id>`, `peek <actor>`, `follow <actor>`, `log [n] [--since id] [--follow]`, `tools`, `help`, `whoami`

**Actor:** `--as`, then `BOOKSHOP_ACTOR`, then `agent` inside Claude Code's Bash tool (`CLAUDECODE=1`), then `user`. Each actor has its own history, replayed from the log.

**Exit codes:** 0 done · 1 bad input · 2 not found · 3 proposed, awaiting approval · 4 refused (unavailable or precheck) · 5 timed out · 6 not allowed · 70 internal

**`--json`** prints one versioned envelope: `{ v, ok, actor, command, message, result, screen?, pending, error }`. `screen` holds `page`, `href`, `title`, `status`, `params`, `data`, `model`, `summary`, `view`, `text`, `intents` and `controls`.

## Layout

```
src/framework/            the framework
  declare.ts              page(), layout(), child(), tab(), action(), actions() — the authoring API
  view.tsx                the view primitives (React components emitting host elements)
  react/renderer.ts       a react-reconciler renderer: React → plain view tree, no DOM
  app.ts                  defineApp(): validation and framework commands
  engine/                 react-router runtime, route compilation, screen resolution,
                          session (cursor, intents, dispatch, approvals, sync), activity log
  cli/                    command layer, JSON envelope, text renderer, interactive UI
src/bookshop/             the example app: api, domain rules, actions, pages
plugin/                   the Claude Code plugin
  bin/bookshop            launcher (on Claude's PATH)
  dist/bookshop.mjs       bundled CLI (npm run build)
  skills/bookshop/        teaches Claude the CLI
  hooks/pane.ts           the mod: /shop pane, refresh on Claude's calls, prompt context
  tests/                  pane tests (claude plugin test)
```

## Develop

```
npm i
npm run bookshop -- search --query gothic      # run from source
npm run typecheck
npm run build                                  # bundle into plugin/dist
claude plugin validate plugin && claude plugin test plugin
./scripts/demo.sh                              # a scripted user + agent session
claude --plugin-dir ./plugin                   # try the pane
```

## Gotchas the framework handles

1. Under Node's `node` export condition, router-core hard-codes `isServer = true`, and `navigate()` never commits. The bundle bakes in the `development` condition; from source, run with `--conditions=development`.
2. The router constructor reads `window?.origin`; the engine declares `window = undefined`.
3. Scroll restoration calls the global `scrollTo` after every navigation; the engine makes it a no-op.
4. The React adapter expects loading to have started before the first render; the engine calls `router.load()` first.
5. `createMemoryHistory` ignores `initialIndex: 0` (a truthiness check). The engine steps back manually.
6. Headless, no query has observers, so invalidation uses `refetchType: 'all'`.
7. URLs use plain query strings (`?query=1984`) with schema coercion, and omit default values, instead of TanStack's JSON-typed encoding.
8. A page component re-rendered mid-transition, after its route stopped matching, must render nothing (an `<Outlet />` there throws).

`CUI_DEBUG=1` prints any error a component throws inside TanStack's error boundaries.

Tested with @tanstack/react-router 1.170 (router-core 1.171), React 18.3 with react-reconciler 0.29, query-core 5.104, TypeBox 0.34 and Claude Code 2.1.304. The spike that led here is in `spikes/react-router/`.
