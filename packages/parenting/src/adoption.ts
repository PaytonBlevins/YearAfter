/**
 * Ticket 0208 — adoption.
 *
 * Spec 1666 names it beside pregnancy, and the Activities shell has carried an
 * Adoption row since 0110. It is deliberately NOT a second button that does the
 * same thing as the first: adoption is the route that does not need a partner
 * and does not care about the fertility curve, and it takes time and money
 * instead. Those are the real trade, and they are what make it a decision
 * rather than a fallback.
 */

import { canBecomeParent } from './parenting';

/** What an application costs when the character can pay it, in cents. */
export const APPLICATION_FEE = 180_000;

/**
 * What it actually costs THIS character — what they have, up to the fee.
 *
 * CORE_RULES 13.16. A flat $1,800 gate is a dependency on Ticket 0210, and
 * measuring 90 played families found adoption reached exactly zero times
 * because nobody in the game has an income yet. Adoption is the route that does
 * not need a partner, which makes it the one route a player with a failing
 * fertility roll actually has, so pricing it out of reach closed the last door.
 */
export const feeFor = (cash: number): number => Math.max(0, Math.min(APPLICATION_FEE, cash));

/**
 * Years between applying and a child arriving.
 *
 * A real range, not a countdown the player watches: it is what it is, it takes
 * as long as it takes, and the feed says where it has got to each year. That is
 * closer to the thing than a progress bar would be.
 */
export const WAIT_MIN = 1;
export const WAIT_MAX = 4;

/** The chance a given year of waiting is the year it happens. */
export function placementChance(yearsWaiting: number): number {
  if (yearsWaiting < WAIT_MIN) return 0;
  if (yearsWaiting >= WAIT_MAX) return 1;
  return 0.3 + (yearsWaiting - WAIT_MIN) * 0.2;
}

/**
 * How old a child is when they arrive.
 *
 * Deliberately not always a baby. Older children are the ones who actually wait
 * for placements, and a game where adoption silently means "newborn" would be
 * saying something untrue about how it works.
 */
export function ageOnArrival(roll: number): number {
  if (roll < 0.35) return 0;
  if (roll < 0.6) return 1 + Math.floor(roll * 4);
  if (roll < 0.85) return 5 + Math.floor(roll * 6);
  return 10 + Math.floor(roll * 6);
}

export interface AdoptionApplication {
  /** The player's age when they applied. */
  readonly appliedAtAge: number;
  /** Set when it completes, so the record survives as history. */
  readonly placedAtAge?: number;
  readonly withdrawnAtAge?: number;
}

export const isWaiting = (application: AdoptionApplication | undefined): boolean =>
  application !== undefined &&
  application.placedAtAge === undefined &&
  application.withdrawnAtAge === undefined;

/** Whether the player may start an application at all. */
export const canApply = (
  age: number,
  _cash: number,
  application: AdoptionApplication | undefined,
): boolean => canBecomeParent(age) && !isWaiting(application);
