/**
 * Ticket 0207b — the dating app.
 *
 * Spec 1664 names it directly: "find date, dating app, flirt, relationship,
 * breakup, marriage." 0207 shipped the last four and stubbed the first two as
 * event text, because there was no way to bring a new person into a life at
 * all. 0207b built that, and this is the deliberate half of it: everything else
 * is somebody you happened to meet, and this is somebody you went looking for.
 *
 * Three things make it a decision rather than a button that hands out partners:
 *
 *  - It can come back with NOBODY, and often does. An app that always produces
 *    somebody is a vending machine, and the month where nothing came of it is
 *    the honest and much more common outcome.
 *  - It costs a year's attention like every other action, and it is heavy, so
 *    it is once a year.
 *  - Who turns up is not filtered to suit you. Compatibility is rolled the same
 *    way it is for anybody else, so the app is a way to MEET people and not a
 *    way to meet the right one. That distinction is most of what the thing
 *    being modelled is like.
 *
 * Spec 1664 also disables celebrity dating until fame and network exist. There
 * is no fame system yet, so there is nothing here to disable — and nothing here
 * that could grow into one by accident, because everybody this produces is an
 * ordinary person drawn the same way a neighbour is.
 */

import { createTimelineEntry, type Character, type TimelineEntry } from '@yearafter/character';
import { asNpcId, clampStat, err, ok, type Result, type StatValue } from '@yearafter/core';
import {
  ADULT_AGE,
  contactWith,
  partnerOf,
  type Acquaintance,
  type SocialCircle,
} from '@yearafter/social';
import type { GameState } from './game-state';
import { nameContext, newPersonLike } from './social-generator';
import { RngDomains } from './rng/rng';

export type DatingAppError =
  /** Under eighteen. The same hard gate as everything else adult (0207). */
  | 'too-young'
  /** You are seeing somebody. This is not a feature the game is going to add. */
  | 'already-with-someone'
  | 'already-this-year';

export interface DatingAppOutcome {
  readonly state: GameState;
  /** People it actually produced. Empty is a real and common result. */
  readonly met: readonly Acquaintance[];
  readonly entry: TimelineEntry;
}

/** The chance a month on it produces anybody at all. */
export const MATCH_CHANCE = 0.55;

/** The chance it produces a second person, given it produced one. */
export const SECOND_MATCH_CHANCE = 0.3;

/**
 * Warmth somebody arrives at.
 *
 * Higher than a neighbour, because you have both already said why you are
 * there and have been talking for a fortnight — but deliberately straddling
 * `ask-out`'s threshold of 45, so some matches can be asked out straight away
 * and some have to be talked to first. A source of people who all arrive ready
 * to be asked out would make every other way of meeting somebody pointless.
 */
export const MATCH_WARMTH: readonly [number, number] = [30, 50];

const NOTHING_LINES = [
  'A month on the apps. Three conversations, none of which survived the weekend.',
  'Swiped through most of the city and came away with nothing but a sore thumb.',
  'Two people cancelled and one never replied. You deleted it again.',
  'A month of it. Everybody was either forty minutes away or already seeing somebody.',
];

const MET_ONE = [
  'Matched with {name}, and the conversation kept going past the point where they usually stop.',
  '{name} messaged first. You have been talking for a fortnight.',
  'Got as far as coffee with {name}, which is further than the last four.',
];

const MET_TWO = [
  'A better month. You have been talking to {name} and {other}, and have not decided anything.',
  'Matched with {name} and {other} in the same week, which felt like more than it was.',
];

export function useDatingApp(state: GameState): Result<DatingAppOutcome, DatingAppError> {
  if (state.player.age < ADULT_AGE) return err('too-young');
  if (partnerOf(state.circle.people)) return err('already-with-someone');

  // Heavy, and counted against a person nobody has: the app itself. Using the
  // ordinary per-person contact record rather than a new field keeps the
  // once-a-year rule in the one place that already enforces it.
  const spent = contactWith(state.circle, APP_ID, state.player.age);
  if (spent.heavy > 0) return err('already-this-year');

  const stream = state.rng.stream(RngDomains.Relationships);
  const names = nameContext(
    state.nameCultureId,
    state.circle,
    state.family,
    state.player.firstName,
  );

  const met: Acquaintance[] = [];
  if (stream.chance(MATCH_CHANCE)) {
    met.push(match(state, names, stream, 0));
    if (stream.chance(SECOND_MATCH_CHANCE)) met.push(match(state, names, stream, 1));
  }

  const variant = stream.next();
  const lines = met.length === 0 ? NOTHING_LINES : met.length === 1 ? MET_ONE : MET_TWO;
  const text = (lines[Math.min(lines.length - 1, Math.floor(variant * lines.length))] as string)
    .replace('{name}', met[0]?.firstName ?? '')
    .replace('{other}', met[1]?.firstName ?? '');

  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'relationship',
    text,
    id: `t:${state.world.year}:app`,
    sequence,
  });

  const player: Character = {
    ...state.player,
    timeline: [...state.player.timeline, entry],
  };
  const circle: SocialCircle = {
    people: [...state.circle.people, ...met],
    contact: {
      ...state.circle.contact,
      [APP_ID]: { age: state.player.age, light: 0, heavy: spent.heavy + 1 },
    },
  };

  return ok({ state: { ...state, player, circle }, met, entry });
}

/**
 * Whether the app is worth offering at all.
 *
 * The screen hides the row rather than showing it disabled when the character
 * is with somebody: a greyed "Try an app" beside the person you are married to
 * is a suggestion, not an explanation.
 */
export const datingAppAvailable = (state: GameState): boolean =>
  state.player.age >= ADULT_AGE && partnerOf(state.circle.people) === undefined;

export const datingAppUsedThisYear = (state: GameState): boolean =>
  contactWith(state.circle, APP_ID, state.player.age).heavy > 0;

/**
 * The key the once-a-year counter is filed under.
 *
 * Not a real person, and shaped so it can never collide with one: every
 * generated id starts `npc:`.
 */
const APP_ID = 'app:dating';

function match(
  state: GameState,
  names: ReturnType<typeof nameContext>,
  stream: ReturnType<GameState['rng']['stream']>,
  index: number,
): Acquaintance {
  const person = newPersonLike(
    stream,
    names,
    state.player.age,
    state.world.year - state.player.age,
    state.circle.people.length + index,
  );
  return {
    ...person,
    id: asNpcId(`npc:app:${state.world.year}:${index}`),
    context: 'app',
    relationship: clampStat(stream.range(MATCH_WARMTH[0], MATCH_WARMTH[1])) as StatValue,
    // Nothing keeps an app match in your life. Somebody you met on an app and
    // then did not speak to is gone, faster than a neighbour, and that is the
    // truthful version rather than a punishment.
    inClass: false,
    lastContactAge: state.player.age,
  };
}
