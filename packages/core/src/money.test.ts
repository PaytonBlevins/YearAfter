import { describe, expect, it } from 'vitest';
import { add, cents, dollars, formatMoney, scale, subtract, sum, ZERO } from './money';

describe('Money', () => {
  it('stores whole cents and rejects fractional input', () => {
    expect(cents(1234)).toBe(1234);
    expect(dollars(12.34)).toBe(1234);
    expect(() => cents(12.5)).toThrow(TypeError);
  });

  it('adds and subtracts without floating point drift', () => {
    // 0.1 + 0.2 !== 0.3 in floats; in cents it is exact.
    const total = add(dollars(0.1), dollars(0.2));
    expect(total).toBe(dollars(0.3));
    expect(subtract(dollars(100), dollars(33.33))).toBe(dollars(66.67));
  });

  it('sums an empty list to zero', () => {
    expect(sum([])).toBe(ZERO);
  });

  it('scales with round-half-away-from-zero', () => {
    expect(scale(cents(101), 0.5)).toBe(cents(51));
    expect(scale(cents(-101), 0.5)).toBe(cents(-51));
  });

  it('formats at the UI boundary only', () => {
    expect(formatMoney(dollars(950))).toBe('$950');
    expect(formatMoney(dollars(1500))).toBe('$1.5K');
    expect(formatMoney(dollars(2_400_000))).toBe('$2.4M');
    expect(formatMoney(dollars(1_200_000_000))).toBe('$1.2B');
    expect(formatMoney(dollars(-4200))).toBe('-$4.2K');
    expect(formatMoney(dollars(1500), { abbreviate: false })).toBe('$1,500');
    expect(formatMoney(cents(1234), { abbreviate: false, showCents: true })).toBe('$12.34');
  });
});

describe('formatMoney trailing zeros', () => {
  // Regression: the trim used to strip significant zeros from whole numbers,
  // so $110K rendered as $11K and $100K as $1K. Found by reading generated
  // household incomes, not by a test — hence these.
  it('keeps significant trailing zeros in the whole part', () => {
    expect(formatMoney(dollars(100_000))).toBe('$100K');
    expect(formatMoney(dollars(110_000))).toBe('$110K');
    expect(formatMoney(dollars(110_132))).toBe('$110K');
    expect(formatMoney(dollars(200_000_000))).toBe('$200M');
    expect(formatMoney(dollars(1_000))).toBe('$1K');
    expect(formatMoney(dollars(10_000))).toBe('$10K');
    expect(formatMoney(dollars(1_200_000))).toBe('$1.2M');
  });

  it('still drops meaningless decimal zeros', () => {
    expect(formatMoney(dollars(2_000))).toBe('$2K');
    expect(formatMoney(dollars(2_500))).toBe('$2.5K');
    expect(formatMoney(dollars(2_050))).toBe('$2.05K');
  });

  it('handles the unabbreviated path unchanged', () => {
    expect(formatMoney(dollars(110_000), { abbreviate: false })).toBe('$110,000');
  });
});
