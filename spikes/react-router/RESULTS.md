# Spike: @tanstack/react-router, rendered headless

Question: can the framework use `@tanstack/react-router` (real `<Outlet />`, `<Link>`, hooks)
instead of re-implementing nesting on top of `router-core`?

Setup: React 18.3 used only as a renderer (`react-test-renderer`, a ready-made reconciler whose
output is a plain tree). Routes `/books/$genre` (shelf) → `$slug` (book, in the shelf's `<Outlet />`)
→ index | `reviews` (tabs, in the book's `<Outlet />`). Memory history, Node 22. Output: `output.txt`.

## Works
- Three levels of real `<Outlet />`.
- `<Link>` renders `<a href>` and marks itself active (`data-status="active"`, `aria-current`):
  the active tab comes for free.
- `useLoaderData`, `useParams`, `useSearch`, `route.useLoaderData()` from a parent route.
- Per-route loaders and caching: switching tabs fetched nothing; switching books fetched only the
  new book (the shelf stayed cached).

## Needed to make it run
1. `createRouter({ isServer: false })` and `globalThis.window = undefined` (same as router-core).
2. `globalThis.scrollTo = () => {}`: scroll restoration resets scroll after every navigation.
3. `await router.load()` before the first render: the React adapter assumes a browser started loading.
4. `process.exit()` after the work: React's scheduler keeps a `MessageChannel` port open in Node.
5. Production builds: React 18 disables `act()`, so a real implementation uses `react-reconciler`
   directly (as Ink does) instead of the test renderer.

## Cost (cold process, this sandbox)
| Run | Time |
| --- | --- |
| Empty Node | ~31 ms |
| Spike (dev React, 3 renders + 2 navigations) | 167–237 ms |
| Current CLI, one command (SQLite, log, Query) | 144–202 ms |

Bundle: 428 KB (dev React + test renderer) vs 275 KB for the current CLI.

## Verdict
Viable. Views become ordinary TanStack route components; `<Link>` maps to the framework's link
node (`go <href>`); intents, actions, the log and approvals are unaffected. Next: a minimal
`react-reconciler` renderer, then port the page model onto `createRoute`.
