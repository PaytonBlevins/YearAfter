import { describe, expect, it } from 'vitest';
import { findPlatform, postFormatsFor } from '@yearafter/content';
import { dollars, mixedUnit } from '@yearafter/core';
import {
  channelYear,
  liftedLuck,
  luckDraw,
  newChannel,
  nextAudience,
  targetAudience,
  viralGain,
  type Channel,
} from './creators';
import { publishPost } from './manual-posts';

const account = (platformId = 'shortform'): Channel => ({
  ...newChannel({ seed: 'p3', id: 'account', platformId, categoryId: 'comedy', year: 2040 }),
  audience: 200_000,
  peak: 300_000,
  luck: 0,
});
const active = (count: number, base = account()): Channel => ({
  ...base,
  publishing: { year: 2040, count, kind: 'meme', gained: 1 },
});
const settle = (channel: Channel) => channelYear({ channel, quality: 1, year: 2041, manual: true });

describe('P3 approved social success balance', () => {
  it.each([
    ['video', 3],
    ['stream', 5],
    ['photo', 3],
    ['shortform', 3],
    ['podcast', 5],
    ['subscription', 2],
    ['kick', 5],
    ['facebook', 3],
    ['twitter', 3],
  ] as const)('pins the %s lift and uses it only at opening', (platformId, lift) => {
    const platform = findPlatform(platformId);
    if (!platform) throw new Error('Missing platform');
    const channel = newChannel({
      seed: 'p3',
      id: 'account',
      platformId,
      categoryId: platform.categories[0] ?? '',
      year: 2040,
    });
    expect(platform.lift).toBe(lift);
    expect(channel.luck).toBeCloseTo(liftedLuck(luckDraw('p3', 'account'), lift), 12);
    const old = { ...channel, luck: 0.17 };
    expect(settle(old).channel.luck).toBe(0.17);
  });

  it.each([1, 4, 12])('does not shelter an above-target audience with %s posts', (count) => {
    const channel = active(count);
    const result = settle(channel);
    expect(result.channel.audience).toBe(100_002);
    expect(result.channel.audience).toBe(nextAudience(channel, targetAudience(channel, 1, 2041)));
    expect(result.channel.peak).toBe(300_000);
    expect(result.channel.luck).toBe(0);
    expect(result.channel.publishing).toEqual(channel.publishing);
    expect(result.income).toBe(dollars(count === 1 ? 405 : count === 4 ? 1_620 : 4_860));
  });

  it('slows only positive spread in proportion to actual output', () => {
    const base = { ...account('video'), categoryId: 'education', audience: 0, peak: 0, luck: 0.95 };
    const one = active(1, base),
      full = active(12, base);
    const target = targetAudience(base, 1, 2041);
    expect(target).toBeGreaterThan(1_000);
    const oneYear = settle(one),
      fullYear = settle(full);
    expect(oneYear.channel.audience).toBe(Math.round(nextAudience(base, target) / 12));
    expect(fullYear.channel.audience).toBe(nextAudience(base, target));
    expect(fullYear.channel.audience).toBeGreaterThan(oneYear.channel.audience * 10);
  });

  it('settles without an extra viral opportunity, even when the automatic model has a hit', () => {
    let reached = 0;
    for (let i = 0; i < 400; i++) {
      const channel = active(4, { ...account(), id: `p3-hit-${i}` });
      const drift = nextAudience(channel, targetAudience(channel, 1, 2041));
      if (viralGain(channel, 1, 2041, drift) === 0) continue;
      reached++;
      const manual = settle(channel);
      expect(manual.channel.audience).toBe(drift);
      expect(manual.notes.some((note) => note.kind === 'viral')).toBe(false);
      expect(manual.channel.viralYear).toBeUndefined();
      const automatic = channelYear({ channel, quality: 1, year: 2041 });
      expect(automatic.channel.audience).toBeGreaterThan(drift);
      expect(automatic.notes.some((note) => note.kind === 'viral')).toBe(true);
    }
    expect(reached).toBeGreaterThan(25);
  });

  it('keeps idle churn, zero output income and owed payments paid exactly once', () => {
    const channel = { ...account(), owed: dollars(1_234) };
    const result = settle(channel);
    expect(result.channel.audience).toBe(160_000);
    expect(result.income).toBe(dollars(1_234));
    expect(result.channel.owed).toBeUndefined();
    expect(
      channelYear({ channel: result.channel, quality: 1, year: 2042, manual: true }).income,
    ).toBe(dollars(0));
  });

  it('retains seed-keyed explicit breakouts and the platform ceiling without moving money', () => {
    const base = { ...account(), audience: 1_000, peak: 1_000, earned: dollars(42) };
    const option = postFormatsFor('shortform').find((row) => row.id === 'meme');
    if (!option) throw new Error('Missing format');
    let hits = 0,
      quiet = 0;
    for (let i = 0; i < 2_000; i++) {
      const seed = `p3-post-${i}`,
        key = `${seed}:manual-post:account:2040:0`;
      if (mixedUnit(`${key}:reaction`) < option.risk) continue;
      const result = publishPost({ channel: base, seed, year: 2040, quality: 1, kind: 'meme' });
      if (!result.ok) throw new Error('Refused');
      const viral = mixedUnit(`${key}:viral`) < 0.12 / 12;
      if (viral) hits++;
      else quiet++;
      const ordinary = Math.round(40 * option.discovery * (0.5 + mixedUnit(`${key}:reach`)));
      expect(result.value.audience).toBe(1_000 + ordinary + (viral ? 3_000 : 0));
      expect(result.value.earned).toBe(dollars(42));
      expect(publishPost({ channel: base, seed, year: 2040, quality: 1, kind: 'meme' })).toEqual(
        result,
      );
      if (viral) {
        const capped = publishPost({
          channel: { ...base, audience: 799_999_999, peak: 799_999_999 },
          seed,
          year: 2040,
          quality: 1,
          kind: 'meme',
        });
        if (!capped.ok) throw new Error('Refused');
        expect(capped.value.audience).toBe(800_000_000);
        expect(capped.value.peak).toBe(800_000_000);
      }
    }
    expect(hits).toBeGreaterThan(5);
    expect(quiet).toBeGreaterThan(1_000);
    expect(base.audience).toBe(1_000);
  });
  it.each([
    ['video', 'gaming', 1, 1, 2, 0, 0.04],
    ['shortform', 'comedy', 0.4, 0.47, 3, 0, 0.03],
    ['subscription', 'education', 1, 1, 1, 0.03, 0.1],
  ] as const)(
    'keeps six years of ordinary manual %s play within the measured outcome bands',
    (platformId, categoryId, paidLow, paidHigh, firstYear, wageLow, wageHigh) => {
      const format = postFormatsFor(platformId)[0];
      if (!format) throw new Error('Missing format');
      const firstPaid: number[] = [];
      let wage = 0;
      for (let i = 0; i < 400; i++) {
        const seed = `p3-control-${i}`,
          start = 2020 + (i % 24);
        let channel = newChannel({
          seed,
          id: `ch:${start}:${platformId}:${categoryId}`,
          platformId,
          categoryId,
          year: start,
        });
        let first: number | undefined,
          madeWage = false;
        for (let year = 0; year < 6; year++) {
          for (let post = 0; post < 12; post++) {
            const result = publishPost({
              channel,
              seed,
              year: start + year,
              quality: 1,
              kind: format.id,
            });
            if (!result.ok) throw new Error('Publication refused');
            channel = result.value;
          }
          const result = channelYear({ channel, quality: 1, year: start + year + 1, manual: true });
          channel = result.channel;
          if (result.income > 0 && first === undefined) first = year + 1;
          if (result.income >= dollars(30_000)) madeWage = true;
        }
        if (first !== undefined) firstPaid.push(first);
        if (madeWage) wage++;
      }
      expect(firstPaid.length / 400).toBeGreaterThanOrEqual(paidLow);
      expect(firstPaid.length / 400).toBeLessThanOrEqual(paidHigh);
      expect(firstPaid.sort((a, b) => a - b)[Math.floor(firstPaid.length / 2)]).toBe(firstYear);
      expect(wage / 400).toBeGreaterThanOrEqual(wageLow);
      expect(wage / 400).toBeLessThanOrEqual(wageHigh);
    },
  );
});
