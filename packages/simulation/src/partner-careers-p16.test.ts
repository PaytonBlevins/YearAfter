import { describe, expect, it, vi } from 'vitest';
import { asNpcId, clampStat, dollars } from '@yearafter/core';
import { startPartnerCareer, advancePartnerCareer, afterTax } from '@yearafter/careers';
import { reconcile, reconcileByYear } from '@yearafter/finance';
import type { Acquaintance } from '@yearafter/social';
import {
  createNewGame,
  advanceYear,
  decide,
  continueAsChild,
  heirsIn,
  type GameState,
} from './index';
import { partnerIncomeFor, partnerIncomeOf } from './phases/partner';
import { incomeOf } from './cards';
import { borrowerFrom } from './loans';
import { buyerOf } from './homes';
import { earnedIncomeOf } from './vehicles';
import * as livingPhase from './phases/living';
export function partnerFixture(
  id = 'p16-partner',
  stage: 'seeing' | 'together' | 'engaged' | 'married' = 'married',
): GameState {
  const s = createNewGame({ seed: 'p16-household', startYear: 2000 });
  const person: Acquaintance = {
    id: asNpcId(id),
    firstName: 'Robin',
    lastName: 'Lee',
    sex: 'female',
    birthYear: 2000,
    alive: true,
    tier: 1,
    personality: s.player.personality,
    relationship: clampStat(90),
    kind: 'peer',
    context: 'app',
    metAtAge: 29,
    lastContactAge: 30,
    memories: [],
    inRoom: true,
    romance: { stage, since: 29 },
  };
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    player: { ...s.player, age: 30 },
    circle: { ...s.circle, people: [person] },
  };
}
function answer(s: GameState): GameState {
  for (let n = 0; s.pending.length && n < 20; n++) {
    const d = s.pending[0]!;
    let a = decide(s, d.eventId, d.choices[0]!.id);
    if (!a.ok) a = decide(s, d.eventId, d.choices.at(-1)!.id);
    if (!a.ok) throw Error(d.eventId);
    s = a.value.state;
  }
  expect(s.pending).toHaveLength(0);
  return s;
}
describe('P16 real household settlement', () => {
  it.each(['together', 'engaged', 'married'] as const)(
    'initializes and settles %s through the same annual engine',
    (stage) => {
      const s = partnerFixture('p16-partner', stage);
      const seed = s.rng.getSeed();
      const rng = s.rng.snapshot();
      expect(partnerIncomeOf(s).year).toBeUndefined();
      expect(s.rng.snapshot()).toEqual(rng);
      const living = vi.spyOn(livingPhase, 'runLiving');
      let next: GameState;
      try {
        next = advanceYear(s).state;
        expect(living.mock.calls[0]![0].afterTaxIncome).toBeGreaterThanOrEqual(
          partnerIncomeOf(next).net,
        );
      } finally {
        living.mockRestore();
      }
      const c = next!.partnerCareers['p16-partner']!;
      expect(c).toEqual(
        startPartnerCareer({
          id: 'p16-partner',
          seed,
          age: 31,
          worldYear: 2031,
          youngChild: false,
          playerPay: 0,
        }),
      );
      expect(s.partnerCareers).toEqual({});
      const work = partnerIncomeOf(next!);
      expect(work.year).toEqual(c.last);
      const entries = next!.finance.transactions.filter(
        (t) => t.year === 2031 && t.category === 'partner',
      );
      expect(entries).toHaveLength(c.last.gross > 0 ? 1 : 0);
      if (c.last.gross > 0) expect(entries[0]!.amount).toBe(dollars(c.last.gross));
      const taxes = next!.finance.transactions.filter(
        (t) => t.year === 2031 && t.category === 'tax' && t.source.includes("Robin's"),
      );
      expect(taxes.reduce((s, t) => s + Number(t.amount), 0)).toBe(-c.last.tax * 100);
      expect(c.last.net).toBe(afterTax(c.last.gross));
      expect(reconcile(next!.finance).ok).toBe(true);
      expect(reconcileByYear(next!.finance).ok).toBe(true);
      expect(borrowerFrom(next!).income).toBe(incomeOf(next!));
      expect(buyerOf(next!).income).toBe(incomeOf(next!));
      expect(earnedIncomeOf(next!)).toBeGreaterThanOrEqual(c.last.gross);
      const frozen = JSON.stringify(next!.partnerCareers),
        snapshot = next!.rng.snapshot();
      for (let n = 0; n < 10; n++) expect(partnerIncomeOf(next!).career).toEqual(c);
      expect(JSON.stringify(next!.partnerCareers)).toBe(frozen);
      expect(next!.rng.snapshot()).toEqual(snapshot);
    },
  );
  it('does not initialize or pay a date, minor, dead or departed partner', () => {
    for (const mode of ['seeing', 'minor', 'dead', 'gone']) {
      const s = partnerFixture();
      const people = s.circle.people.map((p) =>
        mode === 'seeing'
          ? { ...p, romance: { stage: 'seeing' as const, since: 30 } }
          : mode === 'minor'
            ? { ...p, birthYear: 2015 }
            : mode === 'dead'
              ? { ...p, alive: false }
              : p,
      );
      const phase = partnerIncomeFor({
        people: mode === 'gone' ? [] : people,
        worldYear: 2030,
        childAges: [],
        seed: s.rng.getSeed(),
        careers: {},
        playerPay: 60000,
      });
      expect(phase.gross).toBe(0);
      expect(phase.transactions).toEqual([]);
      expect(phase.careers).toEqual({});
    }
  });
  it('stops old household income, catches up a returning person without backpay and gives a new spouse their own career', () => {
    const s = partnerFixture();
    const first = partnerIncomeFor({
      people: s.circle.people,
      worldYear: 2030,
      childAges: [],
      seed: s.rng.getSeed(),
      playerPay: 60000,
    });
    const absent = partnerIncomeFor({
      people: [],
      worldYear: 2040,
      childAges: [],
      seed: s.rng.getSeed(),
      careers: first.careers,
    });
    expect(absent.transactions).toEqual([]);
    expect(absent.careers).toEqual(first.careers);
    expect(
      partnerIncomeOf({ ...s, world: { ...s.world, year: 2040 }, partnerCareers: first.careers })
        .year,
    ).toBeUndefined();
    const returning = partnerIncomeFor({
      people: s.circle.people,
      worldYear: 2040,
      childAges: [],
      seed: s.rng.getSeed(),
      careers: absent.careers,
      playerPay: 400000,
    });
    expect(returning.career).toEqual(
      advancePartnerCareer(
        {
          id: 'p16-partner',
          seed: s.rng.getSeed(),
          age: 40,
          worldYear: 2040,
          youngChild: false,
          playerPay: 0,
        },
        first.career!,
      ),
    );
    expect(returning.transactions.filter((t) => t.category === 'partner')).toHaveLength(
      returning.gross > 0 ? 1 : 0,
    );
    const newPeople = partnerFixture('new-spouse').circle.people;
    const replacement = partnerIncomeFor({
      people: newPeople,
      worldYear: 2040,
      childAges: [],
      seed: s.rng.getSeed(),
      careers: first.careers,
      playerPay: 0,
    });
    expect(replacement.careers['p16-partner']).toEqual(first.career);
    expect(replacement.career).toEqual(
      startPartnerCareer({
        id: 'new-spouse',
        seed: s.rng.getSeed(),
        age: 40,
        worldYear: 2040,
        youngChild: false,
        playerPay: 0,
      }),
    );
    const dead = {
      ...s,
      partnerCareers: first.careers,
      circle: { ...s.circle, people: s.circle.people.map((p) => ({ ...p, alive: false })) },
    };
    expect(partnerIncomeOf(dead).gross).toBe(0);
    expect(partnerIncomeOf({ ...dead, circle: { ...s.circle, people: [] } }).gross).toBe(0);
  });
  it('advances a real descendant without inheriting the deceased player’s spouse or career', () => {
    let dead: GameState | undefined;
    for (let seed = 0; seed < 30 && !dead; seed++) {
      let s = createNewGame({ seed: `veh-${seed}` });
      for (let n = 0; s.player.alive && n < 110; n++) s = answer(advanceYear(s).state);
      if (!s.player.alive && heirsIn(s.family).length && Object.keys(s.partnerCareers).length)
        dead = s;
    }
    expect(dead).toBeDefined();
    const heir = heirsIn(dead!.family)[0]!;
    const next = continueAsChild(dead!, heir.id)!;
    expect(next.partnerCareers).toEqual({});
    expect(partnerIncomeOf(next).gross).toBe(0);
    const advanced = advanceYear(next).state;
    expect(advanced.world.year).toBe(next.world.year + 1);
    expect(reconcile(advanced.finance).ok).toBe(true);
  });
});
