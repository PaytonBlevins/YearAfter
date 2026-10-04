/**
 * Ticket 0504 — the vehicles a character can buy, and the lots that sell them.
 *
 * Authored by `scripts/generate-vehicles.py`. A listing is generated from a
 * trim each year rather than stored, so this is a table of what exists — 247
 * trims across 104 models and 28 brands — not a list of cars. Logic depends on
 * the ids, the market and the numbers, never on the names (spec 1456: the
 * names are recognisable fictional analogues, subject to legal review).
 */

import vehiclesData from '../data/vehicles.json';
import modsData from '../data/vehicle-mods.json';

export type VehicleBody =
  'sedan' | 'hatch' | 'suv' | 'truck' | 'minivan' | 'coupe' | 'convertible' | 'wagon' | 'van';

export const BODY_LABELS: Readonly<Record<VehicleBody, string>> = {
  sedan: 'Sedan',
  hatch: 'Hatchback',
  suv: 'SUV',
  truck: 'Pickup',
  minivan: 'Minivan',
  coupe: 'Coupe',
  convertible: 'Convertible',
  wagon: 'Wagon',
  van: 'Van',
};

/**
 * Where a model is sold new. `mainstream` is the ordinary lots; `luxury` the
 * Luxury lots new and the ordinary used lots once older; `exotic` and
 * `classic` only ever the Luxury lots.
 */
export type VehicleMarketTier = 'mainstream' | 'luxury' | 'exotic' | 'classic';

/** How a model holds its value. See `retainedShare` in `@yearafter/finance`. */
export type VehicleRetention = 'strong' | 'average' | 'weak' | 'exotic';

export interface VehicleTrim {
  readonly id: string;
  readonly name: string;
  /**
   * Whole dollars. New: the reference price new. Classic: what a collector
   * pays for one in good condition today.
   */
  readonly price: number;
}

export interface VehicleModel {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly body: VehicleBody;
  readonly market: VehicleMarketTier;
  readonly retention: VehicleRetention;
  /** Maintenance and trouble, as a multiple. 1.0 is ordinary; lower is better. */
  readonly reliability: number;
  readonly electric: boolean;
  /** Stops falling with age and starts rising (spec 1387). */
  readonly collectible: boolean;
  /** A classic's model year. Absent for anything sold new. */
  readonly year?: number;
  /** Ticket 0505. The elite modifier house converts this model (spec 1885). */
  readonly tarbus?: boolean;
  readonly trims: readonly VehicleTrim[];
  readonly blurb: string;
}

/** Spec 1329 / 1877's four markets, as a player sees them. */
export type VehicleMarket = 'new' | 'used' | 'online' | 'luxury';

export const VEHICLE_MARKETS: readonly VehicleMarket[] = ['new', 'used', 'online', 'luxury'];

export const VEHICLE_MARKET_LABELS: Readonly<Record<VehicleMarket, string>> = {
  new: 'New',
  used: 'Used',
  online: 'Online',
  luxury: 'Luxury',
};

export interface VehicleLot {
  readonly id: string;
  readonly name: string;
  readonly market: VehicleMarket;
  /** Cars on the lot in a year. */
  readonly size: number;
  /** Which tiers it stocks. */
  readonly markets: readonly VehicleMarketTier[];
  /** Model years back from this one, inclusive. [0, 0] is a new-car lot. */
  readonly age: readonly [number, number];
  /** On top of what the car is worth. Below 1 is a private seller's discount. */
  readonly markup: number;
  /** Spec 1387: hidden issues stay uncommon. Online is the riskiest. */
  readonly defectChance: number;
  readonly blurb: string;
}

interface VehicleCatalogFile {
  readonly version: number;
  readonly lots: readonly VehicleLot[];
  /** Models, called `entries` like every catalog the validator reads. */
  readonly entries: readonly VehicleModel[];
}

const catalog = vehiclesData as unknown as VehicleCatalogFile;

export const VEHICLE_MODELS: readonly VehicleModel[] = catalog.entries;
export const VEHICLE_LOTS: readonly VehicleLot[] = catalog.lots;
export const VEHICLE_CATALOG_VERSION = catalog.version;

const MODELS_BY_ID = new Map(VEHICLE_MODELS.map((model) => [model.id, model]));
const TRIMS_BY_ID = new Map(
  VEHICLE_MODELS.flatMap((model) => model.trims.map((trim) => [trim.id, { model, trim }] as const)),
);
const LOTS_BY_ID = new Map(VEHICLE_LOTS.map((lot) => [lot.id, lot]));

export const findVehicleModel = (id: string): VehicleModel | undefined => MODELS_BY_ID.get(id);
export const findVehicleTrim = (
  id: string,
): { readonly model: VehicleModel; readonly trim: VehicleTrim } | undefined => TRIMS_BY_ID.get(id);
export const findVehicleLot = (id: string): VehicleLot | undefined => LOTS_BY_ID.get(id);

/** "Royata Camden SE". */
export const vehicleName = (model: VehicleModel, trim: VehicleTrim): string =>
  model.trims.length === 1 && model.market === 'classic'
    ? `${model.brand} ${model.model}`
    : `${model.brand} ${model.model} ${trim.name}`;

/** Every trim in the catalog — the number spec 1703 counts. */
export const VEHICLE_TRIM_COUNT = VEHICLE_MODELS.reduce(
  (sum, model) => sum + model.trims.length,
  0,
);

/* -------------------------------------------------------------------------- */
/* Ticket 0505 — modifications                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Spec 184's list and nothing else. One option per slot on a car; paint and a
 * wrap share `finish`. `tarbus` is the elite modifier house (spec 1885).
 */
export type VehicleModSlot =
  | 'wheels'
  | 'finish'
  | 'tint'
  | 'exhaust'
  | 'intake'
  | 'suspension'
  | 'ecu'
  | 'brakes'
  | 'engine'
  | 'tarbus';

export const VEHICLE_MOD_SLOTS: readonly VehicleModSlot[] = [
  'wheels',
  'finish',
  'tint',
  'exhaust',
  'intake',
  'suspension',
  'ecu',
  'brakes',
  'engine',
  'tarbus',
];

export const VEHICLE_MOD_SLOT_LABELS: Readonly<Record<VehicleModSlot, string>> = {
  wheels: 'Wheels',
  finish: 'Paint and wraps',
  tint: 'Tint',
  exhaust: 'Exhaust',
  intake: 'Intake',
  suspension: 'Suspension',
  ecu: 'Engine tune',
  brakes: 'Brakes',
  engine: 'Engine',
  tarbus: 'Tarbus',
};

export interface VehicleMod {
  readonly id: string;
  readonly slot: VehicleModSlot;
  readonly name: string;
  /** Whole dollars on a $20,000 car and on a $400,000 car. */
  readonly price: readonly [number, number];
  /** Instead of a band: a share of the car's reference price (Tarbus). */
  readonly priceShare?: number;
  /** What the car is worth more for it, as a share of the cost, the day it is fitted. */
  readonly recovery: number;
  /** Multiplies a year's maintenance and the chance of a big repair. */
  readonly strain: number;
  /** Multiplies the chance of an accident. */
  readonly grip: number;
  readonly combustionOnly: boolean;
  readonly luxuryOnly: boolean;
  /** Slots this one fills too, so nothing else can be fitted in them. */
  readonly covers?: readonly VehicleModSlot[];
  readonly blurb: string;
}

const modCatalog = modsData as unknown as { readonly version: number; readonly entries: readonly VehicleMod[] };

export const VEHICLE_MODS: readonly VehicleMod[] = modCatalog.entries;

const MODS_BY_ID = new Map(VEHICLE_MODS.map((mod) => [mod.id, mod]));

export const findVehicleMod = (id: string): VehicleMod | undefined => MODS_BY_ID.get(id);
