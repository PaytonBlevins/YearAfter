import { afterEach, describe, it, expect } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, dollars } from '@yearafter/core';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { createNewGame, type GameState, advisorCashFor } from '@yearafter/simulation';
import { post } from '@yearafter/finance';
import { GameProvider, useGame } from '../stores/gameStore';
import { AdvisorScreen } from './AdvisorScreen';
import { buttonLabelled, textsOf, hosts } from '../test/harness';
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
const id = asSaveId('p7-ui');
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  game = undefined;
});
async function mount(advisorId?: string) {
  const b = createNewGame({ seed: 'p7-ui' });
  const f = post(b.finance, b.world.year, 30, {
    category: 'salary',
    amount: dollars(86000),
    source: 'Test funds',
  });
  const s: GameState = {
    ...b,
    player: { ...b.player, age: 30, cash: f.ledger.balance },
    finance: f.ledger,
    advisorId,
  };
  const repo = new MemorySaveRepository();
  await repo.create(toSave(s, { id }));
  await act(async () => {
    rendered = create(
      <GameProvider repository={repo}>
        <Probe />
        <AdvisorScreen />
      </GameProvider>,
    );
  });
  return { r: rendered!, repo };
}
describe('P7 goal screen and real store', () => {
  it.each([undefined, 'adv.independent'])(
    'sets and clears a persisted goal with advisor %s',
    async (advisor) => {
      const { r, repo } = await mount(advisor);
      expect(textsOf(r).join(' ')).toContain('15% of spare cash');
      await act(() => hosts(r, 'TextInput')[0]!.props.onChangeText('65000'));
      await act(() => buttonLabelled(r, 'Set purchase goal').props.onPress());
      expect(game!.state!.cashGoal).toBe(65000);
      const loaded = await repo.load(id);
      if (!loaded.ok) throw Error(loaded.error.kind);
      expect(loaded.value.cashGoal).toBe(65000);
      expect(textsOf(r).join(' ')).toContain('$65,000');
      await act(() => buttonLabelled(r, 'Clear purchase goal').props.onPress());
      expect(game!.state!.cashGoal).toBeUndefined();
      const cleared = await repo.load(id);
      if (!cleared.ok) throw Error(cleared.error.kind);
      expect(cleared.value.cashGoal).toBeUndefined();
    },
  );
  it('rejects invalid typed input in spoken language without changing the goal', async () => {
    const { r } = await mount();
    await act(() => hosts(r, 'TextInput')[0]!.props.onChangeText('-1'));
    await act(() => buttonLabelled(r, 'Set purchase goal').props.onPress());
    expect(game!.state!.cashGoal).toBeUndefined();
    expect(game!.saveError).toContain('whole dollar');
  });
  it('previews destination before the trade and protects a goal on tapping', async () => {
    const { r } = await mount('adv.independent');
    expect(textsOf(r).join(' ')).toContain('If you act:');
    expect(game!.state!.portfolio).toEqual([]);
    await act(() => hosts(r, 'TextInput')[0]!.props.onChangeText('100000'));
    await act(() => buttonLabelled(r, 'Set purchase goal').props.onPress());
    expect(textsOf(r).join(' ')).not.toContain('If you act:');
    expect(advisorCashFor(game!.state!).spare).toBe(0);
    expect(game!.state!.portfolio).toEqual([]);
  });
});
