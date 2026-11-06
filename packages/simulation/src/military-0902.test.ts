/**
 * Ticket 0902 acceptance tests — branches, specialties and officers.
 *
 * Five branches that share one engine and differ in their tables (titles, the words for training, the age and aptitude
 * at the door, four or five specialties each); a branch and a job chosen at the recruiter's table, in steps; officers,
 * by a bachelor's degree and a commission or by a board picking a serving enlisted member, on the real 2026 officer pay
 * table, with a training year that can send an enlisted member back to the ranks; promotion by commissioned service
 * and a board that picks most and not all, with an officer twice passed over made to leave; retirement as a choice from
 * twenty years and a hard stop at 65; and that nothing else stands beside service (a contract, a part, a record deal,
 * a modeling job). Each pin that is a real figure says so; the rest are the game's own dials, named in the ticket doc.
 */

import { describe, expect, it } from 'vitest';
import {
  COMMISSION_BOARD_MIN_YEARS,
  ENLIST_MAX_AGE,
  MANDATORY_RETIRE_AGE,
  O3_PASS_OVER_YEARS,
  OFFICER_GRADES,
  OFFICER_TOP_GRADE,
  PAY_STEPS,
  RETAIN_PERFORMANCE_FLOOR,
  RETIRE_ELIGIBLE_YEARS,
  SERVICE_BRANCHES,
  SERVICE_BRANCH_IDS,
  SPECIALTIES,
  SPECIALTY_SKILLS,
  TERM_YEARS,
  annualBasePay,
  commissionAgeLimit,
  commissionBoardChance,
  enlistAgeLimit,
  findOfficerGrade,
  findServiceBranch,
  findSpecialty,
  isServiceBranchId,
  monthlyBasePay,
  officerRiseChance,
  officerWashOutChance,
  officerWashOutPay,
  openSpecialtyOf,
  rankAbbr,
  rankTitle,
  scaledRise,
  serviceFit,
  servicePerformanceTarget,
  smartsFloorOf,
  specialtiesOf,
  specialtyBar,
  washOutPay,
} from '@yearafter/content';
import { performanceYear } from '@yearafter/careers';
import { mixedUnit } from '@yearafter/core';

import { advanceYear } from './advance';
import { EMPTY_ACTING } from './acting-state';
import { EMPTY_MODELING } from './modeling-state';
import { decide } from './decide';
import { hasSystemicOffer, type GameState } from './game-state';
import {
  COMMISSION_ERROR_LABELS,
  ENLIST_ERROR_LABELS,
  MILITARY_DECLINE,
  MILITARY_LEAVE,
  MILITARY_OFFER_EVENT_ID,
  MILITARY_REENLIST,
  answerMilitaryOffer,
  applyForCommission,
  applyToEnlist,
  branchNameOf,
  eligibleBranches,
  enlistmentBar,
  holdsDegree,
  militaryOccupation,
  militaryOfferDecision,
  payWords,
  qualifyingSpecialties,
  rankTitleOf,
  retireFromService,
  runMilitaryYear,
  specialtyNameOf,
  withMilitaryOffer,
  yearPayOf,
} from './military';
import {
  withoutActingOffers,
  withoutModelingOffers,
  withoutMusicOffer,
  withoutSportsOffer,
} from './military-guard';
import { EMPTY_MILITARY, type MilitaryOffer, type ServiceCareer } from './military-state';
import { createNewGame } from './new-game';
import { Rng } from './rng/rng';
import { ordinaryChoice } from './ordinary-answers';

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
function adult(seed: string, age = 24): GameState {
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

const withAge = (state: GameState, age: number): GameState => ({
  ...state,
  player: { ...state.player, age },
});

/** A fit adult with a high-school diploma and nothing in the way of the recruiting office. */
const eligible = (state: GameState): GameState => {
  const fit = withStats(state, { health: 80, smarts: 60, discipline: 60 });
  return {
    ...fit,
    education: {
      ...fit.education,
      enrollment: undefined,
      credentials: {
        ...fit.education.credentials,
        highSchool: 18,
        university: undefined,
        postgraduate: undefined,
      },
    } as never,
    sports: { ...fit.sports, career: undefined, post: undefined } as never,
    pending: [],
    military: EMPTY_MILITARY,
  };
};

/** The same, with a bachelor's degree. */
const graduate = (state: GameState): GameState => {
  const base = eligible(state);
  return {
    ...base,
    education: {
      ...base.education,
      credentials: { ...base.education.credentials, university: 22 },
    } as never,
  };
};

const withSeed = (state: GameState, seed: string): GameState =>
  ({ ...state, rng: { ...state.rng, getSeed: () => seed } }) as unknown as GameState;

const serviceRow = (patch: Partial<ServiceCareer> = {}): ServiceCareer => ({
  branch: 'army',
  stage: 'serving',
  enlistedAge: 19,
  track: 'enlisted',
  specialty: 'army.infantry',
  commissionedAt: 0,
  grade: 4,
  years: 3,
  termEnds: 4,
  performance: 60,
  reputation: 55,
  effort: 'normal',
  lastPay: 0,
  post: 'Fort Harlan',
  ...patch,
});

const officerRow = (patch: Partial<ServiceCareer> = {}): ServiceCareer =>
  serviceRow({
    track: 'officer',
    grade: 2,
    years: 2,
    termEnds: 4,
    enlistedAge: 22,
    ...patch,
  });

const serving = (state: GameState, patch: Partial<ServiceCareer> = {}): GameState => ({
  ...state,
  military: { ...state.military, service: serviceRow(patch) },
});

const officering = (state: GameState, patch: Partial<ServiceCareer> = {}): GameState => ({
  ...state,
  military: { ...state.military, service: officerRow(patch) },
});

const yearOf = (before: GameState, age = before.player.age + 1, year = before.world.year + 1) =>
  runMilitaryYear({ before, education: before.education, age, year });

/** The hash a service draw is made from, so a seed can be picked by what it draws and not found by luck. */
const draw = (state: GameState, ...parts: readonly (string | number)[]): number =>
  mixedUnit(`service:${state.rng.getSeed()}:${state.world.generation}:${parts.join(':')}`);

/** The first seed of a family whose draw falls on a given side of a line. */
function seedWhere(
  state: GameState,
  parts: readonly (string | number)[],
  test: (unit: number) => boolean,
): GameState {
  for (let i = 0; i < 5000; i += 1) {
    const candidate = withSeed(state, `pick-${i}`);
    if (test(draw(candidate, ...parts))) return candidate;
  }
  throw new Error('no seed found');
}

/** The same life on a new seed, with a fresh random generator, so two runs of it start from the same stream. */
const reseed = (state: GameState, seed: string): GameState =>
  ({ ...state, rng: new Rng(seed) }) as unknown as GameState;

/** The branch row, typed. */
const row = (id: string) => findServiceBranch(id)!;

/* -------------------------------------------------------------------------- */
/* The tables                                                                  */
/* -------------------------------------------------------------------------- */

describe('the five branches', () => {
  it('are the Army, Navy, Marine Corps, Air Force and Coast Guard, in that order, and no Space Force', () => {
    expect(SERVICE_BRANCH_IDS).toEqual([
      'army',
      'navy',
      'marine-corps',
      'air-force',
      'coast-guard',
    ]);
    expect(SERVICE_BRANCHES.map((b) => b.id)).toEqual([...SERVICE_BRANCH_IDS]);
    expect(findServiceBranch('space-force')).toBeUndefined();
    expect(isServiceBranchId('navy')).toBe(true);
    expect(isServiceBranchId('space-force')).toBe(false);
    expect(isServiceBranchId(undefined)).toBe(false);
    expect(isServiceBranchId(7)).toBe(false);
  });

  it('are named as a line reads them', () => {
    expect(SERVICE_BRANCHES.map((b) => [b.name, b.short, b.member])).toEqual([
      ['the Army', 'Army', 'soldier'],
      ['the Navy', 'Navy', 'sailor'],
      ['the Marine Corps', 'Marine Corps', 'Marine'],
      ['the Air Force', 'Air Force', 'airman'],
      ['the Coast Guard', 'Coast Guard', 'Coast Guardsman'],
    ]);
    expect(SERVICE_BRANCHES.map((b) => [b.training, b.trainingWeeks, b.officerSchool])).toEqual([
      ['basic training', 10, 'Officer Candidate School'],
      ['boot camp', 8, 'Officer Candidate School'],
      ['boot camp', 13, 'Officer Candidates School'],
      ['basic military training', 8, 'Officer Training School'],
      ['boot camp', 8, 'Officer Candidate School'],
    ]);
  });

  it('each have five made-up posts, none of them repeated across the table', () => {
    const all = SERVICE_BRANCHES.flatMap((b) => b.posts);
    for (const b of SERVICE_BRANCHES) expect(b.posts).toHaveLength(5);
    expect(new Set(all).size).toBe(all.length);
  });

  it('read the 2026 enlistment limits, held to the game’s ceiling of 35', () => {
    expect(SERVICE_BRANCHES.map((b) => b.maxEnlistAge)).toEqual([35, 41, 28, 42, 31]);
    expect(ENLIST_MAX_AGE).toBe(35);
    expect(SERVICE_BRANCH_IDS.map(enlistAgeLimit)).toEqual([35, 35, 28, 35, 31]);
    expect(enlistAgeLimit('nowhere')).toBe(35);
  });

  it('commission officers up to a limit of their own, also under 35', () => {
    expect(SERVICE_BRANCHES.map((b) => b.maxCommissionAge)).toEqual([33, 33, 28, 33, 31]);
    expect(SERVICE_BRANCH_IDS.map(commissionAgeLimit)).toEqual([33, 33, 28, 33, 31]);
    expect(commissionAgeLimit('nowhere')).toBe(35);
  });

  it('take the aptitude the door reads: 30 in four branches and 40 in the Coast Guard', () => {
    expect(SERVICE_BRANCHES.map((b) => b.smartsFloor)).toEqual([30, 30, 30, 30, 40]);
    expect(SERVICE_BRANCH_IDS.map(smartsFloorOf)).toEqual([30, 30, 30, 30, 40]);
    expect(smartsFloorOf('nowhere')).toBe(30);
  });
});

describe('rank titles', () => {
  const enlisted = {
    army: [
      'Private',
      'Private',
      'Private First Class',
      'Specialist',
      'Sergeant',
      'Staff Sergeant',
      'Sergeant First Class',
      'Master Sergeant',
      'Sergeant Major',
    ],
    navy: [
      'Seaman Recruit',
      'Seaman Apprentice',
      'Seaman',
      'Petty Officer Third Class',
      'Petty Officer Second Class',
      'Petty Officer First Class',
      'Chief Petty Officer',
      'Senior Chief Petty Officer',
      'Master Chief Petty Officer',
    ],
    'marine-corps': [
      'Private',
      'Private First Class',
      'Lance Corporal',
      'Corporal',
      'Sergeant',
      'Staff Sergeant',
      'Gunnery Sergeant',
      'Master Sergeant',
      'Sergeant Major',
    ],
    'air-force': [
      'Airman Basic',
      'Airman',
      'Airman First Class',
      'Senior Airman',
      'Staff Sergeant',
      'Technical Sergeant',
      'Master Sergeant',
      'Senior Master Sergeant',
      'Chief Master Sergeant',
    ],
    'coast-guard': [
      'Seaman Recruit',
      'Seaman Apprentice',
      'Seaman',
      'Petty Officer Third Class',
      'Petty Officer Second Class',
      'Petty Officer First Class',
      'Chief Petty Officer',
      'Senior Chief Petty Officer',
      'Master Chief Petty Officer',
    ],
  } as const;
  const landOfficers = [
    'Second Lieutenant',
    'First Lieutenant',
    'Captain',
    'Major',
    'Lieutenant Colonel',
    'Colonel',
  ];
  const seaOfficers = [
    'Ensign',
    'Lieutenant Junior Grade',
    'Lieutenant',
    'Lieutenant Commander',
    'Commander',
    'Captain',
  ];
  const officers = {
    army: landOfficers,
    navy: seaOfficers,
    'marine-corps': landOfficers,
    'air-force': landOfficers,
    'coast-guard': seaOfficers,
  } as const;

  it('are each branch’s own, for nine enlisted grades and six officer grades', () => {
    for (const id of SERVICE_BRANCH_IDS) {
      expect(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => rankTitle(id, 'enlisted', g)),
        id,
      ).toEqual(enlisted[id]);
      expect(
        [1, 2, 3, 4, 5, 6].map((g) => rankTitle(id, 'officer', g)),
        id,
      ).toEqual(officers[id]);
      expect(row(id).enlistedTitles).toHaveLength(9);
      expect(row(id).enlistedAbbrs).toHaveLength(9);
      expect(row(id).officerTitles).toHaveLength(6);
      expect(row(id).officerAbbrs).toHaveLength(6);
    }
  });

  it('have the short forms of the Army, the Navy, the Marines and the Air Force', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => rankAbbr('army', 'enlisted', g))).toEqual([
      'PV1',
      'PV2',
      'PFC',
      'SPC',
      'SGT',
      'SSG',
      'SFC',
      'MSG',
      'SGM',
    ]);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => rankAbbr('navy', 'enlisted', g))).toEqual([
      'SR',
      'SA',
      'SN',
      'PO3',
      'PO2',
      'PO1',
      'CPO',
      'SCPO',
      'MCPO',
    ]);
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => rankAbbr('marine-corps', 'enlisted', g))).toEqual(
      ['Pvt', 'PFC', 'LCpl', 'Cpl', 'Sgt', 'SSgt', 'GySgt', 'MSgt', 'SgtMaj'],
    );
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => rankAbbr('air-force', 'enlisted', g))).toEqual([
      'AB',
      'Amn',
      'A1C',
      'SrA',
      'SSgt',
      'TSgt',
      'MSgt',
      'SMSgt',
      'CMSgt',
    ]);
    expect([1, 2, 3, 4, 5, 6].map((g) => rankAbbr('army', 'officer', g))).toEqual([
      '2LT',
      '1LT',
      'CPT',
      'MAJ',
      'LTC',
      'COL',
    ]);
    expect([1, 2, 3, 4, 5, 6].map((g) => rankAbbr('coast-guard', 'officer', g))).toEqual([
      'ENS',
      'LTJG',
      'LT',
      'LCDR',
      'CDR',
      'CAPT',
    ]);
  });

  it('read the nearest grade for one off either end, and the Army for a branch nobody knows', () => {
    expect(rankTitle('navy', 'enlisted', 0)).toBe('Seaman Recruit');
    expect(rankTitle('navy', 'enlisted', 99)).toBe('Master Chief Petty Officer');
    expect(rankTitle('navy', 'officer', 0)).toBe('Ensign');
    expect(rankTitle('navy', 'officer', 99)).toBe('Captain');
    expect(rankTitle('navy', 'enlisted', 3.6)).toBe('Petty Officer Third Class');
    expect(rankTitle('nowhere', 'enlisted', 5)).toBe('Sergeant');
    expect(rankTitle('nowhere', 'officer', 6)).toBe('Colonel');
    expect(rankAbbr('navy', 'enlisted', 0)).toBe('SR');
    expect(rankAbbr('navy', 'enlisted', 99)).toBe('MCPO');
    expect(rankAbbr('navy', 'officer', 0)).toBe('ENS');
    expect(rankAbbr('navy', 'officer', 99)).toBe('CAPT');
    expect(rankAbbr('nowhere', 'officer', 1)).toBe('2LT');
  });
});

describe('the specialties', () => {
  it('are five in each branch, 25 in all, each id belonging to its branch and none repeated', () => {
    expect(SPECIALTIES).toHaveLength(25);
    for (const id of SERVICE_BRANCH_IDS) {
      expect(specialtiesOf(id), id).toHaveLength(5);
      for (const s of specialtiesOf(id)) expect(s.id.startsWith(`${id}.`)).toBe(true);
    }
    expect(new Set(SPECIALTIES.map((s) => s.id)).size).toBe(25);
    expect(new Set(SPECIALTIES.map((s) => s.name)).size).toBeGreaterThan(15);
    expect(specialtiesOf('nowhere')).toEqual([]);
  });

  it('are the work each branch does, with the aptitude, danger and skill pinned', () => {
    const table = SPECIALTIES.map((s) => [
      s.id,
      s.name,
      s.requires.smarts ?? 0,
      s.requires.health ?? 0,
      s.requires.discipline ?? 0,
      s.danger,
      s.skill,
    ]);
    expect(table).toEqual([
      ['army.infantry', 'Infantry', 0, 0, 0, 3, 'combat'],
      ['army.medic', 'Combat Medic', 40, 0, 0, 2, 'medical'],
      ['army.mechanic', 'Vehicle Mechanic', 35, 0, 0, 1, 'mechanical'],
      ['army.signal', 'Signal Support', 50, 0, 0, 1, 'technical'],
      ['army.police', 'Military Police', 0, 0, 50, 2, 'security'],
      ['navy.boatswain', "Boatswain's Mate", 0, 0, 0, 2, 'maritime'],
      ['navy.corpsman', 'Hospital Corpsman', 45, 0, 0, 2, 'medical'],
      ['navy.machinist', "Machinist's Mate", 40, 0, 0, 2, 'mechanical'],
      ['navy.systems', 'Information Systems Technician', 55, 0, 0, 1, 'technical'],
      ['navy.aviation', 'Aviation Mechanic', 45, 0, 0, 2, 'aviation'],
      ['marine-corps.rifleman', 'Rifleman', 0, 0, 0, 3, 'combat'],
      ['marine-corps.engineer', 'Combat Engineer', 40, 0, 0, 3, 'combat'],
      ['marine-corps.motor', 'Motor Transport', 35, 0, 0, 1, 'logistics'],
      ['marine-corps.radio', 'Radio Operator', 50, 0, 0, 1, 'technical'],
      ['marine-corps.ordnance', 'Aviation Ordnance', 45, 0, 0, 2, 'aviation'],
      ['air-force.logistics', 'Logistics Readiness', 0, 0, 0, 1, 'logistics'],
      ['air-force.maintenance', 'Aircraft Maintenance', 40, 0, 0, 1, 'aviation'],
      ['air-force.security', 'Security Forces', 0, 0, 50, 2, 'security'],
      ['air-force.cyber', 'Cyber Systems', 60, 0, 0, 1, 'technical'],
      ['air-force.medical', 'Aerospace Medical Service', 50, 0, 0, 1, 'medical'],
      ['coast-guard.boatswain', "Boatswain's Mate", 0, 0, 0, 2, 'maritime'],
      ['coast-guard.machinery', 'Machinery Technician', 45, 0, 0, 1, 'mechanical'],
      ['coast-guard.enforcement', 'Maritime Enforcement', 0, 0, 50, 2, 'security'],
      ['coast-guard.health', 'Health Services Technician', 50, 0, 0, 1, 'medical'],
      ['coast-guard.survival', 'Aviation Survival Technician', 0, 70, 55, 3, 'aviation'],
    ]);
    for (const s of SPECIALTIES) expect(SPECIALTY_SKILLS).toContain(s.skill);
  });

  it('open with a job that asks for nothing beyond the door, so anybody who gets in has one to choose', () => {
    for (const id of SERVICE_BRANCH_IDS) {
      const open = openSpecialtyOf(id);
      expect(open.id, id).toBe(specialtiesOf(id)[0]!.id);
      expect(open.requires).toEqual({});
    }
    expect(openSpecialtyOf('nowhere').id).toBe('army.infantry');
    expect(findSpecialty('navy.corpsman')?.name).toBe('Hospital Corpsman');
    expect(findSpecialty('navy.cook')).toBeUndefined();
  });

  it('turn somebody away on the first stat that falls short, and at the line itself let them in', () => {
    const stats = { smarts: 50, health: 50, discipline: 50 };
    const army = (id: string) => findSpecialty(id)!;
    expect(specialtyBar(army('army.signal'), { ...stats, smarts: 49 })).toBe('smarts');
    expect(specialtyBar(army('army.signal'), { ...stats, smarts: 50 })).toBeUndefined();
    expect(specialtyBar(army('army.police'), { ...stats, discipline: 49 })).toBe('discipline');
    expect(specialtyBar(army('army.police'), { ...stats, discipline: 50 })).toBeUndefined();
    const survival = army('coast-guard.survival');
    expect(specialtyBar(survival, { smarts: 90, health: 69, discipline: 90 })).toBe('health');
    expect(specialtyBar(survival, { smarts: 90, health: 70, discipline: 54 })).toBe('discipline');
    expect(specialtyBar(survival, { smarts: 0, health: 70, discipline: 55 })).toBeUndefined();
    // Smarts is read first, then Health, then Discipline: a job that wanted all three would say Smarts.
    expect(
      specialtyBar(
        { ...survival, requires: { smarts: 80, health: 80, discipline: 80 } },
        {
          smarts: 0,
          health: 0,
          discipline: 0,
        },
      ),
    ).toBe('smarts');
    expect(
      specialtyBar(
        { ...survival, requires: { health: 80, discipline: 80 } },
        {
          smarts: 0,
          health: 0,
          discipline: 0,
        },
      ),
    ).toBe('health');
    expect(
      specialtyBar(army('army.infantry'), { smarts: 0, health: 0, discipline: 0 }),
    ).toBeUndefined();
  });
});

describe('the officer pay table', () => {
  // DFAS, "Basic Pay – Officers Effective January 1, 2026", monthly, at each of PAY_STEPS.
  const dfas: Readonly<Record<number, readonly number[]>> = {
    1: [4150.2, 4320, ...Array(13).fill(5222.4)],
    2: [4782, 5446.2, 6272.4, 6484.5, ...Array(11).fill(6617.7)],
    3: [5534.1, 6273.9, 6770.4, 7382.7, 7737, 8125.5, 8375.7, 8788.2, ...Array(7).fill(9004.2)],
    4: [
      6294.6,
      7286.4,
      7773.6,
      7881,
      8332.2,
      8816.4,
      9420,
      9888.3,
      10214.4,
      10401.6,
      ...Array(5).fill(10509.9),
    ],
    5: [
      7295.4,
      8218.2,
      8787,
      8894.1,
      9249.6,
      9461.4,
      9928.5,
      10271.7,
      10715.1,
      11391.3,
      11713.8,
      12032.7,
      ...Array(3).fill(12394.8),
    ],
    6: [
      8751.3, 9613.8, 10245, 10245, 10284.3, 10725, 10783.5, 10783.5, 11396.4, 12479.7, 13115.4,
      13751.1, 14112.9, 14479.2, 15188.7,
    ],
  };

  it('reads the DFAS table in every cell, O-1 to O-6 by the fifteen steps of service', () => {
    expect(PAY_STEPS).toHaveLength(15);
    for (const grade of [1, 2, 3, 4, 5, 6]) {
      const expected = dfas[grade]!;
      expect(expected).toHaveLength(15);
      PAY_STEPS.forEach((years, index) => {
        expect(monthlyBasePay(grade, years, 'officer'), `O-${grade} at ${years}`).toBe(
          expected[index],
        );
      });
    }
  });

  it('pays a year of it, in whole dollars, and the same for every branch', () => {
    expect(annualBasePay(1, 0, 'officer')).toBe(49802);
    expect(annualBasePay(3, 4, 'officer')).toBe(88592);
    expect(annualBasePay(4, 12, 'officer')).toBe(118660);
    expect(annualBasePay(5, 16, 'officer')).toBe(136696);
    expect(annualBasePay(6, 22, 'officer')).toBe(169355);
    expect(annualBasePay(6, 26, 'officer')).toBe(182264);
  });

  it('takes the step a number of years has reached, and not the next one', () => {
    expect(monthlyBasePay(3, 1, 'officer')).toBe(5534.1);
    expect(monthlyBasePay(3, 2, 'officer')).toBe(6273.9);
    expect(monthlyBasePay(3, 5, 'officer')).toBe(7382.7);
    expect(monthlyBasePay(3, 6, 'officer')).toBe(7737);
    expect(monthlyBasePay(6, 100, 'officer')).toBe(15188.7);
  });

  it('reads the nearest grade for one off either end, and the enlisted table when no ladder is named', () => {
    expect(monthlyBasePay(0, 5, 'officer')).toBe(monthlyBasePay(1, 5, 'officer'));
    expect(monthlyBasePay(9, 5, 'officer')).toBe(monthlyBasePay(6, 5, 'officer'));
    expect(monthlyBasePay(5, 8)).toBe(monthlyBasePay(5, 8, 'enlisted'));
    expect(monthlyBasePay(5, 8)).not.toBe(monthlyBasePay(5, 8, 'officer'));
    expect(annualBasePay(5, 8)).toBe(annualBasePay(5, 8, 'enlisted'));
    expect(monthlyBasePay(10, 20)).toBe(monthlyBasePay(9, 20));
  });

  it('pays an officer candidate who does not finish half a year of the O-1 rate, from where their service stands', () => {
    expect(officerWashOutPay(0)).toBe(Math.round(4150.2 * 6));
    expect(officerWashOutPay(3)).toBe(Math.round(5222.4 * 6));
    expect(officerWashOutPay(0)).toBeGreaterThan(washOutPay());
  });
});

describe('the officer ladder', () => {
  it('is six grades, the time for each rising, and the first three certain', () => {
    expect(OFFICER_TOP_GRADE).toBe(6);
    expect(OFFICER_GRADES.map((g) => [g.grade, g.minYears, g.rise])).toEqual([
      [1, 0, 1],
      [2, 2, 1],
      [3, 4, 1],
      [4, 10, 0.35],
      [5, 16, 0.28],
      [6, 22, 0.03],
    ]);
    expect(findOfficerGrade(0).grade).toBe(1);
    expect(findOfficerGrade(99).grade).toBe(6);
    expect(findOfficerGrade(3.4).grade).toBe(3);
  });

  it('scales a chance by how the year went: a 60 is the table, 100 is 1.8 times it, 20 is a fifth of it', () => {
    expect(scaledRise(0.35, 60)).toBeCloseTo(0.35);
    expect(scaledRise(0.35, 100)).toBeCloseTo(0.63);
    expect(scaledRise(0.35, 20)).toBeCloseTo(0.07);
    expect(scaledRise(0.35, 0)).toBeCloseTo(0.07);
    expect(scaledRise(0.35, 200)).toBeCloseTo(0.63);
    expect(scaledRise(0.6, 100)).toBeCloseTo(0.95);
    expect(scaledRise(1, 0)).toBe(1);
    expect(scaledRise(0.35, 80)).toBeCloseTo(0.525);
  });

  it('reads a grade’s own chance, and keeps the first three certain whatever the year was', () => {
    for (const grade of [1, 2, 3]) expect(officerRiseChance(grade, 0)).toBe(1);
    expect(officerRiseChance(4, 60)).toBeCloseTo(0.35);
    expect(officerRiseChance(5, 60)).toBeCloseTo(0.28);
    expect(officerRiseChance(6, 60)).toBeCloseTo(0.03);
    expect(officerRiseChance(6, 100)).toBeCloseTo(0.054);
  });

  it('passes over a lieutenant after thirteen years, and asks a degree and a board of anyone who would become an officer', () => {
    expect(O3_PASS_OVER_YEARS).toBe(13);
    expect(COMMISSION_BOARD_MIN_YEARS).toBe(1);
    expect(commissionBoardChance(60)).toBeCloseTo(0.3);
    expect(commissionBoardChance(70)).toBeCloseTo(0.4);
    expect(commissionBoardChance(50)).toBeCloseTo(0.2);
    expect(commissionBoardChance(100)).toBeCloseTo(0.6);
    expect(commissionBoardChance(90)).toBeCloseTo(0.6);
    expect(commissionBoardChance(0)).toBeCloseTo(0.05);
    expect(commissionBoardChance(30)).toBeCloseTo(0.05);
    expect(commissionBoardChance(35)).toBeCloseTo(0.05);
    expect(commissionBoardChance(36)).toBeCloseTo(0.06);
  });

  it('loses 8% of middling candidates in training, moving 0.3 points for each point of fit, between 2% and 25%', () => {
    expect(officerWashOutChance(58)).toBeCloseTo(0.08);
    expect(officerWashOutChance(38)).toBeCloseTo(0.14);
    expect(officerWashOutChance(78)).toBeCloseTo(0.02);
    expect(officerWashOutChance(100)).toBeCloseTo(0.02);
    expect(officerWashOutChance(0)).toBeCloseTo(0.25);
    expect(officerWashOutChance(60)).toBeCloseTo(0.074);
    expect(officerWashOutChance(57)).toBeCloseTo(0.083);
  });

  it('makes retirement a choice from twenty years, with a hard stop at 65, on whole terms', () => {
    expect(RETIRE_ELIGIBLE_YEARS).toBe(20);
    expect(MANDATORY_RETIRE_AGE).toBe(65);
    expect(RETIRE_ELIGIBLE_YEARS % TERM_YEARS).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Who can join, in which branch                                               */
/* -------------------------------------------------------------------------- */

describe('the door, branch by branch', () => {
  const base = eligible(adult('MIL2-DOOR', 26));
  const grad = graduate(adult('MIL2-DOOR', 26));

  it('closes at each branch’s own age: 28 for the Marines, 31 for the Coast Guard, 35 for the rest', () => {
    const limits: [string, number][] = [
      ['army', 35],
      ['navy', 35],
      ['marine-corps', 28],
      ['air-force', 35],
      ['coast-guard', 31],
    ];
    for (const [branch, limit] of limits) {
      const at = withAge(base, limit);
      expect(enlistmentBar(at, limit, branch as never), `${branch} at ${limit}`).toBeUndefined();
      expect(
        enlistmentBar(withAge(base, limit + 1), limit + 1, branch as never),
        `${branch} over`,
      ).toBe('too-old');
    }
  });

  it('asks the aptitude each branch asks: 30 Smarts, and 40 for the Coast Guard', () => {
    for (const branch of ['army', 'navy', 'marine-corps', 'air-force'] as const) {
      expect(enlistmentBar(withStats(base, { smarts: 29 }), 26, branch), branch).toBe('not-ready');
      expect(enlistmentBar(withStats(base, { smarts: 30 }), 26, branch), branch).toBeUndefined();
    }
    expect(enlistmentBar(withStats(base, { smarts: 39 }), 26, 'coast-guard')).toBe('not-ready');
    expect(enlistmentBar(withStats(base, { smarts: 40 }), 26, 'coast-guard')).toBeUndefined();
  });

  it('is the Army and the enlisted ladder when neither is named, as 0901 asked', () => {
    expect(enlistmentBar(base, 26)).toBeUndefined();
    expect(enlistmentBar(withAge(base, 30), 30)).toBeUndefined();
    expect(enlistmentBar(withStats(base, { smarts: 35 }), 26)).toBeUndefined();
    expect(enlistmentBar(withAge(base, 36), 36)).toBe('too-old');
  });

  it('asks a bachelor’s degree for the officer ladder and nothing for the enlisted one', () => {
    expect(enlistmentBar(base, 26, 'army', 'officer')).toBe('no-degree');
    expect(enlistmentBar(base, 26, 'army', 'enlisted')).toBeUndefined();
    expect(enlistmentBar(grad, 26, 'army', 'officer')).toBeUndefined();
    expect(holdsDegree(base.education)).toBe(false);
    expect(holdsDegree(grad.education)).toBe(true);
    const doctor = {
      ...base.education,
      credentials: { highSchool: 18, postgraduate: 28 },
    } as never;
    expect(holdsDegree(doctor)).toBe(true);
    expect(holdsDegree({ ...base.education, credentials: undefined } as never)).toBe(false);
  });

  it('commissions up to 33 in the Army, Navy and Air Force, and holds the Marines and the Coast Guard to their own', () => {
    for (const branch of ['army', 'navy', 'air-force'] as const) {
      expect(enlistmentBar(withAge(grad, 33), 33, branch, 'officer'), branch).toBeUndefined();
      expect(enlistmentBar(withAge(grad, 34), 34, branch, 'officer'), branch).toBe('too-old');
      // The enlisted ladder is open to 35.
      expect(enlistmentBar(withAge(grad, 34), 34, branch, 'enlisted'), branch).toBeUndefined();
    }
    expect(enlistmentBar(withAge(grad, 28), 28, 'marine-corps', 'officer')).toBeUndefined();
    expect(enlistmentBar(withAge(grad, 29), 29, 'marine-corps', 'officer')).toBe('too-old');
    expect(enlistmentBar(withAge(grad, 31), 31, 'coast-guard', 'officer')).toBeUndefined();
    expect(enlistmentBar(withAge(grad, 32), 32, 'coast-guard', 'officer')).toBe('too-old');
  });

  it('reads the bars in order: serving, age, school, diploma, degree, health, aptitude, another career', () => {
    expect(enlistmentBar(serving(base), 26)).toBe('serving');
    expect(enlistmentBar(withAge(base, 16), 16)).toBe('too-young');
    expect(enlistmentBar(withAge(base, 17), 17)).toBeUndefined();
    const noDiploma = {
      ...base,
      education: { ...base.education, credentials: undefined },
    } as never as GameState;
    expect(enlistmentBar(noDiploma, 26, 'army', 'officer')).toBe('no-diploma');
    const sick = withStats(base, { health: 49, smarts: 10 });
    expect(enlistmentBar(sick, 26)).toBe('unfit');
    expect(enlistmentBar(withStats(base, { health: 50 }), 26)).toBeUndefined();
    expect(enlistmentBar(sick, 26, 'army', 'officer')).toBe('no-degree');
    const busy = {
      ...base,
      acting: { ...EMPTY_ACTING, tier: 'supporting', credits: 5, idle: 0 },
    } as never as GameState;
    expect(enlistmentBar(busy, 26)).toBe('busy');
  });

  it('lists the branches somebody can walk up to, in table order', () => {
    expect(eligibleBranches(base, 26)).toEqual([...SERVICE_BRANCH_IDS]);
    expect(eligibleBranches(withAge(base, 30), 30)).toEqual([
      'army',
      'navy',
      'air-force',
      'coast-guard',
    ]);
    expect(eligibleBranches(withAge(base, 32), 32)).toEqual(['army', 'navy', 'air-force']);
    expect(eligibleBranches(withStats(base, { smarts: 35 }), 26)).toEqual([
      'army',
      'navy',
      'marine-corps',
      'air-force',
    ]);
    expect(eligibleBranches(withAge(base, 40), 40)).toEqual([]);
    // With no age given, the character's own.
    expect(eligibleBranches(withAge(base, 29))).toEqual([
      'army',
      'navy',
      'air-force',
      'coast-guard',
    ]);
  });

  it('lists the jobs a character has the aptitude for, the open one always among them', () => {
    const all = qualifyingSpecialties(base, 'army');
    expect(all).toEqual([
      'army.infantry',
      'army.medic',
      'army.mechanic',
      'army.signal',
      'army.police',
    ]);
    expect(qualifyingSpecialties(base, 'coast-guard')).toEqual(
      specialtiesOf('coast-guard').map((s) => s.id),
    );
    const modest = withStats(base, { smarts: 41, health: 60, discipline: 49 });
    expect(qualifyingSpecialties(modest, 'army')).toEqual([
      'army.infantry',
      'army.medic',
      'army.mechanic',
    ]);
    expect(qualifyingSpecialties(modest, 'navy')).toEqual(['navy.boatswain', 'navy.machinist']);
    expect(qualifyingSpecialties(modest, 'marine-corps')).toEqual([
      'marine-corps.rifleman',
      'marine-corps.engineer',
      'marine-corps.motor',
    ]);
    expect(qualifyingSpecialties(modest, 'air-force')).toEqual([
      'air-force.logistics',
      'air-force.maintenance',
    ]);
    expect(qualifyingSpecialties(modest, 'coast-guard')).toEqual(['coast-guard.boatswain']);
    expect(
      qualifyingSpecialties(withStats(base, { smarts: 0, health: 0, discipline: 0 }), 'navy'),
    ).toEqual(['navy.boatswain']);
  });
});

describe('applying with a branch, a job and a ladder', () => {
  const base = eligible(adult('MIL2-APPLY', 26));
  const grad = graduate(adult('MIL2-APPLY', 26));

  it('enlists in the Army’s open job when only the defaults are given, as 0901 did', () => {
    const result = applyToEnlist(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const career = result.value.state.military.service!;
    expect(career).toMatchObject({
      branch: 'army',
      track: 'enlisted',
      specialty: 'army.infantry',
      stage: 'training',
      grade: 1,
      years: 0,
      commissionedAt: 0,
      termEnds: TERM_YEARS,
      performance: 50,
      reputation: 50,
      effort: 'normal',
      lastPay: 0,
      enlistedAge: 26,
    });
    expect(row('army').posts).toContain(career.post);
    expect(result.value.state.military.appliedAge).toBe(26);
    expect(result.value.entry.kind).toBe('milestone');
    expect(result.value.entry.text).toBe(
      'You enlisted in the Army. Basic training is next, and after that your first post.',
    );
    expect(result.value.state.player.records.at(-1)?.label).toBe('Enlisted — Army');
  });

  it('enlists in each other branch, in the job asked for, and says so in the branch’s own words', () => {
    const cases: [string, string, string, string, string][] = [
      ['navy', 'navy.corpsman', 'the Navy', 'Boot camp', 'Navy'],
      ['marine-corps', 'marine-corps.radio', 'the Marine Corps', 'Boot camp', 'Marine Corps'],
      ['air-force', 'air-force.cyber', 'the Air Force', 'Basic military training', 'Air Force'],
      ['coast-guard', 'coast-guard.health', 'the Coast Guard', 'Boot camp', 'Coast Guard'],
    ];
    for (const [branch, job, name, training, short] of cases) {
      const result = applyToEnlist(base, branch as never, job);
      expect(result.ok, branch).toBe(true);
      if (!result.ok) continue;
      const career = result.value.state.military.service!;
      expect(career.branch).toBe(branch);
      expect(career.specialty).toBe(job);
      expect(career.track).toBe('enlisted');
      expect(row(branch).posts).toContain(career.post);
      expect(result.value.entry.text).toBe(
        `You enlisted in ${name}. ${training} is next, and after that your first post.`,
      );
      expect(result.value.state.player.records.at(-1)?.label).toBe(`Enlisted — ${short}`);
      expect(branchNameOf(branch as never)).toBe(name);
    }
  });

  it('puts a graduate in officer training when they ask for a commission, at the bottom officer grade', () => {
    const cases: [string, string, string, string][] = [
      ['army', 'army.signal', 'Officer Candidate School', 'Army'],
      ['air-force', 'air-force.cyber', 'Officer Training School', 'Air Force'],
      ['marine-corps', 'marine-corps.rifleman', 'Officer Candidates School', 'Marine Corps'],
    ];
    for (const [branch, job, school, short] of cases) {
      const result = applyToEnlist(grad, branch as never, job, 'officer');
      expect(result.ok, branch).toBe(true);
      if (!result.ok) continue;
      const career = result.value.state.military.service!;
      expect(career).toMatchObject({
        track: 'officer',
        stage: 'training',
        grade: 1,
        years: 0,
        commissionedAt: 0,
      });
      expect(career.prior).toBeUndefined();
      expect(result.value.entry.text).toBe(
        `You were accepted to ${school} in the ${short}. A commission is the end of it, if you finish.`,
      );
      expect(result.value.state.player.records.at(-1)?.label).toBe(`Officer training — ${short}`);
    }
  });

  it('turns away what it should, with the reason', () => {
    const error = (r: ReturnType<typeof applyToEnlist>) => (r.ok ? 'ok' : r.error);
    expect(error(applyToEnlist(base, 'space-force' as never))).toBe('no-such-branch');
    expect(error(applyToEnlist(base, 'navy', 'army.infantry'))).toBe('no-such-specialty');
    expect(error(applyToEnlist(base, 'navy', 'navy.cook'))).toBe('no-such-specialty');
    expect(error(applyToEnlist(withStats(base, { smarts: 45 }), 'army', 'army.signal'))).toBe(
      'specialty-bar',
    );
    expect(error(applyToEnlist(withStats(base, { smarts: 50 }), 'army', 'army.signal'))).toBe('ok');
    expect(error(applyToEnlist(base, 'army', undefined, 'officer'))).toBe('no-degree');
    expect(error(applyToEnlist(withAge(base, 29), 'marine-corps'))).toBe('too-old');
    expect(error(applyToEnlist(withStats(base, { smarts: 35 }), 'coast-guard'))).toBe('not-ready');
    expect(error(applyToEnlist(serving(base)))).toBe('serving');
  });

  it('takes one visit a year, and none while a question is standing, from any field', () => {
    const visited = applyToEnlist({
      ...base,
      military: { past: [], appliedAge: 26 },
    });
    expect(visited.ok).toBe(false);
    if (!visited.ok) expect(visited.error).toBe('already-applied');
    const lastYear = applyToEnlist({ ...base, military: { past: [], appliedAge: 25 } });
    expect(lastYear.ok).toBe(true);
    const standing: Partial<GameState>[] = [
      {
        military: {
          past: [],
          offer: {
            kind: 'enlist',
            age: 26,
            eventId: MILITARY_OFFER_EVENT_ID,
            step: 'branch',
            options: ['army'],
          },
        },
      },
      { acting: { ...base.acting, offers: [{} as never] } },
      { music: { ...base.music, offer: {} as never } },
      { modeling: { ...base.modeling, offers: [{} as never] } },
      { sports: { ...base.sports, offer: {} as never } },
    ];
    for (const patch of standing) {
      const result = applyToEnlist({ ...base, ...patch } as GameState);
      expect(result.ok, JSON.stringify(Object.keys(patch))).toBe(false);
      if (!result.ok) expect(result.error).toBe('offer-pending');
    }
    expect(applyToEnlist(base).ok).toBe(true);
  });

  it('says each new refusal in words', () => {
    expect(ENLIST_ERROR_LABELS['no-degree']).toBe(
      "A commission takes a bachelor's degree, and you don't have one.",
    );
    expect(ENLIST_ERROR_LABELS['no-such-branch']).toBe("That isn't a branch.");
    expect(ENLIST_ERROR_LABELS['no-such-specialty']).toBe("That job isn't one that branch has.");
    expect(ENLIST_ERROR_LABELS['specialty-bar']).toBe("You don't qualify for that job yet.");
    expect(ENLIST_ERROR_LABELS['too-old']).toBe("You're too old for that branch.");
  });
});

/* -------------------------------------------------------------------------- */
/* The recruiter's table, in steps                                             */
/* -------------------------------------------------------------------------- */

describe('the recruiter’s offer, in steps', () => {
  const base = eligible(adult('MIL2-STEPS', 26));
  const grad = graduate(adult('MIL2-STEPS', 26));
  const FIVE = ['army', 'navy', 'marine-corps', 'air-force', 'coast-guard'];

  const asked = (state: GameState, offer: MilitaryOffer): GameState =>
    withMilitaryOffer({ ...state, military: { ...state.military, offer } }, true);

  const branchOffer = (age = 22): MilitaryOffer => ({
    kind: 'enlist',
    age,
    eventId: MILITARY_OFFER_EVENT_ID,
    intro: true,
    step: 'branch',
    options: FIVE as never,
  });

  const pendingMilitary = (state: GameState) =>
    state.pending.filter((row) => row.eventId === MILITARY_OFFER_EVENT_ID);

  it('is raised as the branch question, with the recruiter’s own words in front, whoever is raised it', () => {
    for (const person of [base, grad]) {
      const lucky = seedWhere(withAge(person, 22), ['offer', 22], (u) => u < 0.022);
      const out = yearOf(withAge(lucky, 21), 22, 2031);
      expect(out.military.offer).toEqual({
        kind: 'enlist',
        age: 22,
        eventId: MILITARY_OFFER_EVENT_ID,
        intro: true,
        step: 'branch',
        options: FIVE,
      });
    }
  });

  it('offers only the branches whose door the person fits through', () => {
    const lucky = seedWhere(withAge(base, 29), ['offer', 29], (u) => u < 0.01);
    const out = yearOf(withAge(lucky, 28), 29, 2031);
    expect(out.military.offer).toMatchObject({
      step: 'branch',
      options: ['army', 'navy', 'air-force', 'coast-guard'],
    });
  });

  it('asks the branch question with a choice for each branch and a way to say no', () => {
    const decision = militaryOfferDecision(branchOffer(), 2031);
    expect(decision.choices).toEqual([
      { id: 'army', label: 'Army' },
      { id: 'navy', label: 'Navy' },
      { id: 'marine-corps', label: 'Marine Corps' },
      { id: 'air-force', label: 'Air Force' },
      { id: 'coast-guard', label: 'Coast Guard' },
      { id: MILITARY_DECLINE, label: 'Not for me' },
    ]);
    expect(decision.prompt).toMatch(/recruiter|recruiting/i);
    expect(decision.prompt).toMatch(/service|branch/i);
    expect(decision.prompt).not.toContain('%');
    expect(decision.age).toBe(22);
    expect(decision.year).toBe(2031);
    expect(decision.category).toBe('career');
  });

  it('walks an enlisted choice: a branch, then a job, then a recruit in uniform', () => {
    const first = asked(base, branchOffer());
    const toNavy = answerMilitaryOffer(first, 'navy');
    expect(toNavy.ok).toBe(true);
    if (!toNavy.ok) return;
    const second = toNavy.value.state;
    expect(second.military.offer).toEqual({
      kind: 'enlist',
      age: 22,
      eventId: MILITARY_OFFER_EVENT_ID,
      step: 'specialty',
      branch: 'navy',
      track: 'enlisted',
      options: specialtiesOf('navy').map((s) => s.id),
    });
    expect(second.military.service).toBeUndefined();
    expect(pendingMilitary(second)).toHaveLength(1);
    expect(hasSystemicOffer(second)).toBe(true);
    expect(toNavy.value.entry.kind).toBe('passive');
    expect(toNavy.value.entry.text).toBe('You asked the Navy recruiter what they had.');
    const decision = pendingMilitary(second)[0]!;
    expect(decision.choices.map((c) => c.label)).toEqual([
      "Boatswain's Mate",
      'Hospital Corpsman',
      "Machinist's Mate",
      'Information Systems Technician',
      'Aviation Mechanic',
      'Not for me',
    ]);
    expect(decision.prompt).toContain('the Navy');
    expect(decision.prompt).not.toContain('%');
    expect(decision.prompt).not.toMatch(/recruiter has been in touch/i);
    const done = answerMilitaryOffer(second, 'navy.corpsman');
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.state.military.service).toMatchObject({
      branch: 'navy',
      track: 'enlisted',
      specialty: 'navy.corpsman',
      stage: 'training',
    });
    expect(done.value.state.military.offer).toBeUndefined();
    expect(pendingMilitary(done.value.state)).toHaveLength(0);
    expect(done.value.entry.kind).toBe('milestone');
  });

  it('asks a graduate which ladder, and goes on to the job on whichever they pick', () => {
    const toNavy = answerMilitaryOffer(asked(grad, branchOffer()), 'navy');
    if (!toNavy.ok) throw new Error('should answer');
    const second = toNavy.value.state;
    expect(second.military.offer).toEqual({
      kind: 'enlist',
      age: 22,
      eventId: MILITARY_OFFER_EVENT_ID,
      step: 'track',
      branch: 'navy',
      options: ['enlisted', 'officer'],
    });
    const decision = pendingMilitary(second)[0]!;
    expect(decision.choices).toEqual([
      { id: 'enlisted', label: 'Enlist' },
      { id: 'officer', label: 'Apply for a commission' },
      { id: MILITARY_DECLINE, label: 'Not for me' },
    ]);
    expect(decision.prompt).toMatch(/degree/i);
    expect(decision.prompt).not.toContain('%');

    const officer = answerMilitaryOffer(second, 'officer');
    if (!officer.ok) throw new Error('should answer');
    expect(officer.value.entry.text).toBe('You asked about a commission.');
    expect(officer.value.state.military.offer).toMatchObject({
      step: 'specialty',
      branch: 'navy',
      track: 'officer',
    });
    const commissioned = answerMilitaryOffer(officer.value.state, 'navy.systems');
    if (!commissioned.ok) throw new Error('should answer');
    expect(commissioned.value.state.military.service).toMatchObject({
      branch: 'navy',
      track: 'officer',
      specialty: 'navy.systems',
      grade: 1,
      stage: 'training',
    });
    expect(commissioned.value.entry.text).toContain('Officer Candidate School in the Navy');

    const enlisted = answerMilitaryOffer(second, 'enlisted');
    if (!enlisted.ok) throw new Error('should answer');
    expect(enlisted.value.entry.text).toBe('You said you would enlist.');
    expect(enlisted.value.state.military.offer).toMatchObject({
      step: 'specialty',
      track: 'enlisted',
    });
  });

  it('skips the ladder for a graduate too old to be commissioned in the branch they chose', () => {
    const old = withAge(grad, 34);
    const answered = answerMilitaryOffer(asked(old, branchOffer(34)), 'army');
    if (!answered.ok) throw new Error('should answer');
    expect(answered.value.state.military.offer).toMatchObject({
      step: 'specialty',
      branch: 'army',
      track: 'enlisted',
    });
  });

  it('skips the ladder for somebody with no degree, and lists only the jobs they qualify for', () => {
    const modest = withStats(base, { smarts: 41, health: 60, discipline: 49 });
    const answered = answerMilitaryOffer(asked(modest, branchOffer()), 'army');
    if (!answered.ok) throw new Error('should answer');
    expect(answered.value.state.military.offer).toMatchObject({
      step: 'specialty',
      track: 'enlisted',
      options: ['army.infantry', 'army.medic', 'army.mechanic'],
    });
  });

  it('lets the person say no at any step, and remembers the age it was asked at', () => {
    const steps: MilitaryOffer[] = [
      branchOffer(23),
      {
        kind: 'enlist',
        age: 23,
        eventId: MILITARY_OFFER_EVENT_ID,
        step: 'track',
        branch: 'navy',
        options: ['enlisted', 'officer'],
      },
      {
        kind: 'enlist',
        age: 23,
        eventId: MILITARY_OFFER_EVENT_ID,
        step: 'specialty',
        branch: 'navy',
        track: 'enlisted',
        options: ['navy.boatswain'],
      },
    ];
    for (const offer of steps) {
      const answered = answerMilitaryOffer(asked(base, offer), MILITARY_DECLINE);
      if (!answered.ok) throw new Error('should answer');
      expect(
        answered.value.state.military.service,
        offer.kind + (offer as { step: string }).step,
      ).toBeUndefined();
      expect(answered.value.state.military.turnedDownAge).toBe(23);
      expect(answered.value.state.military.offer).toBeUndefined();
      expect(pendingMilitary(answered.value.state)).toHaveLength(0);
      expect(answered.value.entry.kind).toBe('passive');
      expect(answered.value.entry.text).toBe('You told the recruiter no thanks.');
    }
  });

  it('refuses an answer the step never offered: a branch not on the list, or a job at the branch question', () => {
    const short = {
      ...(branchOffer() as object),
      options: ['army', 'navy'],
    } as unknown as MilitaryOffer;
    const out = answerMilitaryOffer(asked(base, short), 'marine-corps');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('no-such-choice');
    expect(answerMilitaryOffer(asked(base, short), 'army.infantry').ok).toBe(false);
    expect(answerMilitaryOffer(asked(base, short), 'officer').ok).toBe(false);
    const job: MilitaryOffer = {
      kind: 'enlist',
      age: 22,
      eventId: MILITARY_OFFER_EVENT_ID,
      step: 'specialty',
      branch: 'navy',
      track: 'enlisted',
      options: ['navy.boatswain'],
    };
    expect(answerMilitaryOffer(asked(base, job), 'navy.corpsman').ok).toBe(false);
    expect(answerMilitaryOffer(asked(base, job), 'navy').ok).toBe(false);
    expect(answerMilitaryOffer(asked(base, job), 'navy.boatswain').ok).toBe(true);
  });

  it('is answered through the same door as every other question, a step at a time', () => {
    let state = asked(base, branchOffer());
    const first = decide(state, MILITARY_OFFER_EVENT_ID, 'air-force');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.value.state;
    expect(pendingMilitary(state)).toHaveLength(1);
    expect(state.military.offer).toMatchObject({ step: 'specialty', branch: 'air-force' });
    const second = decide(state, MILITARY_OFFER_EVENT_ID, 'air-force.logistics');
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.state.military.service?.specialty).toBe('air-force.logistics');
    expect(pendingMilitary(second.value.state)).toHaveLength(0);
  });

  it('is declined by the ordinary-life harness at every step', () => {
    const steps: MilitaryOffer[] = [
      branchOffer(),
      {
        kind: 'enlist',
        age: 22,
        eventId: MILITARY_OFFER_EVENT_ID,
        step: 'track',
        branch: 'navy',
        options: ['enlisted', 'officer'],
      },
      {
        kind: 'enlist',
        age: 22,
        eventId: MILITARY_OFFER_EVENT_ID,
        step: 'specialty',
        branch: 'navy',
        track: 'officer',
        options: ['navy.boatswain'],
      },
    ];
    for (const offer of steps) {
      expect(ordinaryChoice(militaryOfferDecision(offer, 2031))?.id).toBe(MILITARY_DECLINE);
    }
  });

  it('opens with the recruiter’s words only on the first question', () => {
    const intro = militaryOfferDecision(branchOffer(), 2031).prompt;
    const plain = militaryOfferDecision(
      { ...(branchOffer() as object), intro: undefined } as MilitaryOffer,
      2031,
    ).prompt;
    expect(intro.length).toBeGreaterThan(plain.length);
    expect(intro.endsWith(plain)).toBe(true);
    expect(plain).not.toMatch(
      /recruiter has been in touch|recruiting office called|sat down across/i,
    );
  });
});

describe('a term’s question', () => {
  const base = eligible(adult('MIL2-TERM', 26));
  const reenlist = (patch: Partial<Extract<MilitaryOffer, { kind: 'reenlist' }>> = {}) =>
    ({
      kind: 'reenlist',
      branch: 'navy',
      track: 'enlisted',
      grade: 5,
      years: 8,
      age: 27,
      eventId: MILITARY_OFFER_EVENT_ID,
      ...patch,
    }) as MilitaryOffer;
  const asked = (state: GameState, offer: MilitaryOffer): GameState =>
    withMilitaryOffer({ ...state, military: { ...state.military, offer } }, true);

  it('asks somebody under twenty years to stay or leave, in the branch’s own words', () => {
    const decision = militaryOfferDecision(reenlist(), 2031);
    expect(decision.choices).toEqual([
      { id: MILITARY_REENLIST, label: 'Stay 4 more years' },
      { id: MILITARY_LEAVE, label: 'Leave the Navy' },
    ]);
    expect(decision.prompt).toContain('You are a petty officer second class with 8 years in.');
    expect(decision.prompt).not.toContain('%');
    expect(
      militaryOfferDecision(reenlist({ branch: 'marine-corps' }), 2031).choices[1]!.label,
    ).toBe('Leave the Marine Corps');
  });

  it('asks somebody with twenty years in to stay or retire', () => {
    const decision = militaryOfferDecision(reenlist({ years: 20, grade: 7 }), 2031);
    expect(decision.choices).toEqual([
      { id: MILITARY_REENLIST, label: 'Stay 4 more years' },
      { id: MILITARY_LEAVE, label: 'Retire' },
    ]);
    expect(decision.prompt).toMatch(/twenty years/i);
    expect(decision.prompt).toMatch(/retire/i);
    expect(decision.prompt).toContain('You are a chief petty officer with 20 years in.');
    const nineteen = militaryOfferDecision(reenlist({ years: 19 }), 2031);
    expect(nineteen.choices[1]!.label).toBe('Leave the Navy');
    expect(nineteen.prompt).not.toMatch(/twenty years/i);
  });

  it('reads an officer’s title and an old save’s offer, which had no ladder, as enlisted', () => {
    const officer = militaryOfferDecision(
      reenlist({ track: 'officer', grade: 3, branch: 'navy' }),
      2031,
    );
    expect(officer.prompt).toContain('You are a lieutenant with 8 years in.');
    const old = { ...(reenlist() as object) } as Record<string, unknown>;
    delete old['track'];
    expect(militaryOfferDecision(old as unknown as MilitaryOffer, 2031).prompt).toContain(
      'petty officer second class',
    );
  });

  it('retires somebody with twenty years in who says leave, and lets somebody short of it go with a term', () => {
    const career = serviceRow({
      branch: 'navy',
      specialty: 'navy.boatswain',
      grade: 7,
      years: 20,
      termEnds: 20,
    });
    const state = asked(
      { ...base, military: { ...base.military, service: career } },
      reenlist({ years: 20, grade: 7 }),
    );
    const out = answerMilitaryOffer(state, MILITARY_LEAVE);
    if (!out.ok) throw new Error('should answer');
    expect(out.value.state.military.service).toBeUndefined();
    expect(out.value.state.military.past[0]).toMatchObject({
      branch: 'navy',
      track: 'enlisted',
      specialty: 'navy.boatswain',
      finalGrade: 7,
      years: 20,
      how: 'retired',
      discharge: 'honorable',
      endedAge: base.player.age,
    });
    expect(out.value.entry.text).toMatch(/20 years/);
    expect(out.value.entry.text).toContain('Chief Petty Officer');
    expect(out.value.state.player.records.at(-1)?.label).toBe(
      'Retired from the Navy — Chief Petty Officer',
    );

    const early = asked(
      {
        ...base,
        military: {
          ...base.military,
          service: serviceRow({
            branch: 'navy',
            specialty: 'navy.boatswain',
            grade: 5,
            years: 8,
            termEnds: 8,
          }),
        },
      },
      reenlist(),
    );
    const left = answerMilitaryOffer(early, MILITARY_LEAVE);
    if (!left.ok) throw new Error('should answer');
    expect(left.value.state.military.past[0]).toMatchObject({
      how: 'term',
      years: 8,
      finalGrade: 5,
    });
    expect(left.value.state.player.records.at(-1)?.label).toBe(
      'Left the Navy — Petty Officer Second Class',
    );
    expect(left.value.entry.text).toContain('Petty Officer Second Class');
    expect(left.value.entry.text).not.toMatch(/years/);
  });

  it('adds another four years to the term on yes, for an officer as for anyone', () => {
    const career = officerRow({ grade: 4, years: 12, termEnds: 12, commissionedAt: 0 });
    const state = asked(
      { ...base, military: { ...base.military, service: career } },
      reenlist({ track: 'officer', branch: 'army', grade: 4, years: 12 }),
    );
    const out = answerMilitaryOffer(state, MILITARY_REENLIST);
    if (!out.ok) throw new Error('should answer');
    expect(out.value.state.military.service?.termEnds).toBe(16);
    expect(out.value.state.military.service?.track).toBe('officer');
    expect(out.value.entry.text).toBe('You signed up for 4 more years as a major.');
  });

  it('adds the four years to where the term ended, not to the day the question was answered', () => {
    const career = officerRow({ grade: 4, years: 13, termEnds: 12, commissionedAt: 0 });
    const state = asked(
      { ...base, military: { ...base.military, service: career } },
      reenlist({ track: 'officer', branch: 'army', grade: 4, years: 13 }),
    );
    const out = answerMilitaryOffer(state, MILITARY_REENLIST);
    if (!out.ok) throw new Error('should answer');
    expect(out.value.state.military.service?.termEnds).toBe(16);
  });
});

/* -------------------------------------------------------------------------- */
/* Officer training                                                            */
/* -------------------------------------------------------------------------- */

describe('officer training', () => {
  const base = eligible(adult('MIL2-OCS', 26));
  const age = 27;
  const cadet = (patch: Partial<ServiceCareer> = {}) =>
    officering(base, { stage: 'training', grade: 1, years: 0, termEnds: 4, ...patch });
  const prior = (patch: Partial<ServiceCareer> = {}) =>
    cadet({
      years: 6,
      commissionedAt: 6,
      termEnds: 10,
      prior: { grade: 5, termEnds: 8 },
      enlistedAge: 20,
      branch: 'army',
      ...patch,
    });
  const finishes = (state: GameState) => seedWhere(state, ['ocs', age], (u) => u >= 0.25);
  const fails = (state: GameState) => seedWhere(state, ['ocs', age], (u) => u < 0.02);

  it('is a year of officer pay at the bottom grade, and ends in a commission', () => {
    const out = yearOf(finishes(cadet()), age);
    expect(out.left).toBe(false);
    expect(out.military.service).toMatchObject({
      track: 'officer',
      stage: 'serving',
      grade: 1,
      years: 1,
      commissionedAt: 0,
    });
    expect(out.pay).toBe(annualBasePay(1, 0, 'officer'));
    expect(out.pay).toBe(49802);
    expect(out.statDeltas).toEqual({ discipline: 2, smarts: 1 });
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]!.kind).toBe('milestone');
    expect(out.lines[0]!.text).not.toContain('%');
    expect(out.lines[0]!.text).toMatch(/Officer Candidate School|second lieutenant/);
  });

  it('says the school and the title in the branch’s own words', () => {
    const navy = yearOf(finishes(cadet({ branch: 'navy', specialty: 'navy.systems' })), age);
    const text = navy.lines[0]!.text;
    expect(text).not.toContain('%');
    expect(text).not.toMatch(/second lieutenant/);
    const air = yearOf(finishes(cadet({ branch: 'air-force', specialty: 'air-force.cyber' })), age);
    expect(air.lines[0]!.text).not.toContain('%');
  });

  it('can end a direct candidate’s career at once, with half a year of officer pay and an entry-level separation', () => {
    const out = yearOf(fails(cadet()), age);
    expect(out.left).toBe(true);
    expect(out.military.service).toBeUndefined();
    expect(out.pay).toBe(officerWashOutPay(0));
    expect(out.pay).toBe(24901);
    expect(out.mood).toBe(-6);
    expect(out.military.past.at(-1)).toMatchObject({
      track: 'officer',
      how: 'washed-out',
      discharge: 'entry-level',
      finalGrade: 1,
      years: 0,
    });
    expect(out.records).toEqual([
      { category: 'military', label: 'Did not finish officer training' },
    ]);
    expect(out.lines[0]!.text).not.toContain('%');
  });

  it('sends an enlisted member who does not finish back to the ranks exactly as they were, a year older', () => {
    const out = yearOf(fails(prior()), age);
    expect(out.left).toBe(false);
    const back = out.military.service!;
    expect(back).toMatchObject({
      track: 'enlisted',
      stage: 'serving',
      grade: 5,
      termEnds: 8,
      years: 7,
      commissionedAt: 0,
      specialty: 'army.infantry',
    });
    expect(back.prior).toBeUndefined();
    expect(out.pay).toBe(annualBasePay(5, 6, 'enlisted'));
    expect(out.mood).toBe(-3);
    expect(out.military.past).toEqual([]);
    expect(out.records).toEqual([]);
    expect(out.lines[0]!.text).toContain('Sergeant');
    expect(out.lines[0]!.text).not.toContain('%');
  });

  it('commissions an enlisted member who finishes, on all their years, and drops what they were', () => {
    const out = yearOf(finishes(prior()), age);
    const officer = out.military.service!;
    expect(officer).toMatchObject({
      track: 'officer',
      stage: 'serving',
      grade: 1,
      years: 7,
      commissionedAt: 6,
      termEnds: 10,
    });
    expect(officer.prior).toBeUndefined();
    // Paid as what they were while they trained.
    expect(out.pay).toBe(annualBasePay(5, 6, 'enlisted'));
  });

  it('washes out at the chance the fit gives, held between 2% and 25%', () => {
    expect(officerWashOutChance(58)).toBeCloseTo(0.08);
    expect(officerWashOutChance(0)).toBe(0.25);
    expect(officerWashOutChance(100)).toBe(0.02);
    // A seed just under the chance fails and one just over finishes, for the stats the fixture has.
    const stats = base.player.stats;
    const chance = officerWashOutChance(serviceFit(stats.discipline, stats.health, stats.smarts));
    const under = seedWhere(cadet(), ['ocs', age], (u) => u < chance - 0.01 && u > chance - 0.03);
    const over = seedWhere(cadet(), ['ocs', age], (u) => u > chance + 0.01 && u < chance + 0.03);
    expect(yearOf(under, age).left).toBe(true);
    expect(yearOf(over, age).left).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Officer promotion                                                           */
/* -------------------------------------------------------------------------- */

describe('officer promotion', () => {
  const base = eligible(adult('MIL2-RISE', 30));
  const age = 31;
  const stats = base.player.stats;
  const target = servicePerformanceTarget(false, stats.discipline, stats.smarts, stats.health);
  const after = (performance: number) => performanceYear(performance, target);
  const offerCareer = (patch: Partial<ServiceCareer>) =>
    officering(base, { termEnds: 99, performance: 60, ...patch });
  const rose = (state: GameState) => yearOf(state, age).military.service?.grade;

  it('rises into the first two grades on time, always', () => {
    expect(rose(offerCareer({ grade: 1, years: 1 }))).toBe(2);
    expect(rose(offerCareer({ grade: 1, years: 0 }))).toBe(1);
    expect(rose(offerCareer({ grade: 2, years: 3 }))).toBe(3);
    expect(rose(offerCareer({ grade: 2, years: 2 }))).toBe(2);
  });

  it('counts commissioned years for the rise and total years for the pay', () => {
    // Six years as enlisted first: only one commissioned year is behind the member.
    expect(rose(offerCareer({ grade: 1, years: 6, commissionedAt: 6 }))).toBe(1);
    expect(rose(offerCareer({ grade: 1, years: 7, commissionedAt: 6 }))).toBe(2);
    const out = yearOf(offerCareer({ grade: 1, years: 7, commissionedAt: 6 }), age);
    expect(out.pay).toBe(annualBasePay(1, 7, 'officer'));
  });

  it('is chancier from captain on, at the chance performance gives, after ten years', () => {
    const state = offerCareer({ grade: 3, years: 9 });
    const chance = officerRiseChance(4, after(60));
    expect(chance).toBeGreaterThan(0.1);
    expect(chance).toBeLessThan(0.9);
    const lucky = seedWhere(state, ['orise', age, 4], (u) => u < chance - 0.03);
    const unlucky = seedWhere(state, ['orise', age, 4], (u) => u > chance + 0.03);
    expect(rose(lucky)).toBe(4);
    expect(rose(unlucky)).toBe(3);
    // A year early, even a lucky draw does not rise.
    const early = seedWhere(
      offerCareer({ grade: 3, years: 8 }),
      ['orise', age, 4],
      (u) => u < chance - 0.03,
    );
    expect(rose(early)).toBe(3);
  });

  it('records a rise to captain and above, and says it in the branch’s words', () => {
    const state = offerCareer({ grade: 3, years: 9 });
    const chance = officerRiseChance(4, after(60));
    const lucky = seedWhere(state, ['orise', age, 4], (u) => u < chance - 0.03);
    const out = yearOf(lucky, age);
    expect(out.records).toEqual([{ category: 'military', label: 'Promoted — Major' }]);
    expect(out.lines[0]!.kind).toBe('milestone');
    expect(out.lines[0]!.text).toContain('Major');
    expect(out.lines[0]!.text).not.toContain('%');
    expect(out.mood).toBe(2);
    const second = offerCareer({ grade: 1, years: 1 });
    expect(yearOf(second, age).records).toEqual([]);
    // The rise into captain is on the record too, and the one into first lieutenant is not.
    const third = yearOf(offerCareer({ grade: 2, years: 3 }), age);
    expect(third.military.service?.grade).toBe(3);
    expect(third.records).toEqual([{ category: 'military', label: 'Promoted — Captain' }]);
  });

  it('reads the performance the year ended with, not a fixed 60, when it draws a rise', () => {
    const state = offerCareer({ grade: 3, years: 9, performance: 95 });
    const flat = officerRiseChance(4, 60);
    const real = officerRiseChance(4, after(95));
    expect(real).toBeGreaterThan(flat + 0.1);
    const between = seedWhere(state, ['orise', age, 4], (u) => u > flat + 0.03 && u < real - 0.03);
    expect(rose(between)).toBe(4);
    const above = seedWhere(state, ['orise', age, 4], (u) => u > real + 0.03);
    expect(rose(above)).toBe(3);
  });

  it('scales the rise with performance, and tops out at O-6', () => {
    expect(officerRiseChance(4, 90)).toBeGreaterThan(officerRiseChance(4, 60));
    expect(officerRiseChance(4, 30)).toBeLessThan(officerRiseChance(4, 60));
    expect(rose(offerCareer({ grade: 6, years: 40, commissionedAt: 0 }))).toBe(6);
  });

  it('makes a lieutenant twice passed over leave, a retiree if twenty years are in', () => {
    const unlucky = (state: GameState) =>
      seedWhere(state, ['orise', age, 4], (u) => u > officerRiseChance(4, 99) + 0.01);
    // Thirteen commissioned years at O-3 and under twenty in all: passed over.
    const stalled = unlucky(offerCareer({ grade: 3, years: 12, commissionedAt: 0 }));
    const out = yearOf(stalled, age);
    expect(out.left).toBe(true);
    expect(out.military.service).toBeUndefined();
    expect(out.military.past.at(-1)).toMatchObject({
      how: 'passed-over',
      discharge: 'honorable',
      finalGrade: 3,
      track: 'officer',
    });
    expect(out.records).toEqual([{ category: 'military', label: 'Left the Army — Captain' }]);
    expect(out.lines.at(-1)!.text).not.toContain('%');
    expect(out.mood).toBe(-2);
    // One year before, the officer is still serving.
    const early = unlucky(offerCareer({ grade: 3, years: 11, commissionedAt: 0 }));
    expect(yearOf(early, age).left).toBe(false);
    // With the commissioned count at 13 and total at 20, it is a retirement.
    const old = unlucky(offerCareer({ grade: 3, years: 19, commissionedAt: 7 }));
    const retired = yearOf(old, age);
    expect(retired.military.past.at(-1)).toMatchObject({ how: 'retired', years: 20 });
    expect(retired.records[0]!.label).toBe('Retired from the Army — Captain');
    // 12 commissioned and 19 total is not yet either.
    const not = unlucky(offerCareer({ grade: 3, years: 18, commissionedAt: 7 }));
    expect(yearOf(not, age).left).toBe(false);
    // Total years 19, commissioned 13: passed over, not retired.
    const nineteen = unlucky(offerCareer({ grade: 3, years: 18, commissionedAt: 6 }));
    expect(yearOf(nineteen, age).military.past.at(-1)?.how).toBe('passed-over');
  });

  it('lets an officer a board passed over for major stay, and does not apply the rule to the grades above', () => {
    expect(O3_PASS_OVER_YEARS).toBe(13);
    const major = offerCareer({ grade: 4, years: 14, commissionedAt: 0 });
    expect(yearOf(major, age).left).toBe(false);
    expect(OFFICER_GRADES.map((g) => g.grade)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

/* -------------------------------------------------------------------------- */
/* 65, and twenty years                                                        */
/* -------------------------------------------------------------------------- */

describe('the end of a career', () => {
  const base = eligible(adult('MIL2-END', 40));

  it('stops at 65, for an enlisted member and an officer alike', () => {
    expect(MANDATORY_RETIRE_AGE).toBe(65);
    const sergeant = serving(base, { grade: 9, years: 40, termEnds: 60 });
    const out = yearOf(sergeant, 65);
    expect(out.left).toBe(true);
    expect(out.military.past.at(-1)).toMatchObject({ how: 'retired', finalGrade: 9, years: 41 });
    expect(out.records).toEqual([
      { category: 'military', label: 'Retired from the Army — Sergeant Major' },
    ]);
    expect(out.lines.at(-1)!.text).not.toContain('%');
    expect(out.lines.at(-1)!.text).toMatch(/age|retire/i);
    expect(out.mood).toBe(2);
    const colonel = officering(base, { grade: 6, years: 40, termEnds: 60, commissionedAt: 10 });
    const officer = yearOf(colonel, 65);
    expect(officer.military.past.at(-1)).toMatchObject({ how: 'retired', track: 'officer' });
    expect(officer.records[0]!.label).toBe('Retired from the Army — Colonel');
    // The year before, they serve on.
    expect(yearOf(sergeant, 64).left).toBe(false);
    expect(yearOf(colonel, 64).left).toBe(false);
  });

  it('asks at twenty years whether to stay or retire, and not before', () => {
    const at = (years: number, patch: Partial<ServiceCareer> = {}) =>
      yearOf(
        serving(base, { grade: 7, years, termEnds: years + 1, performance: 80, ...patch }),
        45,
      );
    const twenty = at(19).military.offer;
    expect(twenty).toEqual({
      kind: 'reenlist',
      branch: 'army',
      track: 'enlisted',
      grade: 7,
      years: 20,
      age: 45,
      eventId: MILITARY_OFFER_EVENT_ID,
    });
    // Still a service member while the question stands.
    expect(at(19).military.service?.years).toBe(20);
    expect(at(18).military.offer).toMatchObject({ years: 19 });
    expect(at(10, { termEnds: 12 }).military.offer).toBeUndefined();
    const officer = yearOf(
      officering(base, { grade: 4, years: 19, termEnds: 20, performance: 80, commissionedAt: 5 }),
      45,
    );
    expect(officer.military.offer).toMatchObject({ kind: 'reenlist', track: 'officer', years: 20 });
  });

  it('does not ask twice, or while another question stands', () => {
    const pending = {
      ...serving(base, { grade: 7, years: 19, termEnds: 20, performance: 80 }),
    };
    const standing: MilitaryOffer = {
      kind: 'reenlist',
      branch: 'army',
      track: 'enlisted',
      grade: 7,
      years: 19,
      age: 44,
      eventId: MILITARY_OFFER_EVENT_ID,
    };
    const out = yearOf({ ...pending, military: { ...pending.military, offer: standing } }, 45);
    expect(out.military.offer).toEqual(standing);
  });

  it('retires somebody not asked to stay with twenty years in, and lets a first-term one go as not retained', () => {
    expect(30).toBeLessThan(RETAIN_PERFORMANCE_FLOOR);
    const poorStats = withStats(base, { discipline: 5, smarts: 5, health: 55 });
    const long = serving(poorStats, { grade: 7, years: 19, termEnds: 20, performance: 30 });
    const out = yearOf(long, 45);
    expect(out.military.past.at(-1)).toMatchObject({ how: 'retired', years: 20 });
    expect(out.records[0]!.label).toBe('Retired from the Army — Sergeant First Class');
    const short = serving(poorStats, { grade: 4, years: 3, termEnds: 4, performance: 30 });
    const gone = yearOf(short, 45);
    expect(gone.military.past.at(-1)).toMatchObject({ how: 'not-retained' });
    expect(gone.records[0]!.label).toBe('Left the Army — Specialist');
  });
});

describe('retiring by choice', () => {
  const base = eligible(adult('MIL2-RETIRE', 45));

  it('is turned away with nobody in uniform, in training, or short of twenty years', () => {
    const error = (r: ReturnType<typeof retireFromService>) => (r.ok ? 'ok' : r.error);
    expect(error(retireFromService(base))).toBe('not-serving');
    expect(error(retireFromService(serving(base, { stage: 'training', years: 25 })))).toBe(
      'too-soon',
    );
    expect(error(retireFromService(serving(base, { years: 19 })))).toBe('too-soon');
    expect(error(retireFromService(serving(base, { years: 0 })))).toBe('too-soon');
  });

  it('is open from the twentieth year, for any rank, with an honorable discharge', () => {
    expect(RETIRE_ELIGIBLE_YEARS).toBe(20);
    for (const years of [20, 27, 41]) {
      const result = retireFromService(serving(base, { grade: 8, years, termEnds: years + 2 }));
      expect(result.ok, String(years)).toBe(true);
      if (!result.ok) continue;
      const state = result.value.state;
      expect(state.military.service).toBeUndefined();
      expect(state.military.past.at(-1)).toMatchObject({
        how: 'retired',
        discharge: 'honorable',
        years,
        finalGrade: 8,
        endedAge: base.player.age,
      });
      expect(state.player.records.at(-1)?.label).toBe('Retired from the Army — Master Sergeant');
      expect(result.value.entry.text).toContain(`${years} years`);
      expect(result.value.entry.text).not.toContain('%');
    }
    const captain = retireFromService(
      officering(
        { ...base, military: { ...base.military } },
        {
          branch: 'navy',
          specialty: 'navy.systems',
          grade: 6,
          years: 26,
          termEnds: 28,
          commissionedAt: 4,
        },
      ),
    );
    expect(captain.ok).toBe(true);
    if (!captain.ok) return;
    expect(captain.value.state.player.records.at(-1)?.label).toBe(
      'Retired from the Navy — Captain',
    );
  });

  it('closes a standing term question when it takes the career', () => {
    const state = withMilitaryOffer(
      {
        ...serving(base, { grade: 7, years: 20, termEnds: 20 }),
        military: {
          past: [],
          service: serviceRow({ grade: 7, years: 20, termEnds: 20 }),
          offer: {
            kind: 'reenlist',
            branch: 'army',
            track: 'enlisted',
            grade: 7,
            years: 20,
            age: 45,
            eventId: MILITARY_OFFER_EVENT_ID,
          },
        },
      },
      true,
    );
    expect(state.pending.some((p) => p.eventId === MILITARY_OFFER_EVENT_ID)).toBe(true);
    const result = retireFromService(state);
    if (!result.ok) throw new Error('should retire');
    expect(result.value.state.military.offer).toBeUndefined();
    expect(result.value.state.pending.some((p) => p.eventId === MILITARY_OFFER_EVENT_ID)).toBe(
      false,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* A board for a commission                                                    */
/* -------------------------------------------------------------------------- */

describe('applying for a commission from the ranks', () => {
  const grad = graduate(adult('MIL2-BOARD', 27));
  const sergeant = (patch: Partial<ServiceCareer> = {}): GameState =>
    serving(grad, { grade: 5, years: 6, termEnds: 8, performance: 60, ...patch });
  const age = grad.player.age;
  const error = (r: ReturnType<typeof applyForCommission>) => (r.ok ? 'ok' : r.error);

  it('turns away what it should, in the order it reads them', () => {
    expect(error(applyForCommission(grad))).toBe('not-serving');
    expect(error(applyForCommission(officering(grad, { years: 5 })))).toBe('already-an-officer');
    expect(error(applyForCommission(serving(grad, { stage: 'training', years: 0 })))).toBe(
      'in-training',
    );
    expect(
      error(
        applyForCommission({
          ...sergeant(),
          military: { ...sergeant().military, commissionAppliedAge: age },
        }),
      ),
    ).toBe('already-applied');
    expect(
      error(
        applyForCommission({
          ...sergeant(),
          military: {
            ...sergeant().military,
            offer: {
              kind: 'reenlist',
              branch: 'army',
              track: 'enlisted',
              grade: 5,
              years: 6,
              age,
              eventId: MILITARY_OFFER_EVENT_ID,
            },
          },
        }),
      ),
    ).toBe('offer-pending');
    expect(
      error(
        applyForCommission({ ...sergeant(), music: { ...sergeant().music, offer: {} as never } }),
      ),
    ).toBe('offer-pending');
    expect(COMMISSION_BOARD_MIN_YEARS).toBe(1);
    expect(error(applyForCommission(sergeant({ years: 0 })))).toBe('too-soon');
    expect(error(applyForCommission(sergeant({ years: 1 })))).toBe('ok');
    expect(error(applyForCommission({ ...sergeant(), education: eligible(grad).education }))).toBe(
      'no-degree',
    );
    expect(error(applyForCommission(withAge(sergeant(), 34)))).toBe('too-old');
    expect(error(applyForCommission(withAge(sergeant(), 33)))).toBe('ok');
    expect(
      error(
        applyForCommission(
          withAge(sergeant({ branch: 'marine-corps', specialty: 'marine-corps.rifleman' }), 29),
        ),
      ),
    ).toBe('too-old');
    expect(error(applyForCommission(withStats(sergeant(), { health: 49 })))).toBe('unfit');
    expect(error(applyForCommission(withStats(sergeant(), { health: 50 })))).toBe('ok');
  });

  it('says each refusal in words', () => {
    expect(COMMISSION_ERROR_LABELS).toEqual({
      'not-serving': "You're not in uniform.",
      'already-an-officer': "You're an officer already.",
      'in-training': 'Finish your training first.',
      'too-soon': "You haven't served long enough for a board to look at you.",
      'no-degree': "A commission takes a bachelor's degree, and you don't have one.",
      'too-old': "You're too old for a commission in this branch.",
      unfit: "The physical turned you away. You're not well enough for this yet.",
      'already-applied': "You've already put in a package this year.",
      'offer-pending': 'There is a question waiting for you already.',
      deployed: "You're deployed. A board will wait.",
    });
  });

  it('is picked at the chance performance gives: 30% at 60, between 5% and 60%', () => {
    expect(commissionBoardChance(60)).toBeCloseTo(0.3);
    expect(commissionBoardChance(0)).toBe(0.05);
    expect(commissionBoardChance(100)).toBe(0.6);
    expect(commissionBoardChance(70)).toBeCloseTo(0.4);
    const lucky = seedWhere(sergeant(), ['board', age], (u) => u < 0.29);
    const unlucky = seedWhere(sergeant(), ['board', age], (u) => u > 0.31);
    expect(applyForCommission(lucky).ok && applyForCommission(lucky)).toMatchObject({
      value: { picked: true },
    });
    expect(applyForCommission(unlucky).ok && applyForCommission(unlucky)).toMatchObject({
      value: { picked: false },
    });
    // The edges: a poor record still has a chance, a great one is not certain.
    const poor = seedWhere(sergeant({ performance: 0 }), ['board', age], (u) => u < 0.04);
    const great = seedWhere(sergeant({ performance: 100 }), ['board', age], (u) => u > 0.61);
    expect(applyForCommission(poor)).toMatchObject({ value: { picked: true } });
    expect(applyForCommission(great)).toMatchObject({ value: { picked: false } });
    const justOver = seedWhere(
      sergeant({ performance: 0 }),
      ['board', age],
      (u) => u > 0.06 && u < 0.3,
    );
    expect(applyForCommission(justOver)).toMatchObject({ value: { picked: false } });
  });

  it('starts officer training for a pick, keeping what they were so a wash-out can send them back', () => {
    const lucky = seedWhere(sergeant(), ['board', age], (u) => u < 0.29);
    const result = applyForCommission(lucky);
    if (!result.ok) throw new Error('should apply');
    const state = result.value.state;
    expect(state.military.service).toMatchObject({
      track: 'officer',
      stage: 'training',
      grade: 1,
      years: 6,
      commissionedAt: 6,
      termEnds: 10,
      effort: 'normal',
      prior: { grade: 5, termEnds: 8 },
    });
    expect(state.military.commissionAppliedAge).toBe(age);
    expect(result.value.entry.kind).toBe('milestone');
    // Working harder as a sergeant does not carry into officer training.
    const hard = seedWhere(sergeant({ effort: 'hard' }), ['board', age], (u) => u < 0.29);
    const picked = applyForCommission(hard);
    if (!picked.ok) throw new Error('should apply');
    expect(picked.value.state.military.service?.effort).toBe('normal');
    expect(result.value.entry.text).not.toContain('%');
    expect(state.player.records.at(-1)?.label).toBe('Selected for officer training — Army');
    // One package a year.
    expect(error(applyForCommission(state))).toBe('already-an-officer');
  });

  it('leaves a pass as it was, and the year used up', () => {
    const unlucky = seedWhere(sergeant(), ['board', age], (u) => u > 0.31);
    const result = applyForCommission(unlucky);
    if (!result.ok) throw new Error('should apply');
    const state = result.value.state;
    expect(state.military.service).toEqual(unlucky.military.service);
    expect(state.military.commissionAppliedAge).toBe(age);
    expect(result.value.entry.kind).toBe('passive');
    expect(state.player.records).toEqual(unlucky.player.records);
    expect(error(applyForCommission(state))).toBe('already-applied');
    // The next year the board will look again.
    expect(error(applyForCommission(withAge(state, age + 1)))).toBe('ok');
  });
});

/* -------------------------------------------------------------------------- */
/* Nothing else stands beside service                                          */
/* -------------------------------------------------------------------------- */

describe('the other-career guard', () => {
  const base = eligible(adult('MIL2-GUARD', 24));

  it('takes a sports contract, a part, a record deal and a modeling job out of a serving life’s year', () => {
    const sports = { sports: { ...base.sports, offer: { id: 'x' } as never } };
    const acting = { acting: { ...EMPTY_ACTING, offers: [{ id: 'a' } as never] } };
    const music = { music: { ...base.music, offer: { id: 'm' } as never } };
    const modeling = { modeling: { ...EMPTY_MODELING, offers: [{ id: 'j' } as never] } };
    expect(withoutSportsOffer(sports, true).sports.offer).toBeUndefined();
    expect('offer' in withoutSportsOffer(sports, true).sports).toBe(false);
    expect(withoutActingOffers(acting, true).acting.offers).toEqual([]);
    expect(withoutMusicOffer(music, true).music.offer).toBeUndefined();
    expect('offer' in withoutMusicOffer(music, true).music).toBe(false);
    expect(withoutModelingOffers(modeling, true).modeling.offers).toEqual([]);
  });

  it('leaves a life that is not serving exactly as it came, the same object', () => {
    const sports = { sports: { ...base.sports, offer: { id: 'x' } as never } };
    const acting = { acting: { ...EMPTY_ACTING, offers: [{ id: 'a' } as never] } };
    const music = { music: { ...base.music, offer: { id: 'm' } as never } };
    const modeling = { modeling: { ...EMPTY_MODELING, offers: [{ id: 'j' } as never] } };
    expect(withoutSportsOffer(sports, false)).toBe(sports);
    expect(withoutActingOffers(acting, false)).toBe(acting);
    expect(withoutMusicOffer(music, false)).toBe(music);
    expect(withoutModelingOffers(modeling, false)).toBe(modeling);
  });

  it('keeps everything else in the year the guard sees', () => {
    const acting = {
      acting: { ...EMPTY_ACTING, credits: 9, offers: [{ id: 'a' } as never] },
      extra: 1,
    };
    const out = withoutActingOffers(acting, true);
    expect(out.extra).toBe(1);
    expect(out.acting.credits).toBe(9);
  });

  it('keeps an actor’s parts away from somebody in uniform across a whole year', () => {
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
    let compared = 0;
    for (let i = 0; i < 120 && compared < 3; i += 1) {
      const life = actor(reseed(base, `guard-act-${i}`));
      const free = advanceYear(reseed(life, life.rng.getSeed())).state;
      if (free.acting.offers.length === 0) continue;
      const served = advanceYear(
        serving(reseed(life, life.rng.getSeed()), { years: 6, termEnds: 99 }),
      ).state;
      expect(served.acting.offers, `seed ${i}`).toEqual([]);
      expect(served.military.service).toBeDefined();
      compared += 1;
    }
    expect(compared).toBeGreaterThanOrEqual(3);
  });

  it('keeps a model’s jobs away from somebody in uniform across a whole year', () => {
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
    for (let i = 0; i < 120 && compared < 3; i += 1) {
      const life = model(reseed(base, `guard-mod-${i}`));
      const free = advanceYear(reseed(life, life.rng.getSeed())).state;
      if (free.modeling.offers.length === 0) continue;
      const served = advanceYear(
        serving(reseed(life, life.rng.getSeed()), { years: 6, termEnds: 99 }),
      ).state;
      expect(served.modeling.offers, `seed ${i}`).toEqual([]);
      compared += 1;
    }
    expect(compared).toBeGreaterThanOrEqual(3);
  });
});

/* -------------------------------------------------------------------------- */
/* Words, everywhere                                                           */
/* -------------------------------------------------------------------------- */

describe('the words', () => {
  const base = eligible(adult('MIL2-WORDS', 26));

  it('never leave a placeholder in a line, for any branch, ladder or grade a year can reach', () => {
    for (const branch of SERVICE_BRANCH_IDS) {
      const job = openSpecialtyOf(branch).id;
      for (const track of ['enlisted', 'officer'] as const) {
        const top = track === 'officer' ? OFFICER_TOP_GRADE : 9;
        for (let grade = 1; grade <= top; grade += 1) {
          for (const stage of ['training', 'serving'] as const) {
            const state = {
              ...base,
              military: {
                ...base.military,
                service: serviceRow({
                  branch,
                  specialty: job,
                  track,
                  grade,
                  stage,
                  years: 5,
                  termEnds: 6,
                  performance: 70,
                  commissionedAt: track === 'officer' ? 1 : 0,
                }),
              },
            };
            for (let a = 25; a < 31; a += 1) {
              const out = yearOf(state, a);
              for (const line of out.lines) {
                expect(line.text, `${branch} ${track} ${grade} ${stage} ${a}`).not.toContain('%');
                expect(line.text.length).toBeGreaterThan(10);
              }
              const offer = out.military.offer;
              if (offer) {
                const decision = militaryOfferDecision(offer, 2031);
                expect(decision.prompt).not.toContain('%');
                for (const choice of decision.choices) expect(choice.label).not.toContain('%');
              }
            }
          }
        }
      }
    }
  });

  it('draw a year’s line from the ladder’s own pool and the specialty’s kind of work', () => {
    const lines = new Set<string>();
    for (let a = 25; a < 90; a += 1) {
      const out = yearOf(
        officering(base, {
          grade: 1,
          years: 0,
          termEnds: 99,
          commissionedAt: 0,
          specialty: 'army.medic',
        }),
        a,
      );
      for (const line of out.lines) lines.add(line.text);
    }
    expect(lines.size).toBeGreaterThan(3);
    const medical = [...lines].filter((line) => /aid station|sick call|clinic/.test(line));
    expect(medical.length).toBeGreaterThan(0);
  });

  it('names the job, the occupation and the pay', () => {
    const career = serviceRow({ branch: 'navy', specialty: 'navy.corpsman', grade: 5, years: 8 });
    expect(specialtyNameOf(career)).toBe('Hospital Corpsman');
    expect(rankTitleOf(career)).toBe('Petty Officer Second Class');
    expect(militaryOccupation({ past: [], service: career })).toBe(
      'Petty Officer Second Class, Navy',
    );
    expect(militaryOccupation({ past: [] })).toBeUndefined();
    const officer = officerRow({
      branch: 'air-force',
      specialty: 'air-force.cyber',
      grade: 3,
      years: 6,
    });
    expect(rankTitleOf(officer)).toBe('Captain');
    expect(yearPayOf(officer)).toBe(annualBasePay(3, 6, 'officer'));
    expect(yearPayOf(career)).toBe(annualBasePay(5, 8, 'enlisted'));
    expect(payWords(officer)).toBe(
      `$${annualBasePay(3, 6, 'officer').toLocaleString('en-US')} a year`,
    );
    // A trainee is paid as the enlisted rank they came from.
    const trainee = officerRow({
      stage: 'training',
      grade: 1,
      years: 6,
      prior: { grade: 5, termEnds: 8 },
    });
    expect(yearPayOf(trainee)).toBe(annualBasePay(5, 6, 'enlisted'));
    expect(specialtyNameOf(serviceRow({ specialty: 'nonsense.job' }))).toBe('Infantry');
    expect(scaledRise(0.3, 60)).toBeCloseTo(0.3);
  });
});
