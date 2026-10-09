import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { createNewGame, takeGig, type GameState } from '@yearafter/simulation';
import { GIGS } from '@yearafter/content';
import { useGame } from '../stores/gameStore';
import { show, rowsOf, textsOf, rowTitled } from '../test/harness';
import { CareerScreen } from './shells';
import { useNavigation } from '../navigation/navigation';
import { GigsScreen } from './GigsScreen';
vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
vi.mock('../navigation/navigation', () => ({ useNavigation: vi.fn() }));
let rendered: ReactTestRenderer | undefined;
const takeAGig = vi.fn(),
  quitAGig = vi.fn();
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});
function state(age: number): GameState {
  const b = createNewGame({ seed: 'p6-mobile' });
  return { ...b, player: { ...b.player, age } };
}
async function screen(s: GameState | null) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state: s, takeAGig, quitAGig });
  rendered = await show(<GigsScreen />);
  return rendered;
}
describe('P6 chosen work screen', () => {
  it.each([16, 30])('makes part-time work discoverable from Career at %i', async (age) => {
    const push = vi.fn();
    vi.mocked(useNavigation, { partial: true }).mockReturnValue({ push });
    vi.mocked(useGame, { partial: true }).mockReturnValue({ state: state(age) });
    rendered = await show(<CareerScreen />);
    const row = rowTitled(rendered, 'Part-time & Odd Jobs');
    await act(() => row.props.onPress());
    expect(push).toHaveBeenCalledWith({ screen: 'gigs', title: 'Part-time & Odd Jobs' });
  });
  it('shows all six adult jobs at 30 and no child-oriented empty state', async () => {
    const r = await screen(state(30));
    expect(rowsOf(r)).toHaveLength(6);
    expect(rowsOf(r).map((row) => row.props.title)).toEqual(
      GIGS.filter((g) => g.id.startsWith('gig.adult.')).map((g) => g.name),
    );
    const text = textsOf(r).join(' ');
    expect(text).toContain('ODD JOBS');
    expect(text).toContain('alongside any regular job');
    expect(text).not.toContain('before a real job');
  });
  it('shows the same six adult options in retirement', async () => {
    expect(rowsOf(await screen(state(80)))).toHaveLength(6);
  });
  it('shows clear part-time shifts during high school, with annual gross and commitments', async () => {
    const r = await screen(state(16));
    expect(textsOf(r).join(' ')).toContain('PART-TIME SHIFTS');
    for (const name of [
      'Weekend shifts in a shop',
      'Kitchen shifts',
      'Lifeguarding',
      'Camp counsellor',
    ])
      expect(rowTitled(r, name).props.disabled).toBe(false);
    expect(rowTitled(r, 'Weekend shifts in a shop').props.meta).toContain('12 h/wk');
    expect(rowTitled(r, 'Weekend shifts in a shop').props.meta).toContain('/yr before tax');
  });
  it('takes each real job with its own id and keeps quit separate', async () => {
    const r = await screen(state(30)),
      gigs = GIGS.filter((g) => g.id.startsWith('gig.adult.'));
    for (const [i, row] of rowsOf(r).entries()) {
      await act(() => row.props.onPress());
      expect(takeAGig).toHaveBeenLastCalledWith(gigs[i]?.id);
    }
    expect(takeAGig).toHaveBeenCalledTimes(6);
    expect(quitAGig).not.toHaveBeenCalled();
  });
  it('shows held work and quits it without taking it again', async () => {
    const b = state(30),
      taken = takeGig(b, 'gig.adult.repairs');
    if (!taken.ok) throw Error(taken.error);
    const r = await screen(taken.value),
      row = rowTitled(r, 'Small household repairs');
    expect(textsOf(r).join(' ')).toContain("WORK YOU'RE DOING");
    expect(row.props.value).toBe('Quit');
    await act(() => row.props.onPress());
    expect(quitAGig).toHaveBeenCalledWith('gig.adult.repairs');
    expect(takeAGig).not.toHaveBeenCalled();
  });
  it('shows and lets the player quit every held job, including more than three', async () => {
    const b = state(30),
      gigs = GIGS.filter((g) => g.id.startsWith('gig.adult.')),
      r = await screen({ ...b, education: { ...b.education, gigs: gigs.map((g) => g.id) } });
    expect(rowsOf(r)).toHaveLength(6);
    for (const gig of gigs) {
      const row = rowTitled(r, gig.name);
      expect(row.props.value).toBe('Quit');
      await act(() => row.props.onPress());
      expect(quitAGig).toHaveBeenLastCalledWith(gig.id);
    }
    expect(quitAGig).toHaveBeenCalledTimes(6);
    expect(takeAGig).not.toHaveBeenCalled();
  });
  it('leaves a third job available and never shows a capacity quota', async () => {
    const b = state(30),
      s = { ...b, education: { ...b.education, gigs: ['gig.adult.pet-care', 'gig.adult.art'] } };
    const r = await screen(s);
    expect(rowTitled(r, 'Small household repairs').props.disabled).toBe(false);
    expect(textsOf(r).join(' ')).not.toContain('of 2');
  });
  it('shows a plain parent refusal and does not attach a handler', async () => {
    const b = state(14),
      r = await screen({ ...b, family: { ...b.family, members: [] } }),
      row = rowTitled(r, 'Babysitting');
    expect(row.props.subtitle).toBe('Needs an adult at home to vouch for you.');
    expect(row.props.disabled).toBe(true);
    expect(row.props.onPress).toBeUndefined();
  });
  it('shows the young-child empty state and renders nothing without a game', async () => {
    const child = await screen(state(3));
    expect(rowsOf(child)).toHaveLength(0);
    expect(textsOf(child).join(' ')).toContain('Nothing you can do for money yet');
    await act(() => rendered?.unmount());
    rendered = undefined;
    expect(rowsOf(await screen(null))).toHaveLength(0);
  });
});
