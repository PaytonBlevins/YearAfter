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
import { add, dollars, max, type Money, ZERO } from '@yearafter/core';
import { clampStat } from '@yearafter/core';
import { type FamilyMember, type Household } from '@yearafter/relationships';
import { withFlags, type EventHistory } from './history';

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

export function applyEffects(targets: EffectTargets, effects?: EventEffects): EffectTargets {
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

  // A child cannot go into debt from an event. Money owes its real rules to the
  // ledger (Ticket 0301); until then the floor is zero rather than a negative
  // balance nothing in the game yet knows how to resolve.
  const cash =
    effects.cash === undefined
      ? targets.cash
      : max(ZERO, add(targets.cash, dollars(effects.cash.delta)));

  const behaviour =
    effects.behaviour === undefined
      ? targets.behaviour
      : clampStat(targets.behaviour + effects.behaviour);

  const history =
    effects.setFlags || effects.clearFlags
      ? withFlags(targets.history, effects.setFlags, effects.clearFlags)
      : targets.history;

  return { stats, family, cash, behaviour, history };
}
