/**
 * Ticket 0805 — what is saved about an acting life.
 *
 * A leaf file with no imports from the rest of the simulation, so the game state can hold it without a cycle
 * (the same shape as `sports-state.ts`). The rules are in `acting.ts`; the table and the odds are in
 * `@yearafter/content`'s `acting.ts`.
 *
 * Acting reputation is the actor's own (spec 11): nothing here is a sport's, a creator's or a business's.
 */

/** Mirrors `ActingTier` in content, restated so this file has no imports. */
export type StandingTier = 'local' | 'commercial' | 'working' | 'supporting' | 'lead' | 'star';
export type RoleBilling = 'lead' | 'supporting' | 'bit';

/** A part that is on the table. Raised by a director, a casting call the actor applied to, or an agent. */
export interface Role {
  /** Unique for the life: the age it was raised at and a slot, e.g. "24:1". */
  readonly id: string;
  readonly tier: StandingTier;
  readonly billing: RoleBilling;
  /** "a student film", "a national commercial": the kind of work, with its article. */
  readonly medium: string;
  readonly title: string;
  /** Whole dollars, before an agent's share. */
  readonly fee: number;
  /** Days on set. A year has only so many. */
  readonly days: number;
  /** Whether the actor went for it or was asked. */
  readonly source: 'asked' | 'applied';
  /** The age it was raised at. */
  readonly age: number;
  /** Whether the fee has been bargained over already. */
  readonly asked?: boolean;
}

/** A part that was said yes to and is shot in the year to come. Paid and judged when that year is run. */
export type BookedRole = Omit<Role, 'source' | 'asked'> & { readonly bookedAge: number };

export interface ActingState {
  /**
   * What the actor can do, 0–100. Absent until acting first matters (a drama activity, lessons, a part); until
   * then it is read off the character.
   */
  readonly craft?: number;
  /** Years in a drama club or a community theater. */
  readonly stageYears: number;
  /** The last age at which the actor was on a stage, in lessons or on a set. Directors remember for a few years. */
  readonly seenAge?: number;
  /** Parts worked. */
  readonly credits: number;
  /** The rung work is coming in at. */
  readonly tier: StandingTier;
  /** The highest rung reached; kept for the record and for the life's last line. */
  readonly best?: StandingTier;
  /** Hits at this rung since the last rise. */
  readonly hits: number;
  /** 0–100, the actor's own. */
  readonly reputation: number;
  readonly awards: number;
  /** Years in a row with no part worked. */
  readonly idle: number;
  readonly agent?: { readonly since: number };
  readonly lessons?: { readonly since: number; readonly seasons: number };
  /** Character-development sessions put in this age, as in `ArtStudy`. */
  readonly devAtAge?: number;
  readonly devCount?: number;
  /** Parts on the table, in the order they were raised. The first is the question being asked. */
  readonly offers: readonly Role[];
  /** Parts accepted and not yet shot. */
  readonly booked: readonly BookedRole[];
  /** Casting calls applied to this age, by id; reset each year. */
  readonly appliedAge?: number;
  readonly applied: readonly string[];
}

export const EMPTY_ACTING: ActingState = {
  stageYears: 0,
  credits: 0,
  tier: 'local',
  hits: 0,
  reputation: 0,
  awards: 0,
  idle: 0,
  offers: [],
  booked: [],
  applied: [],
};
