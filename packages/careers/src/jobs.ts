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
  | 'safety';

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
   * Whether finishing school is expected.
   *
   * NOT a degree — see the header. This is the one credential the build can
   * actually produce, and 0210 makes leaving school early reachable so that it
   * separates anybody at all. A job that expects a diploma is HARDER to get
   * without one, never impossible: spec 119 keeps reinvention open.
   */
  readonly wantsDiploma: boolean;
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
    wantsDiploma: entry.wantsDiploma,
    demand: entry.demand,
    blurb: entry.blurb,
  };
};

export const ALL_JOBS: readonly Job[] = CATALOG.map(widen).filter(
  (job): job is Job => job !== undefined,
);

const JOBS_BY_ID = new Map(ALL_JOBS.map((job) => [String(job.id), job]));

export const findJob = (id: string): Job | undefined => JOBS_BY_ID.get(id);

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
