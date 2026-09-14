/**
 * Ticket 0308d — headlines, as content.
 *
 * Authored by `scripts/generate-headlines.py`. Logic depends on the stable ids
 * and on `slot`/`when`, never on the text (CORE_RULES 13).
 *
 * A headline is keyed to a CONDITION rather than being evergreen, which is the
 * whole design. The reference app's page carries "Bonds To Remain A Safe Haven
 * For Investors" — a sentence that is true in every possible year, and
 * therefore information in none of them. Everything here only prints in a year
 * where its condition actually held.
 */

import headlinesData from '../data/headlines.json';

/** Which of the year's four questions a line answers. */
export type HeadlineSlot = 'lead' | 'sector' | 'mover' | 'tier';

/** Colours the rule above the story, and nothing else. */
export type HeadlineTone = 'good' | 'bad' | 'flat';

export interface Headline {
  readonly id: string;
  readonly slot: HeadlineSlot;
  /**
   * The condition under which this line is true. A market state for `lead`,
   * `up`/`down` for `sector` and `mover`, and `<tier>.<direction>` for `tier`.
   */
  readonly when: string;
  readonly tone: HeadlineTone;
  /** May contain `{sector}`, `{firm}` and `{pct}`, per slot. */
  readonly text: string;
}

interface HeadlineCatalogFile {
  readonly version: number;
  readonly entries: readonly Headline[];
  readonly mastheads: readonly string[];
}

const catalog = headlinesData as unknown as HeadlineCatalogFile;

export const HEADLINES: readonly Headline[] = catalog.entries;

/** Paper names, each carrying a `{city}`. */
export const MASTHEADS: readonly string[] = catalog.mastheads;

/** Every line whose condition matches, in catalog order. */
export const headlinesFor = (slot: HeadlineSlot, when: string): readonly Headline[] =>
  HEADLINES.filter((row) => row.slot === slot && row.when === when);
