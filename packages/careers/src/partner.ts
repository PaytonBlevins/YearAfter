/**
 * Ticket 0502 legacy income and the participation rules retained by P16.
 *
 * Measured before this ticket (`claude/0502-a-household-of-two.md`): a partner
 * added half again to what a household cost and brought nothing in, so a
 * couple was strictly poorer than a single person. Median net worth at 35–44
 * was $2,900 for somebody with a partner and $108,000 for somebody without
 * one. Real households run the other way: two incomes are most of why couples
 * own homes and singles mostly rent.
 *
 * HISTORICAL 0502 CONTRACT, superseded by P16 catalog careers. Legacy income
 * below is retained only for v50 migration; participation remains shared.
 * The player cannot see their
 * partner's job, apply for it, or push it; spec 674–683 simulates "more than
 * the player is asked to manage", and the part a household feels is the
 * money. So a partner has an earning power, an age, years in and out of work,
 * and a retirement — and nothing else.
 *
 * STATELESS, ON PURPOSE. Everything here is derived from the partner's id, their
 * age and the year, through `mixedUnit` (CORE_RULES 13.84: keyed on a counter,
 * so it needs the finaliser). No save field, no migration, and a partner who
 * leaves takes their income with them because there is nothing left to read.
 */

import { mixedUnit } from '@yearafter/core';
import { afterTax } from './pay';

/**
 * Median earning power at the peak of a working life, whole dollars.
 *
 * Set against the player's own catalog rather than the census, because a
 * partner who out-earned everybody the player could ever work beside would be
 * a different game's economy: the median player earns about $55,000 at 45–54.
 * The US median for a full-time worker is around $60,000, all workers nearer
 * $50,000.
 */
/*
  Legacy v50 income anchor, retained for exact migration compatibility.
  P16 prospective pay uses saved catalog careers in partner-career.ts and
  does not use this median or age-earnings curve.
*/
export const PARTNER_PEAK_MEDIAN = 52_000;
/** Spread of earning power, as a log-normal sigma: p10 ≈ $29k, p90 ≈ $92k. */
export const PARTNER_SPREAD = 0.45;

/**
 * Share of peak earnings by age. A partner of twenty-five earns like somebody
 * of twenty-five; the curve is the ordinary US age–earnings shape, flat through
 * the late forties and fifties.
 */
export function earningsCurve(age: number): number {
  if (age < 22) return 0.35;
  if (age < 25) return 0.55;
  if (age < 30) return 0.7;
  if (age < 35) return 0.82;
  if (age < 45) return 0.94;
  if (age < 55) return 1;
  return 0.96;
}

/**
 * The chance a partner is working in a given stretch of years.
 *
 * About 82% of married adults of working age are employed. With a child under
 * six at home it is much lower for one parent, and the player is already the
 * other one: 0.62 is roughly the employment rate of married mothers of young
 * children.
 */
export const WORKING_CHANCE = 0.86;
export const WORKING_CHANCE_WITH_A_BABY = 0.62;
/** Under twenty-two, most are still studying or working part-time. */
export const WORKING_CHANCE_YOUNG = 0.5;
/**
 * Years in and out of work come in stretches, not coin flips: somebody who
 * stopped to raise a child is not back the next year and out again the one
 * after. Three years is one draw.
 */
export const SPELL_YEARS = 3;

/** Retirement between 62 and 67, fixed for the person. */
export const RETIRE_FROM = 62;
export const RETIRE_SPAN = 6;
/** A pension and Social Security together: about 40% of what they earned. */
export const PENSION_SHARE = 0.4;

export type PartnerWork = 'working' | 'notWorking' | 'retired';

export interface PartnerYear {
  readonly status: PartnerWork;
  /** Before tax, whole dollars. Zero when not working. */
  readonly gross: number;
  /** What reaches the household. */
  readonly net: number;
  readonly tax: number;
}

export interface PartnerInput {
  /** The partner's id — the only thing their earnings are keyed on. */
  readonly id: string;
  readonly age: number;
  /** Whether a child under six lives in the household. */
  readonly youngChild: boolean;
}

/** A standard normal draw from two stable units (Box–Muller). */
function normalFrom(key: string): number {
  const u1 = Math.max(1e-9, mixedUnit(`${key}:a`));
  const u2 = mixedUnit(`${key}:b`);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** What this person would earn at their peak, whole dollars. Fixed for life. */
export const earningPowerOf = (id: string): number =>
  Math.round(PARTNER_PEAK_MEDIAN * Math.exp(PARTNER_SPREAD * normalFrom(`partner:${id}:power`)));

export const retirementAgeOf = (id: string): number =>
  RETIRE_FROM + Math.floor(mixedUnit(`partner:${id}:retire`) * RETIRE_SPAN);

const NOTHING: PartnerYear = { status: 'notWorking', gross: 0, net: 0, tax: 0 };

/**
 * A partner's year of work. Pure: the same person at the same age in the same
 * household always comes out the same.
 */
export function partnerYear(input: PartnerInput): PartnerYear {
  const status = partnerWorkOf(input);
  if (status === 'notWorking') return NOTHING;
  const power = earningPowerOf(input.id);

  if (status === 'retired') {
    const gross = Math.round(power * PENSION_SHARE);
    return { status: 'retired', gross, net: afterTax(gross), tax: gross - afterTax(gross) };
  }

  const gross = Math.round(power * earningsCurve(input.age));
  const net = afterTax(gross);
  return { status: 'working', gross, net, tax: gross - net };
}

/** Participation only: no legacy earning-power calculation in P16 income. */
export function partnerWorkOf(input: PartnerInput): PartnerWork {
  if (input.age < 18) return 'notWorking';
  if (input.age >= retirementAgeOf(input.id)) return 'retired';
  const chance =
    input.age < 22
      ? WORKING_CHANCE_YOUNG
      : input.youngChild
        ? WORKING_CHANCE_WITH_A_BABY
        : WORKING_CHANCE;
  const spell = Math.floor(input.age / SPELL_YEARS);
  return mixedUnit(`partner:${input.id}:work:${spell}`) < chance ? 'working' : 'notWorking';
}
