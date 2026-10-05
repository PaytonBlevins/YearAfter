/**
 * Ticket 0606 acceptance tests — commercial property.
 *
 * Before this ticket the biggest thing a character could let was a 25-unit
 * apartment block, and a lender treated every building as a house. Measured
 * (`claude/0606-commercial-real-estate.md`): through `runHomesYear`, an agent-run
 * building lets for 92% (corner shop), 90% (strip), 89% (warehouse) and 84%
 * (office) of its full rent, a recession takes 4–6 points off that and a severe
 * one 8–10, and the net yield on value lands at 6.8, 6.4, 5.7 and 7.4%.
 */

import { describe, expect, it } from 'vitest';
import { dollars, mixedUnit } from '@yearafter/core';
import { COMMERCIAL_TRADES, HOME_KINDS, findBusinessType, findHomeKind } from '@yearafter/content';
import {
  emptyLetting,
  nextMarketState,
  type MarketState,
  type OwnedHome,
  type Tenant,
} from '@yearafter/finance';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import {
  buyHome,
  commercialListings,
  homeListings,
  mortgageOfferFor,
  purposeOf,
  rentalListings,
  runHomesYear,
} from './homes';
import { createNewGame } from './new-game';
import {
  applicantsAt,
  applicantsFor,
  askingRentOf,
  fillEmptyUnits,
  isCommercialKind,
} from './rentals';

const COMMERCIAL = HOME_KINDS.filter((kind) => kind.commercial);

function building(kindId: string, id = 'home:2030:c0', tenants?: (Tenant | null)[]): OwnedHome {
  const kind = findHomeKind(kindId)!;
  const price = (kind.price[0] + kind.price[1]) / 2;
  const letting = emptyLetting(kind.units);
  return {
    id,
    kindId,
    beds: 0,
    baths: 0,
    builtYear: 1990,
    condition: 'good',
    regionKey: 'OH',
    regionName: 'Ohio',
    purchasePrice: dollars(price),
    boughtYear: 2030,
    value: dollars(price),
    expenseRate: kind.expenseRate,
    behindYears: 0,
    letting: { ...letting, managed: true, ...(tenants ? { tenants } : {}) },
  };
}

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

function funded(seed: string, windfall: number): GameState {
  let state = createNewGame({ seed });
  while (state.player.alive && state.player.age < 25)
    state = answerEverything(advanceYear(state).state);
  const balance = Number(state.finance.balance) + windfall * 100;
  return {
    ...state,
    finance: {
      ...state.finance,
      balance: balance as never,
      transactions: [
        ...state.finance.transactions,
        {
          id: `f:${state.world.year}:gift:test`,
          year: state.world.year,
          age: state.player.age,
          category: 'gift' as const,
          amount: (windfall * 100) as never,
          source: 'A test windfall',
        },
      ],
    },
    player: { ...state.player, cash: balance as never },
  };
}

/* -------------------------------------------------------------------------- */
/* The catalog                                                                 */
/* -------------------------------------------------------------------------- */

describe('0606 — the catalog', () => {
  it('has four commercial kinds, each let to businesses of real trades', () => {
    expect(COMMERCIAL.map((kind) => kind.id).sort()).toEqual(
      ['home.corner-shop', 'home.office', 'home.retail-strip', 'home.warehouse'].sort(),
    );
    for (const kind of COMMERCIAL) {
      expect(kind.rental).toBe(true);
      expect(kind.units).toBeGreaterThanOrEqual(2);
      expect(kind.vacancy).toBeGreaterThan(0.02);
      expect(kind.vacancy).toBeLessThan(0.35);
      expect(kind.leaseYears[0]).toBeLessThanOrEqual(kind.leaseYears[1]);
      const trades = COMMERCIAL_TRADES[kind.id] ?? [];
      expect(trades.length).toBeGreaterThanOrEqual(5);
      for (const trade of trades) expect(findBusinessType(trade)).toBeDefined();
    }
  });

  it('leaves every residential kind with no vacancy and a one-year lease', () => {
    const residential = HOME_KINDS.filter((kind) => !kind.commercial);
    expect(residential.length).toBeGreaterThan(8);
    for (const kind of residential) {
      expect(kind.vacancy).toBe(0);
      expect(kind.leaseYears).toEqual([1, 1]);
      expect(COMMERCIAL_TRADES[kind.id]).toBeUndefined();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Listings and the lender                                                     */
/* -------------------------------------------------------------------------- */

describe('0606 — buying', () => {
  const RICH = funded('commercial-rich', 4_000_000);

  it('lists commercial buildings apart from homes and rentals, behind the same gate', () => {
    const listings = commercialListings(RICH);
    expect(listings.length).toBe(2);
    for (const listing of listings) {
      expect(listing.commercial).toBe(true);
      expect(listing.rental).toBe(true);
    }
    expect([...homeListings(RICH), ...rentalListings(RICH)].some((l) => l.commercial)).toBe(false);
    const poor = funded('commercial-poor', 0);
    const poorKinds = new Set(commercialListings(poor).map((l) => l.kindId));
    for (const id of poorKinds) {
      expect(findHomeKind(id)!.means).toBeLessThanOrEqual(
        Number(poor.player.cash) / 100 + 100_000_000,
      );
    }
    // A character with nothing is shown nothing, rather than a warehouse they could never buy.
    expect(
      commercialListings({ ...poor, player: { ...poor.player, cash: dollars(0) } }).length,
    ).toBeLessThanOrEqual(commercialListings(poor).length);
  });

  it('asks a commercial lender, and only a commercial lender', () => {
    const listing = commercialListings(RICH)[0]!;
    expect(purposeOf(RICH, listing)).toBe('commercial');
    const offer = mortgageOfferFor(RICH, listing);
    expect(offer.approved).toBe(true);
    expect(offer.product?.id).toBe('mortgage.commercial');
    expect(offer.down / listing.askingPrice).toBeGreaterThanOrEqual(0.3 - 1e-9);
    const house = rentalListings(RICH)[0];
    if (house) {
      expect(purposeOf(RICH, house)).toBe('rental');
      expect(mortgageOfferFor(RICH, house).product?.id).not.toBe('mortgage.commercial');
    }
  });

  it('buys one empty, at the going rate, and never as a place to live', () => {
    const listing = commercialListings(RICH)[0]!;
    const bought = buyHome(RICH, listing.id, 'mortgage');
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const home = bought.value.home;
    expect(isCommercialKind(home)).toBe(true);
    expect(home.mortgage?.productId).toBe('mortgage.commercial');
    expect(home.letting?.tenants).toHaveLength(listing.units);
    expect(home.letting?.tenants.every((tenant) => tenant === null)).toBe(true);
    expect(bought.value.state.homes.length).toBe(RICH.homes.length + 1);
  });
});

/* -------------------------------------------------------------------------- */
/* Tenants                                                                     */
/* -------------------------------------------------------------------------- */

describe('0606 — tenants are businesses', () => {
  const home = building('home.retail-strip');

  it('are of the building’s own trades, on a multi-year lease at today’s rent', () => {
    const rent = askingRentOf(home);
    let seen = 0;
    for (let year = 2031; year < 2060; year += 1) {
      for (const tenant of applicantsAt('seed', home, 0, year, 'normal')) {
        seen += 1;
        expect(COMMERCIAL_TRADES['home.retail-strip']).toContain(tenant.trade);
        expect(tenant.rent).toBe(rent);
        expect(tenant.since).toBe(year + 1);
        const length = (tenant.leaseEnds ?? 0) - year;
        expect(length).toBeGreaterThanOrEqual(5);
        expect(length).toBeLessThanOrEqual(7);
        expect(tenant.income).toBeGreaterThanOrEqual(rent * 5.9);
        expect(tenant.name.length).toBeGreaterThan(3);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });

  it('are the same all year, and different next year', () => {
    const a = applicantsAt('seed', home, 1, 2031, 'normal');
    expect(applicantsAt('seed', home, 1, 2031, 'normal')).toEqual(a);
    expect(applicantsAt('seed', home, 1, 2032, 'normal').map((t) => t.id)).not.toEqual(
      a.map((t) => t.id),
    );
  });

  it('answer in numbers that follow the economy', () => {
    const counts = (market: MarketState) => applicantsAt('seed', home, 0, 2031, market).length;
    expect(counts('severeRecession')).toBeLessThan(counts('normal'));
    expect(counts('normal')).toBeLessThan(counts('strongExpansion'));
    expect(counts('severeRecession')).toBeGreaterThanOrEqual(1);
  });

  it('are of several trades, not one', () => {
    const trades = new Set<string | undefined>();
    for (let year = 2031; year < 2060; year += 1) {
      for (const tenant of applicantsAt('seed', home, 0, year, 'normal')) trades.add(tenant.trade);
    }
    expect(trades.size).toBeGreaterThanOrEqual(5);
  });

  it('are the screen’s and the mass search’s to see in the same economy', () => {
    const office = building('home.office', 'home:2030:c9');
    const state: GameState = {
      ...createNewGame({ seed: 'screens' }),
      homes: [office],
      market: 'severeRecession',
    };
    const seen = applicantsFor(state, office.id, 0);
    expect(seen).toHaveLength(1);
    expect(seen).toEqual(
      applicantsAt(state.rng.getSeed(), office, 0, state.world.year, 'severeRecession'),
    );
    // The search picks from that one, in every unit — three applicants in a boom would not.
    const filled = fillEmptyUnits(state, office.id);
    if (!filled.ok) throw new Error('could not fill');
    const tenants = filled.value.state.homes[0]!.letting!.tenants;
    expect(tenants).toHaveLength(8);
    for (const tenant of tenants) expect(tenant!.id.endsWith(':0')).toBe(true);
  });

  it('a house still gets households, not businesses', () => {
    const duplex: OwnedHome = { ...building('home.duplex'), expenseRate: 0.024 };
    const people = applicantsAt('seed', duplex, 0, 2031);
    expect(people.length).toBe(3);
    for (const person of people) {
      expect(person.trade).toBeUndefined();
      expect(person.leaseEnds).toBeUndefined();
      expect(person.rent).toBeUndefined();
    }
  });

  it('are signed to every empty unit by the mass search, on the same terms', () => {
    const listing = commercialListings(funded('fill', 4_000_000))[0]!;
    const state = funded('fill', 4_000_000);
    const bought = buyHome(state, listing.id, 'cash');
    if (!bought.ok) throw new Error('could not buy');
    const filled = fillEmptyUnits(bought.value.state, listing.id);
    expect(filled.ok).toBe(true);
    if (!filled.ok) return;
    const tenants = filled.value.state.homes.find((h) => h.id === listing.id)!.letting!.tenants;
    expect(tenants.every((t) => t !== null)).toBe(true);
    for (const tenant of tenants) {
      expect(tenant!.trade).toBeDefined();
      expect(tenant!.leaseEnds).toBeGreaterThan(tenant!.since - 1);
    }
    expect(applicantsFor(filled.value.state, listing.id, 0)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The lease                                                                   */
/* -------------------------------------------------------------------------- */

const TENANT: Tenant = {
  id: 't',
  name: 'Studio Lorne',
  since: 2029,
  income: 600_000,
  credit: 'good',
  work: 'steady',
  household: 4,
  evictions: 0,
  trade: 'biz.salon',
  rent: 0,
  leaseEnds: 2036,
};

describe('0606 — a lease holds the rent', () => {
  const kindId = 'home.corner-shop';
  const plain = building(kindId, 'home:2030:c1');
  // Signed a fifth under today's going rate, so a doubled building asks for more than the lease pays.
  const RENT = Math.round((askingRentOf(plain) * 0.8) / 12) * 12;
  const base = building(kindId, 'home:2030:c1', [{ ...TENANT, rent: RENT }, null]);
  const rentOf = (r: ReturnType<typeof runHomesYear>) =>
    Number(r.transactions.find((t) => t.source.startsWith('Rent from'))?.amount ?? 0) / 100;

  it('pays the rent it was signed at, whatever the market has done to the building', () => {
    const dearer: OwnedHome = { ...base, value: dollars((Number(base.value) / 100) * 2) };
    expect(askingRentOf(dearer)).toBeGreaterThan(RENT);
    // Find a year the tenant neither fails nor reaches the end of the lease: 2031..2035.
    for (let year = 2031; year <= 2035; year += 1) {
      const result = runHomesYear(
        [{ ...dearer, letting: { ...dearer.letting!, managed: false } }],
        year,
        'lease',
        'normal',
      );
      const tenant = result.homes[0]!.letting!.tenants[0];
      if (tenant) expect(rentOf(result)).toBe(RENT);
    }
  });

  it('resets the rent to today’s at renewal', () => {
    const dearer: OwnedHome = {
      ...base,
      value: dollars((Number(base.value) / 100) * 2),
      letting: {
        ...base.letting!,
        managed: false,
        tenants: [{ ...TENANT, rent: RENT, leaseEnds: 2031 }, null],
      },
    };
    let renewed = 0;
    for (let i = 0; i < 80; i += 1) {
      const result = runHomesYear([dearer], 2031, `renew${i}`, 'normal');
      const tenant = result.homes[0]!.letting!.tenants[0];
      if (tenant) {
        renewed += 1;
        // At the rate the building would let for as the year closes, which is above the old lease.
        expect(tenant.rent).toBe(askingRentOf(result.homes[0]!));
        expect(tenant.rent).toBeGreaterThan(RENT);
        expect(tenant.leaseEnds).toBeGreaterThanOrEqual(2031 + 3);
        expect(tenant.leaseEnds).toBeLessThanOrEqual(2031 + 5);
        expect(tenant.since).toBe(TENANT.since);
      }
    }
    // Most renew at the going rate; some leave; neither is all of them.
    expect(renewed).toBeGreaterThan(20);
    expect(renewed).toBeLessThan(80);
  });

  it('does not let a tenant walk before the lease is up, except by failing', () => {
    const quiet: OwnedHome = {
      ...base,
      letting: {
        ...base.letting!,
        managed: false,
        tenants: [{ ...TENANT, rent: RENT, leaseEnds: 2040 }, null],
      },
    };
    let stayed = 0;
    let gone = 0;
    for (let i = 0; i < 300; i += 1) {
      const t = runHomesYear([quiet], 2031, `stay${i}`, 'normal').homes[0]!.letting!.tenants[0];
      if (t) stayed += 1;
      else gone += 1;
    }
    // A good-credit steady tenant fails about one year in seventy.
    expect(stayed).toBeGreaterThan(285);
    expect(gone).toBeLessThan(15);
  });

  it('collects half the year from a tenant that fails, and says so', () => {
    const risky: Tenant = {
      ...TENANT,
      rent: RENT,
      credit: 'poor',
      work: 'new',
      evictions: 1,
      leaseEnds: 2040,
    };
    const home: OwnedHome = {
      ...base,
      letting: { ...base.letting!, managed: false, tenants: [risky, null] },
    };
    let failed = 0;
    for (let i = 0; i < 400 && failed < 3; i += 1) {
      const result = runHomesYear([home], 2031, `fail${i}`, 'severeRecession');
      if (result.homes[0]!.letting!.tenants[0] === null && rentOf(result) > 0) {
        failed += 1;
        expect(rentOf(result)).toBe(RENT / 2);
        expect(
          result.lines.some((line) => line.includes(risky.name) && line.includes('went under')),
        ).toBe(true);
      }
    }
    expect(failed).toBe(3);
  });

  it('pays only part of the first year of a new lease', () => {
    const fresh: Tenant = { ...TENANT, rent: RENT, since: 2031, leaseEnds: 2036 };
    const home: OwnedHome = {
      ...base,
      letting: { ...base.letting!, managed: false, tenants: [fresh, null] },
    };
    let checked = 0;
    for (let i = 0; i < 60; i += 1) {
      const result = runHomesYear([home], 2031, `first${i}`, 'normal');
      if (result.homes[0]!.letting!.tenants[0]) {
        checked += 1;
        expect(rentOf(result)).toBeLessThan(RENT);
        expect(rentOf(result)).toBeGreaterThan(RENT * 0.5);
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});

describe('0606 — a life’s economy reaches the building', () => {
  it('takes less rent in a year the economy turns down than in one it grows', () => {
    const base = building('home.office', 'home:2030:c8');
    // Leases that start this coming year, so the economy has a first year to take a part of.
    const opening = createNewGame({ seed: 'adv0' }).world.year + 1;
    const unmanaged: OwnedHome = {
      ...base,
      letting: {
        ...base.letting!,
        managed: false,
        tenants: base.letting!.tenants.map((_, unit) => ({
          ...applicantsAt('adv', base, unit, 2029, 'normal')[0]!,
          since: opening,
          leaseEnds: opening + 6,
        })),
      },
    };
    const full = askingRentOf(unmanaged) * 8;
    const groups: Record<'good' | 'bad', number[]> = { good: [], bad: [] };
    for (let i = 0; i < 500; i += 1) {
      const start: GameState = { ...createNewGame({ seed: `adv${i}` }), homes: [unmanaged] };
      const next = advanceYear(start).state;
      const rent = next.finance.transactions
        .filter((t) => t.year === next.world.year && t.source.startsWith('Rent from'))
        .reduce((sum, t) => sum + Number(t.amount) / 100, 0);
      const ratio = rent / full;
      if (next.market === 'growth' || next.market === 'strongExpansion') groups.good.push(ratio);
      if (next.market === 'recession' || next.market === 'severeRecession') groups.bad.push(ratio);
    }
    expect(groups.good.length).toBeGreaterThan(10);
    expect(groups.bad.length).toBeGreaterThan(10);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(groups.bad)).toBeLessThan(mean(groups.good) - 0.04);
  });
});

/* -------------------------------------------------------------------------- */
/* What it comes to                                                            */
/* -------------------------------------------------------------------------- */

interface Run {
  occupancy: number;
  /** Share of full rent collected in years of growth, and in years of recession. */
  good: number;
  bad: number;
  netOnValue: number;
}

function life(kindId: string): Run {
  const kind = findHomeKind(kindId)!;
  let collected = 0;
  let full = 0;
  const per: Partial<Record<MarketState, [number, number]>> = {};
  for (let i = 0; i < 80; i += 1) {
    const seed = `occ${i}`;
    let home = building(kindId);
    home = {
      ...home,
      letting: {
        ...home.letting!,
        tenants: home.letting!.tenants.map(
          (_, unit) => applicantsAt(seed, home, unit, 2030, 'normal')[0]!,
        ),
      },
    };
    let market: MarketState = 'normal';
    for (let year = 2031; year < 2061; year += 1) {
      const rent = askingRentOf(home) * kind.units;
      market = nextMarketState(market, mixedUnit(`${seed}:market:${year}`));
      const result = runHomesYear([home], year, seed, market);
      const got =
        Number(result.transactions.find((t) => t.source.startsWith('Rent from'))?.amount ?? 0) /
        100;
      collected += got;
      full += rent;
      const slot = (per[market] ??= [0, 0]);
      slot[0] += got;
      slot[1] += rent;
      home = result.homes[0]!;
    }
  }
  const pooled = (markets: readonly MarketState[]) => {
    const got = markets.reduce((sum, m) => sum + (per[m]?.[0] ?? 0), 0);
    const rent = markets.reduce((sum, m) => sum + (per[m]?.[1] ?? 0), 0);
    expect(rent).toBeGreaterThan(0);
    return got / rent;
  };
  const occupancy = collected / full;
  return {
    occupancy,
    good: pooled(['growth', 'strongExpansion']),
    bad: pooled(['recession', 'severeRecession']),
    netOnValue: occupancy * kind.rentYield * 0.92 - kind.expenseRate,
  };
}

describe('0606 — what a building comes to', () => {
  const TARGETS: Readonly<Record<string, number>> = {
    'home.corner-shop': 0.068,
    'home.retail-strip': 0.064,
    'home.warehouse': 0.057,
    'home.office': 0.074,
  };

  for (const kind of COMMERCIAL) {
    it(`yields what the market says ${kind.name} yields, and the economy moves it`, () => {
      const run = life(kind.id);
      expect(run.netOnValue).toBeGreaterThan((TARGETS[kind.id] ?? 0) - 0.006);
      expect(run.netOnValue).toBeLessThan((TARGETS[kind.id] ?? 0) + 0.006);
      // Occupancy: the kind's own vacancy, plus the cost of failures and re-lets.
      expect(run.occupancy).toBeLessThan(1 - kind.vacancy);
      expect(run.occupancy).toBeGreaterThan(1 - kind.vacancy - 0.08);
      expect(run.bad).toBeLessThan(run.good - 0.05);
    });
  }
});
