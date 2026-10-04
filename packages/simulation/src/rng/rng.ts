/**
 * Ticket 0004 — Centralised seeded RNG.
 *
 * PROTECTED CONTRACT (spec 1060–1066). Changes here require product-owner approval.
 *
 * Spec 1224–1246: `Math.random()` is forbidden in game logic. Every random draw
 * goes through a named domain stream so that:
 *   - a save replays identically from its seed;
 *   - adding randomness to one system does not shift the sequence another system
 *     sees (a bug that silently rebalances the whole game);
 *   - time reversal (spec 1108–1140) can branch future randomness deliberately.
 *
 * Algorithm: sfc32, seeded through splitmix32. Fast, tiny, statistically sound
 * for gameplay, and its whole state is four uint32s — cheap to store in a save.
 */

export interface RngState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

export interface WeightedOption<T> {
  readonly value: T;
  /** Relative weight. Must be finite and >= 0. Zero means "never chosen". */
  readonly weight: number;
}

/*
  Ticket 0212 moved both of these into `@yearafter/core`, and they are
  re-exported here so no call site had to change.

  The reason is in `core/src/stable.ts`: `@yearafter/health` needed the same
  stable draw, a domain package may never import the simulation package, and
  copying the hash would have left two implementations that have to agree about
  which sentence describes a dead man.
*/
import { hashSeed } from '@yearafter/core';
export { hashSeed, stablePick, stableUnit } from '@yearafter/core';

/** splitmix32 — expands one uint32 into a well-distributed state vector. */
function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
  };
}

export function createRngState(seed: string): RngState {
  const next = splitmix32(hashSeed(seed));
  return { a: next(), b: next(), c: next(), d: next() };
}

/**
 * A single deterministic random stream.
 *
 * Never construct this directly in gameplay code — take a stream from the
 * `Rng` registry so the domain name is recorded and reproducible.
 */
export class RandomStream {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    this.a = state.a >>> 0;
    this.b = state.b >>> 0;
    this.c = state.c >>> 0;
    this.d = state.d >>> 0;
  }

  /** Serialisable state, for writing into a save. */
  getState(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  /** Next float in [0, 1). The single primitive every other method builds on. */
  next(): number {
    // sfc32
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t / 4294967296;
  }

  /**
   * True with the given probability. Probability is clamped into [0, 1]
   * (spec 1224–1246) rather than throwing, because callers routinely build
   * probabilities from stacked modifiers.
   */
  chance(probability: number): boolean {
    if (Number.isNaN(probability)) {
      throw new TypeError('chance() received NaN');
    }
    const clamped = probability < 0 ? 0 : probability > 1 ? 1 : probability;
    if (clamped === 0) return false;
    if (clamped === 1) return true;
    return this.next() < clamped;
  }

  /** Integer in [minimum, maximum], inclusive on both ends. */
  range(minimum: number, maximum: number): number {
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum)) {
      throw new TypeError(`range() requires integers, received ${minimum}..${maximum}`);
    }
    if (minimum > maximum) {
      throw new RangeError(`range() received an inverted range: ${minimum} > ${maximum}`);
    }
    return minimum + Math.floor(this.next() * (maximum - minimum + 1));
  }

  /** Float in [minimum, maximum). */
  float(minimum: number, maximum: number): number {
    if (minimum > maximum) {
      throw new RangeError(`float() received an inverted range: ${minimum} > ${maximum}`);
    }
    return minimum + this.next() * (maximum - minimum);
  }

  /** Uniform pick from a non-empty list. */
  pick<T>(values: readonly T[]): T {
    if (values.length === 0) {
      throw new RangeError('pick() received an empty list');
    }
    return values[this.range(0, values.length - 1)] as T;
  }

  /**
   * Weighted pick. The backbone of the event engine (spec 725–770) and of every
   * rarity tier from common through legendary.
   */
  weightedChoice<T>(options: readonly WeightedOption<T>[]): T {
    if (options.length === 0) {
      throw new RangeError('weightedChoice() received an empty list');
    }
    let total = 0;
    for (const option of options) {
      if (!Number.isFinite(option.weight) || option.weight < 0) {
        throw new RangeError(`weightedChoice() received an invalid weight: ${option.weight}`);
      }
      total += option.weight;
    }
    if (total <= 0) {
      throw new RangeError('weightedChoice() requires at least one option with weight > 0');
    }
    let roll = this.next() * total;
    for (const option of options) {
      roll -= option.weight;
      if (roll < 0) return option.value;
    }
    // Floating point residue only: fall back to the last option with weight.
    for (let i = options.length - 1; i >= 0; i -= 1) {
      const option = options[i] as WeightedOption<T>;
      if (option.weight > 0) return option.value;
    }
    throw new Error('weightedChoice() failed to select an option');
  }

  /** In-place-safe Fisher-Yates shuffle returning a new array. */
  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = this.range(0, i);
      const a = result[i] as T;
      const b = result[j] as T;
      result[i] = b;
      result[j] = a;
    }
    return result;
  }

  /**
   * Roughly normal draw via the mean of four uniforms, clamped to the range.
   * Used for outcome distributions that should cluster around a centre —
   * salaries within a band, performance-career results (spec 979–1030).
   */
  /**
   * A draw clustered toward the middle of a band.
   *
   * `draws` is how many uniform samples are averaged, and it IS the spread
   * control: the mean of n uniforms has a standard deviation of
   * `1 / (sqrt(12n))` of the range, so four draws gives 0.144 of the band and
   * two gives 0.204. Ticket 0408 made it a parameter after measuring what four
   * was doing to the population — see `BIRTH_ATTRIBUTE_SPREAD`.
   */
  aroundCentre(minimum: number, maximum: number, draws = 4): number {
    let total = 0;
    for (let i = 0; i < draws; i += 1) total += this.next();
    return minimum + (total / draws) * (maximum - minimum);
  }
}

/**
 * The RNG registry for one save.
 *
 * Streams are created lazily per domain name and derived from the master seed,
 * so `stream('events')` returns the same sequence regardless of what other
 * systems have drawn.
 */
export class Rng {
  private readonly streams = new Map<string, RandomStream>();

  constructor(private readonly seed: string) {}

  getSeed(): string {
    return this.seed;
  }

  stream(domain: RngDomain | (string & {})): RandomStream {
    const existing = this.streams.get(domain);
    if (existing) return existing;
    const created = new RandomStream(createRngState(`${this.seed}::${domain}`));
    this.streams.set(domain, created);
    return created;
  }

  /** Serialise every live stream for the save file. */
  snapshot(): RngSnapshot {
    const streams: Record<string, RngState> = {};
    for (const [domain, stream] of this.streams) {
      streams[domain] = stream.getState();
    }
    return { seed: this.seed, streams };
  }

  static restore(snapshot: RngSnapshot): Rng {
    const rng = new Rng(snapshot.seed);
    for (const [domain, state] of Object.entries(snapshot.streams)) {
      rng.streams.set(domain, new RandomStream(state));
    }
    return rng;
  }
}

export interface RngSnapshot {
  readonly seed: string;
  readonly streams: Record<string, RngState>;
}

/**
 * Known domain streams. Adding a domain here is cheap and keeps stream names
 * from drifting as string literals across the codebase.
 */
export const RngDomains = {
  CharacterGeneration: 'character-generation',
  Talents: 'talents',
  Events: 'events',
  Family: 'family',
  Relationships: 'relationships',
  Health: 'health',
  Education: 'education',
  Careers: 'careers',
  Finance: 'finance',
  Economy: 'economy',
  Assets: 'assets',
  Business: 'business',
  Creators: 'creators',
  Sports: 'sports',
  Crime: 'crime',
  World: 'world',
  /**
   * Ticket 0416. Adult pursuits and the sign-up door — its own stream so a
   * league joined or dropped never moves who a character meets, what they
   * earn or whether they fall ill. The real rolls it hands off to (a tryout, a
   * parent paying) still draw from their own domains, as they would from a tap.
   */
  Pursuits: 'pursuits',
} as const;

export type RngDomain = (typeof RngDomains)[keyof typeof RngDomains];

/** Generate a fresh save seed. This is the one place entropy legitimately enters. */
export function generateSeed(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let seed = '';
  for (let i = 0; i < 12; i += 1) {
    seed += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return seed;
}
