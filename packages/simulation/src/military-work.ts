/**
 * Ticket 0901 — Work Harder, in uniform.
 *
 * The button a civilian job has, answered for somebody who serves. It does what it does at a desk: this year's
 * performance moves most of the time, and the person becomes somebody who works hard (effort sticks at `hard` and
 * raises the level performance drifts towards for as long as they serve). Two presses a year count and the rest are
 * free and change nothing, as in `careers.ts`.
 *
 * A leaf, so `careers.ts` can hand over to it without a cycle. The draws are hashes of the seed, the generation, the
 * age and the press number and not a stream's, so pressing the button in uniform, or not pressing it, moves nothing
 * else in the life.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  PUSHES_PER_YEAR,
  SECOND_PUSH_SCALE,
  WORK_GAIN_MAX,
  WORK_GAIN_MIN,
  WORK_SUCCESS_CHANCE,
} from '@yearafter/careers';
import { clampStat, err, mixedUnit, ok, stablePick, type Result } from '@yearafter/core';
import type { PushOutcome, WorkError } from './careers';
import type { GameState } from './game-state';

const WORKED_LINES: readonly string[] = [
  'Volunteered for the detail nobody wanted, and your sergeant remembered.',
  'Put in the extra hours on the range and it showed on the scorecard.',
  'Learned the job above yours before anybody asked you to.',
  'Ran the section when the squad leader was out, and ran it well.',
  'Showed up early every day this year. Somebody noticed that too.',
  'Took the hard training seriously and came out of it ahead of your platoon.',
];

const DID_NOT_LINES: readonly string[] = [
  'Gave it everything and the inspection got moved to next quarter.',
  'Put the hours in. The unit had a bad year anyway, and it took you with it.',
  'Went above and beyond, and the one person who saw it was transferred.',
  'Worked hard all year. Nothing on paper shows it.',
];

const unit = (state: GameState, ...parts: readonly (string | number)[]): number =>
  mixedUnit(`servicework:${state.rng.getSeed()}:${state.world.generation}:${parts.join(':')}`);

/** The two-a-year cap, read for a serving member. */
export const servicePushesLeft = (state: GameState): number => {
  const career = state.military.service;
  if (!career) return 0;
  const pushed = career.pushedAtAge === state.player.age ? (career.pushedThisYear ?? 0) : 0;
  return Math.max(0, PUSHES_PER_YEAR - pushed);
};

export function workHarderInService(state: GameState): Result<PushOutcome, WorkError> {
  const career = state.military.service;
  if (!career) return err('no-job');

  const fresh = career.pushedAtAge !== state.player.age;
  const pushed = fresh ? 0 : (career.pushedThisYear ?? 0);
  if (pushed >= PUSHES_PER_YEAR) return ok({ state, spent: true });

  const age = state.player.age;
  const worked = unit(state, age, pushed, 'works') < WORK_SUCCESS_CHANCE;
  const scale = pushed === 0 ? 1 : SECOND_PUSH_SCALE;
  const span = WORK_GAIN_MAX - WORK_GAIN_MIN;
  const gain = worked
    ? Math.round((WORK_GAIN_MIN + unit(state, age, pushed, 'gain') * span) * scale)
    : 0;

  const text =
    stablePick(
      worked ? WORKED_LINES : DID_NOT_LINES,
      `${state.world.year}:servicework:${pushed}`,
    ) ?? '';
  const sequence = state.player.timeline.filter((row) => row.age === age).length;
  const entry: TimelineEntry = createTimelineEntry({
    age,
    year: state.world.year,
    kind: 'career',
    text,
    id: `t:${state.world.year}:work:service:${pushed}:${sequence}`,
    sequence,
  });

  return ok({
    state: {
      ...state,
      military: {
        ...state.military,
        service: {
          ...career,
          performance: clampStat(career.performance + gain),
          effort: 'hard',
          pushedThisYear: pushed + 1,
          pushedAtAge: age,
        },
      },
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
    },
    entry,
    spent: false,
  });
}
