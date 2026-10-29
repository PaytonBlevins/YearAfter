/**
 * Ticket 0901 — the service engine.
 *
 * Enlisted life in the Army: a recruiter's offer (or an application), a year of basic training that some do not
 * finish, nine grades on the real 2026 pay table, a performance read each year from Discipline, Smarts and Health (no
 * Charisma), promotion by time and that read, a four-year term, and at the end of it a question: stay four more years,
 * or leave. Twenty years ends in retirement. Work Harder, the button a civilian job has, feeds the same read.
 *
 * It is a state beside employment, as sports is: somebody who enlists leaves their job, and offers of civilian work stop
 * while they serve. Pay is gross basic pay, taxed and posted by `advanceYear` with the other earnings. Housing and food
 * are provided, so a single person's living costs are read at the at-home share; a person with a partner or a child at
 * home pays the whole household's.
 *
 * Every draw is a hash of the seed, the generation and a name, so no RNG stream is touched and a life that never
 * enlists replays exactly as before. Nothing here knows about deployments (0903), the other branches (0902) or what a
 * discharge leaves behind (0904); the state is shaped so they can add to it.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type LifeRecord,
  type NewLifeRecord,
  type TimelineEntry,
  type VisibleStatKey,
} from '@yearafter/character';
import { performanceYear, standingYear } from '@yearafter/careers';
import {
  BASIC_LINES,
  ENLISTED_GRADES,
  ENLIST_HEALTH_FLOOR,
  ENLIST_MAX_AGE,
  ENLIST_MIN_AGE,
  ENLIST_PROMPTS,
  ENLIST_SMARTS_FLOOR,
  LEAVE_LINES,
  NOT_RETAINED_LINES,
  REENLIST_PROMPTS,
  RETAIN_PERFORMANCE_FLOOR,
  RETIRE_AT_YEARS,
  RETIRE_LINES,
  RISE_LINES,
  TERM_YEARS,
  TOP_GRADE,
  WASH_OUT_LINES,
  YEAR_LINES,
  annualBasePay,
  enlistOfferChance,
  findGrade,
  findServiceBranch,
  riseChance,
  serviceFit,
  servicePerformanceTarget,
  washOutChance,
  washOutPay,
} from '@yearafter/content';
import { err, mixedUnit, ok, stablePick, type Result } from '@yearafter/core';
import { isInSchool, levelOf, type EducationState } from '@yearafter/education';
import type { PendingDecision } from '@yearafter/events';
import { isActingFullTime } from './acting';
import { resign } from './careers';
import { hasSystemicOffer, type GameState } from './game-state';
import type {
  MilitaryOffer,
  MilitaryState,
  PastService,
  ServiceBranch,
  ServiceCareer,
} from './military-state';
import { isModelingFullTime } from './modeling';
import { isMusicFullTime } from './music';
import { isFullTime as isSportsFullTime } from './sports-individual';
import { isPostFullTime } from './sports-post';

/** The reserved event id a service question is raised under. */
export const MILITARY_OFFER_EVENT_ID = 'military.offer';

export const isMilitaryOfferDecision = (eventId: string): boolean =>
  eventId === MILITARY_OFFER_EVENT_ID;

/** The recruiter's offer: join, or not. */
export const MILITARY_ENLIST = 'accept';
export const MILITARY_DECLINE = 'decline';
/** The end of a term: stay four years more, or go. */
export const MILITARY_REENLIST = 'reenlist';
export const MILITARY_LEAVE = 'leave';

/** A [0, 1) draw about one life, keyed on the seed and a name. No RNG stream is touched. */
const serviceUnit = (
  seed: string,
  generation: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`service:${seed}:${generation}:${parts.join(':')}`);

/** CORE_RULES 13.22: the base holds still for the life, the key moves it. */
const pick = (lines: readonly string[], key: string): string =>
  stablePick(lines, key) ?? '';

const dollarsWords = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`;

/* -------------------------------------------------------------------------- */
/* Reading a service life                                                      */
/* -------------------------------------------------------------------------- */

export const serviceOf = (state: GameState): ServiceCareer | undefined => state.military.service;

export const isServing = (state: GameState): boolean => state.military.service !== undefined;

/** The grade's title: "Sergeant". */
export const rankTitleOf = (career: ServiceCareer): string => findGrade(career.grade).title;

/** The header for somebody in uniform: "Sergeant, Army". */
export function militaryOccupation(military: MilitaryState): string | undefined {
  const career = military.service;
  if (!career) return undefined;
  const branch = findServiceBranch(career.branch);
  return `${rankTitleOf(career)}, ${branch?.short ?? 'Army'}`;
}

/** How a life reads the branch: "the Army". */
export const branchNameOf = (branch: ServiceBranch): string =>
  findServiceBranch(branch)?.name ?? 'the Army';

/** Basic pay for the year to come, whole dollars. What a screen can say a year in uniform pays. */
export const yearPayOf = (career: ServiceCareer): number =>
  annualBasePay(career.grade, career.years);

const fill = (line: string, title: string): string => line.replace('%title%', title);

/* -------------------------------------------------------------------------- */
/* Who can join                                                                */
/* -------------------------------------------------------------------------- */

export type EnlistError =
  | 'serving'
  | 'offer-pending'
  | 'too-young'
  | 'too-old'
  | 'in-school'
  | 'no-diploma'
  | 'unfit'
  | 'not-ready'
  | 'busy'
  | 'already-applied';

export const ENLIST_ERROR_LABELS: Readonly<Record<EnlistError, string>> = {
  serving: "You're already in uniform.",
  'offer-pending': 'There is a question waiting for you already.',
  'too-young': "You're too young to enlist.",
  'too-old': "You're too old to enlist.",
  'in-school': 'Finish school first. The recruiters will take you after.',
  'no-diploma': 'They need a diploma or an equivalent, and you have neither.',
  unfit: "The physical turned you away. You're not well enough for this yet.",
  'not-ready': "The aptitude test didn't go your way.",
  busy: 'You have a career that is your whole year already.',
  'already-applied': "You've already been to the recruiting office this year.",
};

/** Whether another full-time career holds the character's year. */
const holdsAnotherCareer = (state: GameState): boolean =>
  isSportsFullTime(state.sports.career) ||
  isPostFullTime(state.sports.post) ||
  isActingFullTime(state.acting) ||
  isMusicFullTime(state.music) ||
  isModelingFullTime(state.modeling);

/**
 * What stands between this character and the recruiting office at this age, or nothing. Read at the age asked for so
 * the yearly offer can be judged for the year being reached.
 */
export function enlistmentBar(
  state: GameState,
  age: number = state.player.age,
): Exclude<EnlistError, 'already-applied' | 'offer-pending'> | undefined {
  if (state.military.service) return 'serving';
  if (age < ENLIST_MIN_AGE) return 'too-young';
  if (age > ENLIST_MAX_AGE) return 'too-old';
  if (isInSchool(state.education)) return 'in-school';
  if (levelOf(state.education.credentials) === 'none') return 'no-diploma';
  if (state.player.stats.health < ENLIST_HEALTH_FLOOR) return 'unfit';
  if (state.player.stats.smarts < ENLIST_SMARTS_FLOOR) return 'not-ready';
  if (holdsAnotherCareer(state)) return 'busy';
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Writing it down                                                             */
/* -------------------------------------------------------------------------- */

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
    id: `t:${state.world.year}:military:${tag}:${sequence}`,
    sequence,
  });
}

const addRecord = (
  records: readonly LifeRecord[],
  record: NewLifeRecord,
  age: number,
  year: number,
): readonly LifeRecord[] => appendRecord(records, stampRecord(record, age, year, records.length));

/* -------------------------------------------------------------------------- */
/* Joining                                                                     */
/* -------------------------------------------------------------------------- */

/** A new recruit's career: the first year is basic training, at the bottom grade. */
function newCareer(state: GameState, branch: ServiceBranch): ServiceCareer {
  const row = findServiceBranch(branch);
  const posts = row?.posts ?? ['a post'];
  const post =
    posts[
      Math.floor(
        serviceUnit(state.rng.getSeed(), state.world.generation, 'post', state.player.age) *
          posts.length,
      )
    ] ?? 'a post';
  return {
    branch,
    stage: 'training',
    enlistedAge: state.player.age,
    grade: 1,
    years: 0,
    termEnds: TERM_YEARS,
    performance: 50,
    reputation: 50,
    effort: 'normal',
    lastPay: 0,
    post,
  };
}

export interface EnlistOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

/**
 * Put somebody in uniform. A held job is resigned first (as signing a pro contract does), the service is started at the
 * bottom grade, and the timeline and the life record say so. No pay yet: it is paid, with the year, by `advanceYear`.
 */
function startService(
  state: GameState,
  branch: ServiceBranch,
  extra: Partial<MilitaryState>,
): EnlistOutcome {
  const left = state.employment.job !== undefined ? resign(state) : undefined;
  const base = left && left.ok ? left.value.state : state;
  const name = branchNameOf(branch);
  const text = `You enlisted in ${name}. Basic training is next, and after that your first post.`;
  const entry = entryFor(base, text, 'milestone', 'enlist');
  const { offer: _spent, ...rest } = base.military;
  const military: MilitaryState = {
    ...rest,
    ...extra,
    service: newCareer(base, branch),
  };
  return {
    entry,
    state: {
      ...base,
      military,
      pending: base.pending.filter((row) => row.eventId !== MILITARY_OFFER_EVENT_ID),
      player: {
        ...base.player,
        timeline: appendToTimeline(base.player.timeline, entry),
        records: addRecord(
          base.player.records,
          {
            category: 'military',
            label: `Enlisted — ${findServiceBranch(branch)?.short ?? 'Army'}`,
          },
          base.player.age,
          base.world.year,
        ),
      },
    },
  };
}

/** Go to the recruiting office. One visit a year; the standards decide, there is no roll. */
export function applyToEnlist(
  state: GameState,
  branch: ServiceBranch = 'army',
): Result<EnlistOutcome, EnlistError> {
  if (state.military.appliedAge === state.player.age) return err('already-applied');
  if (state.military.offer) return err('offer-pending');
  const bar = enlistmentBar(state);
  if (bar) return err(bar);
  return ok(startService(state, branch, { appliedAge: state.player.age }));
}

/* -------------------------------------------------------------------------- */
/* The question                                                                */
/* -------------------------------------------------------------------------- */

function offerPrompt(offer: MilitaryOffer): string {
  if (offer.kind === 'enlist') {
    return pick(ENLIST_PROMPTS, `${offer.age}:${offer.branch}`);
  }
  const title = findGrade(offer.grade).title;
  return `${pick(REENLIST_PROMPTS, `${offer.age}:${offer.years}`)} You are a ${title.toLowerCase()} with ${offer.years} years in.`;
}

function offerChoices(offer: MilitaryOffer): PendingDecision['choices'] {
  if (offer.kind === 'enlist') {
    return [
      { id: MILITARY_ENLIST, label: 'Sign the papers' },
      { id: MILITARY_DECLINE, label: 'Not for me' },
    ];
  }
  return [
    { id: MILITARY_REENLIST, label: `Stay ${TERM_YEARS} more years` },
    { id: MILITARY_LEAVE, label: 'Leave the Army' },
  ];
}

export function militaryOfferDecision(offer: MilitaryOffer, year: number): PendingDecision {
  return {
    eventId: MILITARY_OFFER_EVENT_ID,
    category: 'career',
    age: offer.age,
    year,
    prompt: offerPrompt(offer),
    choices: offerChoices(offer),
    names: {},
  };
}

/**
 * Put the service's question on the table, if the year raised one. Called at the end of `advanceYear`; `hasSystemicOffer`
 * reads `military.offer`, so every other door stays shut behind it.
 */
export function withMilitaryOffer(state: GameState, alive: boolean): GameState {
  const offer = state.military.offer;
  if (!alive || !offer) return state;
  if (state.pending.some((row) => row.eventId === MILITARY_OFFER_EVENT_ID)) return state;
  return { ...state, pending: [...state.pending, militaryOfferDecision(offer, state.world.year)] };
}

export type MilitaryOfferError = 'no-offer' | 'no-such-choice';

export interface MilitaryOfferOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

/** Leave the service: the career becomes a record, and the person goes back to civilian life. */
function endService(
  state: GameState,
  how: PastService['how'],
  line: string,
  recordLabel: string,
  tag: string,
  age: number,
): MilitaryOfferOutcome {
  const career = state.military.service!;
  const past: PastService = {
    branch: career.branch,
    enlistedAge: career.enlistedAge,
    endedAge: age,
    years: career.years,
    finalGrade: career.grade,
    reputation: career.reputation,
    how,
    discharge: 'honorable',
  };
  const entry = entryFor(state, line, 'milestone', tag);
  const { service: _s, offer: _o, ...rest } = state.military;
  return {
    entry,
    state: {
      ...state,
      military: { ...rest, past: [...state.military.past, past] },
      pending: state.pending.filter((row) => row.eventId !== MILITARY_OFFER_EVENT_ID),
      player: {
        ...state.player,
        timeline: appendToTimeline(state.player.timeline, entry),
        records: addRecord(
          state.player.records,
          { category: 'military', label: recordLabel },
          state.player.age,
          state.world.year,
        ),
      },
    },
  };
}

export function answerMilitaryOffer(
  state: GameState,
  choiceId: string,
): Result<MilitaryOfferOutcome, MilitaryOfferError> {
  const offer = state.military.offer;
  if (!offer) return err('no-offer');
  if (!offerChoices(offer).some((choice) => choice.id === choiceId)) return err('no-such-choice');

  if (offer.kind === 'enlist') {
    if (choiceId === MILITARY_ENLIST) return ok(startService(state, offer.branch, {}));
    const { offer: _spent, ...rest } = state.military;
    const entry = entryFor(state, 'You told the recruiter no thanks.', 'passive', 'enlist:no');
    return ok({
      entry,
      state: {
        ...state,
        military: { ...rest, turnedDownAge: offer.age },
        pending: state.pending.filter((row) => row.eventId !== MILITARY_OFFER_EVENT_ID),
        player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      },
    });
  }

  const career = state.military.service;
  if (!career) {
    // The career was ended some other way while the question stood: drop it.
    const { offer: _gone, ...rest } = state.military;
    const entry = entryFor(state, 'The papers were no longer needed.', 'passive', 'reenlist:void');
    return ok({
      entry,
      state: {
        ...state,
        military: rest,
        pending: state.pending.filter((row) => row.eventId !== MILITARY_OFFER_EVENT_ID),
        player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      },
    });
  }
  const title = findGrade(career.grade).title;
  if (choiceId === MILITARY_LEAVE) {
    return ok(
      endService(
        state,
        'term',
        fill(pick(LEAVE_LINES, `${state.player.age}:leave`), title),
        `Left ${branchNameOf(career.branch)} — ${title}`,
        'leave',
        state.player.age,
      ),
    );
  }
  const { offer: _spent, ...rest } = state.military;
  const entry = entryFor(
    state,
    `You signed up for ${TERM_YEARS} more years as a ${title.toLowerCase()}.`,
    'milestone',
    'reenlist',
  );
  return ok({
    entry,
    state: {
      ...state,
      military: { ...rest, service: { ...career, termEnds: career.termEnds + TERM_YEARS } },
      pending: state.pending.filter((row) => row.eventId !== MILITARY_OFFER_EVENT_ID),
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
    },
  });
}

/* -------------------------------------------------------------------------- */
/* A year in uniform                                                           */
/* -------------------------------------------------------------------------- */

export interface MilitaryYearLine {
  readonly kind: 'passive' | 'milestone';
  readonly text: string;
}

export interface MilitaryYearInput {
  /** The state at the start of the year, before any phase ran. */
  readonly before: GameState;
  /** School as the year left it: somebody who graduated this year can be offered the next. */
  readonly education: EducationState;
  /** The age and the year being reached. */
  readonly age: number;
  readonly year: number;
}

export interface MilitaryYearOutput {
  readonly military: MilitaryState;
  readonly lines: readonly MilitaryYearLine[];
  readonly records: readonly NewLifeRecord[];
  /** Gross basic pay for the year, whole dollars. The caller taxes and posts it. */
  readonly pay: number;
  /** What a stat gets from the year, in `nudgeStats` terms. */
  readonly mood: number;
  readonly statDeltas: Partial<Record<VisibleStatKey, number>>;
  /** True when this year took somebody out of uniform. */
  readonly left: boolean;
}

const NONE_YEAR: Omit<MilitaryYearOutput, 'military'> = {
  lines: [],
  records: [],
  pay: 0,
  mood: 0,
  statDeltas: {},
  left: false,
};

/** Raise a recruiter's offer to somebody who meets the standards. No offer when another question is already standing. */
function recruiterOffer(
  before: GameState,
  education: EducationState,
  age: number,
  military: MilitaryState,
): MilitaryState {
  if (military.offer !== undefined || hasSystemicOffer(before)) return military;
  if (before.pending.length > 0) return military;
  if (military.turnedDownAge !== undefined && age - military.turnedDownAge < 2) return military;
  const chance = enlistOfferChance(age);
  const probe = { ...before, education, player: { ...before.player, age } };
  if (enlistmentBar(probe, age) !== undefined) return military;
  const seed = before.rng.getSeed();
  if (serviceUnit(seed, before.world.generation, 'offer', age) >= chance) return military;
  return {
    ...military,
    offer: { kind: 'enlist', branch: 'army', age, eventId: MILITARY_OFFER_EVENT_ID },
  };
}

export function runMilitaryYear(input: MilitaryYearInput): MilitaryYearOutput {
  const { before, education, age } = input;
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  let military = before.military;
  const career = military.service;

  if (!career) {
    return { military: recruiterOffer(before, education, age, military), ...NONE_YEAR };
  }

  const lines: MilitaryYearLine[] = [];
  const records: NewLifeRecord[] = [];
  const stats = before.player.stats;
  const years = career.years;
  const fit = serviceFit(stats.discipline, stats.health, stats.smarts);
  let mood = 0;
  const statDeltas: Partial<Record<VisibleStatKey, number>> = {};
  let pay = annualBasePay(career.grade, years);
  const pastRow = (how: PastService['how'], discipline: PastService['discharge']): PastService => ({
    branch: career.branch,
    enlistedAge: career.enlistedAge,
    endedAge: age,
    years,
    finalGrade: career.grade,
    reputation: career.reputation,
    how,
    discharge: discipline,
  });

  /* ---- basic training: the first year, and some do not finish ------------ */
  if (career.stage === 'training') {
    if (serviceUnit(seed, gen, 'basic', career.enlistedAge) < washOutChance(fit)) {
      pay = washOutPay();
      lines.push({ kind: 'milestone', text: pick(WASH_OUT_LINES, `${age}:washout`) });
      records.push({ category: 'military', label: 'Did not finish basic training' });
      const { service: _s, offer: _o, ...rest } = military;
      return {
        military: { ...rest, past: [...military.past, pastRow('washed-out', 'entry-level')] },
        lines,
        records,
        pay,
        mood: -6,
        statDeltas: {},
        left: true,
      };
    }
    lines.push({ kind: 'milestone', text: pick(BASIC_LINES, `${age}:basic`) });
    statDeltas.discipline = 2;
    statDeltas.health = 2;
  } else if (years < TERM_YEARS) {
    // A first term still builds discipline, a little.
    statDeltas.discipline = 1;
  }

  /* ---- how the work went ----------------------------------------------- */
  const target = servicePerformanceTarget(
    career.effort === 'hard',
    stats.discipline,
    stats.smarts,
    stats.health,
  );
  const performance = performanceYear(career.performance, target);
  const reputation = standingYear(career.reputation, performance);
  const nextYears = years + 1;

  /* ---- grade ---------------------------------------------------------- */
  let grade = career.grade;
  if (career.stage === 'training') {
    // A recruit who finishes basic is a private first class by the end of the first year.
    grade = Math.max(grade, 3);
  } else if (grade < TOP_GRADE) {
    const next = grade + 1;
    const row = ENLISTED_GRADES[next - 1]!;
    if (
      nextYears >= row.minYears &&
      serviceUnit(seed, gen, 'rise', age, next) < riseChance(next, performance)
    ) {
      grade = next;
      lines.push({
        kind: 'milestone',
        text: fill(pick(RISE_LINES, `${age}:rise:${next}`), row.title),
      });
      mood += 2;
      if (next >= 5) records.push({ category: 'military', label: `Promoted — ${row.title}` });
    }
  }
  if (career.stage !== 'training' && lines.length === 0) {
    lines.push({ kind: 'passive', text: pick(YEAR_LINES, `${age}:year`) });
  }

  const next: ServiceCareer = {
    ...career,
    stage: 'serving',
    grade,
    years: nextYears,
    performance,
    reputation,
    lastPay: pay,
  };

  /* ---- the end of a term --------------------------------------------- */
  if (nextYears >= career.termEnds && military.offer === undefined) {
    const title = findGrade(grade).title;
    if (nextYears >= RETIRE_AT_YEARS) {
      lines.push({ kind: 'milestone', text: fill(pick(RETIRE_LINES, `${age}:retire`), title) });
      records.push({ category: 'military', label: `Retired from the Army — ${title}` });
      const { service: _s, offer: _o, ...rest } = military;
      return {
        military: {
          ...rest,
          past: [
            ...military.past,
            {
              branch: next.branch,
              enlistedAge: next.enlistedAge,
              endedAge: age,
              years: nextYears,
              finalGrade: grade,
              reputation,
              how: 'retired',
              discharge: 'honorable',
            },
          ],
        },
        lines,
        records,
        pay,
        mood: mood + 2,
        statDeltas,
        left: true,
      };
    }
    if (performance < RETAIN_PERFORMANCE_FLOOR) {
      lines.push({
        kind: 'milestone',
        text: fill(pick(NOT_RETAINED_LINES, `${age}:notretained`), title),
      });
      records.push({ category: 'military', label: `Left the Army — ${title}` });
      const { service: _s, offer: _o, ...rest } = military;
      return {
        military: {
          ...rest,
          past: [
            ...military.past,
            {
              branch: next.branch,
              enlistedAge: next.enlistedAge,
              endedAge: age,
              years: nextYears,
              finalGrade: grade,
              reputation,
              how: 'not-retained',
              discharge: 'honorable',
            },
          ],
        },
        lines,
        records,
        pay,
        mood,
        statDeltas,
        left: true,
      };
    }
    military = {
      ...military,
      offer: {
        kind: 'reenlist',
        branch: next.branch,
        grade,
        years: nextYears,
        age,
        eventId: MILITARY_OFFER_EVENT_ID,
      },
    };
  }

  return {
    military: { ...military, service: next },
    lines,
    records,
    pay,
    mood,
    statDeltas,
    left: false,
  };
}

/** A line saying what the pay is, for a screen. */
export const payWords = (career: ServiceCareer): string =>
  `${dollarsWords(yearPayOf(career))} a year`;
