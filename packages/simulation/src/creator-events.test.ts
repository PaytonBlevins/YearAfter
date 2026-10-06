/**
 * Ticket 0706 acceptance tests — what happens to a creator, and to somebody who is known.
 */

import { describe, expect, it } from 'vitest';
import {
  CREATOR_EVENTS,
  findCelebrityField,
  findCreatorEvent,
  findPlatform,
  type CreatorEventDef,
} from '@yearafter/content';
import { collabGain, fameTarget, newChannel, nextFame, type Channel } from '@yearafter/finance';
import { advanceYear } from './advance';
import { fameAudience } from './celebrity';
import { displayFigure, fameIn } from './celebrity-world';
import { runCreatorsYear } from './creators';
import {
  EVENT_CHANCE,
  MENTION_FROM_FAME,
  MENTION_SHARE,
  drawCreatorEvent,
  effectOf,
  eligibleEvents,
  figureForMention,
  type EventChannel,
  type EventInput,
} from './creator-events';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { openChannel, setChannelEffort } from './creators';
import { cents } from '@yearafter/core';

const SEED = 'ev-seed';
const YEAR = 2060;

function channel(
  platformId: string,
  categoryId: string,
  audience: number,
  effort: 'light' | 'regular' | 'heavy' = 'regular',
): Channel {
  return {
    ...newChannel({
      seed: SEED,
      id: `ch:${platformId}:${categoryId}`,
      platformId,
      categoryId,
      year: 2050,
    }),
    audience,
    peak: audience,
    effort,
    publishing: { year: YEAR - 1, count: 12, kind: 'vlog', gained: 0 },
  };
}

const entry = (c: Channel, gross = 0): EventChannel => ({ channel: c, gross });

const input = (over: Partial<EventInput> = {}): EventInput => ({
  key: 'k1',
  seed: SEED,
  year: YEAR,
  fame: 0,
  channels: [],
  ...over,
});

const idsOf = (i: EventInput): string[] => eligibleEvents(i).map((plan) => plan.def.id);

describe('who an event can happen to', () => {
  it('nobody with no channel and no name has anything happen', () => {
    expect(eligibleEvents(input())).toEqual([]);
    expect(drawCreatorEvent(input())).toBeUndefined();
  });

  it('a name with no channel still has the odd thing happen, from eight in a hundred', () => {
    expect(idsOf(input({ fame: 7 }))).toEqual([]);
    expect(idsOf(input({ fame: 8 }))).toEqual(['recognized']);
    expect(idsOf(input({ fame: 40 }))).toContain('recognized');
    expect(idsOf(input({ fame: 41 }))).not.toContain('recognized');
    expect(idsOf(input({ fame: 14 }))).not.toContain('photoAsk');
    expect(idsOf(input({ fame: 15 }))).toContain('photoAsk');
    expect(idsOf(input({ fame: 60 }))).toContain('photoAsk');
    expect(idsOf(input({ fame: 61 }))).not.toContain('photoAsk');
    expect(idsOf(input({ fame: 100 }))).toContain('invited');
    expect(idsOf(input({ fame: 39 }))).not.toContain('invited');
    expect(idsOf(input({ fame: 29 }))).not.toContain('tabloid');
    expect(idsOf(input({ fame: 30 }))).toContain('tabloid');
  });

  it('a channel with nobody watching only has its gear break or a first fan write', () => {
    expect(idsOf(input({ channels: [entry(channel('video', 'gaming', 0))] })).sort()).toEqual([
      'firstFan',
      'gearFails',
    ]);
  });

  it('a shout-out needs a hundred people and one of the five platforms where it happens', () => {
    const at = (platform: string, category: string, n: number) =>
      idsOf(input({ channels: [entry(channel(platform, category, n))] }));
    expect(at('video', 'gaming', 99)).not.toContain('shoutout');
    expect(at('video', 'gaming', 100)).toContain('shoutout');
    expect(at('subscription', 'writing', 5_000)).not.toContain('shoutout');
    expect(at('podcast', 'comedy', 5_000)).toContain('shoutout');
  });

  it('what is paid for needs a channel past its platform’s threshold, and exactly there', () => {
    const paysAt = findPlatform('video')!.paysAt;
    const at = (n: number) => idsOf(input({ channels: [entry(channel('video', 'gaming', n))] }));
    expect(at(paysAt - 1)).not.toContain('brandCall');
    expect(at(paysAt - 1)).not.toContain('payRules');
    expect(at(paysAt)).toContain('brandCall');
    expect(at(paysAt)).toContain('payRules');
    expect(at(paysAt)).toContain('claim');
    // A claim is for platforms with something to claim.
    const photo = idsOf(input({ channels: [entry(channel('photo', 'lifestyle', 50_000))] }));
    expect(photo).not.toContain('claim');
    expect(photo).toContain('brandCall');
  });

  it('keeps a category’s events to the categories they name', () => {
    const at = (category: string) =>
      idsOf(input({ channels: [entry(channel('video', category, 5_000))] }));
    expect(at('gaming')).not.toContain('pressLink');
    expect(at('education')).toContain('pressLink');
    expect(at('gaming')).not.toContain('backlash');
    expect(at('comedy')).toContain('backlash');
  });

  it('burns out only a channel run flat out, and only one somebody is watching', () => {
    const at = (effort: 'light' | 'regular' | 'heavy', n = 500) =>
      idsOf(input({ channels: [entry(channel('video', 'gaming', n, effort))] }));
    expect(at('light')).not.toContain('burnout');
    expect(at('regular')).not.toContain('burnout');
    expect(at('heavy')).toContain('burnout');
    expect(at('heavy', 49)).not.toContain('burnout');
    expect(at('heavy', 50)).toContain('burnout');
  });

  it('asks a famous figure to mention a channel only when there is one, and from three hundred people', () => {
    const at = (n: number) => idsOf(input({ channels: [entry(channel('video', 'gaming', n))] }));
    expect(at(299)).not.toContain('famousMention');
    expect(at(300)).toContain('famousMention');
    const plan = eligibleEvents(
      input({ channels: [entry(channel('video', 'gaming', 5_000))] }),
    ).find((p) => p.def.id === 'famousMention')!;
    expect(plan.figure).toBeDefined();
    expect(fameIn(plan.figure!, YEAR)).toBeGreaterThanOrEqual(MENTION_FROM_FAME);
  });

  it('picks one of the channels that fit, and the same one every time', () => {
    const a = channel('video', 'gaming', 5_000);
    const b = channel('podcast', 'comedy', 5_000);
    const plans = eligibleEvents(input({ channels: [entry(a), entry(b)] }));
    const first = plans.find((p) => p.def.id === 'shoutout')!.channel!.channel.id;
    expect(
      eligibleEvents(input({ channels: [entry(b), entry(a)] })).find(
        (p) => p.def.id === 'shoutout',
      )!.channel!.channel.id,
    ).toBe(first);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      seen.add(
        eligibleEvents(input({ key: `k${i}`, channels: [entry(a), entry(b)] })).find(
          (p) => p.def.id === 'shoutout',
        )!.channel!.channel.id,
      );
    }
    expect(seen.size).toBe(2);
  });
});

describe('the figure behind a mention', () => {
  it('is somebody known, the same one for the same key, and weighted to the better known', () => {
    const f = figureForMention(SEED, YEAR, 'a')!;
    expect(fameIn(f, YEAR)).toBeGreaterThanOrEqual(MENTION_FROM_FAME);
    expect(figureForMention(SEED, YEAR, 'a')!.id).toBe(f.id);
    let total = 0;
    const n = 600;
    for (let i = 0; i < n; i += 1) total += fameIn(figureForMention(SEED, YEAR, `m${i}`)!, YEAR);
    // Fame-weighted, so the average figure is well above the least known one allowed.
    expect(total / n).toBeGreaterThan(MENTION_FROM_FAME + 12);
  });
});

describe('whether anything happens', () => {
  const channels = [entry(channel('video', 'gaming', 5_000, 'regular'), 3_000)];

  it('is the same year every time', () => {
    for (let i = 0; i < 30; i += 1) {
      const a = drawCreatorEvent(input({ key: `d${i}`, channels }));
      const b = drawCreatorEvent(input({ key: `d${i}`, channels }));
      expect(a?.def.id).toBe(b?.def.id);
    }
  });

  it('leaves about half of years quiet, as the share says', () => {
    let quiet = 0;
    const years = 4_000;
    for (let i = 0; i < years; i += 1) {
      if (drawCreatorEvent(input({ key: `q${i}`, channels })) === undefined) quiet += 1;
    }
    expect(EVENT_CHANCE).toBe(0.45);
    expect(quiet / years).toBeGreaterThan(1 - 0.45 - 0.04);
    expect(quiet / years).toBeLessThan(1 - 0.45 + 0.04);
  });

  it('draws events in proportion to their weight', () => {
    const plans = eligibleEvents(input({ channels }));
    const weights = new Map(plans.map((p) => [p.def.id, p.def.weight]));
    const total = [...weights.values()].reduce((a, b) => a + b, 0);
    const counts = new Map<string, number>();
    let drawn = 0;
    for (let i = 0; i < 30_000; i += 1) {
      const plan = drawCreatorEvent(input({ key: `w${i}`, channels }));
      if (plan === undefined) continue;
      drawn += 1;
      counts.set(plan.def.id, (counts.get(plan.def.id) ?? 0) + 1);
    }
    for (const [id, weight] of weights) {
      expect((counts.get(id) ?? 0) / drawn, id).toBeGreaterThan((weight / total) * 0.75);
      expect((counts.get(id) ?? 0) / drawn, id).toBeLessThan((weight / total) * 1.25);
    }
  });

  it('is its own luck for an heir, and for each year', () => {
    const run = (key: string): (string | undefined)[] =>
      Array.from(
        { length: 200 },
        (_, i) => drawCreatorEvent(input({ key: `${key}:${i}`, channels }))?.def.id,
      );
    expect(run('gen0')).not.toEqual(run('gen1'));
  });
});

describe('what an event does', () => {
  const big = channel('video', 'education', 20_000);
  const wide = (c: Channel, gross = 10_000): EventInput =>
    input({ channels: [entry(c, gross)], fame: 0 });
  const plan = (id: string, c: Channel = big, gross = 10_000, fame = 0) => {
    const i = input({ channels: [entry(c, gross)], fame });
    const found = eligibleEvents(i).find((p) => p.def.id === id);
    if (found === undefined) throw new Error(`${id} not eligible`);
    return { effect: effectOf(found, i), plan: found, i };
  };
  void wide;

  it('brings a share of the audience in a shout-out, inside its range, and says how many', () => {
    for (let n = 0; n < 40; n += 1) {
      const i = input({ key: `s${n}`, channels: [entry(big, 10_000)] });
      const found = eligibleEvents(i).find((p) => p.def.id === 'shoutout')!;
      const effect = effectOf(found, i);
      const share = effect.audience / big.audience;
      expect(share).toBeGreaterThanOrEqual(0.06 - 1e-4);
      expect(share).toBeLessThanOrEqual(0.15 + 1e-4);
      expect(effect.text).toContain(big.name);
      expect(effect.text).toContain(effect.audience.toLocaleString('en-US'));
      expect(effect.text).not.toMatch(/[{}]/);
      expect(effect.income).toBe(0);
      expect(effect.cost).toBe(0);
    }
  });

  it('loses a share of the audience to an algorithm change, never more than it has, and says so', () => {
    const { effect } = plan('algorithm');
    expect(effect.audience).toBeLessThan(0);
    expect(effect.audience / big.audience).toBeGreaterThanOrEqual(-0.14 - 1e-4);
    expect(effect.audience / big.audience).toBeLessThanOrEqual(-0.06 + 1e-4);
    expect(effect.text).toContain(Math.abs(effect.audience).toLocaleString('en-US'));
    const small = channel('video', 'gaming', 500);
    expect(
      effectOf(
        eligibleEvents(input({ channels: [entry(small)] })).find((p) => p.def.id === 'algorithm')!,
        input({ channels: [entry(small)] }),
      ).audience,
    ).toBeGreaterThan(-500 - 1);
  });

  it('pays a brand job as a share of the year’s income, never under the floor', () => {
    const rich = plan('brandCall', big, 50_000).effect;
    expect(rich.income).toBeGreaterThanOrEqual(0.12 * 50_000 - 1);
    expect(rich.income).toBeLessThanOrEqual(0.3 * 50_000 + 1);
    expect(rich.text).toContain(`$${rich.income.toLocaleString('en-US')}`);
    expect(rich.incomeSource).toBe(`${big.name}: A brand job`);
    const poor = plan('brandCall', big, 100).effect;
    expect(poor.income).toBe(300);
  });

  it('holds back some of what a claim freezes, never more than the channel made, and costs the paperwork', () => {
    const flush = plan('claim', big, 20_000).effect;
    expect(flush.income).toBeLessThan(0);
    expect(-flush.income).toBeGreaterThanOrEqual(0.08 * 20_000 - 1);
    expect(-flush.income).toBeLessThanOrEqual(0.2 * 20_000 + 1);
    expect(flush.cost).toBeGreaterThanOrEqual(150);
    expect(flush.incomeSource).toBe(`${big.name}: Held back by a claim`);
    expect(flush.costSource).toBe(`${big.name}: Clearing a claim`);
    expect(flush.text).toContain(`$${flush.cost.toLocaleString('en-US')}`);
    const broke = plan('claim', big, 40).effect;
    expect(-broke.income).toBeLessThanOrEqual(40);
  });

  it('costs a share of the platform’s start-up cost when gear fails, never under the floor', () => {
    const start = findPlatform('video')!.equipmentCost;
    for (let n = 0; n < 40; n += 1) {
      const i = input({ key: `g${n}`, channels: [entry(big)] });
      const effect = effectOf(
        eligibleEvents(i).find((p) => p.def.id === 'gearFails')!,
        i,
      );
      expect(effect.cost).toBeGreaterThanOrEqual(Math.max(100, Math.round(start * 0.4)) - 1);
      expect(effect.cost).toBeLessThanOrEqual(Math.round(start * 2) + 1);
      expect(effect.text).toContain(`$${effect.cost.toLocaleString('en-US')}`);
      expect(effect.audience).toBe(0);
    }
    const cheap = channel('shortform', 'comedy', 500);
    const i = input({ channels: [entry(cheap)] });
    expect(
      effectOf(
        eligibleEvents(i).find((p) => p.def.id === 'gearFails')!,
        i,
      ).cost,
    ).toBeGreaterThanOrEqual(100);
  });

  it('wears a channel and its owner down when it is run flat out', () => {
    const heavy = channel('video', 'gaming', 5_000, 'heavy');
    const { effect } = plan('burnout', heavy);
    expect(effect.mood).toBe(-4);
    expect(effect.audience).toBeLessThan(0);
    expect(effect.id).toBe('burnout');
    expect(effect.channelId).toBe(heavy.id);
  });

  it('moves fame and mood by what the event says, and a famous mention is a collaboration-sized gain', () => {
    const i = input({ channels: [entry(big, 10_000)] });
    const found = eligibleEvents(i).find((p) => p.def.id === 'famousMention')!;
    const effect = effectOf(found, i);
    expect(effect.fame).toBe(1);
    expect(effect.audience).toBe(
      collabGain(
        big.audience,
        Math.round(fameAudience(fameIn(found.figure!, YEAR)) * MENTION_SHARE),
        0,
      ),
    );
    expect(effect.audience).toBeGreaterThan(0);
    expect(effect.text).toContain(displayFigure(found.figure!));
    expect(effect.text).toContain(effect.audience.toLocaleString('en-US'));
    expect(plan('hardYear').effect.mood).toBe(3);
    expect(plan('backlash', channel('video', 'comedy', 5_000)).effect.fame).toBe(-1);
    expect(plan('pressLink').effect.fame).toBe(1);
  });

  it('says what happened to a person without naming a channel, and moves nothing else', () => {
    const i = input({ fame: 20 });
    const found = eligibleEvents(i).find((p) => p.def.id === 'recognized')!;
    const effect = effectOf(found, i);
    expect(effect.channelId).toBeUndefined();
    expect(effect.audience).toBe(0);
    expect(effect.income).toBe(0);
    expect(effect.cost).toBe(0);
    expect(effect.mood).toBe(2);
    expect(findCreatorEvent('recognized')!.lines).toContain(effect.text);
    expect(effect.incomeSource).toBeUndefined();
    expect(effect.costSource).toBeUndefined();
  });

  it('reads every event cleanly: every token filled, the channel named, no stray braces', () => {
    for (const def of CREATOR_EVENTS) {
      const channels = [entry(channel('video', 'comedy', 50_000, 'heavy'), 30_000)];
      const i = input({ fame: 50, channels, key: `r-${def.id}` });
      const found = eligibleEvents(i).find((p) => p.def.id === def.id);
      if (found === undefined) {
        // Gated to a platform this fixture is not on.
        continue;
      }
      const effect = effectOf(found, i);
      expect(effect.text, def.id).not.toMatch(/[{}]/);
      expect(effect.text, def.id).not.toMatch(/\$0\b/);
      expect(effect.text, def.id).not.toMatch(/\b0 (followers|subscribers|listeners|readers)\b/);
      if (def.scope === 'channel') expect(effect.text, def.id).toContain(channels[0]!.channel.name);
    }
  });

  it('covers every event on at least one platform in a fixture set', () => {
    const fixtures = [
      channel('video', 'comedy', 50_000, 'heavy'),
      channel('stream', 'comedy', 5_000),
      channel('podcast', 'comedy', 5_000),
      channel('subscription', 'education', 5_000),
      channel('photo', 'fitness', 50_000),
    ];
    const seen = new Set<string>();
    for (const c of fixtures) {
      for (const fame of [10, 50]) {
        for (const id of idsOf(input({ fame, channels: [entry(c, 10_000)] }))) seen.add(id);
      }
    }
    expect([...seen].sort()).toEqual(CREATOR_EVENTS.map((e) => e.id).sort());
  });
});

describe('a year of channels with news', () => {
  const base = (over: Partial<Parameters<typeof runCreatorsYear>[0]> = {}) => ({
    channels: [channel('video', 'comedy', 20_000, 'heavy')],
    fame: 30,
    year: YEAR,
    stats: {},
    talents: {},
    seed: SEED,
    generation: 0,
    ...over,
  });

  /** The first key (by generation) that draws a given event. */
  function yearWith(id: string, over: Partial<Parameters<typeof runCreatorsYear>[0]> = {}) {
    for (let generation = 0; generation < 2_000; generation += 1) {
      const result = runCreatorsYear(base({ ...over, generation }));
      if (result.event?.id === id) return { result, generation };
    }
    throw new Error(`never drew ${id}`);
  }

  it('has no news without a seed to draw it from, and the year is as it was', () => {
    const { seed: _s, generation: _g, ...rest } = base();
    void _s;
    void _g;
    const result = runCreatorsYear(rest);
    expect(result.event).toBeUndefined();
    expect(result.mood).toBe(0);
  });

  it('an audience event moves the channel’s audience and its peak, and writes its line', () => {
    const quiet = runCreatorsYear(base({ seed: undefined }));
    const { result } = yearWith('shoutout');
    const was = quiet.channels[0]!;
    const now = result.channels[0]!;
    // The same year's drift, plus the shout-out.
    expect(now.audience).toBeGreaterThan(was.audience);
    expect(now.audience - was.audience).toBe(result.event!.audience);
    expect(now.peak).toBeGreaterThanOrEqual(now.audience);
    expect(result.lines.at(-1)).toBe(result.event!.text);
  });

  it('a loss never takes more than the channel has, and the peak stays where it was', () => {
    const { result } = yearWith('algorithm');
    const now = result.channels[0]!;
    expect(now.audience).toBeGreaterThanOrEqual(0);
    expect(result.event!.audience).toBeLessThan(0);
    expect(now.peak).toBeGreaterThanOrEqual(20_000);
  });

  it('money from an event is a row on the books, and counts toward what is taxed', () => {
    const { result } = yearWith('brandCall');
    const row = result.transactions.find((t) => t.source === result.event!.incomeSource);
    expect(row).toBeDefined();
    expect(row!.category).toBe('creator');
    expect(Number(row!.amount)).toBe(result.event!.income * 100);
    const quiet = runCreatorsYear(base({ seed: undefined }));
    expect(result.gross).toBe(quiet.gross + result.event!.income);
  });

  it('a cost from an event is a negative row and comes off what is taxed', () => {
    const { result } = yearWith('gearFails');
    const row = result.transactions.find((t) => t.source === result.event!.costSource);
    expect(row).toBeDefined();
    expect(Number(row!.amount)).toBe(-result.event!.cost * 100);
    const quiet = runCreatorsYear(base({ seed: undefined }));
    expect(result.gross).toBe(quiet.gross);
    expect(result.net).toBe(Math.max(0, quiet.net - result.event!.cost));
  });

  it('a claim moves the money both ways in one year', () => {
    const { result } = yearWith('claim');
    expect(result.event!.income).toBeLessThan(0);
    expect(result.event!.cost).toBeGreaterThan(0);
    const quiet = runCreatorsYear(base({ seed: undefined }));
    expect(result.gross).toBe(quiet.gross + result.event!.income);
  });

  it('fame moves by what the event says, and never leaves 0 to 100', () => {
    const { result } = yearWith('pressLink', { channels: [channel('video', 'education', 20_000)] });
    const quiet = runCreatorsYear(
      base({ channels: [channel('video', 'education', 20_000)], seed: undefined }),
    );
    expect(result.event!.fame).toBe(1);
    expect(result.fame).toBeGreaterThanOrEqual(quiet.fame);
    const top = yearWith('pressLink', {
      channels: [channel('video', 'education', 20_000)],
      fame: 100,
    }).result;
    expect(top.fame).toBeLessThanOrEqual(100);
    const floor = yearWith('backlash', {
      channels: [channel('video', 'comedy', 3_000)],
      fame: 0,
    }).result;
    expect(floor.fame).toBeGreaterThanOrEqual(0);
  });

  it('mood is the event’s, and zero in a quiet year', () => {
    expect(yearWith('burnout').result.mood).toBe(-4);
    expect(yearWith('hardYear').result.mood).toBe(3);
    const quiet = (() => {
      for (let generation = 0; generation < 200; generation += 1) {
        const r = runCreatorsYear(base({ generation }));
        if (r.event === undefined) return r;
      }
      throw new Error('never quiet');
    })();
    expect(quiet.mood).toBe(0);
  });

  it('a person’s event with no channel at all still happens', () => {
    for (let generation = 0; generation < 200; generation += 1) {
      const r = runCreatorsYear(base({ channels: [], fame: 25, generation }));
      if (r.event !== undefined) {
        expect(r.event.channelId).toBeUndefined();
        expect(r.channels).toEqual([]);
        expect(r.lines).toEqual([r.event.text]);
        return;
      }
    }
    throw new Error('nothing happened to somebody known');
  });
});

describe('news in the game', () => {
  const rich = (s: GameState): GameState => {
    const gift = cents(50_000_00);
    const balance = cents(Number(s.finance.balance) + Number(gift));
    return {
      ...s,
      player: { ...s.player, cash: balance },
      finance: {
        ...s.finance,
        balance,
        transactions: [
          ...s.finance.transactions,
          {
            id: `f:${s.world.year}:gift:ev`,
            year: s.world.year,
            age: s.player.age,
            category: 'gift' as const,
            amount: gift,
            source: 'test',
          },
        ],
      },
    };
  };
  function answerEverything(state: GameState): GameState {
    let next = state;
    let guard = 0;
    while (next.pending.length > 0 && (guard += 1) < 16) {
      const d = next.pending[0]!;
      const r = decide(next, d.eventId, d.choices[0]!.id);
      if (!r.ok) break;
      next = r.value.state;
    }
    return next;
  }
  const lineRes = CREATOR_EVENTS.flatMap((d) =>
    d.lines.map((line) => ({
      id: d.id,
      re: new RegExp(`^${line.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\w+\}/g, '.+')}$`),
    })),
  );
  const eventsIn = (state: GameState, from: number): string[] =>
    state.player.timeline
      .slice(from)
      .map((entry) => lineRes.find((r) => r.re.test(entry.text))?.id)
      .filter((id): id is string => id !== undefined);

  it('writes the year’s news onto the timeline, carries it into the books, and moves happiness by its mood', () => {
    const happinessBy = new Map<string, number[]>();
    const seenKinds = new Set<string>();
    for (let i = 0; i < 90; i += 1) {
      let state = createNewGame({ seed: `ev-life-${i}` });
      let guard = 0;
      while (state.player.alive && state.player.age < 22 && (guard += 1) < 60) {
        state = answerEverything(advanceYear(state).state);
      }
      state = rich(state);
      const opened = openChannel(state, 'video', 'comedy');
      if (!opened.ok) continue;
      state = opened.value;
      const set = setChannelEffort(state, state.channels[0]!.id, 'heavy');
      if (set.ok) state = set.value;
      for (let year = 0; year < 8 && state.player.alive; year += 1) {
        state = {
          ...state,
          channels: state.channels.map((channel) => ({
            ...channel,
            publishing: { year: state.world.year, count: 12, kind: 'vlog', gained: 0 },
          })),
        };
        const before = state.player.timeline.length;
        const happy = state.player.stats.happiness;
        state = answerEverything(advanceYear(state).state);
        const found = eventsIn(state, before);
        for (const id of found) {
          seenKinds.add(id);
          const list = happinessBy.get(id) ?? [];
          list.push(state.player.stats.happiness - happy);
          happinessBy.set(id, list);
        }
      }
    }
    const mean = (id: string): number => {
      const xs = happinessBy.get(id) ?? [];
      expect(xs.length, id).toBeGreaterThan(8);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    // A heavy channel's burnout costs happiness; a note from a fan gives some back.
    expect(mean('hardYear') - mean('burnout')).toBeGreaterThan(4);
    expect(seenKinds.has('shoutout')).toBe(true);
  });
});

describe('the numbers (13.120: written out, not read back from the constants)', () => {
  it('keeps the three design constants', () => {
    expect(EVENT_CHANCE).toBe(0.45);
    expect(MENTION_FROM_FAME).toBe(20);
    expect(MENTION_SHARE).toBe(0.3);
  });
});

describe('0706 sabotage closers', () => {
  it('does not give an event to a channel on a platform nobody has heard of', () => {
    const odd = { ...channel('video', 'gaming', 5_000), platformId: 'nowhere' };
    expect(idsOf(input({ channels: [entry(odd)] }))).toEqual([]);
  });

  it('names different figures for different years, not one every time', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 80; i += 1) seen.add(figureForMention(SEED, YEAR, `v${i}`)!.id);
    expect(seen.size).toBeGreaterThan(5);
  });

  it('says what the famous person does for a living', () => {
    const i = input({ channels: [entry(channel('video', 'gaming', 5_000), 1_000)] });
    const plan = eligibleEvents(i).find((p) => p.def.id === 'famousMention')!;
    const role = findCelebrityField(plan.figure!.field)!.role;
    expect(role.length).toBeGreaterThan(2);
    expect(effectOf(plan, i).text).toContain(role);
  });

  it('leaves a token it does not know empty rather than printing it', () => {
    const def: CreatorEventDef = {
      id: 'probe',
      kind: 'good',
      scope: 'person',
      weight: 1,
      lines: ['Before {zzz} after.'],
    };
    expect(effectOf({ def }, input()).text).toBe('Before  after.');
  });

  it('draws gear costs across the whole range, and never under the floor even on a cheap platform', () => {
    const start = findPlatform('video')!.equipmentCost;
    const costs = new Set<number>();
    for (let n = 0; n < 60; n += 1) {
      const i = input({ key: `gc${n}`, channels: [entry(channel('video', 'gaming', 5_000))] });
      costs.add(
        effectOf(
          eligibleEvents(i).find((p) => p.def.id === 'gearFails')!,
          i,
        ).cost,
      );
    }
    expect(costs.size).toBeGreaterThan(20);
    expect(Math.min(...costs)).toBeLessThan(start * 0.8);
    expect(Math.max(...costs)).toBeGreaterThan(start * 1.5);
    // Subscription costs 100 to start: 40 to 200, so the 100-dollar floor is what holds it up.
    const low: number[] = [];
    for (let n = 0; n < 60; n += 1) {
      const i = input({
        key: `gl${n}`,
        channels: [entry(channel('subscription', 'writing', 5_000))],
      });
      low.push(
        effectOf(
          eligibleEvents(i).find((p) => p.def.id === 'gearFails')!,
          i,
        ).cost,
      );
    }
    expect(Math.min(...low)).toBe(100);
    expect(Math.max(...low)).toBeGreaterThan(150);
  });

  it('reads differently from one year to the next, using each line of the event', () => {
    const texts = new Set<string>();
    for (let n = 0; n < 60; n += 1) {
      const i = input({ key: `tx${n}`, channels: [entry(channel('video', 'gaming', 5_000))] });
      texts.add(
        effectOf(
          eligibleEvents(i).find((p) => p.def.id === 'shoutout')!,
          i,
        ).text.slice(0, 30),
      );
    }
    expect(texts.size).toBe(findCreatorEvent('shoutout')!.lines.length);
  });

  const run = (over: Partial<Parameters<typeof runCreatorsYear>[0]> = {}, generation = 0) =>
    runCreatorsYear({
      channels: [channel('video', 'comedy', 20_000)],
      fame: 30,
      year: YEAR,
      stats: {},
      talents: {},
      seed: SEED,
      generation,
      ...over,
    });

  function eventYears(over: Partial<Parameters<typeof runCreatorsYear>[0]>, n = 300) {
    const out: ReturnType<typeof run>[] = [];
    for (let generation = 0; generation < n; generation += 1) {
      const r = run(over, generation);
      if (r.event !== undefined) out.push(r);
    }
    return out;
  }

  it('lands fame where the resulting channels and the event put it, never outside 0 to 100', () => {
    let checked = 0;
    let lifted = 0;
    for (const fame of [0, 30, 100]) {
      for (const size of [600, 20_000, 1_000_000_000]) {
        for (const r of eventYears({ fame, channels: [channel('video', 'comedy', size)] })) {
          const expected = Math.min(
            100,
            Math.max(0, nextFame(fame, fameTarget(r.channels)) + r.event!.fame),
          );
          expect(r.fame).toBe(expected);
          checked += 1;
          if (r.event!.fame > 0 && expected === 100) lifted += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
    // A fame event at the very top: the point is capped, not added.
    expect(lifted).toBeGreaterThan(0);
  });

  it('keeps fame from falling under nothing', () => {
    let down = 0;
    for (const r of eventYears({ fame: 0, channels: [channel('video', 'comedy', 600)] }, 600)) {
      expect(r.fame).toBeGreaterThanOrEqual(0);
      if (r.event!.fame < 0) down += 1;
    }
    expect(down).toBeGreaterThan(0);
  });

  it('only changes the channel the event is about', () => {
    const a = channel('video', 'comedy', 20_000);
    const b = channel('podcast', 'comedy', 20_000);
    let checked = 0;
    for (const r of eventYears({ channels: [a, b] }, 400)) {
      if (r.event!.channelId === undefined || r.event!.audience === 0) continue;
      const quiet = run({ channels: [a, b], seed: undefined });
      for (let i = 0; i < 2; i += 1) {
        const id = r.channels[i]!.id;
        const was = quiet.channels[i]!.audience;
        const now = r.channels[i]!.audience;
        expect(now - was, id).toBe(id === r.event!.channelId ? r.event!.audience : 0);
      }
      checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('lifts a channel’s best-ever mark when an event takes it past it', () => {
    let past = 0;
    for (const r of eventYears({ channels: [channel('video', 'comedy', 1_000)] }, 400)) {
      if (r.event!.audience <= 0) continue;
      const quiet = run({ channels: [channel('video', 'comedy', 1_000)], seed: undefined });
      const now = r.channels[0]!;
      expect(now.peak).toBe(Math.max(quiet.channels[0]!.peak, now.audience));
      if (now.audience > quiet.channels[0]!.peak) past += 1;
    }
    expect(past).toBeGreaterThan(5);
  });

  it('pays a manager their cut of a brand job too', () => {
    let checked = 0;
    for (const r of eventYears(
      { representation: 'manager', channels: [channel('video', 'comedy', 50_000)] },
      400,
    )) {
      if (r.event!.income === 0) continue;
      const row = r.transactions.find((t) => t.source === "Your manager's share")!;
      expect(Number(row.amount)).toBe(-Math.round(r.gross * 0.15) * 100);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(5);
  });
});
