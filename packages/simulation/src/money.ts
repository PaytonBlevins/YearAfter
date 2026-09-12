/**
 * Ticket 0301 — the one way a player action moves money.
 *
 * `@yearafter/finance` owns the ledger and knows nothing about GameState. This
 * is the thin piece that joins them, and it exists so that no call site ever
 * writes `cash:` by hand again.
 *
 * THE RULE THIS FILE ENFORCES
 *
 * `player.cash` is a MIRROR of `finance.balance`. Not a second number that
 * happens to agree — a mirror, written from one place, never computed. Before
 * this ticket six producers each did their own `add(state.player.cash, ...)`,
 * which is CORE_RULES 13.31 in its usual shape: an invariant kept in six places
 * is six promises, and this build has already watched that go wrong three times
 * with timeline ids.
 *
 * TWO SHAPES, BECAUSE THERE ARE TWO KINDS OF CALLER
 *
 *   `moveMoney`   for a PLAYER ACTION, which holds the whole state and wants a
 *                 patch back: the new ledger and the new cash, ready to spread.
 *   `postYear`    for `advanceYear`, which collects what the phases REPORTED
 *                 and posts them all in one go.
 *
 * Phases deliberately do not move money themselves. They return
 * `transactions: NewTransaction[]` the same way they return `lines` and
 * `records`, and the year is committed in one place — which is what makes the
 * order of postings within a year deterministic, and what lets the zero floor
 * see the whole year rather than whichever writer happened to run first.
 */

import type { Character } from '@yearafter/character';
import type { Money } from '@yearafter/core';
import { cashFrom, post, postAll, type Ledger, type NewTransaction } from '@yearafter/finance';
import type { GameState } from './game-state';

export interface MoneyMoved {
  readonly finance: Ledger;
  /** The mirrored balance, for spreading into the player. */
  readonly cash: Money;
  /** Signed like the request: what could not be paid. Usually zero. */
  readonly short: Money;
}

/**
 * Move money for something the player just pressed.
 *
 * Returns a patch rather than a whole state because every caller is already
 * building one — `{ ...state, player: { ...state.player, cash }, finance }` —
 * and handing back a state would mean this file knowing what else each action
 * changes.
 */
export function moveMoney(state: GameState, entry: NewTransaction): MoneyMoved {
  const result = post(state.finance, state.world.year, state.player.age, entry);
  return { finance: result.ledger, cash: cashFrom(result.ledger), short: result.short };
}

/** The same, for a year's worth of postings from the phases. */
export function postYear(
  ledger: Ledger,
  year: number,
  age: number,
  entries: readonly NewTransaction[],
): MoneyMoved {
  const result = postAll(ledger, year, age, entries);
  return { finance: result.ledger, cash: cashFrom(result.ledger), short: result.short };
}

/**
 * Spread a movement into a character.
 *
 * Exists so the pattern reads the same at every call site, and so that
 * `grep 'cash:'` finds this file and the commit function in `advanceYear` and
 * nothing else. That grep is the enforcement.
 */
export const withCash = (player: Character, moved: MoneyMoved): Character => ({
  ...player,
  cash: moved.cash,
});
