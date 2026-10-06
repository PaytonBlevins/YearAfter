/**
 * Ticket 0705 acceptance tests — the celebrity world.
 *
 * The world (who is famous, when) is a pure function of the seed, so most of it is tested
 * on its own. The meetings, the six actions, the second menu and the year are tested in the
 * game, through the same state a player would have.
 */

import { describe, expect, it } from 'vitest';
import {
  CELEBRITY_FIELD_CATALOG,
  CELEBRITY_LINES,
  CONNECTION_MENU,
  NAME_CULTURES,
  ENCOUNTER_MENU,
  celebrityLine,
  findCelebrityField,
} from '@yearafter/content';
import { cents } from '@yearafter/core';
import { MIN_COLLAB_AUDIENCE, collabGain, type Channel } from '@yearafter/finance';
import { partnerOf } from '@yearafter/social';
import { advanceYear } from './advance';
import {
  BREAKTHROUGH_SHARE,
  EARLY_DEATH,
  LEGACY_FADE,
  LEGACY_SHARE,
  NOTABLE_FAME,
  SLOTS_PER_YEAR,
  careerEndOf,
  deathYearOf,
  displayFigure,
  fameIn,
  figureById,
  isAlive,
  isWorking,
  notablesIn,
  type Figure,
} from './celebrity-world';
import {
  BIG_ENOUGH,
  COOLING,
  ENCOUNTER_BASE,
  ENCOUNTER_FROM_AGE,
  ENCOUNTER_FULL_AGE,
  ENCOUNTER_MAX,
  ENCOUNTER_YOUNG_SHARE,
  EMPTY_CELEBRITIES,
  FILMED_CHANCE,
  FILMED_FROM_FAME,
  FLIRT_GAP,
  SCENE_FROM,
  candidateWeight,
  fieldPull,
  sceneFor,
  FRIEND_AT,
  GUEST_SHARE,
  LOST_BELOW,
  MAX_TIES,
  TIE_START,
  answerEncounter,
  connectionMenu,
  connectionOdds,
  connectionRows,
  doConnectionAction,
  encounterChance,
  encounterFor,
  encounterMenu,
  encounterMultiplier,
  encounterOdds,
  fameAudience,
  fameFactor,
  hubFactor,
  pullsOf,
  runCelebrityYear,
  standingOf,
  warmthOf,
  wealthFactor,
  whyNotConnection,
  whyNotFlirt,
  type CelebrityTie,
} from './celebrity';
import { decide } from './decide';
import type { GameState } from './game-state';
import { continueAsChild, heirsIn } from './continue';
import { createNewGame } from './new-game';

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

function liveTo(seed: string, age: number): GameState {
  let state = createNewGame({ seed });
  let guard = 0;
  while (state.player.alive && state.player.age < age && (guard += 1) < 80) {
    state = answerEverything(advanceYear(state).state);
  }
  return state;
}

const ADULT = liveTo('celeb-adult', 30);

/** The same character with a given amount held. */
const withCash = (state: GameState, dollars: number): GameState => {
  const balance = cents(dollars * 100);
  const books = {
    ...state.finance,
    balance,
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:celeb-${dollars}`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: cents(dollars * 100 - Number(state.finance.balance)),
        source: 'A test windfall',
      },
    ],
  };
  return { ...state, finance: books, player: { ...state.player, cash: balance } };
};

const withFame = (state: GameState, fame: number): GameState => ({ ...state, fame });
const withAge = (state: GameState, age: number): GameState => ({
  ...state,
  player: { ...state.player, age },
});

const channel = (over: Partial<Channel> = {}): Channel =>
  ({
    id: 'ch:2040:video:education',
    name: 'The Test Show',
    platformId: 'video',
    categoryId: 'education',
    openedYear: 2040,
    luck: 0.5,
    audience: 40_000,
    peak: 40_000,
    effort: 'regular',
    paid: false,
    ...over,
  }) as unknown as Channel;

/** The first state, among many lives and years, with a stranger in its path. */
function findEncounter(prefix: string, fame = 60): GameState {
  for (let i = 0; i < 400; i += 1) {
    let state = withFame(withCash(liveTo(`${prefix}-${i}`, 24), 800_000), fame);
    for (let step = 0; step < 14; step += 1) {
      if (encounterFor(state) !== undefined) return state;
      state = withFame(advanceYear(state).state, fame);
      state = answerEverything(state);
      if (!state.player.alive) break;
    }
  }
  throw new Error('no encounter found');
}

const MEETING = findEncounter('celeb-meet');

/** A connected state: the same meeting, answered so that a tie exists. */
function connected(base: GameState = MEETING, actionId = 'compliment'): GameState {
  // Walk through years until the answer connects: a deterministic search, not a roll.
  let state = base;
  for (let i = 0; i < 60; i += 1) {
    const result = encounterFor(state) === undefined ? undefined : answerEncounter(state, actionId);
    if (result?.ok && result.value.connected) return result.value.state;
    state = withFame(answerEverything(advanceYear(state).state), 90);
    state = withCash(state, 800_000);
    if (!state.player.alive) break;
  }
  throw new Error('never connected');
}

const CONNECTED = connected();
const TIE = CONNECTED.celebrities.ties[0]!;

describe('the world: who is famous', () => {
  const SEED = 'world-a';

  it('is the same every time for the same seed and year, and different for another seed', () => {
    const a = notablesIn(SEED, 2050).map((figure) => figure.id);
    expect(notablesIn(SEED, 2050).map((figure) => figure.id)).toEqual(a);
    expect(notablesIn('world-b', 2050).map((figure) => figure.id)).not.toEqual(a);
  });

  it('rebuilds any figure from its id, alive or dead, and refuses an id that is not one', () => {
    const figure = notablesIn(SEED, 2050)[0]!;
    expect(figureById(SEED, figure.id)).toEqual(figure);
    expect(figureById(SEED, 'acting:1990:9')).toBeUndefined();
    expect(figureById(SEED, 'sailing:1990:0')).toBeUndefined();
    expect(figureById(SEED, 'acting:abc:0')).toBeUndefined();
    expect(figureById(SEED, 'acting:1990:-1')).toBeUndefined();
    expect(figureById(SEED, 'nonsense')).toBeUndefined();
    expect(figureById(SEED, `acting:1990:${SLOTS_PER_YEAR}`)).toBeUndefined();
  });

  it('holds about a hundred and fifty to two hundred names, a few dozen household names, a handful of global stars', () => {
    for (const seed of ['w1', 'w2', 'w3', 'w4']) {
      for (const year of [2030, 2075, 2120]) {
        const all = notablesIn(seed, year);
        const fames = all.map((figure) => fameIn(figure, year));
        expect(all.length).toBeGreaterThan(120);
        expect(all.length).toBeLessThan(230);
        expect(fames.every((fame) => fame >= NOTABLE_FAME && fame <= 100)).toBe(true);
        expect(fames.filter((fame) => fame >= 60).length).toBeGreaterThan(8);
        expect(fames.filter((fame) => fame >= 60).length).toBeLessThan(50);
        expect(fames.filter((fame) => fame >= 85).length).toBeLessThan(16);
      }
    }
  });

  it('has people in every field, and no field is most of it', () => {
    const all = notablesIn(SEED, 2060);
    for (const field of CELEBRITY_FIELD_CATALOG) {
      const share = all.filter((figure) => figure.field === field.id).length / all.length;
      expect(share).toBeGreaterThan(0.06);
      expect(share).toBeLessThan(0.35);
    }
  });

  it('fame is nothing before they break through and after they die, and never above their peak', () => {
    for (const figure of notablesIn(SEED, 2060).slice(0, 40)) {
      expect(fameIn(figure, figure.birthYear + figure.debut - 1)).toBe(0);
      expect(fameIn(figure, deathYearOf(figure) + 1)).toBe(0);
      for (let year = figure.birthYear; year <= deathYearOf(figure); year += 1) {
        expect(fameIn(figure, year)).toBeLessThanOrEqual(figure.peak);
      }
    }
  });

  it('climbs, holds near the top, comes down to a legacy and then fades', () => {
    const figure: Figure = {
      id: 'acting:1990:0',
      field: 'acting',
      firstName: 'Test',
      lastName: 'Star',
      sex: 'female',
      birthYear: 1990,
      debut: 20,
      rise: 10,
      hold: 10,
      retire: 60,
      dies: 90,
      peak: 80,
    };
    const at = (age: number): number => fameIn(figure, 1990 + age);
    expect(at(19)).toBe(0);
    expect(at(20)).toBe(Math.round(80 * BREAKTHROUGH_SHARE));
    expect(at(25)).toBeGreaterThan(at(20));
    expect(at(29)).toBeGreaterThan(at(25));
    expect(at(30)).toBe(80);
    expect(at(40)).toBe(80);
    expect(at(41)).toBeLessThan(80);
    expect(at(55)).toBeLessThan(at(41));
    expect(at(60)).toBe(Math.round(80 * LEGACY_SHARE));
    expect(at(70)).toBeLessThan(at(60));
    expect(at(70)).toBeGreaterThan(0);
    expect(at(90)).toBeGreaterThan(0);
    expect(at(91)).toBe(0);
    expect(careerEndOf(figure)).toBe(60);
    expect(isWorking(figure, 1990 + 60)).toBe(true);
    expect(isWorking(figure, 1990 + 61)).toBe(false);
    expect(isWorking(figure, 1990 + 19)).toBe(false);
    expect(isAlive(figure, 1990 + 90)).toBe(true);
    expect(isAlive(figure, 1990 + 91)).toBe(false);
  });

  it('a career that would end before it peaks is carried to the end of its peak', () => {
    const figure: Figure = {
      id: 'athletics:1990:0',
      field: 'athletics',
      firstName: 'Test',
      lastName: 'Runner',
      sex: 'male',
      birthYear: 1990,
      debut: 18,
      rise: 8,
      hold: 12,
      retire: 33,
      dies: 80,
      peak: 90,
    };
    expect(careerEndOf(figure)).toBe(38);
  });

  it('some die young, most do not, and names turn over: fifty years on the roster is mostly new', () => {
    let young = 0;
    let total = 0;
    for (let birth = 1940; birth < 1990; birth += 1) {
      for (const field of CELEBRITY_FIELD_CATALOG) {
        for (let slot = 0; slot < SLOTS_PER_YEAR; slot += 1) {
          const figure = figureById(SEED, `${field.id}:${birth}:${slot}`);
          if (figure === undefined) continue;
          total += 1;
          if (figure.dies < 56) young += 1;
        }
      }
    }
    expect(young / total).toBeGreaterThan(EARLY_DEATH * 0.4);
    expect(young / total).toBeLessThan(EARLY_DEATH * 2);
    // Legends linger, so a few survive half a century; but the roster is mostly new faces.
    const now = new Set(notablesIn(SEED, 2040).map((figure) => figure.id));
    const later = notablesIn(SEED, 2090).map((figure) => figure.id);
    expect(later.filter((id) => now.has(id)).length / later.length).toBeLessThan(0.15);
  });

  it('names come from the name cultures, and a figure has a full name', () => {
    for (const figure of notablesIn(SEED, 2060).slice(0, 30)) {
      expect(figure.firstName.length).toBeGreaterThan(0);
      expect(figure.lastName.length).toBeGreaterThan(0);
      expect(displayFigure(figure)).toBe(`${figure.firstName} ${figure.lastName}`);
    }
  });

  it('a field never debuts, retires or lives outside its own ranges', () => {
    for (const figure of notablesIn(SEED, 2060)) {
      const field = findCelebrityField(figure.field)!;
      expect(figure.debut).toBeGreaterThanOrEqual(field.debut[0]);
      expect(figure.debut).toBeLessThanOrEqual(field.debut[1]);
      expect(figure.rise).toBeGreaterThanOrEqual(field.rise[0]);
      expect(figure.rise).toBeLessThanOrEqual(field.rise[1]);
      expect(figure.hold).toBeGreaterThanOrEqual(field.hold[0]);
      expect(figure.hold).toBeLessThanOrEqual(field.hold[1]);
      expect(figure.retire).toBeGreaterThanOrEqual(field.retire[0]);
      expect(figure.retire).toBeLessThanOrEqual(field.retire[1]);
    }
  });
});

describe('how likely a meeting is', () => {
  it('the factors are what they say at their ends', () => {
    expect(hubFactor(0)).toBeCloseTo(0.6, 6);
    expect(hubFactor(130)).toBeCloseTo(2, 6);
    expect(hubFactor(1000)).toBeCloseTo(2, 6);
    expect(hubFactor(65)).toBeCloseTo(1.3, 6);
    expect(wealthFactor(0)).toBe(1);
    expect(wealthFactor(-50_000)).toBe(1);
    expect(wealthFactor(1_000_000)).toBeCloseTo(1 + 0.9 * Math.log10(5), 6);
    expect(wealthFactor(1e15)).toBe(3);
    expect(fameFactor(0)).toBe(1);
    expect(fameFactor(50)).toBe(3);
    expect(fameFactor(100)).toBe(5);
  });

  it('is nothing for a baby, half for a child, and the base for an adult with nothing going for them', () => {
    const plain = { ...ADULT, fame: 0, channels: [], businesses: [] };
    expect(encounterChance(withAge(plain, ENCOUNTER_FROM_AGE - 1))).toBe(0);
    const child = encounterChance(withAge(plain, ENCOUNTER_FULL_AGE - 1));
    const adult = encounterChance(withAge(plain, ENCOUNTER_FULL_AGE));
    expect(child).toBeCloseTo(adult * ENCOUNTER_YOUNG_SHARE, 10);
    expect(adult).toBeGreaterThan(ENCOUNTER_BASE * 0.5);
    expect(adult).toBeLessThan(ENCOUNTER_BASE * 2);
    expect(encounterChance({ ...plain, player: { ...plain.player, alive: false } })).toBe(0);
  });

  it('rises with fame, with money, with a channel and with a business, one at a time', () => {
    const plain = { ...ADULT, fame: 0, channels: [], businesses: [] };
    const base = encounterChance(plain);
    expect(encounterChance(withFame(plain, 40))).toBeGreaterThan(base);
    expect(encounterChance(withCash(plain, 5_000_000))).toBeGreaterThan(base);
    expect(encounterChance({ ...plain, channels: [channel()] })).toBeGreaterThan(base);
    expect(
      encounterChance({
        ...plain,
        businesses: [{ id: 'b' } as unknown as GameState['businesses'][0]],
      }),
    ).toBeGreaterThan(base);
  });

  it('a channel with nobody watching does not count as a network', () => {
    const plain = { ...ADULT, fame: 0, channels: [], businesses: [] };
    expect(encounterChance({ ...plain, channels: [channel({ audience: 10 })] })).toBe(
      encounterChance(plain),
    );
  });

  it('multiplies the parts, and is capped', () => {
    const pulls = { hub: 2, wealth: 3, fame: 5, channel: true, business: true };
    expect(encounterMultiplier(pulls)).toBeCloseTo(2 * 3 * 5 * 1.5, 10);
    expect(encounterMultiplier({ ...pulls, business: false })).toBeCloseTo(2 * 3 * 5 * 1.25, 10);
    expect(
      encounterMultiplier({ hub: 1, wealth: 1, fame: 1, channel: false, business: false }),
    ).toBe(1);
    const top = withFame(withCash({ ...ADULT, channels: [channel()] }, 1e9), 100);
    expect(pullsOf(top).channel).toBe(true);
    expect(encounterChance(top)).toBe(
      Math.min(ENCOUNTER_MAX, ENCOUNTER_BASE * encounterMultiplier(pullsOf(top))),
    );
    // Everything at its best would be well over the cap, and the cap holds.
    expect(
      ENCOUNTER_BASE *
        encounterMultiplier({ hub: 2, wealth: 3, fame: 5, channel: true, business: true }),
    ).toBeGreaterThan(ENCOUNTER_MAX);
  });

  it('happens in about the share of years the chance says, over many years', () => {
    const state = { ...ADULT, fame: 0, channels: [], businesses: [] };
    const chance = encounterChance(state);
    let hits = 0;
    const years = 4_000;
    for (let year = 3000; year < 3000 + years; year += 1) {
      if (encounterFor({ ...state, world: { ...state.world, year } }) !== undefined) hits += 1;
    }
    expect(hits / years).toBeGreaterThan(chance * 0.7);
    expect(hits / years).toBeLessThan(chance * 1.3);
  });

  it('a famous player is met more often than an unknown one, by about what fame is worth', () => {
    const state = { ...ADULT, fame: 0, channels: [], businesses: [] };
    const count = (fame: number): number => {
      let hits = 0;
      for (let year = 3000; year < 5000; year += 1) {
        if (encounterFor({ ...withFame(state, fame), world: { ...state.world, year } })) hits += 1;
      }
      return hits;
    };
    expect(count(60)).toBeGreaterThan(count(0) * 2);
  });
});

describe('a stranger in your path', () => {
  it('is the same person for the same life and year, and appears once', () => {
    const a = encounterFor(MEETING)!;
    const b = encounterFor(MEETING)!;
    expect(b.figure.id).toBe(a.figure.id);
    expect(b.text).toBe(a.text);
    expect(a.year).toBe(MEETING.world.year);
    expect(a.fame).toBe(fameIn(a.figure, a.year));
    expect(a.fame).toBeGreaterThanOrEqual(NOTABLE_FAME);
    expect(a.text).toContain(displayFigure(a.figure));
    expect(a.text).toContain(findCelebrityField(a.figure.field)!.role);
  });

  it('is never someone already met, or someone you are in touch with', () => {
    const first = encounterFor(MEETING)!;
    const seen = { ...MEETING, celebrities: { ...MEETING.celebrities, met: [first.figure.id] } };
    const second = encounterFor(seen);
    expect(second?.figure.id).not.toBe(first.figure.id);
    const tied = {
      ...MEETING,
      celebrities: { ...MEETING.celebrities, ties: [{ ...TIE, id: first.figure.id }] },
    };
    expect(encounterFor(tied)?.figure.id).not.toBe(first.figure.id);
  });

  it('shows the six actions in the spec order, and marks none as impossible for an adult who is single', () => {
    const single = {
      ...MEETING,
      circle: {
        ...MEETING.circle,
        people: MEETING.circle.people.filter((p) => p.romance === undefined),
      },
    };
    expect(encounterMenu(single).map((row) => row.id)).toEqual([
      'compliment',
      'flirt',
      'autograph',
      'picture',
      'insult',
      'ignore',
    ]);
    expect(ENCOUNTER_MENU).toHaveLength(6);
    for (const row of encounterMenu(single)) {
      if (row.id !== 'flirt') expect(row.refusal).toBeUndefined();
    }
  });

  it('refuses every action when there is nobody to meet', () => {
    const none = {
      ...MEETING,
      celebrities: { ...MEETING.celebrities, answeredYear: MEETING.world.year },
    };
    expect(encounterFor(none)).toBeUndefined();
    expect(encounterMenu(none).every((row) => row.refusal?.kind === 'noEncounter')).toBe(true);
    const result = answerEncounter(none, 'compliment');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('noEncounter');
  });

  it('refuses an action that is not on the menu', () => {
    const result = answerEncounter(MEETING, 'propose');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('noSuchAction');
  });

  it('flirting is for adults, within fifteen years, and not for somebody who is taken', () => {
    const year = MEETING.world.year;
    const single = {
      ...MEETING,
      player: { ...MEETING.player, age: 40 },
      circle: { ...MEETING.circle, people: [] },
    };
    const born = (figureAge: number) => ({ birthYear: year - figureAge });
    expect(whyNotFlirt(single, born(40), year)).toBeUndefined();
    expect(whyNotFlirt(withAge(single, 17), born(17), year)?.kind).toBe('tooYoung');
    expect(whyNotFlirt(single, born(17), year)?.kind).toBe('tooYoung');
    expect(whyNotFlirt(single, born(40 + FLIRT_GAP + 1), year)?.kind).toBe('tooFarApart');
    expect(whyNotFlirt(single, born(40 - FLIRT_GAP - 1), year)?.kind).toBe('tooFarApart');
    expect(whyNotFlirt(single, born(40 + FLIRT_GAP), year)).toBeUndefined();
    expect(whyNotFlirt(single, born(40 - FLIRT_GAP), year)).toBeUndefined();
    // Somebody with a partner is not flirting with a stranger.
    expect(partnerOf(CONNECTED.circle.people)).toBeDefined();
    expect(whyNotFlirt(CONNECTED, born(CONNECTED.player.age), year)?.kind).toBe(
      'alreadyWithSomeone',
    );
  });

  it('autograph, picture and compliment feel good when they land and a little bad when they do not', () => {
    const outcomes = new Set<boolean>();
    for (let i = 0; i < 40; i += 1) {
      const state = findEncounter(`celeb-feel-${i}`, 20);
      const before = state.player.stats.happiness;
      const result = answerEncounter(state, 'autograph');
      if (!result.ok) continue;
      outcomes.add(result.value.worked);
      const delta = result.value.state.player.stats.happiness - before;
      if (result.value.worked) expect(delta).toBeGreaterThanOrEqual(0);
      else expect(delta).toBeLessThanOrEqual(0);
      if (outcomes.size === 2) break;
    }
    expect(outcomes.size).toBe(2);
  });

  it('answering writes the line, marks the year answered and offers nobody else', () => {
    const result = answerEncounter(MEETING, 'ignore');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state;
    expect(after.celebrities.answeredYear).toBe(MEETING.world.year);
    expect(after.celebrities.met).toContain(encounterFor(MEETING)!.figure.id);
    expect(encounterFor(after)).toBeUndefined();
    expect(result.value.entries).toHaveLength(1);
    expect(result.value.entries[0]!.kind).toBe('relationship');
    expect(after.player.timeline.length).toBe(MEETING.player.timeline.length + 1);
    expect(result.value.connected).toBe(false);
    expect(after.celebrities.ties).toEqual(MEETING.celebrities.ties);
  });

  it('ignoring and insulting never lead anywhere; insulting stings, and a famous person may be filmed', () => {
    const state = MEETING;
    const ignored = answerEncounter(state, 'ignore');
    expect(ignored.ok && ignored.value.state.player.stats.happiness).toBe(
      state.player.stats.happiness,
    );
    const insulted = answerEncounter(state, 'insult');
    expect(insulted.ok && insulted.value.connected).toBe(false);
    expect(insulted.ok && insulted.value.state.player.stats.happiness).toBeLessThan(
      state.player.stats.happiness,
    );
    // Filmed only for somebody who is famous enough, and only some of the time.
    let filmed = 0;
    let rude = 0;
    for (let i = 0; i < 60; i += 1) {
      const meeting = findEncounter(`celeb-rude-${i}`, 30);
      const fame = encounterFor(meeting)!.fame;
      const result = answerEncounter(meeting, 'insult');
      if (!result.ok) continue;
      rude += 1;
      const dropped = meeting.player.stats.happiness - result.value.state.player.stats.happiness;
      if (dropped >= 3) {
        filmed += 1;
        expect(fame).toBeGreaterThanOrEqual(FILMED_FROM_FAME);
      }
    }
    expect(rude).toBeGreaterThan(30);
    expect(filmed).toBeGreaterThan(0);
    expect(filmed).toBeLessThan(rude / 2);
  });

  it('a good meeting sometimes leaves a connection, never more than are allowed, and never for the same person twice', () => {
    expect(CONNECTED.celebrities.ties).toHaveLength(1);
    expect(TIE.warmth).toBe(TIE_START);
    expect(TIE.lastContactYear).toBe(CONNECTED.world.year);
    expect(CONNECTED.celebrities.answeredYear).toBe(CONNECTED.world.year);
    const full = {
      ...MEETING,
      celebrities: {
        ...MEETING.celebrities,
        ties: Array.from({ length: MAX_TIES }, (_, i) => ({ ...TIE, id: `acting:1900:${i}` })),
      },
    };
    for (const actionId of ['compliment', 'autograph', 'picture', 'flirt']) {
      const result = answerEncounter(full, actionId);
      if (result.ok) expect(result.value.connected).toBe(false);
    }
  });

  it('the same state gives the same answer', () => {
    const a = answerEncounter(MEETING, 'compliment');
    const b = answerEncounter(MEETING, 'compliment');
    expect(
      a.ok && b.ok && a.value.worked === b.value.worked && a.value.connected === b.value.connected,
    ).toBe(true);
    expect(a.ok && b.ok && a.value.entries[0]!.text === b.value.entries[0]!.text).toBe(true);
  });
});

describe('how likely an action is to land', () => {
  const state = { ...ADULT, fame: 0 };

  it('is the base, eased for how famous they are, and the six that cannot land are zero', () => {
    for (const action of ENCOUNTER_MENU) {
      const odds = encounterOdds(state, action.id, 0);
      if (action.base === 0) expect(odds).toBe(0);
      else {
        expect(odds).toBeGreaterThanOrEqual(0.03);
        expect(odds).toBeLessThanOrEqual(0.95);
      }
    }
    expect(encounterOdds(state, 'compliment', 90)).toBeLessThan(
      encounterOdds(state, 'compliment', 0),
    );
    expect(encounterOdds(state, 'flirt', 0)).toBeLessThan(encounterOdds(state, 'compliment', 0));
    expect(encounterOdds(state, 'autograph', 0)).toBeGreaterThan(
      encounterOdds(state, 'compliment', 0),
    );
  });

  it('is better with looks and charisma, and better still with a following of your own', () => {
    const plain = {
      ...state,
      player: { ...state.player, stats: { ...state.player.stats, looks: 20, charisma: 20 } },
    };
    const charming = {
      ...state,
      player: { ...state.player, stats: { ...state.player.stats, looks: 90, charisma: 90 } },
    };
    expect(encounterOdds(charming, 'compliment', 40)).toBeGreaterThan(
      encounterOdds(plain, 'compliment', 40),
    );
    expect(encounterOdds({ ...plain, fame: 70 }, 'compliment', 40)).toBeGreaterThan(
      encounterOdds(plain, 'compliment', 40),
    );
  });

  it('is capped and floored, however it is stacked', () => {
    const best = {
      ...state,
      fame: 100,
      player: { ...state.player, stats: { ...state.player.stats, looks: 100, charisma: 100 } },
    };
    const worst = {
      ...state,
      fame: 0,
      player: { ...state.player, stats: { ...state.player.stats, looks: 0, charisma: 0 } },
    };
    expect(encounterOdds(best, 'autograph', 0)).toBe(0.95);
    expect(encounterOdds(worst, 'flirt', 100)).toBe(0.03);
  });
});

describe('the second menu', () => {
  it('lists the connections the player has, and nobody else', () => {
    const rows = connectionRows(CONNECTED);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(TIE.id);
    expect(rows[0]!.name).toBe(TIE.name);
    expect(rows[0]!.active).toBe(true);
    expect(rows[0]!.friend).toBe(false);
    expect(rows[0]!.bond).toBe('acquaintance');
    expect(connectionRows(createNewGame({ seed: 'celeb-none' }))).toEqual([]);
  });

  it('names how well known they are', () => {
    expect(standingOf(12)).toBe('a rising name');
    expect(standingOf(29)).toBe('a rising name');
    expect(standingOf(30)).toBe('well known');
    expect(standingOf(59)).toBe('well known');
    expect(standingOf(60)).toBe('a household name');
    expect(standingOf(84)).toBe('a household name');
    expect(standingOf(85)).toBe('a global star');
  });

  it('offers the social things at once, and the rest when they are close enough', () => {
    const rows = connectionMenu(CONNECTED, TIE.id);
    expect(rows.map((row) => row.id)).toEqual(CONNECTION_MENU.map((action) => action.id));
    const refusal = (id: string) => rows.find((row) => row.id === id)?.refusal?.kind;
    expect(refusal('catchUp')).toBeUndefined();
    expect(refusal('compliment')).toBeUndefined();
    expect(refusal('getTogether')).toBeUndefined();
    expect(refusal('flirt')).toBe('notCloseEnough');
  });

  it('refuses what is not about anybody the player knows', () => {
    expect(whyNotConnection(CONNECTED, 'acting:1900:0', 'catchUp')?.kind).toBe('noSuchTie');
    expect(whyNotConnection(CONNECTED, TIE.id, 'elope')?.kind).toBe('noSuchAction');
  });

  it('every action keeps to what it asks for: a creator, a show, a business', () => {
    const warm: GameState = {
      ...CONNECTED,
      celebrities: {
        ...CONNECTED.celebrities,
        ties: CONNECTED.celebrities.ties.map((tie) => ({ ...tie, warmth: 80, field: 'business' })),
      },
      channels: [],
      businesses: [],
    };
    const kind = (id: string) => whyNotConnection(warm, TIE.id, id)?.kind;
    expect(kind('collaborate')).toBe('notTheirField');
    expect(kind('invite')).toBe('noShow');
    expect(kind('endorse')).toBe('noBusiness');
    const withShow = { ...warm, channels: [channel({ platformId: 'photo' })] };
    expect(whyNotConnection(withShow, TIE.id, 'invite')?.kind).toBe('noShow');
    const small = { ...warm, channels: [channel({ audience: 50 })] };
    expect(whyNotConnection(small, TIE.id, 'invite')?.kind).toBe('noShow');
  });

  it('a tie that ended is not around, and nothing can be done with them', () => {
    const over: GameState = {
      ...CONNECTED,
      celebrities: {
        ...CONNECTED.celebrities,
        ties: CONNECTED.celebrities.ties.map((tie) => ({
          ...tie,
          endedYear: CONNECTED.world.year,
          endedBecause: 'lost touch' as const,
        })),
      },
    };
    expect(whyNotConnection(over, TIE.id, 'catchUp')?.kind).toBe('notAround');
    expect(connectionRows(over)[0]!.active).toBe(false);
    const gone = { ...over, world: { ...over.world, year: over.world.year + 200 } };
    expect(
      whyNotConnection(
        { ...gone, celebrities: { ...over.celebrities, ties: CONNECTED.celebrities.ties } },
        TIE.id,
        'catchUp',
      )?.kind,
    ).toBe('notAround');
  });

  it('what is done once a year is done once a year, and a new year starts again', () => {
    const result = doConnectionAction(CONNECTED, TIE.id, 'catchUp');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(whyNotConnection(result.value.state, TIE.id, 'catchUp')?.kind).toBe('doneThisYear');
    expect(whyNotConnection(result.value.state, TIE.id, 'compliment')).toBeUndefined();
    const again = doConnectionAction(result.value.state, TIE.id, 'catchUp');
    expect(again.ok).toBe(false);
    const nextYear = {
      ...result.value.state,
      world: { ...result.value.state.world, year: CONNECTED.world.year + 1 },
    };
    expect(whyNotConnection(nextYear, TIE.id, 'catchUp')).toBeUndefined();
  });

  it('the odds rise with how well you know them, and with fame of your own, and are capped', () => {
    const state = { ...CONNECTED, fame: 0 };
    for (const action of CONNECTION_MENU) {
      const cold = connectionOdds(state, action.minWarmth, action.id, 50);
      const warm = connectionOdds(state, 100, action.id, 50);
      expect(warm).toBeGreaterThan(cold);
      expect(cold).toBeGreaterThanOrEqual(0.03);
      expect(warm).toBeLessThanOrEqual(0.95);
    }
    expect(connectionOdds({ ...state, fame: 80 }, 50, 'catchUp', 50)).toBeGreaterThan(
      connectionOdds(state, 50, 'catchUp', 50),
    );
    expect(connectionOdds(state, 50, 'collaborate', 90)).toBeLessThan(
      connectionOdds(state, 50, 'collaborate', 10),
    );
    expect(connectionOdds(state, 50, 'catchUp', 90)).toBe(connectionOdds(state, 50, 'catchUp', 10));
    expect(connectionOdds(state, 50, 'elope' as never, 50)).toBe(0);
  });

  it('warmth moves by what the action says, up when it lands and down when it does not', () => {
    const seen = new Set<boolean>();
    for (let i = 0; i < 30; i += 1) {
      const state = connected(findEncounter(`celeb-warm-${i}`, 30));
      const tie = state.celebrities.ties[0]!;
      const result = doConnectionAction(state, tie.id, 'compliment');
      if (!result.ok) continue;
      const action = CONNECTION_MENU.find((a) => a.id === 'compliment')!;
      const after = result.value.state.celebrities.ties[0]!;
      seen.add(result.value.worked);
      expect(after.warmth).toBe(
        Math.max(
          0,
          Math.min(100, tie.warmth + (result.value.worked ? action.onGood : action.onBad)),
        ),
      );
      expect(after.lastContactYear).toBe(state.world.year);
      expect(after.done).toEqual(['compliment']);
      expect(after.doneYear).toBe(state.world.year);
      if (seen.size === 2) break;
    }
    expect(seen.size).toBe(2);
  });
});

describe('becoming an ordinary friend', () => {
  /** A connection warm enough that one more good moment makes them a friend. */
  const nearly: GameState = {
    ...CONNECTED,
    fame: 100,
    celebrities: {
      ...CONNECTED.celebrities,
      ties: CONNECTED.celebrities.ties.map((tie) => ({ ...tie, warmth: FRIEND_AT - 1 })),
    },
  };

  function becomeFriend(): GameState {
    // The roll is a fixed draw per year, so try years until the one that lands.
    for (let year = nearly.world.year; year < nearly.world.year + 200; year += 1) {
      const state = { ...nearly, world: { ...nearly.world, year } };
      const result = doConnectionAction(state, TIE.id, 'getTogether');
      if (result.ok && result.value.becameFriend) return result.value.state;
    }
    throw new Error('never became a friend');
  }

  it('puts them in the circle, once, with the warmth the connection had', () => {
    const state = becomeFriend();
    const friends = state.circle.people.filter((person) => person.celebrityId === TIE.id);
    expect(friends).toHaveLength(1);
    const friend = friends[0]!;
    expect(friend.context).toBe('fame');
    expect(friend.kind).toBe('peer');
    expect(friend.firstName + ' ' + friend.lastName).toBe(TIE.name);
    expect(friend.relationship).toBeGreaterThanOrEqual(FRIEND_AT);
    expect(friend.inRoom).toBe(false);
    expect(friend.endedAtAge).toBeUndefined();
    const tie = state.celebrities.ties[0]!;
    expect(tie.promoted).toBe(true);
    expect(warmthOf(state, tie)).toBe(friend.relationship);
    expect(state.player.timeline.at(-1)!.text.length).toBeGreaterThan(0);
  });

  it('after that warmth lives on the friend, and the tie is not asked', () => {
    const state = becomeFriend();
    const tie = state.celebrities.ties[0]!;
    const friend = state.circle.people.find((person) => person.celebrityId === TIE.id)!;
    const changed: GameState = {
      ...state,
      circle: {
        ...state.circle,
        people: state.circle.people.map((person) =>
          person.id === friend.id
            ? { ...person, relationship: 77 as typeof person.relationship }
            : person,
        ),
      },
    };
    expect(warmthOf(changed, tie)).toBe(77);
    expect(connectionRows(changed)[0]!.bond).toBe('close friend');
    expect(connectionRows(changed)[0]!.friend).toBe(true);
    // Doing something with them moves the friend, not the tie.
    const next = { ...changed, world: { ...changed.world, year: changed.world.year + 1 } };
    const result = doConnectionAction(next, TIE.id, 'catchUp');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const moved = result.value.state.circle.people.find((person) => person.celebrityId === TIE.id)!;
    expect(moved.relationship).not.toBe(77);
    expect(result.value.state.celebrities.ties[0]!.warmth).toBe(tie.warmth);
    expect(result.value.becameFriend).toBe(false);
    expect(
      result.value.state.circle.people.filter((person) => person.celebrityId === TIE.id),
    ).toHaveLength(1);
  });

  it('romance goes through the friends list, not this menu', () => {
    const state = becomeFriend();
    const rows = connectionMenu(state, TIE.id);
    expect(rows.find((row) => row.id === 'flirt')?.refusal?.kind).toBe('friendsNow');
    const refused = doConnectionAction(state, TIE.id, 'flirt');
    expect(refused.ok).toBe(false);
  });
});

/** A real figure of a field who is well known in the state's year, as a warm connection. */
function connectionTo(state: GameState, field: string, minFame: number): CelebrityTie {
  const year = state.world.year;
  const figure = notablesIn(state.rng.getSeed(), year).find(
    (candidate) => candidate.field === field && fameIn(candidate, year) >= minFame,
  );
  if (figure === undefined) throw new Error(`no ${field} figure at ${minFame}`);
  return {
    id: figure.id,
    name: displayFigure(figure),
    sex: figure.sex,
    field: figure.field,
    birthYear: figure.birthYear,
    metYear: year - 2,
    metAtAge: state.player.age - 2,
    warmth: 90,
    lastContactYear: year - 1,
    doneYear: 0,
    done: [],
  };
}

const world = (
  over: Partial<GameState>,
  field: string,
  minFame: number,
): { state: GameState; tie: CelebrityTie } => {
  const base = withFame({ ...CONNECTED, ...over }, 100);
  const tie = connectionTo(base, field, minFame);
  return { state: { ...base, celebrities: { ...EMPTY_CELEBRITIES, ties: [tie] } }, tie };
};

/** The roll is a fixed draw per generation; try them until one lands, or until one does not. */
function attempt(state: GameState, id: string, actionId: string, lands: boolean, target?: string) {
  for (let generation = 0; generation < 400; generation += 1) {
    const trial = { ...state, world: { ...state.world, generation } };
    const result = doConnectionAction(trial, id, actionId, target);
    if (result.ok && result.value.worked === lands) return { result: result.value, trial };
  }
  throw new Error(`never ${lands ? 'landed' : 'failed'}`);
}

const fameNow = (state: GameState, id: string): number =>
  fameIn(figureById(state.rng.getSeed(), id)!, state.world.year);

describe('the professional things', () => {
  it('a joint piece brings what the same collaboration brings anybody, from their fame', () => {
    const { state, tie } = world({ channels: [channel()] }, 'creator', 40);
    const { result, trial } = attempt(state, tie.id, 'collaborate', true);
    const grown = result.state.channels[0]!;
    expect(result.gained).toBe(collabGain(40_000, fameAudience(fameNow(trial, tie.id)), 0));
    expect(result.gained!).toBeGreaterThan(0);
    expect(grown.audience).toBe(40_000 + result.gained!);
    expect(grown.peak).toBe(grown.audience);
    expect(grown.collabs?.[`c:${tie.id}`]).toBe(1);
    expect(result.entries[0]!.text).toContain(grown.name);
    expect(result.entries[0]!.text).toContain(result.gained!.toLocaleString('en-US'));
  });

  it('the second time is worth less than the first', () => {
    const { state, tie } = world({ channels: [channel()] }, 'creator', 40);
    const first = attempt(state, tie.id, 'collaborate', true);
    const later: GameState = {
      ...first.result.state,
      world: { ...first.result.state.world, year: state.world.year + 1 },
    };
    // A year on, they are still around and still well known; the doneYear no longer blocks.
    const second = attempt(later, tie.id, 'collaborate', true);
    const own = first.result.state.channels[0]!.audience;
    expect(second.result.gained).toBe(
      collabGain(own, fameAudience(fameNow(second.trial, tie.id)), 1),
    );
    expect(second.result.state.channels[0]!.collabs?.[`c:${tie.id}`]).toBe(2);
  });

  it('a guest spot counts for half the following, and only on a talking show', () => {
    const { state, tie } = world({ channels: [channel({ platformId: 'podcast' })] }, 'acting', 30);
    const { result, trial } = attempt(state, tie.id, 'invite', true);
    expect(result.gained).toBe(
      collabGain(40_000, Math.round(fameAudience(fameNow(trial, tie.id)) * GUEST_SHARE), 0),
    );
    expect(result.state.channels[0]!.audience).toBe(40_000 + result.gained!);
    const photo = { ...state, channels: [channel({ platformId: 'photo' })] };
    expect(doConnectionAction(photo, tie.id, 'invite').ok).toBe(false);
  });

  it('chooses the biggest channel that can take it, or the one named', () => {
    const small = channel({ id: 'ch:small', name: 'Small', audience: 500, peak: 500 });
    const big = channel({ id: 'ch:big', name: 'Big', audience: 90_000, peak: 90_000 });
    const { state, tie } = world({ channels: [small, big] }, 'creator', 40);
    const best = attempt(state, tie.id, 'collaborate', true).result.state.channels;
    expect(best.find((c) => c.id === 'ch:big')!.audience).toBeGreaterThan(90_000);
    expect(best.find((c) => c.id === 'ch:small')!.audience).toBe(500);
    const named = attempt(state, tie.id, 'collaborate', true, 'ch:small').result.state.channels;
    expect(named.find((c) => c.id === 'ch:small')!.audience).toBeGreaterThan(500);
    expect(named.find((c) => c.id === 'ch:big')!.audience).toBe(90_000);
  });

  it('a mention raises the business, by more for a bigger name, and not past the top', () => {
    const business = {
      id: 'biz:2040:1',
      name: 'Corner Cafe',
      reputation: 50,
    } as unknown as GameState['businesses'][0];
    const { state, tie } = world({ businesses: [business] }, 'acting', 30);
    const { result, trial } = attempt(state, tie.id, 'endorse', true);
    expect(result.state.businesses[0]!.reputation).toBe(
      Math.min(100, 50 + Math.round(3 + fameNow(trial, tie.id) / 10)),
    );
    expect(result.entries[0]!.text).toContain('Corner Cafe');
    const topped = { ...state, businesses: [{ ...business, reputation: 99 } as typeof business] };
    expect(attempt(topped, tie.id, 'endorse', true).result.state.businesses[0]!.reputation).toBe(
      100,
    );
  });

  it('a failed attempt changes nothing but the warmth and the feed', () => {
    const { state: warm, tie } = world({ channels: [channel()] }, 'creator', 40);
    // Not yet a friend, so a miss does not also tip them into the circle.
    const state = {
      ...warm,
      celebrities: { ...warm.celebrities, ties: [{ ...tie, warmth: 50 }] },
    };
    const { result } = attempt(state, tie.id, 'collaborate', false);
    expect(result.state.channels).toEqual(state.channels);
    expect(result.gained).toBeUndefined();
    expect(result.becameFriend).toBe(false);
    expect(result.state.celebrities.ties[0]!.warmth).toBe(
      50 + CONNECTION_MENU.find((action) => action.id === 'collaborate')!.onBad,
    );
    expect(result.entries).toHaveLength(1);
  });

  it('refuses for a figure who is not that kind of person, and for one too small to matter', () => {
    const { state: creators, tie } = world({ channels: [channel()] }, 'creator', 40);
    expect(whyNotConnection(creators, tie.id, 'collaborate')).toBeUndefined();
    const { state: actor, tie: actorTie } = world({ channels: [channel()] }, 'acting', 30);
    expect(whyNotConnection(actor, actorTie.id, 'collaborate')?.kind).toBe('notTheirField');
    const small = connectionTo({ ...CONNECTED, fame: 0 }, 'acting', 12);
    const lowState = {
      ...CONNECTED,
      celebrities: { ...EMPTY_CELEBRITIES, ties: [{ ...small }] },
      channels: [channel()],
    };
    if (fameNow(lowState, small.id) < BIG_ENOUGH) {
      expect(whyNotConnection(lowState, small.id, 'invite')?.kind).toBe('notBigEnough');
    }
  });
});

describe('a year passing', () => {
  const seed = CONNECTED.rng.getSeed();
  const Y = CONNECTED.world.year;
  const figure = figureById(seed, TIE.id)!;
  const tie: CelebrityTie = {
    ...TIE,
    warmth: 50,
    lastContactYear: Y,
    doneYear: Y,
    done: ['catchUp'],
    promoted: undefined,
  };
  const input = (over: Partial<CelebrityTie>, year = Y, circle = CONNECTED.circle) => ({
    seed,
    year,
    age: 40,
    celebrities: { ...EMPTY_CELEBRITIES, ties: [{ ...tie, ...over }] },
    circle,
  });

  it('the fixture is alive in the year used', () => {
    expect(deathYearOf(figure)).toBeGreaterThanOrEqual(Y);
  });

  it('a year with contact costs nothing, and a year without costs a little', () => {
    expect(runCelebrityYear(input({ lastContactYear: Y - 1 })).celebrities.ties[0]!.warmth).toBe(
      50,
    );
    expect(runCelebrityYear(input({ lastContactYear: Y - 2 })).celebrities.ties[0]!.warmth).toBe(
      50 - COOLING,
    );
    expect(runCelebrityYear(input({ lastContactYear: Y - 2 })).lines).toEqual([]);
  });

  it('a tie that drops under the line is lost, with a line saying so', () => {
    const result = runCelebrityYear(
      input({ lastContactYear: Y - 5, warmth: LOST_BELOW + COOLING - 1 }),
    );
    const lost = result.celebrities.ties[0]!;
    expect(lost.endedYear).toBe(Y);
    expect(lost.endedBecause).toBe('lost touch');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]!.text).toContain(TIE.name);
    expect(result.lines[0]!.kind).toBe('relationship');
    // Right on the line is kept.
    const kept = runCelebrityYear(input({ lastContactYear: Y - 5, warmth: LOST_BELOW + COOLING }));
    expect(kept.celebrities.ties[0]!.endedYear).toBeUndefined();
    expect(kept.celebrities.ties[0]!.warmth).toBe(LOST_BELOW);
  });

  it('an ended tie stays an ended tie', () => {
    const result = runCelebrityYear(
      input({ endedYear: Y - 3, endedBecause: 'lost touch', lastContactYear: Y - 20 }),
    );
    expect(result.celebrities.ties[0]!.endedYear).toBe(Y - 3);
    expect(result.lines).toEqual([]);
  });

  it('dying ends it, writes the news, and ends a friend in the circle too', () => {
    const died = deathYearOf(figure) + 1;
    const base = CONNECTED.circle.people[0]!;
    const { endedAtAge: _a, endedBecause: _b, ...living } = base;
    void _a;
    void _b;
    const friend = {
      ...living,
      id: 'npc:celeb:x',
      celebrityId: TIE.id,
      relationship: 80,
      alive: true,
    } as unknown as GameState['circle']['people'][0];
    const circle = { ...CONNECTED.circle, people: [friend] };
    const result = runCelebrityYear({
      ...input({ promoted: true, lastContactYear: died - 1 }, died, circle),
      age: 70,
    });
    expect(result.celebrities.ties[0]!.endedBecause).toBe('died');
    expect(result.celebrities.ties[0]!.endedYear).toBe(died);
    expect(result.lines[0]!.text).toContain(TIE.name);
    expect(result.circle.people[0]!.endedAtAge).toBe(70);
    expect(result.circle.people[0]!.endedBecause).toBe('died');
    expect(result.circle.people[0]!.alive).toBe(false);
    // The year before, they are alive.
    const before = runCelebrityYear({
      ...input({ promoted: true, lastContactYear: died - 2 }, died - 1, circle),
      age: 69,
    });
    expect(before.celebrities.ties[0]!.endedYear).toBeUndefined();
    expect(before.circle.people[0]!.endedAtAge).toBeUndefined();
    expect(before.circle.people[0]!.alive).toBe(true);
  });

  it('a promoted friend is not cooled here: the circle does that', () => {
    const result = runCelebrityYear(input({ promoted: true, lastContactYear: Y - 30 }));
    expect(result.celebrities.ties[0]!.warmth).toBe(50);
  });

  it('draws nothing at random: the same inputs give the same year', () => {
    expect(runCelebrityYear(input({ lastContactYear: Y - 3 }))).toEqual(
      runCelebrityYear(input({ lastContactYear: Y - 3 })),
    );
  });
});

describe('in the game', () => {
  it('a new character has met nobody', () => {
    expect(createNewGame({ seed: 'celeb-new' }).celebrities).toEqual(EMPTY_CELEBRITIES);
    expect(EMPTY_CELEBRITIES).toEqual({
      ties: [],
      met: [],
      answeredYear: 0,
      work: { year: 0, done: [] },
    });
  });

  it('a year in the game carries the connections forward, and cools the ones nobody kept up', () => {
    let state = CONNECTED;
    const startWarmth = TIE.warmth;
    for (let i = 0; i < 3 && state.player.alive; i += 1) {
      state = answerEverything(advanceYear(state).state);
    }
    const kept = state.celebrities.ties.find((tie) => tie.id === TIE.id)!;
    expect(kept).toBeDefined();
    expect(kept.warmth).toBeLessThanOrEqual(startWarmth);
    expect(state.celebrities.met).toContain(TIE.id);
    // With nobody keeping up, in a few years it is lost and the feed says so.
    const lost = (() => {
      let s = CONNECTED;
      for (let i = 0; i < 20 && s.player.alive; i += 1) {
        s = answerEverything(advanceYear(s).state);
        const tie = s.celebrities.ties.find((t) => t.id === TIE.id);
        if (tie?.endedYear !== undefined) return { s, tie };
      }
      return undefined;
    })();
    expect(lost).toBeDefined();
    expect(lost!.tie.endedBecause === 'lost touch' || lost!.tie.endedBecause === 'died').toBe(true);
    expect(lost!.s.player.timeline.some((entry) => entry.text.includes(TIE.name))).toBe(true);
  });

  it('an heir starts with nobody: the people you met belong to the person who met them', () => {
    for (let i = 0; i < 40; i += 1) {
      let state = createNewGame({ seed: `celeb-heir-${i}` });
      state = { ...state, celebrities: CONNECTED.celebrities };
      let guard = 0;
      while (state.player.alive && (guard += 1) < 120) {
        state = answerEverything(advanceYear(state).state);
      }
      const heir = heirsIn(state.family)[0];
      if (!heir) continue;
      const next = continueAsChild(state, heir.id);
      expect(next).toBeDefined();
      expect(next!.celebrities).toEqual(EMPTY_CELEBRITIES);
      // The one who died still had them, so the test means something.
      expect(state.celebrities.ties.length).toBeGreaterThan(0);
      return;
    }
    throw new Error('nobody left an heir');
  });
});

describe('the numbers the design rests on', () => {
  // Deliberate pins: a number here changing is a design decision, and should be a visible one.
  it('keeps the world to the sizes it was calibrated at', () => {
    expect({
      SLOTS_PER_YEAR,
      NOTABLE_FAME,
      BREAKTHROUGH_SHARE,
      LEGACY_SHARE,
      LEGACY_FADE,
      EARLY_DEATH,
    }).toEqual({
      SLOTS_PER_YEAR: 3,
      NOTABLE_FAME: 12,
      BREAKTHROUGH_SHARE: 0.15,
      LEGACY_SHARE: 0.6,
      LEGACY_FADE: 0.06,
      EARLY_DEATH: 0.04,
    });
  });

  it('keeps meetings to the rate it was calibrated at, about two to a life', () => {
    expect({
      ENCOUNTER_BASE,
      ENCOUNTER_FROM_AGE,
      ENCOUNTER_FULL_AGE,
      ENCOUNTER_YOUNG_SHARE,
      ENCOUNTER_MAX,
      SCENE_FROM,
      MAX_TIES,
    }).toEqual({
      ENCOUNTER_BASE: 0.022,
      ENCOUNTER_FROM_AGE: 10,
      ENCOUNTER_FULL_AGE: 16,
      ENCOUNTER_YOUNG_SHARE: 0.5,
      ENCOUNTER_MAX: 0.6,
      SCENE_FROM: 0.18,
      MAX_TIES: 12,
    });
  });

  it('keeps connections to the warmth they were calibrated at', () => {
    expect({
      TIE_START,
      FRIEND_AT,
      COOLING,
      LOST_BELOW,
      BIG_ENOUGH,
      FLIRT_GAP,
      GUEST_SHARE,
      FILMED_CHANCE,
      FILMED_FROM_FAME,
    }).toEqual({
      TIE_START: 32,
      FRIEND_AT: 60,
      COOLING: 3,
      LOST_BELOW: 8,
      BIG_ENOUGH: 25,
      FLIRT_GAP: 15,
      GUEST_SHARE: 0.5,
      FILMED_CHANCE: 0.15,
      FILMED_FROM_FAME: 50,
    });
  });
});

describe('the world, to the number', () => {
  const figure: Figure = {
    id: 'acting:1990:0',
    field: 'acting',
    firstName: 'Test',
    lastName: 'Star',
    sex: 'female',
    birthYear: 1990,
    debut: 20,
    rise: 10,
    hold: 10,
    retire: 60,
    dies: 90,
    peak: 80,
  };
  const at = (age: number): number => fameIn(figure, 1990 + age);

  it('breaks through at 12, is 46 halfway up, holds at 80, ends a career at 48 and fades by six percent a year', () => {
    expect(at(20)).toBe(12);
    expect(at(25)).toBe(46);
    expect(at(30)).toBe(80);
    expect(at(40)).toBe(80);
    expect(at(60)).toBe(48);
    expect(at(61)).toBe(45);
    expect(at(62)).toBe(42);
    expect(at(50)).toBe(64);
    expect(at(41)).toBe(78);
  });

  it('reads the very first year of a decline from the top, not from a step', () => {
    expect(at(40)).toBe(80);
    expect(at(41)).toBeLessThan(80);
  });

  it('holds exactly to the end of its hold', () => {
    expect(at(39)).toBe(80);
    expect(at(40)).toBe(80);
  });

  it('refuses a slot that does not exist, a negative one, and an id that was never a person', () => {
    for (let birth = 1940; birth < 1990; birth += 1) {
      for (const field of CELEBRITY_FIELD_CATALOG) {
        expect(figureById('slots', `${field.id}:${birth}:3`)).toBeUndefined();
        expect(figureById('slots', `${field.id}:${birth}:-1`)).toBeUndefined();
      }
    }
  });

  it('makes a person of about the share of slots the field says, and leaves the rest empty', () => {
    for (const field of CELEBRITY_FIELD_CATALOG) {
      let made = 0;
      let slots = 0;
      for (let birth = 1900; birth < 2000; birth += 1) {
        for (let slot = 0; slot < 3; slot += 1) {
          slots += 1;
          if (figureById('density', `${field.id}:${birth}:${slot}`) !== undefined) made += 1;
        }
      }
      expect(made / slots, field.id).toBeGreaterThan((field.density / 3) * 0.7);
      expect(made / slots, field.id).toBeLessThan(Math.min(1, (field.density / 3) * 1.3));
      expect(made, field.id).toBeLessThan(slots);
    }
  });

  it('lists exactly those who are known in a year, no more and no fewer', () => {
    for (const year of [2000, 2041, 2088]) {
      const listed = new Set(notablesIn('roster', year).map((f) => f.id));
      const brute = new Set<string>();
      for (const field of CELEBRITY_FIELD_CATALOG) {
        for (let birth = year - 100; birth <= year; birth += 1) {
          for (let slot = 0; slot < 3; slot += 1) {
            const f = figureById('roster', `${field.id}:${birth}:${slot}`);
            if (f !== undefined && fameIn(f, year) >= 12) brute.add(f.id);
          }
        }
      }
      expect(listed).toEqual(brute);
    }
  });

  it('weights names so that the home market is most of the roster but not all of it', () => {
    const home = NAME_CULTURES.find((culture) => culture.id === 'us-en')!;
    const surnames = new Set(home.surnames);
    let total = 0;
    let homeCount = 0;
    for (const seed of ['n1', 'n2', 'n3', 'n4', 'n5']) {
      for (const f of notablesIn(seed, 2060)) {
        total += 1;
        if (surnames.has(f.lastName)) homeCount += 1;
      }
    }
    const uniform = 1 / NAME_CULTURES.length;
    expect(homeCount / total).toBeGreaterThan(uniform * 2);
    expect(homeCount / total).toBeLessThan(0.6);
  });

  it('draws debut and rise independently: a late starter is not also a slow climber', () => {
    const field = findCelebrityField('business')!;
    const points: Array<[number, number]> = [];
    for (let birth = 1900; birth < 2100; birth += 1) {
      for (let slot = 0; slot < 3; slot += 1) {
        const f = figureById('corr', `business:${birth}:${slot}`);
        if (f === undefined) continue;
        points.push([
          (f.debut - field.debut[0]) / Math.max(1, field.debut[1] - field.debut[0]),
          (f.rise - field.rise[0]) / Math.max(1, field.rise[1] - field.rise[0]),
        ]);
      }
    }
    const n = points.length;
    const mx = points.reduce((a, p) => a + p[0], 0) / n;
    const my = points.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (const [x, y] of points) {
      sxy += (x - mx) * (y - my);
      sxx += (x - mx) ** 2;
      syy += (y - my) ** 2;
    }
    expect(Math.abs(sxy / Math.sqrt(sxx * syy))).toBeLessThan(0.25);
  });
});

describe('meetings, to the number', () => {
  const plain = { ...ADULT, fame: 0, channels: [], businesses: [] };

  it('start at ten, at half strength until sixteen', () => {
    expect(encounterChance(withAge(plain, 9))).toBe(0);
    const ten = encounterChance(withAge(plain, 10));
    const fifteen = encounterChance(withAge(plain, 15));
    const sixteen = encounterChance(withAge(plain, 16));
    expect(ten).toBeGreaterThan(0);
    expect(fifteen).toBeCloseTo(sixteen / 2, 12);
    expect(sixteen).toBeCloseTo(0.022 * encounterMultiplier(pullsOf(withAge(plain, 16))), 12);
  });

  it('is never above sixty in a hundred however much is stacked', () => {
    const pulls = { hub: 2, wealth: 3, fame: 5, channel: true, business: true };
    expect(Math.min(ENCOUNTER_MAX, 0.022 * encounterMultiplier(pulls))).toBe(0.6);
  });

  it('is decided by the generation as well as the year: an heir has their own run of luck', () => {
    const years = Array.from({ length: 800 }, (_, i) => 3000 + i);
    const hits = (generation: number) =>
      years.filter(
        (year) =>
          encounterFor({ ...plain, world: { ...plain.world, year, generation } }) !== undefined,
      );
    expect(hits(0)).not.toEqual(hits(1));
  });

  it('weighs a figure by fame, by what the life is near, and by still working', () => {
    const pulls = { hub: 1, wealth: 1, fame: 1, channel: false, business: false };
    const working = notablesIn('weight', 2060).find((f) => isWorking(f, 2060))!;
    const retired = notablesIn('weight', 2060).find((f) => !isWorking(f, 2060))!;
    expect(candidateWeight(working, 2060, pulls)).toBe(fameIn(working, 2060));
    expect(candidateWeight(retired, 2060, pulls)).toBeCloseTo(fameIn(retired, 2060) * 0.4, 10);
  });

  it('pulls a field closer by the city, the money, and the network it needs', () => {
    const none = { hub: 1, wealth: 1, fame: 1, channel: false, business: false };
    const acting = findCelebrityField('acting')!;
    expect(fieldPull('acting', none)).toBe(1);
    expect(fieldPull('acting', { ...none, hub: 2 })).toBeCloseTo(1 + acting.hubPull, 10);
    expect(fieldPull('acting', { ...none, wealth: 3 })).toBeCloseTo(1 + acting.wealthPull * 2, 10);
    expect(fieldPull('creator', { ...none, channel: true })).toBe(2.5);
    expect(fieldPull('creator', none)).toBe(1);
    expect(fieldPull('business', { ...none, business: true })).toBe(2.5);
    expect(fieldPull('business', { ...none, channel: true })).toBe(1);
    expect(fieldPull('acting', { ...none, channel: true, business: true })).toBe(1);
    expect(fieldPull('sailing', { ...none, hub: 2 })).toBe(1);
  });

  it('says why it was this person: the biggest push, or chance when none is big', () => {
    const none = { hub: 1, wealth: 1, fame: 1, channel: false, business: false };
    expect(sceneFor('acting', none)).toBe('chance');
    expect(sceneFor('acting', { ...none, hub: 1 + 0.17 / 0.9 })).toBe('chance');
    expect(sceneFor('acting', { ...none, hub: 1 + 0.19 / 0.9 })).toBe('hub');
    expect(sceneFor('business', { ...none, wealth: 3 })).toBe('elite');
    expect(sceneFor('athletics', { ...none, fame: 5 })).toBe('fame');
    expect(sceneFor('creator', { ...none, channel: true })).toBe('channel');
    expect(sceneFor('business', { ...none, business: true })).toBe('business');
    expect(sceneFor('sailing', { ...none, hub: 2 })).toBe('chance');
  });
});

describe('answering a stranger, to the number', () => {
  /** Every generation in which the same life in the same year meets somebody. */
  function meetings(base: GameState, count: number): GameState[] {
    const found: GameState[] = [];
    for (let generation = 0; generation < 3000 && found.length < count; generation += 1) {
      const trial = { ...base, world: { ...base.world, generation } };
      if (encounterFor(trial) !== undefined) found.push(trial);
    }
    return found;
  }

  const single = (state: GameState): GameState => ({
    ...state,
    circle: { ...state.circle, people: [] },
  });
  const eager = withFame(withCash(single(MEETING), 5_000_000), 100);

  it('refuses a flirt from somebody who is taken, and from a child', () => {
    const taken = { ...MEETING, circle: CONNECTED.circle };
    expect(partnerOf(taken.circle.people)).toBeDefined();
    const trial = meetings(withFame(taken, 100), 1)[0]!;
    const result = answerEncounter(trial, 'flirt');
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(['alreadyWithSomeone', 'tooFarApart', 'tooYoung']).toContain(result.error.kind);
    const direct = meetings(withFame(withAge(taken, 40), 100), 40).find((m) => {
      const e = encounterFor(m)!;
      return (
        whyNotFlirt({ ...m, circle: { ...m.circle, people: [] } }, e.figure, e.year) === undefined
      );
    });
    expect(direct).toBeDefined();
    const refused = answerEncounter(direct!, 'flirt');
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.kind).toBe('alreadyWithSomeone');
  });

  it('only a good answer can lead anywhere, and a good one leads somewhere about as often as the action says', () => {
    let worked = 0;
    let connected = 0;
    let missed = 0;
    let missedAndConnected = 0;
    for (const trial of meetings(withFame(eager, 50), 600)) {
      const result = answerEncounter(trial, 'compliment');
      if (!result.ok) continue;
      if (result.value.worked) {
        worked += 1;
        if (result.value.connected) connected += 1;
      } else {
        missed += 1;
        if (result.value.connected) missedAndConnected += 1;
      }
    }
    expect(worked).toBeGreaterThan(80);
    expect(missed).toBeGreaterThan(5);
    expect(missedAndConnected).toBe(0);
    // A compliment connects half the time it lands, half as often again for somebody at fame 50.
    expect(connected / worked).toBeGreaterThan(0.62);
    expect(connected / worked).toBeLessThan(0.88);
  });

  it('is likelier to lead somewhere for somebody with a name of their own', () => {
    const rate = (fame: number): number => {
      let worked = 0;
      let connected = 0;
      for (const trial of meetings(withFame(withCash(single(MEETING), 5_000_000), fame), 600)) {
        const result = answerEncounter(trial, 'compliment');
        if (result.ok && result.value.worked) {
          worked += 1;
          if (result.value.connected) connected += 1;
        }
      }
      return connected / worked;
    };
    expect(rate(100)).toBeGreaterThan(rate(0) * 1.4);
    expect(rate(0)).toBeGreaterThan(0.4);
    expect(rate(0)).toBeLessThan(0.6);
  });

  it('is the same at any number of ties short of the limit, and never past it', () => {
    const full = (ended: number): GameState => ({
      ...eager,
      celebrities: {
        ...eager.celebrities,
        ties: Array.from({ length: MAX_TIES }, (_, i) => ({
          ...TIE,
          id: `acting:1900:${i}`,
          ...(i < ended ? { endedYear: 2000, endedBecause: 'lost touch' as const } : {}),
        })),
      },
    });
    const connects = (base: GameState): number =>
      meetings(base, 300).filter((trial) => {
        const result = answerEncounter(trial, 'compliment');
        return result.ok && result.value.connected;
      }).length;
    expect(connects(full(0))).toBe(0);
    expect(connects(full(1))).toBeGreaterThan(0);
    expect(
      connects({
        ...full(0),
        celebrities: {
          ...full(0).celebrities,
          ties: full(0).celebrities.ties.slice(0, MAX_TIES - 1),
        },
      }),
    ).toBeGreaterThan(0);
  });

  it('writes a second line when a connection comes of it, and says so', () => {
    for (const trial of meetings(eager, 300)) {
      const result = answerEncounter(trial, 'compliment');
      if (result.ok && result.value.connected) {
        expect(result.value.entries).toHaveLength(2);
        expect(result.value.state.celebrities.ties).toHaveLength(trial.celebrities.ties.length + 1);
        expect(result.value.state.player.timeline.length).toBe(trial.player.timeline.length + 2);
        const tie = result.value.state.celebrities.ties.at(-1)!;
        expect(result.value.entries[1]!.text).toContain(tie.name);
        return;
      }
    }
    throw new Error('never connected');
  });

  it('remembers the last sixty people met, and no more', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `acting:1800:${i}`);
    const base = { ...eager, celebrities: { ...eager.celebrities, met: ids } };
    const trial = meetings(base, 1)[0]!;
    const result = answerEncounter(trial, 'ignore');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const met = result.value.state.celebrities.met;
    expect(met).toHaveLength(60);
    expect(met[0]).toBe('acting:1800:1');
    expect(met.at(-1)).toBe(encounterFor(trial)!.figure.id);
  });

  it('a stranger is not likelier or less likely to like you for reasons you can see: the odds are bounded', () => {
    const plain = { ...ADULT, fame: 0 };
    const best = {
      ...plain,
      fame: 100,
      player: { ...plain.player, stats: { ...plain.player.stats, looks: 100, charisma: 100 } },
    };
    for (const action of ENCOUNTER_MENU) {
      for (const fame of [0, 50, 100]) {
        expect(encounterOdds(best, action.id, fame)).toBeLessThanOrEqual(0.95);
        expect(encounterOdds(plain, action.id, fame)).toBeGreaterThanOrEqual(
          action.base === 0 ? 0 : 0.03,
        );
      }
    }
  });

  it('rudeness to somebody famous is sometimes filmed, and costs more than rudeness to somebody who is not', () => {
    const cost = (fame: number): number[] => {
      const costs: number[] = [];
      for (const trial of meetings(withFame(withCash(single(MEETING), 5_000_000), fame), 300)) {
        const e = encounterFor(trial)!;
        const result = answerEncounter(trial, 'insult');
        if (!result.ok) continue;
        const dropped = trial.player.stats.happiness - result.value.state.player.stats.happiness;
        costs.push(e.fame >= 50 ? dropped : -dropped);
      }
      return costs;
    };
    const all = cost(40);
    const famous = all.filter((c) => c >= 0);
    expect(famous.some((c) => c === 4)).toBe(true);
    expect(famous.some((c) => c === 1)).toBe(true);
    const filmedShare = famous.filter((c) => c === 4).length / famous.length;
    expect(filmedShare).toBeGreaterThan(0.07);
    expect(filmedShare).toBeLessThan(0.25);
    const small = all.filter((c) => c < 0).map((c) => -c);
    expect(small.length).toBeGreaterThan(0);
    expect(small.every((c) => c === 1)).toBe(true);
  });
});

describe('the second menu, to the number', () => {
  const at = (
    warmth: number,
    over: Partial<CelebrityTie> = {},
  ): { state: GameState; tie: CelebrityTie } => {
    const { state, tie } = world({ channels: [channel()] }, 'creator', 40);
    const fresh = { ...tie, warmth, lastContactYear: state.world.year - 6, ...over };
    return {
      state: { ...state, celebrities: { ...EMPTY_CELEBRITIES, ties: [fresh] } },
      tie: fresh,
    };
  };

  it('names the bond by how close it is', () => {
    const word = (warmth: number): string => {
      const { state } = at(warmth);
      return connectionRows(state)[0]!.bond;
    };
    expect(word(100)).toBe('best friend');
    expect(word(90)).toBe('best friend');
    expect(word(89)).toBe('close friend');
    expect(word(72)).toBe('close friend');
    expect(word(71)).toBe('friend');
    expect(word(50)).toBe('friend');
    expect(word(49)).toBe('acquaintance');
    expect(word(30)).toBe('acquaintance');
    expect(word(29)).toBe('know of them');
  });

  it('reads how well they know each other from the tie until there is a friend, and then from the friend', () => {
    const { state, tie } = at(40);
    expect(warmthOf(state, { ...tie, promoted: true })).toBe(40);
    expect(warmthOf(state, tie)).toBe(40);
  });

  it('sizes a creator’s following by their fame: a name of 40 is ninety-nine thousand people, of 20 nine thousand', () => {
    expect(fameAudience(0)).toBe(0);
    expect(fameAudience(20)).toBe(9_000);
    expect(fameAudience(40)).toBe(99_000);
    expect(fameAudience(60)).toBe(999_000);
  });

  it('asks nothing of a connection who is alive in the year they die in, and nothing from the year after', () => {
    const { state, tie } = at(50);
    const figure = figureById(state.rng.getSeed(), tie.id)!;
    const dying = { ...state, world: { ...state.world, year: deathYearOf(figure) } };
    expect(whyNotConnection(dying, tie.id, 'catchUp')).toBeUndefined();
    const gone = { ...state, world: { ...state.world, year: deathYearOf(figure) + 1 } };
    expect(whyNotConnection(gone, tie.id, 'catchUp')?.kind).toBe('notAround');
  });

  it('wants a channel with somebody watching before a joint piece, a show before a guest spot, a business before a mention', () => {
    const { state, tie } = at(80);
    const none = { ...state, channels: [] };
    expect(whyNotConnection(none, tie.id, 'collaborate')?.kind).toBe('noChannel');
    const tiny = { ...state, channels: [channel({ audience: MIN_COLLAB_AUDIENCE - 1 })] };
    expect(whyNotConnection(tiny, tie.id, 'collaborate')?.kind).toBe('noChannel');
    const big = { ...state, channels: [channel({ audience: MIN_COLLAB_AUDIENCE })] };
    expect(whyNotConnection(big, tie.id, 'collaborate')).toBeUndefined();
    expect(whyNotConnection(big, tie.id, 'endorse')?.kind).toBe('noBusiness');
    const photo = { ...state, channels: [channel({ platformId: 'photo' })] };
    expect(whyNotConnection(photo, tie.id, 'invite')?.kind).toBe('noShow');
    expect(whyNotConnection(state, tie.id, 'invite')).toBeUndefined();
  });

  it('needs a name of real size before a guest spot or a mention', () => {
    const year = CONNECTED.world.year;
    const seed = CONNECTED.rng.getSeed();
    const small = notablesIn(seed, year).find(
      (f) => f.field === 'acting' && fameIn(f, year) < BIG_ENOUGH,
    );
    const big = notablesIn(seed, year).find(
      (f) => f.field === 'acting' && fameIn(f, year) >= BIG_ENOUGH,
    );
    expect(small).toBeDefined();
    expect(big).toBeDefined();
    const business = {
      id: 'biz:1',
      name: 'Cafe',
      reputation: 40,
    } as unknown as GameState['businesses'][0];
    const tieFor = (f: Figure): CelebrityTie => ({
      id: f.id,
      name: displayFigure(f),
      sex: f.sex,
      field: f.field,
      birthYear: f.birthYear,
      metYear: year - 1,
      metAtAge: 20,
      warmth: 80,
      lastContactYear: year - 1,
      doneYear: 0,
      done: [],
    });
    const stateFor = (f: Figure): GameState => ({
      ...CONNECTED,
      channels: [channel()],
      businesses: [business],
      celebrities: { ...EMPTY_CELEBRITIES, ties: [tieFor(f)] },
    });
    for (const id of ['invite', 'endorse']) {
      expect(whyNotConnection(stateFor(small!), small!.id, id)?.kind).toBe('notBigEnough');
      expect(whyNotConnection(stateFor(big!), big!.id, id)).toBeUndefined();
    }
  });

  it('at its lowest warmth an action has its worst chance, at a hundred its best, and never over ninety-five', () => {
    const state = { ...CONNECTED, fame: 0 };
    for (const action of CONNECTION_MENU) {
      expect(connectionOdds(state, action.minWarmth, action.id, 0)).toBeCloseTo(action.worst, 10);
      expect(connectionOdds(state, 100, action.id, 0)).toBeCloseTo(action.best, 10);
    }
    expect(connectionOdds({ ...state, fame: 100 }, 100, 'catchUp', 0)).toBe(0.95);
    expect(connectionOdds({ ...state, fame: 0 }, 0, 'catchUp', 0)).toBeGreaterThanOrEqual(0.03);
  });

  it('lands about as often as the odds say', () => {
    const rate = (warmth: number, actionId: string): { rate: number; odds: number } => {
      const { state, tie } = at(warmth);
      let worked = 0;
      const trials = 500;
      for (let generation = 0; generation < trials; generation += 1) {
        const result = doConnectionAction(
          { ...state, world: { ...state.world, generation } },
          tie.id,
          actionId,
        );
        if (result.ok && result.value.worked) worked += 1;
      }
      const year = state.world.year;
      return {
        rate: worked / trials,
        odds: connectionOdds(
          state,
          warmth,
          actionId as 'catchUp',
          fameIn(figureById(state.rng.getSeed(), tie.id)!, year),
        ),
      };
    };
    const high = rate(100, 'catchUp');
    expect(high.rate).toBeGreaterThan(0.85);
    expect(Math.abs(high.rate - high.odds)).toBeLessThan(0.07);
    const low = rate(35, 'collaborate');
    expect(Math.abs(low.rate - low.odds)).toBeLessThan(0.09);
  });

  it('social things cheer or sting a little, a get-together more, and professional ones do not touch the mood', () => {
    const mood = (actionId: string, lands: boolean): number => {
      const { state: base, tie } = at(50);
      const state = {
        ...base,
        player: { ...base.player, stats: { ...base.player.stats, happiness: 50 } },
      };
      const { result } = attempt(state, tie.id, actionId, lands);
      return result.state.player.stats.happiness - 50;
    };
    expect(mood('catchUp', true)).toBe(1);
    expect(mood('catchUp', false)).toBe(-1);
    expect(mood('getTogether', true)).toBe(3);
    expect(mood('getTogether', false)).toBe(-1);
    expect(mood('collaborate', true)).toBe(0);
    expect(mood('collaborate', false)).toBe(0);
  });

  it('warmth stays between nothing and a hundred', () => {
    const near = at(99, { promoted: undefined });
    const up = attempt(near.state, near.tie.id, 'catchUp', true).result.state;
    const friend = up.circle.people.find((p) => p.celebrityId === near.tie.id)!;
    expect(friend.relationship).toBe(100);
    const bottom = at(5);
    const down = attempt(bottom.state, bottom.tie.id, 'compliment', false).result.state;
    expect(down.celebrities.ties[0]!.warmth).toBe(3);
    const zero = at(0);
    expect(
      attempt(zero.state, zero.tie.id, 'catchUp', false).result.state.celebrities.ties[0]!.warmth,
    ).toBe(0);
  });

  it('notes the contact in the year it happened, and everything done that year', () => {
    const { state, tie } = at(50);
    const first = attempt(state, tie.id, 'catchUp', true);
    const afterFirst = first.result.state.celebrities.ties[0]!;
    expect(afterFirst.lastContactYear).toBe(state.world.year);
    expect(afterFirst.lastContactYear).not.toBe(tie.lastContactYear);
    expect(afterFirst.done).toEqual(['catchUp']);
    const second = doConnectionAction(
      first.trial.world === state.world ? first.result.state : first.result.state,
      tie.id,
      'compliment',
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const afterSecond = second.value.state.celebrities.ties[0]!;
    expect(afterSecond.done).toEqual(['catchUp', 'compliment']);
    expect(whyNotConnection(second.value.state, tie.id, 'catchUp')?.kind).toBe('doneThisYear');
    expect(whyNotConnection(second.value.state, tie.id, 'compliment')?.kind).toBe('doneThisYear');
  });

  it('becomes a friend at exactly sixty, not before', () => {
    const exactly = at(55);
    const made = attempt(exactly.state, exactly.tie.id, 'catchUp', true).result;
    expect(made.becameFriend).toBe(true);
    expect(
      made.state.circle.people.find((p) => p.celebrityId === exactly.tie.id)!.relationship,
    ).toBe(60);
    const short = at(54);
    const stays = attempt(short.state, short.tie.id, 'catchUp', true).result;
    expect(stays.becameFriend).toBe(false);
    expect(stays.state.celebrities.ties[0]!.promoted).toBeUndefined();
  });

  it('a friend who is acted on is in touch as of this year, and is not doubled in the circle', () => {
    const exactly = at(55);
    const made = attempt(exactly.state, exactly.tie.id, 'catchUp', true).result.state;
    const onwards = {
      ...made,
      world: { ...made.world, year: made.world.year + 1 },
      player: { ...made.player, age: made.player.age + 1 },
    };
    const result = attempt(onwards, exactly.tie.id, 'compliment', true).result.state;
    const friends = result.circle.people.filter((p) => p.celebrityId === exactly.tie.id);
    expect(friends).toHaveLength(1);
    expect(friends[0]!.lastContactAge).toBe(onwards.player.age);
  });
});

describe('the year, to the number', () => {
  it('does not write the news twice for somebody already gone', () => {
    const seed = CONNECTED.rng.getSeed();
    const figure = figureById(seed, TIE.id)!;
    const later = deathYearOf(figure) + 3;
    const ended: CelebrityTie = {
      ...TIE,
      endedYear: deathYearOf(figure) - 5,
      endedBecause: 'lost touch',
    };
    const result = runCelebrityYear({
      seed,
      year: later,
      age: 60,
      celebrities: { ...EMPTY_CELEBRITIES, ties: [ended] },
      circle: CONNECTED.circle,
    });
    expect(result.lines).toEqual([]);
    expect(result.celebrities.ties[0]).toEqual(ended);
  });

  it('writes the news into the life when a connection is lost or dies, through a real year', () => {
    const seed = CONNECTED.rng.getSeed();
    const figure = figureById(seed, TIE.id)!;
    const year = CONNECTED.world.year;
    let state: GameState = {
      ...CONNECTED,
      celebrities: {
        ...CONNECTED.celebrities,
        ties: CONNECTED.celebrities.ties.map((t) => ({
          ...t,
          warmth: LOST_BELOW + 1,
          lastContactYear: year - 10,
        })),
      },
    };
    let wrote = false;
    for (let i = 0; i < 4 && state.player.alive && !wrote; i += 1) {
      state = answerEverything(advanceYear(state).state);
      const ended = state.celebrities.ties.find((t) => t.id === TIE.id)?.endedYear;
      if (ended !== undefined) {
        wrote = state.player.timeline.some(
          (entry) => entry.id.includes(`:${ended}:celeb:`) && entry.text.includes(TIE.name),
        );
        break;
      }
    }
    expect(deathYearOf(figure)).toBeGreaterThan(year);
    expect(wrote).toBe(true);
  });

  it('a year lets a connection with no friend in the circle cool but not vanish at the line', () => {
    const seed = CONNECTED.rng.getSeed();
    const Y = CONNECTED.world.year;
    const base = {
      ...TIE,
      promoted: undefined,
      endedYear: undefined,
      warmth: LOST_BELOW + COOLING,
      lastContactYear: Y - 5,
    } as CelebrityTie;
    const result = runCelebrityYear({
      seed,
      year: Y,
      age: 40,
      celebrities: { ...EMPTY_CELEBRITIES, ties: [base] },
      circle: CONNECTED.circle,
    });
    expect(result.celebrities.ties[0]!.warmth).toBe(LOST_BELOW);
  });
});

describe('the words', () => {
  it('every kind has lines, and every token in them is one the engine fills', () => {
    const known = new Set(['name', 'role', 'channel', 'gain', 'business']);
    for (const [kind, lines] of Object.entries(CELEBRITY_LINES)) {
      expect(lines.length).toBeGreaterThanOrEqual(2);
      for (const line of lines) {
        for (const match of line.matchAll(/\{(\w+)\}/g)) {
          expect(known.has(match[1]!)).toBe(true);
        }
        expect(line.length, `${kind}: ${line}`).toBeLessThan(160);
      }
    }
  });

  it('a line fills its tokens and leaves none behind', () => {
    const text = celebrityLine(
      'scene:chance',
      'k',
      { name: 'Ana Ruiz', role: 'an actor' },
      (lines) => lines[0]!,
    );
    expect(text).toContain('Ana Ruiz');
    expect(text).toContain('an actor');
    expect(text).not.toContain('{');
    expect(
      celebrityLine('collaborateOk', 'k', { name: 'A', role: 'r' }, (lines) => lines[0]!),
    ).not.toContain('{');
  });
});
