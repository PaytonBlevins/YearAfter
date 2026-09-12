/**
 * Ticket 0302 — the checks, wired.
 *
 * `@yearafter/finance` proves the three rules catch what they claim to catch,
 * each corruption invisible to the other two. This proves something different
 * and just as easy to get wrong: that `advanceYear` actually CALLS them.
 *
 * Worth its own file because the gap between "the function is correct" and "the
 * function runs" has already cost this build a ticket — `reconcile` was being
 * called in `advance.ts` for a whole ticket without being imported, which
 * type-checked because nothing in that file had been type-checked since the
 * line was added. A test that only exercised `reconcile` directly would have
 * been green throughout.
 */

import { describe, expect, it } from 'vitest';
import { cents } from '@yearafter/core';
import { advanceYear } from './advance';
import { createNewGame } from './new-game';
import { decide } from './decide';
import type { GameState } from './game-state';

/**
 * A state a few years in, so its ledger has something in it to corrupt.
 *
 * Answers pending decisions on the way, and asserts none is open at the end,
 * because `advanceYear` RETURNS EARLY on an unanswered question — a year cannot
 * be committed while one is open. The first draft of this file did not, and the
 * span test below went green against a state that never reached the check: the
 * corruption was never examined, and the control test that proves the honest
 * case passes would have passed for the same empty reason. A test that hands
 * `advanceYear` a state it refuses to advance is testing the refusal.
 */
function played(seed: string): GameState {
  let state = createNewGame({ seed });
  // Runs until money has actually moved rather than for a fixed number of
  // years, because in childhood it moves only when a parent hands it over or a
  // twenty turns up on the sidewalk — both random. A fixed six years gave one
  // of these seeds an empty ledger and nothing to corrupt.
  for (let i = 0; i < 30 && state.player.alive; i += 1) {
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
    if (state.pending.length === 0 && state.finance.transactions.length > 0) return state;
  }
  throw new Error(`${seed}: never reached a year with money in it and no question open`);
}

describe('advanceYear refuses to commit a year whose books are wrong', () => {
  it('throws when money arrived without a transaction, and names the year', () => {
    const state = played('WIRED-A');
    const bypassed: GameState = {
      ...state,
      player: { ...state.player, cash: cents(Number(state.player.cash) + 500_00) },
      finance: { ...state.finance, balance: cents(Number(state.finance.balance) + 500_00) },
    };
    // Both numbers moved together, exactly as a pre-0301 producer would have
    // moved them — which is why `player.cash === finance.balance` cannot catch
    // this and the transactions have to.
    expect(() => advanceYear(bypassed)).toThrow(/do not balance in \d{4}/);
    expect(() => advanceYear(bypassed)).toThrow(/without going through post/);
  });

  it('throws when a year closed below zero', () => {
    const state = played('WIRED-B');
    // The charge goes in the ledger's FIRST year and the money that hides it in
    // the year after, because a dip that opens and closes inside one year never
    // shows in a year-end balance — which is the whole reason the walk carries
    // a closing into an opening instead of totalling each year alone.
    const year = state.finance.transactions[0]?.year ?? state.world.year;
    const dipped: GameState = {
      ...state,
      finance: {
        ...state.finance,
        transactions: [
          {
            id: 'planted',
            year,
            age: 1,
            category: 'living',
            amount: cents(-900_00),
            source: 'A charge that should have been floored',
          },
          ...state.finance.transactions,
          {
            id: 'planted-back',
            year: year + 1,
            age: state.player.age,
            category: 'salary',
            amount: cents(900_00),
            source: 'And the money that hid it',
          },
        ],
      },
    };
    // It reconciles — the two planted rows cancel — so only the walk sees it.
    expect(() => advanceYear(dipped)).toThrow(/went below zero in \d{4}/);
  });

  it('throws when a transaction is stamped outside the life', () => {
    const state = played('WIRED-C');
    const [first, ...rest] = state.finance.transactions;
    if (!first) throw new Error('the sample life never moved any money');
    const misstamped: GameState = {
      ...state,
      finance: { ...state.finance, transactions: [{ ...first, year: 1901 }, ...rest] },
    };
    // Balances perfectly and never dips. The span is the only thing that knows.
    expect(() => advanceYear(misstamped)).toThrow(/money moving in 1901/);
  });

  it('lets an honest year through, which is the control', () => {
    // Without this the three above would pass against an `advanceYear` that
    // threw on everything.
    const state = played('WIRED-D');
    expect(() => advanceYear(state)).not.toThrow();
  });
});
