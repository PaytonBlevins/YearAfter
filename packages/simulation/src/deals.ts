/**
 * Ticket 0605 — private deals on the character.
 *
 * Offers are DERIVED from the seed and the year, so nothing about them is
 * saved; only deals made are. The cheque is an `investment` row (a transfer:
 * the money has not been spent, spec 44–46), a settlement's principal comes
 * back across the same line, and what a deal EARNED (interest, the gain on a
 * win) is `assetIncome`, taxed through the same progressive rate as a wage.
 * A loss is just the cheque not coming back: net worth already carried the deal
 * at the cheque, so it falls by the unrecovered part when the deal ends.
 */

import {
  payPurchase,
  paymentNote,
  type PurchasePayment,
  type PaymentProblem,
} from '@yearafter/finance';

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import { DEAL_KINDS, dealLine } from '@yearafter/content';
import { dollars, err, ok, stablePick, type Result } from '@yearafter/core';
import { taxRate } from '@yearafter/careers';
import {
  dealOffersFor,
  dealYear,
  liveDeals,
  placeDeal,
  post,
  secondaryOffer,
  type DealOffer,
  type DealRefusal,
  type MarketState,
  type NewTransaction,
  type PrivateDeal,
} from '@yearafter/finance';
import type { GameState } from './game-state';
import { liquidOf } from './businesses';

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const dollarsOf = (cents: number) => Math.round(cents / 100);

/** The deals this person could make this year. */
export function dealMarket(state: GameState): readonly DealOffer[] {
  return dealOffersFor({
    seed: state.rng.getSeed(),
    year: state.world.year,
    age: state.player.age,
    liquid: liquidOf(state),
    market: state.market,
    held: state.deals,
    kinds: DEAL_KINDS,
  });
}

function wording(
  note: Parameters<typeof dealLine>[0],
  deal: PrivateDeal,
  tokens: Readonly<Record<string, string>>,
  key: string,
): string {
  return dealLine(
    note,
    key,
    { name: deal.name, put: money(dollarsOf(Number(deal.put))), ...tokens },
    (lines, k) => stablePick(lines, k) ?? lines[0] ?? '',
  );
}

function entryFor(state: GameState, text: string, key: string): TimelineEntry {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'milestone',
    text,
    id: `t:${state.world.year}:${key}`,
    sequence,
  });
}

/** Write a cheque with cash or a selected card; the deal is held until it matures. */
export function placeInDeal(
  state: GameState,
  offerId: string,
  amount: number,
  payment: PurchasePayment = { kind: 'cash' },
): Result<GameState, DealRefusal | PaymentProblem> {
  const offer = dealMarket(state).find((row) => row.id === offerId);
  if (!offer) return err({ kind: 'notOffered' });
  const cash = Math.floor(Number(state.player.cash) / 100);
  const made = placeDeal({
    offer,
    amount,
    liquid: payment.kind === 'cash' ? cash : Number.POSITIVE_INFINITY,
    held: state.deals,
    year: state.world.year,
    seed: state.rng.getSeed(),
  });
  if (!made.ok) return err(made.error);
  const deal = made.value;
  const paid = payPurchase(
    state.finance,
    state.cards,
    state.world.year,
    state.player.age,
    dollars(amount),
    'investment',
    `Private deal — ${deal.name}`,
    payment,
  );
  if (!paid.ok) return err({ kind: 'payment', reason: paid.error });
  const books = paid.value;
  const entry = entryFor(
    state,
    wording('placed', deal, { years: String(offer.lockYears) }, `deal:placed:${deal.id}`) +
      paymentNote(payment),
    `deal:placed:${deal.id}`,
  );
  return ok({
    ...state,
    finance: books.ledger,
    cards: books.cards,
    deals: [...state.deals, deal],
    player: {
      ...state.player,
      cash: books.ledger.balance,
      timeline: appendToTimeline(state.player.timeline, entry),
    },
  });
}

/** Sell a deal on before it matures, at a discount, where its kind allows. */
export function sellDealEarly(state: GameState, dealId: string): Result<GameState, DealRefusal> {
  const deal = state.deals.find((row) => row.id === dealId);
  if (!deal) return err({ kind: 'notOffered' });
  const price = secondaryOffer(deal, state.world.year);
  if (!price.ok) return err(price.error);
  const back = Number(price.value);
  const books = post(state.finance, state.world.year, state.player.age, {
    category: 'investment',
    amount: price.value,
    source: `Sold on — ${deal.name}`,
  });
  const entry = entryFor(
    state,
    wording('soldOn', deal, { back: money(dollarsOf(back)) }, `deal:sold:${deal.id}`),
    `deal:sold:${deal.id}`,
  );
  return ok({
    ...state,
    finance: books.ledger,
    deals: state.deals.map((row) =>
      row.id === deal.id ? { ...row, status: 'settled' as const } : row,
    ),
    player: {
      ...state.player,
      cash: books.ledger.balance,
      timeline: appendToTimeline(state.player.timeline, entry),
    },
  });
}

/**
 * The extra tax what deals earned in a year costs on top of a wage, whole
 * dollars: the same progressive rate everything else is taxed at, so a windfall
 * is taxed as one rather than as a flat slice.
 */
export function dealTaxOn(otherIncome: number, earned: number): number {
  if (earned <= 0) return 0;
  const whole = otherIncome + earned;
  return Math.max(0, Math.round(taxRate(whole) * whole - taxRate(otherIncome) * otherIncome));
}

export interface DealsYear {
  readonly deals: readonly PrivateDeal[];
  readonly transactions: readonly NewTransaction[];
  readonly lines: readonly string[];
  /** Whole dollars earned (interest and gains), before tax. */
  readonly earned: number;
}

/** A year of every deal held. `year` is the year that is beginning. */
export function runDealsYear(input: {
  readonly deals: readonly PrivateDeal[];
  readonly year: number;
  readonly market: MarketState;
  readonly otherIncome: number;
}): DealsYear {
  const transactions: NewTransaction[] = [];
  const lines: string[] = [];
  let earned = 0;
  const deals = input.deals.map((deal) => {
    if (deal.status !== 'live') return deal;
    const result = dealYear(deal, input.year, input.market);
    const interest = dollarsOf(Number(result.interest));
    const back = dollarsOf(Number(result.returned));
    const put = dollarsOf(Number(deal.put));
    if (interest > 0) {
      earned += interest;
      transactions.push({
        category: 'assetIncome',
        amount: dollars(interest),
        source: `Interest — ${deal.name}`,
      });
    }
    if (back > 0 || result.deal.status !== 'live') {
      const principal = Math.min(back, put);
      const gain = Math.max(0, back - put);
      if (principal > 0) {
        transactions.push({
          category: 'investment',
          amount: dollars(principal),
          source: `Returned — ${deal.name}`,
        });
      }
      if (gain > 0) {
        earned += gain;
        transactions.push({
          category: 'assetIncome',
          amount: dollars(gain),
          source: `Gain — ${deal.name}`,
        });
      }
    }
    if (result.note) {
      lines.push(
        wording(
          result.note,
          deal,
          { back: money(back), gain: money(Math.max(0, back - put)) },
          `deal:${deal.id}:${result.note}:${input.year}`,
        ),
      );
    }
    return result.deal;
  });
  const tax = dealTaxOn(input.otherIncome, earned);
  if (tax > 0) {
    transactions.push({ category: 'tax', amount: dollars(-tax), source: 'Tax on deal income' });
  }
  return { deals, transactions, lines, earned };
}

/** What every live deal is worth to a net-worth line, cents (the cheque). */
export const heldInDeals = (state: GameState): number =>
  liveDeals(state.deals).reduce((sum, deal) => sum + Number(deal.put), 0);
