import { describe, expect, it } from 'vitest';
import { HOME_KINDS } from '@yearafter/content';
import { rentYieldFor, rentalEconomics } from './rental';
import { mortgageFor, mortgagePaymentFor, type HomeBuyer } from './property';
const buyer: HomeBuyer = {
  age: 30,
  standing: 'good',
  income: 200000,
  cash: 1000000,
  otherPayments: 0,
  mortgaged: 0,
};
describe('P14 literal policy and investment deposit', () => {
  it.each(HOME_KINDS)('applies approved rent to $id without changing base yields', (kind) => {
    const old = kind.rentYield;
    expect(rentYieldFor(kind)).toBe(old * (kind.commercial ? 1 : 1.15));
    expect(kind.rentYield).toBe(old);
  });
  it('separates signed receipts, operating profit and exact debt service', () => {
    const n = rentalEconomics({
      units: 3,
      let: 2,
      goingRent: 12000,
      level: 1.1,
      managed: true,
      mortgageYear: 10001,
      upkeepYear: 6000,
      leaseRents: [8000, 9000],
    });
    expect(n.collectedYear).toBe(17000);
    expect(n.agentYear).toBe(1360);
    expect(n.operatingYear).toBe(9640);
    expect(n.profitYear).toBe(-361);
    expect(n.mortgageYear).toBe(10001);
    expect(n.mortgageMonth).toBe(833);
    expect(n.fullYear).toBe(39600);
  });
  it('keeps vacant costs but no rent or agent fee', () => {
    const n = rentalEconomics({
      units: 2,
      let: 0,
      goingRent: 12000,
      level: 1,
      managed: true,
      mortgageYear: 10000,
      upkeepYear: 6000,
    });
    expect(n.collectedYear).toBe(0);
    expect(n.operatingYear).toBe(-6000);
    expect(n.agentYear).toBe(0);
    expect(n.profitYear).toBe(-16000);
  });
  it.each(['rental', 'commercial'] as const)(
    'quotes half for %s without cheaper interest',
    (purpose) => {
      const normal = mortgageFor(400001, buyer, 10000, purpose, 40000);
      const half = mortgageFor(400001, buyer, 10000, purpose, 40000, 'half');
      expect(normal.approved).toBe(true);
      expect(half.approved).toBe(true);
      expect(normal.down).toBe(Math.ceil(400001 * (purpose === 'rental' ? 0.25 : 0.3)));
      expect(half.down).toBe(200001);
      expect(half.principal).toBe(200000);
      expect(half.product).toBe(normal.product);
      expect(half.product?.apr).toBe(0.0725);
      expect(half.yearlyPayment).toBe(
        mortgagePaymentFor(0.0725, 200000, purpose === 'rental' ? 30 : 25),
      );
      expect(half.yearlyPayment).toBeLessThan(normal.yearlyPayment);
    },
  );
  it.each(['wrong', null, 50, {}, 'half'])(
    'refuses inappropriate primary-home deposit %j',
    (deposit) => {
      expect(mortgageFor(400000, buyer, 10000, 'home', 0, deposit as never).because).toBe(
        'invalidDeposit',
      );
    },
  );
  it.each([
    [{ age: 17 }, 'tooYoung'],
    [{ cash: 199999 }, 'deposit'],
    [{ standing: 'poor' }, 'standing'],
    [{ income: 0 }, 'income'],
    [{ mortgages: 5 }, 'tooManyMortgages'],
    [{ otherPayments: 100000 }, 'income'],
  ] as const)('retains underwriting for %j', (over, reason) => {
    expect(mortgageFor(400000, { ...buyer, ...over }, 10000, 'rental', 0, 'half').because).toBe(
      reason,
    );
  });
  it('keeps principal caps', () => {
    expect(
      mortgageFor(
        12000000,
        { ...buyer, cash: 10000000, income: 10000000 },
        10000,
        'rental',
        100000,
        'half',
      ).because,
    ).toBe('tooLarge');
  });
});
