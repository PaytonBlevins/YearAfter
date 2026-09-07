/**
 * Ticket 0206b — joining something, and who is already there.
 *
 * Review: "…and interact with peers." Signing up for a team puts you next to
 * people, so joining is no longer a change to education state alone — it draws
 * two teammates into the circle and they show up on the People screen the same
 * afternoon.
 *
 * Lives beside `tryout.ts` rather than inside the store, so the app never has
 * to know that joining a club touches two different parts of the save.
 */

import { findActivity, type Activity } from '@yearafter/content';
import { join, leave } from '@yearafter/education';
import { PARENT_AGE, likeliestYes, willThey, type ParentRequest } from '@yearafter/parenting';
import { livingParents, type FamilyMember } from '@yearafter/relationships';
import { createTimelineEntry } from '@yearafter/character';
import type { GameState } from './game-state';
import { teammatesFor } from './social-generator';
import { RngDomains } from './rng/rng';

/**
 * Ticket 0209 — whether a parent will pay for this.
 *
 * Spec 61 lists "paying for activities" among the things that stay with NPC
 * parents when the player is the child, and until now the household paid for
 * everything automatically and unconditionally. A child signing themselves up
 * for a $900 sport and the money simply appearing is the version of this the
 * spec explicitly rules out.
 *
 * The activity's own cost becomes a request, so the answer runs through the
 * same generosity/finances/warmth model everything else does rather than a
 * second one that could disagree with it.
 */
export function fundingRequestFor(activity: Activity): ParentRequest {
  return {
    id: 'pay-for-it',
    label: `Pay for ${activity.name}`,
    blurb: 'Somebody has to cover it.',
    minAge: 0,
    cost: activity.annualCost ?? 0,
    // Parents are readier to fund the thing their child has chosen than a
    // one-off ask, and reading spec 61 that is the intent: the child asks, and
    // if the player approves the child joins. Here the player IS the child.
    base: 0.72,
    weight: 'heavy',
  };
}

/** Whether joining this needs somebody else to say yes first. */
export function needsFunding(state: GameState, activity: Activity): boolean {
  return (
    (activity.annualCost ?? 0) > 0 &&
    state.player.age < PARENT_AGE &&
    livingParents(state.family).length > 0
  );
}

/** The parent who would be asked, and how likely they are to agree. */
export function fundingOdds(
  state: GameState,
  activity: Activity,
): { readonly parent: FamilyMember; readonly chance: number } | undefined {
  if (!needsFunding(state, activity)) return undefined;
  const request = fundingRequestFor(activity);
  const parent = likeliestYes(
    request,
    livingParents(state.family),
    state.family,
    state.education.behaviour,
  );
  if (!parent) return undefined;
  return {
    parent,
    chance: willThey(request, parent, state.family, state.education.behaviour, state.player.age),
  };
}

export interface JoinOutcome {
  readonly state: GameState;
  /** False when a parent was asked and said no. Nothing changed. */
  readonly joined: boolean;
  readonly refusedBy?: string;
}

/**
 * Join an activity, and meet the two people you will be doing it with.
 *
 * Kept returning a plain `GameState` for the free ones so every existing caller
 * still works; `askToJoin` is the version that can be refused.
 */
export function joinActivity(state: GameState, activityId: string): GameState {
  const activity = findActivity(activityId);
  const education = join(state.education, activityId, state.player.age);
  if (!activity || education === state.education) return state;

  const made = teammatesFor(state.circle, state.rng.stream(RngDomains.Relationships), {
    activityId,
    activityName: activity.name,
    age: state.player.age,
    worldYear: state.world.year,
    nameCultureId: state.nameCultureId,
    firstName: state.player.firstName,
    family: state.family,
  });

  return {
    ...state,
    education,
    circle: { ...state.circle, people: [...state.circle.people, ...made] },
  };
}

/**
 * Join something that costs money, which means asking somebody to pay for it.
 *
 * A refusal changes nothing except the line in the feed and a little of how
 * the two of you stand. The player can ask again next year, and the reason
 * they were told no — a tight year, a parent who does not see the point — is
 * the same model that decides everything else about them.
 */
export function askToJoin(state: GameState, activityId: string): JoinOutcome {
  const activity = findActivity(activityId);
  if (!activity) return { state, joined: false };
  if (!needsFunding(state, activity)) return { state: joinActivity(state, activityId), joined: true };

  const odds = fundingOdds(state, activity);
  if (!odds) return { state: joinActivity(state, activityId), joined: true };

  const stream = state.rng.stream(RngDomains.Family);
  if (stream.chance(odds.chance)) return { state: joinActivity(state, activityId), joined: true };

  const who = odds.parent.role === 'mother' ? 'Mom' : 'Dad';
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'relationship',
    text: `${who} said no to ${activity.name.toLowerCase()}. It was the money, and it was not only the money.`,
    id: `t:${state.world.year}:funding:${activityId}`,
    sequence,
  });

  return {
    state: {
      ...state,
      player: { ...state.player, timeline: [...state.player.timeline, entry] },
    },
    joined: false,
    refusedBy: who,
  };
}

/**
 * Leave an activity.
 *
 * The teammates stay. They do not vanish because you quit — they become people
 * you used to see every week, and from here they drift like anybody else you
 * stopped turning up for, which is what actually happens.
 */
export function leaveActivity(state: GameState, activityId: string): GameState {
  return { ...state, education: leave(state.education, activityId) };
}
