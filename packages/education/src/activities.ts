/**
 * Ticket 0204 — joining and leaving activities.
 *
 * The rule the product owner set, in his words: "I don't want [being limited to
 * one]. I want to keep workload realistic." So nothing here refuses a join on
 * the grounds that the character already has enough on. Eligibility is about
 * whether the activity is *available* to this character — right stage, old
 * enough, affordable, a parent free to drive them — and never about whether
 * they are busy.
 *
 * Being too busy is handled where it belongs: hours accumulate, capacity is
 * finite, and an overloaded year costs grades, health and happiness through
 * `workload.ts`. The player finds that out by living it rather than by being
 * told no.
 */

import type { Personality, TalentKey, Talents, VisibleStats } from '@yearafter/character';
import {
  ACTIVITIES,
  findActivity,
  type Activity,
  type ActivityKind,
  type SchoolStageId,
} from '@yearafter/content';
import { livingParents, type Household, type WealthBand } from '@yearafter/relationships';
import { hasJoined, isInSchool, type EducationState, EFFORT_HOURS } from './school';

export interface ActivityContext {
  readonly age: number;
  readonly stage: SchoolStageId;
  readonly stats: VisibleStats;
  readonly talents: Talents;
  readonly wealth: WealthBand;
  readonly household: Household;
}

/** Why an activity is not open to this character, or undefined if it is. */
export type Unavailable =
  | 'wrong-stage'
  | 'too-young'
  | 'too-old'
  | 'needs-talent'
  | 'needs-stat'
  | 'too-expensive'
  | 'needs-a-parent';

export function unavailableReason(
  activity: Activity,
  context: ActivityContext,
): Unavailable | undefined {
  const requires = activity.requires;
  if (!requires.stages.includes(context.stage)) return 'wrong-stage';
  if (requires.ageMin !== undefined && context.age < requires.ageMin) return 'too-young';
  if (requires.ageMax !== undefined && context.age > requires.ageMax) return 'too-old';
  if (requires.talentsAny && !requires.talentsAny.some((key) => context.talents[key])) {
    return 'needs-talent';
  }
  for (const [key, minimum] of Object.entries(requires.statAtLeast ?? {})) {
    if (context.stats[key as keyof VisibleStats] < minimum) return 'needs-stat';
  }
  if (requires.wealthAny && !requires.wealthAny.includes(context.wealth)) return 'too-expensive';
  if (requires.needsParent && livingParents(context.household).length === 0) {
    return 'needs-a-parent';
  }
  return undefined;
}

/** Player-facing explanation. Shown greyed beside a row it cannot join. */
export const UNAVAILABLE_LABELS: Readonly<Record<Unavailable, string>> = {
  'wrong-stage': 'Not at this school',
  'too-young': 'Too young',
  'too-old': 'Aged out',
  'needs-talent': 'They only take people who already play',
  'needs-stat': 'Not eligible yet',
  'too-expensive': 'Costs more than the family has',
  'needs-a-parent': 'Nobody free to drive you home',
};

export interface ActivityOffer {
  readonly activity: Activity;
  readonly joined: boolean;
  /** Undefined when it can be joined. */
  readonly unavailable?: Unavailable;
  /**
   * This must be earned rather than chosen, and has not been attempted yet this
   * school year. The row offers "Try out" or "Audition" instead of "Join".
   */
  readonly needsTryout: boolean;
  /** Already attempted this year; the next attempt is next year. */
  readonly attemptedThisYear: boolean;
}

/**
 * Everything on the sign-up table, joined and not.
 *
 * Ineligible rows are RETURNED, not filtered out: a menu that silently hides
 * what you cannot have teaches the player nothing, and "Nobody free to drive you
 * home" is a fact about their life worth seeing.
 */
export function activityOffers(
  state: EducationState,
  context: ActivityContext,
): readonly ActivityOffer[] {
  if (!isInSchool(state)) return [];
  return ACTIVITIES.filter((activity) => activity.requires.stages.includes(context.stage))
    .map((activity) => {
      const joined = hasJoined(state, activity.id);
      const attemptedThisYear = hasAttemptedThisYear(state, activity.id, context.age);
      return {
        activity,
        joined,
        unavailable: unavailableReason(activity, context),
        needsTryout: Boolean(activity.tryout) && !joined,
        attemptedThisYear: attemptedThisYear && !joined,
      };
    })
    .sort((a, b) => {
      if (a.joined !== b.joined) return a.joined ? -1 : 1;
      if (Boolean(a.unavailable) !== Boolean(b.unavailable)) return a.unavailable ? 1 : -1;
      return a.activity.name.localeCompare(b.activity.name);
    });
}

export function join(state: EducationState, activityId: string, age: number): EducationState {
  if (hasJoined(state, activityId) || !findActivity(activityId)) return state;
  return { ...state, activities: [...state.activities, { activityId, joinedAtAge: age }] };
}

export function leave(state: EducationState, activityId: string): EducationState {
  if (!hasJoined(state, activityId)) return state;
  return {
    ...state,
    activities: state.activities.filter((entry) => entry.activityId !== activityId),
  };
}

/** Everything a character has committed to, in hours per week, school included. */
export function committedHours(state: EducationState): number {
  const activityHours = state.activities.reduce((total, entry) => {
    const activity = findActivity(entry.activityId);
    return total + (activity?.hoursPerWeek ?? 0);
  }, 0);
  return EFFORT_HOURS[state.effort] + activityHours;
}

/** Annual cost of everything joined, in whole dollars, for the finance pass. */
export function committedCost(state: EducationState): number {
  return state.activities.reduce((total, entry) => {
    const activity = findActivity(entry.activityId);
    return total + (activity?.annualCost ?? 0);
  }, 0);
}

/** Every joined activity that still exists in the catalog. */
export function joinedActivities(state: EducationState): readonly Activity[] {
  return state.activities
    .map((entry) => findActivity(entry.activityId))
    .filter((activity): activity is Activity => activity !== undefined);
}

/**
 * Activities a character has aged out of.
 *
 * Returned rather than removed automatically, so the education phase can write
 * a line about leaving scouts rather than the row silently vanishing.
 */
export function outgrown(state: EducationState, stage: SchoolStageId): readonly Activity[] {
  return joinedActivities(state).filter((activity) => !activity.requires.stages.includes(stage));
}

/** Stat effects of a year in everything they are in, summed. */
export function annualActivityEffects(state: EducationState): Partial<VisibleStats> {
  const total: Record<string, number> = {};
  for (const activity of joinedActivities(state)) {
    for (const [key, value] of Object.entries(activity.effects)) {
      total[key] = (total[key] ?? 0) + value;
    }
  }
  return total as Partial<VisibleStats>;
}

/* -------------------------------------------------------------------------- */
/* Tryouts                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Some places you cannot simply decide to be in.
 *
 * Review, on the first version of this screen: "I was able to join the
 * basketball team just by clicking on it. I should have to tryout for things
 * like that." So a competitive activity is ATTEMPTED. The attempt is scored
 * against the relevant visible stat and the relevant talent, it can fail, and it
 * can be tried again next school year — which is what actually happens.
 *
 * This is separate from workload. Workload limits how MANY things a character
 * can carry; a tryout decides whether they are good enough for this one. Neither
 * ever refuses on the grounds that the character is busy.
 */

/** Chance of making it at an exactly average stat, with no talent. */
export const TRYOUT_BASE_CHANCE = 0.4;

/** How much the scored stat moves the odds, across its whole range. */
export const TRYOUT_STAT_WEIGHT = 0.55;

/** What the matching talent is worth. Large, but never a guarantee (spec 725–770). */
export const TRYOUT_TALENT_BONUS = 0.25;

/** Talent that counts for each kind of activity. */
const KIND_TALENT: Readonly<Record<ActivityKind, TalentKey | undefined>> = {
  sport: 'athletics',
  arts: 'acting',
  academic: 'academics',
  service: undefined,
  social: undefined,
};

/**
 * The odds of making it, before the draw.
 *
 * Exposed rather than buried so the balance tooling can sweep it, and so the
 * test that a talent helps but does not guarantee has something to assert on.
 */
export function tryoutChance(
  activity: Activity,
  stats: VisibleStats,
  talents: Talents,
  attemptsBefore: number,
): number {
  if (!activity.tryout) return 1;
  const stat = stats[activity.tryout.stat];
  const talent = KIND_TALENT[activity.kind];
  // Music has its own kind-less home in arts; check it too.
  const hasTalent = Boolean(
    (talent && talents[talent]) || (activity.kind === 'arts' && talents.music),
  );
  const chance =
    TRYOUT_BASE_CHANCE +
    ((stat - 50) / 50) * TRYOUT_STAT_WEIGHT +
    (hasTalent ? TRYOUT_TALENT_BONUS : 0) +
    // Somebody who keeps turning up gets known. Caps out quickly.
    Math.min(0.15, attemptsBefore * 0.075);
  return Math.max(0.05, Math.min(0.95, chance));
}

export interface TryoutResult {
  readonly made: boolean;
  readonly state: EducationState;
  /** The line for the feed. Always present — an attempt is worth recording. */
  readonly text: string;
}

/**
 * Attempt a tryout.
 *
 * `roll` is a number in [0, 1) from the caller's seeded stream, so this stays
 * pure and a life still replays from its seed.
 */
export function attemptTryout(
  state: EducationState,
  activity: Activity,
  stats: VisibleStats,
  talents: Talents,
  age: number,
  roll: number,
): TryoutResult {
  const attemptsBefore = state.tryouts[activity.id] ?? 0;
  const made = roll < tryoutChance(activity, stats, talents, attemptsBefore);
  const tryouts = { ...state.tryouts, [activity.id]: attemptsBefore + 1 };
  const tryoutYear = { ...state.tryoutYear, [activity.id]: age };

  if (!made) {
    return {
      made: false,
      state: { ...state, tryouts, tryoutYear },
      text: activity.cutText ?? `Did not make ${activity.name.toLowerCase()}.`,
    };
  }
  return {
    made: true,
    state: { ...join(state, activity.id, age), tryouts, tryoutYear },
    text: activity.tryoutText ?? activity.joinText,
  };
}

/**
 * Has this character already attempted this one since the school year turned?
 *
 * One attempt per year. Without this, a player taps until they make the team,
 * which is not a tryout, it is a slot machine.
 */
export const hasAttemptedThisYear = (
  state: EducationState,
  activityId: string,
  age: number,
): boolean => state.tryoutYear[activityId] === age;

export type { Activity, Personality };
