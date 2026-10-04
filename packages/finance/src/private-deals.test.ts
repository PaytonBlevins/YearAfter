/**
 * Ticket 0605 — private deals (finance side).
 *
 * Calibration anchors: the Angel Resource Institute's 245 completed angel
 * exits (just under 70% under 1x, just under 10% at 10x or more, mean 2.5x).
 */

import { describe, expect, it } from 'vitest';
import { cents } from '@yearafter/core';
import { DEAL_KINDS, findDealKind } from '@yearafter/content';
import {
  CHEQUE_STEP,
  MAX_DEALS,
  MAX_OFFERS,
  MAX_SHARE_OF_LIQUID,
  SECONDARY_DISCOUNT,
  carryingValue,
  dealOffersFor,
  dealYear,
  dealsValue,
  defaultYearOf,
  estateSaleOf,
  placeDeal,
  secondaryOffer,
  type DealOffer,
  type PrivateDeal,
} from './private-deals';
import type { MarketState } from './investments';

const rich = (extra: Partial<Parameters<typeof dealOffersFor>[0]> = {}) => ({
  seed: 'seed-a',
  year: 2050,
  age: 45,
  liquid: 5_000_000,
  market: 'normal' as MarketState,
  held: [] as readonly PrivateDeal[],
  kinds: DEAL_KINDS,
  ...extra,
});

const manyOffers = (seeds: number, extra: Partial<Parameters<typeof dealOffersFor>[0]> = {}) => {
  const all: DealOffer[] = [];
  for (let i = 0; i < seeds; i += 1) {
    for (let year = 2040; year < 2050; year += 1) {
      all.push(...dealOffersFor(rich({ seed: `s${i}`, year, ...extra })));
    }
  }
  return all;
};

function deal(over: Partial<PrivateDeal> = {}): PrivateDeal {
  return {
    id: 'deal:2050:0',
    kindId: 'startup',
    name: 'Brightwater Labs',
    put: cents(1_000_000),
    since: 2050,
    matures: 2055,
    multiple: 3,
    paid: cents(0),
    status: 'live',
    ...over,
  };
}

const offerFor = (kindId: string, over: Partial<DealOffer> = {}): DealOffer => {
  const kind = findDealKind(kindId)!;
  return {
    id: 'deal:2050:0',
    kindId,
    name: 'x',
    round: kind.minTicket * 50,
    minTicket: kind.minTicket,
    maxTicket: kind.minTicket * 4,
    lockYears: 5,
    ...over,
  };
};

describe('0605 — what is offered', () => {
  it('offers nothing to a minor or when there are no kinds', () => {
    expect(manyOffers(30, { age: 17 })).toEqual([]);
    expect(dealOffersFor(rich({ kinds: [] }))).toEqual([]);
  });

  it('is the same year every time it is asked, and a different one for a different seed', () => {
    expect(dealOffersFor(rich())).toEqual(dealOffersFor(rich()));
    const a = JSON.stringify(manyOffers(5));
    const b = JSON.stringify(manyOffers(5, { seed: 'other' }));
    expect(a).not.toBe(b);
  });

  it('never shows more than the cap, and brings one in about half the slots', () => {
    let years = 0;
    let offers = 0;
    for (let i = 0; i < 200; i += 1) {
      const row = dealOffersFor(rich({ seed: `c${i}` }));
      expect(row.length).toBeLessThanOrEqual(MAX_OFFERS);
      years += 1;
      offers += row.length;
    }
    const perSlot = offers / (years * MAX_OFFERS);
    expect(perSlot).toBeGreaterThan(0.38);
    expect(perSlot).toBeLessThan(0.52);
  });

  it('hides a kind from somebody who has not three cheques of it (spec 1140 soft band)', () => {
    for (const offer of manyOffers(40, { liquid: 20_000 })) {
      expect(findDealKind(offer.kindId)!.gate).toBeLessThanOrEqual(20_000);
    }
    const kinds = new Set(manyOffers(40).map((offer) => offer.kindId));
    expect(kinds.size).toBe(DEAL_KINDS.length);
  });

  it('caps a cheque by the round, the share of it, and half of what they hold (spec 1383 capacity)', () => {
    for (const offer of manyOffers(40)) {
      const kind = findDealKind(offer.kindId)!;
      expect(offer.maxTicket).toBeGreaterThanOrEqual(offer.minTicket);
      expect(offer.maxTicket).toBeLessThanOrEqual(offer.round * kind.maxShareOfRound);
      expect(offer.maxTicket % CHEQUE_STEP).toBe(0);
    }
    for (const offer of manyOffers(40, { liquid: 40_000 })) {
      expect(offer.maxTicket).toBeLessThanOrEqual(40_000 * MAX_SHARE_OF_LIQUID);
    }
  });

  it('lets a rich person write a bigger cheque than a poor one into the same round', () => {
    const poor = dealOffersFor(rich({ liquid: 60_000 }));
    const wealthy = dealOffersFor(rich({ liquid: 6_000_000 }));
    // The same slot is the same deal either way.
    for (const a of poor) {
      const b = wealthy.find((offer) => offer.id === a.id);
      if (b && a.kindId === b.kindId) {
        expect(b.round).toBe(a.round);
        expect(b.maxTicket).toBeGreaterThanOrEqual(a.maxTicket);
      }
    }
  });

  it('does not change what a slot is because the other one was taken', () => {
    let checked = 0;
    for (let i = 0; i < 40; i += 1) {
      const first = dealOffersFor(rich({ seed: `c${i}` }));
      if (first.length < 2) continue;
      checked += 1;
      const taken = first[0]!;
      const held = [deal({ id: taken.id, kindId: taken.kindId })];
      const after = dealOffersFor(rich({ seed: `c${i}`, held, liquid: 4_000_000 }));
      expect(after.find((offer) => offer.id === taken.id)).toBeUndefined();
      for (const offer of first.filter((o) => o.id !== taken.id)) {
        expect(after.find((o) => o.id === offer.id)?.kindId).toBe(offer.kindId);
      }
    }
    expect(checked).toBeGreaterThan(3);
    const first = dealOffersFor(rich({ seed: 'c3' }));
    for (const taken of first) {
      const held = [deal({ id: taken.id, kindId: taken.kindId })];
      const after = dealOffersFor(rich({ seed: 'c3', held, liquid: 4_000_000 }));
      expect(after.find((offer) => offer.id === taken.id)).toBeUndefined();
      for (const offer of first.filter((o) => o.id !== taken.id)) {
        expect(after.find((o) => o.id === offer.id)?.kindId).toBe(offer.kindId);
      }
    }
  });

  it('stops offering at the cap of live deals, but not for ended ones', () => {
    const live = Array.from({ length: MAX_DEALS }, (_, i) => deal({ id: `x${i}` }));
    expect(manyOffers(10, { held: live })).toEqual([]);
    const ended = live.map((d) => ({ ...d, status: 'settled' as const }));
    expect(manyOffers(10, { held: ended }).length).toBeGreaterThan(0);
  });

  it('brings the cheaper kinds up more often than the dear ones', () => {
    const count = (id: string) => manyOffers(150).filter((offer) => offer.kindId === id).length;
    expect(count('startup')).toBeGreaterThan(count('fund') * 1.8);
  });

  it('is built so a cap can never fall below the minimum', () => {
    for (const kind of DEAL_KINDS) {
      expect(kind.gate * MAX_SHARE_OF_LIQUID, kind.id).toBeGreaterThanOrEqual(kind.minTicket);
      expect(
        kind.minTicket * kind.roundMultiple[0] * kind.maxShareOfRound,
        kind.id,
      ).toBeGreaterThanOrEqual(kind.minTicket * 2 - 1e-9);
    }
  });

  it('offers less in a recession than in a boom', () => {
    const slump = manyOffers(60, { market: 'severeRecession' }).length;
    const boom = manyOffers(60, { market: 'strongExpansion' }).length;
    expect(slump).toBeLessThan(boom * 0.6);
  });
});

describe('0605 — writing the cheque', () => {
  const held: readonly PrivateDeal[] = [];
  const place = (offer: DealOffer, amount: number, over = {}) =>
    placeDeal({ offer, amount, liquid: 1_000_000, held, year: 2050, seed: 'seed-a', ...over });

  it('refuses a cheque below the minimum, above the cap, or beyond their money', () => {
    const offer = offerFor('startup');
    expect(place(offer, offer.minTicket - 500)).toEqual({
      ok: false,
      error: { kind: 'belowMinimum', minimum: offer.minTicket },
    });
    expect(place(offer, offer.maxTicket + 500)).toEqual({
      ok: false,
      error: { kind: 'aboveMaximum', maximum: offer.maxTicket },
    });
    expect(place(offer, offer.minTicket, { liquid: offer.minTicket - 1 })).toEqual({
      ok: false,
      error: { kind: 'notEnoughMoney', liquid: offer.minTicket - 1 },
    });
  });

  it('refuses an offer already taken and a full book', () => {
    const offer = offerFor('startup');
    expect(place(offer, offer.minTicket, { held: [deal({ id: offer.id })] }).ok).toBe(false);
    const full = Array.from({ length: MAX_DEALS }, (_, i) => deal({ id: `x${i}` }));
    expect(place(offer, offer.minTicket, { held: full })).toEqual({
      ok: false,
      error: { kind: 'tooManyDeals', limit: MAX_DEALS },
    });
    expect(place({ ...offer, kindId: 'nope' }, offer.minTicket).ok).toBe(false);
  });

  it('writes the cheque in cents, and the money is back in the year the lock-up ends', () => {
    const offer = offerFor('startup', { lockYears: 4 });
    const made = place(offer, 7_500);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(Number(made.value.put)).toBe(750_000);
    expect(made.value.since).toBe(2050);
    expect(made.value.matures).toBe(2054);
    expect(made.value.status).toBe('live');
    expect(Number(made.value.paid)).toBe(0);
  });

  it('fixes the outcome by seed and offer, so a reload cannot reroll it', () => {
    const offer = offerFor('startup');
    const a = place(offer, offer.minTicket);
    const b = place(offer, offer.minTicket);
    expect(a).toEqual(b);
    const results = new Set<number>();
    for (let i = 0; i < 40; i += 1) {
      const made = place(offer, offer.minTicket, { seed: `s${i}` });
      if (made.ok) results.add(made.value.multiple);
    }
    expect(results.size).toBeGreaterThan(10);
  });

  it('draws start-ups the way the angel data says: most lose, one in ten wins big', () => {
    const offer = offerFor('startup');
    let under = 0;
    let big = 0;
    let wiped = 0;
    let sum = 0;
    const N = 4000;
    for (let i = 0; i < N; i += 1) {
      const made = place(offer, offer.minTicket, { seed: `angel${i}` });
      if (!made.ok) throw new Error('refused');
      const m = made.value.multiple;
      if (m < 1) under += 1;
      if (m >= 10) big += 1;
      if (m === 0) wiped += 1;
      sum += m;
    }
    expect(under / N).toBeGreaterThan(0.66);
    expect(under / N).toBeLessThan(0.74);
    expect(big / N).toBeGreaterThan(0.07);
    expect(big / N).toBeLessThan(0.13);
    expect(wiped / N).toBeGreaterThan(0.4);
    expect(wiped / N).toBeLessThan(0.5);
    expect(sum / N).toBeGreaterThan(2.1);
    expect(sum / N).toBeLessThan(3.1);
  });

  it('draws each other kind to a plausible average yearly return', () => {
    for (const kind of DEAL_KINDS.filter((k) => k.id !== 'startup')) {
      const offer = offerFor(kind.id, {
        lockYears: Math.round((kind.lockYears[0] + kind.lockYears[1]) / 2),
      });
      let sum = 0;
      const N = 3000;
      for (let i = 0; i < N; i += 1) {
        const made = placeDeal({
          offer,
          amount: kind.minTicket,
          liquid: 1e9,
          held: [],
          year: 2050,
          seed: `k${i}`,
        });
        if (!made.ok) throw new Error('refused');
        sum += made.value.multiple;
      }
      const mean = sum / N;
      const years = offer.lockYears;
      const yearly = kind.yearlyYield + (Math.pow(mean, 1 / years) - 1);
      expect(yearly, kind.id).toBeGreaterThan(0.06);
      expect(yearly, kind.id).toBeLessThan(0.15);
    }
  });

  it('defaults about one private loan in twenty-five', () => {
    const offer = offerFor('lending');
    let bad = 0;
    const N = 5000;
    for (let i = 0; i < N; i += 1) {
      const made = place(offer, offer.minTicket, { seed: `l${i}` });
      if (made.ok && made.value.multiple < 1) bad += 1;
    }
    expect(bad / N).toBeGreaterThan(0.025);
    expect(bad / N).toBeLessThan(0.06);
  });

  it('has weights that add up to one for every kind', () => {
    for (const kind of DEAL_KINDS) {
      expect(kind.outcomes.reduce((sum, row) => sum + row.weight, 0)).toBeCloseTo(1, 6);
    }
  });
});

describe('0605 — a year of a deal', () => {
  it('says nothing and pays nothing in the year the cheque is written', () => {
    const result = dealYear(deal(), 2050, 'normal');
    expect(result.note).toBeUndefined();
    expect(Number(result.returned)).toBe(0);
    expect(result.deal).toEqual(deal());
    const loan = dealYear(deal({ kindId: 'lending', multiple: 1 }), 2050, 'normal');
    expect(Number(loan.interest)).toBe(0);
    expect(loan.note).toBeUndefined();
  });

  it('pays a lender nine percent a year on the cheque, and says so once', () => {
    const loan = deal({ kindId: 'lending', multiple: 1, matures: 2055 });
    const first = dealYear(loan, 2051, 'normal');
    expect(Number(first.interest)).toBe(90_000);
    expect(first.note).toBe('interest');
    expect(Number(first.deal.paid)).toBe(90_000);
    const second = dealYear(first.deal, 2052, 'normal');
    expect(Number(second.interest)).toBe(90_000);
    expect(second.note).toBeUndefined();
    expect(Number(second.deal.paid)).toBe(180_000);
  });

  it('pays the lender back the cheque at the end, whatever the economy', () => {
    const loan = deal({ kindId: 'lending', multiple: 1 });
    for (const market of ['severeRecession', 'strongExpansion'] as const) {
      const done = dealYear(loan, 2055, market);
      expect(Number(done.returned)).toBe(1_000_000);
      expect(done.deal.status).toBe('settled');
      expect(done.note).toBe('repaid');
    }
  });

  it('stops paying a loan that will default, at its default year, and returns what is left', () => {
    const bad = deal({ kindId: 'lending', multiple: 0.25, since: 2050, matures: 2056 });
    expect(defaultYearOf(bad)).toBe(2053);
    const before = dealYear(bad, 2052, 'normal');
    expect(Number(before.interest)).toBe(90_000);
    const during = dealYear(before.deal, 2053, 'normal');
    expect(during.note).toBe('defaulted');
    expect(Number(during.returned)).toBe(250_000);
    expect(Number(during.interest)).toBe(0);
    expect(during.deal.status).toBe('lost');
  });

  it('settles a win at the multiple, scaled by the economy on the gain only', () => {
    const win = deal({ multiple: 3, put: cents(1_000_000) });
    const normal = dealYear(win, 2055, 'normal');
    expect(Number(normal.returned)).toBe(3_000_000);
    expect(normal.note).toBe('settledUp');
    expect(normal.deal.status).toBe('settled');
    const slump = dealYear(win, 2055, 'recession');
    expect(Number(slump.returned)).toBe(Math.round(1_000_000 * (1 + 2 * 0.85)));
    const boom = dealYear(win, 2055, 'strongExpansion');
    expect(Number(boom.returned)).toBe(Math.round(1_000_000 * (1 + 2 * 1.15)));
  });

  it('does not make a loss worse because it was a recession', () => {
    const bad = deal({ multiple: 0.4 });
    for (const market of ['severeRecession', 'normal', 'strongExpansion'] as const) {
      const done = dealYear(bad, 2055, market);
      expect(Number(done.returned)).toBe(400_000);
      expect(done.deal.status).toBe('lost');
      expect(done.note).toBe('settledDown');
    }
  });

  it('writes off a total loss and says it was lost', () => {
    const done = dealYear(deal({ multiple: 0 }), 2055, 'normal');
    expect(Number(done.returned)).toBe(0);
    expect(done.deal.status).toBe('lost');
    expect(done.note).toBe('lost');
  });

  it('lets the word out only in the last year before a bad end', () => {
    const bad = deal({ multiple: 0.2, since: 2050, matures: 2055 });
    for (const year of [2051, 2052, 2053])
      expect(dealYear(bad, year, 'normal').note).toBeUndefined();
    expect(dealYear(bad, 2054, 'normal').note).toBe('shaky');
    const good = deal({ multiple: 3 });
    expect(dealYear(good, 2054, 'normal').note).toBeUndefined();
    // A one-year deal has no warning to give.
    expect(
      dealYear(deal({ multiple: 0.2, since: 2050, matures: 2051 }), 2050, 'normal').note,
    ).toBeUndefined();
  });

  it('leaves an ended deal alone', () => {
    const ended = deal({ status: 'lost' });
    const result = dealYear(ended, 2056, 'normal');
    expect(result.deal).toBe(ended);
    expect(Number(result.returned)).toBe(0);
  });

  it('carries a live deal at the cheque, an ended one at nothing', () => {
    expect(Number(carryingValue(deal()))).toBe(1_000_000);
    expect(Number(carryingValue(deal({ status: 'settled' })))).toBe(0);
    expect(
      dealsValue([
        deal(),
        deal({ id: 'b', put: cents(500_000) }),
        deal({ id: 'c', status: 'lost' }),
      ]),
    ).toBe(1_500_000);
  });
});

describe('0605 — selling on', () => {
  const sellable = (over: Partial<PrivateDeal> = {}) =>
    deal({ kindId: 'realEstate', multiple: 1.5, ...over });

  it('is refused for kinds that cannot be sold on, and before a year is up', () => {
    for (const id of ['startup', 'growth', 'fund']) {
      expect(secondaryOffer(deal({ kindId: id }), 2053)).toEqual({
        ok: false,
        error: { kind: 'cannotSellThis' },
      });
    }
    expect(secondaryOffer(sellable(), 2050)).toEqual({
      ok: false,
      error: { kind: 'cannotSellYet', year: 2051 },
    });
    expect(secondaryOffer(sellable({ status: 'settled' }), 2053).ok).toBe(false);
  });

  it('takes the secondary discount off the cheque', () => {
    const price = secondaryOffer(sellable(), 2052);
    expect(price.ok).toBe(true);
    if (price.ok)
      expect(Number(price.value)).toBe(Math.round(1_000_000 * (1 - SECONDARY_DISCOUNT)));
  });

  it('prices a deal that has been warned about at what it will return, so the warning is no exit', () => {
    const bad = sellable({ multiple: 0.2, since: 2050, matures: 2055 });
    const early = secondaryOffer(bad, 2052);
    const late = secondaryOffer(bad, 2054);
    expect(early.ok && late.ok).toBe(true);
    if (!early.ok || !late.ok) return;
    expect(Number(early.value)).toBe(650_000);
    expect(Number(late.value)).toBe(Math.round(1_000_000 * 0.2 * 0.65));
    expect(Number(late.value)).toBeLessThanOrEqual(Number(dealYear(bad, 2055, 'normal').returned));
  });

  it('sells a dead person’s deals whatever the kind, with the same pricing', () => {
    expect(Number(estateSaleOf(deal(), 2052))).toBe(650_000);
    expect(Number(estateSaleOf(deal({ multiple: 0.1, matures: 2053 }), 2052))).toBe(65_000);
    expect(Number(estateSaleOf(deal({ status: 'settled' }), 2052))).toBe(0);
  });
});
