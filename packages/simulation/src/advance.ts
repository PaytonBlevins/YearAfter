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
 *   0204  school progression              -> education phase
 *   0205  stress from hidden capacity     -> stress phase
 *   0211  aging, health, mortality        -> health phase
 *   0301  financial ledger, monthly pass  -> finance phase
 * Do not grow this file with inline system logic — add a phase module.
 */

import {
  createTimelineEntry,
  defaultOccupationFor,
  type Character,
  type TimelineEntry,
} from '@yearafter/character';
import { asEventId } from '@yearafter/core';
import type { GameState } from './game-state';
import { runEvents } from './phases/events';

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

  const events = runEvents(state, nextAge, nextYear);

  const entries: TimelineEntry[] = events.lines.map((line, index) =>
    createTimelineEntry({
      age: nextAge,
      year: nextYear,
      kind: line.kind,
      text: line.text,
      eventId: asEventId(line.eventId),
      sequence: index,
    }),
  );

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
    ...events.player,
    age: nextAge,
    // Placeholder until education (0204) and employment (0210) own this field.
    occupation: defaultOccupationFor(nextAge),
    timeline: [...state.player.timeline, ...entries],
  };

  return {
    state: {
      ...state,
      world: { ...state.world, year: nextYear },
      player,
      family: events.family,
      events: events.history,
      pending: events.decisions,
    },
    newEntries: entries,
  };
}
