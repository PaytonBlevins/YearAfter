/**
 * Ticket 0809 — the card that says what the year did in sports, acting, music, modeling, awards
 * and a racing team, once, when the year turns.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { advanceYear, createNewGame, type GameState } from '@yearafter/simulation';
import { useGame } from '../stores/gameStore';
import { ADULT, withBookedCash, withMusic } from '../test/entertainmentFixtures';
import { show, textsOf } from '../test/harness';
import { OutcomeCard } from './OutcomeCard';
import { YearRecapNotice, recapOutcome } from './YearRecapNotice';
import { openBusiness } from '@yearafter/simulation';

vi.mock('../stores/gameStore', () => ({ useGame: vi.fn() }));
let rendered: ReactTestRenderer | undefined;
afterEach(async () => {
  if (rendered) await act(() => rendered?.unmount());
  rendered = undefined;
  vi.clearAllMocks();
});

/** A year in which the music engine writes a line: a single was planned and goes out. */
const SINGING = withMusic(ADULT, {
  released: { single: 1, ep: 0, lp: 0 },
  plan: { single: 1, ep: 0, lp: 0, tour: false },
});
const TURNED = advanceYear(SINGING).state;

async function render(state: GameState, overlay: object = {}) {
  vi.mocked(useGame, { partial: true }).mockReturnValue({ state, ...overlay });
  if (rendered) {
    await act(() => rendered?.update(<YearRecapNotice />));
  } else {
    rendered = await show(<YearRecapNotice />);
  }
  return rendered;
}
const cards = () => rendered?.root.findAllByType(OutcomeCard) ?? [];

describe('the recap, made from the real year', () => {
  it('comes from lines the music engine really wrote', () => {
    const outcome = recapOutcome(SINGING, TURNED)!;
    expect(outcome.title).toBe('Music');
    expect(outcome.tone).toBe('neutral');
    expect(outcome.body).toContain('Put out a single');
  });

  it('is a racing team’s own season when that is all that happened', () => {
    const rich = withBookedCash(ADULT, 5_000_000);
    const opened = openBusiness(rich, 'biz.racing');
    if (!opened.ok) throw new Error('no team');
    const turned = advanceYear(opened.value.state).state;
    const outcome = recapOutcome(opened.value.state, turned)!;
    expect(outcome.title).toBe('Your racing team');
    expect(outcome.body).toMatch(/finished \d+(st|nd|rd|th) of \d+ in the Coastline Club Racing/);
  });

  it('is one titled card with each field named when several happened', () => {
    const before = SINGING;
    const after: GameState = {
      ...TURNED,
      player: {
        ...TURNED.player,
        timeline: [
          ...TURNED.player.timeline,
          {
            id: `t:${TURNED.world.year}:acting:0`,
            text: 'Wrapped a film.',
            age: TURNED.player.age,
            year: TURNED.world.year,
            kind: 'passive',
            sequence: 9_000,
          } as never,
        ],
      },
    };
    const outcome = recapOutcome(before, after)!;
    expect(outcome.title).toBe('The year in your work');
    expect(outcome.body).toBe(
      `Acting: Wrapped a film.\n\nMusic: ${recapOutcome(before, TURNED)!.body}`,
    );
  });

  it('is nothing for a year in which none of those fields wrote anything', () => {
    expect(recapOutcome(ADULT, advanceYear(ADULT).state)).toBeUndefined();
  });
});

describe('the notice', () => {
  it('shows the card when the year turns, and not on the first render of a saved life', async () => {
    await render(SINGING);
    expect(cards()).toHaveLength(0);
    await render(TURNED);
    expect(cards()).toHaveLength(1);
    expect(cards()[0]!.props.outcome.title).toBe('Music');
    expect(textsOf(rendered!).join(' ')).toContain('Put out a single');
  });

  it('dismisses, and does not come back on the next render', async () => {
    await render(SINGING);
    await render(TURNED);
    await act(() => cards()[0]!.props.onDismiss());
    expect(cards()).toHaveLength(0);
    await render({ ...TURNED });
    expect(cards()).toHaveLength(0);
  });

  it('waits behind a decision, an answer or a breakdown, then shows', async () => {
    await render(SINGING);
    await render(TURNED, { outcome: { title: 'Other', body: 'Already here', tone: 'neutral' } });
    expect(cards()).toHaveLength(0);
    await render(TURNED, {
      decision: {
        eventId: 'x',
        category: 'life',
        age: TURNED.player.age,
        year: TURNED.world.year,
        prompt: 'What now?',
        choices: [],
        names: {},
      },
    });
    expect(cards()).toHaveLength(0);
    await render(TURNED, { detail: { title: 'Details', lines: [] } });
    expect(cards()).toHaveLength(0);
    await render(TURNED);
    expect(cards()).toHaveLength(1);
  });

  it('clears for a different life, and for a death', async () => {
    await render(SINGING);
    await render(TURNED);
    expect(cards()).toHaveLength(1);
    await render(createNewGame({ seed: 'someone-else' }));
    expect(cards()).toHaveLength(0);
    await render(SINGING);
    await render(TURNED);
    await render({ ...TURNED, player: { ...TURNED.player, alive: false } });
    expect(cards()).toHaveLength(0);
  });

  it('shows nothing when there is no life', async () => {
    vi.mocked(useGame, { partial: true }).mockReturnValue({ state: undefined });
    rendered = await show(<YearRecapNotice />);
    expect(rendered.toJSON()).toBeNull();
  });

  it('does not fall over when a life arrives after none, and shows nothing for it', async () => {
    vi.mocked(useGame, { partial: true }).mockReturnValue({ state: undefined });
    rendered = await show(<YearRecapNotice />);
    await render(SINGING);
    expect(cards()).toHaveLength(0);
    await render(TURNED);
    expect(cards()).toHaveLength(1);
  });
});
