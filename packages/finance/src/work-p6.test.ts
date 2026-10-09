import { expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { postAll, EMPTY_LEDGER } from './ledger';
import { summariseFinances } from './summary';
it('P6 rates tax against odd-job earnings as well as wages, while excluding gifts', () => {
  const ledger = postAll(EMPTY_LEDGER, 2030, 30, [
    { category: 'salary', amount: dollars(50_000), source: 'Wages' },
    { category: 'oddJob', amount: dollars(10_000), source: 'Side work' },
    { category: 'gift', amount: dollars(5000), source: 'Gift' },
    { category: 'tax', amount: dollars(-13_000), source: 'Tax' },
  ]).ledger;
  const result = summariseFinances(ledger, 2030);
  expect(result.taxRate).toBeCloseTo(13_000 / 60_000, 8);
  expect(Number(result.income)).toBe(6_500_000);
});
