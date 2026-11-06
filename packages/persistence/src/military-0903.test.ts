/**
 * Ticket 0903 — the save, v61. A service life carries a flag that opens deployments, orders waiting for an answer, a
 * deployment in progress with the incidents so far, the deployments that are over, the decorations earned, and, on a
 * career, the year a refusal holds back promotion and whether orders were refused this term; a member killed in service
 * is a past service with that ending. A v60 save comes forward with nothing changed but the version; a deployment the
 * engine could not have written is refused, not repaired.
 */

import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame } from '@yearafter/simulation';
import { migrateSave } from './migrations';
import { CURRENT_SAVE_VERSION } from './save-schema';
import { fromSave, toSave } from './serialize';

const SERVICE = {
  branch: 'army',
  stage: 'serving',
  enlistedAge: 19,
  track: 'enlisted',
  specialty: 'army.infantry',
  grade: 5,
  commissionedAt: 0,
  years: 6,
  termEnds: 8,
  performance: 66,
  reputation: 61,
  effort: 'normal',
  lastPay: 50_000,
  post: 'Fort Harlan',
} as const;

const DEPLOYMENT = {
  status: 'active',
  theater: 'Camp Meridian',
  months: 8,
  tier: 'forward',
  incidents: 2,
  results: ['clean'],
  orderedAge: 25,
  wounded: false,
} as const;

const ORDERS = {
  kind: 'orders',
  age: 25,
  eventId: 'military.offer',
  theater: 'Camp Meridian',
  months: 8,
  tier: 'forward',
  incidents: 2,
} as const;

const PAST_DEPLOYMENT = {
  age: 22,
  theater: 'Fort Ardent',
  months: 6,
  tier: 'rear',
  worst: 'close',
  wounded: false,
} as const;

const KILLED = {
  branch: 'army',
  enlistedAge: 19,
  endedAge: 27,
  years: 8,
  track: 'enlisted',
  specialty: 'army.infantry',
  finalGrade: 5,
  reputation: 70,
  how: 'killed',
  discharge: 'honorable',
} as const;

const base = () => {
  const state = createNewGame({ seed: 'MIL-0903', startYear: 2000 });
  return toSave(state, { id: asSaveId('save-MIL-0903') });
};

const withMilitary = (military: unknown, version?: number) => {
  const raw = JSON.parse(JSON.stringify({ ...base(), military }));
  if (version !== undefined) raw.version = version;
  return raw;
};

describe('deployments in a v61 save', () => {
  it('is at version 61 or later', () => {
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(61);
    expect(base().version).toBe(CURRENT_SAVE_VERSION);
  });

  it('keeps a deployment in progress, the ones that are over, the decorations and the gate, exactly', () => {
    const military = {
      service: { ...SERVICE, noRiseAtAge: 26, refusedTerm: true },
      past: [KILLED],
      deploymentsOpen: true,
      deployment: DEPLOYMENT,
      deployments: [
        PAST_DEPLOYMENT,
        { ...PAST_DEPLOYMENT, tier: 'front', worst: 'disaster', wounded: true },
      ],
      decorations: [
        { id: 'service-medal', age: 22 },
        { id: 'purple-heart', age: 24 },
      ],
    };
    const result = migrateSave(withMilitary(military));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.military).toEqual(military);
    const state = fromSave(result.value);
    expect(toSave(state, { id: asSaveId('save-MIL-0903') }).military).toEqual(military);
  });

  it('keeps orders waiting for an answer, exactly', () => {
    const military = { service: SERVICE, past: [], deploymentsOpen: true, offer: ORDERS };
    const result = migrateSave(withMilitary(military));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.military).toEqual(military);
    const state = fromSave(result.value);
    expect(toSave(state, { id: asSaveId('save-MIL-0903') }).military).toEqual(military);
  });

  it('keeps a deployment ordered and not yet served, with no results, and an active one with every result in', () => {
    for (const deployment of [
      { ...DEPLOYMENT, status: 'ordered', results: [] },
      { ...DEPLOYMENT, results: ['clean'] },
      { ...DEPLOYMENT, results: ['close', 'mistake'], wounded: true },
      { ...DEPLOYMENT, tier: 'front', incidents: 3, results: ['clean', 'close', 'disaster'] },
    ]) {
      const military = { service: SERVICE, past: [], deployment };
      expect(migrateSave(withMilitary(military)).ok, JSON.stringify(deployment)).toBe(true);
    }
  });

  it('keeps a member killed in service as a past service with that ending', () => {
    const military = { past: [KILLED] };
    const result = migrateSave(withMilitary(military));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.military.past[0]).toMatchObject({ how: 'killed', discharge: 'honorable' });
  });

  it('brings a v60 save forward with nothing changed but the version', () => {
    const v60 = {
      service: SERVICE,
      past: [{ ...KILLED, how: 'retired' }],
      turnedDownAge: 21,
      appliedAge: 22,
      commissionAppliedAge: 24,
    };
    const result = migrateSave(withMilitary(v60, 60));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.value.military).toEqual(v60);
    const empty = migrateSave(withMilitary({ past: [] }, 60));
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.value.military).toEqual({ past: [] });
  });

  it('refuses a deployment the engine could not have written', () => {
    const live = { service: SERVICE, past: [] };
    const bad: unknown[] = [
      { ...live, deployment: 'away' },
      { ...live, deployment: null },
      { ...live, deployment: { ...DEPLOYMENT, status: 'done' } },
      { ...live, deployment: { ...DEPLOYMENT, status: undefined } },
      { ...live, deployment: { ...DEPLOYMENT, theater: 7 } },
      { ...live, deployment: { ...DEPLOYMENT, months: 0 } },
      { ...live, deployment: { ...DEPLOYMENT, months: -1 } },
      { ...live, deployment: { ...DEPLOYMENT, months: 1.5 } },
      { ...live, deployment: { ...DEPLOYMENT, tier: 'rearguard' } },
      { ...live, deployment: { ...DEPLOYMENT, incidents: 0 } },
      { ...live, deployment: { ...DEPLOYMENT, incidents: 0, results: [] } },
      { ...live, deployment: { ...DEPLOYMENT, incidents: 2.5 } },
      { ...live, deployment: { ...DEPLOYMENT, results: 'clean' } },
      { ...live, deployment: { ...DEPLOYMENT, results: ['clean', 'victory'] } },
      { ...live, deployment: { ...DEPLOYMENT, results: ['clean', 'clean', 'clean'] } },
      { ...live, deployment: { ...DEPLOYMENT, orderedAge: -1 } },
      { ...live, deployment: { ...DEPLOYMENT, wounded: 'yes' } },
      { ...live, deploymentsOpen: 'yes' },
      { ...live, deploymentsOpen: 1 },
    ];
    for (const military of bad) {
      expect(migrateSave(withMilitary(military)).ok, JSON.stringify(military)).toBe(false);
    }
  });

  it('refuses a past deployment or a decoration the engine could not have written', () => {
    const bad: unknown[] = [
      { past: [], deployments: 'many' },
      { past: [], deployments: {} },
      { past: [], deployments: 5 },
      { past: [], deployments: ['x'] },
      { past: [], deployments: [null] },
      { past: [], deployments: [{ ...PAST_DEPLOYMENT, age: -1 }] },
      { past: [], deployments: [{ ...PAST_DEPLOYMENT, theater: 3 }] },
      { past: [], deployments: [{ ...PAST_DEPLOYMENT, months: 1.5 }] },
      { past: [], deployments: [{ ...PAST_DEPLOYMENT, tier: 'moon' }] },
      { past: [], deployments: [{ ...PAST_DEPLOYMENT, worst: 'fine' }] },
      { past: [], deployments: [{ ...PAST_DEPLOYMENT, wounded: 'no' }] },
      { past: [], decorations: 'medals' },
      { past: [], decorations: {} },
      { past: [], decorations: 5 },
      { past: [], decorations: ['x'] },
      { past: [], decorations: [null] },
      { past: [], decorations: [{ id: 3, age: 20 }] },
      { past: [], decorations: [{ id: 'purple-heart', age: -2 }] },
      { past: [], decorations: [{ id: 'purple-heart' }] },
    ];
    for (const military of bad) {
      expect(migrateSave(withMilitary(military)).ok, JSON.stringify(military)).toBe(false);
    }
  });

  it('refuses orders the engine could not have written', () => {
    const live = { service: SERVICE, past: [] };
    const bad: unknown[] = [
      { ...live, offer: { ...ORDERS, theater: 4 } },
      { ...live, offer: { ...ORDERS, months: -3 } },
      { ...live, offer: { ...ORDERS, months: 2.5 } },
      { ...live, offer: { ...ORDERS, tier: 'moon' } },
      { ...live, offer: { ...ORDERS, incidents: 0 } },
      { ...live, offer: { ...ORDERS, incidents: 'two' } },
      { ...live, offer: { ...ORDERS, age: -1 } },
      { ...live, offer: { ...ORDERS, eventId: 4 } },
      { ...live, offer: { ...ORDERS, kind: 'summons' } },
    ];
    for (const military of bad) {
      expect(migrateSave(withMilitary(military)).ok, JSON.stringify(military)).toBe(false);
    }
  });

  it('refuses a career with a refusal the engine could not have written', () => {
    const bad: unknown[] = [
      { past: [], service: { ...SERVICE, noRiseAtAge: -1 } },
      { past: [], service: { ...SERVICE, noRiseAtAge: 26.5 } },
      { past: [], service: { ...SERVICE, noRiseAtAge: '26' } },
      { past: [], service: { ...SERVICE, refusedTerm: 'yes' } },
      { past: [], service: { ...SERVICE, refusedTerm: 1 } },
      { past: [{ ...KILLED, how: 'vanished' }] },
    ];
    for (const military of bad) {
      expect(migrateSave(withMilitary(military)).ok, JSON.stringify(military)).toBe(false);
    }
  });

  it('accepts the edges: no results yet, every incident answered, and the zero age', () => {
    const edges = [
      { ...DEPLOYMENT, results: [], orderedAge: 0 },
      { ...DEPLOYMENT, results: ['clean', 'clean'] },
      { ...DEPLOYMENT, incidents: 1, results: ['disaster'] },
    ];
    for (const deployment of edges) {
      const military = { service: SERVICE, past: [], deployment, noRise: undefined };
      expect(migrateSave(withMilitary(military)).ok, JSON.stringify(deployment)).toBe(true);
    }
    const zero = {
      past: [],
      service: { ...SERVICE, noRiseAtAge: 0 },
      decorations: [{ id: 'a', age: 0 }],
    };
    expect(migrateSave(withMilitary(zero)).ok).toBe(true);
  });
});
