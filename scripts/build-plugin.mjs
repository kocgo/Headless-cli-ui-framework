// Bundle the bookshop CLI (framework + TanStack + TypeBox + app) into one file
// the Claude Code plugin ships in plugin/dist. The "development" condition is
// baked in, so no Node flag is needed at runtime (see README, gotcha 1).
import { build } from 'esbuild'

await build({
  entryPoints: ['src/bookshop/main.ts'],
  outfile: 'plugin/dist/bookshop.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  conditions: ['development'],
  jsx: 'automatic',
  jsxImportSource: '#cui',
  legalComments: 'none',
  minify: true,
  keepNames: true,
  logLevel: 'warning',
})
console.log('built plugin/dist/bookshop.mjs')
