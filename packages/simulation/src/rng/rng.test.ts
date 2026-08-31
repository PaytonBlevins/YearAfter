import { describe, expect, it } from 'vitest';
import { RandomStream, Rng, RngDomains, createRngState } from './rng';

const streamFor = (seed: string) => new RandomStream(createRngState(seed));

describe('RandomStream reproducibility', () => {
  it('produces an identical sequence for an identical seed', () => {
    const a = streamFor('SEED-A');
    const b = streamFor('SEED-A');
    const first = Array.from({ length: 200 }, () => a.next());
    const second = Array.from({ length: 200 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('produces a different sequence for a different seed', () => {
    const a = Array.from({ length: 50 }, () => streamFor('SEED-A').next());
    const b = Array.from({ length: 50 }, () => streamFor('SEED-B').next());
    expect(a).not.toEqual(b);
  });

  it('resumes exactly from a serialised state', () => {
    const original = streamFor('RESUME');
    for (let i = 0; i < 37; i += 1) original.next();
    const resumed = new RandomStream(original.getState());
    const fromOriginal = Array.from({ length: 20 }, () => original.next());
    const fromResumed = Array.from({ length: 20 }, () => resumed.next());
    expect(fromResumed).toEqual(fromOriginal);
  });

  it('stays inside [0, 1)', () => {
    const stream = streamFor('BOUNDS');
    for (let i = 0; i < 5000; i += 1) {
      const value = stream.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('chance', () => {
  it('treats 0 and 1 as certainties without consuming bias', () => {
    const stream = streamFor('CERTAIN');
    expect(stream.chance(0)).toBe(false);
    expect(stream.chance(1)).toBe(true);
    expect(stream.chance(-5)).toBe(false);
    expect(stream.chance(5)).toBe(true);
  });

  it('lands near the requested probability over many trials', () => {
    const stream = streamFor('CHANCE');
    let hits = 0;
    const trials = 100_000;
    for (let i = 0; i < trials; i += 1) {
      if (stream.chance(0.25)) hits += 1;
    }
    expect(hits / trials).toBeGreaterThan(0.24);
    expect(hits / trials).toBeLessThan(0.26);
  });

  it('rejects NaN rather than silently rolling', () => {
    expect(() => streamFor('NAN').chance(Number.NaN)).toThrow(TypeError);
  });
});

describe('range', () => {
  it('is inclusive on both ends and covers them', () => {
    const stream = streamFor('RANGE');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const value = stream.range(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
  });

  it('handles a single-value range', () => {
    expect(streamFor('ONE').range(4, 4)).toBe(4);
  });

  it('rejects non-integers and inverted ranges', () => {
    const stream = streamFor('BAD');
    expect(() => stream.range(1.5, 3)).toThrow(TypeError);
    expect(() => stream.range(9, 2)).toThrow(RangeError);
  });
});

describe('weightedChoice', () => {
  it('respects the weights', () => {
    const stream = streamFor('WEIGHTS');
    const counts = { common: 0, rare: 0 };
    const trials = 100_000;
    for (let i = 0; i < trials; i += 1) {
      const value = stream.weightedChoice([
        { value: 'common' as const, weight: 90 },
        { value: 'rare' as const, weight: 10 },
      ]);
      counts[value] += 1;
    }
    expect(counts.rare / trials).toBeGreaterThan(0.09);
    expect(counts.rare / trials).toBeLessThan(0.11);
  });

  it('never selects a zero-weight option', () => {
    const stream = streamFor('ZERO-WEIGHT');
    for (let i = 0; i < 5000; i += 1) {
      const value = stream.weightedChoice([
        { value: 'yes', weight: 1 },
        { value: 'never', weight: 0 },
      ]);
      expect(value).toBe('yes');
    }
  });

  it('rejects empty, all-zero and negative weight sets', () => {
    const stream = streamFor('INVALID');
    expect(() => stream.weightedChoice([])).toThrow(RangeError);
    expect(() => stream.weightedChoice([{ value: 'a', weight: 0 }])).toThrow(RangeError);
    expect(() => stream.weightedChoice([{ value: 'a', weight: -1 }])).toThrow(RangeError);
  });
});

describe('pick and shuffle', () => {
  it('picks only from the supplied list and rejects an empty one', () => {
    const stream = streamFor('PICK');
    const values = ['a', 'b', 'c'];
    for (let i = 0; i < 200; i += 1) {
      expect(values).toContain(stream.pick(values));
    }
    expect(() => stream.pick([])).toThrow(RangeError);
  });

  it('shuffles without mutating the source or losing elements', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const stream = streamFor('SHUFFLE');
    const shuffled = stream.shuffle(source);
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source);
  });
});

describe('Rng domain streams', () => {
  it('isolates domains so one system cannot shift another', () => {
    const first = new Rng('SAVE-1');
    const eventsAlone = Array.from({ length: 10 }, () => first.stream(RngDomains.Events).next());

    // A second save draws heavily from finance before touching events.
    const second = new Rng('SAVE-1');
    for (let i = 0; i < 1000; i += 1) second.stream(RngDomains.Finance).next();
    const eventsAfterFinance = Array.from({ length: 10 }, () =>
      second.stream(RngDomains.Events).next(),
    );

    expect(eventsAfterFinance).toEqual(eventsAlone);
  });

  it('gives different domains different sequences', () => {
    const rng = new Rng('SAVE-2');
    const events = Array.from({ length: 10 }, () => rng.stream(RngDomains.Events).next());
    const health = Array.from({ length: 10 }, () => rng.stream(RngDomains.Health).next());
    expect(events).not.toEqual(health);
  });

  it('returns the same stream instance for a domain', () => {
    const rng = new Rng('SAVE-3');
    expect(rng.stream(RngDomains.Careers)).toBe(rng.stream(RngDomains.Careers));
  });

  it('round-trips through a snapshot', () => {
    const rng = new Rng('SAVE-4');
    for (let i = 0; i < 25; i += 1) rng.stream(RngDomains.Crime).next();
    for (let i = 0; i < 5; i += 1) rng.stream(RngDomains.World).next();

    const restored = Rng.restore(rng.snapshot());
    expect(restored.getSeed()).toBe('SAVE-4');
    expect(restored.stream(RngDomains.Crime).next()).toBe(rng.stream(RngDomains.Crime).next());
    expect(restored.stream(RngDomains.World).next()).toBe(rng.stream(RngDomains.World).next());
  });
});
