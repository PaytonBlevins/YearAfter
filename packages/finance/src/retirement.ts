/**
 * Ticket 0310 — retirement.
 *
 * Spec 1695 asks for "employer match/contributions/pensions; roll into
 * Investments/Assets", spec 163 says "do not separately show Retirement Assets"
 * and spec 1851 repeats it. So the balance is real, it grows in the real market,
 * and it never gets its own line on the dashboard.
 *
 * BUT THE MEASUREMENT CHANGED WHAT THIS TICKET IS. Across 120 played lives:
 *
 *     age   alive   still working   median pay
 *      55   90.8%          100.0%      $91,200
 *      65   83.3%          100.0%     $103,547
 *      75   47.5%          100.0%     $126,789
 *
 * NOBODY HAS EVER RETIRED IN THIS BUILD. A seventy-five-year-old is still
 * clocking in and still getting raises, because `capacityFor` ramped a child up
 * to sixteen and then held capacity flat forever — working into your nineties
 * was free, so stopping was strictly worse than not stopping and the decision
 * did not exist.
 *
 * A retirement account in that world is a system nobody would ever use, which
 * is CORE_RULES 13.7 in the mirror. So this ticket is three things rather than
 * one: something to build up, something to live on, and a reason to stop.
 *
 * AND IT MAKES TWO OLD PROMISES TRUE. `BENEFITS` in `@yearafter/careers` has
 * advertised "Retirement match, paid time off" on salaried roles and "Pension,
 * and it is a real one" on government ones since 0210. Both were display
 * strings with nothing behind them for two milestones — CORE_RULES 13.36 (a
 * field nothing writes is not state) in copy form. The table below is those
 * strings, honoured.
 */

import { cents, dollars, type Money } from '@yearafter/core';
import { instrumentsOfKind } from '@yearafter/content';
import { priceOf, previousPrice, type PriceBook } from './market';

/* -------------------------------------------------------------------------- */
/* What a job comes with                                                       */
/* -------------------------------------------------------------------------- */

export interface Benefit {
  /**
   * Employer match as a share of the employee's own contribution, capped at
   * `matchUpTo` of pay. 0.5 at 6% is the ordinary American shape.
   */
  readonly match: number;
  readonly matchUpTo: number;
  /**
   * A defined-benefit pension: this share of final pay per year of service.
   * Government work only, which is what the benefits copy already claims.
   */
  readonly pensionPerYear: number;
}

/**
 * Per template, and deliberately matched to the strings the careers package has
 * been showing players since 0210 rather than to a fresh idea.
 *
 * Performance and trade roles get nothing here, which is not an oversight —
 * their benefit strings promise a cut of the business and overtime, and both
 * already arrive as pay. Inventing a match for them would make the advertised
 * benefits wrong in the other direction.
 */
/**
 * The job templates, named here rather than imported.
 *
 * `JobTemplate` lives in `@yearafter/careers`, which does not depend on this
 * package and should not start — a career's benefits are a finance concept but
 * the catalog of careers is not. Importing it would buy a type check and cost a
 * new edge in the dependency graph and a `pnpm install` for everybody pulling
 * the repo.
 *
 * So the union is restated, and the risk of it drifting is covered by a DERIVED
 * test rather than by the type system: `retirement.test.ts` in the simulation
 * package can see both, and asserts that every real `JobTemplate` has a row
 * here. That guard cannot go stale the way a copied list can, which is the
 * lesson 0309 learned the hard way from `UNWRITTEN_CATEGORIES`.
 */
export type BenefitTemplate =
  | 'salary'
  | 'performance'
  | 'trade'
  | 'government'
  | 'professional'
  | 'management';

export const BENEFIT_BY_TEMPLATE: Readonly<Record<BenefitTemplate, Benefit>> = {
  salary: { match: 0.5, matchUpTo: 0.06, pensionPerYear: 0 },
  professional: { match: 0.5, matchUpTo: 0.06, pensionPerYear: 0 },
  management: { match: 0.5, matchUpTo: 0.08, pensionPerYear: 0 },
  // "Pension, and it is a real one." 1.6% of final pay per year of service is
  // a real one: thirty years gets a little under half.
  government: { match: 0, matchUpTo: 0, pensionPerYear: 0.016 },
  performance: { match: 0, matchUpTo: 0, pensionPerYear: 0 },
  trade: { match: 0, matchUpTo: 0, pensionPerYear: 0 },
};

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

export interface RetirementState {
  /** What is in the account, in cents. Invested, and it can fall. */
  readonly balance: Money;
  /** Share of pay the character puts in each year, 0 to `MOST_OF_PAY`. */
  readonly rate: number;
  /** Total years of pensionable service, accumulated across government jobs. */
  readonly serviceYears: number;
  /** Pay the pension will be reckoned against, in cents. */
  readonly finalPensionablePay: Money;
  /** The age they stopped working, once they have. */
  readonly retiredAtAge?: number;
}

export const NO_RETIREMENT: RetirementState = {
  balance: cents(0),
  rate: 0,
  serviceYears: 0,
  finalPensionablePay: cents(0),
};

/** Nobody may put in more than this share of pay. */
export const MOST_OF_PAY = 0.15;

/**
 * The age the money comes free, and what leaving early costs.
 *
 * Fifty-nine is the real rule and a good one for a game: it is far enough out
 * that a twenty-five-year-old is making a genuine trade, and near enough that
 * most characters live to see it — 83% of this build's population is alive at
 * sixty-five.
 */
export const UNLOCKS_AT = 59;
/** Taking it out before then. The real penalty is 10%; tax makes it worse. */
export const EARLY_WITHDRAWAL = 0.2;

/**
 * The age the state will pay a basic pension regardless of career.
 *
 * Not modelled as a separate system — spec 163 forbids a Retirement Assets line
 * and spec 1851 wants detail to live on the thing that produces it. This is a
 * floor under a character who saved nothing, so that retiring is a decision a
 * poor character can also make rather than a luxury.
 */
export const STATE_PENSION_AT = 67;
/** A year of it, in whole dollars. Deliberately not enough to live well on. */
export const STATE_PENSION = 18_000;

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

export interface ContributionYear {
  /** What the employee put in, in whole dollars. */
  readonly own: number;
  /** What the employer added on top. */
  readonly matched: number;
  readonly state: RetirementState;
}

/**
 * A year of paying in.
 *
 * THE MATCH IS THE WHOLE REASON THIS SYSTEM IS NOT A RATCHET, and it is worth
 * being precise about why. CORE_RULES 13.50 says an instrument that merely buys
 * time is worthless here, because waiting is free — so a locked account with an
 * ordinary return would be strictly worse than the same money in a fund. The
 * match is an instant 50% on the way in, which no fund offers, and that is what
 * pays for the lock.
 *
 * The cost on the other side is real too, and 0308b measured it: a character
 * who holds no cash is locked out of thirty-four stress-relieving events and
 * ends with a happiness of 20 against 78. Money in here is money that cannot
 * cover a bad year.
 */
export function contributeYear(
  state: RetirementState,
  benefit: Benefit,
  grossPayDollars: number,
): ContributionYear {
  if (state.retiredAtAge !== undefined || grossPayDollars <= 0 || state.rate <= 0) {
    return { own: 0, matched: 0, state };
  }
  const rate = Math.max(0, Math.min(MOST_OF_PAY, state.rate));
  const own = Math.round(grossPayDollars * rate);
  // The employer matches a share of what you put in, but only on the first
  // `matchUpTo` of PAY — putting in 15% does not buy a 15% match.
  const eligible = Math.min(rate, benefit.matchUpTo);
  const matched = Math.round(grossPayDollars * eligible * benefit.match);
  return {
    own,
    matched,
    state: { ...state, balance: cents(Number(state.balance) + (own + matched) * 100) },
  };
}

/** A year of pensionable service, for a job that offers one. */
export function serveYear(
  state: RetirementState,
  benefit: Benefit,
  grossPayDollars: number,
): RetirementState {
  if (benefit.pensionPerYear <= 0 || state.retiredAtAge !== undefined) return state;
  return {
    ...state,
    serviceYears: state.serviceYears + 1,
    // Final pay is the HIGHEST pensionable pay, not the last — somebody who
    // steps down to an easier government job at sixty should not lose the
    // pension they spent thirty years earning.
    finalPensionablePay: cents(
      Math.max(Number(state.finalPensionablePay), grossPayDollars * 100),
    ),
  };
}

/**
 * What the account did in the market this year.
 *
 * IT MOVES WITH THE BROAD FUND, not with a private growth rate. Spec 1851 says
 * retirement rolls into Investments, and the cheapest way to make that true
 * rather than decorative is for the balance to ride the same prices everything
 * else does — including the crashes 0308d spent a ticket making recoverable. A
 * character who retires the year after a crash feels it, which is the single
 * most important thing a retirement account can teach.
 */
export function growYear(state: RetirementState, prices: PriceBook): RetirementState {
  const balance = Number(state.balance);
  if (balance <= 0) return state;
  const fund = broadFund();
  if (!fund) return state;
  const now = priceOf(prices, fund);
  const before = previousPrice(prices, fund);
  if (before <= 0) return state;
  const moved = Math.round(balance * (now / before));
  return { ...state, balance: cents(Math.max(0, moved)) };
}

/** The steadiest fund in the catalog — what a retirement account would hold. */
const broadFund = (): string | undefined =>
  instrumentsOfKind('fund')
    .slice()
    .sort((a, b) => a.spread - b.spread)[0]?.id;

/* -------------------------------------------------------------------------- */
/* Stopping                                                                    */
/* -------------------------------------------------------------------------- */

export type RetireRefusal = 'stillTooYoung' | 'alreadyRetired' | 'notWorking';

/**
 * Nobody may stop before this, which is a game rule rather than a legal one.
 *
 * A twenty-year-old declaring themselves retired is not a decision, it is a way
 * to switch the employment system off — and spec 1126-1136's "remove chores"
 * does not mean "remove the game". Fifty-five is early retirement; the money
 * still does not come free until `UNLOCKS_AT`.
 */
export const EARLIEST_RETIREMENT = 55;

export function canRetire(state: RetirementState, age: number): RetireRefusal | undefined {
  if (state.retiredAtAge !== undefined) return 'alreadyRetired';
  if (age < EARLIEST_RETIREMENT) return 'stillTooYoung';
  return undefined;
}

export const retire = (state: RetirementState, age: number): RetirementState => ({
  ...state,
  retiredAtAge: age,
});

/* -------------------------------------------------------------------------- */
/* Living on it                                                               */
/* -------------------------------------------------------------------------- */

export interface RetirementIncome {
  /** The defined-benefit pension, in whole dollars a year. */
  readonly pension: number;
  /** The state's basic pension, once old enough. */
  readonly state: number;
  /** Drawn from the account this year. */
  readonly drawn: number;
  readonly after: RetirementState;
}

/**
 * How long the account is expected to last once somebody stops.
 *
 * Drawing a fixed SHARE rather than a fixed amount is what stops the account
 * emptying in a bad decade — and it is what makes a crash the year you retire
 * hurt without being fatal, which is the honest shape.
 */
export const DRAW_RATE = 1 / 22;

/** A year of being retired. */
export function drawYear(
  state: RetirementState,
  age: number,
  pensionable: Benefit | undefined,
): RetirementIncome {
  if (state.retiredAtAge === undefined) {
    return { pension: 0, state: 0, drawn: 0, after: state };
  }

  const pension =
    state.serviceYears > 0 && pensionable
      ? Math.round(
          (Number(state.finalPensionablePay) / 100) *
            pensionable.pensionPerYear *
            state.serviceYears,
        )
      : 0;

  const statePension = age >= STATE_PENSION_AT ? STATE_PENSION : 0;

  const balance = Number(state.balance) / 100;
  /*
    A SMALL BALANCE IS TAKEN IN ONE GO rather than dribbled out at 4.5% a year
    forever. Eleven dollars a year is not income, it is a row on a screen, and
    an account that can never empty is an account the player stops reading.
  */
  const drawn = balance <= 0 ? 0 : balance < 5_000 ? Math.round(balance) : Math.round(balance * DRAW_RATE);

  return {
    pension,
    state: statePension,
    drawn,
    after: { ...state, balance: cents(Math.max(0, Number(state.balance) - drawn * 100)) },
  };
}

/**
 * Taking money out before `UNLOCKS_AT`, which costs.
 *
 * The penalty exists so that the lock is real. Without it the account would be
 * a savings account with a match attached, and the decision to put money in
 * would have no downside at all.
 */
export interface EarlyWithdrawal {
  readonly taken: number;
  readonly penalty: number;
  readonly after: RetirementState;
}

export function withdrawEarly(
  state: RetirementState,
  age: number,
  wantedDollars: number,
): EarlyWithdrawal {
  const balance = Math.round(Number(state.balance) / 100);
  const wanted = Math.max(0, Math.min(balance, Math.round(wantedDollars)));
  if (wanted <= 0) return { taken: 0, penalty: 0, after: state };
  const penalty = age >= UNLOCKS_AT ? 0 : Math.round(wanted * EARLY_WITHDRAWAL);
  return {
    taken: wanted - penalty,
    penalty,
    after: { ...state, balance: cents(Number(state.balance) - wanted * 100) },
  };
}

/** What the whole arrangement is worth, for the net-worth line (spec 163). */
export const retirementWorth = (state: RetirementState): Money => dollars(
  Math.round(Number(state.balance) / 100),
);

/** The benefit a template comes with, or nothing for an unknown one. */
export const benefitFor = (template: string): Benefit | undefined =>
  (BENEFIT_BY_TEMPLATE as Readonly<Record<string, Benefit>>)[template];
