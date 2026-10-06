/**
 * Ticket 0704 — working with other creators.
 *
 * An offer is a chance to appear with somebody (a guest, a swap, a joint piece). It is DERIVED
 * from the seed, the year and the channel, so a reload shows the same offers and an answer cannot
 * be rerolled; only the answers and how often each person has been worked with are saved.
 *
 * Measured first. On YouTube, collaborations raised subscriber gains about 30% and a collab video's
 * views by about a third; the effect is large under 10,000 subscribers, small by 100,000, and
 * negligible past that. Channels that collaborate repeat with the same partner 2.3 times on average,
 * so a repeat is a repeat: the second time works half as well, the third a quarter (spec 1396).
 *
 * Friends guest for free. A stranger bigger than you charges, since they are doing you a favour;
 * one your size swaps, which costs nothing. A group's own people are free, and an agent bargains
 * what strangers charge down.
 */

import { mixedUnit } from '@yearafter/core';
import { COLLAB_PARTNERS } from '@yearafter/content';
import type { Channel } from './creators';
import { AGENT_FEE_DISCOUNT } from './representation';

/** The most offers a channel gets in a year. */
export const MAX_COLLAB_OFFERS = 2;
/** The chance a slot brings an offer. */
export const COLLAB_CHANCE = 0.5;
/** A channel with fewer people than this has nothing to trade yet. */
export const MIN_COLLAB_AUDIENCE = 100;
/** How many different strangers a channel keeps meeting: so the same few come round again. */
export const COLLAB_POOL = 6;
/** The chance a slot is a friend, when there are friends to ask. */
export const FRIEND_CHANCE = 0.35;
/** A stranger's audience against yours runs from this to this, log-spread. */
export const PARTNER_RATIO: readonly [number, number] = [0.3, 5];
/** A friend's following runs from this to this. Most people have little. */
export const FRIEND_AUDIENCE: readonly [number, number] = [100, 50_000];
/** The share of a partner's audience a good collaboration brings over. */
export const COLLAB_CONVERT = 0.04;
/** The most a collaboration can add, against the channel's own audience. */
export const COLLAB_MAX_SHARE = 0.35;
/** What each repeat with the same person is worth against the last. */
export const REPEAT_FADE = 0.5;
/** A stranger this many times your size charges to appear. */
export const BIG_NAME = 1.5;
/** What they charge, whole dollars per follower of theirs. */
export const COLLAB_FEE_RATE = 0.015;
export const MIN_COLLAB_FEE = 25;
/** Not worth an offer under this many people. */
export const MIN_COLLAB_GAIN = 5;

export interface CollabPartner {
  readonly id: string;
  readonly name: string;
  readonly friend: boolean;
  readonly audience: number;
}

export interface CollabOffer {
  readonly id: string;
  readonly channelId: string;
  readonly partner: CollabPartner;
  /** What they charge, whole dollars. 0 for a friend, a swap or someone in your group. */
  readonly fee: number;
  /** People it brings over, before anything else this year. */
  readonly gain: number;
  /** Times this channel has already worked with them. */
  readonly repeats: number;
}

/**
 * How much of a collaboration a channel of this size gets: all of it up to ten thousand people,
 * a third at a hundred thousand, a fifth at a million. Big channels have already reached who
 * they are going to reach.
 */
export const reachShare = (audience: number): number =>
  1 / (1 + 2 * Math.log10(Math.max(1, audience / 10_000)));

/** People a collaboration brings a channel. */
export function collabGain(own: number, partner: number, repeats: number): number {
  return Math.round(
    Math.min(partner * COLLAB_CONVERT, own * COLLAB_MAX_SHARE) *
      reachShare(own) *
      REPEAT_FADE ** repeats,
  );
}

/** What a stranger charges, whole dollars: nothing from someone your size or smaller. */
export function collabFee(own: number, partner: number, discount: number): number {
  if (partner <= own * BIG_NAME) return 0;
  return Math.max(MIN_COLLAB_FEE, Math.round(partner * COLLAB_FEE_RATE * (1 - discount)));
}

/** An offer is only worth making for at least this many new people. */
export const worthCollab = (gain: number): boolean => gain >= MIN_COLLAB_GAIN;

const logSpread = (low: number, high: number, unit: number): number => low * (high / low) ** unit;

/** The offers on the table for one channel this year. Derived; nothing is saved. */
export function collabOffersFor(input: {
  readonly seed: string;
  readonly year: number;
  readonly channel: Channel;
  /** People the character counts as friends, who can guest for free. */
  readonly friends: readonly { readonly id: string; readonly name: string }[];
  readonly agent?: boolean;
}): readonly CollabOffer[] {
  const { channel } = input;
  if (channel.audience < MIN_COLLAB_AUDIENCE) return [];
  const discount = input.agent === true ? AGENT_FEE_DISCOUNT : 0;
  const offers: CollabOffer[] = [];
  for (let slot = 0; slot < MAX_COLLAB_OFFERS; slot += 1) {
    const key = `${input.seed}:collab:${channel.id}:${input.year}:${slot}`;
    if (mixedUnit(`${key}:happens`) >= COLLAB_CHANCE) continue;
    const id = `co:${input.year}:${channel.id}:${slot}`;
    if (channel.answered?.includes(id)) continue;
    let partner: CollabPartner;
    if (input.friends.length > 0 && mixedUnit(`${key}:friend`) < FRIEND_CHANCE) {
      const friend =
        input.friends[
          Math.floor(mixedUnit(`${key}:who`) * input.friends.length) % input.friends.length
        ]!;
      partner = {
        id: `f:${friend.id}`,
        name: friend.name,
        friend: true,
        audience: Math.round(
          logSpread(
            FRIEND_AUDIENCE[0],
            FRIEND_AUDIENCE[1],
            mixedUnit(`creator:friend-audience:${friend.id}`),
          ),
        ),
      };
    } else {
      const index = Math.floor(mixedUnit(`${key}:partner`) * COLLAB_POOL) % COLLAB_POOL;
      const start = Math.floor(
        mixedUnit(`creator:partner-names:${channel.id}`) * COLLAB_PARTNERS.length,
      );
      const partnerId = `p:${channel.id}:${index}`;
      partner = {
        id: partnerId,
        name: COLLAB_PARTNERS[(start + index) % COLLAB_PARTNERS.length]!,
        friend: false,
        audience: Math.round(
          channel.audience *
            logSpread(
              PARTNER_RATIO[0],
              PARTNER_RATIO[1],
              mixedUnit(`creator:partner-ratio:${partnerId}`),
            ),
        ),
      };
    }
    const repeats = channel.collabs?.[partner.id] ?? 0;
    const gain = collabGain(channel.audience, partner.audience, repeats);
    if (!worthCollab(gain)) continue;
    // Friends and a group's own people appear for nothing; a bigger stranger charges.
    const fee =
      partner.friend || channel.group !== undefined
        ? 0
        : collabFee(channel.audience, partner.audience, discount);
    offers.push({ id, channelId: channel.id, partner, fee, gain, repeats });
  }
  return offers;
}

/** Appearing with them, or not. Taking it brings the people over and remembers the repeat. */
export function answerCollab(input: {
  readonly channel: Channel;
  readonly offer: CollabOffer;
  readonly accept: boolean;
}): Channel {
  const { channel, offer } = input;
  const answered = [...(channel.answered ?? []), offer.id];
  if (!input.accept) return { ...channel, answered };
  const audience = channel.audience + offer.gain;
  return {
    ...channel,
    audience,
    peak: Math.max(channel.peak, audience),
    collabs: { ...channel.collabs, [offer.partner.id]: offer.repeats + 1 },
    answered,
  };
}
