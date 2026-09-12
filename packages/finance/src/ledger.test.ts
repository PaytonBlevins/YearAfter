/**
 * Ticket 0301 acceptance tests.
 *
 * Spec 1043–1059 makes financial reconciliation absolute and spec 1338 says
 * v0.03 gets "aggressive financial integrity testing". The properties that
 * matter are the ones that would be silent for a whole milestone: does the
 * balance ever drift from the transactions, does the floor lose money, and can
 * two transactions end up sharing an id.
 */

import { describe, expect, it } from 'vitest';
import { cents, dollars } from '@yearafter/core';
import {
  EMPTY_LEDGER,
  UNWRITTEN_CATEGORIES,
  cashFrom,
  flows,
  post,
  postAll,
  reconcile,
  totalFor,
  transactionsIn,
  type Ledger,
  type NewTransaction,
} from './ledger';

const salary = (amount: number): NewTransaction => ({
  category: 'salary',
  amount: dollars(amount),
  source: 'Pay from the diner',
});
const living = (amount: number): NewTransaction => ({
  category: 'living',
  amount: dollars(-amount),
  source: 'The cost of being alive',
});

describe('post', () => {
  it('moves the balance by exactly what it recorded', () => {
    const { ledger, applied } = post(EMPTY_LEDGER, 2020, 20, salary(1200));
    expect(Number(applied)).toBe(120_000);
    expect(Number(ledger.balance)).toBe(120_000);
    expect(ledger.transactions).toHaveLength(1);
    expect(reconcile(ledger).ok).toBe(true);
  });

  it('refuses to store a zero', () => {
    // A ledger that logged "$0 of tax" for every unemployed year would be
    // mostly noise. Spec 1986's ordinary year writes nothing at all.
    const { ledger } = post(EMPTY_LEDGER, 2020, 20, {
      category: 'tax',
      amount: cents(0),
      source: 'Tax on nothing',
    });
    expect(ledger.transactions).toHaveLength(0);
    expect(ledger).toBe(EMPTY_LEDGER);
  });

  it('keeps the source, because that is the whole point of the type', () => {
    // CORE_RULES 13.6 has been kept by hand in six producers since 0203b.
    const { ledger } = post(EMPTY_LEDGER, 2020, 20, salary(100));
    expect(ledger.transactions[0]?.source).toBe('Pay from the diner');
    expect(ledger.transactions[0]?.age).toBe(20);
    expect(ledger.transactions[0]?.year).toBe(2020);
  });
});

describe('the zero floor', () => {
  it('stops at zero rather than going negative', () => {
    // CORE_RULES 13.13. There is nowhere to fall until 0307's loan engine.
    const start = post(EMPTY_LEDGER, 2020, 20, salary(400)).ledger;
    const { ledger, applied, short } = post(start, 2020, 20, living(1000));
    expect(Number(ledger.balance)).toBe(0);
    expect(Number(applied)).toBe(-40_000);
    expect(Number(short)).toBe(-60_000);
  });

  it('writes the unpaid part down, so the ledger still reconciles', () => {
    // The defect this exists to prevent: a ledger saying a character was
    // charged $10,000 in a year they had $400, a balance saying $0, and the
    // two disagreeing by $9,600 with nothing to point at.
    const start = post(EMPTY_LEDGER, 2020, 20, salary(400)).ledger;
    const { ledger } = post(start, 2020, 20, living(1000));
    expect(reconcile(ledger).ok).toBe(true);
    const shortfalls = ledger.transactions.filter((entry) => entry.category === 'shortfall');
    expect(shortfalls).toHaveLength(1);
    expect(shortfalls[0]?.source).toContain('$600');
    // It is a record, not a movement — it must not move the balance itself.
    expect(Number(shortfalls[0]?.amount)).toBe(0);
  });

  it('does not fire when there is enough, and does not fire on the way in', () => {
    const rich = post(EMPTY_LEDGER, 2020, 20, salary(5000)).ledger;
    const { ledger, short } = post(rich, 2020, 20, living(1000));
    expect(Number(short)).toBe(0);
    expect(ledger.transactions.some((entry) => entry.category === 'shortfall')).toBe(false);
  });

  it('leaves a broke character at zero rather than at minus everything', () => {
    let ledger: Ledger = EMPTY_LEDGER;
    for (let year = 0; year < 40; year += 1) {
      ledger = post(ledger, 2000 + year, year, living(2000)).ledger;
    }
    expect(Number(ledger.balance)).toBe(0);
    expect(reconcile(ledger).ok).toBe(true);
  });
});

describe('ids', () => {
  it('never repeats, even for the same category in the same year', () => {
    // CORE_RULES 13.12, which this build has now broken three separate times in
    // the timeline. The counter is derived from the ledger, so a life replays
    // identically from its seed — no RNG, no clock.
    let ledger: Ledger = EMPTY_LEDGER;
    for (let i = 0; i < 50; i += 1) ledger = post(ledger, 2020, 20, salary(10)).ledger;
    const ids = ledger.transactions.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is stable — the same postings produce the same ids', () => {
    const build = () => {
      let ledger: Ledger = EMPTY_LEDGER;
      ledger = post(ledger, 2020, 20, salary(100)).ledger;
      ledger = post(ledger, 2020, 20, living(40)).ledger;
      ledger = post(ledger, 2021, 21, salary(100)).ledger;
      return ledger;
    };
    expect(build().transactions.map((entry) => entry.id)).toEqual(
      build().transactions.map((entry) => entry.id),
    );
  });
});

describe('reading it back', () => {
  const built = postAll(EMPTY_LEDGER, 2030, 30, [
    salary(50_000),
    { category: 'tax', amount: dollars(-11_000), source: 'Tax' },
    living(34_000),
    { category: 'gift', amount: dollars(200), source: 'Mom, for no reason' },
  ]).ledger;

  it('totals a category across a year', () => {
    expect(Number(totalFor(built, 'tax', 2030))).toBe(-1_100_000);
    expect(Number(totalFor(built, 'salary'))).toBe(5_000_000);
    expect(Number(totalFor(built, 'housing'))).toBe(0);
  });

  it('separates what came in from what went out', () => {
    const year = flows(built, 2030);
    expect(Number(year.in)).toBe(5_020_000);
    expect(Number(year.out)).toBe(4_500_000);
    // And spec 1678's identity holds: in − out is the change in balance.
    expect(Number(year.in) - Number(year.out)).toBe(Number(built.balance));
  });

  it('hands back a year, and the cash', () => {
    expect(transactionsIn(built, 2030)).toHaveLength(4);
    expect(transactionsIn(built, 2031)).toHaveLength(0);
    expect(cashFrom(built)).toBe(built.balance);
  });
});

describe('the categories nothing writes yet', () => {
  it('is a list that is meant to shrink', () => {
    /*
      CORE_RULES 13.36: a field nothing writes is not state, it is a comment
      with a type. Five categories are declared here before they have a
      producer, which is the same bet that `droppedOut`, `alive` and `records`
      each lost — so the list is explicit, and this test is the note to the
      ticket that finally writes one.

      It asserts the list is HONEST, not that it is empty: the spec names these
      categories, so the type should carry them, but nobody should be able to
      believe the game already tracks a mortgage.
    */
    expect(UNWRITTEN_CATEGORIES).toEqual([
      'housing',
      'vehicle',
      'debt',
      'assetIncome',
      'investment',
    ]);
  });
});
