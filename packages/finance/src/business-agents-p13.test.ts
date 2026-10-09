import { describe, it, expect } from 'vitest';
import { BUSINESS_TYPES, findBusinessType } from '@yearafter/content';
import {
  businessYear,
  newBusiness,
  laborCostFor,
  qualityOf,
  PAYROLLS,
  autoStaffFor,
  businessAgentPayPerHead,
} from './businesses';
import {
  AGENT_LEVELS,
  businessAgentEffects,
  businessAgentLevel,
  hasBusinessAgents,
  hasBusinessPriceControl,
  businessPrice,
} from './business-agents';
const type = findBusinessType('biz.realestate')!;
const b = newBusiness(type, 'biz:p13', 'Brokerage', 2000, 1);
const input = { year: 2030, market: 'normal' as const, shock: 0, stat: 50, hands: 1 };
describe('P13 agent economics and pricing exclusion', () => {
  it('pins the actual eligible type and defaults to exact Mid economics', () => {
    expect(BUSINESS_TYPES.filter((t) => hasBusinessAgents(t.id)).map((t) => t.id)).toEqual([
      'biz.realestate',
    ]);
    expect(BUSINESS_TYPES.filter((t) => !hasBusinessPriceControl(t.id)).map((t) => t.id)).toEqual([
      'biz.realestate',
    ]);
    expect(businessAgentLevel(b)).toBe('mid');
    expect(businessYear(b, type, input)).toEqual(
      businessYear({ ...b, agentLevel: 'mid' }, type, input),
    );
  });
  it.each(AGENT_LEVELS)(
    'uses literal %s cost/flow without an accidental quality, capacity or variable-cost benefit',
    (level) => {
      const expected = {
        low: { pay: 0.9, clients: 0.9 },
        mid: { pay: 1, clients: 1 },
        high: { pay: 1.15, clients: 1.15 },
      }[level];
      const held = { ...b, staff: 100, agentLevel: level };
      const baseline = businessYear({ ...held, agentLevel: 'mid' }, type, input);
      const r = businessYear(held, type, input);
      expect(businessAgentEffects(held)).toEqual(expected);
      expect(r.demand / baseline.demand).toBeCloseTo(expected.clients, 12);
      expect(r.capacity).toBe(baseline.capacity);
      expect(r.labor).toBe(
        Math.round(
          (laborCostFor(type, 100, b.payroll) * { low: 90, mid: 100, high: 115 }[level]) / 100,
        ),
      );
      expect(r.cogs).toBe(Math.round(Math.min(r.demand, r.capacity) * 0.55));
      expect(r.overhead).toBe(baseline.overhead);
      expect(r.reputation).toBe(baseline.reputation);
      expect(qualityOf(type, held.supplier, held.payroll)).toBe(1);
      expect(businessAgentPayPerHead(held, type)).toBe(
        Math.round(
          (laborCostFor(type, 1, b.payroll) * { low: 90, mid: 100, high: 115 }[level]) / 100,
        ),
      );
    },
  );
  it.each(PAYROLLS)('keeps %s payroll quality and turnover separate from role cost', (payroll) => {
    const base = { ...b, payroll, staff: 100 };
    const generic = businessYear(base, type, input);
    for (const level of AGENT_LEVELS) {
      const held = { ...base, agentLevel: level };
      const r = businessYear(held, type, input);
      const pay = { low: 90, mid: 100, high: 115 }[level];
      expect(r.reputation).toBe(generic.reputation);
      expect(r.labor).toBe(Math.round((generic.labor * pay) / 100));
    }
  });
  it('rounds an exact high-agent half dollar up consistently in the quote and yearly labor', () => {
    const held = { ...b, agentLevel: 'high' as const, staff: 1 };
    expect(laborCostFor(type, 1, held.payroll)).toBe(53950);
    expect(businessAgentPayPerHead(held, type)).toBe(62043);
    expect(businessYear(held, type, input).labor).toBe(62043);
  });
  it('lets actual manager staffing respond and preserves manual headcount', () => {
    const low = businessYear({ ...b, agentLevel: 'low' }, type, input);
    const high = businessYear({ ...b, agentLevel: 'high' }, type, input);
    expect(high.demand).toBeGreaterThan(low.demand);
    expect(autoStaffFor(type, b.staff, high, 1, 1)).toBeGreaterThanOrEqual(
      autoStaffFor(type, b.staff, low, 1, 1),
    );
    expect(low.capacity).toBe(high.capacity);
  });
  it('ignores old brokerage prices in every annual result including reputation', () => {
    const expected = businessYear(b, type, input);
    for (const price of [70, 90, 100, 110, 140]) {
      expect(businessPrice({ ...b, price })).toBe(100);
      expect(businessYear({ ...b, price }, type, input)).toEqual(expected);
    }
  });
  it.each(BUSINESS_TYPES.filter((t) => t.id !== 'biz.realestate'))(
    'preserves $id economics and responsive prices without borrowing an agent benefit',
    (type) => {
      const held = newBusiness(type, 'non-agent', 'Probe', 2000, 1);
      const r = businessYear(held, type, input);
      expect(businessYear({ ...held, agentLevel: 'high' }, type, input)).toEqual(r);
      expect(businessPrice({ ...held, price: 140 })).toBe(140);
      expect(businessYear({ ...held, price: 140 }, type, input).demand).toBeLessThan(
        businessYear({ ...held, price: 70 }, type, input).demand,
      );
    },
  );
});
