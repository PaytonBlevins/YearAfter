/**
 * Ticket 0308d — the financial pages, assembled.
 *
 * The reference app's Headlines popup is the best thing on its investment
 * screen and the piece this build had no answer to: a market is something that
 * HAPPENS TO YOU, and a column of prices never says that. A front page does.
 *
 * THE ONE THING THIS DOES DIFFERENTLY IS THE ONLY THING THAT MATTERS. Its page
 * carries lines like "Bonds To Remain A Safe Haven For Investors" — true in
 * every possible year, and therefore information in none of them. Every story
 * here is DERIVED from what the price book actually did in the year just
 * finished: the sector that moved most, the single biggest name, the tier that
 * had a year worth reporting. If the year was quiet, the page says so rather
 * than manufacturing drama, because a page that is dramatic every year teaches
 * the player to stop reading it.
 *
 * A STORY ONLY RUNS IF IT CLEARS A BAR. The thresholds below are what separate
 * "the market moved" from "something happened", and they are the whole
 * difference between a newspaper and a status readout.
 *
 * PICKED BY YEAR, NEVER BY ROLL. Two reasons, and the second is the harder one:
 * a page assembled from a generator would change under the player while they
 * read it, every re-render; and a life has to replay identically from its seed,
 * so a screen that consumed randomness would make two identical lives diverge
 * on how often somebody opened a menu. CORE_RULES 13.30 made that rule for a
 * button; it is the same rule here.
 */

import {
  HEADLINES,
  MASTHEADS,
  SECTOR_LABELS,
  SECTORS,
  INSTRUMENTS,
  KIND_LABELS,
  findInstrument,
  type Headline,
  type HeadlineSlot,
  type HeadlineTone,
  type Instrument,
  type InstrumentKind,
} from '@yearafter/content';
import { priceOf, yearChange, type PriceBook } from './market';
import type { Holding } from './portfolio';
import { MARKET_LABELS, type MarketState } from './investments';

/* -------------------------------------------------------------------------- */
/* What counts as news                                                         */
/* -------------------------------------------------------------------------- */

/**
 * How far a sector has to move before it is a story.
 *
 * Measured: a sector's average year has a standard deviation of about 13%, so
 * 9% is roughly a two-in-five year. Lower and the sector line runs every year
 * and stops meaning anything; higher and a player can go a decade without one.
 */
const SECTOR_NEWS = 0.09;

/** A single name has to move this far. Individual stocks are much wilder. */
const MOVER_NEWS = 0.3;

/** And a whole tier this far, since averaging across a tier damps it hard. */
const TIER_NEWS = 0.07;

/**
 * A name the PLAYER holds gets in on a smaller move than a stranger does.
 *
 * This is the one piece of favouritism in the file and it is deliberate: the
 * player's own position moving 22% is a bigger event in their life than an
 * unheld name moving 40%, and a newspaper that never mentions what you own is
 * the same defect as a market list that never shows your holding.
 */
const HELD_NEWS = 0.2;

/* -------------------------------------------------------------------------- */

export interface Story {
  readonly id: string;
  readonly text: string;
  readonly tone: HeadlineTone;
}

export interface Briefing {
  /** "The Denver Ledger", with the character's own city in it. */
  readonly masthead: string;
  readonly year: number;
  /** What kind of year it was, in words. Sits under the masthead. */
  readonly dateline: string;
  /** Two to four stories, lead first. Never empty. */
  readonly stories: readonly Story[];
  /**
   * One plain line about the reader's own money, below the fold. Absent when
   * they hold nothing — a page that lectures somebody with no position is the
   * "not built yet" row with better manners.
   */
  readonly yours?: string;
}

/**
 * A small stable hash, so the same year always prints the same page and two
 * adjacent years with the same condition do not print adjacent lines.
 */
function pick<T>(lines: readonly T[], year: number, salt: number): T | undefined {
  if (lines.length === 0) return undefined;
  const mixed = Math.abs(Math.imul(year * 2654435761 + salt, 0x85ebca6b) >>> 3);
  return lines[mixed % lines.length];
}

const storyFrom = (
  line: Headline | undefined,
  bind: Readonly<Record<string, string>> = {},
): Story | undefined => {
  if (!line) return undefined;
  const text = line.text.replace(/\{([a-zA-Z]+)\}/g, (whole, key: string) => bind[key] ?? whole);
  return { id: line.id, text, tone: line.tone };
};

const linesFor = (slot: HeadlineSlot, when: string): readonly Headline[] =>
  HEADLINES.filter((row) => row.slot === slot && row.when === when);

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const signed = (fraction: number): string => `${Math.round(Math.abs(fraction) * 100)}%`;

/* -------------------------------------------------------------------------- */

export interface BriefingInput {
  readonly prices: PriceBook;
  readonly market: MarketState;
  readonly year: number;
  /** The character's city, for the masthead. */
  readonly city: string;
  readonly holdings: readonly Holding[];
}

export function briefingFor(input: BriefingInput): Briefing {
  const { prices, market, year, city, holdings } = input;

  const masthead = (pick(MASTHEADS, year, 11) ?? 'The {city} Journal').replace('{city}', city);

  const stories: Story[] = [];

  // LEAD — always runs. Every market state has a front page.
  const lead = storyFrom(pick(linesFor('lead', market), year, 1));
  if (lead) stories.push(lead);

  /*
    SECTOR — whichever moved furthest from flat, up or down, if it cleared the
    bar. Averaged over the sector's own names rather than read from a stored
    shock, so the line reports what a HOLDER experienced rather than what the
    engine rolled: those differ, because an instrument's own luck is most of its
    year.
  */
  const sectorMoves = SECTORS.map((sector) => ({
    sector,
    move: mean(
      INSTRUMENTS.filter((row) => row.sector === sector).map((row) => yearChange(prices, row.id)),
    ),
  })).sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
  const biggestSector = sectorMoves[0];
  if (biggestSector && Math.abs(biggestSector.move) >= SECTOR_NEWS) {
    const story = storyFrom(
      pick(linesFor('sector', biggestSector.move > 0 ? 'up' : 'down'), year, 2),
      { sector: SECTOR_LABELS[biggestSector.sector] },
    );
    if (story) stories.push(story);
  }

  /*
    MOVER — the biggest single name, with the player's own holdings given a
    lower bar. Bonds are excluded outright: a government bond moving 30% would
    be a sovereign default, and this build has no story for that.
  */
  const held = new Set(holdings.map((holding) => holding.instrumentId));
  const candidates = INSTRUMENTS.filter((row) => row.kind !== 'bond')
    .map((row) => ({ row, move: yearChange(prices, row.id) }))
    .filter(({ row, move }) =>
      held.has(row.id) ? Math.abs(move) >= HELD_NEWS : Math.abs(move) >= MOVER_NEWS,
    )
    .sort((a, b) => weight(b, held) - weight(a, held));
  const mover = candidates[0];
  if (mover) {
    const story = storyFrom(pick(linesFor('mover', mover.move > 0 ? 'up' : 'down'), year, 3), {
      firm: mover.row.name,
      pct: signed(mover.move),
    });
    if (story) stories.push(story);
  }

  /*
    TIER — one class of thing having a year. Skipped when the tier that moved
    most is the same story the lead already told: in a crash every tier is down
    and "Shares Lose Ground Almost Everywhere" under "Markets Post Worst Year In
    Living Memory" is one sentence twice (CORE_RULES 13.26).
  */
  const tiers: readonly InstrumentKind[] = ['stock', 'fund', 'bond', 'crypto', 'penny'];
  const tierMoves = tiers
    .map((kind) => ({
      kind,
      move: mean(
        INSTRUMENTS.filter((row) => row.kind === kind).map((row) => yearChange(prices, row.id)),
      ),
    }))
    .sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
  const biggestTier = tierMoves[0];
  const leadIsBroad = market === 'severeRecession' || market === 'strongExpansion';
  if (
    biggestTier &&
    Math.abs(biggestTier.move) >= TIER_NEWS &&
    !(leadIsBroad && (biggestTier.kind === 'stock' || biggestTier.kind === 'fund'))
  ) {
    const story = storyFrom(
      pick(
        linesFor('tier', `${biggestTier.kind}.${biggestTier.move > 0 ? 'up' : 'down'}`),
        year,
        4,
      ),
    );
    if (story) stories.push(story);
  }

  /*
    THE READER'S OWN MONEY. Not a headline — a line under the fold, in the
    paper's voice but about them. It is the answer to the question somebody
    actually opens this page with, and it is the one thing a real newspaper
    cannot print.
  */
  const yours = ownLine(prices, holdings);

  return {
    masthead,
    year,
    dateline: `A look back at ${MARKET_LABELS[market]}`,
    stories,
    ...(yours !== undefined ? { yours } : {}),
  };
}

/** Held names sort first, then by size of move. */
function weight(row: { row: Instrument; move: number }, held: ReadonlySet<string>): number {
  return Math.abs(row.move) + (held.has(row.row.id) ? 10 : 0);
}

function ownLine(prices: PriceBook, holdings: readonly Holding[]): string | undefined {
  if (holdings.length === 0) return undefined;

  let now = 0;
  let before = 0;
  let bestName = '';
  let bestMove = 0;
  for (const holding of holdings) {
    const instrument = findInstrument(holding.instrumentId);
    if (!instrument) continue;
    const price = priceOf(prices, holding.instrumentId);
    const change = yearChange(prices, holding.instrumentId);
    now += holding.units * price;
    before += holding.units * (change > -1 ? price / (1 + change) : price);
    if (Math.abs(change) > Math.abs(bestMove)) {
      bestMove = change;
      bestName = instrument.name;
    }
  }
  if (before <= 0) return undefined;

  const moved = Math.round((now - before) / 100);
  const kinds = new Set(
    holdings.map((holding) => findInstrument(holding.instrumentId)?.kind).filter(Boolean),
  );
  const spread =
    kinds.size >= 3
      ? ' Spread across three kinds of thing, which is why it moves less than the headlines do.'
      : '';

  if (Math.abs(moved) < 1) {
    return `Your own holdings ended the year almost exactly where they started.${spread}`;
  }
  const direction = moved > 0 ? 'up' : 'down';
  const amount = `$${Math.abs(moved).toLocaleString('en-US')}`;
  const blame =
    bestName && Math.abs(bestMove) >= 0.15
      ? ` Most of it was ${bestName}, ${bestMove > 0 ? 'up' : 'down'} ${signed(bestMove)}.`
      : '';
  return `Your own holdings finished the year ${direction} ${amount}.${blame}${spread}`;
}

/**
 * The standing primer — what the five tiers actually are, in the order a player
 * meets them.
 *
 * NOT HEADLINES, and kept beside them on purpose. This build models three
 * things a player cannot possibly discover by tapping: that a sector is a
 * shared fate rather than a heading, that a beaten-down price is pulled back
 * toward its own trend, and that leaving a bond early costs 12%. A game may
 * keep a secret, but it may not charge for one (CORE_RULES 13.15), so the rules
 * that cost money are written down where the money is.
 */
export const PRIMER: readonly { readonly kind: InstrumentKind; readonly body: string }[] = [
  {
    kind: 'fund',
    body: 'One purchase that owns a lot of things at once. The dullest thing on the page and, over thirty years, the hardest to beat.',
  },
  {
    kind: 'stock',
    body: 'A share of one company. Names in the same sector move together here, so six technology names are closer to one decision than to six.',
  },
  {
    kind: 'bond',
    body: 'Lending money out and getting it back on a date. Steady, and the money is genuinely away until then — leaving early costs 12% of what it is worth.',
  },
  {
    kind: 'crypto',
    body: 'No earnings, no dividend, no floor. Also the only tier with no pull back toward a fair price, because there is nothing to pull it toward.',
  },
  {
    kind: 'penny',
    body: 'Small local companies at a few dollars each. Most of them fail, and this is the one tier where a price can genuinely reach nothing.',
  },
];

export const PRIMER_LABELS = KIND_LABELS;
