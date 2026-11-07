/**
 * Ticket 0906 — every verb of the military, FBI and CIA screens, done and refused, with the words.
 *
 * Rolls (a board, an application, a push) are swept over the world's generation until each outcome
 * has happened, and a sweep that finds nothing throws, so a case that stops existing fails loudly
 * and does not turn its test into a pass (13.126).
 */

import { describe, expect, it } from 'vitest';
import type { GameState } from '@yearafter/simulation';
import {
  ADULT,
  agencyReady,
  at,
  eligible,
  inAgency,
  pastAgency,
  serving,
  veteran,
  withDegree,
  withStats,
} from '../test/militaryFixtures';
import { applyMilitary, type MilitaryAction } from './militaryActions';

const person = eligible(ADULT);
const age = person.player.age;
const generation = (state: GameState, n: number): GameState => ({
  ...state,
  world: { ...state.world, generation: n },
});

const enlist = (
  branch: string,
  specialty: string,
  track: 'enlisted' | 'officer' = 'enlisted',
): MilitaryAction => ({ type: 'enlist', branch, track, specialty });

function refused(state: GameState, action: MilitaryAction) {
  const result = applyMilitary(state, action);
  if (result.ok) throw new Error(`expected a refusal, got ${result.outcome?.title}`);
  return result.outcome;
}

function done(state: GameState, action: MilitaryAction) {
  const result = applyMilitary(state, action);
  if (!result.ok) throw new Error(`expected it to work, got "${result.outcome.body}"`);
  return result;
}

/** The first generation for which the verb comes out the way `found` says. Throws when none does. */
function sweep(state: GameState, action: MilitaryAction, found: (title: string) => boolean) {
  for (let n = 0; n < 800; n += 1) {
    const trial = generation(state, n);
    const result = applyMilitary(trial, action);
    if (result.ok && result.outcome && found(result.outcome.title)) return { trial, result };
  }
  throw new Error('no generation produced that outcome');
}

describe('enlisting', () => {
  it('puts the person in uniform at the bottom of the branch they chose', () => {
    const result = done(person, enlist('navy', 'navy.boatswain'));
    const service = result.state.military.service!;
    expect(service).toMatchObject({
      branch: 'navy',
      specialty: 'navy.boatswain',
      track: 'enlisted',
      stage: 'training',
      grade: 1,
    });
    expect(result.state.military.appliedAge).toBe(age);
    expect(result.outcome).toEqual({
      title: 'You enlisted',
      body: result.entries.map((entry) => entry.text).join(' '),
      tone: 'good',
    });
    expect(result.outcome!.body).toMatch(/^You enlisted in the Navy\./);
    expect(result.entries).toHaveLength(1);
  });

  it('starts an officer’s road when the person with a degree chose the commission', () => {
    const result = done(withDegree(person), enlist('army', 'army.infantry', 'officer'));
    expect(result.state.military.service!.track).toBe('officer');
    expect(result.outcome!.title).toBe('Officer training begins');
    expect(result.outcome!.body).toMatch(
      /^You were accepted to Officer Candidate School in the Army\./,
    );
  });

  it('leaves the old state alone', () => {
    const before = person;
    done(before, enlist('army', 'army.infantry'));
    expect(before.military.service).toBeUndefined();
  });

  it.each([
    ['too young', at(person, 16), enlist('army', 'army.infantry'), "You're too young to enlist."],
    [
      'unfit',
      withStats(person, { health: 10 }),
      enlist('army', 'army.infantry'),
      "The physical turned you away. You're not well enough for this yet.",
    ],
    [
      'not ready',
      withStats(person, { smarts: 5 }),
      enlist('army', 'army.infantry'),
      "The aptitude test didn't go your way.",
    ],
    [
      'no degree for a commission',
      person,
      enlist('army', 'army.infantry', 'officer'),
      "A commission takes a bachelor's degree, and you don't have one.",
    ],
    [
      'already in uniform',
      serving(person),
      enlist('army', 'army.infantry'),
      "You're already in uniform.",
    ],
    [
      'already went this year',
      { ...person, military: { past: [], appliedAge: age } } as GameState,
      enlist('army', 'army.infantry'),
      "You've already been to the recruiting office this year.",
    ],
    [
      'a question waiting',
      { ...person, military: { past: [], offer: { kind: 'reenlist' } as never } } as GameState,
      enlist('army', 'army.infantry'),
      'There is a question waiting for you already.',
    ],
    ['no such branch', person, enlist('space-force', 'x'), "That isn't a branch."],
    [
      'a job the branch lacks',
      person,
      enlist('army', 'navy.boatswain'),
      "That job isn't one that branch has.",
    ],
  ])('refuses somebody who is %s, in words', (_name, state, action, words) => {
    expect(refused(state, action)).toEqual({ title: 'Not now', body: words, tone: 'bad' });
  });

  it('refuses a job the person lacks the aptitude for', () => {
    const weak = withStats(person, { smarts: 31, health: 52, discipline: 20 });
    const row = (
      [
        'army.infantry',
        'army.intelligence',
        'army.medic',
        'army.signal',
        'army.police',
        'army.mechanic',
      ] as const
    ).find((id) => {
      const result = applyMilitary(weak, enlist('army', id));
      return !result.ok && result.outcome.body === "You don't qualify for that job yet.";
    });
    expect(row).toBeDefined();
  });
});

describe('a commission', () => {
  const candidate = serving(withDegree(person), { years: 4 });

  it('is picked or passed over, and the card says which', () => {
    const picked = sweep(
      candidate,
      { type: 'commission' },
      (title) => title === 'The board picked you',
    );
    expect(picked.result.outcome).toMatchObject({ title: 'The board picked you', tone: 'good' });
    expect(picked.result.state.military.service).toMatchObject({
      track: 'officer',
      stage: 'training',
    });
    const passed = sweep(
      candidate,
      { type: 'commission' },
      (title) => title === 'The board passed',
    );
    expect(passed.result.outcome).toMatchObject({ title: 'The board passed', tone: 'neutral' });
    expect(passed.result.state.military.service!.track).toBe('enlisted');
    expect(passed.result.state.military.commissionAppliedAge).toBe(age);
  });

  it('puts the engine’s own line on the card', () => {
    const { result } = sweep(candidate, { type: 'commission' }, () => true);
    expect(result.outcome!.body).toBe(result.entries[0]!.text);
  });

  it.each([
    ['not in uniform', person, "You're not in uniform."],
    [
      'without a degree',
      serving(person),
      "A commission takes a bachelor's degree, and you don't have one.",
    ],
    [
      'an officer already',
      serving(withDegree(person), { track: 'officer' }),
      "You're an officer already.",
    ],
    [
      'in training',
      serving(withDegree(person), { stage: 'training', years: 0 }),
      'Finish your training first.',
    ],
  ])('refuses somebody %s', (_name, state, words) => {
    expect(refused(state, { type: 'commission' })).toEqual({
      title: 'Not now',
      body: words,
      tone: 'bad',
    });
  });
});

describe('retiring', () => {
  const lifer = serving(person, { years: 22, termEnds: 24, grade: 7 });

  it('ends the service as a retirement and gives no card, because the discharge card is read from the change', () => {
    const result = done(lifer, { type: 'retire' });
    expect(result.state.military.service).toBeUndefined();
    expect(result.state.military.past).toHaveLength(1);
    expect(result.state.military.past[0]).toMatchObject({
      how: 'retired',
      years: 22,
      discharge: 'honorable',
    });
    expect(result.outcome).toBeUndefined();
    expect(result.entries).toHaveLength(1);
  });

  it('refuses before twenty years, and during training, in words', () => {
    const words = 'Retiring opens at twenty years of service, and not during training.';
    expect(refused(serving(person, { years: 19 }), { type: 'retire' }).body).toBe(words);
    expect(
      refused(serving(person, { years: 30, stage: 'training' }), { type: 'retire' }).body,
    ).toBe(words);
  });

  it('refuses somebody who is not in uniform', () => {
    expect(refused(person, { type: 'retire' })).toEqual({
      title: 'Not now',
      body: "You're not in uniform.",
      tone: 'bad',
    });
  });
});

describe('putting the work in', () => {
  it('answers a soldier’s first press with the line and the bar', () => {
    const state = serving(person);
    const result = done(state, { type: 'work' });
    expect(result.outcome).toMatchObject({ title: 'A real shift', tone: 'neutral' });
    expect(result.outcome!.body).toBe(result.entries[0]!.text);
    expect(result.outcome!.meter).toEqual({
      label: 'In the service',
      value: result.state.military.service!.performance,
    });
    expect(result.state.military.service).toMatchObject({
      effort: 'hard',
      pushedThisYear: 1,
      pushedAtAge: age,
    });
  });

  it('lets the second press count, and answers the third in words without changing anything', () => {
    let state = done(serving(person), { type: 'work' }).state;
    state = done(state, { type: 'work' }).state;
    expect(state.military.service!.pushedThisYear).toBe(2);
    const third = done(state, { type: 'work' });
    expect(third.state).toBe(state);
    expect(third.entries).toEqual([]);
    expect(third.outcome).toEqual({
      title: 'Nothing more to give',
      body: 'You have already put your back into this year. More hours now would just be hours.',
      tone: 'neutral',
    });
  });

  it('can raise the standing, and cannot lower it', () => {
    const state = serving(person, { performance: 50 });
    let raised = false;
    for (let n = 0; n < 200; n += 1) {
      const result = done(generation(state, n), { type: 'work' });
      const now = result.state.military.service!.performance;
      expect(now).toBeGreaterThanOrEqual(50);
      if (now > 50) raised = true;
    }
    expect(raised).toBe(true);
  });

  it('names the agency for an agent’s bar', () => {
    const result = done(inAgency(person), { type: 'work' });
    expect(result.outcome!.meter).toEqual({
      label: 'At the agency',
      value: result.state.intel.career!.performance,
    });
    expect(result.state.intel.career).toMatchObject({ effort: 'hard', pushedThisYear: 1 });
  });

  it('refuses a person with nothing to put the work into', () => {
    expect(refused(person, { type: 'work' })).toEqual({
      title: 'Not now',
      body: 'You have no work to put more into.',
      tone: 'bad',
    });
  });
});

describe('applying to an agency', () => {
  const ready = agencyReady();

  it('is hired, passed over or turned down after the investigation, and the card says which', () => {
    const hired = sweep(
      ready,
      { type: 'applyAgency', agency: 'cia' },
      (title) => title === 'You are in',
    );
    expect(hired.result.outcome).toMatchObject({ title: 'You are in', tone: 'good' });
    expect(hired.result.state.intel.career).toMatchObject({ agency: 'cia', stage: 'training' });
    const passed = sweep(
      ready,
      { type: 'applyAgency', agency: 'cia' },
      (title) => title === 'Not this time',
    );
    expect(passed.result.outcome).toMatchObject({ title: 'Not this time', tone: 'neutral' });
    expect(passed.result.state.intel.career).toBeUndefined();
    expect(passed.result.state.intel.appliedAge).toBe(ready.player.age);
  });

  it('can turn somebody down at the clearance, in a card of its own', () => {
    const shaky = withStats(ready, { discipline: 5 });
    const denied = sweep(
      shaky,
      { type: 'applyAgency', agency: 'cia' },
      (title) => title === 'Not cleared',
    );
    expect(denied.result.outcome).toMatchObject({ title: 'Not cleared', tone: 'bad' });
    expect(denied.result.state.intel.career).toBeUndefined();
  });

  it.each([
    ['hired', ready, 'You are in'],
    ['passed over', ready, 'Not this time'],
    ['turned down at the clearance', withStats(ready, { discipline: 5 }), 'Not cleared'],
  ] as const)('puts every line the engine wrote on the card when %s', (_name, state, title) => {
    const { result } = sweep(state, { type: 'applyAgency', agency: 'cia' }, (t) => t === title);
    expect(result.outcome!.body).toBe(result.entries.map((entry) => entry.text).join(' '));
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it.each([
    ['without a degree', person, 'cia', "It takes a bachelor's degree, and you don't have one."],
    ['too young', at(ready, 19), 'cia', "You're too young for that one."],
    ['too old', at(ready, 50), 'cia', "You're past the age that agency takes."],
    [
      'short of experience',
      ready,
      'fbi',
      "They want more professional experience than you've got.",
    ],
    [
      'in uniform',
      serving(ready),
      'cia',
      "You're in uniform. Leave the service first; a clearance stays good for two years.",
    ],
    ['in an agency already', inAgency(ready), 'cia', 'You already work for an agency.'],
    [
      'already applied',
      { ...ready, intel: { past: [], appliedAge: ready.player.age } } as GameState,
      'cia',
      "You've already applied to an agency this year.",
    ],
    ['asking for something that is not one', ready, 'nsa', "That isn't an agency."],
  ] as const)('refuses somebody %s, in words', (_name, state, agency, words) => {
    expect(refused(state, { type: 'applyAgency', agency: agency as 'cia' })).toEqual({
      title: 'Not now',
      body: words,
      tone: 'bad',
    });
  });

  it('does not need a day in uniform: a degree is a way in', () => {
    const { result } = sweep(
      ready,
      { type: 'applyAgency', agency: 'cia' },
      (t) => t === 'You are in',
    );
    expect(result.state.military.past).toEqual([]);
    expect(result.state.intel.career!.door).toBe('degree');
  });
});

describe('leaving an agency', () => {
  it('resigns, with the engine’s line on the card', () => {
    const result = done(inAgency(person), { type: 'leaveAgency' });
    expect(result.state.intel.career).toBeUndefined();
    expect(result.state.intel.past).toHaveLength(1);
    expect(result.outcome).toEqual({
      title: 'You left the agency',
      body: result.entries[0]!.text,
      tone: 'neutral',
    });
    expect(result.state.intel.past[0]!.how).toBe('resigned');
  });

  it('retires with twenty years and the age, and says so', () => {
    const state = at(inAgency(person, { years: 22 }), 52);
    const result = done(state, { type: 'leaveAgency' });
    expect(result.state.intel.past[0]!.how).toBe('retired');
    expect(result.outcome).toMatchObject({ title: 'You retired', tone: 'good' });
  });

  it('refuses somebody who is not in an agency', () => {
    expect(refused(person, { type: 'leaveAgency' })).toEqual({
      title: 'Not now',
      body: "You don't work for an agency.",
      tone: 'bad',
    });
    expect(refused(veteran(person), { type: 'leaveAgency' }).body).toBe(
      "You don't work for an agency.",
    );
    expect(
      refused({ ...person, intel: { past: [pastAgency()] } }, { type: 'leaveAgency' }).tone,
    ).toBe('bad');
  });
});
