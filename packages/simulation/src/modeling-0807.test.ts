/**
 * Ticket 0807 acceptance tests — modeling.
 *
 * Six rungs from a test shoot to the face of a fashion house; a job is a day rate, days and a usage fee; a craft read
 * off looks and charisma and no talent; work that comes by being seen, by going to castings, or through an agency
 * that takes the most New York allows; an age window; brand deals on the creators' own sponsor rules; a network
 * backstage; and that a life that goes near none of it replays as it did. Each pin that is a real figure says so.
 */

import { describe, expect, it } from 'vitest';
import { cents, dollars, mixedUnit } from '@yearafter/core';
import {
  CELEBRITY_LINES,
  MODEL_AGE_FLOOR,
  MODEL_AGE_PEAK_END,
  MODEL_AGE_RATE,
  MODEL_AGENCY_ASK_BONUS,
  MODEL_AGENCY_CUT,
  MODEL_AGENCY_MIN_CREDITS,
  MODEL_AGENCY_OFFER_MULTIPLIER,
  MODEL_AGENCY_SLOT_CHANCE,
  MODEL_AGENCY_SUBMISSIONS,
  MODEL_APPLICATIONS_PER_YEAR,
  MODEL_APPLY_AGENCY_BONUS,
  MODEL_APPLY_BASE,
  MODEL_APPLY_CRAFT_WEIGHT,
  MODEL_APPLY_PLACEMENT,
  MODEL_APPLY_REPUTATION_WEIGHT,
  MODEL_ASK_BASE,
  MODEL_ASK_GAIN,
  MODEL_ASK_REPUTATION_WEIGHT,
  MODEL_AWARD_CEREMONY,
  MODEL_AWARD_CHANCE,
  MODEL_AWARD_LINE,
  MODEL_AWARD_MOOD,
  MODEL_AWARD_NAMES,
  MODEL_AWARD_REPUTATION,
  MODEL_BLS_MEDIAN_HOURLY,
  MODEL_BLS_MEDIAN_YEAR,
  MODEL_BRAND_CATEGORY,
  MODEL_BRAND_PLATFORM,
  MODEL_CASTINGS,
  MODEL_CHANNEL_CATEGORIES,
  MODEL_CHANNEL_SHARE,
  MODEL_CLIENTS,
  MODEL_CRAFT_HEADROOM,
  MODEL_CREDIT_CRAFT,
  MODEL_CREDIT_CRAFT_CAP,
  MODEL_FLOP_MARGIN,
  MODEL_FLOP_REPUTATION,
  MODEL_FOLLOWER_CHURN,
  MODEL_HITS_TO_RISE,
  MODEL_HIT_FOLLOWERS,
  MODEL_HIT_REPUTATION,
  MODEL_IDLE_FALL_YEARS,
  MODEL_IDLE_REPUTATION,
  MODEL_LIVING_WAGE,
  MODEL_NEGOTIABLE_FROM,
  MODEL_NETWORK_CREDITS,
  MODEL_OFFER_TIER_WEIGHTS,
  MODEL_PERFORMANCE_NOISE,
  MODEL_PLACEMENTS,
  MODEL_PLACEMENT_DAYS,
  MODEL_PLACEMENT_FEE,
  MODEL_PLACEMENT_FOLLOWERS,
  MODEL_PLACEMENT_PHRASE,
  MODEL_PLACEMENT_REPUTATION,
  MODEL_PORTFOLIO_COST,
  MODEL_PORTFOLIO_COST_SOURCE,
  MODEL_PORTFOLIO_MIN_AGE,
  MODEL_REPUTATION_OFFER_RANGE,
  MODEL_RISE_LINES,
  MODEL_RISE_WINDOW_END,
  MODEL_SEEN_YEARS,
  MODEL_TIERS,
  MODEL_TIER_ROWS,
  MODEL_YEAR_DAYS,
  SPONSOR_BRANDS,
  findCelebrityField,
  modelAgeScale,
  modelDayRate,
  modelFameOf,
  modelJobDays,
  modelJobFee,
  modelPlacementFor,
  modelReputationWord,
  modelRoundFee,
  modelRoundRate,
  modelTierRank,
  modelUsageFee,
  naturalModelCraft,
  stepModelTier,
  type ModelTier,
} from '@yearafter/content';
import {
  totalFor,
  MORE_CHANCE,
  MORE_RAISE,
  MAX_SPONSOR_OFFERS,
  sponsorOffersFor,
  type PrivateDeal,
} from '@yearafter/finance';
import { findJob } from '@yearafter/careers';
import { advanceYear } from './advance';
import { fieldPull, encounterMultiplier, pullsOf, sceneFor } from './celebrity';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createGameState, hasSystemicOffer } from './game-state';
import {
  MODELING_ERROR_LABELS,
  MODELING_OFFER_EVENT_ID,
  MODEL_MAX_OFFERS,
  MODEL_NOT_READY_LABELS,
  answerModelBrand,
  answerModelingOffer,
  applyToModelCall,
  emptyModelingYear,
  isModelSeen,
  isModelingFullTime,
  isModelingOfferDecision,
  jobFee,
  leaveAgency,
  makeModelJob,
  modelApplicationsAllowed,
  modelAskChance,
  modelBrandOffers,
  modelCalls,
  modelChannel,
  modelCraftCeiling,
  modelCraftOf,
  modelFreeDays,
  modelNotReadyFor,
  modelOfferSlots,
  modelSlotScale,
  modelTierDrawn,
  modelUnit,
  modelingChoicesOf,
  modelingOccupation,
  modelingOfferDecision,
  nextModelCraft,
  paysOwnPortfolio,
  runModelingYear,
  shootPortfolio,
  signWithAgency,
  withModelAudience,
  withModelingOffer,
} from './modeling';
import type { ModelingYearLine } from './modeling';
import { EMPTY_MODELING, type BookedJob, type Job, type ModelingState } from './modeling-state';
import { createNewGame } from './new-game';
import { openChannel } from './creators';
import { withAnyOffer } from './offers';
import { businessTaxOn } from './businesses';
import { eulogyFor } from './eulogy';
import { encounterChance } from './celebrity';
import { money } from './sports-core';
import { dealTaxOn } from './deals';
import type { BookedRole } from './acting-state';
import type { LabelDeal, MusicState } from './music-state';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function answerOthers(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending.find((row) => row.eventId !== MODELING_OFFER_EVENT_ID);
    const choice =
      open?.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : open?.choices[0];
    if (!open || !choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

const life = (seed: string): GameState => createNewGame({ seed });

function toAge(state: GameState, age: number): GameState {
  let current = state;
  let guard = 0;
  while (current.player.alive && current.player.age < age && (guard += 1) < 80) {
    current = answerOthers(advanceYear(answerOthers(current)).state);
  }
  return current;
}

/**
 * An adult life brought to the age, memoised. A life that dies on the way is replaced by the next of the same name
 * ("name~1"), so every test that asks for an adult gets a living one (CORE_RULES 13.152).
 */
const adults = new Map<string, GameState>();
function adult(seed: string, age = 26): GameState {
  const key = `${seed}:${age}`;
  const found = adults.get(key);
  if (found) return found;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const made = toAge(life(attempt === 0 ? seed : `${seed}~${attempt}`), age);
    if (made.player.alive && made.player.age >= age) {
      adults.set(key, made);
      return made;
    }
  }
  throw new Error(`no living life of age ${age} for ${seed}`);
}

const withModeling = (state: GameState, patch: Partial<ModelingState>): GameState => ({
  ...state,
  modeling: { ...state.modeling, ...patch },
});

type StatName = 'charisma' | 'looks' | 'smarts' | 'discipline' | 'health' | 'happiness';
const withStats = (state: GameState, stats: Partial<Record<StatName, number>>): GameState => ({
  ...state,
  player: { ...state.player, stats: { ...state.player.stats, ...stats } as never },
});

/** Money that came from somewhere: a gift in the ledger, so the books balance after a full year (13.154). */
const windfall = (state: GameState, amount: number): GameState => {
  const books = {
    ...state.finance,
    balance: (Number(state.finance.balance) + amount * 100) as never,
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:test-${amount}`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: (amount * 100) as never,
        source: 'A test windfall',
      },
    ],
  };
  return { ...state, finance: books, player: { ...state.player, cash: books.balance } };
};

/** A model who has worked: a craft, a rung, some credits and a following. */
const known = (state: GameState, patch: Partial<ModelingState> = {}): GameState =>
  withModeling(state, {
    craft: 60,
    credits: 12,
    tier: 'catalogue',
    reputation: 20,
    followers: 5_000,
    peak: 5_000,
    seenAge: state.player.age,
    ...patch,
  });

const yearOf = (before: GameState, age = before.player.age + 1, year = before.world.year + 1) =>
  runModelingYear({ before, age, year });

const seedOf = (state: GameState) => state.rng.getSeed();
const genOf = (state: GameState) => state.world.generation;

/** The first life of a numbered set that satisfies `pick`, failing loudly when none does (13.146). */
function firstSeed<T>(prefix: string, pick: (seed: string) => T | undefined, tries = 80): T {
  for (let index = 0; index < tries; index += 1) {
    const found = pick(`${prefix}-${index}`);
    if (found !== undefined) return found;
  }
  throw new Error(`no life of ${tries} satisfied the test for ${prefix}`);
}

/** The first year (the draws change with it) in which `pick` finds something to return. */
function firstYear<T>(from: number, pick: (year: number) => T | undefined, tries = 400): T {
  for (let year = from; year < from + tries; year += 1) {
    const found = pick(year);
    if (found !== undefined) return found;
  }
  throw new Error(`no year of ${tries} satisfied the test from ${from}`);
}

const job = (over: Partial<Job> = {}): Job => ({
  id: '26:0',
  tier: 'catalogue',
  placement: 'featured',
  medium: 'a catalogue shoot',
  client: 'Calloway Outfitters',
  rate: 1_000,
  days: 10,
  usage: 500,
  source: 'asked',
  age: 26,
  ...over,
});

const booked = (over: Partial<BookedJob> = {}): BookedJob => ({
  id: '25:0',
  tier: 'catalogue',
  placement: 'featured',
  medium: 'a catalogue shoot',
  client: 'Calloway Outfitters',
  rate: 1_000,
  days: 10,
  usage: 500,
  age: 25,
  bookedAge: 25,
  ...over,
});

/**
 * The craft that makes a job's performance come out at `performance` exactly, from the draw the engine uses. The
 * engine puts craft + (draw − ½) × 30 against the rung's line, so this is how a test says "a hit", "a flop" or "neither".
 */
const craftFor = (state: GameState, year: number, id: string, performance: number): number =>
  performance -
  (modelUnit(seedOf(state), genOf(state), 'perf', year, id) - 0.5) * MODEL_PERFORMANCE_NOISE;

/** A model with one booked job whose performance will be `performance`, run through its year. */
function shot(
  base: GameState,
  performance: number,
  over: Partial<BookedJob> = {},
  patch: Partial<ModelingState> = {},
) {
  const row = booked(over);
  const year = base.world.year + 1;
  const state = known(base, {
    craft: craftFor(base, year, row.id, performance),
    booked: [row],
    ...patch,
  });
  return { state, out: yearOf(state), row };
}

const lineOf = (lines: readonly ModelingYearLine[], pattern: RegExp) =>
  lines.find((row) => pattern.test(row.text));

/* -------------------------------------------------------------------------- */
/* The table                                                                   */
/* -------------------------------------------------------------------------- */

describe('the six rungs', () => {
  it('run from a test shoot to the face of a house, in that order', () => {
    expect(MODEL_TIERS).toEqual([
      'test',
      'catalogue',
      'commercial',
      'editorial',
      'campaign',
      'face',
    ]);
    expect(MODEL_TIERS.map((id) => MODEL_TIER_ROWS[id].name)).toEqual([
      'Test shoots and local work',
      'Catalogue and e-commerce',
      'Commercial and print',
      'Runway and editorial',
      'Campaigns for major brands',
      'The face of a house',
    ]);
    expect(MODEL_TIERS.map((id) => MODEL_TIER_ROWS[id].id)).toEqual([...MODEL_TIERS]);
  });

  it('are ranked and stepped without leaving the ladder', () => {
    expect(MODEL_TIERS.map((id) => modelTierRank(id))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stepModelTier('catalogue', 1)).toBe('commercial');
    expect(stepModelTier('catalogue', -1)).toBe('test');
    expect(stepModelTier('catalogue', 3)).toBe('campaign');
    expect(stepModelTier('catalogue', 4)).toBe('face');
    expect(stepModelTier('test', -1)).toBe('test');
    expect(stepModelTier('face', 1)).toBe('face');
    expect(stepModelTier('face', 9)).toBe('face');
    expect(stepModelTier('face', -9)).toBe('test');
  });

  it('want more at every step: age, jobs worked, craft, a name, a day rate, a hit line, fame and a following', () => {
    const column = <K extends keyof (typeof MODEL_TIER_ROWS)['test']>(key: K) =>
      MODEL_TIERS.map((id) => MODEL_TIER_ROWS[id][key]);
    for (const key of [
      'minAge',
      'minCredits',
      'minCraft',
      'minReputation',
      'hitLine',
      'fame',
      'followers',
      'reputation',
    ] as const) {
      const values = column(key) as number[];
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index]!, `${key} at ${index}`).toBeGreaterThanOrEqual(values[index - 1]!);
      }
    }
    const lows = MODEL_TIERS.map((id) => MODEL_TIER_ROWS[id].rate[0]);
    const highs = MODEL_TIERS.map((id) => MODEL_TIER_ROWS[id].rate[1]);
    for (let index = 1; index < MODEL_TIERS.length; index += 1) {
      expect(lows[index]!).toBeGreaterThan(lows[index - 1]!);
      expect(highs[index]!).toBeGreaterThan(highs[index - 1]!);
    }
    expect(MODEL_TIERS.map((id) => MODEL_TIER_ROWS[id].usage)).toEqual([
      0, 0.1, 0.35, 0.15, 0.9, 1.5,
    ]);
  });

  it('say how likely each placement is at a rung, and it adds up to one', () => {
    for (const id of MODEL_TIERS) {
      const mix = MODEL_TIER_ROWS[id].placement;
      expect(mix.face + mix.featured + mix.group, id).toBeCloseTo(1, 10);
      expect(MODEL_TIER_ROWS[id].mediums.length, id).toBeGreaterThanOrEqual(3);
      expect(MODEL_TIER_ROWS[id].slots.length, id).toBeGreaterThanOrEqual(2);
      for (const chance of MODEL_TIER_ROWS[id].slots) {
        expect(chance).toBeGreaterThan(0);
        expect(chance).toBeLessThanOrEqual(1);
      }
    }
    // The top of the ladder is the face of it, and the bottom is anybody's.
    expect(MODEL_TIER_ROWS.face.placement.group).toBe(0);
    expect(MODEL_TIER_ROWS.face.placement.face).toBeGreaterThan(0.5);
    expect(MODEL_TIER_ROWS.test.placement.group).toBeGreaterThan(0.2);
  });

  it('begin at fourteen, the youngest a portfolio can be shot, and no rung is open before sixteen except the first', () => {
    expect(MODEL_TIER_ROWS.test.minAge).toBe(14);
    expect(MODEL_PORTFOLIO_MIN_AGE).toBe(MODEL_TIER_ROWS.test.minAge);
    expect(MODEL_TIER_ROWS.catalogue.minAge).toBe(16);
    for (const id of MODEL_TIERS.slice(2))
      expect(MODEL_TIER_ROWS[id].minAge).toBeGreaterThanOrEqual(18);
  });

  it('pin every row of the ladder as numbers, so a change is a decision and not an accident', () => {
    const column = <K extends keyof (typeof MODEL_TIER_ROWS)['test']>(key: K) =>
      MODEL_TIERS.map((id) => MODEL_TIER_ROWS[id][key]);
    expect(column('minAge')).toEqual([14, 16, 18, 18, 18, 18]);
    expect(column('minCredits')).toEqual([0, 0, 4, 10, 20, 40]);
    expect(column('minCraft')).toEqual([0, 28, 40, 52, 72, 86]);
    expect(column('minReputation')).toEqual([0, 0, 5, 15, 35, 60]);
    expect(column('hitLine')).toEqual([42, 52, 58, 64, 72, 82]);
    expect(column('fame')).toEqual([0, 2, 6, 15, 38, 65]);
    expect(column('reputation')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(column('followers')).toEqual([40, 300, 1_500, 6_000, 40_000, 300_000]);
    expect(column('rate')).toEqual([
      [0, 250],
      [500, 1_500],
      [1_200, 4_000],
      [1_500, 8_000],
      [6_000, 30_000],
      [30_000, 150_000],
    ]);
    expect(column('days')).toEqual([
      [1, 3],
      [8, 30],
      [4, 15],
      [3, 10],
      [3, 8],
      [4, 12],
    ]);
    expect(column('slots')).toEqual([
      [0.5, 0.2],
      [0.75, 0.55, 0.3],
      [0.8, 0.6, 0.35],
      [0.8, 0.55, 0.3],
      [0.7, 0.45, 0.2],
      [0.6, 0.35, 0.1],
    ]);
    expect(column('placement')).toEqual([
      { face: 0.3, featured: 0.4, group: 0.3 },
      { face: 0.2, featured: 0.5, group: 0.3 },
      { face: 0.3, featured: 0.4, group: 0.3 },
      { face: 0.2, featured: 0.5, group: 0.3 },
      { face: 0.5, featured: 0.4, group: 0.1 },
      { face: 0.75, featured: 0.25, group: 0 },
    ]);
  });

  it('are written for a reader: every rung has a blurb and every kind of work a name with its article', () => {
    for (const id of MODEL_TIERS) {
      const row = MODEL_TIER_ROWS[id];
      expect(row.blurb.length, id).toBeGreaterThan(30);
      for (const medium of row.mediums) expect(medium, medium).toMatch(/^an? /);
    }
  });
});

describe('the real figures', () => {
  it('read the ladder against the BLS: $23.30 an hour is $48,470 a year for a full year of work', () => {
    expect(MODEL_BLS_MEDIAN_HOURLY).toBe(23.3);
    expect(MODEL_BLS_MEDIAN_YEAR).toBe(48_470);
    expect(Math.abs(MODEL_BLS_MEDIAN_HOURLY * 2080 - MODEL_BLS_MEDIAN_YEAR)).toBeLessThan(50);
  });

  it('pin the agency at New York’s cap of a fifth, and a living at a wage under the BLS median', () => {
    expect(MODEL_AGENCY_CUT).toBe(0.2);
    expect(MODEL_LIVING_WAGE).toBe(30_000);
    expect(MODEL_LIVING_WAGE).toBeLessThan(MODEL_BLS_MEDIAN_YEAR);
  });

  it('use no real brand, magazine or house for a client: five made-up ones to a rung, none repeated', () => {
    const all = MODEL_TIERS.flatMap((id) => MODEL_CLIENTS[id]);
    for (const id of MODEL_TIERS) expect(MODEL_CLIENTS[id], id).toHaveLength(5);
    expect(new Set(all).size).toBe(all.length);
    for (const real of [
      'Vogue',
      'Nike',
      'Chanel',
      'Gucci',
      'Calvin Klein',
      'Elle',
      'Dior',
      'Prada',
      'Versace',
    ]) {
      expect(
        all.some((name) => name.includes(real)),
        real,
      ).toBe(false);
    }
  });

  it('give an unpaid first rung, a day rate that is a real one from catalogue work, and a buyout that dwarfs it at the top', () => {
    expect(MODEL_TIER_ROWS.test.rate[0]).toBe(0);
    expect(MODEL_TIER_ROWS.catalogue.rate[0]).toBeGreaterThanOrEqual(400);
    expect(MODEL_TIER_ROWS.face.usage).toBeGreaterThan(MODEL_TIER_ROWS.campaign.usage);
    expect(MODEL_TIER_ROWS.test.usage).toBe(0);
  });
});

describe('the dials, pinned', () => {
  it('pin the numbers the odds are made of', () => {
    expect(MODEL_PLACEMENT_FEE).toEqual({ face: 1, featured: 0.55, group: 0.25 });
    expect(MODEL_PLACEMENT_DAYS).toEqual({ face: 1, featured: 0.8, group: 0.6 });
    expect(MODEL_PLACEMENT_FOLLOWERS).toEqual({ face: 1, featured: 0.5, group: 0.15 });
    expect(MODEL_PLACEMENT_REPUTATION).toEqual({ face: 1, featured: 0.6, group: 0.3 });
    expect(MODEL_PLACEMENT_PHRASE).toEqual({
      face: 'the face of',
      featured: 'a featured spot in',
      group: 'a group spot in',
    });
    expect([...MODEL_PLACEMENTS]).toEqual(['face', 'featured', 'group']);
    expect(MODEL_YEAR_DAYS).toBe(150);
    expect(MODEL_CRAFT_HEADROOM).toBe(10);
    expect(MODEL_CREDIT_CRAFT).toBe(0.3);
    expect(MODEL_CREDIT_CRAFT_CAP).toBe(6);
    expect(MODEL_PORTFOLIO_COST).toBe(900);
    expect(MODEL_PORTFOLIO_COST_SOURCE).toBe('portfolio photos');
    expect(MODEL_SEEN_YEARS).toBe(3);
    expect(MODEL_OFFER_TIER_WEIGHTS).toEqual({ plain: [0.2, 0.7, 0.1], agency: [0.15, 0.55, 0.3] });
    expect(MODEL_REPUTATION_OFFER_RANGE).toEqual([0.6, 1.2]);
    expect(MODEL_CASTINGS).toBe(6);
    expect(MODEL_APPLICATIONS_PER_YEAR).toBe(3);
    expect(MODEL_AGENCY_SUBMISSIONS).toBe(2);
    expect(MODEL_APPLY_BASE).toEqual({ below: 0.8, at: 0.55, above: 0.28 });
    expect(MODEL_APPLY_CRAFT_WEIGHT).toBe(0.5);
    expect(MODEL_APPLY_AGENCY_BONUS).toBe(0.12);
    expect(MODEL_APPLY_REPUTATION_WEIGHT).toBe(0.2);
    expect(MODEL_APPLY_PLACEMENT).toEqual({ face: -0.12, featured: 0, group: 0.12 });
    expect(MODEL_AGENCY_MIN_CREDITS).toBe(2);
    expect(MODEL_AGENCY_SLOT_CHANCE).toBe(0.4);
    expect(MODEL_AGENCY_OFFER_MULTIPLIER).toBe(1.2);
    expect(MODEL_AGENCY_ASK_BONUS).toBe(0.15);
    expect(MODEL_NEGOTIABLE_FROM).toBe(2_000);
    expect(MODEL_ASK_BASE).toBe(0.5);
    expect(MODEL_ASK_REPUTATION_WEIGHT).toBe(0.25);
    expect(MODEL_ASK_GAIN).toEqual([1.1, 1.25]);
    expect(MODEL_PERFORMANCE_NOISE).toBe(30);
    expect(MODEL_FLOP_MARGIN).toBe(25);
    expect(MODEL_HITS_TO_RISE).toEqual({
      test: 2,
      catalogue: 2,
      commercial: 3,
      editorial: 3,
      campaign: 4,
      face: 99,
    });
    expect(MODEL_IDLE_FALL_YEARS).toBe(3);
    expect([MODEL_HIT_REPUTATION, MODEL_FLOP_REPUTATION, MODEL_IDLE_REPUTATION]).toEqual([3, 3, 2]);
    expect([MODEL_AGE_PEAK_END, MODEL_AGE_RATE, MODEL_AGE_FLOOR, MODEL_RISE_WINDOW_END]).toEqual([
      26, 0.06, 0.3, 30,
    ]);
    expect([MODEL_FOLLOWER_CHURN, MODEL_HIT_FOLLOWERS, MODEL_CHANNEL_SHARE]).toEqual([
      0.08, 1.25, 0.25,
    ]);
    expect([...MODEL_CHANNEL_CATEGORIES]).toEqual(['fashion', 'lifestyle']);
    expect([MODEL_BRAND_PLATFORM, MODEL_BRAND_CATEGORY]).toEqual(['photo', 'fashion']);
    expect(MODEL_NETWORK_CREDITS).toBe(6);
    expect(MODEL_AWARD_CEREMONY).toBe('the Atelier Awards');
    expect([MODEL_AWARD_LINE, MODEL_AWARD_REPUTATION, MODEL_AWARD_MOOD]).toEqual([82, 8, 6]);
    expect(MODEL_AWARD_CHANCE).toEqual({
      test: 0,
      catalogue: 0,
      commercial: 0,
      editorial: 0.06,
      campaign: 0.1,
      face: 0.14,
    });
    expect(MODEL_AWARD_NAMES).toEqual({
      face: 'Model of the Year',
      featured: 'Best Runway Presence',
      group: 'Breakout Model of the Year',
    });
    expect(MODEL_MAX_OFFERS).toBe(4);
  });
});

describe('what a job is worth', () => {
  it('gives a day rate inside the rung’s range for the face of the job, rounded to a sensible step', () => {
    for (const id of MODEL_TIERS) {
      const [low, high] = MODEL_TIER_ROWS[id].rate;
      for (const unit of [0, 0.25, 0.5, 0.75, 0.999]) {
        const rate = modelDayRate(id, 'face', unit);
        expect(rate, `${id} ${unit}`).toBeGreaterThanOrEqual(0);
        expect(rate, `${id} ${unit}`).toBeLessThanOrEqual(high + 5_000);
        if (low > 0) expect(rate, `${id} ${unit}`).toBeGreaterThanOrEqual(low - 5_000);
        const step = rate < 1_000 ? 25 : rate < 10_000 ? 100 : rate < 100_000 ? 500 : 5_000;
        expect(rate % step, `${id} ${unit}`).toBe(0);
      }
    }
    expect(modelDayRate('catalogue', 'face', 0)).toBe(500);
    expect(modelDayRate('catalogue', 'face', 0.999)).toBe(1_500);
    expect(modelDayRate('face', 'face', 0)).toBe(30_000);
    expect(modelDayRate('face', 'face', 0.999)).toBe(150_000);
  });

  it('runs the day rate low to high with the draw, geometrically above a floor and straight from nothing below it', () => {
    expect(modelDayRate('catalogue', 'face', 0.5)).toBe(875);
    expect(modelDayRate('commercial', 'face', 0.5)).toBe(2_200);
    expect(modelDayRate('test', 'face', 0.5)).toBe(125);
    expect(modelDayRate('test', 'face', 0)).toBe(0);
    expect(modelDayRate('test', 'face', 0.02)).toBe(0);
    expect(modelDayRate('test', 'face', 0.999)).toBe(250);
    for (const id of MODEL_TIERS) {
      expect(modelDayRate(id, 'face', 0.2)).toBeLessThanOrEqual(modelDayRate(id, 'face', 0.8));
    }
  });

  it('pays a featured spot just over half of the face of it, and one of the group a quarter', () => {
    const face = modelDayRate('commercial', 'face', 0.5);
    expect(modelDayRate('commercial', 'featured', 0.5)).toBe(1_200);
    expect(modelDayRate('commercial', 'group', 0.5)).toBe(550);
    expect(modelDayRate('commercial', 'featured', 0.5) / face).toBeCloseTo(0.55, 1);
    expect(modelDayRate('commercial', 'group', 0.5) / face).toBeCloseTo(0.25, 1);
  });

  it('pays a name that is known more, and one that isn’t less', () => {
    const plain = modelDayRate('campaign', 'face', 0.5, 1);
    expect(modelDayRate('campaign', 'face', 0.5, 1.15)).toBeGreaterThan(plain);
    expect(modelDayRate('campaign', 'face', 0.5, 0.85)).toBeLessThan(plain);
    expect(modelDayRate('campaign', 'face', 0.5)).toBe(plain);
    expect(modelDayRate('campaign', 'face', 0.5, 1.15)).toBe(15_500);
  });

  it('takes days from the rung’s range, fewer for a smaller part, and never fewer than one', () => {
    expect(modelJobDays('catalogue', 'face', 0)).toBe(8);
    expect(modelJobDays('catalogue', 'face', 1)).toBe(30);
    expect(modelJobDays('catalogue', 'face', 0.5)).toBe(19);
    expect(modelJobDays('catalogue', 'featured', 0.5)).toBe(15);
    expect(modelJobDays('catalogue', 'group', 0.5)).toBe(11);
    expect(modelJobDays('test', 'group', 0)).toBe(1);
    expect(modelJobDays('face', 'face', 1)).toBe(12);
    for (const id of MODEL_TIERS) {
      for (const placement of MODEL_PLACEMENTS) {
        expect(modelJobDays(id, placement, 0.3)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('adds a usage fee of a share of the days’ pay, to the nearest hundred, thousand or ten thousand', () => {
    expect(modelUsageFee('test', 200, 3)).toBe(0);
    expect(modelUsageFee('catalogue', 1_000, 10)).toBe(1_000);
    expect(modelUsageFee('commercial', 2_000, 5)).toBe(3_500);
    expect(modelUsageFee('campaign', 10_000, 5)).toBe(45_000);
    expect(modelUsageFee('face', 60_000, 8)).toBe(720_000);
    expect(modelUsageFee('face', 100_000, 10)).toBe(1_500_000);
    expect(modelUsageFee('catalogue', 475, 3)).toBe(100);
  });

  it('is the days at the day rate, and the usage', () => {
    expect(modelJobFee({ rate: 1_000, days: 10, usage: 500 })).toBe(10_500);
    expect(modelJobFee({ rate: 0, days: 2, usage: 0 })).toBe(0);
    expect(jobFee(job())).toBe(10_500);
    expect(jobFee(job({ rate: 250, days: 4, usage: 0 }))).toBe(1_000);
  });

  it('lands on each placement at the edges of the mix', () => {
    expect(modelPlacementFor('catalogue', 0)).toBe('face');
    expect(modelPlacementFor('catalogue', 0.199)).toBe('face');
    expect(modelPlacementFor('catalogue', 0.2)).toBe('featured');
    expect(modelPlacementFor('catalogue', 0.699)).toBe('featured');
    expect(modelPlacementFor('catalogue', 0.7)).toBe('group');
    expect(modelPlacementFor('catalogue', 0.999)).toBe('group');
    expect(modelPlacementFor('face', 0.74)).toBe('face');
    expect(modelPlacementFor('face', 0.75)).toBe('featured');
    expect(modelPlacementFor('face', 0.999)).toBe('featured');
    // A draw at or past the end of the mix is never nothing.
    expect(modelPlacementFor('face', 1)).toBe('featured');
  });
});

/* -------------------------------------------------------------------------- */
/* Craft, ageing, fame and words                                               */
/* -------------------------------------------------------------------------- */

describe('what a character is like as a model', () => {
  const stats = (
    over: Partial<Record<'charisma' | 'looks' | 'smarts' | 'discipline', number>> = {},
  ) => ({
    charisma: 70,
    looks: 70,
    smarts: 70,
    discipline: 70,
    ...over,
  });

  it('is read off looks first, then charisma, then discipline and smarts', () => {
    const base = naturalModelCraft(stats());
    const up = (key: 'charisma' | 'looks' | 'smarts' | 'discipline') =>
      naturalModelCraft(stats({ [key]: 80 })) - base;
    expect(up('looks')).toBeGreaterThan(up('charisma'));
    expect(up('charisma')).toBeGreaterThan(up('discipline'));
    expect(up('discipline')).toBeGreaterThan(up('smarts'));
    expect(up('smarts')).toBeGreaterThan(0);
  });

  it('weighs them as half, three tenths, fifteen hundredths and a twentieth', () => {
    // A point of one stat moves the weighted number by its weight, and craft by that times 2.4. The steps are chosen
    // so that each comes out whole: 10 × .5, 25 × .3, 25 × .15 and 50 × .05, each times 2.4.
    const base = naturalModelCraft(stats());
    expect(naturalModelCraft(stats({ looks: 80 })) - base).toBe(12);
    expect(naturalModelCraft(stats({ charisma: 95 })) - base).toBe(18);
    expect(naturalModelCraft(stats({ discipline: 95 })) - base).toBe(9);
    expect(naturalModelCraft(stats({ smarts: 120 })) - base).toBe(6);
  });

  it('centres on 66.5 and spreads 2.4 craft to a point, so a median character is near 50', () => {
    expect(
      naturalModelCraft(stats({ looks: 66.5, charisma: 66.5, discipline: 66.5, smarts: 66.5 })),
    ).toBe(50);
    expect(naturalModelCraft({ charisma: 78, looks: 57, smarts: 81, discipline: 68 })).toBe(
      Math.round(50 + (0.5 * 57 + 0.3 * 78 + 0.15 * 68 + 0.05 * 81 - 66.5) * 2.4),
    );
    expect(naturalModelCraft({ charisma: 78, looks: 57, smarts: 81, discipline: 68 })).toBe(49);
  });

  it('stays between nothing and a hundred', () => {
    expect(naturalModelCraft(stats({ looks: 0, charisma: 0, discipline: 0, smarts: 0 }))).toBe(0);
    expect(naturalModelCraft(stats({ looks: 80, charisma: 80, discipline: 80, smarts: 80 }))).toBe(
      82,
    );
    expect(
      naturalModelCraft(stats({ looks: 100, charisma: 100, discipline: 100, smarts: 100 })),
    ).toBe(100);
    expect(
      naturalModelCraft(stats({ looks: 130, charisma: 130, discipline: 130, smarts: 130 })),
    ).toBe(100);
    expect(
      naturalModelCraft(stats({ looks: -30, charisma: -30, discipline: -30, smarts: -30 })),
    ).toBe(0);
  });

  it('takes no talent: the function has only the four stats to go on', () => {
    expect(naturalModelCraft.length).toBe(1);
  });

  it('reads the character’s own looks and charisma in the game, and nothing about health or stress', () => {
    const base = adult('craft-read');
    const good = withStats(base, { looks: 85, charisma: 85 });
    const plain = withStats(base, { looks: 40, charisma: 50 });
    expect(modelCraftOf(good)).toBeGreaterThan(modelCraftOf(plain));
    expect(modelCraftOf(withStats(good, { health: 5 }))).toBe(modelCraftOf(good));
    expect(modelCraftOf(withStats(good, { happiness: 5 }))).toBe(modelCraftOf(good));
    expect(modelCraftOf(good)).toBe(naturalModelCraft(good.player.stats));
  });

  it('prefers what has been built to what the character is', () => {
    const base = withStats(adult('craft-built'), { looks: 40, charisma: 40 });
    expect(modelCraftOf(withModeling(base, { craft: 77 }))).toBe(77);
    expect(modelCraftOf(withModeling(base, { craft: 0 }))).toBe(0);
    expect(modelCraftOf(base)).toBe(naturalModelCraft(base.player.stats));
  });

  it('can be taken ten points past what the character is, and no further', () => {
    const base = withStats(adult('ceiling'), {
      looks: 60,
      charisma: 60,
      discipline: 60,
      smarts: 60,
    });
    expect(modelCraftCeiling(base)).toBe(
      naturalModelCraft(base.player.stats) + MODEL_CRAFT_HEADROOM,
    );
    const high = withStats(base, { looks: 80, charisma: 80, discipline: 80, smarts: 80 });
    expect(modelCraftCeiling(high)).toBe(92);
    expect(
      modelCraftCeiling(withStats(base, { looks: 85, charisma: 85, discipline: 85, smarts: 85 })),
    ).toBe(100);
  });
});

describe('the age window', () => {
  it('lets the work come in at full strength to twenty-six, then a little less each year', () => {
    expect(modelAgeScale(14)).toBe(1);
    expect(modelAgeScale(26)).toBe(1);
    expect(modelAgeScale(27)).toBeCloseTo(0.94, 10);
    expect(modelAgeScale(30)).toBeCloseTo(0.76, 10);
    expect(modelAgeScale(35)).toBeCloseTo(0.46, 10);
  });

  it('never closes entirely: below a third of what it was, it stays', () => {
    expect(modelAgeScale(38)).toBeCloseTo(0.3, 10);
    expect(modelAgeScale(39)).toBe(0.3);
    expect(modelAgeScale(80)).toBe(0.3);
    expect(modelAgeScale(37)).toBeCloseTo(0.34, 10);
  });

  it('only ever falls', () => {
    let last = 1;
    for (let age = 14; age < 90; age += 1) {
      expect(modelAgeScale(age)).toBeLessThanOrEqual(last);
      last = modelAgeScale(age);
    }
  });
});

describe('fame', () => {
  it('holds at the rung’s fame, with a tenth of the reputation and three a prize, up to twelve', () => {
    expect(modelFameOf({ tier: 'editorial', reputation: 0, awards: 0, idle: 0 })).toBe(15);
    expect(modelFameOf({ tier: 'editorial', reputation: 50, awards: 0, idle: 0 })).toBe(20);
    expect(modelFameOf({ tier: 'editorial', reputation: 50, awards: 2, idle: 0 })).toBe(26);
    expect(modelFameOf({ tier: 'editorial', reputation: 50, awards: 4, idle: 0 })).toBe(32);
    expect(modelFameOf({ tier: 'editorial', reputation: 50, awards: 40, idle: 0 })).toBe(32);
    expect(modelFameOf({ tier: 'face', reputation: 100, awards: 40, idle: 0 })).toBe(87);
  });

  it('is nothing for a first rung that has none, however well liked', () => {
    expect(modelFameOf({ tier: 'test', reputation: 100, awards: 9, idle: 0 })).toBe(0);
  });

  it('halves after a year with no work, and is gone after three', () => {
    expect(modelFameOf({ tier: 'campaign', reputation: 40, awards: 0, idle: 1 })).toBe(21);
    expect(modelFameOf({ tier: 'campaign', reputation: 40, awards: 0, idle: 2 })).toBe(21);
    expect(modelFameOf({ tier: 'campaign', reputation: 40, awards: 0, idle: 3 })).toBe(0);
  });

  it('never passes a hundred', () => {
    expect(modelFameOf({ tier: 'face', reputation: 100, awards: 9, idle: 0 })).toBeLessThanOrEqual(
      100,
    );
  });
});

describe('words', () => {
  it('names a reputation at each edge', () => {
    expect(modelReputationWord(0)).toBe('Unknown');
    expect(modelReputationWord(4)).toBe('Unknown');
    expect(modelReputationWord(5)).toBe('Getting noticed');
    expect(modelReputationWord(19)).toBe('Getting noticed');
    expect(modelReputationWord(20)).toBe('Known to bookers');
    expect(modelReputationWord(39)).toBe('Known to bookers');
    expect(modelReputationWord(40)).toBe('Established');
    expect(modelReputationWord(59)).toBe('Established');
    expect(modelReputationWord(60)).toBe('Respected');
    expect(modelReputationWord(79)).toBe('Respected');
    expect(modelReputationWord(80)).toBe('Iconic');
    expect(modelReputationWord(100)).toBe('Iconic');
  });

  it('has a line for every rise', () => {
    for (const id of MODEL_TIERS) expect(MODEL_RISE_LINES[id].length, id).toBeGreaterThan(20);
    expect(MODEL_RISE_LINES.catalogue).toMatch(/day rate/);
    expect(MODEL_RISE_LINES.face).toMatch(/sells the product/);
  });
});

/* -------------------------------------------------------------------------- */
/* Reading a modeling life                                                     */
/* -------------------------------------------------------------------------- */

describe('being seen', () => {
  const m = (patch: Partial<ModelingState>): ModelingState => ({ ...EMPTY_MODELING, ...patch });

  it('is true of a model with an agency, whenever they last worked', () => {
    expect(isModelSeen(m({ agency: { since: 20 } }), 60)).toBe(true);
  });

  it('is true for three years after a portfolio or a job, and not after', () => {
    expect(isModelSeen(m({ seenAge: 20 }), 20)).toBe(true);
    expect(isModelSeen(m({ seenAge: 20 }), 22)).toBe(true);
    expect(isModelSeen(m({ seenAge: 20 }), 23)).toBe(true);
    expect(isModelSeen(m({ seenAge: 20 }), 24)).toBe(false);
    expect(isModelSeen(m({ seenAge: 20 }), 40)).toBe(false);
    expect(MODEL_SEEN_YEARS).toBe(3);
  });

  it('is false for somebody nobody has seen', () => {
    expect(isModelSeen(EMPTY_MODELING, 20)).toBe(false);
    expect(isModelSeen(m({ craft: 50, credits: 9 }), 20)).toBe(false);
  });
});

describe('modeling as a living', () => {
  const m = (patch: Partial<ModelingState>): ModelingState => ({ ...EMPTY_MODELING, ...patch });

  it('is a year that paid thirty thousand, with no more than a year since the last job', () => {
    expect(isModelingFullTime(m({ lastPay: 30_000, idle: 0 }))).toBe(true);
    expect(isModelingFullTime(m({ lastPay: 30_000, idle: 1 }))).toBe(true);
    expect(isModelingFullTime(m({ lastPay: 29_999, idle: 0 }))).toBe(false);
    expect(isModelingFullTime(m({ lastPay: 30_000, idle: 2 }))).toBe(false);
    expect(isModelingFullTime(m({ lastPay: 5_000_000, idle: 0 }))).toBe(true);
    expect(isModelingFullTime(EMPTY_MODELING)).toBe(false);
  });

  it('puts Model in the header for a living, and nothing otherwise', () => {
    expect(modelingOccupation(m({ lastPay: 40_000 }))).toBe('Model');
    expect(modelingOccupation(m({ lastPay: 100 }))).toBeUndefined();
    expect(modelingOccupation(EMPTY_MODELING)).toBeUndefined();
  });
});

describe('being ready for a rung', () => {
  const m = (patch: Partial<ModelingState>): ModelingState => ({
    ...EMPTY_MODELING,
    credits: 99,
    reputation: 99,
    ...patch,
  });

  it('is nothing missing when age, jobs, craft and a name are all there', () => {
    for (const id of MODEL_TIERS) {
      expect(modelNotReadyFor(m({}), id, 40, 100), id).toBeUndefined();
    }
  });

  it('is the first rung for anybody of fourteen', () => {
    expect(modelNotReadyFor(EMPTY_MODELING, 'test', 14, 0)).toBeUndefined();
    expect(modelNotReadyFor(EMPTY_MODELING, 'test', 13, 100)).toBe('too-young');
  });

  it('says too young at the edge of each rung’s age', () => {
    for (const id of MODEL_TIERS) {
      const age = MODEL_TIER_ROWS[id].minAge;
      expect(modelNotReadyFor(m({}), id, age, 100), id).toBeUndefined();
      expect(modelNotReadyFor(m({}), id, age - 1, 100), id).toBe('too-young');
    }
  });

  it('says too few jobs at the edge of each rung’s credits', () => {
    for (const id of MODEL_TIERS.slice(2)) {
      const need = MODEL_TIER_ROWS[id].minCredits;
      expect(modelNotReadyFor(m({ credits: need }), id, 40, 100), id).toBeUndefined();
      expect(modelNotReadyFor(m({ credits: need - 1 }), id, 40, 100), id).toBe('few-credits');
    }
  });

  it('says craft at the edge of each rung’s craft', () => {
    for (const id of MODEL_TIERS.slice(1)) {
      const need = MODEL_TIER_ROWS[id].minCraft;
      expect(modelNotReadyFor(m({}), id, 40, need), id).toBeUndefined();
      expect(modelNotReadyFor(m({}), id, 40, need - 1), id).toBe('craft');
    }
  });

  it('says reputation at the edge of each rung’s name', () => {
    for (const id of MODEL_TIERS.slice(2)) {
      const need = MODEL_TIER_ROWS[id].minReputation;
      expect(modelNotReadyFor(m({ reputation: need }), id, 40, 100), id).toBeUndefined();
      expect(modelNotReadyFor(m({ reputation: need - 1 }), id, 40, 100), id).toBe('reputation');
    }
  });

  it('names the first thing missing: age, then jobs, then craft, then a name', () => {
    const none = m({ credits: 0, reputation: 0 });
    expect(modelNotReadyFor(none, 'face', 10, 0)).toBe('too-young');
    expect(modelNotReadyFor(none, 'face', 40, 0)).toBe('few-credits');
    expect(modelNotReadyFor(m({ reputation: 0 }), 'face', 40, 0)).toBe('craft');
    expect(modelNotReadyFor(m({ reputation: 0 }), 'face', 40, 100)).toBe('reputation');
  });

  it('has words for each', () => {
    expect(MODEL_NOT_READY_LABELS).toEqual({
      'too-young': "You're too young for that kind of work.",
      'few-credits': "You haven't worked enough yet.",
      craft: "You aren't there as a model yet.",
      reputation: "They don't know your name well enough.",
    });
  });
});

describe('the days in a year', () => {
  it('are a hundred and fifty, less what is booked and what is on the table', () => {
    expect(modelFreeDays(EMPTY_MODELING)).toBe(150);
    expect(modelFreeDays({ ...EMPTY_MODELING, booked: [booked({ days: 20 })] })).toBe(130);
    expect(modelFreeDays({ ...EMPTY_MODELING, offers: [job({ days: 15 })] })).toBe(135);
    expect(
      modelFreeDays({
        ...EMPTY_MODELING,
        booked: [booked({ days: 20 }), booked({ id: '25:1', days: 5 })],
        offers: [job({ days: 15 })],
      }),
    ).toBe(110);
    expect(modelFreeDays({ ...EMPTY_MODELING, booked: [booked({ days: 150 })] })).toBe(0);
  });

  it('can go below none, so a full year can be told apart from an over-full one', () => {
    expect(modelFreeDays({ ...EMPTY_MODELING, booked: [booked({ days: 160 })] })).toBe(-10);
  });
});

/* -------------------------------------------------------------------------- */
/* Offers                                                                      */
/* -------------------------------------------------------------------------- */

describe('how many offers a year has room for', () => {
  const m = (patch: Partial<ModelingState>): ModelingState => ({ ...EMPTY_MODELING, ...patch });

  it('scales the slots from sixty percent for an unknown name to a hundred and twenty for a famous one', () => {
    expect(modelSlotScale(m({ reputation: 0 }), 20)).toBeCloseTo(0.6, 10);
    expect(modelSlotScale(m({ reputation: 50 }), 20)).toBeCloseTo(0.9, 10);
    expect(modelSlotScale(m({ reputation: 100 }), 20)).toBeCloseTo(1.2, 10);
    expect(modelSlotScale(m({ reputation: 500 }), 20)).toBeCloseTo(1.2, 10);
  });

  it('multiplies in an agency’s fifth, and in age', () => {
    expect(modelSlotScale(m({ reputation: 50, agency: { since: 20 } }), 20)).toBeCloseTo(
      0.9 * 1.2,
      10,
    );
    expect(modelSlotScale(m({ reputation: 50 }), 30)).toBeCloseTo(0.9 * 0.76, 10);
    expect(modelSlotScale(m({ reputation: 50, agency: { since: 20 } }), 30)).toBeCloseTo(
      0.9 * 1.2 * 0.76,
      10,
    );
  });

  it('gives each slot its rung’s chance, scaled, and never above ninety-five percent', () => {
    const catalogue = modelOfferSlots(m({ tier: 'catalogue', reputation: 50 }), 20);
    [0.75 * 0.9, 0.55 * 0.9, 0.3 * 0.9].forEach((want, index) =>
      expect(catalogue[index]).toBeCloseTo(want, 10),
    );
    expect(catalogue).toHaveLength(3);
    const face = modelOfferSlots(m({ tier: 'face', reputation: 100 }), 20);
    [0.6 * 1.2, 0.35 * 1.2, 0.1 * 1.2].forEach((want, index) =>
      expect(face[index]).toBeCloseTo(want, 10),
    );
    const capped = modelOfferSlots(
      m({ tier: 'commercial', reputation: 100, agency: { since: 20 } }),
      20,
    );
    expect(Math.max(...capped)).toBe(0.95);
  });

  it('adds a slot for an agency, at forty percent before the scale', () => {
    const plain = modelOfferSlots(m({ tier: 'editorial', reputation: 50 }), 20);
    const agency = modelOfferSlots(
      m({ tier: 'editorial', reputation: 50, agency: { since: 20 } }),
      20,
    );
    expect(agency).toHaveLength(plain.length + 1);
    expect(agency[agency.length - 1]).toBeCloseTo(MODEL_AGENCY_SLOT_CHANCE * 0.9 * 1.2, 10);
    expect(agency.slice(0, plain.length)[0]).toBeCloseTo(plain[0]! * 1.2, 10);
  });

  it('has fewer as the years go by', () => {
    const at = (age: number) => modelOfferSlots(m({ tier: 'catalogue', reputation: 50 }), age)[0]!;
    expect(at(26)).toBeGreaterThan(at(30));
    expect(at(30)).toBeGreaterThan(at(36));
    expect(at(60)).toBeCloseTo(0.75 * 0.9 * 0.3, 10);
  });
});

describe('what rung an offer is at', () => {
  const m = (patch: Partial<ModelingState>): ModelingState => ({
    ...EMPTY_MODELING,
    tier: 'commercial',
    credits: 99,
    reputation: 99,
    ...patch,
  });

  it('is a rung below for a fifth of the draws, at for seven in ten, and a rung above for one in ten', () => {
    expect(modelTierDrawn(m({}), 0, 24, 100)).toBe('catalogue');
    expect(modelTierDrawn(m({}), 0.199, 24, 100)).toBe('catalogue');
    expect(modelTierDrawn(m({}), 0.2, 24, 100)).toBe('commercial');
    expect(modelTierDrawn(m({}), 0.899, 24, 100)).toBe('commercial');
    expect(modelTierDrawn(m({}), 0.9, 24, 100)).toBe('editorial');
    expect(modelTierDrawn(m({}), 0.999, 24, 100)).toBe('editorial');
  });

  it('has a better chance of the rung above with an agency (three in ten), and a smaller one of the rung below', () => {
    const agency = m({ agency: { since: 20 } });
    expect(modelTierDrawn(agency, 0.149, 24, 100)).toBe('catalogue');
    expect(modelTierDrawn(agency, 0.151, 24, 100)).toBe('commercial');
    expect(modelTierDrawn(agency, 0.699, 24, 100)).toBe('commercial');
    expect(modelTierDrawn(agency, 0.701, 24, 100)).toBe('editorial');
  });

  it('stays where the model is rather than offering a rung they aren’t ready for', () => {
    expect(modelTierDrawn(m({ credits: 0 }), 0.95, 24, 100)).toBe('commercial');
    expect(modelTierDrawn(m({}), 0.95, 24, 30)).toBe('commercial');
    expect(modelTierDrawn(m({ reputation: 0 }), 0.95, 24, 100)).toBe('commercial');
    expect(modelTierDrawn(m({}), 0.95, 17, 100)).toBe('commercial');
  });

  it('never offers a rung below that wants more than the model has: below is always open', () => {
    expect(modelTierDrawn(m({ tier: 'catalogue', credits: 0, reputation: 0 }), 0, 24, 0)).toBe(
      'test',
    );
  });

  it('closes the door on the rung above after thirty, and leaves the other two', () => {
    expect(modelTierDrawn(m({}), 0.95, 30, 100)).toBe('editorial');
    expect(modelTierDrawn(m({}), 0.95, 31, 100)).toBe('commercial');
    expect(modelTierDrawn(m({}), 0.95, 50, 100)).toBe('commercial');
    expect(modelTierDrawn(m({}), 0, 50, 100)).toBe('catalogue');
    expect(modelTierDrawn(m({}), 0.5, 50, 100)).toBe('commercial');
    expect(MODEL_RISE_WINDOW_END).toBe(30);
  });

  it('cannot go off either end of the ladder', () => {
    expect(modelTierDrawn(m({ tier: 'test' }), 0, 24, 100)).toBe('test');
    expect(modelTierDrawn(m({ tier: 'face' }), 0.99, 24, 100)).toBe('face');
  });
});

describe('an offer on the table', () => {
  const offerText = (over: Partial<Job> = {}) => modelingOfferDecision(job(over), 2040).prompt;

  it('is a question the engine asks, and nobody else answers', () => {
    expect(MODELING_OFFER_EVENT_ID).toBe('modeling.offer');
    expect(isModelingOfferDecision('modeling.offer')).toBe(true);
    expect(isModelingOfferDecision('acting.offer')).toBe(false);
    expect(isModelingOfferDecision('')).toBe(false);
    const decision = modelingOfferDecision(job(), 2040);
    expect(decision.eventId).toBe('modeling.offer');
    expect(decision.category).toBe('career');
    expect(decision.age).toBe(26);
    expect(decision.year).toBe(2040);
    expect(decision.names).toEqual({});
  });

  it('says who wants the model and for what, when they were asked', () => {
    expect(offerText()).toMatch(
      /^A booker wants you for a featured spot in a catalogue shoot for Calloway Outfitters\. /,
    );
    expect(offerText({ placement: 'face' })).toMatch(/for the face of a catalogue shoot for/);
    expect(offerText({ placement: 'group' })).toMatch(/for a group spot in a catalogue shoot for/);
  });

  it('says they got it, when they went for it', () => {
    expect(offerText({ source: 'applied' })).toMatch(
      /^You got the job: a featured spot in a catalogue shoot for Calloway Outfitters\. /,
    );
  });

  it('says what it pays: the day rate, the days, the usage and the whole of it', () => {
    expect(offerText()).toContain(
      'It pays $1,000 a day for 10 days, and $500 for the use of the pictures, $10,500 in all.',
    );
    expect(offerText({ usage: 0 })).toContain('It pays $1,000 a day for 10 days, $10,000 in all.');
    expect(offerText({ days: 1, usage: 0 })).toContain('for 1 day, $1,000 in all.');
  });

  it('says so when the job pays nothing, and what it’s for', () => {
    expect(offerText({ rate: 0, usage: 0, days: 2 })).toContain(
      'It doesn’t pay. It’s 2 days for the pictures.',
    );
    expect(offerText({ rate: 0, usage: 0, days: 1 })).toContain('It’s 1 day for the pictures.');
    expect(offerText({ rate: 0, usage: 300, days: 2 })).toContain(
      'It pays $0 a day for 2 days, and $300 for the use of the pictures, $300 in all.',
    );
  });

  it('gives Take, Ask for more and Pass', () => {
    const choices = modelingOfferDecision(job(), 2040).choices;
    expect(choices.map((row) => row.id)).toEqual(['accept', 'more', 'decline']);
    expect(choices.map((row) => row.label)).toEqual(['Take the job', 'Ask for more', 'Pass']);
  });

  it('offers to ask for more only where the whole job pays two thousand and it hasn’t been asked', () => {
    const ids = (over: Partial<Job>) => modelingChoicesOf(job(over));
    expect(ids({ rate: 100, days: 20, usage: 0 })).toEqual(['accept', 'more', 'decline']);
    expect(ids({ rate: 100, days: 19, usage: 0 })).toEqual(['accept', 'decline']);
    expect(ids({ rate: 0, days: 2, usage: 2_000 })).toEqual(['accept', 'more', 'decline']);
    expect(ids({ asked: true })).toEqual(['accept', 'decline']);
    expect(ids({ asked: false })).toEqual(['accept', 'more', 'decline']);
    expect(MODEL_NEGOTIABLE_FROM).toBe(2_000);
  });

  it('is put on the table once, at the end of a year, for somebody who is alive', () => {
    const base = known(adult('door'), { offers: [job()] });
    const once = withModelingOffer(base, true);
    expect(once.pending.filter((row) => row.eventId === MODELING_OFFER_EVENT_ID)).toHaveLength(1);
    expect(withModelingOffer(once, true)).toBe(once);
    expect(withModelingOffer(base, false)).toBe(base);
    const empty = known(adult('door'), { offers: [] });
    expect(withModelingOffer(empty, true)).toBe(empty);
  });

  it('asks about the first offer of several, with the year it was raised in', () => {
    const base = known(adult('door-two'), {
      offers: [
        job({ id: '26:0', client: 'Tern Footwear' }),
        job({ id: '26:1', client: 'Marlow & Pike' }),
      ],
    });
    const asked = withModelingOffer(base, true).pending.find(
      (row) => row.eventId === MODELING_OFFER_EVENT_ID,
    )!;
    expect(asked.prompt).toContain('Tern Footwear');
    expect(asked.year).toBe(base.world.year);
  });

  it('holds time still, as every other question does', () => {
    const base = known(adult('door-hold'), { offers: [job()] });
    expect(hasSystemicOffer(base)).toBe(true);
    expect(hasSystemicOffer(known(adult('door-hold'), { offers: [] }))).toBe(false);
    expect(hasSystemicOffer(adult('door-hold'))).toBe(false);
    const asked = withModelingOffer(base, true);
    expect(advanceYear(asked).state.world.year).toBe(asked.world.year);
  });
});

/* -------------------------------------------------------------------------- */
/* Castings                                                                    */
/* -------------------------------------------------------------------------- */

const atAge = (state: GameState, age: number): GameState => ({
  ...state,
  player: { ...state.player, age },
});

describe('this year’s castings', () => {
  const model = (patch: Partial<ModelingState> = {}) =>
    known(adult('calls'), { tier: 'commercial', credits: 30, reputation: 40, craft: 70, ...patch });

  it('are nothing before fourteen', () => {
    expect(modelCalls(atAge(model(), 13))).toEqual([]);
    expect(modelCalls(atAge(model(), 14)).length).toBe(6);
  });

  it('are six, each a job that would be applied for, with an id of its own', () => {
    const calls = modelCalls(atAge(model(), 24));
    expect(calls).toHaveLength(MODEL_CASTINGS);
    expect(calls.map((row) => row.job.id)).toEqual(
      [0, 1, 2, 3, 4, 5].map((index) => `call:24:${index}`),
    );
    expect(calls.every((row) => row.job.source === 'applied')).toBe(true);
    expect(calls.every((row) => row.job.age === 24)).toBe(true);
    expect(calls.every((row) => row.applied === false)).toBe(true);
  });

  it('are the same each time they’re read, and different from one year to the next', () => {
    const state = atAge(model(), 24);
    expect(modelCalls(state)).toEqual(modelCalls(state));
    const next = modelCalls(atAge(model(), 25)).map((row) => row.job.id);
    expect(next).not.toEqual(modelCalls(state).map((row) => row.job.id));
  });

  it('sit at the model’s rung or one either side, and say which', () => {
    const state = atAge(model(), 24);
    for (const call of modelCalls(state)) {
      const gap = modelTierRank(call.job.tier) - modelTierRank('commercial');
      expect(Math.abs(gap)).toBeLessThanOrEqual(1);
      expect(call.reach).toBe(gap < 0 ? 'below' : gap === 0 ? 'at' : 'above');
    }
    const reaches = new Set(
      [22, 23, 24, 25, 26, 27, 28].flatMap((age) =>
        modelCalls(atAge(model(), age)).map((row) => row.reach),
      ),
    );
    expect([...reaches].sort()).toEqual(['above', 'at', 'below']);
  });

  it('lists a rung above only for a model who is ready for it', () => {
    for (const age of [20, 21, 22, 23, 24, 25]) {
      const calls = modelCalls(atAge(model({ credits: 4, craft: 70, reputation: 5 }), age));
      expect(
        calls.every((row) => row.job.tier !== 'editorial'),
        `${age}`,
      ).toBe(true);
    }
    const ready = [20, 21, 22, 23, 24, 25].flatMap((age) =>
      modelCalls(atAge(model({ credits: 10, craft: 60, reputation: 15 }), age)),
    );
    expect(ready.some((row) => row.job.tier === 'editorial')).toBe(true);
  });

  it('are backed down to what the model can do when their own rung wants more than they have', () => {
    const calls = [20, 21, 22].flatMap((age) =>
      modelCalls(atAge(model({ tier: 'face', credits: 0, reputation: 0, craft: 10 }), age)),
    );
    expect(calls.every((row) => row.job.tier === 'test')).toBe(true);
    expect(calls.every((row) => row.reach === 'below')).toBe(true);
    const part = modelCalls(
      atAge(model({ tier: 'campaign', credits: 4, reputation: 5, craft: 45 }), 24),
    );
    // Ready for commercial work and not for campaigns: the best they can do is commercial, not the bottom rung.
    expect(part.every((row) => modelTierRank(row.job.tier) <= modelTierRank('commercial'))).toBe(
      true,
    );
    expect(part.filter((row) => row.job.tier === 'commercial').length).toBeGreaterThanOrEqual(4);
    expect(part.every((row) => row.job.tier !== 'test')).toBe(true);
  });

  it('close the rung above after thirty', () => {
    const above = (age: number) =>
      modelCalls(atAge(model({ credits: 30, reputation: 40 }), age)).filter(
        (row) => row.reach === 'above',
      );
    const found = [27, 28, 29, 30].flatMap(above);
    expect(found.length).toBeGreaterThan(0);
    for (const age of [31, 32, 33, 34, 35, 36, 37, 38]) expect(above(age)).toEqual([]);
  });

  it('let a first-rung model who isn’t ready for more only see the first rung and the one above', () => {
    const calls = [16, 17, 18].flatMap((age) =>
      modelCalls(atAge(model({ tier: 'test', credits: 0, reputation: 0, craft: 40 }), age)),
    );
    expect(calls.every((row) => ['test', 'catalogue'].includes(row.job.tier))).toBe(true);
    expect(calls.some((row) => row.job.tier === 'catalogue')).toBe(true);
  });

  it('mark the ones already gone to', () => {
    const state = atAge(model(), 24);
    const first = modelCalls(state)[0]!;
    const gone = {
      ...state,
      modeling: { ...state.modeling, appliedAge: 24, applied: [first.job.id] },
    };
    expect(modelCalls(gone)[0]!.applied).toBe(true);
    expect(modelCalls(gone)[1]!.applied).toBe(false);
    // Last year's list of castings is last year's.
    const stale = {
      ...state,
      modeling: { ...state.modeling, appliedAge: 23, applied: [first.job.id] },
    };
    expect(modelCalls(stale)[0]!.applied).toBe(false);
  });

  it('are never the same client twice in a year’s list while there are others', () => {
    const clients = modelCalls(atAge(model({ tier: 'editorial', credits: 30 }), 24)).map(
      (row) => `${row.job.tier}:${row.job.client}`,
    );
    expect(new Set(clients).size).toBe(clients.length);
  });

  describe('the chance of landing one', () => {
    const chanceOf = (state: GameState, call: ReturnType<typeof modelCalls>[number]) => {
      const raw =
        MODEL_APPLY_BASE[call.reach] +
        ((modelCraftOf(state) - 50) / 100) * MODEL_APPLY_CRAFT_WEIGHT +
        (state.modeling.agency ? MODEL_APPLY_AGENCY_BONUS : 0) +
        ((state.modeling.reputation - 30) / 100) * MODEL_APPLY_REPUTATION_WEIGHT +
        MODEL_APPLY_PLACEMENT[call.job.placement];
      return Math.max(0.03, Math.min(0.95, raw));
    };

    it('is the rung’s base, plus craft, a name, an agency and the placement', () => {
      for (const agency of [undefined, { since: 20 }]) {
        for (const age of [20, 22, 24, 26]) {
          const state = atAge(model({ agency }), age);
          for (const call of modelCalls(state)) {
            expect(call.chance, `${age} ${call.job.id}`).toBeCloseTo(chanceOf(state, call), 10);
          }
        }
      }
    });

    it('is better for better craft, a better name and an agency, and for a smaller part', () => {
      const at = (patch: Partial<ModelingState>) =>
        modelCalls(atAge(model(patch), 24)).map((row) => row.chance);
      const base = at({});
      const better = (other: number[]) => other.every((value, index) => value >= base[index]!);
      expect(better(at({ craft: 90 }))).toBe(true);
      expect(better(at({ reputation: 80 }))).toBe(true);
      expect(better(at({ agency: { since: 20 } }))).toBe(true);
      expect(at({ craft: 90 })).not.toEqual(base);
      expect(at({ agency: { since: 20 } }).some((value, index) => value > base[index]!)).toBe(true);
    });

    it('never falls under three percent or goes over ninety-five', () => {
      const lows = [14, 15, 16, 17, 18, 19, 20, 21, 22].flatMap((age) =>
        modelCalls(atAge(model({ tier: 'test', credits: 0, reputation: 0, craft: 28 }), age)),
      );
      expect(Math.min(...lows.map((row) => row.chance))).toBe(0.03);
      const highs = [20, 21, 22, 23, 24].flatMap((age) =>
        modelCalls(
          atAge(
            model({
              tier: 'face',
              credits: 99,
              reputation: 100,
              craft: 100,
              agency: { since: 20 },
            }),
            age,
          ),
        ),
      );
      expect(Math.max(...highs.map((row) => row.chance))).toBe(0.95);
      for (const row of [...lows, ...highs]) {
        expect(row.chance).toBeGreaterThanOrEqual(0.03);
        expect(row.chance).toBeLessThanOrEqual(0.95);
      }
    });
  });
});

describe('going to a casting', () => {
  const model = (patch: Partial<ModelingState> = {}) =>
    atAge(
      known(adult('go'), { tier: 'commercial', credits: 30, reputation: 40, craft: 70, ...patch }),
      24,
    );

  it('is refused before fourteen, for a casting that isn’t open, and once only', () => {
    expect(applyToModelCall(atAge(model(), 13), 'call:13:0')).toEqual({
      ok: false,
      error: 'too-young',
    });
    expect(applyToModelCall(model(), 'call:24:99')).toEqual({ ok: false, error: 'no-such-call' });
    const state = model();
    const id = modelCalls(state)[0]!.job.id;
    const done = applyToModelCall(state, id);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(applyToModelCall(done.value.state, id)).toEqual({ ok: false, error: 'already-applied' });
  });

  it('is limited to three a year, five with an agency', () => {
    expect(modelApplicationsAllowed(EMPTY_MODELING)).toBe(3);
    expect(modelApplicationsAllowed({ ...EMPTY_MODELING, agency: { since: 20 } })).toBe(5);
    for (const [patch, limit] of [
      [{}, 3],
      [{ agency: { since: 20 } }, 5],
    ] as const) {
      let state = model(patch);
      const ids = modelCalls(state).map((row) => row.job.id);
      for (let index = 0; index < limit; index += 1) {
        const result = applyToModelCall(state, ids[index]!);
        expect(result.ok, `${index} of ${limit}`).toBe(true);
        if (!result.ok) return;
        // Whatever came of it, the next one is a new question.
        state = {
          ...result.value.state,
          pending: [],
          modeling: { ...result.value.state.modeling, offers: [] },
        };
      }
      expect(applyToModelCall(state, ids[limit]!)).toEqual({
        ok: false,
        error: 'no-applications-left',
      });
    }
  });

  it('is refused when the year hasn’t the days for the job', () => {
    const state = model({ booked: [booked({ days: 150 })] });
    const id = modelCalls(state)[0]!.job.id;
    expect(applyToModelCall(state, id)).toEqual({ ok: false, error: 'booked-up' });
    const room = model({ booked: [booked({ days: 150 - modelCalls(model())[0]!.job.days })] });
    expect(applyToModelCall(room, id).ok).toBe(true);
  });

  it('lands or doesn’t by one draw against the chance, the same every time', () => {
    const age = 24;
    const outcomes = [0, 1, 2, 3, 4, 5].map((index) => {
      const state = model();
      const call = modelCalls(state)[index]!;
      const draw = modelUnit(seedOf(state), genOf(state), 'cast', age, call.job.id);
      const result = applyToModelCall(state, call.job.id);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('unreachable');
      expect(result.value.landed, call.job.id).toBe(draw < call.chance);
      expect(applyToModelCall(state, call.job.id)).toEqual(result);
      return result.value.landed;
    });
    expect(outcomes).toContain(true);
  });

  it('puts a job it landed on the table and asks about it, and says so in a milestone', () => {
    const found = firstSeed(
      'landed',
      (seed) => {
        const state = atAge(
          known(adult(seed), { tier: 'commercial', credits: 30, reputation: 40, craft: 90 }),
          24,
        );
        for (const call of modelCalls(state)) {
          const result = applyToModelCall(state, call.job.id);
          if (result.ok && result.value.landed) return { state, call, result: result.value };
        }
        return undefined;
      },
      20,
    );
    const { call, result } = found;
    expect(result.state.modeling.offers).toEqual([call.job]);
    expect(result.state.modeling.applied).toEqual([call.job.id]);
    expect(result.state.modeling.appliedAge).toBe(24);
    expect(result.state.pending.some((row) => row.eventId === MODELING_OFFER_EVENT_ID)).toBe(true);
    expect(result.entry.kind).toBe('milestone');
    expect(result.entry.text).toMatch(
      /^Went to a casting for .* for .*\. They offered you the job\.$/,
    );
    expect(result.entry.text).toContain(call.job.client);
    expect(result.state.player.timeline.at(-1)).toEqual(result.entry);
    expect(result.entry.age).toBe(24);
    expect(result.entry.id).toBe(`t:${result.state.world.year}:modeling:apply:${call.job.id}`);
  });

  it('leaves nothing but a line for a casting it didn’t land', () => {
    const found = firstSeed(
      'denied',
      (seed) => {
        const state = atAge(
          known(adult(seed), { tier: 'commercial', credits: 30, reputation: 40, craft: 40 }),
          24,
        );
        for (const call of modelCalls(state)) {
          const result = applyToModelCall(state, call.job.id);
          if (result.ok && !result.value.landed) return { state, call, result: result.value };
        }
        return undefined;
      },
      20,
    );
    const { state, call, result } = found;
    expect(result.state.modeling.offers).toEqual(state.modeling.offers);
    expect(result.state.pending).toEqual(state.pending);
    expect(result.state.modeling.applied).toEqual([call.job.id]);
    expect(result.entry.kind).toBe('passive');
    expect(result.entry.text).toMatch(/They went another way\.$/);
  });
});

/* -------------------------------------------------------------------------- */
/* A portfolio                                                                 */
/* -------------------------------------------------------------------------- */

describe('a portfolio', () => {
  const young = (age: number, standard = 60_000) => {
    const base = adult('portfolio', 26);
    return {
      ...atAge(base, age),
      household: { ...base.household, standard },
    };
  };

  it('can be shot from fourteen, not before', () => {
    expect(shootPortfolio(young(13))).toEqual({ ok: false, error: 'too-young' });
    expect(shootPortfolio(young(14)).ok).toBe(true);
    expect(shootPortfolio(young(30)).ok).toBe(true);
  });

  it('gets the model seen: a craft, and a year bookers remember', () => {
    const state = young(20);
    const result = shootPortfolio(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value.state.modeling;
    expect(next.seenAge).toBe(20);
    expect(next.portfolioAge).toBe(20);
    expect(next.craft).toBe(modelCraftOf(state));
    expect(isModelSeen(next, 22)).toBe(true);
    expect(isModelSeen(state.modeling, 22)).toBe(false);
  });

  it('keeps a craft that has been built, rather than writing the character over it', () => {
    const result = shootPortfolio(known(young(20), { craft: 77 }));
    expect(result.ok && result.value.state.modeling.craft).toBe(77);
  });

  it('keeps everything else about the model as it was', () => {
    const state = known(young(20), {
      credits: 9,
      followers: 123,
      tier: 'commercial',
      offers: [job()],
    });
    const result = shootPortfolio(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect({ ...result.value.state.modeling, seenAge: 0, portfolioAge: 0 }).toEqual({
      ...state.modeling,
      seenAge: 0,
      portfolioAge: 0,
    });
  });

  it('is once a year, and again the year after', () => {
    const first = shootPortfolio(young(20));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(shootPortfolio(first.value.state)).toEqual({ ok: false, error: 'already-shot' });
    expect(shootPortfolio(atAge(first.value.state, 21)).ok).toBe(true);
    expect(shootPortfolio(atAge(first.value.state, 19)).ok).toBe(true);
  });

  it('is a line in the timeline, in the year it happened, and not a milestone', () => {
    const result = shootPortfolio(young(20));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entry.text).toBe(
      'Had pictures taken and sent them round to the agencies and the bookers.',
    );
    expect(result.value.entry.kind).toBe('passive');
    expect(result.value.entry.age).toBe(20);
    expect(result.value.entry.id).toBe(`t:${young(20).world.year}:modeling:portfolio`);
    expect(result.value.state.player.timeline.at(-1)).toEqual(result.value.entry);
  });

  it('is an adult’s own expense, and refused when a year’s money can’t spare it', () => {
    const adultOnOwn = {
      ...young(30, 0),
      household: { ...young(30, 0).household, housing: 'ownPlace' as const },
    };
    expect(paysOwnPortfolio(adultOnOwn)).toBe(true);
    expect(shootPortfolio(adultOnOwn)).toEqual({ ok: false, error: 'cant-afford' });
    const comfortable = {
      ...adultOnOwn,
      household: { ...adultOnOwn.household, standard: 100_000 },
    };
    expect(shootPortfolio(comfortable).ok).toBe(true);
    // 900 is a twentieth of what is left over a subsistence of 22,000: 40,000 is not enough and 40,001 is the edge.
    const at = (standard: number) =>
      shootPortfolio({ ...adultOnOwn, household: { ...adultOnOwn.household, standard } }).ok;
    expect(at(30_000)).toBe(false);
    expect(at(100_000)).toBe(true);
  });

  it('is a parent’s expense for somebody under eighteen or living at home, and never refused for the money', () => {
    const teen = young(16, 0);
    expect(paysOwnPortfolio(teen)).toBe(false);
    expect(shootPortfolio(teen).ok).toBe(true);
    const home = {
      ...young(30, 0),
      household: { ...young(30, 0).household, housing: 'withFamily' as const },
    };
    expect(paysOwnPortfolio(home)).toBe(false);
    expect(shootPortfolio(home).ok).toBe(true);
    const eighteen = {
      ...young(18, 0),
      household: { ...young(18, 0).household, housing: 'ownPlace' as const },
    };
    expect(paysOwnPortfolio(eighteen)).toBe(true);
    expect(paysOwnPortfolio({ ...eighteen, player: { ...eighteen.player, age: 17 } })).toBe(false);
  });

  it('has words for each way it goes wrong', () => {
    expect(MODELING_ERROR_LABELS).toEqual({
      'too-young': "You're too young for that.",
      'already-shot': "You've had pictures taken this year already.",
      'cant-afford': "You can't spare the money for the pictures this year.",
      'has-agency': 'You already have an agency.',
      'no-agency': "You don't have an agency.",
      'nobody-will-take-you-on':
        "Nobody's willing to sign you yet. Get some work behind you first.",
    });
  });
});

describe('an agency', () => {
  const model = (patch: Partial<ModelingState> = {}) =>
    known(adult('agency'), { credits: 5, ...patch });

  it('wants a couple of jobs behind you, and nothing else', () => {
    expect(signWithAgency(model({ credits: 1 }))).toEqual({
      ok: false,
      error: 'nobody-will-take-you-on',
    });
    expect(signWithAgency(model({ credits: 0 }))).toEqual({
      ok: false,
      error: 'nobody-will-take-you-on',
    });
    expect(signWithAgency(model({ credits: 2 })).ok).toBe(true);
    expect(signWithAgency(model({ credits: 2, tier: 'test', reputation: 0, craft: 0 })).ok).toBe(
      true,
    );
  });

  it('signs the model from this age, and says it takes a fifth', () => {
    const state = model();
    const result = signWithAgency(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.modeling.agency).toEqual({ since: state.player.age });
    expect(result.value.entry.text).toBe(
      'Signed with an agency. They take 20 percent and they’ll be sending you out.',
    );
    expect(result.value.entry.kind).toBe('milestone');
    expect(result.value.entry.id).toBe(`t:${state.world.year}:modeling:agency:sign`);
    expect(result.value.state.player.records.at(-1)).toMatchObject({
      category: 'career',
      label: 'Signed with a modeling agency',
      age: state.player.age,
    });
    expect(result.value.state.player.records).toHaveLength(state.player.records.length + 1);
  });

  it('is one at a time', () => {
    const signed = signWithAgency(model());
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    expect(signWithAgency(signed.value.state)).toEqual({ ok: false, error: 'has-agency' });
  });

  it('can be left, and the model is who they were without one', () => {
    const signed = signWithAgency(model());
    if (!signed.ok) throw new Error('unreachable');
    const left = leaveAgency(signed.value.state);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.value.state.modeling.agency).toBeUndefined();
    expect('agency' in left.value.state.modeling).toBe(false);
    expect(left.value.entry.text).toBe('Parted ways with the agency.');
    expect(left.value.entry.kind).toBe('passive');
    expect(left.value.state.player.records).toHaveLength(signed.value.state.player.records.length);
    expect(leaveAgency(left.value.state)).toEqual({ ok: false, error: 'no-agency' });
    expect(leaveAgency(model())).toEqual({ ok: false, error: 'no-agency' });
  });

  it('is signed with and left without disturbing the rest of the model', () => {
    const state = model({ followers: 777, offers: [job()], booked: [booked()] });
    const signed = signWithAgency(state);
    if (!signed.ok) throw new Error('unreachable');
    const { agency: _agency, ...rest } = signed.value.state.modeling;
    expect(rest).toEqual(state.modeling);
  });
});

/* -------------------------------------------------------------------------- */
/* Answering an offer                                                          */
/* -------------------------------------------------------------------------- */

const roundTo = (value: number, steps: readonly [number, number, number][]) => {
  const step = steps.find(([below]) => value < below)?.[1] ?? steps.at(-1)![1];
  return Math.round(value / step) * step;
};
const rateRound = (rate: number) =>
  roundTo(rate, [
    [1_000, 25, 0],
    [10_000, 100, 0],
    [100_000, 500, 0],
    [Infinity, 5_000, 0],
  ]);
const feeRound = (fee: number) =>
  roundTo(fee, [
    [10_000, 100, 0],
    [1_000_000, 1_000, 0],
    [Infinity, 10_000, 0],
  ]);

describe('answering an offer', () => {
  const asked = (offers: Job[], patch: Partial<ModelingState> = {}) =>
    withModelingOffer(known(adult('answer'), { offers, ...patch }), true);
  const answer = (state: GameState, choice: string) => {
    const result = answerModelingOffer(state, choice);
    if (!result.ok) throw new Error(`refused: ${result.error}`);
    return result.value;
  };

  it('is refused with nothing on the table, and for a choice that isn’t one', () => {
    expect(answerModelingOffer(known(adult('answer')), 'accept')).toEqual({
      ok: false,
      error: 'no-offer',
    });
    const state = asked([job()]);
    expect(answerModelingOffer(state, 'maybe')).toEqual({ ok: false, error: 'no-such-choice' });
    expect(answerModelingOffer(state, '')).toEqual({ ok: false, error: 'no-such-choice' });
    // Ask for more isn't there for a job that's been asked about, or one that doesn't pay enough.
    expect(answerModelingOffer(asked([job({ asked: true })]), 'more')).toEqual({
      ok: false,
      error: 'no-such-choice',
    });
    expect(answerModelingOffer(asked([job({ rate: 10, days: 2, usage: 0 })]), 'more')).toEqual({
      ok: false,
      error: 'no-such-choice',
    });
  });

  it('goes through the game’s own door, by id', () => {
    const state = asked([job()]);
    const result = decide(state, MODELING_OFFER_EVENT_ID, 'decline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.modeling.offers).toEqual([]);
    const nonsense = decide(state, MODELING_OFFER_EVENT_ID, 'nonsense');
    expect(!nonsense.ok && nonsense.error).toBe('no-such-choice');
    const nobody = decide(known(adult('answer')), MODELING_OFFER_EVENT_ID, 'accept');
    expect(!nobody.ok && nobody.error).toBe('no-such-decision');
    // A question left open with the offer gone: nothing to answer.
    const stale = { ...state, modeling: { ...state.modeling, offers: [] } };
    const gone = decide(stale, MODELING_OFFER_EVENT_ID, 'decline');
    expect(!gone.ok && gone.error).toBe('unresolvable');
  });

  describe('passing', () => {
    it('takes it off the table with a line, and asks about the next', () => {
      const first = job({ id: '26:0', client: 'Tern Footwear' });
      const second = job({ id: '26:1', client: 'Marlow & Pike' });
      const out = answer(asked([first, second]), 'decline');
      expect(out.state.modeling.offers).toEqual([second]);
      expect(out.entry.text).toBe(
        `Passed on a featured spot in a catalogue shoot for Tern Footwear.`,
      );
      expect(out.entry.kind).toBe('passive');
      expect(out.entry.age).toBe(26);
      expect(out.entry.id).toBe(`t:${out.state.world.year}:modeling:pass:26:0`);
      const pending = out.state.pending.filter((row) => row.eventId === MODELING_OFFER_EVENT_ID);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.prompt).toContain('Marlow & Pike');
      expect(out.state.modeling.booked).toEqual([]);
    });

    it('leaves nothing pending when it was the last', () => {
      const out = answer(asked([job()]), 'decline');
      expect(out.state.pending.some((row) => row.eventId === MODELING_OFFER_EVENT_ID)).toBe(false);
      expect(hasSystemicOffer(out.state)).toBe(false);
    });
  });

  describe('asking for more', () => {
    const chanceFor = (modeling: ModelingState) =>
      Math.min(
        0.9,
        MODEL_ASK_BASE +
          (modeling.reputation / 100) * MODEL_ASK_REPUTATION_WEIGHT +
          (modeling.agency ? MODEL_AGENCY_ASK_BONUS : 0),
      );
    const tryAsk = (patch: Partial<ModelingState>, want: boolean) =>
      firstSeed(
        `ask-${want}`,
        (seed) => {
          for (let n = 0; n < 12; n += 1) {
            const row = job({ id: `26:${n}` });
            const state = withModelingOffer(known(adult(seed), { offers: [row], ...patch }), true);
            const draw = modelUnit(seedOf(state), genOf(state), 'ask', row.id);
            if (draw < chanceFor(state.modeling) === want) return { state, row, draw };
          }
          return undefined;
        },
        30,
      );

    it('works when the draw is under the chance, and brings the pay up by a tenth to a quarter', () => {
      const { state, row } = tryAsk({ reputation: 40 }, true);
      const out = answer(state, 'more');
      const gain =
        MODEL_ASK_GAIN[0] +
        modelUnit(seedOf(state), genOf(state), 'askgain', row.id) *
          (MODEL_ASK_GAIN[1] - MODEL_ASK_GAIN[0]);
      const next = out.state.modeling.offers[0]!;
      expect(next.rate).toBe(rateRound(row.rate * gain));
      expect(next.usage).toBe(feeRound(row.usage * gain));
      expect(next.asked).toBe(true);
      expect(next.rate).toBeGreaterThanOrEqual(row.rate);
      expect(jobFee(next)).toBeGreaterThan(jobFee(row));
      expect(next.days).toBe(row.days);
      expect(out.entry.text).toBe(
        `You asked for more and they came up to ${money(jobFee(next))} for a featured spot in a catalogue shoot for Calloway Outfitters.`,
      );
    });

    it('doesn’t work when the draw is over the chance: the pay holds, and it can’t be asked again', () => {
      const { state, row } = tryAsk({ reputation: 40 }, false);
      const out = answer(state, 'more');
      const next = out.state.modeling.offers[0]!;
      expect(next).toEqual({ ...row, asked: true });
      expect(out.entry.text).toBe(
        `You asked for more. They held at ${money(jobFee(row))} for a featured spot in a catalogue shoot for Calloway Outfitters.`,
      );
      // Still on the table, still the first question, and without the option.
      const pending = out.state.pending.find((r) => r.eventId === MODELING_OFFER_EVENT_ID)!;
      expect(pending.choices.map((choice) => choice.id)).toEqual(['accept', 'decline']);
    });

    it('is an easier ask for a better name and for an agency, up to nine in ten', () => {
      expect(chanceFor({ ...EMPTY_MODELING, reputation: 0 })).toBe(0.5);
      expect(chanceFor({ ...EMPTY_MODELING, reputation: 100 })).toBe(0.75);
      expect(chanceFor({ ...EMPTY_MODELING, reputation: 100, agency: { since: 20 } })).toBe(0.9);
      expect(chanceFor({ ...EMPTY_MODELING, reputation: 500, agency: { since: 20 } })).toBe(0.9);
      // The engine agrees with that: a draw of 0.74 lands for a famous name and not for an unknown.
      const row = job({ id: '26:0' });
      const state = (reputation: number) =>
        withModelingOffer(known(adult('answer'), { offers: [row], reputation }), true);
      const draw = modelUnit(seedOf(state(0)), genOf(state(0)), 'ask', row.id);
      const worked = (reputation: number) =>
        answer(state(reputation), 'more').state.modeling.offers[0]!.rate > row.rate;
      expect(worked(100)).toBe(draw < 0.75);
      expect(worked(0)).toBe(draw < 0.5);
    });

    it('keeps the offer’s place at the front of the queue', () => {
      const first = job({ id: '26:0', client: 'Tern Footwear' });
      const second = job({ id: '26:1', client: 'Marlow & Pike' });
      const out = answer(asked([first, second]), 'more');
      expect(out.state.modeling.offers.map((row) => row.id)).toEqual(['26:0', '26:1']);
      expect(out.state.modeling.offers[1]).toEqual(second);
      expect(
        out.state.pending.filter((row) => row.eventId === MODELING_OFFER_EVENT_ID),
      ).toHaveLength(1);
    });
  });

  describe('taking it', () => {
    it('books it for the year to come, with everything about it, and sets a craft', () => {
      const row = job({
        id: '26:3',
        placement: 'face',
        rate: 2_000,
        days: 12,
        usage: 4_000,
        age: 26,
      });
      const out = answer(asked([row], { craft: undefined }), 'accept');
      expect(out.state.modeling.offers).toEqual([]);
      expect(out.state.modeling.booked).toEqual([
        {
          id: '26:3',
          tier: 'catalogue',
          placement: 'face',
          medium: 'a catalogue shoot',
          client: 'Calloway Outfitters',
          rate: 2_000,
          days: 12,
          usage: 4_000,
          age: 26,
          bookedAge: 26,
        },
      ]);
      expect(out.state.modeling.craft).toBe(naturalModelCraftOf(out.state));
      expect(out.entry.kind).toBe('milestone');
      expect(out.entry.text).toBe(
        'Took the job: the face of a catalogue shoot for Calloway Outfitters. The shoot is this year.',
      );
      expect(out.entry.id).toBe(`t:${out.state.world.year}:modeling:take:26:3`);
      expect(out.entry.age).toBe(26);
    });

    it('keeps a craft that has been built', () => {
      const out = answer(asked([job()], { craft: 71 }), 'accept');
      expect(out.state.modeling.craft).toBe(71);
    });

    it('adds to what is already booked, in order', () => {
      const out = answer(
        asked([job({ id: '26:1' })], { booked: [booked({ id: '25:0' })] }),
        'accept',
      );
      expect(out.state.modeling.booked.map((row) => row.id)).toEqual(['25:0', '26:1']);
    });

    it('fits a job into the year exactly to the hundred and fiftieth day, and no further', () => {
      const fits = answer(
        asked([job({ days: 50 })], { booked: [booked({ days: 100 })] }),
        'accept',
      );
      expect(fits.state.modeling.booked).toHaveLength(2);
      expect(fits.entry.text).toMatch(/^Took the job/);
      const over = answer(
        asked([job({ days: 51 })], { booked: [booked({ days: 100 })] }),
        'accept',
      );
      expect(over.state.modeling.booked).toHaveLength(1);
      expect(over.state.modeling.offers).toEqual([]);
      expect(over.entry.kind).toBe('passive');
      expect(over.entry.text).toBe(
        'Couldn’t fit a featured spot in a catalogue shoot for Calloway Outfitters in. The year was already full.',
      );
    });

    it('moves on to the next question', () => {
      const out = answer(
        asked([job({ id: '26:0' }), job({ id: '26:1', client: 'Marlow & Pike' })]),
        'accept',
      );
      const pending = out.state.pending.filter((row) => row.eventId === MODELING_OFFER_EVENT_ID);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.prompt).toContain('Marlow & Pike');
    });
  });
});

const naturalModelCraftOf = (state: GameState) => naturalModelCraft(state.player.stats);

/* -------------------------------------------------------------------------- */
/* A year with nothing to do with modeling                                     */
/* -------------------------------------------------------------------------- */

describe('a year with nothing to do with modeling', () => {
  it('is an empty year, for somebody who has never been near any of it', () => {
    const base = adult('year-none');
    const result = yearOf(base);
    expect(result).toEqual(emptyModelingYear(base.modeling));
    expect(result.modeling).toBe(base.modeling);
  });

  it('is an empty year for the dead, whatever they had built', () => {
    const live = known(adult('year-dead'), { booked: [booked()] });
    const dead = { ...live, player: { ...live.player, alive: false } };
    expect(yearOf(dead)).toEqual(emptyModelingYear(dead.modeling));
  });

  it('is nothing at all: no pay, no fee, no fans, no fame, no mood, no lines', () => {
    expect(emptyModelingYear(EMPTY_MODELING)).toEqual({
      modeling: EMPTY_MODELING,
      lines: [],
      records: [],
      pay: 0,
      brandPay: 0,
      agencyShare: 0,
      fame: 0,
      mood: 0,
      fees: 0,
      feeSource: 'Portfolio photos',
      fans: 0,
    });
  });

  it('starts when craft is set, which a portfolio or a job does', () => {
    const base = adult('year-start');
    expect(yearOf(base)).toEqual(emptyModelingYear(base.modeling));
    const started = yearOf(withModeling(base, { craft: 40 }));
    expect(started.modeling.craft).toBeDefined();
    expect(started.modeling).not.toBe(base.modeling);
    expect(started.modeling.appliedAge).toBe(27);
  });
});

/* -------------------------------------------------------------------------- */
/* A job that was booked                                                       */
/* -------------------------------------------------------------------------- */

const strong = (seed: string) =>
  withStats(adult(seed), { looks: 80, charisma: 80, discipline: 80, smarts: 80 });

describe('a job that was booked', () => {
  it('is paid the day rate for the days, and the usage, with no agency taking a share', () => {
    const { out } = shot(adult('pay'), 60, { rate: 1_000, days: 10, usage: 500 });
    expect(out.pay).toBe(10_500);
    expect(out.agencyShare).toBe(0);
    expect(out.brandPay).toBe(0);
    expect(out.modeling.lastPay).toBe(10_500);
  });

  it('is paid after a fifth to the agency, which is a line of its own', () => {
    const { out } = shot(
      adult('pay'),
      60,
      { rate: 1_000, days: 10, usage: 500 },
      { agency: { since: 20 } },
    );
    expect(out.agencyShare).toBe(2_100);
    expect(out.pay).toBe(8_400);
    expect(out.modeling.lastPay).toBe(8_400);
    expect(lineOf(out.lines, /^Shot/)!.text).toContain(
      'It paid $10,500, and the agency’s share was $2,100.',
    );
  });

  it('rounds an agency’s share to the dollar', () => {
    const { out } = shot(
      adult('pay'),
      60,
      { rate: 333, days: 1, usage: 0 },
      { agency: { since: 20 } },
    );
    expect(out.agencyShare).toBe(67);
    expect(out.pay).toBe(266);
  });

  it('adds up across jobs', () => {
    const base = adult('pay-two');
    const year = base.world.year + 1;
    const rows = [
      booked({ id: '25:0', rate: 500, days: 4, usage: 0 }),
      booked({ id: '25:1', rate: 700, days: 3, usage: 100 }),
    ];
    const state = known(base, { craft: 60, booked: rows });
    expect(yearOf(state).pay).toBe(2_000 + 2_200);
    expect(yearOf(state).modeling.credits).toBe(14);
    expect(year).toBe(base.world.year + 1);
  });

  it('is a job done: it is off the books, craft and the year’s list of castings start over', () => {
    const { out } = shot(adult('done'), 60);
    expect(out.modeling.booked).toEqual([]);
    expect(out.modeling.applied).toEqual([]);
    expect(out.modeling.appliedAge).toBe(27);
    expect(out.modeling.credits).toBe(13);
    expect(out.modeling.seenAge).toBe(27);
    expect(out.modeling.brandOwed).toBe(0);
    expect(out.modeling.brandAnswered).toEqual([]);
  });

  it('doesn’t pay a thing that paid nothing, and says so by saying nothing about money', () => {
    const { out } = shot(adult('free'), 60, { tier: 'test', rate: 0, usage: 0, days: 2 });
    expect(out.pay).toBe(0);
    expect(lineOf(out.lines, /^Shot/)!.text).not.toMatch(/It paid/);
  });

  it('is judged against the rung’s hit line: a hit at the line, a miss a hair under it', () => {
    const line = MODEL_TIER_ROWS.catalogue.hitLine;
    expect(lineOf(shot(adult('hit'), line + 1e-6).out.lines, /^Shot/)!.text).toMatch(
      /The client loved it\./,
    );
    expect(lineOf(shot(adult('hit'), line - 1e-6).out.lines, /^Shot/)!.text).toMatch(
      /It came and went\./,
    );
  });

  it('flops under the line by more than twenty-five, and not at twenty-five', () => {
    const floor = MODEL_TIER_ROWS.catalogue.hitLine - MODEL_FLOP_MARGIN;
    expect(lineOf(shot(adult('flop'), floor + 1e-6).out.lines, /^Shot/)!.text).toMatch(
      /It came and went\./,
    );
    expect(lineOf(shot(adult('flop'), floor - 1e-6).out.lines, /^Shot/)!.text).toMatch(
      /They weren’t happy with the pictures\./,
    );
  });

  it('is judged against the job’s own rung, not the model’s', () => {
    // 60 is a hit at catalogue (52) and a miss at campaign (72).
    expect(lineOf(shot(adult('rung'), 60, { tier: 'campaign' }).out.lines, /^Shot/)!.text).toMatch(
      /It came and went\./,
    );
    expect(lineOf(shot(adult('rung'), 60, { tier: 'catalogue' }).out.lines, /^Shot/)!.text).toMatch(
      /loved it/,
    );
    expect(
      lineOf(shot(adult('rung'), 60, { tier: 'test' }, { tier: 'test' }).out.lines, /^Shot/)!.text,
    ).toMatch(/loved it/);
  });

  it('names the work: the placement, the kind of job and the client', () => {
    const { out, row } = shot(adult('named'), 60, {
      placement: 'group',
      medium: 'a runway show',
      client: 'Atelier Noir',
      tier: 'editorial',
    });
    expect(
      lineOf(out.lines, /^Shot/)!.text.startsWith(
        'Shot a group spot in a runway show for Atelier Noir. ',
      ),
    ).toBe(true);
    expect(row.client).toBe('Atelier Noir');
  });

  it('is a performance that comes from craft, plus up to fifteen either way', () => {
    // The same job at craft 40 and 70 is judged differently; and the draw moves it by under fifteen.
    const base = adult('craft-perf');
    const year = base.world.year + 1;
    const loses = known(base, { craft: 20, booked: [booked()] });
    const wins = known(base, { craft: 90, booked: [booked()] });
    expect(lineOf(yearOf(loses).lines, /^Shot/)!.text).not.toMatch(/loved it/);
    expect(lineOf(yearOf(wins).lines, /^Shot/)!.text).toMatch(/loved it/);
    const draw = modelUnit(seedOf(base), genOf(base), 'perf', year, '25:0');
    expect(draw).toBeGreaterThanOrEqual(0);
    expect(draw).toBeLessThan(1);
    expect(craftFor(base, year, '25:0', 52) + (draw - 0.5) * 30).toBeCloseTo(52, 10);
  });

  it('uses the craft the model started the year with, and not the one it ends on', () => {
    const base = adult('craft-start');
    const year = base.world.year + 1;
    const state = known(base, {
      craft: craftFor(base, year, '25:0', 52 - 1e-6),
      booked: [booked()],
    });
    // A miss by a hair, however much the year's work then lifts craft.
    expect(lineOf(yearOf(state).lines, /^Shot/)!.text).toMatch(/It came and went\./);
  });

  it('is nothing for a model whose craft was never set: nothing could have been booked', () => {
    const base = withModeling(strong('craft-natural'), {
      booked: [booked()],
      credits: 5,
      craft: undefined,
    });
    expect(yearOf(base)).toEqual(emptyModelingYear(base.modeling));
  });
});

describe('what a job does to a name', () => {
  const repAfter = (performance: number, over: Partial<BookedJob> = {}, start = 20) => {
    const { out } = shot(adult('rep'), performance, over, { reputation: start });
    return out.modeling.reputation;
  };

  it('adds the rung’s reputation, scaled by the placement, and three for a hit', () => {
    // Catalogue is worth 2; a featured spot is 0.6 of that, rounded: 1.
    expect(repAfter(60)).toBe(20 + 1 + 3);
    expect(repAfter(45)).toBe(20 + 1);
    expect(repAfter(60, { placement: 'face' })).toBe(20 + 2 + 3);
    expect(repAfter(60, { placement: 'group' })).toBe(20 + 1 + 3);
    // Neither a hit nor a flop at the top of the ladder: 60 is under the line of 82 and over the floor of 57.
    expect(repAfter(60, { tier: 'face', placement: 'face' })).toBe(20 + 6);
  });

  it('takes three for a flop', () => {
    expect(repAfter(20)).toBe(20 + 1 - 3);
    expect(repAfter(20, { placement: 'face' })).toBe(20 + 2 - 3);
  });

  it('stays between nothing and a hundred', () => {
    expect(repAfter(20, {}, 0)).toBe(0);
    expect(repAfter(20, { placement: 'group' }, 1)).toBe(0);
    expect(repAfter(60, {}, 99)).toBe(100);
    expect(repAfter(60, { placement: 'face' }, 98)).toBe(100);
  });

  it('is judged by the placement’s share of the rung', () => {
    expect(MODEL_PLACEMENT_REPUTATION).toEqual({ face: 1, featured: 0.6, group: 0.3 });
    expect(repAfter(60, { tier: 'campaign' }, 50)).toBe(50 + 3);
    expect(repAfter(60, { tier: 'campaign', placement: 'face' }, 50)).toBe(50 + 5);
    expect(repAfter(60, { tier: 'campaign', placement: 'group' }, 50)).toBe(50 + 2);
  });
});

describe('what a job does to a mood and a following', () => {
  it('lifts the spirits two for a hit, drops them two for a flop, and leaves them for neither', () => {
    expect(shot(adult('mood'), 60).out.mood).toBe(2);
    expect(shot(adult('mood'), 45).out.mood).toBe(0);
    expect(shot(adult('mood'), 20).out.mood).toBe(-2);
  });

  it('adds up across jobs', () => {
    const base = adult('mood-two');
    const year = base.world.year + 1;
    const rows = [booked({ id: '25:0' }), booked({ id: '25:1' })];
    const state = known(base, { craft: 90, booked: rows });
    expect(yearOf(state).mood).toBe(4);
    expect(year).toBe(base.world.year + 1);
  });

  it('brings the rung’s following, scaled by the placement, a quarter more for a hit', () => {
    expect(shot(adult('fans'), 60, {}, { followers: 0 }).out.fans).toBe(
      Math.round(300 * 0.5 * 1.25),
    );
    expect(shot(adult('fans'), 45, {}, { followers: 0 }).out.fans).toBe(150);
    expect(shot(adult('fans'), 60, { placement: 'face' }, { followers: 0 }).out.fans).toBe(375);
    expect(shot(adult('fans'), 60, { placement: 'group' }, { followers: 0 }).out.fans).toBe(
      Math.round(300 * 0.15 * 1.25),
    );
    expect(
      shot(adult('fans'), 80, { tier: 'campaign', placement: 'face' }, { followers: 0 }).out.fans,
    ).toBe(50_000);
  });

  it('keeps a following less eight percent a year, and adds the new people', () => {
    const { out } = shot(adult('keep'), 45, {}, { followers: 10_000, peak: 10_000 });
    expect(out.modeling.followers).toBe(9_200 + 150);
    expect(out.modeling.peak).toBe(Math.max(10_000, 9_350));
    const grown = shot(
      adult('keep'),
      80,
      { tier: 'campaign', placement: 'face' },
      { followers: 1_000, peak: 1_000 },
    );
    expect(grown.out.modeling.followers).toBe(920 + 50_000);
    expect(grown.out.modeling.peak).toBe(50_920);
  });

  it('lets go of the following in a year with no work, and keeps the best it has been', () => {
    const state = known(adult('keep-idle'), { followers: 10_000, peak: 12_000 });
    const out = yearOf(state);
    expect(out.modeling.followers).toBe(9_200);
    expect(out.modeling.peak).toBe(12_000);
    expect(out.fans).toBe(0);
  });
});

describe('a name is made, and lost', () => {
  it('rises a rung after enough hits at the rung, if the model is ready', () => {
    const base = strong('rise');
    const { out } = shot(
      base,
      60,
      { tier: 'catalogue' },
      { tier: 'catalogue', hits: 1, reputation: 20, credits: 12 },
    );
    expect(out.modeling.tier).toBe('commercial');
    expect(out.modeling.hits).toBe(0);
    const line = lineOf(out.lines, /^Commercial and print jobs/)!;
    expect(line.kind).toBe('milestone');
    expect(line.text).toBe(MODEL_RISE_LINES.commercial);
    expect(out.records).toContainEqual({
      category: 'career',
      label: 'Moved up to commercial and print',
    });
  });

  it('counts a hit at the rung and not a hit below it', () => {
    const base = strong('rise');
    const at = shot(base, 60, { tier: 'catalogue' }, { tier: 'catalogue', hits: 0 });
    expect(at.out.modeling.hits).toBe(1);
    const below = shot(base, 60, { tier: 'test' }, { tier: 'catalogue', hits: 0 });
    expect(below.out.modeling.hits).toBe(0);
    const above = shot(
      base,
      70,
      { tier: 'commercial' },
      { tier: 'catalogue', hits: 0, credits: 12 },
    );
    expect(above.out.modeling.hits).toBe(0);
    expect(above.out.modeling.tier).toBe('commercial');
  });

  it('keeps its hits until the number needed, and counts them across years', () => {
    const base = strong('rise-count');
    const still = shot(
      base,
      60,
      { tier: 'commercial' },
      { tier: 'commercial', hits: 0, credits: 12, reputation: 30 },
    );
    expect(still.out.modeling.tier).toBe('commercial');
    expect(still.out.modeling.hits).toBe(1);
    const two = shot(
      base,
      60,
      { tier: 'commercial' },
      { tier: 'commercial', hits: 1, credits: 12, reputation: 30 },
    );
    expect(two.out.modeling.tier).toBe('commercial');
    expect(two.out.modeling.hits).toBe(2);
    const three = shot(
      base,
      70,
      { tier: 'commercial' },
      { tier: 'commercial', hits: 2, credits: 12, reputation: 30 },
    );
    expect(three.out.modeling.tier).toBe('editorial');
    expect(three.out.modeling.hits).toBe(0);
  });

  it('rises at once on a hit one rung above, to that rung', () => {
    const base = strong('rise-jump');
    const { out } = shot(
      base,
      70,
      { tier: 'commercial' },
      { tier: 'catalogue', hits: 0, credits: 12, reputation: 20 },
    );
    expect(out.modeling.tier).toBe('commercial');
    expect(lineOf(out.lines, /^Commercial and print jobs/)).toBeDefined();
  });

  it('does not rise to a rung the model isn’t ready for, and keeps its hits', () => {
    const base = strong('rise-not');
    const noName = shot(
      base,
      60,
      { tier: 'catalogue' },
      { tier: 'catalogue', hits: 1, reputation: 0, credits: 3 },
    );
    expect(noName.out.modeling.tier).toBe('catalogue');
    expect(noName.out.modeling.hits).toBe(2);
    const fewJobs = shot(
      base,
      70,
      { tier: 'commercial' },
      { tier: 'catalogue', hits: 0, credits: 1, reputation: 20 },
    );
    expect(fewJobs.out.modeling.tier).toBe('catalogue');
    const lowCraft = shot(
      withStats(base, { looks: 10, charisma: 10, discipline: 10, smarts: 10 }),
      70,
      { tier: 'commercial' },
      { tier: 'catalogue', craft: undefined, credits: 12, reputation: 20 },
    );
    expect(lowCraft.out.modeling.tier).toBe('catalogue');
  });

  it('is ready on the numbers the year ends with, not the ones it began with', () => {
    // Commercial wants 4 jobs: 3 before and 1 more this year is exactly ready.
    const base = strong('rise-ends');
    const ready = shot(
      base,
      70,
      { tier: 'commercial' },
      { tier: 'catalogue', credits: 3, reputation: 20 },
    );
    expect(ready.out.modeling.tier).toBe('commercial');
    const not = shot(
      base,
      70,
      { tier: 'commercial' },
      { tier: 'catalogue', credits: 2, reputation: 20 },
    );
    expect(not.out.modeling.tier).toBe('catalogue');
  });

  it('never rises past the face of a house', () => {
    const base = strong('rise-top');
    const { out } = shot(
      withStats(base, { looks: 100, charisma: 100, discipline: 100, smarts: 100 }),
      99,
      { tier: 'face', placement: 'face' },
      { tier: 'face', hits: 98, credits: 80, reputation: 80, craft: 99 },
    );
    expect(out.modeling.tier).toBe('face');
    expect(out.modeling.hits).toBe(99);
  });

  it('records a rise from commercial up, and not before', () => {
    const base = strong('rise-record');
    const toCatalogue = shot(
      base,
      60,
      { tier: 'test' },
      { tier: 'test', hits: 1, credits: 1, reputation: 0, craft: 80 },
    );
    expect(toCatalogue.out.modeling.tier).toBe('catalogue');
    expect(toCatalogue.out.records.some((row) => /Moved up/.test(row.label))).toBe(false);
    const toEditorial = shot(
      base,
      70,
      { tier: 'editorial' },
      { tier: 'commercial', credits: 12, reputation: 30 },
    );
    expect(toEditorial.out.records).toContainEqual({
      category: 'career',
      label: 'Moved up to runway and editorial',
    });
  });

  it('records the first job, once', () => {
    const base = strong('first-job');
    const first = shot(base, 60, {}, { credits: 0, tier: 'test' });
    expect(first.out.records).toContainEqual({
      category: 'career',
      label: 'Booked a first modeling job: Calloway Outfitters',
    });
    const second = shot(base, 60, {}, { credits: 1 });
    expect(second.out.records.some((row) => /first modeling job/.test(row.label))).toBe(false);
  });

  it('remembers the best rung reached', () => {
    const base = strong('best');
    const rose = shot(
      base,
      70,
      { tier: 'commercial' },
      { tier: 'catalogue', credits: 12, reputation: 20 },
    );
    expect(rose.out.modeling.best).toBe('commercial');
    const kept = shot(base, 60, {}, { tier: 'catalogue', best: 'editorial' });
    expect(kept.out.modeling.best).toBe('editorial');
    const none = yearOf(known(base, { tier: 'test', credits: 0 }));
    expect('best' in none.modeling).toBe(false);
  });
});

describe('a year with no work', () => {
  const idleYear = (patch: Partial<ModelingState>) =>
    yearOf(known(adult('idle'), { followers: 0, ...patch }));

  it('is a year more idle for somebody who has worked, and costs two points of name', () => {
    const out = idleYear({ idle: 0, reputation: 20 });
    expect(out.modeling.idle).toBe(1);
    expect(out.modeling.reputation).toBe(18);
    expect(out.pay).toBe(0);
    expect(out.mood).toBe(0);
  });

  it('never takes a name below nothing', () => {
    expect(idleYear({ idle: 0, reputation: 1 }).modeling.reputation).toBe(0);
    expect(idleYear({ idle: 0, reputation: 0 }).modeling.reputation).toBe(0);
  });

  it('is not idle for somebody who has never worked: they have not fallen from anywhere', () => {
    const out = idleYear({ idle: 0, credits: 0, tier: 'test', reputation: 10 });
    expect(out.modeling.idle).toBe(0);
    expect(out.modeling.reputation).toBe(10);
  });

  it('starts over with a job', () => {
    const { out } = shot(adult('idle-over'), 45, {}, { idle: 2 });
    expect(out.modeling.idle).toBe(0);
  });

  it('slides a rung after three years and starts the count at one, with a line', () => {
    const out = idleYear({ idle: 2, tier: 'commercial', hits: 2 });
    expect(out.modeling.tier).toBe('catalogue');
    expect(out.modeling.idle).toBe(1);
    expect(out.modeling.hits).toBe(0);
    const line = lineOf(out.lines, /dried up/)!;
    expect(line.text).toBe('The work dried up. You’re back to catalogue and e-commerce.');
    expect(line.kind).toBe('passive');
  });

  it('does not slide at two years, or below the first rung', () => {
    const two = idleYear({ idle: 1, tier: 'commercial', hits: 1 });
    expect(two.modeling.tier).toBe('commercial');
    expect(two.modeling.hits).toBe(1);
    expect(lineOf(two.lines, /dried up/)).toBeUndefined();
    const floor = idleYear({ idle: 5, tier: 'test' });
    expect(floor.modeling.tier).toBe('test');
    expect(floor.modeling.idle).toBe(6);
    expect(lineOf(floor.lines, /dried up/)).toBeUndefined();
  });

  it('holds fame at half after a year and at nothing after three', () => {
    const one = idleYear({ idle: 0, tier: 'campaign', reputation: 40 });
    expect(one.fame).toBe(
      modelFameOf({ tier: 'campaign', reputation: one.modeling.reputation, awards: 0, idle: 1 }),
    );
    expect(one.fame).toBeGreaterThan(0);
    const gone = idleYear({ idle: 2, tier: 'campaign', reputation: 40 });
    expect(gone.modeling.tier).toBe('editorial');
    expect(gone.fame).toBe(
      modelFameOf({ tier: 'editorial', reputation: gone.modeling.reputation, awards: 0, idle: 1 }),
    );
  });

  it('keeps the best rung it reached', () => {
    const out = idleYear({ idle: 2, tier: 'commercial', best: 'commercial' });
    expect(out.modeling.best).toBe('commercial');
    expect(out.modeling.tier).toBe('catalogue');
  });

  it('is no longer a living, once the year before it was not', () => {
    const out = idleYear({ lastPay: 80_000, idle: 0 });
    expect(out.modeling.lastPay).toBe(0);
    expect(isModelingFullTime(out.modeling)).toBe(false);
  });
});

describe('an award', () => {
  const winning = (tier: ModelTier, placement: BookedJob['placement'] = 'face') =>
    firstYear(2100, (year) => {
      const base = { ...strong('award'), world: { ...strong('award').world, year: year - 1 } };
      const row = booked({ tier, placement });
      const draw = modelUnit(seedOf(base), genOf(base), 'award', year, 0, row.id);
      return { base, row, year, draw };
    });

  /** A year in which the award draw comes up (or doesn't) for a job at the rung. */
  const yearWith = (tier: ModelTier, placement: BookedJob['placement'], want: boolean) =>
    firstYear(2100, (year) => {
      const base = { ...strong('award'), world: { ...strong('award').world, year: year - 1 } };
      const row = booked({ tier, placement });
      const draw = modelUnit(seedOf(base), genOf(base), 'award', year, 0, row.id);
      const chance = MODEL_AWARD_CHANCE[tier];
      if (draw < chance !== want) return undefined;
      const state = known(base, {
        tier,
        craft: craftFor(base, year, row.id, 95),
        booked: [row],
        reputation: 40,
      });
      return { state, out: yearOf(state), row };
    });

  it('is won by a performance of eighty-two or better and a lucky draw, from the editorial rung up', () => {
    expect(winning).toBeDefined();
    const { out } = yearWith('editorial', 'face', true);
    expect(out.modeling.awards).toBe(1);
    const line = lineOf(out.lines, /Won/)!;
    expect(line.kind).toBe('milestone');
    expect(line.text).toBe(
      'Won Model of the Year at the Atelier Awards for the work with Calloway Outfitters.',
    );
    expect(
      out.records.some(
        (row) =>
          row.category === 'award' &&
          /^Model of the Year, the Atelier Awards, \d{4}$/.test(row.label),
      ),
    ).toBe(true);
  });

  it('adds eight to a name and six to the spirits, on top of the job’s hit', () => {
    const won = yearWith('editorial', 'face', true);
    const lost = yearWith('editorial', 'face', false);
    expect(won.out.mood - lost.out.mood).toBe(MODEL_AWARD_MOOD);
    expect(won.out.modeling.reputation - lost.out.modeling.reputation).toBe(MODEL_AWARD_REPUTATION);
    expect(won.out.modeling.awards - lost.out.modeling.awards).toBe(1);
    expect(lineOf(lost.out.lines, /Won/)).toBeUndefined();
    expect(lost.out.records.some((row) => row.category === 'award')).toBe(false);
  });

  it('is named for the placement: the face of it, a featured spot or the group', () => {
    expect(lineOf(yearWith('campaign', 'featured', true).out.lines, /Won/)!.text).toContain(
      'Best Runway Presence',
    );
    expect(lineOf(yearWith('campaign', 'group', true).out.lines, /Won/)!.text).toContain(
      'Breakout Model of the Year',
    );
    expect(lineOf(yearWith('campaign', 'face', true).out.lines, /Won/)!.text).toContain(
      'Model of the Year',
    );
  });

  it('is not given below the editorial rung, whatever the performance', () => {
    for (const tier of ['test', 'catalogue', 'commercial'] as const) {
      const out = shot(strong('award-low'), 99, { tier }, { tier }).out;
      expect(out.modeling.awards, tier).toBe(0);
    }
  });

  it('is not given for a performance under eighty-two, however the draw falls', () => {
    const miss = firstYear(2100, (year) => {
      const base = { ...strong('award'), world: { ...strong('award').world, year: year - 1 } };
      const row = booked({ tier: 'editorial', placement: 'face' });
      const draw = modelUnit(seedOf(base), genOf(base), 'award', year, 0, row.id);
      if (draw >= MODEL_AWARD_CHANCE.editorial) return undefined;
      const state = known(base, {
        tier: 'editorial',
        craft: craftFor(base, year, row.id, MODEL_AWARD_LINE - 1e-6),
        booked: [row],
      });
      return yearOf(state);
    });
    expect(miss.modeling.awards).toBe(0);
    const hit = firstYear(2100, (year) => {
      const base = { ...strong('award'), world: { ...strong('award').world, year: year - 1 } };
      const row = booked({ tier: 'editorial', placement: 'face' });
      const draw = modelUnit(seedOf(base), genOf(base), 'award', year, 0, row.id);
      if (draw >= MODEL_AWARD_CHANCE.editorial) return undefined;
      const state = known(base, {
        tier: 'editorial',
        craft: craftFor(base, year, row.id, MODEL_AWARD_LINE + 1e-6),
        booked: [row],
      });
      return yearOf(state);
    });
    expect(hit.modeling.awards).toBe(1);
  });

  it('is a draw against the rung’s chance, each job on its own', () => {
    // Two jobs in the year are drawn separately: index 0 and 1.
    const base = strong('award-two');
    let both = 0;
    let one = 0;
    for (let year = base.world.year + 1; year < base.world.year + 400; year += 1) {
      const before = { ...base, world: { ...base.world, year: year - 1 } };
      const rows = [
        booked({ id: '25:0', tier: 'campaign' }),
        booked({ id: '25:1', tier: 'campaign' }),
      ];
      const state = known(before, { tier: 'campaign', craft: 99, booked: rows });
      const wins = yearOf(state).modeling.awards;
      if (wins === 2) both += 1;
      if (wins === 1) one += 1;
    }
    expect(both).toBeGreaterThan(0);
    expect(one).toBeGreaterThan(both);
  });
});

describe('brand deals paid', () => {
  it('are paid in the year that follows the answer, in full for a model with no agency', () => {
    const base = adult('brand-pay');
    const out = yearOf(known(base, { brandOwed: 12_000, brandAnswered: ['sp:2040:modeling:0'] }));
    expect(out.brandPay).toBe(12_000);
    expect(out.pay).toBe(12_000);
    expect(out.agencyShare).toBe(0);
    expect(out.modeling.brandOwed).toBe(0);
    expect(out.modeling.brandAnswered).toEqual([]);
    expect(out.modeling.lastPay).toBe(12_000);
    expect(lineOf(out.lines, /brand deals/)!.text).toBe('The brand deals paid $12,000.');
  });

  it('gives a fifth to the agency', () => {
    const out = yearOf(known(adult('brand-pay'), { brandOwed: 12_000, agency: { since: 20 } }));
    expect(out.agencyShare).toBe(2_400);
    expect(out.brandPay).toBe(9_600);
    expect(out.pay).toBe(9_600);
    expect(lineOf(out.lines, /brand deals/)!.text).toBe(
      'The brand deals paid $9,600, after the agency’s $2,400.',
    );
  });

  it('adds to the jobs’ pay and the agency’s share on both', () => {
    const { out } = shot(
      adult('brand-two'),
      60,
      { rate: 1_000, days: 10, usage: 0 },
      { brandOwed: 5_000, agency: { since: 20 } },
    );
    expect(out.agencyShare).toBe(2_000 + 1_000);
    expect(out.brandPay).toBe(4_000);
    expect(out.pay).toBe(8_000 + 4_000);
  });

  it('are nothing, and no line, when nothing was agreed', () => {
    const out = yearOf(known(adult('brand-none')));
    expect(out.brandPay).toBe(0);
    expect(lineOf(out.lines, /brand deals/)).toBeUndefined();
  });

  it('are paid even in a year with no work, and keep the model out of idle’s reach on money', () => {
    const out = yearOf(known(adult('brand-idle'), { brandOwed: 40_000 }));
    expect(out.pay).toBe(40_000);
    expect(out.modeling.idle).toBe(1);
  });
});

describe('a portfolio paid for', () => {
  const shotAt = (
    age: number,
    housing: 'ownPlace' | 'withFamily',
    portfolioAge: number | undefined,
  ) => {
    const base = adult('fee', 30);
    const state = known(atAge(base, age), { portfolioAge });
    return yearOf({ ...state, household: { ...state.household, housing } });
  };

  it('is the adult’s bill when it was shot in the year just ended', () => {
    const out = shotAt(30, 'ownPlace', 30);
    expect(out.fees).toBe(900);
    expect(out.feeSource).toBe('Portfolio photos');
  });

  it('is not billed twice: only the year it was shot in', () => {
    expect(shotAt(30, 'ownPlace', 29).fees).toBe(0);
    expect(shotAt(30, 'ownPlace', 31).fees).toBe(0);
    expect(shotAt(30, 'ownPlace', undefined).fees).toBe(0);
  });

  it('is nobody’s bill when somebody else pays: a child, or a household that keeps them', () => {
    expect(shotAt(17, 'ownPlace', 17).fees).toBe(0);
    expect(shotAt(30, 'withFamily', 30).fees).toBe(0);
    expect(shotAt(18, 'ownPlace', 18).fees).toBe(900);
  });
});

describe('offers raised for the year to come', () => {
  const asked = (base: GameState, patch: Partial<ModelingState> = {}) =>
    yearOf(known(base, { tier: 'commercial', credits: 30, reputation: 60, craft: 70, ...patch }));
  const many = (patch: Partial<ModelingState> = {}) => {
    // Across a run of lives and years, so the odds show.
    const runs = [] as ReturnType<typeof asked>[];
    for (let index = 0; index < 20; index += 1) runs.push(asked(adult(`raise-${index}`), patch));
    return runs;
  };

  it('are none for somebody nobody has seen', () => {
    expect(
      many({ seenAge: undefined, craft: 70 }).every((out) => out.modeling.offers.length === 0),
    ).toBe(true);
  });

  it('are none once the bookers have forgotten: four years since', () => {
    const base = adult('raise-old');
    const stale = yearOf(known(base, { seenAge: base.player.age - 4 }));
    expect(stale.modeling.offers).toEqual([]);
    const fresh = many({}).flatMap((out) => out.modeling.offers);
    expect(fresh.length).toBeGreaterThan(5);
  });

  it('are some for somebody who has been seen: new, asked, and for the year to come', () => {
    const out = many({}).flatMap((row) => row.modeling.offers);
    expect(out.length).toBeGreaterThan(10);
    for (const row of out) {
      expect(row.source).toBe('asked');
      expect(row.age).toBe(27);
      expect(row.id).toMatch(/^27:[0-3]$/);
      expect(MODEL_TIERS).toContain(row.tier);
      expect(Math.abs(modelTierRank(row.tier) - modelTierRank('commercial'))).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it('are a line, once, that says how many', () => {
    const lines = many({}).flatMap((row) =>
      row.lines
        .filter((line) => /noticed you/.test(line.text))
        .map((line) => ({ line, count: row.modeling.offers.length })),
    );
    expect(lines.length).toBeGreaterThan(5);
    for (const { line, count } of lines) {
      expect(line.kind).toBe('passive');
      if (count === 1)
        expect(line.text).toMatch(/^A booker has noticed you\. There’s .* on the table\.$/);
      else
        expect(line.text).toBe(`Bookers have noticed you. There are ${count} jobs on the table.`);
    }
    expect(lines.some(({ count }) => count === 1)).toBe(true);
    expect(lines.some(({ count }) => count > 1)).toBe(true);
  });

  it('never put more than four on the table, counting those still waiting', () => {
    const base = known(adult('raise-cap'), {
      tier: 'commercial',
      credits: 30,
      reputation: 100,
      craft: 70,
      agency: { since: 20 },
    });
    for (let age = 20; age < 40; age += 1) {
      const out = yearOf(atAge(base, age - 1));
      expect(out.modeling.offers.length).toBeLessThanOrEqual(MODEL_MAX_OFFERS);
    }
    const waiting = [job({ id: '1' }), job({ id: '2' }), job({ id: '3' }), job({ id: '4' })];
    const full = yearOf(
      known(adult('raise-cap'), {
        tier: 'commercial',
        credits: 30,
        reputation: 100,
        craft: 70,
        offers: waiting,
      }),
    );
    expect(full.modeling.offers).toEqual(waiting);
    expect(lineOf(full.lines, /noticed you/)).toBeUndefined();
    const one = yearOf(
      known(adult('raise-cap'), {
        tier: 'commercial',
        credits: 30,
        reputation: 100,
        craft: 70,
        offers: waiting.slice(0, 3),
      }),
    );
    expect(one.modeling.offers.length).toBeLessThanOrEqual(4);
    expect(one.modeling.offers.slice(0, 3)).toEqual(waiting.slice(0, 3));
  });

  it('keep what was waiting, and add to it', () => {
    const waiting = [job({ id: 'old', client: 'Tern Footwear' })];
    const outs = many({ offers: waiting });
    expect(outs.every((out) => out.modeling.offers[0]!.id === 'old')).toBe(true);
    expect(outs.some((out) => out.modeling.offers.length > 1)).toBe(true);
  });

  it('never take more days than the year has left', () => {
    const base = known(adult('raise-days'), {
      tier: 'commercial',
      credits: 30,
      reputation: 100,
      craft: 70,
      agency: { since: 20 },
      offers: [job({ id: 'w', days: 140 })],
    });
    for (let age = 20; age < 60; age += 1) {
      const out = yearOf(atAge(base, age - 1));
      const days = out.modeling.offers.reduce((sum, row) => sum + row.days, 0);
      expect(days).toBeLessThanOrEqual(150);
    }
  });

  it('use a client the model hasn’t got on the table or on the books already', () => {
    for (let index = 0; index < 20; index += 1) {
      const out = asked(adult(`raise-clients-${index}`), { agency: { since: 20 }, booked: [] });
      const clients = out.modeling.offers.map((row) => row.client);
      expect(new Set(clients).size).toBe(clients.length);
    }
  });

  it('come with a pay that follows the table, scaled for how well the name is known', () => {
    const rows = many({ reputation: 100, tier: 'campaign', credits: 40, craft: 90 }).flatMap(
      (out) => out.modeling.offers,
    );
    expect(rows.length).toBeGreaterThan(8);
    for (const row of rows) {
      const { rate, days } = MODEL_TIER_ROWS[row.tier];
      expect(row.days).toBeGreaterThanOrEqual(1);
      expect(row.days).toBeLessThanOrEqual(days[1]);
      expect(row.rate).toBeLessThanOrEqual(Math.max(rate[1] * 1.15 * 1.05, 250));
      expect(row.usage).toBe(modelUsageFee(row.tier, row.rate, row.days));
      expect(MODEL_CLIENTS[row.tier]).toContain(row.client);
      expect(MODEL_TIER_ROWS[row.tier].mediums).toContain(row.medium);
    }
  });

  it('are fewer for a model who is older', () => {
    const count = (age: number) => {
      let total = 0;
      for (let index = 0; index < 25; index += 1) {
        const base = atAge(adult(`raise-age-${index}`), age - 1);
        total += yearOf(
          known(base, { tier: 'catalogue', credits: 10, reputation: 50, craft: 55 }),
          age,
        ).modeling.offers.length;
      }
      return total;
    };
    expect(count(24)).toBeGreaterThan(count(34));
    expect(count(34)).toBeGreaterThan(count(60));
  });

  it('are more for a model with an agency', () => {
    const count = (agency: boolean) => {
      let total = 0;
      for (let index = 0; index < 25; index += 1) {
        total += yearOf(
          known(adult(`raise-agency-${index}`), {
            tier: 'catalogue',
            credits: 10,
            reputation: 50,
            craft: 55,
            ...(agency ? { agency: { since: 20 } } : {}),
          }),
        ).modeling.offers.length;
      }
      return total;
    };
    expect(count(true)).toBeGreaterThan(count(false));
  });

  it('are none before fourteen', () => {
    const base = atAge(known(adult('raise-young'), { craft: 60 }), 11);
    expect(yearOf(base, 13, base.world.year + 1).modeling.offers).toEqual([]);
    expect(yearOf(base, 14, base.world.year + 1).modeling.offers.length).toBeGreaterThanOrEqual(0);
  });
});

describe('what a year does to craft', () => {
  const m = (patch: Partial<ModelingState> = {}): ModelingState => ({
    ...EMPTY_MODELING,
    craft: 40,
    ...patch,
  });
  const target = (state: GameState, credits: number) =>
    naturalModelCraft(state.player.stats) +
    Math.min(MODEL_CREDIT_CRAFT_CAP, credits * MODEL_CREDIT_CRAFT);

  it('pulls up by a third toward what the character is and what work adds, rounded', () => {
    const base = withStats(adult('craft-up'), {
      looks: 90,
      charisma: 90,
      discipline: 90,
      smarts: 90,
    });
    const want = target(base, 10);
    expect(nextModelCraft(base, m({ credits: 10 }), 40)).toBe(Math.round(40 + (want - 40) * 0.35));
  });

  it('eases down by a tenth when the character is under their craft', () => {
    const base = withStats(adult('craft-down'), {
      looks: 40,
      charisma: 40,
      discipline: 40,
      smarts: 40,
    });
    const want = target(base, 10);
    expect(want).toBeLessThan(80);
    expect(nextModelCraft(base, m({ credits: 10 }), 80)).toBe(Math.round(80 + (want - 80) * 0.1));
  });

  it('adds three tenths of a point for each job worked, up to six', () => {
    const base = withStats(adult('craft-credits'), {
      looks: 70,
      charisma: 70,
      discipline: 70,
      smarts: 70,
    });
    const at = (credits: number) => nextModelCraft(base, m({ credits }), 0);
    expect(at(40)).toBeGreaterThan(at(0));
    expect(at(20)).toBe(at(100));
    expect(at(20)).toBe(Math.round(0 + (target(base, 20) - 0) * 0.35));
    expect(target(base, 20) - target(base, 0)).toBe(6);
    expect(target(base, 10) - target(base, 0)).toBe(3);
  });

  it('is never past what the character plus a cap of work can reach', () => {
    const base = withStats(adult('craft-cap'), {
      looks: 60,
      charisma: 60,
      discipline: 60,
      smarts: 60,
    });
    let craft = 0;
    for (let year = 0; year < 80; year += 1)
      craft = nextModelCraft(base, m({ credits: 200 }), craft);
    expect(craft).toBeLessThanOrEqual(modelCraftCeiling(base));
    // Rounding to a whole number stalls it a point or two short of the target, never past it.
    expect(craft).toBeLessThanOrEqual(target(base, 200));
    expect(craft).toBeGreaterThanOrEqual(target(base, 200) - 2);
  });

  it('stays between nothing and a hundred', () => {
    const top = withStats(adult('craft-top'), {
      looks: 100,
      charisma: 100,
      discipline: 100,
      smarts: 100,
    });
    expect(nextModelCraft(top, m({ credits: 200 }), 100)).toBe(100);
    const low = withStats(adult('craft-low'), { looks: 0, charisma: 0, discipline: 0, smarts: 0 });
    expect(nextModelCraft(low, m({ credits: 0 }), 0)).toBe(0);
  });

  it('follows a look that fades: a character who has lost their looks loses craft, slowly', () => {
    const base = adult('craft-fade');
    const young = withStats(base, { looks: 75 });
    const older = withStats(base, { looks: 45 });
    let a = 70;
    let b = 70;
    for (let year = 0; year < 5; year += 1) {
      a = nextModelCraft(young, m({ credits: 20 }), a);
      b = nextModelCraft(older, m({ credits: 20 }), b);
    }
    expect(b).toBeLessThan(a);
  });

  it('is carried into the year’s output and kept', () => {
    const out = shot(adult('craft-out'), 60).out;
    expect(out.modeling.craft).toBe(
      nextModelCraft(
        adult('craft-out'),
        { ...out.modeling, credits: 13 },
        craftFor(adult('craft-out'), adult('craft-out').world.year + 1, '25:0', 60),
      ),
    );
  });
});

describe('fame, mood and the rest of the year’s output', () => {
  it('is held at the rung the model ends the year on', () => {
    const { out } = shot(
      strong('out-fame'),
      70,
      { tier: 'commercial' },
      { tier: 'catalogue', credits: 12, reputation: 20 },
    );
    expect(out.modeling.tier).toBe('commercial');
    expect(out.fame).toBe(
      modelFameOf({
        tier: 'commercial',
        reputation: out.modeling.reputation,
        awards: out.modeling.awards,
        idle: 0,
      }),
    );
  });

  it('is nothing for the first rung', () => {
    const { out } = shot(
      adult('out-fame-test'),
      60,
      { tier: 'test' },
      { tier: 'test', credits: 0 },
    );
    expect(out.fame).toBe(0);
  });

  it('is the same for the same year every time it is run', () => {
    const state = known(adult('out-det'), { booked: [booked()], brandOwed: 500 });
    expect(yearOf(state)).toEqual(yearOf(state));
  });
});

/* -------------------------------------------------------------------------- */
/* Brand deals                                                                 */
/* -------------------------------------------------------------------------- */

describe('brand deals', () => {
  /** A model with a following big enough for brands and the year in which one of them calls. */
  const withBrands = (prefix: string, patch: Partial<ModelingState> = {}) =>
    firstSeed(prefix, (seed) => {
      const state = known(adult(seed), { followers: 20_000, peak: 20_000, ...patch });
      return modelBrandOffers(state).length > 0 ? state : undefined;
    });

  it('go through the creators’ sponsor rules, with the model as a photo feed about fashion', () => {
    const channel = modelChannel(
      known(adult('brand-channel'), { followers: 7_000, peak: 9_000, brandAnswered: ['x'] })
        .modeling,
    );
    expect(channel.platformId).toBe('photo');
    expect(channel.categoryId).toBe('fashion');
    expect(MODEL_BRAND_PLATFORM).toBe('photo');
    expect(MODEL_BRAND_CATEGORY).toBe('fashion');
    expect(channel.audience).toBe(7_000);
    expect(channel.peak).toBe(9_000);
    expect(channel.answered).toEqual(['x']);
    expect(channel.id).toBe('modeling');
  });

  it('are exactly the sponsor offers for that channel, from the fashion brands', () => {
    const state = withBrands('brand-offers');
    const offers = modelBrandOffers(state);
    expect(offers).toEqual(
      sponsorOffersFor({
        seed: seedOf(state),
        year: state.world.year,
        channel: modelChannel(state.modeling),
        agent: false,
      }),
    );
    expect(offers.length).toBeLessThanOrEqual(MAX_SPONSOR_OFFERS);
    for (const offer of offers) {
      expect(SPONSOR_BRANDS.fashion).toContain(offer.brand);
      expect(offer.id).toBe(`sp:${state.world.year}:modeling:${offer.id.split(':')[3]}`);
    }
  });

  it('wait for a model who has worked at least once, and a following the brands can see', () => {
    const state = withBrands('brand-gate');
    expect(modelBrandOffers(withModeling(state, { credits: 0 }))).toEqual([]);
    expect(modelBrandOffers(withModeling(state, { followers: 0, peak: 0 }))).toEqual([]);
    expect(modelBrandOffers(adult('brand-gate-empty'))).toEqual([]);
  });

  it('come more often, and pay more, with an agency behind the model', () => {
    const plain = withBrands('brand-agent');
    const agent = withModeling(plain, { agency: { since: 20 } });
    const seed = seedOf(plain);
    const asPlain = sponsorOffersFor({
      seed,
      year: plain.world.year,
      channel: modelChannel(plain.modeling),
    });
    const asAgent = sponsorOffersFor({
      seed,
      year: plain.world.year,
      channel: modelChannel(plain.modeling),
      agent: true,
    });
    expect(modelBrandOffers(agent)).toEqual(asAgent);
    expect(modelBrandOffers(plain)).toEqual(asPlain);
  });

  it('are signed for what they offered, owed until the next year, and cost a little of the following', () => {
    const state = withBrands('brand-take');
    const offer = modelBrandOffers(state)[0]!;
    const result = answerModelBrand(state, offer.id, 'accept');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state.modeling;
    expect(after.brandOwed).toBe(state.modeling.brandOwed + offer.pay);
    expect(after.brandAnswered).toEqual([offer.id]);
    expect(after.followers).toBe(Math.round(state.modeling.followers * (1 - 0.015)));
    expect(result.value.entry.text).toBe(
      `Signed a brand deal with ${offer.brand}, for ${money(offer.pay)}.`,
    );
    expect(result.value.entry.id).toBe(`t:${state.world.year}:modeling:brand:${offer.id}`);
    expect(result.value.entry.kind).toBe('passive');
    expect(result.value.state.player.timeline.at(-1)).toEqual(result.value.entry);
    expect(modelBrandOffers(result.value.state).map((row) => row.id)).not.toContain(offer.id);
  });

  it('are asked for more: a lucky ask comes up by sixty percent, an unlucky one walks away', () => {
    const lucky = firstSeed('brand-more-lucky', (seed) => {
      const state = known(adult(seed), { followers: 20_000, peak: 20_000 });
      const offer = modelBrandOffers(state)[0];
      return offer && mixedUnit(`${seedOf(state)}:sponsor-more:${offer.id}`) < MORE_CHANCE
        ? state
        : undefined;
    });
    const offer = modelBrandOffers(lucky)[0]!;
    const raised = answerModelBrand(lucky, offer.id, 'more');
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;
    const pay = Math.round(offer.pay * (1 + MORE_RAISE));
    expect(raised.value.state.modeling.brandOwed).toBe(pay);
    expect(raised.value.entry.text).toBe(
      `You asked ${offer.brand} for more and they came up to ${money(pay)}.`,
    );
    expect(raised.value.state.modeling.followers).toBe(Math.round(20_000 * (1 - 0.015)));

    const unlucky = firstSeed('brand-more-unlucky', (seed) => {
      const state = known(adult(seed), { followers: 20_000, peak: 20_000 });
      const row = modelBrandOffers(state)[0];
      return row && mixedUnit(`${seedOf(state)}:sponsor-more:${row.id}`) >= MORE_CHANCE
        ? state
        : undefined;
    });
    const gone = modelBrandOffers(unlucky)[0]!;
    const walked = answerModelBrand(unlucky, gone.id, 'more');
    expect(walked.ok).toBe(true);
    if (!walked.ok) return;
    expect(walked.value.state.modeling.brandOwed).toBe(unlucky.modeling.brandOwed);
    expect(walked.value.state.modeling.followers).toBe(20_000);
    expect(walked.value.state.modeling.brandAnswered).toEqual([gone.id]);
    expect(walked.value.entry.text).toBe(`You asked ${gone.brand} for more and they walked away.`);
  });

  it('are turned down at no cost', () => {
    const state = withBrands('brand-pass');
    const offer = modelBrandOffers(state)[0]!;
    const result = answerModelBrand(state, offer.id, 'decline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.modeling.brandOwed).toBe(state.modeling.brandOwed);
    expect(result.value.state.modeling.followers).toBe(state.modeling.followers);
    expect(result.value.entry.text).toBe(`Turned down ${offer.brand}.`);
  });

  it('add to what is already owed', () => {
    const state = withBrands('brand-owed', { brandOwed: 3_000 });
    const offer = modelBrandOffers(state)[0]!;
    const result = answerModelBrand(state, offer.id, 'accept');
    if (!result.ok) throw new Error('expected a deal');
    expect(result.value.state.modeling.brandOwed).toBe(3_000 + offer.pay);
  });

  it('cannot be answered twice, or when no brand asked', () => {
    const state = withBrands('brand-twice');
    const offer = modelBrandOffers(state)[0]!;
    expect(answerModelBrand(state, 'sp:1:modeling:9', 'accept')).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
    const once = answerModelBrand(state, offer.id, 'decline');
    if (!once.ok) throw new Error('expected an answer');
    expect(answerModelBrand(once.value.state, offer.id, 'accept')).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
  });
});

describe('the work brings people to a channel', () => {
  const channel = (categoryId: string, audience = 1_000) => ({
    id: `ch:${categoryId}`,
    platformId: 'photo',
    categoryId,
    name: categoryId,
    since: 0,
    audience,
    peak: audience,
    effort: 'regular' as const,
    luck: 0,
    earned: dollars(0),
  });

  it('gives a fashion or lifestyle channel a quarter of the people who found the model', () => {
    expect(MODEL_CHANNEL_CATEGORIES).toEqual(['fashion', 'lifestyle']);
    const out = withModelAudience(
      [channel('fashion'), channel('lifestyle'), channel('music')],
      1_000,
    );
    expect(out[0]!.audience).toBe(1_000 + Math.round(1_000 * MODEL_CHANNEL_SHARE));
    expect(out[0]!.peak).toBe(out[0]!.audience);
    expect(out[1]!.audience).toBe(1_250);
    expect(out[2]!.audience).toBe(1_000);
  });

  it('keeps a higher peak', () => {
    const high = { ...channel('fashion'), peak: 9_000 };
    expect(withModelAudience([high], 400)[0]!.peak).toBe(9_000);
  });

  it('is the same channels, untouched, when nobody new came', () => {
    const channels = [channel('fashion')];
    expect(withModelAudience(channels, 0)).toBe(channels);
    expect(withModelAudience(channels, 1)).toBe(channels);
  });
});

/* -------------------------------------------------------------------------- */
/* The people backstage                                                        */
/* -------------------------------------------------------------------------- */

describe('the people backstage', () => {
  const none = { hub: 1, wealth: 1, fame: 1, channel: false, business: false, modeling: false };

  it('are known to a model who has worked enough, and not once the work has dried up', () => {
    const base = adult('network');
    expect(MODEL_NETWORK_CREDITS).toBe(6);
    expect(pullsOf(withModeling(base, { credits: 5 })).modeling).toBe(false);
    expect(pullsOf(withModeling(base, { credits: 6 })).modeling).toBe(true);
    expect(pullsOf(withModeling(base, { credits: 6, idle: 2 })).modeling).toBe(true);
    expect(pullsOf(withModeling(base, { credits: 6, idle: MODEL_IDLE_FALL_YEARS })).modeling).toBe(
      false,
    );
    expect(pullsOf(base).modeling).toBe(false);
  });

  it('make a meeting a quarter more likely, like the other networks', () => {
    expect(encounterMultiplier({ ...none, modeling: true })).toBeCloseTo(1.25, 10);
    expect(encounterMultiplier({ ...none, modeling: true, channel: true })).toBeCloseTo(1.5, 10);
    expect(
      encounterMultiplier({ ...none, modeling: true, channel: true, business: true }),
    ).toBeCloseTo(1.75, 10);
  });

  it('are met more often by a model who has worked', () => {
    const base = adult('network-chance');
    expect(encounterChance(withModeling(base, { credits: 6 }))).toBeGreaterThan(
      encounterChance(base),
    );
  });

  it('bring actors and musicians closer, and nobody else', () => {
    const pulled = { ...none, modeling: true };
    expect(fieldPull('acting', pulled)).toBe(2.5);
    expect(fieldPull('music', pulled)).toBe(2.5);
    expect(fieldPull('acting', none)).toBe(1);
    expect(fieldPull('creator', pulled)).toBe(1);
    expect(fieldPull('business', pulled)).toBe(1);
    expect(fieldPull('sailing', pulled)).toBe(1);
  });

  it('are the reason for the meeting when they are the biggest push', () => {
    expect(sceneFor('acting', { ...none, modeling: true })).toBe('modeling');
    expect(sceneFor('music', { ...none, modeling: true })).toBe('modeling');
    expect(sceneFor('acting', none)).toBe('chance');
    expect(sceneFor('creator', { ...none, modeling: true })).toBe('chance');
    expect(sceneFor('business', { ...none, modeling: true })).toBe('chance');
  });

  it('are described in two lines that name the person and what they do', () => {
    const lines = CELEBRITY_LINES['scene:modeling'];
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain('{name}');
      expect(line).toContain('{role}');
    }
    expect(findCelebrityField('acting')!.network).toBe('modeling');
    expect(findCelebrityField('music')!.network).toBe('modeling');
  });
});

const withMusic = (state: GameState, patch: Partial<MusicState>): GameState => ({
  ...state,
  music: { ...state.music, ...patch },
});

const musicDeal = (): LabelDeal => ({
  kind: 'indie',
  label: 'Porchlight Records',
  advance: 400_000,
  royalty: 0.4,
  left: 3,
  since: 25,
  owed: 0,
  paid: false,
});

const actingRole = (): BookedRole => ({
  id: 'b:0',
  tier: 'local',
  billing: 'lead',
  medium: 'a student film',
  title: 'Paper Boats',
  fee: 30_000,
  days: 6,
  age: 26,
  bookedAge: 26,
});

/* -------------------------------------------------------------------------- */
/* Through the game                                                            */
/* -------------------------------------------------------------------------- */

describe('what a model’s year does to the rest of the life', () => {
  const working = (patch: Partial<BookedJob> = {}, extra: Partial<ModelingState> = {}) => {
    const base = adult('wired');
    return {
      ...windfall(
        known(base, {
          craft: 80,
          booked: [booked({ rate: 2_000, days: 10, usage: 0, ...patch })],
          ...extra,
        }),
        20_000,
      ),
      household: { ...base.household, standard: 30_000 },
    };
  };

  it('puts what the job paid in the ledger as work, and the tax beside it', () => {
    const next = advanceYear(answerOthers(working())).state;
    const year = next.world.year;
    const pay = next.finance.transactions.find(
      (row) => row.year === year && row.source === 'Modeling work',
    );
    expect(pay?.category).toBe('salary');
    expect(Number(pay?.amount)).toBe(2_000 * 10 * 100);
    const wage =
      (Number(totalFor(next.finance, 'salary', year)) - 20_000 * 0 - Number(pay!.amount)) / 100;
    const tax = next.finance.transactions.find(
      (row) => row.year === year && row.source === 'Tax on modeling pay',
    );
    expect(tax?.category).toBe('tax');
    expect(-Number(tax!.amount) / 100).toBe(businessTaxOn(wage, 20_000));
    expect(next.modeling.lastPay).toBe(20_000);
  });

  it('writes nothing in the ledger for a year of no work', () => {
    const next = advanceYear(answerOthers(working({}, { booked: [] }))).state;
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    expect(rows.some((row) => row.source === 'Modeling work')).toBe(false);
    expect(rows.some((row) => row.source === 'Tax on modeling pay')).toBe(false);
  });

  it('lets a big modeling income raise the household’s standard of living', () => {
    const big = advanceYear(answerOthers(working({ rate: 20_000, days: 10 }))).state;
    const small = advanceYear(answerOthers(working({}, { booked: [] }))).state;
    expect(big.household.standard).toBeGreaterThan(small.household.standard);
  });

  it('is taxed over everything else earned in the year: a day job, acting and music pay all come first', () => {
    const found = firstSeed(
      'stack',
      (seed) => (adult(seed).employment.job ? adult(seed) : undefined),
      60,
    );
    const base = (job: boolean) => {
      const ready = job ? found : { ...found, employment: { ...found.employment, job: undefined } };
      return {
        ...windfall(
          withMusic(
            {
              ...ready,
              acting: { ...ready.acting, craft: 70, booked: [actingRole()] },
            },
            { craft: 70, released: { single: 2, ep: 0, lp: 0 }, deal: musicDeal() },
          ),
          20_000,
        ),
        modeling: known(ready, { craft: 80, booked: [booked({ rate: 2_000, days: 10, usage: 0 })] })
          .modeling,
        household: { ...ready.household, standard: 30_000 },
      };
    };
    const taxOf = (state: GameState) => {
      const next = advanceYear(answerOthers(state)).state;
      const year = next.world.year;
      const row = (source: string) =>
        next.finance.transactions.find((entry) => entry.year === year && entry.source === source);
      const amount = (source: string) => Number(row(source)?.amount ?? 0) / 100;
      return {
        tax: -amount('Tax on modeling pay'),
        modeling: amount('Modeling work'),
        acting: amount('Acting work'),
        music: amount('Music income'),
        salary: Number(totalFor(next.finance, 'salary', year)) / 100,
      };
    };
    const withJob = taxOf(base(true));
    const without = taxOf(base(false));
    expect(withJob.modeling).toBe(20_000);
    expect(withJob.acting).toBeGreaterThan(0);
    expect(withJob.music).toBeGreaterThan(300_000);
    const earned = (row: typeof withJob) => row.salary - row.modeling - row.acting - row.music;
    expect(withJob.tax).toBe(
      businessTaxOn(earned(withJob) + withJob.acting + withJob.music, 20_000),
    );
    expect(without.tax).toBe(
      businessTaxOn(earned(without) + without.acting + without.music, 20_000),
    );
    expect(earned(withJob)).toBeGreaterThan(earned(without));
    expect(withJob.tax).toBeGreaterThanOrEqual(without.tax);
    expect(without.tax).toBeGreaterThan(businessTaxOn(0, 20_000));
  });

  it('is taxed under a deal’s income: what a deal earned is taxed over what modeling paid', () => {
    const base = working({ rate: 40_000, days: 10 });
    const put: PrivateDeal = {
      id: 'deal:test',
      kindId: 'startup',
      name: 'Test Labs',
      put: cents(1_000_000),
      since: base.world.year - 4,
      matures: base.world.year + 1,
      multiple: 4,
      paid: cents(0),
      status: 'live',
    };
    const next = advanceYear(answerOthers({ ...base, deals: [put] })).state;
    const year = next.world.year;
    const wage =
      (Number(totalFor(next.finance, 'salary', year)) +
        Number(totalFor(next.finance, 'commission', year))) /
      100;
    const gain =
      Number(
        next.finance.transactions.find(
          (row) => row.year === year && row.source === 'Gain — Test Labs',
        )!.amount,
      ) / 100;
    const tax = next.finance.transactions.find(
      (row) => row.year === year && row.source === 'Tax on deal income',
    )!;
    expect(wage).toBeGreaterThan(400_000 * 0.9);
    expect(-Number(tax.amount) / 100).toBe(dealTaxOn(wage, gain));
    expect(dealTaxOn(wage, gain)).toBeGreaterThan(dealTaxOn(0, gain));
  });

  it('puts the portfolio in the ledger as spending, for an adult on their own', () => {
    const base = working({}, { portfolioAge: adult('wired').player.age, booked: [] });
    const own = {
      ...base,
      household: { ...base.household, housing: 'ownPlace' as const, standard: 60_000 },
    };
    const next = advanceYear(answerOthers(own)).state;
    const row = next.finance.transactions.find(
      (entry) => entry.year === next.world.year && entry.source === 'Portfolio photos',
    );
    expect(MODEL_PORTFOLIO_COST_SOURCE).toBe('portfolio photos');
    expect(row?.category).toBe('spending');
    expect(Number(row?.amount)).toBe(-MODEL_PORTFOLIO_COST * 100);
  });

  it('brings people to the Fashion channel with the work', () => {
    const opened = openChannel(windfall(adult('wired-channel'), 20_000), 'photo', 'fashion');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const base = known(opened.value, {
      craft: 80,
      booked: [booked({ rate: 3_000, days: 10, usage: 0, tier: 'commercial' })],
      tier: 'commercial',
    });
    const control = withModeling(base, { booked: [] });
    const worked = advanceYear(answerOthers(base)).state;
    const idle = advanceYear(answerOthers(control)).state;
    expect(worked.channels[0]!.audience).toBeGreaterThan(idle.channels[0]!.audience);
  });

  it('ends a day job in the year it becomes a living, with a line, and not before', () => {
    const found = firstSeed(
      'living-job',
      (seed) => {
        const base = adult(seed);
        return base.employment.job ? base : undefined;
      },
      60,
    );
    const job = found.employment.job!;
    const living = known(windfall(found, 20_000), {
      craft: 100,
      tier: 'campaign',
      reputation: 40,
      booked: [booked({ tier: 'campaign', rate: 20_000, days: 6, usage: 0 })],
    });
    const after = advanceYear(answerOthers(living)).state;
    expect(isModelingFullTime(after.modeling)).toBe(true);
    expect(after.employment.job).toBeUndefined();
    expect(
      after.employment.history.some((row) => row.jobId === job.jobId && row.because === 'resigned'),
    ).toBe(true);
    expect(after.player.timeline.some((row) => /Modeling is the living now/.test(row.text))).toBe(
      true,
    );
    expect(after.player.occupation).toBe('Model');
    expect(eulogyFor(after).identity).not.toBe(findJob(job.jobId)?.title);

    const small = known(windfall(found, 20_000), {
      craft: 60,
      booked: [booked({ rate: 500, days: 4, usage: 0 })],
    });
    const kept = advanceYear(answerOthers(small)).state;
    expect(isModelingFullTime(kept.modeling)).toBe(false);
    expect(kept.employment.job).toBeDefined();
    expect(kept.player.occupation).not.toBe('Model');
  });

  it('writes no living line for somebody with no day job to leave, and none twice', () => {
    // A life whose day job survives the year on its own, so that keeping it is down to modeling and nothing else.
    const found = firstSeed(
      'living-nojob',
      (seed) => {
        const base = adult(seed);
        if (!base.employment.job) return undefined;
        return advanceYear(answerOthers(base)).state.employment.job ? base : undefined;
      },
      60,
    );
    const shoot = {
      craft: 100,
      tier: 'campaign' as const,
      reputation: 40,
      booked: [booked({ tier: 'campaign', rate: 20_000, days: 6, usage: 0 })],
    };
    const jobless = {
      ...found,
      employment: { ...found.employment, job: undefined },
    };
    const none = advanceYear(answerOthers(known(windfall(jobless, 20_000), shoot))).state;
    expect(isModelingFullTime(none.modeling)).toBe(true);
    expect(none.player.timeline.some((row) => /living now/.test(row.text))).toBe(false);

    // Already the living, with a job somehow still held: nothing to leave again, no second line.
    const again = advanceYear(
      answerOthers(known(windfall(found, 20_000), { ...shoot, lastPay: 50_000, idle: 0 })),
    ).state;
    expect(isModelingFullTime(again.modeling)).toBe(true);
    expect(again.player.timeline.some((row) => /Modeling is the living now/.test(row.text))).toBe(
      false,
    );
    expect(again.employment.job).toBeDefined();
  });

  it('puts the year’s shoots on the timeline under the modeling id, and the living line as a milestone', () => {
    const found = firstSeed(
      'living-lines',
      (seed) => {
        const base = adult(seed);
        return base.employment.job ? base : undefined;
      },
      60,
    );
    const living = known(windfall(found, 20_000), {
      craft: 100,
      tier: 'campaign',
      reputation: 40,
      booked: [booked({ tier: 'campaign', rate: 20_000, days: 6, usage: 0 })],
    });
    const after = advanceYear(answerOthers(living)).state;
    const year = after.world.year;
    const rows = after.player.timeline.filter((row) => row.id.startsWith(`t:${year}:modeling:`));
    expect(rows[0]?.id).toBe(`t:${year}:modeling:0`);
    expect(rows[0]?.text).toMatch(/^Shot /);
    const last = rows.at(-1)!;
    expect(last.text).toBe('Modeling is the living now. That was the end of the day job.');
    expect(last.kind).toBe('milestone');
    expect(last.id).toBe(`t:${year}:modeling:${rows.length - 1}`);
  });

  it('records the first job on the life, and lets modeling fame stand as the life’s fame', () => {
    const base = known(windfall(adult('wired-record'), 20_000), {
      craft: 100,
      credits: 0,
      tier: 'campaign',
      reputation: 40,
      booked: [booked({ tier: 'campaign', rate: 20_000, days: 6, usage: 0 })],
    });
    const next = advanceYear(answerOthers(base)).state;
    expect(
      next.player.records.some(
        (row) => row.category === 'career' && /^Booked a first modeling job: /.test(row.label),
      ),
    ).toBe(true);
    expect(next.fame).toBeGreaterThan(0);
    expect(next.fame).toBe(
      modelFameOf({
        tier: next.modeling.best ?? next.modeling.tier,
        reputation: next.modeling.reputation,
        awards: next.modeling.awards,
        idle: next.modeling.idle,
      }),
    );
  });

  it('keeps a modeling state handed to a new game state', () => {
    const base = adult('wired-option');
    const supplied = { ...EMPTY_MODELING, craft: 42, credits: 3 };
    const made = createGameState(base.world, base.player, base.rng, { modeling: supplied });
    expect(made.modeling).toBe(supplied);
    expect(createGameState(base.world, base.player, base.rng).modeling).toEqual(EMPTY_MODELING);
  });

  it('dates an award with the year it was won, and draws the shoot for that year', () => {
    const won = firstYear(2100, (year) => {
      const base = {
        ...strong('wired-award'),
        world: { ...strong('wired-award').world, year: year - 1 },
      };
      const row = booked({ tier: 'editorial', placement: 'face' });
      const draw = modelUnit(seedOf(base), genOf(base), 'award', year, 0, row.id);
      if (draw >= MODEL_AWARD_CHANCE.editorial) return undefined;
      const state = windfall(
        known(base, {
          tier: 'editorial',
          craft: craftFor(base, year, row.id, 95),
          booked: [row],
          reputation: 40,
        }),
        20_000,
      );
      return { state, year };
    });
    const next = advanceYear(answerOthers(won.state)).state;
    expect(next.world.year).toBe(won.year);
    expect(next.modeling.awards).toBe(1);
    expect(
      next.player.records.some(
        (row) =>
          row.category === 'award' &&
          row.label === `Model of the Year, the Atelier Awards, ${won.year}`,
      ),
    ).toBe(true);
  });

  it('keeps job offers away from somebody whose living it is, and not from a small model', () => {
    const control = firstSeed('living-control', (seed) => {
      const probe = adult(seed);
      return withAnyOffer(probe, true) !== probe ? probe : undefined;
    });
    const living = withModeling(control, { lastPay: 50_000 });
    expect(withAnyOffer(living, true)).toEqual(living);
    const small = withModeling(control, { lastPay: 5_000 });
    expect(withAnyOffer(small, true)).not.toEqual(small);
  });

  it('leaves a life that has nothing to do with modeling exactly as it was', () => {
    const base = adult('nothing-wired');
    const next = advanceYear(answerOthers(base)).state;
    expect(next.modeling).toEqual(EMPTY_MODELING);
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    expect(
      rows.some((row) => /odeling/.test(row.source) || row.source === MODEL_PORTFOLIO_COST_SOURCE),
    ).toBe(false);
    expect(next.player.timeline.some((row) => /:modeling:/.test(row.id))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Rounding, a made job, and the edges                                         */
/* -------------------------------------------------------------------------- */

describe('how a rate and a fee are rounded', () => {
  it('rounds a day rate to $25 under a thousand, $100 under ten thousand, $500 under a hundred thousand, then $5,000', () => {
    const rows: readonly (readonly [number, number])[] = [
      [0, 0],
      [12, 0],
      [13, 25],
      [638, 650],
      [999, 1_000],
      [1_049, 1_000],
      [1_050, 1_100],
      [9_949, 9_900],
      [9_950, 10_000],
      [12_249, 12_000],
      [12_250, 12_500],
      [99_749, 99_500],
      [99_750, 100_000],
      [102_499, 100_000],
      [102_500, 105_000],
    ];
    for (const [input, output] of rows) expect(modelRoundRate(input), String(input)).toBe(output);
  });

  it('rounds a fee to $100 under ten thousand, $1,000 under a million, then $10,000', () => {
    const rows: readonly (readonly [number, number])[] = [
      [0, 0],
      [49, 0],
      [50, 100],
      [149, 100],
      [150, 200],
      [9_949, 9_900],
      [9_950, 10_000],
      [10_499, 10_000],
      [10_500, 11_000],
      [999_499, 999_000],
      [999_500, 1_000_000],
      [1_004_999, 1_000_000],
      [1_005_000, 1_010_000],
    ];
    for (const [input, output] of rows) expect(modelRoundFee(input), String(input)).toBe(output);
  });
});

describe('a job made from a draw', () => {
  const made = (over: Partial<Parameters<typeof makeModelJob>[0]> = {}) => {
    const state = adult('made');
    return makeModelJob({
      seed: seedOf(state),
      gen: genOf(state),
      id: '27:0',
      tier: 'commercial',
      source: 'asked',
      age: 27,
      reputation: 0,
      taken: new Set<string>(),
      ...over,
    });
  };
  const draw = (id: string, part: string) => {
    const state = adult('made');
    return modelUnit(seedOf(state), genOf(state), part, id);
  };

  it('takes its placement, rate, days and usage from the rung’s own draws', () => {
    for (const tier of MODEL_TIERS) {
      for (let index = 0; index < 8; index += 1) {
        const id = `27:${index}`;
        const job = made({ tier, id });
        const placement = modelPlacementFor(tier, draw(id, 'placement'));
        const rate = modelDayRate(tier, placement, draw(id, 'rate'), 0.85);
        const days = modelJobDays(tier, placement, draw(id, 'days'));
        expect(job.placement, `${tier} ${id}`).toBe(placement);
        expect(job.rate, `${tier} ${id}`).toBe(rate);
        expect(job.days, `${tier} ${id}`).toBe(days);
        expect(job.usage, `${tier} ${id}`).toBe(modelUsageFee(tier, rate, days));
        expect(job.id).toBe(id);
        expect(job.tier).toBe(tier);
        expect(job.source).toBe('asked');
        expect(job.age).toBe(27);
      }
    }
  });

  it('pays a name that is known up to fifteen percent either side of the going rate', () => {
    for (const [reputation, name] of [
      [0, 0.85],
      [50, 1],
      [100, 1.15],
    ] as const) {
      for (let index = 0; index < 6; index += 1) {
        const id = `27:${index}`;
        const job = made({ tier: 'editorial', id, reputation });
        const placement = modelPlacementFor('editorial', draw(id, 'placement'));
        expect(job.rate, `${reputation} ${id}`).toBe(
          modelDayRate('editorial', placement, draw(id, 'rate'), name),
        );
      }
    }
    expect(made({ tier: 'editorial', reputation: 100, id: '27:2' }).rate).toBeGreaterThan(
      made({ tier: 'editorial', reputation: 0, id: '27:2' }).rate,
    );
  });

  it('is paid to the dollar for the name: a hundred is exactly fifteen percent over', () => {
    // Find draws where a hundredth of a point of the name changes the quoted rate, so the divisor is pinned.
    let pinned = 0;
    for (let index = 0; index < 400 && pinned < 3; index += 1) {
      const id = `27:${index}`;
      const placement = modelPlacementFor('campaign', draw(id, 'placement'));
      const exact = modelDayRate('campaign', placement, draw(id, 'rate'), 1.15);
      const near = modelDayRate('campaign', placement, draw(id, 'rate'), 0.85 + 0.3 * (100 / 101));
      if (exact === near) continue;
      pinned += 1;
      expect(made({ tier: 'campaign', id, reputation: 100 }).rate, id).toBe(exact);
    }
    expect(pinned).toBe(3);
  });

  it('is shot in a kind of work from the rung’s own list, by the draw', () => {
    for (const tier of MODEL_TIERS) {
      const mediums = MODEL_TIER_ROWS[tier].mediums;
      for (let index = 0; index < 12; index += 1) {
        const id = `27:${index}`;
        expect(made({ tier, id }).medium, `${tier} ${id}`).toBe(
          mediums[Math.floor(draw(id, 'medium') * mediums.length)],
        );
      }
    }
  });

  it('is for a client by the draw, then the next one along when that one has a job already', () => {
    for (const tier of MODEL_TIERS) {
      const clients = MODEL_CLIENTS[tier];
      for (let index = 0; index < 12; index += 1) {
        const id = `27:${index}`;
        const start = Math.floor(draw(id, 'client') * clients.length);
        expect(made({ tier, id }).client, `${tier} ${id}`).toBe(clients[start]);
        expect(made({ tier, id, taken: new Set([clients[start]!]) }).client).toBe(
          clients[(start + 1) % clients.length],
        );
        const most = new Set([0, 1, 2, 3].map((step) => clients[(start + step) % clients.length]!));
        expect(made({ tier, id, taken: most }).client).toBe(clients[(start + 4) % clients.length]);
        // Every client taken: the first choice again, not a different one.
        expect(made({ tier, id, taken: new Set(clients) }).client).toBe(clients[start]);
      }
    }
  });
});

describe('the pay in words', () => {
  const said = (over: Partial<Job>) => modelingOfferDecision(job(over), 2040).prompt;

  it('says a job pays when it pays a dollar, in the day rate or the pictures', () => {
    expect(said({ rate: 1, days: 1, usage: 0 })).toContain(
      'It pays $1 a day for 1 day, $1 in all.',
    );
    expect(said({ rate: 0, days: 2, usage: 1 })).toContain(
      'It pays $0 a day for 2 days, and $1 for the use of the pictures, $1 in all.',
    );
    expect(said({ rate: 0, days: 3, usage: 0 })).toContain(
      'It doesn’t pay. It’s 3 days for the pictures.',
    );
    expect(said({ rate: 100, days: 2, usage: 0 })).not.toContain('for the use of the pictures');
  });
});

describe('what an ask for more lands on', () => {
  it('is half, plus a quarter for a name, plus fifteen points with an agency, and never over ninety', () => {
    expect(modelAskChance(EMPTY_MODELING)).toBe(MODEL_ASK_BASE);
    expect(modelAskChance({ ...EMPTY_MODELING, reputation: 100 })).toBeCloseTo(
      MODEL_ASK_BASE + MODEL_ASK_REPUTATION_WEIGHT,
      12,
    );
    expect(modelAskChance({ ...EMPTY_MODELING, reputation: 50 })).toBeCloseTo(
      MODEL_ASK_BASE + MODEL_ASK_REPUTATION_WEIGHT / 2,
      12,
    );
    expect(
      modelAskChance({ ...EMPTY_MODELING, reputation: 50, agency: { since: 20 } }),
    ).toBeCloseTo(MODEL_ASK_BASE + MODEL_ASK_REPUTATION_WEIGHT / 2 + MODEL_AGENCY_ASK_BONUS, 12);
    expect(modelAskChance({ ...EMPTY_MODELING, reputation: 100, agency: { since: 20 } })).toBe(0.9);
  });

  it('lands on a draw just under the chance and holds on one just over', () => {
    const base = known(adult('ask-edge'), { reputation: 100 });
    const chance = modelAskChance(base.modeling);
    const asked = (id: string) =>
      answerModelingOffer(
        { ...base, modeling: { ...base.modeling, offers: [job({ id, rate: 3_000 })] } },
        'more',
      );
    const unitOf = (id: string) => modelUnit(seedOf(base), genOf(base), 'ask', id);
    let under: string | undefined;
    let over: string | undefined;
    for (let index = 0; index < 60_000 && (under === undefined || over === undefined); index += 1) {
      const id = `edge:${index}`;
      const unit = unitOf(id);
      if (under === undefined && unit < chance && unit > chance - 0.0024) under = id;
      if (over === undefined && unit >= chance && unit < chance + 0.0024) over = id;
    }
    expect(under).toBeDefined();
    expect(over).toBeDefined();
    const lucky = asked(under!);
    const held = asked(over!);
    if (!lucky.ok || !held.ok) throw new Error('expected an answer');
    expect(lucky.value.entry.text).toMatch(/came up to/);
    expect(held.value.entry.text).toMatch(/held at/);
  });
});

describe('the timeline and the channel, to the field', () => {
  it('numbers an entry after the others at its age', () => {
    const base = known(adult('sequence'), {
      offers: [job({ id: '26:0', age: 26 }), job({ id: '26:1', age: 26 })],
    });
    const at26 = base.player.timeline.filter((row) => row.age === 26).length;
    expect(base.player.timeline.length).toBeGreaterThan(at26 * 2);
    const first = answerModelingOffer(base, 'decline');
    if (!first.ok) throw new Error('expected an answer');
    expect(first.value.entry.sequence).toBe(at26);
    const second = answerModelingOffer(first.value.state, 'decline');
    if (!second.ok) throw new Error('expected an answer');
    expect(second.value.entry.sequence).toBe(at26 + 1);
  });

  it('is the whole of the pseudo-channel the sponsor rules read, and nothing else', () => {
    const modeling = known(adult('channel-whole'), {
      followers: 7_000,
      peak: 9_000,
      brandAnswered: ['x'],
    }).modeling;
    expect(modelChannel(modeling)).toEqual({
      id: 'modeling',
      platformId: 'photo',
      categoryId: 'fashion',
      name: 'Modeling',
      since: 0,
      audience: 7_000,
      peak: 9_000,
      effort: 'regular',
      luck: 0,
      earned: dollars(0),
      answered: ['x'],
    });
  });

  it('rounds the people a channel gains, and ignores less than one', () => {
    const channel = {
      id: 'ch:fashion',
      platformId: 'photo',
      categoryId: 'fashion',
      name: 'f',
      since: 0,
      audience: 100,
      peak: 100,
      effort: 'regular' as const,
      luck: 0,
      earned: dollars(0),
    };
    expect(withModelAudience([channel], 2)[0]!.audience).toBe(101);
    expect(withModelAudience([channel], 4)[0]!.audience).toBe(101);
    expect(withModelAudience([channel], 6)[0]!.audience).toBe(102);
  });
});

describe('the content’s rounded figures', () => {
  it('rounds the days of a job, a first craft, and a name held in the mind', () => {
    // 8 + (30 − 8) × 0.6 = 21.2 days at the head of a catalogue shoot; a featured spot is 0.8 of that: 16.96.
    expect(modelJobDays('catalogue', 'featured', 0.6)).toBe(17);
    expect(naturalModelCraft({ looks: 71, charisma: 60, discipline: 50, smarts: 40 })).toBe(42);
    // Twenty-five points of name is two and a half points of fame: three. Half of nine is four and a half: five.
    expect(modelFameOf({ tier: 'commercial', reputation: 25, awards: 0, idle: 0 })).toBe(9);
    expect(modelFameOf({ tier: 'commercial', reputation: 25, awards: 0, idle: 1 })).toBe(5);
  });
});

describe('a craft that rounds', () => {
  it('moves by the nearest whole point, a third of the gap up and a tenth down', () => {
    const base = adult('craft-round');
    const natural = naturalModelCraft(base.player.stats);
    const none = { ...EMPTY_MODELING, credits: 0 };
    expect(nextModelCraft(base, none, natural - 5)).toBe(natural - 5 + 2);
    expect(nextModelCraft(base, none, natural - 3)).toBe(natural - 3 + 1);
    expect(nextModelCraft(base, none, natural + 5)).toBe(natural + 5);
    expect(nextModelCraft(base, none, natural + 6)).toBe(natural + 6 - 1);
    expect(nextModelCraft(base, none, natural)).toBe(natural);
  });
});

describe('the edges of the age window', () => {
  it('raises offers for a model who is fourteen', () => {
    const found = firstSeed('fourteen', (seed) => {
      const base = known(atAge(adult(seed), 13), {
        tier: 'test',
        credits: 4,
        reputation: 10,
        craft: 60,
      });
      return yearOf(base).modeling.offers.length > 0 ? seed : undefined;
    });
    expect(found).toBeDefined();
  });

  it('lets a fourteen-year-old go to a casting', () => {
    const state = atAge(
      known(adult('go-fourteen'), { tier: 'test', credits: 0, reputation: 0, craft: 60 }),
      14,
    );
    const call = modelCalls(state)[0]!;
    expect(call.job.id).toBe('call:14:0');
    expect(applyToModelCall(state, call.job.id).ok).toBe(true);
  });

  it('lists a rung above to a model of thirty, and not to one of thirty-one', () => {
    const ready = { tier: 'commercial' as const, credits: 100, reputation: 100, craft: 100 };
    const above = (age: number) =>
      firstSeed(
        'window-edge',
        (seed) => {
          const state = atAge(known(adult(seed), ready), age);
          return modelCalls(state).some((row) => row.reach === 'above') ? 'yes' : undefined;
        },
        4,
      );
    expect(above(30)).toBe('yes');
    for (let index = 0; index < 4; index += 1) {
      const state = atAge(known(adult(`window-edge-${index}`), ready), 31);
      expect(modelCalls(state).some((row) => row.reach === 'above')).toBe(false);
    }
  });

  it('fills a year to the last day and not past it', () => {
    const found = firstSeed('days-edge', (seed) => {
      const base = known(adult(seed), {
        tier: 'commercial',
        credits: 30,
        reputation: 100,
        craft: 70,
        agency: { since: 20 },
      });
      const open = yearOf(base).modeling.offers.find((row) => row.id === '27:0');
      return open ? { base, days: open.days } : undefined;
    });
    const waiting = (days: number) => [
      job({ id: 'w:1', days, client: 'Nobody Calls Them', age: 26 }),
    ];
    const exact = yearOf({
      ...found.base,
      modeling: { ...found.base.modeling, offers: waiting(MODEL_YEAR_DAYS - found.days) },
    });
    expect(exact.modeling.offers.map((row) => row.id)).toContain('27:0');
    const over = yearOf({
      ...found.base,
      modeling: { ...found.base.modeling, offers: waiting(MODEL_YEAR_DAYS - found.days + 1) },
    });
    expect(over.modeling.offers.map((row) => row.id)).not.toContain('27:0');
  });
});

describe('the edges of a performance', () => {
  /** A year in which the craft puts the performance at exactly `performance`: the float sum comes out equal. */
  const exactly = (
    performance: number,
    over: Partial<BookedJob>,
    patch: Partial<ModelingState>,
    want: (year: number, base: GameState, row: BookedJob) => boolean = () => true,
  ) =>
    firstYear(2100, (year) => {
      const base = { ...strong('exact'), world: { ...strong('exact').world, year: year - 1 } };
      const row = booked(over);
      const craft = craftFor(base, year, row.id, performance);
      const unit = modelUnit(seedOf(base), genOf(base), 'perf', year, row.id);
      if (craft + (unit - 0.5) * MODEL_PERFORMANCE_NOISE !== performance) return undefined;
      if (!want(year, base, row)) return undefined;
      const state = known(base, { craft, booked: [row], ...patch });
      return { state, out: yearOf(state) };
    });

  it('is a hit on the line itself', () => {
    const line = MODEL_TIER_ROWS.catalogue.hitLine;
    const { out } = exactly(line, { tier: 'catalogue' }, { tier: 'catalogue' });
    expect(lineOf(out.lines, /The client loved it/)).toBeDefined();
  });

  it('is a flop only under the margin, not on it', () => {
    const line = MODEL_TIER_ROWS.catalogue.hitLine - MODEL_FLOP_MARGIN;
    const { out } = exactly(line, { tier: 'catalogue' }, { tier: 'catalogue' });
    expect(lineOf(out.lines, /It came and went/)).toBeDefined();
    expect(lineOf(out.lines, /weren’t happy/)).toBeUndefined();
  });

  it('wins an award on the line itself, and a name never goes over a hundred', () => {
    const draws = (year: number, base: GameState, row: BookedJob) =>
      modelUnit(seedOf(base), genOf(base), 'award', year, 0, row.id) < MODEL_AWARD_CHANCE.face;
    const { out } = exactly(
      MODEL_AWARD_LINE,
      { tier: 'face', placement: 'face' },
      { tier: 'face', reputation: 99 },
      draws,
    );
    expect(out.modeling.awards).toBe(1);
    expect(out.modeling.reputation).toBe(100);
  });

  it('is paid, and said so, for a single dollar', () => {
    const { out } = shot(adult('one-dollar'), 60, { rate: 1, days: 1, usage: 0 });
    expect(out.pay).toBe(1);
    expect(lineOf(out.lines, /^Shot /)!.text).toContain('It paid $1.');
    const free = shot(adult('one-dollar'), 60, { rate: 0, days: 1, usage: 0 }).out;
    expect(lineOf(free.lines, /^Shot /)!.text).not.toContain('It paid');
  });
});

describe('the edges of a year’s money and standing', () => {
  it('pays a brand deal of one dollar, and takes a share of the odd dollars at the half', () => {
    const one = yearOf(known(adult('owed-one'), { brandOwed: 1 }));
    expect(one.brandPay).toBe(1);
    expect(lineOf(one.lines, /brand deals/)!.text).toBe('The brand deals paid $1.');
    const three = yearOf(known(adult('owed-three'), { brandOwed: 3, agency: { since: 20 } }));
    expect(three.agencyShare).toBe(1);
    expect(three.brandPay).toBe(2);
  });

  it('counts a model with a single job to their name as idle in a year with none', () => {
    const out = yearOf(known(adult('one-credit'), { credits: 1, idle: 0, reputation: 20 }));
    expect(out.modeling.idle).toBe(1);
    expect(out.modeling.reputation).toBe(18);
  });

  it('slides from the second rung to the first after three idle years', () => {
    const out = yearOf(known(adult('fall-one'), { tier: 'catalogue', idle: 2, credits: 12 }));
    expect(out.modeling.tier).toBe('test');
    expect(out.modeling.idle).toBe(1);
    expect(lineOf(out.lines, /dried up/)!.text).toBe(
      'The work dried up. You’re back to test shoots and local work.',
    );
  });

  it('keeps the best rung reached, and says none before the second', () => {
    const other = known(adult('best-two'), { tier: 'catalogue' });
    const { best: _unset, ...bare } = other.modeling;
    const second = yearOf({ ...other, modeling: bare });
    expect(second.modeling.best).toBe('catalogue');
    const seen = known(adult('best-one'), { tier: 'test' });
    const { best: _none, ...clean } = seen.modeling;
    const first = yearOf({ ...seen, modeling: clean });
    expect('best' in first.modeling).toBe(false);
    const higher = yearOf(known(adult('best-keep'), { tier: 'commercial', best: 'campaign' }));
    expect(higher.modeling.best).toBe('campaign');
    const lower = yearOf(known(adult('best-lift'), { tier: 'commercial', best: 'catalogue' }));
    expect(lower.modeling.best).toBe('commercial');
  });

  it('rounds a following to the nearest person after the year’s churn', () => {
    expect(yearOf(known(adult('churn'), { followers: 51, peak: 51 })).modeling.followers).toBe(47);
    expect(yearOf(known(adult('churn'), { followers: 50, peak: 50 })).modeling.followers).toBe(46);
  });
});
