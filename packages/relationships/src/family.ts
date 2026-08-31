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

export type FamilyRole = 'mother' | 'father' | 'sibling';

export interface FamilyMember extends Npc {
  readonly role: FamilyRole;
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

export const parents = (household: Household): FamilyMember[] =>
  household.members.filter((member) => member.role !== 'sibling');

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
  const rank: Record<FamilyRole, number> = { mother: 0, father: 1, sibling: 2 };
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
