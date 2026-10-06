/**
 * Ticket 0701 acceptance tests — channels, audiences, income and fame
 * (finance side).
 *
 * The interesting assertions are the ones a wrong constant would survive:
 * the published long-tail shape, the platform thresholds on both sides, the
 * pinned income at a known audience, and the way fame falls more slowly than
 * it climbs.
 */

import { describe, expect, it } from 'vitest';
import {
  CREATOR_CATEGORIES,
  PLATFORMS,
  findCreatorCategory,
  findPlatform,
} from '@yearafter/content';
import { dollars, mixedUnit } from '@yearafter/core';
import {
  CHART_SIZE,
  CHART_TIERS,
  EFFORT_HOURS,
  STEADY_BELOW,
  TREND_FADE,
  TREND_MEMORY,
  chartNote,
  chartRank,
  chartTierOf,
  creatorHours,
  leanWord,
  CONVERSION_FALLOFF,
  CONVERSION_FLOOR,
  PAID_RETENTION,
  PAID_TIERS,
  TIER_PRICE,
  VIRAL_BASE,
  VIRAL_EFFORT,
  memberIncome,
  paidNext,
  paysFrom,
  paidShare,
  tierIncomes,
  viralGain,
  survivalAt,
  trendLean,
  trendWord,
  trendsFor,
  CREATOR_FROM_AGE,
  noteFor,
  SLUMP_FROM,
  SLUMP_SHARE,
  EFFORTS,
  MAX_CHANNELS,
  channelIncome,
  channelYear,
  creatorQuality,
  fameTarget,
  newChannel,
  luckDraw,
  liftedLuck,
  LUCK_LIFT,
  LUCK_LIFT_BELOW,
  nextAudience,
  nextFame,
  settledAudience,
  targetAudience,
  trendOf,
  upkeepOf,
  whyNotOpen,
  withEffort,
  type Channel,
} from './creators';
import { EMPTY_LEDGER, postAll } from './ledger';
import { summariseFinances } from './summary';

/**
 * A channel with the sourced draw, not the player's: the population tests below check the
 * published curves, and a player's channel is deliberately lifted off them (0706).
 */
const sourced = (input: Parameters<typeof newChannel>[0]) => ({
  ...newChannel(input),
  luck: luckDraw(input.seed, input.id),
});

const make = (over: Partial<Channel> = {}): Channel => ({
  ...newChannel({
    seed: 'seed',
    id: 'ch:2030:video:gaming',
    platformId: 'video',
    categoryId: 'gaming',
    year: 2030,
  }),
  ...over,
});

describe('the catalog', () => {
  it('lists six platforms with unique ids, and every category they name exists', () => {
    expect(PLATFORMS).toHaveLength(6);
    expect(new Set(PLATFORMS.map((p) => p.id)).size).toBe(6);
    for (const platform of PLATFORMS) {
      expect(platform.categories.length).toBeGreaterThanOrEqual(5);
      for (const id of platform.categories) expect(findCreatorCategory(id)).toBeDefined();
    }
  });

  it('gives every category a home, a name list, a real talent if any, and a sensible number', () => {
    expect(new Set(CREATOR_CATEGORIES.map((c) => c.id)).size).toBe(CREATOR_CATEGORIES.length);
    for (const category of CREATOR_CATEGORIES) {
      expect(PLATFORMS.some((p) => p.categories.includes(category.id))).toBe(true);
      expect(category.names.length).toBeGreaterThanOrEqual(3);
      expect(new Set(category.names).size).toBe(category.names.length);
      expect(category.pays).toBeGreaterThan(0);
      expect(category.crowding).toBeGreaterThan(0);
      expect(category.swing).toBeGreaterThanOrEqual(0);
      expect(category.swing).toBeLessThan(0.5);
    }
  });

  it('keeps a platform no easier to open than the youngest age allows', () => {
    for (const platform of PLATFORMS) {
      expect(platform.minAge).toBeGreaterThanOrEqual(CREATOR_FROM_AGE);
      expect(platform.startCost).toBeGreaterThan(0);
      expect(platform.paysAt).toBeGreaterThan(0);
      expect(platform.ceiling).toBeGreaterThan(platform.paysAt);
    }
  });
});

describe('who may open a channel', () => {
  const ok = {
    age: 20,
    liquid: 10_000,
    held: [] as Channel[],
    platformId: 'video',
    categoryId: 'gaming',
  };

  it('lets a twenty-year-old with money open one', () => {
    expect(whyNotOpen(ok)).toBeUndefined();
  });

  it('turns away somebody under fourteen, and says the age', () => {
    expect(whyNotOpen({ ...ok, age: 13 })).toEqual({ kind: 'tooYoung', age: 14 });
    expect(whyNotOpen({ ...ok, age: 14 })).toBeUndefined();
  });

  it('asks more of a podcast and a newsletter: sixteen', () => {
    expect(whyNotOpen({ ...ok, age: 15, platformId: 'podcast', categoryId: 'comedy' })).toEqual({
      kind: 'tooYoung',
      age: 16,
    });
    expect(
      whyNotOpen({ ...ok, age: 16, platformId: 'podcast', categoryId: 'comedy' }),
    ).toBeUndefined();
    expect(
      whyNotOpen({ ...ok, age: 15, platformId: 'subscription', categoryId: 'writing' }),
    ).toEqual({
      kind: 'tooYoung',
      age: 16,
    });
  });

  it('refuses a platform that does not exist, and a category it does not carry', () => {
    expect(whyNotOpen({ ...ok, platformId: 'nope' })).toEqual({ kind: 'unknownPlatform' });
    expect(whyNotOpen({ ...ok, platformId: 'podcast', categoryId: 'gaming' })).toEqual({
      kind: 'notSuitable',
    });
    expect(whyNotOpen({ ...ok, categoryId: 'nope' })).toEqual({ kind: 'notSuitable' });
  });

  it('refuses a second channel of the same kind, but not a different category or platform', () => {
    const held = [make()];
    expect(whyNotOpen({ ...ok, held })).toEqual({ kind: 'alreadyHaveOne' });
    expect(whyNotOpen({ ...ok, held, categoryId: 'comedy' })).toBeUndefined();
    expect(whyNotOpen({ ...ok, held, platformId: 'stream' })).toBeUndefined();
  });

  it('stops at four channels, and counts the fourth as room', () => {
    const four = ['comedy', 'education', 'lifestyle', 'fitness'];
    const held = four.map((categoryId, i) => make({ id: `c${i}`, categoryId }));
    expect(MAX_CHANNELS).toBe(4);
    expect(whyNotOpen({ ...ok, held: held.slice(0, 3) })).toBeUndefined();
    expect(whyNotOpen({ ...ok, held })).toEqual({ kind: 'tooMany', limit: 4 });
  });

  it('wants exactly the start-up cost: one dollar short is refused, the cost itself is not', () => {
    const cost = findPlatform('video')!.startCost;
    expect(whyNotOpen({ ...ok, liquid: cost - 1 })).toEqual({
      kind: 'notEnoughMoney',
      needed: cost,
    });
    expect(whyNotOpen({ ...ok, liquid: cost })).toBeUndefined();
  });
});

describe('a new channel', () => {
  it('starts with nobody, regular effort, and nothing earned', () => {
    const channel = make();
    expect(channel.audience).toBe(0);
    expect(channel.peak).toBe(0);
    expect(channel.effort).toBe('regular');
    expect(Number(channel.earned)).toBe(0);
    expect(channel.since).toBe(2030);
  });

  it('draws its luck once, from the seed and the id: the same every time', () => {
    expect(make().luck).toBe(make().luck);
    expect(make().luck).toBeGreaterThanOrEqual(0);
    expect(make().luck).toBeLessThan(1);
    const other = newChannel({
      seed: 'other',
      id: 'ch:2030:video:gaming',
      platformId: 'video',
      categoryId: 'gaming',
      year: 2030,
    });
    expect(other.luck).not.toBe(make().luck);
    const next = newChannel({
      seed: 'seed',
      id: 'ch:2031:video:gaming',
      platformId: 'video',
      categoryId: 'gaming',
      year: 2031,
    });
    expect(next.luck).not.toBe(make().luck);
  });

  it('is named from its category', () => {
    expect(findCreatorCategory('gaming')!.names).toContain(make().name);
  });

  it('spreads the draw across the whole range across many lives', () => {
    const draws = Array.from({ length: 2000 }, (_, i) => luckDraw(`s${i}`, 'x'));
    const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(Math.min(...draws)).toBeLessThan(0.02);
    expect(Math.max(...draws)).toBeGreaterThan(0.98);
  });

  it('gives the channel the lifted draw, from its own platform', () => {
    for (const [platformId, categoryId] of [
      ['video', 'gaming'],
      ['stream', 'gaming'],
      ['podcast', 'comedy'],
    ] as const) {
      const channel = newChannel({ seed: 'lift', id: 'x', platformId, categoryId, year: 2030 });
      expect(channel.luck).toBe(liftedLuck(luckDraw('lift', 'x'), findPlatform(platformId)!.lift));
      expect(channel.luck).toBeGreaterThan(luckDraw('lift', 'x') - 1e-12);
    }
  });

  it('changes effort without touching anything else', () => {
    const base = make({ audience: 500, peak: 700 });
    const heavy = withEffort(base, 'heavy');
    expect(heavy.effort).toBe('heavy');
    expect({ ...heavy, effort: 'regular' }).toEqual(base);
    expect(base.effort).toBe('regular');
  });
});

describe('where a channel settles: the long tail', () => {
  it('reads the published figures off the curve', () => {
    expect(settledAudience(1 - 0.406)).toBeCloseTo(1_000, 0);
    expect(settledAudience(1 - 0.079)).toBeCloseTo(10_000, 0);
    expect(settledAudience(1 - 0.013)).toBeCloseTo(100_000, -1);
    expect(settledAudience(1 - 0.0013)).toBeCloseTo(1_000_000, -2);
  });

  it('is smooth and rising: more luck never settles smaller', () => {
    let last = 0;
    for (let luck = 0; luck < 1; luck += 0.001) {
      const now = settledAudience(luck);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });

  it('sits between the anchors it lies between', () => {
    const mid = settledAudience(1 - 0.2);
    expect(mid).toBeGreaterThan(1_000);
    expect(mid).toBeLessThan(10_000);
    const upper = settledAudience(1 - 0.003);
    expect(upper).toBeGreaterThan(100_000);
    expect(upper).toBeLessThan(1_000_000);
  });

  it('gives nobody less than a few people and nobody more than the biggest channels there are', () => {
    expect(settledAudience(0)).toBe(3);
    expect(settledAudience(1)).toBe(400_000_000);
    expect(settledAudience(0.999999999)).toBe(400_000_000);
  });

  it('puts six years of ordinary effort on the published shares', () => {
    const lives = 20_000;
    let a1k = 0;
    let a10k = 0;
    let a100k = 0;
    let a1m = 0;
    for (let i = 0; i < lives; i += 1) {
      let channel = sourced({
        seed: `s${i}`,
        id: 'c',
        platformId: 'video',
        categoryId: 'education',
        year: 2030,
      });
      const quality = creatorQuality(30 + (i % 50), i % 7 === 0);
      for (let year = 0; year < 6; year += 1) {
        channel = channelYear({ channel, year: 2030 + year, quality }).channel;
      }
      if (channel.audience >= 1_000) a1k += 1;
      if (channel.audience >= 10_000) a10k += 1;
      if (channel.audience >= 100_000) a100k += 1;
      if (channel.audience >= 1_000_000) a1m += 1;
    }
    // vidIQ, July 2026: 40.6%, 7.9%, 1.3%, 0.13%. A little above it, as active makers are.
    expect(a1k / lives).toBeGreaterThan(0.36);
    expect(a1k / lives).toBeLessThan(0.45);
    expect(a10k / lives).toBeGreaterThan(0.065);
    expect(a10k / lives).toBeLessThan(0.105);
    expect(a100k / lives).toBeGreaterThan(0.009);
    expect(a100k / lives).toBeLessThan(0.02);
    expect(a1m / lives).toBeGreaterThan(0.0007);
    expect(a1m / lives).toBeLessThan(0.003);
  });
});

describe('quality and fashion', () => {
  it('runs from 0.6 for no skill to 1.4 for full skill, and a talent adds 0.15', () => {
    expect(creatorQuality(0, false)).toBeCloseTo(0.6, 10);
    expect(creatorQuality(50, false)).toBeCloseTo(1, 10);
    expect(creatorQuality(100, false)).toBeCloseTo(1.4, 10);
    expect(creatorQuality(50, true)).toBeCloseTo(1.15, 10);
    expect(creatorQuality(0, true)).toBeCloseTo(0.75, 10);
  });

  it('never goes past 1.5 or under 0.5, however odd the skill', () => {
    expect(creatorQuality(100, true)).toBe(1.5);
    expect(creatorQuality(900, true)).toBe(1.5);
    expect(creatorQuality(-40, false)).toBeCloseTo(0.6, 10);
  });

  it('swings a category by its own swing, the same for everybody, and not at all for an unknown one', () => {
    expect(trendOf('gaming', 2040)).toBe(trendOf('gaming', 2040));
    expect(trendOf('nope', 2040)).toBe(1);
    const swing = findCreatorCategory('gaming')!.swing;
    const values = Array.from({ length: 200 }, (_, i) => trendOf('gaming', 2000 + i));
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(1 - swing);
      expect(value).toBeLessThanOrEqual(1 + swing);
    }
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(swing);
    const calm = findCreatorCategory('writing')!.swing;
    const calmValues = Array.from({ length: 200 }, (_, i) => trendOf('writing', 2000 + i));
    expect(Math.max(...calmValues) - Math.min(...calmValues)).toBeLessThanOrEqual(2 * calm);
  });
});

describe('where a channel is headed, and how fast it gets there', () => {
  const lucky = make({ luck: 0.99 });

  it('is the same for the same inputs, and different from year to year', () => {
    expect(targetAudience(lucky, 1, 2031)).toBe(targetAudience(lucky, 1, 2031));
    expect(targetAudience(lucky, 1, 2031)).not.toBe(targetAudience(lucky, 1, 2032));
  });

  it('rewards better work, in proportion to its square', () => {
    const low = targetAudience(lucky, 0.8, 2031);
    const high = targetAudience(lucky, 1.2, 2031);
    expect(high / low).toBeGreaterThan(2.2);
    expect(high / low).toBeLessThan(2.3);
  });

  it('rewards effort: light is half, heavy is half again', () => {
    const regular = targetAudience(lucky, 1, 2031);
    expect(targetAudience(withEffort(lucky, 'light'), 1, 2031) / regular).toBeGreaterThan(0.49);
    expect(targetAudience(withEffort(lucky, 'light'), 1, 2031) / regular).toBeLessThan(0.51);
    expect(targetAudience(withEffort(lucky, 'heavy'), 1, 2031) / regular).toBeGreaterThan(1.45);
    expect(targetAudience(withEffort(lucky, 'heavy'), 1, 2031) / regular).toBeLessThan(1.51);
  });

  it('is easier to be found on short clips than on a podcast, and harder in a crowded category', () => {
    const clips = make({ platformId: 'shortform', luck: 0.9 });
    const podcast = make({ platformId: 'podcast', categoryId: 'comedy', luck: 0.9 });
    expect(targetAudience(clips, 1, 2031)).toBeGreaterThan(targetAudience(podcast, 1, 2031) * 2);
    const crowded = make({ categoryId: 'gaming', luck: 0.9 });
    const quiet = make({ categoryId: 'education', luck: 0.9 });
    // Education is less crowded (0.8 against 1.5); the fashions also differ, so compare a mean.
    const mean = (channel: Channel) =>
      Array.from({ length: 100 }, (_, i) => targetAudience(channel, 1, 2000 + i)).reduce(
        (a, b) => a + b,
        0,
      ) / 100;
    expect(mean(quiet)).toBeGreaterThan(mean(crowded) * 1.2);
  });

  it('fades toward the platform ceiling rather than passing it', () => {
    const platform = findPlatform('podcast')!;
    const huge = make({ platformId: 'podcast', categoryId: 'comedy', luck: 1 });
    const value = targetAudience(huge, 1.5, 2031);
    expect(value).toBeLessThan(platform.ceiling);
    expect(value).toBeGreaterThan(1_000_000);
  });

  it('is nothing for a platform or a category it does not know', () => {
    expect(targetAudience(make({ platformId: 'nope' }), 1, 2031)).toBe(0);
    expect(targetAudience(make({ categoryId: 'nope' }), 1, 2031)).toBe(0);
  });

  it('closes thirty percent of the gap in a year at regular effort, more at heavy, less at light', () => {
    const start = make({ audience: 1_000 });
    expect(nextAudience(start, 11_000)).toBe(4_000);
    expect(nextAudience(withEffort(start, 'heavy'), 11_000)).toBe(4_750);
    expect(nextAudience(withEffort(start, 'light'), 11_000)).toBe(3_100);
  });

  it('falls back toward a lower target by the platform churn, harder on short clips', () => {
    const video = make({ audience: 10_000 });
    expect(nextAudience(video, 0)).toBe(7_500);
    const clips = make({ platformId: 'shortform', categoryId: 'comedy', audience: 10_000 });
    expect(nextAudience(clips, 0)).toBe(5_000);
    expect(nextAudience(make({ audience: 100 }), 0)).toBeGreaterThanOrEqual(0);
    const podcast = make({ platformId: 'podcast', categoryId: 'comedy', audience: 10_000 });
    expect(nextAudience(podcast, 0)).toBe(8_250);
  });

  it('leaves an unknown platform where it was', () => {
    expect(nextAudience(make({ platformId: 'nope', audience: 77 }), 5_000)).toBe(77);
  });
});

describe('what an audience pays', () => {
  const pay = (
    platformId: string,
    categoryId: string,
    audience: number,
    effort: Channel['effort'] = 'regular',
  ) => channelIncome(findPlatform(platformId)!, findCreatorCategory(categoryId)!, audience, effort);

  it('pays nothing under the threshold and something on it, for every platform', () => {
    for (const platform of PLATFORMS) {
      const category = platform.categories[0]!;
      expect(pay(platform.id, category, platform.paysAt - 1)).toBe(0);
      expect(pay(platform.id, category, platform.paysAt)).toBeGreaterThan(0);
    }
  });

  it('pins each way of being paid at a known audience', () => {
    expect(pay('video', 'gaming', 100_000)).toBe(22_400);
    expect(pay('stream', 'gaming', 100_000)).toBe(96_000);
    expect(pay('photo', 'lifestyle', 100_000)).toBe(26_000);
    expect(pay('shortform', 'comedy', 1_000_000)).toBe(32_400);
    expect(pay('podcast', 'comedy', 10_000)).toBe(7_020);
    expect(pay('subscription', 'education', 10_000)).toBe(33_342);
  });

  it('pays a category in proportion to what its audience is worth', () => {
    expect(pay('video', 'business', 100_000) / pay('video', 'music', 100_000)).toBeCloseTo(
      1.8 / 0.7,
      1,
    );
  });

  it('pays less for less effort and more for more, except a subscription, which keeps paying', () => {
    expect(pay('video', 'gaming', 100_000, 'light')).toBe(11_200);
    expect(pay('video', 'gaming', 100_000, 'heavy')).toBe(35_840);
    expect(pay('podcast', 'comedy', 10_000, 'light')).toBe(3_510);
    expect(pay('subscription', 'education', 10_000, 'light')).toBeGreaterThan(0);
  });

  it('pays a million subscribers about ten times a hundred thousand: no free lunch at the top', () => {
    const ratio = pay('video', 'gaming', 1_000_000) / pay('video', 'gaming', 100_000);
    expect(ratio).toBe(10);
    const photoRatio = pay('photo', 'lifestyle', 1_000_000) / pay('photo', 'lifestyle', 100_000);
    expect(photoRatio).toBeGreaterThan(10);
    expect(photoRatio).toBeLessThan(13);
  });

  it('keeps upkeep a quarter of the start-up cost at regular effort', () => {
    const video = findPlatform('video')!;
    expect(upkeepOf(video, 'regular')).toBe(150);
    expect(upkeepOf(video, 'light')).toBe(75);
    expect(upkeepOf(video, 'heavy')).toBe(240);
  });

  it('uses every effort', () => {
    expect(EFFORTS).toEqual(['light', 'regular', 'heavy']);
  });
});

describe('a year on one channel', () => {
  it('moves the audience, pays on the average of the year, and costs upkeep', () => {
    const start = make({ luck: 0.99999, audience: 5_000, peak: 5_000 });
    const result = channelYear({ channel: start, year: 2031, quality: 1 });
    expect(result.channel.audience).toBeGreaterThan(5_000);
    const platform = findPlatform('video')!;
    const category = findCreatorCategory('gaming')!;
    const average = Math.round((5_000 + result.channel.audience) / 2);
    expect(Number(result.income)).toBe(channelIncome(platform, category, average, 'regular') * 100);
    expect(Number(result.cost)).toBe(15_000);
    expect(result.channel.peak).toBe(result.channel.audience);
  });

  it('adds the year to what it has earned, and keeps the peak when the audience falls', () => {
    const start = make({ luck: 0.99999, audience: 5_000, peak: 9_000, earned: dollars(300) });
    const result = channelYear({ channel: start, year: 2031, quality: 1 });
    expect(Number(result.channel.earned)).toBe(30_000 + Number(result.income));
    expect(result.channel.peak).toBe(Math.max(9_000, result.channel.audience));
    const falling = channelYear({
      channel: make({ luck: 0, audience: 8_000, peak: 9_000 }),
      year: 2031,
      quality: 1,
    });
    expect(falling.channel.audience).toBeLessThan(8_000);
    expect(falling.channel.peak).toBe(9_000);
  });

  it('does not change what it was given', () => {
    const start = make({ luck: 0.9, audience: 1_200 });
    const copy = JSON.stringify(start);
    channelYear({ channel: start, year: 2031, quality: 1 });
    expect(JSON.stringify(start)).toBe(copy);
  });

  it('pays nothing and says nothing of a channel nobody has found, and still costs upkeep', () => {
    const result = channelYear({ channel: make({ luck: 0, audience: 0 }), year: 2031, quality: 1 });
    expect(Number(result.income)).toBe(0);
    expect(Number(result.cost)).toBe(15_000);
    expect(result.note).toBeUndefined();
  });

  it('says it is monetized the year it crosses the threshold, and not again', () => {
    const crossing = channelYear({
      channel: make({ luck: 0.99999, audience: 700 }),
      year: 2031,
      quality: 1,
    });
    expect(crossing.channel.audience).toBeGreaterThanOrEqual(1_000);
    expect(crossing.note).toEqual({ kind: 'monetized' });
    const after = channelYear({ channel: crossing.channel, year: 2032, quality: 1 });
    expect(after.note?.kind).not.toBe('monetized');
  });

  it('marks the biggest milestone it passes, once', () => {
    const jump = channelYear({
      channel: make({ luck: 0.99999, audience: 1_500 }),
      year: 2031,
      quality: 1.4,
    });
    const milestone = jump.notes.find((n) => n.kind === 'milestone');
    expect(milestone).toBeDefined();
    if (milestone?.kind === 'milestone') {
      expect(milestone.mark).toBeLessThanOrEqual(jump.channel.audience);
      expect(milestone.mark).toBeGreaterThan(1_500);
      expect(milestone.mark).toBeGreaterThan(jump.channel.audience / 10 - 1);
    }
    const quiet = channelYear({ channel: jump.channel, year: 2032, quality: 1.4 });
    const again = quiet.notes.find((n) => n.kind === 'milestone');
    if (again?.kind === 'milestone' && milestone?.kind === 'milestone') {
      expect(again.mark).toBeGreaterThan(milestone.mark);
    }
  });

  it('says it slumped when more than a fifth of a real audience goes, not for a small one', () => {
    const big = channelYear({
      channel: make({ luck: 0, audience: 50_000 }),
      year: 2031,
      quality: 1,
    });
    expect(big.note).toEqual({ kind: 'slump' });
    const tiny = channelYear({ channel: make({ luck: 0, audience: 900 }), year: 2031, quality: 1 });
    expect(tiny.channel.audience).toBeLessThan(900 * 0.8);
    expect(tiny.note).toBeUndefined();
  });

  it('is inert for a platform it does not know', () => {
    const odd = make({ platformId: 'nope', audience: 40 });
    const result = channelYear({ channel: odd, year: 2031, quality: 1 });
    expect(result.channel).toEqual(odd);
    expect(Number(result.income)).toBe(0);
    expect(Number(result.cost)).toBe(0);
  });
});

describe('fame', () => {
  it('is nothing with no channels and for a channel nobody follows', () => {
    expect(fameTarget([])).toBe(0);
    expect(fameTarget([make({ audience: 0 })])).toBe(0);
  });

  it('puts a thousand subscribers at 6, a million at 60, and caps at 100', () => {
    expect(fameTarget([make({ audience: 1_000 })])).toBe(6);
    expect(fameTarget([make({ audience: 100_000 })])).toBe(40);
    expect(fameTarget([make({ audience: 1_000_000 })])).toBe(60);
    expect(fameTarget([make({ audience: 100_000_000_000 })])).toBe(100);
  });

  it('weighs an audience by the platform: a listener counts for more than a short-clip follower', () => {
    const podcast = fameTarget([
      make({ platformId: 'podcast', categoryId: 'comedy', audience: 100_000 }),
    ]);
    const clips = fameTarget([
      make({ platformId: 'shortform', categoryId: 'comedy', audience: 100_000 }),
    ]);
    expect(podcast).toBeGreaterThan(clips);
    expect(podcast).toBe(Math.round(20 * Math.log10(1 + (100_000 * 1.3) / 1000)));
    expect(clips).toBe(Math.round(20 * Math.log10(1 + (100_000 * 0.7) / 1000)));
  });

  it('adds up across channels', () => {
    const one = fameTarget([make({ audience: 10_000 })]);
    const two = fameTarget([
      make({ audience: 10_000 }),
      make({ id: 'b', categoryId: 'comedy', audience: 10_000 }),
    ]);
    expect(two).toBeGreaterThan(one);
    expect(two).toBe(Math.round(20 * Math.log10(1 + 20_000 / 1000)));
  });

  it('climbs by half the gap, rounded up, and falls by a seventh, at least one', () => {
    expect(nextFame(0, 40)).toBe(20);
    expect(nextFame(20, 40)).toBe(30);
    expect(nextFame(39, 40)).toBe(40);
    expect(nextFame(50, 0)).toBe(43);
    expect(nextFame(3, 0)).toBe(2);
    expect(nextFame(1, 0)).toBe(0);
  });

  it('never falls below the target, and holds still at it', () => {
    expect(nextFame(41, 40)).toBe(40);
    expect(nextFame(40, 40)).toBe(40);
    expect(nextFame(100, 99)).toBe(99);
  });

  it('is slower down than up', () => {
    expect(40 - nextFame(40, 0)).toBeLessThan(nextFame(0, 40));
  });
});

describe('what a channel does to the year in the ledger', () => {
  it('counts a channel net of its upkeep as earned, so the tax rate is over what was earned', () => {
    const ledger = postAll(EMPTY_LEDGER, 2030, 20, [
      { category: 'creator', amount: dollars(1_000), source: 'A channel' },
      { category: 'creator', amount: dollars(-200), source: 'Upkeep' },
      { category: 'tax', amount: dollars(-160), source: 'Tax' },
    ]).ledger;
    expect(summariseFinances(ledger, 2030).taxRate).toBeCloseTo(0.2, 10);
  });

  it('counts a year the channel lost money as no earned income at all', () => {
    const ledger = postAll(EMPTY_LEDGER, 2030, 20, [
      { category: 'creator', amount: dollars(-200), source: 'Upkeep' },
      { category: 'tax', amount: dollars(-10), source: 'Tax' },
    ]).ledger;
    expect(summariseFinances(ledger, 2030).taxRate).toBe(0);
  });
});

describe('the age', () => {
  it('is fourteen', () => {
    expect(CREATOR_FROM_AGE).toBe(14);
  });
});

describe('a channel’s luck is its own', () => {
  it('does not follow the name it was given', () => {
    const names = findCreatorCategory('gaming')!.names;
    const sums = names.map(() => ({ total: 0, count: 0 }));
    for (let i = 0; i < 4000; i += 1) {
      const channel = newChannel({
        seed: `n${i}`,
        id: 'x',
        platformId: 'video',
        categoryId: 'gaming',
        year: 2030,
      });
      const slot = sums[names.indexOf(channel.name)]!;
      slot.total += channel.luck;
      slot.count += 1;
    }
    const all = sums.reduce((a, b) => a + b.total, 0) / sums.reduce((a, b) => a + b.count, 0);
    for (const slot of sums) {
      expect(slot.count).toBeGreaterThan(500);
      expect(slot.total / slot.count).toBeGreaterThan(all - 0.06);
      expect(slot.total / slot.count).toBeLessThan(all + 0.06);
    }
  });
});

describe('the target, to the dollar', () => {
  // The formula written out, so a constant moved in the engine moves here too.
  const expected = (channel: Channel, quality: number, year: number): number => {
    const platform = findPlatform(channel.platformId)!;
    const category = findCreatorCategory(channel.categoryId)!;
    const noise = 0.9 + 0.2 * mixedUnit(`creator:noise:${channel.id}:${year}`);
    const raw =
      (settledAudience(channel.luck, platform) *
        quality ** 2 *
        { light: 0.5, regular: 1, heavy: 1.5 }[channel.effort] *
        trendOf(channel.categoryId, year) *
        noise) /
      Math.sqrt(category.crowding);
    return (raw * platform.ceiling) / (raw + platform.ceiling);
  };

  it('matches it for every platform and a spread of makers', () => {
    for (const platform of PLATFORMS) {
      for (const categoryId of platform.categories.slice(0, 3)) {
        for (const luck of [0.3, 0.7, 0.95, 0.9999]) {
          for (const effort of EFFORTS) {
            const channel = make({ platformId: platform.id, categoryId, luck, effort });
            for (const quality of [0.7, 1, 1.4]) {
              expect(targetAudience(channel, quality, 2037)).toBeCloseTo(
                expected(channel, quality, 2037),
                6,
              );
            }
          }
        }
      }
    }
  });

  it('keeps its noise between 0.9 and 1.1 and its fashion within the category’s swing', () => {
    const channel = make({ luck: 0.7 });
    const crowd = Math.sqrt(findCreatorCategory('gaming')!.crowding);
    const settledValue = settledAudience(0.7) * findPlatform('video')!.discover;
    const noises = Array.from({ length: 300 }, (_, i) => {
      const year = 2000 + i;
      return (targetAudience(channel, 1, year) * crowd) / (settledValue * trendOf('gaming', year));
    });
    expect(Math.min(...noises)).toBeGreaterThanOrEqual(0.9 - 1e-4);
    expect(Math.max(...noises)).toBeLessThanOrEqual(1.1 + 1e-4);
    expect(Math.max(...noises) - Math.min(...noises)).toBeGreaterThan(0.15);
  });
});

describe('what is worth a line', () => {
  const PAYS = 100_000;

  it('says monetized exactly when the threshold is first reached', () => {
    expect(noteFor(999, 1_000, 1_000)).toEqual({ kind: 'monetized' });
    expect(noteFor(999, 999, 1_000)).toBeUndefined();
    expect(noteFor(1_000, 1_500, 1_000)).toBeUndefined();
    expect(noteFor(0, 5_000, 1_000)).toEqual({ kind: 'monetized' });
  });

  it('says a milestone when a mark is reached, including reaching it exactly', () => {
    expect(noteFor(999, 1_000, 500)).toEqual({ kind: 'milestone', mark: 1_000 });
    expect(noteFor(500, 1_000, 500)).toEqual({ kind: 'milestone', mark: 1_000 });
    expect(noteFor(500, 999, 500)).toBeUndefined();
  });

  it('does not say a mark again the year after it was reached', () => {
    expect(noteFor(1_000, 5_000, 100)).toBeUndefined();
    expect(noteFor(10_000, 11_000, 100)).toBeUndefined();
  });

  it('names the biggest mark passed when several are passed at once', () => {
    expect(noteFor(500, 2_000_000, 100)).toEqual({ kind: 'milestone', mark: 1_000_000 });
    expect(noteFor(0, 150, 100)).toEqual({ kind: 'monetized' });
    expect(noteFor(50, 20_000, 100)).toEqual({ kind: 'monetized' });
  });

  it('says a slump for losing over a fifth of an audience that was worth noticing', () => {
    expect(SLUMP_SHARE).toBe(0.8);
    expect(SLUMP_FROM).toBe(1_000);
    expect(noteFor(1_000, 799, PAYS)).toEqual({ kind: 'slump' });
    expect(noteFor(1_000, 800, PAYS)).toBeUndefined();
    expect(noteFor(1_000, 850, PAYS)).toBeUndefined();
    expect(noteFor(999, 100, PAYS)).toBeUndefined();
    expect(noteFor(50_000, 39_999, PAYS)).toEqual({ kind: 'slump' });
    expect(noteFor(50_000, 40_000, PAYS)).toBeUndefined();
  });

  it('says nothing for a year that was only growth', () => {
    expect(noteFor(5_000, 5_400, PAYS)).toBeUndefined();
  });
});

/* ===================== Ticket 0702 ===================== */

describe('each platform’s own curve', () => {
  const stream = findPlatform('stream')!;
  const podcast = findPlatform('podcast')!;
  const photo = findPlatform('photo')!;

  it('reads a podcast off the published download percentiles', () => {
    // Buzzsprout, July 2026: median 27, top 25% 97, top 10% 409, top 5% 1,010, top 1% 4,579.
    expect(settledAudience(1 - 0.5, podcast)).toBeCloseTo(27, 3);
    expect(settledAudience(1 - 0.25, podcast)).toBeCloseTo(97, 3);
    expect(settledAudience(1 - 0.1, podcast)).toBeCloseTo(409, 2);
    expect(settledAudience(1 - 0.05, podcast)).toBeCloseTo(1_010, 2);
    expect(settledAudience(1 - 0.01, podcast)).toBeCloseTo(4_579, 1);
  });

  it('reads a stream off the viewer figures: 5% of streamers average five viewers', () => {
    expect(settledAudience(1 - 0.05, stream)).toBeCloseTo(830, 2);
    expect(settledAudience(1 - 0.0079, stream)).toBeCloseTo(28_000, 0);
  });

  it('gives a platform without a curve of its own the video curve, scaled by how findable it is', () => {
    for (const luck of [0.2, 0.6, 0.95, 0.999]) {
      expect(settledAudience(luck, photo)).toBeCloseTo(settledAudience(luck) * photo.discover, 6);
    }
    expect(settledAudience(0.7)).toBe(settledAudience(0.7, findPlatform('video')));
  });

  it('is rising in luck on every platform', () => {
    for (const platform of PLATFORMS) {
      let last = 0;
      for (let luck = 0; luck < 1; luck += 0.002) {
        const now = settledAudience(luck, platform);
        expect(now).toBeGreaterThanOrEqual(last);
        last = now;
      }
    }
  });

  it('turns an audience back into the share of channels at least that big', () => {
    for (const platform of PLATFORMS) {
      for (const luck of [0.1, 0.5, 0.8, 0.95, 0.995, 0.9995]) {
        const people = settledAudience(luck, platform);
        expect(survivalAt(people, platform)).toBeCloseTo(1 - luck, 6);
      }
    }
  });

  it('puts everyone at the bottom of the curve at the front and the top of it at the end', () => {
    expect(survivalAt(0, podcast)).toBe(1);
    expect(survivalAt(3, podcast)).toBe(1);
    expect(survivalAt(10 ** 12, podcast)).toBe(podcast.settle!.at(-1)![0]);
    expect(survivalAt(27, podcast)).toBeCloseTo(0.5, 6);
  });
});

describe('six years of a stream and a podcast land on their published shares', () => {
  const lives = 12_000;
  const run = (platformId: string, categoryId: string, marks: readonly number[]) => {
    const counts = marks.map(() => 0);
    for (let i = 0; i < lives; i += 1) {
      let channel = sourced({ seed: `s${i}`, id: 'c', platformId, categoryId, year: 2030 });
      const quality = creatorQuality(30 + (i % 50), i % 7 === 0);
      for (let year = 0; year < 6; year += 1) {
        channel = channelYear({ channel, year: 2030 + year, quality }).channel;
      }
      marks.forEach((mark, k) => {
        if (channel.audience >= mark) counts[k]! += 1;
      });
    }
    return counts.map((count) => count / lives);
  };

  it('puts podcasts a little under the published download shares', () => {
    const [a27, a97, a409, a1010, a4579] = run('podcast', 'comedy', [27, 97, 409, 1_010, 4_579]);
    expect(a27).toBeGreaterThan(0.4);
    expect(a27).toBeLessThan(0.5);
    expect(a97).toBeGreaterThan(0.18);
    expect(a97).toBeLessThan(0.26);
    expect(a409).toBeGreaterThan(0.07);
    expect(a409).toBeLessThan(0.105);
    expect(a1010).toBeGreaterThan(0.034);
    expect(a1010).toBeLessThan(0.055);
    expect(a4579).toBeGreaterThan(0.005);
    expect(a4579).toBeLessThan(0.013);
  });

  it('puts streams a little under the published viewer shares', () => {
    const [a830, a28k] = run('stream', 'gaming', [830, 28_000]);
    expect(a830).toBeGreaterThan(0.038);
    expect(a830).toBeLessThan(0.056);
    expect(a28k).toBeGreaterThan(0.004);
    expect(a28k).toBeLessThan(0.011);
  });
});

describe('charts: #1000 to #1', () => {
  const at = (platformId: string, audience: number) =>
    chartRank({ ...make({ platformId, categoryId: 'gaming' }), audience });

  it('has no chart for a platform without one, and nobody is ranked with no audience', () => {
    expect(at('photo', 5_000_000_000)).toBeUndefined();
    expect(at('shortform', 5_000_000_000)).toBeUndefined();
    expect(at('subscription', 5_000_000_000)).toBeUndefined();
    expect(at('video', 0)).toBeUndefined();
    expect(at('nope', 5_000_000)).toBeUndefined();
  });

  it('puts the thousandth video channel near five and a half million subscribers', () => {
    expect(at('video', 4_000_000)).toBeUndefined();
    expect(at('video', 6_500_000)).toBeLessThanOrEqual(1_000);
    expect(at('video', 5_600_000)).toBeGreaterThan(900);
    expect(at('video', 5_600_000)).toBeLessThanOrEqual(1_000);
  });

  it('puts the thousandth stream near twenty-eight thousand followers and the thousandth podcast near five thousand listeners', () => {
    expect(at('stream', 20_000)).toBeUndefined();
    expect(at('stream', 29_000)).toBeLessThanOrEqual(1_000);
    expect(at('podcast', 3_500)).toBeUndefined();
    expect(at('podcast', 5_100)).toBeLessThanOrEqual(1_000);
  });

  it('can be number one on every platform that has a chart', () => {
    for (const platform of PLATFORMS.filter((p) => p.chart !== undefined)) {
      expect(at(platform.id, 10 ** 12)).toBe(1);
    }
  });

  it('only gets better with a bigger audience', () => {
    for (const id of ['video', 'stream', 'podcast']) {
      let last = Infinity;
      for (let audience = 10_000; audience < 5 * 10 ** 8; audience = Math.round(audience * 1.15)) {
        const rank = at(id, audience) ?? Infinity;
        expect(rank).toBeLessThanOrEqual(last);
        last = rank;
      }
    }
  });

  it('puts a place into the smallest tier it is inside', () => {
    expect(CHART_TIERS).toEqual([1_000, 100, 10, 1]);
    expect(CHART_SIZE).toBe(1_000);
    expect([1, 2, 10, 11, 100, 101, 1_000].map(chartTierOf)).toEqual([
      1, 10, 10, 100, 100, 1_000, 1_000,
    ]);
  });

  it('says a line the first time a channel reaches a tier, and only when it improves on its best', () => {
    expect(chartNote(undefined, undefined)).toBeUndefined();
    expect(chartNote(undefined, 1_001 as never)).toBeUndefined();
    expect(chartNote(undefined, 900)).toEqual({ kind: 'chart', tier: 1_000 });
    expect(chartNote(900, 800)).toBeUndefined();
    expect(chartNote(900, 100)).toEqual({ kind: 'chart', tier: 100 });
    expect(chartNote(100, 99)).toBeUndefined();
    expect(chartNote(100, 10)).toEqual({ kind: 'chart', tier: 10 });
    expect(chartNote(10, 1)).toEqual({ kind: 'chart', tier: 1 });
    expect(chartNote(1, 1)).toBeUndefined();
    expect(chartNote(50, 900)).toBeUndefined();
    expect(chartNote(undefined, 1)).toEqual({ kind: 'chart', tier: 1 });
  });

  it('records the best place, never loses it, and says so in the year it is reached', () => {
    const big = make({ luck: 0.9999999, audience: 5_000_000, peak: 5_000_000 });
    const first = channelYear({ channel: big, year: 2040, quality: 1.4 });
    expect(first.channel.bestRank).toBeDefined();
    expect(first.channel.bestRank!).toBeLessThanOrEqual(1_000);
    expect(first.notes.some((n) => n.kind === 'chart')).toBe(true);
    const fallen = channelYear({
      channel: { ...first.channel, luck: 0, audience: 6_000_000 },
      year: 2041,
      quality: 1,
    });
    expect(fallen.channel.audience).toBeLessThan(6_000_000);
    expect(fallen.channel.bestRank).toBeLessThanOrEqual(first.channel.bestRank!);
    expect(fallen.notes.some((n) => n.kind === 'chart')).toBe(false);
  });

  it('puts the monetized line first, the chart before a milestone, and keeps `note` as the first', () => {
    const channel = make({ luck: 0.9999999, audience: 700, peak: 700 });
    const result = channelYear({ channel, year: 2040, quality: 1.4 });
    expect(result.notes[0]).toEqual({ kind: 'monetized' });
    expect(result.note).toEqual(result.notes[0]);
    const chart = channelYear({
      channel: make({ luck: 0.9999999, audience: 4_900_000, peak: 4_900_000 }),
      year: 2040,
      quality: 1.4,
    });
    const kinds = chart.notes.map((n) => n.kind);
    expect(kinds.indexOf('chart')).toBeGreaterThanOrEqual(0);
    if (kinds.includes('milestone'))
      expect(kinds.indexOf('chart')).toBeLessThan(kinds.indexOf('milestone'));
    expect(
      channelYear({ channel: make({ luck: 0, audience: 0 }), year: 2040, quality: 1 }).notes,
    ).toEqual([]);
  });
});

describe('trends you can read', () => {
  const years = Array.from({ length: 400 }, (_, i) => 2000 + i);

  it('lasts: this year’s fashion is a good guide to next year’s', () => {
    const values = years.map((y) => trendOf('commentary', y));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    let covariance = 0;
    let variance = 0;
    for (let i = 1; i < values.length; i += 1) {
      covariance += (values[i]! - mean) * (values[i - 1]! - mean);
    }
    for (const value of values) variance += (value - mean) ** 2;
    expect(covariance / variance).toBeGreaterThan(0.35);
  });

  it('stays inside its swing and averages out to nothing', () => {
    const swing = findCreatorCategory('commentary')!.swing;
    const values = years.map((y) => trendOf('commentary', y));
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(1 - swing);
      expect(value).toBeLessThanOrEqual(1 + swing);
    }
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.97);
    expect(mean).toBeLessThan(1.03);
  });

  it('is a fixed mix of the last four years, newest first', () => {
    expect(TREND_MEMORY).toBe(4);
    expect(TREND_FADE).toBe(0.5);
    const u = (y: number) => 2 * mixedUnit(`creator:trend:gaming:${y}`) - 1;
    const expected =
      1 + 0.35 * ((u(2040) + 0.5 * u(2039) + 0.25 * u(2038) + 0.125 * u(2037)) / 1.875);
    expect(trendOf('gaming', 2040)).toBeCloseTo(expected, 10);
  });

  it('says a word that matches how far into its swing it is, at every threshold', () => {
    for (const year of years) {
      const lean = trendLean('commentary', year);
      const word = trendWord('commentary', year);
      const expected =
        lean > 0.45
          ? 'hot'
          : lean > 0.15
            ? 'warm'
            : lean >= -0.15
              ? 'steady'
              : lean >= -0.45
                ? 'cool'
                : 'cold';
      expect(word).toBe(expected);
    }
    const seen = new Set(years.map((y) => trendWord('commentary', y)));
    expect([...seen].sort()).toEqual(['cold', 'cool', 'hot', 'steady', 'warm']);
  });

  it('calls a category that barely moves steady, always, and an unknown one too', () => {
    expect(STEADY_BELOW).toBe(0.12);
    for (const year of years) {
      expect(trendWord('education', year)).toBe('steady');
      expect(trendWord('writing', year)).toBe('steady');
      expect(trendWord('nope', year)).toBe('steady');
    }
    expect(trendLean('nope', 2040)).toBe(0);
  });

  it('lists a platform’s categories hottest first, and whether each is rising', () => {
    const rows = trendsFor('video', 2040);
    expect(rows.map((r) => r.categoryId).sort()).toEqual(
      [...findPlatform('video')!.categories].sort(),
    );
    const leans = rows.map((r) => trendLean(r.categoryId, 2040));
    expect([...leans].sort((a, b) => b - a)).toEqual(leans);
    for (const row of rows) {
      expect(row.word).toBe(trendWord(row.categoryId, 2040));
      expect(row.rising).toBe(trendOf(row.categoryId, 2040) > trendOf(row.categoryId, 2039));
    }
    expect(trendsFor('nope', 2040)).toEqual([]);
    expect(
      trendsFor('podcast', 2040).every((r) =>
        findPlatform('podcast')!.categories.includes(r.categoryId),
      ),
    ).toBe(true);
  });
});

describe('what a channel asks of a week', () => {
  it('is two hours, five and nine, and adds up across channels', () => {
    expect(EFFORT_HOURS).toEqual({ light: 2, regular: 5, heavy: 9 });
    expect(creatorHours([])).toBe(0);
    expect(
      creatorHours([
        make({ effort: 'light' }),
        make({ id: 'b', effort: 'heavy' }),
        make({ id: 'c' }),
      ]),
    ).toBe(16);
  });
});

describe('the places a chart gives, to the unit', () => {
  const at = (platformId: string, audience: number) =>
    chartRank({ ...make({ platformId, categoryId: 'gaming' }), audience });

  it('rounds a place up from the share, so a fraction of a place is the next place', () => {
    for (const id of ['video', 'stream', 'podcast']) {
      const platform = findPlatform(id)!;
      for (const audience of [200_000, 1_000_000, 3_000_000]) {
        const exact = platform.chart! * survivalAt(audience, platform);
        const rank = chartRank({ ...make({ platformId: id }), audience });
        if (rank === undefined) continue;
        expect(rank).toBeGreaterThanOrEqual(exact);
        expect(rank - exact).toBeLessThan(1);
      }
    }
  });

  it('ends exactly at place one thousand, and the next audience down is off the chart', () => {
    for (const id of ['video', 'stream', 'podcast']) {
      let low = 1;
      let high = 10 ** 9;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (at(id, mid) === undefined) low = mid;
        else high = mid;
      }
      expect(at(id, high)).toBe(CHART_SIZE);
      expect(at(id, low)).toBeUndefined();
    }
  });
});

describe('what the best place remembers', () => {
  it('keeps a better place after a worse one, and after falling off the chart', () => {
    const channel = make({
      luck: 0,
      audience: 30_000_000,
      peak: 30_000_000,
      bestRank: 5,
    });
    const worse = channelYear({ channel, year: 2040, quality: 1 });
    expect(chartRank(worse.channel)).toBeGreaterThan(5);
    expect(worse.channel.bestRank).toBe(5);
    const gone = channelYear({
      channel: make({ luck: 0, audience: 1_000, bestRank: 40 }),
      year: 2040,
      quality: 1,
    });
    expect(chartRank(gone.channel)).toBeUndefined();
    expect(gone.channel.bestRank).toBe(40);
  });

  it('takes a better place when it gets one', () => {
    const better = channelYear({
      channel: make({ luck: 0.9999999, audience: 5_000_000, peak: 5_000_000, bestRank: 900 }),
      year: 2040,
      quality: 1.4,
    });
    expect(better.channel.bestRank!).toBeLessThan(900);
    expect(better.channel.bestRank).toBe(chartRank(better.channel));
  });

  it('says the monetized line once, however the year is told', () => {
    const result = channelYear({
      channel: make({ luck: 0.9999999, audience: 700, peak: 700 }),
      year: 2040,
      quality: 1.4,
    });
    expect(result.notes.filter((n) => n.kind === 'monetized')).toHaveLength(1);
  });
});

describe('the words for a fashion, at their edges', () => {
  it('is hot above 0.45, warm above 0.15, steady to -0.15, cool to -0.45, and cold below', () => {
    expect([1, 0.46, 0.45, 0.16, 0.15, 0, -0.15, -0.16, -0.45, -0.46, -1].map(leanWord)).toEqual([
      'hot',
      'hot',
      'warm',
      'warm',
      'steady',
      'steady',
      'steady',
      'cool',
      'cool',
      'cold',
      'cold',
    ]);
  });
});

describe('a curve of its own is read as it is written', () => {
  it('does not scale a platform’s own curve by how hard it is to be found', () => {
    const own = findPlatform('stream')!;
    const harder = { ...own, discover: 2 };
    for (const luck of [0.1, 0.5, 0.9, 0.999]) {
      expect(settledAudience(luck, harder)).toBe(settledAudience(luck, own));
    }
    for (const audience of [10, 500, 50_000]) {
      expect(survivalAt(audience, harder)).toBe(survivalAt(audience, own));
    }
  });
});

describe('paying readers (0703)', () => {
  const sub = (categoryId: string, audience = 10_000, over: Partial<Channel> = {}): Channel =>
    make({ platformId: 'subscription', categoryId, audience, ...over });
  const incomes = (categoryId: string) => tierIncomes(sub(categoryId)).map((row) => row.income);

  it('has three prices and keeps four in ten of its payers a year', () => {
    expect(PAID_TIERS).toEqual(['low', 'standard', 'premium']);
    expect(TIER_PRICE).toEqual({ low: 5, standard: 8, premium: 15 });
    expect(PAID_RETENTION).toBe(0.4);
    expect(CONVERSION_FALLOFF).toBe(0.25);
    expect(CONVERSION_FLOOR).toBe(0.4);
  });

  it('pays out what each price earns on ten thousand readers, after the platform’s cut', () => {
    expect(incomes('education')).toEqual([27_240, 33_342, 33_463]);
    expect(incomes('business')).toEqual([30_081, 39_078, 45_063]);
    expect(incomes('music')).toEqual([17_431, 16_322, 8_768]);
    expect(incomes('lifestyle')).toEqual([22_785, 25_056, 19_584]);
    expect(memberIncome(100, 'standard')).toBe(8_352);
    expect(memberIncome(100, 'premium')).toBe(15_660);
    expect(memberIncome(0, 'low')).toBe(0);
  });

  it('makes the best price depend on what the category will pay', () => {
    const best = (categoryId: string) => {
      const rows = tierIncomes(sub(categoryId));
      return rows.reduce((a, b) => (b.income > a.income ? b : a)).tier;
    };
    expect(best('business')).toBe('premium');
    expect(best('music')).toBe('low');
    expect(best('lifestyle')).toBe('standard');
    expect(tierIncomes(sub('nope'))).toEqual([]);
  });

  it('converts three in a hundred at the usual price on ten thousand, and fewer on a bigger list', () => {
    const lifestyle = findCreatorCategory('lifestyle')!;
    expect(paidShare(10_000, 'standard', lifestyle)).toBeCloseTo(0.03, 12);
    expect(paidShare(100_000, 'standard', lifestyle) / 0.03).toBeCloseTo(0.75, 12);
    expect(paidShare(1_000_000, 'standard', lifestyle) / 0.03).toBeCloseTo(0.5, 12);
    expect(paidShare(10 ** 9, 'standard', lifestyle) / 0.03).toBeCloseTo(0.4, 12);
    // A small list converts as ten thousand does, not better.
    expect(paidShare(500, 'standard', lifestyle)).toBeCloseTo(0.03, 12);
    expect(paidShare(0, 'standard', lifestyle)).toBeCloseTo(0.03, 12);
  });

  it('moves the paying readers toward the share, keeping four in ten of the old ones', () => {
    const lifestyle = findCreatorCategory('lifestyle')!;
    expect(paidNext(0, 10_000, 'standard', lifestyle)).toBe(180);
    expect(paidNext(1_000, 0, 'standard', lifestyle)).toBe(400);
    expect(paidNext(300, 10_000, 'standard', lifestyle)).toBe(300);
    expect(paidNext(1_000, 10_000, 'standard', lifestyle)).toBe(580);
  });

  it('starts a year with nobody paying, pays on the average of the year, and so earns less than a settled list', () => {
    const channel = sub('lifestyle', 5_000, { luck: 0.9999, effort: 'regular' });
    const year = channelYear({ channel, year: 2040, quality: 1 });
    const lifestyle = findCreatorCategory('lifestyle')!;
    expect(year.channel.paid).toBe(paidNext(0, year.channel.audience, 'standard', lifestyle));
    const average = Math.round((5_000 + year.channel.audience) / 2);
    expect(average).toBeGreaterThanOrEqual(100);
    expect(Number(year.income)).toBe(memberIncome(year.channel.paid! / 2, 'standard') * 100);
    expect(Number(year.income) / 100).toBeLessThan(
      channelIncome(findPlatform('subscription')!, lifestyle, average, 'regular'),
    );
  });

  it('prices a year at the tier the channel is set to', () => {
    const base = sub('business', 20_000, { luck: 0.9999, paid: 400 });
    const standard = channelYear({ channel: base, year: 2040, quality: 1 });
    const premium = channelYear({ channel: { ...base, tier: 'premium' }, year: 2040, quality: 1 });
    expect(Number(premium.income)).not.toBe(Number(standard.income));
    const business = findCreatorCategory('business')!;
    expect(premium.channel.paid).toBe(paidNext(400, premium.channel.audience, 'premium', business));
    expect(Number(premium.income)).toBe(
      memberIncome((400 + premium.channel.paid!) / 2, 'premium') * 100,
    );
  });

  it('keeps building paying readers below the threshold without paying anything', () => {
    const channel = sub('lifestyle', 40, { luck: 0.05, effort: 'regular' });
    const year = channelYear({ channel, year: 2040, quality: 1 });
    expect(year.channel.audience).toBeLessThan(100);
    expect(Number(year.income)).toBe(0);
    expect(year.channel.paid).toBeDefined();
  });

  it('loses payers more slowly than readers, then keeps losing them: the hump', () => {
    const channel = sub('lifestyle', 100_000, { luck: 0, paid: 3_000, effort: 'regular' });
    const year = channelYear({ channel, year: 2040, quality: 0.6 });
    const lifestyle = findCreatorCategory('lifestyle')!;
    expect(year.channel.audience).toBeLessThan(100_000);
    const target = year.channel.audience * paidShare(year.channel.audience, 'standard', lifestyle);
    expect(year.channel.paid!).toBeLessThan(3_000);
    expect(year.channel.paid!).toBeGreaterThan(target);
  });

  it('leaves the other platforms with no paying readers', () => {
    const year = channelYear({ channel: make({ audience: 5_000 }), year: 2040, quality: 1 });
    expect(year.channel.paid).toBeUndefined();
  });
});

describe('going viral (0703)', () => {
  const ids = Array.from({ length: 20_000 }, (_, i) => `ch:${2030 + (i % 50)}:v:${i}`);
  const rate = (platformId: string, effort: 'light' | 'regular' | 'heavy', quality: number) =>
    ids.filter(
      (id) =>
        viralGain(make({ id, platformId, effort, audience: 10_000 }), quality, 2040, 10_000) > 0,
    ).length / ids.length;

  it('happens only where a platform allows it', () => {
    for (const platformId of ['video', 'stream', 'podcast', 'subscription']) {
      expect(rate(platformId, 'heavy', 1.4)).toBe(0);
    }
  });

  it('is about one short-form channel in eight a year and one photo channel in twenty-five', () => {
    expect(rate('shortform', 'regular', 1)).toBeGreaterThan(0.11);
    expect(rate('shortform', 'regular', 1)).toBeLessThan(0.13);
    expect(rate('photo', 'regular', 1)).toBeGreaterThan(0.035);
    expect(rate('photo', 'regular', 1)).toBeLessThan(0.045);
  });

  it('is likelier with more effort and with better work', () => {
    expect(VIRAL_EFFORT).toEqual({ light: 0.5, regular: 1, heavy: 1.6 });
    expect(rate('shortform', 'light', 1)).toBeGreaterThan(0.05);
    expect(rate('shortform', 'light', 1)).toBeLessThan(0.07);
    expect(rate('shortform', 'heavy', 1)).toBeGreaterThan(0.18);
    expect(rate('shortform', 'heavy', 1)).toBeLessThan(0.205);
    expect(rate('shortform', 'regular', 1.2)).toBeGreaterThan(0.16);
    expect(rate('shortform', 'regular', 1.2)).toBeLessThan(0.185);
  });

  it('brings between a fifth and the whole of the surge, on at least a small base', () => {
    expect(VIRAL_BASE).toBe(500);
    const gains = (audience: number) =>
      ids
        .map((id) =>
          viralGain(make({ id, platformId: 'shortform', audience }), 1.4, 2040, audience),
        )
        .filter((gain) => gain > 0);
    for (const [audience, base] of [
      [0, 500],
      [100_000, 100_000],
    ] as const) {
      const found = gains(audience);
      expect(found.length).toBeGreaterThan(100);
      expect(Math.min(...found)).toBeGreaterThanOrEqual(Math.round(base * 3 * 0.2));
      expect(Math.max(...found)).toBeLessThanOrEqual(base * 3);
      expect(Math.max(...found) - Math.min(...found)).toBeGreaterThan(base * 3 * 0.5);
      // Across 20,000 channels the smallest is close to a fifth of the surge and the biggest close to all of it.
      expect(Math.min(...found)).toBeLessThan(base * 3 * 0.23);
      expect(Math.max(...found)).toBeGreaterThan(base * 3 * 0.97);
    }
  });

  it('never carries a platform past its ceiling', () => {
    const ceiling = findPlatform('shortform')!.ceiling;
    const found = ids
      .map((id) =>
        viralGain(
          make({ id, platformId: 'shortform', audience: ceiling - 10 }),
          1.4,
          2040,
          ceiling - 10,
        ),
      )
      .filter((gain) => gain > 0);
    expect(found.length).toBeGreaterThan(0);
    expect(Math.max(...found)).toBeLessThanOrEqual(10);
  });

  it('is the same on every ask, and a different draw in a different year', () => {
    const channel = make({ platformId: 'shortform', audience: 10_000 });
    const a = Array.from({ length: 300 }, (_, i) => viralGain(channel, 1.4, 2000 + i, 10_000));
    const b = Array.from({ length: 300 }, (_, i) => viralGain(channel, 1.4, 2000 + i, 10_000));
    expect(a).toEqual(b);
    expect(a.filter((gain) => gain > 0).length).toBeGreaterThan(5);
    expect(a.filter((gain) => gain === 0).length).toBeGreaterThan(5);
  });

  const scan = (platformId: string, wantViral: boolean, audience = 10_000) => {
    for (let i = 0; i < 400; i += 1) {
      const channel = make({ id: `ch:2030:${platformId}:t${i}`, platformId, audience, luck: 0.5 });
      if (viralGain(channel, 1, 2040, audience) > 0 === wantViral) return channel;
    }
    throw new Error('none found');
  };

  it('says so in the year it happens and remembers the year', () => {
    // Look for a year in which the audience that `nextAudience` gives is the one the draw is made against.
    for (let i = 0; i < 400; i += 1) {
      const channel = make({
        id: `ch:2030:shortform:y${i}`,
        platformId: 'shortform',
        audience: 20_000,
        luck: 0.5,
      });
      const year = channelYear({ channel, year: 2040, quality: 1 });
      const note = year.notes.find((n) => n.kind === 'viral');
      if (note === undefined) {
        expect(year.channel.viralYear).toBeUndefined();
        continue;
      }
      expect(year.channel.viralYear).toBe(2040);
      expect(year.notes.indexOf(note)).toBeLessThanOrEqual(1);
      if (note.kind === 'viral') {
        expect(note.gained).toBeGreaterThan(0);
        const drifted = nextAudience(channel, targetAudience(channel, 1, 2040));
        expect(year.channel.audience).toBe(drifted + note.gained);
      }
      return;
    }
    throw new Error('no viral year in 400 channels');
  });

  it('puts the monetized line before the viral one', () => {
    for (let i = 0; i < 2_000; i += 1) {
      const channel = make({
        id: `ch:2030:shortform:m${i}`,
        platformId: 'shortform',
        audience: 9_500,
        luck: 0.99,
      });
      const kinds = channelYear({ channel, year: 2040, quality: 1.3 }).notes.map((n) => n.kind);
      if (kinds.includes('viral') && kinds.includes('monetized')) {
        expect(kinds.indexOf('monetized')).toBeLessThan(kinds.indexOf('viral'));
        return;
      }
    }
    throw new Error('no year with both');
  });

  it('does not call the fall after a post took off a slump, but still calls any other one', () => {
    const quiet = scan('shortform', false, 100_000);
    const fallen = { ...quiet, luck: 0, audience: 100_000, peak: 100_000 };
    const after = channelYear({
      channel: { ...fallen, viralYear: 2039 },
      year: 2040,
      quality: 0.6,
    });
    expect(after.channel.audience).toBeLessThan(80_000);
    expect(after.notes.some((n) => n.kind === 'slump')).toBe(false);
    for (const viralYear of [undefined, 2038, 2040]) {
      const other = channelYear({
        channel: { ...fallen, ...(viralYear === undefined ? {} : { viralYear }) },
        year: 2040,
        quality: 0.6,
      });
      expect(other.notes.some((n) => n.kind === 'slump')).toBe(true);
    }
  });

  it('raises the income of the year with the audience it brings', () => {
    const channel = scan('shortform', true, 50_000);
    const quiet = scan('shortform', false, 50_000);
    const withPost = channelYear({ channel, year: 2040, quality: 1 });
    const without = channelYear({
      channel: { ...quiet, audience: 50_000 },
      year: 2040,
      quality: 1,
    });
    expect(Number(withPost.income)).toBeGreaterThan(Number(without.income));
  });
});

describe('paying from the threshold (0703)', () => {
  it('starts paying exactly at the platform’s threshold', () => {
    for (const platform of PLATFORMS) {
      expect(paysFrom(platform, platform.paysAt - 1)).toBe(false);
      expect(paysFrom(platform, platform.paysAt)).toBe(true);
    }
  });

  it('prices a settled list at the tier it is asked for', () => {
    const platform = findPlatform('subscription')!;
    const business = findCreatorCategory('business')!;
    const at = (tier: 'low' | 'standard' | 'premium') =>
      channelIncome(platform, business, 10_000, 'regular', tier);
    expect([at('low'), at('standard'), at('premium')]).toEqual([30_081, 39_078, 45_063]);
    expect(channelIncome(platform, business, 10_000, 'regular')).toBe(at('standard'));
  });
});

describe('0706 — a player is not an average channel', () => {
  it('lifts a draw in rank by the amount it says, exactly', () => {
    // Half of channels do better than this one; with a lift of 2 it is a quarter.
    expect(liftedLuck(0.5, 2)).toBeCloseTo(0.75, 12);
    // A tenth do better: the lift is 1 + (2 - 1) × (0.1 ÷ 0.25) = 1.4.
    expect(liftedLuck(0.9, 2)).toBeCloseTo(1 - 0.1 / 1.4, 12);
    // Above a quarter the whole lift applies.
    expect(liftedLuck(0.2, 3)).toBeCloseTo(1 - 0.8 / 3, 12);
    expect(liftedLuck(0, 2)).toBeCloseTo(0.5, 12);
    expect(liftedLuck(0.75, 3)).toBeCloseTo(1 - 0.25 / 3, 12);
  });

  it('is nothing at a lift of one, never lowers a draw, and keeps order', () => {
    let previous = -1;
    for (let draw = 0; draw <= 1; draw += 0.01) {
      expect(liftedLuck(draw, 1)).toBeCloseTo(draw, 12);
      const lifted = liftedLuck(draw, 3);
      expect(lifted).toBeGreaterThanOrEqual(draw - 1e-12);
      expect(lifted).toBeGreaterThanOrEqual(previous);
      expect(lifted).toBeLessThanOrEqual(1);
      expect(lifted).toBeGreaterThanOrEqual(0);
      previous = lifted;
    }
  });

  it('barely touches the very top', () => {
    expect(liftedLuck(0.9999, 3)).toBeCloseTo(0.9999, 4);
    expect(liftedLuck(0.999999, 3)).toBeCloseTo(0.999999, 6);
    // The best one channel in a hundred moves to about one in 108, at the greatest lift there is.
    expect(1 - liftedLuck(0.99, 3)).toBeCloseTo(0.01 / 1.08, 10);
  });

  it('uses the platform’s own lift, and the default when it has none', () => {
    expect({
      LUCK_LIFT,
      LUCK_LIFT_BELOW,
      video: findPlatform('video')!.lift,
      stream: findPlatform('stream')!.lift,
      photo: findPlatform('photo')!.lift,
      shortform: findPlatform('shortform')!.lift,
      podcast: findPlatform('podcast')!.lift,
      subscription: findPlatform('subscription')!.lift,
    }).toEqual({
      LUCK_LIFT: 1.5,
      LUCK_LIFT_BELOW: 0.25,
      video: 1.5,
      stream: 2.5,
      photo: 1.5,
      shortform: 2,
      podcast: 2.5,
      subscription: 1.2,
    });
    expect(liftedLuck(0.5)).toBeCloseTo(liftedLuck(0.5, 1.5), 12);
  });

  it('makes a player’s channel likelier to be paid than the published share, by about what was meant', () => {
    const shares = (platformId: string, categoryId: string, mode: 'sourced' | 'player') => {
      const lives = 6_000;
      let monetized = 0;
      let top = 0;
      const platform = findPlatform(platformId)!;
      for (let i = 0; i < lives; i += 1) {
        const base = newChannel({ seed: `lift${i}`, id: 'c', platformId, categoryId, year: 2030 });
        let channel = mode === 'sourced' ? { ...base, luck: luckDraw(`lift${i}`, 'c') } : base;
        const quality = creatorQuality(30 + (i % 50), i % 7 === 0);
        for (let year = 0; year < 6; year += 1) {
          channel = channelYear({ channel, year: 2030 + year, quality }).channel;
        }
        if (channel.audience >= platform.paysAt) monetized += 1;
        if (channel.audience >= platform.paysAt * 1_000) top += 1;
      }
      return { monetized: monetized / lives, top: top / lives };
    };
    for (const [platformId, categoryId, low, high] of [
      ['video', 'education', 1.3, 1.8],
      ['stream', 'gaming', 1.9, 3],
      ['shortform', 'comedy', 1.5, 2.6],
      ['podcast', 'comedy', 1.4, 2.4],
    ] as const) {
      const sourced = shares(platformId, categoryId, 'sourced');
      const player = shares(platformId, categoryId, 'player');
      expect(player.monetized / sourced.monetized, platformId).toBeGreaterThan(low);
      expect(player.monetized / sourced.monetized, platformId).toBeLessThan(high);
      // The top is not inflated: a thousand times the paying threshold is as rare as before.
      expect(player.top, platformId).toBeLessThan(sourced.top * 1.5 + 0.002);
    }
  });
});
