import { describe, expect, it } from 'vitest';
import { findBusinessType } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import { newBusiness, post, reconcile, type MarketState } from '@yearafter/finance';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { runBusinessesYear } from './businesses';
import {
  withBusinessRescue,
  injectIntoBusinessRescue,
  declineBusinessRescue,
} from './business-rescue';

function fixture() {
  const type = findBusinessType('biz.restaurant');
  if (!type) throw new Error('Missing restaurant');
  const business = {
    ...newBusiness(type, 'p4-fixed', 'Marlow', 2020, 1),
    staff: type.staff,
    reputation: 50,
  };
  return { type, business };
}
function run(market: MarketState, options: { broke?: boolean } = {}) {
  const { business } = fixture();
  return runBusinessesYear({
    businesses: [{ ...business, ...(options.broke ? { cash: dollars(0), luck: 0.55 } : {}) }],
    year: 2031,
    seed: 'p4-live',
    market,
    available: Number.MAX_SAFE_INTEGER,
    holdsJob: false,
    stat: () => 50,
  });
}

describe('P4 live business settlement', () => {
  it.each([
    ['severeRecession', 0.922, true, false],
    ['recession', 0.961, true, false],
    ['slowdown', 0.985, false, false],
    ['normal', 1, false, false],
    ['growth', 1.015, false, false],
    ['strongExpansion', 1.054, false, true],
  ] as const)(
    'carries the real %s effect to the ledger and contextual lines',
    (market, economy, downturn, boom) => {
      const result = run(market);
      const last = result.businesses[0]?.last;
      if (!last) throw new Error('No settled year');
      if (market === 'normal') expect(last.economy).toBeUndefined();
      else expect(last.economy).toBeCloseTo(economy, 12);
      expect(result.lines.some((line) => line.includes('downturn'))).toBe(downturn);
      expect(result.lines.some((line) => line.includes('good economy'))).toBe(boom);
      if (downturn)
        expect(result.lines.find((line) => line.includes('downturn'))).toContain(
          market === 'severeRecession' ? 'about 8%' : 'about 4%',
        );
      if (market === 'normal') {
        expect(last.revenue).toBe(781_301);
        expect(last.profit).toBe(-9_016);
      }
      if (market === 'strongExpansion') {
        expect(last.revenue).toBe(823_491);
        expect(last.profit).toBe(20_096);
      }
      expect(result.transactions.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(
        result.drawn * 100,
      );
    },
  );

  it('pays a funded owner as income and conserves cash across both ledgers', () => {
    const { business } = fixture();
    const result = runBusinessesYear({
      businesses: [{ ...business, cash: dollars(2_000_000) }],
      year: 2031,
      seed: 'p4-live',
      market: 'recession',
      available: 0,
      holdsJob: false,
      stat: () => 50,
    });
    const settled = result.businesses[0];
    if (!settled?.last) throw new Error('No year');
    expect(result.rescues).toHaveLength(0);
    expect(result.drawn).toBeGreaterThan(0);
    expect(settled.last.drawn).toBe(result.drawn);
    expect(result.transactions).toEqual([
      {
        category: 'business',
        amount: dollars(result.drawn),
        source: 'Marlow — profit',
      },
    ]);
    expect(Number(settled.cash) / 100 + result.drawn).toBe(2_000_000 + settled.last.profit);
    const base = createNewGame({ seed: 'p4-owner-pay' });
    const payment = result.transactions[0];
    if (!payment) throw new Error('No owner payment');
    const books = post(base.finance, 2031, 40, payment).ledger;
    expect(Number(books.balance) - Number(base.finance.balance)).toBe(result.drawn * 100);
    expect(reconcile(books).ok).toBe(true);
  });

  it('retains lower-intensity growth news and small ledger effects', () => {
    const type = findBusinessType('biz.realestate');
    const accounting = findBusinessType('biz.accounting');
    if (!type || !accounting) throw new Error('Missing type');
    const settle = (t: typeof type) =>
      runBusinessesYear({
        businesses: [newBusiness(t, 'p4-context', t.name, 2020, 1)],
        year: 2031,
        seed: 'p4-context',
        market: 'growth',
        available: 0,
        holdsJob: false,
        stat: () => 50,
      });
    const grown = settle(type);
    expect(grown.businesses[0]?.last?.economy).toBe(1.025);
    expect(grown.lines.some((line) => line.includes('good economy'))).toBe(true);
    expect(settle(accounting).businesses[0]?.last?.economy).toBeCloseTo(1.00375, 12);
  });

  it.each(['inject', 'close'] as const)(
    'keeps a failure pending until the owner chooses %s',
    (action) => {
      const result = run('recession', { broke: true });
      expect(result.rescues).toHaveLength(1);
      expect(result.drawn).toBe(0);
      const business = result.businesses[0];
      const quote = result.rescues[0];
      if (!business || !quote) throw new Error('No review');
      expect(Number(business.cash)).toBeLessThan(0);
      expect(business.last?.injected).toBe(0);
      const base = createNewGame({ seed: 'p4-rescue' });
      const finance = post(base.finance, 2031, 40, {
        category: 'gift',
        amount: dollars(quote.amount - Number(base.finance.balance) / 100),
        source: 'Measurement funds',
      }).ledger;
      const state = withBusinessRescue(
        {
          ...base,
          world: { ...base.world, year: 2031 },
          finance,
          player: { ...base.player, age: 40, cash: finance.balance },
          businesses: result.businesses,
        },
        result.rescues,
      );
      const answered =
        action === 'inject'
          ? injectIntoBusinessRescue(state, business.id)
          : declineBusinessRescue(state, business.id);
      expect(answered.ok).toBe(true);
      if (!answered.ok) throw new Error('Refused');
      expect(answered.value.state.businessRescue).toBeUndefined();
      expect(reconcile(answered.value.state.finance).ok).toBe(true);
      expect(answered.value.state.player.cash).toBe(answered.value.state.finance.balance);
      if (action === 'inject') {
        expect(answered.value.state.finance.balance).toBe(dollars(0));
        expect(answered.value.state.businesses[0]?.last?.injected).toBe(quote.amount);
      } else expect(answered.value.state.businesses).toHaveLength(0);
    },
  );

  it('uses the next market in real advance and deterministically reconciles', () => {
    const { business } = fixture();
    let observed = false;
    for (let i = 0; i < 30; i++) {
      const base = createNewGame({ seed: `p4-annual-${i}` });
      const state = {
        ...base,
        world: { ...base.world, year: 2030 },
        player: { ...base.player, age: 40 },
        market: 'recession' as const,
        businesses: [{ ...business, cash: dollars(2_000_000) }],
      };
      const before = JSON.stringify(state.businesses);
      const next = advanceYear(state).state;
      expect(next.world.year).toBe(2031);
      expect(next.player.age).toBe(41);
      if (next.market === 'normal') continue;
      observed = true;
      const full = {
        severeRecession: 0.87,
        recession: 0.935,
        slowdown: 0.975,
        normal: 1,
        growth: 1.025,
        strongExpansion: 1.09,
      }[next.market];
      expect(next.businesses[0]?.last?.economy).toBeCloseTo(1 + (full - 1) * 0.6, 12);
      expect(reconcile(next.finance).ok).toBe(true);
      expect(next.player.cash).toBe(next.finance.balance);
      expect(JSON.stringify(state.businesses)).toBe(before);
      expect(advanceYear(state).state.businesses).toEqual(next.businesses);
      break;
    }
    expect(observed).toBe(true);
  });
});
