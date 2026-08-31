/**
 * Ticket 0204 — how a school year is scored.
 *
 * Spec 74, canonical: Attendance and Sleep/Wellbeing are REMOVED as academic
 * inputs. So performance comes from aptitude (Smarts), habit (Discipline),
 * choice (Study Harder), talent (Academics), and whether the character took on
 * more than they can carry. Nothing else, and nothing the player has to manage
 * class by class (spec 75).
 *
 * Performance drifts towards a target rather than being recomputed from scratch,
 * so a good student who starts coasting slides over two or three years instead
 * of falling off a cliff in one — which is both truer and easier to notice in a
 * feed that only gets a line or two per year.
 */

import type { Talents, VisibleStats } from '@yearafter/character';
import { clampStat, type StatValue } from '@yearafter/core';
import { EFFORT_PERFORMANCE, type StudyEffort } from './school';

/** How much of the gap to the target is closed each year. */
export const PERFORMANCE_DRIFT = 0.45;

/** What the Academics talent is worth in school, in performance points. */
export const ACADEMICS_TALENT_BONUS = 9;

export interface PerformanceInputs {
  readonly stats: VisibleStats;
  readonly talents: Talents;
  readonly effort: StudyEffort;
  /** From assessWorkload. Zero when the character is not overcommitted. */
  readonly overloadPenalty: number;
  /** Alternative-school placements grade differently; see schoolModifier. */
  readonly schoolModifier: number;
  /**
   * The character's age, because a child is graded against other children of
   * their own age and not against a seventeen-year-old. Optional so the balance
   * tooling can ask about aptitude in the abstract; school always passes it.
   */
  readonly age?: number;
}

/**
 * How much slack the aptitude formula gives a child for being young.
 *
 * Stats grow through childhood — mean Smarts runs 61 at five and 76 at
 * seventeen — but the formula's constant was fitted at the top of that curve.
 * Applied to a first-grader it graded an ordinary six-year-old an F with a 0.7
 * GPA, which a screenshot caught and no test could: every test compared a
 * character to the same formula that produced them.
 *
 * So the scale slides with the curve. An average child is an average student at
 * every age, and a bright six-year-old reads as bright rather than as a
 * seventeen-year-old who has failed.
 */
export const AGE_ALLOWANCE_PER_YEAR = 1.7;
export const GRADED_AT_AGE = 17;

export function ageAllowance(age: number | undefined): number {
  if (age === undefined) return 0;
  return Math.max(0, GRADED_AT_AGE - age) * AGE_ALLOWANCE_PER_YEAR;
}

/**
 * Where this character's performance is heading, given how they are living.
 *
 * Smarts sets the ceiling and Discipline decides how much of it is realised —
 * which is why a bright, scattered kid and a steady, ordinary one can land in
 * the same place by different routes.
 */
export function targetPerformance(inputs: PerformanceInputs): number {
  const { stats, talents, effort } = inputs;
  // Coefficients fitted against the stats a real childhood actually produces
  // (Smarts lands around 66–81 across lives, Discipline 51–78), not guessed.
  // A flatter earlier formula gave 80% of characters a C, which is a grade
  // nobody can tell apart from any other grade. This lands roughly 55% C,
  // 30% B, 8% D, 4% A — a school-shaped curve with visible ends.
  //
  // The lever that actually moves a player's grade is effort, which is the
  // point: spec 1821 says "major + Study Harder is generally enough".
  const aptitude = stats.smarts * 1.15 + stats.discipline * 0.35 - 33;
  const talentBonus = talents.academics ? ACADEMICS_TALENT_BONUS : 0;
  return (
    aptitude +
    ageAllowance(inputs.age) +
    talentBonus +
    EFFORT_PERFORMANCE[effort] +
    inputs.schoolModifier +
    inputs.overloadPenalty
  );
}

/** One year of movement towards that target. */
export function advancePerformance(current: number, inputs: PerformanceInputs): StatValue {
  const target = targetPerformance(inputs);
  return clampStat(Math.round(current + (target - current) * PERFORMANCE_DRIFT));
}

/**
 * Behaviour drift.
 *
 * Standing with the school moves back towards a baseline set by the character's
 * own temperament, rather than climbing every year. The first version added a
 * flat recovery, and the result was that every character in 200 test lives
 * finished on 96–100: alternative school (spec 73) was unreachable, and a whole
 * branch of the spec existed only on paper. A baseline makes a hot-tempered,
 * undisciplined kid sit low permanently, which is where the branch lives.
 *
 * Events push behaviour off the baseline — that is what `EventEffects.behaviour`
 * is for — and this pulls it back, slowly.
 */
export const BEHAVIOUR_DRIFT = 0.22;

export function behaviourBaseline(temper: number, discipline: number): number {
  return 64 - ((temper - 50) / 50) * 34 + ((discipline - 50) / 50) * 18;
}

export function advanceBehaviour(current: number, temper: number, discipline: number): StatValue {
  const baseline = behaviourBaseline(temper, discipline);
  return clampStat(Math.round(current + (baseline - current) * BEHAVIOUR_DRIFT));
}

/**
 * Behaviour at or below this routes a character into an alternative school
 * (spec 73). Deliberately low: it should mean something has genuinely gone
 * wrong over more than one year, not that a character got one detention.
 */
export const ALTERNATIVE_SCHOOL_THRESHOLD = 30;

/** Behaviour a character must climb back to before they can transfer out. */
export const ALTERNATIVE_SCHOOL_EXIT = 55;

/**
 * Alternative schools grade more gently and offer less. The placement is not a
 * punishment in stat terms — spec 949 wants the game fun at every level — but it
 * closes doors later, which is where it should be felt.
 */
export const SCHOOL_MODIFIERS = {
  public: 0,
  private: 4,
  alternative: -6,
  homeschool: 0,
} as const;
