import { describe, expect, it } from 'vitest';
import { PLATFORMS } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import { reconcile, POSTS_PER_YEAR } from '@yearafter/finance';
import { createNewGame } from './new-game';
import { openChannel, runCreatorsYear, creatorWeek } from './creators';
import { postToChannel } from './manual-posts';
import type { GameState } from './game-state';
function base(): GameState {
  const state = createNewGame({ seed: 'manual-social' });
  return { ...state, player: { ...state.player, age: 25 } };
}
function opened(): GameState {
  const result = openChannel(base(), 'photo', 'lifestyle');
  if (!result.ok) throw new Error('Refused');
  return result.value;
}
const account = (state: GameState) => {
  const row = state.channels[0];
  if (!row) throw new Error('No account');
  return row;
};
describe('explicit social actions', () => {
  it('opens every platform without cash, a borrowing transaction or a balance change', () => {
    for (const platform of PLATFORMS) {
      const state = base();
      const category = platform.categories[0];
      if (!category) throw new Error('No category');
      const result = openChannel(state, platform.id, category);
      expect(result.ok, platform.name).toBe(true);
      if (!result.ok) throw new Error('Refused');
      expect(result.value.finance).toEqual(state.finance);
      expect(result.value.player.cash).toBe(dollars(0));
      expect(reconcile(result.value.finance).ok).toBe(true);
    }
  });
  it('publishes on the selected account with a timeline result and keeps money unchanged', () => {
    const state = opened();
    const second = openChannel(state, 'twitter', 'lifestyle');
    if (!second.ok) throw new Error('Refused');
    const before = second.value;
    const target = before.channels[1];
    if (!target) throw new Error('Missing target');
    const result = postToChannel(before, target.id, 'thread');
    if (!result.ok) throw new Error('Refused');
    expect(result.value.channels[0]).toEqual(before.channels[0]);
    expect(result.value.channels[1]?.publishing).toMatchObject({ count: 1, kind: 'thread' });
    expect(result.value.player.timeline.at(-1)?.text).toContain('X (Twitter)');
    expect(result.value.player.timeline.at(-1)?.text).toContain('thread');
    expect(result.value.finance).toEqual(before.finance);
  });
  it('advancing without posting does not create an audience, earnings or workload', () => {
    const state = opened();
    const result = runCreatorsYear({
      channels: state.channels,
      fame: 0,
      year: state.world.year + 1,
      stats: state.player.stats,
      talents: state.player.talents,
    });
    expect(result.channels[0]?.audience).toBe(0);
    expect(result.gross).toBe(0);
    expect(result.transactions).toEqual([]);
    expect(creatorWeek(state)).toBe(0);
  });
  it('refuses missing accounts and invalid formats without changing anything', () => {
    const state = opened();
    const before = JSON.stringify(state);
    expect(postToChannel(state, 'gone', 'photo')).toEqual({
      ok: false,
      error: { kind: 'noSuchChannel' },
    });
    expect(postToChannel(state, account(state).id, 'thread')).toEqual({
      ok: false,
      error: { kind: 'noSuchPost' },
    });
    expect(JSON.stringify(state)).toBe(before);
  });
  it('limits posts per account, persists the count, and records distinct actions', () => {
    let state = opened();
    const id = account(state).id;
    for (let i = 0; i < POSTS_PER_YEAR; i++) {
      const result = postToChannel(state, id, 'photo');
      if (!result.ok) throw new Error('Unexpected refusal');
      state = result.value;
    }
    const posts = state.player.timeline.filter((entry) => entry.id.includes('post:'));
    expect(posts).toHaveLength(12);
    expect(new Set(posts.map((entry) => entry.id)).size).toBe(12);
    expect(postToChannel(state, id, 'photo')).toEqual({
      ok: false,
      error: { kind: 'postingLimit' },
    });
  });
  it('replays deterministically and preserves fame earned through other paths', () => {
    const state = { ...opened(), fame: 60 };
    expect(postToChannel(state, account(state).id, 'photo')).toEqual(
      postToChannel(state, account(state).id, 'photo'),
    );
    const result = postToChannel(state, account(state).id, 'photo');
    if (!result.ok) throw new Error('Refused');
    expect(result.value.fame).toBe(60);
  });
});
