/**
 * Ticket 0605 — private deals on the character: the contract.
 *
 * The functions the store calls. Signatures are final for the screens; bodies
 * marked STUB are filled in by the engine commit. Offers are DERIVED from the
 * seed and the year, so nothing about them is saved; only deals made are.
 */

import { err, type Result } from '@yearafter/core';
import { DEAL_KINDS } from '@yearafter/content';
import { dealOffersFor, type DealOffer, type DealRefusal } from '@yearafter/finance';
import type { GameState } from './game-state';
import { liquidOf } from './businesses';

/** The deals this person could make this year. Adults only (spec 912's age). */
export function dealMarket(state: GameState): readonly DealOffer[] {
  return dealOffersFor({
    seed: state.rng.getSeed(),
    year: state.world.year,
    age: state.player.age,
    liquid: liquidOf(state),
    market: state.market,
    held: state.deals,
    kinds: DEAL_KINDS,
  });
}

/** Write a cheque. Money leaves cash at once; the deal is held until it matures. */
export function placeInDeal(
  _state: GameState,
  _offerId: string,
  _amount: number,
): Result<GameState, DealRefusal> {
  // STUB (contract commit).
  return err({ kind: 'notBuilt' });
}

/** Sell a deal on before it matures, at a discount, where its kind allows. */
export function sellDealEarly(_state: GameState, _dealId: string): Result<GameState, DealRefusal> {
  // STUB (contract commit).
  return err({ kind: 'notBuilt' });
}
