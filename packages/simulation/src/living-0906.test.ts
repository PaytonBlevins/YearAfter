/**
 * Ticket 0906 — finding 216: a year in uniform or an agency paid, and the feed said it did not.
 *
 * The living phase writes the year's money line from a job title and the gross pay. Somebody in the
 * service or an agency has no civilian job, so it had no title and wrote "no work all year, nothing
 * came in" over a year that paid. Their rank or title is the job's now, and the year's gross pay is
 * what it earned. A life with neither, and a life with a job, are not touched.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { findJob } from '@yearafter/careers';
import { agencyTitle } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import { post } from '@yearafter/finance';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import type { AgencyCareer } from './intel-state';
import * as intelModule from './intel';
import * as livingModule from './phases/living';
import * as militaryModule from './military';
import { EMPTY_MILITARY, type ServiceCareer } from './military-state';
import { createNewGame } from './new-game';
import { ordinaryChoice } from './ordinary-answers';
import { rankTitleOf } from './military';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function answerAll(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending[0];
    if (!open) break;
    const choice =
      open.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : ordinaryChoice(open);
    if (!choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

function toAge(state: GameState, age: number): GameState {
  let current = state;
  let guard = 0;
  while (current.player.alive && current.player.age < age && (guard += 1) < 80) {
    current = answerAll(advanceYear(answerAll(current)).state);
  }
  return current;
}

const adults = new Map<string, GameState>();
function adult(seed: string, age = 27): GameState {
  const key = `${seed}:${age}`;
  const found = adults.get(key);
  if (found) return found;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const made = toAge(createNewGame({ seed: attempt === 0 ? seed : `${seed}~${attempt}` }), age);
    if (made.player.alive && made.player.age >= age) {
      adults.set(key, made);
      return made;
    }
  }
  throw new Error(`no living life of age ${age} for ${seed}`);
}

/** Money in the bank the way the game gives it, so a year can be charged for living. */
function withCash(state: GameState, amount: number): GameState {
  const posted = post(state.finance, state.world.year, state.player.age, {
    category: 'gift',
    amount: dollars(amount),
    source: 'A windfall',
  });
  return {
    ...state,
    finance: posted.ledger,
    player: { ...state.player, cash: posted.ledger.balance },
  };
}

/** Out of work, in no career, with money behind them and nothing standing: the plain no-income case. */
function idle(raw: GameState): GameState {
  const state = withCash(raw, 200_000);
  return {
    ...state,
    employment: { ...state.employment, job: undefined },
    sports: { ...state.sports, career: undefined, post: undefined } as never,
    pending: [],
    military: EMPTY_MILITARY,
    intel: { past: [] },
  };
}

const serviceRow = (patch: Partial<ServiceCareer> = {}): ServiceCareer => ({
  branch: 'army',
  stage: 'serving',
  enlistedAge: 19,
  track: 'enlisted',
  specialty: 'army.infantry',
  commissionedAt: 0,
  grade: 4,
  years: 3,
  termEnds: 9,
  performance: 60,
  reputation: 55,
  effort: 'normal',
  lastPay: 0,
  post: 'Fort Harlan',
  ...patch,
});

const agencyRow = (patch: Partial<AgencyCareer> = {}): AgencyCareer => ({
  agency: 'fbi',
  stage: 'serving',
  enteredAge: 24,
  grade: 11,
  gradeYears: 1,
  years: 3,
  performance: 60,
  reputation: 55,
  effort: 'normal',
  lastPay: 0,
  post: 'the Harlow field office',
  door: 'degree',
  poorYears: 0,
  highPay: [],
  ...patch,
});

const inUniform = (state: GameState, patch: Partial<ServiceCareer> = {}): GameState => ({
  ...idle(state),
  military: { past: [], service: serviceRow(patch) },
});

const inAgency = (state: GameState, patch: Partial<AgencyCareer> = {}): GameState => ({
  ...idle(state),
  intel: { past: [], career: agencyRow(patch) },
});

/** The no-income sentences, from either of the two pools. */
const NO_WORK =
  /No work all year|Nothing coming in|A year without a job|No income at all|No work and nothing|Nothing came in|A year with no job|No income and no savings/;

const careerLines = (before: GameState, after: GameState): string[] =>
  after.player.timeline
    .filter((row) => row.year === after.world.year && row.kind === 'career')
    .filter((row) => !before.player.timeline.some((old) => old.id === row.id))
    .map((row) => row.text);

const BASE = idle(adult('LIVING-216'));

afterEach(() => vi.restoreAllMocks());

/* -------------------------------------------------------------------------- */
/* The fix                                                                     */
/* -------------------------------------------------------------------------- */

describe('finding 216: a paid public career is not "no work all year"', () => {
  it('a plain unemployed year still writes the no-work line (the control)', () => {
    const after = advanceYear(BASE).state;
    expect(careerLines(BASE, after).some((line) => NO_WORK.test(line))).toBe(true);
  });

  it('a soldier’s year reads as pay, with the gross figure in it', () => {
    const state = inUniform(BASE);
    const spy = vi.spyOn(militaryModule, 'runMilitaryYear');
    const after = advanceYear(state).state;
    const pay = spy.mock.results[0]!.value.pay as number;
    expect(pay).toBeGreaterThan(0);
    const lines = careerLines(state, after);
    expect(lines.some((line) => NO_WORK.test(line))).toBe(false);
    expect(lines.some((line) => line.includes(`$${Math.round(pay).toLocaleString('en-US')}`))).toBe(
      true,
    );
  });

  it('an agent’s year reads as pay, with the gross figure in it', () => {
    const state = inAgency(BASE);
    const spy = vi.spyOn(intelModule, 'runIntelYear');
    const after = advanceYear(state).state;
    const pay = spy.mock.results[0]!.value.pay as number;
    expect(pay).toBeGreaterThan(0);
    const lines = careerLines(state, after);
    expect(lines.some((line) => NO_WORK.test(line))).toBe(false);
    expect(lines.some((line) => line.includes(`$${Math.round(pay).toLocaleString('en-US')}`))).toBe(
      true,
    );
  });

  it('the living phase is handed the soldier’s rank as the job, and the gross pay as what it earned', () => {
    const state = inUniform(BASE, { grade: 5 });
    const living = vi.spyOn(livingModule, 'runLiving');
    const army = vi.spyOn(militaryModule, 'runMilitaryYear');
    advanceYear(state);
    const input = living.mock.calls[0]![0];
    expect(input.jobTitle).toBe(rankTitleOf(state.military.service!));
    expect(input.earned).toBe(army.mock.results[0]!.value.pay);
  });

  it('and the agent’s title and gross pay', () => {
    const state = inAgency(BASE, { grade: 14 });
    const living = vi.spyOn(livingModule, 'runLiving');
    const spy = vi.spyOn(intelModule, 'runIntelYear');
    advanceYear(state);
    const input = living.mock.calls[0]![0];
    expect(input.jobTitle).toBe(agencyTitle('fbi', 14));
    expect(input.earned).toBe(spy.mock.results[0]!.value.pay);
  });

  it('a life with neither is handed no title and no extra earnings', () => {
    const living = vi.spyOn(livingModule, 'runLiving');
    advanceYear(BASE);
    const input = living.mock.calls[0]![0];
    expect(input.jobTitle).toBeUndefined();
    expect(input.earned).toBe(0);
  });

  it('a life with a job is handed the job’s title and its earnings, as before', () => {
    let worked: GameState | undefined;
    for (let attempt = 0; attempt < 12 && !worked; attempt += 1) {
      const candidate = adult(`LIVING-216-JOB-${attempt}`, 30);
      if (candidate.employment.job && !candidate.military.service) worked = candidate;
    }
    if (!worked) throw new Error('no employed life found');
    const living = vi.spyOn(livingModule, 'runLiving');
    advanceYear({ ...worked, pending: [] });
    const input = living.mock.calls[0]![0];
    expect(input.jobTitle).toBe(findJob(worked.employment.job!.jobId)!.title);
    expect(input.earned).toBeGreaterThan(0);
  });

  it('a life with a civilian job keeps the job’s title even with a service row beside it', () => {
    let worked: GameState | undefined;
    for (let attempt = 0; attempt < 12 && !worked; attempt += 1) {
      const candidate = adult(`LIVING-216-JOB-${attempt}`, 30);
      if (candidate.employment.job && !candidate.military.service) worked = candidate;
    }
    if (!worked) throw new Error('no employed life found');
    const both: GameState = {
      ...worked,
      pending: [],
      military: { past: [], service: serviceRow() },
    };
    const living = vi.spyOn(livingModule, 'runLiving');
    advanceYear({ ...worked, pending: [] });
    const alone = living.mock.calls[0]![0];
    advanceYear(both);
    const input = living.mock.calls[1]![0];
    expect(input.jobTitle).toBe(findJob(worked.employment.job!.jobId)!.title);
    // The year's pay in uniform is not added to what the job earned.
    expect(input.earned).toBe(alone.earned);
  });

  it('a recruit in basic training is paid, so the year reads as pay too', () => {
    const state = inUniform(BASE, {
      stage: 'training',
      years: 0,
      grade: 1,
      enlistedAge: BASE.player.age,
    });
    const after = advanceYear(state).state;
    expect(careerLines(state, after).some((line) => NO_WORK.test(line))).toBe(false);
  });
});
