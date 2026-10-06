import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { asSaveId } from '@yearafter/core';
import { MemorySaveRepository, toSave } from '@yearafter/persistence';
import { createNewGame, openChannel, type GameState } from '@yearafter/simulation';
import { GameProvider, useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { buttonLabelled, rowTitled, rowsOf, textsOf } from '../test/harness';
import { ChannelScreen, NewChannelScreen } from './ChannelScreens';

vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
let rendered: ReactTestRenderer | undefined;
let game: ReturnType<typeof useGame> | undefined;
const saveId = asSaveId('ui-manual-posts');
function Probe() {
  game = useGame();
  return null;
}
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  game = undefined;
  vi.clearAllMocks();
});
function fixture(platformId = 'photo'): GameState {
  const base = createNewGame({ seed: 'posting-ui' });
  const state = { ...base, player: { ...base.player, age: 25 } };
  const opened = openChannel(state, platformId, platformId === 'stream' ? 'gaming' : 'lifestyle');
  if (!opened.ok) throw new Error('Refused');
  return opened.value;
}
async function mount(state: GameState, newAccount = false) {
  const repository = new MemorySaveRepository();
  await repository.create(toSave(state, { id: saveId }));
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({
    current: newAccount
      ? { screen: 'newChannel', title: 'New', platformId: 'video' }
      : { screen: 'channel', title: 'Account', channelId: state.channels[0]?.id },
    push: vi.fn(),
    pop: vi.fn(),
  });
  await act(async () => {
    rendered = create(
      <GameProvider repository={repository}>
        <Probe />
        {newAccount ? <NewChannelScreen /> : <ChannelScreen />}
      </GameProvider>,
    );
  });
  if (!rendered || !game?.state) throw new Error('Provider not loaded');
  return { renderer: rendered, repository };
}
describe('manual post screen through the real store', () => {
  it('does not publish until a format is selected and the player confirms', async () => {
    const { renderer, repository } = await mount(fixture());
    await act(() => rowTitled(renderer, 'Post').props.onPress());
    expect(buttonLabelled(renderer, 'Publish post').props.disabled).toBe(true);
    expect(rowsOf(renderer).map((row) => row.props.title)).toEqual(
      expect.arrayContaining([
        'Family photo',
        'Food photo',
        'Meme',
        'Dance video',
        'Challenge video',
      ]),
    );
    await act(() => rowTitled(renderer, 'Family photo').props.onPress());
    expect(game?.state?.channels[0]?.publishing).toBeUndefined();
    await act(() => buttonLabelled(renderer, 'Publish post').props.onPress());
    expect(game?.state?.channels[0]?.publishing).toMatchObject({ count: 1, kind: 'family' });
    expect(game?.outcome?.title).toBe('Post published');
    expect(game?.outcome?.body).toContain('Instagram');
    const saved = await repository.load(saveId);
    expect(saved.ok).toBe(true);
    if (saved.ok) expect(saved.value.channels[0]?.publishing?.kind).toBe('family');
  });
  it('canceling leaves the audience, money and post count unchanged', async () => {
    const state = fixture();
    const { renderer } = await mount(state);
    await act(() => rowTitled(renderer, 'Post').props.onPress());
    await act(() => rowTitled(renderer, 'Meme').props.onPress());
    await act(() => buttonLabelled(renderer, 'Cancel').props.onPress());
    expect(game?.state?.channels).toEqual(state.channels);
    expect(game?.state?.finance).toEqual(state.finance);
  });
  it('a full saved posting budget disables publishing on reload', async () => {
    const state = fixture();
    const channel = state.channels[0];
    if (!channel) throw new Error('No account');
    const full = {
      ...state,
      channels: [
        {
          ...channel,
          publishing: { year: state.world.year, count: 12, kind: 'photo', gained: 10 },
        },
      ],
    };
    const { renderer } = await mount(full);
    await act(() => rowTitled(renderer, 'Post').props.onPress());
    await act(() => rowTitled(renderer, 'Photo').props.onPress());
    const button = buttonLabelled(renderer, 'Publish post');
    expect(button.props.disabled).toBe(true);
    const host = button.findByType('Pressable' as unknown as React.ComponentType);
    expect(host.props.onPress).toBeUndefined();
    expect(textsOf(renderer).join(' ')).toContain("You've posted enough on this account this year");
    expect(game?.state?.channels[0]?.publishing?.count).toBe(12);
  });
  it('a streaming account shows live choices instead of photo choices', async () => {
    const { renderer } = await mount(fixture('stream'));
    await act(() => rowTitled(renderer, 'Post').props.onPress());
    expect(rowsOf(renderer).map((row) => row.props.title)).toContain('Gaming stream');
    expect(rowsOf(renderer).map((row) => row.props.title)).not.toContain('Family photo');
  });
  it('creates an account for free through the UI and saves it', async () => {
    const base = createNewGame({ seed: 'free-ui' });
    const state = { ...base, player: { ...base.player, age: 25 } };
    const { renderer, repository } = await mount(state, true);
    expect(textsOf(renderer).join(' ')).toContain('Creating this account is free');
    await act(() => rowTitled(renderer, 'Gaming').props.onPress());
    expect(game?.state?.channels[0]?.platformId).toBe('video');
    expect(game?.state?.player.cash).toBe(state.player.cash);
    expect(game?.state?.finance).toEqual(state.finance);
    const saved = await repository.load(saveId);
    if (!saved.ok) throw new Error('Save refused');
    expect(saved.value.channels).toHaveLength(1);
  });
});
