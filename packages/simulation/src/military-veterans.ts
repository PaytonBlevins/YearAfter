/**
 * Ticket 0904 — what a veteran has. Reads only: nothing here changes a state. `military.ts` draws a medical board or a
 * court-martial and ends a career with a discharge; `advance.ts` pays a pension and a housing allowance; `college.ts`
 * and `phases/education.ts` add the GI Bill's tuition to a year's support; `careers.ts` hands hiring the preference.
 * The numbers are in `@yearafter/content`'s `military-veterans.ts`.
 */

import {
  GI_BILL_DISCHARGES,
  GI_BILL_START_LINES,
  GI_BILL_USED_UP_LINES,
  PENSION_START_LINES,
  findServiceBranch,
  GI_HOUSING_MONTHLY,
  GI_MONTHS_ENTITLED,
  GI_MONTHS_PER_YEAR,
  GI_TUITION_CAP,
  PREFERENCE_DISCHARGES,
  PREFERENCE_MIN_YEARS,
  giPercentFor,
  retiredPayFor,
} from '@yearafter/content';
import { stablePick } from '@yearafter/core';
import { findCondition, type HeldCondition } from '@yearafter/health';
import type { GameState } from './game-state';
import type { MilitaryState, PastService } from './military-state';

/** True for somebody holding a serious injury that came from service: the ones a medical board looks at. */
export function holdsServiceInjury(conditions: readonly HeldCondition[]): boolean {
  return conditions.some((row) => {
    const kind = findCondition(row.conditionId);
    return kind?.from === 'service' && kind.severity === 'serious';
  });
}

/** A year of retired pay: the largest of the pensions earned, zero for somebody who never retired. */
export function retiredPayOf(military: MilitaryState): number {
  return military.past.reduce((best, row) => Math.max(best, retiredPayFor(row)), 0);
}

/** The age the pay began: the year after the career ended. Undefined if none was earned. */
export function retiredPayStartAge(military: MilitaryState): number | undefined {
  const earned = military.past.filter((row) => retiredPayFor(row) > 0);
  if (earned.length === 0) return undefined;
  return Math.min(...earned.map((row) => row.endedAge)) + 1;
}

/** What retired pay a person is drawing at an age, whole dollars. */
export function retiredPayAt(military: MilitaryState, age: number): number {
  const start = retiredPayStartAge(military);
  if (start === undefined || age < start) return 0;
  return retiredPayOf(military);
}

/* -------------------------------------------------------------------------- */
/* The GI Bill                                                                 */
/* -------------------------------------------------------------------------- */

const earnedGiBill = (row: PastService): boolean =>
  GI_BILL_DISCHARGES.includes(row.discharge) && row.how !== 'killed';

/** Months of service that count toward the benefit, whole. */
export function giServiceMonths(military: MilitaryState): number {
  return military.past.filter(earnedGiBill).reduce((sum, row) => sum + row.years * 12, 0);
}

/**
 * The share of the GI Bill a person has earned, 0 to 1. A medical discharge pays the full share whatever the time
 * served. Zero while still serving: the benefit is for those who have left.
 */
export function giBillPercent(military: MilitaryState): number {
  if (military.service !== undefined) return 0;
  const earned = military.past.filter(earnedGiBill);
  if (earned.length === 0) return 0;
  if (earned.some((row) => row.discharge === 'medical')) return 1;
  return giPercentFor(giServiceMonths(military));
}

/** Months of benefit left, whole. */
export function giMonthsLeft(military: MilitaryState): number {
  if (giBillPercent(military) === 0) return 0;
  return Math.max(0, GI_MONTHS_ENTITLED - (military.giBillMonthsUsed ?? 0));
}

/** How much of a year's benefit is left to use: all of it with nine months or more, a part of it after. */
const yearShare = (military: MilitaryState): number =>
  Math.min(GI_MONTHS_PER_YEAR, giMonthsLeft(military)) / GI_MONTHS_PER_YEAR;

/** What the GI Bill pays toward a year's tuition of that size, whole dollars. */
export function giTuitionAid(military: MilitaryState, tuition: number): number {
  const share = yearShare(military);
  if (share === 0 || tuition <= 0) return 0;
  return Math.round(giBillPercent(military) * Math.min(tuition, GI_TUITION_CAP) * share);
}

/** What the GI Bill pays a year of living, whole dollars. A housing allowance for the months enrolled. */
export function giHousingFor(military: MilitaryState): number {
  const share = yearShare(military);
  if (share === 0) return 0;
  return Math.round(giBillPercent(military) * GI_HOUSING_MONTHLY * GI_MONTHS_PER_YEAR * share);
}

/** The months a year at college uses of what is left. */
export function giMonthsThisYear(military: MilitaryState): number {
  return Math.min(GI_MONTHS_PER_YEAR, giMonthsLeft(military));
}

/* -------------------------------------------------------------------------- */
/* Veterans' preference                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Whether a hiring panel gives this person a preference: a discharge under honorable conditions (honorable, general or
 * medical), two years of service or a medical discharge, and no career still going.
 */
export function veteranPreference(state: Pick<GameState, 'military'>): boolean {
  const military = state.military;
  if (military.service !== undefined) return false;
  return military.past.some(
    (row) =>
      PREFERENCE_DISCHARGES.includes(row.discharge) &&
      (row.discharge === 'medical' || row.years >= PREFERENCE_MIN_YEARS),
  );
}

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

export interface VeteransYearInput {
  readonly military: MilitaryState;
  /** The age the year ends at. */
  readonly age: number;
  /** Whether the person began the year at a first degree or a trade school (not graduate school). */
  readonly atCollege: boolean;
  /** How the year's degree ended, if it ended one: a year left for want of money was not attended. */
  readonly ending?: string;
}

export interface VeteransYear {
  /** Retired pay for the year, whole dollars. */
  readonly retiredPay: number;
  /** The GI Bill's housing allowance for the year, whole dollars. */
  readonly housing: number;
  /** The military state with the months used brought up to date. */
  readonly military: MilitaryState;
  readonly lines: readonly { readonly kind: 'milestone' | 'passive'; readonly text: string }[];
}

const dollarsOf = (value: number): string => Math.round(value).toLocaleString('en-US');

/**
 * What a year pays a veteran and what it uses. Retired pay from the year after the career ended; the housing allowance
 * and the months of the GI Bill for a year at college that was attended. Nothing is drawn: the pension and the benefit
 * are rules, not chances, so a life without a service replays exactly.
 */
export function runVeteransYear(input: VeteransYearInput): VeteransYear {
  const { military, age } = input;
  const lines: { kind: 'milestone' | 'passive'; text: string }[] = [];
  const retiredPay = retiredPayAt(military, age);
  if (retiredPay > 0 && retiredPayStartAge(military) === age) {
    const retired = military.past.find((row) => retiredPayFor(row) > 0);
    lines.push({
      kind: 'milestone',
      text: (stablePick(PENSION_START_LINES, `pension:${age}`) ?? '')
        .replaceAll('%pay%', dollarsOf(retiredPay))
        .replaceAll('%branch%', findServiceBranch(retired?.branch ?? '')?.name ?? 'the service'),
    });
  }
  const percent = giBillPercent(military);
  const months = giMonthsThisYear(military);
  const attended =
    input.atCollege && input.ending !== 'ran-out-of-money' && percent > 0 && months > 0;
  if (!attended) return { retiredPay, housing: 0, military, lines };
  const housing = giHousingFor(military);
  const used = (military.giBillMonthsUsed ?? 0) + months;
  if (military.giBillMonthsUsed === undefined || military.giBillMonthsUsed === 0) {
    lines.push({
      kind: 'passive',
      text: (stablePick(GI_BILL_START_LINES, `gi:${age}`) ?? '').replaceAll(
        '%percent%',
        `${Math.round(percent * 100)}%`,
      ),
    });
  }
  if (used >= GI_MONTHS_ENTITLED) {
    lines.push({ kind: 'passive', text: stablePick(GI_BILL_USED_UP_LINES, `giend:${age}`) ?? '' });
  }
  return { retiredPay, housing, military: { ...military, giBillMonthsUsed: used }, lines };
}
