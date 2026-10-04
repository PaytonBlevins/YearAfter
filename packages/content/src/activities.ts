/**
 * Ticket 0204 — extracurricular activities as content.
 *
 * Authored by `scripts/generate-activities.py`. Like every other catalog, logic
 * depends on the stable ids here and never on the display names (CORE_RULES 13).
 *
 * The important field is `hoursPerWeek`. It is the ONLY thing that limits how
 * many activities a character can hold — the menu never refuses a pick. See
 * `packages/education/src/workload.ts` for why.
 */

import type { VisibleStatKey, TalentKey } from '@yearafter/character';
import type { WealthBand } from '@yearafter/relationships';
import activitiesData from '../data/activities.json';

export type ActivityKind = 'sport' | 'arts' | 'academic' | 'service' | 'social';

export const ACTIVITY_KIND_LABELS: Readonly<Record<ActivityKind, string>> = {
  sport: 'Sports',
  arts: 'Arts',
  academic: 'Academic',
  service: 'Service',
  social: 'Social',
};

/**
 * Where an activity is offered.
 *
 * `adult` is Ticket 0416's, and it is not a school stage: it is anybody of
 * eighteen or over who is not in K-12, whether they are at college, working or
 * neither. The name stays because every caller already asks the question this
 * way — "which list am I choosing from" — and one more answer to it is cheaper
 * and safer than a second type that half the callers would forget to handle.
 */
export type SchoolStageId = 'elementary' | 'middle' | 'high' | 'adult';

export interface ActivityRequirements {
  readonly stages: readonly SchoolStageId[];
  readonly ageMin?: number;
  readonly ageMax?: number;
  readonly wealthAny?: readonly WealthBand[];
  readonly talentsAny?: readonly TalentKey[];
  readonly statAtLeast?: Partial<Record<VisibleStatKey, number>>;
  /**
   * Needs an adult who can collect a child from a late finish. A character with
   * no living parent cannot join these — one of the places Ticket 0202's
   * household shape quietly decides what a childhood looks like.
   */
  readonly needsParent?: boolean;
}

/**
 * A place you have to earn rather than decide on.
 *
 * Review, on the first version: "I was able to join the basketball team just by
 * clicking on it. I should have to tryout for things like that." An activity
 * with a `tryout` cannot be joined directly — it is attempted, it can be
 * failed, and it can be attempted again the following school year.
 */
export interface ActivityTryout {
  /** The button, and the word for what you are doing: "Try out", "Audition". */
  readonly label: string;
  /** The visible stat it is scored against, alongside the relevant talent. */
  readonly stat: VisibleStatKey;
}

export interface Activity {
  readonly id: string;
  readonly name: string;
  readonly kind: ActivityKind;
  /** One line, shown under the name on the activities screen. */
  readonly blurb: string;
  readonly hoursPerWeek: number;
  /** Whole dollars per year. Never present without `costSource`. */
  readonly annualCost?: number;
  /**
   * Where the money goes, as a phrase that reads inside a sentence. Required
   * whenever there is a cost: an unexplained balance change is a bug, not a
   * detail (see `claude/event-writing-rules.md`).
   */
  readonly costSource?: string;
  readonly requires: ActivityRequirements;
  /** Present when this must be earned. Absent means an open sign-up. */
  readonly tryout?: ActivityTryout;
  /** Timeline line when a tryout succeeds. */
  readonly tryoutText?: string;
  /** Timeline line when it does not. */
  readonly cutText?: string;
  readonly effects: Partial<Record<VisibleStatKey, number>>;
  /** Timeline line written when the character joins. */
  readonly joinText: string;
  /** Timeline line written when they leave. */
  readonly leaveText: string;
  /**
   * Ticket 0416. How it reads in the middle of a sentence — "the choir",
   * "running club" — for the lines an adult year writes. Present on every adult
   * pursuit (the generator refuses one without it); absent means the lowercased
   * name reads correctly.
   */
  readonly inSentence?: string;
}

interface ActivityCatalogFile {
  readonly version: number;
  readonly entries: readonly Activity[];
}

const catalog = activitiesData as unknown as ActivityCatalogFile;

export const ACTIVITIES: readonly Activity[] = catalog.entries;
export const ACTIVITY_CATALOG_VERSION = catalog.version;

const BY_ID = new Map(ACTIVITIES.map((activity) => [activity.id, activity]));

export const findActivity = (id: string): Activity | undefined => BY_ID.get(id);

export const activitiesForStage = (stage: SchoolStageId): readonly Activity[] =>
  ACTIVITIES.filter((activity) => activity.requires.stages.includes(stage));
