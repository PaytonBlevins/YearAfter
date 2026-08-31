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

export type SchoolStageId = 'elementary' | 'middle' | 'high';

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
  readonly effects: Partial<Record<VisibleStatKey, number>>;
  /** Timeline line written when the character joins. */
  readonly joinText: string;
  /** Timeline line written when they leave. */
  readonly leaveText: string;
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
