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

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  COLLEGE_AGE,
  MAJORS,
  TUITION_PER_YEAR,
  POSTGRAD_TUITION_PER_YEAR,
  admissionChance,
  findMajor,
  levelOf,
  postgradChance,
  prerequisiteFit,
  programSections,
  programsOpenTo,
  type Major,
  type ProgramKind,
  type ProgramSection,
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
  | 'not-enrolled'
  /** Ticket 0406. The program is real, but not for this character yet. */
  | 'not-open-to-you';

/*
  Ticket 0307 changed one line here, and it matters more than its size.

  `cannot-afford` is the single most common block on enrolment — measured, it
  stops 183 attempts in 100 lives — and until 0307 it was a dead end: an
  eighteen-year-old with $0 was told they could not cover the year and given
  nothing to do about it. The student loan is the thing to do about it, and a
  product nobody can find is a system nobody can trigger (CORE_RULES 13.7).

  Measured after: degrees go from 65 in 100 lives to 81.
*/
export const COLLEGE_ERROR_LABELS: Readonly<Record<CollegeError, string>> = {
  'too-young': 'You are too young to start a degree.',
  'still-at-school': 'Finish high school first.',
  'already-enrolled': 'You are already studying.',
  'nothing-left-to-study': "There's nothing left to study.",
  'no-diploma': 'They want a high school diploma first.',
  'cannot-afford': "You can't cover the first year — a student loan would.",
  'no-such-major': "That subject isn't on offer.",
  'not-open-to-you': 'Not one you can start right now.',
  'already-applied': 'You have already applied this year.',
  'not-enrolled': "You aren't studying anywhere.",
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

/**
 * Every program this character could start today (Ticket 0406).
 *
 * The screen renders `programSections(openPrograms(state))` and `applyToCollege`
 * checks membership of this same list, so there is one answer to "what is on
 * offer" rather than a screen's answer and a gate's answer — CORE_RULES 13.15.
 */
export const openPrograms = (state: GameState): readonly Major[] =>
  programsOpenTo(state.education.credentials, state.player.age);

export const openProgramSections = (state: GameState): readonly ProgramSection[] =>
  programSections(openPrograms(state));

/**
 * The sticker price of one year of a named program.
 *
 * TAKES THE PROGRAMME RATHER THAN GUESSING FROM THE LEVEL. Before 0406 this
 * read `nextDegreeFor` and returned one of two constants, which was fine when
 * there were two prices and is wrong now that a CPA year costs $18,000 and a
 * year of medical school costs $34,000. The argument is optional so the callers
 * that genuinely mean "the ordinary next step" still work.
 */
export const tuitionDue = (state: GameState, program?: Major): number => {
  if (program) return program.tuition;
  return nextDegreeFor(state) === 'postgrad' ? POSTGRAD_TUITION_PER_YEAR : TUITION_PER_YEAR;
};

/**
 * What the character personally has to find, after whoever is helping.
 *
 * The affordability gate reads THIS and not the sticker price. Measured against
 * the sticker, `cannot-afford` blocked enrolment 2,282 times in 300 lives and
 * only 23% of a player who wanted a degree every single year ever got one —
 * CORE_RULES 13.16 again, pricing a system against money that does not exist at
 * eighteen. Parents fund college; spec 61 and 1197 both say so.
 */
export const outOfPocket = (state: GameState, program?: Major): number =>
  Math.max(0, tuitionDue(state, program) - collegeSupportOf(state, program));

/**
 * What a parent has committed a year, if one has — FOR THE FIRST DEGREE ONLY.
 *
 * Measured: letting it carry into graduate school put 56% of a determined
 * player's lives through a master's, which is not a life simulation, it is a
 * conveyor belt. Parents put you through college; they do not put you through
 * a PhD, and making the second one self-funded turns it back into the decision
 * it should be — you pay for it, out of what a degree has just earned you.
 */
export const collegeSupportOf = (state: GameState, program?: Major): number => {
  /*
    PARENTS PAY FOR COLLEGE, NOT FOR THE REST OF IT. The rule 0210b measured —
    carrying parental money into graduate school put 56% of a determined player
    through a master's, a conveyor belt rather than a life — now has a third
    case to answer. Trade school gets the money: it is the thing an
    eighteen-year-old does instead of a bachelor's, it costs a fraction as much,
    and a parent who would fund four years of tuition would not refuse two.
    Graduate and professional school still do not.
  */
  const kind = program?.kind;
  if (kind === 'graduate') return 0;
  if (kind === undefined && (nextDegreeFor(state) === 'postgrad' || state.education.stage === 'postgrad')) {
    return 0;
  }
  if (state.education.stage === 'postgrad') return 0;
  return state.parenting.collegeSupport ?? 0;
};

/**
 * The subjects on offer. The same list every year — this is not a shop.
 *
 * Kept as the whole catalogue for callers that want it (the timeline resolving
 * a major id written years ago, for one). What a PLAYER is shown is
 * `openPrograms`, which is gated; spec 1336 forbids handing fifty rows to a
 * screen and letting it sort them out.
 */
export const majorsAvailable = (): readonly Major[] => MAJORS;

/**
 * Whether applying is possible at all, before any dice.
 *
 * CORE_RULES 13.15: this is the one place the rules live, and `applyToCollege`
 * calls it rather than repeating them, because a gate with two enforcement
 * points has two chances to disagree with itself.
 */
/**
 * Is there ANY program this character could start — the screen's question.
 *
 * SPLIT FROM `cannotEnrol` IN 0406 BECAUSE ONE FUNCTION WAS ANSWERING TWO
 * QUESTIONS AND THEY HAD STARTED TO DISAGREE. While every program cost the
 * same, "can you enrol" and "can you enrol in THIS" were the same question. They
 * are not any more: a character with $5,000 can start a welding certificate and
 * cannot start medical school, so an optimistic answer ("yes, something is open
 * to you") and a specific one ("no, not that") are both true at once.
 *
 * Leaving that as one optional-argument function meant a caller who asked the
 * loose question and then applied for a specific program got a yes followed
 * by a refusal — CORE_RULES 13.15, a gate disagreeing with itself, and it cost
 * an afternoon in `floor.test.ts` before it was named. Two functions, two
 * questions: this one decides whether the College row is worth showing, and
 * `cannotEnrol` decides whether a particular application goes through.
 */
export function cannotEnrolAnything(state: GameState): CollegeError | undefined {
  const open = openPrograms(state);
  const structural = structuralBlock(state, open);
  if (structural) return structural;
  const cash = Number(state.player.cash) / 100;
  const cheapest = Math.min(...open.map((row) => outOfPocket(state, row)));
  return cash < cheapest ? 'cannot-afford' : undefined;
}

/** The stage, age and catalogue checks both questions share. */
function structuralBlock(
  state: GameState,
  open: readonly Major[],
): CollegeError | undefined {
  const { education, player } = state;
  if (
    education.stage === 'college' ||
    education.stage === 'postgrad' ||
    education.stage === 'vocational'
  ) {
    return 'already-enrolled';
  }
  if (
    education.stage === 'preschool' ||
    education.stage === 'elementary' ||
    education.stage === 'middle' ||
    education.stage === 'high'
  ) {
    return 'still-at-school';
  }
  if (player.age < COLLEGE_AGE) return 'too-young';
  if (open.length === 0) {
    // A dropout has no diploma; anybody else has simply run out of programs.
    return levelOf(education.credentials) === 'none' ? 'no-diploma' : 'nothing-left-to-study';
  }
  return undefined;
}

export function cannotEnrol(state: GameState, program?: Major): CollegeError | undefined {
  const open = openPrograms(state);
  const structural = structuralBlock(state, open);
  if (structural) return structural;
  const cash = Number(state.player.cash) / 100;
  /*
    NO PROGRAMME NAMED IS THE PESSIMISTIC ANSWER ON PURPOSE. A caller who does
    not say what they are applying for gets the price of the ORDINARY next step
    — the bachelor's or the graduate degree the ladder implies — not the price
    of the cheapest certificate in the catalogue. The optimistic reading belongs
    to `cannotEnrolAnything`, and conflating the two is what let a harness pass
    this gate and then be refused by `applyToCollege` one line later.
  */
  if (!program) {
    return cash < outOfPocket(state) ? 'cannot-afford' : undefined;
  }
  if (!open.some((row) => row.id === program.id)) return 'not-open-to-you';
  if (cash < outOfPocket(state, program)) return 'cannot-afford';
  return undefined;
}

/**
 * The odds, for the row the player reads before they apply.
 *
 * THREE TIERS NOW, AND THE PROGRAMME ITSELF MOVES IT (Ticket 0406). A trade
 * school is not selective and should not pretend to be; medical school is the
 * hardest admission in the game and a biology graduate should feel the
 * difference from an art historian applying to it. `difficulty` was already
 * carried on every program and only ever spent on how hard it was to PASS —
 * spending it on getting in as well is what makes the professional tier read
 * as a wall worth climbing rather than a more expensive master's.
 */
export function admissionOdds(state: GameState, program?: Major): number {
  const { performance } = state.education;
  const academics = state.player.talents.academics;
  if (!program) {
    const next = nextDegreeFor(state);
    const chance = next === 'postgrad' ? postgradChance : admissionChance;
    return chance(performance, academics);
  }
  if (program.kind === 'vocational') {
    // Open enrolment, near enough. A trade school that turns people away is not
    // the thing this tier exists to be.
    return Math.max(0.55, Math.min(0.97, 0.88 - program.difficulty * 0.12));
  }
  const base =
    program.kind === 'graduate'
      ? postgradChance(performance, academics)
      : admissionChance(performance, academics);
  // Selectivity above the tier's own baseline, plus what they read as an
  // undergraduate. A 0.92-difficulty program sheds roughly a third of the
  // base rate before the record is even considered.
  const selective = 1 - (program.difficulty - 0.5) * 0.62;
  const fit = prerequisiteFit(program, state.education.majorId);
  return Math.max(0.05, Math.min(0.95, base * Math.max(0.3, selective) + fit));
}

/**
 * Apply, having chosen a subject.
 *
 * The major is picked BEFORE the answer, which is the right way round: you
 * apply to study something. Being turned down is a real outcome and the player
 * can try again next year — the 0209 lesson about refusals, and the 0210 lesson
 * about applications, for the third time.
 */
export function applyToCollege(
  state: GameState,
  majorId: string,
): Result<CollegeOutcome, CollegeError> {
  const major = findMajor(majorId);
  if (!major) return err('no-such-major');

  // The program is known BEFORE the gate is asked, because since 0406 the
  // gate's answer depends on it: what it costs, whether this character is the
  // right tier for it, and whether they already hold the license it grants.
  const blocked = cannotEnrol(state, major);
  if (blocked) return err(blocked);

  if (state.education.appliedToCollegeAtAge === state.player.age) return err('already-applied');

  const stream = state.rng.stream(RngDomains.Education);
  const accepted = stream.chance(admissionOdds(state, major));

  const text = accepted
    ? acceptedLine(state, major, major.kind)
    : rejectedLine(state, major, major.kind);

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
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
      education: {
        ...state.education,
        appliedToCollegeAtAge: state.player.age,
        ...(accepted
          ? {
              stage:
                major.kind === 'graduate'
                  ? ('postgrad' as const)
                  : major.kind === 'vocational'
                    ? ('vocational' as const)
                    : ('college' as const),
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
        ? `Left after a year of ${subject}. It wasn't going to be the thing.`
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
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
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

const acceptedLine = (state: GameState, major: Major, kind: ProgramKind): string => {
  const lines = kind === 'graduate' ? POSTGRAD_IN : kind === 'vocational' ? TRADE_IN : ACCEPTED_LINES;
  return fill(pick(lines, `college:${major.id}`, state.player.age), major);
};

const rejectedLine = (state: GameState, major: Major, kind: ProgramKind): string => {
  const lines = kind === 'graduate' ? POSTGRAD_NO : kind === 'vocational' ? TRADE_NO : REJECTED_LINES;
  return fill(pick(lines, `nocollege:${major.id}`, state.player.age), major);
};

/*
  `{years}` EXISTS BECAUSE THE COPY USED TO LIE. "Four years of {major}" was
  true when every bachelor's was four years and every graduate degree was two;
  0406 has programs running from one year to four inside the same tier, and a
  line that says four to somebody enrolled in a twelve-month CPA course is the
  kind of small wrongness that makes a player stop trusting the timeline.
*/
const fill = (line: string, major: Major): string =>
  line
    .replace(/\{major\}/g, major.name.toLowerCase())
    .replace(/\{years\}/g, major.years === 1 ? 'A year' : `${NUMBER_WORDS[major.years] ?? major.years} years`);

const NUMBER_WORDS: Readonly<Record<number, string>> = {
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
};

const ACCEPTED_LINES: readonly string[] = [
  'Got in. {years} of {major}, starting in the autumn.',
  'The letter came and you read it standing up. {major}, and you are going.',
  'Accepted to study {major}. Somebody in the family cried about it.',
  'You are going to college. {major}, and no idea what happens after.',
];

const REJECTED_LINES: readonly string[] = [
  "Applied to study {major} and didn't get in. There is always next year.",
  'The {major} application came back as a no, in a very short letter.',
  'Turned down. They said the year was competitive, which they say every year.',
];

const TRADE_IN: readonly string[] = [
  'Signed up for {major}. {years}, and a license at the end of it.',
  'Starting {major}. Everybody else in the room is already working.',
  'Enrolled in {major}. Nobody asked about your grades.',
];

const TRADE_NO: readonly string[] = [
  'The {major} intake was full. They said to try again next term.',
  'Missed the {major} intake by a week.',
];

const POSTGRAD_IN: readonly string[] = [
  'Accepted onto {major}. {years} more of it.',
  'Got a place on {major}. Everybody else there is very sure of themselves.',
  "Going back for {major}. It wasn't an easy decision.",
];

const POSTGRAD_NO: readonly string[] = [
  '{major} said no. Your undergraduate record did that.',
  "Applied to {major} and wasn't offered a place.",
];
