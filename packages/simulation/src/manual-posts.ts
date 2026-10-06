import { appendToTimeline } from '@yearafter/character';
import { findPlatform, postFormatsFor } from '@yearafter/content';
import { err, ok, type Result } from '@yearafter/core';
import {
  fameTarget,
  groupBoost,
  growthBoost,
  publishPost,
  type PostRefusal,
} from '@yearafter/finance';
import { entryFor, qualityOf } from './creators';
import type { GameState } from './game-state';

export function postToChannel(
  state: GameState,
  channelId: string,
  kind: string,
): Result<GameState, PostRefusal> {
  const channel = state.channels.find((row) => row.id === channelId);
  if (!channel) return err({ kind: 'noSuchChannel' });
  const result = publishPost({
    channel,
    year: state.world.year,
    seed: state.rng.getSeed(),
    kind,
    quality: qualityOf(state.player.stats, state.player.talents, channel.categoryId),
    boost: growthBoost(state.representation) * groupBoost(channel),
  });
  if (!result.ok) return result;
  const updated = result.value;
  const gained = updated.publishing?.gained ?? 0;
  const platform = findPlatform(channel.platformId);
  const option = postFormatsFor(channel.platformId).find((row) => row.id === kind);
  const text = `You published ${option?.name.toLowerCase() ?? 'a post'} on ${platform?.name ?? 'your channel'}. ${gained > 0 ? `${gained.toLocaleString('en-US')} new ${platform?.audienceWord ?? 'followers'} found you.` : gained < 0 ? `${Math.abs(gained).toLocaleString('en-US')} ${platform?.audienceWord ?? 'followers'} left after it.` : "It didn't change your audience."}`;
  const channels = state.channels.map((row) => (row.id === channelId ? updated : row));
  const entry = entryFor(
    state,
    text,
    `post:${channelId}:${state.world.year}:${updated.publishing?.count ?? 0}`,
  );
  return ok({
    ...state,
    channels,
    // Publishing can make somebody known; it doesn't erase fame earned elsewhere.
    fame: Math.max(state.fame, fameTarget(channels)),
    player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
  });
}
