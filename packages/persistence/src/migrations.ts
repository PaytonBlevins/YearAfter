/**
 * Ticket 0005 — save migrations.
 *
 * Spec 1108–1140 requires explicit versions, tested migrations, and old saves
 * that keep loading. Each migration takes the previous shape to the next one and
 * must be pure — no RNG, no clock, no I/O — so a migration replays identically.
 *
 * There is only one version today. The machinery exists now because retrofitting
 * migrations onto shipped saves is the expensive version of this problem.
 */

import { err, ok, type Result } from '@yearafter/core';
import { GRADES_TO_GRADUATE, SCHOOL_START_AGE } from '@yearafter/education';
import { CURRENT_SAVE_VERSION, type CurrentSaveGame } from './save-schema';

export type MigrationError =
  | { readonly kind: 'notAnObject' }
  | { readonly kind: 'missingVersion' }
  | { readonly kind: 'unknownVersion'; readonly version: number }
  | { readonly kind: 'fromTheFuture'; readonly version: number; readonly supported: number }
  | { readonly kind: 'corrupt'; readonly detail: string };

type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * Keyed by the version being migrated FROM.
 * migrations[1] takes a v1 save to v2.
 */
const migrations: Readonly<Record<number, Migration>> = {
  /**
   * v1 -> v2: Ticket 0201 added hidden personality traits to the character.
   *
   * Note the birthplace is deliberately NOT touched. Saves made before the
   * location catalog existed hold `us-ca-riverside`, which is why that city is
   * in the catalog — rescuing an existing character's birthplace by adding a
   * real city beats silently rewriting where they were born.
   *
   * Existing characters get neutral values rather than fresh rolls. Rolling
   * would be worse in two ways: it would consume RNG outside a stream (making
   * the save no longer replay from its seed), and it would silently change the
   * disposition of a character the player already knows.
   */
  1: (save) => {
    const player = { ...(save['player'] as Record<string, unknown>) };
    if (typeof player['personality'] !== 'object' || player['personality'] === null) {
      player['personality'] = {
        ambition: 50,
        riskTolerance: 50,
        temper: 50,
        generosity: 50,
        loyalty: 50,
        extraversion: 50,
      };
    }
    return { ...save, version: 2, player };
  },

  /**
   * v2 -> v3: Ticket 0202 added the starting family.
   *
   * An existing character keeps an EMPTY household rather than getting one
   * generated. Generating here would invent parents and siblings the player has
   * already lived years without, and would have to consume RNG to do it, which
   * breaks the save's ability to replay from its seed. An empty family is
   * honest: this character was created before families existed.
   */
  2: (save) => ({
    ...save,
    version: 3,
    family: save['family'] ?? { members: [], finances: { band: 'modest', annualIncome: 0 } },
  }),

  /**
   * v3 -> v4: Ticket 0203 added the event engine's memory.
   *
   * An existing character starts with an EMPTY history, which means every event
   * in the catalog is off cooldown for them. That is the deliberate choice: the
   * alternative is inventing a history of events that never happened so the
   * engine can pretend to have suppressed them. A character who has already
   * lived twenty years simply becomes eligible for everything at their current
   * age, and their remaining years read normally.
   *
   * `nameCultureId` defaults to the catalog's largest tradition rather than
   * being derived from the birth city: a city lists several traditions and the
   * one actually drawn was never recorded before v4. Guessing per-city would be
   * no more correct and would make the migration depend on content, which then
   * changes what an old save loads as every time the catalog is edited.
   * Like every migration here, this consumes no RNG and reads no clock.
   */
  3: (save) => ({
    ...save,
    version: 4,
    nameCultureId: save['nameCultureId'] ?? 'us-en',
    events: save['events'] ?? { lastFired: {}, scheduled: [], flags: [] },
    pending: save['pending'] ?? [],
  }),

  /**
   * v4 -> v5: Ticket 0204 added schooling.
   *
   * An existing character is enrolled at the grade their AGE implies rather
   * than starting at kindergarten — a fourteen-year-old who has been playing
   * for a while is a freshman, not a five-year-old — but they get a neutral
   * academic record, because inventing twelve years of grades they never lived
   * would be worse than admitting the system did not exist yet.
   *
   * Pure, like every migration here: no RNG, no clock. Grade comes from the
   * character's own age, which is already in the save.
   */
  4: (save) => {
    const player = save['player'] as Record<string, unknown> | undefined;
    const age = typeof player?.['age'] === 'number' ? (player['age'] as number) : 0;
    const grade = age - SCHOOL_START_AGE;
    const stage =
      grade < 0
        ? 'preschool'
        : grade <= 5
          ? 'elementary'
          : grade <= 8
            ? 'middle'
            : grade <= GRADES_TO_GRADUATE
              ? 'high'
              : 'graduated';
    return {
      ...save,
      version: 5,
      education: save['education'] ?? {
        stage,
        gradeLevel: Math.max(-1, Math.min(GRADES_TO_GRADUATE, grade)),
        schoolType: 'public',
        performance: 50,
        effort: 'normal',
        behaviour: 70,
        activities: [],
      },
    };
  },

  /**
   * v5 -> v6: Ticket 0203b bound a decision's people once, at the moment it is
   * raised, so the prompt and the outcome name the same person.
   *
   * A decision written by v5 has no bindings. It gets an EMPTY map, which the
   * renderer treats as "resolve per render" — exactly the old behaviour. It must
   * NOT draw names here: migrations are pure by contract (no RNG, no clock) or
   * the save stops replaying from its seed. One already-open question keeping
   * the old behaviour is a far smaller price than that.
   */
  5: (save) => ({
    ...save,
    version: 6,
    pending: (Array.isArray(save['pending']) ? save['pending'] : []).map((decision) => {
      const entry = decision as Record<string, unknown>;
      return entry['names'] ? entry : { ...entry, names: {} };
    }),
  }),

  /**
   * v6 -> v7: Ticket 0204b made competitive activities something you try out
   * for rather than something you click on.
   *
   * An existing character starts with no tryout history, which means their next
   * attempt at anything is a first attempt. That is the honest reading: they
   * have never tried out for anything, because trying out did not exist.
   *
   * Anything they were already IN stays joined. Retroactively cutting a
   * character from a team they have been on for three years would be a worse
   * lie than letting them keep a place they got before there was a queue.
   */
  6: (save) => {
    const education = { ...((save['education'] as Record<string, unknown>) ?? {}) };
    education['tryouts'] = education['tryouts'] ?? {};
    education['tryoutYear'] = education['tryoutYear'] ?? {};
    return { ...save, version: 7, education };
  },

  /**
   * v7 -> v8: Ticket 0205 turned Study Harder from a setting into a button you
   * press once a school year.
   *
   * `studiedAtAge` is deliberately left ABSENT rather than set to the
   * character's current age. Absent means "has not studied this year", so an
   * existing character can press the button immediately instead of being told
   * to come back next year for something they never did.
   *
   * `effort` is untouched. A character the player had already set to Studying
   * Hard stays that way — the setting is gone from the UI, not from the model,
   * and silently resetting them to Keeping Up would change a decision the
   * player had made and could no longer remake.
   */
  7: (save) => ({ ...save, version: 8 }),

  /**
   * v8 -> v9: Ticket 0206 gave a childhood a cast — classmates, friends and
   * teachers who persist instead of being invented per line.
   *
   * An existing character starts with an EMPTY circle and fills it at their
   * next school year, which reads correctly: they arrive in a class they have
   * been in for years and the game finally starts naming the people in it.
   * Inventing a history of friendships they never had would be worse, and would
   * have to consume RNG to do it, which breaks replay from the seed.
   *
   * Open decisions LOSE their bound people. v9 changed a binding from a bare
   * name to a person — name, sex, and the id of somebody real — and the sex
   * cannot be recovered from a string without reading the name catalog, which
   * would make an old save load differently every time that catalog is edited.
   * An empty map is the shape the renderer already treats as "resolve per
   * render", so the one open question re-draws its people. Migration 5 made the
   * same trade for the same reason.
   */
  8: (save) => ({
    ...save,
    version: 9,
    circle: save['circle'] ?? { people: [], contact: {} },
    pending: (Array.isArray(save['pending']) ? save['pending'] : []).map((decision) => ({
      ...(decision as Record<string, unknown>),
      names: {},
    })),
  }),

  /**
   * v9 -> v10: Ticket 0206b removed the one-interaction-per-person-per-year cap
   * and gave every joined activity a record of how it is going.
   *
   * `contact` starts EMPTY, which hands an existing character their year back
   * rather than taking it away — the shape it replaces stored only "spoken to
   * at this age", and there is no way to know from that whether the one thing
   * they did was a light thing or a heavy one. Giving somebody an extra
   * afternoon with a friend is the kinder direction to be wrong in.
   *
   * Joined activities get a NEUTRAL record and a joined-year season count of
   * zero: a character three years into the basketball team has a history the
   * save never recorded, and inventing three seasons of results they never
   * played is the same lie migration 4 refused about grades.
   */
  9: (save) => {
    const circle = { ...((save['circle'] as Record<string, unknown>) ?? {}) };
    circle['contact'] = {};
    delete circle['spokenToAtAge'];

    const education = { ...((save['education'] as Record<string, unknown>) ?? {}) };
    const activities = Array.isArray(education['activities']) ? education['activities'] : [];
    education['activities'] = activities.map((entry) => {
      const activity = entry as Record<string, unknown>;
      return {
        ...activity,
        standing: activity['standing'] ?? 50,
        seasons: activity['seasons'] ?? 0,
        practisedAtAge: activity['practisedAtAge'] ?? -1,
        practiceCount: activity['practiceCount'] ?? 0,
      };
    });

    // Study Harder became two terms a year. A character who already used their
    // one press this year keeps that as one of the two, so they get a second —
    // giving somebody another term of effort is the kinder direction to be
    // wrong in, and the field was absent before this version anyway.
    education['studiedCount'] =
      education['studiedCount'] ?? (education['studiedAtAge'] === undefined ? 0 : 1);

    // Odd jobs start EMPTY. A sixteen-year-old who has been playing for a while
    // has not been working a paper round the game never simulated, and giving
    // them a year of back pay would be inventing money.
    education['gigs'] = education['gigs'] ?? [];

    return { ...save, version: 10, circle, education };
  },

  /**
   * v10 → v11 (Ticket 0207c) — repair duplicate timeline ids already on disk.
   *
   * A user-reported React warning, twice: "Encountered two children with the
   * same key, `t:2012:study`". 0206b fixed the PRODUCER — every repeatable
   * action now puts its repeat counter in the id, and a test plays a whole life
   * pressing everything and asserts the ids are unique. That fix was correct
   * and it was not enough, because no code in the build can emit a bare
   * `t:2012:study` any more: the duplicates were written by the pre-fix build
   * and are sitting in saves, and nothing was ever going to take them out.
   *
   * CORE_RULES 13.12 says a timeline entry's id is unique, FOREVER. Enforcing
   * that in the producer alone leaves every save written before the fix in
   * violation of it for the life of the save. A save outlives the bug that
   * wrote it, so a data bug needs a data fix.
   *
   * Pure, as CORE_RULES 12 requires: no RNG, no clock. The suffix is the
   * entry's position among the duplicates, so the same save always migrates to
   * the same result and a life still replays from its seed. The FIRST holder of
   * an id keeps it unchanged, so nothing that already renders correctly moves.
   */
  10: (save) => {
    const player = { ...((save['player'] as Record<string, unknown>) ?? {}) };
    player['timeline'] = dedupeTimeline(
      Array.isArray(player['timeline']) ? player['timeline'] : [],
    );
    return { ...save, version: 11, player };
  },

  /**
   * v11 → v12 (Ticket 0208) — the parenting slice.
   *
   * An existing character gets an EMPTY one: no pregnancy, no adoption, no
   * open question. Not a guess at what they might have been up to — the same
   * rule migration 9 followed about odd jobs, and migration 4 about grades.
   * Inventing a child the save never simulated would be far worse than the
   * alternative, and there is no honest way to derive one.
   *
   * Children live in `family.members` with role 'child', so a save with none
   * simply has none. Nothing to convert there either.
   */
  11: (save) => ({ ...save, version: 12, parenting: save['parenting'] ?? { answered: {} } }),

  /**
   * v12 → v13 (Ticket 0210) — the employment slice.
   *
   * An existing character gets an EMPTY one: no job, no history, no standing
   * anywhere. Same rule as migration 11 and every one before it — a save that
   * never simulated a career does not get given one retroactively, and there is
   * no honest way to derive a job from a character who has only ever been at
   * school.
   *
   * The one thing this migration deliberately does NOT do is infer a job from
   * the character's stored `occupation` string. That field is a rendered LABEL
   * ("High School Graduate", "Unemployed") and has never been anything else;
   * parsing display text back into state is exactly the mistake CORE_RULES 13
   * forbids when it says logic depends on stable ids and never on display
   * names.
   */
  12: (save) => ({
    ...save,
    version: 13,
    employment: save['employment'] ?? { standing: {}, history: [], appliedTo: [], openings: [] },
  }),

  /**
   * v13 → v14 (Ticket 0210b) — credentials.
   *
   * The one migration in this file that DERIVES rather than defaults, and it can
   * because the fact is already in the save. A character whose stage is
   * 'graduated' finished high school; `finishedAtAge` says when. That is not a
   * guess — it is the same fact, written where the new code looks for it.
   *
   * A dropout gets nothing, which is correct: they did not finish. And nobody
   * gets a degree, because no save in existence has ever been to college.
   */
  13: (save) => {
    const education = (save['education'] ?? {}) as Record<string, unknown>;
    const finished = education['finishedAtAge'];
    const graduated = education['stage'] === 'graduated' && typeof finished === 'number';
    return {
      ...save,
      version: 14,
      education: {
        ...education,
        credentials: education['credentials'] ?? (graduated ? { highSchool: finished } : {}),
      },
    };
  },

  /**
   * v14 → v15 (Ticket 0211a) — repair duplicate timeline ids, again.
   *
   * Reported by the player, word for word the third time: "ERROR Encountered
   * two children with the same key, `t:2020:work:1`." Different producer from
   * 0207c — quitting a job and being hired somewhere else in the SAME YEAR
   * resets `pushedThisYear`, so the next two presses of Work Harder re-emit the
   * same two ids — and identical in the part that matters: the duplicates are
   * already written into saves, where a fixed producer can never reach them.
   *
   * This is v11's body, unchanged and now shared. `dedupeTimeline` runs over the
   * whole feed rather than over work ids alone, because the point of CORE_RULES
   * 13.12 is that the invariant holds for the timeline, not that it holds for
   * whichever producer last broke it. If a fourth one is found, this migration
   * is already the fix.
   *
   * Pure — no RNG, no clock — so the same save always migrates identically and a
   * life still replays from its seed. The first holder of an id keeps it.
   */
  14: (save) => {
    const player = { ...((save['player'] as Record<string, unknown>) ?? {}) };
    player['timeline'] = dedupeTimeline(
      Array.isArray(player['timeline']) ? player['timeline'] : [],
    );

    // And the other half of 0211a: `inClass` became `inRoom`, because a field
    // with one room hardcoded into its name is why an employed character had
    // nobody at work. A pure rename — every existing person keeps exactly the
    // value they had, and nobody is put in a room they were not in. Colleagues
    // arrive the next time a year is advanced, which is the only honest moment
    // for them to: a migration inventing three people the save never met would
    // be a guess, and CORE_RULES 12 does not allow one.
    const circle = { ...((save['circle'] as Record<string, unknown>) ?? {}) };
    const people = Array.isArray(circle['people']) ? circle['people'] : [];
    circle['people'] = people.map((raw) => {
      const person = { ...(raw as Record<string, unknown>) };
      if (!('inClass' in person)) return person;
      const { inClass, ...rest } = person;
      return { ...rest, inRoom: person['inRoom'] ?? inClass };
    });

    return { ...save, version: 15, player, circle };
  },

  /**
   * v15 → v16 (Ticket 0211) — the body.
   *
   * An existing character gets an EMPTY set of conditions and a vitality seeded
   * from the health they already have. That is not a guess: `vitality` is the
   * age-driven part of health, and the health on the save IS where that
   * character's body currently is. The same rule migration 9 followed for odd
   * jobs and 4 for grades — default to the fact already recorded, never invent
   * a history.
   *
   * Nobody arrives with a condition, which is the honest reading of the same
   * rule: no save in existence has ever been ill, so inventing a bad knee for a
   * fifty-year-old would be writing history rather than migrating it. They start
   * with a clean record and age from here.
   */
  15: (save) => {
    const player = (save['player'] ?? {}) as Record<string, unknown>;
    const stats = (player['stats'] ?? {}) as Record<string, unknown>;
    const health = typeof stats['health'] === 'number' ? stats['health'] : 50;
    return {
      ...save,
      version: 16,
      health: save['health'] ?? { conditions: [], vitality: health, deficit: 0 },
    };
  },

  /**
   * v16 → v17 (Ticket 0212) — records, and a world where people die.
   *
   * Three additions, and all three default to the same principle every
   * migration in this file has followed: DEFAULT TO THE FACT ALREADY RECORDED,
   * never invent a history.
   *
   *  - `player.records` becomes an empty array rather than being reconstructed
   *    from the timeline. It would be possible to scan the feed for the word
   *    "Graduated" and synthesise a record — and it would be wrong twice over:
   *    `LifeRecord`'s own contract says it is never derived by parsing timeline
   *    text, and 0211b rewrote a hundred and eighty of those sentences, so the
   *    scan would find a different history depending on which build last
   *    touched the save. An existing character's highlights start from here.
   *
   *  - Nobody is retroactively killed. A ninety-year-old parent on an existing
   *    save has been alive for the whole of that save's history, and a
   *    migration that quietly buried them would be rewriting somebody's life
   *    rather than migrating it. They become mortal from the NEXT year on,
   *    which the kin phase handles with no help from here.
   *
   *  - A dead family member with no `diedWhenPlayerWas` keeps none. The stress
   *    model reads that absence as "long ago", which is the only honest reading
   *    for a death that was never actually simulated.
   *
   * The `life` field on children is likewise absent, and `runOffspringYear`
   * starts them at whatever stage their age implies. A forty-year-old on an
   * existing save therefore has no history to inherit — the one real cost of
   * this migration, and the alternative was inventing forty years of it.
   */
  16: (save) => {
    const player = (save['player'] ?? {}) as Record<string, unknown>;
    return {
      ...save,
      version: 17,
      player: { ...player, records: Array.isArray(player['records']) ? player['records'] : [] },
    };
  },

  /**
   * v17 → v18 (Ticket 0301) — the ledger.
   *
   * An existing save has a BALANCE and no transactions behind it, and the two
   * have to agree from the first advance onwards or `reconcile` fails forever.
   * Three ways to do that, and only one of them is honest.
   *
   *  - Invent a history. Read the timeline, find the lines that mention money,
   *    and write transactions for them. This is wrong twice: `LifeRecord`'s own
   *    contract says structured history is never derived by parsing feed text,
   *    and 0211b rewrote a hundred and eighty of those sentences, so the same
   *    save would migrate differently depending on which build last touched it.
   *  - Start at zero and lose the money. A character who saved $40,000 opening
   *    a migrated save to find nothing is the worst outcome available.
   *  - Open the books with one entry that says exactly what is true: this is
   *    what they had when the ledger started, and nobody knows where it came
   *    from.
   *
   * The third. It reconciles by construction, it loses nothing, and it does not
   * pretend to a history the save cannot support — which is the same choice
   * migration 16 made about `records` and migration 15 about conditions.
   */
  17: (save) => {
    const player = (save['player'] ?? {}) as Record<string, unknown>;
    const world = (save['world'] ?? {}) as Record<string, unknown>;
    const cash = typeof player['cash'] === 'number' ? player['cash'] : 0;
    const year = typeof world['year'] === 'number' ? world['year'] : 0;
    const age = typeof player['age'] === 'number' ? player['age'] : 0;
    return {
      ...save,
      version: 18,
      finance:
        save['finance'] ??
        (cash === 0
          ? { transactions: [], balance: 0 }
          : {
              transactions: [
                {
                  id: `f:${year}:windfall:0`,
                  year,
                  age,
                  category: 'windfall',
                  amount: cash,
                  source: 'What you had when the books were opened',
                },
              ],
              balance: cash,
            }),
    };
  },
};

/**
 * Give every entry a unique id, keeping the first holder's unchanged.
 *
 * Shared by migrations 10 and 14, which is the honest way to say that this has
 * been needed twice. The suffix is the entry's POSITION among the duplicates, so
 * the result depends only on the save — that is what makes it pure.
 */
function dedupeTimeline(timeline: readonly unknown[]): unknown[] {
  const seen = new Map<string, number>();
  return timeline.map((raw) => {
    const entry = raw as Record<string, unknown>;
    const id = entry['id'];
    if (typeof id !== 'string') return entry;
    const already = seen.get(id) ?? 0;
    seen.set(id, already + 1);
    // `dup` rather than a bare number, so a repaired id can never collide with
    // one the current producers make — those end in a plain counter.
    return already === 0 ? entry : { ...entry, id: `${id}:dup${already}` };
  });
}

export function describeMigrationError(error: MigrationError): string {
  switch (error.kind) {
    case 'notAnObject':
      return "Save data isn't an object.";
    case 'missingVersion':
      return 'Save data has no version field.';
    case 'unknownVersion':
      return `No migration path from save version ${error.version}.`;
    case 'fromTheFuture':
      return `Save version ${error.version} is newer than this build supports (${error.supported}). Update the app.`;
    case 'corrupt':
      return `Save data is corrupt: ${error.detail}`;
  }
}

/**
 * Bring any supported save shape up to the current version.
 * Returns a typed Result — a save that cannot be read is an expected outcome
 * on a downgraded app, not an exception (spec 1224–1246).
 */
export function migrateSave(raw: unknown): Result<CurrentSaveGame, MigrationError> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return err({ kind: 'notAnObject' });
  }

  let working = { ...(raw as Record<string, unknown>) };
  const declared = working['version'];

  if (typeof declared !== 'number' || !Number.isInteger(declared)) {
    return err({ kind: 'missingVersion' });
  }
  if (declared > CURRENT_SAVE_VERSION) {
    return err({ kind: 'fromTheFuture', version: declared, supported: CURRENT_SAVE_VERSION });
  }

  let version = declared;
  while (version < CURRENT_SAVE_VERSION) {
    const migration = migrations[version];
    if (!migration) {
      return err({ kind: 'unknownVersion', version });
    }
    working = migration(working);
    const nextVersion = working['version'];
    if (typeof nextVersion !== 'number' || nextVersion <= version) {
      return err({
        kind: 'corrupt',
        detail: `migration from v${version} did not advance the version field`,
      });
    }
    version = nextVersion;
  }

  const validation = validateCurrentSave(working);
  if (!validation.ok) return validation;
  return ok(validation.value);
}

/**
 * Structural validation of a current-version save. Deliberately checks shape,
 * not game balance — a save with odd numbers is still a save.
 */
export function validateCurrentSave(
  candidate: Record<string, unknown>,
): Result<CurrentSaveGame, MigrationError> {
  const require = (path: string, value: unknown, predicate: boolean): string | null =>
    predicate ? null : `expected ${path}${value === undefined ? ' to be present' : ''}`;

  const player = candidate['player'] as Record<string, unknown> | undefined;
  const world = candidate['world'] as Record<string, unknown> | undefined;
  const rng = candidate['rng'] as Record<string, unknown> | undefined;

  const problems = [
    require('id', candidate['id'], typeof candidate['id'] === 'string'),
    require('player', player, typeof player === 'object' && player !== null),
    require('player.age', player?.['age'], typeof player?.['age'] === 'number'),
    require('player.stats', player?.['stats'], typeof player?.['stats'] === 'object'),
    require('player.talents', player?.['talents'], typeof player?.['talents'] === 'object'),
    require('player.personality', player?.['personality'], typeof player?.['personality'] ===
      'object' && player?.['personality'] !== null),
    require('player.timeline', player?.['timeline'], Array.isArray(player?.['timeline'])),
    require('world.year', world?.['year'], typeof world?.['year'] === 'number'),
    require('rng.seed', rng?.['seed'], typeof rng?.['seed'] === 'string'),
    require('rng.streams', rng?.['streams'], typeof rng?.['streams'] === 'object'),
    require('settings', candidate['settings'], typeof candidate['settings'] === 'object'),
    require('family.members', (candidate['family'] as Record<string, unknown> | undefined)?.[
      'members'
    ], Array.isArray((candidate['family'] as Record<string, unknown> | undefined)?.['members'])),
    require('education.stage', (candidate['education'] as Record<string, unknown> | undefined)?.[
      'stage'
    ], typeof (candidate['education'] as Record<string, unknown> | undefined)?.['stage'] ===
      'string'),
    require('circle.people', (candidate['circle'] as Record<string, unknown> | undefined)?.[
      'people'
    ], Array.isArray((candidate['circle'] as Record<string, unknown> | undefined)?.['people'])),
  ].filter((problem): problem is string => problem !== null);

  if (problems.length > 0) {
    return err({ kind: 'corrupt', detail: problems.join('; ') });
  }
  return ok(candidate as unknown as CurrentSaveGame);
}
