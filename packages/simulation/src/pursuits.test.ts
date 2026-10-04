/**
 * Ticket 0416 — the adult year and the door, as plain rules.
 */

import { describe, expect, it } from 'vitest';
import { createStats, createTalents } from '@yearafter/character';
import { findActivity } from '@yearafter/content';
import { SUBSISTENCE } from '@yearafter/finance';
import { activityStageOf, join, NOT_YET_ENROLLED, type EducationState } from '@yearafter/education';
import { LAPSE, affordsFee, runPursuitYear, SEASON_LINE_EVERY } from './pursuits';
import { pursuitYearGrowth, STILL_TAKING_UP } from './shaping';
import type { RandomStream } from './rng/rng';

const always = (value: number) => ({ next: () => value }) as unknown as RandomStream;
const COMFORTABLE = SUBSISTENCE + 40_000;

const holding = (...ids: string[]): EducationState =>
  ids.reduce((state, id) => join(state, id, 30), {
    ...NOT_YET_ENROLLED,
    stage: 'graduated',
  } as EducationState);

const year = (
  education: EducationState,
  over: Partial<Parameters<typeof runPursuitYear>[0]> = {},
) =>
  runPursuitYear({
    education,
    age: 31,
    stats: createStats(),
    talents: createTalents(),
    standard: COMFORTABLE,
    strained: false,
    stream: always(0.99),
    ...over,
  });

describe('0416 — which list', () => {
  it('reads the school stage in K-12 and the adult list from eighteen, whatever else they do', () => {
    expect(activityStageOf({ ...NOT_YET_ENROLLED, stage: 'middle' }, 12)).toBe('middle');
    for (const stage of ['graduated', 'droppedOut', 'college', 'postgrad', 'vocational'] as const) {
      expect(activityStageOf({ ...NOT_YET_ENROLLED, stage }, 19)).toBe('adult');
    }
    // A sixteen-year-old who left school has neither, which is the honest gap.
    expect(activityStageOf({ ...NOT_YET_ENROLLED, stage: 'droppedOut' }, 16)).toBeUndefined();
    expect(activityStageOf(NOT_YET_ENROLLED, 3)).toBeUndefined();
  });
});

describe('0416 — an adult year of something', () => {
  it('plays a season, counts the hours and charges the fee through the ledger', () => {
    const result = year(holding('act.adult.rec-league', 'act.adult.book-club'));
    expect(result.education.activities.map((entry) => entry.seasons)).toEqual([1, 1]);
    expect(result.hours).toBe(
      (findActivity('act.adult.rec-league')?.hoursPerWeek ?? 0) +
        (findActivity('act.adult.book-club')?.hoursPerWeek ?? 0),
    );
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]?.category).toBe('spending');
    expect(Number(result.transactions[0]?.amount)).toBe(-150 * 100);
  });

  it('lets people put things down, more often in a hard year', () => {
    const club = holding('act.adult.book-club');
    const kept = year(club, { stream: always(LAPSE + 0.01) });
    expect(kept.education.activities).toHaveLength(1);
    const dropped = year(club, { stream: always(LAPSE - 0.01) });
    expect(dropped.education.activities).toHaveLength(0);
    expect(dropped.lines).toEqual([findActivity('act.adult.book-club')?.leaveText]);
    // The same roll holds in an easy year and goes in a hard one.
    expect(year(club, { stream: always(0.2) }).education.activities).toHaveLength(1);
    expect(year(club, { stream: always(0.2), strained: true }).education.activities).toHaveLength(
      0,
    );
  });

  it('drops a paid pursuit the household cannot carry, and says why, but keeps a free one', () => {
    const result = year(holding('act.adult.night-class', 'act.adult.choir'), {
      standard: SUBSISTENCE,
    });
    expect(result.education.activities.map((entry) => entry.activityId)).toEqual([
      'act.adult.choir',
    ]);
    expect(result.transactions).toHaveLength(0);
    expect(result.lines[0]).toMatch(/fees were the first thing to cut/);
  });

  it('reads what the household lives on, never the current account', () => {
    expect(affordsFee(SUBSISTENCE, 0)).toBe(true);
    expect(affordsFee(SUBSISTENCE, 60)).toBe(false);
    expect(affordsFee(COMFORTABLE, 450)).toBe(true);
  });

  it('leaves a school activity to the school year', () => {
    const school = join({ ...NOT_YET_ENROLLED, stage: 'high' }, 'act.chess', 15);
    const result = year(school, { stream: always(0) });
    expect(result.education.activities).toEqual(school.activities);
    expect(result.lines).toEqual([]);
  });

  it('says how it is going every few seasons, and not the same way each time', () => {
    let education = holding('act.adult.running-club');
    const written: (string | undefined)[] = [];
    for (let age = 31; age < 50; age += 1) {
      const result = year(education, { age });
      education = result.education;
      written.push(result.lines[0]);
    }
    const said = written.filter(Boolean);
    expect(said.length).toBe(Math.floor(19 / SEASON_LINE_EVERY));
    expect(new Set(said).size, 'six years of the same sentence').toBeGreaterThan(1);
  });
});

describe('0416 — what a pursuit does to you', () => {
  const running = findActivity('act.adult.running-club')!;
  const evening = findActivity('act.adult.night-class')!;

  it('builds the one trait it is most about, for its first few seasons', () => {
    expect(pursuitYearGrowth({ profile: evening.effects, seasons: 1, stress: 10 })).toEqual({
      happiness: 1,
      smarts: 1,
    });
    expect(
      pursuitYearGrowth({ profile: evening.effects, seasons: STILL_TAKING_UP + 1, stress: 10 }),
    ).toEqual({ happiness: 1 });
    // Health is the health phase's and looks is age's; running builds willpower.
    expect(pursuitYearGrowth({ profile: running.effects, seasons: 2, stress: 10 })).toEqual({
      happiness: 1,
      willpower: 1,
    });
  });

  it('builds nothing in a year spent struggling', () => {
    expect(pursuitYearGrowth({ profile: evening.effects, seasons: 1, stress: 70 })).toEqual({});
  });
});
