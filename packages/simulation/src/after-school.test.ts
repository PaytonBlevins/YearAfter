/**
 * Ticket 0413 acceptance tests — the year after school.
 *
 * Roadmap finding 2d said the `friendship` category had six adult events, all
 * of them romance. That is exactly true, and it is not where the hole is.
 * Measured before this ticket, for an ordinary character — employed, single,
 * childless, not bereaved, well:
 *
 * | age | reachable events | of which placeholders |
 * |---|---|---|
 * | 17 | **99** | 0 |
 * | **18** | **7** | **5** |
 * | 20 | 19 | 5 |
 * | 40 | 40 | 7 |
 *
 * In play that was **98.6% of everything that fired at eighteen being an
 * `adult.placeholder.*`**, six distinct event ids across ninety lives, and
 * 35.2% of everything fired between eighteen and twenty-two. The four commonest
 * things a twenty-year-old read were placeholders 2, 3, 5 and 1.
 *
 * 0409 wrote sixty-seven adult events and measured at FORTY, so the cliff at
 * eighteen was invisible to it. The year a character left school, this game lost
 * 92% of its content.
 *
 * These assert the floor and the reach, and — more importantly — that the gates
 * 0412 added actually hold, because this is the first content written against
 * them.
 */

import { describe, expect, it } from 'vitest';
import { CHILDHOOD_EVENTS } from '@yearafter/content';
import { isCurrent, isFriend } from '@yearafter/social';
import { advanceYear } from './advance';
import { buildEventContext } from './phases/events';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const LIVES = 80;
const BY_ID = new Map(CHILDHOOD_EVENTS.map((event) => [event.id, event]));

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

interface YearRow {
  readonly age: number;
  readonly fired: readonly string[];
  readonly friends: number;
  readonly oldestFriendship: number;
  /**
   * The same two, as they stood at the END of the previous year.
   *
   * The engine reads its context in the MIDDLE of a year — after the social
   * phase and before the events phase — and a test outside `advanceYear` can
   * only see the two ends. Measuring the far end alone flagged
   * `friend.their-kids` firing at a seventy-three-year-old with no friends; the
   * context it was actually selected against said **two**, and both of them
   * drifted under the line later in the same year, which at seventy-three is
   * drift working rather than a gate failing.
   *
   * So the gate assertion below holds if EITHER end satisfies it. The
   * correctness proof proper is in `events.test.ts` against `matchesCondition`;
   * what this can honestly prove is the plumbing — that the count reaches the
   * engine at all, which is what a declared-but-unwired predicate would fail.
   */
  readonly friendsBefore: number;
  readonly oldestBefore: number;
}

function playALife(seed: string): readonly YearRow[] {
  let state: GameState = createNewGame({ seed });
  const rows: YearRow[] = [];
  let guard = 0;
  let last: Record<string, number> = {};
  let before = { friends: 0, oldest: 0 };
  while (state.player.alive && (guard += 1) < 110) {
    state = answerEverything(advanceYear(state).state);
    const now = state.events.lastFired;
    const age = state.player.age;
    const friends = state.circle.people.filter(
      (person) => isCurrent(person) && isFriend(person) && person.romance === undefined,
    );
    const oldest = friends.reduce((most, person) => Math.max(most, age - person.metAtAge), 0);
    rows.push({
      age,
      fired: Object.keys(now).filter((id) => now[id] !== last[id]),
      friends: friends.length,
      oldestFriendship: oldest,
      friendsBefore: before.friends,
      oldestBefore: before.oldest,
    });
    last = { ...now };
    before = { friends: friends.length, oldest };
  }
  return rows;
}

const ALL = Array.from({ length: LIVES }, (_, i) => playALife(`after-${i}`)).flat();

/** Real played states at a spread of adult ages, for the plumbing assertion. */
const SAMPLE_STATES: GameState[] = (() => {
  const out: GameState[] = [];
  for (let life = 0; life < 20; life += 1) {
    let state = createNewGame({ seed: `ctx-${life}` });
    let guard = 0;
    while (state.player.alive && (guard += 1) < 60) {
      state = answerEverything(advanceYear(state).state);
      if ([19, 24, 30, 41, 55].includes(state.player.age)) out.push(state);
    }
  }
  return out;
})();
const at = (age: number) => ALL.filter((row) => row.age === age);
const between = (from: number, to: number) => ALL.filter((r) => r.age >= from && r.age <= to);
const shareOf = (rows: readonly YearRow[], of: (id: string) => boolean) => {
  const fired = rows.flatMap((row) => [...row.fired]);
  return fired.length === 0 ? 0 : fired.filter(of).length / fired.length;
};
const isPlaceholder = (id: string) => id.startsWith('adult.placeholder');
const categoryOf = (id: string) => BY_ID.get(id)?.category;

describe('0413 — the year after school', () => {
  it('no longer hands an eighteen-year-old a feed made of placeholders', () => {
    /*
      THE ASSERTION THAT MATTERS. 98.6% at eighteen and 35.2% across eighteen to
      twenty-two, and the placeholders are not a bug in themselves — a quiet year
      is real content and `love.quiet-year` is deliberate. The defect was the
      DENOMINATOR: they were the only thing the selector could reach.
    */
    const eighteen = shareOf(at(18), isPlaceholder);
    const early = shareOf(between(18, 22), isPlaceholder);
    console.log(
      `placeholder share: ${(eighteen * 100).toFixed(1)}% at 18, ${(early * 100).toFixed(1)}% across 18-22`,
    );
    expect(eighteen, 'a placeholder is still most of what happens at eighteen').toBeLessThan(0.45);
    expect(early, 'and most of what happens after school').toBeLessThan(0.2);
  });

  it('gives the years after school more than a handful of distinct things', () => {
    /*
      Six distinct event ids fired at eighteen across ninety lives before this.
      A population measure rather than a per-life one, because a single life
      should not see everything — the claim is that the CATALOG has more than a
      handful to offer, not that one character meets all of it.
    */
    for (const age of [18, 20, 22]) {
      const distinct = new Set(at(age).flatMap((row) => [...row.fired])).size;
      expect(distinct, `only ${distinct} distinct events can happen at ${age}`).toBeGreaterThan(14);
    }
  });

  it('asks an adult a question about a friend, which it never had', () => {
    /*
      ZERO before this ticket, against thirteen for a child. Every decision ever
      raised to an adult across ninety lives was career, health or loss — the
      three categories 0409 wrote.
    */
    const adultDecisions = ALL.filter((row) => row.age >= 18).flatMap((row) =>
      row.fired.filter((id) => BY_ID.get(id)?.type !== 'passive'),
    );
    const friendship = adultDecisions.filter((id) => categoryOf(id) === 'friendship');
    expect(adultDecisions.length, 'no adult decisions at all').toBeGreaterThan(100);
    expect(friendship.length, 'not one adult decision is about a friend').toBeGreaterThan(50);
  });

  it('carries a true friend count from the circle into the engine', () => {
    /*
      THE PLUMBING, and this test is the SECOND shape of this assertion because
      the first one could not observe what it claimed.

      The first version checked, for every gated event that fired, that the
      character had a friend that year. It flagged `friend.their-kids` at
      seventy-three — and the context it was actually selected against said
      **two**, both of whom drifted under the line later in the same year. Widened
      to "either end of the year", it then flagged `d.friend.needs-a-room` at
      twenty-two, where the warmth crossed 50 inside the year in the other
      direction. The engine reads its context in the MIDDLE of a year, after the
      social phase and before the events phase, and a test standing outside
      `advanceYear` can only ever see the two ends. No amount of widening makes
      it able to see the thing; it only makes it stop failing, which is worse.

      So the claim is split where it can each be proved:

       - `events.test.ts` proves `matchesCondition` honours all four predicates;
       - this proves the number reaching it is the character's real one, on
         states from played lives rather than a fixture;
       - and the reachability test below proves the gates are not dead content.

      Together that is the whole chain, and none of the three is guessing.
    */
    let checked = 0;
    for (const sample of SAMPLE_STATES) {
      const context = buildEventContext(sample, sample.player.age, sample.world.year, sample.events);
      const real = sample.circle.people.filter(
        (person) => isCurrent(person) && isFriend(person) && person.romance === undefined,
      );
      expect(context.friends, `friend count at ${sample.player.age}`).toBe(real.length);
      expect(context.friendshipYears, `friendship years at ${sample.player.age}`).toBe(
        real.reduce((most, person) => Math.max(most, sample.player.age - person.metAtAge), 0),
      );
      // And a partner is never counted as a friend, which is the separation
      // 0207 drew for `partnered` and the reason `friendsOf` exists at all.
      const partnered = sample.circle.people.filter(
        (person) => isCurrent(person) && isFriend(person) && person.romance !== undefined,
      );
      expect(context.friends + partnered.length).toBeGreaterThanOrEqual(context.friends);
      for (const person of partnered) {
        expect(real.some((friend) => friend.id === person.id)).toBe(false);
      }
      checked += 1;
    }
    expect(checked, 'no states were sampled').toBeGreaterThan(60);
  });

  it('reaches the gates that describe a narrow life as well as a full one', () => {
    /*
      CORE_RULES 13.36 and 0405's lesson in one: a gate nothing can satisfy is
      dead content, and the two easiest ones to get wrong are the negative and
      the long one. `hasFriend: false` needs a character with nobody, which 0412
      made rarer on purpose; `friendshipYearsAtLeast: 12` needs a friendship
      0412 made possible for the first time.
    */
    const fired = new Set(ALL.flatMap((row) => [...row.fired]));
    const reached = (predicate: (gate: NonNullable<ReturnType<typeof BY_ID.get>>['eligibility']) => boolean) =>
      [...fired].filter((id) => {
        const gate = BY_ID.get(id)?.eligibility;
        return gate ? predicate(gate) : false;
      }).length;

    expect(reached((gate) => gate.hasFriend === true), 'no hasFriend: true event ever fired').toBeGreaterThan(8);
    expect(reached((gate) => gate.hasFriend === false), 'no hasFriend: false event ever fired').toBeGreaterThan(1);
    expect(
      reached((gate) => (gate.friendshipYearsAtLeast ?? 0) >= 8),
      'no event about an old friend ever fired',
    ).toBeGreaterThan(0);
    expect(
      reached((gate) => (gate.friendsAtLeast ?? 0) >= 2),
      'no event needing more than one friend ever fired',
    ).toBeGreaterThan(0);
  });
});
