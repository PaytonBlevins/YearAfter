import { describe, expect, it } from 'vitest';
import { CREATOR_CATEGORIES, PLATFORMS } from './creators';
import { CREATOR_EVENTS, findCreatorEvent } from './creator-events';

const KNOWN = new Set([
  'channel',
  'platform',
  'audience',
  'gain',
  'loss',
  'amount',
  'cost',
  'name',
  'role',
]);
const tokensOf = (line: string): string[] => [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);

describe('0706 — the creator and fame events', () => {
  it('has uniquely named events, each findable', () => {
    const ids = CREATOR_EVENTS.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const event of CREATOR_EVENTS) expect(findCreatorEvent(event.id)).toBe(event);
    expect(findCreatorEvent('nothing')).toBeUndefined();
    expect(CREATOR_EVENTS.length).toBeGreaterThanOrEqual(20);
  });

  it('only names platforms and categories that exist', () => {
    const platforms = new Set(PLATFORMS.map((platform) => platform.id as string));
    const categories = new Set(CREATOR_CATEGORIES.map((category) => category.id as string));
    for (const event of CREATOR_EVENTS) {
      for (const id of event.platforms ?? [])
        expect(platforms.has(id), `${event.id}: ${id}`).toBe(true);
      for (const id of event.categories ?? [])
        expect(categories.has(id), `${event.id}: ${id}`).toBe(true);
    }
  });

  it('is about a channel or about a person, and says so consistently', () => {
    for (const event of CREATOR_EVENTS) {
      if (event.scope === 'person') {
        expect(event.kind, event.id).toBe('fame');
        expect(event.fame, event.id).toBeDefined();
        expect(event.platforms, event.id).toBeUndefined();
        expect(event.audience, event.id).toBeUndefined();
        expect(event.income, event.id).toBeUndefined();
        expect(event.cost, event.id).toBeUndefined();
        for (const line of event.lines) expect(tokensOf(line), `${event.id}: ${line}`).toEqual([]);
      } else {
        expect(event.kind, event.id).not.toBe('fame');
        expect(event.fame, event.id).toBeUndefined();
      }
    }
  });

  it('keeps every range the right way round, and every good event good and every bad one bad', () => {
    for (const event of CREATOR_EVENTS) {
      for (const range of [event.audience, event.income, event.cost, event.fame]) {
        if (range !== undefined) expect(range[0], event.id).toBeLessThanOrEqual(range[1]);
      }
      if (event.fame !== undefined) {
        expect(event.fame[0], event.id).toBeGreaterThanOrEqual(0);
        expect(event.fame[1], event.id).toBeLessThanOrEqual(100);
      }
      if (event.kind === 'good') {
        if (event.audience) expect(event.audience[0], event.id).toBeGreaterThan(0);
        if (event.income) expect(event.income[0], event.id).toBeGreaterThan(0);
        expect(event.cost, event.id).toBeUndefined();
        expect(event.mood ?? 0, event.id).toBeGreaterThanOrEqual(0);
      }
      if (event.kind === 'bad') {
        if (event.audience) expect(event.audience[1], event.id).toBeLessThan(0);
        if (event.income) expect(event.income[1], event.id).toBeLessThan(0);
        expect(event.mood ?? 0, event.id).toBeLessThanOrEqual(0);
        expect(event.fameChange ?? 0, event.id).toBeLessThanOrEqual(0);
      }
      if (event.cost) expect(event.cost[0], event.id).toBeGreaterThan(0);
      expect(event.weight, event.id).toBeGreaterThan(0);
    }
  });

  it('writes at least two lines for each, and only fills tokens the event can supply', () => {
    for (const event of CREATOR_EVENTS) {
      expect(event.lines.length, event.id).toBeGreaterThanOrEqual(2);
      const needs = (token: string): boolean =>
        event.lines.some((line) => line.includes(`{${token}}`));
      for (const line of event.lines) {
        for (const token of tokensOf(line))
          expect(KNOWN.has(token), `${event.id}: ${token}`).toBe(true);
        expect(line.length, event.id).toBeLessThan(220);
      }
      // A token is only used when the event has the thing it names.
      if (needs('gain'))
        expect(event.audience !== undefined || event.figure === true, event.id).toBe(true);
      if (needs('loss'))
        expect(event.audience !== undefined && event.audience[1] < 0, event.id).toBe(true);
      if (needs('amount')) expect(event.income, event.id).toBeDefined();
      if (needs('cost')) expect(event.cost, event.id).toBeDefined();
      if (needs('name') || needs('role')) expect(event.figure, event.id).toBe(true);
      // The same event never uses both a gain and a loss.
      expect(needs('gain') && needs('loss'), event.id).toBe(false);
      // Every line of an event uses the same set of tokens, so no variant is missing a number.
      const sets = event.lines.map((line) =>
        tokensOf(line)
          .filter((t) => t !== 'channel')
          .sort()
          .join(','),
      );
      expect(
        new Set(sets.map((s) => s.replace('audience,', ''))).size,
        event.id,
      ).toBeLessThanOrEqual(2);
    }
  });

  it('gives money events a label for the books', () => {
    for (const event of CREATOR_EVENTS) {
      if (event.income) expect(event.incomeLabel, event.id).toBeTruthy();
      if (event.cost) expect(event.costLabel, event.id).toBeTruthy();
    }
  });

  it('is not all bad news, and not all good: the two sides weigh about the same', () => {
    // Burnout is left out: it can only happen to a channel run flat out.
    const weight = (kind: string): number =>
      CREATOR_EVENTS.filter((event) => event.kind === kind && event.effort === undefined).reduce(
        (sum, event) => sum + event.weight,
        0,
      );
    expect(weight('good')).toBeGreaterThan(weight('bad') * 0.9);
    expect(weight('good')).toBeLessThan(weight('bad') * 1.4);
  });

  it('keeps being known mostly a pleasure (spec 1334): fame is never a recurring stress', () => {
    const fame = CREATOR_EVENTS.filter((event) => event.kind === 'fame');
    expect(fame.length).toBeGreaterThanOrEqual(6);
    const bad = fame.filter((event) => (event.mood ?? 0) < 0);
    const good = fame.filter((event) => (event.mood ?? 0) > 0);
    expect(bad.reduce((sum, event) => sum + event.weight, 0)).toBeLessThan(
      good.reduce((sum, event) => sum + event.weight, 0) / 2,
    );
    for (const event of bad) expect(event.mood, event.id).toBeGreaterThanOrEqual(-2);
  });

  it('ties burnout to heavy effort alone', () => {
    const burnout = findCreatorEvent('burnout')!;
    expect(burnout.effort).toBe('heavy');
    expect(burnout.mood).toBeLessThan(0);
    expect(CREATOR_EVENTS.filter((event) => event.effort !== undefined).map((e) => e.id)).toEqual([
      'burnout',
    ]);
  });
  it('keeps the numbers as they were tuned (a literal table, 13.120)', () => {
    // Weights come from a census of how often each event fired (about 48% of creator-years,
    // good about 57% and bad about 43%); the ranges are shares of an audience, of a year's
    // income, or of the platform's start-up cost. A number here that moves is a decision.
    const expected: Record<string, Record<string, unknown>> = {
      shoutout: {
        weight: 1,
        audience: [0.06, 0.15],
        minAudience: 100,
        platforms: ['video', 'stream', 'podcast', 'shortform', 'photo'],
      },
      famousMention: { weight: 0.7, fameChange: 1, minAudience: 300, figure: true },
      featured: {
        weight: 1,
        audience: [0.1, 0.25],
        minAudience: 500,
        platforms: ['video', 'photo', 'shortform', 'subscription'],
      },
      brandCall: { weight: 1.2, income: [0.12, 0.3], incomeFloor: 300, paid: true },
      pressLink: {
        weight: 0.9,
        fameChange: 1,
        audience: [0.05, 0.12],
        minAudience: 200,
        categories: ['education', 'tech', 'commentary', 'business', 'truecrime', 'sports'],
      },
      fanClip: { weight: 0.7, mood: 1, audience: [0.03, 0.07], minAudience: 200 },
      tips: {
        weight: 0.8,
        income: [0.08, 0.2],
        incomeFloor: 100,
        paid: true,
        platforms: ['stream', 'podcast', 'subscription'],
      },
      firstFan: { weight: 0.35, mood: 2 },
      hardYear: { weight: 0.6, mood: 3, minAudience: 50 },
      algorithm: {
        weight: 1.2,
        audience: [-0.14, -0.06],
        minAudience: 500,
        platforms: ['video', 'stream', 'shortform', 'photo'],
      },
      gearFails: { weight: 0.9, cost: [0.4, 2], costFloor: 100 },
      burnout: {
        weight: 2.2,
        mood: -4,
        audience: [-0.08, -0.04],
        minAudience: 50,
        effort: 'heavy',
      },
      claim: {
        weight: 1,
        income: [-0.2, -0.08],
        incomeFloor: 100,
        cost: [0.3, 0.6],
        costFloor: 150,
        paid: true,
        platforms: ['video', 'stream', 'podcast'],
      },
      backlash: {
        weight: 1,
        mood: -2,
        fameChange: -1,
        audience: [-0.12, -0.05],
        minAudience: 500,
        categories: ['comedy', 'commentary', 'truecrime', 'business', 'sports', 'lifestyle'],
      },
      payRules: { weight: 1.1, income: [-0.2, -0.1], incomeFloor: 100, paid: true },
      copycat: { weight: 1.1, audience: [-0.06, -0.03], minAudience: 300 },
      recognized: { weight: 1.4, mood: 2, fame: [8, 40] },
      photoAsk: { weight: 1, mood: 1, fameChange: 1, fame: [15, 60] },
      fanMail: { weight: 0.9, mood: 2, fame: [20, 100] },
      interview: { weight: 0.8, mood: 1, fameChange: 2, fame: [25, 100] },
      tabloid: { weight: 0.6, mood: -2, fameChange: 1, fame: [30, 100] },
      noPrivacy: { weight: 0.4, mood: -1, fame: [45, 100] },
      invited: { weight: 0.6, mood: 3, fameChange: 1, fame: [40, 100] },
    };
    const keys = [
      'weight',
      'mood',
      'fameChange',
      'audience',
      'income',
      'incomeFloor',
      'cost',
      'costFloor',
      'fame',
      'minAudience',
      'paid',
      'effort',
      'platforms',
      'categories',
      'figure',
    ] as const;
    expect(CREATOR_EVENTS.map((event) => event.id).sort()).toEqual(Object.keys(expected).sort());
    for (const event of CREATOR_EVENTS) {
      const got: Record<string, unknown> = {};
      for (const key of keys) {
        const value = event[key];
        if (value !== undefined) got[key] = value;
      }
      expect(JSON.parse(JSON.stringify(got)), event.id).toEqual(expected[event.id]);
    }
  });
});
