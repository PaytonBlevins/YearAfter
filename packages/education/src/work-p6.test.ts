import { describe, expect, it } from 'vitest';
import { createStats, createTalents, createPersonality } from '@yearafter/character';
import { GIGS, findGig } from '@yearafter/content';
import { NOT_YET_ENROLLED, type EducationState } from './school';
import { gigOffers, gigPay, gigUnavailable } from './gigs';
import { runGigs, runSchoolYear } from './progression';
import { EMPTY_HOUSEHOLD } from '@yearafter/relationships';
const stats = createStats({ smarts: 65, discipline: 60, willpower: 60 });
const talents = createTalents();
const input = (age: number) => ({
  age,
  stats,
  talents,
  personality: createPersonality(),
  wealth: 'comfortable' as const,
  cash: 100_000,
  roll: 1,
});
const state = (over: Partial<EducationState> = {}): EducationState => ({
  ...NOT_YET_ENROLLED,
  stage: 'high',
  gradeLevel: 11,
  performance: 70 as EducationState['performance'],
  gigs: ['gig.retail'],
  ...over,
});
const family = EMPTY_HOUSEHOLD;

const adultIds = [
  'gig.adult.pet-care',
  'gig.adult.yard-work',
  'gig.adult.babysitting',
  'gig.adult.tutoring',
  'gig.adult.art',
  'gig.adult.repairs',
];
describe('P6 chosen work throughout life', () => {
  it('offers all six adult jobs without a parent or an upper-age cutoff', () => {
    for (const age of [18, 23, 65, 100, 140, 1000]) {
      const offers = gigOffers({ age, household: family, held: [] });
      expect(
        offers
          .filter((o) => adultIds.includes(o.gig.id) && !o.unavailable)
          .map((o) => o.gig.id)
          .sort(),
      ).toEqual(adultIds.slice().sort());
    }
    for (const id of adultIds) expect(findGig(id)?.ageMax).toBeUndefined();
  });
  it("keeps all adult work off a child's menu and rejects direct underage attempts", () => {
    const context = { age: 17, household: family, held: [] };
    expect(gigOffers(context).some((o) => adultIds.includes(o.gig.id))).toBe(false);
    for (const id of adultIds) {
      const gig = findGig(id);
      if (!gig) throw Error(id);
      expect(gigUnavailable(gig, context)).toBe('too-young');
    }
  });
  it('lets a third shift through while keeping duplicate and age gates', () => {
    const gig = findGig('gig.food');
    if (!gig) throw Error('Missing food');
    expect(
      gigUnavailable(gig, { age: 16, household: family, held: ['gig.retail', 'gig.lawns'] }),
    ).toBeUndefined();
    expect(gigUnavailable(gig, { age: 16, household: family, held: ['gig.food'] })).toBe(
      'already-in-it',
    );
    expect(gigUnavailable(gig, { age: 23, household: family, held: [] })).toBe('too-old');
  });
  it('pins approved adult hours and ranges without changing child pay', () => {
    const expected = [
      [4, 1500, 6000],
      [5, 2000, 7000],
      [6, 2500, 9000],
      [4, 2500, 10000],
      [4, 1500, 8000],
      [6, 3000, 12000],
    ];
    expect(
      adultIds.map((id) => {
        const g = findGig(id);
        return [g?.hoursPerWeek, g?.payLow, g?.payHigh];
      }),
    ).toEqual(expected);
    expect(findGig('gig.lemonade')?.payLow).toBe(12);
    expect(findGig('gig.lemonade')?.payHigh).toBe(45);
  });
  it('identifies four real shifts and the approved regular-shift pay', () => {
    expect(GIGS.filter((g) => g.kind === 'partTime').map((g) => g.id)).toEqual([
      'gig.retail',
      'gig.food',
      'gig.lifeguard',
      'gig.camp',
    ]);
    expect([findGig('gig.retail')?.payLow, findGig('gig.retail')?.payHigh]).toEqual([6000, 10000]);
    expect([findGig('gig.food')?.payLow, findGig('gig.food')?.payHigh]).toEqual([7000, 12000]);
  });
  it.each([
    ['high', 17, 11],
    ['high', 18, 12],
    ['graduated', 21, 12],
    ['droppedOut', 17, 11],
    ['college', 21, 12],
    ['vocational', 21, 12],
    ['postgrad', 21, 12],
  ] as const)(
    'pays exactly once in %s at %i and retains the paid hours',
    (stage, age, gradeLevel) => {
      const result = runSchoolYear(
        state({
          stage,
          gradeLevel,
          majorId:
            stage === 'vocational'
              ? 'voc.electrical'
              : stage === 'postgrad'
                ? 'grad.md'
                : 'major.nursing',
          credentials: { highSchool: 18, university: 20 },
        }),
        input(age),
      );
      const retail = findGig('gig.retail');
      if (!retail) throw Error('Missing retail');
      expect(result.earned).toHaveLength(1);
      expect(result.earned[0]).toEqual({
        dollars: gigPay(retail, stats, talents),
        source: 'weekend shifts',
        kind: 'partTime',
      });
      expect(result.hours).toBeGreaterThanOrEqual(12);
      expect(result.capacity).toBeGreaterThan(0);
      expect(result.lines.filter((line) => line.text.includes('$'))).toHaveLength(1);
      expect(result.state.gigs).toContain('gig.retail');
      if (['college', 'vocational', 'postgrad'].includes(stage)) expect(result.hours).toBe(28);
      if (stage === 'high' && gradeLevel === 12) expect(result.state.stage).toBe('graduated');
    },
  );
  it('pays and counts the last worked year before removing an age-limited shift', () => {
    const result = runSchoolYear(state({ stage: 'graduated' }), input(23));
    expect(result.earned).toHaveLength(1);
    expect(result.hours).toBe(12);
    expect(result.state.gigs).toEqual([]);
    expect(runSchoolYear(result.state, input(24)).earned).toEqual([]);
  });
  it('rejects stale, unknown, underage and duplicate held ids during settlement', () => {
    expect(runGigs(state({ gigs: ['gig.adult.repairs'] }), 17, stats, talents).earned).toEqual([]);
    expect(runGigs(state({ gigs: ['gig.retail'] }), 24, stats, talents).earned).toEqual([]);
    const paid = runGigs(
      state({ gigs: ['unknown', 'gig.adult.repairs', 'gig.adult.repairs'] }),
      30,
      stats,
      talents,
    );
    expect(paid.earned).toHaveLength(1);
    expect(paid.hours).toBe(6);
    expect(paid.state.gigs).toEqual(['gig.adult.repairs']);
  });
  it('keeps school overload consequential after removing the cap', () => {
    const quiet = runSchoolYear(state({ gigs: [] }), input(17));
    const busy = runSchoolYear(state({ gigs: ['gig.retail', 'gig.food', 'gig.camp'] }), input(17));
    expect(busy.state.performance).toBeLessThan(quiet.state.performance);
    expect(busy.hiddenLoad).toBeGreaterThan(0);
    expect(busy.statDeltas.health).toBeLessThan(0);
    expect(busy.hours - quiet.hours).toBe(46);
  });
  it('uses existing overload penalties in college, without charging hours twice', () => {
    const base = state({ stage: 'college', gigs: [], majorId: 'major.nursing' });
    const quiet = runSchoolYear(base, input(21));
    const busy = runSchoolYear({ ...base, gigs: ['gig.retail', 'gig.food'] }, input(21));
    expect(busy.hours).toBe(42);
    expect(busy.earned).toHaveLength(2);
    expect(quiet.state.performance - busy.state.performance).toBeGreaterThanOrEqual(5);
    expect(busy.hiddenLoad).toBeGreaterThan(0);
  });
});
