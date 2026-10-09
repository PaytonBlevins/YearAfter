import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, dollars } from '@yearafter/core';
import { createNewGame, type GameState } from '@yearafter/simulation';
import { post } from '@yearafter/finance';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { GameProvider, useGame } from '../stores/gameStore';
import { VehicleScreen } from './VehiclesScreen';
import { buttonsOf, rowTitled, textsOf } from '../test/harness';
vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { vehicleId: 'ui-car' }, push: vi.fn(), pop: vi.fn() }),
}));
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  game = undefined;
});
async function mount(
  cash = 10000,
  service?: { year: number; cost: number },
  trimId = 'car.royata-camden.se',
) {
  const s = createNewGame({ seed: 'p11-ui', startYear: 2000 });
  const f = post(s.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(cash),
    source: 'Savings',
  });
  const state: GameState = {
    ...s,
    pending: [],
    finance: f.ledger,
    world: { ...s.world, year: 2030 },
    player: { ...s.player, age: 30, cash: f.ledger.balance },
    cards: [
      { productId: 'card.private', limit: dollars(10000), balance: dollars(0), status: 'open' },
    ],
    vehicles: [
      {
        id: 'ui-car',
        trimId,
        boughtYear: 2020,
        modelYear: 2030,
        purchasePrice: dollars(31500),
        value: dollars(29000),
        condition: 100,
        history: 'patchy',
        accident: false,
        behindYears: 0,
        ...(service ? { service } : {}),
      },
    ],
  };
  const repo = new MemorySaveRepository();
  const id = asSaveId('p11-ui');
  const saved = await repo.create(toSave(state, { id }));
  if (!saved.ok) throw Error(saved.error);
  await act(async () => {
    rendered = create(
      <GameProvider repository={repo}>
        <Probe />
        <VehicleScreen />
      </GameProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { repo, id, state };
}
function renderer() {
  if (!rendered) throw Error('render');
  return rendered;
}
async function press(label: string) {
  const b = buttonsOf(renderer()).find((b) => b.props.label.startsWith(label));
  if (!b) throw Error(label);
  await act(async () => {
    b.props.onPress();
    await Promise.resolve();
  });
}
describe('P11 owned car screen through real store, command and autosave', () => {
  it.each(['cash', 'card'] as const)(
    'shows extra price then confirms full %s payment',
    async (method) => {
      const { repo, id, state } = await mount();
      expect(textsOf(renderer()).join(' ')).toContain('Ordinary maintenance is already');
      expect(textsOf(renderer()).join(' ')).toContain('5–10 years longer');
      expect(buttonsOf(renderer()).some((b) => b.props.label.startsWith('Pay '))).toBe(false);
      await press('Arrange extra service — $230');
      expect(game?.state?.vehicles[0]?.service).toBeUndefined();
      await act(() =>
        rowTitled(
          renderer(),
          method === 'cash' ? 'Use cash' : 'Private Client Card',
        ).props.onPress(),
      );
      await press('Pay $230 with');
      expect(game?.state?.vehicles[0]?.service).toEqual({ year: 2030, cost: 230 });
      expect(game?.state?.player.cash).toBe(dollars(method === 'cash' ? 9770 : 10000));
      expect(game?.state?.cards[0]?.balance).toBe(dollars(method === 'card' ? 230 : 0));
      expect(game?.state?.vehicles[0]?.condition).toBe(state.vehicles[0]?.condition);
      expect(textsOf(renderer()).join(' ')).toContain('Serviced this year — covers next year');
      expect(buttonsOf(renderer()).some((b) => b.props.label.startsWith('Arrange'))).toBe(false);
      const loaded = await repo.load(id);
      if (!loaded.ok) throw Error(JSON.stringify(loaded.error));
      expect(loaded.value.vehicles[0]?.service).toEqual({ year: 2030, cost: 230 });
    },
  );
  it('shows last service and permits renewal when the old record is expired', async () => {
    await mount(10000, { year: 2029, cost: 230 });
    expect(textsOf(renderer()).join(' ')).toContain('Last extra service: 2029');
    await press('Arrange extra service');
    expect(rowTitled(renderer(), 'Use cash').props.disabled).toBe(false);
  });
  it('shows insufficient cash without silently drawing a card', async () => {
    await mount(229);
    await press('Arrange extra service');
    expect(rowTitled(renderer(), 'Use cash').props.disabled).toBe(true);
    expect(game?.state?.cards[0]?.balance).toBe(dollars(0));
    expect(game?.state?.vehicles[0]?.service).toBeUndefined();
  });
  it('speaks unsupported refusal and preserves the general sale/modification screen', async () => {
    await mount(10000, undefined, 'old-retired-car');
    expect(textsOf(renderer()).join(' ')).toContain(
      "Extra servicing isn't available for this car.",
    );
    expect(buttonsOf(renderer()).some((b) => b.props.label === 'Sell it')).toBe(true);
  });
  it('reports a repeated store action without a second invoice', async () => {
    await mount(10000, { year: 2030, cost: 230 });
    const before = JSON.stringify(game?.state);
    await act(() => game?.serviceACar('ui-car'));
    expect(JSON.stringify(game?.state)).toBe(before);
    expect(game?.outcome?.body).toContain('already paid');
  });
});
