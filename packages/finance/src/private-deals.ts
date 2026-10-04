/**
 * Ticket 0605 — private deals: the contract.
 *
 * THIS FILE IS THE CONTRACT COMMIT. Types, constants and signatures are final
 * for Agent B to code screens against; bodies marked STUB are filled in by the
 * engine commit that follows. Nothing here may change shape without telling
 * the other agent in the PR.
 *
 * What a deal is: a cheque written once, money away until a fixed year, an
 * outcome fixed at the moment of writing (so a reload cannot reroll it), and a
 * yearly mark that says nothing about the outcome until the last years. The
 * outcome is drawn from the kind's table in `@yearafter/content`.
 */

import type { Money, Result } from '@yearafter/core';
import { err } from '@yearafter/core';
import type { DealKind } from '@yearafter/content';
import type { MarketState } from './investments';

/** The most deals one person can hold at once; capacity is also a limit on attention. */
export const MAX_DEALS = 8;
/** The chance a year brings any offer at all, before wealth and the economy tilt it. */
export const OFFER_CHANCE = 0.5;
/** The most offers shown in a year. Spec 1233: no bombardment. */
export const MAX_OFFERS = 2;
/** What a sale on to another investor costs, as a share of the carrying value. */
export const SECONDARY_DISCOUNT = 0.35;
/** Years before a deal that can be sold on may be. */
export const SELL_FROM_YEARS = 1;
/** The most of liquid money one cheque may be. */
export const MAX_SHARE_OF_LIQUID = 0.5;

export type DealStatus = 'live' | 'settled' | 'lost';

/** A deal the character holds. Money in cents, years as calendar years. */
export interface PrivateDeal {
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
  /** Paid out in the year, cents: a lender's interest, or the end of a deal. */
  readonly paid: Money;
  /** The money back at the end, cents (part of `paid`); 0 unless it settled this year. */
  readonly returned: Money;
  /** A line for the timeline, or undefined for a quiet year. */
  readonly line?: string;
}

/** What the screen shows as a deal's worth: the cheque, until it settles or is written off. */
export function carryingValue(_deal: PrivateDeal): Money {
  // STUB (contract commit): the engine commit fills this in.
  return _deal.put;
}

export const dealsValue = (deals: readonly PrivateDeal[]): number =>
  deals.reduce((sum, deal) => sum + (deal.status === 'live' ? Number(carryingValue(deal)) : 0), 0);

/** Offers for this person this year. Derived from the seed, so the same year shows the same deals. */
export function dealOffersFor(_input: {
  readonly seed: string;
  readonly year: number;
  readonly age: number;
  readonly liquid: number;
  readonly market: MarketState;
  readonly held: readonly PrivateDeal[];
  readonly kinds: readonly DealKind[];
}): readonly DealOffer[] {
  // STUB (contract commit).
  return [];
}

/** Turn an offer and a cheque into a held deal. */
export function placeDeal(_input: {
  readonly offer: DealOffer;
  readonly amount: number;
  readonly liquid: number;
  readonly held: readonly PrivateDeal[];
  readonly year: number;
}): Result<PrivateDeal, DealRefusal> {
  // STUB (contract commit).
  return err({ kind: 'notBuilt' });
}

/** A year of one deal: interest, a settlement, a write-off, or nothing. */
export function dealYear(deal: PrivateDeal, _year: number, _market: MarketState): DealYear {
  // STUB (contract commit).
  return { deal, paid: 0 as Money, returned: 0 as Money };
}

/** What a sale on to another investor would fetch, cents. */
export function secondaryOffer(_deal: PrivateDeal, _year: number): Result<Money, DealRefusal> {
  // STUB (contract commit).
  return err({ kind: 'notBuilt' });
}
