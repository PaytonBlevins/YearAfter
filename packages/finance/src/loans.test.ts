/**
 * Ticket 0307 acceptance tests — the loan engine.
 *
 * The interesting assertions are about REACHABILITY and BOUNDS. This build has
 * shipped three systems nobody could reach (a $9,000 wedding, a $650 child ask,
 * a card ladder with no bottom rung) and one that compounded a $200 balance into
 * $1.6 billion. Both failure modes get a test here.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  CAN_BORROW_FROM_AGE,
  DEBT_CEILING,
  LOAN_BALANCE_CEILING,
  LOAN_PRODUCTS,
  LOAN_TYPES_NOT_YET_BUILT,
  MAX_ACTIVE_LOANS,
  applyForLoan,
  borrowingRoom,
  debtLoad,
  findLoanProduct,
  runLoanYear,
  totalBorrowed,
  yearlyPaymentFor,
  type Borrower,
  type HeldLoan,
} from './loans';

const loan = (
  productId: string,
  principal: number,
  balance = principal,
  termLeft = 5,
): HeldLoan => ({
  productId,
  principal: dollars(principal),
  balance: dollars(balance),
  termLeft,
  inArrears: false,
});

const borrower = (over: Partial<Borrower> = {}): Borrower => ({
  standing: 'good',
  income: 60_000,
  employed: true,
  studying: false,
  age: 30,
  loans: [],
  cardDebt: 0,
  tuitionAhead: 0,
  ...over,
});

const student = (over: Partial<Borrower> = {}): Borrower =>
  borrower({
    standing: 'none',
    income: 0,
    employed: false,
    studying: true,
    age: 18,
    tuitionAhead: 37_600,
    ...over,
  });

describe('reachability — who can actually borrow', () => {
  it('lends to an eighteen-year-old with nothing, for tuition and only for tuition', () => {
    /*
      THE WHOLE TICKET. Measured before it was written: cash at eighteen is $0 at
      p10, median, p90 AND max — they have just moved out and the living phase
      has taken everything — and a college place costs $7,436 a year.

      No income test and no credit test, because a student has neither and
      testing them against either makes the product unreachable by exactly the
      people it exists for (CORE_RULES 13.16, for the fourth time in this build).
    */
    const decision = applyForLoan(findLoanProduct('loan.student')!, student());
    expect(decision.approved).toBe(true);
    expect(Number(decision.offered)).toBeGreaterThan(0);
  });

  it('refuses a student loan to somebody with no degree left to take', () => {
    // Otherwise it is the cheapest money in the game, with no income test, for
    // anybody at any age, to spend on anything. The bound is the tuition.
    const graduate = student({ tuitionAhead: 0 });
    expect(applyForLoan(findLoanProduct('loan.student')!, graduate).approved).toBe(false);
  });

  it('lets a student top up year by year up to the cost of the degree', () => {
    /*
      A flat cap was the first version and it produced a readable failure: a
      character borrowed $12,000 against a $37,600 degree, ran out in the second
      year and dropped out. A student loan that cannot cover a degree hands
      somebody half a bridge.
    */
    const product = findLoanProduct('loan.student')!;
    const partway = student({ loans: [loan('loan.student', 12_000)] });
    expect(applyForLoan(product, partway).approved).toBe(true);
    expect(borrowingRoom(product, partway)).toBeCloseTo(37_600 - 12_000, 0);

    const funded = student({ loans: [loan('loan.student', 37_600)] });
    const spent = applyForLoan(product, funded);
    expect(spent.approved).toBe(false);
    // And says the tuition ran out, not that their debt capacity did. A student
    // loan tests neither income nor credit, so a capacity refusal would be
    // about a test that never happened — caught by reading the built screen,
    // where a funded student was told "You owe as much as they think you can
    // carry".
    expect(spent.because).toBe('fullyDrawn');
    expect(applyForLoan(product, borrower({ income: 0 })).because).not.toBe('fullyDrawn');
  });

  it('refuses everybody below the age of borrowing', () => {
    for (const product of LOAN_PRODUCTS) {
      const decision = applyForLoan(product, borrower({ age: CAN_BORROW_FROM_AGE - 1 }));
      expect(decision.approved, product.id).toBe(false);
      expect(decision.because, product.id).toBe('tooYoung');
    }
  });

  it('puts every other product behind an income and a standing', () => {
    const broke = borrower({ standing: 'poor', income: 0, employed: false });
    for (const product of LOAN_PRODUCTS.filter((row) => !row.needsStudying)) {
      expect(applyForLoan(product, broke).approved, product.id).toBe(false);
    }
  });

  it('blames the income rather than the credit when both would refuse', () => {
    /*
      MEASURED, NOT CHOSEN. Built the other way round first, then counted across
      120 lives: the standing gate refused 26,550 rows and all 26,550 of them
      would have failed the income gate behind it. Not a majority — every one.
      So "your credit is not there yet" was never the real answer; it was the
      first gate in the line wearing the label of the one behind it, and it sent
      the player off to fix a thing that takes ten years instead of a thing they
      could fix next year.

      Ordering by which gate is reported is only honest when the reported one is
      the one actually holding the door (CORE_RULES 13.49).
    */
    const broke = borrower({ standing: 'none', income: 0, employed: false });
    for (const product of LOAN_PRODUCTS.filter((row) => !row.needsStudying)) {
      expect(applyForLoan(product, broke).because, product.id).toBe('income');
    }
  });

  it('gives a refused column something that differs from row to row', () => {
    /*
      CORE_RULES 13.26, caught for the fourth time in four tickets: reading the
      real screen at nineteen showed five rows all saying "Your credit is not
      there yet". Reordering the gates alone would have printed one identical
      sentence in place of another, so what the screen shows is the THRESHOLD,
      and this asserts there is more than one of them to show.
    */
    const bars = LOAN_PRODUCTS.filter((row) => !row.needsStudying).map((row) => row.needsIncome);
    expect(new Set(bars).size).toBeGreaterThan(2);
    expect(bars.every((bar) => bar > 0)).toBe(true);
    // And in order, because the column is read top to bottom and a rung out of
    // sequence reads as noise. Declaration order IS the ladder.
    expect(bars).toEqual([...bars].sort((a, b) => a - b));
  });
});

describe('bounds — spec 1381’s exploit loops', () => {
  it('counts card debt against borrowing room', () => {
    /*
      Spec 1381: "underwriting considers obligations". The loop this closes is
      borrow-to-pay-a-card, then borrow again against the limit that freed up.
      One ceiling across everything owed.
    */
    const product = findLoanProduct('loan.personal')!;
    // An income where the ceiling actually binds rather than the product's own
    // cap — otherwise the test passes on a comparison of two identical caps and
    // proves nothing about obligations at all.
    const clear = borrowingRoom(product, borrower({ income: 40_000, cardDebt: 0 }));
    const loaded = borrowingRoom(product, borrower({ income: 40_000, cardDebt: 45_000 }));
    expect(loaded).toBeLessThan(clear);
    expect(loaded).toBeCloseTo(40_000 * DEBT_CEILING - 45_000, 0);
  });

  it('caps total borrowing against income across every loan', () => {
    const income = 50_000;
    let held: HeldLoan[] = [];
    for (const product of LOAN_PRODUCTS.filter((row) => !row.needsStudying)) {
      const decision = applyForLoan(
        product,
        borrower({ income, loans: held, standing: 'excellent' }),
      );
      if (decision.approved) held = [...held, loan(product.id, Number(decision.offered) / 100)];
    }
    expect(Number(totalBorrowed(held)) / 100).toBeLessThanOrEqual(income * DEBT_CEILING + 100);
  });

  it('holds nobody to more than four loans at once', () => {
    const full = LOAN_PRODUCTS.slice(0, MAX_ACTIVE_LOANS).map((product) => loan(product.id, 1_000));
    const decision = applyForLoan(
      LOAN_PRODUCTS[5]!,
      borrower({ loans: full, income: 400_000, standing: 'excellent' }),
    );
    expect(decision.approved).toBe(false);
    expect(decision.because).toBe('tooManyLoans');
  });

  it('never lets a balance run away, however long it is left', () => {
    /*
      THE 0306 DEFECT, PREVENTED AT BIRTH. A frozen card compounded $200 into
      $1.6 billion across a working life, and nobody noticed because nobody had
      run a population for sixty years. A loan in arrears is the same shape, so
      it gets the rule from the start rather than after the fact.
    */
    let loans: readonly HeldLoan[] = [loan('loan.starter', 5_000)];
    for (let year = 0; year < 60; year += 1) loans = runLoanYear(loans, 0, false).loans;
    expect(Number(loans[0]?.balance) / 100).toBeLessThanOrEqual(5_000 * LOAN_BALANCE_CEILING + 1);
    expect(loans[0]?.inArrears).toBe(true);
  });
});

describe('a year of owing', () => {
  it('amortises: a full term of payments clears it', () => {
    const product = findLoanProduct('loan.personal')!;
    let loans: readonly HeldLoan[] = [loan('loan.personal', 20_000, 20_000, product.termYears)];
    for (let year = 0; year < product.termYears + 1 && loans.length > 0; year += 1) {
      loans = runLoanYear(loans, 100_000, false).loans;
    }
    expect(loans).toHaveLength(0);
  });

  it('defers a student loan while studying, and still charges for it', () => {
    // A loan that quietly costs nothing for four years would make taking one
    // free, and a decision with no cost is not one.
    const before = loan('loan.student', 20_000);
    const year = runLoanYear([before], 100_000, true);
    expect(year.charges).toHaveLength(0);
    expect(Number(year.loans[0]?.balance)).toBeGreaterThan(Number(before.balance));
  });

  it('falls into arrears rather than into court', () => {
    // Spec 32's precedent for cards, applied here: the account goes bad, and
    // nothing else happens to you.
    const year = runLoanYear([loan('loan.starter', 6_000)], 0, false);
    expect(year.missed).toEqual(['loan.starter']);
    expect(year.loans[0]?.inArrears).toBe(true);
  });

  it('drops a loan that has been paid off rather than keeping a zero row', () => {
    const year = runLoanYear([loan('loan.starter', 300, 300, 1)], 100_000, false);
    expect(year.settled).toEqual(['loan.starter']);
    expect(year.loans).toHaveLength(0);
  });

  it('asks a revolving line for a share, and an instalment loan for a payment', () => {
    const line = findLoanProduct('loan.creditline')!;
    const term = findLoanProduct('loan.personal')!;
    expect(line.termYears).toBe(0);
    expect(yearlyPaymentFor(line, 10_000, 0)).toBeLessThan(10_000);
    // An amortised payment covers interest and then some, or it never clears.
    expect(yearlyPaymentFor(term, 10_000, 5)).toBeGreaterThan(10_000 * term.apr);
  });
});

describe('what is not built yet', () => {
  it('names the three loan types that cannot exist, and what each waits on', () => {
    /*
      Spec 1857 lists five types. Secured needs something to secure it against,
      business needs a business, and wealth/private needs a portfolio — v0.05,
      v0.06 and 0308. Same device as `UNWRITTEN_CATEGORIES` and `NOT_YET_OWNED`;
      this test is the note to the tickets that retire them.
    */
    expect(LOAN_TYPES_NOT_YET_BUILT.map((row) => row.type)).toEqual([
      'secured',
      'business',
      'wealthPrivate',
    ]);
    for (const row of LOAN_TYPES_NOT_YET_BUILT) {
      expect(row.arrives, `${row.type} does not say when it arrives`).toMatch(
        /^(\d{4}|v\d\.\d\d)$/,
      );
    }
  });

  it('ships products only for the two types that can', () => {
    const built = new Set(LOAN_PRODUCTS.map((product) => product.type));
    expect([...built].sort()).toEqual(['lineOfCredit', 'personal']);
  });
});

describe('debt load, which spec 25 has been waiting for since 0305', () => {
  it('is undefined for somebody who owes nothing', () => {
    // CORE_RULES 13.46 and 13.48: owing nothing is the ordinary state of
    // affairs, not a demonstrated virtue, and a term that paid for it would
    // make never borrowing a way to farm a standing.
    expect(debtLoad(0, 60_000)).toBe(0);
    expect(debtLoad(0, 0)).toBeUndefined();
  });

  it('rises with what is owed and falls with what is earned', () => {
    expect(debtLoad(40_000, 60_000)!).toBeGreaterThan(debtLoad(10_000, 60_000)!);
    expect(debtLoad(40_000, 200_000)!).toBeLessThan(debtLoad(40_000, 60_000)!);
  });

  it('is fully loaded for somebody who owes with no income at all', () => {
    expect(debtLoad(5_000, 0)).toBe(1);
  });
});
