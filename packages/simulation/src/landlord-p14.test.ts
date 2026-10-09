import { describe, it, expect } from 'vitest';
import { CITIES, findHomeKind, regionCostIndexOf } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import { post, reconcile, goingRentOf, mortgageFor } from '@yearafter/finance';
import {
  createNewGame,
  rentalListings,
  homeListings,
  commercialListings,
  buyHome,
  buyerOf,
  mortgageOfferFor,
  purposeOf,
  goingRentFor,
  economicsOf,
  changeRent,
  askingRentOf,
  advanceYear,
  fillEmptyUnits,
  setAgent,
  type GameState,
  sellHome,
  continueAsChild,
  heirsIn,
  decide,
} from './index';
function value<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw Error(String(r.error));
  return r.value;
}
function fixture(income = 1000000): GameState {
  const s = createNewGame({ seed: 'p14-command', startYear: 2000 });
  const city = CITIES.find((c) => c.countryCode === 'US' && c.regionCode === 'OH')!;
  let ledger = post(s.finance, 2030, 30, {
    category: 'salary',
    amount: dollars(income),
    source: 'Probe earnings',
  }).ledger;
  ledger = post(ledger, 2029, 29, {
    category: 'gift',
    amount: dollars(100000000),
    source: 'Probe savings',
  }).ledger;
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: ledger,
    player: {
      ...s.player,
      age: 30,
      cash: ledger.balance,
      currentLocation: { ...s.player.currentLocation, cityId: city.id },
    },
  };
}
describe('P14 public readers and real purchases', () => {
  it.each(['cash', 'mortgage', 'mortgage-half'] as const)(
    'buys/advances %s without RNG draw or invented wealth',
    (how) => {
      const s = fixture();
      const l = rentalListings(s)[0]!;
      const before = JSON.stringify(s);
      const rng = JSON.stringify(s.rng.snapshot());
      const offer = mortgageOfferFor(s, l, how === 'mortgage-half' ? 'half' : 'usual');
      const bought = value(buyHome(s, l.id, how));
      const paid = how === 'cash' ? l.askingPrice : offer.down;
      expect(Number(s.player.cash) - Number(bought.state.player.cash)).toBe(paid * 100);
      expect(Number(bought.home.mortgage?.principal ?? 0)).toBe(
        how === 'cash' ? 0 : offer.principal * 100,
      );
      expect(
        Number(bought.state.player.cash) +
          Number(bought.home.value) -
          Number(bought.home.mortgage?.balance ?? 0),
      ).toBe(Number(s.player.cash));
      expect(reconcile(bought.state.finance).ok).toBe(true);
      expect(JSON.stringify(s)).toBe(before);
      expect(JSON.stringify(s.rng.snapshot())).toBe(rng);
      let state = value(fillEmptyUnits(bought.state, bought.home.id)).state;
      state = value(setAgent(state, bought.home.id, true)).state;
      const next = advanceYear(state).state;
      expect(reconcile(next.finance).ok).toBe(true);
      expect(next.finance.balance).toBe(next.player.cash);
      expect(next.homes[0]!.mortgage?.principal).toBe(bought.home.mortgage?.principal);
    },
  );
  it('uses exactly 115% yield for actual residential quotes and lender forecasts but unchanged commercial yield', () => {
    const s = fixture();
    for (const l of [...rentalListings(s), ...commercialListings(s)]) {
      const k = findHomeKind(l.kindId)!;
      const h = value(buyHome(s, l.id, 'cash')).home;
      const raw = goingRentOf(
        h.value,
        k.rentYield * (k.commercial ? 1 : 1.15),
        regionCostIndexOf(h.regionKey),
        k.units,
      );
      expect(goingRentFor(h)).toBe(raw);
      expect(mortgageOfferFor(s, l, 'half')).toEqual(
        mortgageFor(
          l.askingPrice,
          buyerOf(s),
          l.annualExpense,
          purposeOf(s, l),
          raw * k.units,
          'half',
        ),
      );
    }
  });
  it('counts higher residential rent at the lender approval boundary', () => {
    const s = fixture();
    const l = rentalListings(s)[0]!;
    const k = findHomeKind(l.kindId)!;
    const baseRent =
      goingRentOf(dollars(l.askingPrice), k.rentYield, regionCostIndexOf(l.regionKey), k.units) *
      k.units;
    const currentRent =
      goingRentOf(
        dollars(l.askingPrice),
        k.rentYield * 1.15,
        regionCostIndexOf(l.regionKey),
        k.units,
      ) * k.units;
    const q = mortgageOfferFor(s, l, 'half');
    const income = Math.ceil((q.yearlyPayment + l.annualExpense) / 0.43 - currentRent * 0.75);
    const atBoundary = fixture(income);
    expect(mortgageOfferFor(atBoundary, l, 'half').approved).toBe(true);
    expect(
      mortgageFor(l.askingPrice, buyerOf(atBoundary), l.annualExpense, 'rental', baseRent, 'half')
        .because,
    ).toBe('income');
  });
  it('refuses half for a primary home and allows it on a second-house investment', () => {
    const s = fixture();
    const l = homeListings(s)[0]!;
    expect(mortgageOfferFor(s, l, 'half').because).toBe('invalidDeposit');
    expect(buyHome(s, l.id, 'mortgage-half').ok).toBe(false);
    const owned = value(buyHome(s, l.id, 'cash')).state;
    const second = homeListings(owned).find((h) => h.id !== l.id)!;
    expect(purposeOf(owned, second)).toBe('rental');
    expect(buyHome(owned, second.id, 'mortgage-half').ok).toBe(true);
  });
  it.each(['bad', undefined, 17, null])(
    'rejects malformed financing %j without spending',
    (how) => {
      const s = fixture();
      const before = JSON.stringify(s);
      expect(buyHome(s, rentalListings(s)[0]!.id, how as never)).toEqual({
        ok: false,
        error: 'no-such-financing',
      });
      expect(JSON.stringify(s)).toBe(before);
    },
  );
  it('rechecks cash and refuses a dead buyer on the new half route', () => {
    const s = fixture();
    const l = rentalListings(s)[0]!;
    expect(
      buyHome({ ...s, player: { ...s.player, cash: dollars(0) } }, l.id, 'mortgage-half').ok,
    ).toBe(false);
    expect(buyHome({ ...s, player: { ...s.player, alive: false } }, l.id, 'mortgage-half').ok).toBe(
      false,
    );
  });
  it('projects commercial signed rents after the asking rate changes', () => {
    const s = fixture();
    const l = commercialListings(s)[0]!;
    const bought = value(buyHome(s, l.id, 'cash'));
    const filled = value(fillEmptyUnits(bought.state, l.id)).state;
    const h = filled.homes[0]!;
    const signed = h.letting!.tenants.map((t) => t!.rent!);
    const up = value(changeRent(filled, l.id, 1)).state;
    const e = economicsOf(up.homes[0]!);
    expect(e.collectedYear).toBe(signed.reduce((a, b) => a + b, 0));
    expect(e.agentYear).toBe(0);
    expect(e.operatingYear - e.mortgageYear).toBe(e.profitYear);
    expect(askingRentOf(up.homes[0]!)).toBeGreaterThan(askingRentOf(h));
  });
  it('sells a half-financed property paying its outstanding mortgage first', () => {
    const s = fixture();
    const l = rentalListings(s)[0]!;
    const b = value(buyHome(s, l.id, 'mortgage-half'));
    const sold = value(sellHome(b.state, l.id));
    expect(sold.state.homes).toHaveLength(0);
    expect(reconcile(sold.state.finance).ok).toBe(true);
    const cash = value(buyHome(s, l.id, 'cash'));
    const cashSold = value(sellHome(cash.state, l.id));
    expect(
      Number(cashSold.state.player.cash) -
        Number(cash.state.player.cash) -
        (Number(sold.state.player.cash) - Number(b.state.player.cash)),
    ).toBe(Number(b.home.mortgage!.balance));
  });
  it('settles a half-deposit mortgage before paying the actual heir', () => {
    let dead: GameState | undefined;
    for (let n = 0; n < 10 && !dead; n++) {
      let s = createNewGame({ seed: `p13-heir-${n}`, startYear: 2000 });
      let guard = 0;
      while (s.player.alive && guard++ < 110) {
        s = advanceYear(s).state;
        for (let a = 0; a < 20 && s.pending.length; a++) {
          const d = s.pending[0]!;
          const c = d.choices[0];
          if (!c) break;
          const r = decide(s, d.eventId, c.id);
          if (!r.ok) break;
          s = r.value.state;
        }
      }
      if (!s.player.alive && heirsIn(s.family).some((h) => s.world.year - h.birthYear >= 18))
        dead = s;
    }
    expect(dead).toBeDefined();
    const heir = heirsIn(dead!.family).find((h) => dead!.world.year - h.birthYear >= 18)!;
    const s = fixture();
    const h = value(buyHome(s, rentalListings(s)[0]!.id, 'mortgage-half')).home;
    const next = continueAsChild({ ...dead!, homes: [h] }, heir.id)!;
    const withoutDebt = continueAsChild(
      { ...dead!, homes: [{ ...h, mortgage: undefined }] },
      heir.id,
    )!;
    expect(next.homes).toHaveLength(0);
    expect(Number(withoutDebt.player.cash) - Number(next.player.cash)).toBe(
      Number(h.mortgage!.balance),
    );
    expect(reconcile(next.finance).ok).toBe(true);
  });
});
