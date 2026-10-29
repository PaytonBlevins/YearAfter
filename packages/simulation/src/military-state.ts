/**
 * Ticket 0901 — what is saved about a service life.
 *
 * A leaf file with no imports from the rest of the simulation, so the game state can hold it without a cycle (the same
 * shape as `sports-state.ts`). The rules are in `military.ts`; the table and the odds are in `@yearafter/content`'s
 * `military.ts`.
 *
 * A service reputation is the service's own (spec 11): nothing here is an employer's, a team's or a stage's. When a
 * career ends, what is kept is `PastService`, which holds no performance at all.
 */

/** Mirrors `ServiceBranchId` in content, restated so this file has no imports. */
export type ServiceBranch = 'army';

/**
 * Where the career is. `training` is the first year: basic training, and then the first posting. A recruit who does not
 * finish never becomes `serving`.
 */
export type ServiceStage = 'training' | 'serving';

export interface ServiceCareer {
  readonly branch: ServiceBranch;
  readonly stage: ServiceStage;
  /** The age they enlisted at. */
  readonly enlistedAge: number;
  /** Enlisted grade, 1 to 9 (E-1 to E-9). */
  readonly grade: number;
  /** Whole years of service completed. */
  readonly years: number;
  /** The years of service at which the current term ends: 4, then 8, and so on. */
  readonly termEnds: number;
  /** How the work is going, 0–100. Never shown as a number. */
  readonly performance: number;
  /** The service's own opinion of them, 0–100, a word on screen (spec 11). */
  readonly reputation: number;
  /** `hard` once Work Harder has been pressed, and it sticks, as it does in a civilian job. */
  readonly effort: 'normal' | 'hard';
  /** The age Work Harder was last pressed at, and the presses that year. */
  readonly pushedAtAge?: number;
  readonly pushedThisYear?: number;
  /** What last year's basic pay came to, whole dollars. */
  readonly lastPay: number;
  /** The post they are at, a made-up name, for the lines. */
  readonly post: string;
}

/** What is kept of a service once it is over. 0904 grows `discharge` and what follows a discharge. */
export interface PastService {
  readonly branch: ServiceBranch;
  readonly enlistedAge: number;
  readonly endedAge: number;
  readonly years: number;
  readonly finalGrade: number;
  readonly reputation: number;
  /**
   * How it ended. `washed-out` is a recruit who did not finish basic training; `not-retained` is a term the service
   * did not ask them to extend; `term` is a person who chose to leave; `retired` is twenty years.
   */
  readonly how: 'washed-out' | 'not-retained' | 'term' | 'retired';
  /** `entry-level` is the discharge of somebody who did not finish training; the rest are honorable until 0904. */
  readonly discharge: 'honorable' | 'entry-level';
}

/** A question the service is asking. Frozen when it was raised (the 0402 lesson). */
export type MilitaryOffer =
  | {
      /** A recruiter's offer. */
      readonly kind: 'enlist';
      readonly branch: ServiceBranch;
      readonly age: number;
      readonly eventId: string;
    }
  | {
      /** The end of a term. */
      readonly kind: 'reenlist';
      readonly branch: ServiceBranch;
      readonly grade: number;
      readonly years: number;
      readonly age: number;
      readonly eventId: string;
    };

export interface MilitaryState {
  readonly service?: ServiceCareer;
  readonly past: readonly PastService[];
  readonly offer?: MilitaryOffer;
  /** The age of the last recruiter's offer that was turned down. A new one is not raised in the year after. */
  readonly turnedDownAge?: number;
  /** The age of the last application to enlist. One a year. */
  readonly appliedAge?: number;
}

export const EMPTY_MILITARY: MilitaryState = { past: [] };
