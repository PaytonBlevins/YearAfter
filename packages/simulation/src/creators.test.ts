/**
 * Ticket 0701 acceptance tests — the character as a creator
 * (simulation side).
 */

import { describe, expect, it } from 'vitest';
import { CREATOR_LINES, SPONSOR_KIND, findPlatform } from '@yearafter/content';
import { cents } from '@yearafter/core';
import {
  reconcile,
  totalFor,
  channelIncome,
  channelYear,
  creatorHours,
  sponsorOffersFor,
  creep,
  householdScale,
  standardTargetFor,
  type Channel,
  type PrivateDeal,
} from '@yearafter/finance';
import { advanceYear } from './advance';
import { dealTaxOn } from './deals';
import { trendsFor, chartRank, chartTierOf } from '@yearafter/finance';
import { businessTaxOn, earnedOf } from './businesses';
import { continueAsChild, heirsIn } from './continue';
import {
  answerSponsorOffer,
  chartStandings,
  closeChannel,
  openChannel,
  placeOf,
  sponsorOffers,
  trendsOn,
  qualityOf,
  runCreatorsYear,
  setChannelEffort,
  setPaidTier,
  whyNotChannel,
} from './creators';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { earnedIncomeOf } from './vehicles';

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

function liveTo(seed: string, age: number): GameState {
  let state = createNewGame({ seed });
  let guard = 0;
  while (state.player.alive && state.player.age < age && (guard += 1) < 80) {
    state = answerEverything(advanceYear(state).state);
  }
  return state;
}

const ADULT = liveTo('creators-adult', 25);
const TEEN = liveTo('creators-teen', 15);
const withCash = (state: GameState, dollars: number): GameState => {
  const books = {
    ...state.finance,
    balance: cents(dollars * 100),
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:test-${dollars}`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: cents(dollars * 100 - Number(state.finance.balance)),
        source: 'A test windfall',
      },
    ],
  };
  return { ...state, finance: books, player: { ...state.player, cash: books.balance } };
};

const opened = (state: GameState, platformId = 'video', categoryId = 'gaming'): GameState => {
  const result = openChannel(withCash(state, 5_000), platformId, categoryId);
  if (!result.ok) throw new Error(`refused: ${result.error.kind}`);
  return result.value;
};

describe('opening a channel', () => {
  it('takes the gear money at once, writes it down, and starts at nobody', () => {
    const before = withCash(ADULT, 5_000);
    const result = openChannel(before, 'video', 'gaming');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value;
    expect(next.channels).toHaveLength(1);
    expect(next.channels[0]!.audience).toBe(0);
    expect(next.channels[0]!.since).toBe(before.world.year);
    const cost = findPlatform('video')!.startCost;
    expect(Number(next.player.cash)).toBe(Number(before.player.cash) - cost * 100);
    const row = next.finance.transactions.at(-1)!;
    expect(row.category).toBe('spending');
    expect(Number(row.amount)).toBe(-cost * 100);
    expect(row.source).toContain(next.channels[0]!.name);
    expect(next.player.timeline.at(-1)!.text).toContain(next.channels[0]!.name);
    expect(before.channels).toHaveLength(0);
  });

  it('leaves the books reconciling', () => {
    expect(reconcile(opened(ADULT).finance).ok).toBe(true);
  });

  it('refuses the young, the broke, a repeat, and an unsuitable pairing, and changes nothing', () => {
    const kid = liveTo('creators-child', 13);
    expect(whyNotChannel(withCash(kid, 5_000), 'video', 'gaming')).toEqual({
      kind: 'tooYoung',
      age: 14,
    });
    const broke = openChannel(withCash(ADULT, 10), 'video', 'gaming');
    expect(broke).toEqual({ ok: false, error: { kind: 'notEnoughMoney', needed: 600 } });
    const once = opened(ADULT);
    expect(openChannel(once, 'video', 'gaming')).toEqual({
      ok: false,
      error: { kind: 'alreadyHaveOne' },
    });
    expect(openChannel(withCash(ADULT, 5_000), 'podcast', 'gaming')).toEqual({
      ok: false,
      error: { kind: 'notSuitable' },
    });
    expect(ADULT.channels).toHaveLength(0);
  });

  it('lets a fifteen-year-old start on video but not a podcast', () => {
    expect(whyNotChannel(withCash(TEEN, 5_000), 'video', 'gaming')).toBeUndefined();
    expect(whyNotChannel(withCash(TEEN, 5_000), 'podcast', 'comedy')).toEqual({
      kind: 'tooYoung',
      age: 16,
    });
  });

  it('cannot reroll its luck by closing and reopening in the same year, but a later year is new', () => {
    const first = opened(ADULT);
    const closed = closeChannel(first, first.channels[0]!.id);
    if (!closed.ok) throw new Error('close refused');
    const again = openChannel(withCash(closed.value, 5_000), 'video', 'gaming');
    if (!again.ok) throw new Error('refused');
    expect(again.value.channels[0]!.luck).toBe(first.channels[0]!.luck);
    const later = { ...closed.value, world: { ...closed.value.world, year: first.world.year + 1 } };
    const laterOpen = openChannel(withCash(later, 5_000), 'video', 'gaming');
    if (!laterOpen.ok) throw new Error('refused');
    expect(laterOpen.value.channels[0]!.luck).not.toBe(first.channels[0]!.luck);
  });
});

describe('effort and closing', () => {
  it('sets effort on one channel and leaves the other alone', () => {
    const two = opened(opened(ADULT), 'stream', 'gaming');
    const [a, b] = two.channels;
    const result = setChannelEffort(two, a!.id, 'heavy');
    if (!result.ok) throw new Error('refused');
    expect(result.value.channels.find((c) => c.id === a!.id)!.effort).toBe('heavy');
    expect(result.value.channels.find((c) => c.id === b!.id)!.effort).toBe('regular');
    expect(two.channels[0]!.effort).toBe('regular');
  });

  it('refuses a channel that is not there', () => {
    const one = opened(ADULT);
    expect(setChannelEffort(one, 'nope', 'light')).toEqual({
      ok: false,
      error: { kind: 'noSuchChannel' },
    });
    expect(closeChannel(one, 'nope')).toEqual({ ok: false, error: { kind: 'noSuchChannel' } });
  });

  it('closes one, removes only it, and says so on the timeline', () => {
    const two = opened(opened(ADULT), 'stream', 'gaming');
    const gone = two.channels[0]!;
    const result = closeChannel(two, gone.id);
    if (!result.ok) throw new Error('refused');
    expect(result.value.channels.map((c) => c.id)).toEqual([two.channels[1]!.id]);
    expect(result.value.player.timeline.at(-1)!.text).toContain(gone.name);
    expect(result.value.player.cash).toBe(two.player.cash);
  });
});

describe('what skill and talent do', () => {
  it('reads the category’s two stats, and a talent adds a head start', () => {
    const stats = { charisma: 80, willpower: 40 };
    expect(qualityOf(stats, {}, 'gaming')).toBeCloseTo(0.6 + 0.8 * 0.6, 10);
    expect(qualityOf({ smarts: 100, discipline: 100 }, { academics: true }, 'education')).toBe(1.5);
    expect(qualityOf({ smarts: 50, discipline: 50 }, { academics: true }, 'education')).toBeCloseTo(
      1.15,
      10,
    );
    expect(
      qualityOf({ smarts: 50, discipline: 50 }, { academics: false }, 'education'),
    ).toBeCloseTo(1, 10);
    // Gaming names no talent, so none can help it.
    expect(
      qualityOf({ charisma: 50, willpower: 50 }, { acting: true, music: true }, 'gaming'),
    ).toBeCloseTo(1, 10);
  });

  it('treats a missing stat as average and an unknown category as an average maker', () => {
    expect(qualityOf({}, {}, 'gaming')).toBeCloseTo(1, 10);
    expect(qualityOf({}, {}, 'nope')).toBeCloseTo(1, 10);
    expect(qualityOf({ charisma: Number.NaN, willpower: 50 }, {}, 'gaming')).toBeCloseTo(1, 10);
  });
});

describe('a year of channels', () => {
  const big: Channel = {
    ...opened(ADULT).channels[0]!,
    luck: 0.99999,
    audience: 200_000,
    peak: 200_000,
  };
  const year = (channels: readonly Channel[], fame = 0) =>
    runCreatorsYear({
      channels,
      fame,
      year: 2040,
      stats: { charisma: 50, willpower: 50 },
      talents: {},
    });

  it('posts what a channel earned and, separately, what keeping it cost', () => {
    const result = year([big]);
    const rows = result.transactions;
    const income = rows.find((row) => Number(row.amount) > 0)!;
    const upkeep = rows.find((row) => Number(row.amount) < 0)!;
    expect(income.category).toBe('creator');
    expect(upkeep.category).toBe('creator');
    expect(upkeep.source).toContain('Upkeep');
    expect(Number(upkeep.amount)).toBe(-15_000);
    expect(result.gross).toBe(Math.round(Number(income.amount) / 100));
    expect(result.net).toBe(result.gross - 150);
  });

  it('posts only the upkeep for a channel under the threshold, and taxes nothing', () => {
    const small = { ...big, luck: 0, audience: 0, peak: 0 };
    const result = year([small]);
    expect(result.transactions).toHaveLength(1);
    expect(result.gross).toBe(0);
    expect(result.net).toBe(0);
  });

  it('does not let a loss become negative taxable income', () => {
    const small = { ...big, luck: 0, audience: 0, peak: 0 };
    expect(year([small, small, small]).net).toBe(0);
  });

  it('adds channels together', () => {
    const second = { ...big, id: 'b', platformId: 'photo', categoryId: 'lifestyle' };
    const both = year([big, second]);
    expect(both.gross).toBe(year([big]).gross + year([second]).gross);
    expect(both.channels).toHaveLength(2);
  });

  it('raises fame toward the audience and carries it', () => {
    const first = year([big]);
    expect(first.fame).toBeGreaterThan(0);
    const settled = year([big], 100);
    expect(settled.fame).toBeLessThan(100);
    expect(settled.fame).toBeGreaterThan(first.fame);
  });

  it('says what happened in words, with the channel’s name in them', () => {
    const crossing = { ...big, luck: 0.99999, audience: 700, peak: 700 };
    const result = year([crossing]);
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines[0]).toContain(crossing.name);
    expect(result.lines[0]).not.toMatch(/[{}]/);
  });

  it('has nothing to say, and nothing to pay, with no channels', () => {
    const none = year([], 0);
    expect(none.transactions).toEqual([]);
    expect(none.lines).toEqual([]);
    expect(none.fame).toBe(0);
  });
});

describe('the year, in the game', () => {
  const lucky = (state: GameState, audience: number): GameState => ({
    ...state,
    channels: state.channels.map((c) => ({ ...c, luck: 0.99999, audience, peak: audience })),
  });

  it('adds a channel to the year’s income and taxes its net, on top of nothing else, for somebody who has no job', () => {
    const state = lucky(opened(TEEN), 200_000);
    const next = advanceYear(state).state;
    const year = next.world.year;
    const rows = next.finance.transactions.filter((row) => row.year === year);
    const earned = rows.filter((r) => r.category === 'creator');
    const net = earned.reduce((sum, r) => sum + Number(r.amount), 0) / 100;
    expect(net).toBeGreaterThan(1_000);
    const salary =
      Number(totalFor(next.finance, 'salary', year)) +
      Number(totalFor(next.finance, 'commission', year));
    expect(salary).toBe(0);
    const tax = rows.find((r) => r.category === 'tax' && r.source === 'Tax on creator income')!;
    expect(tax).toBeDefined();
    expect(-Number(tax.amount) / 100).toBe(businessTaxOn(0, net));
    expect(reconcile(next.finance).ok).toBe(true);
  });

  it('pays nothing and taxes nothing for a channel nobody has found, but still costs upkeep', () => {
    const state = opened(TEEN);
    const next = advanceYear(state).state;
    const rows = next.finance.transactions.filter((row) => row.year === next.world.year);
    expect(rows.some((r) => r.source === 'Tax on creator income')).toBe(false);
    expect(rows.filter((r) => r.category === 'creator').map((r) => Number(r.amount))).toEqual([
      -15_000,
    ]);
  });

  it('grows an audience over several years, raises fame, and keeps both when saved and moved on', () => {
    let state = lucky(opened(TEEN), 1_000);
    for (let i = 0; i < 4; i += 1) state = answerEverything(advanceYear(state).state);
    expect(state.channels[0]!.audience).toBeGreaterThan(1_000);
    expect(state.fame).toBeGreaterThan(0);
    expect(state.channels[0]!.peak).toBeGreaterThanOrEqual(state.channels[0]!.audience);
    expect(Number(state.channels[0]!.earned)).toBeGreaterThan(0);
  });

  it('lets the household live on what a channel brought in', () => {
    const base = advanceYear(TEEN).state;
    const rich = advanceYear(lucky(opened(TEEN), 1_000_000)).state;
    const spent = (s: GameState) => -Number(totalFor(s.finance, 'living', s.world.year));
    expect(spent(rich)).toBeGreaterThanOrEqual(spent(base));
  });

  it('counts a channel as earned income for the year, for a lender and for a car dealer', () => {
    const next = advanceYear(lucky(opened(TEEN), 200_000)).state;
    const net = Number(totalFor(next.finance, 'creator', next.world.year)) / 100;
    expect(earnedIncomeOf(next)).toBeGreaterThanOrEqual(Math.round(net));
    expect(earnedOf(next)).toBeGreaterThanOrEqual(Math.round(net));
    expect(earnedOf(next)).toBeGreaterThan(0);
  });

  it('is the same on every reload: the same seed gives the same channel year', () => {
    const a = advanceYear(lucky(opened(TEEN), 5_000)).state;
    const b = advanceYear(lucky(opened(TEEN), 5_000)).state;
    expect(a.channels).toEqual(b.channels);
    expect(a.fame).toBe(b.fame);
  });

  it('pays what the platform’s own table says at the audience reached', () => {
    const state = lucky(opened(TEEN), 50_000);
    const next = advanceYear(state).state;
    const channel = next.channels[0]!;
    const platform = findPlatform('video')!;
    const gross = Number(
      next.finance.transactions.find(
        (r) => r.category === 'creator' && Number(r.amount) > 0 && r.year === next.world.year,
      )!.amount,
    );
    const expected = channelIncome(
      platform,
      { pays: 0.8 } as never,
      Math.round((50_000 + channel.audience) / 2),
      'regular',
    );
    expect(gross / 100).toBe(expected);
  });
});

describe('the year, in the game: what reaches the tax, the household and the page', () => {
  const grown = (state: GameState, audience: number, over: Partial<Channel> = {}): GameState => ({
    ...state,
    channels: state.channels.map((c) => ({
      ...c,
      luck: 0.99999,
      audience,
      peak: audience,
      ...over,
    })),
  });
  const rows = (state: GameState) =>
    state.finance.transactions.filter((r) => r.year === state.world.year);

  it('stacks a channel on top of a wage: the tax is on the net, over what the job paid', () => {
    const next = advanceYear(grown(opened(ADULT), 3_000_000)).state;
    const year = next.world.year;
    const wage =
      (Number(totalFor(next.finance, 'salary', year)) +
        Number(totalFor(next.finance, 'commission', year))) /
      100;
    expect(wage).toBeGreaterThan(0);
    const net = Number(totalFor(next.finance, 'creator', year)) / 100;
    const tax = rows(next).find((r) => r.source === 'Tax on creator income')!;
    expect(-Number(tax.amount) / 100).toBe(businessTaxOn(wage, net));
    expect(businessTaxOn(wage, net)).toBeGreaterThan(businessTaxOn(0, net));
  });

  it('stacks it on a deal too: what a deal earned is taxed over what the channel paid', () => {
    const base = grown(opened(ADULT), 3_000_000);
    const deal: PrivateDeal = {
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
    const withDeal = { ...base, deals: [deal] };
    const next = advanceYear(withDeal).state;
    const year = next.world.year;
    const gain = Number(rows(next).find((r) => r.source === 'Gain — Test Labs')!.amount) / 100;
    expect(gain).toBeGreaterThan(0);
    const wage = Number(totalFor(next.finance, 'salary', year)) / 100;
    const net = Number(totalFor(next.finance, 'creator', year)) / 100;
    const tax = rows(next).find((r) => r.source === 'Tax on deal income')!;
    expect(-Number(tax.amount) / 100).toBe(dealTaxOn(wage + net, gain));
    expect(dealTaxOn(wage + net, gain)).toBeGreaterThan(dealTaxOn(wage, gain));
  });

  it('lets the household live on a channel’s money: a big one raises the standard of living a great deal', () => {
    const plain = advanceYear(withCash(ADULT, 5_000)).state;
    const rich = advanceYear(grown(opened(ADULT), 3_000_000)).state;
    const living = (s: GameState) => -Number(totalFor(s.finance, 'living', s.world.year));
    expect(living(rich)).toBeGreaterThan(living(plain) * 5);
  });

  it('sets the standard of living by what the household kept after tax, the channel’s tax included', () => {
    const start = grown(opened(ADULT), 3_000_000);
    const next = advanceYear(start).state;
    const year = next.world.year;
    const wage =
      (Number(totalFor(next.finance, 'salary', year)) +
        Number(totalFor(next.finance, 'commission', year))) /
      100;
    const wageTax = -Number(rows(next).find((r) => r.source === 'Tax')!.amount) / 100;
    const net = Number(totalFor(next.finance, 'creator', year)) / 100;
    const creatorTax =
      -Number(rows(next).find((r) => r.source === 'Tax on creator income')!.amount) / 100;
    const members = householdScale(false, []);
    const kept = wage - wageTax + net - creatorTax;
    const cash = Math.floor(Number(start.player.cash) / 100);
    const expected = creep(
      start.household.standard,
      standardTargetFor(kept / members, cash / members),
    );
    expect(next.household.standard).toBe(expected);
  });

  it('keeps the books balanced through a very big year', () => {
    const next = advanceYear(grown(opened(ADULT), 3_000_000)).state;
    expect(reconcile(next.finance).ok).toBe(true);
  });

  it('runs a channel’s year on the new year and on the maker’s stats, to the person', () => {
    // Stats at the top do not move in a working year (the 0203 curve tapers to nothing at 100),
    // so the quality the engine used is knowable from outside.
    const base = grown(opened(ADULT), 4_000, { luck: 0.9 });
    const state: GameState = {
      ...base,
      player: { ...base.player, stats: { ...base.player.stats, charisma: 100, willpower: 100 } },
    };
    const next = advanceYear(state).state;
    const expected = channelYear({
      channel: state.channels[0]!,
      year: next.world.year,
      quality: qualityOf({ charisma: 100, willpower: 100 }, {}, 'gaming'),
    });
    // Within a fraction of a point: a working year nudges even a stat at 100 by a hair.
    expect(next.channels[0]!.audience / expected.channel.audience).toBeGreaterThan(0.99);
    expect(next.channels[0]!.audience / expected.channel.audience).toBeLessThan(1.01);
    // And not on any other year.
    const wrongYear = channelYear({
      channel: state.channels[0]!,
      year: next.world.year + 1,
      quality: 1.4,
    });
    expect(Math.abs(wrongYear.channel.audience / expected.channel.audience - 1)).toBeGreaterThan(
      0.015,
    );
  });

  it('lets a better maker’s channel grow further than a worse one’s, from the same start', () => {
    const start = grown(opened(ADULT, 'video', 'comedy'), 4_000, { luck: 0.9 });
    const withStats = (value: number): GameState => ({
      ...start,
      player: {
        ...start.player,
        stats: { ...start.player.stats, charisma: value, happiness: value },
      },
    });
    const good = advanceYear(withStats(100)).state.channels[0]!.audience;
    const poor = advanceYear(withStats(0)).state.channels[0]!.audience;
    expect(good).toBeGreaterThan(poor);
  });

  it('lets a talent help the category that names it, and nobody else’s', () => {
    const start = grown(opened(ADULT, 'video', 'comedy'), 4_000, { luck: 0.9 });
    const talented = (on: boolean): GameState => ({
      ...start,
      player: { ...start.player, talents: { ...start.player.talents, acting: on } },
    });
    expect(advanceYear(talented(true)).state.channels[0]!.audience).toBeGreaterThan(
      advanceYear(talented(false)).state.channels[0]!.audience,
    );
    const gaming = grown(opened(ADULT, 'video', 'gaming'), 4_000, { luck: 0.9 });
    const gamingWith = {
      ...gaming,
      player: { ...gaming.player, talents: { ...gaming.player.talents, acting: true } },
    };
    const gamingWithout = {
      ...gaming,
      player: { ...gaming.player, talents: { ...gaming.player.talents, acting: false } },
    };
    expect(advanceYear(gamingWith).state.channels[0]!.audience).toBe(
      advanceYear(gamingWithout).state.channels[0]!.audience,
    );
  });

  it('writes the year’s news about a channel onto the timeline', () => {
    const next = advanceYear(grown(opened(ADULT), 700)).state;
    const entry = next.player.timeline.find((e) => e.id === `t:${next.world.year}:creator:0`);
    expect(entry).toBeDefined();
    expect(entry!.text).toContain(next.channels[0]!.name);
  });

  it('says nothing and posts nothing for a channel whose platform is gone', () => {
    const ghost: Channel = { ...opened(ADULT).channels[0]!, platformId: 'gone' };
    const result = runCreatorsYear({
      channels: [ghost],
      fame: 0,
      year: 2040,
      stats: {},
      talents: {},
    });
    expect(result.transactions).toEqual([]);
    expect(result.lines).toEqual([]);
  });

  it('gives a better maker a bigger audience in the same year', () => {
    const channel: Channel = { ...opened(ADULT).channels[0]!, luck: 0.9, audience: 4_000 };
    const run = (value: number) =>
      runCreatorsYear({
        channels: [channel],
        fame: 0,
        year: 2040,
        stats: { charisma: value, willpower: value },
        talents: {},
      }).channels[0]!.audience;
    expect(run(100)).toBeGreaterThan(run(0));
  });
});

describe('a new life', () => {
  it('starts an heir with no channels and no fame, whatever the parent had', () => {
    let found: { dead: GameState; heirId: string } | undefined;
    for (const seed of ['heir-a', 'heir-b', 'heir-c']) {
      let state = lucky0(createNewGame({ seed }));
      let guard = 0;
      while (state.player.alive && (guard += 1) < 90)
        state = answerEverything(advanceYear(state).state);
      const heir = heirsIn(state.family)[0];
      if (!state.player.alive && heir) {
        found = { dead: { ...state, channels: ADULT_CHANNELS, fame: 77 }, heirId: heir.id };
        break;
      }
    }
    if (!found) throw new Error('nobody died with an heir');
    expect(found.dead.channels.length).toBeGreaterThan(0);
    const next = continueAsChild(found.dead, found.heirId)!;
    expect(next.channels).toEqual([]);
    expect(next.fame).toBe(0);
  });
});

const ADULT_CHANNELS = opened(ADULT).channels;
const lucky0 = (state: GameState): GameState => state;

/* ===================== Ticket 0702 ===================== */

describe('sponsorships, in the game', () => {
  const big = (state: GameState, audience = 400_000): GameState => ({
    ...state,
    channels: state.channels.map((c) => ({ ...c, luck: 0.99999, audience, peak: audience })),
  });
  /** The same life in a year that brings an offer. The year is only a number to the engine. */
  const withOffer = (from: GameState): GameState => {
    for (let year = from.world.year; year < from.world.year + 200; year += 1) {
      const state = { ...from, world: { ...from.world, year } };
      if (sponsorOffers(state).length > 0) return state;
    }
    throw new Error('no offer in two hundred years');
  };

  it('lists the offers on every channel, and none for a channel too small to be asked', () => {
    const small = opened(ADULT);
    for (let year = small.world.year; year < small.world.year + 50; year += 1) {
      expect(sponsorOffers({ ...small, world: { ...small.world, year } })).toEqual([]);
    }
    const state = withOffer(big(opened(ADULT)));
    const listed = sponsorOffers(state);
    expect(listed.length).toBeGreaterThan(0);
    expect(listed.every((row) => row.channel.id === state.channels[0]!.id)).toBe(true);
    expect(sponsorOffers(state)).toEqual(listed);
    const two = {
      ...state,
      channels: [...state.channels, { ...state.channels[0]!, id: 'ch:b', platformId: 'stream' }],
    };
    expect(new Set(sponsorOffers(two).map((row) => row.channel.id)).size).toBeGreaterThanOrEqual(1);
  });

  it('refuses an offer that is not on the table, and one already answered', () => {
    const state = withOffer(big(opened(ADULT)));
    expect(answerSponsorOffer(state, 'sp:nope', 'accept')).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
    const id = sponsorOffers(state)[0]!.offer.id;
    const done = answerSponsorOffer(state, id, 'decline');
    if (!done.ok) throw new Error('refused');
    expect(answerSponsorOffer(done.value, id, 'accept')).toEqual({
      ok: false,
      error: { kind: 'notOffered' },
    });
    expect(sponsorOffers(done.value).some((row) => row.offer.id === id)).toBe(false);
  });

  it('declining writes a line and changes nothing else', () => {
    const state = withOffer(big(opened(ADULT)));
    const row = sponsorOffers(state)[0]!;
    const result = answerSponsorOffer(state, row.offer.id, 'decline');
    if (!result.ok) throw new Error('refused');
    expect(result.value.player.timeline.at(-1)!.text).toContain(row.offer.brand);
    expect(result.value.channels[0]!.audience).toBe(state.channels[0]!.audience);
    expect(result.value.channels[0]!.owed).toBeUndefined();
    expect(result.value.finance).toBe(state.finance);
    expect(result.value.player.cash).toBe(state.player.cash);
  });

  it('accepting moves no money now, keeps it owed, and costs some trust', () => {
    const state = withOffer(big(opened(ADULT)));
    const row = sponsorOffers(state)[0]!;
    const result = answerSponsorOffer(state, row.offer.id, 'accept');
    if (!result.ok) throw new Error('refused');
    expect(result.value.finance).toBe(state.finance);
    expect(Number(result.value.channels[0]!.owed)).toBe(row.offer.pay * 100);
    expect(result.value.channels[0]!.audience).toBe(Math.round(400_000 * 0.985));
    const text = result.value.player.timeline.at(-1)!.text;
    expect(text).toContain(row.offer.brand);
    expect(text).toContain(`$${row.offer.pay.toLocaleString('en-US')}`);
    const filled = CREATOR_LINES.sponsorTaken.map((line) =>
      line
        .replace('{brand}', row.offer.brand)
        .replace('{name}', state.channels[0]!.name)
        .replace('{pay}', `$${row.offer.pay.toLocaleString('en-US')}`)
        .replace('{kind}', SPONSOR_KIND[row.offer.monetization]!),
    );
    expect(filled).toContain(text);
  });

  it('lists the offers of the year it is, as the engine derives them', () => {
    const state = withOffer(big(opened(ADULT)));
    const channel = state.channels[0]!;
    expect(sponsorOffers(state).map((row) => row.offer)).toEqual(
      sponsorOffersFor({ seed: state.rng.getSeed(), year: state.world.year, channel }),
    );
    const next = { ...state, world: { ...state.world, year: state.world.year + 1 } };
    expect(sponsorOffers(next).map((row) => row.offer)).toEqual(
      sponsorOffersFor({ seed: state.rng.getSeed(), year: state.world.year + 1, channel }),
    );
  });

  it('answers one channel’s offer and leaves the others as they were', () => {
    const base = opened(opened(ADULT), 'podcast', 'comedy');
    const state = withOffer(big(base));
    expect(state.channels).toHaveLength(2);
    const row = sponsorOffers(state)[0]!;
    const other = state.channels.find((c) => c.id !== row.channel.id)!;
    const result = answerSponsorOffer(state, row.offer.id, 'accept');
    if (!result.ok) throw new Error('refused');
    expect(result.value.channels).toHaveLength(2);
    expect(result.value.channels.find((c) => c.id === other.id)).toEqual(other);
    expect(result.value.channels.find((c) => c.id === row.channel.id)!.owed).toBeDefined();
  });

  it('asking for more either raises the pay by 60% or loses the deal, and says which', () => {
    const state = withOffer(big(opened(ADULT)));
    let raised = 0;
    let walked = 0;
    for (let i = 0; i < 60; i += 1) {
      const seeded = { ...state, rng: { ...state.rng, getSeed: () => `more-${i}` } } as GameState;
      const rows = sponsorOffers(seeded);
      if (rows.length === 0) continue;
      const row = rows[0]!;
      const result = answerSponsorOffer(seeded, row.offer.id, 'more');
      if (!result.ok) throw new Error('refused');
      const owed = Number(result.value.channels[0]!.owed ?? 0);
      const channel = seeded.channels[0]!;
      const fill = (lines: readonly string[], pay: number) =>
        lines.map((line) =>
          line
            .replace('{brand}', row.offer.brand)
            .replace('{name}', channel.name)
            .replace('{pay}', `$${pay.toLocaleString('en-US')}`)
            .replace('{kind}', SPONSOR_KIND[row.offer.monetization]!),
        );
      const text = result.value.player.timeline.at(-1)!.text;
      if (owed > 0) {
        raised += 1;
        const pay = Math.round(row.offer.pay * 1.6);
        expect(owed).toBe(pay * 100);
        // The line is a raised line and says the raised figure, not the one first offered.
        expect(fill(CREATOR_LINES.sponsorRaised, pay)).toContain(text);
      } else {
        walked += 1;
        expect(result.value.channels[0]!.audience).toBe(400_000);
        expect(fill(CREATOR_LINES.sponsorWalked, 0)).toContain(text);
      }
    }
    expect(raised).toBeGreaterThan(0);
    expect(walked).toBeGreaterThan(0);
  });

  it('pays what is owed with the year’s income, taxes it with the rest, and clears the books of it', () => {
    const state = withOffer(big(opened(ADULT)));
    const row = sponsorOffers(state)[0]!;
    const took = answerSponsorOffer(state, row.offer.id, 'accept');
    if (!took.ok) throw new Error('refused');
    const declined = answerSponsorOffer(state, row.offer.id, 'decline');
    if (!declined.ok) throw new Error('refused');
    const withDeal = advanceYear(took.value).state;
    const without = advanceYear(declined.value).state;
    const year = withDeal.world.year;
    const creatorOf = (s: GameState) => Number(totalFor(s.finance, 'creator', year)) / 100;
    // The deal's trust cost shrinks the audience, so the gap is the deal less the income that
    // audience would have earned. The platform's trust cost bounds that loss: income can't fall
    // faster than the audience does.
    const gap = creatorOf(withDeal) - creatorOf(without);
    const channel = withDeal.channels.find((c) => c.id === row.offer.channelId)!;
    const trust = findPlatform(channel.platformId)!.trustCost;
    expect(gap).toBeLessThan(row.offer.pay + 1);
    expect(gap).toBeGreaterThan(row.offer.pay - trust * creatorOf(without));
    const taxOf = (s: GameState) =>
      -Number(
        s.finance.transactions.find((r) => r.year === year && r.source === 'Tax on creator income')!
          .amount,
      ) / 100;
    expect(taxOf(withDeal)).toBeGreaterThan(taxOf(without));
    expect(withDeal.channels[0]!.owed).toBeUndefined();
    expect(withDeal.channels[0]!.answered).toBeUndefined();
    expect(reconcile(withDeal.finance).ok).toBe(true);
  });
});

describe('charts and trends, in the game', () => {
  it('lists where each channel stands, if it is on a chart', () => {
    const state = opened(opened(ADULT), 'photo', 'lifestyle');
    const big: GameState = {
      ...state,
      channels: state.channels.map((c) => ({ ...c, audience: 6_000_000 })),
    };
    const rows = chartStandings(big);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.rank).toBe(chartRank(big.channels[0]!));
    expect(rows[0]!.rank).toBeLessThanOrEqual(1_000);
    expect(rows[1]!.rank).toBeUndefined();
  });

  it('says the top thousand, the top hundred and number one in words', () => {
    expect(placeOf(1_000)).toBe('the top 1,000');
    expect(placeOf(100)).toBe('the top 100');
    expect(placeOf(10)).toBe('the top 10');
    expect(placeOf(1)).toBe('number one');
  });

  it('writes the line the year a channel reaches the chart, with the place in it', () => {
    const state: GameState = {
      ...opened(ADULT),
      channels: opened(ADULT).channels.map((c) => ({
        ...c,
        luck: 0.9999999,
        audience: 5_000_000,
        peak: 5_000_000,
      })),
    };
    const next = advanceYear(state).state;
    const line = next.player.timeline.filter((e) => e.id?.includes(':creator:')).map((e) => e.text);
    const best = next.channels[0]!.bestRank!;
    expect(best).toBeLessThanOrEqual(1_000);
    expect(line.some((text) => text.includes(placeOf(chartTierOf(best))))).toBe(true);
    expect(line.some((text) => text.includes('chart'))).toBe(true);
  });

  it('shows the trends of the year it is', () => {
    expect(trendsOn(ADULT, 'video')).toEqual(trendsFor('video', ADULT.world.year));
    const later = { ...ADULT, world: { ...ADULT.world, year: ADULT.world.year + 7 } };
    expect(trendsOn(later, 'video')).toEqual(trendsFor('video', ADULT.world.year + 7));
    expect(JSON.stringify(trendsOn(later, 'video'))).not.toBe(
      JSON.stringify(trendsOn(ADULT, 'video')),
    );
  });
});

describe('what channels ask of a life', () => {
  it('piles stress on a life with four heavy channels compared with four light ones', () => {
    let state = ADULT;
    for (const [platform, category] of [
      ['video', 'gaming'],
      ['stream', 'gaming'],
      ['photo', 'lifestyle'],
      ['shortform', 'comedy'],
    ] as const) {
      state = opened(state, platform, category);
    }
    const with_ = (effort: 'light' | 'heavy'): GameState => ({
      ...state,
      channels: state.channels.map((c) => ({ ...c, effort })),
    });
    let heavier = 0;
    for (const years of [1, 2, 3]) {
      let light = with_('light');
      let heavy = with_('heavy');
      for (let i = 0; i < years; i += 1) {
        light = answerEverything(advanceYear(light).state);
        heavy = answerEverything(advanceYear(heavy).state);
      }
      if (heavy.player.stress.level > light.player.stress.level) heavier += 1;
    }
    expect(heavier).toBe(3);
  });
});

describe('what channels ask of a life', () => {
  const stressAfter = (state: GameState): number => advanceYear(state).state.player.stress.level;
  const withEffort = (state: GameState, effort: 'light' | 'regular' | 'heavy'): GameState => ({
    ...state,
    channels: state.channels.map((c) => ({ ...c, effort })),
  });
  const many = (count: number): GameState => {
    let state = ADULT;
    const picks: [string, string][] = [
      ['video', 'gaming'],
      ['stream', 'gaming'],
      ['podcast', 'comedy'],
      ['photo', 'lifestyle'],
    ];
    for (const [platform, category] of picks.slice(0, count))
      state = opened(state, platform, category);
    return state;
  };

  it('counts every channel’s hours, and the hours are what reach the stress model', () => {
    const four = withEffort(many(4), 'heavy');
    expect(creatorHours(four.channels)).toBe(36);
    // The same life with no channels is the least stressed; heavy channels cost more than light ones.
    const none = stressAfter(ADULT);
    const light = stressAfter(withEffort(many(1), 'light'));
    const heavy = stressAfter(four);
    expect(heavy).toBeGreaterThan(light);
    expect(heavy).toBeGreaterThan(none);
    expect(light).toBeGreaterThanOrEqual(none);
  });

  it('is nothing to a life with no channels, and more with each hour', () => {
    const one = stressAfter(withEffort(many(1), 'heavy'));
    const four = stressAfter(withEffort(many(4), 'heavy'));
    expect(four).toBeGreaterThan(one);
  });
});

describe('the other three platforms, in the game (0703)', () => {
  const subscription = (): GameState => opened(ADULT, 'subscription', 'business');
  const grown = (state: GameState, over: object = {}): GameState => ({
    ...state,
    channels: state.channels.map((c) => ({
      ...c,
      luck: 0.99999,
      audience: 20_000,
      peak: 20_000,
      ...over,
    })),
  });

  it('lets the character set what a month costs, on a subscription only', () => {
    const state = subscription();
    const id = state.channels[0]!.id;
    const set = setPaidTier(state, id, 'premium');
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.value.channels[0]!.tier).toBe('premium');
    expect(state.channels[0]!.tier).toBeUndefined();
    expect(setPaidTier(state, 'nope', 'low')).toEqual({
      ok: false,
      error: { kind: 'noSuchChannel' },
    });
    const video = opened(ADULT);
    expect(setPaidTier(video, video.channels[0]!.id, 'low')).toEqual({
      ok: false,
      error: { kind: 'notSubscription' },
    });
  });

  it('changes only the channel it was asked about', () => {
    const two = opened(subscription(), 'video', 'gaming');
    const target = two.channels.find((c) => c.platformId === 'subscription')!;
    const set = setPaidTier(two, target.id, 'low');
    if (!set.ok) throw new Error('refused');
    const other = two.channels.find((c) => c.platformId === 'video')!;
    expect(set.value.channels.find((c) => c.id === other.id)).toEqual(other);
    expect(set.value.channels).toHaveLength(2);
  });

  it('pays a year at the price set, and keeps the paying readers on the channel', () => {
    const base = grown(subscription());
    const set = setPaidTier(base, base.channels[0]!.id, 'premium');
    if (!set.ok) throw new Error('refused');
    const standard = advanceYear(base).state;
    const premium = advanceYear(set.value).state;
    const year = standard.world.year;
    const net = (s: GameState) => Number(totalFor(s.finance, 'creator', year));
    expect(standard.channels[0]!.paid).toBeGreaterThan(0);
    expect(premium.channels[0]!.paid).not.toBe(standard.channels[0]!.paid);
    expect(premium.channels[0]!.tier).toBe('premium');
    // Business readers will pay more, so the dearer price wins here.
    expect(net(premium)).toBeGreaterThan(net(standard));
    expect(reconcile(premium.finance).ok).toBe(true);
  });

  it('keeps the readers who pay, and the price, through the years', () => {
    let state = grown(subscription());
    state = { ...state, channels: state.channels.map((c) => ({ ...c, tier: 'low' as const })) };
    const first = advanceYear(state).state;
    const second = advanceYear(answerEverything(first)).state;
    expect(first.channels[0]!.tier).toBe('low');
    expect(second.channels[0]!.tier).toBe('low');
    expect(first.channels[0]!.paid).toBeGreaterThan(0);
    expect(second.channels[0]!.paid).not.toBe(first.channels[0]!.paid);
  });

  it('writes the line when a post takes off, in the year it does', () => {
    const base = opened(ADULT, 'shortform', 'comedy');
    for (let year = 2030; year < 2300; year += 1) {
      const state: GameState = {
        ...grown(base, { audience: 20_000 }),
        world: { ...base.world, year },
      };
      const next = advanceYear(state).state;
      const viral = next.channels[0]!.viralYear;
      const lines = next.player.timeline
        .filter((e) => e.id?.includes(':creator:'))
        .map((e) => e.text);
      if (viral === undefined) {
        expect(lines.some((text) => /took off|passed around/.test(text))).toBe(false);
        continue;
      }
      expect(viral).toBe(year + 1);
      // It says how many people it brought, as a figure.
      expect(lines.some((text) => /(brought in|everywhere:) [\d,]+ new followers/.test(text))).toBe(
        true,
      );
      return;
    }
    throw new Error('no viral year in 270');
  });

  it('puts a deal on the table for each of them, and the paid tier does not stop it', () => {
    for (const [platform, category, audience] of [
      ['photo', 'lifestyle', 400_000],
      ['shortform', 'comedy', 2_000_000],
      ['subscription', 'writing', 200_000],
    ] as const) {
      const state = opened(ADULT, platform, category);
      const sized = {
        ...state,
        channels: state.channels.map((c) => ({ ...c, audience, peak: audience })),
      };
      let found = false;
      for (let year = 2030; year < 2090 && !found; year += 1) {
        const offers = sponsorOffers({ ...sized, world: { ...sized.world, year } });
        if (offers.length > 0) {
          const row = offers[0]!;
          const result = answerSponsorOffer(
            { ...sized, world: { ...sized.world, year } },
            row.offer.id,
            'accept',
          );
          expect(result.ok, platform).toBe(true);
          found = true;
        }
      }
      expect(found, platform).toBe(true);
    }
  });
});
