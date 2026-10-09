import { afterEach, describe, expect, it } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId, dollars } from '@yearafter/core';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { createNewGame, livingEstimateFor, type GameState } from '@yearafter/simulation';
import { GameProvider, useGame } from '../stores/gameStore';
import { rowTitled, textsOf } from '../test/harness';
import { post, reconcile } from '@yearafter/finance';
import { RetirementScreen } from './RetirementScreen';
import { LifestyleScreen } from './LifestyleScreen';
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
const saveId = asSaveId('p15-ui');
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  game = undefined;
});
function fixture(age = 75, retired = true): GameState {
  const s = createNewGame({ seed: 'p15-ui', startYear: 2000 });
  const finance = post(s.finance, 2000 + age, age, {
    category: 'gift',
    amount: dollars(512000),
    source: 'Savings',
  }).ledger;
  return {
    ...s,
    pending: [],
    world: { ...s.world, year: 2000 + age },
    player: { ...s.player, age, cash: finance.balance },
    finance,
    retirement: { ...s.retirement, ...(retired ? { retiredAtAge: 65 } : {}) },
    household: { ...s.household, standard: 30000, housing: 'ownPlace' },
  };
}
async function mount(state: GameState) {
  const repository = new MemorySaveRepository();
  await repository.create(toSave(state, { id: saveId }));
  await act(async () => {
    rendered = create(
      <GameProvider repository={repository}>
        <Probe />
        <LifestyleScreen />
        <RetirementScreen />
      </GameProvider>,
    );
  });
  if (!rendered || !game?.state) throw new Error('Not loaded');
  return { renderer: rendered, repository };
}
describe('P15 retirement through the real store', () => {
  it('explains later-retirement savings, reserve, debt and manual liquidity', async () => {
    const { renderer } = await mount(fixture());
    const text = textsOf(renderer).join(' ');
    expect(text).toContain('Later in retirement, savings can gradually pay');
    expect(text).toContain('accounts for personal debt');
    expect(text).toContain('Investments may need to be sold');
    expect(text).toContain('Pension payments and money released');
    expect(text).toContain('Change them through Living costs on Career');
  });
  it.each([
    [74, true],
    [75, false],
  ])('does not show active later-spending copy at age %s retired %s', async (age, retired) => {
    const { renderer } = await mount(fixture(age, retired));
    expect(textsOf(renderer).join(' ')).not.toContain(
      'Later in retirement, savings can gradually pay',
    );
  });
  it('retains exact current-standard estimates and saves a free tier choice', async () => {
    const s = fixture();
    const { renderer, repository } = await mount(s);
    expect(rowTitled(renderer, 'Lavish').props.subtitle).toContain(
      `$${livingEstimateFor(s, 'lavish').toLocaleString('en-US')} a year`,
    );
    const before = game!.state!.rng.snapshot();
    await act(() => rowTitled(renderer, 'Frugal').props.onPress());
    expect(game!.state!.player.cash).toBe(s.player.cash);
    expect(game!.state!.player.stats).toEqual(s.player.stats);
    expect(game!.state!.rng.snapshot()).toEqual(before);
    const saved = await repository.load(saveId);
    if (!saved.ok) throw Error('No save');
    expect(saved.value.household.lifestyle).toBe('frugal');
    expect(saved.value.version).toBe(51);
    await act(() => game!.advance());
    expect(reconcile(game!.state!.finance).ok).toBe(true);
    const advanced = await repository.load(saveId);
    if (!advanced.ok) throw Error('No autosave');
    expect(advanced.value.player.cash).toBe(game!.state!.player.cash);
    expect(advanced.value.household.standard).toBe(game!.state!.household.standard);
  });
});
