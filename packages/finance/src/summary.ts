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
export const NOT_YET_OWNED: readonly {
  readonly key: string;
  readonly label: string;
  readonly arrives: string;
}[] = [
  // `assets` came off in Ticket 0501: a home is the first thing a character can
  // own that is neither cash nor an investment. The list is empty now, and it
  // stays declared so the device survives for whatever spec 19 adds next.
  // `credit` came off in 0305. `liabilities` and `investments` came off in
  // 0308 — but `liabilities` should have come off in 0307, which built cards
  // and loans and left this line here claiming they had not arrived. See
  // CORE_RULES 13.51: a test asserting a list's CURRENT contents goes green
  // whether or not the list should have shrunk, so this device catches a
  // wrongful deletion and never catches a missing one. The test below now
  // checks each remaining entry against the tickets already built.
];

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
   * Spec 19: net worth. Everything owned less everything owed.
   *
   * TICKET 0308 MADE THIS TRUE, ONE TICKET LATE. It returned the bare cash
   * balance until now, with `onlyCash` permanently set, because when it was
   * written nothing could be owned or owed. 0306 and 0307 then shipped cards
   * and loans and never came back — so for two tickets the dashboard showed a
   * character with $40,000 of cash and $30,000 of card debt a net worth of
   * $40,000, and told them underneath that they owned nothing and owed nothing.
   *
   * See CORE_RULES 13.51 for why the not-yet-built list did not catch it.
   */
  readonly netWorth: Money;
  /**
   * True while net worth really is just the balance — nothing invested, no
   * cards, no loans. Now a fact about this character rather than about the
   * build, so it is computed from what they hold rather than hard-coded, and
   * it goes false the moment somebody borrows or buys anything.
   */
  readonly onlyCash: boolean;
  /** What the portfolio is worth. Zero until somebody buys something. */
  readonly investments: Money;
  /** Ticket 0501. Owned property, at what it is worth now. */
  readonly assets: Money;
  /** Cards plus loans. Positive means owed. */
  readonly liabilities: Money;
  /** The year this describes. */
  readonly year: number;
  /** Whether anything at all moved this year. */
  readonly quiet: boolean;
}

/** What the character owns and owes beyond their cash, for the net-worth line. */
export interface Estate {
  /** Portfolio value. */
  readonly investments: Money;
  /**
   * Ticket 0501. What owned property is worth — spec 19's "assets". Optional,
   * so every caller written before homes existed means "none".
   */
  readonly assets?: Money;
  /** Everything owed — card balances and loan balances. */
  readonly liabilities: Money;
}

const NOTHING: Estate = { investments: cents(0), liabilities: cents(0) };

export function summariseFinances(
  ledger: Ledger,
  year: number,
  estate: Estate = NOTHING,
): FinanceSummary {
  const year_ = flows(ledger, year);

  /*
    SPEC 44-46: INVESTMENTS ARE TRANSFERS, NOT FLOWS.

    Buying $10,000 of shares moves $10,000 of real cash and the row belongs in
    the ledger — 0302's reconciliation would break on the spot without it. What
    it is not is an EXPENSE: the money still exists, it is just no longer cash,
    and a monthly-outflow figure that counted it would tell a player who saved
    hard that their cost of living had tripled. A SALE is the same thing upside
    down: money coming back across the same line, and not income.

    Both sides come out, and they come out SEPARATELY rather than netted. A
    character who bought $10,000 and sold $3,000 has $10,000 of buying in the
    outflow and $3,000 of selling in the inflow; subtracting the $7,000 net from
    the outflow alone would leave $3,000 of purchase still counted as a cost.
  */
  let bought = 0;
  let sold = 0;
  for (const entry of transactionsIn(ledger, year)) {
    // Ticket 0501: a house is bought and sold across the same line.
    if (entry.category !== 'investment' && entry.category !== 'property') continue;
    const amount = Number(entry.amount);
    if (amount < 0) bought -= amount;
    else sold += amount;
  }
  const income = Math.max(0, Number(year_.in) - sold);
  const out = Math.max(0, Number(year_.out) - bought);

  /*
    Tax is measured against EARNED income, not against everything that came in.
    A character who was given $4,000 by a parent and paid $9,000 of tax on
    $42,000 of wages has an effective rate of 20%, not 19% — and a gift is not
    income the spec's "tax rate" row is about. Spec 1846 makes the same
    distinction for the canonical accounting: *"Cash gifts change cash but are
    not earned income."*
  */
  // Ticket 0502: a partner's pay is earned income too, and the tax row
  // includes the tax on it, so leaving it out would overstate the rate.
  const earned =
    Number(totalFor(ledger, 'salary', year)) +
    Number(totalFor(ledger, 'commission', year)) +
    // Ticket 0601: what a business paid its owner is earned, and so is the tax on it.
    Number(totalFor(ledger, 'business', year)) +
    Number(totalFor(ledger, 'partner', year));
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
    // Everything owned, less everything owed. The `onlyCash` flag is now a
    // statement about this character rather than about the build.
    netWorth: cents(
      Number(ledger.balance) +
        Number(estate.investments) +
        Number(estate.assets ?? 0) -
        Number(estate.liabilities),
    ),
    onlyCash:
      Number(estate.investments) === 0 &&
      Number(estate.assets ?? 0) === 0 &&
      Number(estate.liabilities) === 0,
    investments: estate.investments,
    assets: estate.assets ?? cents(0),
    liabilities: estate.liabilities,
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

/* -------------------------------------------------------------------------- */
/* Making the not-yet-built device actually work                               */
/* -------------------------------------------------------------------------- */

/**
 * The most recent ticket that has shipped. Bumped by each ticket as it lands.
 *
 * THIS EXISTS BECAUSE THE DEVICE FAILED ONCE. `NOT_YET_OWNED`, like
 * `UNWRITTEN_CATEGORIES` and `LOAN_TYPES_NOT_YET_BUILT`, is guarded by a test
 * asserting the list's contents — and that test can only ever catch a WRONGFUL
 * deletion. A line that should have been removed and was not keeps the test
 * green, which is precisely what happened: 0307 built cards and loans and left
 * `{ key: 'liabilities', arrives: '0307' }` sitting in the list for a whole
 * ticket, telling every player that liabilities had not arrived while the
 * screen showed their card balance two rows below.
 *
 * With this, a stale entry fails: see `stillAhead`. CORE_RULES 13.51.
 */
export const TICKET = '0604';

/**
 * Whether a promised arrival is still in the future.
 *
 * Accepts both spellings the build uses — a four-digit ticket like `0308`, and
 * a milestone like `v0.05`. A ticket belongs to the milestone its first two
 * digits name, so `0308` is inside `v0.03` and sorts before `v0.05`.
 */
export function stillAhead(arrives: string, now: string = TICKET): boolean {
  const rank = (value: string): number =>
    /^\d{4}$/.test(value)
      ? Number(value)
      : // A milestone with no ticket number is everything in it, so it compares
        // as the LAST ticket that milestone could contain.
        Number(value.replace(/^v(\d)\.(\d\d)$/, '$1$2')) * 100 + 99;
  return rank(arrives) > rank(now);
}
