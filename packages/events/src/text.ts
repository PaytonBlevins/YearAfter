/**
 * Ticket 0203b — event text.
 *
 * Event copy is written with tokens rather than names, so one line covers every
 * family shape: "{mother} kept the drawing on the fridge for a year." A token
 * that cannot be resolved is a content bug, not a runtime one — the catalog test
 * proves every token in every line is resolvable — so resolution falls back to a
 * neutral phrase rather than rendering a literal brace at the player.
 *
 * NAMES ARE BOUND ONCE PER DECISION. An earlier version drew an incidental name
 * every time a line rendered, which meant the prompt could say "{kid} is at the
 * water fountain" and the outcome could name somebody else entirely. A decision
 * declares the tokens it depends on (`personTokens`), the engine resolves them
 * when the decision is raised, and the same bindings render the prompt, every
 * option label and every outcome. Passive events keep the old behaviour, which
 * is safe because a passive event is a single line.
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
  'adult',
  'they',
  'them',
  'their',
] as const;

export type TextToken = (typeof TEXT_TOKENS)[number];

/** Tokens that draw a person who is not in the character's family. */
export const PERSON_TOKENS = ['kid', 'kid2', 'adult'] as const;
export type PersonToken = (typeof PERSON_TOKENS)[number];

/** Names bound for one decision: token -> the person it means, all year. */
export type NameBindings = Readonly<Partial<Record<PersonToken, string>>>;

const TOKEN_PATTERN = /\{([a-zA-Z0-9]+)\}/g;

export interface TokenSource {
  /** Draws incidental names — the kid down the street, the teacher next door. */
  pick<T>(values: readonly T[]): T;
}

const FALLBACK_NAMES = ['Sam', 'Alex', 'Jamie', 'Robin', 'Casey'];

/**
 * Surnames, for an adult the character would not call by a first name.
 *
 * A teacher is "Mrs. Okafor", not "Grace" — and using a child's given-name pool
 * for a forty-year-old produces the wrong register entirely.
 */
function adultName(context: EventContext, source: TokenSource, taken: Set<string>): string {
  const culture = findNameCulture(context.nameCultureId);
  if (!culture) return 'Mr. Alvarez';
  let surname = source.pick(culture.surnames);
  for (let attempt = 0; attempt < 6 && taken.has(surname); attempt += 1) {
    surname = source.pick(culture.surnames);
  }
  taken.add(surname);
  // Alternating by a property of the name keeps this deterministic without
  // spending another draw on a coin flip.
  const title = surname.length % 2 === 0 ? 'Mrs.' : 'Mr.';
  return `${title} ${surname}`;
}

/**
 * Names the character's own family already uses, which incidental people must
 * not reuse. "Fell out with Sebastián" when the player IS Sebastián reads as a
 * bug even though it is a legitimate draw.
 */
function namesInUse(context: EventContext): Set<string> {
  return new Set<string>([
    context.firstName,
    context.lastName,
    ...context.family.members.map((member) => member.firstName),
    ...context.family.members.map((member) => member.lastName),
  ]);
}

function incidentalNames(context: EventContext, source: TokenSource, count: number): string[] {
  const culture = findNameCulture(context.nameCultureId);
  const pool = culture ? [...culture.male, ...culture.female] : FALLBACK_NAMES;
  const taken = namesInUse(context);
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

/**
 * Bind the people a decision talks about, once.
 *
 * Called when a decision is RAISED. The result is stored on the pending decision
 * and used to render everything about it from then on, including the outcome the
 * player sees after answering — possibly days later, on a different device.
 */
export function bindPersonNames(
  tokens: readonly string[],
  context: EventContext,
  source: TokenSource,
): NameBindings {
  const bindings: Partial<Record<PersonToken, string>> = {};
  const taken = namesInUse(context);

  const wantsKid = tokens.includes('kid');
  const wantsKid2 = tokens.includes('kid2');
  if (wantsKid || wantsKid2) {
    const culture = findNameCulture(context.nameCultureId);
    const pool = culture ? [...culture.male, ...culture.female] : FALLBACK_NAMES;
    for (const token of ['kid', 'kid2'] as const) {
      if (!tokens.includes(token)) continue;
      let name = source.pick(pool);
      for (let attempt = 0; attempt < 6 && taken.has(name); attempt += 1) {
        name = source.pick(pool);
      }
      taken.add(name);
      bindings[token] = name;
    }
  }

  if (tokens.includes('adult')) {
    bindings.adult = adultName(context, source, taken);
  }

  return bindings;
}

function oldest(members: readonly FamilyMember[]): FamilyMember | undefined {
  return [...members].sort((a, b) => a.birthYear - b.birthYear)[0];
}

/**
 * Resolve every token in a line.
 *
 * `bindings` wins where present — that is how a decision keeps one name across
 * its prompt and its outcomes. Without bindings, incidental names are drawn
 * here, and `source` is consumed only when the line actually needs one, so
 * adding a `{kid}` to one event's copy does not shift the draws every other
 * event sees.
 */
export function renderEventText(
  template: string,
  context: EventContext,
  source: TokenSource,
  bindings: NameBindings = {},
): string {
  const needsIncidental = /\{kid2?\}/.test(template) && (!bindings.kid || !bindings.kid2);
  const [drawnKid, drawnKid2] = needsIncidental
    ? incidentalNames(context, source, 2)
    : [undefined, undefined];
  const needsAdult = /\{adult\}/.test(template) && !bindings.adult;
  const drawnAdult = needsAdult ? adultName(context, source, namesInUse(context)) : undefined;

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
    kid: bindings.kid ?? drawnKid,
    kid2: bindings.kid2 ?? drawnKid2,
    adult: bindings.adult ?? drawnAdult,
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
  kid: 'a kid you knew',
  kid2: 'another kid',
  adult: 'a teacher',
};

/** Every token name used in a line. For validation. */
export function tokensIn(template: string): string[] {
  return [...template.matchAll(TOKEN_PATTERN)].map((match) => match[1] as string);
}
