import { expect, it } from 'vitest';
import { findBusinessType } from '@yearafter/content';
import { businessYear, newBusiness } from '@yearafter/finance';
import { businessForecast, handsFor, nudgePrice, statFor } from './businesses';
import { createNewGame } from './new-game';

it('compares the same next-year operating model without revealing the actual year or changing the save', () => {
  const fresh = createNewGame({ seed: 'business-planning' });
  const type = findBusinessType('biz.cafe')!;
  const business = newBusiness(type, 'test-cafe', 'Test café', fresh.world.year - 4, 1);
  const state = { ...fresh, businesses: [business] };
  const snapshot = JSON.stringify(state);
  const current = businessForecast(state, business)!;
  const change = nudgePrice(state, business.id, -1);
  if (!change.ok) throw Error(change.error);
  const changed = change.value.businesses[0]!;
  const projected = businessForecast(change.value, changed)!;
  expect(projected.typical.revenue).not.toBe(current.typical.revenue);
  expect(projected.typical).toEqual(
    businessYear(changed, type, {
      year: state.world.year + 1,
      market: state.market,
      stat: statFor(state, type),
      hands: handsFor(state),
      shock: 0,
    }),
  );
  expect(projected.low).toBeLessThanOrEqual(projected.typical.profit);
  expect(projected.high).toBeGreaterThanOrEqual(projected.typical.profit);
  expect(JSON.stringify(state)).toBe(snapshot);
  expect(businessForecast(state, { ...business, typeId: 'biz.racing' })).toBeUndefined();
});
