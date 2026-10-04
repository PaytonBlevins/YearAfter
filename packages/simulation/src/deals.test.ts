/**
 * Ticket 0605 acceptance tests — private deals on the character
 * (simulation side).
 */

import { describe, expect, it } from 'vitest';
import { DEAL_KINDS } from '@yearafter/content';
import { reconcile, type PrivateDeal } from '@yearafter/finance';
import { advanceYear } from './advance';
import { netWorthOf } from './businesses';
import { continueAsChild, heirsIn } from './continue';
import { dealMarket, dealTaxOn, placeInDeal, runDealsYear, sellDealEarly } from './deals';
import { decide } from './decide';
import type { GameState } from './game-state';
import { estateOf, invest } from './investments';
import { INSTRUMENTS } from '@yearafter/content';
import { createNewGame } from './new-game';
import { cents } from '@yearafter/core';

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

const BASE = liveTo('deals-adult', 40);
const RICH = topUp(BASE, 3_000_000);
const cashOf = (state: GameState): number => Math.round(Number(state.player.cash) / 100);

/** The same life in a year that brings a deal of this kind. The year is just a number to the engine. */
function withOffer(
  kindId: string,
  from: GameState = RICH,
): { state: GameState; offerId: string; min: number; max: number } {
  for (let year = from.world.year; year < from.world.year + 400; year += 1) {
    const state = { ...from, world: { ...from.world, year } };
    const offer = dealMarket(state).find((row) => row.kindId === kindId);
    if (offer) return { state, offerId: offer.id, min: offer.minTicket, max: offer.maxTicket };
  }
  throw new Error(`no ${kindId} offered in four hundred years`);
}

/** Place a cheque, then fix the hidden outcome the test is about. */
function holding(
  kindId: string,
  over: Partial<PrivateDeal> = {},
): { state: GameState; deal: PrivateDeal } {
  const found = withOffer(kindId);
  const placed = placeInDeal(found.state, found.offerId, found.min);
  if (!placed.ok) throw new Error('refused');
  const deal = { ...placed.value.deals[0]!, ...over };
  return { state: { ...placed.value, deals: [deal] }, deal };
}

describe('0605 — what a character is offered', () => {
  it('offers a child nothing, and an adult something in some years', () => {
    const child = createNewGame({ seed: 'deals-child' });
    expect(dealMarket(child)).toEqual([]);
    let years = 0;
    for (let year = 2040; year < 2100; year += 1) {
      if (dealMarket({ ...RICH, world: { ...RICH.world, year } }).length > 0) years += 1;
    }
    expect(years).toBeGreaterThan(20);
    expect(years).toBeLessThan(58);
  });

  it('is the same year every time', () => {
    expect(dealMarket(RICH)).toEqual(dealMarket(RICH));
  });

  it('shows somebody with $20,000 only the kinds they can start', () => {
    const modest = topUp(BASE, 20_000 - cashOf(BASE));
    const kinds = new Set<string>();
    for (let year = 2040; year < 2200; year += 1) {
      for (const offer of dealMarket({ ...modest, world: { ...modest.world, year } }))
        kinds.add(offer.kindId);
    }
    expect([...kinds].every((id) => DEAL_KINDS.find((k) => k.id === id)!.gate <= 20_000)).toBe(
      true,
    );
    expect(kinds.size).toBeGreaterThan(0);
  });
});

describe('0605 — writing a cheque', () => {
  it('takes exactly the cheque out of cash and posts it as a transfer', () => {
    const { state, offerId, min } = withOffer('startup');
    const before = cashOf(state);
    const placed = placeInDeal(state, offerId, min);
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(cashOf(placed.value)).toBe(before - min);
    const row = placed.value.finance.transactions.at(-1)!;
    expect(row.category).toBe('investment');
    expect(Number(row.amount)).toBe(-min * 100);
    expect(row.source).toMatch(/Private deal/);
    expect(placed.value.deals).toHaveLength(1);
    expect(placed.value.deals[0]!.since).toBe(state.world.year);
    expect(reconcile(placed.value.finance).ok).toBe(true);
  });

  it('leaves net worth where it was: the money is away, not spent', () => {
    const { state, offerId, min } = withOffer('startup');
    const placed = placeInDeal(state, offerId, min);
    if (!placed.ok) throw new Error('refused');
    expect(netWorthOf(placed.value)).toBe(netWorthOf(state));
    expect(Number(estateOf(placed.value).investments) - Number(estateOf(state).investments)).toBe(
      min * 100,
    );
  });

  it('puts a line on the timeline naming the deal and the years', () => {
    const { state, offerId, min } = withOffer('startup');
    const placed = placeInDeal(state, offerId, min);
    if (!placed.ok) throw new Error('refused');
    const text = placed.value.player.timeline.at(-1)!.text;
    expect(text).toContain(placed.value.deals[0]!.name);
    expect(text).toMatch(/years/);
    expect(text).toContain(`$${min.toLocaleString('en-US')}`);
  });

  it('refuses what the engine refuses, and the same offer twice', () => {
    const { state, offerId, min } = withOffer('startup');
    expect(placeInDeal(state, offerId, min - 500)).toEqual({
      ok: false,
      error: { kind: 'belowMinimum', minimum: min },
    });
    expect(placeInDeal(state, 'deal:nope', min)).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
    const first = placeInDeal(state, offerId, min);
    if (!first.ok) throw new Error('refused');
    expect(placeInDeal(first.value, offerId, min)).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
  });

  it('refuses a cheque bigger than the cash in hand even when the portfolio would cover it', () => {
    const { state, offerId, min } = withOffer('startup');
    // Everything but a sliver goes into the market: plenty of liquid money, little cash.
    const spend = cashOf(state) - (min - 1);
    const bought = invest(state, INSTRUMENTS[0]!.id, spend);
    if (!bought.ok) throw new Error('could not buy');
    const poor = bought.value.state;
    expect(cashOf(poor)).toBeLessThan(min);
    expect(dealMarket(poor).some((o) => o.id === offerId)).toBe(true);
    expect(placeInDeal(poor, offerId, min).ok).toBe(false);
  });
});

describe('0605 — a year of deals', () => {
  it('pays a lender nine percent as assetIncome and taxes it', () => {
    const { state, deal } = holding('lending', { multiple: 1, matures: 9999 });
    const next = advanceYear(state).state;
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    const interest = rows.find((row) => /Interest — /.test(row.source));
    expect(interest?.category).toBe('assetIncome');
    expect(Number(interest?.amount)).toBe(Math.round(Number(deal.put) * 0.09));
    const tax = rows.find((row) => row.source === 'Tax on deal income');
    expect(tax?.category).toBe('tax');
    expect(Number(tax?.amount)).toBeLessThan(0);
    expect(Math.abs(Number(tax?.amount))).toBeLessThan(Number(interest?.amount));
    expect(next.deals[0]!.status).toBe('live');
    expect(Number(next.deals[0]!.paid)).toBe(Number(interest?.amount));
    expect(reconcile(next.finance).ok).toBe(true);
  });

  it('says nothing and posts nothing in a quiet year', () => {
    const { state } = holding('startup', { multiple: 5, matures: 9999 });
    const next = advanceYear(state).state;
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    expect(rows.filter((row) => /deal|Returned|Gain|Interest/i.test(row.source))).toEqual([]);
    expect(next.deals).toEqual(state.deals);
  });

  it('returns the cheque as a transfer and the winnings as income, taxed, in the year it ends', () => {
    const { state, deal } = holding('startup', { multiple: 4 });
    const due = { ...state, deals: [{ ...deal, matures: state.world.year + 1 }] };
    const next = advanceYear(due).state;
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    const back = rows.find((row) => /^Returned — /.test(row.source));
    const gain = rows.find((row) => /^Gain — /.test(row.source));
    expect(back?.category).toBe('investment');
    expect(Number(back?.amount)).toBe(Number(deal.put));
    expect(gain?.category).toBe('assetIncome');
    expect(Number(gain?.amount)).toBe(Number(deal.put) * 3);
    const tax = rows.find((row) => row.source === 'Tax on deal income');
    expect(Math.abs(Number(tax?.amount))).toBeGreaterThan(0);
    expect(next.deals[0]!.status).toBe('settled');
    expect(next.player.timeline.some((entry) => /paid out|worked out/i.test(entry.text))).toBe(
      true,
    );
    expect(reconcile(next.finance).ok).toBe(true);
  });

  it('writes a loss off: no money comes back and net worth falls by what was lost', () => {
    const { state, deal } = holding('startup', { multiple: 0 });
    const due = { ...state, deals: [{ ...deal, matures: state.world.year + 1 }] };
    const before = Number(estateOf(due).investments);
    const next = advanceYear(due).state;
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    expect(rows.find((row) => /^Returned — /.test(row.source))).toBeUndefined();
    expect(rows.find((row) => /^Gain — /.test(row.source))).toBeUndefined();
    expect(next.deals[0]!.status).toBe('lost');
    expect(before - Number(estateOf(next).investments)).toBeGreaterThanOrEqual(Number(deal.put));
    expect(next.player.timeline.some((entry) => /went under|lost all/i.test(entry.text))).toBe(
      true,
    );
  });

  it('returns part of a cheque as a transfer only, with no gain and no tax', () => {
    const { state, deal } = holding('startup', { multiple: 0.4 });
    const due = { ...state, deals: [{ ...deal, matures: state.world.year + 1 }] };
    const next = advanceYear(due).state;
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    expect(Number(rows.find((row) => /^Returned — /.test(row.source))?.amount)).toBe(
      Math.round(Number(deal.put) * 0.4),
    );
    expect(rows.find((row) => /^Gain — /.test(row.source))).toBeUndefined();
    expect(rows.find((row) => row.source === 'Tax on deal income')).toBeUndefined();
  });

  it('keeps the books balanced across a whole life of deals', () => {
    let state = holding('lending', { multiple: 1, matures: 9999 }).state;
    for (let i = 0; i < 12 && state.player.alive; i += 1) {
      state = answerEverything(advanceYear(state).state);
      expect(reconcile(state.finance).ok).toBe(true);
    }
  });
});

describe('0605 — tax on what deals earn', () => {
  it('is taxed on top of the wage, in the engine and in the advance', () => {
    const deals = [
      {
        id: 'a',
        kindId: 'lending',
        name: 'x',
        put: cents(10_000_000),
        since: 2040,
        matures: 9999,
        multiple: 1,
        paid: cents(0),
        status: 'live' as const,
      },
    ];
    const run = (otherIncome: number) =>
      runDealsYear({ deals, year: 2050, market: 'normal', otherIncome }).transactions.find(
        (row) => row.source === 'Tax on deal income',
      );
    expect(Math.abs(Number(run(250_000)?.amount))).toBeGreaterThan(
      Math.abs(Number(run(0)?.amount ?? 0)),
    );
    const lender = holding('lending', { multiple: 1, matures: 9999 }).state;
    const idle = { ...lender, employment: { ...lender.employment, job: undefined } };
    const taxIn = (s: GameState) => {
      const next = advanceYear(s).state;
      const row = next.finance.transactions.find(
        (r) => r.year === next.world.year && r.source === 'Tax on deal income',
      );
      return Math.abs(Number(row?.amount ?? 0));
    };
    expect(lender.employment.job).toBeDefined();
    expect(taxIn(lender)).toBeGreaterThan(taxIn(idle));
  });

  it('is nothing for nothing, and grows with what was earned', () => {
    expect(dealTaxOn(60_000, 0)).toBe(0);
    expect(dealTaxOn(60_000, -5)).toBe(0);
    expect(dealTaxOn(60_000, 50_000)).toBeGreaterThan(dealTaxOn(60_000, 10_000));
  });

  it('takes more from the same gain when the wage is higher, and a sensible slice of it', () => {
    expect(dealTaxOn(250_000, 100_000)).toBeGreaterThan(dealTaxOn(30_000, 100_000));
    const slice = dealTaxOn(50_000, 100_000) / 100_000;
    expect(slice).toBeGreaterThan(0.12);
    expect(slice).toBeLessThan(0.4);
  });
});

describe('0605 — selling on', () => {
  it('sells a property share after a year at the discount, as a transfer', () => {
    const { state } = holding('realEstate', { multiple: 1.5 });
    const later = { ...state, world: { ...state.world, year: state.world.year + 2 } };
    const before = cashOf(later);
    const sold = sellDealEarly(later, state.deals[0]!.id);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    const put = Number(state.deals[0]!.put) / 100;
    expect(cashOf(sold.value) - before).toBe(Math.round(put * 0.65));
    expect(sold.value.finance.transactions.at(-1)!.category).toBe('investment');
    expect(sold.value.deals[0]!.status).toBe('settled');
    expect(sold.value.player.timeline.at(-1)!.text).toMatch(/sold|got out/i);
    expect(reconcile(sold.value.finance).ok).toBe(true);
  });

  it('refuses a start-up, a deal sold too soon, and one that has ended', () => {
    const startup = holding('startup', { multiple: 3 }).state;
    const later = (s: GameState) => ({ ...s, world: { ...s.world, year: s.world.year + 2 } });
    expect(sellDealEarly(later(startup), startup.deals[0]!.id)).toEqual({
      ok: false,
      error: { kind: 'cannotSellThis' },
    });
    const property = holding('realEstate', { multiple: 1.5 }).state;
    expect(sellDealEarly(property, property.deals[0]!.id).ok).toBe(false);
    const ended = { ...property, deals: [{ ...property.deals[0]!, status: 'settled' as const }] };
    expect(sellDealEarly(later(ended), ended.deals[0]!.id).ok).toBe(false);
    expect(sellDealEarly(property, 'nope').ok).toBe(false);
  });
});

describe('0605 — at a death', () => {
  it('sells live deals on into the estate and hands the heir none', () => {
    let found: { dead: GameState; heirId: string } | undefined;
    for (let i = 0; i < 20 && !found; i += 1) {
      let state = topUp(liveTo(`deals-dies-${i}`, 40), 800_000);
      const offered = withOffer('startup', state);
      const placed = placeInDeal(offered.state, offered.offerId, offered.min);
      if (!placed.ok) continue;
      // A year of deals that never ends, so one is still live at the death.
      state = {
        ...placed.value,
        deals: placed.value.deals.map((d) => ({ ...d, matures: 9999, multiple: 3 })),
      };
      let guard = 0;
      while (state.player.alive && (guard += 1) < 90)
        state = answerEverything(advanceYear(state).state);
      const heir = heirsIn(state.family)[0];
      if (!state.player.alive && heir) found = { dead: state, heirId: heir.id };
    }
    if (!found) throw new Error('nobody died holding a deal');
    const { dead, heirId } = found;
    expect(dead.deals.some((d) => d.status === 'live')).toBe(true);
    const next = continueAsChild(dead, heirId)!;
    expect(next.deals).toEqual([]);
    const gift = next.finance.transactions.find(
      (row) => row.category === 'gift' && /private deals/.test(row.source),
    );
    const expected = dead.deals
      .filter((d) => d.status === 'live')
      .reduce((sum, d) => sum + Math.round(Number(d.put) * 0.65), 0);
    expect(Number(gift?.amount)).toBe(expected);
  });

  it('pays nothing for deals that had already ended', () => {
    const { state } = holding('startup', { multiple: 2 });
    const ended = {
      ...state,
      deals: state.deals.map((d) => ({ ...d, status: 'settled' as const })),
    };
    const net = estateOf(ended);
    expect(Number(net.investments)).toBe(Number(estateOf({ ...ended, deals: [] }).investments));
  });
});
