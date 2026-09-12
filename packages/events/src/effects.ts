/**
 * Ticket 0203 — applying what an event did.
 *
 * The surface is deliberately narrow: stats, family warmth, pocket money and
 * story flags. Careers, school and the financial ledger own their own state and
 * arrive on their own tickets; an event reaches them by setting a flag, never by
 * writing into them from here. Widening this interface should feel like a
 * decision, because it is one.
 *
 * Everything returns new values. Nothing is mutated in place (CORE_RULES).
 */

import { nudgeStats, type VisibleStats } from '@yearafter/character';
import type { EventEffects } from '@yearafter/content';
import type { Money } from '@yearafter/core';
import { clampStat } from '@yearafter/core';
import { type FamilyMember, type Household } from '@yearafter/relationships';
import { withFlags, type EventHistory } from './history';

/**
 * What an event wants to do to money, reported rather than done.
 *
 * Ticket 0301: `applyEffects` used to move cash and floor it at zero, and the
 * catalog's `{ delta, source }` shape has carried the source since 0203b with
 * nowhere for it to land. It lands in the ledger now, posted by the events
 * phase, so the floor is applied once with the whole year in view.
 */
export interface ReportedCash {
  /** Whole dollars, signed. */
  readonly delta: number;
  /** CORE_RULES 13.6, authored in the catalog since 0203b. */
  readonly source: string;
}

export interface EffectTargets {
  readonly stats: VisibleStats;
  readonly family: Household;
  readonly cash: Money;
  /**
   * School standing (Ticket 0204). Carried as a bare number rather than as the
   * education state, so this package still does not depend on
   * @yearafter/education — the phase module owns putting it back.
   */
  readonly behaviour: number;
  /**
   * Stress accumulated from this year's events, in points (Ticket 0205).
   *
   * Carried as a bare running total rather than as the character's stress
   * level: the level is computed once, at the end of the year, by the stress
   * phase, from everything that happened. An event contributes to the year; it
   * does not set how stressed somebody is.
   */
  readonly stress: number;
  readonly history: EventHistory;
}

function warmthDelta(member: FamilyMember, effects: EventEffects): number {
  const byRole = effects.relationship ?? {};
  let delta = byRole.family ?? 0;
  if (member.role === 'mother') delta += (byRole.parents ?? 0) + (byRole.mother ?? 0);
  if (member.role === 'father') delta += (byRole.parents ?? 0) + (byRole.father ?? 0);
  if (member.role === 'sibling') delta += byRole.siblings ?? 0;
  return delta;
}

/**
 * What came back out, which is the targets plus what the event wants to move.
 *
 * A separate type rather than an optional field on `EffectTargets`, because
 * the two are genuinely different things: targets are what you hand IN and the
 * reported movement is only ever produced. Putting it on the input type would
 * let a caller pass one, which nothing should ever do.
 */
export interface AppliedEffects extends EffectTargets {
  readonly cashDelta?: ReportedCash;
}

export function applyEffects(targets: EffectTargets, effects?: EventEffects): AppliedEffects {
  if (!effects) return targets;

  // nudgeStats, not adjustStats: an event's numbers are a strength, not a
  // guaranteed amount. See the growth curve in @yearafter/character.
  const stats = effects.stats ? nudgeStats(targets.stats, effects.stats) : targets.stats;

  const touchesFamily = effects.relationship !== undefined;
  const family: Household = touchesFamily
    ? {
        ...targets.family,
        members: targets.family.members.map((member) => {
          const delta = warmthDelta(member, effects);
          return delta === 0
            ? member
            : { ...member, relationship: clampStat(member.relationship + delta) };
        }),
      }
    : targets.family;

  /*
    Ticket 0301 took money away from this function.

    It used to apply the delta itself and floor at zero, with a comment saying
    money owed its real rules to the ledger "until then". The ledger exists now,
    so this REPORTS what the event wants to move and the events phase posts it —
    which means the floor is applied once, by `post`, with the whole year in
    view, and the unpaid part is written down rather than silently vanishing.

    `cash` is still returned, unchanged, so `EffectTargets` keeps its shape and
    every caller still reads the balance it started with.
  */
  const cashDelta = effects.cash;

  const behaviour =
    effects.behaviour === undefined
      ? targets.behaviour
      : clampStat(targets.behaviour + effects.behaviour);

  const stress = targets.stress + (effects.stress ?? 0);

  const history =
    effects.setFlags || effects.clearFlags
      ? withFlags(targets.history, effects.setFlags, effects.clearFlags)
      : targets.history;

  return {
    stats,
    family,
    cash: targets.cash,
    ...(cashDelta ? { cashDelta } : {}),
    behaviour,
    stress,
    history,
  };
}
