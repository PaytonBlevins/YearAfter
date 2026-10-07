/**
 * Ticket 0806 — what is saved about a musician.
 *
 * A leaf file with no imports from the rest of the simulation, so the game state can hold it without a cycle
 * (the same shape as `acting-state.ts`). The rules are in `music.ts`; the tables and the odds are in
 * `@yearafter/content`'s `music.ts`. A musician's reputation is their own (spec 11): nothing here is an actor's, a
 * creator's or a business's.
 */

/** Mirrors `ReleaseKind` and `MusicTier` in content, restated so this file has no imports. */
export type ReleaseKindName = 'single' | 'ep' | 'lp';
export type MusicStanding = 'local' | 'club' | 'regional' | 'national' | 'headliner' | 'superstar';
export type LabelKindName = 'indie' | 'major';

/** What the artist means to put out in the year to come, and whether to go on the road. */
export interface MusicPlan {
  readonly single: number;
  readonly ep: number;
  readonly lp: number;
  readonly tour: boolean;
}

export const EMPTY_PLAN: MusicPlan = { single: 0, ep: 0, lp: 0, tour: false };

/** A deal that is running. */
export interface LabelDeal {
  readonly kind: LabelKindName;
  readonly label: string;
  /** Whole dollars, paid in the first year of the deal. */
  readonly advance: number;
  /** The artist's share of what streams earn once the advance and the label's costs are paid back, 0–1. */
  readonly royalty: number;
  /** Years still to run, counting the current one. */
  readonly left: number;
  /** The age the deal was signed at. */
  readonly since: number;
  /** What the artist still owes the label, whole dollars: the advance plus what the label spent on releases. */
  readonly owed: number;
  /** Whether the advance has been paid. */
  readonly paid: boolean;
}

/** A deal on the table. */
export interface LabelOffer {
  /** Unique for the life, e.g. "lbl:24". */
  readonly id: string;
  readonly kind: LabelKindName;
  readonly label: string;
  readonly advance: number;
  readonly royalty: number;
  readonly term: number;
  /** The age it was raised at. */
  readonly age: number;
  /** Whether the terms have been bargained over already. */
  readonly asked?: boolean;
  /** Whether the artist sent in a demo or the label came on its own. */
  readonly source: 'called' | 'demo';
}

export interface MusicState {
  /** What the artist can do, 0–100. Absent until music first matters; until then it is read off the character. */
  readonly craft?: number;
  /** Years in a band, a choir or an orchestra. */
  readonly stageYears: number;
  /** People who play the artist's music in a month. The career's one number. */
  readonly listeners: number;
  /** The most it has been. */
  readonly peak: number;
  /** Releases put out, by kind. */
  readonly released: Readonly<Record<ReleaseKindName, number>>;
  /** The back catalogue: the sum of what each release was worth. It's what keeps people listening. */
  readonly catalogue: number;
  /** The best quality a release has reached, 0–100. */
  readonly bestQuality: number;
  /** 0–100, the artist's own. */
  readonly reputation: number;
  readonly awards: number;
  /** Years in a row with nothing released and no tour. */
  readonly idle: number;
  /** The highest rung reached. */
  readonly best?: MusicStanding;
  /** What last year's work paid, after the manager and the agent, whole dollars. A living is a year like that. */
  readonly lastPay: number;
  readonly lessons?: { readonly since: number; readonly seasons: number };
  readonly deal?: LabelDeal;
  /** A deal on the table. It is the one pending question; the plan waits behind it. */
  readonly offer?: LabelOffer;
  /** The last age a demo went out at. */
  readonly demoAge?: number;
  readonly plan: MusicPlan;
  /** Times worked with each person, by partner id. Repeats count for less. */
  readonly collabs: Readonly<Record<string, number>>;
  /** Collaboration offers answered this year. */
  readonly answered: readonly string[];
  /** Tours gone on. */
  readonly tours: number;
}

export const EMPTY_MUSIC: MusicState = {
  stageYears: 0,
  listeners: 0,
  peak: 0,
  released: { single: 0, ep: 0, lp: 0 },
  catalogue: 0,
  bestQuality: 0,
  reputation: 0,
  awards: 0,
  idle: 0,
  lastPay: 0,
  plan: EMPTY_PLAN,
  collabs: {},
  answered: [],
  tours: 0,
};
