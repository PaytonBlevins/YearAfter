import { businessRescueOk } from './business-rescue-validation';
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
import {
  SUBSISTENCE,
  savedWatchWorkAllowed,
  isLifestyleTier,
  POSTS_PER_YEAR,
  reconcile,
  reconcileByYear,
  standardTargetFor,
  yearsOutside,
  type Ledger,
} from '@yearafter/finance';
import { CHARGED_FROM_AGE } from '@yearafter/simulation';
import { findInstrument } from '@yearafter/finance';
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

  /**
   * v18 -> v19: Ticket 0303 gives a household a standard of living and a roof.
   *
   * Two fields, and the interesting question is what an EXISTING save should
   * get for them, because both have sixty years of history this migration
   * cannot see.
   *
   * `housing` is the easy one and it is decided by age, not by a guess: a save
   * whose character is grown is a character who lives somewhere. Anybody at or
   * past `CHARGED_FROM_AGE` gets their own place; a save mid-childhood is still
   * at home, which is where they actually are.
   *
   * `standard` is the one that could have gone wrong. The tempting move is to
   * derive it from the balance — a rich save is a rich life — and it is exactly
   * the wrong move: `standard` is what somebody is USED TO SPENDING, and a
   * character who happens to be holding $400,000 because the old model never
   * charged them for anything would be handed a standard of living to match and
   * would go broke inside five years of the new one. A migration that makes an
   * old save's character suddenly destitute is a migration that ate a save.
   *
   * So it is seeded from INCOME where there is one and from subsistence where
   * there is not, and the creep does the rest within a few years of play. That
   * is slower than the truth and it is recoverable, which is the trade every
   * migration in this file has made.
   */
  18: (save) => {
    const player = (save['player'] ?? {}) as Record<string, unknown>;
    const age = typeof player['age'] === 'number' ? player['age'] : 0;
    const finance = (save['finance'] ?? {}) as Record<string, unknown>;
    const rows = Array.isArray(finance['transactions']) ? finance['transactions'] : [];

    // Last year's take-home, if this save has ever recorded any pay. Purely a
    // read of what is already written down — no RNG, no clock (spec 1108-1140).
    let lastPayYear = -Infinity;
    let lastPay = 0;
    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      const category = row['category'];
      const year = typeof row['year'] === 'number' ? row['year'] : -Infinity;
      if (category !== 'salary' && category !== 'commission') continue;
      if (year > lastPayYear) {
        lastPayYear = year;
        lastPay = 0;
      }
      if (year === lastPayYear && typeof row['amount'] === 'number') lastPay += row['amount'] / 100;
    }

    return {
      ...save,
      version: 19,
      household: save['household'] ?? {
        standard: Math.max(SUBSISTENCE, Math.round(standardTargetFor(lastPay, 0))),
        housing: age >= CHARGED_FROM_AGE ? 'ownPlace' : 'withFamily',
        ...(age >= CHARGED_FROM_AGE ? { leftHomeAt: CHARGED_FROM_AGE } : {}),
      },
    };
  },

  /**
   * v19 -> v20: Ticket 0306 gives a character credit cards.
   *
   * An existing save gets NONE, and this is the shortest migration in the file
   * for the best reason: there is nothing to reconstruct. A card is a thing you
   * applied for, and nobody in any existing save ever applied for one. Issuing
   * them a card retroactively would be inventing an application, a limit and a
   * lender's decision the game never made — which is the same choice migration
   * 2 made about families and migration 4 about school records.
   *
   * They can apply on their next turn like anybody else, and their credit
   * standing already knows how to say "no cards" rather than "perfect
   * utilisation" (0305, and 13.46).
   */
  19: (save) => ({ ...save, version: 20, cards: save['cards'] ?? [] }),

  /**
   * v20 -> v21: Ticket 0307 gives a character loans.
   *
   * None, for the same reason migration 19 gave nobody a card: a loan is a
   * thing you applied for and were approved for, and inventing one would be
   * inventing a lender's decision the game never made.
   */
  20: (save) => ({ ...save, version: 21, loans: save['loans'] ?? [] }),

  /**
   * v21 -> v22: Ticket 0308 gives a character a portfolio and a market.
   *
   * An EMPTY portfolio, for the third time in three tickets and the same
   * reason: buying something is a decision, and a migration that handed an
   * existing character $20,000 of index fund would be inventing a choice they
   * never made. The market, though, has to start SOMEWHERE, and every save
   * starts it at `normal` — not at a random state, because a migration that
   * rolled a die would make loading a save twice produce two different worlds.
   */
  21: (save) => ({
    ...save,
    version: 22,
    portfolio: save['portfolio'] ?? [],
    market: save['market'] ?? 'normal',
  }),

  /**
   * v22 -> v23: Ticket 0308c replaces seven category products with a catalog of
   * eighty-nine named instruments, and holdings become UNITS at a price.
   *
   * NOBODY LOSES A PENNY. A v22 holding is `{ productId, contributed, value }` —
   * a dollar blob. Each old product maps to the instrument that best stands for
   * it, and the units are whatever that instrument's opening price buys with
   * the blob's CURRENT VALUE, so a portfolio worth $84,210 before the migration
   * is worth $84,210 after it. What was paid carries across untouched, so a
   * holding that was up stays up by the same amount.
   *
   * The alternative — clear the portfolio and refund the cash — was rejected
   * because it turns a market position into a bank balance behind the player's
   * back, which is a decision the game would be making for them.
   */
  22: (save) => {
    /*
      Each old category becomes the named instrument that best stands for it.
      Bonds keep a term, so they keep `maturesIn` too.
    */
    const becomes: Record<string, string> = {
      'inv.govbonds': 'bd.cald10',
      'inv.corpbonds': 'bd.rhen7',
      'inv.indexfund': 'fd.broadindex',
      'inv.managedfund': 'fd.keelworthactive',
      // The old blue-chip and growth buckets become the names closest to what
      // they described: a large dull payer, and a volatile technology one.
      'inv.bluechip': 'eq.bramble',
      'inv.growth': 'eq.verrell',
      'inv.crypto': 'cx.meridiancoin',
    };

    const old = (save['portfolio'] as readonly Record<string, unknown>[] | undefined) ?? [];
    const portfolio = old
      .map((holding) => {
        const instrumentId = becomes[String(holding['productId'] ?? '')];
        const instrument = instrumentId ? findInstrument(instrumentId) : undefined;
        if (!instrument) return undefined;

        /*
          UNITS COME FROM THE TARGET'S PRICE, which sounds obvious and was wrong
          in the first version: the table held the OLD product's notional price,
          so a $21,000 crypto holding was divided by $1,240 instead of $18,400
          and came out fifteen times too valuable. A migration test caught it,
          and only because it checked the MONEY rather than the shape.

          Reading the live catalog rather than freezing the prices here is
          deliberate. If a price is ever retuned, a save migrating afterwards
          gets a different unit count and the SAME VALUE — and value is the
          invariant that matters to the person who owns it.
        */
        const value = Number(holding['value'] ?? 0);
        const units = Math.round((value / instrument.priceCents) * 10_000) / 10_000;
        if (units <= 0) return undefined;

        const maturesIn = holding['maturesIn'];
        return {
          instrumentId,
          units,
          // What they paid carries across untouched, so a holding that was up
          // stays up by the same amount.
          paid: Number(holding['contributed'] ?? value),
          ...(typeof maturesIn === 'number' && maturesIn > 0 ? { maturesIn } : {}),
        };
      })
      .filter((row) => row !== undefined);

    return {
      ...save,
      version: 23,
      portfolio,
      // An empty price book reads as "every instrument at its opening price",
      // which is exactly right for a save that has never seen a market.
      prices: save['prices'] ?? { history: {} },
    };
  },

  /**
   * v23 -> v24: Ticket 0309 lets a character pay somebody for advice.
   *
   * NOBODY IS GIVEN AN ADVISOR, and that is the fourth migration in a row to
   * refuse to invent a decision — 21 gave nobody a loan, 22 gave nobody a
   * portfolio, 23 refused to refund one to cash. Hiring somebody is a choice
   * with a yearly fee attached, and an existing save waking up next to a bill
   * it never agreed to is the worst version of this.
   *
   * So the field is simply absent, which is what "no advisor" means everywhere
   * else in the build. The migration exists to move the version, not to move
   * any money.
   */
  23: (save) => ({ ...save, version: 24 }),

  /**
   * v24 -> v25: Ticket 0310 gives a character a retirement account.
   *
   * EMPTY, AND NOBODY IS RETIRED — the fifth migration running to refuse to
   * invent a decision. Backdating contributions would hand an existing
   * fifty-year-old a balance they never chose to build, and worse, would hand
   * them the employer match that goes with it: money from a job they may not
   * even hold any more.
   *
   * `rate` starts at zero rather than at something sensible, which is the same
   * call migration 21 made about loans. A standing instruction to move 6% of
   * every future paycheque is an instruction, and the game did not receive one.
   */
  24: (save) => ({
    ...save,
    version: 25,
    retirement: save['retirement'] ?? {
      balance: 0,
      rate: 0,
      serviceYears: 0,
      finalPensionablePay: 0,
    },
  }),

  /**
   * v25 -> v26: Ticket 0402 added the job offer.
   *
   * Nothing is added. An offer is a question that was asked in a specific year
   * about a specific job, and a save made before offers existed was never asked
   * one — inventing a pending offer here would put a question in front of a
   * player about a year that already happened. The absent field IS the correct
   * migration, and the version bump is what records that the shape changed.
   *
   * The pending queue is deliberately untouched for the same reason: a v25 save
   * cannot be holding a `career.offer` decision, so there is nothing to repair.
   */
  25: (save) => ({ ...save, version: 26 }),

  /**
   * v26 -> v27: Ticket 0405 added the systemic college offer.
   *
   * Nothing is added, for the same reason v25 -> v26 added nothing: a save
   * made before this door existed was never asked its question, and a v26
   * save cannot be holding an `education.offer` decision, so there is
   * nothing in the pending queue to repair either. The absent field is the
   * correct migration; the version bump just records that the shape changed.
   */
  26: (save) => ({ ...save, version: 27 }),
  /**
   * v27 -> v28: Ticket 0406 added licenses and the vocational stage.
   *
   * Nothing to add. `credentials.licenses` is optional and absent means "holds
   * none", which is true of every character who ever lived in a build without
   * trade school — and `holdsLicense` reads an absent array as false rather
   * than throwing, so a v27 save is already correct.
   *
   * WHAT THIS MIGRATION DELIBERATELY DOES NOT DO is grant `lic.md` to the
   * physicians a v27 save may already contain. It is tempting — those
   * characters legitimately reached the job under the old rules — but a
   * migration that hands out credentials is a migration that invents history,
   * and the license would then outlive the job if they were ever fired. They
   * keep the job they hold; `cannotApply` only ever runs on the next one.
   */
  27: (save) => {
    /*
      AND IT REPAIRS, because a v27 save can already be broken.

      `pending` was serialized from 0402 and the offer behind it never was (see
      `toSave`), so any save written while a career or college offer was on the
      table came back with an unanswerable question in the queue. `decide`
      errors on it, the buttons do nothing, and `advanceYear` will not advance
      past a pending decision — the character is stuck at that age forever.
      0406 fixes the serialization, but a fix that only helps future saves
      leaves everybody who already hit it exactly where they were.

      So this drops any offer decision that has no offer behind it. Dropping
      rather than reconstructing: the offer carried a drawn employer, a drawn
      salary and a drawn major, none of which survived, and inventing
      replacements would be inventing history the player never saw. Losing an
      unanswered question costs them one opportunity; keeping it costs them the
      save. A decision whose offer DID survive is left alone.
    */
    const pending = Array.isArray(save['pending'])
      ? (save['pending'] as { eventId?: string }[])
      : [];
    const repaired = pending.filter((decision) => {
      if (decision?.eventId === 'career.offer') return save['offer'] !== undefined;
      if (decision?.eventId === 'education.offer') return save['collegeOffer'] !== undefined;
      return true;
    });
    return { ...save, pending: repaired, version: 28 };
  },
  /**
   * v28 -> v29: Ticket 0407 gave the career offer its other half.
   *
   * `offer.fromJobId` became optional — absent means the offer is a first job
   * rather than somebody poaching a worker. A v28 save cannot hold one, because
   * the build that wrote it never made one, so the absent field is the whole
   * migration. The version bump records that the shape changed.
   */
  28: (save) => ({ ...save, version: 29 }),
  /**
   * v29 -> v30: Ticket 0410 built the door into a private life.
   *
   * `lifeOffer` is optional and absent means "there is no question open", which
   * is true of every save written before the door existed. So there is no
   * content to add, and the version bump records the shape change.
   *
   * IT STILL REPAIRS, for the reason migration 27 does. A v29 save cannot hold
   * a `romance.offer` or a `family.offer` in `pending` — the build that wrote
   * it could not raise one — so any that are there came from a save file that
   * has been edited or has travelled backwards through a build, and they are
   * unanswerable: `answerLifeOffer` looks up `state.lifeOffer`, finds nothing
   * and returns `no-offer`, which wedges `advanceYear` behind a question with
   * no answer. Dropping costs one opportunity; keeping costs the save.
   */
  29: (save) => {
    const pending = Array.isArray(save['pending'])
      ? (save['pending'] as { eventId?: string }[])
      : [];
    const repaired = pending.filter((decision) => {
      if (decision?.eventId === 'romance.offer' || decision?.eventId === 'family.offer') {
        return save['lifeOffer'] !== undefined;
      }
      return true;
    });
    return { ...save, pending: repaired, version: 30 };
  },
  /**
   * v30 -> v31: Ticket 0416 built the door to something to join.
   *
   * `pursuitOffer` is optional and absent on every save written before it, and
   * the adult pursuits it can lead to are new entries in a list whose shape did
   * not change. So, like v30, the only content is the repair: a v30 save cannot
   * hold an `activity.offer` in `pending`, and one that does would wedge
   * `advanceYear` behind a question `answerPursuitOffer` cannot find.
   */
  30: (save) => {
    const pending = Array.isArray(save['pending'])
      ? (save['pending'] as { eventId?: string }[])
      : [];
    const repaired = pending.filter(
      (decision) => decision?.eventId !== 'activity.offer' || save['pursuitOffer'] !== undefined,
    );
    return { ...save, pending: repaired, version: 31 };
  },
  /**
   * v31 -> v32: Ticket 0501 let a character own a home.
   *
   * Nobody before it could, so every older save gets an empty `homes` — a true
   * statement about those lives, not a default. And the same repair as the
   * last four doors: a v31 save cannot hold a `home.offer` in `pending`, so one
   * that does has lost its payload and would wedge `advanceYear`.
   */
  31: (save) => {
    const pending = Array.isArray(save['pending'])
      ? (save['pending'] as { eventId?: string }[])
      : [];
    const repaired = pending.filter(
      (decision) => decision?.eventId !== 'home.offer' || save['homeOffer'] !== undefined,
    );
    return {
      ...save,
      homes: Array.isArray(save['homes']) ? save['homes'] : [],
      pending: repaired,
      version: 32,
    };
  },
  /**
   * v32 -> v33: Ticket 0503 let a character rent property out.
   *
   * A `letting` on a home is optional and nothing before this could write
   * one, so there is nothing to add. The bump is the point: an older build
   * meeting a v33 save refuses it instead of loading it without its tenants.
   */
  32: (save) => ({ ...save, version: 33 }),
  /**
   * v33 -> v34: Ticket 0504 let a character own a car.
   *
   * Nobody before it could, so every older save gets an empty `vehicles` — a
   * true statement about those lives. And the repair every door has needed: a
   * v33 save cannot hold a `vehicle.offer` in `pending`, so one that does has
   * lost its payload and would wedge `advanceYear`.
   */
  33: (save) => {
    const pending = Array.isArray(save['pending'])
      ? (save['pending'] as { eventId?: string }[])
      : [];
    const repaired = pending.filter(
      (decision) => decision?.eventId !== 'vehicle.offer' || save['vehicleOffer'] !== undefined,
    );
    return {
      ...save,
      vehicles: Array.isArray(save['vehicles']) ? save['vehicles'] : [],
      pending: repaired,
      version: 34,
    };
  },
  /**
   * v34 -> v35: Ticket 0505 let a car carry modifications.
   *
   * `mods` on a car is optional and nothing before this could write one, so
   * there is nothing to add. The bump is the point: an older build meeting a
   * v35 save refuses it instead of loading a Tarbus conversion as a stock car.
   */
  34: (save) => ({ ...save, version: 35 }),
  /**
   * v35 -> v36: Ticket 0506 — jewelry, watches and collections, and the
   * renovation door.
   *
   * Nobody before it owned a valuable, so every older save gets an empty
   * `valuables`. A home's `renovations` is optional and needs nothing. And the
   * repair every door has needed: a v35 save cannot hold a `home.renovate` in
   * `pending`, so one that does has lost its payload.
   */
  35: (save) => {
    const pending = Array.isArray(save['pending'])
      ? (save['pending'] as { eventId?: string }[])
      : [];
    const repaired = pending.filter(
      (decision) => decision?.eventId !== 'home.renovate' || save['renovationOffer'] !== undefined,
    );
    return {
      ...save,
      valuables: Array.isArray(save['valuables']) ? save['valuables'] : [],
      pending: repaired,
      version: 36,
    };
  },
  /**
   * v36 -> v37: Ticket 0507 — auctions. The diary and a valuable's `fake`
   * and `reproduction` are optional and nothing earlier could write them, so
   * the bump is the whole migration.
   */
  36: (save) => ({ ...save, version: 37 }),
  /**
   * v37 -> v38: Ticket 0601 — businesses. Nobody before it owned one, so every
   * older save gets an empty list.
   */
  37: (save) => ({
    ...save,
    businesses: Array.isArray(save['businesses']) ? save['businesses'] : [],
    version: 38,
  }),
  /**
   * v38 -> v39: Ticket 0602 — locations. A business before it had one door, so
   * each gets an empty list of extra ones.
   */
  38: (save) => ({
    ...save,
    businesses: Array.isArray(save['businesses'])
      ? (save['businesses'] as Record<string, unknown>[]).map((business) => ({
          ...business,
          branches: Array.isArray(business['branches']) ? business['branches'] : [],
        }))
      : [],
    version: 39,
  }),
  /**
   * v39 -> v40: Ticket 0605 — private deals. Nobody before it held one, so every
   * older save gets an empty list.
   */
  39: (save) => ({
    ...save,
    deals: Array.isArray(save['deals']) ? save['deals'] : [],
    version: 40,
  }),
  /**
   * v40 -> v41: Ticket 0701 — channels and fame. Nobody before it made anything for an
   * audience, so every older save gets no channels and no fame.
   */
  40: (save) => ({
    ...save,
    channels: Array.isArray(save['channels']) ? save['channels'] : [],
    fame: typeof save['fame'] === 'number' ? save['fame'] : 0,
    version: 41,
  }),
  /**
   * v41 -> v42: Ticket 0705 — the famous people the character has met. Nobody before it met
   * one, so every older save has no connections, no one seen and no stranger answered.
   */
  41: (save) => ({
    ...save,
    celebrities:
      typeof save['celebrities'] === 'object' && save['celebrities'] !== null
        ? save['celebrities']
        : { ties: [], met: [], answeredYear: 0, work: { year: 0, done: [] } },
    version: 42,
  }),
  /** P10 v46 -> v47: no work was paid for; preserve held values, balances and RNG. */
  46: (save) => ({ ...save, version: 47 }),
  /** P11 v47 -> v48: no extra service was paid for; no changes or RNG draws. */
  47: (save) => ({ ...save, version: 48 }),
  /** P7 v45 -> v46: no goal existed before; no invented goal and no RNG. */
  45: (save) => {
    const { cashGoal: _future, ...prior } = save;
    return { ...prior, version: 46 };
  },
  /** v44 -> v45: P2 defaults the existing life without changing its history or RNG. */
  44: (save) => {
    const household = save['household'];
    return {
      ...save,
      household:
        typeof household === 'object' && household !== null && !Array.isArray(household)
          ? { ...household, lifestyle: 'comfortable' }
          : household,
      version: 45,
    };
  },
  /** v43 -> v44: P1 adds optional rescue quotes without inventing legacy reviews. */
  43: (save) => {
    const { businessRescue: _notYetBuilt, ...prior } = save;
    return { ...prior, version: 44 };
  },
  /**
   * v42 -> v43: Ticket 0707 — what has been said yes to this year. Nothing has been, in any
   * older save, so the record is empty for year 0. What a v42 save already carries is kept.
   */
  42: (save) => {
    const old =
      typeof save['celebrities'] === 'object' && save['celebrities'] !== null
        ? (save['celebrities'] as Record<string, unknown>)
        : { ties: [], met: [], answeredYear: 0 };
    return {
      ...save,
      celebrities: {
        ...old,
        work:
          typeof old['work'] === 'object' && old['work'] !== null
            ? old['work']
            : { year: 0, done: [] },
      },
      version: 43,
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
 * Ticket 0302 — the books, checked on the way in.
 *
 * THE THIRD ENFORCEMENT POINT, and the only one of the three that sees data
 * this build did not just compute. The static rule stops a bypass shipping; the
 * invariant in `advanceYear` names the year a drift starts in. Both of those
 * run inside a process that has the ledger in memory and is therefore, at
 * bottom, checking its own arithmetic. This one checks a document — one that
 * came off a device, through a migration, possibly written by a build that no
 * longer exists.
 *
 * That is what makes the mirror check real HERE and a tautology anywhere else.
 * In `advanceYear`, `player.cash` and `finance.balance` are both handed back by
 * the same `postYear` call, and a check that they agree cannot fail; I wrote
 * one there and took it out again. A save is two numbers that were serialized
 * separately and can disagree — because a migration dropped a field, because a
 * write was torn, or because the build that wrote it had the bug this ticket
 * exists to prevent.
 *
 * A corrupt ledger is `corrupt`, not a repair. Spec 1224–1246 makes an
 * unreadable save an expected outcome with a message, and a save that silently
 * fixes its own money is a save that hides how much it invented.
 */
/** Ticket 0707. What was said yes to this year: a year, and a list of what it was and what it pays. */
function workOk(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const whole = (n: unknown): boolean => typeof n === 'number' && Number.isInteger(n);
  const done = record['done'];
  return (
    whole(record['year']) &&
    Array.isArray(done) &&
    done.every((job) => {
      if (typeof job !== 'object' || job === null) return false;
      const entry = job as Record<string, unknown>;
      return (
        typeof entry['id'] === 'string' &&
        typeof entry['outlet'] === 'string' &&
        whole(entry['pay']) &&
        (entry['pay'] as number) >= 0 &&
        whole(entry['fame']) &&
        whole(entry['mood'])
      );
    })
  );
}

/** Ticket 0705. The shape of the record of famous people: lists, a number, and a name and a warmth on each tie. */
/** Optional publishing records extend v43 without discarding older accounts. */
function channelPublishingOk(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every((channel: unknown) => {
    if (typeof channel !== 'object' || channel === null) return true;
    const record = channel as Record<string, unknown>;
    const luck = record['luck'];
    // P3: persisted luck is authoritative, but corrupt luck cannot become a balance input.
    if (typeof luck !== 'number' || !Number.isFinite(luck) || luck < 0 || luck > 1) return false;
    const publishing = record['publishing'];
    if (publishing === undefined) return true;
    if (typeof publishing !== 'object' || publishing === null || Array.isArray(publishing))
      return false;
    const row = publishing as Record<string, unknown>;
    return (
      Number.isSafeInteger(row['year']) &&
      Number.isSafeInteger(row['count']) &&
      typeof row['count'] === 'number' &&
      row['count'] >= 0 &&
      row['count'] <= POSTS_PER_YEAR &&
      typeof row['kind'] === 'string' &&
      row['kind'].length > 0 &&
      Number.isSafeInteger(row['gained'])
    );
  });
}

function celebritiesOk(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const ties = record['ties'];
  const met = record['met'];
  const whole = (n: unknown): boolean => typeof n === 'number' && Number.isInteger(n);
  return (
    Array.isArray(ties) &&
    ties.every((tie) => {
      if (typeof tie !== 'object' || tie === null) return false;
      const entry = tie as Record<string, unknown>;
      return (
        typeof entry['id'] === 'string' &&
        typeof entry['name'] === 'string' &&
        (entry['sex'] === 'male' || entry['sex'] === 'female') &&
        typeof entry['field'] === 'string' &&
        whole(entry['birthYear']) &&
        whole(entry['metYear']) &&
        whole(entry['metAtAge']) &&
        typeof entry['warmth'] === 'number' &&
        Number.isFinite(entry['warmth']) &&
        whole(entry['lastContactYear']) &&
        whole(entry['doneYear']) &&
        Array.isArray(entry['done']) &&
        entry['done'].every((id) => typeof id === 'string') &&
        (entry['promoted'] === undefined || typeof entry['promoted'] === 'boolean') &&
        (entry['endedYear'] === undefined || whole(entry['endedYear'])) &&
        (entry['endedBecause'] === undefined ||
          entry['endedBecause'] === 'lost touch' ||
          entry['endedBecause'] === 'died')
      );
    }) &&
    Array.isArray(met) &&
    met.every((id) => typeof id === 'string') &&
    whole(record['answeredYear']) &&
    workOk(record['work'])
  );
}

function ledgerProblems(candidate: Record<string, unknown>): readonly string[] {
  const finance = candidate['finance'] as Record<string, unknown> | undefined;
  if (typeof finance !== 'object' || finance === null) return ['expected finance to be present'];

  const balance = finance['balance'];
  const rows = finance['transactions'];
  if (typeof balance !== 'number' || !Number.isFinite(balance)) {
    return ['expected finance.balance to be a number'];
  }
  if (!Array.isArray(rows)) return ['expected finance.transactions to be an array'];

  // Shape first, and stop if it is wrong: the arithmetic below would otherwise
  // report a difference of NaN, which tells a player nothing and a developer
  // less.
  const malformed = rows.findIndex((row: unknown) => {
    const entry = row as Record<string, unknown> | null;
    return (
      typeof entry !== 'object' ||
      entry === null ||
      typeof entry['amount'] !== 'number' ||
      !Number.isFinite(entry['amount']) ||
      typeof entry['year'] !== 'number' ||
      typeof entry['id'] !== 'string'
    );
  });
  if (malformed >= 0) return [`finance.transactions[${malformed}] is not a transaction`];

  const ledger = finance as unknown as Ledger;
  const problems: string[] = [];

  // Spec 1678, made build-blocking by 0302.
  const books = reconcile(ledger);
  if (!books.ok) {
    problems.push(
      `finance does not balance: the balance says ${Number(books.balance) / 100} and the ` +
        `transactions add up to ${Number(books.summed) / 100}`,
    );
  }

  // The mirror. `player.cash` is written from the ledger and never computed,
  // so on a save they are the same number twice or the save is wrong.
  const player = candidate['player'] as Record<string, unknown> | undefined;
  const cash = player?.['cash'];
  if (typeof cash !== 'number') {
    problems.push('expected player.cash to be a number');
  } else if (cash !== Number(ledger.balance)) {
    problems.push(
      `player.cash (${cash / 100}) and finance.balance (${Number(ledger.balance) / 100}) disagree`,
    );
  }

  const walk = reconcileByYear(ledger);
  if (walk.firstBadYear !== undefined) {
    problems.push(`finance went below zero in ${walk.firstBadYear}`);
  }

  // The span comes from the life, because the ledger's own years cannot say
  // one of them is wrong. Skipped rather than guessed if the save has not got
  // both ends — the shape checks above already report a missing world.year.
  const birthYear = player?.['birthYear'];
  const year = (candidate['world'] as Record<string, unknown> | undefined)?.['year'];
  if (typeof birthYear === 'number' && typeof year === 'number') {
    const strays = yearsOutside(ledger, birthYear, year);
    if (strays.length > 0) {
      problems.push(
        `finance records money moving in ${strays.join(', ')}, outside a life that runs ` +
          `${birthYear}–${year}`,
      );
    }
  }

  return problems;
}

/**
 * Structural validation of a current-version save. Deliberately checks shape,
 * not game balance — a save with odd numbers is still a save.
 *
 * The finance block is the exception, and it earns it: spec 1678 says a
 * mismatch fails validation, so the books are not "odd numbers", they are the
 * one thing in a save that can be provably wrong.
 */
export function validateCurrentSave(
  candidate: Record<string, unknown>,
): Result<CurrentSaveGame, MigrationError> {
  const require = (path: string, value: unknown, predicate: boolean): string | null =>
    predicate ? null : `expected ${path}${value === undefined ? ' to be present' : ''}`;

  const player = candidate['player'] as Record<string, unknown> | undefined;
  const world = candidate['world'] as Record<string, unknown> | undefined;
  const rng = candidate['rng'] as Record<string, unknown> | undefined;

  const goal = candidate['cashGoal'];
  const problems = [
    require('cashGoal', goal, goal === undefined ||
      (typeof goal === 'number' && Number.isSafeInteger(goal) && goal >= 0)),
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
    // Ticket 0501. A list, however short.
    require('household', candidate['household'], householdOk(candidate['household'])),
    require('homes', candidate['homes'], Array.isArray(candidate['homes'])),
    // Ticket 0504. The same for cars.
    require('vehicles', candidate['vehicles'], Array.isArray(candidate['vehicles']) &&
      candidate['vehicles'].every((car: unknown) => {
        if (typeof car !== 'object' || car === null || Array.isArray(car)) return false;
        const held = car as Record<string, unknown>;
        const service = held['service'];
        if (service === undefined) return true;
        if (typeof service !== 'object' || service === null || Array.isArray(service)) return false;
        const work = service as Record<string, unknown>;
        return (
          Number.isSafeInteger(held['boughtYear']) &&
          Number.isSafeInteger(work['year']) &&
          Number(work['year']) >= Number(held['boughtYear']) &&
          Number(work['year']) <= Number(world?.['year']) &&
          Number.isSafeInteger(work['cost']) &&
          Number(work['cost']) >= 100 &&
          Number(work['cost']) % 10 === 0
        );
      })),
    // Ticket 0506. And for what is in the collection.
    require('valuables', candidate['valuables'], Array.isArray(candidate['valuables']) &&
      candidate['valuables'].every((piece: unknown) => {
        if (typeof piece !== 'object' || piece === null) return false;
        const icing = (piece as Record<string, unknown>)['icing'];
        if (icing === undefined) return true;
        if (typeof icing !== 'object' || icing === null || Array.isArray(icing)) return false;
        const work = icing as Record<string, unknown>;
        const held = piece as Record<string, unknown>;
        return (
          typeof held['itemId'] === 'string' &&
          savedWatchWorkAllowed(held['itemId']) &&
          Number.isSafeInteger(held['boughtYear']) &&
          Number(work['year']) >= Number(held['boughtYear']) &&
          Number.isSafeInteger(work['cost']) &&
          Number(work['cost']) >= 0 &&
          Number.isSafeInteger(work['year']) &&
          Number(work['year']) <= Number(world?.['year'])
        );
      })),
    // Ticket 0601. And for what is owned and running.
    require('businesses', candidate['businesses'], Array.isArray(candidate['businesses'])),
    require('businessRescue', candidate['businessRescue'], businessRescueOk(candidate)),
    // Ticket 0605. And for the private deals.
    require('deals', candidate['deals'], Array.isArray(candidate['deals'])),
    // Ticket 0701. And for the channels, and a number for fame.
    require('channels', candidate['channels'], channelPublishingOk(candidate['channels'])),
    require('fame', candidate['fame'], typeof candidate['fame'] === 'number'),
    // Ticket 0705. A record of connections, people seen and the year a stranger was last answered.
    require('celebrities', candidate['celebrities'], celebritiesOk(candidate['celebrities'])),
    // Ticket 0704. Optional, but if it is there it has to be one of the two.
    require('representation', candidate['representation'], candidate['representation'] ===
      undefined ||
      candidate['representation'] === 'manager' ||
      candidate['representation'] === 'agent'),
  ].filter((problem): problem is string => problem !== null);

  if (problems.length > 0) {
    return err({ kind: 'corrupt', detail: problems.join('; ') });
  }

  // Runs only once the shape is known good, so a save missing half its fields
  // reports the missing fields rather than an accounting complaint about them.
  const books = ledgerProblems(candidate);
  if (books.length > 0) {
    return err({ kind: 'corrupt', detail: books.join('; ') });
  }
  return ok(candidate as unknown as CurrentSaveGame);
}

/** P2: reject malformed living state before a loaded year can use it. */
function householdOk(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row['standard'] === 'number' &&
    Number.isFinite(row['standard']) &&
    row['standard'] >= SUBSISTENCE &&
    (row['housing'] === 'withFamily' ||
      row['housing'] === 'ownPlace' ||
      row['housing'] === 'owned') &&
    isLifestyleTier(row['lifestyle']) &&
    ['leftHomeAt', 'movedBackAt'].every(
      (key) =>
        row[key] === undefined ||
        (typeof row[key] === 'number' && Number.isInteger(row[key]) && row[key] >= 0),
    )
  );
}
