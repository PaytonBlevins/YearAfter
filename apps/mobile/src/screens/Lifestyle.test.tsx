import { afterEach, describe, expect, it } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId } from '@yearafter/core';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { createNewGame, livingEstimateFor, type GameState } from '@yearafter/simulation';
import { GameProvider, useGame } from '../stores/gameStore';
import { rowTitled, rowsOf, textsOf } from '../test/harness';
import { LifestyleScreen } from './LifestyleScreen';
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
const saveId = asSaveId('ui-lifestyle');
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  game = undefined;
});
function fixture(): GameState {
  const state = createNewGame({ seed: 'lifestyle-ui' });
  return {
    ...state,
    player: { ...state.player, age: 30 },
    household: { ...state.household, standard: 50_000, housing: 'ownPlace' },
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
      </GameProvider>,
    );
  });
  if (!rendered || !game?.state) throw new Error('Not loaded');
  return { renderer: rendered, repository };
}
describe('P2 — lifestyle through the real store and save repository', () => {
  it('shows three choices, the default, exact engine estimates and contextual limits', async () => {
    const state = fixture();
    const { renderer } = await mount(state);
    expect(rowsOf(renderer).map((row) => row.props.title)).toEqual([
      'Frugal',
      'Comfortable',
      'Lavish',
    ]);
    expect(rowTitled(renderer, 'Comfortable').props.value).toBe('Selected');
    for (const [tier, title] of [
      ['frugal', 'Frugal'],
      ['comfortable', 'Comfortable'],
      ['lavish', 'Lavish'],
    ] as const)
      expect(rowTitled(renderer, title).props.subtitle).toContain(
        `$${livingEstimateFor(state, tier).toLocaleString('en-US')} a year`,
      );
    expect(rowTitled(renderer, 'Frugal').props.subtitle).toContain('up to 1 less happiness');
    expect(rowTitled(renderer, 'Lavish').props.subtitle).toContain('up to 2 extra happiness');
    const text = textsOf(renderer).join(' ');
    expect(text).toContain('choosing costs nothing now');
    expect(text).toContain('Tax, mortgage payments, car costs and other separate bills are extra');
    expect(text).toContain("don't apply at basic needs or during hardship");
  });
  it.each([
    ['frugal', 'Frugal'],
    ['lavish', 'Lavish'],
  ] as const)(
    'selects and immediately saves %s without charging or rewarding',
    async (tier, title) => {
      const state = fixture();
      const { renderer, repository } = await mount(state);
      await act(async () => {
        rowTitled(renderer, title).props.onPress();
      });
      expect(game?.state?.household.lifestyle).toBe(tier);
      expect(game?.state?.player.stats).toEqual(state.player.stats);
      expect(game?.state?.player.cash).toBe(state.player.cash);
      expect(game?.state?.world.year).toBe(state.world.year);
      expect(rowTitled(renderer, title).props.value).toBe('Selected');
      const loaded = await repository.load(saveId);
      if (!loaded.ok) throw new Error('Not saved');
      expect(loaded.value.version).toBe(45);
      expect(loaded.value.household.lifestyle).toBe(tier);
    },
  );
  it.each(['child', 'dead', 'waiting'] as const)(
    'blocks %s and shows the real-store refusal if called directly',
    async (reason) => {
      let state = fixture();
      if (reason === 'child') state = { ...state, player: { ...state.player, age: 17 } };
      if (reason === 'dead') state = { ...state, player: { ...state.player, alive: false } };
      if (reason === 'waiting')
        state = {
          ...state,
          pending: [
            {
              eventId: 'waiting',
              category: 'random',
              age: 30,
              year: 2030,
              prompt: 'Wait',
              choices: [],
              names: {},
            },
          ],
        };
      const { renderer } = await mount(state);
      expect(rowsOf(renderer).every((row) => row.props.disabled)).toBe(true);
      await act(() => game?.chooseLifestyle('lavish'));
      expect(game?.state?.household.lifestyle).toBe('comfortable');
      expect(game?.outcome?.body).toBe(
        reason === 'child'
          ? "You can choose how you live when you're 18."
          : reason === 'dead'
            ? 'This life has ended.'
            : 'Answer the waiting question first.',
      );
    },
  );
});
