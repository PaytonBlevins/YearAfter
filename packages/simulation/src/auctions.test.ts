/**
 * Ticket 0507 acceptance tests — auctions.
 *
 * Spec 41 / 1899: two general houses, each up to twice a year, credibility
 * that varies and is shown in words; a storage yard visited more often;
 * private sales behind a wealth gate. Spec 1390: bargains are possible,
 * repeated buy-and-resell profit is not guaranteed.
 */

import { describe, expect, it } from 'vitest';
import { AUCTION_VENUES, findAuctionVenue } from '@yearafter/content';
import { REPRODUCTION_SHARE, reconcile, resaleAtPurchase } from '@yearafter/finance';
import { advanceYear } from './advance';
import {
  attendAuction,
  bidOn,
  contentsOf,
  credibilityOf,
  currentLots,
  lotsFor,
  openVenues,
  visitsLeft,
  type Lot,
} from './auctions';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

function answer(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0]!;
    const result = decide(next, decision.eventId, decision.choices[0]!.id);
    if (!result.ok) break;
    next = result.value.state;
  }
  return next;
}

function withCash(state: GameState, amount: number): GameState {
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

let adult = createNewGame({ seed: 'auction-adult' });
for (let year = 0; year < 35; year += 1) adult = answer(advanceYear(adult).state);
const rich = withCash(adult, 5_000_000);
const modest = { ...adult };

const attended = (state: GameState, venueId: string): GameState => {
  const result = attendAuction(state, venueId);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe('0507 — the venues', () => {
  it('has two general houses, a storage yard and a private room, with spec 41’s limits', () => {
    const general = AUCTION_VENUES.filter((venue) => venue.type === 'general');
    expect(general).toHaveLength(2);
    for (const venue of general) expect(venue.visits).toBe(2);
    expect(AUCTION_VENUES.find((venue) => venue.type === 'storage')!.visits).toBeGreaterThan(2);
    expect(AUCTION_VENUES.find((venue) => venue.type === 'private')!.means).toBeGreaterThan(0);
  });

  it('keeps the private room behind a gate it never names, and everything from a child', () => {
    if (modest.player.cash < 100_000_000) {
      expect(openVenues(modest).map((venue) => venue.id)).not.toContain('auction.private');
    }
    expect(openVenues(rich).map((venue) => venue.id)).toContain('auction.private');
    expect(openVenues({ ...rich, player: { ...rich.player, age: 15 } })).toEqual([]);
  });

  it('gives each general house its own standing, which changes year to year', () => {
    const hartwell = findAuctionVenue('auction.hartwell')!;
    const crane = findAuctionVenue('auction.crane')!;
    const years = Array.from({ length: 40 }, (_, i) => 2030 + i);
    expect(new Set(years.map((year) => credibilityOf(hartwell, year))).size).toBeGreaterThan(2);
    expect(years.some((year) => credibilityOf(hartwell, year) !== credibilityOf(crane, year))).toBe(
      true,
    );
  });
});

describe('0507 — going to a sale', () => {
  it('counts visits against the yearly limit, and starts again next year', () => {
    let state = rich;
    expect(visitsLeft(state, 'auction.hartwell')).toBe(2);
    expect(currentLots(state, 'auction.hartwell')).toEqual([]);
    state = attended(state, 'auction.hartwell');
    const first = currentLots(state, 'auction.hartwell');
    expect(first.length).toBeGreaterThan(0);
    state = attended(state, 'auction.hartwell');
    const second = currentLots(state, 'auction.hartwell');
    expect(second.map((lot) => lot.name)).not.toEqual(first.map((lot) => lot.name));
    expect(attendAuction(state, 'auction.hartwell').ok).toBe(false);
    const nextYear = { ...state, world: { ...state.world, year: state.world.year + 1 } };
    expect(visitsLeft(nextYear, 'auction.hartwell')).toBe(2);
    // The storage yard takes more visits than a saleroom.
    let yard = rich;
    for (let visit = 0; visit < 6; visit += 1) yard = attended(yard, 'auction.storage');
    expect(attendAuction(yard, 'auction.storage').ok).toBe(false);
  });

  it('shows the same lots however often a visit is looked at', () => {
    expect(lotsFor(rich, 'auction.crane', 1)).toEqual(lotsFor(rich, 'auction.crane', 1));
  });

  it('lets a lot be bid on once, and never past what they could pay', () => {
    const state = attended(rich, 'auction.hartwell');
    const lot = currentLots(state, 'auction.hartwell')[0]!;
    const result = bidOn(state, lot.id, 'fair');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(bidOn(result.value.state, lot.id, 'determined')).toEqual({
      ok: false,
      error: 'already-bid',
    });
    expect(reconcile(result.value.state.finance).ok).toBe(true);
    const broke = { ...state, player: { ...state.player, cash: 0 as never } };
    expect(bidOn(broke, lot.id, 'careful')).toEqual({ ok: false, error: 'cannot-cover' });
  });
});

/* -------------------------------------------------------------------------- */
/* The economics, over many sales                                              */
/* -------------------------------------------------------------------------- */

interface Tally {
  lots: number;
  wins: number;
  ret: number;
}

function received(state: GameState, lot: Lot): number {
  if (lot.kind === 'unit') {
    const contents = contentsOf(state.rng.getSeed(), lot);
    return (
      contents.junkValue +
      (contents.treasure ? resaleAtPurchase(contents.treasure, contents.treasure.price) : 0)
    );
  }
  if (lot.kind === 'valuable' && lot.fake) return lot.value * REPRODUCTION_SHARE;
  return lot.value;
}

const tallies = new Map<string, Tally>();
for (let year = 0; year < 200; year += 1) {
  const base = { ...rich, world: { ...rich.world, year: rich.world.year + year } };
  for (const venue of AUCTION_VENUES) {
    let state: GameState = base;
    for (let visit = 0; visit < venue.visits; visit += 1) {
      const result = attendAuction(state, venue.id);
      if (!result.ok) break;
      state = result.value;
      for (const lot of currentLots(state, venue.id)) {
        for (const tier of ['careful', 'fair', 'determined'] as const) {
          const bid = bidOn(state, lot.id, tier);
          if (!bid.ok) continue;
          const house =
            venue.type === 'general'
              ? `general:${credibilityOf(venue, state.world.year)}`
              : venue.type;
          const key = `${house}:${tier}`;
          const tally = tallies.get(key) ?? { lots: 0, wins: 0, ret: 0 };
          tally.lots += 1;
          if (bid.value.won) {
            tally.wins += 1;
            tally.ret += received(state, lot) / bid.value.paid - 1;
          }
          tallies.set(key, tally);
        }
      }
    }
  }
}
const perLot = (key: string) => {
  const tally = tallies.get(key)!;
  return tally.ret / tally.lots;
};

describe('0507 — bargains possible, a living not (spec 1390)', () => {
  it('lets a careful bid at a good house find the odd bargain, worth almost nothing a lot', () => {
    expect(tallies.get('general:well:careful')!.wins).toBeGreaterThan(0);
    expect(perLot('general:well:careful')).toBeGreaterThan(-0.03);
    expect(perLot('general:well:careful')).toBeLessThan(0.02);
    expect(perLot('private:careful')).toBeLessThan(0.02);
    expect(perLot('storage:careful')).toBeLessThan(0.04);
  });

  it('loses money on average for anybody who bids to the estimate or past it', () => {
    for (const house of [
      'general:well',
      'general:decent',
      'general:mixed',
      'general:questionable',
      'private',
      'storage',
    ]) {
      expect(perLot(`${house}:fair`), house).toBeLessThan(0);
      expect(perLot(`${house}:determined`), house).toBeLessThan(perLot(`${house}:fair`));
    }
    // And a house people talk about costs you at every tier.
    expect(perLot('general:questionable:careful')).toBeLessThan(-0.03);
  });
});

describe('0507 — what is won', () => {
  const findWin = (venueId: string, test: (lot: Lot) => boolean) => {
    for (let year = 0; year < 300; year += 1) {
      const base = { ...rich, world: { ...rich.world, year: rich.world.year + year } };
      let state: GameState = base;
      for (let visit = 0; visit < (findAuctionVenue(venueId)?.visits ?? 0); visit += 1) {
        const result = attendAuction(state, venueId);
        if (!result.ok) break;
        state = result.value;
        for (const lot of currentLots(state, venueId)) {
          if (!test(lot)) continue;
          const bid = bidOn(state, lot.id, 'determined');
          if (bid.ok && bid.value.won) return { lot, after: bid.value.state, outcome: bid.value };
        }
      }
    }
    throw new Error('nothing won');
  };

  it('puts a piece in the collection, and finds a fake out the next year', () => {
    const { lot, after } = findWin(
      'auction.crane',
      (candidate) => candidate.kind === 'valuable' && candidate.fake,
    );
    const owned = after.valuables.find((piece) => piece.id === lot.id)!;
    expect(owned.fake).toBe(true);
    expect(reconcile(after.finance).ok).toBe(true);
    const next = advanceYear(after).state;
    const found = next.valuables.find((piece) => piece.id === lot.id)!;
    expect(found.reproduction).toBe(true);
    expect(found.fake).toBeUndefined();
    expect(Number(found.value)).toBeLessThan(Number(owned.value) * 0.1);
    expect(next.player.timeline.some((entry) => entry.text.includes("It's a reproduction"))).toBe(
      true,
    );
  });

  it('puts a car in the garage', () => {
    const { lot, after } = findWin('auction.hartwell', (candidate) => candidate.kind === 'car');
    expect(after.vehicles.some((vehicle) => vehicle.id === lot.id)).toBe(true);
  });

  it('empties a storage unit: the junk sold off, anything good kept', () => {
    const { lot, after, outcome } = findWin('auction.storage', () => true);
    const rows = after.finance.transactions.slice(-2);
    expect(rows[0]!.amount).toBeLessThan(0);
    expect(rows[1]!.amount).toBeGreaterThan(0);
    expect(outcome.text).toMatch(/^Won a storage unit/);
    expect(reconcile(after.finance).ok).toBe(true);
    expect(lot.kind).toBe('unit');
  });
});
