import { withBusinessRescue, injectIntoBusinessRescue } from './business-rescue';
/**
 * Ticket 0603 acceptance tests — borrowing for a business and buying one
 * (simulation side).
 *
 * Measured first, on ten lives at thirty-five: with the loan paid out of the
 * owner's wages and the business sitting on its own cash, a typical financed
 * purchase put the owner into arrears for eleven to twenty-four years of the
 * next twenty, and the balance grew to the two-times ceiling. The business
 * holds the money, so the business pays — see `runBusinessesYear`.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { findBusinessType } from '@yearafter/content';
import {
  BUSINESS_LOAN_PRODUCTS,
  branchCostFor,
  newBusiness,
  type HeldLoan,
} from '@yearafter/finance';
import { advanceYear } from './advance';
import { continueAsChild, heirsIn } from './continue';
import {
  BUY_REFUSAL_LABELS,
  businessBorrowerFrom,
  businessProfitOf,
  businessesForSale,
  buyBusiness,
  closeBusiness,
  earnedOf,
  expandBusiness,
  expansionOffers,
  offerFor,
  openBusiness,
  openingOffers,
  purchaseOffers,
  runBusinessesYear,
  sellBusiness,
  viewOf,
} from './businesses';
import { standingFor } from './cards';
import { decide } from './decide';
import type { GameState } from './game-state';
import { payLoan, takeLoan } from './loans';
import { createNewGame } from './new-game';

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

function topUp(state: GameState, amount: number): GameState {
  const books = {
    ...state.finance,
    balance: (Number(state.finance.balance) + amount * 100) as never,
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:test-${amount}`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: (amount * 100) as never,
        source: 'A test windfall',
      },
    ],
  };
  return { ...state, finance: books, player: { ...state.player, cash: books.balance } };
}

function liveTo(seed: string, age: number): GameState {
  let state = createNewGame({ seed });
  let guard = 0;
  while (state.player.alive && state.player.age < age && (guard += 1) < 80) {
    state = answerEverything(advanceYear(state).state);
  }
  return state;
}

/** Thirty, $52,451 earned last year, $47,353 in the bank, and the year is 2030. */
const BASE = liveTo('biz-adult', 30);
const RICH = topUp(BASE, 400_000);
/** Exactly $60,000 in the bank: enough to put a fifth down on one of the listings, not to buy it. */
const FIXED = topUp(BASE, 60_000 - Math.floor(Number(BASE.player.cash) / 100));
const cashOf = (state: GameState): number => Math.round(Number(state.player.cash) / 100);

const loanOn = (
  businessId: string,
  balance: number,
  productId = 'loan.smallbiz',
  termLeft = 10,
): HeldLoan => ({
  productId,
  principal: dollars(balance),
  balance: dollars(balance),
  termLeft,
  inArrears: false,
  businessId,
});

const established = (from: GameState = RICH, typeId = 'biz.cleaning'): GameState => {
  const result = openBusiness(from, typeId);
  if (!result.ok) throw new Error(`could not open ${typeId}: ${result.error}`);
  const state = result.value.state;
  const business = state.businesses[0]!;
  return {
    ...state,
    businesses: [
      {
        ...business,
        openedYear: state.world.year - 4,
        last: {
          year: state.world.year - 1,
          revenue: 300_000,
          costs: 260_000,
          profit: 40_000,
          drawn: 20_000,
          injected: 0,
          turnedAway: 0,
          idle: 0,
        },
      },
    ],
  };
};

describe('0603 — what is for sale', () => {
  it('is the same four businesses however often anybody looks, and different ones next year', () => {
    const first = businessesForSale(RICH);
    expect(first).toHaveLength(4);
    expect(businessesForSale(RICH)).toEqual(first);
    expect(new Set(first.map((row) => row.id)).size).toBe(4);
    expect(first.map((row) => row.id)).toEqual([
      'biz:2030:clothing:for0',
      'biz:2030:electronics:for1',
      'biz:2030:clothing:for2',
      'biz:2030:autorepair:for3',
    ]);
    const later = { ...RICH, world: { ...RICH.world, year: RICH.world.year + 1 } };
    expect(businessesForSale(later).map((row) => row.id)).not.toEqual(first.map((row) => row.id));
  });

  it('offers nothing to a child', () => {
    expect(businessesForSale(createNewGame({ seed: 'for-sale-child' }))).toEqual([]);
    const refused = buyBusiness(
      createNewGame({ seed: 'for-sale-child' }),
      'biz:2030:clothing:for0',
    );
    expect(refused.ok ? undefined : refused.error).toBe('too-young');
  });

  it('is bought with cash at its asking price, as a transfer, and is no longer for sale', () => {
    const listing = businessesForSale(RICH)[0]!;
    expect(listing.ask).toBe(261_446);
    const before = cashOf(RICH);
    const result = buyBusiness(RICH, listing.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value.state;
    expect(cashOf(next)).toBe(before - 261_446);
    expect(next.player.cash).toBe(next.finance.balance);
    expect(next.businesses).toHaveLength(1);
    const owned = next.businesses[0]!;
    expect(owned.id).toBe(listing.id);
    expect(Number(owned.invested)).toBe(26_144_600);
    expect(owned.reputation).toBe(listing.business.reputation - 4);
    expect(owned.openedYear).toBe(2030 - listing.years);
    expect(next.loans).toHaveLength(0);
    expect(businessesForSale(next).map((row) => row.id)).not.toContain(listing.id);
    expect(result.value.entry.text).toMatch(/Bought .* for \$261,446\./);
    expect(
      next.finance.transactions.some(
        (row) => row.category === 'property' && row.source === `Bought ${listing.name}`,
      ),
    ).toBe(true);
  });

  it('refuses what is not for sale, what cannot be afforded, and a fourth business', () => {
    const missing = buyBusiness(RICH, 'biz:2030:nothing:for9');
    expect(missing.ok ? undefined : missing.error).toBe('no-such-listing');
    const poor = topUp(BASE, -(Math.floor(Number(BASE.player.cash) / 100) - 1_000));
    const refused = buyBusiness(poor, businessesForSale(poor)[0]!.id);
    expect(refused.ok ? undefined : refused.error).toBe('cannot-afford');
    expect(BUY_REFUSAL_LABELS['cannot-afford']).toMatch(/enough/);
    const owning = {
      ...RICH,
      businesses: [0, 1, 2].map((n) => ({ ...established().businesses[0]!, id: `biz:x${n}` })),
    };
    const full = buyBusiness(owning, 'biz:2030:clothing:for0');
    expect(full.ok ? undefined : full.error).toBe('too-many');
  });
});

describe('0603 — borrowing for it', () => {
  const listing = businessesForSale(FIXED)[0]!;

  it('puts the loan straight into the purchase: the money is booked as borrowed and spent, and never sits in cash', () => {
    expect(listing.ask).toBe(141_564);
    const offered = purchaseOffers(FIXED, listing.id)[0]!;
    expect(offered.product.id).toBe('loan.smallbiz');
    // 80% of $141,564, to the hundred below.
    expect(offered.decision.offered).toBe(113_200);
    const result = buyBusiness(FIXED, listing.id, { productId: 'loan.smallbiz', amount: 113_200 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value.state;
    // $141,564 less the $113,200 borrowed is $28,364 out of a $60,000 balance.
    expect(cashOf(next)).toBe(31_636);
    expect(next.loans).toHaveLength(1);
    expect(next.loans[0]!.businessId).toBe(listing.id);
    expect(next.loans[0]!.productId).toBe('loan.smallbiz');
    expect(Number(next.loans[0]!.balance)).toBe(11_320_000);
    expect(next.loans[0]!.termLeft).toBe(10);
    const rows = next.finance.transactions.filter((row) => row.year === 2030);
    const borrowed = rows.find(
      (row) => row.category === 'debt' && /Small Business Loan — to buy/.test(row.source),
    );
    expect(Number(borrowed?.amount)).toBe(11_320_000);
    const paid = rows.find((row) => row.source === `Bought ${listing.name}`);
    expect(Number(paid?.amount)).toBe(-14_156_400);
    expect(result.value.entry.text).toMatch(/\$113,200 of it borrowed/);
    expect(viewOf(next, next.businesses[0]!)!.loan).toMatchObject({
      name: 'Small Business Loan',
      owed: 113_200,
      termLeft: 10,
    });
  });

  it('brings a request for more than the lender will write down to what they offered', () => {
    const result = buyBusiness(FIXED, listing.id, {
      productId: 'loan.smallbiz',
      amount: 10_000_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number(result.value.state.loans[0]!.balance)).toBe(11_320_000);
  });

  it('refuses a loan nobody offers, and leaves everything exactly where it was', () => {
    const result = buyBusiness(FIXED, listing.id, { productId: 'loan.nonsense', amount: 100_000 });
    expect(result.ok ? undefined : result.error).toBe('no-such-product');
    // Borrowing and then not having the money to put in is a refusal too, not a half-done purchase.
    const poor = topUp(BASE, -(Math.floor(Number(BASE.player.cash) / 100) - 10_000));
    const dear = businessesForSale(poor)[0]!;
    const room = purchaseOffers(poor, dear.id)[0]!.decision.offered;
    const short = buyBusiness(poor, dear.id, { productId: 'loan.smallbiz', amount: room });
    expect(short.ok ? undefined : short.error).toBe('cannot-afford');
  });

  it('is not available as cash at the Loans screen, from anybody', () => {
    const result = takeLoan(RICH, 'loan.smallbiz', 50_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toBe('Declined');
    expect(result.value.body).toMatch(/only written for a business/);
    expect(result.value.state.loans).toHaveLength(0);
    expect(cashOf(result.value.state)).toBe(cashOf(RICH));
  });

  it('does not count against the owner as a borrower, as a mortgage does not', () => {
    const bought = buyBusiness(FIXED, listing.id, { productId: 'loan.smallbiz', amount: 113_200 });
    if (!bought.ok) throw new Error('could not buy');
    const withLoan = bought.value.state;
    const without = { ...withLoan, loans: [] };
    expect(standingFor(withLoan)).toEqual(standingFor(without));
  });

  it('is offered on opening a new business at the share a startup earns, and on opening another door', () => {
    const mine = topUp(BASE, 25_000 - Math.floor(Number(BASE.player.cash) / 100));
    const practice = openingOffers(mine, 'biz.accounting')[0]!;
    expect(practice.decision.approved).toBe(true);
    // 70% of $45,000; $52,451 of earnings carries $170,000, so the cost binds.
    expect(practice.decision.offered).toBe(31_500);
    expect(openingOffers(mine, 'biz.accounting')[1]!.decision.because).toBe('noRecord');
    const unaided = openBusiness(mine, 'biz.accounting');
    expect(unaided.ok ? undefined : unaided.error).toBe('cannot-afford');

    const opened = openBusiness(mine, 'biz.accounting', {
      productId: 'loan.smallbiz',
      amount: 31_500,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(cashOf(opened.value.state)).toBe(11_500);
    expect(Number(opened.value.state.loans[0]!.balance)).toBe(3_150_000);
    expect(opened.value.state.loans[0]!.businessId).toBe(opened.value.business.id);

    const lean = established();
    const base = topUp(lean, 5_000 - Math.floor(Number(lean.player.cash) / 100));
    const id = base.businesses[0]!.id;
    // $13,000 to open another door; $5,000 in the bank cannot, with no loan.
    expect(branchCostFor(findBusinessType('biz.cleaning')!)).toBe(13_000);
    const plain = expandBusiness(base, id);
    expect(plain.ok ? undefined : plain.error).toBe('cannot-afford');
    expect(expansionOffers(base, id)[0]!.decision.offered).toBe(10_400);
    const grown = expandBusiness(base, id, { productId: 'loan.smallbiz', amount: 10_400 });
    expect(grown.ok).toBe(true);
    if (!grown.ok) return;
    expect(cashOf(grown.value.state)).toBe(2_400);
    expect(grown.value.state.businesses[0]!.branches).toHaveLength(1);
    expect(Number(grown.value.state.loans[0]!.balance)).toBe(1_040_000);
  });
});

describe('0603 — the business pays its own loan', () => {
  const type = findBusinessType('biz.cafe')!;
  const mature = (id = 'biz:2000:cafe:0') => ({
    ...newBusiness(type, id, 'The Test Cafe', 2000, 1),
    cash: dollars(200_000),
    reputation: 60,
    staff: type.staff,
  });
  const input = {
    year: 2010,
    seed: 'service',
    market: 'normal' as const,
    holdsJob: false,
    stat: () => 50,
  };

  it('pays interest and a year of principal from the till, and not from the owner', () => {
    const business = mature();
    const year = runBusinessesYear({
      ...input,
      businesses: [business],
      loans: [loanOn(business.id, 100_000)],
      available: 0,
    });
    // $100,000 at 8.75% is $108,750 owed; a year of a ten-year annuity on that is $16,759.
    expect(year.loans).toHaveLength(1);
    expect(Number(year.loans[0]!.balance)).toBe(9_199_100);
    expect(year.loans[0]!.inArrears).toBe(false);
    expect(year.loans[0]!.termLeft).toBe(9);
    expect(year.serviced).toEqual([business.id]);
    expect(year.businesses[0]!.last?.repaid).toBe(16_759);
    // Nothing came out of the owner's pocket.
    expect(year.transactions.some((row) => /loan payment/.test(row.source))).toBe(false);
  });

  it("pays the draw after the bank, so a loan makes the owner's year smaller", () => {
    const business = mature();
    const free = runBusinessesYear({ ...input, businesses: [business], loans: [], available: 0 });
    const owing = runBusinessesYear({
      ...input,
      businesses: [business],
      loans: [loanOn(business.id, 100_000)],
      available: 0,
    });
    expect(free.drawn - owing.drawn).toBeGreaterThan(0);
    expect(free.drawn - owing.drawn).toBeLessThanOrEqual(16_759);
  });

  it('has the owner explicitly choose to meet a shortfall', () => {
    const business = { ...mature(), cash: dollars(0) };
    const year = runBusinessesYear({
      ...input,
      businesses: [business],
      loans: [loanOn(business.id, 3_000_000)],
      available: 50_000_000,
    });
    // $3,000,000 at 8.75% is $3,262,500; the year's payment on that is $502,783, far more than a cafe clears.
    expect(year.businesses[0]!.last?.repaid).toBeUndefined();
    expect(year.transactions.some((row) => row.amount < 0)).toBe(false);
    const review = withBusinessRescue(
      {
        ...topUp(RICH, 50_000_000),
        world: { ...RICH.world, year: input.year },
        businesses: year.businesses,
        loans: year.loans,
      },
      year.rescues,
    );
    const answered = injectIntoBusinessRescue(review, business.id);
    expect(answered.ok).toBe(true);
    if (!answered.ok) throw new Error(answered.error);
    expect(answered.value.state.businesses[0]!.last?.repaid).toBe(502_783);
    const stepIn = answered.value.state.finance.transactions.find((row) =>
      /keep it going/.test(row.source),
    );
    expect(stepIn).toBeDefined();
    expect(Number(stepIn!.amount)).toBeLessThan(0);
    expect(answered.value.state.loans[0]!.inArrears).toBe(false);
  });

  it('falls behind, and grows, when nobody can cover it', () => {
    const business = { ...mature(), cash: dollars(0) };
    const year = runBusinessesYear({
      ...input,
      businesses: [business],
      loans: [loanOn(business.id, 3_000_000)],
      available: 0,
    });
    expect(year.loans[0]!.inArrears).toBe(true);
    expect(Number(year.loans[0]!.balance)).toBe(326_250_000);
    expect(year.rescues[0]!.loanPayment).toBe(502_783);
    expect(year.businesses[0]!.last?.repaid).toBeUndefined();
  });

  it('says so when it has paid the last of it, and the loan goes', () => {
    const business = mature();
    const year = runBusinessesYear({
      ...input,
      businesses: [business],
      loans: [loanOn(business.id, 5_000, 'loan.smallbiz', 1)],
      available: 0,
    });
    expect(year.loans).toHaveLength(0);
    expect(year.lines.join(' ')).toMatch(/paid off its loan/);
  });

  it('holds the failed business and its accrued loan for a rescue choice', () => {
    const losing = {
      ...newBusiness(type, 'biz:2000:cafe:0', 'The Losing Place', 2000, 0.55),
      staff: type.staff * 2,
      cash: dollars(0),
      reputation: 5,
    };
    const year = runBusinessesYear({
      ...input,
      year: 2001,
      market: 'severeRecession',
      stat: () => 10,
      businesses: [losing],
      loans: [loanOn(losing.id, 100_000)],
      available: 0,
    });
    expect(year.businesses).toHaveLength(1);
    expect(year.rescues).toHaveLength(1);
    expect(year.loans).toHaveLength(1);
    expect(Number(year.loans[0]!.balance)).toBe(10_875_000);
    expect(year.serviced).toEqual([losing.id]);
  });

  it('is serviced by the business in a real year, and by the household only when there is no business left', () => {
    const state = established();
    const id = state.businesses[0]!.id;
    const attached = { ...state, loans: [loanOn(id, 20_000)] };
    const next = advanceYear(attached).state;
    const row = (s: GameState) => s.loans.find((loan) => loan.businessId === id);
    expect(Number(row(next)!.balance)).toBeLessThan(2_000_000);
    expect(row(next)!.termLeft).toBe(9);
    expect(
      next.finance.transactions.some(
        (t) => t.year === 2031 && /Small Business Loan — payment/.test(t.source),
      ),
    ).toBe(false);

    // The business is gone; the loan is the person's.
    const orphaned = { ...state, businesses: [], loans: [loanOn('biz:gone', 20_000)] };
    const after = advanceYear(orphaned).state;
    expect(
      after.finance.transactions.some(
        (t) => t.year === 2031 && /Small Business Loan — payment/.test(t.source),
      ),
    ).toBe(true);
    expect(after.loans.find((loan) => loan.businessId === 'biz:gone')?.termLeft).toBe(9);
  });
});

describe('0603 — getting out with a lender to pay', () => {
  it('pays the bank first out of a sale, and the owner gets what is left', () => {
    const state = established();
    const id = state.businesses[0]!.id;
    const attached = { ...state, loans: [loanOn(id, 10_000)] };
    const offer = offerFor(attached, id)!;
    const before = cashOf(attached);
    const sold = sellBusiness(attached, id);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.value.repaid).toBe(10_000);
    expect(sold.value.state.loans).toHaveLength(0);
    expect(cashOf(sold.value.state)).toBe(before + offer.proceeds - 10_000);
    expect(sold.value.entry.text).toMatch(/\$10,000 of it went to the bank/);
    expect(
      sold.value.state.finance.transactions.some(
        (t) =>
          t.category === 'debt' &&
          Number(t.amount) === -1_000_000 &&
          /settled on the sale/.test(t.source),
      ),
    ).toBe(true);
  });

  it('takes the whole sale for a loan bigger than it, and leaves the rest owed', () => {
    const state = established();
    const id = state.businesses[0]!.id;
    const attached = { ...state, loans: [loanOn(id, 5_000_000)] };
    const offer = offerFor(attached, id)!;
    const before = cashOf(attached);
    const sold = sellBusiness(attached, id);
    if (!sold.ok) throw new Error('could not sell');
    expect(sold.value.repaid).toBe(offer.proceeds);
    expect(cashOf(sold.value.state)).toBe(before);
    expect(Number(sold.value.state.loans[0]!.balance)).toBe((5_000_000 - offer.proceeds) * 100);
    // What is left is the owner's, on the books of nobody's business.
    expect(sold.value.state.businesses).toHaveLength(0);
  });

  it('does the same when the doors close', () => {
    const state = established();
    const id = state.businesses[0]!.id;
    const attached = { ...state, loans: [loanOn(id, 1_000)] };
    const closed = closeBusiness(attached, id);
    if (!closed.ok) throw new Error('could not close');
    expect(closed.value.repaid).toBe(1_000);
    expect(closed.value.state.loans).toHaveLength(0);
  });

  it('is the only way to hold a loan on something, so a business-loan product is never offered a second lender', () => {
    expect(BUSINESS_LOAN_PRODUCTS.map((row) => row.type)).toEqual(['business', 'business']);
  });
});

describe('0603 — what a lender is shown', () => {
  it('counts wages and what the businesses clear, and nothing a sale or a loan brought in', () => {
    const state = established();
    const id = state.businesses[0]!.id;
    expect(earnedOf(state)).toBe(52_451);
    // A sale lands as a positive `property` row and a loan as a positive `debt` row.
    // Neither is something a lender should read as earnings (finding 35).
    const sold = sellBusiness({ ...state, loans: [loanOn(id, 1_000)] }, id);
    if (!sold.ok) throw new Error('could not sell');
    expect(earnedOf(sold.value.state)).toBe(52_451);
    expect(businessBorrowerFrom(sold.value.state).earned).toBe(52_451);
  });

  it('averages the last three years of each business, and never lets a bad one subtract', () => {
    const state = established();
    const one = state.businesses[0]!;
    const with3 = (profits: number[]) => ({ ...state, businesses: [{ ...one, profits }] });
    expect(businessProfitOf(with3([30_000, 60_000, 90_000]))).toBe(60_000);
    expect(businessProfitOf(with3([-50_000, -10_000, 20_000]))).toBe(0);
    expect(businessProfitOf(with3([]))).toBe(0);
    const two = {
      ...state,
      businesses: [
        { ...one, profits: [40_000] },
        { ...one, id: 'biz:b', profits: [-90_000] },
      ],
    };
    expect(businessProfitOf(two)).toBe(40_000);
  });

  it('lets a loan be paid down by itself, so two businesses with the same lender are two loans', () => {
    const state = established();
    const first = state.businesses[0]!;
    const second = { ...first, id: 'biz:second' };
    const both = {
      ...state,
      businesses: [first, second],
      loans: [loanOn(first.id, 50_000), loanOn(second.id, 80_000)],
    };
    const paid = payLoan(both, 'loan.smallbiz', 20_000, 'biz:second');
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    const balances = paid.value.state.loans.map((loan) => [
      loan.businessId,
      Number(loan.balance) / 100,
    ]);
    expect(balances).toEqual([
      [first.id, 50_000],
      ['biz:second', 60_000],
    ]);
    // Clearing one leaves the other exactly where it was.
    const cleared = payLoan(both, 'loan.smallbiz', 50_000, first.id);
    if (!cleared.ok) throw new Error('could not clear');
    expect(cleared.value.title).toBe('Cleared');
    expect(
      cleared.value.state.loans.map((loan) => [loan.businessId, Number(loan.balance) / 100]),
    ).toEqual([['biz:second', 80_000]]);
    // And one that is not tied to a business cannot be reached by naming a business.
    const missing = payLoan(both, 'loan.smallbiz', 1_000);
    expect(missing.ok ? undefined : missing.error).toBe('noSuchLoan');
  });
});

describe('0603 — a lender is paid at a death too', () => {
  it('takes what is owed on a business out of what the heir is handed for it', () => {
    let tried = 0;
    for (let i = 0; i < 12 && tried < 1; i += 1) {
      let state = established(topUp(liveTo(`biz-owed-${i}`, 30), 400_000), 'biz.cafe');
      let guard = 0;
      while (state.player.alive && (guard += 1) < 90)
        state = answerEverything(advanceYear(state).state);
      const heir = heirsIn(state.family)[0];
      const business = state.businesses[0];
      if (state.player.alive || !heir || !business) continue;
      // The loan is put on at the end: a ten-year loan taken at thirty would have been paid off long before.
      const encumbered = { ...state, loans: [loanOn(business.id, 20_000)] };
      // Sold, not handed on (0604): the lender is paid out of the sale either way.
      const clear = continueAsChild({ ...state, loans: [] }, heir.id, { keepBusinesses: false });
      const owing = continueAsChild(encumbered, heir.id, { keepBusinesses: false });
      if (!clear || !owing) continue;
      tried += 1;
      const gift = (s: GameState): number =>
        Number(
          s.finance.transactions.find(
            (row) => row.category === 'gift' && /business/i.test(row.source),
          )?.amount ?? 0,
        ) / 100;
      expect(gift(clear)).toBeGreaterThan(20_000);
      expect(gift(clear) - gift(owing)).toBe(20_000);
    }
    expect(tried).toBe(1);
  });
});
