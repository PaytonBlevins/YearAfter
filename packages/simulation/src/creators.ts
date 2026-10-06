/**
 * Ticket 0701 — the character as a creator.
 *
 * What a channel EARNS in a year is posted as a `creator` row, and what keeping
 * it going cost as a negative `creator` row, so the net is what is taxed (the
 * way a self-employed person's is). What it cost to START is a `spending` row.
 * Nothing about a channel's outcome is saved except the channel: its luck is
 * drawn when it opens, and every year after is arithmetic on the year.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import { SPONSOR_KIND, creatorLine, findCreatorCategory, findPlatform } from '@yearafter/content';
import { dollars, err, ok, stablePick, type Result } from '@yearafter/core';
import {
  answerSponsor,
  chartRank,
  channelYear,
  creatorHours,
  creatorQuality,
  sponsorOffersFor,
  trendsFor,
  fameTarget,
  groupBoost,
  groupShare,
  growthBoost,
  hoursFactor,
  managerShare,
  newChannel,
  nextFame,
  post,
  whyNotOpen,
  withEffort,
  type Channel,
  type ChannelRefusal,
  type Effort,
  type NewTransaction,
  type PaidTier,
  type Representation,
  type SponsorAnswer,
  type SponsorOffer,
  type TrendRow,
} from '@yearafter/finance';
import type { GameState } from './game-state';

const statOf = (stats: Readonly<Record<string, number>>, key: string): number => {
  const value = stats[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 50;
};

/** How good this person's work is in a category this year: its two stats, and a talent if it has one. */
export function qualityOf(
  stats: Readonly<Record<string, number>>,
  talents: Readonly<Record<string, boolean>>,
  categoryId: string,
): number {
  const category = findCreatorCategory(categoryId);
  if (category === undefined) return creatorQuality(50, false);
  const skill = (statOf(stats, category.skills[0]) + statOf(stats, category.skills[1])) / 2;
  const talented = category.talent !== undefined && talents[category.talent] === true;
  return creatorQuality(skill, talented);
}

export const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

/** What a chart tier is called in a sentence. */
export const placeOf = (tier: number): string =>
  tier === 1 ? 'number one' : `the top ${tier.toLocaleString('en-US')}`;

export function wording(
  kind: Parameters<typeof creatorLine>[0],
  channel: Channel,
  tokens: Readonly<Record<string, string>>,
  key: string,
): string {
  const platform = findPlatform(channel.platformId);
  return creatorLine(
    kind,
    key,
    {
      name: channel.name,
      platform: platform?.name ?? 'the platform',
      audience: platform?.audienceWord ?? 'followers',
      ...tokens,
    },
    (lines, k) => stablePick(lines, k) ?? lines[0] ?? '',
  );
}

export function entryFor(state: GameState, text: string, key: string): TimelineEntry {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'milestone',
    text,
    id: `t:${state.world.year}:${key}`,
    sequence,
  });
}

/** What opening this one would be refused for, or undefined. */
export function whyNotChannel(
  state: GameState,
  platformId: string,
  categoryId: string,
): ChannelRefusal | undefined {
  return whyNotOpen({
    age: state.player.age,
    liquid: Math.floor(Number(state.player.cash) / 100),
    held: state.channels,
    platformId,
    categoryId,
  });
}

/** Start a channel. The gear is paid for at once; the audience starts at nobody. */
export function openChannel(
  state: GameState,
  platformId: string,
  categoryId: string,
): Result<GameState, ChannelRefusal> {
  const refusal = whyNotChannel(state, platformId, categoryId);
  if (refusal !== undefined) return err(refusal);
  const platform = findPlatform(platformId)!;
  const channel = newChannel({
    seed: state.rng.getSeed(),
    id: `ch:${state.world.year}:${platformId}:${categoryId}`,
    platformId,
    categoryId,
    year: state.world.year,
  });
  const books = post(state.finance, state.world.year, state.player.age, {
    category: 'spending',
    amount: dollars(-platform.startCost),
    source: `Setting up ${channel.name}`,
  });
  const entry = entryFor(
    state,
    wording('opened', channel, {}, `creator:opened:${channel.id}`),
    `creator:opened:${channel.id}`,
  );
  return ok({
    ...state,
    finance: books.ledger,
    channels: [...state.channels, channel],
    player: {
      ...state.player,
      cash: books.ledger.balance,
      timeline: appendToTimeline(state.player.timeline, entry),
    },
  });
}

/** How much of themselves they give a channel. Takes effect from the next year. */
export function setChannelEffort(
  state: GameState,
  channelId: string,
  effort: Effort,
): Result<GameState, { readonly kind: 'noSuchChannel' }> {
  if (!state.channels.some((channel) => channel.id === channelId)) {
    return err({ kind: 'noSuchChannel' });
  }
  return ok({
    ...state,
    channels: state.channels.map((channel) =>
      channel.id === channelId ? withEffort(channel, effort) : channel,
    ),
  });
}

export type PaidTierRefusal =
  { readonly kind: 'noSuchChannel' } | { readonly kind: 'notSubscription' };

/**
 * Ticket 0703. What a month costs a reader of a subscription channel. Takes effect from the next
 * year, and the paying readers move toward the new price's share rather than jumping to it.
 */
export function setPaidTier(
  state: GameState,
  channelId: string,
  tier: PaidTier,
): Result<GameState, PaidTierRefusal> {
  const found = state.channels.find((channel) => channel.id === channelId);
  if (found === undefined) return err({ kind: 'noSuchChannel' });
  if (findPlatform(found.platformId)?.monetization !== 'members') {
    return err({ kind: 'notSubscription' });
  }
  return ok({
    ...state,
    channels: state.channels.map((channel) =>
      channel.id === channelId ? { ...channel, tier } : channel,
    ),
  });
}

/** Stop making one. Its audience goes with it; fame fades on its own. */
export function closeChannel(
  state: GameState,
  channelId: string,
): Result<GameState, { readonly kind: 'noSuchChannel' }> {
  const channel = state.channels.find((row) => row.id === channelId);
  if (channel === undefined) return err({ kind: 'noSuchChannel' });
  const entry = entryFor(
    state,
    wording('closed', channel, {}, `creator:closed:${channel.id}`),
    `creator:closed:${channel.id}`,
  );
  return ok({
    ...state,
    channels: state.channels.filter((row) => row.id !== channelId),
    player: {
      ...state.player,
      timeline: appendToTimeline(state.player.timeline, entry),
    },
  });
}

/** The hours a week the character's channels ask of them: a manager gives a third of it back. */
export const creatorWeek = (state: GameState): number =>
  creatorHours(state.channels, hoursFactor(state.representation));

/** What a year of channels did: the channels after it, fame, the money, and the words. */
export interface CreatorsYear {
  readonly channels: readonly Channel[];
  readonly fame: number;
  readonly transactions: readonly NewTransaction[];
  readonly lines: readonly string[];
  /** Whole dollars earned across every channel, before upkeep and tax. */
  readonly gross: number;
  /** Whole dollars earned net of upkeep, never below zero: what is taxed. */
  readonly net: number;
}

/** A year of every channel held. `year` is the year that is beginning. */
export function runCreatorsYear(input: {
  readonly channels: readonly Channel[];
  readonly fame: number;
  readonly year: number;
  readonly stats: Readonly<Record<string, number>>;
  readonly talents: Readonly<Record<string, boolean>>;
  /** Ticket 0704. Whoever looks after the business side, if anybody. */
  readonly representation?: Representation;
}): CreatorsYear {
  const transactions: NewTransaction[] = [];
  const lines: string[] = [];
  let gross = 0;
  let upkeep = 0;
  let shares = 0;
  const channels = input.channels.map((channel) => {
    const result = channelYear({
      channel,
      year: input.year,
      quality: qualityOf(input.stats, input.talents, channel.categoryId),
      boost: growthBoost(input.representation) * groupBoost(channel),
    });
    const income = Math.round(Number(result.income) / 100);
    const cost = Math.round(Number(result.cost) / 100);
    gross += income;
    upkeep += cost;
    if (income > 0) {
      transactions.push({
        category: 'creator',
        amount: dollars(income),
        source: `${channel.name}`,
      });
    }
    if (cost > 0) {
      transactions.push({
        category: 'creator',
        amount: dollars(-cost),
        source: `Upkeep on ${channel.name}`,
      });
    }
    const groupKept = groupShare(channel, income);
    if (groupKept > 0 && channel.group !== undefined) {
      shares += groupKept;
      transactions.push({
        category: 'creator',
        amount: dollars(-groupKept),
        source: `${channel.group.name}'s share of ${channel.name}`,
      });
    }
    for (const note of result.notes) {
      lines.push(
        wording(
          note.kind,
          result.channel,
          note.kind === 'milestone'
            ? { mark: Math.round(note.mark).toLocaleString('en-US') }
            : note.kind === 'chart'
              ? { place: placeOf(note.tier) }
              : note.kind === 'viral'
                ? { gained: Math.round(note.gained).toLocaleString('en-US') }
                : {},
          `creator:${channel.id}:${note.kind}:${input.year}`,
        ),
      );
    }
    return result.channel;
  });
  const managerKept = managerShare(input.representation, gross);
  if (managerKept > 0) {
    shares += managerKept;
    transactions.push({
      category: 'creator',
      amount: dollars(-managerKept),
      source: "Your manager's share",
    });
  }
  const net = Math.max(0, gross - upkeep - shares);
  return {
    channels,
    fame: nextFame(input.fame, fameTarget(channels)),
    transactions,
    lines,
    gross,
    net,
  };
}

/* -------------------------------------------------------------------------- */
/* What the screen shows and asks (ticket 0702)                                  */
/* -------------------------------------------------------------------------- */

export interface ChannelOffer {
  readonly offer: SponsorOffer;
  readonly channel: Channel;
}

/** Every sponsorship on the table this year, across every channel. */
export function sponsorOffers(state: GameState): readonly ChannelOffer[] {
  return state.channels.flatMap((channel) =>
    sponsorOffersFor({
      seed: state.rng.getSeed(),
      year: state.world.year,
      channel,
      agent: state.representation === 'agent',
    }).map((offer) => ({ offer, channel })),
  );
}

export type SponsorRefusal = { readonly kind: 'notOffered' };

/**
 * Accept, ask for more, or decline. The money is paid with the year's income and taxed with it;
 * nothing moves in the books now.
 */
export function answerSponsorOffer(
  state: GameState,
  offerId: string,
  answer: SponsorAnswer,
): Result<GameState, SponsorRefusal> {
  const found = sponsorOffers(state).find((row) => row.offer.id === offerId);
  if (found === undefined) return err({ kind: 'notOffered' });
  const result = answerSponsor({
    seed: state.rng.getSeed(),
    channel: found.channel,
    offer: found.offer,
    answer,
    agent: state.representation === 'agent',
  });
  const kind = {
    taken: 'sponsorTaken',
    raised: 'sponsorRaised',
    walked: 'sponsorWalked',
    passed: 'sponsorPassed',
  }[result.outcome] as 'sponsorTaken' | 'sponsorRaised' | 'sponsorWalked' | 'sponsorPassed';
  const text = wording(
    kind,
    result.channel,
    {
      brand: found.offer.brand,
      pay: money(result.pay),
      kind: SPONSOR_KIND[found.offer.monetization] ?? 'a sponsorship',
    },
    `creator:${offerId}:${result.outcome}`,
  );
  return ok({
    ...state,
    channels: state.channels.map((channel) =>
      channel.id === found.channel.id ? result.channel : channel,
    ),
    player: {
      ...state.player,
      timeline: appendToTimeline(
        state.player.timeline,
        entryFor(state, text, `creator:sponsor:${offerId}`),
      ),
    },
  });
}

/** Where each channel stands on its platform's chart, if it is on one. */
export function chartStandings(
  state: GameState,
): readonly { readonly channel: Channel; readonly rank: number | undefined }[] {
  return state.channels.map((channel) => ({ channel, rank: chartRank(channel) }));
}

/** What is in fashion on a platform this year. */
export const trendsOn = (state: GameState, platformId: string): readonly TrendRow[] =>
  trendsFor(platformId, state.world.year);
