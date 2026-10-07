import { describe, expect, it } from 'vitest';
import { asNpcId, dollars } from '@yearafter/core';
import { findBusinessType } from '@yearafter/content';
import {
  BUSINESS_LOAN_PRODUCTS,
  newBusiness,
  post,
  reconcile,
  settleYear,
  windDownOf,
  type HeldLoan,
} from '@yearafter/finance';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { closeBusiness, runBusinessesYear } from './businesses';
import { continueAsChild } from './continue';
import {
  withBusinessRescue,
  injectIntoBusinessRescue,
  declineBusinessRescue,
  BUSINESS_RESCUE_EVENT_ID,
} from './business-rescue';
import type { GameState } from './game-state';

const type = findBusinessType('biz.restaurant')!;
function fixture(count = 1, borrowed = false, bank = 10_000_000): GameState {
  const base = createNewGame({ seed: 'p1-rescue', startYear: 2000 });
  const businesses = Array.from({ length: count }, (_, i) => ({
    ...newBusiness(type, `biz:${i}`, `Losing Place ${i}`, 2030, 0.55),
    staff: type.staff * 2,
    cash: dollars(0),
    reputation: 5,
  }));
  const loans: HeldLoan[] = borrowed
    ? businesses.map((business) => ({
        productId: BUSINESS_LOAN_PRODUCTS[0]!.id,
        businessId: business.id,
        principal: dollars(3_000_000),
        balance: dollars(3_000_000),
        termLeft: 10,
        inArrears: true,
      }))
    : [];
  const annual = runBusinessesYear({
    businesses,
    loans,
    year: 2031,
    seed: 'insolvent',
    market: 'severeRecession',
    available: bank,
    holdsJob: false,
    stat: () => 10,
  });
  const finance = post(base.finance, 2031, 31, {
    category: 'gift',
    amount: dollars(bank),
    source: 'Fixture savings',
  }).ledger;
  return withBusinessRescue(
    {
      ...base,
      world: { ...base.world, year: 2031 },
      player: { ...base.player, age: 31, cash: finance.balance },
      finance,
      businesses: annual.businesses,
      loans: annual.loans,
    },
    annual.rescues,
  );
}
const value = <T, E>(result: { ok: true; value: T } | { ok: false; error: E }): T => {
  if (!result.ok) throw new Error(String(result.error));
  return result.value;
};

describe('P1 — an actual rescue choice', () => {
  it('holds losses without spending, closing, paying the owner, or changing invested cost', () => {
    const state = fixture();
    expect(state.businessRescue?.cases).toHaveLength(1);
    expect(state.businesses[0]!.cash).toBeLessThan(0);
    expect(state.finance.transactions).toHaveLength(1);
    expect(state.businesses[0]!.last?.injected).toBe(0);
    expect(state.businesses[0]!.last?.drawn).toBe(0);
    expect(state.businesses[0]!.invested).toBe(dollars(type.startup));
    const business = state.businesses[0]!;
    expect(state.businessRescue!.cases[0]!.amount).toBe(
      settleYear(Number(business.cash) / 100, 0, business.last!.costs).needed,
    );
    expect(advanceYear(state)).toEqual({ state, newEntries: [] });
  });
  it('puts in exactly the quoted amount once and reconciles the bank, till and cost', () => {
    const state = fixture();
    const row = state.businessRescue!.cases[0]!;
    const next = value(injectIntoBusinessRescue(state, row.businessId)).state;
    expect(Number(next.finance.balance)).toBe(Number(state.finance.balance) - row.amount * 100);
    expect(Number(next.businesses[0]!.cash)).toBe(
      Number(state.businesses[0]!.cash) + row.amount * 100,
    );
    expect(Number(next.businesses[0]!.invested)).toBe(
      Number(state.businesses[0]!.invested) + row.amount * 100,
    );
    expect(next.businesses[0]!.last!.injected).toBe(row.amount);
    expect(next.businessRescue).toBeUndefined();
    expect(next.pending).toHaveLength(0);
    expect(reconcile(next.finance).ok).toBe(true);
    expect(next.player.cash).toBe(next.finance.balance);
    expect(injectIntoBusinessRescue(next, row.businessId).ok).toBe(false);
  });
  it('accepts an exact bank balance, refuses a cent less, and still lets the owner close', () => {
    const state = fixture();
    const row = state.businessRescue!.cases[0]!;
    const exact = fixture(1, false, row.amount);
    expect(injectIntoBusinessRescue(exact, row.businessId).ok).toBe(true);
    const short = {
      ...exact,
      finance: { ...exact.finance, balance: (dollars(row.amount) - 1) as never },
    };
    const original = JSON.stringify(short);
    expect(injectIntoBusinessRescue(short, row.businessId)).toEqual({
      ok: false,
      error: 'cannot-afford',
    });
    expect(JSON.stringify(short)).toBe(original);
    expect(declineBusinessRescue(short, row.businessId).ok).toBe(true);
  });
  it('closes for fittings less the trading hole, rather than forgiving the loss', () => {
    const state = fixture();
    const business = state.businesses[0]!;
    const expected = Math.max(0, windDownOf(business, type, 2031) + Number(business.cash) / 100);
    const next = value(declineBusinessRescue(state, business.id)).state;
    expect(next.businesses).toHaveLength(0);
    expect(Number(next.finance.balance) - Number(state.finance.balance)).toBe(expected * 100);
    expect(next.player.records.some((row) => row.label === 'Closed Losing Place 0')).toBe(true);
    expect(next.businessRescue).toBeUndefined();
    expect(reconcile(next.finance).ok).toBe(true);
  });
  it('quotes an already-arrears loan, pays it once from the rescue, and preserves other loans', () => {
    const state = fixture(2, true);
    const row = state.businessRescue!.cases[0]!;
    expect(row.loanPayment).toBeGreaterThan(0);
    expect(state.loans[0]!.balance).toBeGreaterThan(dollars(3_000_000));
    const next = value(injectIntoBusinessRescue(state, row.businessId)).state;
    expect(next.loans.find((loan) => loan.businessId === row.businessId)).toEqual(row.fundedLoan);
    expect(next.loans.find((loan) => loan.businessId === 'biz:1')).toEqual(
      state.loans.find((loan) => loan.businessId === 'biz:1'),
    );
    expect(next.businesses[0]!.last!.repaid).toBe(row.loanPayment);
    expect(Number(next.businesses[0]!.cash)).toBe(
      Number(state.businesses[0]!.cash) + (row.amount - row.loanPayment) * 100,
    );
    expect(next.businessRescue).toBeDefined();
    expect(next.businessRescue!.cases).toHaveLength(1);
    expect(reconcile(next.finance).ok).toBe(true);
  });
  it('uses positive cash towards a loan-only rescue instead of asking for the full payment', () => {
    const base = fixture();
    const cafeType = findBusinessType('biz.cafe')!;
    const business = {
      ...newBusiness(cafeType, 'loan-only', 'Solvent Cafe', 2020, 1),
      cash: dollars(100_000),
    };
    const loan: HeldLoan = {
      productId: BUSINESS_LOAN_PRODUCTS[0]!.id,
      businessId: business.id,
      principal: dollars(3_000_000),
      balance: dollars(3_000_000),
      termLeft: 10,
      inArrears: false,
    };
    const year = runBusinessesYear({
      businesses: [business],
      loans: [loan],
      year: 2031,
      seed: 'positive-till',
      market: 'normal',
      available: 10_000_000,
      holdsJob: false,
      stat: () => 50,
    });
    const state = withBusinessRescue(
      {
        ...base,
        pending: [],
        businessRescue: undefined,
        businesses: year.businesses,
        loans: year.loans,
      },
      year.rescues,
    );
    const row = state.businessRescue!.cases[0]!;
    const till = Number(state.businesses[0]!.cash) / 100;
    expect(till).toBeGreaterThan(0);
    expect(row.amount).toBe(row.loanPayment - till);
    const next = value(injectIntoBusinessRescue(state, business.id)).state;
    expect(next.businesses[0]!.cash).toBe(dollars(0));
    expect(next.loans[0]!.inArrears).toBe(false);
  });
  it('removes a lender paid in full by the rescue without accruing interest again', () => {
    const base = fixture();
    const business = { ...base.businesses[0]!, cash: dollars(0) };
    const loan: HeldLoan = {
      productId: BUSINESS_LOAN_PRODUCTS[0]!.id,
      businessId: business.id,
      principal: dollars(1_000),
      balance: dollars(1_000),
      termLeft: 1,
      inArrears: false,
    };
    const year = runBusinessesYear({
      businesses: [business],
      loans: [loan],
      year: 2031,
      seed: 'last-payment',
      market: 'severeRecession',
      available: 10_000_000,
      holdsJob: false,
      stat: () => 10,
    });
    const state = withBusinessRescue(
      {
        ...base,
        pending: [],
        businessRescue: undefined,
        businesses: year.businesses,
        loans: year.loans,
      },
      year.rescues,
    );
    expect(state.businessRescue!.cases[0]!.fundedLoan).toBeUndefined();
    const next = value(injectIntoBusinessRescue(state, business.id)).state;
    expect(next.loans).toHaveLength(0);
    expect(next.businesses[0]!.last!.repaid).toBe(state.businessRescue!.cases[0]!.loanPayment);
  });
  it('gives the owner only what remains after fully repaying a lender on closure', () => {
    const base = fixture(1, true);
    const business = { ...base.businesses[0]!, cash: dollars(-1) };
    const state = {
      ...base,
      businesses: [business],
      loans: [{ ...base.loans[0]!, balance: dollars(1_000) }],
    };
    const proceeds = windDownOf(business, type, 2031) - 1;
    expect(proceeds).toBeGreaterThan(1_000);
    const next = value(declineBusinessRescue(state, business.id)).state;
    expect(next.loans).toHaveLength(0);
    expect(Number(next.finance.balance) - Number(state.finance.balance)).toBe(
      (proceeds - 1_000) * 100,
    );
    expect(reconcile(next.finance).ok).toBe(true);
  });
  it('keeps the remainder owed on closing and gives the lender first claim on proceeds', () => {
    const state = fixture(1, true);
    const business = { ...state.businesses[0]!, cash: dollars(-1) };
    const amended = { ...state, businesses: [business] };
    const before = Number(amended.loans[0]!.balance);
    const proceeds = Math.max(0, windDownOf(business, type, 2031) - 1);
    expect(proceeds).toBeGreaterThan(0);
    const next = value(declineBusinessRescue(amended, business.id)).state;
    expect(next.finance.balance).toBe(state.finance.balance);
    expect(Number(next.loans[0]!.balance)).toBe(before - proceeds * 100);
    expect(next.finance.transactions.at(-1)?.category).toBe('debt');
    expect(reconcile(next.finance).ok).toBe(true);
  });
  it('raises one review for four businesses, resolves each separately, and retains unrelated decisions', () => {
    let state = fixture(4);
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0]!.choices).toHaveLength(8);
    const unrelated = {
      ...state.pending[0]!,
      eventId: 'unrelated',
      choices: [{ id: 'stay', label: 'Stay' }],
    };
    state = { ...state, pending: [...state.pending, unrelated] };
    state = value(decide(state, BUSINESS_RESCUE_EVENT_ID, 'inject:biz:0')).state;
    expect(state.businessRescue).toBeDefined();
    expect(state.businessRescue!.cases).toHaveLength(3);
    expect(state.pending[0]!.choices).toHaveLength(6);
    state = value(decide(state, BUSINESS_RESCUE_EVENT_ID, 'close:biz:1')).state;
    state = value(decide(state, BUSINESS_RESCUE_EVENT_ID, 'close:biz:2')).state;
    state = value(decide(state, BUSINESS_RESCUE_EVENT_ID, 'close:biz:3')).state;
    expect(state.businesses.map((business) => business.id)).toEqual(['biz:0']);
    expect(state.pending).toEqual([unrelated]);
    expect(state.businessRescue).toBeUndefined();
  });
  it('refuses stale years, stale lenders, unknown choices and consent from a deceased owner', () => {
    const state = fixture(1, true);
    expect(
      injectIntoBusinessRescue({ ...state, world: { ...state.world, year: 2032 } }, 'biz:0').ok,
    ).toBe(false);
    expect(injectIntoBusinessRescue({ ...state, loans: [] }, 'biz:0').ok).toBe(false);
    expect(
      injectIntoBusinessRescue({ ...state, player: { ...state.player, alive: false } }, 'biz:0').ok,
    ).toBe(false);
    expect(decide(state, BUSINESS_RESCUE_EVENT_ID, 'inject:missing').ok).toBe(false);
  });
  it('clears a sold or closed case through the ordinary exit command', () => {
    const next = value(closeBusiness(fixture(2), 'biz:0')).state;
    expect(next.businessRescue!.cases.map((row) => row.businessId)).toEqual(['biz:1']);
    expect(next.pending[0]!.choices.map((row) => row.id)).toEqual(['inject:biz:1', 'close:biz:1']);
  });
  it('winds down on death without injection; healthy businesses remain, and closed-business debt reduces the estate', () => {
    const source = fixture(1, true);
    const healthy = newBusiness(type, 'healthy', 'Healthy Place', 2030, 1);
    const dead = {
      ...source,
      businesses: [...source.businesses, healthy],
      pending: [],
      player: { ...source.player, alive: false },
    };
    const next = withBusinessRescue(dead, source.businessRescue!.cases);
    expect(next.businesses.map((business) => business.id)).toEqual(['healthy']);
    expect(next.businessRescue).toBeUndefined();
    expect(next.pending).toEqual([]);
    expect(
      next.finance.transactions.some((row) => row.amount < 0 && row.category === 'property'),
    ).toBe(false);
    const child = {
      ...next.family.members[0]!,
      id: asNpcId('heir'),
      role: 'child' as const,
      alive: true,
      birthYear: 2000,
    };
    const heir = continueAsChild(
      { ...next, family: { ...next.family, members: [child] } },
      'heir',
    )!;
    expect(heir).toBeDefined();
    expect(heir.businesses.map((business) => business.id)).toEqual(['healthy']);
    const orphanDebt = Number(next.loans[0]!.balance);
    expect(Number(heir.finance.balance)).toBe(
      Math.max(0, Number(next.finance.balance) - orphanDebt),
    );
    expect(reconcile(heir.finance).ok).toBe(true);
  });
  it('winds down in the actual year of death and stays within the feed budget', () => {
    const draft = fixture(1, true);
    const source = {
      ...draft,
      businessRescue: undefined,
      pending: [],
      world: { ...draft.world, year: 2030 },
      player: {
        ...draft.player,
        age: 130,
        birthYear: 1900,
        stats: { ...draft.player.stats, health: 0 as never },
      },
      health: { ...draft.health, vitality: 0, deficit: 100 },
      businesses: [{ ...draft.businesses[0]!, cash: dollars(0) }],
    };
    const result = advanceYear(source);
    expect(result.state.player.alive).toBe(false);
    expect(result.state.businesses).toHaveLength(0);
    expect(result.state.businessRescue).toBeUndefined();
    expect(result.state.pending).toHaveLength(0);
    expect(result.state.loans).toHaveLength(1);
    expect(result.state.player.records.some((row) => row.label === 'Closed Losing Place 0')).toBe(
      true,
    );
    expect(result.newEntries.length).toBeLessThanOrEqual(7);
    expect(reconcile(result.state.finance).ok).toBe(true);
  });
  it('raises the review in a full annual advance and keeps the loan out of household servicing', () => {
    const draft = fixture(1, true);
    const source = {
      ...draft,
      businessRescue: undefined,
      pending: [],
      world: { ...draft.world, year: 2030 },
      businesses: [{ ...draft.businesses[0]!, cash: dollars(0) }],
      player: { ...draft.player, age: 30 },
    };
    const next = advanceYear(source).state;
    expect(next.businessRescue?.cases).toHaveLength(1);
    expect(next.pending[0]!.eventId).toBe(BUSINESS_RESCUE_EVENT_ID);
    expect(
      next.finance.transactions.some(
        (row) => row.year === 2031 && row.category === 'property' && row.amount < 0,
      ),
    ).toBe(false);
    expect(
      next.finance.transactions.some((row) => /Business Loan — payment/.test(row.source)),
    ).toBe(false);
    expect(reconcile(next.finance).ok).toBe(true);
  });
});
