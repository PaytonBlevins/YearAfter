/**
 * Ticket 0906 — what the military, FBI, CIA and veteran screens say.
 *
 * Every view is read for each situation it has, and the words are written out here rather than read
 * back from the code that makes them, so a changed sentence is a failing test and not a quiet edit.
 */

import { describe, expect, it } from 'vitest';
import { retiredPayFor } from '@yearafter/content';
import {
  giBillPercent,
  giHousingFor,
  giMonthsLeft,
  giTuitionAid,
  agencyPayOf,
  militaryOccupation,
  retireFromService,
  yearPayOf,
  type GameState,
} from '@yearafter/simulation';
import {
  ADULT,
  agencyReady,
  at,
  eligible,
  inAgency,
  pastAgency,
  pastRow,
  serving,
  veteran,
  withDegree,
  withStats,
} from '../test/militaryFixtures';
import {
  agencyStandingWord,
  agencyView,
  dischargeOutcome,
  giShareWords,
  militaryHubRows,
  publicServiceRows,
  recruiterView,
  serviceView,
  standingWords,
  veteranView,
} from './militaryView';

const person = eligible(ADULT);
const adultAge = person.player.age;
const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

describe('the Career page doors', () => {
  it('shows a child nothing', () => {
    expect(publicServiceRows(at(person, 12))).toEqual([]);
    expect(publicServiceRows(at(person, 16))).toEqual([]);
  });

  it('shows a seventeen-year-old the service and both agencies, the agencies shut with their ages', () => {
    const rows = publicServiceRows(at(person, 17));
    expect(ids(rows)).toEqual(['military', 'fbi', 'cia']);
    expect(rows[0]).toEqual({ id: 'military', title: 'Military', subtitle: 'Not in uniform' });
    expect(rows[1]).toMatchObject({ title: 'FBI', subtitle: 'From age 23', closed: 'From age 23' });
    expect(rows[2]).toMatchObject({ title: 'CIA', subtitle: 'From age 21', closed: 'From age 21' });
  });

  it('opens the CIA at twenty-one and the FBI at twenty-three', () => {
    const at21 = publicServiceRows(at(person, 21));
    expect(at21[2]!.closed).toBeUndefined();
    expect(at21[1]!.closed).toBe('From age 23');
    const at23 = publicServiceRows(at(person, 23));
    expect(at23[1]!.closed).toBeUndefined();
  });

  it('says an adult with no career is not a member of either agency', () => {
    const rows = publicServiceRows(person);
    expect(rows[1]).toEqual({ id: 'fbi', title: 'FBI', subtitle: 'Not an agent' });
    expect(rows[2]).toEqual({ id: 'cia', title: 'CIA', subtitle: 'Not an officer' });
  });

  it('names the rank and branch of somebody in uniform', () => {
    const state = serving(person);
    expect(publicServiceRows(state)[0]!.subtitle).toBe('Specialist, Army');
    expect(publicServiceRows(state)[0]!.subtitle).toBe(militaryOccupation(state.military));
  });

  it('says where a veteran served and for how long', () => {
    expect(publicServiceRows(veteran(person))[0]!.subtitle).toBe('Left the Army after 6 years');
    expect(publicServiceRows(veteran(person, { years: 1 }))[0]!.subtitle).toBe(
      'Left the Army after 1 year',
    );
    expect(publicServiceRows(veteran(person, { branch: 'navy' }))[0]!.subtitle).toBe(
      'Left the Navy after 6 years',
    );
  });

  it('says a recruit who did not finish washed out, in the branch’s short name', () => {
    const state = veteran(person, {
      how: 'washed-out',
      years: 0,
      discharge: 'entry-level',
      branch: 'marine-corps',
    });
    expect(publicServiceRows(state)[0]!.subtitle).toBe('Washed out of Marine Corps training');
  });

  it('reads the latest service when there are several', () => {
    const state: GameState = {
      ...person,
      military: {
        past: [pastRow({ branch: 'army', years: 4 }), pastRow({ branch: 'navy', years: 2 })],
      },
    };
    expect(publicServiceRows(state)[0]!.subtitle).toBe('Left the Navy after 2 years');
  });

  it('names an agent by title and agency, and shuts the other agency with who they work for', () => {
    const rows = publicServiceRows(inAgency(person));
    expect(rows[1]).toEqual({ id: 'fbi', title: 'FBI', subtitle: 'Special Agent, FBI' });
    expect(rows[2]).toEqual({
      id: 'cia',
      title: 'CIA',
      subtitle: 'You work for FBI',
      closed: 'You work for the FBI.',
    });
    const cia = publicServiceRows(inAgency(person, { agency: 'cia', grade: 13 }));
    expect(cia[2]!.subtitle).toBe('Senior Case Officer, CIA');
    expect(cia[1]).toMatchObject({ subtitle: 'You work for CIA', closed: 'You work for the CIA.' });
  });

  it('says where a former agent left, per agency', () => {
    const state: GameState = {
      ...person,
      intel: { past: [pastAgency({ agency: 'cia', years: 4 })] },
    };
    const rows = publicServiceRows(state);
    expect(rows[2]!.subtitle).toBe('Left the CIA after 4 years');
    expect(rows[1]!.subtitle).toBe('Not an agent');
  });

  it('keeps the agencies apart from the service: serving does not change an agency row', () => {
    const rows = publicServiceRows(serving(person));
    expect(rows[1]!.subtitle).toBe('Not an agent');
    expect(rows[2]!.subtitle).toBe('Not an officer');
  });
});

describe('the Military hub', () => {
  it('has two rows, Service and Veteran', () => {
    expect(ids(militaryHubRows(person))).toEqual(['service', 'veteran']);
  });

  it('shuts Veteran until there is something to show, and says when it comes', () => {
    const none = militaryHubRows(person);
    expect(none[0]).toEqual({ id: 'service', title: 'Service', subtitle: 'Not in uniform' });
    expect(none[1]).toMatchObject({
      subtitle: 'Nothing earned yet',
      closed: 'Once you have served',
    });
    const uniform = militaryHubRows(serving(person));
    expect(uniform[0]!.subtitle).toBe('Specialist, Army');
    expect(uniform[1]!.closed).toBe('After you leave the service');
  });

  it('opens Veteran once a service is over, and says where it was', () => {
    const rows = militaryHubRows(veteran(person));
    expect(rows[1]!.closed).toBeUndefined();
    expect(rows[1]!.subtitle).toBe('Left the Army after 6 years');
  });

  it('keeps Veteran open for somebody back in uniform with a service behind them', () => {
    const rows = militaryHubRows(serving(veteran(person)));
    expect(rows[0]!.subtitle).toBe('Specialist, Army');
    expect(rows[1]!.closed).toBeUndefined();
  });
});

describe('standing, in words', () => {
  it.each([
    [100, 'They would be lost without you'],
    [80, 'They would be lost without you'],
    [79, 'Doing the job, and doing it well'],
    [62, 'Doing the job, and doing it well'],
    [61, 'Getting by'],
    [45, 'Getting by'],
    [44, 'It has been noticed, and not kindly'],
    [30, 'It has been noticed, and not kindly'],
    [29, 'One bad evaluation from being let go'],
    [0, 'One bad evaluation from being let go'],
  ])('%i reads "%s"', (performance, words) => {
    expect(standingWords(performance)).toBe(words);
  });

  it.each([
    [90, 'Talked about in the building'],
    [85, 'Talked about in the building'],
    [84, 'Trusted'],
    [70, 'Trusted'],
    [69, 'Solid'],
    [55, 'Solid'],
    [54, 'Unremarkable'],
    [40, 'Unremarkable'],
    [39, 'On a short leash'],
  ])('an agency opinion of %i reads "%s"', (reputation, words) => {
    expect(agencyStandingWord(reputation)).toBe(words);
  });
});

describe('Service, in uniform', () => {
  const view = serviceView(serving(person));

  it('lists the facts in a fixed order, with real figures for pay and time', () => {
    expect(view.serving).toBe(true);
    expect(view.facts.map((fact) => fact.title)).toEqual([
      'Rank',
      'Job',
      'Posting',
      'This term',
      'In uniform',
      'Pay',
      'Your name',
    ]);
    const by = (title: string) => view.facts.find((fact) => fact.title === title)!;
    expect(by('Rank')).toEqual({ title: 'Rank', value: 'Specialist', subtitle: 'Enlisted, Army' });
    expect(by('Job').value).toBe('Infantry');
    expect(by('Posting')).toEqual({ title: 'Posting', value: 'Fort Harlan' });
    expect(by('This term')).toEqual({
      title: 'This term',
      value: '1 year',
      subtitle: 'Until End term is available',
    });
    expect(by('In uniform').value).toBe('3 years');
    expect(by('Pay').value).toMatch(/^\$[\d,]+ a year$/);
    const career = serving(person).military.service!;
    expect(yearPayOf(career)).toBeGreaterThan(0);
    expect(by('Pay').value).toBe(`$${yearPayOf(career).toLocaleString('en-US')} a year`);
    expect(by('Your name').value).toBe('solid');
  });

  it('prints no performance number anywhere', () => {
    const everything = JSON.stringify(view);
    expect(everything).not.toMatch(/"performance"/);
    expect(view.going).toEqual({
      words: 'Getting by',
      meter: 60,
      low: false,
    });
  });

  it('says "up this year" when the term ends with the year', () => {
    const ending = serviceView(serving(person, { years: 4, termEnds: 4 }));
    expect(ending.facts.find((fact) => fact.title === 'This term')).toEqual({
      title: 'This term',
      value: 'First term completed',
      subtitle: 'You can choose to leave from this screen',
    });
    const more = serviceView(serving(person, { years: 2, termEnds: 4 }));
    expect(more.facts.find((fact) => fact.title === 'This term')!.value).toBe('2 years');
  });

  it('never shows a negative number of years left', () => {
    const past = serviceView(serving(person, { years: 6, termEnds: 4 }));
    expect(past.facts.find((fact) => fact.title === 'This term')!.value).toBe(
      'First term completed',
    );
  });

  it('marks the bar low just under the floor the service lets people go below', () => {
    expect(serviceView(serving(person, { performance: 47 })).going!.low).toBe(false);
    expect(serviceView(serving(person, { performance: 46 })).going!.low).toBe(true);
  });

  it('says a recruit is in training, with what the branch calls it', () => {
    const recruit = serviceView(serving(person, { stage: 'training', years: 0, grade: 1 }));
    expect(recruit.facts.find((fact) => fact.title === 'Posting')).toEqual({
      title: 'Posting',
      value: 'In training',
      subtitle: 'Basic training',
    });
    const sailor = serviceView(
      serving(person, {
        stage: 'training',
        years: 0,
        grade: 1,
        branch: 'navy',
        specialty: 'navy.boatswain',
      }),
    );
    expect(sailor.facts.find((fact) => fact.title === 'Posting')!.subtitle).toBe('Boot camp');
  });

  it('says an officer candidate is at the branch’s officer school', () => {
    const candidate = serviceView(
      serving(withDegree(person), { stage: 'training', track: 'officer', grade: 1, years: 4 }),
    );
    const posting = candidate.facts.find((fact) => fact.title === 'Posting')!;
    expect(posting.value).toBe('In training');
    expect(posting.subtitle).toBe('Officer Candidate School');
  });

  it('puts the track and branch under the rank', () => {
    const officer = serviceView(serving(person, { track: 'officer', grade: 3 }));
    expect(officer.facts[0]).toEqual({
      title: 'Rank',
      value: 'Captain',
      subtitle: 'Officer, Army',
    });
  });

  it('adds the clearance when one is held and still good', () => {
    const held: GameState = {
      ...serving(person),
      intel: { past: [], clearance: { level: 'secret', grantedAge: 22 } },
    };
    const facts = serviceView(held).facts;
    expect(facts[facts.length - 1]).toEqual({ title: 'Clearance', value: 'Secret' });
    const lapsed: GameState = {
      ...held,
      intel: { past: [], clearance: { level: 'secret', grantedAge: 20, idleSince: adultAge - 5 } },
    };
    expect(serviceView(lapsed).facts.some((fact) => fact.title === 'Clearance')).toBe(false);
  });

  it('lists decorations by name, oldest first, and nothing when there are none', () => {
    expect(view.honours).toEqual([]);
    const decorated: GameState = {
      ...serving(person),
      military: {
        ...serving(person).military,
        decorations: [
          { id: 'commendation', age: 22 },
          { id: 'purple-heart', age: 24 },
        ],
      },
    };
    expect(serviceView(decorated).honours).toEqual(['Commendation Medal', 'Purple Heart']);
  });

  it('counts the pushes left this year from two', () => {
    expect(view.pushesLeft).toBe(2);
    expect(
      serviceView(serving(person, { pushedAtAge: adultAge, pushedThisYear: 1 })).pushesLeft,
    ).toBe(1);
    expect(
      serviceView(serving(person, { pushedAtAge: adultAge, pushedThisYear: 2 })).pushesLeft,
    ).toBe(0);
    expect(
      serviceView(serving(person, { pushedAtAge: adultAge - 1, pushedThisYear: 2 })).pushesLeft,
    ).toBe(2);
  });
});

describe('Service, the verbs the engine would refuse', () => {
  it('shuts the commission row for want of a degree, in words', () => {
    expect(serviceView(serving(person)).commission).toEqual({
      closed: "A commission takes a bachelor's degree, and you don't have one.",
    });
  });

  it('opens it for an enlisted member with a degree and a year in', () => {
    expect(serviceView(serving(withDegree(person))).commission).toEqual({});
  });

  it('says a first-year member has not served long enough, and a recruit to finish training', () => {
    expect(serviceView(serving(withDegree(person), { years: 0 })).commission!.closed).toBe(
      "You haven't served long enough for a board to look at you.",
    );
    expect(
      serviceView(serving(withDegree(person), { stage: 'training', years: 0, grade: 1 }))
        .commission!.closed,
    ).toBe('Finish your training first.');
  });

  it('says a package already in this year is in', () => {
    const state = serving(withDegree(person));
    const filed: GameState = {
      ...state,
      military: { ...state.military, commissionAppliedAge: adultAge },
    };
    expect(serviceView(filed).commission!.closed).toBe(
      "You've already put in a package this year.",
    );
  });

  it('has no commission row for an officer', () => {
    expect(
      serviceView(serving(withDegree(person), { track: 'officer', grade: 2 })).commission,
    ).toBeUndefined();
  });

  it('shuts Retire before twenty years, and during training, with the same words', () => {
    const words = 'Retiring opens at twenty years of service, and not during training.';
    expect(serviceView(serving(person, { years: 19 })).retire).toBeUndefined();
    expect(serviceView(serving(person, { years: 19 })).endTerm).toEqual({});
    expect(serviceView(serving(person, { years: 25, stage: 'training' })).retire).toEqual({
      closed: words,
    });
  });

  it('opens Retire at twenty years', () => {
    expect(serviceView(serving(person, { years: 20, termEnds: 24 })).retire).toEqual({});
  });

  it('says a deployed member cannot retire or put in a package', () => {
    const state = serving(withDegree(person), { years: 20 });
    const away: GameState = {
      ...state,
      military: {
        ...state.military,
        deployment: {
          status: 'active',
          theater: 'somewhere',
          months: 9,
          tier: 'rear',
          incidents: 1,
          results: [],
          orderedAge: adultAge,
        },
      },
    };
    const view = serviceView(away);
    expect(view.retire).toEqual({ closed: "You're deployed. It will wait." });
    expect(view.commission).toEqual({ closed: "You're deployed. A board will wait." });
  });
});

describe('Service, out of uniform', () => {
  it('has no facts and an open recruiter for somebody who can enlist', () => {
    const view = serviceView(person);
    expect(view.serving).toBe(false);
    expect(view.facts).toEqual([]);
    expect(view.enlist).toEqual({});
    expect(view.commission).toBeUndefined();
    expect(view.retire).toBeUndefined();
    expect(view.going).toBeUndefined();
  });

  it('shuts the recruiter for the visit already made', () => {
    expect(serviceView(at(person, 17)).enlist).toEqual({});
    const visited: GameState = { ...person, military: { past: [], appliedAge: adultAge } };
    expect(serviceView(visited).enlist).toEqual({
      closed: "You've already been to the recruiting office this year.",
    });
  });

  it('says a question already standing comes first', () => {
    const asked = { ...person, pending: [{ eventId: 'x' } as never] };
    expect(serviceView(asked).enlist).toEqual({
      closed: 'There is a question waiting for you already.',
    });
  });

  it('shuts it with the reason every branch gives when they all give the same one', () => {
    expect(serviceView(withStats(person, { health: 10 })).enlist).toEqual({
      closed: "The physical turned you away. You're not well enough for this yet.",
    });
  });

  it('stays open when only some branches turn the person away', () => {
    // 35 clears the Army's smarts floor and not the Coast Guard's, so one door is shut and the table is open.
    const view = serviceView(withStats(person, { smarts: 35 }));
    expect(view.enlist).toEqual({});
    expect('closed' in view.enlist!).toBe(false);
  });

  it('gives the first branch’s reason when every branch turns the person away, for different reasons', () => {
    // At 33 the Marine Corps and the Coast Guard say too old (age is asked first); the Army, with
    // smarts this low, says the aptitude test. The Army comes first in the list.
    const view = serviceView(withStats(at(person, 33), { smarts: 20 }));
    expect(view.enlist).toEqual({ closed: "The aptitude test didn't go your way." });
  });

  it('says a recruiter’s question already open comes first, as well as a question of the game’s', () => {
    const offer = {
      kind: 'enlist',
      age: adultAge,
      eventId: 'x',
      step: 'branch',
      options: [],
    } as const;
    const asked: GameState = { ...person, military: { past: [], offer } };
    expect(serviceView(asked).enlist).toEqual({
      closed: 'There is a question waiting for you already.',
    });
  });

  it('has no pushes to count when out of uniform', () => {
    expect(serviceView(person).pushesLeft).toBe(0);
  });

  it('still lists decorations a past service earned', () => {
    const state: GameState = {
      ...veteran(person),
      military: { ...veteran(person).military, decorations: [{ id: 'bronze-star', age: 23 }] },
    };
    expect(serviceView(state).honours).toEqual(['Bronze Star']);
  });
});

describe('the recruiter’s table', () => {
  it('asks for the branch first, one row per branch, with what each begins with', () => {
    const view = recruiterView(person);
    expect(view.step).toBe('branch');
    expect(view.prompt).toBe('Which branch?');
    expect(view.rows.map((row) => [row.id, row.title, row.subtitle])).toEqual([
      ['army', 'Army', 'Basic training first'],
      ['navy', 'Navy', 'Boot camp first'],
      ['marine-corps', 'Marine Corps', 'Boot camp first'],
      ['air-force', 'Air Force', 'Basic military training first'],
      ['coast-guard', 'Coast Guard', 'Boot camp first'],
    ]);
    expect(view.rows.every((row) => row.closed === undefined)).toBe(true);
  });

  it('shuts a branch whose standards the person does not meet, with the reason', () => {
    const view = recruiterView(withStats(person, { smarts: 35 }));
    const closed = view.rows.filter((row) => row.closed !== undefined);
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.length).toBeLessThan(view.rows.length);
    for (const row of closed) expect(row.closed).toBe("The aptitude test didn't go your way.");
  });

  it('shuts every branch to somebody too young, with the age', () => {
    const view = recruiterView(at(person, 16));
    expect(view.rows.every((row) => row.closed === "You're too young to enlist.")).toBe(true);
  });

  it('goes straight to the jobs for somebody with no degree', () => {
    const view = recruiterView(person, { branch: 'army' });
    expect(view.step).toBe('specialty');
    expect(view.prompt).toBe('What job do you want?');
  });

  it('asks a graduate which road, enlisting or a commission', () => {
    const view = recruiterView(withDegree(person), { branch: 'army' });
    expect(view.step).toBe('track');
    expect(view.prompt).toBe('Which road?');
    expect(view.rows).toEqual([
      { id: 'enlisted', title: 'Enlist', subtitle: 'Start at the bottom and work up' },
      {
        id: 'officer',
        title: 'Apply for a commission',
        subtitle: 'Officer training at Officer Candidate School',
      },
    ]);
  });

  it('moves on to the jobs once the road is chosen', () => {
    const view = recruiterView(withDegree(person), { branch: 'army', track: 'officer' });
    expect(view.step).toBe('specialty');
  });

  it('lists every job a branch has, in the engine’s order, with how hard a posting it can be', () => {
    const view = recruiterView(person, { branch: 'army' });
    expect(view.rows[0]).toMatchObject({ id: 'army.infantry', title: 'Infantry' });
    expect(view.rows.every((row) => row.id.startsWith('army.'))).toBe(true);
    const words = new Set(view.rows.map((row) => row.subtitle));
    expect([...words].sort()).toEqual(['Mostly safe', 'Often in harm’s way', 'Some risk'].sort());
  });

  it('shuts a job the person lacks the aptitude for, and leaves the open one open', () => {
    const weak = withStats(person, { smarts: 31, health: 52, discipline: 20 });
    const view = recruiterView(weak, { branch: 'army' });
    const closed = view.rows.filter((row) => row.closed !== undefined);
    expect(closed.length).toBeGreaterThan(0);
    for (const row of closed) expect(row.closed).toBe("You don't qualify for that job yet.");
    expect(view.rows[0]!.closed).toBeUndefined();
  });

  it('opens every job for somebody strong', () => {
    const strong = withStats(person, { smarts: 100, health: 100, discipline: 100 });
    expect(
      recruiterView(strong, { branch: 'navy' }).rows.every((row) => row.closed === undefined),
    ).toBe(true);
  });

  it('falls back to the first step for a branch id that is not one', () => {
    expect(recruiterView(person, { branch: 'space-force' }).step).toBe('branch');
  });
});

describe('Veteran', () => {
  it('says what a serving member has not earned yet, and when it comes', () => {
    const view = veteranView(serving(person));
    expect(view.pension).toEqual({
      title: 'Retired pay',
      value: 'None yet',
      subtitle: 'Twenty years of service earns it',
    });
    expect(view.giBill).toEqual([
      {
        title: 'GI Bill',
        value: 'Not yet',
        subtitle: 'It comes when you leave with an honorable discharge',
      },
    ]);
    expect(view.preference).toEqual({
      title: 'Hiring preference',
      value: 'No',
      subtitle: 'It comes when you leave',
    });
    expect(view.before).toEqual([]);
  });

  it('gives retired pay a real figure and says since when', () => {
    const state = veteran(person, { years: 22, how: 'retired', finalGrade: 7, endedAge: 25 });
    const pay = retiredPayFor({ track: 'enlisted', finalGrade: 7, years: 22, how: 'retired' });
    const view = veteranView(at(state, 30));
    expect(view.pension).toEqual({
      title: 'Retired pay',
      value: `$${pay.toLocaleString('en-US')} a year`,
      subtitle: 'For life, since you were 26',
    });
    expect(pay).toBeGreaterThan(0);
  });

  it('says retired pay is still to come in the year the service ended', () => {
    const state = veteran(person, { years: 21, how: 'retired', endedAge: adultAge });
    expect(veteranView(state).pension.subtitle).toBe(`For life, from ${adultAge + 1}`);
  });

  it('says retired pay is "since" from the age it began, not the year before', () => {
    const state = veteran(person, { years: 22, how: 'retired', finalGrade: 7, endedAge: 25 });
    expect(veteranView(at(state, 26)).pension.subtitle).toBe('For life, since you were 26');
    expect(veteranView(at(state, 25)).pension.subtitle).toBe('For life, from 26');
  });

  it('says what a leaver without twenty years is owed', () => {
    const view = veteranView(veteran(person, { years: 8 }));
    expect(view.pension).toEqual({
      title: 'Retired pay',
      value: 'None yet',
      subtitle: 'It takes 20 years and a retirement',
    });
  });

  it.each([
    [1, 'All of it'],
    [0.9, 'Nearly all of it'],
    [0.8, 'Most of it'],
    [0.7, 'Most of it'],
    [0.6, 'More than half'],
    [0.5, 'Half of it'],
  ])('a %s share of the GI Bill reads "%s"', (percent, words) => {
    expect(giShareWords(percent)).toBe(words);
  });

  it('lists the GI Bill with months left, tuition and housing as real figures', () => {
    const state = veteran(person, { years: 6 });
    const view = veteranView(state);
    const military = state.military;
    expect(giBillPercent(military)).toBe(1);
    expect(view.giBill.map((fact) => fact.title)).toEqual([
      'GI Bill',
      'Left to use',
      'Tuition',
      'Housing',
    ]);
    expect(view.giBill[0]).toEqual({ title: 'GI Bill', value: 'All of it' });
    expect(view.giBill[1]).toEqual({
      title: 'Left to use',
      value: '36 of 36 months',
      subtitle: 'A year at college uses nine',
    });
    expect(view.giBill[2]!.value).toBe(
      `Up to $${giTuitionAid(military, 30_908).toLocaleString('en-US')} a year`,
    );
    expect(view.giBill[2]!.value).toBe('Up to $30,908 a year');
    expect(view.giBill[3]!.value).toBe(
      `$${giHousingFor(military).toLocaleString('en-US')} a year while you study`,
    );
    expect(view.giBill[3]!.value).toBe('$21,564 a year while you study');
  });

  it('counts the months already used', () => {
    const state = veteran(person, { years: 6 }, { giBillMonthsUsed: 9 });
    expect(giMonthsLeft(state.military)).toBe(27);
    expect(veteranView(state).giBill[1]!.value).toBe('27 of 36 months');
  });

  it('says a shorter service earned a part of it', () => {
    const view = veteranView(veteran(person, { years: 2 }));
    expect(view.giBill[0]!.value).toBe('Most of it');
  });

  it('gives a medical discharge the whole thing whatever the time', () => {
    const view = veteranView(veteran(person, { years: 1, how: 'medical', discharge: 'medical' }));
    expect(view.giBill[0]!.value).toBe('All of it');
  });

  it('says the GI Bill needs an honorable discharge when the discharge was not', () => {
    const view = veteranView(
      veteran(person, { years: 6, discharge: 'general', how: 'not-retained' }),
    );
    expect(view.giBill).toEqual([
      { title: 'GI Bill', value: 'Not yet', subtitle: 'It takes an honorable discharge' },
    ]);
  });

  it('says a very short honorable service has not earned it', () => {
    const view = veteranView(veteran(person, { years: 0, how: 'term' }));
    expect(view.giBill).toEqual([
      {
        title: 'GI Bill',
        value: 'Not yet',
        subtitle: 'It takes an honorable discharge and some months of service',
      },
    ]);
  });

  it('gives a veteran the hiring preference and says what it is for', () => {
    expect(veteranView(veteran(person)).preference).toEqual({
      title: 'Hiring preference',
      value: 'Yes',
      subtitle: 'Public and safety jobs favor a veteran',
    });
  });

  it('says why there is none: too little time, or the wrong discharge', () => {
    expect(veteranView(veteran(person, { years: 1 })).preference).toEqual({
      title: 'Hiring preference',
      value: 'No',
      subtitle: 'It takes 2 years of service',
    });
    // Exactly the years it takes, and the wrong discharge: the time was there, the discharge was not.
    expect(
      veteranView(veteran(person, { years: 2, discharge: 'dishonorable', how: 'misconduct' }))
        .preference.subtitle,
    ).toBe('Not with that discharge');
    expect(
      veteranView(veteran(person, { discharge: 'dishonorable', how: 'misconduct' })).preference,
    ).toEqual({
      title: 'Hiring preference',
      value: 'No',
      subtitle: 'Not with that discharge',
    });
  });

  it('lists past services newest first, with how each ended and its discharge', () => {
    const state: GameState = {
      ...person,
      military: {
        past: [
          pastRow({ branch: 'army', years: 4, finalGrade: 4, how: 'term' }),
          pastRow({
            branch: 'navy',
            years: 2,
            finalGrade: 3,
            how: 'not-retained',
            discharge: 'general',
          }),
        ],
      },
    };
    expect(veteranView(state).before).toEqual([
      {
        title: 'Navy, Seaman',
        value: '2 years',
        subtitle:
          "The service didn't ask you to stay another term. General, under honorable conditions discharge.",
      },
      {
        title: 'Army, Specialist',
        value: '4 years',
        subtitle: 'You chose to leave when your term was up. Honorable discharge.',
      },
    ]);
  });

  it.each([
    ['washed-out', "You didn't finish training."],
    ['not-retained', "The service didn't ask you to stay another term."],
    ['passed-over', 'The promotion boards stopped choosing you.'],
    ['term', 'You chose to leave when your term was up.'],
    ['retired', 'You retired with the years in.'],
    ['killed', 'You died in service.'],
    ['medical', 'A medical board sent you home.'],
    ['misconduct', 'You were court-martialed.'],
  ] as const)('says how a "%s" service ended', (how, words) => {
    const view = veteranView(veteran(person, { how }));
    expect(view.before[0]!.subtitle?.startsWith(words)).toBe(true);
  });

  it('names an officer’s final rank in the branch’s words', () => {
    const view = veteranView(veteran(person, { track: 'officer', finalGrade: 4, branch: 'navy' }));
    expect(view.before[0]!.title).toBe('Navy, Lieutenant Commander');
  });
});

describe('the discharge card', () => {
  const longService = serving(person, { years: 22, termEnds: 24, grade: 7 });
  const left = (before: GameState, how: Parameters<typeof pastRow>[0] = {}): GameState => ({
    ...before,
    military: { past: [...before.military.past, pastRow(how)] },
  });

  it('says how it ended, the discharge, the pay and the GI Bill for a retirement', () => {
    const result = retireFromService(longService);
    if (!result.ok) throw new Error('could not retire');
    const card = dischargeOutcome(longService, result.value.state)!;
    const pay = retiredPayFor({ track: 'enlisted', finalGrade: 7, years: 22, how: 'retired' });
    expect(card.title).toBe('You retired');
    expect(card.tone).toBe('good');
    expect(card.body).toBe(
      `You retired with the years in. You served 22 years in the Army and left as a sergeant first class. ` +
        `Your discharge: Honorable. Retired pay of $${pay.toLocaleString('en-US')} a year starts next year, for life. ` +
        `The GI Bill is yours: all of it, with 36 months to use. Hiring panels for public and safety work will favor a veteran.`,
    );
    expect(pay).toBe(33_381);
  });

  it('says there is no retired pay under twenty years, and what it takes', () => {
    const before = serving(person, { years: 8 });
    const card = dischargeOutcome(before, left(before, { years: 8 }))!;
    expect(card.title).toBe('You left the service');
    expect(card.body).toContain('No retired pay: it takes 20 years and a retirement.');
    expect(card.body).toContain(
      'You chose to leave when your term was up. You served 8 years in the Army and left as a sergeant.',
    );
    expect(card.body).toContain('The GI Bill is yours: all of it, with 36 months to use.');
  });

  it('names the share of the GI Bill a shorter service earned', () => {
    const before = serving(person, { years: 2 });
    const card = dischargeOutcome(before, left(before, { years: 2, how: 'term', finalGrade: 3 }))!;
    expect(card.body).toContain('left as a private first class');
    expect(card.body).toContain('The GI Bill is yours: most of it, with 36 months to use.');
  });

  it('says a recruit who washed out served no years and gets no GI Bill, and says so plainly', () => {
    const before = serving(person, { stage: 'training', years: 0, grade: 1 });
    const card = dischargeOutcome(
      before,
      left(before, { how: 'washed-out', years: 0, discharge: 'entry-level', finalGrade: 1 }),
    )!;
    expect(card.title).toBe('You washed out');
    expect(card.tone).toBe('bad');
    expect(card.body).toBe(
      "You didn't finish training. Your discharge: Entry-level separation. " +
        'No retired pay: it takes 20 years and a retirement. ' +
        'No GI Bill: it takes an honorable discharge and some months of service.',
    );
  });

  it.each([
    ['not-retained', 'general', 'Your term ended', 'neutral'],
    ['passed-over', 'honorable', 'Passed over', 'good'],
    ['term', 'honorable', 'You left the service', 'good'],
    ['medical', 'medical', 'A medical discharge', 'good'],
    ['misconduct', 'dishonorable', 'Court-martialed', 'bad'],
  ] as const)(
    'a %s service with a %s discharge is titled "%s" and reads %s',
    (how, discharge, title, tone) => {
      const before = serving(person, { years: 5 });
      const card = dischargeOutcome(before, left(before, { how, discharge, years: 5 }))!;
      expect(card.title).toBe(title);
      expect(card.tone).toBe(tone);
    },
  );

  it('gives no preference line when the discharge was not honorable enough', () => {
    const before = serving(person, { years: 5 });
    const card = dischargeOutcome(
      before,
      left(before, { how: 'misconduct', discharge: 'dishonorable', years: 5 }),
    )!;
    expect(card.body).not.toContain('Hiring panels');
    expect(card.body).toContain('No GI Bill');
  });

  it('says nothing when the service did not end in this change', () => {
    expect(dischargeOutcome(longService, longService)).toBeUndefined();
    expect(dischargeOutcome(person, person)).toBeUndefined();
    expect(dischargeOutcome(person, left(person))).toBeUndefined();
  });

  it('says nothing for a death, a new life, or a past nobody added to', () => {
    const before = serving(person, { years: 5 });
    const after = left(before);
    const dead = { ...after, player: { ...after.player, alive: false } } as GameState;
    expect(dischargeOutcome(before, dead)).toBeUndefined();
    const other = {
      ...after,
      player: { ...after.player, id: `${after.player.id}-2` },
    } as GameState;
    expect(dischargeOutcome(before, other)).toBeUndefined();
    const same: GameState = { ...before, military: { past: [pastRow()] } };
    expect(dischargeOutcome(same, { ...same, military: { past: [pastRow()] } })).toBeUndefined();
  });

  it('says nothing when the service is gone and no past row was added for it', () => {
    const before = serving(person, { years: 5 });
    const gone: GameState = { ...before, military: { past: [] } };
    expect(dischargeOutcome(before, gone)).toBeUndefined();
  });

  it('reads the row just added, not an older one, when there are several', () => {
    const service = serving(person, { years: 3 }).military.service!;
    const older = pastRow({ branch: 'navy', years: 9 });
    const before: GameState = { ...person, military: { past: [older], service } };
    const after: GameState = {
      ...person,
      military: { past: [older, pastRow({ branch: 'army', years: 3 })] },
    };
    expect(dischargeOutcome(before, after)!.body).toContain('You served 3 years in the Army');
  });

  it('says nothing while the service is still going after the change', () => {
    const before = serving(person, { years: 5 });
    const after = {
      ...serving(left(before)),
      military: { past: [pastRow()], service: before.military.service },
    } as GameState;
    expect(dischargeOutcome(before, after)).toBeUndefined();
  });

  it('writes an officer’s last rank in the branch’s own words', () => {
    const before = serving(withDegree(person), {
      track: 'officer',
      grade: 4,
      years: 12,
      branch: 'navy',
    });
    const card = dischargeOutcome(
      before,
      left(before, { track: 'officer', finalGrade: 4, years: 12, branch: 'navy' }),
    )!;
    expect(card.body).toContain('in the Navy and left as a lieutenant commander.');
  });

  it('says "an" before a rank that starts with a vowel', () => {
    const before = serving(withDegree(person), { track: 'officer', grade: 1, years: 4 });
    const card = dischargeOutcome(
      before,
      left(before, { track: 'officer', finalGrade: 1, years: 4, branch: 'navy' }),
    )!;
    expect(card.body).toContain('left as an ensign.');
  });
});

describe('the FBI and the CIA', () => {
  const ready = agencyReady();

  it('is a door for somebody with no agency career, with what it asks in words', () => {
    const view = agencyView(ready, 'cia');
    expect(view.kind).toBe('door');
    expect(view.name).toBe('CIA');
    expect(view.door!.asks).toEqual([
      { title: 'Age', value: '21 to 45' },
      { title: 'Education', value: "A bachelor's degree" },
      { title: 'Clearance', value: 'Top Secret', subtitle: 'Checked after the offer' },
    ]);
    expect(view.door!.closed).toBeUndefined();
    expect(view.facts).toEqual([]);
  });

  it('adds the FBI’s experience requirement, with service counting', () => {
    const view = agencyView(ready, 'fbi');
    expect(view.door!.asks).toEqual([
      { title: 'Age', value: '23 to 36' },
      { title: 'Education', value: "A bachelor's degree" },
      { title: 'Experience', value: '2 years', subtitle: 'Service in uniform counts' },
      { title: 'Clearance', value: 'Top Secret', subtitle: 'Checked after the offer' },
    ]);
  });

  it('shuts Apply with the engine’s reason, for each way the door can be shut', () => {
    expect(agencyView(person, 'cia').door!.closed).toBe(
      "It takes a bachelor's degree, and you don't have one.",
    );
    expect(agencyView(at(ready, 19), 'cia').door!.closed).toBe("You're too young for that one.");
    expect(agencyView(at(ready, 50), 'cia').door!.closed).toBe(
      "You're past the age that agency takes.",
    );
    expect(agencyView(ready, 'fbi').door!.closed).toBe(
      "They want more professional experience than you've got.",
    );
    expect(agencyView(withStats(ready, { health: 10 }), 'cia').door!.closed).toBe(
      "The physical turned you away. You're not well enough for this yet.",
    );
    const applied: GameState = { ...ready, intel: { past: [], appliedAge: ready.player.age } };
    expect(agencyView(applied, 'cia').door!.closed).toBe(
      "You've already applied to an agency this year.",
    );
  });

  it('tells somebody in uniform to leave the service first, and does not stop a degree holder reading the door', () => {
    const view = agencyView(serving(ready), 'cia');
    expect(view.kind).toBe('door');
    expect(view.door!.closed).toBe(
      "You're in uniform. Leave the service first; a clearance stays good for two years.",
    );
  });

  it('says what counts for an applicant: a clearance, years in an intelligence job, or both', () => {
    expect(agencyView(ready, 'cia').door!.help).toBeUndefined();
    const cleared: GameState = {
      ...ready,
      intel: { past: [], clearance: { level: 'secret', grantedAge: 25 } },
    };
    expect(agencyView(cleared, 'cia').door!.help).toBe('Your clearance counts for you.');
    const analyst = veteran(ready, { specialty: 'army.intelligence', years: 4 });
    expect(agencyView(analyst, 'cia').door!.help).toBe('Your years in intelligence count for you.');
    const both: GameState = { ...analyst, intel: cleared.intel };
    expect(agencyView(both, 'cia').door!.help).toBe(
      'Your clearance and your years in intelligence count for you.',
    );
  });

  it('says nothing special for years in a job that is not intelligence, or a recruit who washed out', () => {
    expect(agencyView(veteran(ready), 'cia').door!.help).toBeUndefined();
    expect(
      agencyView(veteran(ready, { how: 'washed-out', years: 0, discharge: 'entry-level' }), 'cia')
        .door!.help,
    ).toBeUndefined();
  });

  it('is the career itself for somebody in that agency', () => {
    const view = agencyView(inAgency(ready), 'fbi');
    expect(view.kind).toBe('in');
    expect(view.facts.map((fact) => fact.title)).toEqual([
      'Title',
      'Posting',
      'At the agency',
      'Pay',
      'Your name',
    ]);
    const by = (title: string) => view.facts.find((fact) => fact.title === title)!;
    expect(by('Title')).toEqual({ title: 'Title', value: 'Special Agent' });
    expect(by('Posting')).toEqual({ title: 'Posting', value: 'the Harlow field office' });
    expect(by('At the agency').value).toBe('3 years');
    expect(by('Pay').value).toMatch(/^\$[\d,]+ a year$/);
    const agent = inAgency(ready).intel.career!;
    expect(agencyPayOf(agent)).toBeGreaterThan(0);
    expect(by('Pay').value).toBe(`$${agencyPayOf(agent).toLocaleString('en-US')} a year`);
    expect(by('Your name').value).toBe('Solid');
    expect(view.going).toEqual({ words: 'Getting by', meter: 60, low: false });
    expect(view.pushesLeft).toBe(2);
    expect(view.leaveLabel).toBe('Leave the agency');
    expect(view.door).toBeUndefined();
  });

  it('writes a CIA officer’s title for the grade', () => {
    const view = agencyView(inAgency(ready, { agency: 'cia', grade: 14 }), 'cia');
    expect(view.facts[0]).toEqual({ title: 'Title', value: 'Station Chief' });
  });

  it('says a trainee is in the academy, by the agency’s own name for it', () => {
    const fbi = agencyView(inAgency(ready, { stage: 'training', years: 0 }), 'fbi');
    expect(fbi.facts.find((fact) => fact.title === 'Posting')).toEqual({
      title: 'Posting',
      value: 'In training',
      subtitle: 'The Academy at Quantico',
    });
    const cia = agencyView(inAgency(ready, { agency: 'cia', stage: 'training', years: 0 }), 'cia');
    expect(cia.facts.find((fact) => fact.title === 'Posting')!.subtitle).toBe('The Farm');
  });

  it('marks the bar low just under the agency’s retain floor', () => {
    expect(agencyView(inAgency(ready, { performance: 45 }), 'fbi').going!.low).toBe(false);
    expect(agencyView(inAgency(ready, { performance: 44 }), 'fbi').going!.low).toBe(true);
  });

  it('counts pushes left from two', () => {
    const pushed = inAgency(ready, { pushedAtAge: ready.player.age, pushedThisYear: 2 });
    expect(agencyView(pushed, 'fbi').pushesLeft).toBe(0);
  });

  it('calls leaving "retire" only with twenty years and the age', () => {
    const years = (n: number, age: number) =>
      agencyView(at(inAgency(ready, { years: n }), age), 'fbi').leaveLabel;
    expect(years(20, 50)).toBe('Retire from the agency');
    expect(years(19, 50)).toBe('Leave the agency');
    expect(years(20, 49)).toBe('Leave the agency');
  });

  it('adds the clearance to an agent’s facts', () => {
    const state: GameState = {
      ...inAgency(ready),
      intel: { ...inAgency(ready).intel, clearance: { level: 'top-secret', grantedAge: 26 } },
    };
    const facts = agencyView(state, 'fbi').facts;
    expect(facts[facts.length - 1]).toEqual({ title: 'Clearance', value: 'Top Secret' });
  });

  it('says the other agency is closed to somebody who works for one', () => {
    const view = agencyView(inAgency(ready), 'cia');
    expect(view.kind).toBe('elsewhere');
    expect(view.name).toBe('CIA');
    expect(view.facts).toEqual([]);
    expect(view.door).toBeUndefined();
  });

  it('lists the stints at this agency only, newest first, with how each ended', () => {
    const state: GameState = {
      ...ready,
      intel: {
        past: [
          pastAgency({ agency: 'fbi', years: 3, how: 'washed-out', finalGrade: 10 }),
          pastAgency({ agency: 'cia', years: 2, how: 'let-go', finalGrade: 9 }),
          pastAgency({ agency: 'fbi', years: 22, how: 'retired', finalGrade: 14, pension: 91_000 }),
        ],
      },
    };
    expect(agencyView(state, 'fbi').before).toEqual([
      {
        title: 'Supervisory Special Agent',
        value: '22 years',
        subtitle: 'You retired. Retired pay of $91,000 a year.',
      },
      { title: 'Special Agent', value: '3 years', subtitle: "You didn't finish the academy." },
    ]);
    expect(agencyView(state, 'cia').before).toEqual([
      { title: 'Junior Case Officer', value: '2 years', subtitle: 'They let you go.' },
    ]);
  });

  it.each([
    ['washed-out', "You didn't finish the academy."],
    ['let-go', 'They let you go.'],
    ['clearance-lost', 'You lost your clearance, and the job with it.'],
    ['resigned', 'You resigned.'],
    ['retired', 'You retired.'],
    ['killed', 'You died on a mission.'],
  ] as const)('says how a "%s" career ended', (how, words) => {
    const state: GameState = { ...ready, intel: { past: [pastAgency({ how })] } };
    expect(agencyView(state, 'fbi').before[0]!.subtitle).toBe(words);
  });
});
