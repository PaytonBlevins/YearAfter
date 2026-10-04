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

/*
  PER-PROGRAMME SINCE 0406, WITH THE OLD CONSTANTS AS THE FALLBACK. Medical
  school is four years at $34,000 and a CPA year is one at $18,000; a single
  `postgrad` price could not describe both, and the generic one it used to
  describe ($13,200 for two years, whatever you studied) is exactly why every
  graduate degree in the game felt like the same degree.

  The fallback is not dead code: a save written before 0406 can hold a major id
  that no longer resolves, and a character mid-degree when the catalogue changed
  should finish it rather than crash.
*/
export const tuitionFor = (state: EducationState): number => {
  const program = state.majorId ? findMajor(state.majorId) : undefined;
  if (program) return program.tuition;
  return state.stage === 'postgrad' ? POSTGRAD_TUITION_PER_YEAR : TUITION_PER_YEAR;
};

export const yearsNeeded = (state: EducationState): number => {
  const program = state.majorId ? findMajor(state.majorId) : undefined;
  if (program) return program.years;
  return state.stage === 'postgrad' ? POSTGRAD_YEARS : COLLEGE_YEARS;
};

/*
  FAILING OUT TWICE IN A ROW IS NOW A THING THAT HAPPENS (Ticket 0410).

  One line per tier was safe for as long as a character could only realistically
  be offered a program every few years. 0410 stopped the systemic doors from
  shutting each other out and `guardians.test.ts` found the consequence
  immediately: "Failed out. The letter was polite and it didn't soften anything"
  at twenty-one and again at twenty-two, because the same character enrolled
  again the next year and failed again.

  So each tier gets a set, indexed by AGE rather than drawn — the same shape
  `NOT_THIS_YEAR` uses in `parenting.ts` for the same reason (CORE_RULES 13.17):
  an index that steps cannot land on itself twice running, and a fresh draw over
  four lines lands on the same one a quarter of the time. This consumes no
  randomness, which also keeps the line stable across a reload.
*/
const FAILED_OUT: Readonly<Record<'vocational' | 'postgrad' | 'college', readonly string[]>> = {
  vocational: [
    'Stopped turning up. The certificate went unclaimed.',
    'Missed too many hours to be signed off. No certificate.',
    'Let the course go halfway through. Nobody chased you about it.',
  ],
  postgrad: [
    'Left the program. It had stopped going anywhere some time before.',
    'Your advisor stopped replying and you stopped emailing. That was that.',
    'Withdrew from the program. You were already the oldest one in the room.',
  ],
  college: [
    "Failed out. The letter was polite and it didn't soften anything.",
    "Grades didn't come back up and they asked you not to enroll again.",
    'Failed the year and couldn’t repeat it. You packed the room up in an afternoon.',
    "Didn't pass enough of it. You found out by email, in August.",
  ],
};

const failedOutLine = (tier: 'vocational' | 'postgrad' | 'college', age: number): string => {
  const lines = FAILED_OUT[tier];
  return lines[age % lines.length] as string;
};

/**
 * Run one year of it.
 *
 * Order matters: the bill comes FIRST. A character who cannot pay does not
 * quietly attend for free and find out at the end — they leave, this year, with
 * a line saying so, which is the honest version and the one that makes 0209's
 * parent-funded college worth asking for.
 */
export function runCollegeYear(state: EducationState, input: CollegeYearInput): CollegeYearResult {
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
          text: `Couldn't cover the next year of tuition. You left without finishing.`,
        },
      ],
    };
  }

  /* ---- the year ----------------------------------------------------------- */
  const program = state.majorId ? findMajor(state.majorId) : undefined;
  const target = collegeTarget(
    input.smarts,
    input.discipline,
    EFFORT_PERFORMANCE[state.effort],
    program?.difficulty ?? 0.4,
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
          text: failedOutLine(
            state.stage === 'vocational' ? 'vocational' : postgrad ? 'postgrad' : 'college',
            input.age,
          ),
        },
      ],
    };
  }

  /* ---- finishing ----------------------------------------------------------- */
  if (yearsDone >= needed) {
    /*
      WHAT FINISHING ACTUALLY HANDS YOU (Ticket 0406).

      A degree moves you up the ordered ladder. A trade certificate does not
      move you anywhere on it — it adds a license and leaves the level exactly
      where it was, which is the whole point of the license being orthogonal.
      A plumber with a high-school diploma still holds `highSchool`, and the
      jobs that open for them open on the license, not on the level.

      Both can happen at once: medical school hands over `postgraduate` AND
      `lic.md`, and it is the second of those that separates a physician from
      somebody with a master's in fine arts.
    */
    const vocational = state.stage === 'vocational';
    const granted = program?.grants;
    const licenses =
      granted && !(state.credentials?.licenses ?? []).includes(granted)
        ? [...(state.credentials?.licenses ?? []), granted]
        : state.credentials?.licenses;
    const credentials = {
      ...state.credentials,
      ...(vocational ? {} : postgrad ? { postgraduate: input.age } : { university: input.age }),
      ...(licenses ? { licenses } : {}),
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
          text: vocational
            ? `Qualified. ${program?.name ?? 'The program'} is behind you and the license is yours.`
            : postgrad
              ? `Finished ${program?.name.toLowerCase() ?? 'the graduate program'}.`
              : `Graduated with a degree in ${program?.name.toLowerCase() ?? 'your subject'}.`,
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
      text: `First year of ${program?.name.toLowerCase() ?? 'the program'}. Nobody tells you anything and you work it out.`,
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
