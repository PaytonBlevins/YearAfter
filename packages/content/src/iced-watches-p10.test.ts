import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { VALUABLES } from './valuables';
const root = new URL('../../../', import.meta.url);
const BASE_FIELDS_HASH = '24372048f0f05d3367f44c5f50e87a2017b1e342738008593d2414a35cb8dbcc';
const manifest = readFileSync(
  new URL('../../../claude/playtest-p10-iced-watches.md', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((l) => l.startsWith('| val.watch.'))
  .map((l) =>
    l
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim()),
  );
describe('P10 explicit approved catalog policy', () => {
  it('preserves every original catalog field and all non-watch entries', () => {
    expect(
      createHash('sha256')
        .update(JSON.stringify(VALUABLES.map(({ icing: _work, ...base }) => base)))
        .digest('hex'),
    ).toBe(BASE_FIELDS_HASH);
    expect(VALUABLES.filter((v) => v.kind !== 'watch').every((v) => v.icing === undefined)).toBe(
      true,
    );
  });
  it.each(manifest)(
    'authors the approved policy for %s',
    (id, _name, cost, share, recovery, policy) => {
      const item = VALUABLES.find((v) => v.id === id)!;
      expect(item.icing).toEqual(
        policy === 'Aftermarket'
          ? {
              kind: 'aftermarket',
              cost: Number(cost!.replace(/[$,]/g, '')),
              valueShare: Number(share!.replace('%', '')) / 100,
              costRecovery: Number(recovery!.replace('%', '')) / 100,
            }
          : { kind: policy === 'factory-set' ? 'factory' : 'unavailable' },
      );
    },
  );
  it('has exactly 53 aftermarket, one factory-set and one excluded watch', () => {
    expect(VALUABLES.filter((v) => v.icing?.kind === 'aftermarket')).toHaveLength(53);
    expect(VALUABLES.filter((v) => v.icing?.kind === 'factory')).toHaveLength(1);
    expect(VALUABLES.filter((v) => v.icing?.kind === 'unavailable')).toHaveLength(1);
  });
  it('reproduces exact catalog bytes from its authoring source', () => {
    const before = readFileSync(new URL('../data/valuables.json', import.meta.url));
    execFileSync('python', ['scripts/generate-valuables.py'], { cwd: root });
    expect(readFileSync(new URL('../data/valuables.json', import.meta.url))).toEqual(before);
  });
});
