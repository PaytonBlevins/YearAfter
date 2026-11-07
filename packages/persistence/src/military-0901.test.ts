/**
 * Ticket 0901 — the save (as 0902 reshaped it, v60). `military` is always present from v59: a career in progress (optional), the ones that
 * ended, and a question. An older save gets an empty one and nothing else changes; a save that carries a service keeps
 * it exactly; a service that could not have been written by the engine is refused, not repaired.
 */

import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame, type MilitaryState } from '@yearafter/simulation';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
import { fromSave, toSave } from './serialize';

const SERVICE = {
  branch: 'army',
  stage: 'serving',
  enlistedAge: 19,
  track: 'enlisted',
  specialty: 'army.infantry',
  commissionedAt: 0,
  grade: 5,
  years: 7,
  termEnds: 8,
  performance: 62,
  reputation: 58,
  effort: 'hard',
  pushedAtAge: 26,
  pushedThisYear: 2,
  lastPay: 50_000,
  post: 'Fort Harlan',
} as const;

const PAST = {
  branch: 'army',
  enlistedAge: 18,
  endedAge: 22,
  years: 4,
  track: 'enlisted',
  specialty: 'army.infantry',
  finalGrade: 4,
  reputation: 51,
  how: 'term',
  discharge: 'honorable',
} as const;

const REENLIST = {
  kind: 'reenlist',
  branch: 'army',
  grade: 5,
  years: 8,
  age: 27,
  eventId: 'military.offer',
} as const;

const base = () => {
  const state = createNewGame({ seed: 'MIL-SAVE', startYear: 2000 });
  return { state, save: toSave(state, { id: asSaveId('save-MIL-SAVE') }) };
};

const withMilitary = (military: unknown) => {
  const { save } = base();
  return JSON.parse(JSON.stringify({ ...save, military }));
};

describe('the service in a save', () => {
  it('is at version 59 or later', () => {
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(59);
  });

  it('starts empty and round-trips empty', () => {
    const { state, save } = base();
    expect(save.military).toEqual({ past: [] });
    expect(fromSave(save).military).toEqual(state.military);
  });

  it('keeps a career in progress, the ones that ended, and a question, exactly', () => {
    const military: MilitaryState = {
      service: SERVICE,
      past: [PAST],
      offer: REENLIST,
      turnedDownAge: 21,
      appliedAge: 18,
    };
    const raw = withMilitary(military);
    const result = migrateSave(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.military).toEqual(military);
    const state = fromSave(result.value);
    expect(state.military).toEqual(military);
    expect(toSave(state, { id: asSaveId('save-MIL-SAVE') }).military).toEqual(military);
  });

  it('keeps a recruiter’s offer, and nothing but the past after a career has ended', () => {
    const offer = {
      kind: 'enlist',
      age: 20,
      eventId: 'military.offer',
      step: 'branch',
      options: ['army', 'navy'],
      intro: true,
    } as const;
    expect(migrateSave(withMilitary({ past: [], offer })).ok).toBe(true);
    expect(
      migrateSave(
        withMilitary({ past: [PAST, { ...PAST, how: 'washed-out', discharge: 'entry-level' }] }),
      ).ok,
    ).toBe(true);
  });

  it('gives an older save an empty service and changes nothing else about it', () => {
    const { save } = base();
    const old = JSON.parse(JSON.stringify(save));
    old.version = 58;
    delete old.military;
    const result = migrateSave(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.value.military).toEqual({ past: [] });
    const { version: _a, military: _m, ...rest } = result.value;
    const { version: _b, ...was } = old;
    expect(rest).toEqual(was);
  });

  it('keeps a service a v58 save somehow already carried, rather than overwriting it', () => {
    const old = withMilitary({ past: [PAST] });
    old.version = 58;
    const result = migrateSave(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.military).toEqual({ past: [PAST] });
  });

  it('accepts the edges: zeros, and levels from 0 to 100', () => {
    const zero = {
      service: { ...SERVICE, years: 0, termEnds: 0, lastPay: 0, performance: 0, reputation: 100 },
      past: [{ ...PAST, years: 0, endedAge: 0, enlistedAge: 0, finalGrade: 1, reputation: 0 }],
      turnedDownAge: 0,
      appliedAge: 0,
    };
    expect(migrateSave(withMilitary(zero)).ok).toBe(true);
    const top = {
      service: { ...SERVICE, grade: 9, performance: 100, reputation: 100 },
      past: [{ ...PAST, finalGrade: 9, reputation: 100 }],
    };
    expect(migrateSave(withMilitary(top)).ok).toBe(true);
  });

  it('refuses a save without one once it is current', () => {
    const { save } = base();
    const raw = JSON.parse(JSON.stringify(save));
    delete raw.military;
    expect(migrateSave(raw).ok).toBe(false);
  });

  it('refuses a service the engine could not have written', () => {
    const bad: unknown[] = [
      null,
      [],
      'army',
      {},
      { past: 'none' },
      { past: [], turnedDownAge: -1 },
      { past: [], appliedAge: 1.5 },
      { past: [{ ...PAST, branch: 'space-force' }] },
      { past: [{ ...PAST, how: 'quit' }] },
      { past: [{ ...PAST, discharge: 'dishonorable' }] },
      { past: [{ ...PAST, finalGrade: 0 }] },
      { past: [{ ...PAST, finalGrade: 10 }] },
      { past: [{ ...PAST, years: -1 }] },
      { past: [{ ...PAST, endedAge: 'late' }] },
      { past: [{ ...PAST, reputation: 101 }] },
      { past: [], service: { ...SERVICE, branch: 'space-force' } },
      { past: [], service: { ...SERVICE, stage: 'deployed' } },
      { past: [], service: { ...SERVICE, grade: 0 } },
      { past: [], service: { ...SERVICE, grade: 10 } },
      { past: [], service: { ...SERVICE, years: -2 } },
      { past: [], service: { ...SERVICE, termEnds: 4.5 } },
      { past: [], service: { ...SERVICE, performance: 120 } },
      { past: [], service: { ...SERVICE, reputation: -1 } },
      { past: [], service: { ...SERVICE, effort: 'maximum' } },
      { past: [], service: { ...SERVICE, pushedAtAge: -3 } },
      { past: [], service: { ...SERVICE, lastPay: 'lots' } },
      { past: [], service: { ...SERVICE, post: 7 } },
      { past: [], service: 'private' },
      { past: [], service: null },
      { past: [null] },
      { past: [5] },
      { past: [], offer: null },
      { past: [], offer: { ...REENLIST, kind: 'draft' } },
      { past: [], offer: { ...REENLIST, grade: 12 } },
      { past: [], offer: { ...REENLIST, years: -1 } },
      { past: [], offer: { ...REENLIST, branch: 'space-force' } },
      { past: [], offer: { ...REENLIST, age: 'old' } },
      { past: [], offer: { ...REENLIST, eventId: 7 } },
      {
        past: [],
        offer: {
          kind: 'enlist',
          age: -1,
          eventId: 'military.offer',
          step: 'branch',
          options: ['army'],
        },
      },
      { past: [], offer: 'sign here' },
    ];
    for (const row of bad) {
      expect(migrateSave(withMilitary(row)).ok, JSON.stringify(row)).toBe(false);
    }
  });
});
