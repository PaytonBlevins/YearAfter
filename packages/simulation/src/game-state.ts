/**
 * The live game state and the year-advance loop.
 *
 * PROTECTED CONTRACT (spec 1060–1066): time advancement.
 *
 * `GameState` is the in-memory shape the simulation operates on. The save file
 * is a serialised projection of it (@yearafter/persistence). Keeping the two
 * separate is what stops save concerns from leaking into game logic.
 */

import type { Character } from '@yearafter/character';
import { Rng } from './rng/rng';

/** World state that outlives any single character (spec 818–827 continuation). */
export interface WorldState {
  /** In-world calendar year. */
  readonly year: number;
  /** Increments each time the player continues as a descendant. */
  readonly generation: number;
}

export interface GameState {
  readonly world: WorldState;
  readonly player: Character;
  /** Live RNG registry. Serialised into the save on every write. */
  readonly rng: Rng;
}

export const createWorldState = (year: number, generation = 1): WorldState => ({
  year,
  generation,
});

export const createGameState = (world: WorldState, player: Character, rng: Rng): GameState => ({
  world,
  player,
  rng,
});
