/**
 * Ticket 0501 — owning a home, as plain rules.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  CONDITION_PRICE,
  HOUSING_DEBT_CEILING,
  KEEP_IN_HAND,
  MORTGAGE_PRODUCTS,
  SELLING_COST,
  TARGET_DOWN,
  WEAR_CHANCE,
  annualExpenseOf,
  homeYear,
  mortgageFor,
  mortgagePaymentFor,
  priceIndexFor,
  saleOf,
  type HomeBuyer,
  type OwnedHome,
} from './property';
import { OWNER_SHARE, SUBSISTENCE, livingCostFor } from './living';

const buyer = (over: Partial<HomeBuyer> = {}): HomeBuyer => ({
  age: 35,
  standing: 'good',
  income: 90_000,
  cash: 60_000,
  otherPayments: 0,
  mortgaged: 0,
  ...over,
});

const home = (over: Partial<OwnedHome> = {}): OwnedHome => ({
  id: 'home:2030:0',
  kindId: 'home.condo',
  beds: 2,
  baths: 1,
  builtYear: 2000,
  condition: 'good',
  regionKey: 'US:TX',
  regionName: 'Texas',
  purchasePrice: dollars(250_000),
  boughtYear: 2030,
  value: dollars(250_000),
  expenseRate: 0.025,
  behindYears: 0,
  ...over,
});

describe('0501 — a mortgage', () => {
  it('gives the cheapest money the buyer qualifies for, with a sensible deposit', () => {
    const offer = mortgageFor(250_000, buyer(), 6_000);
    expect(offer.approved).toBe(true);
    expect(offer.product?.id).toBe(MORTGAGE_PRODUCTS[0]!.id);
    // Twenty percent if they can spare it, and never their last $5,000.
    expect(offer.down).toBe(Math.round(250_000 * TARGET_DOWN));
    expect(buyer().cash - offer.down).toBeGreaterThanOrEqual(KEEP_IN_HAND);
    expect(offer.principal).toBe(250_000 - offer.down);
  });

  it('falls back to the low-deposit product for somebody with little saved', () => {
    const offer = mortgageFor(220_000, buyer({ cash: 12_000, standing: 'fair' }), 5_500);
    expect(offer.approved).toBe(true);
    expect(offer.product?.id).toBe('mortgage.starter');
    expect(offer.down).toBeGreaterThanOrEqual(Math.ceil(220_000 * 0.035));
    expect(offer.down).toBeLessThanOrEqual(12_000);
  });

  it('says no for the reason that would actually have to change', () => {
    expect(mortgageFor(250_000, buyer({ cash: 2_000 }), 6_000).because).toBe('deposit');
    // Enough for the low-deposit product but not the income for it: the answer
    // is income, not the conventional product's bigger deposit.
    expect(
      mortgageFor(250_000, buyer({ cash: 15_000, income: 30_000 }), 6_000).because,
    ).toBe('income');
    expect(mortgageFor(250_000, buyer({ income: 20_000 }), 6_000).because).toBe('income');
    expect(mortgageFor(250_000, buyer({ standing: 'poor' }), 6_000).because).toBe('standing');
    expect(mortgageFor(250_000, buyer({ age: 17 }), 6_000).because).toBe('tooYoung');
    expect(mortgageFor(250_000, buyer({ mortgaged: 1 }), 6_000).because).toBe('alreadyMortgaged');
  });

  it('holds the payments, the upkeep and other loans under the lender ceiling', () => {
    const offer = mortgageFor(400_000, buyer({ income: 70_000 }), 8_000);
    if (offer.approved) {
      expect(offer.yearlyPayment + 8_000).toBeLessThanOrEqual(70_000 * HOUSING_DEBT_CEILING);
    } else {
      expect(offer.because).toBe('income');
    }
    const loaded = mortgageFor(250_000, buyer({ income: 50_000, otherPayments: 15_000 }), 6_000);
    expect(loaded.approved).toBe(false);
  });

  it('amortises to nothing over its term', () => {
    let balance = 200_000;
    const apr = 0.065;
    for (let left = 30; left > 0; left -= 1) {
      const payment = mortgagePaymentFor(apr, balance, left);
      balance = Math.max(0, Math.round(balance * (1 + apr) - payment));
    }
    expect(balance).toBeLessThan(5);
  });
});

describe('0501 — a year of owning', () => {
  it('moves the value with the market and charges the upkeep on it', () => {
    const result = homeYear(home(), 0.05, 0.99);
    expect(Number(result.home.value) / 100).toBe(262_500);
    expect(result.expense).toBe(annualExpenseOf(home()));
    expect(result.worn).toBe(false);
  });

  it('wears a house down a band, which costs value and raises upkeep', () => {
    const result = homeYear(home(), 0, WEAR_CHANCE / 2);
    expect(result.home.condition).toBe('fair');
    expect(Number(result.home.value)).toBeLessThan(Number(home().value));
    expect(Number(result.home.value) / 100).toBeCloseTo(
      (250_000 * CONDITION_PRICE.fair) / CONDITION_PRICE.good,
      -1,
    );
    expect(annualExpenseOf(result.home)).toBeGreaterThan(
      annualExpenseOf(home()) * CONDITION_PRICE.fair,
    );
    // And a house that needs work cannot get worse than that.
    expect(homeYear(home({ condition: 'poor' }), 0, 0).home.condition).toBe('poor');
  });

  it('takes the mortgage payment and pays it off on the last year', () => {
    const mortgage = {
      productId: 'mortgage.conventional',
      principal: dollars(10_000),
      balance: dollars(10_000),
      termLeft: 1,
    };
    const last = homeYear(home({ mortgage }), 0, 0.99);
    expect(last.paidOff).toBe(true);
    expect(last.home.mortgage).toBeUndefined();
    expect(last.payment).toBe(Math.round(10_000 * 1.065));
  });
});

describe('0501 — selling', () => {
  it('returns what it is worth less the costs and the mortgage, never less than nothing', () => {
    const owed = {
      productId: 'mortgage.conventional',
      principal: dollars(200_000),
      balance: dollars(150_000),
      termLeft: 20,
    };
    const sale = saleOf(home({ mortgage: owed }));
    expect(sale.costs).toBe(Math.round(250_000 * SELLING_COST));
    expect(sale.repaid).toBe(150_000);
    expect(sale.proceeds).toBe(250_000 - sale.costs - 150_000);
    const underwater = saleOf(home({ mortgage: { ...owed, balance: dollars(400_000) } }));
    expect(underwater.proceeds).toBe(0);
    expect(underwater.repaid).toBe(250_000 - underwater.costs);
  });

  it('prices a dear region far above a cheap one', () => {
    expect(priceIndexFor(1.55)).toBeGreaterThan(2);
    expect(priceIndexFor(0.8)).toBeLessThan(0.7);
  });
});

describe('0501 — living in it', () => {
  const owned = (housingCost: number) =>
    livingCostFor({
      standard: 40_000,
      locationIndex: 1,
      partnered: false,
      childAges: [],
      housing: 'owned',
      housingCost,
    }).total;
  const renting = livingCostFor({
    standard: 40_000,
    locationIndex: 1,
    partnered: false,
    childAges: [],
    housing: 'ownPlace',
  }).total;

  it('drops the roof from the life when the house is cheaper than the rent', () => {
    expect(owned(5_000)).toBe(Math.round(renting * OWNER_SHARE));
    // So owner and house together cost less than renting: the difference is the saving.
    expect(owned(5_000) + 5_000).toBeLessThan(renting);
  });

  it('spends less on everything else when the house costs more than the rent', () => {
    expect(owned(15_000)).toBe(renting - 15_000);
    expect(owned(15_000)).toBeLessThan(Math.round(renting * OWNER_SHARE));
  });

  it('never squeezes the rest of a life below subsistence', () => {
    expect(owned(1_000_000)).toBe(Math.round(SUBSISTENCE * OWNER_SHARE));
  });
});
