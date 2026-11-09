import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import {
  createNewGame,
  militaryOfferDecision,
  startArt,
  trainingCeiling,
  type GameState,
  type ServiceCareer,
} from '@yearafter/simulation';
import { fromSave, toSave } from './serialize';
const save = (state: GameState) =>
  toSave(state, { id: asSaveId('career-control'), createdAt: 0, updatedAt: 0 });

describe('November career save compatibility', () => {
  it('preserves enrolled classes and deterministic potential through a save round trip', () => {
    const base = createNewGame({ seed: 'class-save', talents: [] });
    const started = startArt({ ...base, player: { ...base.player, age: 25 } }, 'boxing');
    if (!started.ok) throw Error('fixture');
    const state = started.value.state;
    const restored = fromSave(save(state));
    const streamsBefore = restored.rng.snapshot();
    expect(restored.sports.arts).toEqual(state.sports.arts);
    expect(trainingCeiling(restored, 'boxing')).toBe(trainingCeiling(state, 'boxing'));
    expect(restored.rng.snapshot()).toEqual(streamsBefore);
  });
  it('removes obsolete four-year popups on load without disturbing other decisions', () => {
    const base = createNewGame({ seed: 'military-save' });
    const service: ServiceCareer = {
      branch: 'army',
      stage: 'serving',
      enlistedAge: 18,
      track: 'enlisted',
      specialty: 'army.infantry',
      commissionedAt: 0,
      grade: 4,
      years: 4,
      termEnds: 4,
      performance: 70,
      reputation: 60,
      effort: 'normal',
      lastPay: 50000,
      post: 'Fort Harlan',
    };
    const offer = {
      kind: 'reenlist' as const,
      branch: 'army' as const,
      track: 'enlisted' as const,
      grade: 4,
      years: 4,
      age: 22,
      eventId: 'military.offer',
    };
    const state: GameState = {
      ...base,
      player: { ...base.player, age: 22 },
      military: { past: [], service, offer },
      pending: [militaryOfferDecision(offer, base.world.year)],
    };
    const restored = fromSave(save(state));
    expect(restored.military.offer).toBeUndefined();
    expect(restored.pending).toEqual([]);
    expect(restored.military.service?.years).toBe(4);
    expect(restored.military.service?.termEnds).toBe(8);
  });
});
