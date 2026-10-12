/**
 * Ticket 0809 — the words the sports, acting, music, modeling and racing screens use.
 */

import { describe, expect, it } from 'vitest';
import { ACTING_TIER_ROWS, MODEL_TIER_ROWS, MUSIC_TIER_ROWS, STUDIES } from '@yearafter/content';
import {
  castingCalls,
  chartOf,
  modelCalls,
  musicCollabOffers,
  readArts,
  skillsOf,
  type GameState,
  type PastCareer,
  type SportCareer,
  worldRankOf,
} from '@yearafter/simulation';
import type { RacingTeam, SeasonResult } from '@yearafter/finance';
import {
  ADULT,
  at,
  withActing,
  withCareer,
  withModeling,
  withMusic,
  withPast,
  withRacingTeam,
} from '../test/entertainmentFixtures';
import {
  DEVELOPMENT_WORDS,
  FIELD_AGES,
  PLACEMENT_WORDS,
  actingView,
  awardFacts,
  awardsView,
  chartView,
  driverWords,
  fieldFame,
  hubRows,
  modelingView,
  musicView,
  ordinal,
  percent,
  racingTeamView,
  recapOf,
  sportsView,
  studiesView,
} from './entertainmentView';

const rowOf = (state: GameState, id: string) => hubRows(state).find((row) => row.id === id)!;

describe('small words', () => {
  it('says a chance as a whole percent', () => {
    expect(percent(0.236)).toBe('24%');
    expect(percent(0)).toBe('0%');
    expect(percent(1)).toBe('100%');
  });

  it('puts the right ending on a place, teens included', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 101, 111, 112].map((n) => ordinal(n))).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '10th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
      '111th',
      '112th',
    ]);
    // 1001 is 11 more than a multiple of 99 and ends in a one; it is still a plain 1001st.
    expect(ordinal(1001)).toBe('1001st');
  });

  it('describes a driver without a number, with a word at each edge', () => {
    expect(driverWords(100)).toBe('one of the best around');
    expect(driverWords(80)).toBe('one of the best around');
    expect(driverWords(79)).toBe('quick');
    expect(driverWords(65)).toBe('quick');
    expect(driverWords(64)).toBe('solid');
    expect(driverWords(45)).toBe('solid');
    expect(driverWords(44)).toBe('still learning');
    expect(driverWords(30)).toBe('still learning');
    expect(driverWords(29)).toBe('raw');
    expect(driverWords(0)).toBe('raw');
  });
});

describe('the hub', () => {
  it('lists the five fields in order', () => {
    expect(hubRows(ADULT).map((row) => row.id)).toEqual([
      'sports',
      'studies',
      'acting',
      'music',
      'modeling',
    ]);
    expect(hubRows(ADULT).map((row) => row.title)).toEqual([
      'Sports',
      'Martial Arts and Karting',
      'Acting',
      'Music',
      'Modeling',
    ]);
  });

  it('opens every field to an adult and says what is not started', () => {
    for (const row of hubRows(ADULT)) expect(row.closed).toBeUndefined();
    expect(rowOf(ADULT, 'sports').subtitle).toBe('No team yet. Teams start at school.');
    expect(rowOf(ADULT, 'studies').subtitle).toBe('Nothing started');
    expect(rowOf(ADULT, 'acting').subtitle).toBe('No credits yet');
    expect(rowOf(ADULT, 'music').subtitle).toBe('Nothing released');
    expect(rowOf(ADULT, 'modeling').subtitle).toBe('No jobs yet');
    for (const row of hubRows(ADULT)) expect(row.value).toBeUndefined();
  });

  it('opens each field at the age its engine first lets anything happen', () => {
    // Middle school is the first school team; karting takes children of eight, martial arts ten;
    // music lessons from seven; student films from eleven; a first test shoot from fourteen.
    expect(FIELD_AGES).toEqual({
      sports: 11,
      studies: 8,
      acting: 11,
      music: 7,
      modeling: 14,
    });
  });

  it('closes a field with the age it opens at, just below that age', () => {
    for (const id of ['sports', 'studies', 'acting', 'music', 'modeling'] as const) {
      const age = FIELD_AGES[id];
      expect(rowOf(at(ADULT, age), id).closed).toBeUndefined();
      expect(rowOf(at(ADULT, age - 1), id).closed).toBe(`From age ${age}`);
    }
    expect(FIELD_AGES.acting).toBe(ACTING_TIER_ROWS.local.minAge);
    expect(FIELD_AGES.modeling).toBe(MODEL_TIER_ROWS.test.minAge);
  });

  it('shows a career, a post or nothing for sports', () => {
    const pro = withCareer(ADULT, { tier: 'star', team: 'Harbor City Gulls' });
    expect(rowOf(pro, 'sports').subtitle).toBe('Harbor City Gulls, basketball');
    expect(rowOf(pro, 'sports').value).toBe('A star');
    const school = withCareer(ADULT, { stage: 'school', tier: undefined, team: undefined });
    expect(rowOf(school, 'sports').subtitle).toBe('School basketball');
    expect(rowOf(school, 'sports').value).toBe('School');
  });

  it('counts the arts being studied against the two it allows', () => {
    const studying: GameState = {
      ...ADULT,
      sports: {
        ...ADULT.sports,
        arts: [
          {
            artId: 'boxing',
            startedAge: 20,
            seasons: 1,
            hardSeasons: 0,
            level: 20,
            trainedAtAge: -1,
            trainedCount: 0,
          },
        ],
      },
    };
    expect(rowOf(studying, 'studies').subtitle).toBe('Boxing');
    expect(rowOf(studying, 'studies').value).toBe('1 of 2');
  });

  it('shows acting credits and the rung, only once there is one', () => {
    expect(rowOf(withActing(ADULT, { credits: 1 }), 'acting').subtitle).toBe('1 credit');
    const worked = withActing(ADULT, { credits: 4, tier: 'working' });
    expect(rowOf(worked, 'acting').subtitle).toBe('4 credits');
    expect(rowOf(worked, 'acting').value).toBe(ACTING_TIER_ROWS.working.name);
  });

  it('shows music releases and the rung, only once there are listeners', () => {
    const out = withMusic(ADULT, {
      released: { single: 2, ep: 1, lp: 0 },
      listeners: 4_000,
    });
    expect(rowOf(out, 'music').subtitle).toBe('3 releases out');
    expect(rowOf(out, 'music').value).toBe(MUSIC_TIER_ROWS.club.name);
    const one = withMusic(ADULT, { released: { single: 1, ep: 0, lp: 0 } });
    expect(rowOf(one, 'music').subtitle).toBe('1 release out');
    expect(rowOf(one, 'music').value).toBeUndefined();
  });

  it('shows modeling jobs and the rung, only once there is a job', () => {
    expect(rowOf(withModeling(ADULT, { credits: 1 }), 'modeling').subtitle).toBe('1 job');
    const worked = withModeling(ADULT, { credits: 3, tier: 'catalogue' });
    expect(rowOf(worked, 'modeling').subtitle).toBe('3 jobs');
    expect(rowOf(worked, 'modeling').value).toBe(MODEL_TIER_ROWS.catalogue.name);
  });
});

describe('sports', () => {
  it('has nothing to show for somebody who never played', () => {
    const view = sportsView(ADULT);
    expect(view.empty).toBe(true);
    expect(view.facts).toEqual([]);
    expect(view.sessionsLeft).toBeUndefined();
    expect(view.post).toBeUndefined();
    expect(view.past).toEqual([]);
  });

  it('is not empty with only a past', () => {
    const past: PastCareer = {
      sportId: 'baseball',
      startedAge: 15,
      endedAge: 31,
      seasons: 12,
      titles: 2,
      reputation: 55,
      reached: 'pro',
      bestTier: 'star',
      how: 'retired',
    };
    const view = sportsView(withPast(ADULT, [past]));
    expect(view.empty).toBe(false);
    expect(view.past).toEqual([
      { title: 'Baseball, 15 to 31', value: 'A star', subtitle: 'Retired · 2 titles' },
    ]);
  });

  it('says how a career without a pro tier ended, and a single title in the singular', () => {
    const past: PastCareer = {
      sportId: 'soccer',
      startedAge: 12,
      endedAge: 19,
      seasons: 7,
      titles: 1,
      reputation: 20,
      reached: 'college',
      how: 'undrafted',
    };
    expect(sportsView(withPast(ADULT, [past])).past).toEqual([
      { title: 'Soccer, 12 to 19', value: 'College', subtitle: 'Went undrafted · 1 title' },
    ]);
    expect(
      sportsView(withPast(ADULT, [{ ...past, titles: 0, how: 'injury' }])).past[0]!.subtitle,
    ).toBe('Ended by an injury');
  });

  it('shows a school career as seasons and reputation, with no sessions', () => {
    const view = sportsView(
      withCareer(ADULT, {
        stage: 'school',
        seasons: 3,
        tier: undefined,
        contract: undefined,
        team: undefined,
        reputation: 40,
      }),
    );
    expect(view.facts).toEqual([
      { title: 'School basketball' },
      { title: 'Seasons', value: '3' },
      { title: 'Reputation', value: 'Known' },
    ]);
    expect(view.sessionsLeft).toBeUndefined();
    expect(view.skills).toEqual([]);
  });

  it('shows a college career with its scholarship', () => {
    const view = sportsView(
      withCareer(ADULT, {
        stage: 'college',
        aid: 18_000,
        collegeSeasons: 2,
        team: 'State',
        tier: undefined,
        contract: undefined,
      }),
    );
    expect(view.facts.map((fact) => [fact.title, fact.value])).toEqual([
      ['State, basketball', undefined],
      ['Scholarship', '$18,000 a year'],
      ['Seasons', '2'],
      ['Reputation', 'Known'],
    ]);
    expect(view.sessionsLeft).toBe(3);
  });

  it('shows a pro career with its standing, contract and titles', () => {
    const view = sportsView(withCareer(ADULT, { titles: 2, proSeasons: 5 }));
    expect(view.facts).toEqual([
      { title: 'Harbor City Gulls, basketball' },
      { title: 'Standing', value: 'A starter' },
      { title: 'Contract', value: '$2,400,000 a year', subtitle: '3 years left' },
      { title: 'Seasons as a pro', value: '5' },
      { title: 'Reputation', value: 'Known' },
      { title: 'Titles', value: '2' },
    ]);
  });

  it('says the last year of a contract', () => {
    const view = sportsView(
      withCareer(ADULT, { contract: { salary: 900_000, yearsLeft: 1, rookie: false } }),
    );
    expect(view.facts.find((fact) => fact.title === 'Contract')!.subtitle).toBe('Last year of it');
  });

  it('counts the sessions left this year, and resets them next year', () => {
    const age = ADULT.player.age;
    expect(sportsView(withCareer(ADULT)).sessionsLeft).toBe(3);
    expect(sportsView(withCareer(ADULT, { trainedAtAge: age, trainedCount: 2 })).sessionsLeft).toBe(
      1,
    );
    expect(sportsView(withCareer(ADULT, { trainedAtAge: age, trainedCount: 3 })).sessionsLeft).toBe(
      0,
    );
    expect(
      sportsView(withCareer(ADULT, { trainedAtAge: age - 1, trainedCount: 3 })).sessionsLeft,
    ).toBe(3);
  });

  it('shows a fighter as a record, and a driver with championships', () => {
    const fighter = sportsView(withCareer(ADULT, { sportId: 'boxing', wins: 12, losses: 3 }));
    expect(fighter.facts.find((fact) => fact.title === 'Record')!.value).toBe('12–3');
    const driver = sportsView(withCareer(ADULT, { sportId: 'racing', titles: 1 }));
    expect(driver.facts.map((fact) => fact.title)).toContain('Championships');
    expect(driver.facts.map((fact) => fact.title)).not.toContain('Titles');
  });

  it('gives a player the skills of their sport, as bars', () => {
    const view = sportsView(withCareer(ADULT));
    expect(view.skills).toEqual(skillsOf(withCareer(ADULT)));
    expect(view.skills.length).toBeGreaterThan(0);
    for (const skill of view.skills) {
      expect(skill.value).toBeGreaterThanOrEqual(0);
      expect(skill.value).toBeLessThanOrEqual(100);
    }
  });
});

describe('martial arts and karting', () => {
  const studying = (artId: string, trainedCount = 0, seasons = 1): GameState => ({
    ...ADULT,
    sports: {
      ...ADULT.sports,
      arts: [
        {
          artId,
          startedAge: 20,
          seasons,
          hardSeasons: 0,
          level: 40,
          trainedAtAge: trainedCount > 0 ? ADULT.player.age : -1,
          trainedCount,
        },
      ],
    },
  });

  it('lists every study, with the youngest age for each', () => {
    const view = studiesView(ADULT);
    expect(view.rows.map((row) => row.id)).toEqual(STUDIES.map((art) => art.id));
    expect(view.rows.find((row) => row.id === 'karting')!.minAge).toBe(8);
    expect(view.rows.find((row) => row.id === 'boxing')!.minAge).toBe(10);
    expect(view.full).toBe(false);
    expect(view.road).toBeUndefined();
    for (const row of view.rows) {
      expect(row.studying).toBe(false);
      expect(row.seasons).toBe(0);
      expect(row.skills).toEqual([]);
      expect(row.sessionsLeft).toBe(0);
    }
  });

  it('says what an art costs a year, and every art costs something', () => {
    const view = studiesView(ADULT);
    for (const art of STUDIES) {
      expect(art.annualCost, art.id).toBeGreaterThan(1);
      const row = view.rows.find((candidate) => candidate.id === art.id)!;
      expect(row.cost).toBe(
        `$${art.annualCost.toLocaleString('en-US')} a year once you pay for it`,
      );
    }
    expect(view.rows.find((row) => row.id === 'boxing')!.cost).toBe(
      '$900 a year once you pay for it',
    );
  });

  it('marks the one being studied, with its skills and the sessions left', () => {
    const view = studiesView(studying('boxing', 1));
    const row = view.rows.find((candidate) => candidate.id === 'boxing')!;
    expect(row.studying).toBe(true);
    expect(row.seasons).toBe(1);
    expect(row.counts).toBe(false);
    expect(row.skills).toEqual(readArts(studying('boxing', 1))[0]!.skills);
    expect(row.sessionsLeft).toBe(2);
    expect(view.rows.filter((candidate) => candidate.studying)).toHaveLength(1);
  });

  it('counts an art towards a fight career from the third season', () => {
    expect(studiesView(studying('boxing', 0, 2)).rows.find((r) => r.id === 'boxing')!.counts).toBe(
      false,
    );
    expect(studiesView(studying('boxing', 0, 3)).rows.find((r) => r.id === 'boxing')!.counts).toBe(
      true,
    );
  });

  it('has no sessions left after the third, and a fresh three next year', () => {
    expect(
      studiesView(studying('boxing', 3)).rows.find((r) => r.id === 'boxing')!.sessionsLeft,
    ).toBe(0);
    const stale = studying('boxing', 3);
    const lastYear: GameState = {
      ...stale,
      sports: {
        ...stale.sports,
        arts: stale.sports.arts!.map((art) => ({ ...art, trainedAtAge: art.trainedAtAge - 1 })),
      },
    };
    expect(studiesView(lastYear).rows.find((r) => r.id === 'boxing')!.sessionsLeft).toBe(3);
  });

  it('is full at two arts', () => {
    const two: GameState = {
      ...ADULT,
      sports: {
        ...ADULT.sports,
        arts: ['boxing', 'karate'].map((artId) => ({
          artId,
          startedAge: 20,
          seasons: 1,
          hardSeasons: 0,
          level: 10,
          trainedAtAge: -1,
          trainedCount: 0,
        })),
      },
    };
    expect(studiesView(two).full).toBe(true);
    expect(studiesView(studying('boxing')).full).toBe(false);
  });

  it('names the fight career the arts are a road to, once there is one', () => {
    const road = studiesView(studying('boxing', 0, 3)).road;
    expect(road).toBe('On the road to Boxing');
  });
});

describe('acting', () => {
  it('shows where an actor is, in words', () => {
    const view = actingView(
      withActing(ADULT, { credits: 5, hits: 2, tier: 'working', reputation: 40 }),
    );
    expect(view.facts).toEqual([
      {
        title: 'Where you are',
        value: ACTING_TIER_ROWS.working.name,
        subtitle: ACTING_TIER_ROWS.working.blurb,
      },
      { title: 'Reputation', value: 'Established' },
      { title: 'Credits', value: '5' },
      { title: 'Hits', value: '2' },
    ]);
  });

  it('says what an agent takes, and leaves hits out when there are none', () => {
    const view = actingView(withActing(ADULT, { agent: { since: 20 } }));
    expect(view.facts.map((fact) => fact.title)).toEqual([
      'Where you are',
      'Reputation',
      'Credits',
      'Agent',
    ]);
    expect(view.facts.at(-1)!.subtitle).toBe('Takes 10% of what you earn');
    expect(view.agent).toBe(true);
    expect(actingView(ADULT).agent).toBe(false);
  });

  it('lists the casting calls with their pay, odds and reach', () => {
    const view = actingView(ADULT);
    const calls = castingCalls(ADULT);
    expect(view.calls).toHaveLength(calls.length);
    view.calls.forEach((row, index) => {
      const call = calls[index]!;
      expect(row.id).toBe(call.role.id);
      expect(row.title).toBe(call.role.title);
      expect(row.fee).toBe(`$${call.role.fee.toLocaleString('en-US')}`);
      expect(row.chance).toBe(`${Math.round(call.chance * 100)}%`);
      expect(row.applied).toBe(false);
      expect(row.subtitle).toContain(call.role.medium);
      expect(row.subtitle).toContain(call.role.days === 1 ? '1 day' : `${call.role.days} days`);
    });
    expect(new Set(view.calls.map((row) => row.reach)).size).toBeGreaterThan(1);
  });

  it('only ever lists parts the engine says the actor can be seen for', () => {
    for (const age of [11, 14, 16, 26]) {
      const state = at(ADULT, age);
      for (const row of actingView(state).calls) expect(row).not.toHaveProperty('notReady');
    }
  });

  it('counts applications left against what the year allows, and an agent adds two', () => {
    expect(actingView(ADULT).applicationsLeft).toBe(2);
    expect(actingView(withActing(ADULT, { agent: { since: 20 } })).applicationsLeft).toBe(4);
    const call = castingCalls(ADULT)[0]!.role.id;
    const used = withActing(ADULT, { appliedAge: ADULT.player.age, applied: [call] });
    expect(actingView(used).applicationsLeft).toBe(1);
    // Last year's applications do not count against this year.
    const old = withActing(ADULT, { appliedAge: ADULT.player.age - 1, applied: [call] });
    expect(actingView(old).applicationsLeft).toBe(2);
    const spent = withActing(ADULT, {
      appliedAge: ADULT.player.age,
      applied: [call, 'x', 'y', 'z'],
    });
    expect(actingView(spent).applicationsLeft).toBe(0);
  });

  it('lists booked roles with their pay', () => {
    const role = castingCalls(ADULT)[0]!.role;
    const { source: _source, asked: _asked, ...booked } = role;
    const view = actingView(
      withActing(ADULT, { booked: [{ ...booked, bookedAge: ADULT.player.age }] }),
    );
    expect(view.booked).toHaveLength(1);
    expect(view.booked[0]!.title).toBe(role.title);
    expect(view.booked[0]!.value).toBe(`$${role.fee.toLocaleString('en-US')}`);
    expect(view.booked[0]!.subtitle).toContain('shoots in the year ahead');
  });

  it('counts the sessions left on a character, three a year', () => {
    const age = ADULT.player.age;
    expect(actingView(ADULT).sessionsLeft).toBe(3);
    expect(actingView(withActing(ADULT, { devAtAge: age, devCount: 2 })).sessionsLeft).toBe(1);
    expect(actingView(withActing(ADULT, { devAtAge: age - 1, devCount: 3 })).sessionsLeft).toBe(3);
    expect(actingView(withActing(ADULT, { lessons: { since: 20, seasons: 1 } })).lessons).toBe(
      true,
    );
    expect(actingView(ADULT).lessons).toBe(false);
  });
});

describe('music', () => {
  it('shows where an act is, and its listeners', () => {
    const view = musicView(withMusic(ADULT, { listeners: 4_000, reputation: 40, tours: 2 }));
    expect(view.facts).toEqual([
      {
        title: 'Where you are',
        value: MUSIC_TIER_ROWS.club.name,
        subtitle: `You play ${MUSIC_TIER_ROWS.club.venue}`,
      },
      { title: 'Listeners', value: '4,000', subtitle: 'A month' },
      { title: 'Reputation', value: 'Established' },
      { title: 'Tours', value: '2' },
    ]);
  });

  it('plans each kind of release against its cap and cost', () => {
    const view = musicView(
      withMusic(ADULT, {
        released: { single: 3, ep: 1, lp: 0 },
        plan: { single: 2, ep: 0, lp: 1, tour: false },
      }),
    );
    expect(view.plan.map((row) => [row.kind, row.name, row.planned, row.cap, row.out])).toEqual([
      ['single', 'Single', 2, 15, 3],
      ['ep', 'EP', 0, 3, 1],
      ['lp', 'Album', 1, 2, 0],
    ]);
    expect(view.plan.map((row) => row.cost)).toEqual(['$300 each', '$2,500 each', '$9,000 each']);
  });

  it('says a label pays for the recording once there is a deal', () => {
    const view = musicView(
      withMusic(ADULT, {
        deal: {
          kind: 'indie',
          label: 'Low Tide Records',
          advance: 20_000,
          royalty: 0.2,
          left: 3,
          since: 25,
          owed: 0,
          paid: true,
        },
      }),
    );
    expect(view.plan.every((row) => row.cost === 'Your label pays')).toBe(true);
    expect(view.deal).toEqual({
      title: 'Low Tide Records',
      value: 'Independent label',
      subtitle: '3 years left · 20% royalty',
    });
    expect(musicView(ADULT).deal).toBeUndefined();
  });

  it('calls a major label a major label, and one year left a year', () => {
    const view = musicView(
      withMusic(ADULT, {
        deal: {
          kind: 'major',
          label: 'Northbound',
          advance: 500_000,
          royalty: 0.15,
          left: 1,
          since: 25,
          owed: 0,
          paid: true,
        },
      }),
    );
    expect(view.deal!.value).toBe('Major label');
    expect(view.deal!.subtitle).toBe('1 year left · 15% royalty');
  });

  it('offers a tour only to an act that can tour, and shows what it would do', () => {
    expect(musicView(ADULT).tour).toBeUndefined();
    const big = withMusic(ADULT, {
      listeners: 60_000,
      plan: { single: 0, ep: 0, lp: 0, tour: true },
    });
    const tour = musicView(big).tour!;
    expect(tour.on).toBe(true);
    expect(tour.summary).toMatch(/^\d+ shows? · about \$[\d,]+ at the door, \$[\d,]+ on the road$/);
    expect(tour.weeks).toMatch(/^\d+ weeks?$/);
    const off = withMusic(ADULT, { listeners: 60_000 });
    expect(musicView(off).tour!.on).toBe(false);
  });

  it('counts the weeks the plan uses out of the year', () => {
    const view = musicView(withMusic(ADULT, { plan: { single: 2, ep: 1, lp: 0, tour: false } }));
    // Two singles at two weeks and one EP at six.
    expect(view.weeks).toBe('10 of 52 weeks');
    expect(musicView(ADULT).weeks).toBe('0 of 52 weeks');
  });

  it('shows the chance a demo gets a call back', () => {
    expect(musicView(ADULT).demo.chance).toMatch(/^\d+%$/);
  });

  it('lists collaborations asked for, free for a friend and priced for a stranger', () => {
    expect(musicView(ADULT).collabs).toEqual([]);
    const state = withMusic(ADULT, { released: { single: 2, ep: 0, lp: 0 }, listeners: 5_000 });
    const offers = musicCollabOffers(state);
    const view = musicView(state);
    expect(offers.length).toBeGreaterThan(0);
    expect(view.collabs).toHaveLength(offers.length);
    view.collabs.forEach((row, index) => {
      const offer = offers[index]!;
      expect(row.id).toBe(offer.id);
      expect(row.title).toBe(offer.partner.name);
      expect(row.subtitle).toBe(
        offer.partner.friend
          ? 'A friend'
          : `${offer.partner.audience.toLocaleString('en-US')} listeners`,
      );
      expect(row.fee).toBe(offer.fee > 0 ? `$${offer.fee.toLocaleString('en-US')}` : 'Free');
    });
    // A stranger who charges: walk the years until one turns up.
    const charged = Array.from({ length: 40 }, (_, step) => ({
      ...withMusic(ADULT, { listeners: 50_000, released: { single: 2, ep: 0, lp: 0 } }),
      world: { ...ADULT.world, year: ADULT.world.year + step },
    })).find((trial) => musicCollabOffers(trial).some((offer) => offer.fee > 0))!;
    const priced = musicCollabOffers(charged).find((offer) => offer.fee > 0)!;
    expect(musicView(charged).collabs.find((row) => row.id === priced.id)!.fee).toBe(
      `$${priced.fee.toLocaleString('en-US')}`,
    );
  });

  it('says whether lessons are on', () => {
    expect(musicView(ADULT).lessons).toBe(false);
    expect(musicView(withMusic(ADULT, { lessons: { since: 20, seasons: 1 } })).lessons).toBe(true);
  });
});

describe('modeling', () => {
  it('shows where a model is', () => {
    const view = modelingView(
      withModeling(ADULT, {
        credits: 6,
        tier: 'commercial',
        reputation: 40,
        followers: 12_000,
        agency: { since: 22 },
      }),
    );
    expect(view.facts).toEqual([
      {
        title: 'Where you are',
        value: MODEL_TIER_ROWS.commercial.name,
        subtitle: MODEL_TIER_ROWS.commercial.blurb,
      },
      { title: 'Reputation', value: 'Established' },
      { title: 'Jobs', value: '6' },
      { title: 'Following', value: '12,000' },
      { title: 'Agency', subtitle: 'Takes 20% of what you earn' },
    ]);
    expect(view.agency).toBe(true);
  });

  it('leaves out a following and an agency that are not there', () => {
    const view = modelingView(ADULT);
    expect(view.facts.map((fact) => fact.title)).toEqual(['Where you are', 'Reputation', 'Jobs']);
    expect(view.agency).toBe(false);
  });

  it('lists castings with the client, the work and what it pays', () => {
    const view = modelingView(ADULT);
    const calls = modelCalls(ADULT);
    expect(view.calls).toHaveLength(calls.length);
    view.calls.forEach((row, index) => {
      const call = calls[index]!;
      expect(row.id).toBe(call.job.id);
      expect(row.title).toBe(call.job.client);
      expect(row.chance).toBe(`${Math.round(call.chance * 100)}%`);
      expect(row.subtitle).toContain(PLACEMENT_WORDS[call.job.placement]);
      expect(row.subtitle.startsWith(call.job.medium[0]!.toUpperCase())).toBe(true);
    });
  });

  it('uses short words for how a model is used', () => {
    expect(PLACEMENT_WORDS).toEqual({
      face: 'The face of it',
      featured: 'Featured',
      group: 'In the group',
    });
  });

  it('counts applications left, with an agency adding two', () => {
    expect(modelingView(ADULT).applicationsLeft).toBe(3);
    expect(modelingView(withModeling(ADULT, { agency: { since: 20 } })).applicationsLeft).toBe(5);
    const id = modelCalls(ADULT)[0]!.job.id;
    expect(
      modelingView(withModeling(ADULT, { appliedAge: ADULT.player.age, applied: [id] }))
        .applicationsLeft,
    ).toBe(2);
    expect(
      modelingView(withModeling(ADULT, { appliedAge: ADULT.player.age - 1, applied: [id] }))
        .applicationsLeft,
    ).toBe(3);
  });

  it('says whether new pictures were done this year, and what they cost an adult', () => {
    expect(modelingView(ADULT).portfolio.done).toBe(false);
    const done = modelingView(withModeling(ADULT, { portfolioAge: ADULT.player.age }));
    expect(done.portfolio.done).toBe(true);
    const own: GameState = { ...ADULT, household: { ...ADULT.household, housing: 'ownPlace' } };
    expect(modelingView(own).portfolio.cost).toBe('$900');
    // Living with family, a parent pays and there is no bill to show.
    const home: GameState = { ...ADULT, household: { ...ADULT.household, housing: 'withFamily' } };
    expect(modelingView(home).portfolio.cost).toBeUndefined();
  });

  it('lists booked jobs and brand offers with their pay', () => {
    const job = modelCalls(ADULT)[0]!.job;
    const { source: _source, asked: _asked, ...booked } = job;
    const view = modelingView(
      withModeling(ADULT, { booked: [{ ...booked, bookedAge: ADULT.player.age }] }),
    );
    expect(view.booked).toHaveLength(1);
    expect(view.booked[0]!.title).toBe(job.client);
    expect(view.booked[0]!.subtitle).toContain('shoots in the year ahead');
    expect(modelingView(ADULT).brands).toEqual([]);
  });
});

describe('awards and charts', () => {
  it('shows no chart for sport until there is a pro career in it', () => {
    expect(chartView(ADULT, 'sports')).toBeUndefined();
    expect(
      chartView(withCareer(ADULT, { stage: 'college', tier: undefined }), 'sports'),
    ).toBeUndefined();
  });

  it('names the sport chart for the sport, and ranks a famous player on it', () => {
    const star = withCareer(ADULT, { tier: 'superstar', titles: 4 });
    const view = chartView(star, 'sports')!;
    expect(view.name).toBe('the PBA rankings');
    expect(view.rank).toBeDefined();
    expect(view.rows.some((row) => row.player)).toBe(true);
  });

  it('matches the engine chart row for row', () => {
    const star = withCareer(ADULT, { tier: 'superstar', titles: 4 });
    const engine = chartOf(
      star.rng.getSeed(),
      star.world.year,
      'sports',
      fieldFame(star, 'sports'),
      'basketball',
    );
    const view = chartView(star, 'sports')!;
    expect(view.rows.map((row) => row.rank)).toEqual(
      engine.filter((row) => row.rank <= 10 || row.player).map((row) => row.rank),
    );
  });

  it('keeps the top ten and adds the player below them', () => {
    const view = chartView(withCareer(ADULT, { tier: 'fringe', titles: 0 }), 'sports');
    if (view?.rank !== undefined && view.rank > 10) {
      expect(view.rows).toHaveLength(11);
      expect(view.rows.at(-1)!.player).toBe(true);
    } else {
      expect(view?.rows.length ?? 10).toBeLessThanOrEqual(10);
    }
  });

  it('puts an unknown actor and an unknown act off their charts', () => {
    expect(chartView(ADULT, 'acting')!.rank).toBeUndefined();
    expect(chartView(ADULT, 'music')!.rank).toBeUndefined();
    expect(chartView(ADULT, 'acting')!.rows).toHaveLength(10);
    expect(chartView(ADULT, 'acting')!.name).toBe('the Marquee List');
    expect(chartView(ADULT, 'music')!.name).toBe('the Silverline Chart');
  });

  it('has no chart for modeling', () => {
    expect(awardsView(ADULT, 'modeling').chart).toBeUndefined();
  });

  it('counts wins from the life record and names the prize for a driver', () => {
    const records = [
      {
        id: 'r1',
        age: 30,
        year: 2040,
        category: 'award' as const,
        label: 'Athlete of the Year, the Laurel Sports Awards, 2040',
      },
      {
        id: 'r2',
        age: 31,
        year: 2041,
        category: 'award' as const,
        label: 'Driver of the Year, the Laurel Sports Awards, 2041',
      },
      {
        id: 'r3',
        age: 31,
        year: 2041,
        category: 'career' as const,
        label: 'Something, the Laurel Sports Awards, 2041',
      },
    ];
    const state: GameState = {
      ...withCareer(ADULT, { sportId: 'racing' }),
      player: { ...ADULT.player, records: records as never },
    };
    const view = awardsView(state, 'sports');
    expect(view.wins).toBe(2);
    expect(view.prize).toBe('Driver of the Year');
    expect(awardsView(withCareer(ADULT), 'sports').prize).toBe('Athlete of the Year');
    expect(awardsView(ADULT, 'acting').prize).toBeUndefined();
  });

  it('says wins and a chart place only when they are true', () => {
    expect(awardFacts(awardsView(ADULT, 'acting'))).toEqual([]);
    const facts = awardFacts({
      ceremony: 'the Laurel Sports Awards',
      wins: 1,
      prize: 'Athlete of the Year',
      chart: { name: 'the PBA rankings', rank: 4, rows: [] },
    });
    expect(facts).toEqual([
      { title: 'The Laurel Sports Awards', value: '1 win', subtitle: 'Athlete of the Year' },
      { title: 'The PBA rankings', value: 'No. 4' },
    ]);
    expect(
      awardFacts({ ceremony: 'the Marquee Awards', wins: 3, chart: { name: 'x', rows: [] } }),
    ).toEqual([{ title: 'The Marquee Awards', value: '3 wins' }]);
  });
});

const teamIn = (state: GameState, id: string, over: Partial<RacingTeam>): GameState => ({
  ...state,
  businesses: state.businesses.map((business) =>
    business.id === id
      ? {
          ...business,
          racing: {
            rung: 1,
            car: 50,
            driver: { kind: 'owner' },
            development: 'steady',
            titles: 0,
            best: 1,
            seasons: 0,
            ...over,
          },
        }
      : business,
  ),
});

describe('the racing team', () => {
  it('shows a new team in its first series, with three drivers looking for a seat', () => {
    const { state, id } = withRacingTeam();
    const view = racingTeamView(state, id)!;
    expect(view.series).toBe('Coastline Club Racing');
    expect(view.words).toBe('club racing');
    expect(view.facts).toEqual([
      { title: 'Series', value: 'Coastline Club Racing', subtitle: 'Club racing' },
      { title: 'Seasons run', value: '0' },
      { title: 'Championships', value: '0' },
    ]);
    expect(view.candidates).toHaveLength(3);
    expect(view.driving).toBe(false);
    expect(view.canStepDown).toBe(false);
    expect(view.development).toBe('steady');
    expect(view.next).toEqual({ name: 'Atlas Junior Formula', cost: 90_000, ready: false });
    expect(view.last).toBeUndefined();
  });

  it('is nothing for a business that is not a racing team', () => {
    expect(racingTeamView(ADULT, 'nope')).toBeUndefined();
  });

  it('puts the owner in the seat, and says so', () => {
    const { state, id } = withRacingTeam();
    const view = racingTeamView(teamIn(state, id, { driver: { kind: 'owner' } }), id)!;
    expect(view.driving).toBe(true);
    expect(view.driver).toEqual({
      title: 'Driver',
      value: 'You',
      subtitle: 'You drive for your own team',
    });
  });

  it('names a hired driver with an age and a word, never a number', () => {
    const { state, id } = withRacingTeam();
    const view = racingTeamView(
      teamIn(state, id, {
        driver: { kind: 'hired', id: 'd1', name: 'Ana Reyes', skill: 70, age: 27 },
      }),
      id,
    )!;
    expect(view.driving).toBe(false);
    expect(view.driver).toEqual({
      title: 'Driver',
      value: 'Ana Reyes',
      subtitle: 'Age 27 · quick',
    });
  });

  it('says last season in words, a title or a place', () => {
    const { state, id } = withRacingTeam();
    const last = (over: Partial<SeasonResult>): GameState =>
      teamIn(state, id, {
        seasons: 1,
        last: { year: 2040, rung: 1, place: 3, field: 18, title: false, incident: false, ...over },
      });
    expect(racingTeamView(last({}), id)!.last).toBe('2040: 3rd of 18 in the Coastline Club Racing');
    expect(racingTeamView(last({ place: 1, title: true }), id)!.last).toBe(
      '2040: won the Coastline Club Racing',
    );
  });

  it('is ready to move up only after a season at this level', () => {
    const { state, id } = withRacingTeam();
    expect(racingTeamView(state, id)!.next!.ready).toBe(false);
    const played = teamIn(state, id, {
      seasons: 1,
      last: { year: 2040, rung: 1, place: 5, field: 18, title: false, incident: false },
    });
    expect(racingTeamView(played, id)!.next!.ready).toBe(true);
    // A season at a lower level does not count at this one.
    const stale = teamIn(state, id, {
      rung: 2,
      seasons: 1,
      last: { year: 2040, rung: 1, place: 5, field: 18, title: false, incident: false },
    });
    expect(racingTeamView(stale, id)!.next!.ready).toBe(false);
    // Stepping down wants a season at this level too, just as moving up does.
    expect(racingTeamView(stale, id)!.canStepDown).toBe(false);
    const settled = teamIn(state, id, {
      rung: 2,
      seasons: 2,
      last: { year: 2040, rung: 2, place: 9, field: 18, title: false, incident: false },
    });
    expect(racingTeamView(settled, id)!.canStepDown).toBe(true);
    expect(racingTeamView(played, id)!.canStepDown).toBe(false);
  });

  it('has nothing to move up to at the top', () => {
    const { state, id } = withRacingTeam();
    expect(racingTeamView(teamIn(state, id, { rung: 5, best: 5 }), id)!.next).toBeUndefined();
  });
});

describe('the year recap', () => {
  const turn = (
    before: GameState,
    lines: readonly (readonly [string, string] | readonly [string, string, number])[],
  ): GameState => ({
    ...before,
    world: { ...before.world, year: before.world.year + 1 },
    player: {
      ...before.player,
      age: before.player.age + 1,
      timeline: [
        ...before.player.timeline,
        ...lines.map(([id, text, lineYear], index) => ({
          id,
          text,
          age: before.player.age + 1,
          year: lineYear ?? before.world.year + 1,
          kind: 'passive' as const,
          sequence: 900 + index,
        })),
      ],
    },
  });
  const year = ADULT.world.year + 1;

  it('groups the lines each engine wrote for the year that turned', () => {
    const after = turn(ADULT, [
      [`t:${year}:sports:1`, 'Won the title.'],
      [`t:${year}:acting:1`, 'Wrapped a film.'],
      [`t:${year}:acting:2`, 'It did well.'],
      [`t:${year}:music:1`, 'Released a single.'],
      [`t:${year}:modeling:1`, 'Walked a show.'],
      [`t:${year}:awards:1`, 'Won a Laurel.'],
    ]);
    expect(recapOf(ADULT, after)).toEqual([
      { field: 'Sports', lines: ['Won the title.'] },
      { field: 'Acting', lines: ['Wrapped a film.', 'It did well.'] },
      { field: 'Music', lines: ['Released a single.'] },
      { field: 'Modeling', lines: ['Walked a show.'] },
      { field: 'Awards', lines: ['Won a Laurel.'] },
    ]);
  });

  it('is empty when none of those fields wrote anything', () => {
    expect(recapOf(ADULT, turn(ADULT, [[`t:${year}:pay:1`, 'Got paid.']]))).toEqual([]);
    expect(recapOf(ADULT, turn(ADULT, []))).toEqual([]);
  });

  it('ignores a line that is not for this year, or was already there', () => {
    const older = turn(ADULT, [[`t:${year - 1}:sports:1`, 'Last year.', year - 1]]);
    expect(recapOf(ADULT, older)).toEqual([]);
    const had = turn(ADULT, [[`t:${year}:sports:1`, 'Won the title.']]);
    expect(recapOf(had, turn(had, []))).toEqual([]);
  });

  it('ignores a verb the player pressed, which has its own card', () => {
    expect(recapOf(ADULT, turn(ADULT, [[`t:${year}:sports:train:1`, 'Put the work in.']]))).toEqual(
      [],
    );
  });

  it('shows nothing for anything that is not one Advance of one life', () => {
    const after = turn(ADULT, [[`t:${year}:sports:1`, 'Won the title.']]);
    expect(recapOf(after, ADULT)).toEqual([]);
    expect(recapOf(ADULT, ADULT)).toEqual([]);
    const other: GameState = { ...after, player: { ...after.player, id: 'someone-else' as never } };
    expect(recapOf(ADULT, other)).toEqual([]);
    const dead: GameState = { ...after, player: { ...after.player, alive: false } };
    expect(recapOf(ADULT, dead)).toEqual([]);
    const twoYears: GameState = { ...after, world: { ...after.world, year: year + 1 } };
    expect(recapOf(ADULT, twoYears)).toEqual([]);
  });

  it('counts a business line only when it is about a racing team the player runs', () => {
    const { state, id } = withRacingTeam();
    const name = state.businesses.find((business) => business.id === id)!.name;
    const y = state.world.year + 1;
    const after = turn(state, [
      [`t:${y}:biz:1`, `${name} finished 4th of 18 in the Coastline Club Racing.`],
      [`t:${y}:biz:2`, 'Some other shop had a fine year.'],
    ]);
    expect(recapOf(state, after)).toEqual([
      {
        field: 'Your racing team',
        lines: [`${name} finished 4th of 18 in the Coastline Club Racing.`],
      },
    ]);
    // Without a racing team, a business line is nobody's recap.
    const plain = turn(ADULT, [[`t:${year}:biz:1`, 'Some shop had a fine year.']]);
    expect(recapOf(ADULT, plain)).toEqual([]);
  });
});

describe('pinned by the sabotage pass', () => {
  const HOW: [PastCareer['how'], string][] = [
    ['declined', 'Turned down the offer'],
    ['left-college', 'Left after college'],
    ['undrafted', 'Went undrafted'],
    ['retired', 'Retired'],
    ['injury', 'Ended by an injury'],
    ['unsigned', 'Never signed'],
    ['lost-card', 'Lost the tour card'],
    ['released', 'Let go by the team'],
    ['cut', 'Cut from the squad'],
  ];

  it.each(HOW)('says in words how a career ended: %s', (how, words) => {
    const past: PastCareer = {
      sportId: 'golf',
      startedAge: 12,
      endedAge: 30,
      seasons: 10,
      titles: 0,
      reputation: 20,
      reached: 'college',
      how,
    };
    expect(sportsView(withPast(ADULT, [past])).past[0]!.subtitle).toBe(words);
  });

  it('names two arts with an and on the hub', () => {
    const two: GameState = {
      ...ADULT,
      sports: {
        ...ADULT.sports,
        arts: ['boxing', 'karate'].map((artId) => ({
          artId,
          startedAge: 20,
          seasons: 1,
          hardSeasons: 0,
          level: 10,
          trainedAtAge: -1,
          trainedCount: 0,
        })),
      },
    };
    expect(rowOf(two, 'studies').subtitle).toBe('Boxing and Karate');
  });

  it('shows the standing from the first credit, the first listener and the first job', () => {
    expect(rowOf(withActing(ADULT, { credits: 1 }), 'acting').value).toBe(
      ACTING_TIER_ROWS.local.name,
    );
    expect(rowOf(withMusic(ADULT, { listeners: 1 }), 'music').value).toBe(
      MUSIC_TIER_ROWS.local.name,
    );
    expect(rowOf(withModeling(ADULT, { credits: 1 }), 'modeling').value).toBe(
      MODEL_TIER_ROWS.test.name,
    );
  });

  it('shows a tour from the first one and a following from the first follower', () => {
    expect(musicView(withMusic(ADULT, { tours: 1 })).facts.map((f) => f.title)).toContain('Tours');
    expect(musicView(ADULT).facts.map((f) => f.title)).not.toContain('Tours');
    expect(modelingView(withModeling(ADULT, { followers: 1 })).facts.map((f) => f.title)).toContain(
      'Following',
    );
  });

  it('has none left when every application is spent, never one more', () => {
    const ids = modelCalls(ADULT).map((call) => call.job.id);
    const spent = withModeling(ADULT, { appliedAge: ADULT.player.age, applied: ids.slice(0, 3) });
    expect(modelingView(spent).applicationsLeft).toBe(0);
    const over = withModeling(ADULT, { appliedAge: ADULT.player.age, applied: [...ids, 'a', 'b'] });
    expect(modelingView(over).applicationsLeft).toBe(0);
  });

  it('says how far a casting is from where you are, in the three words', () => {
    const words = new Set<string>();
    for (const state of [ADULT, withActing(ADULT, { tier: 'working', credits: 6 })]) {
      for (const row of actingView(state).calls) words.add(row.reach);
    }
    for (const state of [ADULT, withModeling(ADULT, { tier: 'catalogue', credits: 6 })]) {
      for (const row of modelingView(state).calls) words.add(row.reach);
    }
    expect([...words].sort()).toEqual(['A stretch', 'About where you are', 'Below where you are']);
  });

  it('marks nothing as counting towards a career for an art that is not being studied', () => {
    for (const row of studiesView(ADULT).rows) expect(row.counts).toBe(false);
  });

  it('shows a part-time fighter their day job, and nobody else', () => {
    const fighter = (tier: SportCareer['tier'], sportId = 'boxing') =>
      sportsView(withCareer(ADULT, { sportId, tier, contract: undefined })).facts.map(
        (fact) => fact.title,
      );
    expect(fighter('fringe')).toContain('Day job');
    expect(fighter('star')).not.toContain('Day job');
    // A part-time golfer is not a fighter, and a college fighter is not yet paid at all.
    expect(fighter('fringe', 'golf')).not.toContain('Day job');
    const college = sportsView(
      withCareer(ADULT, {
        sportId: 'boxing',
        stage: 'college',
        tier: undefined,
        contract: undefined,
      }),
    );
    expect(college.facts.map((fact) => fact.title)).not.toContain('Day job');
  });

  it('puts a player exactly tenth on the chart in the top ten, not twice', () => {
    // A lead with a name and three awards stands exactly tenth on the acting chart in this life.
    const tenth = withActing(ADULT, {
      tier: 'lead',
      credits: 0,
      hits: 0,
      reputation: 60,
      awards: 3,
    });
    expect(chartView(tenth, 'acting')!.rank).toBe(10);
    const view = chartView(tenth, 'acting')!;
    expect(view.rows).toHaveLength(10);
    expect(view.rows.filter((row) => row.player)).toHaveLength(1);
    expect(view.rows.at(-1)!.player).toBe(true);
  });

  it('counts all three kinds of release on the hub', () => {
    const out = withMusic(ADULT, { released: { single: 1, ep: 1, lp: 1 } });
    expect(rowOf(out, 'music').subtitle).toBe('3 releases out');
  });

  it('shows a tour player where they stand in the world', () => {
    const golfer = withCareer(ADULT, { sportId: 'golf', tier: 'starter', contract: undefined });
    const rank = worldRankOf(golfer);
    expect(rank).toBeDefined();
    const fact = sportsView(golfer).facts.find((row) => row.title === 'World ranking')!;
    expect(fact.value).toBe(`No. ${rank}`);
    expect(sportsView(withCareer(ADULT)).facts.map((row) => row.title)).not.toContain(
      'World ranking',
    );
  });

  it('tells a part-time fighter in words that fighting is the side job', () => {
    const fact = sportsView(
      withCareer(ADULT, { sportId: 'boxing', tier: 'fringe', contract: undefined }),
    ).facts.find((row) => row.title === 'Day job')!;
    expect(fact.subtitle).toBe('Fighting is something you do on the side.');
  });

  it('shows hits from the first one, and three sessions when nothing was done this year', () => {
    expect(actingView(withActing(ADULT, { hits: 1 })).facts.map((f) => f.title)).toContain('Hits');
    expect(actingView(withActing(ADULT, { hits: 0 })).facts.map((f) => f.title)).not.toContain(
      'Hits',
    );
    const unset = withActing(ADULT, { devAtAge: ADULT.player.age });
    expect(actingView(unset).sessionsLeft).toBe(3);
  });

  it('ranks the player on the acting and music charts exactly as the engine does', () => {
    const star = withActing(ADULT, {
      tier: 'star',
      credits: 20,
      hits: 6,
      reputation: 90,
      awards: 3,
    });
    const act = chartView(star, 'acting')!;
    const actEngine = chartOf(
      star.rng.getSeed(),
      star.world.year,
      'acting',
      fieldFame(star, 'acting'),
    );
    expect(fieldFame(star, 'acting')).toBeGreaterThan(25);
    expect(act.rank).toBe(actEngine.find((row) => row.player)!.rank);
    const band = withMusic(ADULT, {
      listeners: 900_000,
      reputation: 90,
      awards: 3,
      released: { single: 5, ep: 1, lp: 1 },
    });
    const mus = chartView(band, 'music')!;
    const musEngine = chartOf(
      band.rng.getSeed(),
      band.world.year,
      'music',
      fieldFame(band, 'music'),
    );
    expect(fieldFame(band, 'music')).toBeGreaterThan(25);
    expect(mus.rank).toBe(musEngine.find((row) => row.player)!.rank);
    expect(fieldFame(band, 'music')).not.toBe(fieldFame(star, 'acting'));
  });

  it('words the three levels of car development exactly', () => {
    expect(DEVELOPMENT_WORDS).toEqual({
      lean: { label: 'Lean', blurb: 'Costs less. The car falls back a little.' },
      steady: { label: 'Steady', blurb: 'The usual spend for the series.' },
      heavy: { label: 'Heavy', blurb: 'Costs more. The car gets quicker.' },
    });
  });

  it('reads a business as a racing team by its type, not by what the engine has stored', () => {
    const { state, id } = withRacingTeam();
    expect(state.businesses.find((b) => b.id === id)!.racing).toBeUndefined();
    expect(racingTeamView(state, id)).toBeDefined();
  });
});
