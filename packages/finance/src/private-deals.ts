/**
 * Ticket 0605 — private deals: the contract.
 *
 * The contract commit fixed the types; the engine commit (this one) fills in
 * the bodies. The only change to the contract: `placeDeal` takes the seed (an
 * outcome keyed on the offer alone would repeat across lives), and `DealYear`
 * returns a `note` that `@yearafter/content`'s `deal-lines.ts` words.
 *
 * What a deal is: a cheque written once, money away until a fixed year, an
 * outcome fixed at the moment of writing (so a reload cannot reroll it), and a
 * yearly mark that says nothing about the outcome until the last years. The
 * outcome is drawn from the kind's table in `@yearafter/content`.
 */

import { cents, err, mixedUnit, ok, type Money, type Result } from '@yearafter/core';
import {
  DEAL_NAMES,
  findDealKind,
  type DealKind,
  type DealKindId,
  type DealNote,
} from '@yearafter/content';
import type { MarketState } from './investments';

/** The most deals one person can hold at once; capacity is also a limit on attention. */
export const MAX_DEALS = 8;
/** The chance a slot brings an offer, before the economy tilts it. */
export const OFFER_CHANCE = 0.5;
/** The most offers shown in a year. Spec 1233: no bombardment. */
export const MAX_OFFERS = 2;
/** What a sale on to another investor costs, as a share of the carrying value. */
export const SECONDARY_DISCOUNT = 0.35;
/** Years before a deal that can be sold on may be. */
export const SELL_FROM_YEARS = 1;
/** The most of liquid money one cheque may be. */
export const MAX_SHARE_OF_LIQUID = 0.5;
/** Cheques are written in multiples of this, whole dollars. */
export const CHEQUE_STEP = 500;
/** Adults only (spec 912's age). */
export const DEALS_FROM_AGE = 18;

/** How the economy tilts how often a deal is offered. Spec 1222: moderate. */
const OFFER_TILT: Readonly<Record<MarketState, number>> = {
  severeRecession: 0.4,
  recession: 0.6,
  slowdown: 0.85,
  normal: 1,
  growth: 1.1,
  strongExpansion: 1.2,
};

/** How the economy at the end scales what a winning deal made (the gain only). */
const GAIN_TILT: Readonly<Record<MarketState, number>> = {
  severeRecession: 0.7,
  recession: 0.85,
  slowdown: 0.95,
  normal: 1,
  growth: 1.05,
  strongExpansion: 1.15,
};

export type DealStatus = 'live' | 'settled' | 'lost';

/** A deal the character holds. Money in cents, years as calendar years. */
export interface PrivateDeal {
  /** The id of the offer it came from: unique, and never offered again. */
  readonly id: string;
  readonly kindId: string;
  /** What the deal is called, drawn from the names table. */
  readonly name: string;
  /** The cheque. */
  readonly put: Money;
  readonly since: number;
  /** The year the money comes back or is lost. */
  readonly matures: number;
  /** What comes back per dollar put in. Fixed at the start; the screen must never show it early. */
  readonly multiple: number;
  /** What a lender-type deal has paid out so far; 0 for the others. */
  readonly paid: Money;
  readonly status: DealStatus;
}

/** What the screen is shown: a deal that could be made this year. Derived, never saved. */
export interface DealOffer {
  readonly id: string;
  readonly kindId: string;
  readonly name: string;
  /** Whole dollars. The whole round. */
  readonly round: number;
  /** Whole dollars. */
  readonly minTicket: number;
  /** Whole dollars. The most this person can write: capacity, a share of the round, and of their money. */
  readonly maxTicket: number;
  readonly lockYears: number;
}

export type DealRefusal =
  | { readonly kind: 'notOffered' }
  | { readonly kind: 'belowMinimum'; readonly minimum: number }
  | { readonly kind: 'aboveMaximum'; readonly maximum: number }
  | { readonly kind: 'notEnoughMoney'; readonly liquid: number }
  | { readonly kind: 'tooManyDeals'; readonly limit: number }
  | { readonly kind: 'notBuilt' }
  | { readonly kind: 'cannotSellYet'; readonly year: number }
  | { readonly kind: 'cannotSellThis' };

export const EMPTY_DEALS: readonly PrivateDeal[] = [];

/** What one year did to one deal. */
export interface DealYear {
  readonly deal: PrivateDeal;
  /** Interest paid in the year, cents. A lender's only. */
  readonly interest: Money;
  /** The money back at the end, cents; 0 unless it ended this year. */
  readonly returned: Money;
  /** What happened, for `@yearafter/content`'s `dealLine`; undefined for a quiet year. */
  readonly note?: DealNote;
}

const kindOf = (deal: PrivateDeal): DealKind | undefined => findDealKind(deal.kindId);

/** What the screen shows as a deal's worth: the cheque while it lives, nothing after. */
export const carryingValue = (deal: PrivateDeal): Money =>
  deal.status === 'live' ? deal.put : cents(0);

export const dealsValue = (deals: readonly PrivateDeal[]): number =>
  deals.reduce((sum, deal) => sum + Number(carryingValue(deal)), 0);

export const liveDeals = (deals: readonly PrivateDeal[]): readonly PrivateDeal[] =>
  deals.filter((deal) => deal.status === 'live');

const between = (range: readonly [number, number], unit: number): number =>
  range[0] + unit * (range[1] - range[0]);

/** The year a loan that will not be repaid stops paying. */
export const defaultYearOf = (deal: PrivateDeal): number =>
  deal.since + Math.max(1, Math.ceil((deal.matures - deal.since) / 2));

/**
 * Offers for this person this year. DERIVED from the seed, the year and the
 * slot, so the same year shows the same deals and a reload cannot reroll them.
 * Which KIND a slot brings does not depend on money (only whether it is shown
 * does), or paying for one deal would change what the other slot is.
 */
export function dealOffersFor(input: {
  readonly seed: string;
  readonly year: number;
  readonly age: number;
  readonly liquid: number;
  readonly market: MarketState;
  readonly held: readonly PrivateDeal[];
  readonly kinds: readonly DealKind[];
}): readonly DealOffer[] {
  if (input.age < DEALS_FROM_AGE || input.kinds.length === 0) return [];
  if (liveDeals(input.held).length >= MAX_DEALS) return [];
  const chance = Math.min(0.95, OFFER_CHANCE * OFFER_TILT[input.market]);
  const offers: DealOffer[] = [];
  for (let slot = 0; slot < MAX_OFFERS; slot += 1) {
    const key = `${input.seed}:deal:${input.year}:${slot}`;
    if (mixedUnit(`${key}:happens`) >= chance) continue;
    const kind =
      input.kinds[
        Math.min(
          input.kinds.length - 1,
          Math.floor(mixedUnit(`${key}:kind`) ** 1.4 * input.kinds.length),
        )
      ]!;
    if (input.liquid < kind.gate) continue;
    const id = `deal:${input.year}:${slot}`;
    if (input.held.some((deal) => deal.id === id)) continue;
    // Log-scaled between the smallest and largest round.
    const multiple = Math.exp(
      between(
        [Math.log(kind.roundMultiple[0]), Math.log(kind.roundMultiple[1])],
        mixedUnit(`${key}:round`),
      ),
    );
    const round = Math.round((kind.minTicket * multiple) / CHEQUE_STEP) * CHEQUE_STEP;
    const capacity = Math.min(round * kind.maxShareOfRound, input.liquid * MAX_SHARE_OF_LIQUID);
    const maxTicket = Math.floor(capacity / CHEQUE_STEP) * CHEQUE_STEP;
    // No guard that the cap reaches the minimum: the catalog guarantees it (the gate is three
    // cheques, half of which is 1.5; every round's share is at least twice the minimum), and a
    // test asserts those two facts so a catalog edit that breaks them fails there, not silently here.
    const names = DEAL_NAMES[kind.id as DealKindId];
    offers.push({
      id,
      kindId: kind.id,
      name: names[Math.floor(mixedUnit(`${key}:name`) * names.length) % names.length]!,
      round,
      minTicket: kind.minTicket,
      maxTicket,
      lockYears:
        kind.lockYears[0] +
        Math.floor(mixedUnit(`${key}:lock`) * (kind.lockYears[1] - kind.lockYears[0] + 1)),
    });
  }
  return offers;
}

/** Turn an offer and a cheque into a held deal. The outcome is drawn here, once. */
export function placeDeal(input: {
  readonly offer: DealOffer;
  readonly amount: number;
  readonly liquid: number;
  readonly held: readonly PrivateDeal[];
  readonly year: number;
  readonly seed: string;
}): Result<PrivateDeal, DealRefusal> {
  const { offer, amount } = input;
  const kind = findDealKind(offer.kindId);
  if (!kind || input.held.some((deal) => deal.id === offer.id)) return err({ kind: 'notOffered' });
  if (liveDeals(input.held).length >= MAX_DEALS)
    return err({ kind: 'tooManyDeals', limit: MAX_DEALS });
  if (!Number.isFinite(amount) || amount < offer.minTicket) {
    return err({ kind: 'belowMinimum', minimum: offer.minTicket });
  }
  if (amount > input.liquid) return err({ kind: 'notEnoughMoney', liquid: input.liquid });
  if (amount > offer.maxTicket) return err({ kind: 'aboveMaximum', maximum: offer.maxTicket });

  const key = `${input.seed}:${offer.id}`;
  const total = kind.outcomes.reduce((sum, row) => sum + row.weight, 0);
  let cursor = mixedUnit(`${key}:outcome`) * total;
  let chosen = kind.outcomes[kind.outcomes.length - 1]!;
  for (const row of kind.outcomes) {
    cursor -= row.weight;
    if (cursor < 0) {
      chosen = row;
      break;
    }
  }
  const multiple = Math.round(between(chosen.multiple, mixedUnit(`${key}:multiple`)) * 100) / 100;
  return ok({
    id: offer.id,
    kindId: offer.kindId,
    name: offer.name,
    put: cents(Math.round(amount * 100)),
    since: input.year,
    matures: input.year + offer.lockYears,
    multiple,
    paid: cents(0),
    status: 'live',
  });
}

const QUIET = (deal: PrivateDeal): DealYear => ({ deal, interest: cents(0), returned: cents(0) });

/** A year of one deal: interest, a settlement, a write-off, or nothing. `year` is the year that is ending. */
export function dealYear(deal: PrivateDeal, year: number, market: MarketState): DealYear {
  const kind = kindOf(deal);
  if (deal.status !== 'live' || !kind || year <= deal.since) return QUIET(deal);
  const lends = kind.yearlyYield > 0;

  // A loan that will not be repaid stops paying, and ends, at its default year.
  if (lends && deal.multiple < 1 && year >= defaultYearOf(deal)) {
    const back = cents(Math.round(Number(deal.put) * deal.multiple));
    return {
      deal: { ...deal, status: 'lost' },
      interest: cents(0),
      returned: back,
      note: 'defaulted',
    };
  }

  if (year >= deal.matures) {
    const gain = lends ? 1 : GAIN_TILT[market];
    const m = deal.multiple > 1 ? 1 + (deal.multiple - 1) * gain : deal.multiple;
    const back = cents(Math.round(Number(deal.put) * m));
    const status = deal.multiple < 1 ? 'lost' : 'settled';
    const note: DealNote = lends
      ? 'repaid'
      : deal.multiple === 0
        ? 'lost'
        : deal.multiple < 1
          ? 'settledDown'
          : 'settledUp';
    return { deal: { ...deal, status }, interest: cents(0), returned: back, note };
  }

  if (lends) {
    const interest = cents(Math.round(Number(deal.put) * kind.yearlyYield));
    return {
      deal: { ...deal, paid: cents(Number(deal.paid) + Number(interest)) },
      interest,
      returned: cents(0),
      ...(year === deal.since + 1 ? { note: 'interest' as const } : {}),
    };
  }
  // The year before a bad end, the word gets out. Not before: the yearly mark says nothing.
  if (deal.multiple < 1 && year === deal.matures - 1) {
    return { ...QUIET(deal), note: 'shaky' };
  }
  return QUIET(deal);
}

/**
 * What a sale on to another investor would fetch, cents.
 *
 * A buyer sees what the player can see: once word has got out that a deal is
 * going badly (the last year before it ends) they price it at what it will
 * return, not at the cheque. Without this, selling after the warning would
 * beat the loss every time, and the warning would be a free exit.
 */
export function secondaryOffer(deal: PrivateDeal, year: number): Result<Money, DealRefusal> {
  const kind = kindOf(deal);
  if (!kind || deal.status !== 'live') return err({ kind: 'notOffered' });
  if (!kind.canSellEarly) return err({ kind: 'cannotSellThis' });
  const from = deal.since + SELL_FROM_YEARS;
  if (year < from) return err({ kind: 'cannotSellYet', year: from });
  const known = deal.multiple < 1 && year >= deal.matures - 1 ? deal.multiple : 1;
  return ok(cents(Math.round(Number(deal.put) * known * (1 - SECONDARY_DISCOUNT))));
}

/**
 * What the estate gets for a deal at a death, cents: sold on to another
 * investor at the usual discount WHATEVER the kind, because an heir cannot sit
 * out ten years in a fund. Priced the same way a buyer prices a sale, so a
 * deal that already looks bad fetches what it will return.
 */
export function estateSaleOf(deal: PrivateDeal, year: number): Money {
  if (deal.status !== 'live') return cents(0);
  const known = deal.multiple < 1 && year >= deal.matures - 1 ? deal.multiple : 1;
  return cents(Math.round(Number(deal.put) * known * (1 - SECONDARY_DISCOUNT)));
}
