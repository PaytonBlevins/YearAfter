/**
 * Ticket 0211a — work is a room.
 *
 * Player report, after playing 0210c: *"on the people page, in the friends tab,
 * it shows two people in my class, yet I am working a job. It also shows no
 * coworkers on the job screen when it should. You will be surrounded by people,
 * its up to you to build a relationship or not."*
 *
 * Both halves were real. Colleagues were a DOOR — one of three outcomes of a
 * per-year meeting roll, behind a total-circle cap of four — so most working
 * characters never had one; and the People screen grouped everybody who was not
 * yet a friend under a heading reading "Class", whatever room they were from.
 *
 * These play working lives and measure who is actually standing next to the
 * character, which is the only way to tell the difference between a system that
 * exists and a system that fires (CORE_RULES 13.7).
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { isAtCollege } from '@yearafter/education';
import { isCurrent } from '@yearafter/social';
import { advanceYear } from './advance';
import { applyFor, chanceOf, openings, resign } from './careers';
import { applyToCollege, majorsAvailable, nextDegreeFor } from './college';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const LIVES = 60;

const answerAll = (state: GameState): GameState => {
  let current = state;
  let guard = 0;
  while (current.pending.length > 0 && (guard += 1) < 12) {
    const decision = current.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const result = decide(current, decision.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
};

/** Somebody who takes the first job they can get and stays in it. */
function worked(seed: string, until: number): GameState {
  let state = createNewGame({ seed });
  for (let year = 0; year < until; year += 1) {
    state = answerAll(advanceYear(state).state);
    if (state.player.age >= 18 && !state.employment.job) {
      const list = [...openings(state)].sort((a, b) => chanceOf(state, b) - chanceOf(state, a));
      for (const job of list.slice(0, 2)) {
        const result = applyFor(state, String(job.id));
        if (!result.ok) continue;
        state = result.value.state;
        if (result.value.hired) break;
      }
    }
  }
  return state;
}

const colleagues = (state: GameState) =>
  state.circle.people.filter(
    (person) => isCurrent(person) && person.context === 'work' && person.inRoom,
  );

/**
 * Somebody who goes to college and works through it, sampled EVERY YEAR.
 *
 * Sampling only the final state is what the first version did, and it found
 * nothing: a degree runs 18 to 22 and the harness ran to 24, so by the time it
 * looked the class was three years gone. A snapshot answers a question about the
 * moment it was taken, not about the life.
 */
function studiedAndWorked(seed: string): readonly GameState[] {
  let state = createNewGame({ seed });
  const years: GameState[] = [];
  for (let year = 0; year < 24; year += 1) {
    state = answerAll(advanceYear(state).state);
    if (state.player.age === 18 && nextDegreeFor(state)) {
      // Tuition, handed over. 0210b measured that a player who does not ask a
      // parent first is blocked by cost in 200 of 200 lives, and this test is
      // about ROOMS, not about how college gets paid for.
      const funded = { ...state, player: { ...state.player, cash: dollars(60_000) } };
      const major = majorsAvailable()[0];
      const enrolled = major ? applyToCollege(funded, major.id) : undefined;
      state = enrolled?.ok ? enrolled.value.state : state;
    }
    if (state.player.age >= 18 && !state.employment.job) {
      const list = [...openings(state)].sort((a, b) => chanceOf(state, b) - chanceOf(state, a));
      for (const job of list.slice(0, 2)) {
        const result = applyFor(state, String(job.id));
        if (!result.ok) continue;
        state = result.value.state;
        if (result.value.hired) break;
      }
    }
    years.push(state);
  }
  return years;
}

const LIVES_AT_30: readonly GameState[] = Array.from({ length: LIVES }, (_, index) =>
  worked(`work-room-${index}`, 30),
);

describe('holding a job', () => {
  it('puts people around you, without you doing anything', () => {
    // The defect, stated as a number: before this, an employed character had a
    // colleague in a minority of lives and usually exactly one. The player is
    // owed the room whether or not they use it.
    const employed = LIVES_AT_30.filter((state) => state.employment.job);
    expect(employed.length / LIVES, 'employed at 30').toBeGreaterThan(0.6);

    const withPeople = employed.filter((state) => colleagues(state).length > 0);
    // eslint-disable-next-line no-console
    console.log(
      `\nemployed ${employed.length}/${LIVES}; of those, with colleagues ${withPeople.length}`,
      `\nmedian colleagues: ${
        [...employed.map((s) => colleagues(s).length)].sort((a, b) => a - b)[
          Math.floor(employed.length / 2)
        ] ?? 0
      }`,
    );
    expect(withPeople.length).toBe(employed.length);
    for (const state of employed) {
      expect(colleagues(state).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('does not let them drift away while you still work there', () => {
    // The `inRoom` exemption, which is the whole reason the rename mattered:
    // a colleague you never press a button about is still somebody you see
    // every day, exactly like a classmate.
    for (const state of LIVES_AT_30) {
      if (!state.employment.job) continue;
      for (const person of colleagues(state)) {
        expect(person.endedAtAge, person.firstName).toBeUndefined();
      }
    }
  });

  it('leaves them behind when you leave the job', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      let state = worked(`leave-${seed}`, 26);
      if (!state.employment.job) continue;
      const before = colleagues(state).map((person) => person.id);
      if (before.length === 0) continue;

      const quit = resign(state);
      if (!quit.ok) continue;
      state = answerAll(advanceYear(quit.value.state).state);

      // Still people you know — nobody is deleted — but no longer at your work.
      const stillAtWork = colleagues(state).map((person) => person.id);
      for (const id of before) expect(stillAtWork, `seed ${seed}`).not.toContain(id);
      const known = state.circle.people.filter((person) => before.includes(person.id));
      expect(known.length, `seed ${seed}`).toBe(before.length);
      return;
    }
  });

  it('does not put a colleague in the class', () => {
    // The rendering half of the report. Nobody may be in two rooms, and a
    // person's room is their `context` rather than "not yet a friend".
    for (const state of LIVES_AT_30) {
      for (const person of state.circle.people) {
        if (!isCurrent(person) || !person.inRoom) continue;
        if (person.context === 'work') expect(person.viaJobId).toBeDefined();
        if (person.context === 'school') expect(person.viaJobId).toBeUndefined();
      }
    }
  });

  it('gives a working student both a class AND colleagues', () => {
    // The case that decided where `staffTheJob` runs. Putting it inside the
    // adult branch would have hidden one of the two rooms, and that is the
    // exact shape of the bug being fixed (CORE_RULES 13.23).
    //
    // `canWork` is "not at school, OR eighteen" — so the overlap is a college
    // student with a job, not a sixteen-year-old. Odd jobs are what a teenager
    // gets, deliberately.
    for (let seed = 0; seed < 40; seed += 1) {
      for (const state of studiedAndWorked(`student-${seed}`)) {
        if (!state.employment.job || !isAtCollege(state.education)) continue;
        const atWork = colleagues(state);
        const inClassNow = state.circle.people.filter(
          (person) => isCurrent(person) && person.inRoom && person.context === 'school',
        );
        if (atWork.length > 0 && inClassNow.length > 0) return;
      }
    }
    // Not reachable in this build would be a finding, not a pass.
    throw new Error('no character was ever at college and working at the same time');
  });
});
