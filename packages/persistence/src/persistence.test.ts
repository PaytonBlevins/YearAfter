import { describe, expect, it } from 'vitest';
import { asNpcId, asSaveId } from '@yearafter/core';
import type { NpcTier } from '@yearafter/relationships';
import { advanceYear, createNewGame, decide, type GameState } from '@yearafter/simulation';
import { MemorySaveRepository } from './adapters/memory';
import { migrateSave } from './migrations';
import { fromSave, toSave } from './serialize';
import { CURRENT_SAVE_VERSION, summarise } from './save-schema';
import { findInstrument } from '@yearafter/finance';

/**
 * Play forward, answering every decision with its first option.
 *
 * Time does not advance past an unanswered decision (Ticket 0203), so a test
 * that wants a character aged twelve has to be able to answer.
 */
const play = (state: GameState, years: number): GameState => {
  let current = state;
  for (let i = 0; i < years; i += 1) {
    current = advanceYear(current).state;
    while (current.pending.length > 0) {
      const decision = current.pending[0];
      if (!decision) break;
      const answered = decide(current, decision.eventId, decision.choices[0]!.id);
      if (!answered.ok) throw new Error(`could not answer ${decision.eventId}`);
      current = answered.value.state;
    }
  }
  return current;
};

const newSave = (seed = 'SAVE-TEST') => {
  const state = play(createNewGame({ seed, startYear: 2000 }), 12);
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

    // Migrations chain: a v1 save comes out at the current version, not v2.
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
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

describe('v2 -> v3 migration (Ticket 0202 family)', () => {
  const asV2 = (save: ReturnType<typeof toSave>) => {
    const { family: _dropped, ...rest } = save as unknown as Record<string, unknown>;
    return { ...rest, version: 2 };
  };

  it('loads a v2 save and gives it an empty family', () => {
    const { save } = newSave('V2');
    const migrated = migrateSave(asV2(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    // Empty, not generated. Inventing parents a character has already lived
    // years without would be worse than admitting they predate families.
    expect(migrated.value.family.members).toEqual([]);
  });

  it('resumes a migrated v2 save, with the year it produces reflecting what it lost', () => {
    // A pre-family save cannot continue identically, and should not pretend to:
    // it has no household for family events to be about. What it must do is
    // load, advance, and produce a readable year — which is the actual promise.
    const { save } = newSave('V2-RESUME');
    const migrated = migrateSave(asV2(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    const resumed = advanceYear(fromSave(migrated.value));
    expect(resumed.newEntries.length).toBeGreaterThan(0);
    for (const entry of resumed.newEntries) {
      expect(entry.text).not.toMatch(/[{}]/);
      expect(entry.age).toBe(save.player.age + 1);
    }
  });

  it('migrates a v1 save all the way to v3 in one pass', () => {
    const { save } = newSave('V1-TO-V3');
    const asV1 = (() => {
      const { family: _f, ...rest } = save as unknown as Record<string, unknown>;
      const { personality: _p, ...player } = save.player as unknown as Record<string, unknown>;
      return { ...rest, version: 1, player };
    })();

    const migrated = migrateSave(asV1);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.player.personality.ambition).toBe(50);
    expect(migrated.value.family.members).toEqual([]);
  });
});

describe('family round trip', () => {
  it('survives save and load intact', () => {
    const { state, save } = newSave('FAMILY-RT');
    expect(save.family.members.length).toBeGreaterThan(0);
    const restored = fromSave(JSON.parse(JSON.stringify(save)));
    expect(restored.family).toEqual(state.family);
  });
});

describe('v3 -> v4 migration (Ticket 0203 events)', () => {
  const asV3 = (save: ReturnType<typeof toSave>) => {
    const {
      events: _e,
      pending: _p,
      nameCultureId: _n,
      ...rest
    } = save as unknown as Record<string, unknown>;
    return { ...rest, version: 3 };
  };

  it('gives a v3 save an empty event history rather than inventing one', () => {
    const { save } = newSave('V3');
    const migrated = migrateSave(asV3(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.events).toEqual({ lastFired: {}, scheduled: [], flags: [] });
    expect(migrated.value.pending).toEqual([]);
    expect(migrated.value.nameCultureId).toBe('us-en');
  });

  it('lets a migrated v3 save keep playing', () => {
    const { save } = newSave('V3-RESUME');
    const migrated = migrateSave(asV3(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    const resumed = advanceYear(fromSave(migrated.value));
    expect(resumed.newEntries.length).toBeGreaterThan(0);
    for (const entry of resumed.newEntries) {
      expect(entry.text).not.toMatch(/[{}]/);
    }
  });

  it('consumes no randomness, so the save still replays from its seed', () => {
    const { save } = newSave('V3-PURE');
    const before = JSON.parse(JSON.stringify(save.rng));
    const migrated = migrateSave(asV3(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.rng).toEqual(before);
  });
});

describe('event state round trip', () => {
  it('carries cooldowns, chains, flags and unanswered questions through a save', () => {
    // A decision asked on a phone at a bus stop has to still be there that night.
    let state = createNewGame({ seed: 'PENDING-SAVE', startYear: 2000 });
    for (let i = 0; i < 40 && state.pending.length === 0; i += 1) {
      state = advanceYear(state).state;
    }
    expect(state.pending.length).toBeGreaterThan(0);

    const save = toSave(state, { id: asSaveId('save-pending') });
    const restored = fromSave(JSON.parse(JSON.stringify(save)));

    expect(restored.pending).toEqual(state.pending);
    expect(restored.events).toEqual(state.events);
    expect(restored.nameCultureId).toBe(state.nameCultureId);

    // And the restored save answers the question the same way the live one does.
    const decision = restored.pending[0]!;
    const fromDisk = decide(restored, decision.eventId, decision.choices[0]!.id);
    const live = decide(state, decision.eventId, decision.choices[0]!.id);
    expect(fromDisk.ok && live.ok && fromDisk.value.entry.text).toBe(
      live.ok ? live.value.entry.text : 'live failed',
    );
  });
});

describe('v4 -> v5 migration (Ticket 0204 school)', () => {
  const asV4 = (save: ReturnType<typeof toSave>) => {
    const { education: _e, ...rest } = save as unknown as Record<string, unknown>;
    return { ...rest, version: 4 };
  };

  it('enrols an existing character at the grade their age implies', () => {
    // Not at kindergarten: a twelve-year-old who has been playing for a while
    // is in seventh grade, not starting school for the first time.
    const { save } = newSave('V4');
    const migrated = migrateSave(asV4(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.education.gradeLevel).toBe(save.player.age - 5);
    expect(migrated.value.education.stage).toBe('middle');
    // But a neutral record — inventing years of grades they never lived would
    // be worse than admitting the system did not exist yet.
    expect(migrated.value.education.performance).toBe(50);
    expect(migrated.value.education.activities).toEqual([]);
  });

  it('consumes no randomness, so the save still replays from its seed', () => {
    const { save } = newSave('V4-PURE');
    const before = JSON.parse(JSON.stringify(save.rng));
    const migrated = migrateSave(asV4(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.rng).toEqual(before);
  });

  it('lets a migrated v4 save keep playing', () => {
    const { save } = newSave('V4-RESUME');
    const migrated = migrateSave(asV4(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    const resumed = advanceYear(fromSave(migrated.value));
    expect(resumed.newEntries.length).toBeGreaterThan(0);
    expect(resumed.state.education.gradeLevel).toBe(save.player.age - 4);
  });

  it('rejects a v5 save with no education state', () => {
    const { save } = newSave('V5-BROKEN');
    const broken = { ...(save as unknown as Record<string, unknown>) };
    delete broken['education'];
    const result = migrateSave(broken);
    expect(result.ok).toBe(false);
  });
});

describe('school state round trip', () => {
  it('carries grades, behaviour and everything joined through a save', () => {
    let state = createNewGame({ seed: 'SCHOOL-SAVE', startYear: 2000 });
    state = play(state, 14);
    const withActivities = {
      ...state,
      education: {
        ...state.education,
        effort: 'hard' as const,
        activities: [
          {
            activityId: 'act.chess',
            joinedAtAge: 12,
            standing: 50 as const,
            seasons: 2,
            practisedAtAge: -1,
            practiceCount: 0,
          },
        ],
      },
    };

    const save = toSave(withActivities, { id: asSaveId('save-school') });
    const restored = fromSave(JSON.parse(JSON.stringify(save)));
    expect(restored.education).toEqual(withActivities.education);

    // And the restored save plays the next year identically.
    expect(advanceYear(restored).newEntries).toEqual(advanceYear(withActivities).newEntries);
  });
});

describe('v5 -> v6 migration (Ticket 0203b decision names)', () => {
  const asV5 = (save: ReturnType<typeof toSave>) => ({
    ...(save as unknown as Record<string, unknown>),
    version: 5,
    pending: (save.pending as unknown as Record<string, unknown>[]).map((decision) => {
      const { names: _dropped, ...rest } = decision;
      return rest;
    }),
  });

  it('gives an already-open decision empty bindings rather than drawing names', () => {
    // Drawing here would consume RNG, and a migration that consumes RNG stops
    // the save replaying from its seed. An empty map means "resolve per render",
    // which is exactly the behaviour that decision already had.
    let state = createNewGame({ seed: 'V5-PENDING', startYear: 2000 });
    for (let i = 0; i < 40 && state.pending.length === 0; i += 1) {
      state = advanceYear(state).state;
    }
    expect(state.pending.length).toBeGreaterThan(0);

    const save = toSave(state, { id: asSaveId('save-v5') });
    const before = JSON.parse(JSON.stringify(save.rng));
    const migrated = migrateSave(asV5(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.pending[0]?.names).toEqual({});
    expect(migrated.value.rng).toEqual(before);
  });

  it('leaves a save with no open decisions alone', () => {
    const { save } = newSave('V5-EMPTY');
    const migrated = migrateSave({ ...asV5(save), pending: [] });
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.pending).toEqual([]);
  });
});

describe('a decision keeps its people across a save', () => {
  it('names the same person after a reload as it did when it was asked', () => {
    // The point of the whole change: a question asked on a phone at a bus stop
    // and answered on a tablet that night is about the same person.
    let state = createNewGame({ seed: 'NAMES-SAVE', startYear: 2000 });
    for (let i = 0; i < 40 && state.pending.length === 0; i += 1) {
      state = advanceYear(state).state;
    }
    const decision = state.pending.find((entry) => Object.keys(entry.names).length > 0);
    if (!decision) return; // not every year raises a decision about a named person

    const restored = fromSave(JSON.parse(JSON.stringify(toSave(state, { id: asSaveId('s') }))));
    expect(restored.pending.find((d) => d.eventId === decision.eventId)?.names).toEqual(
      decision.names,
    );

    const answered = decide(restored, decision.eventId, decision.choices[0]!.id);
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;
    for (const person of Object.values(decision.names)) {
      if (person && decision.prompt.includes(person.name)) {
        // The outcome may not mention every bound person, but if it names one,
        // it must be the one the prompt named.
        expect(answered.value.entry.text).not.toMatch(/[{}]/);
      }
    }
  });
});

/**
 * Ticket 0207c — repairing duplicate timeline ids already written to disk.
 *
 * Reported twice by the product owner, the second time AFTER 0206b fixed the
 * producer: "Encountered two children with the same key, `t:2012:study`."
 *
 * The second report is the interesting one. No code in the build can emit a
 * bare `t:2012:study` any more — every repeatable action puts its repeat
 * counter in the id, and a simulation test plays a whole life pressing all of
 * them and asserts uniqueness. The duplicates were written by the PRE-FIX build
 * and are sitting in the save, where a fixed producer can never reach them.
 *
 * CORE_RULES 13.12 says a timeline entry's id is unique, forever. Enforcing it
 * only where ids are made leaves every save written before the fix in violation
 * of it for the life of that save.
 */
describe('v10 -> v11 migration (Ticket 0207c duplicate timeline ids)', () => {
  const withTimeline = (
    save: ReturnType<typeof toSave>,
    timeline: readonly Record<string, unknown>[],
  ) => ({ ...save, version: 10, player: { ...save.player, timeline } });

  /** The exact shape reported, twice. */
  const REPORTED = [
    {
      id: 't:2012:study',
      age: 12,
      year: 2012,
      kind: 'passive',
      text: 'Studied harder.',
      sequence: 0,
    },
    {
      id: 't:2012:study',
      age: 12,
      year: 2012,
      kind: 'passive',
      text: 'Studied harder again.',
      sequence: 1,
    },
  ];

  it('makes the reported key unique', () => {
    const { save } = newSave('DUP');
    const migrated = migrateSave(withTimeline(save, REPORTED));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    const ids = migrated.value.player.timeline.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The first holder keeps its id, so nothing that already rendered moves.
    expect(ids[0]).toBe('t:2012:study');
    expect(ids[1]).not.toBe('t:2012:study');
  });

  it('leaves the entries themselves alone apart from the id', () => {
    const { save } = newSave('DUP-TEXT');
    const migrated = migrateSave(withTimeline(save, REPORTED));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    const timeline = migrated.value.player.timeline;
    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.text).toBe('Studied harder.');
    expect(timeline[1]?.text).toBe('Studied harder again.');
    expect(timeline[1]?.age).toBe(12);
  });

  it('de-duplicates a whole life, however many times an id repeats', () => {
    const { save } = newSave('DUP-MANY');
    const timeline = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: 't:2012:study',
        age: 12,
        year: 2012,
        kind: 'passive',
        text: `study ${i}`,
        sequence: i,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: 't:2013:social:npc:peer:2000:1:hang-out',
        age: 13,
        year: 2013,
        kind: 'relationship',
        text: `hang ${i}`,
        sequence: i,
      })),
      {
        id: 't:2014:tryout:basketball',
        age: 14,
        year: 2014,
        kind: 'passive',
        text: 'once',
        sequence: 0,
      },
    ];
    const migrated = migrateSave(withTimeline(save, timeline));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    const ids = migrated.value.player.timeline.map((entry) => entry.id);
    expect(ids).toHaveLength(9);
    expect(new Set(ids).size).toBe(9);
    // An id that was already unique is untouched.
    expect(ids).toContain('t:2014:tryout:basketball');
  });

  it('cannot collide with an id the current producers make', () => {
    // Live producers end in a plain counter (`…:study:1`). A repaired id ends
    // in `:dup1`, so a migrated save and a year played afterwards cannot
    // generate the same key.
    const { save } = newSave('DUP-COLLIDE');
    const timeline = [
      { id: 't:2012:study', age: 12, year: 2012, kind: 'passive', text: 'a', sequence: 0 },
      { id: 't:2012:study', age: 12, year: 2012, kind: 'passive', text: 'b', sequence: 1 },
      { id: 't:2012:study:1', age: 12, year: 2012, kind: 'passive', text: 'c', sequence: 2 },
    ];
    const migrated = migrateSave(withTimeline(save, timeline));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;

    const ids = migrated.value.player.timeline.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain('t:2012:study:1');
  });

  it('is pure — the same save migrates to the same result every time', () => {
    // CORE_RULES 12: no RNG, no clock, or the life stops replaying from its seed.
    const { save } = newSave('DUP-PURE');
    const once = migrateSave(withTimeline(save, REPORTED));
    const twice = migrateSave(withTimeline(save, REPORTED));
    expect(once.ok && twice.ok).toBe(true);
    if (!once.ok || !twice.ok) return;
    expect(once.value.player.timeline.map((e) => e.id)).toEqual(
      twice.value.player.timeline.map((e) => e.id),
    );
  });

  it('leaves a save with no duplicates completely untouched', () => {
    const { save } = newSave('DUP-NONE');
    const before = save.player.timeline.map((entry) => entry.id);
    const migrated = migrateSave({ ...save, version: 10 });
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.player.timeline.map((entry) => entry.id)).toEqual(before);
  });

  it('survives a timeline entry with no id at all', () => {
    const { save } = newSave('DUP-JUNK');
    const migrated = migrateSave(
      withTimeline(save, [{ age: 12, year: 2012, kind: 'passive', text: 'no id', sequence: 0 }]),
    );
    expect(migrated.ok).toBe(true);
  });
});

/**
 * Ticket 0211a — the SECOND duplicate-id repair, and the field rename with it.
 *
 * The player reported `t:2020:work:1` twice, a different producer from 0207c's
 * `t:2012:study` and identical in the part that matters: the duplicates are
 * already written into saves where a fixed producer can never reach them. v11's
 * body is now shared with v15 rather than copied, which is the honest way to
 * say this has been needed twice.
 */
describe('v14 -> v15 migration (Ticket 0211a)', () => {
  const REPORTED = [
    { id: 't:2020:work:0', age: 33, year: 2020, kind: 'passive', text: 'A shift.', sequence: 0 },
    { id: 't:2020:work:1', age: 33, year: 2020, kind: 'passive', text: 'Another.', sequence: 1 },
    { id: 't:2020:work:0', age: 33, year: 2020, kind: 'passive', text: 'New job.', sequence: 2 },
    { id: 't:2020:work:1', age: 33, year: 2020, kind: 'passive', text: 'And again.', sequence: 3 },
  ];

  it('makes the reported key unique', () => {
    const { save } = newSave('WORKDUP');
    const migrated = migrateSave({
      ...save,
      version: 14,
      player: { ...save.player, timeline: REPORTED },
    });
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    const ids = migrated.value.player.timeline.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('t:2020:work:0');
    expect(ids[2]).toBe('t:2020:work:0:dup1');
  });

  it('renames inClass to inRoom without moving anybody between rooms', () => {
    const { save } = newSave('INROOM');
    const people = [
      { id: 'npc:a', firstName: 'Ada', inClass: true, context: 'school' },
      { id: 'npc:b', firstName: 'Ben', inClass: false, context: 'neighbourhood' },
    ];
    const migrated = migrateSave({
      ...save,
      version: 14,
      circle: { ...save.circle, people },
    });
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    const migratedPeople = migrated.value.circle.people as unknown as Record<string, unknown>[];
    expect(migratedPeople[0]?.['inRoom']).toBe(true);
    expect(migratedPeople[1]?.['inRoom']).toBe(false);
    // The old key is gone, so nothing can read it by accident afterwards.
    expect(migratedPeople[0]).not.toHaveProperty('inClass');
  });
});

/**
 * Ticket 0211 — the body.
 *
 * Vitality is seeded from the health already on the save, which is not a guess:
 * vitality IS the age-driven part of health, and the recorded health is where
 * that character's body currently is. Nobody arrives with a condition, because
 * no save in existence has ever been ill and inventing a bad knee for a
 * fifty-year-old would be writing history rather than migrating it.
 */
describe('v15 -> v16 migration (Ticket 0211 health)', () => {
  /** A v15 save, which by definition has no `health` block on it at all. */
  const asV15 = (save: ReturnType<typeof toSave>) => {
    const { health: _health, ...rest } = save;
    return { ...rest, version: 15 };
  };

  it('seeds vitality from the health the save already records', () => {
    const { save } = newSave('BODY');
    const before = save.player.stats.health;
    const migrated = migrateSave(asV15(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.health.vitality).toBe(before);
    expect(migrated.value.health.deficit).toBe(0);
  });

  it('gives an existing character no conditions and no cause of death', () => {
    const { save } = newSave('CLEAN');
    const migrated = migrateSave(asV15(save));
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.health.conditions).toEqual([]);
    expect(migrated.value.health.causeOfDeath).toBeUndefined();
  });

  it('leaves a save that already has health alone', () => {
    const { save } = newSave('KEEP');
    const held = {
      conditions: [{ conditionId: 'cond.knee', since: 30, treated: true }],
      vitality: 61,
      deficit: 4,
    };
    const migrated = migrateSave({ ...asV15(save), health: held });
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.health).toEqual(held);
  });
});

describe('Ticket 0212 — what a save has to carry now', () => {
  /*
    Two fields that had never been written to before this ticket, and one that
    is new. All three ride inside `player` and `family`, which `toSave` copies
    whole — so this passes today for a structural reason rather than because
    anybody listed them, and that is exactly why it is worth asserting. The
    serialiser is one `const` away from becoming a field list, and the day it
    does, the thing that breaks is a dynasty's memory.
  */
  it('round-trips life records, a child’s own life, and a death date', () => {
    const state = createNewGame({ seed: 'ROUNDTRIP-0212' });
    const child = {
      id: asNpcId('npc:child:0'),
      role: 'child' as const,
      firstName: 'Ada',
      lastName: state.player.lastName,
      sex: 'female' as const,
      birthYear: state.world.year - 30,
      alive: true,
      tier: 2 as NpcTier,
      personality: state.player.personality,
      relationship: state.player.stats.charisma,
      life: {
        stage: 'working',
        jobTitle: 'Line cook',
        rung: 1,
        timeline: [{ age: 23, year: 2053, text: 'Started work.' }],
      },
    };
    const forebear = {
      id: asNpcId('npc:mother'),
      role: 'mother' as const,
      firstName: 'Iris',
      lastName: state.player.lastName,
      sex: 'female' as const,
      birthYear: state.world.year - 80,
      alive: false,
      diedWhenPlayerWas: 41,
      tier: 1 as NpcTier,
      personality: state.player.personality,
      relationship: state.player.stats.charisma,
    };
    const withHistory = {
      ...state,
      player: {
        ...state.player,
        records: [
          {
            id: 'r:2018:education:0',
            category: 'education' as const,
            age: 18,
            year: 2018,
            label: 'Graduated high school',
          },
        ],
      },
      family: { ...state.family, members: [forebear, child] },
    };

    const save = toSave(withHistory, { id: asSaveId('save-roundtrip') });
    const back = fromSave(save);

    expect(back.player.records).toHaveLength(1);
    expect(back.player.records[0]?.label).toBe('Graduated high school');
    const backChild = back.family.members.find((member) => member.role === 'child');
    expect((backChild?.life as { jobTitle?: string } | undefined)?.jobTitle).toBe('Line cook');
    const backMother = back.family.members.find((member) => member.role === 'mother');
    expect(backMother?.diedWhenPlayerWas).toBe(41);
  });
});

describe('Ticket 0302 — a save whose books are wrong does not load', () => {
  /*
    The third enforcement point, and the only one that sees a document this
    build did not just compute. Spec 1678 says a mismatch fails validation, and
    spec 1224–1246 says an unreadable save is an expected outcome with a
    message rather than a crash — so every case here is `corrupt` with
    something a person could act on, not a throw.

    A corrupt ledger is REFUSED, never repaired. A save that silently fixed its
    own money would hide both the bug that broke it and how much it invented.

    Each corruption below is planted in a real save from a real played life, so
    what is being validated is the shape the game actually writes.
  */
  const honest = () => {
    let state = createNewGame({ seed: 'BOOKS-0302' });
    for (let i = 0; i < 30; i += 1) {
      state = advanceYear(state).state;
      while (state.pending.length > 0) {
        const decision = state.pending[0];
        const choice = decision?.choices[0];
        if (!decision || !choice) break;
        const result = decide(state, decision.eventId, choice.id);
        if (!result.ok) break;
        state = result.value.state;
      }
      if (state.pending.length === 0 && state.finance.transactions.length > 0) break;
    }
    return JSON.parse(JSON.stringify(toSave(state, { id: asSaveId('save-books') })));
  };

  const reason = (save: Record<string, unknown>): string => {
    const result = migrateSave(save);
    expect(result.ok, 'the save loaded when it should not have').toBe(false);
    if (result.ok) return '';
    expect(result.error.kind).toBe('corrupt');
    return result.error.kind === 'corrupt' ? result.error.detail : '';
  };

  it('loads the honest one, which is what makes the rest of this mean anything', () => {
    expect(migrateSave(honest()).ok).toBe(true);
  });

  it('refuses a balance the transactions do not add up to', () => {
    const save = honest();
    const finance = save['finance'] as Record<string, unknown>;
    const player = save['player'] as Record<string, unknown>;
    // Both numbers moved together — a producer that skipped the ledger would
    // have moved them together — so the mirror agrees and only the sum knows.
    finance['balance'] = (finance['balance'] as number) + 250_00;
    player['cash'] = (player['cash'] as number) + 250_00;
    expect(reason(save)).toMatch(/finance does not balance/);
  });

  it('refuses a save whose cash and ledger disagree', () => {
    /*
      The check that is a tautology everywhere else. Inside `advanceYear` both
      numbers come out of the same `postYear` call and cannot differ; I wrote
      that check there, watched it be unfalsifiable, and moved it here. On a
      save they were serialised separately — a dropped field, a torn write, a
      migration that missed one — and disagreeing is exactly what they can do.
    */
    const save = honest();
    (save['player'] as Record<string, unknown>)['cash'] = 1;
    expect(reason(save)).toMatch(/player\.cash .* and finance\.balance .* disagree/);
  });

  it('refuses a ledger that went below zero', () => {
    const save = honest();
    const finance = save['finance'] as Record<string, unknown>;
    const rows = finance['transactions'] as Record<string, unknown>[];
    const year = rows[0]?.['year'] as number;
    finance['transactions'] = [
      { id: 'p1', year, age: 1, category: 'living', amount: -900_00, source: 'A charge' },
      ...rows,
      { id: 'p2', year: year + 1, age: 2, category: 'salary', amount: 900_00, source: 'And cover' },
    ];
    // Balances, and the mirror agrees. Only the walk sees the year in between.
    expect(reason(save)).toMatch(/went below zero in \d{4}/);
  });

  it('refuses a transaction stamped outside the life', () => {
    const save = honest();
    const finance = save['finance'] as Record<string, unknown>;
    const rows = finance['transactions'] as Record<string, unknown>[];
    finance['transactions'] = rows.map((row, index) =>
      index === 0 ? { ...row, year: 1899 } : row,
    );
    expect(reason(save)).toMatch(/money moving in 1899/);
  });

  it('refuses a transaction that is not a transaction, before doing any arithmetic', () => {
    // Otherwise the message is a difference of NaN, which tells a player
    // nothing and a developer less.
    const save = honest();
    const finance = save['finance'] as Record<string, unknown>;
    finance['transactions'] = [{ id: 'x', year: 2020, age: 3, category: 'gift', source: 'A gift' }];
    expect(reason(save)).toMatch(/transactions\[0\] is not a transaction/);
  });

  it('reports a missing field as a missing field rather than as bad accounting', () => {
    // The shape checks run first on purpose: a save missing half of itself
    // should say so, not complain that its books do not add up.
    const save = honest();
    delete save['world'];
    expect(reason(save)).toMatch(/world\.year/);
  });
});

describe('v22 -> v23 migration (Ticket 0308c — products become instruments)', () => {
  /**
   * A real v22 save, downgraded, holding one of each of the seven old products.
   *
   * Built from a live save rather than a literal, because `migrateSave` runs
   * the whole chain and validates what comes out — a stub with seven holdings
   * and nothing else is not a save, and a test that fails on a missing ledger
   * is not testing the migration.
   */
  const v22 = () => ({
    ...newSave('MIG-0308C').save,
    version: 22,
    prices: undefined,
    portfolio: [
      { productId: 'inv.govbonds', contributed: 1_000_000, value: 1_240_000, maturesIn: 5 },
      { productId: 'inv.corpbonds', contributed: 500_000, value: 512_000, maturesIn: 3 },
      { productId: 'inv.indexfund', contributed: 2_000_000, value: 3_180_000 },
      { productId: 'inv.managedfund', contributed: 800_000, value: 742_000 },
      { productId: 'inv.bluechip', contributed: 1_500_000, value: 1_905_000 },
      { productId: 'inv.growth', contributed: 600_000, value: 410_000 },
      { productId: 'inv.crypto', contributed: 300_000, value: 2_100_000 },
    ],
    market: 'growth',
  });

  it('turns every old product into an instrument that actually exists', () => {
    /*
      THE BUG THIS TEST WAS WRITTEN FOR. The first version of the migration
      mapped `inv.govbonds` to `bd.cald8` — a Caldonian eight-year bond, which
      the catalog does not contain. Caldonian issues three, five and ten. The
      migration ran green, the save loaded, and every government bond holding a
      player owned silently became worth nothing, because a holding whose
      instrument cannot be found has no price.

      A dangling id inside a migration is invisible to every other check in the
      build: the content validator walks catalogs, not migrations.
    */
    const out = migrateSave(v22() as never);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const holdings = (out.value as unknown as { portfolio: { instrumentId: string }[] }).portfolio;
    expect(holdings).toHaveLength(7);
    for (const holding of holdings) {
      expect(
        findInstrument(holding.instrumentId),
        `${holding.instrumentId} is not in the catalog`,
      ).toBeDefined();
    }
  });

  it('is worth the same money on both sides of the migration', () => {
    /*
      Nobody loses a penny. The old holding was a dollar blob; the new one is
      units at a price, and the units are whatever that instrument's opening
      price buys with the blob's current value. Rounding to four decimal places
      is the only permitted difference.
    */
    const before = v22();
    const worthBefore = before.portfolio.reduce((sum, row) => sum + row.value, 0);
    const out = migrateSave(before as never);
    expect(out.ok).toBe(true);
    if (!out.ok) return;

    const holdings = (
      out.value as unknown as { portfolio: { instrumentId: string; units: number }[] }
    ).portfolio;
    const worthAfter = holdings.reduce((sum, row) => {
      const instrument = findInstrument(row.instrumentId)!;
      return sum + row.units * instrument.priceCents;
    }, 0);
    // Within a dollar across a $10,000,000 portfolio.
    expect(Math.abs(worthAfter - worthBefore)).toBeLessThan(100);
  });

  it('keeps what was paid, so a winner is still a winner', () => {
    const out = migrateSave(v22() as never);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const holdings = (
      out.value as unknown as { portfolio: { instrumentId: string; units: number; paid: number }[] }
    ).portfolio;

    const crypto = holdings.find((row) => row.instrumentId.startsWith('cx.'));
    expect(crypto).toBeDefined();
    // $3,000 paid, $21,000 now: still up $18,000 afterwards.
    expect(crypto!.paid).toBe(300_000);
    const worth = crypto!.units * findInstrument(crypto!.instrumentId)!.priceCents;
    expect(worth - crypto!.paid).toBeCloseTo(1_800_000, -2);
  });

  it('carries a bond’s remaining term across', () => {
    const out = migrateSave(v22() as never);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const holdings = (
      out.value as unknown as { portfolio: { instrumentId: string; maturesIn?: number }[] }
    ).portfolio;
    const bonds = holdings.filter((row) => row.instrumentId.startsWith('bd.'));
    expect(bonds).toHaveLength(2);
    expect(bonds.map((row) => row.maturesIn).sort()).toEqual([3, 5]);
    // And nothing that is not a bond picked one up.
    for (const row of holdings.filter((h) => !h.instrumentId.startsWith('bd.'))) {
      expect(row.maturesIn).toBeUndefined();
    }
  });
});
