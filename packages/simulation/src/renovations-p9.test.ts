import { describe, expect, it, vi } from 'vitest';
import { clampStat, dollars } from '@yearafter/core';
import { RENOVATIONS } from '@yearafter/content';
import { nudgeStats } from '@yearafter/character';
import {
  annualExpenseOf,
  saleOf,
  goingRentOf,
  post,
  reconcile,
  renovationSpaceFor,
  renovationHappinessOf,
  type OwnedHome,
} from '@yearafter/finance';
import { createNewGame } from './new-game';
import { advanceYear } from './advance';
import { renovate, renovationOptionsFor, renovationComfortFor } from './renovations';
import * as shaping from './shaping';
import * as creators from './creators';
import { sellHome } from './homes';
import type { GameState } from './game-state';

export function owner(kindId = 'home.estate', cash = 2000000): GameState {
  const base = createNewGame({ seed: 'p9-year', startYear: 2000 });
  const books = post(base.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(cash),
    source: 'Test savings',
  });
  const home: OwnedHome = {
    id: 'home:2029:0',
    kindId,
    beds: 3,
    baths: 2,
    builtYear: 1980,
    condition: 'good',
    regionKey: 'US:OH',
    regionName: 'Ohio',
    purchasePrice: dollars(500000),
    boughtYear: 2029,
    value: dollars(500000),
    expenseRate: 0.02,
    behindYears: 0,
  };
  return {
    ...base,
    pending: [],
    world: { ...base.world, year: 2030 },
    homes: [home],
    finance: books.ledger,
    player: {
      ...base.player,
      age: 30,
      cash: books.ledger.balance,
      stats: { ...base.player.stats, happiness: clampStat(50) },
    },
    household: {
      ...base.household,
      housing: 'ownPlace',
      standard: 50000,
      lifestyle: 'comfortable',
      leftHomeAt: 20,
    },
  };
}
const installed = (state: GameState, ids: readonly string[]): GameState => ({
  ...state,
  homes: state.homes.map((h) => ({
    ...h,
    renovations: ids.map((renovationId) => ({ renovationId, cost: 12345, year: 2029 })),
  })),
});

describe('P9 actual renovations and settled comfort', () => {
  it.each(RENOVATIONS.slice(19).map((r) => [r.id] as const))(
    'buys %s without instant stats or a resale gain loop',
    (id) => {
      const state = owner();
      const before = state.rng.snapshot();
      const option = renovationOptionsFor(state, state.homes[0]!.id).find(
        (o) => o.renovation.id === id,
      )!;
      const result = renovate(state, state.homes[0]!.id, id);
      if (!result.ok) throw Error(result.error);
      expect(result.value.state.player.cash).toBe(dollars(2000000 - option.cost));
      expect(result.value.home.value).toBe(
        dollars(500000 + Math.round(option.cost * option.renovation.recovery)),
      );
      expect(option.expenseAfter).toBe(annualExpenseOf(result.value.home));
      expect(option.expenseAfter - annualExpenseOf(state.homes[0]!)).toBeGreaterThanOrEqual(
        option.renovation.upkeep,
      );
      expect(option.worthAfter).toBe(Number(result.value.home.value) / 100);
      expect(result.value.home.beds).toBe(3);
      expect(result.value.home.renovations?.at(-1)).toEqual({
        renovationId: id,
        cost: option.cost,
        year: 2030,
      });
      expect(Number(result.value.home.value) - Number(state.homes[0]!.value)).toBeLessThan(
        option.cost * 100,
      );
      const rentBefore = goingRentOf(state.homes[0]!.value, 0.05, 0.9, 1);
      const rentAfter = goingRentOf(result.value.home.value, 0.05, 0.9, 1);
      expect(rentAfter).toBeGreaterThan(rentBefore);
      const proceeds = saleOf(result.value.home).proceeds;
      const sold = sellHome(result.value.state, state.homes[0]!.id);
      if (!sold.ok) throw Error(sold.error);
      expect(sold.value.state.player.cash).toBe(dollars(2000000 - option.cost + proceeds));
      expect(sold.value.state.homes).toHaveLength(0);
      expect(reconcile(sold.value.state.finance).ok).toBe(true);
      expect(proceeds - saleOf(state.homes[0]!).proceeds).toBeLessThan(option.cost);
      expect(result.value.state.player.stats).toEqual(state.player.stats);
      expect(result.value.state.rng.snapshot()).toEqual(before);
      expect(reconcile(result.value.state.finance).ok).toBe(true);
      expect(renovate(result.value.state, state.homes[0]!.id, id)).toEqual({
        ok: false,
        error: 'already-done',
      });
    },
  );
  it('enforces exact capacity, preserves legacy work, permits zero-space jobs and refuses stale positive-space commands', () => {
    const exact = installed(owner('home.condo'), ['reno.study']);
    const gym = renovate(exact, exact.homes[0]!.id, 'reno.gym');
    expect(gym).toEqual({ ok: false, error: 'not-for-this-home' });
    expect(renovationSpaceFor(exact.homes[0]!)).toEqual({ capacity: 2, used: 1, remaining: 1 });
    const over = installed(owner('home.condo'), ['reno.study', 'reno.pool', 'unknown.old-work']);
    expect(renovationSpaceFor(over.homes[0]!)).toEqual({ capacity: 2, used: 4, remaining: 0 });
    expect(renovate(over, over.homes[0]!.id, 'reno.security').ok).toBe(true);
    const fixed = renovate(over, over.homes[0]!.id, 'reno.kitchen-modern');
    if (!fixed.ok) throw Error(fixed.error);
    expect(fixed.value.home.renovations).toContainEqual({
      renovationId: 'unknown.old-work',
      cost: 12345,
      year: 2029,
    });
    const full = installed(owner('home.townhouse'), [
      'reno.gym',
      'reno.theater',
      'reno.sauna',
      'reno.study',
    ]);
    const snapshot = JSON.stringify(full);
    const rng = full.rng.snapshot();
    expect(
      renovationOptionsFor(full, full.homes[0]!.id).find(
        (o) => o.renovation.id === 'reno.game-room',
      )?.refusal,
    ).toBe('noSpace');
    expect(renovate(full, full.homes[0]!.id, 'reno.game-room')).toEqual({
      ok: false,
      error: 'not-enough-space',
    });
    expect(JSON.stringify(full)).toBe(snapshot);
    expect(full.rng.snapshot()).toEqual(rng);
    const atBoundary = installed(owner('home.townhouse'), [
      'reno.gym',
      'reno.theater',
      'reno.sauna',
    ]);
    const done = renovate(atBoundary, atBoundary.homes[0]!.id, 'reno.study');
    if (!done.ok) throw Error(done.error);
    expect(renovationSpaceFor(done.value.home)).toEqual({ capacity: 4, used: 4, remaining: 0 });
  });
  it('keeps all pool variants mutually exclusive and bedrooms structural', () => {
    for (const id of ['reno.pool', 'reno.infinity-pool', 'reno.indoor-pool']) {
      const state = installed(owner(), [id]);
      for (const other of ['reno.pool', 'reno.infinity-pool', 'reno.indoor-pool'])
        expect(renovate(state, state.homes[0]!.id, other)).toEqual({
          ok: false,
          error: 'already-done',
        });
    }
    const state = owner();
    expect(renovate(state, state.homes[0]!.id, 'reno.bedroom-2')).toEqual({
      ok: false,
      error: 'needs-first',
    });
  });
  it('previews capped marginal comfort and no personal gain from another property', () => {
    const state = installed(owner(), ['reno.pool', 'reno.study']);
    expect(renovationHappinessOf(state.homes[0]!)).toBe(3);
    expect(
      renovationOptionsFor(state, state.homes[0]!.id).find((o) => o.renovation.id === 'reno.sauna'),
    ).toMatchObject({ happinessAfter: 3, happinessGain: 0 });
    const second = {
      ...state,
      homes: [state.homes[0]!, { ...owner().homes[0]!, id: 'home:2030:1' }],
    };
    expect(
      renovationOptionsFor(second, 'home:2030:1').find((o) => o.renovation.id === 'reno.sauna'),
    ).toMatchObject({ happinessAfter: 0, happinessGain: 0 });
    const rental = {
      ...state.homes[0]!,
      letting: { level: 0, managed: false, tenants: [null] },
    } as OwnedHome;
    expect(renovationComfortFor([rental], false, 0)).toBe(0);
    expect(renovationComfortFor([], false, 0)).toBe(0);
    expect(renovationComfortFor(state.homes, true, 0)).toBe(0);
    expect(renovationComfortFor(state.homes, false, -1)).toBe(0);
    expect(renovationComfortFor(state.homes, false, 0)).toBe(3);
    expect(renovationHappinessOf(installed(owner(), ['reno.study', 'reno.study']).homes[0]!)).toBe(
      1,
    );
  });
  it('adds comfort to real annual activity and lifestyle effects; does not save a bonus', () => {
    const spy = vi.spyOn(shaping, 'lifeShaping');
    try {
      spy.mockReturnValue({ happiness: 1 });
      const baseline = advanceYear(owner()).state;
      const study = advanceYear(installed(owner(), ['reno.study'])).state;
      expect(study.player.stats.happiness).toBe(
        nudgeStats(baseline.player.stats, { happiness: 1 }).happiness,
      );
      const capped = advanceYear(
        installed(owner(), ['reno.study', 'reno.gym', 'reno.theater', 'reno.wine-cellar']),
      ).state;
      expect(capped.player.stats.happiness).toBe(
        nudgeStats(baseline.player.stats, { happiness: 3 }).happiness,
      );
      const lavish = owner();
      const withTier = {
        ...lavish,
        household: { ...lavish.household, lifestyle: 'lavish' as const },
      };
      const tierBaseline = advanceYear(withTier).state;
      const fresh = owner();
      const tierComfort = advanceYear(
        installed({ ...fresh, household: { ...fresh.household, lifestyle: 'lavish' as const } }, [
          'reno.study',
        ]),
      ).state;
      expect(tierComfort.player.stats.happiness).toBe(
        nudgeStats(tierBaseline.player.stats, { happiness: 1 }).happiness,
      );
      const broke = owner('home.estate', 0);
      const poorBase = advanceYear(broke).state;
      const poorComfort = advanceYear(installed(owner('home.estate', 0), ['reno.study'])).state;
      expect(poorComfort.player.stats.happiness).toBe(poorBase.player.stats.happiness);
      expect(study.player.stats.health).toBe(baseline.player.stats.health);
      expect(study.player.stats.smarts).toBe(baseline.player.stats.smarts);
      const run = creators.runCreatorsYear;
      const creatorSpy = vi
        .spyOn(creators, 'runCreatorsYear')
        .mockImplementation((input) => ({ ...run(input), mood: 2 }));
      try {
        const creatorBase = advanceYear(owner()).state;
        const creatorComfort = advanceYear(installed(owner(), ['reno.study'])).state;
        expect(creatorComfort.player.stats.happiness).toBe(
          nudgeStats(creatorBase.player.stats, { happiness: 1 }).happiness,
        );
      } finally {
        creatorSpy.mockRestore();
      }
    } finally {
      spy.mockRestore();
    }
  });
  it('charges a chosen card at the quoted price and rejects payment/capacity failures atomically', () => {
    const base = owner('home.townhouse', 0);
    const state = {
      ...base,
      cards: [
        {
          productId: 'card.private',
          limit: dollars(50000),
          balance: dollars(0),
          status: 'open' as const,
        },
      ],
    };
    const payment = {
      kind: 'card' as const,
      productId: 'card.private',
      expectedTotal: dollars(11000),
    };
    const before = state.rng.snapshot();
    const done = renovate(state, state.homes[0]!.id, 'reno.sauna', payment);
    if (!done.ok) throw Error(done.error);
    expect(done.value.state.player.cash).toBe(dollars(0));
    expect(done.value.state.cards[0]!.balance).toBe(dollars(11000));
    expect(done.value.entry.text).toContain('Paid with');
    expect(done.value.state.rng.snapshot()).toEqual(before);
    expect(reconcile(done.value.state.finance).ok).toBe(true);
    expect(
      renovate(state, state.homes[0]!.id, 'reno.sauna', {
        ...payment,
        expectedTotal: dollars(12000),
      }),
    ).toEqual({ ok: false, error: 'payment-price-changed' });
    expect(renovate({ ...state, cards: [] }, state.homes[0]!.id, 'reno.sauna', payment)).toEqual({
      ok: false,
      error: 'payment-card-missing',
    });
    for (const [status, balance, error] of [
      ['frozen', 0, 'payment-card-frozen'],
      ['open', 49999, 'payment-credit-short'],
    ] as const) {
      const denied = {
        ...state,
        cards: [{ ...state.cards[0]!, status, balance: dollars(balance) }],
      };
      const snapshot = JSON.stringify(denied);
      expect(renovate(denied, state.homes[0]!.id, 'reno.sauna', payment)).toEqual({
        ok: false,
        error,
      });
      expect(JSON.stringify(denied)).toBe(snapshot);
    }
    const full = installed(state, ['reno.gym', 'reno.theater', 'reno.study', 'reno.game-room']);
    expect(renovate(full, state.homes[0]!.id, 'reno.sauna', payment)).toEqual({
      ok: false,
      error: 'not-enough-space',
    });
    expect(state.cards[0]!.balance).toBe(dollars(0));
  });
});
