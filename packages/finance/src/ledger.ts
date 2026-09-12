/**
 * Ticket 0301 — the financial ledger.
 *
 * WHAT THIS IS FOR, IN ONE NUMBER
 *
 * Measured before it was built: an active character earns a lifetime gross of
 * **$4.26 million** and dies holding **$138,000**. Four million dollars pass
 * through a life and the game records none of it.
 *
 * And it is not that the numbers do not exist. `savedFrom` already computes
 * gross pay, then tax, then the cost of living — and returns ONE number, the
 * remainder. At $42,000 with two children it works out $8,604 of tax and
 * $32,647 of living costs, hands the player `$749`, and throws the other two
 * away. Every year, for a whole career. This package is where they go instead.
 *
 * IT IS ALSO AN ENFORCEMENT MECHANISM, NOT BOOKKEEPING
 *
 * CORE_RULES 13.6 has said since 0203b that any change to money names its
 * SOURCE and its AMOUNT. That has been kept by hand in six separate producers
 * for nine tickets, which is CORE_RULES 13.31 waiting to happen — an invariant
 * kept in six places is six promises. A `Transaction` cannot be constructed
 * without a category and a source, so after this the rule is a type error
 * rather than a habit.
 *
 * THE BALANCE IS A PROJECTION, NOT A SECOND OPINION
 *
 * `balance` is carried on the ledger and updated only by `post`. Nothing else
 * may write it. That is the difference between a cache and a second derivation
 * (CORE_RULES 13.23): there is exactly one function that can move money, and
 * `reconcile` re-adds every transaction to prove it was the only one used.
 * Spec 1678 makes that check build-blocking in 0302; it exists here as a
 * function and a test so that the ticket which adds the rule is not also the
 * ticket that discovers the ledger never worked.
 */

import { cents, type Money } from '@yearafter/core';

/**
 * What kind of money this was.
 *
 * The first ten are spec 1677's list, verbatim and in its order. `housing`,
 * `vehicle`, `debt`, `assetIncome` and `investment` have no producer yet and
 * are declared anyway — which is exactly the thing CORE_RULES 13.36 warns
 * about, so they are marked, and the marking is load-bearing: a category with
 * no writer is a promise, and the three fields that shipped as promises
 * (`droppedOut`, `alive`, `records`) each cost a later ticket a day.
 *
 * The last four are not in the spec and are here because the build already
 * moves money in ways the spec's list has no word for. Each says why.
 */
export type TransactionCategory =
  /* ---- spec 1677, in its own order ------------------------------------- */
  | 'salary'
  /** The at-risk half of pay. 0210's job templates already split it out. */
  | 'commission'
  | 'tax'
  /** The cost of being alive. 0303 replaces how it is calculated, not this. */
  | 'living'
  /** NO PRODUCER YET — v0.05 Ownership. */
  | 'housing'
  /** NO PRODUCER YET — v0.05 Ownership. */
  | 'vehicle'
  /** A parent handing money over (0209), or anybody else. */
  | 'gift'
  /** NO PRODUCER YET — 0307 Loan Engine. */
  | 'debt'
  /** NO PRODUCER YET — v0.05 property and 0308 investments. */
  | 'assetIncome'
  /** NO PRODUCER YET — 0308. Purchases there are TRANSFERS, not outflow. */
  | 'investment'
  /* ---- not in spec 1677, and each one is a producer that exists --------- */
  /**
   * Work that is not a job: a paper round, a weekend gig (0206b).
   *
   * Not `salary`, because a fourteen-year-old delivering papers does not have
   * one, and a dashboard that called it salary would be the game misdescribing
   * the only money a childhood ever sees.
   */
  | 'oddJob'
  /** Tuition (0210b). Its own category because a degree is not a living cost. */
  | 'tuition'
  /**
   * The player buying something that is not yet a modelled asset: a date, a
   * ring, a wedding, an adoption fee, a thing a child asked for.
   *
   * v0.05 turns most of these into `housing` and `vehicle`. Until then they are
   * real money leaving for a real reason and need somewhere honest to go.
   */
  | 'spending'
  /**
   * Money an event moved (0203b) — a raffle, a birthday, a found twenty.
   *
   * The catalog's `{ delta, source }` shape has carried the source since 0203b.
   * This is where it finally lands somewhere that keeps it.
   */
  | 'windfall'
  /**
   * What could not be paid, because cash floors at zero (CORE_RULES 13.13).
   *
   * NOT an accounting fiction. Until 0307's loan engine exists there is nowhere
   * to fall, so a character who cannot cover the year stops at zero — and the
   * part that went unpaid has to be WRITTEN DOWN or the ledger will not
   * reconcile. Measured: the floor binds in 89 of 4,255 played years, about 2%.
   *
   * It is also the hook 0307 needs. A shortfall is precisely the thing a loan
   * would have covered, and when the loan engine lands it reads this rather
   * than inventing its own notion of being short.
   */
  | 'shortfall';

/** Categories nothing writes yet. Exported so a test can assert the list shrinks. */
export const UNWRITTEN_CATEGORIES: readonly TransactionCategory[] = [
  'housing',
  'vehicle',
  'debt',
  'assetIncome',
  'investment',
];

export interface Transaction {
  /** Unique forever, like a timeline id (CORE_RULES 13.12). */
  readonly id: string;
  readonly year: number;
  /** The character's age, so a life reads without arithmetic. */
  readonly age: number;
  readonly category: TransactionCategory;
  /** Signed, in cents. Positive is money in. Never zero — see `post`. */
  readonly amount: Money;
  /**
   * Where it came from, in words a player would recognise.
   *
   * Required, not optional, and that is the point of the whole type:
   * CORE_RULES 13.6 becomes impossible to forget rather than easy to remember.
   */
  readonly source: string;
}

export interface Ledger {
  readonly transactions: readonly Transaction[];
  /**
   * Running balance in cents, maintained ONLY by `post`.
   *
   * Carried rather than summed on read because it is read constantly — every
   * price check, every affordability gate, every render of the header — and
   * summing two hundred transactions to draw one number is the kind of cost
   * that gets "optimised" later by somebody who then writes a second way to
   * update it. `reconcile` proves the two agree.
   */
  readonly balance: Money;
}

export const EMPTY_LEDGER: Ledger = { transactions: [], balance: cents(0) };

/** A transaction before the ledger has stamped it. */
export interface NewTransaction {
  readonly category: TransactionCategory;
  /** Signed, in cents. Positive is money in. */
  readonly amount: Money;
  readonly source: string;
}

export interface PostResult {
  readonly ledger: Ledger;
  /** What actually moved, after the zero floor. Signed cents. */
  readonly applied: Money;
  /**
   * The unpaid remainder, SIGNED THE SAME WAY AS `amount`.
   *
   * So asking to spend $1,000 with $400 in hand gives `applied: -40000` and
   * `short: -60000`, and the two always add up to what was asked for. Written
   * out because the first version of this file returned it positive while its
   * own doc comment said otherwise, and its own test caught the disagreement:
   * a value whose sign is a matter of opinion is a value somebody will add when
   * they should subtract.
   */
  readonly short: Money;
}

/**
 * Move money. The only way.
 *
 * Three things happen here and nowhere else: the transaction is stamped, the
 * balance moves, and the floor is applied AND RECORDED.
 *
 * A zero-amount transaction is dropped rather than stored. A ledger that logs
 * "$0 of tax" for every unemployed year would be mostly noise, and the feed
 * already learned this lesson: spec 1986's ordinary year with a small child
 * writes nothing at all.
 */
export function post(ledger: Ledger, year: number, age: number, entry: NewTransaction): PostResult {
  if (entry.amount === 0) return { ledger, applied: cents(0), short: cents(0) };

  const balance = Number(ledger.balance);
  const wanted = Number(entry.amount);
  // The floor binds only on the way out, and only past zero.
  const applied = balance + wanted < 0 ? -balance : wanted;
  /*
    `|| 0` is not superstition. `wanted - applied` is -0 whenever nothing was
    short, and -0 is a real value that survives into `Money`, compares equal to
    0 under `===` but not under `Object.is`, and prints as "-0". The first run
    of this file's tests caught it, which is the argument for asserting on a
    money type's edges rather than trusting arithmetic that "obviously" works.
  */
  const short = wanted - applied || 0;

  const stamped: Transaction[] = [
    {
      id: idFor(ledger, year, entry.category),
      year,
      age,
      category: entry.category,
      amount: cents(applied),
      source: entry.source,
    },
  ];

  /*
    The unpaid part is a transaction of its own, at zero effect on the balance.

    That looks odd until you try to reconcile without it: the ledger would say a
    character was charged $12,000 of living costs in a year they only had
    $400, and the balance would say $0, and the two would disagree by $11,600
    with nothing to point at. Recording the shortfall makes the sum come out AND
    leaves 0307 something to lend against.
  */
  if (short !== 0) {
    stamped.push({
      id: idFor(ledger, year, 'shortfall'),
      year,
      age,
      category: 'shortfall',
      amount: cents(0),
      source: `${entry.source} — ${formatShort(short)} of it went unpaid`,
    });
  }

  return {
    ledger: {
      transactions: [...ledger.transactions, ...stamped],
      balance: cents(balance + applied),
    },
    applied: cents(applied),
    short: cents(short),
  };
}

/** Post several at once, in order, each one seeing the last one's balance. */
export function postAll(
  ledger: Ledger,
  year: number,
  age: number,
  entries: readonly NewTransaction[],
): PostResult {
  let current = ledger;
  let applied = 0;
  let short = 0;
  for (const entry of entries) {
    const result = post(current, year, age, entry);
    current = result.ledger;
    applied += Number(result.applied);
    short += Number(result.short);
  }
  return { ledger: current, applied: cents(applied), short: cents(short) };
}

/**
 * Spec 1678, one ticket early.
 *
 * *"Opening cash + cash in − cash out = closing cash. Any mismatch fails
 * validation."* 0302 makes that build-blocking; it lives here now as a function
 * and a test, because the ticket that adds the rule should not also be the
 * ticket that discovers the ledger never satisfied it.
 *
 * What it actually proves is that `post` was the only thing that moved money.
 * A producer that writes `cash` directly and skips the ledger is the one defect
 * this package can suffer, and it is invisible any other way.
 */
export interface Reconciliation {
  readonly ok: boolean;
  readonly balance: Money;
  readonly summed: Money;
  readonly difference: Money;
}

export function reconcile(ledger: Ledger): Reconciliation {
  const summed = ledger.transactions.reduce((total, entry) => total + Number(entry.amount), 0);
  const balance = Number(ledger.balance);
  return {
    ok: summed === balance,
    balance: cents(balance),
    summed: cents(summed),
    difference: cents(balance - summed),
  };
}

/**
 * Spec 1678 in its own words, walked year by year.
 *
 *   "opening cash + cash in − cash out = closing cash. Any mismatch fails
 *   validation."
 *
 * THE FIRST VERSION OF THIS FUNCTION WAS A TAUTOLOGY, and it is worth saying so
 * because it looked exactly like a check. It computed one year's opening, in
 * and out from the transactions, added them up, and compared the result to
 * itself. It would have returned `ok: true` for every ledger ever built,
 * including a corrupt one, and it would have sat in the suite looking like
 * coverage.
 *
 * A period identity can only be a check if something OUTSIDE the period
 * anchors it. So this walks every year in order, carries the closing balance of
 * one into the opening of the next, and compares the final closing against
 * `ledger.balance` — which is maintained by `post` and is the independent
 * record.
 *
 * WHAT `ok` IS, HONESTLY: the same identity `reconcile` checks, restated a year
 * at a time. Every transaction belongs to exactly one year and the year list is
 * derived from the transactions, so the chain necessarily sums to the same
 * number — `reconcileByYear(l).ok === reconcile(l).ok` for every ledger, and a
 * test asserts it. It is stated here because the second draft of this comment
 * claimed the walk caught a row stamped with a wrong year, which it does not:
 * a row stamped 19700 does not fall outside the walk, it ADDS a year to it.
 *
 * What this adds over `reconcile` is the two things the sum cannot see:
 *
 *   `years`         the per-year rows, which is what a dashboard reads and
 *                   what names the year a drift began in.
 *   `firstBadYear`  a year that closes below zero. `post` floors at zero and
 *                   writes the shortfall down, so the chain should never dip —
 *                   and a life that ends at zero would hide a year that went
 *                   to minus forty thousand and came back.
 *
 * The wrong-year defect needs an anchor this function does not have. It is
 * `yearsOutside`, below, which takes the span from the life.
 */
export interface YearRow {
  readonly year: number;
  readonly opening: Money;
  readonly in: Money;
  readonly out: Money;
  readonly closing: Money;
}

export interface YearReconciliation {
  readonly ok: boolean;
  readonly years: readonly YearRow[];
  /** Where the chain ended. */
  readonly closing: Money;
  /** What `post` says it should be. */
  readonly balance: Money;
  readonly difference: Money;
  /** The first year whose closing does not match the next year's opening. */
  readonly firstBadYear?: number;
}

export function reconcileByYear(ledger: Ledger): YearReconciliation {
  const years = [...new Set(ledger.transactions.map((entry) => entry.year))].sort((a, b) => a - b);
  const rows: YearRow[] = [];
  let running = 0;
  for (const year of years) {
    const opening = running;
    let inflow = 0;
    let outflow = 0;
    for (const entry of ledger.transactions) {
      if (entry.year !== year) continue;
      const amount = Number(entry.amount);
      if (amount > 0) inflow += amount;
      else outflow -= amount;
    }
    running = opening + inflow - outflow;
    rows.push({
      year,
      opening: cents(opening),
      in: cents(inflow),
      out: cents(outflow),
      closing: cents(running),
    });
  }
  const balance = Number(ledger.balance);
  /*
    A year whose closing balance is negative is a defect even when the totals
    come out right: `post` floors at zero and records the shortfall, so the
    chain should never dip below it. Reported as the first bad year rather than
    failing outright, because the sum is the thing spec 1678 makes
    build-blocking and this is the thing that tells you where to look.
  */
  const bad = rows.find((row) => Number(row.closing) < 0);
  return {
    ok: running === balance,
    years: rows,
    closing: cents(running),
    balance: cents(balance),
    difference: cents(balance - running),
    ...(bad ? { firstBadYear: bad.year } : {}),
  };
}

/** Every year the ledger touches, in order. */
export const yearsIn = (ledger: Ledger): readonly number[] =>
  [...new Set(ledger.transactions.map((entry) => entry.year))].sort((a, b) => a - b);

/**
 * Years the ledger records that the life never lived.
 *
 * THE ANCHOR `reconcileByYear` HAS NOT GOT. A ledger's own years cannot tell
 * you a year is wrong — they are whatever the transactions say they are — so
 * the span has to come from outside the ledger, and the caller is the only one
 * who knows it: a life runs from the year it started to the year it is in, and
 * money cannot move in any other one.
 *
 * The defect it catches is a stamping bug, not an arithmetic one. `post` takes
 * the year as a parameter, so a producer that passed `state.world.year` where
 * it meant `nextYear` — or, as 0212 nearly did with ages, a birth year where it
 * meant a calendar year — writes rows that sum perfectly and belong to nothing.
 * Every balance check in this file passes on that ledger.
 */
export const yearsOutside = (ledger: Ledger, from: number, to: number): readonly number[] =>
  yearsIn(ledger).filter((year) => year < from || year > to);

/* -------------------------------------------------------------------------- */
/* Reading it back                                                             */
/* -------------------------------------------------------------------------- */

/** Everything in one year. */
export const transactionsIn = (ledger: Ledger, year: number): readonly Transaction[] =>
  ledger.transactions.filter((entry) => entry.year === year);

/** Signed total for a category, over the whole life or one year. */
export function totalFor(ledger: Ledger, category: TransactionCategory, year?: number): Money {
  return cents(
    ledger.transactions
      .filter((entry) => entry.category === category && (year === undefined || entry.year === year))
      .reduce((total, entry) => total + Number(entry.amount), 0),
  );
}

/**
 * Everything that came in, and everything that went out.
 *
 * Spec 23 wants ONE general income figure on the dashboard with the detail
 * viewed contextually, so this is the shape 0304 will read — not a
 * category-by-category table, which spec 21 rules out showing at all.
 */
export interface Flows {
  readonly in: Money;
  readonly out: Money;
}

export function flows(ledger: Ledger, year?: number): Flows {
  let inflow = 0;
  let outflow = 0;
  for (const entry of ledger.transactions) {
    if (year !== undefined && entry.year !== year) continue;
    const amount = Number(entry.amount);
    if (amount > 0) inflow += amount;
    else outflow -= amount;
  }
  return { in: cents(inflow), out: cents(outflow) };
}

/**
 * The one number every other package wants.
 *
 * Exists so that a caller setting `player.cash` reaches for the ledger rather
 * than for arithmetic. `cash: cashFrom(finance)` is the only correct way to
 * write that field after this ticket.
 */
export const cashFrom = (ledger: Ledger): Money => ledger.balance;

/* -------------------------------------------------------------------------- */
/* Internals                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A unique id, derived only from what is already in the ledger.
 *
 * No RNG and no clock, for the reason every id in this build avoids both: a
 * life has to replay identically from its seed. The counter is the number of
 * entries this year already has in this category, which is the same shape
 * `appendToTimeline` uses and is stable across a reload.
 */
function idFor(ledger: Ledger, year: number, category: TransactionCategory): string {
  const prefix = `f:${year}:${category}`;
  let count = 0;
  for (const entry of ledger.transactions) {
    if (entry.year === year && entry.category === category) count += 1;
  }
  // Defensive, like `appendToTimeline`: if a caller somehow produced a
  // collision anyway, walk past it rather than shipping a duplicate id.
  let id = `${prefix}:${count}`;
  while (ledger.transactions.some((entry) => entry.id === id)) {
    count += 1;
    id = `${prefix}:${count}`;
  }
  return id;
}

/** Whole dollars, for the one sentence a shortfall writes about itself. */
const formatShort = (amountCents: number): string =>
  `$${Math.round(Math.abs(amountCents) / 100).toLocaleString('en-US')}`;
