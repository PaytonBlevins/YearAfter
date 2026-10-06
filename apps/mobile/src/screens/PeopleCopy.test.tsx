import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createPersonality } from '@yearafter/character';
import { asNpcId } from '@yearafter/core';
import { interactionsFor, movesFor, type Acquaintance } from '@yearafter/social';
import { createNewGame, type GameState } from '@yearafter/simulation';
import { ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { PersonScreen } from './PersonScreen';
import { PeopleScreen } from './PeopleScreen';
import { LoveScreen } from './LoveScreen';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
const push = vi.fn();
const interactWith = vi.fn();
const romanceWith = vi.fn();
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
const peer = (over: Partial<Acquaintance> = {}): Acquaintance => ({
  id: asNpcId('npc:people-copy'),
  firstName: 'Wren',
  lastName: 'Okafor',
  sex: 'female',
  birthYear: 2000,
  alive: true,
  tier: 3,
  personality: createPersonality(),
  relationship: 30,
  kind: 'peer',
  context: 'school',
  metAtAge: 6,
  lastContactAge: 25,
  memories: [],
  inRoom: true,
  ...over,
});
const base = (): GameState => {
  const state = createNewGame({ seed: 'people-copy' });
  return { ...state, player: { ...state.player, age: 25 } };
};
async function screen(element: React.ReactElement, state: GameState, person = peer()) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, interactWith, romanceWith });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    push,
    current: { screen: 'person', title: 'Wren', personId: person.id },
  });
  await act(() => {
    rendered = create(element);
  });
  if (!rendered) throw new Error('Screen did not render');
  return rendered.root.findAllByType(ListRow);
}
function text() {
  if (!rendered) throw new Error('Screen did not render');
  return rendered.root
    .findAll((node) => typeof node.type === 'string' && String(node.type) === 'Text')
    .map((node) => node.children.filter((child) => typeof child === 'string').join(''))
    .join(' ');
}

describe('A5 — people-screen explanations, excluding life events', () => {
  it('explains how to get to know somebody without promising unlimited actions', async () => {
    const person = peer();
    const rows = await screen(<PeopleScreen />, {
      ...base(),
      circle: { people: [person], contact: {} },
    });
    expect(text()).toContain("Open someone's page to get to know them");
    expect(text()).toContain('Some actions are limited each year');
    expect(text()).not.toContain('as often as you like');
    await act(() => rows.find((row) => row.props.title === 'Wren')?.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'person', title: 'Wren', personId: person.id });
  });
  it('explains the empty contacts screen', async () => {
    await screen(<PeopleScreen />, { ...base(), circle: { people: [], contact: {} } });
    expect(text()).toContain("You'll meet people when you start school");
  });
  it.each(['light', 'heavy'] as const)(
    'explains exhausted %s interactions and preserves disabled callbacks',
    async (weight) => {
      const person = peer({ relationship: 60 });
      const state = {
        ...base(),
        circle: {
          people: [person],
          contact: {
            [person.id]: {
              age: 25,
              light: weight === 'light' ? 20 : 0,
              heavy: weight === 'heavy' ? 1 : 0,
            },
          },
        },
      };
      const rows = await screen(<PersonScreen />, state, person);
      const choices = [
        ...interactionsFor(person),
        ...movesFor(person, 25, Number(state.player.cash)),
      ].filter((choice) => choice.weight === weight);
      expect(choices.length).toBeGreaterThan(0);
      for (const choice of choices) {
        const row = rows.find((candidate) => candidate.props.title === choice.label);
        expect(row?.props.disabled).toBe(true);
        expect(row?.props.onPress).toBeUndefined();
        expect(row?.props.subtitle).toContain('Try again next year');
        expect(row?.props.subtitle).toContain(
          weight === 'light' ? 'Wren' : 'once-a-year interaction',
        );
      }
    },
  );
  it('retains available friendship and romance commands without odds', async () => {
    const person = peer({ relationship: 60 });
    const state = { ...base(), circle: { people: [person], contact: {} } };
    const rows = await screen(<PersonScreen />, state, person);
    const friendship = interactionsFor(person).find((choice) => choice.weight === 'light');
    const romance = movesFor(person, 25, Number(state.player.cash)).find(
      (choice) => !choice.certain,
    );
    if (!friendship || !romance) throw new Error('Missing available actions');
    await act(() => rows.find((row) => row.props.title === friendship.label)?.props.onPress());
    await act(() => rows.find((row) => row.props.title === romance.label)?.props.onPress());
    expect(interactWith).toHaveBeenCalledWith(person.id, friendship.id);
    expect(romanceWith).toHaveBeenCalledWith(person.id, romance.id);
    expect(rows.find((row) => row.props.title === romance.label)?.props.value).toBeUndefined();
  });
  it('keeps saved memory wording intact and explains why a past contact remains', async () => {
    const memory = 'Wren kept the secret you shared.';
    const person = peer({
      endedAtAge: 24,
      endedBecause: 'drifted',
      memories: [{ age: 23, text: memory, major: true, warmth: 5 }],
    });
    const rows = await screen(
      <PersonScreen />,
      { ...base(), circle: { people: [person], contact: {} } },
      person,
    );
    expect(rows.find((row) => row.props.title === memory)).toBeDefined();
    expect(text()).toContain("You don't see this person anymore");
    expect(text()).toContain('look back at your memories together');
    expect(interactWith).not.toHaveBeenCalled();
  });
  it('explains missing contacts without referring to save internals', async () => {
    await screen(<PersonScreen />, { ...base(), circle: { people: [], contact: {} } });
    expect(text()).toContain('no longer in your contacts');
    expect(text()).not.toContain('save');
  });
  it('explains the dating age gate', async () => {
    const state = base();
    await screen(<LoveScreen />, {
      ...state,
      player: { ...state.player, age: 5 },
      circle: { people: [], contact: {} },
    });
    expect(text()).toContain("Dating isn't available at your age yet");
  });
  it('gives adults a direct explanation of where to meet people', async () => {
    await screen(<LoveScreen />, { ...base(), circle: { people: [], contact: {} } });
    expect(text()).toContain('meet people through work, school and activities');
  });
});
