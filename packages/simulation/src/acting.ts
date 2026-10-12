/**
 * Ticket 0805 — acting.
 *
 * The rules, over the table in `@yearafter/content`'s `acting.ts`. A life reaches the work three ways and none
 * of them needs an agent (Payton's call):
 *
 *   - being seen: a year in a drama club or a community theater, lessons, or a first credit puts the actor in front
 *     of directors, and a few of them ask (`runActingYear` raises up to a handful of offers a year, more at higher
 *     rungs and with a good name);
 *   - applying: `castingCalls` is this year's open auditions, `applyForCasting` answers Offer or Denied by one
 *     hash draw, with no callbacks (spec 279);
 *   - an agent, if the actor wants one: `signWithAgent`. An agent takes a tenth, brings one more slot and a
 *     better chance of a part a rung up, and two more submissions a year.
 *
 * Every part says what it is: a lead, a supporting part or a bit part, in what kind of work, and what it pays.
 * A part that is taken is booked, shot in the year to come, judged and paid then. Health and stress are not
 * inputs (spec 280). Every draw is a hash (`actUnit`), so no RNG stream is touched.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type LifeRecord,
  type NewLifeRecord,
  type TimelineEntry,
} from '@yearafter/character';
import {
  ACTING_TIERS,
  ACTING_TIER_ROWS,
  AGEING_FLOOR,
  AGEING_FROM,
  AGEING_RATE,
  AGENT_ASK_BONUS,
  AGENT_CUT,
  AGENT_MIN_CREDITS,
  AGENT_MIN_TIER,
  AGENT_OFFER_MULTIPLIER,
  AGENT_SLOT_CHANCE,
  AGENT_SUBMISSIONS,
  APPLICATIONS_PER_YEAR,
  APPLY_AGENT_BONUS,
  APPLY_BASE,
  APPLY_BILLING,
  APPLY_CRAFT_WEIGHT,
  APPLY_REPUTATION_WEIGHT,
  APPLY_TALENT_BONUS,
  ASK_BASE,
  ASK_GAIN,
  ASK_REPUTATION_WEIGHT,
  AWARD_CEREMONY,
  AWARD_CHANCE,
  AWARD_LINE,
  AWARD_MOOD,
  AWARD_NAMES,
  AWARD_REPUTATION,
  BILLING_NOUN,
  BILLING_REPUTATION,
  CASTING_CALLS,
  CRAFT_HEADROOM,
  CREDIT_CRAFT,
  CREDIT_CRAFT_CAP,
  DEVELOPMENT_MIN_AGE,
  DEVELOPMENT_SESSIONS,
  FLOP_MARGIN,
  FLOP_REPUTATION,
  HITS_TO_RISE,
  HIT_REPUTATION,
  IDLE_FALL_YEARS,
  IDLE_REPUTATION,
  LESSONS_COST,
  LESSONS_COST_SOURCE,
  LESSONS_CRAFT,
  LESSONS_MIN_AGE,
  NEGOTIABLE_FROM,
  OFFER_TIER_WEIGHTS,
  PERFORMANCE_NOISE,
  REPUTATION_OFFER_RANGE,
  SEEN_YEARS,
  ROLE_TITLES,
  TALENT_OFFER_CHANCE,
  TIER_RISE_LINES,
  YEAR_DAYS,
  actingFameOf,
  billingFor,
  naturalCraft,
  roleDays,
  roleFee,
  stepActingTier,
  tierRank,
  type ActingTier,
  type Billing,
} from '@yearafter/content';
import { err, mixedUnit, ok, type Result } from '@yearafter/core';
import type { EducationState } from '@yearafter/education';
import type { PendingDecision } from '@yearafter/events';
import type { ActingState, BookedRole, Role } from './acting-state';
import type { GameState } from './game-state';
import { affordsFee } from './pursuits';
import { money } from './sports-core';

export const ACTING_OFFER_EVENT_ID = 'acting.offer';
export const isActingOfferDecision = (eventId: string): boolean =>
  eventId === ACTING_OFFER_EVENT_ID;

const ACCEPT = 'accept';
const REQUEST_MORE = 'more';
const DECLINE = 'decline';

/** The activities that put an actor on a stage in front of people. */
export const STAGE_ACTIVITIES: readonly string[] = ['act.drama-club', 'act.adult.theater'];

/** The most offers waiting on an answer at once. */
export const MAX_OFFERS = 4;

/** A [0, 1) draw about one life, keyed on the seed and a name. No RNG stream is touched. */
export const actUnit = (
  seed: string,
  generation: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`act:${seed}:${generation}:${parts.join(':')}`);

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/* -------------------------------------------------------------------------- */
/* Reading an acting life                                                      */
/* -------------------------------------------------------------------------- */

export const actingOf = (state: GameState): ActingState => state.acting;

/** What the character can do as an actor now: what they have built, or what they are like if nothing yet. */
export function craftOf(state: GameState): number {
  return state.acting.craft ?? naturalOf(state);
}

function naturalOf(state: GameState): number {
  return naturalCraft(state.player.stats, state.player.talents.acting);
}

/** What work, lessons and development can take craft to. */
export function craftCeiling(state: GameState): number {
  const lessons = state.acting.lessons ? LESSONS_CRAFT : 0;
  return Math.min(100, naturalOf(state) + CRAFT_HEADROOM + lessons);
}

/** Whether anybody in the business has seen this actor, so that they could be asked. */
export function isSeen(acting: ActingState, age: number): boolean {
  if (acting.agent !== undefined || acting.lessons !== undefined) return true;
  return acting.seenAge !== undefined && age - acting.seenAge <= SEEN_YEARS;
}

/** Work is coming in as a living: a supporting actor or better who has worked lately. */
export function isActingFullTime(acting: ActingState): boolean {
  return tierRank(acting.tier) >= tierRank('supporting') && acting.credits > 0 && acting.idle < 2;
}

/** The header, for somebody whose living is acting. */
export const actingOccupation = (acting: ActingState): string | undefined =>
  isActingFullTime(acting) ? 'Actor' : undefined;

export type NotReady = 'too-young' | 'few-credits' | 'craft' | 'reputation';

export const NOT_READY_LABELS: Readonly<Record<NotReady, string>> = {
  'too-young': "You're too young for that kind of work.",
  'few-credits': "You haven't worked enough yet.",
  craft: "You aren't there as an actor yet.",
  reputation: "They don't know your name well enough.",
};

/** Why an actor can't be given work at this rung yet, if they can't. */
export function notReadyFor(
  acting: ActingState,
  tier: ActingTier,
  age: number,
  craft: number,
): NotReady | undefined {
  const row = ACTING_TIER_ROWS[tier];
  if (age < row.minAge) return 'too-young';
  if (acting.credits < row.minCredits) return 'few-credits';
  if (craft < row.minCraft) return 'craft';
  if (acting.reputation < row.minReputation) return 'reputation';
  return undefined;
}

const daysOf = (rows: readonly { readonly days: number }[]): number =>
  rows.reduce((sum, row) => sum + row.days, 0);

/** The days still free in the year to come. */
export const freeDays = (acting: ActingState): number =>
  YEAR_DAYS - daysOf(acting.booked) - daysOf(acting.offers);

const titleOf = (role: Pick<Role, 'billing' | 'medium' | 'title'>): string =>
  `${BILLING_NOUN[role.billing]} in ${role.medium}, "${role.title}"`;

/* -------------------------------------------------------------------------- */
/* Making a role                                                               */
/* -------------------------------------------------------------------------- */

function makeRole(input: {
  readonly seed: string;
  readonly gen: number;
  readonly id: string;
  readonly tier: ActingTier;
  readonly source: Role['source'];
  readonly age: number;
  readonly reputation: number;
  readonly taken: ReadonlySet<string>;
}): Role {
  const { seed, gen, id, tier, age } = input;
  const row = ACTING_TIER_ROWS[tier];
  const billing = billingFor(tier, actUnit(seed, gen, 'billing', id));
  // A name that is known gets a little more than a name that is not, up to 15% either side.
  const name = 0.85 + 0.3 * Math.min(1, input.reputation / 100);
  const fee = Math.round(roleFee(tier, billing, actUnit(seed, gen, 'fee', id)) * name);
  const days = roleDays(tier, billing, actUnit(seed, gen, 'days', id));
  const medium =
    row.mediums[Math.floor(actUnit(seed, gen, 'medium', id) * row.mediums.length)] ??
    row.mediums[0]!;
  let index = Math.floor(actUnit(seed, gen, 'title', id) * ROLE_TITLES.length);
  for (
    let tries = 0;
    tries < ROLE_TITLES.length && input.taken.has(ROLE_TITLES[index]!);
    tries += 1
  ) {
    index = (index + 1) % ROLE_TITLES.length;
  }
  return {
    id,
    tier,
    billing,
    medium,
    title: ROLE_TITLES[index]!,
    fee: roundFee(fee),
    days,
    source: input.source,
    age,
  };
}

const roundFee = (fee: number): number => {
  const step = fee < 10_000 ? 100 : fee < 1_000_000 ? 1_000 : 10_000;
  return Math.round(fee / step) * step;
};

/** How much a tier's slots are scaled: a good name, a talent, an agent, and age. */
export function slotScale(state: GameState, acting: ActingState, age: number): number {
  const [low, high] = REPUTATION_OFFER_RANGE;
  const reputation = low + (high - low) * Math.min(1, acting.reputation / 100);
  const talent = state.player.talents.acting ? TALENT_OFFER_CHANCE : 1;
  const agent = acting.agent ? AGENT_OFFER_MULTIPLIER : 1;
  const ageing = Math.max(AGEING_FLOOR, 1 - Math.max(0, age - AGEING_FROM) * AGEING_RATE);
  return reputation * talent * agent * ageing;
}

/** The rung an offer or a call is at: one below, at, or one above the standing. */
export function tierDrawn(
  acting: ActingState,
  unit: number,
  age: number,
  craft: number,
): ActingTier {
  const [below, at] = OFFER_TIER_WEIGHTS[acting.agent ? 'agent' : 'plain'];
  const delta = unit < below ? -1 : unit < below + at ? 0 : 1;
  const wanted = stepActingTier(acting.tier, delta);
  // A rung that wants more than the actor has can't be offered. Back down to where they are.
  if (delta === 1 && notReadyFor(acting, wanted, age, craft) !== undefined) return acting.tier;
  return wanted;
}

/** The chance of each slot the year has for an offer, scaled by name, talent, agent and age, and never above 95%. */
export function offerSlots(state: GameState, acting: ActingState, age: number): readonly number[] {
  const scale = slotScale(state, acting, age);
  const slots = [...ACTING_TIER_ROWS[acting.tier].slots];
  if (acting.agent) slots.push(AGENT_SLOT_CHANCE);
  return slots.map((chance) => Math.min(0.95, chance * scale));
}

/** Offers for the year to come: a few, by the rung, a good name and an agent. */
function raiseOffers(
  state: GameState,
  acting: ActingState,
  age: number,
  year: number,
): readonly Role[] {
  if (!isSeen(acting, age) || age < ACTING_TIER_ROWS.local.minAge) return [];
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const craft = acting.craft ?? naturalOf(state);
  const slots = offerSlots(state, acting, age);
  const raised: Role[] = [];
  const taken = new Set<string>([
    ...acting.booked.map((row) => row.title),
    ...acting.offers.map((row) => row.title),
  ]);
  let days = daysOf(acting.booked) + daysOf(acting.offers);
  slots.forEach((chance, index) => {
    if (acting.offers.length + raised.length >= MAX_OFFERS) return;
    if (actUnit(seed, gen, 'slot', year, index) >= chance) return;
    const tier = tierDrawn(acting, actUnit(seed, gen, 'offertier', year, index), age, craft);
    const role = makeRole({
      seed,
      gen,
      id: `${age}:${index}`,
      tier,
      source: 'asked',
      age,
      reputation: acting.reputation,
      taken,
    });
    if (days + role.days > YEAR_DAYS) return;
    days += role.days;
    taken.add(role.title);
    raised.push(role);
  });
  return raised;
}

/* -------------------------------------------------------------------------- */
/* Casting calls                                                               */
/* -------------------------------------------------------------------------- */

export interface CastingCall {
  readonly role: Role;
  /** One of 'below', 'at' or 'above' the actor's standing. */
  readonly reach: 'below' | 'at' | 'above';
  /** The chance the application lands, 0–1. Shown, because it's a fact about the actor's standing. */
  readonly chance: number;
  /** Already applied to this year. */
  readonly applied: boolean;
}

export type ApplyError =
  | 'too-young'
  | 'no-such-call'
  | 'already-applied'
  | 'no-applications-left'
  | 'booked-up'
  | 'not-ready';

export const APPLY_ERROR_LABELS: Readonly<Record<ApplyError, string>> = {
  'too-young': "You're too young to audition for anything yet.",
  'no-such-call': "That casting call isn't open.",
  'already-applied': "You've applied to that one already.",
  'no-applications-left': "You've sent in all the applications the year has room for.",
  'booked-up': "There aren't the days left in the year to take on another part.",
  'not-ready': "They want more than you've got yet.",
};

/** What a person can send in this year. */
export const applicationsAllowed = (acting: ActingState): number =>
  APPLICATIONS_PER_YEAR + (acting.agent ? AGENT_SUBMISSIONS : 0);

const appliedThisAge = (acting: ActingState, age: number): readonly string[] =>
  acting.appliedAge === age ? acting.applied : [];

function applyChance(
  state: GameState,
  acting: ActingState,
  call: Role,
  reach: CastingCall['reach'],
): number {
  const craft = craftOf(state);
  const chance =
    APPLY_BASE[reach] +
    ((craft - 50) / 100) * APPLY_CRAFT_WEIGHT +
    (state.player.talents.acting ? APPLY_TALENT_BONUS : 0) +
    (acting.agent ? APPLY_AGENT_BONUS : 0) +
    ((acting.reputation - 30) / 100) * APPLY_REPUTATION_WEIGHT +
    APPLY_BILLING[call.billing];
  return Math.max(0.03, Math.min(0.95, chance));
}

/**
 * This year's open castings. Six, at the actor's rung and one either side of it, the same each time they're
 * read. A rung above the actor's is listed only if they are ready for it.
 */
export function castingCalls(state: GameState): readonly CastingCall[] {
  const age = state.player.age;
  const acting = state.acting;
  if (age < ACTING_TIER_ROWS.local.minAge) return [];
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const craft = craftOf(state);
  const done = appliedThisAge(acting, age);
  const taken = new Set<string>();
  const calls: CastingCall[] = [];
  for (let index = 0; index < CASTING_CALLS; index += 1) {
    const unit = actUnit(seed, gen, 'calltier', age, index);
    const delta = unit < 0.25 ? -1 : unit < 0.75 ? 0 : 1;
    let tier = stepActingTier(acting.tier, delta);
    if (notReadyFor(acting, tier, age, craft) !== undefined && delta !== -1) tier = acting.tier;
    if (notReadyFor(acting, tier, age, craft) !== undefined) {
      // The actor's own rung wants more than they have (a fall, or lost standing): fall to what they can do.
      tier =
        ACTING_TIERS.find((row) => notReadyFor(acting, row, age, craft) === undefined) ?? 'local';
    }
    const reach =
      tierRank(tier) < tierRank(acting.tier) ? 'below' : tier === acting.tier ? 'at' : 'above';
    const role = makeRole({
      seed,
      gen,
      id: `call:${age}:${index}`,
      tier,
      source: 'applied',
      age,
      reputation: acting.reputation,
      taken,
    });
    taken.add(role.title);
    calls.push({
      role,
      reach,
      chance: applyChance(state, acting, role, reach),
      applied: done.includes(role.id),
    });
  }
  return calls;
}

export interface ActingOutcome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

function entryFor(
  state: GameState,
  text: string,
  kind: 'milestone' | 'passive',
  tag: string,
  age = state.player.age,
): { readonly player: GameState['player']; readonly entry: TimelineEntry } {
  const sequence = state.player.timeline.filter((row) => row.age === age).length;
  const entry = createTimelineEntry({
    age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:acting:${tag}`,
    sequence,
  });
  return {
    entry,
    player: { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) },
  };
}

const addRecord = (
  records: readonly LifeRecord[],
  record: NewLifeRecord,
  age: number,
  year: number,
): readonly LifeRecord[] => appendRecord(records, stampRecord(record, age, year, records.length));

/** The decision for the first offer on the table. */
export function actingOfferDecision(offer: Role, year: number): PendingDecision {
  const what = titleOf(offer);
  const pay = offer.fee > 0 ? `It pays ${money(offer.fee)}` : 'It doesn’t pay';
  const lead =
    offer.source === 'applied' ? `You got the part: ${what}.` : `A director wants you for ${what}.`;
  return {
    eventId: ACTING_OFFER_EVENT_ID,
    category: 'career',
    age: offer.age,
    year,
    prompt: `${lead} ${pay} for ${offer.days} ${offer.days === 1 ? 'day' : 'days'} on set.`,
    choices: [
      { id: ACCEPT, label: 'Take the part' },
      ...(offer.fee >= NEGOTIABLE_FROM && !offer.asked
        ? [{ id: REQUEST_MORE, label: 'Ask for more' }]
        : []),
      { id: DECLINE, label: 'Pass' },
    ],
    names: {},
  };
}

/** Put the first offer on the table, if there is one. Called at the end of `advanceYear`. */
export function withActingOffer(state: GameState, alive: boolean): GameState {
  const offer = state.acting.offers[0];
  if (!alive || !offer) return state;
  if (state.pending.some((row) => row.eventId === ACTING_OFFER_EVENT_ID)) return state;
  return { ...state, pending: [...state.pending, actingOfferDecision(offer, state.world.year)] };
}

/**
 * Apply to a casting call. Offer or Denied, by one draw (spec 279). A denial is a line and nothing else; an
 * offer is put on the table like any other and can be taken, bargained over or passed on.
 */
export function applyForCasting(
  state: GameState,
  callId: string,
): Result<ActingOutcome & { readonly landed: boolean }, ApplyError> {
  const age = state.player.age;
  if (age < ACTING_TIER_ROWS.local.minAge) return err('too-young');
  const acting = state.acting;
  const call = castingCalls(state).find((row) => row.role.id === callId);
  if (!call) return err('no-such-call');
  const done = appliedThisAge(acting, age);
  if (done.includes(callId)) return err('already-applied');
  if (done.length >= applicationsAllowed(acting)) return err('no-applications-left');
  if (call.role.days > freeDays(acting)) return err('booked-up');
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const landed = actUnit(seed, gen, 'cast', age, callId) < call.chance;
  const applied: Partial<ActingState> = {
    appliedAge: age,
    applied: [...done, callId],
  };
  const text = `${call.role.source === 'applied' ? 'Auditioned' : 'Applied'} for ${titleOf(call.role)}. ${
    landed ? 'They offered you the part.' : 'They went another way.'
  }`;
  const written = entryFor(state, text, landed ? 'milestone' : 'passive', `apply:${callId}`);
  const base: GameState = {
    ...state,
    player: written.player,
    acting: { ...acting, ...applied, ...(landed ? { offers: [...acting.offers, call.role] } : {}) },
  };
  const next = landed ? withActingOffer(base, true) : base;
  return ok({ state: next, entry: written.entry, landed });
}

/* -------------------------------------------------------------------------- */
/* Lessons, development and an agent                                           */
/* -------------------------------------------------------------------------- */

export type ActingError =
  | 'too-young'
  | 'already-taking'
  | 'not-taking'
  | 'no-sessions-left'
  | 'has-agent'
  | 'no-agent'
  | 'nobody-will-take-you-on';

export const ACTING_ERROR_LABELS: Readonly<Record<ActingError, string>> = {
  'too-young': "You're too young for that.",
  'already-taking': "You're already taking acting lessons.",
  'not-taking': "You aren't taking acting lessons.",
  'no-sessions-left': 'You have worked on your craft as much as the year allows.',
  'has-agent': 'You already have an agent.',
  'no-agent': "You don't have an agent.",
  'nobody-will-take-you-on': "Nobody's willing to sign you yet. Get some work behind you first.",
};

function settled(
  state: GameState,
  acting: ActingState,
  text: string,
  tag: string,
  kind: 'milestone' | 'passive' = 'passive',
  record?: NewLifeRecord,
): ActingOutcome {
  const written = entryFor(state, text, kind, tag);
  return {
    entry: written.entry,
    state: {
      ...state,
      player: {
        ...written.player,
        ...(record
          ? {
              records: addRecord(
                written.player.records,
                record,
                state.player.age,
                state.world.year,
              ),
            }
          : {}),
      },
      acting,
    },
  };
}

/** Begin lessons. From ten, one course at a time. */
export function startLessons(state: GameState): Result<ActingOutcome, ActingError> {
  if (state.player.age < LESSONS_MIN_AGE) return err('too-young');
  const acting = state.acting;
  if (acting.lessons) return err('already-taking');
  const next: ActingState = {
    ...acting,
    craft: acting.craft ?? naturalOf(state),
    lessons: { since: state.player.age, seasons: 0 },
  };
  return ok(settled(state, next, 'Signed up for acting lessons.', 'lessons:start'));
}

/** Stop. The headroom goes with them; what has been learned stays in craft until it drifts. */
export function stopLessons(state: GameState): Result<ActingOutcome, ActingError> {
  const { lessons: _stopped, ...rest } = state.acting;
  if (!state.acting.lessons) return err('not-taking');
  return ok(settled(state, rest as ActingState, 'Stopped the acting lessons.', 'lessons:stop'));
}

/** A session of character development: three a year, each worth less, never past what the actor can reach. */
export function developCharacter(state: GameState): Result<ActingOutcome, ActingError> {
  const age = state.player.age;
  if (age < DEVELOPMENT_MIN_AGE) return err('too-young');
  const acting = state.acting;
  const done = acting.devAtAge === age ? (acting.devCount ?? 0) : 0;
  if (done >= DEVELOPMENT_SESSIONS) return err('no-sessions-left');
  const craft = craftOf(state);
  const ceiling = craftCeiling(state);
  const gain = Math.max(1, Math.round((ceiling - craft) * 0.15 * (1 - done * 0.25)));
  const next: ActingState = {
    ...acting,
    craft: Math.min(ceiling, craft + gain),
    devAtAge: age,
    devCount: done + 1,
  };
  return ok(
    settled(
      state,
      next,
      'Worked on a character: the voice, the walk, what they want.',
      `dev:${done + 1}`,
    ),
  );
}

/** Sign with an agent. Wants a rung and a few credits first; an agent is a help and never the way in. */
export function signWithAgent(state: GameState): Result<ActingOutcome, ActingError> {
  const acting = state.acting;
  if (acting.agent) return err('has-agent');
  if (acting.credits < AGENT_MIN_CREDITS || tierRank(acting.tier) < tierRank(AGENT_MIN_TIER)) {
    return err('nobody-will-take-you-on');
  }
  return ok(
    settled(
      state,
      { ...acting, agent: { since: state.player.age } },
      'Signed with an agent. They take ten percent and they’ll be sending you out.',
      'agent:sign',
      'milestone',
      { category: 'career', label: 'Signed with an acting agent' },
    ),
  );
}

export function leaveAgent(state: GameState): Result<ActingOutcome, ActingError> {
  const { agent: _gone, ...rest } = state.acting;
  if (!state.acting.agent) return err('no-agent');
  return ok(settled(state, rest as ActingState, 'Parted ways with the agent.', 'agent:leave'));
}

/* -------------------------------------------------------------------------- */
/* Answering an offer                                                          */
/* -------------------------------------------------------------------------- */

export type ActingOfferError = 'no-offer' | 'no-such-choice';

export function actingChoicesOf(offer: Role): readonly string[] {
  return actingOfferDecision(offer, 0).choices.map((row) => row.id);
}

export function answerActingOffer(
  state: GameState,
  choiceId: string,
): Result<ActingOutcome, ActingOfferError> {
  const acting = state.acting;
  const offer = acting.offers[0];
  if (!offer) return err('no-offer');
  if (!actingChoicesOf(offer).includes(choiceId)) return err('no-such-choice');
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const rest = acting.offers.slice(1);
  const pending = state.pending.filter((row) => row.eventId !== ACTING_OFFER_EVENT_ID);
  const finish = (next: ActingState, text: string, kind: 'milestone' | 'passive', tag: string) => {
    const written = entryFor(state, text, kind, `${tag}:${offer.id}`, offer.age);
    const base: GameState = { ...state, player: written.player, acting: next, pending };
    return ok<ActingOutcome>({ entry: written.entry, state: withActingOffer(base, true) });
  };

  if (choiceId === DECLINE) {
    return finish({ ...acting, offers: rest }, `Passed on ${titleOf(offer)}.`, 'passive', 'pass');
  }

  if (choiceId === REQUEST_MORE) {
    const chance = Math.min(
      0.9,
      ASK_BASE +
        (acting.reputation / 100) * ASK_REPUTATION_WEIGHT +
        (acting.agent ? AGENT_ASK_BONUS : 0),
    );
    const lucky = actUnit(seed, gen, 'ask', offer.id) < chance;
    const [low, high] = ASK_GAIN;
    const raised = lucky
      ? roundFee(offer.fee * (low + actUnit(seed, gen, 'askgain', offer.id) * (high - low)))
      : offer.fee;
    const asked: Role = { ...offer, asked: true, fee: raised };
    const written = entryFor(
      state,
      lucky
        ? `You asked for more and they came up to ${money(raised)} for ${titleOf(offer)}.`
        : `You asked for more. They held at ${money(offer.fee)} for ${titleOf(offer)}.`,
      'passive',
      `ask:${offer.id}`,
      offer.age,
    );
    const base: GameState = {
      ...state,
      player: written.player,
      acting: { ...acting, offers: [asked, ...rest] },
      pending,
    };
    return ok({ entry: written.entry, state: withActingOffer(base, true) });
  }

  // Take the part.
  if (offer.days + daysOf(acting.booked) > YEAR_DAYS) {
    return finish(
      { ...acting, offers: rest },
      `Couldn't fit ${titleOf(offer)} in. The year was already full.`,
      'passive',
      'full',
    );
  }
  const booked: BookedRole = {
    id: offer.id,
    tier: offer.tier,
    billing: offer.billing,
    medium: offer.medium,
    title: offer.title,
    fee: offer.fee,
    days: offer.days,
    age: offer.age,
    bookedAge: offer.age,
  };
  const next: ActingState = {
    ...acting,
    craft: acting.craft ?? naturalOf(state),
    offers: rest,
    booked: [...acting.booked, booked],
  };
  return finish(
    next,
    `Took the part: ${titleOf(offer)}. Filming is this year.`,
    'milestone',
    'take',
  );
}

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

export interface ActingYearInput {
  /** The state at the start of the year. */
  readonly before: GameState;
  /** The school year's result, for the drama activities the character is in. */
  readonly education: EducationState;
  readonly age: number;
  readonly year: number;
  /** The household's standard of living, whole dollars. */
  readonly standard?: number;
}

export interface ActingYearLine {
  readonly kind: 'passive' | 'milestone';
  readonly text: string;
}

export interface ActingYearOutput {
  readonly acting: ActingState;
  readonly lines: readonly ActingYearLine[];
  readonly records: readonly NewLifeRecord[];
  /** Gross pay for the year, whole dollars, after an agent's share. */
  readonly pay: number;
  /** What the agent took, whole dollars. For the line, not the ledger. */
  readonly agentShare: number;
  /** The fame acting holds the character at. The caller takes the higher of this and the others. */
  readonly fame: number;
  readonly mood: number;
  /** Lessons for the year, and what they were for. */
  readonly fees: number;
  readonly feeSource: string;
}

/** A year with no acting in it at all. */
export function emptyActingYear(acting: ActingState): ActingYearOutput {
  return {
    acting,
    lines: [],
    records: [],
    pay: 0,
    agentShare: 0,
    fame: 0,
    mood: 0,
    fees: 0,
    feeSource: capitalise(LESSONS_COST_SOURCE),
  };
}

export function runActingYear(input: ActingYearInput): ActingYearOutput {
  const { before, age, year } = input;
  const acting0 = before.acting;
  const alive = before.player.alive;
  const inStage = input.education.activities.some((row) =>
    STAGE_ACTIVITIES.includes(row.activityId),
  );
  const involved =
    inStage ||
    acting0.lessons !== undefined ||
    acting0.credits > 0 ||
    acting0.booked.length > 0 ||
    acting0.craft !== undefined;
  if (!alive || (!involved && !isSeen(acting0, age) && acting0.offers.length === 0)) {
    return emptyActingYear(acting0);
  }
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const lines: ActingYearLine[] = [];
  const records: NewLifeRecord[] = [];
  let acting: ActingState = { ...acting0 };
  let mood = 0;
  let pay = 0;
  let agentShare = 0;
  let fees = 0;

  /* ---- being seen ------------------------------------------------------- */
  if (inStage) acting = { ...acting, stageYears: acting.stageYears + 1, seenAge: age };
  if (acting.lessons) acting = { ...acting, seenAge: age };

  /* ---- lessons ---------------------------------------------------------- */
  if (acting.lessons) {
    // As the arts are billed: an adult living on their own pays, and the first thing to go in a tight year is the class.
    const pays = age >= 18 && before.household.housing !== 'withFamily';
    if (pays && !affordsFee(input.standard ?? 0, LESSONS_COST)) {
      lines.push({
        kind: 'passive',
        text: 'Let the acting lessons go. The fees were the first thing to cut.',
      });
      const { lessons: _dropped, ...without } = acting;
      acting = without as ActingState;
    } else {
      if (pays) fees += LESSONS_COST;
      acting = {
        ...acting,
        lessons: { ...acting.lessons, seasons: acting.lessons.seasons + 1 },
      };
    }
  }

  /* ---- the parts that were booked: shot, judged and paid ---------------- */
  const craft = acting0.craft ?? naturalCraft(before.player.stats, before.player.talents.acting);
  let hitsHere = acting.hits;
  let risen: ActingTier | undefined;
  let credits = acting.credits;
  let reputation = acting.reputation;
  let awards = acting.awards;
  let worked = 0;
  acting0.booked.forEach((role, index) => {
    const row = ACTING_TIER_ROWS[role.tier];
    const performance =
      craft + (actUnit(seed, gen, 'perf', year, role.id) - 0.5) * PERFORMANCE_NOISE;
    const hit = performance >= row.hitLine;
    const flop = performance < row.hitLine - FLOP_MARGIN;
    const label = titleOf(role);
    const cut = acting0.agent ? Math.round(role.fee * AGENT_CUT) : 0;
    pay += role.fee - cut;
    agentShare += cut;
    credits += 1;
    worked += 1;
    reputation = Math.max(
      0,
      Math.min(
        100,
        reputation +
          Math.round(row.reputation * BILLING_REPUTATION[role.billing]) +
          (hit ? HIT_REPUTATION : 0) -
          (flop ? FLOP_REPUTATION : 0),
      ),
    );
    const fee =
      role.fee > 0
        ? ` It paid ${money(role.fee)}${cut > 0 ? `, and the agent’s share was ${money(cut)}` : ''}.`
        : '';
    if (credits === 1) {
      records.push({ category: 'career', label: `Landed a first acting role: ${role.title}` });
    }
    if (hit) {
      lines.push({ kind: 'passive', text: `Worked on ${label}. It landed.${fee}` });
      mood += 2;
      if (tierRank(role.tier) >= tierRank(acting.tier)) hitsHere += 1;
      if (tierRank(role.tier) > tierRank(acting.tier) && risen === undefined) {
        risen = role.tier;
      }
    } else if (flop) {
      lines.push({ kind: 'passive', text: `Worked on ${label}. The reviews weren’t kind.${fee}` });
      mood -= 2;
    } else {
      lines.push({ kind: 'passive', text: `Worked on ${label}. It came and went.${fee}` });
    }
    // An award, from the supporting rung up, for work that was good enough to be noticed.
    if (
      performance >= AWARD_LINE &&
      actUnit(seed, gen, 'award', year, index, role.id) < AWARD_CHANCE[role.tier]
    ) {
      awards += 1;
      reputation = Math.min(100, reputation + AWARD_REPUTATION);
      mood += AWARD_MOOD;
      lines.push({
        kind: 'milestone',
        text: `Won ${AWARD_NAMES[role.billing]} at ${AWARD_CEREMONY} for "${role.title}".`,
      });
      records.push({
        category: 'award',
        label: `${AWARD_NAMES[role.billing]}, ${AWARD_CEREMONY}, ${year}`,
      });
    }
  });
  acting = { ...acting, credits, reputation, awards, hits: hitsHere };

  /* ---- idle years, and the rung work is coming in at -------------------- */
  let idle = acting.idle;
  if (worked > 0) idle = 0;
  else if (credits > 0) idle += 1;
  if (worked === 0 && credits > 0) {
    reputation = Math.max(0, reputation - IDLE_REPUTATION);
    acting = { ...acting, reputation };
  }
  let tier = acting.tier;
  const craftNext = nextCraft(before, acting, inStage, craft);
  if (risen !== undefined || acting.hits >= HITS_TO_RISE[tier]) {
    const target = risen !== undefined ? risen : stepActingTier(tier, 1);
    if (
      tierRank(target) > tierRank(tier) &&
      notReadyFor({ ...acting, credits, reputation }, target, age, craftNext) === undefined
    ) {
      tier = target;
      acting = { ...acting, hits: 0 };
      lines.push({ kind: 'milestone', text: TIER_RISE_LINES[tier] });
      if (tierRank(tier) >= tierRank('working')) {
        records.push({
          category: 'career',
          label: `Moved up to ${ACTING_TIER_ROWS[tier].name.toLowerCase()}`,
        });
      }
    }
  }
  if (idle >= IDLE_FALL_YEARS && tierRank(tier) > 0) {
    tier = stepActingTier(tier, -1);
    idle = 1;
    acting = { ...acting, hits: 0 };
    lines.push({
      kind: 'passive',
      text: `The work dried up. You’re back to ${ACTING_TIER_ROWS[tier].name.toLowerCase()}.`,
    });
  }
  const best =
    acting0.best !== undefined && tierRank(acting0.best) >= tierRank(tier) ? acting0.best : tier;
  acting = {
    ...acting,
    tier,
    idle,
    ...(involved || credits > 0 ? { craft: craftNext } : {}),
    ...(tierRank(best) > 0 ? { best } : {}),
    ...(worked > 0 ? { seenAge: age } : {}),
    booked: [],
    applied: [],
    appliedAge: age,
  };

  /* ---- offers for the year to come -------------------------------------- */
  const raisedFor: GameState = { ...before, acting };
  const raised = raiseOffers(raisedFor, acting, age, year);
  if (raised.length > 0) {
    acting = { ...acting, offers: [...acting.offers, ...raised] };
    const first = raised[0]!;
    lines.push({
      kind: 'passive',
      text:
        raised.length === 1
          ? `A director has noticed you. There’s ${titleOf(first)} on the table.`
          : `Directors have noticed you. There are ${raised.length} parts on the table.`,
    });
  }

  return {
    acting,
    lines,
    records,
    pay,
    agentShare,
    fame: actingFameOf({ tier, reputation: acting.reputation, awards: acting.awards, idle }),
    mood,
    fees,
    feeSource: capitalise(LESSONS_COST_SOURCE),
  };
}

/** Craft after a year: drifts toward what the character is plus what work, lessons and a stage add. */
export function nextCraft(
  before: GameState,
  acting: ActingState,
  inStage: boolean,
  craft: number,
): number {
  const natural = naturalCraft(before.player.stats, before.player.talents.acting);
  const lessons = acting.lessons ? LESSONS_CRAFT : 0;
  // Work and a stage add at most CREDIT_CRAFT_CAP + 3, which is under CRAFT_HEADROOM, so the target is always
  // inside what `craftCeiling` allows and needs no cap of its own.
  const target =
    natural +
    lessons +
    Math.min(CREDIT_CRAFT_CAP, acting.credits * CREDIT_CRAFT) +
    (inStage ? 3 : 0);
  const pull = target > craft ? 0.35 : 0.1;
  return Math.max(0, Math.min(100, Math.round(craft + (target - craft) * pull)));
}

export type { Billing };
export { addRecord as addActingRecord };
