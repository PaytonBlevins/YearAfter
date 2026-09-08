/**
 * Ticket 0210 acceptance tests, at the level of a whole working life.
 *
 * `@yearafter/careers` proves the model in the small; these play 150 lives to
 * fifty-five with a player who wants to work, and assert on the SHAPE. Six
 * defects were found here, every one of them with a green suite:
 *
 *  - ZERO of twelve entry-level jobs would hire a median school leaver, because
 *    `reached` started at -1 and rung 0 therefore counted as a reach. The whole
 *    employment system was unreachable by the only population the build makes.
 *  - an 81% hire rate that did not move between a driven player and one who
 *    barely tried, so applying was a formality rather than a decision.
 *  - four promotions a life and HALF of all characters at the top rung of a
 *    ladder by fifty.
 *  - being let go 0.1 times in a thirty-two-year career — a verb spec 1670 asks
 *    for by name that did not exist, because the population's own Discipline
 *    carried an unpushed worker past the firing floor.
 *  - a character on a median salary holding $226,000 at fifty and a driven one
 *    $467,000, which would have made every price in the game free.
 *  - and the work-demand wiring reaching the stress model as a divisor of zero,
 *    so a character working nights in a kitchen and one who had never worked
 *    had identical stress at fifty.
 */

import { describe, expect, it } from 'vitest';
import { findJob, savedFrom } from '@yearafter/careers';
import { feeFor } from '@yearafter/parenting';
import { ROMANCE_MOVES, costOf } from '@yearafter/social';
import { advanceYear } from './advance';
import { applyFor, chanceOf, openings, workHarder } from './careers';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const LIVES = 150;
const UNTIL = 55;

interface Life {
  readonly state: GameState;
  readonly applications: number;
  readonly hires: number;
  readonly cashAt: Readonly<Record<number, number>>;
}

/** A player who wants to work: apply until hired, then push. */
function playALife(seed: string): Life {
  let state = createNewGame({ seed });
  let applications = 0;
  let hires = 0;
  const cashAt: Record<number, number> = {};

  for (let year = 0; year < UNTIL; year += 1) {
    state = advanceYear(state).state;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const result = decide(state, decision.eventId, choice.id);
      if (!result.ok) break;
      state = result.value.state;
    }

    const age = state.player.age;
    if (age >= 18 && !state.employment.job) {
      const list = [...openings(state)].sort((a, b) => chanceOf(state, b) - chanceOf(state, a));
      for (const job of list.slice(0, 2)) {
        applications += 1;
        const result = applyFor(state, String(job.id));
        if (!result.ok) continue;
        state = result.value.state;
        if (result.value.hired) {
          hires += 1;
          break;
        }
      }
    } else if (state.employment.job) {
      const result = workHarder(state);
      if (result.ok) state = result.value.state;
    }
    cashAt[age] = Number(state.player.cash) / 100;
  }
  return { state, applications, hires, cashAt };
}

const LIFETIMES: readonly Life[] = Array.from({ length: LIVES }, (_, index) =>
  playALife(`career-${index}`),
);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const cashAt = (age: number) => LIFETIMES.map((life) => life.cashAt[age] ?? 0);

/* -------------------------------------------------------------------------- */
/* The system is reachable at all                                              */
/* -------------------------------------------------------------------------- */

describe('a player who wants to work', () => {
  it('finds work', () => {
    // CORE_RULES 13.16. This is the test that would have caught the first
    // defect, and it caught it before anything shipped.
    const working = LIFETIMES.filter((life) => life.state.employment.history.length > 0);
    expect(working.length / LIVES).toBeGreaterThan(0.9);
  });

  it('does not walk into every job it applies for', () => {
    const applications = LIFETIMES.reduce((total, life) => total + life.applications, 0);
    const hires = LIFETIMES.reduce((total, life) => total + life.hires, 0);
    const rate = hires / applications;
    expect(rate, `hire rate ${Math.round(rate * 100)}%`).toBeLessThan(0.75);
    expect(rate, `hire rate ${Math.round(rate * 100)}%`).toBeGreaterThan(0.35);
  });

  it('climbs, without everybody reaching the top', () => {
    const tops = LIFETIMES.map((life) => {
      const ids = [
        ...life.state.employment.history.map((row) => row.jobId),
        ...(life.state.employment.job ? [life.state.employment.job.jobId] : []),
      ];
      return ids.reduce((best, id) => Math.max(best, findJob(id)?.rung ?? -1), -1);
    });
    // Progress is real...
    expect(median(tops)).toBeGreaterThanOrEqual(1);
    // ...and a ladder somebody always finishes is not a ladder.
    //
    // This harness plays OPTIMALLY: it applies every year it is out of work,
    // takes the best odds going, and presses Work Harder every year it is in
    // work. So this bound is an upper one — spec 1429 wants career success
    // "significantly optimizable by a skilled human player", and a third of
    // perfectly-played lives topping out is that being true rather than broken.
    const atTheTop = tops.filter((rung) => rung >= 4).length / LIVES;
    expect(atTheTop, `${Math.round(atTheTop * 100)}% reached rung 4`).toBeLessThan(0.4);
  });

  it('lets somebody go, sometimes', () => {
    // Spec 1670 lists firing by name. It happened 0.1 times per life before the
    // steady-effort baseline was measured against the population's own stats.
    const letGo = LIFETIMES.reduce(
      (total, life) =>
        total +
        life.state.employment.history.filter(
          (row) => row.because === 'fired' || row.because === 'laid-off',
        ).length,
      0,
    );
    expect(letGo / LIVES).toBeGreaterThan(0.15);
  });
});

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

describe('what a working life is worth', () => {
  it('leaves a character with a plausible amount of money', () => {
    // Measured before this ticket: cash was p10 $28, median $135, p90 $1,175
    // and IDENTICAL at eighteen, twenty-two, twenty-five, thirty and forty.
    // Nothing had moved money in adulthood, in either direction, ever.
    expect(median(cashAt(20))).toBeGreaterThan(500);
    expect(median(cashAt(30))).toBeGreaterThan(median(cashAt(20)));
    expect(median(cashAt(40))).toBeGreaterThan(median(cashAt(30)));
    // And not so much that the rest of the game becomes free — see below.
    expect(median(cashAt(40))).toBeLessThan(250_000);
  });

  it('never lets a character hold less than nothing', () => {
    // CORE_RULES 13.13. A year CAN end behind — a small wage and four children
    // does not break even — and cash still floors at zero until 0301's ledger
    // and 0307's loans give a character somewhere to fall.
    expect(savedFrom(25_000, 4)).toBeLessThan(0);
    for (const life of LIFETIMES) {
      expect(Number(life.state.player.cash), life.state.player.firstName).toBeGreaterThanOrEqual(0);
    }
  });

  it('turns every price in the game into a real price', () => {
    // THE POINT OF THE TICKET.
    //
    // A wedding, a ring and an adoption fee were all written as
    // `min(realPrice, whatYouHave)` because the build had no income — so what
    // they actually charged was a SHARE of a character's pocket, and the real
    // price never bound. Income is what makes the cap the thing that binds, and
    // this asserts it now does for a working adult rather than leaving it to be
    // noticed in a played life.
    const cash = median(cashAt(30)) * 100;
    const wedding = ROMANCE_MOVES.find((move) => move.id === 'marry');
    const ring = ROMANCE_MOVES.find((move) => move.id === 'propose');
    expect(wedding).toBeDefined();
    expect(ring).toBeDefined();

    expect(costOf(ring!, cash)).toBe(ring!.costCap);
    expect(costOf(wedding!, cash)).toBeGreaterThan((wedding!.costCap ?? 0) * 0.8);
    // The adoption fee is a fee again, not "whatever is in the account".
    expect(feeFor(cash)).toBe(180_000);
  });
});

/* -------------------------------------------------------------------------- */
/* Invariants                                                                  */
/* -------------------------------------------------------------------------- */

describe('invariants', () => {
  it('gives every timeline entry a unique id', () => {
    // CORE_RULES 13.12, with a SIXTH phase now writing into the same year.
    for (const life of LIFETIMES) {
      const ids = life.state.player.timeline.map((entry) => entry.id);
      expect(new Set(ids).size, life.state.player.firstName).toBe(ids.length);
    }
  });

  it('never writes a line with an unrendered token', () => {
    for (const life of LIFETIMES) {
      for (const entry of life.state.player.timeline) {
        expect(entry.text).not.toContain('{');
        expect(entry.text).not.toContain('undefined');
        expect(entry.text).not.toContain('NaN');
      }
    }
  });

  it('never says somebody earned nothing', () => {
    // A pay line that reads "$0 for the year" is the money system saying it did
    // not run. CORE_RULES 13.6 wants the amount named; naming zero is worse
    // than saying nothing.
    for (const life of LIFETIMES) {
      for (const entry of life.state.player.timeline) {
        if (entry.kind !== 'career') continue;
        expect(entry.text, entry.text).not.toMatch(/\$0\b/);
      }
    }
  });

  it('never holds a job that is not in the catalog', () => {
    for (const life of LIFETIMES) {
      const held = life.state.employment.job;
      if (held) expect(findJob(held.jobId), held.jobId).toBeDefined();
      for (const past of life.state.employment.history) {
        expect(findJob(past.jobId), past.jobId).toBeDefined();
        expect(past.to).toBeGreaterThanOrEqual(past.from);
      }
    }
  });

  it('never has two jobs at once', () => {
    // The 0207b lesson about two partners, one system over: leaving a job for
    // another has to CLOSE the first, or a career reads as a list of jobs that
    // overlapped.
    for (const life of LIFETIMES) {
      const held = life.state.employment.job;
      if (!held) continue;
      for (const past of life.state.employment.history) {
        expect(past.to, `${past.jobId} overlaps ${held.jobId}`).toBeLessThanOrEqual(held.since);
      }
    }
  });
});
