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
import { RngDomains } from './rng/rng';

export type DecisionError =
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
