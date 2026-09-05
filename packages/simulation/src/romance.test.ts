/**
 * Ticket 0207 acceptance tests, at the level of a whole life.
 *
 * The unit tests in `@yearafter/social` prove the model is correct in the
 * small. These play 120 lives from birth to thirty with a player who uses the
 * menu every year, and assert on the SHAPE of what comes out — which is where
 * every defect this ticket actually had was found. All four were invisible to a
 * green suite:
 *
 *  - a wedding priced at $9,000 in a build where the median thirty-year-old has
 *    thirteen dollars, so 0% of lives ever reached marriage;
 *  - warmth outweighing compatibility, so 98% of lives ended at thirty with the
 *    classmate the player asked out at thirteen;
 *  - nothing in the model knowing that a fourteen-year-old and a
 *    twenty-two-year-old are different people, so 73% of lives contained
 *    exactly one relationship, ever;
 *  - the same sentence four times in a year, because a re-drawn phrasing index
 *    cancelled the rotation meant to prevent exactly that.
 *
 * The bounds below are deliberately loose. They are here to catch a system
 * going dead or running away, not to pin the balance — a test that fails when
 * marriage moves from 77% to 71% would be a test nobody could tune against.
 */

import { describe, expect, it } from 'vitest';
import { isCurrent, movesFor, partnerOf, stagesFor } from '@yearafter/social';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { romanticMove } from './romance';

const LIVES = 120;
const UNTIL = 30;

interface Life {
  readonly state: GameState;
  readonly pressed: readonly { readonly age: number; readonly move: string; readonly text: string }[];
}

/**
 * A player who uses the menu: every year, pursue the warmest person there is
 * anything to do about and take the furthest step on offer. Never breaks up on
 * purpose, so every ending in the results below came from the model.
 */
function playALife(seed: string): Life {
  let state = createNewGame({ seed });
  const pressed: { age: number; move: string; text: string }[] = [];

  for (let year = 0; year < UNTIL; year += 1) {
    state = advanceYear(state).state;

    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const answered = decide(state, decision.eventId, choice.id);
      if (!answered.ok) break;
      state = answered.value.state;
    }

    for (let press = 0; press < 4; press += 1) {
      const cash = Number(state.player.cash);
      const person = state.circle.people
        .filter((candidate) => isCurrent(candidate))
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
      pressed.push({ age: state.player.age, move: move.id, text: outcome.value.entry.text });
    }
  }
  return { state, pressed };
}

const LIFETIMES: readonly Life[] = Array.from({ length: LIVES }, (_, index) =>
  playALife(`love-${index}`),
);

const share = (predicate: (life: Life) => boolean): number =>
  LIFETIMES.filter(predicate).length / LIFETIMES.length;

const romances = (life: Life) =>
  life.state.circle.people.filter(
    (person) => person.romance !== undefined && person.romance.stage !== 'interested',
  );

/* -------------------------------------------------------------------------- */
/* The age gate, over whole lives                                              */
/* -------------------------------------------------------------------------- */

describe('the age gate holds across a played life', () => {
  it('never leaves anybody under eighteen engaged or married', () => {
    for (const life of LIFETIMES) {
      for (const person of life.state.circle.people) {
        const stage = person.romance?.stage;
        if (stage !== 'engaged' && stage !== 'married') continue;
        expect(person.romance?.since, `${person.firstName} in ${life.state.player.firstName}'s life`)
          .toBeGreaterThanOrEqual(18);
      }
    }
  });

  it('writes nothing romantic into a childhood before thirteen', () => {
    for (const life of LIFETIMES) {
      for (const entry of life.pressed) {
        expect(entry.age, entry.text).toBeGreaterThanOrEqual(13);
      }
    }
    expect(stagesFor(12)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The shape of a life                                                         */
/* -------------------------------------------------------------------------- */

describe('a life with the menu used every year', () => {
  it('reaches every stage the game has', () => {
    // CORE_RULES 13.7: a system nobody can trigger is not a system. Marriage
    // was priced out of the game entirely until the output was read.
    const married = share((life) => romances(life).some((p) => p.romance?.stage === 'married'));
    expect(married).toBeGreaterThan(0.35);
    expect(married).toBeLessThan(0.95);
  });

  it('does not marry anybody off at nineteen', () => {
    // A hard floor, not a balance bound. Before `minYearsAtStage` counted from
    // adulthood, somebody together since fifteen had served their two years on
    // their eighteenth birthday: the earliest wedding in the game was NINETEEN
    // and 61% of them landed under twenty-one. The floor is the assertion; how
    // the rest spread out is balance and is deliberately not pinned here.
    const weddings = LIFETIMES.flatMap((life) =>
      romances(life)
        .filter((person) => person.romance?.stage === 'married')
        .map((person) => person.romance!.since),
    );
    expect(weddings.length).toBeGreaterThan(20);
    expect(Math.min(...weddings)).toBeGreaterThanOrEqual(21);
    // And they do not all happen at the floor either.
    expect(weddings.filter((age) => age >= 22).length / weddings.length).toBeGreaterThan(0.2);
  });

  it('gives most lives more than one relationship', () => {
    const only = share((life) => romances(life).length === 1);
    expect(only).toBeLessThan(0.6);
    expect(share((life) => romances(life).length >= 2)).toBeGreaterThan(0.35);
  });

  it('does not make the first person you ask out your partner for life', () => {
    let withSomebody = 0;
    let stillTheFirst = 0;
    for (const life of LIFETIMES) {
      const partner = partnerOf(life.state.circle.people);
      if (!partner) continue;
      withSomebody += 1;
      const first = romances(life)
        .slice()
        .sort((a, b) => a.romance!.since - b.romance!.since)[0];
      if (first && first.id === partner.id) stillTheFirst += 1;
    }
    expect(withSomebody).toBeGreaterThan(20);
    expect(stillTheFirst / withSomebody).toBeLessThan(0.7);
  });

  it('lets people be turned down', () => {
    const asks = LIFETIMES.flatMap((life) => life.pressed.filter((p) => p.move === 'ask-out'));
    expect(asks.length).toBeGreaterThan(100);
    const noes = asks.filter((ask) => /said no|did not think of you|the mistake/.test(ask.text));
    expect(noes.length / asks.length).toBeGreaterThan(0.25);
  });

  it('ends relationships without the player ever pressing End it', () => {
    // The probe never breaks up. Every ending here came from the other person.
    const endings = LIFETIMES.flatMap((life) =>
      romances(life).filter((person) => person.romance?.endedAtAge !== undefined),
    );
    expect(endings.length).toBeGreaterThan(30);
    for (const person of endings) {
      expect(person.romance?.endedBecause).not.toBe('broke up');
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Things that must never happen                                               */
/* -------------------------------------------------------------------------- */

describe('invariants', () => {
  it('never spends money the character does not have', () => {
    // CORE_RULES 13.13.
    for (const life of LIFETIMES) {
      expect(Number(life.state.player.cash), life.state.player.firstName).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every timeline entry a unique id', () => {
    // CORE_RULES 13.12 — this is the duplicate-React-key bug, as a test.
    for (const life of LIFETIMES) {
      const ids = life.state.player.timeline.map((entry) => entry.id);
      expect(new Set(ids).size, life.state.player.firstName).toBe(ids.length);
    }
  });

  it('never writes the same sentence twice in one year', () => {
    for (const life of LIFETIMES) {
      const byYear = new Map<number, Set<string>>();
      for (const entry of life.pressed) {
        const seen = byYear.get(entry.age) ?? new Set<string>();
        expect(seen.has(entry.text), `age ${entry.age}: ${entry.text}`).toBe(false);
        seen.add(entry.text);
        byYear.set(entry.age, seen);
      }
    }
  });

  it('never leaves an unrendered token in a line', () => {
    for (const life of LIFETIMES) {
      for (const entry of life.pressed) {
        expect(entry.text).not.toContain('{');
        expect(entry.text).not.toContain('undefined');
      }
    }
  });

  it('never has the player with two people at once', () => {
    for (const life of LIFETIMES) {
      const together = life.state.circle.people.filter(
        (person) =>
          person.romance !== undefined &&
          person.romance.endedAtAge === undefined &&
          person.romance.stage !== 'interested',
      );
      expect(together.length, life.state.player.firstName).toBeLessThanOrEqual(1);
    }
  });
});
