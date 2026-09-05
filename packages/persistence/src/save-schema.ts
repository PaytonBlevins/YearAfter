/**
 * Ticket 0005 — SaveGameV1.
 *
 * PROTECTED CONTRACT (spec 1060–1066): save format.
 *
 * Spec 1108–1140: saves carry an explicit schema version, migrations are tested,
 * and old dynasties should stay loadable whenever possible. The rule that follows
 * from that: never repurpose or narrow an existing field. Add a field, bump the
 * version, write a migration, keep the old reader working.
 */

import type { Character } from '@yearafter/character';
import type { EducationState } from '@yearafter/education';
import type { SocialCircle } from '@yearafter/social';
import type { EventHistory, PendingDecision } from '@yearafter/events';
import type { RngSnapshot, WorldState } from '@yearafter/simulation';
import type { Household } from '@yearafter/relationships';
import type { SaveId } from '@yearafter/core';

export const CURRENT_SAVE_VERSION = 10;

export interface SaveSettings {
  /** Reduced animation and shorter transitions. */
  readonly reduceMotion: boolean;
  /** Development-only helpers. Never true in a production build. */
  readonly debugMode: boolean;
}

export const DEFAULT_SETTINGS: SaveSettings = {
  reduceMotion: false,
  debugMode: false,
};

export type { WorldState };

/**
 * v2 added `player.personality` (Ticket 0201).
 * v3 added `family` (Ticket 0202).
 * v4 added `nameCultureId`, `events` and `pending` (Ticket 0203).
 * v5 added `education` (Ticket 0204).
 * v6 added `names` to a pending decision (Ticket 0203b).
 * v7 added tryout memory to education (Ticket 0204b).
 * v8 added Study Harder's once-a-year memory (Ticket 0205).
 * v9 added `circle` — classmates, friends and teachers (Ticket 0206).
 * v10 replaced the circle's once-a-year cap with per-year contact counting,
 *     and gave every joined activity a performance record (Ticket 0206b).
 *
 * Ticket 0207 (Love) did NOT bump the version, and that is a decision rather
 * than an oversight. It added one optional field, `romance`, to a person in the
 * circle. Absent already means exactly what it has to mean for every existing
 * save — this is not somebody you were ever going out with — so there is nothing
 * for a migration to compute. A version bump whose migration is the identity
 * function is a lie about what changed.
 *
 * Older saves migrate forward; see migrations.ts.
 */
export interface SaveGameV10 {
  readonly version: 10;
  readonly id: SaveId;
  /** Master RNG seed plus live domain-stream states. */
  readonly rng: RngSnapshot;
  readonly world: WorldState;
  readonly player: Character;
  /** Ticket 0202. Beside the player, not on them — see GameState. */
  readonly family: Household;
  /** Ticket 0201's naming tradition, kept so event text stays culturally local. */
  readonly nameCultureId: string;
  /** Ticket 0203: cooldowns, scheduled chains and story flags. */
  readonly events: EventHistory;
  /**
   * Decisions raised but not yet answered. Persisted deliberately — a question
   * asked on a phone at a bus stop has to still be there on a tablet that night.
   */
  readonly pending: readonly PendingDecision[];
  /** Ticket 0204: enrolment, grades, behaviour and extracurriculars. */
  readonly education: EducationState;
  readonly circle: SocialCircle;
  readonly settings: SaveSettings;
  /** Unix ms. Metadata only — never used in simulation logic. */
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** The union widens as versions are added; the app only ever handles the latest. */
export type AnySaveGame = SaveGameV10;
export type CurrentSaveGame = SaveGameV10;

/** Lightweight row for the save-select list, without deserialising the whole save. */
export interface SaveSummary {
  readonly id: SaveId;
  readonly characterName: string;
  readonly age: number;
  readonly year: number;
  readonly generation: number;
  readonly occupation: string;
  readonly updatedAt: number;
}

export function summarise(save: CurrentSaveGame): SaveSummary {
  return {
    id: save.id,
    characterName: `${save.player.firstName} ${save.player.lastName}`,
    age: save.player.age,
    year: save.world.year,
    generation: save.world.generation,
    occupation: save.player.occupation,
    updatedAt: save.updatedAt,
  };
}
