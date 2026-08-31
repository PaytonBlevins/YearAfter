/**
 * Ticket 0204 — one school year.
 *
 * Pure. Takes the state and the character's situation, returns the new state,
 * the stat deltas to apply, the money to move (with its source), and the lines
 * to write. The phase module in @yearafter/simulation does the applying — this
 * package never touches GameState, so it can be run ten thousand times by the
 * balance tooling without a phone or a save.
 */

import type { Personality, Talents, VisibleStats } from '@yearafter/character';
import { ACTIVITIES, type SchoolStageId } from '@yearafter/content';
import { clampStat } from '@yearafter/core';
import type { WealthBand } from '@yearafter/relationships';
import {
  annualActivityEffects,
  committedCost,
  committedHours,
  leave,
  outgrown,
} from './activities';
import {
  ALTERNATIVE_SCHOOL_EXIT,
  ALTERNATIVE_SCHOOL_THRESHOLD,
  SCHOOL_MODIFIERS,
  advanceBehaviour,
  advancePerformance,
  targetPerformance,
} from './performance';
import {
  GRADES_TO_GRADUATE,
  SCHOOL_START_AGE,
  gradeForAge,
  isInSchool,
  letterGrade,
  stageForGrade,
  type EducationState,
} from './school';
import { OVERLOAD_EVENT_THRESHOLD, assessWorkload, overloadPenalties } from './workload';

export interface SchoolYearInput {
  readonly age: number;
  readonly stats: VisibleStats;
  readonly talents: Talents;
  readonly personality: Personality;
  readonly wealth: WealthBand;
}

/**
 * What the year's activities cost, and who paid.
 *
 * The HOUSEHOLD pays, not the child. An earlier version charged the player's own
 * cash and floored it at zero, which produced a feed line reading "Paid $216
 * over the year for a rented clarinet" beside a balance of $0 — the line said
 * money moved and no money moved. A fifteen-year-old does not pay band fees;
 * their parents do, and whether the family can afford it is already decided by
 * the wealth-band gate on joining.
 *
 * The real ledger entry arrives with Ticket 0301. Until then this is reported,
 * not charged, and the reporting is the part that matters: money that moves
 * without saying why is the bug this whole pass exists to remove.
 */
export interface SchoolCost {
  /** Whole dollars, as a positive amount. */
  readonly dollars: number;
  /** Reads inside a sentence: "a rented clarinet at $18 a month". */
  readonly source: string;
  readonly payer: 'household';
}

export interface SchoolYearResult {
  readonly state: EducationState;
  readonly statDeltas: Partial<Record<keyof VisibleStats, number>>;
  /** Written into character.stress.hiddenLoad; Ticket 0205 makes it visible. */
  readonly hiddenLoad: number;
  readonly costs: readonly SchoolCost[];
  /** Feed lines, in order. Milestones first, then consequences. */
  readonly lines: readonly { readonly kind: 'milestone' | 'passive'; readonly text: string }[];
}

const EMPTY: SchoolYearResult['statDeltas'] = {};

/**
 * Run a school year for a character who has just turned `age`.
 *
 * Order matters and is fixed: enrol or advance a grade, then score the year,
 * then apply what being in things did, then charge for them. Reordering changes
 * every seeded life.
 */
export function runSchoolYear(state: EducationState, input: SchoolYearInput): SchoolYearResult {
  const lines: SchoolYearResult['lines'] = [];
  const push = (kind: 'milestone' | 'passive', text: string) =>
    (lines as { kind: 'milestone' | 'passive'; text: string }[]).push({ kind, text });

  // ---- enrolment and grade ------------------------------------------------
  let next = state;
  /**
   * True on the year school starts.
   *
   * Performance normally DRIFTS towards its target, which is right for every
   * year but the first — before school there is nothing to drift from, and the
   * placeholder 50 rendered a six-year-old's first report card as an F with a
   * 0.7 GPA. A first report card reports the child, not the placeholder.
   */
  let justEnrolled = false;

  if (state.stage === 'graduated' || state.stage === 'droppedOut') {
    return { state, statDeltas: EMPTY, hiddenLoad: 0, costs: [], lines: [] };
  }

  if (state.stage === 'preschool') {
    if (input.age < SCHOOL_START_AGE) {
      return { state, statDeltas: EMPTY, hiddenLoad: 0, costs: [], lines: [] };
    }
    next = { ...next, gradeLevel: 0, stage: 'elementary' };
    justEnrolled = true;
    push('milestone', 'Started kindergarten.');
  } else {
    const grade = state.gradeLevel + 1;
    if (grade > GRADES_TO_GRADUATE) {
      push(
        'milestone',
        `Graduated from high school with a ${letterGrade(state.performance)} average.`,
      );
      return {
        state: { ...state, stage: 'graduated', finishedAtAge: input.age, activities: [] },
        statDeltas: { happiness: 6, discipline: 2 },
        hiddenLoad: 0,
        costs: [],
        lines,
      };
    }
    const stage = stageForGrade(grade);
    if (stage !== state.stage && state.schoolType !== 'alternative') {
      push('milestone', stage === 'middle' ? 'Started middle school.' : 'Started high school.');
    }
    next = { ...next, gradeLevel: grade, stage };
  }

  const stageId = next.stage as SchoolStageId;

  // ---- activities that no longer apply ------------------------------------
  for (const activity of outgrown(next, stageId)) {
    next = leave(next, activity.id);
    push('passive', `Aged out of ${activity.name.toLowerCase()} when you changed schools.`);
  }

  // ---- workload -----------------------------------------------------------
  const hours = committedHours(next);
  const workload = assessWorkload(hours, input.stats, input.personality, input.age);
  const penalties = overloadPenalties(workload.overload);

  // ---- academic performance ----------------------------------------------
  const performanceInputs = {
    age: input.age,
    stats: input.stats,
    talents: input.talents,
    effort: next.effort,
    overloadPenalty: penalties.performance,
    schoolModifier: SCHOOL_MODIFIERS[next.schoolType],
  };
  const performance = justEnrolled
    ? clampStat(Math.round(targetPerformance(performanceInputs)))
    : advancePerformance(next.performance, performanceInputs);
  const behaviour = advanceBehaviour(
    next.behaviour,
    input.personality.temper,
    input.stats.discipline,
  );
  next = { ...next, performance, behaviour };

  // ---- alternative school placement (spec 73) -----------------------------
  if (next.schoolType !== 'alternative' && behaviour <= ALTERNATIVE_SCHOOL_THRESHOLD) {
    next = { ...next, schoolType: 'alternative' };
    push(
      'milestone',
      'Transferred to an alternative school after one meeting too many with the principal.',
    );
  } else if (next.schoolType === 'alternative' && behaviour >= ALTERNATIVE_SCHOOL_EXIT) {
    next = { ...next, schoolType: 'public' };
    push('milestone', 'Transferred back to a mainstream school.');
  }

  // ---- what the year did --------------------------------------------------
  const activityEffects = annualActivityEffects(next);
  const statDeltas: Record<string, number> = { ...activityEffects };
  const add = (key: string, value: number) => {
    if (value !== 0) statDeltas[key] = (statDeltas[key] ?? 0) + value;
  };
  add('health', penalties.health);
  add('happiness', penalties.happiness);
  // School itself makes you a little smarter every year, and coasting does not.
  add('smarts', next.effort === 'coasting' ? 0 : next.effort === 'hard' ? 3 : 1);

  if (workload.overload >= OVERLOAD_EVENT_THRESHOLD) {
    push('passive', overloadLine(next, workload.overload, input.age));
  }

  // ---- money, always with a source ---------------------------------------
  const cost = committedCost(next);
  const costs: SchoolCost[] = [];
  if (cost > 0) {
    const names = joinedCostSources(next);
    costs.push({ dollars: cost, source: names, payer: 'household' });
    // Said differently the first year and after, because a standing cost
    // repeated verbatim every September reads like the game is stuck.
    const isFirstYear = next.activities.some((entry) => entry.joinedAtAge === input.age - 1);
    push(
      'passive',
      isFirstYear
        ? `Your parents covered $${cost.toLocaleString('en-US')} for ${names}.`
        : `Another $${cost.toLocaleString('en-US')} went on ${names}.`,
    );
  }

  return { state: next, statDeltas, hiddenLoad: workload.load, costs, lines };
}

/**
 * What being overcommitted looks like from the inside.
 *
 * Deliberately a scene rather than a status report — this line is the only place
 * the workload model is ever visible to the player, and "You fell asleep in
 * third period" tells them more than any number would.
 *
 * Several variants per band, chosen by age. A character who is overloaded for
 * four straight years got the identical sentence four times in testing, which
 * reads as a stuck game rather than a hard stretch. Age is the selector because
 * it is deterministic — this package has no RNG, and a school year must replay
 * from a seed like everything else.
 */
const OVERLOAD_LINES = {
  severeMany: [
    'Between everything you signed up for, you fell asleep in third period most days and stopped being good at any of it.',
    'You were at school from seven in the morning until nine at night and could not have said what for.',
    'Something had to give and it turned out to be all of it at once.',
    'You missed two things you had promised to be at, in the same week, and stopped promising after that.',
  ],
  mildMany: [
    'You had signed up for more than fitted in a week, and something gave every time.',
    'Every evening had somewhere to be, and the homework happened in the twenty minutes before it was due.',
    'You got good at doing two things badly at the same time.',
  ],
  severeFew: [
    'You ran yourself into the ground this year and it showed in everything.',
    'You were tired in a way that sleeping did not fix.',
    'The year went past at a sprint and you do not remember most of it.',
  ],
  mildFew: [
    'There was not quite enough week for everything you had taken on.',
    'You were always ten minutes late to the second thing.',
  ],
} as const;

function overloadLine(state: EducationState, overload: number, age: number): string {
  const severe = overload >= 10;
  const many = state.activities.length >= 3;
  const pool = many
    ? severe
      ? OVERLOAD_LINES.severeMany
      : OVERLOAD_LINES.mildMany
    : severe
      ? OVERLOAD_LINES.severeFew
      : OVERLOAD_LINES.mildFew;
  return pool[age % pool.length] as string;
}

/**
 * Cost sources by activity id, built once at module load.
 *
 * A map rather than a lookup per call because this runs inside the year loop,
 * and spec 1247–1263 puts annual processing under 250 ms.
 */
const COST_SOURCES = new Map(
  ACTIVITIES.filter((activity) => activity.costSource).map((activity) => [
    activity.id,
    activity.costSource as string,
  ]),
);

/** "a rented clarinet at $18 a month and swim team fees" — reads in a sentence. */
function joinedCostSources(state: EducationState): string {
  const sources = state.activities
    .map((entry) => COST_SOURCES.get(entry.activityId))
    .filter((value): value is string => Boolean(value));
  if (sources.length === 0) return 'school activities';
  if (sources.length === 1) return sources[0] as string;
  return `${sources.slice(0, -1).join(', ')} and ${sources[sources.length - 1]}`;
}

export { gradeForAge, isInSchool };
