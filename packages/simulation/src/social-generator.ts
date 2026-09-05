/**
 * Ticket 0206 — the class you are actually in.
 *
 * Generates and maintains the cast of a childhood: a handful of classmates who
 * are in the year with you, and the teacher who has you this year.
 *
 * The size is the whole design decision. A real class is thirty people; this
 * keeps FIVE by name. A player cannot hold thirty relationships in their head,
 * a list of thirty rows is a spreadsheet, and the difference between a
 * childhood and a database is that a childhood has a few people in it who keep
 * turning up. The other twenty-five exist in the fiction and are never named,
 * which is exactly how most of a real class works too.
 *
 * Everything draws from `RngDomains.Relationships`, so tuning who is in the
 * class cannot shift the player's own attributes or their school results.
 */

import { createPersonality, type Personality, type Sex } from '@yearafter/character';
import { findNameCulture, type NameCulture } from '@yearafter/content';
import { asNpcId, clampStat, type StatValue } from '@yearafter/core';
import type { Household } from '@yearafter/relationships';
import {
  driftPerson,
  isFriend,
  isRomantic,
  compatibility,
  endPerson,
  leavingChance,
  romanceYear,
  type Acquaintance,
  type SocialCircle,
} from '@yearafter/social';
import type { RandomStream } from './rng/rng';

/* -------------------------------------------------------------------------- */
/* Tunable configuration                                                       */
/* -------------------------------------------------------------------------- */

/** Classmates held by name at once. See the note above on why it is small. */
export const CLASS_SIZE = 5;

/** Warmth a classmate starts at: known, unjudged, nothing either way yet. */
export const STARTING_WARMTH: readonly [number, number] = [26, 46];

/**
 * What a year in the same room is worth, before who the two of you are.
 *
 * Reading 120 childhoods without this found that 99% of them ended with NO
 * friends at all: classmates start in the twenties and thirties, events add one
 * or two points when they bind at all, and nothing ever reached the friendship
 * line at 50. A childhood with no friends in it is not a hard childhood, it is
 * a broken system — the same failure as behaviour pinned at 96 and workload
 * that never once engaged.
 *
 * Proximity is most of childhood friendship, so proximity is what this models.
 * It is deliberately UNEVEN: the multiplier runs from about a third to about
 * twice, so out of five classmates one or two become real and the rest stay
 * people you sat near for six years, which is the true ratio.
 */
export const PROXIMITY_WARMTH = 4;

/**
 * How many people an adult holds by name at once.
 *
 * Ticket 0207b. Deliberately SMALLER than a class, and that is the honest
 * model rather than a budget: school hands you thirty people a year whether you
 * want them or not, and adult life does not. Four is enough that the circle is
 * not empty and few enough that it reads as a life rather than a directory.
 */
export const ADULT_CIRCLE = 4;

/**
 * The chance an adult meets somebody new in a year with nothing else going on.
 *
 * Scaled by extraversion and charisma below, so a sociable character genuinely
 * meets more people and a solitary one can go years without. Measured across
 * simulated lives before it was set: at 0.55, the median adult circle sat at
 * three or four and about one life in eight spent a stretch with nobody, which
 * is the spread this wants.
 */
export const ADULT_MEETING_CHANCE = 0.55;

/** Somebody you have just met, and have no history with. */
export const ADULT_WARMTH: readonly [number, number] = [18, 38];

/**
 * The yearly chance an adult acquaintance you never got anywhere with moves on.
 *
 * Neighbours count as contact (see the drift step), which stops them
 * evaporating — and with nothing else, stopped them ever leaving: measuring
 * found the circle filling at nineteen and then locking, so at thirty-five the
 * earliest person a character knew had been met at 18.9, every time. A frozen
 * cast formed at nineteen instead of seventeen is still a frozen cast.
 *
 * So people move, and jobs and leases end. Only people you never got anywhere
 * with: somebody who became a friend has something holding them, which is what
 * being a friend means. At 0.22 a non-friend lasts about four years, which
 * leaves room for the ones who last thirty.
 */
export const ADULT_MOVES_ON = 0.22;

/**
 * Teammates who arrive with a team.
 *
 * Review: "…and interact with peers." Joining something should put you next to
 * people, because that is what joining something does. Two per activity: enough
 * that a team has faces in it, few enough that signing up for five clubs does
 * not hand the player a list of thirty names.
 *
 * They arrive warmer than a classmate — you chose to be in the same room as
 * these ones — and their `context` is 'activity', which until now was a field
 * nothing ever set.
 */
export const TEAMMATES_PER_ACTIVITY = 2;
export const TEAMMATE_WARMTH: readonly [number, number] = [34, 52];

/** A teacher starts a shade warmer — they are paid to be on your side. */
export const TEACHER_WARMTH: readonly [number, number] = [40, 60];

/**
 * Chance a teacher you got on with keeps you the following year.
 *
 * Small, because it should feel like luck rather than a mechanic. It is the
 * only way a teacher lasts more than a year, which is what makes the ones who
 * do worth something.
 */
export const TEACHER_STAYS = 0.28;
export const TEACHER_STAYS_THRESHOLD = 68;

/**
 * Warmth below which somebody drifting out is not worth a line.
 *
 * The feed is for things that happened. Losing touch with a person you never
 * spoke to did not happen — it is the absence of anything happening, and it
 * still costs the player a line to read past.
 */
export const NOTABLE_LOSS = 38;

/** What the teacher this year teaches. Flavour, and a reason to remember them. */
export const SUBJECTS: readonly string[] = [
  'English',
  'Maths',
  'Science',
  'History',
  'Geography',
  'Art',
  'Music',
  'PE',
  'Woodwork',
  'Spanish',
];

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

interface NameContext {
  readonly culture: NameCulture | undefined;
  readonly taken: Set<string>;
}

export function nameContext(
  cultureId: string,
  circle: SocialCircle,
  family: Household,
  self: string,
) {
  const taken = new Set<string>([
    self,
    ...family.members.map((member) => member.firstName),
    ...circle.people.map((person) => person.firstName),
  ]);
  return { culture: findNameCulture(cultureId), taken };
}

/**
 * A first name nobody in the player's life is already using.
 *
 * The same rule the family generator follows, for the same reason: "Fell out
 * with Sebastián" when the player IS Sebastián reads as a bug even though it is
 * a legitimate draw. Extended here to the class, because two Wrens in one year
 * is realistic and unreadable.
 */
function uniqueFirstName(stream: RandomStream, names: NameContext, sex: Sex): string {
  if (!names.culture) return sex === 'male' ? 'Alex' : 'Sam';
  const pool = sex === 'male' ? names.culture.male : names.culture.female;
  let candidate = stream.pick(pool);
  for (let attempt = 0; attempt < 8 && names.taken.has(candidate); attempt += 1) {
    candidate = stream.pick(pool);
  }
  names.taken.add(candidate);
  return candidate;
}

function surnameFor(stream: RandomStream, names: NameContext): string {
  if (!names.culture) return 'Alvarez';
  return stream.pick(names.culture.surnames);
}

/**
 * An ordinary person of the player's own age, with a name nobody in their life
 * already has.
 *
 * Shared by the class, by teams, by the neighbours an adult meets and by the
 * dating app, so that everybody in the game is drawn from one distribution. A
 * separate generator for app matches would have been the obvious place for a
 * pool of implausibly compatible people to appear by accident.
 */
export function newPersonLike(
  stream: RandomStream,
  names: NameContext,
  age: number,
  birthYear: number,
  index: number,
): Acquaintance {
  return newClassmate(stream, names, age, birthYear, index);
}

function newClassmate(
  stream: RandomStream,
  names: NameContext,
  age: number,
  birthYear: number,
  index: number,
): Acquaintance {
  const sex: Sex = stream.chance(0.5) ? 'male' : 'female';
  return {
    id: asNpcId(`npc:peer:${birthYear}:${index}`),
    firstName: uniqueFirstName(stream, names, sex),
    lastName: surnameFor(stream, names),
    sex,
    birthYear,
    alive: true,
    // Tier 3 until they matter. `remember` promotes them, and never demotes.
    tier: 3,
    personality: {
      ambition: stream.range(10, 90),
      riskTolerance: stream.range(10, 90),
      temper: stream.range(10, 90),
      generosity: stream.range(10, 90),
      loyalty: stream.range(10, 90),
      extraversion: stream.range(10, 90),
    },
    relationship: clampStat(stream.range(STARTING_WARMTH[0], STARTING_WARMTH[1])) as StatValue,
    kind: 'peer',
    context: 'school',
    metAtAge: age,
    lastContactAge: age,
    memories: [],
    inClass: true,
  };
}

function newTeacher(
  stream: RandomStream,
  names: NameContext,
  age: number,
  worldYear: number,
): Acquaintance {
  const sex: Sex = stream.chance(0.5) ? 'male' : 'female';
  const surname = surnameFor(stream, names);
  return {
    id: asNpcId(`npc:teacher:${worldYear}`),
    firstName: uniqueFirstName(stream, names, sex),
    lastName: surname,
    sex,
    birthYear: worldYear - stream.range(26, 58),
    alive: true,
    tier: 3,
    personality: createPersonality({
      generosity: stream.range(30, 90),
      temper: stream.range(10, 80),
    }),
    relationship: clampStat(stream.range(TEACHER_WARMTH[0], TEACHER_WARMTH[1])) as StatValue,
    kind: 'teacher',
    context: 'school',
    metAtAge: age,
    lastContactAge: age,
    memories: [],
    inClass: true,
    subject: stream.pick(SUBJECTS),
    // The title a child uses, chosen here so it can never disagree with the
    // one the event text renders for {adult}.
    title: sex === 'female' ? 'Mrs.' : 'Mr.',
  };
}

/**
 * What another year beside this particular person is worth.
 *
 * Their extraversion decides how much of themselves they put into it, their
 * loyalty how much of it sticks, and the player's charisma how easy they are to
 * spend a year next to. The spread matters more than the mean: five classmates
 * gaining the same amount every year produces five identical friendships, which
 * is the failure mode on the other side of nobody having any.
 */
export function proximityWarmth(person: Acquaintance, charisma: number): number {
  const openness = (person.personality.extraversion - 50) / 50; // -1 .. 1
  const loyalty = (person.personality.loyalty - 50) / 50;
  const ease = (charisma - 50) / 50;
  const scale = 1 + openness * 0.45 + loyalty * 0.3 + ease * 0.35;
  const clamped = scale < 0.3 ? 0.3 : scale > 2 ? 2 : scale;
  return Math.round(PROXIMITY_WARMTH * clamped);
}

/* -------------------------------------------------------------------------- */
/* The school year                                                             */
/* -------------------------------------------------------------------------- */

/**
 * People who joined the same thing you did.
 *
 * Called when the player joins an activity rather than once a year, so the
 * faces appear the moment they sign up rather than the following September.
 */
export function teammatesFor(
  circle: SocialCircle,
  stream: RandomStream,
  input: {
    readonly activityId: string;
    readonly activityName: string;
    readonly age: number;
    readonly worldYear: number;
    readonly nameCultureId: string;
    readonly firstName: string;
    readonly family: Household;
  },
): readonly Acquaintance[] {
  const names = nameContext(input.nameCultureId, circle, input.family, input.firstName);
  const made: Acquaintance[] = [];
  for (let index = 0; index < TEAMMATES_PER_ACTIVITY; index += 1) {
    const person = newClassmate(
      stream,
      names,
      input.age,
      input.worldYear - input.age,
      circle.people.length + index,
    );
    made.push({
      ...person,
      id: asNpcId(`npc:team:${input.activityId}:${input.worldYear}:${index}`),
      context: 'activity',
      viaActivityId: input.activityId,
      relationship: clampStat(stream.range(TEAMMATE_WARMTH[0], TEAMMATE_WARMTH[1])) as StatValue,
      // NOT in the class — they are in the club. Which means the friendship has
      // to be kept up, exactly like one that survived a change of school.
      inClass: false,
      lastContactAge: input.age,
    });
  }
  return made;
}

/**
 * A year of adult life, socially.
 *
 * At most one new person a year, and often none. That is not a throttle to keep
 * the list short — it is what the thing being modelled is like, and a system
 * that handed an adult five new names every September would be modelling school
 * with the word "work" written on it.
 */
function meetSomebodyNew(
  people: Acquaintance[],
  circle: SocialCircle,
  stream: RandomStream,
  input: SocialYearInput,
  lines: string[],
): Acquaintance[] {
  const around = people.filter(
    (person) => person.kind === 'peer' && person.endedAtAge === undefined,
  );
  if (around.length >= ADULT_CIRCLE) return people;

  // Some people meet people. The stat that says so is the one that has said so
  // since 0201, and a stat with no consumer is decoration.
  const openness = (input.charisma - 50) / 50 + (input.personality.extraversion - 50) / 50;
  const chance = ADULT_MEETING_CHANCE * (1 + openness * 0.45);
  if (!stream.chance(Math.max(0.08, Math.min(0.92, chance)))) return people;

  const names = nameContext(input.nameCultureId, { ...circle, people }, input.family, input.firstName);
  // Somebody you are still doing something with brings people; otherwise it is
  // wherever you live. Work will be a third of these when 0210 lands.
  const viaActivity = input.joinedActivityIds.length > 0 && stream.chance(0.45);
  const activityId = viaActivity ? stream.pick([...input.joinedActivityIds]) : undefined;

  const person = newClassmate(stream, names, input.age, input.worldYear - input.age, people.length);
  const met: Acquaintance = {
    ...person,
    id: asNpcId(`npc:met:${input.worldYear}:${people.length}`),
    context: activityId !== undefined ? 'activity' : 'neighbourhood',
    ...(activityId !== undefined ? { viaActivityId: activityId } : {}),
    relationship: clampStat(stream.range(ADULT_WARMTH[0], ADULT_WARMTH[1])) as StatValue,
    // Never `inClass` — there is no class. An adult friendship has to be kept
    // up from the first day, which is the whole difference from a school one.
    inClass: false,
    lastContactAge: input.age,
  };

  lines.push(
    activityId !== undefined
      ? `Met ${met.firstName} through something you do. You have got as far as first names.`
      : `Met ${met.firstName}, who lives close enough to keep running into.`,
  );
  return [...people, met];
}

export interface SocialYearInput {
  readonly age: number;
  /** The player's charisma. Some people are easier to be around. */
  readonly charisma: number;
  /** The player's own temperament, for whether a relationship is working. */
  readonly personality: Personality;
  /** Activities the character is still in, so teammates count as contact. */
  readonly joinedActivityIds: readonly string[];
  readonly worldYear: number;
  readonly nameCultureId: string;
  readonly firstName: string;
  readonly family: Household;
  /** Whether the character is at school this year. */
  readonly atSchool: boolean;
  /**
   * True on the year the class turns over: changing school, or leaving it.
   *
   * Ticket 0207b. Leaving used to be missing, and the omission was structural
   * rather than cosmetic. `changedSchool` was computed as
   * `atSchool && stage !== previousStage`, so the year a character graduated it
   * was FALSE — nobody's `inClass` was ever cleared, and `driftPerson` exempts
   * anybody `inClass`. Measuring found the same five high-school classmates
   * still in the circle, still not drifting, at thirty-five: a mean of 4.9
   * available people at every adult age, all of them seventeen years stale.
   * Nobody in this game could meet a person after leaving school, and every
   * marriage was to somebody the character sat next to at sixteen.
   */
  readonly changedSchool: boolean;
  /**
   * Whether the character has finished with school for good.
   *
   * Distinct from `!atSchool`, which is also true of a four-year-old. This is
   * what turns on the adult ways of meeting people.
   */
  readonly leftSchool: boolean;
}

export interface SocialYearResult {
  readonly circle: SocialCircle;
  readonly lines: readonly string[];
}

/**
 * Move the cast on by a year.
 *
 * Order matters and is deliberate: people who left LEAVE first, then the year's
 * drift is applied, then vacancies are filled. Doing it the other way round
 * fills a seat and then immediately empties it.
 */
export function runSocialYear(
  circle: SocialCircle,
  stream: RandomStream,
  input: SocialYearInput,
): SocialYearResult {
  const lines: string[] = [];
  let people = [...circle.people];

  // ---- changing school ----------------------------------------------------
  // Friends come with you. Everybody else is somebody you used to sit near.
  if (input.changedSchool) {
    people = people.map((person) => {
      // Teachers have their own ending, below. Somebody already gone stays gone.
      if (person.kind === 'teacher' || person.endedAtAge !== undefined) return person;
      // A friendship survives a change of building — but it leaves the class,
      // and from here it has to hold up on its own. That is the moment a
      // childhood friendship is actually decided.
      //
      // So does somebody you are going out with, obviously. 0207b found that
      // omission the hard way: leaving school was ending the person while
      // leaving the romance live, and the player picked up a second partner.
      if (isFriend(person) || isRomantic(person)) return { ...person, inClass: false };
      return endPerson({ ...person, inClass: false }, input.age, 'moved on');
    });
  }

  // ---- the teacher's year ends -------------------------------------------
  people = people.map((person) => {
    if (person.kind !== 'teacher' || person.endedAtAge !== undefined) return person;
    const keeps =
      input.atSchool &&
      person.relationship >= TEACHER_STAYS_THRESHOLD &&
      stream.chance(TEACHER_STAYS);
    if (keeps) return person;
    return endPerson({ ...person, inClass: false }, input.age, 'moved on');
  });

  // ---- another year in the same room --------------------------------------
  // Contact, without the player having to do anything (see `driftPerson`), and
  // a little warmth with it: this is how a class of strangers turns into one or
  // two friends over six years.
  const stillIn = new Set(input.joinedActivityIds);
  people = people.map((person) => {
    if (person.endedAtAge !== undefined) return person;
    // THREE rooms count: the class, a team you are still on, and the street you
    // live on. A teammate you see at training every week is not somebody you
    // are losing touch with, and neither is the neighbour you keep running
    // into.
    //
    // The third one is Ticket 0207b, and it was found by measuring rather than
    // reasoned out. Adult acquaintances arrive around 28 warmth; drift at that
    // level costs 5.6 a year and the drift-out floor is 22, so every single one
    // evaporated within a year of being met. The measurement was stark: at
    // thirty, the earliest person a character knew had been met at 29.7. An
    // adult social world with total annual churn is the same failure as a class
    // that turns over every September, in a different room.
    const together =
      person.inClass ||
      (person.viaActivityId !== undefined && stillIn.has(person.viaActivityId)) ||
      (person.context === 'neighbourhood' && person.kind === 'peer');
    if (!together) return person;
    const gain = person.kind === 'teacher' ? 0 : proximityWarmth(person, input.charisma);
    return {
      ...person,
      lastContactAge: input.age,
      relationship: clampStat(person.relationship + gain) as StatValue,
    };
  });

  // ---- a year of being with somebody --------------------------------------
  //
  // Runs BEFORE the drift step and marks contact, because being with somebody
  // is contact: a partner who has left school would otherwise be handled by
  // `driftPerson` as though the player had stopped speaking to them, and the
  // relationship the player is actually in would quietly fade.
  //
  // What happens here is the compatibility they cannot see doing its work. A
  // couple who suit each other warm; a couple who do not cool, and once things
  // are bad enough the other person gets a say in whether it continues.
  people = people.map((person) => {
    if (!isRomantic(person) || person.endedAtAge !== undefined) return person;
    const warmed = romanceYear(person, input.personality);
    const stayed: Acquaintance = { ...person, relationship: warmed, lastContactAge: input.age };

    // Compatibility as well as warmth: somebody badly matched to you can leave
    // a relationship you have been working at. See `leavingChance`.
    const suited = compatibility(input.personality, person.personality);
    if (!stream.chance(leavingChance(warmed, suited, input.age))) return stayed;

    const stage = person.romance?.stage ?? 'seeing';
    lines.push(
      stage === 'married'
        ? `${person.firstName} left. It had been coming for a while and it still arrived all at once.`
        : `${person.firstName} ended it. You had known and you had not known.`,
    );
    return {
      ...stayed,
      romance: {
        stage,
        since: person.romance?.since ?? input.age,
        endedAtAge: input.age,
        endedBecause: stage === 'married' ? ('divorced' as const) : ('they ended it' as const),
      },
    };
  });

  // ---- a year of not seeing somebody --------------------------------------
  //
  // At most ONE line about this per year, and only about somebody the player
  // had actually got somewhere with. Losing an acquaintance you never spoke to
  // is not news, and reading output found the feed carrying four of these in a
  // year the character had done nothing at all.
  let driftLine = false;
  people = people.map((person) => {
    const wasHere = person.endedAtAge === undefined;
    const mattered = person.relationship >= NOTABLE_LOSS;
    const after = driftPerson(person, input.age);
    if (wasHere && after.endedAtAge !== undefined && mattered && !driftLine) {
      driftLine = true;
      lines.push(
        `${after.firstName} stopped being somebody you saw. Nothing happened; it just went.`,
      );
    }
    return after;
  });

  // ---- people move --------------------------------------------------------
  //
  // Only ever ONE line about this a year, and only about somebody the player
  // had got somewhere with — the same rule the drift step follows, for the same
  // reason: losing an acquaintance you never spoke to is not news.
  if (input.leftSchool) {
    let movedLine = false;
    people = people.map((person) => {
      if (person.endedAtAge !== undefined || person.kind !== 'peer') return person;
      if (person.context !== 'neighbourhood') return person;
      if (isFriend(person) || isRomantic(person)) return person;
      if (!stream.chance(ADULT_MOVES_ON)) return person;
      if (person.relationship >= NOTABLE_LOSS && !movedLine) {
        movedLine = true;
        lines.push(`${person.firstName} moved. You said you would keep in touch and did not.`);
      }
      return endPerson(person, input.age, 'moved away');
    });
  }

  // ---- an adult year -----------------------------------------------------
  //
  // Not the same shape as a school year and deliberately so. Nobody puts you in
  // a room with thirty peers after seventeen; you meet people through where you
  // live and what you do, a few at a time, and whether it happens at all
  // depends on what you are like. That asymmetry IS the model.
  if (!input.atSchool) {
    if (input.leftSchool) {
      people = meetSomebodyNew(people, circle, stream, input, lines);
    }
    return { circle: { ...circle, people }, lines };
  }

  // ---- fill the empty seats ----------------------------------------------
  const names = nameContext(
    input.nameCultureId,
    { ...circle, people },
    input.family,
    input.firstName,
  );
  const current = people.filter(
    (person) => person.kind === 'peer' && person.endedAtAge === undefined,
  );
  let index = people.length;
  for (let seat = current.length; seat < CLASS_SIZE; seat += 1) {
    const person = newClassmate(stream, names, input.age, input.worldYear - input.age, index);
    index += 1;
    people.push(person);
  }
  // Deliberately silent. Filling the class writes NOTHING to the feed: the year
  // a character changes school already carries "Started middle school", and
  // reading output with an arrival line as well pushed the worst year to nine
  // entries against a cap of seven (spec 725-770). New classmates show up on
  // the People screen, which is where a list of names belongs.

  const staying = people.find(
    (person) => person.kind === 'teacher' && person.endedAtAge === undefined,
  );
  if (staying) {
    // A teacher keeping you a second year is unusual enough to be worth saying.
    // A NEW teacher every September is not: thirteen of those is thirteen lines
    // the player learns to scroll past, and spec 725–770 caps a year at a
    // handful of entries.
    if (staying.lastContactAge < input.age) {
      lines.push(`${staying.title} ${staying.lastName} had you again this year, which was luck.`);
    }
  } else {
    people.push(newTeacher(stream, names, input.age, input.worldYear));
  }

  return { circle: { ...circle, people }, lines };
}
