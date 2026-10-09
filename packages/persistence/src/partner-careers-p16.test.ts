import { describe, expect, it } from 'vitest';
import { asNpcId, asSaveId, clampStat, dollars } from '@yearafter/core';
import { legacyPartnerCareer, startPartnerCareer, partnerYear } from '@yearafter/careers';
import { post, reconcile } from '@yearafter/finance';
import { createNewGame, advanceYear, partnerIncomeOf } from '@yearafter/simulation';
import type { Acquaintance } from '@yearafter/social';
import { CURRENT_SAVE_VERSION } from './save-schema';
import { migrateSave } from './migrations';
import { fromSave, toSave } from './serialize';
const options = { id: asSaveId('p16-save'), createdAt: 0, updatedAt: 0 };
function fixture(age = 35, id = 'p16-save-person') {
  const s = createNewGame({ seed: 'p16-save', startYear: 2000 });
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
    metAtAge: age - 1,
    lastContactAge: age,
    memories: [],
    inRoom: true,
    romance: { stage: 'married', since: age - 1 },
  };
  const finance = post(s.finance, 2000 + age, age, {
    category: 'gift',
    amount: dollars(100000),
    source: 'Existing savings',
  }).ledger;
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2000 + age },
    player: { ...s.player, age, cash: finance.balance },
    finance,
    circle: { ...s.circle, people: [person] },
  };
}
describe('P16 save v51', () => {
  it.each([18, 21, 35, 70])(
    'migrates v50 at age %s without rewriting current income, cash, history or RNG',
    (age) => {
      const state = fixture(age);
      const save = toSave(state, options);
      const { partnerCareers: _future, ...rest } = save;
      const legacy = { ...rest, version: 50 };
      const serialized = JSON.stringify(legacy);
      const result = migrateSave(JSON.parse(serialized));
      if (!result.ok) throw Error(result.error.kind);
      expect(CURRENT_SAVE_VERSION).toBe(51);
      const { partnerCareers, ...preserved } = result.value;
      expect(preserved).toEqual({ ...legacy, version: 51 });
      expect(JSON.stringify(legacy)).toBe(serialized);
      const input = {
        id: 'p16-save-person',
        seed: state.rng.getSeed(),
        age,
        worldYear: 2000 + age,
        playerPay: 0,
        youngChild: false,
      };
      expect(partnerCareers['p16-save-person']).toEqual(legacyPartnerCareer(input));
      expect(partnerIncomeOf(fromSave(result.value)).year).toEqual(partnerYear(input));
      expect(partnerCareers['p16-save-person']!.jobSince).toBe(state.world.year);
      expect(reconcile(result.value.finance).ok).toBe(true);
      const next = advanceYear(fromSave(result.value)).state;
      expect(reconcile(next.finance).ok).toBe(true);
      if (age === 70) expect(partnerIncomeOf(next).year).toEqual(partnerYear(input));
    },
  );
  it('round-trips every saved career and deterministically resumes an annual year', () => {
    const state = fixture();
    const career = startPartnerCareer({
      id: 'p16-save-person',
      seed: state.rng.getSeed(),
      age: 35,
      worldYear: 2035,
      playerPay: 80000,
      youngChild: false,
    });
    const played = { ...state, partnerCareers: { 'p16-save-person': career } };
    const save = toSave(played, options);
    const migrated = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!migrated.ok) throw Error(migrated.error.kind);
    expect(migrated.value).toEqual(save);
    expect(fromSave(migrated.value).partnerCareers).toEqual(played.partnerCareers);
    expect(toSave(advanceYear(played).state, options)).toEqual(
      toSave(advanceYear(fromSave(migrated.value)).state, options),
    );
  });
  it.each(['seeing', 'dead', 'minor', 'absent'])(
    'does not invent a career for %s legacy people',
    (mode) => {
      const s = fixture();
      const people =
        mode === 'absent'
          ? []
          : s.circle.people.map((p) =>
              mode === 'seeing'
                ? { ...p, romance: { stage: 'seeing' as const, since: 34 } }
                : mode === 'dead'
                  ? { ...p, alive: false }
                  : { ...p, birthYear: 2025 },
            );
      const save = toSave({ ...s, circle: { ...s.circle, people } }, options);
      const { partnerCareers: _, ...rest } = save;
      const r = migrateSave({ ...rest, version: 50 });
      if (!r.ok) throw Error(r.error.kind);
      expect(r.value.partnerCareers).toEqual({});
    },
  );
  it.each([
    undefined,
    [],
    null,
    { 'p16-save-person': {} },
    { jobId: 'deleted-job' },
    { salary: NaN },
    { salary: -1 },
    { salary: 1.5 },
    { style: 'invented' },
    { credential: 'invented' },
    { license: 'wrong' },
    { year: 3000 },
    { jobSince: 3000 },
    { change: 'invented' },
    { last: { status: 'working', gross: 50000, net: 50000, tax: 0 } },
  ])('rejects malformed current career %j before annual processing', (bad) => {
    const s = fixture();
    const c = startPartnerCareer({
      id: 'p16-save-person',
      seed: s.rng.getSeed(),
      age: 35,
      worldYear: 2035,
      playerPay: 80000,
      youngChild: false,
    });
    const careers =
      bad === undefined || bad === null || Array.isArray(bad)
        ? bad
        : 'p16-save-person' in bad
          ? bad
          : { 'p16-save-person': { ...c, ...bad } };
    const r = migrateSave({ ...toSave(s, options), partnerCareers: careers });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('corrupt');
  });
});
