import { describe, expect, it } from 'vitest';
import { HEADLINES, headlinesFor, MASTHEADS } from './headlines';

const conditions = [
  ['lead', 'severeRecession', 8],
  ['lead', 'recession', 8],
  ['lead', 'slowdown', 8],
  ['lead', 'normal', 8],
  ['lead', 'growth', 8],
  ['lead', 'strongExpansion', 8],
  ['sector', 'up', 10],
  ['sector', 'down', 10],
  ['mover', 'up', 10],
  ['mover', 'down', 10],
  ...['crypto', 'penny', 'bond', 'fund', 'stock'].flatMap((kind) => [
    ['tier', `${kind}.up`, 4] as const,
    ['tier', `${kind}.down`, 4] as const,
  ]),
] as const;

describe('A6 — price news names the holding and supported direction', () => {
  it('preserves every stable id, condition, tone and masthead slot', () => {
    expect(HEADLINES).toHaveLength(128);
    expect(MASTHEADS).toHaveLength(10);
    expect(new Set(HEADLINES.map((row) => row.text)).size).toBe(128);
    for (const [slot, when, count] of conditions) {
      const rows = HEADLINES.filter((row) => row.slot === slot && row.when === when);
      expect(rows).toHaveLength(count);
      rows.forEach((row, index) => {
        expect(row.id).toBe(`hl.${slot}.${when}.${index + 1}`);
        expect(row.tone).toBe(
          when === 'normal'
            ? 'flat'
            : ['growth', 'strongExpansion', 'up'].includes(when) || when.endsWith('.up')
              ? 'good'
              : 'bad',
        );
      });
    }
  });

  it.each(HEADLINES)('$id stays readable and does not invent company events or records', (row) => {
    expect(row.text.length).toBeLessThanOrEqual(62);
    expect(row.text).not.toMatch(
      /chief executive|CEO|record high|worst year|best year|doubles|every sector|nobody saw|money floods/i,
    );
    expect(row.text).not.toMatch(/\.$/);
    const tokens = row.text.match(/\{\w+\}/g) ?? [];
    if (row.slot === 'mover') {
      expect(tokens).toContain('{firm}');
      expect(tokens).toContain('{pct}');
      expect(row.text).toMatch(
        row.when === 'up' ? /rise|gain|up|add|climb/i : /fall|lose|down|drop/i,
      );
    } else if (row.slot === 'sector') {
      expect(tokens).toEqual(['{sector}']);
      expect(row.text).toMatch(/average/i);
      expect(row.text).toMatch(row.when === 'up' ? /rise|gain|climb/i : /fall|lose|drop/i);
    } else if (row.slot === 'tier') {
      expect(tokens).toEqual([]);
      const names: Record<string, RegExp> = {
        stock: /stock/i,
        fund: /fund/i,
        bond: /bond/i,
        crypto: /crypto/i,
        penny: /penny stock/i,
      };
      expect(row.text).toMatch(names[row.when.split('.')[0] ?? ''] ?? /INVALID TIER/);
      expect(row.text).toMatch(/average/i);
      expect(row.text).toMatch(
        row.when.endsWith('.up') ? /rise|gain|up|climb/i : /fall|lose|down|drop/i,
      );
    } else {
      expect(tokens).toEqual([]);
      expect(row.text).toMatch(/share|stock|fund|holding|investment/i);
    }
  });

  it('keeps up and down copy in the right condition pool', () => {
    for (const slot of ['sector', 'mover'] as const) {
      const up = headlinesFor(slot, 'up');
      const down = headlinesFor(slot, 'down');
      expect(up.every((row) => row.when === 'up')).toBe(true);
      expect(down.every((row) => row.when === 'down')).toBe(true);
      expect(up.some((row) => down.includes(row))).toBe(false);
    }
  });
});
