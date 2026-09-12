/**
 * Ticket 0302 — the checks, watched failing.
 *
 * Spec 1678 makes reconciliation build-blocking, and a check that has never
 * been seen to fail is a check nobody knows works. 0207c learned this the
 * expensive way: a migration test that asserted the migrated save was correct
 * passed happily against a migration that had been neutered, because nothing
 * ever proved the assertion could go red. So every rule 0302 adds is broken
 * here on purpose, one way each, and the failure is the assertion.
 *
 * The three corruptions below are deliberately chosen to be INVISIBLE to each
 * other: each one leaves the other two checks perfectly satisfied. That is what
 * makes three checks three checks rather than one written out three times.
 */

import { describe, expect, it } from 'vitest';
import { cents, dollars } from '@yearafter/core';
import {
  EMPTY_LEDGER,
  post,
  postAll,
  reconcile,
  reconcileByYear,
  yearsOutside,
  type Ledger,
  type NewTransaction,
} from './ledger';

const wage = (amount: number): NewTransaction => ({
  category: 'salary',
  amount: dollars(amount),
  source: 'Pay from the diner',
});
const rent = (amount: number): NewTransaction => ({
  category: 'living',
  amount: dollars(-amount),
  source: 'The cost of being alive',
});

/** Three honest years: earn, spend, earn. Every check passes on it. */
const HONEST: Ledger = (() => {
  let ledger = postAll(EMPTY_LEDGER, 2020, 20, [wage(3000), rent(1000)]).ledger;
  ledger = postAll(ledger, 2021, 21, [wage(3000), rent(2500)]).ledger;
  ledger = postAll(ledger, 2022, 22, [wage(3000), rent(1000)]).ledger;
  return ledger;
})();

describe('the honest ledger', () => {
  it('satisfies all three checks, which is what makes the rest of this file mean something', () => {
    expect(reconcile(HONEST).ok).toBe(true);
    expect(reconcileByYear(HONEST).firstBadYear).toBeUndefined();
    expect(yearsOutside(HONEST, 2000, 2022)).toEqual([]);
  });
});

describe('a producer that moved money without posting', () => {
  /*
    What this looks like in the wild: a file doing
    `player.cash = add(player.cash, bonus)` and never touching the ledger. The
    balance is right by that file's lights and the transactions have never heard
    of the bonus.
  */
  const bypassed: Ledger = { ...HONEST, balance: cents(Number(HONEST.balance) + 50_000) };

  it('fails reconcile', () => {
    const result = reconcile(bypassed);
    expect(result.ok).toBe(false);
    expect(Number(result.difference)).toBe(50_000);
  });

  it('is invisible to the other two', () => {
    // Neither the year walk's floor nor the span can see an unrecorded $500:
    // there is no row to be in a bad year or a wrong one.
    expect(yearsOutside(bypassed, 2000, 2022)).toEqual([]);
    expect(reconcileByYear(bypassed).firstBadYear).toBeUndefined();
  });
});

describe('a year that went below zero and came back', () => {
  /*
    The drift-then-clamp shape. A life that ends on a correct balance having
    been thirty thousand dollars in the wrong for a decade passes every
    end-of-life check ever written, which is why `ledger.test.ts` checks every
    year and why this exists at all.

    Built by hand rather than through `post`, because `post` is the thing that
    makes it impossible — the floor is in there. This is what the ledger would
    look like if somebody subtracted from `balance` directly.
  */
  const dipped: Ledger = {
    balance: cents(0),
    transactions: [
      {
        id: 't1',
        year: 2020,
        age: 20,
        category: 'living',
        amount: cents(-100_000),
        source: 'Rent',
      },
      { id: 't2', year: 2021, age: 21, category: 'salary', amount: cents(100_000), source: 'Pay' },
    ],
  };

  it('fails the year walk, and names the year', () => {
    const walk = reconcileByYear(dipped);
    expect(walk.firstBadYear).toBe(2020);
    expect(Number(walk.years[0]?.closing)).toBe(-100_000);
  });

  it('is invisible to the other two', () => {
    // It balances perfectly: minus a thousand then plus a thousand is zero, and
    // both years are inside any reasonable life.
    expect(reconcile(dipped).ok).toBe(true);
    expect(yearsOutside(dipped, 2000, 2022)).toEqual([]);
  });
});

describe('a transaction stamped with the wrong year', () => {
  /*
    `post` takes the year as an argument, so this is a variable mix-up and it
    type-checks: `state.world.year` where `nextYear` was meant, or a birth year
    where a calendar year was. It is the reason `yearsOutside` takes the span
    from the life instead of from the ledger — a ledger cannot tell you its own
    years are wrong, they are whatever its rows say they are.
  */
  const misstamped: Ledger = {
    ...HONEST,
    transactions: HONEST.transactions.map((entry, index) =>
      index === 0 ? { ...entry, year: 1970 } : entry,
    ),
  };

  it('fails the span check', () => {
    expect(yearsOutside(misstamped, 2000, 2022)).toEqual([1970]);
  });

  it('is invisible to the other two', () => {
    // The row is still there and still the same amount, so the sum is
    // untouched; and 1970 opens the walk with money coming IN, so nothing dips.
    expect(reconcile(misstamped).ok).toBe(true);
    expect(reconcileByYear(misstamped).firstBadYear).toBeUndefined();
  });
});

describe('what the year walk is and is not', () => {
  it('agrees with reconcile on every ledger, which is the honest claim', () => {
    /*
      Stated as a test because the second draft of `reconcileByYear`'s comment
      claimed its `ok` caught a class `reconcile` could not. It does not: every
      transaction belongs to exactly one year and the year list is derived from
      the transactions, so the chain necessarily sums to the same number. What
      the walk adds is `firstBadYear` and the rows — proved above — not a
      stronger identity.
    */
    for (const ledger of [HONEST, { ...HONEST, balance: cents(1) }]) {
      expect(reconcileByYear(ledger).ok).toBe(reconcile(ledger).ok);
    }
  });

  it('carries each year’s closing into the next year’s opening', () => {
    const rows = reconcileByYear(HONEST).years;
    expect(rows.map((row) => row.year)).toEqual([2020, 2021, 2022]);
    for (let i = 1; i < rows.length; i += 1) {
      expect(Number(rows[i]?.opening)).toBe(Number(rows[i - 1]?.closing));
    }
    expect(Number(rows[rows.length - 1]?.closing)).toBe(Number(HONEST.balance));
  });

  it('counts a shortfall row as neither in nor out', () => {
    // It is a record, not a movement. If it counted, every broke year would
    // report money flowing that never flowed.
    const broke = post(post(EMPTY_LEDGER, 2020, 20, wage(400)).ledger, 2020, 20, rent(1000)).ledger;
    const row = reconcileByYear(broke).years[0];
    expect(Number(row?.in)).toBe(40_000);
    expect(Number(row?.out)).toBe(40_000);
    expect(Number(row?.closing)).toBe(0);
  });
});
