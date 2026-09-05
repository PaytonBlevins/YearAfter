/**
 * Ticket 0207 — the things you can do about somebody you like.
 *
 * Spec 1664: "find date, dating app, flirt, relationship, breakup, marriage."
 * Spec 730–733 lists flirt and make a move among the core social actions, which
 * Ticket 0206 deliberately left out because 0206 was a childhood.
 *
 * The shape is the one the friendship menu already established, for the reason
 * given there: light things repeat and are worth less each time, heavy things
 * are once a year, and everything can go badly. Asking somebody out is the
 * clearest case in the game of an action that has to be able to fail — a version
 * where it always works is not a life sim, it is a shop.
 *
 * ONE GATE GOVERNS AGE, and it is `stagesFor` in `./romance`. Every move that
 * changes a stage declares the stage it moves to, and `movesFor` refuses any
 * move whose destination `stagesFor` does not list for this age. There is
 * deliberately no second age field to keep in sync and no per-move exception:
 * engagement and marriage are absent from a minor's menu because they are absent
 * from a minor's stage list, and there is no route that reaches them.
 */

import { repeatScale, type Acquaintance } from './people';
import {
  ADULT_AGE,
  canAdvanceTo,
  holdableStage,
  isRomantic,
  stagesFor,
  type RomanceStage,
} from './romance';

export type RomanceMoveId =
  | 'flirt'
  | 'ask-out'
  | 'date'
  | 'make-official'
  | 'propose'
  | 'marry'
  | 'break-up'
  | 'divorce';

/** The stage a move starts from. `none` means you are not seeing them at all. */
export type RomanceFrom = RomanceStage | 'none';

export interface RomanceMove {
  readonly id: RomanceMoveId;
  readonly label: string;
  readonly blurb: string;
  /** Stages this can be pressed from. */
  readonly from: readonly RomanceFrom[];
  /**
   * Where it moves the relationship, if it lands.
   *
   * This is what the age gate reads. A move with no `to` never changes a stage
   * and therefore never needs one — going on a date with the person you are
   * already going out with is not a step forward, it is a Saturday.
   */
  readonly to?: RomanceStage;
  readonly weight: 'light' | 'heavy';
  /** Some things are a decision rather than a request, and cannot fail. */
  readonly certain?: boolean;
  /** Chance before the person, the compatibility and the charm are counted. */
  readonly base: number;
  readonly onGood: number;
  readonly onBad: number;
  readonly major?: boolean;
  readonly minRelationship?: number;
  /**
   * Years the couple must already have spent at the current stage.
   *
   * This is what makes `Romance.since` load-bearing rather than decorative, and
   * it exists because reading 150 lives found the mean marriage happening at
   * 20.9 with 71% of them before twenty-one: with only a relationship threshold
   * in the way, a player who had been going out with somebody since fourteen
   * proposed on their eighteenth birthday and married at nineteen, every time.
   *
   * A relationship is a thing that takes time, and nothing else in the model
   * said so. This does, and it says it as a fact about the couple rather than
   * as a cooldown: you have not been going out long enough to be proposing.
   *
   * For a move into an ADULT stage the clock starts at `ADULT_AGE`, not at
   * `since`. Counting from `since` alone left the earliest possible wedding at
   * NINETEEN and put 61% of them under twenty-one, because somebody together
   * since fifteen had already served the two years on their eighteenth
   * birthday. Years you spent going out at school are real years and they are
   * not years of an adult relationship; starting the clock at adulthood says
   * that without a second age threshold to keep in sync.
   */
  readonly minYearsAtStage?: number;
  /**
   * A fixed price, in cents. Nothing is offered the character cannot pay for.
   *
   * Only for things that genuinely have a price a shop sets — an evening out.
   */
  readonly cost?: number;
  /**
   * A price that is a share of what the character has, capped.
   *
   * This exists because reading the output found marriage unreachable. The
   * first version charged $1,800 for a ring and $9,000 for a wedding, and the
   * measurement nobody took first says the median thirty-year-old in this build
   * has THIRTEEN DOLLARS — there is no career system yet, so a cash gate on
   * marriage was a gate on a system that has not shipped. Across 150 lives, 1%
   * got engaged and 0% married. CORE_RULES 13.7, for the third time.
   *
   * A fixed price would have had to be either absurdly low forever or a wall
   * until careers land. A share is neither, and it is also just true: a wedding
   * is what you can afford. Broke means a registry office and two witnesses,
   * which is a real wedding and a better story than a locked button.
   */
  readonly costShare?: number;
  /** The most that share is ever allowed to come to. */
  readonly costCap?: number;
}

/** What this move actually costs a character holding this much. */
export function costOf(move: RomanceMove, cash: number): number {
  if (move.cost !== undefined) return move.cost;
  if (move.costShare === undefined) return 0;
  const share = Math.round(Math.max(0, cash) * move.costShare);
  return Math.min(share, move.costCap ?? share);
}

/**
 * The catalog.
 *
 * Short on purpose, and the same length at every age. What changes between
 * fourteen and thirty is which rows are reachable, not how many verbs exist —
 * a menu that grows a section on a birthday reads like an unlock, and this is a
 * life rather than a progression system.
 */
export const ROMANCE_MOVES: readonly RomanceMove[] = [
  {
    id: 'flirt',
    label: 'Flirt',
    blurb: 'Badly, probably. Everybody does it badly.',
    from: ['none', 'interested'],
    to: 'interested',
    weight: 'light',
    base: 0.4,
    onGood: 9,
    onBad: -4,
  },
  {
    id: 'ask-out',
    label: 'Ask them out',
    blurb: 'Out loud, to their face, with no way to take it back.',
    from: ['interested'],
    to: 'seeing',
    weight: 'heavy',
    base: 0.3,
    onGood: 16,
    onBad: -12,
    major: true,
    minRelationship: 45,
  },
  {
    id: 'date',
    label: 'Take them out',
    blurb: 'An evening that is meant to be about the two of you.',
    from: ['seeing', 'together', 'engaged', 'married'],
    weight: 'light',
    base: 0.62,
    onGood: 10,
    onBad: -5,
    cost: 2200,
  },
  {
    id: 'make-official',
    label: 'Make it official',
    blurb: 'Say the word to them, and then to everybody else.',
    from: ['seeing'],
    to: 'together',
    weight: 'heavy',
    base: 0.4,
    onGood: 14,
    onBad: -14,
    major: true,
    minRelationship: 58,
    minYearsAtStage: 1,
  },
  {
    id: 'propose',
    label: 'Propose',
    blurb: 'Ask them the whole question.',
    from: ['together'],
    to: 'engaged',
    weight: 'heavy',
    base: 0.34,
    onGood: 18,
    onBad: -20,
    major: true,
    minRelationship: 74,
    minYearsAtStage: 2,
    // A ring is what you can put towards a ring. See `costShare`.
    costShare: 0.35,
    costCap: 400_000,
  },
  {
    id: 'marry',
    label: 'Get married',
    blurb: 'The day itself, and everybody you know in one room.',
    from: ['engaged'],
    to: 'married',
    weight: 'heavy',
    base: 0.72,
    onGood: 20,
    onBad: -16,
    major: true,
    minRelationship: 66,
    minYearsAtStage: 1,
    costShare: 0.6,
    costCap: 1_800_000,
  },
  {
    id: 'break-up',
    label: 'End it',
    blurb: 'You have thought about it enough.',
    from: ['interested', 'seeing', 'together', 'engaged'],
    weight: 'heavy',
    certain: true,
    base: 1,
    onGood: -24,
    onBad: -24,
    major: true,
  },
  {
    id: 'divorce',
    label: 'File for divorce',
    blurb: 'Solicitors, a date in a diary, and the house.',
    from: ['married'],
    weight: 'heavy',
    certain: true,
    base: 1,
    onGood: -34,
    onBad: -34,
    major: true,
    // Solicitors take a proportion of what there is, which is the one thing
    // everybody who has been through it agrees on.
    costShare: 0.5,
    costCap: 2_500_000,
  },
];

export const findRomanceMove = (id: string): RomanceMove | undefined =>
  ROMANCE_MOVES.find((move) => move.id === id);

/** Where this person currently stands with the player, for the `from` check. */
export const romanceFrom = (person: Acquaintance): RomanceFrom =>
  isRomantic(person) && person.romance ? person.romance.stage : 'none';

/**
 * What the player may do about this person right now.
 *
 * Four filters, and the order matters only in that the age one can never be
 * skipped: a move that changes stage is offered only if `stagesFor` lists its
 * destination for this age.
 */
export function movesFor(person: Acquaintance, age: number, cash: number): readonly RomanceMove[] {
  // No romance system at all below the crush age — the list is empty, so
  // nothing downstream has to remember to check.
  if (stagesFor(age).length === 0) return [];
  // Peers only. This needs no further comment.
  if (person.kind !== 'peer') return [];
  if (person.endedAtAge !== undefined) return [];
  // Somebody the player has already been out with and ended it with is not a
  // fresh start; getting back together is its own thing, and not this ticket.
  if (person.romance?.endedAtAge !== undefined) return [];

  const here = romanceFrom(person);
  return ROMANCE_MOVES.filter((move) => {
    if (!move.from.includes(here)) return false;
    if (move.to !== undefined && !canAdvanceTo(move.to, age)) return false;
    if (move.minRelationship !== undefined && person.relationship < move.minRelationship) {
      return false;
    }
    if (move.minYearsAtStage !== undefined && yearsShort(move, person, age)) return false;
    // CORE_RULES 13.13: never offer to spend money the character does not have.
    // A share of what you have is by construction affordable; a fixed price is
    // not, and that is the one that has to be checked.
    if (move.cost !== undefined && cash < move.cost) return false;
    return true;
  });
}

/**
 * Why a move the player can see the shape of is not available.
 *
 * The menu shows a greyed row with this line rather than hiding it, for
 * everything except the age gate — a fourteen-year-old is not shown a greyed
 * "Get married" with a reason, because that is a worse thing to put in front of
 * a child than nothing at all. Age-gated rows are absent, not disabled.
 */
/**
 * Whether this couple have not yet been at their current stage long enough.
 *
 * The clock starts at `since`, or at adulthood for a move into an adult stage,
 * whichever is later. See `minYearsAtStage`.
 */
function yearsShort(move: RomanceMove, person: Acquaintance, age: number): boolean {
  if (move.minYearsAtStage === undefined) return false;
  const since = person.romance?.since;
  if (since === undefined) return true;
  const adultStage = move.to !== undefined && !stagesFor(ADULT_AGE - 1).includes(move.to);
  const from = adultStage ? Math.max(since, ADULT_AGE) : since;
  return age - from < move.minYearsAtStage;
}

export function moveUnavailable(
  move: RomanceMove,
  person: Acquaintance,
  age: number,
  cash: number,
): string | undefined {
  if (move.minRelationship !== undefined && person.relationship < move.minRelationship) {
    return 'Not yet. You are not there.';
  }
  if (move.minYearsAtStage !== undefined && yearsShort(move, person, age)) {
    return 'It has not been long enough.';
  }
  if (move.cost !== undefined && cash < move.cost) return 'You cannot afford it.';
  return undefined;
}

export interface RomanceResult {
  readonly worked: boolean;
  readonly warmth: number;
  readonly major: boolean;
  /** The stage this leaves them at, or `undefined` when it is over. */
  readonly stage?: RomanceStage;
  /** True when it ended, in which case `endedBecause` says how. */
  readonly ended: boolean;
  readonly endedBecause?: 'broke up' | 'they ended it' | 'divorced';
  readonly worn: boolean;
  readonly spent: number;
  readonly text: string;
}

/**
 * Resolve one move. Pure — the caller supplies the draws.
 *
 * A failed step forward does NOT end what you already had. Asking somebody to
 * make it official and being told not yet is a bad evening, not a break-up, and
 * a system that ended the relationship over it would be punishing the player for
 * using the menu.
 */
export function resolveMove(
  move: RomanceMove,
  person: Acquaintance,
  age: number,
  chance: number,
  roll: number,
  variant: number,
  name: string,
  alreadyDone = 0,
  cash = 0,
): RomanceResult {
  const here = romanceFrom(person);
  const scale = move.weight === 'light' ? repeatScale(alreadyDone) : 1;

  if (scale <= 0) {
    const index = pick(WORN_LINES, variant);
    return {
      worked: false,
      warmth: 0,
      major: false,
      stage: holdableStage(here === 'none' ? undefined : here, age),
      ended: false,
      worn: true,
      spent: 0,
      text: fill(WORN_LINES[index] as string, name),
    };
  }

  // Ending it is a decision. It always goes through, and it always costs.
  if (move.certain) {
    const lines = move.id === 'divorce' ? DIVORCE_LINES : BREAK_UP_LINES;
    return {
      worked: true,
      warmth: move.onGood,
      major: true,
      stage: undefined,
      ended: true,
      endedBecause: move.id === 'divorce' ? 'divorced' : 'broke up',
      worn: false,
      spent: costOf(move, cash),
      text: fill(lines[pick(lines, variant, alreadyDone)] as string, name),
    };
  }

  const worked = roll < chance;
  const lines = linesFor(move.id, worked, age, here);
  const warmth = Math.round((worked ? move.onGood : move.onBad) * scale);

  // The stage only moves on success, and even then only if this age may hold
  // it. The second half of that is redundant with `movesFor` and is here
  // anyway: an age gate with exactly one enforcement point is an age gate one
  // careless caller can walk around.
  const advanced = worked && move.to !== undefined && canAdvanceTo(move.to, age);
  // `holdableStage` on the standing-still branch too: staying where you were is
  // the path that was carrying an impossible stage through untouched.
  const stage = advanced ? move.to : holdableStage(here === 'none' ? undefined : here, age);

  return {
    worked,
    warmth,
    major: Boolean(move.major),
    stage,
    ended: false,
    worn: false,
    // A night out is paid for whether or not it went well, which anybody who
    // has had a bad one will confirm. A ring or a wedding that was refused is
    // not, because it did not happen.
    spent: worked || move.to === undefined ? costOf(move, cash) : 0,
    text: fill(lines[pick(lines, variant, alreadyDone)] as string, name),
  };
}

/**
 * Which line, offset by how many times this has already been pressed this year.
 *
 * The offset is the fix for the second thing reading the output found. With one
 * uniform draw and three lines, a player who took the same person out four
 * times a year got "Shared chips with Diya on a wall" four times, twice of them
 * back to back, and then did it again every year for seventeen years. Rotating
 * by the repeat counter makes a same-year repeat impossible up to the length of
 * the set, which is why the sets below are longer than they need to be for one
 * press.
 */
const pick = (lines: readonly string[], variant: number, repeat = 0): number =>
  (Math.min(lines.length - 1, Math.floor(variant * lines.length)) + repeat) % lines.length;

const fill = (line: string, name: string): string => line.replace(/\{name\}/g, name);

/**
 * Copy.
 *
 * Written to `claude/event-writing-rules.md` and to one more rule that belongs
 * to this ticket alone: everything a character under eighteen can read stays at
 * the register of the line the childhood catalog already ships — "A first date
 * at a cinema. Neither of you can name the film." Nervous, specific, and
 * entirely about corridors, buses and getting the words out. Nothing else.
 *
 * `date` is the only move whose copy changes with age, because it is the only
 * one a fourteen-year-old and a forty-year-old both press.
 */
function linesFor(
  id: RomanceMoveId,
  worked: boolean,
  age: number,
  stage: RomanceFrom,
): readonly string[] {
  if (id === 'date') {
    // Three sets, not two. Reading the output found an evening with the person
    // you have been married to for eight years rendering the same sentence as a
    // third date at twenty — "Dinner that went on two hours longer than either
    // of you planned" is a lovely line about a new relationship and a strange
    // one about a marriage.
    const set =
      age < ADULT_AGE ? TEEN_DATE : stage === 'married' || stage === 'engaged' ? SETTLED_DATE : ADULT_DATE;
    return worked ? set.good : set.bad;
  }
  // Unreachable from `resolveMove`, which handles the certain moves before it
  // gets here. Present so the tables below can be exhaustive without holding an
  // empty array that would render as `undefined` if anybody ever did reach it.
  if (id === 'break-up') return BREAK_UP_LINES;
  if (id === 'divorce') return DIVORCE_LINES;
  return (worked ? GOOD_LINES : BAD_LINES)[id];
}

/** Moves that are a request, and can therefore be turned down. */
type AskedMoveId = Exclude<RomanceMoveId, 'break-up' | 'divorce'>;

const TEEN_DATE = {
  good: [
    'Took {name} to the cinema. Neither of you could name the film afterwards.',
    'Two hours walking round town with {name} because neither of you wanted to go home.',
    'Shared chips with {name} on a wall and talked about nothing until it got cold.',
    'Missed the last bus with {name} and had to ring home, and it was still worth it.',
    'Sat in the park with {name} until the lights came on and somebody moved you along.',
    'Went round to {name}’s and watched something neither of you was watching.',
  ],
  bad: [
    'You and {name} ran out of things to say twenty minutes in, and both noticed.',
    '{name} spent most of it on their phone, and you spent most of it deciding not to mention it.',
    'It rained, the place was shut, and neither of you had a second idea.',
    'Brought {name} somewhere you thought they would like. They were polite about it.',
    'Your friends turned up. {name} did not say anything about it, all evening.',
  ],
} as const;

const ADULT_DATE = {
  good: [
    'Dinner with {name} that went on two hours longer than either of you planned.',
    'Took {name} out properly. You both remembered why.',
    'A whole evening with {name} where nothing needed sorting out.',
    'Ended up somewhere neither of you had been, with {name}, and stayed till they closed.',
    'Cooked for {name} and it was better than the restaurant would have been.',
    'A long walk with {name} and a conversation you have both been putting off, and it went fine.',
  ],
  bad: [
    'An evening with {name} where you both worked quite hard at it.',
    'Dinner with {name}, and the thing neither of you said sat at the table the whole time.',
    'Took {name} out. {name} was somewhere else for most of it.',
    'Booked somewhere nice for {name}. You were both checking the time by nine.',
    'It turned into the same argument, in a better room, with {name}.',
  ],
} as const;

/**
 * Years in. A different thing entirely, and the copy has to know it.
 */
const SETTLED_DATE = {
  good: [
    'Got a table and a babysitter and remembered what {name} is like on their own.',
    'An evening out with {name} that felt like the old ones, without trying to.',
    'Nothing special with {name}. It was the best week you had had in a while.',
    'Went back to the place you went the first time. {name} had remembered too.',
    'Took a day off with {name} and told nobody where you were going.',
  ],
  bad: [
    'An evening out with {name} that you both treated as an appointment.',
    'You and {name} talked about the house, the money and the calendar, and then it was time to go.',
    'Went out with {name} and spent most of it on your phones, at the same table.',
    'Booked it, went, came home. {name} said it was nice.',
  ],
} as const;

const GOOD_LINES: Readonly<Record<AskedMoveId, readonly string[]>> = {
  flirt: [
    'Said something to {name} that came out better than it had any right to.',
    'Made {name} laugh and then had to look at the floor for a bit.',
    '{name} found a reason to stand next to you twice in one afternoon.',
    'Caught {name} looking, and {name} did not look away first.',
    'Sat next to {name} on purpose and neither of you mentioned it.',
    'Ended up talking to {name} for an hour about nothing at all.',
  ],
  'ask-out': [
    'Asked {name} in the corridor, quietly, and {name} said yes before you finished.',
    'Got the words out to {name} on the way to the bus. {name} said yes, and you got the wrong bus.',
    'Asked {name}. {name} thought about it for a second that lasted a fortnight, and said yes.',
    'Wrote it down, could not hand it over, and said it out loud to {name} instead. Yes.',
  ],
  date: TEEN_DATE.good,
  'make-official': [
    'You and {name} said it out loud, to each other and then to everybody, and it was fine.',
    'It stopped being a question. {name} told their friends first, which said everything.',
  ],
  propose: [
    'Asked {name} the whole question. {name} said yes and then cried, in that order.',
    'Got it out badly and {name} said yes anyway, and has told the story badly ever since.',
  ],
  marry: [
    'Married {name}. Everybody you know was in one room and it went by in an hour.',
    'You and {name} got married. Your father made a speech nobody expected to be good.',
  ],
};

const BAD_LINES: Readonly<Record<AskedMoveId, readonly string[]>> = {
  flirt: [
    'It landed nowhere. {name} was kind about it, which was the worst part.',
    'Said it, heard yourself say it, and watched {name} decide not to have heard it.',
    '{name} laughed at the wrong bit and you thought about it for a week.',
    'Tried it on {name} and got the voice people use on somebody else’s little brother.',
    '{name} answered the question you actually asked, which was not the one you meant.',
    'Made your move in front of {name}’s friends. They enjoyed it more than {name} did.',
  ],
  'ask-out': [
    'Asked {name}. {name} said no, gently, and gently did not help.',
    '{name} said they did not think of you like that, and meant it, and said it kindly.',
    'Asked {name} in front of two other people, which turned out to be the mistake.',
  ],
  date: TEEN_DATE.bad,
  'make-official': [
    '{name} said not yet. Not no — not yet. You have thought about the difference a lot.',
    'Brought it up and {name} changed the subject so smoothly you nearly missed it.',
  ],
  propose: [
    'Asked {name}. {name} said they were not ready, and the ring stayed in a drawer for a year.',
    '{name} said no. You had been so certain that it took a while to hear.',
  ],
  marry: [
    'The date came and went twice. Something was always in the way, and eventually that was the answer.',
    'Called it off six weeks out. Everybody said the right things and nobody was surprised.',
  ],
};

const BREAK_UP_LINES: readonly string[] = [
  'Ended it with {name}. Ten minutes, most of it silence, and then a bus each.',
  'Told {name} it was over. {name} had known for a fortnight and let you say it.',
  'You and {name} finished it badly, in a corridor, with people going past.',
];

const DIVORCE_LINES: readonly string[] = [
  'You and {name} divorced. It took fourteen months and there was no bad guy in it.',
  'Divorced {name}. The solicitors were expensive and the worst day was the sofa.',
];

/**
 * What the other person does when they have had enough of being flirted at.
 *
 * Same rule as the friendship menu: the button never silently stops working, it
 * says so in a sentence.
 */
const WORN_LINES: readonly string[] = [
  '{name} has heard quite a lot from you lately, and it is starting to show.',
  'You have used every line you have on {name}, twice.',
];
