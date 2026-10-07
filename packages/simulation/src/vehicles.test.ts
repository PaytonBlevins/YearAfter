/**
 * Ticket 0504 acceptance tests — vehicles.
 *
 * Measured before this ticket, on two disjoint sets of 150 played lives:
 * nobody had ever owned a car, at any age. Getting about was paid for inside
 * the living bill and nothing could be bought, kept, sold or shown.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  INSPECTION_FEE,
  REPOSSESS_AFTER,
  homesValue,
  mortgagesOwed,
  portfolioWorth,
  reconcile,
  totalBorrowed,
  totalOwed,
  vehicleLoansOwed,
  vehicleWorthOf,
  vehiclesValue,
  type OwnedVehicle,
} from '@yearafter/finance';
import { VEHICLE_LOTS, findVehicleTrim, costIndexOf } from '@yearafter/content';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { estateOf } from './investments';
import { createNewGame } from './new-game';
import { runLiving } from './phases/living';
import { fitVehicleMod, modSlotsFor } from './vehicle-mods';
import {
  LUXURY_MEANS,
  LUXURY_REACH,
  buyVehicle,
  carMeansOf,
  findVehicleListing,
  inspectVehicle,
  inspectionOf,
  markVehiclesMissed,
  openVehicleMarkets,
  repossess,
  sellVehicle,
  upkeepOf,
  vehicleLots,
  vehicleTitleOf,
  type VehicleListing,
} from './vehicles';

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

/** Money added the honest way, so the books still reconcile. */
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

const netWorthOf = (state: GameState): number => {
  const estate = estateOf(state);
  return (
    Number(state.player.cash) +
    Number(estate.investments) +
    Number(estate.assets ?? 0) -
    Number(estate.liabilities)
  );
};

/* -------------------------------------------------------------------------- */
/* One population, played once                                                 */
/* -------------------------------------------------------------------------- */

interface Row {
  readonly age: number;
  readonly car: boolean;
  readonly home: boolean;
  readonly short: boolean;
  readonly netWorth: number;
}

const LIVES = 150;
const ROWS: Row[] = [];
const SAMPLES: GameState[] = [];
let bought = 0;
let financed = 0;
let defects = 0;
let taken = 0;
let scrapped = 0;

for (let i = 0; i < LIVES; i += 1) {
  let state = createNewGame({ seed: `veh-${i}` });
  let guard = 0;
  while (state.player.alive && (guard += 1) < 110) {
    const before = new Set(state.vehicles.map((vehicle) => vehicle.id));
    state = answerEverything(advanceYear(state).state);
    for (const vehicle of state.vehicles) {
      if (before.has(vehicle.id)) continue;
      bought += 1;
      if (vehicle.loan) financed += 1;
      if (vehicle.defect) defects += 1;
    }
    for (const entry of state.player.timeline) {
      if (entry.year !== state.world.year) continue;
      if (entry.id.includes(':car:taken:')) taken += 1;
      if (entry.text.includes('finally gave out')) scrapped += 1;
    }
    if (state.player.age === 30 || state.player.age === 45) SAMPLES.push(state);
    if (state.player.age < 18) continue;
    const year = state.finance.transactions.filter((entry) => entry.year === state.world.year);
    ROWS.push({
      age: state.player.age,
      car: state.vehicles.length > 0,
      home: state.homes.length > 0,
      short: year.some((entry) => entry.category === 'shortfall'),
      netWorth:
        (Number(state.player.cash) +
          Number(portfolioWorth(state.prices, state.portfolio)) +
          Number(homesValue(state.homes)) +
          Number(vehiclesValue(state.vehicles)) -
          Number(totalOwed(state.cards)) -
          Number(totalBorrowed(state.loans)) -
          Number(mortgagesOwed(state.homes)) -
          Number(vehicleLoansOwed(state.vehicles))) /
        100,
    });
  }
}

const band = (low: number, high: number) => ROWS.filter((row) => row.age >= low && row.age <= high);
const share = (rows: readonly Row[], test: (row: Row) => boolean) =>
  rows.filter(test).length / Math.max(1, rows.length);
const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** A thirty-year-old renter with something in the bank — the ordinary buyer. */
const adult = SAMPLES.find(
  // P5 can put the first sampled renter into a richer, indebted career.
  // Select the test's stated ordinary, debt-free working buyer explicitly;
  // retain the luxury threshold and every financing assertion unchanged.
  (state) =>
    state.player.age === 30 &&
    state.homes.length === 0 &&
    state.vehicles.length === 0 &&
    state.employment.job !== undefined &&
    state.loans.length === 0 &&
    carMeansOf(state) < LUXURY_MEANS,
)!;
const buyer = topUp(adult, 60_000);
const rich = topUp(adult, 2_000_000);

describe('0504 — the lots', () => {
  it('shows the same cars all year and new stock the next, cheapest first on each lot', () => {
    const lots = vehicleLots(buyer, 'used');
    expect(lots.length).toBe(2);
    expect(vehicleLots(buyer, 'used')).toEqual(lots);
    for (const { listings } of lots) {
      for (let i = 1; i < listings.length; i += 1) {
        expect(listings[i]!.askingPrice).toBeGreaterThanOrEqual(listings[i - 1]!.askingPrice);
      }
    }
    const nextYear = { ...buyer, world: { ...buyer.world, year: buyer.world.year + 1 } };
    expect(
      vehicleLots(nextYear, 'used').flatMap((v) => v.listings.map((l) => l.trimId)),
    ).not.toEqual(lots.flatMap((v) => v.listings.map((l) => l.trimId)));
  });

  it('sells this year’s models new, and older ones used, with no mileage anywhere', () => {
    for (const { listings } of vehicleLots(buyer, 'new')) {
      for (const listing of listings) {
        expect(listing.isNew).toBe(true);
        expect(listing.modelYear).toBe(buyer.world.year);
        expect(listing.condition).toBe(100);
        expect(listing.inspectable).toBe(false);
      }
    }
    for (const { lot, listings } of vehicleLots(buyer, 'used')) {
      for (const listing of listings) {
        const age = buyer.world.year - listing.modelYear;
        expect(age).toBeGreaterThanOrEqual(lot.age[0]);
        expect(age).toBeLessThanOrEqual(lot.age[1]);
        expect(Object.keys(listing).some((key) => /mile/i.test(key))).toBe(false);
      }
    }
  });

  it('opens the Luxury market only to somebody whose means reach it, and says nothing about why', () => {
    expect(carMeansOf(adult)).toBeLessThan(LUXURY_MEANS);
    expect(openVehicleMarkets(adult)).not.toContain('luxury');
    expect(openVehicleMarkets(rich)).toContain('luxury');
    const ceiling = carMeansOf(rich) * LUXURY_REACH;
    for (const { listings } of vehicleLots(rich, 'luxury')) {
      for (const listing of listings) expect(listing.askingPrice).toBeLessThan(ceiling * 1.2);
    }
  });

  it('shows nothing to a child', () => {
    const child = { ...adult, player: { ...adult.player, age: 12 } };
    expect(openVehicleMarkets(child)).toEqual([]);
  });

  it('keeps hidden issues uncommon, commonest online, and hides an accident only online', () => {
    let online = 0;
    let onlineBad = 0;
    let dealer = 0;
    let dealerBad = 0;
    for (let year = 0; year < 60; year += 1) {
      const later = { ...buyer, world: { ...buyer.world, year: buyer.world.year + year } };
      for (const market of ['used', 'online'] as const) {
        for (const { listings } of vehicleLots(later, market)) {
          for (const listing of listings) {
            if (market === 'online') {
              online += 1;
              if (listing.defect) onlineBad += 1;
              expect(inspectionOf(later, listing).accident).toBeUndefined();
            } else {
              dealer += 1;
              if (listing.defect) dealerBad += 1;
              expect(inspectionOf(later, listing).accident).toBe(listing.accident);
            }
          }
        }
      }
    }
    expect(onlineBad / online).toBeGreaterThan(dealerBad / dealer);
    expect(onlineBad / online).toBeLessThan(0.16);
    expect(dealerBad / dealer).toBeLessThan(0.07);
  });
});

/** The first listing in a market that matches, searching forward through the years. */
function findListing(
  state: GameState,
  market: 'new' | 'used' | 'online',
  test: (listing: VehicleListing) => boolean,
): { state: GameState; listing: VehicleListing } {
  for (let year = 0; year < 80; year += 1) {
    const later = { ...state, world: { ...state.world, year: state.world.year + year } };
    for (const { listings } of vehicleLots(later, market)) {
      const listing = listings.find(test);
      if (listing) return { state: later, listing };
    }
  }
  throw new Error('no listing found');
}

describe('0504 — inspecting a used car', () => {
  it('costs the fee, reveals the history, and takes a fault off the price', () => {
    const { state, listing } = findListing(
      buyer,
      'online',
      (candidate) => candidate.defect !== undefined,
    );
    const before = inspectionOf(state, listing);
    expect(before.inspected).toBe(false);
    expect(before.history).toBeUndefined();
    expect(before.defect).toBeUndefined();

    const inspected = inspectVehicle(state, listing.id);
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    const after = inspected.value.state;
    expect(reconcile(after.finance).ok).toBe(true);
    expect(Number(state.player.cash) - Number(after.player.cash)).toBe(INSPECTION_FEE * 100);
    expect(after.finance.transactions.at(-1)?.category).toBe('vehicle');
    const view = inspectionOf(after, listing);
    expect(view.history).toBe(listing.history);
    expect(view.defect).toEqual(listing.defect);
    expect(view.price).toBe(listing.askingPrice - listing.defect!.cost);
    expect(inspectVehicle(after, listing.id).ok).toBe(false);
  });

  it('cannot inspect a new car', () => {
    const listing = vehicleLots(buyer, 'new')[0]!.listings[0]!;
    const result = inspectVehicle(buyer, listing.id);
    expect(result.ok).toBe(false);
  });
});

describe('0504 — buying, owning and selling one', () => {
  it('buys outright as a transfer, and loses value the year it leaves the lot', () => {
    const listing = vehicleLots(buyer, 'new')[0]!.listings[0]!;
    const before = netWorthOf(buyer);
    const result = buyVehicle(buyer, listing.id, 'cash');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state;
    expect(reconcile(after.finance).ok).toBe(true);
    expect(after.vehicles).toHaveLength(1);
    expect(after.finance.transactions.at(-1)?.category).toBe('property');
    // A new car is worth less than was paid the moment it is yours — but it
    // is still worth most of it, and it counts.
    const loss = before - netWorthOf(after);
    expect(loss).toBeGreaterThan(0);
    expect(loss).toBeLessThan(listing.askingPrice * 100 * 0.15);
    // Gone from the lot.
    expect(findVehicleListing(after, listing.id)).toBeUndefined();
    expect(buyVehicle(after, listing.id, 'cash').ok).toBe(false);
  });

  it('finances one on the lender’s instant answer, and the payments come next year', () => {
    const listing = vehicleLots(buyer, 'used')[0]!.listings.at(-1)!;
    const result = buyVehicle(buyer, listing.id, 'loan');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const owned = result.value.vehicle;
    expect(owned.loan).toBeDefined();
    let next = advanceYear(result.value.state).state;
    expect(reconcile(next.finance).ok).toBe(true);
    const rows = next.finance.transactions.filter(
      (entry) => entry.year === next.world.year && entry.category === 'vehicle',
    );
    expect(rows.some((entry) => entry.source.startsWith('Car payment'))).toBe(true);
    expect(rows.some((entry) => entry.source.startsWith('Maintenance and repairs'))).toBe(true);
    const balance = Number(next.vehicles.find((v) => v.id === owned.id)?.loan?.balance ?? 0);
    expect(balance).toBeLessThan(Number(owned.loan!.balance));
    next = answerEverything(next);
    expect(next.vehicles.find((v) => v.id === owned.id)).toBeDefined();
  });

  it('sells to a dealer, pays off the loan, and needs the cash if it owes more', () => {
    const listing = vehicleLots(buyer, 'used')[0]!.listings[0]!;
    const bought = buyVehicle(buyer, listing.id, 'cash');
    if (!bought.ok) throw new Error('buy');
    const sold = sellVehicle(bought.value.state, bought.value.vehicle.id);
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.value.state.vehicles).toHaveLength(0);
    expect(sold.value.proceeds).toBeGreaterThan(0);
    expect(reconcile(sold.value.state.finance).ok).toBe(true);

    const underwater: OwnedVehicle = {
      ...bought.value.vehicle,
      value: dollars(2_000),
      loan: {
        productId: 'auto.used',
        principal: dollars(9_000),
        balance: dollars(9_000),
        termLeft: 4,
      },
    };
    const broke: GameState = {
      ...bought.value.state,
      vehicles: [underwater],
      player: { ...bought.value.state.player, cash: 0 as never },
      finance: { ...bought.value.state.finance, balance: 0 as never },
    };
    expect(sellVehicle(broke, underwater.id).ok).toBe(false);
  });

  it('is too young to buy at fifteen', () => {
    const young = { ...buyer, player: { ...buyer.player, age: 15 } };
    const listing = vehicleLots(buyer, 'used')[0]!.listings[0]!;
    expect(buyVehicle(young, listing.id, 'cash').ok).toBe(false);
  });

  it('puts a financed car behind in a short year, and the lender takes it after two', () => {
    const listing = vehicleLots(buyer, 'used')[0]!.listings.at(-1)!;
    const bought = buyVehicle(buyer, listing.id, 'loan');
    if (!bought.ok) throw new Error('buy');
    let cars = bought.value.state.vehicles;
    for (let year = 0; year < REPOSSESS_AFTER; year += 1) cars = markVehiclesMissed(cars, true);
    expect(cars[0]!.behindYears).toBe(REPOSSESS_AFTER);
    expect(markVehiclesMissed(cars, false)[0]!.behindYears).toBe(0);
    const taken = repossess({ ...bought.value.state, vehicles: cars });
    expect(taken.vehicles).toHaveLength(0);
    expect(reconcile(taken.finance).ok).toBe(true);
    // One short year is not enough.
    const once = repossess({
      ...bought.value.state,
      vehicles: markVehiclesMissed(bought.value.state.vehicles, true),
    });
    expect(REPOSSESS_AFTER > 1 ? once.vehicles : []).toHaveLength(REPOSSESS_AFTER > 1 ? 1 : 0);
  });
});

describe('0504 — the living bill and the car', () => {
  const household = {
    standard: 45_000,
    lifestyle: 'comfortable' as const,
    housing: 'ownPlace' as const,
    leftHomeAt: 22,
  };
  const input = {
    age: 40,
    household,
    locationIndex: 1,
    partnered: false,
    childAges: [],
    afterTaxIncome: 50_000,
    wealth: 10_000,
    credit: 0,
    portfolio: 0,
    earned: 60_000,
    toldToLeave: false,
    hasLivingParent: true,
  };

  it('stops paying for getting around once there is a car, and remembers what it would have cost', () => {
    const none = runLiving(input);
    const car = runLiving({ ...input, ownsVehicle: true, vehicleCost: 1_500 });
    expect(car.cost).toBeLessThan(none.cost);
    // The home door reads the bill without the car (see `withoutCar`): owning
    // a car must not make every house look further out of reach.
    expect(car.withoutCar).toBe(none.cost);
  });

  it('charges a year with a car less than the same year without one, end to end', () => {
    const listing = vehicleLots(buyer, 'used')[0]!.listings[0]!;
    const bought = buyVehicle(buyer, listing.id, 'cash');
    if (!bought.ok) throw new Error('buy');
    // The same cash either way, so the only difference is the car.
    const withCar = topUp(bought.value.state, listing.askingPrice);
    const living = (state: GameState) => {
      const next = advanceYear(state).state;
      return -next.finance.transactions
        .filter((entry) => entry.year === next.world.year && entry.category === 'living')
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
    };
    // P2 explicitly replaces the old income-scaled contract: owning a car
    // removes a capped dollar allowance, never 8.5% of a wealthy life's bill.
    const discount = living(buyer) - living(withCar);
    expect(discount).toBeGreaterThan(0);
    expect(discount).toBeLessThanOrEqual(
      1_600 * costIndexOf(buyer.player.currentLocation.cityId) * 100 + 1,
    );
  });
});

describe('0504 — a population that drives (the sixth door)', () => {
  it('ends up owning cars about as often as real households do', () => {
    // About nine US households in ten have one; fewer of the youngest.
    expect(share(band(25, 34), (row) => row.car)).toBeGreaterThan(0.55);
    expect(share(band(45, 64), (row) => row.car)).toBeGreaterThan(0.75);
    expect(share(band(65, 99), (row) => row.car)).toBeGreaterThan(0.8);
    expect(share(band(18, 24), (row) => row.car)).toBeLessThan(
      share(band(35, 44), (row) => row.car),
    );
  });

  it('pays for them without falling short more often, or losing the house over them', () => {
    expect(share(ROWS, (row) => row.short)).toBeLessThan(0.03);
    // Measured before cars: 64% at 45–54 owned a home. Cars compete with a
    // deposit, which is real, but must not take ownership apart.
    expect(share(band(45, 54), (row) => row.home)).toBeGreaterThan(0.5);
  });

  it('keeps net worth where the US figures are, cars and loans counted', () => {
    // Before 0504 (two samples): 55–64 $294,000–$331,000; 65–74 $379,000–$415,000.
    const at55 = median(band(55, 64).map((row) => row.netWorth));
    const at65 = median(band(65, 74).map((row) => row.netWorth));
    expect(at55).toBeGreaterThan(220_000);
    expect(at55).toBeLessThan(420_000);
    expect(at65).toBeGreaterThan(280_000);
    expect(at65).toBeLessThan(520_000);
  });

  it('buys mostly ordinary cars, sometimes on finance, and rarely loses one to the lender', () => {
    expect(bought).toBeGreaterThan(LIVES * 2);
    expect(financed).toBeGreaterThan(0);
    // Measured 1–2% of financed cars; 12% when the lender acted on one short year.
    expect(taken / Math.max(1, financed)).toBeLessThan(0.05);
    // Spec 1387: hidden issues stay uncommon.
    expect(defects / bought).toBeLessThan(0.06);
    // Cars wear out and go to the junkyard.
    expect(scrapped).toBeGreaterThan(0);
  });

  it('plays the same life the same way twice', () => {
    const run = () => {
      let state = createNewGame({ seed: 'veh-same' });
      for (let year = 0; year < 45; year += 1) state = answerEverything(advanceYear(state).state);
      return state.vehicles;
    };
    expect(run()).toEqual(run());
  });

  it('has a lot for every market the screens list', () => {
    for (const market of ['new', 'used', 'online', 'luxury'] as const) {
      expect(VEHICLE_LOTS.some((lot) => lot.market === market)).toBe(true);
    }
  });
});

describe('0505 — taking a car to a shop', () => {
  const withCar = (() => {
    const listing = vehicleLots(buyer, 'used')[0]!.listings.at(-1)!;
    const bought = buyVehicle(buyer, listing.id, 'cash');
    if (!bought.ok) throw new Error('buy');
    return { state: bought.value.state, id: bought.value.vehicle.id };
  })();

  /** A Tarbus-capable car, owned outright, valued the way the game values it. */
  const withGelander = (() => {
    const found = findVehicleTrim('car.merceda-gelander.g-63-amr')!;
    const year = rich.world.year;
    const vehicle: OwnedVehicle = {
      id: `car:${year}:lot.luxury-1:9`,
      trimId: found.trim.id,
      modelYear: year,
      boughtYear: year,
      purchasePrice: dollars(found.trim.price),
      value: dollars(0),
      condition: 100,
      history: 'full',
      accident: false,
      behindYears: 0,
    };
    const valued = { ...vehicle, value: dollars(vehicleWorthOf(vehicle, found, year)) };
    return { ...rich, vehicles: [valued] };
  })();

  it('charges the shop as spending, and the car is worth only part of it more', () => {
    const { state, id } = withCar;
    const wheels = modSlotsFor(state, id)
      .find((view) => view.slot === 'wheels')!
      .options.find((option) => option.mod.id === 'mod.wheels.forged')!;
    const before = netWorthOf(state);
    const result = fitVehicleMod(state, id, 'mod.wheels.forged');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state;
    expect(reconcile(after.finance).ok).toBe(true);
    expect(after.finance.transactions.at(-1)?.category).toBe('vehicle');
    expect(Number(state.player.cash) - Number(after.player.cash)).toBe(wheels.price * 100);
    const lost = before - netWorthOf(after);
    // Spec 1387: most of it does not come back — but some does.
    expect(lost).toBeGreaterThan(wheels.price * 100 * 0.5);
    expect(lost).toBeLessThan(wheels.price * 100);
    expect(after.vehicles[0]!.mods?.[0]?.modId).toBe('mod.wheels.forged');
    // And it is still there, and still worth something, a year on.
    const next = advanceYear(after).state;
    expect(next.vehicles[0]!.mods?.[0]?.modId).toBe('mod.wheels.forged');
    expect(reconcile(next.finance).ok).toBe(true);
  });

  it('shows only what this car can have, and refuses the rest by name', () => {
    const { state, id } = withCar;
    const slots = modSlotsFor(state, id).map((view) => view.slot);
    expect(slots).not.toContain('tarbus');
    expect(fitVehicleMod(state, id, 'mod.tarbus')).toEqual({
      ok: false,
      error: 'not-for-this-car',
    });
    const broke: GameState = {
      ...state,
      player: { ...state.player, cash: 0 as never },
      finance: { ...state.finance, balance: 0 as never },
    };
    expect(fitVehicleMod(broke, id, 'mod.wheels.forged')).toEqual({
      ok: false,
      error: 'cannot-afford',
    });
  });

  it('sends a suitable car to Tarbus, which takes over the engine and puts its name on it', () => {
    const id = withGelander.vehicles[0]!.id;
    expect(modSlotsFor(withGelander, id).map((view) => view.slot)).toContain('tarbus');
    const result = fitVehicleMod(withGelander, id, 'mod.tarbus');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state;
    expect(vehicleTitleOf(after.vehicles[0]!)).toMatch(/Tarbus$/);
    expect(fitVehicleMod(after, id, 'mod.exhaust.cat-back')).toEqual({
      ok: false,
      error: 'covered-by-tarbus',
    });
    // It holds most of what it cost, which a shop's work never does.
    const gained = Number(after.vehicles[0]!.value) - Number(withGelander.vehicles[0]!.value);
    expect(gained / (result.value.price * 100)).toBeGreaterThan(0.6);
    // Sold, the conversion comes back with it.
    const sold = sellVehicle(after, id);
    const soldStock = sellVehicle(withGelander, id);
    if (!sold.ok || !soldStock.ok) throw new Error('sell');
    expect(sold.value.proceeds).toBeGreaterThan(soldStock.value.proceeds);
  });

  it('costs more to keep once the engine has been worked on', () => {
    const state = withGelander;
    const id = state.vehicles[0]!.id;
    const tuned = fitVehicleMod(state, id, 'mod.ecu.stage-2');
    expect(tuned.ok).toBe(true);
    if (!tuned.ok) return;
    expect(upkeepOf(tuned.value.vehicle, state.world.year)).toBeGreaterThan(
      upkeepOf(state.vehicles[0]!, state.world.year),
    );
  });
});
