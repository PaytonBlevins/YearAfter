/**
 * Ticket 0003 — Result.
 *
 * Spec 1224–1246: expected gameplay failures (a denied mortgage, a rejected
 * audition, an unaffordable purchase) are typed results, not thrown exceptions.
 * Exceptions are reserved for engineering bugs.
 */

export type Result<T, E = string> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } => !result.ok;

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Attempted to unwrap a failed Result: ${JSON.stringify(result.error)}`);
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}
