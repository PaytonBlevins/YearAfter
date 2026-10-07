/**
 * Ticket 0203 — answering a decision.
 *
 * A decision is raised during `advanceYear` and answered afterwards, possibly
 * days later on a different device. That is why the pending list lives in game
 * state rather than in the UI: the question has to survive a save.
 *
 * The resolved line is appended to the year the decision was RAISED in, not the
 * year it was answered in, so a feed never shows a choice landing before the
 * event that prompted it.
 */

import {
  appendToTimeline,
  createTimelineEntry,
  type Character,
  type TimelineEntry,
} from '@yearafter/character';
import { asEventId } from '@yearafter/core';
import { resolveChoice, type PendingDecision } from '@yearafter/events';
import { applyImmediateStress } from '@yearafter/stress';
import { err, ok, type Result } from '@yearafter/core';
import type { GameState } from './game-state';
import { applyOutcome, buildEventContext, rememberOutcome, timelineKindFor } from './phases/events';
import { answerOffer, isOfferDecision } from './offers';
import { answerCollegeOffer, isCollegeOfferDecision } from './college-offer';
import { answerLifeOffer, isLifeOfferDecision } from './life-offer';
import { answerPursuitOffer, isPursuitOfferDecision } from './pursuit-offer';
import { answerHomeOffer, isHomeOfferDecision } from './homes';
import { answerVehicleOffer, isVehicleOfferDecision } from './vehicles';
import { answerRenovationOffer, isRenovationOfferDecision } from './renovations';
import { answerBusinessRescue, BUSINESS_RESCUE_EVENT_ID } from './business-rescue';
import { RngDomains } from './rng/rng';

export type DecisionError =
  | 'cannot-afford'
  | 'no-such-decision'
  | 'no-such-choice'
  /** The choice exists in the catalog but produced nothing — a content bug. */
  | 'unresolvable';

export interface DecisionResult {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  /**
   * A screen the chosen option asked to open — "See what they offer" leading to
   * the real activities list. The simulation does not navigate; it reports, and
   * the app decides what to do with it.
   */
  readonly opens?: string;
}

/**
 * Answer a pending decision.
 *
 * Returns a `Result` rather than throwing: a stale decision id is an expected
 * failure (two devices, one save), not an engineering bug (CORE_RULES).
 */
export function decide(
  state: GameState,
  eventId: string,
  choiceId: string,
): Result<DecisionResult, DecisionError> {
  const decision: PendingDecision | undefined = state.pending.find(
    (candidate) => candidate.eventId === eventId,
  );
  if (!decision) return err('no-such-decision');

  /*
    Ticket 0402. TWO KINDS OF DECISION NOW TRAVEL THIS QUEUE. Authored ones are
    resolved out of the content catalog below. Systemic ones are raised by a
    phase module because something happened in a system it owns, and cannot be
    authored at all: their choices move employment state, and `@yearafter/events`
    turns a choice into stat deltas and must never learn what a job is.

    The branch is here rather than inside `resolveChoice` for exactly that
    reason — the events engine stays ignorant of every system that borrows its
    queue, and each borrower answers its own question. 0405 uses this same
    door for school.
  */
  if (eventId === BUSINESS_RESCUE_EVENT_ID) {
    const answered = answerBusinessRescue(state, choiceId);
    if (!answered.ok)
      return err(answered.error === 'stale-rescue' ? 'unresolvable' : answered.error);
    return answered;
  }

  if (isOfferDecision(eventId)) {
    const answered = answerOffer(state, choiceId);
    if (!answered.ok) {
      return err(answered.error === 'no-such-choice' ? 'no-such-choice' : 'unresolvable');
    }
    return ok({ state: answered.value.state, entry: answered.value.entry });
  }

  if (isCollegeOfferDecision(eventId)) {
    const answered = answerCollegeOffer(state, choiceId);
    if (!answered.ok) {
      return err(answered.error === 'no-such-choice' ? 'no-such-choice' : 'unresolvable');
    }
    return ok({ state: answered.value.state, entry: answered.value.entry });
  }

  /*
    Ticket 0410. The third borrower of this queue, and the first whose answer
    runs a verb that can be pressed on a screen at the same time — see
    `answerLifeOffer` on why it declines gracefully where 0405 throws.
  */
  if (isLifeOfferDecision(eventId)) {
    const answered = answerLifeOffer(state, choiceId);
    if (!answered.ok) {
      return err(answered.error === 'no-such-choice' ? 'no-such-choice' : 'unresolvable');
    }
    return ok({ state: answered.value.state, entry: answered.value.entry });
  }

  // Ticket 0501. The fifth: a home that came up.
  if (isHomeOfferDecision(eventId)) {
    const answered = answerHomeOffer(state, choiceId);
    if (!answered.ok) {
      return err(answered.error === 'no-such-choice' ? 'no-such-choice' : 'unresolvable');
    }
    return ok({ state: answered.value.state, entry: answered.value.entry });
  }

  // Ticket 0504. The sixth: a car that came up.
  if (isVehicleOfferDecision(eventId)) {
    const answered = answerVehicleOffer(state, choiceId);
    if (!answered.ok) {
      return err(answered.error === 'no-such-choice' ? 'no-such-choice' : 'unresolvable');
    }
    return ok({ state: answered.value.state, entry: answered.value.entry });
  }

  // Ticket 0506. The seventh: the house needs work.
  if (isRenovationOfferDecision(eventId)) {
    const answered = answerRenovationOffer(state, choiceId);
    if (!answered.ok) {
      return err(answered.error === 'no-such-choice' ? 'no-such-choice' : 'unresolvable');
    }
    return ok({ state: answered.value.state, entry: answered.value.entry });
  }

  // Ticket 0416. The fourth borrower: a club, a team, a pursuit.
  if (isPursuitOfferDecision(eventId)) {
    const answered = answerPursuitOffer(state, choiceId);
    if (!answered.ok) {
      return err(answered.error === 'no-such-choice' ? 'no-such-choice' : 'unresolvable');
    }
    return ok({ state: answered.value.state, entry: answered.value.entry });
  }

  const stream = state.rng.stream(RngDomains.Events);
  const context = buildEventContext(state, decision.age, decision.year, state.events);
  const resolved = resolveChoice(decision, choiceId, context, stream, state.events);
  if (!resolved) {
    return err(decision.choices.some((c) => c.id === choiceId) ? 'unresolvable' : 'no-such-choice');
  }

  const applied = applyOutcome(
    state.player,
    state.family,
    resolved.history,
    resolved.outcome,
    state.education.behaviour,
  );

  // Sequence after everything already recorded for that age, so the answer reads
  // directly beneath the year it belongs to.
  const sequence = state.player.timeline.filter((entry) => entry.age === decision.age).length;

  const entry = createTimelineEntry({
    age: decision.age,
    year: decision.year,
    kind: timelineKindFor(resolved.outcome),
    text: resolved.outcome.text,
    eventId: asEventId(resolved.outcome.eventId),
    sequence,
  });

  const player: Character = {
    ...applied.player,
    // A decision is answered AFTER the year has been simulated, so its stress
    // cannot join that year's total — it lands now, scaled by the same
    // resilience the yearly pass uses.
    stress: {
      ...state.player.stress,
      level: applyImmediateStress(
        state.player.stress.level,
        applied.stress,
        applied.player.stats,
        state.player.personality,
      ),
    },
    timeline: appendToTimeline(state.player.timeline, entry),
  };

  return ok({
    ...(resolved.opens ? { opens: resolved.opens } : {}),
    state: {
      ...state,
      player,
      family: applied.family,
      // The person the decision was about remembers how it went (Ticket 0206).
      circle: rememberOutcome(state.circle, resolved.outcome, decision.age),
      events: applied.history,
      education: { ...state.education, behaviour: applied.behaviour },
      pending: state.pending.filter((candidate) => candidate.eventId !== eventId),
    },
    entry,
  });
}
