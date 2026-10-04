/**
 * Ticket 0210 — holding down a job.
 *
 * Spec 1670 gives the verbs: apply, a simple interview abstraction, salary,
 * Work Harder, resign, firing, promotion. This file is the model behind them;
 * nothing here knows about `GameState`, so the balance tooling can run ten
 * thousand careers in plain Node.
 *
 * The shape is deliberately the same as school's, because it is the same shape:
 * a performance number the player never sees, a button that pushes it up most
 * of the time, and consequences that arrive in the feed rather than on a
 * dashboard. Spec 1321 asks careers to be "concise compensation/performance
 * information", not a management screen.
 */

import { clampStat, type StatValue } from '@yearafter/core';
import { licenseReach, meetsLevel, type EducationLevel } from '@yearafter/education';
import type { CareerTrack, Job } from './jobs';
import { TEMPLATES } from './jobs';

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Work Harder, and its absence.
 *
 * Two states, not three, for the reason 0205 gives about Study Harder: a
 * three-way effort setting is something a player configures once and forgets,
 * which is management rather than a decision.
 */
export type WorkEffort = 'steady' | 'hard';

export type LeftBecause = 'resigned' | 'fired' | 'promoted' | 'laid-off';

export interface JobHeld {
  readonly jobId: string;
  /** The player's age when they started it. */
  readonly since: number;
  /** 0–100, never shown as a number (spec 786–795). */
  readonly performance: StatValue;
  readonly effort: WorkEffort;
  /** Times Work Harder has been pressed this year. */
  readonly pushedThisYear: number;
  /** The age Work Harder was last pressed, so the counter can reset on a year. */
  readonly pushedAtAge?: number;
}

export interface JobPast {
  readonly jobId: string;
  readonly from: number;
  readonly to: number;
  readonly because: LeftBecause;
}

export interface EmploymentState {
  readonly job?: JobHeld;
  /**
   * Career-specific reputation (spec 113–118), per track and never global.
   *
   * There is deliberately no `reputation` field on the character. Standing in
   * retail says nothing about standing in trades, and switching tracks means
   * starting the conversation again — which is spec 119's "prior history may
   * influence probability where logical" without it becoming a trap.
   */
  readonly standing: Readonly<Record<string, number>>;
  readonly history: readonly JobPast[];
  /** Job ids applied for this year, so one application is one application. */
  readonly appliedTo: readonly string[];
  readonly appliedAtAge?: number;
  /** The age the current listings were drawn for. Openings refresh yearly. */
  readonly openingsAtAge?: number;
  readonly openings: readonly string[];
}

export const EMPTY_EMPLOYMENT: EmploymentState = {
  standing: {},
  history: [],
  appliedTo: [],
  openings: [],
};

export const standingIn = (state: EmploymentState, track: CareerTrack): number =>
  state.standing[track] ?? START_STANDING;

/**
 * What a stranger's reputation in a field is worth before they have one.
 *
 * Not zero. Zero would mean every first job is judged as though the character
 * had been sacked from that industry, and a school leaver has not been anything
 * yet. Fifty is "no information", which is the truth.
 */
export const START_STANDING = 50;

/* -------------------------------------------------------------------------- */
/* Getting hired                                                               */
/* -------------------------------------------------------------------------- */

export interface Applicant {
  readonly age: number;
  readonly smarts: number;
  readonly charisma: number;
  readonly discipline: number;
  readonly looks: number;
  /** What they actually hold (Ticket 0210b). */
  readonly education: EducationLevel;
  /**
   * Tracks their degree was FOR, if they have one.
   *
   * A nursing degree is worth a great deal in care and very little in
   * logistics, which is the whole reason choosing a major is a decision.
   */
  readonly opens: readonly string[];
  /** Licenses held, by id (Ticket 0406). */
  readonly licenses: readonly string[];
  /** Years of paid work behind them, anywhere. */
  readonly experience: number;
  /** Standing on this job's own track. */
  readonly standing: number;
  /** The highest rung they have ever held on this track. */
  readonly reached: number;
}

export type CannotApply =
  | 'too-young'
  | 'already-applied'
  | 'already-doing-it'
  /** Nobody hires a stranger into the top of a ladder. */
  | 'out-of-reach'
  /** Ticket 0210b. A license or a degree you do not have. */
  | 'needs-education'
  /** Ticket 0406. Specifically the license, which no degree substitutes for. */
  | 'needs-license';

export const CANNOT_APPLY_LABELS: Readonly<Record<CannotApply, string>> = {
  'too-young': 'You are too young for this one.',
  'already-applied': 'You have already applied this year.',
  'already-doing-it': 'This is the job you have.',
  'out-of-reach': 'They would want somebody who has done the job below this.',
  'needs-education': "You don't have the qualification for this one.",
  'needs-license': 'This one is licensed. You would need the qualification first.',
};

/**
 * How far above your best rung you may apply.
 *
 * One. You can reach for the next thing up and you cannot walk in off the
 * street and be made a manager, which is not a rule about ambition — it is what
 * `promotes` is for. Spec 119 keeps the SIDEWAYS move free: rung 0 of any track
 * is open to anybody at any time, at any age, forever, whatever they used to
 * be. That is "a surgeon can transition into acting."
 */
export const REACH = 1;

/**
 * The interview, which is one number.
 *
 * Spec 1670 says "simple interview abstraction" and means it. There is no
 * interview screen, no questions, and no preparation minigame — the player
 * applies, and a week later there is a line in the feed either way.
 *
 * What decides it: whether you have done the job below this one (much the
 * biggest input, and the reason a career is a ladder rather than a menu), how
 * you come across, whether you finished school where that is expected, and the
 * character's own head for the work.
 */
export function hireChance(job: Job, applicant: Applicant): number {
  // Climbing.
  //
  // `reached` is -1 for somebody who has never held anything on this track, and
  // the +1 is what makes RUNG 0 ORDINARY rather than a reach. Without it the
  // model treated the front door as a stretch and the balance measurement found
  // the consequence immediately: ZERO of twelve entry-level jobs would hire a
  // median school leaver, so the entire employment system was unreachable by
  // the only population the build produces. CORE_RULES 13.16, caught at design
  // time this time instead of after shipping.
  //
  // Above that, every extra rung is another -0.3, so applying four rungs up is
  // not merely unlikely, it is the floor.
  const gap = job.rung - (applicant.reached + 1);
  const climb = gap <= 0 ? 0.16 : -0.3 * gap;

  // WHAT THIS TRACK ACTUALLY LOOKS FOR.
  //
  // Measured, and the first version was flat: with charisma and smarts weighted
  // only for sales and office and everything else on a shared 0.1, NINE OF THE
  // TWELVE entry-level jobs came out at exactly 0.56 for the same applicant. A
  // screenshot of the openings screen showed six rows all reading "Worth a
  // shot" — a column that says the same thing on every row is a column the
  // player learns to stop reading, and worse, it meant WHICH job you applied
  // for did not matter.
  //
  // So every track wants somebody different, and a character who is quick and
  // scattered genuinely does better in a restaurant than in a warehouse.
  const wants = TRACK_WANTS[job.track];
  const charm = ((applicant.charisma - 50) / 50) * wants.charisma;
  const smarts = ((applicant.smarts - 50) / 50) * wants.smarts;
  const steady = ((applicant.discipline - 50) / 50) * wants.discipline;
  const known = ((applicant.standing - START_STANDING) / 50) * 0.24;
  // Experience anywhere is worth something everywhere, and it saturates: the
  // difference between one year and four is large, between twelve and fifteen
  // nothing at all.
  const seen = Math.min(1, applicant.experience / 6) * 0.18;

  // The soft door: they would rather you had it. Heavier without, never shut.
  const paper = meetsLevel(applicant.education, job.prefers) ? 0 : -0.24;
  // And the right degree for this field is worth real money. Spec 1821 makes a
  // major the one decision college asks; this is what makes it a decision.
  const relevant = applicant.opens.includes(job.track) ? 0.2 : 0;
  /*
    Ticket 0406. A LICENCE IS WORTH MORE THAN A RELEVANT DEGREE AND LESS THAN
    BOTH. The degree bonus above says "you studied the right thing"; this says
    "you are legally allowed to do this and they do not have to train you",
    which is a stronger claim and is why a licensed plumber walks into work a
    business graduate does not. They stack on purpose — a nursing degree plus
    the practitioner license should beat either alone.
  */
  const licensed = licenseReach(applicant.licenses, job.track) >= 0 ? 0.26 : 0;

  // Measured at 0.42 and rejected: the hire rate came out at 72–79% and did not
  // move between a driven player and one who barely tried, which makes applying
  // a formality rather than a decision. A first application should be roughly a
  // coin flip for somebody ordinary.
  const base = 0.26 - job.rung * 0.05;
  // The HARD door. `canApply` blocks these before the odds are ever asked, so
  // this is the second enforcement point rather than the only one — CORE_RULES
  // 13.15, a gate guards what it hands back as well as what it lets through.
  if (!meetsLevel(applicant.education, job.requires)) return 0;
  // The second hard door, checked here too — CORE_RULES 13.15, a gate guards
  // what it hands back as well as what it lets through.
  if (job.license !== undefined && !applicant.licenses.includes(job.license)) return 0;

  const chance =
    base + climb + charm + smarts + steady + known + seen + paper + relevant + licensed;

  // Never certain in either direction, for the reason `willThey` gives: an
  // employer who always says yes is a vending machine, and one who never does is
  // a wall the player learns to stop pressing.
  return Math.max(0.03, Math.min(0.93, chance));
}

/**
 * What each field is hiring for.
 *
 * The three weights sum to roughly the same total everywhere — no track is
 * easier than another overall, they are easier for DIFFERENT PEOPLE, which is
 * the only version of this that makes the choice mean anything.
 */
export const TRACK_WANTS: Readonly<
  Record<CareerTrack, { charisma: number; smarts: number; discipline: number }>
> = {
  // Front of house. You are hired on how you are with people.
  retail: { charisma: 0.26, smarts: 0.06, discipline: 0.12 },
  food: { charisma: 0.2, smarts: 0.04, discipline: 0.2 },
  sales: { charisma: 0.3, smarts: 0.08, discipline: 0.06 },
  // Nobody cares how you come across at six in the morning in the rain.
  trades: { charisma: 0.04, smarts: 0.1, discipline: 0.3 },
  logistics: { charisma: 0.04, smarts: 0.06, discipline: 0.34 },
  // Head work.
  office: { charisma: 0.08, smarts: 0.28, discipline: 0.08 },
  education: { charisma: 0.16, smarts: 0.22, discipline: 0.06 },
  public: { charisma: 0.06, smarts: 0.24, discipline: 0.14 },
  // Both, and steadiness above either.
  care: { charisma: 0.16, smarts: 0.12, discipline: 0.16 },
  safety: { charisma: 0.1, smarts: 0.12, discipline: 0.22 },
  creative: { charisma: 0.18, smarts: 0.2, discipline: 0.06 },
  // Ticket 0403. Same rule as above — every row sums to 0.44, so no track is
  // easier than another overall.
  tech: { charisma: 0.04, smarts: 0.34, discipline: 0.06 },
  finance: { charisma: 0.08, smarts: 0.26, discipline: 0.1 },
  // The advocate's field: the argument has to land, not just be correct.
  legal: { charisma: 0.14, smarts: 0.26, discipline: 0.04 },
  medicine: { charisma: 0.12, smarts: 0.22, discipline: 0.1 },
  // Front of house again, the same as retail and food.
  hospitality: { charisma: 0.28, smarts: 0.06, discipline: 0.1 },
  /*
    Ticket 0406. The three weights still sum to roughly 0.44 everywhere, which
    is the rule this table has kept since 0210: no track is EASIER, they are
    easier for different people.
  */
  // Somebody else's animal, and an owner who cannot be reasoned with.
  veterinary: { charisma: 0.16, smarts: 0.2, discipline: 0.08 },
  // Millimetres, all day, in a space the size of a mouth.
  dental: { charisma: 0.12, smarts: 0.16, discipline: 0.16 },
  // The last person who checks, so it is the checking that is hired.
  pharmacy: { charisma: 0.08, smarts: 0.18, discipline: 0.18 },
  // Half the job is the drawing and half is the client meeting.
  architecture: { charisma: 0.14, smarts: 0.2, discipline: 0.1 },
};

/**
 * The odds in words, because a player does not know their own odds.
 *
 * BANDED AGAINST THE MEASURED DISTRIBUTION, not against round numbers. A first
 * application runs 0.45–0.70 and somebody with a track record 0.72–0.93, so
 * three bands over that range put almost every row a player ever sees into one
 * of them. Five bands, placed where the density actually is.
 */
export function oddsLabel(chance: number): string {
  if (chance >= 0.82) return 'They want you';
  if (chance >= 0.68) return 'Strong chance';
  if (chance >= 0.54) return 'Decent odds';
  if (chance >= 0.38) return 'Worth a shot';
  if (chance >= 0.2) return 'Long odds';
  return 'A stretch';
}

/* -------------------------------------------------------------------------- */
/* Doing the job                                                               */
/* -------------------------------------------------------------------------- */

/** How often Work Harder actually shows up in the year. Mirrors STUDY_SUCCESS. */
export const WORK_SUCCESS_CHANCE = 0.72;
export const WORK_GAIN_MIN = 5;
export const WORK_GAIN_MAX = 12;
/** Twice a year, and the second is worth less. Same as Study Harder. */
export const PUSHES_PER_YEAR = 2;
export const SECOND_PUSH_SCALE = 0.55;

/**
 * Where performance drifts to when nobody is pushing it.
 *
 * A character who works steadily settles a little above the middle, because
 * most people at most jobs are fine at them. Working hard raises the ceiling
 * they drift towards rather than adding a fixed bonus, so pressing the button
 * every year compounds and pressing it once does not.
 */
export function performanceTarget(effort: WorkEffort, discipline: number, smarts: number): number {
  const aptitude = (discipline * 0.6 + smarts * 0.4 - 50) / 50; // -1 .. 1
  // MEASURED, not guessed. At a steady base of 55 the population's own stats
  // — Discipline p10 56, Smarts p10 70 — carried an unpushed worker to 61
  // against a firing floor of 62, so a character who never once pressed Work
  // Harder was let go 0.1 times in a thirty-two-year career. Firing is a verb
  // spec 1670 asks for by name and it did not exist. At 46 the same character
  // sits at 52, which is what "getting by" should mean.
  const base = effort === 'hard' ? 70 : 46;
  return clampStat(base + aptitude * 14);
}

/** How fast it gets there. Slow, so one bad year is not a career. */
export const DRIFT = 0.34;

export function performanceYear(current: number, target: number): StatValue {
  return clampStat(Math.round(current + (target - current) * DRIFT));
}

/**
 * How much standing a year in this job builds — or costs.
 *
 * Reputation follows performance, lags it, and is much harder to move than
 * performance is. A single good year does not make a name and a single bad one
 * does not lose it, which is the difference between the two numbers and the
 * reason both exist.
 */
export const STANDING_DRIFT = 0.18;

export function standingYear(current: number, performance: number): number {
  return Math.max(0, Math.min(100, Math.round(current + (performance - current) * STANDING_DRIFT)));
}

/* -------------------------------------------------------------------------- */
/* Moving, one way or the other                                                */
/* -------------------------------------------------------------------------- */

/**
 * Whether this year ends with a step up.
 *
 * Needs a rung to step onto — `topOfLadder` callers must check — and needs the
 * year to have gone well. Below `PROMOTION_FLOOR` nobody is being promoted
 * whatever the template says, because a promotion handed to somebody having a
 * bad year is the game not paying attention.
 */
export const PROMOTION_FLOOR = 58;

export function promotionChance(
  job: Job,
  performance: number,
  standing: number,
  years: number,
): number {
  if (performance < PROMOTION_FLOOR) return 0;
  const rules = TEMPLATES[job.template];
  const doingWell = (performance - PROMOTION_FLOOR) / (100 - PROMOTION_FLOOR); // 0..1
  const known = (standing - START_STANDING) / 50;
  // Nobody is promoted in their first year, and being passed over for a decade
  // does not make it likelier — it saturates. The 0.12 rather than a hard zero
  // is the rare case of somebody walking in and being obviously wasted where
  // they are; measured, it is under three per cent even for a stellar first
  // year, which is what "nobody" should mean in a model that never says never.
  const served = Math.min(1, Math.max(0, years - 1) / 4);
  // The stack used to peak at roughly 2.3x the template's base, which put a
  // driven player at a promotion every four years and half of all characters at
  // the TOP RUNG of a ladder by fifty. It peaks near 1.35x now: climbing is
  // most of a working life, which is what a ladder is for.
  const chance =
    rules.promotes * (0.35 + doingWell * 0.85) * (0.12 + served * 0.95) * (1 + known * 0.3);
  return Math.max(0, Math.min(0.55, chance));
}

/**
 * Whether this year ends with being let go.
 *
 * Almost entirely about performance, and floored rather than zeroed even for
 * somebody excellent: a layoff is not a judgement, and spec 1219 lets the
 * economy influence employment.
 */
export const FIRING_SAFE = 62;

export function firingChance(job: Job, performance: number, years: number): number {
  const rules = TEMPLATES[job.template];
  if (performance >= FIRING_SAFE) {
    // The floor. Something can still happen to a good employee.
    return rules.fires * 0.16;
  }
  const badness = (FIRING_SAFE - performance) / FIRING_SAFE; // 0..1
  // A long-serving employee is harder to move, everywhere but the performance
  // template — where the whole arrangement is that you produce or you go.
  const tenure =
    job.template === 'performance' ? 1 : Math.max(0.55, 1 - Math.min(1, years / 12) * 0.45);
  return Math.max(0, Math.min(0.6, rules.fires * (0.2 + badness * 3.4) * tenure));
}
