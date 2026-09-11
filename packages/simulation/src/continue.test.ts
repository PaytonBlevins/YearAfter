/**
 * Ticket 0212 acceptance tests.
 *
 * The properties that matter are the ones a screenshot would catch too late:
 * does the heir arrive with a life, can they be played, and does the world
 * carry on being one world rather than restarting inside itself.
 */

import { describe, expect, it } from 'vitest';
import { livingChildren } from '@yearafter/relationships';
import { movesFor } from '@yearafter/social';
import { advanceYear } from './advance';
import { continueAsChild, heirsIn } from './continue';
import { decide } from './decide';
import { eulogyFor, highlightsOf, MAX_HIGHLIGHTS } from './eulogy';
import { createNewGame } from './new-game';
import { tryForBaby } from './parenting';
import { romanticMove } from './romance';
import { useDatingApp } from './dating';
import type { GameState } from './game-state';

/** A life played the way a player plays one, to the end. */
function playToDeath(seed: string): GameState {
  let state = createNewGame({ seed });
  for (let year = 0; year < 120; year += 1) {
    state = advanceYear(state).state;
    if (!state.player.alive) break;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const result = decide(state, decision.eventId, choice.id);
      if (!result.ok) break;
      state = result.value.state;
    }
    if (state.player.age >= 16) {
      const app = useDatingApp(state);
      if (app.ok) state = app.value.state;
      const candidates = [...state.circle.people]
        .filter((person) => person.kind === 'peer' && person.endedAtAge === undefined && person.alive)
        .sort((left, right) => right.relationship - left.relationship);
      for (const person of candidates.slice(0, 3)) {
        const moves = movesFor(person, state.player.age, Number(state.player.cash)).filter(
          (move) => move.id !== 'break-up' && move.id !== 'divorce',
        );
        const move = moves[moves.length - 1];
        if (!move) continue;
        const result = romanticMove(state, person.id, move.id);
        if (result.ok) state = result.value.state;
      }
    }
    if (state.player.age >= 22 && state.player.age <= 42) {
      const result = tryForBaby(state);
      if (result.ok) state = result.value.state;
    }
  }
  return state;
}

/** A played life that ended with somebody to carry on as. */
function lifeWithAnHeir(): GameState {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = playToDeath(`HEIR-${attempt}`);
    if (!state.player.alive && heirsIn(state.family).length > 0) return state;
  }
  throw new Error('no played life produced a living heir — the continuation is unreachable');
}

describe('the end of a life', () => {
  it('names the seven things spec 1284 asks for, and no score', () => {
    const state = lifeWithAnHeir();
    const eulogy = eulogyFor(state);

    expect(eulogy.name).toContain(state.player.firstName);
    expect(eulogy.age).toBeGreaterThan(0);
    expect(eulogy.cause.length).toBeGreaterThan(0);
    expect(eulogy.identity.length).toBeGreaterThan(0);
    expect(eulogy.summary.length).toBeGreaterThan(0);
    expect(eulogy.bornYear).toBeLessThan(eulogy.diedYear);
    // Spec 818–827 forbids net worth and a prestige score BY NAME. Nothing on
    // the assembled eulogy may be a number the player could treat as a result.
    expect(Object.keys(eulogy)).not.toContain('score');
    expect(Object.keys(eulogy)).not.toContain('netWorth');
    expect(JSON.stringify(eulogy)).not.toMatch(/\$/);
  });

  it('never shows more than five highlights', () => {
    const state = lifeWithAnHeir();
    expect(eulogyFor(state).highlights.length).toBeLessThanOrEqual(MAX_HIGHLIGHTS);
  });

  it('prefers what you did over who you lost', () => {
    // The defect this exists to prevent: a passive life's raw record list is a
    // graduation and two funerals, so a screen that printed records in order
    // would summarise every quiet life as an obituary of other people.
    const records = [
      { id: 'a', category: 'family' as const, age: 40, year: 2040, label: 'Lost Dad' },
      { id: 'b', category: 'family' as const, age: 52, year: 2052, label: 'Lost Mom' },
      { id: 'c', category: 'family' as const, age: 60, year: 2060, label: 'Lost Ada' },
      { id: 'd', category: 'family' as const, age: 70, year: 2070, label: 'Lost Kit' },
      { id: 'e', category: 'family' as const, age: 75, year: 2075, label: 'Lost Ray' },
      { id: 'f', category: 'career' as const, age: 19, year: 2019, label: 'First job — Server' },
      { id: 'g', category: 'education' as const, age: 18, year: 2018, label: 'Graduated high school' },
    ];
    const picked = highlightsOf(records).map((record) => record.label);
    expect(picked).toContain('First job — Server');
    expect(picked).toContain('Graduated high school');
  });

  it('reads forwards through the life, not by importance', () => {
    const state = lifeWithAnHeir();
    const ages = eulogyFor(state).highlights.map((highlight) => highlight.age);
    expect([...ages].sort((left, right) => left - right)).toEqual(ages);
  });
});

describe('continuing as a child', () => {
  it('hands over somebody who has actually lived', () => {
    const state = lifeWithAnHeir();
    const heir = heirsIn(state.family)[0];
    expect(heir).toBeDefined();
    if (!heir) return;

    const next = continueAsChild(state, heir.id);
    expect(next).toBeDefined();
    if (!next) return;

    // The whole point of the reduced model: an heir opens the Life screen on a
    // history rather than an empty page. A middle-aged character with nothing
    // behind them is a worse starting position than a newborn.
    expect(next.player.age).toBeGreaterThan(0);
    if (next.player.age >= 24) {
      expect(next.player.timeline.length).toBeGreaterThan(0);
      expect(next.player.records.length).toBeGreaterThan(0);
    }
  });

  it('carries the world forward rather than restarting it', () => {
    const state = lifeWithAnHeir();
    const heir = heirsIn(state.family)[0];
    if (!heir) return;
    const next = continueAsChild(state, heir.id);
    if (!next) return;

    expect(next.world.year).toBe(state.world.year);
    expect(next.world.generation).toBe(state.world.generation + 1);
    expect(next.rng.getSeed()).toBe(state.rng.getSeed());
    expect(next.nameCultureId).toBe(state.nameCultureId);
  });

  it('makes the character who just died into a dead parent', () => {
    const state = lifeWithAnHeir();
    const heir = heirsIn(state.family)[0];
    if (!heir) return;
    const next = continueAsChild(state, heir.id);
    if (!next) return;

    const forebear = next.family.members.find(
      (member) => member.role === 'mother' || member.role === 'father',
    );
    expect(forebear).toBeDefined();
    expect(forebear?.alive).toBe(false);
    expect(forebear?.firstName).toBe(state.player.firstName);
    // And grief must not charge the heir for it forever — the constant that
    // pulled the player's own p10 age at death from 62 to 55 when NPCs first
    // became mortal. See `griefWeight` in @yearafter/stress.
    expect(forebear?.diedWhenPlayerWas).toBe(next.player.age);
  });

  it('inherits nothing that belonged to the person who died', () => {
    const state = lifeWithAnHeir();
    const heir = heirsIn(state.family)[0];
    if (!heir) return;
    const next = continueAsChild(state, heir.id);
    if (!next) return;

    // A cooldown belongs to whoever used the event, a friend to whoever made
    // them, and a body to whoever lived in it.
    expect(next.circle.people).toHaveLength(0);
    expect(next.health.conditions).toHaveLength(0);
    expect(next.pending).toHaveLength(0);
    expect(next.employment.job).toBeUndefined();
  });

  it('is playable — the heir can advance years like anybody else', () => {
    const state = lifeWithAnHeir();
    const heir = heirsIn(state.family)[0];
    if (!heir) return;
    let next = continueAsChild(state, heir.id);
    expect(next).toBeDefined();
    if (!next) return;

    const startedAt = next.player.age;
    for (let year = 0; year < 5 && next.player.alive; year += 1) {
      const result = advanceYear(next);
      next = result.state;
      let guard = 0;
      while (next.pending.length > 0 && (guard += 1) < 12) {
        const decision = next.pending[0];
        const choice = decision?.choices[0];
        if (!decision || !choice) break;
        const answered = decide(next, decision.eventId, choice.id);
        if (!answered.ok) break;
        next = answered.value.state;
      }
    }
    expect(next.player.age).toBeGreaterThan(startedAt);
  });

  it('refuses an id that is not a living child', () => {
    const state = lifeWithAnHeir();
    expect(continueAsChild(state, 'npc:not-a-real-person')).toBeUndefined();
  });
});

describe("a child's own life", () => {
  it('gives a grown child something to have done', () => {
    // Measured rather than asserted on one seed: across played lives, most
    // grown children should have a job and a history. A model that produced
    // empty adults would pass every test above and still fail the ticket.
    let grown = 0;
    let withAJob = 0;
    let withHistory = 0;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const state = playToDeath(`OFFSPRING-${attempt}`);
      for (const child of livingChildren(state.family)) {
        const age = state.world.year - child.birthYear;
        if (age < 30) continue;
        grown += 1;
        const life = child.life as { jobTitle?: string; timeline?: unknown[] } | undefined;
        if (life?.jobTitle) withAJob += 1;
        if ((life?.timeline?.length ?? 0) > 0) withHistory += 1;
      }
    }
    expect(grown, 'no grown children across 25 lives').toBeGreaterThan(0);
    expect(withHistory / grown).toBeGreaterThan(0.9);
    expect(withAJob / grown).toBeGreaterThan(0.6);
  });
});

describe('the header and the death screen', () => {
  it('never disagree about what somebody was', () => {
    /*
      Ticket 0212, found by reading the built app: the header said "75 ·
      Retired" and the death screen under it said "From Atlanta, GA", about the
      same man at the same moment. 0210 fixed exactly this between the header
      and the Career screen by routing both through `occupationFor`, and a new
      screen re-created it by writing a second derivation. CORE_RULES 13.23.

      A held job is the case where the two MUST be identical. Where they are
      allowed to differ, the death screen is allowed to be more specific —
      never to contradict.
    */
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const state = playToDeath(`IDENTITY-${attempt}`);
      if (state.player.alive) continue;
      const identity = eulogyFor(state).identity;
      if (state.employment.job) {
        expect(identity, `seed ${attempt}`).toBe(state.player.occupation);
      }
      expect(identity.length, `seed ${attempt}`).toBeGreaterThan(0);
      expect(identity, `seed ${attempt}`).not.toBe('Unemployed');
    }
  });
});
