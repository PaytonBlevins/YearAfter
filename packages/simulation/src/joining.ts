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

import { findActivity } from '@yearafter/content';
import { join, leave } from '@yearafter/education';
import type { GameState } from './game-state';
import { teammatesFor } from './social-generator';
import { RngDomains } from './rng/rng';

/** Join an activity, and meet the two people you will be doing it with. */
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
 * Leave an activity.
 *
 * The teammates stay. They do not vanish because you quit — they become people
 * you used to see every week, and from here they drift like anybody else you
 * stopped turning up for, which is what actually happens.
 */
export function leaveActivity(state: GameState, activityId: string): GameState {
  return { ...state, education: leave(state.education, activityId) };
}
