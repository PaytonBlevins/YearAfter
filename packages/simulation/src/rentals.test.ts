/**
 * Ticket 0503 acceptance tests — letting property.
 *
 * Before this ticket nobody could let anything: there were no rental
 * buildings, a house was always lived in, and `assetIncome` had never been
 * written by property. Measured on 300 lives with a landlord's strategy
 * (`claude/0503-a-landlord.md`): a managed duplex at the going rate let for
 * 95% of the year, evicted a tenant in 2.5% of unit-years, and yielded about
 * 6% net on what was paid, 6.6% in the cheapest states and 3.5% in the
 * dearest.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  RENT_LEVELS,
  annualExpenseOf,
  emptyLetting,
  reconcile,
  type OwnedHome,
} from '@yearafter/finance';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { buyHome, markMissed, rentalListings, runHomesYear } from './homes';
import { createNewGame } from './new-game';
import {
  applicantsAt,
  applicantsFor,
  askingRentOf,
  changeRent,
  fillEmptyUnits,
  moveBackIn,
  rentOut,
  residenceOf,
  setAgent,
  signTenant,
} from './rentals';

/* -------------------------------------------------------------------------- */
/* The economics, on their own                                                 */
/* -------------------------------------------------------------------------- */

const duplex = (regionKey: string, id: string, level = 1, managed = true): OwnedHome => ({
  id,
  kindId: 'home.duplex',
  beds: 4,
  baths: 2,
  builtYear: 1990,
  condition: 'good',
  regionKey,
  regionName: regionKey,
  purchasePrice: dollars(400_000),
  boughtYear: 2030,
  value: dollars(400_000),
  expenseRate: 0.024,
  behindYears: 0,
  letting: { ...emptyLetting(2), level, managed },
});

interface Run {
  readonly collected: number;
  readonly potential: number;
  readonly evictions: number;
  readonly unitYears: number;
  readonly netOnValue: number;
}

/**
 * Two hundred duplexes, twenty-five years each, straight through
 * `runHomesYear` — the same function a life calls, with nobody touching them.
 */
function let25(regionKey: string, level: number, managed = true, seedPrefix = 'let'): Run {
  let collected = 0;
  let potential = 0;
  let evictions = 0;
  let unitYears = 0;
  let net = 0;
  let valueYears = 0;
  for (let i = 0; i < 200; i += 1) {
    const seed = `${seedPrefix}-${i}`;
    let home: OwnedHome = duplex(regionKey, `home:2030:r${i}`, level, managed);
    // Moved in at the start: both units signed with the best of the first applicants.
    home = {
      ...home,
      letting: {
        ...home.letting!,
        tenants: [0, 1].map((unit) => applicantsAt(seed, home, unit, 2030)[0] ?? null),
      },
    };
    for (let year = 2031; year < 2056; year += 1) {
      const result = runHomesYear([home], year, seed);
      const next = result.homes[0]!;
      const rent = result.transactions
        .filter((entry) => entry.category === 'assetIncome')
        .reduce((sum, entry) => sum + Number(entry.amount) / 100, 0);
      const costs = result.transactions
        .filter((entry) => entry.category === 'housing')
        .reduce((sum, entry) => sum - Number(entry.amount) / 100, 0);
      collected += rent;
      potential += askingRentOf(next) * 2;
      evictions += result.lines.filter((text) => text.includes('evict')).length;
      unitYears += 2;
      net += rent - costs;
      valueYears += Number(next.value) / 100;
      home = next;
    }
  }
  return { collected, potential, evictions, unitYears, netOnValue: net / valueYears };
}

const occupancy = (run: Run) => run.collected / run.potential;

describe('0503 — what letting is worth', () => {
  const going = let25('US:OH', 1);

  it('keeps a managed building let most of the year at the going rate', () => {
    console.log(
      `going rate, Ohio: occupancy ${(occupancy(going) * 100).toFixed(1)}%, evictions ${((going.evictions / going.unitYears) * 100).toFixed(1)}% of unit-years, net ${(going.netOnValue * 100).toFixed(1)}% of value`,
    );
    // US rental vacancy runs about 6-7%.
    expect(occupancy(going)).toBeGreaterThan(0.9);
    expect(occupancy(going)).toBeLessThan(0.99);
    // Some tenants stop paying: around 2-3% of renter households a year face it.
    expect(going.evictions / going.unitYears).toBeGreaterThan(0.005);
    expect(going.evictions / going.unitYears).toBeLessThan(0.05);
  });

  it('earns an ordinary property return, not a fortune and not a loss', () => {
    // US small-multifamily cap rates run about 5-7%; Ohio is a cheap state.
    expect(going.netOnValue).toBeGreaterThan(0.04);
    expect(going.netOnValue).toBeLessThan(0.09);
  });

  it('pays in a cheap state and barely in a dear one', () => {
    const dear = let25('US:CA', 1);
    console.log(
      `net on value: Ohio ${(going.netOnValue * 100).toFixed(1)}%, California ${(dear.netOnValue * 100).toFixed(1)}%`,
    );
    expect(dear.netOnValue).toBeLessThan(going.netOnValue - 0.01);
  });

  it('makes very high rent cost applicants, and low rent cost profit (spec 954–978)', () => {
    const runs = RENT_LEVELS.map((level) => ({
      level: level.level,
      run: let25('US:OH', level.level),
    }));
    const revenue = (run: Run) => run.collected / run.unitYears;
    for (const { level, run } of runs) {
      console.log(
        `rent at ${level}: occupancy ${(occupancy(run) * 100).toFixed(0)}%, $${Math.round(revenue(run))} a unit-year`,
      );
    }
    const at = (level: number) => runs.find((entry) => entry.level === level)!.run;
    // Under the going rate: fuller, and less money.
    expect(occupancy(at(0.9))).toBeGreaterThan(occupancy(at(1)));
    expect(revenue(at(0.9))).toBeLessThan(revenue(at(1)));
    // Over it: emptier, and no more money — the going rate is the going rate.
    expect(occupancy(at(1.1))).toBeLessThan(occupancy(at(1)));
    expect(revenue(at(1.1))).toBeLessThan(revenue(at(1)));
    expect(revenue(at(1.2))).toBeLessThan(revenue(at(1)) * 0.85);
    // And at the top, once the first tenants go, nobody comes.
    expect(occupancy(at(1.3))).toBeLessThan(0.15);
  });

  it('empties a building nobody looks after', () => {
    const neglected = let25('US:OH', 1, false);
    console.log(
      `no agent and nobody looking: occupancy ${(occupancy(neglected) * 100).toFixed(0)}%`,
    );
    expect(occupancy(neglected)).toBeLessThan(0.35);
  });

  it('is the same building for the same seed', () => {
    expect(let25('US:OH', 1, true, 'again')).toEqual(let25('US:OH', 1, true, 'again'));
  });
});

/* -------------------------------------------------------------------------- */
/* The verbs, in a life                                                        */
/* -------------------------------------------------------------------------- */

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

/** A forty-year-old with a gift big enough to buy a building outright, posted honestly. */
function landlordToBe(): GameState {
  for (let i = 0; i < 40; i += 1) {
    let state = createNewGame({ seed: `landlord-${i}` });
    while (state.player.alive && state.player.age < 40)
      state = answerEverything(advanceYear(state).state);
    if (!state.player.alive) continue;
    const gift = 3_000_000;
    const books = {
      ...state.finance,
      balance: (Number(state.finance.balance) + gift * 100) as never,
      transactions: [
        ...state.finance.transactions,
        {
          id: `f:${state.world.year}:gift:landlord`,
          year: state.world.year,
          age: state.player.age,
          category: 'gift' as const,
          amount: (gift * 100) as never,
          source: 'A test windfall',
        },
      ],
    };
    const funded = { ...state, finance: books, player: { ...state.player, cash: books.balance } };
    if (rentalListings(funded).length > 0) return funded;
  }
  throw new Error('no life had a rental building to buy');
}

const START = landlordToBe();

describe('0503 — being a landlord', () => {
  it('buys a building empty, and lists it apart from the homes', () => {
    const listing = rentalListings(START)[0]!;
    expect(listing.rental).toBe(true);
    expect([2, 5, 10, 25]).toContain(listing.units);
    const bought = buyHome(START, listing.id, 'cash');
    expect(bought.ok).toBe(true);
    if (!bought.ok) return;
    const home = bought.value.home;
    expect(home.letting?.tenants).toHaveLength(listing.units);
    expect(home.letting?.tenants.every((tenant) => tenant === null)).toBe(true);
    // A building is never where anybody lives — not even with nobody in it.
    expect(residenceOf(bought.value.state.homes)?.id).not.toBe(home.id);
    const { letting: _none, ...bare } = home;
    expect(residenceOf([bare])).toBeUndefined();
    expect(moveBackIn(bought.value.state, home.id).ok).toBe(false);
  });

  it('signs a tenant who pays from the next year, into the ledger as rent', () => {
    const listing = rentalListings(START)[0]!;
    const bought = buyHome(START, listing.id, 'cash');
    if (!bought.ok) throw new Error('could not buy');
    let state = bought.value.state;
    const homeId = bought.value.home.id;
    const applicants = applicantsFor(state, homeId, 0);
    expect(applicants).toHaveLength(3);
    // The same people answer all year.
    expect(applicantsFor(state, homeId, 0)).toEqual(applicants);
    const signed = signTenant(state, homeId, 0, applicants[0]!.id);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    state = signed.value.state;
    expect(signTenant(state, homeId, 0, applicants[1]!.id).ok).toBe(false);

    state = answerEverything(advanceYear(state).state);
    const rent = state.finance.transactions.filter(
      (entry) =>
        entry.year === state.world.year &&
        entry.category === 'assetIncome' &&
        entry.source.startsWith('Rent'),
    );
    expect(rent.length).toBe(1);
    expect(reconcile(state.finance).ok).toBe(true);
  });

  it('fills every empty unit at once, and an agent keeps them filled', () => {
    const listing = rentalListings(START)[0]!;
    const bought = buyHome(START, listing.id, 'cash');
    if (!bought.ok) throw new Error('could not buy');
    const homeId = bought.value.home.id;
    const filled = fillEmptyUnits(bought.value.state, homeId);
    expect(filled.ok).toBe(true);
    if (!filled.ok) return;
    const home = filled.value.state.homes.find((candidate) => candidate.id === homeId)!;
    expect(home.letting?.tenants.every((tenant) => tenant !== null)).toBe(true);

    const managed = setAgent(filled.value.state, homeId, true);
    if (!managed.ok) throw new Error('no agent');
    let state = managed.value.state;
    for (let year = 0; year < 6; year += 1) state = answerEverything(advanceYear(state).state);
    const later = state.homes.find((candidate) => candidate.id === homeId);
    if (!later) return; // sold under pressure, which is its own test
    const let_ = later.letting!.tenants.filter((tenant) => tenant !== null).length;
    expect(let_).toBe(later.letting!.tenants.length);
    expect(
      state.finance.transactions.some((entry) => entry.source.startsWith('Letting agent')),
    ).toBe(true);
  });

  it('moves the rent one step at a time, for everybody at renewal', () => {
    const listing = rentalListings(START)[0]!;
    const bought = buyHome(START, listing.id, 'cash');
    if (!bought.ok) throw new Error('could not buy');
    const homeId = bought.value.home.id;
    const before = askingRentOf(bought.value.home);
    const raised = changeRent(bought.value.state, homeId, 1);
    if (!raised.ok) throw new Error('no change');
    const after = raised.value.state.homes.find((candidate) => candidate.id === homeId)!;
    expect(after.letting?.level).toBe(1.1);
    expect(askingRentOf(after)).toBeGreaterThan(before);
    // And fewer people answer.
    expect(applicantsFor(raised.value.state, homeId, 0).length).toBeLessThan(
      applicantsFor(bought.value.state, homeId, 0).length,
    );
  });

  it('lets a house out, moving the character out of it, and back in again', () => {
    const house: OwnedHome = {
      id: 'home:test:house',
      kindId: 'home.starter',
      beds: 3,
      baths: 1,
      builtYear: 1980,
      condition: 'good',
      regionKey: 'US:OH',
      regionName: 'Ohio',
      purchasePrice: dollars(250_000),
      boughtYear: START.world.year,
      value: dollars(250_000),
      expenseRate: 0.023,
      behindYears: 0,
    };
    const owner: GameState = { ...START, homes: [house] };
    expect(residenceOf(owner.homes)?.id).toBe(house.id);

    const let_ = rentOut(owner, house.id);
    expect(let_.ok).toBe(true);
    if (!let_.ok) return;
    expect(residenceOf(let_.value.state.homes)).toBeUndefined();
    expect(let_.value.state.homes[0]!.letting?.tenants).toEqual([null]);

    // A year on, they rent somewhere themselves, and the house's costs are not their roof.
    const year = answerEverything(advanceYear(let_.value.state).state);
    expect(year.household.housing).not.toBe('owned');

    // Empty, and nowhere else to live: they can move back.
    const back = moveBackIn(let_.value.state, house.id);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(residenceOf(back.value.state.homes)?.id).toBe(house.id);

    // Not with a tenant in it.
    const tenant = applicantsFor(let_.value.state, house.id, 0)[0]!;
    const signed = signTenant(let_.value.state, house.id, 0, tenant.id);
    if (!signed.ok) throw new Error('no tenant');
    expect(moveBackIn(signed.value.state, house.id).ok).toBe(false);
  });

  it('falls behind on the property it lets before the home it lives in', () => {
    const home: OwnedHome = {
      ...duplex('US:OH', 'home:x:house'),
      kindId: 'home.starter',
    };
    delete (home as { letting?: unknown }).letting;
    const rental = duplex('US:OH', 'home:x:r0');
    const marked = markMissed([home, rental], true);
    expect(marked.find((entry) => entry.id === home.id)!.behindYears).toBe(0);
    expect(marked.find((entry) => entry.id === rental.id)!.behindYears).toBe(1);
    // With nothing else, the home itself slips.
    expect(markMissed([home], true)[0]!.behindYears).toBe(1);
  });

  it('charges a rental’s costs to the rental, not to the life', () => {
    const rental = duplex('US:OH', 'home:y:r0');
    const year = runHomesYear([rental], 2031, 'cost');
    expect(year.residenceCost).toBe(0);
    expect(
      year.transactions.some((entry) => entry.source === 'Taxes and upkeep on the duplex'),
    ).toBe(true);
    expect(annualExpenseOf(rental)).toBeGreaterThan(0);
  });
});
