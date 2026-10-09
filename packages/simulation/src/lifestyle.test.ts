import { describe, expect, it, vi } from 'vitest';
import { clampStat, dollars } from '@yearafter/core';
import { nudgeStats } from '@yearafter/character';
import { post, reconcile, SUBSISTENCE, type LifestyleTier } from '@yearafter/finance';
import { createNewGame } from './new-game';
import * as shaping from './shaping';
import { advanceYear } from './advance';
import { invest } from './investments';
import { setLifestyle, livingEstimateFor } from './lifestyle';
import { runLiving, type LivingPhaseInput } from './phases/living';
import type { GameState } from './game-state';
const input: LivingPhaseInput = {
  household: { standard: 50_000, housing: 'ownPlace', lifestyle: 'comfortable', leftHomeAt: 20 },
  age: 40,
  locationIndex: 1,
  partnered: false,
  childAges: [],
  afterTaxIncome: 165_000,
  wealth: 0,
  credit: 0,
  portfolio: 0,
  earned: 250_000,
  toldToLeave: false,
  hasLivingParent: true,
};
function adult(): GameState {
  const state = createNewGame({ seed: 'p2-adult', startYear: 2000 });
  const finance = post(state.finance, 2030, 30, {
    category: 'gift',
    amount: dollars(1_000_000),
    source: 'Saved money',
  }).ledger;
  return {
    ...state,
    world: { ...state.world, year: 2030 },
    player: {
      ...state.player,
      age: 30,
      cash: finance.balance,
      stats: { ...state.player.stats, happiness: clampStat(50) },
    },
    finance,
    household: {
      ...state.household,
      standard: 50_000,
      housing: 'ownPlace',
      leftHomeAt: 20,
      movedBackAt: 25,
    },
  };
}
describe('P2 — explicit lifestyle command and annual settlement', () => {
  it('changes only the saved preference, idempotently, without free stats, money, time or RNG', () => {
    let state = adult();
    const before = state;
    const rng = state.rng.snapshot();
    for (let i = 0; i < 20; i += 1) {
      for (const tier of ['frugal', 'comfortable', 'lavish'] as const) {
        const changed = setLifestyle(state, tier);
        if (!changed.ok) throw new Error(changed.error);
        expect(changed.value).toEqual({
          ...before,
          household: { ...before.household, lifestyle: tier },
        });
        state = changed.value;
      }
    }
    expect(state.rng.snapshot()).toEqual(rng);
    expect(setLifestyle(state, 'lavish')).toEqual({ ok: true, value: state });
  });
  it.each(['too-young', 'not-alive', 'pending-choice', 'unknown-tier'] as const)(
    'refuses %s without mutation',
    (reason) => {
      let state = adult();
      let tier: LifestyleTier = 'lavish';
      if (reason === 'too-young') state = { ...state, player: { ...state.player, age: 17 } };
      if (reason === 'not-alive') state = { ...state, player: { ...state.player, alive: false } };
      if (reason === 'pending-choice')
        state = {
          ...state,
          pending: [
            {
              eventId: 'question',
              category: 'random',
              age: 30,
              year: 2030,
              prompt: 'Waiting',
              choices: [],
              names: {},
            },
          ],
        };
      if (reason === 'unknown-tier') tier = 'unknown' as LifestyleTier;
      const before = state.rng.snapshot();
      expect(setLifestyle(state, tier)).toEqual({ ok: false, error: reason });
      expect(state.rng.snapshot()).toEqual(before);
      expect(state.household.lifestyle).toBe('comfortable');
    },
  );
  it('accepts the eighteenth birthday', () => {
    const state = adult();
    expect(setLifestyle({ ...state, player: { ...state.player, age: 18 } }, 'frugal').ok).toBe(
      true,
    );
  });
  it.each([
    ['frugal', 52_489, -1],
    ['comfortable', 60_961, 0],
    ['lavish', 82_142, 2],
  ] as const)('bills %s once and returns its paid-year nudge', (tier, cost, mood) => {
    const year = runLiving({ ...input, household: { ...input.household, lifestyle: tier } });
    expect(year.cost).toBe(cost);
    expect(year.transactions).toHaveLength(1);
    expect(year.transactions[0]?.amount).toBe(dollars(-cost));
    expect(year.mood).toBe(mood);
    expect(year.household).toEqual({ ...input.household, standard: 60_961, lifestyle: tier });
    expect(year.withoutCar).toBe(cost);
  });
  it('does not offer a child a bill or a mood reward', () => {
    const year = runLiving({
      ...input,
      age: 17,
      household: { ...input.household, lifestyle: 'lavish' },
    });
    expect(year.cost).toBe(0);
    expect(year.mood).toBe(0);
    expect(year.transactions).toEqual([]);
  });
  it('does not reward a lavish label at basic needs', () => {
    expect(
      runLiving({
        ...input,
        afterTaxIncome: 0,
        household: { ...input.household, standard: SUBSISTENCE, lifestyle: 'lavish' },
      }).mood,
    ).toBe(0);
  });
  it('contracts an unaffordable lavish year, preserving the preference and history without a reward', () => {
    const year = runLiving({
      ...input,
      afterTaxIncome: 0,
      household: { ...input.household, lifestyle: 'lavish', movedBackAt: 25 },
    });
    expect(year.hardship).toBe(true);
    expect(year.cost).toBe(0);
    expect(year.mood).toBe(0);
    expect(year.household).toMatchObject({
      lifestyle: 'lavish',
      standard: 18_600,
      housing: 'withFamily',
      leftHomeAt: 20,
      movedBackAt: 40,
    });
  });
  it('does not reward a tier when a large mortgage squeezes living to basic needs', () => {
    const year = runLiving({
      ...input,
      ownsHome: true,
      housingCost: 150_000,
      household: { ...input.household, housing: 'owned', lifestyle: 'lavish' },
      wealth: 1_000_000,
    });
    expect(year.hardship).toBe(false);
    expect(year.cost).toBe(13_020);
    expect(year.mood).toBe(0);
  });
  it('does not reward an illiquid lavish year that actually goes unpaid in the annual ledger', () => {
    const settled = (tier: LifestyleTier) => {
      const base = adult();
      const bought = invest(base, 'fd.broadindex', Number(base.player.cash) / 100);
      if (!bought.ok) throw new Error('Could not invest');
      const chosen = setLifestyle(bought.value.state, tier);
      if (!chosen.ok) throw new Error(chosen.error);
      const next = advanceYear(chosen.value).state;
      expect(
        next.finance.transactions.some(
          (entry) => entry.year === next.world.year && entry.category === 'shortfall',
        ),
      ).toBe(true);
      return next;
    };
    expect(settled('lavish').player.stats.happiness).toBe(
      settled('comfortable').player.stats.happiness,
    );
  });
  it('does not treat a portfolio or unused credit as free poverty', () => {
    for (const assets of [{ portfolio: 200_000 }, { credit: 200_000 }]) {
      const year = runLiving({
        ...input,
        afterTaxIncome: 0,
        ...assets,
        household: { ...input.household, lifestyle: 'lavish' },
      });
      expect(year.hardship).toBe(false);
      expect(year.cost).toBeGreaterThan(50_000);
    }
  });
  it('uses the chosen tier in the housing door, the car-free quote and hardship recalculation', () => {
    const cheap = runLiving({
      ...input,
      ownsVehicle: true,
      vehicleCost: 1_000,
      household: { ...input.household, lifestyle: 'frugal' },
    });
    expect(cheap.cost).toBe(51_489);
    expect(cheap.withoutCar).toBe(52_489);
    const lavish = runLiving({
      ...input,
      afterTaxIncome: 100_000,
      household: { ...input.household, housing: 'withFamily', lifestyle: 'lavish' },
    });
    expect(lavish.household.housing).toBe('ownPlace');
    expect(lavish.household.lifestyle).toBe('lavish');
  });
  it('tests moving out against the chosen life, rather than a comfortable budget', () => {
    const state = {
      ...input,
      afterTaxIncome: 70_000,
      household: { ...input.household, housing: 'withFamily' as const },
    };
    expect(
      runLiving({ ...state, household: { ...state.household, lifestyle: 'frugal' } }).household
        .housing,
    ).toBe('ownPlace');
    expect(
      runLiving({ ...state, household: { ...state.household, lifestyle: 'lavish' } }).household
        .housing,
    ).toBe('withFamily');
  });
  it('makes the tier affect real annual cash and happiness while reconciling the ledger', () => {
    // Fresh games give each policy an independent registry at the same seed.
    const settled = (tier: LifestyleTier) => {
      const chosen = setLifestyle(adult(), tier);
      if (!chosen.ok) throw new Error(chosen.error);
      const next = advanceYear(chosen.value).state;
      expect(reconcile(next.finance).ok).toBe(true);
      expect(next.household.lifestyle).toBe(tier);
      return next;
    };
    const comfortable = settled('comfortable');
    const frugal = settled('frugal');
    const lavish = settled('lavish');
    expect(frugal.player.cash).toBeGreaterThan(comfortable.player.cash);
    expect(lavish.player.cash).toBeLessThan(comfortable.player.cash);
    expect(frugal.player.stats.happiness).toBe(
      nudgeStats(comfortable.player.stats, { happiness: -1 }).happiness,
    );
    expect(lavish.player.stats.happiness).toBe(
      nudgeStats(comfortable.player.stats, { happiness: 2 }).happiness,
    );
  });
  it('Comfortable preserves activity happiness and a tier adds to it, rather than erasing it', () => {
    const spy = vi.spyOn(shaping, 'lifeShaping');
    try {
      spy.mockReturnValue({});
      const without = advanceYear(adult()).state;
      spy.mockReturnValue({ happiness: 1 });
      const comfortable = advanceYear(adult()).state;
      expect(comfortable.player.stats.happiness).toBe(
        nudgeStats(without.player.stats, { happiness: 1 }).happiness,
      );
      const chosen = setLifestyle(adult(), 'lavish');
      if (!chosen.ok) throw new Error(chosen.error);
      const lavish = advanceYear(chosen.value).state;
      expect(lavish.player.stats.happiness).toBe(
        nudgeStats(without.player.stats, { happiness: 3 }).happiness,
      );
    } finally {
      spy.mockRestore();
    }
  });
  it('the preview uses the same living model and location, with no forecast or RNG draws', () => {
    const state = adult();
    const before = state.rng.snapshot();
    expect(livingEstimateFor(state, 'frugal')).toBeLessThan(
      livingEstimateFor(state, 'comfortable'),
    );
    expect(livingEstimateFor(state, 'lavish')).toBeGreaterThan(
      livingEstimateFor(state, 'comfortable'),
    );
    expect(state.rng.snapshot()).toEqual(before);
    expect(livingEstimateFor({ ...state, player: { ...state.player, age: 17 } }, 'lavish')).toBe(0);
  });
});
