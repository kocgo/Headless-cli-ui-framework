import { Type, type Static, type TObject, type TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message)
  }
}

/** Coerce strings (CLI flags, query strings), fill defaults, validate. */
export function parseInput<S extends TSchema>(schema: S, raw: unknown, what = 'input'): Static<S> {
  const value = Value.Default(schema, Value.Convert(schema, Value.Clone(raw ?? {})))
  if (Value.Check(schema, value)) return value as Static<S>
  const details = [...Value.Errors(schema, value)].map((e) => `${e.path.replace(/^\//, '') || what}: ${e.message}`)
  throw new ValidationError(`invalid ${what}: ${details.join('; ')}`, details)
}

/** Lenient version for search params read from a URL: invalid values fall back to defaults. */
export function parseSearch<S extends TObject>(schema: S, raw: Record<string, unknown>): Static<S> {
  const value = Value.Clean(schema, Value.Default(schema, Value.Convert(schema, Value.Clone(raw))))
  return (Value.Check(schema, value) ? value : Value.Default(schema, {})) as Static<S>
}

export const EmptyObject = Type.Object({})

/** Plain query strings: `?query=1984&page=2`. Types come back through the schema. */
export const stringifyQuery = (search: Record<string, unknown>) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(search)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}
export const parseQuery = (s: string): Record<string, unknown> =>
  Object.fromEntries(new URLSearchParams(s.startsWith('?') ? s.slice(1) : s))

export const schemaJson = (s: TSchema | undefined) => (s ? (JSON.parse(JSON.stringify(s)) as unknown) : undefined)

/** Keys of an object schema, in declaration order. */
export const keysOf = (s: TObject | undefined) => Object.keys(s?.properties ?? {})

export const defaultOf = (s: TObject, key: string): unknown => (s.properties[key] as { default?: unknown } | undefined)?.default
