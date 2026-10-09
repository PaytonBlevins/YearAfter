import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, dollars } from '@yearafter/core';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { createNewGame, type GameState } from '@yearafter/simulation';
import { post, renovationSpaceFor } from '@yearafter/finance';
import { GameProvider, useGame } from '../stores/gameStore';
import { RenovateScreen } from './RenovateScreen';
import { rowTitled, buttonsOf, textsOf } from '../test/harness';
vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { screen: 'renovate', homeId: 'home:2000:0' } }),
}));
let r: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  if (r) await act(() => r?.unmount());
  r = undefined;
  game = undefined;
});
async function mount(ids: string[] = [], cash = 100000) {
  const base = createNewGame({ seed: 'p9-ui' });
  const f = post(base.finance, 2000, 30, {
    category: 'gift',
    amount: dollars(cash),
    source: 'Test funds',
  });
  const state: GameState = {
    ...base,
    finance: f.ledger,
    player: { ...base.player, age: 30, cash: f.ledger.balance },
    cards: [
      { productId: 'card.private', limit: dollars(50000), balance: dollars(0), status: 'open' },
    ],
    homes: [
      {
        id: 'home:2000:0',
        kindId: 'home.townhouse',
        beds: 3,
        baths: 2,
        builtYear: 1980,
        condition: 'good',
        regionKey: 'US:OH',
        regionName: 'Ohio',
        purchasePrice: dollars(500000),
        boughtYear: 2000,
        value: dollars(500000),
        expenseRate: 0.02,
        behindYears: 0,
        renovations: ids.map((renovationId) => ({ renovationId, cost: 12345, year: 1999 })),
      },
    ],
  };
  const repo = new MemorySaveRepository();
  const id = asSaveId('p9-ui');
  const saved = await repo.create(toSave(state, { id }));
  if (!saved.ok) throw Error(JSON.stringify(saved.error));
  const check = await repo.load(id);
  if (!check.ok) throw Error(JSON.stringify(check.error));
  await act(async () => {
    r = create(
      <GameProvider repository={repo}>
        <Probe />
        <RenovateScreen />
      </GameProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { repo, id };
}
describe('P9 real renovation screen and store', () => {
  it('quotes space, full upkeep and annual comfort before explicit cash payment and persists work', async () => {
    const { repo, id } = await mount();
    const screen = r!;
    expect(rowTitled(screen, 'Space').props.value).toBe('0 of 4 used · 4 left');
    const sauna = rowTitled(screen, 'Sauna');
    expect(sauna.props.subtitle).toContain('$355 a year');
    expect(sauna.props.subtitle).toContain('+1 yearly happiness');
    await act(() => sauna.props.onPress());
    expect(game!.state!.homes[0]!.renovations).toHaveLength(0);
    expect(buttonsOf(screen)).toHaveLength(0);
    await act(() => rowTitled(screen, 'Use cash').props.onPress());
    const pay = buttonsOf(screen)[0]!;
    expect(pay.props.label).toContain('$11,000');
    await act(async () => {
      pay.props.onPress();
      await Promise.resolve();
    });
    expect(game!.state!.player.cash).toBe(dollars(89000));
    expect(renovationSpaceFor(game!.state!.homes[0]!).used).toBe(1);
    const loaded = await repo.load(id);
    if (!loaded.ok) throw Error(loaded.error.kind);
    expect(loaded.value.homes[0]!.renovations?.at(-1)?.renovationId).toBe('reno.sauna');
  });
  it('offers a card when cash is short and commits the chosen method through the real store', async () => {
    await mount([], 0);
    await act(() => rowTitled(r!, 'Sauna').props.onPress());
    expect(rowTitled(r!, 'Use cash').props.disabled).toBe(true);
    const card = r!.root
      .findAll((n) => typeof n.props.title === 'string' && n.props.title === 'Private Client Card')
      .find((n) => n.props.onPress);
    expect(card).toBeDefined();
    await act(() => card!.props.onPress());
    const pay = buttonsOf(r!)[0]!;
    expect(pay.props.label).toContain('Private Client Card');
    await act(async () => {
      pay.props.onPress();
      await Promise.resolve();
    });
    expect(game!.state!.cards[0]!.balance).toBe(dollars(11000));
    expect(game!.state!.player.cash).toBe(dollars(0));
  });
  it('shows a spoken size refusal and a zero marginal comfort preview at the cap', async () => {
    await mount(['reno.gym', 'reno.theater', 'reno.study', 'reno.sauna']);
    const row = rowTitled(r!, 'Game Room');
    expect(row.props.disabled).toBe(true);
    expect(row.props.onPress).toBeUndefined();
    expect(row.props.subtitle).toBe("There isn't room for that addition here.");
    expect(rowTitled(r!, 'Security System').props.disabled).toBe(false);
    expect(textsOf(r!).join(' ')).toContain('0 left');
  });
  it('shows zero extra yearly comfort when another fitting amenity is chosen at the cap', async () => {
    await mount(['reno.gym', 'reno.theater', 'reno.study']);
    const sauna = rowTitled(r!, 'Sauna');
    expect(sauna.props.disabled).toBe(false);
    expect(sauna.props.subtitle).toContain('+0 yearly happiness');
    await act(() => sauna.props.onPress());
    expect(textsOf(r!).join(' ')).toContain('when your bills are paid');
  });
});
