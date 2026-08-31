/**
 * Ticket 0203 — event text.
 *
 * Event copy is written with tokens rather than names, so one line covers every
 * family shape: "{mother} kept the drawing on the fridge for a year." A token
 * that cannot be resolved is a content bug, not a runtime one — the catalog test
 * proves every token in every line is resolvable — so resolution falls back to a
 * neutral phrase rather than rendering a literal brace at the player.
 *
 * Tone rule from spec 725–770: concise and conversational. Light events can be
 * funny; serious ones are respectful. Second person, past tense, one or two
 * sentences.
 */

import { findNameCulture } from '@yearafter/content';
import { father, mother, siblings, type FamilyMember } from '@yearafter/relationships';
import type { EventContext } from './context';

/** Anything that can appear between braces in catalog text. */
export const TEXT_TOKENS = [
  'me',
  'mother',
  'father',
  'parent',
  'parents',
  'sibling',
  'siblingRel',
  'olderSibling',
  'city',
  'kid',
  'kid2',
  'they',
  'them',
  'their',
] as const;

export type TextToken = (typeof TEXT_TOKENS)[number];

const TOKEN_PATTERN = /\{([a-zA-Z0-9]+)\}/g;

export interface TokenSource {
  /** Draws incidental names — the kid down the street, the rival at school. */
  pick<T>(values: readonly T[]): T;
}

const FALLBACK_NAMES = ['Sam', 'Alex', 'Jamie', 'Robin', 'Casey'];

function incidentalNames(context: EventContext, source: TokenSource, count: number): string[] {
  const culture = findNameCulture(context.nameCultureId);
  const pool = culture ? [...culture.male, ...culture.female] : FALLBACK_NAMES;
  // "Fell out with Sebastián" when the player IS Sebastián reads as a bug even
  // though it is a legitimate draw, and so does a friend who shares a parent's
  // name. Both are excluded, and so is the other incidental name in the line.
  const taken = new Set<string>([
    context.firstName,
    ...context.family.members.map((member) => member.firstName),
  ]);
  const chosen: string[] = [];
  for (let i = 0; i < count; i += 1) {
    let name = source.pick(pool);
    // A handful of retries is cheaper and more readable than shuffling a
    // ninety-name pool, and the collision is rare.
    for (let attempt = 0; attempt < 6 && taken.has(name); attempt += 1) {
      name = source.pick(pool);
    }
    taken.add(name);
    chosen.push(name);
  }
  return chosen;
}

function oldest(members: readonly FamilyMember[]): FamilyMember | undefined {
  return [...members].sort((a, b) => a.birthYear - b.birthYear)[0];
}

/**
 * Resolve every token in a line.
 *
 * `source` is the RNG stream, and it is consumed only when a line actually
 * contains an incidental-name token — so adding a `{kid}` to one event's text
 * does not shift the draws every other event sees.
 */
export function renderEventText(
  template: string,
  context: EventContext,
  source: TokenSource,
): string {
  const needsNames = /\{kid2?\}/.test(template);
  const [kid, kid2] = needsNames ? incidentalNames(context, source, 2) : ['a kid', 'another kid'];

  const mum = mother(context.family);
  const dad = father(context.family);
  const sibs = siblings(context.family).filter((member) => member.alive);
  const sibling = sibs[0];
  const older = oldest(sibs);

  const values: Record<string, string | undefined> = {
    me: context.firstName,
    mother: mum?.firstName,
    father: dad?.firstName,
    parent: mum?.firstName ?? dad?.firstName,
    parents: mum && dad ? `${mum.firstName} and ${dad.firstName}` : (mum ?? dad)?.firstName,
    sibling: sibling?.firstName,
    siblingRel: sibling ? (sibling.sex === 'male' ? 'brother' : 'sister') : undefined,
    olderSibling: older?.firstName,
    city: context.homeCity,
    kid,
    kid2,
    they: context.sex === 'male' ? 'he' : 'she',
    them: context.sex === 'male' ? 'him' : 'her',
    their: context.sex === 'male' ? 'his' : 'her',
  };

  return template.replace(TOKEN_PATTERN, (whole, name: string) => {
    const value = values[name];
    if (value) return value;
    return FALLBACKS[name] ?? whole;
  });
}

/**
 * Used only when an event's eligibility failed to guarantee the person it talks
 * about. The catalog test makes that unreachable; these exist so a content
 * mistake reads as slightly generic prose instead of `{mother}`.
 */
const FALLBACKS: Record<string, string> = {
  mother: 'your mom',
  father: 'your dad',
  parent: 'your parent',
  parents: 'your parents',
  sibling: 'your sibling',
  siblingRel: 'sibling',
  olderSibling: 'your older sibling',
  city: 'town',
};

/** Every token name used in a line. For validation. */
export function tokensIn(template: string): string[] {
  return [...template.matchAll(TOKEN_PATTERN)].map((match) => match[1] as string);
}
