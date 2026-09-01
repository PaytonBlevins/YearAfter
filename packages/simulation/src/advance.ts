/**
 * Ticket 0105 — Advance.
 *
 * PROTECTED CONTRACT (spec 1060–1066): time advancement.
 *
 * One player-facing turn is one year (spec 1108–1140). The loop is
 * calculate → validate → commit, in memory, atomically: nothing is written into
 * the returned state until the whole year has been computed, so a thrown error
 * leaves the previous state untouched rather than half-aged.
 *
 * SCOPE — the systems that hang off this loop arrive on their own tickets, and
 * each one plugs in as a phase module under `phases/`:
 *   0203  childhood event library         -> DONE, phases/events.ts
 *   0204  school progression              -> DONE, phases/education.ts
 *   0205  stress from hidden capacity     -> DONE, phases/stress.ts
 *   0211  aging, health, mortality        -> health phase
 *   0301  financial ledger, monthly pass  -> finance phase
 * Do not grow this file with inline system logic — add a phase module.
 */

import { createTimelineEntry, type Character, type TimelineEntry } from '@yearafter/character';
import { asEventId, clampStat } from '@yearafter/core';
import type { GameState } from './game-state';
import { isInSchool } from '@yearafter/education';
import { runEducation } from './phases/education';
import { runEvents } from './phases/events';
import { runStress } from './phases/stress';

export interface AdvanceResult {
  readonly state: GameState;
  /** Entries produced by this year only — what the Life screen animates in. */
  readonly newEntries: readonly TimelineEntry[];
}

/**
 * Advance the simulation by one year.
 *
 * Pure with respect to `state`: the input is never mutated. The RNG registry is
 * shared by reference and does advance, which is intended — a turn consumes
 * randomness, and the save records the resulting stream state.
 */
export function advanceYear(state: GameState): AdvanceResult {
  if (!state.player.alive) {
    return { state, newEntries: [] };
  }
  // A pending question blocks time. Advancing past an unanswered decision would
  // either discard it or answer it on the player's behalf, and both are worse
  // than refusing. The UI keeps the Advance control disabled while this holds.
  if (state.pending.length > 0) {
    return { state, newEntries: [] };
  }

  // ---- calculate ---------------------------------------------------------
  const nextAge = state.player.age + 1;
  const nextYear = state.world.year + 1;

  // Education first: an event that fires this year should be able to read the
  // grade the character is now in, and a report-card event that arrives before
  // the report card is nonsense.
  const education = runEducation(state, nextAge);
  const events = runEvents(
    { ...state, player: education.player, education: education.education },
    nextAge,
    nextYear,
  );

  // Stress last: it summarises the year rather than making things happen in it,
  // so it needs the workload education computed, the household events finished
  // moving, and the stress those events contributed.
  const stress = runStress({
    player: events.player,
    family: events.family,
    education: { ...education.education, behaviour: clampStat(events.behaviour) },
    hours: education.hours,
    capacity: education.capacity,
    eventStress: events.stress,
    atSchool: isInSchool(education.education),
  });

  const entries: TimelineEntry[] = [
    ...education.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        id: `t:${nextYear}:school:${index}`,
        sequence: index,
      }),
    ),
    ...events.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        eventId: asEventId(line.eventId),
        sequence: education.lines.length + index,
      }),
    ),
    // Last in the year, because it is the line about the year as a whole.
    ...stress.lines.map((line, index) =>
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind: line.kind,
        text: line.text,
        id: `t:${nextYear}:stress:${index}`,
        sequence: education.lines.length + events.lines.length + index,
      }),
    ),
  ];

  // ---- validate ----------------------------------------------------------
  if (nextAge !== state.player.age + 1) {
    throw new Error('advanceYear: age advanced by an amount other than one year');
  }
  if (entries.length === 0 && events.decisions.length === 0) {
    // The catalog guarantees passive events are available to every character at
    // every childhood age (scripts/generate-events.py enforces it). An empty
    // year means that guarantee has been broken, and a silent blank year in the
    // feed reads to the player as a broken button.
    throw new Error(`advanceYear: no events were available at age ${nextAge}`);
  }

  // ---- commit ------------------------------------------------------------
  const player: Character = {
    ...stress.player,
    age: nextAge,
    // Set by the education phase; employment (Ticket 0210) takes it over for
    // characters who have left school.
    occupation: education.player.occupation,
    timeline: [...state.player.timeline, ...entries],
  };

  return {
    state: {
      ...state,
      world: { ...state.world, year: nextYear },
      player,
      family: events.family,
      events: events.history,
      // Events can move school standing (detention, suspension, being caught);
      // the education phase set the rest of it.
      education: {
        ...education.education,
        behaviour: clampStat(events.behaviour),
        // Stress takes its cut of school last, after everything else has had
        // its say about the year.
        performance: clampStat(stress.performance),
      },
      pending: events.decisions,
    },
    newEntries: entries,
  };
}
