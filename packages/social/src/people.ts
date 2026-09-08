/**
 * Ticket 0206 — the people who are not your family.
 *
 * Review, after playing the 0204b build: "I also should be able to interact
 * with teachers and classmates."
 *
 * Until now every person in an event was invented for that line and forgotten
 * immediately. The engine drew a name from the character's naming culture,
 * rendered "You told Marisol what you thought of her", and threw Marisol away.
 * Read back over a childhood it produced sixty different names and no
 * relationships — the opposite of what a life feels like.
 *
 * So a childhood now has a CAST. A handful of classmates who are in the year
 * with you, one or two teachers a year, and the friends who come out of that.
 * Events bind to those people rather than inventing new ones, which is what
 * makes an interaction possible at all: you cannot talk to somebody the game
 * has already forgotten.
 *
 * Spec 674–683 puts this in tiers. A classmate you have never spoken to is tier
 * 3 background; somebody who matters is promoted to tier 2, and a best friend to
 * tier 1 — a change of tier, never a conversion, so promotion never rewrites
 * history. Spec 771–785 gives tier 1 and 2 people MEMORY: they remember the
 * things that defined the relationship, minor memories fade, major ones do not.
 */

import { clampStat, type StatValue } from '@yearafter/core';
import type { Npc } from '@yearafter/relationships';
// Type-only, and therefore erased: `romance.ts` needs `Acquaintance` and the
// person record needs `Romance`, so the two files reference each other. No
// runtime cycle exists because nothing is imported for its value.
import type { Romance } from './romance';

/* -------------------------------------------------------------------------- */
/* Who they are                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Peers and adults are genuinely different relationships, not one thing with a
 * flag: you can fall out with a classmate and you cannot fall out with a
 * teacher, and what each of them is for in a childhood is different.
 */
export type AcquaintanceKind = 'peer' | 'teacher';

/** Where the player knows this person from. Renders inside a sentence. */
/**
 * Where somebody came from.
 *
 * `work` arrives with Ticket 0210 and closes a gap 0207b left open by name: an
 * adult met people through where they lived and what they still did, and work —
 * the place most adults meet most people — was missing, so a character's social
 * world thinned out the moment school ended.
 *
 * Spec 1305–1309 decides where these people are SHOWN, and it is emphatic:
 * the Relationships screen is Family and Friends, and "professional
 * relationships stay in their own worlds". A colleague is on the Career screen.
 * They become a friend, and move, only if the friendship outlives the job.
 */
export type MeetingContext = 'school' | 'neighbourhood' | 'activity' | 'app' | 'work';

export const CONTEXT_LABELS: Readonly<Record<MeetingContext, string>> = {
  school: 'from school',
  neighbourhood: 'from your street',
  activity: 'from a club',
  app: 'from an app',
  work: 'from work',
};

/**
 * Something this person remembers about the player.
 *
 * Spec 771–785: important NPCs remember meaningful events, minor memories may
 * decay, major ones can persist, and reconciliation stays possible. The text is
 * stored already rendered, because the person it names has to read the same way
 * in ten years as it did the day it happened.
 */
export interface SocialMemory {
  /** The player's age when it happened. */
  readonly age: number;
  readonly text: string;
  /** Major memories never decay. Minor ones fall off the end. */
  readonly major: boolean;
  /** What it did to the relationship, signed. Kept so the feed can explain. */
  readonly warmth: number;
}

/** How many minor memories one person keeps before the oldest falls off. */
export const MINOR_MEMORY_LIMIT = 6;

export interface Acquaintance extends Npc {
  readonly kind: AcquaintanceKind;
  readonly context: MeetingContext;
  /** The player's age when they met. */
  readonly metAtAge: number;
  /**
   * The player's age at the last interaction of any kind.
   *
   * This is what makes a friendship something you keep rather than something
   * you collect: a person you stop seeing cools, and eventually drifts out.
   */
  readonly lastContactAge: number;
  readonly memories: readonly SocialMemory[];
  /**
   * Whether this person is in the room with the player this year.
   *
   * Being in the same class IS contact, and forgetting that was the bug reading
   * output found first: classmates start around 30, drift costs 7 a year, and
   * the drift-out floor is 22 — so every classmate the player had not
   * specifically interacted with evaporated within a year and the class turned
   * over completely every September. A cast that changes entirely each year is
   * not a cast.
   *
   * A friend who has moved to another school stays `current` but stops being
   * in the room, and from then on the friendship has to survive on its own.
   * That is the moment childhood friendships are actually decided.
   *
   * **Ticket 0211a renamed this from `inClass`,** and the rename is the fix
   * rather than tidying. A field called `inClass` had exactly one room in it,
   * so when 0210 gave adults a job the only way to be surrounded by people was
   * still to be at school — the player's report: *"on the people page, in the
   * friends tab, it shows two people in my class, yet I am working a job. It
   * also shows no coworkers on the job screen when it should. You will be
   * surrounded by people, its up to you to build a relationship or not."*
   *
   * A room is now anything you turn up to every week: a class, a team you are
   * still on, and — since 0211a — the job you currently hold. `context` says
   * WHICH room; this says whether you are still in it. CORE_RULES 13.23.
   */
  readonly inRoom: boolean;
  /**
   * The activity this person came from, when they are a teammate.
   *
   * Being on the same team every week is contact exactly as being in the same
   * class is — so while the player is still in that activity, this person does
   * not drift. Quitting the team starts the clock, which is the honest version
   * of what happens to the people you only knew through a thing you did.
   */
  readonly viaActivityId?: string;
  /**
   * The job this person came from, when they are a colleague (Ticket 0211a).
   *
   * The exact counterpart of `viaActivityId`, and it exists for the same
   * reason: the room has to be identifiable, or leaving it cannot end it. Two
   * spells in the same TITLE at different places are different rooms, so this
   * is the job id rather than the title.
   */
  readonly viaJobId?: string;
  /** For a teacher: what they teach, so a row can say "Mrs. Okafor · English". */
  readonly subject?: string;
  /**
   * For a teacher: the title a child uses. Stored rather than derived from sex,
   * because the event text already renders `{adult}` with a title and the two
   * must agree — a teacher who is "Mrs. Okafor" in the feed cannot be "Ms."
   * on their own page.
   */
  readonly title?: string;
  /** The player's age when this ended. Present means they are in the past. */
  readonly endedAtAge?: number;
  /** How it ended, for the one line the feed writes about it. */
  readonly endedBecause?: 'drifted' | 'fell out' | 'moved away' | 'moved on';
  /**
   * Ticket 0207. Whether the player is, or was, going out with this person.
   *
   * Deliberately a field on the person rather than a separate partner record.
   * Somebody you are seeing is a classmate or a teammate who you are also seeing
   * — they keep the memories they already had, they drift if you stop turning
   * up, and when it ends they are in the same list of people you used to know as
   * everybody else. Two models would have meant two places that disagree about
   * whether you still speak to them.
   */
  readonly romance?: Romance;
}

/**
 * How much of this year has already been spent on one person.
 *
 * Review, on the first version: "I don't like how you can only perform one
 * action with your classmate per year." Fair — a hard wall after one tap is a
 * rule the player runs into rather than a life they are living.
 *
 * So the wall is gone and the counting stays. Light things — hanging around,
 * a compliment, a joke — can be done as often as the player likes, and are
 * worth steadily less as the year goes on, because the fourth compliment in a
 * term is not worth what the first was. Heavy things stay once a year: you
 * cannot tell somebody your secret twice, and having it out with a person
 * every Tuesday is not a friendship, it is a loop.
 */
export interface YearContact {
  /** The player's age this counting belongs to. A new age resets it. */
  readonly age: number;
  readonly light: number;
  readonly heavy: number;
}

export interface SocialCircle {
  readonly people: readonly Acquaintance[];
  /** Contact spent this school year, by person id. */
  readonly contact: Readonly<Record<string, YearContact>>;
}

export const EMPTY_CIRCLE: SocialCircle = { people: [], contact: {} };

/** What has been spent on this person this year, zeroed when the year turns. */
export function contactWith(circle: SocialCircle, personId: string, age: number): YearContact {
  const entry = circle.contact[personId];
  return entry && entry.age === age ? entry : { age, light: 0, heavy: 0 };
}

/**
 * How much a light interaction is still worth, after this many already.
 *
 * Reaches zero rather than tailing off forever, and the menu says so before
 * the player presses: a button that silently stops working is the same bug as
 * a button that does nothing, wearing a friendlier face.
 */
export const LIGHT_FALLOFF = 0.28;

export function repeatScale(alreadyDone: number): number {
  const scale = 1 - alreadyDone * LIGHT_FALLOFF;
  return scale < 0 ? 0 : scale;
}

/** Light interactions left before this person has had enough of you this year. */
export const lightLeft = (alreadyDone: number): number =>
  Math.max(0, Math.ceil(1 / LIGHT_FALLOFF) - 1 - alreadyDone);

/* -------------------------------------------------------------------------- */
/* How close                                                                   */
/* -------------------------------------------------------------------------- */

export type Bond = 'know of them' | 'acquaintance' | 'friend' | 'close friend' | 'best friend';

/**
 * Bond from the relationship number.
 *
 * Derived, never stored: two fields that can disagree about how close somebody
 * is would be exactly the drift CORE_RULES 11 exists to prevent.
 */
export function bondOf(person: Acquaintance): Bond {
  if (person.kind === 'teacher') return person.relationship >= 70 ? 'friend' : 'acquaintance';
  if (person.relationship >= 90) return 'best friend';
  if (person.relationship >= 72) return 'close friend';
  if (person.relationship >= 50) return 'friend';
  if (person.relationship >= 30) return 'acquaintance';
  return 'know of them';
}

/** A friend is somebody at or above this. Below it they are just in your year. */
export const FRIENDSHIP_THRESHOLD = 50;

export const isFriend = (person: Acquaintance): boolean =>
  person.kind === 'peer' &&
  person.endedAtAge === undefined &&
  person.relationship >= FRIENDSHIP_THRESHOLD;

export const isCurrent = (person: Acquaintance): boolean => person.endedAtAge === undefined;

/**
 * What a teacher is called.
 *
 * A child does not call a forty-year-old by their first name, which is the same
 * rule the event text follows for `{adult}`. Peers get their given name,
 * because that is what a child would say.
 */
export const displayName = (person: Acquaintance): string =>
  person.kind === 'teacher' ? `${person.title ?? 'Mr.'} ${person.lastName}` : person.firstName;

export const fullName = (person: Acquaintance): string =>
  person.kind === 'teacher'
    ? `${person.title ?? 'Mr.'} ${person.lastName}`
    : `${person.firstName} ${person.lastName}`;

/* -------------------------------------------------------------------------- */
/* Memory                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Record something that happened between the player and this person.
 *
 * Minor memories are capped and the oldest falls off; major ones are kept
 * whatever happens (spec 771–785). Promotion follows: somebody carrying a major
 * memory is not a background person any more, so their tier moves up. A tier
 * only ever climbs — spec 674–683 requires promotion without rewriting history,
 * and demoting somebody you once mattered to would be exactly that.
 */
export function remember(person: Acquaintance, memory: SocialMemory): Acquaintance {
  const memories = [...person.memories, memory];
  const major = memories.filter((entry) => entry.major);
  const minor = memories.filter((entry) => !entry.major).slice(-MINOR_MEMORY_LIMIT);
  const kept = [...major, ...minor].sort((a, b) => a.age - b.age);

  const relationship = clampStat(person.relationship + memory.warmth) as StatValue;
  const earnedTier = memory.major ? 1 : 2;
  return {
    ...person,
    memories: kept,
    relationship,
    lastContactAge: memory.age,
    tier: Math.min(person.tier, earnedTier) as Npc['tier'],
  };
}

/** The memories worth showing on a person's page, newest first. */
export const notableMemories = (person: Acquaintance): readonly SocialMemory[] =>
  [...person.memories].reverse();

/* -------------------------------------------------------------------------- */
/* Drift                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * How much a relationship cools per year without contact.
 *
 * Friendship in childhood is mostly proximity, and this is the number that says
 * so. Without it a player accumulates friends the way they accumulate items,
 * and by seventeen has thirty of them, all at 90.
 *
 * It is SCALED by how close the two of you already are. A flat rate meant no
 * friendship made before middle school survived to seventeen — reading 120
 * childhoods found exactly zero — because leaving the same building started a
 * five-year countdown nothing could outlast.
 *
 * The curve is deliberately steep at the top. Somebody you merely sat near
 * fades in a few years, which is true; a best friend loses two points a year and
 * would take decades, which is also true. What it means in play is that a
 * friendship survives changing schools only if it was real or if the player
 * keeps it up — and keeping it up is exactly what the interaction menu is for.
 */
export const DRIFT_PER_YEAR = 7;
export const MINIMUM_DRIFT = 1;

export const driftRate = (relationship: number): number =>
  Math.max(MINIMUM_DRIFT, DRIFT_PER_YEAR * (1 - relationship / 140));

/**
 * Below this, a peer you have not spoken to in years stops being in your life.
 *
 * They are not deleted — spec 771–785 keeps reconciliation possible, and a
 * childhood you can look back on has to include the people who left it.
 */
export const DRIFT_OUT_THRESHOLD = 22;

/**
 * End somebody's presence in the player's life, and their romance with it.
 *
 * The one function that may set `endedAtAge`, and it exists because Ticket
 * 0207b broke the rule that made 0207 safe. Graduating now ends the class —
 * and it was ending the PERSON while leaving their `romance` live, so
 * `partnerOf` (which skips people who are gone) reported nobody while the
 * player was still recorded as going out with them. The invariant test caught a
 * character with two partners at once.
 *
 * A person record and a romance record that disagree about whether you are
 * seeing somebody is precisely the failure the whole 0207 design was built to
 * avoid — it is why romance is a field on a person rather than a parallel
 * model. One place to end somebody means the two can never drift apart again.
 */
export function endPerson(
  person: Acquaintance,
  age: number,
  because: NonNullable<Acquaintance['endedBecause']>,
): Acquaintance {
  if (person.endedAtAge !== undefined) return person;
  const romance = person.romance;
  return {
    ...person,
    endedAtAge: age,
    endedBecause: because,
    ...(romance && romance.endedAtAge === undefined
      ? { romance: { ...romance, endedAtAge: age, endedBecause: 'drifted' as const } }
      : {}),
  };
}

/**
 * A year passing for somebody the player did not speak to.
 *
 * Two exemptions, both load-bearing:
 *
 *  - anybody `inRoom`, because sharing a room every weekday is contact whether
 *    or not the player pressed a button about it — a classroom, a team, or
 *    since 0211a the job they hold;
 *  - teachers, because a teacher is a relationship with a school year rather
 *    than a friendship that fades — they leave when the year ends.
 */
export function driftPerson(person: Acquaintance, age: number): Acquaintance {
  if (!isCurrent(person)) return person;
  if (person.kind === 'teacher' || person.inRoom) return person;
  if (person.lastContactAge >= age) return person;

  // Year by year rather than in one step, because the rate depends on where the
  // relationship currently is — and a friendship that has already cooled cools
  // faster from there.
  let relationship: number = person.relationship;
  for (let year = person.lastContactAge; year < age; year += 1) {
    relationship = Math.max(0, relationship - driftRate(relationship));
  }
  const settled = clampStat(Math.round(relationship)) as StatValue;
  if (settled <= DRIFT_OUT_THRESHOLD) {
    return endPerson({ ...person, relationship: settled }, age, 'drifted');
  }
  return { ...person, relationship: settled };
}
