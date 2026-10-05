/**
 * Ticket 0605 acceptance tests — private deals on the character
 * (simulation side).
 */

import { describe, expect, it } from 'vitest';
import { DEAL_KINDS } from '@yearafter/content';
import { taxRate } from '@yearafter/careers';
import { reconcile, type MarketState, type PrivateDeal } from '@yearafter/finance';
import { advanceYear } from './advance';
import { netWorthOf } from './businesses';
import { continueAsChild, heirsIn } from './continue';
import { dealMarket, dealTaxOn, placeInDeal, runDealsYear, sellDealEarly } from './deals';
import { decide } from './decide';
import type { GameState } from './game-state';
import { estateOf, invest } from './investments';
import { INSTRUMENTS } from '@yearafter/content';
import { createNewGame } from './new-game';
import { openBusiness } from './businesses';
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

/* -------------------------------------------------------------------------- */
/* Found by the second agent's sabotage run                                    */
/* -------------------------------------------------------------------------- */

const at = (state: GameState, year: number, market?: MarketState): GameState => ({
  ...state,
  world: { ...state.world, year },
  ...(market ? { market } : {}),
});

describe('0605 — what is offered is this character’s, this year’s and this economy’s', () => {
  it('never offers a child anything, however rich, in any year', () => {
    const child = topUp(createNewGame({ seed: 'deals-rich-child' }), 3_000_000);
    expect(child.player.age).toBeLessThan(18);
    for (let year = child.world.year; year < child.world.year + 150; year += 1) {
      expect(dealMarket(at(child, year))).toEqual([]);
    }
  });

  it('pins what one character is offered, by seed and by year', () => {
    const row = (year: number) =>
      dealMarket(at(RICH, year)).map(
        (o) => `${o.id}|${o.kindId}|${o.name}|${o.maxTicket}|${o.lockYears}`,
      );
    expect(RICH.world.year).toBe(2040);
    expect(row(2040)).toEqual([]);
    expect(row(2041)).toEqual(['deal:2041:0|startup|Lanternfish|39500|5']);
    expect(row(2043)).toEqual(['deal:2043:0|realEstate|a strip of shops|257000|7']);
    // The id says which year it belongs to.
    for (let year = 2040; year < 2060; year += 1) {
      for (const offer of dealMarket(at(RICH, year)))
        expect(offer.id.startsWith(`deal:${year}:`)).toBe(true);
    }
  });

  it('brings fewer in a recession than in a boom, for the same life', () => {
    const count = (market: MarketState) => {
      let n = 0;
      for (let year = 2040; year < 2240; year += 1) n += dealMarket(at(RICH, year, market)).length;
      return n;
    };
    expect(count('severeRecession')).toBeLessThan(count('strongExpansion') * 0.7);
  });

  it('fixes the outcome from this character’s seed, and keeps it', () => {
    const place = (year: number) => {
      const s = at(RICH, year);
      const offer = dealMarket(s)[0]!;
      const placed = placeInDeal(s, offer.id, offer.minTicket);
      if (!placed.ok) throw new Error('refused');
      return placed.value.deals[0]!.multiple;
    };
    expect(place(2041)).toBe(0.2);
    expect(place(2042)).toBe(0.83);
  });
});

describe('0605 — several deals at once', () => {
  const two = (() => {
    const first = withOffer('startup');
    const one = placeInDeal(first.state, first.offerId, first.min);
    if (!one.ok) throw new Error('refused');
    const second = withOffer('realEstate', {
      ...one.value,
      world: { ...one.value.world, year: first.state.world.year + 1 },
    });
    const both = placeInDeal(second.state, second.offerId, second.min);
    if (!both.ok) throw new Error('refused');
    return { state: both.value, firstId: first.offerId, secondId: second.offerId };
  })();

  it('keeps the first when a second is placed, and gives each its own timeline line', () => {
    expect(two.state.deals).toHaveLength(2);
    expect(two.state.deals[0]!.id).toBe(two.firstId);
    const lines = two.state.player.timeline.filter((e) =>
      /deal|Deal|stake|cheque|put/.test(e.text),
    );
    const ids = lines.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.includes(two.firstId))).toBe(true);
    expect(ids.some((id) => id.includes(two.secondId))).toBe(true);
  });

  it('writes the line in the year and at the age it was written, one after another', () => {
    const first = withOffer('startup');
    const one = placeInDeal(first.state, first.offerId, first.min);
    if (!one.ok) throw new Error('refused');
    const entry = one.value.player.timeline.find((e) => e.id.includes(first.offerId))!;
    expect(entry.year).toBe(first.state.world.year);
    expect(entry.age).toBe(first.state.player.age);
    // A second line in the same year takes the next sequence number.
    const sameYearOffers = dealMarket(one.value);
    const another = sameYearOffers.find((o) => o.id !== first.offerId);
    if (another) {
      const both = placeInDeal(one.value, another.id, another.minTicket);
      if (!both.ok) throw new Error('refused');
      const next = both.value.player.timeline.find((e) => e.id.includes(another.id))!;
      expect(next.sequence).toBe(entry.sequence + 1);
    }
  });

  it('writes the same year’s two lines with different ids and the next sequence', () => {
    // Offers in one year: slot 0 and slot 1 may both come. Find a year where they do.
    for (let year = 2040; year < 2400; year += 1) {
      const s = at(RICH, year);
      const offers = dealMarket(s);
      if (offers.length < 2) continue;
      const a = placeInDeal(s, offers[0]!.id, offers[0]!.minTicket);
      if (!a.ok) continue;
      const b = placeInDeal(a.value, offers[1]!.id, offers[1]!.minTicket);
      if (!b.ok) continue;
      const mine = b.value.player.timeline.filter(
        (e) => e.year === year && /deal:placed/.test(e.id),
      );
      expect(mine).toHaveLength(2);
      expect(mine[0]!.id).not.toBe(mine[1]!.id);
      expect(mine[1]!.sequence).toBe(mine[0]!.sequence + 1);
      return;
    }
    throw new Error('no year brought two offers');
  });

  it('sells the one asked for, and settles only that one', () => {
    const base = withOffer('realEstate');
    const placed = placeInDeal(base.state, base.offerId, base.min);
    if (!placed.ok) throw new Error('refused');
    const mine = placed.value.deals[0]!;
    const other: PrivateDeal = {
      ...mine,
      id: 'deal:other',
      name: 'A different stake',
      put: cents(5_000_000),
    };
    const state = {
      ...placed.value,
      world: { ...placed.value.world, year: mine.since + 2 },
      deals: [other, mine],
    };
    const sold = sellDealEarly(state, mine.id);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.value.deals.find((d) => d.id === mine.id)!.status).toBe('settled');
    expect(sold.value.deals.find((d) => d.id === 'deal:other')).toEqual(other);
    // The cash that came in is the price of THIS deal, not the first one's.
    const price = Math.round(Number(mine.put) * 0.65);
    expect(Number(sold.value.player.cash) - Number(state.player.cash)).toBe(price);
  });

  it('leaves the state it was given alone', () => {
    const base = withOffer('realEstate');
    const placed = placeInDeal(base.state, base.offerId, base.min);
    if (!placed.ok) throw new Error('refused');
    const state = {
      ...placed.value,
      world: { ...placed.value.world, year: placed.value.deals[0]!.since + 2 },
    };
    for (const row of state.deals) Object.freeze(row);
    Object.freeze(state.deals);
    const sold = sellDealEarly(state, state.deals[0]!.id);
    expect(sold.ok).toBe(true);
    expect(state.deals[0]!.status).toBe('live');
  });
});

describe('0605 — tax, exactly', () => {
  it('is the progressive rate on the whole, less what the wage alone would have paid, to the dollar', () => {
    let fractional = 0;
    for (let other = 0; other <= 400_000; other += 13_337) {
      for (let earned = 1; earned <= 300_000; earned += 7_919) {
        const whole = other + earned;
        const raw = taxRate(whole) * whole - taxRate(other) * other;
        if (raw - Math.floor(raw) >= 0.5) fractional += 1;
        expect(dealTaxOn(other, earned)).toBe(Math.max(0, Math.round(raw)));
      }
    }
    // The grid reached cases a floor would have got wrong.
    expect(fractional).toBeGreaterThan(20);
  });

  it('taxes interest once and winnings once, on what was earned', () => {
    const lender: PrivateDeal = {
      id: 'l',
      kindId: 'lending',
      name: 'A loan',
      put: cents(10_000_000),
      since: 2040,
      matures: 9999,
      multiple: 1,
      paid: cents(0),
      status: 'live',
    };
    const winner: PrivateDeal = {
      id: 'w',
      kindId: 'startup',
      name: 'A win',
      put: cents(1_000_000),
      since: 2040,
      matures: 2050,
      multiple: 4,
      paid: cents(0),
      status: 'live',
    };
    const year = (deals: readonly PrivateDeal[], other: number) =>
      runDealsYear({ deals, year: 2050, market: 'normal', otherIncome: other });
    const interestOnly = year([lender], 80_000);
    expect(interestOnly.earned).toBe(9_000);
    const taxRow = (r: ReturnType<typeof year>) =>
      Math.abs(Number(r.transactions.find((t) => t.source === 'Tax on deal income')?.amount ?? 0)) /
      100;
    expect(taxRow(interestOnly)).toBe(dealTaxOn(80_000, 9_000));
    const winOnly = year([winner], 80_000);
    // $10,000 put in, 4x back, the gain is $30,000 on the normal economy's tilt of 1.
    expect(winOnly.earned).toBe(30_000);
    expect(taxRow(winOnly)).toBe(dealTaxOn(80_000, 30_000));
    const both = year([lender, winner], 80_000);
    expect(both.earned).toBe(39_000);
    expect(taxRow(both)).toBe(dealTaxOn(80_000, 39_000));
  });

  it('pays out less of a win in a recession, through the year a life runs', () => {
    const winner: PrivateDeal = {
      id: 'w',
      kindId: 'startup',
      name: 'A win',
      put: cents(1_000_000),
      since: 2040,
      matures: 2050,
      multiple: 4,
      paid: cents(0),
      status: 'live',
    };
    const earned = (market: MarketState) =>
      runDealsYear({ deals: [winner], year: 2050, market, otherIncome: 0 }).earned;
    expect(earned('severeRecession')).toBeLessThan(earned('normal'));
    expect(earned('normal')).toBeLessThan(earned('strongExpansion'));
  });

  it('counts a business owner’s draw as income the deals are taxed on top of', () => {
    const owner = (() => {
      const state = topUp(liveTo('deals-owner', 30), 400_000);
      const opened = openBusiness(state, 'biz.accounting');
      if (!opened.ok) throw new Error('could not open');
      return opened.value.state;
    })();
    const lent = holding('lending', { multiple: 1, matures: 9999 }).state;
    const withDeal = (base: GameState): GameState => ({
      ...base,
      deals: lent.deals.map((d) => ({ ...d, since: base.world.year - 3 })),
    });
    const taxOn = (state: GameState) => {
      const next = advanceYear(state).state;
      const row = next.finance.transactions.find(
        (r) => r.year === next.world.year && r.source === 'Tax on deal income',
      );
      return Math.abs(Number(row?.amount ?? 0));
    };
    const plain = topUp(liveTo('deals-owner', 30), 400_000);
    expect(owner.businesses.length).toBe(1);
    expect(taxOn(withDeal(owner))).toBeGreaterThan(taxOn(withDeal(plain)));
  });
});

describe('0605 — the estate, exactly', () => {
  const dead = (() => {
    for (let i = 0; i < 20; i += 1) {
      let state = topUp(liveTo(`deals-dies2-${i}`, 40), 800_000);
      const offered = withOffer('startup', state);
      const placed = placeInDeal(offered.state, offered.offerId, offered.min);
      if (!placed.ok) continue;
      state = {
        ...placed.value,
        deals: placed.value.deals.map((d) => ({ ...d, matures: 9999, multiple: 3 })),
      };
      let guard = 0;
      while (state.player.alive && (guard += 1) < 90)
        state = answerEverything(advanceYear(state).state);
      const heir = heirsIn(state.family)[0];
      if (!state.player.alive && heir) return { dead: state, heirId: heir.id };
    }
    throw new Error('nobody died holding a deal');
  })();

  const giftOf = (state: GameState) =>
    Number(
      continueAsChild(state, dead.heirId)!.finance.transactions.find(
        (row) => row.category === 'gift' && /private deals/.test(row.source),
      )?.amount ?? 0,
    );

  it('sells a deal that is about to go bad at what it will return, in the year of the death', () => {
    const live = dead.dead.deals.find((d) => d.status === 'live')!;
    const bad = { ...live, multiple: 0.2, matures: dead.dead.world.year + 1 };
    const state = { ...dead.dead, deals: [bad] };
    expect(giftOf(state)).toBe(Math.round(Number(bad.put) * 0.2 * 0.65));
    // Two years from the end the word has not got out: the cheque, less the discount.
    const early = { ...live, multiple: 0.2, matures: dead.dead.world.year + 2 };
    expect(giftOf({ ...dead.dead, deals: [early] })).toBe(Math.round(Number(early.put) * 0.65));
  });

  it('leaves out every deal that had already ended, lost or settled', () => {
    const live = dead.dead.deals.find((d) => d.status === 'live')!;
    const closed: PrivateDeal[] = [
      { ...live, id: 'c1', status: 'settled' },
      { ...live, id: 'c2', status: 'lost' },
    ];
    const state = { ...dead.dead, deals: [live, ...closed] };
    expect(giftOf(state)).toBe(Math.round(Number(live.put) * 0.65));
  });
});
