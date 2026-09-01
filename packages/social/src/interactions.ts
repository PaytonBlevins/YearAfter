/**
 * Ticket 0206 — the things you can do to somebody.
 *
 * Spec 1662 asks for "friend formation and core interactions". Spec 730–733
 * names the ordinary social actions: compliment, flirt, befriend, make a move,
 * insult, attack. This is the childhood subset of that list — flirt and make a
 * move arrive with Love (Ticket 0207), and attack with Crime (0901).
 *
 * Two rules shape the whole menu, both learned the hard way earlier in this
 * build:
 *
 *  1. ONE INTERACTION PER PERSON PER YEAR. Every other action in this game
 *     works that way — Study Harder, a tryout — and for the same reason: an
 *     unlimited button is not a decision, it is a grind with a maximum. A player
 *     who can press "Hang out" forty times has a best friend by Tuesday.
 *  2. IT CAN GO BADLY. A menu where every option is neutral-or-better is a
 *     reward with extra steps (CORE_RULES 13.4). Making a joke to somebody who
 *     does not like you yet is how you find out they do not like you yet.
 *
 * Outcomes are weighted by the relationship you already have, so the same action
 * reads differently at 20 and at 80 — which is the whole of what a friendship
 * is, expressed as a probability.
 */

import type { Acquaintance } from './people';

export type InteractionId =
  | 'hang-out'
  | 'compliment'
  | 'joke'
  | 'secret'
  | 'ask-for-help'
  | 'fall-out'
  | 'make-up'
  | 'ask-about-work';

export interface Interaction {
  readonly id: InteractionId;
  readonly label: string;
  /** One line under the label, saying what it actually is. */
  readonly blurb: string;
  readonly kind: Acquaintance['kind'] | 'both';
  /** Best chance of it landing, at a relationship of 100. */
  readonly bestChance: number;
  /** Chance of it landing at a relationship of 0. */
  readonly worstChance: number;
  /** Warmth when it lands, and when it does not. */
  readonly onGood: number;
  readonly onBad: number;
  /** A memory the other person keeps forever, rather than one that fades. */
  readonly major?: boolean;
  /** Only offered when the relationship is at least this. */
  readonly minRelationship?: number;
  /** Only offered when the relationship is at most this. */
  readonly maxRelationship?: number;
}

/**
 * The catalog.
 *
 * Deliberately short. Spec 879–943 wants leaf actions inside a hub rather than
 * forty rows, and a childhood friendship does not have forty verbs in it.
 */
export const INTERACTIONS: readonly Interaction[] = [
  {
    id: 'hang-out',
    label: 'Hang out',
    blurb: 'An afternoon with nothing planned.',
    kind: 'peer',
    bestChance: 0.95,
    worstChance: 0.45,
    onGood: 8,
    onBad: -3,
  },
  {
    id: 'compliment',
    label: 'Say something nice',
    blurb: 'Risky at this age, and worth it when it lands.',
    kind: 'both',
    bestChance: 0.9,
    worstChance: 0.35,
    onGood: 6,
    onBad: -5,
  },
  {
    id: 'joke',
    label: 'Make a joke',
    blurb: 'It either kills or it does not.',
    kind: 'peer',
    bestChance: 0.85,
    worstChance: 0.4,
    onGood: 7,
    onBad: -6,
  },
  {
    id: 'secret',
    label: 'Tell them something',
    blurb: 'Something you have not told anybody else.',
    kind: 'peer',
    bestChance: 0.88,
    worstChance: 0.25,
    onGood: 14,
    onBad: -14,
    major: true,
    minRelationship: 45,
  },
  {
    id: 'ask-for-help',
    label: 'Ask for help',
    blurb: 'With homework, or with something worse.',
    kind: 'both',
    bestChance: 0.9,
    worstChance: 0.3,
    onGood: 9,
    onBad: -4,
  },
  {
    id: 'ask-about-work',
    label: 'Stay behind and ask',
    blurb: 'About the thing you did not follow in class.',
    kind: 'teacher',
    bestChance: 0.92,
    worstChance: 0.55,
    onGood: 8,
    onBad: -2,
  },
  {
    id: 'fall-out',
    label: 'Have it out with them',
    blurb: 'Say the thing. It will not be unsaid.',
    kind: 'peer',
    bestChance: 0.35,
    worstChance: 0.1,
    onGood: 5,
    onBad: -26,
    major: true,
  },
  {
    id: 'make-up',
    label: 'Try to fix it',
    blurb: 'Go first, and hope.',
    kind: 'peer',
    bestChance: 0.8,
    worstChance: 0.35,
    onGood: 18,
    onBad: -6,
    major: true,
    // Only when something is actually wrong. Offering "Try to fix it" beside
    // "Have it out with them" to somebody you are getting on fine with reads as
    // the menu not knowing what is going on.
    maxRelationship: 42,
  },
];

export const findInteraction = (id: string): Interaction | undefined =>
  INTERACTIONS.find((entry) => entry.id === id);

/**
 * What is on the menu for this person right now.
 *
 * A teacher and a classmate get different lists, and "Try to fix it" only
 * appears when there is something to fix — an option that is always available
 * and never applicable is worse than no option.
 */
export function interactionsFor(person: Acquaintance): readonly Interaction[] {
  return INTERACTIONS.filter((entry) => {
    if (entry.kind !== 'both' && entry.kind !== person.kind) return false;
    if (entry.minRelationship !== undefined && person.relationship < entry.minRelationship) {
      return false;
    }
    if (entry.maxRelationship !== undefined && person.relationship > entry.maxRelationship) {
      return false;
    }
    return true;
  });
}

/**
 * The odds this lands, given where the relationship already is.
 *
 * Linear between the two ends. Charisma helps, because it is the visible stat
 * this is obviously about and a stat with no consumer is decoration.
 */
export function chanceOf(interaction: Interaction, person: Acquaintance, charisma: number): number {
  const closeness = person.relationship / 100;
  const base =
    interaction.worstChance + (interaction.bestChance - interaction.worstChance) * closeness;
  const charismaBonus = ((charisma - 50) / 50) * 0.12;
  const chance = base + charismaBonus;
  return chance < 0.05 ? 0.05 : chance > 0.97 ? 0.97 : chance;
}

export interface InteractionResult {
  readonly worked: boolean;
  readonly warmth: number;
  readonly major: boolean;
  /** The line written to the feed and kept as the other person's memory. */
  readonly text: string;
}

/**
 * Resolve one interaction.
 *
 * Pure: the caller supplies the draws, so the balance tooling can run this ten
 * thousand times and the game replays it from a seed.
 */
export function resolveInteraction(
  interaction: Interaction,
  person: Acquaintance,
  charisma: number,
  name: string,
  roll: number,
  variant: number,
): InteractionResult {
  const worked = roll < chanceOf(interaction, person, charisma);
  const lines = (worked ? GOOD_LINES : BAD_LINES)[interaction.id];
  const index = Math.min(lines.length - 1, Math.floor(variant * lines.length));
  return {
    worked,
    warmth: worked ? interaction.onGood : interaction.onBad,
    major: Boolean(interaction.major),
    text: (lines[index] as string).replace(/\{name\}/g, name),
  };
}

/**
 * Outcome copy.
 *
 * Written to the rules in `claude/event-writing-rules.md`: a scene with a named
 * person, something concrete happening, and a bad outcome that is genuinely bad
 * rather than a softer good one. `{name}` is the only token — the person is
 * already known, so nothing here needs the event engine's binding machinery.
 */
const GOOD_LINES: Readonly<Record<InteractionId, readonly string[]>> = {
  'hang-out': [
    'Spent an afternoon at {name}’s doing nothing in particular, which turned out to be the point.',
    'You and {name} walked the long way home and were both late for dinner.',
    'Ended up at {name}’s until it got dark and nobody noticed the time.',
  ],
  compliment: [
    'You told {name} they were the best in the year at it. {name} pretended not to care and told two people.',
    'Said something nice to {name} and got a look that stayed with you for a week.',
  ],
  joke: [
    'Made {name} laugh so hard a teacher came over to find out what was happening.',
    'The joke landed. {name} still brings it up.',
  ],
  secret: [
    'Told {name} the thing you had not told anybody. {name} kept it, and still has.',
    'Said it out loud to {name} for the first time. Nothing bad happened, which was the surprise.',
  ],
  'ask-for-help': [
    '{name} sat with you until it made sense, and did not make it a thing.',
    'Asked {name} for help and got it, immediately, without the price you were expecting.',
  ],
  'ask-about-work': [
    'Stayed behind and asked. {name} explained it twice and was pleased to be asked.',
    '{name} kept you back ten minutes and it was the ten minutes the year turned on.',
  ],
  'fall-out': ['You said it. {name} took it, thought about it, and said you were probably right.'],
  'make-up': [
    'You went first. {name} had been waiting for somebody to, and it was over in a minute.',
    'Apologised properly to {name}. It took a term to be normal again, and then it was.',
  ],
};

const BAD_LINES: Readonly<Record<InteractionId, readonly string[]>> = {
  'hang-out': [
    '{name} already had plans, and was not sorry enough about it.',
    'Sat around at {name}’s not talking. You both went home early.',
  ],
  compliment: [
    'You told {name} they were good at it. {name} assumed you wanted something.',
    'It came out wrong. {name} repeated it back to you, in front of people, in a voice.',
  ],
  joke: [
    'Nobody laughed. {name} looked at you the way you had been afraid of.',
    '{name} laughed a beat too late, which was worse than not laughing.',
  ],
  secret: [
    'Told {name}. Four people knew by Friday and you never worked out how.',
    '{name} made a joke of it in front of everybody, and did not understand why that was the end.',
  ],
  'ask-for-help': [
    '{name} said yes and then did not turn up, twice.',
    'Asked {name}, who told you to work it out yourself. It was fair and it still stung.',
  ],
  'ask-about-work': ['{name} was packing up and told you to read the chapter again.'],
  'fall-out': [
    'You said all of it. {name} said less, and meant it more, and that was that.',
    'It went further than you meant. Neither of you took any of it back.',
  ],
  'make-up': [
    'You apologised. {name} accepted it in the way that means nothing has been accepted.',
    'Went first, and found out {name} had already stopped caring.',
  ],
};
