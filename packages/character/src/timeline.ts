/**
 * Life timeline (Ticket 0104).
 *
 * Two distinct things live here, and the difference matters:
 *
 *  - TimelineEntry is the readable chronological feed on the Life screen.
 *  - LifeRecord is structured history — awards, championships, offices held,
 *    businesses founded, convictions. Spec 3 and the inherited inventory require
 *    that major accomplishments stay *queryable data*, not only feed prose, so
 *    dynasty records and the death summary can be assembled later without
 *    parsing text.
 */

import type { EventId } from '@yearafter/core';

export type TimelineKind =
  /** Background developments. The bulk of a year (spec 725–770). */
  | 'passive'
  /** The outcome of a decision the player made. */
  | 'decision'
  /** An opportunity that appeared. */
  | 'opportunity'
  /** Life-stage marker: birth, starting school, graduating, death. */
  | 'milestone'
  /** Money movement worth surfacing in the feed. */
  | 'finance'
  /** Health and injury developments. */
  | 'health'
  /** Relationship developments. */
  | 'relationship'
  /**
   * Work: getting hired, being promoted, being let go, being paid.
   *
   * Ticket 0210. A protected contract (spec 1440) grown by one variant rather
   * than reusing 'finance', because a paycheck and a promotion are different
   * things to a reader and the feed colours them apart. Every exhaustive switch
   * over this union is a compile error until it handles the new one, which is
   * the point of the union being exhaustive.
   */
  | 'career';

export interface TimelineEntry {
  readonly id: string;
  /** Age the character was when this happened. Groups the feed into sections. */
  readonly age: number;
  /** In-world calendar year. */
  readonly year: number;
  readonly kind: TimelineKind;
  /** One or two conversational sentences (spec 725–770). */
  readonly text: string;
  /** Source event definition, when this came from the event engine. */
  readonly eventId?: EventId;
  /** Ordering within a single age, ascending. */
  readonly sequence: number;
}

export type LifeRecordCategory =
  | 'education'
  | 'career'
  | 'award'
  | 'championship'
  | 'business'
  | 'property'
  | 'family'
  | 'military'
  | 'political'
  | 'criminal'
  | 'creator'
  | 'collection';

/** Structured, queryable history. Never derived by parsing timeline text. */
export interface LifeRecord {
  readonly id: string;
  readonly category: LifeRecordCategory;
  readonly age: number;
  readonly year: number;
  /** Short canonical label, e.g. 'Graduated — Biology'. */
  readonly label: string;
  /** Stable content id of whatever this record refers to, when one exists. */
  readonly referenceId?: string;
}

export function createTimelineEntry(
  entry: Omit<TimelineEntry, 'id'> & { readonly id?: string },
): TimelineEntry {
  const { id, ...rest } = entry;
  return { id: id ?? `t:${rest.year}:${rest.sequence}`, ...rest };
}

/** Group the feed by age, newest age first — the order the Life screen renders. */
export function groupByAge(
  entries: readonly TimelineEntry[],
): { age: number; entries: TimelineEntry[] }[] {
  const byAge = new Map<number, TimelineEntry[]>();
  for (const entry of entries) {
    const bucket = byAge.get(entry.age);
    if (bucket) bucket.push(entry);
    else byAge.set(entry.age, [entry]);
  }
  return [...byAge.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([age, list]) => ({
      age,
      entries: [...list].sort((a, b) => a.sequence - b.sequence),
    }));
}
