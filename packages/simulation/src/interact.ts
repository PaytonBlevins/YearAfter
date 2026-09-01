/**
 * Ticket 0206 — doing something to somebody.
 *
 * Review, after the 0204b build: "I also should be able to interact with
 * teachers and classmates." This is that verb.
 *
 * Same shape as `tryout.ts` and `study.ts` — a Result, one draw from a named
 * stream, a timeline line either way, and once per school year. The rhythm is
 * deliberate: every action the player takes between years in this game costs a
 * year, so none of them can be ground.
 */

import { createTimelineEntry, type Character, type TimelineEntry } from '@yearafter/character';
import { err, ok, type Result } from '@yearafter/core';
import {
  displayName,
  findInteraction,
  interactionsFor,
  isCurrent,
  remember,
  resolveInteraction,
  type Acquaintance,
} from '@yearafter/social';
import type { GameState } from './game-state';
import { RngDomains } from './rng/rng';

export type InteractError =
  | 'no-such-person'
  /** They have moved on, or drifted out of the player's life. */
  | 'not-around'
  | 'no-such-interaction'
  /** Not on the menu for this person right now. */
  | 'not-available'
  /** One per person per school year. */
  | 'already-this-year';

export interface InteractOutcome {
  readonly state: GameState;
  readonly worked: boolean;
  readonly entry: TimelineEntry;
}

export function interact(
  state: GameState,
  personId: string,
  interactionId: string,
): Result<InteractOutcome, InteractError> {
  const person = state.circle.people.find((candidate) => candidate.id === personId);
  if (!person) return err('no-such-person');
  if (!isCurrent(person)) return err('not-around');

  const interaction = findInteraction(interactionId);
  if (!interaction) return err('no-such-interaction');
  if (!interactionsFor(person).some((entry) => entry.id === interaction.id)) {
    return err('not-available');
  }
  if (state.circle.spokenToAtAge[person.id] === state.player.age) {
    return err('already-this-year');
  }

  const stream = state.rng.stream(RngDomains.Relationships);
  const result = resolveInteraction(
    interaction,
    person,
    state.player.stats.charisma,
    displayName(person),
    stream.next(),
    stream.next(),
  );

  // The other person keeps this. That is the difference between a menu and a
  // relationship: next year their page still says what happened.
  const updated: Acquaintance = remember(person, {
    age: state.player.age,
    text: result.text,
    major: result.major,
    warmth: result.warmth,
  });

  // Falling out badly enough ends it. The person stays in the save — spec
  // 771-785 keeps reconciliation possible, and "Try to fix it" is on the menu
  // precisely for this.
  const ended =
    updated.relationship <= 12 && interaction.id === 'fall-out'
      ? { ...updated, endedAtAge: state.player.age, endedBecause: 'fell out' as const }
      : updated;

  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'relationship',
    text: result.text,
    id: `t:${state.world.year}:social:${person.id}:${interaction.id}`,
    sequence,
  });

  const player: Character = {
    ...state.player,
    timeline: [...state.player.timeline, entry],
  };

  return ok({
    state: {
      ...state,
      player,
      circle: {
        people: state.circle.people.map((candidate) =>
          candidate.id === person.id ? ended : candidate,
        ),
        spokenToAtAge: { ...state.circle.spokenToAtAge, [person.id]: state.player.age },
      },
    },
    worked: result.worked,
    entry,
  });
}
