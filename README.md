# Headless TanStack Router + Query in the terminal

The URL is the whole app state. `@tanstack/router-core` runs its normal client
pipeline in Node: loaders, `validateSearch`, `loaderDeps`, `beforeLoad`
redirects, `notFound`, nested routes and back/forward. `@tanstack/query-core`
owns server state. The terminal is only a projection of
`(router snapshot, query cache) → text`.

```
npm i
npm start -- /datasets?q=risk          # one-shot: render the URL and exit
npm start -- /datasets/104 --json      # one-shot, machine-readable state + query cache
npm start -- -i /datasets              # interactive (piped commands work too)
npm start -- -i --resume               # reopen last session's history stack
```

## Layout

| File | Role |
| --- | --- |
| `src/headless/router.ts` | `createHeadlessRouter()`: memory history, non-reactive stores, history→load driver (what React's `<Transitioner>` does), `snapshot()` / `onChange()`, external sources such as the query cache |
| `src/app/routes.ts` | Code-based route tree. Each route declares `staticData.screen = { title, view, commands }` |
| `src/app/queries.ts` | `QueryClient` and query option factories, passed to loaders via router `context` |
| `src/render/text.ts` | Pure renderer. Composes views leaf→root, passing each child's output as `outlet` |
| `src/cli.ts` | One-shot, `--json` and interactive (REPL, read-eval-print loop) modes, plus session persistence |

## Rules the demo follows
- **Views are pure.** `view(match, { queryClient, outlet })` → string, with no local state.
- **Commands are intents.** They either `navigate()` (search params, path params) or
  mutate and then `invalidateQueries()`. The query cache subscription re-renders
  the screen with no navigation.
- **Loaders prime, views read.** `ensureQueryData` in the loader; `getQueryData` in the view.

## Gotchas
1. **Run Node with `--conditions=development`.** Under the `node` export
   condition, router-core hard-codes `isServer = true` and takes the SSR
   (server-side rendering) path. In that path `navigate()` never commits, and
   redirects and notFound aren't handled. The wrapper throws a clear error if
   the flag is missing.
2. The router constructor reads `window?.origin`. The wrapper declares
   `window = undefined`, which is enough to stop the throw while keeping
   `typeof window === 'undefined'`.
3. Query functions must not return `undefined`. Return `null` and throw
   `notFound()` in the loader.
4. Memory history doesn't expose its stack, so the wrapper tracks entries
   itself for `history` and `--resume`.

Tested against router-core 1.171.38 and query-core 5.104.5. `RouterCore` and
the store factories are public exports, but they're lower-level than the
adapter APIs, so pin versions.

## Next steps
- Swap `render/text.ts` for an Ink renderer. The snapshot and routes stay the same.
- Replace the hand-written `validateSearch` with TypeBox schemas.
