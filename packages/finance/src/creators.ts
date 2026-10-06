/**
 * Ticket 0701 — channels: what a creator makes, who finds it, and what it pays.
 *
 * A channel is one thing made for one platform in one category. Its fate is two
 * numbers fixed at the moment it opens: `luck`, a draw in [0, 1) that says how
 * far this channel could go if everything else were average, and the id the
 * year-to-year noise is keyed on. Everything after that is arithmetic on the
 * year, so a reload cannot reroll a channel (the rule 0605's deals use).
 *
 * THE LONG TAIL IS THE POINT. Outcomes are not a bell curve. `SETTLE_ANCHORS`
 * pins the curve to published figures for video: roughly 41% of channels pass
 * a thousand subscribers, 8% pass ten thousand, 1.3% pass a hundred thousand
 * and 0.13% pass a million. A luck draw is turned into where the channel
 * settles by reading that curve; the platform, the category, the maker's
 * skill, the effort and the year's fashions then scale it.
 *
 * Money is whole dollars inside the arithmetic and cents at the edges.
 */

import { cents, mixedUnit, type Money } from '@yearafter/core';
import {
  findCreatorCategory,
  findPlatform,
  type CreatorCategory,
  type CreatorNote,
  type GroupKind,
  type Platform,
  type TrendWord,
} from '@yearafter/content';

/** Youngest age at which anybody opens a channel; a platform may ask for more. */
export const CREATOR_FROM_AGE = 14;
/** The most channels one person keeps going. Attention is the limit, not money. */
export const MAX_CHANNELS = 4;

export const EFFORTS = ['light', 'regular', 'heavy'] as const;
export type Effort = (typeof EFFORTS)[number];

/** How far the channel can go at this effort, against 1 for regular. */
export const EFFORT_TARGET: Readonly<Record<Effort, number>> = {
  light: 0.5,
  regular: 1,
  heavy: 1.5,
};
/** How quickly the audience closes on where it is headed. */
export const EFFORT_SPEED: Readonly<Record<Effort, number>> = {
  light: 0.7,
  regular: 1,
  heavy: 1.25,
};
/** How much gets made in a year: posts, streams, episodes, videos. */
export const EFFORT_OUTPUT: Readonly<Record<Effort, number>> = {
  light: 0.5,
  regular: 1,
  heavy: 1.6,
};

/** The share of the gap to its target a regular-effort audience closes in a year. */
export const GROWTH_RATE = 0.3;
/** The loss from the target's pull downward is the platform's churn times this. */
export const CHURN_PULL = 2.5;
/** Upkeep a year, as a share of what it cost to start, at regular effort. */
export const UPKEEP_SHARE = 0.25;

/** Audiences worth a note. */
export const MILESTONES: readonly number[] = [
  1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000,
];

/**
 * [share of channels at least this big, the audience]. Video, vidIQ July 2026.
 * The ends are not published: the bottom is a channel nobody finds, the top is
 * the largest channels there are.
 */
export const SETTLE_ANCHORS: readonly (readonly [number, number])[] = [
  [1, 3],
  [0.406, 1_000],
  [0.079, 10_000],
  [0.013, 100_000],
  [0.0013, 1_000_000],
  [0.00005, 30_000_000],
  // The chart's top: #1 of about four million.
  [0.00000025, 400_000_000],
];

export interface Channel {
  /** Unique within a life. */
  readonly id: string;
  readonly platformId: string;
  readonly categoryId: string;
  readonly name: string;
  readonly since: number;
  /** People: subscribers, followers, listeners, readers. */
  readonly audience: number;
  /** The most it has had. */
  readonly peak: number;
  readonly effort: Effort;
  /** Fixed at the start: where in the long tail this channel sits. 0 is the bottom. */
  readonly luck: number;
  /** What it has earned in all, before upkeep, cents. */
  readonly earned: Money;
  /** Ticket 0702. The best place it has held on its platform's chart, 1 being the top. */
  readonly bestRank?: number;
  /** Ticket 0702. Sponsorship money agreed this year and paid with the year's income, cents. */
  readonly owed?: Money;
  /** Ticket 0702. Sponsorship offers already answered this year. */
  readonly answered?: readonly string[];
  /** Ticket 0703. Subscription only: how many readers pay now. Absent: nobody yet. */
  readonly paid?: number;
  /** Ticket 0703. Subscription only: what a month costs a reader. Absent: standard. */
  readonly tier?: PaidTier;
  /** Ticket 0703. The last year a post took off, so the fall after it is not read as a slump. */
  readonly viralYear?: number;
  /** Ticket 0704. The group it belongs to, if one signed it. */
  readonly group?: GroupMembership;
  /** Ticket 0704. How many times it has worked with each person, by partner id: repeats count for less. */
  readonly collabs?: Readonly<Record<string, number>>;
}

/** Ticket 0704. A creator house, gaming team, video group or podcast network a channel belongs to. */
export interface GroupMembership {
  readonly id: string;
  readonly kind: GroupKind;
  readonly name: string;
  /** The share of the channel's income the group keeps, 0–1. */
  readonly cut: number;
  readonly since: number;
}

export type ChannelRefusal =
  | { readonly kind: 'tooYoung'; readonly age: number }
  | { readonly kind: 'unknownPlatform' }
  | { readonly kind: 'notSuitable' }
  | { readonly kind: 'alreadyHaveOne' }
  | { readonly kind: 'tooMany'; readonly limit: number }
  | { readonly kind: 'notEnoughMoney'; readonly needed: number };

export const EMPTY_CHANNELS: readonly Channel[] = [];

const platformOf = (channel: Channel): Platform | undefined => findPlatform(channel.platformId);
const categoryOf = (channel: Channel): CreatorCategory | undefined =>
  findCreatorCategory(channel.categoryId);

/** Why a channel cannot be opened now, or undefined if it can. Money is whole dollars. */
export function whyNotOpen(input: {
  readonly age: number;
  readonly liquid: number;
  readonly held: readonly Channel[];
  readonly platformId: string;
  readonly categoryId: string;
}): ChannelRefusal | undefined {
  const platform = findPlatform(input.platformId);
  if (platform === undefined) return { kind: 'unknownPlatform' };
  if (input.age < Math.max(CREATOR_FROM_AGE, platform.minAge))
    return { kind: 'tooYoung', age: Math.max(CREATOR_FROM_AGE, platform.minAge) };
  if (!platform.categories.includes(input.categoryId) || !findCreatorCategory(input.categoryId))
    return { kind: 'notSuitable' };
  if (
    input.held.some((c) => c.platformId === input.platformId && c.categoryId === input.categoryId)
  )
    return { kind: 'alreadyHaveOne' };
  if (input.held.length >= MAX_CHANNELS) return { kind: 'tooMany', limit: MAX_CHANNELS };
  if (input.liquid < platform.startCost)
    return { kind: 'notEnoughMoney', needed: platform.startCost };
  return undefined;
}

/** A new channel. The luck is drawn here, once. The caller has already asked `whyNotOpen`. */
export function newChannel(input: {
  readonly seed: string;
  readonly id: string;
  readonly platformId: string;
  readonly categoryId: string;
  readonly year: number;
}): Channel {
  const category = findCreatorCategory(input.categoryId);
  const key = `${input.seed}:channel:${input.id}`;
  const names = category?.names ?? ['Untitled'];
  return {
    id: input.id,
    platformId: input.platformId,
    categoryId: input.categoryId,
    name: names[Math.floor(mixedUnit(`${key}:name`) * names.length) % names.length]!,
    since: input.year,
    audience: 0,
    peak: 0,
    effort: 'regular',
    luck: mixedUnit(`${key}:luck`),
    earned: cents(0),
  };
}

export const withEffort = (channel: Channel, effort: Effort): Channel => ({
  ...channel,
  effort,
});

/** Where a luck draw settles, before anything else scales it. Log-log between the anchors. */
export function settledAudience(luck: number, platform?: Platform): number {
  const curve = platform?.settle ?? SETTLE_ANCHORS;
  const scale = platform?.settle ? 1 : (platform?.discover ?? 1);
  const survival = Math.min(1, Math.max(1e-9, 1 - luck));
  const last = curve[curve.length - 1]!;
  if (survival <= last[0]) return last[1] * scale;
  if (survival >= curve[0]![0]) return curve[0]![1] * scale;
  for (let index = 1; index < curve.length; index += 1) {
    const [lowShare, lowAudience] = curve[index]!;
    const [highShare, highAudience] = curve[index - 1]!;
    if (survival >= lowShare) {
      const along =
        (Math.log(highShare) - Math.log(survival)) / (Math.log(highShare) - Math.log(lowShare));
      return (
        scale *
        Math.exp(Math.log(highAudience) + along * (Math.log(lowAudience) - Math.log(highAudience)))
      );
    }
  }
  return curve[0]![1] * scale;
}

/** The other way round: the share of channels on a platform with at least this audience. */
export function survivalAt(audience: number, platform?: Platform): number {
  const curve = platform?.settle ?? SETTLE_ANCHORS;
  const scale = platform?.settle ? 1 : (platform?.discover ?? 1);
  const people = audience / scale;
  if (people <= curve[0]![1]) return 1;
  const last = curve[curve.length - 1]!;
  if (people >= last[1]) return last[0];
  for (let index = 1; index < curve.length; index += 1) {
    const [lowShare, lowAudience] = curve[index]!;
    const [highShare, highAudience] = curve[index - 1]!;
    if (people < lowAudience) {
      const along =
        (Math.log(people) - Math.log(highAudience)) /
        (Math.log(lowAudience) - Math.log(highAudience));
      return Math.exp(Math.log(highShare) + along * (Math.log(lowShare) - Math.log(highShare)));
    }
  }
  return last[0];
}

/**
 * How good the work is, against 1 for an average maker. Skill is the average of
 * the category's two stats, 0–100. Talent is a head start, never a requirement
 * (spec 1070: a boolean).
 */
export function creatorQuality(skill: number, talented: boolean): number {
  const base = 0.6 + 0.8 * (Math.min(100, Math.max(0, skill)) / 100);
  // No lower clamp: skill is clamped to 0–100 above, so the least a maker can be is 0.6.
  return Math.min(1.5, base + (talented ? 0.15 : 0));
}

/** How many years back a fashion remembers, and how fast it forgets. */
export const TREND_MEMORY = 4;
export const TREND_FADE = 0.5;

/**
 * A category's fashion this year, shared by everybody making it: 1 ± its swing.
 * A fashion lasts: this year's is a weighted mix of the last few years' draws,
 * the newest counting most, so a rising one is still rising next year and a
 * player who reads the trend is reading something that holds.
 */
export function trendOf(categoryId: string, year: number): number {
  const swing = findCreatorCategory(categoryId)?.swing ?? 0;
  let total = 0;
  let weights = 0;
  for (let back = 0; back < TREND_MEMORY; back += 1) {
    const weight = TREND_FADE ** back;
    total += weight * (2 * mixedUnit(`creator:trend:${categoryId}:${year - back}`) - 1);
    weights += weight;
  }
  return 1 + swing * (total / weights);
}

/** Where this channel is headed this year. */
export function targetAudience(
  channel: Channel,
  quality: number,
  year: number,
  /** Ticket 0704. Everything that helps it grow beyond the work itself: a manager, a group. 1 for none. */
  boost = 1,
): number {
  const platform = platformOf(channel);
  const category = categoryOf(channel);
  if (platform === undefined || category === undefined) return 0;
  const noise = 0.9 + 0.2 * mixedUnit(`creator:noise:${channel.id}:${year}`);
  const raw =
    (settledAudience(channel.luck, platform) *
      quality ** 2 *
      boost *
      EFFORT_TARGET[channel.effort] *
      trendOf(channel.categoryId, year) *
      noise) /
    Math.sqrt(category.crowding);
  // A soft ceiling: growth fades toward the most the platform has.
  return (raw * platform.ceiling) / (raw + platform.ceiling);
}

/** The audience after a year: closes on the target when below it, falls back toward it when above. */
export function nextAudience(channel: Channel, target: number): number {
  const platform = platformOf(channel);
  if (platform === undefined) return channel.audience;
  const current = channel.audience;
  if (target >= current) {
    return Math.round(current + (target - current) * GROWTH_RATE * EFFORT_SPEED[channel.effort]);
  }
  return Math.max(
    0,
    Math.round(current - (current - target) * Math.min(1, platform.churn * CHURN_PULL)),
  );
}

/** Roughly how many views a subscriber gives a long video channel in a year. */
export const VIEWS_PER_SUBSCRIBER = 70;
/** What a thousand views pay a video creator, whole dollars, before the category. */
export const VIDEO_RPM = 4;
/** Concurrent viewers per follower on a stream. */
export const LIVE_VIEWERS_PER_FOLLOWER = 0.006;
/** A year of one concurrent viewer's subscriptions, tips and ads, whole dollars. */
export const LIVE_DOLLARS_PER_VIEWER = 200;
/** What a brand pays per follower for a post, whole dollars, at ten thousand followers. */
export const BRAND_RATE = 0.01;
/** Sponsored posts a year at regular effort. */
export const BRAND_POSTS = 20;
/** Views per follower per year on short clips. */
export const CLIPS_PER_FOLLOWER = 400;
/** A thousand views of a short clip pay this, whole dollars. */
export const SHORT_RPM = 0.09;
/** Episodes a year at regular effort. */
export const EPISODES = 52;
/** What always-on ads pay per thousand listens (dynamic insertion, $14–16; Libsyn 2026). Host-read deals are offers. */
export const SPONSOR_CPM = 15;
/** The share of free readers who pay at the price a typical reader expects (Substack's median is 3%). */
export const PAID_CONVERSION = 0.03;
/** What a month costs a reader when the category expects the usual, whole dollars. */
export const SUBSCRIPTION_PRICE = 8;
/** What the platform and the card processor keep of a subscription. */
export const SUBSCRIPTION_CUT = 0.13;

/** Ticket 0703. What a reader pays a month: cheap, usual, or a premium. */
export const PAID_TIERS = ['low', 'standard', 'premium'] as const;
export type PaidTier = (typeof PAID_TIERS)[number];
export const TIER_PRICE: Readonly<Record<PaidTier, number>> = {
  low: 5,
  standard: 8,
  premium: 15,
};
/**
 * The share of paying readers still paying a year on. Paid newsletters lose 8–13% a month
 * (Press Gazette, 2026), which is a reader lasting 6–20 months; 0.4 a year is about 8% a month.
 */
export const PAID_RETENTION = 0.4;
/** The conversion rate falls off as a list grows: this much per tenfold past ten thousand readers. */
export const CONVERSION_FALLOFF = 0.25;
/** ... but not below this share of the usual rate. A big list converts less than a small, engaged one. */
export const CONVERSION_FLOOR = 0.4;

/**
 * The share of readers who pay at a price. A category expects to pay `pays` times the usual, and
 * conversion peaks where the price is what the category expects: `e^(1 - price/expected)`, so
 * income per reader (price × share) is highest at that price and lower on either side. Music
 * readers want it cheap, business readers do not mind paying.
 */
export function paidShare(audience: number, tier: PaidTier, category: CreatorCategory): number {
  const size = Math.max(
    CONVERSION_FLOOR,
    1 - CONVERSION_FALLOFF * Math.log10(Math.max(1, audience / 10_000)),
  );
  const expected = SUBSCRIPTION_PRICE * category.pays;
  return PAID_CONVERSION * size * Math.exp(1 - TIER_PRICE[tier] / expected);
}

/** A year's income from this many paying readers, whole dollars, after the platform's cut. */
export const memberIncome = (paid: number, tier: PaidTier): number =>
  Math.round(paid * TIER_PRICE[tier] * 12 * (1 - SUBSCRIPTION_CUT));

/** How many readers pay after a year: the old ones who stay, and the audience's share closing in. */
export function paidNext(
  paid: number,
  audience: number,
  tier: PaidTier,
  category: CreatorCategory,
): number {
  const target = audience * paidShare(audience, tier, category);
  return Math.round(paid * PAID_RETENTION + target * (1 - PAID_RETENTION));
}

/** What each price would earn a year once the readers had settled, for a screen that lets you pick. */
export function tierIncomes(
  channel: Channel,
): readonly { readonly tier: PaidTier; readonly price: number; readonly income: number }[] {
  const category = categoryOf(channel);
  if (category === undefined) return [];
  return PAID_TIERS.map((tier) => ({
    tier,
    price: TIER_PRICE[tier],
    income: memberIncome(channel.audience * paidShare(channel.audience, tier, category), tier),
  }));
}

/** Whether an audience of this size is paid at all: the platform's partner threshold, reached. */
export const paysFrom = (platform: Platform, audience: number): boolean =>
  audience >= platform.paysAt;

/** What an audience of this size earns in a year, whole dollars. Nothing below the platform's threshold. */
export function channelIncome(
  platform: Platform,
  category: CreatorCategory,
  audience: number,
  effort: Effort,
  tier: PaidTier = 'standard',
): number {
  if (!paysFrom(platform, audience)) return 0;
  const output = EFFORT_OUTPUT[effort];
  const pays = category.pays;
  switch (platform.monetization) {
    case 'ads':
      return Math.round(((audience * VIEWS_PER_SUBSCRIBER * output) / 1000) * VIDEO_RPM * pays);
    case 'live':
      return Math.round(
        audience * LIVE_VIEWERS_PER_FOLLOWER * output * LIVE_DOLLARS_PER_VIEWER * pays,
      );
    case 'brands': {
      const rate = BRAND_RATE * (1 + 0.3 * Math.log10(Math.max(1, audience / 10_000)));
      return Math.round(audience * rate * BRAND_POSTS * output * pays);
    }
    case 'shortAds':
      return Math.round(((audience * CLIPS_PER_FOLLOWER * output) / 1000) * SHORT_RPM * pays);
    case 'sponsors':
      return Math.round(((EPISODES * output * audience) / 1000) * SPONSOR_CPM * pays);
    case 'members':
      // What a settled list pays at the usual price; a real year pays on `paid` instead.
      return memberIncome(audience * paidShare(audience, tier, category), tier);
  }
}

/** What keeping the gear and the software going costs in a year, whole dollars. */
export const upkeepOf = (platform: Platform, effort: Effort): number =>
  Math.round(platform.startCost * UPKEEP_SHARE * EFFORT_OUTPUT[effort]);

/** What one year did to one channel. */
export interface ChannelYear {
  readonly channel: Channel;
  /** What it earned, cents; 0 below the platform's threshold. */
  readonly income: Money;
  /** What it cost to keep going, cents. */
  readonly cost: Money;
  /** The first of `notes`, for a caller that wants one line. */
  readonly note?: CreatorNote;
  /** Everything worth a line this year, most important first. */
  readonly notes: readonly CreatorNote[];
}

/** An audience this much smaller than last year's, once it is big enough to notice, is a slump. */
export const SLUMP_SHARE = 0.8;
/** Under this a lost audience is not worth a line. */
export const SLUMP_FROM = 1_000;

/**
 * What is worth saying about an audience going from `previous` to `audience`.
 * Crossing the platform's payment threshold outranks a milestone, which
 * outranks a slump. A milestone is the biggest mark passed, and only when it
 * is passed: sitting exactly on a mark last year does not pass it again.
 */
export function noteFor(
  previous: number,
  audience: number,
  paysAt: number,
): CreatorNote | undefined {
  if (previous < paysAt && audience >= paysAt) return { kind: 'monetized' };
  const crossed = [...MILESTONES].reverse().find((mark) => previous < mark && audience >= mark);
  if (crossed !== undefined) return { kind: 'milestone', mark: crossed };
  if (previous >= SLUMP_FROM && audience < previous * SLUMP_SHARE) return { kind: 'slump' };
  return undefined;
}

/** Advance a channel one year. `quality` is `creatorQuality` for the maker this year. */
export function channelYear(input: {
  readonly channel: Channel;
  readonly year: number;
  readonly quality: number;
  /** Ticket 0704. A multiplier on where the channel is headed, from a manager or a group. 1 for none. */
  readonly boost?: number;
}): ChannelYear {
  const { channel } = input;
  const platform = platformOf(channel);
  const category = categoryOf(channel);
  if (platform === undefined || category === undefined) {
    return { channel, income: cents(0), cost: cents(0), notes: [] };
  }
  const target = targetAudience(channel, input.quality, input.year, input.boost ?? 1);
  const drifted = nextAudience(channel, target);
  const gained = viralGain(channel, input.quality, input.year, drifted);
  const audience = drifted + gained;
  const average = Math.round((channel.audience + audience) / 2);
  const tier = channel.tier ?? 'standard';
  const members = platform.monetization === 'members';
  const paid = members ? paidNext(channel.paid ?? 0, audience, tier, category) : undefined;
  // Paid on the average of the year, not the end of it.
  const worked =
    members && paid !== undefined
      ? !paysFrom(platform, average)
        ? 0
        : memberIncome(((channel.paid ?? 0) + paid) / 2, tier)
      : channelIncome(platform, category, average, channel.effort, tier);
  const income = worked * 100 + Number(channel.owed ?? 0);
  const cost = upkeepOf(platform, channel.effort);
  const moved: Channel = { ...channel, audience };
  const rank = chartRank(moved);
  // Off the chart this year, the old best stands: `rest` below carries it.
  const bestRank = rank === undefined ? undefined : Math.min(channel.bestRank ?? rank, rank);
  const notes: CreatorNote[] = [];
  const base = noteFor(channel.audience, audience, platform.paysAt);
  const chart = chartNote(channel.bestRank, rank);
  if (base?.kind === 'monetized') notes.push(base);
  if (gained > 0) notes.push({ kind: 'viral', gained });
  if (chart !== undefined) notes.push(chart);
  // The drop after a post took off is the fashion going out, not a slump.
  const afterViral = channel.viralYear !== undefined && channel.viralYear === input.year - 1;
  if (base !== undefined && base.kind !== 'monetized' && !(base.kind === 'slump' && afterViral))
    notes.push(base);
  const { owed: _owed, answered: _answered, ...rest } = channel;
  return {
    channel: {
      ...rest,
      audience,
      peak: Math.max(channel.peak, audience),
      earned: cents(Number(channel.earned) + income),
      ...(bestRank === undefined ? {} : { bestRank }),
      ...(paid === undefined ? {} : { paid }),
      ...(gained > 0 ? { viralYear: input.year } : {}),
    },
    income: cents(income),
    cost: cents(cost * 100),
    ...(notes[0] === undefined ? {} : { note: notes[0] }),
    notes,
  };
}

/* -------------------------------------------------------------------------- */
/* Going viral (ticket 0703)                                                     */
/* -------------------------------------------------------------------------- */

/** A busier channel has more chances for something to take off. */
export const VIRAL_EFFORT: Readonly<Record<Effort, number>> = {
  light: 0.5,
  regular: 1,
  heavy: 1.6,
};
/** A post can take off on a channel with almost nobody watching: this is the least it builds on. */
export const VIRAL_BASE = 500;

/**
 * How many people a post that took off brings this year, 0 for most years. The chance is the
 * platform's, times effort, times how good the work is (twice over: a good clip is more likely
 * to be passed around). Drawn from the seed, the channel and the year, so a reload cannot reroll
 * it, and independent of the channel's luck, which fixes where it settles and nothing else.
 */
export function viralGain(
  channel: Channel,
  quality: number,
  year: number,
  audience: number,
): number {
  const viral = platformOf(channel)?.viral;
  if (viral === undefined) return 0;
  const chance = viral.chance * VIRAL_EFFORT[channel.effort] * quality ** 2;
  if (mixedUnit(`creator:viral:${channel.id}:${year}`) >= chance) return 0;
  const size = 0.2 + 0.8 * mixedUnit(`creator:viral-size:${channel.id}:${year}`);
  // An audience is never past its platform's ceiling (the target is softly capped below it and
  // this is capped to it), so there is always room, possibly none.
  const room = (platformOf(channel)?.ceiling ?? 0) - audience;
  return Math.min(room, Math.round(Math.max(audience, VIRAL_BASE) * viral.surge * size));
}

/* -------------------------------------------------------------------------- */
/* Charts (ticket 0702, spec 236–237: #1000 → #1)                               */
/* -------------------------------------------------------------------------- */

/** How far down a chart goes. */
export const CHART_SIZE = 1_000;
/** The places worth a line, biggest first by number: top 1,000, top 100, top 10, number one. */
export const CHART_TIERS: readonly number[] = [1_000, 100, 10, 1];

/**
 * Where a channel stands among everything else on its platform, 1 being the
 * top, or undefined when it is off the chart (or the platform has none). The
 * rest of the platform is the same long tail audiences are drawn from, so a
 * place on the chart means what the real figure it was fitted to means.
 */
export function chartRank(channel: Channel): number | undefined {
  const platform = platformOf(channel);
  if (platform?.chart === undefined) return undefined;
  // The share is positive, so the ceiling is at least 1: number one is the best place there is.
  const rank = Math.ceil(platform.chart * survivalAt(channel.audience, platform));
  return rank <= CHART_SIZE ? rank : undefined;
}

/** The smallest tier a rank is inside: 7 is in the top 10, 40 in the top 100. */
export const chartTierOf = (rank: number): number =>
  [...CHART_TIERS].reverse().find((tier) => rank <= tier) ?? CHART_SIZE;

/** A line when a channel's best place reaches a tier it has not been in. */
export function chartNote(
  best: number | undefined,
  rank: number | undefined,
): CreatorNote | undefined {
  if (rank === undefined || rank > CHART_SIZE) return undefined;
  const tier = chartTierOf(rank);
  if (best !== undefined && tier >= chartTierOf(best)) return undefined;
  return { kind: 'chart', tier };
}

/* -------------------------------------------------------------------------- */
/* Trends, shown (ticket 0702)                                                   */
/* -------------------------------------------------------------------------- */

/** How far into its swing a fashion is, -1 to 1. */
export function trendLean(categoryId: string, year: number): number {
  const swing = findCreatorCategory(categoryId)?.swing ?? 0;
  return swing === 0 ? 0 : (trendOf(categoryId, year) - 1) / swing;
}

/** Categories that barely move are always steady. */
export const STEADY_BELOW = 0.12;

export function trendWord(categoryId: string, year: number): TrendWord {
  const swing = findCreatorCategory(categoryId)?.swing ?? 0;
  if (swing < STEADY_BELOW) return 'steady';
  return leanWord(trendLean(categoryId, year));
}

/** The word for how far into its swing a fashion is: past 0.45 is hot, under -0.45 is cold. */
export function leanWord(lean: number): TrendWord {
  if (lean > 0.45) return 'hot';
  if (lean > 0.15) return 'warm';
  if (lean >= -0.15) return 'steady';
  if (lean >= -0.45) return 'cool';
  return 'cold';
}

export interface TrendRow {
  readonly categoryId: string;
  readonly word: TrendWord;
  /** Whether it is higher than last year. */
  readonly rising: boolean;
}

/** What is in fashion on a platform this year, hottest first. */
export function trendsFor(platformId: string, year: number): readonly TrendRow[] {
  const platform = findPlatform(platformId);
  if (platform === undefined) return [];
  return (
    platform.categories
      .map((categoryId) => ({
        categoryId,
        word: trendWord(categoryId, year),
        rising: trendOf(categoryId, year) > trendOf(categoryId, year - 1),
        lean: trendLean(categoryId, year),
      }))
      // Ties keep the catalog's order (a stable sort), which is already fixed.
      .sort((a, b) => b.lean - a.lean)
      .map(({ categoryId, word, rising }) => ({ categoryId, word, rising }))
  );
}

/* -------------------------------------------------------------------------- */
/* What a channel asks of a life (ticket 0702, finding 47)                       */
/* -------------------------------------------------------------------------- */

/** Discretionary hours a week a channel takes. Feeds the hidden workload; never shown (spec 661). */
export const EFFORT_HOURS: Readonly<Record<Effort, number>> = {
  light: 2,
  regular: 5,
  heavy: 9,
};

/** `factor` is what somebody looking after the business takes off the week (a manager's 0.7). */
export const creatorHours = (channels: readonly Channel[], factor = 1): number =>
  channels.reduce((sum, channel) => sum + EFFORT_HOURS[channel.effort], 0) * factor;

/** Fame is 0–100. A channel's audience counts for the platform's `reach`. */
export const MAX_FAME = 100;

export function fameTarget(channels: readonly Channel[]): number {
  const reach = channels.reduce(
    (sum, channel) => sum + channel.audience * (platformOf(channel)?.reach ?? 0),
    0,
  );
  return Math.min(MAX_FAME, Math.max(0, Math.round(20 * Math.log10(1 + reach / 1000))));
}

/** Fame climbs by half the gap each year and falls by a seventh of it, never below the target. */
export function nextFame(current: number, target: number): number {
  if (target >= current) return current + Math.ceil((target - current) * 0.5);
  // A step is never more than the gap, so this cannot pass the target.
  return current - Math.max(1, Math.round((current - target) / 7));
}
