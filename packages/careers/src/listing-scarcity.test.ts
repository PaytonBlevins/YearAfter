import { expect, it, vi } from 'vitest';
import type { Job } from './jobs';
vi.mock('./jobs', async () => {
  const real = await vi.importActual<typeof import('./jobs')>('./jobs');
  const first = real.ALL_JOBS[0];
  if (!first) throw new Error('Empty catalog');
  const small: Job[] = [
    {
      ...first,
      id: 'small-a' as Job['id'],
      track: 'creative',
      minAge: 16,
      rung: 0,
      requires: 'none',
      prefers: 'none',
      license: undefined,
      pay: 20_000,
    },
    {
      ...first,
      id: 'small-b' as Job['id'],
      track: 'retail',
      minAge: 16,
      rung: 0,
      requires: 'none',
      prefers: 'none',
      license: undefined,
      pay: 22_000,
    },
  ];
  return { ...real, ALL_JOBS: small };
});
import { openingsFor, type OpeningsContext } from './openings';
import { listingChanceFloors } from './listing-exposure';
const context: OpeningsContext = {
  age: 18,
  education: 'highSchool',
  reached: {},
  experience: 0,
  standing: {},
  licenses: [],
  opens: ['creative'],
};
it('P5 shows the whole scarce pool without padding or duplicates', () => {
  expect(openingsFor(context, () => 0.99).map((j) => String(j.id))).toEqual(['small-a', 'small-b']);
  expect([...listingChanceFloors(context).values()]).toEqual([1, 1]);
});
it('P5 keeps a held job out even when only one other row exists', () => {
  const held = { ...context, currentJobId: 'small-a' };
  expect(openingsFor(held, () => 0.99).map((j) => String(j.id))).toEqual(['small-b']);
  expect([...listingChanceFloors(held)]).toEqual([['small-b', 1]]);
});
