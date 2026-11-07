/**
 * Ticket 0905 — the save, v63. A life can hold a clearance (three levels, with the age it was granted and since when it has
 * been idle), an agency career (the FBI's or the CIA's, on the General Schedule's grades 9 to 15), the careers that
 * ended and how, a mission waiting and the missions done. A v62 save comes forward with an empty intelligence state and
 * nothing else changed; a value the engine could not have written is refused, not repaired.
 */

import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame } from '@yearafter/simulation';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
import { fromSave, toSave } from './serialize';

const CAREER = {
  agency: 'fbi',
  stage: 'serving',
  enteredAge: 27,
  grade: 12,
  gradeYears: 1,
  years: 5,
  performance: 62,
  reputation: 58,
  effort: 'hard',
  pushedAtAge: 31,
  pushedThisYear: 1,
  lastPay: 128_000,
  post: 'the Harlow field office',
  door: 'service',
  poorYears: 0,
  highPay: [128_000, 124_000, 120_000],
} as const;

const PAST = {
  agency: 'cia',
  enteredAge: 25,
  endedAge: 40,
  years: 15,
  finalGrade: 13,
  reputation: 66,
  how: 'resigned',
  pension: 0,
} as const;

const base = () => {
  const state = createNewGame({ seed: 'INTEL-0905', startYear: 2000 });
  return toSave(state, { id: asSaveId('save-INTEL-0905') });
};

const withIntel = (intel: unknown, version?: number) => {
  const raw = JSON.parse(JSON.stringify({ ...base(), intel }));
  if (version !== undefined) raw.version = version;
  return raw;
};

const refused = (intel: unknown): boolean => !migrateSave(withIntel(intel)).ok;

describe('intelligence in a v63 save', () => {
  it('is at version 63 or later, with an empty intelligence state for a life that has none', () => {
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(63);
    expect(base().version).toBe(CURRENT_SAVE_VERSION);
    expect(base().intel).toEqual({ past: [] });
  });

  it('keeps a whole intelligence life exactly, through a save and a load', () => {
    const intel = {
      clearance: { level: 'top-secret', grantedAge: 26, idleSince: 40 },
      revokedAge: 33,
      deniedAge: 24,
      career: CAREER,
      past: [PAST, { ...PAST, how: 'retired', pension: 61_000 }, { ...PAST, how: 'killed' }],
      appliedAge: 26,
      missionsOpen: true,
      mission: { source: 'fbi', age: 31 },
      missions: [
        { age: 29, source: 'military', outcome: 'clean' },
        { age: 30, source: 'fbi', outcome: 'disaster' },
      ],
    };
    const result = migrateSave(withIntel(intel));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.intel).toEqual(intel);
    const state = fromSave(result.value);
    expect(state.intel).toEqual(intel);
    expect(toSave(state, { id: asSaveId('save-INTEL-0905') }).intel).toEqual(intel);
  });

  it('brings a v62 save forward with an empty intelligence state and nothing else changed', () => {
    const v62 = JSON.parse(JSON.stringify(base()));
    delete v62.intel;
    v62.version = 62;
    const result = migrateSave(v62);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.value.intel).toEqual({ past: [] });
    expect(result.value.military).toEqual(v62.military);
    expect(result.value.player).toEqual(v62.player);
  });

  it('keeps an intelligence state a v62 save somehow already had', () => {
    const v62 = JSON.parse(JSON.stringify(base()));
    v62.intel = { past: [PAST] };
    v62.version = 62;
    const result = migrateSave(v62);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.intel).toEqual({ past: [PAST] });
  });

  it('refuses a save with no intelligence field at the current version', () => {
    const raw = JSON.parse(JSON.stringify(base()));
    delete raw.intel;
    expect(migrateSave(raw).ok).toBe(false);
  });

  it('refuses an intelligence value that is not an object', () => {
    for (const bad of [null, 3, 'x', [], true]) {
      expect(migrateSave(withIntel(bad)).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('refuses a clearance that is not one of the three levels, or has a bad age', () => {
    expect(refused({ past: [], clearance: { level: 'cosmic', grantedAge: 20 } })).toBe(true);
    expect(refused({ past: [], clearance: { level: 'secret', grantedAge: -1 } })).toBe(true);
    expect(refused({ past: [], clearance: { level: 'secret', grantedAge: 20.5 } })).toBe(true);
    expect(
      refused({ past: [], clearance: { level: 'secret', grantedAge: 20, idleSince: 'x' } }),
    ).toBe(true);
    expect(refused({ past: [], clearance: 'secret' })).toBe(true);
    for (const level of ['confidential', 'secret', 'top-secret']) {
      expect(refused({ past: [], clearance: { level, grantedAge: 20 } })).toBe(false);
    }
  });

  it('refuses a career the engine could not have written', () => {
    const bad: unknown[] = [
      { ...CAREER, agency: 'nsa' },
      { ...CAREER, stage: 'retired' },
      { ...CAREER, grade: 8 },
      { ...CAREER, grade: 16 },
      { ...CAREER, grade: 12.5 },
      { ...CAREER, gradeYears: -1 },
      { ...CAREER, years: 1.5 },
      { ...CAREER, performance: 101 },
      { ...CAREER, reputation: -1 },
      { ...CAREER, effort: 'lazy' },
      { ...CAREER, pushedAtAge: 'x' },
      { ...CAREER, lastPay: -5 },
      { ...CAREER, post: 3 },
      { ...CAREER, door: 'window' },
      { ...CAREER, poorYears: -1 },
      { ...CAREER, highPay: 'lots' },
      { ...CAREER, highPay: [1, 2, 3, 4] },
      { ...CAREER, highPay: [1, -2] },
      'career',
    ];
    for (const career of bad) {
      expect(refused({ past: [], career }), JSON.stringify(career)).toBe(true);
    }
    expect(refused({ past: [], career: CAREER })).toBe(false);
    expect(
      refused({
        past: [],
        career: { ...CAREER, agency: 'cia', door: 'degree', stage: 'training' },
      }),
    ).toBe(false);
  });

  it('refuses a past career with an ending the engine never writes, or a bad number', () => {
    const bad: unknown[] = [
      { ...PAST, agency: 'nsa' },
      { ...PAST, how: 'fired' },
      { ...PAST, how: 7 },
      { ...PAST, endedAge: -1 },
      { ...PAST, years: 0.5 },
      { ...PAST, finalGrade: 8 },
      { ...PAST, reputation: 200 },
      { ...PAST, pension: -1 },
      { ...PAST, pension: 'x' },
      'past',
    ];
    for (const row of bad) {
      expect(refused({ past: [row] }), JSON.stringify(row)).toBe(true);
    }
    expect(refused({ past: 'none' })).toBe(true);
    expect(refused({})).toBe(true);
    for (const how of ['washed-out', 'let-go', 'clearance-lost', 'resigned', 'retired', 'killed']) {
      expect(refused({ past: [{ ...PAST, how }] }), how).toBe(false);
    }
  });

  it('refuses a mission or a mission log the engine could not have written', () => {
    expect(refused({ past: [], mission: { source: 'nsa', age: 30 } })).toBe(true);
    expect(refused({ past: [], mission: { source: 'fbi', age: -1 } })).toBe(true);
    expect(refused({ past: [], mission: 'fbi' })).toBe(true);
    expect(refused({ past: [], missions: 'x' })).toBe(true);
    expect(refused({ past: [], missions: [{ age: 30, source: 'fbi', outcome: 'lucky' }] })).toBe(
      true,
    );
    expect(refused({ past: [], missions: [{ age: 30, source: 'dea', outcome: 'clean' }] })).toBe(
      true,
    );
    expect(refused({ past: [], missions: [{ age: 1.5, source: 'fbi', outcome: 'clean' }] })).toBe(
      true,
    );
    expect(refused({ past: [], missions: [null] })).toBe(true);
    for (const source of ['military', 'fbi', 'cia']) {
      expect(refused({ past: [], mission: { source, age: 30 } })).toBe(false);
    }
    for (const outcome of ['clean', 'close', 'mistake', 'disaster']) {
      expect(refused({ past: [], missions: [{ age: 30, source: 'cia', outcome }] })).toBe(false);
    }
  });

  it('refuses a gate that is not a flag, and an age that is not whole', () => {
    expect(refused({ past: [], missionsOpen: 'yes' })).toBe(true);
    expect(refused({ past: [], missionsOpen: 1 })).toBe(true);
    expect(refused({ past: [], revokedAge: -3 })).toBe(true);
    expect(refused({ past: [], deniedAge: 2.5 })).toBe(true);
    expect(refused({ past: [], appliedAge: 'x' })).toBe(true);
    expect(
      refused({ past: [], missionsOpen: false, revokedAge: 0, deniedAge: 0, appliedAge: 0 }),
    ).toBe(false);
  });
});
