/**
 * Ticket 0807 — what is saved about a modeling life.
 *
 * A leaf file with no imports from the rest of the simulation, so the game state can hold it without a cycle
 * (the same shape as `acting-state.ts`). The rules are in `modeling.ts`; the table and the odds are in
 * `@yearafter/content`'s `modeling.ts`.
 *
 * A model's reputation is their own (spec 11): nothing here is an actor's, a creator's or a business's.
 */

/** Mirrors `ModelTier` and `ModelPlacement` in content, restated so this file has no imports. */
export type ModelStanding = 'test' | 'catalogue' | 'commercial' | 'editorial' | 'campaign' | 'face';
export type JobPlacement = 'face' | 'featured' | 'group';

/** A job that is on the table. Raised by a booker, a casting the model went to, or an agency. */
export interface Job {
  /** Unique for the life: the age it was raised at and a slot, e.g. "24:1". */
  readonly id: string;
  readonly tier: ModelStanding;
  readonly placement: JobPlacement;
  /** "a catalogue shoot", "a runway show": the kind of work, with its article. */
  readonly medium: string;
  readonly client: string;
  /** Whole dollars a day, before an agency's share. */
  readonly rate: number;
  /** Days of work. A year has only so many. */
  readonly days: number;
  /** Whole dollars for the right to run the pictures, before an agency's share. */
  readonly usage: number;
  /** Whether the model went for it or was asked. */
  readonly source: 'asked' | 'applied';
  /** The age it was raised at. */
  readonly age: number;
  /** Whether the pay has been bargained over already. */
  readonly asked?: boolean;
}

/** A job that was said yes to and is shot in the year to come. Paid and judged when that year is run. */
export type BookedJob = Omit<Job, 'source' | 'asked'> & { readonly bookedAge: number };

export interface ModelingState {
  /** What the model can do, 0–100. Absent until modeling first matters (a portfolio, a job); until then it is read off the character. */
  readonly craft?: number;
  /** The last age at which the model was seen: a portfolio sent round, or a job worked. Bookers remember for a few years. */
  readonly seenAge?: number;
  /** The last age a portfolio was shot at; it is billed when that year is run. */
  readonly portfolioAge?: number;
  /** Jobs worked. */
  readonly credits: number;
  /** The rung work is coming in at. */
  readonly tier: ModelStanding;
  /** The highest rung reached; kept for the record. */
  readonly best?: ModelStanding;
  /** Hits at this rung since the last rise. */
  readonly hits: number;
  /** 0–100, the model's own. */
  readonly reputation: number;
  readonly awards: number;
  /** Years in a row with no job worked. */
  readonly idle: number;
  /** What last year's work paid, after the agency, whole dollars. A living is a year like that. */
  readonly lastPay: number;
  readonly agency?: { readonly since: number };
  /** People who follow the model's work. What brands read when they offer a deal. */
  readonly followers: number;
  /** The most it has been. */
  readonly peak: number;
  /** Brand-deal money agreed and not yet paid, whole dollars, before an agency's share. Paid with the next year's income. */
  readonly brandOwed: number;
  /** Brand offers answered, by id. Pruned each year. */
  readonly brandAnswered: readonly string[];
  /** Jobs on the table, in the order they were raised. The first is the question being asked. */
  readonly offers: readonly Job[];
  /** Jobs accepted and not yet shot. */
  readonly booked: readonly BookedJob[];
  /** Castings applied to this age, by id; reset each year. */
  readonly appliedAge?: number;
  readonly applied: readonly string[];
}

export const EMPTY_MODELING: ModelingState = {
  credits: 0,
  tier: 'test',
  hits: 0,
  reputation: 0,
  awards: 0,
  idle: 0,
  lastPay: 0,
  followers: 0,
  peak: 0,
  brandOwed: 0,
  brandAnswered: [],
  offers: [],
  booked: [],
  applied: [],
};
