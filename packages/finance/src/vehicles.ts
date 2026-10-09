/**
 * Ticket 0504 — owning a vehicle.
 *
 * MEASURED FIRST (300 played lives, two disjoint seed sets): nobody in this
 * build had ever owned a car, at any age. Getting about was already paid for —
 * 0303's `SUBSISTENCE` names it ("somewhere to sleep, food, getting about, a
 * phone") — so a car was something the living bill bought invisibly and
 * nothing the Ownership screen could show.
 *
 * WHAT THIS FILE IS. Pure rules, no state and no randomness: what a car is
 * worth (spec 141: age, model, condition, a hidden service history, accident
 * history, rarity — and no mileage, anywhere), how it wears, what keeping it
 * running costs (spec 179–182: the loan payment and maintenance, and nothing
 * else — no fuel, no registration, no separate repair category), the car loans
 * and their instant approve/deny (spec 1329), and what selling one returns.
 * `simulation/vehicles.ts` decides when those things happen.
 *
 * PRICES ARE REAL-WORLD 2025 BANDS IN CONSTANT DOLLARS. This build has no
 * inflation (CORE_RULES 13.85), so a car's value only ever moves for the
 * reasons spec 141 names. A classic's collector price drifts up in real terms,
 * which is what classic-car indices have done over decades.
 */

import { cents, dollars, type Money } from '@yearafter/core';
import {
  findVehicleMod,
  type VehicleMod,
  type VehicleModSlot,
  type VehicleModel,
  type VehicleRetention,
  type VehicleTrim,
} from '@yearafter/content';
import type { CreditStanding } from './credit';
import { atLeast } from './credit';
import { mortgagePaymentFor } from './property';

/* -------------------------------------------------------------------------- */
/* Condition, service history, accidents                                       */
/* -------------------------------------------------------------------------- */

/**
 * Condition is a number underneath (0–100, wear accumulates in it smoothly) and
 * four words on screen. Spec 141 lists condition among what decides value; it
 * never asks for a score, and nothing shows the number.
 */
export type VehicleCondition = 'excellent' | 'good' | 'fair' | 'poor';

export const VEHICLE_CONDITION_LABELS: Readonly<Record<VehicleCondition, string>> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export const conditionLabelOf = (condition: number): VehicleCondition =>
  condition >= 80 ? 'excellent' : condition >= 60 ? 'good' : condition >= 40 ? 'fair' : 'poor';

/**
 * Spec 141's "hidden randomized service history". Hidden on a used listing
 * until somebody pays for an inspection; known on a car you own, because you
 * have the paperwork.
 */
export type ServiceHistory = 'full' | 'patchy' | 'none';

export const SERVICE_HISTORY_LABELS: Readonly<Record<ServiceHistory, string>> = {
  full: 'Full service records',
  patchy: 'Some service records',
  none: 'No service records',
};

/** What a used car's past looks like, across the market. */
export const HISTORY_SHARES: Readonly<Record<ServiceHistory, number>> = {
  full: 0.45,
  patchy: 0.4,
  none: 0.15,
};

export const historyFrom = (unit: number): ServiceHistory =>
  unit < HISTORY_SHARES.full
    ? 'full'
    : unit < HISTORY_SHARES.full + HISTORY_SHARES.patchy
      ? 'patchy'
      : 'none';

/** How fast a car wears for the way it has been looked after. */
export const HISTORY_WEAR: Readonly<Record<ServiceHistory, number>> = {
  full: 0.8,
  patchy: 1,
  none: 1.35,
};

/** What the paperwork is worth to the next buyer. */
export const HISTORY_PRICE: Readonly<Record<ServiceHistory, number>> = {
  full: 1.03,
  patchy: 1,
  none: 0.93,
};

/** A car that has been in an accident sells for less, whatever it looks like. */
export const ACCIDENT_PRICE = 0.85;

/* -------------------------------------------------------------------------- */
/* What a car is worth                                                         */
/* -------------------------------------------------------------------------- */

/**
 * A model's value as a share of its price new, by age, for an ordinary example.
 *
 * Age 0 is the year it was built: drive a new car off the lot and it is worth
 * less than you paid, which is the oldest fact about cars there is. The first
 * year takes the most; after that each year takes a share of what is left.
 * Benchmarked to five-year retention: a Royata keeps about 60%, an ordinary
 * car about half, a big German sedan about a third.
 */
export const RETENTION_CURVES: Readonly<
  Record<
    VehicleRetention,
    { readonly atZero: number; readonly atOne: number; readonly yearly: number }
  >
> = {
  strong: { atZero: 0.94, atOne: 0.86, yearly: 0.915 },
  average: { atZero: 0.91, atOne: 0.8, yearly: 0.88 },
  weak: { atZero: 0.88, atOne: 0.74, yearly: 0.84 },
  exotic: { atZero: 0.92, atOne: 0.85, yearly: 0.92 },
};

/**
 * Spec 1387: "select collector/exotic cars can appreciate". A collectible
 * model stops falling at `COLLECTIBLE_TROUGH` years and gains in real terms
 * after that; a classic is already past it.
 */
export const COLLECTIBLE_TROUGH = 12;
export const COLLECTIBLE_GAIN = 0.02;
/** Classic prices are today's (2025) and drift up in real terms from there. */
export const CLASSIC_PRICE_YEAR = 2025;
export const CLASSIC_DRIFT = 0.015;

/** Nothing with wheels is worth less than the scrapyard pays. */
export const SCRAP_VALUE = 400;

export function retainedShare(
  retention: VehicleRetention,
  age: number,
  collectible = false,
): number {
  const curve = RETENTION_CURVES[retention];
  const at = (years: number): number =>
    years <= 0 ? curve.atZero : curve.atOne * curve.yearly ** (years - 1);
  if (collectible && age > COLLECTIBLE_TROUGH) {
    return at(COLLECTIBLE_TROUGH) * (1 + COLLECTIBLE_GAIN) ** (age - COLLECTIBLE_TROUGH);
  }
  return at(age);
}

/**
 * The condition an ordinary car of this age is in. Value is read against
 * this, so a car in the shape you'd expect is worth the curve, a cherished one
 * more and a tired one less.
 */
export function expectedCondition(age: number, classic = false): number {
  if (classic) return 75;
  let condition = 100;
  for (let year = 0; year < age; year += 1) condition -= baseWear(year);
  return Math.max(0, condition);
}

const baseWear = (age: number): number => 1.5 + 0.3 * Math.min(age, 15);

export interface VehicleFacts {
  readonly model: VehicleModel;
  readonly trim: VehicleTrim;
  readonly modelYear: number;
  readonly condition: number;
  readonly history: ServiceHistory;
  readonly accident: boolean;
}

/** What a car is worth this year, whole dollars. One derivation, for every screen. */
export function vehicleValueOf(facts: VehicleFacts, worldYear: number): number {
  const classic = facts.model.market === 'classic';
  const age = Math.max(0, worldYear - facts.modelYear);
  const base = classic
    ? facts.trim.price * (1 + CLASSIC_DRIFT) ** (worldYear - CLASSIC_PRICE_YEAR)
    : facts.trim.price * retainedShare(facts.model.retention, age, facts.model.collectible);
  const shape = Math.max(
    0.4,
    1 + (0.5 * (facts.condition - expectedCondition(age, classic))) / 100,
  );
  const value = base * shape * HISTORY_PRICE[facts.history] * (facts.accident ? ACCIDENT_PRICE : 1);
  return Math.max(SCRAP_VALUE, Math.round(value / 50) * 50);
}

/* -------------------------------------------------------------------------- */
/* Owning one                                                                  */
/* -------------------------------------------------------------------------- */

export interface VehicleLoan {
  readonly productId: string;
  readonly principal: Money;
  readonly balance: Money;
  /** Years of payments left. */
  readonly termLeft: number;
}

/** Ticket 0505. One modification on one car: what it was, what was paid, when. */
export interface FittedMod {
  readonly modId: string;
  /** Whole dollars paid. */
  readonly cost: number;
  /** The world year it was fitted — its share of the value depreciates from here. */
  readonly year: number;
}

/**
 * Spec 1088's vehicle record: brand, model and variant (through the trim),
 * year, purchase price, condition, value, financing, modifications (0505) and
 * the hidden service history.
 */
export interface OwnedVehicle {
  /** The listing it was bought from: `car:<year>:<lot>:<slot>`. Stable forever. */
  readonly id: string;
  readonly trimId: string;
  readonly modelYear: number;
  readonly boughtYear: number;
  readonly purchasePrice: Money;
  /** What it is worth now, recomputed each year by `vehicleValueOf`. */
  readonly value: Money;
  /** 0–100. Shown as four words. */
  readonly condition: number;
  readonly history: ServiceHistory;
  readonly accident: boolean;
  /**
   * A hidden issue the seller did not mention (spec 1329, 1882). It comes out
   * in the first year of owning the car, as a repair bill. Absent on almost
   * every car.
   */
  readonly defect?: VehicleDefect;
  readonly loan?: VehicleLoan;
  /** Years in a row the household ended short while there was a loan on it. */
  readonly behindYears: number;
  /** Ticket 0505. What has been fitted. Absent on a standard car. */
  readonly mods?: readonly FittedMod[];
  /** P11: extra preventive work, paid once; protects the next annual advance only. */
  readonly service?: { readonly year: number; readonly cost: number };
}

/** P11: annual renewal targets 5–10 extra median years, not a lifespan guarantee.
 * Classics already wear slowly; their measured multiplier preserves that model.
 * The price is extra work beyond the unchanged ordinary maintenance bill.
 */
export const SERVICE_WEAR = 0.63;
export const CLASSIC_SERVICE_WEAR = 0.75;
export const SERVICE_REPAIR = 0.8;
export const SERVICE_PRICE_SHARE = 0.5;
export const SERVICE_MINIMUM = 100;

export function preventiveServiceCost(
  vehicle: OwnedVehicle,
  facts: { readonly model: VehicleModel; readonly trim: VehicleTrim },
  worldYear: number,
): number {
  const upkeep =
    maintenanceFor(
      facts.model,
      facts.trim,
      Math.max(0, worldYear + 1 - vehicle.modelYear),
      vehicle.condition,
    ) * strainOf(vehicle);
  return Math.max(SERVICE_MINIMUM, Math.round((upkeep * SERVICE_PRICE_SHARE) / 10) * 10);
}

export interface VehicleDefect {
  readonly part: string;
  /** Whole dollars to put right. */
  readonly cost: number;
  /** Found by an inspection before the car was bought, and priced in. */
  readonly known?: boolean;
}

export const EMPTY_VEHICLES: readonly OwnedVehicle[] = [];

/**
 * What a hidden issue is, by the kind of car. Ordinary words, the kind a
 * mechanic says across a counter.
 */
export function defectFor(
  model: VehicleModel,
  trim: VehicleTrim,
  partUnit: number,
  sizeUnit: number,
): VehicleDefect {
  const parts = model.electric
    ? ['battery pack', 'charging system', 'drive unit']
    : model.market === 'luxury' || model.market === 'exotic'
      ? ['air suspension', 'transmission', 'timing chain', 'electrics']
      : ['transmission', 'head gasket', 'turbo', 'rusted subframe', 'electrics'];
  const part = parts[Math.min(parts.length - 1, Math.floor(partUnit * parts.length))] as string;
  const reference = Math.min(trim.price, 400_000);
  const cost = Math.round(((900 + reference * 0.06) * (0.7 + 0.8 * sizeUnit)) / 50) * 50;
  return { part, cost };
}

/** Wear in a year of owning: more as it ages, more if it was neglected. */
export function wearFor(
  model: VehicleModel,
  age: number,
  history: ServiceHistory,
  unit: number,
): number {
  const base = model.market === 'classic' ? 0.8 : baseWear(age);
  return base * HISTORY_WEAR[history] * model.reliability * (0.7 + 0.6 * unit);
}

/**
 * Spec 179–182: maintenance and repairs are ONE thing. A year's servicing, by
 * the kind of car, its age and how reliable that model is, with a little
 * year-to-year wobble. A new car is mostly under warranty; an old one is not.
 */
export const MAINTENANCE_RATE: Readonly<Record<VehicleModel['market'], number>> = {
  mainstream: 0.013,
  luxury: 0.015,
  exotic: 0.016,
  classic: 0.015,
};

export function maintenanceFor(
  model: VehicleModel,
  trim: VehicleTrim,
  age: number,
  condition: number,
  unit = 0.5,
): number {
  const reference = Math.min(trim.price, 600_000);
  const base = 400 + reference * MAINTENANCE_RATE[model.market];
  const ageFactor = model.market === 'classic' ? 1.2 : Math.min(1.8, 0.6 + 0.07 * age);
  const tired = condition < 40 ? 1.25 : 1;
  return Math.round((base * ageFactor * model.reliability * tired * (0.85 + 0.3 * unit)) / 10) * 10;
}

/** The chance of a big repair in a year, and what one costs. */
export const repairChanceFor = (model: VehicleModel, age: number): number =>
  Math.min(0.22, 0.06 + 0.01 * age) * model.reliability;

export function repairCostFor(trim: VehicleTrim, unit: number): number {
  const reference = Math.min(trim.price, 400_000);
  return Math.round(((500 + reference * 0.04) * (0.6 + unit)) / 50) * 50;
}

/** A crash: the insurance (part of living costs) pays, the deductible doesn't. */
export const ACCIDENT_CHANCE = 0.03;
export const DEDUCTIBLE = 1_000;
export const ACCIDENT_WEAR = 15;

/** Below this it is not worth fixing, and it goes to the scrapyard. */
export const SCRAPPED_BELOW = 8;

export interface VehicleYearRolls {
  readonly wear: number;
  readonly upkeep: number;
  readonly repair: number;
  readonly repairSize: number;
  readonly accident: number;
}

export interface VehicleYearResult {
  readonly vehicle: OwnedVehicle;
  /** Servicing and repairs together, whole dollars. Includes a hidden issue coming out, and a deductible. */
  readonly maintenance: number;
  /** The year's loan payment, whole dollars. */
  readonly payment: number;
  readonly paidOff: boolean;
  /** What happened, for the feed. At most one of these. */
  readonly event?: 'defect' | 'repair' | 'accident';
  readonly defect?: VehicleDefect;
  readonly repairCost: number;
  /** Worn out: the caller scraps it. */
  readonly finished: boolean;
}

export const findAutoLoanProduct = (id: string): AutoLoanProduct | undefined =>
  AUTO_LOAN_PRODUCTS.find((product) => product.id === id);

/**
 * A year of owning one car: it wears, it is serviced, something may go wrong,
 * the loan is paid, and it is worth what a car of that age and shape is worth.
 */
export function vehicleYear(
  vehicle: OwnedVehicle,
  facts: { readonly model: VehicleModel; readonly trim: VehicleTrim },
  worldYear: number,
  rolls: VehicleYearRolls,
): VehicleYearResult {
  const { model, trim } = facts;
  const age = Math.max(0, worldYear - vehicle.modelYear);
  const serviced = vehicle.service?.year === worldYear - 1;
  const wearMultiplier = serviced
    ? model.market === 'classic'
      ? CLASSIC_SERVICE_WEAR
      : SERVICE_WEAR
    : 1;
  let condition =
    vehicle.condition - wearFor(model, age, vehicle.history, rolls.wear) * wearMultiplier;
  // Ticket 0505: a tune and an engine upgrade work a car harder; better
  // brakes and a Tarbus conversion keep it out of trouble.
  const strain = strainOf(vehicle);
  let maintenance = Math.round(
    maintenanceFor(model, trim, age, vehicle.condition, rolls.upkeep) * strain,
  );
  let event: VehicleYearResult['event'];
  let repairCost = 0;
  let accident = vehicle.accident;
  const defect = vehicle.defect;

  if (defect) {
    // The seller's secret, out in the first year.
    event = 'defect';
    repairCost = defect.cost;
  } else if (rolls.accident < ACCIDENT_CHANCE * gripOf(vehicle)) {
    event = 'accident';
    repairCost = DEDUCTIBLE;
    condition -= ACCIDENT_WEAR;
    accident = true;
  } else if (
    rolls.repair <
    repairChanceFor(model, age) * strain * (serviced ? SERVICE_REPAIR : 1)
  ) {
    event = 'repair';
    repairCost = repairCostFor(trim, rolls.repairSize);
  }
  maintenance += repairCost;
  condition = Math.max(0, Math.min(100, condition));

  let loan = vehicle.loan;
  let payment = 0;
  let paidOff = false;
  if (loan) {
    const apr = findAutoLoanProduct(loan.productId)?.apr ?? 0.09;
    const balance = Number(loan.balance) / 100;
    const interest = Math.round(balance * apr);
    payment = Math.min(balance + interest, mortgagePaymentFor(apr, balance, loan.termLeft));
    const after = Math.max(0, Math.round(balance + interest - payment));
    if (after <= 0) {
      paidOff = true;
      loan = undefined;
    } else {
      loan = { ...loan, balance: dollars(after), termLeft: Math.max(1, loan.termLeft - 1) };
    }
  }

  const value = vehicleWorthOf({ ...vehicle, condition, accident }, facts, worldYear);
  const next: OwnedVehicle = {
    ...vehicle,
    condition: Math.round(condition * 10) / 10,
    accident,
    value: dollars(value),
  };
  delete (next as { defect?: VehicleDefect }).defect;
  if (loan) (next as { loan?: VehicleLoan }).loan = loan;
  else delete (next as { loan?: VehicleLoan }).loan;

  return {
    vehicle: next,
    maintenance,
    payment,
    paidOff,
    ...(event ? { event } : {}),
    ...(defect ? { defect } : {}),
    repairCost,
    finished: condition < SCRAPPED_BELOW && !loan,
  };
}

/**
 * Spec 20: "open a car to see that car's monthly cost". The loan payment and
 * an ordinary year's servicing, a month at a time. Repairs are not in it — a
 * monthly figure that included a surprise would be a forecast, not a cost.
 */
export function monthlyCostOf(
  vehicle: OwnedVehicle,
  facts: { readonly model: VehicleModel; readonly trim: VehicleTrim },
  worldYear: number,
): number {
  const age = Math.max(0, worldYear - vehicle.modelYear);
  const upkeep = Math.round(
    maintenanceFor(facts.model, facts.trim, age, vehicle.condition) * strainOf(vehicle),
  );
  const loan = vehicle.loan;
  const payment = loan
    ? mortgagePaymentFor(
        findAutoLoanProduct(loan.productId)?.apr ?? 0.09,
        Number(loan.balance) / 100,
        loan.termLeft,
      )
    : 0;
  return Math.round((upkeep + payment) / 12);
}

/* -------------------------------------------------------------------------- */
/* Ticket 0505 — modifications                                                 */
/* -------------------------------------------------------------------------- */

/*
  MEASURED FIRST: no car in the build could be changed at all. Across the two
  0504 samples (300 lives, about 1,200 cars bought), 92% were mainstream, 8%
  luxury, none exotic or classic; median purchase $22,000. So a modification
  has to be priced for a $12,000 Hondo and a $300,000 Ferrano both — forged
  wheels are not one price — and nothing here is something the game does for
  anybody. Modifying a car is the player's choice; no door asks.
*/

/** Reference prices a mod's band is anchored to: its low and high ends. */
export const MOD_PRICE_FLOOR = 20_000;
export const MOD_PRICE_CEILING = 400_000;

/**
 * What a modification costs on this car, whole dollars. A band is read on the
 * log of the car's reference price, so a Royata pays the low end, a Ferrano
 * the high end and a $90,000 RBW somewhere sensible between. Tarbus is a share
 * of the car instead.
 */
export function modPriceOf(mod: VehicleMod, trim: VehicleTrim): number {
  if (mod.priceShare !== undefined) return Math.round((trim.price * mod.priceShare) / 500) * 500;
  const [low, high] = mod.price;
  const position = Math.max(
    0,
    Math.min(
      1,
      Math.log(trim.price / MOD_PRICE_FLOOR) / Math.log(MOD_PRICE_CEILING / MOD_PRICE_FLOOR),
    ),
  );
  return Math.round((low + position * (high - low)) / 50) * 50;
}

export type ModRefusal = 'notForThisCar' | 'coveredByTarbus' | 'alreadyFitted';

export const MOD_REFUSAL_LABELS: Readonly<Record<ModRefusal, string>> = {
  notForThisCar: "That isn't something this car can have.",
  coveredByTarbus: 'Tarbus already did that.',
  alreadyFitted: "It's already got that.",
};

/** Whether this modification can go on this car, and why not if it can't. */
export function modRefusalFor(
  mod: VehicleMod,
  model: VehicleModel,
  vehicle: OwnedVehicle,
): ModRefusal | undefined {
  if (mod.slot === 'tarbus' && !model.tarbus) return 'notForThisCar';
  if (mod.combustionOnly && model.electric) return 'notForThisCar';
  if (mod.luxuryOnly && model.market === 'mainstream') return 'notForThisCar';
  const fitted = vehicle.mods ?? [];
  if (fitted.some((entry) => entry.modId === mod.id)) return 'alreadyFitted';
  const covered = new Set<VehicleModSlot>(
    fitted.flatMap((entry) => findModIn(entry.modId)?.covers ?? []),
  );
  if (covered.has(mod.slot)) return 'coveredByTarbus';
  return undefined;
}

const findModIn = (id: string): VehicleMod | undefined => findVehicleMod(id);

/**
 * Fit one. Anything already in the same slot comes off (paint and a wrap share
 * one), and a conversion that covers other slots takes off whatever was in
 * them — Tarbus fits its own wheels and exhaust.
 */
export function withMod(
  vehicle: OwnedVehicle,
  mod: VehicleMod,
  cost: number,
  year: number,
): OwnedVehicle {
  const clears = new Set<VehicleModSlot>([mod.slot, ...(mod.covers ?? [])]);
  const kept = (vehicle.mods ?? []).filter((entry) => {
    const fitted = findModIn(entry.modId);
    return fitted === undefined || !clears.has(fitted.slot);
  });
  return { ...vehicle, mods: [...kept, { modId: mod.id, cost, year }] };
}

/** Collectors pay most for an original car: each modification on a classic takes this off. */
export const CLASSIC_MOD_PENALTY = 0.04;

/**
 * What a car is worth with what has been fitted to it, whole dollars. The one
 * derivation every screen and the estate read (CORE_RULES 13.23).
 *
 * A modification adds `recovery` of its cost the day it is fitted, and that
 * part depreciates with the car from then on: forged wheels on a five-year-old
 * car are worth what forged wheels on a ten-year-old car are worth five years
 * later. On a classic it is the other way round: nothing is recovered, and
 * every change makes it less original.
 */
export function vehicleWorthOf(
  vehicle: OwnedVehicle,
  facts: { readonly model: VehicleModel; readonly trim: VehicleTrim },
  worldYear: number,
): number {
  const { model, trim } = facts;
  const base = vehicleValueOf(
    {
      model,
      trim,
      modelYear: vehicle.modelYear,
      condition: vehicle.condition,
      history: vehicle.history,
      accident: vehicle.accident,
    },
    worldYear,
  );
  const mods = vehicle.mods ?? [];
  if (mods.length === 0) return base;
  if (model.market === 'classic') {
    const original = (1 - CLASSIC_MOD_PENALTY) ** mods.length;
    return Math.max(SCRAP_VALUE, Math.round((base * original) / 50) * 50);
  }
  const share = (year: number) =>
    retainedShare(model.retention, Math.max(0, year - vehicle.modelYear), model.collectible);
  const added = mods.reduce((sum, entry) => {
    const mod = findModIn(entry.modId);
    if (!mod) return sum;
    return sum + entry.cost * mod.recovery * (share(worldYear) / share(entry.year));
  }, 0);
  return Math.max(SCRAP_VALUE, Math.round((base + added) / 50) * 50);
}

/** How much harder the fitted modifications work the car. */
export const strainOf = (vehicle: OwnedVehicle): number =>
  (vehicle.mods ?? []).reduce(
    (product, entry) => product * (findModIn(entry.modId)?.strain ?? 1),
    1,
  );

/** How much the fitted modifications cut the chance of a crash. */
export const gripOf = (vehicle: OwnedVehicle): number =>
  (vehicle.mods ?? []).reduce((product, entry) => product * (findModIn(entry.modId)?.grip ?? 1), 1);

export const hasTarbus = (vehicle: OwnedVehicle): boolean =>
  (vehicle.mods ?? []).some((entry) => findModIn(entry.modId)?.slot === 'tarbus');

/* -------------------------------------------------------------------------- */
/* Car loans                                                                   */
/* -------------------------------------------------------------------------- */

export interface AutoLoanProduct {
  readonly id: string;
  readonly name: string;
  readonly lender: string;
  /** Nominal, like the mortgages — see roadmap finding 14. */
  readonly apr: number;
  readonly termYears: number;
  readonly minDown: number;
  readonly needs: CreditStanding;
  readonly maxPrincipal: number;
  /** Only for a car in its first model year. */
  readonly newOnly: boolean;
}

/**
 * Three products, for the three answers a dealer's finance office gives.
 *
 * Rates are the 2025 US averages by credit tier (Experian): about 7% on a new
 * car for a decent borrower, 11% on a used one, and high teens for somebody
 * with poor or no credit — who can still get one, which is the real shape of
 * the market and the way most people's first car is bought. Six years on a new
 * car, five on a used one, the ordinary terms now.
 */
export const AUTO_LOAN_PRODUCTS: readonly AutoLoanProduct[] = [
  {
    id: 'auto.new',
    name: 'New car finance',
    lender: 'Keystone Auto Finance',
    apr: 0.069,
    termYears: 6,
    minDown: 0.1,
    needs: 'fair',
    maxPrincipal: 150_000,
    newOnly: true,
  },
  {
    id: 'auto.used',
    name: 'Used car loan',
    lender: 'Keystone Auto Finance',
    apr: 0.11,
    termYears: 5,
    minDown: 0.1,
    needs: 'fair',
    maxPrincipal: 100_000,
    newOnly: false,
  },
  {
    id: 'auto.second-chance',
    name: 'Second-chance auto loan',
    lender: 'Roadway Credit',
    apr: 0.169,
    termYears: 5,
    minDown: 0.15,
    needs: 'none',
    maxPrincipal: 35_000,
    newOnly: false,
  },
];

/** A car payment above this share of gross income, and the lender says no. */
export const CAR_PAYMENT_CEILING = 0.2;
/** Every loan payment together, against income. */
export const CAR_DEBT_CEILING = 0.5;
export const DRIVE_FROM_AGE = 18;
/** What a buyer keeps back rather than putting down. */
export const CAR_KEEP_IN_HAND = 1_500;
/** What a buyer puts down when they can, before a bigger deposit stops helping. */
export const CAR_TARGET_DOWN = 0.2;

export interface CarBuyer {
  readonly age: number;
  readonly standing: CreditStanding;
  /** Gross, whole dollars a year. */
  readonly income: number;
  readonly cash: number;
  /** Every other loan and mortgage payment, whole dollars a year. */
  readonly otherPayments: number;
}

export type CarLoanRefusal =
  'tooYoung' | 'noIncome' | 'deposit' | 'income' | 'standing' | 'tooLarge';

export const CAR_LOAN_REFUSAL_LABELS: Readonly<Record<CarLoanRefusal, string>> = {
  tooYoung: "You're too young to borrow for a car.",
  noIncome: 'No lender will finance a car with no income behind it.',
  deposit: "You don't have enough for the down payment.",
  income: 'The payments would be too much against what you earn.',
  standing: "Your credit isn't good enough for this loan.",
  tooLarge: "No lender finances a car this expensive. It's cash only.",
};

export interface CarLoanOffer {
  readonly approved: boolean;
  readonly because?: CarLoanRefusal;
  readonly product?: AutoLoanProduct;
  readonly down: number;
  readonly principal: number;
  readonly yearlyPayment: number;
}

/**
 * Spec 1329 / 1858: financing is instant approve or deny. The product and the
 * deposit are the lender's answer, not a form: the best rate this buyer
 * qualifies for, the deposit they can sensibly spare up to a fifth.
 */
export function carLoanFor(price: number, isNew: boolean, buyer: CarBuyer): CarLoanOffer {
  const none = { approved: false, down: 0, principal: 0, yearlyPayment: 0 } as const;
  if (buyer.age < DRIVE_FROM_AGE) return { ...none, because: 'tooYoung' };
  if (buyer.income <= 0) return { ...none, because: 'noIncome' };
  const spare = Math.max(0, buyer.cash - CAR_KEEP_IN_HAND);
  let closest: CarLoanRefusal | undefined;
  let fits = false;
  for (const product of AUTO_LOAN_PRODUCTS) {
    if (product.newOnly && !isNew) continue;
    const floor = Math.ceil(price * product.minDown);
    const down = Math.max(floor, Math.min(Math.round(price * CAR_TARGET_DOWN), spare));
    const principal = price - down;
    if (principal > product.maxPrincipal) continue;
    fits = true;
    if (!atLeast(buyer.standing, product.needs)) continue;
    if (down > buyer.cash) {
      closest ??= 'deposit';
      continue;
    }
    const yearlyPayment = mortgagePaymentFor(product.apr, principal, product.termYears);
    if (
      yearlyPayment > buyer.income * CAR_PAYMENT_CEILING ||
      yearlyPayment + buyer.otherPayments > buyer.income * CAR_DEBT_CEILING
    ) {
      closest ??= 'income';
      continue;
    }
    return { approved: true, product, down, principal, yearlyPayment };
  }
  return { ...none, because: closest ?? (fits ? 'standing' : 'tooLarge') };
}

/* -------------------------------------------------------------------------- */
/* Selling                                                                     */
/* -------------------------------------------------------------------------- */

/** A dealer buys at a margin under what it is worth. */
export const TRADE_IN = 0.88;
/** A lender selling a repossessed car at auction gets less. */
export const REPOSSESSED_SALE = 0.7;
/**
 * Two short years in a row with a loan on it and the lender takes the car.
 *
 * Not one: a car payment is a committed outgoing, posted before the living
 * bill, so a "short" year here is a year the household could not cover its
 * own spending — not a year the lender went unpaid. Measured at one, 12% of
 * financed cars were repossessed, several times the real rate.
 */
export const REPOSSESS_AFTER = 2;

export interface VehicleSale {
  /** What it fetched, whole dollars. */
  readonly price: number;
  /** What went to the lender. */
  readonly repaid: number;
  /** What is left for the seller. Negative when they owe more than it fetched. */
  readonly proceeds: number;
}

export function vehicleSaleOf(vehicle: OwnedVehicle, forced = false): VehicleSale {
  const price = Math.round((Number(vehicle.value) / 100) * (forced ? REPOSSESSED_SALE : TRADE_IN));
  const owed = vehicle.loan ? Math.round(Number(vehicle.loan.balance) / 100) : 0;
  return { price, repaid: Math.min(owed, forced ? price : owed), proceeds: price - owed };
}

/* -------------------------------------------------------------------------- */
/* Totals, for the estate                                                      */
/* -------------------------------------------------------------------------- */

export const vehiclesValue = (vehicles: readonly OwnedVehicle[]): Money =>
  cents(vehicles.reduce((sum, vehicle) => sum + Number(vehicle.value), 0));

export const vehicleLoansOwed = (vehicles: readonly OwnedVehicle[]): Money =>
  cents(vehicles.reduce((sum, vehicle) => sum + Number(vehicle.loan?.balance ?? 0), 0));

/** Every car loan's payment this year, whole dollars — for any other lender's debt test. */
export const vehicleLoanPayments = (vehicles: readonly OwnedVehicle[]): number =>
  vehicles.reduce((sum, vehicle) => {
    if (!vehicle.loan) return sum;
    const apr = findAutoLoanProduct(vehicle.loan.productId)?.apr ?? 0.09;
    return sum + mortgagePaymentFor(apr, Number(vehicle.loan.balance) / 100, vehicle.loan.termLeft);
  }, 0);

/** Inspection, for a used car (spec 1882: "optional inspection can reveal/reduce uncertainty"). */
export const INSPECTION_FEE = 200;
