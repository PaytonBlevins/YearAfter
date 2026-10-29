/**
 * Ticket 0901 — the service.
 *
 * Enlisted service in the Army: nine grades on the real 2026 basic pay table, a four-year term, a
 * year of basic training that some do not finish, a yearly performance read, and promotion by time
 * in service and that read. Later tickets add the other branches and officers (0902), deployments
 * (0903) and every way out with what it leaves behind (0904).
 *
 * Anchors that are real: the 2026 enlisted basic pay table (a 3.8% raise from 1 January 2026; read
 * from two third-party copies of the DFAS chart that agree to the cent bar two cells, and not yet
 * checked against DFAS itself), the 2023 DoD force profile (81.6% of 1.27 million active-duty members
 * are enlisted; enlisted members average 27.4), a first term of four years, and a first-term
 * attrition of about 36% in the one cohort study found (GAO, FY1993), 13.6% of it inside six months.
 * Everything else is a game table: the time to each grade, the chance of a rise, the offer rates,
 * the standards and the training pass rate are judgements, and the ticket doc names the dials. Measured with
 * the table as it stands (4,000 recruits of middling fitness): 12.6% do not finish basic training; of those who retire at
 * twenty years, about 3% are E-5, 25% E-6, 50% E-7, 20% E-8 and 2% E-9.
 *
 * Everything here is data or a pure function of it; `simulation/military.ts` decides who is offered
 * what. American spelling, spoken-style contractions.
 */

/** The branches built so far. 0902 adds the others. */
export const SERVICE_BRANCH_IDS = ['army'] as const;
export type ServiceBranchId = (typeof SERVICE_BRANCH_IDS)[number];

export interface ServiceBranchRow {
  readonly id: ServiceBranchId;
  /** "the Army", as it reads after "joined". */
  readonly name: string;
  /** "Army", as it reads in a header or a ledger line. */
  readonly short: string;
  /** "soldier". */
  readonly member: string;
  /** Made-up posts, for the lines. Every one is fictional. */
  readonly posts: readonly string[];
}

export const SERVICE_BRANCHES: readonly ServiceBranchRow[] = [
  {
    id: 'army',
    name: 'the Army',
    short: 'Army',
    member: 'soldier',
    posts: ['Fort Harlan', 'Fort Carrow', 'Fort Medley', 'Fort Ostrander', 'Camp Verrill'],
  },
];

export const findServiceBranch = (id: string): ServiceBranchRow | undefined =>
  SERVICE_BRANCHES.find((row) => row.id === id);

/* -------------------------------------------------------------------------- */
/* Who can join                                                                */
/* -------------------------------------------------------------------------- */

/** The youngest and the oldest an enlistment is taken (the Army's own limits, 17 and 35). */
export const ENLIST_MIN_AGE = 17;
export const ENLIST_MAX_AGE = 35;

/**
 * The standards. A character needs a diploma, to be well enough, and to have the aptitude. Health 50 turns away about
 * one nineteen-year-old in six in the 240-life baseline; the Smarts floor is low on purpose (the real aptitude test is
 * passed by most who take it), so it is a wall for a few and not for most.
 */
export const ENLIST_HEALTH_FLOOR = 50;
export const ENLIST_SMARTS_FLOOR = 30;

/** A term is four years, and a re-enlistment is for four more. */
export const TERM_YEARS = 4;

/** Twenty years in, a career ends in retirement and there is no question to answer. */
export const RETIRE_AT_YEARS = 20;

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
  const row = findGrade(toGrade);
  if (row.rise >= 1) return 1;
  const scale = Math.max(0.2, Math.min(1.8, 1 + (performance - 60) / 40));
  return Math.min(0.95, row.rise * scale);
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
/* Pay                                                                         */
/* -------------------------------------------------------------------------- */

/** The years-of-service steps of the DFAS table. A step applies from that many completed years. */
export const PAY_STEPS: readonly number[] = [0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26];

/** `null` is a cell the table does not have (nobody is that grade that early); the first real value stands in. */
const PAY_TABLE_2026: Readonly<Record<number, readonly (number | null)[]>> = {
  1: Array.from({ length: 15 }, () => 2407.2),
  2: Array.from({ length: 15 }, () => 2697.9),
  3: [2836.8, 3015, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198, 3198],
  4: [
    3142.2, 3303, 3482.4, 3658.5, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4, 3815.4,
    3815.4, 3815.4, 3815.4,
  ],
  5: [
    3342.9, 3598.2, 3775.8, 3946.8, 4110, 4299.9, 4395.3, 4421.7, 4421.7, 4421.7, 4421.7, 4421.7,
    4421.7, 4421.7, 4421.7,
  ],
  6: [
    3401.1, 3743.1, 3908.1, 4068.9, 4235.7, 4612.8, 4759.5, 5043.3, 5130.3, 5193.6, 5267.7, 5267.7,
    5267.7, 5267.7, 5267.7,
  ],
  7: [
    3932.1, 4291.5, 4456.2, 4673.1, 4843.8, 5135.7, 5300.4, 5591.7, 5835, 6000.9, 6177.3, 6245.7,
    6475.2, 6598.2, 7067.4,
  ],
  8: [
    null,
    null,
    null,
    null,
    null,
    5656.5,
    5907,
    6061.8,
    6247.2,
    6448.2,
    6811.2,
    6995.4,
    7308.3,
    7481.7,
    7908.9,
  ],
  9: [
    null,
    null,
    null,
    null,
    null,
    null,
    6910.2,
    7066.5,
    7263.6,
    7496.1,
    7730.7,
    8105.1,
    8423.1,
    8756.7,
    9267.9,
  ],
};

/** The monthly basic pay table is for 2026. Pay in the game is not adjusted for later years (the economy is constant-dollar). */
export const PAY_TABLE_YEAR = 2026;

/** Monthly basic pay for a grade at a number of completed years of service, whole cents. */
export function monthlyBasePay(grade: number, years: number): number {
  const row = PAY_TABLE_2026[findGrade(grade).grade]!;
  let step = 0;
  PAY_STEPS.forEach((from, index) => {
    if (years >= from) step = index;
  });
  // The top two grades have no cell before their first listed step: they are paid that first one.
  return (row[step] ?? row.find((value) => value !== null)) as number;
}

/** A year of basic pay, whole dollars. Housing and food are provided, so there is no allowance on top. */
export const annualBasePay = (grade: number, years: number): number =>
  Math.round(monthlyBasePay(grade, years) * 12);

/** The basic-training year of somebody who does not finish: about half a year of E-1 pay. */
export const washOutPay = (): number => Math.round(monthlyBasePay(1, 0) * 6);

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

export const ENLIST_PROMPTS: readonly string[] = [
  'A recruiter has been in touch. Four years, a bed, three meals, a steady check, and a lot you cannot picture yet.',
  'The recruiting office called again. A term is four years, and they say you would be good at it.',
  'A recruiter sat down across from you and laid it out: pay, a posting, training, and a promise to be somebody.',
];

export const BASIC_LINES: readonly string[] = [
  "Basic training was ten weeks of being told you were wrong, and by the end you weren't as wrong.",
  'You finished basic and walked out knowing where everything was and why.',
  'Basic was the hardest thing you had done. You were handed a rifle and a bunk and told to earn the rest.',
];

export const YEAR_LINES: readonly string[] = [
  'A steady year at the post. Early mornings, long days, and nobody asked how you felt about it.',
  'Another year in uniform. The work was the work and the days went by.',
  'A quiet year in the unit. You knew your job and your sergeant knew you knew it.',
  'You spent the year on the range, in the motor pool and at the formation. It added up.',
];

export const WASH_OUT_LINES: readonly string[] = [
  "You didn't make it through basic training. They sent you home with a form and a handshake.",
  "Basic ended for you in the third week. It wasn't what they needed, and it wasn't what you needed.",
];

export const RISE_LINES: readonly string[] = [
  'Promoted to %title%. The pay changed, and so did how people said your name.',
  'Your name was on the list: %title%. A sergeant shook your hand.',
  'You pinned on %title% in a gym full of folding chairs.',
];

export const NOT_RETAINED_LINES: readonly string[] = [
  "Your term ended, and the Army didn't ask you to stay. You left as a %title%.",
  'You reached the end of your term and nobody offered a new one. You left as a %title%.',
];

export const LEAVE_LINES: readonly string[] = [
  'You left the Army as a %title%, with an honorable discharge and a duffel bag.',
  "Your term was up and you didn't sign again. You walked out of the gate as a %title%.",
];

export const RETIRE_LINES: readonly string[] = [
  'Twenty years. You retired from the Army as a %title%.',
  'You hung up the uniform after twenty years, a %title%.',
];

export const REENLIST_PROMPTS: readonly string[] = [
  'Your term is up. The Army wants you to stay four more years. What do you want to do?',
  'You are at the end of your term, and your first sergeant has the papers ready.',
];
