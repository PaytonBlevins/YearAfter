/**
 * Ticket 0415 acceptance tests — what the rest of a life does to you.
 *
 * Roadmap finding 2c said study, a hobby, raising a child and being ill change
 * nobody in adulthood. Measured on 192 lives, paired per life from twenty-five
 * to fifty, raising a young child for eight years and being seriously ill for
 * five both left a person where they would have been anyway (discipline −3.0
 * against −2.8; willpower +12.2 against +12.9) — and five years running on empty
 * left them with MORE willpower than a calm life, +15.7 against +11.9.
 *
 * And measuring that found the larger thing. Willpower, the stat that decides
 * how hard a year lands, was a one-way ratchet in adulthood — seventy-one sites
 * in the adult catalog, every one a gain, three quarters of them added by 0409,
 * 0413 and 0414, often on the outcome where the hard thing did NOT work:
 *
 * | willpower | 18 | 30 | 45 | 60 |
 * |---|---|---|---|---|
 * | p10 / median / p90 | 54/71/85 | 67/79/89 | 78/88/92 | **88/92/94** |
 * | sd | 11.4 | 8.6 | 5.3 | **2.8** |
 *
 * Nobody's willpower fell between eighteen and forty-five — not one life in a
 * hundred and fifty. That is 0411's Charisma collapse again, on the one stat
 * 0411 did not list.
 */

import { describe, expect, it, vi } from 'vitest';
import * as shaping from './shaping';
import { findCondition } from '@yearafter/health';
import { childrenAtHome } from '@yearafter/parenting';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { FRAYS, ROUTINE_YEARS, lifeShaping, strained } from './shaping';
import { createNewGame } from './new-game';

const LIVES = 150;
const TRAITS = ['smarts', 'looks', 'charisma', 'willpower', 'discipline'] as const;
type Trait = (typeof TRAITS)[number];

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

interface YearRow {
  readonly age: number;
  readonly traits: Readonly<Record<Trait, number>>;
  readonly willpowerMoved: number;
  readonly strainedTwice: boolean;
  readonly calm: boolean;
  /** A small child at home this year. */
  readonly smallChild: boolean;
  /** Years 1–6 of a serious or grave condition, and the willpower going in. */
  readonly learningToLiveWith?: number;
}

function playALife(seed: string): readonly YearRow[] {
  let state: GameState = createNewGame({ seed });
  const rows: YearRow[] = [];
  let guard = 0;
  while (state.player.alive && (guard += 1) < 110) {
    const before = state;
    state = answerEverything(advanceYear(state).state);
    const age = state.player.age;
    if (age === 25) STARTS.set(seed, state);
    if (age >= 18 && age % 7 === 0) SAMPLES.push(state);
    const serious = state.health.conditions.find(
      (held) => findCondition(held.conditionId)?.severity !== 'minor',
    );
    const held = serious ? age - serious.since : -1;
    const traits = {} as Record<Trait, number>;
    for (const trait of TRAITS) traits[trait] = Number(state.player.stats[trait]);
    rows.push({
      age,
      traits,
      willpowerMoved: traits.willpower - Number(before.player.stats.willpower),
      strainedTwice:
        strained(Number(before.player.stress.level)) && strained(Number(state.player.stress.level)),
      calm:
        !strained(Number(before.player.stress.level)) &&
        !strained(Number(state.player.stress.level)),
      smallChild: childrenAtHome(state.family, state.world.year).some(
        (child) => state.world.year - child.birthYear < 6,
      ),
      ...(held >= 1 && held <= 6
        ? { learningToLiveWith: Number(before.player.stats.willpower) }
        : {}),
    });
  }
  return rows;
}

const STARTS = new Map<string, GameState>();
const SAMPLES: GameState[] = [];
const PLAYED = Array.from({ length: LIVES }, (_, i) => playALife(`shaped-${i}`));
const ALL = PLAYED.flat();
const ADULT = ALL.filter((row) => row.age >= 18);
const at = (age: number) => ALL.filter((row) => row.age === age);
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: readonly number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const pctile = (xs: number[], p: number) => {
  const sorted = xs.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
};

describe('0415 — what the rest of a life does to you', () => {
  it('lets no trait collapse with age', () => {
    /*
      THE CLASS, not the instance (13.72). Willpower collapsed to sd 2.8 by
      sixty; 0411 found Charisma doing the same at 3.8 and fixed Charisma. So
      this asserts it for every trait at once, and the next stat a content
      ticket quietly turns into a ratchet fails here rather than being found by
      the ticket after that.
    */
    for (const trait of TRAITS) {
      const young = sd(at(18).map((row) => row.traits[trait]));
      const old = sd(at(60).map((row) => row.traits[trait]));
      console.log(`${trait}: sd ${young.toFixed(1)} at 18, ${old.toFixed(1)} at 60`);
      expect(
        old / young,
        `${trait} collapses: sd ${young.toFixed(1)} → ${old.toFixed(1)}`,
      ).toBeGreaterThan(0.6);
    }
  });

  it('leaves willpower somewhere a character can still be low at sixty', () => {
    const sixty = at(60).map((row) => row.traits.willpower);
    expect(sixty.length, 'too few lives reach sixty').toBeGreaterThan(80);
    expect(pctile(sixty, 0.1), 'the weakest tenth at sixty is still near the top').toBeLessThan(80);
  });

  it('bills a second year running on empty to the person carrying it', () => {
    /*
      Per year rather than per life, because the per-life version (five hard
      years against none) is 36 lives against 113 and mostly measures who has
      hard years. What the claim is about is the year: willpower in a second
      struggling year against a calm one. Before this ticket the struggling year
      GAINED more, because struggling people meet more events and every event
      that touched willpower paid it out.
    */
    const strainedYears = ADULT.filter((row) => row.strainedTwice).map((row) => row.willpowerMoved);
    const calmYears = ADULT.filter((row) => row.calm).map((row) => row.willpowerMoved);
    console.log(
      `willpower per year: ${mean(strainedYears).toFixed(2)} strained twice (${strainedYears.length}), ${mean(calmYears).toFixed(2)} calm`,
    );
    expect(strainedYears.length).toBeGreaterThan(200);
    expect(mean(strainedYears), 'a second hard year still builds you').toBeLessThan(0);
    expect(mean(strainedYears)).toBeLessThan(mean(calmYears));
  });

  it('makes a small child legible in who raised it', () => {
    /*
      Paired per life: each parent's own discipline at twenty-five against
      fifty, so this measures development rather than who ends up a parent —
      0411's cohort mistake, avoided by construction.
    */
    const change = PLAYED.flatMap((life, index) => {
      const start = life.find((row) => row.age === 25);
      const end = life.find((row) => row.age === 50);
      if (!start || !end) return [];
      const years = life.filter((row) => row.age > 25 && row.age <= 50 && row.smallChild).length;
      return [{ index, years, moved: end.traits.discipline - start.traits.discipline }];
    });
    const raised = change.filter((row) => row.years >= 4).map((row) => row.moved);
    const never = change.filter((row) => row.years === 0).map((row) => row.moved);
    console.log(
      `discipline 25→50: ${mean(raised).toFixed(1)} raising a small child, ${mean(never).toFixed(1)} never`,
    );
    expect(raised.length).toBeGreaterThan(30);
    expect(never.length).toBeGreaterThan(30);
    // P5's career changes alter who enters these two cohorts. Compare each
    // parent's observed change with that SAME life from 25 onward with only
    // parenting's shaping contribution disabled; keep the >2 effect floor.
    const growth = shaping.lifeShaping;
    let controlCalls = 0;
    const control = vi.spyOn(shaping, 'lifeShaping').mockImplementation((input) => {
      controlCalls += 1;
      return growth({
        ...input,
        family: {
          ...input.family,
          members: input.family.members.filter((p) => p.role !== 'child'),
        },
      });
    });
    const paired: number[] = [];
    try {
      for (const row of change.filter((row) => row.years >= 4)) {
        let state = STARTS.get(`shaped-${row.index}`);
        if (!state) throw new Error('Missing paired start');
        const start = Number(state.player.stats.discipline);
        while (state.player.alive && state.player.age < 50)
          state = answerEverything(advanceYear(state).state);
        if (state.player.age === 50)
          paired.push(row.moved - (Number(state.player.stats.discipline) - start));
      }
    } finally {
      control.mockRestore();
    }
    console.log(
      `paired parenting discipline effect: ${mean(paired).toFixed(2)} (${paired.length} lives)`,
    );
    expect(controlCalls).toBeGreaterThan(200);
    expect(paired.length).toBeGreaterThan(30);
    expect(mean(paired), 'raising a child changes nobody').toBeGreaterThan(2);
  });

  it('reads the year it is given, from a real played state', () => {
    /*
      The rules are proven as numbers in `shaping.test.ts`. What a population
      test can honestly add is the plumbing — that the severity lookup, the years
      a condition has been held and the ages of the children at home all reach
      `lifeShaping` from a real save. A population "the ill are worn" assertion
      was tried first and could not observe the claim: fewer than ten adult years
      in a hundred and fifty lives start a serious illness below the fraying
      line, and 13.76 says replace that instrument rather than widen it.
    */
    const ill = SAMPLES.find((state) =>
      state.health.conditions.some((held) => {
        const years = state.player.age - held.since;
        return findCondition(held.conditionId)?.severity !== 'minor' && years >= 1 && years <= 6;
      }),
    );
    const parent = SAMPLES.find((state) =>
      childrenAtHome(state.family, state.world.year).some(
        (child) => state.world.year - child.birthYear < ROUTINE_YEARS,
      ),
    );
    expect(ill, 'no sampled adult was learning to live with an illness').toBeDefined();
    expect(parent, 'no sampled adult had a small child at home').toBeDefined();

    const shape = (state: GameState, willpower: number, stress: number) =>
      lifeShaping({
        age: state.player.age,
        worldYear: state.world.year,
        family: state.family,
        conditions: state.health.conditions,
        stressBefore: stress,
        stressAfter: stress,
        willpower,
      });
    expect(shape(ill!, 80, 5).willpower, 'a strong person meeting it well').toBe(1);
    expect(shape(ill!, FRAYS - 1, 5).willpower, 'a frayed one').toBe(-1);
    expect(shape(parent!, 60, 5).discipline, 'the years before school').toBe(1);
    expect(shape(parent!, 60, 70).willpower, 'the same years, running on empty').toBe(-1);
  });
});
