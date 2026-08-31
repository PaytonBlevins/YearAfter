#!/usr/bin/env node
/**
 * Content and canonical-rule validator (spec 1213–1223, 1247–1263).
 *
 * Runs in CI on every branch and blocks merge on failure. Two jobs:
 *
 *  1. Validate content catalogs — stable IDs, no duplicates, no dangling
 *     cross-references. (No catalogs exist yet; the walker is ready for them.)
 *  2. Enforce canonical rules that are cheap to check statically and expensive
 *     to notice late — a stray `Math.random()` in game logic silently destroys
 *     save reproducibility and every golden-life test.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const problems = [];
const notes = [];

const fail = (file, message) => problems.push({ file, message });

function walk(dir, onFile) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', '.turbo', '.expo', '.git'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}

// ---------------------------------------------------------------------------
// 1. Canonical rule checks over source
// ---------------------------------------------------------------------------

const SOURCE_ROOTS = [join(ROOT, 'packages'), join(ROOT, 'apps')];

for (const root of SOURCE_ROOTS) {
  walk(root, (file) => {
    if (!['.ts', '.tsx'].includes(extname(file))) return;
    const rel = relative(ROOT, file);
    const source = readFileSync(file, 'utf8');
    const isTest = /\.(test|spec)\.tsx?$/.test(rel);

    // CORE_RULES 5 — Math.random() is banned outside the one seed generator.
    if (source.includes('Math.random()') && !rel.endsWith('rng/rng.ts')) {
      fail(rel, 'Math.random() is banned in game logic. Use Rng.stream(domain).');
    }

    // CORE_RULES 17 — no `any`.
    const anyMatch = source.match(/:\s*any\b|<any>|as any\b/);
    if (anyMatch && !isTest) {
      fail(rel, `\`any\` is not allowed (found "${anyMatch[0].trim()}").`);
    }

    // CORE_RULES 17 — no cross-package deep imports.
    const deepImport = source.match(/from '@yearafter\/[a-z-]+\/(?!sqlite)[^']+'/);
    if (deepImport) {
      fail(rel, `Deep import into another package: ${deepImport[0]}. Use its public API.`);
    }

    // Spec 1247-1263 — placeholder work must be labelled, not silently shipped.
    if (/\bTODO\b(?!:)/.test(source)) {
      notes.push(`${rel}: bare TODO — prefer "TODO(ticket NNNN): ..." so it is traceable.`);
    }
  });
}

// ---------------------------------------------------------------------------
// 2. Canonical set checks — these fail loudly if someone edits a fixed list
// ---------------------------------------------------------------------------

const statsFile = join(ROOT, 'packages/character/src/stats.ts');
if (existsSync(statsFile)) {
  const source = readFileSync(statsFile, 'utf8');
  const block = source.match(/VISIBLE_STAT_KEYS\s*=\s*\[([\s\S]*?)\]/);
  const keys = block ? [...block[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : [];
  const expected = [
    'happiness',
    'health',
    'smarts',
    'looks',
    'charisma',
    'willpower',
    'discipline',
  ];
  if (keys.join(',') !== expected.join(',')) {
    fail(
      'packages/character/src/stats.ts',
      `Visible stats must be exactly [${expected.join(', ')}] (CORE_RULES 3). Found [${keys.join(', ')}].`,
    );
  }
}

const talentsFile = join(ROOT, 'packages/character/src/talents.ts');
if (existsSync(talentsFile)) {
  const source = readFileSync(talentsFile, 'utf8');
  const block = source.match(/TALENT_KEYS\s*=\s*\[([\s\S]*?)\]/);
  const keys = block ? [...block[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort() : [];
  const expected = ['academics', 'acting', 'athletics', 'crime', 'inventive', 'music', 'writing'];
  if (keys.join(',') !== expected.join(',')) {
    fail(
      'packages/character/src/talents.ts',
      `Talents must be exactly [${expected.join(', ')}] (CORE_RULES 4). Found [${keys.join(', ')}].`,
    );
  }
  if (/TalentStrength|talentLevel|talentPower/.test(source)) {
    fail(
      'packages/character/src/talents.ts',
      'Talents are Boolean only — no numeric strength (spec 1070).',
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Content catalogs
// ---------------------------------------------------------------------------

// Only `data/` directories hold catalogs. Walking a whole package would treat
// package.json and tsconfig.json as malformed content.
const contentDir = join(ROOT, 'packages/content/data');
let catalogCount = 0;
const seenIds = new Map();

walk(contentDir, (file) => {
  if (extname(file) !== '.json') return;
  const rel = relative(ROOT, file);
  catalogCount += 1;
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (cause) {
    fail(rel, `Invalid JSON: ${cause.message}`);
    return;
  }
  const entries = Array.isArray(data) ? data : Array.isArray(data.entries) ? data.entries : null;
  if (!entries) {
    fail(rel, 'Catalog must be an array or an object with an "entries" array.');
    return;
  }
  for (const entry of entries) {
    if (typeof entry?.id !== 'string' || entry.id.length === 0) {
      fail(
        rel,
        `Catalog entry is missing a stable string id: ${JSON.stringify(entry)?.slice(0, 80)}`,
      );
      continue;
    }
    const previous = seenIds.get(entry.id);
    if (previous) fail(rel, `Duplicate content id "${entry.id}" (also in ${previous}).`);
    else seenIds.set(entry.id, rel);
  }
});

// ---------------------------------------------------------------------------
// 4. Cross-references between catalogs
// ---------------------------------------------------------------------------
// Spec 1213-1223 asks for cross-references to be validated automatically. A city
// pointing at a name culture that does not exist would throw during character
// generation, which is far too late to find out.

const locationsPath = join(ROOT, 'packages/content/data/locations.json');
const namesPath = join(ROOT, 'packages/content/data/names.json');

if (existsSync(locationsPath) && existsSync(namesPath)) {
  try {
    const cities = JSON.parse(readFileSync(locationsPath, 'utf8')).entries ?? [];
    const cultures = new Set(
      (JSON.parse(readFileSync(namesPath, 'utf8')).entries ?? []).map((entry) => entry.id),
    );
    for (const city of cities) {
      for (const ref of city.nameCultures ?? []) {
        if (!cultures.has(ref.culture)) {
          fail(
            'packages/content/data/locations.json',
            `City "${city.id}" references unknown name culture "${ref.culture}".`,
          );
        }
      }
      if (!(city.weight > 0)) {
        fail(
          'packages/content/data/locations.json',
          `City "${city.id}" needs a birth weight greater than zero.`,
        );
      }
    }
  } catch (cause) {
    fail('packages/content/data', `Could not cross-check catalogs: ${cause.message}`);
  }
}

// ---------------------------------------------------------------------------
// 5. Event catalog (Ticket 0203)
// ---------------------------------------------------------------------------
// The Python generator checks all of this before it writes the file, and the
// content package tests it too. It is here as well because this is the gate CI
// runs on a hand-edited JSON, and an unreachable event is invisible until a
// player fails to see it.

const eventsPath = join(ROOT, 'packages/content/data/events-childhood.json');

if (existsSync(eventsPath)) {
  const rel = 'packages/content/data/events-childhood.json';
  try {
    const events = JSON.parse(readFileSync(eventsPath, 'utf8')).entries ?? [];
    const byId = new Map(events.map((event) => [event.id, event]));
    const categories = new Set(['family', 'school', 'friendship', 'random', 'talent']);
    const types = new Set(['passive', 'decision', 'opportunity', 'followUp']);
    const rarities = new Set([
      'common',
      'uncommon',
      'rare',
      'veryRare',
      'exceptional',
      'legendary',
    ]);
    const scheduled = new Set();

    const followUpsOf = (event) => [
      ...(event.followUp ? [event.followUp] : []),
      ...(event.choices ?? []).flatMap((choice) => [
        ...(choice.followUp ? [choice.followUp] : []),
        ...(choice.outcomes ?? []).flatMap((o) => (o.followUp ? [o.followUp] : [])),
      ]),
    ];

    for (const event of events) {
      if (!categories.has(event.category))
        fail(rel, `${event.id}: unknown category "${event.category}".`);
      if (!types.has(event.type)) fail(rel, `${event.id}: unknown type "${event.type}".`);
      if (!rarities.has(event.rarity)) fail(rel, `${event.id}: unknown rarity "${event.rarity}".`);
      if (!(event.weight > 0)) fail(rel, `${event.id}: weight must be greater than zero.`);
      if (!Array.isArray(event.text) || event.text.length === 0) {
        fail(rel, `${event.id}: needs at least one text variant.`);
      }

      const { ageMin, ageMax } = event.eligibility ?? {};
      if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
        fail(rel, `${event.id}: age window ${ageMin}..${ageMax} can never be satisfied.`);
      }

      const isDecision = event.type === 'decision' || event.type === 'opportunity';
      const choices = event.choices ?? [];
      if (isDecision && choices.filter((choice) => !choice.requires).length < 2) {
        fail(rel, `${event.id}: a ${event.type} needs two always-available choices.`);
      }
      if (!isDecision && choices.length > 0) {
        fail(rel, `${event.id}: type "${event.type}" must not carry choices.`);
      }
      for (const choice of choices) {
        if (Boolean(choice.text) === Boolean(choice.outcomes)) {
          fail(rel, `${event.id}/${choice.id}: needs exactly one of "text" or "outcomes".`);
        }
      }

      for (const follow of followUpsOf(event)) {
        scheduled.add(follow.eventId);
        const target = byId.get(follow.eventId);
        if (!target)
          fail(rel, `${event.id}: follow-up points at unknown event "${follow.eventId}".`);
        else if (target.type !== 'followUp') {
          fail(rel, `${event.id}: follow-up target "${follow.eventId}" is not type "followUp".`);
        }
      }
    }

    for (const event of events) {
      if (event.type === 'followUp' && !scheduled.has(event.id)) {
        fail(rel, `${event.id}: type "followUp" but nothing schedules it — dead content.`);
      }
    }

    // A year with no eligible event throws in advanceYear. This is the check
    // that stops a catalog edit turning that into a crash in a player's hands.
    for (const age of [0, 1, 2, 3, 4, 5, 8, 12, 17, 18, 40, 80, 110]) {
      const universal = events.filter((event) => {
        const e = event.eligibility ?? {};
        if (event.type !== 'passive') return false;
        if ((e.ageMin ?? 0) > age || (e.ageMax ?? 130) < age) return false;
        return ![
          'requires',
          'talentsAny',
          'wealthAny',
          'statAtLeast',
          'statAtMost',
          'flagsAll',
          'relationshipAtLeast',
          'relationshipAtMost',
          'sex',
        ].some((key) => key in e);
      });
      if (universal.length < 4) {
        fail(
          rel,
          `age ${age}: only ${universal.length} passive events are available to every character. ` +
            `A life could render an empty year, which throws in advanceYear.`,
        );
      }
    }

    if (events.length < 250) {
      fail(rel, `only ${events.length} events; the approved target for ticket 0203 is 250-500.`);
    }
  } catch (cause) {
    fail(rel, `Could not validate the event catalog: ${cause.message}`);
  }
}

// ---------------------------------------------------------------------------

for (const note of notes) console.log(`note  ${note}`);

if (problems.length > 0) {
  console.error(`\nContent validation failed with ${problems.length} problem(s):\n`);
  for (const { file, message } of problems) console.error(`  ${file}\n    ${message}\n`);
  process.exit(1);
}

console.log(
  `Content validation passed. ${catalogCount} catalog file(s), ${seenIds.size} content id(s).`,
);
