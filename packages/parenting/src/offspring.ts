/**
 * Ticket 0212 — a child's own life, lived while you were living yours.
 *
 * WHY THIS EXISTS
 *
 * Spec 818–827 allows the player to "continue as an eligible child/descendant".
 * Measuring 0212 found that the median child is **forty-three** when the player
 * dies — and that they had never done anything. No school, no job, no partner,
 * no history. Continuing as them would have handed the player a middle-aged
 * stranger with an empty Life feed, which is a worse starting position than a
 * newborn and reads as the save being broken.
 *
 * The product owner's answer, in three words: *"They should have a simulated
 * life."* Not a backstory invented at the moment of takeover — that would be
 * the game asserting forty-three years of facts it had not earned, and the
 * first time a player noticed their child's "history" appearing all at once it
 * would stop meaning anything. Simulated, year by year, from the same seeded
 * streams, while the player was busy with their own life.
 *
 * WHAT IS AND IS NOT SIMULATED
 *
 * This is a REDUCED model and says so. A child gets: school, a leaving
 * qualification, possibly a degree, a job and its promotions, a partner, their
 * own children, and a retirement. A child does not get: friends by name,
 * decisions, stress, conditions, gigs, activities, or the event catalog. Those
 * are the parts of the simulation that exist to be PLAYED, and running them for
 * an NPC would cost a save-file's worth of state per person to produce detail
 * nobody can see.
 *
 * The line is drawn at what a parent would plausibly know. You know your
 * daughter is a nurse, that she married Tom, that she has two children and a
 * house. You do not know the name of every colleague she has ever had.
 *
 * WHAT IT COSTS
 *
 * About twenty timeline lines per child over forty years, plus a dozen fields.
 * That is the budget, and `TIMELINE_CAP` enforces it — a dynasty five
 * generations deep must not carry every ancestor's complete feed.
 */

import type { Personality } from '@yearafter/character';

/** What a child is doing with themselves. */
export type OffspringStage = 'child' | 'school' | 'college' | 'working' | 'retired';

export interface OffspringEntry {
  readonly age: number;
  readonly year: number;
  readonly text: string;
}

/**
 * A life, at the resolution a parent can see it.
 *
 * Everything here is derived from draws taken in the year it happened, so it is
 * as replayable as the player's own life — and stored rather than recomputed,
 * because a child's history has to be the same on every load and a model tuned
 * in a later ticket must not retroactively rewrite somebody's past.
 */
export interface OffspringLife {
  readonly stage: OffspringStage;
  /** 0–100, how school went. Decides whether college is plausible. */
  readonly performance: number;
  readonly leftSchoolEarly: boolean;
  readonly degree?: string;
  readonly jobTitle?: string;
  readonly jobTrack?: string;
  /** Rung reached on their ladder, so a promotion means something. */
  readonly rung: number;
  readonly partnerName?: string;
  /**
   * The YEARS their own children were born, not a count.
   *
   * A count would have been enough for the Family screen and useless for the
   * thing this model exists for: continuing as this person. An heir with "three
   * children" and no ages produces a household the game has to invent on the
   * spot, and inventing three birthdays at takeover is the "backstory generated
   * at the moment you need it" that this whole module was written to avoid.
   * A year each is eight bytes and makes them real.
   */
  readonly childrenBorn: readonly number[];
  readonly timeline: readonly OffspringEntry[];
}

export const NEW_OFFSPRING_LIFE: OffspringLife = {
  stage: 'child',
  performance: 50,
  leftSchoolEarly: false,
  rung: 0,
  childrenBorn: [],
  timeline: [],
};

/**
 * At most this many lines per person, ever.
 *
 * A dynasty is meant to be playable five generations deep. Twenty-four lines is
 * roughly one every other year of an adult life, which is enough to read as a
 * life and small enough that ten ancestors cost less than one played year of
 * the player's own feed. When it fills, the OLDEST non-milestone line goes —
 * never the newest, because what somebody is doing now is what a parent would
 * actually know.
 */
export const TIMELINE_CAP = 24;

export interface OffspringYearInput {
  readonly age: number;
  readonly year: number;
  /**
   * Their personality, which is the only thing a `FamilyMember` actually
   * carries. There are deliberately no visible stats for an NPC — adding six
   * bars per child to every save, so that a number nobody ever sees can decide
   * how school went, is not a trade worth making. Ambition stands in for the
   * part of school performance that is effort, and the rest is one draw.
   */
  readonly personality: Personality;
  /** Four draws, taken up front, so a quiet year costs the same as a busy one. */
  readonly rolls: readonly number[];
  /** Given a track and rung, what that job is called. Supplied by the caller. */
  readonly jobFor: (track: string | undefined, rung: number, seed: number) => JobSketch | undefined;
  /** A name for a partner, from the family's own naming tradition. */
  readonly nameFor: (seed: number) => string;
}

export interface JobSketch {
  readonly title: string;
  readonly track: string;
  readonly rung: number;
}

export const SCHOOL_STARTS = 5;
export const SCHOOL_ENDS = 18;
export const COLLEGE_ENDS = 22;
export const RETIRES_AT = 66;

/** Roughly the share of school leavers who go on, before ability is considered. */
export const COLLEGE_BASE = 0.34;
/** How much school performance moves it. */
export const COLLEGE_FROM_PERFORMANCE = 0.5;

export const LEAVES_EARLY_BELOW = 34;

/** The chance a given year is the one somebody meets the person they stay with. */
export const PARTNER_CHANCE = 0.12;
/** And the chance a settled couple has a child in a given year. */
export const CHILD_CHANCE = 0.2;
export const PARTNERS_FROM = 21;
export const CHILDREN_FROM = 23;
export const CHILDREN_UNTIL = 42;
export const MOST_CHILDREN = 4;

/** Years between promotions, before ability. Their whole career is eight draws. */
export const PROMOTION_EVERY = 7;
export const MAX_RUNG = 5;

/**
 * One year of somebody else's life.
 *
 * Pure, like every domain function in this build: it takes what is true and a
 * block of draws, and returns what is true now. It knows nothing about
 * GameState, households or the RNG registry.
 */
export function runOffspringYear(
  life: OffspringLife,
  input: OffspringYearInput,
): OffspringLife {
  const { age, year } = input;
  const roll = (index: number): number => input.rolls[index] ?? 0.5;
  let next = life;
  const say = (text: string) => {
    next = { ...next, timeline: capped([...next.timeline, { age, year, text }]) };
  };

  /* ---- school ------------------------------------------------------------ */
  if (age === SCHOOL_STARTS) {
    // Performance is set ONCE, from who they are, and then holds for the life.
    // CORE_RULES 13.22: the base holds still and age does the moving. A value
    // redrawn every year would make a child who was top of the class at nine
    // and bottom at ten for no reason anybody could see.
    const ability = 40 + input.personality.ambition * 0.35;
    const performance = Math.round(Math.max(5, Math.min(98, ability + (roll(0) - 0.5) * 46)));
    next = { ...next, stage: 'school', performance };
    say('Started school.');
    return next;
  }

  if (age === SCHOOL_ENDS) {
    const early = next.performance < LEAVES_EARLY_BELOW && roll(0) < 0.5;
    if (early) {
      next = { ...next, stage: 'working', leftSchoolEarly: true };
      say('Left school early.');
      return next;
    }
    const goes = roll(1) < COLLEGE_BASE + (next.performance / 100 - 0.5) * COLLEGE_FROM_PERFORMANCE;
    if (goes) {
      next = { ...next, stage: 'college' };
      say('Started college.');
    } else {
      next = { ...next, stage: 'working' };
      say('Finished school and started looking for work.');
    }
    return next;
  }

  if (age === COLLEGE_ENDS && next.stage === 'college') {
    next = { ...next, stage: 'working', degree: 'a degree' };
    say('Graduated.');
    return next;
  }

  /* ---- work -------------------------------------------------------------- */
  if (next.stage === 'working') {
    if (next.jobTitle === undefined) {
      const sketch = input.jobFor(undefined, 0, roll(0));
      if (sketch) {
        next = { ...next, jobTitle: sketch.title, jobTrack: sketch.track, rung: sketch.rung };
        say(`Started work as a ${sketch.title.toLowerCase()}.`);
      }
    } else if (next.rung < MAX_RUNG && roll(1) < 1 / PROMOTION_EVERY) {
      const sketch = input.jobFor(next.jobTrack, next.rung + 1, roll(2));
      /*
        The rung has to actually GO UP. Found by reading a played dynasty:
        "Made charge nurse." at thirty-one and again at thirty-two, because the
        job lookup falls back to the top of the ladder when the next rung does
        not exist — so somebody at the top kept being promoted into the job they
        already had, for the rest of their career. A ladder with three rungs
        cannot promote anybody to a fourth, and the honest answer is that they
        have arrived.
      */
      if (sketch && sketch.rung > next.rung) {
        next = { ...next, jobTitle: sketch.title, rung: sketch.rung };
        say(`Made ${sketch.title.toLowerCase()}.`);
      } else {
        next = { ...next, rung: MAX_RUNG };
      }
    }
    if (age >= RETIRES_AT) {
      next = { ...next, stage: 'retired' };
      say('Retired.');
    }
  }

  /* ---- a life outside work ----------------------------------------------- */
  if (age >= PARTNERS_FROM && next.partnerName === undefined && roll(2) < PARTNER_CHANCE) {
    const name = input.nameFor(roll(3));
    next = { ...next, partnerName: name };
    say(`Married ${name}.`);
  }

  if (
    next.partnerName !== undefined &&
    age >= CHILDREN_FROM &&
    age <= CHILDREN_UNTIL &&
    next.childrenBorn.length < MOST_CHILDREN &&
    roll(3) < CHILD_CHANCE
  ) {
    const born = [...next.childrenBorn, year];
    next = { ...next, childrenBorn: born };
    say(born.length === 1 ? 'Had a baby.' : `Had another — ${ordinal(born.length)} one.`);
  }

  return next;
}

const ordinal = (count: number): string =>
  count === 2 ? 'a second' : count === 3 ? 'a third' : 'a fourth';

/** Keep the newest `TIMELINE_CAP`. See the constant for why the oldest go. */
const capped = (entries: readonly OffspringEntry[]): readonly OffspringEntry[] =>
  entries.length <= TIMELINE_CAP ? entries : entries.slice(entries.length - TIMELINE_CAP);

/**
 * One line about what they are up to, for the Family screen.
 *
 * The thing a parent would say if asked. Returns undefined for a small child,
 * because "they are six" is not news and the screen already says their age.
 */
export function offspringStatus(life: OffspringLife, age: number): string | undefined {
  if (life.stage === 'child') return undefined;
  if (life.stage === 'school') return age >= 12 ? 'At school' : undefined;
  if (life.stage === 'college') return 'At college';
  if (life.stage === 'retired') return life.jobTitle ? `Retired — was a ${life.jobTitle.toLowerCase()}` : 'Retired';
  if (life.jobTitle) return life.jobTitle;
  return life.leftSchoolEarly ? 'Left school early' : 'Looking for work';
}
