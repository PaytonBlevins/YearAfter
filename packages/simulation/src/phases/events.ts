/**
 * Ticket 0203 — the event phase.
 *
 * `advance.ts` says it plainly: systems attach as phase modules, not as inline
 * logic. This is the first of them, and it sets the shape the others follow —
 * take a state, return what changed, touch nothing else.
 *
 * The engine itself lives in @yearafter/events and knows nothing about
 * `GameState`. This file is the translation layer: it builds the read-only
 * context the engine wants, hands over the Events stream, and folds the results
 * back into character and household state.
 */

import type { Character, TimelineKind } from '@yearafter/character';
import { describeCity } from '@yearafter/content';
import {
  applyEffects,
  runEventPhase,
  type EventContext,
  type EventHistory,
  type EventOutcome,
  type PendingDecision,
} from '@yearafter/events';
import type { Household } from '@yearafter/relationships';
import type { GameState } from '../game-state';
import { RngDomains } from '../rng/rng';

export interface EventPhaseOutput {
  readonly player: Character;
  readonly family: Household;
  readonly history: EventHistory;
  /** School standing after events. Folded back into education state (0204). */
  readonly behaviour: number;
  /** Stress points this year's events contributed. Read by the stress phase. */
  readonly stress: number;
  /** Feed lines for this year, in order. */
  readonly lines: readonly {
    readonly kind: TimelineKind;
    readonly text: string;
    readonly eventId: string;
  }[];
  readonly decisions: readonly PendingDecision[];
}

/**
 * The context an event may read.
 *
 * `age` and `year` are passed in rather than read from `state`, because the
 * phase runs against the year being entered, not the one being left.
 */
export function buildEventContext(
  state: GameState,
  age: number,
  year: number,
  history: EventHistory,
): EventContext {
  return {
    age,
    year,
    firstName: state.player.firstName,
    lastName: state.player.lastName,
    sex: state.player.sex,
    stats: state.player.stats,
    talents: state.player.talents,
    personality: state.player.personality,
    family: state.family,
    nameCultureId: state.nameCultureId,
    homeCity: describeCity(state.player.currentLocation.cityId),
    flags: new Set(history.flags),
    schoolStage: state.education.stage,
    activityCount: state.education.activities.length,
  };
}

/** Timeline kind for an outcome. Feed colour comes from this (LifeScreen). */
export function timelineKindFor(outcome: EventOutcome): TimelineKind {
  if (outcome.type === 'decision') return 'decision';
  if (outcome.type === 'opportunity') return 'opportunity';
  if (outcome.category === 'family' || outcome.category === 'friendship') return 'relationship';
  return 'passive';
}

/**
 * Fold one outcome into character and household state.
 *
 * Shared with decision resolution, so a choice's consequences land exactly the
 * same way a passive event's do — there is one place where an event changes the
 * world, and this is it.
 */
export function applyOutcome(
  player: Character,
  family: Household,
  history: EventHistory,
  outcome: EventOutcome,
  behaviour: number,
  stress = 0,
): {
  player: Character;
  family: Household;
  history: EventHistory;
  behaviour: number;
  stress: number;
} {
  const applied = applyEffects(
    { stats: player.stats, family, cash: player.cash, behaviour, stress, history },
    outcome.effects,
  );
  return {
    player: { ...player, stats: applied.stats, cash: applied.cash },
    family: applied.family,
    history: applied.history,
    behaviour: applied.behaviour,
    stress: applied.stress,
  };
}

/** Run the year's events and return everything that changed. */
export function runEvents(state: GameState, age: number, year: number): EventPhaseOutput {
  const stream = state.rng.stream(RngDomains.Events);
  const context = buildEventContext(state, age, year, state.events);
  const result = runEventPhase(context, stream, state.events);

  let player = state.player;
  let family = state.family;
  let history = result.history;
  let behaviour: number = state.education.behaviour;
  // Running total for the year, handed to the stress phase. Not a level — the
  // level is computed once, at the end of the year, from everything.
  let stress = 0;
  const lines: { kind: TimelineKind; text: string; eventId: string }[] = [];

  for (const outcome of result.outcomes) {
    const applied = applyOutcome(player, family, history, outcome, behaviour, stress);
    player = applied.player;
    family = applied.family;
    history = applied.history;
    behaviour = applied.behaviour;
    stress = applied.stress;
    lines.push({ kind: timelineKindFor(outcome), text: outcome.text, eventId: outcome.eventId });
  }

  return { player, family, history, behaviour, stress, lines, decisions: result.decisions };
}
