/**
 * Ticket 0905 — military intelligence and the agencies.
 *
 * Intelligence work is not a career you walk into off the street. It is an earned path inside organizations the game
 * already has or can reach: a military-intelligence specialty in each branch, and, from there or from a degree, the
 * FBI and the CIA. What gates all of it is a security clearance.
 *
 * REAL, from sources checked for this ticket:
 *  - Three levels of clearance: Confidential, Secret and Top Secret. No compartments (Payton's call).
 *  - Investigations run under a year: in the second quarter of fiscal 2026 the government's industry clearances took
 *    about 243 days for Top Secret and 197 for Secret (Confidential is the same investigation as Secret).
 *  - A clearance stays reinstatable for 24 months after the person leaves the job that needed it.
 *  - Army military-intelligence jobs (the 35 series) want Top Secret.
 *  - FBI special agents: age 23 to under 37, a bachelor's degree, two years of professional experience, about nineteen
 *    weeks at Quantico, a 25 percent availability pay on top of base, retirement at 57 after twenty years of service.
 *  - CIA case officers: a bachelor's degree, a background investigation, entry pay of about $70,685 to $107,590.
 *  - Pay: the 2026 General Schedule for Washington, step 1, GS-9 $70,623, GS-10 $77,771, GS-11 $85,447, GS-12 $102,415,
 *    GS-13 $121,785, GS-14 $143,913, GS-15 $169,279; steps add about 3 percent a year over nine; pay is capped at
 *    $197,200.
 *  - A federal law-enforcement retirement: 1.7 percent of the highest three years' pay for each of the first twenty
 *    years of service and 1 percent for each year after, from age 50 with twenty years in.
 *
 * NOT REAL, named judgements: how often an investigation is denied (no source gave a rate, so every denial number is a
 * dial set to be rare and to bite on a person who has earned it), how hard it is to be hired, how fast the grades rise,
 * how often a mission comes, and what a mission can cost. Every post and place named is made up. The agencies' own
 * titles are loosely theirs. The missions here are quiet yearly outcomes with real stakes; the minigame that decides
 * them is a later ticket, and nothing here stands in for it. American spelling, spoken-style contractions.
 */

import { RETIRE_ELIGIBLE_YEARS, MANDATORY_RETIRE_AGE } from './military';

/* -------------------------------------------------------------------------- */
/* Clearance                                                                   */
/* -------------------------------------------------------------------------- */

export const CLEARANCE_LEVELS = ['confidential', 'secret', 'top-secret'] as const;
export type ClearanceLevel = (typeof CLEARANCE_LEVELS)[number];

export const CLEARANCE_LABELS: Readonly<Record<ClearanceLevel, string>> = {
  confidential: 'Confidential',
  secret: 'Secret',
  'top-secret': 'Top Secret',
};

/** 1 to 3. A higher clearance covers a lower one. */
export const clearanceRank = (level: ClearanceLevel): number => CLEARANCE_LEVELS.indexOf(level) + 1;

/** Whether a clearance of one level covers a job that needs another. */
export const clearanceCovers = (held: ClearanceLevel, needed: ClearanceLevel): boolean =>
  clearanceRank(held) >= clearanceRank(needed);

/** Years a clearance stays good after the job that needed it ends. The real reinstatement window is 24 months. */
export const CLEARANCE_GRACE_YEARS = 2;

/**
 * Days an investigation took, for the lines. Real: Top Secret 243 and Secret 197 (Q2 fiscal 2026); a Confidential is the
 * same investigation as a Secret.
 */
export const INVESTIGATION_DAYS: Readonly<Record<ClearanceLevel, number>> = {
  confidential: 197,
  secret: 197,
  'top-secret': 243,
};

/** The clearance a kind of military work wants. Only the kinds that handle protected material are here. A judgement. */
export const SKILL_CLEARANCE: Readonly<Record<string, ClearanceLevel>> = {
  intelligence: 'top-secret',
  security: 'secret',
  technical: 'secret',
  logistics: 'confidential',
};

/** The level a specialty's skill calls for, or nothing. */
export const clearanceForSkill = (skill: string): ClearanceLevel | undefined =>
  SKILL_CLEARANCE[skill];

/** A clearance an agency job wants. Both the FBI and the CIA want Top Secret. */
export const AGENCY_CLEARANCE: ClearanceLevel = 'top-secret';

/**
 * The chance an investigation of the level turns up something that costs the clearance, before anything about the
 * person. A judgement: low, because almost everyone who is sent for one passes.
 */
export const DENIAL_BASE: Readonly<Record<ClearanceLevel, number>> = {
  confidential: 0.03,
  secret: 0.06,
  'top-secret': 0.1,
};

/** Added for every point of Discipline under this. A person who can't keep to rules is a risk. */
export const DENIAL_DISCIPLINE_FLOOR = 50;
export const DENIAL_PER_DISCIPLINE_POINT = 0.008;
export const DENIAL_DISCIPLINE_MAX = 0.3;

/** Added for a general discharge. A dishonorable discharge is an automatic denial. */
export const DENIAL_GENERAL_DISCHARGE = 0.15;
export const DENIAL_DISHONORABLE = 0.95;

/** Added for a clearance that was taken away before. */
export const DENIAL_AFTER_REVOCATION = 0.5;

/** No investigation is ever sure either way. */
export const DENIAL_MIN = 0.01;
export const DENIAL_MAX = 0.95;

export interface DenialCase {
  readonly level: ClearanceLevel;
  readonly discipline: number;
  /** The most serious discharge of any service so far. */
  readonly worstDischarge?: string;
  readonly revokedBefore: boolean;
}

/** The chance of a denial. Pure, so the dials above and this rule are read together. */
export function denialChance(row: DenialCase): number {
  if (row.worstDischarge === 'dishonorable') return DENIAL_DISHONORABLE;
  let chance = DENIAL_BASE[row.level];
  chance += Math.min(
    DENIAL_DISCIPLINE_MAX,
    Math.max(0, DENIAL_DISCIPLINE_FLOOR - row.discipline) * DENIAL_PER_DISCIPLINE_POINT,
  );
  if (row.worstDischarge === 'general') chance += DENIAL_GENERAL_DISCHARGE;
  if (row.revokedBefore) chance += DENIAL_AFTER_REVOCATION;
  return Math.max(DENIAL_MIN, Math.min(DENIAL_MAX, chance));
}

/* -------------------------------------------------------------------------- */
/* The agencies                                                                */
/* -------------------------------------------------------------------------- */

export const AGENCY_IDS = ['fbi', 'cia'] as const;
export type AgencyId = (typeof AGENCY_IDS)[number];

export interface AgencyRow {
  readonly id: AgencyId;
  /** "the FBI", as it reads after "joined". */
  readonly name: string;
  /** "FBI", for a header or a ledger line. */
  readonly short: string;
  /** "agent", "officer". */
  readonly member: string;
  /** What the first year is called. */
  readonly training: string;
  readonly trainingWeeks: number;
  /** The youngest and the oldest age the door takes. */
  readonly minAge: number;
  readonly maxAge: number;
  /** Years of professional experience the door asks for. Service in uniform counts. */
  readonly experienceYears: number;
  /** The grade a new hire starts at, and the extra grades a person with a clearance and service behind them is given. */
  readonly startGrade: number;
  readonly experiencedLift: number;
  /** Availability pay, as a share of base: the FBI's real 25 percent. */
  readonly availability: number;
  /** Retirement is compulsory at this age, if any. The FBI's real 57; the CIA has none, so the game's 65. */
  readonly retireAge: number;
  /** The titles by grade, GS-9 through GS-15. Loosely each agency's own. */
  readonly titles: Readonly<Record<number, string>>;
  /** The base chance a person who meets the door is hired. A judgement. */
  readonly hireBase: number;
  /** The weight Smarts, Discipline and Health have in how well someone fits. Sums to 1. */
  readonly fit: { readonly smarts: number; readonly discipline: number; readonly health: number };
  /** Made-up posts, for the lines. */
  readonly posts: readonly string[];
}

export const AGENCIES: readonly AgencyRow[] = [
  {
    id: 'fbi',
    name: 'the FBI',
    short: 'FBI',
    member: 'agent',
    training: 'the Academy at Quantico',
    trainingWeeks: 19,
    minAge: 23,
    maxAge: 36,
    experienceYears: 2,
    startGrade: 10,
    experiencedLift: 1,
    availability: 0.25,
    retireAge: 57,
    titles: {
      9: 'Special Agent',
      10: 'Special Agent',
      11: 'Special Agent',
      12: 'Special Agent',
      13: 'Special Agent',
      14: 'Supervisory Special Agent',
      15: 'Assistant Special Agent in Charge',
    },
    hireBase: 0.3,
    fit: { smarts: 0.3, discipline: 0.4, health: 0.3 },
    posts: [
      'the Harlow field office',
      'the Redmond resident agency',
      'a task force in Calder Falls',
      'the Brandt regional office',
    ],
  },
  {
    id: 'cia',
    name: 'the CIA',
    short: 'CIA',
    member: 'officer',
    training: 'the Farm',
    trainingWeeks: 40,
    minAge: 21,
    maxAge: 45,
    experienceYears: 0,
    startGrade: 9,
    experiencedLift: 2,
    availability: 0,
    retireAge: MANDATORY_RETIRE_AGE,
    titles: {
      9: 'Junior Case Officer',
      10: 'Case Officer',
      11: 'Case Officer',
      12: 'Case Officer',
      13: 'Senior Case Officer',
      14: 'Station Chief',
      15: 'Deputy Chief of Mission',
    },
    hireBase: 0.2,
    fit: { smarts: 0.5, discipline: 0.35, health: 0.15 },
    posts: [
      'a desk at headquarters',
      "a station in a capital you can't name",
      'a regional center overseas',
      'a joint office with the embassy',
    ],
  },
];

export const findAgency = (id: string): AgencyRow | undefined =>
  AGENCIES.find((row) => row.id === id);

/** The agency's row, or the FBI's if the id is somehow unknown. */
export const agencyRow = (id: string): AgencyRow => findAgency(id) ?? (AGENCIES[0] as AgencyRow);

export const TOP_AGENCY_GRADE = 15;
export const BOTTOM_AGENCY_GRADE = 9;

/** The title of a grade at an agency. */
export const agencyTitle = (id: string, grade: number): string => {
  const row = agencyRow(id);
  const clamped = Math.max(BOTTOM_AGENCY_GRADE, Math.min(TOP_AGENCY_GRADE, Math.round(grade)));
  return row.titles[clamped] ?? 'Officer';
};

/* -------------------------------------------------------------------------- */
/* Getting in                                                                  */
/* -------------------------------------------------------------------------- */

/** Years of intelligence service that make a person an experienced hire, and the years the bonus tops out at. */
export const EXPERIENCED_INTEL_YEARS = 3;
export const HIRE_INTEL_YEAR_BONUS = 0.02;
export const HIRE_INTEL_YEAR_CAP = 5;

/** Added to the odds of being hired by the clearance somebody already holds, by level. A judgement. */
export const HIRE_CLEARANCE_BONUS: Readonly<Record<ClearanceLevel, number>> = {
  confidential: 0.02,
  secret: 0.06,
  'top-secret': 0.12,
};

export const HIRE_MIN = 0.03;
export const HIRE_MAX = 0.85;

export interface HireCase {
  readonly agency: AgencyId;
  readonly smarts: number;
  readonly discipline: number;
  readonly health: number;
  /** The clearance held and still good, if any. */
  readonly held?: ClearanceLevel;
  /** Whole years served in an intelligence specialty. */
  readonly intelYears: number;
}

/** How well somebody fits the agency, 0 to 100. */
export function agencyFit(
  row: AgencyRow,
  stats: Pick<HireCase, 'smarts' | 'discipline' | 'health'>,
): number {
  return (
    stats.smarts * row.fit.smarts +
    stats.discipline * row.fit.discipline +
    stats.health * row.fit.health
  );
}

/** The chance a person who meets the door is hired. Pure. */
export function hireChance(row: HireCase): number {
  const agency = agencyRow(row.agency);
  let chance = agency.hireBase + (agencyFit(agency, row) - 55) / 100;
  if (row.held) chance += HIRE_CLEARANCE_BONUS[row.held];
  chance += Math.min(HIRE_INTEL_YEAR_CAP, Math.max(0, row.intelYears)) * HIRE_INTEL_YEAR_BONUS;
  return Math.max(HIRE_MIN, Math.min(HIRE_MAX, chance));
}

/** The grade a new hire starts at: the agency's own, lifted for somebody with a clearance and real service behind them. */
export function startingGrade(id: string, held: boolean, intelYears: number): number {
  const row = agencyRow(id);
  const lift = held && intelYears >= EXPERIENCED_INTEL_YEARS ? row.experiencedLift : 0;
  return Math.min(TOP_AGENCY_GRADE, row.startGrade + lift);
}

/**
 * The chance a recruit does not finish the academy, from fit (0 to 100). A judgement, and gentler than basic training's:
 * an agency has already chosen the person from many applicants. About 7% for a typical recruit, 12% for a weak one.
 */
export function academyWashOutChance(fit: number): number {
  return Math.max(0.03, Math.min(0.3, 0.09 + (60 - fit) * 0.004));
}

/* -------------------------------------------------------------------------- */
/* Pay                                                                         */
/* -------------------------------------------------------------------------- */

/** The 2026 General Schedule for Washington, step 1, by grade. Real. */
export const GS_STEP_ONE: Readonly<Record<number, number>> = {
  9: 70_623,
  10: 77_771,
  11: 85_447,
  12: 102_415,
  13: 121_785,
  14: 143_913,
  15: 169_279,
};

/** What a federal salary is capped at. Real, 2026. */
export const GS_PAY_CAP = 197_200;

/** Steps add about 3 percent, up to the ninth step. The real table averages 3.0 percent over its steps. */
export const GS_STEP_GROWTH = 0.03;
export const GS_MAX_STEPS = 9;

/**
 * A year's pay, whole dollars, for a grade and the years served: base pay by step, and the agency's availability pay
 * on top, held to the federal cap on base pay. The step is the years served, capped at the ninth.
 */
export function agencyYearPay(id: string, grade: number, years: number): number {
  const row = agencyRow(id);
  const clamped = Math.max(BOTTOM_AGENCY_GRADE, Math.min(TOP_AGENCY_GRADE, Math.round(grade)));
  const step = Math.max(0, Math.min(GS_MAX_STEPS, Math.floor(years)));
  const base = Math.min(GS_PAY_CAP, (GS_STEP_ONE[clamped] as number) * (1 + GS_STEP_GROWTH * step));
  return Math.round(base * (1 + row.availability));
}

/* -------------------------------------------------------------------------- */
/* Rising                                                                      */
/* -------------------------------------------------------------------------- */

export interface AgencyGradeRow {
  /** The years a person must have spent in the grade below before this one. */
  readonly minYearsBelow: number;
  /** The yearly chance of the rise once the years are in, before performance scales it. */
  readonly rise: number;
}

/** The ladder, by the grade a person rises to. Judgements: a fast climb to GS-12, then a competitive one. */
export const AGENCY_RISES: Readonly<Record<number, AgencyGradeRow>> = {
  10: { minYearsBelow: 1, rise: 0.85 },
  11: { minYearsBelow: 1, rise: 0.85 },
  12: { minYearsBelow: 1, rise: 0.8 },
  13: { minYearsBelow: 2, rise: 0.5 },
  14: { minYearsBelow: 4, rise: 0.025 },
  15: { minYearsBelow: 5, rise: 0.02 },
};

/**
 * The performance below which a year counts against a person, two years running ending the career. A judgement, set from a
 * measurement: after eight years an agent's performance sits between 42 and 54 (a typical one 47 to 52), so 45 is reached
 * by the weak and not by the typical.
 */
export const AGENCY_RETAIN_FLOOR = 45;

/** A federal law-enforcement style retirement, from this age with twenty years in. Real. */
export const AGENCY_PENSION_AGE = 50;
export const AGENCY_PENSION_FIRST_RATE = 0.017;
export const AGENCY_PENSION_AFTER_RATE = 0.01;
export const AGENCY_PENSION_YEARS = RETIRE_ELIGIBLE_YEARS;

/** The retired pay for a career, whole dollars: zero unless it ended in a retirement with enough years and age. */
export function agencyPensionFor(row: {
  readonly how: string;
  readonly years: number;
  readonly endedAge: number;
  readonly highThreeAverage: number;
}): number {
  if (row.how !== 'retired') return 0;
  if (row.years < AGENCY_PENSION_YEARS || row.endedAge < AGENCY_PENSION_AGE) return 0;
  const first = Math.min(row.years, AGENCY_PENSION_YEARS);
  const after = Math.max(0, row.years - AGENCY_PENSION_YEARS);
  const share = Math.min(
    0.8,
    first * AGENCY_PENSION_FIRST_RATE + after * AGENCY_PENSION_AFTER_RATE,
  );
  return Math.round(row.highThreeAverage * share);
}

/* -------------------------------------------------------------------------- */
/* Missions                                                                    */
/* -------------------------------------------------------------------------- */

export type MissionSource = 'military' | AgencyId;

/** How a mission came out. The same four as a deployment's incidents. */
export const MISSION_OUTCOMES = ['clean', 'close', 'mistake', 'disaster'] as const;
export type MissionOutcome = (typeof MISSION_OUTCOMES)[number];

export const MISSION_OUTCOME_LABELS: Readonly<Record<MissionOutcome, string>> = {
  clean: 'It went clean',
  close: 'It was close',
  mistake: 'I made a mistake',
  disaster: 'It went wrong',
};

/** Years of service before a military-intelligence member can be given a mission, and the grade an agent needs. */
export const MISSION_MIN_SERVICE_YEARS = 1;
export const MISSION_MIN_AGENCY_GRADE = 10;

/** The yearly chance a mission is raised, once the gate is open and the member is eligible. A judgement. */
export const MISSION_CHANCE: Readonly<Record<MissionSource, number>> = {
  military: 0.25,
  fbi: 0.3,
  cia: 0.35,
};

/** Mood and stress by outcome. */
export const MISSION_MOOD: Readonly<Record<MissionOutcome, number>> = {
  clean: 2,
  close: 0,
  mistake: -3,
  disaster: -7,
};
export const MISSION_STRESS: Readonly<Record<MissionOutcome, number>> = {
  clean: 0,
  close: 4,
  mistake: 8,
  disaster: 16,
};

/** What an outcome does to the standing and the work, in points. */
export const MISSION_REPUTATION: Readonly<Record<MissionOutcome, number>> = {
  clean: 4,
  close: 1,
  mistake: -8,
  disaster: -18,
};
export const MISSION_PERFORMANCE: Readonly<Record<MissionOutcome, number>> = {
  clean: 3,
  close: 0,
  mistake: -8,
  disaster: -15,
};

/**
 * The chance a failed mission costs the clearance. Only a mistake or a disaster can; a clean or close one never does.
 * A judgement.
 */
export const CLEARANCE_LOSS_ON_MISTAKE = 0.25;
export const CLEARANCE_LOSS_ON_DISASTER = 0.7;

/** The chance a disaster kills. Only a disaster can. A judgement; the agency's work abroad is the riskier. */
export const INTEL_DEATH_ON_DISASTER: Readonly<Record<MissionSource, number>> = {
  military: 0.03,
  fbi: 0.05,
  cia: 0.08,
};

export const INTEL_DEATH_CAUSES: Readonly<Record<MissionSource, string>> = {
  military: 'Killed on an intelligence assignment',
  fbi: 'Killed in the line of duty with the FBI',
  cia: 'Killed on a mission for the CIA',
};

export const INTEL_MISSION_PROMPTS: Readonly<Record<MissionSource, readonly string[]>> = {
  military: [
    "Your unit's intelligence section has a source who'll only meet you. What happens in that room?",
    'A report you wrote is the only thing between a convoy and a bad road. You have to decide how sure you are.',
    "A signal doesn't fit the pattern, and the shift ends in an hour. What do you do with it?",
  ],
  fbi: [
    "A tip has come in on a case that isn't yours, and nobody else has read it yet. How does the day go?",
    'You and your partner are sitting on a door at night. Something moves. How does it end?',
    'A witness will talk, but only to you, and only tonight. What do you do?',
  ],
  cia: [
    "An asset you have run for two years asks to meet somewhere you didn't choose. How does it go?",
    'A package has to cross a border without anyone knowing it exists, and the clock is yours. How does it end?',
    "A cable from a station you trust doesn't add up. What do you do with it?",
  ],
};

export const MISSION_LINES: Readonly<Record<MissionOutcome, readonly string[]>> = {
  clean: [
    'It went as planned. Nobody outside the room will ever know it happened, which is the point.',
    'You did the job and walked out. The file closed without a mark on it.',
    'Quiet, exact, finished. Somebody above you read the report twice and said nothing, which was praise.',
  ],
  close: [
    'It was nearer than you let on to anyone. You got the result and lost some sleep over how.',
    "It worked, but for a minute it didn't look like it would. You wrote the report carefully.",
    'You got through it on instinct. Afterward your hands shook a little, and then they stopped.',
  ],
  mistake: [
    'You read it wrong, and it cost something. The report you wrote afterward was the hardest of your life.',
    "A detail you'd missed turned out to be the whole thing. It's in the file now with your name on it.",
    "You made a call you'd take back. Somebody else had to clean up what it left behind.",
  ],
  disaster: [
    'It went wrong in the way you were trained to avoid. People were hurt, and there was an inquiry.',
    'Everything that could have gone wrong did. You were the one who had to explain it afterward.',
    "It fell apart. There's a review board now, and you're the subject of it.",
  ],
};

export const CLEARANCE_LOST_LINES: Readonly<Record<MissionSource, readonly string[]>> = {
  military: [
    "The review took your clearance. Without it you couldn't stay in intelligence, and they moved you to other work.",
    "Your clearance was pulled. The section couldn't keep you, and you were reassigned.",
  ],
  fbi: [
    "The Bureau suspended your clearance, then revoked it. Without it you couldn't work, and you were let go.",
    "They pulled your clearance. An agent who can't read the files can't do the job, and you were separated.",
  ],
  cia: [
    'The Agency revoked your clearance. That is the end of a career there. You were escorted out.',
    'Your clearance was pulled, and with it everything else. You turned in your badge that afternoon.',
  ],
};

export const KEPT_CLEARANCE_LINES: readonly string[] = [
  'The review let you keep your clearance. It put a mark in your file that will stay there.',
  'They left your clearance alone. Everyone in the building knew what that cost somebody to decide.',
];

export const MISSION_DEATH_LINES: Readonly<Record<MissionSource, readonly string[]>> = {
  military: [
    "You didn't come back from it. The section kept your desk empty for a week.",
    'You were killed on the assignment. Your name went on a wall nobody outside the section will read.',
  ],
  fbi: [
    'You were killed in the line of duty. The Bureau flew a flag at half staff.',
    "You didn't make it home. Another star went on the wall in the lobby.",
  ],
  cia: [
    "You didn't come back. There's a star on the wall at headquarters now, and no name beside it.",
    'You were killed on the mission. Your family was told something close to the truth, years later.',
  ],
};

/* -------------------------------------------------------------------------- */
/* Lines                                                                       */
/* -------------------------------------------------------------------------- */

export const INVESTIGATION_GRANTED_LINES: readonly string[] = [
  'The investigation took about %days% days, and your %level% clearance came through.',
  'After roughly %days% days of interviews and paperwork, you were cleared at %level%.',
];

export const INVESTIGATION_DENIED_LINES: readonly string[] = [
  "The investigation ran about %days% days and came back against you. You weren't cleared.",
  'After roughly %days% days, they denied your clearance.',
];

export const RECLASSIFIED_LINES: readonly string[] = [
  "Without a clearance you couldn't stay in intelligence. They moved you to %job% in %branch%.",
  "They couldn't keep you in the section without a clearance, so you were reassigned to %job%.",
];

export const NOT_CLEARED_LINES: readonly string[] = [
  "You didn't get the clearance the job wanted. It's in your file now.",
  'The adjudicators turned down your clearance. You carried on without it.',
];

export const CLEARANCE_LAPSED_LINES: readonly string[] = [
  "It's been two years since you held a job that needed it, and your %level% clearance has lapsed.",
  'Your %level% clearance ran out. You were out of the work too long for it to be reinstated.',
];

export const CLEARANCE_KEPT_LINES: readonly string[] = [
  "You still hold a %level% clearance. It's good for two years after you leave the work.",
];

export const APPLY_REJECTED_LINES: readonly string[] = [
  "%Agency% went through your application and didn't select you. You can apply again.",
  'You applied to %agency%. A polite letter came back saying they were moving forward with others.',
];

export const APPLY_DENIED_LINES: readonly string[] = [
  "%Agency% offered you the job, then the background investigation ran about %days% days and ended it. You weren't cleared.",
  "They'd wanted you, until the investigation came back after about %days% days. %Agency% withdrew the offer.",
];

export const APPLY_HIRED_LINES: readonly string[] = [
  '%Agency% hired you. %Training% comes first, and then your first post.',
  "You're in. %Agency% took you on, and %training% is next.",
];

export const APPLY_HIRED_CLEARED_LINES: readonly string[] = [
  'Your clearance carried over, and %agency% hired you without a new investigation. %Training% comes first.',
  'They already trusted your clearance. %Agency% took you on, and %training% is next.',
];

export const ACADEMY_LINES: readonly string[] = [
  'You spent %weeks% weeks at %training%: classrooms, scenarios and not enough sleep. You finished.',
  '%Training% took %weeks% weeks. You came out the other side a %member% with a post.',
];

export const ACADEMY_WASH_OUT_LINES: readonly string[] = [
  "You didn't finish %training%. They sent you home, and the door you'd walked through closed behind you.",
  '%Training% was too much, or you were too little for it. You were separated before the end.',
];

export const AGENCY_YEAR_LINES: Readonly<Record<AgencyId, readonly string[]>> = {
  fbi: [
    'A year of cases, paperwork and the occasional night you remembered.',
    'You spent the year on interviews and affidavits, and got a little better at both.',
    "Another year in the field. Most of the job was waiting, and some of it wasn't.",
  ],
  cia: [
    "A year of cables, meetings and things you can't tell anyone.",
    'You spent the year learning a place and the people in it, and writing it all down.',
    'Another year on the work. You were good at keeping it to yourself.',
  ],
};

export const AGENCY_RISE_LINES: readonly string[] = [
  'You were promoted to %title%, at grade %grade%.',
  "The promotion came through: %title%, grade %grade%. It's more money and more files you can't talk about.",
];

export const AGENCY_LET_GO_LINES: readonly string[] = [
  'Two poor years running, and %agency% let you go.',
  "%Agency% separated you for performance. It wasn't a surprise to anyone, including you.",
];

export const AGENCY_RESIGN_LINES: readonly string[] = [
  'You resigned from %agency%, a %title%, and went home.',
  'You turned in your credentials and left %agency% on your own terms.',
];

export const AGENCY_RETIRE_LINES: readonly string[] = [
  'You retired from %agency%, a %title%, after %years% years.',
  'After %years% years, you handed in your badge. You retired from %agency% a %title%.',
];

export const AGENCY_AGE_RETIRE_LINES: readonly string[] = [
  'You reached the age when %agency% sends everyone home. You retired a %title%.',
  "That was the mandatory retirement age. You left %agency% a %title% and didn't look back.",
];

export const AGENCY_PENSION_LINES: readonly string[] = [
  "Your first federal retirement check came. It's about $%pay% a year, for life.",
  'The pension from %agency% began: roughly $%pay% a year, for the rest of your life.',
];
