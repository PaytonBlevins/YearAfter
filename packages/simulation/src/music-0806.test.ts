/**
 * Ticket 0806 acceptance tests — music.
 *
 * Six rungs from a local act to a superstar, all read off one number (monthly listeners); releases under the spec's yearly
 * caps (15 singles, 3 EPs, 2 albums) and the 52 weeks a year has; a craft that comes from the character; streams at
 * real rates; labels that call or take a demo, with an advance, a royalty after the advance is paid back, and a
 * negotiation; tours that lose money small and make it big; collaborations on the creators' own rules; a manager or an
 * agent; an award; and that a life that goes near none of it replays as it did. Each pin that is a real figure says so.
 */

import { describe, expect, it } from 'vitest';
import { cents, dollars, toDollars } from '@yearafter/core';
import {
  AUDIENCE_BASE_LOG,
  CATALOGUE_FULL,
  CATALOGUE_WEIGHT,
  DEMO_CHANCE_RANGE,
  DIY_COST,
  DISCOVER,
  DISTRIBUTOR_CUT,
  GROW,
  HIT_LINE,
  IDLE_DECAY,
  KIND_NAME,
  KIND_NOUN,
  LABEL_COST,
  LABEL_NAMES,
  LABEL_REACH,
  LABEL_ROWS,
  LISTENER_CAP,
  MIN_SHOWS,
  MIN_TOUR_LISTENERS,
  MUSIC_ASK_ADVANCE_GAIN,
  MUSIC_AWARD_LINE,
  MUSIC_AWARD_NAMES,
  MUSIC_CHANNEL_SHARE,
  MUSIC_FLOP_MARGIN,
  MUSIC_FLOP_REPUTATION,
  MUSIC_HEADROOM,
  MUSIC_HIT_REPUTATION,
  MUSIC_IDLE_REPUTATION,
  MUSIC_LESSONS_COST,
  MUSIC_LESSONS_CRAFT,
  MUSIC_LIVING_WAGE,
  MUSIC_RELEASE_CRAFT,
  MUSIC_RELEASE_CRAFT_CAP,
  MUSIC_RISE_LINES,
  MUSIC_ROYALTY_CAP,
  MUSIC_STAGE_CRAFT,
  MUSIC_TALENT_CRAFT,
  MUSIC_TIERS,
  MUSIC_TIER_ROWS,
  MUSIC_TOUR_MIN_AGE,
  OVERSHOOT_FALL,
  QUALITY_FLOOR,
  QUALITY_NOISE,
  QUALITY_SPAN,
  RELEASE_CAPS,
  RELEASE_KINDS,
  RELEASE_TITLES,
  RELEASE_WEEKS,
  RETAIN_BASE,
  RETAIN_CATALOGUE,
  SATURATION,
  SHOWS_PER_WEEK,
  STREAMS_PER_LISTENER,
  STREAM_PAYOUT,
  TOUR_FANS,
  VIRAL_BASE,
  VIRAL_CEILING,
  VIRAL_FROM,
  VIRAL_MULTIPLIER,
  VIRAL_PER_POINT,
  YEAR_WEEKS,
  audienceCeiling,
  musicCraft,
  musicFameOf,
  musicReputationWord,
  qualityFactor,
  stepMusicTier,
  tierFor,
  tierRankOf,
  tourFor,
  type MusicTier,
  type ReleaseKind,
} from '@yearafter/content';
import {
  AGENT_CUT as REP_AGENT_CUT,
  MANAGER_CUT,
  MANAGER_GROWTH,
  totalFor,
  type PrivateDeal,
} from '@yearafter/finance';
import { findJob } from '@yearafter/careers';
import { advanceYear } from './advance';
import { decide } from './decide';
import { eulogyFor } from './eulogy';
import type { GameState } from './game-state';
import { hasSystemicOffer } from './game-state';
import {
  MUSIC_ERROR_LABELS,
  MUSIC_OFFER_EVENT_ID,
  MUSIC_STAGE_ACTIVITIES,
  PLAN_ERROR_LABELS,
  answerMusicCollab,
  answerMusicOffer,
  askChance,
  committedReleases,
  demoChance,
  emptyMusicYear,
  isMusicFullTime,
  isMusicOfferDecision,
  musUnit,
  musicChannel,
  musicCollabOffers,
  musicCraftCeiling,
  musicCraftOf,
  musicLuck,
  musicOccupation,
  musicOfferDecision,
  musicTierOf,
  nextMusicCraft,
  planCost,
  planReleases,
  planTour,
  plannedTour,
  runMusicYear,
  startMusicLessons,
  stopMusicLessons,
  submitDemo,
  totalReleased,
  weeksUsed,
  withMusicAudience,
  withMusicOffer,
} from './music';
import {
  EMPTY_MUSIC,
  EMPTY_PLAN,
  type LabelDeal,
  type LabelOffer,
  type MusicState,
} from './music-state';
import { createNewGame } from './new-game';
import { openChannel } from './creators';
import { dealTaxOn } from './deals';
import { money } from './sports-core';
import { withAnyOffer } from './offers';
import { whyNotHire } from './network';
import { join } from '@yearafter/education';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function answerOthers(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending.find((row) => row.eventId !== MUSIC_OFFER_EVENT_ID);
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

/** A life, with or without the music talent, at its first year. */
const life = (seed: string, talent = false): GameState => {
  const base = createNewGame({ seed });
  return {
    ...base,
    player: { ...base.player, talents: { ...base.player.talents, music: talent } },
  };
};

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
 * ("name~1"), so every test that asks for an adult gets a living one (CORE_RULES 13.182).
 */
const adults = new Map<string, GameState>();
function adult(seed: string, talent = false, age = 26): GameState {
  const key = `${seed}:${talent}:${age}`;
  const found = adults.get(key);
  if (found) return found;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const made = toAge(life(attempt === 0 ? seed : `${seed}~${attempt}`, talent), age);
    if (made.player.alive && made.player.age >= age) {
      adults.set(key, made);
      return made;
    }
  }
  throw new Error(`no living life of age ${age} for ${seed}`);
}

const withMusic = (state: GameState, patch: Partial<MusicState>): GameState => ({
  ...state,
  music: { ...state.music, ...patch },
});

const withStats = (
  state: GameState,
  stats: Partial<Record<'charisma' | 'looks' | 'smarts' | 'discipline' | 'health', number>>,
): GameState => ({
  ...state,
  player: { ...state.player, stats: { ...state.player.stats, ...stats } as never },
});

/** Money in the bank, in the ledger and on the player, whole dollars. */
const rich = (state: GameState, amount = 500_000): GameState => ({
  ...state,
  finance: { ...state.finance, balance: dollars(amount) },
  player: { ...state.player, cash: dollars(amount) },
});

/** The same life as a musician who has been heard: some listeners and a catalogue behind them. */
const known = (state: GameState, patch: Partial<MusicState> = {}): GameState =>
  withMusic(state, {
    craft: 60,
    listeners: 3_000,
    peak: 3_000,
    released: { single: 4, ep: 1, lp: 0 },
    catalogue: 6,
    bestQuality: 62,
    ...patch,
  });

const yearOf = (before: GameState, age = before.player.age + 1, year = before.world.year + 1) =>
  runMusicYear({ before, education: before.education, age, year, standard: 60_000 });

const seedOf = (state: GameState) => state.rng.getSeed();
const genOf = (state: GameState) => state.world.generation;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** The quality the engine gives release `index` of `year`, from the draw the engine uses. */
const qualityOf = (state: GameState, year: number, index: number, craft: number, polish = 0) =>
  clamp(
    Math.round(
      craft +
        polish +
        (musUnit(seedOf(state), genOf(state), 'q', year, index) - 0.5) * QUALITY_NOISE,
    ),
    0,
    100,
  );

/** The first life of a numbered set that satisfies `test`, failing loudly when none does (13.176). */
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

const deal = (over: Partial<LabelDeal> = {}): LabelDeal => ({
  kind: 'indie',
  label: 'Porchlight Records',
  advance: 10_000,
  royalty: 0.4,
  left: 2,
  since: 25,
  owed: 0,
  paid: false,
  ...over,
});

const offer = (over: Partial<LabelOffer> = {}): LabelOffer => ({
  id: 'lbl:26',
  kind: 'indie',
  label: 'Porchlight Records',
  advance: 10_000,
  royalty: 0.4,
  term: 2,
  age: 26,
  source: 'called',
  ...over,
});

/* -------------------------------------------------------------------------- */
/* The table                                                                   */
/* -------------------------------------------------------------------------- */

describe('the six rungs', () => {
  it('run from a local act to a superstar, in that order, each at its own number of monthly listeners', () => {
    expect(MUSIC_TIERS).toEqual([
      'local',
      'club',
      'regional',
      'national',
      'headliner',
      'superstar',
    ]);
    expect(MUSIC_TIERS.map((id) => MUSIC_TIER_ROWS[id].name)).toEqual([
      'Local act',
      'Club circuit',
      'Regional act',
      'National act',
      'Arena headliner',
      'Superstar',
    ]);
    expect(MUSIC_TIERS.map((id) => MUSIC_TIER_ROWS[id].listeners)).toEqual([
      0, 2_000, 25_000, 300_000, 3_000_000, 25_000_000,
    ]);
  });

  it('are found from the listeners, at the number and not before it', () => {
    expect(tierFor(0)).toBe('local');
    expect(tierFor(1_999)).toBe('local');
    expect(tierFor(2_000)).toBe('club');
    expect(tierFor(24_999)).toBe('club');
    expect(tierFor(25_000)).toBe('regional');
    expect(tierFor(299_999)).toBe('regional');
    expect(tierFor(300_000)).toBe('national');
    expect(tierFor(2_999_999)).toBe('national');
    expect(tierFor(3_000_000)).toBe('headliner');
    expect(tierFor(24_999_999)).toBe('headliner');
    expect(tierFor(25_000_000)).toBe('superstar');
    expect(tierFor(900_000_000)).toBe('superstar');
  });

  it('are ranked from zero and stepped without leaving the ladder', () => {
    expect(MUSIC_TIERS.map(tierRankOf)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(stepMusicTier('club', 1)).toBe('regional');
    expect(stepMusicTier('club', -1)).toBe('local');
    expect(stepMusicTier('local', -1)).toBe('local');
    expect(stepMusicTier('superstar', 1)).toBe('superstar');
    expect(stepMusicTier('local', 99)).toBe('superstar');
  });

  it('ask for more of everything the higher they go: rooms, tickets, night costs, fame, calls, awards', () => {
    for (const key of [
      'listeners',
      'capacity',
      'ticket',
      'doorShare',
      'nightCost',
      'fame',
      'labelChance',
      'majorShare',
      'awardChance',
      'reputation',
    ] as const) {
      const values = MUSIC_TIERS.map((id) => MUSIC_TIER_ROWS[id][key]);
      for (let index = 1; index < values.length; index += 1) {
        expect(values[index]!, key).toBeGreaterThanOrEqual(values[index - 1]!);
      }
    }
    // The draw falls as the room gets bigger: a smaller share of a bigger audience goes to see you.
    const draws = MUSIC_TIERS.map((id) => MUSIC_TIER_ROWS[id].draw);
    for (let index = 1; index < draws.length; index += 1) {
      expect(draws[index]!).toBeLessThan(draws[index - 1]!);
    }
    // Nobody is called, and no award is won, before there is something to call for.
    expect(MUSIC_TIER_ROWS.local.labelChance).toBe(0);
    expect(MUSIC_TIER_ROWS.club.awardChance).toBe(0);
    expect(MUSIC_TIER_ROWS.regional.awardChance).toBe(0);
    expect(MUSIC_TIER_ROWS.national.awardChance).toBe(0.1);
    // A major label does not call before the regional rung.
    expect(MUSIC_TIER_ROWS.club.majorShare).toBe(0);
    expect(MUSIC_TIER_ROWS.regional.majorShare).toBeGreaterThan(0);
  });

  it('say where each plays: bars, clubs, theaters, large theaters, arenas and stadiums', () => {
    expect(MUSIC_TIERS.map((id) => MUSIC_TIER_ROWS[id].venue)).toEqual([
      'bars and coffeehouses',
      'clubs',
      'theaters',
      'large theaters',
      'arenas',
      'stadiums',
    ]);
    expect(MUSIC_TIERS.map((id) => MUSIC_TIER_ROWS[id].capacity)).toEqual([
      100, 300, 1_200, 3_000, 15_000, 50_000,
    ]);
  });
});

describe('the real figures', () => {
  it('pay about four tenths of a cent a stream, to the distributor 15%, three streams a listener a month', () => {
    expect(STREAM_PAYOUT).toBe(0.004);
    expect(DISTRIBUTOR_CUT).toBe(0.15);
    expect(STREAMS_PER_LISTENER).toBe(36);
    // About a million streams a month is a living wage on streaming alone (UK IPO, 2021): a third of a million listeners.
    const listeners = 330_000;
    const perYear = listeners * STREAMS_PER_LISTENER * STREAM_PAYOUT * (1 - DISTRIBUTOR_CUT);
    expect(perYear).toBeGreaterThan(30_000);
    expect(perYear).toBeLessThan(50_000);
    expect(tierFor(listeners)).toBe('national');
  });

  it('hold the yearly caps the spec sets: 15 singles, 3 EPs and 2 albums, with weeks that do not all fit', () => {
    expect(RELEASE_CAPS).toEqual({ single: 15, ep: 3, lp: 2 });
    expect(RELEASE_WEEKS).toEqual({ single: 2, ep: 6, lp: 14 });
    expect(YEAR_WEEKS).toBe(52);
    const everything = RELEASE_KINDS.reduce(
      (sum, kind) => sum + RELEASE_CAPS[kind] * RELEASE_WEEKS[kind],
      0,
    );
    expect(everything).toBeGreaterThan(YEAR_WEEKS);
  });

  it('cost the artist little to put a single out themselves and a great deal more through a label, which recoups it', () => {
    expect(DIY_COST).toEqual({ single: 300, ep: 2_500, lp: 9_000 });
    for (const kind of RELEASE_KINDS) {
      expect(LABEL_COST.indie[kind]).toBeGreaterThan(DIY_COST[kind]);
      expect(LABEL_COST.major[kind]).toBeGreaterThan(LABEL_COST.indie[kind]);
    }
  });

  it('give a major label 18% of streams to the artist after recoup, up to 25% bargained, and an indie a bigger share', () => {
    expect(LABEL_ROWS.major.royalty).toBe(0.18);
    expect(MUSIC_ROYALTY_CAP.major).toBe(0.25);
    expect(LABEL_ROWS.indie.royalty).toBe(0.4);
    expect(LABEL_ROWS.indie.royalty).toBeGreaterThan(LABEL_ROWS.major.royalty);
    expect(MUSIC_ROYALTY_CAP.indie).toBeGreaterThanOrEqual(LABEL_ROWS.indie.royalty);
    expect(LABEL_ROWS.major.term).toBeGreaterThanOrEqual(LABEL_ROWS.indie.term);
  });

  it('commit a label to releases the year has room for, and a major to more than an indie', () => {
    for (const kind of ['indie', 'major'] as const) {
      const commit = LABEL_ROWS[kind].commit;
      for (const release of RELEASE_KINDS)
        expect(commit[release]).toBeLessThanOrEqual(RELEASE_CAPS[release]);
      const weeks = RELEASE_KINDS.reduce(
        (sum, release) => sum + commit[release] * RELEASE_WEEKS[release],
        0,
      );
      expect(weeks).toBeLessThan(YEAR_WEEKS);
    }
  });

  it('pay a bigger advance the higher the rung, and a major more than an indie at the same rung', () => {
    for (const kind of ['indie', 'major'] as const) {
      const rows = LABEL_ROWS[kind].advance;
      const ranges = MUSIC_TIERS.flatMap((tier) => (rows[tier] ? [rows[tier]!] : []));
      for (const [low, high] of ranges) expect(high).toBeGreaterThan(low);
      for (let index = 1; index < ranges.length; index += 1) {
        expect(ranges[index]![0]).toBeGreaterThan(ranges[index - 1]![0]);
        expect(ranges[index]![1]).toBeGreaterThan(ranges[index - 1]![1]);
      }
    }
    expect(LABEL_ROWS.major.advance.regional![0]).toBeGreaterThan(
      LABEL_ROWS.indie.advance.regional![0],
    );
    expect(LABEL_ROWS.indie.advance.local).toBeUndefined();
    expect(LABEL_ROWS.major.advance.club).toBeUndefined();
  });

  it('gives a label reach: more discovery and more growth, the major more than the indie, and polish', () => {
    expect(LABEL_REACH.indie.discover).toBeGreaterThan(1);
    expect(LABEL_REACH.major.discover).toBeGreaterThan(LABEL_REACH.indie.discover);
    expect(LABEL_REACH.major.grow).toBeGreaterThan(LABEL_REACH.indie.grow);
    expect(LABEL_REACH.major.polish).toBeGreaterThan(LABEL_REACH.indie.polish);
  });

  it('names its labels and its titles without repeating one', () => {
    for (const kind of ['indie', 'major'] as const) {
      expect(LABEL_NAMES[kind].length).toBeGreaterThanOrEqual(5);
      expect(new Set(LABEL_NAMES[kind]).size).toBe(LABEL_NAMES[kind].length);
    }
    expect(RELEASE_TITLES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(RELEASE_TITLES).size).toBe(RELEASE_TITLES.length);
    expect(MUSIC_AWARD_NAMES).toEqual({
      single: 'Song of the Year',
      ep: 'Best EP',
      lp: 'Album of the Year',
    });
    expect(KIND_NOUN).toEqual({ single: 'a single', ep: 'an EP', lp: 'an album' });
    expect(KIND_NAME).toEqual({ single: 'single', ep: 'EP', lp: 'album' });
  });
});

describe('what a character is like as a musician', () => {
  const stats = (n: number) => ({ charisma: n, discipline: n, smarts: n, looks: n });

  it('is fifty for the middle of what grown characters measure (72), and moves with the four stats that make one', () => {
    expect(musicCraft(stats(72), false)).toBe(50);
    expect(musicCraft(stats(82), false)).toBe(72);
    expect(musicCraft(stats(62), false)).toBe(28);
    expect(musicCraft({ ...stats(72), discipline: 82 }, false)).toBe(57);
    expect(musicCraft({ ...stats(72), charisma: 82 }, false)).toBe(57);
    expect(musicCraft({ ...stats(72), smarts: 82 }, false)).toBe(56);
    expect(musicCraft({ ...stats(72), looks: 82 }, false)).toBe(53);
  });

  it('is twelve better for a talent, and never leaves 0–100', () => {
    expect(MUSIC_TALENT_CRAFT).toBe(12);
    expect(musicCraft(stats(72), true)).toBe(62);
    expect(musicCraft(stats(100), true)).toBe(100);
    expect(musicCraft(stats(0), false)).toBe(0);
  });

  it('does not depend on health, or on what the character does for a living', () => {
    const base = adult('craft-health');
    const sick = withStats(base, { health: 10 });
    expect(musicCraftOf(sick)).toBe(musicCraftOf(withStats(base, { health: 99 })));
  });
});

describe('quality and the audience a body of work can hold', () => {
  it('counts for nothing at 35 and for a normal release at 65, and tops out at three', () => {
    expect(QUALITY_FLOOR).toBe(35);
    expect(QUALITY_SPAN).toBe(30);
    expect(qualityFactor(0)).toBe(0);
    expect(qualityFactor(35)).toBe(0);
    expect(qualityFactor(50)).toBeCloseTo(0.5, 10);
    expect(qualityFactor(65)).toBeCloseTo(1, 10);
    expect(qualityFactor(95)).toBeCloseTo(2, 10);
    expect(qualityFactor(500)).toBe(3);
  });

  it('holds about three thousand people for ordinary work, tens of thousands for good, and rises with every point', () => {
    // The worst luck halves it: about a thousand people for ordinary work. An ordinary luck is about two thousand.
    const worst = audienceCeiling(50, 0);
    expect(worst).toBeCloseTo(10 ** (AUDIENCE_BASE_LOG - 0.3), 0);
    expect(worst).toBeGreaterThan(900);
    expect(worst).toBeLessThan(1_100);
    const ordinary = audienceCeiling(50, 0.5);
    expect(ordinary).toBeGreaterThan(1_800);
    expect(ordinary).toBeLessThan(2_400);
    expect(audienceCeiling(70, 0)).toBeGreaterThan(audienceCeiling(60, 0));
    expect(audienceCeiling(60, 0) / audienceCeiling(50, 0)).toBeCloseTo(10 ** 0.5, 6);
  });

  it('is much more for a lucky life, in the thousands of times from the worst luck to the best', () => {
    const worst = audienceCeiling(60, 0);
    const best = audienceCeiling(60, 1);
    expect(best / worst).toBeGreaterThan(200);
    expect(audienceCeiling(60, 0.5)).toBeGreaterThan(worst);
    expect(audienceCeiling(60, 0.9)).toBeGreaterThan(audienceCeiling(60, 0.5));
  });

  it('is multiplied by a label’s reach, and never goes past what anyone has ever held', () => {
    expect(audienceCeiling(60, 0.5, 3)).toBeCloseTo(audienceCeiling(60, 0.5) * 3, 4);
    expect(LISTENER_CAP).toBe(120_000_000);
    expect(audienceCeiling(100, 1, 3.2)).toBe(LISTENER_CAP);
  });

  it('is fixed for a life: the same luck every time it is read, a different one for another life', () => {
    const a = adult('luck-a');
    expect(musicLuck(seedOf(a), genOf(a))).toBe(musicLuck(seedOf(a), genOf(a)));
    const draws = new Set(Array.from({ length: 20 }, (_, index) => musicLuck(`luck-${index}`, 1)));
    expect(draws.size).toBe(20);
    for (const draw of draws) {
      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThan(1);
    }
  });
});

describe('a tour', () => {
  it('is never fewer than four shows, and two weeks at the least, three shows to a week', () => {
    expect(MIN_SHOWS).toBe(4);
    expect(SHOWS_PER_WEEK).toBe(3);
    const small = tourFor('club', 2_000, 60);
    expect(small.shows).toBe(MIN_SHOWS);
    expect(small.weeks).toBe(2);
    const big = tourFor('regional', 200_000, 60);
    expect(big.weeks).toBe(Math.max(2, Math.ceil(big.shows / SHOWS_PER_WEEK)));
  });

  it('sells the draw of the rung to the listeners, a better record filling more rooms than a poorer one', () => {
    const poor = tourFor('regional', 100_000, 40);
    const good = tourFor('regional', 100_000, 90);
    expect(poor.tickets).toBe(Math.round(100_000 * MUSIC_TIER_ROWS.regional.draw * 0.75));
    expect(good.tickets).toBe(Math.round(100_000 * MUSIC_TIER_ROWS.regional.draw * 1.25));
    const middling = tourFor('regional', 100_000, 65);
    expect(middling.tickets).toBe(Math.round(100_000 * MUSIC_TIER_ROWS.regional.draw * 1));
  });

  it('adds nights while the rooms are full to seven tenths, up to the most the rung runs', () => {
    const row = MUSIC_TIER_ROWS.regional;
    const plan = tourFor('regional', 200_000, 65);
    expect(plan.shows).toBe(Math.min(row.shows, Math.ceil(plan.tickets / (row.capacity * 0.7))));
    const huge = tourFor('regional', 50_000_000, 65);
    expect(huge.shows).toBe(row.shows);
    expect(huge.tickets).toBe(row.shows * row.capacity);
  });

  it('pays the door at the ticket and the artist’s share of it, and costs a night what the rung says', () => {
    const row = MUSIC_TIER_ROWS.national;
    const plan = tourFor('national', 400_000, 65);
    expect(plan.door).toBe(Math.round(plan.tickets * row.ticket * row.doorShare));
    expect(plan.costs).toBe(plan.shows * row.nightCost);
  });

  it('barely breaks even in small rooms and makes a good deal in big ones (real: small shows barely pay)', () => {
    const tiny = tourFor('local', 600, 60);
    expect(tiny.door - tiny.costs).toBeLessThan(0);
    const club = tourFor('club', 2_000, 60);
    expect(Math.abs(club.door - club.costs)).toBeLessThan(club.costs);
    const national = tourFor('national', 500_000, 70);
    expect(national.door - national.costs).toBeGreaterThan(100_000);
    const arena = tourFor('headliner', 5_000_000, 70);
    expect(arena.door - arena.costs).toBeGreaterThan(1_000_000);
  });

  it('brings in new listeners from the tickets sold, a tenth of them', () => {
    expect(TOUR_FANS).toBe(0.1);
    expect(MIN_TOUR_LISTENERS).toBe(300);
    expect(MUSIC_TOUR_MIN_AGE).toBe(16);
  });
});

describe('fame', () => {
  const fame = (
    tier: MusicTier,
    over: Partial<{ reputation: number; awards: number; idle: number }> = {},
  ) => musicFameOf({ tier, reputation: 0, awards: 0, idle: 0, ...over });

  it('is nothing for a local act and the rung’s number above, less for each rung down', () => {
    expect(fame('local')).toBe(0);
    expect(MUSIC_TIERS.map((id) => fame(id))).toEqual([0, 2, 8, 22, 48, 78]);
  });

  it('is helped by a name (a tenth of reputation) and by awards (three each, twelve at the most)', () => {
    expect(fame('regional', { reputation: 50 })).toBe(13);
    expect(fame('regional', { awards: 2 })).toBe(14);
    expect(fame('regional', { awards: 20 })).toBe(20);
    expect(fame('superstar', { reputation: 100, awards: 20 })).toBe(100);
  });

  it('halves after a quiet year, and is gone after three', () => {
    expect(fame('national', { idle: 1 })).toBe(11);
    expect(fame('national', { idle: 2 })).toBe(11);
    expect(fame('national', { idle: 3 })).toBe(0);
  });

  it('has a word for a name', () => {
    expect(musicReputationWord(0)).toBe('Unknown');
    expect(musicReputationWord(7)).toBe('Unknown');
    expect(musicReputationWord(8)).toBe('Getting noticed');
    expect(musicReputationWord(20)).toBe('Known on the scene');
    expect(musicReputationWord(40)).toBe('Established');
    expect(musicReputationWord(60)).toBe('Respected');
    expect(musicReputationWord(80)).toBe('Legendary');
  });
});

/* -------------------------------------------------------------------------- */
/* Reading a musician                                                           */
/* -------------------------------------------------------------------------- */

describe('reading a musician', () => {
  it('starts with nothing: no listeners, no catalogue, no plan, no deal', () => {
    expect(EMPTY_MUSIC.listeners).toBe(0);
    expect(EMPTY_MUSIC.plan).toEqual(EMPTY_PLAN);
    expect(EMPTY_MUSIC.deal).toBeUndefined();
    expect(adult('read-empty').music).toEqual(EMPTY_MUSIC);
    expect(totalReleased(EMPTY_MUSIC)).toBe(0);
  });

  it('counts every release put out', () => {
    expect(totalReleased({ ...EMPTY_MUSIC, released: { single: 4, ep: 2, lp: 1 } })).toBe(7);
  });

  it('reads craft off the character until music matters, then from what has been built', () => {
    const base = adult('read-craft', true);
    expect(musicCraftOf(base)).toBe(musicCraft(base.player.stats, true));
    expect(musicCraftOf(withMusic(base, { craft: 33 }))).toBe(33);
  });

  it('can be taken only so far: ten above what the character is, and four more with lessons', () => {
    const base = adult('read-ceiling');
    const natural = musicCraft(base.player.stats, base.player.talents.music);
    expect(MUSIC_HEADROOM).toBe(10);
    expect(musicCraftCeiling(base)).toBe(Math.min(100, natural + 10));
    expect(musicCraftCeiling(withMusic(base, { lessons: { since: 20, seasons: 1 } }))).toBe(
      Math.min(100, natural + 10 + MUSIC_LESSONS_CRAFT),
    );
    expect(MUSIC_LESSONS_CRAFT).toBe(4);
  });

  it('puts a musician on the rung the listeners say', () => {
    expect(musicTierOf({ ...EMPTY_MUSIC, listeners: 30_000 })).toBe('regional');
  });

  it('is a living when last year paid thirty thousand after everyone’s share and the work has not stopped', () => {
    expect(MUSIC_LIVING_WAGE).toBe(30_000);
    expect(isMusicFullTime({ ...EMPTY_MUSIC, lastPay: 30_000 })).toBe(true);
    expect(isMusicFullTime({ ...EMPTY_MUSIC, lastPay: 29_999 })).toBe(false);
    expect(isMusicFullTime({ ...EMPTY_MUSIC, lastPay: 80_000, idle: 1 })).toBe(true);
    expect(isMusicFullTime({ ...EMPTY_MUSIC, lastPay: 80_000, idle: 2 })).toBe(false);
  });

  it('is the header for a living and nothing before it', () => {
    expect(musicOccupation({ ...EMPTY_MUSIC, lastPay: 40_000 })).toBe('Musician');
    expect(musicOccupation({ ...EMPTY_MUSIC, lastPay: 4_000 })).toBeUndefined();
    expect(musicOccupation(EMPTY_MUSIC)).toBeUndefined();
  });

  it('has the bands, choirs and orchestras of school and town as its stages', () => {
    expect(MUSIC_STAGE_ACTIVITIES).toEqual([
      'act.band',
      'act.choir',
      'act.jazz-band',
      'act.adult.choir',
      'act.adult.band',
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* Planning the year                                                            */
/* -------------------------------------------------------------------------- */

describe('planning releases', () => {
  const base = () => rich(adult('plan-base'));

  it('sets how many of a kind to put out in the year to come', () => {
    const planned = planReleases(base(), 'single', 3);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.music.plan).toEqual({ single: 3, ep: 0, lp: 0, tour: false });
    const more = planReleases(planned.value, 'ep', 1);
    expect(more.ok && more.value.music.plan).toEqual({ single: 3, ep: 1, lp: 0, tour: false });
  });

  it('refuses a child under twelve, and a count that is not a whole number or is below nothing', () => {
    const child = life('plan-child');
    expect(child.player.age).toBeLessThan(12);
    const refused = planReleases(child, 'single', 1);
    expect(!refused.ok && refused.error).toBe('too-young');
    for (const count of [-1, 1.5, Number.NaN]) {
      const result = planReleases(base(), 'single', count);
      expect(!result.ok && result.error, String(count)).toBe('no-such-count');
    }
  });

  it('holds to the caps: 15 singles, 3 EPs, 2 albums, with what a label has committed counted', () => {
    expect(planReleases(base(), 'single', 15).ok).toBe(true);
    const over = planReleases(base(), 'single', 16);
    expect(!over.ok && over.error).toBe('over-cap');
    expect(planReleases(base(), 'ep', 3).ok).toBe(true);
    const ep = planReleases(base(), 'ep', 4);
    expect(!ep.ok && ep.error).toBe('over-cap');
    expect(planReleases(base(), 'lp', 2).ok).toBe(true);
    const lp = planReleases(base(), 'lp', 3);
    expect(!lp.ok && lp.error).toBe('over-cap');
    // A major label has committed one album: only one more fits.
    const signed = withMusic(base(), { deal: deal({ kind: 'major' }) });
    expect(planReleases(signed, 'lp', 1).ok).toBe(true);
    const tooMany = planReleases(signed, 'lp', 2);
    expect(!tooMany.ok && tooMany.error).toBe('over-cap');
    // An indie has committed two singles.
    const indie = withMusic(base(), { deal: deal() });
    expect(planReleases(indie, 'single', 13).ok).toBe(true);
    const tooManyOfThem = planReleases(indie, 'single', 14);
    expect(!tooManyOfThem.ok && tooManyOfThem.error).toBe('over-cap');
  });

  it('holds to the fifty-two weeks: what is planned, what a label has committed and a tour all count', () => {
    let state = base();
    state = (planReleases(state, 'lp', 2) as { ok: true; value: GameState }).value;
    state = (planReleases(state, 'ep', 3) as { ok: true; value: GameState }).value;
    expect(weeksUsed(state)).toBe(2 * 14 + 3 * 6);
    state = (planReleases(state, 'single', 3) as { ok: true; value: GameState }).value;
    expect(weeksUsed(state)).toBe(52);
    const full = planReleases(state, 'single', 4);
    expect(!full.ok && full.error).toBe('no-weeks');
    // A label's commitments take weeks of the plan.
    const signed = withMusic(base(), { deal: deal({ kind: 'major' }) });
    expect(weeksUsed(signed)).toBe(3 * 2 + 14);
    // Fewer is always allowed, even in a full year.
    const fewer = planReleases(state, 'single', 1);
    expect(fewer.ok).toBe(true);
  });

  it('holds to the money: it will not plan what the artist cannot pay to record', () => {
    const poor = rich(adult('plan-poor'), 700);
    expect(planCost({ single: 2, ep: 0, lp: 0, tour: false })).toBe(600);
    expect(planReleases(poor, 'single', 2).ok).toBe(true);
    const broke = planReleases(poor, 'single', 3);
    expect(!broke.ok && broke.error).toBe('no-money');
    expect(planCost({ single: 3, ep: 1, lp: 1, tour: false })).toBe(3 * 300 + 2_500 + 9_000);
    // Taking some back is allowed with nothing in the bank.
    const planned = planReleases(poor, 'single', 2);
    const none = rich(planned.ok ? planned.value : poor, 0);
    expect(planReleases(none, 'single', 1).ok).toBe(true);
  });

  it('has a sentence for every refusal', () => {
    for (const label of Object.values(PLAN_ERROR_LABELS)) expect(label.length).toBeGreaterThan(10);
    for (const label of Object.values(MUSIC_ERROR_LABELS)) expect(label.length).toBeGreaterThan(10);
  });
});

describe('planning a tour', () => {
  it('wants an audience of three hundred and an age of sixteen', () => {
    const base = known(rich(adult('tour-want')), { listeners: 299 });
    expect(plannedTour(base)).toBeUndefined();
    const refused = planTour(base, true);
    expect(!refused.ok && refused.error).toBe('cannot-tour');
    const heard = known(rich(adult('tour-want')), { listeners: 300 });
    expect(plannedTour(heard)).toBeDefined();
    expect(planTour(heard, true).ok).toBe(true);
    const child = known(life('tour-child'), { listeners: 5_000 });
    expect(plannedTour(child)).toBeUndefined();
  });

  it('is what the year would run, read now: the rung, the listeners and the craft', () => {
    const state = known(rich(adult('tour-read')), { listeners: 20_000, craft: 70 });
    expect(plannedTour(state)).toEqual(tourFor('club', 20_000, 70));
  });

  it('takes its weeks out of the year, and is refused when there are none left', () => {
    let state = known(rich(adult('tour-weeks')), { listeners: 20_000 });
    state = (planReleases(state, 'lp', 2) as { ok: true; value: GameState }).value;
    state = (planReleases(state, 'ep', 3) as { ok: true; value: GameState }).value;
    state = (planReleases(state, 'single', 3) as { ok: true; value: GameState }).value;
    expect(weeksUsed(state)).toBe(52);
    const full = planTour(state, true);
    expect(!full.ok && full.error).toBe('no-weeks');
    const spare = known(rich(adult('tour-weeks')), { listeners: 20_000 });
    const on = planTour(spare, true);
    expect(on.ok).toBe(true);
    if (!on.ok) return;
    expect(weeksUsed(on.value)).toBe(plannedTour(spare)!.weeks);
    expect(on.value.music.plan.tour).toBe(true);
  });

  it('can be taken off the plan, always', () => {
    const state = known(rich(adult('tour-off')), { listeners: 20_000 });
    const on = planTour(state, true);
    expect(on.ok).toBe(true);
    if (!on.ok) return;
    const off = planTour(on.value, false);
    expect(off.ok && off.value.music.plan.tour).toBe(false);
    // Even for somebody who could not plan one.
    const none = planTour(adult('tour-off-none'), false);
    expect(none.ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Lessons                                                                      */
/* -------------------------------------------------------------------------- */

describe('lessons', () => {
  it('begin from seven, one course at a time, and end when stopped', () => {
    const child = life('lessons-child');
    const tooYoung = startMusicLessons({ ...child, player: { ...child.player, age: 6 } });
    expect(!tooYoung.ok && tooYoung.error).toBe('too-young');
    const base = adult('lessons-base');
    const started = startMusicLessons(base);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.state.music.lessons).toEqual({ since: base.player.age, seasons: 0 });
    expect(started.value.state.music.craft).toBe(musicCraftOf(base));
    expect(started.value.entry.text).toBe('Signed up for music lessons.');
    const again = startMusicLessons(started.value.state);
    expect(!again.ok && again.error).toBe('already-taking');
    const stopped = stopMusicLessons(started.value.state);
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.value.state.music.lessons).toBeUndefined();
    expect(stopped.value.entry.text).toBe('Stopped the music lessons.');
    const nothing = stopMusicLessons(base);
    expect(!nothing.ok && nothing.error).toBe('not-taking');
    expect(startMusicLessons({ ...child, player: { ...child.player, age: 7 } }).ok).toBe(true);
  });

  it('are billed to an adult on their own, free to a child and to somebody at home, and the first thing cut in a tight year', () => {
    expect(MUSIC_LESSONS_COST).toBe(2_000);
    const base = withMusic(adult('lessons-bill'), { lessons: { since: 20, seasons: 1 } });
    const own = { ...base, household: { ...base.household, housing: 'ownPlace' as const } };
    const paid = yearOf(own);
    expect(paid.fees).toBe(2_000);
    expect(paid.feeSource).toBe('Music lessons');
    expect(paid.music.lessons).toEqual({ since: 20, seasons: 2 });
    const home = { ...base, household: { ...base.household, housing: 'withFamily' as const } };
    expect(yearOf(home).fees).toBe(0);
    expect(yearOf(home).music.lessons?.seasons).toBe(2);
    // A seventeen-year-old does not pay, even on their own.
    expect(
      runMusicYear({ before: own, education: own.education, age: 17, year: 2040, standard: 60_000 })
        .fees,
    ).toBe(0);
    const tight = runMusicYear({
      before: own,
      education: own.education,
      age: 27,
      year: own.world.year + 1,
      standard: 12_000,
    });
    expect(tight.fees).toBe(0);
    expect(tight.music.lessons).toBeUndefined();
    expect(tight.lines.some((row) => /Let the music lessons go/.test(row.text))).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* A year of releases                                                           */
/* -------------------------------------------------------------------------- */

describe('a year with nothing to do with music', () => {
  it('is an empty year, for somebody who has never been near any of it', () => {
    const base = adult('year-none');
    const result = yearOf(base);
    expect(result).toEqual(emptyMusicYear(base.music));
    expect(result.music).toBe(base.music);
  });

  it('is an empty year for the dead', () => {
    const dead = known({
      ...adult('year-dead'),
      player: { ...adult('year-dead').player, alive: false },
    });
    expect(yearOf(dead)).toEqual(emptyMusicYear(dead.music));
  });
});

describe('the first record', () => {
  const plan = (state: GameState, single = 1): GameState =>
    withMusic(rich(state), { plan: { single, ep: 0, lp: 0, tour: false }, craft: 60 });

  it('brings the first listeners: discovery times what the record was worth, by the draw', () => {
    const base = plan(adult('first-record'));
    const year = base.world.year + 1;
    const q = qualityOf(base, year, 0, 60);
    const out = yearOf(base, base.player.age + 1, year);
    expect(totalReleased(out.music)).toBe(1);
    expect(out.music.released.single).toBe(1);
    const viral = out.lines.some((row) => /took off/.test(row.text));
    const expected = Math.round(
      DISCOVER.single * qualityFactor(q) * (viral ? VIRAL_MULTIPLIER : 1),
    );
    expect(out.fans).toBe(expected);
    expect(out.music.listeners).toBeGreaterThanOrEqual(0);
    expect(out.music.bestQuality).toBe(q);
  });

  it('writes it up as a milestone, with the title, and records the first of each life only', () => {
    const base = plan(adult('first-record'));
    const out = yearOf(base);
    const line = out.lines.find((row) => /^Put out a single/.test(row.text))!;
    expect(line.kind).toBe('milestone');
    expect(RELEASE_TITLES.some((title) => line.text.includes(`"${title}"`))).toBe(true);
    expect(out.records.filter((row) => /Released a first single/.test(row.label))).toHaveLength(1);
    // The second record of a life is not a first.
    const second = yearOf(plan(known(base)));
    expect(second.records.some((row) => /Released a first/.test(row.label))).toBe(false);
    expect(second.lines.find((row) => /^Put out a single/.test(row.text))?.kind).toBe('passive');
  });

  it('costs what recording it costs, on the artist, and takes the plan off the table', () => {
    const base = plan(adult('first-record'), 3);
    const out = yearOf(base);
    expect(out.costs).toBe(3 * DIY_COST.single);
    expect(out.music.plan).toEqual(EMPTY_PLAN);
    expect(out.music.released.single).toBe(3);
  });

  it('is quality from craft, a label’s polish and a draw of twelve either side', () => {
    expect(QUALITY_NOISE).toBe(24);
    const base = plan(adult('first-record'));
    for (const craft of [20, 60, 95]) {
      const ready = withMusic(base, { craft });
      const year = ready.world.year + 1;
      expect(yearOf(ready, ready.player.age + 1, year).music.bestQuality).toBe(
        qualityOf(ready, year, 0, craft),
      );
    }
    // A major label's polish is added.
    const signed = withMusic(base, {
      plan: { single: 0, ep: 0, lp: 0, tour: false },
      deal: deal({ kind: 'major', paid: true }),
    });
    const year = base.world.year + 1;
    const out = yearOf(signed, base.player.age + 1, year);
    const qualities = [0, 1, 2, 3].map((index) =>
      qualityOf(signed, year, index, 60, LABEL_REACH.major.polish),
    );
    expect(out.music.bestQuality).toBe(Math.max(...qualities));
  });

  it('can be counted: nothing released leaves the listeners where retention puts them', () => {
    const base = known(adult('first-quiet'), { listeners: 10_000, catalogue: 15, craft: 100 });
    const out = yearOf(base);
    expect(out.fans).toBe(0);
    const retention = RETAIN_BASE + RETAIN_CATALOGUE * (15 / CATALOGUE_FULL) - IDLE_DECAY;
    expect(out.music.listeners).toBe(Math.round(10_000 * retention));
  });
});

describe('releases and the people who hear them', () => {
  /** A year of one given plan from the same musician, with the draws of a year we know. */
  const run = (patch: Partial<MusicState>, year?: number) => {
    const base = rich(
      known(adult('releases'), { craft: 70, listeners: 1_000, peak: 1_000, ...patch }),
    );
    return { base, out: yearOf(base, base.player.age + 1, year ?? base.world.year + 1) };
  };

  it('are heard by fewer people each time in one year: a year’s work shares one audience', () => {
    expect(SATURATION).toBe(0.85);
    const { base, out } = run({
      plan: { single: 3, ep: 0, lp: 0, tour: false },
      released: { single: 0, ep: 0, lp: 0 },
      catalogue: 0,
      listeners: 0,
      peak: 0,
    });
    const year = base.world.year + 1;
    // A year with no viral release, so the sum is the plain sum.
    const flat = firstYear(year, (candidate) => {
      const draws = [0, 1, 2].map((index) =>
        musUnit(seedOf(base), genOf(base), 'viral', candidate, index),
      );
      return draws.every((draw) => draw > 0.2) ? candidate : undefined;
    });
    const result = yearOf(base, base.player.age + 1, flat);
    const expected = [0, 1, 2].reduce(
      (sum, index) =>
        sum +
        DISCOVER.single * qualityFactor(qualityOf(base, flat, index, 70)) * SATURATION ** index,
      0,
    );
    expect(result.fans).toBe(Math.round(expected));
    expect(out.music.released.single).toBe(3);
  });

  it('bring more for a bigger kind, and more again for the people already listening', () => {
    expect(DISCOVER.lp).toBeGreaterThan(DISCOVER.ep);
    expect(DISCOVER.ep).toBeGreaterThan(DISCOVER.single);
    expect(GROW.lp).toBeGreaterThan(GROW.ep);
    expect(GROW.ep).toBeGreaterThan(GROW.single);
    const base = rich(known(adult('releases-grow'), { craft: 70, listeners: 1_000, peak: 1_000 }));
    const flat = firstYear(base.world.year + 1, (year) =>
      musUnit(seedOf(base), genOf(base), 'viral', year, 0) > 0.2 ? year : undefined,
    );
    const q = qualityOf(base, flat, 0, 70);
    const out = yearOf(
      withMusic(base, { plan: { single: 0, ep: 1, lp: 0, tour: false } }),
      base.player.age + 1,
      flat,
    );
    const room = 1 - 1_000 / audienceCeiling(70, musicLuck(seedOf(base), genOf(base)), 1);
    const expected = (DISCOVER.ep + 1_000 * GROW.ep) * qualityFactor(q) * room;
    expect(out.fans).toBe(Math.round(expected));
  });

  it('bring nothing when the record is no good, and a good one holds on to the ceiling', () => {
    const { out } = run({
      craft: 5,
      bestQuality: 0,
      plan: { single: 1, ep: 0, lp: 0, tour: false },
    });
    expect(out.music.bestQuality).toBeLessThan(35 + QUALITY_NOISE / 2);
    expect(out.fans).toBe(0);
  });

  it('slow as the audience nears what the work can hold, to nothing at the ceiling, and a viral one goes through it', () => {
    const base = rich(
      known(adult('releases-ceiling'), {
        craft: 70,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const ceiling = audienceCeiling(70, musicLuck(seedOf(base), genOf(base)), 1);
    const year = firstYear(base.world.year + 1, (candidate) =>
      musUnit(seedOf(base), genOf(base), 'viral', candidate, 0) > 0.3 ? candidate : undefined,
    );
    const q = qualityOf(base, year, 0, 70);
    expect(q).toBeGreaterThan(36);
    const half = withMusic(base, {
      listeners: Math.round(ceiling / 2),
      peak: Math.round(ceiling / 2),
    });
    const roomy = yearOf(half, base.player.age + 1, year);
    const expected =
      (DISCOVER.single + Math.round(ceiling / 2) * GROW.single) * qualityFactor(q) * (1 - 0.5);
    expect(roomy.fans).toBe(Math.round(expected));
    const full = withMusic(base, { listeners: Math.round(ceiling), peak: Math.round(ceiling) });
    expect(yearOf(full, base.player.age + 1, year).fans).toBe(0);
    expect(VIRAL_CEILING).toBe(5);
  });

  it('pull what is above the ceiling back by a quarter of the excess a year', () => {
    expect(OVERSHOOT_FALL).toBe(0.25);
    const base = rich(
      known(adult('releases-over'), {
        craft: 50,
        plan: EMPTY_PLAN,
        released: { single: 20, ep: 0, lp: 0 },
        catalogue: 30,
      }),
    );
    const ceiling = audienceCeiling(50, musicLuck(seedOf(base), genOf(base)), 1);
    const above = Math.round(ceiling * 10);
    const out = yearOf(
      withMusic(base, { listeners: above, peak: above }),
      base.player.age + 1,
      base.world.year + 1,
    );
    const retained = above * (RETAIN_BASE + RETAIN_CATALOGUE * 1 - IDLE_DECAY);
    const expected = retained - (retained - ceiling) * OVERSHOOT_FALL;
    expect(out.music.listeners).toBe(Math.round(expected));
  });

  it('are hits at the rung’s line and flops far under it, with a name for the one and a cost to it for the other', () => {
    expect(MUSIC_FLOP_MARGIN).toBe(25);
    expect(HIT_LINE).toEqual({
      local: 58,
      club: 62,
      regional: 68,
      national: 74,
      headliner: 80,
      superstar: 86,
    });
    expect(MUSIC_HIT_REPUTATION).toBe(3);
    expect(MUSIC_FLOP_REPUTATION).toBe(3);
    const strong = rich(
      known(adult('releases-hit'), {
        craft: 100,
        reputation: 10,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const year = strong.world.year + 1;
    const q = qualityOf(strong, year, 0, 100);
    expect(q).toBeGreaterThanOrEqual(HIT_LINE.club);
    const hit = yearOf(strong, strong.player.age + 1, year);
    // The listeners are 3,000: the club rung. A hit adds the rung's reputation and three.
    expect(hit.music.reputation).toBe(10 + MUSIC_TIER_ROWS.club.reputation + MUSIC_HIT_REPUTATION);
    const weak = withMusic(strong, { craft: 20 });
    const weakQ = qualityOf(weak, year, 0, 20);
    expect(weakQ).toBeLessThan(HIT_LINE.club - MUSIC_FLOP_MARGIN);
    const flop = yearOf(weak, weak.player.age + 1, year);
    expect(flop.music.reputation).toBe(10 - MUSIC_FLOP_REPUTATION);
  });

  it('a middling record does nothing to a name', () => {
    const base = rich(
      known(adult('releases-mid'), {
        craft: 50,
        reputation: 10,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const year = firstYear(base.world.year + 1, (candidate) => {
      const q = qualityOf(base, candidate, 0, 50);
      return q >= HIT_LINE.club - MUSIC_FLOP_MARGIN && q < HIT_LINE.club ? candidate : undefined;
    });
    expect(yearOf(base, base.player.age + 1, year).music.reputation).toBe(10);
  });

  it('leave a back catalogue that is worth what each release was, by its kind, and that keeps people listening', () => {
    expect(CATALOGUE_WEIGHT).toEqual({ single: 1, ep: 3, lp: 6 });
    const base = rich(
      known(adult('releases-catalogue'), {
        craft: 70,
        catalogue: 2,
        plan: { single: 1, ep: 1, lp: 0, tour: false },
      }),
    );
    const year = base.world.year + 1;
    const out = yearOf(base, base.player.age + 1, year);
    const expected =
      2 +
      qualityFactor(qualityOf(base, year, 1, 70)) * CATALOGUE_WEIGHT.single +
      qualityFactor(qualityOf(base, year, 0, 70)) * CATALOGUE_WEIGHT.ep;
    expect(out.music.catalogue).toBeCloseTo(expected, 8);
  });

  it('keep more of the listeners the bigger the catalogue is, up to a full catalogue', () => {
    const { out: small } = run({ plan: EMPTY_PLAN, catalogue: 0 });
    const { out: half } = run({ plan: EMPTY_PLAN, catalogue: 15 });
    const { out: full } = run({ plan: EMPTY_PLAN, catalogue: 30 });
    const { out: huge } = run({ plan: EMPTY_PLAN, catalogue: 300 });
    expect(half.music.listeners).toBeGreaterThan(small.music.listeners);
    expect(full.music.listeners).toBeGreaterThan(half.music.listeners);
    expect(huge.music.listeners).toBe(full.music.listeners);
    expect(RETAIN_BASE).toBe(0.86);
    expect(RETAIN_CATALOGUE).toBe(0.1);
    expect(CATALOGUE_FULL).toBe(30);
    expect(full.music.listeners).toBe(
      Math.round(1_000 * (RETAIN_BASE + RETAIN_CATALOGUE - IDLE_DECAY)),
    );
  });

  it('are not made by a child under twelve, however many are planned, and a plan is not kept for a later year', () => {
    const child = withMusic(life('releases-child'), {
      plan: { single: 3, ep: 0, lp: 0, tour: false },
      craft: 60,
    });
    const out = runMusicYear({
      before: rich(child),
      education: child.education,
      age: 11,
      year: 2030,
      standard: 60_000,
    });
    expect(totalReleased(out.music)).toBe(0);
    expect(out.lines.some((row) => /Couldn't get 3 releases out/.test(row.text))).toBe(true);
    expect(out.music.plan).toEqual(EMPTY_PLAN);
  });

  it('are dropped, with a line, when there is no money to record them', () => {
    const poor = rich(
      known(adult('releases-poor'), { plan: { single: 3, ep: 0, lp: 0, tour: false } }),
      700,
    );
    const out = yearOf(poor);
    expect(out.music.released.single).toBe(known(adult('releases-poor')).music.released.single + 2);
    expect(out.costs).toBe(600);
    expect(out.lines.some((row) => /Couldn't get a single out/.test(row.text))).toBe(true);
    const none = yearOf(
      rich(known(adult('releases-poor'), { plan: { single: 2, ep: 0, lp: 0, tour: false } }), 100),
    );
    expect(none.lines.some((row) => /Couldn't get 2 releases out/.test(row.text))).toBe(true);
    expect(none.costs).toBe(0);
  });

  it('fit the weeks of the year, the biggest first, and the last ones that do not fit are dropped with a line', () => {
    const base = rich(
      known(adult('releases-weeks'), {
        plan: { single: 4, ep: 3, lp: 2, tour: false },
        released: { single: 0, ep: 0, lp: 0 },
      }),
    );
    const out = yearOf(base);
    expect(out.music.released).toEqual({ single: 3, ep: 3, lp: 2 });
    expect(out.costs).toBe(3 * DIY_COST.single + 3 * DIY_COST.ep + 2 * DIY_COST.lp);
    expect(out.lines.some((row) => /Couldn't get a single out/.test(row.text))).toBe(true);
    // A year that is exactly full is full, and fits (3 singles, 3 EPs and 2 albums are fifty-two weeks).
    const exact = yearOf(withMusic(base, { plan: { single: 3, ep: 3, lp: 2, tour: false } }));
    expect(exact.music.released).toEqual({ single: 3, ep: 3, lp: 2 });
    expect(exact.lines.some((row) => /Couldn't get/.test(row.text))).toBe(false);
  });

  it('are paid for to the last dollar the artist has, and not one more', () => {
    const base = known(adult('releases-cash'), {
      plan: { single: 1, ep: 0, lp: 0, tour: false },
      released: { single: 0, ep: 0, lp: 0 },
    });
    const exact = yearOf(rich(base, 300));
    expect(exact.music.released.single).toBe(1);
    expect(exact.costs).toBe(300);
    const short = yearOf(rich(base, 299));
    expect(short.music.released.single).toBe(0);
    // Two singles at three hundred and one dollar short of the second.
    const two = yearOf(
      rich(withMusic(base, { plan: { single: 2, ep: 0, lp: 0, tour: false } }), 599),
    );
    expect(two.music.released.single).toBe(1);
  });

  it('go viral by a draw that is likelier for a better record, and reach eight times as many people', () => {
    expect(VIRAL_BASE).toBe(0.015);
    expect(VIRAL_PER_POINT).toBe(0.0012);
    expect(VIRAL_FROM).toBe(70);
    expect(VIRAL_MULTIPLIER).toBe(8);
    const base = rich(
      known(adult('releases-viral'), {
        craft: 90,
        listeners: 500,
        peak: 500,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const year = firstYear(base.world.year + 1, (candidate) => {
      const q = qualityOf(base, candidate, 0, 90);
      const draw = musUnit(seedOf(base), genOf(base), 'viral', candidate, 0);
      return q > 80 && draw < VIRAL_BASE + (q - VIRAL_FROM) * VIRAL_PER_POINT
        ? candidate
        : undefined;
    });
    const out = yearOf(base, base.player.age + 1, year);
    const q = qualityOf(base, year, 0, 90);
    expect(out.lines.some((row) => /took off/.test(row.text))).toBe(true);
    expect(out.lines.find((row) => /took off/.test(row.text))!.kind).toBe('milestone');
    expect(out.records.some((row) => /went viral/.test(row.label))).toBe(true);
    const ceiling = audienceCeiling(90, musicLuck(seedOf(base), genOf(base)), 1);
    const room = Math.max(0, 1 - 500 / (ceiling * VIRAL_CEILING));
    expect(out.fans).toBe(
      Math.round(
        (DISCOVER.single + 500 * GROW.single) * qualityFactor(q) * room * VIRAL_MULTIPLIER,
      ),
    );
    expect(out.mood).toBeGreaterThanOrEqual(3);
    // The same year without the draw is not viral.
    const calm = firstYear(base.world.year + 1, (candidate) =>
      musUnit(seedOf(base), genOf(base), 'viral', candidate, 0) > 0.5 ? candidate : undefined,
    );
    expect(
      yearOf(base, base.player.age + 1, calm).lines.some((row) => /took off/.test(row.text)),
    ).toBe(false);
  });

  it('never go viral if they are poor, whatever the draw', () => {
    const base = rich(
      known(adult('releases-viral-poor'), {
        craft: 20,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    for (let year = base.world.year + 1; year < base.world.year + 600; year += 1) {
      const q = qualityOf(base, year, 0, 20);
      if (q > 40) continue;
      expect(
        yearOf(base, base.player.age + 1, year).lines.some((row) => /took off/.test(row.text)),
      ).toBe(false);
    }
  });

  it('pick a title that has not been used that year, and write what came of the best of them', () => {
    const base = rich(
      known(adult('releases-titles'), {
        craft: 80,
        plan: { single: 12, ep: 0, lp: 0, tour: false },
      }),
    );
    for (let year = base.world.year + 1; year < base.world.year + 8; year += 1) {
      const out = yearOf(base, base.player.age + 1, year);
      const line = out.lines.find((row) => /^Put out 12 singles/.test(row.text));
      expect(line).toBeDefined();
    }
    const one = yearOf(withMusic(base, { plan: { single: 1, ep: 1, lp: 1, tour: false } }));
    expect(one.lines.some((row) => /^Put out a single, an EP and an album\./.test(row.text))).toBe(
      true,
    );
  });

  it('are named in the words of the kind: two kinds, three kinds, and plural', () => {
    const base = rich(known(adult('releases-words'), { craft: 80 }));
    const two = yearOf(withMusic(base, { plan: { single: 2, ep: 1, lp: 0, tour: false } }));
    expect(two.lines.some((row) => /^Put out 2 singles and an EP\./.test(row.text))).toBe(true);
    const lps = yearOf(withMusic(base, { plan: { single: 0, ep: 0, lp: 2, tour: false } }));
    expect(lps.lines.some((row) => /^Put out 2 albums\./.test(row.text))).toBe(true);
  });

  it('say how it went, from the best of them: hardly anybody, a few, or did well', () => {
    const base = rich(
      known(adult('releases-verdict'), {
        craft: 15,
        plan: { single: 2, ep: 0, lp: 0, tour: false },
      }),
    );
    const bad = firstYear(base.world.year + 1, (year) => {
      const qs = [0, 1].map((index) => qualityOf(base, year, index, 15));
      return qs.every((q) => q < HIT_LINE.club - MUSIC_FLOP_MARGIN) ? year : undefined;
    });
    expect(
      yearOf(base, base.player.age + 1, bad).lines.some((row) =>
        /Hardly anybody listened/.test(row.text),
      ),
    ).toBe(true);
    const good = rich(
      known(adult('releases-verdict'), {
        craft: 100,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const year = firstYear(good.world.year + 1, (candidate) =>
      musUnit(seedOf(good), genOf(good), 'viral', candidate, 0) > 0.5 ? candidate : undefined,
    );
    expect(
      yearOf(good, good.player.age + 1, year).lines.some((row) => /did well/.test(row.text)),
    ).toBe(true);
    const middling = rich(
      known(adult('releases-verdict'), {
        craft: 50,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const mid = firstYear(middling.world.year + 1, (candidate) => {
      const q = qualityOf(middling, candidate, 0, 50);
      return q >= HIT_LINE.club - MUSIC_FLOP_MARGIN &&
        q < HIT_LINE.club &&
        musUnit(seedOf(middling), genOf(middling), 'viral', candidate, 0) > 0.5
        ? candidate
        : undefined;
    });
    expect(
      yearOf(middling, middling.player.age + 1, mid).lines.some((row) =>
        /found a few listeners/.test(row.text),
      ),
    ).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* A quiet year                                                                 */
/* -------------------------------------------------------------------------- */

describe('a year with nothing new in it', () => {
  const quiet = (patch: Partial<MusicState> = {}) =>
    rich(
      known(adult('quiet'), {
        craft: 100,
        listeners: 20_000,
        catalogue: 10,
        reputation: 20,
        ...patch,
      }),
    );

  it('takes seven points more of the listeners, counts as idle, and costs two points of a name', () => {
    expect(IDLE_DECAY).toBe(0.07);
    expect(MUSIC_IDLE_REPUTATION).toBe(2);
    const out = yearOf(quiet());
    expect(out.music.idle).toBe(1);
    expect(out.music.reputation).toBe(18);
    expect(out.music.listeners).toBe(
      Math.round(20_000 * (RETAIN_BASE + RETAIN_CATALOGUE * (10 / 30) - IDLE_DECAY)),
    );
    expect(out.lines.some((row) => /A quiet year in music/.test(row.text))).toBe(true);
  });

  it('says so the first quiet year only, and counts on', () => {
    const second = yearOf(quiet({ idle: 1 }));
    expect(second.music.idle).toBe(2);
    expect(second.lines.some((row) => /A quiet year in music/.test(row.text))).toBe(false);
  });

  it('is not a quiet year for somebody who put something out or toured, and resets the count', () => {
    const released = yearOf(
      withMusic(quiet({ idle: 2 }), { plan: { single: 1, ep: 0, lp: 0, tour: false } }),
    );
    expect(released.music.idle).toBe(0);
    expect(released.music.listeners).toBeGreaterThan(
      Math.round(20_000 * (RETAIN_BASE + RETAIN_CATALOGUE * (10 / 30) - IDLE_DECAY)),
    );
    const toured = yearOf(
      withMusic(quiet({ idle: 2 }), { plan: { single: 0, ep: 0, lp: 0, tour: true } }),
    );
    expect(toured.music.idle).toBe(0);
  });

  it('is a year all the same for somebody who has only ever had craft: it drifts toward what they are', () => {
    const natural = musicCraftOf(adult('quiet-craft'));
    const base = rich(withMusic(adult('quiet-craft'), { craft: natural + 20 }));
    const out = yearOf(base);
    expect(out.music.craft).toBe(Math.round(natural + 20 + (natural - (natural + 20)) * 0.1));
  });

  it('is nothing at all for somebody who has put nothing out, and loses no name', () => {
    const base = rich(withMusic(adult('quiet-never'), { craft: 60, reputation: 20 }));
    const out = yearOf(base);
    expect(out.music.idle).toBe(0);
    expect(out.music.reputation).toBe(20);
    expect(out.music.listeners).toBe(0);
  });

  it('puts the fame out after three quiet years, and halves it before', () => {
    const base = quiet({ listeners: 400_000, peak: 400_000, idle: 0 });
    const one = yearOf(base);
    expect(one.fame).toBeGreaterThan(0);
    const three = yearOf({ ...base, music: { ...base.music, idle: 2 } });
    expect(three.music.idle).toBe(3);
    expect(three.fame).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* The rungs, rising and falling                                                */
/* -------------------------------------------------------------------------- */

describe('rising and falling', () => {
  it('writes a line for a rung climbed, and a record from the regional rung up', () => {
    const base = rich(
      known(adult('rise'), {
        craft: 90,
        listeners: 24_000,
        peak: 24_000,
        released: { single: 10, ep: 3, lp: 1 },
        catalogue: 30,
        plan: { single: 6, ep: 1, lp: 0, tour: false },
      }),
    );
    const year = firstYear(
      base.world.year + 1,
      (candidate) => {
        const out = yearOf(base, base.player.age + 1, candidate);
        return tierFor(out.music.listeners) === 'regional' ? out : undefined;
      },
      600,
    );
    expect(
      year.lines.some((row) => row.text === MUSIC_RISE_LINES.regional && row.kind === 'milestone'),
    ).toBe(true);
    expect(year.records.some((row) => row.label === 'Became a regional act')).toBe(true);
    expect(year.mood).toBeGreaterThanOrEqual(3);
    expect(year.music.best).toBe('regional');
  });

  it('writes no record for a climb to the club circuit, and a line all the same', () => {
    const base = rich(
      known(adult('rise-club'), {
        craft: 85,
        listeners: 1_900,
        peak: 1_900,
        released: { single: 3, ep: 0, lp: 0 },
        catalogue: 5,
        plan: { single: 6, ep: 1, lp: 0, tour: false },
      }),
    );
    const out = firstYear(
      base.world.year + 1,
      (candidate) => {
        const result = yearOf(base, base.player.age + 1, candidate);
        return tierFor(result.music.listeners) === 'club' ? result : undefined;
      },
      600,
    );
    expect(out.lines.some((row) => row.text === MUSIC_RISE_LINES.club)).toBe(true);
    expect(out.records.some((row) => /Became a/.test(row.label))).toBe(false);
  });

  it('says so when the audience thins out to a lower rung, and keeps the best rung reached', () => {
    const base = rich(
      known(adult('fall'), {
        listeners: 25_500,
        peak: 25_500,
        best: 'regional',
        catalogue: 0,
        plan: EMPTY_PLAN,
      }),
    );
    const out = yearOf(base);
    expect(tierFor(out.music.listeners)).toBe('club');
    expect(out.lines.some((row) => /You're back to club circuit/.test(row.text))).toBe(true);
    expect(out.music.best).toBe('regional');
    expect(out.music.peak).toBe(25_500);
    expect(MUSIC_RISE_LINES.local.length).toBeGreaterThan(10);
  });

  it('leaves no best for somebody who has never been past local, and never lowers it', () => {
    const base = rich(
      known(adult('best'), {
        listeners: 500,
        peak: 500,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    expect(yearOf(base).music.best).toBeUndefined();
    const high = rich(known(adult('best'), { listeners: 500, peak: 500, best: 'national' }));
    expect(yearOf(high).music.best).toBe('national');
  });

  it('keeps the peak at the highest the listeners have been', () => {
    const base = rich(known(adult('peak'), { listeners: 4_000, peak: 9_000 }));
    expect(yearOf(base).music.peak).toBe(9_000);
    const climbing = rich(
      known(adult('peak'), {
        craft: 90,
        listeners: 4_000,
        peak: 4_000,
        plan: { single: 8, ep: 1, lp: 1, tour: false },
      }),
    );
    const out = yearOf(climbing);
    expect(out.music.peak).toBe(Math.max(4_000, out.music.listeners));
  });
});

/* -------------------------------------------------------------------------- */
/* What it pays                                                                 */
/* -------------------------------------------------------------------------- */

describe('what streams pay', () => {
  it('is the streams a listener makes, at four tenths of a cent, less the distributor’s 15%, on the average of the year', () => {
    const base = rich(
      known(adult('pay'), { listeners: 10_000, peak: 10_000, catalogue: 20, craft: 100 }),
    );
    const out = yearOf(base);
    const listeners1 = out.music.listeners;
    const gross = ((10_000 + listeners1) / 2) * STREAMS_PER_LISTENER * STREAM_PAYOUT;
    expect(out.pay).toBe(Math.round(gross * (1 - DISTRIBUTOR_CUT)));
    expect(out.music.lastPay).toBe(out.pay);
    expect(out.repKept).toBe(0);
  });

  it('is nothing for nobody listening', () => {
    const base = rich(
      withMusic(adult('pay-none'), {
        craft: 60,
        released: { single: 1, ep: 0, lp: 0 },
        plan: EMPTY_PLAN,
      }),
    );
    expect(yearOf(base).pay).toBe(0);
  });

  it('is taken by a manager, 15% of everything the music paid, and the same for the manager’s growth', () => {
    expect(MANAGER_CUT).toBe(0.15);
    expect(MANAGER_GROWTH).toBe(1.2);
    const plain = rich(
      known(adult('pay-manager'), { listeners: 40_000, peak: 40_000, catalogue: 20, craft: 100 }),
    );
    const managed = { ...plain, representation: 'manager' as const };
    const a = yearOf(plain);
    const b = yearOf(managed);
    expect(b.music.listeners).toBe(a.music.listeners);
    expect(b.repKept).toBe(Math.round(Math.round(a.pay) * MANAGER_CUT));
    expect(b.pay).toBe(Math.round(a.pay * (1 - MANAGER_CUT)));
    // Growth: twenty percent faster on a year of releases.
    const releasing = withMusic(plain, { plan: { single: 2, ep: 0, lp: 0, tour: false } });
    const year = firstYear(plain.world.year + 1, (candidate) =>
      [0, 1].every((index) => musUnit(seedOf(plain), genOf(plain), 'viral', candidate, index) > 0.4)
        ? candidate
        : undefined,
    );
    const slow = yearOf(releasing, releasing.player.age + 1, year);
    const fast = yearOf(
      { ...releasing, representation: 'manager' as const },
      releasing.player.age + 1,
      year,
    );
    expect(fast.fans).toBe(Math.round(slow.fans * MANAGER_GROWTH));
  });
});

describe('what a label pays', () => {
  const signed = (patch: Partial<LabelDeal> = {}, music: Partial<MusicState> = {}) =>
    rich(
      known(adult('label-pay'), {
        listeners: 8_000,
        peak: 8_000,
        catalogue: 20,
        craft: 100,
        deal: deal(patch),
        ...music,
      }),
    );

  it('is the advance, in the first year only, and none of it again', () => {
    const first = yearOf(signed({ advance: 40_000 }));
    expect(first.pay).toBe(40_000);
    const later = yearOf(signed({ advance: 40_000, paid: true, owed: 40_000 }));
    expect(later.pay).toBe(0);
  });

  it('is owed back: the advance, and what the label spent on its own records, before the artist sees a cent', () => {
    const out = yearOf(signed({ advance: 10_000 }));
    const spent = 2 * LABEL_COST.indie.single + LABEL_COST.indie.ep;
    expect(out.music.released).toEqual({ single: 4 + 2, ep: 1 + 1, lp: 0 });
    const gross = ((8_000 + out.music.listeners) / 2) * STREAMS_PER_LISTENER * STREAM_PAYOUT;
    const pot = gross * 0.4;
    expect(out.music.deal?.owed).toBe(Math.round(10_000 + spent - pot));
    expect(out.music.deal?.paid).toBe(true);
    expect(out.music.deal?.left).toBe(1);
    // The artist paid for none of the recording.
    expect(out.costs).toBe(0);
  });

  it('pays the royalty on what streams earn once the debt is cleared, and only then', () => {
    const clear = yearOf(signed({ paid: true, owed: 0, advance: 10_000 }, { plan: EMPTY_PLAN }));
    // Label-committed records add their cost to the debt first, so a clear book is not clear for long.
    const gross = ((8_000 + clear.music.listeners) / 2) * STREAMS_PER_LISTENER * STREAM_PAYOUT;
    const spent = 2 * LABEL_COST.indie.single + LABEL_COST.indie.ep;
    const pot = gross * 0.4;
    expect(clear.pay).toBe(Math.max(0, Math.round(pot - spent)));
    // With a debt bigger than the pot, nothing comes.
    const owing = yearOf(signed({ paid: true, owed: 900_000 }));
    expect(owing.pay).toBe(0);
    expect(owing.music.deal!.owed).toBeLessThan(900_000 + spent);
  });

  it('gives a major label less of the streaming money than an indie one', () => {
    const rows = [0.18, 0.4];
    const out = rows.map(
      (royalty) =>
        yearOf(
          signed(
            { paid: true, owed: 0, royalty, kind: 'indie' },
            { listeners: 4_000_000, peak: 4_000_000, craft: 70 },
          ),
        ).pay,
    );
    expect(out[1]!).toBeGreaterThan(out[0]!);
  });

  it('puts the label’s own releases in the year whether or not any were planned, and the artist chooses the rest', () => {
    expect(committedReleases({ ...EMPTY_MUSIC })).toEqual({ single: 0, ep: 0, lp: 0 });
    expect(committedReleases({ ...EMPTY_MUSIC, deal: deal() })).toEqual({
      single: 2,
      ep: 1,
      lp: 0,
    });
    expect(committedReleases({ ...EMPTY_MUSIC, deal: deal({ kind: 'major' }) })).toEqual({
      single: 3,
      ep: 0,
      lp: 1,
    });
    const out = yearOf(
      signed({ kind: 'major' }, { plan: { single: 2, ep: 0, lp: 0, tour: false } }),
    );
    expect(out.music.released).toEqual({ single: 4 + 3 + 2, ep: 1, lp: 1 });
    // Only the artist's own two were paid for by the artist.
    expect(out.costs).toBe(2 * DIY_COST.single);
  });

  it('makes the records better, with a major’s polish, and reaches more people', () => {
    const base = signed({ kind: 'indie' }, { plan: EMPTY_PLAN });
    const major = withMusic(base, { deal: deal({ kind: 'major' }) });
    const year = base.world.year + 1;
    const flat = firstYear(year, (candidate) =>
      [0, 1, 2, 3].every(
        (index) => musUnit(seedOf(base), genOf(base), 'viral', candidate, index) > 0.4,
      )
        ? candidate
        : undefined,
    );
    const a = yearOf(base, base.player.age + 1, flat);
    const b = yearOf(major, base.player.age + 1, flat);
    expect(b.fans).toBeGreaterThan(a.fans);
  });

  it('ends when its term is up, with a line, wipes what was still owed, and gives the records back', () => {
    const last = yearOf(signed({ left: 1, paid: true, owed: 50_000 }));
    expect(last.music.deal).toBeUndefined();
    expect(
      last.lines.some(
        (row) =>
          /The deal with Porchlight Records ran out/.test(row.text) && row.kind === 'milestone',
      ),
    ).toBe(true);
    const running = yearOf(signed({ left: 2, paid: true, owed: 50_000 }));
    expect(running.music.deal?.left).toBe(1);
  });

  it('puts no more than the one label on an artist, and calls nobody who is signed', () => {
    const out = yearOf(signed());
    expect(out.music.offer).toBeUndefined();
  });

  it('is taken an agent’s tenth of, and is the artist’s own after the term', () => {
    const plain = yearOf(signed({ advance: 100_000 }));
    const agented = yearOf({ ...signed({ advance: 100_000 }), representation: 'agent' as const });
    expect(REP_AGENT_CUT).toBe(0.1);
    expect(agented.pay).toBe(Math.round(100_000 - 10_000));
    expect(plain.pay).toBe(100_000);
    expect(agented.repKept).toBe(10_000);
  });
});

describe('the road', () => {
  const touring = (patch: Partial<MusicState> = {}) =>
    rich(
      known(adult('road'), {
        listeners: 20_000,
        peak: 20_000,
        craft: 70,
        catalogue: 30,
        plan: { single: 0, ep: 0, lp: 0, tour: true },
        ...patch,
      }),
    );

  it('goes out in the year planned, pays the door less the night costs, and says what it cleared', () => {
    const base = touring();
    const out = yearOf(base);
    const plan = tourFor('club', 20_000, 70);
    const net = plan.door - plan.costs;
    expect(net).toBeGreaterThan(0);
    const gross = ((20_000 + out.music.listeners) / 2) * STREAMS_PER_LISTENER * STREAM_PAYOUT;
    expect(out.pay).toBe(Math.round(gross * 0.85 + net));
    expect(
      out.lines.some(
        (row) =>
          row.text ===
          `Toured: ${plan.shows} shows in clubs. It cleared $${net.toLocaleString('en-US')} after the road took its share.`,
      ),
    ).toBe(true);
    expect(out.music.tours).toBe(1);
    expect(out.music.idle).toBe(0);
  });

  it('brings a tenth of the tickets sold as new listeners', () => {
    const out = yearOf(touring());
    const plan = tourFor('club', 20_000, 70);
    expect(out.fans).toBe(Math.round(plan.tickets * TOUR_FANS));
  });

  it('costs the artist when it loses, and says so, with none of it counted as pay', () => {
    const base = touring({ listeners: 600, peak: 600, catalogue: 0, craft: 50 });
    const plan = tourFor('local', 600, 50);
    expect(plan.door - plan.costs).toBeLessThan(0);
    const out = yearOf(base);
    expect(out.costs).toBe(plan.costs - plan.door);
    expect(out.lines.some((row) => /It lost \$/.test(row.text))).toBe(true);
  });

  it('takes an agent’s tenth of the door, and a manager’s share of what is left', () => {
    const plain = yearOf(touring());
    const agented = yearOf({ ...touring(), representation: 'agent' as const });
    const plan = tourFor('club', 20_000, 70);
    expect(agented.repKept).toBe(Math.round(plan.door * REP_AGENT_CUT));
    expect(agented.pay).toBe(plain.pay - Math.round(plan.door * REP_AGENT_CUT));
    const managed = yearOf({ ...touring(), representation: 'manager' as const });
    expect(managed.pay).toBe(Math.round(plain.pay * (1 - MANAGER_CUT)));
  });

  it('takes the quality of the year’s records to the rooms: a better record, more tickets', () => {
    const poor = touring({
      craft: 20,
      listeners: 100_000,
      peak: 100_000,
      plan: { single: 1, ep: 0, lp: 0, tour: true },
    });
    const good = touring({
      craft: 100,
      listeners: 100_000,
      peak: 100_000,
      plan: { single: 1, ep: 0, lp: 0, tour: true },
    });
    const year = poor.world.year + 1;
    const a = yearOf(poor, poor.player.age + 1, year);
    const b = yearOf(good, good.player.age + 1, year);
    expect(b.pay).toBeGreaterThan(a.pay);
  });

  it('does not happen for a child, or without an audience, or without the weeks, and says so', () => {
    const child = withMusic(life('road-child'), {
      craft: 50,
      listeners: 5_000,
      peak: 5_000,
      plan: { single: 0, ep: 0, lp: 0, tour: true },
      released: { single: 1, ep: 0, lp: 0 },
    });
    const a = runMusicYear({
      before: rich(child),
      education: child.education,
      age: 15,
      year: 2030,
      standard: 60_000,
    });
    expect(a.music.tours).toBe(0);
    expect(a.lines.some((row) => /The tour didn't happen/.test(row.text))).toBe(true);
    const nobody = yearOf(touring({ listeners: 100, peak: 100 }));
    expect(nobody.music.tours).toBe(0);
    expect(nobody.lines.some((row) => /The tour didn't happen/.test(row.text))).toBe(true);
    const crowded = yearOf(
      touring({
        plan: { single: 0, ep: 3, lp: 2, tour: true },
        released: { single: 0, ep: 0, lp: 0 },
      }),
    );
    const weeks = tourFor('club', 20_000, 70).weeks;
    expect(3 * 6 + 2 * 14 + weeks).toBeLessThanOrEqual(YEAR_WEEKS);
    expect(crowded.music.tours).toBe(1);
    const full = yearOf(
      touring({
        plan: { single: 3, ep: 3, lp: 2, tour: true },
        released: { single: 0, ep: 0, lp: 0 },
      }),
    );
    expect(full.music.tours).toBe(0);
  });

  it('adds a point of a name', () => {
    const out = yearOf(touring({ reputation: 10 }));
    expect(out.music.reputation).toBe(11);
  });
});

describe('an award', () => {
  const strong = (tier: MusicTier, patch: Partial<MusicState> = {}) =>
    rich(
      known(adult('award'), {
        craft: 100,
        listeners: Math.round(MUSIC_TIER_ROWS[tier].listeners * 1.5),
        peak: Math.round(MUSIC_TIER_ROWS[tier].listeners * 1.5),
        reputation: 10,
        catalogue: 30,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
        ...patch,
      }),
    );

  it('is won by a record that is good enough, from the national rung, by a draw, with a record, a name and a mood', () => {
    expect(MUSIC_AWARD_LINE).toBe(82);
    const base = strong('national');
    const found = firstYear(
      base.world.year + 1,
      (year) => {
        const q = qualityOf(base, year, 0, 100);
        if (q < MUSIC_AWARD_LINE) return undefined;
        if (
          musUnit(seedOf(base), genOf(base), 'award', year) >= MUSIC_TIER_ROWS.national.awardChance
        )
          return undefined;
        return year;
      },
      600,
    );
    const out = yearOf(base, base.player.age + 1, found);
    expect(out.music.awards).toBe(1);
    const line = out.lines.find((row) => /Won Song of the Year/.test(row.text))!;
    expect(line.kind).toBe('milestone');
    expect(line.text).toMatch(/at the Silverline Music Awards/);
    expect(
      out.records.some(
        (row) =>
          row.category === 'award' &&
          row.label === `Song of the Year, the Silverline Music Awards, ${found}`,
      ),
    ).toBe(true);
    const hit = qualityOf(base, found, 0, 100) >= HIT_LINE.national;
    const viral = out.lines.some((row) => /took off/.test(row.text));
    expect(tierFor(out.music.listeners)).toBe('national');
    expect(out.mood).toBe(6 + (hit ? 1 : 0) + (viral ? 3 : 0));
    expect(out.music.reputation).toBe(10 + 8 + (hit ? MUSIC_TIER_ROWS.national.reputation + 3 : 0));
  });

  it('is never won from a rung below the national, however good the record', () => {
    const base = strong('regional');
    for (let year = base.world.year + 1; year < base.world.year + 150; year += 1) {
      expect(yearOf(base, base.player.age + 1, year).music.awards, String(year)).toBe(0);
    }
  });

  it('is never won with a record under the line', () => {
    const base = strong('national', { craft: 60 });
    for (let year = base.world.year + 1; year < base.world.year + 150; year += 1) {
      const q = qualityOf(base, year, 0, 60);
      if (q >= MUSIC_AWARD_LINE) continue;
      expect(yearOf(base, base.player.age + 1, year).music.awards, String(year)).toBe(0);
    }
  });

  it('is named for the kind of record: an EP, an album', () => {
    const base = strong('headliner', { plan: { single: 0, ep: 0, lp: 1, tour: false } });
    const found = firstYear(
      base.world.year + 1,
      (year) => {
        const q = qualityOf(base, year, 0, 100);
        return q >= MUSIC_AWARD_LINE &&
          musUnit(seedOf(base), genOf(base), 'award', year) < MUSIC_TIER_ROWS.headliner.awardChance
          ? year
          : undefined;
      },
      600,
    );
    expect(
      yearOf(base, base.player.age + 1, found).lines.some((row) =>
        /Won Album of the Year/.test(row.text),
      ),
    ).toBe(true);
    const ep = withMusic(base, { plan: { single: 0, ep: 1, lp: 0, tour: false } });
    const epYear = firstYear(
      base.world.year + 1,
      (year) => {
        const q = qualityOf(ep, year, 0, 100);
        return q >= MUSIC_AWARD_LINE &&
          musUnit(seedOf(ep), genOf(ep), 'award', year) < MUSIC_TIER_ROWS.headliner.awardChance
          ? year
          : undefined;
      },
      600,
    );
    expect(
      yearOf(ep, ep.player.age + 1, epYear).lines.some((row) => /Won Best EP/.test(row.text)),
    ).toBe(true);
  });
});

describe('fame', () => {
  it('is held at the rung while there is work, and out of it when the work stops', () => {
    const base = rich(
      known(adult('fame'), {
        listeners: 400_000,
        peak: 400_000,
        catalogue: 30,
        reputation: 40,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const out = yearOf(base);
    expect(out.fame).toBe(
      musicFameOf({
        tier: tierFor(out.music.listeners),
        reputation: out.music.reputation,
        awards: 0,
        idle: 0,
      }),
    );
    expect(out.fame).toBeGreaterThan(20);
    const idle = yearOf(withMusic(base, { idle: 2, plan: EMPTY_PLAN }));
    expect(idle.fame).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Craft                                                                        */
/* -------------------------------------------------------------------------- */

describe('what a year does to craft', () => {
  const base = adult('craft-year');
  const natural = musicCraft(base.player.stats, base.player.talents.music);

  it('is pulled up by a third of the gap and down by a tenth', () => {
    const music = { ...EMPTY_MUSIC };
    expect(nextMusicCraft(base, music, false, natural - 15)).toBe(
      Math.round(natural - 15 + 15 * 0.35),
    );
    expect(nextMusicCraft(base, music, false, natural + 8)).toBe(Math.round(natural + 8 - 8 * 0.1));
  });

  it('is helped by every release, a tenth of a point, and by a stage, and not past a cap', () => {
    expect(MUSIC_RELEASE_CRAFT).toBe(0.1);
    expect(MUSIC_RELEASE_CRAFT_CAP).toBe(6);
    expect(MUSIC_STAGE_CRAFT).toBe(3);
    const lots = { ...EMPTY_MUSIC, released: { single: 30, ep: 30, lp: 30 } };
    expect(nextMusicCraft(base, lots, false, 0)).toBe(Math.round(0 + (natural + 6) * 0.35));
    expect(nextMusicCraft(base, lots, true, 0)).toBe(Math.round(0 + (natural + 6 + 3) * 0.35));
    const few = { ...EMPTY_MUSIC, released: { single: 20, ep: 0, lp: 0 } };
    expect(nextMusicCraft(base, few, false, 0)).toBe(Math.round((natural + 2) * 0.35));
    expect(MUSIC_RELEASE_CRAFT_CAP + MUSIC_STAGE_CRAFT).toBeLessThan(MUSIC_HEADROOM);
  });

  it('is helped by lessons by four, and stays inside what the character can reach', () => {
    const lessons = { ...EMPTY_MUSIC, lessons: { since: 20, seasons: 1 } };
    expect(nextMusicCraft(base, lessons, false, 0)).toBe(Math.round((natural + 4) * 0.35));
    const crafted = withMusic(base, { craft: natural, lessons: { since: 20, seasons: 1 } });
    let state = crafted;
    for (let index = 0; index < 20; index += 1) {
      state = withMusic(state, { released: { single: 40, ep: 0, lp: 0 } });
      state = withMusic(state, {
        craft: nextMusicCraft(state, state.music, true, state.music.craft!),
      });
    }
    expect(state.music.craft!).toBeLessThanOrEqual(musicCraftCeiling(state));
  });

  it('is kept by the year, only for somebody who was in it', () => {
    const none = yearOf(base);
    expect(none.music.craft).toBeUndefined();
    const started = yearOf(
      withMusic(rich(base), { plan: { single: 1, ep: 0, lp: 0, tour: false } }),
    );
    expect(started.music.craft).toBeDefined();
  });

  it('counts a school band or a town choir as a stage year and as being heard', () => {
    const joined = { ...base, education: join(base.education, 'act.band', base.player.age) };
    const out = yearOf(joined);
    expect(out.music.stageYears).toBe(1);
    expect(out.music.craft).toBeDefined();
    expect(out.music.listeners).toBe(0);
    const choir = { ...base, education: join(base.education, 'act.choir', base.player.age) };
    expect(yearOf(choir).music.stageYears).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Labels: a call, a demo, a deal                                               */
/* -------------------------------------------------------------------------- */

describe('a label calls', () => {
  const noticed = (tier: MusicTier, patch: Partial<MusicState> = {}) =>
    rich(
      known(adult('call'), {
        craft: 100,
        listeners: Math.round(MUSIC_TIER_ROWS[tier].listeners * 1.5) + 100,
        peak: Math.round(MUSIC_TIER_ROWS[tier].listeners * 1.5) + 100,
        catalogue: 30,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
        ...patch,
      }),
    );

  it('by a draw that is the rung’s chance, and puts the deal on the table with a line', () => {
    const base = noticed('club');
    const year = firstYear(base.world.year + 1, (candidate) =>
      musUnit(seedOf(base), genOf(base), 'call', candidate) < MUSIC_TIER_ROWS.club.labelChance
        ? candidate
        : undefined,
    );
    const out = yearOf(base, base.player.age + 1, year);
    expect(out.music.offer).toBeDefined();
    expect(out.music.offer?.source).toBe('called');
    expect(out.music.offer?.id).toBe(`lbl:${base.player.age + 1}`);
    expect(
      out.lines.some(
        (row) =>
          row.text === `${out.music.offer!.label} has been listening. There's a deal on the table.`,
      ),
    ).toBe(true);
    const missed = firstYear(base.world.year + 1, (candidate) =>
      musUnit(seedOf(base), genOf(base), 'call', candidate) >=
      MUSIC_TIER_ROWS.club.labelChance + 0.05
        ? candidate
        : undefined,
    );
    expect(yearOf(base, base.player.age + 1, missed).music.offer).toBeUndefined();
  });

  it('never at the local rung, whatever the draw, and never for somebody with nothing out', () => {
    const local = noticed('local', { listeners: 500, peak: 500, plan: EMPTY_PLAN });
    for (let year = local.world.year + 1; year < local.world.year + 120; year += 1) {
      expect(yearOf(local, local.player.age + 1, year).music.offer, String(year)).toBeUndefined();
    }
    const nothing = noticed('club', { released: { single: 0, ep: 0, lp: 0 }, plan: EMPTY_PLAN });
    for (let year = nothing.world.year + 1; year < nothing.world.year + 120; year += 1) {
      expect(
        yearOf(nothing, nothing.player.age + 1, year).music.offer,
        String(year),
      ).toBeUndefined();
    }
  });

  it('never for somebody whose craft is under the label’s line', () => {
    const base = noticed('club', { craft: 10 });
    const draws = firstYear(base.world.year + 1, (candidate) =>
      musUnit(seedOf(base), genOf(base), 'call', candidate) < 0.01 ? candidate : undefined,
    );
    expect(yearOf(base, base.player.age + 1, draws).music.offer).toBeUndefined();
  });

  it('half as often in a year with nothing new out, and a third more often with an agent', () => {
    const quiet = noticed('regional', { plan: EMPTY_PLAN });
    const chance = MUSIC_TIER_ROWS.regional.labelChance;
    const inHalf = firstYear(quiet.world.year + 1, (candidate) => {
      const draw = musUnit(seedOf(quiet), genOf(quiet), 'call', candidate);
      return draw >= chance * 0.5 && draw < chance ? candidate : undefined;
    });
    expect(yearOf(quiet, quiet.player.age + 1, inHalf).music.offer).toBeUndefined();
    const busy = noticed('regional');
    expect(yearOf(busy, busy.player.age + 1, inHalf).music.offer).toBeDefined();
    const agented = { ...quiet, representation: 'agent' as const };
    const boosted = firstYear(quiet.world.year + 1, (candidate) => {
      const draw = musUnit(seedOf(quiet), genOf(quiet), 'call', candidate);
      return draw >= chance * 0.5 && draw < chance * 0.5 * 1.3 ? candidate : undefined;
    });
    expect(yearOf(quiet, quiet.player.age + 1, boosted).music.offer).toBeUndefined();
    expect(yearOf(agented, quiet.player.age + 1, boosted).music.offer).toBeDefined();
  });

  it('is an indie label at the club rung and either kind from the regional, the advance within the row', () => {
    const club = noticed('club');
    for (let year = club.world.year + 1; year < club.world.year + 300; year += 1) {
      const out = yearOf(club, club.player.age + 1, year);
      if (!out.music.offer) continue;
      expect(out.music.offer.kind).toBe('indie');
      const [low, high] = LABEL_ROWS.indie.advance.club!;
      expect(out.music.offer.advance).toBeGreaterThanOrEqual(low - 50);
      expect(out.music.offer.advance).toBeLessThanOrEqual(high + 500);
      expect(out.music.offer.royalty).toBe(LABEL_ROWS.indie.royalty);
      expect(out.music.offer.term).toBe(LABEL_ROWS.indie.term);
      expect(LABEL_NAMES.indie).toContain(out.music.offer.label);
    }
    const regional = noticed('regional');
    const kinds = new Set<string>();
    for (let step = 1; step < 400; step += 1) {
      // The kind is drawn for the age it is offered at, so a life sees both over the years.
      const out = yearOf(regional, regional.player.age + step, regional.world.year + step);
      if (out.music.offer) kinds.add(out.music.offer.kind);
    }
    expect([...kinds].sort()).toEqual(['indie', 'major']);
  });

  it('is not made while one is on the table or a deal is running', () => {
    const base = noticed('regional', { offer: offer({ age: 25 }) });
    for (let year = base.world.year + 1; year < base.world.year + 80; year += 1) {
      expect(yearOf(base, base.player.age + 1, year).music.offer?.id).toBe('lbl:26');
    }
    const signed = noticed('regional', { deal: deal({ paid: true }) });
    for (let year = signed.world.year + 1; year < signed.world.year + 80; year += 1) {
      expect(yearOf(signed, signed.player.age + 1, year).music.offer).toBeUndefined();
    }
  });
});

describe('a demo', () => {
  const ready = (patch: Partial<MusicState> = {}) =>
    rich(known(adult('demo'), { craft: 70, ...patch }));

  it('is turned down for a child, a signed artist, a deal on the table, a demo already sent, nothing out and no craft', () => {
    const child = withMusic(life('demo-child'), {
      released: { single: 1, ep: 0, lp: 0 },
      craft: 70,
    });
    const tooYoung = submitDemo(child);
    expect(!tooYoung.ok && tooYoung.error).toBe('too-young');
    const signed = submitDemo(ready({ deal: deal() }));
    expect(!signed.ok && signed.error).toBe('has-deal');
    const waiting = submitDemo(ready({ offer: offer() }));
    expect(!waiting.ok && waiting.error).toBe('offer-waiting');
    const base = ready();
    const sent = submitDemo(ready({ demoAge: base.player.age }));
    expect(!sent.ok && sent.error).toBe('demo-sent');
    const nothing = submitDemo(ready({ released: { single: 0, ep: 0, lp: 0 } }));
    expect(!nothing.ok && nothing.error).toBe('no-release-yet');
    const green = submitDemo(ready({ craft: 40 }));
    expect(!green.ok && green.error).toBe('not-ready');
    expect(submitDemo(ready({ craft: 45 })).ok).toBe(true);
  });

  it('lands by one draw, against a chance of craft and a name, never nothing and never a certainty', () => {
    const base = ready({ craft: 50, reputation: 0 });
    expect(demoChance(base)).toBeCloseTo(0.12, 10);
    expect(demoChance(withMusic(base, { craft: 70 }))).toBeCloseTo(0.12 + 0.1, 10);
    expect(demoChance(withMusic(base, { reputation: 50 }))).toBeCloseTo(0.12 + 0.1, 10);
    expect(demoChance(withMusic(base, { craft: 0 }))).toBe(DEMO_CHANCE_RANGE[0]);
    expect(demoChance(withMusic(base, { craft: 100, reputation: 100 }))).toBeCloseTo(
      0.12 + 0.25 + 0.2,
      10,
    );
    expect(
      demoChance(withMusic(base, { craft: 100, reputation: 100, listeners: 0 })),
    ).toBeLessThanOrEqual(DEMO_CHANCE_RANGE[1]);
    expect(DEMO_CHANCE_RANGE).toEqual([0.03, 0.6]);
  });

  it('is answered with a line either way, writes the age sent, and a deal when it lands', () => {
    let landed = 0;
    let missed = 0;
    for (let index = 0; index < 60 && (landed === 0 || missed === 0); index += 1) {
      const base = rich(
        known(adult(`demo-${index % 8}`), { craft: 70, listeners: 10_000, peak: 10_000 }),
      );
      const result = submitDemo({
        ...base,
        world: { ...base.world, year: base.world.year + index },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.state.music.demoAge).toBe(base.player.age);
      if (result.value.landed) {
        landed += 1;
        const made = result.value.state.music.offer!;
        expect(made.source).toBe('demo');
        expect(result.value.entry.text).toBe(`Sent a demo out. ${made.label} wrote back.`);
        expect(result.value.entry.kind).toBe('milestone');
        expect(result.value.state.pending.some((row) => row.eventId === MUSIC_OFFER_EVENT_ID)).toBe(
          true,
        );
      } else {
        missed += 1;
        expect(result.value.entry.text).toBe(
          'Sent a demo out to the labels. Nobody got back to you.',
        );
        expect(result.value.state.music.offer).toBeUndefined();
        expect(result.value.state.pending.some((row) => row.eventId === MUSIC_OFFER_EVENT_ID)).toBe(
          false,
        );
      }
    }
    expect(landed).toBeGreaterThan(0);
    expect(missed).toBeGreaterThan(0);
  });
});

describe('a deal on the table', () => {
  const withOffer = (
    over: Partial<LabelOffer> = {},
    patch: Partial<MusicState> = {},
  ): GameState => {
    const made = offer(over);
    const base = rich(known(adult('deal'), { craft: 70, offer: made, ...patch }));
    return withMusicOffer(base, true);
  };

  it('is the one pending question, with the terms in it, and goes once however often the door is tried', () => {
    const state = withOffer({ advance: 24_000, royalty: 0.4, term: 2 });
    const pending = state.pending.filter((row) => row.eventId === MUSIC_OFFER_EVENT_ID);
    expect(pending).toHaveLength(1);
    expect(isMusicOfferDecision(MUSIC_OFFER_EVENT_ID)).toBe(true);
    expect(isMusicOfferDecision('acting.offer')).toBe(false);
    expect(pending[0]!.prompt).toBe(
      'Porchlight Records has been listening to you. They’d sign you for 2 years: $24,000 up front, 40% of what streams earn once that and their costs are paid back, and 2 singles and an EP a year on their schedule. Most deals never pay back.'.replace(
        '’',
        "'",
      ),
    );
    expect(pending[0]!.choices.map((row) => row.id)).toEqual(['accept', 'more', 'decline']);
    expect(withMusicOffer(state, true).pending).toHaveLength(state.pending.length);
    expect(hasSystemicOffer(state)).toBe(true);
    expect(withMusicOffer(known(adult('deal')), true).pending).toEqual([]);
    expect(withMusicOffer(rich(known(adult('deal'), { offer: offer() })), false).pending).toEqual(
      [],
    );
  });

  it('says a demo was liked, and a major commits to singles and an album', () => {
    const decision = musicOfferDecision(
      offer({
        source: 'demo',
        kind: 'major',
        royalty: 0.18,
        term: 3,
        advance: 90_000,
        label: 'Crestline Records',
      }),
      2030,
    );
    expect(decision.prompt).toBe(
      "Crestline Records liked the demo. They'd sign you for 3 years: $90,000 up front, 18% of what streams earn once that and their costs are paid back, and 3 singles and an album a year on their schedule. Most deals never pay back.",
    );
    expect(decision.year).toBe(2030);
    expect(decision.age).toBe(26);
    expect(decision.category).toBe('career');
  });

  it('can be asked for more only once', () => {
    const decision = musicOfferDecision(offer({ asked: true }), 2030);
    expect(decision.choices.map((row) => row.id)).toEqual(['accept', 'decline']);
  });

  it('is signed: the deal starts with the term to run, the advance still to come, and is a milestone with a record', () => {
    const state = withOffer({
      kind: 'major',
      royalty: 0.18,
      term: 3,
      advance: 90_000,
      label: 'Crestline Records',
    });
    const result = answerMusicOffer(state, 'accept');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value.state;
    expect(next.music.offer).toBeUndefined();
    expect(next.music.deal).toEqual({
      kind: 'major',
      label: 'Crestline Records',
      advance: 90_000,
      royalty: 0.18,
      left: 3,
      since: 26,
      owed: 0,
      paid: false,
    });
    expect(next.pending.some((row) => row.eventId === MUSIC_OFFER_EVENT_ID)).toBe(false);
    expect(result.value.entry.kind).toBe('milestone');
    expect(result.value.entry.text).toBe(
      'Signed with Crestline Records: 3 years, $90,000 up front.',
    );
    expect(next.player.records.some((row) => row.label === 'Signed with Crestline Records')).toBe(
      true,
    );
    expect(hasSystemicOffer(next)).toBe(false);
  });

  it('is passed on, with a line, and nothing else changes', () => {
    const state = withOffer();
    const result = answerMusicOffer(state, 'decline');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.music.offer).toBeUndefined();
    expect(result.value.state.music.deal).toBeUndefined();
    expect(result.value.entry.text).toBe('Passed on Porchlight Records.');
    expect(result.value.entry.kind).toBe('passive');
    expect(result.value.state.pending.some((row) => row.eventId === MUSIC_OFFER_EVENT_ID)).toBe(
      false,
    );
  });

  it('can be bargained over once: a win raises the advance and the royalty, a loss holds, and it is never lost', () => {
    expect(MUSIC_ASK_ADVANCE_GAIN).toEqual([1.15, 1.4]);
    let won = 0;
    let lost = 0;
    for (let index = 0; index < 40 && (won === 0 || lost === 0); index += 1) {
      const base = withOffer({
        id: `lbl:${26 + index}`,
        advance: 20_000,
        royalty: 0.4,
        kind: 'indie',
      });
      const result = answerMusicOffer(base, 'more');
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const after = result.value.state.music.offer!;
      expect(after.asked).toBe(true);
      expect(
        result.value.state.pending.filter((row) => row.eventId === MUSIC_OFFER_EVENT_ID),
      ).toHaveLength(1);
      const choices = result.value.state.pending.find(
        (row) => row.eventId === MUSIC_OFFER_EVENT_ID,
      )!.choices;
      expect(choices.map((row) => row.id)).toEqual(['accept', 'decline']);
      // The draw decides it: lucky when it falls under the chance, whatever the year.
      expect(after.advance > 20_000, `lbl:${26 + index}`).toBe(
        musUnit(seedOf(base), genOf(base), 'ask', `lbl:${26 + index}`) < askChance(base),
      );
      if (after.advance > 20_000) {
        won += 1;
        expect(after.advance).toBeGreaterThanOrEqual(23_000);
        expect(after.advance).toBeLessThanOrEqual(28_000);
        expect(after.royalty).toBeCloseTo(0.43, 10);
        expect(result.value.entry.text).toMatch(
          /^You asked Porchlight Records for more\. They came up to \$[\d,]+ and 43%\.$/,
        );
      } else {
        lost += 1;
        expect(after.advance).toBe(20_000);
        expect(after.royalty).toBe(0.4);
        expect(result.value.entry.text).toBe(
          'You asked Porchlight Records for more. They held where they were.',
        );
      }
    }
    expect(won).toBeGreaterThan(0);
    expect(lost).toBeGreaterThan(0);
  });

  it('never raises a royalty past what a kind of label will pay', () => {
    const major = withOffer({ kind: 'major', royalty: 0.24, advance: 100_000 });
    for (let index = 0; index < 40; index += 1) {
      const state = {
        ...major,
        music: { ...major.music, offer: { ...major.music.offer!, id: `lbl:${26 + index}` } },
      };
      const result = answerMusicOffer(state, 'more');
      if (result.ok)
        expect(result.value.state.music.offer!.royalty).toBeLessThanOrEqual(
          MUSIC_ROYALTY_CAP.major,
        );
    }
    const indie = withOffer({ kind: 'indie', royalty: 0.5 });
    const result = answerMusicOffer(indie, 'more');
    expect(result.ok && result.value.state.music.offer!.royalty).toBe(0.5);
  });

  it('is likelier to be won by a name and a representative, and never certain', () => {
    const base = rich(known(adult('deal-ask'), { reputation: 0 }));
    expect(askChance(base)).toBeCloseTo(0.45, 10);
    expect(askChance(withMusic(base, { reputation: 100 }))).toBeCloseTo(0.7, 10);
    expect(askChance({ ...base, representation: 'agent' as const })).toBeCloseTo(0.55, 10);
    expect(askChance({ ...base, representation: 'manager' as const })).toBeCloseTo(0.55, 10);
    expect(
      askChance({ ...withMusic(base, { reputation: 100 }), representation: 'agent' as const }),
    ).toBeLessThanOrEqual(0.9);
  });

  it('is refused if nobody asked, or the answer is not one of the choices', () => {
    const none = answerMusicOffer(known(adult('deal-none')), 'accept');
    expect(!none.ok && none.error).toBe('no-offer');
    const state = withOffer();
    const nonsense = answerMusicOffer(state, 'run-away');
    expect(!nonsense.ok && nonsense.error).toBe('no-such-choice');
    const asked = withOffer({ asked: true });
    const again = answerMusicOffer(asked, 'more');
    expect(!again.ok && again.error).toBe('no-such-choice');
  });

  it('is answered through the game’s decide, and time is held while it is open', () => {
    const state = withOffer();
    expect(advanceYear(state).state.world.year).toBe(state.world.year);
    const answered = decide(state, MUSIC_OFFER_EVENT_ID, 'accept');
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    expect(answered.value.state.music.deal?.label).toBe('Porchlight Records');
    const refused = decide(state, MUSIC_OFFER_EVENT_ID, 'nonsense');
    expect(refused.ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Collaborations, a manager, an agent                                          */
/* -------------------------------------------------------------------------- */

describe('collaborations', () => {
  const heard = (patch: Partial<MusicState> = {}) =>
    rich(known(adult('collab'), { listeners: 20_000, peak: 20_000, ...patch }), 100_000);

  /** A life and a year with an offer on the table, found by looking: the rules are the creators’ own. */
  const withOffer = (pick?: (state: GameState) => boolean) =>
    firstSeed(
      'collab-year',
      (seed) => {
        const base = heard();
        const state = {
          ...base,
          rng: base.rng,
          world: { ...base.world, year: base.world.year + Number(seed.split('-').pop()) },
        };
        const offers = musicCollabOffers(state);
        return offers.length > 0 && (pick?.(state) ?? true) ? state : undefined;
      },
      60,
    );

  it('reads the artist as a channel: the audience is the listeners, and the repeats and answers are the artist’s own', () => {
    const channel = musicChannel(
      heard({ collabs: { 'p:music:1': 2 }, answered: ['co:1:music:0'] }).music,
    );
    expect(channel.audience).toBe(20_000);
    expect(channel.peak).toBe(20_000);
    expect(channel.categoryId).toBe('music');
    expect(channel.collabs).toEqual({ 'p:music:1': 2 });
    expect(channel.answered).toEqual(['co:1:music:0']);
  });

  it('are offered only to somebody with a record out, and only above a hundred listeners', () => {
    expect(musicCollabOffers(adult('collab-none'))).toEqual([]);
    expect(musicCollabOffers(heard({ released: { single: 0, ep: 0, lp: 0 } }))).toEqual([]);
    const quiet = heard({ listeners: 99, peak: 99 });
    expect(musicCollabOffers(quiet)).toEqual([]);
    const child = withMusic(life('collab-child'), {
      released: { single: 1, ep: 0, lp: 0 },
      listeners: 5_000,
      peak: 5_000,
    });
    expect(musicCollabOffers(child)).toEqual([]);
  });

  it('are the same each time they are read, and never more than two, each with an id of the year', () => {
    const state = withOffer();
    const offers = musicCollabOffers(state);
    expect(offers).toEqual(musicCollabOffers(state));
    expect(offers.length).toBeLessThanOrEqual(2);
    for (const row of offers) expect(row.id.startsWith(`co:${state.world.year}:music:`)).toBe(true);
  });

  it('are taken: the listeners come over now, the repeat is remembered, and a fee is a spending row', () => {
    const state = withOffer(
      (candidate) => musicCollabOffers(candidate).some((row) => row.fee > 0) || true,
    );
    const row = musicCollabOffers(state)[0]!;
    const result = answerMusicCollab(state, row.id, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value;
    expect(next.music.listeners).toBe(20_000 + row.gain);
    expect(next.music.peak).toBe(Math.max(20_000, 20_000 + row.gain));
    expect(next.music.collabs[row.partner.id]).toBe(row.repeats + 1);
    expect(next.music.answered).toContain(row.id);
    expect(musicCollabOffers(next).some((other) => other.id === row.id)).toBe(false);
    if (row.fee > 0) {
      const posted = next.finance.transactions.at(-1)!;
      expect(posted.category).toBe('spending');
      expect(posted.source).toBe(`Recording with ${row.partner.name}`);
      expect(toDollars(posted.amount)).toBe(-row.fee);
      expect(Number(next.player.cash)).toBe(Number(next.finance.balance));
      expect(Number(next.player.cash)).toBe(Number(state.player.cash) - row.fee * 100);
    } else {
      expect(next.finance.transactions.length).toBe(state.finance.transactions.length);
      expect(next.player.cash).toBe(state.player.cash);
    }
    expect(next.player.timeline.at(-1)!.text).toMatch(/Made a record with/);
    expect(next.player.timeline.at(-1)!.text).toContain(row.gain.toLocaleString('en-US'));
  });

  it('are turned down: nothing comes over, nothing is paid, and the answer is kept', () => {
    const state = withOffer();
    const row = musicCollabOffers(state)[0]!;
    const result = answerMusicCollab(state, row.id, false);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.music.listeners).toBe(20_000);
    expect(result.value.music.answered).toContain(row.id);
    expect(result.value.music.collabs).toEqual({});
    expect(result.value.finance.transactions.length).toBe(state.finance.transactions.length);
    expect(result.value.player.timeline.at(-1)!.text).toBe(
      `Turned down a record with ${row.partner.name}.`,
    );
  });

  it('cost nothing to turn down, even at a price', () => {
    const paying = withOffer((candidate) =>
      musicCollabOffers(candidate).some((row) => row.fee > 0),
    );
    const row = musicCollabOffers(paying).find((other) => other.fee > 0)!;
    const declined = answerMusicCollab(paying, row.id, false);
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.value.finance.transactions.length).toBe(paying.finance.transactions.length);
    expect(declined.value.player.cash).toBe(paying.player.cash);
  });

  it('can be paid for with exactly what is in the bank', () => {
    const paying = withOffer((candidate) =>
      musicCollabOffers(candidate).some((row) => row.fee > 0),
    );
    const row = musicCollabOffers(paying).find((other) => other.fee > 0)!;
    const exact = rich(paying, row.fee);
    const taken = answerMusicCollab(exact, row.id, true);
    expect(taken.ok).toBe(true);
    if (taken.ok) expect(Number(taken.value.player.cash)).toBe(0);
  });

  it('are refused when nobody offered, and when the fee is more than there is in the bank', () => {
    const state = withOffer();
    const none = answerMusicCollab(state, 'co:nothing', true);
    expect(!none.ok && none.error).toEqual({ kind: 'notOffered' });
    const paying = withOffer((candidate) =>
      musicCollabOffers(candidate).some((row) => row.fee > 0),
    );
    const row = musicCollabOffers(paying).find((other) => other.fee > 0)!;
    const broke = rich(paying, 0);
    const refused = answerMusicCollab(broke, row.id, true);
    expect(!refused.ok && refused.error).toEqual({ kind: 'notEnoughMoney', needed: row.fee });
    // Turning it down costs nothing, at any price.
    expect(answerMusicCollab(broke, row.id, false).ok).toBe(true);
  });

  it('count for half as much each time with the same person', () => {
    const state = withOffer();
    const row = musicCollabOffers(state)[0]!;
    const again = answerMusicCollab(state, row.id, true);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const repeated = withMusic(state, { collabs: { [row.partner.id]: 2 } });
    const later = musicCollabOffers(repeated).find((other) => other.id === row.id);
    if (later) expect(later.gain).toBeLessThanOrEqual(Math.ceil(row.gain / 4) + 1);
    expect(MUSIC_CHANNEL_SHARE).toBe(0.25);
  });

  it('are cheaper by a third with an agent, because the creators’ rules say so', () => {
    const paying = withOffer((candidate) =>
      musicCollabOffers(candidate).some((row) => row.fee > 0),
    );
    const row = musicCollabOffers(paying).find((other) => other.fee > 0)!;
    const agented = { ...paying, representation: 'agent' as const };
    const cheaper = musicCollabOffers(agented).find((other) => other.id === row.id)!;
    expect(cheaper.fee).toBeLessThan(row.fee);
  });

  it('are forgotten at the turn of the year: the answers do not pile up', () => {
    const base = heard({
      answered: ['co:2000:music:0', 'co:2001:music:1'],
      plan: { single: 1, ep: 0, lp: 0, tour: false },
    });
    expect(yearOf(base).music.answered).toEqual([]);
  });
});

describe('a manager or an agent', () => {
  it('is for a musician with a following to book, and not for one with none', () => {
    const base = adult('rep-musician');
    expect(whyNotHire(base)).toEqual({ kind: 'nobodyWillTakeYouOn' });
    const local = withMusic(base, { listeners: 1_999 });
    expect(whyNotHire(local)).toEqual({ kind: 'nobodyWillTakeYouOn' });
    const club = withMusic(base, { listeners: 2_000 });
    expect(whyNotHire(club)).toBeUndefined();
    expect(whyNotHire({ ...club, representation: 'manager' as const })).toEqual({
      kind: 'alreadyHaveOne',
    });
  });
});

describe('the Music channel', () => {
  const channel = (over: Record<string, unknown> = {}) =>
    ({
      id: 'c:1',
      platformId: 'streaming',
      categoryId: 'music',
      name: 'Open Mic',
      since: 2020,
      audience: 1_000,
      peak: 1_500,
      effort: 'regular',
      luck: 0.5,
      earned: dollars(0),
      ...over,
    }) as never;

  it('is found by a quarter of the people who found the records, and only if it is a Music channel', () => {
    const channels = [channel(), channel({ id: 'c:2', categoryId: 'gaming' })];
    const out = withMusicAudience(channels, 4_000);
    expect(out[0]!.audience).toBe(1_000 + 1_000);
    expect(out[0]!.peak).toBe(2_000);
    expect(out[1]).toBe(channels[1]);
  });

  it('keeps the peak it has, and changes nothing for nobody found', () => {
    const channels = [channel({ peak: 90_000 })];
    expect(withMusicAudience(channels, 4_000)[0]!.peak).toBe(90_000);
    expect(withMusicAudience(channels, 0)).toBe(channels);
    expect(withMusicAudience(channels, 1)).toBe(channels);
  });
});

/* -------------------------------------------------------------------------- */
/* Music as a living                                                            */
/* -------------------------------------------------------------------------- */

describe('music as a living', () => {
  const national = (state: GameState): GameState =>
    withMusic(state, {
      craft: 100,
      listeners: 400_000,
      peak: 400_000,
      released: { single: 10, ep: 3, lp: 1 },
      catalogue: 40,
      reputation: 30,
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
    const after = advanceYear(answerOthers(national(found))).state;
    expect(isMusicFullTime(after.music)).toBe(true);
    expect(after.employment.job).toBeUndefined();
    expect(
      after.employment.history.some((row) => row.jobId === job.jobId && row.because === 'resigned'),
    ).toBe(true);
    expect(after.player.timeline.some((row) => /Music is the living now/.test(row.text))).toBe(
      true,
    );
    expect(after.player.occupation).toBe('Musician');
    expect(eulogyFor(after).identity).not.toBe(findJob(job.jobId)?.title);
    // A small act keeps the job.
    const small = known(found, { craft: 60, listeners: 3_000, peak: 3_000 });
    const kept = advanceYear(answerOthers(small)).state;
    expect(isMusicFullTime(kept.music)).toBe(false);
    expect(kept.employment.job).toBeDefined();
    expect(kept.player.occupation).not.toBe('Musician');
  });

  it('keeps job offers away from somebody whose living it is, and not from a small act', () => {
    // Asking spends a draw from a stream every copy of a life shares, and `adult` hands out the
    // same life each time, so each question is put to a life made new from the same seed.
    const fresh = (seed: string): GameState => toAge(life(seed), 26);
    const seed = firstSeed('living-control', (candidate) => {
      const probe = fresh(candidate);
      return probe.player.alive && withAnyOffer(probe, true) !== probe ? candidate : undefined;
    });
    const living = withMusic(fresh(seed), { lastPay: 50_000 });
    expect(withAnyOffer(living, true)).toEqual(living);
    const small = withMusic(fresh(seed), { lastPay: 5_000 });
    expect(withAnyOffer(small, true)).not.toEqual(small);
  });
});

/* -------------------------------------------------------------------------- */
/* Through the game                                                            */
/* -------------------------------------------------------------------------- */

describe('a musician, through the game', () => {
  /** A life that records every year from sixteen, tours when it pays, and signs with whoever calls. */
  function play(seed: string, years: number, talent = true) {
    let state = life(seed, talent);
    let guard = 0;
    while (state.player.alive && state.player.age < years && (guard += 1) < 90) {
      state = answerOthers(state);
      if (state.player.age >= 16) {
        for (const [kind, count] of [
          ['ep', 1],
          ['single', 4],
        ] as const) {
          const planned = planReleases(state, kind, count);
          if (planned.ok) state = planned.value;
        }
        const tour = plannedTour(state);
        if (tour && tour.door > tour.costs) {
          const planned = planTour(state, true);
          if (planned.ok) state = planned.value;
        }
        if (state.pending.some((row) => row.eventId === MUSIC_OFFER_EVENT_ID)) {
          const answered = decide(state, MUSIC_OFFER_EVENT_ID, 'accept');
          if (answered.ok) state = answered.value.state;
        }
      }
      state = advanceYear(state).state;
    }
    return state;
  }

  it('goes from a first record to a following, with the income in the ledger, the work in the timeline, and a record', () => {
    const found = firstSeed(
      'game-following',
      (seed) => {
        const state = play(seed, 40);
        return tierRankOf(musicTierOf(state.music)) >= tierRankOf('regional') ? state : undefined;
      },
      30,
    );
    const rows = found.finance.transactions.filter((row) => row.source === 'Music income');
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((row) => row.category === 'salary')).toBe(true);
    expect(found.finance.transactions.some((row) => row.source === 'Tax on music income')).toBe(
      true,
    );
    expect(found.finance.transactions.some((row) => row.source === 'Recording and touring')).toBe(
      true,
    );
    expect(found.player.timeline.some((row) => /^Put out/.test(row.text))).toBe(true);
    expect(found.player.records.some((row) => /Released a first/.test(row.label))).toBe(true);
    expect(found.player.records.some((row) => /Became a regional act/.test(row.label))).toBe(true);
    expect(found.music.released.single).toBeGreaterThan(10);
    expect(found.fame).toBeGreaterThan(0);
  });

  it('puts Musician in the header for a living, and keeps it', () => {
    const found = firstSeed(
      'game-header',
      (seed) => {
        const state = play(seed, 45);
        return isMusicFullTime(state.music) ? state : undefined;
      },
      40,
    );
    expect(found.player.occupation).toBe('Musician');
  });

  it('is held back by an open deal: time does not move until it is answered', () => {
    const found = firstSeed(
      'game-hold',
      (seed) => {
        let state = life(seed, true);
        for (let index = 0; index < 30; index += 1) {
          state = answerOthers(state);
          if (state.player.age >= 16) {
            for (const [kind, count] of [
              ['ep', 1],
              ['single', 4],
            ] as const) {
              const planned = planReleases(state, kind, count);
              if (planned.ok) state = planned.value;
            }
          }
          if (!state.player.alive) return undefined;
          state = advanceYear(state).state;
          if (state.pending.some((row) => row.eventId === MUSIC_OFFER_EVENT_ID)) return state;
        }
        return undefined;
      },
      40,
    );
    expect(found.music.offer).toBeDefined();
    const year = found.world.year;
    expect(advanceYear(found).state.world.year).toBe(year);
  });

  it('keeps a life with no music in it exactly as it was: no music state, no fame, no ledger lines', () => {
    const state = toAge(life('game-none', true), 30);
    expect(state.music).toEqual(EMPTY_MUSIC);
    expect(state.finance.transactions.some((row) => /Music|music|Recording/.test(row.source))).toBe(
      false,
    );
    expect(state.player.timeline.some((row) => /^Put out/.test(row.text))).toBe(false);
  });

  it('is part of a state that ends in a save: a played life has a coherent state at forty', () => {
    const state = play('game-coherent', 40);
    expect(state.music.reputation).toBeGreaterThanOrEqual(0);
    expect(state.music.reputation).toBeLessThanOrEqual(100);
    expect(state.music.listeners).toBeGreaterThanOrEqual(0);
    expect(state.music.listeners).toBeLessThanOrEqual(LISTENER_CAP);
    expect(state.music.peak).toBeGreaterThanOrEqual(state.music.listeners);
    expect(Number.isInteger(state.music.listeners)).toBe(true);
    expect(state.music.plan).toEqual(EMPTY_PLAN);
    expect(Number(state.player.cash)).toBeGreaterThanOrEqual(0);
    for (const kind of RELEASE_KINDS)
      expect(state.music.released[kind as ReleaseKind]).toBeGreaterThanOrEqual(0);
  });

  it('reaches no more than the weeks, the caps and the money allow in any year it plays', () => {
    let state = life('game-caps', true);
    for (let guard = 0; state.player.alive && state.player.age < 40 && guard < 60; guard += 1) {
      state = answerOthers(state);
      if (state.player.age >= 16) {
        for (const [kind, count] of [
          ['lp', 2],
          ['ep', 3],
          ['single', 15],
        ] as const) {
          const planned = planReleases(state, kind, count);
          if (planned.ok) state = planned.value;
        }
        expect(weeksUsed(state)).toBeLessThanOrEqual(YEAR_WEEKS);
      }
      const before = state.music.released;
      state = advanceYear(state).state;
      for (const kind of RELEASE_KINDS) {
        expect(state.music.released[kind] - before[kind], kind).toBeLessThanOrEqual(
          RELEASE_CAPS[kind],
        );
      }
      expect(Number(state.player.cash)).toBeGreaterThanOrEqual(0);
    }
  });

  it('draws nothing from the random streams: the same life with and without a plan has the same years of everything else', () => {
    const planned = toAge(life('game-streams', true), 25);
    const base = toAge(life('game-streams', true), 25);
    expect(planned.rng.getSeed()).toBe(base.rng.getSeed());
    const withPlan = withMusic(base, { craft: 60, plan: { single: 1, ep: 0, lp: 0, tour: false } });
    const a = advanceYear(answerOthers(withPlan)).state;
    const b = advanceYear(answerOthers(base)).state;
    expect(a.rng).toEqual(b.rng);
    // A record can change how the year felt, and nothing else about the person.
    expect({ ...a.player.stats, happiness: 0 }).toEqual({ ...b.player.stats, happiness: 0 });
    expect(a.world.year).toBe(b.world.year);
  });
});

/* -------------------------------------------------------------------------- */
/* The dials, pinned                                                            */
/* -------------------------------------------------------------------------- */

describe('the dials', () => {
  it('pin every row of the ladder as numbers, so a change is a decision and not an accident', () => {
    const column = <K extends keyof (typeof MUSIC_TIER_ROWS)['local']>(key: K) =>
      MUSIC_TIERS.map((id) => MUSIC_TIER_ROWS[id][key]);
    expect(column('shows')).toEqual([8, 20, 24, 28, 40, 60]);
    expect(column('ticket')).toEqual([10, 18, 35, 55, 80, 140]);
    expect(column('doorShare')).toEqual([0.5, 0.6, 0.7, 0.8, 0.85, 0.9]);
    expect(column('nightCost')).toEqual([250, 1_000, 8_000, 45_000, 250_000, 1_500_000]);
    expect(column('draw')).toEqual([0.3, 0.1, 0.04, 0.015, 0.01, 0.006]);
    expect(column('labelChance')).toEqual([0, 0.12, 0.18, 0.22, 0.25, 0.25]);
    expect(column('majorShare')).toEqual([0, 0, 0.3, 0.55, 0.8, 0.9]);
    expect(column('awardChance')).toEqual([0, 0, 0, 0.1, 0.16, 0.22]);
    expect(column('reputation')).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pin what a release brings: discovery, growth, and the three labels’ terms', () => {
    expect(DISCOVER).toEqual({ single: 120, ep: 350, lp: 900 });
    expect(GROW).toEqual({ single: 0.04, ep: 0.08, lp: 0.15 });
    expect(LABEL_COST).toEqual({
      indie: { single: 3_000, ep: 10_000, lp: 40_000 },
      major: { single: 25_000, ep: 70_000, lp: 250_000 },
    });
    expect(LABEL_REACH).toEqual({
      indie: { discover: 1.6, grow: 1.15, polish: 3 },
      major: { discover: 3.2, grow: 1.4, polish: 6 },
    });
    expect(LABEL_ROWS.indie).toMatchObject({
      term: 2,
      royalty: 0.4,
      commit: { single: 2, ep: 1, lp: 0 },
      advance: {
        club: [3_000, 15_000],
        regional: [10_000, 45_000],
        national: [30_000, 120_000],
        headliner: [80_000, 300_000],
        superstar: [150_000, 500_000],
      },
    });
    expect(LABEL_ROWS.major).toMatchObject({
      term: 3,
      royalty: 0.18,
      commit: { single: 3, ep: 0, lp: 1 },
      advance: {
        regional: [30_000, 120_000],
        national: [120_000, 600_000],
        headliner: [600_000, 2_000_000],
        superstar: [2_000_000, 8_000_000],
      },
    });
  });

  it('pin the ages: twelve to put a record out, sixteen to tour, seven for lessons', () => {
    const adultBase = rich(adult('ages'));
    const at = (age: number) => ({ ...adultBase, player: { ...adultBase.player, age } });
    expect(planReleases(at(11), 'single', 1).ok).toBe(false);
    expect(planReleases(at(12), 'single', 1).ok).toBe(true);
    const child = withMusic(rich(at(12)), {
      craft: 50,
      plan: { single: 1, ep: 0, lp: 0, tour: false },
    });
    expect(
      runMusicYear({ before: child, education: child.education, age: 12, year: 2030, standard: 1 })
        .music.released.single,
    ).toBe(1);
    expect(
      runMusicYear({ before: child, education: child.education, age: 11, year: 2030, standard: 1 })
        .music.released.single,
    ).toBe(0);
    const touring = withMusic(rich(at(16)), {
      craft: 50,
      listeners: 5_000,
      peak: 5_000,
      released: { single: 3, ep: 0, lp: 0 },
      plan: { single: 0, ep: 0, lp: 0, tour: true },
    });
    expect(
      runMusicYear({
        before: touring,
        education: touring.education,
        age: 16,
        year: 2030,
        standard: 1,
      }).music.tours,
    ).toBe(1);
    expect(
      runMusicYear({
        before: touring,
        education: touring.education,
        age: 15,
        year: 2030,
        standard: 1,
      }).music.tours,
    ).toBe(0);
    expect(startMusicLessons(at(7)).ok).toBe(true);
    expect(startMusicLessons(at(6)).ok).toBe(false);
    expect(MUSIC_RELEASE_CRAFT).toBe(0.1);
  });
});

describe('edges of a year', () => {
  it('gives a local act no fame, however good the name and however many the awards', () => {
    expect(musicFameOf({ tier: 'local', reputation: 90, awards: 4, idle: 0 })).toBe(0);
    expect(musicFameOf({ tier: 'superstar', reputation: 100, awards: 4, idle: 0 })).toBe(100);
  });

  it('starts from nothing but a plan: no craft, no catalogue, nothing out before — and puts the record out', () => {
    const base = rich(adult('edge-plan'));
    const out = yearOf(withMusic(base, { plan: { single: 1, ep: 0, lp: 0, tour: false } }));
    expect(out.music.released.single).toBe(1);
    expect(out.music.craft).toBeDefined();
  });

  it('starts from nothing but a deal: the label’s releases happen and are its to pay for', () => {
    const base = rich(adult('edge-deal'));
    const out = yearOf(withMusic(base, { deal: deal() }));
    expect(out.music.released).toEqual({ single: 2, ep: 1, lp: 0 });
    expect(out.costs).toBe(0);
  });

  it('starts from nothing but a tour: an audience of some hundreds is enough to go out, even with no record on file', () => {
    const base = rich(adult('edge-tour'));
    const out = yearOf(
      withMusic(base, { listeners: 800, peak: 800, plan: { single: 0, ep: 0, lp: 0, tour: true } }),
    );
    expect(out.music.tours).toBe(1);
  });

  it('holds a plan from an old save to the caps: no more than fifteen singles, three EPs, two albums, ever', () => {
    const base = rich(
      known(adult('edge-caps'), {
        craft: 90,
        plan: { single: 40, ep: 0, lp: 0, tour: false },
        released: { single: 0, ep: 0, lp: 0 },
      }),
    );
    expect(yearOf(base).music.released.single).toBe(15);
    const eps = yearOf(withMusic(base, { plan: { single: 0, ep: 9, lp: 0, tour: false } }));
    expect(eps.music.released.ep).toBe(3);
    const lps = yearOf(withMusic(base, { plan: { single: 0, ep: 0, lp: 9, tour: false } }));
    expect(lps.music.released.lp).toBe(2);
    const signed = yearOf(
      withMusic(base, {
        deal: deal({ kind: 'major', paid: true }),
        plan: { single: 0, ep: 0, lp: 9, tour: false },
      }),
    );
    expect(signed.music.released.lp).toBe(2);
  });

  it('feels like what happened: a hit lifts the year, a flop weighs on it, a viral one lifts it more', () => {
    const base = rich(
      known(adult('edge-mood'), {
        craft: 100,
        listeners: 500,
        peak: 500,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const flopBase = withMusic(base, { craft: 15 });
    const seen = new Set<string>();
    for (let year = base.world.year + 1; year < base.world.year + 500; year += 1) {
      for (const state of [base, flopBase]) {
        const q = qualityOf(state, year, 0, state.music.craft!);
        const out = yearOf(state, state.player.age + 1, year);
        if (out.music.awards > 0) continue;
        const rose =
          tierRankOf(tierFor(out.music.listeners)) > tierRankOf(tierFor(state.music.listeners));
        const viral = out.lines.some((row) => /took off/.test(row.text));
        const hit = q >= HIT_LINE[tierFor(500)];
        const flop = q < HIT_LINE[tierFor(500)] - MUSIC_FLOP_MARGIN;
        expect(out.mood, `${year}`).toBe(
          (hit ? 1 : 0) - (flop ? 1 : 0) + (viral ? 3 : 0) + (rose ? 3 : 0),
        );
        seen.add(`${hit}:${flop}:${viral}`);
      }
    }
    expect(seen.has('true:false:false')).toBe(true);
    expect(seen.has('false:true:false')).toBe(true);
    expect(seen.has('true:false:true')).toBe(true);
  });

  it('keeps a name between nothing and a hundred', () => {
    const flopBase = rich(
      known(adult('edge-rep'), {
        craft: 5,
        reputation: 0,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    expect(yearOf(flopBase).music.reputation).toBe(0);
    const hitBase = rich(
      known(adult('edge-rep'), {
        craft: 100,
        reputation: 99,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
      }),
    );
    const year = firstYear(hitBase.world.year + 1, (candidate) =>
      qualityOf(hitBase, candidate, 0, 100) >= HIT_LINE.club ? candidate : undefined,
    );
    expect(yearOf(hitBase, hitBase.player.age + 1, year).music.reputation).toBe(100);
  });

  it('never holds more listeners than the biggest artist in the world', () => {
    const base = rich(
      known(adult('edge-cap'), {
        craft: 100,
        listeners: 200_000_000,
        peak: 200_000_000,
        catalogue: 30,
      }),
    );
    expect(yearOf(base).music.listeners).toBe(LISTENER_CAP);
  });

  it('never takes craft past a hundred, whatever a character is and whatever has been put out', () => {
    const top = withStats(adult('edge-craft'), {
      charisma: 100,
      discipline: 100,
      smarts: 100,
      looks: 100,
    });
    const lots = { ...EMPTY_MUSIC, released: { single: 60, ep: 0, lp: 0 } };
    expect(nextMusicCraft(top, lots, true, 100)).toBe(100);
  });

  it('gives a local act with no label a call from a small indie, whose advance comes from the club row', () => {
    const base = rich(known(adult('edge-local-demo'), { craft: 100, listeners: 800, peak: 800 }));
    let advance: number | undefined;
    for (let step = 0; step < 80 && advance === undefined; step += 1) {
      const aged = { ...base, player: { ...base.player, age: base.player.age + step } };
      const result = submitDemo(aged);
      if (result.ok && result.value.landed) {
        const made = result.value.state.music.offer!;
        expect(made.kind).toBe('indie');
        advance = made.advance;
        const u = musUnit(seedOf(aged), genOf(aged), 'advance', `${aged.player.age}:demo`);
        const raw = 3_000 * (15_000 / 3_000) ** u;
        const step100 = raw < 10_000 ? 100 : 1_000;
        expect(made.advance).toBe(Math.round(raw / step100) * step100);
      }
    }
    expect(advance).toBeDefined();
  });

  it('draws an advance that is smaller for the lucky draw’s opposite end: low at the bottom of the row, high at the top', () => {
    const base = rich(
      known(adult('edge-advance'), { craft: 100, listeners: 40_000, peak: 40_000 }),
    );
    const advances: number[] = [];
    for (let step = 0; step < 120; step += 1) {
      const aged = { ...base, player: { ...base.player, age: base.player.age + step } };
      const result = submitDemo(aged);
      if (result.ok && result.value.landed) {
        const made = result.value.state.music.offer!;
        const [low, high] = LABEL_ROWS[made.kind].advance.regional!;
        expect(made.advance).toBeGreaterThanOrEqual(Math.round(low * 0.99));
        expect(made.advance).toBeLessThanOrEqual(Math.round(high * 1.01));
        advances.push(made.advance);
      }
    }
    expect(advances.length).toBeGreaterThan(3);
    expect(Math.max(...advances)).toBeGreaterThan(Math.min(...advances) * 1.3);
  });
});

/* -------------------------------------------------------------------------- */
/* Edges the sabotage run found                                                 */
/* -------------------------------------------------------------------------- */

/** What a year of the label's own releases brings in, worked out here from the draws, to hold the engine to it. */
function expectedGain(state: GameState, year: number): number {
  const music = state.music;
  const held = music.deal!;
  const reach = LABEL_REACH[held.kind];
  const committed = LABEL_ROWS[held.kind].commit;
  const craft = music.craft!;
  const seed = seedOf(state);
  const gen = genOf(state);
  const ceiling = audienceCeiling(craft + reach.polish, musicLuck(seed, gen), reach.discover);
  const queue: ReleaseKind[] = [];
  for (const kind of [...RELEASE_KINDS].reverse()) {
    for (let index = 0; index < committed[kind]; index += 1) queue.push(kind);
  }
  let gained = 0;
  queue.forEach((kind, index) => {
    const quality = qualityOf(state, year, index, craft, reach.polish);
    const viral =
      quality > 40 &&
      musUnit(seed, gen, 'viral', year, index) <
        VIRAL_BASE + Math.max(0, quality - VIRAL_FROM) * VIRAL_PER_POINT;
    const room = Math.max(0, 1 - music.listeners / (ceiling * (viral ? VIRAL_CEILING : 1)));
    gained +=
      (DISCOVER[kind] * reach.discover + music.listeners * GROW[kind] * reach.grow) *
      qualityFactor(quality) *
      SATURATION ** index *
      room *
      (viral ? VIRAL_MULTIPLIER : 1);
  });
  return gained;
}

describe('the edges of planning', () => {
  const base = () => rich(adult('plan-base'));

  it('lets an artist plan none of a kind, and plan what the bank can pay for to the dollar', () => {
    expect(planReleases(base(), 'single', 0).ok).toBe(true);
    expect(planReleases(rich(adult('plan-exact'), 600), 'single', 2).ok).toBe(true);
  });

  it('does not charge again for a plan it already holds', () => {
    const planned = planReleases(rich(adult('plan-hold'), 700), 'single', 2);
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planReleases(rich(planned.value, 0), 'single', 2).ok).toBe(true);
  });

  it('counts what an indie label has committed, an EP among it, in the weeks', () => {
    const indie = withMusic(base(), { deal: deal() });
    expect(weeksUsed(indie)).toBe(2 * RELEASE_WEEKS.single + RELEASE_WEEKS.ep);
  });

  it('lets an artist of exactly sixteen tour, and fills the year to the last week', () => {
    const sixteen = known(rich(adult('tour-sixteen', false, 16)), {
      listeners: 5_000,
      peak: 5_000,
    });
    expect(sixteen.player.age).toBe(16);
    expect(plannedTour(sixteen)).toBeDefined();
    const found = firstSeed(
      'tour-exact-weeks',
      (name) => {
        for (let listeners = 2_000; listeners < 24_000; listeners += 250) {
          const state = known(rich(adult(name.replace(/-\d+$/, '')), 500_000), {
            listeners,
            peak: listeners,
            craft: 60,
          });
          const tour = plannedTour(state);
          if (!tour || tour.weeks % 2 !== 0) continue;
          let rest = YEAR_WEEKS - tour.weeks;
          const lp = Math.min(2, Math.floor(rest / 14));
          rest -= lp * 14;
          const ep = Math.min(3, Math.floor(rest / 6));
          rest -= ep * 6;
          if (rest / 2 > 15) continue;
          let planned = state;
          for (const [kind, count] of [
            ['lp', lp],
            ['ep', ep],
            ['single', rest / 2],
          ] as const) {
            const result = planReleases(planned, kind, count);
            if (!result.ok) return undefined;
            planned = result.value;
          }
          if (weeksUsed(planned) !== YEAR_WEEKS - tour.weeks) return undefined;
          return planned;
        }
        return undefined;
      },
      1,
    );
    const on = planTour(found, true);
    expect(on.ok).toBe(true);
    if (on.ok) expect(weeksUsed(on.value)).toBe(YEAR_WEEKS);
  });
});

describe('the edges of a demo and of lessons', () => {
  it('goes out from twelve', () => {
    const twelve = withMusic(rich(adult('demo-twelve', false, 12)), {
      craft: 70,
      released: { single: 1, ep: 0, lp: 0 },
    });
    expect(twelve.player.age).toBe(12);
    expect(submitDemo(twelve).ok).toBe(true);
  });

  it('start with the craft the artist has, not the craft they were born to', () => {
    const base = known(adult('lessons-craft'), { craft: 60 });
    expect(musicCraftOf({ ...base, music: { ...base.music, craft: undefined } })).not.toBe(60);
    const started = startMusicLessons(base);
    expect(started.ok && started.value.state.music.craft).toBe(60);
  });

  it('are paid for from eighteen, not before, and a child is never made to give them up', () => {
    const base = withMusic(adult('lessons-edge'), { lessons: { since: 12, seasons: 1 } });
    const own = { ...base, household: { ...base.household, housing: 'ownPlace' as const } };
    const run = (before: GameState, age: number, standard: number) =>
      runMusicYear({
        before,
        education: before.education,
        age,
        year: before.world.year + 1,
        standard,
      });
    expect(run(own, 18, 60_000).fees).toBe(2_000);
    expect(run(own, 17, 60_000).fees).toBe(0);
    const home = { ...base, household: { ...base.household, housing: 'withFamily' as const } };
    const tight = run(home, 16, 1_000);
    expect(tight.music.lessons?.seasons).toBe(2);
    expect(tight.lines.some((row) => /Let the music lessons go/.test(row.text))).toBe(false);
  });

  it('cap the craft at a hundred for somebody who has all of it', () => {
    const gifted = withStats(life('ceiling-top', true), {
      discipline: 100,
      charisma: 100,
      smarts: 100,
      looks: 100,
    });
    expect(musicCraft(gifted.player.stats, true)).toBe(100);
    expect(musicCraftCeiling(gifted)).toBe(100);
  });
});

describe('the edges of bargaining and of a call', () => {
  const noticedAt = (patch: Partial<MusicState>) =>
    rich(
      known(adult('call-edge'), {
        craft: 50,
        listeners: 40_000,
        peak: 40_000,
        catalogue: 30,
        plan: EMPTY_PLAN,
        ...patch,
      }),
    );

  it('is made to a musician whose craft is exactly the label’s line, and not before', () => {
    const state = noticedAt({});
    const craftFor = firstSeed(
      'call-craft',
      () => {
        for (let craft = 20; craft < 80; craft += 1) {
          const music = { ...state.music, craft, plan: EMPTY_PLAN, answered: [] };
          if (nextMusicCraft(state, music, false, craft) === 45) return craft;
        }
        return undefined;
      },
      1,
    );
    const ready = withMusic(state, { craft: craftFor });
    const year = firstYear(ready.world.year + 1, (candidate) =>
      musUnit(seedOf(ready), genOf(ready), 'call', candidate) <
      MUSIC_TIER_ROWS.regional.labelChance * 0.5 - 0.005
        ? candidate
        : undefined,
    );
    expect(yearOf(ready, ready.player.age + 1, year).music.offer).toBeDefined();
  });
});

describe('the edges of a year of releases', () => {
  const local = (patch: Partial<MusicState> = {}) =>
    rich(
      known(adult('edge-year'), {
        craft: 58,
        listeners: 500,
        peak: 500,
        reputation: 20,
        catalogue: 0,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
        ...patch,
      }),
    );

  it('counts a release at exactly the rung’s line as a hit, and one a point under the flop margin as a flop', () => {
    const hitBase = local({ craft: HIT_LINE.local });
    const hitYear = firstYear(
      hitBase.world.year + 1,
      (year) => (qualityOf(hitBase, year, 0, HIT_LINE.local) === HIT_LINE.local ? year : undefined),
      2_000,
    );
    const hit = yearOf(hitBase, hitBase.player.age + 1, hitYear);
    expect(hit.music.reputation).toBe(20 + MUSIC_TIER_ROWS.local.reputation + MUSIC_HIT_REPUTATION);
    const floor = HIT_LINE.local - MUSIC_FLOP_MARGIN;
    const edge = local({ craft: floor });
    const edgeYear = firstYear(
      edge.world.year + 1,
      (year) => (qualityOf(edge, year, 0, floor) === floor ? year : undefined),
      2_000,
    );
    const held = yearOf(edge, edge.player.age + 1, edgeYear);
    expect(held.music.reputation).toBe(20);
    expect(held.mood).toBe(0);
    const under = local({ craft: floor - 1 });
    const underYear = firstYear(
      under.world.year + 1,
      (year) => (qualityOf(under, year, 0, floor - 1) === floor - 1 ? year : undefined),
      2_000,
    );
    expect(yearOf(under, under.player.age + 1, underYear).music.reputation).toBe(
      20 - MUSIC_FLOP_REPUTATION,
    );
  });

  it('says a year was “a few listeners” when only some of what came out flopped', () => {
    const base = local({ craft: 36, plan: { single: 2, ep: 0, lp: 0, tour: false } });
    const floor = HIT_LINE.local - MUSIC_FLOP_MARGIN;
    const year = firstYear(
      base.world.year + 1,
      (candidate) => {
        const first = qualityOf(base, candidate, 0, 36);
        const second = qualityOf(base, candidate, 1, 36);
        return first < floor && second >= floor && second <= 40 ? candidate : undefined;
      },
      3_000,
    );
    const out = yearOf(base, base.player.age + 1, year);
    expect(
      out.lines.some((row) => row.text === 'Put out 2 singles. It found a few listeners.'),
    ).toBe(true);
  });

  it('lets a middling release go viral on the base chance alone, and not on a negative one', () => {
    const base = local({ craft: 48 });
    const year = firstYear(
      base.world.year + 1,
      (candidate) => {
        const quality = qualityOf(base, candidate, 0, 48);
        return quality > 40 &&
          quality <= 55 &&
          musUnit(seedOf(base), genOf(base), 'viral', candidate, 0) < VIRAL_BASE
          ? candidate
          : undefined;
      },
      4_000,
    );
    const out = yearOf(base, base.player.age + 1, year);
    expect(out.records.some((row) => /went viral/.test(row.label))).toBe(true);
  });

  it('keeps a release to a hundred, whatever a label’s polish adds to a gifted artist', () => {
    const base = rich(
      known(adult('edge-cap'), {
        craft: 100,
        listeners: 3_000,
        peak: 3_000,
        deal: deal({ kind: 'major', left: 3 }),
        plan: { single: 15, ep: 0, lp: 0, tour: false },
      }),
    );
    expect(yearOf(base).music.bestQuality).toBe(100);
  });

  it('puts a label’s own releases ahead of the artist’s own', () => {
    const base = rich(
      withMusic(adult('edge-order'), {
        craft: 60,
        deal: deal({ left: 3 }),
        plan: { single: 0, ep: 0, lp: 1, tour: false },
      }),
    );
    const out = yearOf(base);
    expect(out.records[0]!.label.startsWith(`Released a first ${KIND_NAME.ep}:`)).toBe(true);
  });

  it('brings what the draws say it should, for a label’s releases of either kind', () => {
    for (const kind of ['indie', 'major'] as const) {
      const base = rich(
        known(adult('edge-gain'), {
          craft: 70,
          listeners: 3_000,
          peak: 3_000,
          catalogue: 6,
          deal: deal({ kind, left: 3, paid: true }),
          plan: EMPTY_PLAN,
        }),
      );
      for (const step of [1, 2, 3]) {
        const year = base.world.year + step;
        const out = yearOf(base, base.player.age + step, year);
        expect(out.fans, `${kind} ${step}`).toBe(Math.round(expectedGain(base, year)));
      }
    }
  });

  it('holds the audience to what the work can carry: far above it nothing new comes and the excess falls back a quarter', () => {
    for (const kind of ['indie', 'major'] as const) {
      const probe = rich(known(adult('edge-ceiling'), { craft: 60 }));
      const reach = LABEL_REACH[kind];
      const ceiling = audienceCeiling(
        60 + reach.polish,
        musicLuck(seedOf(probe), genOf(probe)),
        reach.discover,
      );
      const listeners = Math.round(ceiling * 6);
      const base = withMusic(probe, {
        listeners,
        peak: listeners,
        catalogue: 40,
        deal: deal({ kind, left: 3, paid: true }),
        plan: EMPTY_PLAN,
      });
      const out = yearOf(base);
      const raw = listeners * (RETAIN_BASE + RETAIN_CATALOGUE);
      expect(out.fans, kind).toBe(0);
      expect(out.music.listeners, kind).toBe(Math.round(raw - (raw - ceiling) * OVERSHOOT_FALL));
    }
  });
});

describe('the edges of the road', () => {
  /** A year where nothing new is found, so the audience on the road is exactly the audience there is. */
  const overCeiling = (craft = 60) => {
    const probe = rich(known(adult('edge-road'), { craft }));
    const ceiling = audienceCeiling(craft, musicLuck(seedOf(probe), genOf(probe)), 1);
    return { probe, ceiling };
  };

  it('goes on the road at exactly three hundred listeners, and not at two ninety-nine', () => {
    const base = rich(
      known(adult('edge-300'), {
        listeners: MIN_TOUR_LISTENERS,
        peak: MIN_TOUR_LISTENERS,
        plan: { single: 0, ep: 0, lp: 0, tour: true },
      }),
    );
    expect(yearOf(base).music.tours).toBe(1);
    const short = withMusic(base, {
      listeners: MIN_TOUR_LISTENERS - 1,
      peak: MIN_TOUR_LISTENERS - 1,
    });
    expect(yearOf(short).music.tours).toBe(0);
  });

  it('fits a tour into the last week of the year and no further', () => {
    const { probe, ceiling } = overCeiling();
    const found = firstSeed(
      'edge-weeks',
      () => {
        for (let step = 6; step < 40; step += 0.5) {
          const listeners = Math.round(ceiling * step);
          const tour = tourFor(tierFor(listeners), listeners, 60);
          if (tour.weeks % 2 !== 0) continue;
          let rest = YEAR_WEEKS - tour.weeks;
          const lp = Math.min(2, Math.floor(rest / 14));
          rest -= lp * 14;
          const ep = Math.min(3, Math.floor(rest / 6));
          rest -= ep * 6;
          if (rest / 2 > 14) continue;
          return { listeners, lp, ep, single: rest / 2 };
        }
        return undefined;
      },
      1,
    );
    const state = (single: number) =>
      withMusic(probe, {
        listeners: found.listeners,
        peak: found.listeners,
        catalogue: 40,
        plan: { single, ep: found.ep, lp: found.lp, tour: true },
      });
    const exact = yearOf(state(found.single));
    expect(exact.music.tours).toBe(1);
    expect(exact.music.released.single - probe.music.released.single).toBe(found.single);
    const over = yearOf(state(found.single + 1));
    expect(over.music.tours).toBe(0);
    expect(over.lines.some((row) => /The tour didn't happen/.test(row.text))).toBe(true);
  });

  it('is sized by how good the year’s records were, not by the craft alone', () => {
    const { probe, ceiling } = overCeiling();
    const listeners = Math.round(ceiling * 6);
    const base = withMusic(probe, {
      listeners,
      peak: listeners,
      catalogue: 40,
      plan: { single: 2, ep: 0, lp: 0, tour: true },
    });
    const year = firstYear(
      base.world.year + 1,
      (candidate) => {
        const qualities = [0, 1].map((index) => qualityOf(base, candidate, index, 60));
        const average = (qualities[0]! + qualities[1]!) / 2;
        const heard = tourFor(tierFor(listeners), listeners, average);
        const plain = tourFor(tierFor(listeners), listeners, 60);
        return heard.door - heard.costs !== plain.door - plain.costs ? candidate : undefined;
      },
      600,
    );
    const qualities = [0, 1].map((index) => qualityOf(base, year, index, 60));
    const plan = tourFor(tierFor(listeners), listeners, (qualities[0]! + qualities[1]!) / 2);
    const net = plan.door - plan.costs;
    const out = yearOf(base, base.player.age + 1, year);
    const venue = MUSIC_TIER_ROWS[tierFor(listeners)].venue;
    expect(
      out.lines.some(
        (row) =>
          row.text ===
          (net >= 0
            ? `Toured: ${plan.shows} shows in ${venue}. It cleared ${money(net)} after the road took its share.`
            : `Toured: ${plan.shows} shows in ${venue}. It lost ${money(-net)} once the road took its share.`),
      ),
    ).toBe(true);
  });

  it('keeps a loss on the road out of the pay and in the costs', () => {
    const found = firstSeed(
      'edge-loss',
      () => {
        for (let craft = 20; craft < 60; craft += 5) {
          for (let listeners = MIN_TOUR_LISTENERS; listeners < 24_000; listeners += 100) {
            const tour = tourFor(tierFor(listeners), listeners, craft);
            if (tour.door < tour.costs) return { craft, listeners, tour };
          }
        }
        return undefined;
      },
      1,
    );
    const base = rich(
      known(adult('edge-loss'), {
        craft: found.craft,
        listeners: found.listeners,
        peak: found.listeners,
        catalogue: 40,
        plan: { single: 0, ep: 0, lp: 0, tour: true },
      }),
    );
    const out = yearOf(base);
    expect(out.music.tours).toBe(1);
    const average = (found.listeners + out.music.listeners) / 2;
    const streaming = average * STREAMS_PER_LISTENER * STREAM_PAYOUT * (1 - DISTRIBUTOR_CUT);
    expect(out.pay).toBe(Math.round(streaming));
    expect(out.costs).toBe(Math.round(found.tour.costs - found.tour.door));
  });
});

describe('the edges of an award', () => {
  const star = (patch: Partial<MusicState> = {}) =>
    rich(
      known(adult('edge-award'), {
        craft: MUSIC_AWARD_LINE,
        listeners: 8_000_000,
        peak: 8_000_000,
        catalogue: 40,
        reputation: 50,
        plan: { single: 1, ep: 0, lp: 0, tour: false },
        ...patch,
      }),
    );
  const chance = Math.min(
    MUSIC_TIER_ROWS.national.awardChance,
    MUSIC_TIER_ROWS.headliner.awardChance,
  );

  it('is won at exactly the line, with the rung’s own chance and a name that stops at a hundred', () => {
    const base = star({ reputation: 95 });
    const year = firstYear(
      base.world.year + 1,
      (candidate) =>
        qualityOf(base, candidate, 0, MUSIC_AWARD_LINE) === MUSIC_AWARD_LINE &&
        musUnit(seedOf(base), genOf(base), 'award', candidate) < chance
          ? candidate
          : undefined,
      8_000,
    );
    const out = yearOf(base, base.player.age + 1, year);
    expect(out.music.awards).toBe(1);
    expect(out.music.reputation).toBe(100);
  });

  it('goes to the best of the year’s records, and is judged at the rung the year ended on', () => {
    const base = star({ plan: { single: 2, ep: 0, lp: 0, tour: false } });
    const year = firstYear(
      base.world.year + 1,
      (candidate) =>
        qualityOf(base, candidate, 0, MUSIC_AWARD_LINE) < MUSIC_AWARD_LINE &&
        qualityOf(base, candidate, 1, MUSIC_AWARD_LINE) >= MUSIC_AWARD_LINE &&
        musUnit(seedOf(base), genOf(base), 'award', candidate) < chance
          ? candidate
          : undefined,
      8_000,
    );
    const out = yearOf(base, base.player.age + 1, year);
    const title =
      RELEASE_TITLES[
        Math.floor(musUnit(seedOf(base), genOf(base), 'title', year, 1) * RELEASE_TITLES.length)
      ]!;
    expect(out.lines.some((row) => row.text.includes(`for "${title}".`))).toBe(true);
    // A year that ends a rung lower is judged at the lower rung's chance.
    const falling = star({ craft: 95, listeners: 3_100_000, peak: 3_100_000 });
    const between = firstYear(
      falling.world.year + 1,
      (candidate) => {
        const draw = musUnit(seedOf(falling), genOf(falling), 'award', candidate);
        return draw >= MUSIC_TIER_ROWS.national.awardChance &&
          draw < MUSIC_TIER_ROWS.headliner.awardChance &&
          qualityOf(falling, candidate, 0, 95) >= MUSIC_AWARD_LINE
          ? candidate
          : undefined;
      },
      4_000,
    );
    const fell = yearOf(falling, falling.player.age + 1, between);
    expect(tierFor(fell.music.listeners)).toBe('national');
    expect(fell.music.awards).toBe(0);
  });
});

describe('the edges of a tour’s size', () => {
  it('does not go under three quarters or over five quarters of the draw, however bad or good the records', () => {
    expect(tourFor('club', 20_000, 0)).toEqual(tourFor('club', 20_000, 40));
    expect(tourFor('club', 20_000, 100)).toEqual(tourFor('club', 20_000, 90));
  });
});

/** Money that arrives the way money does: through the ledger, so a whole year can be run over it (CORE_RULES 13.184). */
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

describe('what a musician’s year does to the rest of the life', () => {
  const state = (patch: Partial<MusicState>) => {
    const base = adult('wired');
    return {
      ...windfall(withMusic(base, patch), 20_000),
      household: { ...base.household, standard: 30_000 },
    };
  };
  const paying = (advance: number, paid: boolean) =>
    state({
      craft: 70,
      released: { single: 2, ep: 0, lp: 0 },
      deal: deal({ advance, paid, left: 3 }),
    });

  it('lets a big music income raise the household’s standard of living', () => {
    const big = advanceYear(answerOthers(paying(400_000, false))).state;
    const none = advanceYear(answerOthers(paying(400_000, true))).state;
    expect(big.household.standard).toBeGreaterThan(none.household.standard);
  });

  it('is taxed under a deal’s income: what a deal earned is taxed over what the music paid', () => {
    const base = paying(400_000, false);
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

  it('puts lessons in the ledger as spending', () => {
    const base = state({ craft: 60, lessons: { since: 20, seasons: 1 } });
    const own = {
      ...base,
      household: { ...base.household, housing: 'ownPlace' as const, standard: 60_000 },
    };
    const next = advanceYear(answerOthers(own)).state;
    const row = next.finance.transactions.find(
      (entry) => entry.year === next.world.year && entry.source === 'Music lessons',
    );
    expect(row?.category).toBe('spending');
    expect(Number(row?.amount)).toBe(-200_000);
  });

  it('brings people to the Music channel with the records', () => {
    const opened = openChannel(windfall(adult('wired-channel'), 20_000), 'video', 'music');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const base = withMusic(opened.value, {
      craft: 70,
      listeners: 5_000,
      peak: 5_000,
      released: { single: 3, ep: 0, lp: 0 },
      catalogue: 6,
      plan: { single: 3, ep: 0, lp: 0, tour: false },
    });
    const control = withMusic(base, { plan: EMPTY_PLAN });
    const withRecords = advanceYear(answerOthers(base)).state;
    const without = advanceYear(answerOthers(control)).state;
    expect(withRecords.channels[0]!.audience).toBeGreaterThan(without.channels[0]!.audience);
  });
});
