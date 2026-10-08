import { CURRENT_SAVE_VERSION } from './save-schema';
import { expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame, openings, atTheDoor, advanceYear } from '@yearafter/simulation';
import { fitsStudy } from '@yearafter/careers';
import { MAJORS } from '@yearafter/education';
import { fromSave, toSave } from './serialize';
import { migrateSave } from './migrations';

it('P5 reconstructs twelve matched listings from v45 without saving a board or shifting RNG', () => {
  const base = createNewGame({ seed: 'p5-save' });
  const major = MAJORS.find((m) => m.kind === 'undergraduate' && m.opens.includes('creative'));
  if (!major) throw new Error('Missing major');
  const fixture = {
    ...base,
    player: { ...base.player, age: 30 },
    education: {
      ...base.education,
      stage: 'graduated' as const,
      majorId: major.id,
      credentials: { highSchool: 18, university: 22, licenses: ['lic.electrical'] },
    },
  };
  const options = { id: asSaveId('p5-save'), createdAt: 0, updatedAt: 0 };
  // Normalize RNG words through the existing loader before comparing bytes:
  // new-game streams can hold signed words; loaded snapshots use unsigned words.
  const state = fromSave(toSave(fixture, options));
  const before = toSave(state, options);
  expect(before.version).toBe(CURRENT_SAVE_VERSION);
  const board = openings(state);
  expect(board).toHaveLength(12);
  expect(board.filter((j) => fitsStudy(atTheDoor(state), j)).length).toBeGreaterThanOrEqual(2);
  expect(toSave(state, options)).toEqual(before);
  expect(before).not.toHaveProperty('openings');
  expect(before.education).not.toHaveProperty('opens');
  const migrated = migrateSave(JSON.parse(JSON.stringify(before)));
  expect(migrated.ok).toBe(true);
  if (!migrated.ok) throw new Error('Invalid fixture');
  const loaded = fromSave(migrated.value);
  expect(loaded.education).toEqual(state.education);
  expect(openings(loaded)).toEqual(board);
  expect(toSave(loaded, options)).toEqual(before);
  const a = advanceYear(state).state;
  const b = advanceYear(loaded).state;
  expect(openings(b)).toEqual(openings(a));
  expect(toSave(b, options)).toEqual(toSave(a, options));
});
