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
 * twelve openings is choosing; a player looking at a filtered catalog is
 * administrating, which is what spec 20 and the Low-Friction Realism Test exist
 * to prevent.
 */

import { ALL_JOBS, type Job } from './jobs';
import { REACH, type Applicant, type CannotApply } from './employment';
import { licenseReach, meetsLevel, type EducationLevel } from '@yearafter/education';

/** How many listings a year. Enough to choose between, few enough to read. */
export const LISTINGS = 12;

/** P5: at least a couple of eligible listings reflect study or held training. */
export const STUDY_LISTINGS = 2;

/** The age the world starts offering somebody real work. */
export const WORKING_AGE = 16;

export interface OpeningsContext {
  readonly age: number;
  /** What they hold (Ticket 0210b). */
  readonly education: EducationLevel;
  /** Highest rung ever held, per track. Absent means never worked in it. */
  readonly reached: Readonly<Record<string, number>>;
  /** Years of paid work behind them, anywhere. Ticket 0401. */
  readonly experience: number;
  /** Career reputation per track, which is never global (spec 113-118). */
  readonly standing: Readonly<Record<string, number>>;
  /** The job held right now, if any — it is never in its own listings. */
  readonly currentJobId?: string;
  /** Licenses held, by id (Ticket 0406). */
  readonly licenses: readonly string[];
  /** Tracks of the current/last studied major; qualifications still gate jobs. */
  readonly opens?: readonly string[];
}

/**
 * How many years of any work it takes before a stranger stops being a stranger.
 *
 * Ticket 0401, and it is the whole of that ticket. `reached` is -1 on every
 * track a character has never worked, and `cannotApply` reads that as "nobody
 * hires a stranger into the top of a ladder" — correct for the top, wrong for
 * the FIRST step up, which is where it was also being applied. Measured: twenty
 * of the forty-nine jobs were never shown to a single character across a
 * hundred lives, almost all of them rung 1, and a life saw thirteen of
 * forty-nine.
 *
 * Eight years, because that is a career behind you rather than a summer.
 */
export const TRANSFERABLE_AFTER = 8;

/**
 * The standing at which a track lets you reach two rungs instead of one.
 *
 * Being well thought of in your field is the thing that gets somebody looked at
 * for the job two above them, and standing is already per-track (spec 113-118),
 * so this is that reputation finally buying something other than hiring odds.
 */
export const EARNED_REACH_STANDING = 65;

/**
 * The highest rung this character counts as having stood on, for the purpose of
 * what they may APPLY TO. Not what they have done — what the door reads.
 *
 * THIS IS DELIBERATELY NOT WIRED INTO `hireChance`. The gate stops saying no;
 * the odds go on saying it is a stretch. A career changer with fifteen years
 * behind them can apply for the first step up in a trade they have never
 * worked, and `hireChance` still charges them the -0.3 for the gap and pays
 * them back only what their experience and standing are actually worth. Letting
 * this number into the odds as well would have been the same lever applied
 * twice, and the ladder would have stopped meaning anything.
 */
export function reachOf(context: OpeningsContext, track: string): number {
  // Ticket 0406. A license is a rung you are credited with without having stood
  // on it — the apprenticeship somebody paid two years of trade school instead
  // of serving. Taken as a FLOOR rather than a replacement, so a licensed
  // electrician with fifteen years on the tools still reads as fifteen years.
  const papers = licenseReach(context.licenses, track);
  const held = context.reached[track] ?? -1;
  if (held < 0) {
    // Never worked this track. A long career anywhere is worth the front step.
    return Math.max(papers, context.experience >= TRANSFERABLE_AFTER ? 0 : -1);
  }
  const standing = context.standing[track] ?? 50;
  return Math.max(papers, standing >= EARNED_REACH_STANDING ? held + 1 : held);
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
  // Ticket 0406. A second hard door, and a different one: no amount of
  // schooling substitutes for the license, so this cannot be folded into the
  // check above.
  if (job.license !== undefined && !context.licenses.includes(job.license)) return 'needs-license';
  const reached = reachOf(context, job.track);
  if (job.rung > reached + 1 + REACH - 1) return 'out-of-reach';
  return undefined;
}

/**
 * How heavily a job is weighted in this character's listings.
 *
 * EXPORTED SINCE 0410, so the reachability guard can ask the same question the
 * draw answers rather than restating it. 0401's starvation guard flagged
 * Director of pharmacy — eligible to exactly one character in 250, for nine
 * years, never listed — and the only way to tell a hole from bad luck was to
 * know the odds: that job's share of the character's six listings was 10.3% a
 * year, and missing nine independent draws at 10.3% happens 37% of the time.
 *
 * The guard had been comparing against a YEAR COUNT, which is a proxy for the
 * odds and a poor one once the eligible population is one person. It asks this
 * instead. Two copies of a weighting formula is the disagreement CORE_RULES
 * 13.19 exists to prevent, so there is one copy and this is it.
 */
export function listingWeight(context: OpeningsContext, job: Job): number {
  // The SAME effective rung the gate used. Reading the raw held value here
  // while `cannotApply` read the effective one would let a job through the
  // door and then weight it as if it were a cold start — eligible, and still
  // never listed.
  const reached = reachOf(context, job.track);
  const stepUp = job.rung === reached + 1 && reached >= 0;
  const known = reached >= 0;
  /*
      `prefers` BELONGS IN THE ODDS, NOT IN WHAT YOU ARE SHOWN — on a ladder you
      have already climbed (Ticket 0407).

      `hireChance` already charges -0.24 for a soft credential you lack. Halving
      the listing weight as well is the same lever applied twice, which is the
      objection `reachOf`'s own docblock raises about not letting the effective
      rung into the odds. It showed up as a real hole: VP of marketing
      (`requires: none`, `prefers: university`) was eligible to a non-graduate
      who had climbed office to rung three and listed to nobody across 250
      lives, because the one top job they could reach was the one the draw
      penalised them for reaching.

      A cold start in a field they have never worked keeps the penalty. There
      the preference is the employer's whole opinion of them; on a track they
      have three rungs of history in, it is not.
    */
  const wall = !stepUp && !meetsLevel(context.education, job.prefers);
  /*
      A LICENSE PUTS ITS OWN PROFESSION ON YOUR NOTICEBOARD (Ticket 0407).

      Found by 0401's starvation guard once 0406's professional ladders existed
      and 0407 got enough people working to climb them: Senior associate,
      Practice owner, Pharmacy manager and Director of pharmacy were eligible to
      somebody and listed to nobody. A licensed pharmacist competing for six
      slots against a hundred rows they merely qualify for will see pharmacy
      work about as often as anything else, which is not how holding a license
      works and is exactly the "the game believes you could have had it" failure
      this weighting is for.

      It stacks with `stepUp` rather than replacing it, because the two say
      different things — one is "you could move here", the other "this is your
      profession" — and somebody who is both should see it most of all.
    */
  const licensed = licenseReach(context.licenses, job.track) >= 0 ? 2.4 : 1;
  const weight = (stepUp ? 3 : known ? 1.6 : 1) * (wall ? 0.55 : 1) * licensed;
  // A stable draw scaled by weight. Sorting on this is a weighted sample
  // without replacement, and it consumes no RNG state.
  return weight;
}

/** Study is a track match, not a substitute for a required qualification. */
export function fitsStudy(context: OpeningsContext, job: Job): boolean {
  return (
    (context.opens ?? []).includes(job.track) || licenseReach(context.licenses, job.track) >= 0
  );
}

/**
 * The listings for one year.
 *
 * Deterministic given the draw: the caller passes a stable [0,1) per candidate
 * so the same year always produces the same list, which is what lets a save
 * reload onto the same screen. No RNG is consumed here.
 *
 * Entry work still honors age, education and license gates. Spec 119's
 * permissive switching lets a fifty-year-old electrician start in a kitchen; a list
 * that only ever offered somebody more of what they already do would be a trap
 * dressed as a career.
 */
export function openingsFor(context: OpeningsContext, draw: (job: Job) => number): readonly Job[] {
  if (context.age < WORKING_AGE) return [];

  const eligible = ALL_JOBS.filter((job) => cannotApply(job, context) === undefined);

  // Weighted so the thing a character could plausibly move into shows up more
  // often than a cold start in a field they have never touched — without ever
  // removing the cold start, which is the point of the previous paragraph.
  const weighted = eligible.map((job) => ({ job, key: draw(job) / listingWeight(context, job) }));

  weighted.sort((a, b) => a.key - b.key);
  const reserved = weighted.filter(({ job }) => fitsStudy(context, job)).slice(0, STUDY_LISTINGS);
  const reservedIds = new Set(reserved.map(({ job }) => String(job.id)));
  // Scarce fields show every available match, never an ineligible or duplicate
  // row. The remaining slots keep switching into other fields possible.
  return [
    ...reserved,
    ...weighted
      .filter(({ job }) => !reservedIds.has(String(job.id)))
      .slice(0, LISTINGS - reserved.length),
  ]
    .map(({ job }) => job)
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
