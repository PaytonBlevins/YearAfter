/**
 * Ticket 0205 — the stress foundation.
 *
 * Spec 1660: "backend stress from workload/relationships without a manual
 * time-budget UI." Spec 661 and 1824 forbid a visible time budget or capacity
 * allocator outright. Spec 1986 sets the whole design: "Commitments internally
 * contribute to stress, happiness, and performance. Players may overcommit
 * rather than being blocked."
 *
 * So this is a system the player mostly cannot see. It reads what a character
 * has taken on and how their household is going, produces a number, and turns
 * that number back into consequences and a sentence in the feed. There is no
 * screen for it, no budget, and no allocator. Spec 1094 puts Stress among the
 * common visible variables as "Stress when relevant" — so it appears beside the
 * seven canonical stats only once it is actually doing something, and disappears
 * again when it is not.
 *
 * Spec 1030 and 1079 also route mental health through here rather than through a
 * separate visible system: "Do not maintain a separate visible mental-health
 * system. Fold relevant effects into Happiness, Stress, Health events."
 *
 * Pure with respect to game state, like every other domain package — it never
 * imports @yearafter/simulation, so the balance tooling can run ten thousand
 * childhoods in plain Node.
 */

import type { Personality, VisibleStats } from '@yearafter/character';
import { clampStat, type StatValue } from '@yearafter/core';
import { livingParents, siblings, type Household } from '@yearafter/relationships';

/* -------------------------------------------------------------------------- */
/* Where stress comes from                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A named contribution to this year's stress.
 *
 * Named rather than summed, because the feed line has to be able to say WHICH
 * thing made the year hard. "You had too much on" is a number talking; "There
 * was too much on, and it was not a good year at home" is a life.
 */
export interface StressSource {
  readonly kind: 'workload' | 'home' | 'events' | 'school';
  /** Points of stress, before the character's own resilience. */
  readonly points: number;
  /** How this reads in a sentence, lower case, no full stop. */
  readonly phrase: string;
}

/**
 * Where a full schedule starts to cost something, as a fraction of capacity.
 *
 * 0204 only measured hours ABOVE capacity, and reading 3,400 simulated years
 * found that number was zero in every single one: capacity runs 17–21 hours a
 * week and nothing a character joins gets them there until they have joined
 * five or six things. The whole workload model — the thing spec 1660 names as
 * the source of stress — had never once engaged, and neither had 0204's own
 * grade penalties. A system nobody can trigger is not a system.
 *
 * So stress reads PRESSURE rather than overflow. A character at 95% of what
 * they can carry is not at zero; they are close to the edge, which is where a
 * busy teenager actually lives. Below the shoulder, nothing at all — an
 * ordinary childhood must never be quietly taxed by a system with no screen.
 */
export const WORKLOAD_SHOULDER = 0.7;
export const WORKLOAD_SCALE = 55;

/**
 * Points of stress from a week that is too full.
 *
 * Linear past the shoulder, and deliberately steep: it is 16 points at exactly
 * capacity and about 37 at half again, which is the difference between a busy
 * year and a year that broke something.
 */
export function workloadPressure(hours: number, capacity: number): number {
  if (capacity <= 0 || hours <= 0) return 0;
  const ratio = hours / capacity;
  if (ratio <= WORKLOAD_SHOULDER) return 0;
  return (ratio - WORKLOAD_SHOULDER) * WORKLOAD_SCALE;
}

/**
 * How far below this a family relationship has to sit before it costs anything.
 *
 * Deliberately low. Ordinary teenage friction with a parent is not a stressor;
 * a household where nobody is speaking to you is. Setting this near the average
 * would make every character permanently stressed by their own family, which is
 * both untrue and boring.
 */
export const HOME_COMFORT_THRESHOLD = 45;
export const HOME_STRAIN_WEIGHT = 0.5;

/** A parent who has died, or is otherwise gone from the household. */
export const BEREAVEMENT_STRESS = 22;
export const SOLE_PARENT_STRESS = 4;

/** School standing low enough that being at school is itself a problem. */
export const BAD_STANDING_THRESHOLD = 40;
export const BAD_STANDING_STRESS = 9;

export interface StressInputs {
  /** Committed hours per week this year, from the education phase. */
  readonly hours: number;
  /** What this character can carry, from @yearafter/education's capacity model. */
  readonly capacity: number;
  readonly household: Household;
  /** School standing, 0–100. Undefined for a character not in school. */
  readonly behaviour?: number;
  /** Sum of `stress` effects from this year's events. Can be negative. */
  readonly eventStress: number;
}

/**
 * Everything pushing on this character this year, itemised.
 *
 * Returned as a list rather than a total so the phase module can name the
 * biggest one in the feed. An empty list is a year with nothing wrong in it,
 * which is most years, and which is the point.
 */
export function stressSources(inputs: StressInputs): readonly StressSource[] {
  const sources: StressSource[] = [];

  const workload = workloadPressure(inputs.hours, inputs.capacity);
  if (workload > 0) {
    sources.push({
      kind: 'workload',
      points: workload,
      phrase: 'there was more on than there were hours',
    });
  }

  const parents = livingParents(inputs.household);
  const family = [...parents, ...siblings(inputs.household).filter((member) => member.alive)];
  const strain = family.reduce(
    (total, member) => total + Math.max(0, HOME_COMFORT_THRESHOLD - member.relationship),
    0,
  );
  if (strain > 0) {
    sources.push({
      kind: 'home',
      points: strain * HOME_STRAIN_WEIGHT,
      phrase: 'home was not somewhere to relax',
    });
  }

  // Losing a parent is the single largest thing that can happen to a child, and
  // it should not be reachable by adding up hours. The household knows: a
  // member who is `alive: false` is somebody who died while the player watched.
  const lost = inputs.household.members.filter(
    (member) => !member.alive && (member.role === 'mother' || member.role === 'father'),
  ).length;
  if (lost > 0) {
    sources.push({
      kind: 'home',
      points: BEREAVEMENT_STRESS * lost,
      phrase: 'the house was still short a person',
    });
  } else if (parents.length === 1) {
    // Not a tragedy, and not nothing: one adult carrying a household is a
    // quieter, permanent pressure that the child absorbs some of.
    sources.push({
      kind: 'home',
      points: SOLE_PARENT_STRESS,
      phrase: 'there was only one of them holding it together',
    });
  }

  if (inputs.behaviour !== undefined && inputs.behaviour < BAD_STANDING_THRESHOLD) {
    sources.push({
      kind: 'school',
      points: ((BAD_STANDING_THRESHOLD - inputs.behaviour) / 40) * BAD_STANDING_STRESS,
      phrase: 'school had become somewhere to survive',
    });
  }

  if (inputs.eventStress !== 0) {
    sources.push({
      kind: 'events',
      points: inputs.eventStress,
      phrase: inputs.eventStress > 0 ? 'the year kept happening at you' : 'the year was kind',
    });
  }

  return sources;
}

/* -------------------------------------------------------------------------- */
/* How a character carries it                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Resilience: what the same year costs two different people.
 *
 * Willpower is the obvious one. Temper matters because somebody who runs hot
 * spends more on the same setback, and it gives a hidden trait another named
 * consumer (personality.ts requires one). Nothing here is shown to the player —
 * they see two characters have different years and work out why.
 */
export function resilience(stats: VisibleStats, personality: Personality): number {
  const willpower = (stats.willpower - 50) / 50; // -1 .. 1
  const temper = (personality.temper - 50) / 50;
  const scale = 1 - willpower * 0.35 + temper * 0.25;
  return scale < 0.4 ? 0.4 : scale > 1.7 ? 1.7 : scale;
}

/**
 * How much of last year's stress a character sheds when nothing is wrong.
 *
 * Generous enough that a good year genuinely fixes a bad one — stress that only
 * accumulates is a second health bar every character loses by eighteen, which is
 * the "separate visible mental-health system" spec 1030 forbids under a new
 * name. Not so generous that a bad year is forgotten by the next September: at
 * 0.35 a rough patch is still being felt two years later, which is why a run of
 * hard years reads differently from one hard year.
 */
export const RECOVERY = 0.35;

export function advanceStress(
  current: number,
  sources: readonly StressSource[],
  stats: VisibleStats,
  personality: Personality,
): StatValue {
  const added = sources.reduce((total, source) => total + source.points, 0);
  const scaled = added > 0 ? added * resilience(stats, personality) : added;
  // Recovery applies to where the character STARTED the year, so a hard year
  // still lands on top of a hard one — it just does not compound forever.
  const carried = current * (1 - RECOVERY);
  return clampStat(Math.round(carried + scaled));
}

/**
 * Stress from something that happens BETWEEN years.
 *
 * A decision is answered after Advance has already run, so its stress cannot
 * join that year's total — the year is over. It lands directly instead, scaled
 * by the same resilience so that answering a question and living through an
 * event cost the same character the same amount.
 */
export function applyImmediateStress(
  current: number,
  points: number,
  stats: VisibleStats,
  personality: Personality,
): StatValue {
  if (points === 0) return clampStat(Math.round(current));
  const scaled = points > 0 ? points * resilience(stats, personality) : points;
  return clampStat(Math.round(current + scaled));
}

/* -------------------------------------------------------------------------- */
/* What the player sees                                                        */
/* -------------------------------------------------------------------------- */

export type StressBand = 'fine' | 'stretched' | 'struggling' | 'overwhelmed';

/**
 * Below this, stress is not shown at all.
 *
 * Spec 1094 lists it as "Stress when relevant", and a bar that sits near zero
 * for twelve years teaches the player to ignore it — so when it finally matters
 * they will not look. It appears when it has something to say.
 */
export const RELEVANCE_THRESHOLD = 30;

export const isStressRelevant = (level: number): boolean => level >= RELEVANCE_THRESHOLD;

/**
 * Low enough to say so out loud.
 *
 * Well under the relevance threshold, deliberately: "things settled down" said
 * while a character is still most of the way to a bad year is worse than saying
 * nothing, because it tells the player the game is not watching.
 */
export const SETTLED_LEVEL = 12;

export function stressBand(level: number): StressBand {
  if (level >= 80) return 'overwhelmed';
  if (level >= 60) return 'struggling';
  if (level >= RELEVANCE_THRESHOLD) return 'stretched';
  return 'fine';
}

/**
 * The band in words, for the row that appears when stress is relevant.
 *
 * Spec 786–795: explain outcomes through context, not formulas. The player never
 * sees the number that produced these.
 */
export const STRESS_BAND_LABELS: Readonly<Record<StressBand, string>> = {
  fine: 'Coping',
  stretched: 'Stretched thin',
  struggling: 'Running on empty',
  overwhelmed: 'Something has to give',
};

/**
 * What carrying this costs, per year.
 *
 * Happiness and school performance, and deliberately NOT health.
 *
 * Spec 1079 names exactly three things commitments influence — Stress,
 * Happiness, Performance — and spec 1030 routes the physical side through
 * "Health events/conditions" rather than a continuous drain. A screenshot made
 * the case for following that literally: an overcommitted fourteen-year-old
 * came out of two years with Health at 29, because 0204's overload penalty and
 * this were both billing health for the same busy schedule. Two systems
 * charging the same account is how a stat ends up looking like an injury when
 * the character was only busy.
 *
 * Nothing below the relevance threshold costs anything, so an ordinary
 * childhood is never quietly taxed by a system the player cannot see.
 */
export function stressConsequences(level: number): {
  happiness: number;
  performance: number;
} {
  if (level < RELEVANCE_THRESHOLD) return { happiness: 0, performance: 0 };
  const severity = (level - RELEVANCE_THRESHOLD) / (100 - RELEVANCE_THRESHOLD); // 0 .. 1
  return {
    happiness: -Math.round(severity * 14),
    performance: -Math.round(severity * 7),
  };
}

/**
 * One sentence about a year that was hard, or nothing at all.
 *
 * The feed is where this system is visible. A player who never opens a stress
 * screen — there is no stress screen — should still be able to say what went
 * wrong that year, in the character's own story rather than in numbers.
 */
export function stressLine(
  level: number,
  previous: number,
  sources: readonly StressSource[],
): string | undefined {
  const band = stressBand(level);
  if (band === 'fine') {
    // Coming DOWN from a bad year is worth a line too — a recovery nobody
    // mentions reads as the system having quietly forgotten. But only once the
    // character is genuinely out of it: reading output caught "Things settled
    // down" written the year after a divorce, while stress was still at 24, and
    // the reassurance landed as the game not paying attention.
    if (stressBand(previous) !== 'fine' && level <= SETTLED_LEVEL) {
      return 'Things settled down. You could breathe again.';
    }
    return undefined;
  }

  const worst = [...sources].sort((a, b) => b.points - a.points)[0];
  const because = worst && worst.points > 0 ? worst.phrase : 'it was a lot, all year';

  if (band === 'overwhelmed') return `You were running on nothing — ${because}.`;
  if (band === 'struggling') return `A hard year: ${because}.`;
  return `You were stretched thin — ${because}.`;
}
