/**
 * Ticket 0304 acceptance tests — the finance dashboard's numbers.
 *
 * Spec 19 names nine things. The interesting assertions are not that the
 * arithmetic works — it is four divisions — but that the screen is shown the
 * truth in the cases where a dashboard usually lies: a year with no income, a
 * year with nothing at all, and the four fields that have no system behind them.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { EMPTY_LEDGER, postAll, type Ledger } from './ledger';
import { NOT_YET_OWNED, childMonthlyCost, summariseFinances } from './summary';
import { CHILD_SHARE, childShare } from './living';

const workingYear = (): Ledger =>
  postAll(EMPTY_LEDGER, 2030, 30, [
    { category: 'salary', amount: dollars(50_000), source: 'Pay' },
    { category: 'gift', amount: dollars(4_000), source: 'Mom gave you money' },
    { category: 'tax', amount: dollars(-11_000), source: 'Tax' },
    { category: 'living', amount: dollars(-34_000), source: 'Living costs' },
  ]).ledger;

describe('the four figures that are real', () => {
  const books = summariseFinances(workingYear(), 2030);

  it('reports the balance, and a net worth that is the same number for a stated reason', () => {
    expect(Number(books.balance)).toBe(900_000);
    expect(Number(books.netWorth)).toBe(Number(books.balance));
    // The flag is what lets the screen SAY why they agree rather than printing
    // one number twice (CORE_RULES 13.26). It goes false in 0307.
    expect(books.onlyCash).toBe(true);
  });

  it('gives ONE general income figure, counting everything that came in', () => {
    // Spec 23: one figure, not a list of income types. A year's money can
    // arrive as pay, a paper round or a gift, and a figure that counted only
    // wages would be wrong for most of a childhood.
    expect(Number(books.income)).toBe(5_400_000);
  });

  it('rates tax against EARNED income, not against everything that came in', () => {
    /*
      $11,000 of tax on $50,000 of wages is 22%. Counting the $4,000 gift would
      make it 20% and would be answering a different question — spec 1846 draws
      the same line for the canonical accounting: "cash gifts change cash but
      are not earned income."
    */
    expect(Math.round(books.taxRate * 100)).toBe(22);
  });

  it('divides the year’s outflow into twelve, and twelve of them make the year', () => {
    // Spec 20 wants a MONTHLY figure from a simulation that only has years.
    expect(Number(books.monthlyOutflow)).toBe(Math.round(4_500_000 / 12));
    expect(Number(books.monthlyOutflow) * 12).toBeCloseTo(4_500_000, -2);
  });
});

describe('the years a dashboard usually lies about', () => {
  it('says nothing came in rather than reporting a rate on nothing', () => {
    /*
      Most of a childhood, and every year somebody is between jobs. A tax rate
      of 0% is technically true and reads as a tax break; the screen is given a
      zero rate AND a zero income so it can say the honest thing instead.
    */
    const childhood = postAll(EMPTY_LEDGER, 2010, 10, [
      { category: 'gift', amount: dollars(40), source: 'Dad gave you money' },
    ]).ledger;
    const books = summariseFinances(childhood, 2010);
    expect(Number(books.income)).toBe(4_000);
    expect(books.taxRate).toBe(0);
    expect(Number(books.monthlyOutflow)).toBe(0);
    expect(books.quiet).toBe(false);
  });

  it('knows a year in which nothing at all happened', () => {
    const books = summariseFinances(workingYear(), 2031);
    expect(books.quiet).toBe(true);
    expect(Number(books.income)).toBe(0);
    // And the balance is still the balance — it belongs to the life, not to
    // the year, which is the one number on this screen that is never about 2031.
    expect(Number(books.balance)).toBe(900_000);
  });

  it('never reports a tax rate above 100% or below zero', () => {
    // A ledger can hold a year whose tax row survived while its salary row was
    // floored to nothing — 0303 found that exact shape when rent was posted
    // ahead of tax. The screen should show a strange number, not an impossible
    // one.
    const odd = postAll(EMPTY_LEDGER, 2040, 40, [
      { category: 'salary', amount: dollars(1_000), source: 'Pay' },
      { category: 'tax', amount: dollars(-9_000), source: 'Tax' },
    ]).ledger;
    const books = summariseFinances(odd, 2040);
    expect(books.taxRate).toBeLessThanOrEqual(1);
    expect(books.taxRate).toBeGreaterThanOrEqual(0);
  });
});

describe('what is not built yet', () => {
  it('is a list that is meant to shrink, and names who retires each one', () => {
    /*
      The same device as `UNWRITTEN_CATEGORIES` in the ledger, and for the same
      reason: four rows rendered as $0 would each be a false statement, and the
      list is what makes the gap deliberate rather than forgotten. This test is
      the note to 0305, 0307, 0308 and v0.05 — the ticket that builds one has to
      come here and delete a line.
    */
    // `credit` came off this list in 0305, which is the list doing its job.
    expect(NOT_YET_OWNED.map((row) => row.key)).toEqual(['assets', 'liabilities', 'investments']);
    for (const row of NOT_YET_OWNED) {
      expect(row.arrives, `${row.key} does not say when it arrives`).toMatch(/^(\d{4}|v\d\.\d\d)$/);
    }
  });
});

describe('what a child costs, which is the one contextual expense that exists', () => {
  it('is the household’s own number, not a second model', () => {
    /*
      Spec 20 by name: "open a child to see that child's monthly cost". Until
      0304 that number came from `monthlyCostOf` in `@yearafter/parenting`, a
      placeholder written before any ledger existed — so the child's page showed
      $420 a month while the living phase charged the household something else
      entirely. One fact, two derivations (CORE_RULES 13.23).
    */
    const standard = 40_000;
    const monthly = Number(childMonthlyCost(standard, 1, childShare(8)));
    expect(monthly).toBe(Math.round((standard * 1 * CHILD_SHARE * 1.2 * 100) / 12));
  });

  it('costs more for a teenager, and more in an expensive city', () => {
    expect(Number(childMonthlyCost(40_000, 1, childShare(15)))).toBeGreaterThan(
      Number(childMonthlyCost(40_000, 1, childShare(8))),
    );
    // A child in San Francisco costs more than one in Memphis, which is true
    // and which no version of this number before 0304 could say.
    expect(Number(childMonthlyCost(40_000, 1.68, childShare(8)))).toBeGreaterThan(
      Number(childMonthlyCost(40_000, 0.86, childShare(8))),
    );
  });
});
