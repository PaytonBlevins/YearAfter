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
import type { EventPerson } from './text';

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
  /** Ticket 0207. Whether the character is currently seeing somebody. */
  readonly partnered: boolean;
  /** Ticket 0208. Whether the character has any living children. */
  readonly hasChildren: boolean;
  /**
   * Ticket 0209. Lines the year already holds before events run.
   *
   * `MAX_EVENTS_PER_YEAR` was a budget for the event phase alone, which was
   * correct while the event phase was the only thing filling a year. It is now
   * the fifth of six writers, and adding a sixth pushed the worst year to eight
   * entries against a cap of seven — the same overflow reading output found in
   * 0206, arriving again by the same route.
   *
   * So the budget is now the YEAR's, and events spend what is left of it.
   */
  readonly alreadyThisYear: number;
  /** Whole dollars the character is actually holding, for `cashAtLeast`. */
  readonly cash: number;
  /**
   * Ticket 0409. Whether they have a job, what kind, and how long they have
   * had it.
   *
   * The same lesson as `partnered` (0207) and `hasChildren` (0208), for the
   * third time and for the largest hole yet: measured at 26 of 374 events able
   * to fire at forty, NONE of them about work. An event that says "your boss
   * asks you to stay late" has to be able to say it only to somebody with a
   * boss, and until this the predicate language could not.
   *
   * `jobTrack` is the track id ('retail', 'medicine', ...) so a scene can be
   * about the actual work. `jobYears` is years in the CURRENT job, because "you
   * have been here eleven years" and "you started in March" are different
   * scenes.
   */
  readonly employed: boolean;
  readonly jobTrack?: string;
  readonly jobYears: number;
  /**
   * Ticket 0409. Condition ids this character is carrying.
   *
   * Roadmap finding 4: 0211 gave the game a body and no authored event ever
   * fired because of a diagnosis, so a character with something serious lived
   * an event library that had never heard of it.
   */
  readonly conditions: readonly string[];
  /**
   * Ticket 0409. Years since they last lost somebody close, if they have.
   *
   * Roadmap finding 4b. Derived from `LifeRecord`s of category 'loss' rather
   * than from timeline text, which is what that category was added for.
   */
  readonly bereavedWithin?: number;
  /**
   * Ticket 0412. How many friends the character has, and how long they have had
   * the longest-standing one.
   *
   * Counted rather than flagged, because `hasFriend` is derivable from a count
   * and two fields that can disagree about the same thing is the drift
   * CORE_RULES 13.19 is about. Both exclude anybody the character is involved
   * with: `partnered` is the question about a partner and has been since 0207.
   *
   * `friendshipYears` is 0 when there are no friends, which reads correctly
   * against `friendshipYearsAtLeast` — a character with nobody has not known
   * anybody for ten years.
   */
  readonly friends: number;
  readonly friendshipYears: number;
  /**
   * The people this character actually knows (Ticket 0206) — classmates and
   * the teacher who has them this year.
   *
   * `{kid}` and `{adult}` bind to these when there are any, so an event names
   * somebody the player will see again rather than inventing a stranger. Empty
   * for a four-year-old and for anybody out of school, which is why the
   * invented-name path still exists.
   *
   * A narrow shape rather than @yearafter/social's own type, in the same spirit
   * as the rest of this interface: the engine learns what it needs and no more.
   */
  readonly people: readonly EventPerson[];
}
