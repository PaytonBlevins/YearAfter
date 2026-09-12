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

import { dollars, err, ok, type Result } from '@yearafter/core';
import {
  CHECKUP_CATCHES,
  findCondition,
  type ConditionKind,
  type Severity,
} from '@yearafter/health';
import { SUBSISTENCE } from '@yearafter/finance';
import type { GameState } from './game-state';
import { moveMoney, withCash } from './money';
import { RngDomains } from './rng/rng';

export type DoctorError =
  | 'already-seen'
  /** Nothing to treat, or not a condition this character has. */
  | 'no-such-condition'
  | 'already-treated';

export const DOCTOR_ERROR_LABELS: Readonly<Record<DoctorError, string>> = {
  'already-seen': "You've already been this year.",
  'no-such-condition': "That's not something you have.",
  'already-treated': "You're already being treated for that.",
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
    /*
      Ticket 0211b. The old version of the clean result read "Bloods, blood
      pressure, the usual questions. Nothing they want to see you about." The
      product owner: *"That's odd, just have it say 'You do not need to visit
      the doctor' or 'You had a checkup and everything was fine'."* Taken as
      written.

      And when something IS found, the line now says what to do next by name.
      The visit and the treatment are deliberately two presses — the player
      confirmed that — so the copy has to hand them the second one rather than
      leaving them to work out that the row underneath is a button.
    */
    title: kind ? 'They found something' : 'All clear',
    body: kind
      ? `The doctor found something: ${kind.label.toLowerCase()}. Tap it below to start treatment.`
      : 'You had a check-up and everything looked fine.',
    good: !kind,
  });
}

/**
 * What a year of treatment costs, by how serious the thing is.
 *
 * TICKET 0303 PAYS A DEBT 0211 TOOK ON. Treatment shipped free, and the comment
 * that made it free said why: every price in the build was `min(realPrice,
 * whatYouHave)` and pricing healthcare against a placeholder cost model would
 * make it either free in practice or unreachable for exactly the poor
 * characters it matters most to. 0303 is the ticket with a real cost model, so
 * this is the ticket that owes it a number.
 *
 * PRICED AS A SHARE OF SUBSISTENCE, not as a figure typed out of the air. The
 * point of a price is the decision it creates, and a decision only exists if
 * the price is comparable to what the player has — so it is anchored to the
 * same number the whole living-cost model is anchored to. A minor condition
 * costs a few weeks of living; a grave one costs most of a year.
 *
 * CHARGED YEARLY WHILE TREATMENT RUNS, not once at the counter. That is both
 * how it works and what makes it a real choice: a chronic condition is an
 * ongoing commitment, and stopping treatment is a button the player already
 * has.
 */
export const TREATMENT_SHARE: Readonly<Record<Severity, number>> = {
  minor: 0.08,
  serious: 0.26,
  grave: 0.55,
};

export const treatmentCostFor = (kind: ConditionKind): number =>
  Math.round(SUBSISTENCE * (TREATMENT_SHARE[kind.severity] ?? 0.08));

/**
 * Put a doctor on something.
 *
 * The FIRST year is charged here, at the moment the player presses. The rest
 * are charged by the health phase for as long as treatment runs — answering the
 * player where they pressed (CORE_RULES 13.27) rather than letting the cost
 * turn up silently next December.
 *
 * A character who cannot afford it is not refused. `post` floors at zero and
 * writes the unpaid part down as a `shortfall`, which is what happens to
 * people, and the outcome card says so rather than greying the row out — a menu
 * never refuses because you are broke any more than because you are busy
 * (CORE_RULES 13.5).
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

  const price = treatmentCostFor(kind);
  const moved = moveMoney(state, {
    category: 'spending',
    amount: dollars(-price),
    source: `Treatment for ${kind.label.toLowerCase()}`,
  });
  const shortBy = Math.round(-Number(moved.short) / 100);

  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      health: {
        ...state.health,
        conditions: state.health.conditions.map((row) =>
          row.conditionId === conditionId ? { ...row, treated: true } : row,
        ),
      },
    },
    title: 'Treatment started',
    body:
      (kind.treatable > 0
        ? `You're being treated for ${kind.label.toLowerCase()}. It might clear up, and it might take a few years.`
        : `They'll keep an eye on your ${kind.label.toLowerCase()}, but nobody's pretending it'll go away.`) +
      (shortBy > 0
        ? ` It costs ${money(price)} a year, and you're ${money(shortBy)} short of the first one.`
        : ` It costs ${money(price)} a year.`),
    good: kind.treatable > 0,
  });
}

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

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
