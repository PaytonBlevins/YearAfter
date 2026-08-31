/**
 * Character state.
 *
 * PROTECTED CONTRACT (spec 1060–1066). Foundational changes need product-owner
 * approval before they become canonical.
 *
 * Design notes carried from the spec:
 *  - Birth geography is stored but backend-only after creation; current
 *    geography is player-facing (spec 4.1, 828–838).
 *  - Citizenship is never a normal profile field (spec 4.1).
 *  - There is no family ID (spec 4.1). Legacy identity is a crest/emblem instead.
 *  - Cash lives here; everything derived (net worth, monthly outflow, liabilities)
 *    is computed from source state and never duplicated (spec 1224–1246).
 */

import type { BirthLocation, CharacterId, CurrentLocation, Money } from '@yearafter/core';
import { ZERO } from '@yearafter/core';
import { createPersonality, type Personality } from './personality';
import { createStats, createStressState, type StressState, type VisibleStats } from './stats';
import { createTalents, type Talents } from './talents';
import type { LifeRecord, TimelineEntry } from './timeline';

export type Sex = 'male' | 'female';

export type LifeStage =
  'infant' | 'child' | 'teen' | 'youngAdult' | 'adult' | 'middleAge' | 'senior';

export interface Character {
  readonly id: CharacterId;
  readonly firstName: string;
  readonly lastName: string;
  readonly sex: Sex;
  readonly age: number;
  /** In-world calendar year of birth. */
  readonly birthYear: number;
  readonly alive: boolean;

  /** Backend/history only. Never rendered as a profile field. */
  readonly birthLocation: BirthLocation;
  /** Player-facing. */
  readonly currentLocation: CurrentLocation;

  readonly stats: VisibleStats;
  /** Boolean at birth, persistent for life (spec 1070). */
  readonly talents: Talents;
  /** Hidden. Never shown to the player — see personality.ts. */
  readonly personality: Personality;
  readonly stress: StressState;

  /** Liquid cash, exact integer cents. The ledger is the source of truth for movement. */
  readonly cash: Money;

  /**
   * What the header shows beneath the name: 'Student', 'Line Cook', 'Unemployed'.
   * Derived from career/education state once those exist (v0.02+); held directly
   * for now so the v0.01 shell has something honest to render.
   */
  readonly occupation: string;

  readonly timeline: readonly TimelineEntry[];
  /** Structured history for dynasty records and the death summary. */
  readonly records: readonly LifeRecord[];
}

export function lifeStageFor(age: number): LifeStage {
  if (age <= 2) return 'infant';
  if (age <= 12) return 'child';
  if (age <= 17) return 'teen';
  if (age <= 29) return 'youngAdult';
  if (age <= 44) return 'adult';
  if (age <= 64) return 'middleAge';
  return 'senior';
}

export const fullName = (character: Character): string =>
  `${character.firstName} ${character.lastName}`;

/**
 * Life-stage occupation label used until a character has real education or
 * employment state.
 *
 * PLACEHOLDER — Ticket 0204 (school progression) and Ticket 0210 (employment)
 * replace this with the actual enrolment or job title. It exists because the
 * header showing "Newborn" at age 30 is worse than an honest life-stage label,
 * and because the v0.01 review gate is judging exactly this kind of detail.
 */
export function defaultOccupationFor(age: number): string {
  switch (lifeStageFor(age)) {
    case 'infant':
      return 'Newborn';
    case 'child':
      return 'Child';
    case 'teen':
      return 'Student';
    case 'senior':
      return 'Retired';
    default:
      return 'Unemployed';
  }
}

export interface CreateCharacterInput {
  readonly id: CharacterId;
  readonly firstName: string;
  readonly lastName: string;
  readonly sex: Sex;
  readonly birthYear: number;
  readonly birthLocation: BirthLocation;
  readonly currentLocation?: CurrentLocation;
  readonly stats?: Partial<VisibleStats>;
  readonly talents?: Talents;
  readonly personality?: Personality;
  readonly cash?: Money;
  readonly occupation?: string;
  readonly age?: number;
}

/**
 * Assemble a character record. This is a constructor, not a generator — the
 * randomised character generator with its birth-attribute and talent rolls is
 * Ticket 0201.
 */
export function createCharacter(input: CreateCharacterInput): Character {
  return {
    id: input.id,
    firstName: input.firstName,
    lastName: input.lastName,
    sex: input.sex,
    age: input.age ?? 0,
    birthYear: input.birthYear,
    alive: true,
    birthLocation: input.birthLocation,
    currentLocation: input.currentLocation ?? input.birthLocation,
    stats: createStats(input.stats),
    talents: input.talents ?? createTalents(),
    personality: input.personality ?? createPersonality(),
    stress: createStressState(),
    cash: input.cash ?? ZERO,
    occupation: input.occupation ?? 'Newborn',
    timeline: [],
    records: [],
  };
}
