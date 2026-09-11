/**
 * A stable draw in [0, 1) from a string, without touching any RNG stream.
 *
 * THIS LIVES IN CORE BECAUSE TWO PACKAGES NEEDED IT.
 *
 * It began in `@yearafter/simulation`'s `rng.ts`, where it is used to pick a
 * line of copy by a key that never changes — the same person is described the
 * same way on every load, and no stream is shifted by asking. Ticket 0212 needed
 * exactly that in `@yearafter/health`, for an NPC's constitution and for which
 * of six causes of death is theirs.
 *
 * A domain package may never import `@yearafter/simulation` — that rule has
 * held since Sprint Zero and is what keeps the simulation from leaking into the
 * models. The first version of 0212 therefore COPIED eight lines of hashing into
 * the health package, with a comment explaining that duplicating it was the
 * cheaper wrong. It was not: an invariant kept in two places is two promises
 * (CORE_RULES 13.31), and the promise here is that two packages agree about
 * which sentence describes a dead man. One of the two copies would eventually
 * have been "improved".
 *
 * So it lives here, where everything already depends on it, and `rng.ts`
 * re-exports it so no call site had to move.
 */

/** FNV-1a. Hash an arbitrary string into a uint32. */
export function hashSeed(seed: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** A stable [0, 1) from a key. Consumes no RNG state, so it shifts nothing. */
export const stableUnit = (key: string): number => hashSeed(key) / 4294967296;

/**
 * Pick one of `options` by a key that never changes.
 *
 * The shape every caller actually wanted. CORE_RULES 13.17 asks repeatable copy
 * for more lines than repeats AND a stable index; this is the index, and having
 * it in one place means the next writer gets it right by reaching for it.
 */
export function stablePick<T>(options: readonly T[], key: string): T | undefined {
  if (options.length === 0) return undefined;
  return options[Math.floor(stableUnit(key) * options.length) % options.length];
}
