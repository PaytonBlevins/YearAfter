/**
 * Ticket 0702 acceptance tests — sponsorship offers (finance side).
 */

import { describe, expect, it } from 'vitest';
import { PLATFORMS, SPONSOR_BRANDS, findCreatorCategory, findPlatform } from '@yearafter/content';
import { cents, mixedUnit } from '@yearafter/core';
import { channelYear, newChannel, type Channel } from './creators';
import {
  BRAND_CAMPAIGN_POSTS,
  BRAND_CAMPAIGN_PREMIUM,
  CAMPAIGN_CLIPS,
  CLIP_CAMPAIGN_CPM,
  CLIP_VIEWS_PER_FOLLOWER,
  FLIGHT_EPISODES,
  ISSUE_CPM,
  SPONSORED_ISSUES,
  MAX_SPONSOR_OFFERS,
  MIN_SPONSOR_PAY,
  MORE_CHANCE,
  MORE_RAISE,
  answerSponsor,
  brandInterest,
  sponsorOffersFor,
  sponsorPay,
  worthOffering,
} from './sponsorships';

const make = (over: Partial<Channel> = {}): Channel => ({
  ...newChannel({
    seed: 'seed',
    id: 'ch:2040:video:gaming',
    platformId: 'video',
    categoryId: 'gaming',
    year: 2040,
  }),
  ...over,
});

describe('how much a brand wants a channel', () => {
  it('wants nothing under the paying threshold and a third of the time on it', () => {
    expect(brandInterest(999, 1_000)).toBe(0);
    expect(brandInterest(1_000, 1_000)).toBeCloseTo(0.35, 10);
  });

  it('wants a channel ten times over the threshold half the time, and never more than nine times in ten', () => {
    expect(brandInterest(10_000, 1_000)).toBeCloseTo(0.5, 10);
    expect(brandInterest(100_000, 1_000)).toBeCloseTo(0.65, 10);
    expect(brandInterest(1_000_000_000, 1_000)).toBe(0.9);
  });
});

describe('what a deal pays', () => {
  it('pins each platform at a known audience (gaming pays 0.8)', () => {
    expect(sponsorPay(make({ audience: 100_000 }), 1)).toBe(2_400);
    expect(sponsorPay(make({ audience: 1_000_000 }), 1)).toBe(24_000);
    expect(sponsorPay(make({ platformId: 'stream', audience: 100_000 }), 1)).toBe(21_600);
    expect(
      sponsorPay(make({ platformId: 'podcast', categoryId: 'comedy', audience: 5_000 }), 1),
    ).toBe(900);
    expect(FLIGHT_EPISODES).toBe(8);
  });

  it('moves with the rate the brand offers and the category', () => {
    expect(sponsorPay(make({ audience: 100_000 }), 1.4)).toBe(3_360);
    expect(sponsorPay(make({ audience: 100_000 }), 0.6)).toBe(1_440);
    expect(sponsorPay(make({ audience: 100_000, categoryId: 'tech' }), 1)).toBe(4_500);
  });

  it('is nothing on a platform it is not sold on, or one it does not know', () => {
    expect(sponsorPay(make({ platformId: 'nope', audience: 1e6 }), 1)).toBe(0);
    expect(sponsorPay(make({ categoryId: 'nope', audience: 1e6 }), 1)).toBe(0);
  });
});

describe('the offers on the table', () => {
  const big = make({ audience: 400_000 });
  const offers = (channel: Channel, year = 2040, seed = 'seed') =>
    sponsorOffersFor({ seed, year, channel });

  it('is the same every time for the same year and seed, and different from year to year', () => {
    expect(offers(big)).toEqual(offers(big));
    const across = Array.from({ length: 30 }, (_, i) => JSON.stringify(offers(big, 2040 + i)));
    expect(new Set(across).size).toBeGreaterThan(5);
  });

  it('is nothing for a channel under its threshold, or on a platform that does not exist', () => {
    expect(offers(make({ audience: 999 }))).toEqual([]);
    for (const year of Array.from({ length: 40 }, (_, i) => 2040 + i)) {
      expect(offers(make({ platformId: 'nope', audience: 1e6 }), year)).toEqual([]);
    }
  });

  it('is at most two, with ids that name the year, the channel and the slot', () => {
    for (let year = 2040; year < 2140; year += 1) {
      const found = offers(big, year);
      expect(found.length).toBeLessThanOrEqual(MAX_SPONSOR_OFFERS);
      for (const offer of found) {
        expect(offer.id).toMatch(new RegExp(`^sp:${year}:${big.id}:[01]$`));
        expect(offer.channelId).toBe(big.id);
        expect(offer.pay).toBeGreaterThanOrEqual(MIN_SPONSOR_PAY);
        expect(SPONSOR_BRANDS.gaming).toContain(offer.brand);
        expect(offer.monetization).toBe('ads');
      }
      expect(new Set(found.map((o) => o.id)).size).toBe(found.length);
    }
  });

  it('pays between 0.6 and 1.4 of the going rate', () => {
    const rates = Array.from({ length: 200 }, (_, i) => offers(big, 2000 + i)).flat();
    expect(rates.length).toBeGreaterThan(50);
    const base = sponsorPay(big, 1);
    for (const offer of rates) {
      expect(offer.pay).toBeGreaterThanOrEqual(Math.round(base * 0.6) - 1);
      expect(offer.pay).toBeLessThanOrEqual(Math.round(base * 1.4) + 1);
    }
    const pays = rates.map((o) => o.pay);
    expect(Math.max(...pays) - Math.min(...pays)).toBeGreaterThan(base * 0.4);
  });

  it('offers a bigger channel offers more often', () => {
    const count = (audience: number) =>
      Array.from({ length: 400 }, (_, i) => offers(make({ audience }), 2000 + i)).flat().length;
    expect(count(5_000_000)).toBeGreaterThan(count(20_000) * 1.3);
  });

  it('does not offer again what has been answered, but still offers the other', () => {
    let year = 2040;
    let found = offers(big, year);
    while (found.length < 2) {
      year += 1;
      found = offers(big, year);
    }
    const after = offers({ ...big, answered: [found[0]!.id] }, year);
    expect(after.map((o) => o.id)).toEqual([found[1]!.id]);
    expect(offers({ ...big, answered: found.map((o) => o.id) }, year)).toEqual([]);
  });

  it('is different for a different seed', () => {
    const a = Array.from({ length: 30 }, (_, i) => JSON.stringify(offers(big, 2040 + i, 'a')));
    const b = Array.from({ length: 30 }, (_, i) => JSON.stringify(offers(big, 2040 + i, 'b')));
    expect(a).not.toEqual(b);
  });

  it('drops a deal too small to bother with', () => {
    // 1,000 video subscribers at the worst rate is a few dozen dollars.
    const small = make({ audience: 1_000 });
    expect(sponsorPay(small, 1.4)).toBeLessThan(50);
    for (let year = 2040; year < 2140; year += 1) expect(offers(small, year)).toEqual([]);
  });

  it('offers a podcast a run of host-read ads and a stream a sponsored stream', () => {
    const podcast = make({ platformId: 'podcast', categoryId: 'comedy', audience: 8_000 });
    const found = Array.from({ length: 100 }, (_, i) => offers(podcast, 2040 + i)).flat();
    expect(found.length).toBeGreaterThan(20);
    expect(new Set(found.map((o) => o.monetization))).toEqual(new Set(['sponsors']));
    const stream = make({ platformId: 'stream', audience: 50_000 });
    const streamed = Array.from({ length: 100 }, (_, i) => offers(stream, 2040 + i)).flat();
    expect(new Set(streamed.map((o) => o.monetization))).toEqual(new Set(['live']));
  });
});

describe('answering', () => {
  const channel = make({ audience: 400_000 });
  const offer = {
    id: 'sp:2040:ch:2040:video:gaming:0',
    channelId: channel.id,
    brand: 'Voltline Peripherals',
    pay: 1_000,
    monetization: 'ads',
  };
  const answer = (a: 'accept' | 'more' | 'decline', c: Channel = channel, seed = 'seed') =>
    answerSponsor({ seed, channel: c, offer, answer: a });

  it('declining costs nothing and is remembered', () => {
    const result = answer('decline');
    expect(result.outcome).toBe('passed');
    expect(result.pay).toBe(0);
    expect(result.channel.audience).toBe(400_000);
    expect(result.channel.owed).toBeUndefined();
    expect(result.channel.answered).toEqual([offer.id]);
  });

  it('accepting books the money for the year and costs some of the audience’s trust', () => {
    const result = answer('accept');
    expect(result.outcome).toBe('taken');
    expect(result.pay).toBe(1_000);
    expect(Number(result.channel.owed)).toBe(100_000);
    expect(result.channel.audience).toBe(
      Math.round(400_000 * (1 - findPlatform('video')!.trustCost)),
    );
    expect(result.channel.audience).toBe(394_000);
    expect(result.channel.answered).toEqual([offer.id]);
  });

  it('costs a podcast less trust than a video or a stream', () => {
    expect(findPlatform('podcast')!.trustCost).toBeLessThan(findPlatform('video')!.trustCost);
    const podcast = make({ platformId: 'podcast', categoryId: 'comedy', audience: 10_000 });
    const result = answerSponsor({
      seed: 's',
      channel: podcast,
      offer: { ...offer, channelId: podcast.id, monetization: 'sponsors' },
      answer: 'accept',
    });
    expect(result.channel.audience).toBe(9_950);
    const stream = make({ platformId: 'stream', audience: 10_000 });
    expect(
      answerSponsor({
        seed: 's',
        channel: stream,
        offer: { ...offer, monetization: 'live' },
        answer: 'accept',
      }).channel.audience,
    ).toBe(9_850);
  });

  it('adds to what is already owed and to what has already been answered', () => {
    const first = answer('accept');
    const second = answerSponsor({
      seed: 'seed',
      channel: first.channel,
      offer: { ...offer, id: 'sp:2040:ch:2040:video:gaming:1', pay: 500 },
      answer: 'accept',
    });
    expect(Number(second.channel.owed)).toBe(150_000);
    expect(second.channel.answered).toHaveLength(2);
  });

  it('asking for more works about as often as the table says, and raises the pay by 60% when it does', () => {
    let worked = 0;
    const trials = 2_000;
    for (let i = 0; i < trials; i += 1) {
      const result = answer('more', channel, `seed${i}`);
      if (result.outcome === 'raised') {
        worked += 1;
        expect(result.pay).toBe(Math.round(1_000 * (1 + MORE_RAISE)));
        expect(result.pay).toBe(1_600);
        expect(Number(result.channel.owed)).toBe(160_000);
        expect(result.channel.audience).toBe(394_000);
      } else {
        expect(result.outcome).toBe('walked');
        expect(result.pay).toBe(0);
        expect(result.channel.owed).toBeUndefined();
        expect(result.channel.audience).toBe(400_000);
      }
      expect(result.channel.answered).toEqual([offer.id]);
    }
    expect(MORE_CHANCE).toBe(0.65);
    expect(worked / trials).toBeGreaterThan(0.61);
    expect(worked / trials).toBeLessThan(0.69);
  });

  it('settles asking for more by the draw alone: the same seed gives the same answer', () => {
    for (let i = 0; i < 20; i += 1) {
      expect(answer('more', channel, `s${i}`)).toEqual(answer('more', channel, `s${i}`));
      const wins = mixedUnit(`s${i}:sponsor-more:${offer.id}`) < MORE_CHANCE;
      expect(answer('more', channel, `s${i}`).outcome).toBe(wins ? 'raised' : 'walked');
    }
  });

  it('does not change the channel it was given', () => {
    const copy = JSON.stringify(channel);
    answer('accept');
    answer('more');
    answer('decline');
    expect(JSON.stringify(channel)).toBe(copy);
  });
});

describe('being paid', () => {
  it('adds what is owed to the year’s income, once, and clears it with the answers', () => {
    const owing = make({
      luck: 0.9,
      audience: 50_000,
      owed: cents(250_000),
      answered: ['sp:x'],
    });
    const plain = channelYear({
      channel: { ...owing, owed: undefined, answered: undefined },
      year: 2040,
      quality: 1,
    });
    const paid = channelYear({ channel: owing, year: 2040, quality: 1 });
    expect(Number(paid.income) - Number(plain.income)).toBe(250_000);
    expect(paid.channel.owed).toBeUndefined();
    expect(paid.channel.answered).toBeUndefined();
    expect(Number(paid.channel.earned)).toBe(Number(plain.channel.earned) + 250_000);
    const next = channelYear({ channel: paid.channel, year: 2041, quality: 1 });
    expect(next.channel.owed).toBeUndefined();
  });

  it('pays a deal even in a year the channel itself pays nothing', () => {
    const quiet = make({ luck: 0, audience: 0, owed: cents(10_000) });
    expect(Number(channelYear({ channel: quiet, year: 2040, quality: 1 }).income)).toBe(10_000);
  });
});

it('knows every brand it can offer', () => {
  for (const id of Object.keys(SPONSOR_BRANDS)) {
    expect(findCreatorCategory(id)).toBeDefined();
    expect(SPONSOR_BRANDS[id]!.length).toBeGreaterThanOrEqual(3);
  }
  for (const category of ['gaming', 'comedy', 'education', 'truecrime']) {
    expect(SPONSOR_BRANDS[category]).toBeDefined();
  }
});

describe('what is worth offering', () => {
  it('is fifty dollars and up', () => {
    expect(MIN_SPONSOR_PAY).toBe(50);
    expect(worthOffering(49)).toBe(false);
    expect(worthOffering(50)).toBe(true);
    expect(worthOffering(51)).toBe(true);
  });

  it('picks the brand on its own draw, not the one that sets the rate', () => {
    const seed = 'seed';
    const channel = make({ audience: 400_000 });
    let checked = 0;
    for (let year = 2030; year < 2230 && checked < 12; year += 1) {
      for (const offer of sponsorOffersFor({ seed, year, channel })) {
        const slot = Number(offer.id.split(':').pop());
        const key = `${seed}:sponsor:${channel.id}:${year}:${slot}`;
        const brands = SPONSOR_BRANDS[channel.categoryId]!;
        expect(offer.brand).toBe(brands[Math.floor(mixedUnit(`${key}:brand`) * brands.length)]);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(12);
  });
});

describe('deals on the other three platforms (0703)', () => {
  const on = (platformId: string, categoryId: string, audience: number) =>
    make({ platformId, categoryId, audience });

  it('pays a photo channel for four posts at one and a half times the going rate', () => {
    expect(BRAND_CAMPAIGN_POSTS).toBe(4);
    expect(BRAND_CAMPAIGN_PREMIUM).toBe(1.5);
    // 100,000 followers: $1,300 a post at the going rate, times six.
    expect(sponsorPay(on('photo', 'lifestyle', 100_000), 1)).toBe(7_800);
    expect(sponsorPay(on('photo', 'lifestyle', 1_000_000), 1)).toBe(96_000);
    expect(sponsorPay(on('photo', 'lifestyle', 100_000), 1.4)).toBe(10_920);
    expect(sponsorPay(on('photo', 'fitness', 100_000), 1)).toBe(
      Math.round(7_800 * findCreatorCategory('fitness')!.pays),
    );
  });

  it('does not mark a small photo channel’s posts down below the going rate', () => {
    // 5,000 followers: $50 a post at the going rate, six of them. The going rate only rises with size.
    expect(sponsorPay(on('photo', 'lifestyle', 5_000), 1)).toBe(300);
    expect(sponsorPay(on('photo', 'lifestyle', 10_000), 1)).toBe(600);
  });

  it('pays a short-form channel for five clips seen by a third of its followers', () => {
    expect([CAMPAIGN_CLIPS, CLIP_VIEWS_PER_FOLLOWER, CLIP_CAMPAIGN_CPM]).toEqual([5, 0.3, 15]);
    // 1 million followers, 300,000 views a clip at $15 a thousand: $4,500 a clip, comedy pays 0.9.
    expect(sponsorPay(on('shortform', 'comedy', 1_000_000), 1)).toBe(20_250);
    expect(sponsorPay(on('shortform', 'comedy', 100_000), 1)).toBe(2_025);
  });

  it('pays a newsletter for six sponsored issues', () => {
    expect([SPONSORED_ISSUES, ISSUE_CPM]).toEqual([6, 30]);
    // 10,000 readers: $300 an issue at $30 a thousand, six issues, writing pays 0.8.
    expect(sponsorPay(on('subscription', 'writing', 10_000), 1)).toBe(1_440);
    expect(sponsorPay(on('subscription', 'writing', 10_000), 0.6)).toBe(864);
  });

  it('sells a deal on every platform there is', () => {
    for (const platform of PLATFORMS) {
      const category = platform.categories[0]!;
      expect(sponsorPay(on(platform.id, category, 2_000_000), 1), platform.id).toBeGreaterThan(0);
    }
  });

  it('is asked for from a channel’s own threshold, not before', () => {
    for (const [platformId, categoryId, paysAt] of [
      ['photo', 'lifestyle', 1_000],
      ['shortform', 'comedy', 10_000],
      ['subscription', 'writing', 100],
    ] as const) {
      expect(findPlatform(platformId)!.paysAt).toBe(paysAt);
      for (const year of Array.from({ length: 60 }, (_, i) => 2040 + i)) {
        expect(
          sponsorOffersFor({ seed: 's', year, channel: on(platformId, categoryId, paysAt - 1) }),
        ).toEqual([]);
      }
    }
  });

  it('offers a big channel on each of them, in the platform’s own words', () => {
    for (const [platformId, categoryId, audience, monetization] of [
      ['photo', 'lifestyle', 400_000, 'brands'],
      ['shortform', 'comedy', 2_000_000, 'shortAds'],
      ['subscription', 'writing', 200_000, 'members'],
    ] as const) {
      const seen = new Set<string>();
      for (let year = 2040; year < 2100; year += 1) {
        for (const offer of sponsorOffersFor({
          seed: 's',
          year,
          channel: on(platformId, categoryId, audience),
        })) {
          expect(offer.monetization).toBe(monetization);
          expect(SPONSOR_BRANDS[categoryId]).toContain(offer.brand);
          seen.add(offer.brand);
        }
      }
      expect(seen.size, platformId).toBeGreaterThanOrEqual(2);
    }
  });

  it('costs a little trust to take one, as on the long-form three', () => {
    for (const platformId of ['photo', 'shortform', 'subscription']) {
      const channel = on(
        platformId,
        platformId === 'subscription' ? 'writing' : 'lifestyle',
        400_000,
      );
      const result = answerSponsor({
        seed: 's',
        channel,
        offer: {
          id: 'x',
          channelId: channel.id,
          brand: 'B',
          pay: 1_000,
          monetization: 'brands',
        },
        answer: 'accept',
      });
      expect(result.channel.audience).toBe(
        Math.round(400_000 * (1 - findPlatform(platformId)!.trustCost)),
      );
    }
  });
});

describe('asking for more is a fair gamble', () => {
  it('is worth a little over the offer on average, so it is a real choice', () => {
    expect(MORE_CHANCE).toBe(0.65);
    expect(MORE_RAISE).toBe(0.6);
    expect(MORE_CHANCE * (1 + MORE_RAISE)).toBeCloseTo(1.04, 12);
  });
});
