/**
 * Ticket 0506 — renovating a home you own.
 *
 * The rules are `@yearafter/finance`'s `renovations.ts`. This is the verb, the
 * list the Renovate screen shows, and the seventh door.
 *
 * THE DOOR IS FOR THE HOME YOU LIVE IN FALLING APART. Measured before this
 * ticket, 72–88% of homes lived in by people past forty-five were in poor
 * condition, because nothing could ever lift one. A house in poor shape costs
 * 35% more to keep and is worth 18% less, and its owner would — in life — get
 * the kitchen done. So the game asks, with the cheapest job that lifts it,
 * paid for out of savings that can carry it. The pools and the maze are the
 * player's to choose; nobody is asked about a bowling alley.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import { RENOVATIONS, findHomeKind, findRenovation, type Renovation } from '@yearafter/content';
import { dollars, err, mixedUnit, ok, type Result } from '@yearafter/core';
import {
  annualExpenseOf,
  post,
  renovated,
  renovationCostOf,
  renovationRefusalFor,
  type OwnedHome,
  type RenovationRefusal,
} from '@yearafter/finance';
import type { PendingDecision } from '@yearafter/events';
import { hasSystemicOffer, type GameState, type RenovationOffer } from './game-state';
import { residenceOf } from './rentals';

export interface RenovationOption {
  readonly renovation: Renovation;
  /** Whole dollars on this home. */
  readonly cost: number;
  /** What the home would be worth the day it was done. */
  readonly worthAfter: number;
  /** What it would cost to keep a year afterwards. */
  readonly expenseAfter: number;
  readonly refusal?: RenovationRefusal;
}

/**
 * Everything that could be done to this home this year. A renovation the
 * home could never have — a pool for a condo, a maze for anything but an
 * estate — is left out rather than listed as refused.
 */
export function renovationOptionsFor(
  state: GameState,
  homeId: string,
): readonly RenovationOption[] {
  const home = state.homes.find((candidate) => candidate.id === homeId);
  if (!home) return [];
  return RENOVATIONS.map((renovation): RenovationOption => {
    const cost = renovationCostOf(renovation, home);
    const after = renovated(home, renovation, cost, state.world.year);
    const refusal = renovationRefusalFor(renovation, home, state.world.year);
    return {
      renovation,
      cost,
      worthAfter: Number(after.value) / 100,
      expenseAfter: annualExpenseOf(after),
      ...(refusal ? { refusal } : {}),
    };
  }).filter((option) => option.refusal !== 'notForThisHome');
}

export type RenovateError =
  | 'no-such-home'
  | 'no-such-renovation'
  | 'not-for-this-home'
  | 'needs-first'
  | 'already-done'
  | 'too-soon'
  | 'cannot-afford';

export const RENOVATE_ERROR_LABELS: Readonly<Record<RenovateError, string>> = {
  'no-such-home': "You don't own that place any more.",
  'no-such-renovation': "That isn't something a builder does.",
  'not-for-this-home': "There's no room for that here.",
  'needs-first': 'That needs the first addition done before it.',
  'already-done': "It's already got one.",
  'too-soon': 'That was done recently. It has years left in it.',
  'cannot-afford': "You don't have the money for that.",
};

const REFUSAL_ERRORS: Readonly<Record<RenovationRefusal, RenovateError>> = {
  notForThisHome: 'not-for-this-home',
  needsFirst: 'needs-first',
  alreadyDone: 'already-done',
  tooSoon: 'too-soon',
};

export interface RenovatedHome {
  readonly state: GameState;
  readonly home: OwnedHome;
  readonly entry: TimelineEntry;
  readonly cost: number;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

const nameOf = (home: OwnedHome): string =>
  (findHomeKind(home.kindId)?.noun ?? 'the place').replace(/^an? /, 'the ');

/**
 * Pay a builder. Cash only, and spending (`housing`): what the home is worth
 * more for it shows in the home's value, which is the part that is still
 * money.
 */
export function renovate(
  state: GameState,
  homeId: string,
  renovationId: string,
): Result<RenovatedHome, RenovateError> {
  const home = state.homes.find((candidate) => candidate.id === homeId);
  if (!home) return err('no-such-home');
  const renovation = findRenovation(renovationId);
  if (!renovation) return err('no-such-renovation');
  const refusal = renovationRefusalFor(renovation, home, state.world.year);
  if (refusal) return err(REFUSAL_ERRORS[refusal]);
  const cost = renovationCostOf(renovation, home);
  if (Number(state.player.cash) / 100 < cost) return err('cannot-afford');

  const where = nameOf(home);
  const books = post(state.finance, state.world.year, state.player.age, {
    category: 'housing',
    amount: dollars(-cost),
    source: `${renovation.name} at ${where}`,
  });
  const next = renovated(home, renovation, cost, state.world.year);
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  const entry = createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'passive',
    text: `Had ${renovation.phrase} put in at ${where}. ${money(cost)}.`,
    id: `t:${state.world.year}:home:reno:${home.id}:${renovation.id}`,
    sequence,
  });
  return ok({
    state: {
      ...state,
      finance: books.ledger,
      homes: state.homes.map((candidate) => (candidate.id === home.id ? next : candidate)),
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
    home: next,
    entry,
    cost,
  });
}

/* -------------------------------------------------------------------------- */
/* The seventh door                                                            */
/* -------------------------------------------------------------------------- */

export const RENOVATION_EVENT_ID = 'home.renovate';
export const GET_IT_DONE = 'yes';
export const LIVE_WITH_IT = 'skip';
export const RENOVATION_OFFER_CHANCE = 0.35;
/** Months of living kept in hand after paying a builder. */
export const RENOVATION_CUSHION_MONTHS = 6;

export const isRenovationOfferDecision = (eventId: string): boolean =>
  eventId === RENOVATION_EVENT_ID;

/**
 * The home they live in is in poor or fair shape, and they have the savings
 * to fix the worst of it: the game asks about the cheapest job that lifts it.
 */
export function withRenovationOffer(
  state: GameState,
  alive: boolean,
  livingCost: number,
): GameState {
  if (!alive) return state;
  if (hasSystemicOffer(state)) return state;
  const home = residenceOf(state.homes);
  if (!home) return state;
  if (home.condition !== 'poor' && home.condition !== 'fair') return state;
  if (
    !(
      mixedUnit(`${state.rng.getSeed()}:${state.world.year}:renovation-offer:ask`) <
      RENOVATION_OFFER_CHANCE
    )
  ) {
    return state;
  }
  const cash = Math.floor(Number(state.player.cash) / 100);
  const cushion = Math.round((livingCost * RENOVATION_CUSHION_MONTHS) / 12);
  const candidate = renovationOptionsFor(state, home.id)
    .filter((option) => option.renovation.refresh && option.refusal === undefined)
    .filter((option) => cash - option.cost >= cushion)
    .sort((a, b) => a.cost - b.cost)[0];
  if (!candidate) return state;

  const where = nameOf(home);
  const job = candidate.renovation.phrase;
  const prompts =
    home.condition === 'poor'
      ? [
          `${cap(where)} is showing every year of its age. A builder quoted ${money(candidate.cost)} for ${job}.`,
          `Something else broke at ${where} this week. ${cap(job)} would be ${money(candidate.cost)}.`,
        ]
      : [
          `${cap(where)} could use some work. ${cap(job)} would be ${money(candidate.cost)}.`,
          `You keep looking at the state of ${where}. A builder said ${money(candidate.cost)} for ${job}.`,
        ];
  const offer: RenovationOffer = {
    homeId: home.id,
    renovationId: candidate.renovation.id,
    cost: candidate.cost,
    age: state.player.age,
    eventId: RENOVATION_EVENT_ID,
  };
  const decision: PendingDecision = {
    eventId: RENOVATION_EVENT_ID,
    category: 'random',
    age: state.player.age,
    year: state.world.year,
    prompt: prompts[state.player.age % prompts.length] as string,
    choices: [
      { id: GET_IT_DONE, label: 'Get it done' },
      { id: LIVE_WITH_IT, label: 'Live with it' },
    ],
    names: {},
  };
  return { ...state, renovationOffer: offer, pending: [...state.pending, decision] };
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export type RenovationOfferError = 'no-offer' | 'no-such-choice';

export function answerRenovationOffer(
  state: GameState,
  choiceId: string,
): Result<{ readonly state: GameState; readonly entry: TimelineEntry }, RenovationOfferError> {
  const offer = state.renovationOffer;
  if (!offer) return err('no-offer');
  if (choiceId !== GET_IT_DONE && choiceId !== LIVE_WITH_IT) return err('no-such-choice');
  const cleared: GameState = {
    ...state,
    pending: state.pending.filter((candidate) => !isRenovationOfferDecision(candidate.eventId)),
  };
  delete (cleared as { renovationOffer?: RenovationOffer }).renovationOffer;

  const note = (text: string) => {
    const sequence = cleared.player.timeline.filter(
      (entry) => entry.age === cleared.player.age,
    ).length;
    const entry = createTimelineEntry({
      age: cleared.player.age,
      year: cleared.world.year,
      kind: 'passive',
      text,
      id: `t:${cleared.world.year}:home:reno-offer`,
      sequence,
    });
    return ok({
      state: {
        ...cleared,
        player: { ...cleared.player, timeline: appendToTimeline(cleared.player.timeline, entry) },
      },
      entry,
    });
  };
  if (choiceId === LIVE_WITH_IT) return note('Decided the house could wait another year.');
  const done = renovate(cleared, offer.homeId, offer.renovationId);
  if (!done.ok) return note("Meant to get the work done. It didn't happen this year.");
  return ok({ state: done.value.state, entry: done.value.entry });
}
