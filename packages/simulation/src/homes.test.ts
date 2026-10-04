/**
 * Ticket 0501 acceptance tests — a place of your own.
 *
 * Measured on 150 played lives before this ticket (`claude/v005-ownership-
 * measurement.md`): nobody owned anything, and the median character's cash and
 * investments never passed $21,000 at any age — $21k at 25, $14k at 30, $9k at
 * 45, $20k at 55, $21k at 65 — while a roof they could never keep cost them
 * $18,000–$29,000 every year of their adult life.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  FORECLOSE_AFTER,
  MARKET_MEAN,
  saleOf,
  homesValue,
  mortgagesOwed,
  portfolioWorth,
  reconcile,
  totalBorrowed,
  totalOwed,
} from '@yearafter/finance';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { buyHome, foreclose, homeListings, marketMoveIn, sellHome } from './homes';
import { estateOf } from './investments';
import { createNewGame } from './new-game';

const LIVES = 150;

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

interface YearRow {
  readonly age: number;
  readonly owns: boolean;
  readonly netWorth: number;
  readonly short: boolean;
}

interface Life {
  readonly rows: readonly YearRow[];
  readonly bought: number;
  readonly letGo: number;
}

const SAMPLES: GameState[] = [];

function live(seed: string): Life {
  let state: GameState = createNewGame({ seed });
  const rows: YearRow[] = [];
  let bought = 0;
  let letGo = 0;
  let guard = 0;
  while (state.player.alive && (guard += 1) < 110) {
    state = answerEverything(advanceYear(state).state);
    const age = state.player.age;
    if (age === 30 || age === 45) SAMPLES.push(state);
    for (const entry of state.player.timeline) {
      if (entry.age !== age) continue;
      if (entry.id.includes(':home:bought:')) bought += 1;
      if (entry.id.includes(':home:let-go:') || entry.id.includes(':home:taken:')) letGo += 1;
    }
    const netWorth =
      (Number(state.player.cash) +
        Number(portfolioWorth(state.prices, state.portfolio)) +
        Number(homesValue(state.homes)) -
        Number(totalOwed(state.cards)) -
        Number(totalBorrowed(state.loans)) -
        Number(mortgagesOwed(state.homes))) /
      100;
    rows.push({
      age,
      owns: state.homes.length > 0,
      netWorth,
      short: state.finance.transactions.some(
        (entry) => entry.year === state.world.year && entry.category === 'shortfall',
      ),
    });
  }
  return { rows, bought, letGo };
}

const LIFETIMES = Array.from({ length: LIVES }, (_, i) => live(`homes-${i}`));
const ALL = LIFETIMES.flatMap((life) => [...life.rows]);
const between = (from: number, to: number) => ALL.filter((row) => row.age >= from && row.age <= to);
const share = (rows: readonly YearRow[], of: (row: YearRow) => boolean) =>
  rows.length === 0 ? 0 : rows.filter(of).length / rows.length;
const median = (xs: readonly number[]) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

describe('0501 — a place of your own', () => {
  it('lets a character who only answers questions come to own a home', () => {
    /*
      From an exact zero. The shape is what is asserted, not the level: US
      household ownership runs about 37% under thirty-five and near 80% past
      sixty-five, and this build lands well under that because a partner here
      costs half a person and earns nothing (roadmap finding 9) — so the bands
      are wide, and the rise with age is the claim.
    */
    const young = share(between(25, 34), (row) => row.owns);
    const middle = share(between(45, 54), (row) => row.owns);
    const old = share(between(65, 80), (row) => row.owns);
    console.log(
      `own a home: ${(young * 100).toFixed(0)}% at 25-34, ${(middle * 100).toFixed(0)}% at 45-54, ${(old * 100).toFixed(0)}% at 65-80`,
    );
    expect(young, 'nobody under thirty-five owns anywhere').toBeGreaterThan(0.04);
    expect(middle).toBeGreaterThan(young);
    expect(middle, 'hardly anybody in middle age owns anywhere').toBeGreaterThan(0.25);
    expect(old, 'almost everybody old owns somewhere').toBeLessThan(0.9);
  });

  it('lets a life end with more than it started with', () => {
    /*
      THE CLAIM THE TICKET IS FOR. Before it, median net worth was flat across
      forty years of working life — $18,000 at 25–34 and $20,000 at 55–64 —
      because the only thing a household could spend on its roof was rent.
    */
    const young = median(between(25, 34).map((row) => row.netWorth));
    const late = median(between(55, 64).map((row) => row.netWorth));
    const paired = LIFETIMES.flatMap((life) => {
      const at30 = life.rows.find((row) => row.age === 30);
      const at60 = life.rows.find((row) => row.age === 60);
      return at30 && at60 ? [at60.netWorth - at30.netWorth] : [];
    });
    const gained = median(paired);
    console.log(
      `median net worth: $${Math.round(young)} at 25-34, $${Math.round(late)} at 55-64; median change 30 to 60: $${Math.round(gained)}`,
    );
    /*
      Both lines set against measured noise (CORE_RULES 13.81). Two disjoint
      sets of 150 lives: with the door, the median ratio read 2.1 and 2.9 and
      each life's own change from thirty to sixty read $27,000 and $30,000;
      with the door switched off, 1.2 and 1.2, and $1,700 and $3,400.
      Since 0502 gave partners an income the same measurement reads a ratio
      of about 5.6 and a change of about $237,000; the lines still guard the
      0501 floor, which is what they were for.
    */
    expect(late, 'a working life still ends where it began').toBeGreaterThan(young * 1.6);
    expect(gained, 'the median life gains nothing between thirty and sixty').toBeGreaterThan(
      12_000,
    );
  });

  it('does not make a fortune out of a roof', () => {
    /*
      Ticket 0502. 0501 left an owner spending 45% of what the same life cost a
      renter, on the reading that the rest had been the rent. Shelter is nearer
      a quarter to a third of what a US household spends, so every owner was
      handed the difference to save, and once 0502 stopped couples
      overspending it showed: median net worth at 65–74 of $722,000 and
      $659,000 against a US figure of about $410,000. Measured since, on three
      sets of 150 lives: $415,000, $379,000 and $342,000 (CORE_RULES 13.81).
    */
    const old = median(between(65, 74).map((row) => row.netWorth));
    console.log(`median net worth at 65-74: $${Math.round(old)}`);
    expect(old, 'owning a home is a fortune').toBeLessThan(550_000);
  });

  it('does not walk owners into years they cannot pay for', () => {
    /*
      The first version walked 104 of 176 buyers into foreclosure — a
      mortgage charged on top of a standard of living that spent like a
      renter's, so retirement turned every owner short. Owners now spend less
      on the rest of their life when the house costs more than the rent did,
      and a household that falls behind sells rather than being taken from.
    */
    const owners = ALL.filter((row) => row.owns && row.age >= 18);
    const renters = ALL.filter((row) => !row.owns && row.age >= 18);
    const bought = LIFETIMES.reduce((sum, life) => sum + life.bought, 0);
    const letGo = LIFETIMES.reduce((sum, life) => sum + life.letGo, 0);
    console.log(
      `short years: owners ${(share(owners, (r) => r.short) * 100).toFixed(1)}%, renters ${(share(renters, (r) => r.short) * 100).toFixed(1)}%; ${letGo} of ${bought} homes let go`,
    );
    expect(bought).toBeGreaterThan(50);
    expect(
      share(owners, (row) => row.short),
      'owning makes the year unpayable',
    ).toBeLessThan(0.04);
    expect(letGo / bought, 'most houses are lost rather than kept').toBeLessThan(0.2);
  });
});

describe('0501 — the market and the verbs', () => {
  const adult = SAMPLES.find(
    // Renting, not between one house and the next: a household that sold this
    // year still lives as an owner until the year turns.
    (state) =>
      state.homes.length === 0 &&
      state.household.housing === 'ownPlace' &&
      Number(state.player.cash) > 0,
  )!;

  it('shows the same eight homes all year, cheapest first, in the character’s state', () => {
    const listings = homeListings(adult);
    expect(listings).toHaveLength(8);
    expect(homeListings(adult)).toEqual(listings);
    for (let i = 1; i < listings.length; i += 1) {
      expect(listings[i]!.askingPrice).toBeGreaterThanOrEqual(listings[i - 1]!.askingPrice);
    }
    expect(new Set(listings.map((listing) => listing.regionKey)).size).toBe(1);
    // A new year is a new market.
    const nextYear = { ...adult, world: { ...adult.world, year: adult.world.year + 1 } };
    expect(homeListings(nextYear).map((l) => l.askingPrice)).not.toEqual(
      listings.map((l) => l.askingPrice),
    );
  });

  it('never shows a mansion to somebody with nothing, and says nothing about why', () => {
    const broke: GameState = { ...adult, player: { ...adult.player, cash: 0 as never } };
    const shown = new Set(homeListings(broke).map((listing) => listing.kindId));
    expect(shown.has('home.luxury')).toBe(false);
    expect(shown.has('home.estate')).toBe(false);
  });

  it('buys outright as a transfer, counts it in net worth, and sells it back for its equity', () => {
    const cheapest = homeListings(adult)[0]!;
    const rich: GameState = {
      ...adult,
      finance: { ...adult.finance },
    };
    // Enough to buy it outright, posted honestly so the books still reconcile.
    const funded = (() => {
      const topUp = cheapest.askingPrice * 2;
      const books = {
        ...rich.finance,
        balance: (Number(rich.finance.balance) + topUp * 100) as never,
        transactions: [
          ...rich.finance.transactions,
          {
            id: `f:${rich.world.year}:gift:test`,
            year: rich.world.year,
            age: rich.player.age,
            category: 'gift' as const,
            amount: (topUp * 100) as never,
            source: 'A test windfall',
          },
        ],
      };
      return { ...rich, finance: books, player: { ...rich.player, cash: books.balance } };
    })();
    expect(reconcile(funded.finance).ok).toBe(true);
    // Ticket 0504: a character this rich usually owns a car by now, and a car
    // is an asset too — so the house is measured as what it ADDED.
    const assetsBefore = Number(estateOf(funded).assets ?? 0);
    const before = Number(estateOf(funded).investments) + Number(funded.player.cash) + assetsBefore;

    const bought = buyHome(funded, cheapest.id, 'cash');
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const after = bought.value.state;
    expect(reconcile(after.finance).ok).toBe(true);
    expect(after.homes).toHaveLength(1);
    expect(after.household.housing).not.toBe('owned'); // living catches up at the next year
    expect(Number(estateOf(after).assets) - assetsBefore).toBe(cheapest.askingPrice * 100);
    // Net worth did not fall: cash became a house.
    expect(
      Number(estateOf(after).investments) + Number(after.player.cash) + Number(estateOf(after).assets ?? 0),
    ).toBe(before);
    expect(buyHome(after, cheapest.id, 'cash').ok).toBe(false);

    const sold = sellHome(after, after.homes[0]!.id);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.value.state.homes).toHaveLength(0);
    expect(reconcile(sold.value.state.finance).ok).toBe(true);
    expect(sold.value.proceeds).toBe(Math.round(cheapest.askingPrice * 0.94));
  });

  it('moves the market in constant dollars, and one year says nothing about the next', () => {
    /*
      Two faults the first version had, each caught only by the population.
      A nominal 4% drift in an economy with no inflation made a $200,000 house
      worth $978,000 by sixty-five; a hash that walked in step with the year
      raised the market 6-7% for twenty years running (CORE_RULES 13.81: set
      against 200 years, where an independent series reads |r| under 0.15).
    */
    const moves = Array.from({ length: 200 }, (_, i) => marketMoveIn(2000 + i));
    const mean = moves.reduce((sum, move) => sum + move, 0) / moves.length;
    expect(mean, 'the market drifts at a nominal rate in a constant-dollar world').toBeLessThan(
      0.025,
    );
    expect(mean).toBeGreaterThan(0);
    expect(MARKET_MEAN).toBeLessThan(0.02);
    const a = moves.slice(0, -1);
    const b = moves.slice(1);
    const avg = (v: readonly number[]) => v.reduce((sum, x) => sum + x, 0) / v.length;
    const [ma, mb] = [avg(a), avg(b)];
    const cov = a.reduce((sum, x, i) => sum + (x - ma) * (b[i]! - mb), 0);
    const r =
      cov /
      Math.sqrt(
        a.reduce((s2, x) => s2 + (x - ma) ** 2, 0) * b.reduce((s2, x) => s2 + (x - mb) ** 2, 0),
      );
    expect(Math.abs(r), 'this year’s market predicts next year’s').toBeLessThan(0.2);
  });

  it('sells a house that is behind rather than letting the bank take it, unless it is underwater', () => {
    const owner = SAMPLES.find((state) => state.homes.length > 0);
    expect(owner).toBeDefined();
    const home = owner!.homes[0]!;
    const behind = { ...home, behindYears: FORECLOSE_AFTER };
    const pressed = foreclose({ ...owner!, homes: [behind] });
    expect(pressed.homes).toHaveLength(0);
    const last = pressed.player.timeline[pressed.player.timeline.length - 1]!;
    if (saleOf(behind).proceeds > 0) {
      expect(last.id, 'a house with equity was taken').toContain(':home:let-go:');
      expect(Number(pressed.player.cash) - Number(owner!.player.cash)).toBe(
        saleOf(behind).proceeds * 100,
      );
    }
    // One owing more than it is worth is the case the bank does take.
    const drowned = {
      ...behind,
      mortgage: {
        productId: 'mortgage.conventional',
        principal: dollars(9_000_000),
        balance: dollars(9_000_000),
        termLeft: 20,
      },
    };
    const taken = foreclose({ ...owner!, homes: [drowned] });
    expect(taken.player.timeline[taken.player.timeline.length - 1]!.id).toContain(':home:taken:');
    // And a house only one year behind is left alone.
    expect(
      foreclose({ ...owner!, homes: [{ ...home, behindYears: FORECLOSE_AFTER - 1 }] }).homes,
    ).toHaveLength(1);
  });

  it('lives in the home it owns, and pays for it as housing', () => {
    const owner = SAMPLES.find((state) => state.homes.length > 0);
    expect(owner, 'no sampled life owned a home').toBeDefined();
    const year = answerEverything(advanceYear(owner!).state);
    if (year.homes.length === 0) return; // sold under pressure this year
    expect(year.household.housing).toBe('owned');
    expect(
      year.finance.transactions.some(
        (entry) => entry.year === year.world.year && entry.category === 'housing',
      ),
    ).toBe(true);
  });
});
