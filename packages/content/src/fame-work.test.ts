/**
 * Ticket 0707 — what being known gets you offered (content side).
 */

import { describe, expect, it } from 'vitest';
import { FAME_WORK, findFameWork } from './fame-work';

describe('the fame-work catalog', () => {
  it('has four things with their own ids, labels and a level that rises in the order listed', () => {
    expect(FAME_WORK.map((w) => w.id)).toEqual([
      'photoshoot',
      'commercial',
      'talkShow',
      'guestStar',
    ]);
    expect(new Set(FAME_WORK.map((w) => w.label)).size).toBe(4);
    const levels = FAME_WORK.map((w) => w.fromFame);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(findFameWork('talkShow')!.label).toBe('Talk show');
    expect(findFameWork('nothing')).toBeUndefined();
  });

  it('keeps the numbers as they were set (a literal table, 13.120)', () => {
    // times: how many posts at the going rate; floor: dollars; fame and mood: points when done.
    const got = Object.fromEntries(
      FAME_WORK.map((w) => [
        w.id,
        {
          fromFame: w.fromFame,
          times: w.times,
          floor: w.floor,
          fame: w.fame,
          mood: w.mood,
          audience: w.audience,
        },
      ]),
    );
    expect(got).toEqual({
      photoshoot: { fromFame: 6, times: 6, floor: 200, fame: 1, mood: 1, audience: undefined },
      commercial: { fromFame: 12, times: 12, floor: 800, fame: 1, mood: 0, audience: undefined },
      talkShow: { fromFame: 20, times: 1, floor: 500, fame: 2, mood: 1, audience: [0.03, 0.08] },
      guestStar: { fromFame: 28, times: 4, floor: 1283, fame: 3, mood: 2, audience: [0.02, 0.06] },
    });
  });

  it('prices the day on set at the union minimum, as the design says', () => {
    // SAG-AFTRA 2026-27 day performer rate: $1,283.
    expect(findFameWork('guestStar')!.floor).toBe(1283);
  });

  it('gives every thing outlets and lines that use the tokens it supplies, and no others', () => {
    for (const work of FAME_WORK) {
      expect(work.outlets.length, work.id).toBeGreaterThanOrEqual(5);
      expect(new Set(work.outlets).size, work.id).toBe(work.outlets.length);
      expect(work.lines.length, work.id).toBeGreaterThanOrEqual(2);
      expect(work.offers.length, work.id).toBeGreaterThanOrEqual(2);
      for (const line of [...work.lines, ...work.offers]) {
        expect(line, work.id).toContain('{outlet}');
        expect(line, work.id).toContain('{pay}');
        expect(line.replace(/\{outlet\}|\{pay\}/g, ''), work.id).not.toMatch(/[{}]/);
      }
      expect(work.blurb.length, work.id).toBeGreaterThan(20);
    }
  });

  it('reads in plain American English with contractions', () => {
    for (const work of FAME_WORK) {
      for (const text of [work.blurb, ...work.lines, ...work.offers, ...work.outlets]) {
        expect(text, work.id).not.toMatch(
          /\b(did not|could not|would not|cannot|do not|does not|is not|was not)\b/i,
        );
        expect(text, work.id).not.toMatch(/colour|favour|honour|centre|theatre|programme|whilst/i);
      }
    }
  });

  it('keeps what only a person of a certain standing is asked to do to the better known', () => {
    const talk = findFameWork('talkShow')!;
    const photo = findFameWork('photoshoot')!;
    expect(talk.audience).toBeDefined();
    expect(photo.audience).toBeUndefined();
    for (const work of FAME_WORK) {
      expect(work.times, work.id).toBeGreaterThan(0);
      expect(work.floor, work.id).toBeGreaterThan(0);
      if (work.audience !== undefined) expect(work.audience[0]).toBeLessThan(work.audience[1]);
    }
  });
});
