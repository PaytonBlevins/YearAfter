import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { createNewGame, openings, type GameState } from '@yearafter/simulation';
import { MAJORS } from '@yearafter/education';
import { useGame } from '../stores/gameStore';
import { useNavigation } from '../navigation/navigation';
import { show, rowsOf, textsOf } from '../test/harness';
import { JobsScreen } from './JobsScreen';
vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
const push = vi.fn();
function adult(): GameState {
  const base = createNewGame({ seed: 'p5-mobile' });
  const major = MAJORS.find((m) => m.kind === 'undergraduate' && m.opens.includes('creative'));
  if (!major) throw new Error('Missing major');
  return {
    ...base,
    player: { ...base.player, age: 30 },
    education: {
      ...base.education,
      stage: 'graduated',
      majorId: major.id,
      credentials: { highSchool: 18, university: 22 },
    },
  };
}
async function screen(state: GameState | null) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state });
  vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
  rendered = await show(<JobsScreen />);
  return rendered;
}
describe('P5 jobs screen', () => {
  it('renders all twelve real listings in their salary order', async () => {
    const state = adult(),
      r = await screen(state);
    expect(rowsOf(r)).toHaveLength(12);
    expect(rowsOf(r).map((row) => row.props.title)).toEqual(openings(state).map((j) => j.title));
    expect(textsOf(r).join(' ')).toContain('Your studies and training help shape the list');
  });
  it('opens each real job, including the twelfth, without applying', async () => {
    const state = adult(),
      r = await screen(state),
      board = openings(state);
    for (const [i, row] of rowsOf(r).entries()) {
      await act(() => row.props.onPress());
      expect(push).toHaveBeenLastCalledWith({
        screen: 'jobOffer',
        title: board[i]?.title,
        jobId: String(board[i]?.id),
      });
    }
    expect(push).toHaveBeenCalledTimes(12);
    expect(state.employment.job).toBeUndefined();
    expect(state.employment.appliedTo).toEqual([]);
  });
  it("marks this year's sent application and leaves the other eleven available", async () => {
    const base = adult(),
      first = openings(base)[0];
    if (!first) throw new Error('Missing first listing');
    const state = {
      ...base,
      employment: { ...base.employment, appliedAtAge: 30, appliedTo: [String(first.id)] },
    };
    const r = await screen(state),
      rows = rowsOf(r);
    expect(rows[0]?.props.subtitle).toBe('Your application is in.');
    expect(rows[0]?.props.disabled).toBe(true);
    expect(rows[0]?.props.onPress).toBeUndefined();
    expect(rows.filter((row) => !row.props.disabled)).toHaveLength(11);
  });
  it("does not mark last year's application as spent", async () => {
    const base = adult(),
      first = openings(base)[0];
    if (!first) throw new Error('Missing first listing');
    const r = await screen({
      ...base,
      employment: { ...base.employment, appliedAtAge: 29, appliedTo: [String(first.id)] },
    });
    expect(rowsOf(r)[0]?.props.disabled).toBe(false);
    expect(rowsOf(r)[0]?.props.onPress).toBeTypeOf('function');
  });
  it('shows the existing age refusal when no jobs qualify', async () => {
    const base = adult(),
      r = await screen({ ...base, player: { ...base.player, age: 15 } });
    expect(rowsOf(r)).toHaveLength(0);
    expect(textsOf(r).join(' ')).toContain('Nothing going');
  });
  it('renders nothing before a game is loaded', async () => {
    expect((await screen(null)).toJSON()).toBeNull();
  });
});
