/**
 * Ticket 0507 — the rules of an auction.
 */

import { describe, expect, it } from 'vitest';
import {
  BID_TIER_REACH,
  BUYERS_PREMIUM,
  CREDIBILITY_EFFECTS,
  CREDIBILITY_LABELS,
  UNIT_SIZES,
  credibilityFrom,
  estimateFor,
  junkValueFor,
  maxBidFor,
  resolveBid,
  roomTopBid,
} from './auctions';

describe('0507 — credibility', () => {
  it('is words, never a number (spec 1899)', () => {
    for (const label of Object.values(CREDIBILITY_LABELS)) expect(/\d|%/.test(label)).toBe(false);
  });

  it('gets worse in step: more fakes and fatter estimates down the scale', () => {
    const order = ['well', 'decent', 'mixed', 'questionable'] as const;
    for (let i = 1; i < order.length; i += 1) {
      const a = CREDIBILITY_EFFECTS[order[i - 1]!];
      const b = CREDIBILITY_EFFECTS[order[i]!];
      expect(b.fakeChance).toBeGreaterThan(a.fakeChance);
      expect(b.estimateBias).toBeGreaterThan(a.estimateBias);
    }
    expect(CREDIBILITY_EFFECTS.well.fakeChance).toBeLessThanOrEqual(0.01);
  });

  it('varies, so a house is not the same every year (spec 41)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) seen.add(credibilityFrom(i / 100));
    expect(seen.size).toBe(4);
  });
});

describe('0507 — a bid', () => {
  it('pays where the room stopped, not the ceiling, plus the premium', () => {
    const won = resolveBid(10_000, 8_000);
    expect(won).toEqual({
      won: true,
      hammer: 8_000,
      paid: Math.round(8_000 * (1 + BUYERS_PREMIUM)),
    });
    expect(resolveBid(7_999, 8_000).won).toBe(false);
    expect(resolveBid(7_999, 8_000).paid).toBe(0);
  });

  it('reaches further for each tier', () => {
    const estimate = estimateFor(10_000, 'well', 0.5);
    expect(maxBidFor(estimate, 'careful')).toBeLessThan(maxBidFor(estimate, 'fair'));
    expect(maxBidFor(estimate, 'fair')).toBeLessThan(maxBidFor(estimate, 'determined'));
    expect(BID_TIER_REACH.careful).toBeLessThan(1);
  });

  it('prints a fatter estimate at a house people talk about', () => {
    const honest = estimateFor(10_000, 'well', 0.5);
    const talked = estimateFor(10_000, 'questionable', 0.5);
    expect(talked.low).toBeGreaterThan(honest.low);
    expect(honest.low).toBeLessThan(10_000);
    expect(honest.high).toBeGreaterThan(10_000);
  });

  it('draws the room once, from a key: looking does not change it', () => {
    expect(roomTopBid(10_000, 'lot:x')).toBe(roomTopBid(10_000, 'lot:x'));
    const bids = Array.from({ length: 2_000 }, (_, i) => roomTopBid(10_000, `lot:${i}`));
    const median = [...bids].sort((a, b) => a - b)[1_000]!;
    // The room usually goes past what a thing would fetch.
    expect(median).toBeGreaterThan(11_000);
    expect(median).toBeLessThan(13_000);
  });

  it('sells storage units that usually disappoint', () => {
    const values = Array.from({ length: 2_000 }, (_, i) => junkValueFor('medium', `unit:${i}`));
    const median = [...values].sort((a, b) => a - b)[1_000]!;
    expect(median).toBeLessThan(UNIT_SIZES.medium.expected);
    expect(Math.max(...values)).toBeGreaterThan(UNIT_SIZES.medium.expected * 2);
  });
});
