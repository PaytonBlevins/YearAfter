import { err, mixedUnit, ok, type Result } from '@yearafter/core';
import { findPlatform, postFormatsFor } from '@yearafter/content';
import { GROWTH_RATE, POSTS_PER_YEAR, targetAudience, type Channel } from './creators';

/** Modest discovery even before an audience forms; other gains derive from the existing curve. */
export const POST_DISCOVERY_BASE = 40;
export const POST_LOSS_SHARE = 0.01;
export type PostRefusal = { readonly kind: 'noSuchPost' | 'postingLimit' | 'noSuchChannel' };
export function publishingCount(channel: Channel, year: number): number {
  return channel.publishing?.year === year ? channel.publishing.count : 0;
}

/** One explicit publication, deterministic by seed/account/year/attempt. No money changes here. */
export function publishPost(input: {
  readonly channel: Channel;
  readonly year: number;
  readonly seed: string;
  readonly kind: string;
  readonly quality: number;
  readonly boost?: number;
}): Result<Channel, PostRefusal> {
  const { channel } = input;
  const option = postFormatsFor(channel.platformId).find((row) => row.id === input.kind);
  const platform = findPlatform(channel.platformId);
  if (!option || !platform) return err({ kind: 'noSuchPost' });
  const count = publishingCount(channel, input.year);
  if (count >= POSTS_PER_YEAR) return err({ kind: 'postingLimit' });
  const key = `${input.seed}:manual-post:${channel.id}:${input.year}:${count}`;
  const target = targetAudience(channel, input.quality, input.year + 1, input.boost ?? 1);
  const discovery = Math.max(
    POST_DISCOVERY_BASE,
    (Math.max(0, target - channel.audience) * GROWTH_RATE) / POSTS_PER_YEAR,
  );
  const fatigue = 1 / (1 + count / POSTS_PER_YEAR);
  const failed = mixedUnit(`${key}:reaction`) < option.risk;
  let gained = failed
    ? -Math.round(channel.audience * POST_LOSS_SHARE * option.discovery)
    : Math.round(discovery * option.discovery * (0.5 + mixedUnit(`${key}:reach`)) * fatigue);
  if (
    !failed &&
    platform.viral &&
    mixedUnit(`${key}:viral`) < platform.viral.chance / POSTS_PER_YEAR
  ) {
    gained += Math.round(Math.max(channel.audience, POST_DISCOVERY_BASE) * platform.viral.surge);
  }
  const audience = Math.max(0, Math.min(platform.ceiling, channel.audience + gained));
  return ok({
    ...channel,
    audience,
    peak: Math.max(channel.peak, audience),
    publishing: {
      year: input.year,
      count: count + 1,
      kind: option.id,
      gained: audience - channel.audience,
    },
  });
}
