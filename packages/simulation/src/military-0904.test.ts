/**
 * Ticket 0904 acceptance tests — discharge, benefits and veterans.
 *
 * What a service life leaves behind: the character of a discharge (honorable, general, medical, dishonorable, and the
 * entry-level one a washed-out recruit gets), a pension for life at twenty years, the GI Bill's tuition and housing for
 * somebody who left honorably or with a medical discharge, and a preference when the person applies for a public or
 * safety job. The pension formula, the GI Bill's tiers and amounts and the preference rules are real and say so; the
 * dials that decide who is discharged how are the game's own, named in the doc.
 */

import { describe, expect, it } from 'vitest';
import { ALL_TRACKS, findJob, hireChance, jobsIn, type CareerTrack } from '@yearafter/careers';
import {
  GENERAL_BELOW,
  GENERAL_DISCHARGE_NOTES,
  GI_BILL_DISCHARGES,
  GI_HOUSING_MONTHLY,
  GI_MONTHS_ENTITLED,
  GI_MONTHS_PER_YEAR,
  GI_TIERS,
  GI_TUITION_CAP,
  MEDICAL_BOARD_CHANCE,
  MISCONDUCT_CHANCE,
  MISCONDUCT_DISCIPLINE_BELOW,
  MISCONDUCT_REPUTATION_BELOW,
  NOT_RETAINED_GENERAL_BELOW,
  PENSION_CEILING,
  PENSION_PER_YEAR,
  PREFERENCE_BONUS,
  PREFERENCE_DISCHARGES,
  PREFERENCE_MIN_YEARS,
  PREFERENCE_TRACKS,
  RETIRE_ELIGIBLE_YEARS,
  annualBasePay,
  dischargeOf,
  giPercentFor,
  retiredPayFor,
} from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';

import { advanceYear } from './advance';
import { chanceOf } from './careers';
import { collegeSupportOf } from './college';
import { decide } from './decide';
import type { GameState } from './game-state';
import {
  MILITARY_LEAVE,
  MILITARY_OFFER_EVENT_ID,
  retireFromService,
  runMilitaryYear,
  withMilitaryOffer,
} from './military';
import {
  EMPTY_MILITARY,
  type MilitaryState,
  type PastService,
  type ServiceCareer,
} from './military-state';
import {
  giBillPercent,
  giHousingFor,
  giMonthsLeft,
  giMonthsThisYear,
  giServiceMonths,
  giTuitionAid,
  holdsServiceInjury,
  retiredPayAt,
  retiredPayOf,
  retiredPayStartAge,
  runVeteransYear,
  veteranPreference,
} from './military-veterans';
import { createNewGame } from './new-game';
import { ordinaryChoice } from './ordinary-answers';
import { Rng } from './rng/rng';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function toAge(state: GameState, age: number): GameState {
  let current = state;
  let guard = 0;
  while (current.player.alive && current.player.age < age && (guard += 1) < 80) {
    current = answerAll(advanceYear(answerAll(current)).state);
  }
  return current;
}

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

const adults = new Map<string, GameState>();
function adult(seed: string, age = 26): GameState {
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

type StatName =
  'charisma' | 'looks' | 'smarts' | 'discipline' | 'health' | 'happiness' | 'willpower';
const withStats = (state: GameState, stats: Partial<Record<StatName, number>>): GameState => ({
  ...state,
  player: { ...state.player, stats: { ...state.player.stats, ...stats } as never },
});

const withSeed = (state: GameState, seed: string): GameState =>
  ({ ...state, rng: new Rng(seed) }) as unknown as GameState;

/** A fit adult with a high-school diploma and nothing in the way, in no service, with no money from a parent. */
const eligible = (state: GameState): GameState => {
  const fit = withStats(state, { health: 80, smarts: 60, discipline: 60 });
  return {
    ...fit,
    education: {
      ...fit.education,
      enrollment: undefined,
      stage: 'graduated',
      credentials: {
        ...fit.education.credentials,
        highSchool: 18,
        university: undefined,
        postgraduate: undefined,
      },
    } as never,
    sports: { ...fit.sports, career: undefined, post: undefined } as never,
    parenting: { ...fit.parenting, collegeSupport: 0 } as never,
    health: { ...fit.health, conditions: [], deficit: 0 },
    pending: [],
    military: EMPTY_MILITARY,
  };
};

const base = eligible(adult('VET-BASE', 26));

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

const serving = (state: GameState, patch: Partial<ServiceCareer> = {}): GameState => ({
  ...state,
  military: { ...state.military, service: serviceRow(patch) },
});

const pastRow = (patch: Partial<PastService> = {}): PastService => ({
  branch: 'army',
  enlistedAge: 19,
  endedAge: 25,
  years: 6,
  track: 'enlisted',
  specialty: 'army.infantry',
  finalGrade: 5,
  reputation: 65,
  how: 'term',
  discharge: 'honorable',
  ...patch,
});

const veteran = (
  state: GameState,
  patch: Partial<PastService> = {},
  extra: Partial<MilitaryState> = {},
): GameState => ({
  ...state,
  military: { ...EMPTY_MILITARY, past: [pastRow(patch)], ...extra },
});

const military = (...past: PastService[]): MilitaryState => ({ past });

const serviceDraw = (state: GameState, key: string, age: number): number =>
  mixedUnit(`service:${state.rng.getSeed()}:${state.world.generation}:${key}:${age}`);

/** The first seed of a family whose `key` draw at an age falls where the test says. */
function seedWhere(
  state: GameState,
  key: string,
  age: number,
  test: (unit: number) => boolean,
): GameState {
  for (let i = 0; i < 20000; i += 1) {
    const candidate = withSeed(state, `vet-${key}-${i}`);
    if (test(serviceDraw(candidate, key, age))) return candidate;
  }
  throw new Error('no seed found');
}

const runYear = (state: GameState) =>
  runMilitaryYear({
    before: state,
    education: state.education,
    age: state.player.age + 1,
    year: state.world.year + 1,
  });

const injured = (state: GameState, conditionId: string): GameState => ({
  ...state,
  health: {
    ...state.health,
    conditions: [{ conditionId, since: state.player.age - 1, treated: false }],
  },
});

const AGE = base.player.age + 1;

/* -------------------------------------------------------------------------- */
/* The real figures                                                            */
/* -------------------------------------------------------------------------- */

describe('the real numbers', () => {
  it('pays 2% of the highest three years of basic pay for each year, so 40% at twenty', () => {
    expect(PENSION_PER_YEAR).toBe(0.02);
    expect(RETIRE_ELIGIBLE_YEARS).toBe(20);
    const average =
      (annualBasePay(7, 20, 'enlisted') +
        annualBasePay(7, 19, 'enlisted') +
        annualBasePay(7, 18, 'enlisted')) /
      3;
    expect(retiredPayFor({ track: 'enlisted', finalGrade: 7, years: 20, how: 'retired' })).toBe(
      Math.round(average * 0.4),
    );
  });

  it('pays more for more years, at the formula, and stops at the ceiling', () => {
    const at = (years: number) =>
      retiredPayFor({ track: 'officer', finalGrade: 5, years, how: 'retired' });
    const three = (years: number) =>
      (annualBasePay(5, years, 'officer') +
        annualBasePay(5, years - 1, 'officer') +
        annualBasePay(5, years - 2, 'officer')) /
      3;
    expect(at(24)).toBe(Math.round(three(24) * 0.48));
    expect(at(30)).toBe(Math.round(three(30) * 0.6));
    expect(PENSION_CEILING).toBe(0.75);
    expect(at(40)).toBe(Math.round(three(40) * 0.75));
    expect(at(45)).toBe(Math.round(three(45) * 0.75));
  });

  it('pays nothing under twenty years or to anybody who did not retire', () => {
    expect(retiredPayFor({ track: 'enlisted', finalGrade: 8, years: 19, how: 'retired' })).toBe(0);
    for (const how of [
      'term',
      'not-retained',
      'passed-over',
      'medical',
      'misconduct',
      'killed',
      'washed-out',
    ]) {
      expect(retiredPayFor({ track: 'enlisted', finalGrade: 8, years: 25, how }), how).toBe(0);
    }
  });

  it('has the Post-9/11 GI Bill tiers by months of service', () => {
    expect(GI_TIERS.map((t) => [t.months, t.percent])).toEqual([
      [36, 1],
      [30, 0.9],
      [24, 0.8],
      [18, 0.7],
      [6, 0.6],
      [3, 0.5],
    ]);
    const cases: [number, number][] = [
      [0, 0],
      [2, 0],
      [3, 0.5],
      [5, 0.5],
      [6, 0.6],
      [17, 0.6],
      [18, 0.7],
      [23, 0.7],
      [24, 0.8],
      [29, 0.8],
      [30, 0.9],
      [35, 0.9],
      [36, 1],
      [200, 1],
    ];
    for (const [months, percent] of cases)
      expect(giPercentFor(months), String(months)).toBe(percent);
  });

  it('has the 2026-27 amounts and thirty-six months of nine-month years', () => {
    expect(GI_TUITION_CAP).toBe(30_908);
    expect(GI_HOUSING_MONTHLY).toBe(2_396);
    expect(GI_MONTHS_ENTITLED).toBe(36);
    expect(GI_MONTHS_PER_YEAR).toBe(9);
    expect(GI_MONTHS_ENTITLED / GI_MONTHS_PER_YEAR).toBe(4);
  });

  it('gives veterans’ preference to a discharge under honorable conditions, and not otherwise', () => {
    expect([...PREFERENCE_DISCHARGES].sort()).toEqual(['general', 'honorable', 'medical']);
    expect([...GI_BILL_DISCHARGES].sort()).toEqual(['honorable', 'medical']);
    expect(PREFERENCE_MIN_YEARS).toBe(2);
    expect([...PREFERENCE_TRACKS].sort()).toEqual(['public', 'safety']);
  });
});

/* -------------------------------------------------------------------------- */
/* The character of a discharge                                                */
/* -------------------------------------------------------------------------- */

describe('the character of a discharge', () => {
  it('is entry-level for a recruit who did not finish training, whatever else is true', () => {
    expect(dischargeOf({ how: 'washed-out', reputation: 90 })).toBe('entry-level');
    expect(dischargeOf({ how: 'washed-out', reputation: 0 })).toBe('entry-level');
  });

  it('is medical for a medical board and dishonorable for a court-martial, whatever the reputation', () => {
    expect(dischargeOf({ how: 'medical', reputation: 95 })).toBe('medical');
    expect(dischargeOf({ how: 'medical', reputation: 5 })).toBe('medical');
    expect(dischargeOf({ how: 'misconduct', reputation: 95 })).toBe('dishonorable');
    expect(dischargeOf({ how: 'misconduct', reputation: 5 })).toBe('dishonorable');
  });

  it('is honorable for a retirement and for a death in service, however poor the reputation', () => {
    expect(dischargeOf({ how: 'retired', reputation: 1 })).toBe('honorable');
    expect(dischargeOf({ how: 'retired', reputation: 1, refused: true })).toBe('honorable');
    expect(dischargeOf({ how: 'killed', reputation: 1 })).toBe('honorable');
  });

  it('is general under the reputation line at the end of a term, and honorable on it', () => {
    expect(GENERAL_BELOW).toBe(50);
    for (const how of ['term', 'passed-over']) {
      expect(dischargeOf({ how, reputation: GENERAL_BELOW - 1 }), how).toBe('general');
      expect(dischargeOf({ how, reputation: GENERAL_BELOW }), how).toBe('honorable');
      expect(dischargeOf({ how, reputation: 100 }), how).toBe('honorable');
      expect(dischargeOf({ how, reputation: 0 }), how).toBe('general');
    }
  });

  it('is general for a term the service did not renew, under a higher line, and a refusal caps it at general', () => {
    expect(NOT_RETAINED_GENERAL_BELOW).toBe(52);
    expect(dischargeOf({ how: 'not-retained', reputation: 51 })).toBe('general');
    expect(dischargeOf({ how: 'not-retained', reputation: 52 })).toBe('honorable');
    expect(dischargeOf({ how: 'not-retained', reputation: 99 })).toBe('honorable');
    expect(dischargeOf({ how: 'not-retained', reputation: 99, refused: true })).toBe('general');
    expect(dischargeOf({ how: 'not-retained', reputation: 99, refused: false })).toBe('honorable');
  });

  it('does not let a refusal change a term somebody chose to end', () => {
    expect(dischargeOf({ how: 'term', reputation: 80, refused: true })).toBe('honorable');
  });
});

/* -------------------------------------------------------------------------- */
/* What a veteran has                                                          */
/* -------------------------------------------------------------------------- */

describe('retired pay', () => {
  const retired = pastRow({ how: 'retired', years: 22, endedAge: 41, finalGrade: 7 });

  it('is the formula for a retirement with twenty years in, from the year after it ended', () => {
    const state = military(retired);
    const pay = retiredPayFor(retired);
    expect(pay).toBeGreaterThan(0);
    expect(retiredPayOf(state)).toBe(pay);
    expect(retiredPayStartAge(state)).toBe(42);
    expect(retiredPayAt(state, 41)).toBe(0);
    expect(retiredPayAt(state, 42)).toBe(pay);
    expect(retiredPayAt(state, 80)).toBe(pay);
  });

  it('is nothing for a life that never retired', () => {
    expect(retiredPayOf(EMPTY_MILITARY)).toBe(0);
    expect(retiredPayStartAge(EMPTY_MILITARY)).toBeUndefined();
    expect(retiredPayAt(EMPTY_MILITARY, 70)).toBe(0);
    expect(retiredPayAt(military(pastRow({ how: 'term', years: 24 })), 70)).toBe(0);
    expect(retiredPayAt(military(pastRow({ how: 'retired', years: 19 })), 70)).toBe(0);
  });

  it('is the largest of the pensions earned, from the first one’s year', () => {
    const small = pastRow({ how: 'retired', years: 20, endedAge: 40, finalGrade: 5 });
    const large = pastRow({ how: 'retired', years: 30, endedAge: 55, finalGrade: 8 });
    const state = military(small, large);
    expect(retiredPayOf(state)).toBe(Math.max(retiredPayFor(small), retiredPayFor(large)));
    expect(retiredPayFor(large)).toBeGreaterThan(retiredPayFor(small));
    expect(retiredPayStartAge(state)).toBe(41);
    expect(retiredPayAt(state, 41)).toBe(retiredPayFor(large));
  });

  it('starts at the first pension that pays, not at the first career', () => {
    const early = pastRow({ how: 'term', years: 6, endedAge: 25 });
    const state = military(early, retired);
    expect(retiredPayStartAge(state)).toBe(42);
  });
});

describe('the GI Bill', () => {
  it('is the tier for the months served, and nothing for a discharge that did not earn it', () => {
    expect(giBillPercent(military(pastRow({ years: 1 })))).toBe(0.6);
    expect(giBillPercent(military(pastRow({ years: 2 })))).toBe(0.8);
    expect(giBillPercent(military(pastRow({ years: 3 })))).toBe(1);
    expect(giBillPercent(military(pastRow({ years: 8 })))).toBe(1);
    for (const discharge of ['general', 'dishonorable', 'entry-level'] as const) {
      expect(giBillPercent(military(pastRow({ discharge, years: 8 }))), discharge).toBe(0);
    }
    expect(giBillPercent(military(pastRow({ how: 'killed', years: 8 })))).toBe(0);
    expect(giBillPercent(EMPTY_MILITARY)).toBe(0);
  });

  it('pays the whole of it for a medical discharge, however short the service', () => {
    expect(
      giBillPercent(military(pastRow({ how: 'medical', discharge: 'medical', years: 1 }))),
    ).toBe(1);
    expect(
      giBillPercent(military(pastRow({ how: 'medical', discharge: 'medical', years: 0 }))),
    ).toBe(1);
  });

  it('adds up the months of every service that earned it, and leaves out one that did not', () => {
    const state = military(
      pastRow({ years: 1 }),
      pastRow({ years: 1, discharge: 'general' }),
      pastRow({ years: 1, how: 'killed' }),
      pastRow({ years: 1, discharge: 'dishonorable', how: 'misconduct' }),
    );
    expect(giServiceMonths(state)).toBe(12);
    expect(giBillPercent(state)).toBe(0.6);
    expect(giBillPercent(military(pastRow({ years: 1 }), pastRow({ years: 1 })))).toBe(0.8);
  });

  it('is not paid to somebody still serving', () => {
    const still: MilitaryState = { past: [pastRow({ years: 8 })], service: serviceRow() };
    expect(giBillPercent(still)).toBe(0);
    expect(giMonthsLeft(still)).toBe(0);
    expect(giTuitionAid(still, 9_400)).toBe(0);
    expect(giHousingFor(still)).toBe(0);
  });

  it('has thirty-six months, and counts down as they are used', () => {
    const at = (used?: number): MilitaryState => ({
      past: [pastRow({ years: 8 })],
      ...(used !== undefined ? { giBillMonthsUsed: used } : {}),
    });
    expect(giMonthsLeft(at())).toBe(36);
    expect(giMonthsLeft(at(0))).toBe(36);
    expect(giMonthsLeft(at(27))).toBe(9);
    expect(giMonthsLeft(at(36))).toBe(0);
    expect(giMonthsLeft(at(99))).toBe(0);
    expect(giMonthsLeft(EMPTY_MILITARY)).toBe(0);
    expect(giMonthsThisYear(at(0))).toBe(9);
    expect(giMonthsThisYear(at(27))).toBe(9);
    expect(giMonthsThisYear(at(30))).toBe(6);
    expect(giMonthsThisYear(at(36))).toBe(0);
  });

  it('pays the share of tuition earned, up to the yearly cap', () => {
    const full = military(pastRow({ years: 8 }));
    const sixty = military(pastRow({ years: 1 }));
    expect(giTuitionAid(full, 9_400)).toBe(9_400);
    expect(giTuitionAid(sixty, 9_400)).toBe(5_640);
    expect(giTuitionAid(full, 50_000)).toBe(30_908);
    expect(giTuitionAid(sixty, 50_000)).toBe(Math.round(0.6 * 30_908));
    expect(giTuitionAid(full, 30_908)).toBe(30_908);
    expect(giTuitionAid(full, 30_909)).toBe(30_908);
    expect(giTuitionAid(full, 0)).toBe(0);
    expect(giTuitionAid(full, -5)).toBe(0);
    expect(giTuitionAid(EMPTY_MILITARY, 9_400)).toBe(0);
  });

  it('pays only the months that are left, so the last part of a year is a part', () => {
    const left = (used: number): MilitaryState => ({
      past: [pastRow({ years: 8 })],
      giBillMonthsUsed: used,
    });
    expect(giTuitionAid(left(27), 9_400)).toBe(9_400);
    expect(giTuitionAid(left(30), 9_400)).toBe(Math.round(9_400 * (6 / 9)));
    expect(giTuitionAid(left(35), 9_400)).toBe(Math.round(9_400 * (1 / 9)));
    expect(giTuitionAid(left(36), 9_400)).toBe(0);
    expect(giHousingFor(left(30))).toBe(Math.round(2_396 * 6));
    expect(giHousingFor(left(36))).toBe(0);
  });

  it('pays a housing allowance for nine months at the share earned', () => {
    expect(giHousingFor(military(pastRow({ years: 8 })))).toBe(2_396 * 9);
    expect(giHousingFor(military(pastRow({ years: 1 })))).toBe(Math.round(0.6 * 2_396 * 9));
    expect(giHousingFor(military(pastRow({ discharge: 'general', years: 8 })))).toBe(0);
    expect(giHousingFor(EMPTY_MILITARY)).toBe(0);
  });
});

describe('veterans’ preference', () => {
  it('goes to an honorable, general or medical discharge after two years, and to nothing else', () => {
    for (const discharge of ['honorable', 'general'] as const) {
      expect(
        veteranPreference({ military: military(pastRow({ discharge, years: 2 })) }),
        discharge,
      ).toBe(true);
      expect(
        veteranPreference({ military: military(pastRow({ discharge, years: 1 })) }),
        discharge,
      ).toBe(false);
    }
    expect(
      veteranPreference({
        military: military(pastRow({ how: 'medical', discharge: 'medical', years: 0 })),
      }),
    ).toBe(true);
    expect(
      veteranPreference({
        military: military(pastRow({ how: 'medical', discharge: 'medical', years: 1 })),
      }),
    ).toBe(true);
    expect(
      veteranPreference({
        military: military(pastRow({ how: 'misconduct', discharge: 'dishonorable', years: 9 })),
      }),
    ).toBe(false);
    expect(
      veteranPreference({
        military: military(pastRow({ how: 'washed-out', discharge: 'entry-level', years: 0 })),
      }),
    ).toBe(false);
    expect(veteranPreference({ military: EMPTY_MILITARY })).toBe(false);
  });

  it('counts any service that qualifies, and not one still going', () => {
    const state = military(pastRow({ years: 1 }), pastRow({ years: 3, discharge: 'general' }));
    expect(veteranPreference({ military: state })).toBe(true);
    expect(veteranPreference({ military: { ...state, service: serviceRow() } })).toBe(false);
    expect(veteranPreference({ military: { past: [], service: serviceRow({ years: 9 }) } })).toBe(
      false,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Hiring                                                                      */
/* -------------------------------------------------------------------------- */

describe('hiring a veteran', () => {
  const applicant = {
    age: 30,
    smarts: 60,
    charisma: 55,
    discipline: 60,
    looks: 50,
    education: 'highSchool' as const,
    opens: [] as string[],
    licenses: [] as string[],
    experience: 3,
    standing: 50,
    reached: -1,
  };

  it('adds the bonus to the odds on a public or safety job, to the dot', () => {
    for (const track of PREFERENCE_TRACKS) {
      const job = jobsIn(track as CareerTrack).find((row) => row.rung === 0)!;
      const plain = hireChance(job, applicant);
      expect(plain, track).toBeGreaterThan(0.03);
      expect(plain + PREFERENCE_BONUS, track).toBeLessThan(0.93);
      expect(hireChance(job, { ...applicant, veteran: true }), track).toBeCloseTo(
        plain + PREFERENCE_BONUS,
        10,
      );
      expect(hireChance(job, { ...applicant, veteran: false }), track).toBe(plain);
    }
  });

  it('adds nothing on any other track', () => {
    for (const track of ALL_TRACKS.filter((row) => !PREFERENCE_TRACKS.includes(row))) {
      const job = jobsIn(track).find((row) => row.rung === 0);
      if (!job) continue;
      expect(hireChance(job, { ...applicant, veteran: true }), track).toBe(
        hireChance(job, applicant),
      );
    }
  });

  it('never makes a job a veteran lacks the paper for any easier', () => {
    const job = jobsIn('safety').find(
      (row) => row.requires !== undefined && row.requires !== 'none',
    );
    if (!job) return;
    expect(hireChance(job, { ...applicant, education: 'none' as never, veteran: true })).toBe(
      hireChance(job, { ...applicant, education: 'none' as never }),
    );
  });

  it('reads the preference from the state: a veteran’s odds beat the same life’s without service', () => {
    const job = jobsIn('public').find((row) => row.rung === 0)!;
    const civilian = chanceOf(base, job);
    const served = chanceOf(veteran(base, { years: 6 }), job);
    expect(served).toBeCloseTo(civilian + PREFERENCE_BONUS, 10);
    const generalDischarge = chanceOf(veteran(base, { discharge: 'general', years: 6 }), job);
    expect(generalDischarge).toBeCloseTo(civilian + PREFERENCE_BONUS, 10);
    const dishonorable = chanceOf(
      veteran(base, { how: 'misconduct', discharge: 'dishonorable', years: 6 }),
      job,
    );
    expect(dishonorable).toBe(civilian);
    const retail = jobsIn('retail').find((row) => row.rung === 0)!;
    expect(chanceOf(veteran(base, { years: 6 }), retail)).toBe(chanceOf(base, retail));
    expect(findJob(String(job.id))?.id).toBe(job.id);
  });
});

/* -------------------------------------------------------------------------- */
/* The year: discharges drawn                                                  */
/* -------------------------------------------------------------------------- */

describe('a medical board', () => {
  const unit = (life: GameState) => serviceDraw(life, 'medical', AGE);
  const sick = (
    _seed: string,
    take: (unit: number) => boolean,
    id = 'cond.blast',
    patch: Partial<ServiceCareer> = {},
  ) => injured(serving(seedWhere(base, 'medical', AGE, take), patch), id);

  it('is set at four in ten a year for somebody holding a serious injury from service', () => {
    expect(MEDICAL_BOARD_CHANCE).toBe(0.4);
  });

  it('sends a member with a serious injury home on the draw, with a medical discharge', () => {
    const life = sick('a', (u) => u < MEDICAL_BOARD_CHANCE);
    const out = runYear(life);
    expect(out.left).toBe(true);
    const past = out.military.past.at(-1)!;
    expect(past.how).toBe('medical');
    expect(past.discharge).toBe('medical');
    expect(out.military.service).toBeUndefined();
    expect(out.records.map((row) => row.label).join('|')).toMatch(
      /Medically discharged from the Army/,
    );
    expect(out.lines.at(-1)!.text.length).toBeGreaterThan(10);
    expect(out.mood).toBeLessThan(0);
  });

  it('keeps a member the draw spares', () => {
    const life = sick('b', (u) => u >= MEDICAL_BOARD_CHANCE);
    expect(runYear(life).left).toBe(false);
  });

  it('draws exactly at the line: a draw just under is a board, the line itself is not', () => {
    const under = sick('c', (u) => u < MEDICAL_BOARD_CHANCE && u > MEDICAL_BOARD_CHANCE - 0.02);
    const over = sick('d', (u) => u >= MEDICAL_BOARD_CHANCE && u < MEDICAL_BOARD_CHANCE + 0.02);
    expect(unit(under)).toBeLessThan(MEDICAL_BOARD_CHANCE);
    expect(runYear(under).left).toBe(true);
    expect(runYear(over).left).toBe(false);
  });

  it('looks only at a serious injury that came from service', () => {
    const draw = (u: number) => u < MEDICAL_BOARD_CHANCE;
    expect(runYear(sick('e', draw, 'cond.shrapnel')).left).toBe(false);
    const civilian = injured(serving(seedWhere(base, 'medical', AGE, draw)), 'cond.asthma');
    expect(holdsServiceInjury(civilian.health.conditions)).toBe(false);
    expect(runYear(civilian).left).toBe(false);
    expect(runYear(serving(seedWhere(base, 'medical', AGE, draw))).left).toBe(false);
    for (const id of ['cond.blast', 'cond.limb', 'cond.brain', 'cond.burns', 'cond.trauma']) {
      expect(holdsServiceInjury([{ conditionId: id, since: 20, treated: false }]), id).toBe(true);
    }
    expect(holdsServiceInjury([{ conditionId: 'cond.shrapnel', since: 20, treated: false }])).toBe(
      false,
    );
    expect(holdsServiceInjury([])).toBe(false);
    expect(
      holdsServiceInjury([{ conditionId: 'cond.not-a-thing', since: 20, treated: false }]),
    ).toBe(false);
  });

  it('does not reach a member who is away, or one in training', () => {
    const draw = (u: number) => u < MEDICAL_BOARD_CHANCE;
    const life = sick('f', draw);
    const away = {
      ...life,
      military: {
        ...life.military,
        deployment: {
          status: 'active',
          theater: 'Camp Meridian',
          months: 8,
          tier: 'forward',
          incidents: 2,
          results: [],
          orderedAge: base.player.age,
        },
      },
    } as GameState;
    expect(runYear(away).left).toBe(false);
    const training = injured(
      serving(seedWhere(base, 'medical', AGE, draw), { stage: 'training', years: 0 }),
      'cond.blast',
    );
    expect(runYear(training).military.past.at(-1)?.how).not.toBe('medical');
  });

  it('is a retirement, with the pension, for a member with twenty years in', () => {
    const life = sick('g', (u) => u < MEDICAL_BOARD_CHANCE, 'cond.blast', {
      years: 20,
      termEnds: 24,
      grade: 7,
    });
    const out = runYear(life);
    expect(out.left).toBe(true);
    const past = out.military.past.at(-1)!;
    expect(past.how).toBe('retired');
    expect(past.discharge).toBe('honorable');
    expect(retiredPayFor(past)).toBeGreaterThan(0);
    const nineteen = sick('h', (u) => u < MEDICAL_BOARD_CHANCE, 'cond.blast', {
      years: 18,
      termEnds: 24,
      grade: 7,
    });
    expect(runYear(nineteen).military.past.at(-1)!.how).toBe('medical');
    const exactly = sick('i', (u) => u < MEDICAL_BOARD_CHANCE, 'cond.blast', {
      years: 19,
      termEnds: 24,
      grade: 7,
    });
    expect(runYear(exactly).military.past.at(-1)!.how).toBe('retired');
  });

  it('carries no pension and no GI-Bill penalty: a medical discharge keeps the whole benefit', () => {
    const out = runYear(sick('j', (u) => u < MEDICAL_BOARD_CHANCE, 'cond.limb', { years: 2 }));
    const past = out.military.past.at(-1)!;
    expect(retiredPayFor(past)).toBe(0);
    expect(giBillPercent({ past: [past] })).toBe(1);
    expect(veteranPreference({ military: { past: [past] } })).toBe(true);
  });
});

describe('a court-martial', () => {
  const lowRep = (patch: Partial<ServiceCareer> = {}) => ({
    reputation: 5,
    performance: 10,
    ...patch,
  });
  const bad = (
    _seed: string,
    take: (unit: number) => boolean,
    discipline = 20,
    patch: Partial<ServiceCareer> = {},
  ) => serving(withStats(seedWhere(base, 'misconduct', AGE, take), { discipline }), lowRep(patch));

  it('is rare: five in a hundred a year, for the undisciplined and the poorly thought of', () => {
    expect(MISCONDUCT_CHANCE).toBe(0.05);
    expect(MISCONDUCT_DISCIPLINE_BELOW).toBe(35);
    expect(MISCONDUCT_REPUTATION_BELOW).toBe(50);
  });

  it('ends a career with a dishonorable discharge on the draw', () => {
    const out = runYear(bad('a', (u) => u < MISCONDUCT_CHANCE));
    expect(out.left).toBe(true);
    const past = out.military.past.at(-1)!;
    expect(past.how).toBe('misconduct');
    expect(past.discharge).toBe('dishonorable');
    expect(out.records.map((row) => row.label).join('|')).toMatch(
      /Dishonorably discharged from the Army/,
    );
    expect(out.mood).toBeLessThan(-4);
  });

  it('spares somebody the draw spares', () => {
    expect(runYear(bad('b', (u) => u >= MISCONDUCT_CHANCE)).left).toBe(false);
  });

  it('draws at the line', () => {
    expect(
      runYear(bad('c', (u) => u < MISCONDUCT_CHANCE && u > MISCONDUCT_CHANCE - 0.01)).left,
    ).toBe(true);
    expect(
      runYear(bad('d', (u) => u >= MISCONDUCT_CHANCE && u < MISCONDUCT_CHANCE + 0.01)).left,
    ).toBe(false);
  });

  it('needs both: discipline under 35 and a poor reputation', () => {
    const draw = (u: number) => u < MISCONDUCT_CHANCE;
    expect(runYear(bad('e', draw, 34)).left).toBe(true);
    expect(runYear(bad('f', draw, 35)).left).toBe(false);
    expect(runYear(bad('g', draw, 80)).left).toBe(false);
    const respected = serving(
      withStats(seedWhere(base, 'misconduct', AGE, draw), { discipline: 20 }),
      {
        reputation: 90,
        performance: 90,
      },
    );
    expect(runYear(respected).left).toBe(false);
  });

  it('turns on the reputation as it stands after the year, at the line', () => {
    const draw = (u: number) => u < MISCONDUCT_CHANCE;
    const seeded = withStats(seedWhere(base, 'misconduct', AGE, draw), { discipline: 20 });
    const after = (reputation: number) => {
      const out = runYear(serving(seeded, { reputation, performance: 50 }));
      return {
        out,
        reputation: out.left
          ? out.military.past.at(-1)!.reputation
          : out.military.service!.reputation,
      };
    };
    let under: number | undefined;
    let on: number | undefined;
    for (let r = 0; r <= 100; r += 1) {
      const row = after(r);
      if (row.reputation === MISCONDUCT_REPUTATION_BELOW - 1 && under === undefined) under = r;
      if (row.reputation === MISCONDUCT_REPUTATION_BELOW && on === undefined) on = r;
    }
    expect(under).toBeDefined();
    expect(on).toBeDefined();
    expect(after(under!).out.left).toBe(true);
    expect(after(on!).out.left).toBe(false);
  });

  it('does not reach a member who is away or in training', () => {
    const draw = (u: number) => u < MISCONDUCT_CHANCE;
    const life = bad('h', draw);
    const away = {
      ...life,
      military: {
        ...life.military,
        deployment: {
          status: 'active',
          theater: 'Camp Meridian',
          months: 8,
          tier: 'forward',
          incidents: 2,
          results: [],
          orderedAge: base.player.age,
        },
      },
    } as GameState;
    expect(runYear(away).left).toBe(false);
    const training = bad('i', draw, 20, { stage: 'training', years: 0 });
    expect(runYear(training).military.past.at(-1)?.how).not.toBe('misconduct');
  });

  it('loses the GI Bill, the preference and the pension together', () => {
    const past = runYear(
      bad('j', (u) => u < MISCONDUCT_CHANCE, 20, { years: 25, termEnds: 99, grade: 7 }),
    ).military.past.at(-1)!;
    expect(past.discharge).toBe('dishonorable');
    expect(retiredPayFor(past)).toBe(0);
    expect(giBillPercent({ past: [past] })).toBe(0);
    expect(veteranPreference({ military: { past: [past] } })).toBe(false);
  });
});

describe('how an ordinary career ends', () => {
  it('is honorable for a term that was chosen, and a general discharge with a reputation under the line', () => {
    const calm = seedWhere(base, 'medical', AGE, () => true);
    const good = runYear(serving(calm, { years: 3, termEnds: 4, reputation: 80, performance: 80 }));
    expect(good.left).toBe(false);
    expect(good.military.offer?.kind).not.toBe('reenlist');
    expect(good.military.service?.years).toBe(4);
  });

  it('gives a member not asked to stay a general discharge when the reputation is low, honorable when it is high', () => {
    const lowLife = serving(base, { years: 3, termEnds: 4, reputation: 20, performance: 5 });
    const low = runYear(lowLife);
    expect(low.left).toBe(true);
    expect(low.military.past.at(-1)!.how).toBe('not-retained');
    expect(low.military.past.at(-1)!.discharge).toBe('general');
    expect(low.lines.map((row) => row.text)).toContain(
      GENERAL_DISCHARGE_NOTES.find((text) => low.lines.some((row) => row.text === text))!,
    );
    const highLife = serving(base, { years: 3, termEnds: 4, reputation: 95, performance: 5 });
    const high = runYear(highLife);
    expect(high.left).toBe(true);
    expect(high.military.past.at(-1)!.how).toBe('not-retained');
    expect(high.military.past.at(-1)!.discharge).toBe('honorable');
    expect(high.lines.some((row) => GENERAL_DISCHARGE_NOTES.includes(row.text))).toBe(false);
  });

  it('gives a member who refused the next term a general discharge, whatever the reputation', () => {
    const life = serving(base, {
      years: 3,
      termEnds: 4,
      reputation: 95,
      performance: 80,
      refusedTerm: true,
    });
    const out = runYear(life);
    expect(out.left).toBe(true);
    expect(out.military.past.at(-1)!.discharge).toBe('general');
  });

  it('leaves a retirement honorable, with the pension, whatever the reputation', () => {
    const life = serving(base, {
      years: 19,
      termEnds: 20,
      reputation: 5,
      performance: 5,
      grade: 7,
    });
    const out = runYear(life);
    expect(out.left).toBe(true);
    const past = out.military.past.at(-1)!;
    expect(past.how).toBe('retired');
    expect(past.discharge).toBe('honorable');
    expect(retiredPayFor(past)).toBeGreaterThan(0);
  });

  it('gives a washed-out recruit the entry-level separation and no benefits', () => {
    const recruit = serving(base, { stage: 'training', years: 0, termEnds: 4 });
    let washed: ReturnType<typeof runYear> | undefined;
    for (let i = 0; i < 400 && !washed; i += 1) {
      const out = runYear(
        serving(
          withStats(withSeed(base, `wash-${i}`), { discipline: 20, health: 50, smarts: 30 }),
          { stage: 'training', years: 0, termEnds: 4 },
        ),
      );
      if (out.left) washed = out;
    }
    expect(recruit.military.service?.stage).toBe('training');
    expect(washed).toBeDefined();
    const past = washed!.military.past.at(-1)!;
    expect(past.how).toBe('washed-out');
    expect(past.discharge).toBe('entry-level');
    expect(giBillPercent({ past: [past] })).toBe(0);
    expect(veteranPreference({ military: { past: [past] } })).toBe(false);
  });

  it('is decided when the member answers the question at a term’s end, too', () => {
    const life = serving(withSeed(base, 'answer'), {
      years: 4,
      termEnds: 4,
      reputation: 20,
      performance: 60,
    });
    const asked = {
      ...life,
      military: {
        ...life.military,
        offer: {
          kind: 'reenlist',
          branch: 'army',
          track: 'enlisted',
          grade: 4,
          years: 4,
          age: life.player.age,
          eventId: 'military.offer',
        },
      },
    } as GameState;
    const left = decide(withMilitaryOffer(asked, true), MILITARY_OFFER_EVENT_ID, MILITARY_LEAVE);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    const past = left.value.state.military.past.at(-1)!;
    expect(past.how).toBe('term');
    expect(past.discharge).toBe('general');
    const fine = serving(withSeed(base, 'answer'), { years: 4, termEnds: 4, reputation: 70 });
    const askedFine = {
      ...fine,
      military: { ...fine.military, offer: asked.military.offer },
    } as GameState;
    const out = decide(withMilitaryOffer(askedFine, true), MILITARY_OFFER_EVENT_ID, MILITARY_LEAVE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.state.military.past.at(-1)!.discharge).toBe('honorable');
  });

  it('is honorable when a member with twenty years retires by choice', () => {
    const life = serving(withSeed(base, 'retire'), {
      years: 21,
      termEnds: 24,
      reputation: 10,
      grade: 7,
    });
    const out = retireFromService(life);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const past = out.value.state.military.past.at(-1)!;
    expect(past.how).toBe('retired');
    expect(past.discharge).toBe('honorable');
  });
});

/* -------------------------------------------------------------------------- */
/* The year: money                                                             */
/* -------------------------------------------------------------------------- */

const rowsOf = (state: GameState) =>
  state.finance.transactions.filter((row) => row.year === state.world.year);
const amountOf = (state: GameState, source: string): number | undefined => {
  const row = rowsOf(state).find((entry) => entry.source === source);
  return row === undefined ? undefined : Number(row.amount);
};

const atCollege = (state: GameState): GameState => ({
  ...state,
  education: {
    ...state.education,
    stage: 'college',
    majorId: undefined,
    collegeYear: 0,
    performance: 60,
    effort: 'normal',
  } as never,
});

describe('retired pay in the ledger', () => {
  const retired = pastRow({ how: 'retired', years: 22, endedAge: base.player.age, finalGrade: 7 });

  it('arrives the year after the career ended, as income that is not taxed, and again each year after', () => {
    const life = veteran(base, retired);
    const out = advanceYear(life).state;
    expect(amountOf(out, 'Military retired pay')).toBe(retiredPayFor(retired) * 100);
    const row = rowsOf(out).find((entry) => entry.source === 'Military retired pay')!;
    expect(row.category).toBe('assetIncome');
    expect(rowsOf(out).some((entry) => entry.source.startsWith('Tax on Military'))).toBe(false);
    const again = advanceYear(answerAll(out)).state;
    expect(amountOf(again, 'Military retired pay')).toBe(retiredPayFor(retired) * 100);
  });

  it('is not paid in the year the career ended', () => {
    const life = veteran(base, { ...retired, endedAge: base.player.age + 1 });
    expect(amountOf(advanceYear(life).state, 'Military retired pay')).toBeUndefined();
  });

  it('is not paid to a life that did not retire, or to a retirement short of twenty years', () => {
    expect(amountOf(advanceYear(base).state, 'Military retired pay')).toBeUndefined();
    expect(
      amountOf(
        advanceYear(veteran(base, { how: 'term', years: 24, endedAge: 25 })).state,
        'Military retired pay',
      ),
    ).toBeUndefined();
    expect(
      amountOf(
        advanceYear(veteran(base, { how: 'retired', years: 19, endedAge: 25 })).state,
        'Military retired pay',
      ),
    ).toBeUndefined();
  });

  it('says so in the feed in the first year, and not after', () => {
    const life = veteran(base, retired);
    const out = advanceYear(life).state;
    const mention = (state: GameState) =>
      state.player.timeline.filter(
        (entry) =>
          entry.year === state.world.year &&
          /retire|retirement|check|pay/i.test(entry.text) &&
          entry.id.includes('veteran'),
      );
    expect(mention(out).length).toBe(1);
    expect(mention(out)[0]!.text).toContain(retiredPayFor(retired).toLocaleString('en-US'));
    const again = advanceYear(answerAll(out)).state;
    expect(mention(again).length).toBe(0);
  });

  it('leaves the life’s own money to a year with no pension unchanged: no row, no change', () => {
    const plain = advanceYear(withSeed(base, 'plain')).state;
    const same = advanceYear(
      withSeed(veteran(base, { how: 'term', years: 4, endedAge: 25 }), 'plain'),
    ).state;
    expect(rowsOf(plain).map((row) => row.source)).toEqual(rowsOf(same).map((row) => row.source));
  });
});

describe('the GI Bill at college', () => {
  const sixty = pastRow({ years: 1 });

  it('pays the tuition it covers, so the bill is only what is left', () => {
    const civilian = advanceYear(withSeed(atCollege(base), 'gi-1')).state;
    expect(amountOf(civilian, 'Tuition')).toBe(-9_400 * 100);
    const full = advanceYear(withSeed(atCollege(veteran(base, { years: 8 })), 'gi-1')).state;
    expect(amountOf(full, 'Tuition')).toBeUndefined();
    const part = advanceYear(withSeed(atCollege(veteran(base, sixty)), 'gi-1')).state;
    expect(amountOf(part, 'Tuition')).toBe(-(9_400 - 5_640) * 100);
  });

  it('pays the housing allowance for a year attended, untaxed, as a gift', () => {
    const out = advanceYear(withSeed(atCollege(veteran(base, { years: 8 })), 'gi-2')).state;
    expect(amountOf(out, 'GI Bill housing allowance')).toBe(2_396 * 9 * 100);
    const row = rowsOf(out).find((entry) => entry.source === 'GI Bill housing allowance')!;
    expect(row.category).toBe('gift');
    const part = advanceYear(withSeed(atCollege(veteran(base, sixty)), 'gi-2')).state;
    expect(amountOf(part, 'GI Bill housing allowance')).toBe(Math.round(0.6 * 2_396 * 9) * 100);
  });

  it('uses nine months a year, and says so when it starts and when it runs out', () => {
    let life = withSeed(atCollege(veteran(base, { years: 8 })), 'gi-3');
    const first = advanceYear(life).state;
    expect(first.military.giBillMonthsUsed).toBe(9);
    expect(
      first.player.timeline.some(
        (entry) => entry.id.includes('veteran') && /GI Bill/.test(entry.text),
      ),
    ).toBe(true);
    const nearly = {
      ...atCollege(veteran(base, { years: 8 }, { giBillMonthsUsed: 27 })),
      rng: new Rng('gi-4'),
    } as unknown as GameState;
    const last = advanceYear(nearly).state;
    expect(last.military.giBillMonthsUsed).toBe(36);
    expect(
      last.player.timeline.some(
        (entry) => entry.id.includes('veteran') && /ran out|spent/.test(entry.text),
      ),
    ).toBe(true);
    expect(
      first.player.timeline.some(
        (entry) => entry.id.includes('veteran') && /ran out|spent/.test(entry.text),
      ),
    ).toBe(false);
    life = nearly;
  });

  it('pays a part of the last year and then nothing', () => {
    const six = advanceYear(
      withSeed(atCollege(veteran(base, { years: 8 }, { giBillMonthsUsed: 30 })), 'gi-5'),
    ).state;
    expect(amountOf(six, 'GI Bill housing allowance')).toBe(2_396 * 6 * 100);
    expect(six.military.giBillMonthsUsed).toBe(36);
    const none = advanceYear(
      withSeed(atCollege(veteran(base, { years: 8 }, { giBillMonthsUsed: 36 })), 'gi-6'),
    ).state;
    expect(amountOf(none, 'GI Bill housing allowance')).toBeUndefined();
    expect(amountOf(none, 'Tuition')).toBe(-9_400 * 100);
    expect(none.military.giBillMonthsUsed).toBe(36);
  });

  it('pays nothing to a discharge that did not earn it, and uses nothing', () => {
    for (const patch of [
      { discharge: 'general' as const },
      { how: 'misconduct' as const, discharge: 'dishonorable' as const },
      { how: 'washed-out' as const, discharge: 'entry-level' as const },
    ]) {
      const out = advanceYear(
        withSeed(atCollege(veteran(base, { years: 8, ...patch })), 'gi-7'),
      ).state;
      expect(amountOf(out, 'Tuition'), JSON.stringify(patch)).toBe(-9_400 * 100);
      expect(amountOf(out, 'GI Bill housing allowance')).toBeUndefined();
      expect(out.military.giBillMonthsUsed).toBeUndefined();
    }
  });

  it('is for a first degree or a trade, and never graduate school', () => {
    const grad = {
      ...veteran(base, { years: 8 }),
      education: {
        ...base.education,
        stage: 'postgrad',
        collegeYear: 0,
        performance: 60,
        effort: 'normal',
      },
    } as unknown as GameState;
    expect(collegeSupportOf(grad)).toBe(0);
    const out = advanceYear(withSeed(grad, 'gi-8')).state;
    expect(amountOf(out, 'GI Bill housing allowance')).toBeUndefined();
    expect(out.military.giBillMonthsUsed).toBeUndefined();
  });

  it('uses no months for a year that is not at college', () => {
    const out = advanceYear(withSeed(veteran(base, { years: 8 }), 'gi-9')).state;
    expect(amountOf(out, 'GI Bill housing allowance')).toBeUndefined();
    expect(out.military.giBillMonthsUsed).toBeUndefined();
  });

  it('reaches the affordability gate: collegeSupportOf counts it', () => {
    expect(collegeSupportOf(veteran(base, { years: 8 }))).toBe(9_400);
    expect(collegeSupportOf(veteran(base, sixty))).toBe(5_640);
    expect(collegeSupportOf(base)).toBe(0);
    expect(collegeSupportOf(veteran(base, { years: 8 }, { giBillMonthsUsed: 36 }))).toBe(0);
  });

  it('does not count a year the character left for want of money', () => {
    const out = runVeteransYear({
      military: military(pastRow({ years: 8 })),
      age: 30,
      atCollege: true,
      ending: 'ran-out-of-money',
    });
    expect(out.housing).toBe(0);
    expect(out.military.giBillMonthsUsed).toBeUndefined();
    const failed = runVeteransYear({
      military: military(pastRow({ years: 8 })),
      age: 30,
      atCollege: true,
      ending: 'failed-out',
    });
    expect(failed.military.giBillMonthsUsed).toBe(9);
    const finished = runVeteransYear({
      military: military(pastRow({ years: 8 })),
      age: 30,
      atCollege: true,
      ending: 'finished',
    });
    expect(finished.housing).toBe(2_396 * 9);
  });
});

describe('a life with no service', () => {
  it('is untouched: no veteran lines, no rows, no new fields', () => {
    const out = advanceYear(withSeed(base, 'none')).state;
    expect(out.military.giBillMonthsUsed).toBeUndefined();
    expect(out.player.timeline.some((entry) => entry.id.includes('veteran'))).toBe(false);
    expect(
      rowsOf(out).some(
        (row) =>
          row.source === 'Military retired pay' || row.source === 'GI Bill housing allowance',
      ),
    ).toBe(false);
    expect(runVeteransYear({ military: EMPTY_MILITARY, age: 30, atCollege: true })).toEqual({
      retiredPay: 0,
      housing: 0,
      military: EMPTY_MILITARY,
      lines: [],
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Pinned after the sabotage run                                               */
/* -------------------------------------------------------------------------- */

describe('what the sabotage run found loose', () => {
  const livingOf = (state: GameState): number =>
    Math.abs(
      Number(rowsOf(state).find((row) => row.source.startsWith('Living costs'))?.amount ?? 0),
    );

  it('says nothing about the GI Bill in a year with no months left to use', () => {
    const spent = veteran(base, { years: 8 }, { giBillMonthsUsed: 36 });
    const out = runVeteransYear({ military: spent.military, age: 30, atCollege: true });
    expect(out.lines).toEqual([]);
    expect(out.housing).toBe(0);
    expect(out.military).toBe(spent.military);
  });

  it('opens with the start line when the months used are a recorded zero, not only an absent count', () => {
    const zero = runVeteransYear({
      military: { past: [pastRow({ years: 8 })], giBillMonthsUsed: 0 },
      age: 30,
      atCollege: true,
    });
    expect(zero.lines).toHaveLength(1);
    expect(zero.lines[0]!.text).toContain('100%');
    const second = runVeteransYear({ military: zero.military, age: 31, atCollege: true });
    expect(second.lines).toEqual([]);
    expect(second.military.giBillMonthsUsed).toBe(18);
  });

  it('writes the general-discharge note only for a general discharge', () => {
    const board = runYear(
      injured(
        serving(seedWhere(base, 'medical', AGE, (u) => u < MEDICAL_BOARD_CHANCE)),
        'cond.blast',
      ),
    );
    expect(board.military.past.at(-1)!.discharge).toBe('medical');
    expect(board.lines.some((row) => GENERAL_DISCHARGE_NOTES.includes(row.text))).toBe(false);
    const martial = runYear(
      serving(
        withStats(
          seedWhere(base, 'misconduct', AGE, (u) => u < MISCONDUCT_CHANCE),
          { discipline: 20 },
        ),
        { reputation: 5, performance: 10 },
      ),
    );
    expect(martial.military.past.at(-1)!.discharge).toBe('dishonorable');
    expect(martial.lines.some((row) => GENERAL_DISCHARGE_NOTES.includes(row.text))).toBe(false);
  });

  it('judges a discharge on the reputation the service ends with, not the one it began the year with', () => {
    let crossed = 0;
    for (let reputation = 0; reputation <= 100; reputation += 1) {
      const out = runYear(
        serving(withSeed(base, 'rep'), { years: 3, termEnds: 4, reputation, performance: 5 }),
      );
      expect(out.left, String(reputation)).toBe(true);
      const past = out.military.past.at(-1)!;
      expect(past.discharge, String(reputation)).toBe(
        past.reputation < NOT_RETAINED_GENERAL_BELOW ? 'general' : 'honorable',
      );
      if (
        reputation < NOT_RETAINED_GENERAL_BELOW !==
        past.reputation < NOT_RETAINED_GENERAL_BELOW
      ) {
        crossed += 1;
      }
    }
    // The year moves the reputation across the line for at least one starting point, or this test pins nothing.
    expect(crossed).toBeGreaterThan(0);
  });

  it('pays the housing allowance at a trade school too', () => {
    const trade = {
      ...veteran(base, { years: 8 }),
      education: {
        ...base.education,
        stage: 'vocational',
        majorId: undefined,
        collegeYear: 0,
        performance: 60,
        effort: 'normal',
      },
    } as unknown as GameState;
    const out = advanceYear(withSeed(trade, 'trade-gi')).state;
    expect(amountOf(out, 'GI Bill housing allowance')).toBe(2_396 * 9 * 100);
    expect(out.military.giBillMonthsUsed).toBe(9);
  });

  it('counts a pension as the household’s income: a pensioner lives on it', () => {
    const retired = pastRow({
      how: 'retired',
      years: 30,
      endedAge: base.player.age,
      finalGrade: 9,
    });
    const pensioner = advanceYear(withSeed(veteran(base, retired), 'liv')).state;
    const neighbor = advanceYear(
      withSeed(veteran(base, { how: 'term', years: 4, endedAge: 25 }), 'liv'),
    ).state;
    expect(livingOf(pensioner)).toBeGreaterThan(livingOf(neighbor));
  });

  it('does not count a year left for want of money: no months used, no housing', () => {
    const rich = atCollege(veteran(base, { years: 1 }));
    // Drain the account to nothing through the books, so they still balance: tuition's share is $3,760.
    const drained = Number(rich.finance.balance) / 100;
    const broke = {
      ...rich,
      finance: {
        ...rich.finance,
        balance: 0 as never,
        transactions: [
          ...rich.finance.transactions,
          {
            id: `f:${rich.world.year}:spending:test-drain`,
            year: rich.world.year,
            age: rich.player.age,
            category: 'spending' as const,
            amount: (-drained * 100) as never,
            source: 'A test drain',
          },
        ],
      },
      player: { ...rich.player, cash: 0 as never },
    } as unknown as GameState;
    const out = advanceYear(withSeed(broke, 'broke')).state;
    expect(out.education.stage).not.toBe('college');
    expect(out.military.giBillMonthsUsed).toBeUndefined();
    expect(amountOf(out, 'GI Bill housing allowance')).toBeUndefined();
  });
});
