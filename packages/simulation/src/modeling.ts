/**
 * Ticket 0807 — modeling.
 *
 * The rules, over the table in `@yearafter/content`'s `modeling.ts`. A life reaches the work three ways and none
 * of them needs an agency (Payton's call):
 *
 *   - being seen: a portfolio sent round (`shootPortfolio`), or a job worked lately, puts the model in front of
 *     bookers, and a few of them ask (`runModelingYear` raises up to a handful of offers a year, more at higher rungs
 *     and with a good name, fewer as the years go by);
 *   - going: `modelCalls` is this year's open castings, `applyToModelCall` answers Offer or Denied by one hash draw;
 *   - an agency, if the model wants one: `signWithAgency`. It takes a fifth (the most New York allows), brings one more
 *     slot, a better chance of a job a rung up, and two more castings a year.
 *
 * Every job says what it is: the face of it, a featured spot or one of the group, in what kind of work, for whom, and
 * what it pays: a day rate, days, and a usage fee on top. A job that is taken is booked, shot in the year to come,
 * judged and paid then. Health and stress are not inputs (spec 280). Every draw is a hash (`modelUnit`), so no RNG
 * stream is touched.
 *
 * A model's following is what brands read. Their offers are the creators' own (0702's `sponsorOffersFor`) with the
 * model as a photo feed about fashion, answered Accept / Ask for more / Pass and paid with the next year's income.
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
  MODEL_AGENCY_ASK_BONUS,
  MODEL_AGENCY_CUT,
  MODEL_AGENCY_MIN_CREDITS,
  MODEL_AGENCY_OFFER_MULTIPLIER,
  MODEL_AGENCY_SLOT_CHANCE,
  MODEL_AGENCY_SUBMISSIONS,
  MODEL_APPLICATIONS_PER_YEAR,
  MODEL_APPLY_AGENCY_BONUS,
  MODEL_APPLY_BASE,
  MODEL_APPLY_CRAFT_WEIGHT,
  MODEL_APPLY_PLACEMENT,
  MODEL_APPLY_REPUTATION_WEIGHT,
  MODEL_ASK_BASE,
  MODEL_ASK_GAIN,
  MODEL_ASK_REPUTATION_WEIGHT,
  MODEL_AWARD_CEREMONY,
  MODEL_AWARD_CHANCE,
  MODEL_AWARD_LINE,
  MODEL_AWARD_MOOD,
  MODEL_AWARD_NAMES,
  MODEL_AWARD_REPUTATION,
  MODEL_BRAND_CATEGORY,
  MODEL_BRAND_PLATFORM,
  MODEL_CASTINGS,
  MODEL_CHANNEL_CATEGORIES,
  MODEL_CHANNEL_SHARE,
  MODEL_CLIENTS,
  MODEL_CRAFT_HEADROOM,
  MODEL_CREDIT_CRAFT,
  MODEL_CREDIT_CRAFT_CAP,
  MODEL_FLOP_MARGIN,
  MODEL_FLOP_REPUTATION,
  MODEL_FOLLOWER_CHURN,
  MODEL_HITS_TO_RISE,
  MODEL_HIT_FOLLOWERS,
  MODEL_HIT_REPUTATION,
  MODEL_IDLE_FALL_YEARS,
  MODEL_IDLE_REPUTATION,
  MODEL_LIVING_WAGE,
  MODEL_NEGOTIABLE_FROM,
  MODEL_OFFER_TIER_WEIGHTS,
  MODEL_PERFORMANCE_NOISE,
  MODEL_PLACEMENT_FOLLOWERS,
  MODEL_PLACEMENT_PHRASE,
  MODEL_PLACEMENT_REPUTATION,
  MODEL_PORTFOLIO_COST,
  MODEL_PORTFOLIO_COST_SOURCE,
  MODEL_PORTFOLIO_MIN_AGE,
  MODEL_REPUTATION_OFFER_RANGE,
  MODEL_RISE_LINES,
  MODEL_RISE_WINDOW_END,
  MODEL_SEEN_YEARS,
  MODEL_TIERS,
  MODEL_TIER_ROWS,
  MODEL_YEAR_DAYS,
  modelAgeScale,
  modelDayRate,
  modelFameOf,
  modelJobDays,
  modelJobFee,
  modelRoundFee,
  modelRoundRate,
  modelPlacementFor,
  modelTierRank,
  modelUsageFee,
  naturalModelCraft,
  stepModelTier,
  type ModelTier,
} from '@yearafter/content';
import { dollars, err, mixedUnit, ok, type Result } from '@yearafter/core';
import type { PendingDecision } from '@yearafter/events';
import {
  answerSponsor,
  sponsorOffersFor,
  type Channel,
  type SponsorAnswer,
  type SponsorOffer,
} from '@yearafter/finance';
import type { GameState } from './game-state';
import type { BookedJob, Job, ModelingState } from './modeling-state';
import { affordsFee } from './pursuits';
import { money } from './sports-core';

export const MODELING_OFFER_EVENT_ID = 'modeling.offer';
export const isModelingOfferDecision = (eventId: string): boolean =>
  eventId === MODELING_OFFER_EVENT_ID;

const ACCEPT = 'accept';
const REQUEST_MORE = 'more';
const DECLINE = 'decline';

/** The most offers waiting on an answer at once. */
export const MODEL_MAX_OFFERS = 4;

/** A [0, 1) draw about one life, keyed on the seed and a name. No RNG stream is touched. */
export const modelUnit = (
  seed: string,
  generation: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`model:${seed}:${generation}:${parts.join(':')}`);

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/* -------------------------------------------------------------------------- */
/* Reading a modeling life                                                     */
/* -------------------------------------------------------------------------- */

export const modelingOf = (state: GameState): ModelingState => state.modeling;

function naturalOf(state: GameState): number {
  return naturalModelCraft(state.player.stats);
}

/** What the character can do as a model now: what they have built, or what they are like if nothing yet. */
export const modelCraftOf = (state: GameState): number => state.modeling.craft ?? naturalOf(state);

/** What work can take craft to. */
export const modelCraftCeiling = (state: GameState): number =>
  Math.min(100, naturalOf(state) + MODEL_CRAFT_HEADROOM);

/** Whether anybody in the business has seen this model, so that they could be asked. */
export function isModelSeen(modeling: ModelingState, age: number): boolean {
  if (modeling.agency !== undefined) return true;
  return modeling.seenAge !== undefined && age - modeling.seenAge <= MODEL_SEEN_YEARS;
}

/** Modeling is the living now: a year that paid like one, lately. */
export const isModelingFullTime = (modeling: ModelingState): boolean =>
  modeling.lastPay >= MODEL_LIVING_WAGE && modeling.idle < 2;

/** The header, for somebody whose living is modeling. */
export const modelingOccupation = (modeling: ModelingState): string | undefined =>
  isModelingFullTime(modeling) ? 'Model' : undefined;

export type ModelNotReady = 'too-young' | 'few-credits' | 'craft' | 'reputation';

export const MODEL_NOT_READY_LABELS: Readonly<Record<ModelNotReady, string>> = {
  'too-young': "You're too young for that kind of work.",
  'few-credits': "You haven't worked enough yet.",
  craft: "You aren't there as a model yet.",
  reputation: "They don't know your name well enough.",
};

/** Why a model can't be given work at this rung yet, if they can't. */
export function modelNotReadyFor(
  modeling: ModelingState,
  tier: ModelTier,
  age: number,
  craft: number,
): ModelNotReady | undefined {
  const row = MODEL_TIER_ROWS[tier];
  if (age < row.minAge) return 'too-young';
  if (modeling.credits < row.minCredits) return 'few-credits';
  if (craft < row.minCraft) return 'craft';
  if (modeling.reputation < row.minReputation) return 'reputation';
  return undefined;
}

const daysOf = (rows: readonly { readonly days: number }[]): number =>
  rows.reduce((sum, row) => sum + row.days, 0);

/** The days still free in the year to come. */
export const modelFreeDays = (modeling: ModelingState): number =>
  MODEL_YEAR_DAYS - daysOf(modeling.booked) - daysOf(modeling.offers);

/** What a job pays in all, before an agency's share. */
export const jobFee = (job: Pick<Job, 'rate' | 'days' | 'usage'>): number => modelJobFee(job);

const titleOf = (job: Pick<Job, 'placement' | 'medium' | 'client'>): string =>
  `${MODEL_PLACEMENT_PHRASE[job.placement]} ${job.medium} for ${job.client}`;

/* -------------------------------------------------------------------------- */
/* Making a job                                                                */
/* -------------------------------------------------------------------------- */

export function makeModelJob(input: {
  readonly seed: string;
  readonly gen: number;
  readonly id: string;
  readonly tier: ModelTier;
  readonly source: Job['source'];
  readonly age: number;
  readonly reputation: number;
  readonly taken: ReadonlySet<string>;
}): Job {
  const { seed, gen, id, tier, age } = input;
  const row = MODEL_TIER_ROWS[tier];
  const placement = modelPlacementFor(tier, modelUnit(seed, gen, 'placement', id));
  // A name that is known gets a little more than a name that is not, up to 15% either side.
  const name = 0.85 + 0.3 * (input.reputation / 100);
  const rate = modelDayRate(tier, placement, modelUnit(seed, gen, 'rate', id), name);
  const days = modelJobDays(tier, placement, modelUnit(seed, gen, 'days', id));
  const medium = row.mediums[Math.floor(modelUnit(seed, gen, 'medium', id) * row.mediums.length)]!;
  const clients = MODEL_CLIENTS[tier];
  let index = Math.floor(modelUnit(seed, gen, 'client', id) * clients.length);
  for (let tries = 0; tries < clients.length && input.taken.has(clients[index]!); tries += 1) {
    index = (index + 1) % clients.length;
  }
  return {
    id,
    tier,
    placement,
    medium,
    client: clients[index]!,
    rate,
    days,
    usage: modelUsageFee(tier, rate, days),
    source: input.source,
    age,
  };
}

/** How much a rung's slots are scaled: a good name, an agency, and age. */
export function modelSlotScale(modeling: ModelingState, age: number): number {
  const [low, high] = MODEL_REPUTATION_OFFER_RANGE;
  const reputation = low + (high - low) * Math.min(1, modeling.reputation / 100);
  const agency = modeling.agency ? MODEL_AGENCY_OFFER_MULTIPLIER : 1;
  return reputation * agency * modelAgeScale(age);
}

/** The rung an offer or a casting is at: one below, at, or one above the standing. The window closes on the one above. */
export function modelTierDrawn(
  modeling: ModelingState,
  unit: number,
  age: number,
  craft: number,
): ModelTier {
  const [below, at] = MODEL_OFFER_TIER_WEIGHTS[modeling.agency ? 'agency' : 'plain'];
  const delta = unit < below ? -1 : unit < below + at ? 0 : 1;
  if (delta === 1 && age > MODEL_RISE_WINDOW_END) return modeling.tier;
  const wanted = stepModelTier(modeling.tier, delta);
  // A rung that wants more than the model has can't be offered. Back down to where they are.
  if (delta === 1 && modelNotReadyFor(modeling, wanted, age, craft) !== undefined) {
    return modeling.tier;
  }
  return wanted;
}

/** The chance of each slot the year has for an offer, scaled by name, agency and age, and never above 95%. */
export function modelOfferSlots(modeling: ModelingState, age: number): readonly number[] {
  const scale = modelSlotScale(modeling, age);
  const slots = [...MODEL_TIER_ROWS[modeling.tier].slots];
  if (modeling.agency) slots.push(MODEL_AGENCY_SLOT_CHANCE);
  return slots.map((chance) => Math.min(0.95, chance * scale));
}

/** Offers for the year to come: a few, by the rung, a good name, an agency and the model's age. */
function raiseOffers(
  state: GameState,
  modeling: ModelingState,
  age: number,
  year: number,
): readonly Job[] {
  if (!isModelSeen(modeling, age) || age < MODEL_TIER_ROWS.test.minAge) return [];
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const craft = modeling.craft ?? naturalOf(state);
  const slots = modelOfferSlots(modeling, age);
  const raised: Job[] = [];
  const taken = new Set<string>([
    ...modeling.booked.map((row) => row.client),
    ...modeling.offers.map((row) => row.client),
  ]);
  let days = daysOf(modeling.booked) + daysOf(modeling.offers);
  slots.forEach((chance, index) => {
    if (modeling.offers.length + raised.length >= MODEL_MAX_OFFERS) return;
    if (modelUnit(seed, gen, 'slot', year, index) >= chance) return;
    const tier = modelTierDrawn(
      modeling,
      modelUnit(seed, gen, 'offertier', year, index),
      age,
      craft,
    );
    const job = makeModelJob({
      seed,
      gen,
      id: `${age}:${index}`,
      tier,
      source: 'asked',
      age,
      reputation: modeling.reputation,
      taken,
    });
    if (days + job.days > MODEL_YEAR_DAYS) return;
    days += job.days;
    taken.add(job.client);
    raised.push(job);
  });
  return raised;
}

/* -------------------------------------------------------------------------- */
/* Castings                                                                    */
/* -------------------------------------------------------------------------- */

export interface ModelCall {
  readonly job: Job;
  /** One of 'below', 'at' or 'above' the model's standing. */
  readonly reach: 'below' | 'at' | 'above';
  /** The chance the application lands, 0–1. Shown, because it's a fact about the model's standing. */
  readonly chance: number;
  /** Already applied to this year. */
  readonly applied: boolean;
}

export type ModelApplyError =
  'too-young' | 'no-such-call' | 'already-applied' | 'no-applications-left' | 'booked-up';

export const MODEL_APPLY_ERROR_LABELS: Readonly<Record<ModelApplyError, string>> = {
  'too-young': "You're too young to go to a casting yet.",
  'no-such-call': "That casting isn't open.",
  'already-applied': "You've been to that one already.",
  'no-applications-left': "You've been to all the castings the year has room for.",
  'booked-up': "There aren't the days left in the year to take on another job.",
};

/** What a person can go to this year. */
export const modelApplicationsAllowed = (modeling: ModelingState): number =>
  MODEL_APPLICATIONS_PER_YEAR + (modeling.agency ? MODEL_AGENCY_SUBMISSIONS : 0);

const appliedThisAge = (modeling: ModelingState, age: number): readonly string[] =>
  modeling.appliedAge === age ? modeling.applied : [];

function applyChance(
  state: GameState,
  modeling: ModelingState,
  call: Job,
  reach: ModelCall['reach'],
): number {
  const chance =
    MODEL_APPLY_BASE[reach] +
    ((modelCraftOf(state) - 50) / 100) * MODEL_APPLY_CRAFT_WEIGHT +
    (modeling.agency ? MODEL_APPLY_AGENCY_BONUS : 0) +
    ((modeling.reputation - 30) / 100) * MODEL_APPLY_REPUTATION_WEIGHT +
    MODEL_APPLY_PLACEMENT[call.placement];
  return Math.max(0.03, Math.min(0.95, chance));
}

/**
 * This year's open castings. Six, at the model's rung and one either side of it, the same each time they're read.
 * A rung above the model's is listed only if they are ready for it, and not at all once the window has closed.
 */
export function modelCalls(state: GameState): readonly ModelCall[] {
  const age = state.player.age;
  const modeling = state.modeling;
  if (age < MODEL_TIER_ROWS.test.minAge) return [];
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const craft = modelCraftOf(state);
  const done = appliedThisAge(modeling, age);
  const taken = new Set<string>();
  const calls: ModelCall[] = [];
  for (let index = 0; index < MODEL_CASTINGS; index += 1) {
    const unit = modelUnit(seed, gen, 'calltier', age, index);
    const delta = unit < 0.25 ? -1 : unit < 0.75 ? 0 : 1;
    let tier = stepModelTier(modeling.tier, delta);
    if (delta === 1 && age > MODEL_RISE_WINDOW_END) tier = modeling.tier;
    if (modelNotReadyFor(modeling, tier, age, craft) !== undefined) {
      // The model's own rung wants more than they have (a fall, or lost standing): fall to the best they can do.
      tier =
        [...MODEL_TIERS]
          .reverse()
          .find((row) => modelNotReadyFor(modeling, row, age, craft) === undefined) ?? 'test';
    }
    const reach =
      modelTierRank(tier) < modelTierRank(modeling.tier)
        ? 'below'
        : tier === modeling.tier
          ? 'at'
          : 'above';
    const job = makeModelJob({
      seed,
      gen,
      id: `call:${age}:${index}`,
      tier,
      source: 'applied',
      age,
      reputation: modeling.reputation,
      taken,
    });
    taken.add(job.client);
    calls.push({
      job,
      reach,
      chance: applyChance(state, modeling, job, reach),
      applied: done.includes(job.id),
    });
  }
  return calls;
}

export interface ModelingOutcome {
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
    id: `t:${state.world.year}:modeling:${tag}`,
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

/** What a job pays, in words. */
function payWords(job: Pick<Job, 'rate' | 'days' | 'usage'>): string {
  const days = `${job.days} ${job.days === 1 ? 'day' : 'days'}`;
  if (job.rate <= 0 && job.usage <= 0) return `It doesn’t pay. It’s ${days} for the pictures.`;
  const usage = job.usage > 0 ? `, and ${money(job.usage)} for the use of the pictures` : '';
  return `It pays ${money(job.rate)} a day for ${days}${usage}, ${money(jobFee(job))} in all.`;
}

/** What can be said to an offer: take it, ask for more once if it is worth the asking, or pass. */
const choicesOf = (offer: Job): PendingDecision['choices'] => [
  { id: ACCEPT, label: 'Take the job' },
  ...(jobFee(offer) >= MODEL_NEGOTIABLE_FROM && !offer.asked
    ? [{ id: REQUEST_MORE, label: 'Ask for more' }]
    : []),
  { id: DECLINE, label: 'Pass' },
];

/** The decision for the first offer on the table. */
export function modelingOfferDecision(offer: Job, year: number): PendingDecision {
  const what = titleOf(offer);
  const lead =
    offer.source === 'applied' ? `You got the job: ${what}.` : `A booker wants you for ${what}.`;
  return {
    eventId: MODELING_OFFER_EVENT_ID,
    category: 'career',
    age: offer.age,
    year,
    prompt: `${lead} ${payWords(offer)}`,
    choices: choicesOf(offer),
    names: {},
  };
}

/** Put the first offer on the table, if there is one. Called at the end of `advanceYear`. */
export function withModelingOffer(state: GameState, alive: boolean): GameState {
  const offer = state.modeling.offers[0];
  if (!alive || !offer) return state;
  if (state.pending.some((row) => row.eventId === MODELING_OFFER_EVENT_ID)) return state;
  return { ...state, pending: [...state.pending, modelingOfferDecision(offer, state.world.year)] };
}

/**
 * Go to a casting. Offer or Denied, by one draw. A denial is a line and nothing else; an offer is put on the table
 * like any other and can be taken, bargained over or passed on.
 */
export function applyToModelCall(
  state: GameState,
  callId: string,
): Result<ModelingOutcome & { readonly landed: boolean }, ModelApplyError> {
  const age = state.player.age;
  if (age < MODEL_TIER_ROWS.test.minAge) return err('too-young');
  const modeling = state.modeling;
  const call = modelCalls(state).find((row) => row.job.id === callId);
  if (!call) return err('no-such-call');
  const done = appliedThisAge(modeling, age);
  if (done.includes(callId)) return err('already-applied');
  if (done.length >= modelApplicationsAllowed(modeling)) return err('no-applications-left');
  if (call.job.days > modelFreeDays(modeling)) return err('booked-up');
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const landed = modelUnit(seed, gen, 'cast', age, callId) < call.chance;
  const text = `Went to a casting for ${titleOf(call.job)}. ${
    landed ? 'They offered you the job.' : 'They went another way.'
  }`;
  const written = entryFor(state, text, landed ? 'milestone' : 'passive', `apply:${callId}`);
  const base: GameState = {
    ...state,
    player: written.player,
    modeling: {
      ...modeling,
      appliedAge: age,
      applied: [...done, callId],
      ...(landed ? { offers: [...modeling.offers, call.job] } : {}),
    },
  };
  const next = landed ? withModelingOffer(base, true) : base;
  return ok({ state: next, entry: written.entry, landed });
}

/* -------------------------------------------------------------------------- */
/* A portfolio and an agency                                                    */
/* -------------------------------------------------------------------------- */

export type ModelingError =
  | 'too-young'
  | 'already-shot'
  | 'cant-afford'
  | 'has-agency'
  | 'no-agency'
  | 'nobody-will-take-you-on';

export const MODELING_ERROR_LABELS: Readonly<Record<ModelingError, string>> = {
  'too-young': "You're too young for that.",
  'already-shot': "You've had pictures taken this year already.",
  'cant-afford': "You can't spare the money for the pictures this year.",
  'has-agency': 'You already have an agency.',
  'no-agency': "You don't have an agency.",
  'nobody-will-take-you-on': "Nobody's willing to sign you yet. Get some work behind you first.",
};

/** Whether the pictures are the model's own bill: an adult on their own pays; a parent pays for a child. */
export const paysOwnPortfolio = (state: GameState, age = state.player.age): boolean =>
  age >= 18 && state.household.housing !== 'withFamily';

function settled(
  state: GameState,
  modeling: ModelingState,
  text: string,
  tag: string,
  kind: 'milestone' | 'passive' = 'passive',
  record?: NewLifeRecord,
): ModelingOutcome {
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
      modeling,
    },
  };
}

/**
 * Have pictures taken and send them round. Once a year, from fourteen. It's how a model gets seen: bookers remember
 * a face for a few years. An adult on their own pays for it when the year is run; a child's parents do.
 */
export function shootPortfolio(state: GameState): Result<ModelingOutcome, ModelingError> {
  const age = state.player.age;
  if (age < MODEL_PORTFOLIO_MIN_AGE) return err('too-young');
  const modeling = state.modeling;
  if (modeling.portfolioAge === age) return err('already-shot');
  if (paysOwnPortfolio(state) && !affordsFee(state.household.standard, MODEL_PORTFOLIO_COST)) {
    return err('cant-afford');
  }
  return ok(
    settled(
      state,
      { ...modeling, craft: modeling.craft ?? naturalOf(state), seenAge: age, portfolioAge: age },
      'Had pictures taken and sent them round to the agencies and the bookers.',
      'portfolio',
    ),
  );
}

/** Sign with an agency. Wants a couple of jobs first; an agency is a help and never the way in. */
export function signWithAgency(state: GameState): Result<ModelingOutcome, ModelingError> {
  const modeling = state.modeling;
  if (modeling.agency) return err('has-agency');
  if (modeling.credits < MODEL_AGENCY_MIN_CREDITS) return err('nobody-will-take-you-on');
  return ok(
    settled(
      state,
      { ...modeling, agency: { since: state.player.age } },
      `Signed with an agency. They take ${Math.round(MODEL_AGENCY_CUT * 100)} percent and they’ll be sending you out.`,
      'agency:sign',
      'milestone',
      { category: 'career', label: 'Signed with a modeling agency' },
    ),
  );
}

export function leaveAgency(state: GameState): Result<ModelingOutcome, ModelingError> {
  const { agency: _gone, ...rest } = state.modeling;
  if (!state.modeling.agency) return err('no-agency');
  return ok(settled(state, rest as ModelingState, 'Parted ways with the agency.', 'agency:leave'));
}

/* -------------------------------------------------------------------------- */
/* Answering an offer                                                          */
/* -------------------------------------------------------------------------- */

export type ModelingOfferError = 'no-offer' | 'no-such-choice';

export const modelingChoicesOf = (offer: Job): readonly string[] =>
  choicesOf(offer).map((row) => row.id);

/** The chance an ask for more lands: a name helps, and so does an agency; never over 90%. */
export const modelAskChance = (modeling: ModelingState): number =>
  Math.min(
    0.9,
    MODEL_ASK_BASE +
      (modeling.reputation / 100) * MODEL_ASK_REPUTATION_WEIGHT +
      (modeling.agency ? MODEL_AGENCY_ASK_BONUS : 0),
  );

export function answerModelingOffer(
  state: GameState,
  choiceId: string,
): Result<ModelingOutcome, ModelingOfferError> {
  const modeling = state.modeling;
  const offer = modeling.offers[0];
  if (!offer) return err('no-offer');
  if (!modelingChoicesOf(offer).includes(choiceId)) return err('no-such-choice');
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const rest = modeling.offers.slice(1);
  const pending = state.pending.filter((row) => row.eventId !== MODELING_OFFER_EVENT_ID);
  const finish = (
    next: ModelingState,
    text: string,
    kind: 'milestone' | 'passive',
    tag: string,
  ) => {
    const written = entryFor(state, text, kind, `${tag}:${offer.id}`, offer.age);
    const base: GameState = { ...state, player: written.player, modeling: next, pending };
    return ok<ModelingOutcome>({ entry: written.entry, state: withModelingOffer(base, true) });
  };

  if (choiceId === DECLINE) {
    return finish({ ...modeling, offers: rest }, `Passed on ${titleOf(offer)}.`, 'passive', 'pass');
  }

  if (choiceId === REQUEST_MORE) {
    const lucky = modelUnit(seed, gen, 'ask', offer.id) < modelAskChance(modeling);
    const [low, high] = MODEL_ASK_GAIN;
    const gain = low + modelUnit(seed, gen, 'askgain', offer.id) * (high - low);
    const rate = lucky ? modelRoundRate(offer.rate * gain) : offer.rate;
    const usage = lucky ? modelRoundFee(offer.usage * gain) : offer.usage;
    const asked: Job = { ...offer, asked: true, rate, usage };
    const written = entryFor(
      state,
      lucky
        ? `You asked for more and they came up to ${money(jobFee(asked))} for ${titleOf(offer)}.`
        : `You asked for more. They held at ${money(jobFee(offer))} for ${titleOf(offer)}.`,
      'passive',
      `ask:${offer.id}`,
      offer.age,
    );
    const base: GameState = {
      ...state,
      player: written.player,
      modeling: { ...modeling, offers: [asked, ...rest] },
      pending,
    };
    return ok({ entry: written.entry, state: withModelingOffer(base, true) });
  }

  // Take the job.
  if (offer.days + daysOf(modeling.booked) > MODEL_YEAR_DAYS) {
    return finish(
      { ...modeling, offers: rest },
      `Couldn’t fit ${titleOf(offer)} in. The year was already full.`,
      'passive',
      'full',
    );
  }
  const booked: BookedJob = {
    id: offer.id,
    tier: offer.tier,
    placement: offer.placement,
    medium: offer.medium,
    client: offer.client,
    rate: offer.rate,
    days: offer.days,
    usage: offer.usage,
    age: offer.age,
    bookedAge: offer.age,
  };
  const next: ModelingState = {
    ...modeling,
    craft: modeling.craft ?? naturalOf(state),
    offers: rest,
    booked: [...modeling.booked, booked],
  };
  return finish(
    next,
    `Took the job: ${titleOf(offer)}. The shoot is this year.`,
    'milestone',
    'take',
  );
}

/* -------------------------------------------------------------------------- */
/* Brand deals: the creators' sponsor rules, with the model as the feed         */
/* -------------------------------------------------------------------------- */

/** The model as the channel the 0702 sponsor rules read: a photo feed about fashion. Only the audience and the answers matter. */
export function modelChannel(modeling: ModelingState): Channel {
  return {
    id: 'modeling',
    platformId: MODEL_BRAND_PLATFORM,
    categoryId: MODEL_BRAND_CATEGORY,
    name: 'Modeling',
    since: 0,
    audience: modeling.followers,
    peak: modeling.peak,
    effort: 'regular',
    luck: 0,
    earned: dollars(0),
    answered: modeling.brandAnswered,
  };
}

/** Brands that want the model this year. Derived: nothing but the answers is saved. */
export function modelBrandOffers(state: GameState): readonly SponsorOffer[] {
  const modeling = state.modeling;
  if (modeling.credits === 0) return [];
  return sponsorOffersFor({
    seed: state.rng.getSeed(),
    year: state.world.year,
    channel: modelChannel(modeling),
    agent: modeling.agency !== undefined,
  });
}

export type ModelBrandError = { readonly kind: 'notOffered' };

/** Answer a brand: accept, ask for more, or pass. What's agreed is paid with the next year's income. */
export function answerModelBrand(
  state: GameState,
  offerId: string,
  answer: SponsorAnswer,
): Result<ModelingOutcome, ModelBrandError> {
  const offer = modelBrandOffers(state).find((row) => row.id === offerId);
  if (offer === undefined) return err({ kind: 'notOffered' });
  const modeling = state.modeling;
  const result = answerSponsor({
    seed: state.rng.getSeed(),
    channel: modelChannel(modeling),
    offer,
    answer,
  });
  const agreed = result.outcome === 'taken' || result.outcome === 'raised';
  const next: ModelingState = {
    ...modeling,
    followers: result.channel.audience,
    brandOwed: modeling.brandOwed + (agreed ? result.pay : 0),
    brandAnswered: result.channel.answered ?? [],
  };
  const text =
    result.outcome === 'taken'
      ? `Signed a brand deal with ${offer.brand}, for ${money(result.pay)}.`
      : result.outcome === 'raised'
        ? `You asked ${offer.brand} for more and they came up to ${money(result.pay)}.`
        : result.outcome === 'walked'
          ? `You asked ${offer.brand} for more and they walked away.`
          : `Turned down ${offer.brand}.`;
  return ok(settled(state, next, text, `brand:${offerId}`));
}

/** The work brings people to a fashion or lifestyle channel the character runs: a share of the people who found the model. */
export function withModelAudience(channels: readonly Channel[], fans: number): readonly Channel[] {
  const added = Math.round(fans * MODEL_CHANNEL_SHARE);
  if (added <= 0) return channels;
  return channels.map((channel) =>
    MODEL_CHANNEL_CATEGORIES.includes(channel.categoryId)
      ? {
          ...channel,
          audience: channel.audience + added,
          peak: Math.max(channel.peak, channel.audience + added),
        }
      : channel,
  );
}

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

export interface ModelingYearInput {
  /** The state at the start of the year. */
  readonly before: GameState;
  readonly age: number;
  readonly year: number;
}

export interface ModelingYearLine {
  readonly kind: 'passive' | 'milestone';
  readonly text: string;
}

export interface ModelingYearOutput {
  readonly modeling: ModelingState;
  readonly lines: readonly ModelingYearLine[];
  readonly records: readonly NewLifeRecord[];
  /** Gross pay for the year, whole dollars, after an agency's share: the jobs and the brand deals. */
  readonly pay: number;
  /** Of `pay`, what brand deals paid, after the agency's share. */
  readonly brandPay: number;
  /** What the agency took, whole dollars. For the line, not the ledger. */
  readonly agencyShare: number;
  /** The fame modeling holds the character at. The caller takes the higher of this and the others. */
  readonly fame: number;
  readonly mood: number;
  /** The portfolio, for the year, and what it was for. */
  readonly fees: number;
  readonly feeSource: string;
  /** New people who found the model's work this year, for a channel the character runs. */
  readonly fans: number;
}

/** A year with no modeling in it at all. */
export function emptyModelingYear(modeling: ModelingState): ModelingYearOutput {
  return {
    modeling,
    lines: [],
    records: [],
    pay: 0,
    brandPay: 0,
    agencyShare: 0,
    fame: 0,
    mood: 0,
    fees: 0,
    feeSource: capitalise(MODEL_PORTFOLIO_COST_SOURCE),
    fans: 0,
  };
}

export function runModelingYear(input: ModelingYearInput): ModelingYearOutput {
  const { before, age, year } = input;
  const m0 = before.modeling;
  // Craft is set the first time modeling matters (a portfolio, a job), so it says whether this life is in it at all.
  if (!before.player.alive || m0.craft === undefined) return emptyModelingYear(m0);
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const lines: ModelingYearLine[] = [];
  const records: NewLifeRecord[] = [];
  let modeling: ModelingState = { ...m0 };
  let mood = 0;
  let pay = 0;
  let agencyShare = 0;
  let fans = 0;
  let fees = 0;

  /* ---- the portfolio, if one was shot this year ------------------------- */
  if (m0.portfolioAge === before.player.age && paysOwnPortfolio(before, before.player.age)) {
    fees += MODEL_PORTFOLIO_COST;
  }

  /* ---- the jobs that were booked: shot, judged and paid ----------------- */
  const craft = m0.craft;
  let hitsHere = modeling.hits;
  let risen: ModelTier | undefined;
  let credits = modeling.credits;
  let reputation = modeling.reputation;
  let awards = modeling.awards;
  const worked = m0.booked.length > 0;
  m0.booked.forEach((job, index) => {
    const row = MODEL_TIER_ROWS[job.tier];
    const performance =
      craft + (modelUnit(seed, gen, 'perf', year, job.id) - 0.5) * MODEL_PERFORMANCE_NOISE;
    const hit = performance >= row.hitLine;
    const flop = performance < row.hitLine - MODEL_FLOP_MARGIN;
    const label = titleOf(job);
    const fee = jobFee(job);
    const cut = m0.agency ? Math.round(fee * MODEL_AGENCY_CUT) : 0;
    pay += fee - cut;
    agencyShare += cut;
    credits += 1;
    reputation = Math.max(
      0,
      Math.min(
        100,
        reputation +
          Math.round(row.reputation * MODEL_PLACEMENT_REPUTATION[job.placement]) +
          (hit ? MODEL_HIT_REPUTATION : 0) -
          (flop ? MODEL_FLOP_REPUTATION : 0),
      ),
    );
    fans += Math.round(
      row.followers * MODEL_PLACEMENT_FOLLOWERS[job.placement] * (hit ? MODEL_HIT_FOLLOWERS : 1),
    );
    const paid =
      fee > 0
        ? ` It paid ${money(fee)}${cut > 0 ? `, and the agency’s share was ${money(cut)}` : ''}.`
        : '';
    if (credits === 1) {
      records.push({ category: 'career', label: `Booked a first modeling job: ${job.client}` });
    }
    if (hit) {
      lines.push({ kind: 'passive', text: `Shot ${label}. The client loved it.${paid}` });
      mood += 2;
      if (modelTierRank(job.tier) >= modelTierRank(modeling.tier)) hitsHere += 1;
      if (modelTierRank(job.tier) > modelTierRank(modeling.tier) && risen === undefined) {
        risen = job.tier;
      }
    } else if (flop) {
      lines.push({
        kind: 'passive',
        text: `Shot ${label}. They weren’t happy with the pictures.${paid}`,
      });
      mood -= 2;
    } else {
      lines.push({ kind: 'passive', text: `Shot ${label}. It came and went.${paid}` });
    }
    // An award, from the editorial rung up, for work that was good enough to be noticed.
    if (
      performance >= MODEL_AWARD_LINE &&
      modelUnit(seed, gen, 'award', year, index, job.id) < MODEL_AWARD_CHANCE[job.tier]
    ) {
      awards += 1;
      reputation = Math.min(100, reputation + MODEL_AWARD_REPUTATION);
      mood += MODEL_AWARD_MOOD;
      lines.push({
        kind: 'milestone',
        text: `Won ${MODEL_AWARD_NAMES[job.placement]} at ${MODEL_AWARD_CEREMONY} for the work with ${job.client}.`,
      });
      records.push({
        category: 'award',
        label: `${MODEL_AWARD_NAMES[job.placement]}, ${MODEL_AWARD_CEREMONY}, ${year}`,
      });
    }
  });
  modeling = { ...modeling, credits, reputation, awards, hits: hitsHere };

  /* ---- brand deals agreed last year, paid now --------------------------- */
  let brandPay = 0;
  if (m0.brandOwed > 0) {
    const cut = m0.agency ? Math.round(m0.brandOwed * MODEL_AGENCY_CUT) : 0;
    brandPay = m0.brandOwed - cut;
    agencyShare += cut;
    pay += brandPay;
    lines.push({
      kind: 'passive',
      text: `The brand deals paid ${money(brandPay)}${cut > 0 ? `, after the agency’s ${money(cut)}` : ''}.`,
    });
  }

  /* ---- idle years, and the rung work is coming in at -------------------- */
  let idle = modeling.idle;
  if (worked) idle = 0;
  else if (credits > 0) {
    idle += 1;
    reputation = Math.max(0, reputation - MODEL_IDLE_REPUTATION);
    modeling = { ...modeling, reputation };
  }
  let tier = modeling.tier;
  const craftNext = nextModelCraft(before, modeling, craft);
  if (risen !== undefined || modeling.hits >= MODEL_HITS_TO_RISE[tier]) {
    const target = risen !== undefined ? risen : stepModelTier(tier, 1);
    if (
      modelTierRank(target) > modelTierRank(tier) &&
      modelNotReadyFor({ ...modeling, credits, reputation }, target, age, craftNext) === undefined
    ) {
      tier = target;
      modeling = { ...modeling, hits: 0 };
      lines.push({ kind: 'milestone', text: MODEL_RISE_LINES[tier] });
      if (modelTierRank(tier) >= modelTierRank('commercial')) {
        records.push({
          category: 'career',
          label: `Moved up to ${MODEL_TIER_ROWS[tier].name.toLowerCase()}`,
        });
      }
    }
  }
  if (idle >= MODEL_IDLE_FALL_YEARS && modelTierRank(tier) > 0) {
    tier = stepModelTier(tier, -1);
    idle = 1;
    modeling = { ...modeling, hits: 0 };
    lines.push({
      kind: 'passive',
      text: `The work dried up. You’re back to ${MODEL_TIER_ROWS[tier].name.toLowerCase()}.`,
    });
  }
  const best = MODEL_TIERS[Math.max(modelTierRank(m0.best ?? 'test'), modelTierRank(tier))]!;
  const followers = Math.round(m0.followers * (1 - MODEL_FOLLOWER_CHURN)) + fans;
  modeling = {
    ...modeling,
    tier,
    idle,
    craft: craftNext,
    ...(modelTierRank(best) > 0 ? { best } : {}),
    ...(worked ? { seenAge: age } : {}),
    followers,
    peak: Math.max(m0.peak, followers),
    lastPay: pay,
    brandOwed: 0,
    brandAnswered: [],
    booked: [],
    applied: [],
    appliedAge: age,
  };

  /* ---- offers for the year to come -------------------------------------- */
  const raised = raiseOffers({ ...before, modeling }, modeling, age, year);
  if (raised.length > 0) {
    modeling = { ...modeling, offers: [...modeling.offers, ...raised] };
    const first = raised[0]!;
    lines.push({
      kind: 'passive',
      text:
        raised.length === 1
          ? `A booker has noticed you. There’s ${titleOf(first)} on the table.`
          : `Bookers have noticed you. There are ${raised.length} jobs on the table.`,
    });
  }

  return {
    modeling,
    lines,
    records,
    pay,
    brandPay,
    agencyShare,
    fame: modelFameOf({
      tier,
      reputation: modeling.reputation,
      awards: modeling.awards,
      idle,
    }),
    mood,
    fees,
    feeSource: capitalise(MODEL_PORTFOLIO_COST_SOURCE),
    fans,
  };
}

/** Craft after a year: drifts toward what the character is plus what work adds. A look that changes moves it. */
export function nextModelCraft(before: GameState, modeling: ModelingState, craft: number): number {
  const natural = naturalOf(before);
  // Work adds at most MODEL_CREDIT_CRAFT_CAP, which is under MODEL_CRAFT_HEADROOM, so the target is always inside
  // what `modelCraftCeiling` allows and needs no cap of its own.
  const target = natural + Math.min(MODEL_CREDIT_CRAFT_CAP, modeling.credits * MODEL_CREDIT_CRAFT);
  // Up by a third of the gap (0.35), down by a tenth: the larger of the two steps, whichever way the gap points.
  const gap = target - craft;
  return Math.max(0, Math.min(100, Math.round(craft + Math.max(gap * 0.35, gap * 0.1))));
}

export { addRecord as addModelingRecord };
