/**
 * Ticket 0212 — the kin phase. Everybody else gets a year older, and some of
 * them do not get another one.
 *
 * EIGHTH phase module, and the FIRST in the order, which is the one interesting
 * decision in this file.
 *
 * Every other phase was appended to the end of the chain because it depended on
 * what came before it. This one is prepended, because it is the only phase that
 * changes WHO EXISTS. Run it last and a character who died in January would
 * still have gone to the office party, still have been available to flirt with,
 * still have been named by an event, and would then quietly stop existing at
 * the bottom of the same year's feed. Run it first and the whole year happens
 * in a world that is already correct.
 *
 * WHY IT EXISTS AT ALL
 *
 * The measurement that opened 0212: across 400 played lives the player died at
 * a median of seventy-three and the median SURVIVING PARENT was a hundred and
 * five. Nothing in eleven tickets had ever written `alive: false` to anybody.
 * The stress model had been reading that field since 0205 — this is 0210's
 * `droppedOut` for the third time, a field read in one place and written in
 * none, and it is the reason CORE_RULES 13.36 now exists.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not give an NPC a condition list, a doctor, or a year of simulated
 * illness. `@yearafter/health`'s `npcDeathChance` explains why in full: a
 * per-person condition list for a partner, five classmates, two parents, three
 * siblings and three colleagues is a save that grows forever to print one word.
 * The morbidity term stands in for it and is labelled as an approximation.
 */

import type { NewLifeRecord, TimelineKind } from '@yearafter/character';
import { ALL_JOBS } from '@yearafter/careers';
import { npcCauseOf, npcDeathChance } from '@yearafter/health';
import {
  NEW_OFFSPRING_LIFE,
  SCHOOL_STARTS,
  runOffspringYear,
  type JobSketch,
  type OffspringLife,
} from '@yearafter/parenting';
import { type FamilyMember, type Household } from '@yearafter/relationships';
import { endPerson, type Acquaintance, type SocialCircle } from '@yearafter/social';
import { stablePick, stableUnit, type RandomStream } from '../rng/rng';

/**
 * How many deaths a year the feed will report.
 *
 * One. A character in their eighties can plausibly lose two or three people in
 * a year, and a feed that prints all of them turns the last decade of every
 * life into a casualty list — which is both grim and, worse, flattening: the
 * third notice in one year reads like the first. The others still HAPPEN; they
 * are simply not all narrated, exactly as an ordinary year with a small child
 * writes nothing (spec 1986).
 *
 * Who gets the line is not a draw. It is the closest person, because that is
 * the one the player would actually have heard about.
 */
export const DEATHS_REPORTED_PER_YEAR = 1;

/**
 * The player's own parents and partner are never silently dropped.
 *
 * A parent dying is the largest thing that can happen in a childhood and the
 * stress model has had a term for it since 0205. Losing a partner of forty
 * years is not a line to be crowded out by a colleague. So these two always get
 * their notice even if the budget above has already been spent.
 */
const ALWAYS_REPORTED: ReadonlySet<string> = new Set(['mother', 'father']);

/** A body, from an id. Stable for life, costs no RNG, never stored. */
export const constitutionOf = (id: string): number => stableUnit(`constitution:${id}`);

export interface KinPhaseInput {
  readonly family: Household;
  readonly circle: SocialCircle;
  readonly stream: RandomStream;
  /** The player's age this year — what a timeline line is stamped with. */
  readonly age: number;
  readonly worldYear: number;
  /** Draws a given name, for a partner a child brings home. */
  readonly nameFor: (seed: number) => string;
}

export interface KinDeath {
  readonly id: string;
  readonly name: string;
  readonly age: number;
  readonly cause: string;
  /** 'mother', 'sister', 'your partner', 'a friend' — how the line names them. */
  readonly relation: string;
  /** How close they were, 0–100. Decides who gets the year's one line. */
  readonly closeness: number;
  /** How long the player had them, in years. Some lines say it. */
  readonly knownYears: number;
}

export interface KinPhaseOutput {
  readonly family: Household;
  readonly circle: SocialCircle;
  readonly lines: readonly { readonly kind: TimelineKind; readonly text: string }[];
  /** Ticket 0212. Structured history, for the death screen. */
  readonly records: readonly NewLifeRecord[];
  /** Everybody who died this year, reported or not — the caller may need them. */
  readonly deaths: readonly KinDeath[];
}

const RELATION_WORD: Readonly<Record<string, string>> = {
  mother: 'Mom',
  father: 'Dad',
  sibling: 'your sibling',
  child: 'your child',
};

const relationOf = (member: FamilyMember): string =>
  RELATION_WORD[member.role] ?? `your ${member.role}`;

export function runKin(input: KinPhaseInput): KinPhaseOutput {
  const deaths: KinDeath[] = [];

  const members = input.family.members.map((member) => {
    if (!member.alive) return member;
    const theirAge = input.worldYear - member.birthYear;
    // A child's own life runs BEFORE their mortality roll, so the year they die
    // is still a year they lived — the same reason the player's health phase
    // runs last and still writes a complete year (0211).
    const withLife = member.role === 'child' ? liveAYear(member, theirAge, input) : member;
    member = withLife;
    if (!input.stream.chance(npcDeathChance(constitutionOf(member.id), theirAge))) return member;
    deaths.push({
      id: member.id,
      name: member.firstName,
      age: theirAge,
      cause: npcCauseOf(theirAge, member.id),
      relation: relationOf(member),
      // Family is closer than anybody in the circle at the same number, and a
      // parent or a child is closer than a cousin. Without this a colleague of
      // sixty warmth would take the year's one line from a mother of fifty-five.
      closeness: member.relationship + (ALWAYS_REPORTED.has(member.role) ? 200 : 100),
      // Family has been there since the player was born, or since the child
      // arrived. Either way it is the smaller of the two lives.
      knownYears: Math.min(input.age, theirAge),
    });
    return { ...member, alive: false, diedWhenPlayerWas: input.age };
  });

  const people = input.circle.people.map((person) => {
    if (!person.alive || person.endedAtAge !== undefined) return person;
    const theirAge = input.worldYear - person.birthYear;
    if (!input.stream.chance(npcDeathChance(constitutionOf(person.id), theirAge))) return person;
    const partner = person.romance !== undefined && person.romance.endedAtAge === undefined;
    deaths.push({
      id: person.id,
      name: person.firstName,
      age: theirAge,
      cause: npcCauseOf(theirAge, person.id),
      relation: partner ? 'your partner' : person.kind === 'teacher' ? 'your teacher' : 'a friend',
      closeness: person.relationship + (partner ? 200 : 0),
      knownYears: Math.max(1, input.age - person.metAtAge),
    });
    /*
      CORE_RULES 13.19: `endPerson` is the only function that may set
      `endedAtAge`, and it closes the romance too. Dying is a way of leaving
      somebody's life, so it goes through the same door rather than around it —
      which is also how a widow's Love screen stops saying "it drifted".
    */
    return { ...endPerson(person, input.age, 'died'), alive: false };
  });

  const ranked = [...deaths].sort((a, b) => b.closeness - a.closeness);
  const reported = ranked.filter(
    (death, index) => index < DEATHS_REPORTED_PER_YEAR || death.closeness >= 200,
  );

  return {
    family: { ...input.family, members },
    circle: { ...input.circle, people },
    lines: reported.map((death) => ({
      kind: 'relationship' as TimelineKind,
      text: lineFor(death),
    })),
    /*
      Only the three that a life is actually remembered by. A colleague dying is
      a line in the feed and not a highlight of somebody else's life, and a
      records list that logged every death would make the death screen — which
      spec 1284 caps at five highlights — a list of funerals.
    */
    records: deaths
      .filter(
        (death) =>
          death.relation === 'Mom' ||
          death.relation === 'Dad' ||
          death.relation === 'your partner' ||
          death.relation === 'your child',
      )
      .map((death) => ({
        // Ticket 0409. Was 'family'; see `LifeRecordCategory`. A save written
        // before 0409 keeps its old records, so bereavement events simply do
        // not fire for a death that happened in a previous build — which is
        // the right failure: it is silent and it corrects itself.
        category: 'loss' as const,
        label:
          death.relation === 'your partner'
            ? `Lost ${death.name}`
            : death.relation === 'your child'
              ? `Lost ${death.name}, who was ${death.age}`
              : `Lost ${death.relation}`,
        referenceId: death.id,
      })),
    deaths,
  };
}

/**
 * What the player reads.
 *
 * Held to writing rules 10 and 11: it names the person, says their age, and
 * does not characterise the loss. "A part of your life closed" is the exact
 * register 0211b removed from the rest of the game, and a death notice is the
 * single easiest place in a life sim to write one by accident.
 *
 * FOUR SETS, not one template. The first version of this file had one sentence
 * per relation and reading a played life showed the same shape five and six
 * times in one character's sixties — CORE_RULES 13.17, which this build has now
 * found eight separate times, always the same way: by reading output. The index
 * is the dead person's own id, so their notice is the same on every load and no
 * stream is shifted by asking.
 *
 * A partner and a child get their own sets and their own registers. Somebody
 * who was in your life for fifty years does not get the sentence a colleague
 * gets, and the line for a child is deliberately the one line in the game that
 * declines to give a cause.
 */
const PARENT_LINES: readonly string[] = [
  '{relation} died, of {cause}. {name} was {age}.',
  '{relation} died at {age}. It was {cause}.',
  'You lost {relation} this year — {cause}, at {age}.',
  '{relation} died of {cause}, at {age}. You had {name} for {known} years.',
];

const PARTNER_LINES: readonly string[] = [
  '{name} died at {age}, of {cause}. You had {known} years.',
  '{name} died this year. {cause}, at {age}, after {known} years together.',
  'You lost {name} at {age} — {cause}.',
  '{name} died of {cause} at {age}. The house got very quiet.',
];

/*
  The hardest copy in the game, and the answer turned out to be to stop writing.

  The first version of this set reached for a sentence about the loss — "nothing
  about it was survivable and you survived it" — which is precisely the register
  0211b spent a whole ticket removing from everywhere else, and writing rule 10
  in its purest form: a line that characterises instead of reporting. It is also
  the one place in the game where a flourish would read as the author helping
  themselves to somebody else's worst year.

  So these say what happened and stop. The validator caught the draft, which is
  the first time V16 has fired on copy written after the rule existed.
*/
const CHILD_LINES: readonly string[] = [
  '{name} died at {age}.',
  'You buried {name}, who was {age}.',
  '{name} died this year, at {age}.',
];

const OTHER_LINES: readonly string[] = [
  '{name} died at {age}, of {cause}.',
  '{name} died this year — {cause}, at {age}.',
  'You heard {name} had died. {age}, of {cause}.',
  '{name} died at {age}. You had known {name} {known} years.',
];

export function lineFor(death: KinDeath): string {
  const set =
    death.relation === 'Mom' || death.relation === 'Dad'
      ? PARENT_LINES
      : death.relation === 'your partner'
        ? PARTNER_LINES
        : death.relation === 'your child'
          ? CHILD_LINES
          : OTHER_LINES;
  const template = stablePick(set, `death-line:${death.id}`) ?? (set[0] as string);
  return template
    .replace(/\{relation\}/g, death.relation)
    .replace(/\{name\}/g, death.name)
    .replace(/\{age\}/g, String(death.age))
    .replace(/\{cause\}/g, death.cause)
    .replace(/\{known\}/g, String(Math.max(1, death.knownYears)));
}

/**
 * A year of a child's own life.
 *
 * The reduced model lives in `@yearafter/parenting`; this is the wiring. Four
 * draws a year, taken up front whether or not anything happens, for the same
 * reason 0211's health phase takes a fixed block: a quiet year must leave the
 * stream exactly where a busy one does, or the year a child gets promoted
 * shifts every draw in every other system for the rest of the life.
 *
 * Skipped entirely for a child under five and one who has died, which is most
 * of the calls — a household of four children costs sixteen draws a year.
 */
function liveAYear(member: FamilyMember, theirAge: number, input: KinPhaseInput): FamilyMember {
  if (theirAge < SCHOOL_STARTS) return member;
  const rolls = [
    input.stream.next(),
    input.stream.next(),
    input.stream.next(),
    input.stream.next(),
  ];
  const life = (member.life as OffspringLife | undefined) ?? NEW_OFFSPRING_LIFE;
  const next = runOffspringYear(life, {
    age: theirAge,
    year: input.worldYear,
    personality: member.personality,
    rolls,
    jobFor: (track, rung, seed) => sketchJob(track, rung, seed),
    nameFor: input.nameFor,
  });
  return next === life ? member : { ...member, life: next };
}

/**
 * A job for somebody whose career nobody is playing.
 *
 * Draws from the same catalog the player applies to — 49 jobs across eleven
 * ladders — so a child is a line cook or a charge nurse rather than a made-up
 * title. Rung is honoured where the ladder has one, and falls back to the top
 * of that ladder when it does not: a track with three rungs cannot promote
 * somebody to a fourth, and inventing one would put a title in the game that
 * the catalog has never heard of.
 */
function sketchJob(track: string | undefined, rung: number, seed: number): JobSketch | undefined {
  if (track === undefined) {
    const entry = ALL_JOBS.filter((job) => job.rung === 0);
    const pick = entry[Math.floor(seed * entry.length) % Math.max(1, entry.length)];
    return pick ? { title: pick.title, track: String(pick.track), rung: 0 } : undefined;
  }
  const ladder = ALL_JOBS.filter((job) => String(job.track) === track).sort(
    (left, right) => left.rung - right.rung,
  );
  const pick = ladder.find((job) => job.rung === rung) ?? ladder[ladder.length - 1];
  return pick ? { title: pick.title, track, rung: pick.rung } : undefined;
}

/** Everyone the player is related to who is still alive. For the death screen. */
export const survivingKin = (family: Household): readonly FamilyMember[] =>
  family.members.filter((member) => member.alive);

/** The partner, if they are still alive and still together. For the death screen. */
export const survivingPartner = (circle: SocialCircle): Acquaintance | undefined =>
  circle.people.find(
    (person) =>
      person.alive &&
      person.endedAtAge === undefined &&
      person.romance !== undefined &&
      person.romance.endedAtAge === undefined &&
      person.romance.stage !== 'interested',
  );
