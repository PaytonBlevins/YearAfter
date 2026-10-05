/**
 * Ticket 0606 — letting property to businesses, as plain rules.
 *
 * A shop, a warehouse or an office is let on a lease of several years to a
 * business, not by the year to a household. What differs from `rental.ts`:
 *
 *   - the rent is fixed for the term and is reset only at renewal, so a
 *     falling market is cushioned for the landlord and a rising one is not
 *     shared;
 *   - a tenant leaves only when the lease ends (or fails), so a unit turns
 *     over every few years, but each turn costs a long empty or rent-free
 *     stretch;
 *   - a tenant is a business, and the economy that hurts a business hurts the
 *     rent it pays: more fail, fewer apply, and a re-let takes longer.
 *
 * PURE: no state and no randomness. Every roll is a unit in [0, 1) passed in
 * by `simulation/commercial.ts`, which owns the keys.
 */

import type { MarketState } from './investments';
import { rentLevelOf, reliabilityOf, type Tenant, type TenantTraits } from './rental';

/* -------------------------------------------------------------------------- */
/* The economy's hand on a building                                            */
/* -------------------------------------------------------------------------- */

/** How many more (or fewer) of a normal year's tenants fail, by the state of the economy. */
export const FAILURE_BY_MARKET: Readonly<Record<MarketState, number>> = {
  severeRecession: 3,
  recession: 2,
  slowdown: 1.3,
  normal: 1,
  growth: 0.8,
  strongExpansion: 0.6,
};

/** How long a unit stands empty or rent-free, against a normal year's. */
export const GAP_BY_MARKET: Readonly<Record<MarketState, number>> = {
  severeRecession: 2,
  recession: 1.5,
  slowdown: 1.2,
  normal: 1,
  growth: 0.85,
  strongExpansion: 0.7,
};

/** How many businesses answer a listing, against a normal year's. */
export const APPLICANTS_BY_MARKET: Readonly<Record<MarketState, number>> = {
  severeRecession: 0.4,
  recession: 0.6,
  slowdown: 0.85,
  normal: 1,
  growth: 1.15,
  strongExpansion: 1.3,
};

/** Applicants for one unit: the rent setting's, moved by the economy. At least one unless nobody would. */
export function commercialApplicantCount(level: number, market: MarketState): number {
  const base = rentLevelOf(level).applicants;
  if (base === 0) return 0;
  return Math.max(1, Math.round(base * APPLICANTS_BY_MARKET[market]));
}

/* -------------------------------------------------------------------------- */
/* Leases                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * At the end of a lease a business renews unless it chooses to go: a tenant
 * who has stayed a whole term is a little likelier to stay again than a
 * residential tenant is to stay another year, but moves a business takes are
 * bigger ones. 1.5× the rent table's yearly leave chance.
 */
export const COMMERCIAL_LEAVE_FACTOR = 1.5;

/** A year in which a business fails, at a normal economy and a typical tenant. Used to size the gap. */
export const TYPICAL_FAILURE = 0.04;

/** The longest a unit stands empty or rent-free after a new lease, in years. */
export const MAX_GAP = 1;

/** A lease's length, in whole years, from a unit in [0, 1). */
export function leaseLengthOf(range: readonly [number, number], u: number): number {
  const [low, high] = range;
  return Math.min(high, low + Math.floor(u * (high - low + 1)));
}

/** The chance a tenant who has reached the end of a lease does not renew. */
export const leaveAtLeaseEnd = (level: number): number =>
  Math.min(0.95, rentLevelOf(level).leave * COMMERCIAL_LEAVE_FACTOR);

/**
 * How much of its first year a new lease pays, the rest being fit-out and
 * empty weeks. Sized so that a kind's `vacancy` is what it comes to: a unit
 * turns over about every `1 / (leave / term + failure)` years and each turn
 * costs `gap`; the share empty is `gap·r / (1 + gap·r)`, which solved for `gap`
 * is `v / ((1 - v)·r)`.
 */
export function firstYearShare(
  vacancy: number,
  meanLease: number,
  market: MarketState,
  level = 1,
): number {
  const turnover = leaveAtLeaseEnd(level) / Math.max(1, meanLease) + TYPICAL_FAILURE;
  const gap = (vacancy / Math.max(0.01, 1 - vacancy) / turnover) * GAP_BY_MARKET[market];
  return 1 - Math.min(MAX_GAP, gap);
}

/* -------------------------------------------------------------------------- */
/* Tenants                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A business that would take a unit, from five stable units. Its revenue runs
 * from about six to fourteen times the rent (rent is a tenth of takings for
 * most trades), its staff follow its revenue, and a young business is the
 * risky one. `evictions` is the leases it has already walked away from.
 */
export function commercialTraits(
  rentYear: number,
  units: readonly [number, number, number, number, number],
): TenantTraits {
  const [u1, u2, u3, u4, u5] = units;
  const income = Math.round((rentYear * (6 + 8 * u1)) / 1000) * 1000;
  const credit = u2 < 0.5 ? 'good' : u2 < 0.82 ? 'fair' : 'poor';
  const work = u3 < 0.72 ? 'steady' : 'new';
  const household = Math.max(1, Math.round((income / 90_000) * (0.7 + 0.6 * u4)));
  const evictions =
    credit === 'poor' ? (u5 < 0.2 ? 1 : 0) : credit === 'fair' ? (u5 < 0.04 ? 1 : 0) : 0;
  return { income, credit, work, household, evictions };
}

/** The chance a business pays its whole year, in this economy. Hidden. */
export function commercialReliability(
  tenant: TenantTraits,
  rentYear: number,
  market: MarketState,
): number {
  const fail = (1 - reliabilityOf(tenant, rentYear)) * FAILURE_BY_MARKET[market];
  return Math.max(0.4, Math.min(0.995, 1 - fail));
}

/* -------------------------------------------------------------------------- */
/* A year                                                                      */
/* -------------------------------------------------------------------------- */

export type CommercialOutcome = 'stayed' | 'renewed' | 'left' | 'failed' | 'empty';

export interface CommercialUnitYear {
  readonly outcome: CommercialOutcome;
  /** Whole dollars collected from this unit this year. */
  readonly collected: number;
}

/** A tenant who stops paying has paid about half the year, as in `rental.ts`. */
export const PAID_BEFORE_FAILING = 0.5;

/**
 * One unit's year. The rent is the lease's own (`tenant.rent`) until renewal;
 * the first year of a lease pays `firstShare` of it.
 */
export function commercialUnitYear(input: {
  readonly tenant: Tenant | null;
  readonly year: number;
  /** What the unit would let for today: the rent a renewal is reset to. */
  readonly rentYear: number;
  readonly level: number;
  readonly firstShare: number;
  readonly market: MarketState;
  readonly payRoll: number;
  readonly renewRoll: number;
}): CommercialUnitYear {
  const { tenant } = input;
  if (!tenant) return { outcome: 'empty', collected: 0 };
  const rent = tenant.rent ?? input.rentYear;
  const share = tenant.since >= input.year ? Math.max(0, input.firstShare) : 1;
  const due = rent * share;
  if (input.payRoll >= commercialReliability(tenant, rent, input.market)) {
    return { outcome: 'failed', collected: Math.round(due * PAID_BEFORE_FAILING) };
  }
  const ends = (tenant.leaseEnds ?? input.year) <= input.year;
  if (!ends) return { outcome: 'stayed', collected: Math.round(due) };
  return {
    outcome: input.renewRoll < leaveAtLeaseEnd(input.level) ? 'left' : 'renewed',
    collected: Math.round(due),
  };
}
