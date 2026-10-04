/**
 * Ticket 0416 — a year of the things an adult does.
 *
 * `education.activities` has always held what a character is in, and the
 * school year is what played it: a season, a standing that drifts toward what
 * the character is naturally like, a line in the feed. That machinery ends at
 * the school gate — the adult branches of `runSchoolYear` return before any of
 * it runs, and graduation empties the list outright. So this is the adult half,
 * and it is deliberately small, because almost everything an activity does was
 * ALREADY wired to that list and has simply never been reached after eighteen:
 *
 *  - the people: `teammatesFor` on joining, the "another year in the same
 *    room" warmth for anybody met there, and the social generator's door marked
 *    "something you still do" (0210), which has read this list since it was
 *    written and never once found anything in it for an adult;
 *  - the body: the health phase's injury order puts anybody in a sport first
 *    (spec 541–543), and "nobody over eighteen is an athlete" was 0211's
 *    finding;
 *  - the hours: the stress phase already turns committed hours into load.
 *
 * What is new here is only what an adult year has and a school year did not:
 * the fees come out of the character's own cash, and people put things down.
 *
 * Randomness from `RngDomains.Pursuits` alone, so a league dropped never moves
 * anything else in the life.
 */

import { findActivity, type Activity } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import { driftStanding, type EducationState, type EnrolledActivity } from '@yearafter/education';
import { SUBSISTENCE, type NewTransaction } from '@yearafter/finance';
import type { Talents, VisibleStats } from '@yearafter/character';
import type { RandomStream } from './rng/rng';

/**
 * How often an adult puts something down, per thing, per year.
 *
 * A pursuit is not a job and nobody fires you from a choir — they stop going.
 * One in ten a year puts the median pursuit at about seven years, which is the
 * right order for a Sunday league or a book club.
 */
export const LAPSE = 0.1;
/** And in a year spent struggling, the first thing that goes is the evening out. */
export const LAPSE_STRAINED = 0.3;

/**
 * What share of a household's discretionary spending a pursuit's fees may take.
 *
 * Read off the household STANDARD — what it lives on, which 0303 made state and
 * 0308b made track what the household is worth — and never off the current
 * account. The first version read the balance at the start of the year, which
 * is 13.53's mistake in a new system: a player who keeps everything in a fund
 * holds almost no cash, so they could afford no league and were offered none,
 * and where money sat was deciding what a life could hold. (It was found while
 * chasing a `floor.test.ts` failure that turned out to be something else — see
 * CORE_RULES 13.81 — but it was wrong on its own terms either way.)
 *
 * Above subsistence only: at subsistence nothing is discretionary, and the free
 * half of the list is still open to everybody.
 */
export const FEE_SHARE = 0.05;

export const affordsFee = (standard: number, fee: number): boolean =>
  fee <= 0 || fee <= Math.max(0, standard - SUBSISTENCE) * FEE_SHARE;

/** A line about how it is going, every few seasons, not every year. */
export const SEASON_LINE_EVERY = 3;

export interface PursuitYearInput {
  readonly education: EducationState;
  readonly age: number;
  readonly stats: VisibleStats;
  readonly talents: Talents;
  /** The household's standard of living, whole dollars a year. */
  readonly standard: number;
  /** Whether LAST year ended struggling — this year's stress is not known yet. */
  readonly strained: boolean;
  readonly stream: RandomStream;
}

export interface PursuitYearResult {
  readonly education: EducationState;
  readonly lines: readonly string[];
  /** Weekly hours still committed, for the stress phase. */
  readonly hours: number;
  readonly transactions: readonly NewTransaction[];
}

/** Whether a held entry is one of the adult list's. */
export const isAdultPursuit = (activity: Activity | undefined): activity is Activity =>
  activity !== undefined && activity.requires.stages.includes('adult');

export function runPursuitYear(input: PursuitYearInput): PursuitYearResult {
  const lines: string[] = [];
  const transactions: NewTransaction[] = [];
  const kept: EnrolledActivity[] = [];
  let hours = 0;

  for (const entry of input.education.activities) {
    const activity = findActivity(entry.activityId);
    // Anything that is not an adult pursuit is left exactly as it was. School
    // activities are the school year's, and it has already run.
    if (!isAdultPursuit(activity)) {
      kept.push(entry);
      continue;
    }

    /*
      One draw per held pursuit, always taken, so a year where somebody could
      not afford their fees leaves the stream where one where they could would
      have — the fixed-block rule 0211 set for the health phase.
    */
    const roll = input.stream.next();
    const fee = activity.annualCost ?? 0;

    // The fees are the first thing to go when the household is squeezed, and
    // the game says so. What is paid goes through the ledger like every other
    // outgoing, shortfall and all.
    if (!affordsFee(input.standard, fee)) {
      lines.push(`Let ${called(activity)} go. The fees were the first thing to cut.`);
      continue;
    }
    if (roll < (input.strained ? LAPSE_STRAINED : LAPSE)) {
      lines.push(activity.leaveText);
      continue;
    }

    if (fee > 0) {
      transactions.push({
        category: 'spending',
        amount: dollars(-fee),
        source: capitalise(activity.costSource ?? activity.name),
      });
    }
    hours += activity.hoursPerWeek;
    const played: EnrolledActivity = {
      ...entry,
      standing: driftStanding(entry.standing, activity, input.stats, input.talents),
      seasons: entry.seasons + 1,
    };
    kept.push(played);
    if (played.seasons > 1 && played.seasons % SEASON_LINE_EVERY === 0) {
      lines.push(stillGoing(activity, played.seasons));
    }
  }

  return {
    education: { ...input.education, activities: kept },
    lines,
    hours,
    transactions,
  };
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/*
  Not `seasonLine`. That one is written for a school team — "people who don't
  follow it knew your name", "the first eleven" — and read aloud about a book
  club it is the game not knowing what it is describing.
*/
const STILL_GOING: Readonly<Record<Activity['kind'], readonly string[]>> = {
  sport: [
    'Another year of {what}. Your knees have started to comment on it.',
    "Still turning out for {what} most weeks. It's the best part of some of them.",
    "{What} again this year. You're not getting faster and have stopped minding.",
  ],
  arts: [
    "Another year of {what}. You're better than you were, which is the point.",
    "Still doing {what}. People you'd never otherwise have met are most of the reason.",
    "{What} again this year, and one evening of it you'll remember.",
  ],
  academic: [
    "Another year of {what}. You read things you'd never have picked up.",
    "Still going to {what}. It's the one evening a week you think hard about something.",
    '{What} again. You have opinions now, which is either growth or a problem.',
  ],
  service: [
    'Another year of {what}. The regulars know you by name.',
    'Still doing {what}. Some weeks it is the most useful thing you do.',
    '{What} again this year. You have stopped thinking of it as a favor.',
  ],
  social: [
    'Another year of {what}, with the same people, which is the whole idea.',
    "Still going to {what}. Nobody would call it important and you wouldn't miss it.",
    '{What} again. You won once, and it comes up.',
  ],
};

/** How it reads mid-sentence: the catalog's own phrase, or the lowercased name. */
export const called = (activity: Activity): string =>
  activity.inSentence ?? activity.name.toLowerCase();

/*
  Rotated by how many of these lines have been said, not by age. The first
  version indexed on age plus seasons — both climb by one a year, so every
  third season moved the index by six, which is zero modulo three: the same
  sentence every time it spoke, for as long as somebody kept going. The unit
  test that says "not the same way each time" caught it before anything else
  could (13.73 — the rotation belongs to the writer, and has to actually rotate).
*/
function stillGoing(activity: Activity, seasons: number): string {
  const lines = STILL_GOING[activity.kind];
  const said = Math.floor(seasons / SEASON_LINE_EVERY);
  const line = lines[(activity.id.length + said) % lines.length] as string;
  const what = called(activity);
  return line.replace(/\{What\}/g, capitalise(what)).replace(/\{what\}/g, what);
}
