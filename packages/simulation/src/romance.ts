/**
 * Ticket 0207 — doing something about somebody you like.
 *
 * The same shape as `interact.ts`: a Result, draws from a named stream, a
 * timeline line either way, and the other person keeps a memory of it. That is
 * deliberate rather than lazy — a romance in this game is a thing that happened
 * between two people who already knew each other, and it belongs in the same
 * history as the afternoon they made you laugh.
 *
 * Two things this file is responsible for that the pure model cannot be:
 *
 *  - MONEY. Taking somebody out costs, and CORE_RULES 13.13 says nothing may
 *    spend what the character does not have. `movesFor` already refuses to
 *    offer an unaffordable move; this checks again before charging, because the
 *    caller is a screen and screens go stale.
 *  - ONE PARTNER. `movesFor` cannot see the rest of the circle, so the rule
 *    that you cannot ask a second person out while going out with somebody is
 *    enforced here, where the whole circle is in hand.
 */

import { createTimelineEntry, type Character, type TimelineEntry } from '@yearafter/character';
import { cents, err, ok, subtract, type Result } from '@yearafter/core';
import {
  contactWith,
  displayName,
  findRomanceMove,
  isCurrent,
  movesFor,
  partnerOf,
  remember,
  resolveMove,
  romanceChance,
  type Acquaintance,
  type Romance,
} from '@yearafter/social';
import type { GameState } from './game-state';
import { RngDomains, stableUnit } from './rng/rng';

export type RomanceError =
  | 'no-such-person'
  | 'not-around'
  | 'no-such-move'
  /** Not on the menu for this person, at this age, at this relationship. */
  | 'not-available'
  /** A heavy move, already made with this person this year. */
  | 'already-this-year'
  /** You are already going out with somebody else. */
  | 'already-with-someone'
  | 'cannot-afford';

export interface RomanceOutcome {
  readonly state: GameState;
  readonly worked: boolean;
  readonly ended: boolean;
  readonly entry: TimelineEntry;
}

export function romanticMove(
  state: GameState,
  personId: string,
  moveId: string,
): Result<RomanceOutcome, RomanceError> {
  const person = state.circle.people.find((candidate) => candidate.id === personId);
  if (!person) return err('no-such-person');
  if (!isCurrent(person)) return err('not-around');

  const move = findRomanceMove(moveId);
  if (!move) return err('no-such-move');

  const cash = Number(state.player.cash);
  // The single age gate, reached through the menu builder so there is exactly
  // one place that decides what a character of this age may do.
  if (!movesFor(person, state.player.age, cash).some((entry) => entry.id === move.id)) {
    // Split out for the screen's benefit: "you cannot afford it" and "that is
    // not something you can do" are different sentences.
    if (move.cost !== undefined && cash < move.cost) return err('cannot-afford');
    return err('not-available');
  }

  // You get one. Flirting with somebody else while going out with a person is a
  // thing people do, and a thing this game is not going to model.
  const partner = partnerOf(state.circle.people);
  if (partner && partner.id !== person.id && move.to !== undefined) {
    return err('already-with-someone');
  }

  const spent = contactWith(state.circle, person.id, state.player.age);
  if (move.weight === 'heavy' && spent.heavy > 0) return err('already-this-year');

  const stream = state.rng.stream(RngDomains.Relationships);
  const chance = romanceChance(
    person,
    state.player.personality,
    state.player.stats.charisma,
    state.player.stats.looks,
    move.base,
  );
  const result = resolveMove(
    move,
    person,
    state.player.age,
    chance,
    stream.next(),
    // The phrasing draw is STABLE for this person, this move, this year, rather
    // than fresh on every press — and that is what actually fixes the repeated
    // lines. `resolveMove` rotates the line by how many times the move has been
    // used this year, which only guarantees a different sentence if the base
    // index holds still. Drawn afresh each press it did not: reading the output
    // still found "Missed the last bus with Harper" twice in one year, because
    // a new draw landing one lower cancelled the rotation exactly.
    stableUnit(`${state.world.year}:${person.id}:${move.id}`),
    displayName(person),
    spent.light,
    cash,
  );

  // A worn-out repeat is not remembered, for the reason `interact.ts` gives:
  // "you have used every line you have" is a fact about the term, not a thing
  // that happened between two people.
  const remembered: Acquaintance = result.worn
    ? person
    : remember(person, {
        age: state.player.age,
        text: result.text,
        major: result.major,
        warmth: result.warmth,
      });

  const updated = withRomance(remembered, result, state.player.age, person.romance);

  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'relationship',
    text: result.text,
    // The repeat counter is part of the id for the same reason it is in
    // `interact.ts` and `study.ts`: light moves repeat inside one year, and two
    // entries sharing an id is the duplicate-key bug (CORE_RULES 13.12).
    id: `t:${state.world.year}:love:${person.id}:${move.id}:${spent.light + spent.heavy}`,
    sequence,
  });

  const player: Character = {
    ...state.player,
    timeline: [...state.player.timeline, entry],
    // Charged once, here, and only what `movesFor` already confirmed is there.
    cash: result.spent > 0 ? subtract(state.player.cash, cents(result.spent)) : state.player.cash,
  };

  return ok({
    state: {
      ...state,
      player,
      circle: {
        people: state.circle.people.map((candidate) =>
          candidate.id === person.id ? updated : candidate,
        ),
        contact: {
          ...state.circle.contact,
          [person.id]: {
            age: state.player.age,
            light: spent.light + (move.weight === 'light' ? 1 : 0),
            heavy: spent.heavy + (move.weight === 'heavy' ? 1 : 0),
          },
        },
      },
    },
    worked: result.worked,
    ended: result.ended,
    entry,
  });
}

/**
 * Fold the move's outcome into the person's romance record.
 *
 * `since` is the age the CURRENT stage began, not the age the relationship did,
 * because "together since fifteen" and "engaged since twenty-four" are two
 * different facts and the person's page wants both readable.
 */
function withRomance(
  person: Acquaintance,
  result: { readonly stage?: string; readonly ended: boolean; readonly endedBecause?: string },
  age: number,
  before: Romance | undefined,
): Acquaintance {
  if (result.ended) {
    // The person stays. Spec 771–785 keeps reconciliation possible, and a life
    // you can look back on has to contain the people who are no longer in it.
    return {
      ...person,
      romance: {
        stage: (before?.stage ?? 'seeing') as Romance['stage'],
        since: before?.since ?? age,
        endedAtAge: age,
        endedBecause: result.endedBecause as Romance['endedBecause'],
      },
    };
  }
  if (result.stage === undefined) return person;
  const stage = result.stage as Romance['stage'];
  return {
    ...person,
    romance: {
      stage,
      since: before && before.stage === stage ? before.since : age,
    },
  };
}
