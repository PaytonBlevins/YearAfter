/**
 * Ticket 0507 — the rules of an auction.
 *
 * Spec 41 and 1899: two general houses whose "credibility varies randomly",
 * hidden behind a description rather than a number; a storage yard; private
 * sales for the wealthy. Spec 1390: "Bargains are possible but repeated
 * instant buy-resell profit should not be guaranteed."
 *
 * NO LIVE BIDDING. A sale is a list of lots with estimates; the player says how
 * far they would go — careful, fair or determined — and the room answers.
 * Everybody else's top bid is drawn once, from what the lot is really worth;
 * the player wins if they would have gone higher, and pays what the room
 * stopped at, plus the house's premium. A tap, not a chore.
 *
 * MEASURED BEFORE IT WAS TUNED (synthetic, 40,000 lots per cell): with the
 * room's top bid centred 20% over what a lot would fetch (spread 0.25) and a
 * 25% premium, a careful bid at a well-regarded house wins about one lot in
 * eleven and makes about 4% on it — a bargain, sometimes, worth a third of a
 * percent per lot looked at. Every other bid at every other house loses money
 * on average, and a determined bid at a questionable house loses about a
 * third. The edge is there for a patient player and not worth farming.
 */

import { mixedUnit } from '@yearafter/core';

/* -------------------------------------------------------------------------- */
/* Credibility                                                                 */
/* -------------------------------------------------------------------------- */

export type Credibility = 'well' | 'decent' | 'mixed' | 'questionable';

/** Spec 1899: "hidden/descriptive credibility". Words, never a score. */
export const CREDIBILITY_LABELS: Readonly<Record<Credibility, string>> = {
  well: 'Well regarded',
  decent: 'A decent reputation',
  mixed: 'Mixed reviews',
  questionable: 'People talk',
};

/**
 * What credibility does: how often a lot is not what the catalog says, and
 * how far the house's estimates run over what things are worth.
 */
export const CREDIBILITY_EFFECTS: Readonly<
  Record<Credibility, { readonly fakeChance: number; readonly estimateBias: number }>
> = {
  well: { fakeChance: 0.01, estimateBias: 1 },
  decent: { fakeChance: 0.03, estimateBias: 1.08 },
  mixed: { fakeChance: 0.08, estimateBias: 1.18 },
  questionable: { fakeChance: 0.15, estimateBias: 1.3 },
};

/** A house's standing this year. Spec 41: it "varies randomly", house by house. */
export function credibilityFrom(unit: number): Credibility {
  return unit < 0.35 ? 'well' : unit < 0.7 ? 'decent' : unit < 0.9 ? 'mixed' : 'questionable';
}

/** A reproduction, once found out, is worth this share of what it was sold as. */
export const REPRODUCTION_SHARE = 0.05;

/* -------------------------------------------------------------------------- */
/* Estimates, the room, and a bid                                              */
/* -------------------------------------------------------------------------- */

/** On top of the hammer price. Twenty-five percent is the ordinary figure. */
export const BUYERS_PREMIUM = 0.25;
/** Where the room's top bid centres, against what the lot would fetch. */
export const ROOM_MEAN = 1.2;
export const ROOM_SPREAD = 0.25;

export type BidTier = 'careful' | 'fair' | 'determined';

export const BID_TIERS: readonly BidTier[] = ['careful', 'fair', 'determined'];

/** How far each goes, against the middle of the house's estimate. */
export const BID_TIER_REACH: Readonly<Record<BidTier, number>> = {
  careful: 0.85,
  fair: 1,
  determined: 1.3,
};

export const BID_TIER_LABELS: Readonly<Record<BidTier, string>> = {
  careful: 'Bid carefully',
  fair: 'Bid to the estimate',
  determined: 'Go after it',
};

export interface Estimate {
  readonly low: number;
  readonly high: number;
}

const nice = (n: number): number => {
  const step = n >= 100_000 ? 5_000 : n >= 10_000 ? 500 : n >= 1_000 ? 100 : 10;
  return Math.max(step, Math.round(n / step) * step);
};

/** The house's printed estimate, whole dollars. Biased by its credibility, and a little noisy. */
export function estimateFor(value: number, credibility: Credibility, unit: number): Estimate {
  const mid = value * CREDIBILITY_EFFECTS[credibility].estimateBias * (0.9 + 0.2 * unit);
  return { low: nice(mid * 0.85), high: nice(mid * 1.15) };
}

/** A standard normal draw from a stable key (Box–Muller). */
function normalFrom(key: string): number {
  const u1 = Math.max(1e-9, mixedUnit(`${key}:a`));
  const u2 = mixedUnit(`${key}:b`);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Everybody else's top bid for a lot worth `value`, whole dollars. Drawn once, from a key. */
export function roomTopBid(
  value: number,
  key: string,
  mean = ROOM_MEAN,
  spread = ROOM_SPREAD,
): number {
  const z = Math.max(-3, Math.min(3, normalFrom(key)));
  return Math.max(1, Math.round(value * Math.exp(Math.log(mean) + spread * z)));
}

/** How far a bid of this tier goes on this estimate, whole dollars. */
export const maxBidFor = (estimate: Estimate, tier: BidTier): number =>
  Math.round(((estimate.low + estimate.high) / 2) * BID_TIER_REACH[tier]);

export interface BidResult {
  readonly won: boolean;
  /** Where the bidding stopped. */
  readonly hammer: number;
  /** What the player pays, with the premium. Zero if they lost. */
  readonly paid: number;
}

/** The room against the player's ceiling. They pay where the room stopped, not their ceiling. */
export function resolveBid(maxBid: number, roomTop: number): BidResult {
  if (maxBid < roomTop) return { won: false, hammer: roomTop, paid: 0 };
  return { won: true, hammer: roomTop, paid: Math.round(roomTop * (1 + BUYERS_PREMIUM)) };
}

/* -------------------------------------------------------------------------- */
/* Storage units                                                               */
/* -------------------------------------------------------------------------- */

export type UnitSize = 'small' | 'medium' | 'large';

/**
 * What a unit's contents fetch on average, whole dollars, and the chance one
 * holds something worth having. Reality-TV jackpots are rare; most units are a
 * truck's worth of other people's furniture.
 */
export const UNIT_SIZES: Readonly<
  Record<UnitSize, { readonly expected: number; readonly treasure: number; readonly cap: number }>
> = {
  small: { expected: 500, treasure: 0.02, cap: 3_000 },
  medium: { expected: 1_400, treasure: 0.03, cap: 8_000 },
  large: { expected: 3_200, treasure: 0.05, cap: 20_000 },
};

/** The room bids blind too, and a little hopefully. */
export const STORAGE_ROOM_MEAN = 1.05;
export const STORAGE_ROOM_SPREAD = 0.35;

/** What the ordinary contents fetch, whole dollars, from a key: usually less than hoped. */
export function junkValueFor(size: UnitSize, key: string): number {
  const z = Math.max(-3, Math.min(3, normalFrom(key)));
  // Lognormal with a median under the mean: most units disappoint, a few don't.
  return Math.max(20, Math.round(UNIT_SIZES[size].expected * 0.6 * Math.exp(0.6 * z)));
}

/** "Bidding usually ends around $X" — what the yard tells you. */
export const usualPriceFor = (size: UnitSize): number => UNIT_SIZES[size].expected;
