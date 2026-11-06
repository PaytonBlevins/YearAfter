/**
 * Tickets 0901 and 0902 — the service engine.
 *
 * Life in uniform. A recruiter's offer (or an application) with a branch and a specialty to choose, a year of basic
 * training (or officer training) that some do not finish, nine enlisted grades or six officer grades on the real 2026
 * pay tables, a performance read each year from Discipline, Smarts and Health (no Charisma), promotion by time and that
 * read, a four-year term, and at the end of it a question: stay four more years, or leave. Twenty years of service opens
 * retirement, a choice from then on, and 65 is a hard stop. Work Harder, the button a civilian job has, feeds the same
 * read.
 *
 * Officers (0902): a bachelor's degree and an application, or a serving enlisted member a board picks. An officer's year
 * of training can end in a wash-out; an enlisted member who fails it goes back to the ranks exactly as they were.
 *
 * It is a state beside employment, as sports is: somebody who enlists leaves their job, and offers of civilian work stop
 * while they serve. Pay is gross basic pay, taxed and posted by `advanceYear` with the other earnings. Housing and food
 * are provided, so a single person's living costs are read at the at-home share; a person with a partner or a child at
 * home pays the whole household's.
 *
 * Every draw is a hash of the seed, the generation and a name, so no RNG stream is touched and a life that never
 * enlists replays exactly as before. Nothing here knows about deployments (0903) or what a discharge leaves behind
 * (0904); the state is shaped so they can add to it.
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
  AGE_RETIRE_LINES,
  BASIC_LINES,
  BRANCH_PROMPTS,
  COMMISSION_BOARD_MIN_YEARS,
  COMMISSION_BOARD_PASSED,
  COMMISSION_BOARD_PICKED,
  ENLISTED_GRADES,
  ENLIST_HEALTH_FLOOR,
  ENLIST_MIN_AGE,
  ENLIST_PROMPTS,
  LEAVE_LINES,
  MANDATORY_RETIRE_AGE,
  NOT_RETAINED_LINES,
  O3_PASS_OVER_YEARS,
  OFFICER_RETURN_LINES,
  OFFICER_RISE_LINES,
  OFFICER_TOP_GRADE,
  OFFICER_TRAINING_LINES,
  OFFICER_WASH_OUT_LINES,
  OFFICER_YEAR_LINES,
  PASSED_OVER_LINES,
  REENLIST_PROMPTS,
  RETAIN_PERFORMANCE_FLOOR,
  RETIRE_ELIGIBLE_YEARS,
  RETIRE_LINES,
  RETIRE_PROMPTS,
  RISE_LINES,
  SERVICE_BRANCH_IDS,
  SKILL_LINES,
  SPECIALTY_PROMPTS,
  TERM_YEARS,
  TOP_GRADE,
  TRACK_PROMPTS,
  WASH_OUT_LINES,
  YEAR_LINES,
  annualBasePay,
  commissionAgeLimit,
  commissionBoardChance,
  enlistAgeLimit,
  enlistOfferChance,
  findOfficerGrade,
  findServiceBranch,
  findSpecialty,
  isServiceBranchId,
  officerRiseChance,
  officerWashOutChance,
  officerWashOutPay,
  openSpecialtyOf,
  rankTitle,
  riseChance,
  serviceFit,
  servicePerformanceTarget,
  smartsFloorOf,
  specialtiesOf,
  specialtyBar,
  washOutChance,
  washOutPay,
  type ServiceBranchRow,
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
  ServiceTrack,
} from './military-state';
import { isModelingFullTime } from './modeling';
import { isMusicFullTime } from './music';
import { isFullTime as isSportsFullTime } from './sports-individual';
import { isPostFullTime } from './sports-post';

/** The reserved event id a service question is raised under. */
export const MILITARY_OFFER_EVENT_ID = 'military.offer';

export const isMilitaryOfferDecision = (eventId: string): boolean =>
  eventId === MILITARY_OFFER_EVENT_ID;

/** Turning the recruiter down, at any step of the offer. */
export const MILITARY_DECLINE = 'decline';
/** The end of a term: stay four years more, or go (retire, with twenty years in). */
export const MILITARY_REENLIST = 'reenlist';
export const MILITARY_LEAVE = 'leave';

/** The two ladders, as the choice ids of the step that asks. */
export const TRACK_ENLISTED: ServiceTrack = 'enlisted';
export const TRACK_OFFICER: ServiceTrack = 'officer';

/** A [0, 1) draw about one life, keyed on the seed and a name. No RNG stream is touched. */
const serviceUnit = (
  seed: string,
  generation: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`service:${seed}:${generation}:${parts.join(':')}`);

/** CORE_RULES 13.22: the base holds still for the life, the key moves it. */
const pick = (lines: readonly string[], key: string): string => stablePick(lines, key) ?? '';

const dollarsWords = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`;

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const WEEK_WORDS: Readonly<Record<number, string>> = {
  8: 'eight',
  10: 'ten',
  13: 'thirteen',
};

/* -------------------------------------------------------------------------- */
/* Reading a service life                                                      */
/* -------------------------------------------------------------------------- */

export const serviceOf = (state: GameState): ServiceCareer | undefined => state.military.service;

export const isServing = (state: GameState): boolean => state.military.service !== undefined;

/** The branch's row, or the Army's if the id is somehow unknown. */
const branchRow = (branch: string): ServiceBranchRow =>
  findServiceBranch(branch) ?? (findServiceBranch('army') as ServiceBranchRow);

/** The grade's title in the branch's own words: "Sergeant", "Petty Officer Second Class", "Captain". */
export const rankTitleOf = (career: ServiceCareer): string =>
  rankTitle(career.branch, career.track, career.grade);

/** The header for somebody in uniform: "Sergeant, Army". */
export function militaryOccupation(military: MilitaryState): string | undefined {
  const career = military.service;
  if (!career) return undefined;
  return `${rankTitleOf(career)}, ${branchRow(career.branch).short}`;
}

/** How a life reads the branch: "the Army". */
export const branchNameOf = (branch: ServiceBranch): string => branchRow(branch).name;

/** The name of the specialty, or the branch's open one's if the id is unknown. */
export const specialtyNameOf = (career: ServiceCareer): string =>
  (findSpecialty(career.specialty) ?? openSpecialtyOf(career.branch)).name;

/**
 * Basic pay for the year to come, whole dollars. What a screen can say a year in uniform pays. An enlisted member in
 * officer training is still paid as the rank they came from, which is what the year pays.
 */
export const yearPayOf = (career: ServiceCareer): number =>
  career.stage === 'training' && career.prior
    ? annualBasePay(career.prior.grade, career.years, 'enlisted')
    : annualBasePay(career.grade, career.years, career.track);

interface LineWords {
  readonly title?: string;
  readonly years?: number;
}

/** Fill a line's tokens from the branch it is about. A token the line doesn't have is left alone. */
function fill(line: string, branch: ServiceBranch, words: LineWords = {}): string {
  const row = branchRow(branch);
  const weeks = WEEK_WORDS[row.trainingWeeks] ?? String(row.trainingWeeks);
  return line
    .replaceAll('%title%', words.title ?? '')
    .replaceAll('%years%', String(words.years ?? ''))
    .replaceAll('%Branch%', capital(row.name))
    .replaceAll('%branch%', row.name)
    .replaceAll('%short%', row.short)
    .replaceAll('%Training%', capital(row.training))
    .replaceAll('%training%', row.training)
    .replaceAll('%weeks%', weeks)
    .replaceAll('%school%', row.officerSchool);
}

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
  | 'no-degree'
  | 'unfit'
  | 'not-ready'
  | 'busy'
  | 'already-applied'
  | 'no-such-branch'
  | 'no-such-specialty'
  | 'specialty-bar';

export const ENLIST_ERROR_LABELS: Readonly<Record<EnlistError, string>> = {
  serving: "You're already in uniform.",
  'offer-pending': 'There is a question waiting for you already.',
  'too-young': "You're too young to enlist.",
  'too-old': "You're too old for that branch.",
  'in-school': 'Finish school first. The recruiters will take you after.',
  'no-diploma': 'They need a diploma or an equivalent, and you have neither.',
  'no-degree': "A commission takes a bachelor's degree, and you don't have one.",
  unfit: "The physical turned you away. You're not well enough for this yet.",
  'not-ready': "The aptitude test didn't go your way.",
  busy: 'You have a career that is your whole year already.',
  'already-applied': "You've already been to the recruiting office this year.",
  'no-such-branch': "That isn't a branch.",
  'no-such-specialty': "That job isn't one that branch has.",
  'specialty-bar': "You don't qualify for that job yet.",
};

/** Whether another full-time career holds the character's year. */
const holdsAnotherCareer = (state: GameState): boolean =>
  isSportsFullTime(state.sports.career) ||
  isPostFullTime(state.sports.post) ||
  isActingFullTime(state.acting) ||
  isMusicFullTime(state.music) ||
  isModelingFullTime(state.modeling);

/** Whether another field has a question standing: a contract, a part, a record deal, a job. */
const otherFieldAsking = (state: GameState): boolean =>
  state.sports.offer !== undefined ||
  state.acting.offers.length > 0 ||
  state.music.offer !== undefined ||
  state.modeling.offers.length > 0;

/** Whether somebody holds at least a bachelor's degree. */
export const holdsDegree = (education: EducationState): boolean => {
  const level = levelOf(education.credentials);
  return level === 'university' || level === 'postgraduate';
};

type BarError = Exclude<
  EnlistError,
  'already-applied' | 'offer-pending' | 'no-such-branch' | 'no-such-specialty' | 'specialty-bar'
>;

/**
 * What stands between this character and the recruiting office of a branch at this age, or nothing. Read at the age
 * asked for so the yearly offer can be judged for the year being reached. The Army and the enlisted ladder are the
 * default, which is what 0901 asked.
 */
export function enlistmentBar(
  state: GameState,
  age: number = state.player.age,
  branch: ServiceBranch = 'army',
  track: ServiceTrack = 'enlisted',
): BarError | undefined {
  if (state.military.service) return 'serving';
  if (age < ENLIST_MIN_AGE) return 'too-young';
  const limit = track === 'officer' ? commissionAgeLimit(branch) : enlistAgeLimit(branch);
  if (age > limit) return 'too-old';
  if (isInSchool(state.education)) return 'in-school';
  if (levelOf(state.education.credentials) === 'none') return 'no-diploma';
  if (track === 'officer' && !holdsDegree(state.education)) return 'no-degree';
  if (state.player.stats.health < ENLIST_HEALTH_FLOOR) return 'unfit';
  if (state.player.stats.smarts < smartsFloorOf(branch)) return 'not-ready';
  if (holdsAnotherCareer(state)) return 'busy';
  return undefined;
}

/** The branches somebody can walk up to at this age: every one whose standards they meet. */
export const eligibleBranches = (
  state: GameState,
  age: number = state.player.age,
): readonly ServiceBranch[] =>
  SERVICE_BRANCH_IDS.filter((branch) => enlistmentBar(state, age, branch) === undefined);

/** The specialties of a branch this character has the aptitude for. The branch's open one is always among them. */
export const qualifyingSpecialties = (state: GameState, branch: string): readonly string[] =>
  specialtiesOf(branch)
    .filter((row) => specialtyBar(row, state.player.stats) === undefined)
    .map((row) => row.id);

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

/** What is kept of a career once it ends. */
function pastOf(
  career: ServiceCareer,
  how: PastService['how'],
  discharge: PastService['discharge'],
  at: {
    readonly age: number;
    readonly years: number;
    readonly grade: number;
    readonly reputation: number;
  },
): PastService {
  return {
    branch: career.branch,
    enlistedAge: career.enlistedAge,
    endedAge: at.age,
    years: at.years,
    track: career.track,
    specialty: career.specialty,
    finalGrade: at.grade,
    reputation: at.reputation,
    how,
    discharge,
  };
}

/* -------------------------------------------------------------------------- */
/* Joining                                                                     */
/* -------------------------------------------------------------------------- */

/** A new recruit's career: the first year is basic training (or officer training), at the bottom grade. */
function newCareer(
  state: GameState,
  branch: ServiceBranch,
  track: ServiceTrack,
  specialty: string,
): ServiceCareer {
  const posts = branchRow(branch).posts;
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
    track,
    specialty,
    grade: 1,
    commissionedAt: 0,
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
  track: ServiceTrack,
  specialty: string,
  extra: Partial<MilitaryState>,
): EnlistOutcome {
  const left = state.employment.job !== undefined ? resign(state) : undefined;
  const base = left && left.ok ? left.value.state : state;
  const row = branchRow(branch);
  const text =
    track === 'officer'
      ? `You were accepted to ${row.officerSchool} in ${row.name}. A commission is the end of it, if you finish.`
      : `You enlisted in ${row.name}. ${capital(row.training)} is next, and after that your first post.`;
  const entry = entryFor(base, text, 'milestone', track === 'officer' ? 'commission' : 'enlist');
  const { offer: _spent, ...rest } = base.military;
  const military: MilitaryState = {
    ...rest,
    ...extra,
    service: newCareer(base, branch, track, specialty),
  };
  return {
    entry,
    state: {
      ...base,
      military,
      pending: base.pending.filter((pending) => pending.eventId !== MILITARY_OFFER_EVENT_ID),
      player: {
        ...base.player,
        timeline: appendToTimeline(base.player.timeline, entry),
        records: addRecord(
          base.player.records,
          {
            category: 'military',
            label:
              track === 'officer' ? `Officer training — ${row.short}` : `Enlisted — ${row.short}`,
          },
          base.player.age,
          base.world.year,
        ),
      },
    },
  };
}

/** Go to the recruiting office, with a branch, a job and a ladder chosen. One visit a year; the standards decide. */
export function applyToEnlist(
  state: GameState,
  branch: ServiceBranch = 'army',
  specialty?: string,
  track: ServiceTrack = 'enlisted',
): Result<EnlistOutcome, EnlistError> {
  if (!isServiceBranchId(branch)) return err('no-such-branch');
  if (state.military.appliedAge === state.player.age) return err('already-applied');
  if (state.military.offer || otherFieldAsking(state)) return err('offer-pending');
  const bar = enlistmentBar(state, state.player.age, branch, track);
  if (bar) return err(bar);
  const job = specialty === undefined ? openSpecialtyOf(branch) : findSpecialty(specialty);
  if (!job || job.branch !== branch) return err('no-such-specialty');
  if (specialtyBar(job, state.player.stats) !== undefined) return err('specialty-bar');
  return ok(startService(state, branch, track, job.id, { appliedAge: state.player.age }));
}

/* -------------------------------------------------------------------------- */
/* The question                                                                */
/* -------------------------------------------------------------------------- */

const TRACK_LABELS: Readonly<Record<ServiceTrack, string>> = {
  enlisted: 'Enlist',
  officer: 'Apply for a commission',
};

/**
 * What the next question of a recruiter's offer is, given what has been chosen: the branch, then the ladder (asked only
 * of somebody with a degree, since without one there is only the enlisted ladder), then the job.
 */
function planEnlist(
  state: GameState,
  age: number,
  chosen: { readonly branch?: ServiceBranch; readonly track?: ServiceTrack },
): Pick<Extract<MilitaryOffer, { kind: 'enlist' }>, 'step' | 'options' | 'branch' | 'track'> {
  const branch = chosen.branch;
  if (branch === undefined) return { step: 'branch', options: eligibleBranches(state, age) };
  let track = chosen.track;
  if (track === undefined) {
    if (enlistmentBar(state, age, branch, 'officer') === undefined) {
      return { step: 'track', options: [TRACK_ENLISTED, TRACK_OFFICER], branch };
    }
    track = TRACK_ENLISTED;
  }
  return { step: 'specialty', options: qualifyingSpecialties(state, branch), branch, track };
}

function offerPrompt(offer: MilitaryOffer): string {
  if (offer.kind === 'enlist') {
    const key = `${offer.age}:${offer.step}`;
    const intro = offer.intro ? `${pick(ENLIST_PROMPTS, `${offer.age}`)} ` : '';
    if (offer.step === 'branch') return `${intro}${pick(BRANCH_PROMPTS, key)}`;
    if (offer.step === 'track') return `${intro}${pick(TRACK_PROMPTS, key)}`;
    return `${intro}${fill(pick(SPECIALTY_PROMPTS, key), offer.branch ?? 'army')}`;
  }
  const title = rankTitle(offer.branch, offer.track ?? 'enlisted', offer.grade).toLowerCase();
  const lines = offer.years >= RETIRE_ELIGIBLE_YEARS ? RETIRE_PROMPTS : REENLIST_PROMPTS;
  const ask = fill(pick(lines, `${offer.age}:${offer.years}`), offer.branch);
  return `${ask} You are a ${title} with ${offer.years} years in.`;
}

function offerChoices(offer: MilitaryOffer): PendingDecision['choices'] {
  if (offer.kind === 'enlist') {
    const no = { id: MILITARY_DECLINE, label: 'Not for me' };
    if (offer.step === 'branch') {
      return [...offer.options.map((id) => ({ id, label: branchRow(id).short })), no];
    }
    if (offer.step === 'track') {
      return [
        ...offer.options.map((id) => ({ id, label: TRACK_LABELS[id as ServiceTrack] ?? id })),
        no,
      ];
    }
    return [...offer.options.map((id) => ({ id, label: findSpecialty(id)?.name ?? id })), no];
  }
  return [
    { id: MILITARY_REENLIST, label: `Stay ${TERM_YEARS} more years` },
    {
      id: MILITARY_LEAVE,
      label:
        offer.years >= RETIRE_ELIGIBLE_YEARS ? 'Retire' : `Leave ${branchRow(offer.branch).name}`,
    },
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

/** The ways a career can end with a line and a label. */
const dropQuestion = (state: GameState): GameState['pending'] =>
  state.pending.filter((row) => row.eventId !== MILITARY_OFFER_EVENT_ID);

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
  const past = pastOf(career, how, 'honorable', {
    age,
    years: career.years,
    grade: career.grade,
    reputation: career.reputation,
  });
  const entry = entryFor(state, line, 'milestone', tag);
  const { service: _s, offer: _o, ...rest } = state.military;
  return {
    entry,
    state: {
      ...state,
      military: { ...rest, past: [...state.military.past, past] },
      pending: dropQuestion(state),
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

export type ServiceRetireError = 'not-serving' | 'too-soon';

/**
 * Retire, by choice. Open from twenty years of service, and not during training. A retirement ends the service and starts
 * nothing: pay and benefits for a retiree are 0904.
 */
export function retireFromService(
  state: GameState,
): Result<MilitaryOfferOutcome, ServiceRetireError> {
  const career = state.military.service;
  if (!career) return err('not-serving');
  if (career.stage === 'training' || career.years < RETIRE_ELIGIBLE_YEARS) return err('too-soon');
  const title = rankTitleOf(career);
  return ok(
    endService(
      state,
      'retired',
      fill(pick(RETIRE_LINES, `${state.player.age}:retire`), career.branch, {
        title,
        years: career.years,
      }),
      `Retired from ${branchNameOf(career.branch)} — ${title}`,
      'retire',
      state.player.age,
    ),
  );
}

export function answerMilitaryOffer(
  state: GameState,
  choiceId: string,
): Result<MilitaryOfferOutcome, MilitaryOfferError> {
  const offer = state.military.offer;
  if (!offer) return err('no-offer');
  if (!offerChoices(offer).some((choice) => choice.id === choiceId)) return err('no-such-choice');

  if (offer.kind === 'enlist') {
    if (choiceId === MILITARY_DECLINE) {
      const { offer: _spent, ...rest } = state.military;
      const entry = entryFor(state, 'You told the recruiter no thanks.', 'passive', 'enlist:no');
      return ok({
        entry,
        state: {
          ...state,
          military: { ...rest, turnedDownAge: offer.age },
          pending: dropQuestion(state),
          player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
        },
      });
    }
    if (offer.step === 'specialty') {
      return ok(
        startService(state, offer.branch ?? 'army', offer.track ?? TRACK_ENLISTED, choiceId, {}),
      );
    }
    // A branch or a ladder was chosen: ask what comes next, with this answer remembered.
    const chosen =
      offer.step === 'branch'
        ? { branch: choiceId as ServiceBranch }
        : { branch: offer.branch, track: choiceId as ServiceTrack };
    const next: MilitaryOffer = {
      kind: 'enlist',
      age: offer.age,
      eventId: offer.eventId,
      ...planEnlist(state, offer.age, chosen),
    };
    const said =
      offer.step === 'branch'
        ? `You asked the ${branchRow(choiceId).short} recruiter what they had.`
        : choiceId === TRACK_OFFICER
          ? 'You asked about a commission.'
          : 'You said you would enlist.';
    const entry = entryFor(state, said, 'passive', `enlist:${offer.step}`);
    return ok({
      entry,
      state: {
        ...state,
        military: { ...state.military, offer: next },
        pending: [...dropQuestion(state), militaryOfferDecision(next, state.world.year)],
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
        pending: dropQuestion(state),
        player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      },
    });
  }
  const title = rankTitleOf(career);
  if (choiceId === MILITARY_LEAVE) {
    const retiring = career.years >= RETIRE_ELIGIBLE_YEARS;
    return ok(
      endService(
        state,
        retiring ? 'retired' : 'term',
        retiring
          ? fill(pick(RETIRE_LINES, `${state.player.age}:retire`), career.branch, {
              title,
              years: career.years,
            })
          : fill(pick(LEAVE_LINES, `${state.player.age}:leave`), career.branch, { title }),
        retiring
          ? `Retired from ${branchNameOf(career.branch)} — ${title}`
          : `Left ${branchNameOf(career.branch)} — ${title}`,
        retiring ? 'retire' : 'leave',
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
      pending: dropQuestion(state),
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
    },
  });
}

/* -------------------------------------------------------------------------- */
/* A commission                                                                */
/* -------------------------------------------------------------------------- */

export type CommissionError =
  | 'not-serving'
  | 'already-an-officer'
  | 'in-training'
  | 'too-soon'
  | 'no-degree'
  | 'too-old'
  | 'unfit'
  | 'already-applied'
  | 'offer-pending';

export const COMMISSION_ERROR_LABELS: Readonly<Record<CommissionError, string>> = {
  'not-serving': "You're not in uniform.",
  'already-an-officer': "You're an officer already.",
  'in-training': 'Finish your training first.',
  'too-soon': "You haven't served long enough for a board to look at you.",
  'no-degree': "A commission takes a bachelor's degree, and you don't have one.",
  'too-old': "You're too old for a commission in this branch.",
  unfit: "The physical turned you away. You're not well enough for this yet.",
  'already-applied': "You've already put in a package this year.",
  'offer-pending': 'There is a question waiting for you already.',
};

export interface CommissionOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  /** True when the board picked them. */
  readonly picked: boolean;
}

/**
 * A serving enlisted member with a degree puts in a package. A board decides, and the chance is the member's
 * performance read through `commissionBoardChance`. One package a year. A pick starts officer training: the training year
 * runs as the first year of the new career, and an enlisted member who doesn't finish goes back to what they were.
 */
export function applyForCommission(state: GameState): Result<CommissionOutcome, CommissionError> {
  const career = state.military.service;
  if (!career) return err('not-serving');
  if (career.track === 'officer') return err('already-an-officer');
  if (career.stage === 'training') return err('in-training');
  if (state.military.commissionAppliedAge === state.player.age) return err('already-applied');
  if (state.military.offer || otherFieldAsking(state)) return err('offer-pending');
  if (career.years < COMMISSION_BOARD_MIN_YEARS) return err('too-soon');
  if (!holdsDegree(state.education)) return err('no-degree');
  if (state.player.age > commissionAgeLimit(career.branch)) return err('too-old');
  if (state.player.stats.health < ENLIST_HEALTH_FLOOR) return err('unfit');

  const age = state.player.age;
  const picked =
    serviceUnit(state.rng.getSeed(), state.world.generation, 'board', age) <
    commissionBoardChance(career.performance);
  const lines = picked ? COMMISSION_BOARD_PICKED : COMMISSION_BOARD_PASSED;
  const entry = entryFor(
    state,
    fill(pick(lines, `${age}:board`), career.branch),
    picked ? 'milestone' : 'passive',
    picked ? 'board:picked' : 'board:passed',
  );
  const service: ServiceCareer = picked
    ? {
        ...career,
        track: 'officer',
        stage: 'training',
        grade: 1,
        commissionedAt: career.years,
        prior: { grade: career.grade, termEnds: career.termEnds },
        termEnds: career.years + TERM_YEARS,
        effort: 'normal',
      }
    : career;
  return ok({
    picked,
    entry,
    state: {
      ...state,
      military: { ...state.military, service, commissionAppliedAge: age },
      player: {
        ...state.player,
        timeline: appendToTimeline(state.player.timeline, entry),
        records: picked
          ? addRecord(
              state.player.records,
              {
                category: 'military',
                label: `Selected for officer training — ${branchRow(career.branch).short}`,
              },
              age,
              state.world.year,
            )
          : state.player.records,
      },
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
    offer: {
      kind: 'enlist',
      age,
      eventId: MILITARY_OFFER_EVENT_ID,
      intro: true,
      ...planEnlist(probe, age, {}),
    },
  };
}

/** The year's line, from the kind of work the specialty is, or from the ordinary ones. */
function yearLine(career: ServiceCareer, age: number): string {
  const skill = (findSpecialty(career.specialty) ?? openSpecialtyOf(career.branch)).skill;
  const ordinary = career.track === 'officer' ? OFFICER_YEAR_LINES : YEAR_LINES;
  return pick([...ordinary, ...SKILL_LINES[skill]], `${age}:year`);
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
  const branch = career.branch;
  const track = career.track;
  const officer = track === 'officer';
  const training = career.stage === 'training';
  const fit = serviceFit(stats.discipline, stats.health, stats.smarts);
  let mood = 0;
  const statDeltas: Partial<Record<VisibleStatKey, number>> = {};
  // An enlisted member in officer training is still paid as what they were.
  let pay =
    training && career.prior
      ? annualBasePay(career.prior.grade, years, 'enlisted')
      : annualBasePay(career.grade, years, track);
  const titleOf = (grade: number, onTrack: ServiceTrack = track): string =>
    rankTitle(branch, onTrack, grade);

  /* ---- the first year: basic training, or officer training --------------- */
  if (training) {
    const failed = officer
      ? serviceUnit(seed, gen, 'ocs', age) < officerWashOutChance(fit)
      : serviceUnit(seed, gen, 'basic', career.enlistedAge) < washOutChance(fit);
    if (failed && officer && career.prior) {
      // Back to the ranks, exactly as they were, a year of service older.
      const { prior, ...rest } = career;
      const back: ServiceCareer = {
        ...rest,
        track: 'enlisted',
        stage: 'serving',
        grade: prior.grade,
        commissionedAt: 0,
        termEnds: prior.termEnds,
        years: years + 1,
        lastPay: pay,
      };
      lines.push({
        kind: 'milestone',
        text: fill(pick(OFFICER_RETURN_LINES, `${age}:ocs:return`), branch, {
          title: titleOf(prior.grade, 'enlisted'),
        }),
      });
      return {
        military: { ...military, service: back },
        lines,
        records,
        pay,
        mood: -3,
        statDeltas: {},
        left: false,
      };
    }
    if (failed) {
      pay = officer ? officerWashOutPay(years) : washOutPay();
      const washLines = officer ? OFFICER_WASH_OUT_LINES : WASH_OUT_LINES;
      lines.push({ kind: 'milestone', text: fill(pick(washLines, `${age}:washout`), branch) });
      records.push({
        category: 'military',
        label: officer ? 'Did not finish officer training' : 'Did not finish basic training',
      });
      const { service: _s, offer: _o, ...rest } = military;
      return {
        military: {
          ...rest,
          past: [
            ...military.past,
            pastOf(career, 'washed-out', 'entry-level', {
              age,
              years,
              grade: career.grade,
              reputation: career.reputation,
            }),
          ],
        },
        lines,
        records,
        pay,
        mood: -6,
        statDeltas: {},
        left: true,
      };
    }
    if (officer) {
      lines.push({
        kind: 'milestone',
        text: fill(pick(OFFICER_TRAINING_LINES, `${age}:ocs`), branch, { title: titleOf(1) }),
      });
      statDeltas.discipline = 2;
      statDeltas.smarts = 1;
    } else {
      lines.push({ kind: 'milestone', text: fill(pick(BASIC_LINES, `${age}:basic`), branch) });
      statDeltas.discipline = 2;
      statDeltas.health = 2;
    }
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
  const commissioned = nextYears - career.commissionedAt;

  /* ---- grade ---------------------------------------------------------- */
  let grade = career.grade;
  if (training) {
    // A recruit who finishes basic is at the third enlisted grade by the end of the first year; a candidate who
    // finishes officer training is a second lieutenant, or an ensign.
    grade = officer ? 1 : Math.max(grade, 3);
  } else if (!officer && grade < TOP_GRADE) {
    const next = grade + 1;
    const row = ENLISTED_GRADES[next - 1]!;
    if (
      nextYears >= row.minYears &&
      serviceUnit(seed, gen, 'rise', age, next) < riseChance(next, performance)
    ) {
      grade = next;
      lines.push({
        kind: 'milestone',
        text: fill(pick(RISE_LINES, `${age}:rise:${next}`), branch, { title: titleOf(next) }),
      });
      mood += 2;
      if (next >= 5) {
        records.push({ category: 'military', label: `Promoted — ${titleOf(next)}` });
      }
    }
  } else if (officer && grade < OFFICER_TOP_GRADE) {
    const next = grade + 1;
    const row = findOfficerGrade(next);
    if (
      commissioned >= row.minYears &&
      serviceUnit(seed, gen, 'orise', age, next) < officerRiseChance(next, performance)
    ) {
      grade = next;
      lines.push({
        kind: 'milestone',
        text: fill(pick(OFFICER_RISE_LINES, `${age}:orise:${next}`), branch, {
          title: titleOf(next),
        }),
      });
      mood += 2;
      if (next >= 3) records.push({ category: 'military', label: `Promoted — ${titleOf(next)}` });
    }
  }
  if (!training && lines.length === 0) {
    lines.push({ kind: 'passive', text: yearLine(career, age) });
  }

  const { prior: _prior, ...careerBase } = career;
  const next: ServiceCareer = {
    ...careerBase,
    stage: 'serving',
    grade,
    years: nextYears,
    performance,
    reputation,
    lastPay: pay,
  };
  const title = titleOf(grade);
  const leave = (
    how: PastService['how'],
    line: string,
    label: string,
    moodNow: number,
  ): MilitaryYearOutput => {
    lines.push({ kind: 'milestone', text: line });
    records.push({ category: 'military', label });
    const { service: _s, offer: _o, ...rest } = military;
    return {
      military: {
        ...rest,
        past: [
          ...military.past,
          pastOf(career, how, 'honorable', {
            age,
            years: nextYears,
            grade,
            reputation,
          }),
        ],
      },
      lines,
      records,
      pay,
      mood: moodNow,
      statDeltas,
      left: true,
    };
  };
  const retiredLine = (key: string, pool: readonly string[] = RETIRE_LINES): string =>
    fill(pick(pool, `${age}:${key}`), branch, { title, years: nextYears });
  const retiredLabel = `Retired from ${branchNameOf(branch)} — ${title}`;

  /* ---- an officer the boards stopped choosing ----------------------------- */
  if (officer && !training && grade === 3 && commissioned >= O3_PASS_OVER_YEARS) {
    if (nextYears >= RETIRE_ELIGIBLE_YEARS) {
      return leave('retired', retiredLine('retire'), retiredLabel, mood);
    }
    return leave(
      'passed-over',
      fill(pick(PASSED_OVER_LINES, `${age}:passedover`), branch, { title }),
      `Left ${branchNameOf(branch)} — ${title}`,
      mood - 2,
    );
  }

  /* ---- 65 is a hard stop ---------------------------------------------------- */
  if (age >= MANDATORY_RETIRE_AGE) {
    return leave('retired', retiredLine('agedout', AGE_RETIRE_LINES), retiredLabel, mood + 2);
  }

  /* ---- the end of a term ---------------------------------------------------- */
  if (nextYears >= career.termEnds && military.offer === undefined) {
    if (performance < RETAIN_PERFORMANCE_FLOOR) {
      // Not asked to stay. With twenty years in, that is a retirement.
      if (nextYears >= RETIRE_ELIGIBLE_YEARS) {
        return leave('retired', retiredLine('retire'), retiredLabel, mood + 2);
      }
      return leave(
        'not-retained',
        fill(pick(NOT_RETAINED_LINES, `${age}:notretained`), branch, { title }),
        `Left ${branchNameOf(branch)} — ${title}`,
        mood,
      );
    }
    military = {
      ...military,
      offer: {
        kind: 'reenlist',
        branch,
        track,
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
