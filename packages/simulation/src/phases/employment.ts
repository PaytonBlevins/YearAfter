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

import type { NewLifeRecord, TimelineKind } from '@yearafter/character';
import type { NewTransaction } from '@yearafter/finance';
import {
  ALL_JOBS,
  START_STANDING,
  findJob,
  firingChance,
  payBreakdown,
  performanceTarget,
  performanceYear,
  promotionChance,
  promotionFrom,
  standingYear,
  type EmploymentState,
  type Job,
} from '@yearafter/careers';
import { clampStat, dollars, type StatValue } from '@yearafter/core';
import type { Household } from '@yearafter/relationships';
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
  /** Ticket 0212. Structured history, for the death screen. See `timeline.ts`. */
  readonly records: readonly NewLifeRecord[];
  /**
   * Ticket 0301. What this phase moved, for `advanceYear` to post.
   *
   * A phase REPORTS money and never moves it. `takeHome` below is still returned
   * because the feed line quotes it, but it is no longer what changes the
   * balance — these are.
   */
  readonly transactions: readonly NewTransaction[];
  /**
   * Whole dollars the year left the character with, signed.
   *
   * Negative when a household costs more than it earns, which is a real thing
   * and the only reason the salary means anything. `advanceYear` is responsible
   * for never taking cash below zero (CORE_RULES 13.13).
   */
  /**
   * Ticket 0303. Pay minus tax, and nothing else.
   *
   * Was `saved`, and had the cost of living already netted off it. The living
   * phase runs after this one and charges the household — so what employment
   * knows is what arrived, and what is LEFT is a question only the year as a
   * whole can answer.
   */
  readonly takeHome: number;
  /** Gross pay for the year, for the line that names it (CORE_RULES 13.6). */
  readonly earned: number;
  /** Hidden capacity the job consumed, for the stress phase (spec 661). */
  readonly demand: number;
}

export function runEmployment(input: EmploymentPhaseInput): EmploymentPhaseOutput {
  const lines: { kind: TimelineKind; text: string }[] = [];
  const records: NewLifeRecord[] = [];
  const transactions: NewTransaction[] = [];
  let employment = input.employment;
  const held = employment.job;

  if (!held) {
    return { employment, lines, records, transactions, takeHome: 0, earned: 0, demand: 0 };
  }

  const job = findJob(held.jobId);
  if (!job) {
    // A job id the catalog no longer has. Drop it rather than crash: a save can
    // outlive the build that wrote it, and a character stuck holding a job that
    // does not exist would be unable to apply for another one forever.
    return {
      employment: { ...employment, job: undefined },
      lines,
      records,
      transactions,
      takeHome: 0,
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
  const parts = payBreakdown(job, years, performance, standing);
  const earned = parts.steady + parts.commission;

  /*
    Ticket 0301. Four transactions where there used to be one number.

    `savedFrom` still decides what is left — the arithmetic is untouched and a
    test in `@yearafter/careers` asserts the two agree job for job — but the
    tax and the cost of living are now RECORDED rather than computed and
    discarded. That is the whole ticket: at $42,000 with two children the game
    has always known it withheld $8,604 and spent $32,647, and has never once
    been able to say so.

    Commission is posted separately only when there IS one. A salaried job is
    five per cent at risk, and a ledger that wrote "$1,400 of commission" for a
    school administrator every year would be technically true and misleading —
    spec 1677 lists it as its own category precisely because for some jobs it is
    most of the money and for others it is noise.
  */
  transactions.push({
    category: 'salary',
    amount: dollars(parts.steady),
    source: `${job.title} — pay`,
  });
  if (parts.commission > 0) {
    transactions.push({
      category: 'commission',
      amount: dollars(parts.commission),
      source: `${job.title} — commission`,
    });
  }
  transactions.push({ category: 'tax', amount: dollars(-parts.tax), source: 'Tax' });

  /*
    Ticket 0303. The cost of living used to be posted HERE, out of the same
    `payBreakdown` call, and the year's money line was written here too.

    Both moved to `phases/living.ts`, and for one reason: a phase that charges
    for being alive has to run for people who are not being paid. Measured
    before this ticket, a character who never took a job was charged nothing
    across 6,357 adult years. What employment knows is what the job paid and
    what tax took; what a YEAR came to is the household's question.
  */

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
    records.push({ category: 'career', label: `Promoted to ${next.title}`, referenceId: next.id });
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
    records.push({
      category: 'career',
      label: because === 'fired' ? `Fired from ${job.title}` : `Laid off — ${job.title}`,
      referenceId: job.id,
    });
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

  return {
    employment,
    lines,
    records,
    transactions,
    takeHome: parts.takeHome,
    earned,
    demand: job.demand,
  };
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

/*
  Ticket 0303. `payLine`, FINE_LINES, FAMILY_LINES, TIGHT_LINES and
  BEHIND_LINES used to live here and now live in `phases/living.ts`.

  They were always about the year rather than about the job — "Made $43,297.
  Living took most of it and left $2,737" names a wage and then a household —
  and once the cost of living left this file, this file could no longer write
  the second half of its own sentence. The phase that charges the household is
  the one that knows both numbers, so it writes the line.
*/

const PROMOTED_LINES: readonly string[] = [
  'Promoted. {job}, starting Monday, and a raise that took a month to arrive.',
  "They moved you up. {job}, and the person who had it before you wasn't pleased.",
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
  "Made redundant. Nothing to do with you, which didn't help.",
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
