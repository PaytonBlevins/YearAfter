/**
 * Ticket 0905 — Work Harder, in an agency.
 *
 * The button a civilian job and a service life have, answered for somebody whose career is the FBI's or the CIA's. It
 * does what it does at a desk and in uniform (see `military-work.ts`): this year's performance moves most of the time,
 * the person becomes somebody who works hard, and two presses a year count.
 *
 * A leaf, so `careers.ts` can hand over to it without a cycle. The draws are hashes of the seed, the generation, the age
 * and the press number and not a stream's, so pressing the button here, or not pressing it, moves nothing else.
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
  'Took the case file home and read it twice. Your supervisor noticed what you caught.',
  'Volunteered for the surveillance shift nobody wanted, and it paid off.',
  'Wrote the report so cleanly that it was the one people quoted.',
  'Learned the language of the region before anyone asked you to.',
  'Stayed after the briefing to ask the question that changed the plan.',
];

const DID_NOT_LINES: readonly string[] = [
  'Worked every night this month. The case went to somebody else.',
  'Gave it everything and the review got postponed to next year.',
  'Went above and beyond, and the one person who saw it was reassigned.',
  'Put in the hours. Nothing in the file shows it.',
];

const unit = (state: GameState, ...parts: readonly (string | number)[]): number =>
  mixedUnit(`intelwork:${state.rng.getSeed()}:${state.world.generation}:${parts.join(':')}`);

/** The two-a-year cap, read for somebody in an agency. */
export const agencyPushesLeft = (state: GameState): number => {
  const career = state.intel.career;
  if (!career) return 0;
  const pushed = career.pushedAtAge === state.player.age ? (career.pushedThisYear ?? 0) : 0;
  return Math.max(0, PUSHES_PER_YEAR - pushed);
};

export function workHarderInAgency(state: GameState): Result<PushOutcome, WorkError> {
  const career = state.intel.career;
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
    stablePick(worked ? WORKED_LINES : DID_NOT_LINES, `${state.world.year}:agencywork:${pushed}`) ??
    '';
  const sequence = state.player.timeline.filter((row) => row.age === age).length;
  const entry: TimelineEntry = createTimelineEntry({
    age,
    year: state.world.year,
    kind: 'career',
    text,
    id: `t:${state.world.year}:work:agency:${pushed}:${sequence}`,
    sequence,
  });

  return ok({
    state: {
      ...state,
      intel: {
        ...state.intel,
        career: {
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
