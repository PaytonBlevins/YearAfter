/**
 * Ticket 0003 — Percentage and 0–100 stat scale helpers.
 *
 * Percentage is stored as basis points (1/100th of a percent) so tax rates,
 * APRs and interest environments stay exact integers like Money does.
 */

declare const percentageBrand: unique symbol;

export type Percentage = number & { readonly [percentageBrand]: 'Percentage' };

export const BASIS_POINTS_PER_PERCENT = 100;
export const BASIS_POINTS_WHOLE = 10_000;

export function basisPoints(value: number): Percentage {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Percentage must be an integer number of basis points, received ${value}`);
  }
  return value as Percentage;
}

/** 22.5 -> 2250 basis points. */
export function percent(value: number): Percentage {
  return basisPoints(Math.round(value * BASIS_POINTS_PER_PERCENT));
}

/** 0.225 -> 2250 basis points. */
export function fraction(value: number): Percentage {
  return basisPoints(Math.round(value * BASIS_POINTS_WHOLE));
}

export const toFraction = (value: Percentage): number => value / BASIS_POINTS_WHOLE;
export const toPercentNumber = (value: Percentage): number => value / BASIS_POINTS_PER_PERCENT;

export function formatPercentage(value: Percentage, decimals = 1): string {
  const asPercent = toPercentNumber(value);
  const text = Number.isInteger(asPercent) ? asPercent.toString() : asPercent.toFixed(decimals);
  return `${text}%`;
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, minimum: number, maximum: number): number {
  if (minimum > maximum) {
    throw new RangeError(`clamp received an inverted range: ${minimum} > ${maximum}`);
  }
  return value < minimum ? minimum : value > maximum ? maximum : value;
}

/** The visible stat scale used by Happiness, Health, Smarts, Looks, and friends. */
export const STAT_MIN = 0;
export const STAT_MAX = 100;

export type StatValue = number;

export const clampStat = (value: number): StatValue => Math.round(clamp(value, STAT_MIN, STAT_MAX));

/** Clamp a probability into [0, 1]. Spec 1224–1246 requires safe probability clamping. */
export const clampProbability = (value: number): number => clamp(value, 0, 1);
