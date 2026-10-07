import { describe, expect, it } from 'vitest';
import { asNpcId, asSaveId, dollars } from '@yearafter/core';
import type { PendingDecision } from '@yearafter/events';
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

describe('v23 -> v24 migration (Ticket 0309 — advisors)', () => {
  /**
   * The migration that deliberately moves no money.
   *
   * Four in a row now have refused to invent a decision on an existing
   * character's behalf: 21 gave nobody a loan, 22 gave nobody a portfolio, 23
   * refused to refund one to cash, and this one hires nobody. An advisor has a
   * yearly fee attached, and a save waking up next to a bill it never agreed to
   * would be the worst version of a migration being helpful.
   */
  const v23 = () => ({ ...newSave('MIG-0309').save, version: 23 });

  it('hires nobody', () => {
    const migrated = migrateSave(v23());
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    // `migrateSave` runs the WHOLE chain, so the version it lands on is
    // whatever is current — asserting a literal 24 here made this test fail the
    // moment 0310 added a step, which is the test being about the wrong thing.
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.advisorId).toBeUndefined();
  });

  it('changes nothing but the version', () => {
    /*
      The strongest thing that can be said about a version-only migration, and
      worth asserting rather than assuming: everything except the version is
      byte-identical. A migration that quietly normalised a field would pass a
      spot check on the field somebody thought to look at.
    */
    const before = v23();
    const migrated = migrateSave(before);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    const { version: _v, ...after } = migrated.value as unknown as Record<string, unknown>;
    const { version: _v2, ...original } = before as unknown as Record<string, unknown>;
    /*
      Everything except the version must be byte-identical. `retirement` is on
      both sides because a save built today already carries one and the 0310
      step leaves an existing account alone — which is itself the thing worth
      asserting, and is covered directly in the v24 -> v25 block below.
    */
    expect(after).toEqual(original);
  });

  it('carries an advisor across a save and a load', () => {
    const save = { ...newSave('MIG-0309B').save, advisorId: 'adv.branch' };
    const parsed = JSON.parse(JSON.stringify(save)) as typeof save;
    const migrated = migrateSave(parsed);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.advisorId).toBe('adv.branch');
  });
});

describe('v24 -> v25 migration (Ticket 0310 — retirement)', () => {
  /**
   * The fifth migration in a row to refuse to invent a decision.
   *
   * Backdating contributions would hand an existing fifty-year-old a balance
   * they never chose to build — and with it the employer match, which is money
   * from a job they may no longer hold. `rate` starts at zero for the same
   * reason migration 21 gave nobody a loan: a standing instruction to move 6%
   * of every future paycheque is an instruction, and the game never received
   * one.
   */
  const v24 = () => {
    const { retirement: _drop, ...rest } = newSave('MIG-0310').save as unknown as Record<
      string,
      unknown
    >;
    return { ...rest, version: 24 } as unknown as Parameters<typeof migrateSave>[0];
  };

  it('opens an empty account and retires nobody', () => {
    const migrated = migrateSave(v24());
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(Number(migrated.value.retirement.balance)).toBe(0);
    expect(migrated.value.retirement.rate).toBe(0);
    expect(migrated.value.retirement.serviceYears).toBe(0);
    expect(migrated.value.retirement.retiredAtAge).toBeUndefined();
  });

  it('leaves an account that already exists alone', () => {
    const existing = {
      balance: 4_200_000,
      rate: 0.06,
      serviceYears: 11,
      finalPensionablePay: 8_800_000,
    };
    const save = { ...(v24() as unknown as Record<string, unknown>), retirement: existing };
    const migrated = migrateSave(save as unknown as Parameters<typeof migrateSave>[0]);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.retirement).toEqual(existing);
  });

  it('carries a retired character across a save and a load', () => {
    const save = {
      ...newSave('MIG-0310B').save,
      retirement: {
        balance: 1_000_000,
        rate: 0,
        serviceYears: 30,
        finalPensionablePay: 9_000_000,
        retiredAtAge: 62,
      },
    };
    const parsed = JSON.parse(JSON.stringify(save)) as typeof save;
    const migrated = migrateSave(parsed);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.retirement.retiredAtAge).toBe(62);
    expect(migrated.value.retirement.serviceYears).toBe(30);
  });
});

describe('Ticket 0406 — a question survives being saved', () => {
  /*
    THE BUG THIS EXISTS FOR BRICKED REAL SAVES, and it lived through two
    tickets because nothing here had ever round-tripped a save with a decision
    still open. Every other test answers its questions in the process that
    raised them, so `pending` was always empty by the time anything reached
    `toSave`.

    Reported as: "this is stuck on the screen everytime that I reset it."
    `pending` was serialized and the offer behind it was not, so the reloaded
    save held a question `decide` could not answer, and `advanceYear` will not
    advance past an open question. The character could not be aged again, ever.
  */
  /*
    Ticket 0410 adds two more borrowers of this queue, and they carry a payload
    for the same reason the first two do — so they can be left out of the save
    for the same reason, and brick a save in exactly the same way. Named here
    rather than in three separate finds, so the next door that opens is one
    entry rather than three edits.
  */
  const SYSTEMIC = new Set(['career.offer', 'education.offer', 'romance.offer', 'family.offer']);

  function playUntilAnOfferIsOpen(): GameState | undefined {
    for (let seed = 0; seed < 40; seed += 1) {
      let state = createNewGame({ seed: `offer-roundtrip-${seed}` });
      for (let year = 0; year < 70; year += 1) {
        if (state.health.diedAtAge !== undefined) break;
        state = advanceYear(state).state;
        const open = state.pending.find((decision) => SYSTEMIC.has(decision.eventId));
        if (open) return state;
        // Answer anything else so the loop can keep going.
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const decision = state.pending[0];
          const choice = decision?.choices[0];
          if (!decision || !choice) break;
          const result = decide(state, decision.eventId, choice.id);
          if (!result.ok) break;
          state = result.value.state;
        }
      }
    }
    return undefined;
  }

  it('can still be answered after a save and a load', () => {
    const live = playUntilAnOfferIsOpen();
    expect(live, 'no seed produced an open offer — the harness has drifted').toBeDefined();
    if (!live) return;

    const open = live.pending.find((decision) => SYSTEMIC.has(decision.eventId));
    if (!open) return;

    const reloaded = fromSave(toSave(live, { id: asSaveId('s-offer') }));
    expect(reloaded.pending.map((d) => d.eventId)).toContain(open.eventId);

    /*
      THE ASSERTION. Before the fix this returned `{ ok: false }` with
      `unresolvable`, forever, on every reload — and because `advanceYear`
      refuses to advance while `pending` is non-empty, that was the end of the
      character.
    */
    const answered = decide(reloaded, open.eventId, open.choices[0]!.id);
    expect(answered.ok, `a reloaded ${open.eventId} could not be answered`).toBe(true);
  });

  it('unbricks a save that was already stuck', () => {
    /*
      Built from a REAL save rather than a literal, because `migrateSave`
      validates the whole shape on the way through and a hand-written stub
      fails as 'corrupt' long before the repair runs — which is the same reason
      this bug was never caught by a unit test of the migration alone.
    */
    const { save } = newSave('STUCK');
    const stuck = JSON.parse(JSON.stringify(save));
    stuck.version = 27;
    stuck.pending = [
      {
        eventId: 'education.offer',
        age: 18,
        year: 2024,
        prompt: 'x',
        choices: [{ id: 'apply', label: 'Apply' }],
        names: {},
      },
      {
        eventId: 'd.random.wallet',
        age: 18,
        year: 2024,
        prompt: 'x',
        choices: [{ id: 'keep', label: 'Keep' }],
        names: {},
      },
    ];
    delete stuck.collegeOffer;

    const result = migrateSave(stuck);
    expect(result.ok, 'the repaired save no longer validates').toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(CURRENT_SAVE_VERSION);
    // The unanswerable one is dropped; the ordinary event is untouched.
    expect(result.value.pending.map((d) => d.eventId)).toEqual(['d.random.wallet']);
  });

  it('round-trips an open life question, and unbricks one that lost its payload', () => {
    /*
      Ticket 0410, and deliberately the same two tests as above rather than a
      cleverer one. The bug that cost a player their save was a decision whose
      payload was not persisted; this ticket adds a decision with a payload, so
      it gets both halves the moment it exists instead of two tickets later.
    */
    const { save } = newSave('LIFE');
    const pending: readonly PendingDecision[] = [
      {
        eventId: 'romance.offer',
        category: 'friendship',
        age: 24,
        year: 2030,
        prompt: 'x',
        choices: [{ id: 'yes', label: 'Ask them out' }],
        names: {},
      },
    ];
    const lifeOffer = {
      kind: 'romance' as const,
      personId: 'p1',
      moveId: 'ask-out',
      age: 24,
      eventId: 'romance.offer',
    };

    // THROUGH `toSave`, which is where the original bug lived: the queue was
    // written and the payload behind it was not.
    const live: GameState = { ...fromSave(save), pending, lifeOffer };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-life') }));
    expect(reloaded.lifeOffer, 'the payload did not survive the save').toBeDefined();
    expect(reloaded.pending.map((d) => d.eventId)).toEqual(['romance.offer']);

    const withOffer = JSON.parse(JSON.stringify(save));
    withOffer.pending = pending;
    withOffer.lifeOffer = lifeOffer;
    const stuck = JSON.parse(JSON.stringify(withOffer));
    stuck.version = 29;
    delete stuck.lifeOffer;
    const repaired = migrateSave(stuck);
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.value.pending).toEqual([]);
  });

  it('round-trips an open sign-up, and unbricks one that lost its payload', () => {
    /*
      Ticket 0416, the fourth borrower, and the same two halves at birth — the
      rule 0410 wrote down so the next door would be one entry and not a find.
      Deliberately NOT added to SYSTEMIC above: a sign-up reaches a six-year-old,
      so the harness would find it first every time and stop exercising the
      career and college round-trips it was written for.
    */
    const { save } = newSave('SIGNUP');
    const pending: readonly PendingDecision[] = [
      {
        eventId: 'activity.offer',
        category: 'school',
        age: 12,
        year: 2030,
        prompt: 'x',
        choices: [{ id: 'yes', label: 'Sign up' }],
        names: {},
      },
    ];
    const pursuitOffer = { activityId: 'act.chess', age: 12, eventId: 'activity.offer' };

    const live: GameState = { ...fromSave(save), pending, pursuitOffer };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-signup') }));
    expect(reloaded.pursuitOffer, 'the payload did not survive the save').toEqual(pursuitOffer);
    expect(reloaded.pending.map((d) => d.eventId)).toEqual(['activity.offer']);

    const withOffer = JSON.parse(JSON.stringify(save));
    withOffer.pending = pending;
    withOffer.pursuitOffer = pursuitOffer;
    const stuck = JSON.parse(JSON.stringify(withOffer));
    stuck.version = 30;
    delete stuck.pursuitOffer;
    const repaired = migrateSave(stuck);
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(repaired.value.pending).toEqual([]);

    // And one that kept its payload is left alone.
    const kept = JSON.parse(JSON.stringify(withOffer));
    kept.version = 30;
    const untouched = migrateSave(kept);
    expect(untouched.ok).toBe(true);
    if (!untouched.ok) return;
    expect(untouched.value.pending.map((d) => d.eventId)).toEqual(['activity.offer']);
  });

  it('round-trips a home and an open home offer, and gives an older save no homes', () => {
    /*
      Ticket 0501, the fifth borrower of the door. A home is money — its value
      and what is owed on it both reach net worth — so it has to survive the
      save exactly, mortgage and all.
    */
    const { save } = newSave('HOMES');
    const homes = [
      {
        id: 'home:2040:0',
        kindId: 'home.condo',
        beds: 2,
        baths: 1,
        builtYear: 2001,
        condition: 'good' as const,
        regionKey: 'US:TX',
        regionName: 'Texas',
        purchasePrice: dollars(250_000),
        boughtYear: 2040,
        value: dollars(262_000),
        expenseRate: 0.026,
        behindYears: 0,
        mortgage: {
          productId: 'mortgage.conventional',
          principal: dollars(200_000),
          balance: dollars(190_000),
          termLeft: 28,
        },
      },
    ];
    const pending: readonly PendingDecision[] = [
      {
        eventId: 'home.offer',
        category: 'random',
        age: 32,
        year: 2041,
        prompt: 'x',
        choices: [{ id: 'yes', label: 'Buy it' }],
        names: {},
      },
    ];
    const homeOffer = { listingId: 'listing:2041:1', age: 32, eventId: 'home.offer' };
    const live: GameState = { ...fromSave(save), homes, pending, homeOffer };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-homes') }));
    expect(reloaded.homes).toEqual(homes);
    expect(reloaded.homeOffer).toEqual(homeOffer);
    expect(reloaded.pending.map((d) => d.eventId)).toEqual(['home.offer']);

    // A v31 save: nobody owned anything, and a home offer with no payload goes.
    const old = JSON.parse(JSON.stringify(save));
    old.version = 31;
    delete old.homes;
    old.pending = pending;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.homes).toEqual([]);
    expect(migrated.value.pending).toEqual([]);
  });

  it('round-trips a let building with its tenants, and carries a v32 save forward', () => {
    // Ticket 0503. A tenant is somebody in the save: losing one on a reload
    // would empty a unit the player filled.
    const { save } = newSave('LETTING');
    const homes = [
      {
        id: 'home:2040:r0',
        kindId: 'home.duplex',
        beds: 4,
        baths: 2,
        builtYear: 1970,
        condition: 'fair' as const,
        regionKey: 'US:OH',
        regionName: 'Ohio',
        purchasePrice: dollars(380_000),
        boughtYear: 2040,
        value: dollars(391_000),
        expenseRate: 0.024,
        behindYears: 0,
        letting: {
          level: 1.1,
          managed: true,
          tenants: [
            {
              id: 'tenant:home:2040:r0:0:2040:1',
              name: 'Ana Reyes',
              since: 2041,
              income: 61_500,
              credit: 'good' as const,
              work: 'steady' as const,
              household: 3,
              evictions: 0,
            },
            null,
          ],
        },
      },
    ];
    const live: GameState = { ...fromSave(save), homes };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-letting') }));
    expect(reloaded.homes).toEqual(homes);

    const old = JSON.parse(JSON.stringify(save));
    old.version = 32;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.homes).toEqual(save.homes);
  });

  it('round-trips a financed car, an open car offer and an inspection, and gives a v33 save no cars', () => {
    // Ticket 0504. A car is in the save with its hidden history and its loan;
    // the offer's payload travels with the question (the 0402 lesson); and a
    // paid-for inspection must not be lost on a reload.
    const { save } = newSave('VEHICLES');
    const vehicles = [
      {
        id: 'car:2040:lot.used-1:3',
        trimId: 'car.hondo-civix.si',
        modelYear: 2036,
        boughtYear: 2040,
        purchasePrice: dollars(21_400),
        value: dollars(19_650),
        condition: 81.5,
        history: 'patchy' as const,
        accident: true,
        defect: { part: 'turbo', cost: 2_450, known: true },
        loan: {
          productId: 'auto.used',
          principal: dollars(17_100),
          balance: dollars(17_100),
          termLeft: 5,
        },
        behindYears: 0,
      },
    ];
    const pending: PendingDecision[] = [
      {
        eventId: 'vehicle.offer',
        category: 'random',
        age: 30,
        year: 2040,
        prompt: 'A car came up.',
        choices: [
          { id: 'yes', label: 'Buy it' },
          { id: 'skip', label: 'Not this year' },
        ],
        names: {},
      },
    ];
    const live: GameState = {
      ...fromSave(save),
      vehicles,
      vehicleOffer: {
        listingId: 'car:2040:lot.new-1:0',
        how: 'loan',
        age: 30,
        eventId: 'vehicle.offer',
      },
      inspected: ['car:2040:lot.online:4'],
      pending,
    };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-vehicles') }));
    expect(reloaded.vehicles).toEqual(vehicles);
    expect(reloaded.vehicleOffer).toEqual(live.vehicleOffer);
    expect(reloaded.inspected).toEqual(['car:2040:lot.online:4']);

    // A v33 save could own no car, and cannot hold a car question.
    const old = JSON.parse(JSON.stringify(toSave(live, { id: asSaveId('s-vehicles') })));
    old.version = 33;
    delete old.vehicles;
    delete old.vehicleOffer;
    delete old.inspected;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.vehicles).toEqual([]);
    expect(migrated.value.pending.some((decision) => decision.eventId === 'vehicle.offer')).toBe(
      false,
    );
  });

  it('round-trips a car with its modifications, and carries a v34 save forward', () => {
    // Ticket 0505. A Tarbus conversion is most of a car's value; losing it on a
    // reload would hand the player a stock car worth $70,000 less.
    const { save } = newSave('MODS');
    const vehicles = [
      {
        id: 'car:2041:lot.luxury-1:1',
        trimId: 'car.merceda-gelander.g-63-amr',
        modelYear: 2041,
        boughtYear: 2041,
        purchasePrice: dollars(185_000),
        value: dollars(225_400),
        condition: 98.6,
        history: 'full' as const,
        accident: false,
        behindYears: 0,
        mods: [
          { modId: 'mod.tint.windows', cost: 600, year: 2041 },
          { modId: 'mod.tarbus', cost: 74_000, year: 2042 },
        ],
      },
    ];
    const live: GameState = { ...fromSave(save), vehicles };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-mods') }));
    expect(reloaded.vehicles).toEqual(vehicles);

    const old = JSON.parse(JSON.stringify(toSave(live, { id: asSaveId('s-mods') })));
    old.version = 34;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.vehicles).toEqual(vehicles);
  });

  it('round-trips a collection, a renovated home and an open renovation question, and gives a v35 save none', () => {
    // Ticket 0506. An heirloom is somebody in the save too: losing whose it
    // was on a reload would lose the only story it has.
    const { save } = newSave('VALUABLES');
    const valuables = [
      {
        id: 'val:2044:store.watches:2',
        itemId: 'val.watch.rolux-subaquatic',
        boughtYear: 2044,
        purchasePrice: dollars(10_250),
        value: dollars(12_100),
        inheritedFrom: 'Ruth Calder',
      },
    ];
    const homes = [
      {
        id: 'home:2040:0',
        kindId: 'home.starter',
        beds: 4,
        baths: 2,
        builtYear: 1978,
        condition: 'fair' as const,
        regionKey: 'US:OH',
        regionName: 'Ohio',
        purchasePrice: dollars(240_000),
        boughtYear: 2040,
        value: dollars(301_000),
        expenseRate: 0.022,
        behindYears: 0,
        renovations: [
          { renovationId: 'reno.bath-modern', cost: 18_000, year: 2044 },
          { renovationId: 'reno.bedroom-1', cost: 90_000, year: 2045 },
        ],
      },
    ];
    const pending: PendingDecision[] = [
      {
        eventId: 'home.renovate',
        category: 'random',
        age: 50,
        year: 2046,
        prompt: 'The house needs work.',
        choices: [
          { id: 'yes', label: 'Get it done' },
          { id: 'skip', label: 'Live with it' },
        ],
        names: {},
      },
    ];
    const live: GameState = {
      ...fromSave(save),
      valuables,
      homes,
      renovationOffer: {
        homeId: 'home:2040:0',
        renovationId: 'reno.kitchen-modern',
        cost: 30_000,
        age: 50,
        eventId: 'home.renovate',
      },
      pending,
    };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-valuables') }));
    expect(reloaded.valuables).toEqual(valuables);
    expect(reloaded.homes).toEqual(homes);
    expect(reloaded.renovationOffer).toEqual(live.renovationOffer);

    const old = JSON.parse(JSON.stringify(toSave(live, { id: asSaveId('s-valuables') })));
    old.version = 35;
    delete old.valuables;
    delete old.renovationOffer;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.valuables).toEqual([]);
    expect(migrated.value.pending.some((decision) => decision.eventId === 'home.renovate')).toBe(
      false,
    );
  });

  it('round-trips the auction diary and a fake not yet found out, and carries a v36 save forward', () => {
    // Ticket 0507. Losing the diary on a reload would hand back a used sale;
    // losing `fake` would turn a reproduction into the real thing.
    const { save } = newSave('AUCTIONS');
    const live: GameState = {
      ...fromSave(save),
      auctions: {
        year: 2044,
        visits: { 'auction.hartwell': 2, 'auction.storage': 1 },
        bids: ['lot:2044:auction.hartwell:2:3'],
      },
      valuables: [
        {
          id: 'lot:2044:auction.hartwell:2:3',
          itemId: 'val.antique.qing-vase',
          boughtYear: 2044,
          purchasePrice: dollars(52_000),
          value: dollars(36_000),
          fake: true,
        },
      ],
    };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-auctions') }));
    expect(reloaded.auctions).toEqual(live.auctions);
    expect(reloaded.valuables).toEqual(live.valuables);

    const old = JSON.parse(JSON.stringify(toSave(live, { id: asSaveId('s-auctions') })));
    old.version = 36;
    delete old.auctions;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.auctions).toBeUndefined();
  });

  it('round-trips a business with its history, and carries a v37 save forward with none', () => {
    // Ticket 0601. Losing the till on a reload would hand the owner a free
    // draw; losing the profit history would value a seasoned business at its
    // fittings.
    const { save } = newSave('BUSINESSES');
    const live: GameState = {
      ...fromSave(save),
      businesses: [
        {
          id: 'biz:2044:biz.cafe:0',
          typeId: 'biz.cafe',
          name: 'Corner Cup',
          openedYear: 2044,
          invested: dollars(81_000),
          cash: dollars(33_500),
          price: 110,
          supplier: 'premium',
          payroll: 'high',
          staff: 7,
          autoStaff: false,
          reputation: 64,
          luck: 1.12,
          profits: [41_000, 52_500],
          branches: [2046],
          last: {
            year: 2046,
            revenue: 520_000,
            costs: 467_500,
            profit: 52_500,
            drawn: 20_000,
            injected: 0,
            turnedAway: 0.07,
            idle: 0,
          },
        },
      ],
    };
    const reloaded = fromSave(toSave(live, { id: asSaveId('s-businesses') }));
    expect(reloaded.businesses).toEqual(live.businesses);

    const old = JSON.parse(JSON.stringify(toSave(live, { id: asSaveId('s-businesses') })));
    old.version = 37;
    delete old.businesses;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.businesses).toEqual([]);
  });

  it('gives a v38 business one door, and keeps the locations a v39 save already has', () => {
    // Ticket 0602. Losing `branches` on a reload would close every extra door
    // and leave the owner paying for staff nobody could use.
    const { save } = newSave('LOCATIONS');
    const live: GameState = {
      ...fromSave(save),
      businesses: [
        {
          id: 'biz:2044:biz.cleaning:0',
          typeId: 'biz.cleaning',
          name: 'Spotless & Sons',
          openedYear: 2044,
          invested: dollars(32_000),
          cash: dollars(9_000),
          price: 100,
          supplier: 'standard',
          payroll: 'medium',
          staff: 8,
          autoStaff: true,
          reputation: 50,
          luck: 1,
          profits: [30_000],
          branches: [2047, 2050],
        },
      ],
    };
    const written = toSave(live, { id: asSaveId('s-locations') });
    expect(fromSave(written).businesses[0]!.branches).toEqual([2047, 2050]);

    const old = JSON.parse(JSON.stringify(written));
    old.version = 38;
    for (const business of old.businesses) delete business.branches;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.businesses[0]!.branches).toEqual([]);
  });

  it('gives a v39 save no deals, and keeps the deals a v40 save holds', () => {
    // Ticket 0605. Losing `deals` on a reload would hand the cheque back for nothing; losing
    // `multiple` would reroll an outcome that was fixed the day the money went in.
    const { save } = newSave('DEALS');
    const live: GameState = {
      ...fromSave(save),
      deals: [
        {
          id: 'deal:2044:startup:0',
          kindId: 'startup',
          name: 'Brightwater Labs',
          put: dollars(10_000),
          since: 2044,
          matures: 2049,
          multiple: 3.5,
          paid: dollars(0),
          status: 'live',
        },
      ],
    };
    const written = toSave(live, { id: asSaveId('s-deals') });
    expect(written.version).toBe(CURRENT_SAVE_VERSION);
    expect(fromSave(written).deals).toEqual(live.deals);

    const old = JSON.parse(JSON.stringify(written));
    old.version = 39;
    delete old.deals;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.deals).toEqual([]);
  });

  it('gives a v40 save no channels and no fame, and keeps what a v41 save holds', () => {
    // Ticket 0701. Losing `luck` on a reload would reroll a channel's whole future; losing
    // `fame` would make a star anonymous the moment they closed the app.
    const { save } = newSave('CHANNELS');
    const live: GameState = {
      ...fromSave(save),
      fame: 37,
      channels: [
        {
          id: 'ch:2044:video:gaming',
          platformId: 'video',
          categoryId: 'gaming',
          name: 'Pixel Drift',
          since: 2044,
          audience: 12_345,
          peak: 20_000,
          effort: 'heavy',
          luck: 0.9731,
          earned: dollars(4_321),
        },
      ],
    };
    const written = toSave(live, { id: asSaveId('s-channels') });
    expect(written.version).toBe(CURRENT_SAVE_VERSION);
    expect(fromSave(written).channels).toEqual(live.channels);
    expect(fromSave(written).fame).toBe(37);

    const old = JSON.parse(JSON.stringify(written));
    old.version = 40;
    delete old.channels;
    delete old.fame;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.value.channels).toEqual([]);
    expect(migrated.value.fame).toBe(0);
  });

  it('keeps what a channel earned and answered, and who pays, through a save (0702, 0703)', () => {
    // Losing `paid` on a reload would send a newsletter's payers back to nothing; losing `owed`
    // would lose money already agreed; losing `viralYear` would call the fall after a hit a slump.
    const { save } = newSave('CHANNELS2');
    const live: GameState = {
      ...fromSave(save),
      channels: [
        {
          id: 'ch:2044:subscription:business',
          platformId: 'subscription',
          categoryId: 'business',
          name: 'Ledger Notes',
          since: 2044,
          audience: 54_321,
          peak: 60_000,
          effort: 'regular',
          luck: 0.91,
          earned: dollars(12_000),
          bestRank: 840,
          owed: dollars(1_600),
          answered: ['sp:2046:ch:2044:subscription:business:0'],
          paid: 1_876,
          tier: 'premium',
          viralYear: 2045,
        },
      ],
    };
    const written = toSave(live, { id: asSaveId('s-channels2') });
    const back = fromSave(JSON.parse(JSON.stringify(written)));
    expect(back.channels).toEqual(live.channels);
    expect(migrateSave(JSON.parse(JSON.stringify(written))).ok).toBe(true);
  });

  it('keeps channels and fame a v40 save somehow already carries, rather than wiping them', () => {
    const { save } = newSave('CHANNELS-KEEP');
    const old = JSON.parse(JSON.stringify(save));
    old.version = 40;
    old.channels = [{ id: 'ch:2044:video:gaming' }];
    old.fame = 12;
    const migrated = migrateSave(old);
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.channels).toEqual([{ id: 'ch:2044:video:gaming' }]);
    expect(migrated.value.fame).toBe(12);
  });

  it('refuses a current save whose channels are not a list or whose fame is not a number', () => {
    const { save } = newSave('CHANNELS-BAD');
    const badChannels = migrateSave({ ...JSON.parse(JSON.stringify(save)), channels: 'none' });
    expect(badChannels.ok).toBe(false);
    const badFame = migrateSave({ ...JSON.parse(JSON.stringify(save)), fame: 'famous' });
    expect(badFame.ok).toBe(false);
    expect(migrateSave(JSON.parse(JSON.stringify(save))).ok).toBe(true);
  });

  it('keeps a group and who a channel has worked with through a save (0704)', () => {
    // Losing `group` on a reload would hand back a share of income and the reach with it for free;
    // losing `collabs` would let the same guest work as well the fifth time as the first.
    const { save } = newSave('NETWORK');
    const live: GameState = {
      ...fromSave(save),
      channels: [
        {
          id: 'ch:2044:video:gaming',
          platformId: 'video',
          categoryId: 'gaming',
          name: 'Late Night Lobby',
          since: 2044,
          audience: 41_000,
          peak: 44_000,
          effort: 'regular',
          luck: 0.8,
          earned: dollars(30_000),
          group: {
            id: 'gp:2046:ch:2044:video:gaming',
            kind: 'group',
            name: 'The Loft',
            cut: 0.2,
            since: 2046,
          },
          collabs: { 'p:ch:2044:video:gaming:3': 2, 'f:friend-7': 1 },
          answered: ['gp:2046:ch:2044:video:gaming', 'co:2046:ch:2044:video:gaming:0'],
        },
      ],
    };
    const written = toSave(live, { id: asSaveId('s-network') });
    const back = fromSave(JSON.parse(JSON.stringify(written)));
    expect(back.channels).toEqual(live.channels);
    expect(migrateSave(JSON.parse(JSON.stringify(written))).ok).toBe(true);
  });

  it('keeps a manager or an agent through a save, and writes nothing for nobody (0704)', () => {
    const { save } = newSave('REP');
    const base = fromSave(save);
    for (const kind of ['manager', 'agent'] as const) {
      const written = toSave({ ...base, representation: kind }, { id: asSaveId(`s-${kind}`) });
      expect(written.representation).toBe(kind);
      expect(fromSave(JSON.parse(JSON.stringify(written))).representation).toBe(kind);
      expect(migrateSave(JSON.parse(JSON.stringify(written))).ok).toBe(true);
    }
    const none = toSave(base, { id: asSaveId('s-none') });
    expect('representation' in none).toBe(false);
    expect('representation' in fromSave(JSON.parse(JSON.stringify(none)))).toBe(false);
  });

  it('refuses a save whose representation is neither one of the two nor missing (0704)', () => {
    const { save } = newSave('REP-BAD');
    const raw = JSON.parse(JSON.stringify(save));
    for (const bad of ['both', 'editor', 7, null, true, ['manager']]) {
      const result = migrateSave({ ...raw, representation: bad });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(JSON.stringify(result.error)).toContain('representation');
    }
    expect(migrateSave({ ...raw, representation: 'manager' }).ok).toBe(true);
    expect(migrateSave({ ...raw, representation: 'agent' }).ok).toBe(true);
    expect(migrateSave(raw).ok).toBe(true);
  });

  it('keeps who you have met and who you know through a save (0705)', () => {
    const { save } = newSave('CELEB');
    const base = fromSave(save);
    const tie = {
      id: 'acting:1990:1',
      name: 'Test Person',
      sex: 'female' as const,
      field: 'acting' as const,
      birthYear: 1990,
      metYear: 2004,
      metAtAge: 14,
      warmth: 47,
      lastContactYear: 2005,
      doneYear: 2005,
      done: ['catchUp'],
      promoted: true as const,
      endedYear: 2009,
      endedBecause: 'died' as const,
    };
    const live: GameState = {
      ...base,
      celebrities: {
        ties: [tie],
        met: ['acting:1990:1', 'music:1975:0'],
        answeredYear: 2005,
        work: {
          year: 2005,
          done: [{ id: 'photoshoot', outlet: 'Juniper Row magazine', pay: 340, fame: 1, mood: 1 }],
        },
      },
    };
    const written = toSave(live, { id: asSaveId('s-celeb') });
    expect(written.celebrities).toEqual(live.celebrities);
    const back = fromSave(JSON.parse(JSON.stringify(written)));
    expect(back.celebrities).toEqual(live.celebrities);
    expect(migrateSave(JSON.parse(JSON.stringify(written))).ok).toBe(true);
  });

  it('opens an older save with nobody met, and says what it was upgraded to (0705)', () => {
    const { save } = newSave('CELEB-OLD');
    const old = JSON.parse(JSON.stringify(save));
    delete old.celebrities;
    old.version = 41;
    const result = migrateSave(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.value.celebrities).toEqual({
      ties: [],
      met: [],
      answeredYear: 0,
      work: { year: 0, done: [] },
    });
    expect(CURRENT_SAVE_VERSION).toBeGreaterThanOrEqual(43);
  });

  it('refuses a save whose celebrities are malformed (0705)', () => {
    const { save } = newSave('CELEB-BAD');
    const raw = JSON.parse(JSON.stringify(save));
    const tie = {
      id: 'acting:1990:1',
      name: 'Test Person',
      sex: 'female',
      field: 'acting',
      birthYear: 1990,
      metYear: 2004,
      metAtAge: 14,
      warmth: 47,
      lastContactYear: 2005,
      doneYear: 2005,
      done: [],
    };
    const JOB = { id: 'photoshoot', outlet: 'Juniper Row magazine', pay: 340, fame: 1, mood: 1 };
    const good = { ties: [tie], met: [], answeredYear: 0, work: { year: 0, done: [] } };
    expect(migrateSave({ ...raw, celebrities: good }).ok).toBe(true);
    const bad: unknown[] = [
      undefined,
      null,
      7,
      [],
      { ...good, ties: 'none' },
      { ...good, met: 'none' },
      { ...good, met: [3] },
      { ...good, answeredYear: 'never' },
      { ...good, answeredYear: 1.5 },
      { ...good, ties: [{ ...tie, warmth: 'warm' }] },
      { ...good, ties: [{ ...tie, name: 4 }] },
      { ...good, ties: [{ ...tie, done: 'catchUp' }] },
      { ...good, ties: [{ ...tie, endedBecause: 'bored', endedYear: 2009 }] },
      { ...good, ties: [null] },
      { ...good, ties: [{ ...tie, sex: 'robot' }] },
      { ...good, ties: [{ ...tie, done: [1] }] },
      { ...good, ties: [{ ...tie, promoted: 'yes' }] },
      { ...good, ties: [{ ...tie, birthYear: 1990.5 }] },
      // Ticket 0707: what was said yes to this year.
      { ties: good.ties, met: good.met, answeredYear: 0 },
      { ...good, work: null },
      { ...good, work: [] },
      { ...good, work: { year: 'now', done: [] } },
      { ...good, work: { year: 2005.5, done: [] } },
      { ...good, work: { year: 2005, done: 'photoshoot' } },
      { ...good, work: { year: 2005, done: [null] } },
      { ...good, work: { year: 2005, done: [{ ...JOB, id: 4 }] } },
      { ...good, work: { year: 2005, done: [{ ...JOB, outlet: 4 }] } },
      { ...good, work: { year: 2005, done: [{ ...JOB, pay: -1 }] } },
      { ...good, work: { year: 2005, done: [{ ...JOB, pay: 340.5 }] } },
      { ...good, work: { year: 2005, done: [{ ...JOB, fame: 1.5 }] } },
      { ...good, work: { year: 2005, done: [{ ...JOB, mood: 'happy' }] } },
    ];
    for (const celebrities of bad) {
      const result = migrateSave({ ...raw, celebrities });
      expect(result.ok, JSON.stringify(celebrities)).toBe(false);
    }
  });

  it('opens a v42 save with nothing said yes to, and keeps who it had met (0707)', () => {
    const { save } = newSave('WORK-OLD');
    const old = JSON.parse(JSON.stringify(save));
    old.celebrities = { ties: [], met: ['acting:1990:1'], answeredYear: 2003 };
    old.version = 42;
    const result = migrateSave(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe(CURRENT_SAVE_VERSION);
    expect(result.value.celebrities).toEqual({
      ties: [],
      met: ['acting:1990:1'],
      answeredYear: 2003,
      work: { year: 0, done: [] },
    });
    expect(CURRENT_SAVE_VERSION).toBe(45);
  });

  it('keeps what a v42 save already says yes to rather than writing over it (0707)', () => {
    const { save } = newSave('WORK-KEEP');
    const old = JSON.parse(JSON.stringify(save));
    const work = {
      year: 2011,
      done: [{ id: 'talkShow', outlet: 'Couch Night', pay: 900, fame: 2, mood: 1 }],
    };
    old.celebrities = { ties: [], met: [], answeredYear: 0, work };
    old.version = 42;
    const result = migrateSave(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.celebrities.work).toEqual(work);
  });

  it('keeps a commercial lease: the trade, the term and the rent it was signed at', () => {
    // Ticket 0606. No version bump: `trade`, `leaseEnds` and `rent` are optional on a tenant. Losing
    // `rent` on a reload would reprice a lease at today's rate; losing `leaseEnds` would end it.
    const { save } = newSave('LEASE');
    const base = fromSave(save);
    const shop: GameState = {
      ...base,
      homes: [
        {
          id: 'home:2010:c0',
          kindId: 'home.retail-strip',
          beds: 0,
          baths: 0,
          builtYear: 1995,
          condition: 'good',
          regionKey: 'OH',
          regionName: 'Ohio',
          purchasePrice: dollars(900_000),
          boughtYear: 2010,
          value: dollars(900_000),
          expenseRate: 0.013,
          behindYears: 0,
          mortgage: {
            productId: 'mortgage.commercial',
            principal: dollars(630_000),
            balance: dollars(630_000),
            termLeft: 25,
          },
          letting: {
            level: 1,
            managed: true,
            tenants: [
              {
                id: 'tenant:home:2010:c0:0:2009:1',
                name: 'Main Street Cuts',
                since: 2010,
                income: 410_000,
                credit: 'good',
                work: 'steady',
                household: 4,
                evictions: 0,
                trade: 'biz.salon',
                rent: 31_200,
                leaseEnds: 2016,
              },
              null,
            ],
          },
        },
      ],
    };
    const written = toSave(shop, { id: asSaveId('s-lease') });
    const reloaded = fromSave(JSON.parse(JSON.stringify(written)));
    expect(reloaded.homes).toEqual(shop.homes);
    expect(reloaded.homes[0]!.letting!.tenants[0]).toMatchObject({
      trade: 'biz.salon',
      rent: 31_200,
      leaseEnds: 2016,
    });
  });

  it('keeps which business a loan was borrowed for, and what the business paid last year', () => {
    // Ticket 0603. A business loan with no `businessId` would be serviced twice, by the
    // business and then by the household; one with no `repaid` would lose the dashboard line.
    // No version bump: both are optional, and a v39 save without them is already right.
    const { save } = newSave('BUSINESS-LOAN');
    const live: GameState = {
      ...fromSave(save),
      loans: [
        {
          productId: 'loan.smallbiz',
          principal: dollars(113_200),
          balance: dollars(98_300),
          termLeft: 9,
          inArrears: false,
          businessId: 'biz:2044:biz.salon:for0',
        },
      ],
      businesses: [
        {
          id: 'biz:2044:biz.salon:for0',
          typeId: 'biz.salon',
          name: 'Cut Above',
          openedYear: 2031,
          invested: dollars(141_564),
          cash: dollars(21_000),
          price: 100,
          supplier: 'standard',
          payroll: 'medium',
          staff: 6,
          autoStaff: true,
          reputation: 55,
          luck: 1.1,
          profits: [31_000, 33_000, 35_000],
          branches: [],
          last: {
            year: 2044,
            revenue: 260_000,
            costs: 225_000,
            profit: 35_000,
            drawn: 14_000,
            injected: 0,
            turnedAway: 0,
            idle: 0.1,
            repaid: 17_500,
          },
        },
      ],
    };
    const written = toSave(live, { id: asSaveId('s-biz-loan') });
    const back = fromSave(JSON.parse(JSON.stringify(written)));
    expect(back.loans[0]!.businessId).toBe('biz:2044:biz.salon:for0');
    expect(back.loans[0]!.productId).toBe('loan.smallbiz');
    expect(Number(back.loans[0]!.balance)).toBe(9_830_000);
    expect(back.businesses[0]!.last?.repaid).toBe(17_500);
    expect(written.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('keeps a rival and what happened last year, which are the dashboard’s reasons for a swing', () => {
    // Ticket 0604. A rival lost on a reload would be a competitor who vanished the moment the
    // app closed; an event lost would leave a bad year with no cause on the screen. Optional on
    // the business and on its ledger year, so a v39 save without them is already right: no bump.
    const { save } = newSave('BUSINESS-RIVAL');
    const live: GameState = {
      ...fromSave(save),
      businesses: [
        {
          id: 'biz:2031:biz.cafe:0',
          typeId: 'biz.cafe',
          name: 'The Corner Cup',
          openedYear: 2031,
          invested: dollars(150_000),
          cash: dollars(21_000),
          price: 100,
          supplier: 'standard',
          payroll: 'medium',
          staff: 6,
          autoStaff: true,
          reputation: 55,
          luck: 1.1,
          profits: [31_000, 33_000, 35_000],
          branches: [],
          rival: { since: 2043, bite: 0.11 },
          last: {
            year: 2044,
            revenue: 480_000,
            costs: 445_000,
            profit: 35_000,
            drawn: 14_000,
            injected: 0,
            turnedAway: 0,
            idle: 0.1,
            event: 'slow-stretch',
            economy: 0.95,
            rivalTook: 0.0825,
          },
        },
      ],
    };
    const written = toSave(live, { id: asSaveId('s-biz-rival') });
    const back = fromSave(JSON.parse(JSON.stringify(written)));
    expect(back.businesses[0]!.rival).toEqual({ since: 2043, bite: 0.11 });
    expect(back.businesses[0]!.last?.event).toBe('slow-stretch');
    expect(back.businesses[0]!.last?.economy).toBe(0.95);
    expect(back.businesses[0]!.last?.rivalTook).toBe(0.0825);
    expect(written.version).toBe(CURRENT_SAVE_VERSION);
    // And a business with no rival comes back with no `rival` key at all, not an undefined one.
    const quiet = toSave(
      { ...live, businesses: [{ ...live.businesses[0]!, rival: undefined }] },
      { id: asSaveId('s-biz-quiet') },
    );
    const quietBack = fromSave(JSON.parse(JSON.stringify(quiet)));
    expect('rival' in quietBack.businesses[0]!).toBe(false);
  });
});
