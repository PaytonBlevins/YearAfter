/**
 * Ticket 0203 — the condition evaluator.
 *
 * One evaluator serves both eligibility ("may this fire at all?") and modifiers
 * ("how much likelier is it here?"), because they are the same question asked
 * twice. Every present field must hold; an absent field is not a constraint.
 *
 * There is no OR. Two events read better than one nested boolean tree, and the
 * text of each variant can then be specific to its case — which is the whole
 * point of having a large library rather than a clever one.
 */

import { TALENT_KEYS, VISIBLE_STAT_KEYS, type VisibleStatKey } from '@yearafter/character';
import type { EventCondition, FamilyRequirement } from '@yearafter/content';
import { father, livingParents, mother, siblings, type Household } from '@yearafter/relationships';
import type { EventContext } from './context';

function satisfiesFamily(
  requirement: FamilyRequirement,
  family: Household,
  playerBirthYear: number,
): boolean {
  const parents = livingParents(family);
  const sibs = siblings(family).filter((member) => member.alive);
  switch (requirement) {
    case 'mother':
      return Boolean(mother(family)?.alive);
    case 'father':
      return Boolean(father(family)?.alive);
    case 'anyParent':
      return parents.length > 0;
    case 'bothParents':
      return parents.length === 2;
    case 'singleParent':
      return parents.length === 1;
    case 'sibling':
      return sibs.length > 0;
    case 'siblings2':
      return sibs.length >= 2;
    case 'olderSibling':
      // Siblings generated at birth are always older (Ticket 0202), but later
      // births will not be, so this compares years rather than assuming.
      return sibs.some((sibling) => sibling.birthYear < playerBirthYear);
    case 'onlyChild':
      return sibs.length === 0;
  }
}

function warmth(family: Household, role: 'mother' | 'father' | 'sibling'): number | undefined {
  if (role === 'mother') return mother(family)?.relationship;
  if (role === 'father') return father(family)?.relationship;
  const sibs = siblings(family);
  if (sibs.length === 0) return undefined;
  return sibs.reduce((total, sibling) => total + sibling.relationship, 0) / sibs.length;
}

export function matchesCondition(condition: EventCondition, context: EventContext): boolean {
  if (condition.ageMin !== undefined && context.age < condition.ageMin) return false;
  if (condition.ageMax !== undefined && context.age > condition.ageMax) return false;
  if (condition.sex !== undefined && context.sex !== condition.sex) return false;

  /* ---- Ticket 0409: work, the body, and loss ----------------------------- */
  if (condition.employed !== undefined && context.employed !== condition.employed) return false;
  if (condition.jobTrackAny && !condition.jobTrackAny.includes(context.jobTrack ?? '')) {
    return false;
  }
  if (condition.jobYearsAtLeast !== undefined && context.jobYears < condition.jobYearsAtLeast) {
    return false;
  }
  if (condition.jobYearsAtMost !== undefined && context.jobYears > condition.jobYearsAtMost) {
    return false;
  }
  if (
    condition.hasCondition !== undefined &&
    context.conditions.length > 0 !== condition.hasCondition
  ) {
    return false;
  }
  if (
    condition.conditionAny &&
    !condition.conditionAny.some((id) => context.conditions.includes(id))
  ) {
    return false;
  }
  if (
    condition.bereavedWithin !== undefined &&
    (context.bereavedWithin === undefined || context.bereavedWithin > condition.bereavedWithin)
  ) {
    return false;
  }

  /* ---- Ticket 0412: friends ---------------------------------------------- */
  // The fifth predicate of this shape, after `partnered`, `hasChildren`,
  // `employed` and `hasCondition`, and the one whose absence cost the most: the
  // `friendship` category's entire adult library is romance because this is
  // what the language could not ask. CORE_RULES 13.67.
  if (condition.hasFriend !== undefined && context.friends > 0 !== condition.hasFriend) {
    return false;
  }
  if (condition.friendsAtLeast !== undefined && context.friends < condition.friendsAtLeast) {
    return false;
  }
  if (condition.friendsAtMost !== undefined && context.friends > condition.friendsAtMost) {
    return false;
  }
  if (
    condition.friendshipYearsAtLeast !== undefined &&
    context.friendshipYears < condition.friendshipYearsAtLeast
  ) {
    return false;
  }

  if (condition.schoolStageAny && !condition.schoolStageAny.includes(context.schoolStage)) {
    return false;
  }
  if (
    condition.activitiesAtLeast !== undefined &&
    context.activityCount < condition.activitiesAtLeast
  ) {
    return false;
  }
  if (
    condition.activitiesAtMost !== undefined &&
    context.activityCount > condition.activitiesAtMost
  ) {
    return false;
  }

  // Money the character has to actually have. An event that spends what is not
  // there floors the balance at zero and tells the player they spent it, which
  // is CORE_RULES 13.6 broken from the other direction.
  if (condition.partnered !== undefined && context.partnered !== condition.partnered) {
    return false;
  }
  if (condition.hasChildren !== undefined && context.hasChildren !== condition.hasChildren) {
    return false;
  }
  if (condition.cashAtLeast !== undefined && context.cash < condition.cashAtLeast) {
    return false;
  }

  const playerBirthYear = context.year - context.age;
  for (const requirement of condition.requires ?? []) {
    if (!satisfiesFamily(requirement, context.family, playerBirthYear)) return false;
  }

  if (condition.talentsAny && !condition.talentsAny.some((key) => context.talents[key])) {
    return false;
  }
  if (condition.talentsNone?.some((key) => context.talents[key])) return false;

  if (condition.wealthAny && !condition.wealthAny.includes(context.family.finances.band)) {
    return false;
  }

  for (const [key, minimum] of statPairs(condition.statAtLeast)) {
    if (context.stats[key] < minimum) return false;
  }
  for (const [key, maximum] of statPairs(condition.statAtMost)) {
    if (context.stats[key] > maximum) return false;
  }

  for (const [role, minimum] of Object.entries(condition.relationshipAtLeast ?? {})) {
    const value = warmth(context.family, role as 'mother' | 'father' | 'sibling');
    if (value === undefined || value < minimum) return false;
  }
  for (const [role, maximum] of Object.entries(condition.relationshipAtMost ?? {})) {
    const value = warmth(context.family, role as 'mother' | 'father' | 'sibling');
    if (value === undefined || value > maximum) return false;
  }

  if (condition.flagsAll?.some((flag) => !context.flags.has(flag))) return false;
  if (condition.flagsNone?.some((flag) => context.flags.has(flag))) return false;

  return true;
}

function statPairs(
  values: Partial<Record<VisibleStatKey, number>> | undefined,
): [VisibleStatKey, number][] {
  if (!values) return [];
  const pairs: [VisibleStatKey, number][] = [];
  for (const key of VISIBLE_STAT_KEYS) {
    const value = values[key];
    if (value !== undefined) pairs.push([key, value]);
  }
  return pairs;
}

/**
 * Structural check used by the content validator and by the catalog test, so a
 * typo in a talent or stat name fails the build rather than silently making an
 * event unreachable.
 */
export function conditionProblems(condition: EventCondition): string[] {
  const problems: string[] = [];
  const statKeys = new Set<string>(VISIBLE_STAT_KEYS);
  const talentKeys = new Set<string>(TALENT_KEYS);

  for (const key of Object.keys(condition.statAtLeast ?? {})) {
    if (!statKeys.has(key)) problems.push(`unknown stat "${key}" in statAtLeast`);
  }
  for (const key of Object.keys(condition.statAtMost ?? {})) {
    if (!statKeys.has(key)) problems.push(`unknown stat "${key}" in statAtMost`);
  }
  for (const key of condition.talentsAny ?? []) {
    if (!talentKeys.has(key)) problems.push(`unknown talent "${key}" in talentsAny`);
  }
  for (const key of condition.talentsNone ?? []) {
    if (!talentKeys.has(key)) problems.push(`unknown talent "${key}" in talentsNone`);
  }
  if (
    condition.ageMin !== undefined &&
    condition.ageMax !== undefined &&
    condition.ageMin > condition.ageMax
  ) {
    problems.push(`age window is inverted (${condition.ageMin}..${condition.ageMax})`);
  }
  const requires = new Set(condition.requires ?? []);
  if (requires.has('onlyChild') && requires.has('sibling')) {
    problems.push('requires both "onlyChild" and "sibling" — can never fire');
  }
  if (requires.has('singleParent') && requires.has('bothParents')) {
    problems.push('requires both "singleParent" and "bothParents" — can never fire');
  }
  return problems;
}
