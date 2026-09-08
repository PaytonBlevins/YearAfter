/**
 * Ticket 0210b — one year of a degree.
 *
 * Kept out of `progression.ts` because a college year genuinely is a different
 * thing from a school year: there is no behaviour, no alternative placement, no
 * clubs that age out, and no grade to be held back in. What there is: a major,
 * a bill, Study Harder, and whether you finish.
 *
 * Pure, like the rest of this package. Randomness arrives as a number.
 */

import { clampStat, type StatValue } from '@yearafter/core';
import {
  COLLEGE_YEARS,
  FAILING_OUT,
  FAIL_OUT_CHANCE,
  POSTGRAD_TUITION_PER_YEAR,
  POSTGRAD_YEARS,
  TUITION_PER_YEAR,
  collegeTarget,
  findMajor,
} from './college';
import { EFFORT_PERFORMANCE, type EducationState } from './school';

export interface CollegeYearInput {
  readonly age: number;
  readonly smarts: number;
  readonly discipline: number;
  readonly academics: boolean;
  /** Whole dollars the character can put towards this year's bill. */
  readonly cash: number;
  /**
   * Whole dollars a year a parent committed towards it (Ticket 0209/0210b).
   *
   * Netted off the bill BEFORE the affordability check, because that is what
   * funding somebody's education means and because without it college was
   * unreachable: measured, `cannot-afford` blocked enrolment 2,282 times in 300
   * lives even with the character working full time through it.
   */
  readonly support?: number;
  /** One [0,1) draw, passed in so this package stays pure. */
  readonly roll: number;
}

export type CollegeEnding = 'finished' | 'failed-out' | 'ran-out-of-money';

export interface CollegeYearResult {
  readonly state: EducationState;
  /** Whole dollars of tuition actually charged this year. */
  readonly tuition: number;
  readonly ending?: CollegeEnding;
  readonly lines: readonly { readonly kind: 'milestone' | 'passive'; readonly text: string }[];
}

export const tuitionFor = (state: EducationState): number =>
  state.stage === 'postgrad' ? POSTGRAD_TUITION_PER_YEAR : TUITION_PER_YEAR;

export const yearsNeeded = (state: EducationState): number =>
  state.stage === 'postgrad' ? POSTGRAD_YEARS : COLLEGE_YEARS;

/**
 * Run one year of it.
 *
 * Order matters: the bill comes FIRST. A character who cannot pay does not
 * quietly attend for free and find out at the end — they leave, this year, with
 * a line saying so, which is the honest version and the one that makes 0209's
 * parent-funded college worth asking for.
 */
export function runCollegeYear(
  state: EducationState,
  input: CollegeYearInput,
): CollegeYearResult {
  const lines: { kind: 'milestone' | 'passive'; text: string }[] = [];
  const postgrad = state.stage === 'postgrad';
  // What the character is personally out of pocket, after whoever is helping.
  const tuition = Math.max(0, tuitionFor(state) - Math.max(0, input.support ?? 0));

  /* ---- the bill ----------------------------------------------------------- */
  if (input.cash < tuition) {
    return {
      state: { ...state, stage: 'graduated', finishedAtAge: input.age },
      tuition: 0,
      ending: 'ran-out-of-money',
      lines: [
        {
          kind: 'milestone',
          text: `Could not cover the next year of tuition. You left without finishing.`,
        },
      ],
    };
  }

  /* ---- the year ----------------------------------------------------------- */
  const major = state.majorId ? findMajor(state.majorId) : undefined;
  const target = collegeTarget(
    input.smarts,
    input.discipline,
    EFFORT_PERFORMANCE[state.effort],
    major?.difficulty ?? 0.4,
    input.academics,
  );
  // Same drift the school model uses, so a bad first year is recoverable and a
  // good one is not a guarantee.
  const performance = clampStat(
    Math.round(state.performance + (target - state.performance) * 0.42),
  ) as StatValue;

  const yearsDone = (state.collegeYear ?? 0) + 1;
  const needed = yearsNeeded(state);

  /* ---- failing out --------------------------------------------------------- */
  if (performance < FAILING_OUT && input.roll < FAIL_OUT_CHANCE) {
    return {
      state: {
        ...state,
        stage: 'graduated',
        performance,
        finishedAtAge: input.age,
      },
      tuition,
      ending: 'failed-out',
      lines: [
        {
          kind: 'milestone',
          text: postgrad
            ? 'Left the program. It had stopped going anywhere some time before.'
            : 'Failed out. The letter was polite and it did not soften anything.',
        },
      ],
    };
  }

  /* ---- finishing ----------------------------------------------------------- */
  if (yearsDone >= needed) {
    const credentials = {
      ...state.credentials,
      ...(postgrad ? { postgraduate: input.age } : { university: input.age }),
    };
    return {
      state: {
        ...state,
        stage: 'graduated',
        performance,
        collegeYear: yearsDone,
        credentials,
        finishedAtAge: input.age,
      },
      tuition,
      ending: 'finished',
      lines: [
        {
          kind: 'milestone',
          text: postgrad
            ? `Finished the graduate program in ${major?.name.toLowerCase() ?? 'your subject'}.`
            : `Graduated with a degree in ${major?.name.toLowerCase() ?? 'your subject'}.`,
        },
      ],
    };
  }

  /* ---- another year -------------------------------------------------------- */
  //
  // ONE line a year at most, and only when there is something to say. Spec 75
  // wants college lightweight, and a progress report every September for four
  // years is the opposite — the 0206 drift-line lesson.
  if (yearsDone === 1) {
    lines.push({
      kind: 'passive',
      text: `First year of ${major?.name.toLowerCase() ?? 'the degree'}. Nobody tells you anything and you work it out.`,
    });
  }

  return {
    state: {
      ...state,
      performance,
      collegeYear: yearsDone,
      // Study Harder is per year, like it is at school.
      studiedCount: 0,
    },
    tuition,
    lines,
  };
}
