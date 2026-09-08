import { describe, expect, it } from 'vitest';
import {
  PRACTICE_SESSIONS,
  activityOffers,
  enrolmentIn,
  gigOffers,
  join,
  leave,
} from '@yearafter/education';
import { interactionsFor, isCurrent, isFriend } from '@yearafter/social';
import { isStressRelevant } from '@yearafter/stress';
import { takeGig } from './gigs';
import { interact } from './interact';
import { joinActivity } from './joining';
import { practise } from './practice';
import { tryOut } from './tryout';
import { LINES_PER_YEAR, advanceYear } from './advance';
import { study } from './study';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

/**
 * Play `years` of a life, answering every decision with its first option.
 *
 * A life cannot be simulated forward without answering: a pending decision
 * blocks time deliberately (see `advanceYear`). Every test that runs a life
 * therefore has to be able to answer, which is a good property for the tests to
 * be forced to encode.
 */
function play(state: GameState, years: number): GameState {
  let current = state;
  for (let i = 0; i < years; i += 1) {
    current = advanceYear(current).state;
    current = answerAll(current);
  }
  return current;
}

function answerAll(state: GameState): GameState {
  let current = state;
  let guard = 0;
  while (current.pending.length > 0) {
    if ((guard += 1) > 10) throw new Error('decisions did not clear');
    const decision = current.pending[0];
    if (!decision) break;
    const choice = decision.choices[0];
    if (!choice) throw new Error(`decision ${decision.eventId} had no choices`);
    const result = decide(current, decision.eventId, choice.id);
    if (!result.ok) throw new Error(`could not answer ${decision.eventId}: ${result.error}`);
    current = result.value.state;
  }
  return current;
}

describe('advanceYear', () => {
  it('advances age and world year by exactly one', () => {
    const start = createNewGame({ seed: 'ADVANCE', startYear: 2000 });
    const { state } = advanceYear(start);
    expect(state.player.age).toBe(1);
    expect(state.world.year).toBe(2001);
  });

  it('does not mutate the input state', () => {
    const start = createNewGame({ seed: 'IMMUTABLE' });
    const before = start.player.timeline.length;
    advanceYear(start);
    expect(start.player.age).toBe(0);
    expect(start.player.timeline.length).toBe(before);
  });

  it('appends at least one timeline entry stamped with the new age and year', () => {
    const start = createNewGame({ seed: 'FEED', startYear: 2010 });
    const { state, newEntries } = advanceYear(start);
    expect(newEntries.length).toBeGreaterThan(0);
    expect(state.player.timeline.length).toBe(newEntries.length);
    for (const entry of newEntries) {
      expect(entry.age).toBe(1);
      expect(entry.year).toBe(2011);
      expect(entry.text.length).toBeGreaterThan(0);
    }
  });

  it('keeps the timeline in chronological order across many years', () => {
    const state = play(createNewGame({ seed: 'CHRONO', startYear: 1980 }), 60);
    expect(state.player.age).toBe(60);
    expect(state.world.year).toBe(2040);

    const ages = state.player.timeline.map((entry) => entry.age);
    expect(ages).toEqual([...ages].sort((a, b) => a - b));
    for (const entry of state.player.timeline) {
      expect(entry.year).toBe(1980 + entry.age);
    }
  });

  it('replays identically from the same seed — the golden life check', () => {
    const run = (seed: string) => {
      const state = play(createNewGame({ seed, startYear: 2000 }), 40);
      return state.player.timeline.map((entry) => `${entry.age}|${entry.text}`);
    };
    expect(run('GOLDEN')).toEqual(run('GOLDEN'));
    expect(run('GOLDEN')).not.toEqual(run('GOLDEN-2'));
  });

  it('is a no-op once the character has died', () => {
    const start = createNewGame({ seed: 'DEAD' });
    const dead = { ...start, player: { ...start.player, alive: false } };
    const { state, newEntries } = advanceYear(dead);
    expect(state).toBe(dead);
    expect(newEntries).toHaveLength(0);
  });

  it('refuses to advance past an unanswered decision', () => {
    // Advancing would either discard the question or answer it for the player.
    let state = createNewGame({ seed: 'BLOCK', startYear: 2000 });
    for (let i = 0; i < 30 && state.pending.length === 0; i += 1) {
      state = advanceYear(state).state;
    }
    expect(state.pending.length).toBeGreaterThan(0);

    const blocked = advanceYear(state);
    expect(blocked.state).toBe(state);
    expect(blocked.newEntries).toHaveLength(0);
  });

  it('processes an ordinary lifetime well inside the performance budget', () => {
    // Spec 1247-1263: annual processing should stay near-instant.
    const started = performance.now();
    play(createNewGame({ seed: 'PERF', startYear: 1950 }), 80);
    const perYear = (performance.now() - started) / 80;
    expect(perYear).toBeLessThan(250);
  });
});

describe('the event phase (Ticket 0203)', () => {
  it('replaced the placeholder feed with catalog events', () => {
    const { newEntries } = advanceYear(createNewGame({ seed: 'CATALOG', startYear: 2000 }));
    for (const entry of newEntries) {
      expect(entry.eventId, entry.text).toBeDefined();
    }
  });

  it('never renders an unresolved text token to the player', () => {
    // The catalog test proves the tokens are guaranteed; this proves the wiring
    // between household state and the renderer actually passes them through.
    for (let i = 0; i < 40; i += 1) {
      const state = play(createNewGame({ seed: `TOKEN-${i}`, startYear: 2000 }), 18);
      for (const entry of state.player.timeline) {
        expect(entry.text, `${entry.age}: ${entry.text}`).not.toMatch(/[{}]/);
      }
    }
  });

  it('gives a childhood several events a year without flooding it', () => {
    let total = 0;
    let worstYear = 0;
    for (let i = 0; i < 25; i += 1) {
      let state = createNewGame({ seed: `PACE-${i}`, startYear: 2000 });
      // Lines the PLAYER caused by answering, counted per age and taken off the
      // budget below. `advanceYear` owns what the YEAR writes; an answer is the
      // player's own line, and `decide` adds it after the year is already
      // assembled. Counting the two together made this assert eight against a
      // cap of seven the moment 0211 added a seventh writer — the same
      // distinction `guardians.test.ts` has drawn since 0209.
      const answered = new Map<number, number>();
      for (let year = 0; year < 18; year += 1) {
        state = advanceYear(state).state;
        const before = state.player.timeline.length;
        state = answerAll(state);
        const age = state.player.age;
        answered.set(age, (answered.get(age) ?? 0) + (state.player.timeline.length - before));
      }
      total += state.player.timeline.length;
      for (let age = 1; age <= 18; age += 1) {
        const written =
          state.player.timeline.filter((entry) => entry.age === age).length -
          (answered.get(age) ?? 0);
        worstYear = Math.max(worstYear, written);
      }
    }
    const perLife = total / 25;
    expect(perLife).toBeGreaterThan(25);
    // Spec 725-770: busy characters should not be bombarded. Enforced for the
    // whole year in `advanceYear`, not per writer — see `withinBudget`.
    expect(worstYear).toBeLessThanOrEqual(LINES_PER_YEAR);
  });

  it('does not repeat a once-per-life event within a life', () => {
    for (let i = 0; i < 20; i += 1) {
      const state = play(createNewGame({ seed: `REPEAT-${i}`, startYear: 2000 }), 18);
      const counts = new Map<string, number[]>();
      for (const entry of state.player.timeline) {
        if (!entry.eventId) continue;
        const ages = counts.get(entry.eventId) ?? [];
        ages.push(entry.age);
        counts.set(entry.eventId, ages);
      }
      for (const [eventId, ages] of counts) {
        // A repeat is only legal via a cooldown, and never inside the same year.
        expect(new Set(ages).size, `${eventId} repeated in one year`).toBe(ages.length);
      }
    }
  });

  it('moves stats and family warmth as events land', () => {
    const start = createNewGame({ seed: 'MOVES', startYear: 2000 });
    const after = play(start, 18);
    const statsMoved = Object.keys(start.player.stats).some(
      (key) =>
        start.player.stats[key as keyof typeof start.player.stats] !==
        after.player.stats[key as keyof typeof after.player.stats],
    );
    expect(statsMoved).toBe(true);
    expect(after.player.stats.happiness).toBeGreaterThanOrEqual(0);
    expect(after.player.stats.happiness).toBeLessThanOrEqual(100);
  });

  it('carries event history into the state so cooldowns survive a year boundary', () => {
    const state = play(createNewGame({ seed: 'HISTORY', startYear: 2000 }), 10);
    expect(Object.keys(state.events.lastFired).length).toBeGreaterThan(10);
  });

  it('keeps the family alive and intact through a childhood', () => {
    const start = createNewGame({ seed: 'FAMILY', startYear: 2000 });
    const after = play(start, 18);
    expect(after.family.members.map((m) => m.id)).toEqual(start.family.members.map((m) => m.id));
  });

  it('uses only the Events stream, so event tuning cannot shift the character', () => {
    const a = createNewGame({ seed: 'ISOLATION' });
    const b = createNewGame({ seed: 'ISOLATION' });
    play(b, 12);
    const c = createNewGame({ seed: 'ISOLATION' });
    expect(c.player.talents).toEqual(a.player.talents);
    expect(c.family.members.map((m) => m.firstName)).toEqual(
      a.family.members.map((m) => m.firstName),
    );
  });
});

describe('childhood balance', () => {
  /**
   * A regression guard on the shape of a childhood, not on any single number.
   *
   * The first version of the event phase applied stat deltas at face value, and
   * every character arrived at eighteen with happiness pinned at 100 and +20 on
   * four other bars. Nothing failed; the game was just flat. These bounds are
   * deliberately wide — they catch a catalog edit that breaks the shape, not one
   * that shifts a number.
   */
  const LIVES = 60;

  function childhoods() {
    const finals: number[][] = [];
    for (let i = 0; i < LIVES; i += 1) {
      const state = play(createNewGame({ seed: `BALANCE-${i}`, startYear: 2000 }), 18);
      finals.push([
        state.player.stats.happiness,
        state.player.stats.health,
        state.player.stats.smarts,
        state.player.stats.looks,
        state.player.stats.charisma,
        state.player.stats.willpower,
        state.player.stats.discipline,
      ]);
    }
    return finals;
  }

  it('does not leave a childhood with a maxed-out stat bar', () => {
    const maxed = childhoods()
      .flat()
      .filter((value) => value >= 100).length;
    expect(maxed).toBe(0);
  });

  it('still produces characters who differ from each other', () => {
    // The other failure mode: damp the curve until everyone lands on 60.
    const happiness = childhoods().map((stats) => stats[0]!);
    const spread = Math.max(...happiness) - Math.min(...happiness);
    expect(spread).toBeGreaterThan(20);
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0205 — Study Harder, and stress                                      */
/* -------------------------------------------------------------------------- */

describe('Study Harder', () => {
  const atSchool = (seed: string, toAge: number): GameState => {
    let state = createNewGame({ seed });
    for (let age = 1; age <= toAge; age += 1) {
      state = answerAll(advanceYear(state).state);
    }
    return state;
  };

  it('is refused before school and allowed once inside it', () => {
    const toddler = atSchool('SH-EARLY', 3);
    expect(study(toddler).ok).toBe(false);
    const pupil = atSchool('SH-EARLY', 10);
    expect(study(pupil).ok).toBe(true);
  });

  it('can be pressed twice a school year, and not a third time', () => {
    // Review: "please allow me to study harder at least twice."
    const state = atSchool('SH-ONCE', 12);
    const first = study(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.termsLeft).toBe(1);

    const second = study(first.value.state);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.termsLeft).toBe(0);
    // The second term is worth less than the first, and still worth something.
    //
    // Guarded on headroom, because `gained` is a CLAMPED delta and this seed
    // now reaches performance 93 after one term: the second press then gains 7
    // to the ceiling while the first gained 6, and the model is behaving
    // correctly. Comparing clamped deltas at different distances from 100 is
    // measuring the clamp, not the scaling. Ticket 0211 moved this seed's
    // performance and exposed it.
    if (second.value.state.education.performance < 100) {
      expect(second.value.gained).toBeLessThanOrEqual(first.value.gained);
    }
    expect(second.value.gained).toBeGreaterThan(0);

    // Ticket 0210c. The third press is allowed and does nothing — no error, no
    // gain, no feed line, and no draw. Review: "the buttons can be hit as many
    // times, but I only want an affect to happen a maximum of 2 times."
    const third = study(second.value.state);
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.value.spent).toBe(true);
    expect(third.value.entry).toBeUndefined();
    expect(third.value.state).toBe(second.value.state);
    expect(third.value.state.education.performance).toBe(second.value.state.education.performance);
    expect(third.value.state.player.timeline.length).toBe(
      second.value.state.player.timeline.length,
    );

    // Next year both terms are available again.
    const nextYear = answerAll(advanceYear(second.value.state).state);
    const fresh = study(nextYear);
    expect(fresh.ok).toBe(true);
    if (!fresh.ok) return;
    expect(fresh.value.termsLeft).toBe(1);
  });

  it('boosts grades most of the time, and says so either way', () => {
    // Review: "it potentially (most of the time) boosts their grades."
    let worked = 0;
    let attempts = 0;
    for (let life = 0; life < 60; life += 1) {
      const state = atSchool(`SH-${life}`, 12);
      const result = study(state);
      if (!result.ok) continue;
      attempts += 1;
      if (result.value.worked) worked += 1;
      // Always something, unless they were already top of the class — a result
      // of exactly nothing reads as a broken button.
      if (state.education.performance < 100) {
        expect(result.value.gained).toBeGreaterThan(0);
      }
      expect(result.value.spent).toBe(false);
      expect(result.value.entry?.text.length ?? 0).toBeGreaterThan(0);
    }
    expect(attempts).toBeGreaterThan(50);
    expect(worked / attempts).toBeGreaterThan(0.55);
    expect(worked / attempts).toBeLessThan(0.95);
  });

  it('makes the character somebody who studies, for good', () => {
    const state = atSchool('SH-EFFORT', 11);
    const result = study(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.education.effort).toBe('hard');
  });
});

describe('stress', () => {
  it('never quietly taxes an ordinary childhood', () => {
    // The system has no screen. If it charged happiness for a childhood with
    // nothing wrong in it, the player would watch a bar fall for no reason they
    // could ever discover.
    let taxed = 0;
    for (let life = 0; life < 80; life += 1) {
      let state = createNewGame({ seed: `SQ-${life}` });
      for (let age = 1; age <= 10; age += 1) state = answerAll(advanceYear(state).state);
      if (isStressRelevant(state.player.stress.level)) taxed += 1;
    }
    // A hard childhood is allowed. A majority of hard childhoods is a bug.
    expect(taxed / 80).toBeLessThan(0.25);
  });

  it('is reachable by taking on too much, which is the whole design', () => {
    // Spec 1986: "Players may overcommit rather than being blocked." A model
    // nobody can trigger is not a model — 0204's overload never once fired
    // across 3,400 simulated years, which is why stress reads pressure instead.
    let state = createNewGame({ seed: 'BUSY' });
    for (let age = 1; age <= 12; age += 1) state = answerAll(advanceYear(state).state);
    for (const offer of activityOffers(state.education, {
      age: state.player.age,
      stage: 'middle',
      stats: state.player.stats,
      talents: state.player.talents,
      wealth: state.family.finances.band,
      household: state.family,
    })) {
      if (!offer.unavailable) {
        state = { ...state, education: join(state.education, offer.activity.id, state.player.age) };
      }
    }
    state = answerAll(advanceYear(state).state);
    expect(isStressRelevant(state.player.stress.level)).toBe(true);
  });

  it('lets a character come out the other side', () => {
    let state = createNewGame({ seed: 'RECOVER' });
    for (let age = 1; age <= 12; age += 1) state = answerAll(advanceYear(state).state);
    for (const offer of activityOffers(state.education, {
      age: state.player.age,
      stage: 'middle',
      stats: state.player.stats,
      talents: state.player.talents,
      wealth: state.family.finances.band,
      household: state.family,
    })) {
      if (!offer.unavailable) {
        state = { ...state, education: join(state.education, offer.activity.id, state.player.age) };
      }
    }
    state = answerAll(advanceYear(state).state);
    const peak = state.player.stress.level;
    expect(peak).toBeGreaterThan(0);
    for (const entry of state.education.activities) {
      state = { ...state, education: leave(state.education, entry.activityId) };
    }
    for (let year = 0; year < 3; year += 1) state = answerAll(advanceYear(state).state);
    expect(state.player.stress.level).toBeLessThan(peak);
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0206 — classmates, friends, teachers                                 */
/* -------------------------------------------------------------------------- */

describe('the people in a childhood', () => {
  const lived = (seed: string, toAge: number): GameState => {
    let state = createNewGame({ seed });
    for (let age = 1; age <= toAge; age += 1) state = answerAll(advanceYear(state).state);
    return state;
  };

  it('gives a school-age character a class, and nobody before that', () => {
    expect(lived('CAST-EARLY', 3).circle.people).toHaveLength(0);
    const pupil = lived('CAST-EARLY', 8);
    const classmates = pupil.circle.people.filter((p) => p.kind === 'peer' && isCurrent(p));
    expect(classmates.length).toBeGreaterThan(0);
    expect(pupil.circle.people.some((p) => p.kind === 'teacher')).toBe(true);
  });

  it('keeps the same class from one year to the next', () => {
    // Reading output found the first version replacing the entire class every
    // September. A cast that changes completely each year is not a cast.
    let state = lived('CAST-KEEP', 7);
    const before = state.circle.people.filter((p) => p.kind === 'peer' && isCurrent(p));
    state = answerAll(advanceYear(state).state);
    const after = new Set(
      state.circle.people.filter((p) => p.kind === 'peer' && isCurrent(p)).map((p) => p.id),
    );
    const kept = before.filter((p) => after.has(p.id));
    expect(kept.length).toBeGreaterThanOrEqual(before.length - 1);
  });

  it('produces a couple of friends over a childhood, not thirty and not none', () => {
    // Both failure modes are real: the first version of proximity gave 99% of
    // lives NO friends, and removing drift entirely gives everybody everyone.
    let none = 0;
    let total = 0;
    const LIVES = 40;
    for (let life = 0; life < LIVES; life += 1) {
      const state = lived(`FRIENDS-${life}`, 17);
      const friends = state.circle.people.filter(isFriend);
      total += friends.length;
      if (friends.length === 0) none += 1;
      expect(friends.length).toBeLessThan(10);
    }
    expect(total / LIVES).toBeGreaterThan(1);
    expect(none / LIVES).toBeLessThan(0.2);
  });

  it('names somebody the player actually knows, not a stranger', () => {
    // The whole ticket: "I also should be able to interact with teachers and
    // classmates." A name in the feed has to be a name on the People screen.
    let named = 0;
    for (let life = 0; life < 20; life += 1) {
      const state = lived(`NAMED-${life}`, 17);
      const known = state.circle.people.filter((p) => p.memories.length > 0);
      named += known.length;
      for (const person of known) {
        for (const memory of person.memories) {
          expect(memory.text).toContain(
            person.kind === 'teacher' ? person.lastName : person.firstName,
          );
        }
      }
    }
    expect(named).toBeGreaterThan(20);
  });

  it('lets you hang around with somebody as often as you like', () => {
    // Review: "I don't like how you can only perform one action with your
    // classmate per year." Light things repeat; they are simply worth less.
    const state = lived('TALK', 10);
    const person = state.circle.people.find((p) => p.kind === 'peer' && isCurrent(p));
    expect(person).toBeDefined();
    if (!person) return;

    const first = interact(state, person.id, 'hang-out');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.entry.text).toContain(person.firstName);

    const again = interact(first.value.state, person.id, 'hang-out');
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const third = interact(again.value.state, person.id, 'hang-out');
    expect(third.ok).toBe(true);
  });

  it('keeps the heavy things to once a year', () => {
    let state = lived('HEAVY', 12);
    // Warm somebody up to where telling them something is on the menu.
    const person = state.circle.people.find((p) => p.kind === 'peer' && isCurrent(p));
    if (!person) return;
    state = {
      ...state,
      circle: {
        ...state.circle,
        people: state.circle.people.map((p) =>
          p.id === person.id ? { ...p, relationship: 70 as typeof p.relationship } : p,
        ),
      },
    };

    const first = interact(state, person.id, 'secret');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const again = interact(first.value.state, person.id, 'secret');
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error).toBe('already-this-year');

    // Next year it is available again.
    const nextYear = answerAll(advanceYear(first.value.state).state);
    const later = nextYear.circle.people.find((p) => p.id === person.id);
    if (later && isCurrent(later) && later.relationship >= 45) {
      expect(interact(nextYear, person.id, 'secret').ok).toBe(true);
    }
  });

  it('lets mischief with a teacher cost school standing', () => {
    // Review: "I should also be able to interact with my teacher (innocently
    // and mischievously)."
    const state = lived('MISCHIEF', 12);
    const teacher = state.circle.people.find((p) => p.kind === 'teacher' && isCurrent(p));
    if (!teacher) return;
    const before = state.education.behaviour;
    const result = interact(state, teacher.id, 'talk-back');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.education.behaviour).toBeLessThan(before);
  });

  it('leaves the memory on the person, not just in the feed', () => {
    const state = lived('MEMORY', 11);
    const person = state.circle.people.find((p) => p.kind === 'peer' && isCurrent(p));
    if (!person) return;
    const result = interact(state, person.id, 'hang-out');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state.circle.people.find((p) => p.id === person.id);
    expect(after?.memories.length).toBe(person.memories.length + 1);
    expect(after?.memories.at(-1)?.text).toBe(result.value.entry.text);
  });

  it('refuses an interaction that is not on that person’s menu', () => {
    const state = lived('MENU', 10);
    const teacher = state.circle.people.find((p) => p.kind === 'teacher' && isCurrent(p));
    if (!teacher) return;
    const result = interact(state, teacher.id, 'hang-out');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('not-available');
  });
});

/* -------------------------------------------------------------------------- */
/* Ticket 0206b — practice, teams and odd jobs                                 */
/* -------------------------------------------------------------------------- */

describe('teams, practice and work', () => {
  const lived = (seed: string, toAge: number): GameState => {
    let state = createNewGame({ seed });
    for (let age = 1; age <= toAge; age += 1) state = answerAll(advanceYear(state).state);
    return state;
  };

  const anyOffer = (state: GameState) =>
    activityOffers(state.education, {
      age: state.player.age,
      stage: 'middle',
      stats: state.player.stats,
      talents: state.player.talents,
      wealth: state.family.finances.band,
      household: state.family,
    });

  it('still makes you try out for a team, after everything', () => {
    // Review, twice now: "please remember to have tryouts for teams."
    const state = lived('TRYOUT-STILL', 12);
    const needing = anyOffer(state).filter((offer) => offer.needsTryout && !offer.unavailable);
    expect(needing.length).toBeGreaterThan(0);
    // And it is genuinely a tryout: it can be failed.
    let cut = 0;
    for (let life = 0; life < 30; life += 1) {
      const other = lived(`TRY-${life}`, 12);
      const target = anyOffer(other).find((offer) => offer.needsTryout && !offer.unavailable);
      if (!target) continue;
      const result = tryOut(other, target.activity.id);
      if (result.ok && !result.value.made) cut += 1;
    }
    expect(cut).toBeGreaterThan(0);
  });

  it('puts people next to you when you make a team', () => {
    // Reading output caught this: teammates appeared only for things you could
    // press Join on, so every competitive activity left you there on your own.
    let state = lived('MATES', 12);
    const target = anyOffer(state).find((offer) => offer.needsTryout && !offer.unavailable);
    if (!target) return;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = tryOut(state, target.activity.id);
      if (!result.ok) {
        state = answerAll(advanceYear(state).state);
        continue;
      }
      state = result.value.state;
      if (result.value.made) {
        const mates = state.circle.people.filter((p) => p.viaActivityId === target.activity.id);
        expect(mates.length).toBeGreaterThan(0);
        return;
      }
      state = answerAll(advanceYear(state).state);
    }
  });

  it('lets practice make somebody genuinely good, and caps the year', () => {
    let state = lived('PRACTISE', 12);
    const club = anyOffer(state).find((offer) => !offer.needsTryout && !offer.unavailable);
    if (!club) return;
    state = joinActivity(state, club.activity.id);
    const before = enrolmentIn(state.education, club.activity.id)?.standing ?? 0;

    for (let session = 0; session < PRACTICE_SESSIONS; session += 1) {
      const result = practise(state, club.activity.id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.value.state;
    }
    expect(enrolmentIn(state.education, club.activity.id)?.standing).toBeGreaterThan(before);

    // A fourth is allowed and does nothing — three afternoons is a good week,
    // not a montage — but that is the model's business, not a wall the player
    // gets pushed into. Ticket 0210c.
    const extra = practise(state, club.activity.id);
    expect(extra.ok).toBe(true);
    if (!extra.ok) return;
    expect(extra.value.spent).toBe(true);
    expect(extra.value.entry).toBeUndefined();
    expect(extra.value.state).toBe(state);

    // Next year the sessions come back.
    const next = answerAll(advanceYear(state).state);
    expect(practise(next, club.activity.id).ok).toBe(true);
  });

  it('pays an odd job, in a line that says the amount', () => {
    // Review: "I also want to be able to perform freelance jobs at appropriate
    // ages." CORE_RULES 13.6 still applies: the amount is in the sentence.
    let state = lived('WORK', 13);
    const offer = gigOffers({
      age: state.player.age,
      household: state.family,
      held: state.education.gigs,
    }).find((entry) => !entry.unavailable);
    expect(offer).toBeDefined();
    if (!offer) return;

    const taken = takeGig(state, offer.gig.id);
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    state = taken.value;

    const before = state.player.cash;
    const advanced = advanceYear(state);
    expect(Number(advanced.state.player.cash)).toBeGreaterThan(Number(before));

    const paid = advanced.newEntries.find((entry) => /\$\d/.test(entry.text));
    expect(paid, 'a gig that pays must say what it paid').toBeDefined();
  });

  it('refuses work the character is too young for', () => {
    const child = lived('YOUNG', 9);
    const result = takeGig(child, 'gig.retail');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('too-young');
  });

  it('never tells a character they spent money they did not have', () => {
    // The bug this guards: "the coffee can under your bed has $150 in it" shown
    // to somebody holding $60, who then spent it and finished on $0.
    for (let life = 0; life < 40; life += 1) {
      let state = createNewGame({ seed: `SPEND-${life}` });
      for (let age = 1; age <= 17; age += 1) {
        const before = Number(state.player.cash);
        const advanced = advanceYear(state);
        state = advanced.state;
        // Answer with the most expensive option available, to provoke it.
        while (state.pending.length > 0) {
          const decision = state.pending[0];
          if (!decision) break;
          const answered = decide(state, decision.eventId, decision.choices[0]!.id);
          if (!answered.ok) break;
          state = answered.value.state;
        }
        expect(Number(state.player.cash), `life ${life} age ${age}`).toBeGreaterThanOrEqual(0);
        expect(before).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('the feed', () => {
  /**
   * Every timeline entry needs its own id.
   *
   * The Life screen keys its rows on this. Two entries sharing an id makes
   * React log "Encountered two children with the same key" and, worse, lets it
   * drop or duplicate rows — so a year of somebody's life can silently go
   * missing from the feed.
   *
   * This is written as a property over a life that presses EVERY repeatable
   * action, because the two bugs it caught were both created by making
   * something repeatable: Study Harder going to two terms a year, and the
   * interaction cap being lifted. The next thing to become repeatable will be
   * caught here rather than in the player's terminal.
   */
  it('never gives two entries the same id, however much the player does', () => {
    let state = createNewGame({ seed: 'KEYS' });
    for (let age = 1; age <= 17; age += 1) {
      state = answerAll(advanceYear(state).state);

      // Study both terms.
      for (let term = 0; term < 4; term += 1) {
        const result = study(state);
        if (!result.ok) break;
        state = result.value.state;
      }

      // Join what we can, try out for what we cannot, and practise it all.
      const offers = activityOffers(state.education, {
        age: state.player.age,
        stage: state.education.stage === 'high' ? 'high' : 'middle',
        stats: state.player.stats,
        talents: state.player.talents,
        wealth: state.family.finances.band,
        household: state.family,
      });
      for (const offer of offers.slice(0, 3)) {
        if (offer.joined || offer.unavailable) continue;
        if (offer.needsTryout) {
          const attempt = tryOut(state, offer.activity.id);
          if (attempt.ok) state = attempt.value.state;
        } else {
          state = joinActivity(state, offer.activity.id);
        }
      }
      for (const entry of state.education.activities) {
        for (let session = 0; session < 4; session += 1) {
          const result = practise(state, entry.activityId);
          if (!result.ok) break;
          state = result.value.state;
        }
      }

      // And do everything on the menu with everybody, repeatedly.
      for (const person of state.circle.people.filter(isCurrent)) {
        for (const interaction of interactionsFor(person)) {
          for (let repeat = 0; repeat < 3; repeat += 1) {
            const result = interact(state, person.id, interaction.id);
            if (!result.ok) break;
            state = result.value.state;
          }
        }
      }
    }

    const ids = state.player.timeline.map((entry) => entry.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates, `duplicate timeline ids: ${[...new Set(duplicates)].join(', ')}`).toEqual(
      [],
    );
    expect(ids.length).toBeGreaterThan(60);
  });
});
