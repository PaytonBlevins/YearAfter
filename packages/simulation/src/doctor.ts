/**
 * Ticket 0211 — the one lever the player has over their own body.
 *
 * Spec 531 and 1165 remove routine health maintenance BY NAME: *"preventive
 * routine care should matter little/mostly backend and must not become chores"*,
 * and routine health-maintenance chores are listed among the things simplified
 * away by v0.2. That is a hard constraint on this file, and it rules out most of
 * what a health screen usually is.
 *
 * So there are exactly two verbs.
 *
 *   SEE A DOCTOR — once a year, worth a few points of recovery and a chance of
 *   catching something. Small on purpose: a check-up worth ten points would make
 *   skipping it a mistake, and a button you are punished for not pressing every
 *   January for eighty years is precisely the chore the spec removes.
 *
 *   START TREATMENT — put a doctor on one condition. Yearly rather than
 *   one-off, so `treated` is a flag that keeps paying out rather than a purchase
 *   with an immediate result. A player who goes once and stops is not being
 *   treated.
 *
 * There is no fitness regime, no diet, no screening schedule and no insurance.
 * Those are all chores, and spec 1974 removes body-condition management by name.
 */

import { err, ok, type Result } from '@yearafter/core';
import { CHECKUP_CATCHES, findCondition } from '@yearafter/health';
import type { GameState } from './game-state';
import { RngDomains } from './rng/rng';

export type DoctorError =
  | 'already-seen'
  /** Nothing to treat, or not a condition this character has. */
  | 'no-such-condition'
  | 'already-treated';

export const DOCTOR_ERROR_LABELS: Readonly<Record<DoctorError, string>> = {
  'already-seen': 'You have been this year.',
  'no-such-condition': 'That is not something you have.',
  'already-treated': 'Somebody is already on that one.',
};

export interface DoctorOutcome {
  readonly state: GameState;
  /** What to tell the player, in the popup they pressed for (CORE_RULES 13.27). */
  readonly title: string;
  readonly body: string;
  readonly good: boolean;
}

/** Whether the yearly visit is still available. */
export const canSeeDoctor = (state: GameState): boolean =>
  state.health.checkedAtAge !== state.player.age;

/**
 * See a doctor.
 *
 * The recovery itself is applied by the health phase on the next Advance — this
 * only records that the visit happened, because health is a year's worth of
 * arithmetic and paying it out mid-year would let a player press this, watch the
 * bar move, and press Advance into a second helping.
 *
 * What DOES happen immediately is being told something. A visit can catch a
 * condition the character was carrying without knowing, which is the honest
 * version of "preventive care matters, mostly backend": the benefit is real and
 * the player is not asked to schedule anything.
 */
export function seeDoctor(state: GameState): Result<DoctorOutcome, DoctorError> {
  if (!canSeeDoctor(state)) return err('already-seen');

  const stream = state.rng.stream(RngDomains.Health);
  const untreated = state.health.conditions.filter((row) => !row.treated);
  const caught = untreated.length > 0 && stream.chance(CHECKUP_CATCHES);
  const found = caught ? untreated[0] : undefined;
  const kind = found ? findCondition(found.conditionId) : undefined;

  return ok({
    state: {
      ...state,
      health: { ...state.health, checkedAtAge: state.player.age },
    },
    title: kind ? 'They found something' : 'Nothing to report',
    body: kind
      ? `A morning of waiting and one useful sentence: ${kind.label.toLowerCase()}. They can do something about it if you let them.`
      : 'Bloods, blood pressure, the usual questions. Nothing they want to see you about.',
    good: !kind,
  });
}

/**
 * Put a doctor on something.
 *
 * Free, and that is a decision rather than an oversight. Every price in this
 * build is currently `min(realPrice, whatYouHave)` because 0301's ledger does
 * not exist yet, and pricing healthcare against a placeholder would make
 * treatment either free in practice or unreachable for exactly the poor
 * characters it matters most to. When 0303 lands, this gets a real cost.
 */
export function treatCondition(
  state: GameState,
  conditionId: string,
): Result<DoctorOutcome, DoctorError> {
  const held = state.health.conditions.find((row) => row.conditionId === conditionId);
  if (!held) return err('no-such-condition');
  if (held.treated) return err('already-treated');
  const kind = findCondition(conditionId);
  if (!kind) return err('no-such-condition');

  return ok({
    state: {
      ...state,
      health: {
        ...state.health,
        conditions: state.health.conditions.map((row) =>
          row.conditionId === conditionId ? { ...row, treated: true } : row,
        ),
      },
    },
    title: 'Somebody is on it',
    body:
      kind.treatable > 0
        ? `They have a plan for ${kind.label.toLowerCase()}. It will take as long as it takes.`
        : `They will keep an eye on ${kind.label.toLowerCase()}. Nobody is pretending it will go.`,
    good: kind.treatable > 0,
  });
}

/** Stop treating something — the player's to undo, like everything else. */
export function stopTreatment(state: GameState, conditionId: string): GameState {
  return {
    ...state,
    health: {
      ...state.health,
      conditions: state.health.conditions.map((row) =>
        row.conditionId === conditionId ? { ...row, treated: false } : row,
      ),
    },
  };
}
