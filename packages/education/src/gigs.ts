/**
 * Ticket 0206b — working an odd job.
 *
 * Review: "I also want to be able to perform freelance jobs at appropriate
 * ages."
 *
 * Lives in @yearafter/education rather than a new package because a child's
 * working life and their school life share one budget: the hours a paper round
 * takes are the hours that were going to go on homework, and the workload model
 * that already decides whether a character is overcommitted is the right place
 * for them to land. Ticket 0210 builds real employment and will want its own
 * home; a lemonade stand does not.
 */

import type { Talents, VisibleStats } from '@yearafter/character';
import type { Gig } from '@yearafter/content';
import { gigsForAge } from '@yearafter/content';
import { livingParents, type Household } from '@yearafter/relationships';

/** Odd jobs a character can hold at once. */
export const MAX_GIGS = 2;

export type GigUnavailable =
  'too-young' | 'too-old' | 'needs-parent' | 'hands-full' | 'already-in-it';

export interface GigOffer {
  readonly gig: Gig;
  readonly held: boolean;
  readonly unavailable?: GigUnavailable;
}

export const GIG_UNAVAILABLE_LABELS: Readonly<Record<GigUnavailable, string>> = {
  'too-young': 'Not at your age.',
  'too-old': 'You have aged out of this one.',
  'needs-parent': 'Needs an adult at home to vouch for you.',
  'hands-full': 'You already have as much work as you can carry.',
  'already-in-it': 'You are already doing this.',
};

export interface GigContext {
  readonly age: number;
  readonly household: Household;
  /** Gig ids already held. */
  readonly held: readonly string[];
}

export function gigUnavailable(gig: Gig, context: GigContext): GigUnavailable | undefined {
  if (context.held.includes(gig.id)) return 'already-in-it';
  if (context.age < gig.ageMin) return 'too-young';
  if (context.age > gig.ageMax) return 'too-old';
  if (gig.needsParent && livingParents(context.household).length === 0) return 'needs-parent';
  // Two at once. Not a rule about being busy — the workload model owns that —
  // but about what a person can plausibly be committed to at the same time.
  if (context.held.length >= MAX_GIGS) return 'hands-full';
  return undefined;
}

export function gigOffers(context: GigContext): readonly GigOffer[] {
  return gigsForAge(context.age)
    .map((gig) => {
      const unavailable = gigUnavailable(gig, context);
      return {
        gig,
        held: context.held.includes(gig.id),
        ...(unavailable && unavailable !== 'already-in-it' ? { unavailable } : {}),
      };
    })
    .sort((a, b) => {
      if (a.held !== b.held) return a.held ? -1 : 1;
      if (Boolean(a.unavailable) !== Boolean(b.unavailable)) return a.unavailable ? 1 : -1;
      return a.gig.ageMin - b.gig.ageMin;
    });
}

/**
 * What a year of this gig paid, in whole dollars.
 *
 * The stat the gig names decides where in its range the year landed, and the
 * relevant talent is worth a real premium — a kid who can actually play makes
 * more busking than a kid who cannot, which is the whole of why talents exist.
 *
 * Deliberately not random. The player chose this and stuck with it for a year;
 * how it went should be about them, not about a draw.
 */
export function gigPay(gig: Gig, stats: VisibleStats, talents: Talents): number {
  const ability = Math.max(0, Math.min(1, (stats[gig.stat] - 25) / 60));
  const talented = gig.talent ? talents[gig.talent] : false;
  const base = gig.payLow + (gig.payHigh - gig.payLow) * ability;
  return Math.round(base * (talented ? 1.35 : 1));
}

/** Hours a week everything they are working costs, for the workload model. */
export function gigHours(held: readonly Gig[]): number {
  return held.reduce((total, gig) => total + gig.hoursPerWeek, 0);
}

/**
 * The line the feed writes, with the money in it.
 *
 * CORE_RULES 13.6: the amount has to appear in the sentence the player reads.
 * The generator refuses to write a gig whose lines do not contain it, and this
 * is where that promise is kept.
 */
export function gigLine(gig: Gig, amount: number, variant: number): string {
  const index = Math.min(gig.lines.length - 1, Math.floor(variant * gig.lines.length));
  return (gig.lines[index] as string).replace('${amount}', `$${amount.toLocaleString('en-US')}`);
}
