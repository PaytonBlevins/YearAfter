/**
 * Ticket 0904 — the save, v62. A past service can end with a medical board or a court-martial, and its discharge is one
 * of five characters; each ending carries only the discharges the engine writes for it. The military state keeps the
 * months of GI Bill used. A v61 save comes forward with nothing changed but the version; a pair or a count the engine
 * could not have written is refused, not repaired.
 */

import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame } from '@yearafter/simulation';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
import { fromSave, toSave } from './serialize';

const PAST = {
  branch: 'army',
  enlistedAge: 19,
  endedAge: 27,
  years: 8,
  track: 'enlisted',
  specialty: 'army.infantry',
  finalGrade: 5,
  reputation: 70,
  how: 'term',
  discharge: 'honorable',
} as const;

const base = () => {
  const state = createNewGame({ seed: 'MIL-0904', startYear: 2000 });
  return toSave(state, { id: asSaveId('save-MIL-0904') });
};

const withMilitary = (military: unknown, version?: number) => {
  const raw = JSON.parse(JSON.stringify({ ...base(), military }));
  if (version !== undefined) raw.version = version;
  return raw;
};

describe('discharges and the GI Bill in a v62 save', () => {
  it('is at version 62', () => {
    expect(CURRENT_SAVE_VERSION).toBe(62);
    expect(base().version).toBe(62);
  });

  it('keeps every ending with the discharges that go with it, exactly', () => {
    const rows = [
      { ...PAST, how: 'washed-out', discharge: 'entry-level' },
      { ...PAST, how: 'term', discharge: 'general' },
      { ...PAST, how: 'term', discharge: 'honorable' },
      { ...PAST, how: 'not-retained', discharge: 'general' },
      { ...PAST, how: 'passed-over', discharge: 'general' },
      { ...PAST, how: 'retired', discharge: 'honorable' },
      { ...PAST, how: 'killed', discharge: 'honorable' },
      { ...PAST, how: 'medical', discharge: 'medical' },
      { ...PAST, how: 'misconduct', discharge: 'dishonorable' },
    ];
    const military = { past: rows, giBillMonthsUsed: 27 };
    const result = migrateSave(withMilitary(military));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.military).toEqual(military);
    const state = fromSave(result.value);
    expect(toSave(state, { id: asSaveId('save-MIL-0904') }).military).toEqual(military);
  });

  it('brings a v61 save forward with nothing changed but the version', () => {
    const v61 = {
      past: [
        { ...PAST, how: 'washed-out', discharge: 'entry-level' },
        { ...PAST, how: 'killed' },
        { ...PAST, how: 'retired' },
      ],
    };
    const result = migrateSave(withMilitary(v61, 61));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.value.military).toEqual(v61);
  });

  it('refuses an ending and a discharge that the engine does not pair', () => {
    const bad = [
      { ...PAST, how: 'washed-out', discharge: 'honorable' },
      { ...PAST, how: 'term', discharge: 'entry-level' },
      { ...PAST, how: 'term', discharge: 'medical' },
      { ...PAST, how: 'term', discharge: 'dishonorable' },
      { ...PAST, how: 'retired', discharge: 'general' },
      { ...PAST, how: 'killed', discharge: 'general' },
      { ...PAST, how: 'medical', discharge: 'honorable' },
      { ...PAST, how: 'medical', discharge: 'dishonorable' },
      { ...PAST, how: 'misconduct', discharge: 'honorable' },
      { ...PAST, how: 'misconduct', discharge: 'general' },
      { ...PAST, how: 'term', discharge: 'other-than-honorable' },
      { ...PAST, how: 'term', discharge: 4 },
      { ...PAST, how: 'term', discharge: undefined },
      { ...PAST, how: 'court-martialed', discharge: 'dishonorable' },
    ];
    for (const row of bad) {
      expect(migrateSave(withMilitary({ past: [row] })).ok, JSON.stringify(row)).toBe(false);
    }
  });

  it('refuses a count of GI Bill months the engine could not have written', () => {
    for (const giBillMonthsUsed of [-1, 37, 4.5, '9', null, true]) {
      const military = { past: [PAST], giBillMonthsUsed };
      expect(migrateSave(withMilitary(military)).ok, JSON.stringify(giBillMonthsUsed)).toBe(false);
    }
  });

  it('accepts the edges: no months used, every month used', () => {
    for (const giBillMonthsUsed of [0, 36]) {
      const military = { past: [PAST], giBillMonthsUsed };
      expect(migrateSave(withMilitary(military)).ok, String(giBillMonthsUsed)).toBe(true);
    }
  });
});
