/**
 * Ticket 0204 — schooling.
 *
 * Spec 75 is the whole design brief for this package: "School should be
 * intentionally lightweight so players reach the adult world quickly. Do not
 * create class-by-class management." Spec 1821 adds that "major + Study Harder
 * is generally enough".
 *
 * So this models a school career at the resolution a life story needs — which
 * grade you are in, roughly how you are doing, whether you are in trouble, and
 * what you signed up for — and nothing finer. There are no classes, no
 * timetable, no assignments, and no attendance: spec 74 explicitly removed
 * Attendance and Sleep/Wellbeing as academic inputs.
 */

import type { StatValue } from '@yearafter/core';

/**
 * Where a character is in the school system.
 *
 * `alternative` is a placement, not a grade — spec 73 asks for alternative
 * schools for badly behaved students, and a character in one is still in
 * whatever grade their age implies.
 */
export type SchoolStage =
  'preschool' | 'elementary' | 'middle' | 'high' | 'graduated' | 'droppedOut';

export type SchoolType = 'public' | 'private' | 'alternative' | 'homeschool';

export const SCHOOL_TYPE_LABELS: Readonly<Record<SchoolType, string>> = {
  public: 'Public School',
  private: 'Private School',
  alternative: 'Alternative School',
  homeschool: 'Homeschool',
};

/** US-benchmarked, like every other default in the game so far. */
export const SCHOOL_START_AGE = 5;
export const GRADES_TO_GRADUATE = 12;
/** Age at which a character may leave school without graduating. */
export const LEAVING_AGE = 16;

/**
 * Grade level for an age, 0 = kindergarten.
 *
 * Derived rather than stored on its own, so a character who starts late or
 * repeats a year is represented by an offset in state, not by two numbers that
 * can disagree.
 */
export function gradeForAge(age: number): number {
  return age - SCHOOL_START_AGE;
}

export function stageForGrade(grade: number): SchoolStage {
  if (grade < 0) return 'preschool';
  if (grade <= 5) return 'elementary';
  if (grade <= 8) return 'middle';
  if (grade <= GRADES_TO_GRADUATE) return 'high';
  return 'graduated';
}

/**
 * The label the character header shows under their name.
 *
 * This is what finally replaces `defaultOccupationFor` for school-age
 * characters — the placeholder that rendered a fifteen-year-old as "Student"
 * and a nine-year-old as "Child".
 */
export function enrolmentLabel(state: EducationState, age = 0): string {
  if (state.stage === 'graduated') return 'High School Graduate';
  if (state.stage === 'droppedOut') return 'Dropped Out';
  if (state.stage === 'preschool') {
    // Before school starts there is no enrolment to report, so this falls back
    // to a life stage. "Preschooler" for a one-year-old was the placeholder
    // problem all over again, just with a different word.
    if (age <= 1) return 'Newborn';
    if (age <= 2) return 'Toddler';
    return 'Preschooler';
  }

  const grade = state.gradeLevel;
  if (grade === 0) return 'Kindergartner';
  if (state.stage === 'high') {
    const year = ['Freshman', 'Sophomore', 'Junior', 'Senior'][grade - 9];
    if (year) return year;
  }
  return `${ordinal(grade)} Grader`;
}

/** The school's own name, for the Career screen. */
export function schoolLabel(state: EducationState): string {
  if (state.stage === 'graduated') return 'Finished school';
  if (state.stage === 'droppedOut') return 'Left school';
  return SCHOOL_TYPE_LABELS[state.schoolType];
}

function ordinal(value: number): string {
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? 'th'
      : value % 10 === 1
        ? 'st'
        : value % 10 === 2
          ? 'nd'
          : value % 10 === 3
            ? 'rd'
            : 'th';
  return `${value}${suffix}`;
}

/* -------------------------------------------------------------------------- */
/* Effort                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Spec 367 and 1821: the entire school interaction is meant to be
 * "School → Study Harder". This is that, with a third setting so the player can
 * deliberately let school slide — a real choice a teenager makes, and the only
 * way "Study Harder" means anything.
 *
 * Effort persists until changed. It is not re-asked every year, because a
 * yearly popup asking how hard you are trying is exactly the management the
 * spec forbids.
 */
export type StudyEffort = 'coasting' | 'normal' | 'hard';

export const STUDY_EFFORT_LABELS: Readonly<Record<StudyEffort, string>> = {
  coasting: 'Coasting',
  normal: 'Keeping up',
  hard: 'Studying hard',
};

/**
 * Performance points per year, before aptitude.
 *
 * Asymmetric on purpose: letting school slide costs more than grinding gains,
 * which is both true and keeps "Study Harder" from being a free ratchet. The
 * spread across the three settings is a bit over one letter grade, so the
 * player's one lever visibly matters (spec 1821).
 */
export const EFFORT_PERFORMANCE: Readonly<Record<StudyEffort, number>> = {
  coasting: -10,
  normal: 0,
  hard: 8,
};

/** Weekly hours each effort level costs. Feeds the hidden workload model. */
export const EFFORT_HOURS: Readonly<Record<StudyEffort, number>> = {
  coasting: 0,
  normal: 3,
  hard: 8,
};

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

/** One activity the character has actually joined. */
export interface EnrolledActivity {
  readonly activityId: string;
  /** Age at which they joined, for "three years on the team" style text later. */
  readonly joinedAtAge: number;
}

export interface EducationState {
  readonly stage: SchoolStage;
  /** 0 = kindergarten, 12 = final year. Held rather than derived so a repeated
   * year or a late start is representable. */
  readonly gradeLevel: number;
  readonly schoolType: SchoolType;
  /**
   * Academic performance, 0–100. Shown as a letter grade, never as this number —
   * spec 786–795 says explain outcomes through context, not formulas.
   */
  readonly performance: StatValue;
  readonly effort: StudyEffort;
  /**
   * Standing with the school, 0–100. Low behaviour is what routes a character
   * into an alternative school (spec 73).
   */
  readonly behaviour: StatValue;
  readonly activities: readonly EnrolledActivity[];
  /** Set once a character graduates or leaves, so later systems can ask. */
  readonly finishedAtAge?: number;
}

export const NOT_YET_ENROLLED: EducationState = {
  stage: 'preschool',
  gradeLevel: -1,
  schoolType: 'public',
  performance: 50,
  effort: 'normal',
  behaviour: 70,
  activities: [],
};

export const isInSchool = (state: EducationState): boolean =>
  state.stage === 'elementary' || state.stage === 'middle' || state.stage === 'high';

export const hasJoined = (state: EducationState, activityId: string): boolean =>
  state.activities.some((entry) => entry.activityId === activityId);

/* -------------------------------------------------------------------------- */
/* Grades                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Letter grade for a performance value.
 *
 * The player sees this and a GPA, never the underlying number. Bands are
 * deliberately generous at the bottom: spec 949 wants the game fun at every
 * level, and a childhood of straight Fs is not a story anyone plays twice.
 */
export function letterGrade(performance: number): string {
  if (performance >= 90) return 'A';
  if (performance >= 80) return 'B';
  if (performance >= 68) return 'C';
  if (performance >= 55) return 'D';
  return 'F';
}

/** 0.0–4.0, the number a player actually recognises. */
export function gradePointAverage(performance: number): number {
  const gpa = ((performance - 45) / 55) * 4;
  const clamped = gpa < 0 ? 0 : gpa > 4 ? 4 : gpa;
  return Math.round(clamped * 10) / 10;
}

export function describeGrades(state: EducationState): string {
  if (!isInSchool(state)) return '—';
  return `${letterGrade(state.performance)} average · ${gradePointAverage(state.performance).toFixed(1)} GPA`;
}
