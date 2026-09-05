/**
 * Ticket 0207b acceptance tests.
 *
 * 0207 shipped a romance system on top of a social world that stopped at
 * seventeen, and measuring after the fact found the failure: `changedSchool`
 * was `atSchool && stage !== previousStage`, so the year a character graduated
 * it was false, nobody's `inClass` was ever cleared, and `driftPerson` exempts
 * anybody `inClass`. The same five high-school classmates were a character's
 * entire social world at thirty-five — a mean of 4.9 available people at every
 * adult age, none of them met after seventeen.
 *
 * Fixing it produced the opposite failure immediately, and then a third one,
 * both caught by measuring rather than by reasoning:
 *
 *  - adult acquaintances arrive near 28 warmth, drift costs 5.6 a year and the
 *    floor is 22, so every one evaporated within a year: at thirty, the
 *    earliest person a character knew had been met at 29.7;
 *  - once neighbours counted as contact they never left either, so the circle
 *    filled at nineteen and locked — a frozen cast formed two years later.
 *
 * These tests assert the shape that survived all three, loosely enough to tune
 * against and tightly enough that any of the three coming back fails.
 */

import { describe, expect, it } from 'vitest';
import { isCurrent, isFriend } from '@yearafter/social';
import { advanceYear } from './advance';
import { datingAppUsedThisYear, useDatingApp } from './dating';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const LIVES = 80;
const SAMPLE_AGES = [18, 22, 26, 30, 35] as const;

interface Snapshot {
  readonly age: number;
  readonly around: number;
  readonly earliestMetAt: number;
  readonly friends: number;
}

function playALife(seed: string): readonly Snapshot[] {
  let state: GameState = createNewGame({ seed });
  const snapshots: Snapshot[] = [];

  for (let year = 0; year < 36; year += 1) {
    state = advanceYear(state).state;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const answered = decide(state, decision.eventId, choice.id);
      if (!answered.ok) break;
      state = answered.value.state;
    }

    const age = state.player.age;
    if (!SAMPLE_AGES.includes(age as (typeof SAMPLE_AGES)[number])) continue;
    const live = state.circle.people.filter(isCurrent).filter((p) => p.kind === 'peer');
    snapshots.push({
      age,
      around: live.length,
      earliestMetAt: live.length > 0 ? Math.min(...live.map((p) => p.metAtAge)) : age,
      friends: live.filter(isFriend).length,
    });
  }
  return snapshots;
}

const LIVES_PLAYED = Array.from({ length: LIVES }, (_, i) => playALife(`adult-${i}`));
const at = (age: number) => LIVES_PLAYED.flatMap((life) => life.filter((s) => s.age === age));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

describe('an adult has a social life', () => {
  it('does not leave adults with nobody', () => {
    for (const age of SAMPLE_AGES) {
      const rows = at(age);
      expect(rows.length, `no lives reached ${age}`).toBeGreaterThan(20);
      const empty = rows.filter((s) => s.around === 0).length / rows.length;
      expect(empty, `age ${age}: share of lives with nobody at all`).toBeLessThan(0.25);
      expect(mean(rows.map((s) => s.around)), `age ${age}`).toBeGreaterThan(1.5);
    }
  });

  it('does not let the circle churn completely every year', () => {
    // The second failure: everybody evaporating within a year of being met.
    // At thirty, somebody in the circle should have been known for a while.
    const rows = at(30);
    const held = mean(rows.map((s) => 30 - s.earliestMetAt));
    expect(held, 'years since the earliest person still around was met').toBeGreaterThan(3);
  });

  it('does not freeze the circle either', () => {
    // The first and third failures, which look identical from here: if nobody
    // ever leaves, the earliest person known stops moving with age. It has to
    // keep advancing, or the cast is frozen at whatever age it filled.
    const early = mean(at(22).map((s) => s.earliestMetAt));
    const late = mean(at(35).map((s) => s.earliestMetAt));
    expect(late, 'the earliest person known must get more recent as life goes on').toBeGreaterThan(
      early,
    );
    // And specifically: at thirty-five, the circle is not still the class.
    expect(late).toBeGreaterThan(18);
  });

  it('lets school friendships end when school does', () => {
    // The whole class must not still be present after graduation.
    const school = mean(at(18).map((s) => s.around));
    const after = mean(at(26).map((s) => s.around));
    expect(after).toBeLessThan(school + 1);
  });
});

describe('the dating app (spec 1664)', () => {
  const adult = (): GameState => {
    let state = createNewGame({ seed: 'app-life' });
    while (state.player.age < 22) {
      state = advanceYear(state).state;
      let guard = 0;
      while (state.pending.length > 0 && (guard += 1) < 12) {
        const d = state.pending[0];
        const c = d?.choices[0];
        if (!d || !c) break;
        const answered = decide(state, d.eventId, c.id);
        if (!answered.ok) break;
        state = answered.value.state;
      }
    }
    return state;
  };

  it('is not available to a minor', () => {
    const child = createNewGame({ seed: 'app-child' });
    const result = useDatingApp(child);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('too-young');
  });

  it('is once a year', () => {
    const state = adult();
    const first = useDatingApp(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(datingAppUsedThisYear(first.value.state)).toBe(true);
    const second = useDatingApp(first.value.state);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('already-this-year');
  });

  it('often comes back with nobody', () => {
    // An app that always produces somebody is a vending machine. Run it across
    // many seeds and check both outcomes actually happen.
    let empty = 0;
    let found = 0;
    for (let i = 0; i < 60; i += 1) {
      let state = createNewGame({ seed: `app-${i}` });
      while (state.player.age < 22) {
        state = advanceYear(state).state;
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const d = state.pending[0];
          const c = d?.choices[0];
          if (!d || !c) break;
          const answered = decide(state, d.eventId, c.id);
          if (!answered.ok) break;
          state = answered.value.state;
        }
      }
      const result = useDatingApp(state);
      if (!result.ok) continue;
      if (result.value.met.length === 0) empty += 1;
      else found += 1;
    }
    expect(empty, 'a month that came to nothing must be a real outcome').toBeGreaterThan(5);
    expect(found, 'and so must meeting somebody').toBeGreaterThan(5);
  });

  it('writes a line either way, and never an empty one', () => {
    for (let i = 0; i < 40; i += 1) {
      let state = createNewGame({ seed: `app-text-${i}` });
      while (state.player.age < 24) {
        state = advanceYear(state).state;
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const d = state.pending[0];
          const c = d?.choices[0];
          if (!d || !c) break;
          const answered = decide(state, d.eventId, c.id);
          if (!answered.ok) break;
          state = answered.value.state;
        }
      }
      const result = useDatingApp(state);
      if (!result.ok) continue;
      const text = result.value.entry.text;
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toContain('{');
      expect(text).not.toContain('undefined');
      // A line naming somebody must name somebody who exists.
      for (const person of result.value.met) {
        expect(result.value.state.circle.people.some((p) => p.id === person.id)).toBe(true);
      }
    }
  });
});
