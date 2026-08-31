import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampProbability,
  clampStat,
  formatPercentage,
  fraction,
  percent,
  toFraction,
} from './percentage';

describe('Percentage', () => {
  it('converts between percent, fraction and basis points', () => {
    expect(percent(22.5)).toBe(2250);
    expect(fraction(0.225)).toBe(2250);
    expect(toFraction(percent(22.5))).toBeCloseTo(0.225, 10);
  });

  it('formats without trailing noise', () => {
    expect(formatPercentage(percent(24))).toBe('24%');
    expect(formatPercentage(percent(22.5))).toBe('22.5%');
  });
});

describe('clamping', () => {
  it('clamps stats to the visible 0-100 scale', () => {
    expect(clampStat(-14)).toBe(0);
    expect(clampStat(140)).toBe(100);
    expect(clampStat(63.4)).toBe(63);
  });

  it('clamps probabilities into [0, 1]', () => {
    expect(clampProbability(-0.2)).toBe(0);
    expect(clampProbability(1.4)).toBe(1);
  });

  it('rejects an inverted range', () => {
    expect(() => clamp(5, 10, 1)).toThrow(RangeError);
  });
});
