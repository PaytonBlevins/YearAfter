/**
 * Ticket 0603 acceptance tests — borrowing for a business, and buying one that
 * exists (finance side).
 *
 * Every expectation about money is a number written out, not a formula the code
 * under test could share with itself. The numbers come from working the
 * annuity out by hand: a 10-year loan at 8.75% costs 15.411 cents a year per
 * dollar borrowed, at 7.25% it costs 14.403 (CORE_RULES 13.92).
 */

import { describe, expect, it } from 'vitest';
import { BUSINESS_TYPES, findBusinessType } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import {
  ASK_PREMIUM_MIN,
  BUSINESS_LOAN_PRODUCTS,
  COVER_SHARE,
  LISTINGS_PER_YEAR,
  MAX_ACTIVE_LOANS,
  SALE_Z_LIMIT,
  TRANSITION_REPUTATION,
  WINDOW_DRESSING_MAX,
  applyForLoan,
  businessBought,
  businessLoanFor,
  businessLoanOffersFor,
  businessSaleOf,
  borrowingRoom,
  findLoanProduct,
  isBusinessLoan,
  listingFor,
  paymentFactor,
  personalBorrowed,
  personalLoans,
  reportedProfitOf,
  reserveFor,
  totalBorrowed,
  withBusinessLoan,
  type Borrower,
  type BusinessBorrower,
  type BusinessPurchase,
  type HeldLoan,
  type ListingDraws,
} from './index';

const small = BUSINESS_LOAN_PRODUCTS.find((row) => row.id === 'loan.smallbiz')!;
const commercial = BUSINESS_LOAN_PRODUCTS.find((row) => row.id === 'loan.commercial')!;

const lender = (over: Partial<BusinessBorrower> = {}): BusinessBorrower => ({
  standing: 'good',
  age: 35,
  earned: 80_000,
  businessProfit: 0,
  obligations: 0,
  ...over,
});

const buying = (over: Partial<BusinessPurchase> = {}): BusinessPurchase => ({
  kind: 'open',
  cost: 100_000,
  targetProfit: 0,
  ...over,
});

const held = (
  productId: string,
  balance: number,
  businessId?: string,
  termLeft = 10,
): HeldLoan => ({
  productId,
  principal: dollars(balance),
  balance: dollars(balance),
  termLeft,
  inArrears: false,
  ...(businessId ? { businessId } : {}),
});

describe('0603 — what a business lender will write', () => {
  it('prices the annuity the way the numbers in this file assume', () => {
    expect(paymentFactor(0.0875, 10)).toBeCloseTo(0.15411, 5);
    expect(paymentFactor(0.0725, 10)).toBeCloseTo(0.144027, 5);
  });

  it('lends a share of the cost when the owner earns plenty', () => {
    const decision = businessLoanFor(small, buying(), lender());
    // 70% of $100,000. Half of $80,000 would carry $259,555, so the cost binds.
    expect(decision.approved).toBe(true);
    expect(decision.offered).toBe(70_000);
    expect(decision.yearlyPayment).toBe(10_788);
  });

  it('lends exactly the stated share of a round price, not a hundred dollars under it', () => {
    // 0.7 of 45,000 is 31499.999999999996 in floating point.
    expect(businessLoanFor(small, buying({ cost: 45_000 }), lender()).offered).toBe(31_500);
    expect(businessLoanFor(small, buying({ cost: 90_000, kind: 'buy' }), lender()).offered).toBe(
      72_000,
    );
  });

  it('is bounded by what the owner can repay when that is the smaller number', () => {
    // Cost $1,000,000 so the 70% share ($700,000) is out of the way.
    const plain = businessLoanFor(small, buying({ cost: 1_000_000 }), lender());
    expect(plain.offered).toBe(259_500); // half of $80,000 / 0.154110
    // $12,000 a year already committed comes straight off what can go on this.
    const owing = businessLoanFor(
      small,
      buying({ cost: 1_000_000 }),
      lender({ obligations: 12_000 }),
    );
    expect(owing.offered).toBe(181_600); // $28,000 / 0.154110
  });

  it('counts the businesses already owned, and the one being bought, as part of what repays it', () => {
    // No wages at all: $40,000 from businesses already owned and $40,000 from the target.
    const decision = businessLoanFor(
      small,
      buying({ cost: 1_000_000, kind: 'buy', targetProfit: 40_000 }),
      lender({ earned: 0, businessProfit: 40_000 }),
    );
    expect(decision.offered).toBe(259_500);
    // The same person with neither earns nothing a lender can see.
    const nothing = businessLoanFor(small, buying({ cost: 1_000_000 }), lender({ earned: 0 }));
    expect(nothing.approved).toBe(false);
    expect(nothing.because).toBe('cover');
  });

  it('writes a different loan for buying one that earns than for starting one that does not', () => {
    const purchase = buying({ kind: 'buy', cost: 400_000, targetProfit: 90_000 });
    const noWages = lender({ earned: 0 });
    // Half of the $90,000 the books show, over 0.154110, is $291,999: the cover binds on the dearer loan.
    expect(businessLoanFor(small, purchase, noWages).offered).toBe(291_900);
    // The cheaper product asks for less back per dollar, but lends only 75% of the price.
    const cheaper = businessLoanFor(commercial, purchase, noWages);
    expect(cheaper.offered).toBe(300_000);
    expect(cheaper.yearlyPayment).toBe(43_208);
  });

  it('stops at the most a product will ever lend', () => {
    const hotel = buying({ kind: 'buy', cost: 5_200_000, targetProfit: 500_000 });
    const rich = lender({ earned: 5_000_000 });
    expect(businessLoanFor(small, hotel, rich).offered).toBe(750_000);
    expect(businessLoanFor(commercial, hotel, rich).offered).toBe(3_900_000);
  });

  it('will not lend the cheaper loan for a business with no record', () => {
    const refused = businessLoanFor(commercial, buying(), lender());
    expect(refused.approved).toBe(false);
    expect(refused.because).toBe('noRecord');
  });

  it('asks for credit, and for age, before anything else', () => {
    expect(
      businessLoanFor(commercial, buying({ kind: 'buy' }), lender({ standing: 'fair' })).because,
    ).toBe('standing');
    expect(businessLoanFor(small, buying(), lender({ standing: 'poor' })).because).toBe('standing');
    expect(businessLoanFor(small, buying(), lender({ standing: 'fair' })).approved).toBe(true);
    expect(businessLoanFor(small, buying(), lender({ age: 17 })).because).toBe('tooYoung');
  });

  it('will not write a second lender into a business that already has one', () => {
    const topUp = buying({
      kind: 'expand',
      topUp: { businessId: 'b1', productId: 'loan.smallbiz' },
    });
    expect(businessLoanFor(commercial, topUp, lender()).because).toBe('otherLender');
    expect(businessLoanFor(small, topUp, lender()).approved).toBe(true);
  });

  it('refuses a loan too small to bother with, and says it is the size and not the earnings', () => {
    const tiny = businessLoanFor(small, buying({ cost: 600 }), lender());
    expect(tiny.approved).toBe(false);
    expect(tiny.because).toBe('tooSmall');
  });

  it('keeps the share of the cost that the lender wants the owner to put in', () => {
    // Opening is the riskiest, so it is the smallest share.
    expect(small.financesShare).toEqual({ open: 0.7, expand: 0.8, buy: 0.8 });
    expect(commercial.financesShare).toEqual({ expand: 0.8, buy: 0.75 });
    expect(COVER_SHARE).toBe(0.5);
    const offers = businessLoanOffersFor(buying({ kind: 'expand', cost: 200_000 }), lender());
    expect(offers.map((row) => row.decision.offered)).toEqual([160_000, 160_000]);
  });
});

describe('0603 — the loan is not cash, and does not count as the owner debt', () => {
  const rich: Borrower = {
    standing: 'excellent',
    income: 500_000,
    employed: true,
    studying: false,
    age: 40,
    loans: [],
    cardDebt: 0,
    pledgeable: 1_000_000,
    tuitionAhead: 0,
  };

  it('is refused at the Loans screen to anybody, however rich', () => {
    for (const product of BUSINESS_LOAN_PRODUCTS) {
      const decision = applyForLoan(product, rich);
      expect(decision.approved).toBe(false);
      expect(decision.because).toBe('forABusiness');
    }
  });

  it('is found by the same lookup as every other product', () => {
    expect(findLoanProduct('loan.smallbiz')?.type).toBe('business');
    expect(isBusinessLoan(held('loan.commercial', 1_000))).toBe(true);
    expect(isBusinessLoan(held('loan.personal', 1_000))).toBe(false);
  });

  it('is left out of what a salary is measured against, as a mortgage is', () => {
    const rows = [held('loan.personal', 10_000), held('loan.smallbiz', 300_000, 'b1')];
    expect(Number(totalBorrowed(rows))).toBe(31_000_000);
    expect(Number(personalBorrowed(rows))).toBe(1_000_000);
    expect(personalLoans(rows)).toHaveLength(1);
    const personal = findLoanProduct('loan.personal')!;
    expect(borrowingRoom(personal, { ...rich, income: 40_000, loans: rows })).toBe(
      borrowingRoom(personal, { ...rich, income: 40_000, loans: [rows[0]!] }),
    );
  });

  it('does not use up the four loans a person may hold', () => {
    const four = ['loan.starter', 'loan.consolidation', 'loan.personal', 'loan.creditline'].map(
      (id) => held(id, 1_000),
    );
    const personal = findLoanProduct('loan.privateline')!;
    expect(applyForLoan(personal, { ...rich, loans: four }).because).toBe('tooManyLoans');
    const withBusiness = [
      ...four.slice(0, 3),
      held('loan.smallbiz', 50_000, 'b1'),
      held('loan.smallbiz', 50_000, 'b2'),
      held('loan.commercial', 50_000, 'b3'),
    ];
    expect(MAX_ACTIVE_LOANS).toBe(4);
    expect(applyForLoan(personal, { ...rich, loans: withBusiness }).approved).toBe(true);
  });

  it('merges a second draw into the loan a business already has, and never writes two', () => {
    const first = withBusinessLoan([], small, 'b1', 80_000);
    expect(first).toHaveLength(1);
    expect(first[0]!.businessId).toBe('b1');
    const merged = withBusinessLoan(
      [{ ...first[0]!, balance: dollars(60_000), termLeft: 4 }],
      small,
      'b1',
      20_000,
    );
    expect(merged).toHaveLength(1);
    expect(Number(merged[0]!.principal)).toBe(10_000_000);
    expect(Number(merged[0]!.balance)).toBe(8_000_000);
    expect(merged[0]!.termLeft).toBe(10);
    // A different business is a different loan.
    expect(withBusinessLoan(first, small, 'b2', 10_000)).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */
/* Businesses for sale                                                         */
/* -------------------------------------------------------------------------- */

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const normal = (r: () => number): number =>
  Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());

function draws(r: () => number): ListingDraws {
  return {
    age: r(),
    doors: r(),
    reputation: r(),
    premium: r(),
    dressing: r(),
    luck: normal(r),
    trend: normal(r),
    noise: [normal(r), normal(r), normal(r)],
  };
}

const flat: ListingDraws = {
  age: 0.5,
  doors: 0,
  reputation: 0.5,
  premium: 0,
  dressing: 0,
  luck: 0,
  trend: 0,
  noise: [0, 0, 0],
};

describe('0603 — what is for sale, and why buying is not a shortcut', () => {
  const YEAR = 2040;

  it('always asks at least 8% over what the same formula values it at, in every kind of business', () => {
    const r = rng(11);
    let checked = 0;
    for (const type of BUSINESS_TYPES) {
      for (let i = 0; i < 60; i += 1) {
        const listing = listingFor(type, 'x', 'Name', YEAR, draws(r));
        expect(listing.ask, `${type.id}`).toBeGreaterThanOrEqual(
          Math.round(listing.worth * ASK_PREMIUM_MIN) + listing.till,
        );
        checked += 1;
      }
    }
    expect(checked).toBe(BUSINESS_TYPES.length * 60);
    expect(ASK_PREMIUM_MIN).toBe(1.08);
  });

  it('loses money buying and selling the same business in the same year, on every draw', () => {
    const r = rng(23);
    for (const type of BUSINESS_TYPES) {
      for (let i = 0; i < 40; i += 1) {
        const listing = listingFor(type, 'x', 'Name', YEAR, draws(r));
        const owned = businessBought(listing);
        // The best haggle a buyer can ever be drawn, and then some.
        for (const z of [SALE_Z_LIMIT, 4, 100]) {
          const sale = businessSaleOf(owned, type, YEAR, z);
          expect(sale.proceeds, `${type.id} at z=${z}`).toBeLessThan(listing.ask);
        }
      }
    }
  });

  it("caps a buyer's haggling, so an extreme draw cannot beat the cap", () => {
    const type = findBusinessType('biz.cafe')!;
    const owned = businessBought(listingFor(type, 'x', 'Name', YEAR, flat));
    expect(businessSaleOf(owned, type, YEAR, 100).price).toBe(
      businessSaleOf(owned, type, YEAR, SALE_Z_LIMIT).price,
    );
    expect(businessSaleOf(owned, type, YEAR, -100).price).toBe(
      businessSaleOf(owned, type, YEAR, -SALE_Z_LIMIT).price,
    );
    expect(SALE_Z_LIMIT).toBe(2.5);
  });

  it('hands over a business whose customers are wary of the new owner', () => {
    const type = findBusinessType('biz.cafe')!;
    const listing = listingFor(type, 'x', 'Name', YEAR, flat);
    const owned = businessBought(listing);
    expect(TRANSITION_REPUTATION).toBe(4);
    expect(owned.reputation).toBe(listing.business.reputation - 4);
    // What was paid is what is on the books, and the till comes with it.
    expect(Number(owned.invested)).toBe(listing.ask * 100);
    expect(Number(owned.cash)).toBe(listing.till * 100);
    expect(listing.till).toBe(
      reserveFor(listing.business.last!.revenue - listing.business.last!.profit),
    );
  });

  it("shows the seller's polish: up to a fifth on the books, mostly nothing", () => {
    const type = findBusinessType('biz.law')!;
    const honest = listingFor(type, 'x', 'Name', YEAR, { ...flat, dressing: 0 });
    const polished = listingFor(type, 'x', 'Name', YEAR, { ...flat, dressing: 1 });
    expect(WINDOW_DRESSING_MAX).toBe(0.2);
    expect(reportedProfitOf(polished) / reportedProfitOf(honest)).toBeCloseTo(1.2, 2);
    // The skew: halfway along the dial is an eighth of the way up, not half.
    const middling = listingFor(type, 'x', 'Name', YEAR, { ...flat, dressing: 0.5 });
    expect(reportedProfitOf(middling) / reportedProfitOf(honest)).toBeCloseTo(1.025, 2);
  });

  it('is the same business however often it is asked for, and different businesses for different draws', () => {
    const type = findBusinessType('biz.salon')!;
    const a = listingFor(type, 'x', 'Name', YEAR, draws(rng(5)));
    const b = listingFor(type, 'x', 'Name', YEAR, draws(rng(5)));
    const c = listingFor(type, 'x', 'Name', YEAR, draws(rng(6)));
    expect(b).toEqual(a);
    expect(c.ask).not.toBe(a.ask);
    expect(LISTINGS_PER_YEAR).toBe(4);
  });

  it('sells a business that has traded for years, run by a crew it needs, with its books to show', () => {
    const r = rng(41);
    for (const type of BUSINESS_TYPES) {
      const listing = listingFor(type, 'x', 'Name', YEAR, draws(r));
      expect(listing.years).toBeGreaterThanOrEqual(2);
      expect(listing.years).toBeLessThanOrEqual(19);
      expect(listing.staff).toBeGreaterThanOrEqual(type.staffMin * listing.locations);
      expect(listing.reported).toHaveLength(3);
      expect(listing.business.openedYear).toBe(YEAR - listing.years);
      expect(listing.business.branches.length).toBe(listing.locations - 1);
      // A business that can be expanded the day it is bought has to have earned last year.
      expect(listing.business.last?.year).toBe(YEAR - 1);
    }
  });
});
