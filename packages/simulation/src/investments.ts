/**
 * Ticket 0308 — what a player can DO with a portfolio.
 *
 *   BUY    how much, into which of the four classes.
 *   SELL   part or all, whenever they want it back as cash.
 *   HOLD   the default, and the one that costs nothing to choose.
 *
 * Spec 1691's three verbs exactly. "Hold" is not a button — it is what happens
 * when the player does nothing, which is the correct shape for it: a verb whose
 * meaning is "leave it alone" should not need pressing, and a screen that made
 * you confirm inaction every year would be spec 1126-1136's chore by another
 * name.
 *
 * NOTHING HERE AUTO-LIQUIDATES. When cash runs short `advanceYear` draws on a
 * credit card — it does not reach into the portfolio — and selling to cover a
 * year is a thing the PLAYER does.
 *
 * That is the right shape, but it is worth being precise about why, because the
 * first version of this comment claimed it created a liquidity trap and the
 * measurement said otherwise: across 800 lives, including strategies holding
 * zero cash by construction, shortfall years came out at 0% and card-debt years
 * at 0%. Running out of cash in this build costs nothing, because the year's
 * income is posted before the year's costs are paid (CORE_RULES 13.52).
 *
 * So automatic liquidation is refused on the grounds that a portfolio is not an
 * overdraft and selling is a decision — NOT on the grounds that it punishes
 * anybody today. When something in this build finally needs money by a date,
 * this is already the right way round.
 */

import { dollars, err, ok, type Result } from '@yearafter/core';
import {
  INVESTMENT_PRODUCTS,
  buyInto,
  canBuy,
  findInvestment,
  holdingValue,
  sellFrom,
  totalBorrowed,
  totalOwed,
  type Estate,
  type InvestRefusal,
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
  investments: holdingValue(state.portfolio),
  liabilities: dollars(
    Math.round(Number(totalOwed(state.cards)) / 100) +
      Math.round(Number(totalBorrowed(state.loans)) / 100),
  ),
});

export type InvestError = InvestRefusal | 'nothingHeld';

export interface InvestOutcome {
  readonly state: GameState;
  readonly title: string;
  readonly body: string;
  readonly good: boolean;
}

/** Buy into a product, opening the position if they do not hold it yet. */
export function invest(
  state: GameState,
  productId: string,
  amount: number,
): Result<InvestOutcome, InvestError> {
  const product = findInvestment(productId);
  if (!product) return err('noSuchProduct');

  const cash = Math.round(Number(state.player.cash) / 100);
  const wanted = Math.round(amount);
  const refusal = canBuy(state.portfolio, product, wanted, cash);
  if (refusal) return err(refusal);

  /*
    A NEGATIVE `investment` ROW, and the category matters more than usual here.

    Spec 44-46 says investments are not outflow — but the money genuinely
    leaves the bank account, so the row has to exist or 0302's reconciliation
    breaks. The rule is honoured one layer up, in `summariseFinances`, which
    takes `investment` rows out of the outflow figure and adds the portfolio
    back into net worth. Posting this as `spending` would be the easy mistake
    and would tell the player their cost of living had tripled.
  */
  const moved = moveMoney(state, {
    category: 'investment',
    amount: dollars(-wanted),
    source: `${product.name} — bought`,
  });

  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      portfolio: buyInto(state.portfolio, product.id, wanted),
    },
    title: 'Bought',
    body: `${money(wanted)} into ${product.name}. ${product.character}`,
    good: true,
  });
}

/** Sell part or all of a holding back to cash. */
export function divest(
  state: GameState,
  productId: string,
  amount: number,
): Result<InvestOutcome, InvestError> {
  const product = findInvestment(productId);
  if (!product) return err('noSuchProduct');
  if (!state.portfolio.some((holding) => holding.productId === productId)) {
    return err('nothingHeld');
  }

  const sale = sellFrom(state.portfolio, productId, amount);
  if (sale.raised <= 0) return err('nothingHeld');

  const moved = moveMoney(state, {
    category: 'investment',
    amount: dollars(sale.raised),
    source: `${product.name} — sold`,
  });

  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      portfolio: sale.holdings,
    },
    title: 'Sold',
    body:
      sale.realized === 0
        ? `${money(sale.raised)} back in the bank, for what you put in.`
        : sale.realized > 0
          ? `${money(sale.raised)} back in the bank — ${money(sale.realized)} more than you put in.`
          : `${money(sale.raised)} back in the bank, ${money(-sale.realized)} less than you put in.`,
    good: sale.realized >= 0,
  });
}

/** What the screen offers, with the reason attached to anything it cannot. */
export const investmentOffers = (state: GameState) => {
  const cash = Math.round(Number(state.player.cash) / 100);
  return INVESTMENT_PRODUCTS.map((product) => ({
    product,
    // Priced against the MINIMUM rather than against what they typed, because
    // the row has to say yes or no before a number exists.
    refusal: canBuy(state.portfolio, product, Math.min(product.minimum, cash), cash),
  }));
};

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;
