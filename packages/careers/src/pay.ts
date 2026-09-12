/**
 * Ticket 0210 — what a job pays, and what is left of it.
 *
 * THE PROBLEM THIS FILE EXISTS TO SOLVE.
 *
 * Measured before anything was built, across 300 lives: a character's cash is
 * p10 $28, median $135, p90 $1,175 — and those are the SAME three numbers at
 * eighteen, twenty-two, twenty-five, thirty and forty. Nothing has moved money
 * in adulthood, in either direction, for the whole of the build so far.
 *
 * Dropping a $34,000 salary into that is a three-hundred-fold step change, and
 * with no outflow anywhere in the game it compounds untouched: a character
 * would finish their forties holding most of a million dollars with nothing
 * that has ever asked them for a dollar. Every price in the game — a wedding,
 * an adoption fee, a parent's contribution to college — would become free.
 *
 * So the salary a player is SHOWN is a real salary, because spec 1827 asks for
 * realistic ranges and because a number the player is told is a number that has
 * to be true. What reaches their cash is what is left after tax and after the
 * cost of living, which is savings — and savings is the honest thing for a bank
 * balance to be.
 *
 * THIS IS A PLACEHOLDER WITH A NAME AND A REPLACEMENT DATE (spec 1247–1263).
 *
 * Ticket 0303 builds living expenses properly — "inferred from income, wealth,
 * family, location, circumstances; no lifestyle selector" — and 0301 builds the
 * ledger that records them as real transactions. When 0303 lands, `livingCostOf`
 * is DELETED rather than kept alongside, because CORE_RULES 13.8 says two
 * systems never bill the same account and a character charged rent twice is
 * exactly that bug.
 */

import type { Job } from './jobs';
import { TEMPLATES } from './jobs';

/* -------------------------------------------------------------------------- */
/* Tax                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * An effective rate, not a bracket table.
 *
 * Spec 1683 puts "Tax Rate" on the finance dashboard and spec 1677 makes tax a
 * ledger category, and neither asks for a tax model. A player is never going to
 * make a decision about a marginal band, so per the Low-Friction Realism Test
 * (spec 1126–1136) this stays backend and stays one curve.
 */
export const TAX_FLOOR = 0.1;
export const TAX_CEILING = 0.34;
const TAX_FULL_AT = 220_000;

export function taxRate(grossPay: number): number {
  if (grossPay <= 0) return 0;
  const climb = Math.min(1, grossPay / TAX_FULL_AT);
  // Square-rooted so the rate rises fast across ordinary incomes and slowly
  // after — which is what a progressive system feels like from inside one.
  return TAX_FLOOR + (TAX_CEILING - TAX_FLOOR) * Math.sqrt(climb);
}

export const afterTax = (grossPay: number): number =>
  Math.max(0, Math.round(grossPay * (1 - taxRate(grossPay))));

/* -------------------------------------------------------------------------- */
/* The cost of being alive                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Share of after-tax income that goes on living, for somebody with nobody.
 *
 * MEASURED. At 0.93 with relief arriving by $120k, a character on a median
 * $58,000 salary finished at fifty holding $226,000 and a driven one $467,000,
 * which would have made every price in the game free — the exact failure this
 * file exists to prevent. Savings appear properly only well up the income
 * scale now, which is both truer and what keeps a wedding a decision.
 */
export const BASE_SHARE = 0.965;
/** How much of that share a large income buys back. */
export const INCOME_RELIEF = 0.26;
/** After-tax income at which the relief is fully earned. */
export const RELIEF_FULL_AT = 200_000;
/** What each dependent adds back. Three of them undo the relief entirely. */
export const PER_DEPENDENT = 0.028;
/**
 * The floor and the ceiling on that share.
 *
 * The ceiling is ABOVE ONE on purpose. At 0.985 every household on earth saved
 * at least a little, a small wage and four children still came out $307 ahead,
 * and `BEHIND_LINES` in the employment phase — four sentences about a year that
 * went backwards — could never be reached by anything. Writing copy for a state
 * the model cannot produce is CORE_RULES 13.16 in miniature, and the test that
 * asserts a year can end behind is what found it.
 */
export const SHARE_FLOOR = 0.52;
export const SHARE_CEILING = 1.06;

/**
 * What a year of living costs this household, in whole dollars.
 *
 * Expressed as a SHARE of after-tax income rather than a price, for the reason
 * `costShare` gives in `@yearafter/parenting`: a fixed price divided by an
 * income that spans p10 $28k to p90 $253k answers "can they afford it" with
 * "no" for most of the population and "trivially" for the rest, and neither is
 * a decision. A share keeps working when the incomes change.
 *
 * The shape: most of a small income is spent, a large income buys some slack
 * back, and every dependent takes slack away again. Spec 191–193 — "living
 * costs are automatically calculated from location, household size,
 * wealth/income, housing circumstances, family circumstances" — with location
 * and housing missing because neither exists yet.
 */
export function livingShare(afterTaxIncome: number, dependents: number): number {
  const relief = INCOME_RELIEF * Math.min(1, Math.max(0, afterTaxIncome / RELIEF_FULL_AT));
  const share = BASE_SHARE - relief + PER_DEPENDENT * Math.max(0, dependents);
  return Math.min(SHARE_CEILING, Math.max(SHARE_FLOOR, share));
}

export const livingCostOf = (afterTaxIncome: number, dependents: number): number =>
  Math.round(afterTaxIncome * livingShare(afterTaxIncome, dependents));

/* -------------------------------------------------------------------------- */
/* What this job pays this year                                                */
/* -------------------------------------------------------------------------- */

/**
 * Gross pay for one year in this job, in whole dollars.
 *
 * Three inputs. `years` is time served, which is a raise. `performance` is how
 * the year went, which for a salaried job barely matters and for a commissioned
 * one is most of the money — that difference IS the performance template, and
 * spec 1394 asks for it by name. `standing` is career-specific reputation
 * (spec 113–118), worth a little everywhere.
 */
export function payFor(job: Job, years: number, performance: number, standing: number): number {
  const rules = TEMPLATES[job.template];
  // Raises compound, and are capped so a forty-year career does not quietly
  // become a fortune through nothing but attendance.
  const seniority = Math.min(1.9, (1 + rules.raise) ** Math.max(0, years));
  const steady = job.pay * seniority * (1 - rules.atRisk);
  // How the year went, centred on 50 so an average year pays the average.
  const howItWent = (performance - 50) / 50 + ((standing - 50) / 50) * 0.35;
  const variable =
    job.pay * seniority * rules.atRisk * (1 + Math.max(-1, Math.min(1.6, howItWent)) * job.spread);
  return Math.max(0, Math.round(steady + variable));
}

/**
 * What actually lands in the character's pocket after a year of this.
 *
 * Can be NEGATIVE, and that is the point: a household whose costs outrun a
 * small wage loses ground, which is a thing that happens to people and is the
 * only reason the number on the Career screen means anything. The caller is
 * responsible for never taking cash below zero (CORE_RULES 13.13).
 */
export function savedFrom(grossPay: number, dependents: number): number {
  const net = afterTax(grossPay);
  return net - livingCostOf(net, dependents);
}

/* -------------------------------------------------------------------------- */
/* The breakdown — Ticket 0301                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The same year of pay, itemised instead of collapsed.
 *
 * `savedFrom` computes gross, then tax, then the cost of living, and returns
 * ONE number — the remainder. Measured at the top of 0301: at $42,000 with two
 * children it works out $8,604 of tax and $32,647 of living costs, hands back
 * $749, and throws the other two away. Every year, for a whole career, across a
 * lifetime gross of four and a quarter million dollars.
 *
 * So this returns all four. Nothing about the arithmetic changed — `saved` is
 * still exactly `savedFrom` and a test asserts it — which is the point: 0301 is
 * a ledger, not a rebalance, and a ticket that quietly moved everybody's income
 * while claiming to add bookkeeping would be impossible to review.
 *
 * The steady/commission split is `atRisk`, which 0210's templates have carried
 * since the day they were written: a salaried job is 5% at risk and a
 * commissioned one is most of it, and that difference IS the performance
 * template spec 1394 asks for. Spec 1677 lists `commission` as a category of
 * its own, and this is the only place in the build that can tell them apart.
 */
export interface PayBreakdown {
  /** The part that arrives whether or not the year went well. */
  readonly steady: number;
  /** The part that depended on performance and standing. Often zero. */
  readonly commission: number;
  /** Positive. What was withheld. */
  readonly tax: number;
  /** Positive. What a year of being alive cost this household. */
  readonly living: number;
  /** Signed. What is left, and can be negative — see `savedFrom`. */
  readonly saved: number;
}

export function payBreakdown(
  job: Job,
  years: number,
  performance: number,
  standing: number,
  dependents: number,
): PayBreakdown {
  const rules = TEMPLATES[job.template];
  const gross = payFor(job, years, performance, standing);
  const seniority = Math.min(1.9, (1 + rules.raise) ** Math.max(0, years));
  // Recomputed rather than returned from `payFor` so that the two cannot drift:
  // the steady half is defined by the template, and whatever gross is left over
  // after it is by definition the at-risk half. A second formula for the
  // variable part would be a second derivation (CORE_RULES 13.23).
  const steady = Math.min(gross, Math.round(job.pay * seniority * (1 - rules.atRisk)));
  const commission = gross - steady;
  const net = afterTax(gross);
  const living = livingCostOf(net, dependents);
  return { steady, commission, tax: gross - net, living, saved: net - living };
}
