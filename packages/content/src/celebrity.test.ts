import { describe, expect, it } from 'vitest';
import {
  CELEBRITY_FIELDS,
  CELEBRITY_FIELD_CATALOG,
  CONNECTION_ACTIONS,
  CONNECTION_MENU,
  ENCOUNTER_ACTIONS,
  ENCOUNTER_MENU,
  findCelebrityField,
  findConnectionAction,
  findEncounterAction,
} from './celebrity';

describe('0705 — the celebrity catalog', () => {
  it('has one entry per field, in the order the fields are named, each findable', () => {
    expect(CELEBRITY_FIELD_CATALOG.map((field) => field.id)).toEqual([...CELEBRITY_FIELDS]);
    for (const field of CELEBRITY_FIELD_CATALOG) {
      expect(findCelebrityField(field.id)).toBe(field);
    }
    expect(findCelebrityField('sailing')).toBeUndefined();
  });

  it('gives every field ranges that run low to high and a career that fits in a life', () => {
    for (const field of CELEBRITY_FIELD_CATALOG) {
      for (const range of [field.debut, field.rise, field.hold, field.retire]) {
        expect(range[0], field.id).toBeGreaterThan(0);
        expect(range[0], field.id).toBeLessThanOrEqual(range[1]);
      }
      expect(field.debut[0] + field.rise[0], field.id).toBeGreaterThanOrEqual(16);
      expect(field.retire[1], field.id).toBeLessThanOrEqual(90);
      expect(field.density, field.id).toBeGreaterThan(0.3);
      expect(field.density, field.id).toBeLessThanOrEqual(1.5);
      for (const pull of [field.hubPull, field.wealthPull]) {
        expect(pull).toBeGreaterThanOrEqual(0);
        expect(pull).toBeLessThanOrEqual(1);
      }
      expect(field.role).toMatch(/^an? /);
    }
  });

  it('names the part of a life a field needs only for the fields that need one', () => {
    const networks = CELEBRITY_FIELD_CATALOG.filter((field) => field.network !== undefined);
    expect(networks.map((field) => field.id).sort()).toEqual(['business', 'creator']);
    expect(findCelebrityField('creator')?.network).toBe('channel');
    expect(findCelebrityField('business')?.network).toBe('business');
  });

  it('puts the six things you can do to a stranger in the order the spec lists them, each findable', () => {
    expect(ENCOUNTER_MENU.map((action) => action.id)).toEqual([...ENCOUNTER_ACTIONS]);
    expect([...ENCOUNTER_ACTIONS]).toEqual([
      'compliment',
      'flirt',
      'autograph',
      'picture',
      'insult',
      'ignore',
    ]);
    for (const action of ENCOUNTER_MENU) {
      expect(findEncounterAction(action.id)).toBe(action);
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.blurb.length).toBeGreaterThan(0);
      expect(action.base).toBeGreaterThanOrEqual(0);
      expect(action.base).toBeLessThan(1);
      expect(action.connect).toBeGreaterThanOrEqual(0);
      expect(action.connect).toBeLessThan(1);
    }
    expect(findEncounterAction('propose')).toBeUndefined();
  });

  it('leaves a connection about half the time a compliment lands, a fifth for a picture, a tenth for an autograph', () => {
    const connect = (id: 'compliment' | 'flirt' | 'autograph' | 'picture') =>
      findEncounterAction(id)!.connect;
    expect({
      compliment: connect('compliment'),
      flirt: connect('flirt'),
      autograph: connect('autograph'),
      picture: connect('picture'),
    }).toEqual({ compliment: 0.5, flirt: 0.55, autograph: 0.1, picture: 0.2 });
  });

  it('never lets rudeness or silence lead to a connection', () => {
    for (const id of ['insult', 'ignore'] as const) {
      expect(findEncounterAction(id)?.connect).toBe(0);
    }
  });

  it('makes a quick request easier than a flirt, and a flirt likelier than a compliment to go somewhere', () => {
    const base = (id: 'autograph' | 'picture' | 'compliment' | 'flirt') =>
      findEncounterAction(id)!.base;
    expect(base('autograph')).toBeGreaterThan(base('compliment'));
    expect(base('picture')).toBeGreaterThan(base('compliment'));
    expect(base('flirt')).toBeLessThan(base('compliment'));
    expect(findEncounterAction('flirt')!.connect).toBeGreaterThan(
      findEncounterAction('compliment')!.connect,
    );
  });

  it('lists the second menu once each, with warmth to unlock growing as the stakes do', () => {
    expect(CONNECTION_MENU.map((action) => action.id)).toEqual([...CONNECTION_ACTIONS]);
    for (const action of CONNECTION_MENU) {
      expect(findConnectionAction(action.id)).toBe(action);
      expect(action.worst, action.id).toBeGreaterThan(0);
      expect(action.worst, action.id).toBeLessThan(action.best);
      expect(action.best, action.id).toBeLessThanOrEqual(0.95);
      expect(action.onGood, action.id).toBeGreaterThan(0);
      expect(action.onBad, action.id).toBeLessThanOrEqual(0);
      expect(action.minWarmth, action.id).toBeGreaterThanOrEqual(0);
      expect(action.minWarmth, action.id).toBeLessThan(100);
    }
    for (const social of ['catchUp', 'compliment'] as const) {
      expect(findConnectionAction(social)!.minWarmth).toBe(0);
    }
    for (const closer of ['flirt', 'collaborate', 'invite', 'endorse'] as const) {
      expect(findConnectionAction(closer)!.minWarmth).toBeGreaterThan(
        findConnectionAction('getTogether')!.minWarmth - 1,
      );
    }
    expect(findConnectionAction('flirt')!.kind).toBe('romantic');
    for (const id of ['collaborate', 'invite', 'endorse'] as const) {
      expect(findConnectionAction(id)!.kind).toBe('professional');
    }
    expect(findConnectionAction('elope')).toBeUndefined();
  });
});
