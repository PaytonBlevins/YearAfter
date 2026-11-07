import { expect, it, vi } from 'vitest';
import { Modal } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, dollars } from '@yearafter/core';
import { post } from '@yearafter/finance';
import { attendAuction, createNewGame, currentLots, liveBidQuote } from '@yearafter/simulation';
import { fromSave, MemorySaveRepository, migrateSave, toSave } from '@yearafter/persistence';
import { GameProvider } from '../stores/gameStore';
import { ActionButton } from '../components';
import { rowTitled, textsOf } from '../test/harness';
import { AuctionScreen } from './AuctionScreen';

vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { venueId: 'auction.storage' } }),
}));

it('shows a live counter, resumes after loading, and passes without moving money', async () => {
  const fresh = createNewGame({ seed: 'live-auction-0' });
  const { ledger } = post(fresh.finance, fresh.world.year, 30, {
    category: 'gift',
    amount: dollars(500000),
    source: 'Test cash',
  });
  const attended = attendAuction(
    { ...fresh, player: { ...fresh.player, age: 30, cash: ledger.balance }, finance: ledger },
    'auction.storage',
  );
  if (!attended.ok) throw Error(attended.error);
  const state = attended.value;
  const lot = currentLots(state, 'auction.storage').find(
    (candidate) => candidate.roomTop > liveBidQuote(state, candidate.id)!.hammer,
  )!;
  expect(lot).toBeDefined();
  const id = asSaveId('auction-ui');
  const repository = new MemorySaveRepository();
  await repository.create(toSave(state, { id }));
  let rendered!: ReactTestRenderer;
  async function mount() {
    await act(async () => {
      rendered = create(
        <GameProvider repository={repository}>
          <AuctionScreen />
        </GameProvider>,
      );
    });
  }
  await mount();
  try {
    await act(() => rowTitled(rendered, lot.name).props.onPress());
    expect(rendered.root.findAllByType(Modal)).toHaveLength(1);
    await act(() => rendered.root.findByType(Modal).props.onRequestClose());
    expect(rendered.root.findAllByType(Modal)).toHaveLength(0);
    await act(() => rowTitled(rendered, lot.name).props.onPress());
    await act(() => rowTitled(rendered, 'Use cash').props.onPress());
    const submit = rendered.root
      .findAllByType(ActionButton)
      .find((button) => String(button.props.label).startsWith('Confirm bid'));
    expect(submit).toBeDefined();
    await act(async () => submit!.props.onPress());
    expect(textsOf(rendered).join(' ')).toContain('Another bidder offered');
    const saved = await repository.load(id);
    if (!saved.ok) throw Error(String(saved.error));
    expect(saved.value.finance).toEqual(state.finance);
    const reloaded = migrateSave(JSON.parse(JSON.stringify(saved.value)));
    if (!reloaded.ok) throw Error(reloaded.error.kind);
    const inProgress = Object.keys(reloaded.value.auctions?.rounds ?? {})[0]!;
    expect(liveBidQuote(fromSave(reloaded.value), inProgress)?.counter).toBeDefined();
    expect(
      migrateSave({
        ...reloaded.value,
        auctions: { ...reloaded.value.auctions, rounds: { [inProgress]: 1e9 } },
      }).ok,
    ).toBe(false);

    await act(() => rendered.unmount());
    await mount();
    expect(textsOf(rendered).join(' ')).toContain('Another bidder offered');
    const dialog = rendered.root.findByType(Modal);
    await act(() => dialog.props.onRequestClose());
    expect(rendered.root.findAllByType(Modal)).toHaveLength(0);
    await act(() => rowTitled(rendered, lot.name).props.onPress());
    expect(textsOf(rendered).join(' ')).toContain('Another bidder offered');
    const pass = rendered.root
      .findAllByType(ActionButton)
      .find((button) => button.props.label === 'Pass on this lot');
    await act(async () => pass!.props.onPress());
    expect(textsOf(rendered).join(' ')).not.toContain('Another bidder offered');
    const closed = await repository.load(id);
    if (!closed.ok) throw Error(String(closed.error));
    expect(closed.value.finance).toEqual(state.finance);
    expect(closed.value.auctions?.bids).toContain(inProgress);
  } finally {
    await act(() => rendered.unmount());
  }
});
