/**
 * Ticket 0708 — the card for meeting somebody famous, and the Fame bar on the Life screen.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { ENCOUNTER_MENU } from '@yearafter/content';
import { encounterFor, encounterMenu, type GameState } from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { LifeScreen } from '../screens/LifeScreen';
import { ADULT, atGeneration, withCash, withFame, withMeeting } from '../test/fameFixtures';
import { hosts, show, textsOf } from '../test/harness';
import { FameBar } from './FameBar';
import { MeetingCard, MeetingNotice, meetingCardProps } from './MeetingCard';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const meetThem = vi.fn();
const push = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

const FAMOUS = withFame(withCash(ADULT, 900_000), 90);
const MET = withMeeting(FAMOUS);

const pressables = (r: ReactTestRenderer) =>
  hosts(r, 'Pressable').filter((node) => node.props.accessibilityRole === 'button');

async function notice(state: GameState, extra: object = {}) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, meetThem, ...extra });
  rendered = await show(<MeetingNotice />);
  return rendered;
}

describe('the card', () => {
  it('names the person and the scene, and lists all six things to do', async () => {
    const encounter = encounterFor(MET)!;
    const props = meetingCardProps(encounter, encounterMenu(MET));
    expect(props.actions.map((a) => a.id)).toEqual([
      'compliment',
      'flirt',
      'autograph',
      'picture',
      'insult',
      'ignore',
    ]);
    expect(props.actions).toHaveLength(ENCOUNTER_MENU.length);
    const r = await notice(MET);
    const texts = textsOf(r);
    expect(texts).toContain('A chance meeting');
    expect(texts).toContain(props.name);
    expect(texts).toContain(`${props.role}, ${props.standing}`);
    expect(texts).toContain(encounter.text);
    expect(pressables(r)).toHaveLength(6);
  });

  it('presses the one asked for', async () => {
    const r = await notice(MET);
    const buttons = pressables(r);
    await act(() => buttons[2]!.props.onPress());
    expect(meetThem).toHaveBeenCalledWith('autograph');
    await act(() => buttons[5]!.props.onPress());
    expect(meetThem).toHaveBeenLastCalledWith('ignore');
  });

  it('shows why flirting is out and does nothing when it is pressed', async () => {
    const child = { ...MET, player: { ...MET.player, age: 12 } };
    const found = [...Array(3000).keys()]
      .map((generation) => atGeneration(child, generation))
      .find((trial) => encounterFor(trial) !== undefined);
    expect(found).toBeDefined();
    const r = await notice(found!);
    const flirt = pressables(r).find((node) => node.props.accessibilityLabel?.startsWith('Flirt'))!;
    expect(flirt.props.accessibilityLabel).toBe('Flirt. One of you is too young for that.');
    expect(flirt.props.onPress).toBeUndefined();
    expect(flirt.props.accessibilityState).toEqual({ disabled: true });
    expect(textsOf(r)).toContain('One of you is too young for that.');
    expect(pressables(r).filter((node) => node.props.onPress !== undefined)).toHaveLength(5);
  });

  it('is the card as plain data when handed a menu', async () => {
    rendered = await show(
      <MeetingCard
        name="Test Person"
        role="an actor"
        standing="well known"
        text="You see them."
        actions={[
          { id: 'a', label: 'One', blurb: 'First' },
          { id: 'b', label: 'Two', blurb: 'Second', why: 'Not now.' },
        ]}
        onChoose={meetThem}
      />,
    );
    expect(textsOf(rendered)).toEqual([
      'A chance meeting',
      'Test Person',
      'an actor, well known',
      'You see them.',
      'One',
      'First',
      'Two',
      'Not now.',
    ]);
  });
});

describe('when it appears', () => {
  it('appears once a meeting is on the table, and not when there is none', async () => {
    const some = await notice(MET);
    expect(some.toJSON()).not.toBeNull();
    const none = await notice(atGeneration(withFame(ADULT, 0), 0));
    expect(none.toJSON()).toBeNull();
  });

  it.each([
    ['a decision is pending', { decision: { eventId: 'e' } }],
    ['an answer is waiting', { outcome: { title: 'x', body: 'y', tone: 'good' } }],
    ['a breakdown is open', { detail: { title: 'x' } }],
  ])('waits while %s', async (_name, extra) => {
    const r = await notice(MET, extra);
    expect(r.toJSON()).toBeNull();
  });

  it('is gone for a character who has died', async () => {
    const dead = { ...MET, player: { ...MET.player, alive: false } };
    const r = await notice(dead);
    expect(r.toJSON()).toBeNull();
  });

  it('is gone once it has been answered this year', async () => {
    const answered = {
      ...MET,
      celebrities: { ...MET.celebrities, answeredYear: MET.world.year },
    };
    expect(encounterFor(answered)).toBeUndefined();
    const r = await notice(answered);
    expect(r.toJSON()).toBeNull();
  });
});

describe('the Fame bar', () => {
  it('shows the exact figure and a bar at that fill', async () => {
    rendered = await show(<FameBar fame={37} />);
    expect(textsOf(rendered)).toEqual(['Fame', '37%']);
    const bar = rendered.root.findAll((n) => n.props.accessibilityRole === 'progressbar')[0]!;
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 37 });
    expect(hosts(rendered, 'Pressable')).toHaveLength(0);
  });

  it('clamps what it draws and opens the Fame screen when pressed', async () => {
    const onPress = vi.fn();
    rendered = await show(<FameBar fame={140} onPress={onPress} />);
    const bar = rendered.root.findAll((n) => n.props.accessibilityRole === 'progressbar')[0]!;
    expect(bar.props.accessibilityValue.now).toBe(100);
    expect(textsOf(rendered)).toContain('100%');
    await act(() => hosts(rendered!, 'Pressable')[0]!.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  async function life(state: GameState) {
    vi.mocked(useGame, { partial: true }).mockReturnValue({ state, lastEntries: [] });
    vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
    rendered = await show(<LifeScreen />);
    return rendered;
  }

  it('is on the Life screen only once there is fame, however it was got', async () => {
    const none = await life(withFame(ADULT, 0));
    expect(none.root.findAllByType(FameBar)).toHaveLength(0);
    const some = await life(withFame(ADULT, 1));
    expect(some.root.findAllByType(FameBar)).toHaveLength(1);
    expect(textsOf(some)).toContain('1%');
  });

  it('opens the Fame screen from the Life screen', async () => {
    const r = await life(withFame(ADULT, 37));
    await act(() => r.root.findByType(FameBar).props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'fame', title: 'Fame' });
  });
});

describe('what the card is made from', () => {
  const encounter = encounterFor(MET)!;

  it('names the person as they are known, and how known they are, from their fame', () => {
    const props = meetingCardProps(encounter, encounterMenu(MET));
    expect(props.name).toBe(`${encounter.figure.firstName} ${encounter.figure.lastName}`);
    const word =
      encounter.fame >= 85
        ? 'a global star'
        : encounter.fame >= 60
          ? 'a household name'
          : encounter.fame >= 30
            ? 'well known'
            : 'a rising name';
    expect(props.standing).toBe(word);
    // The standing really does depend on the fame, not on a constant.
    const lower = meetingCardProps({ ...encounter, fame: 12 }, encounterMenu(MET));
    expect(lower.standing).toBe('a rising name');
    const higher = meetingCardProps({ ...encounter, fame: 99 }, encounterMenu(MET));
    expect(higher.standing).toBe('a global star');
  });

  it('calls somebody in a field the game does not know a public figure', () => {
    const odd = { ...encounter, figure: { ...encounter.figure, field: 'sailing' as never } };
    expect(meetingCardProps(odd, encounterMenu(MET)).role).toBe('a public figure');
    const roles = {
      acting: 'an actor',
      music: 'a recording artist',
      athletics: 'a pro athlete',
      creator: 'a famous creator',
      business: 'a well-known founder',
      politics: 'a public official',
    };
    expect(meetingCardProps(encounter, encounterMenu(MET)).role).toBe(
      roles[encounter.figure.field],
    );
  });

  it('puts the reason beside what is refused, and nothing beside what is not', () => {
    const child = { ...MET, player: { ...MET.player, age: 12 } };
    const props = meetingCardProps(encounter, encounterMenu(child));
    expect(props.actions.filter((action) => action.why !== undefined).map((a) => a.id)).toEqual([
      'flirt',
    ]);
  });
});

describe('the bar fills to the fame', () => {
  it('is as wide as the percentage, exactly', async () => {
    for (const fame of [1, 37, 100]) {
      rendered = await show(<FameBar fame={fame} />);
      const fill = hosts(rendered, 'View').find((node) =>
        [node.props.style]
          .flat()
          .some((rule) => typeof rule?.width === 'string' && rule.backgroundColor === undefined),
      );
      const widths = [fill?.props.style].flat().map((rule) => rule?.width);
      expect(widths).toContain(`${fame}%`);
      await act(() => rendered?.unmount());
      rendered = undefined;
    }
  });
});
