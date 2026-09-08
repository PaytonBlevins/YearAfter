/**
 * Trying out for something (Ticket 0204b).
 *
 * Review, on the first version of the activities screen: "I was able to join the
 * basketball team just by clicking on it. I should have to tryout for things
 * like that."
 *
 * So a competitive activity is attempted rather than chosen. The attempt draws
 * from `RngDomains.Education`, which means it is seeded like everything else and
 * a life still replays — and it means a player cannot tap until they make the
 * team, because the draw is a function of the save, not of how many times the
 * button was pressed. One attempt per school year enforces the rest.
 */

import {
  appendToTimeline,
  createTimelineEntry,
  type Character,
  type TimelineEntry,
} from '@yearafter/character';
import { findActivity } from '@yearafter/content';
import { err, ok, type Result } from '@yearafter/core';
import { attemptTryout, hasAttemptedThisYear, hasJoined, isInSchool } from '@yearafter/education';
import type { GameState } from './game-state';
import { teammatesFor } from './social-generator';
import { RngDomains } from './rng/rng';

export type TryoutError =
  | 'no-such-activity'
  /** Not a competitive place — sign up for it instead. */
  | 'no-tryout-needed'
  | 'not-in-school'
  | 'already-in-it'
  /** One attempt per school year. Come back next year. */
  | 'already-attempted';

export interface TryoutOutcome {
  readonly state: GameState;
  readonly made: boolean;
  readonly entry: TimelineEntry;
}

/**
 * Attempt a tryout, and record it in the feed either way.
 *
 * Being cut is worth a line as much as making it is — it is a thing that
 * happened in the character's year, and a screen that silently does nothing on
 * failure teaches the player that the button is broken.
 */
export function tryOut(state: GameState, activityId: string): Result<TryoutOutcome, TryoutError> {
  const activity = findActivity(activityId);
  if (!activity) return err('no-such-activity');
  if (!activity.tryout) return err('no-tryout-needed');
  if (!isInSchool(state.education)) return err('not-in-school');
  if (hasJoined(state.education, activityId)) return err('already-in-it');
  if (hasAttemptedThisYear(state.education, activityId, state.player.age)) {
    return err('already-attempted');
  }

  const result = attemptTryout(
    state.education,
    activity,
    state.player.stats,
    state.player.talents,
    state.player.age,
    state.rng.stream(RngDomains.Education).next(),
  );

  // Filed under the year it happened in, after everything already there.
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;

  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: result.made ? 'milestone' : 'passive',
    text: result.text,
    id: `t:${state.world.year}:tryout:${activityId}`,
    sequence,
  });

  const player: Character = {
    ...state.player,
    timeline: appendToTimeline(state.player.timeline, entry),
  };

  // Making a team puts you next to the people on it (Ticket 0206b). Reading
  // output caught this: teammates appeared only for things you could join by
  // pressing Join, so every competitive activity — the ones you actually earned
  // — left you standing there on your own.
  const teammates = result.made
    ? teammatesFor(state.circle, state.rng.stream(RngDomains.Relationships), {
        activityId: activity.id,
        activityName: activity.name,
        age: state.player.age,
        worldYear: state.world.year,
        nameCultureId: state.nameCultureId,
        firstName: state.player.firstName,
        family: state.family,
      })
    : [];

  return ok({
    state: {
      ...state,
      player,
      education: result.state,
      circle:
        teammates.length > 0
          ? { ...state.circle, people: [...state.circle.people, ...teammates] }
          : state.circle,
    },
    made: result.made,
    entry,
  });
}
