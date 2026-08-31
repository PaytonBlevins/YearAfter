import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { advanceYear, createNewGame } from '@yearafter/simulation';
import { MemorySaveRepository } from './adapters/memory';
import { migrateSave } from './migrations';
import { fromSave, toSave } from './serialize';
import { CURRENT_SAVE_VERSION, summarise } from './save-schema';

const newSave = (seed = 'SAVE-TEST') => {
  let state = createNewGame({ seed, startYear: 2000 });
  for (let i = 0; i < 12; i += 1) state = advanceYear(state).state;
  return { state, save: toSave(state, { id: asSaveId(`save-${seed}`) }) };
};

describe('serialisation', () => {
  it('round-trips game state through a save without losing anything', () => {
    const { state, save } = newSave();
    const restored = fromSave(save);
    expect(restored.player).toEqual(state.player);
    expect(restored.world).toEqual(state.world);
    expect(restored.rng.getSeed()).toBe(state.rng.getSeed());
  });

  it('resumes the simulation exactly where it left off', () => {
    const { state, save } = newSave('RESUME');

    const continuedDirectly = advanceYear(state).newEntries;
    const continuedFromSave = advanceYear(fromSave(save)).newEntries;

    expect(continuedFromSave).toEqual(continuedDirectly);
  });

  it('survives a JSON round trip, which is what SQLite actually stores', () => {
    const { save } = newSave('JSON');
    const parsed = JSON.parse(JSON.stringify(save));
    const migrated = migrateSave(parsed);
    expect(migrated.ok).toBe(true);
    if (migrated.ok) {
      expect(migrated.value).toEqual(save);
    }
  });
});

describe('MemorySaveRepository', () => {
  it('creates, loads, updates, lists and deletes', async () => {
    const repo = new MemorySaveRepository();
    const { save } = newSave('CRUD');

    expect((await repo.create(save)).ok).toBe(true);

    const loaded = await repo.load(save.id);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.value.player.age).toBe(12);

    const advanced = advanceYear(fromSave(save)).state;
    const updated = toSave(advanced, { id: save.id, createdAt: save.createdAt });
    expect((await repo.update(updated)).ok).toBe(true);

    const reloaded = await repo.load(save.id);
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) expect(reloaded.value.player.age).toBe(13);

    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.age).toBe(13);

    expect((await repo.delete(save.id)).ok).toBe(true);
    expect(await repo.list()).toHaveLength(0);
  });

  it('reports missing saves as typed failures rather than throwing', async () => {
    const repo = new MemorySaveRepository();
    const missing = asSaveId('nope');

    const loaded = await repo.load(missing);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.kind).toBe('notFound');

    expect((await repo.delete(missing)).ok).toBe(false);
    expect((await repo.update(newSave('X').save)).ok).toBe(false);
  });

  it('refuses to create the same save id twice', async () => {
    const repo = new MemorySaveRepository();
    const { save } = newSave('DUPE');
    expect((await repo.create(save)).ok).toBe(true);
    expect((await repo.create(save)).ok).toBe(false);
  });

  it('acceptance 0006: the character persists across a simulated app restart', async () => {
    const repo = new MemorySaveRepository();
    const { save } = newSave('RESTART');
    await repo.create(save);

    // "Restart": drop every in-memory reference and read the save back cold.
    const cold = await repo.load(save.id);
    expect(cold.ok).toBe(true);
    if (!cold.ok) return;

    const resumed = fromSave(cold.value);
    expect(resumed.player.firstName).toBe(save.player.firstName);
    expect(resumed.player.age).toBe(save.player.age);
    expect(resumed.player.talents).toEqual(save.player.talents);
    expect(resumed.player.timeline).toHaveLength(save.player.timeline.length);
  });

  it('lists newest first', async () => {
    const repo = new MemorySaveRepository();
    const older = toSave(createNewGame({ seed: 'OLD' }), {
      id: asSaveId('old'),
      updatedAt: 1_000,
    });
    const newer = toSave(createNewGame({ seed: 'NEW' }), {
      id: asSaveId('new'),
      updatedAt: 2_000,
    });
    await repo.create(older);
    await repo.create(newer);
    const list = await repo.list();
    expect(list.map((row) => row.id)).toEqual(['new', 'old']);
  });
});

describe('migrations', () => {
  it('accepts a current-version save unchanged', () => {
    const { save } = newSave('MIGRATE');
    const result = migrateSave(JSON.parse(JSON.stringify(save)));
    expect(result.ok).toBe(true);
  });

  it('rejects data that is not an object', () => {
    for (const bad of [null, 42, 'save', [1, 2, 3]]) {
      const result = migrateSave(bad);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe('notAnObject');
    }
  });

  it('rejects a save with no version', () => {
    const result = migrateSave({ id: 'x', player: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('missingVersion');
  });

  it('rejects a save written by a newer build instead of guessing', () => {
    const { save } = newSave('FUTURE');
    const result = migrateSave({ ...save, version: CURRENT_SAVE_VERSION + 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('fromTheFuture');
  });

  it('reports a corrupt save with the specific missing fields', () => {
    const result = migrateSave({ version: 1, id: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('corrupt');
      if (result.error.kind === 'corrupt') {
        expect(result.error.detail).toContain('player');
      }
    }
  });

  it('surfaces an unreadable stored save through the repository', async () => {
    const repo = new MemorySaveRepository();
    repo.seedRaw('broken', JSON.stringify({ version: 1, id: 'broken' }));
    const loaded = await repo.load(asSaveId('broken'));
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.error.kind).toBe('unreadable');
  });
});

describe('summaries', () => {
  it('carries what the save-select list renders', () => {
    const { state, save } = newSave('SUMMARY');
    const summary = summarise(save);
    expect(summary.characterName).toBe(`${state.player.firstName} ${state.player.lastName}`);
    expect(summary.age).toBe(state.player.age);
    expect(summary.year).toBe(state.world.year);
    expect(summary.generation).toBe(1);
  });
});

describe('v1 -> v2 migration (Ticket 0201 personality)', () => {
  const asV1 = (save: ReturnType<typeof toSave>) => {
    const { personality: _dropped, ...playerWithoutPersonality } = save.player as unknown as Record<
      string,
      unknown
    >;
    return { ...save, version: 1, player: playerWithoutPersonality };
  };

  it('loads a v1 save and fills neutral personality', () => {
    const { save } = newSave('V1');
    const migrated = migrateSave(asV1(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    expect(migrated.value.version).toBe(2);
    expect(migrated.value.player.personality.ambition).toBe(50);
    expect(migrated.value.player.personality.loyalty).toBe(50);
  });

  it('keeps everything else about the v1 character intact', () => {
    const { save } = newSave('V1-INTACT');
    const migrated = migrateSave(asV1(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    expect(migrated.value.player.firstName).toBe(save.player.firstName);
    expect(migrated.value.player.age).toBe(save.player.age);
    expect(migrated.value.player.talents).toEqual(save.player.talents);
    expect(migrated.value.player.timeline).toHaveLength(save.player.timeline.length);
    expect(migrated.value.rng).toEqual(save.rng);
  });

  it('resumes a migrated v1 save without drifting the simulation', () => {
    // The migration must not consume RNG, or the save stops replaying its seed.
    const { state, save } = newSave('V1-RESUME');
    const migrated = migrateSave(asV1(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    expect(advanceYear(fromSave(migrated.value)).newEntries).toEqual(advanceYear(state).newEntries);
  });

  it('does not overwrite personality if a v1 save somehow already had it', () => {
    const { save } = newSave('V1-KEEP');
    const withPersonality = {
      ...asV1(save),
      player: { ...asV1(save).player, personality: { ambition: 77 } },
    };
    const migrated = migrateSave(withPersonality);
    expect(migrated.ok).toBe(true);
    if (migrated.ok) {
      expect(migrated.value.player.personality.ambition).toBe(77);
    }
  });
});
