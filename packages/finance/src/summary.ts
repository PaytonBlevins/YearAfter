/**
 * Ticket 0304 — what the player is shown about their money.
 *
 * Spec 19 lists nine things, in this order: cash balance, general income, tax
 * rate, total monthly outflow, assets, liabilities, net worth, investment
 * portfolio, credit. Spec 1843 repeats the list verbatim, so it is not a
 * suggestion.
 *
 * FOUR OF THE NINE HAVE NOTHING BEHIND THEM YET, and that is the whole design
 * problem of this ticket. Assets arrive with v0.05's property and vehicles,
 * liabilities with 0307's loan engine, investments with 0308, credit with
 * 0305–0306. A dashboard that rendered those as `$0` would be making four false
 * statements: "$0 of liabilities" says the game has looked and found no debts,
 * when what is true is that the game does not model debt. That is CORE_RULES
 * 13.36 pointed at a screen — a field nothing writes is not state, and showing
 * it as a number is how it stops being obviously empty.
 *
 * So this module computes only what exists, and `NOT_YET_OWNED` names what does
 * not, for the screen to say plainly. The list is meant to shrink, exactly like
 * `UNWRITTEN_CATEGORIES` in the ledger, and a test asserts its contents so that
 * the ticket which finally writes one has to come here and delete a line.
 *
 * WHAT THIS IS NOT ALLOWED TO BECOME
 *
 * Spec 20: *"Do not create a full expense-breakdown section. Expenses should be
 * contextual"* — open a child to see that child's cost. Spec 21: *"Do not show
 * month-by-month accounting to the player."* One outflow figure is not
 * accounting; a table of categories is. There is no category breakdown here and
 * there should not be one, however easy the ledger makes it.
 *
 * Spec 23: *"show one general income figure"* — not a list of income types,
 * even though the ledger can separate salary from commission from gifts.
 */

import { cents, type Money } from '@yearafter/core';
import { flows, totalFor, transactionsIn, type Ledger } from './ledger';

/**
 * The parts of net worth that no system writes yet.
 *
 * Meant to shrink. Each entry names the ticket that retires it, and the test on
 * this list is the note to that ticket.
 */
export const NOT_YET_OWNED = [
  { key: 'assets', label: 'Assets', arrives: 'v0.05' },
  { key: 'liabilities', label: 'Liabilities', arrives: '0307' },
  { key: 'investments', label: 'Investments', arrives: '0308' },
  // `credit` was here until Ticket 0305 built it. The list is meant to shrink,
  // and this is what shrinking looks like.
] as const;

export interface FinanceSummary {
  /** Spec 19, first: the cash balance. */
  readonly balance: Money;
  /**
   * Spec 23's ONE general income figure: everything that came in this year.
   *
   * Not "salary". A year's money can arrive as pay, commission, a paper round,
   * a gift from a parent or a twenty on the pavement, and a figure that only
   * counted wages would be wrong for most of a childhood and for any year
   * somebody was between jobs.
   */
  readonly income: Money;
  /**
   * The effective rate this year: tax paid over money earned.
   *
   * DERIVED FROM THE LEDGER rather than recomputed from the salary curve, and
   * that is deliberate. `taxRate` in `@yearafter/careers` would give the rate
   * the model INTENDED; this gives the rate the character actually paid, and
   * the two can differ — a year of gifts and no wages pays no tax on real
   * income. Two derivations of one number is CORE_RULES 13.23, and the ledger
   * is the one that is true by construction.
   */
  readonly taxRate: number;
  /** Spec 20: total monthly outflow. One number, and no breakdown. */
  readonly monthlyOutflow: Money;
  /**
   * Spec 19: net worth.
   *
   * Everything owned less everything owed — which today is the balance and
   * nothing else, because nothing in the build can be owned or owed yet. It is
   * reported anyway, with `onlyCash` set, so the screen can say WHY it equals
   * the balance instead of printing the same number twice with no explanation
   * (CORE_RULES 13.26).
   */
  readonly netWorth: Money;
  /** True while net worth is just the balance. Goes false in 0307 and v0.05. */
  readonly onlyCash: boolean;
  /** The year this describes. */
  readonly year: number;
  /** Whether anything at all moved this year. */
  readonly quiet: boolean;
}

export function summariseFinances(ledger: Ledger, year: number): FinanceSummary {
  const year_ = flows(ledger, year);
  const income = Number(year_.in);
  const out = Number(year_.out);

  /*
    Tax is measured against EARNED income, not against everything that came in.
    A character who was given $4,000 by a parent and paid $9,000 of tax on
    $42,000 of wages has an effective rate of 20%, not 19% — and a gift is not
    income the spec's "tax rate" row is about. Spec 1846 makes the same
    distinction for the canonical accounting: *"Cash gifts change cash but are
    not earned income."*
  */
  const earned =
    Number(totalFor(ledger, 'salary', year)) + Number(totalFor(ledger, 'commission', year));
  const tax = -Number(totalFor(ledger, 'tax', year));
  const taxRate = earned > 0 ? Math.max(0, Math.min(1, tax / earned)) : 0;

  return {
    balance: ledger.balance,
    income: cents(income),
    taxRate,
    // Rounded to whole cents, not to whole dollars: a year of $55,257 divides
    // into a month that is not a round number, and rounding it up here would
    // make twelve months come to more than the year.
    monthlyOutflow: cents(Math.round(out / 12)),
    netWorth: ledger.balance,
    onlyCash: true,
    year,
    quiet: transactionsIn(ledger, year).length === 0,
  };
}

/**
 * What one child costs the household in a month.
 *
 * Spec 20 by name: *"open a child to see that child's monthly cost"*. This is
 * the only one of that list the build can answer — there are no cars, no
 * properties and no businesses yet — and it is the reason the dashboard is
 * allowed to have one outflow figure and no breakdown: the breakdown lives on
 * the thing that causes the cost.
 *
 * The marginal cost of ONE child, not their share of the total. A household of
 * five does not cost five times a household of one, so dividing by heads would
 * report a number that is true of nobody. What a child actually costs is what
 * the household would stop spending if they were not in it, which is exactly
 * what `CHILD_SHARE` is worth at this standard.
 */
export const childMonthlyCost = (standard: number, locationIndex: number, share: number): Money =>
  cents(Math.round((standard * locationIndex * share * 100) / 12));
