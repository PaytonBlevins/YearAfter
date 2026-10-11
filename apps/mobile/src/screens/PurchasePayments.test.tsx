import { InstrumentScreen } from './InstrumentScreen';
import { AmountField } from '../components/AmountField';
import { INSTRUMENTS } from '@yearafter/content';
import { quoteInvestment } from '@yearafter/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, cents, dollars } from '@yearafter/core';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import {
  createNewGame,
  openStores,
  storeStock,
  homeListings,
  vehicleLots,
  type GameState,
} from '@yearafter/simulation';
import { reconcile } from '@yearafter/finance';
import { GameProvider, useGame } from '../stores/gameStore';
import { ActionButton, ListRow } from '../components';
import { PurchasePaymentChoices } from '../components/PurchasePaymentChoices';
import { StoreScreen } from './ShoppingScreen';
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
let activeStore = '';
let activeInstrument = '';
vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { storeId: activeStore, instrumentId: activeInstrument } }),
}));
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  game = undefined;
});
function current() {
  if (!game?.state) throw new Error('Game not loaded');
  return game;
}
async function mount(state?: GameState, screen: 'store' | 'investment' = 'store') {
  const fresh = createNewGame({ seed: 'payment-screen-integration' });
  const start = state ?? {
    ...fresh,
    player: { ...fresh.player, age: 35 },
    cards: [
      {
        productId: 'card.starter',
        limit: dollars(1000000),
        balance: cents(0),
        status: 'open' as const,
      },
    ],
  };
  const piece = openStores(start).flatMap((store) => storeStock(start, store.id))[0];
  if (!piece) throw new Error('No store fixture');
  activeStore = piece.storeId;
  const repository = new MemorySaveRepository();
  const id = asSaveId('payment-screen');
  await repository.create(toSave(start, { id }));
  await act(async () => {
    rendered = create(
      <GameProvider repository={repository}>
        {screen === 'investment' ? <InstrumentScreen /> : <StoreScreen />}
        <Probe />
      </GameProvider>,
    );
  });
  expect(current().ready).toBe(true);
  return { piece, repository, id, start };
}
async function openPiece(id: string) {
  if (!rendered) throw new Error('No screen');
  const row = rendered.root
    .findAllByType(ListRow)
    .find((row) => row.props.onPress && row.props.title !== 'Use cash');
  expect(row).toBeDefined();
  await act(() => row?.props.onPress());
  expect(rendered.root.findAllByType(PurchasePaymentChoices)).toHaveLength(1);
  expect(current().state?.valuables.some((piece) => piece.id === id)).toBe(false);
}
describe('purchase choices through real store and save wiring', () => {
  it('shows payment choices with no cash, then buys on the chosen card and persists the result', async () => {
    const { piece, repository, id, start } = await mount();
    await openPiece(piece.id);
    const card = rendered?.root
      .findAllByType(ListRow)
      .find((row) => row.props.title === 'Starter Card');
    expect(card?.props.disabled).toBe(false);
    await act(() => card?.props.onPress());
    expect(current().state?.cards[0]?.balance).toBe(cents(0));
    await act(async () => {
      rendered?.root.findByType(ActionButton).props.onPress();
    });
    expect(current().state?.valuables[0]?.itemId).toBe(piece.item.id);
    expect(current().state?.cards[0]?.balance).toBe(dollars(piece.price));
    expect(current().state?.player.cash).toBe(start.player.cash);
    expect(current().outcome?.body).toContain('Starter Card');
    const loaded = await repository.load(id);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.cards[0]?.balance).toBe(dollars(piece.price));
    expect(loaded.value.valuables[0]?.id).toBe(piece.id);
    expect(reconcile(loaded.value.finance).ok).toBe(true);
  });
  it('keeps cash working and does not use a card without choosing one', async () => {
    const fresh = createNewGame({ seed: 'payment-screen-integration' });
    const { post } = await import('@yearafter/finance');
    const finance = post(fresh.finance, fresh.world.year, 35, {
      category: 'gift',
      amount: dollars(10000),
      source: 'Test savings',
    }).ledger;
    const state = {
      ...fresh,
      finance,
      player: { ...fresh.player, age: 35, cash: finance.balance },
      cards: [
        {
          productId: 'card.starter',
          limit: dollars(1000000),
          balance: cents(0),
          status: 'open' as const,
        },
      ],
    };
    const { piece } = await mount(state);
    await openPiece(piece.id);
    const cash = rendered?.root
      .findAllByType(ListRow)
      .find((row) => row.props.title === 'Use cash');
    await act(() => cash?.props.onPress());
    await act(async () => {
      rendered?.root.findByType(ActionButton).props.onPress();
    });
    expect(current().state?.player.cash).toBe(cents(state.player.cash - piece.price * 100));
    expect(current().state?.cards[0]?.balance).toBe(cents(0));
  });
  it.each(['home', 'vehicle'] as const)(
    'passes the selected card through the real %s store command',
    async (kind) => {
      await mount();
      const state = current().state;
      if (!state) throw new Error('No state');
      if (kind === 'home') {
        const listing = homeListings(state)[0];
        if (!listing) throw new Error('No home');
        await act(async () => {
          current().buyAHome(listing.id, 'cash', {
            kind: 'card',
            productId: 'card.starter',
            expectedTotal: dollars(listing.askingPrice),
          });
        });
        expect(current().state?.homes[0]?.id).toBe(listing.id);
        expect(current().state?.cards[0]?.balance).toBe(dollars(listing.askingPrice));
      } else {
        const listing = vehicleLots(state, 'used').flatMap((lot) => lot.listings)[0];
        if (!listing) throw new Error('No car');
        await act(async () => {
          current().buyACar(listing.id, 'cash', { kind: 'card', productId: 'card.starter' });
        });
        expect(current().state?.vehicles[0]?.id).toBe(listing.id);
        expect(current().state?.cards[0]?.balance).toBe(
          current().state?.vehicles[0]?.purchasePrice,
        );
      }
      expect(current().state?.player.cash).toBe(state.player.cash);
    },
  );
  it('quotes investment units without cash and lets the player change the amount before paying', async () => {
    const bond = INSTRUMENTS.find((row) => row.kind === 'bond');
    if (!bond) throw new Error('No bond');
    activeInstrument = bond.id;
    await mount(undefined, 'investment');
    const buy = rendered?.root
      .findAllByType(ListRow)
      .find((row) => row.props.title === 'Put money in');
    expect(buy?.props.onPress).toBeTypeOf('function');
    await act(() => buy?.props.onPress());
    await act(() => rendered?.root.findByType(AmountField).props.onChange('5500'));
    await act(() => rendered?.root.findByType(AmountField).props.onConfirm());
    expect(rendered?.root.findAllByType(PurchasePaymentChoices)).toHaveLength(1);
    const change = rendered?.root
      .findAllByType(ActionButton)
      .find((button) => button.props.label === 'Change amount');
    await act(() => change?.props.onPress());
    expect(rendered?.root.findByType(AmountField).props.value).toBe('5500');
    expect(current().state?.portfolio).toHaveLength(0);
    await act(() => rendered?.root.findByType(AmountField).props.onConfirm());
    const card = rendered?.root
      .findAllByType(ListRow)
      .find((row) => row.props.title === 'Starter Card');
    await act(() => card?.props.onPress());
    const state = current().state;
    if (!state) throw new Error('No state');
    const quote = quoteInvestment(state, bond.id, 5500);
    const pay = rendered?.root
      .findAllByType(ActionButton)
      .find((button) => button.props.label.startsWith('Pay '));
    await act(async () => {
      pay?.props.onPress();
    });
    expect(current().state?.cards[0]?.balance).toBe(dollars(quote.cash));
    expect(current().state?.portfolio[0]?.units).toBe(quote.units);
    expect(current().state?.player.cash).toBe(cents(0));
  });
  it('shows a spoken refusal when confirmation has a stale price and saves no purchase', async () => {
    const { piece, repository, id } = await mount();
    const before = current().state;
    await act(() =>
      current().buyAValuable(piece.id, {
        kind: 'card',
        productId: 'card.starter',
        expectedTotal: dollars(piece.price - 1),
      }),
    );
    expect(current().state).toBe(before);
    expect(current().outcome?.body).toContain('price changed');
    const loaded = await repository.load(id);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.valuables).toHaveLength(0);
    expect(loaded.value.cards[0]?.balance).toBe(cents(0));
  });
});
