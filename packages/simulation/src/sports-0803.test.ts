/**
 * Ticket 0803 acceptance tests — golf, tennis, boxing and MMA, with martial arts.
 *
 * Golf and tennis share the team sports' ladder up to graduation and then play a tour; boxing and MMA have
 * no team and no college, and a martial art studied from ten is the road in. These tests pin the rows (the
 * real purses they are anchored to), the rules for the arts, the one-draw road to a fight card, the season
 * of results that decides every fight and every tour year, and that a life which studies nothing is untouched.
 */

import { describe, expect, it } from 'vitest';
import {
  COMBAT_SPORTS,
  naturalForm,
  FIELD_STRENGTH,
  FIGHTS_PER_YEAR,
  MARTIAL_ARTS,
  MARTIAL_ART_MIN_AGE,
  MAX_ARTS_AT_ONCE,
  MIN_ART_SEASONS,
  OUT_MARGIN,
  SPORTS,
  TEAM_SPORTS,
  TIERS,
  TOUR_SPORTS,
  TURN_PRO_MAX_AGE,
  TURN_PRO_MIN_AGE,
  WORLD_RANK_BAND,
  findActivity,
  findMartialArt,
  findSport,
  fightCareerFor,
  fightWinChance,
  isOut,
  sportOfActivity,
  tierForPerformance,
  worldRankFor,
  type Sport,
  type SportTier,
} from '@yearafter/content';
import { advanceYear } from './advance';
import { withAnyOffer } from './offers';
import { sportUnit } from './sports-core';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { practise } from './practice';
import { tryOut } from './tryout';
import {
  ACCEPT,
  DECLINE,
  SPORTS_OFFER_EVENT_ID,
  isPlaying,
  runSportsYear,
  skillsOf,
  sportsOccupation,
  trainSport,
} from './sports';
import {
  artsOf,
  baseArts,
  fightRoadOf,
  isFullTime,
  readArts,
  recordOf,
  retirementAge,
  runArtsYear,
  runIndividualSeason,
  startArt,
  stopArt,
  tourCardOffer,
  turnProOffer,
  trainArt,
  trainingCeiling,
  worldRankOf,
} from './sports-individual';
import type { ArtStudy, SportCareer } from './sports-state';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function answerOthers(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending.find((row) => row.eventId !== SPORTS_OFFER_EVENT_ID);
    const choice =
      open?.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : open?.choices[0];
    if (!open || !choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

const withTalent = (state: GameState, athletics: boolean): GameState => ({
  ...state,
  player: { ...state.player, talents: { ...state.player.talents, athletics } },
});

const life = (seed: string, athletics = true): GameState =>
  withTalent(createNewGame({ seed }), athletics);

/** Age a life with nothing happening to it until it is `age`, answering questions with 'skip'. */
function toAge(state: GameState, age: number): GameState {
  let current = state;
  let guard = 0;
  while (current.player.alive && current.player.age < age && (guard += 1) < 80) {
    current = answerOthers(advanceYear(answerOthers(current)).state);
  }
  return current;
}

const ok = <T>(result: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!result.ok) throw new Error(`expected ok, got ${String(result.error)}`);
  return result.value as T;
};

interface FighterLife {
  readonly state: GameState;
  readonly offeredAt?: number;
}

/** A life that studies the given arts from `from`, works at them or not, and takes the gym's offer if it comes. */
function fighterLife(
  seed: string,
  arts: readonly string[],
  options: {
    talented?: boolean;
    work?: boolean;
    from?: number;
    answer?: string;
    until?: number;
  } = {},
): FighterLife {
  const { talented = true, work = true, from = 10, answer = ACCEPT, until = 40 } = options;
  let state = life(seed, talented);
  let offeredAt: number | undefined;
  let guard = 0;
  while (state.player.alive && state.player.age < until && (guard += 1) < 60) {
    state = answerOthers(state);
    if (state.player.age >= from && state.player.age < 18 && artsOf(state).length === 0) {
      for (const art of arts) {
        const started = startArt(state, art);
        if (started.ok) state = started.value.state;
      }
    }
    if (work) {
      for (const art of arts) {
        for (let session = 0; session < 3; session += 1) {
          const trained = trainArt(state, art);
          if (trained.ok) state = trained.value.state;
        }
      }
      if (isPlaying(state.sports.career)) {
        for (let session = 0; session < 3; session += 1) {
          const trained = trainSport(state);
          if (trained.ok) state = trained.value.state;
        }
      }
    }
    state = advanceYear(state).state;
    if (state.sports.offer) {
      offeredAt = offeredAt ?? state.player.age;
      const result = decide(state, SPORTS_OFFER_EVENT_ID, answer);
      if (result.ok) state = result.value.state;
    }
    if (state.sports.past.length > 0 && !state.sports.career) break;
    if (state.player.age > TURN_PRO_MAX_AGE + 1 && !state.sports.career) break;
  }
  return { state, ...(offeredAt === undefined ? {} : { offeredAt }) };
}

/** A tour life: tries out for the school team, works at it, takes the scholarship and the card. */
function tourLife(
  sport: Sport,
  seed: string,
  options: { talented?: boolean; work?: boolean; until?: number } = {},
): GameState {
  const { talented = true, work = true, until = 60 } = options;
  let state = life(seed, talented);
  let guard = 0;
  while (state.player.alive && state.player.age < until && (guard += 1) < 70) {
    state = answerOthers(state);
    if (state.player.age >= 12 && state.player.age <= 17) {
      const made = tryOut(state, sport.activityId);
      if (made.ok) state = made.value.state;
      if (work) {
        for (let session = 0; session < 3; session += 1) {
          const practised = practise(state, sport.activityId);
          if (practised.ok) state = practised.value.state;
        }
      }
    }
    if (work && isPlaying(state.sports.career)) {
      for (let session = 0; session < 3; session += 1) {
        const trained = trainSport(state);
        if (trained.ok) state = trained.value.state;
      }
    }
    state = advanceYear(state).state;
    if (state.sports.offer) {
      const result = decide(state, SPORTS_OFFER_EVENT_ID, ACCEPT);
      if (result.ok) state = result.value.state;
    }
    if (state.sports.past.length > 0 && !state.sports.career) break;
    if (state.player.age > 26 && !state.sports.career && state.sports.past.length === 0) break;
  }
  return state;
}

const BOXING = findSport('boxing')!;
const MMA = findSport('mma')!;
const GOLF = findSport('golf')!;
const TENNIS = findSport('tennis')!;

/** A state with a professional career set by hand, for the rules that do not need a life to reach it. */
function proState(
  sport: Sport,
  career: Partial<SportCareer> = {},
  seed = 'pro-fixture',
): GameState {
  const base = life(seed);
  const built: SportCareer = {
    sportId: sport.id,
    stage: 'pro',
    startedAge: 14,
    seasons: 8,
    hardSeasons: 6,
    form: 60,
    trainedAtAge: -1,
    trainedCount: 0,
    reputation: 10,
    titles: 0,
    tier: 'role',
    proSeasons: 3,
    team: sport.proTeams[0] ?? '',
    ...(sport.format === 'combat' ? { wins: 5, losses: 2 } : {}),
    ...career,
  };
  return { ...base, sports: { ...base.sports, career: built } };
}

/** A fixed sample of seasons from one career, keyed on the year so every one is a different draw. */
function seasons(
  sport: Sport,
  career: Partial<SportCareer>,
  years: number,
  seed = 'seasons-fixture',
): ReturnType<typeof runIndividualSeason>[] {
  const state = proState(sport, career, seed);
  const out: ReturnType<typeof runIndividualSeason>[] = [];
  for (let index = 0; index < years; index += 1) {
    out.push(
      runIndividualSeason({
        before: state,
        career: state.sports.career!,
        sport,
        age: 26,
        year: 2000 + index,
      }),
    );
  }
  return out;
}

/** The first life of a numbered set that satisfies `test`, so a rule can be read off a life that got there. */
function firstWith(
  prefix: string,
  arts: readonly string[],
  until: number,
  test: (state: GameState) => boolean,
  options: { talented?: boolean; work?: boolean } = {},
): GameState {
  for (let index = 0; index < 25; index += 1) {
    const { state } = fighterLife(`${prefix}-${index}`, arts, { ...options, until });
    if (test(state)) return state;
  }
  throw new Error(`no life of 25 satisfied the test for ${prefix}`);
}

/* -------------------------------------------------------------------------- */
/* The rows                                                                    */
/* -------------------------------------------------------------------------- */

describe('the four new rows', () => {
  it('adds golf and tennis (a tour) and boxing and MMA (a fight card) to the five team sports', () => {
    expect(SPORTS.map((sport) => sport.id)).toEqual([
      'basketball',
      'football',
      'baseball',
      'soccer',
      'hockey',
      'golf',
      'tennis',
      'boxing',
      'mma',
    ]);
    expect(TEAM_SPORTS).toHaveLength(5);
    expect(TOUR_SPORTS.map((sport) => sport.id)).toEqual(['golf', 'tennis']);
    expect(COMBAT_SPORTS.map((sport) => sport.id)).toEqual(['boxing', 'mma']);
  });

  it('gives golf and tennis a real school team, and boxing and MMA none', () => {
    for (const sport of TOUR_SPORTS) {
      expect(findActivity(sport.activityId)?.kind).toBe('sport');
      expect(sportOfActivity(sport.activityId)?.id).toBe(sport.id);
      expect(sport.collegeTeams.length).toBeGreaterThanOrEqual(12);
      expect(sport.proTeams).toEqual([]);
    }
    for (const sport of COMBAT_SPORTS) {
      expect(sport.activityId).toBe('');
      expect(sportOfActivity('')).toBeUndefined();
      expect(sport.collegeTeams).toEqual([]);
      expect(sport.proTeams.length).toBeGreaterThanOrEqual(12);
      expect(new Set(sport.proTeams).size).toBe(sport.proTeams.length);
    }
  });

  it('uses the skills the spec names: boxing five, MMA four', () => {
    expect(BOXING.skills.map((skill) => skill.id)).toEqual([
      'striking',
      'defense',
      'conditioning',
      'power',
      'ring-iq',
    ]);
    expect(MMA.skills.map((skill) => skill.id)).toEqual([
      'striking',
      'wrestling',
      'grappling',
      'conditioning',
    ]);
    expect(GOLF.skills).toHaveLength(5);
    expect(TENNIS.skills).toHaveLength(5);
  });

  it('uses a league whose letters are nobody else’s, and unique across all nine', () => {
    const letters = SPORTS.map((sport) => sport.leagueShort);
    expect(new Set(letters).size).toBe(SPORTS.length);
    for (const real of ['PGA', 'ATP', 'WTA', 'UFC', 'WBC', 'WBA', 'IBF', 'WBO', 'PFL', 'LIV']) {
      expect(letters).not.toContain(real);
    }
  });

  it('has no draft for a sport that has none, and a draft for every sport that does', () => {
    for (const sport of [...TOUR_SPORTS, ...COMBAT_SPORTS]) {
      expect(sport.economy.draftSize).toBe(0);
      expect(sport.economy.firstRound).toBe(0);
      expect(sport.economy.rookieTop).toBe(0);
    }
    for (const sport of TEAM_SPORTS) expect(sport.economy.draftSize).toBeGreaterThan(0);
  });

  it('anchors the purses to what the sports really pay', () => {
    // Tennis: the 2025 leader won $19.1 million and the 20th $2.2 million; the superstar tier is the leader.
    expect(TENNIS.economy.pay.superstar).toBeGreaterThanOrEqual(18_000_000);
    expect(TENNIS.economy.pay.superstar).toBeLessThanOrEqual(20_000_000);
    expect(TENNIS.economy.pay.starter).toBeLessThan(2_200_000);
    // Golf: the tour averaged about $2.3 million a player; the average player is between role and starter.
    expect(GOLF.economy.pay.role).toBeLessThan(2_335_280);
    expect(GOLF.economy.pay.starter).toBeGreaterThan(2_335_280);
    // Boxing: most boxers earn under $50,000 a year, so the bottom two tiers are a second job.
    expect(BOXING.economy.pay.fringe).toBeLessThan(50_000);
    expect(BOXING.economy.pay.role).toBeLessThan(150_000);
    // MMA: a newcomer is paid $12,000 to show and $12,000 to win, so the fringe is at least a year of two cards.
    expect(MMA.economy.pay.fringe).toBeGreaterThanOrEqual(24_000);
    for (const sport of [GOLF, TENNIS, BOXING, MMA]) {
      for (let index = 1; index < TIERS.length; index += 1) {
        expect(sport.economy.pay[TIERS[index]!]).toBeGreaterThan(
          sport.economy.pay[TIERS[index - 1]!],
        );
      }
    }
  });

  it('is a full-time living from the first tier on a tour and from the second on a fight card', () => {
    for (const sport of [GOLF, TENNIS]) expect(sport.economy.fullTimeFrom).toBe('fringe');
    for (const sport of COMBAT_SPORTS) expect(sport.economy.fullTimeFrom).toBe('role');
  });

  it('lasts longest in golf, and a better player lasts at least as long in all four', () => {
    const top = (sport: Sport) => sport.economy.retireAge.superstar[1];
    expect(top(GOLF)).toBeGreaterThan(top(TENNIS));
    expect(top(GOLF)).toBeGreaterThan(top(BOXING));
    for (const sport of [GOLF, TENNIS, BOXING, MMA]) {
      for (let index = 0; index < TIERS.length; index += 1) {
        const [low, high] = sport.economy.retireAge[TIERS[index]!];
        expect(high).toBeGreaterThanOrEqual(low);
        if (index > 0)
          expect(low).toBeGreaterThanOrEqual(sport.economy.retireAge[TIERS[index - 1]!][0]);
      }
    }
    // Fighters get hurt more than tennis players, who get hurt more than golfers.
    expect(MMA.economy.injuryFactor).toBeGreaterThan(BOXING.economy.injuryFactor);
    expect(BOXING.economy.injuryFactor).toBeGreaterThan(TENNIS.economy.injuryFactor);
    expect(TENNIS.economy.injuryFactor).toBeGreaterThan(GOLF.economy.injuryFactor);
  });
});

/* -------------------------------------------------------------------------- */
/* The arts                                                                    */
/* -------------------------------------------------------------------------- */

describe('the six martial arts', () => {
  it('are boxing, Muay Thai, Brazilian jiu-jitsu, wrestling, karate and taekwondo, and there is no judo', () => {
    expect(MARTIAL_ARTS.map((art) => art.id)).toEqual([
      'boxing',
      'muay-thai',
      'bjj',
      'wrestling',
      'karate',
      'taekwondo',
    ]);
    expect(MARTIAL_ARTS.some((art) => /judo/i.test(art.id + art.name))).toBe(false);
    for (const art of MARTIAL_ARTS) {
      expect(art.skills).toHaveLength(4);
      expect(art.annualCost).toBeGreaterThan(0);
      expect(art.costSource.length).toBeGreaterThan(5);
      expect(art.blurb.length).toBeLessThanOrEqual(52);
    }
    // Only boxing is a base for the boxing career, and every art is a base for MMA.
    expect(MARTIAL_ARTS.filter((art) => art.feeds.includes('boxing')).map((art) => art.id)).toEqual(
      ['boxing'],
    );
    for (const art of MARTIAL_ARTS) expect(art.feeds).toContain('mma');
  });

  it('start at ten, in line with the age Payton gave', () => {
    expect(MARTIAL_ART_MIN_AGE).toBe(10);
    const nine = toAge(life('art-age'), 9);
    expect(nine.player.age).toBe(9);
    const refused = startArt(nine, 'boxing');
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('too-young');
    const ten = toAge(nine, 10);
    const started = startArt(ten, 'boxing');
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(artsOf(started.value.state)).toHaveLength(1);
    expect(artsOf(started.value.state)[0]).toMatchObject({
      artId: 'boxing',
      startedAge: 10,
      seasons: 0,
      level: 20,
    });
    expect(started.value.entry.text).toBe(findMartialArt('boxing')!.startLine);
    // One line in the feed, and a timeline row written for it.
    expect(started.value.state.player.timeline.at(-1)?.id).toBe(started.value.entry.id);
  });

  it('allow two at a time, not the same one twice, and not an art that does not exist', () => {
    let state = toAge(life('art-limits'), 11);
    state = ok(startArt(state, 'boxing')).state;
    const again = startArt(state, 'boxing');
    expect(again.ok).toBe(false);
    state = ok(startArt(state, 'wrestling')).state;
    expect(MAX_ARTS_AT_ONCE).toBe(2);
    const third = startArt(state, 'karate');
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error).toBe('too-many');
    const nothing = startArt(state, 'judo');
    if (!nothing.ok) expect(nothing.error).toBe('no-such-art');
    expect(nothing.ok).toBe(false);
  });

  it('give three sessions a year, each worth less, and stop where work alone can take you', () => {
    let state = toAge(life('art-train'), 12);
    state = ok(startArt(state, 'boxing')).state;
    const levels = [artsOf(state)[0]!.level];
    for (let session = 0; session < 3; session += 1) {
      state = ok(trainArt(state, 'boxing')).state;
      levels.push(artsOf(state)[0]!.level);
    }
    const gains = levels.slice(1).map((level, index) => level - levels[index]!);
    expect(gains.every((gain) => gain >= 1)).toBe(true);
    expect(gains[0]!).toBeGreaterThanOrEqual(gains[2]!);
    const fourth = trainArt(state, 'boxing');
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.error).toBe('no-sessions-left');
    // Never above what the character is, plus the cap.
    for (let year = 0; year < 12; year += 1) {
      state = advanceYear(answerOthers(state)).state;
      state = answerOthers(state);
      for (let session = 0; session < 3; session += 1) {
        const trained = trainArt(state, 'boxing');
        if (trained.ok) state = trained.value.state;
      }
      expect(artsOf(state)[0]?.level ?? 0).toBeLessThanOrEqual(trainingCeiling(state));
    }
  });

  it('are readable only while studied: stopping one takes its level and its skills with it', () => {
    let state = toAge(life('art-readable'), 12);
    expect(readArts(state)).toEqual([]);
    state = ok(startArt(state, 'bjj')).state;
    const [reading] = readArts(state);
    expect(reading).toMatchObject({ id: 'bjj', style: 'grappling', counts: false });
    expect(reading!.skills.map((skill) => skill.id)).toEqual([
      'grappling',
      'escapes',
      'submissions',
      'conditioning',
    ]);
    for (const skill of reading!.skills) {
      expect(skill.value).toBeGreaterThanOrEqual(0);
      expect(skill.value).toBeLessThanOrEqual(100);
    }
    // The same life reads the same numbers, and nothing was drawn to read them.
    expect(readArts(state)).toEqual(readArts(state));
    const stopped = ok(stopArt(state, 'bjj'));
    expect(readArts(stopped.state)).toEqual([]);
    expect(stopped.state.sports.arts ?? []).toEqual([]);
    expect(stopped.entry.text).toBe(findMartialArt('bjj')!.stopLine);
    const nothing = stopArt(stopped.state, 'bjj');
    expect(nothing.ok).toBe(false);
  });

  it('count towards a career after three seasons, with a line when they do', () => {
    expect(MIN_ART_SEASONS).toBe(3);
    let state = toAge(life('art-three'), 10);
    state = ok(startArt(state, 'boxing')).state;
    const lines: string[] = [];
    for (let year = 0; year < 4; year += 1) {
      const next = advanceYear(answerOthers(state));
      lines.push(...next.newEntries.map((entry) => entry.text));
      state = answerOthers(next.state);
    }
    expect(artsOf(state)[0]!.seasons).toBe(4);
    expect(lines.filter((line) => /Three years of Boxing/.test(line))).toHaveLength(1);
    expect(readArts(state)[0]!.counts).toBe(true);
  });

  it('bills an adult living on their own, never a child or somebody still at home', () => {
    const study: ArtStudy = {
      artId: 'muay-thai',
      startedAge: 12,
      seasons: 5,
      hardSeasons: 3,
      level: 50,
      trainedAtAge: -1,
      trainedCount: 0,
    };
    const base = life('art-bills');
    const state: GameState = { ...base, sports: { ...base.sports, arts: [study] } };
    const rich = 5_000_000;
    const adult = runArtsYear(state, 25, 2030, rich, false);
    expect(adult.cost).toBe(findMartialArt('muay-thai')!.annualCost);
    expect(adult.costSource).toMatch(/Muay Thai/);
    expect(runArtsYear(state, 25, 2030, rich, true).cost).toBe(0);
    expect(runArtsYear(state, 15, 2030, rich, false).cost).toBe(0);
    // A tight year drops it, and says so.
    const poor = runArtsYear(state, 25, 2030, 1, false);
    expect(poor.arts).toEqual([]);
    expect(poor.cost).toBe(0);
    expect(poor.lines.join(' ')).toMatch(/Let Muay Thai go/);
  });

  it('never put dues on a child through the game: no ledger row for a ten-year-old’s boxing', () => {
    let state = toAge(life('art-child-ledger'), 10);
    state = ok(startArt(state, 'boxing')).state;
    const before = state.finance.transactions.length;
    const next = advanceYear(answerOthers(state)).state;
    const rows = next.finance.transactions
      .slice(before)
      .filter((row) => /boxing|Boxing/.test(row.source));
    expect(rows).toEqual([]);
  });
});

describe('what a set of arts is a base for', () => {
  const study = (artId: string, level: number, seasons = 4) => ({ artId, level, seasons });

  it('is boxing when boxing has been studied for three seasons, at that level', () => {
    expect(fightCareerFor([study('boxing', 55)])).toEqual({ sportId: 'boxing', form: 55 });
    expect(fightCareerFor([study('boxing', 55, 2)])).toBeUndefined();
  });

  it('is MMA only with a striking art and a grappling art, and starts at their average', () => {
    expect(fightCareerFor([study('wrestling', 60)])).toBeUndefined();
    expect(fightCareerFor([study('bjj', 60)])).toBeUndefined();
    expect(fightCareerFor([study('karate', 60)])).toBeUndefined();
    expect(fightCareerFor([study('taekwondo', 60), study('muay-thai', 60)])).toBeUndefined();
    expect(fightCareerFor([study('muay-thai', 60), study('bjj', 40)])).toEqual({
      sportId: 'mma',
      form: 50,
    });
    expect(fightCareerFor([study('karate', 70), study('wrestling', 50)])).toEqual({
      sportId: 'mma',
      form: 60,
    });
  });

  it('goes with the better start when both are open, and a tie to MMA', () => {
    expect(fightCareerFor([study('boxing', 80), study('bjj', 40)])?.sportId).toBe('boxing');
    expect(fightCareerFor([study('boxing', 40), study('bjj', 80)])?.sportId).toBe('mma');
    expect(fightCareerFor([study('boxing', 60), study('bjj', 60)])?.sportId).toBe('mma');
  });

  it('is read from what a student studies, for a screen that wants to say where they are heading', () => {
    let state = toAge(life('road'), 10);
    expect(fightRoadOf(state)).toBeUndefined();
    state = ok(startArt(state, 'boxing')).state;
    expect(fightRoadOf(state)).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* The road to a fight card                                                    */
/* -------------------------------------------------------------------------- */

describe('turning pro as a fighter', () => {
  it('is never offered before eighteen, and is a question that stops time', () => {
    expect(TURN_PRO_MIN_AGE).toBe(18);
    const fighter = fighterLife('road-boxer', ['boxing'], { answer: 'none' });
    // `answer: 'none'` is not a choice, so the offer is left standing.
    const { state, offeredAt } = fighter;
    expect(offeredAt).toBeDefined();
    expect(offeredAt!).toBeGreaterThanOrEqual(18);
    expect(state.sports.offer?.kind).toBe('turn-pro');
    expect(state.pending.some((row) => row.eventId === SPORTS_OFFER_EVENT_ID)).toBe(true);
    const asked = state.pending.find((row) => row.eventId === SPORTS_OFFER_EVENT_ID)!;
    expect(asked.choices.map((choice) => choice.id)).toEqual([ACCEPT, DECLINE]);
    expect(asked.prompt).toMatch(/card/);
    // Nothing moves while it is open.
    const stuck = advanceYear(state);
    expect(stuck.state).toBe(state);
  });

  it('puts a boxer on a card in the gym that wants them, with a 0–0 record and the arts they came from gone', () => {
    const state = firstWith(
      'road-boxer-accept',
      ['boxing'],
      18,
      (found) => found.sports.career !== undefined,
    );
    const career = state.sports.career!;
    expect(career.sportId).toBe('boxing');
    expect(career.stage).toBe('pro');
    expect(career.tier).toBe('fringe');
    expect(career.wins).toBe(0);
    expect(career.losses).toBe(0);
    expect(recordOf(career)).toBe('0–0');
    expect(career.team).toBeTruthy();
    expect(BOXING.proTeams).toContain(career.team);
    expect(career.contract).toBeUndefined();
    expect(career.peak).toBeUndefined();
    expect(career.endAge).toBeUndefined();
    expect(artsOf(state).some((row) => row.artId === 'boxing')).toBe(false);
    expect(
      state.player.records.some((row) => /Turned pro as a boxing fighter/.test(row.label)),
    ).toBe(true);
    const line = state.player.timeline.at(-1)!.text;
    expect(line).toMatch(/^Signed with .+\. The first fight is in the spring\./);
  });

  it('turns an MMA base into an MMA career, and leaves an art that was not part of it alone', () => {
    let state = toAge(life('road-mma'), 10);
    state = ok(startArt(state, 'muay-thai')).state;
    state = ok(startArt(state, 'bjj')).state;
    let guard = 0;
    while (!state.sports.offer && (guard += 1) < 12) {
      for (const art of ['muay-thai', 'bjj']) {
        for (let session = 0; session < 3; session += 1) {
          const trained = trainArt(state, art);
          if (trained.ok) state = trained.value.state;
        }
      }
      state = answerOthers(advanceYear(answerOthers(state)).state);
    }
    // The draw is one per life; this seed either gets the card or does not, and what it does not get is checked below.
    if (!state.sports.offer) return;
    expect(state.sports.offer.sportId).toBe('mma');
    expect(state.sports.career?.stage).toBe('school');
    const taken = ok(decide(state, SPORTS_OFFER_EVENT_ID, ACCEPT)).state;
    expect(taken.sports.career).toMatchObject({
      sportId: 'mma',
      stage: 'pro',
      wins: 0,
      losses: 0,
      tier: 'fringe',
    });
    expect(artsOf(taken)).toEqual([]);
  });

  it('never offers a card on a single striking or grappling art alone', () => {
    for (const art of ['wrestling', 'bjj', 'karate', 'taekwondo', 'muay-thai']) {
      const fighter = fighterLife(`alone-${art}`, [art], { until: 31 });
      expect(fighter.offeredAt, art).toBeUndefined();
      expect(fighter.state.sports.past).toEqual([]);
    }
  });

  it('is asked once: turning it down is the answer, and the gym does not ask again', () => {
    const { state } = fighterLife('road-decline', ['boxing'], { answer: DECLINE, until: 34 });
    expect(state.sports.career).toBeUndefined();
    expect(state.sports.past).toHaveLength(1);
    expect(state.sports.past[0]).toMatchObject({
      sportId: 'boxing',
      how: 'declined',
      reached: 'school',
    });
    expect(state.sports.offer).toBeUndefined();
    expect(state.sports.past.filter((row) => row.sportId === 'boxing')).toHaveLength(1);
    // The art is still being studied: declining ends the road, not the hobby.
    expect(artsOf(state).some((row) => row.artId === 'boxing')).toBe(true);
  });

  it('is not offered after thirty', () => {
    expect(TURN_PRO_MAX_AGE).toBe(30);
    let state = toAge(life('road-late'), 29);
    state = ok(startArt(state, 'boxing')).state;
    for (let year = 0; year < 6; year += 1) {
      for (let session = 0; session < 3; session += 1) {
        const trained = trainArt(state, 'boxing');
        if (trained.ok) state = trained.value.state;
      }
      state = answerOthers(advanceYear(answerOthers(state)).state);
      expect(state.sports.offer).toBeUndefined();
    }
  });

  it('is decided by one draw for the life, so a seed that got a card always gets it and one that did not, never does', () => {
    const first = fighterLife('road-deterministic', ['boxing'], { answer: DECLINE, until: 34 });
    const second = fighterLife('road-deterministic', ['boxing'], { answer: DECLINE, until: 34 });
    expect(second.offeredAt).toBe(first.offeredAt);
  });
});

/* -------------------------------------------------------------------------- */
/* A season of results                                                         */
/* -------------------------------------------------------------------------- */

describe('a fighter’s year', () => {
  it('has the number of fights its tier and sport call for, and adds them to the record', () => {
    for (const sport of COMBAT_SPORTS) {
      for (const tier of TIERS) {
        const rows = seasons(sport, { tier, form: 60, wins: 5, losses: 2 }, 40);
        const healthy = rows.filter((row) => row.career.wins! + row.career.losses! > 7);
        expect(healthy.length).toBeGreaterThan(20);
        for (const row of healthy) {
          expect(row.career.wins! + row.career.losses! - 7).toBe(
            FIGHTS_PER_YEAR[sport.id as 'boxing' | 'mma'][tier],
          );
        }
      }
    }
  });

  it('is decided by skill: a fighter at 90 wins far more than one at 30, against the same opposition', () => {
    const share = (form: number): number => {
      let wins = 0;
      let fights = 0;
      for (const sport of COMBAT_SPORTS) {
        for (const row of seasons(
          sport,
          { tier: 'starter', form, wins: 0, losses: 0 },
          150,
          `skill-${sport.id}`,
        )) {
          wins += row.career.wins!;
          fights += row.career.wins! + row.career.losses!;
        }
      }
      return wins / fights;
    };
    const strong = share(90);
    const weak = share(30);
    expect(strong).toBeGreaterThan(0.85);
    expect(weak).toBeLessThan(0.15);
    // And the win chance itself rises with form and falls with the tier, and always stays a chance.
    for (const tier of TIERS) {
      let last = 0;
      for (let form = 0; form <= 100; form += 10) {
        const chance = fightWinChance(form, tier, 0.5);
        expect(chance).toBeGreaterThan(0);
        expect(chance).toBeLessThan(1);
        expect(chance).toBeGreaterThan(last);
        last = chance;
      }
    }
    expect(fightWinChance(60, 'fringe', 0.5)).toBeGreaterThan(fightWinChance(60, 'superstar', 0.5));
    // A softer opponent is a better chance, at the same tier.
    expect(fightWinChance(60, 'starter', 0)).toBeGreaterThan(fightWinChance(60, 'starter', 1));
  });

  it('is the same year for the same life, whatever else the machine did in between', () => {
    const one = seasons(BOXING, { tier: 'starter', form: 65 }, 20, 'same');
    const two = seasons(BOXING, { tier: 'starter', form: 65 }, 20, 'same');
    expect(two).toEqual(one);
  });

  it('rises on a winning year and falls on a losing one, never more than a rung', () => {
    const climbing = seasons(BOXING, { tier: 'role', form: 95, wins: 3, losses: 0 }, 120, 'climb');
    const ups = climbing.filter((row) => row.career.tier !== 'role');
    expect(ups.length).toBeGreaterThan(40);
    for (const row of ups) {
      expect(['starter', 'fringe']).toContain(row.career.tier);
    }
    expect(climbing.filter((row) => row.career.tier === 'starter').length).toBeGreaterThan(
      climbing.filter((row) => row.career.tier === 'fringe').length * 3,
    );
    const falling = seasons(BOXING, { tier: 'star', form: 20, wins: 20, losses: 0 }, 120, 'fall');
    expect(falling.filter((row) => row.career.tier === 'starter').length).toBeGreaterThan(40);
    for (const row of falling) expect(['star', 'starter', 'role']).toContain(row.career.tier);
  });

  it('is released from the card after a bad year at the bottom, but never in the first season', () => {
    const first = seasons(
      BOXING,
      { tier: 'fringe', form: 5, proSeasons: 0, wins: 0, losses: 0 },
      60,
      'rookie',
    );
    expect(first.every((row) => row.ended === undefined || row.ended === 'injury')).toBe(true);
    const later = seasons(
      BOXING,
      { tier: 'fringe', form: 5, proSeasons: 4, wins: 0, losses: 0 },
      60,
      'veteran',
    );
    const released = later.filter((row) => row.ended === 'released');
    expect(released.length).toBeGreaterThan(20);
    expect(released[0]!.lines.some((line) => /stopped booking you/.test(line.text))).toBe(true);
  });

  it('keeps a title as a belt: moving into the top two rungs of a card, with a record of it', () => {
    const rows = seasons(
      MMA,
      { tier: 'starter', form: 99, wins: 8, losses: 0, titles: 0 },
      100,
      'belt',
    );
    const belts = rows.filter((row) => row.career.titles > 0);
    expect(belts.length).toBeGreaterThan(10);
    const row = belts[0]!;
    expect(row.records[0]).toMatchObject({ category: 'championship', referenceId: 'mma' });
    expect(row.records[0]!.label).toBe('Won the IFL title');
    expect(row.lines.some((line) => /title/.test(line.text) && line.kind === 'milestone')).toBe(
      true,
    );
  });

  it('writes the record in the year’s line, in the form a fight card prints it', () => {
    const rows = seasons(BOXING, { tier: 'role', form: 60, wins: 5, losses: 2 }, 12, 'words');
    const row = rows.find((candidate) =>
      candidate.lines.some((line) => /Went \d–\d this year/.test(line.text)),
    )!;
    const line = row.lines.find((candidate) => /Went \d–\d this year/.test(candidate.text))!;
    const [, won, lost, totalWon, totalLost] =
      /Went (\d)–(\d) this year\. (\d+)–(\d+) as a pro/.exec(line.text)!;
    expect(Number(totalWon)).toBe(5 + Number(won));
    expect(Number(totalLost)).toBe(2 + Number(lost));
    expect(recordOf(row.career)).toBe(`${totalWon}–${totalLost}`);
    expect(recordOf(undefined)).toBeUndefined();
    expect(recordOf({ ...row.career, wins: undefined })).toBeUndefined();
  });

  it('retires at an age that depends on the best tier reached, and a rise extends it', () => {
    const lows = new Set<number>();
    for (let index = 0; index < 60; index += 1) {
      const low = retirementAge(BOXING, 'fringe', `life-${index}`, 0);
      const high = retirementAge(BOXING, 'superstar', `life-${index}`, 0);
      expect(low).toBeGreaterThanOrEqual(BOXING.economy.retireAge.fringe[0]);
      expect(low).toBeLessThanOrEqual(BOXING.economy.retireAge.fringe[1]);
      expect(high).toBeGreaterThanOrEqual(BOXING.economy.retireAge.superstar[0]);
      expect(high).toBeGreaterThanOrEqual(low);
      lows.add(low);
    }
    expect(lows.size).toBeGreaterThan(2);
    // A career that has not risen retires on the day its best tier says, and not the year before.
    const state = proState(BOXING, { tier: 'fringe', best: 'fringe', form: 45 }, 'retire-fixture');
    const due = retirementAge(BOXING, 'fringe', state.rng.getSeed(), state.world.generation);
    const run = (age: number, year: number) =>
      runIndividualSeason({
        before: state,
        career: state.sports.career!,
        sport: BOXING,
        age,
        year,
      });
    let retired = 0;
    let early = 0;
    for (let year = 2040; year < 2200; year += 1) {
      if (run(due, year).ended === 'retired') retired += 1;
      if (run(due - 1, year).ended === 'retired') early += 1;
    }
    expect(early).toBe(0);
    expect(retired).toBeGreaterThan(100);
    const out = run(due, 2041);
    const line = out.lines.find((row) => /^Retired from boxing/.test(row.text));
    if (line)
      expect(line.text).toMatch(
        /^Retired from boxing at \d+, after \d+ seasons? and a record of \d+–\d+/,
      );
    // And somebody who has risen retires later than the same life would have as a fringe fighter.
    const best = retirementAge(BOXING, 'superstar', state.rng.getSeed(), state.world.generation);
    expect(best).toBeGreaterThan(due);
  });

  it('is hurt as a fighter is, in a fighter’s words, and a serious injury cancels the year’s fights and most of its purse', () => {
    const rows = seasons(MMA, { tier: 'starter', form: 60, wins: 1, losses: 1 }, 400, 'injuries');
    const serious = rows.filter((row) =>
      row.lines.some((line) => /broken hand|Tore a knee|orbital/.test(line.text)),
    );
    expect(serious.length).toBeGreaterThan(3);
    for (const row of serious) {
      expect(row.career.wins).toBe(1);
      expect(row.career.losses).toBe(1);
      expect(row.pay).toBe(Math.round(MMA.economy.pay.starter * 0.25));
      expect(row.health).toBeLessThan(0);
    }
    expect(
      rows.some((row) =>
        row.lines.some((line) => /cut over the eye|knuckle|bruised ribs/.test(line.text)),
      ),
    ).toBe(true);
    // Nobody says "ankle" in a ring.
    expect(
      rows.some((row) => row.lines.some((line) => /sprained ankle|games/.test(line.text))),
    ).toBe(false);
  });

  it('pays the tier’s year within its spread, and a quarter of it for a year lost to injury', () => {
    const rows = seasons(BOXING, { tier: 'star', form: 70, wins: 5, losses: 2 }, 300, 'purse');
    const well = rows.filter((row) => row.pay > 0.5 * BOXING.economy.pay.star);
    expect(well.length).toBeGreaterThan(150);
    for (const row of well) {
      expect(row.pay).toBeGreaterThanOrEqual(Math.round(BOXING.economy.pay.star * 0.75));
      expect(row.pay).toBeLessThanOrEqual(Math.round(BOXING.economy.pay.star * 1.5));
    }
  });
});

describe('a tour year', () => {
  it('has no fights and no record, a world rank in the tier’s band, and prize money', () => {
    for (const sport of [GOLF, TENNIS]) {
      const rows = seasons(sport, { tier: 'starter', form: 64, titles: 0 }, 60, `tour-${sport.id}`);
      for (const row of rows) {
        expect(row.career.wins).toBeUndefined();
        expect(row.career.losses).toBeUndefined();
        expect(recordOf(row.career)).toBeUndefined();
      }
      const healthy = rows.filter((row) => row.pay > 0.5 * sport.economy.pay.starter);
      expect(healthy.length).toBeGreaterThan(30);
      const ranked = rows.flatMap((row) =>
        row.lines.filter((line) => /ranked \d+(st|nd|rd|th) in the world/.test(line.text)),
      );
      expect(ranked.length).toBeGreaterThan(30);
    }
  });

  it('keeps every rank inside its band, bands that do not overlap and do cover the field', () => {
    let top = 0;
    for (const tier of ['superstar', 'star', 'starter', 'role', 'fringe'] as const) {
      const [low, high] = WORLD_RANK_BAND[tier];
      expect(low).toBe(top + 1);
      expect(high).toBeGreaterThanOrEqual(low);
      top = high;
      for (const unit of [0, 0.3, 0.7, 0.999999]) {
        const rank = worldRankFor(tier, unit);
        expect(rank).toBeGreaterThanOrEqual(low);
        expect(rank).toBeLessThanOrEqual(high);
      }
    }
    expect(WORLD_RANK_BAND.superstar[0]).toBe(1);
  });

  it('reads the world rank off the life: a tour player has one, nobody else does, and nothing is saved for it', () => {
    const golfer = proState(GOLF, { tier: 'star' }, 'rank-golf');
    const rank = worldRankOf(golfer);
    expect(rank).toBeGreaterThanOrEqual(WORLD_RANK_BAND.star[0]);
    expect(rank).toBeLessThanOrEqual(WORLD_RANK_BAND.star[1]);
    expect(worldRankOf(golfer)).toBe(rank);
    expect(worldRankOf(proState(BOXING, { tier: 'star' }))).toBeUndefined();
    expect(worldRankOf(proState(findSport('basketball')!, { tier: 'star' }))).toBeUndefined();
    expect(worldRankOf(life('rank-none'))).toBeUndefined();
    expect(Object.keys(golfer.sports.career!)).not.toContain('rank');
  });

  it('loses the card at the bottom after a year well below the field, and not in the first', () => {
    const veteran = seasons(TENNIS, { tier: 'fringe', form: 5, proSeasons: 5 }, 60, 'card');
    const lost = veteran.filter((row) => row.ended === 'lost-card');
    expect(lost.length).toBeGreaterThan(20);
    expect(lost[0]!.lines.at(-1)!.text).toMatch(/Lost your WTC card/);
    const rookie = seasons(TENNIS, { tier: 'fringe', form: 5, proSeasons: 0 }, 60, 'card-rookie');
    expect(rookie.some((row) => row.ended === 'lost-card')).toBe(false);
  });

  it('wins events more often higher up, and never at the bottom', () => {
    const wins = (tier: SportTier): number =>
      seasons(GOLF, { tier, form: FIELD_STRENGTH[tier], titles: 0 }, 400, `title-${tier}`).filter(
        (row) => row.career.titles > 0,
      ).length;
    expect(wins('fringe')).toBe(0);
    expect(wins('superstar')).toBeGreaterThan(wins('starter'));
    expect(wins('starter')).toBeGreaterThan(wins('role'));
    expect(wins('superstar')).toBeGreaterThan(100);
  });

  it('rises on a good year and falls on a bad one, and the performance table is monotone', () => {
    expect(tierForPerformance(0)).toBe('fringe');
    expect(tierForPerformance(FIELD_STRENGTH.role)).toBe('role');
    expect(tierForPerformance(FIELD_STRENGTH.starter - 0.1)).toBe('role');
    expect(tierForPerformance(FIELD_STRENGTH.superstar)).toBe('superstar');
    expect(tierForPerformance(100)).toBe('superstar');
    let last = 0;
    for (let performance = 0; performance <= 100; performance += 1) {
      const rank = TIERS.indexOf(tierForPerformance(performance));
      expect(rank).toBeGreaterThanOrEqual(last);
      last = rank;
    }
    expect(isOut(FIELD_STRENGTH.fringe - OUT_MARGIN - 1)).toBe(true);
    expect(isOut(FIELD_STRENGTH.fringe - OUT_MARGIN)).toBe(false);
    const up = seasons(GOLF, { tier: 'role', form: 95, proSeasons: 4 }, 80, 'golf-up');
    expect(up.filter((row) => row.career.tier === 'starter').length).toBeGreaterThan(40);
    const down = seasons(GOLF, { tier: 'star', form: 40, proSeasons: 4 }, 80, 'golf-down');
    expect(down.filter((row) => row.career.tier === 'starter').length).toBeGreaterThan(40);
  });

  it('keeps the best tier reached, and a fall does not take it away', () => {
    const rows = seasons(
      TENNIS,
      { tier: 'star', best: 'superstar', form: 30, proSeasons: 6 },
      40,
      'best',
    );
    for (const row of rows) expect(row.career.best).toBe('superstar');
    const rise = seasons(
      TENNIS,
      { tier: 'star', best: 'star', form: 99, proSeasons: 6 },
      40,
      'best-up',
    );
    expect(rise.some((row) => row.career.best === 'superstar')).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Through the game                                                            */
/* -------------------------------------------------------------------------- */

describe('golf and tennis, through the game', () => {
  it.each([
    ['Golf', GOLF],
    ['Tennis', TENNIS],
  ] as const)('%s has a tour card at the end of college, and not a contract', (_name, sport) => {
    let found: GameState | undefined;
    for (let index = 0; index < 30 && !found; index += 1) {
      const state = tourLife(sport, `tour-ladder-${sport.id}-${index}`, { until: 27 });
      if (state.sports.career?.stage === 'pro') found = state;
    }
    expect(found).toBeDefined();
    const state = found!;
    const career = state.sports.career;
    if (career) {
      expect(career.stage).toBe('pro');
      expect(career.contract).toBeUndefined();
      expect(career.team).toBeUndefined();
      expect(career.peak).toBeUndefined();
      expect(career.endAge).toBeUndefined();
      expect(isFullTime(career)).toBe(true);
      expect(sportsOccupation(career)).toBe(sport.playerTitle);
      expect(skillsOf(state).map((skill) => skill.id)).toEqual(
        sport.skills.map((skill) => skill.id),
      );
      expect(state.player.occupation).toBe(sport.playerTitle);
    }
    const timeline = state.player.timeline.map((row) => row.text).join('\n');
    expect(timeline).toMatch(new RegExp(`Earned a ${sport.leagueShort} card`));
    expect(timeline).not.toMatch(/Signed with the/);
  });

  it('asks about the card as Take it or Turn it down, with no ask-for-more', () => {
    for (let index = 0; index < 40; index += 1) {
      let state = life(`card-question-${index}`);
      let guard = 0;
      while (state.player.alive && state.player.age < 26 && (guard += 1) < 40) {
        state = answerOthers(state);
        if (state.player.age >= 12 && state.player.age <= 17) {
          const made = tryOut(state, GOLF.activityId);
          if (made.ok) state = made.value.state;
          for (let session = 0; session < 3; session += 1) {
            const practised = practise(state, GOLF.activityId);
            if (practised.ok) state = practised.value.state;
          }
        }
        if (isPlaying(state.sports.career)) {
          for (let session = 0; session < 3; session += 1) {
            const trained = trainSport(state);
            if (trained.ok) state = trained.value.state;
          }
        }
        state = advanceYear(state).state;
        if (state.sports.offer?.kind === 'tour-card') {
          const asked = state.pending.find((row) => row.eventId === SPORTS_OFFER_EVENT_ID)!;
          expect(asked.choices.map((choice) => choice.label)).toEqual([
            'Take the card',
            'Turn it down',
          ]);
          expect(asked.prompt).toContain('Continental Golf Tour');
          expect(asked.prompt).toMatch(/No salary and no team/);
          const turned = ok(decide(state, SPORTS_OFFER_EVENT_ID, DECLINE)).state;
          expect(turned.sports.past.at(-1)).toMatchObject({
            sportId: 'golf',
            how: 'declined',
            reached: 'college',
          });
          expect(turned.sports.career).toBeUndefined();
          return;
        }
        if (state.sports.offer) state = ok(decide(state, SPORTS_OFFER_EVENT_ID, ACCEPT)).state;
      }
    }
    throw new Error('no life in 40 reached a tour card');
  });

  it('pays prize money, not a salary, in the ledger, with the tax on it', () => {
    let checked = 0;
    for (let index = 0; index < 40 && checked < 1; index += 1) {
      let state = tourLife(GOLF, `tour-ledger-${index}`, { until: 26 });
      if (state.sports.career?.stage !== 'pro') continue;
      const before = state.finance.transactions.length;
      state = advanceYear(answerOthers(state)).state;
      const rows = state.finance.transactions.slice(before);
      const pay = rows.find(
        (row) => row.category === 'salary' && /Prize money, Continental Golf Tour/.test(row.source),
      );
      expect(pay).toBeDefined();
      expect(
        rows.some((row) => row.category === 'tax' && /Tax on playing pay/.test(row.source)),
      ).toBe(true);
      expect(rows.some((row) => /Playing for the/.test(row.source))).toBe(false);
      checked += 1;
    }
    expect(checked).toBe(1);
  });
});

describe('boxing and MMA, through the game', () => {
  it('puts the fighter in the ledger as fight purses, and a part-time one keeps their job', () => {
    const state = firstWith(
      'fighter-ledger',
      ['boxing'],
      18,
      (found) => found.sports.career !== undefined,
    );
    const career = state.sports.career!;
    expect(career.stage).toBe('pro');
    // A new fighter is on the edge of the card: the purses are not a living, and nobody is paid a salary.
    expect(career.tier).toBe('fringe');
    expect(isFullTime(career)).toBe(false);
    expect(sportsOccupation(career)).toBeUndefined();
    expect(state.player.occupation).not.toBe('Professional boxer');
    const before = state.finance.transactions.length;
    const next = advanceYear(answerOthers(state)).state;
    const rows = next.finance.transactions.slice(before);
    expect(
      rows.some(
        (row) =>
          row.category === 'salary' && /Fight purses, Atlantic Boxing Federation/.test(row.source),
      ),
    ).toBe(true);
    expect(rows.some((row) => /Playing for the/.test(row.source))).toBe(false);
  });

  it('makes a full-time living of it from the second rung, ends the day job, and stops job offers', () => {
    const base = proState(BOXING, { tier: 'role' }, 'living');
    expect(isFullTime(base.sports.career)).toBe(true);
    expect(sportsOccupation(base.sports.career)).toBe('Professional boxer');
    const fringe = proState(BOXING, { tier: 'fringe' }, 'living-fringe');
    expect(isFullTime(fringe.sports.career)).toBe(false);
    expect(isFullTime(undefined)).toBe(false);
    expect(isFullTime(proState(findSport('basketball')!, { tier: 'fringe' }).sports.career)).toBe(
      true,
    );
    const college: GameState = {
      ...base,
      sports: { ...base.sports, career: { ...base.sports.career!, stage: 'college' } },
    };
    expect(isFullTime(college.sports.career)).toBe(false);
  });

  it('only a boxer or MMA fighter can not study the art that is already their job', () => {
    const state = proState(BOXING, { tier: 'role' }, 'is-job');
    const refused = startArt({ ...state, player: { ...state.player, age: 25 } }, 'boxing');
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('is-your-career');
    // Another art is allowed: a boxer who wants to learn to wrestle.
    expect(startArt({ ...state, player: { ...state.player, age: 25 } }, 'wrestling').ok).toBe(true);
  });

  it('reaches the card at the rates the table gives, for a hard worker, a talented one, and neither', () => {
    const rate = (talented: boolean, work: boolean, n: number): number => {
      let reached = 0;
      for (let index = 0; index < n; index += 1) {
        const { state } = fighterLife(`odds-${talented}-${work}-${index}`, ['boxing'], {
          talented,
          work,
        });
        if (state.sports.past.some((row) => row.how !== 'declined') || state.sports.career)
          reached += 1;
      }
      return reached / n;
    };
    // Payton's table: about 95% with talent and work, 75% with talent alone, 60% with work alone, 3% with neither.
    expect(rate(true, true, 40)).toBeGreaterThan(0.85);
    expect(rate(true, false, 40)).toBeGreaterThan(0.58);
    expect(rate(true, false, 40)).toBeLessThan(0.92);
    expect(rate(false, true, 40)).toBeGreaterThan(0.4);
    expect(rate(false, true, 40)).toBeLessThan(0.8);
    expect(rate(false, false, 80)).toBeLessThan(0.12);
  });
});

describe('a life that never goes near any of it', () => {
  it('has no arts, no offer and no career, and replays exactly as it did before this ticket', () => {
    let state = createNewGame({ seed: 'untouched-0803' });
    let guard = 0;
    while (state.player.alive && state.player.age < 40 && (guard += 1) < 60) {
      state = answerOthers(advanceYear(answerOthers(state)).state);
      expect('arts' in state.sports).toBe(false);
      expect(state.sports.offer).toBeUndefined();
    }
  });

  it('draws nothing from the random streams to read an art, a record or a rank', () => {
    const state = proState(GOLF, { tier: 'role' }, 'no-streams');
    const seed = state.rng.getSeed();
    readArts(state);
    worldRankOf(state);
    recordOf(state.sports.career);
    isFullTime(state.sports.career);
    expect(state.rng.getSeed()).toBe(seed);
  });

  it('is not changed by a sports year when nobody studies and nobody plays', () => {
    const state = life('no-year');
    const out = runSportsYear({ before: state, education: state.education, age: 30, year: 2050 });
    expect(out.sports).toEqual({ past: [] });
    expect(out.lines).toEqual([]);
    expect(out.fees).toBe(0);
    expect(out.pay).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Rules a sabotage run found nothing was holding                              */
/* -------------------------------------------------------------------------- */

const study = (artId: string, seasons: number, level = 70): ArtStudy => ({
  artId,
  startedAge: 10,
  seasons,
  hardSeasons: seasons,
  level,
  trainedAtAge: -1,
  trainedCount: 0,
});

const withArts = (state: GameState, arts: readonly ArtStudy[]): GameState => ({
  ...state,
  sports: { ...state.sports, arts },
});

describe('the years of an art', () => {
  it('say so on the third year of study, and not before or after', () => {
    const base = life('art-three');
    const line = (seasons: number) =>
      runArtsYear(
        withArts(base, [study('boxing', seasons)]),
        25,
        2030,
        5_000_000,
        false,
      ).lines.join(' ');
    expect(line(1)).not.toMatch(/Three years/);
    expect(line(2)).toMatch(/Three years of Boxing/);
    expect(line(3)).not.toMatch(/Three years/);
  });

  it('wear down after forty: the same art, ten years on, is worse', () => {
    const base = withArts(life('art-ageing'), [study('boxing', 12, 60)]);
    const at40 = runArtsYear(base, 40, 2030, 5_000_000, false).arts[0]!.level;
    const at60 = runArtsYear(base, 60, 2030, 5_000_000, false).arts[0]!.level;
    expect(at40 - at60).toBeGreaterThanOrEqual(20);
  });

  it('are posted to the ledger as spending, for an adult paying their own way', () => {
    let state = toAge(life('dues-ledger'), 30);
    state = withArts(
      {
        ...state,
        household: { ...state.household, housing: 'ownPlace', standard: 5_000_000 },
      },
      [study('muay-thai', 5, 50)],
    );
    const before = state.finance.transactions.length;
    const next = advanceYear(answerOthers(state)).state;
    const rows = next.finance.transactions
      .slice(before)
      .filter((row) => row.category === 'spending' && /Muay Thai/.test(row.source));
    expect(rows).toHaveLength(1);
    expect(next.sports.arts?.length).toBe(1);
  });
});

describe('the ceiling of what work alone can do', () => {
  it('is what the character is plus seven, and no more', () => {
    const state = life('ceiling');
    const natural = naturalForm(
      state.player.stats.health,
      state.player.stats.discipline,
      state.player.talents.athletics,
    );
    expect(trainingCeiling(state)).toBe(Math.min(100, natural + 7));
    // A level that is already above it falls back when a card is earned.
    const college: SportCareer = {
      sportId: 'golf',
      stage: 'college',
      startedAge: 14,
      seasons: 8,
      hardSeasons: 8,
      form: 100,
      trainedAtAge: -1,
      trainedCount: 0,
      reputation: 0,
      titles: 0,
    };
    let found: ReturnType<typeof tourCardOffer>;
    for (let index = 0; index < 40 && !found; index += 1) {
      const candidate = life(`ceiling-card-${index}`);
      found = tourCardOffer(candidate, college, GOLF, 22);
      if (found) {
        expect(found.career.form).toBe(trainingCeiling(candidate));
        expect(found.career.form).toBeLessThan(100);
      }
    }
    expect(found).toBeDefined();
  });

  it('leaves a card out of reach of somebody with neither talent nor work', () => {
    const college: SportCareer = {
      sportId: 'golf',
      stage: 'college',
      startedAge: 14,
      seasons: 8,
      hardSeasons: 0,
      form: 60,
      trainedAtAge: -1,
      trainedCount: 0,
      reputation: 0,
      titles: 0,
    };
    let refused = 0;
    for (let index = 0; index < 40; index += 1) {
      if (!tourCardOffer(life(`no-card-${index}`, false), college, GOLF, 22)) refused += 1;
    }
    expect(refused).toBeGreaterThan(20);
  });
});

describe('who is offered a card, and when', () => {
  const arts = [study('boxing', 6)];
  const offered = (age: number, state: GameState) => turnProOffer(state, age, arts);
  const gets = (): GameState => {
    for (let index = 0; index < 40; index += 1) {
      const state = life(`card-window-${index}`);
      if (offered(20, state)) return state;
    }
    throw new Error('no life of 40 was offered a card');
  };

  it('is between eighteen and thirty, inclusive, and nothing else', () => {
    const state = gets();
    for (const age of [15, 16, 17]) expect(offered(age, state)).toBeUndefined();
    for (const age of [18, 24, TURN_PRO_MAX_AGE]) expect(offered(age, state)).toBeDefined();
    for (const age of [31, 33, 36]) expect(offered(age, state)).toBeUndefined();
  });

  it('is made once a sport: a fighter who has already had the career is not asked again', () => {
    const state = gets();
    const done: GameState = {
      ...state,
      sports: {
        ...state.sports,
        past: [
          {
            sportId: 'boxing',
            startedAge: 18,
            endedAge: 24,
            seasons: 6,
            titles: 0,
            reputation: 0,
            reached: 'pro',
            how: 'released',
          },
        ],
      },
    };
    expect(offered(25, done)).toBeUndefined();
  });

  it('uses only the boxing for boxing, whatever else has been studied for three years', () => {
    const both = [study('boxing', 4), study('muay-thai', 4)];
    expect(baseArts(both, BOXING).map((row) => row.artId)).toEqual(['boxing']);
    const mixed = [study('boxing', 4, 70), study('muay-thai', 4, 60), study('bjj', 4, 50)];
    expect(
      baseArts(mixed, MMA)
        .map((row) => row.artId)
        .sort(),
    ).toEqual(['bjj', 'boxing']);
  });

  it('keeps the day job of a fighter who takes a card at the bottom, and ends it from the second rung', () => {
    // A boxer who is offered the card at eighteen, with a job held.
    let state: GameState | undefined;
    for (let index = 0; index < 40 && !state; index += 1) {
      let current = life(`job-card-${index}`);
      let guard = 0;
      while (current.player.age < 20 && (guard += 1) < 30) {
        current = answerOthers(current);
        if (current.player.age >= 10 && artsOf(current).length === 0) {
          const started = startArt(current, 'boxing');
          if (started.ok) current = started.value.state;
        }
        for (let session = 0; session < 3; session += 1) {
          const trained = trainArt(current, 'boxing');
          if (trained.ok) current = trained.value.state;
        }
        current = advanceYear(current).state;
        if (current.sports.offer?.kind === 'turn-pro') {
          state = current;
          break;
        }
      }
    }
    if (!state) throw new Error('no life of 40 was offered a card');
    const job = state.employment.job ?? {
      jobId: 'job.teaching-assistant',
      since: state.player.age - 1,
      performance: 50,
    };
    const held: GameState = { ...state, employment: { ...state.employment, job: job as never } };
    const answered = ok(decide(held, SPORTS_OFFER_EVENT_ID, ACCEPT)).state;
    expect(answered.sports.career?.tier).toBe('fringe');
    expect(answered.employment.job).toBeDefined();
  });

  it('is not what stops a job offer for a fighter at the bottom of the card, only a living is', () => {
    const adult = toAge(life('job-door'), 26);
    const state: GameState = {
      ...adult,
      sports: { ...adult.sports, career: proState(BOXING, { tier: 'fringe' }).sports.career! },
    };
    const {
      offer: _a,
      collegeOffer: _b,
      lifeOffer: _c,
      pursuitOffer: _d,
      homeOffer: _e,
      vehicleOffer: _f,
      renovationOffer: _g,
      ...clear
    } = state;
    let raised = 0;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const tried = withAnyOffer(
        {
          ...clear,
          pending: [],
          employment: { ...state.employment, job: undefined },
          education: { ...state.education, finishedAtAge: state.player.age },
          world: { ...state.world, year: state.world.year + attempt },
        },
        true,
      );
      if (tried.offer) raised += 1;
    }
    expect(raised).toBeGreaterThan(0);
  });
});

describe('what a fight card does to a record', () => {
  const finish = (sport: Sport, career: Partial<SportCareer>, seed: string): GameState => {
    let state = toAge(life(seed), 26);
    const built = proState(sport, career, seed).sports.career!;
    state = { ...state, sports: { ...state.sports, career: built } };
    for (let year = 0; year < 8 && state.sports.career; year += 1) {
      state = answerOthers(advanceYear(answerOthers(state)).state);
    }
    return state;
  };

  it('is kept when a fighter is let go: the wins and the losses, in the past', () => {
    const state = finish(
      BOXING,
      { tier: 'fringe', form: 5, proSeasons: 4, wins: 3, losses: 9 },
      'record-kept',
    );
    expect(state.sports.career).toBeUndefined();
    const past = state.sports.past.at(-1)!;
    expect(past.how).toBe('released');
    expect(past.wins).toBeGreaterThanOrEqual(3);
    expect(past.losses).toBeGreaterThanOrEqual(9);
  });

  it('keeps the best a tour player reached, once the card is gone', () => {
    const state = finish(
      TENNIS,
      { tier: 'fringe', best: 'superstar', form: 5, proSeasons: 6 },
      'best-kept',
    );
    expect(state.sports.career).toBeUndefined();
    expect(state.sports.past.at(-1)!.bestTier).toBe('superstar');
  });
});

describe('a year’s results, read at the edges', () => {
  it('lets a serious injury cost a rung three times in ten, by the hash and no other way', () => {
    const sport = TENNIS;
    const state = proState(sport, { tier: 'star', form: 80, proSeasons: 6 }, 'rung-loss');
    const seed = state.rng.getSeed();
    const gen = state.world.generation;
    let dropped = 0;
    let kept = 0;
    for (let year = 2000; year < 2600; year += 1) {
      const row = runIndividualSeason({
        before: state,
        career: state.sports.career!,
        sport,
        age: 26,
        year,
      });
      if (row.ended !== undefined) continue;
      if (row.pay !== Math.round(sport.economy.pay.star * 0.25)) continue;
      const roll = sportUnit(seed, gen, 'tierloss', year);
      if (roll < 0.3) {
        expect(row.career.tier).toBe('starter');
        dropped += 1;
      } else {
        expect(row.career.tier).toBe('star');
        kept += 1;
      }
    }
    expect(dropped).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
  });

  it('moves a fighter on luck as well as form: the same form, up on a lucky year and down on a bad one', () => {
    const rows = seasons(
      BOXING,
      { tier: 'role', form: 62, proSeasons: 3, wins: 5, losses: 2 },
      200,
    );
    const tiers = new Set(
      rows.filter((row) => row.ended === undefined).map((row) => row.career.tier),
    );
    expect(tiers.has('starter')).toBe(true);
    expect(tiers.has('fringe')).toBe(true);
  });

  it('gives a belt only for reaching the top two rungs of a card, never for the third', () => {
    const toStarter = seasons(
      BOXING,
      { tier: 'role', form: 80, proSeasons: 3, wins: 5, losses: 2 },
      80,
    );
    const up = toStarter.filter((row) => row.career.tier === 'starter');
    expect(up.length).toBeGreaterThan(0);
    for (const row of up) expect(row.career.titles).toBe(0);
    const toStar = seasons(
      BOXING,
      { tier: 'starter', form: 95, proSeasons: 5, wins: 9, losses: 2 },
      80,
    );
    const belts = toStar.filter((row) => row.career.tier === 'star');
    expect(belts.length).toBeGreaterThan(0);
    for (const row of belts) expect(row.career.titles).toBe(1);
  });
});
