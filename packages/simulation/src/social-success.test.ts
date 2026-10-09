import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import { channelYear, reconcile } from '@yearafter/finance';
import { advanceYear } from './advance';
import { businessTaxOn } from './businesses';
import { createNewGame } from './new-game';
import { openChannel, qualityOf, runCreatorsYear } from './creators';

function fixture(count: number) {
  const base = createNewGame({ seed: 'p3-accounting' });
  const teen = { ...base, player: { ...base.player, age: 14 } };
  const opened = openChannel(teen, 'shortform', 'comedy');
  if (!opened.ok) throw new Error('Refused');
  return {
    ...opened.value,
    channels: opened.value.channels.map((channel) => ({
      ...channel,
      audience: 200_000,
      peak: 300_000,
      luck: 0,
      publishing: { year: base.world.year, count, kind: 'meme', gained: 0 },
    })),
  };
}

describe('P3 live settlement', () => {
  it.each([1, 4, 12])(
    'uses manual settlement for %s posts and preserves old account luck',
    (count) => {
      const state = fixture(count);
      const channel = state.channels[0];
      if (!channel) throw new Error('No channel');
      const input = {
        channels: state.channels,
        fame: 0,
        year: state.world.year + 1,
        stats: state.player.stats,
        talents: state.player.talents,
      };
      const result = runCreatorsYear(input);
      const reference = channelYear({
        channel,
        quality: qualityOf(state.player.stats, state.player.talents, channel.categoryId),
        year: input.year,
        manual: true,
      });
      expect(result.channels[0]?.audience).toBe(reference.channel.audience);
      expect(result.channels[0]?.luck).toBe(0);
      expect(result.channels[0]?.peak).toBe(300_000);
      expect(result.net).toBeGreaterThan(0);
      expect(result.gross).toBe(Number(reference.income) / 100);
      expect(
        result.transactions
          .filter((row) => row.category === 'creator')
          .reduce((sum, row) => sum + Number(row.amount), 0),
      ).toBe(result.net * 100);
      expect(result.lines.some((line) => line.includes('took off'))).toBe(false);
    },
  );

  it('books a real advanced year, taxes its net and reconciles without posting twice', () => {
    const state = fixture(4);
    const snapshot = JSON.stringify(state.channels);
    const next = advanceYear(state).state;
    expect(next.world.year).toBe(state.world.year + 1);
    expect(next.player.age).toBe(15);
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    const creator = rows.filter((row) => row.category === 'creator');
    const net = creator.reduce((sum, row) => sum + Number(row.amount) / 100, 0);
    expect(net).toBeGreaterThan(1_000);
    expect(
      rows.filter((row) => row.category === 'salary' || row.category === 'commission'),
    ).toEqual([]);
    const tax = rows.filter(
      (row) => row.category === 'tax' && row.source === 'Tax on creator income',
    );
    expect(tax).toHaveLength(1);
    expect(tax[0]?.amount).toBe(dollars(-businessTaxOn(0, net)));
    expect(next.channels[0]?.publishing?.count).toBe(4);
    expect(next.channels[0]?.publishing?.year).toBe(state.world.year);
    expect(next.channels[0]?.luck).toBe(0);
    expect(reconcile(next.finance).ok).toBe(true);
    expect(next.player.cash).toBe(next.finance.balance);
    expect(JSON.stringify(state.channels)).toBe(snapshot);
    expect(advanceYear(state).state.channels).toEqual(next.channels);
  });
});
