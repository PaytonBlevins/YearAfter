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

import { dollars, err, ok, type Result } from '@yearafter/core';
import {
  INSTRUMENTS,
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
  totalBorrowed,
  totalOwed,
  type Estate,
  type TradeRefusal,
} from '@yearafter/finance';
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
  investments: portfolioWorth(state.prices, state.portfolio),
  liabilities: dollars(
    Math.round(Number(totalOwed(state.cards)) / 100) +
      Math.round(Number(totalBorrowed(state.loans)) / 100),
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
