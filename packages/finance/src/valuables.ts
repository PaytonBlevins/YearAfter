/**
 * Ticket 0506 — owning jewelry, watches and collectibles.
 *
 * MEASURED FIRST: nobody owned anything of this kind; the Shopping and
 * Valuable Collections rows had said "not built yet" since 0108. Across the
 * two samples, half of everybody past forty-five held $100,000 or more in
 * cash and a few percent were worth a million — so there are people who can
 * buy a Rolux, and very few who can buy a painting that costs a house.
 *
 * WHAT A THING IS WORTH. `value` is what it would fetch, and it is the number
 * every screen, the estate and a sale read. Spec 1893: one general sale
 * button, so there is one price. The day it is bought it is worth `RESALE` of
 * what was paid — a fashion watch a third, a diamond about 60%, a Rolux on a
 * waiting list more than retail — and every year after it moves with `DRIFT`,
 * plus its kind's market (spec 199: "keep dynamic rarity/demand/value
 * movement backend") and some of its own.
 *
 * Spec 140: jewelry and watches "count as meaningful investment-style assets
 * only when sufficiently valuable/collectible". Here that is what `holds`
 * does: fashion pieces fall toward almost nothing, the rest hold or grow. All
 * of them count in net worth at what they would fetch, the same rule as cars.
 */

import { cents, dollars, mixedUnit, type Money } from '@yearafter/core';
import type { Valuable, ValuableHolds } from '@yearafter/content';
import { REPRODUCTION_SHARE } from './auctions';

export interface OwnedValuable {
  /** The stock id it was bought as: `val:<year>:<store>:<slot>`. Stable forever. */
  readonly id: string;
  readonly itemId: string;
  readonly boughtYear: number;
  readonly purchasePrice: Money;
  /** What it would fetch now. */
  readonly value: Money;
  /** Spec 1281: provenance persists across generations. Whose it was. */
  readonly inheritedFrom?: string;
  /**
   * Ticket 0507. Not what the catalog said — bought at a house whose word was
   * worth less than it looked. Hidden until an appraiser looks at it the next
   * year. Never shown.
   */
  readonly fake?: boolean;
  /** Ticket 0507. Found out: a reproduction, worth what reproductions are. */
  readonly reproduction?: boolean;
}

export const EMPTY_VALUABLES: readonly OwnedValuable[] = [];

/** What it would fetch the day it is bought, as a share of retail. */
export const RESALE: Readonly<Record<ValuableHolds, number>> = {
  fashion: 0.35,
  precious: 0.6,
  watch: 0.75,
  sought: 1.15,
  art: 0.7,
  antique: 0.75,
  curio: 0.5,
  mythical: 1,
};

/** Real drift a year, and how far a year can swing. */
export const DRIFT: Readonly<
  Record<ValuableHolds, { readonly mean: number; readonly spread: number }>
> = {
  fashion: { mean: -0.08, spread: 0.02 },
  precious: { mean: 0.005, spread: 0.08 },
  watch: { mean: 0.01, spread: 0.04 },
  sought: { mean: 0.02, spread: 0.07 },
  art: { mean: 0.02, spread: 0.18 },
  antique: { mean: 0.015, spread: 0.05 },
  curio: { mean: 0, spread: 0.12 },
  mythical: { mean: 0.03, spread: 0.05 },
};

/** A worn fashion piece never falls below this share of retail. */
export const FASHION_FLOOR = 0.1;

/** A standard normal draw from a stable key (Box–Muller). */
function normalFrom(key: string): number {
  const u1 = Math.max(1e-9, mixedUnit(`${key}:a`));
  const u2 = mixedUnit(`${key}:b`);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * One number a year for each kind of thing, the same for every life: the year
 * art is down, it is down for everybody (the same rule as the housing market).
 */
export const valuablesMarketIn = (holds: ValuableHolds, year: number): number =>
  Math.max(-2.5, Math.min(2.5, normalFrom(`valuables:${holds}:${year}`)));

/** What it would fetch the day it was bought, whole dollars. */
export const resaleAtPurchase = (valuable: Valuable, paid: number): number =>
  Math.round(paid * RESALE[valuable.holds]);

/**
 * A year of owning one. Half the swing is its kind's market, half its own —
 * one painting takes off while another in the same year doesn't.
 */
export function valuableYear(
  owned: OwnedValuable,
  valuable: Valuable,
  year: number,
  seed: string,
): OwnedValuable {
  // Ticket 0507: a fake is found out the first year an appraiser sees it.
  if (owned.fake) {
    const found: OwnedValuable = {
      ...owned,
      value: dollars(Math.max(1, Math.round((Number(owned.value) / 100) * REPRODUCTION_SHARE))),
      reproduction: true,
    };
    delete (found as { fake?: boolean }).fake;
    return found;
  }
  const drift = DRIFT[valuable.holds];
  const own = Math.max(-2.5, Math.min(2.5, normalFrom(`${seed}:${owned.id}:${year}`)));
  const swing =
    drift.mean + drift.spread * (0.6 * valuablesMarketIn(valuable.holds, year) + 0.8 * own);
  const before = Number(owned.value) / 100;
  const floor = valuable.holds === 'fashion' ? valuable.price * FASHION_FLOOR : 1;
  const value = Math.max(floor, Math.round(before * (1 + Math.max(-0.6, swing))));
  return { ...owned, value: dollars(value) };
}

export const valuablesValue = (valuables: readonly OwnedValuable[]): Money =>
  cents(valuables.reduce((sum, owned) => sum + Number(owned.value), 0));
