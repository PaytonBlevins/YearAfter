import { afterEach, describe, expect, it, vi } from 'vitest';
import { dollars } from '@yearafter/core';
import { post, reconcile, totalFor } from '@yearafter/finance';
import { taxRate } from '@yearafter/careers';
import { GIGS, findGig } from '@yearafter/content';
import { gigPay } from '@yearafter/education';
import {
  advanceYear,
  createNewGame,
  takeGig,
  quitGig,
  gigIncome,
  earnedOf,
  businessTaxOn,
  type GameState,
} from './index';
import * as business from './businesses';
import * as dealPhase from './deals';
import * as living from './phases/living';
import { runEducation } from './phases/education';
function fixture(age = 30): GameState {
  const b = createNewGame({ seed: 'p6-integration' });
  const books = post(b.finance, b.world.year, age, {
    category: 'gift',
    amount: dollars(100_000),
    source: 'Test funding',
  }).ledger;
  return {
    ...b,
    finance: books,
    player: { ...b.player, age, cash: books.balance },
    education: {
      ...b.education,
      stage: 'graduated',
      gradeLevel: 12,
      credentials: { highSchool: 18 },
    },
  };
}
const take = (s: GameState, id: string) => {
  const r = takeGig(s, id);
  if (!r.ok) throw Error(r.error);
  return r.value;
};
afterEach(() => vi.restoreAllMocks());
describe('P6 work commands and annual income', () => {
  it('refuses direct underage/unknown work without spending RNG or cash', () => {
    const s = fixture(17),
      snapshot = s.rng.snapshot();
    expect(takeGig(s, 'gig.adult.repairs')).toEqual({ ok: false, error: 'too-young' });
    expect(takeGig(s, 'unknown')).toEqual({ ok: false, error: 'no-such-gig' });
    expect(s.rng.snapshot()).toEqual(snapshot);
    expect(s.education.gigs).toEqual([]);
  });
  it('accepts a third commitment, prevents duplicate take and quits only the chosen work', () => {
    const s = take(
      take(take(fixture(), 'gig.adult.repairs'), 'gig.adult.pet-care'),
      'gig.adult.art',
    );
    expect(s.education.gigs).toHaveLength(3);
    expect(takeGig(s, 'gig.adult.repairs')).toEqual({ ok: false, error: 'already-in-it' });
    expect(quitGig(s, 'gig.adult.repairs').education.gigs).toEqual([
      'gig.adult.pet-care',
      'gig.adult.art',
    ]);
    expect(quitGig(s, 'missing')).toBe(s);
  });
  it('posts one source-named payout and one tax, reconciles and counts it as earned income', () => {
    const s = take(fixture(), 'gig.adult.repairs'),
      phase = runEducation(s, 31);
    const gross = phase.freelanceGross;
    expect(gross).toBeGreaterThan(3000);
    expect(phase.shiftGross).toBe(0);
    const next = advanceYear(s).state;
    const rows = next.finance.transactions.filter((t) => t.year === next.world.year);
    expect(rows.filter((t) => t.category === 'oddJob')).toHaveLength(1);
    expect(Number(totalFor(next.finance, 'oddJob', next.world.year))).toBe(gross * 100);
    const tax = rows.filter((t) => t.source === 'Tax on part-time and odd-job income');
    expect(tax).toHaveLength(1);
    expect(Number(tax[0]?.amount)).toBe(-businessTaxOn(0, gross) * 100);
    expect(earnedOf(next)).toBe(gross);
    expect(next.player.cash).toBe(next.finance.balance);
    expect(reconcile(next.finance).ok).toBe(true);
    expect(next.player.timeline.some((t) => t.text.includes(gross.toLocaleString('en-US')))).toBe(
      true,
    );
  });
  it('passes actual net/gross work income to the real annual living phase', () => {
    const s = take(fixture(), 'gig.adult.repairs'),
      phase = runEducation(s, 31),
      spy = vi.spyOn(living, 'runLiving');
    advanceYear(s);
    const input = spy.mock.calls[0]?.[0];
    expect(input?.afterTaxIncome).toBe(
      phase.freelanceGross - businessTaxOn(0, phase.freelanceGross),
    );
    expect(input?.earned).toBe(phase.freelanceGross);
  });
  it('includes side income in subsequent business, creator and private-deal tax bases', () => {
    const s = take(fixture(), 'gig.adult.repairs'),
      gross = runEducation(s, 31).freelanceGross;
    const tax = vi.spyOn(business, 'businessTaxOn'),
      deals = vi.spyOn(dealPhase, 'runDealsYear');
    advanceYear(s);
    expect(tax.mock.calls.filter(([base, draw]) => base === gross && draw === 0).length).toBe(2);
    expect(deals.mock.calls[0]?.[0].otherIncome).toBe(gross);
  });
  it('keeps under-18 shift income untaxed and pays the following graduation year', () => {
    const b = fixture(16);
    const s = take(
      { ...b, education: { ...b.education, stage: 'high', gradeLevel: 11 } },
      'gig.retail',
    );
    const one = advanceYear(s).state;
    expect(Number(totalFor(one.finance, 'oddJob', one.world.year))).toBeGreaterThan(600_000);
    expect(
      one.finance.transactions.filter(
        (t) => t.year === one.world.year && t.source === 'Tax on part-time and odd-job income',
      ),
    ).toEqual([]);
    const two = advanceYear({ ...one, pending: [] }).state;
    expect(two.education.stage).toBe('graduated');
    expect(Number(totalFor(two.finance, 'oddJob', two.world.year))).toBeGreaterThan(600_000);
    expect(two.education.gigs).toContain('gig.retail');
    expect(reconcile(two.finance).ok).toBe(true);
  });
  it.each([30, 70])('side work produces real stress at age %i, without a menu cap', (age) => {
    const plain = fixture(age),
      busy = GIGS.filter((g) => g.id.startsWith('gig.adult.')).reduce(
        (s, g) => take(s, g.id),
        fixture(age),
      );
    const a = advanceYear(plain).state,
      b = advanceYear(busy).state;
    expect(b.player.stress.level - a.player.stress.level).toBeGreaterThan(15);
    expect(b.education.gigs).toHaveLength(6);
    expect(reconcile(b.finance).ok).toBe(true);
  });
  it("quitting stops next year's payout without undoing past earnings", () => {
    const next = advanceYear(take(fixture(), 'gig.adult.repairs')).state;
    const stopped = quitGig({ ...next, pending: [] }, 'gig.adult.repairs');
    const again = advanceYear(stopped).state;
    expect(Number(totalFor(again.finance, 'oddJob', again.world.year))).toBe(0);
    expect(Number(totalFor(again.finance, 'oddJob', next.world.year))).toBeGreaterThan(0);
  });
  it('keeps adult freelance pay based on the character and existing talent premium', () => {
    const s = fixture(),
      g = findGig('gig.adult.tutoring');
    if (!g) throw Error('Missing tutor');
    const untalented = gigPay(g, s.player.stats, { ...s.player.talents, academics: false });
    expect(gigPay(g, s.player.stats, { ...s.player.talents, academics: true })).toBe(
      Math.round(untalented * 1.35),
    );
  });
});
describe('P6 current tax stack', () => {
  it('preserves under-18 tax treatment and does not tax an empty side-work year', () => {
    expect(gigIncome(17, 0, 9000, 4000)).toEqual({
      gross: 13000,
      tax: 0,
      net: 13000,
      taxableGross: 0,
    });
    expect(gigIncome(30, 50_000, 0, 0)).toEqual({ gross: 0, tax: 0, net: 0, taxableGross: 0 });
  });
  it('taxes shifts on top of wages with no self-employment premium', () => {
    const wage = 50_000,
      gross = 9000;
    const expected =
      Math.round((wage + gross) * taxRate(wage + gross)) - Math.round(wage * taxRate(wage));
    expect(gigIncome(18, wage, gross, 0)).toEqual({
      gross,
      tax: expected,
      net: gross - expected,
      taxableGross: gross,
    });
  });
  it('stacks freelance after shifts, with the existing self-employment premium', () => {
    const shifts = gigIncome(30, 50_000, 9000, 0),
      combined = gigIncome(30, 50_000, 9000, 7000);
    expect(combined.tax - shifts.tax).toBe(businessTaxOn(59_000, 7000));
    expect(combined.net).toBe(16_000 - combined.tax);
    expect(combined.taxableGross).toBe(16_000);
  });
});
