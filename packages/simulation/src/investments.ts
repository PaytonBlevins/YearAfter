/**
 * Ticket 0308c — what a player can DO with a portfolio.
 *
 *   BUY    which instrument, and how much money into it.
 *   SELL   how many units back to cash.
 *   HOLD   the default, and the one that costs nothing to choose.
 *
 * Spec 1691's three verbs. Two are buttons; HOLD IS NOT, and that is deliberate
 * rather than missing — a verb meaning "leave it alone" should not need
 * pressing, and a screen that asked a player to confirm inaction every year
 * would be exactly the chore spec 1126-1136 removes.
 *
 * NOTHING HERE AUTO-LIQUIDATES. When cash runs short `advanceYear` draws on a
 * credit card; it does not reach into the portfolio. Selling to cover a year is
 * a thing the PLAYER does, and since 0308b made the portfolio count toward what
 * a household can afford, choosing not to sell is a decision with a consequence
 * rather than a free pass (CORE_RULES 13.53).
 */

import { cents, dollars, err, ok, type Result } from '@yearafter/core';
import {
  INSTRUMENTS,
  findBusinessType,
  findInstrument,
  instrumentsOfKind,
  type Instrument,
  type InstrumentKind,
} from '@yearafter/content';
import {
  buyUnits,
  canBuy,
  pledgeableAgainst,
  portfolioWorth,
  priceOf,
  sellUnits,
  MOST_OF_PAY,
  UNLOCKS_AT,
  advisorFee,
  benefitFor,
  canRetire,
  contributeYear,
  findAdvisor,
  retire,
  withdrawEarly,
  recommendationsFor,
  totalBorrowed,
  totalOwed,
  homesValue,
  mortgagesOwed,
  vehicleLoansOwed,
  vehiclesValue,
  valuablesValue,
  businessesValue,
  willTakeYou,
  type Estate,
  type Recommendation,
  type RetireRefusal,
  type TradeRefusal,
} from '@yearafter/finance';
import { findJob, payFor, standingIn } from '@yearafter/careers';
import { moveMoney, withCash } from './money';
import type { GameState } from './game-state';

/**
 * Everything owned and owed beyond the cash, for the net-worth line.
 *
 * ONE PLACE, for the reason `applicantFrom` and `borrowerFrom` give: a screen
 * that assembles its own view of what a character is worth is a second
 * derivation of the number, and two derivations disagree eventually
 * (CORE_RULES 13.23). The dashboard, the credit report and the private lender
 * all come through here.
 */
export const estateOf = (state: GameState): Estate => ({
  /*
    Ticket 0310. THE RETIREMENT BALANCE IS FOLDED IN HERE and nowhere else.

    Spec 163: "Do not separately show Annual Net Income or Retirement Assets.
    Retirement balances roll into Assets." Spec 1851 says it again. Adding it to
    `investments` is what makes that literally true — the dashboard gains no
    row, the net-worth line simply becomes right, and a character with $400,000
    in a pension stops reading as though they had nothing.

    It also means the ONE derivation rule holds: every screen that wants to know
    what somebody is worth already comes through this function (13.23), so none
    of them has to learn that retirement exists.
  */
  investments: cents(
    // IN CENTS, not dollars. The first version rounded both sides to whole
    // dollars before adding them and knocked $4 off a $20,000 portfolio — a
    // test caught it, and only because it checked the exact figure rather than
    // "roughly right". Money in this build is integer cents everywhere.
    Number(portfolioWorth(state.prices, state.portfolio)) + Number(state.retirement.balance),
  ),
  /*
    Ticket 0501. What the homes are worth now, and what is still owed on them.
    The value is spec 19's "assets"; the mortgage joins the liabilities, so a
    house bought with 5% down adds its equity to net worth and not its price.
  */
  /*
    Ticket 0504. And what the cars would fetch, with their loans among the
    liabilities. Spec 140 calls an ordinary car a depreciating possession
    rather than an investment, and that is what it is here — it loses value
    every year — but it is still owned, and net worth is what is owned less
    what is owed. Counting the loan and not the car would make buying one look
    like losing its whole price.
  */
  // Ticket 0506: and the jewelry, watches and collection, at what they'd fetch.
  // Ticket 0601: and what a business is worth to its owner, till included.
  assets: cents(
    Number(homesValue(state.homes)) +
      Number(vehiclesValue(state.vehicles)) +
      Number(valuablesValue(state.valuables)) +
      Number(businessesValue(state.businesses, findBusinessType, state.world.year)),
  ),
  liabilities: cents(
    Math.round(Number(totalOwed(state.cards)) / 100) * 100 +
      Math.round(Number(totalBorrowed(state.loans)) / 100) * 100 +
      Number(mortgagesOwed(state.homes)) +
      Number(vehicleLoansOwed(state.vehicles)),
  ),
});

/** What a private bank would lend against this character's holdings. */
export const pledgeableOf = (state: GameState): number =>
  pledgeableAgainst(state.prices, state.portfolio);

export type InvestError = TradeRefusal;

export interface InvestOutcome {
  readonly state: GameState;
  readonly title: string;
  readonly body: string;
  readonly good: boolean;
}

/** Buy into an instrument with a sum of money. */
export function invest(
  state: GameState,
  instrumentId: string,
  amount: number,
): Result<InvestOutcome, InvestError> {
  const instrument = findInstrument(instrumentId);
  if (!instrument) return err('noSuchInstrument');

  const cash = Math.round(Number(state.player.cash) / 100);
  const wanted = Math.round(amount);
  const refusal = canBuy(state.prices, state.portfolio, instrument, wanted, cash);
  if (refusal) return err(refusal);

  const bought = buyUnits(state.prices, state.portfolio, instrumentId, wanted);
  if (bought.units <= 0) return err('notEnoughForOneUnit');

  /*
    A NEGATIVE `investment` ROW, and the category matters more than usual.

    Spec 44-46 says investments are not outflow — but the money genuinely leaves
    the account, so the row has to exist or 0302's reconciliation breaks. The
    rule is honoured one layer up in `summariseFinances`, which takes
    `investment` rows out of the outflow figure and adds the portfolio back into
    net worth. Posting this as `spending` would be the easy mistake and would
    tell the player their cost of living had tripled.

    NOTE `bought.spent`, not `wanted`. Units round down, and a bond rounds down
    hard — $5,000 into a $1,000 bond buys five and must not take $5,000 from the
    account. Charging what was asked and keeping the difference is the same
    defect as the card row that said "some" and spent everything.
  */
  const moved = moveMoney(state, {
    category: 'investment',
    amount: dollars(-bought.spent),
    source: `${instrument.name} — bought`,
  });

  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      portfolio: bought.holdings,
    },
    title: 'Bought',
    body: `${units(bought.units)} of ${instrument.name} at ${price(
      priceOf(state.prices, instrumentId),
    )}, for ${money(bought.spent)}.`,
    good: true,
  });
}

/** Sell units back to cash. */
export function divest(
  state: GameState,
  instrumentId: string,
  wantedUnits: number,
): Result<InvestOutcome, InvestError> {
  const instrument = findInstrument(instrumentId);
  if (!instrument) return err('noSuchInstrument');
  if (!state.portfolio.some((holding) => holding.instrumentId === instrumentId)) {
    return err('nothingHeld');
  }

  const sale = sellUnits(state.prices, state.portfolio, instrumentId, wantedUnits);
  if (sale.raised <= 0) return err('nothingHeld');

  const moved = moveMoney(state, {
    category: 'investment',
    amount: dollars(sale.raised),
    source: `${instrument.name} — sold`,
  });

  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      portfolio: sale.holdings,
    },
    title: sale.penalty > 0 ? 'Sold early' : 'Sold',
    /*
      THE PENALTY GETS ITS OWN SENTENCE when there is one. A player who sells a
      bond four years early and reads only "$8,800 back in the bank" has been
      charged $1,200 by a screen that never mentioned it.
    */
    body:
      sale.penalty > 0
        ? `${units(sale.units)} sold. ${money(sale.raised)} in the bank — leaving early cost ${money(sale.penalty)}.`
        : sale.realized === 0
          ? `${units(sale.units)} sold for ${money(sale.raised)}, level on what you paid.`
          : sale.realized > 0
            ? `${units(sale.units)} sold for ${money(sale.raised)} — ${money(sale.realized)} more than you paid.`
            : `${units(sale.units)} sold for ${money(sale.raised)}, ${money(-sale.realized)} less than you paid.`,
    good: sale.realized >= 0,
  });
}

/* -------------------------------------------------------------------------- */
/* What an amount would do, before it does it                                  */
/* -------------------------------------------------------------------------- */

/**
 * The answer to "what happens if I press this", computed by the same functions
 * that press it.
 *
 * 0308d let the player type any amount instead of picking from three I chose,
 * and the moment they can type $4,137 the screen owes them an answer about what
 * $4,137 actually buys. The rounding is real and invisible: $5,000 into a
 * $1,040 bond buys FOUR bonds and spends $4,160, not five and $5,000.
 *
 * THE PREVIEW GOES THROUGH `buyUnits` AND `sellUnits`, not through a second
 * copy of the arithmetic on the screen. CORE_RULES 13.23: two derivations of
 * the same number disagree eventually, and the one place they must never
 * disagree is between what a button promises and what it does. This costs one
 * throwaway holdings array per keystroke, which is nothing, and it means a
 * change to the rounding rule cannot leave the label behind.
 */
export interface TradePreview {
  /** Units this amount would move. Zero when it would do nothing. */
  readonly units: number;
  /** Whole dollars actually leaving (buy) or arriving (sell). */
  readonly cash: number;
  /** What leaving a bond early would cost, in whole dollars. */
  readonly penalty: number;
  readonly refusal: TradeRefusal | undefined;
}

const NOTHING_DOING: TradePreview = {
  units: 0,
  cash: 0,
  penalty: 0,
  refusal: 'notEnoughForOneUnit',
};

export function previewBuy(
  state: GameState,
  instrumentId: string,
  dollars: number,
): TradePreview {
  const instrument = findInstrument(instrumentId);
  if (!instrument) return { ...NOTHING_DOING, refusal: 'noSuchInstrument' };
  const cash = Math.round(Number(state.player.cash) / 100);
  const wanted = Math.max(0, Math.round(dollars));
  if (wanted <= 0) return NOTHING_DOING;

  const refusal = canBuy(state.prices, state.portfolio, instrument, wanted, cash);
  if (refusal) return { ...NOTHING_DOING, refusal };

  const bought = buyUnits(state.prices, state.portfolio, instrumentId, wanted);
  if (bought.units <= 0) return NOTHING_DOING;
  return { units: bought.units, cash: bought.spent, penalty: 0, refusal: undefined };
}

/**
 * Selling, asked in MONEY rather than units.
 *
 * A player thinks "take out three thousand", not "sell 29.0698 shares", and the
 * symmetry with buying is worth more than the literal truth that a sale is
 * denominated in units. The units are derived here and shown in the preview, so
 * nothing is hidden — only reordered.
 *
 * THE AMOUNT ASKED FOR IS NOT ALWAYS THE AMOUNT THAT ARRIVES, and the preview
 * says which. Asking for $3,000 of a bond four years early sells $3,000 of bond
 * and puts $2,640 in the bank. Selling more units to make the arrival land on
 * $3,000 would be the tidier number and the worse behaviour: it spends more of
 * the player's position than they asked for, to hit a figure they would not
 * have known to check.
 */
export function previewSell(
  state: GameState,
  instrumentId: string,
  dollars: number,
): TradePreview {
  const holding = state.portfolio.find((row) => row.instrumentId === instrumentId);
  if (!holding) return { ...NOTHING_DOING, refusal: 'nothingHeld' };
  const price = priceOf(state.prices, instrumentId);
  if (price <= 0) return { ...NOTHING_DOING, refusal: 'noSuchInstrument' };

  const wanted = Math.max(0, Math.round(dollars));
  if (wanted <= 0) return NOTHING_DOING;

  // Capped at the position, so "sell $1,000,000" of a $400 holding sells the
  // holding rather than refusing over a number the player meant as "all of it".
  const units = Math.min(holding.units, (wanted * 100) / price);
  const sale = sellUnits(state.prices, state.portfolio, instrumentId, units);
  if (sale.units <= 0 || sale.raised <= 0) return NOTHING_DOING;
  return {
    units: sale.units,
    cash: sale.raised,
    penalty: sale.penalty,
    refusal: undefined,
  };
}

/* -------------------------------------------------------------------------- */
/* What the screens read                                                       */
/* -------------------------------------------------------------------------- */

export interface Offer {
  readonly instrument: Instrument;
  /** Cents. */
  readonly price: number;
  /** Change since last year, as a fraction. */
  readonly change: number;
  /** Units already held, or zero. */
  readonly held: number;
  readonly refusal: TradeRefusal | undefined;
}

/**
 * One tier of the market, priced and with the player's own position attached.
 *
 * HOLDING IS SHOWN WHILE BROWSING, which the reference app does not do: its
 * market list tells you what everything costs and never what you already own,
 * so the one number you need to decide with is on a different screen.
 */
export function marketFor(state: GameState, kind: InstrumentKind): readonly Offer[] {
  const cash = Math.round(Number(state.player.cash) / 100);
  return instrumentsOfKind(kind).map((instrument) => offerFor(state, instrument, cash));
}

export function offersFor(state: GameState, ids: readonly string[]): readonly Offer[] {
  const cash = Math.round(Number(state.player.cash) / 100);
  return ids
    .map((id) => findInstrument(id))
    .filter((row): row is Instrument => row !== undefined)
    .map((instrument) => offerFor(state, instrument, cash));
}

function offerFor(state: GameState, instrument: Instrument, cash: number): Offer {
  const priceNow = priceOf(state.prices, instrument.id);
  const before = state.prices.history[instrument.id]?.slice(-2)[0] ?? priceNow;
  return {
    instrument,
    price: priceNow,
    change: before > 0 ? (priceNow - before) / before : 0,
    held: state.portfolio.find((holding) => holding.instrumentId === instrument.id)?.units ?? 0,
    // Priced against the smallest buyable amount, because a row has to say yes
    // or no before a number exists.
    refusal: canBuy(
      state.prices,
      state.portfolio,
      instrument,
      Math.min(Math.ceil(priceNow / 100), Math.max(1, cash)),
      cash,
    ),
  };
}

/** Everything held, with today's price and what it has done. */
export const holdingsOf = (state: GameState) =>
  state.portfolio
    .map((holding) => {
      const instrument = findInstrument(holding.instrumentId);
      if (!instrument) return undefined;
      const worth = Math.round(holding.units * priceOf(state.prices, holding.instrumentId));
      return {
        holding,
        instrument,
        worth,
        paid: Number(holding.paid),
        gain: worth - Number(holding.paid),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== undefined);

/** The whole catalog, for a search or an "everything" view. */
export const allInstruments = (): readonly Instrument[] => INSTRUMENTS;

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

/** Prices are shown to the cent, because that is what makes them memorable. */
const price = (inCents: number): string =>
  `$${(inCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Units, without four decimal places of noise on a whole-unit holding.
 *
 * "412 shares" and "0.5431 of a coin" are both sentences; "412.0000 shares" is
 * a spreadsheet leaking into the copy.
 */
const units = (count: number): string =>
  Number.isInteger(count)
    ? count.toLocaleString('en-US')
    : count.toLocaleString('en-US', { maximumFractionDigits: 4 });

/* -------------------------------------------------------------------------- */
/* Ticket 0309 — advisors                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Hire somebody, or let them go.
 *
 * TWO VERBS AND NO CONTRACT. Spec 1860 puts no lock-in on advisors, and adding
 * one would turn a yearly judgement into a trap — the player is already paying
 * a fee they can watch, which is enough of a cost to make hiring a decision.
 *
 * The minimum is checked HERE rather than on the screen, for the reason every
 * gate in this build is checked in the engine: a rule enforced only by a
 * disabled button is a rule until somebody reaches it another way (13.15).
 */
export function hireAdvisor(state: GameState, advisorId: string): Result<GameState, InvestError> {
  const advisor = findAdvisor(advisorId);
  if (!advisor) return err('noSuchInstrument');
  const held = Math.round(Number(portfolioWorth(state.prices, state.portfolio)) / 100);
  if (!willTakeYou(advisor, held)) return err('notEnoughForOneUnit');
  return ok({ ...state, advisorId });
}

export function dismissAdvisor(state: GameState): GameState {
  const { advisorId, ...rest } = state;
  void advisorId;
  return rest as GameState;
}

/** This year's advice, or nothing when nobody is hired. */
export function adviceFor(state: GameState): readonly Recommendation[] {
  if (!state.advisorId) return [];
  return recommendationsFor({
    prices: state.prices,
    portfolio: state.portfolio,
    cash: Math.round(Number(state.player.cash) / 100),
    year: state.world.year,
    advisorId: state.advisorId,
  });
}

/** What this year's fee will be, for the screen to say before it is charged. */
export function feeThisYear(state: GameState): number {
  const advisor = state.advisorId ? findAdvisor(state.advisorId) : undefined;
  if (!advisor) return 0;
  return advisorFee(advisor, Math.round(Number(portfolioWorth(state.prices, state.portfolio)) / 100));
}

/**
 * Do what a recommendation says.
 *
 * ONE BUTTON, AND IT IS STILL A DECISION. CORE_RULES 13.28 says a tap is not a
 * decision — the thing that keeps this one honest is that the recommendation
 * names its reasoning and the advisor's own track record sits on the same
 * screen, so pressing it is agreeing with an argument rather than obeying an
 * oracle. Measured: a forecast is right about two thirds of the time.
 *
 * A `hold` has nothing to press, which is the same shape as 0308's missing HOLD
 * button — a verb meaning "leave it alone" should not need a tap.
 */
export function actOnAdvice(
  state: GameState,
  recommendationId: string,
): Result<InvestOutcome, InvestError> {
  const rec = adviceFor(state).find((row) => row.id === recommendationId);
  if (!rec) return err('noSuchInstrument');

  if (rec.verb === 'buy') {
    // A recommendation with no instrument means "put it somewhere sensible",
    // and the sensible somewhere is the broadest fund in the catalog rather
    // than a pick this advisor did not make.
    const target = rec.instrumentId ?? broadestFund()?.id;
    if (!target) return err('noSuchInstrument');
    const cash = Math.round(Number(state.player.cash) / 100);
    return invest(state, target, Math.min(cash, rec.amount ?? cash));
  }

  if (rec.verb === 'reduce' || rec.verb === 'sell' || rec.verb === 'rebalance') {
    const target = rec.instrumentId ?? biggestHolding(state);
    if (!target) return err('nothingHeld');
    const price = priceOf(state.prices, target);
    if (price <= 0) return err('noSuchInstrument');
    const wanted = rec.amount ?? 0;
    if (wanted <= 0) return err('notEnoughForOneUnit');
    const holding = state.portfolio.find((row) => row.instrumentId === target);
    if (!holding) return err('nothingHeld');
    return divest(state, target, Math.min(holding.units, (wanted * 100) / price));
  }

  // `hold` is the one with nothing to do, and saying so beats a dead button.
  return err('nothingHeld');
}

/** The fund with the widest spread of things inside it. */
const broadestFund = (): Instrument | undefined =>
  instrumentsOfKind('fund').slice().sort((a, b) => a.spread - b.spread)[0];

const biggestHolding = (state: GameState): string | undefined =>
  [...state.portfolio]
    .sort(
      (a, b) =>
        b.units * priceOf(state.prices, b.instrumentId) -
        a.units * priceOf(state.prices, a.instrumentId),
    )[0]?.instrumentId;

/* -------------------------------------------------------------------------- */
/* Ticket 0310 — retirement                                                    */
/* -------------------------------------------------------------------------- */

export type RetireError = RetireRefusal;

/**
 * How much of each paycheque goes into the account.
 *
 * A DIAL RATHER THAN A PURCHASE, which is the honest shape: a contribution is
 * a standing instruction, not a thing you buy once. Setting it to zero stops
 * it, and nothing already in the account comes back out — that is what
 * `takeOutEarly` is for, and it costs.
 */
export function setContribution(state: GameState, rate: number): GameState {
  const clamped = Math.max(0, Math.min(MOST_OF_PAY, rate));
  return { ...state, retirement: { ...state.retirement, rate: clamped } };
}

/**
 * Stop working.
 *
 * THE JOB GOES WITH IT, and that is the point of the verb. Before 0310 a
 * character could resign, but resigning just meant being unemployed and looking
 * for work — measured across 120 lives, 100% of characters alive at 65, 70 AND
 * 75 were still holding a job. Retiring is the state that says they are done,
 * and it is one-way on purpose: a player who could un-retire every time the
 * market dipped would be playing a different game.
 */
export function retireNow(state: GameState): Result<InvestOutcome, RetireError> {
  const refusal = canRetire(state.retirement, state.player.age);
  if (refusal) return err(refusal);

  const retirement = retire(state.retirement, state.player.age);
  const pot = Math.round(Number(retirement.balance) / 100);

  return ok({
    state: {
      ...state,
      retirement,
      // The job ends here rather than through `resign`, because this is not
      // quitting — there is no history entry that says "left to look for work".
      employment: { ...state.employment, job: undefined },
    },
    title: 'Retired',
    /*
      THE BODY NAMES WHAT THEY ACTUALLY HAVE, because "You retired" is the
      decoration this build keeps removing. A character who stops at fifty-five
      with nothing saved needs to be told that, in the moment they can still
      do something about it.
    */
    body:
      pot > 0
        ? `That is the last of the working years. ${money(pot)} put away, and it starts paying out now.`
        : 'That is the last of the working years. Nothing put away, so it will be tight.',
    good: pot > 0,
  });
}

/** Whether the screen should offer it, and why not when it should not. */
export const retirementRefusal = (state: GameState): RetireRefusal | undefined =>
  canRetire(state.retirement, state.player.age);

/** Money out before the date, which costs 20% below `UNLOCKS_AT`. */
export function takeOutEarly(
  state: GameState,
  amount: number,
): Result<InvestOutcome, RetireError> {
  const out = withdrawEarly(state.retirement, state.player.age, amount);
  if (out.taken <= 0) return err('notWorking');

  const moved = moveMoney(state, {
    category: 'investment',
    amount: dollars(out.taken),
    source: out.penalty > 0 ? 'Retirement — taken out early' : 'Retirement — withdrawn',
  });

  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      retirement: out.after,
    },
    title: out.penalty > 0 ? 'Taken out early' : 'Withdrawn',
    body:
      out.penalty > 0
        ? `${money(out.taken)} in the bank. Taking it out before ${UNLOCKS_AT} cost ${money(out.penalty)}.`
        : `${money(out.taken)} moved into your account.`,
    good: out.penalty === 0,
  });
}

/** What this year's paycheque would put in, for the screen to say beforehand. */
export function contributionPreview(state: GameState): { own: number; matched: number } {
  const job = state.employment.job;
  const row = job ? findJob(job.jobId) : undefined;
  const benefit = row ? benefitFor(row.template) : undefined;
  if (!benefit || !row || !job) return { own: 0, matched: 0 };
  const pay = payFor(
    row,
    Math.max(0, state.player.age - job.since),
    Number(job.performance),
    standingIn(state.employment, row.track),
  );
  const year = contributeYear(state.retirement, benefit, pay);
  return { own: year.own, matched: year.matched };
}

/** The benefit the current job carries, or nothing. */
export const benefitOfCurrentJob = (state: GameState) => {
  const job = state.employment.job;
  const row = job ? findJob(job.jobId) : undefined;
  return row ? benefitFor(row.template) : undefined;
};
