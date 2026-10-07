import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { advanceYear, createNewGame, openChannel, postToChannel } from '@yearafter/simulation';
import { fromSave, toSave } from './serialize';
import { migrateSave } from './migrations';

function saved() {
  const base = createNewGame({ seed: 'p3-old-account' });
  const opened = openChannel(
    { ...base, player: { ...base.player, age: 14 } },
    'shortform',
    'comedy',
  );
  if (!opened.ok) throw new Error('Refused');
  const state = {
    ...opened.value,
    channels: opened.value.channels.map((c) => ({
      ...c,
      luck: 0.17,
      audience: 200_000,
      peak: 300_000,
      publishing: { year: base.world.year, count: 4, kind: 'meme', gained: 42 },
    })),
  };
  return toSave(state, { id: asSaveId('p3-old'), createdAt: 0, updatedAt: 0 });
}
describe('P3 existing accounts', () => {
  it('keeps old luck, spike and posting budget through reload and deterministic continuation', () => {
    const save = saved();
    expect(save.version).toBe(45);
    const loaded = migrateSave(JSON.parse(JSON.stringify(save)));
    if (!loaded.ok) throw new Error('Invalid save');
    const a = fromSave(save),
      b = fromSave(loaded.value);
    expect(b.channels).toEqual(a.channels);
    expect(b.channels[0]?.luck).toBe(0.17);
    expect(b.channels[0]?.audience).toBe(200_000);
    expect(b.channels[0]?.publishing?.count).toBe(4);
    expect(advanceYear(b).state.channels).toEqual(advanceYear(a).state.channels);
    const channel = b.channels[0];
    if (!channel) throw new Error('No channel');
    const posted = postToChannel(b, channel.id, 'meme');
    if (!posted.ok) throw new Error('Refused');
    expect(posted.value.channels[0]?.publishing?.count).toBe(5);
    expect(posted.value.channels[0]?.luck).toBe(0.17);
  });
  it.each([0, 1])('accepts valid luck endpoint %s without retuning it', (luck) => {
    const save = saved();
    const loaded = migrateSave({ ...save, channels: save.channels.map((c) => ({ ...c, luck })) });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error('Valid luck refused');
    expect(fromSave(loaded.value).channels[0]?.luck).toBe(luck);
  });
  it.each([-0.1, 1.1, 'lucky', Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects corrupt saved luck %s',
    (luck) => {
      const save = saved();
      expect(
        migrateSave({ ...save, channels: save.channels.map((c) => ({ ...c, luck })) }).ok,
      ).toBe(false);
    },
  );
});
