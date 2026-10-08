/**
 * Ticket 0506 — the renovation and valuables catalogs.
 */

import { describe, expect, it } from 'vitest';
import {
  RENOVATIONS,
  VALUABLES,
  VALUABLE_STORES,
  findRenovation,
  findValuable,
  shelfOf,
} from './index';

/** Real marques a fictional analogue must never ship as. */
const REAL = [
  'Jacob & Co',
  'Rolex',
  'Omega',
  'Patek',
  'Cartier',
  'Tiffany',
  'Van Cleef',
  'Audemars',
  'Casio',
  'Seiko',
  'TAG Heuer',
  'Tag Heuer',
  'Breitling',
  'Tudor',
  'IWC',
  'Panerai',
  'Zenith',
  'Blancpain',
  'Vacheron',
  'A. Lange',
  'Richard Mille',
  'Apple',
  'Fossil',
  'Timex',
  'Tissot',
  'Hamilton',
  'Longines',
  'Oris',
  'Jaeger',
  'Warhol',
  'Picasso',
  'Monet',
  'Malevich',
];

describe('0506 — renovations', () => {
  it('is spec 153–154 and 1875’s list, and nothing else', () => {
    const names = new Set(RENOVATIONS.map((renovation) => renovation.name));
    for (const name of [
      'Modern Kitchen',
      'Luxury Kitchen',
      'Modern Bathroom',
      'Luxury Bathroom',
      'Pool',
      'Additional Bedroom',
      'Second Additional Bedroom',
      'Luxury Finishes',
      'Spa',
      'Infinity Pool',
      'Wine Cellar',
      'Maze',
      'Observatory',
      'Security System',
      'Home Theater',
      'Tennis Court',
      'Basketball Court',
      'Home Gym',
      'Bowling Alley',
    ]) {
      expect(names.has(name), name).toBe(true);
    }
    // Spec 153: no flooring, exterior or landscaping.
    for (const renovation of RENOVATIONS) {
      expect(
        /floor(ing)?\b|siding|roof|landscap|lawn|patio|fence/i.test(renovation.name),
        renovation.name,
      ).toBe(false);
    }
  });

  it('never returns more than it costs, and puts the grand things only in grand homes', () => {
    for (const renovation of RENOVATIONS) expect(renovation.recovery).toBeLessThan(1);
    expect(findRenovation('reno.maze')?.kinds).toEqual(['home.estate']);
    expect(findRenovation('reno.pool')?.kinds).not.toContain('home.condo');
    expect(findRenovation('reno.kitchen-modern')?.kinds).toContain('home.condo');
    expect(findRenovation('reno.bedroom-2')?.needs).toBe('reno.bedroom-1');
  });
});

describe('0506 — jewelry, watches and collections', () => {
  it('holds what spec 1891 and 1893 list, at a size that fits spec 1740', () => {
    const kinds = new Set(VALUABLES.map((item) => item.kind));
    for (const kind of [
      'watch',
      'ring',
      'necklace',
      'chain',
      'bracelet',
      'earrings',
      'art',
      'antique',
      'historical',
      'curio',
      'mythical',
    ]) {
      expect(kinds.has(kind as never), kind).toBe(true);
    }
    expect(VALUABLES.length).toBeGreaterThanOrEqual(150);
    // Spec 1892: a diamond is a size and a broad quality.
    const diamonds = VALUABLES.filter((item) => /solitaire/i.test(item.name));
    for (const diamond of diamonds) expect(diamond.name).toMatch(/carat/);
  });

  it('includes spec 197’s three legends, and keeps them mythical', () => {
    for (const name of ["Poseidon's Trident", "Pandora's Box", 'Diamond Pickaxe']) {
      const legend = VALUABLES.find((item) => item.name === name);
      expect(legend?.kind, name).toBe('mythical');
      expect(legend?.rarity).toBe('mythical');
    }
  });

  it('uses no real brand or artist name', () => {
    for (const item of VALUABLES) {
      for (const real of REAL) {
        expect(
          new RegExp(`\\b${real}\\b`).test(`${item.name} ${item.brand} ${item.blurb}`),
          `${real} in ${item.id}`,
        ).toBe(false);
      }
    }
  });

  it('stocks every store, and shelves every piece', () => {
    for (const store of VALUABLE_STORES) {
      expect(
        VALUABLES.some((item) => item.stores.includes(store.id)),
        store.id,
      ).toBe(true);
    }
    for (const item of VALUABLES) {
      expect(shelfOf(item.kind)).toBeDefined();
      expect(findValuable(item.id)).toBe(item);
    }
  });
});

describe('0507 — the auction venues', () => {
  it('has spec 41’s venues and the words for storage units', async () => {
    const { AUCTION_VENUES, STORAGE_PEEKS, STORAGE_JUNK } = await import('./auctions');
    expect(AUCTION_VENUES.filter((venue) => venue.type === 'general')).toHaveLength(2);
    expect(AUCTION_VENUES.some((venue) => venue.type === 'storage')).toBe(true);
    expect(AUCTION_VENUES.some((venue) => venue.type === 'private')).toBe(true);
    for (const size of ['small', 'medium', 'large'] as const)
      expect(STORAGE_PEEKS[size].length).toBeGreaterThan(2);
    expect(STORAGE_JUNK.length).toBeGreaterThan(10);
  });
});
