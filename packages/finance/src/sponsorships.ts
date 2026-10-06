/**
 * Ticket 0702 — sponsorship offers.
 *
 * A brand offers a channel money to talk about it. Spec 251: keep it light,
 * Accept / Request More / Decline. Offers are DERIVED from the seed, the year
 * and the channel, so a reload shows the same offers and an answer cannot be
 * rerolled; only the answers are saved (`answered`, and `owed` for money
 * agreed). What is owed is paid with the year's income, so it is taxed like it.
 *
 * Sold on every platform that pays by the thing it sells: a video campaign, a run of streams or
 * host-read ads on the long-form three (0702), a set of posts, a set of clips, a run of sponsored
 * issues on the other three (0703).
 */

import { cents, mixedUnit } from '@yearafter/core';
import { SPONSOR_BRANDS, findCreatorCategory, findPlatform } from '@yearafter/content';
import { BRAND_RATE, type Channel } from './creators';
import { groupInterest } from './groups';
import { AGENT_OFFER_CHANCE, AGENT_PAY, agentShare } from './representation';

/** The most offers a channel gets in a year. Spec 1233's spirit: no bombardment. */
export const MAX_SPONSOR_OFFERS = 2;
/** The smallest deal worth an offer, whole dollars. */
export const MIN_SPONSOR_PAY = 50;
/** The chance asking for more works. */
export const MORE_CHANCE = 0.65;
/** What asking for more, successfully, adds. 0.65 × 1.6 is 1.04 of the offer: a fair gamble, not a trap and not free money. */
export const MORE_RAISE = 0.6;

/** Median views of a video, against subscribers. */
export const VIEWS_PER_AUDIENCE = 0.4;
/** What a thousand views are worth to a brand, whole dollars, before the category. $10–50 is the range. */
export const SPONSOR_VIDEO_CPM = 25;
/** What a sponsored stream pays per average viewer, whole dollars, before the category. */
export const SPONSOR_PER_VIEWER = 15;
/** A video or stream deal is a short campaign: this many videos or streams. */
export const DEAL_VIDEOS = 3;
export const DEAL_STREAMS = 3;
/** Average viewers per follower (the same as the live income model's). */
export const VIEWERS_PER_FOLLOWER = 0.006;
/** A run of host-read ads is this many episodes at this rate per thousand listens. */
export const FLIGHT_EPISODES = 8;
export const SPONSOR_FLIGHT_CPM = 25;
/** Ticket 0703. A brand campaign on a photo channel: this many posts, at this multiple of the going rate for a post. */
export const BRAND_CAMPAIGN_POSTS = 4;
export const BRAND_CAMPAIGN_PREMIUM = 1.5;
/** A short-form campaign: this many clips, each seen by this share of the followers, at this rate per thousand views (influencer CPMs run $5–25). */
export const CAMPAIGN_CLIPS = 5;
export const CLIP_VIEWS_PER_FOLLOWER = 0.3;
export const CLIP_CAMPAIGN_CPM = 15;
/** A newsletter's sponsored issues: this many, at this rate per thousand readers an issue. An assumption, set near the podcast's $25. */
export const SPONSORED_ISSUES = 6;
export const ISSUE_CPM = 30;

export type SponsorAnswer = 'accept' | 'more' | 'decline';

export interface SponsorOffer {
  readonly id: string;
  readonly channelId: string;
  readonly brand: string;
  /** Whole dollars, paid with the year's income. */
  readonly pay: number;
  /** How it is paid on this platform, for wording. */
  readonly monetization: string;
}

const SPONSORED = new Set(['ads', 'live', 'sponsors', 'brands', 'shortAds', 'members']);

/** Whether a deal is big enough to bother with, whole dollars. */
export const worthOffering = (pay: number): boolean => pay >= MIN_SPONSOR_PAY;

/** The chance a brand wants a channel at all, by how far past the paying threshold it is. */
export function brandInterest(audience: number, paysAt: number): number {
  if (audience < paysAt) return 0;
  // At the threshold the log is 0, so the least a brand can want a paying channel is the 0.35.
  return Math.min(0.9, 0.35 + 0.15 * Math.log10(audience / paysAt));
}

/** What a deal pays, whole dollars, given how much of the rate the brand offered (0.6–1.4). */
export function sponsorPay(channel: Channel, rate: number): number {
  const platform = findPlatform(channel.platformId);
  const category = findCreatorCategory(channel.categoryId);
  if (platform === undefined || category === undefined) return 0;
  switch (platform.monetization) {
    case 'ads':
      return Math.round(
        DEAL_VIDEOS *
          ((channel.audience * VIEWS_PER_AUDIENCE) / 1000) *
          SPONSOR_VIDEO_CPM *
          category.pays *
          rate,
      );
    case 'live':
      return Math.round(
        DEAL_STREAMS *
          channel.audience *
          VIEWERS_PER_FOLLOWER *
          SPONSOR_PER_VIEWER *
          category.pays *
          rate,
      );
    case 'sponsors':
      return Math.round(
        FLIGHT_EPISODES * (channel.audience / 1000) * SPONSOR_FLIGHT_CPM * category.pays * rate,
      );
    case 'brands': {
      // The same going rate per follower a photo channel's own brand work is paid at.
      const perPost =
        channel.audience *
        BRAND_RATE *
        (1 + 0.3 * Math.log10(Math.max(1, channel.audience / 10_000)));
      return Math.round(
        BRAND_CAMPAIGN_POSTS * BRAND_CAMPAIGN_PREMIUM * perPost * category.pays * rate,
      );
    }
    case 'shortAds':
      return Math.round(
        CAMPAIGN_CLIPS *
          ((channel.audience * CLIP_VIEWS_PER_FOLLOWER) / 1000) *
          CLIP_CAMPAIGN_CPM *
          category.pays *
          rate,
      );
    case 'members':
      return Math.round(
        SPONSORED_ISSUES * (channel.audience / 1000) * ISSUE_CPM * category.pays * rate,
      );
    default:
      return 0;
  }
}

/** The offers on the table for one channel this year. Derived; nothing about them is saved. */
export function sponsorOffersFor(input: {
  readonly seed: string;
  readonly year: number;
  readonly channel: Channel;
  /** Ticket 0704. An agent lands more deals and bargains them up. */
  readonly agent?: boolean;
}): readonly SponsorOffer[] {
  const { channel } = input;
  const platform = findPlatform(channel.platformId);
  if (platform === undefined || !SPONSORED.has(platform.monetization)) return [];
  const base = brandInterest(channel.audience, platform.paysAt);
  // A group's name opens doors; an agent knocks on more of them.
  const interest =
    base === 0
      ? 0
      : Math.min(
          1,
          Math.min(0.9, base + groupInterest(channel)) *
            (input.agent === true ? AGENT_OFFER_CHANCE : 1),
        );
  if (interest === 0) return [];
  const brands = SPONSOR_BRANDS[channel.categoryId] ?? [];
  if (brands.length === 0) return [];
  const offers: SponsorOffer[] = [];
  for (let slot = 0; slot < MAX_SPONSOR_OFFERS; slot += 1) {
    const key = `${input.seed}:sponsor:${channel.id}:${input.year}:${slot}`;
    if (mixedUnit(`${key}:happens`) >= interest) continue;
    const id = `sp:${input.year}:${channel.id}:${slot}`;
    if (channel.answered?.includes(id)) continue;
    const pay = sponsorPay(
      channel,
      (0.6 + 0.8 * mixedUnit(`${key}:rate`)) * (input.agent === true ? AGENT_PAY : 1),
    );
    if (!worthOffering(pay)) continue;
    offers.push({
      id,
      channelId: channel.id,
      brand: brands[Math.floor(mixedUnit(`${key}:brand`) * brands.length) % brands.length]!,
      pay,
      monetization: platform.monetization,
    });
  }
  return offers;
}

export type SponsorOutcome = 'taken' | 'raised' | 'walked' | 'passed';

export interface SponsorResult {
  readonly channel: Channel;
  readonly outcome: SponsorOutcome;
  /** Whole dollars agreed; 0 unless taken or raised. */
  readonly pay: number;
}

/**
 * Answer an offer. Accepting books the money (paid with the year's income) and
 * costs a little of the audience's trust; asking for more may raise it by 30%
 * or lose it; declining costs nothing.
 */
export function answerSponsor(input: {
  readonly seed: string;
  readonly channel: Channel;
  readonly offer: SponsorOffer;
  readonly answer: SponsorAnswer;
  /** Ticket 0704. With an agent, their share comes off what is owed. */
  readonly agent?: boolean;
}): SponsorResult {
  const { channel, offer } = input;
  const answered = [...(channel.answered ?? []), offer.id];
  if (input.answer === 'decline') {
    return { channel: { ...channel, answered }, outcome: 'passed', pay: 0 };
  }
  let pay = offer.pay;
  let outcome: SponsorOutcome = 'taken';
  if (input.answer === 'more') {
    if (mixedUnit(`${input.seed}:sponsor-more:${offer.id}`) >= MORE_CHANCE) {
      return { channel: { ...channel, answered }, outcome: 'walked', pay: 0 };
    }
    pay = Math.round(offer.pay * (1 + MORE_RAISE));
    outcome = 'raised';
  }
  const trust = findPlatform(channel.platformId)?.trustCost ?? 0;
  return {
    channel: {
      ...channel,
      audience: Math.round(channel.audience * (1 - trust)),
      owed: cents(
        Number(channel.owed ?? 0) +
          (pay - agentShare(input.agent === true ? 'agent' : undefined, pay)) * 100,
      ),
      answered,
    },
    outcome,
    pay,
  };
}
