/**
 * Ticket 0901 — the service.
 *
 * Enlisted service: nine grades on the real 2026 basic pay table (`military-pay.ts`), a four-year term, a
 * year of basic training that some do not finish, a yearly performance read, and promotion by time
 * in service and that read. 0902 added the other branches (`military-branches.ts`) and officers
 * (`military-officers.ts`); deployments (0903) and every way out with what it leaves behind (0904) come later.
 *
 * Anchors that are real: the 2026 enlisted basic pay table (a 3.8% raise from 1 January 2026; read
 * from two third-party copies of the DFAS chart that agree to the cent bar two cells, and not yet
 * checked against DFAS itself), the 2023 DoD force profile (81.6% of 1.27 million active-duty members
 * are enlisted; enlisted members average 27.4), a first term of four years, and a first-term
 * attrition of about 36% in the one cohort study found (GAO, FY1993), 13.6% of it inside six months.
 * Everything else is a game table: the time to each grade, the chance of a rise, the offer rates,
 * the standards and the training pass rate are judgements, and the ticket doc names the dials. Measured with
 * the table as it stands (0901, 4,000 recruits of middling fitness who re-enlist to twenty years): 12.6% do not finish
 * basic training; of those who retire at twenty years, about 3% are E-5, 25% E-6, 50% E-7, 20% E-8 and 2% E-9. Since
 * 0902 retirement is a choice from twenty years and a hard stop at 65, so that mix is the one for somebody who leaves
 * at the first term end after twenty; somebody who stays to 65 reaches E-9 far more often (about 40% in 0902's run).
 *
 * Everything here is data or a pure function of it; `simulation/military.ts` decides who is offered
 * what. American spelling, spoken-style contractions.
 */

import { findServiceBranch } from './military-branches';

/* -------------------------------------------------------------------------- */
/* Who can join                                                                */
/* -------------------------------------------------------------------------- */

/** The youngest and the oldest an enlistment is taken (17 and 35, Payton's call; a branch's own limit can be lower). */
export const ENLIST_MIN_AGE = 17;
export const ENLIST_MAX_AGE = 35;

/** The oldest a branch takes an enlistment: its own limit, held to the game's ceiling of 35. */
export const enlistAgeLimit = (branch: string): number =>
  Math.min(ENLIST_MAX_AGE, findServiceBranch(branch)?.maxEnlistAge ?? ENLIST_MAX_AGE);

/** The oldest a branch commissions an officer. */
export const commissionAgeLimit = (branch: string): number =>
  Math.min(ENLIST_MAX_AGE, findServiceBranch(branch)?.maxCommissionAge ?? ENLIST_MAX_AGE);

/** The least Smarts a branch takes. */
export const smartsFloorOf = (branch: string): number =>
  findServiceBranch(branch)?.smartsFloor ?? ENLIST_SMARTS_FLOOR;

/**
 * The standards. A character needs a diploma, to be well enough, and to have the aptitude. Health 50 turns away about
 * one nineteen-year-old in six in the 240-life baseline; the Smarts floor is low on purpose (the real aptitude test is
 * passed by most who take it), so it is a wall for a few and not for most.
 */
export const ENLIST_HEALTH_FLOOR = 50;
export const ENLIST_SMARTS_FLOOR = 30;

/** A term is four years, and a re-enlistment is for four more. */
export const TERM_YEARS = 4;

/**
 * Twenty years of service is when retirement is open: from then on a member may retire whenever they choose, and the
 * question at the end of every term says so. Nothing forces it before age 65 (Payton's call in 0902; 0901 retired
 * everyone at twenty years, which left no officer able to reach colonel).
 */
export const RETIRE_ELIGIBLE_YEARS = 20;

/** The age everyone is sent home at, a hard stop. */
export const MANDATORY_RETIRE_AGE = 65;

/**
 * A recruiter's offer, a year, to somebody who meets the standards and is not at college, a trade school or a
 * postgraduate course. By age. Measured on 150 lives (seeds `mil-0`..`mil-149`), 18 of them (12%) were offered the
 * enlistment at some point, at a median age of 22. A player who takes every offer therefore serves in about one life in
 * eight, against roughly one US adult in fourteen who is a veteran; a player who declines some lands near it. The
 * rates are judgements, and the ticket doc names them as dials.
 */
export function enlistOfferChance(age: number): number {
  if (age < ENLIST_MIN_AGE || age > ENLIST_MAX_AGE) return 0;
  if (age <= 24) return 0.022;
  if (age <= 29) return 0.01;
  return 0.003;
}

/* -------------------------------------------------------------------------- */
/* Grades                                                                      */
/* -------------------------------------------------------------------------- */

export interface GradeRow {
  /** 1 to 9: E-1 to E-9. */
  readonly grade: number;
  readonly abbr: string;
  /** The Army's title for it. */
  readonly title: string;
  /**
   * Whole years of service at the least before a rise INTO this grade (checked at the year's end). The
   * table is read against typical Army time-in-service: E-4 at two years, E-5 at three or four, E-6 at
   * eight, E-7 at twelve, E-8 in the middle of a career, E-9 in the last years of one.
   */
  readonly minYears: number;
  /** The chance a year's end brings the rise, for somebody performing at 60, once the time is in. */
  readonly rise: number;
}

export const ENLISTED_GRADES: readonly GradeRow[] = [
  { grade: 1, abbr: 'PV1', title: 'Private', minYears: 0, rise: 1 },
  { grade: 2, abbr: 'PV2', title: 'Private', minYears: 0, rise: 1 },
  { grade: 3, abbr: 'PFC', title: 'Private First Class', minYears: 1, rise: 1 },
  { grade: 4, abbr: 'SPC', title: 'Specialist', minYears: 2, rise: 0.85 },
  { grade: 5, abbr: 'SGT', title: 'Sergeant', minYears: 3, rise: 0.55 },
  { grade: 6, abbr: 'SSG', title: 'Staff Sergeant', minYears: 6, rise: 0.3 },
  { grade: 7, abbr: 'SFC', title: 'Sergeant First Class', minYears: 10, rise: 0.2 },
  { grade: 8, abbr: 'MSG', title: 'Master Sergeant', minYears: 14, rise: 0.1 },
  { grade: 9, abbr: 'SGM', title: 'Sergeant Major', minYears: 18, rise: 0.06 },
];

export const TOP_GRADE = 9;

export const findGrade = (grade: number): GradeRow =>
  ENLISTED_GRADES[Math.max(1, Math.min(TOP_GRADE, Math.round(grade))) - 1] as GradeRow;

/**
 * The chance a year ends with a rise to the next grade, once the years are in: the grade's own chance,
 * scaled by how the year was performed (a 60 is the table's own number, 100 is 1.8 times it, 20 is
 * a fifth of it) and never certain.
 */
export function riseChance(toGrade: number, performance: number): number {
  return scaledRise(findGrade(toGrade).rise, performance);
}

/**
 * A grade's yearly chance of a rise scaled by how the year was performed (a 60 is the table's own number, 100 is 1.8
 * times it, 20 is a fifth of it), never certain; a chance that is already certain stays certain. Shared by the officer
 * ladder.
 */
export function scaledRise(rise: number, performance: number): number {
  if (rise >= 1) return 1;
  const scale = Math.max(0.2, Math.min(1.8, 1 + (performance - 60) / 40));
  return Math.min(0.95, rise * scale);
}

/* -------------------------------------------------------------------------- */
/* Basic training                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The chance a recruit does not finish basic training. 13.6% of the FY1993 cohort left in the first six months
 * (GAO); here a recruit of middling fitness fails at about that rate, a fit one far less, an unfit one far more.
 * `fit` is 0–100.
 */
export function washOutChance(fit: number): number {
  return Math.max(0.04, Math.min(0.35, 0.145 + (58 - fit) * 0.004));
}

/**
 * A term ends with the question "stay?" only for somebody whose work has been at least this good. Below it the
 * service does not ask (a judgement). Measured with the same 4,000 recruits: about one in twenty enlistees is not asked.
 */
export const RETAIN_PERFORMANCE_FLOOR = 47;

/** What fits a person for service: discipline most, then health, then smarts. 0–100. */
export const serviceFit = (discipline: number, health: number, smarts: number): number =>
  discipline * 0.5 + health * 0.35 + smarts * 0.15;

/**
 * Where a year's performance is pulling to. The shape of a civilian job's (0210), with Health in it and Charisma
 * left out, as Payton asked: a hard-working year (Work Harder) aims at 70, an ordinary one at 46, and the person's
 * own aptitude moves that by up to 14 either way.
 */
export function servicePerformanceTarget(
  hard: boolean,
  discipline: number,
  smarts: number,
  health: number,
): number {
  const aptitude = (discipline * 0.45 + smarts * 0.25 + health * 0.3 - 50) / 50;
  const base = hard ? 70 : 46;
  // Stats run 0 to 100, so the target runs 32 to 84: no clamp is needed.
  return Math.round(base + aptitude * 14);
}

/** A service reputation, in words. Nothing shows the number. */
export function serviceReputationWord(reputation: number): string {
  if (reputation >= 85) return 'a name every sergeant knows';
  if (reputation >= 70) return 'well thought of';
  if (reputation >= 55) return 'solid';
  if (reputation >= 40) return 'unremarkable';
  return 'a problem for the sergeants';
}

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

export const ENLIST_PROMPTS: readonly string[] = [
  'A recruiter has been in touch. Four years, a bed, three meals, a steady check, and a lot you cannot picture yet.',
  'The recruiting office called again. A term is four years, and they say you would be good at it.',
  'A recruiter sat down across from you and laid it out: pay, a posting, training, and a promise to be somebody.',
];

export const BASIC_LINES: readonly string[] = [
  "%Training% was %weeks% weeks of being told you were wrong, and by the end you weren't as wrong.",
  'You finished %training% and walked out knowing where everything was and why.',
  '%Training% was the hardest thing you had done. You were handed a bunk and a uniform and told to earn the rest.',
];

export const YEAR_LINES: readonly string[] = [
  'A steady year at the post. Early mornings, long days, and nobody asked how you felt about it.',
  'Another year in uniform. The work was the work and the days went by.',
  'A quiet year in the unit. You knew your job and your sergeant knew you knew it.',
  'You spent the year at drill, on the range and at the formation. It added up.',
];

export const WASH_OUT_LINES: readonly string[] = [
  "You didn't make it through %training%. They sent you home with a form and a handshake.",
  "%Training% ended for you in the third week. It wasn't what they needed, and it wasn't what you needed.",
];

export const RISE_LINES: readonly string[] = [
  'Promoted to %title%. The pay changed, and so did how people said your name.',
  'Your name was on the list: %title%. A sergeant shook your hand.',
  'You pinned on %title% in a gym full of folding chairs.',
];

export const NOT_RETAINED_LINES: readonly string[] = [
  "Your term ended, and %branch% didn't ask you to stay. You left as a %title%.",
  'You reached the end of your term and nobody offered a new one. You left as a %title%.',
];

export const LEAVE_LINES: readonly string[] = [
  'You left %branch% as a %title%, with an honorable discharge and a duffel bag.',
  "Your term was up and you didn't sign again. You walked out of the gate as a %title%.",
];

export const RETIRE_LINES: readonly string[] = [
  'You retired from %branch% as a %title% after %years% years.',
  'You hung up the uniform after %years% years, a %title%.',
];

export const REENLIST_PROMPTS: readonly string[] = [
  'Your term is up. %Branch% wants you to stay four more years. What do you want to do?',
  'You are at the end of your term, and your first sergeant has the papers ready.',
];

/** The same question, put to somebody with twenty years in: retiring is open. */
export const RETIRE_PROMPTS: readonly string[] = [
  'Your term is up, and you have your twenty years. You can retire now, or stay four more.',
  'You are past twenty years, and the papers for either road are on the desk: retire, or sign on again.',
];
