/**
 * Ticket 0504 — vehicles.
 *
 * The rules live in `@yearafter/finance`'s `vehicles.ts`; this is where they
 * meet a life: what is on the lots this year, inspecting a used car, buying
 * one (cash or the instant loan), selling one, a year of owning them, a lender
 * taking one back, and the question the game asks somebody who has never
 * thought to look (`withVehicleOffer`, the sixth door).
 *
 * LISTINGS ARE DERIVED, NOT STORED — the same rule as homes (CORE_RULES
 * 13.19). A lot is stocked from the seed, the year and the lot's id, so every
 * look in the same year sees the same cars and next year sees new ones. What
 * an inspection finds is derived too; the save only remembers WHICH listings
 * somebody paid to have looked at.
 *
 * SPEC 1877's MARKETS. New (two lots), Used (two lots), Online (one
 * marketplace, private sellers) and Luxury (two smaller lots, one new and one
 * collector). The Luxury market is behind the same kind of hidden gate as an
 * expensive home: somebody who could never buy a Ferrano is not shown an
 * empty showroom, and nothing on the screen says why (spec 1356).
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type TimelineEntry,
} from '@yearafter/character';
import {
  BODY_LABELS,
  VEHICLE_LOTS,
  VEHICLE_MODELS,
  findVehicleLot,
  findVehicleTrim,
  vehicleName,
  type VehicleLot,
  type VehicleMarket,
  type VehicleModel,
} from '@yearafter/content';
import { dollars, err, mixedUnit, ok, type Result } from '@yearafter/core';
import {
  DRIVE_FROM_AGE,
  INSPECTION_FEE,
  REPOSSESS_AFTER,
  SCRAP_VALUE,
  carLoanFor,
  defectFor,
  expectedCondition,
  findLoanProduct,
  historyFrom,
  hasTarbus,
  maintenanceFor,
  mortgagePaymentFor,
  strainOf,
  findMortgageProduct,
  portfolioWorth,
  post,
  vehicleLoanPayments,
  vehicleSaleOf,
  vehicleValueOf,
  vehicleYear,
  yearlyPaymentFor,
  type CarBuyer,
  type CarLoanOffer,
  type NewTransaction,
  type OwnedVehicle,
  type ServiceHistory,
  type VehicleDefect,
} from '@yearafter/finance';
import type { PendingDecision } from '@yearafter/events';
import { incomeOf, standingFor } from './cards';
import { hasSystemicOffer, type GameState, type VehicleOffer } from './game-state';

/* -------------------------------------------------------------------------- */
/* This year's lots                                                            */
/* -------------------------------------------------------------------------- */

export interface VehicleListing {
  /** `car:<year>:<lot>:<slot>`. Becomes the owned car's id, so it is stable forever. */
  readonly id: string;
  readonly lotId: string;
  readonly lotName: string;
  readonly market: VehicleMarket;
  readonly modelId: string;
  readonly trimId: string;
  /** "Royata Camden SE". */
  readonly name: string;
  readonly bodyLabel: string;
  readonly modelYear: number;
  readonly isNew: boolean;
  /** 0–100 underneath; the screen shows four words. */
  readonly condition: number;
  /** Whole dollars, as listed. An inspection that finds a problem can lower it. */
  readonly askingPrice: number;
  readonly blurb: string;
  /** Hidden until inspected — see `inspectionOf`. */
  readonly history: ServiceHistory;
  /** Shown on a dealer's lot (they run the report); hidden online until inspected. */
  readonly accident: boolean;
  /** Hidden until inspected. Almost always absent. */
  readonly defect?: VehicleDefect;
  /** Whether this listing can be inspected: a used car, not a new one. */
  readonly inspectable: boolean;
  /** Whether the accident line is shown before inspection. */
  readonly accidentShown: boolean;
}

/** Used cars that have had a crash, across the market. */
export const ACCIDENT_SHARE = 0.12;

/**
 * What somebody could plausibly bring to a car, whole dollars — the hidden gate
 * on the Luxury lots. Cash and investments and a year's income.
 */
export function carMeansOf(state: GameState): number {
  const cash = Number(state.player.cash) / 100;
  const invested = Number(portfolioWorth(state.prices, state.portfolio)) / 100;
  return Math.max(0, cash + invested + incomeOf(state));
}

/** The Luxury market opens to somebody whose means reach this. Never displayed. */
export const LUXURY_MEANS = 120_000;
/** And a luxury lot shows nothing dearer than this many times those means. */
export const LUXURY_REACH = 1.5;

/** Spec 1877: cars are on the lots from the year a character could drive one. */
export const SHOP_FROM_AGE = 16;

const unit = (state: GameState, key: string) =>
  mixedUnit(`${state.rng.getSeed()}:${state.world.year}:${key}`);

function between([low, high]: readonly [number, number], u: number): number {
  return Math.round(low + u * (high - low));
}

/** The models a lot stocks, before the hidden gate. */
const modelsFor = (lot: VehicleLot): readonly VehicleModel[] =>
  VEHICLE_MODELS.filter((model) => lot.markets.includes(model.market));

function stockLot(state: GameState, lot: VehicleLot, means: number): readonly VehicleListing[] {
  const year = state.world.year;
  const luxury = lot.market === 'luxury';
  const ceiling = luxury ? means * LUXURY_REACH : Infinity;
  const pool = modelsFor(lot)
    .map((model) => ({ model, trims: model.trims.filter((trim) => trim.price <= ceiling) }))
    .filter((entry) => entry.trims.length > 0);
  if (pool.length === 0) return [];

  const listings: VehicleListing[] = [];
  for (let slot = 0; slot < lot.size; slot += 1) {
    const key = `car:${lot.id}:${slot}`;
    const entry = pool[Math.floor(unit(state, `${key}:model`) * pool.length)]!;
    const { model } = entry;
    const trim = entry.trims[Math.floor(unit(state, `${key}:trim`) * entry.trims.length)]!;
    const classic = model.market === 'classic';
    const isNew = !classic && lot.age[1] === 0;
    const modelYear = classic
      ? (model.year as number)
      : year - between(lot.age, unit(state, `${key}:age`));
    const age = year - modelYear;
    const history: ServiceHistory = isNew ? 'full' : historyFrom(unit(state, `${key}:history`));
    const nudge = history === 'full' ? 6 : history === 'none' ? -8 : 0;
    const condition = isNew
      ? 100
      : classic
        ? 45 + Math.round(unit(state, `${key}:condition`) * 50)
        : Math.max(
            5,
            Math.min(
              100,
              Math.round(
                expectedCondition(age) + nudge + (unit(state, `${key}:condition`) - 0.5) * 24,
              ),
            ),
          );
    const accident = !isNew && unit(state, `${key}:accident`) < (classic ? 0.05 : ACCIDENT_SHARE);
    const defect =
      !isNew && unit(state, `${key}:defect`) < lot.defectChance
        ? defectFor(model, trim, unit(state, `${key}:part`), unit(state, `${key}:size`))
        : undefined;
    /*
      WHAT THE SELLER KNOWS IS WHAT THE PRICE KNOWS. A dealer runs the history
      report and prices the paperwork in. A private seller online prices on how
      the car looks, so a car with no records costs the same as one with a
      folder of receipts — which is the risk, and what an inspection buys.
      Nobody prices in a fault they are not mentioning.
    */
    const dealer = lot.market !== 'online';
    const askingPrice = isNew
      ? Math.round((trim.price * (0.97 + 0.06 * unit(state, `${key}:price`))) / 100) * 100
      : Math.round(
          (vehicleValueOf(
            {
              model,
              trim,
              modelYear,
              condition,
              history: dealer ? history : 'patchy',
              accident: dealer ? accident : false,
            },
            year,
          ) *
            lot.markup *
            (0.96 + 0.08 * unit(state, `${key}:price`))) /
            100,
        ) * 100;
    listings.push({
      id: `car:${year}:${lot.id}:${slot}`,
      lotId: lot.id,
      lotName: lot.name,
      market: lot.market,
      modelId: model.id,
      trimId: trim.id,
      name: vehicleName(model, trim),
      bodyLabel: BODY_LABELS[model.body],
      modelYear,
      isNew,
      condition,
      askingPrice: Math.max(SCRAP_VALUE, askingPrice),
      blurb: model.blurb,
      history,
      accident,
      ...(defect ? { defect } : {}),
      inspectable: !isNew,
      accidentShown: dealer && !isNew,
    });
  }
  return listings.sort((a, b) => a.askingPrice - b.askingPrice);
}

export interface VehicleLotView {
  readonly lot: VehicleLot;
  readonly listings: readonly VehicleListing[];
}

/**
 * This year's lots in one market, cheapest first within each lot. A car the
 * character already bought is gone from its lot.
 */
export function vehicleLots(state: GameState, market: VehicleMarket): readonly VehicleLotView[] {
  if (state.player.age < SHOP_FROM_AGE) return [];
  const means = carMeansOf(state);
  if (market === 'luxury' && means < LUXURY_MEANS) return [];
  const owned = new Set(state.vehicles.map((vehicle) => vehicle.id));
  return VEHICLE_LOTS.filter((lot) => lot.market === market)
    .map((lot) => ({
      lot,
      listings: stockLot(state, lot, means).filter((listing) => !owned.has(listing.id)),
    }))
    .filter((view) => view.listings.length > 0);
}

/** Which markets this character can see at all. Luxury only behind the gate. */
export const openVehicleMarkets = (state: GameState): readonly VehicleMarket[] =>
  (['new', 'used', 'online', 'luxury'] as const).filter(
    (market) => vehicleLots(state, market).length > 0,
  );

export const findVehicleListing = (
  state: GameState,
  listingId: string,
): VehicleListing | undefined => {
  const lotId = listingId.split(':')[2];
  const lot = lotId ? findVehicleLot(lotId) : undefined;
  if (!lot) return undefined;
  return vehicleLots(state, lot.market)
    .flatMap((view) => view.listings)
    .find((listing) => listing.id === listingId);
};

/* -------------------------------------------------------------------------- */
/* Inspection                                                                  */
/* -------------------------------------------------------------------------- */

export interface InspectionView {
  readonly inspected: boolean;
  /** Known once inspected. */
  readonly history?: ServiceHistory;
  /** Known on a dealer's lot, and once inspected. */
  readonly accident?: boolean;
  /** Found by the inspection. Absent when it found nothing (or none was done). */
  readonly defect?: VehicleDefect;
  /** What the seller will take now. Lower than asked if the inspection found a problem. */
  readonly price: number;
}

/**
 * What the player knows about a listing. Before an inspection: the condition
 * they can see and, at a dealer, the accident report. After: the service
 * history, the accident record, and any fault — which the seller knocks off
 * the price, because a fault in writing is a fault they can no longer hide.
 */
export function inspectionOf(state: GameState, listing: VehicleListing): InspectionView {
  const inspected = (state.inspected ?? []).includes(listing.id);
  if (!inspected) {
    return {
      inspected: false,
      ...(listing.accidentShown ? { accident: listing.accident } : {}),
      price: listing.askingPrice,
    };
  }
  return {
    inspected: true,
    history: listing.history,
    accident: listing.accident,
    ...(listing.defect ? { defect: listing.defect } : {}),
    price: Math.max(SCRAP_VALUE, listing.askingPrice - (listing.defect?.cost ?? 0)),
  };
}

export type InspectError =
  'no-such-listing' | 'not-inspectable' | 'already-inspected' | 'cannot-afford';

export const INSPECT_ERROR_LABELS: Readonly<Record<InspectError, string>> = {
  'no-such-listing': "That car isn't for sale any more.",
  'not-inspectable': "It's new. There's nothing to inspect.",
  'already-inspected': "You've already had it looked at.",
  'cannot-afford': `An inspection is $${INSPECTION_FEE}, and you don't have it.`,
};

/** Pay a mechanic to look a used car over. Spec 1882. */
export function inspectVehicle(
  state: GameState,
  listingId: string,
): Result<{ readonly state: GameState; readonly view: InspectionView }, InspectError> {
  const listing = findVehicleListing(state, listingId);
  if (!listing) return err('no-such-listing');
  if (!listing.inspectable) return err('not-inspectable');
  if ((state.inspected ?? []).includes(listing.id)) return err('already-inspected');
  if (Number(state.player.cash) / 100 < INSPECTION_FEE) return err('cannot-afford');
  const books = post(state.finance, state.world.year, state.player.age, {
    category: 'vehicle',
    amount: dollars(-INSPECTION_FEE),
    source: `Inspection on a ${listing.modelYear} ${listing.name}`,
  });
  // Last year's ids can never match a listing again; keep only this year's.
  const thisYear = `car:${state.world.year}:`;
  const next: GameState = {
    ...state,
    finance: books.ledger,
    player: { ...state.player, cash: books.ledger.balance },
    inspected: [...(state.inspected ?? []).filter((id) => id.startsWith(thisYear)), listing.id],
  };
  return ok({ state: next, view: inspectionOf(next, listing) });
}

/* -------------------------------------------------------------------------- */
/* Buying                                                                      */
/* -------------------------------------------------------------------------- */

/** Every other payment a lender counts: loans, mortgages and the other cars. */
export function otherPaymentsOf(state: GameState, except?: string): number {
  const loans = state.loans.reduce((sum, loan) => {
    const product = findLoanProduct(loan.productId);
    if (!product) return sum;
    return sum + yearlyPaymentFor(product, Number(loan.balance) / 100, loan.termLeft);
  }, 0);
  const mortgages = state.homes.reduce((sum, home) => {
    if (!home.mortgage) return sum;
    const apr = findMortgageProduct(home.mortgage.productId)?.apr ?? 0.065;
    return (
      sum + mortgagePaymentFor(apr, Number(home.mortgage.balance) / 100, home.mortgage.termLeft)
    );
  }, 0);
  const cars = vehicleLoanPayments(state.vehicles.filter((vehicle) => vehicle.id !== except));
  return loans + mortgages + cars;
}

export function carBuyerOf(state: GameState, extraCash = 0, except?: string): CarBuyer {
  return {
    age: state.player.age,
    standing: standingFor(state).standing,
    income: incomeOf(state),
    cash: Math.floor(Number(state.player.cash) / 100) + extraCash,
    otherPayments: otherPaymentsOf(state, except),
  };
}

/** What a trade-in would bring in, after its own loan. Can be negative. */
export const tradeInValueOf = (vehicle: OwnedVehicle): number => vehicleSaleOf(vehicle).proceeds;

/** What the lender would say about this listing, today — with a trade-in if one is given. */
export function carLoanOfferFor(
  state: GameState,
  listing: VehicleListing,
  tradeInId?: string,
): CarLoanOffer {
  const tradeIn = tradeInId
    ? state.vehicles.find((vehicle) => vehicle.id === tradeInId)
    : undefined;
  const price = inspectionOf(state, listing).price;
  return carLoanFor(
    price,
    listing.isNew,
    carBuyerOf(state, tradeIn ? tradeInValueOf(tradeIn) : 0, tradeIn?.id),
  );
}

export type BuyVehicleError =
  | 'no-such-listing'
  | 'too-young'
  | 'cannot-afford'
  | 'loan-refused'
  | 'no-such-trade-in'
  | 'underwater';

export const BUY_VEHICLE_ERROR_LABELS: Readonly<Record<BuyVehicleError, string>> = {
  'no-such-listing': "That car isn't for sale any more.",
  'too-young': "You're too young to buy a car.",
  'cannot-afford': "You don't have enough to pay for it outright.",
  'loan-refused': 'The lender said no.',
  'no-such-trade-in': "You don't own that car any more.",
  underwater: "You owe more on it than it would fetch, and you don't have the difference.",
};

export interface BoughtVehicle {
  readonly state: GameState;
  readonly vehicle: OwnedVehicle;
  readonly entry: TimelineEntry;
}

function line(
  state: GameState,
  text: string,
  key: string,
  kind: 'milestone' | 'passive',
): TimelineEntry {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:${key}`,
    sequence,
  });
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** "a 2019 Hondo Civix LX", "a new Royata Camden SE", "a 1967 Fard Mestang '67 Fastback 289". */
function described(
  listing: { readonly modelYear: number; readonly name: string; readonly isNew?: boolean },
  classic = false,
): string {
  if (classic) return `a ${listing.name}`;
  if (listing.isNew) return `a new ${listing.name}`;
  return `a ${listing.modelYear} ${listing.name}`;
}

/** The short name a car is called by in the feed: "the Civix". */
export function shortNameOf(trimId: string): string {
  const found = findVehicleTrim(trimId);
  if (!found) return 'the car';
  const model = found.model.model.replace(/ '\d\d.*$/, '');
  return `the ${model}`;
}

/** The full name for screens: "2019 Hondo Civix LX". */
export function vehicleTitleOf(vehicle: OwnedVehicle): string {
  const found = findVehicleTrim(vehicle.trimId);
  if (!found) return 'A car';
  // Ticket 0505: a converted car carries the house's name, the way the real
  // ones do.
  const name = `${vehicleName(found.model, found.trim)}${hasTarbus(vehicle) ? ' Tarbus' : ''}`;
  return found.model.market === 'classic' ? name : `${vehicle.modelYear} ${name}`;
}

/**
 * Buy a listed car, outright or with the lender's instant answer. A trade-in,
 * if given, is sold to the dealer first and what it brings counts toward the
 * price.
 */
export function buyVehicle(
  state: GameState,
  listingId: string,
  how: 'cash' | 'loan',
  tradeInId?: string,
): Result<BoughtVehicle, BuyVehicleError> {
  const listing = findVehicleListing(state, listingId);
  if (!listing) return err('no-such-listing');
  if (state.player.age < SHOP_FROM_AGE) return err('too-young');
  const found = findVehicleTrim(listing.trimId);
  if (!found) return err('no-such-listing');

  let current = state;
  if (tradeInId) {
    const old = state.vehicles.find((vehicle) => vehicle.id === tradeInId);
    if (!old) return err('no-such-trade-in');
    const sold = sellVehicle(state, tradeInId, true);
    if (!sold.ok) return err('underwater');
    current = sold.value.state;
  }

  const view = inspectionOf(current, listing);
  const price = view.price;
  let paid = price;
  let loan: OwnedVehicle['loan'];
  if (how === 'loan') {
    const offer = carLoanFor(price, listing.isNew, carBuyerOf(current));
    if (!offer.approved || !offer.product) return err('loan-refused');
    paid = offer.down;
    loan = {
      productId: offer.product.id,
      principal: dollars(offer.principal),
      balance: dollars(offer.principal),
      termLeft: offer.product.termYears,
    };
  } else if (Number(current.player.cash) / 100 < price) {
    return err('cannot-afford');
  }

  const facts = {
    model: found.model,
    trim: found.trim,
    modelYear: listing.modelYear,
    condition: listing.condition,
    history: listing.history,
    accident: listing.accident,
  };
  const vehicle: OwnedVehicle = {
    id: listing.id,
    trimId: listing.trimId,
    modelYear: listing.modelYear,
    boughtYear: current.world.year,
    purchasePrice: dollars(price),
    value: dollars(vehicleValueOf(facts, current.world.year)),
    condition: listing.condition,
    history: listing.history,
    accident: listing.accident,
    ...(listing.defect
      ? { defect: { ...listing.defect, ...(view.inspected ? { known: true } : {}) } }
      : {}),
    ...(loan ? { loan } : {}),
    behindYears: 0,
  };

  const classic = found.model.market === 'classic';
  const books = post(current.finance, current.world.year, current.player.age, {
    category: 'property',
    amount: dollars(-paid),
    source: loan
      ? `Down payment on ${described(listing, classic)}`
      : `Bought ${described(listing, classic)}`,
  });

  const first = !current.player.records.some((record) =>
    record.label.startsWith('Bought a first car'),
  );
  const text = loan
    ? `Bought ${described(listing, classic)} for ${money(price)}, with ${money(paid)} down and the rest on finance.`
    : `Bought ${described(listing, classic)} for ${money(price)}.`;
  const entry = line(current, text, `car:bought:${listing.id}`, 'milestone');

  const next: GameState = {
    ...current,
    finance: books.ledger,
    vehicles: [...current.vehicles, vehicle],
    player: {
      ...current.player,
      cash: books.ledger.balance,
      timeline: appendToTimeline(current.player.timeline, entry),
      records: first
        ? appendRecord(
            current.player.records,
            stampRecord(
              {
                category: 'property',
                label: `Bought a first car — ${listing.name}`,
                referenceId: listing.trimId,
              },
              current.player.age,
              current.world.year,
            ),
          )
        : current.player.records,
    },
  };
  return ok({ state: next, vehicle, entry });
}

/* -------------------------------------------------------------------------- */
/* Selling                                                                     */
/* -------------------------------------------------------------------------- */

export type SellVehicleError = 'no-such-vehicle' | 'underwater';

export const SELL_VEHICLE_ERROR_LABELS: Readonly<Record<SellVehicleError, string>> = {
  'no-such-vehicle': "You don't own that car any more.",
  underwater: "You owe more on it than a dealer would pay, and you don't have the difference.",
};

export interface SoldVehicle {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  readonly proceeds: number;
}

/** Spec 1088's one Sell action: a dealer's offer, less what is still owed. */
export function sellVehicle(
  state: GameState,
  vehicleId: string,
  tradeIn = false,
): Result<SoldVehicle, SellVehicleError> {
  const vehicle = state.vehicles.find((candidate) => candidate.id === vehicleId);
  if (!vehicle) return err('no-such-vehicle');
  const sale = vehicleSaleOf(vehicle);
  if (sale.proceeds < 0 && Number(state.player.cash) / 100 < -sale.proceeds)
    return err('underwater');
  const title = vehicleTitleOf(vehicle);
  const books =
    sale.proceeds !== 0
      ? post(state.finance, state.world.year, state.player.age, {
          category: 'property',
          amount: dollars(sale.proceeds),
          source:
            sale.proceeds > 0
              ? `${tradeIn ? 'Traded in' : 'Sold'} the ${title}`
              : `Paid off the rest of the loan on the ${title}`,
        })
      : { ledger: state.finance };
  const name = shortNameOf(vehicle.trimId);
  const text = tradeIn
    ? `Traded in ${name}. ${sale.proceeds > 0 ? `It was worth ${money(sale.proceeds)} toward the next one.` : 'It was worth nothing after the loan.'}`
    : sale.repaid > 0
      ? `Sold ${name} to a dealer for ${money(sale.price)}. After the loan, ${money(sale.proceeds)} was yours.`
      : `Sold ${name} to a dealer for ${money(sale.price)}.`;
  const entry = line(state, text, `car:${tradeIn ? 'traded' : 'sold'}:${vehicle.id}`, 'passive');
  return ok({
    state: {
      ...state,
      finance: books.ledger,
      vehicles: state.vehicles.filter((candidate) => candidate.id !== vehicle.id),
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
    entry,
    proceeds: sale.proceeds,
  });
}

/* -------------------------------------------------------------------------- */
/* A year of owning                                                            */
/* -------------------------------------------------------------------------- */

export interface VehiclesYear {
  readonly vehicles: readonly OwnedVehicle[];
  readonly transactions: readonly NewTransaction[];
  readonly lines: readonly string[];
  /** Everything the cars cost this year, whole dollars. The living phase fits the rest around it. */
  readonly cost: number;
}

/**
 * The year of every car the character owns: wear, servicing and repairs (one
 * line, spec 179–182), the loan payment, and a car worn out past fixing going
 * to the scrapyard. Posted as committed outgoings with the mortgage.
 */
export function runVehiclesYear(
  vehicles: readonly OwnedVehicle[],
  year: number,
  seed: string,
): VehiclesYear {
  const transactions: NewTransaction[] = [];
  const lines: string[] = [];
  const next: OwnedVehicle[] = [];
  let cost = 0;
  for (const vehicle of vehicles) {
    const found = findVehicleTrim(vehicle.trimId);
    if (!found) {
      next.push(vehicle);
      continue;
    }
    const roll = (what: string) => mixedUnit(`${seed}:${vehicle.id}:${year}:${what}`);
    const result = vehicleYear(vehicle, found, year, {
      wear: roll('wear'),
      upkeep: roll('upkeep'),
      repair: roll('repair'),
      repairSize: roll('repair-size'),
      accident: roll('accident'),
    });
    const title = vehicleTitleOf(vehicle);
    const name = shortNameOf(vehicle.trimId);
    if (result.maintenance > 0) {
      transactions.push({
        category: 'vehicle',
        amount: dollars(-result.maintenance),
        source: `Maintenance and repairs on the ${title}`,
      });
    }
    if (result.payment > 0) {
      transactions.push({
        category: 'vehicle',
        amount: dollars(-result.payment),
        source: `Car payment on the ${title}`,
      });
    }
    cost += result.maintenance + result.payment;

    if (result.event === 'defect' && result.defect) {
      lines.push(
        vehicle.defect?.known
          ? `Had the ${result.defect.part} on ${name} fixed, like the inspection said it would need. ${money(result.defect.cost)}.`
          : `The ${result.defect.part} on ${name} went in the first year. ${money(result.defect.cost)}. The seller never said a word.`,
      );
    } else if (result.event === 'accident') {
      lines.push(
        `Somebody ran into ${name}. The insurance paid for most of it, not the ${money(1_000)} deductible.`,
      );
    } else if (result.event === 'repair' && result.repairCost >= 1_500) {
      lines.push(`${cap(name)} needed ${money(result.repairCost)} of work.`);
    }
    if (result.paidOff) lines.push(`Made the last payment on ${name}. It's yours.`);

    if (result.finished) {
      transactions.push({
        category: 'property',
        amount: dollars(SCRAP_VALUE),
        source: `Scrapped the ${title}`,
      });
      lines.push(
        `${cap(name)} finally gave out. A junkyard gave you ${money(SCRAP_VALUE)} for it.`,
      );
      continue;
    }
    next.push(result.vehicle);
  }
  return { vehicles: next, transactions, lines, cost };
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** After the books close: a short year puts every car with a loan a year behind. */
export const markVehiclesMissed = (
  vehicles: readonly OwnedVehicle[],
  short: boolean,
): readonly OwnedVehicle[] =>
  vehicles.map((vehicle) => ({
    ...vehicle,
    behindYears: short && vehicle.loan ? vehicle.behindYears + 1 : 0,
  }));

/**
 * A car `REPOSSESS_AFTER` years behind goes back to the lender, who sells it
 * at auction. Anything above what was owed comes back; a shortfall the
 * auction leaves is written off (see the 0504 write-up: a deficiency balance
 * is real, and is not modelled).
 */
export function repossess(state: GameState): GameState {
  let next = state;
  for (const vehicle of state.vehicles) {
    if (!vehicle.loan || vehicle.behindYears < REPOSSESS_AFTER) continue;
    const sale = vehicleSaleOf(vehicle, true);
    const books =
      sale.proceeds > 0
        ? post(next.finance, next.world.year, next.player.age, {
            category: 'property',
            amount: dollars(sale.proceeds),
            source: `What was left after the lender sold the ${vehicleTitleOf(vehicle)}`,
          })
        : { ledger: next.finance };
    const entry = line(
      next,
      `The lender took ${shortNameOf(vehicle.trimId)} back. You'd fallen behind on the payments.`,
      `car:taken:${vehicle.id}`,
      'milestone',
    );
    next = {
      ...next,
      finance: books.ledger,
      vehicles: next.vehicles.filter((candidate) => candidate.id !== vehicle.id),
      player: {
        ...next.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(next.player.timeline, entry),
      },
    };
  }
  return next;
}

/** An ordinary year's servicing on a car, whole dollars — for the screen. */
export function upkeepOf(vehicle: OwnedVehicle, year: number): number {
  const found = findVehicleTrim(vehicle.trimId);
  if (!found) return 0;
  // Ticket 0505: a tuned engine costs more to keep.
  return Math.round(
    maintenanceFor(
      found.model,
      found.trim,
      Math.max(0, year - vehicle.modelYear),
      vehicle.condition,
    ) * strainOf(vehicle),
  );
}

/* -------------------------------------------------------------------------- */
/* The question nobody asked (the sixth door)                                  */
/* -------------------------------------------------------------------------- */

/**
 * A car that came up.
 *
 * The same shape as the five doors before it, for the same measured reason:
 * every verb in this file sits behind the Vehicles screen, so a player who
 * answers what the game asks would walk for eighty years. About nine US
 * households in ten have a car.
 *
 * WHO IS ASKED. An adult with no car, or whose car is worn out or getting old,
 * who has an income or the cash. WHAT IS OFFERED. A car from the ordinary New
 * and Used lots priced near what people on that income actually pay — about a
 * third of a year's gross — that they can pay for outright and keep a cushion,
 * or that the lender approves. The old car, if there is one, is the trade-in.
 * It runs the real verb with the real lender, so it can still be refused.
 */
export const VEHICLE_EVENT_ID = 'vehicle.offer';
export const BUY_IT = 'yes';
export const NOT_THIS_YEAR = 'skip';
export const VEHICLE_OFFER_CHANCE = 0.35;
/** What people spend on a car, as a share of a year's gross income. */
export const CAR_PRICE_SHARE = 0.35;
/** A car past this age, or in poor shape, is one the game asks about replacing. */
/**
 * Not fourteen, which is what the first version used: reading played lives,
 * people were told a fourteen-year-old car in good shape was "on its last
 * legs" and traded in a $14,000 minivan. The average car on a US road is about
 * thirteen years old.
 */
export const REPLACE_FROM_AGE = 18;
export const REPLACE_BELOW_CONDITION = 40;
/** Months of living kept back when paying cash. */
export const CASH_CUSHION_MONTHS = 3;

/**
 * What the household earned this year — pay, a partner's pay, a pension, rent
 * — for pricing the car somebody would look at. Not `incomeOf`, which counts
 * every positive row: the year somebody sells a house or draws on their
 * retirement account is not the year they start shopping for a Bentlee.
 */
export function earnedIncomeOf(state: GameState): number {
  const earned = state.finance.transactions.filter(
    (entry) =>
      entry.year === state.world.year &&
      (entry.category === 'salary' ||
        entry.category === 'commission' ||
        // Ticket 0601: what a business paid its owner is earned.
        entry.category === 'business' ||
        entry.category === 'partner' ||
        entry.category === 'oddJob' ||
        entry.category === 'assetIncome'),
  );
  return Math.max(
    0,
    Math.round(earned.reduce((sum, entry) => sum + Number(entry.amount), 0) / 100),
  );
}

export const isVehicleOfferDecision = (eventId: string): boolean => eventId === VEHICLE_EVENT_ID;

function needsACar(state: GameState): OwnedVehicle | 'none' | undefined {
  if (state.vehicles.length === 0) return 'none';
  const year = state.world.year;
  const usable = state.vehicles.filter(
    (vehicle) =>
      year - vehicle.modelYear < REPLACE_FROM_AGE && vehicle.condition >= REPLACE_BELOW_CONDITION,
  );
  if (usable.length > 0) return undefined;
  // The one to trade in: the oldest, unless it is a classic someone collects.
  const ordinary = state.vehicles.filter(
    (vehicle) => findVehicleTrim(vehicle.trimId)?.model.market !== 'classic',
  );
  if (ordinary.length === 0) return undefined;
  return [...ordinary].sort((a, b) => a.modelYear - b.modelYear)[0];
}

export function withVehicleOffer(state: GameState, alive: boolean, livingCost: number): GameState {
  if (!alive) return state;
  if (hasSystemicOffer(state)) return state;
  if (state.player.age < DRIVE_FROM_AGE) return state;
  const need = needsACar(state);
  if (need === undefined) return state;
  if (!(unit(state, 'vehicle-offer:ask') < VEHICLE_OFFER_CHANCE)) return state;

  const income = earnedIncomeOf(state);
  const cash = Math.floor(Number(state.player.cash) / 100);
  if (income <= 0 && cash < 8_000) return state;
  const tradeIn = need === 'none' ? undefined : need;
  const tradeCash = tradeIn ? tradeInValueOf(tradeIn) : 0;
  if (tradeCash < 0 && cash < -tradeCash) return state;
  const target = Math.max(5_000, income > 0 ? income * CAR_PRICE_SHARE : cash * 0.3);
  const cushion = Math.round((livingCost * CASH_CUSHION_MONTHS) / 12);

  let best: { listing: VehicleListing; how: 'cash' | 'loan'; gap: number } | undefined;
  for (const market of ['used', 'new'] as const) {
    for (const view of vehicleLots(state, market)) {
      for (const listing of view.listings) {
        const price = inspectionOf(state, listing).price;
        if (price > target * 1.25 || price < target * 0.35) continue;
        let how: 'cash' | 'loan' | undefined;
        if (cash + tradeCash - price >= cushion) how = 'cash';
        else if (carLoanOfferFor(state, listing, tradeIn?.id).approved) how = 'loan';
        if (!how) continue;
        const gap = Math.abs(price - target);
        if (!best || gap < best.gap) best = { listing, how, gap };
      }
    }
  }
  if (!best) return state;

  const { listing } = best;
  const price = inspectionOf(state, listing).price;
  const where = listing.lotName;
  const what = described(listing);
  const worn = tradeIn !== undefined && tradeIn.condition < REPLACE_BELOW_CONDITION;
  const prompts = tradeIn
    ? worn
      ? [
          `${cap(shortNameOf(tradeIn.trimId))} is on its last legs. ${cap(where)} has ${what} for ${money(price)}, and they'd take yours as a trade-in.`,
          `Every trip in ${shortNameOf(tradeIn.trimId)} is a gamble now. There's ${what} at ${where} for ${money(price)}.`,
        ]
      : [
          `${cap(shortNameOf(tradeIn.trimId))} is ${state.world.year - tradeIn.modelYear} years old. ${cap(where)} has ${what} for ${money(price)}, and they'd take yours as a trade-in.`,
          `You've had ${shortNameOf(tradeIn.trimId)} a long time. There's ${what} at ${where} for ${money(price)}.`,
        ]
    : [
        `Getting around without a car is wearing thin. ${cap(where)} has ${what} for ${money(price)}${best.how === 'loan' ? ', and they would finance it' : ''}.`,
        `You keep looking at ${what} at ${where}. ${money(price)}${best.how === 'loan' ? ', with finance' : ''}.`,
      ];
  const offer: VehicleOffer = {
    listingId: listing.id,
    ...(tradeIn ? { tradeInId: tradeIn.id } : {}),
    how: best.how,
    age: state.player.age,
    eventId: VEHICLE_EVENT_ID,
  };
  const decision: PendingDecision = {
    eventId: VEHICLE_EVENT_ID,
    category: 'random',
    age: state.player.age,
    year: state.world.year,
    prompt: prompts[state.player.age % prompts.length] as string,
    choices: [
      { id: BUY_IT, label: tradeIn ? 'Trade up' : 'Buy it' },
      { id: NOT_THIS_YEAR, label: tradeIn ? 'Keep it going another year' : 'Not this year' },
    ],
    names: {},
  };
  return { ...state, vehicleOffer: offer, pending: [...state.pending, decision] };
}

export type VehicleOfferError = 'no-offer' | 'no-such-choice';

export function answerVehicleOffer(
  state: GameState,
  choiceId: string,
): Result<{ readonly state: GameState; readonly entry: TimelineEntry }, VehicleOfferError> {
  const offer = state.vehicleOffer;
  if (!offer) return err('no-offer');
  if (choiceId !== BUY_IT && choiceId !== NOT_THIS_YEAR) return err('no-such-choice');
  const cleared: GameState = {
    ...state,
    pending: state.pending.filter((candidate) => !isVehicleOfferDecision(candidate.eventId)),
  };
  delete (cleared as { vehicleOffer?: VehicleOffer }).vehicleOffer;

  const note = (text: string) => {
    const entry = line(cleared, text, 'car:offer', 'passive');
    return ok({
      state: {
        ...cleared,
        player: { ...cleared.player, timeline: appendToTimeline(cleared.player.timeline, entry) },
      },
      entry,
    });
  };
  if (choiceId === NOT_THIS_YEAR) {
    return note(
      offer.tradeInId
        ? 'Decided to keep the old car going a while longer.'
        : 'Looked at a car, and decided to wait.',
    );
  }
  const bought = buyVehicle(cleared, offer.listingId, offer.how, offer.tradeInId);
  if (!bought.ok) {
    // The lender, or the cash, may have changed since the question was asked.
    const fallback =
      offer.how === 'cash'
        ? undefined
        : buyVehicle(cleared, offer.listingId, 'cash', offer.tradeInId);
    if (fallback?.ok) return ok({ state: fallback.value.state, entry: fallback.value.entry });
    return note('Went to buy a car. The lender said no.');
  }
  return ok({ state: bought.value.state, entry: bought.value.entry });
}
