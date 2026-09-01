import { describe, expect, it } from 'vitest';
import { activityOffers, join, leave } from '@yearafter/education';
import { isStressRelevant } from '@yearafter/stress';
import { advanceYear } from './advance';
import { study } from './study';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

/**
 * Play `years` of a life, answering every decision with its first option.
 *
 * A life cannot be simulated forward without answering: a pending decision
 * blocks time deliberately (see `advanceYear`). Every test that runs a life
 * therefore has to be able to answer, which is a good property for the tests to
 * be forced to encode.
 */
function play(state: GameState, years: number): GameState {
  let current = state;
  for (let i = 0; i < years; i += 1) {
    current = advanceYear(current).state;
    current = answerAll(current);
  }
  return current;
}

function answerAll(state: GameState): GameState {
  let current = state;
  let guard = 0;
  while (current.pending.length > 0) {
    if ((guard += 1) > 10) throw new Error('decisions did not clear');
    const decision = current.pending[0];
    if (!decision) break;
    const choice = decision.choices[0];
    if (!choice) throw new Error(`decision ${decision.eventId} had no choices`);
    const result = decide(current, decision.eventId, choice.id);
    if (!result.ok) throw new Error(`could not answer ${decision.eventId}: ${result.error}`);
    current = result.value.state;
  }
  return current;
}

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
    const state = play(createNewGame({ seed: 'CHRONO', startYear: 1980 }), 60);
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
      const state = play(createNewGame({ seed, startYear: 2000 }), 40);
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

  it('refuses to advance past an unanswered decision', () => {
    // Advancing would either discard the question or answer it for the player.
    let state = createNewGame({ seed: 'BLOCK', startYear: 2000 });
    for (let i = 0; i < 30 && state.pending.length === 0; i += 1) {
      state = advanceYear(state).state;
    }
    expect(state.pending.length).toBeGreaterThan(0);

    const blocked = advanceYear(state);
    expect(blocked.state).toBe(state);
    expect(blocked.newEntries).toHaveLength(0);
  });

  it('processes an ordinary lifetime well inside the performance budget', () => {
    // Spec 1247-1263: annual processing should stay near-instant.
    const started = performance.now();
    play(createNewGame({ seed: 'PERF', startYear: 1950 }), 80);
    const perYear = (performance.now() - started) / 80;
    expect(perYear).toBeLessThan(250);
  });
});

describe('the event phase (Ticket 0203)', () => {
  it('replaced the placeholder feed with catalog events', () => {
    const { newEntries } = advanceYear(createNewGame({ seed: 'CATALOG', startYear: 2000 }));
    for (const entry of newEntries) {
      expect(entry.eventId, entry.text).toBeDefined();
    }
  });

  it('never renders an unresolved text token to the player', () => {
    // The catalog test proves the tokens are guaranteed; this proves the wiring
    // between household state and the renderer actually passes them through.
    for (let i = 0; i < 40; i += 1) {
      const state = play(createNewGame({ seed: `TOKEN-${i}`, startYear: 2000 }), 18);
      for (const entry of state.player.timeline) {
        expect(entry.text, `${entry.age}: ${entry.text}`).not.toMatch(/[{}]/);
      }
    }
  });

  it('gives a childhood several events a year without flooding it', () => {
    let total = 0;
    let worstYear = 0;
    for (let i = 0; i < 25; i += 1) {
      const state = play(createNewGame({ seed: `PACE-${i}`, startYear: 2000 }), 18);
      total += state.player.timeline.length;
      for (let age = 1; age <= 18; age += 1) {
        worstYear = Math.max(
          worstYear,
          state.player.timeline.filter((entry) => entry.age === age).length,
        );
      }
    }
    const perLife = total / 25;
    expect(perLife).toBeGreaterThan(25);
    // Spec 725-770: busy characters should not be bombarded.
    expect(worstYear).toBeLessThanOrEqual(7);
  });

  it('does not repeat a once-per-life event within a life', () => {
    for (let i = 0; i < 20; i += 1) {
      const state = play(createNewGame({ seed: `REPEAT-${i}`, startYear: 2000 }), 18);
      const counts = new Map<string, number[]>();
      for (const entry of state.player.timeline) {
        if (!entry.eventId) continue;
        const ages = counts.get(entry.eventId) ?? [];
        ages.push(entry.age);
        counts.set(entry.eventId, ages);
      }
      for (const [eventId, ages] of counts) {
        // A repeat is only legal via a cooldown, and never inside the same year.
        expect(new Set(ages).size, `${eventId} repeated in one year`).toBe(ages.length);
      }
    }
  });

  it('moves stats and family warmth as events land', () => {
    const start = createNewGame({ seed: 'MOVES', startYear: 2000 });
    const after = play(start, 18);
    const statsMoved = Object.keys(start.player.stats).some(
      (key) =>
        start.player.stats[key as keyof typeof start.player.stats] !==
        after.player.stats[key as keyof typeof after.player.stats],
    );
    expect(statsMoved).toBe(true);
    expect(after.player.stats.happiness).toBeGreaterThanOrEqual(0);
    expect(after.player.stats.happiness).toBeLessThanOrEqual(100);
  });

  it('carries event history into the state so cooldowns survive a year boundary', () => {
    const state = play(createNewGame({ seed: 'HISTORY', startYear: 2000 }), 10);
    expect(Object.keys(state.events.lastFired).length).toBeGreaterThan(10);
  });

  it('keeps the family alive and intact through a childhood', () => {
    const start = createNewGame({ seed: 'FAMILY', startYear: 2000 });
    const after = play(start, 18);
    expect(after.family.members.map((m) => m.id)).toEqual(start.family.members.map((m) => m.id));
  });

  it('uses only the Events stream, so event tuning cannot shift the character', () => {
    const a = createNewGame({ seed: 'ISOLATION' });
    const b = createNewGame({ seed: 'ISOLATION' });
    play(b, 12);
    const c = createNewGame({ seed: 'ISOLATION' });
    expect(c.player.talents).toEqual(a.player.talents);
    expect(c.family.members.map((m) => m.firstName)).toEqual(
      a.family.members.map((m) => m.firstName),
    );
  });
});

describe('childhood balance', () => {
  /**
   * A regression guard on the shape of a childhood, not on any single number.
   *
   * The first version of the event phase applied stat deltas at face value, and
   * every character arrived at eighteen with happiness pinned at 100 and +20 on
   * four other bars. Nothing failed; the game was just flat. These bounds are
   * deliberately wide — they catch a catalog edit that breaks the shape, not one
   * that shifts a number.
   */
  const LIVES = 60;

  function childhoods() {
    const finals: number[][] = [];
    for (let i = 0; i < LIVES; i += 1) {
      const state = play(createNewGame({ seed: `BALANCE-${i}`, startYear: 2000 }), 18);
      finals.push([
        state.player.stats.happiness,
        state.player.stats.health,
        state.player.stats.smarts,
        state.player.stats.looks,
        state.player.stats.charisma,
        state.player.stats.willpower,
        state.player.stats.discipline,
      ]);
    }
    return finals;
  }

  it('does not leave a childhood with a maxed-out stat bar', () => {
    const maxed = childhoods()
      .flat()
      .filter((value) => value >= 100).length;
    expect(maxed).toBe(0);
  });

  it('still produces characters who differ from each other', () => {
    // The other failure mode: damp the curve until everyone lands on 60.
    const happiness = childhoods().map((stats) => stats[0]!);
    const spread = Math.max(...happiness) - Math.min(...happiness);
    expect(spread).toBeGreaterThan(20);
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0205 — Study Harder, and stress                                      */
/* -------------------------------------------------------------------------- */

describe('Study Harder', () => {
  const atSchool = (seed: string, toAge: number): GameState => {
    let state = createNewGame({ seed });
    for (let age = 1; age <= toAge; age += 1) {
      state = answerAll(advanceYear(state).state);
    }
    return state;
  };

  it('is refused before school and allowed once inside it', () => {
    const toddler = atSchool('SH-EARLY', 3);
    expect(study(toddler).ok).toBe(false);
    const pupil = atSchool('SH-EARLY', 10);
    expect(study(pupil).ok).toBe(true);
  });

  it('can only be pressed once a school year', () => {
    const state = atSchool('SH-ONCE', 12);
    const first = study(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = study(first.value.state);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe('already-studied');
    // Next year it is available again.
    const nextYear = answerAll(advanceYear(first.value.state).state);
    expect(study(nextYear).ok).toBe(true);
  });

  it('boosts grades most of the time, and says so either way', () => {
    // Review: "it potentially (most of the time) boosts their grades."
    let worked = 0;
    let attempts = 0;
    for (let life = 0; life < 60; life += 1) {
      const state = atSchool(`SH-${life}`, 12);
      const result = study(state);
      if (!result.ok) continue;
      attempts += 1;
      if (result.value.worked) worked += 1;
      expect(result.value.gained).toBeGreaterThan(0);
      expect(result.value.entry.text.length).toBeGreaterThan(0);
    }
    expect(attempts).toBeGreaterThan(50);
    expect(worked / attempts).toBeGreaterThan(0.55);
    expect(worked / attempts).toBeLessThan(0.95);
  });

  it('makes the character somebody who studies, for good', () => {
    const state = atSchool('SH-EFFORT', 11);
    const result = study(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.education.effort).toBe('hard');
  });
});

describe('stress', () => {
  it('never quietly taxes an ordinary childhood', () => {
    // The system has no screen. If it charged happiness for a childhood with
    // nothing wrong in it, the player would watch a bar fall for no reason they
    // could ever discover.
    let taxed = 0;
    for (let life = 0; life < 80; life += 1) {
      let state = createNewGame({ seed: `SQ-${life}` });
      for (let age = 1; age <= 10; age += 1) state = answerAll(advanceYear(state).state);
      if (isStressRelevant(state.player.stress.level)) taxed += 1;
    }
    // A hard childhood is allowed. A majority of hard childhoods is a bug.
    expect(taxed / 80).toBeLessThan(0.25);
  });

  it('is reachable by taking on too much, which is the whole design', () => {
    // Spec 1986: "Players may overcommit rather than being blocked." A model
    // nobody can trigger is not a model — 0204's overload never once fired
    // across 3,400 simulated years, which is why stress reads pressure instead.
    let state = createNewGame({ seed: 'BUSY' });
    for (let age = 1; age <= 12; age += 1) state = answerAll(advanceYear(state).state);
    for (const offer of activityOffers(state.education, {
      age: state.player.age,
      stage: 'middle',
      stats: state.player.stats,
      talents: state.player.talents,
      wealth: state.family.finances.band,
      household: state.family,
    })) {
      if (!offer.unavailable) {
        state = { ...state, education: join(state.education, offer.activity.id, state.player.age) };
      }
    }
    state = answerAll(advanceYear(state).state);
    expect(isStressRelevant(state.player.stress.level)).toBe(true);
  });

  it('lets a character come out the other side', () => {
    let state = createNewGame({ seed: 'RECOVER' });
    for (let age = 1; age <= 12; age += 1) state = answerAll(advanceYear(state).state);
    for (const offer of activityOffers(state.education, {
      age: state.player.age,
      stage: 'middle',
      stats: state.player.stats,
      talents: state.player.talents,
      wealth: state.family.finances.band,
      household: state.family,
    })) {
      if (!offer.unavailable) {
        state = { ...state, education: join(state.education, offer.activity.id, state.player.age) };
      }
    }
    state = answerAll(advanceYear(state).state);
    const peak = state.player.stress.level;
    expect(peak).toBeGreaterThan(0);
    for (const entry of state.education.activities) {
      state = { ...state, education: leave(state.education, entry.activityId) };
    }
    for (let year = 0; year < 3; year += 1) state = answerAll(advanceYear(state).state);
    expect(state.player.stress.level).toBeLessThan(peak);
  });
});
