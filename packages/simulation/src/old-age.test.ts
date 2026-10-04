/**
 * Ticket 0417 acceptance tests — a body that gets old.
 *
 * Roadmap finding 1b, open since 0408: a sixty-point range of birth health
 * bought about four years of life. Measured on 300 played lives before this
 * ticket, it was one symptom of something larger — nobody got old:
 *
 * | | before |
 * |---|---|
 * | median age at death | 72 |
 * | reached eighty-five | **3%** |
 * | median death, frailest fifth / most robust fifth | 70 / 76 |
 * | median deficit (illness not yet healed) at 70 | **25** |
 * | median health at 70 — vitality alone said 55 | **28** |
 * | deaths per thousand a year at 70 / 75 / 80 | **125 / 191 / 313** |
 *
 * US period life tables put those last three at roughly 20 / 31 / 51, and about
 * two in five twenty-year-olds reach eighty-five. The game was killing its old
 * people five to six times faster than the world does, and it was killing all
 * of them the same way.
 *
 * Two causes, both of them the model reading something ABSOLUTE where it meant
 * "for this body, at this age":
 *
 *  1. Healing was a flat 3.4 a year while illness got likelier every year, so
 *     from about sixty-five the deficit only grew — for every body alike.
 *  2. Frailty read raw health, which falls with age for everybody, so the age
 *     curve was counted twice: once in the Gompertz term, and again through a
 *     multiplier every seventy-five-year-old maxed out.
 */

import { describe, expect, it } from 'vitest';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const LIVES = 300;

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

interface Life {
  readonly bornWith: number;
  readonly diedAt: number;
  readonly deficitAt: Readonly<Record<number, number>>;
  readonly healthAt: Readonly<Record<number, number>>;
  /** Age at the start of each year lived through, and whether it was the last. */
  readonly years: readonly { readonly age: number; readonly died: boolean }[];
}

function live(seed: string): Life {
  let state: GameState = createNewGame({ seed });
  const bornWith = Number(state.player.stats.health);
  const deficitAt: Record<number, number> = {};
  const healthAt: Record<number, number> = {};
  const years: { age: number; died: boolean }[] = [];
  let guard = 0;
  while (state.player.alive && (guard += 1) < 115) {
    const age = state.player.age;
    state = answerEverything(advanceYear(state).state);
    years.push({ age, died: !state.player.alive });
    deficitAt[state.player.age] = state.health.deficit ?? 0;
    healthAt[state.player.age] = Number(state.player.stats.health);
  }
  return { bornWith, diedAt: state.player.age, deficitAt, healthAt, years };
}

const LIFETIMES = Array.from({ length: LIVES }, (_, i) => live(`old-age-${i}`));

const pct = (xs: readonly number[], p: number) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? NaN;
};
const at = (key: 'deficitAt' | 'healthAt', age: number) =>
  LIFETIMES.map((life) => life[key][age]).filter((value): value is number => value !== undefined);

/** Deaths per year per person alive at the start of it, over a ten-year band. */
function deathRate(from: number): number {
  const band = LIFETIMES.flatMap((life) =>
    life.years.filter((year) => year.age >= from && year.age < from + 10),
  );
  return band.filter((year) => year.died).length / Math.max(1, band.length);
}

describe('0417 — a body that gets old', () => {
  it('lets an illness at seventy heal the way one at thirty does', () => {
    /*
      THE RATCHET. A flat recovery against a rising illness rate crosses over
      in the sixties, and from there the deficit only grows. Median deficit at
      seventy was 25 — more than half of all the health a seventy-year-old had
      lost was illness that never healed. With healing proportional to what is
      owed, the deficit settles at a level instead of on a road to zero.
    */
    const deficit = pct(at('deficitAt', 70), 0.5);
    const health = pct(at('healthAt', 70), 0.5);
    console.log(`at 70: median deficit ${deficit.toFixed(1)}, median health ${health}`);
    expect(deficit, 'illness at seventy never heals').toBeLessThan(15);
    expect(health, 'the median seventy-year-old reads as barely here').toBeGreaterThan(35);
  });

  it('lets people get old', () => {
    const reached = LIFETIMES.filter((life) => life.diedAt >= 85).length / LIVES;
    const ages = LIFETIMES.map((life) => life.diedAt);
    console.log(
      `age at death p10/med/p90 ${pct(ages, 0.1)}/${pct(ages, 0.5)}/${pct(ages, 0.9)}; reached 85: ${(reached * 100).toFixed(0)}%`,
    );
    expect(reached, 'almost nobody reaches eighty-five').toBeGreaterThan(0.25);
    expect(reached, 'almost everybody reaches eighty-five').toBeLessThan(0.6);
  });

  it('kills old people at something like the rate the world does', () => {
    /*
      Against a US period life table, both sexes, roughly: 20 deaths per
      thousand a year at seventy, 31 at seventy-five, 51 at eighty, 86 at
      eighty-five — about 25 across the seventies and 75 across the eighties.
      The game ran 125, 191 and 313 at seventy, seventy-five and eighty.

      TEN-YEAR BANDS, because five-year ones were inside their own noise at
      this sample size (13.81): two disjoint samples of the same build read 56
      and 37 per thousand at seventy-five. A factor-of-two band either side,
      because what this guards is the five-fold error, not a decimal.
    */
    const reference: readonly (readonly [number, number])[] = [
      [70, 0.025],
      [80, 0.075],
    ];
    for (const [age, real] of reference) {
      const rate = deathRate(age);
      console.log(`deaths a year at ${age}-${age + 9}: ${(rate * 1000).toFixed(0)} per thousand`);
      expect(rate, `at ${age}`).toBeLessThan(real * 2);
      expect(rate, `at ${age}`).toBeGreaterThan(real / 2);
    }
  });

  it('makes a strong constitution worth years, not months', () => {
    /*
      The finding itself. Birth health is the one thing about a body the game
      decides before anything happens to it, so it is the cleanest test of
      whether constitution matters: the frailest fifth against the most robust.

      The line is set against measured noise (CORE_RULES 13.81). Two disjoint
      sets of 300 lives read gaps of 6 and 4 years on the build before this
      ticket, and 8 and 9 on this one. Seven sits between them: it goes red
      for the old model on either sample and stays green for this one.
    */
    const sorted = [...LIFETIMES].sort((a, b) => a.bornWith - b.bornWith);
    const fifth = Math.floor(LIVES / 5);
    const frail = pct(
      sorted.slice(0, fifth).map((life) => life.diedAt),
      0.5,
    );
    const robust = pct(
      sorted.slice(-fifth).map((life) => life.diedAt),
      0.5,
    );
    console.log(`median death: frailest fifth ${frail}, most robust fifth ${robust}`);
    expect(robust - frail, 'constitution is worth a rounding error').toBeGreaterThanOrEqual(7);
  });
});
