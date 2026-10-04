/**
 * Ticket 0501 — keys that differ only at the end.
 */

import { describe, expect, it } from 'vitest';
import { mixedUnit, stableUnit } from './stable';

const correlation = (xs: readonly number[]): number => {
  // Lag-one correlation: how much each value tells you about the next.
  const a = xs.slice(0, -1);
  const b = xs.slice(1);
  const mean = (v: readonly number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i += 1) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
};

describe('0501 — mixedUnit', () => {
  const years = Array.from({ length: 200 }, (_, i) => `housing:${2000 + i}`);

  it('gives sequential keys independent values', () => {
    const mixed = years.map(mixedUnit);
    expect(Math.abs(correlation(mixed))).toBeLessThan(0.2);
    // Spread over the whole unit interval, not bunched at one end.
    const mean = mixed.reduce((s, x) => s + x, 0) / mixed.length;
    expect(mean).toBeGreaterThan(0.4);
    expect(mean).toBeLessThan(0.6);
    expect(Math.min(...mixed)).toBeLessThan(0.1);
    expect(Math.max(...mixed)).toBeGreaterThan(0.9);
  });

  it('is the fix for a real fault in stableUnit', () => {
    // The finding the helper exists for: the old hash walks in step with the
    // last digit. If this ever stops failing, stableUnit changed underneath
    // every save and that is its own problem.
    expect(Math.abs(correlation(years.map(stableUnit)))).toBeGreaterThan(0.5);
  });

  it('is stable and in [0, 1)', () => {
    for (const key of years) {
      const value = mixedUnit(key);
      expect(value).toBe(mixedUnit(key));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
