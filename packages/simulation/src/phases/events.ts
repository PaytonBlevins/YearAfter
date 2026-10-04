/**
 * Ticket 0203 — the event phase.
 *
 * `advance.ts` says it plainly: systems attach as phase modules, not as inline
 * logic. This is the first of them, and it sets the shape the others follow —
 * take a state, return what changed, touch nothing else.
 *
 * The engine itself lives in @yearafter/events and knows nothing about
 * `GameState`. This file is the translation layer: it builds the read-only
 * context the engine wants, hands over the Events stream, and folds the results
 * back into character and household state.
 */

import type { Character, TimelineKind } from '@yearafter/character';
import { findJob } from '@yearafter/careers';
import { describeCity } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import type { NewTransaction } from '@yearafter/finance';
import {
  applyEffects,
  runEventPhase,
  type EventContext,
  type EventHistory,
  type EventOutcome,
  type PendingDecision,
  type ReportedCash,
} from '@yearafter/events';
import { livingChildren, type Household } from '@yearafter/relationships';
import {
  displayName,
  isCurrent,
  isFriend,
  partnerOf,
  remember,
  type Acquaintance,
  type SocialCircle,
} from '@yearafter/social';
import type { GameState } from '../game-state';
import { RngDomains } from '../rng/rng';

export interface EventPhaseOutput {
  readonly player: Character;
  readonly family: Household;
  readonly history: EventHistory;
  /** School standing after events. Folded back into education state (0204). */
  readonly behaviour: number;
  /** Stress points this year's events contributed. Read by the stress phase. */
  readonly stress: number;
  /**
   * The circle after the year's events (Ticket 0206).
   *
   * An event that named a real classmate leaves a memory on them. That is what
   * makes "You covered for Wren" a thing between two people rather than a line
   * of text — a year later Wren's page still says it, and the relationship is
   * where the event left it.
   */
  readonly circle: SocialCircle;
  /** Feed lines for this year, in order. */
  readonly lines: readonly {
    readonly kind: TimelineKind;
    readonly text: string;
    readonly eventId: string;
  }[];
  readonly decisions: readonly PendingDecision[];
  /**
   * Ticket 0301. What the year's events wanted to move, for `advanceYear`.
   *
   * The catalog has authored `{ delta, source }` for every cash effect since
   * 0203b, because CORE_RULES 13.6 says money names where it came from. Until
   * this ticket the source was written into the feed line and then thrown away.
   */
  readonly transactions: readonly NewTransaction[];
}

/**
 * The context an event may read.
 *
 * `age` and `year` are passed in rather than read from `state`, because the
 * phase runs against the year being entered, not the one being left.
 */
export function buildEventContext(
  state: GameState,
  age: number,
  year: number,
  history: EventHistory,
  linesSoFar = 0,
): EventContext {
  const friends = friendsOf(state);
  return {
    age,
    year,
    firstName: state.player.firstName,
    lastName: state.player.lastName,
    sex: state.player.sex,
    stats: state.player.stats,
    talents: state.player.talents,
    personality: state.player.personality,
    family: state.family,
    nameCultureId: state.nameCultureId,
    homeCity: describeCity(state.player.currentLocation.cityId),
    flags: new Set(history.flags),
    schoolStage: state.education.stage,
    activityCount: state.education.activities.length,
    // Whole dollars. The engine works in dollars because the catalog does; the
    // branded Money type stays on this side of the seam.
    cash: Math.floor(Number(state.player.cash) / 100),
    // Ticket 0207. Lets a romance event say it presupposes a relationship —
    // without it, "dinner at their parents'" fired about a classmate the
    // character had never spoken to.
    partnered: partnerOf(state.circle.people) !== undefined,
    // Ticket 0208. Without it, "your kid spiked a fever" fires at somebody who
    // has never had a child — the same defect `partnered` was added for.
    hasChildren: livingChildren(state.family).length > 0,
    /*
      Ticket 0409. Work, the body, and loss — the three things the catalog
      could not see, and the three the roadmap listed as holes (findings 3, 4
      and 4b). Measured before this: 26 events could fire at forty and every one
      of them was about family, friends or weather.
    */
    employed: state.employment.job !== undefined,
    ...(jobTrackOf(state) !== undefined ? { jobTrack: jobTrackOf(state) } : {}),
    jobYears: state.employment.job ? Math.max(0, age - state.employment.job.since) : 0,
    conditions: state.health.conditions.map((entry) => entry.conditionId),
    ...(yearsSinceLoss(state, age) !== undefined
      ? { bereavedWithin: yearsSinceLoss(state, age) }
      : {}),
    /*
      Ticket 0412. Friends, counted off the circle rather than stored.

      Both exclude anybody the character is involved with, which is the same
      separation `partnerOf` makes one line above: a spouse is not the answer to
      "does this character have a friend", and an event reading "you and {kid}
      have been friends since school" firing about a wife is 0207's `partnered`
      bug in reverse.
    */
    friends: friends.length,
    friendshipYears: friends.reduce(
      (longest, person) => Math.max(longest, age - person.metAtAge),
      0,
    ),
    // Ticket 0209: what education, the class and the family have already
    // written this year. The line budget belongs to the YEAR, not to events.
    alreadyThisYear: linesSoFar,
    // Only people who are still around. Somebody who drifted out two years ago
    // must not turn up in the cafeteria as though nothing happened.
    people: state.circle.people.filter(isCurrent).map((person) => ({
      id: person.id,
      name: displayName(person),
      sex: person.sex,
      kind: person.kind,
      // Ticket 0413: the same `friendsOf` the predicates are counted from, so
      // "has a friend" and "names a friend" can never disagree about who one is.
      friend: friends.some((friend) => friend.id === person.id),
    })),
  };
}

/**
 * The friends this character has, Ticket 0412.
 *
 * Anybody over `FRIENDSHIP_THRESHOLD` who is still around and who the character
 * is not, and has not been, involved with. `isFriend` already handles the first
 * two; the romance exclusion is this function's whole reason for existing, and
 * it reads `romance` rather than `partnerOf` because an ex is not a friend for
 * the purposes of a line about friendship either — they are a person with a
 * different history, and the `love.*` half of the catalog is about them.
 */
function friendsOf(state: GameState): readonly Acquaintance[] {
  return state.circle.people.filter((person) => isFriend(person) && person.romance === undefined);
}

/** The track of the job held right now, if any. */
function jobTrackOf(state: GameState): string | undefined {
  const held = state.employment.job;
  if (!held) return undefined;
  return findJob(held.jobId)?.track === undefined ? undefined : String(findJob(held.jobId)!.track);
}

/**
 * Years since the most recent close bereavement, or undefined.
 *
 * Reads `LifeRecord`s of category 'loss', which 0409 added for exactly this —
 * `LifeRecord`'s own rule is "never derived by parsing timeline text", and the
 * only previous way to ask this question was to look for labels beginning
 * "Lost ". `kin` runs before `events` in `advanceYear`, so a death this year is
 * already visible as zero.
 */
function yearsSinceLoss(state: GameState, age: number): number | undefined {
  let nearest: number | undefined;
  for (const record of state.player.records) {
    if (record.category !== 'loss') continue;
    const since = age - record.age;
    if (since >= 0 && (nearest === undefined || since < nearest)) nearest = since;
  }
  return nearest;
}

/** Timeline kind for an outcome. Feed colour comes from this (LifeScreen). */
export function timelineKindFor(outcome: EventOutcome): TimelineKind {
  if (outcome.type === 'decision') return 'decision';
  if (outcome.type === 'opportunity') return 'opportunity';
  if (outcome.category === 'family' || outcome.category === 'friendship') return 'relationship';
  // Ticket 0409. Authored adult categories get the feed colour their subject
  // already has elsewhere in the build rather than all landing on 'passive'.
  if (outcome.category === 'loss') return 'relationship';
  if (outcome.category === 'health') return 'health';
  if (outcome.category === 'career') return 'career';
  return 'passive';
}

/**
 * Fold one outcome into character and household state.
 *
 * Shared with decision resolution, so a choice's consequences land exactly the
 * same way a passive event's do — there is one place where an event changes the
 * world, and this is it.
 */
export function applyOutcome(
  player: Character,
  family: Household,
  history: EventHistory,
  outcome: EventOutcome,
  behaviour: number,
  stress = 0,
): {
  player: Character;
  family: Household;
  history: EventHistory;
  behaviour: number;
  stress: number;
  cashDelta?: ReportedCash;
} {
  const applied = applyEffects(
    { stats: player.stats, family, cash: player.cash, behaviour, stress, history },
    outcome.effects,
  );
  return {
    // Ticket 0301: `cash` is no longer touched here. `applied.cash` is the
    // balance this started with, and the movement is reported instead.
    player: { ...player, stats: applied.stats },
    family: applied.family,
    history: applied.history,
    behaviour: applied.behaviour,
    stress: applied.stress,
    ...(applied.cashDelta ? { cashDelta: applied.cashDelta } : {}),
  };
}

/**
 * Warmth an outcome is worth to somebody it named (Ticket 0206).
 *
 * Authored where it matters, and derived from happiness where it is not. Every
 * event in the catalog already says how a year felt; asking 345 events to also
 * say how it felt about a person the engine only started binding in 0206 would
 * be a lot of authoring for a number the copy has already implied.
 *
 * The scale is deliberately gentler than the interaction menu. A thing that
 * happened TO you is worth less than a thing you chose to do, or a passive year
 * would move a friendship further than deciding to go round somebody's house.
 */
export function bondFromOutcome(outcome: EventOutcome): number {
  const authored = outcome.effects?.bond;
  if (authored !== undefined) return authored;
  const happiness = outcome.effects?.stats?.happiness ?? 0;
  const derived = Math.round(happiness * 0.7);
  return derived > 8 ? 8 : derived < -10 ? -10 : derived;
}

/** A memory big enough that the other person never stops having it. */
export const MAJOR_MEMORY_WARMTH = 7;

/**
 * Leave a memory on everybody this outcome named.
 *
 * Only real people: `npcId` is present exactly when the token bound to somebody
 * who exists. An invented name — early childhood, or a character out of school
 * — has nowhere to leave a memory, which is the honest answer rather than a
 * missing one.
 */
export function rememberOutcome(
  circle: SocialCircle,
  outcome: EventOutcome,
  age: number,
): SocialCircle {
  // Only people the line actually NAMES. A decision can declare two people —
  // "{kid} has slid {kidTheir} test across, {adult} is at the window" — and land
  // on an outcome that mentions one of them. Reading output found the same
  // memory filed against a classmate and a teacher who was not in the sentence.
  const bound = Object.values(outcome.names ?? {}).filter(
    (person) => person?.npcId && outcome.text.includes(person.name),
  );
  if (bound.length === 0) return circle;

  const warmth = bondFromOutcome(outcome);
  const ids = new Set(bound.map((person) => person.npcId as string));
  const people = circle.people.map((person): Acquaintance => {
    if (!ids.has(person.id) || !isCurrent(person)) return person;
    return remember(person, {
      age,
      text: outcome.text,
      major: Math.abs(warmth) >= MAJOR_MEMORY_WARMTH,
      warmth,
    });
  });
  return { ...circle, people };
}

/** Run the year's events and return everything that changed. */
export function runEvents(
  state: GameState,
  age: number,
  year: number,
  linesSoFar = 0,
): EventPhaseOutput {
  const stream = state.rng.stream(RngDomains.Events);
  const context = buildEventContext(state, age, year, state.events, linesSoFar);
  const result = runEventPhase(context, stream, state.events);

  let player = state.player;
  let family = state.family;
  let history = result.history;
  let behaviour: number = state.education.behaviour;
  let circle = state.circle;
  // Running total for the year, handed to the stress phase. Not a level — the
  // level is computed once, at the end of the year, from everything.
  let stress = 0;
  const lines: { kind: TimelineKind; text: string; eventId: string }[] = [];
  const transactions: NewTransaction[] = [];

  for (const outcome of result.outcomes) {
    const applied = applyOutcome(player, family, history, outcome, behaviour, stress);
    player = applied.player;
    family = applied.family;
    history = applied.history;
    behaviour = applied.behaviour;
    stress = applied.stress;
    circle = rememberOutcome(circle, outcome, age);
    if (applied.cashDelta) {
      transactions.push({
        category: 'windfall',
        amount: dollars(applied.cashDelta.delta),
        source: applied.cashDelta.source,
      });
    }
    lines.push({ kind: timelineKindFor(outcome), text: outcome.text, eventId: outcome.eventId });
  }

  return {
    player,
    family,
    circle,
    history,
    behaviour,
    stress,
    lines,
    transactions,
    decisions: result.decisions,
  };
}
