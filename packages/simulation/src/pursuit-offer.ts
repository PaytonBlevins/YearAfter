/**
 * Ticket 0416 — the sign-up sheet that finds you.
 *
 * Roadmap finding 2g said an adult cannot join anything. Measured, it is wider
 * than that: **across 120 played lives, nobody ever joined anything, at any
 * age — 0 of 120.** Every verb in `joining.ts` and `tryout.ts` lives behind the
 * Clubs & Teams screen and is only ever called by a button, so 0204's
 * twenty-five activities, 0206b's tryouts, practice, seasons and teammates, and
 * 0209's parent paying for it were all unreachable to a player who did not go
 * looking. It is the fourth door of this shape: 0405 found it for college, 0407
 * for a first job, 0410 for a private life.
 *
 * And the adult half had no list to join from at all. 0416 adds one (see
 * `generate-activities.py`), and this is the door to both.
 *
 * SO IT ARRIVES THE WAY THE OTHER FOUR DO — a `PendingDecision` in
 * `state.pending`, answered through `decide`, rendered by the popup the app
 * already has. And it RUNS THE REAL VERB, 0405's rule: saying yes calls
 * `tryOut` for a place that has to be earned and `askToJoin` for one a parent
 * has to pay for, so a child can be cut from the team or told no by a parent
 * exactly as a tap would have been. Only the question is new.
 *
 * LAST IN THE QUEUE OF DOORS. One systemic question a year is the rule since
 * 0410 (`hasSystemicOffer`), and a league sign-up should never be the reason a
 * job offer or a college place was not asked about. So this runs after the
 * other three and only fires in a year they left quiet.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  ACTIVITIES,
  findActivity,
  type Activity,
  type ActivityKind,
  type SchoolStageId,
} from '@yearafter/content';
import { err, ok, type Result } from '@yearafter/core';
import {
  activityStageOf,
  hasAttemptedThisYear,
  hasJoined,
  joinedActivities,
  unavailableReason,
} from '@yearafter/education';
import type { PendingDecision } from '@yearafter/events';
import type { TalentKey } from '@yearafter/character';
import { hasSystemicOffer, type GameState, type PursuitOffer } from './game-state';
import { askToJoin } from './joining';
import { affordsFee, called } from './pursuits';
import { tryOut } from './tryout';
import { RngDomains, stableUnit } from './rng/rng';

/** The reserved event id a systemic sign-up is raised under. */
export const PURSUIT_OFFER_EVENT_ID = 'activity.offer';

export const TAKE_IT_UP = 'yes';
export const PASS = 'skip';

export type PursuitOfferError = 'no-offer' | 'no-such-choice';

export interface PursuitOfferOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  /** Whether the player said yes. Not whether they got in. */
  readonly went: boolean;
}

export const isPursuitOfferDecision = (eventId: string): boolean =>
  eventId === PURSUIT_OFFER_EVENT_ID;

/* -------------------------------------------------------------------------- */
/* How often                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A child is asked more often than an adult, and both less once they have
 * something.
 *
 * A school puts a sign-up sheet in front of every child every September, which
 * is why the child number is the higher one; an adult has to be asked by
 * somebody. The second number is lower on purpose — the person with one thing
 * going is not the person a second invitation is aimed at — and there is no
 * third: two held things stop the door, and the screen is still there for a
 * player who wants five (0204's rule, that nothing refuses a join for being
 * busy, is the screen's and stays the screen's).
 *
 * Not tuned against a target. Measured in the ticket doc; the population a
 * player who says yes to everything ends up in is the thing reported.
 */
export const CHILD_FIRST = 0.25;
export const CHILD_SECOND = 0.1;
export const ADULT_FIRST = 0.14;
export const ADULT_SECOND = 0.05;
/** A five-year-old is asked about nothing. The sign-up sheet starts at six. */
export const ASKED_FROM = 6;

const KIND_TALENTS: Readonly<Record<ActivityKind, readonly TalentKey[]>> = {
  sport: ['athletics'],
  arts: ['acting', 'music'],
  academic: ['academics'],
  service: [],
  social: [],
};

/** Somebody good at a thing gets asked about it. Large, never exclusive. */
export const TALENT_PULL = 3;

/**
 * What this character could be asked about this year.
 *
 * The same gate the screen reads (`unavailableReason`) plus, for an adult, the
 * fee has to fit what the household lives on (`affordsFee`) — the same test the
 * adult year applies before it keeps charging it. An invitation the character
 * is then priced out of is worse than no invitation.
 */
export function openTo(state: GameState): readonly Activity[] {
  const age = state.player.age;
  const stage = activityStageOf(state.education, age);
  if (stage === undefined || age < ASKED_FROM) return [];
  return ACTIVITIES.filter((activity) => {
    if (!activity.requires.stages.includes(stage)) return false;
    if (hasJoined(state.education, activity.id)) return false;
    if (hasAttemptedThisYear(state.education, activity.id, age)) return false;
    const reason = unavailableReason(activity, {
      age,
      stage,
      stats: state.player.stats,
      talents: state.player.talents,
      wealth: state.family.finances.band,
      household: state.family,
    });
    if (reason !== undefined) return false;
    return stage !== 'adult' || affordsFee(state.household.standard, activity.annualCost ?? 0);
  });
}

function heldOnList(state: GameState, stage: SchoolStageId): number {
  return joinedActivities(state.education).filter((activity) =>
    activity.requires.stages.includes(stage),
  ).length;
}

/* -------------------------------------------------------------------------- */
/* Raising one                                                                 */
/* -------------------------------------------------------------------------- */

export function withPursuitOffer(state: GameState, alive: boolean): GameState {
  if (!alive) return state;
  if (hasSystemicOffer(state)) return state;
  const stage = activityStageOf(state.education, state.player.age);
  if (stage === undefined) return state;

  const held = heldOnList(state, stage);
  const adult = stage === 'adult';
  const chance =
    held === 0
      ? adult
        ? ADULT_FIRST
        : CHILD_FIRST
      : held === 1
        ? adult
          ? ADULT_SECOND
          : CHILD_SECOND
        : 0;
  if (chance === 0) return state;

  const stream = state.rng.stream(RngDomains.Pursuits);
  // Both draws are taken before the candidates are looked at, so whether
  // anything happens to be open this year never moves where the stream is.
  if (!stream.chance(chance)) return state;
  const roll = stream.next();

  const open = openTo(state);
  if (open.length === 0) return state;
  const weights = open.map((activity) =>
    KIND_TALENTS[activity.kind].some((key) => state.player.talents[key]) ? TALENT_PULL : 1,
  );
  const activity = open[weightedIndex(weights, roll)] as Activity;

  const offer: PursuitOffer = {
    activityId: activity.id,
    age: state.player.age,
    eventId: PURSUIT_OFFER_EVENT_ID,
  };
  return {
    ...state,
    pursuitOffer: offer,
    pending: [...state.pending, pursuitDecision(offer, activity, state.world.year)],
  };
}

function weightedIndex(weights: readonly number[], roll: number): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = roll * total;
  for (let index = 0; index < weights.length; index += 1) {
    target -= weights[index] as number;
    if (target < 0) return index;
  }
  return weights.length - 1;
}

/* -------------------------------------------------------------------------- */
/* The question                                                                */
/* -------------------------------------------------------------------------- */

const SCHOOL_PROMPTS = {
  open: [
    'Sign-ups for {name} are this week. You could put your name down.',
    "There's a sheet for {name} outside the office, and it isn't full.",
  ],
  tryout: [
    '{Label} for {name} are on Thursday after school.',
    "There are {label}s for {name} next week. You'd have to earn a place.",
  ],
} as const;

const ADULT_PROMPTS = {
  open: [
    'Somebody you know is in {called} and asked if you wanted to come along.',
    "You keep walking past a flyer for {called}. They're looking for people.",
    '{Called} is taking new people. It would be one evening a week.',
  ],
  tryout: [
    '{Called} is holding auditions for the spring show. Anybody can turn up.',
    'Somebody from {called} said you should audition. They meant it.',
  ],
} as const;

export function pursuitPrompt(activity: Activity, age: number): string {
  const adult = activity.requires.stages.includes('adult');
  const set = adult ? ADULT_PROMPTS : SCHOOL_PROMPTS;
  const lines = activity.tryout ? set.tryout : set.open;
  const base = Math.floor(stableUnit(`pursuitoffer:${activity.id}`) * lines.length);
  const line = lines[(base + age) % lines.length] as string;
  const label = (activity.tryout?.label ?? 'Try out').toLowerCase();
  const what = called(activity);
  return line
    .replace(/\{Called\}/g, what.charAt(0).toUpperCase() + what.slice(1))
    .replace(/\{called\}/g, what)
    .replace(/\{Label\}/g, label === 'try out' ? 'Tryouts' : 'Auditions')
    .replace(/\{label\}/g, label === 'try out' ? 'tryout' : 'audition')
    .replace(/\{name\}/g, activity.name.toLowerCase());
}

export function pursuitDecision(
  offer: PursuitOffer,
  activity: Activity,
  year: number,
): PendingDecision {
  return {
    eventId: PURSUIT_OFFER_EVENT_ID,
    category: activity.requires.stages.includes('adult') ? 'random' : 'school',
    age: offer.age,
    year,
    prompt: pursuitPrompt(activity, offer.age),
    choices: [
      { id: TAKE_IT_UP, label: activity.tryout ? activity.tryout.label : 'Sign up' },
      { id: PASS, label: 'Not this year' },
    ],
    names: {},
  };
}

/* -------------------------------------------------------------------------- */
/* Answering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Answer it, through the real verb.
 *
 * Declines gracefully rather than throwing, 0410's call: the same verbs sit on a
 * screen, so a player can join the thing from Clubs & Teams between the popup
 * appearing and being answered, and that is a player doing something ordinary
 * rather than a regression.
 */
export function answerPursuitOffer(
  state: GameState,
  choiceId: string,
): Result<PursuitOfferOutcome, PursuitOfferError> {
  const offer = state.pursuitOffer;
  if (!offer) return err('no-offer');
  if (choiceId !== TAKE_IT_UP && choiceId !== PASS) return err('no-such-choice');

  const cleared: GameState = {
    ...state,
    pending: state.pending.filter((candidate) => !isPursuitOfferDecision(candidate.eventId)),
  };
  delete (cleared as { pursuitOffer?: PursuitOffer }).pursuitOffer;

  const activity = findActivity(offer.activityId);
  if (!activity) return ok(noted(cleared, 'Thought about joining something. Not this year.'));
  if (choiceId === PASS) {
    return ok(noted(cleared, `Thought about ${called(activity)}. Not this year.`));
  }
  if (hasJoined(cleared.education, activity.id)) {
    return ok(noted(cleared, `Already in ${called(activity)}.`, true));
  }

  if (activity.tryout) {
    const attempt = tryOut(cleared, activity.id);
    if (!attempt.ok) {
      return ok(
        noted(cleared, `Meant to go to the ${activity.tryout.label.toLowerCase()} and didn't.`),
      );
    }
    return ok({ state: attempt.value.state, entry: attempt.value.entry, went: true });
  }

  // A parent may be asked to pay, and may say no — the same model the screen
  // uses, which writes its own line when it does.
  const asked = askToJoin(cleared, activity.id);
  if (!asked.joined) {
    const entry = asked.state.player.timeline.at(-1) as TimelineEntry;
    return ok({ state: asked.state, entry, went: true });
  }
  return ok(noted(asked.state, activity.joinText, true, 'milestone', `joined:${activity.id}`));
}

function noted(
  state: GameState,
  text: string,
  went = false,
  kind: 'milestone' | 'passive' = 'passive',
  key = 'pursuit',
): PursuitOfferOutcome {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:${key}`,
    sequence,
  });
  return {
    state: {
      ...state,
      player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
    },
    entry,
    went,
  };
}
