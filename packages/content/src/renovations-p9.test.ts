import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RENOVATIONS } from './renovations';
const approved = [
  ['sauna', 12000, 300, 0.25, 1, 1, 'home.townhouse'],
  ['patio', 15000, 300, 0.5, 1, 1, 'home.starter'],
  ['game-room', 25000, 300, 0.2, 1, 1, 'home.townhouse'],
  ['study', 18000, 0, 0.35, 1, 1, 'home.condo'],
  ['fountain', 20000, 600, 0.15, 1, 1, 'home.family'],
  ['guest-house', 180000, 2000, 0.5, 1, 4, 'home.luxury'],
  ['studio', 45000, 600, 0.15, 1, 2, 'home.large'],
  ['indoor-pool', 250000, 8000, 0.3, 2, 4, 'home.luxury'],
  ['outdoor-kitchen', 20000, 500, 0.35, 1, 1, 'home.family'],
] as const;
const kinds = [
  'home.condo',
  'home.townhouse',
  'home.starter',
  'home.family',
  'home.large',
  'home.luxury',
  'home.estate',
];
describe('P9 approved catalog', () => {
  it('contains 28 distinct stable ids', () => {
    expect(RENOVATIONS).toHaveLength(28);
    expect(new Set(RENOVATIONS.map((r) => r.id)).size).toBe(28);
  });
  it.each(approved)(
    'keeps approved %s numbers and kind gate',
    (id, cost, upkeep, recovery, happiness, space, first) => {
      const r = RENOVATIONS.find((r) => r.id === `reno.${id}`)!;
      expect(r).toMatchObject({
        cost,
        upkeep,
        recovery,
        happiness,
        space,
        beds: 0,
        refresh: false,
        redoAfter: 0,
      });
      expect(r.kinds).toEqual(kinds.slice(kinds.indexOf(first)));
      expect(r.phrase.length).toBeGreaterThan(3);
      expect(r.blurb.length).toBeGreaterThan(10);
    },
  );
  it('keeps existing amenity weights, pools and zero-space structural work', () => {
    const weights = {
      gym: 1,
      theater: 1,
      spa: 1,
      pool: 3,
      'infinity-pool': 4,
      'wine-cellar': 1,
      basketball: 3,
      tennis: 4,
      bowling: 3,
      observatory: 2,
      maze: 4,
    };
    for (const r of RENOVATIONS.slice(0, 19)) {
      expect(r.space).toBe(weights[r.id.slice(5) as keyof typeof weights] ?? 0);
      expect(r.happiness).toBe(r.group === 'pool' ? 2 : r.space > 0 ? 1 : 0);
    }
    expect(RENOVATIONS.filter((r) => r.group === 'pool').map((r) => r.id)).toEqual([
      'reno.pool',
      'reno.infinity-pool',
      'reno.indoor-pool',
    ]);
  });
});

it('preserves every original catalog field and paid-work identifier', () => {
  const original = RENOVATIONS.slice(0, 19).map(({ space: _space, happiness: _happy, ...entry }) =>
    Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b))),
  );
  expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe(
    '0b3d881817e193a6b9e7f04db00e94f919f0be9328fe424ec34395c7a6b2d27b',
  );
});

it('reproduces the entire checked-in renovation catalog byte for byte', () => {
  const script = fileURLToPath(
    new URL('../../../scripts/generate-renovations.py', import.meta.url),
  );
  const generated = execFileSync(
    'python3',
    [
      '-c',
      'import runpy,sys; m=runpy.run_path(sys.argv[1]); sys.stdout.write(m["catalog_text"]())',
      script,
    ],
    { encoding: 'utf8' },
  );
  expect(generated).toBe(
    readFileSync(new URL('../data/renovations.json', import.meta.url), 'utf8'),
  );
});
