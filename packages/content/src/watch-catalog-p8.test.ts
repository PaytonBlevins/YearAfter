import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VALUABLES, VALUABLE_STORES, findValuable, shelfOf } from './index';

const digest = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
// These are frozen hashes of the 151 pre-P8 entries and five stores, not hashes
// derived from the current generator: repricing or silently changing old saves fails.
const LEGACY_ENTRIES = '8a331fc3d5e41ec35e3166b82fefd067fa2311b4819b1934fe31f22014d1bc3d';
const LEGACY_STORES = 'de5e2a6aabc2242aac87ebcacc1ee424392d015bf7631685901bafcd94e41b39';
const IDS = [
  'rolux-yacht-voyager',
  'rolux-perpetual',
  'rolux-explorer',
  'seyko-alpinist',
  'tissoe-gentleperson',
  'hamiltone-ventura',
  'grand-seyko-birch',
  'tudar-pelagos',
  'longinez-legend-diver',
  'orys-pointer-date',
  'omegon-aquaterra',
  'cartrier-ballon',
  'breitlong-superocean',
  'ap-royal-ash-offshore',
  'patrek-aquanote',
  'vacheran-patrimony',
  'langer-saxonia',
  'jakob-timeless-treasure',
].map((id) => `val.watch.${id}`);

// The approved authoring manifest fixes gameplay prices and resale categories.
const PRICES = [
  12300, 6500, 7500, 725, 825, 995, 9100, 5100, 3200, 2200, 6800, 6200, 4900, 39000, 25000, 25000,
  23000, 20000000,
];
const SOUGHT = new Set([
  'val.watch.rolux-perpetual',
  'val.watch.rolux-explorer',
  'val.watch.patrek-aquanote',
]);

describe('P8 — real model equivalents in a bounded fictional catalog', () => {
  it('preserves every existing entry, its order and every store byte-equivalent in meaning', () => {
    expect(digest(VALUABLES.slice(0, 151).map(({ icing: _icing, ...original }) => original))).toBe(
      LEGACY_ENTRIES,
    );
    expect(digest(VALUABLE_STORES)).toBe(LEGACY_STORES);
  });
  it('adds exactly 18 distinct watches and one maker, with no other catalog growth', () => {
    expect(VALUABLES).toHaveLength(169);
    expect(VALUABLES.filter((v) => v.kind === 'watch')).toHaveLength(55);
    expect(new Set(VALUABLES.map((v) => v.id)).size).toBe(169);
    expect(VALUABLES.slice(151).map((v) => v.id)).toEqual(IDS);
    expect(new Set(VALUABLES.filter((v) => v.kind === 'watch').map((v) => v.brand)).size).toBe(27);
  });
  it('fixes the approved price mix and keeps only three scarce sports additions above retail', () => {
    for (const [i, id] of IDS.entries()) {
      const item = findValuable(id);
      expect(item?.price, id).toBe(PRICES[i]);
      expect(item?.holds, id).toBe(SOUGHT.has(id) ? 'sought' : 'watch');
      expect(item?.kind, id).toBe('watch');
      expect(item && shelfOf(item.kind), id).toBe('watches');
    }
  });
  it('routes every addition to existing counters, with the very expensive piece at Maison only', () => {
    for (const item of VALUABLES.slice(151)) {
      expect(item.stores.length, item.id).toBeGreaterThan(0);
      for (const store of item.stores) {
        expect(VALUABLE_STORES.find((v) => v.id === store)?.kinds, item.id).toContain('watch');
      }
      expect(item.blurb.length, item.id).toBeGreaterThan(10);
      expect(item.blurb, item.id).not.toMatch(
        /calib[er]{2}|hairspring|power reserve|\d+\s*hours?/i,
      );
      expect(item.brand, item.id).not.toMatch(/Jacob|Rolex|Omega|Patek|Cartier|Seiko|Tudor/);
    }
    expect(findValuable('val.watch.jakob-timeless-treasure')).toMatchObject({
      brand: 'Jakob & Co.',
      rarity: 'very rare',
      stores: ['store.maison'],
      price: 20000000,
    });
  });
  it('reproduces the exact checked-in JSON without mutating the checkout', () => {
    const script = fileURLToPath(
      new URL('../../../scripts/generate-valuables.py', import.meta.url),
    );
    const result = execFileSync(
      'python3',
      [
        '-c',
        'import runpy,sys; m=runpy.run_path(sys.argv[1]); sys.stdout.write(m["catalog_text"]())',
        script,
      ],
      { encoding: 'utf8' },
    );
    expect(result).toBe(readFileSync(new URL('../data/valuables.json', import.meta.url), 'utf8'));
  });
});
