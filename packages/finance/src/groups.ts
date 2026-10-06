/**
 * Ticket 0704 — creator groups: a creator house, a gaming team, a video group, a podcast network.
 *
 * A group signs a channel that is already paying its way. It keeps a share of the channel's income
 * (podcast networks keep about 30%, multi-channel networks 10–40%) and gives back reach: the
 * channel grows faster, brands notice it more, and working with the group's own people is free.
 * A bigger share buys more growth, but not quite enough to pay for itself in money alone, so a
 * group is worth it for what it does to the audience, not for the arithmetic.
 *
 * Offers are DERIVED from the seed, the year and the channel; only an answer is saved.
 */

import { mixedUnit } from '@yearafter/core';
import {
  GROUP_KIND_BY_PLATFORM,
  GROUP_NAMES,
  findPlatform,
  type GroupKind,
} from '@yearafter/content';
import type { Channel, GroupMembership } from './creators';

/** The chance a group wants a channel that qualifies, in a year. */
export const GROUP_OFFER_CHANCE = 0.35;
/** A group wants a channel with at least this many times the audience a platform starts paying at. */
export const GROUP_MIN_MULTIPLE = 3;
/** The shares a group keeps: a small one, a usual one, a big one. */
export const GROUP_CUTS: readonly number[] = [0.1, 0.2, 0.3];
/** Growth a group adds per point of its cut: 1.3 is a 20% cut for 26% faster growth. */
export const GROUP_GROWTH_PER_CUT = 1.3;
/** What being in a group adds to how much brands want the channel. */
export const GROUP_INTEREST_BONUS = 0.15;

export interface GroupOffer {
  readonly id: string;
  readonly channelId: string;
  readonly kind: GroupKind;
  readonly name: string;
  readonly cut: number;
}

/** What a group adds to where a channel is headed: 1 for none. */
export const groupBoost = (channel: Channel): number =>
  channel.group === undefined ? 1 : 1 + GROUP_GROWTH_PER_CUT * channel.group.cut;

/** What the group keeps of a year's income, whole dollars. */
export const groupShare = (channel: Channel, income: number): number =>
  channel.group === undefined ? 0 : Math.round(income * channel.group.cut);

/** What a channel is in a group makes brands want it by: 0 outside one. */
export const groupInterest = (channel: Channel): number =>
  channel.group === undefined ? 0 : GROUP_INTEREST_BONUS;

/** The offer on the table for a channel this year, if there is one. Derived; nothing is saved. */
export function groupOfferFor(input: {
  readonly seed: string;
  readonly year: number;
  readonly channel: Channel;
}): GroupOffer | undefined {
  const { channel } = input;
  const platform = findPlatform(channel.platformId);
  const kind = GROUP_KIND_BY_PLATFORM[channel.platformId];
  if (platform === undefined || kind === undefined || channel.group !== undefined) return undefined;
  if (channel.audience < platform.paysAt * GROUP_MIN_MULTIPLE) return undefined;
  const id = `gp:${input.year}:${channel.id}`;
  if (channel.answered?.includes(id)) return undefined;
  const key = `${input.seed}:group:${channel.id}:${input.year}`;
  if (mixedUnit(`${key}:happens`) >= GROUP_OFFER_CHANCE) return undefined;
  const names = GROUP_NAMES[kind];
  return {
    id,
    channelId: channel.id,
    kind,
    name: names[Math.floor(mixedUnit(`${key}:name`) * names.length) % names.length]!,
    cut: GROUP_CUTS[Math.floor(mixedUnit(`${key}:cut`) * GROUP_CUTS.length) % GROUP_CUTS.length]!,
  };
}

/** Joining or turning down a group. Joining makes the group part of the channel. */
export function answerGroup(input: {
  readonly channel: Channel;
  readonly offer: GroupOffer;
  readonly join: boolean;
  readonly year: number;
}): Channel {
  const { channel, offer } = input;
  const answered = [...(channel.answered ?? []), offer.id];
  if (!input.join) return { ...channel, answered };
  const group: GroupMembership = {
    id: offer.id,
    kind: offer.kind,
    name: offer.name,
    cut: offer.cut,
    since: input.year,
  };
  return { ...channel, group, answered };
}

/** Leaving a group takes the share back and the reach with it. */
export function leaveGroupOf(channel: Channel): Channel {
  const { group: _group, ...rest } = channel;
  return rest;
}
