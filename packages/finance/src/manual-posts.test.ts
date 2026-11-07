import { describe, expect, it } from 'vitest';
import { PLATFORMS, postFormatsFor } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import { channelYear, fameTarget, newChannel, POSTS_PER_YEAR, type Channel } from './creators';
import { publishPost, publishPostWithReception, publishingCount } from './manual-posts';
const make = (platformId = 'photo'): Channel => ({
  ...newChannel({
    seed: 'manual',
    id: 'account',
    platformId,
    categoryId:
      platformId === 'video' || platformId === 'stream' || platformId === 'kick'
        ? 'gaming'
        : 'lifestyle',
    year: 2040,
  }),
  audience: 1_400,
  peak: 1_400,
});
const publish = (channel = make(), kind = 'photo', year = 2040, seed = 'manual') =>
  publishPost({ channel, kind, year, seed, quality: 1 });
describe('manual publishing', () => {
  it('distinguishes all four receptions without changing the settled post', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      const input = {
        channel: make('shortform'),
        kind: postFormatsFor('shortform')[0]!.id,
        year: 2040,
        seed: `reception-${i}`,
        quality: 1,
      };
      const result = publishPostWithReception(input);
      if (!result.ok) throw Error(result.error.kind);
      seen.add(result.value.reception);
      const delta = result.value.channel.audience - input.channel.audience;
      expect(result.value.channel.publishing?.gained).toBe(delta);
      if (result.value.reception === 'poor') expect(delta).toBeLessThan(0);
      else expect(delta).toBeGreaterThan(0);
    }
    expect(seen).toEqual(new Set(['poor', 'good', 'great', 'viral']));
  });

  it('lets existing fame help successful discovery without preventing poor reception', () => {
    const outcomes = new Set();
    for (let n = 0; n < 80; n++) {
      const input = { channel: make(), kind: 'photo', year: 2040, seed: `known-${n}`, quality: 1 };
      const unknown = publishPostWithReception(input);
      const known = publishPostWithReception({ ...input, fame: 60 });
      if (!unknown.ok || !known.ok) throw Error('Post refused');
      expect(known.value.reception).toBe(unknown.value.reception);
      outcomes.add(known.value.reception);
      if (known.value.reception === 'poor')
        expect(known.value.channel.audience).toBe(unknown.value.channel.audience);
      else expect(known.value.channel.audience).toBeGreaterThan(unknown.value.channel.audience);
    }
    expect(outcomes.has('poor')).toBe(true);
    expect(outcomes.has('good')).toBe(true);
  });
  it('has all requested real platforms and free accounts', () => {
    expect(PLATFORMS.map((p) => p.name)).toEqual([
      'YouTube',
      'Twitch',
      'Instagram',
      'TikTok',
      'Amazon Music Podcasts',
      'Substack',
      'Kick',
      'Facebook',
      'X (Twitter)',
    ]);
    for (const platform of PLATFORMS) {
      expect(platform.startCost).toBe(0);
      const options = postFormatsFor(platform.id);
      expect(options.length).toBeGreaterThanOrEqual(4);
      expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
    }
  });
  it('offers platform-specific formats, not the same menu everywhere', () => {
    expect(postFormatsFor('photo').map((p) => p.name)).toContain('Family photo');
    expect(postFormatsFor('stream').map((p) => p.name)).toContain('Gaming stream');
    expect(postFormatsFor('twitter').map((p) => p.name)).toContain('Thread');
    expect(postFormatsFor('podcast').map((p) => p.name)).toContain('Interview episode');
    expect(postFormatsFor('gone')).toEqual([]);
  });
  it('returns the same publication and result on replay without mutating the account', () => {
    const channel = make();
    const before = structuredClone(channel);
    expect(publish(channel)).toEqual(publish(channel));
    const result = publish(channel);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Refused');
    expect(result.value.publishing).toMatchObject({ year: 2040, count: 1, kind: 'photo' });
    expect(result.value.audience).toBeGreaterThanOrEqual(0);
    expect(channel).toEqual(before);
    expect(result.value.earned).toBe(dollars(0));
  });
  it('refuses a format from a different platform', () => {
    expect(publish(make('stream'), 'family')).toEqual({ ok: false, error: { kind: 'noSuchPost' } });
  });
  it('counts the final allowed post and refuses further posts, with a fresh budget next year', () => {
    const channel = {
      ...make(),
      publishing: { year: 2040, count: POSTS_PER_YEAR - 1, kind: 'photo', gained: 1 },
    };
    const last = publish(channel);
    if (!last.ok) throw new Error('Last post refused');
    expect(publishingCount(last.value, 2040)).toBe(12);
    expect(publish(last.value)).toEqual({ ok: false, error: { kind: 'postingLimit' } });
    const next = publish(last.value, 'photo', 2041);
    expect(next.ok).toBe(true);
    if (!next.ok) throw new Error('Next year refused');
    expect(next.value.publishing?.count).toBe(1);
  });
  it('produces both discovery and bad reactions; format choices change outcomes', () => {
    let gains = 0,
      losses = 0,
      choices = 0;
    for (let i = 0; i < 100; i++) {
      const a = publish(make(), 'photo', 2040, `post-${i}`);
      const b = publish(make(), 'challenge', 2040, `post-${i}`);
      if (!a.ok || !b.ok) throw new Error('Refused');
      if ((b.value.publishing?.gained ?? 0) > 0) gains++;
      if ((b.value.publishing?.gained ?? 0) < 0) losses++;
      if (a.value.audience !== b.value.audience) choices++;
    }
    expect(gains).toBeGreaterThan(50);
    expect(losses).toBeGreaterThan(5);
    expect(choices).toBeGreaterThan(80);
  });
  it('does not automatically discover or monetize an account that did not publish', () => {
    const result = channelYear({
      channel: { ...make('video'), audience: 100_000, luck: 0.99999 },
      quality: 1,
      year: 2041,
      manual: true,
    });
    expect(result.channel.audience).toBe(90_000);
    expect(result.income).toBe(dollars(0));
    expect(result.notes.some((note) => note.kind === 'viral')).toBe(false);
  });
  it('does not treat last year activity as activity in every future year', () => {
    const result = channelYear({
      channel: {
        ...make('video'),
        audience: 100_000,
        publishing: { year: 2039, count: 12, kind: 'gameplay', gained: 50 },
      },
      quality: 1,
      year: 2041,
      manual: true,
    });
    expect(result.channel.audience).toBe(90_000);
    expect(result.income).toBe(dollars(0));
  });
  it('gives active posts income, scaled to publishing activity', () => {
    const one = {
      ...make('video'),
      audience: 100_000,
      publishing: { year: 2040, count: 1, kind: 'gameplay', gained: 50 },
    };
    const full = { ...one, publishing: { ...one.publishing, count: 12 } };
    const partial = channelYear({ channel: one, quality: 1, year: 2041, manual: true });
    const complete = channelYear({ channel: full, quality: 1, year: 2041, manual: true });
    expect(partial.income).toBeGreaterThan(0);
    expect(complete.income).toBeGreaterThan(partial.income);
  });
  it.each([
    [1_400, 0],
    [10_000, 3],
    [100_000, 15],
    [1_000_000, 40],
  ])('anchors fame for %s followers at %s', (audience, expected) => {
    expect(fameTarget([{ ...make(), audience }])).toBe(expected);
  });
});

it('uses identical reach, drift and earnings for identical posts from old light and heavy saves', () => {
  const base = { ...make('video'), audience: 50000, peak: 50000 };
  const result = (effort: Channel['effort']) => {
    const post = publishPostWithReception({
      channel: { ...base, effort },
      kind: postFormatsFor('video')[0]!.id,
      quality: 1,
      year: 2040,
      seed: 'effort-neutral',
    });
    if (!post.ok) throw Error(post.error.kind);
    const settled = channelYear({
      channel: post.value.channel,
      quality: 1,
      year: 2041,
      manual: true,
    });
    return {
      gained: post.value.channel.publishing?.gained,
      audience: settled.channel.audience,
      income: settled.income,
      cost: settled.cost,
    };
  };
  expect(result('light')).toEqual(result('heavy'));
  expect(result('light').income).toBeGreaterThan(0);
  expect(result('light').cost).toBe(0);
});
