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
