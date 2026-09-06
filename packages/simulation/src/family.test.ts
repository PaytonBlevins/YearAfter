/**
 * Ticket 0208 acceptance tests, at the level of a whole life.
 *
 * The unit tests in `@yearafter/parenting` prove the model in the small. These
 * play 60 lives to forty-five with a player who wants a family, and assert on
 * the SHAPE — which is where every defect this ticket had was found, all of
 * them with a green suite:
 *
 *  - child asks priced at $90-$650 in a build with no income, so children asked
 *    for things 702 times and the parent could say yes ZERO times. The one
 *    parenting decision spec 61 asks for was unreachable. CORE_RULES 13.16, for
 *    the second time after the $9,000 wedding.
 *  - every family therefore ending estranged, mean closeness 24, because
 *    `closenessYear` drains when nobody ever answers.
 *  - then, with that fixed, closeness still only reaching 51: the model was
 *    calling "nobody asked you for anything" neglect, so a parent of four who
 *    said yes to everything still watched every child drift.
 *  - the gestation year slowing nothing down, because the family phase runs
 *    before the player acts — one child a YEAR, mean family 4.2, 38% with five
 *    or more, against the 3% the curve was tuned for.
 *  - the same child asking to join the swim team twice, four years apart.
 */

import { describe, expect, it } from 'vitest';
import { livingChildren, npcAge } from '@yearafter/relationships';
import { PARENT_AGE } from '@yearafter/parenting';
import { isCurrent, movesFor } from '@yearafter/social';
import { advanceYear } from './advance';
import { datingAppAvailable, useDatingApp } from './dating';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { answerChild, applyToAdopt, openAskOf, tryForBaby } from './parenting';
import { romanticMove } from './romance';

const LIVES = 60;
const UNTIL = 45;

interface Life {
  readonly state: GameState;
  readonly asks: readonly { readonly childId: string; readonly askId: string }[];
  readonly answered: number;
}

/** A player who wants a family: partner up, try every year, say yes to everything. */
function playALife(seed: string): Life {
  let state = createNewGame({ seed });
  const asks: { childId: string; askId: string }[] = [];
  let answered = 0;

  for (let year = 0; year < UNTIL; year += 1) {
    state = advanceYear(state).state;

    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const result = decide(state, decision.eventId, choice.id);
      if (!result.ok) break;
      state = result.value.state;
    }

    if (datingAppAvailable(state)) {
      const result = useDatingApp(state);
      if (result.ok) state = result.value.state;
    }
    for (let press = 0; press < 3; press += 1) {
      const cash = Number(state.player.cash);
      const person = state.circle.people
        .filter(isCurrent)
        .filter((candidate) => movesFor(candidate, state.player.age, cash).length > 0)
        .sort((a, b) => b.relationship - a.relationship)[0];
      if (!person) break;
      const moves = movesFor(person, state.player.age, cash);
      const forward = moves.filter((move) => move.to !== undefined);
      const move = forward[forward.length - 1] ?? moves.find((entry) => entry.id === 'date');
      if (!move) break;
      const outcome = romanticMove(state, person.id, move.id);
      if (!outcome.ok) break;
      state = outcome.value.state;
    }

    // Single and past twenty-four: adopt instead. The route that needs nobody.
    const single = state.circle.people.every(
      (person) => !person.romance || person.romance.endedAtAge !== undefined,
    );
    if (state.player.age >= 24 && single && !state.parenting.adoption) {
      const result = applyToAdopt(state);
      if (result.ok) state = result.value.state;
    }
    if (state.player.age >= 22) {
      const result = tryForBaby(state);
      if (result.ok) state = result.value.state;
    }

    const ask = openAskOf(state);
    if (ask) {
      asks.push({ childId: ask.childId, askId: ask.askId });
      const result = answerChild(state, true);
      if (result.ok) {
        state = result.value.state;
        answered += 1;
      }
    }
  }
  return { state, asks, answered };
}

const LIFETIMES: readonly Life[] = Array.from({ length: LIVES }, (_, index) =>
  playALife(`family-${index}`),
);

const kidsOf = (life: Life) => livingChildren(life.state.family);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/* -------------------------------------------------------------------------- */
/* The age gate                                                                */
/* -------------------------------------------------------------------------- */

describe('the age gate holds across a played life', () => {
  it('never gives a child to anybody under eighteen', () => {
    for (const life of LIFETIMES) {
      for (const child of kidsOf(life)) {
        expect(
          child.arrivedWhenPlayerWas,
          `${child.firstName} in ${life.state.player.firstName}'s life`,
        ).toBeGreaterThanOrEqual(PARENT_AGE);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The shape of a family                                                       */
/* -------------------------------------------------------------------------- */

describe('a player who wants a family', () => {
  it('gets one, at a size families actually come in', () => {
    const counts = LIFETIMES.map((life) => kidsOf(life).length);
    expect(mean(counts)).toBeGreaterThan(2);
    expect(mean(counts)).toBeLessThan(5);
    // A very large family stays possible and stays rare.
    expect(counts.filter((n) => n >= 6).length / counts.length).toBeLessThan(0.2);
  });

  it('does not hand out one child a year', () => {
    // The gestation year does not slow anything down on its own — the family
    // phase runs before the player acts, so a birth clears the pregnancy and
    // hands the button straight back. `lastBirthAtAge` is what fixes it.
    for (const life of LIFETIMES) {
      const arrivals = kidsOf(life)
        .filter((child) => child.arrivedBy === 'birth')
        .map((child) => child.arrivedWhenPlayerWas ?? 0)
        .sort((a, b) => a - b);
      for (let index = 1; index < arrivals.length; index += 1) {
        expect(
          (arrivals[index] as number) - (arrivals[index - 1] as number),
          `${life.state.player.firstName}: births at ${arrivals.join(', ')}`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('lets a parent actually say yes to what a child asks for', () => {
    // CORE_RULES 13.16. Priced as a flat cost, this was 0 out of 702.
    const asked = LIFETIMES.reduce((total, life) => total + life.asks.length, 0);
    const answered = LIFETIMES.reduce((total, life) => total + life.answered, 0);
    expect(asked).toBeGreaterThan(100);
    expect(answered / asked).toBeGreaterThan(0.9);
  });

  it('never lets a child ask for the same thing twice', () => {
    for (const life of LIFETIMES) {
      const seen = new Map<string, Set<string>>();
      for (const ask of life.asks) {
        const already = seen.get(ask.childId) ?? new Set<string>();
        expect(already.has(ask.askId), `${ask.childId} asked for ${ask.askId} twice`).toBe(false);
        already.add(ask.askId);
        seen.set(ask.childId, already);
      }
    }
  });

  it('does not leave every family estranged', () => {
    // A parent who says yes to everything the game offers should end up close
    // to their children. Measured at 24 before the cost fix and 51 before the
    // model stopped reading "nobody asked" as neglect.
    const warmth = LIFETIMES.flatMap((life) => kidsOf(life).map((child) => child.relationship));
    expect(warmth.length).toBeGreaterThan(50);
    expect(mean(warmth)).toBeGreaterThan(60);
  });

  it('reaches adoption, which is the route that needs nobody', () => {
    const adopted = LIFETIMES.flatMap((life) =>
      kidsOf(life).filter((child) => child.arrivedBy === 'adoption'),
    );
    expect(adopted.length).toBeGreaterThan(0);
    for (const child of adopted) {
      // Not all newborns — older children are the ones who wait for placements.
      expect(child.arrivedWhenPlayerWas).toBeGreaterThanOrEqual(PARENT_AGE);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Invariants                                                                  */
/* -------------------------------------------------------------------------- */

describe('invariants', () => {
  it('never spends money the character does not have', () => {
    for (const life of LIFETIMES) {
      expect(Number(life.state.player.cash), life.state.player.firstName).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every timeline entry a unique id', () => {
    // CORE_RULES 13.12, with a fifth phase now writing into the same year.
    for (const life of LIFETIMES) {
      const ids = life.state.player.timeline.map((entry) => entry.id);
      expect(new Set(ids).size, life.state.player.firstName).toBe(ids.length);
    }
  });

  it('never counts a child as a parent or a sibling', () => {
    for (const life of LIFETIMES) {
      for (const member of life.state.family.members) {
        if (member.role !== 'child') continue;
        expect(npcAge(member, life.state.world.year)).toBeLessThanOrEqual(life.state.player.age);
      }
    }
  });

  it('never writes a line with an unrendered token', () => {
    for (const life of LIFETIMES) {
      for (const entry of life.state.player.timeline) {
        expect(entry.text).not.toContain('{');
        expect(entry.text).not.toContain('undefined');
      }
    }
  });
});
