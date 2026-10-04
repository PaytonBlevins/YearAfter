/**
 * Ticket 0402 — the job that comes looking for you.
 *
 * Spec 1700 asks for "career opportunities". Spec 1230 lists an Opportunity
 * event. What the build had instead, measured across 4,257 adult years in 80
 * played lives, was **zero decisions of any kind after the age of seventeen** —
 * of 374 authored events, 25 can fire for an adult and all 25 are passive.
 * Every decision and opportunity entry is capped at `ageMax: 17`. So this is
 * not a career feature slotted into a busy year; it is the first question this
 * game has ever asked a grown-up, and it needs to be worth asking.
 *
 * WHAT MAKES IT A DECISION RATHER THAN A GIFT, AND THE PRICE IS NOT THE ONE
 * THIS FILE FIRST CLAIMED. Measured over 4,279 employed years, 50.2% had a
 * better-paying job the character was eligible for that the six listings never
 * showed them, at a median raise of $19,000. Handing that over would be a
 * promotion with a button on it, so taking a job resets performance to a
 * stranger's — and that reset was written down here as the cost before anybody
 * checked whether it was one. It is not. Across 134 offers taken in paired
 * seeds, the takers were let go 45 times against the decliners' 44. ONE extra
 * firing. 13.57: a lever is inert until it crosses the threshold its consumer
 * applies, and `firingChance` does not notice two soft years.
 *
 * The real price was in the same table and nobody designed it: takers were
 * PROMOTED 178 times against the decliners' 265. Taking an offer costs about
 * two thirds of a promotion, because the tenure clock resets and
 * `promotionChance` scales with years served. So the trade this mechanic
 * actually offers is **a raise now against the ladder you were already on** —
 * which is what the prompt has to say, because a prompt that names the wrong
 * price is worse than one that names none.
 *
 * Taking still wins 78% of paired seeds ($299,806 median net worth against
 * $216,117) and that is allowed to be true: an offer you earned through
 * standing SHOULD usually be worth taking, or it is a trap wearing a
 * compliment. It is not a coin flip and this file does not pretend otherwise.
 *
 * AND IT IS EARNED, NOT DRAWN. An offer arriving out of nowhere is a slot
 * machine. This one is somebody who noticed: it needs standing in the track,
 * a year that went well, and time on the job — which is the first thing Work
 * Harder has ever bought that is not a promotion.
 */

import { ALL_JOBS, type Job } from './jobs';
import { START_STANDING } from './employment';

/**
 * How well thought of you have to be before anybody thinks of you.
 *
 * Below this an offer never arrives at any performance. Standing starts at 50
 * and Work Harder is the only thing that moves it, so this is a floor a player
 * reaches by working rather than by waiting.
 */
export const NOTICED_AT_STANDING = 58;

/** Nobody is headhunted out of a job they started this year. */
export const SETTLED_FOR_YEARS = 2;

/**
 * The most likely an offer ever is in one year, for somebody at the top of
 * their field having an excellent year.
 *
 * SWEPT, AND NOT ON THE MEDIAN. The obvious reading is how many offers a career
 * contains, and by that reading 0.16 was fine — median 1, p90 4. The number that
 * actually decided it is how many players never meet this feature at all:
 *
 * | ceiling | median | p90 | never offered anything |
 * |---|---|---|---|
 * | 0.16 | 1 | 4 | **37.5%** |
 * | 0.24 | 2 | 5 | 25.8% |
 * | 0.32 | 3 | 7 | 21.7% |
 *
 * At 0.16, more than a third of lives never see the only question this game
 * asks an adult. 0.32 barely improves on 0.24 — the remaining fifth never reach
 * `NOTICED_AT_STANDING` and are supposed not to — while pushing a busy career
 * to eleven offers, which is the slot machine spec 1233 forbids.
 */
export const OFFER_CEILING = 0.24;

/**
 * The chance somebody makes you an offer this year.
 *
 * Three inputs and no fourth: whether your field thinks well of you, whether
 * this year went well, and whether you have been there long enough for either
 * to mean anything. Deliberately NOT a function of pay, ambition or luck —
 * an offer you got for being ambitious is one the player cannot work towards.
 */
export function offerChance(standing: number, performance: number, yearsInJob: number): number {
  if (standing < NOTICED_AT_STANDING) return 0;
  if (yearsInJob < SETTLED_FOR_YEARS) return 0;

  // How far past being noticed they are, over the range that remains.
  const regard = Math.min(1, (standing - NOTICED_AT_STANDING) / (100 - NOTICED_AT_STANDING));
  // A bad year does not get you headhunted, however well regarded you are.
  const year = Math.max(0, (performance - START_STANDING) / (100 - START_STANDING));
  // Saturating: the difference between two years and five is real, between
  // twelve and fifteen nothing.
  const settled = Math.min(1, (yearsInJob - SETTLED_FOR_YEARS) / 4);

  return OFFER_CEILING * (0.25 + regard * 0.75) * (0.2 + year * 0.8) * (0.4 + settled * 0.6);
}

/**
 * What the offer is for.
 *
 * Every candidate the character could already apply to, that pays more than
 * what they hold — then the best of them, because an offer somebody troubled to
 * make is for the job they had in mind, not a random one.
 *
 * `eligible` is passed in rather than computed, because whether a job is within
 * reach is `cannotApply`'s question and this file must not answer it twice.
 */
export function offerFor(eligible: readonly Job[], current: Job, draw: number): Job | undefined {
  const better = eligible.filter((job) => job.pay > current.pay);
  if (better.length === 0) return undefined;

  /*
    THE BEST ONE IS NOT ALWAYS THE RIGHT ONE. Measured, 68.8% of the jobs the
    listings miss are on a ladder the character is already on and 31.2% are a
    cold start somewhere else. Always naming the highest-paid would mean every
    offer in the game was the same handful of top-of-catalog titles, which is
    13.26 — a row that says the same thing on every occasion is a row players
    stop reading. So the draw picks among the better ones, weighted towards the
    better-paid, and the top one is the most likely rather than the only one.
  */
  const ranked = [...better].sort((a, b) => b.pay - a.pay);
  const weights = ranked.map((_, index) => 1 / (index + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = draw * total;
  for (let index = 0; index < ranked.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor <= 0) return ranked[index];
  }
  return ranked[0];
}

/** Every job on the same track as this one, for naming who is doing the asking. */
export const sameTrackAs = (job: Job): readonly Job[] =>
  ALL_JOBS.filter((row) => row.track === job.track);
