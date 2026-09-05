/**
 * Ticket 0206b — practice.
 *
 * Review: "Please monitor sports team performance and have buttons to practice
 * and raise performance and interact with peers."
 *
 * Three sessions an activity a year. Unlike Study Harder this cannot fail —
 * putting the hours in at something always moves you a little, and the
 * interesting variable is how MUCH, which depends on discipline, willpower and
 * how good you already are. A player who practises every year at one thing gets
 * to be genuinely good at it; a player who spreads three sessions across five
 * clubs stays in the middle of all of them, which is the real trade.
 */

import { createTimelineEntry, type Character, type TimelineEntry } from '@yearafter/character';
import { findActivity } from '@yearafter/content';
import { clampStat, err, ok, type Result } from '@yearafter/core';
import {
  enrolmentIn,
  practiceGain,
  practiceLeft,
  practisedThisYear,
  standingLabelFor,
  type EnrolledActivity,
} from '@yearafter/education';
import type { GameState } from './game-state';
import { RngDomains } from './rng/rng';

export type PracticeError =
  | 'no-such-activity'
  /** You cannot practise something you are not in. */
  | 'not-joined'
  /** Three sessions a year. Any more is a montage, not a childhood. */
  | 'no-sessions-left';

export interface PracticeOutcome {
  readonly state: GameState;
  readonly gained: number;
  readonly sessionsLeft: number;
  readonly entry: TimelineEntry;
}

const LINES = [
  'Stayed behind after {what} twice a week. It started to show.',
  'Put the work in at {what} when nobody was watching.',
  'Practised {what} until it was boring, and then a bit longer.',
  'Went at {what} in the garage, badly, until it was not bad.',
];

export function practise(
  state: GameState,
  activityId: string,
): Result<PracticeOutcome, PracticeError> {
  const activity = findActivity(activityId);
  if (!activity) return err('no-such-activity');
  const entry = enrolmentIn(state.education, activityId);
  if (!entry) return err('not-joined');
  if (practiceLeft(entry, state.player.age) <= 0) return err('no-sessions-left');

  const sessions = practisedThisYear(entry, state.player.age);
  const gained = practiceGain(state.player.stats, entry.standing, sessions);
  const updated: EnrolledActivity = {
    ...entry,
    standing: clampStat(entry.standing + gained),
    practisedAtAge: state.player.age,
    practiceCount: sessions + 1,
  };

  // One draw, for which way the line is phrased. Everything else is decided by
  // the character, which is why practice is dependable and Study Harder is not.
  const variant = state.rng.stream(RngDomains.Education).next();
  const text = (
    LINES[Math.min(LINES.length - 1, Math.floor(variant * LINES.length))] as string
  ).replace('{what}', activity.name.toLowerCase());

  const sequence = state.player.timeline.filter((line) => line.age === state.player.age).length;
  const timelineEntry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'passive',
    text: `${text} ${standingLabelFor(activity, updated.standing)}.`,
    id: `t:${state.world.year}:practice:${activityId}:${sessions}`,
    sequence,
  });

  const player: Character = {
    ...state.player,
    timeline: [...state.player.timeline, timelineEntry],
  };

  return ok({
    state: {
      ...state,
      player,
      education: {
        ...state.education,
        activities: state.education.activities.map((candidate) =>
          candidate.activityId === activityId ? updated : candidate,
        ),
      },
    },
    gained,
    sessionsLeft: practiceLeft(updated, state.player.age),
    entry: timelineEntry,
  });
}
