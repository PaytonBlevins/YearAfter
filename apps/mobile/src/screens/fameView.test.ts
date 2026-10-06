/**
 * Ticket 0708 — what the fame and social media screens say. Written-out tables (13.120).
 */

import { describe, expect, it } from 'vitest';
import { channelOf } from '../test/fameFixtures';
import {
  EFFORT_BLURBS,
  EFFORT_LABELS,
  TIER_LABELS,
  audienceLine,
  fameLabel,
  fameWords,
  money,
  nextOpening,
  rankLine,
  tierLine,
  topLine,
  trendLine,
} from './fameView';

describe('fame, exactly', () => {
  it('is the number, with a percent sign, clamped to the bar', () => {
    expect([0, 1, 37, 99, 100].map(fameLabel)).toEqual(['0%', '1%', '37%', '99%', '100%']);
    expect([-4, 140, 36.6].map(fameLabel)).toEqual(['0%', '100%', '37%']);
  });

  it('says how known you are, in words that change where the offers do', () => {
    expect([0, 1, 5, 6, 29, 30, 59, 60, 84, 85, 100].map(fameWords)).toEqual([
      'Nobody knows your name yet',
      'Hardly anyone knows your name',
      'Hardly anyone knows your name',
      'A rising name',
      'A rising name',
      'Well known',
      'Well known',
      'A household name',
      'A household name',
      'A global star',
      'A global star',
    ]);
  });

  it('says what the next level opens, and stops when everything is open', () => {
    const table: readonly [number, string | undefined][] = [
      [0, 'photoshoot@6'],
      [5, 'photoshoot@6'],
      [6, 'commercial@12'],
      [11, 'commercial@12'],
      [12, 'talkShow@20'],
      [19, 'talkShow@20'],
      [20, 'guestStar@28'],
      [27, 'guestStar@28'],
      [28, undefined],
      [100, undefined],
    ];
    for (const [fame, expected] of table) {
      const next = nextOpening(fame);
      expect(next === undefined ? undefined : `${next.def.id}@${next.at}`).toBe(expected);
    }
  });
});

describe('a channel, in words', () => {
  it('counts its audience in the platform’s own word', () => {
    expect(audienceLine(channelOf('a', 5))).toBe('5 subscribers');
    expect(audienceLine(channelOf('a', 200000))).toBe('200,000 subscribers');
    expect(audienceLine(channelOf('a', 3000, 'stream', 'gaming'))).toBe('3,000 followers');
    expect(audienceLine(channelOf('a', 50000, 'podcast', 'comedy'))).toBe('50,000 listeners');
  });

  it('puts it on the chart only where there is one and it is on it', () => {
    expect(rankLine(channelOf('a', 50000, 'podcast', 'comedy'))).toBe('#88 on the Podcast chart');
    // Video has no chart, and a tiny podcast is nowhere near one.
    expect(rankLine(channelOf('a', 200000))).toBeUndefined();
    expect(rankLine(channelOf('a', 3, 'podcast', 'comedy'))).toBeUndefined();
  });

  it('says the smallest group a place is inside', () => {
    expect(topLine(undefined)).toBeUndefined();
    expect(topLine(1)).toBe('Number one');
    expect(topLine(2)).toBe('In the top 10');
    expect(topLine(10)).toBe('In the top 10');
    expect(topLine(11)).toBe('In the top 100');
    expect(topLine(100)).toBe('In the top 100');
    expect(topLine(101)).toBe('In the top 1,000');
    expect(topLine(1000)).toBe('In the top 1,000');
  });

  it('says what is in fashion, and nothing when it is steady', () => {
    const gaming = channelOf('a', 5, 'stream', 'gaming');
    const comedy = channelOf('a', 5, 'video', 'comedy');
    expect([2026, 2027, 2028, 2029, 2030, 2031].map((year) => trendLine(gaming, year))).toEqual([
      undefined,
      'Gaming: out of fashion',
      'Gaming: out of fashion',
      undefined,
      'Gaming: doing well',
      'Gaming: cooling off',
    ]);
    expect([2026, 2027, 2028, 2031].map((year) => trendLine(comedy, year))).toEqual([
      undefined,
      'Comedy: cooling off',
      'Comedy: doing well',
      'Comedy: out of fashion',
    ]);
  });
});

describe('the dials', () => {
  it('names the three efforts and what each means', () => {
    expect(EFFORT_LABELS).toEqual({ light: 'Light', regular: 'Regular', heavy: 'Heavy' });
    expect(EFFORT_BLURBS).toEqual({
      light: 'Grows slowly and tops out lower. Easy on your week.',
      regular: 'A steady pace.',
      heavy: 'Grows faster and goes higher. Takes a lot of your week.',
    });
  });

  it('prices a month for a paid reader', () => {
    expect(TIER_LABELS).toEqual({ low: 'Low', standard: 'Standard', premium: 'Premium' });
    expect(['low', 'standard', 'premium'].map((tier) => tierLine(tier as 'low'))).toEqual([
      'Low, $5 a month',
      'Standard, $8 a month',
      'Premium, $15 a month',
    ]);
  });

  it('writes money in whole dollars', () => {
    expect([0, 7, 1234, 1_234_567.4].map(money)).toEqual(['$0', '$7', '$1,234', '$1,234,567']);
  });
});

describe('small things the screens lean on', () => {
  it('rounds money to the nearest dollar, not down', () => {
    expect([7.4, 7.5, 7.6, 1234.56].map(money)).toEqual(['$7', '$8', '$8', '$1,235']);
  });

  it('calls an audience followers when the platform is not known', () => {
    expect(audienceLine({ ...channelOf('a', 5), platformId: 'nowhere' })).toBe('5 followers');
  });

  it('says nothing about fashion for a kind of channel nobody has heard of', () => {
    expect(trendLine({ ...channelOf('a', 5), categoryId: 'nothing' }, 2028)).toBeUndefined();
  });
});
