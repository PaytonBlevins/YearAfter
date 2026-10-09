import { describe, it, expect } from 'vitest';
import { findBusinessType, BUSINESS_TYPES } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import {
  newBusiness,
  post,
  reconcile,
  AGENT_LEVELS,
  businessYear,
  businessBought,
  type BusinessAgentLevel,
} from '@yearafter/finance';
import {
  createNewGame,
  setBusinessAgentLevel,
  setPrice,
  nudgePrice,
  runBusinessesYear,
  advanceYear,
  hireStaff,
  letStaffGo,
  setAutoStaff,
  continueAsChild,
  heirsIn,
  decide,
  type GameState,
} from './index';
function fixture(): GameState {
  const s = createNewGame({ seed: 'p13-command', startYear: 2000 });
  const f = post(s.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(100000000),
    source: 'Savings',
  });
  return {
    ...s,
    pending: [],
    finance: f.ledger,
    world: { ...s.world, year: 2030 },
    player: { ...s.player, age: 30, cash: f.ledger.balance },
    businesses: [newBusiness(findBusinessType('biz.realestate')!, 'biz:p13', 'Brokerage', 2000, 1)],
  };
}
function value<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw Error(String(r.error));
  return r.value;
}
describe('P13 actual owned commands and annual settlement', () => {
  it.each(AGENT_LEVELS)(
    'saves %s team without any money, stat, reputation or RNG reward',
    (level) => {
      const s = fixture();
      const before = JSON.stringify(s);
      const rng = JSON.stringify(s.rng.snapshot());
      const changed = value(setBusinessAgentLevel(s, 'biz:p13', level));
      expect(changed.businesses[0]).toEqual({ ...s.businesses[0], agentLevel: level });
      expect(changed.player).toBe(s.player);
      expect(changed.finance).toBe(s.finance);
      expect(JSON.stringify(changed.rng.snapshot())).toBe(rng);
      expect(JSON.stringify(s)).toBe(before);
      expect(reconcile(changed.finance).ok).toBe(true);
      expect(value(setBusinessAgentLevel(changed, 'biz:p13', level))).toBe(changed);
    },
  );
  it.each(['dead', 'minor', 'missing', 'unsupported', 'retired', 'rescue', 'bad-level'] as const)(
    'refuses %s before changing money, state or RNG',
    (kind) => {
      let s = fixture();
      let id = 'biz:p13';
      let level: BusinessAgentLevel = 'high';
      if (kind === 'dead') s = { ...s, player: { ...s.player, alive: false } };
      if (kind === 'minor') s = { ...s, player: { ...s.player, age: 17 } };
      if (kind === 'missing') id = 'not-owned';
      if (kind === 'unsupported' || kind === 'retired')
        s = {
          ...s,
          businesses: [
            { ...s.businesses[0]!, typeId: kind === 'retired' ? 'old.retired' : 'biz.marketing' },
          ],
        };
      if (kind === 'rescue')
        s = { ...s, pending: [{ eventId: 'business.rescue', choices: [] } as never] };
      if (kind === 'bad-level') level = 'perfect' as BusinessAgentLevel;
      const codes = {
        dead: 'not-alive',
        minor: 'too-young',
        missing: 'no-such-business',
        unsupported: 'no-agents',
        retired: 'no-agents',
        rescue: 'rescue-pending',
        'bad-level': 'no-such-level',
      };
      const before = JSON.stringify(s);
      const rng = JSON.stringify(s.rng.snapshot());
      expect(setBusinessAgentLevel(s, id, level)).toEqual({ ok: false, error: codes[kind] });
      expect(JSON.stringify(s)).toBe(before);
      expect(JSON.stringify(s.rng.snapshot())).toBe(rng);
    },
  );
  it('also refuses the typed rescue record even if its decision is absent', () => {
    const s = fixture();
    expect(
      setBusinessAgentLevel({ ...s, businessRescue: { cases: [] } as never }, 'biz:p13', 'high'),
    ).toEqual({ ok: false, error: 'rescue-pending' });
  });
  it('refuses direct and nudged brokerage pricing while preserving old state and ordinary type controls', () => {
    const s = fixture();
    const before = JSON.stringify(s);
    expect(setPrice(s, 'biz:p13', 140)).toEqual({ ok: false, error: 'market-priced' });
    expect(nudgePrice(s, 'biz:p13', 1)).toEqual({ ok: false, error: 'market-priced' });
    expect(JSON.stringify(s)).toBe(before);
    for (const type of BUSINESS_TYPES.filter((t) => t.id !== 'biz.realestate')) {
      const other = { ...s, businesses: [newBusiness(type, 'biz:p13', 'Other', 2000, 1)] };
      expect(value(setPrice(other, 'biz:p13', 140)).businesses[0]!.price).toBe(140);
      expect(value(nudgePrice(other, 'biz:p13', -1)).businesses[0]!.price).toBe(95);
    }
  });
  it('shares level across branches and preserves it through real manual and automatic staffing commands', () => {
    let s = fixture();
    s = { ...s, businesses: [{ ...s.businesses[0]!, branches: [2023], staff: 4 }] };
    s = value(setBusinessAgentLevel(s, 'biz:p13', 'high'));
    const hired = value(hireStaff(s, 'biz:p13'));
    expect(hired.businesses[0]!.agentLevel).toBe('high');
    expect(hired.businesses[0]!.autoStaff).toBe(false);
    const fired = value(letStaffGo(hired, 'biz:p13'));
    expect(fired.businesses[0]!.agentLevel).toBe('high');
    const managed = value(setAutoStaff(fired, 'biz:p13', true));
    expect(managed.businesses[0]!.agentLevel).toBe('high');
    expect(managed.businesses[0]!.branches).toEqual([2023]);
  });
  it.each(AGENT_LEVELS)(
    'propagates %s terms and fixed pricing through actual annual ledger and advance',
    (level) => {
      let s = value(setBusinessAgentLevel(fixture(), 'biz:p13', level));
      s = { ...s, businesses: [{ ...s.businesses[0]!, price: 140 }] };
      const b = s.businesses[0]!;
      const input = {
        businesses: [b],
        year: 2031,
        seed: 'p13-command',
        market: 'normal' as const,
        available: 0,
        holdsJob: false,
        stat: () => 50,
      };
      const r = runBusinessesYear(input);
      const ordinary = runBusinessesYear({ ...input, businesses: [{ ...b, price: 100 }] });
      expect(r).toEqual({
        ...ordinary,
        businesses: ordinary.businesses.map((held) => ({ ...held, price: 140 })),
      });
      expect(r.businesses[0]!.agentLevel).toBe(level);
      const next = advanceYear(s).state;
      expect(next.businesses[0]!.agentLevel).toBe(level);
      expect(reconcile(next.finance).ok).toBe(true);
      expect(next.finance.balance).toBe(next.player.cash);
      const acquired = businessBought({ business: b, ask: 100000 } as never);
      expect(acquired.agentLevel).toBe(level);
      expect(
        businessYear(b, findBusinessType(b.typeId)!, {
          year: 2031,
          market: 'normal',
          shock: 0,
          stat: 50,
          hands: 1,
        }),
      ).toEqual(
        businessYear({ ...b, price: 70 }, findBusinessType(b.typeId)!, {
          year: 2031,
          market: 'normal',
          shock: 0,
          stat: 50,
          hands: 1,
        }),
      );
    },
  );
  it('retains a real P1 shortfall as a decision instead of secretly spending the bank', () => {
    const s = fixture();
    const b = {
      ...s.businesses[0]!,
      cash: dollars(0),
      staff: 20,
      autoStaff: false,
      agentLevel: 'high' as const,
    };
    const r = runBusinessesYear({
      businesses: [b],
      year: 2031,
      seed: 'p13-rescue',
      market: 'severeRecession',
      available: 100000000,
      holdsJob: false,
      stat: () => 0,
    });
    expect(r.rescues).toHaveLength(1);
    expect(r.rescues[0]!.amount).toBeGreaterThan(0);
    expect(r.drawn).toBe(0);
    expect(r.businesses[0]!.agentLevel).toBe('high');
    expect(r.businesses[0]!.last!.injected).toBe(0);
  });
  it('preserves the level through actual descendant continuation', () => {
    let dead: GameState | undefined;
    for (let n = 0; n < 10 && !dead; n++) {
      let s = createNewGame({ seed: `p13-heir-${n}`, startYear: 2000 });
      let guard = 0;
      while (s.player.alive && guard++ < 110) {
        s = advanceYear(s).state;
        let answered = 0;
        while (s.pending.length && answered++ < 20) {
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
    const held = { ...fixture().businesses[0]!, agentLevel: 'high' as const };
    const next = continueAsChild({ ...dead!, businesses: [held] }, heir.id)!;
    expect(next.businesses[0]!.agentLevel).toBe('high');
    expect(reconcile(next.finance).ok).toBe(true);
  });
});
