/**
 * Ticket 0210 — the four things a player can do about work.
 *
 * Apply, Work Harder, resign, and look at what is going. Spec 1670 lists
 * promotion and firing alongside them; those are NOT here, because they are not
 * the player's to press — they happen in the employment phase, to you, which is
 * the whole difference between the two halves of this ticket.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  START_STANDING,
  WORK_GAIN_MAX,
  WORK_GAIN_MIN,
  WORK_SUCCESS_CHANCE,
  PUSHES_PER_YEAR,
  SECOND_PUSH_SCALE,
  applicantFor,
  cannotApply,
  CANNOT_APPLY_LABELS,
  findJob,
  hireChance,
  openingsFor,
  type CannotApply,
  type EmploymentState,
  type Job,
} from '@yearafter/careers';
import { clampStat, err, ok, type Result, type StatValue } from '@yearafter/core';
import { employerFor } from '@yearafter/content';
import { findMajor, isInSchool, levelOf } from '@yearafter/education';

/**
 * The career tracks this character's degree was actually for.
 *
 * Empty for anybody without one, which is why a major is a real decision: it is
 * worth twenty points of hiring odds in the right field and nothing anywhere
 * else (spec 1821 makes the major the one choice college asks for).
 */
const majorOpens = (state: GameState): readonly string[] => {
  if (levelOf(state.education.credentials) === 'none') return [];
  const major = state.education.majorId ? findMajor(state.education.majorId) : undefined;
  return major?.opens ?? [];
};
import type { GameState } from './game-state';
import { RngDomains, stableUnit } from './rng/rng';

export type WorkError = CannotApply | 'no-such-job' | 'no-job';

export const WORK_ERROR_LABELS: Readonly<Record<WorkError, string>> = {
  'too-young': 'You are too young for this one.',
  'already-applied': 'You have already applied for this one this year.',
  'already-doing-it': 'This is the job you have.',
  'out-of-reach': 'They would want somebody who has done the job below this.',
  'needs-education': 'You do not have the qualification this one needs.',
  'no-such-job': 'That job is not in the catalog.',
  'no-job': 'You are not working anywhere.',
};

export interface WorkOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

export interface ApplyOutcome extends WorkOutcome {
  readonly hired: boolean;
}

/**
 * Ticket 0210c — the result of pressing Work Harder, including pressing it for
 * nothing.
 *
 * Review: *"I dont want a visual limit, the buttons can be hit as many times,
 * but I only want an affect to happen a maximum of 2 times. So, if i hit the
 * button 10x, my work reputation only went up twice."*
 *
 * Running out is no longer an error, because an error is a thing the player did
 * wrong and this is not one. It is an outcome with `spent: true` and no entry:
 * the state comes back untouched, nothing reaches the feed, and — the part that
 * matters most — NO RANDOMNESS IS SPENT. A futile tap that consumed a draw
 * would shift every roll after it, so two players who lived identical lives and
 * pressed a dead button a different number of times would diverge. The early
 * return above the stream is what makes the cap invisible rather than merely
 * quiet.
 */
export interface PushOutcome {
  readonly state: GameState;
  /** Absent when the year's effort was already spent — nothing happened. */
  readonly entry?: TimelineEntry;
  /** True when this press changed nothing. */
  readonly spent: boolean;
}

/* -------------------------------------------------------------------------- */
/* What is going this year                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The listings.
 *
 * Drawn from a STABLE value per job per year rather than from the RNG stream,
 * so opening the Career screen twice does not reshuffle the board and a save
 * reloaded a week later shows the same six jobs. Consuming randomness to render
 * a list would also make the list depend on how many times the player looked at
 * it, which is the kind of thing that quietly breaks seeded replay.
 */
export function openings(state: GameState): readonly Job[] {
  const held = state.employment.job?.jobId;
  return openingsFor(
    {
      age: state.player.age,
      education: levelOf(state.education.credentials),
      reached: reachedBy(state.employment),
      ...(held ? { currentJobId: held } : {}),
    },
    (job) => stableUnit(`${state.world.year}:opening:${String(job.id)}`),
  );
}

/** Highest rung ever held on each track. The ladder's memory. */
export function reachedBy(employment: EmploymentState): Readonly<Record<string, number>> {
  const reached: Record<string, number> = {};
  const note = (jobId: string) => {
    const job = findJob(jobId);
    if (!job) return;
    reached[job.track] = Math.max(reached[job.track] ?? -1, job.rung);
  };
  for (const past of employment.history) note(past.jobId);
  if (employment.job) note(employment.job.jobId);
  return reached;
}

/** Years of paid work behind them, anywhere. */
export function experienceOf(employment: EmploymentState, age: number): number {
  const past = employment.history.reduce((total, row) => total + Math.max(0, row.to - row.from), 0);
  const now = employment.job ? Math.max(0, age - employment.job.since) : 0;
  return past + now;
}

/**
 * Who this opening is with, stably for the year.
 *
 * Ticket 0210b. Drawn rather than stored, for the same reason the listings are:
 * an employer is texture on a listing and putting it in the save would mean
 * migrating it forever for something nobody can act on.
 */
export const employerOf = (state: GameState, job: Job): string =>
  employerFor(job.track, stableUnit(`${state.world.year}:employer:${String(job.id)}`));

/**
 * Why this job cannot be applied for, in words the player can act on.
 *
 * Review: tapping a job used to hire the player instantly. Now it opens a card,
 * and a card whose button is greyed out with no reason is the other half of the
 * same mistake — so this returns the sentence rather than a boolean.
 */
export function whyNotJob(state: GameState, job: Job): string | undefined {
  const held = state.employment.job?.jobId;
  const blocked = cannotApply(job, {
    age: state.player.age,
    education: levelOf(state.education.credentials),
    reached: reachedBy(state.employment),
    ...(held ? { currentJobId: held } : {}),
  });
  if (!blocked) return undefined;
  return CANNOT_APPLY_LABELS[blocked];
}

/** The odds, for the row the player reads before they apply. */
export function chanceOf(state: GameState, job: Job): number {
  return hireChance(
    job,
    applicantFor(
      job,
      {
        age: state.player.age,
        smarts: state.player.stats.smarts,
        charisma: state.player.stats.charisma,
        discipline: state.player.stats.discipline,
        looks: state.player.stats.looks,
        education: levelOf(state.education.credentials),
        opens: majorOpens(state),
        experience: experienceOf(state.employment, state.player.age),
      },
      state.employment.standing,
      reachedBy(state.employment),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Applying                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Apply for one job. Once each per year, and it can go either way.
 *
 * A rejection is a real outcome and not a retry button with prose on it — the
 * 0209 lesson about refusals, which is the same lesson. The player can apply to
 * something else this year and to this again next year, and that is the whole
 * of the recourse, because an application you can repeat until it works is not
 * an application.
 */
export function applyFor(state: GameState, jobId: string): Result<ApplyOutcome, WorkError> {
  const job = findJob(jobId);
  if (!job) return err('no-such-job');

  const thisYear = state.employment.appliedAtAge === state.player.age;
  if (thisYear && state.employment.appliedTo.includes(jobId)) return err('already-applied');

  const held = state.employment.job?.jobId;
  const blocked = cannotApply(job, {
    age: state.player.age,
    education: levelOf(state.education.credentials),
    reached: reachedBy(state.employment),
    ...(held ? { currentJobId: held } : {}),
  });
  if (blocked) return err(blocked);

  const stream = state.rng.stream(RngDomains.Careers);
  const hired = stream.chance(chanceOf(state, job));

  const appliedTo = thisYear ? [...state.employment.appliedTo, jobId] : [jobId];
  const employment: EmploymentState = hired
    ? {
        ...state.employment,
        // Leaving one job for another is resigning from the first. The history
        // has to say so or a career reads as a list of jobs that overlapped.
        history: state.employment.job
          ? [
              ...state.employment.history,
              {
                jobId: state.employment.job.jobId,
                from: state.employment.job.since,
                to: state.player.age,
                because: 'resigned' as const,
              },
            ]
          : state.employment.history,
        job: {
          jobId: String(job.id),
          since: state.player.age,
          // Starting fresh, a little below the middle: you are not good at a job
          // you have not done, and the first year is where that shows.
          performance: clampStat(stream.range(38, 52)) as StatValue,
          effort: 'steady',
          pushedThisYear: 0,
        },
        appliedTo,
        appliedAtAge: state.player.age,
      }
    : { ...state.employment, appliedTo, appliedAtAge: state.player.age };

  const text = hired ? hiredLine(state, job) : turnedDownLine(state, job);
  const entry = write(state, text, `t:${state.world.year}:job:${String(job.id)}`);

  return ok({
    state: {
      ...state,
      employment,
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
    },
    hired,
    entry,
  });
}

/* -------------------------------------------------------------------------- */
/* Work Harder                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The button, and the mirror of Study Harder.
 *
 * Two things happen, exactly as 0205 describes for school: this year's
 * performance moves most of the time, and the character becomes somebody who
 * works hard — effort sticks at `hard` and raises the level performance drifts
 * towards for as long as they hold the job. Pressing it once helps; pressing it
 * every year compounds.
 */
export function workHarder(state: GameState): Result<PushOutcome, WorkError> {
  const held = state.employment.job;
  if (!held) return err('no-job');

  const fresh = held.pushedAtAge !== state.player.age;
  const pushed = fresh ? 0 : held.pushedThisYear;
  // Above the stream, deliberately. See `PushOutcome`: a press past the cap
  // must not draw, or the seed stops meaning anything.
  if (pushed >= PUSHES_PER_YEAR) return ok({ state, spent: true });

  const stream = state.rng.stream(RngDomains.Careers);
  const worked = stream.chance(WORK_SUCCESS_CHANCE);
  const scale = pushed === 0 ? 1 : SECOND_PUSH_SCALE;
  const gain = worked ? Math.round(stream.range(WORK_GAIN_MIN, WORK_GAIN_MAX) * scale) : 0;

  const text = worked
    ? pick(WORKED_LINES, `${state.world.year}:work`, state.player.age)
    : pick(DID_NOT_LINES, `${state.world.year}:work`, state.player.age);
  // The JOB is in the id, not just the counter. Reported by the player:
  // "ERROR Encountered two children with the same key, `t:2020:work:1`."
  // `pushedThisYear` lives on the JobHeld, so quitting and being hired somewhere
  // else in the same year resets it to zero and the next two pushes re-emit
  // `:0` and `:1` for that year. An id has to carry everything that resets the
  // counter inside it (CORE_RULES 13.12), and `applyFor` resetting the counter
  // was invisible from here.
  const entry = write(state, text, `t:${state.world.year}:work:${held.jobId}:${pushed}`);

  return ok({
    state: {
      ...state,
      employment: {
        ...state.employment,
        job: {
          ...held,
          performance: clampStat(held.performance + gain),
          // Sticks, like Study Harder's does.
          effort: 'hard',
          pushedThisYear: pushed + 1,
          pushedAtAge: state.player.age,
        },
      },
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
    },
    entry,
    spent: false,
  });
}

/**
 * How many pushes are left in the year.
 *
 * Ticket 0210c took this off the screen — see `PushOutcome` — but it stays here
 * because the model still has a cap and the tests still measure it. What changed
 * is who is allowed to read it: the simulation, not the button.
 */
export const pushesLeft = (state: GameState): number => {
  const held = state.employment.job;
  if (!held) return 0;
  const pushed = held.pushedAtAge === state.player.age ? held.pushedThisYear : 0;
  return Math.max(0, PUSHES_PER_YEAR - pushed);
};

/* -------------------------------------------------------------------------- */
/* Resigning                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Walk out.
 *
 * Always allowed, with no confirmation and no penalty beyond the obvious one:
 * you no longer have a job, and the standing you built stays on the track
 * because you did the work. Spec 119 keeps switching permissive, and a game
 * that asks "are you sure?" is a game that thinks the player made a mistake.
 */
export function resign(state: GameState): Result<WorkOutcome, WorkError> {
  const held = state.employment.job;
  if (!held) return err('no-job');
  const job = findJob(held.jobId);
  const years = state.player.age - held.since;

  const text =
    years <= 0
      ? `Quit ${job ? job.title.toLowerCase() : 'the job'} inside a year. It was not going to work.`
      : years === 1
        ? `Handed in your notice after a year. ${job ? job.title : 'The job'} was not it.`
        : `Left after ${years} years. You had known for a while.`;
  // The job, for the same reason Work Harder carries it: two jobs can be left
  // in one year, and this id said only which year it was. Found by the
  // job-hopping test in the same run that proved the work-id fix — one bug's
  // regression test finding its neighbour, which is the argument for playing a
  // population rather than a path.
  const entry = write(state, text, `t:${state.world.year}:resign:${held.jobId}`);

  return ok({
    state: {
      ...state,
      employment: {
        ...state.employment,
        job: undefined,
        history: [
          ...state.employment.history,
          { jobId: held.jobId, from: held.since, to: state.player.age, because: 'resigned' },
        ],
      },
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
    },
    entry,
  });
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * CORE_RULES 13.22, applied from the start rather than after the fact.
 *
 * Eight occurrences in six systems taught this the hard way: the base holds
 * still and AGE does the moving, so two consecutive years cannot land on the
 * same line whatever the player does.
 */
function pick(lines: readonly string[], key: string, age: number): string {
  const base = Math.floor(stableUnit(key) * lines.length);
  return lines[(base + age) % lines.length] as string;
}

function hiredLine(state: GameState, job: Job): string {
  const first = state.employment.history.length === 0 && !state.employment.job;
  const lines = first ? FIRST_JOB_LINES : HIRED_LINES;
  return pick(lines, `hired:${String(job.id)}`, state.player.age).replace(/\{job\}/g, job.title);
}

const turnedDownLine = (state: GameState, job: Job): string =>
  pick(TURNED_DOWN_LINES, `no:${String(job.id)}`, state.player.age).replace(
    /\{job\}/g,
    job.title.toLowerCase(),
  );

const FIRST_JOB_LINES: readonly string[] = [
  'Got the job. {job}, and a first paycheck with your name on it.',
  'They took you on as {job}. You told everybody, including people who did not ask.',
  'Started as {job}. The first week was longer than the whole summer before it.',
  'Hired as {job}. Nobody had ever paid you properly before.',
];

const HIRED_LINES: readonly string[] = [
  'Got the job. {job}, starting in three weeks.',
  'They came back the same day. {job}, and a start date.',
  'Took the offer. {job}, and a fresh set of people to learn.',
  'Hired as {job}. The last place was told on a Friday.',
  'The call came while you were doing something else. {job}, if you wanted it.',
];

const TURNED_DOWN_LINES: readonly string[] = [
  'Applied to be a {job} and heard nothing for six weeks, which was the answer.',
  'Got as far as an interview for the {job} job and no further.',
  'They went with somebody else for the {job} role, and said so kindly.',
  'The {job} application came back as a no. It was a form letter.',
  'Went for the {job} job. They wanted somebody who had already done it.',
];

const WORKED_LINES: readonly string[] = [
  'Put a real shift in this year, and it was noticed.',
  'Stayed late through most of it and came out of the year better at the job.',
  'Took the work seriously this year. Somebody senior said so out loud.',
  'Got good at the parts of the job nobody trains you on.',
];

const DID_NOT_LINES: readonly string[] = [
  'Worked hard all year and none of it seemed to land anywhere.',
  'Put the hours in. The year went the way it was going to go regardless.',
  'Tried to make a mark and picked a year when nobody was looking.',
];

/* -------------------------------------------------------------------------- */

function write(state: GameState, text: string, id: string): TimelineEntry {
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'career',
    text,
    id,
    sequence: state.player.timeline.filter((entry) => entry.age === state.player.age).length,
  });
}

/** Nobody works while they are still at school full time — gigs cover that. */
export const canWork = (state: GameState): boolean =>
  !isInSchool(state.education) || state.player.age >= 18;

export { START_STANDING };
