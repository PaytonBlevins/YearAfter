/**
 * Ticket 0708 — what the fame and social media screens say, as plain functions.
 *
 * Fame is shown as the number it is: a percentage from 0 to 100, exactly (the player asked for
 * "the exact fame percentage"). Everything else is a sentence, because a ranking, a trend or a
 * price band is a thing a person would say and not a formula (spec 786–795).
 */

import {
  FAME_WORK,
  TREND_LABELS,
  findCreatorCategory,
  findPlatform,
  type FameWorkDef,
} from '@yearafter/content';
import {
  TIER_PRICE,
  chartRank,
  chartTierOf,
  trendWord,
  type Channel,
  type Effort,
  type PaidTier,
} from '@yearafter/finance';
import { standingOf } from '@yearafter/simulation';

/** "37%". Fame is whole points, so there is nothing to round. */
export const fameLabel = (fame: number): string =>
  `${Math.min(100, Math.max(0, Math.round(fame)))}%`;

/** How the character reads to the world, in a phrase. */
export function fameWords(fame: number): string {
  if (fame <= 0) return 'Nobody knows your name yet';
  if (fame < 6) return 'Hardly anyone knows your name';
  const standing = standingOf(fame);
  return standing.charAt(0).toUpperCase() + standing.slice(1);
}

/** The next thing a bigger name would open, or undefined when everything is already open. */
export function nextOpening(
  fame: number,
): { readonly def: FameWorkDef; readonly at: number } | undefined {
  const ahead = FAME_WORK.filter((def) => def.fromFame > fame).sort(
    (a, b) => a.fromFame - b.fromFame,
  )[0];
  return ahead === undefined ? undefined : { def: ahead, at: ahead.fromFame };
}

export const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;

/** "12,400 subscribers". */
export function audienceLine(channel: Channel): string {
  const word = findPlatform(channel.platformId)?.audienceWord ?? 'followers';
  return `${channel.audience.toLocaleString('en-US')} ${word}`;
}

/** Where it stands on its platform's chart, or undefined when it is off it or there is none. */
export function rankLine(channel: Channel): string | undefined {
  const rank = chartRank(channel);
  if (rank === undefined) return undefined;
  return `#${rank.toLocaleString('en-US')} on the ${findPlatform(channel.platformId)?.name ?? ''} chart`;
}

/** The smallest group a rank is inside, said the way a person would: "top 10". */
export function topLine(rank: number | undefined): string | undefined {
  if (rank === undefined) return undefined;
  const tier = chartTierOf(rank);
  return tier === 1 ? 'Number one' : `In the top ${tier.toLocaleString('en-US')}`;
}

export const EFFORT_LABELS: Readonly<Record<Effort, string>> = {
  light: 'Light',
  regular: 'Regular',
  heavy: 'Heavy',
};

export const EFFORT_BLURBS: Readonly<Record<Effort, string>> = {
  light: 'Grows slowly and tops out lower. Easy on your week.',
  regular: 'A steady pace.',
  heavy: 'Grows faster and goes higher. Takes a lot of your week.',
};

export const TIER_LABELS: Readonly<Record<PaidTier, string>> = {
  low: 'Low',
  standard: 'Standard',
  premium: 'Premium',
};

export const tierLine = (tier: PaidTier): string =>
  `${TIER_LABELS[tier]}, ${money(TIER_PRICE[tier])} a month`;

/** What a channel's category is doing this year, as a phrase, or undefined for a steady one. */
export function trendLine(channel: Channel, year: number): string | undefined {
  const word = trendWord(channel.categoryId, year);
  const name = findCreatorCategory(channel.categoryId)?.name ?? 'This kind of channel';
  return word === 'steady' ? undefined : `${name}: ${TREND_LABELS[word].toLowerCase()}`;
}
