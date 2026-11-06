/**
 * Ticket 0905 — military intelligence and the agencies.
 *
 * What is earned and kept: a clearance (see `intel-clearance.ts`), an FBI or CIA career entered through the service or off
 * a degree, and the missions that career and a military-intelligence specialty can raise. The tables and the dials are in
 * `@yearafter/content`'s `intel.ts`.
 *
 * Intelligence is not a detached career: its jobs are not in the shared careers catalog, so every other life's listings
 * and draws are untouched. An agency career holds the whole year, as a service life does.
 *
 * A mission waits for a minigame. Nothing in the game plays one yet, so `intel.missionsOpen` is off in every life and no
 * mission is raised: a life played through the harness never goes on one, and nothing stands in for the missing result.
 * When the minigame exists, whatever builds it calls `openMissions`, and its answer goes in through `decide` as one of the
 * four outcomes, exactly as a button would. Harm follows a failure and nothing else: a clean or close mission costs
 * nothing, a clearance is lost only after a mistake or a disaster, and a death only after a disaster.
 *
 * Every draw is a hash of the seed, the generation and a name, so no random stream is touched.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  nudgeStats,
  stampRecord,
  type NewLifeRecord,
  type TimelineEntry,
  type VisibleStatKey,
} from '@yearafter/character';
import { performanceYear, standingYear } from '@yearafter/careers';
import {
  ACADEMY_LINES,
  ACADEMY_WASH_OUT_LINES,
  AGENCIES,
  AGENCY_AGE_RETIRE_LINES,
  AGENCY_CLEARANCE,
  AGENCY_LET_GO_LINES,
  AGENCY_PENSION_LINES,
  AGENCY_RESIGN_LINES,
  AGENCY_RETAIN_FLOOR,
  AGENCY_RETIRE_LINES,
  AGENCY_RISES,
  AGENCY_RISE_LINES,
  AGENCY_YEAR_LINES,
  APPLY_DENIED_LINES,
  APPLY_HIRED_CLEARED_LINES,
  APPLY_HIRED_LINES,
  APPLY_REJECTED_LINES,
  CLEARANCE_KEPT_LINES,
  CLEARANCE_LABELS,
  CLEARANCE_LAPSED_LINES,
  CLEARANCE_LOSS_ON_DISASTER,
  CLEARANCE_LOSS_ON_MISTAKE,
  CLEARANCE_LOST_LINES,
  ENLIST_HEALTH_FLOOR,
  INTEL_DEATH_CAUSES,
  INTEL_DEATH_ON_DISASTER,
  INTEL_MISSION_PROMPTS,
  KEPT_CLEARANCE_LINES,
  MISSION_CHANCE,
  MISSION_LINES,
  MISSION_MIN_AGENCY_GRADE,
  MISSION_MIN_SERVICE_YEARS,
  MISSION_MOOD,
  MISSION_OUTCOMES,
  MISSION_OUTCOME_LABELS,
  MISSION_PERFORMANCE,
  MISSION_REPUTATION,
  MISSION_STRESS,
  MISSION_DEATH_LINES,
  RETIRE_ELIGIBLE_YEARS,
  TOP_AGENCY_GRADE,
  academyWashOutChance,
  agencyPensionFor,
  agencyRow,
  agencyTitle,
  agencyYearPay,
  clearanceForSkill,
  findAgency,
  findSpecialty,
  hireChance,
  openSpecialtyOf,
  scaledRise,
  serviceFit,
  servicePerformanceTarget,
  startingGrade,
  type AgencyRow,
  type MissionOutcome,
} from '@yearafter/content';
import { clampStat, err, mixedUnit, ok, stablePick, type Result } from '@yearafter/core';
import { isInSchool, type EducationState } from '@yearafter/education';
import type { PendingDecision } from '@yearafter/events';
import { applyImmediateStress } from '@yearafter/stress';
import { experienceOf, resign } from './careers';
import type { GameState } from './game-state';
import {
  clearanceHeld,
  clearanceMeets,
  investigate,
  withClearance,
  withoutClearance,
  type Investigation,
} from './intel-clearance';
import type {
  AgencyCareer,
  AgencyId,
  IntelMission,
  IntelState,
  MissionSource,
  PastAgency,
} from './intel-state';
import { holdsAnotherCareer, holdsDegree, otherFieldAsking } from './military';
import type { MilitaryState, PastService, ServiceCareer } from './military-state';

/** The reserved event id a mission is raised under: one question, answered with how it came out. */
export const INTEL_MISSION_EVENT_ID = 'intel.mission';

export const isIntelMissionDecision = (eventId: string): boolean =>
  eventId === INTEL_MISSION_EVENT_ID;

const unit = (state: GameState, ...parts: readonly (string | number)[]): number =>
  mixedUnit(`intel:${state.rng.getSeed()}:${state.world.generation}:${parts.join(':')}`);

const unitOf = (
  seed: number | string,
  gen: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`intel:${seed}:${gen}:${parts.join(':')}`);

const pick = (lines: readonly string[], key: string): string => stablePick(lines, key) ?? '';

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Fill an agency line's tokens. A token a line doesn't have is left alone. */
function fill(
  line: string,
  agency: AgencyRow,
  words: { readonly title?: string; readonly years?: number; readonly grade?: number } = {},
): string {
  return line
    .replaceAll('%Agency%', capital(agency.name))
    .replaceAll('%agency%', agency.name)
    .replaceAll('%Training%', capital(agency.training))
    .replaceAll('%training%', agency.training)
    .replaceAll('%weeks%', String(agency.trainingWeeks))
    .replaceAll('%member%', agency.member)
    .replaceAll('%title%', words.title ?? '')
    .replaceAll('%years%', String(words.years ?? ''))
    .replaceAll('%grade%', String(words.grade ?? ''));
}

/* -------------------------------------------------------------------------- */
/* Reading an intelligence life                                                */
/* -------------------------------------------------------------------------- */

export const agencyCareerOf = (state: GameState): AgencyCareer | undefined => state.intel.career;

export const isInAgency = (state: Pick<GameState, 'intel'>): boolean =>
  state.intel.career !== undefined;

/** The saved flag a minigame turns on. A mission is never raised without it. */
export const openMissions = (state: GameState): GameState => ({
  ...state,
  intel: { ...state.intel, missionsOpen: true },
});

export const closeMissions = (state: GameState): GameState => {
  const { missionsOpen: _off, ...rest } = state.intel;
  return { ...state, intel: rest };
};

/** The header for somebody in an agency: "Special Agent, FBI". */
export function agencyOccupation(intel: IntelState): string | undefined {
  const career = intel.career;
  if (!career) return undefined;
  return `${agencyTitle(career.agency, career.grade)}, ${agencyRow(career.agency).short}`;
}

/** Whether a specialty is an intelligence one. */
export const isIntelSpecialty = (specialtyId: string): boolean =>
  findSpecialty(specialtyId)?.skill === 'intelligence';

/** Whole years somebody has served in an intelligence specialty, in all the services they were in. */
export function intelligenceYears(military: MilitaryState): number {
  return military.past
    .filter((row) => isIntelSpecialty(row.specialty))
    .reduce((total, row) => total + row.years, 0);
}

/** The pay for the year to come, for a screen. */
export const agencyPayOf = (career: AgencyCareer): number =>
  agencyYearPay(career.agency, career.grade, career.years);

/** Retired pay, a year, whole dollars, for somebody whose agency career ended before this age. */
export function agencyPensionAt(intel: IntelState, age: number): number {
  return intel.past.reduce((total, row) => (age > row.endedAge ? total + row.pension : total), 0);
}

/* -------------------------------------------------------------------------- */
/* Getting in                                                                  */
/* -------------------------------------------------------------------------- */

export type AgencyError =
  | 'serving'
  | 'in-agency'
  | 'offer-pending'
  | 'too-young'
  | 'too-old'
  | 'in-school'
  | 'no-degree'
  | 'no-experience'
  | 'unfit'
  | 'busy'
  | 'already-applied'
  | 'no-such-agency';

export const AGENCY_ERROR_LABELS: Readonly<Record<AgencyError, string>> = {
  serving: "You're in uniform. Leave the service first; a clearance stays good for two years.",
  'in-agency': 'You already work for an agency.',
  'offer-pending': 'There is a question waiting for you already.',
  'too-young': "You're too young for that one.",
  'too-old': "You're past the age that agency takes.",
  'in-school': 'Finish school first.',
  'no-degree': "It takes a bachelor's degree, and you don't have one.",
  'no-experience': "They want more professional experience than you've got.",
  unfit: "The physical turned you away. You're not well enough for this yet.",
  busy: 'You have a career that is your whole year already.',
  'already-applied': "You've already applied to an agency this year.",
  'no-such-agency': "That isn't an agency.",
};

/** Years of professional work: jobs held, service in uniform and time in an agency all count. */
export const professionalYears = (state: GameState, age: number = state.player.age): number =>
  experienceOf(state.employment, age) +
  state.military.past.reduce((total, row) => total + row.years, 0) +
  state.intel.past.reduce((total, row) => total + row.years, 0);

/** What stands between this character and an agency at this age, or nothing. */
export function agencyBar(
  state: GameState,
  agencyId: string,
  age: number = state.player.age,
): Exclude<AgencyError, 'already-applied' | 'offer-pending' | 'no-such-agency'> | undefined {
  const row = findAgency(agencyId);
  if (!row) return undefined;
  if (state.military.service) return 'serving';
  if (state.intel.career) return 'in-agency';
  if (age < row.minAge) return 'too-young';
  if (age > row.maxAge) return 'too-old';
  if (isInSchool(state.education)) return 'in-school';
  if (!holdsDegree(state.education)) return 'no-degree';
  if (professionalYears(state, age) < row.experienceYears) return 'no-experience';
  if (state.player.stats.health < ENLIST_HEALTH_FLOOR) return 'unfit';
  if (holdsAnotherCareer(state)) return 'busy';
  return undefined;
}

/** The agencies somebody can walk up to at this age: every one whose door they meet. */
export const eligibleAgencies = (
  state: GameState,
  age: number = state.player.age,
): readonly AgencyId[] =>
  AGENCIES.filter((row) => agencyBar(state, row.id, age) === undefined).map((row) => row.id);

/** How the application came out. */
export type AgencyApplyResult = 'hired' | 'rejected' | 'denied';

export interface AgencyApplyOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  readonly result: AgencyApplyResult;
}

function entryFor(
  state: GameState,
  text: string,
  kind: 'milestone' | 'passive' | 'career',
  tag: string,
): TimelineEntry {
  const sequence = state.player.timeline.filter((row) => row.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:intel:${tag}:${sequence}`,
    sequence,
  });
}

const addRecord = (state: GameState, record: NewLifeRecord): GameState['player']['records'] =>
  appendRecord(
    state.player.records,
    stampRecord(record, state.player.age, state.world.year, state.player.records.length),
  );

const dropQuestion = (state: GameState, eventId: string): GameState['pending'] =>
  state.pending.filter((row) => row.eventId !== eventId);

/**
 * Apply to an agency. One application a year. The agency decides first (a draw against the odds, which the clearance
 * already held and the years in intelligence raise); a person chosen is then investigated unless a Top Secret clearance
 * is already good. A person who is hired starts the academy year as a trainee, any job they held resigned.
 */
export function applyToAgency(
  state: GameState,
  agencyId: string,
): Result<AgencyApplyOutcome, AgencyError> {
  const row = findAgency(agencyId);
  if (!row) return err('no-such-agency');
  if (state.intel.appliedAge === state.player.age) return err('already-applied');
  if (state.pending.length > 0 || state.military.offer || otherFieldAsking(state)) {
    return err('offer-pending');
  }
  const bar = agencyBar(state, row.id);
  if (bar) return err(bar);

  const age = state.player.age;
  const stats = state.player.stats;
  const held = clearanceHeld(state.intel, age);
  const years = intelligenceYears(state.military);
  const chance = hireChance({
    agency: row.id,
    smarts: stats.smarts,
    discipline: stats.discipline,
    health: stats.health,
    ...(held ? { held: held.level } : {}),
    intelYears: years,
  });
  const applied: IntelState = { ...state.intel, appliedAge: age };

  if (unit(state, 'hire', row.id, age) >= chance) {
    const entry = entryFor(
      state,
      fill(pick(APPLY_REJECTED_LINES, `${age}:rejected`), row),
      'milestone',
      'apply:rejected',
    );
    return ok({
      result: 'rejected',
      entry,
      state: {
        ...state,
        intel: applied,
        player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      },
    });
  }

  const cleared = clearanceMeets(state.intel, age, AGENCY_CLEARANCE);
  let intel = applied;
  let text: string;
  if (cleared) {
    text = fill(pick(APPLY_HIRED_CLEARED_LINES, `${age}:hired:cleared`), row);
  } else {
    const investigation: Investigation = investigate({
      seed: state.rng.getSeed(),
      generation: state.world.generation,
      age,
      level: AGENCY_CLEARANCE,
      discipline: stats.discipline,
      military: state.military,
      intel: state.intel,
      key: `agency:${row.id}`,
    });
    if (!investigation.granted) {
      const denied = fill(pick(APPLY_DENIED_LINES, `${age}:denied`), row).replaceAll(
        '%days%',
        String(investigation.days),
      );
      const entry = entryFor(state, denied, 'milestone', 'apply:denied');
      return ok({
        result: 'denied',
        entry,
        state: {
          ...state,
          intel: { ...intel, deniedAge: age },
          player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
        },
      });
    }
    intel = withClearance(intel, AGENCY_CLEARANCE, age);
    text = `${fill(pick(APPLY_HIRED_LINES, `${age}:hired`), row)} ${investigation.line}`;
  }

  const left = state.employment.job !== undefined ? resign(state) : undefined;
  const base = left && left.ok ? left.value.state : state;
  const post =
    row.posts[Math.floor(unit(state, 'post', row.id, age) * row.posts.length)] ?? row.posts[0]!;
  const grade = startingGrade(row.id, held !== undefined, years);
  const career: AgencyCareer = {
    agency: row.id,
    stage: 'training',
    enteredAge: age,
    grade,
    gradeYears: 0,
    years: 0,
    performance: 50,
    reputation: 55,
    effort: 'normal',
    lastPay: 0,
    post,
    door: held !== undefined && years > 0 ? 'service' : 'degree',
    poorYears: 0,
    highPay: [],
  };
  const entry = entryFor(base, text, 'milestone', 'apply:hired');
  return ok({
    result: 'hired',
    entry,
    state: {
      ...base,
      intel: { ...intel, career },
      player: {
        ...base.player,
        timeline: appendToTimeline(base.player.timeline, entry),
        records: addRecord(base, { category: 'career', label: `Hired — ${row.short}` }),
      },
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Leaving                                                                     */
/* -------------------------------------------------------------------------- */

export type IntelLeaveError = 'no-career';

export interface IntelLeaveOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

function pastOf(
  career: AgencyCareer,
  how: PastAgency['how'],
  age: number,
  years: number,
  grade: number,
  reputation: number,
  highPay: readonly number[],
): PastAgency {
  const average = highPay.length > 0 ? highPay.reduce((a, b) => a + b, 0) / highPay.length : 0;
  return {
    agency: career.agency,
    enteredAge: career.enteredAge,
    endedAge: age,
    years,
    finalGrade: grade,
    reputation,
    how,
    pension: agencyPensionFor({ how, years, endedAge: age, highThreeAverage: average }),
  };
}

/** Resign, or retire if the years and the age are in. Free and permissive, as quitting a job is. */
export function leaveIntelCareer(state: GameState): Result<IntelLeaveOutcome, IntelLeaveError> {
  const career = state.intel.career;
  if (!career) return err('no-career');
  const row = agencyRow(career.agency);
  const age = state.player.age;
  const retiring = career.years >= RETIRE_ELIGIBLE_YEARS && age >= 50;
  const how: PastAgency['how'] = retiring ? 'retired' : 'resigned';
  const title = agencyTitle(career.agency, career.grade);
  const text = fill(
    pick(retiring ? AGENCY_RETIRE_LINES : AGENCY_RESIGN_LINES, `${age}:leave`),
    row,
    {
      title,
      years: career.years,
    },
  );
  const entry = entryFor(state, text, 'milestone', 'leave');
  const { career: _gone, mission: _m, ...rest } = state.intel;
  const past = pastOf(
    career,
    how,
    age,
    career.years,
    career.grade,
    career.reputation,
    career.highPay,
  );
  return ok({
    entry,
    state: {
      ...state,
      intel: { ...rest, past: [...state.intel.past, past] },
      pending: dropQuestion(state, INTEL_MISSION_EVENT_ID),
      player: {
        ...state.player,
        timeline: appendToTimeline(state.player.timeline, entry),
        records: addRecord(state, {
          category: 'career',
          label: `${retiring ? 'Retired from' : 'Left'} ${row.short} — ${title}`,
        }),
      },
    },
  });
}

/* -------------------------------------------------------------------------- */
/* A year                                                                      */
/* -------------------------------------------------------------------------- */

export interface IntelYearLine {
  readonly kind: 'passive' | 'milestone';
  readonly text: string;
}

export interface IntelYearInput {
  /** The state at the start of the year, before any phase ran. */
  readonly before: GameState;
  /** The military state as this year's service left it. */
  readonly military: MilitaryState;
  readonly education: EducationState;
  readonly age: number;
  readonly year: number;
  /** The investigation a recruit's training year ended in, if there was one. */
  readonly investigation?: Investigation;
}

export interface IntelYearOutput {
  readonly intel: IntelState;
  readonly lines: readonly IntelYearLine[];
  readonly records: readonly NewLifeRecord[];
  /** Gross pay for the year, whole dollars. The caller taxes and posts it. */
  readonly pay: number;
  /** Retired pay for the year, whole dollars. Not taxed here, for the reason the military's is not. */
  readonly pension: number;
  readonly mood: number;
  readonly statDeltas: Partial<Record<VisibleStatKey, number>>;
  /** True when this year took somebody out of an agency. */
  readonly left: boolean;
}

/** Whether somebody is doing work that needs the clearance they hold, once this year's service is counted. */
function holdsClearanceJob(intel: IntelState, military: MilitaryState, age: number): boolean {
  if (intel.career) return true;
  const service = military.service;
  if (!service) return false;
  const skill = findSpecialty(service.specialty)?.skill;
  const needed = skill === undefined ? undefined : clearanceForSkill(skill);
  return needed !== undefined && clearanceMeets(intel, age, needed);
}

/** The year's agency work: the academy, the ladder, the pay, the end. */
function runAgencyYear(
  before: GameState,
  career: AgencyCareer,
  age: number,
): {
  readonly career: AgencyCareer | undefined;
  readonly past?: PastAgency;
  readonly lines: IntelYearLine[];
  readonly records: NewLifeRecord[];
  readonly pay: number;
  readonly mood: number;
  readonly statDeltas: Partial<Record<VisibleStatKey, number>>;
} {
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const row = agencyRow(career.agency);
  const stats = before.player.stats;
  const lines: IntelYearLine[] = [];
  const records: NewLifeRecord[] = [];
  const statDeltas: Partial<Record<VisibleStatKey, number>> = {};
  let mood = 0;
  const training = career.stage === 'training';
  const pay = agencyYearPay(career.agency, career.grade, career.years);
  const titleOf = (grade: number): string => agencyTitle(career.agency, grade);

  /* ---- the academy year ---- */
  if (training) {
    const fit = serviceFit(stats.discipline, stats.health, stats.smarts);
    if (
      unitOf(seed, gen, 'academy', career.agency, career.enteredAge) < academyWashOutChance(fit)
    ) {
      lines.push({
        kind: 'milestone',
        text: fill(pick(ACADEMY_WASH_OUT_LINES, `${age}:academy:out`), row),
      });
      records.push({ category: 'career', label: `Did not finish — ${row.short} training` });
      return {
        career: undefined,
        past: pastOf(career, 'washed-out', age, 0, career.grade, career.reputation, []),
        lines,
        records,
        // A trainee who doesn't finish is paid for part of the year.
        pay: Math.round(pay / 2),
        mood: -6,
        statDeltas: {},
      };
    }
    lines.push({ kind: 'milestone', text: fill(pick(ACADEMY_LINES, `${age}:academy`), row) });
    statDeltas.discipline = 2;
    statDeltas.health = 1;
    statDeltas.smarts = 1;
  }

  /* ---- how the work went ---- */
  const target = servicePerformanceTarget(
    career.effort === 'hard',
    stats.discipline,
    stats.smarts,
    stats.health,
  );
  const performance = performanceYear(career.performance, target);
  const reputation = standingYear(career.reputation, performance);
  const nextYears = career.years + 1;

  /* ---- grade ---- */
  let grade = career.grade;
  let gradeYears = career.gradeYears + 1;
  if (!training && grade < TOP_AGENCY_GRADE) {
    const next = grade + 1;
    const rise = AGENCY_RISES[next];
    if (
      rise &&
      gradeYears >= rise.minYearsBelow &&
      unitOf(seed, gen, 'rise', career.agency, age, next) < scaledRise(rise.rise, performance)
    ) {
      grade = next;
      gradeYears = 0;
      lines.push({
        kind: 'milestone',
        text: fill(pick(AGENCY_RISE_LINES, `${age}:rise:${next}`), row, {
          title: titleOf(next),
          grade: next,
        }),
      });
      mood += 2;
      if (next >= 13) {
        records.push({ category: 'career', label: `Promoted — ${titleOf(next)}, ${row.short}` });
      }
    }
  }
  if (!training && lines.length === 0) {
    const pool = [...AGENCY_YEAR_LINES[career.agency]];
    lines.push({ kind: 'passive', text: pick(pool, `${age}:agencyyear`) });
  }

  const poorYears = !training && performance < AGENCY_RETAIN_FLOOR ? career.poorYears + 1 : 0;
  const highPay = [pay, ...career.highPay].slice(0, 3);
  const title = titleOf(grade);
  const next: AgencyCareer = {
    ...career,
    stage: 'serving',
    grade,
    gradeYears,
    years: nextYears,
    performance,
    reputation,
    lastPay: pay,
    poorYears,
    highPay,
  };

  const leave = (how: PastAgency['how'], line: string, label: string, moodNow: number) => {
    lines.push({ kind: 'milestone', text: line });
    records.push({ category: 'career', label });
    return {
      career: undefined,
      past: pastOf(career, how, age, nextYears, grade, reputation, highPay),
      lines,
      records,
      pay,
      mood: moodNow,
      statDeltas,
    };
  };

  /* ---- two poor years running ---- */
  if (poorYears >= 2) {
    return leave(
      'let-go',
      fill(pick(AGENCY_LET_GO_LINES, `${age}:letgo`), row),
      `Let go by ${row.short} — ${title}`,
      mood - 5,
    );
  }

  /* ---- the compulsory age ---- */
  if (age >= row.retireAge) {
    return leave(
      'retired',
      fill(pick(AGENCY_AGE_RETIRE_LINES, `${age}:agedout`), row, { title, years: nextYears }),
      `Retired from ${row.short} — ${title}`,
      mood + 2,
    );
  }

  return { career: next, lines, records, pay, mood, statDeltas };
}

/** The clearance's upkeep for a year: who still needs it, who is idle, and what has lapsed. */
function keepClearance(
  intel: IntelState,
  military: MilitaryState,
  age: number,
  lines: IntelYearLine[],
): IntelState {
  const clearance = intel.clearance;
  if (!clearance) return intel;
  if (holdsClearanceJob(intel, military, age)) {
    if (clearance.idleSince === undefined) return intel;
    const { idleSince: _off, ...rest } = clearance;
    return { ...intel, clearance: rest };
  }
  if (clearance.idleSince === undefined) {
    lines.push({
      kind: 'passive',
      text: pick(CLEARANCE_KEPT_LINES, `${age}:idle`).replaceAll(
        '%level%',
        CLEARANCE_LABELS[clearance.level],
      ),
    });
    return { ...intel, clearance: { ...clearance, idleSince: age } };
  }
  if (clearanceHeld(intel, age) === undefined) {
    lines.push({
      kind: 'milestone',
      text: pick(CLEARANCE_LAPSED_LINES, `${age}:lapse`).replaceAll(
        '%level%',
        CLEARANCE_LABELS[clearance.level],
      ),
    });
    const { clearance: _lapsed, ...rest } = intel;
    return rest;
  }
  return intel;
}

/** Which source, if any, can be sent on a mission this year. */
function missionSourceOf(
  before: GameState,
  intel: IntelState,
  military: MilitaryState,
  age: number,
): MissionSource | undefined {
  // The year the career was entered or the training ended is not a year for a mission: what counts is where the person
  // stood when the year began.
  const career = intel.career;
  if (career) {
    const began = before.intel.career;
    return began?.stage === 'serving' &&
      career.stage === 'serving' &&
      began.grade >= MISSION_MIN_AGENCY_GRADE
      ? career.agency
      : undefined;
  }
  const service = military.service;
  const began = before.military.service;
  if (!service || service.stage !== 'serving') return undefined;
  if (!began || began.stage !== 'serving' || began.years < MISSION_MIN_SERVICE_YEARS)
    return undefined;
  if (!isIntelSpecialty(service.specialty)) return undefined;
  if (military.deployment !== undefined) return undefined;
  return clearanceMeets(intel, age, 'top-secret') ? 'military' : undefined;
}

export function runIntelYear(input: IntelYearInput): IntelYearOutput {
  const { before, military, age } = input;
  let intel = before.intel;
  const lines: IntelYearLine[] = [];
  const records: NewLifeRecord[] = [];
  let pay = 0;
  let mood = 0;
  let statDeltas: Partial<Record<VisibleStatKey, number>> = {};
  let left = false;

  /* ---- the investigation a training year ended in ---- */
  if (input.investigation) {
    intel = input.investigation.granted
      ? withClearance(intel, input.investigation.level, age)
      : { ...intel, deniedAge: age };
  }

  /* ---- an agency career ---- */
  const career = intel.career;
  if (career) {
    const year = runAgencyYear(before, career, age);
    pay = year.pay;
    mood += year.mood;
    statDeltas = year.statDeltas;
    lines.push(...year.lines);
    records.push(...year.records);
    if (year.career) {
      intel = { ...intel, career: year.career };
    } else {
      const { career: _over, mission: _m, ...rest } = intel;
      intel = { ...rest, past: year.past ? [...intel.past, year.past] : intel.past };
      left = true;
    }
  }

  /* ---- retired pay: the year after it began ---- */
  const pension = agencyPensionAt(intel, age);
  for (const row of intel.past) {
    if (row.pension > 0 && age === row.endedAge + 1) {
      lines.push({
        kind: 'milestone',
        text: fill(pick(AGENCY_PENSION_LINES, `${age}:pension`), agencyRow(row.agency)).replaceAll(
          '%pay%',
          String(row.pension),
        ),
      });
    }
  }

  /* ---- the clearance's upkeep ---- */
  intel = keepClearance(intel, military, age, lines);

  /* ---- a mission, if the gate is open ---- */
  if (
    intel.missionsOpen === true &&
    intel.mission === undefined &&
    before.pending.length === 0 &&
    before.military.deployment === undefined
  ) {
    const source = missionSourceOf(before, intel, military, age);
    if (
      source !== undefined &&
      unitOf(before.rng.getSeed(), before.world.generation, 'mission', age) < MISSION_CHANCE[source]
    ) {
      const mission: IntelMission = { source, age };
      intel = { ...intel, mission };
    }
  }

  return { intel, lines, records, pay, pension, mood, statDeltas, left };
}

/* -------------------------------------------------------------------------- */
/* Missions                                                                    */
/* -------------------------------------------------------------------------- */

/** The question a mission asks: the generic outcomes, until a minigame replaces the buttons. */
export function intelMissionDecision(state: GameState, mission: IntelMission): PendingDecision {
  return {
    eventId: INTEL_MISSION_EVENT_ID,
    category: 'career',
    age: state.player.age,
    year: state.world.year,
    prompt: pick(INTEL_MISSION_PROMPTS[mission.source], `${mission.age}:${mission.source}:mission`),
    choices: MISSION_OUTCOMES.map((id) => ({ id, label: MISSION_OUTCOME_LABELS[id] })),
    names: {},
  };
}

/** Put the mission on the table, when one is standing and the question isn't already there. */
export function withIntelMission(state: GameState, alive: boolean): GameState {
  const mission = state.intel.mission;
  if (!alive || !mission) return state;
  if (state.pending.some((row) => row.eventId === INTEL_MISSION_EVENT_ID)) return state;
  return { ...state, pending: [...state.pending, intelMissionDecision(state, mission)] };
}

export type IntelMissionError = 'no-mission' | 'no-such-choice';

export interface IntelMissionOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

/**
 * A mission's result goes in. A clean or close one costs nothing, or some stress. A mistake or a disaster may cost the
 * clearance, and the job with it (an agent is let go; a member of the service is moved to other work); a disaster may
 * kill. No draw harms somebody whose mission came out clean.
 */
export function answerIntelMission(
  state: GameState,
  choiceId: string,
): Result<IntelMissionOutcome, IntelMissionError> {
  const mission = state.intel.mission;
  if (!mission) return err('no-mission');
  if (!MISSION_OUTCOMES.some((outcome) => outcome === choiceId)) return err('no-such-choice');
  const outcome = choiceId as MissionOutcome;
  const age = state.player.age;
  const source = mission.source;
  const draw = (key: string): number => unit(state, 'mission', mission.age, source, key);
  const parts: string[] = [pick(MISSION_LINES[outcome], `${mission.age}:${source}:${outcome}`)];

  let player: GameState['player'] = {
    ...state.player,
    stats: nudgeStats(state.player.stats, { happiness: MISSION_MOOD[outcome] }),
    stress: {
      ...state.player.stress,
      level: applyImmediateStress(
        state.player.stress.level,
        MISSION_STRESS[outcome],
        state.player.stats,
        state.player.personality,
      ),
    },
  };

  const agencyCareer = state.intel.career;
  const service = state.military.service;
  const rep = MISSION_REPUTATION[outcome];
  const perf = MISSION_PERFORMANCE[outcome];
  let intel: IntelState = { ...state.intel };
  let military: MilitaryState = state.military;
  let agency: AgencyCareer | undefined = agencyCareer && {
    ...agencyCareer,
    reputation: clampStat(agencyCareer.reputation + rep),
    performance: clampStat(agencyCareer.performance + perf),
  };
  let serving: ServiceCareer | undefined = service && {
    ...service,
    reputation: clampStat(service.reputation + rep),
    performance: clampStat(service.performance + perf),
  };

  /* ---- death: only after a disaster ---- */
  if (outcome === 'disaster' && draw('death') < INTEL_DEATH_ON_DISASTER[source]) {
    return ok(die(state, mission, player, parts, agency, serving));
  }

  /* ---- the clearance: only after a mistake or a disaster ---- */
  const lossChance =
    outcome === 'disaster'
      ? CLEARANCE_LOSS_ON_DISASTER
      : outcome === 'mistake'
        ? CLEARANCE_LOSS_ON_MISTAKE
        : 0;
  const lost = lossChance > 0 && draw('clearance') < lossChance;
  let records = player.records;
  const stamp = (record: NewLifeRecord) => {
    records = appendRecord(records, stampRecord(record, age, state.world.year, records.length));
  };
  if (lost) {
    parts.push(pick(CLEARANCE_LOST_LINES[source], `${mission.age}:${source}:lost`));
    intel = withoutClearance(intel, age);
    stamp({
      category: source === 'military' ? 'military' : 'career',
      label: 'Lost a security clearance',
    });
    if (source === 'military' && serving) {
      const open = openSpecialtyOf(serving.branch);
      serving = { ...serving, specialty: open.id };
    } else if (agency) {
      const row = agencyRow(agency.agency);
      const title = agencyTitle(agency.agency, agency.grade);
      const past = pastOf(
        agency,
        'clearance-lost',
        age,
        agency.years,
        agency.grade,
        agency.reputation,
        agency.highPay,
      );
      intel = { ...intel, past: [...state.intel.past, past] };
      agency = undefined;
      stamp({ category: 'career', label: `Separated from ${row.short} — ${title}` });
    }
  } else if (outcome === 'mistake' || outcome === 'disaster') {
    parts.push(pick(KEPT_CLEARANCE_LINES, `${mission.age}:${source}:kept`));
  }

  const { mission: _done, career: _careerGone, ...intelRest } = intel;
  intel = {
    ...intelRest,
    ...(agency ? { career: agency } : {}),
    missions: [...(state.intel.missions ?? []), { age, source, outcome }],
  };
  if (serving && service) military = { ...military, service: serving };

  const harmed = outcome === 'mistake' || outcome === 'disaster';
  const entry = entryFor(
    state,
    parts.join(' '),
    harmed ? 'milestone' : 'passive',
    `mission:${outcome}`,
  );
  player = {
    ...player,
    records,
    timeline: appendToTimeline(player.timeline, entry),
  };
  return ok({
    entry,
    state: {
      ...state,
      player,
      intel,
      military,
      pending: dropQuestion(state, INTEL_MISSION_EVENT_ID),
    },
  });
}

function die(
  state: GameState,
  mission: IntelMission,
  player: GameState['player'],
  parts: string[],
  agency: AgencyCareer | undefined,
  serving: ServiceCareer | undefined,
): IntelMissionOutcome {
  const age = state.player.age;
  const source = mission.source;
  parts.push(pick(MISSION_DEATH_LINES[source], `${mission.age}:${source}:death`));
  const entry = entryFor(state, parts.join(' '), 'milestone', 'mission:death');
  let records = player.records;
  const stamp = (record: NewLifeRecord) => {
    records = appendRecord(records, stampRecord(record, age, state.world.year, records.length));
  };
  let intel: IntelState = state.intel;
  let military: MilitaryState = state.military;
  if (source === 'military' && serving) {
    stamp({ category: 'military', label: 'Killed on an intelligence assignment' });
    const { service: _s, offer: _o, deployment: _d, ...rest } = state.military;
    const past: PastService = {
      branch: serving.branch,
      enlistedAge: serving.enlistedAge,
      endedAge: age,
      years: serving.years,
      track: serving.track,
      specialty: serving.specialty,
      finalGrade: serving.grade,
      reputation: serving.reputation,
      how: 'killed',
      discharge: 'honorable',
    };
    military = { ...rest, past: [...state.military.past, past] };
  } else if (agency) {
    const row = agencyRow(agency.agency);
    stamp({
      category: 'career',
      label: `Killed in the line of duty — ${row.short}`,
    });
    const past: PastAgency = {
      agency: agency.agency,
      enteredAge: agency.enteredAge,
      endedAge: age,
      years: agency.years,
      finalGrade: agency.grade,
      reputation: agency.reputation,
      how: 'killed',
      pension: 0,
    };
    const { career: _gone, ...rest } = state.intel;
    intel = { ...rest, past: [...state.intel.past, past] };
  }
  const { mission: _done, ...intelRest } = intel;
  intel = {
    ...intelRest,
    missions: [...(state.intel.missions ?? []), { age, source, outcome: 'disaster' }],
  };
  return {
    entry,
    state: {
      ...state,
      intel,
      military,
      health: {
        ...state.health,
        causeOfDeath: INTEL_DEATH_CAUSES[source],
        diedAtAge: age,
      },
      player: {
        ...player,
        alive: false,
        records,
        timeline: appendToTimeline(player.timeline, entry),
      },
      pending: [],
    },
  };
}
