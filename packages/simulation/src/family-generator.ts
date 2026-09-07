/**
 * Ticket 0202 — Starting family generator.
 *
 * Produces the household the player is born into: parents, possible siblings,
 * how everyone stands with the player, and what the household can afford.
 *
 * NOT in scope: what parents DO with any of it. Approving activities, funding
 * college, buying a vehicle, refusing help, kicking the player out — all of that
 * is Ticket 0209 and reads this data rather than living here.
 *
 * Everything draws from `RngDomains.Family`, so tuning family generation cannot
 * shift the player's own attributes, and vice versa.
 */

import { createPersonality, type Personality, type Sex } from '@yearafter/character';
import { findNameCulture, type NameCulture } from '@yearafter/content';
import { asNpcId, clampStat, dollars, type Money } from '@yearafter/core';
import {
  type FamilyMember,
  type FamilyRole,
  type Household,
  type HouseholdFinances,
  type WealthBand,
} from '@yearafter/relationships';
import { PERSONALITY_MAX, PERSONALITY_MIN } from './new-game';
import type { RandomStream } from './rng/rng';

/* -------------------------------------------------------------------------- */
/* Tunable configuration                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Household structure at birth. A life sim needs family shapes to vary — the
 * spec's NPC-parent behaviours (spec 674–683) read very differently with one
 * parent than two. Weights, not rules; tune freely.
 */
export const HOUSEHOLD_SHAPES = [
  { value: 'both' as const, weight: 70 },
  { value: 'motherOnly' as const, weight: 23 },
  { value: 'fatherOnly' as const, weight: 7 },
];

/**
 * Wealth band at birth.
 *
 * Deliberately kinder than reality. Spec 949 says do NOT target a steep
 * real-world wealth curve and that the game must be fun at every level, so
 * affluent and wealthy births are more common here than in life. Spec 696 keeps
 * the other half honest: a prestigious birth is an advantage, never a guarantee.
 */
export const WEALTH_BAND_WEIGHTS = [
  { value: 'struggling' as const, weight: 18 },
  { value: 'modest' as const, weight: 33 },
  { value: 'comfortable' as const, weight: 30 },
  { value: 'affluent' as const, weight: 14 },
  { value: 'wealthy' as const, weight: 5 },
];

/**
 * Household annual income per band, in whole dollars.
 *
 * US-benchmarked, like every other price in the game so far. Birth country does
 * not yet move these — a real gap, and the same one recorded in the location
 * catalog. It should be a per-country multiplier once non-US economics exist.
 */
export const INCOME_BANDS: Readonly<Record<WealthBand, readonly [number, number]>> = {
  struggling: [16_000, 38_000],
  modest: [38_000, 76_000],
  comfortable: [76_000, 145_000],
  affluent: [145_000, 330_000],
  wealthy: [330_000, 1_300_000],
};

/** Sibling count. Zero is common; large families are not. */
export const SIBLING_COUNTS = [
  { value: 0, weight: 27 },
  { value: 1, weight: 34 },
  { value: 2, weight: 22 },
  { value: 3, weight: 11 },
  { value: 4, weight: 6 },
];

/** Parent age at the player's birth. */
export const MOTHER_AGE_RANGE: readonly [number, number] = [18, 43];
export const FATHER_AGE_RANGE: readonly [number, number] = [19, 50];

/**
 * How many years older an existing sibling can be.
 *
 * Siblings generated at birth are always OLDER, because at the moment the player
 * is born a younger sibling does not exist yet. Allowing negative gaps produced
 * a "sister, age -8" on the family screen — data that was internally consistent
 * and still nonsense. Younger siblings arrive as later births, when parents
 * having more children becomes a system.
 */
export const MAX_SIBLING_AGE_GAP = 9;

/**
 * Probability a married mother carries the father's surname. The rest keep their
 * own, which is also why this is a coin-flip-ish number rather than a rule.
 */
export const MOTHER_TAKES_SURNAME = 0.62;

/* -------------------------------------------------------------------------- */

export interface FamilyOptions {
  /**
   * The player's own given name, so nobody in the household is handed it.
   *
   * Found on a screenshot of the built app: a sixteen-year-old Esperanza
   * Arellano with a twenty-five-year-old sister called Esperanza Arellano. The
   * uniqueness set below has guarded against two NPCs colliding since 0202 and
   * never contained the one person the household is built around — a gate that
   * checks everybody except the subject, which is CORE_RULES 13.15 wearing a
   * different hat.
   */
  readonly playerFirstName: string;
  readonly playerLastName: string;
  readonly playerBirthYear: number;
  /** The naming tradition the player's own name came from; the family shares it. */
  readonly nameCultureId: string;
  /** Seed, used to build stable NPC ids. */
  readonly seed: string;
}

function personalityFor(stream: RandomStream): Personality {
  return createPersonality({
    ambition: stream.range(PERSONALITY_MIN, PERSONALITY_MAX),
    riskTolerance: stream.range(PERSONALITY_MIN, PERSONALITY_MAX),
    temper: stream.range(PERSONALITY_MIN, PERSONALITY_MAX),
    generosity: stream.range(PERSONALITY_MIN, PERSONALITY_MAX),
    loyalty: stream.range(PERSONALITY_MIN, PERSONALITY_MAX),
    extraversion: stream.range(PERSONALITY_MIN, PERSONALITY_MAX),
  });
}

/**
 * Starting relationship with the player.
 *
 * Families mostly start close, so the band is high. A short-tempered parent
 * starts a little lower — the first small proof that hidden traits produce
 * explainable outcomes (spec 2) rather than sitting unused.
 */
export function startingRelationship(stream: RandomStream, personality: Personality): number {
  const base = stream.aroundCentre(52, 96);
  const temperPenalty = ((personality.temper - 50) / 50) * 8;
  return clampStat(base - temperPenalty);
}

export function rollHouseholdFinances(stream: RandomStream): HouseholdFinances {
  const band = stream.weightedChoice(WEALTH_BAND_WEIGHTS);
  const [low, high] = INCOME_BANDS[band];
  // aroundCentre keeps most households near the middle of their band rather
  // than clustering at the edges, so a "comfortable" family reads as typical.
  return { band, annualIncome: dollars(Math.round(stream.aroundCentre(low, high))) };
}

/**
 * Generate the household the player is born into.
 *
 * Pure with respect to everything except the stream, which advances.
 */
export function generateFamily(stream: RandomStream, options: FamilyOptions): Household {
  const culture = findNameCulture(options.nameCultureId);
  if (!culture) {
    throw new Error(`Family generation: unknown name culture ${options.nameCultureId}`);
  }

  const finances = rollHouseholdFinances(stream);
  const shape = stream.weightedChoice(HOUSEHOLD_SHAPES);
  const members: FamilyMember[] = [];
  let index = 0;

  /**
   * First names already used in this household.
   *
   * Two people under one roof sharing a name reads as a bug even though it is a
   * legitimate draw — one generated life had "father Andrea" and "sibling
   * Andrea". Unisex names in several of the catalog's traditions make the
   * collision far likelier than it looks.
   */
  const usedNames = new Set<string>([options.playerFirstName]);
  const uniqueFirstName = (sex: Sex): string => {
    let name = pickFirstName(stream, culture, sex);
    for (let attempt = 0; attempt < 6 && usedNames.has(name); attempt += 1) {
      name = pickFirstName(stream, culture, sex);
    }
    usedNames.add(name);
    return name;
  };

  const makeMember = (
    role: FamilyRole,
    sex: Sex,
    birthYear: number,
    lastName: string,
  ): FamilyMember => {
    index += 1;
    const personality = personalityFor(stream);
    return {
      id: asNpcId(`${options.seed}:npc:${index}`),
      role,
      firstName: uniqueFirstName(sex),
      lastName,
      sex,
      birthYear,
      alive: true,
      // Immediate family is Tier 1 by definition (spec 674–683).
      tier: 1,
      personality,
      relationship: startingRelationship(stream, personality),
    };
  };

  if (shape === 'both' || shape === 'motherOnly') {
    const age = stream.range(MOTHER_AGE_RANGE[0], MOTHER_AGE_RANGE[1]);
    const takesSurname = shape === 'both' ? stream.chance(MOTHER_TAKES_SURNAME) : true;
    const lastName = takesSurname ? options.playerLastName : pickSurname(stream, culture);
    members.push(makeMember('mother', 'female', options.playerBirthYear - age, lastName));
  }

  if (shape === 'both' || shape === 'fatherOnly') {
    const age = stream.range(FATHER_AGE_RANGE[0], FATHER_AGE_RANGE[1]);
    members.push(
      makeMember('father', 'male', options.playerBirthYear - age, options.playerLastName),
    );
  }

  const siblingCount = stream.weightedChoice(SIBLING_COUNTS);
  for (let i = 0; i < siblingCount; i += 1) {
    // Older only, and never the same year — twins are a deliberate thing, not
    // something to produce by accident.
    const gap = stream.range(1, MAX_SIBLING_AGE_GAP);
    members.push(
      makeMember(
        'sibling',
        stream.chance(0.5) ? 'male' : 'female',
        options.playerBirthYear - gap,
        options.playerLastName,
      ),
    );
  }

  return { members, finances };
}

/* -------------------------------------------------------------------------- */
/* Name helpers — shared with the character generator                          */
/* -------------------------------------------------------------------------- */

export const pickFirstName = (stream: RandomStream, culture: NameCulture, sex: Sex): string =>
  stream.pick(sex === 'male' ? culture.male : culture.female);

export const pickSurname = (stream: RandomStream, culture: NameCulture): string =>
  stream.pick(culture.surnames);

/** Household income as Money, for systems that need it directly. */
export const householdIncome = (household: Household): Money => household.finances.annualIncome;
