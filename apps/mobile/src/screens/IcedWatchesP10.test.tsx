import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, dollars } from '@yearafter/core';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import {
  createNewGame,
  storeStock,
  valuablePurchaseQuote,
  type GameState,
} from '@yearafter/simulation';
import { post } from '@yearafter/finance';
import { GameProvider, useGame } from '../stores/gameStore';
import { StoreScreen, CollectionsScreen } from './ShoppingScreen';
import { rowTitled, buttonsOf, textsOf } from '../test/harness';
vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { screen: 'store', storeId: 'store.watches' }, push: vi.fn() }),
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
async function mount(
  collection = false,
  cash = 100000,
  iced = false,
  itemId = 'val.watch.rolux-subaquatic',
) {
  const base = createNewGame({ seed: 'p10-ui', startYear: 2000 });
  const f = post(base.finance, 2029, 29, {
    category: 'gift',
    amount: dollars(cash),
    source: 'Test savings',
  });
  const state: GameState = {
    ...base,
    pending: [],
    world: { ...base.world, year: 2030 },
    finance: f.ledger,
    player: { ...base.player, age: 30, cash: f.ledger.balance },
    cards: [
      { productId: 'card.private', limit: dollars(100000), balance: dollars(0), status: 'open' },
    ],
    valuables: collection
      ? [
          {
            id: 'owned:watch',
            itemId,
            boughtYear: 2020,
            purchasePrice: dollars(10400),
            value: dollars(9000),
            inheritedFrom: 'Test grandparent',
            ...(iced ? { icing: { cost: dollars(10000), year: 2025 } } : {}),
          },
        ]
      : [],
  };
  const repo = new MemorySaveRepository();
  const id = asSaveId('p10-ui');
  const saved = await repo.create(toSave(state, { id }));
  if (!saved.ok) throw Error(saved.error);
  const check = await repo.load(id);
  if (!check.ok) throw Error(JSON.stringify(check.error));
  await act(async () => {
    r = create(
      <GameProvider repository={repo}>
        <Probe />
        {collection ? <CollectionsScreen /> : <StoreScreen />}
      </GameProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { repo, id, state };
}
const pay = async () => {
  const button = buttonsOf(r!).find((b) => b.props.label.startsWith('Pay '));
  expect(button).toBeDefined();
  await act(async () => {
    button!.props.onPress();
    await Promise.resolve();
  });
};
describe('P10 real watch screens, store and autosave', () => {
  it.each(['cash', 'card'] as const)(
    'quotes ready-iced full invoice and explicitly pays with %s',
    async (method) => {
      const { repo, id, state } = await mount();
      const piece = storeStock(state, 'store.watches').find(
        (p) => p.item.icing?.kind === 'aftermarket',
      )!;
      expect(piece).toBeDefined();
      await act(() => rowTitled(r!, piece.item.name).props.onPress());
      await act(() => rowTitled(r!, 'Iced-out').props.onPress());
      const quote = valuablePurchaseQuote(piece, 'iced');
      if (!quote.ok) throw Error(quote.error);
      expect(textsOf(r!).join(' ')).toContain(
        `Total: $${quote.value.total.toLocaleString('en-US')}`,
      );
      expect(textsOf(r!).join(' ')).toContain(
        `Resale: $${quote.value.resale.toLocaleString('en-US')}`,
      );
      expect(game!.state!.valuables).toHaveLength(0);
      expect(buttonsOf(r!)).toHaveLength(0);
      await act(() =>
        rowTitled(r!, method === 'cash' ? 'Use cash' : 'Private Client Card').props.onPress(),
      );
      await pay();
      expect(game!.state!.valuables[0]!.icing).toEqual({
        cost: dollars(quote.value.work),
        year: 2030,
      });
      expect(game!.state!.player.cash).toBe(
        method === 'cash' ? dollars(100000 - quote.value.total) : dollars(100000),
      );
      expect(game!.state!.cards[0]!.balance).toBe(
        method === 'cash' ? dollars(0) : dollars(quote.value.total),
      );
      const loaded = await repo.load(id);
      if (!loaded.ok) throw Error(loaded.error.kind);
      expect(loaded.value.valuables).toEqual(game!.state!.valuables);
    },
  );
  it('clears a selected payment when the finish changes and leaves original cash purchases unchanged', async () => {
    const { state } = await mount();
    const piece = storeStock(state, 'store.watches').find(
      (p) => p.item.icing?.kind === 'aftermarket',
    )!;
    await act(() => rowTitled(r!, piece.item.name).props.onPress());
    await act(() => rowTitled(r!, 'Use cash').props.onPress());
    expect(buttonsOf(r!)).toHaveLength(1);
    await act(() => rowTitled(r!, 'Iced-out').props.onPress());
    expect(buttonsOf(r!)).toHaveLength(0);
    await act(() => rowTitled(r!, 'Original').props.onPress());
    await act(() => rowTitled(r!, 'Use cash').props.onPress());
    await pay();
    expect(game!.state!.valuables[0]!.icing).toBeUndefined();
    expect(game!.state!.player.cash).toBe(dollars(100000 - piece.price));
  });
  it('quotes current collection resale, pays by card with no cash, and persists provenance and work', async () => {
    const { repo, id } = await mount(true, 0);
    await act(() => rowTitled(r!, 'Rolux Subaquatic').props.onPress());
    expect(buttonsOf(r!).some((b) => b.props.label.startsWith('Sell it'))).toBe(true);
    await act(() =>
      buttonsOf(r!)
        .find((b) => b.props.label === 'Have it iced out')!
        .props.onPress(),
    );
    expect(textsOf(r!).join(' ')).toContain('Resale now: $9,000 · After work: $5,850');
    expect(rowTitled(r!, 'Use cash').props.disabled).toBe(true);
    await act(() => rowTitled(r!, 'Private Client Card').props.onPress());
    await pay();
    expect(game!.state!.valuables[0]).toMatchObject({
      value: dollars(5850),
      purchasePrice: dollars(10400),
      boughtYear: 2020,
      inheritedFrom: 'Test grandparent',
      icing: { cost: dollars(10000), year: 2030 },
    });
    expect(game!.state!.cards[0]!.balance).toBe(dollars(10000));
    expect(game!.state!.player.cash).toBe(dollars(0));
    expect(textsOf(r!).join(' ')).toContain('Iced out in 2030');
    expect(textsOf(r!).join(' ')).toContain('Total paid: $20,400');
    const loaded = await repo.load(id);
    if (!loaded.ok) throw Error(loaded.error.kind);
    expect(loaded.value.valuables).toEqual(game!.state!.valuables);
  });
  it('shows factory diamonds distinctly and does not offer a second customization', async () => {
    await mount(true, 100000, false, 'val.watch.jakob-timeless-treasure');
    await act(() => rowTitled(r!, 'Jakob & Co. Billionaire Timeless Treasure').props.onPress());
    expect(textsOf(r!).join(' ')).toContain('Factory-set diamonds');
    expect(buttonsOf(r!).some((b) => b.props.label === 'Have it iced out')).toBe(false);
  });
  it('shows a spoken stale-price refusal through the real store and saves no paid work', async () => {
    const { repo, id } = await mount(true);
    const before = game!.state;
    await act(() =>
      game!.iceAValuable('owned:watch', {
        kind: 'card',
        productId: 'card.private',
        expectedTotal: dollars(1),
      }),
    );
    expect(game!.state).toBe(before);
    expect(game!.outcome?.body).toContain('The price changed.');
    const loaded = await repo.load(id);
    if (!loaded.ok) throw Error(loaded.error.kind);
    expect(loaded.value.valuables[0]!.icing).toBeUndefined();
    expect(loaded.value.cards[0]!.balance).toBe(dollars(0));
  });
  it('shows an already-iced reason and keeps the general sale action available', async () => {
    await mount(true, 100000, true);
    await act(() => rowTitled(r!, 'Rolux Subaquatic').props.onPress());
    expect(textsOf(r!).join(' ')).toContain("This one's already iced out.");
    expect(buttonsOf(r!).some((b) => b.props.label === 'Have it iced out')).toBe(false);
    expect(buttonsOf(r!).some((b) => b.props.label.startsWith('Sell it'))).toBe(true);
  });
});
