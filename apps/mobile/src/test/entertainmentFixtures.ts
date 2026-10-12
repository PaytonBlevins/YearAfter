/**
 * Ticket 0809 — states for the sports, acting, music, modeling and racing screen tests.
 *
 * Built by spreading fields onto a real adult, never by reaching into the engines' private
 * state, so a field that stops being a field fails to compile here instead of passing by luck.
 */

import { dollars } from '@yearafter/core';
import { post } from '@yearafter/finance';
import {
  openBusiness,
  type ActingState,
  type GameState,
  type ModelingState,
  type MusicState,
  type PastCareer,
  type SportCareer,
} from '@yearafter/simulation';
import { ADULT, withCash } from './fameFixtures';

export { ADULT, withCash };

export const at = (state: GameState, age: number): GameState => ({
  ...state,
  player: { ...state.player, age },
});

export const withCareer = (state: GameState, career: Partial<SportCareer> = {}): GameState => ({
  ...state,
  sports: {
    ...state.sports,
    career: {
      sportId: 'basketball',
      stage: 'pro',
      startedAge: 14,
      seasons: 6,
      hardSeasons: 2,
      form: 70,
      trainedAtAge: -1,
      trainedCount: 0,
      reputation: 40,
      titles: 0,
      team: 'Harbor City Gulls',
      tier: 'starter',
      proSeasons: 4,
      contract: { salary: 2_400_000, yearsLeft: 3, rookie: false },
      ...career,
    },
  },
});

export const withPast = (state: GameState, past: readonly PastCareer[]): GameState => ({
  ...state,
  sports: { ...state.sports, past },
});

export const withActing = (state: GameState, over: Partial<ActingState>): GameState => ({
  ...state,
  acting: { ...state.acting, ...over },
});

export const withMusic = (state: GameState, over: Partial<MusicState>): GameState => ({
  ...state,
  music: { ...state.music, ...over },
});

export const withModeling = (state: GameState, over: Partial<ModelingState>): GameState => ({
  ...state,
  modeling: { ...state.modeling, ...over },
});

/** A rich adult who runs one racing team. */
export function withRacingTeam(state: GameState = ADULT): { state: GameState; id: string } {
  const rich = withBookedCash(state, 5_000_000);
  const opened = openBusiness(rich, 'biz.racing');
  if (!opened.ok) throw new Error(`could not open a racing team: ${String(opened.error)}`);
  const business = opened.value.state.businesses.find((row) => row.typeId === 'biz.racing');
  if (!business) throw new Error('no racing team after opening one');
  return { state: opened.value.state, id: business.id };
}

export const dollarsOf = (amount: number) => dollars(amount);

/**
 * More money, the way the game gives it: a gift through the ledger, so the books still balance
 * when the year is played. `withCash` is for states that are only looked at, never advanced.
 */
export function withBookedCash(state: GameState, amount: number): GameState {
  const posted = post(state.finance, state.world.year, state.player.age, {
    category: 'gift',
    amount: dollars(amount),
    source: 'A windfall',
  });
  return {
    ...state,
    finance: posted.ledger,
    player: { ...state.player, cash: posted.ledger.balance },
  };
}
