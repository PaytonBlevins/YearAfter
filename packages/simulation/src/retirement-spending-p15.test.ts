import { afterEach, describe, expect, it, vi } from 'vitest';
import { dollars } from '@yearafter/core';
import { ALL_JOBS } from '@yearafter/careers';
import {
  post,
  reconcile,
  creep,
  retirementSpendingFor,
  type LifestyleTier,
} from '@yearafter/finance';
import { createNewGame, advanceYear, type GameState } from './index';
import * as living from './phases/living';
function fixture(age = 74): GameState {
  const s = createNewGame({ seed: 'p15-annual', startYear: 2000 });
  const books = post(s.finance, 2000 + age, age, {
    category: 'gift',
    amount: dollars(512000),
    source: 'Saved earnings',
  }).ledger;
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2000 + age },
    finance: books,
    player: { ...s.player, age, cash: books.balance },
    retirement: { ...s.retirement, retiredAtAge: 65, balance: dollars(220000) },
    household: { ...s.household, standard: 23000, housing: 'ownPlace' },
  };
}
afterEach(() => vi.restoreAllMocks());
describe('P15 actual pension, savings and annual living', () => {
  it('feeds this year pension and released principal before billing, posts each once', () => {
    const s = fixture();
    const before = JSON.stringify({
      finance: s.finance,
      retirement: s.retirement,
      household: s.household,
    });
    const spy = vi.spyOn(living, 'runLiving');
    const next = advanceYear(s).state;
    const i = spy.mock.calls[0]![0];
    expect(i.retired).toBe(true);
    expect(i.age).toBe(75);
    expect(i.afterTaxIncome).toBe(18000);
    expect(i.wealth).toBe(Number(s.player.cash) / 100 + 10000);
    expect(i.portfolio).toBe(0);
    expect(next.household.standard).toBe(
      creep(
        s.household.standard,
        retirementSpendingFor({
          ...i,
          housing: 'ownPlace',
          liquidWealth: i.wealth + i.portfolio,
          retired: true,
          personalDebt: 0,
        }).target,
      ),
    );
    const year = next.finance.transactions.filter((t) => t.year === next.world.year);
    expect(year.filter((t) => t.source === 'State pension')).toHaveLength(1);
    expect(year.find((t) => t.source === 'State pension')?.amount).toBe(dollars(18000));
    expect(year.filter((t) => t.source === 'Retirement — drawn down')).toHaveLength(1);
    expect(year.find((t) => t.source === 'Retirement — drawn down')?.category).toBe('investment');
    expect(year.find((t) => t.source === 'Retirement — drawn down')?.amount).toBe(dollars(10000));
    expect(reconcile(next.finance).ok).toBe(true);
    expect(
      JSON.stringify({ finance: s.finance, retirement: s.retirement, household: s.household }),
    ).toBe(before);
  });
  it('counts the earned government pension and state pension without principal as income', () => {
    const s = fixture();
    const job = ALL_JOBS.find((j) => j.template === 'government');
    if (!job) throw Error('No government job');
    const withPension = {
      ...s,
      employment: {
        ...s.employment,
        history: [{ jobId: job.id, from: 25, to: 65, because: 'resigned' as const }],
      },
      retirement: { ...s.retirement, serviceYears: 40, finalPensionablePay: dollars(100000) },
    };
    const spy = vi.spyOn(living, 'runLiving');
    const next = advanceYear(withPension).state;
    expect(spy.mock.calls[0]![0].afterTaxIncome).toBe(82000);
    expect(
      next.finance.transactions.filter((t) => t.year === next.world.year && t.source === 'Pension'),
    ).toHaveLength(1);
    expect(reconcile(next.finance).ok).toBe(true);
  });
  it('counts personal card/loan balances, excludes business loans and unused limits', () => {
    const s = fixture();
    const loan = {
      productId: 'loan.personal',
      principal: dollars(10000),
      balance: dollars(10000),
      termLeft: 5,
      inArrears: false,
    };
    const card = {
      productId: 'card.secured',
      balance: dollars(2000),
      limit: dollars(5000),
      status: 'open' as const,
    };
    const spy = vi.spyOn(living, 'runLiving');
    advanceYear({ ...s, cards: [card], loans: [loan, { ...loan, businessId: 'business-debt' }] });
    expect(spy.mock.calls[0]![0].personalDebt).toBe(12000);
  });
  it.each(['frugal', 'comfortable', 'lavish'] as const)(
    'retains %s floor, target memory and paid annual mood',
    (tier: LifestyleTier) => {
      const input: living.LivingPhaseInput = {
        household: { standard: 30000, housing: 'ownPlace', lifestyle: tier },
        age: 75,
        locationIndex: 1,
        partnered: false,
        childAges: [],
        afterTaxIncome: 18000,
        wealth: 512000,
        portfolio: 0,
        credit: 0,
        earned: 0,
        toldToLeave: false,
        hasLivingParent: false,
        retired: true,
      };
      const snapshot = JSON.stringify(input);
      const r = living.runLiving(input);
      expect(r.household.standard).toBe(creep(30000, 28600));
      const expected =
        18600 +
        (r.household.standard - 18600) * (tier === 'frugal' ? 0.8 : tier === 'lavish' ? 1.5 : 1);
      expect(r.cost).toBe(Math.round(expected));
      expect(r.mood).toBe(tier === 'frugal' ? -1 : tier === 'lavish' ? 2 : 0);
      expect(r.hardship).toBe(false);
      expect(JSON.stringify(input)).toBe(snapshot);
    },
  );
  it('preserves hardship contraction and never rewards unfunded comforts', () => {
    const r = living.runLiving({
      household: { standard: 90000, housing: 'ownPlace', lifestyle: 'lavish' },
      age: 95,
      locationIndex: 1,
      partnered: false,
      childAges: [],
      afterTaxIncome: 0,
      wealth: 0,
      portfolio: 0,
      credit: 0,
      earned: 0,
      toldToLeave: false,
      hasLivingParent: false,
      retired: true,
    });
    expect(r.household.standard).toBe(18600);
    expect(r.cost).toBe(0);
    expect(r.mood).toBe(0);
    expect(r.hardship).toBe(true);
  });
  it('does not auto-retire a working elder or give an undrawn account to living', () => {
    const s = fixture();
    const spy = vi.spyOn(living, 'runLiving');
    const next = advanceYear({
      ...s,
      retirement: { ...s.retirement, retiredAtAge: undefined },
    }).state;
    const i = spy.mock.calls[0]![0];
    expect(i.retired).toBe(false);
    expect(i.wealth).toBe(Number(s.player.cash) / 100);
    expect(next.retirement.retiredAtAge).toBeUndefined();
  });
});
