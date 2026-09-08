/**
 * Ticket 0206 — doing something to somebody.
 *
 * Review, after the 0204b build: "I also should be able to interact with
 * teachers and classmates." This is that verb.
 *
 * Same shape as `tryout.ts` and `study.ts` — a Result, draws from a named
 * stream, a timeline line either way.
 *
 * Light things repeat as often as the player likes and are worth less each
 * time; heavy things are once a year. Review asked for the flat one-a-year cap
 * to go: "I don't like how you can only perform one action with your classmate
 * per year." What replaced it is a year that wears out rather than a wall.
 */

import {
  appendToTimeline,
  createTimelineEntry,
  type Character,
  type TimelineEntry,
} from '@yearafter/character';
import { clampStat, err, ok, type Result } from '@yearafter/core';
import {
  contactWith,
  displayName,
  findInteraction,
  interactionsFor,
  isCurrent,
  remember,
  resolveInteraction,
  type Acquaintance,
} from '@yearafter/social';
import type { GameState } from './game-state';
import { RngDomains, stableUnit } from './rng/rng';

export type InteractError =
  | 'no-such-person'
  /** They have moved on, or drifted out of the player's life. */
  | 'not-around'
  | 'no-such-interaction'
  /** Not on the menu for this person right now. */
  | 'not-available'
  /**
   * A HEAVY thing, already done with this person this year.
   *
   * Light things have no such limit — review asked for the one-a-year cap to
   * go, and it did. What is left is the handful of things you cannot honestly
   * do twice in a year: tell somebody your secret, have it out with them, go
   * first to fix it, ask a teacher to put a word in.
   */
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
  const spent = contactWith(state.circle, person.id, state.player.age);
  if (interaction.weight === 'heavy' && spent.heavy > 0) {
    return err('already-this-year');
  }

  const stream = state.rng.stream(RngDomains.Relationships);
  const result = resolveInteraction(
    interaction,
    person,
    state.player.stats.charisma,
    displayName(person),
    stream.next(),
    // Stable for this person, this interaction, this year — NOT a fresh draw.
    // `resolveInteraction` rotates the line by how many times it has been used
    // this year so a repeat cannot render the same sentence, and that only
    // works if the base index holds still. Ticket 0207 found the same bug in
    // its own copy: a re-drawn index landing one lower cancels the rotation
    // exactly.
    stableUnit(`${state.world.year}:${person.id}:${interaction.id}`),
    spent.light,
  );

  // The other person keeps this. That is the difference between a menu and a
  // relationship: next year their page still says what happened.
  //
  // A worn-out repeat is NOT remembered. "You have been round a lot lately" is
  // a fact about the week, not a thing that happened between two people, and
  // filing six of them would push everything that mattered off the page.
  const updated: Acquaintance = result.worn
    ? person
    : remember(person, {
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
    // How many times already, because light interactions repeat within a year
    // (0206b removed the cap). Two afternoons at the same person's house would
    // otherwise share an id, which React reports as a duplicate key.
    id: `t:${state.world.year}:social:${person.id}:${interaction.id}:${spent.light + spent.heavy}`,
    sequence,
  });

  const player: Character = {
    ...state.player,
    timeline: appendToTimeline(state.player.timeline, entry),
  };

  return ok({
    state: {
      ...state,
      player,
      // Mischief costs school standing, through the same field events use —
      // which means winding a teacher up all year can genuinely land a
      // character in an alternative school (spec 73).
      education:
        result.behaviour === 0
          ? state.education
          : {
              ...state.education,
              behaviour: clampStat(state.education.behaviour + result.behaviour),
            },
      circle: {
        people: state.circle.people.map((candidate) =>
          candidate.id === person.id ? ended : candidate,
        ),
        contact: {
          ...state.circle.contact,
          [person.id]: {
            age: state.player.age,
            light: spent.light + (interaction.weight === 'light' ? 1 : 0),
            heavy: spent.heavy + (interaction.weight === 'heavy' ? 1 : 0),
          },
        },
      },
    },
    worked: result.worked,
    entry,
  });
}
