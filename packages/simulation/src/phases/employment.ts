/**
 * Ticket 0210 — the employment phase.
 *
 * Sixth phase module, and like every other one its position is load-bearing. It
 * runs AFTER education and BEFORE events and stress:
 *
 *  - after education, because leaving school is what makes somebody available
 *    to work, and the year they graduate they should be able to be working;
 *  - before events, so an event this year can fire at somebody who has a job;
 *  - before stress, because the hours the job takes are part of the year stress
 *    is summarising, and a phase that ran after it would be billing a year that
 *    had already been totalled.
 *
 * What happens here, in order: the year's work is done, it is paid for, and
 * then somebody else decides whether you are moving up or out. The player
 * presses none of it. Spec 1670 lists promotion and firing as things the ticket
 * must have, and neither is a button — that asymmetry is the same one 0209
 * built for parents, and it is the reason a job feels like a job.
 */

import type { TimelineKind } from '@yearafter/character';
import {
  ALL_JOBS,
  START_STANDING,
  findJob,
  firingChance,
  payFor,
  performanceTarget,
  performanceYear,
  promotionChance,
  promotionFrom,
  savedFrom,
  standingYear,
  type EmploymentState,
  type Job,
} from '@yearafter/careers';
import { clampStat, type StatValue } from '@yearafter/core';
import { livingChildren, type Household } from '@yearafter/relationships';
import type { RandomStream } from '../rng/rng';
import { stableUnit } from '../rng/rng';

export interface EmploymentPhaseInput {
  readonly employment: EmploymentState;
  readonly stream: RandomStream;
  readonly age: number;
  readonly worldYear: number;
  readonly family: Household;
  readonly discipline: number;
  readonly smarts: number;
}

export interface EmploymentPhaseOutput {
  readonly employment: EmploymentState;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
  /**
   * Whole dollars the year left the character with, signed.
   *
   * Negative when a household costs more than it earns, which is a real thing
   * and the only reason the salary means anything. `advanceYear` is responsible
   * for never taking cash below zero (CORE_RULES 13.13).
   */
  readonly saved: number;
  /** Gross pay for the year, for the line that names it (CORE_RULES 13.6). */
  readonly earned: number;
  /** Hidden capacity the job consumed, for the stress phase (spec 661). */
  readonly demand: number;
}

export function runEmployment(input: EmploymentPhaseInput): EmploymentPhaseOutput {
  const lines: { kind: TimelineKind; text: string }[] = [];
  let employment = input.employment;
  const held = employment.job;

  if (!held) {
    return { employment, lines, saved: 0, earned: 0, demand: 0 };
  }

  const job = findJob(held.jobId);
  if (!job) {
    // A job id the catalog no longer has. Drop it rather than crash: a save can
    // outlive the build that wrote it, and a character stuck holding a job that
    // does not exist would be unable to apply for another one forever.
    return {
      employment: { ...employment, job: undefined },
      lines,
      saved: 0,
      earned: 0,
      demand: 0,
    };
  }

  /* ---- the year's work ----------------------------------------------------- */
  const years = Math.max(0, input.age - held.since);
  const target = performanceTarget(held.effort, input.discipline, input.smarts);
  const performance = performanceYear(held.performance, target);
  const track = job.track;
  const standingWas = employment.standing[track] ?? START_STANDING;
  const standing = standingYear(standingWas, performance);

  /* ---- what it paid -------------------------------------------------------- */
  //
  // Dependents are the household this wage has to cover. Children only: a
  // partner is a person, not a cost, and modelling a spouse as a drain would be
  // both wrong and the kind of thing a player notices.
  const dependents = livingChildren(input.family).length;
  const earned = payFor(job, years, performance, standing);
  const saved = savedFrom(earned, dependents);

  lines.push({ kind: 'career', text: payLine(job, earned, saved, dependents, input.age) });

  /* ---- and then somebody else decides -------------------------------------- */
  let stillThere = true;

  const next = promotionFrom(job);
  if (next && input.stream.chance(promotionChance(job, performance, standing, years))) {
    employment = {
      ...employment,
      job: {
        // A promotion is a new job, so the clock starts again — but performance
        // does NOT reset to a stranger's. You are the same person; the standard
        // is higher, which is what the drop is.
        jobId: String(next.id),
        since: input.age,
        performance: clampStat(performance - 12) as StatValue,
        effort: held.effort,
        pushedThisYear: 0,
      },
      history: [
        ...employment.history,
        { jobId: held.jobId, from: held.since, to: input.age, because: 'promoted' as const },
      ],
      standing: { ...employment.standing, [track]: standing },
    };
    lines.push({ kind: 'career', text: promotedLine(next, input.age) });
    stillThere = false;
  } else if (input.stream.chance(firingChance(job, performance, years))) {
    // A layoff and a sacking are different lines about different years, and the
    // difference is whether the character was actually doing the job.
    const because = performance >= 55 ? ('laid-off' as const) : ('fired' as const);
    employment = {
      ...employment,
      job: undefined,
      history: [
        ...employment.history,
        { jobId: held.jobId, from: held.since, to: input.age, because },
      ],
      standing: {
        ...employment.standing,
        // Being let go costs standing in the field. Being laid off costs less,
        // because everybody knows the difference.
        [track]: Math.max(0, standing - (because === 'fired' ? 9 : 3)),
      },
    };
    lines.push({ kind: 'career', text: leftLine(because, job, input.age) });
    stillThere = false;
  }

  if (stillThere) {
    employment = {
      ...employment,
      job: {
        ...held,
        performance,
        // The counter is per year, so a new year hands the buttons back.
        pushedThisYear: 0,
      },
      standing: { ...employment.standing, [track]: standing },
    };
  }

  return { employment, lines, saved, earned, demand: job.demand };
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * CORE_RULES 13.22 from the start: the base holds still, age does the moving.
 *
 * These are the lines a player reads EVERY YEAR for forty years, which makes
 * them the most-repeated copy in the game by a wide margin — so the sets are
 * long and the pay line has three different shapes depending on how the year
 * actually went, rather than one shape with a number swapped into it.
 */
function pick(lines: readonly string[], key: string, age: number): string {
  const base = Math.floor(stableUnit(key) * lines.length);
  return lines[(base + age) % lines.length] as string;
}

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

/**
 * The one line a working year always writes.
 *
 * CORE_RULES 13.6: any change to money names its source AND its amount. Both
 * numbers appear — what the job paid and what was left — because the gap
 * between them is the entire cost-of-living model and a player who is only told
 * one of them will think the other is a bug.
 */
function payLine(job: Job, earned: number, saved: number, dependents: number, age: number): string {
  if (saved < 0) {
    return pick(BEHIND_LINES, `pay:${String(job.id)}:behind`, age)
      .replace(/\{earned\}/g, money(earned))
      .replace(/\{short\}/g, money(-saved))
      .replace(/\{job\}/g, job.title.toLowerCase());
  }
  if (saved < earned * 0.04) {
    return pick(TIGHT_LINES, `pay:${String(job.id)}:tight`, age)
      .replace(/\{earned\}/g, money(earned))
      .replace(/\{saved\}/g, money(saved))
      .replace(/\{job\}/g, job.title.toLowerCase());
  }
  return pick(dependents > 0 ? FAMILY_LINES : FINE_LINES, `pay:${String(job.id)}`, age)
    .replace(/\{earned\}/g, money(earned))
    .replace(/\{saved\}/g, money(saved))
    .replace(/\{job\}/g, job.title.toLowerCase());
}

const FINE_LINES: readonly string[] = [
  'Earned {earned} and had {saved} of it left at the end.',
  'A year of it. {earned}, and {saved} that did not get spent.',
  '{earned} for the year. {saved} still there in December.',
  'The job paid {earned}. You put {saved} aside without really trying.',
  'Made {earned}. Living took most of it and left {saved}.',
];

const FAMILY_LINES: readonly string[] = [
  'Earned {earned}. After everybody was fed and covered, {saved} was left.',
  '{earned} for the year, and {saved} of it survived the household.',
  'The job paid {earned}. {saved} of that was still yours by December.',
  'Made {earned}. The family took what it takes; {saved} stayed put.',
];

const TIGHT_LINES: readonly string[] = [
  'Earned {earned} and finished the year {saved} up, which is not much.',
  '{earned} came in and almost exactly {earned} went out. {saved} left.',
  'A year of it for {earned}, and {saved} to show for it.',
  'Made {earned}. Broke about even, and {saved} is what even looks like.',
];

const BEHIND_LINES: readonly string[] = [
  'Earned {earned} and still went {short} backwards over the year.',
  '{earned} was not enough. The year ended {short} down.',
  'Worked all year for {earned} and finished {short} worse off.',
  'The {job} money did not cover it. Down {short} by December.',
];

const PROMOTED_LINES: readonly string[] = [
  'Promoted. {job}, starting Monday, and a raise that took a month to arrive.',
  'They moved you up. {job}, and the person who had it before you was not pleased.',
  'Made {job}. You had wanted it long enough to be surprised it happened.',
  'Promoted to {job}. Somebody had put your name forward without telling you.',
];

const promotedLine = (job: Job, age: number): string =>
  pick(PROMOTED_LINES, `promoted:${String(job.id)}`, age).replace(/\{job\}/g, job.title);

const FIRED_LINES: readonly string[] = [
  'Let go. It had been coming and it still landed badly.',
  'Fired. A short meeting, and somebody walked you to the door.',
  'They let you go. Nobody pretended it was about anything else.',
  'Lost the {job} job. You had known for months and had done nothing about it.',
];

const LAID_OFF_LINES: readonly string[] = [
  'Made redundant. Nothing to do with you, which did not help.',
  'The whole team went. You found out by email, with everybody else.',
  'Laid off. They said it was the numbers, and it was.',
  'The {job} work dried up. You were one of eleven let go that week.',
];

const leftLine = (because: 'fired' | 'laid-off', job: Job, age: number): string =>
  pick(
    because === 'fired' ? FIRED_LINES : LAID_OFF_LINES,
    `left:${because}:${String(job.id)}`,
    age,
  ).replace(/\{job\}/g, job.title.toLowerCase());

/** Every job in the catalog, for the developer screen and the balance tools. */
export { ALL_JOBS };
