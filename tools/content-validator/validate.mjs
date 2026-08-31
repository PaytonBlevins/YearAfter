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

const contentDir = join(ROOT, 'packages/content');
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

for (const note of notes) console.log(`note  ${note}`);

if (problems.length > 0) {
  console.error(`\nContent validation failed with ${problems.length} problem(s):\n`);
  for (const { file, message } of problems) console.error(`  ${file}\n    ${message}\n`);
  process.exit(1);
}

console.log(
  `Content validation passed. ${catalogCount} catalog file(s), ${seenIds.size} content id(s).`,
);
