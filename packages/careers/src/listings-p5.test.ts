import { describe, expect, it } from 'vitest';
import { MAJORS, LICENSES } from '@yearafter/education';
import { mixedUnit } from '@yearafter/core';
import {
  ALL_JOBS,
  LISTINGS,
  STUDY_LISTINGS,
  cannotApply,
  fitsStudy,
  listingWeight,
  listingChanceFloors,
  openingsFor,
  type OpeningsContext,
} from './index';

const door = (over: Partial<OpeningsContext> = {}): OpeningsContext => ({
  age: 30,
  education: 'university',
  reached: {},
  experience: 0,
  standing: {},
  licenses: [],
  ...over,
});
const eligible = (context: OpeningsContext) =>
  ALL_JOBS.filter((j) => cannotApply(j, context) === undefined);
const hostile = (context: OpeningsContext) =>
  openingsFor(context, (j) => (fitsStudy(context, j) ? 0.99 : 0.001));

describe('P5 twelve curated listings', () => {
  it('shows twelve actual choices, independently of the exported count', () => {
    expect(LISTINGS).toBe(12);
    expect(STUDY_LISTINGS).toBe(2);
    const context = door();
    expect(eligible(context).length).toBeGreaterThan(12);
    const shown = openingsFor(context, (j) => mixedUnit(String(j.id)));
    expect(shown).toHaveLength(12);
    expect(new Set(shown.map((j) => String(j.id))).size).toBe(12);
    expect(shown.map((j) => j.pay)).toEqual(shown.map((j) => j.pay).sort((a, b) => a - b));
    for (const j of shown) expect(cannotApply(j, context)).toBeUndefined();
  });
  it('reserves two study matches even when every general draw beats them', () => {
    const context = door({ opens: ['creative', 'sales'] });
    expect(eligible(context).filter((j) => fitsStudy(context, j)).length).toBeGreaterThan(2);
    const shown = hostile(context);
    expect(shown.filter((j) => fitsStudy(context, j))).toHaveLength(2);
    expect(shown.filter((j) => !fitsStudy(context, j))).toHaveLength(10);
    expect(new Set(shown.map((j) => String(j.id))).size).toBe(12);
  });
  it('keeps matching winners unique when they also lead the general draw', () => {
    const context = door({ opens: ['creative', 'sales'] });
    const shown = openingsFor(context, (j) => (fitsStudy(context, j) ? 0 : 0.99));
    expect(shown).toHaveLength(12);
    expect(new Set(shown.map((j) => String(j.id))).size).toBe(12);
    expect(shown.filter((j) => fitsStudy(context, j)).length).toBeGreaterThanOrEqual(2);
  });
  it('keeps every program visible under hostile draws without inventing eligibility', () => {
    for (const major of MAJORS) {
      const context = door({
        education:
          major.kind === 'graduate'
            ? 'postgraduate'
            : major.kind === 'undergraduate'
              ? 'university'
              : 'highSchool',
        licenses: major.grants ? [major.grants] : [],
        opens: major.opens,
      });
      const matches = eligible(context).filter((j) => fitsStudy(context, j));
      const shown = hostile(context);
      expect(shown.filter((j) => fitsStudy(context, j)).length, major.name).toBe(
        Math.min(2, matches.length),
      );
      expect(shown.length, major.name).toBe(Math.min(12, eligible(context).length));
      for (const j of shown) expect(cannotApply(j, context), major.name).toBeUndefined();
    }
  });
  it('reserves held training without a major or a university degree', () => {
    const context = door({ education: 'highSchool', licenses: ['lic.electrical'] });
    expect(hostile(context).filter((j) => j.track === 'trades')).toHaveLength(2);
  });
  it('recognizes every held license, not only the newest or the first', () => {
    const context = door({ licenses: ['lic.electrical', 'lic.lpn'] });
    const care = ALL_JOBS.find((j) => j.track === 'care');
    const trades = ALL_JOBS.find((j) => j.track === 'trades');
    if (!care || !trades) throw new Error('Missing training tracks');
    expect(fitsStudy(context, care)).toBe(true);
    expect(fitsStudy(context, trades)).toBe(true);
    expect(hostile(context).filter((j) => fitsStudy(context, j))).toHaveLength(2);
  });
  it('shows the one architecture match and fills eleven other places', () => {
    const context = door({ opens: ['architecture'] });
    expect(
      eligible(context)
        .filter((j) => j.track === 'architecture')
        .map((j) => j.title),
    ).toEqual(['Architectural drafter']);
    const shown = hostile(context);
    expect(shown.filter((j) => j.track === 'architecture').map((j) => j.title)).toEqual([
      'Architectural drafter',
    ]);
    expect(shown).toHaveLength(12);
    expect(shown.filter((j) => j.track !== 'architecture')).toHaveLength(11);
    expect(shown.some((j) => j.title === 'Junior designer')).toBe(false);
  });
  it('fills the board when the only match is the job already held', () => {
    const context = door({ opens: ['architecture'], currentJobId: 'job.architecture.drafter' });
    const shown = hostile(context);
    expect(shown).toHaveLength(12);
    expect(shown.some((j) => j.track === 'architecture')).toBe(false);
    expect(shown.some((j) => String(j.id) === context.currentJobId)).toBe(false);
  });
  it('does not reserve from unrelated or unknown studies and licenses', () => {
    const a = door();
    const b = door({ opens: ['not-a-track'], licenses: ['not-a-license'] });
    const draw = (j: (typeof ALL_JOBS)[number]) => mixedUnit(String(j.id));
    expect(openingsFor(b, draw)).toEqual(openingsFor(a, draw));
  });
  it('keeps weights inside the reserved draw instead of always picking catalog-first', () => {
    const context = door({ opens: ['trades'], reached: { trades: 1 }, standing: { trades: 50 } });
    const matches = eligible(context).filter((j) => j.track === 'trades');
    const best = matches
      .slice()
      .sort((a, b) => listingWeight(context, b) - listingWeight(context, a))
      .slice(0, 2);
    const shown = openingsFor(context, (j) => (j.track === 'trades' ? 0.5 : 0.001));
    expect(
      shown
        .filter((j) => j.track === 'trades')
        .map((j) => String(j.id))
        .sort(),
    ).toEqual(best.map((j) => String(j.id)).sort());
    expect(best.some((j) => j.rung > 1)).toBe(true);
  });
  it('refreshes matching choices across years', () => {
    const context = door({ opens: ['creative', 'sales'] });
    const seen = new Set<string>();
    for (let y = 0; y < 50; y++)
      for (const j of openingsFor(context, (j) => mixedUnit(`${y}:${String(j.id)}`))) {
        if (fitsStudy(context, j)) seen.add(String(j.id));
      }
    expect(seen.size).toBeGreaterThan(2);
  });
  it('never lets studies bypass age, education, license or reach', () => {
    const context = door({
      age: 16,
      education: 'none',
      opens: ['medicine', 'architecture'],
      experience: 40,
    });
    const shown = hostile(context);
    expect(shown.length).toBeGreaterThan(0);
    for (const j of shown) expect(cannotApply(j, context)).toBeUndefined();
    expect(shown.some((j) => j.license !== undefined)).toBe(false);
    expect(shown.some((j) => j.requires !== 'none')).toBe(false);
    expect(shown.some((j) => j.rung >= 2)).toBe(false);
  });
  it('the eligibility command itself refuses a child before other gates', () => {
    const context = door({
      age: 15,
      education: 'postgraduate',
      licenses: LICENSES.map((l) => l.id),
      reached: Object.fromEntries(ALL_JOBS.map((j) => [j.track, 3])),
    });
    for (const job of ALL_JOBS) expect(cannotApply(job, context), job.title).toBe('too-young');
  });
  it('honors literal job minimum ages even with every degree and license', () => {
    const context = door({
      age: 16,
      education: 'postgraduate',
      opens: ['medicine'],
      licenses: LICENSES.map((l) => l.id),
      reached: Object.fromEntries(ALL_JOBS.map((j) => [j.track, 3])),
    });
    const shown = hostile(context);
    expect(shown.length).toBeGreaterThan(0);
    for (const job of shown) expect(job.minAge, job.title).toBeLessThanOrEqual(16);
  });
  it('does not draw at all below working age', () => {
    let calls = 0;
    expect(
      openingsFor(door({ age: 15 }), () => {
        calls++;
        return 0;
      }),
    ).toEqual([]);
    expect(calls).toBe(0);
  });
  it('lets every eligible job win a general or matching place', () => {
    const context = door({
      education: 'postgraduate',
      experience: 30,
      opens: ['creative'],
      licenses: LICENSES.map((l) => l.id),
      reached: Object.fromEntries(ALL_JOBS.map((j) => [j.track, 3])),
    });
    expect(eligible(context).length).toBeGreaterThan(100);
    for (const target of eligible(context)) {
      const shown = openingsFor(context, (j) => (j.id === target.id ? 0 : 0.99));
      expect(
        shown.some((j) => j.id === target.id),
        target.title,
      ).toBe(true);
    }
  });
});

describe('P5 conservative starvation exposure', () => {
  it('gives the sole matching job a certain reserved place', () => {
    const chances = listingChanceFloors(door({ opens: ['architecture'] }));
    expect(chances.get('job.architecture.drafter')).toBe(1);
  });
  it('gives both matches certainty when they exactly fill the reserved quota', () => {
    const context = door({ opens: ['architecture'], experience: 10 });
    const matches = eligible(context).filter((j) => j.track === 'architecture');
    expect(matches).toHaveLength(2);
    const chances = listingChanceFloors(context);
    for (const job of matches) expect(chances.get(String(job.id))).toBe(1);
  });
  it('accounts for the general slots displaced by reservations', () => {
    const plain = door();
    const trained = door({ opens: ['creative'] });
    const before = listingChanceFloors(plain),
      after = listingChanceFloors(trained);
    const unrelated = eligible(trained).filter((j) => !fitsStudy(trained, j));
    expect(unrelated.length).toBeGreaterThan(12);
    for (const job of unrelated) {
      expect(after.get(String(job.id))).toBeLessThan(before.get(String(job.id)) ?? 0);
    }
  });
  it('returns only positive bounded chances for eligible jobs', () => {
    const context = door({ opens: ['creative'] });
    const chances = listingChanceFloors(context);
    expect([...chances.keys()].sort()).toEqual(
      eligible(context)
        .map((j) => String(j.id))
        .sort(),
    );
    for (const chance of chances.values()) {
      expect(chance).toBeGreaterThan(0);
      expect(chance).toBeLessThanOrEqual(1);
    }
    expect(listingChanceFloors(door({ age: 15 })).size).toBe(0);
  });
  it('does not overstate observed inclusion in either pool', () => {
    const context = door({ opens: ['creative'], experience: 10 });
    const chances = listingChanceFloors(context);
    const counts = new Map<string, number>();
    const trials = 4_000;
    for (let y = 0; y < trials; y++)
      for (const j of openingsFor(context, (j) => mixedUnit(`exposure:${y}:${String(j.id)}`))) {
        counts.set(String(j.id), (counts.get(String(j.id)) ?? 0) + 1);
      }
    for (const [id, floor] of chances)
      expect((counts.get(id) ?? 0) / trials, id).toBeGreaterThanOrEqual(floor - 0.025);
  });
});
