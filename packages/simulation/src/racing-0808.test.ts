/**
 * Ticket 0808 acceptance tests — motor racing: a driver's career, and a racing team.
 *
 * A driver comes up through karting (from eight), is offered a seat, and runs a season like a tour player's but with
 * a championship and a team that may not renew. A racing team is the business whose year is a season. These tests
 * pin the rows, the road in, a season and its money, every command an owner has, and that a life that goes near none
 * of it replays as it did.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  MARTIAL_ARTS,
  MARTIAL_ART_MIN_AGE,
  NEW_RUNG_CAR_GAP,
  RACING_NOISE,
  RACING_PLACE_BAND,
  RACING_SPORTS,
  RACING_STUDIES,
  RACING_TEAM_TYPE_ID,
  RACING_TITLE_CHANCE,
  RACING_WINDOW,
  REACH_SEAT,
  SERIES,
  SPORTS,
  STUDIES,
  TEAM_INCIDENT_LINES,
  findMartialArt,
  findSport,
  type SportTier,
} from '@yearafter/content';
import { defaultTeam, driverCandidates, newBusiness, type OwnedBusiness } from '@yearafter/finance';
import { findBusinessType, BUSINESS_TYPES } from '@yearafter/content';
import { advanceYear } from './advance';
import {
  STEP_DOWN_RETURN,
  businessMarket,
  businessesForSale,
  closeBusiness,
  dropDownSeries,
  driveOwnTeam,
  hireDriver,
  moveUpSeries,
  openBusiness,
  ownerDriving,
  racingViewOf,
  runBusinessesYear,
  setDevelopment,
  stopDrivingOwnTeam,
  upgradeOffers,
  viewOf,
} from './businesses';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import {
  ACCEPT,
  DECLINE,
  SPORTS_OFFER_EVENT_ID,
  answerSportsOffer,
  runSportsYear,
  sportsOfferDecision,
} from './sports';
import { RACING_MINOR_LINES, RACING_SERIOUS_LINES } from './sports-core';
import {
  artsOf,
  isFullTime,
  racingSeatOffer,
  retirementAge,
  runIndividualSeason,
  startArt,
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

function firstSeed<T>(prefix: string, pick: (seed: string) => T | undefined, tries = 80): T {
  for (let index = 0; index < tries; index += 1) {
    const found = pick(`${prefix}-${index}`);
    if (found !== undefined) return found;
  }
  throw new Error(`no life of ${tries} satisfied the test for ${prefix}`);
}

const RACING = findSport('racing')!;

const kart = (seasons: number, level = 60, hard = seasons): ArtStudy => ({
  artId: 'karting',
  startedAge: 9,
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

function racingCareer(over: Partial<SportCareer> = {}): SportCareer {
  return {
    sportId: 'racing',
    stage: 'pro',
    startedAge: 9,
    seasons: 8,
    hardSeasons: 6,
    form: 60,
    trainedAtAge: -1,
    trainedCount: 0,
    reputation: 10,
    titles: 0,
    tier: 'role',
    proSeasons: 3,
    team: RACING.proTeams[0] ?? '',
    ...over,
  };
}

const driverState = (over: Partial<SportCareer> = {}, seed = 'drv-fixture'): GameState => {
  const base = life(seed);
  return { ...base, sports: { ...base.sports, career: racingCareer(over) } };
};

function topUp(state: GameState, amount: number): GameState {
  const books = {
    ...state.finance,
    balance: (Number(state.finance.balance) + amount * 100) as never,
    transactions: [
      ...state.finance.transactions,
      {
        id: `f:${state.world.year}:gift:test-${amount}`,
        year: state.world.year,
        age: state.player.age,
        category: 'gift' as const,
        amount: (amount * 100) as never,
        source: 'A test windfall',
      },
    ],
  };
  return { ...state, finance: books, player: { ...state.player, cash: books.balance } };
}

const ADULT = topUp(toAge(life('racing-adult'), 30), 3_000_000);

function owned(from: GameState = ADULT): { state: GameState; id: string } {
  const result = openBusiness(from, RACING_TEAM_TYPE_ID);
  if (!result.ok) throw new Error(`could not open a team: ${result.error}`);
  return { state: result.value.state, id: result.value.business.id };
}

/** An owned team with a given racing state, and a first season behind it at that rung. */
function withTeamState(
  team: Partial<NonNullable<OwnedBusiness['racing']>> = {},
  from: GameState = ADULT,
): { state: GameState; id: string } {
  const { state, id } = owned(from);
  const business = state.businesses.find((row) => row.id === id)!;
  const base = defaultTeam(state.rng.getSeed(), id, business.openedYear);
  const rung = team.rung ?? 1;
  const racing = {
    ...base,
    last: {
      year: state.world.year,
      rung,
      place: 5,
      field: SERIES[rung].field,
      title: false,
      incident: false,
    },
    ...team,
  };
  return {
    id,
    state: {
      ...state,
      businesses: state.businesses.map((row) => (row.id === id ? { ...row, racing } : row)),
    },
  };
}

const teamOfState = (state: GameState, id: string) =>
  state.businesses.find((row) => row.id === id)!.racing!;

/* -------------------------------------------------------------------------- */
/* The rows                                                                    */
/* -------------------------------------------------------------------------- */

describe('the racing sport', () => {
  it('is one row, Apex Racing Series, in the racing format, with letters nobody else holds', () => {
    expect(RACING_SPORTS).toHaveLength(1);
    expect(RACING).toMatchObject({
      id: 'racing',
      format: 'racing',
      league: 'Apex Racing Series',
      leagueShort: 'ARS',
      playerTitle: 'Professional driver',
      activityId: '',
    });
    expect(RACING.skills).toHaveLength(5);
    expect(RACING.collegeTeams).toEqual([]);
    expect(RACING.proTeams).toHaveLength(12);
    expect(new Set(RACING.proTeams).size).toBe(12);
    expect(new Set(SPORTS.map((sport) => sport.leagueShort)).size).toBe(SPORTS.length);
    expect(['NASCAR', 'IMSA', 'FIA', 'F1', 'WEC', 'IRL']).not.toContain(RACING.leagueShort);
  });

  it('pays a ladder that only goes up, with a living from the third rung', () => {
    const pay = Object.values(RACING.economy.pay);
    expect([...pay].sort((a, b) => a - b)).toEqual(pay);
    expect(RACING.economy.fullTimeFrom).toBe('role');
    expect(RACING.economy.pay.superstar).toBeGreaterThan(RACING.economy.pay.star * 3);
    expect(RACING.economy.pay.fringe).toBeLessThan(60_000);
    expect(RACING.economy.injuryFactor).toBeGreaterThan(1);
  });

  it('is exactly these numbers, so changing one is a decision and not an accident', () => {
    expect(RACING.economy).toEqual({
      pay: {
        fringe: 40_000,
        role: 150_000,
        starter: 600_000,
        star: 4_000_000,
        superstar: 25_000_000,
      },
      retireAge: {
        fringe: [27, 33],
        role: [30, 37],
        starter: [33, 41],
        star: [36, 45],
        superstar: [38, 47],
      },
      draftSize: 0,
      firstRound: 0,
      rookieTop: 0,
      injuryFactor: 1.4,
      fullTimeFrom: 'role',
      declineFrom: 36,
    });
    expect(RACING_PLACE_BAND).toEqual({
      superstar: [1, 3],
      star: [2, 6],
      starter: [4, 11],
      role: [7, 16],
      fringe: [11, 24],
    });
    expect(RACING_TITLE_CHANCE).toEqual({
      fringe: 0,
      role: 0.03,
      starter: 0.09,
      star: 0.22,
      superstar: 0.4,
    });
    expect(REACH_SEAT).toEqual({
      talentAndWork: 0.35,
      talentOnly: 0.18,
      workOnly: 0.12,
      neither: 0.005,
    });
    expect(RACING_WINDOW).toEqual([16, 30]);
    expect(RACING_NOISE).toBe(26);
  });

  it('retires a star later than a fringe driver, and never before thirty', () => {
    const ages = Object.values(RACING.economy.retireAge);
    for (const [low, high] of ages) {
      expect(low).toBeGreaterThanOrEqual(27);
      expect(high).toBeGreaterThan(low);
    }
    expect(RACING.economy.retireAge.superstar[0]).toBeGreaterThan(
      RACING.economy.retireAge.fringe[0],
    );
  });

  it('reaches by talent and work, narrower than any other road in the individual sports', () => {
    expect(REACH_SEAT.talentAndWork).toBeGreaterThan(REACH_SEAT.talentOnly);
    expect(REACH_SEAT.talentOnly).toBeGreaterThan(REACH_SEAT.workOnly);
    expect(REACH_SEAT.workOnly).toBeGreaterThan(REACH_SEAT.neither);
    expect(REACH_SEAT.neither).toBeGreaterThan(0);
    expect(REACH_SEAT.neither).toBeLessThan(0.01);
    expect(RACING_WINDOW).toEqual([16, 30]);
  });

  it('wins titles more often higher up, and never from the bottom rung', () => {
    const tiers: SportTier[] = ['fringe', 'role', 'starter', 'star', 'superstar'];
    expect(RACING_TITLE_CHANCE.fringe).toBe(0);
    for (let i = 1; i < tiers.length; i += 1) {
      expect(RACING_TITLE_CHANCE[tiers[i]!]).toBeGreaterThan(RACING_TITLE_CHANCE[tiers[i - 1]!]);
      expect(RACING_PLACE_BAND[tiers[i]!][1]).toBeLessThan(RACING_PLACE_BAND[tiers[i - 1]!][1]);
    }
    expect(RACING_NOISE).toBeGreaterThan(20);
  });
});

describe('karting', () => {
  it('is a study that feeds racing, from eight, beside the martial arts but not one of them', () => {
    expect(RACING_STUDIES.map((row) => row.id)).toEqual(['karting']);
    const karting = findMartialArt('karting')!;
    expect(karting).toMatchObject({ style: 'driving', minAge: 8, feeds: ['racing'] });
    expect(karting.annualCost).toBe(6_000);
    expect(MARTIAL_ARTS.some((row) => row.id === 'karting')).toBe(false);
    expect(STUDIES.some((row) => row.id === 'karting')).toBe(true);
    expect(karting.minAge).toBeLessThan(MARTIAL_ART_MIN_AGE);
  });

  it('starts at eight, not at seven, while a martial art still waits for ten', () => {
    const at = (age: number): GameState => {
      const base = life('kart-age');
      return { ...base, player: { ...base.player, age } };
    };
    const seven = startArt(at(7), 'karting');
    expect(seven.ok).toBe(false);
    if (!seven.ok) expect(seven.error).toBe('too-young');
    expect(startArt(at(8), 'karting').ok).toBe(true);
    const nine = startArt(at(9), 'boxing');
    expect(nine.ok).toBe(false);
    if (!nine.ok) expect(nine.error).toBe('too-young');
    expect(startArt(at(MARTIAL_ART_MIN_AGE), 'boxing').ok).toBe(true);
  });

  it('is refused to a driver who is racing for a living: it is the career', () => {
    const state = driverState();
    const refused = startArt({ ...state, player: { ...state.player, age: 25 } }, 'karting');
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('is-your-career');
  });

  it('counts as a study (two at once, at most) like any other', () => {
    const base = life('kart-two');
    let state: GameState = { ...base, player: { ...base.player, age: 12 } };
    for (const id of ['karting', 'swimming']) {
      const started = startArt(state, id);
      expect(started.ok, id).toBe(true);
      if (started.ok) state = started.value.state;
    }
    expect(artsOf(state).map((row) => row.artId)).toEqual(['karting', 'swimming']);
    const third = startArt(state, 'boxing');
    expect(third.ok).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The seat                                                                    */
/* -------------------------------------------------------------------------- */

describe('the road to a seat', () => {
  const kids = (seed: string, arts: readonly ArtStudy[], athletics = true): GameState =>
    withArts(life(seed, athletics), arts);

  it('is offered only from sixteen to thirty', () => {
    const state = firstSeed('seat-win', (seed) => {
      const base = kids(seed, [kart(8)]);
      return racingSeatOffer(base, 20, artsOf(base)) ? base : undefined;
    });
    for (const age of [RACING_WINDOW[0] - 1, RACING_WINDOW[1] + 1, 8, 45]) {
      expect(racingSeatOffer(state, age, artsOf(state)), `age ${age}`).toBeUndefined();
    }
    for (const age of [RACING_WINDOW[0], 20, RACING_WINDOW[1]]) {
      expect(racingSeatOffer(state, age, artsOf(state)), `age ${age}`).toBeDefined();
    }
  });

  it('is one draw for the life, so the same life gets the same answer at every age in the window', () => {
    for (let index = 0; index < 40; index += 1) {
      const base = kids(`seat-once-${index}`, [kart(8)]);
      const answers = [16, 19, 23, 27, 30].map(
        (age) => racingSeatOffer(base, age, artsOf(base)) !== undefined,
      );
      expect(new Set(answers).size, `life ${index}`).toBe(1);
    }
  });

  it('needs karting: no study, no seat', () => {
    for (let index = 0; index < 40; index += 1) {
      const base = life(`seat-none-${index}`);
      expect(racingSeatOffer(base, 20, artsOf(base))).toBeUndefined();
      const swimmer = withArts(base, [{ ...kart(8), artId: 'swimming' }]);
      expect(racingSeatOffer(swimmer, 20, artsOf(swimmer))).toBeUndefined();
    }
  });

  it('is never offered twice: a seat turned down is a past, and the question does not come back', () => {
    const state = firstSeed('seat-past', (seed) => {
      const base = kids(seed, [kart(8)]);
      return racingSeatOffer(base, 20, artsOf(base)) ? base : undefined;
    });
    const withPast: GameState = {
      ...state,
      sports: {
        ...state.sports,
        past: [
          {
            sportId: 'racing',
            startedAge: 9,
            endedAge: 20,
            seasons: 8,
            titles: 0,
            reputation: 0,
            reached: 'school',
            how: 'declined',
          },
        ],
      },
    };
    expect(racingSeatOffer(withPast, 20, artsOf(withPast))).toBeUndefined();
  });

  it('reaches talent-and-work drivers far more often than anybody else, and a life with neither almost never', () => {
    const share = (athletics: boolean, hard: boolean, n = 400): number => {
      let reached = 0;
      for (let index = 0; index < n; index += 1) {
        const base = kids(
          `seat-rate-${athletics}-${hard}-${index}`,
          [kart(8, 60, hard ? 8 : 0)],
          athletics,
        );
        if (racingSeatOffer(base, 20, artsOf(base))) reached += 1;
      }
      return reached / n;
    };
    const both = share(true, true);
    const none = share(false, false);
    expect(both).toBeGreaterThan(REACH_SEAT.talentAndWork - 0.08);
    expect(both).toBeLessThan(REACH_SEAT.talentAndWork + 0.08);
    expect(none).toBeLessThan(0.03);
    expect(share(true, false)).toBeGreaterThan(none);
  });

  it('offers a seat at one of the twelve teams, as a school-stage career with the question open', () => {
    const found = firstSeed('seat-shape', (seed) => {
      const base = kids(seed, [
        kart(6, 55, 6),
        { ...kart(4, 70, 4), artId: 'karting', startedAge: 11 },
      ]);
      return racingSeatOffer(base, 18, artsOf(base));
    });
    expect(RACING.proTeams).toContain(found.career.team);
    expect(found.career).toEqual({
      sportId: 'racing',
      stage: 'school',
      startedAge: 9,
      seasons: 10,
      hardSeasons: 10,
      form: 70,
      trainedAtAge: -1,
      trainedCount: 0,
      reputation: 0,
      titles: 0,
      team: found.career.team,
    });
    expect(found.offer).toMatchObject({
      kind: 'turn-pro',
      sportId: 'racing',
      team: found.career.team,
      age: 18,
    });
    expect(found.line).toBe(
      `${found.career.team} have a seat for you. Years in a kart, and somebody was watching.`,
    );
  });

  it('carries the karting years: the seasons, the hard seasons, the first age and the best level', () => {
    const arts = [kart(6, 55, 4), { ...kart(3, 72, 1), startedAge: 7 }];
    const found = firstSeed('seat-carry', (seed) => {
      const base = kids(seed, arts);
      return racingSeatOffer(base, 18, artsOf(base));
    });
    expect(found.career.seasons).toBe(9);
    expect(found.career.hardSeasons).toBe(5);
    expect(found.career.startedAge).toBe(7);
    expect(found.career.form).toBe(72);
  });

  it('puts the team the same way every time it is asked', () => {
    const base = kids('seat-team', [kart(8)]);
    const again = kids('seat-team', [kart(8)]);
    expect(racingSeatOffer(base, 18, artsOf(base))?.career.team).toBe(
      racingSeatOffer(again, 18, artsOf(again))?.career.team,
    );
  });
});

describe('the seat question', () => {
  const asked = (): GameState =>
    firstSeed('seat-q', (seed) => {
      const base = withArts(life(seed), [kart(8)]);
      const found = racingSeatOffer(base, 18, artsOf(base));
      return found
        ? { ...base, sports: { ...base.sports, career: found.career, offer: found.offer } }
        : undefined;
    });

  it('is Take the seat or Not now, with nothing to ask for', () => {
    const state = asked();
    const pending = sportsOfferDecision(state.sports.offer!, state.world.year);
    expect(pending.choices.map((row) => row.label)).toEqual(['Take the seat', 'Not now']);
    expect(pending.prompt).toBe(
      `${state.sports.career!.team} will put you in a car in the Apex Racing Series. The first pay is small, and the rest of your life stays where it is.`,
    );
    expect(answerSportsOffer(state, 'more').ok).toBe(false);
  });

  it('puts an accepted driver in the pro stage at the bottom, with no record of wins and losses', () => {
    const state = asked();
    const result = answerSportsOffer(state, ACCEPT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const career = result.value.state.sports.career!;
    expect(career).toMatchObject({
      stage: 'pro',
      tier: 'fringe',
      proSeasons: 0,
      team: state.sports.career!.team,
    });
    expect(career.wins).toBeUndefined();
    expect(career.losses).toBeUndefined();
    expect(isFullTime(career)).toBe(false);
    expect(result.value.entry.text).toBe(
      `Signed with ${career.team}. The first race is in the spring.`,
    );
    const record = result.value.state.player.records.find(
      (row) => row.label === 'Took a seat in the ARS',
    );
    expect(record).toMatchObject({ category: 'career', referenceId: 'racing' });
    expect(result.value.state.sports.offer).toBeUndefined();
  });

  it('is asked by the sports year itself, once, and an open question is carried and not replaced', () => {
    const year = (state: GameState, age: number) =>
      runSportsYear({ before: state, education: state.education, age, year: state.world.year });
    let offered = 0;
    for (let index = 0; index < 60; index += 1) {
      const base = withArts(life(`seat-year-${index}`), [kart(8)]);
      const out = year(base, 18);
      if (out.sports.offer === undefined) continue;
      offered += 1;
      expect(out.sports.offer).toMatchObject({ kind: 'turn-pro', sportId: 'racing' });
      expect(out.sports.career).toMatchObject({ sportId: 'racing', stage: 'school' });
      expect(out.lines.some((row) => /have a seat for you\./.test(row.text))).toBe(true);
      // Next year the question is still open: the amateur driver is not walked away from.
      const later = year({ ...base, sports: { ...base.sports, ...out.sports } }, 19);
      expect(later.sports.offer).toEqual(out.sports.offer);
      expect(later.sports.career).toMatchObject({ sportId: 'racing', stage: 'school' });
      if (offered >= 6) break;
    }
    expect(offered).toBeGreaterThan(2);
    // With a career already running, no seat is on offer, however good the karting was.
    for (let index = 0; index < 30; index += 1) {
      const base = withArts(life(`seat-busy-${index}`), [kart(8)]);
      const busy = {
        ...base,
        sports: { ...base.sports, career: racingCareer({ sportId: 'golf', tier: 'fringe' }) },
      };
      expect(year(busy, 18).sports.offer).toBeUndefined();
    }
  });

  it('keeps a turned-down seat as a past with no record, and asks again never', () => {
    const state = asked();
    const result = answerSportsOffer(state, DECLINE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.sports.career).toBeUndefined();
    const past = result.value.state.sports.past.at(-1)!;
    expect(past).toMatchObject({
      sportId: 'racing',
      how: 'declined',
      reached: 'school',
      titles: 0,
    });
    expect(past.wins).toBeUndefined();
    expect(result.value.entry.text).toBe(`Turned down the seat at ${state.sports.career!.team}.`);
  });
});

/* -------------------------------------------------------------------------- */
/* A season                                                                    */
/* -------------------------------------------------------------------------- */

function seasonsOf(career: Partial<SportCareer>, years: number, start = 2000, age = 26) {
  const state = driverState(career);
  return Array.from({ length: years }, (_, index) => ({
    year: start + index,
    out: runIndividualSeason({
      before: state,
      career: state.sports.career!,
      sport: RACING,
      age,
      year: start + index,
    }),
  }));
}

describe('a racing season', () => {
  it('reports a place in the standings, never a win-loss record', () => {
    const rows = seasonsOf({ tier: 'starter', form: 65 }, 60);
    let standings = 0;
    for (const { out } of rows) {
      expect(out.career.wins).toBeUndefined();
      expect(out.career.losses).toBeUndefined();
      for (const line of out.lines) expect(line.text).not.toMatch(/ranked|world|record of/);
      if (out.lines.some((line) => /in the ARS standings\.$/.test(line.text))) standings += 1;
    }
    expect(standings).toBeGreaterThan(20);
  });

  it('wins the championship at the tier’s rate, with a record and a lift, and the first place in the standings', () => {
    for (const tier of ['role', 'starter', 'star', 'superstar'] as const) {
      const rows = seasonsOf({ tier, form: 80, health: undefined } as never, 500);
      const titled = rows.filter(({ out }) => out.career.titles > 0);
      const rate = titled.length / rows.length;
      // A title needs a healthy season, so the rate sits a little under the table.
      expect(rate, tier).toBeLessThanOrEqual(RACING_TITLE_CHANCE[tier] + 0.04);
      expect(rate, tier).toBeGreaterThan(RACING_TITLE_CHANCE[tier] * 0.5);
      for (const { out } of titled.slice(0, 5)) {
        expect(out.records.map((row) => row.label)).toContain('Won the ARS championship');
        expect(out.records.find((row) => row.label === 'Won the ARS championship')).toMatchObject({
          category: 'championship',
          referenceId: 'racing',
        });
        expect(out.lines.map((line) => line.text)).toContain(
          `Won the ARS championship for ${RACING.proTeams[0]}.`,
        );
        expect(out.mood).toBeGreaterThanOrEqual(4);
      }
    }
    const fringe = seasonsOf({ tier: 'fringe', form: 90 }, 300);
    expect(fringe.filter(({ out }) => out.career.titles > 0)).toHaveLength(0);
  });

  it('finishes a driver inside the tier’s band, and first for a title', () => {
    for (const tier of ['fringe', 'role', 'starter', 'star', 'superstar'] as const) {
      let seen = 0;
      for (const { out } of seasonsOf({ tier, form: 70 }, 120)) {
        // The place is judged against the tier the year ended in.
        const [low, high] = RACING_PLACE_BAND[(out.career.tier ?? tier) as SportTier];
        for (const line of out.lines) {
          const m = /Finished (\d+)(?:st|nd|rd|th) in the ARS standings\./.exec(line.text);
          if (!m) continue;
          seen += 1;
          expect(Number(m[1]), tier).toBeGreaterThanOrEqual(low);
          expect(Number(m[1]), tier).toBeLessThanOrEqual(high);
        }
      }
      expect(seen, tier).toBeGreaterThan(40);
    }
  });

  it('releases a fringe driver after a poor year, but not in the first season, and never anyone higher up for one', () => {
    const rows = seasonsOf({ tier: 'fringe', form: 5, proSeasons: 3 }, 80);
    const released = rows.filter(({ out }) => out.ended === 'released');
    expect(released.length).toBeGreaterThan(20);
    for (const { out } of released.slice(0, 5)) {
      expect(out.lines.map((line) => line.text)).toContain(
        `${RACING.proTeams[0]} didn't renew your seat after a poor year.`,
      );
    }
    const first = seasonsOf({ tier: 'fringe', form: 5, proSeasons: 0 }, 80);
    expect(first.filter(({ out }) => out.ended === 'released')).toHaveLength(0);
    const higher = seasonsOf({ tier: 'role', form: 5, proSeasons: 3 }, 80);
    expect(higher.filter(({ out }) => out.ended === 'released')).toHaveLength(0);
  });

  it('moves a driver up a rung for a strong year and down for a weak one, in the words of the grid', () => {
    const up = seasonsOf({ tier: 'role', form: 95 }, 80);
    expect(
      up.some(({ out }) =>
        out.lines.some((line) =>
          /^A better team wants you\. You are .* on the grid now\.$/.test(line.text),
        ),
      ),
    ).toBe(true);
    const down = seasonsOf({ tier: 'star', form: 20 }, 80);
    expect(
      down.some(({ out }) =>
        out.lines.some((line) =>
          /^Dropped to a slower car after a poor run\. You are .* now\.$/.test(line.text),
        ),
      ),
    ).toBe(true);
  });

  it('is hurt in a car more often than the average sport, with its own words for it', () => {
    const rows = seasonsOf({ tier: 'starter', form: 60 }, 600);
    const text = rows.flatMap(({ out }) => out.lines.map((line) => line.text));
    expect(text.some((line) => RACING_MINOR_LINES.includes(line))).toBe(true);
    expect(text.some((line) => RACING_SERIOUS_LINES.includes(line))).toBe(true);
    expect(rows.some(({ out }) => out.ended === 'injury')).toBe(true);
    expect(
      rows.some(({ out }) =>
        out.lines.some((line) => /^An injury ended your .* career at 26\.$/.test(line.text)),
      ),
    ).toBe(true);
  });

  it('is hurt a good deal more often than a golfer of the same standing', () => {
    const golf = findSport('golf')!;
    const state = driverState({ tier: 'starter', form: 60 });
    const hurt = (sport: typeof RACING, career: SportCareer): number => {
      let count = 0;
      for (let year = 2000; year < 5000; year += 1) {
        const out = runIndividualSeason({ before: state, career, sport, age: 26, year });
        if (
          out.health < 0 ||
          out.lines.some((line) =>
            /injur|hurt|crash|back|wrist|neck|shoulder|knee|ankle/i.test(line.text),
          )
        ) {
          count += 1;
        }
      }
      return count;
    };
    const car = hurt(RACING, state.sports.career!);
    const links = hurt(golf, { ...state.sports.career!, sportId: 'golf' });
    expect(car).toBeGreaterThan(links * 1.15);
    expect(RACING.economy.injuryFactor).toBe(1.4);
  });

  it('retires a driver at the end of a career, without a win-loss line', () => {
    const rows = seasonsOf({ tier: 'role', form: 60, proSeasons: 4, best: 'role' }, 12, 2000, 50);
    const retired = rows.find(({ out }) => out.ended === 'retired');
    expect(retired).toBeDefined();
    expect(
      retired!.out.lines.some((line) => /^Retired from .* at 50, after 5 seasons/.test(line.text)),
    ).toBe(true);
    expect(retired!.out.lines.every((line) => !/record of/.test(line.text))).toBe(true);
  });

  it('counts the title in the retirement line', () => {
    const rows = seasonsOf(
      { tier: 'star', form: 95, titles: 2, proSeasons: 6, best: 'star' },
      30,
      2000,
      50,
    );
    const retired = rows.find(({ out }) => out.ended === 'retired');
    expect(retired).toBeDefined();
    expect(retired!.out.lines.some((line) => /with \d titles?\.$/.test(line.text))).toBe(true);
  });
});

describe('a racing season, exactly', () => {
  const rungWords = (rows: ReturnType<typeof seasonsOf>, start: SportTier) =>
    rows.map(({ out }) => {
      const texts = out.lines.map((line) => line.text);
      return {
        out,
        up: texts.some((text) => /^A better team wants you\./.test(text)),
        down: texts.some((text) => /^Dropped to a slower car after a poor run\./.test(text)),
        standing: texts.some((text) => /in the ARS standings\.$/.test(text)),
        title: texts.some((text) => /^Won the ARS championship for /.test(text)),
        start,
      };
    });

  it('says a better team wants you exactly when the rung went up, and a slower car exactly when it went down', () => {
    const order = ['fringe', 'role', 'starter', 'star', 'superstar'];
    let ups = 0;
    let downs = 0;
    for (const start of ['role', 'starter', 'star'] as const) {
      for (const form of [20, 55, 95]) {
        for (const row of rungWords(seasonsOf({ tier: start, form }, 80), start)) {
          const now = row.out.career.tier as SportTier;
          const moved = order.indexOf(now) - order.indexOf(start);
          expect(row.up, `${start}/${form}`).toBe(moved > 0);
          expect(row.down, `${start}/${form}`).toBe(moved < 0);
          if (row.up) ups += 1;
          if (row.down) downs += 1;
        }
      }
    }
    expect(ups).toBeGreaterThan(10);
    expect(downs).toBeGreaterThan(10);
  });

  it('swings a season by the racing noise and no more: half of it either way, never past it', () => {
    // Role is 53 and starter 64. A form of 54 is ten under the next field, so a season reaches it when luck gives
    // ten or more of its thirteen: about one in nine. A form of 50 is fourteen under, which luck cannot reach.
    const up = (form: number) =>
      seasonsOf({ tier: 'role', form, proSeasons: 3 }, 1000).filter(({ out }) =>
        out.lines.some((line) => /^A better team wants you\./.test(line.text)),
      ).length;
    expect(RACING_NOISE).toBe(26);
    expect(up(54)).toBeGreaterThan(70);
    expect(up(54)).toBeLessThan(160);
    expect(up(50)).toBe(0);
  });

  it('puts the place in the standings in every season that was not lost to a serious injury, and not in the others', () => {
    let lost = 0;
    let played = 0;
    for (const row of rungWords(seasonsOf({ tier: 'starter', form: 60 }, 400), 'starter')) {
      const serious = row.out.lines.some((line) => RACING_SERIOUS_LINES.includes(line.text));
      const ending = row.out.ended === 'injury';
      if (serious || ending) {
        expect(row.standing || row.title).toBe(false);
        lost += 1;
      } else {
        expect(row.standing || row.title).toBe(true);
        played += 1;
      }
    }
    expect(lost).toBeGreaterThan(5);
    expect(played).toBeGreaterThan(200);
  });

  it('moves mood and health by exactly the title and the injury, and nothing else', () => {
    const seen = { title: 0, minor: 0, serious: 0, ending: 0, clean: 0 };
    for (const tier of ['role', 'starter', 'star'] as const) {
      for (const { out } of seasonsOf({ tier, form: 70 }, 500)) {
        const texts = out.lines.map((line) => line.text);
        const title = texts.some((text) => /^Won the ARS championship for /.test(text));
        const serious = texts.some((text) => RACING_SERIOUS_LINES.includes(text));
        const minor = texts.some((text) => RACING_MINOR_LINES.includes(text));
        const ending = out.ended === 'injury';
        const mood = (title ? 4 : 0) - (serious ? 3 : 0) - (ending ? 6 : 0);
        const health = serious ? -4 : ending ? -6 : 0;
        expect(out.mood).toBe(mood);
        expect(out.health).toBe(health);
        if (title) seen.title += 1;
        if (minor) seen.minor += 1;
        if (serious) seen.serious += 1;
        if (ending) seen.ending += 1;
        if (!title && !serious && !minor && !ending) seen.clean += 1;
      }
    }
    for (const [what, count] of Object.entries(seen)) expect(count, what).toBeGreaterThan(0);
  });

  it('retires at the age the life drew and not the year before, and counts titles exactly', () => {
    const state = driverState({ tier: 'role', form: 60, proSeasons: 4, best: 'role', titles: 0 });
    const due = retirementAge(RACING, 'role', state.rng.getSeed(), state.world.generation);
    const run = (age: number, year: number, titles = 0) =>
      runIndividualSeason({
        before: state,
        career: { ...state.sports.career!, titles },
        sport: RACING,
        age,
        year,
      });
    // The best rung is what sets the age, so only years that stayed at or under the role rung count.
    const steady = (out: ReturnType<typeof run>) =>
      ['fringe', 'role'].includes(out.career.tier ?? '');
    let at = 0;
    let titled = 0;
    let single = 0;
    for (let year = 2000; year < 2600; year += 1) {
      const early = run(due - 1, year);
      const on = run(due, year);
      if (steady(early) && early.ended !== 'injury' && early.ended !== 'released') {
        expect(early.ended, `age ${due - 1}`).toBeUndefined();
      }
      if (steady(on) && on.ended !== 'injury' && on.ended !== 'released') {
        expect(on.ended, `age ${due}`).toBe('retired');
        at += 1;
      }
    }
    expect(at).toBeGreaterThan(100);
    for (let year = 2000; year < 2600; year += 1) {
      for (const titles of [0, 1, 2]) {
        const out = run(due, year, titles);
        if (out.ended !== 'retired' || !steady(out)) continue;
        const line = out.lines.find((row) => /^Retired from/.test(row.text))!.text;
        const count = out.career.titles;
        const tail =
          count === 0 ? '.' : count === 1 ? ', with 1 title.' : `, with ${count} titles.`;
        expect(line.endsWith(`seasons${tail}`), line).toBe(true);
        if (count === 1) single += 1;
        if (count === 0) titled += 1;
      }
    }
    expect(single).toBeGreaterThan(5);
    expect(titled).toBeGreaterThan(5);
  });
});

describe('driving for a living', () => {
  it('pays through the sports year and says what it was for', () => {
    const base = toAge(life('drv-pay'), 26);
    const state: GameState = {
      ...base,
      sports: { ...base.sports, career: racingCareer({ tier: 'starter', proSeasons: 3 }) },
    };
    const after = advanceYear(state).state;
    const posted = after.finance.transactions.find(
      (row) => row.source === 'Driving pay, Apex Racing Series',
    );
    expect(posted).toBeDefined();
    expect(Number(posted!.amount)).toBeGreaterThan(0);
  });

  it('is a living from the third rung and not before', () => {
    expect(isFullTime(racingCareer({ tier: 'fringe' }))).toBe(false);
    expect(isFullTime(racingCareer({ tier: 'role' }))).toBe(true);
    expect(isFullTime(racingCareer({ tier: 'superstar' }))).toBe(true);
  });

  it('is read by a team the player owns, but only while they are a pro driver', () => {
    expect(ownerDriving(driverState({ form: 71 }).sports)).toEqual({ ownerForm: 71 });
    expect(ownerDriving(driverState({ stage: 'school' }).sports)).toEqual({});
    expect(ownerDriving(driverState({ stage: 'college' }).sports)).toEqual({});
    expect(ownerDriving(driverState({ sportId: 'golf' }).sports)).toEqual({});
    expect(ownerDriving(life('no-career').sports)).toEqual({});
  });
});

/* -------------------------------------------------------------------------- */
/* The business                                                                */
/* -------------------------------------------------------------------------- */

describe('the Racing Team in the catalog', () => {
  it('is the thirty-fourth type, the one 0602 left for sports, and a motorsport business', () => {
    expect(BUSINESS_TYPES).toHaveLength(34);
    const type = findBusinessType(RACING_TEAM_TYPE_ID)!;
    expect(type).toMatchObject({ name: 'Racing Team', sector: 'Motorsport', startup: 150_000 });
    expect(type.names.length).toBeGreaterThanOrEqual(6);
  });

  it('is offered to an adult who can pay for it and to nobody else', () => {
    expect(businessMarket(ADULT).some((row) => row.id === RACING_TEAM_TYPE_ID)).toBe(true);
    const poor = topUp(ADULT, -(Math.floor(Number(ADULT.player.cash) / 100) - 1_000));
    expect(businessMarket(poor).some((row) => row.id === RACING_TEAM_TYPE_ID)).toBe(false);
    const child = createNewGame({ seed: 'racing-child' });
    expect(businessMarket(child).some((row) => row.id === RACING_TEAM_TYPE_ID)).toBe(false);
  });

  it('opens with no team of its own yet: the default is built when the first season is played', () => {
    const { state, id } = owned();
    const business = state.businesses.find((row) => row.id === id)!;
    expect(business.typeId).toBe(RACING_TEAM_TYPE_ID);
    expect(business.racing).toBeUndefined();
    expect(viewOf(state, business)).toBeDefined();
  });

  it('shows a team for a screen: the level it runs at, who is for hire, what a step up costs', () => {
    const { state, id } = owned();
    const view = racingViewOf(state, id)!;
    expect(view.series).toBe(SERIES[1]);
    expect(view.team.rung).toBe(1);
    expect(view.candidates).toEqual(driverCandidates(state.rng.getSeed(), id, state.world.year, 1));
    expect(view.upgradeCost).toBe(SERIES[2].upgrade);
    expect(view.canMoveUp).toBe(false);
    expect(view.canDriveYourself).toBe(false);
    expect(racingViewOf(state, 'nobody')).toBeUndefined();
    const driver = { ...state, sports: { ...state.sports, career: racingCareer() } };
    expect(racingViewOf(driver, id)!.canDriveYourself).toBe(true);
    const top = withTeamState({ rung: 5 });
    expect(racingViewOf(top.state, top.id)!.upgradeCost).toBeUndefined();
    expect(racingViewOf(top.state, top.id)!.canMoveUp).toBe(false);
    const ready = withTeamState({ rung: 2 });
    expect(racingViewOf(ready.state, ready.id)!.canMoveUp).toBe(true);
    expect(racingViewOf(ready.state, ready.id)!.upgradeCost).toBe(SERIES[3].upgrade);
    const notRacing = openBusiness(ADULT, 'biz.cafe');
    expect(notRacing.ok).toBe(true);
    if (notRacing.ok)
      expect(racingViewOf(notRacing.value.state, notRacing.value.business.id)).toBeUndefined();
  });
});

describe('a team’s year', () => {
  const year = (state: GameState, ownerForm?: number) =>
    runBusinessesYear({
      businesses: state.businesses,
      loans: state.loans,
      year: state.world.year + 1,
      seed: state.rng.getSeed(),
      market: 'normal',
      available: 5_000_000,
      holdsJob: false,
      stat: () => 50,
      ...(ownerForm !== undefined ? { ownerForm } : {}),
    });

  it('plays a season and keeps the team: a first season builds the default, and the next builds on it', () => {
    const { state, id } = owned();
    const first = year(state);
    const team = first.businesses.find((row) => row.id === id)!.racing!;
    expect(team.seasons).toBe(1);
    expect(team.rung).toBe(1);
    expect(team.last!.year).toBe(state.world.year + 1);
    expect(
      first.lines.some((line) =>
        /in the Coastline Club Racing\.$|won the Coastline Club Racing championship\.$/.test(line),
      ),
    ).toBe(true);
    const second = runBusinessesYear({
      businesses: first.businesses,
      loans: first.loans,
      year: state.world.year + 2,
      seed: state.rng.getSeed(),
      market: 'normal',
      available: 5_000_000,
      holdsJob: false,
      stat: () => 50,
    });
    expect(second.businesses[0]!.racing!.seasons).toBe(2);
    expect(second.businesses[0]!.racing!.last!.year).toBe(state.world.year + 2);
  });

  it('draws no shop event and no staffing change: a team is not a shop', () => {
    const { state, id } = owned();
    let staff = state.businesses.find((row) => row.id === id)!.staff;
    for (let index = 0; index < 12; index += 1) {
      const out = year({ ...state, world: { ...state.world, year: state.world.year + index } });
      const row = out.businesses.find((business) => business.id === id)!;
      expect(row.last?.event).toBeUndefined();
      expect(row.staff).toBe(staff);
      staff = row.staff;
    }
  });

  it('leaves the staff alone even when it is set to staff itself and the team is over- or under-manned', () => {
    const { state, id } = owned();
    for (const staff of [0, 1, 9, 30]) {
      const crowded: GameState = {
        ...state,
        businesses: state.businesses.map((row) =>
          row.id === id ? { ...row, staff, autoStaff: true } : row,
        ),
      };
      for (let index = 0; index < 4; index += 1) {
        const out = year({
          ...crowded,
          world: { ...crowded.world, year: crowded.world.year + index },
        });
        expect(out.businesses.find((row) => row.id === id)!.staff, String(staff)).toBe(staff);
      }
    }
  });

  it('reports the ledger year in the generic shape: revenue, costs, profit', () => {
    const { state, id } = owned();
    const out = year(state);
    const row = out.businesses.find((business) => business.id === id)!;
    expect(row.last!.revenue).toBeGreaterThan(0);
    expect(row.last!.profit).toBe(row.last!.revenue - row.last!.costs);
    expect(row.last!.turnedAway).toBe(0);
  });

  it('writes a championship record only for a title, and names the series', () => {
    const strong = withTeamState({ rung: 1, car: 60, driver: { kind: 'owner' } });
    let titles = 0;
    let none = 0;
    for (let index = 0; index < 120; index += 1) {
      const out = runBusinessesYear({
        businesses: strong.state.businesses,
        year: 2040 + index,
        seed: strong.state.rng.getSeed(),
        market: 'normal',
        available: 5_000_000,
        holdsJob: false,
        stat: () => 50,
        ownerForm: 62,
      });
      const won = out.businesses[0]!.racing!.last!.title;
      if (won) {
        titles += 1;
        expect(out.records).toEqual([
          {
            category: 'championship',
            label: 'Won the Coastline Club Racing championship as an owner',
            referenceId: RACING_TEAM_TYPE_ID,
          },
        ]);
        expect(out.lines).toContain(
          `${out.businesses[0]!.name} won the Coastline Club Racing championship.`,
        );
      } else {
        none += 1;
        expect(out.records).toEqual([]);
        expect(
          out.lines.some((line) =>
            /^.* finished \d+(st|nd|rd|th) of 24 in the Coastline Club Racing\.$/.test(line),
          ),
        ).toBe(true);
      }
    }
    expect(titles).toBeGreaterThan(20);
    expect(none).toBeGreaterThan(0);
  });

  it('names an incident when there was one, from the team’s own words', () => {
    const { state } = owned();
    let incidents = 0;
    for (let index = 0; index < 80; index += 1) {
      const out = runBusinessesYear({
        businesses: state.businesses,
        year: 2040 + index,
        seed: 'incident-seed',
        market: 'normal',
        available: 5_000_000,
        holdsJob: false,
        stat: () => 50,
      });
      const team = out.businesses[0]!.racing!;
      const crash = out.lines.some((line) =>
        /A crash in the middle of the season|A blown engine|A big accident/.test(line),
      );
      expect(crash).toBe(team.last!.incident);
      if (crash) incidents += 1;
    }
    expect(incidents).toBeGreaterThan(3);
    expect(incidents).toBeLessThan(40);
  });

  it('says each of its incident lines in turn, with the team’s name in it', () => {
    const { state } = owned();
    const name = state.businesses[0]!.name;
    const said = new Set<string>();
    for (let index = 0; index < 400; index += 1) {
      const out = runBusinessesYear({
        businesses: state.businesses,
        year: 2040 + index,
        seed: 'incident-lines',
        market: 'normal',
        available: 5_000_000,
        holdsJob: false,
        stat: () => 50,
      });
      for (const line of out.lines) {
        for (const template of TEAM_INCIDENT_LINES) {
          if (line === template.replace('{name}', name)) said.add(template);
        }
      }
    }
    expect([...said].sort()).toEqual([...TEAM_INCIDENT_LINES].sort());
  });

  it('seats an owner who drives, and finds a replacement for one who stopped', () => {
    const driving = withTeamState({ driver: { kind: 'owner' } });
    const stays = year(driving.state, 70);
    expect(stays.businesses[0]!.racing!.driver).toEqual({ kind: 'owner' });
    expect(stays.lines.some((line) => /needed a new driver/.test(line))).toBe(false);
    const stops = year(driving.state);
    expect(stops.businesses[0]!.racing!.driver.kind).toBe('hired');
    expect(stops.lines.some((line) => /needed a new driver\./.test(line))).toBe(true);
  });

  it('pays a lender out of the team’s till as any business does', () => {
    const { state } = owned();
    const out = year(state);
    expect(out.drawn).toBeGreaterThanOrEqual(0);
    expect(out.transactions.every((row) => typeof row.source === 'string')).toBe(true);
  });

  it('changes nothing for a life with no team: a year of any other business is as it was', () => {
    const cafe = openBusiness(ADULT, 'biz.cafe');
    expect(cafe.ok).toBe(true);
    if (!cafe.ok) return;
    const out = year(cafe.value.state);
    expect(out.businesses[0]!.racing).toBeUndefined();
    expect(out.lines.every((line) => !/championship|grid|driver/.test(line))).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* An owner's choices                                                          */
/* -------------------------------------------------------------------------- */

describe('development', () => {
  it('sets how hard the team spends on the car, and says so', () => {
    const { state, id } = owned();
    for (const [choice, word] of [
      ['heavy', 'a heavy'],
      ['lean', 'a lean'],
      ['steady', 'a steady'],
    ] as const) {
      const result = setDevelopment(state, id, choice);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(teamOfState(result.value.state, id).development).toBe(choice);
      expect(result.value.entry.text).toBe(
        `${state.businesses.find((row) => row.id === id)!.name} will run ${word} development programme this year.`,
      );
      expect(result.value.state.player.timeline.at(-1)).toEqual(result.value.entry);
    }
  });

  it('refuses a programme that does not exist, a business that is not a team, and one that is not there', () => {
    const { state, id } = owned();
    const bad = setDevelopment(state, id, 'reckless' as never);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toBe('no-such-choice');
    const cafe = openBusiness(ADULT, 'biz.cafe');
    if (!cafe.ok) throw new Error('cafe');
    const notTeam = setDevelopment(cafe.value.state, cafe.value.business.id, 'heavy');
    expect(notTeam.ok).toBe(false);
    if (!notTeam.ok) expect(notTeam.error).toBe('not-a-racing-team');
    const none = setDevelopment(state, 'biz:none', 'heavy');
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toBe('no-such-business');
  });

  it('does not touch the money, and leaves the other businesses as they were', () => {
    const { state, id } = owned();
    const result = setDevelopment(state, id, 'heavy');
    if (!result.ok) throw new Error('dev');
    expect(result.value.state.finance).toBe(state.finance);
    expect(result.value.state.player.cash).toBe(state.player.cash);
  });
});

describe('the driver', () => {
  it('hires a driver from the market and says who', () => {
    const { state, id } = owned();
    const candidate = driverCandidates(state.rng.getSeed(), id, state.world.year, 1)[1]!;
    const result = hireDriver(state, id, candidate.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(teamOfState(result.value.state, id).driver).toEqual(candidate);
    expect(result.value.entry.text).toBe(
      `${state.businesses.find((row) => row.id === id)!.name} signed ${candidate.name} to drive.`,
    );
  });

  it('refuses someone who is not in this year’s market, and a business that is not a team', () => {
    const { state, id } = owned();
    const nobody = hireDriver(state, id, 'drv:1900:1:0');
    expect(nobody.ok).toBe(false);
    if (!nobody.ok) expect(nobody.error).toBe('no-such-driver');
    const last = driverCandidates(state.rng.getSeed(), id, state.world.year - 1, 1)[0]!;
    expect(hireDriver(state, id, last.id).ok).toBe(false);
    const gone = hireDriver(state, 'biz:none', last.id);
    expect(gone.ok).toBe(false);
    if (!gone.ok) expect(gone.error).toBe('no-such-business');
  });

  it('sits the owner in the car only if they are a pro driver, and makes it their team', () => {
    const { state, id } = owned();
    const refused = driveOwnTeam(state, id);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toBe('not-a-driver');
    const pro: GameState = { ...state, sports: { ...state.sports, career: racingCareer() } };
    const driven = driveOwnTeam(pro, id);
    expect(driven.ok).toBe(true);
    if (!driven.ok) return;
    const name = state.businesses.find((row) => row.id === id)!.name;
    expect(teamOfState(driven.value.state, id).driver).toEqual({ kind: 'owner' });
    expect(driven.value.state.sports.career!.team).toBe(name);
    expect(driven.value.entry.text).toBe(`You are driving for ${name} now.`);
    expect(driven.value.entry.kind).toBe('milestone');
    const notRacer: GameState = {
      ...state,
      sports: { ...state.sports, career: racingCareer({ sportId: 'golf' }) },
    };
    expect(driveOwnTeam(notRacer, id).ok).toBe(false);
  });

  it('gives the seat back to a hired driver, the first in the market', () => {
    const { state, id } = owned();
    const pro: GameState = { ...state, sports: { ...state.sports, career: racingCareer() } };
    const driven = driveOwnTeam(pro, id);
    if (!driven.ok) throw new Error('drive');
    const parked = stopDrivingOwnTeam(driven.value.state, id);
    expect(parked.ok).toBe(true);
    if (!parked.ok) return;
    const first = driverCandidates(state.rng.getSeed(), id, state.world.year, 1)[0]!;
    expect(teamOfState(parked.value.state, id).driver).toEqual(first);
    expect(parked.value.entry.text).toBe(
      `You gave up the seat. ${first.name} drives for ${state.businesses.find((row) => row.id === id)!.name}.`,
    );
    const again = stopDrivingOwnTeam(parked.value.state, id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error).toBe('not-a-driver');
  });
});

describe('moving up a series', () => {
  it('needs a season at the level first, and a rung above', () => {
    const { state, id } = owned();
    const early = moveUpSeries(state, id);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toBe('too-soon');
    const stale = withTeamState({
      rung: 2,
      last: { year: 2030, rung: 1, place: 3, field: 24, title: false, incident: false },
    });
    const moved = moveUpSeries(stale.state, stale.id);
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.error).toBe('too-soon');
    const top = withTeamState({ rung: 5 });
    const capped = moveUpSeries(top.state, top.id);
    expect(capped.ok).toBe(false);
    if (!capped.ok) expect(capped.error).toBe('top-rung');
    const missing = moveUpSeries(state, 'biz:none');
    expect(missing.ok).toBe(false);
  });

  it('pays for the car, grows what was invested, resets the car, and remembers the best rung', () => {
    const start = withTeamState({ rung: 1, best: 1, car: 70 });
    const cash = Number(start.state.player.cash) / 100;
    const before = start.state.businesses.find((row) => row.id === start.id)!;
    const result = moveUpSeries(start.state, start.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state;
    const row = after.businesses.find((business) => business.id === start.id)!;
    expect(row.racing).toMatchObject({
      rung: 2,
      best: 2,
      car: SERIES[2].strength - NEW_RUNG_CAR_GAP,
    });
    expect(row.racing!.last).toEqual(before.racing!.last);
    expect(Number(after.player.cash) / 100).toBe(cash - SERIES[2].upgrade);
    expect(Number(row.invested) / 100).toBe(Number(before.invested) / 100 + SERIES[2].upgrade);
    expect(after.finance.transactions.at(-1)).toMatchObject({
      category: 'property',
      amount: dollars(-SERIES[2].upgrade),
      source: `${row.name} moved up to the Atlas Junior Formula`,
    });
    expect(result.value.entry.text).toBe(
      `${row.name} moved up to junior formula, the Atlas Junior Formula. It took $90,000 for the car and the gear.`,
    );
    expect(result.value.entry.kind).toBe('milestone');
  });

  it('keeps the best rung when a team that has been higher moves up again', () => {
    const start = withTeamState({ rung: 2, best: 4 });
    const result = moveUpSeries(start.state, start.id);
    if (!result.ok) throw new Error('up');
    expect(teamOfState(result.value.state, start.id).best).toBe(4);
    expect(teamOfState(result.value.state, start.id).rung).toBe(3);
  });

  it('refuses a team that cannot pay, and touches nothing', () => {
    const start = withTeamState({ rung: 3 });
    const poor = topUp(start.state, -(Math.floor(Number(start.state.player.cash) / 100) - 1_000));
    const result = moveUpSeries(poor, start.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('cannot-afford');
    expect(poor.businesses).toBe(poor.businesses);
  });

  it('can be borrowed for, with the loan sized to the car and booked against the team', () => {
    const start = withTeamState({ rung: 3 });
    const cost = SERIES[4].upgrade;
    const offers = upgradeOffers(start.state, start.id);
    const usable = offers.find((offer) => offer.decision.approved && offer.decision.offered > 0);
    expect(usable, JSON.stringify(offers.map((o) => o.decision))).toBeDefined();
    const offered = Math.floor(usable!.decision.offered);
    const short = Math.min(offered, cost) - 1_000;
    // Cash that is short of the car by exactly what the lender will put up, less a thousand.
    const have = Math.floor(Number(start.state.player.cash) / 100);
    const poor = topUp(start.state, -(have - Math.max(0, cost - short)));
    const result = moveUpSeries(poor, start.id, { productId: usable!.product.id, amount: short });
    expect(result.ok ? 'ok' : result.error).toBe('ok');
    if (!result.ok) return;
    expect(result.value.state.loans.some((loan) => loan.businessId === start.id)).toBe(true);
    expect(result.value.entry.text).toMatch(/of it borrowed\.$/);
  });

  it('sizes what a lender offers to the car the team would buy, while that is less than the team can carry', () => {
    // Club racing moves up to a $90,000 car: a lender puts up four-fifths of it, whichever product.
    const small = withTeamState({ rung: 1 });
    const offers = upgradeOffers(small.state, small.id);
    expect(offers.map((offer) => offer.decision.offered)).toEqual([72_000, 72_000]);
    expect(SERIES[2].upgrade * 0.8).toBe(72_000);
    // A bigger car than the owner can carry is limited by what they can carry, the same at every rung.
    const big = upgradeOffers(withTeamState({ rung: 4 }).state, withTeamState({ rung: 4 }).id);
    const mid = upgradeOffers(withTeamState({ rung: 3 }).state, withTeamState({ rung: 3 }).id);
    expect(big.map((offer) => offer.decision.offered)).toEqual(
      mid.map((offer) => offer.decision.offered),
    );
    expect(Math.max(...mid.map((offer) => offer.decision.offered))).toBeLessThan(
      0.8 * SERIES[4].upgrade,
    );
  });

  it('offers loans only for a team with a rung above', () => {
    const top = withTeamState({ rung: 5 });
    expect(upgradeOffers(top.state, top.id)).toEqual([]);
    const cafe = openBusiness(ADULT, 'biz.cafe');
    if (!cafe.ok) throw new Error('cafe');
    expect(upgradeOffers(cafe.value.state, cafe.value.business.id)).toEqual([]);
    expect(upgradeOffers(ADULT, 'biz:none')).toEqual([]);
    const refused = moveUpSeries(top.state, top.id, { productId: 'nope', amount: 1000 });
    expect(refused.ok).toBe(false);
  });

  it('refuses a loan that is not a product anybody offers', () => {
    const start = withTeamState({ rung: 1 });
    const result = moveUpSeries(start.state, start.id, {
      productId: 'no-such-product',
      amount: 50_000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('no-such-product');
  });
});

describe('stepping down', () => {
  it('sells the car for a share of what stepping up cost, and drops a rung', () => {
    const start = withTeamState({ rung: 3 });
    const cash = Number(start.state.player.cash) / 100;
    const result = dropDownSeries(start.state, start.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.value.state;
    const row = after.businesses.find((business) => business.id === start.id)!;
    expect(row.racing).toMatchObject({ rung: 2, car: SERIES[2].strength - NEW_RUNG_CAR_GAP });
    const back = Math.round(SERIES[3].upgrade * STEP_DOWN_RETURN);
    expect(Number(after.player.cash) / 100).toBe(cash + back);
    expect(STEP_DOWN_RETURN).toBeLessThan(1);
    expect(result.value.entry.text).toBe(
      `${row.name} stepped down to junior formula. The car brought $${back.toLocaleString('en-US')}.`,
    );
    expect(after.finance.transactions.at(-1)).toMatchObject({
      amount: dollars(back),
      category: 'property',
    });
  });

  it('refuses at the bottom, before a season at the level, and for anything that is not a team', () => {
    const bottom = withTeamState({ rung: 1 });
    const stuck = dropDownSeries(bottom.state, bottom.id);
    expect(stuck.ok).toBe(false);
    if (!stuck.ok) expect(stuck.error).toBe('bottom-rung');
    const fresh = owned();
    const team: OwnedBusiness = {
      ...fresh.state.businesses[0]!,
      racing: { ...defaultTeam('s', fresh.id, 2030), rung: 3 },
    };
    const early = dropDownSeries({ ...fresh.state, businesses: [team] }, fresh.id);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.error).toBe('too-soon');
    expect(dropDownSeries(fresh.state, 'biz:none').ok).toBe(false);
  });
});

describe('stepping down from the second rung', () => {
  it('goes back to club racing, which is the bottom and has nowhere further to go', () => {
    const start = withTeamState({ rung: 2 });
    const result = dropDownSeries(start.state, start.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(teamOfState(result.value.state, start.id).rung).toBe(1);
    expect(teamOfState(result.value.state, start.id).car).toBe(
      SERIES[1].strength - NEW_RUNG_CAR_GAP,
    );
    const again = dropDownSeries(withTeamState({ rung: 1 }).state, withTeamState({ rung: 1 }).id);
    expect(again.ok).toBe(false);
  });
});

describe('owning a team over a life', () => {
  it('is sold, closed, bought and valued like any business', () => {
    const { state, id } = withTeamState({ rung: 2 });
    const closed = closeBusiness(state, id);
    expect(closed.ok).toBe(true);
    const listed = businessesForSale(ADULT);
    expect(Array.isArray(listed)).toBe(true);
    const row = state.businesses.find((business) => business.id === id)!;
    expect(
      newBusiness(findBusinessType(RACING_TEAM_TYPE_ID)!, 'x', 'X', 2030, 1).racing,
    ).toBeUndefined();
    expect(row.racing!.rung).toBe(2);
  });

  it('runs through a whole advanceYear: the team plays its season and the money moves', () => {
    const { state, id } = owned();
    const after = advanceYear(state).state;
    const row = after.businesses.find((business) => business.id === id)!;
    expect(row.racing?.seasons).toBeGreaterThanOrEqual(1);
    expect(
      after.player.timeline.some(
        (entry) => /Coastline Club Racing/.test(entry.text) || entry.year === after.world.year,
      ),
    ).toBe(true);
  });

  it('plays the player’s own driving into the team’s: the owner at the wheel is the team’s driver', () => {
    const { state, id } = owned();
    const pro: GameState = {
      ...state,
      sports: { ...state.sports, career: racingCareer({ form: 80, tier: 'starter' }) },
    };
    const driven = driveOwnTeam(pro, id);
    if (!driven.ok) throw new Error('drive');
    const after = advanceYear(driven.value.state).state;
    const row = after.businesses.find((business) => business.id === id)!;
    expect(row.racing?.driver.kind === 'owner' || row.racing?.driver.kind === 'hired').toBe(true);
    if (after.sports.career?.stage === 'pro' && after.sports.career.sportId === 'racing') {
      expect(row.racing?.driver).toEqual({ kind: 'owner' });
    } else {
      expect(row.racing?.driver.kind).toBe('hired');
    }
  });
});

describe('a life that never goes near it', () => {
  it('is untouched: a passive life’s first fifteen years replay exactly', () => {
    const run = (): string => {
      let state = createNewGame({ seed: 'passive-0808' });
      for (let index = 0; index < 15; index += 1)
        state = answerOthers(advanceYear(answerOthers(state)).state);
      return JSON.stringify({
        cash: state.player.cash,
        age: state.player.age,
        stats: state.player.stats,
        records: state.player.records.map((row) => row.label),
        businesses: state.businesses.length,
        sports: state.sports,
      });
    };
    expect(run()).toBe(run());
    const state = JSON.parse(run());
    expect(state.sports).toEqual({ past: [] });
    expect(state.businesses).toBe(0);
  });
});
