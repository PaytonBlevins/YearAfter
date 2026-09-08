/**
 * Ticket 0205 — pressing Study Harder.
 *
 * Review: "I want there to just be a button that says study harder and it
 * potentially (most of the time) boosts their grades."
 *
 * The model lives in @yearafter/education, which knows nothing about GameState.
 * This is the translation layer: it spends the draws, writes the feed line, and
 * folds the result back in. Same shape as `tryout.ts`, deliberately — an action
 * the player takes between years is now a recognisable pattern in this package.
 */

import {
  appendToTimeline,
  createTimelineEntry,
  type Character,
  type TimelineEntry,
} from '@yearafter/character';
import { err, ok, type Result } from '@yearafter/core';
import {
  STUDY_TERMS,
  hasStudiedThisYear,
  isInSchool,
  studiedThisYear,
  studyHarder,
} from '@yearafter/education';
import type { GameState } from './game-state';
import { RngDomains } from './rng/rng';

export type StudyError = 'not-in-school';

export interface StudyOutcome {
  readonly state: GameState;
  /** Whether it showed up on the report card. */
  readonly worked: boolean;
  readonly gained: number;
  /** Terms of this school year still available afterwards. */
  readonly termsLeft: number;
  /** Absent when the year's terms were already spent — nothing happened. */
  readonly entry?: TimelineEntry;
  /**
   * Ticket 0210c. True when this press changed nothing.
   *
   * Running out of terms stopped being an error, for the reason spelled out on
   * `PushOutcome` in `careers.ts`: the player is allowed to press the button as
   * often as they like, the effect is capped at two, and a press past the cap
   * draws no randomness and writes no line. See CORE_RULES 13.30.
   */
  readonly spent: boolean;
}

export function study(state: GameState): Result<StudyOutcome, StudyError> {
  if (!isInSchool(state.education)) return err('not-in-school');
  // Before the stream is touched. A dead press must not move the seed.
  if (hasStudiedThisYear(state.education, state.player.age)) {
    return ok({ state, worked: false, gained: 0, termsLeft: 0, spent: true });
  }

  // Three draws from the Education stream, in a fixed order, so a life replays.
  const stream = state.rng.stream(RngDomains.Education);
  const termsAlready = studiedThisYear(state.education, state.player.age);
  const result = studyHarder(
    state.education.performance,
    stream.next(),
    stream.next(),
    stream.next(),
    termsAlready,
  );

  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'passive',
    text: result.text,
    // The TERM is part of the id, because this runs twice a year now. Without
    // it the second term collided with the first and React logged "Encountered
    // two children with the same key" at the player's terminal.
    id: `t:${state.world.year}:study:${termsAlready}`,
    sequence,
  });

  const player: Character = {
    ...state.player,
    timeline: appendToTimeline(state.player.timeline, entry),
  };

  return ok({
    state: {
      ...state,
      player,
      education: {
        ...state.education,
        performance: result.performance,
        // Pressing it makes them somebody who studies, for good. The yearly
        // bump above is this year; `effort` is every year after it.
        effort: 'hard',
        studiedAtAge: state.player.age,
        studiedCount: termsAlready + 1,
      },
    },
    worked: result.worked,
    gained: result.gained,
    termsLeft: STUDY_TERMS - (termsAlready + 1),
    entry,
    spent: false,
  });
}
