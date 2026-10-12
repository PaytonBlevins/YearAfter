/**
 * Ticket 0809 — the sports, acting, music, modeling screens and the hub that opens them.
 *
 * The game store and the navigator are mocked; what is checked is what is on screen, in words,
 * and which verb a press sends.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  castingCalls,
  modelBrandOffers,
  modelCalls,
  musicCollabOffers,
  type GameState,
} from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import {
  ADULT,
  at,
  withActing,
  withBookedCash,
  withCareer,
  withModeling,
  withMusic,
  withPast,
} from '../test/entertainmentFixtures';
import { SectionHeading } from '../components';
import { expectWellDivided, expectWellFormed } from '../test/wellFormed';
import { buttonLabelled, buttonsOf, rowTitled, rowsOf, show, textsOf } from '../test/harness';
import {
  ActingScreen,
  EntertainmentScreen,
  ModelingScreen,
  MusicScreen,
  SportsScreen,
  StudiesScreen,
} from './EntertainmentScreens';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
const entertain = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function open(element: React.ReactElement, state: GameState) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, entertain });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
  rendered = await show(element);
  return rendered;
}

const titles = (r: ReactTestRenderer) => rowsOf(r).map((row) => row.props.title as string);
const has = (r: ReactTestRenderer, text: string) => textsOf(r).some((t) => t.includes(text));
const headings = (r: ReactTestRenderer) =>
  r.root.findAllByType(SectionHeading).map((node) => node.props.children as string);

describe('the hub', () => {
  it('lists the five fields and opens each one', async () => {
    const r = await open(<EntertainmentScreen />, ADULT);
    expect(titles(r)).toEqual([
      'Sports',
      'Martial Arts and Karting',
      'Acting',
      'Music',
      'Modeling',
    ]);
    const routes: [string, string][] = [
      ['Sports', 'sports'],
      ['Martial Arts and Karting', 'studies'],
      ['Acting', 'acting'],
      ['Music', 'music'],
      ['Modeling', 'modeling'],
    ];
    for (const [title, screen] of routes) {
      const row = rowTitled(r, title);
      expect(row.props.disabled).toBe(false);
      await act(() => row.props.onPress());
      expect(push).toHaveBeenLastCalledWith({ screen, title });
    }
    expect(push).toHaveBeenCalledTimes(5);
  });

  it('says what each field is up to, and shows the standing only once there is one', async () => {
    const state = withActing(ADULT, { credits: 4, tier: 'working' });
    const r = await open(<EntertainmentScreen />, state);
    expect(rowTitled(r, 'Acting').props.subtitle).toBe('4 credits');
    expect(rowTitled(r, 'Acting').props.value).toBeDefined();
    expect(rowTitled(r, 'Modeling').props.subtitle).toBe('No jobs yet');
    expect(rowTitled(r, 'Modeling').props).not.toHaveProperty('value');
  });

  it('closes a field to somebody too young, with the age it opens at, and does not open it', async () => {
    const r = await open(<EntertainmentScreen />, at(ADULT, 9));
    const modeling = rowTitled(r, 'Modeling');
    expect(modeling.props.disabled).toBe(true);
    expect(modeling.props.subtitle).toMatch(/^From age \d+$/);
    expect(modeling.props.onPress).toBeUndefined();
    expect(modeling.props).not.toHaveProperty('value');
  });

  it('renders nothing before a life has begun', async () => {
    vi.mocked(useGame, { partial: true }).mockReturnValue({ state: undefined });
    vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
    rendered = await show(<EntertainmentScreen />);
    expect(rendered.toJSON()).toBeNull();
  });
});

describe('the sports screen', () => {
  it('says there is no team, and points to where teams start', async () => {
    const r = await open(<SportsScreen />, ADULT);
    expect(has(r, 'No team')).toBe(true);
    const clubs = rowTitled(r, 'Clubs and Teams');
    await act(() => clubs.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'schoolActivities', title: 'Clubs & Teams' });
    expect(entertain).not.toHaveBeenCalled();
  });

  it('shows the career, the game as bars, and puts the work in on a press', async () => {
    const r = await open(<SportsScreen />, withCareer(ADULT));
    expect(titles(r)).toContain('Harbor City Gulls, basketball');
    expect(rowTitled(r, 'Standing').props.value).toBe('A starter');
    expect(rowTitled(r, 'Contract').props.value).toBe('$2,400,000 a year');
    const meters = rowsOf(r).filter((row) => row.props.meter !== undefined);
    expect(meters.length).toBeGreaterThan(0);
    for (const row of meters) expect(typeof row.props.meter).toBe('number');
    const work = rowTitled(r, 'Put the work in');
    expect(work.props.disabled).toBe(false);
    await act(() => work.props.onPress());
    expect(entertain).toHaveBeenCalledWith({ type: 'train' });
  });

  it('shows no number a player should not see', async () => {
    const r = await open(<SportsScreen />, withCareer(ADULT, { form: 71, reputation: 43 }));
    const everything = textsOf(r).join(' | ');
    expect(everything).not.toMatch(/\b71\b/);
    expect(everything).not.toMatch(/\b43\b/);
    expect(everything).not.toMatch(/hours?\b/i);
  });

  it('stops offering the work when the year has none left', async () => {
    const r = await open(
      <SportsScreen />,
      withCareer(ADULT, { trainedAtAge: ADULT.player.age, trainedCount: 3 }),
    );
    const work = rowTitled(r, 'Put the work in');
    expect(work.props.disabled).toBe(true);
    expect(work.props.onPress).toBeUndefined();
    expect(work.props.subtitle).toBe('You have trained as much as the year allows');
  });

  it('has no extra work for a school team, which has its own button elsewhere', async () => {
    const r = await open(
      <SportsScreen />,
      withCareer(ADULT, { stage: 'school', tier: undefined, contract: undefined }),
    );
    expect(titles(r)).not.toContain('Put the work in');
  });

  it('shows a job in the game and leaves it on a press', async () => {
    const state: GameState = {
      ...ADULT,
      sports: {
        ...ADULT.sports,
        post: { sportId: 'basketball', kind: 'coach', level: 'local', since: 40, seasons: 2 },
      },
    };
    const r = await open(<SportsScreen />, state);
    expect(headings(r).includes('Your job in the game')).toBe(true);
    const leave = rowTitled(r, 'Leave the job');
    await act(() => leave.props.onPress());
    expect(entertain).toHaveBeenCalledWith({ type: 'leavePost' });
  });

  it('lists a finished career under Before', async () => {
    const r = await open(
      <SportsScreen />,
      withPast(ADULT, [
        {
          sportId: 'baseball',
          startedAge: 15,
          endedAge: 31,
          seasons: 12,
          titles: 2,
          reputation: 55,
          reached: 'pro',
          bestTier: 'star',
          how: 'retired',
        },
      ]),
    );
    expect(headings(r).includes('Before')).toBe(true);
    expect(titles(r)).toContain('Baseball, 15 to 31');
  });

  it('shows the chart with the player marked, for a pro', async () => {
    const r = await open(<SportsScreen />, withCareer(ADULT, { tier: 'superstar', titles: 4 }));
    expect(headings(r).includes('Awards and charts')).toBe(true);
    expect(textsOf(r).some((t) => /^You are \d+(st|nd|rd|th) on the PBA rankings\.$/.test(t))).toBe(
      true,
    );
    expect(titles(r).some((t) => /^\d+\. You$/.test(t))).toBe(true);
    const marked = rowsOf(r).filter((row) => row.props.accent === true);
    expect(marked).toHaveLength(1);
  });

  it('says nothing about awards where there is nothing true to say', async () => {
    const r = await open(<SportsScreen />, withCareer(ADULT, { stage: 'school', tier: undefined }));
    expect(headings(r).includes('Awards and charts')).toBe(false);
  });
});

describe('martial arts and karting', () => {
  it('lists every study, and opens one to start it', async () => {
    const r = await open(<StudiesScreen />, ADULT);
    expect(titles(r)).toContain('Boxing');
    expect(titles(r)).toContain('Karting');
    await act(() => rowTitled(r, 'Boxing').props.onPress());
    expect(has(r, 'a year once you pay for it') || has(r, 'Free')).toBe(true);
    const start = buttonLabelled(r, 'Start');
    expect(start.props.disabled).toBe(false);
    await act(() => start.props.onPress());
    expect(entertain).toHaveBeenCalledWith({ type: 'art', artId: 'boxing', do: 'start' });
  });

  it('disables Start for an art that is too young for the player', async () => {
    const r = await open(<StudiesScreen />, at(ADULT, 9));
    await act(() => rowTitled(r, 'Boxing').props.onPress());
    const button = buttonsOf(r).find((b) => String(b.props.label).startsWith('From age'))!;
    expect(button.props.disabled).toBe(true);
  });

  it('puts the work in and stops an art being studied', async () => {
    const studying: GameState = {
      ...ADULT,
      sports: {
        ...ADULT.sports,
        arts: [
          {
            artId: 'boxing',
            startedAge: 20,
            seasons: 3,
            hardSeasons: 0,
            level: 40,
            trainedAtAge: -1,
            trainedCount: 0,
          },
        ],
      },
    };
    const r = await open(<StudiesScreen />, studying);
    expect(rowTitled(r, 'Boxing').props.value).toBe('Counts');
    expect(rowTitled(r, 'Boxing').props.meta).toBe('3 seasons in');
    expect(has(r, 'On the road to Boxing.')).toBe(true);
    await act(() => rowTitled(r, 'Boxing').props.onPress());
    await act(() => buttonLabelled(r, 'Put the work in').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'art', artId: 'boxing', do: 'train' });
    await act(() => buttonLabelled(r, 'Stop').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'art', artId: 'boxing', do: 'stop' });
  });

  it('says why a third cannot be started', async () => {
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
    const r = await open(<StudiesScreen />, two);
    await act(() => rowTitled(r, 'Taekwondo').props.onPress());
    expect(buttonLabelled(r, 'Start').props.disabled).toBe(true);
    expect(has(r, 'There are only hours for two at a time.')).toBe(true);
  });
});

describe('the acting screen', () => {
  it('shows where the actor is and lists the casting calls with their odds', async () => {
    const r = await open(<ActingScreen />, ADULT);
    expect(titles(r)).toContain('Where you are');
    const calls = castingCalls(ADULT);
    for (const call of calls) {
      const row = rowTitled(r, call.role.title);
      expect(row.props.value).toBe(`$${call.role.fee.toLocaleString('en-US')}`);
      expect(row.props.meta).toMatch(/^\d+% chance · .+/);
    }
    expect(has(r, '2 applications left')).toBe(true);
  });

  it('applies to the call that is opened, once', async () => {
    const call = castingCalls(ADULT)[0]!;
    const r = await open(<ActingScreen />, ADULT);
    await act(() => rowTitled(r, call.role.title).props.onPress());
    const apply = buttonsOf(r).find((b) => String(b.props.label).startsWith('Apply'))!;
    expect(apply.props.label).toBe(`Apply — ${Math.round(call.chance * 100)}% chance`);
    await act(() => apply.props.onPress());
    expect(entertain).toHaveBeenCalledWith({
      type: 'apply',
      field: 'acting',
      callId: call.role.id,
    });
  });

  it('says so when the applications are used up, and offers no button', async () => {
    const calls = castingCalls(ADULT);
    const spent = withActing(ADULT, {
      appliedAge: ADULT.player.age,
      applied: [calls[1]!.role.id, calls[2]!.role.id],
    });
    const r = await open(<ActingScreen />, spent);
    await act(() => rowTitled(r, calls[0]!.role.title).props.onPress());
    expect(has(r, 'You have put in all the applications this year allows.')).toBe(true);
    expect(buttonsOf(r).some((b) => String(b.props.label).startsWith('Apply'))).toBe(false);
  });

  it('says a call has been applied for, and offers no second application', async () => {
    const call = castingCalls(ADULT)[0]!;
    const state = withActing(ADULT, { appliedAge: ADULT.player.age, applied: [call.role.id] });
    const r = await open(<ActingScreen />, state);
    expect(rowTitled(r, call.role.title).props.meta).toBe('You have applied');
    await act(() => rowTitled(r, call.role.title).props.onPress());
    expect(has(r, 'You have already put your name in for this one.')).toBe(true);
  });

  it('sends lessons, a character and an agent', async () => {
    const r = await open(<ActingScreen />, ADULT);
    await act(() => rowTitled(r, 'Take acting lessons').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'lessons', field: 'acting', on: true });
    await act(() => rowTitled(r, 'Work on a character').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'develop' });
    await act(() => rowTitled(r, 'Sign with an agent').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'agent', field: 'acting', on: true });
  });

  it('turns the same rows around once lessons and an agent are in place', async () => {
    const state = withActing(ADULT, {
      lessons: { since: 20, seasons: 1 },
      agent: { since: 20 },
    });
    const r = await open(<ActingScreen />, state);
    await act(() => rowTitled(r, 'Stop acting lessons').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'lessons', field: 'acting', on: false });
    await act(() => rowTitled(r, 'Let your agent go').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'agent', field: 'acting', on: false });
  });

  it('shuts the character session when the year has none left', async () => {
    const r = await open(
      <ActingScreen />,
      withActing(ADULT, { devAtAge: ADULT.player.age, devCount: 3 }),
    );
    const row = rowTitled(r, 'Work on a character');
    expect(row.props.disabled).toBe(true);
    expect(row.props.onPress).toBeUndefined();
    expect(row.props.subtitle).toBe('You have done enough this year');
  });
});

describe('the music screen', () => {
  it('plans a release one at a time, and takes one off', async () => {
    const state = withMusic(ADULT, { plan: { single: 1, ep: 0, lp: 0, tour: false } });
    const r = await open(<MusicScreen />, state);
    const single = rowTitled(r, 'Single');
    expect(single.props.value).toBe('1 planned');
    expect(rowTitled(r, 'EP').props.value).toBe('None planned');
    await act(() => single.props.onPress());
    await act(() => buttonLabelled(r, 'Plan one more').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'release', kind: 'single', count: 2 });
    await act(() => buttonLabelled(r, 'Take one off').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'release', kind: 'single', count: 0 });
  });

  it('will not take one off when none is planned, or plan past the cap', async () => {
    const r = await open(<MusicScreen />, ADULT);
    await act(() => rowTitled(r, 'Album').props.onPress());
    expect(buttonLabelled(r, 'Take one off').props.disabled).toBe(true);
    const full = withMusic(ADULT, { plan: { single: 0, ep: 0, lp: 2, tour: false } });
    const f = await open(<MusicScreen />, full);
    await act(() => rowTitled(f, 'Album').props.onPress());
    expect(buttonLabelled(f, 'Plan one more').props.disabled).toBe(true);
  });

  it('offers a tour only to an act with the audience for one', async () => {
    const small = await open(<MusicScreen />, ADULT);
    expect(titles(small)).not.toContain('Plan a tour');
    const big = withMusic(ADULT, { listeners: 60_000 });
    const r = await open(<MusicScreen />, big);
    const row = rowTitled(r, 'Plan a tour');
    expect(row.props.subtitle).toMatch(/shows? · about \$[\d,]+ at the door/);
    await act(() => row.props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'tour', on: true });
  });

  it('sends a demo with its odds, and hides the option once there is a deal', async () => {
    const r = await open(<MusicScreen />, ADULT);
    const demo = rowTitled(r, 'Send a demo to labels');
    expect(demo.props.subtitle).toMatch(/^\d+% chance of a call back\. Once a year\.$/);
    await act(() => demo.props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'demo' });
    const signed = withMusic(ADULT, {
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
    });
    const d = await open(<MusicScreen />, signed);
    expect(titles(d)).not.toContain('Send a demo to labels');
    expect(titles(d)).toContain('Low Tide Records');
  });

  it('shows collaborations asked for, and answers them', async () => {
    const state = withBookedCash(
      withMusic(ADULT, { released: { single: 2, ep: 0, lp: 0 }, listeners: 5_000 }),
      100_000,
    );
    const offer = musicCollabOffers(state)[0]!;
    const r = await open(<MusicScreen />, state);
    expect(headings(r).includes('Asked to work together')).toBe(true);
    const row = rowTitled(r, offer.partner.name);
    expect(row.props.value).toBe(offer.fee > 0 ? `$${offer.fee.toLocaleString('en-US')}` : 'Free');
    await act(() => row.props.onPress());
    await act(() => buttonLabelled(r, 'Work together').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({
      type: 'collab',
      offerId: offer.id,
      accept: true,
    });
    await act(() => rowTitled(r, offer.partner.name).props.onPress());
    await act(() => buttonLabelled(r, 'Pass').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({
      type: 'collab',
      offerId: offer.id,
      accept: false,
    });
  });

  it('has no collaboration section when nobody has asked', async () => {
    const r = await open(<MusicScreen />, ADULT);
    expect(headings(r).includes('Asked to work together')).toBe(false);
  });

  it('sends music lessons both ways', async () => {
    const r = await open(<MusicScreen />, ADULT);
    await act(() => rowTitled(r, 'Take music lessons').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'lessons', field: 'music', on: true });
    const on = await open(
      <MusicScreen />,
      withMusic(ADULT, { lessons: { since: 20, seasons: 1 } }),
    );
    await act(() => rowTitled(on, 'Stop music lessons').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'lessons', field: 'music', on: false });
  });
});

describe('the modeling screen', () => {
  it('lists castings with the client and the fee, and applies to the one opened', async () => {
    const call = modelCalls(ADULT)[0]!;
    const r = await open(<ModelingScreen />, ADULT);
    expect(has(r, '3 applications left')).toBe(true);
    const row = rowTitled(r, call.job.client);
    expect(row.props.meta).toMatch(/^\d+% chance · .+/);
    await act(() => row.props.onPress());
    const apply = buttonsOf(r).find((b) => String(b.props.label).startsWith('Apply'))!;
    await act(() => apply.props.onPress());
    expect(entertain).toHaveBeenCalledWith({
      type: 'apply',
      field: 'modeling',
      callId: call.job.id,
    });
  });

  it('answers a brand three ways', async () => {
    const state = withModeling(ADULT, { credits: 3, followers: 5_000 });
    const offer = modelBrandOffers(state)[0]!;
    const r = await open(<ModelingScreen />, state);
    expect(headings(r).includes('Brand deals')).toBe(true);
    for (const [label, answer] of [
      ['Take it', 'accept'],
      ['Ask for more', 'more'],
      ['Pass', 'decline'],
    ] as const) {
      await act(() => rowTitled(r, offer.brand).props.onPress());
      await act(() => buttonLabelled(r, label).props.onPress());
      expect(entertain).toHaveBeenLastCalledWith({ type: 'brand', offerId: offer.id, answer });
    }
  });

  it('has no brand section before the first job', async () => {
    const r = await open(<ModelingScreen />, ADULT);
    expect(headings(r).includes('Brand deals')).toBe(false);
  });

  it('shows new pictures with what they cost, and shuts the row once they are done', async () => {
    const own: GameState = { ...ADULT, household: { ...ADULT.household, housing: 'ownPlace' } };
    const r = await open(<ModelingScreen />, own);
    const pictures = rowTitled(r, 'New pictures');
    expect(pictures.props.subtitle).toBe('A shoot of your own, $900');
    await act(() => pictures.props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'portfolio' });
    const done = await open(
      <ModelingScreen />,
      withModeling(own, { portfolioAge: own.player.age }),
    );
    const shut = rowTitled(done, 'New pictures');
    expect(shut.props.disabled).toBe(true);
    expect(shut.props.onPress).toBeUndefined();
    expect(shut.props.subtitle).toBe('You had them done this year');
  });

  it('signs with an agency, and leaves one', async () => {
    const r = await open(<ModelingScreen />, ADULT);
    await act(() => rowTitled(r, 'Sign with an agency').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'agent', field: 'modeling', on: true });
    const signed = await open(<ModelingScreen />, withModeling(ADULT, { agency: { since: 20 } }));
    await act(() => rowTitled(signed, 'Leave your agency').props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'agent', field: 'modeling', on: false });
  });
});

/* -------------------------------------------------------------------------- */
/* The shape every screen shares, and the copy the sabotage pass found untested */
/* -------------------------------------------------------------------------- */

describe('the shape every screen shares', () => {
  const lives: [string, () => Promise<ReactTestRenderer>][] = [
    [
      'hub',
      () => open(<EntertainmentScreen />, withActing(ADULT, { credits: 4, tier: 'working' })),
    ],
    ['sports', () => open(<SportsScreen />, withCareer(ADULT, { tier: 'superstar', titles: 4 }))],
    ['studies', () => open(<StudiesScreen />, ADULT)],
    ['acting', () => open(<ActingScreen />, withActing(ADULT, { credits: 4, tier: 'working' }))],
    [
      'music',
      () =>
        open(
          <MusicScreen />,
          withMusic(ADULT, { listeners: 60_000, released: { single: 2, ep: 0, lp: 0 } }),
        ),
    ],
    [
      'modeling',
      () => open(<ModelingScreen />, withModeling(ADULT, { credits: 3, followers: 5_000 })),
    ],
  ];

  it.each(lives)(
    '%s: rows and hairlines alternate, and presses are honest',
    async (_name, make) => {
      const r = await make();
      expectWellFormed(r);
    },
  );
});

describe('copy that has to read right', () => {
  it('sports: the empty state and the extra work', async () => {
    const empty = await open(<SportsScreen />, ADULT);
    expect(textsOf(empty).join(' ')).toContain(
      'School teams are where it starts. A scholarship, a draft, a tour card or a place in a national program can follow.',
    );
    expect(rowTitled(empty, 'Clubs and Teams').props.subtitle).toBe('Try out at school');
    const r = await open(<SportsScreen />, withCareer(ADULT));
    expect(rowTitled(r, 'Put the work in').props.subtitle).toBe('Extra time on your game');
  });

  it('studies: a counted art says Counts, a young one says Studying, a spent one says why', async () => {
    const studying = (seasons: number, trainedCount = 0): GameState => ({
      ...ADULT,
      sports: {
        ...ADULT.sports,
        arts: [
          {
            artId: 'boxing',
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
    const young = await open(<StudiesScreen />, studying(1));
    expect(rowTitled(young, 'Boxing').props.value).toBe('Studying');
    expect(rowTitled(young, 'Boxing').props.meta).toBe('1 season in');
    const spent = await open(<StudiesScreen />, studying(1, 3));
    await act(() => rowTitled(spent, 'Boxing').props.onPress());
    const button = buttonLabelled(spent, 'You have trained enough this year');
    expect(button.props.disabled).toBe(true);
    const fresh = await open(<StudiesScreen />, studying(1, 1));
    await act(() => rowTitled(fresh, 'Boxing').props.onPress());
    expect(buttonLabelled(fresh, 'Put the work in').props.disabled).toBe(false);
    expect(textsOf(fresh).join(' ')).toContain(
      'Two at a time. Three seasons of an art starts to count towards a fight career, and karting is where a driver’s career starts.'.replace(
        '’',
        "'",
      ),
    );
  });

  it('studies: an art opens for exactly the age it starts at', async () => {
    const r = await open(<StudiesScreen />, at(ADULT, 10));
    await act(() => rowTitled(r, 'Boxing').props.onPress());
    expect(buttonLabelled(r, 'Start').props.disabled).toBe(false);
    const young = await open(<StudiesScreen />, at(ADULT, 9));
    await act(() => rowTitled(young, 'Boxing').props.onPress());
    expect(buttonLabelled(young, 'From age 10').props.disabled).toBe(true);
    expect(textsOf(young).join(' ')).not.toContain('There are only hours for two at a time.');
  });

  it('acting: what each row says in each of its two states', async () => {
    const r = await open(<ActingScreen />, ADULT);
    expect(rowTitled(r, 'Take acting lessons').props.subtitle).toBe(
      'A course, paid for by the year',
    );
    expect(rowTitled(r, 'Work on a character').props.subtitle).toBe('A session on your own');
    expect(rowTitled(r, 'Sign with an agent').props.subtitle).toBe(
      'More applications, a tenth of your pay',
    );
    const on = await open(
      <ActingScreen />,
      withActing(ADULT, {
        lessons: { since: 20, seasons: 1 },
        agent: { since: 20 },
        devAtAge: ADULT.player.age,
        devCount: 2,
      }),
    );
    expect(rowTitled(on, 'Stop acting lessons').props.subtitle).toBe('You are taking a course');
    expect(rowTitled(on, 'Let your agent go').props.subtitle).toBe(
      'They take a tenth of what you earn',
    );
    // One session left is still a session.
    expect(rowTitled(on, 'Work on a character').props.disabled).toBeFalsy();
    expect(rowTitled(on, 'Work on a character').props.subtitle).toBe('A session on your own');
  });

  it('acting: booked roles are listed under Booked, and not before there are any', async () => {
    const none = await open(<ActingScreen />, ADULT);
    expect(none.root.findAllByType(SectionHeading).map((n) => n.props.children)).not.toContain(
      'Booked',
    );
    const role = castingCalls(ADULT)[0]!.role;
    const { source: _s, asked: _a, ...booked } = role;
    const r = await open(
      <ActingScreen />,
      withActing(ADULT, { booked: [{ ...booked, bookedAge: ADULT.player.age }] }),
    );
    expect(r.root.findAllByType(SectionHeading).map((n) => n.props.children)).toContain('Booked');
    expect(titles(r)).toContain(role.title);
  });

  it('music: a tour, a plan and the demo odds read as sentences', async () => {
    const big = withMusic(ADULT, {
      listeners: 60_000,
      plan: { single: 0, ep: 0, lp: 0, tour: true },
    });
    const r = await open(<MusicScreen />, big);
    const tour = rowTitled(r, 'Cancel the tour');
    expect(tour.props.value).toBe('Planned');
    await act(() => tour.props.onPress());
    expect(entertain).toHaveBeenLastCalledWith({ type: 'tour', on: false });
    const single = rowTitled(r, 'Single');
    expect(single.props.subtitle).toBe('0 out · up to 15 a year · $300 each');
    await act(() => single.props.onPress());
    expect(buttonLabelled(r, 'Take one off').props.variant).toBe('quiet');
  });

  it('modeling: brand pay is paid with next year’s income, and the answers are styled as asked', async () => {
    const state = withModeling(ADULT, { credits: 3, followers: 5_000 });
    const offer = modelBrandOffers(state)[0]!;
    const r = await open(<ModelingScreen />, state);
    const row = rowTitled(r, offer.brand);
    expect(row.props.subtitle).toBe("Paid with next year's income");
    await act(() => row.props.onPress());
    expect(buttonLabelled(r, 'Ask for more').props.variant).toBe('secondary');
    expect(buttonLabelled(r, 'Pass').props.variant).toBe('quiet');
  });

  it('modeling: one application left is still an application', async () => {
    const ids = modelCalls(ADULT).map((call) => call.job.id);
    const used = withModeling(ADULT, { appliedAge: ADULT.player.age, applied: ids.slice(1, 3) });
    const r = await open(<ModelingScreen />, used);
    await act(() => rowTitled(r, modelCalls(ADULT)[0]!.job.client).props.onPress());
    expect(buttonsOf(r).some((b) => String(b.props.label).startsWith('Apply'))).toBe(true);
  });

  it('collaborations: the answer to one does not open another', async () => {
    const state = withBookedCash(
      withMusic(ADULT, { released: { single: 2, ep: 0, lp: 0 }, listeners: 5_000 }),
      100_000,
    );
    const r = await open(<MusicScreen />, state);
    const offer = musicCollabOffers(state)[0]!;
    await act(() => rowTitled(r, offer.partner.name).props.onPress());
    await act(() => buttonLabelled(r, 'Work together').props.onPress());
    expect(buttonsOf(r).some((b) => b.props.label === 'Work together')).toBe(false);
  });
});

describe('what is shown only when it is true', () => {
  it('shows no game, no extra work and no awards for a school team', async () => {
    const r = await open(
      <SportsScreen />,
      withCareer(ADULT, { stage: 'school', tier: undefined, contract: undefined }),
    );
    expect(headings(r)).not.toContain('Your game');
    expect(headings(r)).not.toContain('Extra work');
    expect(headings(r)).not.toContain('Before');
    expect(headings(r)).not.toContain('Your job in the game');
  });

  it('has no Booked heading in modeling until a job is booked', async () => {
    const r = await open(<ModelingScreen />, ADULT);
    expect(headings(r)).not.toContain('Booked');
    const job = modelCalls(ADULT)[0]!.job;
    const { source: _s, asked: _a, ...booked } = job;
    const b = await open(
      <ModelingScreen />,
      withModeling(ADULT, { booked: [{ ...booked, bookedAge: ADULT.player.age }] }),
    );
    expect(headings(b)).toContain('Booked');
  });

  it('shows a modeler’s wins even though modeling has no chart', async () => {
    const records = [
      {
        id: 'r1',
        age: 30,
        year: 2040,
        category: 'award' as const,
        label: 'Model of the Year, the Atelier Awards, 2040',
      },
    ];
    const state: GameState = {
      ...withModeling(ADULT, { credits: 3 }),
      player: { ...ADULT.player, records: records as never },
    };
    const r = await open(<ModelingScreen />, state);
    expect(headings(r)).toContain('Awards and charts');
    expect(textsOf(r).join(' ')).not.toContain('You aren’t on');
  });

  it('shows a chart without an empty card above it for an unknown actor', async () => {
    const r = await open(<ActingScreen />, ADULT);
    expect(headings(r)).toContain('Awards and charts');
    expect(textsOf(r).join(' ')).toContain('You aren’t on the Marquee List yet.');
  });

  it('puts a hairline between two brand deals', async () => {
    let two: GameState | undefined;
    for (let step = 0; step < 80 && !two; step += 1) {
      const trial: GameState = {
        ...withModeling(ADULT, { credits: 3, followers: 50_000 }),
        world: { ...ADULT.world, year: ADULT.world.year + step },
      };
      if (modelBrandOffers(trial).length >= 2) two = trial;
    }
    expect(two).toBeDefined();
    const r = await open(<ModelingScreen />, two!);
    expectWellDivided(r);
  });

  it('describes the studies and the lessons exactly', async () => {
    const r = await open(<MusicScreen />, ADULT);
    expect(rowTitled(r, 'Take music lessons').props.subtitle).toBe(
      'A teacher, paid for by the year',
    );
    // At home the family pays for the pictures; the adult in the fixture lives on their own.
    const home: GameState = { ...ADULT, household: { ...ADULT.household, housing: 'withFamily' } };
    const m = await open(<ModelingScreen />, home);
    expect(rowTitled(m, 'New pictures').props.subtitle).toBe('A shoot of your own');
    expect(rowTitled(m, 'Sign with an agency').props.subtitle).toBe(
      'More castings, a fifth of your pay',
    );
    const signed = await open(<ModelingScreen />, withModeling(ADULT, { agency: { since: 20 } }));
    expect(rowTitled(signed, 'Leave your agency').props.subtitle).toBe(
      'They take a fifth of what you earn',
    );
  });

  it('stays on one session left for the sport, the art and the character', async () => {
    const age = ADULT.player.age;
    const sport = await open(
      <SportsScreen />,
      withCareer(ADULT, { trainedAtAge: age, trainedCount: 2 }),
    );
    expect(rowTitled(sport, 'Put the work in').props.subtitle).toBe('Extra time on your game');
    expect(rowTitled(sport, 'Put the work in').props.onPress).toBeDefined();
    const act = await open(<ActingScreen />, withActing(ADULT, { devAtAge: age, devCount: 2 }));
    expect(rowTitled(act, 'Work on a character').props.onPress).toBeDefined();
  });

  it('shows From age N on a study only below that age', async () => {
    const at10 = await open(<StudiesScreen />, at(ADULT, 10));
    expect(rowTitled(at10, 'Boxing').props).toHaveProperty('meta', undefined);
    const at9 = await open(<StudiesScreen />, at(ADULT, 9));
    expect(rowTitled(at9, 'Boxing').props.meta).toBe('From age 10');
  });
});

describe('found by the sabotage pass, second round', () => {
  it('shows a contract with the years it has left, under the row it belongs to', async () => {
    const r = await open(<SportsScreen />, withCareer(ADULT));
    expect(rowTitled(r, 'Contract').props.subtitle).toBe('3 years left');
    expectWellFormed(r);
  });

  it('shows a modeler’s single win as a row', async () => {
    const records = [
      {
        id: 'r1',
        age: 30,
        year: 2040,
        category: 'award' as const,
        label: 'Model of the Year, the Atelier Awards, 2040',
      },
    ];
    const state: GameState = {
      ...withModeling(ADULT, { credits: 3 }),
      player: { ...ADULT.player, records: records as never },
    };
    const r = await open(<ModelingScreen />, state);
    expect(rowTitled(r, 'The Atelier Awards').props.value).toBe('1 win');
    expectWellFormed(r);
  });

  it('shows no empty card for a life that only has a past', async () => {
    const r = await open(
      <SportsScreen />,
      withPast(ADULT, [
        {
          sportId: 'baseball',
          startedAge: 15,
          endedAge: 31,
          seasons: 12,
          titles: 2,
          reputation: 55,
          reached: 'pro',
          bestTier: 'star',
          how: 'retired',
        },
      ]),
    );
    expectWellFormed(r);
  });

  it('is well formed with a job in the game, and with a study opened', async () => {
    const holding: GameState = {
      ...ADULT,
      sports: {
        ...ADULT.sports,
        post: { sportId: 'basketball', kind: 'coach', level: 'local', since: 40, seasons: 2 },
      },
    };
    expectWellFormed(await open(<SportsScreen />, holding));
    const studying: GameState = {
      ...ADULT,
      sports: {
        ...ADULT.sports,
        arts: [
          {
            artId: 'boxing',
            startedAge: 20,
            seasons: 3,
            hardSeasons: 0,
            level: 40,
            trainedAtAge: ADULT.player.age,
            trainedCount: 2,
          },
        ],
      },
    };
    const r = await open(<StudiesScreen />, studying);
    await act(() => rowTitled(r, 'Boxing').props.onPress());
    // Two sessions used leaves one, which is still a session.
    expect(buttonLabelled(r, 'Put the work in').props.disabled).toBe(false);
    expectWellFormed(r);
  });

  it('is well formed with a plan opened, and with two collaborations asked for', async () => {
    const plan = await open(<MusicScreen />, withMusic(ADULT, { listeners: 60_000 }));
    await act(() => rowTitled(plan, 'Single').props.onPress());
    expectWellFormed(plan);
    let two: GameState | undefined;
    for (let step = 0; step < 120 && !two; step += 1) {
      const trial: GameState = {
        ...withMusic(ADULT, { released: { single: 2, ep: 0, lp: 0 }, listeners: 50_000 }),
        world: { ...ADULT.world, year: ADULT.world.year + step },
      };
      if (musicCollabOffers(trial).length >= 2) two = trial;
    }
    expect(two).toBeDefined();
    const r = await open(<MusicScreen />, two!);
    await act(() => rowTitled(r, musicCollabOffers(two!)[0]!.partner.name).props.onPress());
    expectWellFormed(r);
  });
});
