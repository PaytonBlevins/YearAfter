/**
 * Ticket 0303 — what a year of being alive costs.
 *
 * WHAT WAS THERE BEFORE, AND WHY IT HAD TO GO
 *
 * 0210 shipped `livingCostOf` as a labelled placeholder with a replacement
 * date, and it did one thing: it took a SHARE of after-tax pay. That was the
 * right shape for a build whose only problem was a salary compounding into a
 * fortune, and it has exactly one structural consequence, measured at the top
 * of this ticket across 120 lives:
 *
 *   A character who never takes a job is charged NOTHING, for their whole life.
 *   6,357 adult years, zero of them costed. They hold $100 at thirty, $100 at
 *   fifty and $100 the day they die — the same number for sixty years, because
 *   nothing in the game has ever asked them for a dollar.
 *
 * The cost of living was attached to the PAYCHECK rather than to the LIFE. So
 * unemployment was free, retirement was free, and a character living off
 * savings spent nothing. It also meant four of the five things spec 191–193
 * says living costs are inferred from could not possibly matter: location,
 * housing, wealth and family circumstances have no way to reach a number that
 * is defined as a percentage of a wage.
 *
 * THE SHAPE NOW
 *
 *   cost = standard × location × household × housing
 *
 * A number of DOLLARS, charged every adult year, whether or not anybody was
 * paid. Each term is one of the things the spec names:
 *
 *   `standard`   what this person is used to spending on themselves — the
 *                wealth/income term, and the one that CREEPS (spec 193).
 *   `location`   the cost index of the city they live in (spec: location).
 *   `household`  who else that has to cover (spec: household size).
 *   `housing`    whether they are paying for a roof (spec: housing
 *                circumstances). Today that is one bit — at home, or not.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 * Not a budget. Spec 21 keeps the ledger on the backend and forbids
 * month-by-month accounting, and spec 1166 removes the lifestyle-tier selector
 * by name. The player never picks a tier, never sees a category breakdown, and
 * never gets a bill to approve. They see a life getting more expensive as it
 * gets bigger, which is what this is.
 */

import { cents, type Money } from '@yearafter/core';

/* -------------------------------------------------------------------------- */
/* The standard of living                                                      */
/* -------------------------------------------------------------------------- */

/**
 * What one adult spends in a year at index 1.00 with nothing coming in.
 *
 * The floor of the whole model, and the number that makes unemployment cost
 * something. It is not a poverty line, it is what it costs to keep existing in
 * an average American city: somewhere to sleep, food, getting about, a phone.
 *
 * A character with no income does not stop spending this; they run their
 * savings down and then they are SHORT, which `post` records as a `shortfall`
 * row. That row is exactly the thing 0307's loan engine should read.
 */
export const SUBSISTENCE = 18_600;

/**
 * How much of each extra after-tax dollar turns into spending rather than
 * saving, before the taper.
 *
 * TUNED, NOT CHOSEN — see the balance tests. Too high and nobody accumulates
 * anything, which makes every price in the game unreachable; too low and a
 * median career ends in a fortune, which makes every price free. Both failures
 * have already happened once in this build.
 *
 * RE-TUNED IN 0304, and the reason is worth keeping. 0303 set this to 0.84
 * against a model that was charging households for children who had long since
 * grown up — `livingChildren` where `childrenAtHome` was meant — so every
 * measurement it was tuned against was taken on a game that overcharged. Fixing
 * that lifted the median balance at forty from $101,000 to $171,000 in one
 * commit. A constant tuned against a bug is a constant that has to be tuned
 * again when the bug goes.
 */
export const MARGINAL_SPEND = 0.92;

/**
 * After-tax income past which each extra dollar is much less likely to be
 * spent. A high earner's life gets better, not proportionally more expensive.
 */
export const TAPER_FROM = 120_000;
export const TAPER_SPEND = 0.74;

/**
 * What holding money does to what you are used to.
 *
 * Spec 193: *"Lifestyle creep may occur implicitly as wealth rises."* Income is
 * most of it, but somebody sitting on a large balance lives a larger life than
 * somebody with the same salary and nothing behind them, and this is the only
 * term that says so. Small on purpose — wealth nudges the standard, it does not
 * set it.
 */
export const WEALTH_PULL = 0.018;

/** The standard a person on this income, holding this much, drifts toward. */
export function standardTargetFor(afterTaxIncome: number, wealth: number): number {
  const income = Math.max(0, afterTaxIncome);
  const ordinary = Math.min(income, TAPER_FROM);
  const rest = Math.max(0, income - TAPER_FROM);
  const fromIncome =
    SUBSISTENCE + Math.max(0, ordinary - SUBSISTENCE) * MARGINAL_SPEND + rest * TAPER_SPEND;
  return fromIncome + Math.max(0, wealth) * WEALTH_PULL;
}

/**
 * How fast a standard of living moves. Up quickly, down slowly.
 *
 * THIS ASYMMETRY IS THE WHOLE POINT and it is the thing a share-of-income model
 * cannot express. A raise turns into a bigger life within a year or two; losing
 * the job does not shrink it again on the same schedule, because the lease is
 * signed, the school is chosen and the habits are set. That lag is what makes
 * losing an income hurt in this game instead of simply pausing it — the costs
 * carry on at nearly the old size while nothing is coming in.
 *
 * It is also why `standard` has to be STATE rather than a function of this
 * year's income. A number that can be recomputed from the present has no memory,
 * and the memory is the feature.
 */
export const CREEP_UP = 0.34;
export const CREEP_DOWN = 0.12;

export function creep(standard: number, target: number): number {
  const rate = target > standard ? CREEP_UP : CREEP_DOWN;
  return Math.max(SUBSISTENCE, Math.round(standard + (target - standard) * rate));
}

/* -------------------------------------------------------------------------- */
/* Who and where                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Where the character sleeps, as far as money is concerned.
 *
 * One bit, because one bit is all the build can honestly support: v0.05 brings
 * renting, mortgages and property, and a richer enum now would be five values
 * with no producer — the mistake CORE_RULES 13.36 was written about, and which
 * `UNWRITTEN_CATEGORIES` in the ledger is already carrying five of.
 */
export type Housing = 'withFamily' | 'ownPlace';

/**
 * What living at home costs, as a share of living alone.
 *
 * Not zero. A person living with their parents still eats, still travels, still
 * has a phone — and a free option would make moving out a pure loss, which is
 * both untrue and the kind of asymmetry a player games. What they are not
 * paying for is the roof, which is most of it.
 */
export const AT_HOME_SHARE = 0.34;

/**
 * The household scale: each extra person costs less than the first.
 *
 * The OECD-modified equivalence scale, near enough — one for the first adult,
 * half for a second, a bit under a third for each child. Two people do not need
 * two of everything, which is why a couple is cheaper than two singles and why
 * a fourth child costs less than the first.
 */
export const PARTNER_SHARE = 0.5;
export const CHILD_SHARE = 0.3;

/**
 * A child's share, which RISES WITH THEIR AGE.
 *
 * Ticket 0304 inherited this idea rather than inventing it. `monthlyCostOf` in
 * `@yearafter/parenting` had carried the same curve since 0208 with a comment
 * saying *"a teenager costs more than a toddler, which every parent knows and
 * no game ever says"* — and that was right. What was wrong was that it was a
 * SECOND cost model: it told the player a child cost $420 a month while 0303
 * charged the household a flat share worth something else entirely, so the
 * number on the child's page was a number the game did not take.
 *
 * The curve lives here now, the placeholder is deleted (CORE_RULES 13.23), and
 * the figure the child's page shows is the figure the household is charged.
 */
export const TEEN_FROM = 13;
export const SCHOOL_FROM = 5;
export const SCHOOL_MULTIPLIER = 1.2;
export const TEEN_MULTIPLIER = 1.55;

export const childShare = (childAge: number): number =>
  CHILD_SHARE *
  (childAge >= TEEN_FROM ? TEEN_MULTIPLIER : childAge >= SCHOOL_FROM ? SCHOOL_MULTIPLIER : 1);

export const householdScale = (partnered: boolean, childAges: readonly number[]): number =>
  1 + (partnered ? PARTNER_SHARE : 0) + childAges.reduce((sum, age) => sum + childShare(age), 0);

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

export interface LivingInput {
  /** The standard carried in from last year, in index-1.00 dollars. */
  readonly standard: number;
  /** The city's cost index. 1.00 is an average American city. */
  readonly locationIndex: number;
  readonly partnered: boolean;
  /** The ages of the dependent children at home. A teenager costs more. */
  readonly childAges: readonly number[];
  readonly housing: Housing;
}

export interface LivingCost {
  /** Whole dollars, positive, for this year. */
  readonly total: number;
  /** The standard this was computed from, for the record. */
  readonly standard: number;
}

export function livingCostFor(input: LivingInput): LivingCost {
  const standard = Math.max(SUBSISTENCE, Math.round(input.standard));
  const housing = input.housing === 'withFamily' ? AT_HOME_SHARE : 1;
  const total = Math.round(
    standard * input.locationIndex * householdScale(input.partnered, input.childAges) * housing,
  );
  return { total: Math.max(0, total), standard };
}

/** The same, as a ledger amount: negative, in cents. */
export const livingAmount = (cost: LivingCost): Money => cents(-cost.total * 100);

/* -------------------------------------------------------------------------- */
/* Household state                                                             */
/* -------------------------------------------------------------------------- */

/**
 * What the household carries between years.
 *
 * Two fields, and both had to become state for the model above to be possible:
 * a standard with no memory is a share of income by another name, and housing
 * with no memory means the game cannot tell a twenty-two-year-old in their old
 * bedroom from one paying rent. Before this ticket the second was worse than
 * absent — 0209's `kicked-you-out` wrote a sentence about being told to leave
 * and changed nothing anywhere (CORE_RULES 13.36, again).
 */
export interface HouseholdFinances {
  readonly standard: number;
  readonly housing: Housing;
  /** The age they last moved out, if they have. For copy, and for 0305. */
  readonly leftHomeAt?: number;
  /**
   * The age they last had to move back in, if they have.
   *
   * Exists to stop the model flapping. Measured before it: 86 of 154 housing
   * changes across ninety lives happened one year after the previous one, and
   * one character moved house fifteen times — out on savings, short, home,
   * standard reset to subsistence, out again. Testing affordability against
   * income rather than savings fixed most of it; this closes the rest, at any
   * threshold, for the ordinary reason that somebody who has just given up a
   * place does not take another one the following spring.
   */
  readonly movedBackAt?: number;
}

export const NEW_HOUSEHOLD: HouseholdFinances = {
  standard: SUBSISTENCE,
  housing: 'withFamily',
};
