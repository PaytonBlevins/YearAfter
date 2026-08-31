/**
 * New game creation — v0.01 shell scope.
 *
 * Ticket 0201 replaces the fixed starting character with the real generator
 * (randomised names, sex, birthplace, visible and hidden attributes, and Boolean
 * talent rolls at configured probabilities). What this file establishes now is
 * the *shape* of that call: everything comes from the seed, nothing from the
 * clock or `Math.random`, so a given seed always produces the same life.
 */

import {
  createCharacter,
  createTalents,
  type Character,
  type Sex,
  type TalentKey,
  TALENT_KEYS,
} from '@yearafter/character';
import { asCharacterId, dollars, type BirthLocation } from '@yearafter/core';
import { createGameState, createWorldState, type GameState } from './game-state';
import { Rng, RngDomains } from './rng/rng';

/** v0.01 placeholder name pool. Ticket 0201 moves this into @yearafter/content. */
const FIRST_NAMES_MALE = ['Marcus', 'Elliot', 'Dante', 'Owen', 'Silas', 'Rowan', 'Andre', 'Felix'];
const FIRST_NAMES_FEMALE = ['Nadia', 'June', 'Priya', 'Alma', 'Rosa', 'Imani', 'Cleo', 'Wren'];
const LAST_NAMES = [
  'Vaughn',
  'Okafor',
  'Reyes',
  'Lindqvist',
  'Bellamy',
  'Nakamura',
  'Doyle',
  'Ferrer',
];

/** v0.01 placeholder birthplace. Ticket 0201 draws from the location catalog. */
const DEFAULT_BIRTH_LOCATION: BirthLocation = {
  countryCode: 'US',
  regionCode: 'CA',
  cityId: 'us-ca-riverside',
};

/**
 * Talent probability. Spec 0201: a character can have zero, one, or several.
 * At 12% per talent across seven talents this yields roughly 41% of characters
 * with no talent at all and a long thin tail of multi-talented lives — deliberately
 * a starting point for the balance lab, not a final tuned value.
 */
export const TALENT_PROBABILITY = 0.12;

export interface NewGameOptions {
  readonly seed: string;
  /** In-world year the character is born. */
  readonly startYear?: number;
  /** Override the generated name, for dev tools and tests. */
  readonly firstName?: string;
  readonly lastName?: string;
  readonly sex?: Sex;
  /** Force a talent set, for dev tools and the paid talent-selection unlock. */
  readonly talents?: readonly TalentKey[];
}

export function rollTalents(rng: Rng): TalentKey[] {
  const stream = rng.stream(RngDomains.Talents);
  return TALENT_KEYS.filter(() => stream.chance(TALENT_PROBABILITY));
}

export function createNewGame(options: NewGameOptions): GameState {
  const rng = new Rng(options.seed);
  const generation = rng.stream(RngDomains.CharacterGeneration);

  const sex: Sex = options.sex ?? (generation.chance(0.5) ? 'male' : 'female');
  const firstName =
    options.firstName ?? generation.pick(sex === 'male' ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE);
  const lastName = options.lastName ?? generation.pick(LAST_NAMES);

  const startYear = options.startYear ?? 2000;

  // Birth attributes vary; the full weighting model is Ticket 0201.
  const stat = () => Math.round(generation.aroundCentre(25, 90));

  const player: Character = createCharacter({
    id: asCharacterId(`${options.seed}:player:1`),
    firstName,
    lastName,
    sex,
    birthYear: startYear,
    birthLocation: DEFAULT_BIRTH_LOCATION,
    stats: {
      happiness: stat(),
      health: stat(),
      smarts: stat(),
      looks: stat(),
      charisma: stat(),
      willpower: stat(),
      discipline: stat(),
    },
    talents: createTalents(options.talents ?? rollTalents(rng)),
    cash: dollars(0),
    occupation: 'Newborn',
    age: 0,
  });

  return createGameState(createWorldState(startYear, 1), player, rng);
}
