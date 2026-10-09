import { describe, expect, it } from 'vitest';
import { findBusinessType, BUSINESS_TYPES } from '@yearafter/content';
import { dollars, mixedUnit } from '@yearafter/core';
import {
  newBusiness,
  post,
  reconcile,
  supplierSearchFor,
  supplierTerms,
  supplierPitch,
  businessBought,
  businessYear,
  drawEvent,
  supplierModifiers,
  type OwnedBusiness,
} from '@yearafter/finance';
import {
  createNewGame,
  searchSupplier,
  acceptSupplier,
  passSupplier,
  setSupplier,
  runBusinessesYear,
  advanceYear,
  decide,
  continueAsChild,
  heirsIn,
  type GameState,
} from './index';
export function fixture(seed = 'p12'): GameState {
  const s = createNewGame({ seed, startYear: 2000 });
  const f = post(s.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(100000000),
    source: 'Savings',
  });
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    finance: f.ledger,
    player: { ...s.player, age: 30, cash: f.ledger.balance },
    businesses: [newBusiness(findBusinessType('biz.cafe')!, 'biz:p12', 'Cafe', 2020, 1)],
  };
}
function value<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw Error(String(r.error));
  return r.value;
}
function search(s: GameState): GameState {
  return value(searchSupplier(s, 'biz:p12'));
}
function accept(s: GameState): GameState {
  return value(acceptSupplier(s, 'biz:p12', s.businesses[0]!.supplierSearch!.pending!.id));
}
function before(s: GameState) {
  return JSON.stringify(s.rng.snapshot());
}
describe('P12 owned supplier commands', () => {
  it('allows exactly five free successful searches; browsing consumes nothing; sixth refuses', () => {
    const initial = fixture();
    const rng = before(initial);
    let s = initial;
    const read = JSON.stringify(s);
    for (let i = 0; i < 10; i++)
      expect(supplierSearchFor(s.businesses[0]!, 2030)).toEqual({ year: 2030, used: 0 });
    expect(JSON.stringify(s)).toBe(read);
    const ids = new Set<string>();
    for (let i = 1; i <= 5; i++) {
      s = search(s);
      const row = s.businesses[0]!;
      const record = row.supplierSearch!;
      expect(record.used).toBe(i);
      expect(record.year).toBe(2030);
      expect(record.pending).toEqual(supplierPitch('p12', 'biz:p12', 2030, i));
      expect(Object.keys(record).sort()).toEqual(['pending', 'used', 'year']);
      ids.add(record.pending!.id);
      expect(s.finance).toBe(initial.finance);
      expect(s.player).toBe(initial.player);
      expect(s.businesses[0]!.reputation).toBe(initial.businesses[0]!.reputation);
      expect(reconcile(s.finance).ok).toBe(true);
      expect(before(s)).toBe(rng);
    }
    expect(ids.size).toBe(5);
    const snapshot = JSON.stringify(s);
    expect(searchSupplier(s, 'biz:p12')).toEqual({ ok: false, error: 'no-searches' });
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(before(initial)).toBe(rng);
  });
  it('accepts only the current pitch once, for no fee, preserving exact terms and quota', () => {
    const original = fixture();
    const rng = before(original);
    const s = search(original);
    const p = s.businesses[0]!.supplierSearch!.pending!;
    const accepted = accept(s);
    const b = accepted.businesses[0]!;
    expect(b.supplierAgreement).toEqual({ ...p, acceptedYear: 2030 });
    expect(b.supplier).toBe(p.grade);
    expect(supplierTerms(b)).toBe(b.supplierAgreement);
    expect(b.supplierSearch).toEqual({ year: 2030, used: 1 });
    expect(b).toEqual({
      ...s.businesses[0],
      supplier: p.grade,
      supplierAgreement: { ...p, acceptedYear: 2030 },
      supplierSearch: { year: 2030, used: 1 },
    });
    expect(accepted.finance).toBe(original.finance);
    expect(accepted.player).toBe(original.player);
    expect(before(accepted)).toBe(rng);
    expect(acceptSupplier(accepted, b.id, p.id)).toEqual({ ok: false, error: 'stale-pitch' });
    expect(passSupplier(accepted, b.id, p.id)).toEqual({ ok: false, error: 'stale-pitch' });
    const newSearch = search(accepted);
    expect(newSearch.businesses[0]!.supplierAgreement).toEqual(b.supplierAgreement);
  });
  it('replaces a pitch, passes without resetting the count, and refuses old IDs', () => {
    let s = search(fixture());
    const old = s.businesses[0]!.supplierSearch!.pending!.id;
    s = search(s);
    const p = s.businesses[0]!.supplierSearch!.pending!;
    expect(acceptSupplier(s, 'biz:p12', old)).toEqual({ ok: false, error: 'stale-pitch' });
    expect(passSupplier(s, 'biz:p12', old)).toEqual({ ok: false, error: 'stale-pitch' });
    s = value(passSupplier(s, 'biz:p12', p.id));
    expect(s.businesses[0]!.supplierSearch).toEqual({ year: 2030, used: 2 });
    expect(acceptSupplier(s, 'biz:p12', p.id)).toEqual({ ok: false, error: 'stale-pitch' });
    expect(passSupplier(s, 'biz:p12', p.id)).toEqual({ ok: false, error: 'stale-pitch' });
    expect(search(s).businesses[0]!.supplierSearch!.used).toBe(3);
  });
  it('refreshes quota next year, expires pending offers and preserves an accepted contract', () => {
    const accepted = accept(search(fixture()));
    let s = search(accepted);
    const old = s.businesses[0]!.supplierSearch!.pending!.id;
    s = { ...s, world: { ...s.world, year: 2031 } };
    expect(supplierSearchFor(s.businesses[0]!, 2031)).toEqual({ year: 2031, used: 0 });
    expect(acceptSupplier(s, 'biz:p12', old)).toEqual({ ok: false, error: 'stale-pitch' });
    expect(passSupplier(s, 'biz:p12', old)).toEqual({ ok: false, error: 'stale-pitch' });
    s = search(s);
    expect(s.businesses[0]!.supplierSearch!.used).toBe(1);
    expect(s.businesses[0]!.supplierAgreement).toEqual(accepted.businesses[0]!.supplierAgreement);
  });
  it('shares quota among branches, with independent business quotas', () => {
    let s = fixture();
    const a = { ...s.businesses[0]!, branches: [2024, 2026] };
    const b = { ...a, id: 'biz:second' };
    s = { ...s, businesses: [a, b] };
    for (let i = 0; i < 5; i++) s = search(s);
    expect(searchSupplier(s, a.id)).toEqual({ ok: false, error: 'no-searches' });
    const other = value(searchSupplier(s, b.id));
    expect(other.businesses[1]!.supplierSearch!.used).toBe(1);
    expect(other.businesses[0]!.supplierSearch!.used).toBe(5);
  });
  it.each(['dead', 'minor', 'unknown', 'unsupported', 'rescue'] as const)(
    'refuses %s without input, money or RNG mutation',
    (kind) => {
      let s = search(fixture());
      if (kind === 'dead') s = { ...s, player: { ...s.player, alive: false } };
      if (kind === 'minor') s = { ...s, player: { ...s.player, age: 17 } };
      if (kind === 'unsupported')
        s = { ...s, businesses: [{ ...s.businesses[0]!, typeId: 'retired' }] };
      if (kind === 'rescue')
        s = {
          ...s,
          pending: [
            { id: 'rescue', eventId: 'business.rescue', choices: [], text: 'rescue' } as never,
          ],
        };
      const id = kind === 'unknown' ? 'foreign' : 'biz:p12';
      const rng = before(s);
      const snap = JSON.stringify(s);
      const code = {
        dead: 'not-alive',
        minor: 'too-young',
        unknown: 'no-such-business',
        unsupported: 'no-suppliers',
        rescue: 'rescue-pending',
      }[kind];
      for (const r of [
        searchSupplier(s, id),
        acceptSupplier(s, id, s.businesses[0]!.supplierSearch!.pending!.id),
        passSupplier(s, id, 'old'),
      ])
        expect(r).toEqual({ ok: false, error: code });
      expect(JSON.stringify(s)).toBe(snap);
      expect(before(s)).toBe(rng);
    },
  );
  it.each(BUSINESS_TYPES.filter((t) => !t.supplier))(
    'never searches for supplier-free $id',
    (type) => {
      const s = fixture();
      const b = newBusiness(type, 'biz:p12', 'No supplies', 2020, 1);
      expect(searchSupplier({ ...s, businesses: [b] }, b.id)).toEqual({
        ok: false,
        error: 'no-suppliers',
      });
    },
  );
  it('blocks the old grade bypass, retaining generic grade anchors and no legacy loyalty', () => {
    const s = fixture();
    expect(setSupplier(s, 'biz:p12', 'premium')).toEqual({ ok: false, error: 'no-such-choice' });
    expect(supplierTerms(s.businesses[0]!)).toEqual({ cost: 1, quality: 1 });
    expect(s.businesses[0]!.supplierAgreement).toBeUndefined();
  });
  it('preserves terms and usage when acquired and through the real annual reader', () => {
    const s = accept(search(fixture()));
    const b = s.businesses[0]!;
    const acquired = businessBought({ business: b, ask: 100000 } as never);
    expect(acquired.supplierAgreement).toEqual(b.supplierAgreement);
    expect(acquired.supplierSearch).toEqual(b.supplierSearch);
    const input = {
      businesses: [b],
      year: 2031,
      seed: 'p12',
      market: s.market,
      available: 0,
      holdsJob: false,
      stat: () => 50,
    };
    const r = runBusinessesYear(input);
    expect(r.businesses[0]!.supplierAgreement).toEqual(b.supplierAgreement);
    expect(r.businesses[0]!.supplierSearch).toEqual(b.supplierSearch);
    expect(r.businesses[0]!.last!.revenue).toBeGreaterThan(0);
    const generic: OwnedBusiness = { ...b, supplierAgreement: undefined };
    expect(runBusinessesYear({ ...input, businesses: [generic] }).businesses[0]!.last).not.toEqual(
      r.businesses[0]!.last,
    );
  });
  it.each(['low', 'medium', 'high'] as const)(
    'carries %s loyalty through the actual weighted hike and reconciled advance',
    (loyalty) => {
      const base = accept(search(fixture()));
      const b = {
        ...base.businesses[0]!,
        supplierAgreement: { ...base.businesses[0]!.supplierAgreement!, loyalty },
      };
      let found = false;
      for (let i = 0; i < 1000 && !found; i++) {
        const seed = `p12-hike-${i}`;
        const year = 2031;
        const key = `${seed}:${b.id}:${year}:event`;
        const happened = drawEvent(
          findBusinessType(b.typeId)!,
          { year, market: 'normal', age: year - b.openedYear - 1, rival: b.rival },
          {
            happens: mixedUnit(`${key}:happens`),
            pick: mixedUnit(`${key}:pick`),
            size: mixedUnit(`${key}:size`),
          },
        );
        if (happened?.event.id !== 'supplier-hike') continue;
        found = true;
        const u1 = Math.max(1e-9, mixedUnit(`${seed}:${b.id}:${year}:shock:a`));
        const u2 = mixedUnit(`${seed}:${b.id}:${year}:shock:b`);
        const expected = businessYear(b, findBusinessType(b.typeId)!, {
          year,
          market: 'normal',
          shock: Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2),
          stat: 50,
          hands: 1,
          modifiers: supplierModifiers(b, happened),
        });
        const r = runBusinessesYear({
          businesses: [b],
          year,
          seed,
          market: 'normal',
          available: 0,
          holdsJob: false,
          stat: () => 50,
        });
        expect(r.businesses[0]!.last).toMatchObject({
          event: 'supplier-hike',
          costs: expected.costs,
          profit: expected.profit,
          revenue: expected.revenue,
        });
        expect(r.businesses[0]!.reputation).toBe(expected.reputation);
        expect(r.lines.some((line) => line.includes('supplier put its prices up'))).toBe(true);
      }
      expect(found).toBe(true);
      const next = advanceYear({ ...base, businesses: [b] }).state;
      expect(reconcile(next.finance).ok).toBe(true);
      expect(next.player.cash).toBe(next.finance.balance);
      expect(next.businesses[0]!.supplierAgreement).toEqual(b.supplierAgreement);
    },
  );
  it('preserves a contract and same-year usage through actual descendant handoff', () => {
    let dead: GameState | undefined;
    for (let n = 0; n < 10 && !dead; n++) {
      let s = createNewGame({ seed: `p12-heir-${n}`, startYear: 2000 });
      let guard = 0;
      while (s.player.alive && guard++ < 110) {
        s = advanceYear(s).state;
        let answers = 0;
        while (s.pending.length && answers++ < 20) {
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
    const year = dead!.world.year;
    const b = fixture().businesses[0]!;
    const p = supplierPitch('inherit', b.id, year, 1);
    const held = {
      ...b,
      supplier: p.grade,
      supplierAgreement: { ...p, acceptedYear: year },
      supplierSearch: { year, used: 5 },
    };
    const heir = heirsIn(dead!.family).find((h) => year - h.birthYear >= 18)!;
    const next = continueAsChild({ ...dead!, businesses: [held] }, heir.id)!;
    expect(next.businesses[0]!.supplierAgreement).toEqual(held.supplierAgreement);
    expect(next.businesses[0]!.supplierSearch).toEqual(held.supplierSearch);
    expect(searchSupplier(next, b.id)).toEqual({ ok: false, error: 'no-searches' });
  });
});
