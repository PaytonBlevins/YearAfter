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
/**
 * The age a character may legally stop, and the age the dropout path opens.
 *
 * It has existed since 0204 and nothing ever read it. Measured across 400 lives
 * while building 0210: one hundred per cent of characters graduated and NOTHING
 * IN THE CODEBASE EVER WROTE `droppedOut` — the state was read in five places
 * and written in zero. So the whole lower half of the adult population did not
 * exist, and a job model with an education requirement would have had nobody to
 * separate. CORE_RULES 13.7, found by measuring rather than by a test.
 */
export const LEAVING_AGE = 16;

/**
 * Where school has to have collapsed before a character walks out of it.
 *
 * BOTH, not either. Failing while behaving is a character who needs help, and
 * behaving badly while passing is a character who is bored — neither of those
 * leaves. It takes a year that has gone wrong in both directions at once, which
 * is what actually precedes somebody leaving at sixteen.
 *
 * THE NUMBERS ARE MEASURED AGAINST THIS BUILD, NOT AGAINST A SCHOOL.
 *
 * The first version used 38 and 42, which are what "failing" and "in trouble"
 * mean in the abstract, and produced ZERO leavers in 500 lives. Measuring the
 * sixteen-year-olds the game actually makes says why: performance runs p10 67,
 * median 78, and its MINIMUM ACROSS FIVE HUNDRED LIVES IS 50. This build cannot
 * produce a failing student — Smarts alone is p10 70 by eighteen — so a floor
 * at 38 was CORE_RULES 13.16 for the fifth time, in brand new code, gating on a
 * distribution that does not exist.
 *
 * These are the bottom of the population that is really there. The underlying
 * problem — that nobody in this game is bad at school — belongs to the ticket
 * that owns character generation, and is recorded in build-status rather than
 * papered over here.
 */
export const LEAVING_PERFORMANCE = 72;
export const LEAVING_BEHAVIOUR = 52;

/** Chance in a given year, once both floors are through. */
export const LEAVING_CHANCE = 0.45;

/**
 * Whether this year is the one they stop.
 *
 * Not a decision the player presses. It is the consequence of the decisions
 * they have already made — Study Harder, and every behaviour event of the last
 * four years — arriving, the same way alternative school arrives (spec 73).
 * A character who has been in trouble all year and is failing everything does
 * not weigh it up in a menu; they simply stop going.
 */
export function couldLeaveSchool(state: EducationState, age: number): boolean {
  if (!isInSchool(state)) return false;
  if (age < LEAVING_AGE) return false;
  return state.performance < LEAVING_PERFORMANCE && state.behaviour < LEAVING_BEHAVIOUR;
}

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

/**
 * What the character IS right now, in one phrase — the line under their name.
 *
 * Review, on the first version: "It should track grades consistently. When my
 * character was 11, it simply said I was in public school, now that I am 13, it
 * says that I am in 8th grade." Both screens were reading `player.occupation`, a
 * STORED string that is only rewritten when a year advances. A save migrated
 * from before schooling existed therefore carried its old placeholder around
 * until the next birthday, and the two screens disagreed about the same child.
 *
 * So the label is derived here, from education state and age, and the UI calls
 * this at render time (CORE_RULES 11: derive, do not store). The stored field
 * remains for the save-list summary, which needs a value without loading a
 * whole save, and it is written from this same function.
 */
export function statusLabel(state: EducationState, age: number): string {
  if (isInSchool(state) || state.stage === 'preschool') {
    return enrolmentLabel(state, age);
  }
  if (age >= 65) return 'Retired';
  // For a few years after leaving, what you did last is still who you are.
  // Calling an eighteen-year-old "Unemployed" the summer they graduate is
  // technically true and reads like an accusation.
  if (state.finishedAtAge !== undefined && age - state.finishedAtAge <= 3) {
    return state.stage === 'graduated' ? 'High School Graduate' : 'Left School';
  }
  return 'Unemployed';
}

/**
 * The kind of school, for the second line of the Career card.
 *
 * Undefined before school starts. It used to return "Public School" for a
 * NEWBORN — `schoolType` has a value from birth because the field is not
 * optional, and reading it unconditionally announced an enrolment that does not
 * exist. That is the other half of the review's report: the card said "Public
 * School" while the grade line said nothing, and the same character read as two
 * different facts at two different ages.
 */
export function schoolLabel(state: EducationState): string | undefined {
  if (state.stage === 'preschool') return undefined;
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
 * How hard this character works at school.
 *
 * No longer something the player sets. Review: "I want there to just be a
 * button that says study harder." Pressing that button moves a character from
 * `normal` to `hard` and keeps them there — they have become somebody who
 * studies — which raises the target their grades drift towards for the rest of
 * school. `coasting` is reachable only through events (a bad year, a family
 * upheaval), which is how it works for actual teenagers.
 *
 * The three-way cycle this replaces was a setting the player configured once
 * and forgot, which is the management spec 75 forbids in a school system meant
 * to be lightweight.
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
  /**
   * Where this character sits in that squad or cast, 0–100 (Ticket 0206b).
   *
   * Review: "Please monitor sports team performance and have buttons to
   * practice and raise performance." Never shown as a number — see
   * `standingLabelFor` and `seasonLine` in standing.ts.
   */
  readonly standing: StatValue;
  /** Seasons played, so a first year reads differently from a fourth. */
  readonly seasons: number;
  /** Age at which practice was last put in, and how many sessions that year. */
  readonly practisedAtAge: number;
  readonly practiceCount: number;
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
  /**
   * How many times this character has tried out for each thing, ever.
   *
   * Somebody who keeps turning up gets known, so repeated attempts help a
   * little. Kept per activity rather than as a total, because being cut from
   * football twice says nothing about your chances at debate.
   */
  readonly tryouts: Readonly<Record<string, number>>;
  /**
   * The age at which each was last attempted.
   *
   * One attempt per school year. Without it a player taps until they make the
   * team, which is not a tryout, it is a slot machine.
   */
  readonly tryoutYear: Readonly<Record<string, number>>;
  /**
   * The age at which Study Harder was last pressed, and how many times.
   *
   * Review: "please allow me to study harder at least twice." Two terms is
   * exactly right — a school year has more than one of them — and the second is
   * worth less than the first, so it is a second lever rather than a doubled
   * one. Without any limit the button is a slot machine: tap until the roll
   * lands and every character finishes with an A.
   */
  readonly studiedAtAge?: number;
  readonly studiedCount?: number;
  /**
   * Odd jobs currently held (Ticket 0206b), by gig id.
   *
   * Kept beside schooling because a child's working life and their school life
   * share one budget of hours — the paper round takes the mornings homework was
   * going to have. Real employment is Ticket 0210 and will want its own home.
   */
  readonly gigs: readonly string[];
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
  tryouts: {},
  tryoutYear: {},
  gigs: [],
};

export const isInSchool = (state: EducationState): boolean =>
  state.stage === 'elementary' || state.stage === 'middle' || state.stage === 'high';

/** Terms of real effort available in one school year. */
export const STUDY_TERMS = 2;

/** How many times Study Harder has been pressed this school year. */
export const studiedThisYear = (state: EducationState, age: number): number =>
  state.studiedAtAge === age ? (state.studiedCount ?? 1) : 0;

/** Whether the year's terms of studying are used up. */
export const hasStudiedThisYear = (state: EducationState, age: number): boolean =>
  studiedThisYear(state, age) >= STUDY_TERMS;

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
