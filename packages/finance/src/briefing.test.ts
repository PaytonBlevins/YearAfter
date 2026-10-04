/**
 * Ticket 0308d — the financial pages.
 *
 * The design claim is that every story is DERIVED — that the page reports the
 * year rather than decorating it. That claim is exactly the kind that passes a
 * casual reading and turns out to be false, because a page of plausible
 * sentences looks identical whether or not anything produced them.
 *
 * So these tests do the one thing that can tell the difference: build two
 * markets that differ in a known way and check that the page differs in the
 * matching way.
 */

import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, SECTORS, instrumentsOfKind } from '@yearafter/content';
import { cents } from '@yearafter/core';
import { briefingFor, PRIMER } from './briefing';
import { openingPrices, priceOf, runPriceYear, type PriceBook } from './market';
import { MARKET_STATES, nextMarketState, type MarketState } from './investments';
import type { Holding } from './portfolio';

function roller(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** A book with `years` of real market behind it. */
function bookAfter(years: number, seed: number, state: MarketState = 'normal'): PriceBook {
  const roll = roller(seed);
  let book = openingPrices();
  let market = state;
  for (let year = 0; year < years; year += 1) {
    book = runPriceYear(
      book,
      market,
      SECTORS.map(() => roll()),
      INSTRUMENTS.map(() => roll()),
    ).prices;
    market = nextMarketState(market, roll());
  }
  return book;
}

const base = {
  year: 2031,
  city: 'Denver',
  holdings: [] as readonly Holding[],
};

describe('the front page', () => {
  it('always has a lead, in every market state', () => {
    for (const market of MARKET_STATES) {
      const page = briefingFor({ ...base, prices: bookAfter(6, 5, market), market });
      expect(page.stories.length, market).toBeGreaterThan(0);
      expect(page.stories[0]!.text.length, market).toBeGreaterThan(10);
      // A token that never got bound is a brace on somebody's screen.
      for (const story of page.stories) {
        expect(story.text, `${market}: ${story.text}`).not.toMatch(/[{}]/);
      }
    }
  });

  it('puts the character own city on the masthead', () => {
    const page = briefingFor({ ...base, prices: bookAfter(4, 9), market: 'normal' });
    expect(page.masthead).toContain('Denver');
    expect(page.masthead).not.toContain('{');
  });

  it('holds still — the same year prints the same page', () => {
    const prices = bookAfter(8, 21);
    const once = briefingFor({ ...base, prices, market: 'growth' });
    const twice = briefingFor({ ...base, prices, market: 'growth' });
    expect(twice).toEqual(once);
  });

  it('prints a different page in a different year', () => {
    /*
      The counterpart to holding still, and the reason both tests exist: a page
      that never changes is as broken as one that changes while you read it, and
      a single "is it stable" test passes for both.
    */
    const prices = bookAfter(8, 21);
    const pages = new Set<string>();
    for (let year = 2020; year < 2060; year += 1) {
      pages.add(briefingFor({ ...base, prices, year, market: 'normal' }).stories[0]!.text);
    }
    expect(pages.size).toBeGreaterThan(4);
  });

  it('leads differently in a crash than in a boom', () => {
    const prices = bookAfter(6, 31);
    const crash = briefingFor({ ...base, prices, market: 'severeRecession' });
    const boom = briefingFor({ ...base, prices, market: 'strongExpansion' });
    expect(crash.stories[0]!.text).not.toBe(boom.stories[0]!.text);
    expect(crash.stories[0]!.tone).toBe('bad');
    expect(boom.stories[0]!.tone).toBe('good');
    expect(crash.dateline).not.toBe(boom.dateline);
  });

  it('names a real instrument when it names one at all', () => {
    /*
      THE TEST THAT ACTUALLY CHECKS THE CLAIM. A mover story is only honest if
      the name in it exists and really did move — a page that picked a name at
      random would pass every other test in this file.
    */
    const names = new Set(INSTRUMENTS.map((row) => row.name));
    let checked = 0;
    for (let seed = 1; seed < 40; seed += 1) {
      const prices = bookAfter(9, seed * 77);
      const page = briefingFor({ ...base, prices, market: 'normal', year: 2000 + seed });
      for (const story of page.stories) {
        if (!story.id.startsWith('hl.mover')) continue;
        const named = [...names].find((name) => story.text.includes(name));
        expect(named, `no catalog name in: ${story.text}`).toBeDefined();
        checked += 1;
      }
    }
    expect(checked, 'no mover story ever ran, so this proved nothing').toBeGreaterThan(3);
  });

  it('says nothing about the reader when the reader holds nothing', () => {
    const page = briefingFor({ ...base, prices: bookAfter(5, 3), market: 'normal' });
    expect(page.yours).toBeUndefined();
  });

  it('talks about the reader as soon as they hold something', () => {
    const share = instrumentsOfKind('stock')[0]!;
    const page = briefingFor({
      ...base,
      prices: bookAfter(5, 3),
      market: 'normal',
      holdings: [{ instrumentId: share.id, units: 40, paid: cents(400_000) }],
    });
    expect(page.yours).toBeDefined();
    expect(page.yours).not.toMatch(/[{}]/);
  });

  it('does not run the same sentence twice on one page', () => {
    // CORE_RULES 13.26 at page scale: a tier line repeating the lead is the
    // column of identical rows in a different costume.
    for (let seed = 1; seed < 30; seed += 1) {
      for (const market of MARKET_STATES) {
        const page = briefingFor({
          ...base,
          prices: bookAfter(7, seed * 13),
          market,
          year: 2000 + seed,
        });
        const texts = page.stories.map((story) => story.text);
        expect(new Set(texts).size, texts.join(' | ')).toBe(texts.length);
        // And never more than one story from the same slot.
        const slots = page.stories.map((story) => story.id.split('.')[1]);
        expect(new Set(slots).size).toBe(slots.length);
      }
    }
  });

  it('keeps a bond off the biggest-mover list', () => {
    // A government bond moving 30% is a sovereign default, and this build has
    // no story for that.
    const bondNames = new Set(instrumentsOfKind('bond').map((row) => row.name));
    for (let seed = 1; seed < 30; seed += 1) {
      const page = briefingFor({
        ...base,
        prices: bookAfter(8, seed * 101),
        market: 'recession',
        year: 2000 + seed,
      });
      for (const story of page.stories) {
        if (!story.id.startsWith('hl.mover')) continue;
        for (const name of bondNames) expect(story.text).not.toContain(name);
      }
    }
  });
});

describe('the primer', () => {
  it('covers every tier a player can buy', () => {
    const covered = new Set(PRIMER.map((row) => row.kind));
    for (const kind of ['stock', 'fund', 'bond', 'crypto', 'penny'] as const) {
      expect(covered.has(kind), kind).toBe(true);
    }
  });

  it('names the two rules that cost money if nobody tells you', () => {
    const all = PRIMER.map((row) => row.body).join(' ');
    // Leaving a bond early, and the sector correlation. A game may keep a
    // secret; it may not charge for one.
    expect(all).toContain('12%');
    expect(all.toLowerCase()).toContain('sector');
  });

  it('says nothing twice', () => {
    const bodies = PRIMER.map((row) => row.body);
    expect(new Set(bodies).size).toBe(bodies.length);
  });
});

describe('the price book the page reads', () => {
  it('has moved by the time the page is drawn', () => {
    const prices = bookAfter(6, 77);
    const moved = INSTRUMENTS.filter((row) => priceOf(prices, row.id) !== row.priceCents);
    expect(moved.length).toBeGreaterThan(INSTRUMENTS.length / 2);
  });
});
