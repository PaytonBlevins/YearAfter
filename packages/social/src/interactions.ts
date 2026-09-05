/**
 * Ticket 0206 — the things you can do to somebody.
 *
 * Spec 1662 asks for "friend formation and core interactions". Spec 730–733
 * names the ordinary social actions: compliment, flirt, befriend, make a move,
 * insult, attack. This is the childhood subset of that list — flirt and make a
 * move arrive with Love (Ticket 0207), and attack with Crime (0901).
 *
 * Two rules shape the whole menu:
 *
 *  1. LIGHT THINGS REPEAT, HEAVY THINGS DO NOT. Review, on the first version:
 *     "I don't like how you can only perform one action with your classmate per
 *     year." So hanging around, a compliment and a joke can be done as often as
 *     the player likes, worth steadily less as the year goes on — the fourth
 *     compliment in a term is not the first. Telling somebody your secret,
 *     having it out with them and going first to fix it stay once a year,
 *     because you cannot tell a secret twice and falling out every Tuesday is a
 *     loop rather than a friendship.
 *  2. IT CAN GO BADLY. A menu where every option is neutral-or-better is a
 *     reward with extra steps (CORE_RULES 13.4). The light options fail small —
 *     an afternoon that did not come off costs a couple of points — and the
 *     heavy ones fail properly, which is what makes them worth pressing.
 *
 * Outcomes are weighted by the relationship you already have, so the same action
 * reads differently at 20 and at 80 — which is the whole of what a friendship
 * is, expressed as a probability.
 */

import { repeatScale, type Acquaintance } from './people';

export type InteractionId =
  | 'hang-out'
  | 'compliment'
  | 'joke'
  | 'secret'
  | 'ask-for-help'
  | 'fall-out'
  | 'make-up'
  // Teachers, innocent…
  | 'ask-about-work'
  | 'help-out'
  | 'ask-reference'
  // …and otherwise. Review: "interact with my teacher (innocently and
  // mischievously)." The mischievous half moves school STANDING, which is the
  // hook that routes a character into an alternative school (spec 73).
  | 'talk-back'
  | 'wind-up'
  | 'skip-class';

/**
 * Light things repeat; heavy things are once a year.
 *
 * The distinction is not about size of effect — it is about whether doing the
 * thing twice in one year means anything. You can hang around with somebody
 * every week. You cannot tell them the same secret in March and again in June.
 */
export type InteractionWeight = 'light' | 'heavy';

export interface Interaction {
  readonly id: InteractionId;
  readonly label: string;
  /** One line under the label, saying what it actually is. */
  readonly blurb: string;
  readonly kind: Acquaintance['kind'] | 'both';
  readonly weight: InteractionWeight;
  /**
   * School standing this moves, signed. Teachers only — a classmate cannot put
   * you in detention. This is the same field events use, so mischief routes
   * through the machinery that already exists rather than a parallel one.
   */
  readonly behaviour?: number;
  /** Marks the mischievous half of the teacher menu, for its own section. */
  readonly mischief?: boolean;
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
    weight: 'light',
    bestChance: 0.95,
    worstChance: 0.45,
    onGood: 8,
    onBad: -2,
  },
  {
    id: 'compliment',
    label: 'Say something nice',
    blurb: 'Cheap, and it works more often than it should.',
    kind: 'both',
    weight: 'light',
    bestChance: 0.92,
    worstChance: 0.45,
    onGood: 6,
    onBad: -2,
  },
  {
    id: 'joke',
    label: 'Make a joke',
    blurb: 'It either kills or it does not.',
    kind: 'peer',
    weight: 'light',
    bestChance: 0.85,
    worstChance: 0.4,
    onGood: 7,
    onBad: -4,
  },
  {
    id: 'ask-for-help',
    label: 'Ask for help',
    blurb: 'With homework, or with something worse.',
    kind: 'both',
    weight: 'light',
    bestChance: 0.9,
    worstChance: 0.3,
    onGood: 9,
    onBad: -3,
  },
  {
    id: 'secret',
    label: 'Tell them something',
    blurb: 'Something you have not told anybody else.',
    kind: 'peer',
    weight: 'heavy',
    bestChance: 0.88,
    worstChance: 0.25,
    onGood: 14,
    onBad: -14,
    major: true,
    minRelationship: 45,
  },
  {
    id: 'fall-out',
    label: 'Have it out with them',
    blurb: 'Say the thing. It will not be unsaid.',
    kind: 'peer',
    weight: 'heavy',
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
    weight: 'heavy',
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

  /* ---- teachers, innocently ---------------------------------------------- */
  {
    id: 'ask-about-work',
    label: 'Stay behind and ask',
    blurb: 'About the thing you did not follow in class.',
    kind: 'teacher',
    weight: 'light',
    bestChance: 0.92,
    worstChance: 0.55,
    onGood: 8,
    onBad: -1,
    behaviour: 1,
  },
  {
    id: 'help-out',
    label: 'Offer to help',
    blurb: 'Carry the boxes. Stack the chairs. It gets noticed.',
    kind: 'teacher',
    weight: 'light',
    bestChance: 0.94,
    worstChance: 0.6,
    onGood: 7,
    onBad: -1,
    behaviour: 2,
  },
  {
    id: 'ask-reference',
    label: 'Ask them to put in a word',
    blurb: 'For the thing you want and have not earned yet.',
    kind: 'teacher',
    weight: 'heavy',
    bestChance: 0.85,
    worstChance: 0.15,
    onGood: 12,
    onBad: -9,
    major: true,
    minRelationship: 55,
  },

  /* ---- teachers, otherwise ------------------------------------------------ */
  {
    id: 'wind-up',
    label: 'Wind them up',
    blurb: 'Nothing you could be written up for. Almost nothing.',
    kind: 'teacher',
    weight: 'light',
    mischief: true,
    bestChance: 0.5,
    worstChance: 0.32,
    onGood: 2,
    onBad: -7,
    behaviour: -4,
  },
  {
    id: 'talk-back',
    label: 'Talk back',
    blurb: 'In front of everybody, which is the point.',
    kind: 'teacher',
    weight: 'heavy',
    mischief: true,
    bestChance: 0.3,
    worstChance: 0.14,
    onGood: 3,
    onBad: -16,
    major: true,
    behaviour: -11,
  },
  {
    id: 'skip-class',
    label: 'Skip their class',
    blurb: 'A whole afternoon of not being there.',
    kind: 'teacher',
    weight: 'heavy',
    mischief: true,
    bestChance: 0.42,
    worstChance: 0.24,
    onGood: 0,
    onBad: -12,
    major: true,
    behaviour: -14,
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
  /** School standing this moved. Zero for everything but a teacher. */
  readonly behaviour: number;
  /** True when the year's light interactions with this person are used up. */
  readonly worn: boolean;
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
  alreadyDone = 0,
): InteractionResult {
  // A light thing done too often this year stops being worth anything, and
  // says so rather than quietly returning nothing.
  const scale = interaction.weight === 'light' ? repeatScale(alreadyDone) : 1;
  if (scale <= 0) {
    const lines = WORN_LINES[person.kind];
    const index = Math.min(lines.length - 1, Math.floor(variant * lines.length));
    return {
      worked: false,
      warmth: 0,
      major: false,
      behaviour: 0,
      worn: true,
      text: (lines[index] as string).replace(/\{name\}/g, name),
    };
  }

  const worked = roll < chanceOf(interaction, person, charisma);
  const lines = (worked ? GOOD_LINES : BAD_LINES)[interaction.id];
  const index = Math.min(lines.length - 1, Math.floor(variant * lines.length));
  const raw = worked ? interaction.onGood : interaction.onBad;
  // Getting away with something still costs standing, just less of it: the
  // teacher noticed, they simply could not prove it.
  const behaviour = interaction.behaviour
    ? Math.round(interaction.behaviour * (worked && interaction.behaviour < 0 ? 0.45 : 1))
    : 0;
  return {
    worked,
    warmth: Math.round(raw * scale),
    major: Boolean(interaction.major),
    behaviour,
    worn: false,
    text: (lines[index] as string).replace(/\{name\}/g, name),
  };
}

/**
 * What happens when the player keeps pressing.
 *
 * There is no wall and no error. The person is simply done with it for now, in
 * a sentence — which is the difference between a limit the game explains and a
 * button that stops working.
 */
const WORN_LINES: Readonly<Record<Acquaintance['kind'], readonly string[]>> = {
  peer: [
    'You have been round at {name}’s a lot lately. Enough that it was starting to show.',
    '{name} was polite about it, in the way that means give it a week.',
  ],
  teacher: [
    '{name} has seen a great deal of you this term, and said so.',
    '{name} told you, kindly, to try it yourself first.',
  ],
};

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
  'help-out': [
    'Stayed to stack the chairs. {name} did not make a thing of it and did not forget it either.',
    'Carried the boxes down for {name}, who started leaving the good jobs for you.',
  ],
  'ask-reference': [
    '{name} put a word in for you with somebody who mattered, and did not mention it.',
    '{name} said yes before you had finished asking, which told you something.',
  ],
  'wind-up': [
    'Got {name} going for a solid four minutes. The class has never respected you more.',
    'Said it under your breath and {name} chose not to have heard it.',
  ],
  'talk-back': [
    'Said it out loud to {name}, in front of thirty people, and the room went completely silent.',
  ],
  'skip-class': ['Missed {name}’s whole afternoon and nobody ever asked where you had been.'],
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
  'help-out': ['{name} said they had it, in a voice that meant go away.'],
  'ask-reference': [
    'Asked {name}, who said they did not really know you well enough. Which was fair.',
    '{name} said yes and then wrote something so lukewarm it did more harm than nothing.',
  ],
  'wind-up': [
    'It landed badly. {name} did not shout, which was worse, and remembered it all year.',
    'Nobody laughed and {name} moved your seat.',
  ],
  'talk-back': [
    'You said it and {name} sent you out, and it went further up than you expected.',
    'It came out nastier than you meant. {name} never quite looked at you the same way.',
  ],
  'skip-class': [
    '{name} noticed, phoned home, and the afternoon cost considerably more than it bought.',
  ],
  'fall-out': [
    'You said all of it. {name} said less, and meant it more, and that was that.',
    'It went further than you meant. Neither of you took any of it back.',
  ],
  'make-up': [
    'You apologised. {name} accepted it in the way that means nothing has been accepted.',
    'Went first, and found out {name} had already stopped caring.',
  ],
};
