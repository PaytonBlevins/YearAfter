/**
 * Ticket 0505 — vehicle modifications.
 *
 * Spec 184's list and nothing else: wheels, paint, a few wraps, tint, exhaust,
 * intake, suspension, an engine tune, brakes and engine upgrades. Spec 1885:
 * "a fictional elite luxury modifier analogous in role to Brabus" — Tarbus,
 * for the cars it converts. Spec 1387: "most modifications recover only part
 * of cost at resale".
 *
 * The rules (what a mod costs on this car, what it adds to the car's worth,
 * what it does to upkeep and the chance of a crash) live in
 * `@yearafter/finance`'s `vehicles.ts`. This is the verb, and the list the
 * screen shows.
 *
 * A PLAYER'S CHOICE, NOT A DOOR. Unlike the six doors, nothing here asks
 * anybody: modifying a car is something a few people choose to spend money on,
 * and a game that did it for the passive population would be choosing a hobby
 * for them.
 */

import {
  payPurchase,
  paymentNote,
  PAYMENT_REFUSAL_LABELS,
  type PurchasePayment,
  type PaymentRefusal,
} from '@yearafter/finance';

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  VEHICLE_MODS,
  VEHICLE_MOD_SLOTS,
  findVehicleMod,
  findVehicleTrim,
  type VehicleMod,
  type VehicleModSlot,
} from '@yearafter/content';
import { dollars, err, ok, type Result } from '@yearafter/core';
import {
  modPriceOf,
  modRefusalFor,
  vehicleWorthOf,
  withMod,
  type ModRefusal,
  type OwnedVehicle,
} from '@yearafter/finance';
import type { GameState } from './game-state';
import { vehicleTitleOf } from './vehicles';

export interface ModOption {
  readonly mod: VehicleMod;
  /** Whole dollars, on this car. */
  readonly price: number;
  /** What the car would be worth the day it went on, whole dollars. */
  readonly worthAfter: number;
  /** Why it can't be fitted, if it can't. */
  readonly refusal?: ModRefusal;
}

export interface ModSlotView {
  readonly slot: VehicleModSlot;
  /** What is fitted in this slot now, if anything. */
  readonly fitted?: VehicleMod;
  readonly options: readonly ModOption[];
}

/**
 * Every slot this car can do something in, with what is fitted and what could
 * be. A slot with nothing this car can ever have — Tarbus on a Hondo, an
 * exhaust on a Teslo — is left out rather than shown full of refusals.
 */
export function modSlotsFor(state: GameState, vehicleId: string): readonly ModSlotView[] {
  const vehicle = state.vehicles.find((candidate) => candidate.id === vehicleId);
  if (!vehicle) return [];
  const found = findVehicleTrim(vehicle.trimId);
  if (!found) return [];
  const fitted = (vehicle.mods ?? [])
    .map((entry) => findVehicleMod(entry.modId))
    .filter((mod): mod is VehicleMod => mod !== undefined);
  const views: ModSlotView[] = [];
  for (const slot of VEHICLE_MOD_SLOTS) {
    const options = VEHICLE_MODS.filter((mod) => mod.slot === slot)
      .map((mod): ModOption => {
        const price = modPriceOf(mod, found.trim);
        const refusal = modRefusalFor(mod, found.model, vehicle);
        const worthAfter = vehicleWorthOf(
          withMod(vehicle, mod, price, state.world.year),
          found,
          state.world.year,
        );
        return { mod, price, worthAfter, ...(refusal ? { refusal } : {}) };
      })
      .filter((option) => option.refusal !== 'notForThisCar');
    if (options.length === 0) continue;
    const here = fitted.find((mod) => mod.slot === slot);
    views.push({ slot, ...(here ? { fitted: here } : {}), options });
  }
  return views;
}

export type FitModError =
  | 'no-such-vehicle'
  | 'no-such-mod'
  | 'not-for-this-car'
  | 'covered-by-tarbus'
  | 'already-fitted'
  | 'cannot-afford'
  | PaymentRefusal;

export const FIT_MOD_ERROR_LABELS: Readonly<Record<FitModError, string>> = {
  ...PAYMENT_REFUSAL_LABELS,
  'no-such-vehicle': "You don't own that car any more.",
  'no-such-mod': "That isn't something a shop can fit.",
  'not-for-this-car': "That isn't something this car can have.",
  'covered-by-tarbus': 'Tarbus already did that.',
  'already-fitted': "It's already got that.",
  'cannot-afford': "You don't have the money for that.",
};

const REFUSAL_ERRORS: Readonly<Record<ModRefusal, FitModError>> = {
  notForThisCar: 'not-for-this-car',
  coveredByTarbus: 'covered-by-tarbus',
  alreadyFitted: 'already-fitted',
};

export interface FittedModOutcome {
  readonly state: GameState;
  readonly vehicle: OwnedVehicle;
  readonly entry: TimelineEntry;
  readonly price: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Pay a shop to fit a modification. Cash only — nobody lends against a set of
 * wheels — and spending, not a transfer: what the car is worth more for it
 * shows up in the car's value, which is all of it that is still money.
 */
export function fitVehicleMod(
  state: GameState,
  vehicleId: string,
  modId: string,
  payment: PurchasePayment = { kind: 'cash' },
): Result<FittedModOutcome, FitModError> {
  const vehicle = state.vehicles.find((candidate) => candidate.id === vehicleId);
  if (!vehicle) return err('no-such-vehicle');
  const mod = findVehicleMod(modId);
  if (!mod) return err('no-such-mod');
  const found = findVehicleTrim(vehicle.trimId);
  if (!found) return err('no-such-vehicle');
  const refusal = modRefusalFor(mod, found.model, vehicle);
  if (refusal) return err(REFUSAL_ERRORS[refusal]);
  const price = modPriceOf(mod, found.trim);
  if (payment.kind === 'cash' && Number(state.player.cash) / 100 < price)
    return err('cannot-afford');

  const title = vehicleTitleOf(vehicle);
  const paid = payPurchase(
    state.finance,
    state.cards,
    state.world.year,
    state.player.age,
    dollars(price),
    'vehicle',
    `${mod.name} on the ${title}`,
    payment,
  );
  if (!paid.ok) return err(paid.error);
  const books = paid.value;
  const changed = withMod(vehicle, mod, price, state.world.year);
  const next: OwnedVehicle = {
    ...changed,
    value: dollars(vehicleWorthOf(changed, found, state.world.year)),
  };
  const text =
    mod.slot === 'tarbus'
      ? `Sent the ${title} to Tarbus. It came back with their engine, their wheels and their badge. ${money(price)}.`
      : `Had ${mod.name.toLowerCase()} fitted to the ${title}. ${money(price)}.`;
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'passive',
    text: text + paymentNote(payment),
    id: `t:${state.world.year}:car:mod:${vehicle.id}:${mod.id}`,
    sequence,
  });
  return ok({
    state: {
      ...state,
      finance: books.ledger,
      cards: books.cards,
      vehicles: state.vehicles.map((candidate) => (candidate.id === vehicle.id ? next : candidate)),
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
    vehicle: next,
    entry,
    price,
  });
}
