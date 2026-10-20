/**
 * Typed actions (mutations). The TypeBox schema is used three ways:
 * validating input, coercing CLI strings (`--qty 2` → 2), and — because
 * TypeBox schemas *are* JSON Schema — as the agent's tool definition.
 */
import type { Static, TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

export type QueryKey = readonly unknown[]

export interface ActionDef<S extends TSchema = TSchema, R = unknown> {
  description: string
  input: S
  /** If true, non-user actors can only *propose* this action; the user approves. */
  requiresApproval?: boolean
  /** Query keys to invalidate in every process once the action is applied. */
  invalidates: (input: Static<S>) => QueryKey[]
  /**
   * Cheap precondition, checked before running *or proposing*. Return a reason
   * to refuse, so an agent can't queue a proposal that is bound to fail.
   */
  precheck?: (input: Static<S>) => string | void
  run: (input: Static<S>) => R | Promise<R>
}

export const defineAction = <S extends TSchema, R>(def: ActionDef<S, R>) => def

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActionRegistry = Record<string, ActionDef<any, any>>

export class ValidationError extends Error {}

/** Coerce + default + validate. Throws a readable ValidationError. */
export function parseInput<S extends TSchema>(schema: S, raw: unknown): Static<S> {
  const value = Value.Default(schema, Value.Convert(schema, Value.Clone(raw ?? {})))
  if (Value.Check(schema, value)) return value as Static<S>
  const errors = [...Value.Errors(schema, value)].map((e) => `${e.path || '/'}: ${e.message}`)
  throw new ValidationError(errors.join('; '))
}

/** TypeBox-backed `validateSearch` for routes. Invalid params fall back to defaults. */
export function searchParams<S extends TSchema>(schema: S) {
  return (raw: Record<string, unknown>): Static<S> => {
    const value = Value.Clean(schema, Value.Default(schema, Value.Convert(schema, Value.Clone(raw))))
    return (Value.Check(schema, value) ? value : Value.Default(schema, {})) as Static<S>
  }
}

/** Approval policy: the user acts directly; other actors propose sensitive actions. */
export const needsApproval = (actor: string, def: ActionDef) => Boolean(def.requiresApproval) && actor !== 'user'

/** JSON-Schema view of the registry, for agents. */
export function describeActions(actions: ActionRegistry) {
  return Object.entries(actions).map(([name, def]) => ({
    name,
    description: def.description,
    requiresApproval: Boolean(def.requiresApproval),
    input_schema: JSON.parse(JSON.stringify(def.input)) as unknown,
  }))
}
