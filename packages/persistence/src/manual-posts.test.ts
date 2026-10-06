import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { createNewGame, openChannel, postToChannel } from '@yearafter/simulation';
import { migrateSave } from './migrations';
import { fromSave, toSave } from './serialize';
function fixture() {
  const base = createNewGame({ seed: 'saved-post' });
  const state = { ...base, player: { ...base.player, age: 25 } };
  const opened = openChannel(state, 'twitter', 'lifestyle');
  if (!opened.ok) throw new Error('Open refused');
  const channel = opened.value.channels[0];
  if (!channel) throw new Error('No channel');
  const posted = postToChannel(opened.value, channel.id, 'thread');
  if (!posted.ok) throw new Error('Post refused');
  return posted.value;
}
describe('saved manual posts', () => {
  it('keeps the selected format, reaction, budget, fame and timeline through JSON and replay', () => {
    const state = fixture();
    const saved = toSave(state, { id: asSaveId('manual-post') });
    const loaded = migrateSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error('Save refused');
    const back = fromSave(loaded.value);
    expect(back.channels).toEqual(state.channels);
    expect(back.channels[0]?.publishing?.count).toBe(1);
    expect(back.channels[0]?.publishing?.year).toBe(back.world.year);
    expect(back.fame).toBe(state.fame);
    expect(back.player.timeline).toEqual(state.player.timeline);
    const channel = state.channels[0];
    if (!channel) throw new Error('No channel');
    const replay = postToChannel(back, channel.id, 'poll');
    const original = postToChannel(state, channel.id, 'poll');
    if (!replay.ok || !original.ok) throw new Error('Replay refused');
    expect(replay.value.channels[0]?.publishing).toMatchObject({
      year: back.world.year,
      count: 2,
      kind: 'poll',
    });
    const options = { id: asSaveId('replay'), createdAt: 0, updatedAt: 0 };
    // RNG restore canonicalizes signed 32-bit words; compare the same saved representation.
    const canonicalOriginal = fromSave(toSave(original.value, options));
    expect(toSave(replay.value, options)).toEqual(toSave(canonicalOriginal, options));
  });
  it('loads a v43 account without publishing metadata as not posted', () => {
    const state = fixture();
    const saved = toSave(state, { id: asSaveId('legacy-account') });
    const channel = saved.channels[0];
    if (!channel) throw new Error('No channel');
    const { publishing: _publishing, ...legacy } = channel;
    const loaded = migrateSave({ ...saved, channels: [legacy] });
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(fromSave(loaded.value).channels[0]?.publishing).toBeUndefined();
  });
  it.each([
    { count: 13 },
    { count: -1 },
    { count: 1.5 },
    { year: 'now' },
    { year: 2040.5 },
    { kind: '' },
    { gained: 'many' },
    { gained: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects malformed publishing metadata %j', (patch) => {
    const saved = toSave(fixture(), { id: asSaveId('bad-post') });
    const channel = saved.channels[0];
    if (!channel?.publishing) throw new Error('Missing post');
    const loaded = migrateSave({
      ...saved,
      channels: [{ ...channel, publishing: { ...channel.publishing, ...patch } }],
    });
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error).toMatchObject({ kind: 'corrupt' });
  });
});
