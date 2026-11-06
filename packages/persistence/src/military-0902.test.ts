/**
 * Ticket 0902 — the save, v60. A career and a past service carry their ladder (`enlisted` or `officer`) and their
 * specialty; a career carries the years served when a commission began and, while officer training runs, the grade
 * and term an enlisted member would go back to; a recruiter's offer is asked in steps with its options frozen. A v59
 * save is brought forward (the enlisted ladder, the Army's open specialty, the branch question with the Army its only
 * option); a service the engine could not have written is refused, not repaired.
 */

import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame } from '@yearafter/simulation';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
import { fromSave, toSave } from './serialize';

const OFFICER = {
  branch: 'navy',
  stage: 'serving',
  enlistedAge: 22,
  track: 'officer',
  specialty: 'navy.systems',
  grade: 3,
  commissionedAt: 0,
  years: 6,
  termEnds: 8,
  performance: 66,
  reputation: 61,
  effort: 'normal',
  lastPay: 90_000,
  post: 'Naval Station Corvin',
} as const;

const CANDIDATE = {
  ...OFFICER,
  branch: 'army',
  specialty: 'army.signal',
  stage: 'training',
  grade: 1,
  commissionedAt: 3,
  years: 3,
  termEnds: 7,
  prior: { grade: 5, termEnds: 4 },
} as const;

const PAST = {
  branch: 'air-force',
  enlistedAge: 23,
  endedAge: 37,
  years: 14,
  track: 'officer',
  specialty: 'air-force.cyber',
  finalGrade: 3,
  reputation: 44,
  how: 'passed-over',
  discharge: 'honorable',
} as const;

const base = () => {
  const state = createNewGame({ seed: 'MIL-0902', startYear: 2000 });
  return toSave(state, { id: asSaveId('save-MIL-0902') });
};

const withMilitary = (military: unknown, version?: number) => {
  const raw = JSON.parse(JSON.stringify({ ...base(), military }));
  if (version !== undefined) raw.version = version;
  return raw;
};

describe('the service in a v60 save', () => {
  it('is at version 60', () => {
    expect(CURRENT_SAVE_VERSION).toBe(60);
  });

  it('keeps an officer, an officer candidate who came from the ranks, a passed-over past and every kind of question, exactly', () => {
    const offers = [
      {
        kind: 'enlist',
        age: 22,
        eventId: 'military.offer',
        step: 'branch',
        options: ['army', 'navy'],
        intro: true,
      },
      {
        kind: 'enlist',
        age: 22,
        eventId: 'military.offer',
        step: 'track',
        options: ['enlisted', 'officer'],
        branch: 'navy',
      },
      {
        kind: 'enlist',
        age: 22,
        eventId: 'military.offer',
        step: 'specialty',
        options: ['navy.boatswain'],
        branch: 'navy',
        track: 'officer',
      },
      {
        kind: 'reenlist',
        branch: 'navy',
        track: 'officer',
        grade: 4,
        years: 20,
        age: 42,
        eventId: 'military.offer',
      },
    ] as const;
    for (const offer of offers) {
      for (const service of [OFFICER, CANDIDATE]) {
        const military = {
          service,
          past: [PAST],
          offer,
          turnedDownAge: 20,
          appliedAge: 22,
          commissionAppliedAge: 25,
        };
        const result = migrateSave(withMilitary(military));
        expect(result.ok, JSON.stringify(offer)).toBe(true);
        if (!result.ok) return;
        expect(result.value.military).toEqual(military);
        const state = fromSave(result.value);
        expect(toSave(state, { id: asSaveId('save-MIL-0902') }).military).toEqual(military);
      }
    }
  });

  it('brings a v59 service forward: the enlisted ladder, the Army’s open specialty, a commission that never began', () => {
    const v59 = {
      service: {
        branch: 'army',
        stage: 'serving',
        enlistedAge: 19,
        grade: 5,
        years: 7,
        termEnds: 8,
        performance: 62,
        reputation: 58,
        effort: 'hard',
        lastPay: 50_000,
        post: 'Fort Harlan',
      },
      past: [
        {
          branch: 'army',
          enlistedAge: 18,
          endedAge: 22,
          years: 4,
          finalGrade: 4,
          reputation: 51,
          how: 'term',
          discharge: 'honorable',
        },
      ],
      turnedDownAge: 21,
    };
    const result = migrateSave(withMilitary(v59, 59));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.value.military.service).toMatchObject({
      track: 'enlisted',
      specialty: 'army.infantry',
      commissionedAt: 0,
      grade: 5,
      years: 7,
    });
    expect(result.value.military.past[0]).toMatchObject({
      track: 'enlisted',
      specialty: 'army.infantry',
      finalGrade: 4,
      how: 'term',
    });
    expect(result.value.military.turnedDownAge).toBe(21);
  });

  it('turns a v59 recruiter’s offer into the branch question with the Army as its only option', () => {
    const v59 = {
      past: [],
      offer: { kind: 'enlist', branch: 'army', age: 22, eventId: 'military.offer' },
    };
    const result = migrateSave(withMilitary(v59, 59));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.military.offer).toEqual({
      kind: 'enlist',
      age: 22,
      eventId: 'military.offer',
      step: 'branch',
      options: ['army'],
      intro: true,
    });
  });

  it('keeps a v59 term’s question as it was', () => {
    const reenlist = {
      kind: 'reenlist',
      branch: 'army',
      grade: 5,
      years: 4,
      age: 23,
      eventId: 'military.offer',
    };
    const result = migrateSave(withMilitary({ past: [], offer: reenlist }, 59));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.military.offer).toEqual(reenlist);
  });

  it('does not touch the fields a v59 save’s service already had, nor a v59 save with no service', () => {
    const empty = migrateSave(withMilitary({ past: [] }, 59));
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.value.military).toEqual({ past: [] });
  });

  it('accepts the edges: the top officer grade and the top enlisted grade, zeros and 100s', () => {
    const top = {
      service: { ...OFFICER, grade: 6, performance: 100, reputation: 100 },
      past: [{ ...PAST, finalGrade: 6, how: 'retired', reputation: 100 }],
    };
    expect(migrateSave(withMilitary(top)).ok).toBe(true);
    const bottom = {
      service: {
        ...OFFICER,
        grade: 1,
        years: 0,
        termEnds: 0,
        commissionedAt: 0,
        lastPay: 0,
        performance: 0,
      },
      past: [{ ...PAST, years: 0, enlistedAge: 0, endedAge: 0, finalGrade: 1, reputation: 0 }],
      commissionAppliedAge: 0,
    };
    expect(migrateSave(withMilitary(bottom)).ok).toBe(true);
    const enlistedTop = {
      service: { ...OFFICER, track: 'enlisted', specialty: 'navy.boatswain', grade: 9 },
      past: [],
    };
    expect(migrateSave(withMilitary(enlistedTop)).ok).toBe(true);
  });

  it('refuses a service the engine could not have written', () => {
    const bad: unknown[] = [
      // the ladder and the grade
      { past: [], service: { ...OFFICER, grade: 7 } },
      { past: [], service: { ...OFFICER, grade: 0 } },
      { past: [], service: { ...OFFICER, track: 'warrant' } },
      { past: [], service: { ...OFFICER, track: undefined } },
      { past: [{ ...PAST, finalGrade: 7 }] },
      { past: [{ ...PAST, track: 'warrant' }] },
      // the specialty must belong to the branch
      { past: [], service: { ...OFFICER, specialty: 'army.infantry' } },
      { past: [], service: { ...OFFICER, specialty: 7 } },
      { past: [], service: { ...OFFICER, specialty: undefined } },
      { past: [{ ...PAST, specialty: 'navy.boatswain' }] },
      { past: [{ ...PAST, specialty: undefined }] },
      // the branches
      { past: [], service: { ...OFFICER, branch: 'space-force' } },
      { past: [{ ...PAST, branch: 'space-force' }] },
      { past: [{ ...PAST, how: 'promoted' }] },
      // a commission
      { past: [], service: { ...OFFICER, commissionedAt: -1 } },
      { past: [], service: { ...OFFICER, commissionedAt: 1.5 } },
      { past: [], service: { ...OFFICER, commissionedAt: undefined } },
      { past: [], service: { ...CANDIDATE, prior: { grade: 10, termEnds: 4 } } },
      { past: [], service: { ...CANDIDATE, prior: { grade: 5, termEnds: -1 } } },
      { past: [], service: { ...CANDIDATE, prior: 'sergeant' } },
      { past: [], service: { ...CANDIDATE, prior: null } },
      { past: [], commissionAppliedAge: -1 },
      { past: [], commissionAppliedAge: 25.5 },
      // the questions
      {
        past: [],
        offer: { kind: 'enlist', age: 22, eventId: 'military.offer', options: ['army'] },
      },
      { past: [], offer: { kind: 'enlist', age: 22, eventId: 'military.offer', step: 'branch' } },
      {
        past: [],
        offer: {
          kind: 'enlist',
          age: 22,
          eventId: 'military.offer',
          step: 'jobs',
          options: ['army'],
        },
      },
      {
        past: [],
        offer: {
          kind: 'enlist',
          age: 22,
          eventId: 'military.offer',
          step: 'branch',
          options: 'army',
        },
      },
      {
        past: [],
        offer: { kind: 'enlist', age: 22, eventId: 'military.offer', step: 'branch', options: [1] },
      },
      {
        past: [],
        offer: {
          kind: 'enlist',
          age: 22,
          eventId: 'military.offer',
          step: 'track',
          options: ['officer'],
          branch: 'space-force',
        },
      },
      {
        past: [],
        offer: {
          kind: 'enlist',
          age: 22,
          eventId: 'military.offer',
          step: 'track',
          options: ['officer'],
          track: 'warrant',
        },
      },
      {
        past: [],
        offer: {
          kind: 'enlist',
          age: 22,
          eventId: 'military.offer',
          step: 'branch',
          options: ['army'],
          intro: 'yes',
        },
      },
      {
        past: [],
        offer: {
          kind: 'reenlist',
          branch: 'navy',
          track: 'warrant',
          grade: 4,
          years: 4,
          age: 26,
          eventId: 'military.offer',
        },
      },
      {
        past: [],
        offer: {
          kind: 'reenlist',
          branch: 'navy',
          track: 'officer',
          grade: 7,
          years: 4,
          age: 26,
          eventId: 'military.offer',
        },
      },
      {
        past: [],
        offer: {
          kind: 'reenlist',
          branch: 'navy',
          track: 'enlisted',
          grade: 10,
          years: 4,
          age: 26,
          eventId: 'military.offer',
        },
      },
    ];
    for (const row of bad) {
      expect(migrateSave(withMilitary(row)).ok, JSON.stringify(row)).toBe(false);
    }
  });
});
