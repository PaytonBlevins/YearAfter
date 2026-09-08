/**
 * Ticket 0210b — enrolling, and leaving.
 *
 * Review: *"when you graduate from highschool, there is no college or post
 * graduate options. Those are Necessary!"*
 *
 * The player's verbs are: apply (choosing a major), and leave. Everything else
 * about a degree happens to them a year at a time. Spec 1321 asks for "simple
 * exit/change actions" and spec 1824 removes leave-of-absence by name, so
 * leaving is one row with no confirmation and no way back into the same year.
 */

import { createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  COLLEGE_AGE,
  MAJORS,
  TUITION_PER_YEAR,
  POSTGRAD_TUITION_PER_YEAR,
  admissionChance,
  findMajor,
  levelOf,
  postgradChance,
  type Major,
} from '@yearafter/education';
import { err, ok, type Result } from '@yearafter/core';
import type { GameState } from './game-state';
import { RngDomains, stableUnit } from './rng/rng';

export type CollegeError =
  | 'too-young'
  | 'still-at-school'
  | 'already-enrolled'
  /** A degree already held, and no higher one available. */
  | 'nothing-left-to-study'
  | 'no-diploma'
  | 'cannot-afford'
  | 'no-such-major'
  /** One application a year, like a job. */
  | 'already-applied'
  | 'not-enrolled';

export const COLLEGE_ERROR_LABELS: Readonly<Record<CollegeError, string>> = {
  'too-young': 'You are too young to start a degree.',
  'still-at-school': 'Finish high school first.',
  'already-enrolled': 'You are already studying.',
  'nothing-left-to-study': 'There is nothing further to study.',
  'no-diploma': 'They want a high school diploma first.',
  'cannot-afford': 'You cannot cover the first year.',
  'no-such-major': 'That subject is not on offer.',
  'already-applied': 'You have already applied this year.',
  'not-enrolled': 'You are not studying anywhere.',
};

export interface CollegeOutcome {
  readonly state: GameState;
  readonly accepted: boolean;
  readonly entry: TimelineEntry;
}

/** Which degree is next for this character — or nothing, if they are done. */
export const nextDegreeFor = (state: GameState): 'college' | 'postgrad' | undefined => {
  const held = levelOf(state.education.credentials);
  if (held === 'highSchool') return 'college';
  if (held === 'university') return 'postgrad';
  return undefined;
};

export const tuitionDue = (state: GameState): number =>
  nextDegreeFor(state) === 'postgrad' ? POSTGRAD_TUITION_PER_YEAR : TUITION_PER_YEAR;

/**
 * What the character personally has to find, after whoever is helping.
 *
 * The affordability gate reads THIS and not the sticker price. Measured against
 * the sticker, `cannot-afford` blocked enrolment 2,282 times in 300 lives and
 * only 23% of a player who wanted a degree every single year ever got one —
 * CORE_RULES 13.16 again, pricing a system against money that does not exist at
 * eighteen. Parents fund college; spec 61 and 1197 both say so.
 */
export const outOfPocket = (state: GameState): number =>
  Math.max(0, tuitionDue(state) - collegeSupportOf(state));

/**
 * What a parent has committed a year, if one has — FOR THE FIRST DEGREE ONLY.
 *
 * Measured: letting it carry into graduate school put 56% of a determined
 * player's lives through a master's, which is not a life simulation, it is a
 * conveyor belt. Parents put you through college; they do not put you through
 * a PhD, and making the second one self-funded turns it back into the decision
 * it should be — you pay for it, out of what a degree has just earned you.
 */
export const collegeSupportOf = (state: GameState): number =>
  nextDegreeFor(state) === 'postgrad' || state.education.stage === 'postgrad'
    ? 0
    : (state.parenting.collegeSupport ?? 0);

/** The subjects on offer. The same list every year — this is not a shop. */
export const majorsAvailable = (): readonly Major[] => MAJORS;

/**
 * Whether applying is possible at all, before any dice.
 *
 * CORE_RULES 13.15: this is the one place the rules live, and `applyToCollege`
 * calls it rather than repeating them, because a gate with two enforcement
 * points has two chances to disagree with itself.
 */
export function cannotEnrol(state: GameState): CollegeError | undefined {
  const { education, player } = state;
  if (education.stage === 'college' || education.stage === 'postgrad') return 'already-enrolled';
  if (
    education.stage === 'preschool' ||
    education.stage === 'elementary' ||
    education.stage === 'middle' ||
    education.stage === 'high'
  ) {
    return 'still-at-school';
  }
  if (player.age < COLLEGE_AGE) return 'too-young';
  const next = nextDegreeFor(state);
  if (!next) {
    // A dropout has no diploma; a postgraduate has nothing left to take.
    return levelOf(education.credentials) === 'none' ? 'no-diploma' : 'nothing-left-to-study';
  }
  if (Number(player.cash) / 100 < outOfPocket(state)) return 'cannot-afford';
  return undefined;
}

/** The odds, for the row the player reads before they apply. */
export function admissionOdds(state: GameState): number {
  const next = nextDegreeFor(state);
  const chance = next === 'postgrad' ? postgradChance : admissionChance;
  return chance(state.education.performance, state.player.talents.academics);
}

/**
 * Apply, having chosen a subject.
 *
 * The major is picked BEFORE the answer, which is the right way round: you
 * apply to study something. Being turned down is a real outcome and the player
 * can try again next year — the 0209 lesson about refusals, and the 0210 lesson
 * about applications, for the third time.
 */
export function applyToCollege(state: GameState, majorId: string): Result<CollegeOutcome, CollegeError> {
  const blocked = cannotEnrol(state);
  if (blocked) return err(blocked);

  const major = findMajor(majorId);
  if (!major) return err('no-such-major');

  if (state.education.appliedToCollegeAtAge === state.player.age) return err('already-applied');

  const next = nextDegreeFor(state);
  const stream = state.rng.stream(RngDomains.Education);
  const accepted = stream.chance(admissionOdds(state));

  const text = accepted
    ? acceptedLine(state, major, next === 'postgrad')
    : rejectedLine(state, major, next === 'postgrad');

  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'milestone',
    text,
    id: `t:${state.world.year}:college:${majorId}`,
    sequence: state.player.timeline.filter((row) => row.age === state.player.age).length,
  });

  return ok({
    state: {
      ...state,
      player: { ...state.player, timeline: [...state.player.timeline, entry] },
      education: {
        ...state.education,
        appliedToCollegeAtAge: state.player.age,
        ...(accepted
          ? {
              stage: next === 'postgrad' ? ('postgrad' as const) : ('college' as const),
              majorId,
              collegeYear: 0,
              enrolledAtAge: state.player.age,
              // Study Harder starts again — it is a different institution and a
              // different year, and carrying the counter over would silently
              // spend a term the player never used.
              studiedCount: 0,
            }
          : {}),
      },
    },
    accepted,
    entry,
  });
}

/**
 * Walk out of a degree.
 *
 * Spec 1321's "simple exit action", and spec 1824 removes leave-of-absence, so
 * there is no pausing — you leave, and re-enrolling later is a fresh
 * application at year one. No confirmation dialog: a game that asks "are you
 * sure?" is a game that thinks the player made a mistake.
 */
export function leaveCollege(state: GameState): Result<CollegeOutcome, CollegeError> {
  if (state.education.stage !== 'college' && state.education.stage !== 'postgrad') {
    return err('not-enrolled');
  }
  const years = state.education.collegeYear ?? 0;
  const major = state.education.majorId ? findMajor(state.education.majorId) : undefined;
  const subject = major ? major.name.toLowerCase() : 'the degree';

  const text =
    years === 0
      ? `Dropped out before the first year of ${subject} was over.`
      : years === 1
        ? `Left after a year of ${subject}. It was not going to be the thing.`
        : `Left ${subject} with ${years} years done and nothing to show for them.`;

  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'milestone',
    text,
    id: `t:${state.world.year}:leftcollege`,
    sequence: state.player.timeline.filter((row) => row.age === state.player.age).length,
  });

  return ok({
    state: {
      ...state,
      player: { ...state.player, timeline: [...state.player.timeline, entry] },
      education: {
        ...state.education,
        stage: 'graduated',
        finishedAtAge: state.player.age,
        collegeYear: 0,
      },
    },
    accepted: false,
    entry,
  });
}

/* -------------------------------------------------------------------------- */
/* Copy                                                                        */
/* -------------------------------------------------------------------------- */

/** CORE_RULES 13.22: the base holds still for the life, age does the moving. */
function pick(lines: readonly string[], key: string, age: number): string {
  const base = Math.floor(stableUnit(key) * lines.length);
  return lines[(base + age) % lines.length] as string;
}

const acceptedLine = (state: GameState, major: Major, postgrad: boolean): string =>
  pick(
    postgrad ? POSTGRAD_IN : ACCEPTED_LINES,
    `college:${major.id}`,
    state.player.age,
  ).replace(/\{major\}/g, major.name.toLowerCase());

const rejectedLine = (state: GameState, major: Major, postgrad: boolean): string =>
  pick(
    postgrad ? POSTGRAD_NO : REJECTED_LINES,
    `nocollege:${major.id}`,
    state.player.age,
  ).replace(/\{major\}/g, major.name.toLowerCase());

const ACCEPTED_LINES: readonly string[] = [
  'Got in. Four years of {major}, starting in the fall.',
  'The letter came and you read it standing up. {major}, and you are going.',
  'Accepted to study {major}. Somebody in the family cried about it.',
  'You are going to college. {major}, and no idea what happens after.',
];

const REJECTED_LINES: readonly string[] = [
  'Applied to study {major} and did not get in. There is always next year.',
  'The {major} application came back as a no, in a very short letter.',
  'Turned down. They said the year was competitive, which they say every year.',
];

const POSTGRAD_IN: readonly string[] = [
  'Accepted onto the graduate program in {major}. Two more years of it.',
  'Got a place on the {major} program. Everybody else there is very sure of themselves.',
  'Going back for a graduate degree in {major}. It was not an easy decision.',
];

const POSTGRAD_NO: readonly string[] = [
  'The graduate program in {major} said no. Your undergraduate record did that.',
  'Applied for the {major} program and was not offered a place.',
];
