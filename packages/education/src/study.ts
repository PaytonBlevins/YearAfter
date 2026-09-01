/**
 * Ticket 0205 — Study Harder as a button.
 *
 * Review: "I want there to just be a button that says study harder and it
 * potentially (most of the time) boosts their grades."
 *
 * The three-way Effort cycle it replaces was a SETTING — a state the player
 * configured once and then forgot, which is exactly the management spec 75
 * forbids in a school system meant to be lightweight. A button is a decision you
 * make each year and see the result of, which is what spec 1821 means by "major
 * + Study Harder is generally enough".
 *
 * Two things happen when it is pressed:
 *
 *  1. This year's grades move, most of the time. Not always: a term of real
 *     effort that does not show up on the report card is a thing that happens to
 *     children, and a button that always works is a button, not a choice.
 *  2. The character becomes somebody who studies. Effort is set to `hard` and
 *     stays there, which raises the target their grades drift towards for the
 *     rest of school. So pressing it once helps; pressing it every year compounds.
 *
 * It also costs hours, which run against the hidden workload capacity and now
 * feed stress. Studying hard while carrying four activities is a way to have a
 * bad year, and nothing warns the player — they read about it afterwards.
 */

import { clampStat, type StatValue } from '@yearafter/core';

/** How often a term of real effort actually shows on the report card. */
export const STUDY_SUCCESS_CHANCE = 0.76;

/** Performance points a successful term is worth, before the growth curve. */
export const STUDY_GAIN_MIN = 6;
export const STUDY_GAIN_MAX = 13;

/**
 * What a term that did not land is worth.
 *
 * Not zero. The work was still done, and a result of exactly nothing reads as
 * the button being broken rather than as a hard year.
 */
export const STUDY_CONSOLATION = 1;

export interface StudyResult {
  readonly performance: StatValue;
  readonly gained: number;
  readonly worked: boolean;
  readonly text: string;
}

const WORKED_LINES = [
  'Put the hours in this term, and the report card showed it.',
  'Studied properly for once. It turned out to be the difference.',
  'Worked at it all year. The grades moved, and somebody noticed.',
];

const DID_NOT_LINES = [
  'Studied hard all term and the grades barely moved. Some years are like that.',
  'Put the work in. The report card came back looking much the same.',
  'Revised for weeks and it did not show up where it was supposed to.',
];

/**
 * Resolve one press of Study Harder.
 *
 * Pure: the caller supplies the draws, so this can be run ten thousand times by
 * the balance tooling and replays identically from a seed in the game.
 *
 * @param roll        0–1, decides whether the term landed.
 * @param magnitude   0–1, how much it was worth when it did.
 * @param variant     0–1, which way the line is phrased.
 */
export function studyHarder(
  performance: number,
  roll: number,
  magnitude: number,
  variant: number,
): StudyResult {
  const worked = roll < STUDY_SUCCESS_CHANCE;
  const raw = worked
    ? STUDY_GAIN_MIN + magnitude * (STUDY_GAIN_MAX - STUDY_GAIN_MIN)
    : STUDY_CONSOLATION;
  // Deliberately NOT run through nudgeStats: performance is not a visible stat,
  // and a character already at the top of their class should still be able to
  // hold that position by working. Clamping is enough.
  const next = clampStat(Math.round(performance + raw));
  const lines = worked ? WORKED_LINES : DID_NOT_LINES;
  const index = Math.min(lines.length - 1, Math.floor(variant * lines.length));
  return {
    performance: next,
    gained: next - performance,
    worked,
    text: lines[index] as string,
  };
}
