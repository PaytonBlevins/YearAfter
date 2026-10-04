/**
 * Ticket 0415 — the three rules, as plain numbers.
 *
 * Each is two-sided and each one's losing side is asserted as carefully as its
 * winning side, because a rule that only ever gives is the one-way ratchet
 * CORE_RULES 13.70 names and this ticket exists to undo.
 */

import { describe, expect, it } from 'vitest';
import {
  CARRYING_YEARS,
  FRAYS,
  HARDENS,
  LEARNING_TO_LIVE_WITH,
  ROUTINE_YEARS,
  WORN_FLOOR,
  illnessYearGrowth,
  parentingYearGrowth,
  strainYearWear,
  yearShaping,
} from './shaping';

const CALM = 10;
const STRUGGLING = 65;

describe('0415 — raising a child', () => {
  it('builds discipline in the years before school, in a year you held together', () => {
    expect(parentingYearGrowth({ youngestAtHome: 2, stress: CALM, willpower: 60 })).toEqual({
      discipline: 1,
    });
    expect(
      parentingYearGrowth({ youngestAtHome: ROUTINE_YEARS, stress: CALM, willpower: 60 }),
    ).toEqual({});
  });

  it('wears willpower instead in a year you were running on empty', () => {
    expect(parentingYearGrowth({ youngestAtHome: 2, stress: STRUGGLING, willpower: 60 })).toEqual({
      willpower: -1,
    });
    expect(parentingYearGrowth({ youngestAtHome: 9, stress: STRUGGLING, willpower: 60 })).toEqual({
      willpower: -1,
    });
  });

  it('stops at thirteen, and does nothing without a child at home', () => {
    for (const stress of [CALM, STRUGGLING]) {
      expect(
        parentingYearGrowth({ youngestAtHome: CARRYING_YEARS, stress, willpower: 60 }),
      ).toEqual({});
      expect(parentingYearGrowth({ youngestAtHome: undefined, stress, willpower: 60 })).toEqual({});
    }
  });
});

describe('0415 — being ill', () => {
  const ill = (over: Partial<Parameters<typeof illnessYearGrowth>[0]>) =>
    illnessYearGrowth({ worst: 'serious', yearsHeld: 2, stress: CALM, willpower: 70, ...over });

  it('hardens somebody who meets it well and wears somebody who does not', () => {
    expect(ill({ willpower: HARDENS })).toEqual({ willpower: 1 });
    expect(ill({ willpower: FRAYS - 1 })).toEqual({ willpower: -1 });
    // The middle is neither, which is what keeps this from being a push.
    expect(ill({ willpower: (HARDENS + FRAYS) / 2 })).toEqual({});
  });

  it('wears even a strong person in a year they were struggling', () => {
    expect(ill({ willpower: 90, stress: STRUGGLING })).toEqual({ willpower: -1 });
  });

  it('only in the years of learning to live with it, and never for minor things', () => {
    expect(ill({ yearsHeld: LEARNING_TO_LIVE_WITH.from - 1 })).toEqual({});
    expect(ill({ yearsHeld: LEARNING_TO_LIVE_WITH.to + 1 })).toEqual({});
    expect(ill({ worst: 'minor' })).toEqual({});
    expect(ill({ worst: undefined })).toEqual({});
    expect(ill({ worst: 'grave' })).toEqual({ willpower: 1 });
  });
});

describe('0415 — running on empty', () => {
  it('costs willpower in the second struggling year, not the first', () => {
    expect(strainYearWear({ before: STRUGGLING, after: STRUGGLING, willpower: 70 })).toEqual({
      willpower: -1,
    });
    expect(strainYearWear({ before: CALM, after: STRUGGLING, willpower: 70 })).toEqual({});
    expect(strainYearWear({ before: STRUGGLING, after: CALM, willpower: 70 })).toEqual({});
  });
});

describe('0415 — the floor and the one account', () => {
  it('never wears anybody below the floor 0411 set for neglect', () => {
    expect(
      strainYearWear({ before: STRUGGLING, after: STRUGGLING, willpower: WORN_FLOOR }),
    ).toEqual({});
    expect(
      parentingYearGrowth({ youngestAtHome: 1, stress: STRUGGLING, willpower: WORN_FLOOR }),
    ).toEqual({});
    expect(
      illnessYearGrowth({
        worst: 'grave',
        yearsHeld: 2,
        stress: STRUGGLING,
        willpower: WORN_FLOOR,
      }),
    ).toEqual({});
  });

  it('bills a year that went wrong three ways once', () => {
    const worn = { willpower: -1 } as const;
    expect(yearShaping(worn, worn, worn)).toEqual({ willpower: -1 });
    expect(yearShaping({ discipline: 1 }, worn)).toEqual({ discipline: 1, willpower: -1 });
    expect(yearShaping({ willpower: 1 }, worn)).toEqual({});
  });
});
