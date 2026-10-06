/**
 * Ticket 0708 — the Fame screen and the screen for one famous person you know.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import {
  connectionMenu,
  fameOffers,
  notablesIn,
  type CelebrityTie,
  type GameState,
} from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { ADULT, channelOf, offeringWork, withCash, withFame } from '../test/fameFixtures';
import { rowTitled, rowsOf, show, textsOf } from '../test/harness';
import { ConnectionScreen, FameScreen } from './FameScreens';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
const doFameWork = vi.fn();
const connectWith = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

async function fame(state: GameState, route: object = { screen: 'fame', title: 'Fame' }) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, doFameWork, connectWith });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push, current: route as never });
  rendered = await show(<FameScreen />);
  return rendered;
}
async function connection(state: GameState, personId: string) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, doFameWork, connectWith });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    push,
    current: { screen: 'connection', title: 'Them', personId },
  });
  rendered = await show(<ConnectionScreen />);
  return rendered;
}

const RICH = withCash(ADULT, 50_000);

describe('the Fame screen', () => {
  it('shows the exact percentage', async () => {
    const r = await fame(withFame(RICH, 37));
    expect(textsOf(r)).toContain('37%');
    expect(textsOf(r)).toContain('Well known');
    const bar = r.root.findAll((node) => node.props.accessibilityRole === 'progressbar');
    expect(bar).toHaveLength(1);
    expect(bar[0]!.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 37 });
  });

  it('lists what is on offer with its pay, and says yes to the one that is pressed', async () => {
    const state = offeringWork(
      withFame({ ...RICH, channels: [channelOf('ch:f', 90_000)] }, 70),
      'commercial',
    );
    const offers = fameOffers(state);
    expect(offers.length).toBeGreaterThan(0);
    const r = await fame(state);
    for (const offer of offers) {
      const row = rowTitled(r, offer.def.label);
      expect(row.props.subtitle).toBe(offer.text);
      expect(row.props.value).toBe(`$${offer.pay.toLocaleString('en-US')}`);
    }
    const commercial = rowTitled(r, 'Commercial');
    await act(() => commercial.props.onPress());
    expect(doFameWork).toHaveBeenCalledTimes(1);
    expect(doFameWork).toHaveBeenCalledWith('commercial');
  });

  it('says what opens next when nothing has come in', async () => {
    const r = await fame(withFame(RICH, 3));
    expect(textsOf(r)).toContain(
      'Nothing has come in this year. A photoshoot opens up at 6% fame.',
    );
    const r2 = await fame(withFame(RICH, 8));
    expect(textsOf(r2).join(' ')).toContain('A commercial opens up at 12% fame.');
  });

  it('tells a child nobody will book them', async () => {
    const child = { ...withFame(RICH, 40), player: { ...RICH.player, age: 12 } };
    const r = await fame(child);
    expect(textsOf(r)).toContain('You have to be 16 before anyone books you.');
    expect(rowsOf(r).filter((row) => row.props.affordance === 'action')).toHaveLength(0);
  });

  it('shows what was done this year, with its pay', async () => {
    const state = offeringWork(
      withFame({ ...RICH, channels: [channelOf('ch:g', 90_000)] }, 70),
      'photoshoot',
    );
    const done = {
      ...state,
      celebrities: {
        ...state.celebrities,
        work: {
          year: state.world.year,
          done: [{ id: 'photoshoot', outlet: 'Juniper Row magazine', pay: 4770, fame: 1, mood: 1 }],
        },
      },
    };
    const r = await fame(done);
    const row = rowsOf(r).find((candidate) => candidate.props.subtitle === 'Juniper Row magazine');
    expect(row?.props.title).toBe('Photoshoot');
    expect(row?.props.value).toBe('$4,770');
    // A photoshoot done this year is not offered again.
    expect(fameOffers(done).some((offer) => offer.def.id === 'photoshoot')).toBe(false);
  });

  it('opens the Social Media screen', async () => {
    const r = await fame(withFame(RICH, 37));
    await act(() => rowTitled(r, 'Social Media').props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'socialMedia', title: 'Social Media' });
  });
});

function knowing(state: GameState, field: string, over: Partial<CelebrityTie> = {}) {
  const year = state.world.year;
  const figure = notablesIn(state.rng.getSeed(), year).find((f) => f.field === field)!;
  const tie: CelebrityTie = {
    id: figure.id,
    name: `${figure.firstName} ${figure.lastName}`,
    sex: figure.sex,
    field: figure.field,
    birthYear: figure.birthYear,
    metYear: year - 1,
    metAtAge: state.player.age - 1,
    warmth: 50,
    lastContactYear: year - 1,
    doneYear: 0,
    done: [],
    ...over,
  };
  return { state: { ...state, celebrities: { ...state.celebrities, ties: [tie] } }, tie };
}

describe('people you know', () => {
  it('lists them with who they are and how well you know them, and opens one', async () => {
    const { state, tie } = knowing(withFame(RICH, 40), 'acting');
    const r = await fame(state);
    const row = rowsOf(r).find((candidate) => candidate.props.title === tie.name)!;
    expect(row.props.subtitle).toMatch(
      /^An actor · (a rising name|well known|a household name|a global star)$/,
    );
    expect(row.props.value).toBe('friend');
    await act(() => row.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'connection', title: tie.name, personId: tie.id });
  });

  it('marks somebody who has gone out of touch and does not open them', async () => {
    const { state, tie } = knowing(withFame(RICH, 40), 'acting', { endedYear: 2020 });
    const r = await fame(state);
    const row = rowsOf(r).find((candidate) => candidate.props.title === tie.name)!;
    expect(row.props.value).toBe('Out of touch');
    expect(row.props.disabled).toBe(true);
  });

  it('says nothing has come of meeting anyone, when nothing has', async () => {
    const r = await fame(withFame(RICH, 40));
    expect(textsOf(r).join(' ')).toContain("You haven't made a connection with anyone famous.");
  });
});

describe('one famous person', () => {
  it('shows the whole menu, with the reason beside what cannot be done', async () => {
    const { state, tie } = knowing(withFame(RICH, 40), 'acting');
    const menu = connectionMenu(state, tie.id);
    const r = await connection(state, tie.id);
    for (const action of menu) {
      const row = rowTitled(r, action.label);
      expect(row.props.disabled).toBe(action.refusal !== undefined);
      expect(row.props.subtitle).toBe(
        action.refusal === undefined ? action.blurb : row.props.subtitle,
      );
    }
    const refused = menu.filter((action) => action.refusal !== undefined);
    expect(refused.length).toBeGreaterThan(0);
    for (const action of refused) {
      expect(rowTitled(r, action.label).props.subtitle).not.toBe(action.blurb);
      expect(rowTitled(r, action.label).props.onPress).toBeUndefined();
    }
  });

  it('does the thing that is pressed, to that person', async () => {
    const { state, tie } = knowing(withFame(RICH, 40), 'acting');
    const r = await connection(state, tie.id);
    await act(() => rowTitled(r, 'Catch up').props.onPress());
    expect(connectWith).toHaveBeenCalledWith(tie.id, 'catchUp');
  });

  it('says there is nobody there when the person is not known', async () => {
    const r = await connection(withFame(RICH, 40), 'acting:1990:1');
    expect(textsOf(r)).toContain("You don't know them");
  });
});

describe('the Fame screen, more carefully', () => {
  it('books at sixteen and not at fifteen', async () => {
    const at = (age: number) => ({ ...withFame(RICH, 40), player: { ...RICH.player, age } });
    const fifteen = await fame(at(15));
    expect(textsOf(fifteen)).toContain('You have to be 16 before anyone books you.');
    const sixteen = await fame(at(16));
    expect(textsOf(sixteen).join(' ')).not.toContain('before anyone books you');
  });

  it('says nothing else came in, and does not repeat what opens next, once the year has had its work', async () => {
    const state = withFame(RICH, 8);
    const worked = {
      ...state,
      celebrities: {
        ...state.celebrities,
        work: {
          year: state.world.year,
          done: [{ id: 'photoshoot', outlet: 'Juniper Row magazine', pay: 200, fame: 1, mood: 1 }],
        },
      },
    };
    expect(fameOffers(worked)).toHaveLength(0);
    const r = await fame(worked);
    expect(textsOf(r)).toContain('Nothing else has come in this year.');
    expect(textsOf(r).filter((text) => text.includes('opens up'))).toEqual([]);
  });

  it('says what opens next once, whether or not anything is on offer', async () => {
    const none = await fame(withFame(RICH, 3));
    expect(textsOf(none).filter((text) => text.includes('opens up'))).toHaveLength(1);
    const state = offeringWork(
      withFame({ ...RICH, channels: [channelOf('ch:h', 90_000)] }, 15),
      'photoshoot',
    );
    const some = await fame(state);
    expect(textsOf(some).filter((text) => text.includes('opens up'))).toEqual([
      'A talk show opens up at 20%.',
    ]);
  });

  it('says nothing is left to unlock at the top', async () => {
    const top = offeringWork(
      withFame({ ...RICH, channels: [channelOf('ch:t', 90_000)] }, 100),
      'guestStar',
    );
    const r = await fame(top);
    expect(textsOf(r).filter((text) => text.includes('opens up'))).toEqual([]);
  });

  it('ignores work from an earlier year', async () => {
    const state = withFame(RICH, 8);
    const stale = {
      ...state,
      celebrities: {
        ...state.celebrities,
        work: {
          year: state.world.year - 1,
          done: [{ id: 'photoshoot', outlet: 'Juniper Row magazine', pay: 200, fame: 1, mood: 1 }],
        },
      },
    };
    const r = await fame(stale);
    expect(textsOf(r)).not.toContain('DONE THIS YEAR');
    expect(rowsOf(r).some((row) => row.props.subtitle === 'Juniper Row magazine')).toBe(false);
  });
});
