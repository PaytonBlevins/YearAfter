/**
 * GameState <-> SaveGameV1.
 *
 * The only difference between the two is the RNG: the live state holds an `Rng`
 * registry, the save holds its serialised snapshot. Everything else is already
 * plain data, which is why the simulation uses immutable records throughout.
 */

import { Rng, createGameState, type GameState } from '@yearafter/simulation';
import type { SaveId } from '@yearafter/core';
import {
  CURRENT_SAVE_VERSION,
  DEFAULT_SETTINGS,
  type CurrentSaveGame,
  type SaveSettings,
} from './save-schema';

export interface ToSaveOptions {
  readonly id: SaveId;
  readonly settings?: SaveSettings;
  readonly createdAt?: number;
  readonly updatedAt?: number;
}

export function toSave(state: GameState, options: ToSaveOptions): CurrentSaveGame {
  const now = Date.now();
  return {
    version: CURRENT_SAVE_VERSION,
    id: options.id,
    rng: state.rng.snapshot(),
    world: state.world,
    player: state.player,
    family: state.family,
    nameCultureId: state.nameCultureId,
    events: state.events,
    pending: state.pending,
    education: state.education,
    circle: state.circle,
    parenting: state.parenting,
    employment: state.employment,
    health: state.health,
    finance: state.finance,
    household: state.household,
    cards: state.cards,
    loans: state.loans,
    portfolio: state.portfolio,
    market: state.market,
    prices: state.prices,
    /*
      THE TWO OFFERS, AND WHY LEAVING THEM OUT BRICKED SAVES (Ticket 0406).

      `pending` has been serialized since 0402 and the offer BEHIND a pending
      decision never was. So a save written while a career or college offer was
      on the table reloaded with the question still in the queue and nothing to
      answer it with: `answerOffer`/`answerCollegeOffer` look up
      `state.offer`/`state.collegeOffer`, find nothing, and return `no-offer`,
      so `decide` returns an error and the buttons do nothing. `advanceYear`
      refuses to advance while `pending` is non-empty, so the character could
      not be aged either — a permanently stuck save, reported as "this is stuck
      on the screen every time I reset it".

      It was invisible for two tickets because every test answers its decisions
      in the same process that raised them. Nothing round-tripped a save with a
      question open. `roundTripsAnOpenOffer` in the persistence tests does now.
    */
    ...(state.offer !== undefined ? { offer: state.offer } : {}),
    ...(state.collegeOffer !== undefined ? { collegeOffer: state.collegeOffer } : {}),
    // Ticket 0410 makes it three. Added here in the same breath as the field
    // itself, because the bug above cost a player a save and the lesson is that
    // a decision's payload is part of the decision.
    ...(state.lifeOffer !== undefined ? { lifeOffer: state.lifeOffer } : {}),
    // Ticket 0416, four. Same breath as the field, same reason.
    ...(state.pursuitOffer !== undefined ? { pursuitOffer: state.pursuitOffer } : {}),
    // Ticket 0501, the fifth, in the same breath as the field.
    homes: state.homes,
    ...(state.homeOffer !== undefined ? { homeOffer: state.homeOffer } : {}),
    // Ticket 0504, the sixth, in the same breath as the field.
    vehicles: state.vehicles,
    ...(state.vehicleOffer !== undefined ? { vehicleOffer: state.vehicleOffer } : {}),
    ...(state.inspected !== undefined && state.inspected.length > 0
      ? { inspected: state.inspected }
      : {}),
    // Ticket 0506, the seventh, in the same breath as the field.
    valuables: state.valuables,
    ...(state.renovationOffer !== undefined ? { renovationOffer: state.renovationOffer } : {}),
    // Ticket 0507. The diary is what stops a fourth visit and a second bid.
    ...(state.auctions !== undefined ? { auctions: state.auctions } : {}),
    // Ticket 0601, the eighth, in the same breath as the field.
    businesses: state.businesses,
    // Ticket 0605, the ninth, in the same breath as the field.
    deals: state.deals,
    // Omitted entirely when nobody is hired, which is what every other optional
    // field in this document does and what the migration relies on.
    ...(state.advisorId !== undefined ? { advisorId: state.advisorId } : {}),
    retirement: state.retirement,
    settings: options.settings ?? DEFAULT_SETTINGS,
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
  };
}

export function fromSave(save: CurrentSaveGame): GameState {
  return createGameState(save.world, save.player, Rng.restore(save.rng), {
    family: save.family,
    nameCultureId: save.nameCultureId,
    events: save.events,
    education: save.education,
    circle: save.circle,
    parenting: save.parenting,
    employment: save.employment,
    health: save.health ?? { conditions: [], vitality: save.player.stats.health, deficit: 0 },
    finance: save.finance,
    household: save.household,
    cards: save.cards,
    loans: save.loans,
    portfolio: save.portfolio,
    market: save.market,
    prices: save.prices,
    ...(save.advisorId !== undefined ? { advisorId: save.advisorId } : {}),
    ...(save.offer !== undefined ? { offer: save.offer } : {}),
    ...(save.collegeOffer !== undefined ? { collegeOffer: save.collegeOffer } : {}),
    ...(save.lifeOffer !== undefined ? { lifeOffer: save.lifeOffer } : {}),
    ...(save.pursuitOffer !== undefined ? { pursuitOffer: save.pursuitOffer } : {}),
    homes: save.homes,
    ...(save.homeOffer !== undefined ? { homeOffer: save.homeOffer } : {}),
    vehicles: save.vehicles,
    ...(save.vehicleOffer !== undefined ? { vehicleOffer: save.vehicleOffer } : {}),
    ...(save.inspected !== undefined ? { inspected: save.inspected } : {}),
    valuables: save.valuables,
    ...(save.renovationOffer !== undefined ? { renovationOffer: save.renovationOffer } : {}),
    ...(save.auctions !== undefined ? { auctions: save.auctions } : {}),
    businesses: save.businesses,
    deals: save.deals,
    retirement: save.retirement,
    pending: save.pending,
  });
}
