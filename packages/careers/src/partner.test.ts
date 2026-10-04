/**
 * Ticket 0502 — a partner who works, as plain rules.
 */

import { describe, expect, it } from 'vitest';
import {
  PARTNER_PEAK_MEDIAN,
  PENSION_SHARE,
  RETIRE_FROM,
  RETIRE_SPAN,
  WORKING_CHANCE,
  WORKING_CHANCE_WITH_A_BABY,
  earningPowerOf,
  partnerYear,
  retirementAgeOf,
} from './partner';
import { afterTax } from './pay';

const IDS = Array.from({ length: 2000 }, (_, i) => `npc:partner-${i}`);
const median = (xs: readonly number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe('0502 — what a partner earns', () => {
  it('spreads earning power around the median, the way pay is spread', () => {
    const powers = IDS.map(earningPowerOf);
    const sorted = [...powers].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)]!;
    const p90 = sorted[Math.floor(sorted.length * 0.9)]!;
    expect(median(powers)).toBeGreaterThan(PARTNER_PEAK_MEDIAN * 0.92);
    expect(median(powers)).toBeLessThan(PARTNER_PEAK_MEDIAN * 1.08);
    expect(p10).toBeGreaterThan(20_000);
    expect(p90).toBeLessThan(120_000);
    expect(p90 / p10).toBeGreaterThan(2.5);
  });

  it('is the same person every year it is asked', () => {
    const input = { id: 'npc:partner-7', age: 41, youngChild: false };
    expect(partnerYear(input)).toEqual(partnerYear(input));
  });

  it('works in most years, and fewer with a baby at home', () => {
    const share = (youngChild: boolean) =>
      IDS.filter((id) => partnerYear({ id, age: 34, youngChild }).status === 'working').length /
      IDS.length;
    expect(share(false)).toBeCloseTo(WORKING_CHANCE, 1);
    expect(share(true)).toBeCloseTo(WORKING_CHANCE_WITH_A_BABY, 1);
    // The same people step out: nobody works only BECAUSE there is a baby.
    for (const id of IDS.slice(0, 300)) {
      if (partnerYear({ id, age: 34, youngChild: true }).status === 'working') {
        expect(partnerYear({ id, age: 34, youngChild: false }).status).toBe('working');
      }
    }
  });

  it('comes in stretches, not coin flips', () => {
    // Within one three-year spell a partner's status cannot change on its own.
    let changes = 0;
    for (const id of IDS.slice(0, 500)) {
      const a = partnerYear({ id, age: 36, youngChild: false }).status;
      const b = partnerYear({ id, age: 37, youngChild: false }).status;
      if (a !== b) changes += 1;
    }
    expect(changes).toBe(0);
  });

  it('pays tax on what it earns, and a pension once retired', () => {
    const id = IDS.find(
      (candidate) =>
        partnerYear({ id: candidate, age: 50, youngChild: false }).status === 'working',
    )!;
    const working = partnerYear({ id, age: 50, youngChild: false });
    expect(working.net).toBe(afterTax(working.gross));
    expect(working.tax).toBe(working.gross - working.net);

    const retired = partnerYear({ id, age: 70, youngChild: false });
    expect(retired.status).toBe('retired');
    expect(retired.gross).toBe(Math.round(earningPowerOf(id) * PENSION_SHARE));
    expect(retired.gross).toBeLessThan(working.gross);
  });

  it('retires between sixty-two and sixty-seven', () => {
    const ages = IDS.map(retirementAgeOf);
    expect(Math.min(...ages)).toBe(RETIRE_FROM);
    expect(Math.max(...ages)).toBe(RETIRE_FROM + RETIRE_SPAN - 1);
  });

  it('earns nothing as a minor', () => {
    expect(partnerYear({ id: IDS[0]!, age: 17, youngChild: false }).gross).toBe(0);
  });
});
