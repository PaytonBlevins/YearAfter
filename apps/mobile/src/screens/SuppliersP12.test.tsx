import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId } from '@yearafter/core';
import { findBusinessType } from '@yearafter/content';
import { newBusiness } from '@yearafter/finance';
import { createNewGame } from '@yearafter/simulation';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { GameProvider, useGame } from '../stores/gameStore';
import { BusinessScreen } from './BusinessesScreen';
import { rowTitled, textsOf } from '../test/harness';
vi.mock('../navigation/navigation', () => ({
  useNavigation: () => ({ current: { businessId: 'ui-business' }, pop: vi.fn(), push: vi.fn() }),
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
async function mount(typeId = 'biz.cafe') {
  const s = createNewGame({ seed: 'p12-ui', startYear: 2000 });
  const state = {
    ...s,
    pending: [],
    world: { ...s.world, year: 2030 },
    player: { ...s.player, age: 30 },
    businesses: [newBusiness(findBusinessType(typeId)!, 'ui-business', 'Cafe', 2020, 1)],
  };
  const repo = new MemorySaveRepository();
  const id = asSaveId('p12-ui');
  const saved = await repo.create(toSave(state, { id }));
  if (!saved.ok) throw Error(String(saved.error));
  await act(async () => {
    rendered = create(
      <GameProvider repository={repo}>
        <Probe />
        <BusinessScreen />
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
async function press(title: string) {
  await act(async () => {
    rowTitled(renderer(), title).props.onPress();
    await Promise.resolve();
  });
}
describe('P12 screen through real store, command and autosave', () => {
  it('browses free, searches, accepts exact terms and reloads count/contract', async () => {
    const { repo, id, state } = await mount();
    expect(game?.state?.businesses[0]?.supplierSearch).toBeUndefined();
    expect(textsOf(renderer()).join(' ')).toContain('5 searches left');
    expect(textsOf(renderer()).join(' ')).toContain('Your bill depends on how much you sell');
    await press('Search for a supplier');
    const pitch = game!.state!.businesses[0]!.supplierSearch!.pending!;
    expect(textsOf(renderer()).join(' ')).toContain(pitch.name);
    expect(textsOf(renderer()).join(' ')).toContain(
      `${Math.round(pitch.cost * 100)}% of ordinary supplies`,
    );
    expect(textsOf(renderer()).join(' ')).toContain(
      `${Math.round(pitch.quality * 100)}% of ordinary supplies`,
    );
    await press('Accept this supplier');
    expect(game?.state?.businesses[0]?.supplierAgreement).toEqual({ ...pitch, acceptedYear: 2030 });
    expect(game?.state?.businesses[0]?.supplierSearch).toEqual({ year: 2030, used: 1 });
    expect(game?.state?.finance).toEqual(state.finance);
    const saved = await repo.load(id);
    if (!saved.ok) throw Error(String(saved.error));
    expect(saved.value.businesses[0]?.supplierAgreement).toEqual({ ...pitch, acceptedYear: 2030 });
    expect(saved.value.businesses[0]?.supplierSearch).toEqual({ year: 2030, used: 1 });
    expect(textsOf(renderer()).join(' ')).toContain('4 searches left');
  });
  it('passes, replaces, stops at five and shows spoken stale/exhausted refusals', async () => {
    await mount();
    await press('Search for a supplier');
    const p = game!.state!.businesses[0]!.supplierSearch!.pending!;
    await press('Pass on this pitch');
    expect(game?.state?.businesses[0]?.supplierAgreement).toBeUndefined();
    expect(game?.state?.businesses[0]?.supplierSearch).toEqual({ year: 2030, used: 1 });
    await press('Search for a supplier');
    for (let i = 0; i < 3; i++) await press('Search again');
    expect(rowTitled(renderer(), 'Search again').props.disabled).toBe(true);
    const snapshot = JSON.stringify(game?.state);
    await act(() => game?.searchBusinessSupplier('ui-business'));
    expect(game?.outcome?.body).toContain('five searches');
    await act(() => game?.acceptBusinessSupplier('ui-business', p.id));
    expect(game?.outcome?.body).toContain("isn't available any more");
    expect(JSON.stringify(game?.state)).toBe(snapshot);
  });
  it('has no supplier section for a business without supplies', async () => {
    await mount('biz.fitness');
    expect(textsOf(renderer()).join(' ')).not.toContain('Search for a supplier');
  });
});
