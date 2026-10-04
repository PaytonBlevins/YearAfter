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
 * Ticket 0501. `stableUnit`, with the bits mixed before they are read.
 *
 * FNV-1a is a fine hash and a poor random number when keys differ only at the
 * END. The last character is XORed in and multiplied once, so two keys that
 * differ by one in their final digit land a small multiple of the prime apart
 * — and the high bits, which are what dividing by 2^32 reads, barely move.
 * Measured on `housing:${year}`: the values for 2060–2080 were all near 0.95,
 * the housing market rose 6–7% a year for twenty straight years, and a flat
 * bought for $290,000 was worth $1.98 million at eighty-four.
 *
 * Murmur3's finaliser avalanches every input bit into every output bit, so
 * sequential keys come out independent. `stableUnit` itself is left exactly as
 * it is: every NPC's constitution, every copy rotation and every employer name
 * in every existing save is keyed on it, and changing it would silently
 * rewrite them all. See roadmap finding 8 for the callers worth auditing.
 */
export function mixedUnit(key: string): number {
  let h = hashSeed(key);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

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
