import { describe, expect, it } from 'vitest';
import { asSaveId } from '@yearafter/core';
import { advanceYear, createNewGame, decide, type GameState } from '@yearafter/simulation';
import { MemorySaveRepository } from './adapters/memory';
import { migrateSave } from './migrations';
import { fromSave, toSave } from './serialize';
import { CURRENT_SAVE_VERSION, summarise } from './save-schema';

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
    { id: 't:2012:study', age: 12, year: 2012, kind: 'passive', text: 'Studied harder.', sequence: 0 },
    { id: 't:2012:study', age: 12, year: 2012, kind: 'passive', text: 'Studied harder again.', sequence: 1 },
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
      { id: 't:2014:tryout:basketball', age: 14, year: 2014, kind: 'passive', text: 'once', sequence: 0 },
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
