import { describe, expect, it } from 'vitest';
import { advanceYear } from './advance';
import { createNewGame } from './new-game';

describe('advanceYear', () => {
  it('advances age and world year by exactly one', () => {
    const start = createNewGame({ seed: 'ADVANCE', startYear: 2000 });
    const { state } = advanceYear(start);
    expect(state.player.age).toBe(1);
    expect(state.world.year).toBe(2001);
  });

  it('does not mutate the input state', () => {
    const start = createNewGame({ seed: 'IMMUTABLE' });
    const before = start.player.timeline.length;
    advanceYear(start);
    expect(start.player.age).toBe(0);
    expect(start.player.timeline.length).toBe(before);
  });

  it('appends at least one timeline entry stamped with the new age and year', () => {
    const start = createNewGame({ seed: 'FEED', startYear: 2010 });
    const { state, newEntries } = advanceYear(start);
    expect(newEntries.length).toBeGreaterThan(0);
    expect(state.player.timeline.length).toBe(newEntries.length);
    for (const entry of newEntries) {
      expect(entry.age).toBe(1);
      expect(entry.year).toBe(2011);
      expect(entry.text.length).toBeGreaterThan(0);
    }
  });

  it('keeps the timeline in chronological order across many years', () => {
    let state = createNewGame({ seed: 'CHRONO', startYear: 1980 });
    for (let i = 0; i < 60; i += 1) {
      state = advanceYear(state).state;
    }
    expect(state.player.age).toBe(60);
    expect(state.world.year).toBe(2040);

    const ages = state.player.timeline.map((entry) => entry.age);
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
    for (const entry of state.player.timeline) {
      expect(entry.year).toBe(1980 + entry.age);
    }
  });

  it('replays identically from the same seed — the golden life check', () => {
    const run = (seed: string) => {
      let state = createNewGame({ seed, startYear: 2000 });
      for (let i = 0; i < 40; i += 1) state = advanceYear(state).state;
      return state.player.timeline.map((entry) => `${entry.age}|${entry.text}`);
    };
    expect(run('GOLDEN')).toEqual(run('GOLDEN'));
    expect(run('GOLDEN')).not.toEqual(run('GOLDEN-2'));
  });

  it('is a no-op once the character has died', () => {
    const start = createNewGame({ seed: 'DEAD' });
    const dead = { ...start, player: { ...start.player, alive: false } };
    const { state, newEntries } = advanceYear(dead);
    expect(state).toBe(dead);
    expect(newEntries).toHaveLength(0);
  });

  it('processes an ordinary lifetime well inside the performance budget', () => {
    // Spec 1247-1263: annual processing should stay near-instant.
    const started = performance.now();
    let state = createNewGame({ seed: 'PERF', startYear: 1950 });
    for (let i = 0; i < 80; i += 1) state = advanceYear(state).state;
    const perYear = (performance.now() - started) / 80;
    expect(perYear).toBeLessThan(250);
  });
});
