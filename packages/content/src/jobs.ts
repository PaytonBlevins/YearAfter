/**
 * Ticket 0210 — the job catalog, as content.
 *
 * Authored by `scripts/generate-jobs.py`, which owns the balance rules: every
 * track is a ladder with no gaps in it, every rung pays more than the one below
 * (a promotion nobody would want is not a promotion), and at least five ways in
 * need neither a diploma nor experience.
 *
 * Logic depends on the stable ids here and never on the display names
 * (CORE_RULES 13). The shape lives in `@yearafter/careers`; this file only
 * loads it, because `@yearafter/content` is the one package allowed to know
 * where the JSON is.
 */

import jobsData from '../data/jobs.json';

export interface JobEntry {
  readonly id: string;
  readonly title: string;
  readonly track: string;
  readonly rung: number;
  readonly template: string;
  /** Whole dollars a year, before tax and before living. */
  readonly pay: number;
  readonly spread: number;
  readonly minAge: number;
  /** Hard floor: you legally cannot do this job without it. */
  readonly requires: string;
  /** Soft: a heavier door without it, never a shut one (spec 119). */
  readonly prefers: string;
  /**
   * A license id this job legally requires, on top of any degree (Ticket 0406).
   *
   * Loose (`string`) for the same reason `track` and `requires` are: this
   * package must not learn what a license IS, only that a row can name one.
   * `@yearafter/careers` narrows it and the content validator checks it
   * resolves.
   */
  readonly license?: string;
  readonly demand: number;
  readonly blurb: string;
}

interface JobCatalogFile {
  readonly version: number;
  readonly entries: readonly JobEntry[];
}

const catalog = jobsData as unknown as JobCatalogFile;

export const JOBS: readonly JobEntry[] = catalog.entries;
export const JOB_CATALOG_VERSION = catalog.version;

const BY_ID = new Map(JOBS.map((job) => [job.id, job]));

export const findJobEntry = (id: string): JobEntry | undefined => BY_ID.get(id);

export const jobsOnTrack = (track: string): readonly JobEntry[] =>
  JOBS.filter((job) => job.track === track).sort((a, b) => a.rung - b.rung);

/** Every track that has any job in it, in a stable order. */
export const JOB_TRACKS: readonly string[] = [...new Set(JOBS.map((job) => job.track))].sort();

/**
 * The rung above this one on the same track, if there is one.
 *
 * A track can have two jobs on the same rung — kitchen crew and server are both
 * ways into food — so this returns the FIRST of the next rung and the promotion
 * code picks among them. A job at the top of its ladder returns nothing, which
 * is a real place to be and not an error.
 */
export const nextRungAfter = (job: JobEntry): JobEntry | undefined =>
  jobsOnTrack(job.track).find((entry) => entry.rung === job.rung + 1);

/* -------------------------------------------------------------------------- */
/* Employers (Ticket 0210b)                                                    */
/* -------------------------------------------------------------------------- */

import employersData from '../data/employers.json';

interface EmployerCatalogFile {
  readonly version: number;
  readonly byTrack: Readonly<Record<string, readonly string[]>>;
}

const employers = employersData as unknown as EmployerCatalogFile;

export const EMPLOYERS_BY_TRACK = employers.byTrack;
export const EMPLOYER_CATALOG_VERSION = employers.version;

/**
 * Who this opening is with.
 *
 * `draw` is a stable [0,1) supplied by the caller — the same job in the same
 * year is always at the same company, so opening the card twice does not
 * reshuffle the employer, and next year's opening for the same title is
 * somewhere else. No RNG is consumed and nothing is stored: an employer is
 * texture on a listing, not state on a save.
 */
export function employerFor(track: string, draw: number): string {
  const names = employers.byTrack[track];
  if (!names || names.length === 0) return 'a local firm';
  return names[Math.min(names.length - 1, Math.floor(draw * names.length))] as string;
}
