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

/**
 * Anything that can appear between braces in catalog text.
 *
 * `mother`, `father`, `parent` and `parents` render as what a CHILD actually
 * calls them — "Mom", "Dad", "Mom and Dad" — not as first names. Review put it
 * plainly: 90% of kids do not call their parents by name, and event text that
 * did read as though the character were somebody's colleague.
 *
 * `motherName` and `fatherName` still give the first name, for the rare line
 * where a child genuinely would use it — overhearing adults, reading a form,
 * a hospital corridor. The Family screen is unaffected and shows real names.
 */
export const TEXT_TOKENS = [
  'me',
  'mother',
  'father',
  'parent',
  'parents',
  'motherName',
  'fatherName',
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
  // An incidental person's own pronouns. See PERSON_PRONOUN_TOKENS.
  'kidThey',
  'kidThem',
  'kidTheir',
  'kid2They',
  'kid2Them',
  'kid2Their',
  'adultThey',
  'adultThem',
  'adultTheir',
] as const;

export type TextToken = (typeof TEXT_TOKENS)[number];

/** Tokens that draw a person who is not in the character's family. */
export const PERSON_TOKENS = ['kid', 'kid2', 'adult'] as const;
export type PersonToken = (typeof PERSON_TOKENS)[number];

/**
 * Pronouns belonging to an incidental person, not to the player.
 *
 * Review caught the reason these exist: an outcome read "You told Lucía exactly
 * what you thought of him." The line had been written with a bare "him" because
 * the incidental pool was assumed to be genderless — but names are drawn from
 * the culture's male AND female lists, so half the time the copy misgendered
 * the person it had just named.
 *
 * A bound name already determines a sex: a kid's name is in one of the two
 * lists, and an adult renders with a title. So the pronoun is derived from the
 * binding rather than stored, which means no save shape changes and a decision
 * answered next week still says "she" about the same person.
 */
export const PERSON_PRONOUN_TOKENS = [
  'kidThey',
  'kidThem',
  'kidTheir',
  'kid2They',
  'kid2Them',
  'kid2Their',
  'adultThey',
  'adultThem',
  'adultTheir',
] as const;

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

/**
 * The sex of an already-bound person, read back off their name.
 *
 * An adult carries a title, so that answers it outright. A child's name came
 * from one of the culture's two lists, so the lists answer it. Anything else —
 * a fallback name, a culture that has since dropped a name — is treated as
 * male, which is a coin flip rather than a claim.
 */
function sexOfBoundName(name: string, nameCultureId: string): 'male' | 'female' {
  if (name.startsWith('Mrs.') || name.startsWith('Ms.') || name.startsWith('Miss')) return 'female';
  if (name.startsWith('Mr.')) return 'male';
  const culture = findNameCulture(nameCultureId);
  if (culture?.female.includes(name)) return 'female';
  return 'male';
}

interface Pronouns {
  readonly they: string;
  readonly them: string;
  readonly their: string;
}

const PRONOUNS: Readonly<Record<'male' | 'female', Pronouns>> = {
  male: { they: 'he', them: 'him', their: 'his' },
  female: { they: 'she', them: 'her', their: 'her' },
};

/** Neutral, for a line whose person was never bound. Never reached in shipped copy. */
const NEUTRAL: Pronouns = { they: 'they', them: 'them', their: 'their' };

function pronounsFor(name: string | undefined, nameCultureId: string): Pronouns {
  if (!name) return NEUTRAL;
  return PRONOUNS[sexOfBoundName(name, nameCultureId)];
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
  const needsIncidental =
    /\{[Kk]id2?(They|Them|Their)?\}/.test(template) && (!bindings.kid || !bindings.kid2);
  const [drawnKid, drawnKid2] = needsIncidental
    ? incidentalNames(context, source, 2)
    : [undefined, undefined];
  const needsAdult = /\{[Aa]dult(They|Them|Their)?\}/.test(template) && !bindings.adult;
  const drawnAdult = needsAdult ? adultName(context, source, namesInUse(context)) : undefined;

  const mum = mother(context.family);
  const dad = father(context.family);
  const sibs = siblings(context.family).filter((member) => member.alive);
  const sibling = sibs[0];
  const older = oldest(sibs);

  // What a child calls them, not what the census calls them. "Mom" works both
  // at the start of a sentence and mid-sentence, because it is being used as a
  // name — "Mom read to you" and "You asked Mom" are both right.
  const mumWord = mum ? 'Mom' : undefined;
  const dadWord = dad ? 'Dad' : undefined;

  const kidName = bindings.kid ?? drawnKid;
  const kid2Name = bindings.kid2 ?? drawnKid2;
  const adultBound = bindings.adult ?? drawnAdult;
  const kidP = pronounsFor(kidName, context.nameCultureId);
  const kid2P = pronounsFor(kid2Name, context.nameCultureId);
  const adultP = pronounsFor(adultBound, context.nameCultureId);

  const values: Record<string, string | undefined> = {
    me: context.firstName,
    mother: mumWord,
    father: dadWord,
    parent: mumWord ?? dadWord,
    parents: mum && dad ? 'Mom and Dad' : (mumWord ?? dadWord),
    // First names, for the rare line where a child genuinely would use one.
    motherName: mum?.firstName,
    fatherName: dad?.firstName,
    sibling: sibling?.firstName,
    siblingRel: sibling ? (sibling.sex === 'male' ? 'brother' : 'sister') : undefined,
    olderSibling: older?.firstName,
    city: context.homeCity,
    kid: kidName,
    kid2: kid2Name,
    adult: adultBound,
    they: context.sex === 'male' ? 'he' : 'she',
    them: context.sex === 'male' ? 'him' : 'her',
    their: context.sex === 'male' ? 'his' : 'her',
    kidThey: kidP.they,
    kidThem: kidP.them,
    kidTheir: kidP.their,
    kid2They: kid2P.they,
    kid2Them: kid2P.them,
    kid2Their: kid2P.their,
    adultThey: adultP.they,
    adultThem: adultP.them,
    adultTheir: adultP.their,
  };

  return template.replace(TOKEN_PATTERN, (whole, name: string) => {
    const value = values[name] ?? FALLBACKS[name];
    if (value) return value;
    // A capitalised token is the same token at the start of a sentence:
    // "{KidThey} did not deny any of it." Resolving it here means copy does not
    // have to choose between correct pronouns and correct sentence case.
    const first = name.charAt(0);
    if (first >= 'A' && first <= 'Z') {
      const lower = first.toLowerCase() + name.slice(1);
      const resolved = values[lower] ?? FALLBACKS[lower];
      if (resolved) return resolved.charAt(0).toUpperCase() + resolved.slice(1);
    }
    return whole;
  });
}

/**
 * Used only when an event's eligibility failed to guarantee the person it talks
 * about. The catalog test makes that unreachable; these exist so a content
 * mistake reads as slightly generic prose instead of `{mother}`.
 */
const FALLBACKS: Record<string, string> = {
  mother: 'Mom',
  father: 'Dad',
  parent: 'your parent',
  parents: 'your parents',
  motherName: 'your mom',
  fatherName: 'your dad',
  sibling: 'your sibling',
  siblingRel: 'sibling',
  olderSibling: 'your older sibling',
  city: 'town',
  kid: 'a kid you knew',
  kid2: 'another kid',
  adult: 'a teacher',
  kidThey: 'they',
  kidThem: 'them',
  kidTheir: 'their',
  kid2They: 'they',
  kid2Them: 'them',
  kid2Their: 'their',
  adultThey: 'they',
  adultThem: 'them',
  adultTheir: 'their',
};

/** Every token name used in a line. For validation. */
export function tokensIn(template: string): string[] {
  return [...template.matchAll(TOKEN_PATTERN)].map((match) => match[1] as string);
}
