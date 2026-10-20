import { ValidationError } from '../schema.js'

export type ErrorCode =
  | 'usage'
  | 'validation'
  | 'unknown_command'
  | 'unknown_action'
  | 'unavailable'
  | 'precheck'
  | 'not_found'
  | 'forbidden'
  | 'conflict'
  | 'timeout'
  | 'internal'

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message)
  }
}

/** Exit codes: 0 ok, 1 bad input, 2 not found, 3 proposed, 4 refused, 5 timeout, 6 not allowed, 70 bug. */
export const EXIT = { ok: 0, input: 1, notFound: 2, proposed: 3, refused: 4, timeout: 5, forbidden: 6, internal: 70 } as const

export function exitCodeOf(code: ErrorCode): number {
  switch (code) {
    case 'usage':
    case 'validation':
    case 'unknown_command':
    case 'unknown_action':
      return EXIT.input
    case 'not_found':
      return EXIT.notFound
    case 'unavailable':
    case 'precheck':
      return EXIT.refused
    case 'timeout':
      return EXIT.timeout
    case 'forbidden':
    case 'conflict':
      return EXIT.forbidden
    case 'internal':
      return EXIT.internal
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  if (e instanceof ValidationError) return new AppError('validation', e.message, e.details)
  return new AppError('internal', (e as Error)?.message ?? String(e))
}
