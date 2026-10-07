/**
 * Ticket 0804 acceptance tests — the Olympic sports, and coaching and commentary after a career.
 *
 * Five groups (track and field, swimming, gymnastics, wrestling, amateur boxing), a Games every fourth year,
 * medals that pay a small prize and a larger sponsorship, and for any retired athlete of any sport a coaching or
 * commentary post whose level the career earned. These tests pin the rows and the real figures they are anchored
 * to, the road in, a season and the Games, the post and its offer, and that a life that never goes near any of it
 * is untouched.
 */

import { describe, expect, it } from 'vitest';
import {
  FINAL_LINE,
  GAMES_EVERY,
  GAMES_TEAM_TIER,
  MARTIAL_ARTS,
  MARTIAL_ART_MIN_AGE,
  MEDAL_LINE,
  MEDAL_PRIZE,
  MEDAL_SPONSORSHIP,
  TIER_REPUTATION,
  OLYMPIC_DISCIPLINES,
  OLYMPIC_SPORTS,
  OLYMPIC_WINDOW,
  POST_END_AGE,
  POST_JOBS,
  POST_OFFER_MAX_AGE,
  POST_RAISE_CAP,
  REACH_NATIONAL,
  SPORTS,
  STUDIES,
  findMartialArt,
  findSport,
  isGamesYear,
  medalFor,
  olympicCareersFor,
  pastScore,
  postChance,
  postLevelsFor,
  postPay,
  type PastQuality,
  type Sport,
} from '@yearafter/content';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { withAnyOffer } from './offers';
import {
  ACCEPT,
  DECLINE,
  SPORTS_OFFER_EVENT_ID,
  answerSportsOffer,
  careerLabel,
  runSportsYear,
  sportsOccupation,
  sportsOfferDecision,
} from './sports';
import { sportUnit } from './sports-core';
import {
  artsOf,
  baseArts,
  isFullTime,
  nationalTeamOffer,
  runIndividualSeason,
  startArt,
  trainArt,
  trainingCeiling,
} from './sports-individual';
import {
  bestPast,
  isPostFullTime,
  leavePost,
  postOccupation,
  postOf,
  postOffer,
  postTitle,
  runPostYear,
} from './sports-post';
import type { ArtStudy, PastCareer, PostJob, SportCareer } from './sports-state';

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

const life = (seed: string, athletics = true): GameState => {
  const base = createNewGame({ seed });
  return { ...base, player: { ...base.player, talents: { ...base.player.talents, athletics } } };
};

function toAge(state: GameState, age: number): GameState {
  let current = state;
  let guard = 0;
  while (current.player.alive && current.player.age < age && (guard += 1) < 80) {
    current = answerOthers(advanceYear(answerOthers(current)).state);
  }
  return current;
}

const TRACK = findSport('track')!;
const SWIMMING = findSport('swimming')!;
const GYMNASTICS = findSport('gymnastics')!;
const OLY_BOXING = findSport('olympic-boxing')!;
const BASKETBALL = findSport('basketball')!;

const study = (artId: string, seasons: number, level = 70, hard = seasons): ArtStudy => ({
  artId,
  startedAge: 10,
  seasons,
  hardSeasons: hard,
  level,
  trainedAtAge: -1,
  trainedCount: 0,
});

const withArts = (state: GameState, arts: readonly ArtStudy[]): GameState => ({
  ...state,
  sports: { ...state.sports, arts },
});

/** A state with a professional career set by hand. */
function proState(
  sport: Sport,
  career: Partial<SportCareer> = {},
  seed = 'oly-fixture',
  adult = false,
): GameState {
  const base = adult ? toAge(life(seed), 26) : life(seed);
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
    ...career,
  };
  return { ...base, sports: { ...base.sports, career: built } };
}

/** A fixed sample of seasons from one career, keyed on the year so every one is a different draw. */
function seasons(
  sport: Sport,
  career: Partial<SportCareer>,
  years: number,
  seed = 'oly-seasons',
  start = 2000,
): { year: number; out: ReturnType<typeof runIndividualSeason> }[] {
  const state = proState(sport, career, seed);
  const rows: { year: number; out: ReturnType<typeof runIndividualSeason> }[] = [];
  for (let index = 0; index < years; index += 1) {
    const year = start + index;
    rows.push({
      year,
      out: runIndividualSeason({
        before: state,
        career: state.sports.career!,
        sport,
        age: 26,
        year,
      }),
    });
  }
  return rows;
}

const pastRow = (over: Partial<PastCareer> = {}): PastCareer => ({
  sportId: 'basketball',
  startedAge: 14,
  endedAge: 34,
  seasons: 12,
  titles: 0,
  reputation: 30,
  reached: 'pro',
  bestTier: 'starter',
  how: 'retired',
  ...over,
});

const withPast = (state: GameState, ...past: PastCareer[]): GameState => ({
  ...state,
  sports: { ...state.sports, past },
});

/** A superstar basketball career whose last season is the year after `age`, as an adult with a whole life around it. */
function retiringStar(seed: string, age = 30): GameState {
  const state = proState(
    BASKETBALL,
    {
      tier: 'superstar',
      endAge: age + 2,
      proSeasons: 10,
      titles: 4,
      best: 'superstar',
      peak: 'superstar',
      breakout: 1,
      contract: { salary: 5_000_000, yearsLeft: 5, rookie: false },
    },
    seed,
    true,
  );
  return { ...state, player: { ...state.player, age } };
}

/** The first life of a numbered set that satisfies `test`, so a rule is read off a life that got there. */
function firstSeed<T>(prefix: string, pick: (seed: string) => T | undefined, tries = 60): T {
  for (let index = 0; index < tries; index += 1) {
    const found = pick(`${prefix}-${index}`);
    if (found !== undefined) return found;
  }
  throw new Error(`no life of ${tries} satisfied the test for ${prefix}`);
}

/* -------------------------------------------------------------------------- */
/* The rows                                                                    */
/* -------------------------------------------------------------------------- */

describe('the five Olympic sports', () => {
  it('are track and field, swimming, gymnastics, wrestling and amateur boxing, in the Olympic format', () => {
    expect(OLYMPIC_SPORTS.map((sport) => sport.id)).toEqual([
      'track',
      'swimming',
      'gymnastics',
      'wrestling',
      'olympic-boxing',
    ]);
    for (const sport of OLYMPIC_SPORTS) expect(sport.format).toBe('olympic');
    expect(SPORTS).toHaveLength(14);
  });

  it('have no judo anywhere, and no winter events, weightlifting or rotating slot', () => {
    const ids = [...SPORTS.map((s) => s.id), ...STUDIES.map((s) => s.id)].join(' ');
    expect(ids).not.toMatch(/judo|ski|skat|weight|rotat|diving|fencing|rowing/);
    for (const sport of OLYMPIC_SPORTS) {
      expect(`${sport.name} ${sport.noun} ${sport.positions.join(' ')}`).not.toMatch(/judo/i);
    }
  });

  it('have no school team and no college road, and share twelve training centers', () => {
    for (const sport of OLYMPIC_SPORTS) {
      expect(sport.activityId).toBe('');
      expect(sport.collegeTeams).toEqual([]);
      expect(sport.proTeams).toHaveLength(12);
      expect(new Set(sport.proTeams).size).toBe(12);
      expect(sport.skills).toHaveLength(5);
    }
  });

  it('have federations whose letters are nobody else’s, unique across all fourteen', () => {
    const letters = SPORTS.map((sport) => sport.leagueShort);
    expect(new Set(letters).size).toBe(SPORTS.length);
    const real = [
      'NFL',
      'MLB',
      'NHL',
      'NBA',
      'MLS',
      'CFL',
      'USL',
      'PGA',
      'ATP',
      'WTA',
      'UFC',
      'IOC',
      'USA',
    ];
    for (const letter of letters) expect(real).not.toContain(letter);
    expect(new Set(SPORTS.map((sport) => sport.league)).size).toBe(SPORTS.length);
  });

  it('pay a stipend that only goes up, with a full-time living from the fourth tier on', () => {
    for (const sport of OLYMPIC_SPORTS) {
      const pay = Object.values(sport.economy.pay);
      expect([...pay].sort((a, b) => a - b)).toEqual(pay);
      expect(sport.economy.fullTimeFrom).toBe('star');
      expect(sport.economy.draftSize).toBe(0);
      // Most Olympians are not paid to be one: the bottom three tiers are a grant, under what a job pays.
      expect(sport.economy.pay.starter).toBeLessThan(60_000);
    }
    // A champion's sponsorship is the one big number.
    expect(TRACK.economy.pay.superstar).toBeGreaterThan(TRACK.economy.pay.star * 3);
  });

  it('last longest in track and shortest in gymnastics, and never end a career backwards', () => {
    const top = (sport: Sport) => sport.economy.retireAge.superstar[1];
    expect(top(TRACK)).toBeGreaterThan(top(SWIMMING));
    expect(top(SWIMMING)).toBeGreaterThan(top(GYMNASTICS));
    for (const sport of OLYMPIC_SPORTS) {
      let last = 0;
      for (const [low, high] of Object.values(sport.economy.retireAge)) {
        expect(low).toBeLessThanOrEqual(high);
        expect(low).toBeGreaterThanOrEqual(last);
        last = low;
      }
    }
    expect(GYMNASTICS.economy.declineFrom).toBeLessThan(TRACK.economy.declineFrom!);
  });

  it('have an injury factor for each sport, gymnastics the highest and swimming the lowest', () => {
    const factors = OLYMPIC_SPORTS.map((sport) => sport.economy.injuryFactor);
    expect(Math.max(...factors)).toBe(GYMNASTICS.economy.injuryFactor);
    expect(Math.min(...factors)).toBe(SWIMMING.economy.injuryFactor);
  });
});

describe('what a medal pays', () => {
  it('is what Team USA pays for the prize, and a larger sum from the sponsors', () => {
    expect(MEDAL_PRIZE).toEqual({ gold: 37_500, silver: 22_500, bronze: 15_000 });
    expect(MEDAL_SPONSORSHIP.gold).toBeGreaterThan(MEDAL_SPONSORSHIP.silver);
    expect(MEDAL_SPONSORSHIP.silver).toBeGreaterThan(MEDAL_SPONSORSHIP.bronze);
    for (const medal of ['gold', 'silver', 'bronze'] as const) {
      expect(MEDAL_SPONSORSHIP[medal]).toBeGreaterThan(MEDAL_PRIZE[medal]);
    }
  });

  it('is read off a performance at the lines and not before them', () => {
    expect(medalFor(MEDAL_LINE.gold)).toBe('gold');
    expect(medalFor(MEDAL_LINE.gold - 0.01)).toBe('silver');
    expect(medalFor(MEDAL_LINE.silver)).toBe('silver');
    expect(medalFor(MEDAL_LINE.silver - 0.01)).toBe('bronze');
    expect(medalFor(MEDAL_LINE.bronze)).toBe('bronze');
    expect(medalFor(MEDAL_LINE.bronze - 0.01)).toBeUndefined();
    expect(FINAL_LINE).toBeLessThan(MEDAL_LINE.bronze);
  });

  it('comes every fourth year and no other', () => {
    expect(GAMES_EVERY).toBe(4);
    expect([2024, 2028, 2032].every(isGamesYear)).toBe(true);
    expect([2025, 2026, 2027, 2029].some(isGamesYear)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Studying a discipline                                                       */
/* -------------------------------------------------------------------------- */

describe('the three Olympic disciplines', () => {
  it('are track, swimming and gymnastics, studied like the arts and not counted as martial arts', () => {
    expect(OLYMPIC_DISCIPLINES.map((row) => row.id)).toEqual(['track', 'swimming', 'gymnastics']);
    expect(MARTIAL_ARTS).toHaveLength(6);
    expect(STUDIES).toHaveLength(9);
    for (const row of OLYMPIC_DISCIPLINES) {
      expect(row.style).toBe('athletic');
      expect(findMartialArt(row.id)).toBe(row);
      expect(row.blurb.length).toBeLessThanOrEqual(52);
      expect(row.skills).toHaveLength(4);
      expect(row.annualCost).toBeGreaterThan(0);
    }
  });

  it('feed their own sport, and wrestling and boxing feed the Olympic programs as well', () => {
    expect(findMartialArt('track')!.feeds).toEqual(['track']);
    expect(findMartialArt('swimming')!.feeds).toEqual(['swimming']);
    expect(findMartialArt('gymnastics')!.feeds).toEqual(['gymnastics']);
    expect(findMartialArt('wrestling')!.feeds).toContain('wrestling');
    expect(findMartialArt('wrestling')!.feeds).toContain('mma');
    expect(findMartialArt('boxing')!.feeds).toContain('olympic-boxing');
    expect(findMartialArt('boxing')!.feeds).toContain('boxing');
  });

  it('start at ten like the arts, and cost most in gymnastics and least in track', () => {
    const state = life('disc-start');
    expect(
      startArt({ ...state, player: { ...state.player, age: MARTIAL_ART_MIN_AGE - 1 } }, 'swimming')
        .ok,
    ).toBe(false);
    const ten = { ...state, player: { ...state.player, age: MARTIAL_ART_MIN_AGE } };
    for (const row of OLYMPIC_DISCIPLINES) expect(startArt(ten, row.id).ok).toBe(true);
    const cost = (id: string) => findMartialArt(id)!.annualCost;
    expect(cost('gymnastics')).toBeGreaterThan(cost('swimming'));
    expect(cost('swimming')).toBeGreaterThan(cost('track'));
  });

  it('share the two-at-a-time limit with the arts', () => {
    const state = life('disc-limit');
    const ten = { ...state, player: { ...state.player, age: 12 } };
    let current = ten;
    for (const id of ['swimming', 'track']) {
      const started = startArt(current, id);
      expect(started.ok).toBe(true);
      if (started.ok) current = started.value.state;
    }
    const third = startArt(current, 'boxing');
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.error).toBe('too-many');
  });

  it('train within the ceiling of what the character is, and no higher', () => {
    let state: GameState = {
      ...life('disc-train'),
      player: { ...life('disc-train').player, age: 12 },
    };
    const started = startArt(state, 'swimming');
    if (started.ok) state = started.value.state;
    for (let session = 0; session < 3; session += 1) {
      const trained = trainArt(state, 'swimming');
      if (trained.ok) state = trained.value.state;
    }
    expect(artsOf(state)[0]!.level).toBeLessThanOrEqual(trainingCeiling(state));
  });

  it('count towards an Olympic sport only after three seasons', () => {
    expect(olympicCareersFor([{ artId: 'swimming', level: 60, seasons: 2 }])).toEqual([]);
    expect(olympicCareersFor([{ artId: 'swimming', level: 60, seasons: 3 }])).toEqual([
      { sportId: 'swimming', form: 60 },
    ]);
  });

  it('are read best first, and an art that feeds no Olympic sport leads nowhere', () => {
    const both = olympicCareersFor([
      { artId: 'boxing', level: 50, seasons: 5 },
      { artId: 'wrestling', level: 72, seasons: 4 },
    ]);
    expect(both.map((row) => row.sportId)).toEqual(['wrestling', 'olympic-boxing']);
    expect(olympicCareersFor([{ artId: 'karate', level: 90, seasons: 9 }])).toEqual([]);
    expect(olympicCareersFor([{ artId: 'bjj', level: 90, seasons: 9 }])).toEqual([]);
  });

  it('are the base of an Olympic career: all that feed the sport, and nothing else', () => {
    const arts = [study('swimming', 5), study('track', 5), study('boxing', 5)];
    expect(baseArts(arts, SWIMMING).map((row) => row.artId)).toEqual(['swimming']);
    expect(baseArts(arts, OLY_BOXING).map((row) => row.artId)).toEqual(['boxing']);
    expect(baseArts([study('swimming', 2)], SWIMMING)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The road in                                                                 */
/* -------------------------------------------------------------------------- */

describe('a place in a national program', () => {
  const reach = (state: GameState, age: number, arts: readonly ArtStudy[]) =>
    nationalTeamOffer(state, age, arts);
  const getsSwimming = (): GameState =>
    firstSeed('nat-swim', (seed) => {
      const state = life(seed);
      return reach(state, 17, [study('swimming', 7)]) ? state : undefined;
    });

  it('is a lower table than the pros’, and the one the odds are held to', () => {
    expect(REACH_NATIONAL).toEqual({
      talentAndWork: 0.5,
      talentOnly: 0.3,
      workOnly: 0.2,
      neither: 0.01,
    });
  });

  it('is inside each sport’s window: sixteen to thirty, gymnastics by twenty-two, wrestling and boxing from eighteen', () => {
    expect(OLYMPIC_WINDOW.gymnastics[1]).toBeLessThan(OLYMPIC_WINDOW.track[1]);
    expect(OLYMPIC_WINDOW.wrestling[0]).toBe(18);
    expect(OLYMPIC_WINDOW['olympic-boxing'][0]).toBe(18);
    const swim = getsSwimming();
    const arts = [study('swimming', 7)];
    for (const age of [14, 15]) expect(reach(swim, age, arts)).toBeUndefined();
    for (const age of [16, 20, OLYMPIC_WINDOW.swimming[1]])
      expect(reach(swim, age, arts)).toBeDefined();
    for (const age of [27, 30, 35]) expect(reach(swim, age, arts)).toBeUndefined();
  });

  it('is never made to a wrestler before eighteen, nor to a gymnast after twenty-two', () => {
    const wrestler = firstSeed('nat-wres', (seed) => {
      const state = life(seed);
      return reach(state, 19, [study('wrestling', 8)]) ? state : undefined;
    });
    expect(reach(wrestler, 16, [study('wrestling', 8)])).toBeUndefined();
    expect(reach(wrestler, 17, [study('wrestling', 8)])).toBeUndefined();
    const gymnast = firstSeed('nat-gym', (seed) => {
      const state = life(seed);
      return reach(state, 17, [study('gymnastics', 7)]) ? state : undefined;
    });
    expect(reach(gymnast, 22, [study('gymnastics', 7)])).toBeDefined();
    expect(reach(gymnast, 23, [study('gymnastics', 7)])).toBeUndefined();
  });

  it('is made once a sport: a program that has had the career, or been turned down, does not ask again', () => {
    const state = getsSwimming();
    const done = withPast(
      state,
      pastRow({ sportId: 'swimming', how: 'declined', reached: 'school' }),
    );
    expect(reach(done, 18, [study('swimming', 7)])).toBeUndefined();
    // A career in another sport does not close this one.
    const other = withPast(state, pastRow({ sportId: 'track' }));
    expect(reach(other, 18, [study('swimming', 7)])).toBeDefined();
  });

  it('is decided by one draw for the life, so a seed that got a place always does, at any age', () => {
    const state = getsSwimming();
    for (const age of [16, 18, 22, 25]) {
      expect(reach(state, age, [study('swimming', 7)])).toBeDefined();
    }
    const seed = state.rng.getSeed();
    const draw = sportUnit(seed, state.world.generation, 'national', 'swimming');
    expect(draw).toBeLessThan(REACH_NATIONAL.talentAndWork);
  });

  it('is rarer for somebody with neither talent nor work, and common for one who has both', () => {
    const rate = (talented: boolean, hard: boolean): number => {
      let got = 0;
      for (let index = 0; index < 120; index += 1) {
        const state = life(`rate-${talented}-${hard}-${index}`, talented);
        const arts = [study('track', 7, 60, hard ? 7 : 0)];
        if (reach(state, 20, arts)) got += 1;
      }
      return got / 120;
    };
    expect(rate(true, true)).toBeGreaterThan(0.38);
    expect(rate(true, true)).toBeLessThan(0.62);
    expect(rate(false, false)).toBeLessThan(0.06);
    expect(rate(true, false)).toBeGreaterThan(0.18);
    expect(rate(true, false)).toBeLessThan(0.42);
  });

  it('holds the amateur years as a career waiting on an answer, with a center to go to and the art’s level', () => {
    const state = getsSwimming();
    const found = reach(state, 17, [study('swimming', 7, 66)])!;
    expect(found.career.stage).toBe('school');
    expect(found.career.form).toBe(66);
    expect(found.career.titles).toBe(0);
    expect(SWIMMING.proTeams).toContain(found.career.team);
    expect(found.offer).toMatchObject({ kind: 'national-team', sportId: 'swimming', age: 17 });
    expect(found.line).toMatch(/National Aquatics Federation/);
  });

  it('draws nothing from the random streams', () => {
    const state = getsSwimming();
    const seed = state.rng.getSeed();
    reach(state, 17, [study('swimming', 7)]);
    expect(state.rng.getSeed()).toBe(seed);
  });
});

describe('boxing and wrestling reach the Games after the gym’s question', () => {
  it('is asked of a boxer whom the pros passed over or who stayed an amateur, never first', () => {
    // Through the game: the pro question comes first and the national program after it.
    const boxer = firstSeed(
      'gym-first',
      (seed) => {
        let state = life(seed);
        let guard = 0;
        let seenPro = false;
        while (state.player.age < 26 && (guard += 1) < 40) {
          state = answerOthers(state);
          if (state.player.age >= 10 && artsOf(state).length === 0) {
            const started = startArt(state, 'boxing');
            if (started.ok) state = started.value.state;
          }
          for (let session = 0; session < 3; session += 1) {
            const trained = trainArt(state, 'boxing');
            if (trained.ok) state = trained.value.state;
          }
          state = advanceYear(state).state;
          const offer = state.sports.offer;
          if (offer?.kind === 'turn-pro') {
            seenPro = true;
            const declined = decide(state, SPORTS_OFFER_EVENT_ID, DECLINE);
            if (declined.ok) state = declined.value.state;
          } else if (offer?.kind === 'national-team') {
            return seenPro ? { state, offer } : undefined;
          }
        }
        return undefined;
      },
      80,
    );
    expect(boxer.offer.kind).toBe('national-team');
    expect(boxer.offer.sportId).toBe('olympic-boxing');
    expect(
      boxer.state.sports.past.some((row) => row.sportId === 'boxing' && row.how === 'declined'),
    ).toBe(true);
  });

  it('removes the art that was the base once the program is joined, and leaves the others alone', () => {
    const state = firstSeed('base-gone', (seed) => {
      const base = withArts(life(seed), [study('wrestling', 8), study('swimming', 5)]);
      const found = nationalTeamOffer(base, 19, artsOf(base));
      if (!found) return undefined;
      // Wrestling is the best by level when swimming is lower; make sure the offer is for wrestling.
      return found.offer.sportId === 'wrestling'
        ? { ...base, sports: { ...base.sports, career: found.career, offer: found.offer } }
        : undefined;
    });
    const result = answerSportsOffer(state, ACCEPT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.sports.career?.stage).toBe('pro');
    expect(result.value.state.sports.career?.tier).toBe('fringe');
    expect(artsOf(result.value.state).map((row) => row.artId)).toEqual(['swimming']);
  });
});

/* -------------------------------------------------------------------------- */
/* The question                                                                */
/* -------------------------------------------------------------------------- */

describe('the national-team question', () => {
  const asked = (): GameState =>
    firstSeed('q-nat', (seed) => {
      const base = withArts(life(seed), [study('swimming', 7)]);
      const found = nationalTeamOffer(base, 17, artsOf(base));
      return found
        ? { ...base, sports: { ...base.sports, career: found.career, offer: found.offer } }
        : undefined;
    });

  it('is Join the program or Not now, with no ask-for-more', () => {
    const state = asked();
    const pending = sportsOfferDecision(state.sports.offer!, state.world.year);
    expect(pending.choices.map((row) => row.label)).toEqual(['Join the program', 'Not now']);
    expect(pending.prompt).toMatch(/National Aquatics Federation/);
  });

  it('puts an accepted athlete in the pro stage at the bottom, with the program’s center, a record of it, and no day job lost', () => {
    const state = asked();
    const result = answerSportsOffer(state, ACCEPT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const career = result.value.state.sports.career!;
    expect(career).toMatchObject({ stage: 'pro', tier: 'fringe', proSeasons: 0 });
    expect(career.team).toBe(state.sports.career!.team);
    expect(career.wins).toBeUndefined();
    expect(isFullTime(career)).toBe(false);
    expect(result.value.state.player.records.some((row) => /program/.test(row.label))).toBe(true);
    expect(result.value.state.sports.offer).toBeUndefined();
    expect(artsOf(result.value.state)).toEqual([]);
    expect(careerLabel(career)).toBe('National Aquatics Federation');
  });

  it('holds the amateur career through a sports year while the question is open', () => {
    const state = asked();
    const out = runSportsYear({ before: state, education: state.education, age: 17, year: 2020 });
    expect(out.sports.career).toEqual(state.sports.career);
    expect(out.sports.offer).toEqual(state.sports.offer);
    expect(out.sports.past).toEqual([]);
  });

  it('keeps a turned-down place as a past, and asks again never', () => {
    const state = asked();
    const result = answerSportsOffer(state, DECLINE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.sports.career).toBeUndefined();
    expect(result.value.state.sports.past.at(-1)).toMatchObject({
      sportId: 'swimming',
      how: 'declined',
      reached: 'school',
    });
    expect(answerSportsOffer(state, 'more').ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* A season, and the Games                                                     */
/* -------------------------------------------------------------------------- */

describe('an Olympic season', () => {
  it('has no fights, no record, no world rank, and a stipend in the tier’s range', () => {
    const rows = seasons(TRACK, { tier: 'starter', form: 66, proSeasons: 4 }, 40, 'oly-year');
    for (const { out } of rows) {
      expect(out.career.wins).toBeUndefined();
      expect(out.lines.some((line) => /ranked .* in the world/.test(line.text))).toBe(false);
      expect(out.lines.some((line) => /\d–\d/.test(line.text))).toBe(false);
    }
    const healthy = rows.filter(
      ({ year, out }) => !isGamesYear(year) && out.pay > TRACK.economy.pay.starter * 0.5,
    );
    expect(healthy.length).toBeGreaterThan(20);
    for (const { out } of healthy) {
      expect(out.pay).toBeGreaterThanOrEqual(Math.round(TRACK.economy.pay.starter * 0.75));
      expect(out.pay).toBeLessThanOrEqual(Math.round(TRACK.economy.pay.starter * 1.25));
    }
  });

  it('never has a medal outside a Games year', () => {
    const rows = seasons(
      SWIMMING,
      { tier: 'superstar', form: 99, proSeasons: 6 },
      200,
      'no-off-games',
    );
    for (const { year, out } of rows) if (!isGamesYear(year)) expect(out.medal).toBeUndefined();
    expect(rows.some(({ year, out }) => isGamesYear(year) && out.medal !== undefined)).toBe(true);
  });

  it('sends a team to the Games from the role tier up, and tells a lower athlete they did not make it', () => {
    expect(GAMES_TEAM_TIER).toBe('role');
    const low = seasons(TRACK, { tier: 'fringe', form: 40, proSeasons: 1 }, 80, 'low-games');
    let missedTeam = 0;
    for (const { year, out } of low) {
      if (!isGamesYear(year) || out.ended || out.pay < TRACK.economy.pay.fringe * 0.5) continue;
      expect(out.medal).toBeUndefined();
      expect(out.lines.some((line) => /Didn't make the team/.test(line.text))).toBe(true);
      missedTeam += 1;
    }
    expect(missedTeam).toBeGreaterThan(3);
    const high = seasons(TRACK, { tier: 'star', form: 90, proSeasons: 6 }, 40, 'high-games');
    const went = high.filter(({ year, out }) => isGamesYear(year) && !out.ended);
    expect(went.length).toBeGreaterThan(3);
    for (const { out } of went)
      expect(out.lines.some((line) => /Didn't make the team/.test(line.text))).toBe(false);
  });

  it('pays the prize and the sponsors on top of the stipend, counts a medal as a title, writes a record of it', () => {
    const rows = seasons(
      SWIMMING,
      { tier: 'superstar', form: 99, proSeasons: 6, titles: 0 },
      400,
      'medal-pay',
    );
    const medals = rows.filter(({ out }) => out.medal !== undefined);
    expect(medals.length).toBeGreaterThan(5);
    for (const { year, out } of medals) {
      const medal = out.medal!;
      const extra = MEDAL_PRIZE[medal] + MEDAL_SPONSORSHIP[medal];
      expect(out.pay).toBeGreaterThanOrEqual(
        Math.round(SWIMMING.economy.pay.superstar * 0.75) + extra,
      );
      expect(out.pay).toBeLessThanOrEqual(
        Math.round(SWIMMING.economy.pay.superstar * 1.25) + extra,
      );
      expect(out.career.titles).toBe(1);
      expect(
        out.records.some((row) => row.label === `Olympic ${medal} medal in swimming, ${year}`),
      ).toBe(true);
      expect(out.lines.some((line) => /Won an Olympic/.test(line.text))).toBe(true);
    }
  });

  it('gives the better medals to the better athletes, and none to the worst', () => {
    const count = (form: number, tier: 'role' | 'superstar') =>
      seasons(TRACK, { tier, form, proSeasons: 6 }, 400, `by-form-${form}`).filter(
        ({ out }) => out.medal,
      ).length;
    expect(count(99, 'superstar')).toBeGreaterThan(count(70, 'role'));
    expect(count(20, 'role')).toBe(0);
  });

  it('has a ceiling: a form of 74 reaches the podium but never the gold, and a form of 70 never wins one', () => {
    const colours = (form: number) => {
      const found = new Set<string>();
      for (const { out } of seasons(
        TRACK,
        { tier: 'star', form, proSeasons: 6 },
        2000,
        `ceil-${form}`,
      ))
        if (out.medal) found.add(out.medal);
      return found;
    };
    const mid = colours(74);
    expect(mid.size).toBeGreaterThan(0);
    expect(mid.has('gold')).toBe(false);
    expect(colours(70).has('gold')).toBe(false);
    expect(colours(90).has('gold')).toBe(true);
  });

  it('adds six to the reputation and the mood in a medal year, and only then', () => {
    const rows = seasons(
      TRACK,
      { tier: 'superstar', form: 99, proSeasons: 6, reputation: 10 },
      400,
      'medal-rep',
    );
    const medals = rows.filter(({ out }) => out.medal && !out.ended);
    expect(medals.length).toBeGreaterThan(5);
    for (const { out } of medals) {
      expect(out.career.reputation).toBe(Math.min(100, 10 + TIER_REPUTATION.superstar + 6));
      expect(out.mood).toBe(6);
    }
    const plain = rows.filter(({ out }) => !out.medal && !out.ended && out.career.titles === 0);
    expect(plain.length).toBeGreaterThan(5);
    for (const { out } of plain)
      expect(out.career.reputation).toBeLessThanOrEqual(
        Math.min(100, 10 + TIER_REPUTATION.superstar),
      );
  });

  it('is kept out of the Games by a serious injury, and says so', () => {
    const rows = seasons(
      GYMNASTICS,
      { tier: 'star', form: 85, proSeasons: 4 },
      800,
      'games-injury',
    );
    const hurt = rows.filter(
      ({ year, out }) =>
        isGamesYear(year) && out.lines.some((line) => /kept you out of the Games/.test(line.text)),
    );
    expect(hurt.length).toBeGreaterThan(0);
    for (const { out } of hurt) expect(out.medal).toBeUndefined();
  });

  it('cuts a fringe athlete from the program after a bad year, but never in the first season', () => {
    const first = seasons(TRACK, { tier: 'fringe', form: 5, proSeasons: 0 }, 60, 'cut-first');
    expect(first.every(({ out }) => out.ended === undefined || out.ended === 'injury')).toBe(true);
    const later = seasons(TRACK, { tier: 'fringe', form: 5, proSeasons: 4 }, 60, 'cut-later');
    const cut = later.filter(({ out }) => out.ended === 'cut');
    expect(cut.length).toBeGreaterThan(20);
    expect(
      cut[0]!.out.lines.some((line) => /cut you from the national program/.test(line.text)),
    ).toBe(true);
    expect(later.some(({ out }) => out.ended === 'lost-card' || out.ended === 'released')).toBe(
      false,
    );
  });

  it('retires by the sport’s own ages, and says medals where a tour would say titles', () => {
    const old = seasons(
      GYMNASTICS,
      { tier: 'role', form: 60, proSeasons: 9, titles: 2 },
      30,
      'retire-old',
    );
    const out = old.map((row) => row.out);
    // At twenty-six a role gymnast has long passed the retirement range.
    expect(out.some((row) => row.ended === 'retired')).toBe(true);
    const retired = out.find((row) => row.ended === 'retired')!;
    expect(retired.lines.some((line) => /with 2 medals/.test(line.text))).toBe(true);
    expect(retired.lines.some((line) => /titles/.test(line.text))).toBe(false);
  });

  it('is hurt in an Olympian’s words, not a golfer’s or a fighter’s', () => {
    const rows = seasons(TRACK, { tier: 'star', form: 80, proSeasons: 4 }, 400, 'oly-hurt');
    const texts = rows.flatMap(({ out }) => out.lines.map((line) => line.text));
    expect(
      texts.some((text) => /hamstring|qualifier|ankle|ligament|stress fracture|knee/.test(text)),
    ).toBe(true);
    expect(
      texts.some((text) => /cut over the eye|Withdrew from a tournament|strained back/.test(text)),
    ).toBe(false);
  });

  it('is full time only from the fourth tier, so a day job and the header go on until then', () => {
    expect(isFullTime(proState(TRACK, { tier: 'starter' }).sports.career)).toBe(false);
    expect(isFullTime(proState(TRACK, { tier: 'star' }).sports.career)).toBe(true);
    expect(sportsOccupation(proState(TRACK, { tier: 'star' }).sports.career)).toBe(
      'Olympic track athlete',
    );
    expect(sportsOccupation(proState(TRACK, { tier: 'starter' }).sports.career)).toBeUndefined();
  });

  it('keeps the best tier reached, as every individual career does', () => {
    const rows = seasons(
      SWIMMING,
      { tier: 'star', best: 'superstar', form: 30, proSeasons: 6 },
      40,
      'oly-best',
    );
    for (const { out } of rows) expect(out.career.best).toBe('superstar');
  });
});

/* -------------------------------------------------------------------------- */
/* Through the game                                                            */
/* -------------------------------------------------------------------------- */

describe('an Olympic life, through the game', () => {
  function swimmer(seed: string, until: number): GameState {
    let state = life(seed);
    let guard = 0;
    while (state.player.alive && state.player.age < until && (guard += 1) < 60) {
      state = answerOthers(state);
      if (state.player.age >= 10 && state.player.age < 16 && artsOf(state).length === 0) {
        const started = startArt(state, 'swimming');
        if (started.ok) state = started.value.state;
      }
      if (state.player.age < 31) {
        for (let session = 0; session < 3; session += 1) {
          const trained = trainArt(state, 'swimming');
          if (trained.ok) state = trained.value.state;
        }
      }
      state = advanceYear(state).state;
      if (state.sports.offer) {
        const result = decide(state, SPORTS_OFFER_EVENT_ID, ACCEPT);
        if (result.ok) state = result.value.state;
      }
    }
    return state;
  }

  it('goes from a pool at ten to a program at sixteen to the Games, with stipends in the ledger as stipend and sponsors', () => {
    const state = firstSeed(
      'oly-life',
      (seed) => {
        const found = swimmer(seed, 34);
        return found.sports.past.some((row) => row.sportId === 'swimming' && row.reached === 'pro')
          ? found
          : undefined;
      },
      12,
    );
    const past = state.sports.past.find((row) => row.sportId === 'swimming')!;
    expect(past.reached).toBe('pro');
    expect(past.endedAge).toBeLessThanOrEqual(36);
    expect(past.startedAge).toBe(10);
    const rows = state.finance.transactions.filter((row) =>
      /Stipend and sponsors/.test(row.source),
    );
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.every((row) => /National Aquatics Federation/.test(row.source))).toBe(true);
    expect(rows.every((row) => row.category === 'salary')).toBe(true);
    expect(
      state.finance.transactions.some(
        (row) => row.category === 'tax' && /playing pay/.test(row.source),
      ),
    ).toBe(true);
  });

  it('keeps a day job until the living starts, and never offers one to a champion', () => {
    const star = proState(SWIMMING, { tier: 'star' }, 'oly-door', true);
    const {
      offer: _a,
      collegeOffer: _b,
      lifeOffer: _c,
      pursuitOffer: _d,
      homeOffer: _e,
      vehicleOffer: _f,
      renovationOffer: _g,
      ...clear
    } = star;
    const idle = (state: GameState, attempt: number): GameState => ({
      ...state,
      pending: [],
      employment: { ...state.employment, job: undefined },
      education: { ...state.education, finishedAtAge: state.player.age },
      world: { ...state.world, year: state.world.year + attempt },
    });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(withAnyOffer(idle(clear as GameState, attempt), true).offer).toBeUndefined();
    }
    const starter = proState(SWIMMING, { tier: 'starter' }, 'oly-door', true);
    const {
      offer: _a2,
      collegeOffer: _b2,
      lifeOffer: _c2,
      pursuitOffer: _d2,
      homeOffer: _e2,
      vehicleOffer: _f2,
      renovationOffer: _g2,
      ...clear2
    } = starter;
    let raised = 0;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (withAnyOffer(idle(clear2 as GameState, attempt), true).offer) raised += 1;
    }
    expect(raised).toBeGreaterThan(0);
  });

  it('studies are readable only while studied: stopping one drops it, and a joined program has none of its base', () => {
    const state = swimmer('oly-reading', 18);
    if (state.sports.career?.stage === 'pro')
      expect(artsOf(state).some((row) => row.artId === 'swimming')).toBe(false);
  });

  it('cannot study the boxing that is already the Olympic career', () => {
    const state = proState(OLY_BOXING, { tier: 'role' }, 'is-oly-boxing');
    const refused = startArt({ ...state, player: { ...state.player, age: 22 } }, 'boxing');
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('is-your-career');
  });
});

/* -------------------------------------------------------------------------- */
/* After the playing: the post                                                 */
/* -------------------------------------------------------------------------- */

describe('what a past career opens', () => {
  const q = (over: Partial<PastQuality> = {}): PastQuality => ({
    reached: 'pro',
    bestTier: 'fringe',
    titles: 0,
    seasons: 5,
    ...over,
  });

  it('is a college job and a local chair for a fringe pro, and nothing for a team that went nowhere', () => {
    expect(postLevelsFor(q())).toEqual({ coach: 'college', commentary: 'local' });
    expect(postLevelsFor({ reached: 'school', titles: 0, seasons: 6 })).toEqual({});
    expect(postLevelsFor({ reached: 'college', titles: 0, seasons: 2 })).toEqual({});
    expect(postLevelsFor({ reached: 'college', titles: 0, seasons: 4 })).toEqual({
      coach: 'college',
      commentary: 'local',
    });
  });

  it('is overseas for a role player, pro for a starter, national commentary for a star', () => {
    expect(postLevelsFor(q({ bestTier: 'role' })).coach).toBe('overseas');
    expect(postLevelsFor(q({ bestTier: 'starter' })).coach).toBe('pro');
    expect(postLevelsFor(q({ bestTier: 'starter' })).commentary).toBe('local');
    expect(postLevelsFor(q({ bestTier: 'star' })).commentary).toBe('national');
    expect(postLevelsFor(q({ bestTier: 'superstar' }))).toEqual({
      coach: 'pro',
      commentary: 'national',
    });
  });

  it('is raised by titles and medals: three of them make a fringe pro a pro coach and a national voice', () => {
    expect(postLevelsFor(q({ titles: 2 })).coach).toBe('college');
    expect(postLevelsFor(q({ titles: 3 }))).toEqual({ coach: 'pro', commentary: 'national' });
  });

  it('has a chance that only goes up with the career, and stops at ninety-two in a hundred', () => {
    const tiers = ['fringe', 'role', 'starter', 'star', 'superstar'] as const;
    const chances = tiers.map((tier) => postChance(q({ bestTier: tier })));
    expect([...chances].sort((a, b) => a - b)).toEqual(chances);
    expect(chances[0]).toBeCloseTo(0.12, 5);
    expect(chances[4]).toBeCloseTo(0.68, 5);
    expect(postChance(q({ bestTier: 'superstar', titles: 8 }))).toBe(0.92);
    expect(postChance(q({ bestTier: 'superstar', titles: 30 }))).toBe(0.92);
    expect(postChance(q({ bestTier: 'fringe', titles: 1 }))).toBeCloseTo(0.15, 5);
    // A college career is a small chance of its own.
    expect(postChance({ reached: 'college', titles: 0, seasons: 4 })).toBeCloseTo(0.08, 5);
  });

  it('ranks past careers by tier, then titles, then the pros', () => {
    expect(pastScore(q({ bestTier: 'star' }))).toBeGreaterThan(
      pastScore(q({ bestTier: 'starter', titles: 4 })),
    );
    expect(pastScore(q({ titles: 3 }))).toBeGreaterThan(pastScore(q()));
    expect(pastScore(q())).toBeGreaterThan(
      pastScore({ reached: 'college', titles: 0, seasons: 5 }),
    );
  });

  it('pays the ladder: $55k, $95k, $160k, $48k and $240k at the start, rising 3% a year to 1.6 times', () => {
    expect(Object.entries(POST_JOBS).map(([level, row]) => [level, row.pay])).toEqual([
      ['college', 55_000],
      ['overseas', 95_000],
      ['pro', 160_000],
      ['local', 48_000],
      ['national', 240_000],
    ]);
    expect(postPay('college', 0)).toBe(55_000);
    expect(postPay('college', 10)).toBe(Math.round(55_000 * 1.3));
    expect(postPay('national', 100)).toBe(Math.round(240_000 * POST_RAISE_CAP));
    expect(POST_RAISE_CAP).toBe(1.6);
  });

  it('is a living for a coach and a national voice, and a thing done beside a job for a local one', () => {
    expect(
      POST_JOBS.college.fullTime && POST_JOBS.overseas.fullTime && POST_JOBS.pro.fullTime,
    ).toBe(true);
    expect(POST_JOBS.national.fullTime).toBe(true);
    expect(POST_JOBS.local.fullTime).toBe(false);
  });
});

describe('the offer of a post', () => {
  const retired = (seed: string, over: Partial<PastCareer> = {}): GameState =>
    withPast(
      life(seed),
      pastRow({ sportId: 'basketball', endedAge: 33, bestTier: 'superstar', titles: 4, ...over }),
    );

  const offeredAt = (state: GameState): number | undefined => {
    for (let age = 33; age <= 70; age += 1) if (postOffer(state, age)) return age;
    return undefined;
  };

  it('comes one to three years after the career ended, and never the year it did', () => {
    const state = firstSeed('post-delay', (seed) => {
      const s = retired(seed);
      return offeredAt(s) !== undefined ? s : undefined;
    });
    expect(postOffer(state, 33)).toBeUndefined();
    const first = offeredAt(state)!;
    expect(first).toBeGreaterThanOrEqual(34);
    expect(first).toBeLessThanOrEqual(36);
    // And once the delay has run it stays on offer at every later age until the cutoff.
    for (let age = first; age <= POST_OFFER_MAX_AGE; age += 1)
      expect(postOffer(state, age)).toBeDefined();
    expect(postOffer(state, POST_OFFER_MAX_AGE + 1)).toBeUndefined();
  });

  it('has a delay that differs from life to life, so the first offers fall on 34, 35 and 36', () => {
    const ages = new Set<number>();
    for (let index = 0; index < 120; index += 1) {
      const found = offeredAt(retired(`delay-${index}`));
      if (found !== undefined) ages.add(found);
    }
    expect([...ages].sort()).toEqual([34, 35, 36]);
  });

  it('is coaching for about two lives in three and commentary for the rest, when the career opens both', () => {
    const levels = postLevelsFor({ reached: 'pro', bestTier: 'superstar', titles: 4, seasons: 12 });
    expect(levels.coach && levels.commentary).toBeTruthy();
    let coach = 0;
    let commentary = 0;
    for (let index = 0; index < 400; index += 1) {
      const found = postOffer(retired(`kind-${index}`), 40);
      if (!found || found.offer.kind !== 'post-job') continue;
      if (found.offer.postKind === 'coach') coach += 1;
      else commentary += 1;
    }
    expect(coach + commentary).toBeGreaterThan(200);
    const share = coach / (coach + commentary);
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(0.75);
  });

  it('is made to the sport the best career was in, at the level it earned', () => {
    const state = firstSeed('post-level', (seed) =>
      offeredAt(retired(seed)) ? retired(seed) : undefined,
    );
    const found = postOffer(state, 40)!;
    expect(found.offer).toMatchObject({ kind: 'post-job', sportId: 'basketball', age: 40 });
    const levels = postLevelsFor({ reached: 'pro', bestTier: 'superstar', titles: 4, seasons: 12 });
    expect([levels.coach, levels.commentary]).toContain((found.offer as { level: string }).level);
    expect(found.line).toMatch(/basketball career/);
  });

  it('is never made twice in a life, whatever came of the first', () => {
    const state = firstSeed('post-once', (seed) =>
      offeredAt(retired(seed)) ? retired(seed) : undefined,
    );
    const held: GameState = {
      ...state,
      sports: {
        ...state.sports,
        post: { sportId: 'basketball', kind: 'coach', level: 'pro', since: 35, seasons: 2 },
      },
    };
    for (let age = 33; age <= 62; age += 1) expect(postOffer(held, age)).toBeUndefined();
    const refused: GameState = {
      ...held,
      sports: { ...held.sports, post: { ...held.sports.post!, over: true } },
    };
    for (let age = 33; age <= 62; age += 1) expect(postOffer(refused, age)).toBeUndefined();
  });

  it('follows the best career, not the last: a school team that went nowhere is not one', () => {
    const state = withPast(
      life('post-best'),
      pastRow({ sportId: 'golf', bestTier: 'fringe', titles: 0, seasons: 4, endedAge: 28 }),
      pastRow({ sportId: 'tennis', bestTier: 'star', titles: 2, endedAge: 30 }),
      pastRow({ sportId: 'soccer', reached: 'school', bestTier: undefined, endedAge: 17 }),
    );
    expect(bestPast(state.sports.past)?.sportId).toBe('tennis');
    expect(bestPast([pastRow({ reached: 'school', bestTier: undefined })])).toBeUndefined();
    expect(bestPast([])).toBeUndefined();
  });

  it('is nobody’s who has not played: no past, no offer, at any age', () => {
    const state = life('post-none');
    for (let age = 20; age <= 70; age += 5) expect(postOffer(state, age)).toBeUndefined();
  });

  it('is decided by one draw, and a better career gets it far more often', () => {
    const rate = (tier: 'fringe' | 'superstar', titles: number): number => {
      let got = 0;
      for (let index = 0; index < 150; index += 1) {
        const state = withPast(
          life(`post-rate-${tier}-${index}`),
          pastRow({ bestTier: tier, titles, endedAge: 30 }),
        );
        if (postOffer(state, 45)) got += 1;
      }
      return got / 150;
    };
    const low = rate('fringe', 0);
    const high = rate('superstar', 4);
    expect(low).toBeGreaterThan(0.04);
    expect(low).toBeLessThan(0.24);
    expect(high).toBeGreaterThan(0.75);
    // The same life, the same answer.
    const state = withPast(life('post-same'), pastRow({ bestTier: 'star', endedAge: 30 }));
    expect(Boolean(postOffer(state, 45))).toBe(Boolean(postOffer(state, 50)));
  });

  it('draws nothing from the random streams', () => {
    const state = retired('post-streams');
    const seed = state.rng.getSeed();
    postOffer(state, 40);
    bestPast(state.sports.past);
    expect(state.rng.getSeed()).toBe(seed);
  });
});

describe('a post, through the game', () => {
  /** A life with a past career of any sport and a post offer on the table. */
  const asked = (seed: string, sportId = 'basketball'): GameState =>
    firstSeed(seed, (candidate) => {
      const base = toAge(
        withPast(
          life(candidate),
          pastRow({ sportId, endedAge: 33, bestTier: 'superstar', titles: 4 }),
        ),
        40,
      );
      const found = postOffer(base, base.player.age);
      return found ? { ...base, sports: { ...base.sports, offer: found.offer } } : undefined;
    });

  it('raises the offer by itself in the years after a career ends, as a question that stops time', () => {
    const state = firstSeed('post-raised', (seed) => {
      let current = retiringStar(seed);
      for (let year = 0; year < 8; year += 1) {
        current = answerOthers(advanceYear(current).state);
        if (current.sports.offer?.kind === 'post-job') return current;
        if (current.sports.offer) {
          const r = decide(current, SPORTS_OFFER_EVENT_ID, ACCEPT);
          if (r.ok) current = r.value.state;
        }
      }
      return undefined;
    });
    expect(state.sports.offer?.kind).toBe('post-job');
    expect(state.pending.some((row) => row.eventId === SPORTS_OFFER_EVENT_ID)).toBe(true);
    expect(state.sports.career).toBeUndefined();
    expect(state.sports.past.length).toBeGreaterThan(0);
  });

  it('asks Take the job or Not for me, with the sport, the title and the pay in the words', () => {
    const state = asked('post-words');
    const decision = sportsOfferDecision(state.sports.offer!, state.world.year);
    expect(decision.choices.map((row) => row.label)).toEqual(['Take the job', 'Not for me']);
    expect(decision.prompt).toMatch(/basketball/);
    expect(decision.prompt).toMatch(/\$/);
    expect(answerSportsOffer(state, 'more').ok).toBe(false);
  });

  it('puts the person in the post when they take it, with a record, and ends a day job for a coach', () => {
    const state = asked('post-accept');
    const offer = state.sports.offer!;
    const row = POST_JOBS[(offer as { level: keyof typeof POST_JOBS }).level];
    const job = state.employment.job ?? {
      jobId: 'job.teaching-assistant',
      since: state.player.age - 1,
      performance: 50,
    };
    const held: GameState = { ...state, employment: { ...state.employment, job: job as never } };
    const result = answerSportsOffer(held, ACCEPT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value.state;
    expect(next.sports.post).toMatchObject({
      sportId: 'basketball',
      kind: row.kind,
      since: offer.age,
      seasons: 0,
    });
    expect(next.sports.offer).toBeUndefined();
    expect(next.player.records.some((r) => /^Became a /.test(r.label))).toBe(true);
    expect(postOf(next)).toBeDefined();
    if (row.fullTime) expect(next.employment.job).toBeUndefined();
    else expect(next.employment.job).toBeDefined();
  });

  it('keeps a day job when the post is a local commentator’s', () => {
    const state = firstSeed(
      'post-local',
      (seed) => {
        const base = toAge(
          withPast(
            life(seed),
            pastRow({ sportId: 'golf', endedAge: 33, bestTier: 'fringe', titles: 0 }),
          ),
          40,
        );
        const found = postOffer(base, base.player.age);
        return found && (found.offer as { level: string }).level === 'local'
          ? { ...base, sports: { ...base.sports, offer: found.offer } }
          : undefined;
      },
      200,
    );
    const job = { jobId: 'job.teaching-assistant', since: state.player.age - 1, performance: 50 };
    const held: GameState = { ...state, employment: { ...state.employment, job: job as never } };
    const result = answerSportsOffer(held, ACCEPT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.employment.job).toBeDefined();
    expect(isPostFullTime(result.value.state.sports.post)).toBe(false);
    expect(postOccupation(result.value.state.sports.post)).toBeUndefined();
  });

  it('keeps a turned-down post as over, and the question is not asked again in the life', () => {
    const state = asked('post-decline');
    const result = answerSportsOffer(state, DECLINE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.value.state;
    expect(next.sports.post?.over).toBe(true);
    expect(postOf(next)).toBeUndefined();
    for (let age = 34; age <= 62; age += 4) expect(postOffer(next, age)).toBeUndefined();
  });

  it('pays in the ledger as the post, taxed, and a little more every year', () => {
    const state = asked('post-pay');
    const accepted = (answerSportsOffer(state, ACCEPT) as { value: { state: GameState } }).value
      .state;
    const level = accepted.sports.post!.level;
    let current = accepted;
    const pays: number[] = [];
    const source = `${postTitle(accepted.sports.post!)} pay`;
    for (let year = 0; year < 3; year += 1) {
      const rowsBefore = current.finance.transactions.length;
      current = answerOthers(advanceYear(current).state);
      const rows = current.finance.transactions.slice(rowsBefore);
      const pay = rows.find((row) => row.category === 'salary' && row.source === source);
      expect(pay, `year ${year}`).toBeDefined();
      pays.push(Number(pay!.amount));
    }
    expect(
      current.finance.transactions.some(
        (row) => row.category === 'tax' && /playing pay/.test(row.source),
      ),
    ).toBe(true);
    expect(pays[2]!).toBeGreaterThanOrEqual(pays[0]!);
    expect(postPay(level, 0)).toBe(POST_JOBS[level].pay);
  });

  it('puts a coach’s title in the header and keeps job offers away from a living, never from a part-time chair', () => {
    expect(postTitle({ sportId: 'basketball', level: 'college' })).toBe('College basketball coach');
    expect(postTitle({ sportId: 'swimming', level: 'national' })).toBe('National swimming analyst');
    expect(postTitle({ sportId: 'olympic-boxing', level: 'overseas' })).toBe(
      'Overseas amateur boxing coach',
    );
    const coach: PostJob = {
      sportId: 'basketball',
      kind: 'coach',
      level: 'pro',
      since: 35,
      seasons: 1,
    };
    expect(postOccupation(coach)).toBe('Pro basketball coach');
    expect(postOccupation({ ...coach, over: true })).toBeUndefined();
    expect(sportsOccupation(undefined, coach)).toBe('Pro basketball coach');
    const local: PostJob = { ...coach, kind: 'commentary', level: 'local' };
    expect(sportsOccupation(undefined, local)).toBeUndefined();
    const base = toAge(life('post-door'), 40);
    const doorFor = (post: PostJob | undefined, attempt: number): boolean => {
      const {
        offer: _a,
        collegeOffer: _b,
        lifeOffer: _c,
        pursuitOffer: _d,
        homeOffer: _e,
        vehicleOffer: _f,
        renovationOffer: _g,
        ...clear
      } = base;
      return Boolean(
        withAnyOffer(
          {
            ...clear,
            pending: [],
            sports: { ...base.sports, ...(post ? { post } : {}) },
            employment: { ...base.employment, job: undefined },
            education: { ...base.education, finishedAtAge: base.player.age },
            world: { ...base.world, year: base.world.year + attempt },
          },
          true,
        ).offer,
      );
    };
    let living = 0;
    let beside = 0;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (doorFor(coach, attempt)) living += 1;
      if (doorFor(local, attempt)) beside += 1;
    }
    expect(living).toBe(0);
    expect(beside).toBeGreaterThan(0);
  });

  it('can be left, and then it is over for good', () => {
    const state = asked('post-leave');
    const accepted = (answerSportsOffer(state, ACCEPT) as { value: { state: GameState } }).value
      .state;
    const left = leavePost(accepted);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.value.state.sports.post?.over).toBe(true);
    expect(left.value.entry.text).toMatch(/^Left the job as a /);
    expect(postOf(left.value.state)).toBeUndefined();
    const again = leavePost(left.value.state);
    expect(again.ok).toBe(false);
    for (let age = 34; age <= 62; age += 4)
      expect(postOffer(left.value.state, age)).toBeUndefined();
  });

  it('ends at sixty-eight, with a line, and the pay for that last year', () => {
    const post: PostJob = {
      sportId: 'basketball',
      kind: 'coach',
      level: 'pro',
      since: 35,
      seasons: 20,
    };
    const early = runPostYear(post, POST_END_AGE - 1);
    expect(early.post).toMatchObject({ seasons: 21 });
    expect(early.post?.over).toBeUndefined();
    expect(early.lines).toEqual([]);
    expect(early.pay).toBe(postPay('pro', 20));
    const last = runPostYear(post, POST_END_AGE);
    expect(last.post?.over).toBe(true);
    expect(last.lines.join(' ')).toMatch(/Retired from the pro coach job at 68/);
    expect(last.pay).toBe(postPay('pro', 20));
    expect(runPostYear(undefined, 50)).toEqual({ post: undefined, pay: 0, lines: [] });
    expect(runPostYear({ ...post, over: true }, 50).pay).toBe(0);
  });

  it('is offered after any sport: a golfer’s, a gymnast’s and a hockey player’s careers all open one', () => {
    for (const sportId of ['golf', 'gymnastics', 'hockey', 'mma']) {
      const state = asked(`post-${sportId}`, sportId);
      expect(state.sports.offer).toMatchObject({ kind: 'post-job', sportId });
    }
  });

  it('works through the year: a retired star gets the offer raised, takes it, and is paid for it until sixty-eight', () => {
    const state = firstSeed(
      'post-life',
      (seed) => {
        let current = retiringStar(seed);
        for (let year = 0; year < 12; year += 1) {
          current = answerOthers(advanceYear(current).state);
          if (current.sports.offer) {
            const r = decide(current, SPORTS_OFFER_EVENT_ID, ACCEPT);
            if (r.ok) current = r.value.state;
          }
          if (current.sports.post) return current;
        }
        return undefined;
      },
      30,
    );
    expect(state.sports.post?.over).toBeUndefined();
    expect(state.sports.past.at(-1)?.how).toBe('retired');
    expect(state.player.records.some((row) => /^Became a /.test(row.label))).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* A life that goes near none of it                                            */
/* -------------------------------------------------------------------------- */

describe('a life that never goes near any of it', () => {
  it('has no post, no program and no offer, and replays as it did before this ticket', () => {
    let state = createNewGame({ seed: 'untouched-0804' });
    let guard = 0;
    while (state.player.alive && state.player.age < 50 && (guard += 1) < 60) {
      state = answerOthers(advanceYear(answerOthers(state)).state);
      expect('post' in state.sports).toBe(false);
      expect(state.sports.offer).toBeUndefined();
      expect(state.sports.past).toEqual([]);
    }
  });

  it('is not changed by a sports year when nobody studies and nobody plays', () => {
    const state = life('no-year-0804');
    const out = runSportsYear({ before: state, education: state.education, age: 30, year: 2050 });
    expect(out.sports).toEqual({ past: [] });
    expect(out.pay).toBe(0);
    expect(out.lines).toEqual([]);
  });

  it('does not make a team sport player an Olympian: a basketball life has no national program', () => {
    const state = proState(BASKETBALL, { tier: 'star' }, 'team-life');
    expect(nationalTeamOffer(state, 20, [])).toBeUndefined();
    expect(sportsOccupation(state.sports.career)).toBe('Professional basketball player');
  });
});

/* -------------------------------------------------------------------------- */
/* The numbers                                                                 */
/* -------------------------------------------------------------------------- */

describe('the numbers behind the spec', () => {
  it('keeps a final under a medal, and the team tier at the second rung', () => {
    expect(FINAL_LINE).toBe(62);
    expect(MEDAL_LINE).toEqual({ gold: 98, silver: 92, bronze: 86 });
    expect(POST_END_AGE).toBe(68);
    expect(POST_OFFER_MAX_AGE).toBe(62);
  });

  it('is honest that sports has a window per Olympic sport', () => {
    expect(Object.keys(OLYMPIC_WINDOW)).toEqual(OLYMPIC_SPORTS.map((sport) => sport.id));
  });
});
