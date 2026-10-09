/**
 * Ticket 0204 — the education phase.
 *
 * The second phase module. Same shape as `phases/events.ts`: build the input the
 * domain package wants, run it, fold the results back into state. All the actual
 * schooling logic is in @yearafter/education, which knows nothing about
 * GameState.
 *
 * Ordering inside the year is deliberate and fixed. Education runs BEFORE
 * events, because the events that fire in a school year should be able to read
 * the grade the character is now in — and because a report-card event that
 * arrives before the report card is nonsense.
 */

import { nudgeStats, type Character } from '@yearafter/character';
import { dollars } from '@yearafter/core';
import {
  MAJORS,
  isInSchool,
  runSchoolYear,
  statusLabel,
  type EducationState,
} from '@yearafter/education';
import type { NewLifeRecord, TimelineKind } from '@yearafter/character';
import type { NewTransaction } from '@yearafter/finance';
import type { GameState } from '../game-state';
import { RngDomains } from '../rng/rng';

export interface EducationPhaseOutput {
  readonly player: Character;
  readonly education: EducationState;
  /** Committed hours and capacity, for the stress phase (Ticket 0205). */
  readonly hours: number;
  readonly capacity: number;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
  /** Ticket 0212. Structured history, for the death screen. */
  readonly records: readonly NewLifeRecord[];
  /** Ticket 0301. What this phase moved, for `advanceYear` to post. */
  readonly transactions: readonly NewTransaction[];
  /** P6: derived income for tax/living integration; never saved. */
  readonly shiftGross: number;
  readonly freelanceGross: number;
}

/**
 * What school produced this year, as a fact rather than a sentence.
 *
 * Derived from the STAGE TRANSITION and from the credential count, not from the
 * lines the domain package wrote. That distinction is the whole reason
 * `LifeRecord` exists — spec 3 wants major accomplishments to stay queryable
 * data, and its comment in `timeline.ts` says "never derived by parsing
 * timeline text". Reading `before.stage !== after.stage` is reading structure;
 * matching on the word "Graduated" would be reading prose, and would break the
 * first time somebody rewrote the line. 0211b rewrote a hundred and eighty of
 * them.
 */
function schoolRecords(
  before: EducationState,
  after: EducationState,
  majorTitle: (majorId: string | undefined) => string,
): NewLifeRecord[] {
  const records: NewLifeRecord[] = [];
  if (before.stage === after.stage) return recordsForDegree(before, after, majorTitle, records);
  if (after.stage === 'graduated' && before.stage === 'high') {
    records.push({ category: 'education', label: 'Graduated high school' });
  }
  if (after.stage === 'droppedOut') {
    records.push({ category: 'education', label: 'Left school early' });
  }
  if (after.stage === 'college' && before.stage !== 'college') {
    records.push({
      category: 'education',
      label: `Started a degree in ${majorTitle(after.majorId)}`,
      ...(after.majorId !== undefined ? { referenceId: after.majorId } : {}),
    });
  }
  return recordsForDegree(before, after, majorTitle, records);
}

function recordsForDegree(
  before: EducationState,
  after: EducationState,
  majorTitle: (majorId: string | undefined) => string,
  records: NewLifeRecord[],
): NewLifeRecord[] {
  const had = before.credentials ?? {};
  const has = after.credentials ?? {};
  if (has.university !== undefined && had.university === undefined) {
    records.push({
      category: 'education',
      label: `Graduated — ${majorTitle(before.majorId ?? after.majorId)}`,
      ...(before.majorId !== undefined ? { referenceId: before.majorId } : {}),
    });
  }
  if (has.postgraduate !== undefined && had.postgraduate === undefined) {
    records.push({
      category: 'education',
      label: `Postgraduate degree — ${majorTitle(before.majorId ?? after.majorId)}`,
    });
  }
  return records;
}

/**
 * Run the school year and fold it into the character.
 *
 * What the year costs is REPORTED, not charged: activity fees are borne by the
 * household, not by a fifteen-year-old's pocket money, and whether the family
 * can afford them is already decided by the wealth gate on joining. Charging the
 * player and flooring at zero produced a feed line saying $216 had been paid
 * beside a balance of $0 — a sentence the game could not back up. The real
 * ledger entry arrives with Ticket 0301.
 */
export function runEducation(state: GameState, age: number): EducationPhaseOutput {
  const result = runSchoolYear(state.education, {
    age,
    stats: state.player.stats,
    talents: state.player.talents,
    personality: state.player.personality,
    wealth: state.family.finances.band,
    // Ticket 0210. One draw a year, for the only thing in the school model that
    // is not deterministic: whether a character who has stopped caring actually
    // stops going. The package stays pure — it is handed a number, it does not
    // make one.
    roll: state.rng.stream(RngDomains.Education).next(),
    // Ticket 0210b. Tuition is the first thing in the school model that can
    // price a character out, so it is the first that needs to know what they
    // hold.
    cash: Math.floor(Number(state.player.cash) / 100),
    // Ticket 0209's parent who said yes to college, honouring it every year.
    collegeSupport:
      state.education.stage === 'postgrad' ? 0 : (state.parenting.collegeSupport ?? 0),
  });

  /*
    Ticket 0301. A phase REPORTS money; it does not move it.

    This used to do its own `add` and `subtract` against `state.player.cash`,
    which made it one of six places that could change the balance. It now hands
    `advanceYear` a list of transactions and lets the one committing function
    post them — which is also what makes the ORDER of a year's postings
    deterministic, and what lets the zero floor see the whole year rather than
    whichever writer happened to run first.

    An odd job is deliberately not `salary`: a fourteen-year-old with a paper
    round does not have one, and it is the only money most childhoods ever see.
  */
  const transactions: NewTransaction[] = [];
  for (const earned of result.earned) {
    transactions.push({
      category: 'oddJob',
      amount: dollars(earned.dollars),
      source: earned.source,
    });
  }
  const tuition = result.tuition ?? 0;
  if (tuition > 0) {
    transactions.push({
      category: 'tuition',
      amount: dollars(-tuition),
      source: 'Tuition',
    });
  }

  const player: Character = {
    ...state.player,
    stats: nudgeStats(state.player.stats, result.statDeltas),
    // Ticket 0205 turns hidden load into visible stress. 0204 only reports it.
    stress: { ...state.player.stress, hiddenLoad: result.hiddenLoad },
    // School's own answer. `advanceYear` overwrites this once the employment
    // phase has run, because the job the character finishes the year in is the
    // one the header should name.
    occupation: occupationFor(result.state, age),
  };

  return {
    player,
    education: result.state,
    hours: result.hours,
    capacity: result.capacity,
    lines: result.lines.map((line) => ({ kind: line.kind as TimelineKind, text: line.text })),
    transactions,
    shiftGross: result.earned
      .filter((row) => row.kind === 'partTime')
      .reduce((n, row) => n + row.dollars, 0),
    freelanceGross: result.earned
      .filter((row) => row.kind === 'oddJob')
      .reduce((n, row) => n + row.dollars, 0),
    records: schoolRecords(
      state.education,
      result.state,
      (majorId) => MAJORS.find((major) => major.id === majorId)?.name ?? 'a subject',
    ),
  };
}

/**
 * The stored copy of the status label, for the save-list summary.
 *
 * The UI does NOT read this — it calls `statusLabel` at render time, because a
 * stored label goes stale the moment a save is migrated or resumed and two
 * screens then disagree about the same child. Kept written here so the save
 * list can show "8th Grader" without loading and migrating the whole document.
 */
export function occupationFor(education: EducationState, age: number, jobTitle?: string): string {
  // Ticket 0210. A job outranks a school record: somebody who left at eighteen
  // and has been a line cook for six years is a line cook, not a "High School
  // Graduate", and calling them the second is the header quietly still
  // describing the last thing that happened before the game had employment.
  if (jobTitle !== undefined && !isInSchool(education)) return jobTitle;
  return statusLabel(education, age);
}
