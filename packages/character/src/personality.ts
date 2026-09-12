/**
 * Hidden personality attributes (Ticket 0201, "visible/hidden attributes").
 *
 * PROTECTED CONTRACT (spec 1060–1066): character state.
 *
 * These are backend-only. Spec 1112–1124 lists personality subtraits as
 * backend-oriented, and spec 31 forbids stat creep — so none of these ever gets
 * a bar, a number on screen, or a player-facing name. They exist to make
 * outcomes *explainable* (spec 2: established traits matter) without adding
 * anything for the player to manage.
 *
 * Six traits, each added because a named ticket needs it. That constraint is
 * the point: a personality model with nothing consuming it is stat creep with
 * extra steps. Do not add a seventh without a consumer.
 *
 *   ambition       career progression, promotion pushes, going into business
 *   riskTolerance  crime, gambling, investing, leaving a job for a venture
 *   temper         conflict outcomes, relationship volatility, prison incidents
 *   generosity     gifts, and NPC-parent behaviour (spec 0202/0209 require it)
 *   loyalty        relationship durability, betrayal in organized crime
 *   extraversion   friend formation, dating, creator and social growth
 *
 * All are 0–100 on the same scale as visible stats, so modifier maths reads the
 * same everywhere.
 */

import { clampStat, type StatValue } from '@yearafter/core';

export const PERSONALITY_KEYS = [
  'ambition',
  'riskTolerance',
  'temper',
  'generosity',
  'loyalty',
  'extraversion',
] as const;

export type PersonalityKey = (typeof PERSONALITY_KEYS)[number];

export type Personality = { readonly [K in PersonalityKey]: StatValue };

/**
 * The band a generated personality is drawn from.
 *
 * Wider than the birth-attribute band because these never move much after
 * birth — they are dispositions, not skills — so the spread at generation is
 * most of the variation a trait will ever have.
 *
 * THEY LIVE HERE BECAUSE OF A REQUIRE CYCLE.
 *
 * They were declared in `@yearafter/simulation`'s `new-game.ts`, which imports
 * the family generator, which imported these two constants back out of
 * `new-game.ts`. Metro said so on every bundle since Ticket 0202:
 *
 *   WARN Require cycle: simulation/src/new-game.ts
 *     -> simulation/src/family-generator.ts
 *     -> simulation/src/new-game.ts
 *   Require cycles are allowed, but can result in uninitialized values.
 *
 * "Can result in uninitialized values" is the part that matters. Whichever
 * module the bundler happens to enter first gets a partially-evaluated copy of
 * the other, and a `const` read during module initialisation can come back
 * `undefined` — which for these two would mean `stream.range(undefined,
 * undefined)`, silently, for every NPC in the game. It has not happened because
 * both reads are inside functions rather than at module scope, which is luck
 * rather than design.
 *
 * A cycle held together by two numbers is a cycle with an obvious fix: the
 * numbers are facts about `Personality`, so they belong beside it, and the
 * edge disappears.
 */
export const PERSONALITY_MIN = 12;
export const PERSONALITY_MAX = 92;

/**
 * Developer-facing labels. Used only by the debug screen — there is no
 * player-facing surface for these and there must not be one.
 */
export const PERSONALITY_LABELS: Readonly<Record<PersonalityKey, string>> = {
  ambition: 'Ambition',
  riskTolerance: 'Risk tolerance',
  temper: 'Temper',
  generosity: 'Generosity',
  loyalty: 'Loyalty',
  extraversion: 'Extraversion',
};

export function createPersonality(
  values: Partial<Record<PersonalityKey, number>> = {},
): Personality {
  const result = {} as { [K in PersonalityKey]: StatValue };
  for (const key of PERSONALITY_KEYS) {
    result[key] = clampStat(values[key] ?? 50);
  }
  return result;
}

export function adjustPersonality(
  personality: Personality,
  deltas: Partial<Record<PersonalityKey, number>>,
): Personality {
  const result = {} as { [K in PersonalityKey]: StatValue };
  for (const key of PERSONALITY_KEYS) {
    result[key] = clampStat(personality[key] + (deltas[key] ?? 0));
  }
  return result;
}
