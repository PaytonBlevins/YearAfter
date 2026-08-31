/**
 * Ticket 0003 — Money.
 *
 * Spec 1213–1223: money is stored as an exact integer minor unit (cents) and
 * formatted only at the UI boundary. Never use floating point for money —
 * spec 1043–1059 makes financial reconciliation absolute.
 */

declare const moneyBrand: unique symbol;

export type Money = number & { readonly [moneyBrand]: 'Money' };

export const ZERO: Money = 0 as Money;

/** Construct Money from an exact integer number of cents. */
export function cents(value: number): Money {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Money must be an integer number of cents, received ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Money out of safe integer range: ${value}`);
  }
  return value as Money;
}

/** Construct Money from whole dollars. Convenience for content catalogs. */
export function dollars(value: number): Money {
  return cents(Math.round(value * 100));
}

export const add = (a: Money, b: Money): Money => cents(a + b);
export const subtract = (a: Money, b: Money): Money => cents(a - b);
export const negate = (a: Money): Money => cents(-a);
export const sum = (values: readonly Money[]): Money =>
  values.reduce<Money>((total, value) => add(total, value), ZERO);

/** Multiply money by a plain factor, rounding half away from zero to whole cents. */
export function scale(amount: Money, factor: number): Money {
  const raw = amount * factor;
  const rounded = raw < 0 ? -Math.round(-raw) : Math.round(raw);
  return cents(rounded);
}

export const isNegative = (a: Money): boolean => a < 0;
export const isZero = (a: Money): boolean => a === 0;
export const compare = (a: Money, b: Money): number => (a < b ? -1 : a > b ? 1 : 0);
export const max = (a: Money, b: Money): Money => (a >= b ? a : b);
export const min = (a: Money, b: Money): Money => (a <= b ? a : b);
export const toDollars = (a: Money): number => a / 100;

export interface FormatMoneyOptions {
  /** Abbreviate large values: $1.2M, $340K, $2.5B. Default true. */
  readonly abbreviate?: boolean;
  /** Show cents on small values. Default false — a life sim rarely needs them. */
  readonly showCents?: boolean;
  /** Currency symbol. Default '$'. */
  readonly symbol?: string;
}

/**
 * UI-boundary formatting. Simulation code must never call this and then parse
 * the result back — Money is the only source of truth.
 */
export function formatMoney(amount: Money, options: FormatMoneyOptions = {}): string {
  const { abbreviate = true, showCents = false, symbol = '$' } = options;
  const negative = amount < 0;
  const absoluteDollars = Math.abs(amount) / 100;
  const sign = negative ? '-' : '';

  if (abbreviate) {
    const tiers: readonly [number, string][] = [
      [1_000_000_000_000, 'T'],
      [1_000_000_000, 'B'],
      [1_000_000, 'M'],
      [1_000, 'K'],
    ];
    for (const [threshold, suffix] of tiers) {
      if (absoluteDollars >= threshold) {
        const scaled = absoluteDollars / threshold;
        const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
        // Trim only zeros that follow a decimal point. A bare `/\.?0+$/` also
        // eats significant trailing zeros in a whole number, which rendered
        // $110K as $11K and $100K as $1K — a formatting bug that looks exactly
        // like a balance bug.
        const text = scaled
          .toFixed(digits)
          .replace(/(\.\d*?)0+$/, '$1')
          .replace(/\.$/, '');
        return `${sign}${symbol}${text}${suffix}`;
      }
    }
  }

  const fractionDigits = showCents ? 2 : 0;
  const text = absoluteDollars.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${sign}${symbol}${text}`;
}
