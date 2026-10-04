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
  /**
   * Ticket 0212. A grave diagnosis is a thing a life turns on, and there was
   * nowhere to put one — the union was written in Sprint Zero, before the game
   * had a body. Grown by one variant rather than filed under 'family', the same
   * way 0210 grew `TimelineKind` rather than reusing 'finance': a diagnosis and
   * a wedding are different things to a reader of the death screen.
   */
  | 'health'
  /**
   * Ticket 0409. Losing somebody close.
   *
   * 0212 filed these under 'family' because 'family' was the nearest thing that
   * existed, and this interface's own rule — "never derived by parsing timeline
   * text" — then had no way to answer "has this character been bereaved
   * recently" except by reading labels for the word "Lost". Grown by one
   * variant for the same reason 0212 grew it for 'health' and 0210 grew
   * `TimelineKind`: a funeral and a wedding are different things to anybody
   * asking.
   */
  | 'loss'
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

/**
 * Ticket 0211a — the only supported way to put an entry in the feed.
 *
 * CORE_RULES 13.12 says a timeline entry's id is unique, forever. Enforcing
 * that in each producer has now failed THREE TIMES, and the player reported all
 * three:
 *
 *  - 0206b: `t:2012:study` twice, because Study Harder became twice a year and
 *    the id did not carry the term.
 *  - 0207c: the same id again, this time already sitting in saved games where a
 *    fixed producer could never reach it.
 *  - 0210c: `t:2020:work:1` twice, because quitting a job and being hired
 *    somewhere else in the SAME YEAR resets the push counter, and the id
 *    carried the counter but not the job.
 *
 * Sixteen places appended to the timeline and every one of them invented its
 * own id, so the invariant was sixteen separate promises. This is the one
 * place, and it keeps the promise itself: an id that is already in the feed
 * gets a suffix rather than a collision.
 *
 * The suffix is deliberately the same shape the 0207c migration writes, so a
 * repaired save and a live one are indistinguishable, and it is derived only
 * from what is already in the timeline — no RNG, no clock — so a life still
 * replays identically from its seed.
 *
 * This is a NET, not a license. A producer whose ids collide is still a
 * producer with a bug: the suffix keeps React rendering while the real id stays
 * wrong, and `everyIdIsUnique` in the simulation tests is what catches that.
 * The work id was fixed at the same time this landed.
 */
export function appendToTimeline(
  timeline: readonly TimelineEntry[],
  entry: TimelineEntry,
): readonly TimelineEntry[] {
  if (!timeline.some((existing) => existing.id === entry.id)) return [...timeline, entry];

  let suffix = 1;
  while (timeline.some((existing) => existing.id === `${entry.id}:dup${suffix}`)) suffix += 1;
  return [...timeline, { ...entry, id: `${entry.id}:dup${suffix}` }];
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

/* -------------------------------------------------------------------------- */
/* Life records — Ticket 0212                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A milestone, before it knows when it happened.
 *
 * The producer supplies the two things only it can know — what KIND of thing
 * this was, and what to call it — and `advanceYear` (or the player action that
 * caused it) stamps the age, the year and the id. That split is deliberate: a
 * producer that had to invent its own id is sixteen producers inventing sixteen
 * id schemes, which is the whole of CORE_RULES 13.31 and the reason
 * `appendToTimeline` exists two hundred lines above this.
 */
export interface NewLifeRecord {
  readonly category: LifeRecordCategory;
  readonly label: string;
  readonly referenceId?: string;
}

/**
 * The one supported way into `records`.
 *
 * `records` was declared in Sprint Zero with the comment "structured history
 * for dynasty records and the death summary", initialized to `[]`, and written
 * by nothing for eleven tickets — the third instance of CORE_RULES 13.36 in
 * this build, after `droppedOut` and `alive`. 0212 is the ticket that finally
 * needed it, and discovered it was not building a death screen but building the
 * thing the death screen had been assuming.
 *
 * Defensive in the same way the timeline door is, and for the same reason: two
 * producers can legitimately both notice a marriage in one year, and a record
 * list with the wedding in it twice is a highlights reel that says "Married
 * Priya" and then says it again.
 */
export function appendRecord(
  records: readonly LifeRecord[],
  record: LifeRecord,
): readonly LifeRecord[] {
  if (records.some((existing) => existing.id === record.id)) return records;
  return [...records, record];
}

/** Stamp a producer's record with when it happened. */
export const stampRecord = (
  record: NewLifeRecord,
  age: number,
  year: number,
  ordinal = 0,
): LifeRecord => ({
  id: `r:${year}:${record.category}:${ordinal}`,
  category: record.category,
  age,
  year,
  label: record.label,
  ...(record.referenceId !== undefined ? { referenceId: record.referenceId } : {}),
});
