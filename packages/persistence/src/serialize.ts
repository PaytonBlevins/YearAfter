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
    pending: save.pending,
  });
}
