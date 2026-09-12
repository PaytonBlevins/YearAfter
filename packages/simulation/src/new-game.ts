/**
 * Ticket 0201 — Character generator.
 *
 * Spec 0201: name, sex, birthplace history, visible and hidden attributes, and
 * Boolean talents including Crime, with zero / one / several talents possible
 * according to configured probabilities.
 *
 * Everything here is drawn from the seed through named RNG streams. A seed
 * fully determines a life (CORE_RULES 5), which is what the golden-life tests
 * depend on and what makes a bug reproducible from a save.
 *
 * Not in scope: parents, siblings and family finances are Ticket 0202. The
 * generator produces a character alone; family attaches to it afterwards.
 */

import {
  createCharacter,
  createPersonality,
  createTalents,
  PERSONALITY_KEYS,
  PERSONALITY_MAX,
  PERSONALITY_MIN,
  TALENT_KEYS,
  type Character,
  type PersonalityKey,
  type Sex,
  type TalentKey,
  type VisibleStatKey,
} from '@yearafter/character';
import { CITIES, findNameCulture, type CityEntry } from '@yearafter/content';
import type { Household } from '@yearafter/relationships';
import { generateFamily, pickFirstName, pickSurname } from './family-generator';
import { asCharacterId, dollars, type BirthLocation } from '@yearafter/core';
import { createGameState, createWorldState, type GameState } from './game-state';
import { Rng, RngDomains, type RandomStream } from './rng/rng';

/* -------------------------------------------------------------------------- */
/* Tunable configuration                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Talent probability per talent. Set by the product owner.
 *
 * Across seven talents this yields roughly 52% of characters with no talent,
 * 36% with exactly one, and 12% with two or more. The thin tail is the point:
 * a talent is only worth something if most people do not have one.
 */
export const TALENT_PROBABILITY = 0.09;

/**
 * Birth attribute band for the seven visible stats.
 *
 * Deliberately not 0–100. A newborn rolling a 3 in Health is not an interesting
 * life, it is a dead one, and a 99 leaves nothing to earn. The band leaves room
 * to grow in both directions — every system that moves a stat is adding to or
 * subtracting from a middling start.
 */
export const BIRTH_ATTRIBUTE_MIN = 25;
export const BIRTH_ATTRIBUTE_MAX = 88;

/*
  The personality band moved to `@yearafter/character`, beside the type it
  describes, to break a require cycle this file was half of. The re-export keeps
  the constants reachable from `@yearafter/simulation`, where callers have
  imported them since 0201 — see the note in `personality.ts` for the cycle.
*/
export { PERSONALITY_MAX, PERSONALITY_MIN } from '@yearafter/character';

/** Probability a character is born male. Even, and stated rather than assumed. */
export const MALE_PROBABILITY = 0.5;

/* -------------------------------------------------------------------------- */

export interface NewGameOptions {
  readonly seed: string;
  /** In-world year the character is born. */
  readonly startYear?: number;
  /** Overrides for dev tools and the paid Character Editor unlock. */
  readonly firstName?: string;
  readonly lastName?: string;
  readonly sex?: Sex;
  readonly talents?: readonly TalentKey[];
  /** Force a birthplace by city id, for tests and dev tools. */
  readonly birthCityId?: string;
}

/** The generated character plus the details that are not stored on it. */
export interface GeneratedCharacter {
  readonly character: Character;
  readonly birthCity: CityEntry;
  /** Which naming tradition the name came from. Useful for dev tools and tests. */
  readonly nameCulture: string;
}

/**
 * Pick a birthplace, weighted.
 *
 * Region and country come along with the city, which is why this is one draw:
 * picking country then region then city would make a country with two listed
 * cities as likely as one with sixteen.
 */
export function rollBirthCity(stream: RandomStream, forcedId?: string): CityEntry {
  if (forcedId) {
    const forced = CITIES.find((city) => city.id === forcedId);
    if (!forced) {
      throw new Error(`Unknown birth city id: ${forcedId}`);
    }
    return forced;
  }
  return stream.weightedChoice(CITIES.map((city) => ({ value: city, weight: city.weight })));
}

/**
 * Pick a naming tradition for a birthplace, then a name from it.
 *
 * A character born in Los Angeles can carry any of several naming traditions,
 * which is both truer and more interesting than one name pool per country.
 */
export function rollName(
  stream: RandomStream,
  city: CityEntry,
  sex: Sex,
): { firstName: string; lastName: string; culture: string } {
  const cultureId = stream.weightedChoice(
    city.nameCultures.map((entry) => ({ value: entry.culture, weight: entry.weight })),
  );
  const culture = findNameCulture(cultureId);
  if (!culture) {
    // A dangling culture reference is a content bug, and the content validator
    // fails the build on it. Throwing here means it cannot reach a player.
    throw new Error(`City ${city.id} references unknown name culture: ${cultureId}`);
  }
  return {
    firstName: pickFirstName(stream, culture, sex),
    lastName: pickSurname(stream, culture),
    culture: cultureId,
  };
}

/** Boolean talent rolls. Zero, one or several are all possible (spec 0201). */
export function rollTalents(rng: Rng): TalentKey[] {
  const stream = rng.stream(RngDomains.Talents);
  return TALENT_KEYS.filter(() => stream.chance(TALENT_PROBABILITY));
}

/**
 * Roll the seven visible birth attributes.
 *
 * `aroundCentre` clusters results toward the middle of the band rather than
 * spreading them flat, so most characters are ordinary and the exceptional ones
 * are actually exceptional. Each stat is independent — there is deliberately no
 * correlation between, say, Smarts and Looks, and no talent bonus, because
 * talents are Boolean and act through opportunity rather than by inflating
 * numbers (spec 1070).
 */
export function rollBirthStats(stream: RandomStream): Record<VisibleStatKey, number> {
  const roll = () => Math.round(stream.aroundCentre(BIRTH_ATTRIBUTE_MIN, BIRTH_ATTRIBUTE_MAX));
  return {
    happiness: roll(),
    health: roll(),
    smarts: roll(),
    looks: roll(),
    charisma: roll(),
    willpower: roll(),
    discipline: roll(),
  };
}

/** Roll the hidden personality traits. Flat within the band — dispositions vary. */
export function rollPersonality(stream: RandomStream): Record<PersonalityKey, number> {
  const result = {} as Record<PersonalityKey, number>;
  for (const key of PERSONALITY_KEYS) {
    result[key] = stream.range(PERSONALITY_MIN, PERSONALITY_MAX);
  }
  return result;
}

/**
 * Generate a character. Deterministic in the seed.
 *
 * Stream discipline matters here: birthplace, naming, attributes and talents
 * each draw from their own stream, so adding a roll to one does not shift the
 * others. Without that, tuning the personality spread would silently change
 * every character's birthplace.
 */
export function generateCharacter(rng: Rng, options: NewGameOptions): GeneratedCharacter {
  const generation = rng.stream(RngDomains.CharacterGeneration);
  const startYear = options.startYear ?? 2000;

  const birthCity = rollBirthCity(generation, options.birthCityId);
  const sex: Sex = options.sex ?? (generation.chance(MALE_PROBABILITY) ? 'male' : 'female');

  const rolled = rollName(generation, birthCity, sex);
  const firstName = options.firstName ?? rolled.firstName;
  const lastName = options.lastName ?? rolled.lastName;

  const birthLocation: BirthLocation = {
    countryCode: birthCity.countryCode,
    regionCode: birthCity.regionCode,
    cityId: birthCity.id,
  };

  const character = createCharacter({
    id: asCharacterId(`${options.seed}:player:1`),
    firstName,
    lastName,
    sex,
    birthYear: startYear,
    birthLocation,
    stats: rollBirthStats(generation),
    personality: createPersonality(rollPersonality(generation)),
    talents: createTalents(options.talents ?? rollTalents(rng)),
    cash: dollars(0),
    occupation: 'Newborn',
    age: 0,
  });

  return { character, birthCity, nameCulture: rolled.culture };
}

export function createNewGame(options: NewGameOptions): GameState {
  const rng = new Rng(options.seed);
  const { character, nameCulture } = generateCharacter(rng, options);
  const family = generateFamilyFor(rng, character, nameCulture, options.seed);
  return createGameState(createWorldState(options.startYear ?? 2000, 1), character, rng, {
    family,
    nameCultureId: nameCulture,
    // Ticket 0211. Vitality starts where the generated body is, which is the
    // only honest value — the age curve takes it from here, and a newborn owes
    // nothing yet.
    health: { conditions: [], vitality: character.stats.health, deficit: 0 },
  });
}

/** Ticket 0202. Uses its own RNG stream so family tuning cannot shift the player. */
export function generateFamilyFor(
  rng: Rng,
  character: { firstName: string; lastName: string; birthYear: number },
  nameCultureId: string,
  seed: string,
): Household {
  return generateFamily(rng.stream(RngDomains.Family), {
    playerFirstName: character.firstName,
    playerLastName: character.lastName,
    playerBirthYear: character.birthYear,
    nameCultureId,
    seed,
  });
}
