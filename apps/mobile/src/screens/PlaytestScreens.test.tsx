import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createPersonality } from '@yearafter/character';
import { asNpcId, dollars } from '@yearafter/core';
import { type OwnedHome, type OwnedValuable, type OwnedVehicle } from '@yearafter/finance';
import { createNewGame, type GameState } from '@yearafter/simulation';
import { interactionsFor, movesFor, type Acquaintance } from '@yearafter/social';
import { ListRow } from '../components';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { PersonScreen } from './PersonScreen';
import { FinancesScreen } from './FinancesScreen';

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
  id: asNpcId('npc:playtest'),
  firstName: 'Wren',
  lastName: 'Okafor',
  sex: 'female',
  birthYear: 2000,
  alive: true,
  tier: 3,
  personality: createPersonality(),
  relationship: 60,
  kind: 'peer',
  context: 'school',
  metAtAge: 6,
  lastContactAge: 25,
  memories: [],
  inRoom: true,
  ...over,
});
const base = (): GameState => {
  const state = createNewGame({ seed: 'playtest-screens' });
  return { ...state, player: { ...state.player, age: 25 } };
};
async function screen(state: GameState, person?: Acquaintance) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, interactWith, romanceWith });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    push,
    current: person ? { screen: 'person', title: 'Wren', personId: person.id } : undefined,
  });
  await act(() => {
    rendered = create(person ? <PersonScreen /> : <FinancesScreen />);
  });
  if (!rendered) throw new Error('Screen did not render');
  return rendered.root.findAllByType(ListRow);
}

const valuable: OwnedValuable = {
  id: 'val:test',
  itemId: 'watch:test',
  boughtYear: 2025,
  purchasePrice: dollars(30_000),
  value: dollars(25_000),
};
const vehicle: OwnedVehicle = {
  id: 'car:test',
  trimId: 'trim:test',
  modelYear: 2024,
  boughtYear: 2025,
  purchasePrice: dollars(80_000),
  value: dollars(75_000),
  condition: 90,
  history: 'full',
  accident: false,
  behindYears: 0,
};
const home = (id: string, value: number): OwnedHome => ({
  id,
  kindId: 'home:test',
  beds: 3,
  baths: 2,
  builtYear: 2000,
  condition: 'good',
  regionKey: 'us:ohio',
  regionName: 'Ohio',
  purchasePrice: dollars(value),
  boughtYear: 2025,
  value: dollars(value),
  expenseRate: 0.02,
  behindYears: 0,
});

describe('A4 — people actions without odds labels', () => {
  it.each([10, 50, 95])(
    'keeps friendship and romance choices at warmth %i without odds',
    async (warmth) => {
      const person = peer({ relationship: warmth });
      const state = { ...base(), circle: { people: [person], contact: {} } };
      const rows = await screen(state, person);
      const choices = [
        ...interactionsFor(person),
        ...movesFor(person, 25, Number(state.player.cash)),
      ];
      expect(choices.length).toBeGreaterThan(0);
      for (const choice of choices) {
        const row = rows.find((candidate) => candidate.props.title === choice.label);
        expect(row, choice.label).toBeDefined();
        expect(row?.props.value).toBeUndefined();
      }
      expect(JSON.stringify(rendered?.toJSON())).not.toMatch(
        /Long shot|Unlikely|Likely|Safe|"Even"/,
      );
    },
  );

  it('still dispatches friendship and romantic actions to their existing commands', async () => {
    const person = peer();
    const state = { ...base(), circle: { people: [person], contact: {} } };
    const rows = await screen(state, person);
    const friendship = interactionsFor(person).find((choice) => choice.weight === 'light');
    const romance = movesFor(person, 25, Number(state.player.cash)).find(
      (choice) => !choice.certain,
    );
    if (!friendship || !romance) throw new Error('Fixture has no available choices');
    await act(() => rows.find((row) => row.props.title === friendship.label)?.props.onPress());
    await act(() => rows.find((row) => row.props.title === romance.label)?.props.onPress());
    expect(interactWith).toHaveBeenCalledWith(person.id, friendship.id);
    expect(romanceWith).toHaveBeenCalledWith(person.id, romance.id);
  });

  it('retains disabled actions and the reason after contact is spent', async () => {
    const person = peer();
    const state = {
      ...base(),
      circle: {
        people: [person],
        contact: {
          [person.id]: { age: 25, light: 20, heavy: 1 },
        },
      },
    };
    const rows = await screen(state, person);
    const choices = [
      ...interactionsFor(person),
      ...movesFor(person, 25, Number(state.player.cash)),
    ];
    expect(choices.length).toBeGreaterThan(0);
    for (const choice of choices) {
      const row = rows.find((candidate) => candidate.props.title === choice.label);
      expect(row?.props.disabled).toBe(true);
      expect(row?.props.onPress).toBeUndefined();
      expect(row?.props.subtitle).toMatch(/twice in a year|plenty/);
    }
  });
});

describe('A12 — Property reflects properties only', () => {
  it.each(['nothing', 'car', 'watch'] as const)(
    'hides Property when only %s is owned',
    async (asset) => {
      const rows = await screen({
        ...base(),
        vehicles: asset === 'car' ? [vehicle] : [],
        valuables: asset === 'watch' ? [valuable] : [],
      });
      expect(rows.some((row) => row.props.title === 'Property')).toBe(false);
    },
  );

  it('shows only the combined property value alongside other assets and opens Homes', async () => {
    const rows = await screen({
      ...base(),
      homes: [home('one', 250_000), home('two', 150_000)],
      vehicles: [vehicle],
      valuables: [valuable],
    });
    const property = rows.find((row) => row.props.title === 'Property');
    expect(property?.props.value).toBe('$400,000');
    expect(property?.props.subtitle).toBe('What your properties are worth now');
    expect(rows.find((row) => row.props.title === 'Net worth')?.props.value).not.toBe('$400,000');
    await act(() => property?.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'homes', title: 'Homes' });
  });
});
