/**
 * Ticket 0906 — states for the military, FBI, CIA and veteran screen tests.
 *
 * Built by spreading fields onto a real adult, never by reaching into the engines' private state,
 * so a field that stops being a field fails to compile here instead of passing by luck.
 */

import {
  EMPTY_MILITARY,
  type AgencyCareer,
  type GameState,
  type MilitaryState,
  type PastAgency,
  type PastService,
  type ServiceCareer,
} from '@yearafter/simulation';
import { ADULT, at, withBookedCash } from './entertainmentFixtures';

export { ADULT, at, withBookedCash };

type StatName = 'smarts' | 'discipline' | 'health';

export const withStats = (
  state: GameState,
  stats: Partial<Record<StatName, number>>,
): GameState => ({
  ...state,
  player: { ...state.player, stats: { ...state.player.stats, ...stats } as never },
});

/** Fit, quick enough, with a diploma, in no school and no other career: the recruiter's table is open. */
export function eligible(state: GameState = ADULT): GameState {
  const fit = withStats(state, { health: 80, smarts: 70, discipline: 60 });
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
    employment: { ...fit.employment, job: undefined },
    sports: { ...fit.sports, career: undefined, post: undefined } as never,
    health: { ...fit.health, conditions: [], deficit: 0 },
    pending: [],
    military: EMPTY_MILITARY,
    intel: { past: [] },
  };
}

/** The same person with a bachelor's degree. */
export const withDegree = (state: GameState): GameState => ({
  ...state,
  education: {
    ...state.education,
    credentials: { ...state.education.credentials, university: 22 },
  } as never,
});

export const serviceRow = (patch: Partial<ServiceCareer> = {}): ServiceCareer => ({
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

export const serving = (state: GameState, patch: Partial<ServiceCareer> = {}): GameState => ({
  ...state,
  military: { ...state.military, service: serviceRow(patch) },
});

export const pastRow = (patch: Partial<PastService> = {}): PastService => ({
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

export const veteran = (
  state: GameState,
  patch: Partial<PastService> = {},
  extra: Partial<MilitaryState> = {},
): GameState => ({
  ...state,
  military: { ...state.military, past: [pastRow(patch)], ...extra },
});

export const agencyRow = (patch: Partial<AgencyCareer> = {}): AgencyCareer => ({
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

export const inAgency = (state: GameState, patch: Partial<AgencyCareer> = {}): GameState => ({
  ...state,
  intel: { ...state.intel, career: agencyRow(patch) },
});

export const pastAgency = (patch: Partial<PastAgency> = {}): PastAgency => ({
  agency: 'fbi',
  enteredAge: 24,
  endedAge: 30,
  years: 6,
  finalGrade: 12,
  reputation: 60,
  how: 'resigned',
  pension: 0,
  ...patch,
});

/** A person an agency would take: a degree, enough experience, fit, no career standing. */
export const agencyReady = (state: GameState = ADULT): GameState =>
  withDegree({ ...eligible(state), player: { ...state.player, age: 30 } });
