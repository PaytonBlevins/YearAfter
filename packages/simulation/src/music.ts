/**
 * Ticket 0806 — music.
 *
 * The rules, over the table in `@yearafter/content`'s `music.ts`. A musician's career is releases and the people who
 * hear them (Payton's call): each year the artist plans what to put out and whether to go on the road, and
 * `runMusicYear` makes the records, tours, counts the monthly listeners and pays what streams, a label and the
 * road pay. Nobody has to have a label, a manager or an agent: self-releasing is always possible, and each of them is
 * a help and never the way in.
 *
 *   - releases: a single, an EP or an album, under the spec's yearly caps (15, 3 and 2) and the 52 weeks a year has
 *     for releases and tours together. A label that has signed the artist commits the year to a few releases of its own.
 *   - craft sets how good a release is; the rung it lands at sets what counts as a hit; the people who hear it are
 *     the career. Back catalogue is what keeps listening up, so an artist who stops still earns.
 *   - labels: one calls an artist who has been noticed, or the artist sends a demo, once a year. A deal pays an
 *     advance, brings reach and takes most of the streaming money until it is paid back. Most are never paid back.
 *   - collaborations reuse the creator rules of 0704 as they are; a manager (15%, faster growth) and an agent (10% of
 *     tours and advances, more calls and cheaper features) are the creator's own, shared.
 *
 * Every draw is a hash (`musUnit`), so no RNG stream is touched.
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
  CATALOGUE_FULL,
  LISTENER_CAP,
  OVERSHOOT_FALL,
  VIRAL_CEILING,
  audienceCeiling,
  CATALOGUE_WEIGHT,
  DEMO_BASE,
  DEMO_CHANCE_RANGE,
  DEMO_CRAFT_WEIGHT,
  DEMO_REPUTATION_WEIGHT,
  DIY_COST,
  DISCOVER,
  DISTRIBUTOR_CUT,
  GROW,
  HIT_LINE,
  IDLE_DECAY,
  KIND_NAME,
  KIND_NOUN,
  LABEL_COST,
  LABEL_MIN_CRAFT,
  LABEL_NAMES,
  LABEL_REACH,
  LABEL_ROWS,
  MIN_TOUR_LISTENERS,
  MUSIC_ASK_ADVANCE_GAIN,
  MUSIC_ASK_BASE,
  MUSIC_ASK_REPRESENTED_BONUS,
  MUSIC_ASK_REPUTATION_WEIGHT,
  MUSIC_ASK_ROYALTY_GAIN,
  MUSIC_AWARD_CEREMONY,
  MUSIC_AWARD_LINE,
  MUSIC_AWARD_MOOD,
  MUSIC_AWARD_NAMES,
  MUSIC_AWARD_REPUTATION,
  MUSIC_CHANNEL_SHARE,
  MUSIC_FLOP_MARGIN,
  MUSIC_FLOP_REPUTATION,
  MUSIC_HEADROOM,
  MUSIC_HIT_REPUTATION,
  MUSIC_IDLE_REPUTATION,
  MUSIC_LESSONS_COST,
  MUSIC_LESSONS_CRAFT,
  MUSIC_LESSONS_MIN_AGE,
  MUSIC_LESSONS_SOURCE,
  MUSIC_LIVING_WAGE,
  MUSIC_RELEASE_CRAFT,
  MUSIC_RELEASE_CRAFT_CAP,
  MUSIC_RELEASE_MIN_AGE,
  MUSIC_RISE_LINES,
  MUSIC_ROYALTY_CAP,
  MUSIC_STAGE_CRAFT,
  MUSIC_TIER_ROWS,
  MUSIC_TOUR_MIN_AGE,
  QUALITY_NOISE,
  RELEASE_CAPS,
  RELEASE_KINDS,
  RELEASE_TITLES,
  RELEASE_WEEKS,
  RETAIN_BASE,
  RETAIN_CATALOGUE,
  SATURATION,
  STREAMS_PER_LISTENER,
  STREAM_PAYOUT,
  TOUR_FANS,
  VIRAL_BASE,
  VIRAL_FROM,
  VIRAL_MULTIPLIER,
  VIRAL_PER_POINT,
  YEAR_WEEKS,
  musicCraft,
  musicFameOf,
  qualityFactor,
  stepMusicTier,
  tierFor,
  tierRankOf,
  tourFor,
  type LabelKind,
  type MusicTier,
  type ReleaseKind,
  type TourPlan,
} from '@yearafter/content';
import { dollars, err, mixedUnit, ok, type Result } from '@yearafter/core';
import type { EducationState } from '@yearafter/education';
import type { PendingDecision } from '@yearafter/events';
import {
  AGENT_CUT as REP_AGENT_CUT,
  AGENT_OFFER_CHANCE,
  MANAGER_CUT,
  MANAGER_GROWTH,
  answerCollab,
  collabOffersFor,
  post,
  type Channel,
  type CollabOffer,
} from '@yearafter/finance';
import type { GameState } from './game-state';
import type { LabelDeal, LabelOffer, MusicPlan, MusicState } from './music-state';
import { EMPTY_PLAN } from './music-state';
import { friendsOf } from './network';
import { affordsFee } from './pursuits';
import { money } from './sports-core';

export const MUSIC_OFFER_EVENT_ID = 'music.offer';
export const isMusicOfferDecision = (eventId: string): boolean => eventId === MUSIC_OFFER_EVENT_ID;

const ACCEPT = 'accept';
const REQUEST_MORE = 'more';
const DECLINE = 'decline';

/** The activities that put a musician in front of people. */
export const MUSIC_STAGE_ACTIVITIES: readonly string[] = [
  'act.band',
  'act.choir',
  'act.jazz-band',
  'act.adult.choir',
  'act.adult.band',
];

/** A [0, 1) draw about one life, keyed on the seed and a name. No RNG stream is touched. */
export const musUnit = (
  seed: string,
  generation: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`mus:${seed}:${generation}:${parts.join(':')}`);

/** How lucky this life is in the music business: fixed for the life, 0–1. */
export const musicLuck = (seed: string, generation: number): number =>
  musUnit(seed, generation, 'luck');

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

/* -------------------------------------------------------------------------- */
/* Reading a musician                                                           */
/* -------------------------------------------------------------------------- */

export const musicOf = (state: GameState): MusicState => state.music;

function naturalOf(state: GameState): number {
  return musicCraft(state.player.stats, state.player.talents.music);
}

/** What the character can do as a musician now: what they have built, or what they are like if nothing yet. */
export const musicCraftOf = (state: GameState): number => state.music.craft ?? naturalOf(state);

/** What work, lessons and releases can take craft to. */
export function musicCraftCeiling(state: GameState): number {
  const lessons = state.music.lessons ? MUSIC_LESSONS_CRAFT : 0;
  return Math.min(100, naturalOf(state) + MUSIC_HEADROOM + lessons);
}

export const musicTierOf = (music: MusicState): MusicTier => tierFor(music.listeners);

export const totalReleased = (music: MusicState): number =>
  music.released.single + music.released.ep + music.released.lp;

/** Music is the living now: a year that paid like one, lately. */
export const isMusicFullTime = (music: MusicState): boolean =>
  music.lastPay >= MUSIC_LIVING_WAGE && music.idle < 2;

/** The header, for somebody whose living is music. */
export const musicOccupation = (music: MusicState): string | undefined =>
  isMusicFullTime(music) ? 'Musician' : undefined;

/** What a label has committed the year to. */
export const committedReleases = (music: MusicState): Readonly<Record<ReleaseKind, number>> =>
  music.deal ? LABEL_ROWS[music.deal.kind].commit : { single: 0, ep: 0, lp: 0 };

const weeksOf = (counts: Readonly<Record<ReleaseKind, number>>): number =>
  RELEASE_KINDS.reduce((sum, kind) => sum + counts[kind] * RELEASE_WEEKS[kind], 0);

const withCommitted = (music: MusicState, plan: MusicPlan): Record<ReleaseKind, number> => {
  const committed = committedReleases(music);
  return {
    single: committed.single + plan.single,
    ep: committed.ep + plan.ep,
    lp: committed.lp + plan.lp,
  };
};

/** What the road would be, read now: the same as the year would run it if nothing else changed. */
export function plannedTour(state: GameState): TourPlan | undefined {
  const music = state.music;
  if (state.player.age < MUSIC_TOUR_MIN_AGE || music.listeners < MIN_TOUR_LISTENERS) {
    return undefined;
  }
  return tourFor(musicTierOf(music), music.listeners, musicCraftOf(state));
}

/** Weeks the year's plan uses, counting what a label has committed and the tour if one is planned. */
export function weeksUsed(state: GameState, plan: MusicPlan = state.music.plan): number {
  const tour = plan.tour ? plannedTour(state) : undefined;
  return weeksOf(withCommitted(state.music, plan)) + (tour?.weeks ?? 0);
}

/** What the self-released part of the plan costs, whole dollars. */
export const planCost = (plan: MusicPlan): number =>
  RELEASE_KINDS.reduce((sum, kind) => sum + plan[kind] * DIY_COST[kind], 0);

const cashOf = (state: GameState): number => Math.floor(Number(state.player.cash) / 100);

const titleOf = (title: string): string => `"${title}"`;

/* -------------------------------------------------------------------------- */
/* Planning the year                                                            */
/* -------------------------------------------------------------------------- */

export type PlanError =
  'too-young' | 'over-cap' | 'no-weeks' | 'no-money' | 'cannot-tour' | 'no-such-count';

export const PLAN_ERROR_LABELS: Readonly<Record<PlanError, string>> = {
  'too-young': "You're too young to put music out yet.",
  'over-cap': 'A year only has room for so many of those.',
  'no-weeks': "There aren't the weeks left in the year for that.",
  'no-money': "You can't afford to record that.",
  'cannot-tour': "You haven't got the audience to tour for yet.",
  'no-such-count': "That isn't a number of releases.",
};

const withPlan = (state: GameState, plan: MusicPlan): GameState => ({
  ...state,
  music: { ...state.music, plan },
});

/** Set how many of one kind to put out in the year to come, on top of what a label has committed. */
export function planReleases(
  state: GameState,
  kind: ReleaseKind,
  count: number,
): Result<GameState, PlanError> {
  if (state.player.age < MUSIC_RELEASE_MIN_AGE) return err('too-young');
  if (!Number.isInteger(count) || count < 0) return err('no-such-count');
  const music = state.music;
  const plan: MusicPlan = { ...music.plan, [kind]: count };
  if (committedReleases(music)[kind] + count > RELEASE_CAPS[kind]) return err('over-cap');
  if (count > music.plan[kind]) {
    if (weeksUsed(state, plan) > YEAR_WEEKS) return err('no-weeks');
    if (planCost(plan) > cashOf(state)) return err('no-money');
  }
  return ok(withPlan(state, plan));
}

/** Go on the road in the year to come, or not. */
export function planTour(state: GameState, on: boolean): Result<GameState, PlanError> {
  const music = state.music;
  if (!on) return ok(withPlan(state, { ...music.plan, tour: false }));
  const tour = plannedTour(state);
  if (tour === undefined) return err('cannot-tour');
  const plan: MusicPlan = { ...music.plan, tour: true };
  if (weeksUsed(state, plan) > YEAR_WEEKS) return err('no-weeks');
  return ok(withPlan(state, plan));
}

/* -------------------------------------------------------------------------- */
/* Writing it down                                                              */
/* -------------------------------------------------------------------------- */

export interface MusicOutcome {
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
    id: `t:${state.world.year}:music:${tag}`,
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

function settled(
  state: GameState,
  music: MusicState,
  text: string,
  tag: string,
  kind: 'milestone' | 'passive' = 'passive',
  record?: NewLifeRecord,
): MusicOutcome {
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
      music,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Lessons                                                                      */
/* -------------------------------------------------------------------------- */

export type MusicError =
  | 'too-young'
  | 'already-taking'
  | 'not-taking'
  | 'no-release-yet'
  | 'has-deal'
  | 'offer-waiting'
  | 'demo-sent'
  | 'not-ready';

export const MUSIC_ERROR_LABELS: Readonly<Record<MusicError, string>> = {
  'too-young': "You're too young for that.",
  'already-taking': "You're already taking music lessons.",
  'not-taking': "You aren't taking music lessons.",
  'no-release-yet': "You haven't put anything out yet. They'd have nothing to listen to.",
  'has-deal': "You're signed already.",
  'offer-waiting': 'There is a deal on the table already.',
  'demo-sent': "You've sent a demo this year already.",
  'not-ready': "Nobody's heard enough of you yet to take a demo seriously.",
};

/** Begin lessons. From seven, one course at a time. */
export function startMusicLessons(state: GameState): Result<MusicOutcome, MusicError> {
  if (state.player.age < MUSIC_LESSONS_MIN_AGE) return err('too-young');
  const music = state.music;
  if (music.lessons) return err('already-taking');
  const next: MusicState = {
    ...music,
    craft: music.craft ?? naturalOf(state),
    lessons: { since: state.player.age, seasons: 0 },
  };
  return ok(settled(state, next, 'Signed up for music lessons.', 'lessons:start'));
}

/** Stop. The headroom goes with them; what has been learned stays in craft until it drifts. */
export function stopMusicLessons(state: GameState): Result<MusicOutcome, MusicError> {
  const { lessons: _stopped, ...rest } = state.music;
  if (!state.music.lessons) return err('not-taking');
  return ok(settled(state, rest as MusicState, 'Stopped the music lessons.', 'lessons:stop'));
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                       */
/* -------------------------------------------------------------------------- */

const roundAdvance = (value: number): number => {
  const step = value < 10_000 ? 100 : value < 1_000_000 ? 1_000 : 10_000;
  return Math.round(value / step) * step;
};

/** The advance range a label of this kind pays at this rung: the highest row at or under it, else the lowest. */
function advanceRange(kind: LabelKind, tier: MusicTier): readonly [number, number] {
  const rows = LABEL_ROWS[kind].advance;
  let found: readonly [number, number] | undefined;
  for (let rank = tierRankOf(tier); rank >= 0 && found === undefined; rank -= 1) {
    found = rows[stepMusicTier('local', rank)];
  }
  if (found !== undefined) return found;
  for (let rank = 0; rank < 6; rank += 1) {
    const row = rows[stepMusicTier('local', rank)];
    if (row) return row;
  }
  return [0, 0];
}

function makeOffer(
  state: GameState,
  age: number,
  source: LabelOffer['source'],
  tier: MusicTier,
): LabelOffer {
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const key = `${age}:${source}`;
  const kind: LabelKind =
    musUnit(seed, gen, 'labelkind', key) < MUSIC_TIER_ROWS[tier].majorShare ? 'major' : 'indie';
  const [low, high] = advanceRange(kind, tier);
  const names = LABEL_NAMES[kind];
  const row = LABEL_ROWS[kind];
  return {
    id: `lbl:${age}`,
    kind,
    label: names[Math.floor(musUnit(seed, gen, 'labelname', key) * names.length) % names.length]!,
    advance: roundAdvance(low * (high / Math.max(1, low)) ** musUnit(seed, gen, 'advance', key)),
    royalty: row.royalty,
    term: row.term,
    age,
    source,
  };
}

const percent = (share: number): string => `${Math.round(share * 100)}%`;

const commitText = (kind: LabelKind): string => {
  const commit = LABEL_ROWS[kind].commit;
  const parts = RELEASE_KINDS.filter((name) => commit[name] > 0).map((name) =>
    commit[name] === 1 ? KIND_NOUN[name] : `${commit[name]} ${KIND_NAME[name]}s`,
  );
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
};

/** The decision for a deal on the table. */
export function musicOfferDecision(offer: LabelOffer, year: number): PendingDecision {
  const lead =
    offer.source === 'demo'
      ? `${offer.label} liked the demo.`
      : `${offer.label} has been listening to you.`;
  return {
    eventId: MUSIC_OFFER_EVENT_ID,
    category: 'career',
    age: offer.age,
    year,
    prompt:
      `${lead} They'd sign you for ${offer.term} years: ${money(offer.advance)} up front, ` +
      `${percent(offer.royalty)} of what streams earn once that and their costs are paid back, ` +
      `and ${commitText(offer.kind)} a year on their schedule. Most deals never pay back.`,
    choices: [
      { id: ACCEPT, label: 'Sign' },
      ...(offer.asked ? [] : [{ id: REQUEST_MORE, label: 'Ask for more' }]),
      { id: DECLINE, label: 'Pass' },
    ],
    names: {},
  };
}

/** Put a deal on the table, if there is one. Called at the end of `advanceYear`. */
export function withMusicOffer(state: GameState, alive: boolean): GameState {
  const offer = state.music.offer;
  if (!alive || !offer) return state;
  if (state.pending.some((row) => row.eventId === MUSIC_OFFER_EVENT_ID)) return state;
  return { ...state, pending: [...state.pending, musicOfferDecision(offer, state.world.year)] };
}

/** The chance a demo lands: craft, a name and the best a release has been. */
export function demoChance(state: GameState): number {
  const music = state.music;
  const chance =
    DEMO_BASE +
    ((musicCraftOf(state) - 50) / 100) * DEMO_CRAFT_WEIGHT +
    (music.reputation / 100) * DEMO_REPUTATION_WEIGHT;
  return clamp(chance, DEMO_CHANCE_RANGE[0], DEMO_CHANCE_RANGE[1]);
}

/** Send a demo to the labels: once a year, answered by one draw. A label that likes it puts a deal on the table. */
export function submitDemo(
  state: GameState,
): Result<MusicOutcome & { readonly landed: boolean }, MusicError> {
  const music = state.music;
  const age = state.player.age;
  if (age < MUSIC_RELEASE_MIN_AGE) return err('too-young');
  if (music.deal) return err('has-deal');
  if (music.offer) return err('offer-waiting');
  if (music.demoAge === age) return err('demo-sent');
  if (totalReleased(music) === 0) return err('no-release-yet');
  if (musicCraftOf(state) < LABEL_MIN_CRAFT) return err('not-ready');
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const landed = musUnit(seed, gen, 'demo', age) < demoChance(state);
  const offer = landed ? makeOffer(state, age, 'demo', musicTierOf(music)) : undefined;
  const next: MusicState = {
    ...music,
    demoAge: age,
    ...(offer ? { offer } : {}),
  };
  const written = settled(
    state,
    next,
    landed
      ? `Sent a demo out. ${offer!.label} wrote back.`
      : 'Sent a demo out to the labels. Nobody got back to you.',
    `demo:${age}`,
    landed ? 'milestone' : 'passive',
  );
  return ok({
    ...written,
    state: landed ? withMusicOffer(written.state, true) : written.state,
    landed,
  });
}

export type MusicOfferError = 'no-offer' | 'no-such-choice';

export const musicChoicesOf = (offer: LabelOffer): readonly string[] =>
  musicOfferDecision(offer, 0).choices.map((row) => row.id);

/** The chance a name and somebody to speak for you get more out of a label. */
export function askChance(state: GameState): number {
  return Math.min(
    0.9,
    MUSIC_ASK_BASE +
      (state.music.reputation / 100) * MUSIC_ASK_REPUTATION_WEIGHT +
      (state.representation === undefined ? 0 : MUSIC_ASK_REPRESENTED_BONUS),
  );
}

export function answerMusicOffer(
  state: GameState,
  choiceId: string,
): Result<MusicOutcome, MusicOfferError> {
  const music = state.music;
  const offer = music.offer;
  if (!offer) return err('no-offer');
  if (!musicChoicesOf(offer).includes(choiceId)) return err('no-such-choice');
  const seed = state.rng.getSeed();
  const gen = state.world.generation;
  const pending = state.pending.filter((row) => row.eventId !== MUSIC_OFFER_EVENT_ID);

  if (choiceId === DECLINE) {
    const { offer: _gone, ...rest } = music;
    const written = entryFor(
      state,
      `Passed on ${offer.label}.`,
      'passive',
      `pass:${offer.id}`,
      offer.age,
    );
    return ok({
      entry: written.entry,
      state: { ...state, player: written.player, music: rest as MusicState, pending },
    });
  }

  if (choiceId === REQUEST_MORE) {
    const lucky = musUnit(seed, gen, 'ask', offer.id) < askChance(state);
    const [low, high] = MUSIC_ASK_ADVANCE_GAIN;
    const asked: LabelOffer = {
      ...offer,
      asked: true,
      ...(lucky
        ? {
            advance: roundAdvance(
              offer.advance * (low + musUnit(seed, gen, 'askgain', offer.id) * (high - low)),
            ),
            royalty: Math.min(
              MUSIC_ROYALTY_CAP[offer.kind],
              offer.royalty + MUSIC_ASK_ROYALTY_GAIN,
            ),
          }
        : {}),
    };
    const written = entryFor(
      state,
      lucky
        ? `You asked ${offer.label} for more. They came up to ${money(asked.advance)} and ${percent(asked.royalty)}.`
        : `You asked ${offer.label} for more. They held where they were.`,
      'passive',
      `ask:${offer.id}`,
      offer.age,
    );
    const base: GameState = {
      ...state,
      player: written.player,
      music: { ...music, offer: asked },
      pending,
    };
    return ok({ entry: written.entry, state: withMusicOffer(base, true) });
  }

  // Sign.
  const { offer: _taken, ...rest } = music;
  const deal: LabelDeal = {
    kind: offer.kind,
    label: offer.label,
    advance: offer.advance,
    royalty: offer.royalty,
    left: offer.term,
    since: offer.age,
    owed: 0,
    paid: false,
  };
  const next: MusicState = {
    ...(rest as MusicState),
    craft: music.craft ?? naturalOf(state),
    deal,
  };
  const written = entryFor(
    state,
    `Signed with ${offer.label}: ${offer.term} years, ${money(offer.advance)} up front.`,
    'milestone',
    `sign:${offer.id}`,
    offer.age,
  );
  return ok({
    entry: written.entry,
    state: {
      ...state,
      player: {
        ...written.player,
        records: addRecord(
          written.player.records,
          { category: 'career', label: `Signed with ${offer.label}` },
          offer.age,
          state.world.year,
        ),
      },
      music: next,
      pending,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Collaborations: the creators' own rules, with the artist as the channel      */
/* -------------------------------------------------------------------------- */

const COLLAB_ID = 'music';

/** The artist as the channel the 0704 rules read. Only the audience, the repeats and the answers matter. */
export function musicChannel(music: MusicState): Channel {
  return {
    id: COLLAB_ID,
    platformId: COLLAB_ID,
    categoryId: COLLAB_ID,
    name: 'Music',
    since: 0,
    audience: music.listeners,
    peak: music.peak,
    effort: 'regular',
    luck: 0,
    earned: dollars(0),
    collabs: music.collabs,
    answered: music.answered,
  };
}

/** Chances to put out something with somebody this year. Derived: nothing but the answers is saved. */
export function musicCollabOffers(state: GameState): readonly CollabOffer[] {
  if (state.player.age < MUSIC_RELEASE_MIN_AGE || totalReleased(state.music) === 0) return [];
  return collabOffersFor({
    seed: state.rng.getSeed(),
    year: state.world.year,
    channel: musicChannel(state.music),
    friends: friendsOf(state),
    agent: state.representation === 'agent',
  });
}

export type MusicCollabError =
  { readonly kind: 'notOffered' } | { readonly kind: 'notEnoughMoney'; readonly needed: number };

/** Make something with them or turn it down. Paying is a spending row now; the listeners come over now. */
export function answerMusicCollab(
  state: GameState,
  offerId: string,
  accept: boolean,
): Result<GameState, MusicCollabError> {
  const offer = musicCollabOffers(state).find((row) => row.id === offerId);
  if (offer === undefined) return err({ kind: 'notOffered' });
  if (accept && offer.fee > cashOf(state)) {
    return err({ kind: 'notEnoughMoney', needed: offer.fee });
  }
  const changed = answerCollab({ channel: musicChannel(state.music), offer, accept });
  const spend = accept && offer.fee > 0;
  const books = spend
    ? post(state.finance, state.world.year, state.player.age, {
        category: 'spending',
        amount: dollars(-offer.fee),
        source: `Recording with ${offer.partner.name}`,
      })
    : undefined;
  const text = !accept
    ? `Turned down a record with ${offer.partner.name}.`
    : offer.fee > 0
      ? `Made a record with ${offer.partner.name}, for ${money(offer.fee)}. It brought ${offer.gain.toLocaleString('en-US')} new listeners.`
      : `Made a record with ${offer.partner.name}. It brought ${offer.gain.toLocaleString('en-US')} new listeners.`;
  const written = entryFor(state, text, 'passive', `collab:${offerId}`);
  const music: MusicState = {
    ...state.music,
    listeners: changed.audience,
    peak: changed.peak,
    collabs: changed.collabs ?? state.music.collabs,
    answered: changed.answered ?? [],
  };
  return ok({
    ...state,
    ...(books === undefined ? {} : { finance: books.ledger }),
    music,
    player: {
      ...written.player,
      ...(books === undefined ? {} : { cash: books.ledger.balance }),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* The year                                                                     */
/* -------------------------------------------------------------------------- */

export interface MusicYearInput {
  /** The state at the start of the year. */
  readonly before: GameState;
  /** The school year's result, for the bands and choirs the character is in. */
  readonly education: EducationState;
  readonly age: number;
  readonly year: number;
  /** The household's standard of living, whole dollars. */
  readonly standard?: number;
}

export interface MusicYearLine {
  readonly kind: 'passive' | 'milestone';
  readonly text: string;
}

export interface MusicYearOutput {
  readonly music: MusicState;
  readonly lines: readonly MusicYearLine[];
  readonly records: readonly NewLifeRecord[];
  /** What the year paid, after a manager or an agent, whole dollars. Taxed by the caller. */
  readonly pay: number;
  /** What it cost to record and tour, whole dollars. */
  readonly costs: number;
  /** What a manager or an agent took, whole dollars. For the line, not the ledger. */
  readonly repKept: number;
  /** The fame music holds the character at. The caller takes the higher of this and the others. */
  readonly fame: number;
  readonly mood: number;
  /** Lessons for the year, and what they were for. */
  readonly fees: number;
  readonly feeSource: string;
  /** Listeners gained through releases and the road, for the creator channel that shares the name. */
  readonly fans: number;
}

/** A year with no music in it at all. */
export function emptyMusicYear(music: MusicState): MusicYearOutput {
  return {
    music,
    lines: [],
    records: [],
    pay: 0,
    costs: 0,
    repKept: 0,
    fame: 0,
    mood: 0,
    fees: 0,
    feeSource: capitalise(MUSIC_LESSONS_SOURCE),
    fans: 0,
  };
}

interface Made {
  readonly kind: ReleaseKind;
  readonly title: string;
  readonly quality: number;
  readonly hit: boolean;
  readonly flop: boolean;
  readonly viral: boolean;
}

/** What the year's releases came to, in words: "3 singles and an EP". */
function releaseWords(made: readonly Made[]): string {
  const parts = RELEASE_KINDS.map((kind) => ({
    kind,
    count: made.filter((row) => row.kind === kind).length,
  }))
    .filter((row) => row.count > 0)
    .map((row) => (row.count === 1 ? KIND_NOUN[row.kind] : `${row.count} ${KIND_NAME[row.kind]}s`));
  return parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export function runMusicYear(input: MusicYearInput): MusicYearOutput {
  const { before, age, year } = input;
  const music0 = before.music;
  if (!before.player.alive) return emptyMusicYear(music0);
  const seed = before.rng.getSeed();
  const gen = before.world.generation;
  const inStage = input.education.activities.some((row) =>
    MUSIC_STAGE_ACTIVITIES.includes(row.activityId),
  );
  const committed = committedReleases(music0);
  const planned = music0.plan;
  const wantsAny =
    RELEASE_KINDS.some((kind) => committed[kind] + planned[kind] > 0) || planned.tour;
  const involved =
    inStage || music0.lessons !== undefined || music0.craft !== undefined || wantsAny;
  if (!involved) return emptyMusicYear(music0);

  const lines: MusicYearLine[] = [];
  const records: NewLifeRecord[] = [];
  let music: MusicState = { ...music0, plan: EMPTY_PLAN, answered: [] };
  let mood = 0;
  let fees = 0;
  let costs = 0;

  /* ---- being heard, and lessons ---------------------------------------- */
  if (inStage) music = { ...music, stageYears: music.stageYears + 1 };
  if (music.lessons) {
    // As the arts are billed: an adult living on their own pays, and the first thing to go in a tight year is the class.
    const pays = age >= 18 && before.household.housing !== 'withFamily';
    if (pays && !affordsFee(input.standard ?? 0, MUSIC_LESSONS_COST)) {
      lines.push({
        kind: 'passive',
        text: 'Let the music lessons go. The fees were the first thing to cut.',
      });
      const { lessons: _dropped, ...without } = music;
      music = without as MusicState;
    } else {
      if (pays) fees += MUSIC_LESSONS_COST;
      music = {
        ...music,
        lessons: { ...music.lessons!, seasons: music.lessons!.seasons + 1 },
      };
    }
  }

  const craft = music0.craft ?? musicCraft(before.player.stats, before.player.talents.music);
  const tier0 = tierFor(music0.listeners);
  const deal0 = music0.deal;
  const reach = deal0 ? LABEL_REACH[deal0.kind] : { discover: 1, grow: 1, polish: 0 };
  const manager = before.representation === 'manager';
  const agent = before.representation === 'agent';
  const boost = manager ? MANAGER_GROWTH : 1;
  const ceiling = audienceCeiling(craft + reach.polish, musicLuck(seed, gen), reach.discover);

  /* ---- the records ----------------------------------------------------- */
  // Big releases first; each year has so many weeks. A label's own come first and are not the artist's to refuse.
  const counts: Record<ReleaseKind, number> = {
    single: Math.min(RELEASE_CAPS.single, committed.single + planned.single),
    ep: Math.min(RELEASE_CAPS.ep, committed.ep + planned.ep),
    lp: Math.min(RELEASE_CAPS.lp, committed.lp + planned.lp),
  };
  const queue: { kind: ReleaseKind; label: boolean }[] = [];
  for (const kind of [...RELEASE_KINDS].reverse()) {
    for (let index = 0; index < counts[kind]; index += 1) {
      queue.push({ kind, label: index < committed[kind] });
    }
  }
  queue.sort((a, b) => Number(b.label) - Number(a.label));
  let weeks = 0;
  let cash = cashOf(before);
  const made: Made[] = [];
  const dropped: ReleaseKind[] = [];
  let gained = 0;
  let catalogue = music.catalogue;
  let bestQuality = music.bestQuality;
  let owed = deal0 ? deal0.owed : 0;
  let reputation = music.reputation;
  const released = { ...music.released };
  queue.forEach((item, index) => {
    const span = RELEASE_WEEKS[item.kind];
    const own = !item.label && DIY_COST[item.kind];
    if (age < MUSIC_RELEASE_MIN_AGE || weeks + span > YEAR_WEEKS) {
      dropped.push(item.kind);
      return;
    }
    if (own !== false && own > cash) {
      dropped.push(item.kind);
      return;
    }
    weeks += span;
    if (own !== false) {
      cash -= own;
      costs += own;
    } else if (deal0) {
      owed += LABEL_COST[deal0.kind][item.kind];
    }
    const quality = clamp(
      Math.round(
        craft + reach.polish + (musUnit(seed, gen, 'q', year, index) - 0.5) * QUALITY_NOISE,
      ),
      0,
      100,
    );
    const factor = qualityFactor(quality);
    const viral =
      quality > 40 &&
      musUnit(seed, gen, 'viral', year, index) <
        VIRAL_BASE + Math.max(0, quality - VIRAL_FROM) * VIRAL_PER_POINT;
    const n = made.length;
    // What the work can hold: a viral release breaks the ceiling for the year.
    const room = Math.max(0, 1 - music0.listeners / (ceiling * (viral ? VIRAL_CEILING : 1)));
    const fans =
      (DISCOVER[item.kind] * reach.discover + music0.listeners * GROW[item.kind] * reach.grow) *
      factor *
      SATURATION ** n *
      room *
      (viral ? VIRAL_MULTIPLIER : 1) *
      boost;
    gained += fans;
    catalogue += factor * CATALOGUE_WEIGHT[item.kind];
    bestQuality = Math.max(bestQuality, quality);
    released[item.kind] += 1;
    const at = Math.floor(musUnit(seed, gen, 'title', year, index) * RELEASE_TITLES.length);
    const hit = quality >= HIT_LINE[tier0];
    const flop = quality < HIT_LINE[tier0] - MUSIC_FLOP_MARGIN;
    made.push({ kind: item.kind, title: RELEASE_TITLES[at]!, quality, hit, flop, viral });
    reputation = clamp(
      reputation +
        (hit ? MUSIC_TIER_ROWS[tier0].reputation + MUSIC_HIT_REPUTATION : 0) -
        (flop ? MUSIC_FLOP_REPUTATION : 0),
      0,
      100,
    );
    if (hit) mood += 1;
    if (flop) mood -= 1;
    if (viral) mood += 3;
  });

  if (made.length > 0) {
    const before1 = totalReleased(music0) === 0;
    const best = made.reduce((top, row) => (row.quality > top.quality ? row : top));
    const verdict = made.some((row) => row.viral)
      ? `"${made.find((row) => row.viral)!.title}" took off.`
      : best.hit
        ? `${titleOf(best.title)} did well.`
        : made.every((row) => row.flop)
          ? 'Hardly anybody listened.'
          : 'It found a few listeners.';
    lines.push({
      kind: before1 || made.some((row) => row.viral) ? 'milestone' : 'passive',
      text:
        made.length === 1
          ? `Put out ${KIND_NOUN[made[0]!.kind]}, ${titleOf(made[0]!.title)}. ${verdict}`
          : `Put out ${releaseWords(made)}. ${verdict}`,
    });
    if (before1) {
      records.push({
        category: 'career',
        label: `Released a first ${KIND_NAME[made[0]!.kind]}: ${made[0]!.title}`,
      });
    }
    if (made.some((row) => row.viral)) {
      records.push({
        category: 'career',
        label: `${titleOf(made.find((row) => row.viral)!.title)} went viral`,
      });
    }
  }
  if (dropped.length > 0) {
    lines.push({
      kind: 'passive',
      text:
        dropped.length === 1
          ? `Couldn't get ${KIND_NOUN[dropped[0]!]} out. There wasn't the money or the time.`
          : `Couldn't get ${dropped.length} releases out. There wasn't the money or the time.`,
    });
  }
  music = { ...music, released, catalogue, bestQuality };

  /* ---- the road -------------------------------------------------------- */
  let tourNet = 0;
  let agentTour = 0;
  let fansRoad = 0;
  const onRoad =
    planned.tour &&
    age >= MUSIC_TOUR_MIN_AGE &&
    music0.listeners + gained >= MIN_TOUR_LISTENERS &&
    weeks + tourFor(tier0, music0.listeners + gained, craft).weeks <= YEAR_WEEKS;
  if (onRoad) {
    const listenersNow = Math.round(music0.listeners + gained);
    const quality =
      made.length > 0 ? made.reduce((sum, row) => sum + row.quality, 0) / made.length : craft;
    const plan = tourFor(tierFor(listenersNow), listenersNow, quality);
    const row = MUSIC_TIER_ROWS[tierFor(listenersNow)];
    weeks += plan.weeks;
    agentTour = agent ? Math.round(plan.door * REP_AGENT_CUT) : 0;
    tourNet = plan.door - agentTour - plan.costs;
    fansRoad = Math.round(plan.tickets * TOUR_FANS);
    music = { ...music, tours: music.tours + 1 };
    reputation = clamp(reputation + 1, 0, 100);
    lines.push({
      kind: 'passive',
      text:
        tourNet >= 0
          ? `Toured: ${plan.shows} shows in ${row.venue}. It cleared ${money(tourNet)} after the road took its share.`
          : `Toured: ${plan.shows} shows in ${row.venue}. It lost ${money(-tourNet)} once the road took its share.`,
    });
  } else if (planned.tour) {
    lines.push({
      kind: 'passive',
      text: "The tour didn't happen. There wasn't the audience or the time.",
    });
  }

  /* ---- listeners ------------------------------------------------------- */
  const playedThisYear = made.length > 0 || onRoad;
  const retention =
    RETAIN_BASE +
    RETAIN_CATALOGUE * Math.min(1, catalogue / CATALOGUE_FULL) -
    (playedThisYear ? 0 : IDLE_DECAY);
  const fansTotal = Math.round(gained) + fansRoad;
  const raw = music0.listeners * retention + fansTotal;
  const listeners1 = Math.round(
    Math.min(LISTENER_CAP, raw > ceiling ? raw - (raw - ceiling) * OVERSHOOT_FALL : raw),
  );

  /* ---- what it paid ---------------------------------------------------- */
  const average = (music0.listeners + listeners1) / 2;
  const gross = average * STREAMS_PER_LISTENER * STREAM_PAYOUT;
  let streaming: number;
  let advance = 0;
  if (deal0) {
    if (!deal0.paid) {
      advance = deal0.advance;
      owed += deal0.advance;
    }
    const pot = gross * deal0.royalty;
    const recouped = Math.min(owed, pot);
    owed -= recouped;
    streaming = pot - recouped;
  } else {
    streaming = gross * (1 - DISTRIBUTOR_CUT);
  }
  const agentAdvance = agent ? Math.round(advance * REP_AGENT_CUT) : 0;
  const positive = streaming + advance - agentAdvance + Math.max(0, tourNet);
  const managerKept = manager ? Math.round(positive * MANAGER_CUT) : 0;
  const pay = Math.round(positive) - managerKept;
  if (tourNet < 0) costs += -tourNet;
  const repKept = managerKept + agentTour + agentAdvance;

  /* ---- the name, the rung, an award ------------------------------------ */
  const tier1 = tierFor(listeners1);
  let awards = music.awards;
  const top = made.length > 0 ? made.reduce((a, b) => (b.quality > a.quality ? b : a)) : undefined;
  if (
    top !== undefined &&
    top.quality >= MUSIC_AWARD_LINE &&
    musUnit(seed, gen, 'award', year) < MUSIC_TIER_ROWS[tier1].awardChance
  ) {
    awards += 1;
    reputation = Math.min(100, reputation + MUSIC_AWARD_REPUTATION);
    mood += MUSIC_AWARD_MOOD;
    lines.push({
      kind: 'milestone',
      text: `Won ${MUSIC_AWARD_NAMES[top.kind]} at ${MUSIC_AWARD_CEREMONY} for "${top.title}".`,
    });
    records.push({
      category: 'award',
      label: `${MUSIC_AWARD_NAMES[top.kind]}, ${MUSIC_AWARD_CEREMONY}, ${year}`,
    });
  }
  let idle = music.idle;
  if (playedThisYear) idle = 0;
  else if (totalReleased(music0) > 0) {
    idle += 1;
    reputation = Math.max(0, reputation - MUSIC_IDLE_REPUTATION);
    if (idle === 1) {
      lines.push({
        kind: 'passive',
        text: 'A quiet year in music. People still listen to the old records, but nothing new came out.',
      });
    }
  }
  if (tierRankOf(tier1) > tierRankOf(tier0)) {
    mood += 3;
    lines.push({ kind: 'milestone', text: MUSIC_RISE_LINES[tier1] });
    if (tierRankOf(tier1) >= tierRankOf('regional')) {
      records.push({
        category: 'career',
        label: `Became a ${MUSIC_TIER_ROWS[tier1].name.toLowerCase()}`,
      });
    }
  } else if (tierRankOf(tier1) < tierRankOf(tier0)) {
    lines.push({
      kind: 'passive',
      text: `The audience thinned out. You're back to ${MUSIC_TIER_ROWS[tier1].name.toLowerCase()}.`,
    });
  }
  const bestTier =
    music0.best !== undefined && tierRankOf(music0.best) >= tierRankOf(tier1) ? music0.best : tier1;

  /* ---- a deal runs down ------------------------------------------------ */
  let deal: LabelDeal | undefined;
  if (deal0) {
    const left = deal0.left - 1;
    if (left > 0) deal = { ...deal0, left, owed: Math.round(owed), paid: true };
    else {
      lines.push({
        kind: 'milestone',
        text: `The deal with ${deal0.label} ran out. What you still owed them was wiped, and the records are yours again.`,
      });
    }
  }

  /* ---- craft ----------------------------------------------------------- */
  const craftNext = nextMusicCraft(before, music, inStage, craft);

  /* ---- a label calls --------------------------------------------------- */
  let offer = music.offer;
  if (
    !deal &&
    !offer &&
    totalReleased(music) > 0 &&
    craftNext >= LABEL_MIN_CRAFT &&
    musUnit(seed, gen, 'call', year) <
      MUSIC_TIER_ROWS[tier1].labelChance *
        (agent ? AGENT_OFFER_CHANCE : 1) *
        (made.length > 0 ? 1 : 0.5)
  ) {
    const raised = makeOffer(before, age, 'called', tier1);
    offer = raised;
    lines.push({
      kind: 'passive',
      text: `${raised.label} has been listening. There's a deal on the table.`,
    });
  }

  const fame = musicFameOf({ tier: tier1, reputation, awards, idle });
  const nextMusic: MusicState = {
    ...music,
    craft: craftNext,
    listeners: listeners1,
    peak: Math.max(music.peak, listeners1),
    reputation,
    awards,
    idle,
    lastPay: pay,
    ...(bestTier !== 'local' ? { best: bestTier } : {}),
    ...(deal ? { deal } : {}),
    ...(offer ? { offer } : {}),
  };
  const { deal: _ended, ...withoutDeal } = nextMusic;
  const finalMusic = deal ? nextMusic : (withoutDeal as MusicState);

  return {
    music: finalMusic,
    lines,
    records,
    pay,
    costs: Math.round(costs),
    repKept,
    fame,
    mood,
    fees,
    feeSource: capitalise(MUSIC_LESSONS_SOURCE),
    fans: fansTotal,
  };
}

/** Craft after a year: drifts toward what the character is plus what releases, lessons and a stage add. */
export function nextMusicCraft(
  before: GameState,
  music: MusicState,
  inStage: boolean,
  craft: number,
): number {
  const natural = musicCraft(before.player.stats, before.player.talents.music);
  const lessons = music.lessons ? MUSIC_LESSONS_CRAFT : 0;
  // Releases and a stage add at most MUSIC_RELEASE_CRAFT_CAP + MUSIC_STAGE_CRAFT, which is under MUSIC_HEADROOM, so the
  // target is always inside what `musicCraftCeiling` allows and needs no cap of its own.
  const target =
    natural +
    lessons +
    Math.min(MUSIC_RELEASE_CRAFT_CAP, totalReleased(music) * MUSIC_RELEASE_CRAFT) +
    (inStage ? MUSIC_STAGE_CRAFT : 0);
  const pull = target > craft ? 0.35 : 0.1;
  return clamp(Math.round(craft + (target - craft) * pull), 0, 100);
}

/** The records feed the Music creator channel, if the character has one: a share of the people who found them. */
export function withMusicAudience(channels: readonly Channel[], fans: number): readonly Channel[] {
  const added = Math.round(fans * MUSIC_CHANNEL_SHARE);
  if (added <= 0) return channels;
  return channels.map((channel) =>
    channel.categoryId === 'music'
      ? {
          ...channel,
          audience: channel.audience + added,
          peak: Math.max(channel.peak, channel.audience + added),
        }
      : channel,
  );
}

export { addRecord as addMusicRecord };
