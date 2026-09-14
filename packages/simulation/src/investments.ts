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
