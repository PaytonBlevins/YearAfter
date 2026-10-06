/**
 * Ticket 0705 — meeting somebody famous, and what comes of it.
 *
 * Two stages (spec 704–705, 839–848):
 *
 *  1. A STRANGER. Once in a while a famous person turns up in a life: uncommon, more
 *     common in a big city, among the rich, in a field you work in, and for somebody who
 *     is famous themselves. The player gets six things to do (compliment, flirt, ask for an
 *     autograph, ask for a picture, insult, ignore). It is derived from the seed, the
 *     year and the character, so a reload shows the same person and an answer cannot be
 *     rerolled; only the answer and what came of it are saved.
 *  2. A CONNECTION. A good meeting can leave them wanting to stay in touch. From then on
 *     there is a dedicated menu: the ordinary social and romantic things, and the
 *     professional ones (a joint piece, a guest spot, a mention for a business). A
 *     connection that warms enough becomes an ordinary friend in the Relationships circle,
 *     and from there the ordinary romance and friendship machinery takes over.
 *
 * There is no directory of the world's famous people (spec 1318): the only ones the player
 * can see are the ones they have met.
 */

import { adjustStats, createPersonality } from '@yearafter/character';
import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  CONNECTION_MENU,
  ENCOUNTER_MENU,
  celebrityLine,
  findCelebrityField,
  findCity,
  findConnectionAction,
  findEncounterAction,
  type CelebrityLineKind,
  type ConnectionActionId,
  type EncounterActionId,
  type EncounterScene,
} from '@yearafter/content';
import { asNpcId, err, mixedUnit, ok, stablePick, type Result } from '@yearafter/core';
import { MIN_COLLAB_AUDIENCE, collabGain, type Channel } from '@yearafter/finance';
import { endPerson, partnerOf, type Acquaintance, type SocialCircle } from '@yearafter/social';
import { netWorthOf } from './businesses';
import {
  deathYearOf,
  displayFigure,
  fameIn,
  figureById,
  isWorking,
  notablesIn,
  type Figure,
} from './celebrity-world';
import type { GameState } from './game-state';

export { EMPTY_CELEBRITIES, type CelebrityState, type CelebrityTie } from './celebrity-state';
import type { CelebrityState, CelebrityTie } from './celebrity-state';

/* -------------------------------------------------------------------------- */
/* Tunable numbers                                                             */
/* -------------------------------------------------------------------------- */

/** The chance in a year, for a person with nothing going for them: about one meeting in forty-five. */
export const ENCOUNTER_BASE = 0.022;
/** Younger than this nobody is in the way of a famous person; under {@link ENCOUNTER_FULL_AGE} it is rarer. */
export const ENCOUNTER_FROM_AGE = 10;
export const ENCOUNTER_FULL_AGE = 16;
export const ENCOUNTER_YOUNG_SHARE = 0.5;
/** The most a year can be made likelier. */
export const ENCOUNTER_MAX = 0.6;
/** A reason has to push a meeting this much before the scene is about it and not about luck. */
export const SCENE_FROM = 0.18;
/** How many people can be kept in touch with at once. */
export const MAX_TIES = 12;
/** Warmth a good meeting leaves, and the warmth where somebody becomes a friend (the circle's own bar is 50). */
export const TIE_START = 32;
export const FRIEND_AT = 60;
/** A year with no contact costs this much warmth, and a tie under {@link LOST_BELOW} is gone. */
export const COOLING = 3;
export const LOST_BELOW = 8;
/** Under this they are not somebody to put on a show, or to ask for a mention. */
export const BIG_ENOUGH = 25;
/** The most older or younger a flirt may be than the other person. */
export const FLIRT_GAP = 15;
/** A guest's own following converts less well than another creator's. */
export const GUEST_SHARE = 0.5;

/* -------------------------------------------------------------------------- */
/* How likely, and who                                                         */
/* -------------------------------------------------------------------------- */

/** A big city puts you near more of them: 0.6 for a town to 2 for the biggest. */
export const hubFactor = (cityWeight: number): number => 0.6 + 1.4 * Math.min(1, cityWeight / 130);

/** Money gets you into the rooms they are in. 1 at nothing, about 1.6 at a million, 3 at the top. */
export const wealthFactor = (netWorth: number): number =>
  Math.min(3, 1 + 0.9 * Math.log10(1 + Math.max(0, netWorth) / 250_000));

/** A person with a following is likelier to be in the same room. */
export const fameFactor = (fame: number): number => 1 + fame / 25;

/** How much more a field's people turn up in this life. */
export interface Pulls {
  readonly hub: number;
  readonly wealth: number;
  readonly fame: number;
  readonly channel: boolean;
  readonly business: boolean;
}

export function pullsOf(state: GameState): Pulls {
  const weight = findCity(state.player.currentLocation.cityId)?.weight ?? 30;
  return {
    hub: hubFactor(weight),
    wealth: wealthFactor(netWorthOf(state)),
    fame: fameFactor(state.fame),
    channel: state.channels.some((channel) => channel.audience >= MIN_COLLAB_AUDIENCE),
    business: state.businesses.length > 0,
  };
}

/** How much likelier a year is to hold a meeting, before the cap. */
export function encounterMultiplier(pulls: Pulls): number {
  const network = 1 + (pulls.channel ? 0.25 : 0) + (pulls.business ? 0.25 : 0);
  return pulls.hub * pulls.wealth * pulls.fame * network;
}

/** The chance a year holds a meeting at all. */
export function encounterChance(state: GameState): number {
  const age = state.player.age;
  if (age < ENCOUNTER_FROM_AGE || !state.player.alive) return 0;
  const young = age < ENCOUNTER_FULL_AGE ? ENCOUNTER_YOUNG_SHARE : 1;
  return Math.min(ENCOUNTER_MAX, ENCOUNTER_BASE * young * encounterMultiplier(pullsOf(state)));
}

/** How much more a field's people are in this life's way. */
export function fieldPull(fieldId: string, pulls: Pulls): number {
  const field = findCelebrityField(fieldId);
  if (field === undefined) return 1;
  const network =
    (field.network === 'channel' && pulls.channel) ||
    (field.network === 'business' && pulls.business)
      ? 1.5
      : 0;
  return 1 + field.hubPull * (pulls.hub - 1) + field.wealthPull * (pulls.wealth - 1) + network;
}

/** Why it was this person: the biggest push behind the meeting, or chance. */
export function sceneFor(fieldId: string, pulls: Pulls): EncounterScene {
  const field = findCelebrityField(fieldId);
  if (field === undefined) return 'chance';
  const reasons: readonly (readonly [EncounterScene, number])[] = [
    ['hub', field.hubPull * (pulls.hub - 1)],
    ['elite', field.wealthPull * (pulls.wealth - 1)],
    ['fame', (pulls.fame - 1) * 0.6],
    ['channel', field.network === 'channel' && pulls.channel ? 1 : 0],
    ['business', field.network === 'business' && pulls.business ? 1 : 0],
  ];
  const [scene, strength] = reasons.reduce((best, next) => (next[1] > best[1] ? next : best));
  return strength >= SCENE_FROM ? scene : 'chance';
}

export interface Encounter {
  readonly year: number;
  readonly figure: Figure;
  /** Their fame this year, 12–100. */
  readonly fame: number;
  readonly scene: EncounterScene;
  /** What the player reads. */
  readonly text: string;
}

const pickLine = (lines: readonly string[], key: string): string =>
  stablePick(lines, key) ?? lines[0] ?? '';

const roleOf = (figure: Figure): string =>
  findCelebrityField(figure.field)?.role ?? 'a public figure';

function say(
  kind: CelebrityLineKind,
  key: string,
  figure: { readonly name: string; readonly role: string },
  extra: Readonly<Record<string, string>> = {},
): string {
  return celebrityLine(kind, key, { name: figure.name, role: figure.role, ...extra }, pickLine);
}

/** How likely a figure is, against the others, to be the one in the path: fame, in a field this life is near, still working. */
export const candidateWeight = (figure: Figure, year: number, pulls: Pulls): number =>
  fameIn(figure, year) * fieldPull(figure.field, pulls) * (isWorking(figure, year) ? 1 : 0.4);

/**
 * The famous person in this year's path, or nobody. Derived: the chance is a fixed draw for
 * the year against what this life has become, and the person is a weighted pick from who is
 * famous this year, favouring the fields this life is closest to.
 */
export function encounterFor(state: GameState): Encounter | undefined {
  const { celebrities } = state;
  const year = state.world.year;
  if (celebrities.answeredYear === year) return undefined;
  const chance = encounterChance(state);
  if (chance <= 0) return undefined;
  const seed = state.rng.getSeed();
  if (mixedUnit(`${seed}:encounter:${year}:${state.world.generation}:happens`) >= chance)
    return undefined;
  const pulls = pullsOf(state);
  const known = new Set([...celebrities.ties.map((tie) => tie.id), ...celebrities.met]);
  const candidates = notablesIn(seed, year)
    .filter((figure) => !known.has(figure.id))
    .map((figure) => ({
      figure,
      fame: fameIn(figure, year),
      weight: candidateWeight(figure, year, pulls),
    }))
    .filter((candidate) => candidate.weight > 0);
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) return undefined;
  let along = mixedUnit(`${seed}:encounter:${year}:${state.world.generation}:who`) * total;
  let chosen = candidates[candidates.length - 1]!;
  for (const candidate of candidates) {
    along -= candidate.weight;
    if (along < 0) {
      chosen = candidate;
      break;
    }
  }
  const scene = sceneFor(chosen.figure.field, pulls);
  return {
    year,
    figure: chosen.figure,
    fame: chosen.fame,
    scene,
    text: say(`scene:${scene}`, `celeb:scene:${year}:${chosen.figure.id}`, {
      name: displayFigure(chosen.figure),
      role: roleOf(chosen.figure),
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* The six things to do to a stranger                                          */
/* -------------------------------------------------------------------------- */

export type FlirtRefusal =
  | { readonly kind: 'tooYoung' }
  | { readonly kind: 'tooFarApart' }
  | { readonly kind: 'alreadyWithSomeone' };

export type EncounterRefusal =
  { readonly kind: 'noEncounter' } | { readonly kind: 'noSuchAction' } | FlirtRefusal;

const entryOf = (
  state: GameState,
  kind: TimelineEntry['kind'],
  text: string,
  key: string,
): TimelineEntry => {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:${key}`,
    sequence,
  });
};

/** Looks and charisma, 0–1. Neither is a gate; both are an edge. */
const charmOf = (state: GameState): number =>
  (state.player.stats.looks + state.player.stats.charisma) / 200;

/** Whether the player may flirt with this person at all, and why not. */
export function whyNotFlirt(
  state: GameState,
  figure: { readonly birthYear: number },
  year: number,
): FlirtRefusal | undefined {
  const figureAge = year - figure.birthYear;
  if (state.player.age < 18 || figureAge < 18) return { kind: 'tooYoung' };
  if (Math.abs(figureAge - state.player.age) > FLIRT_GAP) return { kind: 'tooFarApart' };
  if (partnerOf(state.circle.people) !== undefined) return { kind: 'alreadyWithSomeone' };
  return undefined;
}

/** The chance an action lands on a stranger. The player never sees this number (spec: no odds labels). */
export function encounterOdds(
  state: GameState,
  actionId: EncounterActionId,
  figureFame: number,
): number {
  const action = findEncounterAction(actionId);
  if (action === undefined || action.base <= 0) return 0;
  const ease = 1 - 0.45 * (figureFame / 100);
  const chance = action.base * ease + 0.3 * (charmOf(state) - 0.5) + 0.35 * (state.fame / 100);
  return Math.min(0.95, Math.max(0.03, chance));
}

/** What the six look like on this meeting, with the ones that cannot be done marked. */
export function encounterMenu(state: GameState): readonly {
  readonly id: EncounterActionId;
  readonly label: string;
  readonly blurb: string;
  readonly refusal?: EncounterRefusal;
}[] {
  const encounter = encounterFor(state);
  return ENCOUNTER_MENU.map((action) => {
    const refusal =
      encounter === undefined
        ? ({ kind: 'noEncounter' } as const)
        : action.id === 'flirt'
          ? whyNotFlirt(state, encounter.figure, encounter.year)
          : undefined;
    return {
      id: action.id,
      label: action.label,
      blurb: action.blurb,
      ...(refusal === undefined ? {} : { refusal }),
    };
  });
}

export interface EncounterOutcome {
  readonly state: GameState;
  /** Whether it landed. Insulting and ignoring always "work". */
  readonly worked: boolean;
  /** A connection came of it. */
  readonly connected: boolean;
  readonly entries: readonly TimelineEntry[];
}

const FELT: Readonly<Record<EncounterActionId, readonly [number, number]>> = {
  compliment: [2, -1],
  flirt: [3, -2],
  autograph: [2, -1],
  picture: [2, -1],
  insult: [0, 0],
  ignore: [0, 0],
};

/** The chance somebody who is famous, and rude to, has it go around. */
export const FILMED_CHANCE = 0.15;
export const FILMED_FROM_FAME = 50;

export function answerEncounter(
  state: GameState,
  actionId: string,
): Result<EncounterOutcome, EncounterRefusal> {
  const encounter = encounterFor(state);
  if (encounter === undefined) return err({ kind: 'noEncounter' });
  const action = findEncounterAction(actionId);
  if (action === undefined) return err({ kind: 'noSuchAction' });
  if (action.id === 'flirt') {
    const refusal = whyNotFlirt(state, encounter.figure, encounter.year);
    if (refusal !== undefined) return err(refusal);
  }
  const seed = state.rng.getSeed();
  const { figure } = encounter;
  const who = { name: displayFigure(figure), role: roleOf(figure) };
  const draw = (part: string): number =>
    mixedUnit(
      `${seed}:encounter:${encounter.year}:${state.world.generation}:${figure.id}:${action.id}:${part}`,
    );
  const key = (part: string): string => `celeb:${encounter.year}:${figure.id}:${action.id}:${part}`;

  let worked = true;
  let happiness = 0;
  let text: string;
  if (action.id === 'ignore') {
    text = say('ignore', key('line'), who);
  } else if (action.id === 'insult') {
    const filmed = encounter.fame >= FILMED_FROM_FAME && draw('filmed') < FILMED_CHANCE;
    text = say(filmed ? 'insultFilmed' : 'insult', key('line'), who);
    happiness = filmed ? -4 : -1;
  } else {
    worked = draw('lands') < encounterOdds(state, action.id, encounter.fame);
    text = say(`${action.id}${worked ? 'Ok' : 'Fail'}` as CelebrityLineKind, key('line'), who);
    happiness = worked ? FELT[action.id][0] : FELT[action.id][1];
  }

  const connected =
    worked &&
    action.connect > 0 &&
    state.celebrities.ties.filter((tie) => tie.endedYear === undefined).length < MAX_TIES &&
    draw('connects') < action.connect * (1 + state.fame / 100);

  const entries: TimelineEntry[] = [entryOf(state, 'relationship', text, key('entry'))];
  let timeline = appendToTimeline(state.player.timeline, entries[0]!);
  if (connected) {
    const follow = entryOf(
      state,
      'relationship',
      say('connected', key('connected'), who),
      key('connected'),
    );
    entries.push(follow);
    timeline = appendToTimeline(timeline, follow);
  }
  const tie: CelebrityTie | undefined = connected
    ? {
        id: figure.id,
        name: who.name,
        sex: figure.sex,
        field: figure.field,
        birthYear: figure.birthYear,
        metYear: encounter.year,
        metAtAge: state.player.age,
        warmth: TIE_START,
        lastContactYear: encounter.year,
        doneYear: 0,
        done: [],
      }
    : undefined;
  return ok({
    state: {
      ...state,
      player: {
        ...state.player,
        stats:
          happiness === 0 ? state.player.stats : adjustStats(state.player.stats, { happiness }),
        timeline,
      },
      celebrities: {
        ties: tie === undefined ? state.celebrities.ties : [...state.celebrities.ties, tie],
        met: [...state.celebrities.met, figure.id].slice(-60),
        answeredYear: encounter.year,
      },
    },
    worked,
    connected,
    entries,
  });
}

/* -------------------------------------------------------------------------- */
/* The second menu                                                             */
/* -------------------------------------------------------------------------- */

/** The people the player can reach, as the screen will show them. Nobody else exists to it. */
export interface ConnectionRow {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  /** "a rising name", "well known", "a household name", "a global star". */
  readonly standing: string;
  /** "acquaintance", "friend", … as the circle names the bond. */
  readonly bond: string;
  readonly friend: boolean;
  readonly active: boolean;
}

export const standingOf = (fame: number): string =>
  fame >= 85
    ? 'a global star'
    : fame >= 60
      ? 'a household name'
      : fame >= 30
        ? 'well known'
        : 'a rising name';

const findTie = (state: GameState, id: string): CelebrityTie | undefined =>
  state.celebrities.ties.find((tie) => tie.id === id);

/** The friend in the circle a promoted tie became. */
const friendOf = (state: GameState, tie: CelebrityTie): Acquaintance | undefined =>
  state.circle.people.find((person) => person.celebrityId === tie.id);

/** How well they know each other, from the one place it lives. */
export function warmthOf(state: GameState, tie: CelebrityTie): number {
  if (tie.promoted === true) return friendOf(state, tie)?.relationship ?? tie.warmth;
  return tie.warmth;
}

const bondWord = (warmth: number): string =>
  warmth >= 90
    ? 'best friend'
    : warmth >= 72
      ? 'close friend'
      : warmth >= 50
        ? 'friend'
        : warmth >= 30
          ? 'acquaintance'
          : 'know of them';

export function connectionRows(state: GameState): readonly ConnectionRow[] {
  const seed = state.rng.getSeed();
  return state.celebrities.ties.map((tie) => {
    const figure = figureById(seed, tie.id);
    const fame = figure === undefined ? 0 : fameIn(figure, state.world.year);
    const warmth = warmthOf(state, tie);
    return {
      id: tie.id,
      name: tie.name,
      role: findCelebrityField(tie.field)?.role ?? 'a public figure',
      standing: standingOf(fame),
      bond: bondWord(warmth),
      friend: tie.promoted === true,
      active: tie.endedYear === undefined,
    };
  });
}

export type ConnectionRefusal =
  | { readonly kind: 'noSuchTie' }
  | { readonly kind: 'noSuchAction' }
  | { readonly kind: 'notAround' }
  | { readonly kind: 'notCloseEnough' }
  | { readonly kind: 'doneThisYear' }
  | { readonly kind: 'tooYoung' }
  | { readonly kind: 'tooFarApart' }
  | { readonly kind: 'alreadyWithSomeone' }
  /** They are an ordinary friend now: romance goes through the friends list. */
  | { readonly kind: 'friendsNow' }
  | { readonly kind: 'notTheirField' }
  | { readonly kind: 'noChannel' }
  | { readonly kind: 'noShow' }
  | { readonly kind: 'noBusiness' }
  | { readonly kind: 'notBigEnough' };

/** Platforms with somebody to put on: a talking show. */
export const SHOW_PLATFORMS: readonly string[] = ['video', 'stream', 'podcast'];

/** Where a figure's following would be, as a creator's audience, for what a joint piece brings. */
export const fameAudience = (fame: number): number => Math.round(1000 * (10 ** (fame / 20) - 1));

/** The channel an action would be about: the biggest that can take it. */
function bestChannel(state: GameState, shows: boolean): Channel | undefined {
  return [...state.channels]
    .filter(
      (channel) =>
        channel.audience >= MIN_COLLAB_AUDIENCE &&
        (!shows || SHOW_PLATFORMS.includes(channel.platformId)),
    )
    .sort((a, b) => b.audience - a.audience)[0];
}

export function whyNotConnection(
  state: GameState,
  tieId: string,
  actionId: string,
): ConnectionRefusal | undefined {
  const tie = findTie(state, tieId);
  if (tie === undefined) return { kind: 'noSuchTie' };
  const action = findConnectionAction(actionId);
  if (action === undefined) return { kind: 'noSuchAction' };
  const year = state.world.year;
  const figure = figureById(state.rng.getSeed(), tie.id);
  if (tie.endedYear !== undefined || figure === undefined || deathYearOf(figure) < year) {
    return { kind: 'notAround' };
  }
  if (warmthOf(state, tie) < action.minWarmth) return { kind: 'notCloseEnough' };
  if (tie.doneYear === year && tie.done.includes(action.id)) return { kind: 'doneThisYear' };
  const fame = fameIn(figure, year);
  if (action.id === 'flirt') {
    // A friend in the circle is asked out from there, where the ordinary romance rules live.
    if (tie.promoted === true) return { kind: 'friendsNow' };
    const refusal = whyNotFlirt(state, figure, year);
    if (refusal !== undefined) return refusal;
  }
  if (action.id === 'collaborate') {
    if (figure.field !== 'creator') return { kind: 'notTheirField' };
    if (bestChannel(state, false) === undefined) return { kind: 'noChannel' };
  }
  if (action.id === 'invite') {
    if (bestChannel(state, true) === undefined) return { kind: 'noShow' };
    if (fame < BIG_ENOUGH) return { kind: 'notBigEnough' };
  }
  if (action.id === 'endorse') {
    if (state.businesses.length === 0) return { kind: 'noBusiness' };
    if (fame < BIG_ENOUGH) return { kind: 'notBigEnough' };
  }
  return undefined;
}

/** What the second menu offers for somebody, and what stands in the way of each. */
export function connectionMenu(
  state: GameState,
  tieId: string,
): readonly {
  readonly id: ConnectionActionId;
  readonly label: string;
  readonly blurb: string;
  readonly kind: string;
  readonly refusal?: ConnectionRefusal;
}[] {
  return CONNECTION_MENU.map((action) => {
    const refusal = whyNotConnection(state, tieId, action.id);
    return {
      id: action.id,
      label: action.label,
      blurb: action.blurb,
      kind: action.kind,
      ...(refusal === undefined ? {} : { refusal }),
    };
  });
}

/** The chance an action lands. Never shown. */
export function connectionOdds(
  state: GameState,
  warmth: number,
  actionId: ConnectionActionId,
  figureFame: number,
): number {
  const action = findConnectionAction(actionId);
  if (action === undefined) return 0;
  const along = Math.min(
    1,
    Math.max(0, (warmth - action.minWarmth) / Math.max(1, 100 - action.minWarmth)),
  );
  const base = action.worst + (action.best - action.worst) * along;
  const lift =
    0.25 * (state.fame / 100) - (action.kind === 'professional' ? 0.15 * (figureFame / 100) : 0);
  return Math.min(0.95, Math.max(0.03, base + lift));
}

export interface ConnectionOutcome {
  readonly state: GameState;
  readonly worked: boolean;
  /** People a joint piece or a guest spot brought, when it did. */
  readonly gained?: number;
  readonly becameFriend: boolean;
  readonly entries: readonly TimelineEntry[];
}

/** A friend in the circle, for somebody who was a famous stranger. */
export function promotedFriend(
  tie: CelebrityTie,
  figure: Figure,
  warmth: number,
  age: number,
): Acquaintance {
  const unit = (part: string): number => mixedUnit(`celeb:friend:${tie.id}:${part}`);
  const trait = (part: string): number => Math.round(10 + 80 * unit(part));
  return {
    id: asNpcId(`npc:celeb:${tie.id}`),
    firstName: figure.firstName,
    lastName: figure.lastName,
    sex: figure.sex,
    birthYear: figure.birthYear,
    alive: true,
    tier: 2,
    personality: createPersonality({
      ambition: trait('ambition'),
      riskTolerance: trait('risk'),
      temper: trait('temper'),
      generosity: trait('generosity'),
      loyalty: trait('loyalty'),
      extraversion: trait('extraversion'),
    }),
    relationship: Math.min(100, Math.max(0, Math.round(warmth))) as Acquaintance['relationship'],
    kind: 'peer',
    context: 'fame',
    metAtAge: tie.metAtAge,
    lastContactAge: age,
    memories: [],
    inRoom: false,
    celebrityId: tie.id,
  };
}

function updateTie(
  state: GameState,
  tieId: string,
  change: (tie: CelebrityTie) => CelebrityTie,
): GameState {
  return {
    ...state,
    celebrities: {
      ...state.celebrities,
      ties: state.celebrities.ties.map((tie) => (tie.id === tieId ? change(tie) : tie)),
    },
  };
}

export function doConnectionAction(
  state: GameState,
  tieId: string,
  actionId: string,
  /** The channel or business the action is about. Omitted, the best one. */
  targetId?: string,
): Result<ConnectionOutcome, ConnectionRefusal> {
  const refusal = whyNotConnection(state, tieId, actionId);
  if (refusal !== undefined) return err(refusal);
  const tie = findTie(state, tieId)!;
  const action = findConnectionAction(actionId)!;
  const seed = state.rng.getSeed();
  const year = state.world.year;
  const figure = figureById(seed, tie.id)!;
  const fame = fameIn(figure, year);
  const warmth = warmthOf(state, tie);
  const who = { name: tie.name, role: findCelebrityField(tie.field)?.role ?? 'a public figure' };
  const key = (part: string): string => `celeb:${year}:${tie.id}:${action.id}:${part}`;
  const worked =
    mixedUnit(`${seed}:connection:${year}:${state.world.generation}:${tie.id}:${action.id}`) <
    connectionOdds(state, warmth, action.id, fame);

  let next = state;
  let gained: number | undefined;
  let extra: Readonly<Record<string, string>> = {};

  if (worked && (action.id === 'collaborate' || action.id === 'invite')) {
    const shows = action.id === 'invite';
    const channel =
      (targetId === undefined
        ? undefined
        : state.channels.find(
            (candidate) =>
              candidate.id === targetId &&
              candidate.audience >= MIN_COLLAB_AUDIENCE &&
              (!shows || SHOW_PLATFORMS.includes(candidate.platformId)),
          )) ?? bestChannel(state, shows)!;
    const partnerId = `c:${tie.id}`;
    const repeats = channel.collabs?.[partnerId] ?? 0;
    const audience = Math.round(fameAudience(fame) * (shows ? GUEST_SHARE : 1));
    gained = collabGain(channel.audience, audience, repeats);
    const grown = channel.audience + gained;
    next = {
      ...next,
      channels: next.channels.map((candidate) =>
        candidate.id === channel.id
          ? {
              ...candidate,
              audience: grown,
              peak: Math.max(candidate.peak, grown),
              collabs: { ...candidate.collabs, [partnerId]: repeats + 1 },
            }
          : candidate,
      ),
    };
    extra = { channel: channel.name, gain: gained.toLocaleString('en-US') };
  }
  if (worked && action.id === 'endorse') {
    const business =
      state.businesses.find((candidate) => candidate.id === targetId) ?? state.businesses[0]!;
    const lift = Math.round(3 + fame / 10);
    next = {
      ...next,
      businesses: next.businesses.map((candidate) =>
        candidate.id === business.id
          ? { ...candidate, reputation: Math.min(100, candidate.reputation + lift) }
          : candidate,
      ),
    };
    extra = { business: business.name };
  }

  const text = say(
    `${action.id}${worked ? 'Ok' : 'Fail'}` as CelebrityLineKind,
    key('line'),
    who,
    extra,
  );
  const entries: TimelineEntry[] = [entryOf(state, 'relationship', text, key('entry'))];
  let timeline = appendToTimeline(next.player.timeline, entries[0]!);
  const felt =
    action.kind === 'professional' ? 0 : worked ? (action.id === 'getTogether' ? 3 : 1) : -1;
  const warmthNow = Math.min(100, Math.max(0, warmth + (worked ? action.onGood : action.onBad)));

  // Warmth moves on the friend in the circle once there is one, on the tie before that.
  let circle: SocialCircle = next.circle;
  let tieState = next;
  if (tie.promoted === true) {
    circle = {
      ...circle,
      people: circle.people.map((person) =>
        person.celebrityId === tie.id
          ? ({
              ...person,
              relationship: warmthNow,
              lastContactAge: state.player.age,
            } as Acquaintance)
          : person,
      ),
    };
  } else {
    tieState = updateTie(next, tie.id, (current) => ({ ...current, warmth: warmthNow }));
  }
  tieState = updateTie({ ...tieState, circle }, tie.id, (current) => ({
    ...current,
    lastContactYear: year,
    doneYear: year,
    done: current.doneYear === year ? [...current.done, action.id] : [action.id],
  }));

  // A warm enough connection becomes an ordinary friend, once.
  let becameFriend = false;
  if (tie.promoted !== true && warmthNow >= FRIEND_AT && !tie.endedYear) {
    becameFriend = true;
    const friend = promotedFriend(tie, figure, warmthNow, state.player.age);
    tieState = {
      ...updateTie(tieState, tie.id, (current) => ({ ...current, promoted: true as const })),
      circle: { ...tieState.circle, people: [...tieState.circle.people, friend] },
    };
    const line = entryOf(
      tieState,
      'relationship',
      say('friends', key('friends'), who),
      key('friends'),
    );
    entries.push(line);
    timeline = appendToTimeline(timeline, line);
  }

  return ok({
    state: {
      ...tieState,
      player: {
        ...tieState.player,
        stats:
          felt === 0
            ? tieState.player.stats
            : adjustStats(tieState.player.stats, { happiness: felt }),
        timeline,
      },
    },
    worked,
    ...(gained === undefined ? {} : { gained }),
    becameFriend,
    entries,
  });
}

/* -------------------------------------------------------------------------- */
/* A year turning                                                              */
/* -------------------------------------------------------------------------- */

export interface CelebrityYear {
  readonly celebrities: CelebrityState;
  readonly circle: SocialCircle;
  readonly lines: readonly { readonly kind: 'relationship'; readonly text: string }[];
}

/**
 * Connections cool without contact, and end when the person dies. A friend in the circle
 * who dies is ended there too. Nothing here draws from the random stream.
 */
export function runCelebrityYear(input: {
  readonly seed: string;
  /** The year that has just come in. */
  readonly year: number;
  readonly age: number;
  readonly celebrities: CelebrityState;
  readonly circle: SocialCircle;
}): CelebrityYear {
  const lines: { readonly kind: 'relationship'; readonly text: string }[] = [];
  let circle = input.circle;
  const ties = input.celebrities.ties.map((tie) => {
    if (tie.endedYear !== undefined) return tie;
    const figure = figureById(input.seed, tie.id);
    const who = { name: tie.name, role: findCelebrityField(tie.field)?.role ?? 'a public figure' };
    if (figure !== undefined && deathYearOf(figure) < input.year) {
      lines.push({
        kind: 'relationship',
        text: say('died', `celeb:died:${input.year}:${tie.id}`, who),
      });
      if (tie.promoted === true) {
        circle = {
          ...circle,
          people: circle.people.map((person) =>
            person.celebrityId === tie.id
              ? { ...endPerson(person, input.age, 'died'), alive: false }
              : person,
          ),
        };
      }
      return { ...tie, endedYear: input.year, endedBecause: 'died' as const };
    }
    // An ordinary friend cools through the circle's own drift; only a tie before that cools here.
    if (tie.promoted === true) return tie;
    // Contact in the year that has just been played keeps it warm; a year with none costs a little.
    if (tie.lastContactYear >= input.year - 1) return tie;
    const warmth = tie.warmth - COOLING;
    if (warmth < LOST_BELOW) {
      lines.push({
        kind: 'relationship',
        text: say('lostTouch', `celeb:lost:${input.year}:${tie.id}`, who),
      });
      return {
        ...tie,
        warmth: Math.max(0, warmth),
        endedYear: input.year,
        endedBecause: 'lost touch' as const,
      };
    }
    return { ...tie, warmth };
  });
  return { celebrities: { ...input.celebrities, ties }, circle, lines };
}
