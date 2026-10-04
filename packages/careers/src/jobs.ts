/**
 * Ticket 0210 — the shape of a job.
 *
 * Spec 1670: "25–50 representative jobs initially; apply, simple interview
 * abstraction, salary, Work Harder, resign, firing, promotion." Spec 1461 says
 * careers are data driven with reusable templates and dedicated engines only
 * where behaviour is genuinely unique — so there is one engine here and six
 * templates, and a job is a row in a catalog rather than a class.
 *
 * TWO THINGS THIS FILE DELIBERATELY DOES NOT HAVE.
 *
 * No credential gate. Spec 1819 lists college, and the build does not have one:
 * 0204 shipped preschool → high school → graduated, and nothing beyond. A
 * `requiresDegree` field would therefore be CORE_RULES 13.16 for the fourth
 * time — a gate on a system that has not shipped, locking a whole tier of the
 * catalog behind a door with no handle. Professional work is reached by
 * CLIMBING, which is also spec 119: "the game should allow unlikely
 * reinvention."
 *
 * No quota, no workload line, no travel line. Spec 97 and 104 remove all three
 * by name.
 */

import { JOBS as CATALOG, jobsOnTrack, nextRungAfter, type JobEntry } from '@yearafter/content';
import { asCareerId, type CareerId } from '@yearafter/core';
import { EDUCATION_ORDER, type EducationLevel } from '@yearafter/education';

/**
 * How a job pays and how it moves, which is the only thing a template decides.
 *
 * Spec 1461 names these. They differ in three numbers — how much of pay is at
 * risk, how fast the ladder moves, and how easily you are let go — and in
 * nothing else, because a dedicated engine per template is what spec 1461 says
 * not to build.
 */
export type JobTemplate =
  /** Steady pay, small raises, ordinary risk. Most of the catalog. */
  | 'salary'
  /** Sales, real estate, broking. Wide outcomes (spec 1394), no quota UI. */
  | 'performance'
  /** Skilled manual work. Paid for what you can do, promoted by doing it. */
  | 'trade'
  /** Slow, safe, and hard to be fired from. */
  | 'government'
  /** High floor, long ladder. Reached by climbing, not by a diploma. */
  | 'professional'
  /** Running other people. Almost always reached by promotion. */
  | 'management';

/**
 * The field a job belongs to, and the thing career reputation attaches to.
 *
 * Spec 113–118: "Reputation is career-specific, not one overarching global
 * characteristic." So there is no `reputation` stat anywhere in this package —
 * there is standing in retail, and standing in trades, and they know nothing
 * about each other.
 */
export type CareerTrack =
  | 'retail'
  | 'food'
  | 'trades'
  | 'office'
  | 'care'
  | 'logistics'
  | 'sales'
  | 'creative'
  | 'public'
  // Education and public safety are their own ladders rather than rungs of
  // public service. The catalog's own check found why: a teacher sat one rung
  // above a police officer and was paid less, so the promotion the model would
  // have offered was a pay cut.
  | 'education'
  | 'safety'
  // Ticket 0403. `medicine` is doctors, gated on `postgraduate` from the rung
  // where the license would actually be required — `care` stays nursing and
  // support work, the same way `education` stayed separate from `public`.
  | 'tech'
  | 'finance'
  | 'legal'
  | 'medicine'
  | 'hospitality'
  /*
    Ticket 0406. Four professions with a school in front of them.

    SEPARATE LADDERS RATHER THAN RUNGS OF `medicine` AND `care`, for the reason
    `education` was split from `public` and `medicine` from `care`: a dentist
    is not a promotion from a physician and a veterinary nurse does not step up
    into a pharmacy. Folding them in would have made `promotionFrom` offer
    moves between professions that require entirely different licenses.
  */
  | 'veterinary'
  | 'dental'
  | 'pharmacy'
  | 'architecture';

export const TRACK_LABELS: Readonly<Record<CareerTrack, string>> = {
  retail: 'Retail',
  food: 'Food and drink',
  trades: 'Trades',
  office: 'Office work',
  care: 'Care and health',
  logistics: 'Logistics',
  sales: 'Sales',
  creative: 'Creative',
  public: 'Public service',
  education: 'Education',
  safety: 'Public safety',
  tech: 'Technology',
  finance: 'Finance',
  legal: 'Legal',
  medicine: 'Medicine',
  hospitality: 'Hospitality',
  veterinary: 'Veterinary',
  dental: 'Dentistry',
  pharmacy: 'Pharmacy',
  architecture: 'Architecture',
};

export interface Job {
  readonly id: CareerId;
  readonly title: string;
  readonly track: CareerTrack;
  /**
   * Where this sits on its track's ladder. 0 is the way in.
   *
   * Promotion moves you from `rung` to `rung + 1` on the same track. A track
   * with one rung is a job with nowhere to go, which is a real thing for a
   * person to be in and is allowed.
   */
  readonly rung: number;
  readonly template: JobTemplate;
  /**
   * Whole dollars a year, before anything.
   *
   * This is the number the Career screen SHOWS, and it is a real salary,
   * because spec 1827 asks for realistic ranges and a player who is told they
   * earn $31,000 should be told the truth. What reaches the character's cash is
   * a different and much smaller number — see `livingCostOf`.
   */
  readonly pay: number;
  /**
   * How wide the outcome is, as a fraction of `pay`.
   *
   * Zero for a salaried job: you are paid what you are paid. Large for the
   * performance template, which spec 1394 asks to have "wide outcome
   * distributions driven by approved attributes, career reputation, experience,
   * and opportunities."
   */
  readonly spread: number;
  /** Nobody hires a twelve-year-old. Gigs are what a child does. */
  readonly minAge: number;
  /**
   * The credential you legally cannot do this job without.
   *
   * Ticket 0210b made this real. 0210 shipped with no hard requirement anywhere
   * — deliberately, because the build had no college and gating on one would
   * have been CORE_RULES 13.16 — and review asked for the door: *"Please make it
   * realistic as to what jobs require college degrees and what not."*
   *
   * It is a SHORT list on purpose: licensed and credentialed work only. A nurse
   * needs the license, a teacher needs the degree, a principal needs the
   * graduate one. A store manager does not, and the highest-paying job in the
   * catalog is still reachable with no diploma at all, because spec 119 keeps
   * reinvention open and spec 1405 keeps major life paths unlocked.
   */
  readonly requires: EducationLevel;
  /**
   * The credential they would rather you had.
   *
   * A heavier door, never a shut one — the shape `wantsDiploma` had in 0210,
   * kept for everything that is a preference rather than a law.
   */
  readonly prefers: EducationLevel;
  /**
   * A license this job legally requires, on top of any degree (Ticket 0406).
   *
   * ORTHOGONAL TO `requires`, AND THAT IS THE POINT. `requires` is a rung on an
   * ordered ladder, so it can only ever say "this much schooling or more" — and
   * "postgraduate or more" was the only thing standing between a master's in
   * fine arts and a surgical ward. A license is not ordered and does not
   * substitute: you either sat the exam or you did not.
   *
   * It also runs the other way. `lic.electrical` gates nothing on the trades
   * ladder — that ladder is an apprenticeship and stays open to everybody — but
   * holding it is what makes two years of trade school buy something.
   */
  readonly license?: string;
  /**
   * Hidden capacity this consumes, 0–100 (spec 661, 1985).
   *
   * There is no visible time budget and never will be. This feeds the stress
   * model the same way school hours do, so a character who works nights and has
   * three children pays for it without anybody drawing them a calendar.
   */
  readonly demand: number;
  /** One line for the listing. Spec 97 removes Workload and Travel from these. */
  readonly blurb: string;
}

export const isEntryLevel = (job: Job): boolean => job.rung === 0;

/* -------------------------------------------------------------------------- */
/* What a template decides                                                     */
/* -------------------------------------------------------------------------- */

export interface TemplateRules {
  /** Fraction of pay that rides on performance. Spec 1394's "wide outcomes". */
  readonly atRisk: number;
  /** Base chance of a promotion in a year, before performance. */
  readonly promotes: number;
  /** Base chance of being let go in a year, before performance. */
  readonly fires: number;
  /** Annual raise for staying put, as a fraction. */
  readonly raise: number;
}

/**
 * What comes with the job, beyond the salary.
 *
 * Spec 1699 asks to "display concise benefits" and spec 1827 says they "can
 * include bonuses, retirement match, pensions where appropriate, but avoid
 * insurance gameplay" — so this is one short line per template and there is
 * nothing to manage. Derived from the template rather than authored per job,
 * because forty-nine hand-written benefit strings would drift from the pay
 * model the first time somebody changed a template.
 */
export const BENEFITS: Readonly<Record<JobTemplate, string>> = {
  salary: 'Retirement match, paid time off.',
  performance: 'A cut of everything you bring in.',
  trade: 'Overtime, tools, and a per-diem on travel.',
  government: 'Pension, and it is a real one.',
  professional: 'Retirement match, and they pay for training.',
  management: 'Bonus tied to what the team does.',
};

/**
 * The share of pay at risk above which a job genuinely pays COMMISSION.
 *
 * Ticket 0304, fixing a guard 0301 wrote that could never fail. The employment
 * phase posted a separate `commission` row whenever `commission > 0`, and its
 * comment said why: *"a ledger that wrote '$1,400 of commission' for a school
 * administrator every year would be technically true and misleading"*. Every
 * template in this table has a non-zero `atRisk`, so the guard was true for
 * every job in the catalog — measured across 5,270 working years, a commission
 * row was written in 5,270 of them, including for government clerks at two per
 * cent. The intent was right and the test was of the wrong quantity.
 *
 * A job pays commission when the at-risk share is most of the point of the job,
 * not when this year's variation happens to be positive. Below the line it is a
 * salary that moves about a bit, and it belongs in the `salary` row where a
 * player would look for it.
 */
export const COMMISSION_FROM = 0.2;

export const TEMPLATES: Readonly<Record<JobTemplate, TemplateRules>> = {
  salary: { atRisk: 0.06, promotes: 0.11, fires: 0.05, raise: 0.02 },
  // The one the spec singles out twice. Half the money is on the table.
  performance: { atRisk: 0.5, promotes: 0.13, fires: 0.09, raise: 0.01 },
  trade: { atRisk: 0.12, promotes: 0.1, fires: 0.05, raise: 0.025 },
  // Spec 1836 asks for realistic public pay and progression. The trade here is
  // that it is slow and it is safe, and a player should feel both.
  government: { atRisk: 0.02, promotes: 0.07, fires: 0.015, raise: 0.022 },
  professional: { atRisk: 0.08, promotes: 0.08, fires: 0.035, raise: 0.028 },
  management: { atRisk: 0.16, promotes: 0.07, fires: 0.07, raise: 0.03 },
};

/* -------------------------------------------------------------------------- */
/* The catalog, typed                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The JSON is loose (`track: string`) because `@yearafter/content` must not
 * depend on this package — content is the bottom of the stack. So the widening
 * happens once, here, at the boundary, and everything above it is typed.
 *
 * A row whose track or template is not one this build knows is DROPPED rather
 * than coerced. A catalog written by a newer generator than the code reading it
 * is a real situation once saves outlive builds, and silently treating an
 * unknown template as `salary` would pay somebody the wrong money forever.
 */
const level = (value: string): EducationLevel =>
  (EDUCATION_ORDER as readonly string[]).includes(value) ? (value as EducationLevel) : 'none';

const widen = (entry: JobEntry): Job | undefined => {
  if (!(entry.track in TRACK_LABELS)) return undefined;
  if (!(entry.template in TEMPLATES)) return undefined;
  return {
    id: asCareerId(entry.id),
    title: entry.title,
    track: entry.track as CareerTrack,
    rung: entry.rung,
    template: entry.template as JobTemplate,
    pay: entry.pay,
    spread: entry.spread,
    minAge: entry.minAge,
    requires: level(entry.requires),
    prefers: level(entry.prefers),
    ...(entry.license ? { license: entry.license } : {}),
    demand: entry.demand,
    blurb: entry.blurb,
  };
};

export const ALL_JOBS: readonly Job[] = CATALOG.map(widen).filter(
  (job): job is Job => job !== undefined,
);

const JOBS_BY_ID = new Map(ALL_JOBS.map((job) => [String(job.id), job]));

export const findJob = (id: string): Job | undefined => JOBS_BY_ID.get(id);

/**
 * Does this job pay commission, in the sense spec 1677 gives the word?
 *
 * A property of the TEMPLATE, not of how a particular year went. Asked once,
 * here, so the ledger and any screen that reads it give the same answer — the
 * alternative is two places deciding what counts as commission, which is
 * CORE_RULES 13.23 with a category name attached.
 */
export const paysCommission = (job: Job): boolean =>
  TEMPLATES[job.template].atRisk >= COMMISSION_FROM;

export const jobsIn = (track: CareerTrack): readonly Job[] =>
  jobsOnTrack(track)
    .map(widen)
    .filter((job): job is Job => job !== undefined);

/** The rung above, if the ladder goes any higher. */
export const promotionFrom = (job: Job): Job | undefined => {
  const entry = CATALOG.find((row) => row.id === String(job.id));
  if (!entry) return undefined;
  const next = nextRungAfter(entry);
  return next ? widen(next) : undefined;
};

export const topOfLadder = (job: Job): boolean => promotionFrom(job) === undefined;

/** Every track that has a job in it, typed. */
export const ALL_TRACKS: readonly CareerTrack[] = [
  ...new Set(ALL_JOBS.map((job) => job.track)),
].sort();
