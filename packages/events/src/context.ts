/**
 * Ticket 0203 — what an event is allowed to know.
 *
 * The engine deliberately takes a flat read-only snapshot rather than the live
 * `GameState`. Two reasons, both load-bearing:
 *
 *  - `@yearafter/simulation` depends on this package, so this package cannot
 *    depend on it. The snapshot is the seam.
 *  - An event condition that could reach anywhere would eventually reach
 *    something it should not, and the catalog would stop being reviewable. If a
 *    future event needs a fact that is not on this interface, adding it here is
 *    a deliberate, visible decision.
 */

import type { Personality, Sex, Talents, VisibleStats } from '@yearafter/character';
import type { Household } from '@yearafter/relationships';

export interface EventContext {
  readonly age: number;
  readonly year: number;
  readonly firstName: string;
  /** Used to keep an incidental adult from sharing the family's surname. */
  readonly lastName: string;
  readonly sex: Sex;
  readonly stats: VisibleStats;
  readonly talents: Talents;
  /** Hidden traits. Events may weight on them; they are never named in text. */
  readonly personality: Personality;
  readonly family: Household;
  /** Naming tradition, so incidental characters in event text sound local. */
  readonly nameCultureId: string;
  /** Display form of where the character lives now, e.g. "Toledo, OH". */
  readonly homeCity: string;
  /** Story flags set by earlier events. */
  readonly flags: ReadonlySet<string>;
  /**
   * Where the character is in school (Ticket 0204), and how much they have
   * signed up for. Enough for an event to know whether a school scene makes
   * sense and whether this character is already stretched — not enough for the
   * catalog to start reasoning about grades, which is the education package's
   * job.
   */
  readonly schoolStage: string;
  readonly activityCount: number;
}
