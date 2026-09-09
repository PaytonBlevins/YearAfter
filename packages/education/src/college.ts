/**
 * Ticket 0210b — university and graduate school.
 *
 * Review, after playing 0210: *"when you graduate from highschool, there is no
 * college or post graduate options. Those are Necessary!"* They were: spec 1820
 * lists "college/university, majors" among the required systems and 0204 shipped
 * without them, so every character in the game left education at eighteen and a
 * job that wanted a degree was gated on a door that did not exist.
 *
 * WHAT THE SPEC ALLOWS, AND WHAT IT FORBIDS
 *
 * Spec 1821: "Lightweight interaction: major + Study Harder is generally
 * enough." Spec 75: "School should be intentionally lightweight so players reach
 * the adult world quickly." So the whole of college is: choose a major, turn up,
 * press Study Harder, and either finish or do not.
 *
 * Spec 1822 and section 79 remove **test performance and school quality** from
 * admission by name. There is no SAT, no application essay, no college ranking
 * and no acceptance minigame. What decides admission is the record the player
 * already built — their grades — and what it costs.
 *
 * Spec 1823: "Full-time work during college is allowed; stress/performance
 * handles overcommitment." So nothing here blocks a job. The hidden capacity
 * model bills the character for trying to do both, and they read about it
 * afterwards.
 *
 * Spec 1824 and section 90 remove attendance, sleep, class-by-class management,
 * a workload-budget UI and leave-of-absence. None of those exist here.
 */

/* -------------------------------------------------------------------------- */
/* What a character has actually finished                                      */
/* -------------------------------------------------------------------------- */

/**
 * The credential a character holds, as a ladder.
 *
 * Ordered, so a job can name a floor and everything above it clears. Kept
 * separate from `stage` because "in school" and "has a degree" are different
 * questions and a single field answering both is the mistake that made
 * `graduated` mean two things.
 */
export type EducationLevel = 'none' | 'highSchool' | 'university' | 'postgraduate';

export const EDUCATION_ORDER: readonly EducationLevel[] = [
  'none',
  'highSchool',
  'university',
  'postgraduate',
];

export const EDUCATION_LABELS: Readonly<Record<EducationLevel, string>> = {
  none: 'No diploma',
  highSchool: 'High school',
  university: 'University degree',
  postgraduate: 'Graduate degree',
};

/** Ages at which each credential was earned. Absent means never. */
export interface Credentials {
  readonly highSchool?: number;
  readonly university?: number;
  readonly postgraduate?: number;
}

export function levelOf(credentials: Credentials | undefined): EducationLevel {
  if (!credentials) return 'none';
  if (credentials.postgraduate !== undefined) return 'postgraduate';
  if (credentials.university !== undefined) return 'university';
  if (credentials.highSchool !== undefined) return 'highSchool';
  return 'none';
}

export const meetsLevel = (held: EducationLevel, required: EducationLevel): boolean =>
  EDUCATION_ORDER.indexOf(held) >= EDUCATION_ORDER.indexOf(required);

/* -------------------------------------------------------------------------- */
/* Majors                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What you studied, and the only real decision college asks.
 *
 * Spec 1821 says "major + Study Harder is generally enough", and spec 365 gives
 * Biology as its example — so a major is a single choice made once that changes
 * which careers open up, not a curriculum to manage.
 *
 * A major maps to CAREER TRACKS rather than to individual jobs. Naming jobs here
 * would put the same knowledge in two catalogs and guarantee they drift; naming
 * tracks means adding a job to a track opens it to the right graduates for free.
 */
export interface Major {
  readonly id: string;
  readonly name: string;
  /** One line, for the row it renders in. Under 40 characters — 0210's lesson. */
  readonly blurb: string;
  /** Tracks this degree is genuinely FOR. Others still hire you, less readily. */
  readonly opens: readonly string[];
  /** Some subjects are harder to pass, and it should cost something to pick one. */
  readonly difficulty: number;
}

export const MAJORS: readonly Major[] = [
  {
    id: 'major.nursing',
    name: 'Nursing',
    blurb: 'Long hours, and always work at the end.',
    opens: ['care'],
    difficulty: 0.6,
  },
  {
    id: 'major.education',
    name: 'Education',
    blurb: 'You will be in a classroom either way.',
    opens: ['education'],
    difficulty: 0.35,
  },
  {
    id: 'major.business',
    name: 'Business',
    blurb: 'Broad, and it goes almost anywhere.',
    opens: ['office', 'retail', 'sales', 'logistics'],
    difficulty: 0.4,
  },
  {
    id: 'major.engineering',
    name: 'Engineering',
    blurb: 'Hard, and the hardest to walk away from.',
    opens: ['trades', 'office', 'logistics'],
    difficulty: 0.75,
  },
  {
    id: 'major.arts',
    name: 'Fine arts',
    blurb: 'Everybody has an opinion about this one.',
    opens: ['creative'],
    difficulty: 0.3,
  },
  {
    id: 'major.criminology',
    name: 'Criminal justice',
    blurb: 'A degree with a uniform at the end of it.',
    opens: ['safety', 'public'],
    difficulty: 0.45,
  },
  {
    id: 'major.publicadmin',
    name: 'Public administration',
    blurb: 'How a city actually runs.',
    opens: ['public', 'office'],
    difficulty: 0.45,
  },
  {
    id: 'major.hospitality',
    name: 'Hospitality',
    blurb: 'Food, rooms, and other people.',
    opens: ['food', 'retail'],
    difficulty: 0.3,
  },
];

export const findMajor = (id: string): Major | undefined => MAJORS.find((major) => major.id === id);

/* -------------------------------------------------------------------------- */
/* Getting in                                                                  */
/* -------------------------------------------------------------------------- */

/** Nobody starts a degree before this. */
export const COLLEGE_AGE = 18;
/** Years a bachelor's takes. */
export const COLLEGE_YEARS = 4;
/** Years a graduate program takes on top. */
export const POSTGRAD_YEARS = 2;

/**
 * What a year of it costs, in whole dollars.
 *
 * Real money, because 0210 gave the game money and 0209 already built a parent
 * who can help with college — a request that meant nothing until now. It is
 * charged per year rather than up front so working through it is a real
 * strategy (spec 1823) rather than a wall at the start.
 *
 * Not a loan. Spec says nothing about student debt and 0307 owns the loan
 * engine; until then a character pays what they can and the shortfall stops
 * them enrolling rather than putting them in the red.
 */
export const TUITION_PER_YEAR = 9_400;
export const POSTGRAD_TUITION_PER_YEAR = 13_200;

/**
 * Whether they get in.
 *
 * NO TEST PERFORMANCE AND NO SCHOOL QUALITY — spec 1822 and section 79 remove
 * both by name, so there is no exam to sit and no ranking to clear. What decides
 * it is the academic record the player has been building since they were six,
 * which is `performance`, and that is the whole point of Study Harder having
 * existed for twelve years by this moment.
 *
 * Generous at the bottom on purpose. Somewhere will take almost anybody, which
 * is true, and which keeps CORE_RULES 13.16 satisfied: a system nobody can get
 * into is not a system.
 */
export const ADMISSION_FLOOR = 0.35;
export const ADMISSION_CEILING = 0.97;

export function admissionChance(performance: number, academics: boolean): number {
  const record = (performance - 45) / 45; // roughly -1 .. 1 across the real range
  const chance = 0.62 + record * 0.3 + (academics ? 0.08 : 0);
  return Math.max(ADMISSION_FLOOR, Math.min(ADMISSION_CEILING, chance));
}

/** Graduate school looks at what you did as an undergraduate, and less kindly. */
export function postgradChance(performance: number, academics: boolean): number {
  const record = (performance - 58) / 42;
  const chance = 0.48 + record * 0.36 + (academics ? 0.1 : 0);
  return Math.max(0.12, Math.min(0.94, chance));
}

/* -------------------------------------------------------------------------- */
/* Getting through it                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Where performance heads while studying this major.
 *
 * The same drift model school uses, with the major's difficulty pulling the
 * target down. A hard subject is genuinely harder to do well in, which is the
 * cost of picking the one that opens the best jobs.
 */
export function collegeTarget(
  smarts: number,
  discipline: number,
  effortBonus: number,
  difficulty: number,
  academics: boolean,
): number {
  const aptitude = (smarts * 1.05 + discipline * 0.45 - 40) / 1;
  return aptitude + effortBonus + (academics ? 8 : 0) - difficulty * 26;
}

/**
 * Failing out.
 *
 * A real outcome, and the reason grades still matter after eighteen — but it
 * takes a sustained collapse rather than one bad year, the same shape as
 * leaving school early. Measured against the population, not against what the
 * word means: see CORE_RULES 13.25.
 */
export const FAILING_OUT = 55;
export const FAIL_OUT_CHANCE = 0.34;
