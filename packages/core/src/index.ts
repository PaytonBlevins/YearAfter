/**
 * @yearafter/core — stable IDs, value types and primitives shared by every
 * domain package. Nothing here may import from another workspace package.
 */

export * from './ids';
export * from './location';
export * from './result';

export type { Money, FormatMoneyOptions } from './money';
export {
  ZERO,
  cents,
  dollars,
  add,
  subtract,
  negate,
  sum,
  scale,
  isNegative,
  isZero,
  compare,
  max,
  min,
  toDollars,
  formatMoney,
} from './money';

export type { Percentage, StatValue } from './percentage';
export {
  BASIS_POINTS_PER_PERCENT,
  BASIS_POINTS_WHOLE,
  basisPoints,
  percent,
  fraction,
  toFraction,
  toPercentNumber,
  formatPercentage,
  clamp,
  clampStat,
  clampProbability,
  STAT_MIN,
  STAT_MAX,
} from './percentage';
export * from './stable';
