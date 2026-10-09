/**
 * Ticket 0604 acceptance tests — what happens to a business, and what becomes
 * of it at a death (simulation side).
 *
 * Measured first, on the engine as 0603 left it: a mature business's profit
 * moved by a factor of two or more between years with nothing to point at
 * (finding 37), the cheap trades paid several times their startup every year
 * (finding 38), and five years in, four businesses in five were still open.
 * The events and the rival are the things that happen; these tests pin that
 * they happen to the right business, in the right years, and are said.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { findBusinessType } from '@yearafter/content';
import {
  BUSINESS_EVENTS,
  RIVAL_BITE_MAX,
  RIVAL_BITE_MIN,
  RIVAL_YEARS,
  TRANSITION_REPUTATION,
  businessValueFor,
  eventLineFor,
  findBusinessEvent,
  newBusiness,
  type HeldLoan,
  type OwnedBusiness,
  type Rival,
} from '@yearafter/finance';
import { advanceYear } from './advance';
import { continueAsChild, heirsIn, keepsBusinesses } from './continue';
import { netWorthOf, openBusiness, runBusinessesYear } from './businesses';
import { decide } from './decide';
import type { GameState } from './game-state';
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

/* -------------------------------------------------------------------------- */
/* One business, one year, any seed                                            */
/* -------------------------------------------------------------------------- */

const CAFE = findBusinessType('biz.cafe')!;
const YEAR = 2040;

/** A café that has found its feet: open since 2030, fully staffed, an ordinary name. */
const cafe = (over: Partial<OwnedBusiness> = {}): OwnedBusiness => ({
  ...newBusiness(CAFE, 'biz:2030:cafe:0', 'The Corner Cup', 2030, 1),
  staff: CAFE.staff,
  reputation: 50,
  cash: dollars(40_000),
  ...over,
});

const runOne = (
  business: OwnedBusiness,
  seed: string,
  market: 'normal' | 'severeRecession' | 'recession' | 'strongExpansion' = 'normal',
  year = YEAR,
) =>
  runBusinessesYear({
    businesses: [business],
    year,
    seed,
    market,
    available: 1_000_000,
    holdsJob: false,
    stat: () => 50,
  });

/** The first seed in which this business has this happen to it. */
function seedWhere(
  eventId: string,
  business: OwnedBusiness = cafe(),
  market: 'normal' | 'severeRecession' = 'normal',
): string {
  for (let i = 0; i < 6000; i += 1) {
    const seed = `ev-${eventId}-${i}`;
    if (runOne(business, seed, market).businesses[0]?.last?.event === eventId) return seed;
  }
  throw new Error(`never saw ${eventId}`);
}

describe('0604 — a year with something in it', () => {
  it('is the same year every time it is played, and one business’s news is its own', () => {
    for (let i = 0; i < 40; i += 1) {
      const seed = `same-${i}`;
      const first = runOne(cafe(), seed);
      const again = runOne(cafe(), seed);
      expect(JSON.stringify(again.businesses)).toBe(JSON.stringify(first.businesses));
      expect(again.lines).toEqual(first.lines);
    }
    // A second business in the same run does not move the first one's event.
    const other = cafe({ id: 'biz:2031:cafe:1', name: 'Next Door' });
    let different = 0;
    for (let i = 0; i < 200; i += 1) {
      const seed = `alone-${i}`;
      const alone = runOne(cafe(), seed).businesses[0]!.last?.event;
      const together = runBusinessesYear({
        businesses: [cafe(), other],
        year: YEAR,
        seed,
        market: 'normal',
        available: 1_000_000,
        holdsJob: false,
        stat: () => 50,
      }).businesses;
      expect(together[0]!.last?.event).toBe(alone);
      if (together[1]!.last?.event !== alone) different += 1;
    }
    // And the two are not simply the same story told twice.
    expect(different).toBeGreaterThan(40);
  });

  it('has news in about half of all years, and says it in a line with the business’s name in it', () => {
    let years = 0;
    for (let i = 0; i < 600; i += 1) {
      const result = runOne(cafe(), `half-${i}`);
      const last = result.businesses[0]!.last!;
      if (last.event) {
        years += 1;
        const event = findBusinessEvent(last.event)!;
        expect(result.lines).toContain(eventLineFor(event, 'The Corner Cup'));
      } else {
        for (const event of BUSINESS_EVENTS) {
          expect(result.lines).not.toContain(eventLineFor(event, 'The Corner Cup'));
        }
      }
    }
    expect(years / 600).toBeGreaterThan(0.45);
    expect(years / 600).toBeLessThan(0.65);
  });

  it('sees every kind of news, good and bad, in a thousand years of one café', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const id = runOne(cafe(), `kinds-${i}`).businesses[0]!.last?.event;
      if (id) seen.add(id);
    }
    const possible = BUSINESS_EVENTS.filter(
      (event) => event.effect !== 'rivalCloses' && !(event.needs === 'supplier' && !CAFE.supplier),
    );
    for (const event of possible) expect(seen.has(event.id), event.id).toBe(true);
    // A rival cannot close when there is none.
    expect(seen.has('rival-closes')).toBe(false);
  });

  it('leaves the part-year it opens in alone: nothing happens before it has traded', () => {
    for (let i = 0; i < 300; i += 1) {
      const fresh = cafe({ openedYear: YEAR });
      expect(runOne(fresh, `fresh-${i}`).businesses[0]!.last?.event, `${i}`).toBeUndefined();
    }
  });

  it('moves the reputation by what the news says, on top of how the year went', () => {
    const quiet: number[] = [];
    const bad: number[] = [];
    const good: number[] = [];
    for (let i = 0; i < 1500; i += 1) {
      const next = runOne(cafe(), `rep-${i}`).businesses[0]!;
      const event = next.last?.event;
      if (!event) quiet.push(next.reputation);
      else if (event === 'bad-review') bad.push(next.reputation);
      else if (event === 'write-up') good.push(next.reputation);
    }
    const mean = (rows: number[]): number => rows.reduce((sum, row) => sum + row, 0) / rows.length;
    expect(bad.length).toBeGreaterThan(10);
    expect(good.length).toBeGreaterThan(10);
    expect(mean(bad) - mean(quiet)).toBeLessThan(-3);
    expect(mean(bad) - mean(quiet)).toBeGreaterThan(-7);
    expect(mean(good) - mean(quiet)).toBeGreaterThan(3);
    expect(mean(good) - mean(quiet)).toBeLessThan(7);
  });

  it('keeps a reputation inside nought and a hundred however the news lands', () => {
    const low = runOne(cafe({ reputation: 0 }), seedWhere('bad-review', cafe({ reputation: 0 })))
      .businesses[0]!;
    expect(low.reputation).toBeGreaterThanOrEqual(0);
    const high = runOne(cafe({ reputation: 100 }), seedWhere('write-up', cafe({ reputation: 100 })))
      .businesses[0]!;
    expect(high.reputation).toBeLessThanOrEqual(100);
  });

  it('brings in money, not just costs: a one-off job leaves the year better than a breakdown does', () => {
    const jobSeed = seedWhere('one-off-job');
    const breakSeed = seedWhere('breakdown');
    const job = runOne(cafe(), jobSeed).businesses[0]!.last!;
    const broke = runOne(cafe(), breakSeed).businesses[0]!.last!;
    expect(job.costs).toBeLessThan(broke.costs);
  });
});

describe('0604 — a rival', () => {
  it('opens on the year the news says it did, as big as a café’s trade makes it', () => {
    const seed = seedWhere('rival-opens');
    const result = runOne(cafe(), seed);
    const next = result.businesses[0]!;
    expect(next.rival).toBeDefined();
    expect(next.rival!.since).toBe(YEAR);
    expect(next.rival!.bite).toBeGreaterThanOrEqual(RIVAL_BITE_MIN);
    expect(next.rival!.bite).toBeLessThanOrEqual(RIVAL_BITE_MAX);
    expect(result.lines.some((line) => /rival/i.test(line))).toBe(true);
    // The year it opens, nothing is taken yet: customers drift over after.
    expect(next.last!.rivalTook).toBeUndefined();
  });

  it('takes custom the year after, and the dashboard says how much', () => {
    const rival: Rival = { since: YEAR - 1, bite: 0.12 };
    let counted = 0;
    for (let i = 0; i < 60; i += 1) {
      const next = runOne(cafe({ rival }), `took-${i}`).businesses[0]!;
      expect(next.last!.rivalTook, `${i}`).toBeGreaterThan(0.03);
      expect(next.last!.rivalTook!, `${i}`).toBeLessThanOrEqual(0.12);
      counted += 1;
    }
    expect(counted).toBe(60);
  });

  it('is gone when its four years are up, and not before', () => {
    for (let i = 0; i < 80; i += 1) {
      const seed = `fade-${i}`;
      const fresh = runOne(cafe({ rival: { since: YEAR - 1, bite: 0.1 } }), seed).businesses[0]!;
      const spent = runOne(cafe({ rival: { since: YEAR - (RIVAL_YEARS - 1), bite: 0.1 } }), seed)
        .businesses[0]!;
      // A rival on its second year is still there unless the news was that it closed.
      if (fresh.last!.event !== 'rival-closes') expect(fresh.rival, seed).toBeDefined();
      else expect(fresh.rival, seed).toBeUndefined();
      // And one on its last year is not there next year either way.
      expect(spent.rival, seed).toBeUndefined();
    }
  });

  it('can close, and then it is gone and a few of its customers come over', () => {
    const rival: Rival = { since: YEAR - 1, bite: 0.1 };
    const seed = seedWhere('rival-closes', cafe({ rival }));
    const next = runOne(cafe({ rival }), seed).businesses[0]!;
    expect(next.rival).toBeUndefined();
    expect(next.last!.event).toBe('rival-closes');
  });

  it('is not cumulative: a second rival does not open while the first is still there', () => {
    const rival: Rival = { since: YEAR - 1, bite: 0.1 };
    for (let i = 0; i < 400; i += 1) {
      const next = runOne(cafe({ rival }), `one-at-a-time-${i}`).businesses[0]!;
      expect(next.last!.event).not.toBe('rival-opens');
    }
  });

  it('is felt less by a business with a name in town', () => {
    const rival: Rival = { since: YEAR - 1, bite: 0.12 };
    const plain = runOne(cafe({ rival, reputation: 40 }), 'name').businesses[0]!.last!.rivalTook!;
    const loved = runOne(cafe({ rival, reputation: 90 }), 'name').businesses[0]!.last!.rivalTook!;
    expect(loved).toBeLessThan(plain * 0.7);
  });
});

describe('0604 — the economy, said out loud', () => {
  const RESTAURANT = findBusinessType('biz.restaurant')!;
  const restaurant = (): OwnedBusiness => ({
    ...newBusiness(RESTAURANT, 'biz:2030:restaurant:0', 'Chez Nous', 2030, 1),
    staff: RESTAURANT.staff,
    reputation: 50,
    cash: dollars(80_000),
  });

  it('takes a visible share of custom in a bad year, and says so', () => {
    const result = runOne(restaurant(), 'slump', 'severeRecession');
    const last = result.businesses[0]!.last!;
    // P4 halves the severe-recession hit: 13% × restaurant cyclicality 0.6.
    expect(last.economy).toBeCloseTo(0.922, 12);
    expect(result.lines.some((line) => /downturn/i.test(line) && /Chez Nous/.test(line))).toBe(
      true,
    );
    const percent = /about (\d+)%/.exec(result.lines.find((line) => /downturn/i.test(line)) ?? '');
    expect(Number(percent?.[1])).toBe(Math.round((1 - last.economy!) * 100));
  });

  it('says nothing about an ordinary economy', () => {
    const result = runOne(restaurant(), 'ordinary', 'normal');
    expect(result.businesses[0]!.last!.economy).toBeUndefined();
    expect(result.lines.some((line) => /downturn|good economy/i.test(line))).toBe(false);
  });

  it('notices a boom too', () => {
    const hotel = findBusinessType('biz.hotel')!;
    const grand: OwnedBusiness = {
      ...newBusiness(hotel, 'biz:2030:hotel:0', 'The Grand', 2030, 1),
      staff: hotel.staff,
      reputation: 50,
      cash: dollars(900_000),
    };
    const result = runOne(grand, 'boom', 'strongExpansion');
    expect(result.businesses[0]!.last!.economy).toBeGreaterThan(1.05);
    expect(result.lines.some((line) => /good economy/i.test(line) && /The Grand/.test(line))).toBe(
      true,
    );
  });

  it('is felt by the trades that feel it: a recession is harder on a jeweller than a cleaner', () => {
    const felt = (typeId: string): number => {
      const type = findBusinessType(typeId)!;
      const business: OwnedBusiness = {
        ...newBusiness(type, `biz:2030:${typeId}:0`, 'X', 2030, 1),
        staff: type.staff,
        reputation: 50,
        cash: dollars(type.startup),
      };
      return runOne(business, 'felt', 'recession').businesses[0]!.last!.economy ?? 1;
    };
    expect(felt('biz.jewelry')).toBeLessThan(felt('biz.cleaning'));
  });
});

/* -------------------------------------------------------------------------- */
/* A death                                                                      */
/* -------------------------------------------------------------------------- */

const loanOn = (businessId: string, balance: number, termLeft = 10): HeldLoan => ({
  productId: 'loan.smallbiz',
  principal: dollars(balance),
  balance: dollars(balance),
  termLeft,
  inArrears: false,
  businessId,
});

/** Somebody who owned a café and lived to the end, with a grown child to carry on as. Built once. */
let memo: { dead: GameState; heirId: string } | undefined;
function deadOwner(): { dead: GameState; heirId: string } {
  if (memo) return memo;
  for (let i = 0; i < 20; i += 1) {
    let state = topUp(liveTo(`biz-dies-${i}`, 30), 400_000);
    const opened = openBusiness(state, 'biz.cafe');
    if (!opened.ok) continue;
    state = opened.value.state;
    let guard = 0;
    while (state.player.alive && (guard += 1) < 90)
      state = answerEverything(advanceYear(state).state);
    if (state.player.alive || state.businesses.length === 0) continue;
    const heir = heirsIn(state.family).find((member) => state.world.year - member.birthYear >= 18);
    if (!heir) continue;
    memo = { dead: state, heirId: heir.id };
    return memo;
  }
  throw new Error('nobody died owning a café with a grown child');
}

describe('0604 — an heir and the business', () => {
  it('says who keeps one: an adult, unless the player chose to sell', () => {
    expect(keepsBusinesses(30, undefined)).toBe(true);
    expect(keepsBusinesses(30, true)).toBe(true);
    expect(keepsBusinesses(30, false)).toBe(false);
    expect(keepsBusinesses(18, undefined)).toBe(true);
    expect(keepsBusinesses(17, undefined)).toBe(false);
    expect(keepsBusinesses(10, true)).toBe(false);
  });

  it('hands the business on as it stands, with the town’s doubts about a new owner', () => {
    const { dead, heirId } = deadOwner();
    const next = continueAsChild(dead, heirId)!;
    expect(next.businesses.map((row) => row.id)).toEqual(dead.businesses.map((row) => row.id));
    for (const [index, kept] of next.businesses.entries()) {
      const was = dead.businesses[index]!;
      expect(kept.typeId).toBe(was.typeId);
      expect(kept.name).toBe(was.name);
      expect(kept.cash).toBe(was.cash);
      expect(kept.staff).toBe(was.staff);
      expect(kept.branches).toEqual(was.branches);
      expect(kept.profits).toEqual(was.profits);
      expect(kept.openedYear).toBe(was.openedYear);
      expect(kept.reputation).toBe(Math.max(0, was.reputation - TRANSITION_REPUTATION));
    }
    // What it is carried at is what it was worth when it came to them, not what the parent put in.
    const type = findBusinessType(dead.businesses[0]!.typeId)!;
    expect(Number(next.businesses[0]!.invested)).toBe(
      dollars(businessValueFor(dead.businesses[0]!, type, dead.world.year)),
    );
    // Handed on, not sold: no sale is posted and the money in the till is not paid out.
    expect(next.finance.transactions.some((row) => /business/i.test(row.source))).toBe(false);
  });

  it('counts the business as the heir’s own, and worth more kept than sold', () => {
    const { dead, heirId } = deadOwner();
    const kept = continueAsChild(dead, heirId)!;
    const sold = continueAsChild(dead, heirId, { keepBusinesses: false })!;
    expect(kept.businesses.length).toBeGreaterThan(0);
    // Selling takes a buyer’s discount and a broker’s fee, so the heir who sells holds less.
    expect(netWorthOf(kept)).toBeGreaterThan(netWorthOf(sold));
    // And what was posted as cash is the same estate in both: the difference is the business.
    const cashOf = (s: GameState): number => Number(s.player.cash) / 100;
    expect(cashOf(kept)).toBeLessThan(cashOf(sold));
  });

  it('sells them instead when asked, as it always did', () => {
    const { dead, heirId } = deadOwner();
    const sold = continueAsChild(dead, heirId, { keepBusinesses: false })!;
    expect(sold.businesses).toEqual([]);
    expect(sold.loans).toEqual([]);
    expect(
      sold.finance.transactions.some(
        (row) => row.category === 'gift' && /business/i.test(row.source),
      ),
    ).toBe(true);
  });

  it('sells them for a child, who cannot run one, whatever was asked', () => {
    const { dead, heirId } = deadOwner();
    const young = {
      ...dead,
      family: {
        ...dead.family,
        members: dead.family.members.map((member) =>
          member.id === heirId ? { ...member, birthYear: dead.world.year - 10 } : member,
        ),
      },
    };
    const next = continueAsChild(young, heirId, { keepBusinesses: true })!;
    expect(next.businesses).toEqual([]);
    expect(
      next.finance.transactions.some(
        (row) => row.category === 'gift' && /business/i.test(row.source),
      ),
    ).toBe(true);
  });

  it('hands on the lender with the business, and no other debt', () => {
    const { dead, heirId } = deadOwner();
    const business = dead.businesses[0]!;
    const personal: HeldLoan = {
      productId: 'loan.personal',
      principal: dollars(9_000),
      balance: dollars(9_000),
      termLeft: 4,
      inArrears: false,
    };
    const orphan = loanOn('biz:1999:gone:0', 12_000);
    const owing = { ...dead, loans: [loanOn(business.id, 20_000), personal, orphan] };
    const next = continueAsChild(owing, heirId)!;
    expect(next.loans).toHaveLength(1);
    expect(next.loans[0]!.businessId).toBe(business.id);
    expect(Number(next.loans[0]!.balance)).toBe(dollars(20_000));
    // Sold, the same loan comes out of the sale and nothing is handed on.
    expect(continueAsChild(owing, heirId, { keepBusinesses: false })!.loans).toEqual([]);
  });

  it('goes on trading under the heir, and the business goes on paying the bank', () => {
    const { dead, heirId } = deadOwner();
    const business = dead.businesses[0]!;
    const next = continueAsChild({ ...dead, loans: [loanOn(business.id, 20_000)] }, heirId)!;
    const later = answerEverything(advanceYear(next).state);
    const run = later.businesses.find((row) => row.id === business.id);
    expect(run).toBeDefined();
    expect(run!.last?.year).toBe(next.world.year + 1);
    expect(run!.last!.repaid ?? 0).toBeGreaterThan(0);
    const loan = later.loans.find((row) => row.businessId === business.id);
    expect(Number(loan?.balance ?? 0)).toBeLessThan(dollars(20_000));
  });

  it('does not make a child’s inheritance of a dead business worse than before', () => {
    const { dead, heirId } = deadOwner();
    const idle = { ...dead, businesses: [], loans: [] };
    const next = continueAsChild(idle, heirId)!;
    expect(next.businesses).toEqual([]);
    expect(next.loans).toEqual([]);
  });
});
