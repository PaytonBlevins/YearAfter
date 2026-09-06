/**
 * The starting family (Ticket 0202).
 *
 * Scope is deliberately the *data*: who exists, how they stand with the player,
 * and what the household can afford. What parents actually DO with that —
 * funding college, buying a vehicle, refusing help, kicking the player out — is
 * Ticket 0209, and lives outside this file.
 *
 * Spec 4.1: there is no family ID. A family is the set of people, not an entity
 * with an identity of its own. Persistent legacy identity (crests, coats of
 * arms) is spec 684–696 and a later milestone.
 */

import { dollars, type Money, type NpcId } from '@yearafter/core';
import type { Npc } from './npc';

export type FamilyRole = 'mother' | 'father' | 'sibling' | 'child';

export interface FamilyMember extends Npc {
  readonly role: FamilyRole;
  /**
   * Ticket 0208. For a child: the player's age when they arrived.
   *
   * Stored rather than derived from `birthYear`, because an adopted child was
   * born before they arrived and the two facts are different. The child's own
   * age still comes from `birthYear` like everybody else's.
   */
  readonly arrivedWhenPlayerWas?: number;
  readonly arrivedBy?: 'birth' | 'adoption';
  /**
   * For a child: the other parent, as their id in the social circle.
   *
   * A REFERENCE, not a copy. The partner is an `Acquaintance` and stays one —
   * duplicating them into the household would be the same two-places-disagree
   * failure CORE_RULES 13.19 exists to prevent, and this time the two records
   * would disagree about whether the player is still with the mother of their
   * children. Absent for an adoption by a single parent.
   */
  readonly otherParentId?: NpcId;
}

/**
 * Household financial standing at the player's birth.
 *
 * Spec 949 is explicit that the game must be fun at every level and should NOT
 * target a steep real-world wealth curve, so these bands are deliberately
 * kinder than reality — affluent and wealthy births are more common here than
 * in life. Spec 696 sets the other half of the rule: a prestigious birth
 * creates advantages, never guaranteed competence or success.
 */
export type WealthBand = 'struggling' | 'modest' | 'comfortable' | 'affluent' | 'wealthy';

export const WEALTH_BANDS: readonly WealthBand[] = [
  'struggling',
  'modest',
  'comfortable',
  'affluent',
  'wealthy',
];

/** Developer-facing only. The player never sees the band, just its consequences. */
export const WEALTH_BAND_LABELS: Readonly<Record<WealthBand, string>> = {
  struggling: 'Struggling',
  modest: 'Modest',
  comfortable: 'Comfortable',
  affluent: 'Affluent',
  wealthy: 'Wealthy',
};

export interface HouseholdFinances {
  readonly band: WealthBand;
  /** Household income for the year, integer cents. US-benchmarked (see catalogs). */
  readonly annualIncome: Money;
}

export interface Household {
  readonly members: readonly FamilyMember[];
  /**
   * Backend only. Spec 22 removed selectable lifestyle levels, and a child does
   * not read the household books — what the player sees is what their parents
   * do, not a number describing them.
   */
  readonly finances: HouseholdFinances;
}

export const EMPTY_HOUSEHOLD: Household = {
  members: [],
  finances: { band: 'modest', annualIncome: dollars(0) },
};

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

export const mother = (household: Household): FamilyMember | undefined =>
  household.members.find((member) => member.role === 'mother');

export const father = (household: Household): FamilyMember | undefined =>
  household.members.find((member) => member.role === 'father');

/**
 * The player's own parents.
 *
 * Named explicitly rather than as "everybody who is not a sibling", which is
 * what this was until Ticket 0208 added a fourth role. A negative filter over
 * an enum is correct exactly until the enum grows, and then it is silently
 * wrong: every child the player had would have been counted as one of their
 * parents, by `parents`, by `livingParents`, and by the `anyParent` event
 * requirement that decides whether a childhood event may fire.
 */
export const parents = (household: Household): FamilyMember[] =>
  household.members.filter((member) => member.role === 'mother' || member.role === 'father');

/** Ticket 0208. The player's own children, oldest first. */
export const children = (household: Household): FamilyMember[] =>
  household.members
    .filter((member) => member.role === 'child')
    .sort((a, b) => a.birthYear - b.birthYear);

export const livingChildren = (household: Household): FamilyMember[] =>
  children(household).filter((member) => member.alive);

export const siblings = (household: Household): FamilyMember[] =>
  household.members.filter((member) => member.role === 'sibling');

export const livingParents = (household: Household): FamilyMember[] =>
  parents(household).filter((member) => member.alive);

export const findMember = (household: Household, id: NpcId): FamilyMember | undefined =>
  household.members.find((member) => member.id === id);

/**
 * Ordering for the Family screen: parents first, then siblings oldest to
 * youngest. Stable, so the list does not reshuffle between renders.
 */
export function orderedMembers(household: Household): FamilyMember[] {
  const rank: Record<FamilyRole, number> = { mother: 0, father: 1, sibling: 2, child: 3 };
  return [...household.members].sort(
    (a, b) => rank[a.role] - rank[b.role] || a.birthYear - b.birthYear,
  );
}

/** Replace one member, returning a new household. State is never mutated. */
export function updateMember(
  household: Household,
  id: NpcId,
  change: (member: FamilyMember) => FamilyMember,
): Household {
  return {
    ...household,
    members: household.members.map((member) => (member.id === id ? change(member) : member)),
  };
}
