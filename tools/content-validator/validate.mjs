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

/** Blank out line and block comments, keeping offsets irrelevant — we only match. */
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** Mirrors CRUSH_AGE in `@yearafter/social` and ROMANCE_AGE_FLOOR in the generator. */
const ROMANCE_AGE_FLOOR = 13;
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
    //
    // Comments are stripped first. The check used to run over the raw source
    // and a sentence containing "…skipped the menu: any of those…" tripped it,
    // which is the check being wrong rather than the code: a rule that fires on
    // prose teaches authors to reword their comments to appease the linter,
    // which is worse than not having the rule.
    const anyMatch = stripComments(source).match(/:\s*any\b|<any>|as any\b/);
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
// 3b. Gig catalog (Ticket 0206b)
// ---------------------------------------------------------------------------
// The generator checks all of this before it writes the file. This is the copy
// that runs in CI, because the JSON ships and can be hand-edited.

const gigsPath = join(ROOT, 'packages/content/data/gigs.json');
if (existsSync(gigsPath)) {
  const rel = 'packages/content/data/gigs.json';
  try {
    const gigs = JSON.parse(readFileSync(gigsPath, 'utf8')).entries ?? [];
    for (const gig of gigs) {
      if (!(gig.ageMin <= gig.ageMax)) fail(rel, `${gig.id}: inverted age range.`);
      if (!(gig.payLow > 0 && gig.payLow <= gig.payHigh)) {
        fail(rel, `${gig.id}: pay must be positive and not inverted.`);
      }
      // CORE_RULES 13.6 — money names its source AND its amount, and for a gig
      // the amount lives in the line the player actually reads.
      if (!gig.source) fail(rel, `${gig.id}: money with no source.`);
      for (const line of gig.lines ?? []) {
        if (!String(line).includes('\${amount}')) {
          fail(rel, `${gig.id}: "${line}" never says what it paid.`);
        }
      }
    }
    // A screen that is empty at some age teaches the player not to open it.
    for (const age of [8, 10, 12, 14, 16, 17]) {
      if (!gigs.some((gig) => gig.ageMin <= age && age <= gig.ageMax)) {
        fail(rel, `nothing a ${age}-year-old can do for money.`);
      }
    }
  } catch (cause) {
    fail(rel, `Could not read the gig catalog: ${cause.message}`);
  }
}

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

    // ---- the decision-writing rules (Ticket 0203b) ------------------------
    // claude/event-writing-rules.md, approved after review. These are the half
    // that cannot be left to writing discipline across 340 events.
    const INCIDENTAL = new Set(['kid', 'kid2', 'adult']);
    const PRONOUNS = new Set(['they', 'them', 'their']);
    /**
     * An incidental person's own pronoun tokens, and who each belongs to.
     *
     * Review found "You told Lucía exactly what you thought of him." Incidental
     * names are drawn from the culture's male AND female lists, so a bare
     * "he"/"she" in a line that names one of these people is wrong half the
     * time. Their pronouns have to be tokens.
     */
    const PERSON_OF = new Map([...INCIDENTAL].map((token) => [token, token]));
    for (const person of INCIDENTAL) {
      for (const grammaticalCase of ['They', 'Them', 'Their']) {
        PERSON_OF.set(`${person}${grammaticalCase}`, person);
      }
    }
    const BARE_PRONOUN = /\b(he|him|his|she|her|hers)\b/i;
    /** A capitalised token is the same token at the start of a sentence. */
    const norm = (token) => token.charAt(0).toLowerCase() + token.slice(1);
    const NOISE = new Set(['the', 'a', 'an', 'to', 'for', 'it', 'them', 'your', 'my', 's']);
    const TOKENS = /\{([a-zA-Z0-9]+)\}/g;
    const stem = (label) =>
      label
        .replace(/\{[a-zA-Z0-9]+\}/g, ' ')
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.replace(/[^a-z]/g, ''))
        .filter((word) => word && !NOISE.has(word))
        .slice(0, 2)
        .join(' ');

    // Counted across the whole catalog for the both-directions check below.
    let stressUp = 0;
    let stressDown = 0;

    for (const event of events) {
      const decision = event.type === 'decision' || event.type === 'opportunity';
      const choices = event.choices ?? [];

      // V1 — three options, or an explicit note that two is the honest number.
      if (decision && choices.length < 3 && !event.binaryOk) {
        fail(rel, `${event.id}: ${choices.length} options. Three or more, or set binaryOk.`);
      }

      // V2 — different tactics, not one tactic at two volumes.
      if (decision) {
        const seen = new Set();
        for (const choice of choices) {
          const key = stem(choice.label);
          if (key && seen.has(key)) {
            fail(rel, `${event.id}: two options open with "${key}" — same tactic, two volumes.`);
          }
          seen.add(key);
        }
      }

      // Every result a decision can produce, choice effects folded in.
      const results = [];
      for (const choice of choices) {
        if (choice.text) results.push({ text: choice.text, effects: choice.effects ?? {} });
        for (const outcome of choice.outcomes ?? []) {
          results.push({
            text: outcome.text,
            effects: { ...(choice.effects ?? {}), ...(outcome.effects ?? {}) },
          });
        }
      }

      // V3 — happiness moves, and it can go badly.
      if (decision && results.length > 0) {
        const happiness = results.map((r) => r.effects.stats?.happiness ?? 0);
        if (!happiness.some((value) => value !== 0)) {
          fail(rel, `${event.id}: no result moves happiness.`);
        }
        if (Math.min(...happiness) >= 0) {
          fail(rel, `${event.id}: every result is neutral or better — it cannot land badly.`);
        }
        if (event.physical && !results.some((r) => r.effects.stats?.health)) {
          fail(rel, `${event.id}: marked physical but no result moves health.`);
        }
      }

      // V4 — money names its source, and the amount appears in the prose.
      const checkCash = (cash, text, where) => {
        if (!cash) return;
        if (typeof cash !== 'object' || typeof cash.delta !== 'number') {
          fail(rel, `${where}: cash must be { delta, source }.`);
          return;
        }
        if (!cash.source || !String(cash.source).trim()) {
          fail(rel, `${where}: moves $${cash.delta} with no source.`);
        }
        const amount = Math.abs(cash.delta);
        const written = [`$${amount}`, `$${amount.toLocaleString('en-US')}`];
        if (!written.some((form) => (text ?? '').includes(form))) {
          fail(rel, `${where}: moves $${amount} but the visible text never says so.`);
        }
      };
      checkCash(event.effects?.cash, (event.text ?? []).join(' '), event.id);
      for (const choice of choices) {
        if (choice.text) checkCash(choice.effects?.cash, choice.text, `${event.id}/${choice.id}`);
        for (const outcome of choice.outcomes ?? []) {
          checkCash(
            { ...(choice.effects ?? {}), ...(outcome.effects ?? {}) }.cash,
            outcome.text,
            `${event.id}/${choice.id} outcome`,
          );
        }
      }

      // V7 — anything that SPENDS is gated on having the money (Ticket 0206b).
      // Reading output found a fourteen-year-old holding $60 told "the coffee
      // can under your bed has $150 in it", spending it, and finishing on $0:
      // the balance floored and the sentence lied about it.
      let biggestSpend = 0;
      for (const source of [
        event.effects,
        ...choices.map((choice) => choice.effects),
        ...choices.flatMap((choice) => (choice.outcomes ?? []).map((o) => o.effects)),
      ]) {
        const delta = source?.cash?.delta ?? 0;
        if (delta < 0) biggestSpend = Math.max(biggestSpend, -delta);
      }
      if (biggestSpend > 0) {
        const gate = event.eligibility?.cashAtLeast ?? 0;
        if (gate < biggestSpend) {
          fail(
            rel,
            `${event.id}: can spend $${biggestSpend} but is only gated on $${gate}. ` +
              `An event that spends what the character does not have floors the balance ` +
              `at zero and tells them they spent it.`,
          );
        }
      }

      // V8 — nothing romantic is eligible below the crush age (Ticket 0207).
      //
      // The age gate in the engine is enforced twice already; this is the third
      // place it can be broken, and the only one that is a data file. A `love.`
      // event with no `ageMin` would be eligible from birth, and no test that
      // plays the engine would ever catch it because the engine is not what is
      // wrong. It is checked by id prefix rather than by reading the copy on
      // purpose: a prefix is a promise the author makes and this is the thing
      // that holds them to it.
      if (event.id.startsWith('love.')) {
        const floor = event.eligibility?.ageMin;
        if (floor === undefined || floor < ROMANCE_AGE_FLOOR) {
          fail(
            rel,
            `${event.id}: a romance event must be gated at ageMin >= ${ROMANCE_AGE_FLOOR}, ` +
              `got ${floor ?? 'nothing'}. This is a safety rule, not a balance knob.`,
          );
        }
      }

      // V6 — stress is in range and goes BOTH ways (Ticket 0205).
      // A catalog whose stress effects are all positive turns the system into a
      // ratchet every character loses by eighteen, which is the separate
      // visible mental-health system spec 1030 forbids under another name.
      const checkStress = (effects, where) => {
        const stress = effects?.stress;
        if (stress === undefined) return;
        if (typeof stress !== 'number' || !Number.isInteger(stress)) {
          fail(rel, `${where}: stress must be a whole number.`);
          return;
        }
        if (stress === 0) fail(rel, `${where}: a stress effect of 0 should be omitted.`);
        if (stress < -25 || stress > 40) fail(rel, `${where}: stress ${stress} is out of range.`);
        if (stress > 0) stressUp += 1;
        if (stress < 0) stressDown += 1;
      };
      checkStress(event.effects, event.id);
      for (const choice of choices) {
        checkStress(choice.effects, `${event.id}/${choice.id}`);
        for (const outcome of choice.outcomes ?? []) {
          checkStress(outcome.effects, `${event.id}/${choice.id} outcome`);
        }
      }

      // V5 — a decision declares every person it names, so one name carries
      // through the prompt, the options and the outcome.
      const lines = [
        ...(event.text ?? []),
        ...choices.flatMap((choice) => [
          choice.label,
          ...(choice.text ? [choice.text] : []),
          ...(choice.outcomes ?? []).map((outcome) => outcome.text),
        ]),
      ];
      const used = new Set();
      for (const line of lines) {
        const tokens = new Set([...String(line).matchAll(TOKENS)].map((match) => norm(match[1])));
        for (const token of tokens) if (PERSON_OF.has(token)) used.add(PERSON_OF.get(token));
        const namesSomeone = [...tokens].some((token) => PERSON_OF.has(token));
        const usesPronoun = [...tokens].some((token) => PRONOUNS.has(token));
        if (namesSomeone && usesPronoun) {
          fail(
            rel,
            `${event.id}: "${line}" names somebody and uses a player pronoun — ` +
              `{they}/{them}/{their} are the PLAYER's, so this renders the wrong gender.`,
          );
        }
        if (namesSomeone && BARE_PRONOUN.test(String(line).replace(TOKENS, ' '))) {
          fail(
            rel,
            `${event.id}: "${line}" names an incidental person and then writes a bare ` +
              `'he'/'she'. The name is drawn from both lists, so use ` +
              `{kidThey}/{kidThem}/{kidTheir} (or the kid2/adult forms).`,
          );
        }
      }
      const declared = new Set(event.personTokens ?? []);
      if (decision) {
        for (const token of used) {
          if (!declared.has(token)) {
            fail(
              rel,
              `${event.id}: uses {${token}} but does not declare it in personTokens, so the ` +
                `prompt and the outcome would name different people.`,
            );
          }
        }
        for (const token of declared) {
          if (!used.has(token)) fail(rel, `${event.id}: declares {${token}} but never uses it.`);
        }
      }
    }

    // Stress must be able to go DOWN as well as up. A catalog where every
    // stress effect is positive makes the system a ratchet, and a ratchet is a
    // second health bar every character loses by eighteen.
    if (stressUp > 0 && stressDown < Math.max(4, stressUp / 4)) {
      fail(
        rel,
        `${stressUp} events add stress and only ${stressDown} relieve it. Stress must ` +
          `be escapable — write the restful years too (Ticket 0205).`,
      );
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
// 6. Activity catalog (Ticket 0204)
// ---------------------------------------------------------------------------

const activitiesPath = join(ROOT, 'packages/content/data/activities.json');

if (existsSync(activitiesPath)) {
  const rel = 'packages/content/data/activities.json';
  try {
    const activities = JSON.parse(readFileSync(activitiesPath, 'utf8')).entries ?? [];
    const stages = ['elementary', 'middle', 'high'];

    for (const activity of activities) {
      // Money never moves without a sentence saying where it went. This is the
      // structural half of that rule — a cost with no source cannot ship.
      if (activity.annualCost && !activity.costSource) {
        fail(rel, `${activity.id}: costs money but names no source.`);
      }
      if (activity.costSource && !activity.annualCost) {
        fail(rel, `${activity.id}: names a cost source but costs nothing.`);
      }
      if (!(activity.hoursPerWeek > 0)) {
        fail(
          rel,
          `${activity.id}: hoursPerWeek must be greater than zero — it is the only thing that limits how many a character can hold.`,
        );
      }
      if (!activity.effects || Object.keys(activity.effects).length === 0) {
        fail(rel, `${activity.id}: does nothing.`);
      }
      if ((activity.blurb ?? '').length > 52) {
        fail(
          rel,
          `${activity.id}: blurb truncates on a phone (${activity.blurb.length} chars, max 52).`,
        );
      }
    }

    for (const stage of stages) {
      const available = activities.filter((a) => (a.requires?.stages ?? []).includes(stage));
      if (available.length < 6) {
        fail(rel, `stage "${stage}" offers only ${available.length} activities (need 6).`);
      }
      const free = available.filter((a) => !a.annualCost && !a.requires?.wealthAny);
      if (free.length < 4) {
        fail(
          rel,
          `stage "${stage}" has only ${free.length} activities that cost nothing (need 4) — a struggling household would find the menu mostly closed.`,
        );
      }
    }
  } catch (cause) {
    fail(rel, `Could not validate the activity catalog: ${cause.message}`);
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
