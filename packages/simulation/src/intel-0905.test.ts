/**
 * Ticket 0905 acceptance tests — military intelligence and the agencies.
 *
 * A clearance (three levels, no compartments), a military-intelligence specialty in every branch, and the FBI and the
 * CIA, entered through the service or off a degree. Missions are quiet yearly outcomes with real stakes: a clean or close
 * one costs nothing, a clearance is lost only after a mistake or a disaster, a death only after a disaster, and nothing in
 * the game opens the gate yet. The real figures (the General Schedule pay, the clearance processing times, the FBI's age
 * and degree rules, the 24-month window) are pinned and say so; the dials that decide who is hired, who is denied and
 * what a mission costs are the game's own, named in the doc.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AGENCIES,
  AGENCY_CLEARANCE,
  AGENCY_PENSION_AFTER_RATE,
  AGENCY_PENSION_AGE,
  AGENCY_PENSION_FIRST_RATE,
  AGENCY_RETAIN_FLOOR,
  CLEARANCE_GRACE_YEARS,
  CLEARANCE_LEVELS,
  CLEARANCE_LOSS_ON_DISASTER,
  CLEARANCE_LOSS_ON_MISTAKE,
  DENIAL_AFTER_REVOCATION,
  DENIAL_BASE,
  DENIAL_DISHONORABLE,
  DENIAL_GENERAL_DISCHARGE,
  DENIAL_MAX,
  DENIAL_MIN,
  GS_PAY_CAP,
  GS_STEP_ONE,
  INTEL_DEATH_ON_DISASTER,
  RETIRE_ELIGIBLE_YEARS,
  INVESTIGATION_DAYS,
  MISSION_CHANCE,
  MISSION_MIN_AGENCY_GRADE,
  MISSION_MIN_SERVICE_YEARS,
  MISSION_OUTCOMES,
  MISSION_PERFORMANCE,
  MISSION_REPUTATION,
  SKILL_CLEARANCE,
  SPECIALTIES,
  academyWashOutChance,
  agencyPensionFor,
  agencyRow,
  agencyTitle,
  agencyYearPay,
  clearanceCovers,
  clearanceForSkill,
  clearanceRank,
  denialChance,
  findAgency,
  hireChance,
  openSpecialtyOf,
  specialtiesOf,
  startingGrade,
} from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';

import { EMPTY_ACTING } from './acting-state';
import { advanceYear } from './advance';
import * as intelModule from './intel';
import * as dealPhase from './deals';
import { decide } from './decide';
import { hasSystemicOffer, type GameState } from './game-state';
import { EMPTY_MODELING } from './modeling-state';
import {
  clearanceHeld,
  clearanceMeets,
  investigate,
  withClearance,
  withoutClearance,
  worstDischarge,
} from './intel-clearance';
import {
  AGENCY_ERROR_LABELS,
  INTEL_MISSION_EVENT_ID,
  agencyBar,
  agencyOccupation,
  agencyPayOf,
  agencyPensionAt,
  answerIntelMission,
  applyToAgency,
  closeMissions,
  eligibleAgencies,
  intelligenceYears,
  isIntelMissionDecision,
  leaveIntelCareer,
  openMissions,
  professionalYears,
  runIntelYear,
  withIntelMission,
} from './intel';
import { EMPTY_INTEL, type AgencyCareer, type IntelState, type PastAgency } from './intel-state';
import { agencyPushesLeft, workHarderInAgency } from './intel-work';
import { runMilitaryYear } from './military';
import {
  EMPTY_MILITARY,
  type MilitaryState,
  type PastService,
  type ServiceCareer,
} from './military-state';
import { createNewGame } from './new-game';
import { ordinaryChoice } from './ordinary-answers';
import { pushesLeft, workHarder } from './careers';
import { withAnyOffer } from './offers';
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
function adult(seed: string, age = 30): GameState {
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

/**
 * A fit adult with a bachelor's degree, a few years of work behind them and nothing in the way: no service, no agency,
 * no clearance, no pending question and no other career. Thirty, so the FBI's age window is open.
 */
const eligible = (state: GameState): GameState => {
  const fit = withStats(state, { health: 80, smarts: 70, discipline: 70 });
  return {
    ...fit,
    education: {
      ...fit.education,
      enrollment: undefined,
      stage: 'graduated',
      credentials: {
        ...fit.education.credentials,
        highSchool: 18,
        university: 22,
        postgraduate: undefined,
      },
    } as never,
    employment: {
      ...fit.employment,
      job: undefined,
      history: [{ jobId: 'none.test', from: 23, to: 28, because: 'resigned' as const }],
      appliedTo: [],
    } as never,
    sports: { ...fit.sports, career: undefined, post: undefined } as never,
    health: { ...fit.health, conditions: [], deficit: 0 },
    pending: [],
    military: EMPTY_MILITARY,
    intel: EMPTY_INTEL,
  };
};

const base = eligible(adult('INTEL-BASE', 30));

const agentRow = (patch: Partial<AgencyCareer> = {}): AgencyCareer => ({
  agency: 'fbi',
  stage: 'serving',
  enteredAge: 27,
  grade: 11,
  gradeYears: 0,
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

const asAgent = (state: GameState, patch: Partial<AgencyCareer> = {}): GameState => ({
  ...state,
  intel: {
    ...state.intel,
    clearance: state.intel.clearance ?? { level: 'top-secret', grantedAge: 27 },
    career: agentRow(patch),
  },
});

const serviceRow = (patch: Partial<ServiceCareer> = {}): ServiceCareer => ({
  branch: 'army',
  stage: 'serving',
  enlistedAge: 19,
  track: 'enlisted',
  specialty: 'army.intelligence',
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
  specialty: 'army.intelligence',
  finalGrade: 5,
  reputation: 65,
  how: 'term',
  discharge: 'honorable',
  ...patch,
});

const cleared = (state: GameState, age = state.player.age): GameState => ({
  ...state,
  intel: { ...state.intel, clearance: { level: 'top-secret', grantedAge: age } },
});

const pastAgency = (patch: Partial<PastAgency> = {}): PastAgency => ({
  agency: 'fbi',
  enteredAge: 27,
  endedAge: 57,
  years: 30,
  finalGrade: 14,
  reputation: 70,
  how: 'retired',
  pension: 90_000,
  ...patch,
});

/** The first seed of a family whose `intel:` draw falls where the test says. */
function seedWhere(
  state: GameState,
  parts: readonly (string | number)[],
  test: (unit: number) => boolean,
): GameState {
  for (let i = 0; i < 20000; i += 1) {
    const candidate = withSeed(state, `intel-${parts.join('-')}-${i}`);
    const draw = mixedUnit(
      `intel:${candidate.rng.getSeed()}:${candidate.world.generation}:${parts.join(':')}`,
    );
    if (test(draw)) return candidate;
  }
  throw new Error('no seed found');
}

const runYear = (state: GameState, investigation?: ReturnType<typeof investigate>) =>
  runIntelYear({
    before: state,
    military: state.military,
    education: state.education,
    age: state.player.age + 1,
    year: state.world.year + 1,
    ...(investigation ? { investigation } : {}),
  });

const AGE = base.player.age;

/** A mission answered directly, as the minigame's result would be. */
const withMission = (
  state: GameState,
  source: 'military' | 'fbi' | 'cia',
  age = state.player.age,
): GameState => {
  const raised: GameState = { ...state, intel: { ...state.intel, mission: { source, age } } };
  return withIntelMission(raised, true);
};

/* -------------------------------------------------------------------------- */
/* The real figures                                                            */
/* -------------------------------------------------------------------------- */

describe('the real numbers', () => {
  it('has three levels of clearance and no compartments', () => {
    expect(CLEARANCE_LEVELS).toEqual(['confidential', 'secret', 'top-secret']);
    expect(clearanceRank('confidential')).toBe(1);
    expect(clearanceRank('top-secret')).toBe(3);
  });

  it('takes 243 days to clear somebody for Top Secret and 197 for Secret, and a Confidential is the Secret investigation', () => {
    expect(INVESTIGATION_DAYS['top-secret']).toBe(243);
    expect(INVESTIGATION_DAYS.secret).toBe(197);
    expect(INVESTIGATION_DAYS.confidential).toBe(INVESTIGATION_DAYS.secret);
  });

  it('keeps a clearance reinstatable for 24 months after the job that needed it', () => {
    expect(CLEARANCE_GRACE_YEARS).toBe(2);
  });

  it('pays the 2026 General Schedule, step 1, for Washington', () => {
    expect(GS_STEP_ONE).toEqual({
      9: 70_623,
      10: 77_771,
      11: 85_447,
      12: 102_415,
      13: 121_785,
      14: 143_913,
      15: 169_279,
    });
    expect(GS_PAY_CAP).toBe(197_200);
  });

  it('adds 25 percent availability pay to an FBI agent and none to the CIA', () => {
    expect(agencyRow('fbi').availability).toBe(0.25);
    expect(agencyRow('cia').availability).toBe(0);
    expect(agencyYearPay('fbi', 10, 0)).toBe(Math.round(77_771 * 1.25));
    expect(agencyYearPay('cia', 9, 0)).toBe(70_623);
  });

  it('raises pay about 3 percent a step over nine, and holds base pay to the federal cap', () => {
    expect(agencyYearPay('cia', 13, 9)).toBe(Math.round(121_785 * 1.27));
    expect(agencyYearPay('cia', 13, 30)).toBe(agencyYearPay('cia', 13, 9));
    expect(agencyYearPay('cia', 15, 9)).toBe(GS_PAY_CAP);
    expect(agencyYearPay('cia', 15, 9)).toBeLessThanOrEqual(GS_PAY_CAP);
    // the FBI's availability pay is on top of the capped base
    expect(agencyYearPay('fbi', 15, 9)).toBe(Math.round(GS_PAY_CAP * 1.25));
  });

  it('opens the FBI to somebody 23 to 36 with a bachelor’s degree and two years of experience, 19 weeks at Quantico', () => {
    const fbi = agencyRow('fbi');
    expect(fbi.minAge).toBe(23);
    expect(fbi.maxAge).toBe(36);
    expect(fbi.experienceYears).toBe(2);
    expect(fbi.trainingWeeks).toBe(19);
    expect(fbi.retireAge).toBe(57);
    expect(fbi.startGrade).toBe(10);
  });

  it('opens the CIA to somebody with a bachelor’s degree, entering near the bottom of the schedule', () => {
    const cia = agencyRow('cia');
    expect(cia.experienceYears).toBe(0);
    expect(cia.startGrade).toBe(9);
    // GS-9 through GS-12 is the entry range the real $70,685 to $107,590 spans.
    expect(agencyYearPay('cia', 9, 0)).toBeGreaterThanOrEqual(70_000);
    expect(agencyYearPay('cia', 12, 0)).toBeLessThanOrEqual(107_590 + 1_000);
  });

  it('pays a federal law-enforcement retirement: 1.7% a year for the first 20, 1% after, from 50', () => {
    expect(AGENCY_PENSION_FIRST_RATE).toBe(0.017);
    expect(AGENCY_PENSION_AFTER_RATE).toBe(0.01);
    expect(AGENCY_PENSION_AGE).toBe(50);
    const at = (years: number) =>
      agencyPensionFor({ how: 'retired', years, endedAge: 57, highThreeAverage: 100_000 });
    expect(at(20)).toBe(34_000);
    expect(at(25)).toBe(39_000);
    expect(at(19)).toBe(0);
    expect(
      agencyPensionFor({ how: 'retired', years: 30, endedAge: 49, highThreeAverage: 100_000 }),
    ).toBe(0);
    expect(
      agencyPensionFor({ how: 'resigned', years: 30, endedAge: 57, highThreeAverage: 100_000 }),
    ).toBe(0);
  });

  it('wants Top Secret for military intelligence, as the Army’s 35 series does', () => {
    expect(clearanceForSkill('intelligence')).toBe('top-secret');
    expect(AGENCY_CLEARANCE).toBe('top-secret');
    expect(SKILL_CLEARANCE['intelligence']).toBe('top-secret');
  });
});

/* -------------------------------------------------------------------------- */
/* The tables                                                                  */
/* -------------------------------------------------------------------------- */

describe('the agencies', () => {
  it('are the FBI and the CIA, each found by id, with a title for every grade', () => {
    expect(AGENCIES.map((row) => row.id)).toEqual(['fbi', 'cia']);
    expect(findAgency('fbi')?.short).toBe('FBI');
    expect(findAgency('nsa')).toBeUndefined();
    for (const row of AGENCIES) {
      for (let grade = 9; grade <= 15; grade += 1) {
        expect(agencyTitle(row.id, grade).length, `${row.id} ${grade}`).toBeGreaterThan(3);
      }
    }
    expect(agencyTitle('fbi', 15)).toBe('Assistant Special Agent in Charge');
    expect(agencyTitle('cia', 9)).toBe('Junior Case Officer');
    // out of range reads as the nearest rung
    expect(agencyTitle('fbi', 99)).toBe(agencyTitle('fbi', 15));
    expect(agencyTitle('fbi', 1)).toBe(agencyTitle('fbi', 9));
  });

  it('falls back to the FBI’s row for an id it doesn’t know', () => {
    expect(agencyRow('nowhere').id).toBe('fbi');
  });

  it('has an intelligence job in every branch, each wanting Smarts and Discipline and none opening the branch', () => {
    for (const row of SPECIALTIES.filter((s) => s.skill === 'intelligence')) {
      expect(row.id.endsWith('.intelligence')).toBe(true);
      expect(row.requires.smarts).toBeGreaterThanOrEqual(60);
      expect(row.requires.discipline).toBeGreaterThanOrEqual(55);
      expect(openSpecialtyOf(row.branch).id).not.toBe(row.id);
    }
    expect(SPECIALTIES.filter((s) => s.skill === 'intelligence')).toHaveLength(5);
    for (const branch of ['army', 'navy', 'marine-corps', 'air-force', 'coast-guard']) {
      expect(
        specialtiesOf(branch).some((s) => s.skill === 'intelligence'),
        branch,
      ).toBe(true);
    }
  });

  it('asks a clearance only of the kinds of work that handle protected material', () => {
    expect(clearanceForSkill('security')).toBe('secret');
    expect(clearanceForSkill('technical')).toBe('secret');
    expect(clearanceForSkill('logistics')).toBe('confidential');
    expect(clearanceForSkill('combat')).toBeUndefined();
    expect(clearanceForSkill('medical')).toBeUndefined();
  });

  it('starts a person with a clearance and real intelligence service a grade or two up, and nobody else', () => {
    expect(startingGrade('fbi', false, 0)).toBe(10);
    expect(startingGrade('fbi', true, 2)).toBe(10);
    expect(startingGrade('fbi', true, 3)).toBe(11);
    expect(startingGrade('cia', true, 3)).toBe(11);
    expect(startingGrade('cia', false, 8)).toBe(9);
  });
});

/* -------------------------------------------------------------------------- */
/* Clearance and its investigation                                             */
/* -------------------------------------------------------------------------- */

describe('the odds of a denial', () => {
  const clean = { discipline: 70, revokedBefore: false };

  it('are low for somebody with nothing against them, and higher the higher the level', () => {
    const chances = CLEARANCE_LEVELS.map((level) => denialChance({ level, ...clean }));
    expect(chances).toEqual([
      DENIAL_BASE.confidential,
      DENIAL_BASE.secret,
      DENIAL_BASE['top-secret'],
    ]);
    expect(chances[0]!).toBeLessThan(chances[1]!);
    expect(chances[1]!).toBeLessThan(chances[2]!);
    expect(chances[2]!).toBeLessThan(0.2);
  });

  it('rise with every point of Discipline under 50, and stop rising at the cap', () => {
    const at = (discipline: number) =>
      denialChance({ level: 'secret', discipline, revokedBefore: false });
    expect(at(50)).toBe(DENIAL_BASE.secret);
    expect(at(60)).toBe(DENIAL_BASE.secret);
    expect(at(40)).toBeGreaterThan(at(50));
    expect(at(20)).toBeGreaterThan(at(40));
    expect(at(40)).toBeCloseTo(DENIAL_BASE.secret + 0.08, 10);
    expect(at(0)).toBeCloseTo(DENIAL_BASE.secret + 0.3, 10);
    expect(at(10)).toBeCloseTo(DENIAL_BASE.secret + 0.3, 10);
  });

  it('add for a general discharge and for a clearance that was taken away before', () => {
    const plain = denialChance({ level: 'top-secret', ...clean });
    expect(denialChance({ level: 'top-secret', ...clean, worstDischarge: 'general' })).toBeCloseTo(
      plain + DENIAL_GENERAL_DISCHARGE,
      10,
    );
    expect(denialChance({ level: 'top-secret', discipline: 70, revokedBefore: true })).toBeCloseTo(
      plain + DENIAL_AFTER_REVOCATION,
      10,
    );
  });

  it('make a dishonorable discharge all but a certain denial, and never reach 0 or 1', () => {
    expect(denialChance({ level: 'confidential', ...clean, worstDischarge: 'dishonorable' })).toBe(
      DENIAL_DISHONORABLE,
    );
    expect(DENIAL_DISHONORABLE).toBeLessThan(1);
    const worst = denialChance({
      level: 'top-secret',
      discipline: 0,
      worstDischarge: 'general',
      revokedBefore: true,
    });
    expect(worst).toBe(DENIAL_MAX);
    expect(DENIAL_MIN).toBeGreaterThan(0);
  });
});

describe('clearance levels and the grace', () => {
  it('lets a higher clearance cover a lower job and not the reverse', () => {
    expect(clearanceCovers('top-secret', 'secret')).toBe(true);
    expect(clearanceCovers('secret', 'secret')).toBe(true);
    expect(clearanceCovers('confidential', 'secret')).toBe(false);
    expect(clearanceCovers('secret', 'top-secret')).toBe(false);
  });

  it('is held while the person has a job that needs it, and for two years after', () => {
    const idle: IntelState = {
      past: [],
      clearance: { level: 'top-secret', grantedAge: 20, idleSince: 30 },
    };
    expect(clearanceHeld(idle, 30)?.level).toBe('top-secret');
    expect(clearanceHeld(idle, 31)?.level).toBe('top-secret');
    expect(clearanceHeld(idle, 32)).toBeUndefined();
    expect(clearanceHeld(idle, 80)).toBeUndefined();
    expect(
      clearanceHeld({ past: [], clearance: { level: 'secret', grantedAge: 20 } }, 99)?.level,
    ).toBe('secret');
    expect(clearanceHeld(EMPTY_INTEL, 30)).toBeUndefined();
  });

  it('meets a job only when it is held, good and high enough', () => {
    const intel: IntelState = { past: [], clearance: { level: 'secret', grantedAge: 20 } };
    expect(clearanceMeets(intel, 30, 'confidential')).toBe(true);
    expect(clearanceMeets(intel, 30, 'secret')).toBe(true);
    expect(clearanceMeets(intel, 30, 'top-secret')).toBe(false);
    expect(clearanceMeets(EMPTY_INTEL, 30, 'confidential')).toBe(false);
  });

  it('keeps the higher clearance when a lower one is granted, and replaces a lower with a higher', () => {
    const top = withClearance(EMPTY_INTEL, 'top-secret', 25);
    expect(withClearance(top, 'secret', 30).clearance).toEqual({
      level: 'top-secret',
      grantedAge: 25,
    });
    const secret = withClearance(EMPTY_INTEL, 'secret', 25);
    expect(withClearance(secret, 'top-secret', 30).clearance).toEqual({
      level: 'top-secret',
      grantedAge: 30,
    });
  });

  it('replaces a lapsing clearance with a fresh one when the same level is granted again', () => {
    const idle: IntelState = {
      past: [],
      clearance: { level: 'top-secret', grantedAge: 20, idleSince: 29 },
    };
    expect(withClearance(idle, 'top-secret', 30).clearance).toEqual({
      level: 'top-secret',
      grantedAge: 30,
    });
  });

  it('is gone when taken away, and the age it was is kept against the person', () => {
    const taken = withoutClearance(withClearance(EMPTY_INTEL, 'top-secret', 25), 31);
    expect(taken.clearance).toBeUndefined();
    expect(taken.revokedAge).toBe(31);
  });
});

describe('the investigation', () => {
  const input = (state: GameState, patch: Record<string, unknown> = {}) => ({
    seed: state.rng.getSeed(),
    generation: state.world.generation,
    age: 30,
    level: 'top-secret' as const,
    discipline: 70,
    military: EMPTY_MILITARY,
    intel: EMPTY_INTEL,
    ...patch,
  });

  it('gives the same answer however often it is asked', () => {
    const a = investigate(input(base));
    const b = investigate(input(base));
    expect(b).toEqual(a);
  });

  it('turns on its draw against the chance: a draw under it denies, a draw over it grants', () => {
    const chance = DENIAL_BASE['top-secret'];
    const denied = seedWhere(
      base,
      ['clearance', 30, 'top-secret', 'investigation'],
      (u) => u < chance,
    );
    const granted = seedWhere(
      base,
      ['clearance', 30, 'top-secret', 'investigation'],
      (u) => u >= chance,
    );
    expect(investigate(input(denied)).granted).toBe(false);
    expect(investigate(input(granted)).granted).toBe(true);
  });

  it('says how many days it took, from the real figures, and fills every token', () => {
    const granted = seedWhere(
      base,
      ['clearance', 30, 'top-secret', 'investigation'],
      (u) => u >= 0.5,
    );
    const result = investigate(input(granted));
    expect(result.days).toBe(243);
    expect(result.line).toContain('243');
    expect(result.line).toContain('Top Secret');
    expect(result.line).not.toContain('%');
    const secret = investigate(input(granted, { level: 'secret' }));
    expect(secret.days).toBe(197);
    expect(secret.line).not.toContain('%');
  });

  it('denies a dishonorably discharged person nearly always, and weighs a past revocation', () => {
    const dishonorable: MilitaryState = {
      past: [pastRow({ discharge: 'dishonorable', how: 'misconduct' })],
    };
    expect(worstDischarge(dishonorable)).toBe('dishonorable');
    expect(worstDischarge({ past: [pastRow({ discharge: 'general' })] })).toBe('general');
    expect(worstDischarge({ past: [pastRow(), pastRow({ discharge: 'general' })] })).toBe(
      'general',
    );
    expect(
      worstDischarge({
        past: [pastRow({ discharge: 'general' }), pastRow({ discharge: 'dishonorable' })],
      }),
    ).toBe('dishonorable');
    expect(worstDischarge(EMPTY_MILITARY)).toBeUndefined();
    let denied = 0;
    for (let i = 0; i < 200; i += 1) {
      const seeded = withSeed(base, `dishonor-${i}`);
      if (!investigate(input(seeded, { military: dishonorable })).granted) denied += 1;
    }
    expect(denied).toBeGreaterThan(170);
    let revokedDenied = 0;
    for (let i = 0; i < 400; i += 1) {
      const seeded = withSeed(base, `revoked-${i}`);
      if (!investigate(input(seeded, { intel: { past: [], revokedAge: 28 } })).granted) {
        revokedDenied += 1;
      }
    }
    expect(revokedDenied / 400).toBeGreaterThan(0.4);
    expect(revokedDenied / 400).toBeLessThan(0.7);
  });
});

/* -------------------------------------------------------------------------- */
/* Military intelligence: the training year                                    */
/* -------------------------------------------------------------------------- */

describe('a recruit who is training for military intelligence', () => {
  const recruit = (state: GameState, specialty: string, patch: Partial<ServiceCareer> = {}) =>
    serving(
      {
        ...withStats(state, { health: 90, smarts: 90, discipline: 90 }),
        military: EMPTY_MILITARY,
      },
      { specialty, stage: 'training', years: 0, grade: 1, termEnds: 4, ...patch },
    );
  const trainYear = (state: GameState) =>
    runMilitaryYear({
      before: state,
      education: state.education,
      age: state.player.age + 1,
      year: state.world.year + 1,
    });
  // The washout draw for a very fit recruit is 4%, the investigation's draws are named below.
  const passes = (state: GameState, specialty: string, level: string, keyTail: string) =>
    seedWhere(state, ['clearance', state.player.age + 1, level, `training:${specialty}`], (u) =>
      keyTail === 'granted' ? u >= 0.5 : u < 0.01,
    );

  it('is investigated at the end of the training year and cleared Top Secret', () => {
    const state = recruit(base, 'army.intelligence');
    const seeded = passes(state, 'army.intelligence', 'top-secret', 'granted');
    const survives = seedWhereBoth(seeded);
    const year = trainYear(survives);
    expect(year.investigation?.granted).toBe(true);
    expect(year.investigation?.level).toBe('top-secret');
    expect(year.lines.some((l) => l.text.includes('243'))).toBe(true);
    expect(year.military.service?.specialty).toBe('army.intelligence');
    expect(year.military.service?.stage).toBe('serving');
  });

  it('is reclassified to the branch’s open job when the clearance is denied, and told so', () => {
    const state = recruit(base, 'army.intelligence');
    const seeded = passes(state, 'army.intelligence', 'top-secret', 'denied');
    const survives = seedWhereBoth(seeded);
    const year = trainYear(survives);
    expect(year.investigation?.granted).toBe(false);
    expect(year.military.service?.specialty).toBe(openSpecialtyOf('army').id);
    expect(year.military.service?.stage).toBe('serving');
    const text = year.lines.map((l) => l.text).join(' ');
    expect(text).toContain('Infantry');
    expect(text).not.toContain('%');
  });

  it('is not reclassified for a Secret that was denied, only left without the clearance', () => {
    const state = recruit(base, 'army.police');
    const seeded = passes(state, 'army.police', 'secret', 'denied');
    const survives = seedWhereBoth(seeded);
    const year = trainYear(survives);
    expect(year.investigation?.granted).toBe(false);
    expect(year.investigation?.level).toBe('secret');
    expect(year.military.service?.specialty).toBe('army.police');
  });

  it('is not investigated for a job that asks for nothing', () => {
    const state = recruit(base, 'army.infantry');
    const year = trainYear(seedWhereBoth(state));
    expect(year.investigation).toBeUndefined();
  });

  it('is not investigated again by somebody who already holds a clearance that covers the job', () => {
    const state = cleared(recruit(base, 'army.intelligence'));
    const year = trainYear(seedWhereBoth(state));
    expect(year.investigation).toBeUndefined();
    expect(year.military.service?.specialty).toBe('army.intelligence');
  });

  it('is investigated again for a Top Secret job when all it holds is a Secret', () => {
    const state = {
      ...recruit(base, 'army.intelligence'),
      intel: { past: [], clearance: { level: 'secret' as const, grantedAge: 20 } },
    };
    const year = trainYear(seedWhereBoth(state));
    expect(year.investigation?.level).toBe('top-secret');
  });

  it('is cleared at the level a year through the whole yearly advance, and the clearance is saved', () => {
    const state = recruit(base, 'army.intelligence');
    const seeded = seedWhereBoth(passes(state, 'army.intelligence', 'top-secret', 'granted'));
    const { state: after } = advanceYear(seeded);
    expect(after.intel.clearance?.level).toBe('top-secret');
    expect(after.intel.clearance?.grantedAge).toBe(seeded.player.age + 1);
    expect(after.intel.clearance?.idleSince).toBeUndefined();
    expect(after.military.service?.specialty).toBe('army.intelligence');
  });

  it('is recorded as denied, with no clearance, when the investigation fails', () => {
    const state = recruit(base, 'army.intelligence');
    const seeded = seedWhereBoth(passes(state, 'army.intelligence', 'top-secret', 'denied'));
    const { state: after } = advanceYear(seeded);
    expect(after.intel.clearance).toBeUndefined();
    expect(after.intel.deniedAge).toBe(seeded.player.age + 1);
    expect(after.military.service?.specialty).toBe('army.infantry');
  });
});

/** A seed whose basic-training draw passes, since a wash-out ends the year before any investigation. */
function seedWhereBoth(state: GameState): GameState {
  const key = (seed: string) =>
    mixedUnit(
      `service:${seed}:${state.world.generation}:basic:${state.military.service?.enlistedAge ?? 0}`,
    );
  if (key(state.rng.getSeed() as unknown as string) >= 0.2) return state;
  // find a nearby seed that keeps its investigation draws and passes training
  for (let i = 0; i < 20000; i += 1) {
    const candidate = withSeed(state, `${String(state.rng.getSeed())}~b${i}`);
    if (key(candidate.rng.getSeed() as unknown as string) >= 0.2) return candidate;
  }
  throw new Error('no seed passes training');
}

/* -------------------------------------------------------------------------- */
/* Holding a clearance, and losing it by leaving                               */
/* -------------------------------------------------------------------------- */

describe('a clearance after the job that needed it ends', () => {
  it('is still held, and starts its two years, the first year somebody has no job that needs it', () => {
    const state = cleared(withStats(base, {}), 27);
    const year = runYear(state);
    expect(year.intel.clearance?.idleSince).toBe(AGE + 1);
    expect(year.lines.some((l) => l.text.includes('two years'))).toBe(true);
    expect(clearanceHeld(year.intel, AGE + 2)?.level).toBe('top-secret');
  });

  it('lapses two years on, with a line, and is not counted as a revocation', () => {
    const idle: GameState = {
      ...base,
      intel: { past: [], clearance: { level: 'top-secret', grantedAge: 20, idleSince: AGE - 1 } },
    };
    const year = runYear(idle);
    expect(year.intel.clearance).toBeUndefined();
    expect(year.intel.revokedAge).toBeUndefined();
    expect(year.lines.some((l) => l.text.includes('lapsed'))).toBe(true);
    expect(year.lines.some((l) => l.text.includes('%'))).toBe(false);
  });

  it('stays good and its clock stops when the person is back in work that needs it', () => {
    const idle: GameState = asAgent({
      ...base,
      intel: { past: [], clearance: { level: 'top-secret', grantedAge: 20, idleSince: AGE - 1 } },
    });
    const year = runYear(idle);
    expect(year.intel.clearance?.idleSince).toBeUndefined();
    expect(year.intel.clearance?.level).toBe('top-secret');
  });

  it('is kept by a serving member of an intelligence specialty, with the clock never started', () => {
    const state = cleared(serving(base));
    const year = runYear(state);
    expect(year.intel.clearance?.idleSince).toBeUndefined();
  });

  it('starts its clock for a serving member whose job no longer needs it', () => {
    const state = cleared(serving(base, { specialty: 'army.infantry' }));
    const year = runYear(state);
    expect(year.intel.clearance?.idleSince).toBe(AGE + 1);
  });

  it('is nothing at all for somebody who never held one', () => {
    const year = runYear(base);
    expect(year.intel).toEqual(base.intel);
    expect(year.lines).toEqual([]);
    expect(year.pay).toBe(0);
    expect(year.pension).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Getting in                                                                  */
/* -------------------------------------------------------------------------- */

describe('the door to an agency', () => {
  it('is open to an adult with a degree, experience and nothing in the way', () => {
    expect(agencyBar(base, 'fbi')).toBeUndefined();
    expect(agencyBar(base, 'cia')).toBeUndefined();
    expect(eligibleAgencies(base)).toEqual(['fbi', 'cia']);
  });

  it('is shut to somebody in uniform and says to leave first', () => {
    const state = serving(base);
    expect(agencyBar(state, 'fbi')).toBe('serving');
    expect(AGENCY_ERROR_LABELS.serving).toContain('Leave the service first');
    expect(eligibleAgencies(state)).toEqual([]);
  });

  it('is shut to somebody who already works for an agency', () => {
    expect(agencyBar(asAgent(base), 'cia')).toBe('in-agency');
  });

  it('is shut to the FBI under 23 and over 36, and open to the CIA either side of that', () => {
    const young = withAge(base, 22);
    const old = withAge(base, 37);
    expect(agencyBar(young, 'fbi')).toBe('too-young');
    expect(agencyBar(young, 'cia')).toBeUndefined();
    expect(agencyBar(old, 'fbi')).toBe('too-old');
    expect(agencyBar(old, 'cia')).toBeUndefined();
    expect(agencyBar(withAge(base, 23), 'fbi')).toBeUndefined();
    expect(agencyBar(withAge(base, 36), 'fbi')).toBeUndefined();
    expect(agencyBar(withAge(base, 20), 'cia')).toBe('too-young');
    expect(agencyBar(withAge(base, 46), 'cia')).toBe('too-old');
  });

  it('is shut without a bachelor’s degree', () => {
    const noDegree: GameState = {
      ...base,
      education: {
        ...base.education,
        credentials: { ...base.education.credentials, university: undefined },
      } as never,
    };
    expect(agencyBar(noDegree, 'fbi')).toBe('no-degree');
    expect(agencyBar(noDegree, 'cia')).toBe('no-degree');
  });

  it('is shut to somebody still in school', () => {
    const student: GameState = {
      ...base,
      education: { ...base.education, stage: 'college', enrollment: { year: 1 } } as never,
    };
    expect(agencyBar(student, 'cia')).toBe('in-school');
  });

  it('wants two years of professional experience for the FBI, and counts service in uniform towards it', () => {
    const none: GameState = {
      ...base,
      employment: { ...base.employment, history: [] } as never,
    };
    expect(professionalYears(none)).toBe(0);
    expect(agencyBar(none, 'fbi')).toBe('no-experience');
    expect(agencyBar(none, 'cia')).toBeUndefined();
    const served: GameState = { ...none, military: { past: [pastRow({ years: 2 })] } };
    expect(professionalYears(served)).toBe(2);
    expect(agencyBar(served, 'fbi')).toBeUndefined();
    const oneYear: GameState = {
      ...none,
      military: { past: [pastRow({ years: 1 })] },
    };
    expect(agencyBar(oneYear, 'fbi')).toBe('no-experience');
    const agencyYears: GameState = {
      ...none,
      intel: { past: [pastAgency({ years: 3, how: 'resigned', pension: 0 })] },
    };
    expect(professionalYears(agencyYears)).toBe(3);
  });

  it('is shut to somebody who is unwell', () => {
    expect(agencyBar(withStats(base, { health: 49 }), 'fbi')).toBe('unfit');
    expect(agencyBar(withStats(base, { health: 50 }), 'fbi')).toBeUndefined();
  });

  it('is shut to somebody whose year another career holds', () => {
    // An actor with credits and a year behind them is a full-time career (0901's own fixture).
    const actor = {
      ...base,
      acting: { ...EMPTY_ACTING, tier: 'supporting', credits: 5, idle: 0 },
    } as never as GameState;
    expect(agencyBar(actor, 'fbi')).toBe('busy');
    expect(agencyBar(actor, 'cia')).toBe('busy');
    expect(eligibleAgencies(actor)).toEqual([]);
    expect(applyToAgency(actor, 'cia').ok).toBe(false);
  });
});

function withAge(state: GameState, age: number): GameState {
  return { ...state, player: { ...state.player, age } };
}

describe('applying', () => {
  it('has one application a year, and the second is turned away', () => {
    const first = applyToAgency(base, 'fbi');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = applyToAgency(first.value.state, 'cia');
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toBe('already-applied');
    const nextYear = applyToAgency(withAge(first.value.state, AGE + 1), 'cia');
    expect(nextYear.ok === false && nextYear.error === 'already-applied').toBe(false);
  });

  it('turns away an agency that doesn’t exist, and a question already waiting', () => {
    const none = applyToAgency(base, 'nsa');
    expect(none.ok === false && none.error).toBe('no-such-agency');
    const waiting: GameState = {
      ...base,
      pending: [
        {
          eventId: 'x',
          category: 'career',
          age: AGE,
          year: 2000,
          prompt: 'x',
          choices: [{ id: 'a', label: 'a' }],
          names: {},
        } as never,
      ],
    };
    const blocked = applyToAgency(waiting, 'fbi');
    expect(blocked.ok === false && blocked.error).toBe('offer-pending');
  });

  it('passes the bar’s own error through', () => {
    const blocked = applyToAgency(serving(base), 'fbi');
    expect(blocked.ok === false && blocked.error).toBe('serving');
    const young = applyToAgency(withAge(base, 21), 'fbi');
    expect(young.ok === false && young.error).toBe('too-young');
  });

  it('is rejected on a draw over the odds, and nothing but the year’s application is spent', () => {
    const chance = hireChance({
      agency: 'fbi',
      smarts: 70,
      discipline: 70,
      health: 80,
      intelYears: 0,
    });
    const seeded = seedWhere(base, ['hire', 'fbi', AGE], (u) => u >= chance);
    const result = applyToAgency(seeded, 'fbi');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.result).toBe('rejected');
    expect(result.value.state.intel.career).toBeUndefined();
    expect(result.value.state.intel.appliedAge).toBe(AGE);
    expect(result.value.state.intel.clearance).toBeUndefined();
    expect(result.value.entry.text).not.toContain('%');
    expect(result.value.state.player.timeline.at(-1)?.text).toBe(result.value.entry.text);
  });

  it('is denied after a conditional offer when the investigation fails, and says so', () => {
    const chance = hireChance({
      agency: 'fbi',
      smarts: 70,
      discipline: 70,
      health: 80,
      intelYears: 0,
    });
    const hired = seedWhere(base, ['hire', 'fbi', AGE], (u) => u < chance);
    const seeded = seedWhere(hired, ['hire', 'fbi', AGE], () => true);
    // The hire draw and the investigation draw are different keys, so look for both together.
    let found: GameState | undefined;
    for (let i = 0; i < 20000 && !found; i += 1) {
      const candidate = withSeed(base, `deny-${i}`);
      const hire = mixedUnit(
        `intel:${candidate.rng.getSeed()}:${candidate.world.generation}:hire:fbi:${AGE}`,
      );
      const inv = mixedUnit(
        `intel:${candidate.rng.getSeed()}:${candidate.world.generation}:clearance:${AGE}:top-secret:agency:fbi`,
      );
      if (hire < chance && inv < DENIAL_BASE['top-secret']) found = candidate;
    }
    void seeded;
    const result = applyToAgency(found!, 'fbi');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.result).toBe('denied');
    expect(result.value.state.intel.career).toBeUndefined();
    expect(result.value.state.intel.clearance).toBeUndefined();
    expect(result.value.state.intel.deniedAge).toBe(AGE);
    expect(result.value.state.intel.appliedAge).toBe(AGE);
    expect(result.value.entry.text).toContain('243');
    expect(result.value.entry.text).not.toContain('%');
  });

  it('hires, investigates, grants Top Secret and starts the academy year as a trainee', () => {
    const found = findHire(base, 'fbi', true);
    const result = applyToAgency(found, 'fbi');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.result).toBe('hired');
    const after = result.value.state;
    expect(after.intel.career).toMatchObject({
      agency: 'fbi',
      stage: 'training',
      enteredAge: AGE,
      grade: 10,
      years: 0,
      door: 'degree',
      poorYears: 0,
    });
    expect(after.intel.clearance).toMatchObject({ level: 'top-secret', grantedAge: AGE });
    expect(after.intel.appliedAge).toBe(AGE);
    expect(result.value.entry.text).toContain('Top Secret');
    expect(result.value.entry.text).not.toContain('%');
    expect(after.player.records.some((r) => r.label === 'Hired — FBI')).toBe(true);
    expect(agencyOccupation(after.intel)).toBe('Special Agent, FBI');
  });

  it('hires a person whose Top Secret is already good with no new investigation, and starts them a grade up if they served', () => {
    const state = cleared({ ...base, military: { past: [pastRow({ years: 5 })] } }, AGE - 3);
    const found = findHire(state, 'fbi', false);
    const result = applyToAgency(found, 'fbi');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.result).toBe('hired');
    const career = result.value.state.intel.career!;
    expect(career.door).toBe('service');
    expect(career.grade).toBe(11);
    expect(result.value.state.intel.clearance).toEqual({
      level: 'top-secret',
      grantedAge: AGE - 3,
    });
    expect(result.value.entry.text).toContain('clearance carried over');
    expect(intelligenceYears(state.military)).toBe(5);
  });

  it('counts a clearance that has lapsed as no clearance at all', () => {
    const lapsed: GameState = {
      ...base,
      military: { past: [pastRow({ years: 5 })] },
      intel: { past: [], clearance: { level: 'top-secret', grantedAge: 20, idleSince: AGE - 5 } },
    };
    const found = findHire(lapsed, 'fbi', true);
    const result = applyToAgency(found, 'fbi');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.result).toBe('hired');
    expect(result.value.state.intel.career?.door).toBe('degree');
    expect(result.value.state.intel.career?.grade).toBe(10);
  });

  it('puts the CIA’s hire at the bottom of the schedule and its academy at the Farm', () => {
    const found = findHire(base, 'cia', true);
    const result = applyToAgency(found, 'cia');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.intel.career?.grade).toBe(9);
    expect(result.value.entry.text).toContain('Farm');
    expect(agencyOccupation(result.value.state.intel)).toBe('Junior Case Officer, CIA');
  });

  it('resigns a held job as it hires', () => {
    const working: GameState = {
      ...base,
      employment: {
        ...base.employment,
        job: {
          jobId: 'none.test',
          since: AGE - 2,
          performance: 50,
          effort: 'normal',
          lastPay: 0,
          pushedThisYear: 0,
        },
      } as never,
    };
    const found = findHire(working, 'cia', true);
    const result = applyToAgency(found, 'cia');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.result).toBe('hired');
    expect(result.value.state.employment.job).toBeUndefined();
    expect(result.value.state.employment.history.at(-1)?.because).toBe('resigned');
  });

  it('is likelier for somebody with a clearance and intelligence years than for somebody without', () => {
    const plain = hireChance({
      agency: 'fbi',
      smarts: 70,
      discipline: 70,
      health: 80,
      intelYears: 0,
    });
    const held = hireChance({
      agency: 'fbi',
      smarts: 70,
      discipline: 70,
      health: 80,
      held: 'top-secret',
      intelYears: 4,
    });
    const secret = hireChance({
      agency: 'fbi',
      smarts: 70,
      discipline: 70,
      health: 80,
      held: 'secret',
      intelYears: 0,
    });
    expect(held).toBeGreaterThan(plain);
    expect(secret).toBeGreaterThan(plain);
    expect(secret).toBeLessThan(
      hireChance({
        agency: 'fbi',
        smarts: 70,
        discipline: 70,
        health: 80,
        held: 'top-secret',
        intelYears: 0,
      }),
    );
    // the bonus for years tops out
    expect(
      hireChance({ agency: 'fbi', smarts: 70, discipline: 70, health: 80, intelYears: 9 }),
    ).toBeCloseTo(
      hireChance({ agency: 'fbi', smarts: 70, discipline: 70, health: 80, intelYears: 5 }),
      10,
    );
  });

  it('is likelier for the fit, never certain and never hopeless, and harder at the CIA than at the FBI', () => {
    const weak = hireChance({ agency: 'cia', smarts: 0, discipline: 0, health: 0, intelYears: 0 });
    const strong = hireChance({
      agency: 'cia',
      smarts: 100,
      discipline: 100,
      health: 100,
      held: 'top-secret',
      intelYears: 9,
    });
    expect(weak).toBe(0.03);
    expect(strong).toBe(0.85);
    const mid = { smarts: 60, discipline: 60, health: 60, intelYears: 0 };
    expect(hireChance({ agency: 'cia', ...mid })).toBeLessThan(
      hireChance({ agency: 'fbi', ...mid }),
    );
  });

  it('washes out of the academy more often for a poor fit, and never certainly and never never', () => {
    expect(academyWashOutChance(60)).toBeCloseTo(0.09, 10);
    expect(academyWashOutChance(100)).toBe(0.03);
    expect(academyWashOutChance(0)).toBe(0.3);
    expect(academyWashOutChance(30)).toBeGreaterThan(academyWashOutChance(60));
  });
});

/** A seed where the FBI or CIA hires, and (if asked) the investigation then grants. */
function findHire(state: GameState, agency: 'fbi' | 'cia', investigated: boolean): GameState {
  const age = state.player.age;
  const held = clearanceHeld(state.intel, age);
  const chance = hireChance({
    agency,
    smarts: state.player.stats.smarts,
    discipline: state.player.stats.discipline,
    health: state.player.stats.health,
    ...(held ? { held: held.level } : {}),
    intelYears: intelligenceYears(state.military),
  });
  for (let i = 0; i < 20000; i += 1) {
    const candidate = withSeed(state, `hire-${agency}-${i}`);
    const prefix = `intel:${candidate.rng.getSeed()}:${candidate.world.generation}`;
    const hire = mixedUnit(`${prefix}:hire:${agency}:${age}`);
    if (hire >= chance) continue;
    if (!investigated) return candidate;
    const inv = mixedUnit(`${prefix}:clearance:${age}:top-secret:agency:${agency}`);
    if (inv >= 0.5) return candidate;
  }
  throw new Error('no seed hires');
}

/* -------------------------------------------------------------------------- */
/* An agency career                                                            */
/* -------------------------------------------------------------------------- */

describe('a year at an agency', () => {
  const agent = (patch: Partial<AgencyCareer> = {}, state: GameState = base) =>
    asAgent(state, patch);

  it('pays the grade and the years, and moves the career a year on', () => {
    const year = runYear(agent({ grade: 12, years: 4, gradeYears: 0 }));
    expect(year.pay).toBe(agencyYearPay('fbi', 12, 4));
    expect(year.left).toBe(false);
    expect(year.intel.career?.years).toBe(5);
    expect(year.intel.career?.lastPay).toBe(agencyYearPay('fbi', 12, 4));
    expect(year.intel.career?.highPay).toEqual([agencyYearPay('fbi', 12, 4)]);
    expect(year.lines).toHaveLength(1);
    expect(year.lines[0]!.kind).toBe('passive');
    expect(year.lines[0]!.text).not.toContain('%');
  });

  it('keeps only the last three years of pay for the pension', () => {
    const year = runYear(agent({ highPay: [3, 2, 1] }));
    expect(year.intel.career?.highPay).toHaveLength(3);
    expect(year.intel.career?.highPay[0]).toBe(year.pay);
    expect(year.intel.career?.highPay.slice(1)).toEqual([3, 2]);
  });

  it('reads the agency’s pay for a screen as the year to come’s', () => {
    expect(agencyPayOf(agentRow({ agency: 'cia', grade: 13, years: 9 }))).toBe(
      agencyYearPay('cia', 13, 9),
    );
  });

  it('puts the academy first: a trainee finishes, is paid at the grade they came in at, and gains discipline', () => {
    const chance = academyWashOutChance(
      base.player.stats.discipline * 0.5 +
        base.player.stats.health * 0.35 +
        base.player.stats.smarts * 0.15,
    );
    const seeded = seedWhere(base, ['academy', 'fbi', 27], (u) => u >= chance);
    const year = runYear(
      asAgent(seeded, { stage: 'training', years: 0, grade: 10, enteredAge: 27 }),
    );
    expect(year.left).toBe(false);
    expect(year.intel.career?.stage).toBe('serving');
    expect(year.pay).toBe(agencyYearPay('fbi', 10, 0));
    expect(year.statDeltas).toEqual({ discipline: 2, health: 1, smarts: 1 });
    expect(year.lines[0]!.kind).toBe('milestone');
    expect(year.lines[0]!.text).toContain('19 weeks');
    expect(year.lines[0]!.text).not.toContain('%');
    // a trainee isn't promoted in the year they train
    expect(year.intel.career?.grade).toBe(10);
  });

  it('washes a trainee out of the academy on a draw under the odds, with the clearance kept and a half year’s pay', () => {
    const chance = academyWashOutChance(
      base.player.stats.discipline * 0.5 +
        base.player.stats.health * 0.35 +
        base.player.stats.smarts * 0.15,
    );
    const seeded = seedWhere(base, ['academy', 'fbi', 27], (u) => u < chance);
    const year = runYear(
      asAgent(seeded, { stage: 'training', years: 0, grade: 10, enteredAge: 27 }),
    );
    expect(year.left).toBe(true);
    expect(year.intel.career).toBeUndefined();
    expect(year.intel.past).toHaveLength(1);
    expect(year.intel.past[0]).toMatchObject({
      agency: 'fbi',
      how: 'washed-out',
      years: 0,
      pension: 0,
    });
    expect(year.pay).toBe(Math.round(agencyYearPay('fbi', 10, 0) / 2));
    expect(year.mood).toBe(-6);
    expect(year.records.map((r) => r.label)).toEqual(['Did not finish — FBI training']);
    // the clearance was granted before the academy and stays, now with its two years running
    expect(year.intel.clearance?.level).toBe('top-secret');
    expect(year.intel.clearance?.idleSince).toBe(AGE + 1);
  });

  it('promotes on a draw under the scaled chance once the years in grade are in, and not otherwise', () => {
    const rises = seedWhere(base, ['rise', 'fbi', AGE + 1, 12], (u) => u < 0.05);
    const up = runYear(asAgent(rises, { grade: 11, gradeYears: 1 }));
    expect(up.intel.career?.grade).toBe(12);
    expect(up.intel.career?.gradeYears).toBe(0);
    expect(up.lines[0]!.kind).toBe('milestone');
    expect(up.lines[0]!.text).toContain('Special Agent');
    expect(up.lines[0]!.text).toContain('12');
    expect(up.lines[0]!.text).not.toContain('%');
    expect(up.mood).toBe(2);
    const stays = seedWhere(base, ['rise', 'fbi', AGE + 1, 12], (u) => u >= 0.96);
    const flat = runYear(asAgent(stays, { grade: 11, gradeYears: 1 }));
    expect(flat.intel.career?.grade).toBe(11);
    expect(flat.intel.career?.gradeYears).toBe(2);
    // under the years in grade, no draw can promote
    const early = runYear(
      asAgent(
        seedWhere(base, ['rise', 'fbi', AGE + 1, 14], (u) => u < 0.01),
        {
          grade: 13,
          gradeYears: 1,
        },
      ),
    );
    expect(early.intel.career?.grade).toBe(13);
    // the top has nowhere to go
    const top = runYear(asAgent(base, { grade: 15, gradeYears: 20 }));
    expect(top.intel.career?.grade).toBe(15);
  });

  it('files the rise to a senior grade in the life record, and a junior one not', () => {
    const to13 = runYear(
      asAgent(
        seedWhere(base, ['rise', 'fbi', AGE + 1, 13], (u) => u < 0.05),
        {
          grade: 12,
          gradeYears: 3,
        },
      ),
    );
    expect(to13.intel.career?.grade).toBe(13);
    expect(to13.records.map((r) => r.label)).toEqual(['Promoted — Special Agent, FBI']);
    const to12 = runYear(
      asAgent(
        seedWhere(base, ['rise', 'fbi', AGE + 1, 12], (u) => u < 0.05),
        {
          grade: 11,
          gradeYears: 3,
        },
      ),
    );
    expect(to12.intel.career?.grade).toBe(12);
    expect(to12.records).toEqual([]);
  });

  it('lets a person go after two poor years running, and not after one', () => {
    const weak = withStats(base, { discipline: 0, smarts: 0, health: 0 });
    const one = runYear(asAgent(weak, { performance: 5, poorYears: 0 }));
    expect(one.intel.career?.performance).toBeLessThan(AGENCY_RETAIN_FLOOR);
    expect(one.intel.career?.poorYears).toBe(1);
    expect(one.left).toBe(false);
    const two = runYear(asAgent(weak, { performance: 5, poorYears: 1 }));
    expect(two.left).toBe(true);
    expect(two.intel.career).toBeUndefined();
    expect(two.intel.past[0]).toMatchObject({ how: 'let-go', pension: 0 });
    const letGo = two.lines.find((l) => l.text.includes('FBI'))!;
    expect(letGo.kind).toBe('milestone');
    expect(letGo.text).not.toContain('%');
    expect(two.records.at(-1)!.label).toMatch(/^Let go by FBI/);
    expect(two.mood).toBeLessThan(0);
    // a good year in between starts the count again
    const strong = withStats(base, { discipline: 95, smarts: 95, health: 95 });
    const recovered = runYear(asAgent(strong, { performance: 90, poorYears: 1 }));
    expect(recovered.intel.career?.poorYears).toBe(0);
    expect(recovered.left).toBe(false);
  });

  it('doesn’t count a trainee’s year against them', () => {
    const weak = withStats(base, { discipline: 40, smarts: 40, health: 70 });
    const seeded = seedWhere(weak, ['academy', 'fbi', 27], (u) => u >= 0.5);
    const year = runYear(
      asAgent(seeded, { stage: 'training', years: 0, grade: 10, performance: 5, poorYears: 1 }),
    );
    expect(year.intel.career?.poorYears).toBe(0);
  });

  it('sends an FBI agent home at 57, retired, with a pension if the years are in', () => {
    const state = withAge(
      asAgent(base, { years: 30, grade: 14, highPay: [190_000, 185_000, 180_000], enteredAge: 27 }),
      56,
    );
    const year = runYear(state);
    expect(year.left).toBe(true);
    expect(year.intel.career).toBeUndefined();
    const past = year.intel.past[0]!;
    expect(past).toMatchObject({ how: 'retired', endedAge: 57, years: 31, finalGrade: 14 });
    const average = (agencyYearPay('fbi', 14, 30) + 190_000 + 185_000) / 3;
    expect(past.pension).toBe(
      agencyPensionFor({ how: 'retired', years: 31, endedAge: 57, highThreeAverage: average }),
    );
    expect(past.pension).toBeGreaterThan(50_000);
    const goodbye = year.lines.find((l) => l.text.includes('FBI'))!;
    expect(goodbye.kind).toBe('milestone');
    expect(year.lines.some((l) => l.text.includes('%'))).toBe(false);
    expect(year.records.at(-1)!.label).toMatch(/^Retired from FBI/);
    const before = runYear(withAge(state, 55));
    expect(before.left).toBe(false);
  });

  it('sends a CIA officer home at the game’s 65, and not before', () => {
    const officer = (age: number) =>
      runYear(
        withAge(
          asAgent(base, {
            agency: 'cia',
            years: 38,
            grade: 14,
            enteredAge: 26,
            highPay: [150_000],
          }),
          age,
        ),
      );
    expect(officer(63).left).toBe(false);
    const done = officer(64);
    expect(done.left).toBe(true);
    expect(done.intel.past[0]).toMatchObject({ agency: 'cia', how: 'retired', endedAge: 65 });
    expect(done.intel.past[0]!.pension).toBeGreaterThan(0);
  });

  it('pays no pension to somebody retired under the years or under fifty, or who left on their own', () => {
    const short = runYear(withAge(asAgent(base, { years: 12, grade: 12, highPay: [100_000] }), 56));
    expect(short.left).toBe(true);
    expect(short.intel.past[0]!.pension).toBe(0);
  });

  it('pays retired pay the year after it began, announces it once, and goes on paying', () => {
    const retired: GameState = {
      ...base,
      intel: { past: [pastAgency({ endedAge: AGE, pension: 88_000 })] },
    };
    expect(agencyPensionAt(retired.intel, AGE)).toBe(0);
    const first = runYear(retired);
    expect(first.pension).toBe(88_000);
    expect(first.lines.some((l) => l.text.includes('88000'))).toBe(true);
    expect(first.lines.some((l) => l.text.includes('%'))).toBe(false);
    const later = runYear({ ...retired, player: { ...retired.player, age: AGE + 3 } });
    expect(later.pension).toBe(88_000);
    expect(later.lines.some((l) => l.text.includes('88000'))).toBe(false);
    expect(
      agencyPensionAt(
        {
          past: [
            pastAgency({ endedAge: 50, pension: 10 }),
            pastAgency({ endedAge: 56, pension: 5 }),
          ],
        },
        60,
      ),
    ).toBe(15);
  });
});

describe('leaving an agency', () => {
  it('is a no-op error for somebody who has no agency career', () => {
    const result = leaveIntelCareer(base);
    expect(result.ok).toBe(false);
  });

  it('resigns somebody with few years, with no pension, and drops a mission standing', () => {
    const state = withMission(asAgent(base, { years: 4, highPay: [100_000] }), 'fbi');
    expect(state.pending.some((p) => p.eventId === INTEL_MISSION_EVENT_ID)).toBe(true);
    const result = leaveIntelCareer(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state;
    expect(after.intel.career).toBeUndefined();
    expect(after.intel.mission).toBeUndefined();
    expect(after.intel.past[0]).toMatchObject({ how: 'resigned', years: 4, pension: 0 });
    expect(after.pending.some((p) => p.eventId === INTEL_MISSION_EVENT_ID)).toBe(false);
    expect(result.value.entry.text).toMatch(/resigned|left/);
    expect(result.value.entry.text).not.toContain('%');
    expect(after.player.records.at(-1)!.label).toMatch(/^Left FBI/);
    // the clearance outlasts the job
    expect(after.intel.clearance?.level).toBe('top-secret');
  });

  it('retires somebody with twenty years at fifty or over, with the pension', () => {
    const state = withAge(
      asAgent(base, { years: 22, grade: 13, highPay: [140_000, 138_000, 136_000] }),
      52,
    );
    const result = leaveIntelCareer(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const past = result.value.state.intel.past[0]!;
    expect(past.how).toBe('retired');
    expect(past.pension).toBe(
      agencyPensionFor({ how: 'retired', years: 22, endedAge: 52, highThreeAverage: 138_000 }),
    );
    expect(result.value.entry.text).toContain('retired');
  });

  it('resigns somebody with the years but under fifty', () => {
    const state = withAge(asAgent(base, { years: 22, grade: 13, highPay: [140_000] }), 49);
    const result = leaveIntelCareer(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.intel.past[0]).toMatchObject({ how: 'resigned', pension: 0 });
  });
});

describe('Work Harder at an agency', () => {
  it('moves the year’s performance and makes the person hard-working, two presses a year', () => {
    const state = asAgent(base, { performance: 50 });
    expect(pushesLeft(state)).toBe(2);
    expect(agencyPushesLeft(state)).toBe(2);
    let current = state;
    let changed = false;
    for (let i = 0; i < 400 && !changed; i += 1) {
      const trial = withSeed(state, `push-${i}`);
      const pressed = workHarder(trial);
      expect(pressed.ok).toBe(true);
      if (!pressed.ok) return;
      expect(pressed.value.spent).toBe(false);
      const career = pressed.value.state.intel.career!;
      expect(career.effort).toBe('hard');
      expect(career.pushedThisYear).toBe(1);
      expect(career.pushedAtAge).toBe(AGE);
      if (career.performance > 50) {
        changed = true;
        current = pressed.value.state;
      }
    }
    expect(changed).toBe(true);
    expect(pushesLeft(current)).toBe(1);
    const second = workHarderInAgency(current);
    expect(second.ok && second.value.spent).toBe(false);
    if (!second.ok) return;
    expect(pushesLeft(second.value.state)).toBe(0);
    const third = workHarder(second.value.state);
    expect(third.ok && third.value.spent).toBe(true);
    if (!third.ok) return;
    expect(third.value.state).toBe(second.value.state);
    expect(third.value.entry).toBeUndefined();
  });

  it('starts the count again the next year', () => {
    const pushed = workHarderInAgency(asAgent(base, { pushedAtAge: AGE - 1, pushedThisYear: 2 }));
    expect(pushed.ok && pushed.value.spent).toBe(false);
  });

  it('is an error for somebody with no job and no agency, as it always was', () => {
    const none = workHarderInAgency(base);
    expect(none.ok).toBe(false);
    expect(agencyPushesLeft(base)).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Missions                                                                    */
/* -------------------------------------------------------------------------- */

describe('the mission gate', () => {
  it('is closed in every life, and no mission is ever raised while it is', () => {
    const agent = asAgent(base, { grade: 12 });
    expect(agent.intel.missionsOpen).toBeUndefined();
    for (let i = 0; i < 300; i += 1) {
      expect(runYear(withSeed(agent, `closed-${i}`)).intel.mission).toBeUndefined();
    }
    for (let i = 0; i < 300; i += 1) {
      const soldier = cleared(serving(withSeed(base, `closed-m-${i}`)));
      expect(runYear(soldier).intel.mission).toBeUndefined();
    }
  });

  it('is opened and closed by a flag the minigame will turn, and nothing else touches it', () => {
    const open = openMissions(base);
    expect(open.intel.missionsOpen).toBe(true);
    expect(closeMissions(open).intel.missionsOpen).toBeUndefined();
    expect(closeMissions(open).intel).toEqual(base.intel);
    expect(openMissions(open)).toEqual(open);
  });

  it('is never opened by a year, a hire, a clearance or a mission answered', () => {
    const hired = applyToAgency(findHire(base, 'fbi', true), 'fbi');
    expect(hired.ok && hired.value.state.intel.missionsOpen).toBeFalsy();
    const aged = advanceYear(asAgent(base, { grade: 12 })).state;
    expect(aged.intel.missionsOpen).toBeUndefined();
  });
});

describe('a mission being raised', () => {
  const open = (state: GameState) => openMissions(state);

  it('comes to an agent of grade 10 or over, on a draw under the source’s chance', () => {
    const chance = MISSION_CHANCE.fbi;
    const yes = seedWhere(base, ['mission', AGE + 1], (u) => u < chance);
    const no = seedWhere(base, ['mission', AGE + 1], (u) => u >= chance);
    const raised = runYear(open(asAgent(yes, { grade: 12 })));
    expect(raised.intel.mission).toEqual({ source: 'fbi', age: AGE + 1 });
    expect(runYear(open(asAgent(no, { grade: 12 }))).intel.mission).toBeUndefined();
  });

  it('uses the CIA’s own chance for the CIA, and the service’s for military intelligence', () => {
    const between = seedWhere(base, ['mission', AGE + 1], (u) => u >= 0.25 && u < 0.3);
    expect(runYear(open(serving(cleared(between)))).intel.mission).toBeUndefined();
    expect(runYear(open(asAgent(between, { grade: 12 }))).intel.mission?.source).toBe('fbi');
    const high = seedWhere(base, ['mission', AGE + 1], (u) => u >= 0.3 && u < 0.35);
    expect(runYear(open(asAgent(high, { agency: 'cia', grade: 12 }))).intel.mission?.source).toBe(
      'cia',
    );
    expect(
      runYear(open(asAgent(high, { agency: 'fbi', grade: 12 }))).intel.mission,
    ).toBeUndefined();
    const low = seedWhere(base, ['mission', AGE + 1], (u) => u < 0.25);
    expect(runYear(open(cleared(serving(low)))).intel.mission).toEqual({
      source: 'military',
      age: AGE + 1,
    });
  });

  it('doesn’t come to a trainee, to a junior agent, or to a member who isn’t doing intelligence work', () => {
    const always = seedWhere(base, ['mission', AGE + 1], (u) => u < 0.01);
    expect(
      runYear(open(asAgent(always, { stage: 'training', grade: 10 }))).intel.mission,
    ).toBeUndefined();
    expect(runYear(open(asAgent(always, { grade: 9 }))).intel.mission).toBeUndefined();
    expect(
      runYear(open(cleared(serving(always, { specialty: 'army.infantry' })))).intel.mission,
    ).toBeUndefined();
    expect(runYear(open(cleared(serving(always, { years: 0 })))).intel.mission).toBeUndefined();
    expect(
      runYear(open(cleared(serving(always, { stage: 'training' })))).intel.mission,
    ).toBeUndefined();
    expect(runYear(open(serving(always))).intel.mission).toBeUndefined();
    expect(runYear(open(cleared(always))).intel.mission).toBeUndefined();
    // and one who is deployed is on the deployment
    const deployed = {
      ...cleared(serving(always)),
      military: {
        ...serving(always).military,
        deployment: {
          status: 'active' as const,
          theater: 'x',
          months: 6,
          tier: 'rear' as const,
          incidents: 1,
          results: [],
          orderedAge: AGE,
        },
      },
    };
    expect(runYear(open(deployed)).intel.mission).toBeUndefined();
  });

  it('doesn’t come to somebody whose clearance has lapsed', () => {
    const always = seedWhere(base, ['mission', AGE + 1], (u) => u < 0.01);
    const lapsed: GameState = {
      ...serving(always),
      intel: { past: [], clearance: { level: 'top-secret', grantedAge: 20, idleSince: AGE - 5 } },
    };
    expect(runYear(open(lapsed)).intel.mission).toBeUndefined();
  });

  it('doesn’t come while a mission already stands, or another question does', () => {
    const always = seedWhere(base, ['mission', AGE + 1], (u) => u < 0.01);
    const standing = open(
      asAgent(
        { ...always, intel: { past: [], mission: { source: 'fbi', age: AGE } } },
        { grade: 12 },
      ),
    );
    expect(runYear(standing).intel.mission).toEqual({ source: 'fbi', age: AGE });
    const asked: GameState = {
      ...open(asAgent(always, { grade: 12 })),
      pending: [
        {
          eventId: 'x',
          category: 'career',
          age: AGE,
          year: 2000,
          prompt: 'x',
          choices: [{ id: 'a', label: 'a' }],
          names: {},
        } as never,
      ],
    };
    expect(runYear(asked).intel.mission).toBeUndefined();
  });

  it('is a question the next advance puts on the table, once', () => {
    const always = seedWhere(base, ['mission', AGE + 1], (u) => u < 0.01);
    const out = advanceYear(open(asAgent(always, { grade: 12 }))).state;
    expect(out.intel.mission).toEqual({ source: 'fbi', age: AGE + 1 });
    const asked = out.pending.filter((p) => p.eventId === INTEL_MISSION_EVENT_ID);
    expect(asked).toHaveLength(1);
    expect(asked[0]!.choices.map((c) => c.id)).toEqual([...MISSION_OUTCOMES]);
    expect(isIntelMissionDecision(asked[0]!.eventId)).toBe(true);
    expect(isIntelMissionDecision('military.mission')).toBe(false);
    expect(asked[0]!.prompt).not.toContain('%');
    expect(asked[0]!.prompt.length).toBeGreaterThan(20);
    // a second pass doesn't add another
    expect(withIntelMission(out, true).pending).toEqual(out.pending);
    // the year doesn't run while it waits
    expect(advanceYear(out).state).toBe(out);
    // a dead person isn't asked
    expect(withIntelMission({ ...out, pending: [] }, false).pending).toEqual([]);
    // nobody with no mission is asked
    expect(withIntelMission(base, true)).toBe(base);
  });
});

describe('answering a mission', () => {
  const standing = (state: GameState, source: 'military' | 'fbi' | 'cia' = 'fbi') =>
    withMission(
      source === 'military'
        ? cleared(serving(state, { years: 4 }))
        : asAgent(state, { agency: source, grade: 12, years: 5, performance: 60, reputation: 60 }),
      source,
    );
  const answer = (state: GameState, outcome: string) => {
    const result = decide(state, INTEL_MISSION_EVENT_ID, outcome);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('no answer');
    return result.value.state;
  };
  /** A seed whose draws for this mission sit where the test says. */
  const drawn = (
    state: GameState,
    source: string,
    wants: { readonly death?: (u: number) => boolean; readonly clearance?: (u: number) => boolean },
  ): GameState => {
    for (let i = 0; i < 40000; i += 1) {
      const candidate = withSeed(state, `ans-${source}-${i}`);
      const prefix = `intel:${candidate.rng.getSeed()}:${candidate.world.generation}:mission:${AGE}:${source}`;
      if (wants.death && !wants.death(mixedUnit(`${prefix}:death`))) continue;
      if (wants.clearance && !wants.clearance(mixedUnit(`${prefix}:clearance`))) continue;
      return candidate;
    }
    throw new Error('no seed');
  };

  it('goes through decide as the reserved event, and a wrong answer is turned away', () => {
    const state = standing(base);
    expect(decide(state, INTEL_MISSION_EVENT_ID, 'nonsense').ok).toBe(false);
    expect(answerIntelMission(state, 'nonsense').ok).toBe(false);
    expect(
      answerIntelMission(base, 'clean').ok === false && !answerIntelMission(base, 'clean').ok,
    ).toBe(true);
    const after = answer(state, 'clean');
    expect(after.pending.some((p) => p.eventId === INTEL_MISSION_EVENT_ID)).toBe(false);
    expect(after.intel.mission).toBeUndefined();
    expect(after.intel.missions).toEqual([{ age: AGE, source: 'fbi', outcome: 'clean' }]);
  });

  it('is a question that keeps every other door shut while it waits', () => {
    const state = standing(base);
    expect(state.pending.some((p) => p.eventId === INTEL_MISSION_EVENT_ID)).toBe(true);
  });

  it('costs nothing and helps the standing when it comes out clean', () => {
    const state = standing(base);
    const after = answer(state, 'clean');
    expect(after.intel.clearance).toEqual(state.intel.clearance);
    expect(after.intel.career?.reputation).toBe(60 + MISSION_REPUTATION.clean);
    expect(after.intel.career?.performance).toBe(60 + MISSION_PERFORMANCE.clean);
    expect(after.player.alive).toBe(true);
    expect(after.player.timeline.at(-1)!.kind).toBe('passive');
    expect(after.player.timeline.at(-1)!.text).not.toContain('%');
    expect(after.player.stats.happiness).toBeGreaterThanOrEqual(state.player.stats.happiness);
  });

  it('costs some stress and nothing else when it was close', () => {
    const state = standing(base);
    const after = answer(state, 'close');
    expect(after.intel.clearance).toEqual(state.intel.clearance);
    expect(after.intel.career).toBeDefined();
    expect(after.player.alive).toBe(true);
    expect(after.intel.career?.reputation).toBe(60 + MISSION_REPUTATION.close);
    expect(after.player.stress.level).toBeGreaterThan(state.player.stress.level);
  });

  it('never costs the clearance or a life after a clean or a close one, across many seeds', () => {
    for (const outcome of ['clean', 'close']) {
      for (let i = 0; i < 400; i += 1) {
        for (const source of ['fbi', 'cia', 'military'] as const) {
          const after = answer(
            standing(withSeed(base, `${outcome}-${source}-${i}`), source),
            outcome,
          );
          expect(after.player.alive).toBe(true);
          expect(after.intel.clearance?.level).toBe('top-secret');
          expect(after.intel.revokedAge).toBeUndefined();
          if (source === 'military')
            expect(after.military.service?.specialty).toBe('army.intelligence');
          else expect(after.intel.career).toBeDefined();
        }
      }
    }
  });

  it('may take the clearance after a mistake, and the job with it for an agent', () => {
    const lost = drawn(base, 'fbi', {
      clearance: (u) => u < CLEARANCE_LOSS_ON_MISTAKE,
      death: () => true,
    });
    const state = standing(lost);
    const after = answer(state, 'mistake');
    expect(after.intel.clearance).toBeUndefined();
    expect(after.intel.revokedAge).toBe(AGE);
    expect(after.intel.career).toBeUndefined();
    expect(after.intel.past.at(-1)).toMatchObject({
      agency: 'fbi',
      how: 'clearance-lost',
      years: 5,
    });
    expect(after.player.alive).toBe(true);
    expect(after.player.records.map((r) => r.label)).toEqual(
      expect.arrayContaining(['Lost a security clearance', 'Separated from FBI — Special Agent']),
    );
    expect(after.player.timeline.at(-1)!.kind).toBe('milestone');
    expect(after.player.timeline.at(-1)!.text).toContain('clearance');
    expect(after.player.timeline.at(-1)!.text).not.toContain('%');
  });

  it('lets an agent keep the clearance after a mistake, with the standing worse for it', () => {
    const kept = drawn(base, 'fbi', { clearance: (u) => u >= CLEARANCE_LOSS_ON_MISTAKE });
    const state = standing(kept);
    const after = answer(state, 'mistake');
    expect(after.intel.clearance).toEqual(state.intel.clearance);
    expect(after.intel.career?.reputation).toBe(60 + MISSION_REPUTATION.mistake);
    expect(after.intel.career?.performance).toBe(60 + MISSION_PERFORMANCE.mistake);
    expect(after.player.timeline.at(-1)!.text).toContain('mark in your file');
    expect(after.player.alive).toBe(true);
  });

  it('may take the clearance after a disaster, far likelier than after a mistake', () => {
    expect(CLEARANCE_LOSS_ON_DISASTER).toBeGreaterThan(CLEARANCE_LOSS_ON_MISTAKE);
    const lost = drawn(base, 'cia', {
      clearance: (u) => u < CLEARANCE_LOSS_ON_DISASTER,
      death: (u) => u >= INTEL_DEATH_ON_DISASTER.cia,
    });
    const after = answer(standing(lost, 'cia'), 'disaster');
    expect(after.player.alive).toBe(true);
    expect(after.intel.clearance).toBeUndefined();
    expect(after.intel.past.at(-1)).toMatchObject({ agency: 'cia', how: 'clearance-lost' });
    const kept = drawn(base, 'cia', {
      clearance: (u) => u >= CLEARANCE_LOSS_ON_DISASTER,
      death: (u) => u >= INTEL_DEATH_ON_DISASTER.cia,
    });
    const stayed = answer(standing(kept, 'cia'), 'disaster');
    expect(stayed.intel.clearance?.level).toBe('top-secret');
    expect(stayed.intel.career?.reputation).toBe(60 + MISSION_REPUTATION.disaster);
    expect(stayed.player.alive).toBe(true);
  });

  it('moves a member of the service to other work when the clearance goes, and keeps them in uniform', () => {
    const lost = drawn(base, 'military', {
      clearance: (u) => u < CLEARANCE_LOSS_ON_MISTAKE,
    });
    const state = standing(lost, 'military');
    const after = answer(state, 'mistake');
    expect(after.intel.clearance).toBeUndefined();
    expect(after.intel.revokedAge).toBe(AGE);
    expect(after.military.service?.specialty).toBe('army.infantry');
    expect(after.military.service?.years).toBe(4);
    expect(after.military.past).toEqual(state.military.past);
    expect(after.player.alive).toBe(true);
    expect(after.player.records.map((r) => r.label)).toContain('Lost a security clearance');
    expect(after.player.timeline.at(-1)!.text).toContain('clearance');
  });

  it('moves the standing in uniform too, for the service’s read of a member', () => {
    const state = standing(base, 'military');
    const after = answer(state, 'clean');
    expect(after.military.service?.reputation).toBe(55 + MISSION_REPUTATION.clean);
    expect(after.military.service?.performance).toBe(60 + MISSION_PERFORMANCE.clean);
  });

  it('kills only after a disaster, never after a mistake, whatever the draw', () => {
    const doomed = drawn(base, 'fbi', { death: (u) => u < INTEL_DEATH_ON_DISASTER.fbi });
    const mistake = answer(standing(doomed), 'mistake');
    expect(mistake.player.alive).toBe(true);
    const dead = answer(standing(doomed), 'disaster');
    expect(dead.player.alive).toBe(false);
  });

  it('kills an agent on a disaster draw under the agency’s chance, and writes it down', () => {
    const doomed = drawn(base, 'fbi', { death: (u) => u < INTEL_DEATH_ON_DISASTER.fbi });
    const state = standing(doomed);
    const after = answer(state, 'disaster');
    expect(after.player.alive).toBe(false);
    expect(after.health.causeOfDeath).toBe('Killed in the line of duty with the FBI');
    expect(after.health.diedAtAge).toBe(AGE);
    expect(after.intel.career).toBeUndefined();
    expect(after.intel.past.at(-1)).toMatchObject({
      agency: 'fbi',
      how: 'killed',
      years: 5,
      pension: 0,
    });
    expect(after.intel.mission).toBeUndefined();
    expect(after.pending).toEqual([]);
    expect(after.intel.missions).toEqual([{ age: AGE, source: 'fbi', outcome: 'disaster' }]);
    expect(after.player.records.map((r) => r.label)).toContain('Killed in the line of duty — FBI');
    expect(after.player.timeline.at(-1)!.kind).toBe('milestone');
    expect(after.player.timeline.at(-1)!.text).not.toContain('%');
  });

  it('kills a member of the service on a disaster, as killed with an honorable discharge', () => {
    const doomed = drawn(base, 'military', { death: (u) => u < INTEL_DEATH_ON_DISASTER.military });
    const after = answer(standing(doomed, 'military'), 'disaster');
    expect(after.player.alive).toBe(false);
    expect(after.health.causeOfDeath).toBe('Killed on an intelligence assignment');
    expect(after.military.service).toBeUndefined();
    expect(after.military.past.at(-1)).toMatchObject({
      how: 'killed',
      discharge: 'honorable',
      specialty: 'army.intelligence',
      years: 4,
    });
    expect(after.player.records.map((r) => r.label)).toContain(
      'Killed on an intelligence assignment',
    );
  });

  it('kills a CIA officer on a disaster, with the cause in the CIA’s words', () => {
    const doomed = drawn(base, 'cia', { death: (u) => u < INTEL_DEATH_ON_DISASTER.cia });
    const after = answer(standing(doomed, 'cia'), 'disaster');
    expect(after.player.alive).toBe(false);
    expect(after.health.causeOfDeath).toBe('Killed on a mission for the CIA');
    expect(INTEL_DEATH_ON_DISASTER.cia).toBeGreaterThan(INTEL_DEATH_ON_DISASTER.fbi);
    expect(INTEL_DEATH_ON_DISASTER.fbi).toBeGreaterThan(INTEL_DEATH_ON_DISASTER.military);
  });

  it('spares an agent on a disaster draw over the chance, who is hurt in standing and stress instead', () => {
    const spared = drawn(base, 'fbi', {
      death: (u) => u >= INTEL_DEATH_ON_DISASTER.fbi,
      clearance: (u) => u >= CLEARANCE_LOSS_ON_DISASTER,
    });
    const state = standing(spared);
    const after = answer(state, 'disaster');
    expect(after.player.alive).toBe(true);
    expect(after.player.stress.level).toBeGreaterThan(state.player.stress.level);
    expect(after.player.stats.happiness).toBeLessThan(state.player.stats.happiness);
  });

  it('is the same however often the same answer is given to the same state', () => {
    const state = standing(base);
    expect(answer(state, 'mistake')).toEqual(answer(state, 'mistake'));
  });
});

/* -------------------------------------------------------------------------- */
/* The year as a whole                                                         */
/* -------------------------------------------------------------------------- */

describe('the year as a whole', () => {
  const agentYear = (patch: Partial<AgencyCareer> = {}) =>
    advanceYear(asAgent(base, { grade: 12, years: 4, ...patch })).state;

  it('posts the agency’s pay and the tax on it, and reconciles', () => {
    const out = agentYear();
    const rows = out.finance.transactions.filter((row) => row.year === out.world.year);
    const pay = rows.find((row) => row.source === 'FBI pay');
    expect(pay).toBeDefined();
    expect(Number(pay!.amount) / 100).toBe(agencyYearPay('fbi', 12, 4));
    expect(pay!.category).toBe('salary');
    const tax = rows.find((row) => row.source === 'Tax on FBI pay');
    expect(tax).toBeDefined();
    expect(Number(tax!.amount)).toBeLessThan(0);
    expect(Number(tax!.amount) / 100 + agencyYearPay('fbi', 12, 4)).toBeGreaterThan(0);
    expect(out.player.cash).toBe(out.finance.balance);
  });

  it('names the CIA on its own ledger rows', () => {
    const out = advanceYear(asAgent(base, { agency: 'cia', grade: 11, years: 2 })).state;
    const sources = out.finance.transactions
      .filter((row) => row.year === out.world.year)
      .map((row) => row.source);
    expect(sources).toContain('CIA pay');
    expect(sources).toContain('Tax on CIA pay');
    expect(sources).not.toContain('FBI pay');
    expect(sources).not.toContain('Army pay');
  });

  it('makes the title the occupation while the career lasts, and the career a year older', () => {
    const out = agentYear();
    expect(out.player.occupation).toBe('Special Agent, FBI');
    expect(agencyOccupation(out.intel)).toBe(out.player.occupation);
    expect(out.intel.career?.years).toBe(5);
    expect(out.player.age).toBe(AGE + 1);
  });

  it('writes the year in the feed and not as a service year', () => {
    const out = agentYear();
    const year = out.player.timeline.filter(
      (row) => row.age === AGE + 1 && row.id.includes(':intel:'),
    );
    expect(year.length).toBeGreaterThanOrEqual(1);
    expect(year[0]!.text).not.toContain('%');
  });

  it('puts no job offer, contract, part or deal in front of an agent, and no recruiter’s offer either', () => {
    const state = asAgent(base, { grade: 12 });
    expect(withAnyOffer(state, true)).toBe(state);
    const out = agentYear();
    expect(out.sports.offer).toBeUndefined();
    expect(out.acting.offers).toEqual([]);
    expect(out.music.offer).toBeUndefined();
    expect(out.modeling.offers).toEqual([]);
  });

  it('does not provide the housing: an agent pays the cost of living a civilian does', () => {
    const out = agentYear();
    const living = out.finance.transactions.filter(
      (row) => row.year === out.world.year && row.category === 'living',
    );
    expect(living.some((row) => row.source === 'Living costs, housing provided')).toBe(false);
  });

  it('pays a retired agent’s pension as a pension, untaxed, and the household has it', () => {
    const retired: GameState = {
      ...base,
      intel: { past: [pastAgency({ endedAge: AGE, pension: 90_000 })] },
    };
    const out = advanceYear(retired).state;
    const rows = out.finance.transactions.filter((row) => row.year === out.world.year);
    const row = rows.find((r) => r.source === 'Federal retired pay');
    expect(row).toBeDefined();
    expect(row!.category).toBe('assetIncome');
    expect(Number(row!.amount) / 100).toBe(90_000);
    expect(out.player.cash).toBe(out.finance.balance);
    expect(
      out.player.timeline.some((entry) => entry.text.includes('90000') && entry.age === AGE + 1),
    ).toBe(true);
  });

  it('carries a clearance through a year a person has no job that needs it, and starts its clock', () => {
    const out = advanceYear(cleared(base, AGE - 3)).state;
    expect(out.intel.clearance?.idleSince).toBe(AGE + 1);
  });

  it('is exactly as it was for a life with no clearance, no agency and no service', () => {
    const out = advanceYear(base).state;
    expect(out.intel).toEqual(base.intel);
    expect(out.finance.transactions.some((row) => /FBI|CIA|Federal retired/.test(row.source))).toBe(
      false,
    );
  });

  it('washes a trainee out of the academy through the whole year, with the pay and the line', () => {
    const chance = academyWashOutChance(
      base.player.stats.discipline * 0.5 +
        base.player.stats.health * 0.35 +
        base.player.stats.smarts * 0.15,
    );
    const seeded = seedWhere(base, ['academy', 'fbi', AGE], (u) => u < chance);
    const out = advanceYear(
      asAgent(seeded, { stage: 'training', years: 0, grade: 10, enteredAge: AGE }),
    ).state;
    expect(out.intel.career).toBeUndefined();
    expect(out.intel.past.at(-1)?.how).toBe('washed-out');
    expect(out.player.occupation).not.toBe('Special Agent, FBI');
    expect(out.player.records.map((r) => r.label)).toContain('Did not finish — FBI training');
  });

  it('survives a whole career of years without a hash draw missing a field, to retirement or to an end', () => {
    let state = asAgent(withAge(base, 30), {
      stage: 'training',
      years: 0,
      grade: 10,
      enteredAge: 30,
    });
    let guard = 0;
    while (state.player.alive && state.intel.career && (guard += 1) < 40) {
      state = answerAll(advanceYear(answerAll(state)).state);
    }
    expect(state.intel.career === undefined || guard >= 40).toBe(true);
    if (state.intel.past.length > 0) {
      expect(['washed-out', 'let-go', 'retired']).toContain(state.intel.past.at(-1)!.how);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* What the sabotage run found loose                                           */
/* -------------------------------------------------------------------------- */

describe('what the sabotage run found loose', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const rowsOf = (state: GameState) =>
    state.finance.transactions.filter((row) => row.year === state.world.year);
  const livingOf = (state: GameState): number =>
    Math.abs(
      Number(rowsOf(state).find((row) => row.source.startsWith('Living costs'))?.amount ?? 0),
    );

  /* ---- content: the hire and the investigation ---- */

  it('hires at the agency’s own base for a fit of 55, and a point of fit is a hundredth', () => {
    const at = (agency: 'fbi' | 'cia', fit: number) =>
      hireChance({ agency, smarts: fit, discipline: fit, health: fit, intelYears: 0 });
    expect(at('fbi', 55)).toBeCloseTo(agencyRow('fbi').hireBase, 10);
    expect(at('cia', 55)).toBeCloseTo(agencyRow('cia').hireBase, 10);
    expect(at('fbi', 65)).toBeCloseTo(agencyRow('fbi').hireBase + 0.1, 10);
    expect(at('cia', 45)).toBeCloseTo(agencyRow('cia').hireBase - 0.1, 10);
  });

  it('counts no service as no help, and never as a mark against somebody', () => {
    const years = (intelYears: number) =>
      hireChance({ agency: 'fbi', smarts: 60, discipline: 60, health: 60, intelYears });
    expect(years(-3)).toBe(years(0));
  });

  it('keeps a clearance already held at the same level, with the age it was granted', () => {
    const secret = withClearance(EMPTY_INTEL, 'secret', 25);
    expect(withClearance(secret, 'secret', 30)).toBe(secret);
  });

  it('weighs the person’s Discipline in an investigation, not a fixed one', () => {
    const chance = (discipline: number) =>
      denialChance({ level: 'top-secret', discipline, revokedBefore: false });
    const seeded = seedWhere(
      base,
      ['clearance', 30, 'top-secret', 'investigation'],
      (u) => u >= chance(70) && u < chance(0),
    );
    const ask = (discipline: number) =>
      investigate({
        seed: seeded.rng.getSeed(),
        generation: seeded.world.generation,
        age: 30,
        level: 'top-secret',
        discipline,
        military: EMPTY_MILITARY,
        intel: EMPTY_INTEL,
      }).granted;
    expect(ask(70)).toBe(true);
    expect(ask(0)).toBe(false);
  });

  /* ---- the door ---- */

  it('is a degree door for somebody who holds a clearance and has no intelligence service behind it', () => {
    const held = cleared(base);
    const found = findHire(held, 'cia', false);
    const result = applyToAgency(found, 'cia');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.intel.career?.door).toBe('degree');
    // with years of intelligence service behind it, the same clearance is the service's door
    const served: GameState = {
      ...held,
      military: { ...EMPTY_MILITARY, past: [pastRow({ years: 4 })] },
    };
    const service = applyToAgency(findHire(served, 'cia', false), 'cia');
    expect(service.ok && service.value.state.intel.career?.door).toBe('service');
  });

  /* ---- the ladder ---- */

  it('counts the year just ended towards the years in grade, so the last year needed is enough', () => {
    // GS-13 asks for two years in grade at GS-12: a year at GS-12 already and this one makes two.
    const rises = seedWhere(base, ['rise', 'fbi', AGE + 1, 13], (u) => u < 0.01);
    const enough = runYear(asAgent(rises, { grade: 12, gradeYears: 1 }));
    expect(enough.intel.career?.grade).toBe(13);
    const short = runYear(asAgent(rises, { grade: 12, gradeYears: 0 }));
    expect(short.intel.career?.grade).toBe(12);
    expect(short.intel.career?.gradeYears).toBe(1);
  });

  it('scales the chance of a rise by how the year went: the weak are held back and the strong are not', () => {
    const weak = withStats(base, { discipline: 0, smarts: 0, health: 0 });
    const held = runYear(
      asAgent(
        seedWhere(weak, ['rise', 'fbi', AGE + 1, 12], (u) => u >= 0.5 && u < 0.8),
        { grade: 11, gradeYears: 3, performance: 0 },
      ),
    );
    expect(held.intel.career?.grade).toBe(11);
    const strong = withStats(base, { discipline: 100, smarts: 100, health: 100 });
    const lifted = runYear(
      asAgent(
        seedWhere(strong, ['rise', 'fbi', AGE + 1, 12], (u) => u >= 0.8 && u < 0.9),
        { grade: 11, gradeYears: 3, performance: 100 },
      ),
    );
    expect(lifted.intel.career?.grade).toBe(12);
  });

  /* ---- leaving ---- */

  it('retires at exactly twenty years and exactly fifty, not a year or a birthday later', () => {
    const at = (years: number, age: number) => {
      const result = leaveIntelCareer(
        withAge(asAgent(base, { years, grade: 13, highPay: [120_000] }), age),
      );
      expect(result.ok).toBe(true);
      return result.ok ? result.value.state.intel.past[0]!.how : undefined;
    };
    expect(at(RETIRE_ELIGIBLE_YEARS, 50)).toBe('retired');
    expect(at(RETIRE_ELIGIBLE_YEARS, 60)).toBe('retired');
    expect(at(RETIRE_ELIGIBLE_YEARS + 5, 50)).toBe('retired');
    expect(at(RETIRE_ELIGIBLE_YEARS - 1, 50)).toBe('resigned');
    expect(at(RETIRE_ELIGIBLE_YEARS, 49)).toBe('resigned');
  });

  /* ---- missions raised ---- */

  it('comes to an agent at the very grade it opens at, and to a member in the very year it opens', () => {
    const always = seedWhere(base, ['mission', AGE + 1], (u) => u < 0.01);
    expect(
      runYear(openMissions(asAgent(always, { grade: MISSION_MIN_AGENCY_GRADE }))).intel.mission,
    ).toEqual({ source: 'fbi', age: AGE + 1 });
    expect(
      runYear(openMissions(asAgent(always, { grade: MISSION_MIN_AGENCY_GRADE - 1 }))).intel.mission,
    ).toBeUndefined();
    expect(
      runYear(openMissions(cleared(serving(always, { years: MISSION_MIN_SERVICE_YEARS })))).intel
        .mission,
    ).toEqual({ source: 'military', age: AGE + 1 });
  });

  it('doesn’t come in the year a deployment ends: the person began that year away', () => {
    const always = seedWhere(base, ['mission', AGE + 1], (u) => u < 0.01);
    const home = openMissions(cleared(serving(always)));
    const away: GameState = {
      ...home,
      military: {
        ...home.military,
        deployment: {
          status: 'active' as const,
          theater: 'x',
          months: 6,
          tier: 'rear' as const,
          incidents: 1,
          results: [],
          orderedAge: AGE,
        },
      } as never,
    };
    expect(runYear(home).intel.mission).toBeDefined();
    // the year as the service left it has the person home again
    const out = runIntelYear({
      before: away,
      military: home.military,
      education: away.education,
      age: AGE + 1,
      year: away.world.year + 1,
    });
    expect(out.intel.mission).toBeUndefined();
  });

  /* ---- missions answered ---- */

  it('kills at the chance of the mission’s own source and not another’s', () => {
    const standingOf = (source: 'military' | 'fbi' | 'cia') =>
      withMission(
        source === 'military'
          ? cleared(serving(base, { years: 4 }))
          : asAgent(base, { agency: source, grade: 12, years: 5 }),
        source,
      );
    const between = (source: string, low: number, high: number): GameState => {
      for (let i = 0; i < 60000; i += 1) {
        const candidate = withSeed(base, `death-${source}-${i}`);
        const draw = mixedUnit(
          `intel:${candidate.rng.getSeed()}:${candidate.world.generation}:mission:${AGE}:${source}:death`,
        );
        if (draw >= low && draw < high) return candidate;
      }
      throw new Error('no seed');
    };
    const disaster = (state: GameState) => {
      const result = decide(state, INTEL_MISSION_EVENT_ID, 'disaster');
      if (!result.ok) throw new Error('no answer');
      return result.value.state;
    };
    // a draw the CIA's chance catches and the FBI's lets through
    const cia = between('cia', INTEL_DEATH_ON_DISASTER.fbi, INTEL_DEATH_ON_DISASTER.cia);
    expect(disaster({ ...standingOf('cia'), rng: cia.rng }).player.alive).toBe(false);
    // a draw the FBI's chance would catch and the service's lets through
    const military = between(
      'military',
      INTEL_DEATH_ON_DISASTER.military,
      INTEL_DEATH_ON_DISASTER.fbi,
    );
    expect(disaster({ ...standingOf('military'), rng: military.rng }).player.alive).toBe(true);
    const fbi = between('fbi', INTEL_DEATH_ON_DISASTER.military, INTEL_DEATH_ON_DISASTER.fbi);
    expect(disaster({ ...standingOf('fbi'), rng: fbi.rng }).player.alive).toBe(false);
  });

  it('is a standing question the whole game waits on', () => {
    const standing: GameState = {
      ...base,
      intel: { past: [], mission: { source: 'fbi', age: AGE } },
    };
    expect(hasSystemicOffer(base)).toBe(false);
    expect(hasSystemicOffer(standing)).toBe(true);
  });

  /* ---- the whole year ---- */

  it('keeps every contract, part and job away from an agent across a whole year', () => {
    const actor = (state: GameState): GameState => ({
      ...state,
      acting: {
        ...EMPTY_ACTING,
        stageYears: 1,
        seenAge: state.player.age,
        tier: 'working',
        credits: 8,
        reputation: 60,
        craft: 80,
        agent: { since: 20 },
      } as never,
    });
    const model = (state: GameState): GameState => ({
      ...state,
      modeling: {
        ...EMPTY_MODELING,
        seenAge: state.player.age,
        tier: 'catalogue',
        credits: 8,
        reputation: 60,
        craft: 80,
        agency: { since: 20 },
      } as never,
    });
    let compared = 0;
    for (let i = 0; i < 150 && compared < 3; i += 1) {
      const life = model(actor(withSeed(base, `guard-${i}`)));
      const free = advanceYear(life).state;
      if (free.acting.offers.length === 0 && free.modeling.offers.length === 0) continue;
      const served = advanceYear(asAgent(life, { grade: 12, years: 6 })).state;
      expect(served.acting.offers, `seed ${i}`).toEqual([]);
      expect(served.modeling.offers, `seed ${i}`).toEqual([]);
      expect(served.intel.career).toBeDefined();
      compared += 1;
    }
    expect(compared).toBeGreaterThanOrEqual(3);
  });

  it('lets the agency’s year, not the civilian one, move the stats: a trainee’s academy teaches', () => {
    const chance = academyWashOutChance(
      base.player.stats.discipline * 0.5 +
        base.player.stats.health * 0.35 +
        base.player.stats.smarts * 0.15,
    );
    const seeded = seedWhere(base, ['academy', 'fbi', AGE], (u) => u >= chance);
    const trained = advanceYear(
      asAgent(withStats(seeded, { discipline: 40 }), {
        stage: 'training',
        years: 0,
        grade: 10,
        enteredAge: AGE,
      }),
    ).state;
    const idle = advanceYear(withStats(seeded, { discipline: 40 })).state;
    expect(trained.player.stats.discipline).toBeGreaterThan(idle.player.stats.discipline);
  });

  it('lets a household live on an agent’s pay and on a retired agent’s pension', () => {
    const rich = advanceYear(withSeed(asAgent(base, { grade: 15, years: 9 }), 'living')).state;
    const poor = advanceYear(withSeed(asAgent(base, { grade: 9, years: 0 }), 'living')).state;
    expect(livingOf(rich)).toBeGreaterThan(livingOf(poor));
    const pensioner = advanceYear(
      withSeed(
        { ...base, intel: { past: [pastAgency({ endedAge: AGE, pension: 150_000 })] } },
        'living',
      ),
    ).state;
    const neighbor = advanceYear(
      withSeed(
        { ...base, intel: { past: [pastAgency({ endedAge: AGE, pension: 0, how: 'resigned' })] } },
        'living',
      ),
    ).state;
    expect(livingOf(pensioner)).toBeGreaterThan(livingOf(neighbor));
  });

  it('adds the year’s mood, as the agency’s year reports it, to how the person feels', () => {
    const state = withStats(asAgent(base, { grade: 12, years: 4 }), { happiness: 50 });
    const real = intelModule.runIntelYear;
    const plain = advanceYear(state).state;
    vi.spyOn(intelModule, 'runIntelYear').mockImplementation((input) => {
      const out = real(input);
      return { ...out, mood: out.mood + 10 };
    });
    const lifted = advanceYear(state).state;
    expect(lifted.player.stats.happiness).toBeGreaterThan(plain.player.stats.happiness);
  });

  it('counts an agent’s pay in what private deals are taxed on top of', () => {
    const deals = vi.spyOn(dealPhase, 'runDealsYear');
    advanceYear(asAgent(base, { grade: 14, years: 9 }));
    const other = deals.mock.calls[0]?.[0].otherIncome ?? 0;
    const pay = agencyYearPay('fbi', 14, 9);
    expect(other).toBeGreaterThan(pay / 2);
    expect(other).toBeLessThanOrEqual(pay);
    deals.mockClear();
    advanceYear(base);
    expect(deals.mock.calls[0]?.[0].otherIncome).toBe(0);
  });
});
