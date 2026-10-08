/** P2 — one household choice; annual living is still the only writer of its bill. */
import { err, ok, type Result } from '@yearafter/core';
import { costIndexOf } from '@yearafter/content';
import { childrenAtHome } from '@yearafter/parenting';
import { householdPartnerOf } from '@yearafter/social';
import {
  annualExpenseOf,
  isLifestyleTier,
  livingCostFor,
  vehicleLoanPayments,
  type LifestyleTier,
} from '@yearafter/finance';
import type { GameState } from './game-state';
import { CHARGED_FROM_AGE } from './phases/living';
import { residenceOf } from './rentals';
import { mortgageLineOf } from './homes';
import { upkeepOf } from './vehicles';

export type LifestyleError = 'too-young' | 'not-alive' | 'pending-choice' | 'unknown-tier';
export const LIFESTYLE_ERROR_LABELS: Readonly<Record<LifestyleError, string>> = {
  'too-young': "You can choose how you live when you're 18.",
  'not-alive': 'This life has ended.',
  'pending-choice': 'Answer the waiting question first.',
  'unknown-tier': "That lifestyle isn't available.",
};

export function setLifestyle(
  state: GameState,
  tier: LifestyleTier,
): Result<GameState, LifestyleError> {
  if (!state.player.alive) return err('not-alive');
  if (state.player.age < CHARGED_FROM_AGE) return err('too-young');
  if (state.pending.length > 0) return err('pending-choice');
  if (!isLifestyleTier(tier)) return err('unknown-tier');
  if (state.household.lifestyle === tier) return ok(state);
  // No money, mood, time or RNG changes here: switching cannot farm a reward.
  return ok({ ...state, household: { ...state.household, lifestyle: tier } });
}

/**
 * An estimate at today's remembered standard, family, location and ordinary
 * commitments, not a forecast of next year's income, repairs or hardship.
 * Shares the actual living calculator; taxes and separate bills stay outside.
 */
export function livingEstimateFor(state: GameState, lifestyle: LifestyleTier): number {
  if (state.player.age < CHARGED_FROM_AGE) return 0;
  const home = residenceOf(state.homes);
  const vehicleCost =
    vehicleLoanPayments(state.vehicles) +
    state.vehicles.reduce((sum, vehicle) => sum + upkeepOf(vehicle, state.world.year), 0);
  return livingCostFor({
    standard: state.household.standard,
    lifestyle,
    locationIndex: costIndexOf(state.player.currentLocation.cityId),
    partnered: householdPartnerOf(state.circle.people) !== undefined,
    childAges: childrenAtHome(state.family, state.world.year).map(
      (child) => state.world.year - child.birthYear,
    ),
    housing: home
      ? 'owned'
      : state.household.housing === 'owned'
        ? 'ownPlace'
        : state.household.housing,
    housingCost: home ? annualExpenseOf(home) + (mortgageLineOf(home)?.payment ?? 0) : 0,
    ownsVehicle: state.vehicles.length > 0,
    vehicleCost,
  }).total;
}
