/**
 * Ticket 0706 — what happens to a creator in a year, and to somebody who is known.
 *
 * 0604 gave a business a bad year with a cause; this does the same for a channel, and
 * gives fame something to read. One event a year at most, drawn by weight from the list in
 * `content/creator-events.ts`. About two years in five are quiet (spec 725–770: busy
 * characters should not be bombarded; "constant disasters should not be normal").
 *
 * Derived, not saved: the draw comes from the seed, the generation, the year and what the
 * character has, so a reload gives the same year. The effects are the only thing that
 * persists, and they persist as what they changed (an audience, a cost on the books, a point
 * of fame).
 *
 * No randomness is drawn from the shared stream.
 */

import {
  CREATOR_EVENTS,
  findCreatorEvent,
  findPlatform,
  type CreatorEventDef,
} from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';
import { collabGain, type Channel } from '@yearafter/finance';
import { fameAudience } from './celebrity';
import { displayFigure, fameIn, notablesIn, type Figure } from './celebrity-world';
import { findCelebrityField } from '@yearafter/content';

/** The share of years in which something happens at all, when there is something that could. */
export const EVENT_CHANCE = 0.45;
/** The fewest people a famous figure's fame has to reach for them to mention a channel. */
export const MENTION_FROM_FAME = 20;
/** A figure's following counts for this much when they pass a channel on to theirs. */
export const MENTION_SHARE = 0.3;

/** What one channel did this year, as far as an event needs to know. */
export interface EventChannel {
  readonly channel: Channel;
  /** Whole dollars it earned this year, before upkeep. */
  readonly gross: number;
}

export interface EventInput {
  /** Seed plus generation: an heir has their own run of luck. */
  readonly key: string;
  /** The year that is beginning. */
  readonly year: number;
  readonly channels: readonly EventChannel[];
  /** Fame after the year. */
  readonly fame: number;
  readonly seed: string;
}

/** An event, with the one channel it is about if it is about one. */
export interface EventPlan {
  readonly def: CreatorEventDef;
  readonly channel?: EventChannel;
  readonly figure?: Figure;
}

function fitsChannel(def: CreatorEventDef, entry: EventChannel): boolean {
  const { channel } = entry;
  const platform = findPlatform(channel.platformId);
  if (platform === undefined) return false;
  if (def.platforms !== undefined && !def.platforms.includes(channel.platformId)) return false;
  if (def.categories !== undefined && !def.categories.includes(channel.categoryId)) return false;
  if (def.minAudience !== undefined && channel.audience < def.minAudience) return false;
  if (def.paid === true && channel.audience < platform.paysAt) return false;
  if (def.effort !== undefined && channel.effort !== def.effort) return false;
  return true;
}

/** Somebody in the public eye who could say something about a channel this year, or nobody. */
export function figureForMention(seed: string, year: number, key: string): Figure | undefined {
  const known = notablesIn(seed, year).filter(
    (figure) => fameIn(figure, year) >= MENTION_FROM_FAME,
  );
  const total = known.reduce((sum, figure) => sum + fameIn(figure, year), 0);
  if (total <= 0) return undefined;
  let along = mixedUnit(`${key}:figure`) * total;
  for (const figure of known) {
    along -= fameIn(figure, year);
    if (along < 0) return figure;
  }
  return known[known.length - 1];
}

/** Every event that could happen this year, each with the channel or person it would be about. */
export function eligibleEvents(input: EventInput): readonly EventPlan[] {
  const plans: EventPlan[] = [];
  for (const def of CREATOR_EVENTS) {
    if (def.scope === 'person') {
      const [low, high] = def.fame ?? [0, 100];
      if (input.fame >= low && input.fame <= high) plans.push({ def });
      continue;
    }
    const fitting = input.channels
      .filter((entry) => fitsChannel(def, entry))
      .sort((a, b) => (a.channel.id < b.channel.id ? -1 : 1));
    if (fitting.length === 0) continue;
    const figure =
      def.figure === true
        ? figureForMention(input.seed, input.year, `${input.key}:${def.id}`)
        : undefined;
    if (def.figure === true && figure === undefined) continue;
    // One of the channels that fit, by a fixed draw: no channel is the favourite.
    const pick =
      fitting[
        Math.floor(mixedUnit(`${input.key}:${def.id}:channel`) * fitting.length) % fitting.length
      ]!;
    plans.push({ def, channel: pick, ...(figure === undefined ? {} : { figure }) });
  }
  return plans;
}

/** The one event this year, or nothing. */
export function drawCreatorEvent(input: EventInput): EventPlan | undefined {
  const plans = eligibleEvents(input);
  if (plans.length === 0) return undefined;
  if (mixedUnit(`${input.key}:happens`) >= EVENT_CHANCE) return undefined;
  const total = plans.reduce((sum, plan) => sum + plan.def.weight, 0);
  let along = mixedUnit(`${input.key}:which`) * total;
  for (const plan of plans) {
    along -= plan.def.weight;
    if (along < 0) return plan;
  }
  return plans[plans.length - 1];
}

export interface EventEffect {
  readonly id: string;
  readonly channelId?: string;
  /** People gained (positive) or lost (negative) by the channel. */
  readonly audience: number;
  /** Whole dollars earned (positive) or held back (negative). */
  readonly income: number;
  /** Whole dollars spent. Never negative. */
  readonly cost: number;
  readonly fame: number;
  readonly mood: number;
  readonly text: string;
  /** What the books say, when something moved money. */
  readonly incomeSource?: string;
  readonly costSource?: string;
}

const between = (range: readonly [number, number], unit: number): number =>
  range[0] + (range[1] - range[0]) * unit;

/** How a drawn event reads and what it does. Pure: the same plan is the same effect. */
export function effectOf(plan: EventPlan, input: EventInput): EventEffect {
  const { def, channel: entry, figure } = plan;
  const unit = (part: string): number => mixedUnit(`${input.key}:${def.id}:${part}`);
  const platform = entry === undefined ? undefined : findPlatform(entry.channel.platformId);
  let audience = 0;
  if (entry !== undefined && figure !== undefined) {
    audience = collabGain(
      entry.channel.audience,
      Math.round(fameAudience(fameIn(figure, input.year)) * MENTION_SHARE),
      0,
    );
  } else if (entry !== undefined && def.audience !== undefined) {
    const share = between(def.audience, unit('size'));
    audience = Math.sign(share) * Math.max(1, Math.round(Math.abs(share) * entry.channel.audience));
    // A channel never loses more people than it has.
    audience = Math.max(-entry.channel.audience, audience);
  }
  let income = 0;
  if (entry !== undefined && def.income !== undefined) {
    const share = between(def.income, unit('income'));
    const raw = Math.round(Math.abs(share) * entry.gross);
    const size = Math.max(def.incomeFloor ?? 0, raw);
    // A claim holds back what the channel earned; it cannot hold back more than that.
    income = share < 0 ? -Math.min(size, Math.max(0, entry.gross)) : size;
  }
  let cost = 0;
  if (entry !== undefined && def.cost !== undefined && platform !== undefined) {
    cost = Math.max(
      def.costFloor ?? 0,
      Math.round(platform.startCost * between(def.cost, unit('cost'))),
    );
  }
  const lines = def.lines;
  const line = lines[Math.floor(unit('line') * lines.length) % lines.length] ?? lines[0] ?? '';
  const format = (n: number): string => Math.abs(Math.round(n)).toLocaleString('en-US');
  const tokens: Readonly<Record<string, string>> = {
    channel: entry?.channel.name ?? '',
    platform: platform?.name ?? 'the platform',
    audience: platform?.audienceWord ?? 'followers',
    gain: format(Math.max(0, audience)),
    loss: format(Math.max(0, -audience)),
    amount: `$${format(income)}`,
    cost: `$${format(cost)}`,
    name: figure === undefined ? '' : displayFigure(figure),
    role: figure === undefined ? '' : (findCelebrityField(figure.field)?.role ?? 'a public figure'),
  };
  return {
    id: def.id,
    ...(entry === undefined ? {} : { channelId: entry.channel.id }),
    audience,
    income,
    cost,
    fame: def.fameChange ?? 0,
    mood: def.mood ?? 0,
    text: line.replace(/\{(\w+)\}/g, (_, token: string) => tokens[token] ?? ''),
    ...(income === 0
      ? {}
      : { incomeSource: `${entry?.channel.name ?? ''}: ${def.incomeLabel ?? 'A one-off'}` }),
    ...(cost === 0
      ? {}
      : { costSource: `${entry?.channel.name ?? ''}: ${def.costLabel ?? 'A one-off cost'}` }),
  };
}

/** The effect of an event by id, for a test or a screen that wants to show one. */
export const knownEvent = (id: string): CreatorEventDef | undefined => findCreatorEvent(id);
