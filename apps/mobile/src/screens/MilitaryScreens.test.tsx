/**
 * Ticket 0906 — the military hub, Service, the recruiter, Veteran, the FBI and the CIA.
 *
 * The game store and the navigator are mocked; what is checked is what is on screen, in words, and
 * which verb a press sends.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import type { GameState } from '@yearafter/simulation';
import { SectionHeading } from '../components';
import { colors } from '../theme/theme';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import {
  ADULT,
  agencyReady,
  at,
  eligible,
  inAgency,
  pastAgency,
  serving,
  veteran,
  withDegree,
  withStats,
} from '../test/militaryFixtures';
import { expectWellFormed } from '../test/wellFormed';
import { buttonsOf, rowTitled, rowsOf, show, textsOf } from '../test/harness';
import {
  CiaScreen,
  FbiScreen,
  MilitaryScreen,
  RecruiterScreen,
  ServiceScreen,
  VeteranScreen,
} from './MilitaryScreens';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
const pop = vi.fn();
const serve = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function open(element: React.ReactElement, state: GameState | undefined) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, serve });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push, pop });
  rendered = await show(element);
  return rendered;
}

const person = eligible(ADULT);
const age = person.player.age;
const titles = (r: ReactTestRenderer) => rowsOf(r).map((row) => row.props.title as string);
const has = (r: ReactTestRenderer, text: string) => textsOf(r).some((t) => t.includes(text));
const headings = (r: ReactTestRenderer) =>
  r.root.findAllByType(SectionHeading).map((node) => node.props.children as string);
const press = (r: ReactTestRenderer, title: string) =>
  act(() => rowTitled(r, title).props.onPress());

describe('every screen renders nothing before a life has begun', () => {
  it.each([
    ['the hub', <MilitaryScreen />],
    ['Service', <ServiceScreen />],
    ['the recruiter', <RecruiterScreen />],
    ['Veteran', <VeteranScreen />],
    ['the FBI', <FbiScreen />],
    ['the CIA', <CiaScreen />],
  ])('%s', async (_name, element) => {
    const r = await open(element, undefined);
    expect(r.toJSON()).toBeNull();
  });
});

describe('the Military hub', () => {
  it('lists Service and Veteran, and opens Service', async () => {
    const r = await open(<MilitaryScreen />, person);
    expect(titles(r)).toEqual(['Service', 'Veteran']);
    expect(rowTitled(r, 'Service').props.disabled).toBe(false);
    await press(r, 'Service');
    expect(push).toHaveBeenCalledWith({ screen: 'service', title: 'Service' });
    expect(has(r, 'When a term ends the service asks whether you will stay.')).toBe(true);
    expectWellFormed(r);
  });

  it('greys Veteran with the reason until there is a service behind the person, and does not open it', async () => {
    const r = await open(<MilitaryScreen />, person);
    const row = rowTitled(r, 'Veteran');
    expect(row.props.disabled).toBe(true);
    expect(row.props.subtitle).toBe('Once you have served');
    expect(row.props.onPress).toBeUndefined();
  });

  it('opens Veteran for a veteran', async () => {
    const r = await open(<MilitaryScreen />, veteran(person));
    expect(rowTitled(r, 'Veteran').props.disabled).toBe(false);
    expect(rowTitled(r, 'Veteran').props.subtitle).toBe('Left the Army after 6 years');
    await press(r, 'Veteran');
    expect(push).toHaveBeenCalledWith({ screen: 'veteran', title: 'Veteran' });
  });
});

describe('Service, in uniform', () => {
  it('shows the facts, the bar and the verbs, in that order', async () => {
    const r = await open(<ServiceScreen />, serving(person));
    expect(titles(r)).toEqual([
      'Rank',
      'Job',
      'Posting',
      'This term',
      'In uniform',
      'Pay',
      'Your name',
      'How it is going',
      'Put the work in',
      'Apply for a commission',
      'Retire from service',
    ]);
    expect(headings(r)).toEqual(['What you can do']);
    expect(rowTitled(r, 'Rank').props.value).toBe('Specialist');
    expect(rowTitled(r, 'In uniform').props.value).toBe('3 years');
    expectWellFormed(r);
  });

  it('shows how it is going as a phrase and a bar, never the number', async () => {
    const r = await open(<ServiceScreen />, serving(person, { performance: 63, reputation: 71 }));
    const going = rowTitled(r, 'How it is going');
    expect(going.props.subtitle).toBe('Doing the job, and doing it well');
    expect(going.props.meter).toBe(63);
    expect(going.props.meterColor).toBe(colors.statHealth);
    const everything = textsOf(r).join(' | ');
    expect(everything).not.toMatch(/\b63\b/);
    expect(everything).not.toMatch(/\b71\b/);
  });

  it('turns the bar red under the floor', async () => {
    const r = await open(<ServiceScreen />, serving(person, { performance: 40 }));
    expect(rowTitled(r, 'How it is going').props.meterColor).toBe(colors.negative);
  });

  it('puts the work in on every press, never greyed', async () => {
    const r = await open(
      <ServiceScreen />,
      serving(person, { pushedAtAge: age, pushedThisYear: 2 }),
    );
    const work = rowTitled(r, 'Put the work in');
    expect(work.props.disabled).toBeFalsy();
    await act(() => work.props.onPress());
    await act(() => work.props.onPress());
    expect(serve).toHaveBeenCalledTimes(2);
    expect(serve).toHaveBeenLastCalledWith({ type: 'work' });
  });

  it('greys the commission with the reason, and does not send it', async () => {
    const r = await open(<ServiceScreen />, serving(person));
    const row = rowTitled(r, 'Apply for a commission');
    expect(row.props.disabled).toBe(true);
    expect(row.props.subtitle).toBe(
      "A commission takes a bachelor's degree, and you don't have one.",
    );
    expect(row.props.onPress).toBeUndefined();
  });

  it('sends the commission for a graduate', async () => {
    const r = await open(<ServiceScreen />, serving(withDegree(person)));
    const row = rowTitled(r, 'Apply for a commission');
    expect(row.props.disabled).toBe(false);
    expect(row.props).not.toHaveProperty('subtitle');
    await act(() => row.props.onPress());
    expect(serve).toHaveBeenCalledWith({ type: 'commission' });
  });

  it('has no commission row for an officer', async () => {
    const r = await open(<ServiceScreen />, serving(withDegree(person), { track: 'officer' }));
    expect(titles(r)).not.toContain('Apply for a commission');
    expect(titles(r)).toContain('Retire from service');
  });

  it('greys Retire before twenty years, and sends it at twenty', async () => {
    const early = await open(<ServiceScreen />, serving(person, { years: 19 }));
    const shut = rowTitled(early, 'Retire from service');
    expect(shut.props.disabled).toBe(true);
    expect(shut.props.subtitle).toBe(
      'Retiring opens at twenty years of service, and not during training.',
    );
    expect(shut.props.onPress).toBeUndefined();
    await act(() => early.unmount());
    rendered = undefined;

    const r = await open(<ServiceScreen />, serving(person, { years: 20, termEnds: 24 }));
    const row = rowTitled(r, 'Retire from service');
    expect(row.props.disabled).toBe(false);
    await act(() => row.props.onPress());
    expect(serve).toHaveBeenCalledWith({ type: 'retire' });
  });

  it('lists honours under their own heading only when there are some', async () => {
    const bare = await open(<ServiceScreen />, serving(person));
    expect(headings(bare)).not.toContain('Honours');
    await act(() => bare.unmount());
    rendered = undefined;
    const state = serving(person);
    const r = await open(<ServiceScreen />, {
      ...state,
      military: { ...state.military, decorations: [{ id: 'purple-heart', age: 24 }] },
    });
    expect(headings(r)).toEqual(['Honours', 'What you can do']);
    expect(titles(r)).toContain('Purple Heart');
    expectWellFormed(r);
  });

  it('shows no empty-state words', async () => {
    const r = await open(<ServiceScreen />, serving(person));
    expect(has(r, 'Not in uniform')).toBe(false);
  });
});

describe('Service, out of uniform', () => {
  it('says so, and offers the recruiter', async () => {
    const r = await open(<ServiceScreen />, person);
    expect(has(r, 'Not in uniform')).toBe(true);
    expect(has(r, 'Recruiters take people from seventeen')).toBe(true);
    expect(titles(r)).toEqual(['Enlist']);
    const enlist = rowTitled(r, 'Enlist');
    expect(enlist.props.disabled).toBe(false);
    await act(() => enlist.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'recruiter', title: 'The recruiter' });
    expectWellFormed(r);
  });

  it('greys Enlist with the reason when no branch would take the person', async () => {
    const r = await open(<ServiceScreen />, withStats(person, { health: 10 }));
    const enlist = rowTitled(r, 'Enlist');
    expect(enlist.props.disabled).toBe(true);
    expect(enlist.props.subtitle).toBe(
      "The physical turned you away. You're not well enough for this yet.",
    );
    expect(enlist.props.onPress).toBeUndefined();
  });

  it('greys Enlist for the visit already made this year', async () => {
    const r = await open(<ServiceScreen />, {
      ...person,
      military: { past: [], appliedAge: age },
    });
    expect(rowTitled(r, 'Enlist').props.subtitle).toBe(
      "You've already been to the recruiting office this year.",
    );
  });

  it('still shows honours a past service earned', async () => {
    const state = veteran(person);
    const r = await open(<ServiceScreen />, {
      ...state,
      military: { ...state.military, decorations: [{ id: 'bronze-star', age: 23 }] },
    });
    expect(headings(r)).toEqual(['Honours']);
    expect(titles(r)).toEqual(['Enlist', 'Bronze Star']);
  });
});

describe('the recruiter', () => {
  it('starts at the branches, and moves on to the jobs when one is chosen', async () => {
    const r = await open(<RecruiterScreen />, person);
    expect(has(r, 'Which branch?')).toBe(true);
    expect(titles(r)).toEqual(['Army', 'Navy', 'Marine Corps', 'Air Force', 'Coast Guard']);
    expect(titles(r)).not.toContain('Start over');
    await press(r, 'Navy');
    expect(has(r, 'What job do you want?')).toBe(true);
    expect(titles(r)).toContain("Boatswain's Mate");
    expect(titles(r)).toContain('Start over');
    expect(serve).not.toHaveBeenCalled();
    expect(pop).not.toHaveBeenCalled();
    expectWellFormed(r);
  });

  it('starts over from the branches on a press', async () => {
    const r = await open(<RecruiterScreen />, person);
    await press(r, 'Navy');
    await press(r, 'Start over');
    expect(has(r, 'Which branch?')).toBe(true);
    expect(titles(r)).toContain('Army');
    expect(titles(r)).not.toContain('Start over');
  });

  it('enlists in the job chosen, and goes back once it works', async () => {
    const r = await open(<RecruiterScreen />, person);
    await press(r, 'Navy');
    const jobs = rowsOf(r).filter((row) => row.props.title !== 'Start over');
    await act(() => jobs[0]!.props.onPress());
    expect(serve).toHaveBeenCalledWith({
      type: 'enlist',
      branch: 'navy',
      track: 'enlisted',
      specialty: 'navy.boatswain',
    });
    expect(pop).toHaveBeenCalledTimes(1);
  });

  it('asks a graduate which road, and sends the commission when that is the one chosen', async () => {
    const r = await open(<RecruiterScreen />, withDegree(person));
    await press(r, 'Army');
    expect(has(r, 'Which road?')).toBe(true);
    expect(titles(r)).toEqual(['Enlist', 'Apply for a commission', 'Start over']);
    await press(r, 'Apply for a commission');
    expect(has(r, 'What job do you want?')).toBe(true);
    await press(r, 'Infantry');
    expect(serve).toHaveBeenCalledWith({
      type: 'enlist',
      branch: 'army',
      track: 'officer',
      specialty: 'army.infantry',
    });
    expect(pop).toHaveBeenCalledTimes(1);
  });

  it('sends the enlisted road when a graduate chooses to enlist', async () => {
    const r = await open(<RecruiterScreen />, withDegree(person));
    await press(r, 'Army');
    await press(r, 'Enlist');
    await press(r, 'Infantry');
    expect(serve).toHaveBeenCalledWith(expect.objectContaining({ track: 'enlisted' }));
  });

  it('greys a branch the person does not meet, with the reason, and does not open it', async () => {
    const r = await open(<RecruiterScreen />, withStats(person, { smarts: 35 }));
    const shut = rowsOf(r).filter((row) => row.props.disabled === true);
    expect(shut.length).toBeGreaterThan(0);
    for (const row of shut) {
      expect(row.props.subtitle).toBe("The aptitude test didn't go your way.");
      expect(row.props.onPress).toBeUndefined();
    }
  });

  it('greys a job the person lacks the aptitude for, and sends nothing for it', async () => {
    const weak = withStats(person, { smarts: 31, health: 52, discipline: 20 });
    const r = await open(<RecruiterScreen />, weak);
    await press(r, 'Army');
    const shut = rowsOf(r).filter((row) => row.props.disabled === true);
    expect(shut.length).toBeGreaterThan(0);
    for (const row of shut) {
      expect(row.props.subtitle).toBe("You don't qualify for that job yet.");
      expect(row.props.onPress).toBeUndefined();
    }
    expect(serve).not.toHaveBeenCalled();
  });

  it('stays at the table when the engine turns the visit down', async () => {
    const visited: GameState = { ...person, military: { past: [], appliedAge: age } };
    const r = await open(<RecruiterScreen />, visited);
    await press(r, 'Army');
    await press(r, 'Infantry');
    expect(serve).toHaveBeenCalledTimes(1);
    expect(pop).not.toHaveBeenCalled();
  });

  it('has nothing to offer somebody already in uniform', async () => {
    const r = await open(<RecruiterScreen />, serving(person));
    expect(has(r, "You're in uniform")).toBe(true);
    expect(rowsOf(r)).toHaveLength(0);
  });
});

describe('Veteran', () => {
  const retired = veteran(person, { years: 22, how: 'retired', finalGrade: 7, endedAge: age - 1 });

  it('shows retired pay, the GI Bill, the preference and what came before', async () => {
    const r = await open(<VeteranScreen />, retired);
    expect(headings(r)).toEqual(['The GI Bill', 'Before']);
    expect(titles(r)).toEqual([
      'Retired pay',
      'GI Bill',
      'Left to use',
      'Tuition',
      'Housing',
      'Hiring preference',
      'Army, Sergeant First Class',
    ]);
    expect(rowTitled(r, 'Retired pay').props.value).toBe('$33,381 a year');
    expect(rowTitled(r, 'GI Bill').props.value).toBe('All of it');
    expect(rowTitled(r, 'Left to use').props.value).toBe('36 of 36 months');
    expect(rowTitled(r, 'Hiring preference').props.value).toBe('Yes');
    expectWellFormed(r);
  });

  it('leaves out Before when there is nothing before, as for a serving member', async () => {
    const r = await open(<VeteranScreen />, serving(person));
    expect(headings(r)).toEqual(['The GI Bill']);
    expect(rowTitled(r, 'Retired pay').props.value).toBe('None yet');
    expect(rowTitled(r, 'GI Bill').props.value).toBe('Not yet');
    expectWellFormed(r);
  });

  it('says how each service ended and the discharge, in the row', async () => {
    const r = await open(
      <VeteranScreen />,
      veteran(person, { how: 'misconduct', discharge: 'dishonorable', years: 3 }),
    );
    expect(rowTitled(r, 'Army, Sergeant').props.subtitle).toBe(
      'You were court-martialed. Dishonorable discharge.',
    );
  });
});

describe('the FBI and the CIA', () => {
  const ready = agencyReady();

  it('shows the door to somebody with no agency career, and applies on a press', async () => {
    const r = await open(<CiaScreen />, ready);
    expect(headings(r)).toEqual(['What it asks']);
    expect(titles(r)).toEqual(['Age', 'Education', 'Clearance', 'Apply to the CIA']);
    expect(rowTitled(r, 'Age').props.value).toBe('21 to 45');
    const apply = rowTitled(r, 'Apply to the CIA');
    expect(apply.props.disabled).toBe(false);
    expect(apply.props).not.toHaveProperty('subtitle');
    await act(() => apply.props.onPress());
    expect(serve).toHaveBeenCalledWith({ type: 'applyAgency', agency: 'cia' });
    expectWellFormed(r);
  });

  it('is a separate screen for the FBI, with its own door', async () => {
    const r = await open(<FbiScreen />, ready);
    expect(titles(r)).toEqual(['Age', 'Education', 'Experience', 'Clearance', 'Apply to the FBI']);
    expect(rowTitled(r, 'Age').props.value).toBe('23 to 36');
    const apply = rowTitled(r, 'Apply to the FBI');
    expect(apply.props.disabled).toBe(true);
    expect(apply.props.subtitle).toBe("They want more professional experience than you've got.");
    expect(apply.props.onPress).toBeUndefined();
  });

  it('opens the door to a graduate with no service at all, which is the point of its being separate', async () => {
    const r = await open(<CiaScreen />, ready);
    expect(ready.military.past).toEqual([]);
    expect(rowTitled(r, 'Apply to the CIA').props.disabled).toBe(false);
    expect(has(r, 'count for you')).toBe(false);
  });

  it('says what counts for an applicant who has a clearance or has worked in intelligence', async () => {
    const analyst = veteran(ready, { specialty: 'army.intelligence', years: 4 });
    const r = await open(<CiaScreen />, analyst);
    expect(has(r, 'Your years in intelligence count for you.')).toBe(true);
  });

  it('says nothing special for a veteran whose years were not in intelligence', async () => {
    const r = await open(<CiaScreen />, veteran(ready));
    expect(has(r, 'count for you')).toBe(false);
  });

  it('greys Apply for somebody in uniform, and for somebody without a degree', async () => {
    const a = await open(<CiaScreen />, serving(ready));
    expect(rowTitled(a, 'Apply to the CIA').props.subtitle).toBe(
      "You're in uniform. Leave the service first; a clearance stays good for two years.",
    );
    await act(() => a.unmount());
    rendered = undefined;
    const b = await open(<CiaScreen />, at(person, 30));
    expect(rowTitled(b, 'Apply to the CIA').props.subtitle).toBe(
      "It takes a bachelor's degree, and you don't have one.",
    );
  });

  it('shows an agent’s career, the bar, and the two verbs', async () => {
    const r = await open(<FbiScreen />, inAgency(ready));
    expect(titles(r)).toEqual([
      'Title',
      'Posting',
      'At the agency',
      'Pay',
      'Your name',
      'How it is going',
      'Put the work in',
      'Leave the agency',
    ]);
    expect(headings(r)).toEqual(['What you can do']);
    expect(rowTitled(r, 'Title').props.value).toBe('Special Agent');
    const going = rowTitled(r, 'How it is going');
    expect(going.props.meter).toBe(60);
    expect(going.props.subtitle).toBe('Getting by');
    expect(textsOf(r).join(' | ')).not.toMatch(/\b60\b/);
    await press(r, 'Put the work in');
    expect(serve).toHaveBeenLastCalledWith({ type: 'work' });
    await press(r, 'Leave the agency');
    expect(serve).toHaveBeenLastCalledWith({ type: 'leaveAgency' });
    expectWellFormed(r);
  });

  it('calls leaving "retire" with the years and the age', async () => {
    const r = await open(<FbiScreen />, at(inAgency(ready, { years: 22 }), 52));
    expect(titles(r)).toContain('Retire from the agency');
    expect(titles(r)).not.toContain('Leave the agency');
  });

  it('turns the bar red under the floor', async () => {
    const r = await open(<FbiScreen />, inAgency(ready, { performance: 30 }));
    expect(rowTitled(r, 'How it is going').props.meterColor).toBe(colors.negative);
  });

  it('says the other agency is closed to somebody who works for one', async () => {
    const r = await open(<CiaScreen />, inAgency(ready));
    expect(has(r, 'You work for another agency')).toBe(true);
    expect(has(r, 'Leave that one first. CIA will be here.')).toBe(true);
    expect(rowsOf(r)).toHaveLength(0);
    expect(buttonsOf(r)).toHaveLength(0);
  });

  it('lists a former career under Before, beside the door', async () => {
    const state: GameState = {
      ...ready,
      intel: { past: [pastAgency({ agency: 'cia', years: 4, how: 'resigned', finalGrade: 10 })] },
    };
    const r = await open(<CiaScreen />, state);
    expect(headings(r)).toEqual(['What it asks', 'Before']);
    expect(titles(r)).toContain('Case Officer');
    expect(rowTitled(r, 'Case Officer').props.subtitle).toBe('You resigned.');
    expectWellFormed(r);
  });

  it('shows the other agency’s past only on its own screen', async () => {
    const state: GameState = { ...ready, intel: { past: [pastAgency({ agency: 'fbi' })] } };
    const r = await open(<CiaScreen />, state);
    expect(headings(r)).toEqual(['What it asks']);
  });
});

describe('what the screens never say', () => {
  it('prints no number from the engine’s hidden state on any screen', async () => {
    const hidden = { performance: 73, reputation: 67 };
    const cases: [React.ReactElement, GameState][] = [
      [<FbiScreen key="f" />, inAgency(agencyReady(), hidden)],
      [<CiaScreen key="c" />, inAgency(agencyReady(), { ...hidden, agency: 'cia' })],
      [<ServiceScreen key="s" />, serving(person, hidden)],
    ];
    for (const [element, state] of cases) {
      const r = await open(element, state);
      expect(textsOf(r).join(' | ')).not.toMatch(/\b(73|67)\b/);
      await act(() => r.unmount());
      rendered = undefined;
    }
  });
});
