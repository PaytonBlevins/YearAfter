import { describe, it, expect } from 'vitest';
import { openingPrices, runPriceYear } from './market';
import { advisorReserve, advisorBuyAmount, recommendationsFor } from './advisors';
import { INSTRUMENTS, SECTORS } from '@yearafter/content';
describe('P7 reserve and universal sizing', () => {
  it.each([
    [0, 12000],
    [24000, 12000],
    [45000, 22500],
    [90000, 45000],
  ])('protects six months at %i annual bills', (b, r) => expect(advisorReserve(b)).toBe(r));
  it('adds the explicit goal to bill money', () =>
    expect(advisorReserve(45000, 65000)).toBe(87500));
  it.each([
    [0, 0],
    [6000, 0],
    [6667, 1000],
    [74000, 11100],
    [63500, 9525],
  ])('sizes spare %i', (s, a) => expect(advisorBuyAmount(s)).toBe(a));
  it('uses 15% for fund and stock ideas alike', () => {
    const recs = recommendationsFor({
      prices: openingPrices(),
      portfolio: [],
      cash: 86000,
      year: 2026,
      advisorId: 'adv.independent',
      annualBills: 45000,
    });
    const buys = recs.filter((r) => r.verb === 'buy');
    expect(buys.some((r) => r.reason === 'idleCash')).toBe(true);
    expect(buys.some((r) => r.instrumentId)).toBe(true);
    expect(buys.map((r) => r.amount)).toEqual(buys.map(() => 9525));
  });
  it.each([0, 100, 86000])('does not buy goal money at cash %i', (cash) => {
    const recs = recommendationsFor({
      prices: openingPrices(),
      portfolio: [],
      cash,
      year: 2026,
      advisorId: 'adv.independent',
      annualBills: 45000,
      cashGoal: 65000,
    });
    expect(recs.filter((r) => r.verb === 'buy')).toEqual([]);
  });
  it('softens a broad market move without changing drift', () => {
    const prices = openingPrices();
    const row = INSTRUMENTS.find((i) => i.kind === 'stock')!;
    const next = runPriceYear(
      prices,
      'growth',
      SECTORS.map(() => 0.5),
      INSTRUMENTS.map(() => 0.5),
    ).prices;
    const before = prices.history[row.id]!.at(-1)!;
    expect(next.history[row.id]!.at(-1)).toBe(
      Math.round(before * (1 + row.drift + 0.8 * 0.07 * row.beta)),
    );
  });
  it('keeps the approved market shock scale at a neutral price path', () => {
    const prices = openingPrices();
    const next = runPriceYear(
      prices,
      'normal',
      SECTORS.map(() => 0.5),
      INSTRUMENTS.map(() => 0.5),
    ).prices;
    const row = INSTRUMENTS.find((i) => i.kind === 'stock')!;
    const current = prices.history[row.id]!.at(-1)!;
    // At neutral draws the shock terms vanish; drift remains the same.
    expect(next.history[row.id]!.at(-1)).toBe(Math.round(current * (1 + row.drift)));
  });
});
