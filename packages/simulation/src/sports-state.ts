/**
 * Ticket 0801 — what is saved about a sporting life.
 *
 * A leaf file with no imports from the rest of the simulation, so the game
 * state can hold it without a cycle (the same shape as `celebrity-state.ts`).
 * The rules are in `sports.ts`; the odds and the catalog are in
 * `@yearafter/content`'s `sports.ts`.
 *
 * Sport-specific numbers live here ONLY while the character is in the sport
 * (spec 9 and 343): when a career ends, what is kept is `PastCareer`, which
 * holds no skill at all.
 */

/** Where a career is. A school career is only a record of seasons; college and pro are the real rungs. */
export type SportStage = 'school' | 'college' | 'pro';

/** `fringe` to `superstar`. Mirrors `SportTier` in content, restated so this file has no imports. */
export type CareerTier = 'fringe' | 'role' | 'starter' | 'star' | 'superstar';

export interface ProContract {
  /** Whole dollars a year. */
  readonly salary: number;
  /** Seasons still to run, this one included. */
  readonly yearsLeft: number;
  readonly rookie: boolean;
}

export interface SportCareer {
  readonly sportId: string;
  readonly stage: SportStage;
  /** The age of the first season, for "a career of fourteen years". */
  readonly startedAge: number;
  /** Seasons played at every level. */
  readonly seasons: number;
  /** Seasons in which real practice went in. Together with `seasons` it says whether this is a hard worker. */
  readonly hardSeasons: number;
  /** How good, 0–100. Only readable while playing (spec 343). */
  readonly form: number;
  /** The age practice was last put in, and the sessions that year. At most three. */
  readonly trainedAtAge: number;
  readonly trainedCount: number;
  /** This career's reputation, 0–100 (spec 11: it does not carry to another career). */
  readonly reputation: number;
  readonly titles: number;
  /** The team they play for now: a college, then a pro club. */
  readonly team?: string;
  /** College. What the scholarship pays towards tuition each year, whole dollars. */
  readonly aid?: number;
  readonly collegeSeasons?: number;
  /** Pro. */
  readonly tier?: CareerTier;
  /** The best tier this career will reach. Decided at the draft and never shown. */
  readonly peak?: CareerTier;
  /** Pro seasons until the career reaches its peak. */
  readonly breakout?: number;
  readonly proSeasons?: number;
  /** The age the career ends at, unless an injury ends it first. */
  readonly endAge?: number;
  readonly pick?: number;
  readonly contract?: ProContract;
  /**
   * Fighters only (ticket 0803): the professional record. Whole bouts, as a fight card counts them;
   * absent on every other career and read as none. `titles` is the belts.
   */
  readonly wins?: number;
  readonly losses?: number;
  /**
   * Individual sports only: the best tier this career has reached. A team career knows its best
   * from the `peak` it was drafted at; a tour or a fight card has no such ceiling, so the best is
   * kept as it is earned.
   */
  readonly best?: CareerTier;
}

/**
 * A martial art being studied (ticket 0803), from age ten. The road to boxing and MMA runs through
 * these: three seasons in a base art is what a gym needs to see (`fightCareerFor` in content).
 * The level is readable only while the art is studied (spec 9 and 343).
 */
export interface ArtStudy {
  readonly artId: string;
  readonly startedAge: number;
  /** Years studied, this one included once it has run. */
  readonly seasons: number;
  /** Years in which at least two of the three practice sessions went in. */
  readonly hardSeasons: number;
  /** How good, 0–100. */
  readonly level: number;
  /** The age practice was last put in, and the sessions that year. At most three. */
  readonly trainedAtAge: number;
  readonly trainedCount: number;
}

/** What is kept of a career once it is over: for the life page now, and for coaching and commentary access later (0804). */
export interface PastCareer {
  readonly sportId: string;
  readonly startedAge: number;
  readonly endedAge: number;
  readonly seasons: number;
  readonly titles: number;
  readonly reputation: number;
  /** The highest rung reached. */
  readonly reached: SportStage;
  /** The best tier, if the pros were reached. */
  readonly bestTier?: CareerTier;
  readonly how:
    | 'declined'
    | 'left-college'
    | 'undrafted'
    | 'retired'
    | 'injury'
    | 'unsigned'
    /** A tour player who lost their card (ticket 0803). */
    | 'lost-card'
    /** A fighter the gym stopped booking (ticket 0803). */
    | 'released'
    /** An Olympic athlete the national program dropped (ticket 0804). */
    | 'cut';
  /** Fighters: the record at the end. Absent otherwise. */
  readonly wins?: number;
  readonly losses?: number;
}

/** A question the sport is asking. Frozen when it was raised (the 0402 lesson). */
export type SportsOffer =
  | {
      readonly kind: 'scholarship';
      readonly sportId: string;
      readonly team: string;
      /** Whole dollars a year towards tuition. */
      readonly aid: number;
      /** `full` or `partial`, for the words. */
      readonly cover: 'full' | 'partial';
      readonly majorId: string;
      readonly age: number;
      readonly eventId: string;
    }
  | {
      readonly kind: 'contract';
      readonly sportId: string;
      readonly team: string;
      readonly salary: number;
      readonly years: number;
      readonly rookie: boolean;
      /** The draft position, for a first contract. */
      readonly pick?: number;
      /** Asked for more once, whatever came of it. A second ask is not on offer. */
      readonly asked: boolean;
      readonly age: number;
      readonly eventId: string;
    }
  | {
      /** Golf and tennis (ticket 0803): the right to play the tour. Prize money, and nothing else. */
      readonly kind: 'tour-card';
      readonly sportId: string;
      readonly age: number;
      readonly eventId: string;
    }
  | {
      /** The Olympic sports (ticket 0804): the national program has a place for you. */
      readonly kind: 'national-team';
      readonly sportId: string;
      readonly team: string;
      readonly age: number;
      readonly eventId: string;
    }
  | {
      /** After the playing (ticket 0804): a coaching or commentary job, at the level the career earned. */
      readonly kind: 'post-job';
      readonly sportId: string;
      readonly postKind: 'coach' | 'commentary';
      readonly level: 'college' | 'overseas' | 'pro' | 'local' | 'national';
      readonly age: number;
      readonly eventId: string;
    }
  | {
      /** Boxing and MMA (ticket 0803): a gym will put you on a card. */
      readonly kind: 'turn-pro';
      readonly sportId: string;
      readonly team: string;
      readonly age: number;
      readonly eventId: string;
    };

/**
 * A job after the playing (ticket 0804): coaching or commentary, tied to the sport the career was in. It
 * pays while it lasts and ends at sixty-eight, or when the person leaves. A post that was turned down or
 * left is kept with `over`, so the question is not asked twice in a life.
 */
export interface PostJob {
  readonly sportId: string;
  readonly kind: 'coach' | 'commentary';
  readonly level: 'college' | 'overseas' | 'pro' | 'local' | 'national';
  readonly since: number;
  /** Years in the post, this one included once it has run. */
  readonly seasons: number;
  readonly over?: boolean;
}

export interface SportsState {
  /** After the playing (ticket 0804). Absent is none ever offered. */
  readonly post?: PostJob;
  /** Martial arts being studied (ticket 0803). Absent is none; at most two at a time. */
  readonly arts?: readonly ArtStudy[];
  readonly career?: SportCareer;
  readonly past: readonly PastCareer[];
  readonly offer?: SportsOffer;
}

export const EMPTY_SPORTS: SportsState = { past: [] };
