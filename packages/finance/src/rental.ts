/**
 * Ticket 0503 — letting property, as plain rules.
 *
 * Spec 145 (duplexes hold two renters, apartment complexes 5, 10 or 25), 157
 * (tenant screening shows concrete indicators and no risk score), 160 (leases
 * renew on their own; the player may raise or lower the rent) and 954–978:
 * "Real estate returns derive from rent, mortgage, expense, appreciation, and
 * vacancy. Very high rent reduces applicants; low rent trades profit for
 * occupancy."
 *
 * PURE: no state and no randomness. Every roll is passed in as a unit in
 * [0, 1) by `simulation/rentals.ts`, which owns the keys.
 */

import type { Money } from '@yearafter/core';

/* -------------------------------------------------------------------------- */
/* Rent                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Where the rent is set against the going rate, and what each setting does.
 *
 * SIX STEPS, NOT A SLIDER. A player asked to type a rent is being handed a
 * spreadsheet (0501's down-payment argument); a landlord thinks "a bit under,
 * the going rate, a bit over". The table is tuned so the going rate is about
 * the best a landlord can do over time: one step above earns a little less,
 * because the units take longer to fill and tenants leave sooner; two steps
 * above earns much less; at the top nobody applies. Below it, the units are
 * always full and the money is simply lower (spec 954–978).
 *
 * `applicants`  how many people answer the listing for one empty unit.
 * `leave`       the chance a sitting tenant moves on at the end of a year. The
 *               US median tenancy is two to three years: about 0.28 a year.
 * `gap`         the share of a year a unit stands empty between tenants.
 */
export interface RentLevel {
  readonly level: number;
  readonly label: string;
  readonly applicants: number;
  readonly leave: number;
  readonly gap: number;
}

export const RENT_LEVELS: readonly RentLevel[] = [
  { level: 0.8, label: '20% under the going rate', applicants: 5, leave: 0.15, gap: 0.05 },
  { level: 0.9, label: '10% under the going rate', applicants: 4, leave: 0.21, gap: 0.08 },
  { level: 1, label: 'The going rate', applicants: 3, leave: 0.28, gap: 0.12 },
  { level: 1.1, label: '10% over the going rate', applicants: 2, leave: 0.55, gap: 0.3 },
  { level: 1.2, label: '20% over the going rate', applicants: 1, leave: 0.78, gap: 0.6 },
  { level: 1.3, label: '30% over the going rate', applicants: 0, leave: 1, gap: 1 },
];

export const GOING_RATE = 1;

export const rentLevelOf = (level: number): RentLevel =>
  RENT_LEVELS.reduce((best, candidate) =>
    Math.abs(candidate.level - level) < Math.abs(best.level - level) ? candidate : best,
  );

/** One step up or down the table, or the same step at either end. */
export function stepRent(level: number, direction: 1 | -1): number {
  const index = RENT_LEVELS.indexOf(rentLevelOf(level));
  const next = Math.max(0, Math.min(RENT_LEVELS.length - 1, index + direction));
  return (RENT_LEVELS[next] as RentLevel).level;
}

/**
 * The going rate for one unit, whole dollars a year.
 *
 * The kind's yield at cost index 1.00, over the region's index: rent follows
 * a place's cost of living roughly in step while prices follow it squared
 * (`PRICE_ELASTICITY`), so the yield is lower where houses are dear. Off the
 * home's CURRENT value, so rents move with the market.
 */
/**
 * How much less a dear region yields. Rent rises with a place's cost of living
 * a little faster than one-for-one, prices with its square, so the yield falls
 * as the index to this power — enough that a California duplex barely pays and
 * an Ohio one does, without the cheapest states yielding like a payday loan.
 */
/** P14 approved policy: residential rentals need room for costs and early debt service. */
export const RESIDENTIAL_RENT_FACTOR = 1.15;
export const rentYieldFor = (kind: {
  readonly rentYield: number;
  readonly commercial: boolean;
}): number => kind.rentYield * (kind.commercial ? 1 : RESIDENTIAL_RENT_FACTOR);

export const YIELD_ELASTICITY = 0.7;

export function goingRentOf(
  value: Money,
  rentYield: number,
  regionIndex: number,
  units: number,
): number {
  const yearly =
    ((Number(value) / 100) * rentYield) / Math.max(0.5, regionIndex) ** YIELD_ELASTICITY;
  return Math.round(yearly / Math.max(1, units) / 12) * 12;
}

/* -------------------------------------------------------------------------- */
/* Tenants                                                                     */
/* -------------------------------------------------------------------------- */

export type CreditQuality = 'good' | 'fair' | 'poor';
export type WorkHistory = 'steady' | 'new' | 'between';

export const TENANT_CREDIT_LABELS: Readonly<Record<CreditQuality, string>> = {
  good: 'Good credit',
  fair: 'Fair credit',
  poor: 'Poor credit',
};

export const TENANT_WORK_LABELS: Readonly<Record<WorkHistory, string>> = {
  steady: 'Same job for years',
  new: 'Just started a job',
  between: 'Between jobs',
};

/**
 * Spec 157's indicators, and nothing else: income, credit quality, work,
 * household size, and past evictions where there are any. No score. What the
 * player reads off them is their own judgement, which is the game.
 */
export interface Tenant {
  readonly id: string;
  readonly name: string;
  /** The world year they moved in. */
  readonly since: number;
  /** Whole dollars a year. */
  readonly income: number;
  readonly credit: CreditQuality;
  readonly work: WorkHistory;
  readonly household: number;
  readonly evictions: number;
  /**
   * Ticket 0606. Present when the tenant is a business: its trade (`biz.*`) and the world year its
   * lease ends. For a business `income` is its yearly revenue, `household` its staff, `work` how
   * long it has traded (`new` is under two years) and `evictions` the leases it has defaulted on.
   */
  readonly trade?: string;
  readonly leaseEnds?: number;
  /** Ticket 0606. The yearly rent the lease was signed at, whole dollars. Fixed until renewal. */
  readonly rent?: number;
}

export type TenantTraits = Omit<Tenant, 'id' | 'name' | 'since'>;

/**
 * An applicant, from five stable units. Rent-to-income runs from about a fifth
 * to about two fifths; a third of US renters pay more than 30%. Poor credit
 * goes with past evictions, as it does in life.
 */
export function applicantTraits(
  rentYear: number,
  units: readonly [number, number, number, number, number],
): TenantTraits {
  const [u1, u2, u3, u4, u5] = units;
  const income = Math.round((rentYear * (2.4 + 2.6 * u1)) / 500) * 500;
  const credit: CreditQuality = u2 < 0.55 ? 'good' : u2 < 0.85 ? 'fair' : 'poor';
  const work: WorkHistory = u3 < 0.7 ? 'steady' : u3 < 0.9 ? 'new' : 'between';
  const household = 1 + Math.floor(u4 * 4);
  const evictions =
    credit === 'poor'
      ? u5 < 0.08
        ? 2
        : u5 < 0.3
          ? 1
          : 0
      : credit === 'fair'
        ? u5 < 0.06
          ? 1
          : 0
        : u5 < 0.015
          ? 1
          : 0;
  return { income, credit, work, household, evictions };
}

/**
 * The chance a tenant pays a full year. Hidden — the player sees the
 * indicators this is made of, never the number.
 */
export function reliabilityOf(tenant: TenantTraits, rentYear: number): number {
  let chance = tenant.credit === 'good' ? 0.985 : tenant.credit === 'fair' ? 0.95 : 0.87;
  if (tenant.work === 'new') chance -= 0.03;
  if (tenant.work === 'between') chance -= 0.08;
  chance -= 0.07 * tenant.evictions;
  const burden = rentYear / Math.max(1, tenant.income);
  if (burden > 0.5) chance -= 0.1;
  else if (burden > 0.4) chance -= 0.05;
  return Math.max(0.5, Math.min(0.99, chance));
}

/**
 * Which applicant a letting agent, or a mass search, would take: the one most
 * likely to pay. An agent reads the same indicators the player does.
 */
export function bestApplicant<T extends TenantTraits>(
  applicants: readonly T[],
  rentYear: number,
): T | undefined {
  return applicants.reduce<T | undefined>(
    (best, candidate) =>
      best === undefined || reliabilityOf(candidate, rentYear) > reliabilityOf(best, rentYear)
        ? candidate
        : best,
    undefined,
  );
}

/* -------------------------------------------------------------------------- */
/* A year of letting                                                           */
/* -------------------------------------------------------------------------- */

/** A letting agent's cut of what is collected. Ordinary US fees run 8–10%. */
export const AGENT_SHARE = 0.08;

/** A tenant who stops paying is evicted, having paid about half the year. */
export const PAID_BEFORE_EVICTION = 0.5;

export type UnitOutcome = 'stayed' | 'left' | 'evicted' | 'empty';

export interface UnitYear {
  readonly outcome: UnitOutcome;
  /** Whole dollars collected from this unit this year. */
  readonly collected: number;
}

/**
 * One unit's year. A tenant who moved in this year pays for the part of it
 * the unit was let — a re-let takes `gap` of a year at this rent level.
 */
export function unitYear(input: {
  readonly tenant: Tenant | null;
  readonly year: number;
  readonly rentYear: number;
  readonly level: number;
  readonly payRoll: number;
  readonly leaveRoll: number;
}): UnitYear {
  const { tenant } = input;
  if (!tenant) return { outcome: 'empty', collected: 0 };
  const level = rentLevelOf(input.level);
  const share = tenant.since >= input.year ? 1 - level.gap : 1;
  const due = input.rentYear * share;
  if (input.payRoll >= reliabilityOf(tenant, input.rentYear)) {
    return { outcome: 'evicted', collected: Math.round(due * PAID_BEFORE_EVICTION) };
  }
  return {
    outcome: input.leaveRoll < level.leave ? 'left' : 'stayed',
    collected: Math.round(due),
  };
}

/* -------------------------------------------------------------------------- */
/* What it would make — the rental flow's numbers (spec 149–150)               */
/* -------------------------------------------------------------------------- */

export interface RentalEconomics {
  readonly units: number;
  readonly let: number;
  /** One unit's rent at the current setting, whole dollars a month. */
  readonly rentPerUnitMonth: number;
  /** Every unit let all year at the current setting, whole dollars. */
  readonly fullYear: number;
  readonly mortgageMonth: number;
  readonly mortgageYear: number;
  /** Full-year receipts at current occupancy and signed rents, before missed payments/gaps. */
  readonly collectedYear: number;
  /** Receipts less operating costs, before mortgage payments and personal income tax. */
  readonly operatingYear: number;
  /** Upkeep and taxes a year — the "maintenance" spec 149–150 shows here. */
  readonly upkeepYear: number;
  readonly agentYear: number;
  /** What a year would leave with today's tenants, after everything. */
  readonly profitYear: number;
}

export function rentalEconomics(input: {
  readonly units: number;
  readonly let: number;
  readonly goingRent: number;
  readonly level: number;
  readonly managed: boolean;
  readonly mortgageYear: number;
  readonly upkeepYear: number;
  /** Occupied commercial leases keep their signed rent until renewal. */
  readonly leaseRents?: readonly number[];
}): RentalEconomics {
  const rent = Math.round(input.goingRent * rentLevelOf(input.level).level);
  const collected = input.leaseRents?.reduce((sum, due) => sum + due, 0) ?? rent * input.let;
  const agentYear = input.managed ? Math.round(collected * AGENT_SHARE) : 0;
  return {
    units: input.units,
    let: input.let,
    rentPerUnitMonth: Math.round(rent / 12),
    fullYear: rent * input.units,
    mortgageMonth: Math.round(input.mortgageYear / 12),
    mortgageYear: input.mortgageYear,
    collectedYear: collected,
    operatingYear: collected - agentYear - input.upkeepYear,
    upkeepYear: input.upkeepYear,
    agentYear,
    profitYear: collected - agentYear - input.mortgageYear - input.upkeepYear,
  };
}

/** The letting state of a property, on the home itself. */
export interface Letting {
  /** Where the rent is set: a `RENT_LEVELS` level. */
  readonly level: number;
  /** A letting agent fills empty units every year, for `AGENT_SHARE`. */
  readonly managed: boolean;
  /** One slot per unit; `null` is an empty unit. */
  readonly tenants: readonly (Tenant | null)[];
}

export const emptyLetting = (units: number): Letting => ({
  level: GOING_RATE,
  managed: false,
  tenants: Array.from({ length: Math.max(1, units) }, () => null),
});
