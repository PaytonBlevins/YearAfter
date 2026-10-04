/**
 * Ticket 0506 — renovating a home.
 *
 * MEASURED FIRST (300 played lives, two disjoint seed sets): the homes people
 * own were falling apart. At 45–64, 72–76% of homes lived in were in POOR
 * condition; past 65, 86–88%. Wear in 0501's model only goes one way — 8% a
 * year a home drops a step, and nothing ever lifts it — so every home bought
 * ends up poor, costing 35% more to keep and worth 18% less. There was no way
 * back, because the only way back is a renovation and none existed.
 *
 * WHAT THIS FILE IS. Pure rules: what a renovation costs on a given home,
 * whether it can be done, and what doing it changes. Spec 1385:
 * "Renovations can increase value/desirability but need not always return
 * more than their cost. Prevent repeated renovation-value loops."
 *
 *   A REFRESH (kitchen, bathroom, finishes) lifts the condition one step, and
 *   the value moves the way condition always moves it (`CONDITION_PRICE`). The
 *   first step out of poor nearly pays for itself, as fixing the worst thing
 *   in a house does; the last step into excellent doesn't. It can be done
 *   again once `redoAfter` years have passed, so the loop is closed by time
 *   and by the condition scale having a top.
 *
 *   AN ADDITION is done once and adds `recovery` of its cost to the value.
 *   Nothing on the list recovers its whole cost.
 */

import { dollars } from '@yearafter/core';
import { regionCostIndexOf, type Renovation } from '@yearafter/content';
import {
  CONDITION_PRICE,
  HOME_CONDITIONS,
  type HomeCondition,
  type HomeRenovation,
  type OwnedHome,
} from './property';
import { findRenovation } from '@yearafter/content';

/** Whole dollars, on this home, in its region. */
export function renovationCostOf(
  renovation: Renovation,
  home: Pick<OwnedHome, 'value' | 'regionKey'>,
): number {
  const index = regionCostIndexOf(home.regionKey);
  const raw = renovation.refresh
    ? Math.max(renovation.floor * index, (Number(home.value) / 100) * renovation.share)
    : renovation.cost * index;
  return Math.round(raw / 500) * 500;
}

export type RenovationRefusal = 'notForThisHome' | 'needsFirst' | 'alreadyDone' | 'tooSoon';

export const RENOVATION_REFUSAL_LABELS: Readonly<Record<RenovationRefusal, string>> = {
  notForThisHome: "There's no room for that here.",
  needsFirst: 'That needs the first addition done before it.',
  alreadyDone: "It's already got one.",
  tooSoon: 'That was done recently. It has years left in it.',
};

/** Whether this can be done to this home this year, and why not if it can't. */
export function renovationRefusalFor(
  renovation: Renovation,
  home: OwnedHome,
  year: number,
): RenovationRefusal | undefined {
  if (!renovation.kinds.includes(home.kindId)) return 'notForThisHome';
  const done = home.renovations ?? [];
  if (renovation.needs && !done.some((entry) => entry.renovationId === renovation.needs)) {
    return 'needsFirst';
  }
  const inGroup = done.find(
    (entry) => findRenovation(entry.renovationId)?.group === renovation.group,
  );
  if (!inGroup) return undefined;
  if (!renovation.refresh) return 'alreadyDone';
  // A modern kitchen can become a luxury one whenever; the other way round,
  // or the same again, waits until the last one has aged.
  const previous = findRenovation(inGroup.renovationId);
  if (previous && previous.id !== renovation.id && renovation.share > previous.share)
    return undefined;
  return year - inGroup.year < renovation.redoAfter ? 'tooSoon' : undefined;
}

/** One step up the condition scale, never past the top. */
const better = (condition: HomeCondition): HomeCondition =>
  HOME_CONDITIONS[
    Math.min(HOME_CONDITIONS.length - 1, HOME_CONDITIONS.indexOf(condition) + 1)
  ] as HomeCondition;

/**
 * Do it. A refresh lifts the condition and the value moves with it; anything
 * that recovers part of its cost adds that on top; a bedroom is a bedroom.
 * What it replaces in its group comes off the list.
 */
export function renovated(
  home: OwnedHome,
  renovation: Renovation,
  cost: number,
  year: number,
): OwnedHome {
  const condition = renovation.refresh ? better(home.condition) : home.condition;
  const lifted =
    (Number(home.value) / 100) * (CONDITION_PRICE[condition] / CONDITION_PRICE[home.condition]);
  const value = Math.round(lifted + cost * renovation.recovery);
  const kept = (home.renovations ?? []).filter(
    (entry) => findRenovation(entry.renovationId)?.group !== renovation.group,
  );
  const entry: HomeRenovation = { renovationId: renovation.id, cost, year };
  return {
    ...home,
    condition,
    beds: home.beds + renovation.beds,
    value: dollars(value),
    renovations: [...kept, entry],
  };
}
