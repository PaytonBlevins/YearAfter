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
 * SCOPE — this is the v0.01 shell implementation. It advances age, the world
 * year, and appends timeline text from a small placeholder pool. The systems
 * that will hang off this loop arrive on their own tickets and each one plugs in
 * as a phase below:
 *   0203  childhood event library         -> event phase
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
  type TimelineKind,
} from '@yearafter/character';
import type { GameState } from './game-state';
import { RngDomains } from './rng/rng';

export interface AdvanceResult {
  readonly state: GameState;
  /** Entries produced by this year only — what the Life screen animates in. */
  readonly newEntries: readonly TimelineEntry[];
}

/**
 * v0.01 placeholder feed text. Ticket 0203 replaces this with the approved
 * childhood event library (75–150 events across family, school, friendship,
 * humour and talent contexts) loaded from @yearafter/content.
 */
const PLACEHOLDER_LINES: Readonly<
  Record<'infant' | 'child' | 'teen' | 'adult', readonly string[]>
> = {
  infant: [
    'Slept through most of the year. It was a good year.',
    'Learned that dropping things makes adults pick them up.',
    'Said a word. Nobody agrees on which word.',
  ],
  child: [
    'Spent the summer building something ambitious out of cardboard.',
    'Traded lunches at school. Came out ahead.',
    'Got very serious about a cartoon for several months.',
    'Fell off a bike. Got back on the bike.',
  ],
  teen: [
    'Argued with a teacher and was technically correct.',
    'Stayed up too late all year and felt fine about it.',
    'Started caring what people thought. Unclear whether this was progress.',
  ],
  adult: [
    'Another year went by without much fanfare.',
    'Kept mostly to a routine this year.',
    'Nothing remarkable happened, which was its own kind of relief.',
  ],
};

function placeholderBucket(age: number): keyof typeof PLACEHOLDER_LINES {
  if (age <= 2) return 'infant';
  if (age <= 12) return 'child';
  if (age <= 17) return 'teen';
  return 'adult';
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

  // ---- calculate ---------------------------------------------------------
  const nextAge = state.player.age + 1;
  const nextYear = state.world.year + 1;
  const entries: TimelineEntry[] = [];

  const push = (kind: TimelineKind, text: string): void => {
    entries.push(
      createTimelineEntry({
        age: nextAge,
        year: nextYear,
        kind,
        text,
        sequence: entries.length,
      }),
    );
  };

  const stream = state.rng.stream(RngDomains.Events);
  push('passive', stream.pick(PLACEHOLDER_LINES[placeholderBucket(nextAge)]));

  // Phase modules for events, education, stress, health and finance attach here.

  // ---- validate ----------------------------------------------------------
  if (nextAge !== state.player.age + 1) {
    throw new Error('advanceYear: age advanced by an amount other than one year');
  }

  // ---- commit ------------------------------------------------------------
  const player: Character = {
    ...state.player,
    age: nextAge,
    // Placeholder until education (0204) and employment (0210) own this field.
    occupation: defaultOccupationFor(nextAge),
    timeline: [...state.player.timeline, ...entries],
  };

  return {
    state: {
      world: { ...state.world, year: nextYear },
      player,
      // Family is carried through untouched. NPCs ageing, moving, falling ill
      // and dying is spec 674-683 and attaches here as its own phase later.
      family: state.family,
      rng: state.rng,
    },
    newEntries: entries,
  };
}
