/**
 * Ticket 0301 acceptance tests — the ledger against real played lives.
 *
 * `@yearafter/finance` tests the ledger's own arithmetic. These test the thing
 * that arithmetic cannot: that every producer in the build actually goes
 * through it. Spec 1338 asks v0.03 for "aggressive financial integrity
 * testing", and the one defect this design can suffer is a writer that sets
 * `cash` directly and skips `post` — which is invisible any other way and
 * which `reconcile` is built to catch.
 */

import { describe, expect, it } from 'vitest';
import {
  UNWRITTEN_CATEGORIES,
  reconcile,
  totalFor,
  type TransactionCategory,
} from '@yearafter/finance';
import { movesFor } from '@yearafter/social';
import { advanceYear } from './advance';
import { applyFor, openings, workHarder } from './careers';
import { continueAsChild, heirsIn } from './continue';
import { decide } from './decide';
import { useDatingApp } from './dating';
import { askParent, canAsk } from './guardians';
import { createNewGame } from './new-game';
import { applyToAdopt, tryForBaby } from './parenting';
import { romanticMove } from './romance';
import type { GameState } from './game-state';
import { requestsAt } from '@yearafter/parenting';
import { livingParents } from '@yearafter/relationships';
import { gigsForAge } from '@yearafter/content';
import { takeGig } from './gigs';

/**
 * A life played by somebody who presses everything.
 *
 * Deliberately greedy: it asks parents for money, takes jobs, goes on dates,
 * marries, adopts, has children and pays tuition. Every one of those was a
 * separate hand-written `cash` mutation before this ticket, so a life that
 * touches all of them is the test.
 */
function playHard(seed: string, years = 70): GameState {
  let state = createNewGame({ seed });
  for (let year = 0; year < years; year += 1) {
    state = advanceYear(state).state;
    if (!state.player.alive) break;

    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const result = decide(state, decision.eventId, choice.id);
      if (!result.ok) break;
      state = result.value.state;
    }

    for (const request of requestsAt(state.player.age)) {
      for (const parent of livingParents(state.family)) {
        if (!canAsk(state, parent.id, request.id)) continue;
        const result = askParent(state, parent.id, request.id);
        if (result.ok) state = result.value.state;
        break;
      }
    }

    if (state.player.age >= 16) {
      const app = useDatingApp(state);
      if (app.ok) state = app.value.state;
      const candidates = [...state.circle.people]
        .filter(
          (person) => person.kind === 'peer' && person.endedAtAge === undefined && person.alive,
        )
        .sort((left, right) => right.relationship - left.relationship);
      for (const person of candidates.slice(0, 3)) {
        const moves = movesFor(person, state.player.age, Number(state.player.cash)).filter(
          (move) => move.id !== 'break-up' && move.id !== 'divorce',
        );
        const move = moves[moves.length - 1];
        if (!move) continue;
        const result = romanticMove(state, person.id, move.id);
        if (result.ok) state = result.value.state;
      }
    }

    // Odd jobs: a paper round is the only money most childhoods ever see, and
    // it is a producer of its own (`oddJob`), so a test of "does every producer
    // go through the ledger" has to actually take one.
    if (state.player.age >= 12 && state.player.age <= 20) {
      for (const gig of gigsForAge(state.player.age)) {
        const result = takeGig(state, gig.id);
        if (result.ok) {
          state = result.value;
          break;
        }
      }
    }

    if (state.player.age >= 18 && !state.employment.job) {
      for (const job of openings(state).slice(0, 3)) {
        const result = applyFor(state, String(job.id));
        if (result.ok) {
          state = result.value.state;
          if (result.value.hired) break;
        }
      }
    }
    if (state.employment.job) {
      for (let i = 0; i < 2; i += 1) {
        const result = workHarder(state);
        if (result.ok && !result.value.spent) state = result.value.state;
      }
    }
    if (state.player.age >= 24 && state.player.age <= 42) {
      const baby = tryForBaby(state);
      if (baby.ok) state = baby.value.state;
    }
    if (state.player.age === 33) {
      const application = applyToAdopt(state);
      if (application.ok) state = application.value.state;
    }
  }
  return state;
}

const LIVES = Array.from({ length: 12 }, (_, index) => playHard(`LEDGER-${index}`));

describe('the books balance', () => {
  it('reconciles after every kind of life', () => {
    // Spec 1678, one ticket early: opening cash + in − out = closing cash.
    for (const [index, state] of LIVES.entries()) {
      const result = reconcile(state.finance);
      expect(result.ok, `life ${index}: off by ${Number(result.difference) / 100}`).toBe(true);
    }
  });

  it('keeps player.cash and the ledger in step, every year of every life', () => {
    /*
      The defect this exists to catch, and the only one this design can suffer:
      a producer that writes `cash` directly and never posts. Six of them did
      exactly that before this ticket, each with its own arithmetic and its own
      idea of the zero floor.

      Checked EVERY YEAR rather than at the end, because a balance that drifts
      and then gets clamped back to zero by a bad year would pass an end-of-life
      check while having been wrong for thirty years.
    */
    for (const [index, seed] of ['A', 'B', 'C'].entries()) {
      let state = createNewGame({ seed: `STEP-${seed}` });
      for (let year = 0; year < 60 && state.player.alive; year += 1) {
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
        expect(Number(state.player.cash), `life ${index} age ${state.player.age}`).toBe(
          Number(state.finance.balance),
        );
        expect(reconcile(state.finance).ok, `life ${index} age ${state.player.age}`).toBe(true);
      }
    }
  });

  it('never lets a balance go negative', () => {
    // CORE_RULES 13.13. There is nowhere to fall until 0307's loan engine, and
    // the part that could not be paid is a `shortfall` row rather than a
    // silent clamp — which is what lets the two checks above pass at all.
    for (const state of LIVES) {
      expect(Number(state.finance.balance)).toBeGreaterThanOrEqual(0);
      expect(Number(state.player.cash)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('what the ledger now knows that nothing knew before', () => {
  it('records the tax and the living costs that used to be discarded', () => {
    /*
      The whole ticket in one assertion. `savedFrom` has always computed gross,
      then tax, then the cost of living, and returned only the remainder — at
      $42,000 with two children it works out $8,604 and $32,647 and hands back
      $749. Across a career that is four million dollars the game could describe
      and never did.
    */
    const worked = LIVES.filter((state) => Number(totalFor(state.finance, 'salary')) > 0);
    expect(worked.length, 'nobody in the sample ever worked').toBeGreaterThan(0);
    for (const state of worked) {
      expect(Number(totalFor(state.finance, 'tax'))).toBeLessThan(0);
      expect(Number(totalFor(state.finance, 'living'))).toBeLessThan(0);
    }
  });

  it('gives every transaction a source, which is CORE_RULES 13.6 made structural', () => {
    for (const state of LIVES) {
      for (const entry of state.finance.transactions) {
        expect(entry.source.length, `${entry.id} had no source`).toBeGreaterThan(0);
        expect(entry.source, `${entry.id} left a token unrendered`).not.toMatch(/\{[a-zA-Z]/);
      }
    }
  });

  it('gives every transaction a unique id', () => {
    // CORE_RULES 13.12, which this build has broken three times in the timeline.
    for (const state of LIVES) {
      const ids = state.finance.transactions.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('writes nothing at all for a year in which no money moved', () => {
    // Most of a childhood. A ledger that logged a zero every year would be
    // mostly noise, and spec 21 keeps this backend precisely so it can be
    // complete rather than readable.
    for (const state of LIVES) {
      expect(
        state.finance.transactions.every(
          (entry) => Number(entry.amount) !== 0 || entry.category === 'shortfall',
        ),
      ).toBe(true);
    }
  });

  it('reaches the categories the build actually produces', () => {
    /*
      CORE_RULES 13.7: a system nobody can trigger is not a system. Five
      categories are declared with no producer and are listed in
      `UNWRITTEN_CATEGORIES`; every other one has to be reachable, or it is a
      promise rather than a category.
    */
    const seen = new Set<TransactionCategory>();
    for (const state of LIVES) {
      for (const entry of state.finance.transactions) seen.add(entry.category);
    }
    for (const category of ['salary', 'tax', 'living', 'gift', 'oddJob'] as const) {
      expect(seen.has(category), `nothing ever produced a ${category}`).toBe(true);
    }

    /*
      AND THE LIST HAS TO BE TRUE, not merely unchanged.

      Ticket 0309 found `assetIncome` and `investment` still sitting in
      `UNWRITTEN_CATEGORIES` two milestones after 0308 gave them producers. The
      test guarding that list asserted it EQUALLED four specific names, so it
      passed happily while the list was wrong — CORE_RULES 13.51, in the file
      next door to where 13.51 was written.

      This is the derived version, and the FIRST attempt at it was vacuous: none
      of these lives ever buys anything, so no investment category could appear
      here however wrong the list was. Putting `assetIncome` back and watching
      this test pass is what found that. The real guard lives in
      `investing.test.ts`, where a character actually invests; this one covers
      everything a passive life touches.
    */
    for (const category of seen) {
      expect(
        UNWRITTEN_CATEGORIES.includes(category),
        `${category} is listed as having no producer, and a played life just produced one`,
      ).toBe(false);
    }
  });
});

describe('an inheritance', () => {
  it('opens the heir’s books with a transaction, not a bare balance', () => {
    // A balance with no transaction behind it is exactly the state migration 17
    // had to repair for every save written before this ticket. The heir must
    // not start in it.
    for (const state of LIVES) {
      if (state.player.alive) continue;
      const heir = heirsIn(state.family)[0];
      if (!heir) continue;
      const next = continueAsChild(state, heir.id);
      if (!next) continue;
      expect(reconcile(next.finance).ok).toBe(true);
      expect(Number(next.player.cash)).toBe(Number(next.finance.balance));
      if (Number(state.player.cash) > 0) {
        expect(next.finance.transactions).toHaveLength(1);
        expect(next.finance.transactions[0]?.source).toContain(state.player.firstName);
      }
      return;
    }
  });
});
