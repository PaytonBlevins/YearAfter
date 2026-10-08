import { expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame, takeGig, advanceYear } from '@yearafter/simulation';
import { toSave, fromSave } from './serialize';
import { migrateSave } from './migrations';
it('P6 saves and replays adult work with existing v45 ids and no new shape', () => {
  const b = createNewGame({ seed: 'p6-save' }),
    adult = {
      ...b,
      player: { ...b.player, age: 30 },
      education: { ...b.education, stage: 'graduated' as const },
    };
  const taken = takeGig(adult, 'gig.adult.repairs');
  if (!taken.ok) throw Error(taken.error);
  const options = { id: asSaveId('p6-save'), createdAt: 0, updatedAt: 0 },
    state = fromSave(toSave(taken.value, options)),
    saved = toSave(state, options);
  expect(saved.version).toBe(45);
  expect(saved.education.gigs).toEqual(['gig.adult.repairs']);
  expect(saved).not.toHaveProperty('shiftGross');
  expect(saved.education).not.toHaveProperty('hours');
  const migrated = migrateSave(JSON.parse(JSON.stringify(saved)));
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) throw Error('Invalid save');
  const loaded = fromSave(migrated.value);
  expect(toSave(loaded, options)).toEqual(saved);
  expect(toSave(advanceYear(loaded).state, options)).toEqual(
    toSave(advanceYear(state).state, options),
  );
});
it('P6 sanitizes malformed saved work ids without duplicate payouts or a crash', () => {
  const b = createNewGame({ seed: 'p6-stale-save' }),
    bad = {
      ...b,
      player: { ...b.player, age: 30 },
      education: {
        ...b.education,
        stage: 'graduated' as const,
        gigs: ['unknown', 'gig.adult.repairs', 'gig.adult.repairs', 'gig.retail'],
      },
    };
  const loaded = fromSave(toSave(bad, { id: asSaveId('p6-malformed') })),
    next = advanceYear(loaded).state;
  expect(next.education.gigs).toEqual(['gig.adult.repairs']);
  expect(
    next.finance.transactions.filter((t) => t.year === next.world.year && t.category === 'oddJob'),
  ).toHaveLength(1);
});
