import { describe, expect, it } from 'vitest';
import { findBusinessType } from '@yearafter/content';
import {
  ECONOMY_DEMAND,
  BUSINESS_ECONOMY_LEDGER_THRESHOLD,
  BUSINESS_ECONOMY_SCREEN_THRESHOLD,
  BUSINESS_ECONOMY_LOSS_THRESHOLD,
  BUSINESS_ECONOMY_GAIN_THRESHOLD,
  businessEconomyVisible,
  businessEconomyPercent,
  economyFor,
  businessYear,
  newBusiness,
} from './businesses';

const states = [
  ['severeRecession', 0.87, 0.922, 818_008, 801_696, 16_313],
  ['recession', 0.935, 0.961, 852_609, 812_422, 40_187],
  ['slowdown', 0.975, 0.985, 873_902, 819_023, 54_880],
  ['normal', 1, 1, 887_211, 823_148, 64_062],
  ['growth', 1.025, 1.015, 900_519, 827_274, 73_245],
  ['strongExpansion', 1.09, 1.054, 935_120, 838_000, 97_120],
] as const;

describe('P4 approved business-only economy', () => {
  it.each(states)('pins %s and retains industry sensitivity', (market, full, restaurant) => {
    expect(ECONOMY_DEMAND[market]).toBe(full);
    expect(economyFor(market, 1)).toBe(full);
    expect(economyFor(market, 0)).toBe(1);
    expect(economyFor(market, 0.6)).toBeCloseTo(restaurant, 12);
    expect(economyFor(market, 0.25)).toBeCloseTo(1 + (full - 1) / 4, 12);
  });

  it.each(states)(
    'books literal mature %s revenue, costs and profit',
    (market, _full, economy, revenue, costs, profit) => {
      const type = findBusinessType('biz.restaurant');
      if (!type) throw new Error('Missing restaurant');
      const business = {
        ...newBusiness(type, 'p4-fixed', 'Marlow', 2020, 1),
        staff: type.staff,
        reputation: 50,
      };
      const snapshot = JSON.stringify(business);
      const result = businessYear(business, type, {
        year: 2031,
        market,
        shock: 0,
        stat: 50,
        hands: 1,
      });
      expect(result.economy).toBeCloseTo(economy, 12);
      expect(result.revenue).toBe(revenue);
      expect(result.costs).toBe(costs);
      expect(result.profit).toBe(profit);
      expect(result.labor).toBe(418_113);
      expect(result.overhead).toBe(130_000);
      expect(result.reputation).toBe(50);
      expect(result.extra).toBe(0);
      expect(JSON.stringify(business)).toBe(snapshot);
    },
  );

  it('pins the approved context thresholds', () => {
    expect(BUSINESS_ECONOMY_LEDGER_THRESHOLD).toBe(0.0025);
    expect(BUSINESS_ECONOMY_SCREEN_THRESHOLD).toBe(0.015);
    expect(BUSINESS_ECONOMY_LOSS_THRESHOLD).toBe(0.03);
    expect(BUSINESS_ECONOMY_GAIN_THRESHOLD).toBe(0.025);
  });

  it('keeps exact positive and negative boundaries visible, with quiet neutral years', () => {
    expect(businessEconomyVisible(1.015)).toBe(true);
    expect(businessEconomyVisible(0.985)).toBe(true);
    expect(businessEconomyVisible(1.0149)).toBe(false);
    expect(businessEconomyVisible(0.9851)).toBe(false);
    expect(businessEconomyVisible(1)).toBe(false);
    expect(businessEconomyVisible(undefined)).toBe(false);
    expect(businessEconomyVisible(1.0025, BUSINESS_ECONOMY_LEDGER_THRESHOLD)).toBe(true);
    expect(businessEconomyVisible(0.9975, BUSINESS_ECONOMY_LEDGER_THRESHOLD)).toBe(true);
    expect(businessEconomyPercent(1.015)).toBe(2);
    expect(businessEconomyPercent(0.985)).toBe(2);
    expect(businessEconomyPercent(1.025)).toBe(3);
    expect(businessEconomyPercent(1.0149)).toBe(1);
    expect(businessEconomyPercent(0.922)).toBe(8);
  });
});
