/**
 * Ticket 0708 — states for the fame and creator tests.
 *
 * Every roll in the engine is a fixed draw by `world.generation` (CORE_RULES: derived, not
 * saved), so a test that needs a particular roll sweeps the generation until it comes up. The
 * sweeps throw when nothing is found, so a fixture that stops finding its case fails loudly
 * and does not turn the test that uses it into a vacuous pass (13.126).
 */

import { dollars } from '@yearafter/core';
import { newChannel, type Channel } from '@yearafter/finance';
import {
  advanceYear,
  collabOffers,
  createNewGame,
  decide,
  encounterFor,
  fameOffers,
  groupOffers,
  sponsorOffers,
  type GameState,
} from '@yearafter/simulation';

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const d = next.pending[0]!;
    const r = decide(next, d.eventId, d.choices[0]!.id);
    if (!r.ok) break;
    next = r.value.state;
  }
  return next;
}

export function liveTo(seed: string, age: number): GameState {
  let state = createNewGame({ seed });
  let guard = 0;
  while (state.player.alive && state.player.age < age && (guard += 1) < 80) {
    state = answerEverything(advanceYear(state).state);
  }
  return state;
}

/** The same character holding exactly this many dollars. */
export const withCash = (state: GameState, amount: number): GameState => {
  const balance = dollars(amount);
  return {
    ...state,
    finance: { ...state.finance, balance },
    player: { ...state.player, cash: balance },
  };
};

export const withFame = (state: GameState, fame: number): GameState => ({ ...state, fame });
export const atGeneration = (state: GameState, generation: number): GameState => ({
  ...state,
  world: { ...state.world, generation },
});

export const channelOf = (
  id: string,
  audience: number,
  platformId = 'video',
  categoryId = 'comedy',
  over: Partial<Channel> = {},
): Channel => ({
  ...newChannel({ seed: 'fame-ui', id, platformId, categoryId, year: 2050 }),
  audience,
  peak: audience,
  ...over,
});

/** The first generation, from 0, for which `found` holds. */
export function sweep(
  state: GameState,
  found: (trial: GameState) => boolean,
  upTo = 3000,
): GameState {
  for (let generation = 0; generation < upTo; generation += 1) {
    const trial = atGeneration(state, generation);
    if (found(trial)) return trial;
  }
  throw new Error('the sweep found nothing');
}

/** Every generation up to a limit for which `found` holds, as states. */
export function sweepAll(
  state: GameState,
  found: (trial: GameState) => boolean,
  upTo = 400,
): readonly GameState[] {
  const hits: GameState[] = [];
  for (let generation = 0; generation < upTo; generation += 1) {
    const trial = atGeneration(state, generation);
    if (found(trial)) hits.push(trial);
  }
  return hits;
}

export const ADULT = liveTo('fame-ui-adult', 26);

export const offeringWork = (state: GameState, id: string): GameState =>
  sweep(state, (trial) => fameOffers(trial).some((offer) => offer.def.id === id));
/**
 * Sponsors, collaborations and groups are drawn from the seed, the year and the channel's id, not
 * the generation, so a channel is found by trying ids: the first one for which `found` holds.
 */
export function withChannelThat(
  state: GameState,
  make: (id: string) => readonly Channel[],
  found: (trial: GameState) => boolean,
  upTo = 800,
): GameState {
  for (let i = 0; i < upTo; i += 1) {
    const trial = { ...state, channels: make(`ch:2050:video:t${i}`) };
    if (found(trial)) return trial;
  }
  throw new Error('no channel found');
}

const big = (id: string): readonly Channel[] => [channelOf(id, 250_000)];
export const withSponsor = (state: GameState): GameState =>
  withChannelThat(state, big, (trial) => sponsorOffers(trial).length > 0);
export const withCollab = (state: GameState): GameState =>
  withChannelThat(state, big, (trial) => collabOffers(trial).length > 0);
export const withGroup = (state: GameState): GameState =>
  withChannelThat(state, big, (trial) => groupOffers(trial).length > 0);
export const withMeeting = (state: GameState): GameState =>
  sweep(state, (trial) => encounterFor(trial) !== undefined);
