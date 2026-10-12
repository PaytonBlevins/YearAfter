/**
 * Ticket 0801 acceptance tests — the sports engine, with basketball.
 *
 * The odds are tested twice: the arithmetic on its own (the two filters multiply back to the answer
 * a player gave), and in the game, over lives played by a player who makes the team and either puts
 * the work in or does not. Every life here is a deterministic function of its seed.
 */

import { describe, expect, it } from 'vitest';
import {
  BECOME_STAR,
  REACH_PROS,
  TEAM_SPORTS,
  TIERS,
  categoryOf,
  draftChance,
  draftPickFor,
  findSport,
  isHardWorker,
  peakTierFor,
  recruitChance,
  rookiePay,
  sportOfActivity,
  stepTier,
  type SportCategory,
} from '@yearafter/content';
import { findMajor } from '@yearafter/education';
import { outOfPocket } from './college';
import { withAnyOffer } from './offers';
import { advanceYear } from './advance';
import { decide } from './decide';
import { createNewGame } from './new-game';
import { hasSystemicOffer, type GameState } from './game-state';
import { tryOut } from './tryout';
import { practise } from './practice';
import {
  ACCEPT,
  DECLINE,
  REQUEST_MORE,
  SPORTS_OFFER_EVENT_ID,
  careerOf,
  isPlaying,
  runSportsYear,
  sportsOfferDecision,
  skillsOf,
  sportUnit,
  sportsAidOf,
  sportsFameOf,
  trainSport,
  tierAt,
} from './sports';
import { EMPTY_SPORTS, type SportsOffer } from './sports-state';

const CATEGORIES: readonly SportCategory[] = ['talentAndWork', 'talentOnly', 'workOnly', 'neither'];
const BASKETBALL = 'act.basketball';

/** Answer every pending question except the sport's own, with the first answer. */
function answerOthers(state: GameState): GameState {
  let current = state;
  let guard = 0;
  while ((guard += 1) < 12) {
    const open = current.pending.find((row) => row.eventId !== SPORTS_OFFER_EVENT_ID);
    const choice = open?.choices[0];
    if (!open || !choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

/** A life that tries out for the basketball team each year from twelve, and works at it or does not. */
function schoolLife(seed: string, work: boolean, until = 18): GameState {
  return schoolLifeInfo(seed, work, until).state;
}

function schoolLifeInfo(
  seed: string,
  work: boolean,
  until = 18,
): { readonly state: GameState; readonly onTeam: boolean } {
  let state = createNewGame({ seed });
  let onTeam = false;
  while (state.player.alive && state.player.age < until && state.sports.offer === undefined) {
    state = answerOthers(advanceYear(state).state);
    if (state.sports.offer !== undefined) {
      onTeam = true;
      break;
    }
    if (state.player.age >= 12 && state.player.age <= 17) {
      const made = tryOut(state, BASKETBALL);
      if (made.ok) state = made.value.state;
      if (work) {
        for (let session = 0; session < 3; session += 1) {
          const practised = practise(state, BASKETBALL);
          if (practised.ok) state = practised.value.state;
        }
      }
      if (
        state.player.age === 17 &&
        state.education.activities.some((row) => row.activityId === BASKETBALL)
      ) {
        onTeam = true;
      }
    }
  }
  return { state, onTeam };
}

/** Answer the sport's question, and fail loudly if it was not there. */
function answerSports(state: GameState, choice: string): GameState {
  const result = decide(state, SPORTS_OFFER_EVENT_ID, choice);
  if (!result.ok) throw new Error(`sports answer ${choice} failed: ${result.error}`);
  return result.value.state;
}

/** Play on, taking the first answer to everything and the sport's offers as given, until the test says stop. */
function playOn(
  state: GameState,
  stop: (state: GameState) => boolean,
  options: { readonly years?: number; readonly choice?: string; readonly train?: boolean } = {},
): GameState {
  let current = state;
  const years = options.years ?? 40;
  for (let year = 0; year < years && current.player.alive; year += 1) {
    if (stop(current)) return current;
    if (current.sports.offer) {
      current = answerSports(current, options.choice ?? ACCEPT);
    }
    current = answerOthers(current);
    if (options.train && isPlaying(current.sports.career)) {
      for (let session = 0; session < 3; session += 1) {
        const trained = trainSport(current);
        if (trained.ok) current = trained.value.state;
      }
    }
    current = advanceYear(current).state;
  }
  return current;
}

/** The first life, by seed, that is offered a scholarship, for the tests that need one. */
function recruited(work = true): GameState {
  for (let index = 0; index < 400; index += 1) {
    const state = schoolLife(`sports-${work ? 'w' : 'i'}-${index}`, work);
    if (state.sports.offer?.kind === 'scholarship') return state;
  }
  throw new Error('no life was recruited in 400 seeds');
}

/**
 * The first life whose scholarship covers only part of the tuition, and whose parents cannot make up
 * the rest, so that the program has to (a fixture that cannot reach the branch proves nothing).
 */
const recruitedPartial = (): GameState =>
  once('partial', () => {
    for (let index = 0; index < 900; index += 1) {
      const state = schoolLife(`sports-w-${index}`, true);
      const offer = state.sports.offer;
      if (offer?.kind !== 'scholarship' || offer.cover !== 'partial') continue;
      const tuition = findMajor(offer.majorId)!.tuition;
      const cash = Math.floor(Number(state.player.cash) / 100);
      if (tuition - (state.parenting.collegeSupport ?? 0) - offer.aid > cash) return state;
    }
    throw new Error('no life needed a partial scholarship made up');
  });

const cache = new Map<string, GameState>();
const once = (key: string, build: () => GameState): GameState => {
  const found = cache.get(key);
  if (found) return found;
  const built = build();
  cache.set(key, built);
  return built;
};

/** A recruited life that took the scholarship and was drafted, waiting on its first contract. */
const drafted = (): GameState =>
  once('drafted', () => {
    for (let index = 0; index < 400; index += 1) {
      const start = schoolLife(`sports-w-${index}`, true);
      if (start.sports.offer?.kind !== 'scholarship') continue;
      const end = playOn(
        start,
        (state) => state.sports.offer?.kind === 'contract' || state.sports.past.length > 0,
        { train: true },
      );
      if (end.sports.offer?.kind === 'contract') return end;
    }
    throw new Error('no life was drafted');
  });

/** A career that won at least one title, played to its end. */
const titled = (): GameState =>
  once('titled', () => {
    for (let index = 0; index < 400; index += 1) {
      const start = schoolLife(`sports-w-${index}`, true);
      if (start.sports.offer?.kind !== 'scholarship') continue;
      const end = playOn(start, (state) => state.sports.past.length > 0, { train: true });
      if ((end.sports.past[0]?.titles ?? 0) > 0) return end;
    }
    throw new Error('no career won a title');
  });

/** A pro, one year into the first contract. */
const pro = (): GameState =>
  once('pro', () => {
    const signed = answerSports(drafted(), ACCEPT);
    return advanceYear(answerOthers(signed)).state;
  });

describe('the arithmetic of the odds', () => {
  it('multiplies the two filters back to the answer a player gave, for every category', () => {
    for (const category of CATEGORIES) {
      expect(recruitChance(category) * draftChance(category)).toBeCloseTo(REACH_PROS[category], 10);
    }
  });

  it('holds the table as Payton gave it: 95, 75 and 60 percent, and about 3 for neither', () => {
    expect(REACH_PROS).toEqual({
      talentAndWork: 0.95,
      talentOnly: 0.75,
      workOnly: 0.6,
      neither: 0.03,
    });
    expect(BECOME_STAR.talentAndWork).toBe(0.45);
    expect(BECOME_STAR.talentOnly).toBe(0.2);
    expect(BECOME_STAR.workOnly).toBe(0.1);
  });

  it('leaves the draft the harder door', () => {
    for (const category of CATEGORIES) {
      expect(draftChance(category)).toBeLessThanOrEqual(recruitChance(category));
    }
  });

  it('names a category from talent and effort and nothing else', () => {
    expect(categoryOf(true, true)).toBe('talentAndWork');
    expect(categoryOf(true, false)).toBe('talentOnly');
    expect(categoryOf(false, true)).toBe('workOnly');
    expect(categoryOf(false, false)).toBe('neither');
  });

  it('calls somebody a hard worker only when half their seasons had practice, and at least one did', () => {
    expect(isHardWorker(4, 0)).toBe(false);
    expect(isHardWorker(4, 1)).toBe(false);
    expect(isHardWorker(4, 2)).toBe(true);
    expect(isHardWorker(1, 1)).toBe(true);
    expect(isHardWorker(0, 0)).toBe(false);
  });

  it('turns the star share of each category into stars, and a quarter of stars into superstars', () => {
    for (const category of CATEGORIES) {
      let stars = 0;
      let superstars = 0;
      const steps = 2000;
      for (let index = 0; index < steps; index += 1) {
        const peak = peakTierFor(category, index / steps, 0.5);
        if (peak === 'star' || peak === 'superstar') stars += 1;
        if (peak === 'superstar') superstars += 1;
      }
      expect(stars / steps).toBeCloseTo(BECOME_STAR[category], 2);
      void superstars;
    }
    let superstars = 0;
    for (let index = 0; index < 1000; index += 1) {
      if (peakTierFor('talentAndWork', 0, index / 1000) === 'superstar') superstars += 1;
    }
    expect(superstars / 1000).toBeCloseTo(0.25, 2);
  });

  it('pays a rookie by where they were picked, from a real-world floor at the bottom', () => {
    expect(rookiePay(1)).toBeGreaterThan(rookiePay(15));
    expect(rookiePay(15)).toBeGreaterThan(rookiePay(30));
    expect(rookiePay(31)).toBe(rookiePay(60));
    expect(rookiePay(60)).toBeGreaterThanOrEqual(1_272_870);
    expect(draftPickFor('superstar', 0)).toBeLessThanOrEqual(8);
    expect(draftPickFor('fringe', 0.999)).toBeLessThanOrEqual(60);
  });

  it('steps tiers inside the ladder', () => {
    expect(stepTier('fringe', -1)).toBe('fringe');
    expect(stepTier('superstar', 1)).toBe('superstar');
    expect(stepTier('role', 2)).toBe('star');
    expect(TIERS).toHaveLength(5);
  });

  it('is basketball first, and a sport is a row of data', () => {
    expect(TEAM_SPORTS.map((sport) => sport.id)).toEqual([
      'basketball',
      'football',
      'baseball',
      'soccer',
      'hockey',
    ]);
    expect(findSport('basketball')?.activityId).toBe(BASKETBALL);
    expect(sportOfActivity(BASKETBALL)?.id).toBe('basketball');
    expect(sportOfActivity('act.chess')).toBeUndefined();
    const basketball = findSport('basketball')!;
    expect(basketball.proTeams.length).toBeGreaterThanOrEqual(24);
    expect(new Set(basketball.proTeams).size).toBe(basketball.proTeams.length);
    expect(new Set(basketball.collegeTeams).size).toBe(basketball.collegeTeams.length);
  });
});

describe('a life with no team', () => {
  it('has no sporting life at all, and nothing about it changes the books or the header', () => {
    let state = createNewGame({ seed: 'no-team-1' });
    for (let year = 0; year < 30 && state.player.alive; year += 1) {
      state = answerOthers(advanceYear(state).state);
      expect(state.sports.offer).toBeUndefined();
    }
    expect(state.sports.past).toEqual([]);
    expect(careerOf(state)).toBeUndefined();
    expect(state.finance.transactions.some((row) => row.source.startsWith('Playing'))).toBe(false);
  });

  it('starts empty', () => {
    expect(createNewGame({ seed: 'empty-1' }).sports).toEqual(EMPTY_SPORTS);
  });
});

describe('a school team, and graduating from it', () => {
  it('tracks seasons and effort while on the team', () => {
    let state = createNewGame({ seed: 'track-1' });
    while (state.player.alive && state.player.age < 12)
      state = answerOthers(advanceYear(state).state);
    for (let age = 12; age < 17; age += 1) {
      const made = tryOut(state, BASKETBALL);
      if (made.ok) state = made.value.state;
      if (state.education.activities.some((row) => row.activityId === BASKETBALL)) break;
      state = answerOthers(advanceYear(state).state);
    }
    if (!state.education.activities.some((row) => row.activityId === BASKETBALL)) return;
    for (let session = 0; session < 3; session += 1) {
      const practised = practise(state, BASKETBALL);
      if (practised.ok) state = practised.value.state;
    }
    state = answerOthers(advanceYear(state).state);
    const career = careerOf(state);
    expect(career?.stage).toBe('school');
    expect(career?.seasons).toBe(1);
    expect(career?.hardSeasons).toBe(1);
  });

  it('does not count a season as hard work on a single session of practice', () => {
    let state = createNewGame({ seed: 'track-2' });
    while (state.player.alive && state.player.age < 12)
      state = answerOthers(advanceYear(state).state);
    for (
      let age = 12;
      age < 17 && !state.education.activities.some((row) => row.activityId === BASKETBALL);
      age += 1
    ) {
      const made = tryOut(state, BASKETBALL);
      if (made.ok) state = made.value.state;
      if (!state.education.activities.some((row) => row.activityId === BASKETBALL)) {
        state = answerOthers(advanceYear(state).state);
      }
    }
    if (!state.education.activities.some((row) => row.activityId === BASKETBALL)) return;
    const once = practise(state, BASKETBALL);
    if (once.ok) state = once.value.state;
    state = answerOthers(advanceYear(state).state);
    expect(careerOf(state)?.seasons).toBe(1);
    expect(careerOf(state)?.hardSeasons).toBe(0);
  });

  it('makes up the rest of a partial scholarship rather than let an eighteen-year-old with nothing lose it', () => {
    const start = recruitedPartial();
    const offer = start.sports.offer!;
    if (offer.kind !== 'scholarship') throw new Error('expected a scholarship');
    const tuition = findMajor(offer.majorId)!.tuition;
    const parents = start.parenting.collegeSupport ?? 0;
    const cash = Math.floor(Number(start.player.cash) / 100);
    const taken = answerSports(start, ACCEPT);
    // Not enough on its own (the fixture is chosen so), so the program finds the difference.
    expect(tuition - parents - offer.aid).toBeGreaterThan(cash);
    expect(taken.education.stage).toBe('college');
    expect(careerOf(taken)!.aid).toBe(tuition);
    expect(outOfPocket(taken, findMajor(offer.majorId)!)).toBeLessThanOrEqual(cash);
  });

  it('asks about a scholarship when a player on the team graduates, as a question that stops time', () => {
    const state = recruited();
    const offer = state.sports.offer!;
    expect(offer.kind).toBe('scholarship');
    expect(hasSystemicOffer(state)).toBe(true);
    const question = state.pending.find((row) => row.eventId === SPORTS_OFFER_EVENT_ID)!;
    expect(question.choices.map((choice) => choice.id)).toEqual([ACCEPT, DECLINE]);
    // A full ride goes to a player who is already good; the rest get part of it.
    if (offer.kind !== 'scholarship') throw new Error('expected a scholarship');
    expect(question.prompt).toContain(offer.team);
    expect(offer.cover).toBe(careerOf(state)!.form >= 62 ? 'full' : 'partial');
    // Time does not pass on an unanswered question.
    expect(advanceYear(state).state).toBe(state);
  });

  it('does not ask the generic college question in the same year', () => {
    const state = recruited();
    expect(state.collegeOffer).toBeUndefined();
    expect(state.pending.filter((row) => row.eventId === 'education.offer')).toHaveLength(0);
  });

  it('takes a scholarship into college, on the team, with aid towards the tuition', () => {
    const start = recruited();
    const offer = start.sports.offer!;
    if (offer.kind !== 'scholarship') throw new Error('expected a scholarship');
    const state = answerSports(start, ACCEPT);
    expect(state.education.stage).toBe('college');
    expect(state.education.majorId).toBe(offer.majorId);
    const career = careerOf(state)!;
    expect(career.stage).toBe('college');
    expect(career.team).toBe(offer.team);
    expect(career.aid).toBeGreaterThanOrEqual(offer.aid);
    expect(sportsAidOf(state)).toBe(career.aid);
    expect(state.sports.offer).toBeUndefined();
    expect(state.pending.some((row) => row.eventId === SPORTS_OFFER_EVENT_ID)).toBe(false);
    expect(state.player.records.some((row) => row.label.includes('scholarship'))).toBe(true);
  });

  it('charges tuition net of the scholarship, and it is what keeps a cashless eighteen-year-old in college', () => {
    const start = recruited();
    const offer = start.sports.offer!;
    if (offer.kind !== 'scholarship') throw new Error('expected a scholarship');
    const taken = answerSports(start, ACCEPT);
    const tuition = findMajor(offer.majorId)!.tuition;
    const aid = sportsAidOf(taken);
    const parents = taken.parenting.collegeSupport ?? 0;
    const cash = Math.floor(Number(taken.player.cash) / 100);
    const tuitionPaid = (state: GameState): number =>
      state.finance.transactions
        .filter((row) => row.category === 'tuition' && row.year === state.world.year)
        .reduce((sum, row) => sum - Number(row.amount) / 100, 0);
    // The affordability gate reads the same aid the year's bill does.
    expect(outOfPocket(taken, findMajor(offer.majorId)!)).toBe(
      Math.max(0, tuition - parents - aid),
    );
    const withAid = advanceYear(answerOthers(taken)).state;
    expect(tuitionPaid(withAid)).toBe(Math.max(0, tuition - parents - aid));
    expect(withAid.education.stage).toBe('college');
    // The same life without the scholarship cannot cover the year, and leaves.
    const owed = Math.max(0, tuition - parents);
    if (owed > cash) {
      const bare: GameState = {
        ...taken,
        sports: { ...taken.sports, career: { ...careerOf(taken)!, aid: 0 } },
      };
      expect(advanceYear(answerOthers(bare)).state.education.stage).not.toBe('college');
    }
  });

  it('lets a player turn it down, and nothing of the sport is kept but the school seasons', () => {
    const state = answerSports(recruited(), DECLINE);
    expect(state.sports.career).toBeUndefined();
    expect(state.sports.past).toEqual([]);
    expect(state.education.stage).not.toBe('college');
    expect(state.pending.some((row) => row.eventId === SPORTS_OFFER_EVENT_ID)).toBe(false);
    expect(state.player.timeline.some((row) => row.text.includes('Turned down'))).toBe(true);
  });

  it('lets a school career lapse when the player is no longer on the team, without a record of one', () => {
    const base = recruited();
    const { offer: _spent, ...rest } = base.sports;
    const before: GameState = {
      ...base,
      sports: rest,
      education: { ...base.education, activities: [], stage: 'high' },
    };
    expect(careerOf(before)?.stage).toBe('school');
    const year = runSportsYear({
      before,
      education: before.education,
      age: before.player.age + 1,
      year: before.world.year + 1,
    });
    expect(year.sports.career).toBeUndefined();
    expect(year.sports.past).toEqual([]);
    expect(year.pay).toBe(0);
  });

  it('shows no sport skills on a school team: they belong to college and the pros (spec 9 and 343)', () => {
    const state = recruited();
    expect(careerOf(state)?.stage).toBe('school');
    expect(skillsOf(state)).toEqual([]);
  });

  it('refuses an answer that is not one of the choices', () => {
    const state = recruited();
    expect(decide(state, SPORTS_OFFER_EVENT_ID, REQUEST_MORE).ok).toBe(false);
    expect(decide(state, SPORTS_OFFER_EVENT_ID, 'lunch').ok).toBe(false);
  });
});

describe('college, the draft and a first contract', () => {
  it('plays college seasons on the scholarship and ends at the draft', () => {
    const state = drafted();
    const offer = state.sports.offer!;
    expect(offer.kind).toBe('contract');
    if (offer.kind !== 'contract') return;
    expect(offer.rookie).toBe(true);
    expect(offer.pick).toBeGreaterThanOrEqual(1);
    expect(offer.pick).toBeLessThanOrEqual(60);
    expect(offer.salary).toBe(rookiePay(offer.pick!));
    expect(careerOf(state)?.stage).toBe('college');
    expect(careerOf(state)?.collegeSeasons).toBeGreaterThanOrEqual(1);
    expect(sportsAidOf(state)).toBeGreaterThanOrEqual(0);
  });

  it('offers Accept, Ask for more and Turn it down on a first contract (spec 289)', () => {
    const question = drafted().pending.find((row) => row.eventId === SPORTS_OFFER_EVENT_ID)!;
    expect(question.choices.map((choice) => choice.id)).toEqual([ACCEPT, REQUEST_MORE, DECLINE]);
  });

  it('lets the player ask for more once, and then it is Accept or Decline', () => {
    const before = drafted();
    const offer = before.sports.offer!;
    if (offer.kind !== 'contract') throw new Error('expected a contract');
    const asked = answerSports(before, REQUEST_MORE);
    const next = asked.sports.offer!;
    if (next.kind !== 'contract') throw new Error('expected a contract');
    expect(next.asked).toBe(true);
    expect(next.salary).toBeGreaterThanOrEqual(offer.salary);
    expect(next.team).toBe(offer.team);
    const question = asked.pending.filter((row) => row.eventId === SPORTS_OFFER_EVENT_ID);
    expect(question).toHaveLength(1);
    expect(question[0]!.choices.map((choice) => choice.id)).toEqual([ACCEPT, DECLINE]);
    expect(decide(asked, SPORTS_OFFER_EVENT_ID, REQUEST_MORE).ok).toBe(false);
  });

  it('signs a contract, and the career is a professional one from then on', () => {
    const before = drafted();
    const offer = before.sports.offer!;
    if (offer.kind !== 'contract') throw new Error('expected a contract');
    const state = answerSports(before, ACCEPT);
    const career = careerOf(state)!;
    expect(career.stage).toBe('pro');
    expect(career.team).toBe(offer.team);
    expect(career.contract).toEqual({ salary: offer.salary, yearsLeft: offer.years, rookie: true });
    expect(state.player.records.some((row) => row.label.startsWith('Drafted by'))).toBe(true);
    expect(state.sports.offer).toBeUndefined();
  });

  it('ends any job they held when they sign, because a first contract is a full-time one', () => {
    const before = drafted();
    const job = before.employment.job ?? {
      jobId: 'job.teaching-assistant',
      since: before.player.age - 1,
      performance: 50,
    };
    const held: GameState = { ...before, employment: { ...before.employment, job: job as never } };
    const signed = answerSports(held, ACCEPT);
    expect(signed.employment.job).toBeUndefined();
    expect(signed.employment.history.at(-1)?.because).toBe('resigned');
    // And somebody with no job is left alone.
    const idle: GameState = { ...before, employment: { ...before.employment, job: undefined } };
    expect(answerSports(idle, ACCEPT).employment.history).toEqual(idle.employment.history);
  });

  it('ends the career if the first contract is turned down, and keeps a record of it', () => {
    const state = answerSports(drafted(), DECLINE);
    expect(state.sports.career).toBeUndefined();
    expect(state.sports.past).toHaveLength(1);
    expect(state.sports.past[0]!.how).toBe('declined');
    expect(state.sports.past[0]!.reached).toBe('college');
    expect(state.sports.past[0]!.bestTier).toBeUndefined();
  });
});

describe('the pros', () => {
  it('pays a salary, taxes it, and posts both to the ledger as ordinary pay', () => {
    const state = pro();
    const year = state.world.year;
    const rows = state.finance.transactions.filter((row) => row.year === year);
    const pay = rows.filter(
      (row) => row.category === 'salary' && row.source.startsWith('Playing for'),
    );
    expect(pay).toHaveLength(1);
    const career = careerOf(state)!;
    expect(Number(pay[0]!.amount) / 100).toBe(career.contract!.salary);
    const tax = rows.filter((row) => row.category === 'tax' && row.source === 'Tax on playing pay');
    expect(tax).toHaveLength(1);
    expect(Number(tax[0]!.amount)).toBeLessThan(0);
    // Never more than half of it, and more than nothing.
    expect(-Number(tax[0]!.amount)).toBeLessThan(Number(pay[0]!.amount) * 0.5);
  });

  it('makes a pro known, and a rookie less known than a star', () => {
    const state = pro();
    const career = careerOf(state)!;
    expect(state.fame).toBeGreaterThanOrEqual(sportsFameOf(career));
    expect(sportsFameOf({ ...career, tier: 'fringe', titles: 0 })).toBeLessThan(
      sportsFameOf({ ...career, tier: 'star', titles: 0 }),
    );
    expect(sportsFameOf({ ...career, tier: 'star', titles: 0 })).toBeLessThan(
      sportsFameOf({ ...career, tier: 'superstar', titles: 0 }),
    );
    expect(sportsFameOf({ ...career, tier: 'superstar', titles: 40 })).toBeLessThanOrEqual(100);
    // A title is worth a little more fame for as long as the career lasts, up to a point.
    expect(sportsFameOf({ ...career, tier: 'starter', titles: 2 })).toBeGreaterThan(
      sportsFameOf({ ...career, tier: 'starter', titles: 0 }),
    );
    expect(
      sportsFameOf({ ...career, tier: 'starter', titles: 30 }) -
        sportsFameOf({ ...career, tier: 'starter', titles: 0 }),
    ).toBe(15);
    expect(sportsFameOf(undefined)).toBe(0);
    expect(sportsFameOf({ ...career, stage: 'college' })).toBe(0);
  });

  it('names what they do for a living in the header', () => {
    expect(pro().player.occupation).toBe('Professional basketball player');
  });

  it('does not offer a job to somebody who plays for a living', () => {
    let state = pro();
    for (let year = 0; year < 3 && careerOf(state)?.stage === 'pro'; year += 1) {
      state = answerOthers(advanceYear(state).state);
      if (state.sports.offer) state = answerSports(state, ACCEPT);
      expect(state.offer).toBeUndefined();
    }
  });

  it('raises no job offer for somebody who plays, however many times the door is tried', () => {
    const state = pro();
    // The year education ends is the one certain trigger for a first offer, so it is the fixture that
    // proves the guard: the same life with no career is offered a job, and the pro is not.
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
    const certain: GameState = {
      ...clear,
      pending: [],
      employment: { ...state.employment, job: undefined },
      education: { ...state.education, finishedAtAge: state.player.age },
    };
    const { career: _playing, ...rest } = certain.sports;
    const idle: GameState = { ...certain, sports: rest };
    expect(withAnyOffer(idle, true).offer).toBeDefined();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const tried = withAnyOffer(
        { ...certain, world: { ...certain.world, year: certain.world.year + attempt } },
        true,
      );
      expect(tried.offer).toBeUndefined();
    }
  });

  it('shows skills only while playing (spec 9 and 343), and not after', () => {
    const state = pro();
    const skills = skillsOf(state);
    expect(skills.map((skill) => skill.name)).toEqual(
      findSport('basketball')!.skills.map((s) => s.name),
    );
    for (const skill of skills) {
      expect(skill.value).toBeGreaterThanOrEqual(0);
      expect(skill.value).toBeLessThanOrEqual(100);
    }
    expect(skillsOf(createNewGame({ seed: 'no-skills' }))).toEqual([]);
    const retired = playOn(state, (current) => current.sports.career === undefined);
    expect(skillsOf(retired)).toEqual([]);
  });

  it('puts in a session of training, three a year, and only while playing', () => {
    const state = pro();
    const first = trainSport(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(careerOf(first.value.state)!.form).toBeGreaterThanOrEqual(careerOf(state)!.form);
    let current = first.value.state;
    for (let session = 1; session < 3; session += 1) {
      const next = trainSport(current);
      expect(next.ok).toBe(true);
      if (next.ok) current = next.value.state;
    }
    const fourth = trainSport(current);
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.error).toBe('no-sessions-left');
    const none = trainSport(createNewGame({ seed: 'no-train' }));
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toBe('not-playing');
  });

  it('puts every title on the record, at an age a pro can be', () => {
    const state = titled();
    const titles = state.sports.past[0]!.titles;
    const records = state.player.records.filter((row) => row.label.startsWith('Won the '));
    expect(records).toHaveLength(titles);
    for (const record of records) expect(record.age).toBeGreaterThanOrEqual(23);
  });

  it('runs out: a contract comes up for renewal, and a career retires', () => {
    const start = pro();
    let sawResign = false;
    let state = start;
    for (let year = 0; year < 40 && state.player.alive; year += 1) {
      if (state.sports.offer?.kind === 'contract' && !state.sports.offer.rookie) {
        sawResign = true;
        const question = state.pending.find((row) => row.eventId === SPORTS_OFFER_EVENT_ID)!;
        expect(question.choices.map((choice) => choice.id)).toContain(REQUEST_MORE);
        expect(question.prompt).toContain('contract is up');
      }
      if (state.sports.offer) state = answerSports(state, ACCEPT);
      state = answerOthers(state);
      if (state.sports.past.length > 0) break;
      state = advanceYear(state).state;
    }
    expect(sawResign).toBe(true);
    const done = state.sports.past[0]!;
    expect(done.reached).toBe('pro');
    expect(['retired', 'injury']).toContain(done.how);
    expect(done.seasons).toBeGreaterThan(0);
    expect(state.sports.career).toBeUndefined();
    // Every title is a record a life is remembered by.
    expect(state.player.records.filter((row) => row.label.startsWith('Won the ')).length).toBe(
      done.titles,
    );
    // Fame fades rather than vanishing, and the header goes back to what they are.
    expect(state.player.occupation).not.toBe('Professional basketball player');
  });

  it('lets a fringe player who turns down a renewal find nobody calling', () => {
    const base = pro();
    const career = careerOf(base)!;
    const fringe = { ...career, tier: 'fringe' as const, peak: 'fringe' as const };
    const offer: SportsOffer = {
      kind: 'contract',
      sportId: 'basketball',
      team: career.team!,
      salary: 1_300_000,
      years: 2,
      rookie: false,
      asked: false,
      age: base.player.age,
      eventId: SPORTS_OFFER_EVENT_ID,
    };
    const state: GameState = {
      ...base,
      sports: { ...base.sports, career: fringe, offer },
      pending: [sportsOfferDecision(offer, base.world.year)],
    };
    const left = answerSports(state, DECLINE);
    expect(left.sports.career).toBeUndefined();
    expect(left.sports.past.at(-1)!.how).toBe('unsigned');
    expect(left.sports.past.at(-1)!.reached).toBe('pro');
  });

  it('comes up when asked about a third of the time, not always and not never', () => {
    const base = drafted();
    const offer = base.sports.offer!;
    if (offer.kind !== 'contract') throw new Error('expected a contract');
    let up = 0;
    const tries = 300;
    for (let index = 0; index < tries; index += 1) {
      const varied: SportsOffer = { ...offer, salary: offer.salary + index * 10_000 };
      const state: GameState = {
        ...base,
        sports: { ...base.sports, offer: varied },
        pending: [sportsOfferDecision(varied, base.world.year)],
      };
      const asked = answerSports(state, REQUEST_MORE).sports.offer;
      if (asked?.kind === 'contract' && asked.salary > varied.salary) up += 1;
    }
    expect(up / tries).toBeGreaterThan(0.12);
    expect(up / tries).toBeLessThan(0.7);
  });

  it('lets a free agent walk, to another team at about the same money', () => {
    let state = pro();
    for (let year = 0; year < 40 && state.player.alive; year += 1) {
      if (state.sports.offer?.kind === 'contract' && !state.sports.offer.rookie) {
        const tier = careerOf(state)!.tier!;
        if (tier === 'fringe') break;
        const offer = state.sports.offer;
        const left = answerSports(state, DECLINE);
        const career = careerOf(left)!;
        expect(career.team).not.toBe(offer.team);
        expect(career.stage).toBe('pro');
        expect(career.contract!.salary).toBeGreaterThan(offer.salary * 0.85);
        expect(career.contract!.salary).toBeLessThan(offer.salary * 1.15);
        return;
      }
      if (state.sports.offer) state = answerSports(state, ACCEPT);
      state = answerOthers(state);
      if (state.sports.past.length > 0) return;
      state = advanceYear(state).state;
    }
  });
});

describe('a season in the pros', () => {
  let titlesWhileHurt = 0;
  /** The same pro, put through four hundred different seasons: the world's year keys every draw. */
  function seasons(
    tier: 'fringe' | 'starter' | 'superstar',
    count = 400,
  ): {
    readonly lines: readonly string[];
    readonly titles: number;
    readonly ended: number;
  } {
    const base = pro();
    const career = careerOf(base)!;
    let titles = 0;
    let ended = 0;
    titlesWhileHurt = 0;
    const lines: string[] = [];
    for (let attempt = 0; attempt < count; attempt += 1) {
      const before: GameState = {
        ...base,
        world: { ...base.world, year: 3000 + attempt },
        sports: {
          ...base.sports,
          career: {
            ...career,
            tier,
            peak: tier,
            breakout: 1,
            endAge: 99,
            contract: { salary: 5_000_000, yearsLeft: 5, rookie: false },
          },
        },
      };
      const year = runSportsYear({
        before,
        education: before.education,
        age: before.player.age + 1,
        year: 3001 + attempt,
      });
      for (const line of year.lines) lines.push(line.text);
      const won = year.records.some((row) => row.category === 'championship');
      const missedSeason = year.lines.some((line) =>
        /Tore|broken foot|Surgery|ended your/i.test(line.text),
      );
      if (won && missedSeason) titlesWhileHurt += 1;
      if (won) titles += 1;
      if (year.sports.past.length > 0) ended += 1;
    }
    return { lines, titles, ended };
  }

  it('is hurt in about one season in eight, rarely badly, and almost never for good', () => {
    const { lines, ended } = seasons('starter');
    const hurt = lines.filter((text) =>
      /ankle|knee|shoulder|season in|Surgery|foot|Tore|ended your/i.test(text),
    ).length;
    expect(hurt / 400).toBeGreaterThan(0.06);
    expect(hurt / 400).toBeLessThan(0.22);
    // A career-ending injury is a fraction of one percent a year.
    expect(ended / 400).toBeLessThan(0.03);
  });

  it('never wins a title in a season it missed through injury', () => {
    const { titles } = seasons('superstar', 3000);
    // The fixture reaches the boundary: there are titles, and there are lost seasons.
    expect(titles).toBeGreaterThan(100);
    expect(titlesWhileHurt).toBe(0);
  });

  it('is hurt less often in college than in the pros, but is hurt', () => {
    const base = pro();
    const career = careerOf(base)!;
    let hurt = 0;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const before: GameState = {
        ...base,
        world: { ...base.world, year: 5000 + attempt },
        education: { ...base.education, stage: 'college' },
        sports: {
          ...base.sports,
          career: {
            ...career,
            stage: 'college',
            collegeSeasons: 1,
            contract: undefined,
            tier: undefined,
            peak: undefined,
          },
        },
      };
      const year = runSportsYear({
        before,
        education: before.education,
        age: before.player.age + 1,
        year: 5001 + attempt,
      });
      if (year.lines.length > 0) hurt += 1;
    }
    expect(hurt / 600).toBeGreaterThan(0.03);
    expect(hurt / 600).toBeLessThan(0.14);
  });

  it('wins a title in about a season in thirty for a role player, and more often for a superstar, never always', () => {
    const fringe = seasons('fringe').titles / 400;
    const star = seasons('superstar').titles / 400;
    expect(fringe).toBeGreaterThan(0.005);
    expect(fringe).toBeLessThan(0.09);
    expect(star).toBeGreaterThan(fringe);
    expect(star).toBeLessThan(0.3);
  });
});

describe('the shape of a career', () => {
  it('is a rookie a step below the peak until the breakout, and a step down again near the end', () => {
    expect(tierAt('star', 3, 1, 34, 23)).toBe('starter');
    expect(tierAt('star', 3, 3, 34, 25)).toBe('star');
    expect(tierAt('star', 3, 9, 34, 32)).toBe('starter');
    expect(tierAt('fringe', 1, 1, 27, 23)).toBe('fringe');
  });

  it('ends a career at the age it was set to, as a retirement and not an injury', () => {
    const base = pro();
    const career = careerOf(base)!;
    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const before: GameState = {
        ...base,
        world: { ...base.world, year: 7000 + attempt },
        sports: { ...base.sports, career: { ...career, endAge: base.player.age + 1 } },
      };
      const year = runSportsYear({
        before,
        education: before.education,
        age: before.player.age + 1,
        year: 7001 + attempt,
      });
      const hurtForGood = year.lines.some((line) => /ended your \w+ career/.test(line.text));
      const how = year.sports.past.at(-1)?.how;
      expect(how).toBeDefined();
      expect(how).toBe(hurtForGood ? 'injury' : 'retired');
      outcomes.push(how!);
    }
    expect(outcomes).toContain('retired');
  });

  it('slows a player down after thirty', () => {
    const base = pro();
    const career = careerOf(base)!;
    const before: GameState = {
      ...base,
      world: { ...base.world, year: 8000 },
      sports: { ...base.sports, career: { ...career, endAge: 99 } },
    };
    const at = (age: number): number =>
      runSportsYear({ before, education: before.education, age, year: 8001 }).sports.career!.form;
    expect(at(37)).toBeLessThan(at(26));
  });

  it('is the same career every time the same life is played', () => {
    const first = playOn(recruited(), (state) => state.sports.past.length > 0, { train: false });
    const second = playOn(recruited(), (state) => state.sports.past.length > 0, { train: false });
    expect(second.sports.past).toEqual(first.sports.past);
    expect(second.finance.balance).toEqual(first.finance.balance);
  });

  it('draws from the seed and not from the random streams, so a draw never moves anything else', () => {
    const state = createNewGame({ seed: 'streams-1' });
    const before = JSON.stringify(state.rng.snapshot());
    sportUnit(state.rng.getSeed(), 1, 'draft', 'basketball');
    expect(JSON.stringify(state.rng.snapshot())).toBe(before);
  });
});

describe('the odds, in the game', () => {
  /*
    Lives that make the team at twelve to seventeen and are still on it at seventeen, so the
    figure is "of the players on their teams", which is how the odds were asked for. Played only
    to the draft and the first contract, which is all the odds are about.
  */
  function rate(
    work: boolean,
    talented: boolean,
    lives: number,
  ): {
    readonly onTeam: number;
    readonly pros: number;
  } {
    let onTeam = 0;
    let pros = 0;
    for (let index = 0; index < lives; index += 1) {
      const seed = `odds-${work ? 'w' : 'i'}-${index}`;
      const created = createNewGame({ seed });
      if (created.player.talents.athletics !== talented) continue;
      const life = schoolLifeInfo(seed, work, 18);
      let state = life.state;
      if (!life.onTeam) continue;
      onTeam += 1;
      const recruitedHere = state.sports.offer?.kind === 'scholarship';
      if (!recruitedHere) continue;
      state = playOn(
        state,
        (current) => current.sports.offer?.kind === 'contract' || current.sports.past.length > 0,
        { train: work },
      );
      if (state.sports.offer?.kind === 'contract') pros += 1;
    }
    return { onTeam, pros };
  }

  it('sends most players who work hard to the pros, and nearly nobody who neither works nor has the gift', () => {
    const worked = rate(true, false, 260);
    const idle = rate(false, false, 260);
    // Hard work, no talent: 60% asked for. Wide, because the sample is small.
    expect(worked.onTeam).toBeGreaterThan(50);
    expect(worked.pros / worked.onTeam).toBeGreaterThan(0.45);
    expect(worked.pros / worked.onTeam).toBeLessThan(0.78);
    // No talent and no work: about 3% asked for.
    expect(idle.onTeam).toBeGreaterThan(50);
    expect(idle.pros / idle.onTeam).toBeLessThan(0.12);
  }, 300_000);
});
