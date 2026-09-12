/**
 * Ticket 0210 — what a job pays. Ticket 0303 — and no longer what it costs.
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
 * TICKET 0303 CAME AND TOOK THE COST OF LIVING OUT OF THIS FILE.
 *
 * `livingCostOf`, `livingShare` and their five constants are GONE — deleted,
 * not deprecated and not kept alongside, because 0210 promised exactly that and
 * because CORE_RULES 13.8 says two systems never bill the same account. A
 * character charged rent by this file and again by the living phase is that bug
 * with a worked example.
 *
 * The reason they had to go is not tidiness. Expressing the cost of living as a
 * SHARE of pay meant it could only ever be charged to somebody who was paid:
 * measured across 120 lives, a character who never took a job was charged
 * nothing for sixty years. `@yearafter/finance/living` charges the LIFE.
 *
 * What stays here is what a job actually pays and what tax takes, which is the
 * only part of the arithmetic that belongs to employment.
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
 * What a year of this job puts in the bank before anything is spent.
 *
 * `savedFrom` used to live here and returned pay minus tax MINUS THE COST OF
 * LIVING, which is why it was called savings. 0303 moved the cost of living to
 * the phase that charges everybody, so what employment hands over is take-home
 * — and a year can still end behind, it just ends behind for a reason that is
 * now recorded as its own transaction rather than folded into this number.
 */
export const takeHome = (grossPay: number): number => afterTax(grossPay);

/* -------------------------------------------------------------------------- */
/* The breakdown — Ticket 0301, narrowed by 0303                              */
/* -------------------------------------------------------------------------- */

/**
 * The same year of pay, itemised instead of collapsed.
 *
 * 0301 built this to stop the game throwing numbers away: `savedFrom` computed
 * gross, then tax, then the cost of living, and returned only the remainder —
 * at $42,000 with two children, $8,604 and $32,647 discarded to hand back $749,
 * every year, across a lifetime gross of four and a quarter million dollars.
 *
 * 0303 TOOK `living` AND `saved` BACK OUT, and that is a narrowing rather than
 * a reversal. The cost of living is not a property of a job — it is a property
 * of a household, and a household has one whether or not anybody is employed.
 * Leaving a `living` field here would have meant two places computing the cost
 * of being alive, which is the exact bug 0210 labelled this file to prevent.
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
  /** What reached the bank. Gross minus tax, and nothing else. */
  readonly takeHome: number;
}

export function payBreakdown(
  job: Job,
  years: number,
  performance: number,
  standing: number,
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
  return { steady, commission, tax: gross - net, takeHome: net };
}
