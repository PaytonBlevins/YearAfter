/**
 * Ticket 0210 — what is going this year.
 *
 * Spec 1336 is the rule that shapes this: "Do not make inventories so large
 * that search/filtering is necessary. Use curated inventories, contextual
 * gating, and yearly refreshes instead." So the player is never shown
 * forty-nine jobs with a filter bar. They are shown a handful that are actually
 * going, they refresh every year, and the ones they can plausibly get are the
 * ones on the list.
 *
 * That also makes applying a decision rather than a search. A player looking at
 * six openings is choosing; a player looking at a filtered catalog is
 * administrating, which is what spec 20 and the Low-Friction Realism Test exist
 * to prevent.
 */

import { ALL_JOBS, type Job } from './jobs';
import { REACH, type Applicant, type CannotApply } from './employment';
import { meetsLevel, type EducationLevel } from '@yearafter/education';

/** How many listings a year. Enough to choose between, few enough to read. */
export const LISTINGS = 6;

/** The age the world starts offering somebody real work. */
export const WORKING_AGE = 16;

export interface OpeningsContext {
  readonly age: number;
  /** What they hold (Ticket 0210b). */
  readonly education: EducationLevel;
  /** Highest rung ever held, per track. Absent means never worked in it. */
  readonly reached: Readonly<Record<string, number>>;
  /** The job held right now, if any — it is never in its own listings. */
  readonly currentJobId?: string;
}

/**
 * Whether this job could be applied for at all, before any dice.
 *
 * Separate from `hireChance` on purpose, and CORE_RULES 13.15: a gate guards
 * what it hands back, not only what it lets through. `openingsFor` filters on
 * exactly this, and `applyFor` checks it again, because an age gate with one
 * enforcement point is an age gate one careless caller walks around.
 */
export function cannotApply(job: Job, context: OpeningsContext): CannotApply | undefined {
  if (String(job.id) === context.currentJobId) return 'already-doing-it';
  if (context.age < job.minAge) return 'too-young';
  // Ticket 0210b. The hard credential, checked BEFORE the odds — a licensed
  // job is not "unlikely" without the license, it is closed, and the row has to
  // say which. Review: "make it realistic as to what jobs require college
  // degrees and what not."
  if (!meetsLevel(context.education, job.requires)) return 'needs-education';
  const reached = context.reached[job.track] ?? -1;
  if (job.rung > reached + 1 + REACH - 1) return 'out-of-reach';
  return undefined;
}

/**
 * The listings for one year.
 *
 * Deterministic given the draw: the caller passes a stable [0,1) per candidate
 * so the same year always produces the same list, which is what lets a save
 * reload onto the same screen. No RNG is consumed here.
 *
 * Rung 0 of every track is ALWAYS eligible — spec 119's permissive switching
 * means a fifty-year-old electrician can start again in a kitchen, and a list
 * that only ever offered somebody more of what they already do would be a trap
 * dressed as a career.
 */
export function openingsFor(
  context: OpeningsContext,
  draw: (job: Job) => number,
): readonly Job[] {
  if (context.age < WORKING_AGE) return [];

  const eligible = ALL_JOBS.filter((job) => cannotApply(job, context) === undefined);

  // Weighted so the thing a character could plausibly move into shows up more
  // often than a cold start in a field they have never touched — without ever
  // removing the cold start, which is the point of the previous paragraph.
  const weighted = eligible.map((job) => {
    const reached = context.reached[job.track] ?? -1;
    const stepUp = job.rung === reached + 1 && reached >= 0;
    const known = reached >= 0;
    const wall = !meetsLevel(context.education, job.prefers);
    const weight = (stepUp ? 3 : known ? 1.6 : 1) * (wall ? 0.55 : 1);
    // A stable draw scaled by weight. Sorting on this is a weighted sample
    // without replacement, and it consumes no RNG state.
    return { job, key: draw(job) / weight };
  });

  return weighted
    .sort((a, b) => a.key - b.key)
    .slice(0, LISTINGS)
    .map((entry) => entry.job)
    // Presented cheapest-first so the list reads as a ladder rather than as a
    // ranking of what the game thinks you deserve.
    .sort((a, b) => a.pay - b.pay);
}

/** What the player has actually done, in the shape `hireChance` wants. */
export function applicantFor(
  job: Job,
  base: Omit<Applicant, 'standing' | 'reached'>,
  standing: Readonly<Record<string, number>>,
  reached: Readonly<Record<string, number>>,
): Applicant {
  return {
    ...base,
    standing: standing[job.track] ?? 50,
    reached: reached[job.track] ?? -1,
  };
}
