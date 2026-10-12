/**
 * Ticket 0808 — the awards across fields.
 *
 * Acting, music and modeling each already hand out their own award inside their own year (0805, 0806, 0807), and those
 * draws are not touched. This file is the layer that reads them: one yearly roll-up across the fields, a ceremony for
 * sports and racing (which had titles and no awards), and the numbers that let the 0705 roster win the same awards and
 * fill the same charts as the player.
 *
 * Every number here is game judgement. There is no real-world figure for how often an actor who is up for an award
 * loses it, or how many drivers there are for a Driver of the Year to be chosen from; the ticket document says so.
 * Every draw is a hash, so a life that is near none of it replays exactly as it did before.
 */

import type { SportId, SportTier } from './sports';

export type CeremonyId = 'acting' | 'music' | 'modeling' | 'sports';

export interface Ceremony {
  readonly id: CeremonyId;
  /** The roster field whose figures win it, if the roster has one (it has no models). */
  readonly field?: 'acting' | 'music' | 'athletics';
}

export const CEREMONIES: readonly Ceremony[] = [
  { id: 'acting', field: 'acting' },
  { id: 'music', field: 'music' },
  { id: 'modeling' },
  { id: 'sports', field: 'athletics' },
];

/* -------------------------------------------------------------------------- */
/* Sports and racing: the one ceremony that is new                              */
/* -------------------------------------------------------------------------- */

export const LAUREL_CEREMONY = 'the Laurel Sports Awards';
export const LAUREL_ATHLETE = 'Athlete of the Year';
export const LAUREL_DRIVER = 'Driver of the Year';

/**
 * The chance that a pro athlete is named Athlete of the Year (or a driver Driver of the Year) in a season, by the tier
 * they finished it in. A title (or a medal, or a championship) that year makes it likelier.
 */
export const LAUREL_CHANCE: Readonly<Record<SportTier, number>> = {
  fringe: 0,
  role: 0,
  starter: 0.04,
  star: 0.12,
  superstar: 0.25,
};
export const LAUREL_TITLE_MULTIPLE = 2.5;
export const LAUREL_MOOD = 6;
/** What each award adds to the fame a sports career holds, and the most it can add. */
export const LAUREL_FAME_EACH = 3;
export const LAUREL_FAME_CAP = 12;

/* -------------------------------------------------------------------------- */
/* Across fields                                                               */
/* -------------------------------------------------------------------------- */

/** Wins in two fields in one year is a sweep. */
export const SWEEP_FIELDS = 2;
export const SWEEP_MOOD = 4;

/** The third win at the same ceremony is remembered. */
export const REPEAT_WINS = 3;

/** An artist or actor or athlete this famous in a field is in the running; losing it stings, a little. */
export const NOMINEE_FAME = 40;
export const NOMINEE_CHANCE = 0.5;
export const NOMINEE_MOOD = -1;

/* -------------------------------------------------------------------------- */
/* The roster                                                                  */
/* -------------------------------------------------------------------------- */

/** A figure has to be this famous to be given an award, and still working. */
export const ROSTER_AWARD_FLOOR = 35;

/**
 * Which sport each athlete on the roster plays, by weight. The roster carries no sport of its own (it has no facts but
 * fame), so this is a fresh hash per figure. The weights follow how many people watch each; racing is a small share.
 * The order is part of the answer: a new sport goes at the END.
 */
export const ROSTER_SPORT_WEIGHTS: readonly (readonly [SportId, number])[] = [
  ['basketball', 17],
  ['football', 17],
  ['baseball', 11],
  ['soccer', 13],
  ['hockey', 7],
  ['golf', 6],
  ['tennis', 6],
  ['boxing', 4],
  ['mma', 4],
  ['track', 4],
  ['swimming', 3],
  ['gymnastics', 2],
  ['wrestling', 1],
  ['racing', 5],
];

/* -------------------------------------------------------------------------- */
/* Charts                                                                      */
/* -------------------------------------------------------------------------- */

/** A chart is the most famous people in a field, in a year. The player is on it when they are famous enough. */
export const CHART_SIZE = 25;
export const CHART_TOP = 10;

export const CHART_NAMES: Readonly<Record<'acting' | 'music', string>> = {
  acting: 'the Marquee List',
  music: 'the Silverline Chart',
};
