/**
 * Ticket 0905 — what is saved about an intelligence life.
 *
 * A leaf file with no imports from the rest of the simulation (the shape of `military-state.ts`). The rules are in
 * `intel.ts`; the tables and the odds are in `@yearafter/content`'s `intel.ts`.
 *
 * A clearance is the person's, not a job's: it is granted by an investigation, kept while the work that needs it lasts,
 * and good for two years after. An agency career is the FBI's or the CIA's own and holds the whole year, as a service
 * life does. Military intelligence is not here: it is a specialty in the service career, and only the clearance and the
 * missions are kept on this side.
 */

/** Mirrors `ClearanceLevel` in content, restated so this file has no imports. */
export type ClearanceLevel = 'confidential' | 'secret' | 'top-secret';

/** Mirrors `AgencyId` in content. */
export type AgencyId = 'fbi' | 'cia';

/** Where a mission came from: the service, or an agency. Mirrors `MissionSource` in content. */
export type MissionSource = 'military' | AgencyId;

/** How a mission came out. Mirrors `MissionOutcome` in content. */
export type MissionOutcome = 'clean' | 'close' | 'mistake' | 'disaster';

export interface Clearance {
  readonly level: ClearanceLevel;
  readonly grantedAge: number;
  /**
   * The age at which the person was first found without a job that needs the clearance. It lapses two years on. Absent
   * while they hold such a job.
   */
  readonly idleSince?: number;
}

/** Where an agency career is: the academy year, then the work. */
export type AgencyStage = 'training' | 'serving';

export interface AgencyCareer {
  readonly agency: AgencyId;
  readonly stage: AgencyStage;
  readonly enteredAge: number;
  /** General Schedule grade, 9 to 15. */
  readonly grade: number;
  /** Whole years at this grade. */
  readonly gradeYears: number;
  /** Whole years at the agency. */
  readonly years: number;
  /** How the work is going, 0 to 100. Never shown as a number. */
  readonly performance: number;
  /** The agency's own opinion of them, 0 to 100, a word on screen. */
  readonly reputation: number;
  /** `hard` once Work Harder has been pressed, and it sticks. */
  readonly effort: 'normal' | 'hard';
  readonly pushedAtAge?: number;
  readonly pushedThisYear?: number;
  /** A year's pay, whole dollars, as last paid. */
  readonly lastPay: number;
  /** A made-up post, for the lines. */
  readonly post: string;
  /** How they came in: through the service with a clearance, or off a degree. */
  readonly door: 'service' | 'degree';
  /** Years of performance under the retain floor, running. Two ends the career. */
  readonly poorYears: number;
  /** The pay of the last three years, newest first, for the pension. */
  readonly highPay: readonly number[];
}

/** What is kept of an agency career once it is over. */
export interface PastAgency {
  readonly agency: AgencyId;
  readonly enteredAge: number;
  readonly endedAge: number;
  readonly years: number;
  readonly finalGrade: number;
  readonly reputation: number;
  /**
   * How it ended. `washed-out` did not finish the academy; `let-go` was separated for performance; `clearance-lost`
   * lost the clearance to a failed mission and so the job; `resigned` left; `retired` stopped with the years in or at
   * the compulsory age; `killed` died on a mission.
   */
  readonly how: 'washed-out' | 'let-go' | 'clearance-lost' | 'resigned' | 'retired' | 'killed';
  /** Retired pay, whole dollars a year, or zero. */
  readonly pension: number;
}

/** A mission that has been raised and is waiting to be answered. */
export interface IntelMission {
  readonly source: MissionSource;
  readonly age: number;
}

/** What is kept of a mission once answered. */
export interface PastMission {
  readonly age: number;
  readonly source: MissionSource;
  readonly outcome: MissionOutcome;
}

export interface IntelState {
  readonly clearance?: Clearance;
  /** The age a clearance was last taken away, if ever. A revocation weighs on every investigation after it. */
  readonly revokedAge?: number;
  /** The age of a denied investigation, the last. */
  readonly deniedAge?: number;
  readonly career?: AgencyCareer;
  readonly past: readonly PastAgency[];
  /** The age of the last application to an agency. One a year. */
  readonly appliedAge?: number;
  /**
   * True once the game can play a mission (the minigame of a later ticket). A mission is never raised until it is, and
   * nothing stands in for the missing result. Whatever builds the minigame turns this on.
   */
  readonly missionsOpen?: boolean;
  /** The mission standing, if one is. */
  readonly mission?: IntelMission;
  /** Missions that are over, oldest first. */
  readonly missions?: readonly PastMission[];
}

export const EMPTY_INTEL: IntelState = { past: [] };
