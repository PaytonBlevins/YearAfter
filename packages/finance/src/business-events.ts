/**
 * Ticket 0604 — what happens to a business that nobody chose.
 *
 * 0601 gave a business a year, and a year was a draw from one bell curve. The
 * measurements said what that does: a mature business's profit swung by a
 * factor of two or more from one year to the next for no reason anybody could
 * be shown (finding 37); the cheap trades paid several times their startup
 * every year (finding 38); and five years in, four in five were still open
 * against one in two in the BLS tables. Nothing was ever wrong with a business
 * except the dice.
 *
 * This is the other half of the dice: things that happen, with a name, so the
 * bad year has a cause and the good one is not just a number.
 *
 *   EVENTS      A weighted draw, once a year at most, from a short list. Spec
 *               413: "weighted randomness tuned for pacing, game optimization
 *               and player enjoyment. Constant disasters should not be
 *               normal." About half of all years are quiet, and the good ones
 *               weigh as much as the bad ones.
 *   COMPETITION A rival that opens and, over four years, loses its edge. Spec
 *               414: "matters, but should not be a huge/dominant factor".
 *               Never more than a seventh of the custom, and a good name keeps
 *               more of it. How often one opens depends on how crowded the
 *               trade is, which is how much it costs to get into: a hundred
 *               people can clean houses, and about two can build a resort.
 *
 * Pure functions, whole dollars, no randomness inside. The caller draws the
 * three numbers it needs, so the same year is the same year on every machine
 * and a test can set any draw it likes.
 */

import type { BusinessType } from '@yearafter/content';
import type { MarketState } from './investments';

/* -------------------------------------------------------------------------- */
/* How crowded a trade is                                                       */
/* -------------------------------------------------------------------------- */

const CHEAPEST_STARTUP = 20_000;
const DEAREST_STARTUP = 14_000_000;

/**
 * 1 for the cheapest trade in the catalog, 0 for the dearest, on a log scale.
 * Derived from what it costs to open rather than typed, for the reason 0602
 * derived elasticity: a number typed against thirty-one types drifts, and this
 * one cannot disagree with the startup it is about.
 */
export function crowdingOf(type: Pick<BusinessType, 'startup'>): number {
  const span = Math.log10(DEAREST_STARTUP / CHEAPEST_STARTUP);
  const placed = Math.log10(Math.max(CHEAPEST_STARTUP, type.startup) / CHEAPEST_STARTUP);
  return Math.max(0, Math.min(1, 1 - placed / span));
}

/* -------------------------------------------------------------------------- */
/* A rival                                                                      */
/* -------------------------------------------------------------------------- */

/** Somebody who opened nearby. One at a time; the next waits for this one to fade. */
export interface Rival {
  /** The year they opened. */
  readonly since: number;
  /** The share of custom they took at the start, before anybody's name counts for anything. 0.04–0.15. */
  readonly bite: number;
}

/** Years, counting the one it opened in, until a rival has lost the edge of being new. */
export const RIVAL_YEARS = 4;
export const RIVAL_BITE_MIN = 0.04;
export const RIVAL_BITE_MAX = 0.15;

/**
 * How much of a trade's custom a rival takes when it opens: a little in a trade
 * with few of them, a good deal in one with many.
 */
export const rivalBiteFor = (crowding: number, draw: number): number =>
  Math.min(
    RIVAL_BITE_MAX,
    RIVAL_BITE_MIN + (RIVAL_BITE_MAX - RIVAL_BITE_MIN) * crowding * (0.45 + 0.55 * clampUnit(draw)),
  );

/** A good name holds on to its customers. Ordinary at the opening name; under half at the top. */
export const reputationShield = (reputation: number): number =>
  Math.max(0.45, Math.min(1, 1.25 - reputation / 100));

/** Whether the rival is still a rival this year. */
export const rivalIsLive = (rival: Rival | undefined, year: number): rival is Rival =>
  rival !== undefined && year - rival.since < RIVAL_YEARS;

/**
 * The share of custom the rival takes this year. Customers drift over after
 * the year it opens, not during it: three quarters of the bite in the first
 * full year, half in the next, a quarter in the third, and then nothing. A
 * good reputation keeps most of what it would have taken.
 */
export function rivalTake(rival: Rival | undefined, year: number, reputation: number): number {
  if (!rivalIsLive(rival, year)) return 0;
  const left = 1 - Math.max(0, year - rival.since) / RIVAL_YEARS;
  return rival.bite * left * reputationShield(reputation);
}

/* -------------------------------------------------------------------------- */
/* The events                                                                   */
/* -------------------------------------------------------------------------- */

export type EventTone = 'good' | 'bad';

/** Who an event can happen to. A shop with no staff has nobody who can leave. */
export type EventNeeds = 'supplier' | 'people' | 'fittings';

export type EventEffect = 'rivalOpens' | 'rivalCloses';

export interface BusinessEvent {
  readonly id: string;
  readonly tone: EventTone;
  /** Weight in the draw, at a neutral year, for a trade it can happen to. */
  readonly weight: number;
  readonly needs?: EventNeeds;
  /** The year's demand, as a multiplier, at the low and high end of how big it was. */
  readonly demand?: readonly [number, number];
  /** What the goods cost, as a multiplier. */
  readonly cogs?: readonly [number, number];
  /** What the lease and insurance cost, as a multiplier. */
  readonly overhead?: readonly [number, number];
  /**
   * A one-off cost, as a share of a year at maturity (the type's `revenue`).
   * Negative is money in. Sized to the business, so a hotel's breakdown is a
   * hotel's.
   */
  readonly extra?: readonly [number, number];
  /** Points of reputation, added when the year closes. */
  readonly reputation?: number;
  readonly effect?: EventEffect;
  /** What the year's line says. `{name}` is the business. Spoken, not reported. */
  readonly line: string;
}

export const BUSINESS_EVENTS: readonly BusinessEvent[] = [
  {
    id: 'big-order',
    tone: 'good',
    weight: 3,
    demand: [1.06, 1.16],
    line: '{name} landed a big order, and it was a busy year for it.',
  },
  {
    id: 'write-up',
    tone: 'good',
    weight: 2,
    demand: [1.03, 1.07],
    reputation: 5,
    line: '{name} got a good write-up in the local paper.',
  },
  {
    id: 'referrals',
    tone: 'good',
    weight: 2,
    needs: 'people',
    demand: [1.04, 1.08],
    reputation: 3,
    line: "A few of {name}'s regulars sent their friends in.",
  },
  {
    id: 'contract-renewed',
    tone: 'good',
    weight: 2,
    needs: 'people',
    demand: [1.05, 1.1],
    line: 'A steady customer renewed with {name} for another year, at a better rate.',
  },
  {
    id: 'better-price',
    tone: 'good',
    weight: 2,
    needs: 'supplier',
    cogs: [0.88, 0.94],
    line: '{name} got a better price from a supplier this year.',
  },
  {
    id: 'cheaper-rent',
    tone: 'good',
    weight: 1.5,
    overhead: [0.8, 0.9],
    line: "The landlord cut {name}'s rent for the year.",
  },
  {
    id: 'one-off-job',
    tone: 'good',
    weight: 1.5,
    extra: [-0.09, -0.05],
    line: '{name} had a one-off job that paid well.',
  },
  {
    id: 'rival-closes',
    tone: 'good',
    weight: 2.5,
    demand: [1.02, 1.05],
    effect: 'rivalCloses',
    line: "A competitor of {name}'s shut its doors, and some of its customers came over.",
  },
  {
    id: 'slow-stretch',
    tone: 'bad',
    weight: 3,
    demand: [0.88, 0.95],
    line: "{name} had a slow stretch and the customers didn't come.",
  },
  {
    id: 'breakdown',
    tone: 'bad',
    weight: 2.5,
    needs: 'fittings',
    extra: [0.015, 0.045],
    line: "Something broke at {name}, and it wasn't cheap to fix.",
  },
  {
    id: 'key-leaver',
    tone: 'bad',
    weight: 2,
    needs: 'people',
    extra: [0.01, 0.025],
    reputation: -2,
    line: 'A key person left {name}, and it cost money to replace them.',
  },
  {
    id: 'supplier-hike',
    tone: 'bad',
    weight: 2,
    needs: 'supplier',
    cogs: [1.05, 1.1],
    line: '{name} had a supplier put its prices up.',
  },
  {
    id: 'bad-review',
    tone: 'bad',
    weight: 1.5,
    demand: [0.94, 0.98],
    reputation: -5,
    line: '{name} had a bad run of reviews, and it hurt its name.',
  },
  {
    id: 'theft',
    tone: 'bad',
    weight: 1,
    extra: [0.007, 0.02],
    line: '{name} lost money to theft and damage.',
  },
  {
    id: 'dispute',
    tone: 'bad',
    weight: 0.7,
    needs: 'people',
    extra: [0.02, 0.05],
    reputation: -3,
    line: "{name} settled a dispute with a customer, and it wasn't cheap.",
  },
  {
    id: 'lost-client',
    tone: 'bad',
    weight: 1.5,
    needs: 'people',
    demand: [0.72, 0.86],
    reputation: -1,
    line: '{name} lost a big client, and the work went with them.',
  },
  {
    id: 'lease-lost',
    tone: 'bad',
    weight: 0.8,
    extra: [0.05, 0.1],
    reputation: -4,
    line: "{name}'s landlord wouldn't renew the lease, and moving was a big expense.",
  },
  {
    id: 'rent-rise',
    tone: 'bad',
    weight: 1,
    overhead: [1.08, 1.18],
    line: "The landlord put {name}'s rent up.",
  },
  {
    id: 'rival-opens',
    tone: 'bad',
    weight: 2.5,
    effect: 'rivalOpens',
    line: 'Somebody opened up a rival to {name} down the road.',
  },
];

const BY_ID = new Map(BUSINESS_EVENTS.map((event) => [event.id, event]));
export const findBusinessEvent = (id: string): BusinessEvent | undefined => BY_ID.get(id);

/** About half of all years have something in them. Spec 413: constant disasters should not be normal. */
export const EVENT_CHANCE = 0.55;

/**
 * A trade where wages are a real part of what it costs: somebody there can
 * leave, or sue. A quarter of revenue: it takes in the services and the
 * manufacturers and leaves out the shops, where the stock is the business and
 * the one clerk is not. (At a seventh, the first setting, every trade in the
 * catalog qualified and the rule did nothing; a mutation test found it.)
 */
const PEOPLE_SHARE = 0.25;
/** A trade with real equipment: something there can break. */
const FITTINGS_SHARE = 0.3;

/** Whether the event can happen to this kind of business at all. */
export function canHappenTo(event: BusinessEvent, type: BusinessType, rivalLive: boolean): boolean {
  if (event.needs === 'supplier' && !type.supplier) return false;
  if (event.needs === 'people' && (type.staff * type.wage) / type.revenue < PEOPLE_SHARE)
    return false;
  if (event.needs === 'fittings' && type.assetShare < FITTINGS_SHARE) return false;
  // One rival at a time, and nobody to see off when there is none.
  if (event.effect === 'rivalOpens' && rivalLive) return false;
  if (event.effect === 'rivalCloses' && !rivalLive) return false;
  return true;
}

export interface EventContext {
  readonly year: number;
  readonly market: MarketState;
  /** Full years since it opened; 0 in the first. */
  readonly age: number;
  readonly rival: Rival | undefined;
}

/**
 * What the world does to the odds, not to the damage. A recession makes the
 * slow stretches more common and a boom makes the big orders so; hard times
 * make fewer people open a shop and more of them shut one. A young business has
 * less to fall back on, so the bad draw lands on it more often.
 */
export function weightOf(event: BusinessEvent, type: BusinessType, context: EventContext): number {
  if (!canHappenTo(event, type, rivalIsLive(context.rival, context.year))) return 0;
  let weight = event.weight;
  if (event.effect === 'rivalOpens') weight *= 0.5 + 1.5 * crowdingOf(type);
  if (event.id === 'lost-client') weight *= 0.6 + 1.0 * crowdingOf(type);
  if (event.tone === 'bad') weight *= 1 + YOUTH_EXTRA * Math.exp(-Math.max(0, context.age) / 2);
  const hard = context.market === 'recession' || context.market === 'severeRecession';
  const hardest = context.market === 'severeRecession';
  const good = context.market === 'growth' || context.market === 'strongExpansion';
  if (event.id === 'slow-stretch')
    weight *= hardest ? 2.2 : hard ? 1.6 : context.market === 'slowdown' ? 1.25 : 1;
  if (event.effect === 'rivalOpens') weight *= hard ? 0.5 : good ? 1.2 : 1;
  if (event.effect === 'rivalCloses') weight *= hard ? 2 : 1;
  if (event.id === 'big-order') weight *= good ? 1.3 : hard ? 0.75 : 1;
  return weight;
}

/** How much likelier a bad draw is for a business in its first year; it fades over a few. */
export const YOUTH_EXTRA = 0.5;

/** The three numbers a year needs, each in [0, 1). */
export interface EventDraws {
  /** Whether anything happened. */
  readonly happens: number;
  /** Which of the events, by weight. */
  readonly pick: number;
  /** How big, between the event's low and high. */
  readonly size: number;
}

export interface HappenedEvent {
  readonly event: BusinessEvent;
  /** 0 is the low end of what the event can do, 1 the high end. */
  readonly size: number;
}

/** What happened to this business this year, if anything. */
export function drawEvent(
  type: BusinessType,
  context: EventContext,
  draws: EventDraws,
): HappenedEvent | undefined {
  if (clampUnit(draws.happens) >= EVENT_CHANCE) return undefined;
  const weights = BUSINESS_EVENTS.map((event) => weightOf(event, type, context));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return undefined;
  let left = clampUnit(draws.pick) * total;
  for (let index = 0; index < BUSINESS_EVENTS.length; index += 1) {
    left -= weights[index] ?? 0;
    if (left < 0) return { event: BUSINESS_EVENTS[index]!, size: clampUnit(draws.size) };
  }
  // A draw of exactly 1 after rounding: the last event with any weight.
  const last = weights
    .map((weight, index) => (weight > 0 ? index : -1))
    .filter((index) => index >= 0)
    .pop();
  return last === undefined
    ? undefined
    : { event: BUSINESS_EVENTS[last]!, size: clampUnit(draws.size) };
}

/* -------------------------------------------------------------------------- */
/* What an event does to a year                                                 */
/* -------------------------------------------------------------------------- */

/** The numbers `businessYear` takes from the year's event. All neutral by default. */
export interface YearModifiers {
  /** Multiplies the year's custom. */
  readonly demand: number;
  /** Multiplies what the goods cost. */
  readonly cogs: number;
  /** Multiplies the lease and insurance. */
  readonly overhead: number;
  /** A one-off, as a share of a year at maturity. Negative is money in. */
  readonly extra: number;
}

export const NO_MODIFIERS: YearModifiers = { demand: 1, cogs: 1, overhead: 1, extra: 0 };

const between = (
  range: readonly [number, number] | undefined,
  size: number,
  none: number,
): number => (range === undefined ? none : range[0] + (range[1] - range[0]) * clampUnit(size));

export function modifiersFor(happened: HappenedEvent | undefined): YearModifiers {
  if (!happened) return NO_MODIFIERS;
  const { event, size } = happened;
  return {
    demand: between(event.demand, size, 1),
    cogs: between(event.cogs, size, 1),
    overhead: between(event.overhead, size, 1),
    extra: between(event.extra, size, 0),
  };
}

/** Points of reputation the event leaves behind. */
export const reputationChangeOf = (happened: HappenedEvent | undefined): number =>
  happened?.event.reputation ?? 0;

/** The line for a year's news, with the business's name in it. */
export const eventLineFor = (event: BusinessEvent, name: string): string =>
  event.line.replace('{name}', name);

/**
 * The rival after a year in which `happened`: opened if one opened, gone if
 * one closed, worn out if it has outlived `RIVAL_YEARS`, otherwise unchanged.
 */
export function rivalAfter(
  rival: Rival | undefined,
  happened: HappenedEvent | undefined,
  type: Pick<BusinessType, 'startup'>,
  year: number,
  biteDraw: number,
): Rival | undefined {
  if (happened?.event.effect === 'rivalOpens') {
    return { since: year, bite: rivalBiteFor(crowdingOf(type), biteDraw) };
  }
  if (happened?.event.effect === 'rivalCloses') return undefined;
  return rivalIsLive(rival, year + 1) ? rival : undefined;
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(0.999999999, value));
}
