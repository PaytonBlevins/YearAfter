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

/**
 * Labels review rejected by name, plus the ones the same pass found beside them.
 *
 * Blocked exactly rather than by pattern: "Leave it" is fine under a prompt
 * about a wallet and useless on a standing menu, and a regex cannot tell those
 * apart. A list somebody has to consciously edit is the honest enforcement.
 */
const VAGUE_LABELS = [
  'tell them something',
  'have it out with them',
  'something drastic',
  'the usual',
  'the hard one',
  'the loudest one on the table',
  'do it',
  'try it',
  'take it',
  'keep it',
  'move up',
  'serve it',
  'coast',
  'fight it',
  'step in',
  'walk out',
  'lose it',
  'go',
  'pass',
  'apply',
  'enter it',
  'refuse',
];

/**
 * British spelling and idiom in player-facing copy (Ticket 0207d).
 *
 * The game is written in American English. This is not pedantry: "wind them
 * up", "have it out with them", "a fortnight", "maths" and "pavement" all
 * appeared in shipped copy and all of them cost a US player a beat of decoding,
 * which is the exact failure review reported.
 *
 * Checked against the RENDERED catalog, never the generator source, because
 * event IDs are stable forever and several of them legitimately contain
 * `favourite` and `neighbour` — a blanket rewrite of the source renamed five of
 * them and broke every save that referenced one.
 */
/**
 * Ticket 0211b — forms a person contracts when they speak.
 *
 * Kept short and unambiguous. Every entry here is one a human being contracts
 * essentially always in conversation, which is what makes the expanded form
 * read as narration rather than speech. "Should not" and "must not" are absent
 * on purpose: those DO get said in full, and a rule that fires on a legitimate
 * line teaches the next author to work around it rather than to write better.
 */
const EXPANDED = [
  ['did not', "didn't"],
  ['does not', "doesn't"],
  ['do not', "don't"],
  ['was not', "wasn't"],
  ['were not', "weren't"],
  ['is not', "isn't"],
  ['are not', "aren't"],
  ['could not', "couldn't"],
  ['would not', "wouldn't"],
  ['had not', "hadn't"],
  ['has not', "hasn't"],
  ['have not', "haven't"],
  ['will not', "won't"],
  ['it is not', "it isn't"],
];

/**
 * Ticket 0211b — the constructions that summarise instead of happening.
 *
 * Every one of these is lifted from a line the product owner quoted back, or
 * from the same paragraph as one. They share a shape: they describe the
 * CHARACTER of an event rather than the event, which reads as a novelist
 * narrating and not as something a person would say about their own year.
 *
 *   "A steady year. The kind that does not make it into the telling."
 *   "Another year went by without much fanfare."
 *   "It stopped, and it cost you nothing you could measure."
 *
 * The fix is always the same and always available: name a real detail. "Same
 * job, same apartment, same weekends."
 */
const VAGUE = [
  /\bthe kind (?:that|of)\b/i,
  /\bwithout much fanfare\b/i,
  /\bin the way (?:they|it|that)\b/i,
  /\bwhich was (?:its own|somehow) [a-z]/i,
  /\bnothing you could measure\b/i,
  /\bits own kind of\b/i,
  /\bwhich counted\b/i,
  /\bit did not entirely\b/i,
  /\bmuch as you\b/i,
];

const BRITISH = [
  // STEMS, not whole words. The first version listed 'apologise' and shipped a
  // line reading "spent all of it apologising to furniture" — `\bapologise`
  // does not match `apologising`, so the check passed and reading the built app
  // caught it instead. A word list that only knows one inflection is a word
  // list that mostly does not work.
  ['apologis', 'apologiz'],
  ['realis', 'realiz'],
  ['recognis', 'recogniz'],
  ['organis', 'organiz'],
  ['practis', 'practic'],
  ['favourit', 'favorit'],
  ['neighbour', 'neighbor'],
  ['behaviour', 'behavior'],
  ['colour', 'color'],
  ['maths', 'math'],
  ['licence', 'license'],
  ['pavement', 'sidewalk'],
  ['corridor', 'hallway'],
  ['fortnight', 'two weeks'],
  ['whilst', 'while'],
  // Reading a played childhood found both of these shipping in player-facing
  // copy with a green validator: "researched it with genuine rigour" and "the
  // garden centre". A word list is only as good as the last time somebody read
  // the output — which is the whole argument for reading the output.
  ['rigour', 'rigor'],
  ['centre', 'center'],
  ['theatre', 'theater'],
  // `\b${stem}` cannot see inside a compound, exactly as it could not see
  // inside `apologising`. "hair grows about a centimetre a month" shipped past
  // a list that contained `metre`.
  ['metre', 'meter'],
  ['centimetre', 'inch'],
  ['millimetre', 'inch'],
  ['kilometre', 'mile'],
  ['kilogram', 'pound'],
  ['aluminium', 'aluminum'],
  ['grey', 'gray'],
  ['jumper', 'sweater'],
  ['torch', 'flashlight'],
  ['queue', 'line'],
  // NOT bare 'holiday'. It has two senses and only one of them is British: a
  // trip ("on holiday") is, a day off work ("a national holiday") is ordinary
  // American English. The bare entry is what MADE the 0211b defect — it
  // rejected the correct word and the sweep obligingly wrote "public vacation".
  // Scope the rule to the sense, or the rule writes the bug (CORE_RULES 13.35).
  ['on holiday', 'on vacation'],
  ['summer holidays', 'summer vacation'],
  ['school holidays', 'school vacation'],
  ['family holiday', 'family vacation'],
  ['holiday home', 'vacation home'],
  ['learnt', 'learned'],
  ['amongst', 'among'],
  ['solicitor', 'lawyer'],
  ['fringe', 'bangs'],
  ['jumper', 'sweater'],
  ['trainers', 'sneakers'],
  ['biscuit', 'cookie'],
  ['petrol', 'gas'],
  ['crisps', 'chips'],
  ['sweets', 'candy'],
  ['chemist', 'pharmacy'],
  ['timetable', 'schedule'],
  ['headteacher', 'principal'],
  ['telly', 'TV'],
  ['bloke', 'guy'],
  ['straight away', 'right away'],
  ['at the weekend', 'on the weekend'],
  ['in hospital', 'in the hospital'],
  ['sports hall', 'gym'],
  ['car park', 'parking lot'],
  // Ticket 0211b, found by reading a played childhood — both had shipped since
  // 0203b and neither was on any list. "on the coach" is a school bus; the
  // BARE word is not flagged, because a sports coach is the more common sense
  // in this game and a rule that fires on correct copy is a rule somebody
  // deletes (13.35).
  ['year group', 'grade'],
  ['on the coach', 'on the bus'],
  ['by coach', 'by bus'],
  // NOT 'trial': "a trial run" for a dog is ordinary English, and the tryout
  // sense is the only British one. A rule that fires on correct copy is a rule
  // somebody deletes, which is worse than not having it.
  ['wind them up', 'annoy them'],
];
/**
 * Words 0207d's Americanisation swept in, in positions they cannot occupy.
 *
 * `apartment` is a noun and cannot follow "completely"; `bangs` is plural and
 * cannot follow "a". Both shipped, and both read as perfect American English to
 * every rule that was looking for British English — which is why this looks at
 * grammar rather than at vocabulary.
 *
 * Ticket 0211b found a FOURTH, three tickets after the first three, by reading a
 * played childhood: *"Slept through the night for the first time. The household
 * treated it as a public vacation."* That is `holiday` → `vacation` landing on
 * the wrong sense, and it is grammatical, so the two shapes above could never
 * see it. The third arm below is therefore about COLLOCATION rather than
 * grammar: `vacation` is the time off, `holiday` is the day itself, and the
 * modifiers that pick out a day never take `vacation`.
 *
 * `summer vacation` and `school vacation` are deliberately absent — those are
 * ordinary American English, and a rule that fires on correct copy is a rule
 * somebody deletes.
 */
const SWEPT_IN = new RegExp(
  '\\b(?:completely|entirely|absolutely|perfectly|totally)\\s+' +
    '(?:apartment|sweater|flashlight|sidewalk|hallway|vacation|cookie|candy)\\b' +
    '|\\ba\\s+(?:bangs|sneakers|trousers|scissors|chips)\\b' +
    '|\\b(?:public|bank|national|federal|legal|religious)\\s+vacation\\b' +
    '|\\bvacation\\s+(?:season|spirit|cheer|decorations)\\b',
  'gi',
);

/**
 * Tokens whose rendered value is lowercase, so they cannot open a sentence.
 *
 * NOT `parent`, `adult` or `city`: those render "Mom", a given name and a city
 * name, all capitalized. Only their FALLBACKS are lowercase, and the catalog
 * test makes a fallback unreachable — flagging them would be the validator
 * firing on correct copy, which is the failure mode V10's comment warns about.
 */
const LOWERCASE_TOKENS = new Set(['siblingRel']);

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

    // V12 — American English in the copy tables, not just the catalog.
    //
    // The 0207d rule checked the RENDERED catalog only, which was right for the
    // reason V10 gives and left half the game's player-facing prose unchecked:
    // reading 0209's output found "a fortnight", "a corridor" and "solicitors"
    // shipping from `romantic.ts`, which is a TypeScript table rather than a
    // JSON catalog.
    //
    // Only literals with a space in them are checked, which is what keeps V10's
    // problem from coming back: an event id or a key never contains a space, so
    // an id like `random.favourite-teacher` cannot trip this and get renamed.
    // Comments are stripped first, for the reason the `any` rule strips them.
    if (!isTest) {
      for (const literal of stripComments(source).matchAll(/(['"`])((?:[^\\\n]|\\.)*?)\1/g)) {
        const copy = literal[2];
        // Prose only. A match that starts mid-expression is the regex having
        // run from one string's closing quote to the next string's opening one
        // — `'alternative' && behaviour <= THRESHOLD` is not copy, it is two
        // quotes with code between them. A player-facing line starts with a
        // capital or a token and ends in sentence punctuation.
        if (!/^[A-Z{$]/.test(copy) || !/[.!?…]$/.test(copy) || /\n/.test(copy)) continue;
        for (const [british, american] of BRITISH) {
          if (new RegExp(`\\b${british}`, 'i').test(copy)) {
            fail(rel, `"${british}" is British — use "${american}" — in: ${copy.slice(0, 70)}`);
          }
        }
      }
    }

    // V16 — contractions, because rule 7 asked for them and nothing checked.
    //
    // `event-writing-rules.md` rule 7 has said "use contractions" since 0207d.
    // Measured at the start of 0211b: SEVEN of 455 catalog strings used one,
    // and forty-five spelled them out. The product owner, reading his own feed:
    // *"These texts are so awkward... Nobody talks like that."*
    //
    // That is the CORE_RULES 13.33 shape in the writing rules — a rule kept by
    // every author separately is not a rule, it is a hope, and this one went
    // four tickets before anybody measured it. So it is a check now.
    //
    // Narrow on purpose. It fires only on the handful of two-word forms that a
    // person always contracts in speech, and only inside prose (V12's literal
    // test). "Do not" as an instruction on a button is legitimate and rare
    // enough to write around; "did not" in a story line never is.
    if (!isTest) {
      for (const literal of stripComments(source).matchAll(/(['"`])((?:[^\\\n]|\\.)*?)\1/g)) {
        const copy = literal[2];
        if (!/^[A-Z{$]/.test(copy) || !/[.!?…]$/.test(copy) || /\n/.test(copy)) continue;
        for (const [expanded, contracted] of EXPANDED) {
          if (new RegExp(`\\b${expanded}\\b`, 'i').test(copy)) {
            fail(
              rel,
              `"${expanded}" reads as written rather than spoken — use "${contracted}" — ` +
                `in: ${copy.slice(0, 70)}`,
            );
          }
        }
        for (const vague of VAGUE) {
          if (vague.test(copy)) {
            fail(
              rel,
              `"${copy.match(vague)?.[0]}" is a summary rather than a thing that ` +
                `happened — name a real detail — in: ${copy.slice(0, 70)}`,
            );
          }
        }
      }
    }

    // V14 — a ticket number never reaches the player.
    //
    // Two shipped: "What your parents decide on their own is Ticket 0209" on the
    // family screen and "Real jobs arrive with Ticket 0210" on the gigs screen.
    // Both were honest notes to a developer that a player reads as the game
    // talking about itself, and the first was still there after 0209 shipped.
    // Comments are stripped first, so the rule sees only JSX text and string
    // literals — a ticket reference in a header comment is documentation and
    // stays welcome.
    //
    // Ticket 0211b: the literal form was only half the rule. `Ticket ${row.ticket}`
    // has no four-digit number in it, so twenty-eight unbuilt rows on the
    // Activities, Assets and Mind & Body screens rendered "Ticket 0901",
    // "Ticket 1003", "Ticket 0212" straight to a forty-year-old player, for six
    // tickets after 13.24 was written about exactly this. A rule that matches
    // the string a developer typed and not the string a player reads is half a
    // rule (13.23, 13.35). It now matches the interpolation too.
    if (rel.startsWith('apps/') && /Ticket\s+(?:\d{4}|\$\{)/.test(stripComments(source))) {
      fail(rel, 'a ticket number appears in player-facing text. Say what the screen does instead.');
    }

    // V17 — a spec citation never reaches the player either.
    //
    // Same ticket, same screens, same class: "15 rows — within the 10–16 target
    // (spec 879–943)" and "Martial Arts lives here, not as a top-level activity
    // (spec 879–943)" were notes to a reviewer rendered underneath a player's
    // menu. Comments are stripped first, so a spec reference in documentation
    // is untouched — only one that survives into rendered text fails.
    //
    // The developer screen is exempt BY PATH, because it is the one screen
    // whose audience is a developer.
    if (
      rel.startsWith('apps/') &&
      !/DeveloperScreen/i.test(rel) &&
      /\bspec\s+\d{2,4}/i.test(stripComments(source).replace(/DEV_[A-Z_]*/g, ''))
    ) {
      fail(rel, 'a spec reference appears in player-facing text. Cut it or say it in plain words.');
    }

    /*
      V18 — Ticket 0302. Money is only moved by the ledger.

      THE FIRST OF THREE ENFORCEMENT POINTS, and the only one that runs before
      anything is played. The invariant in `advanceYear` catches a drift on the
      year it happens; save validation catches a corrupt document on the way in.
      Both of those need somebody to have PLAYED the defect. This one fails a
      build, which is the only way a bypass never reaches a device at all.

      What it looks for is the exact shape all six pre-0301 producers had:
      arithmetic on a cash field. `add(state.player.cash, wage)` in careers,
      `subtract(player.cash, fee)` in adoption, and four more, each with its own
      idea of the zero floor and none of them writing down what moved or why.
      That is CORE_RULES 13.31 — an invariant kept in six places is six
      promises — and it is the one defect `reconcile` exists to catch after the
      fact. This is the same defect caught before the fact.

      The rule is about ARITHMETIC, not about the word `cash`, because a great
      many honest lines mention cash: a type (`readonly cash: Money`), a
      parameter (`costOf(move, cash)`), a read for an event context
      (`cash: Math.floor(Number(state.player.cash) / 100)`). None of those move
      money and a rule that fired on them would be deleted inside a ticket
      (13.35). A rule scoped to the operation catches the six and none of the
      honest ones.

      `@yearafter/finance` and `simulation/src/money.ts` are exempt by path:
      they are the ledger and its one door, and arithmetic on money is what
      they are for.
    */
    const MAY_DO_MONEY_ARITHMETIC =
      rel.startsWith('packages/finance/') || rel === 'packages/simulation/src/money.ts';
    if (!isTest && !MAY_DO_MONEY_ARITHMETIC) {
      const code = stripComments(source);
      const arithmetic = [
        // add(x.cash, ...) / subtract(player.cash, fee) / negate(state.player.cash)
        /\b(?:add|subtract|negate)\s*\(\s*[A-Za-z_$][\w$.]*\.cash\b/,
        // cash: add(...) — the assignment form, whatever it is added to.
        /\bcash:\s*(?:add|subtract|negate)\s*\(/,
        // player.cash + something, or - something, at the top of an expression.
        // `Number(state.player.cash) / 100` is a READ into dollars and is not
        // matched: the operand is the Number() call, not the cash field.
        /\.cash\s*[-+]\s*[A-Za-z0-9_$(]/,
      ].find((pattern) => pattern.test(code));
      if (arithmetic) {
        fail(
          rel,
          'money arithmetic on a cash field. `player.cash` is a mirror of the ledger — ' +
            'post the transaction through moveMoney() or a phase’s `transactions` and let ' +
            'the balance come out of it (CORE_RULES 13.31, spec 1678).',
        );
      }
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
  // Ticket 0210b. A catalog keyed by something — employers by track — is a
  // legitimate shape and not a list with ids. Flattened here so the id and
  // duplicate checks below still see every string, without pretending the file
  // has an `entries` array it does not have.
  const keyed =
    !Array.isArray(data) && !Array.isArray(data.entries) && typeof data.byTrack === 'object'
      ? Object.values(data.byTrack).flat()
      : null;
  if (keyed) {
    const seen = new Set();
    for (const name of keyed) {
      if (typeof name !== 'string' || name.trim() === '') {
        fail(rel, 'A keyed catalog may only contain non-empty strings.');
      } else if (seen.has(name)) {
        fail(rel, `duplicate entry ${name}`);
      }
      seen.add(name);
    }
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
      /*
        V19 — Ticket 0303. Every city carries a cost of living.

        The generator refuses to emit a city without one, so this is the second
        of the three enforcement points this build uses for content: the
        generator self-check, this validator over the RENDERED catalog, and a
        package test. That shape exists because 0211b found V16 running over
        source files only and missing 593 strings — a rule that checks the
        input and not the output is half a rule (CORE_RULES 13.23).

        The band is checked as well as the presence. A missing index falls back
        to 1.00 at runtime (a save can outlive a catalog entry), which is the
        right behaviour and also the reason a wrong one would never announce
        itself: an index of 16 instead of 1.6 would simply make one city's
        characters destitute for a whole milestone.
      */
      if (typeof city.costIndex !== 'number' || !(city.costIndex >= 0.5 && city.costIndex <= 2)) {
        fail(
          'packages/content/data/locations.json',
          `City "${city.id}" needs a costIndex between 0.5 and 2 (Ticket 0303). Found ${city.costIndex}.`,
        );
      }
    }
    /*
      And the POPULATION has to vary, which presence cannot tell you.

      A catalog where every city sits at 1.00 would pass every check above and
      mean location does not exist — CORE_RULES 13.7, a system nobody can
      trigger. Weighted by birth likelihood, because that is the spread a player
      actually meets: seventy distinct cities turn up in a hundred and twenty
      lives, and if they all cost the same then four of the five things spec
      191-193 names are still doing nothing.
    */
    const totalWeight = cities.reduce((sum, city) => sum + (city.weight ?? 0), 0);
    const meanIndex =
      cities.reduce((sum, city) => sum + (city.weight ?? 0) * (city.costIndex ?? 1), 0) /
      Math.max(1, totalWeight);
    const spread =
      Math.max(...cities.map((city) => city.costIndex ?? 1)) -
      Math.min(...cities.map((city) => city.costIndex ?? 1));
    if (!(spread >= 0.4)) {
      fail(
        'packages/content/data/locations.json',
        `Cost of living barely varies across the catalog (spread ${spread.toFixed(2)}). Location is meant to be one of the five things living costs are inferred from.`,
      );
    }
    if (!(meanIndex > 0.85 && meanIndex < 1.25)) {
      fail(
        'packages/content/data/locations.json',
        `The birth-weighted mean cost index is ${meanIndex.toFixed(3)}; 1.00 is meant to be an average city, so the whole population is being charged the wrong baseline.`,
      );
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

      // V10 — American English in player-facing copy (Ticket 0207d).
      //
      // Checked on the RENDERED catalog, not the generator source: several
      // event ids legitimately contain `favourite` and `neighbour`, and a
      // blanket rewrite of the source renamed five of them — which silently
      // breaks every save that recorded one, because ids are stable forever.
      const copy = [
        ...(event.text ?? []),
        ...choices.map((choice) => choice.label ?? ''),
        ...choices.map((choice) => choice.text ?? ''),
        ...choices.flatMap((choice) => (choice.outcomes ?? []).map((o) => o.text ?? '')),
      ].join(' \u0000 ');
      for (const [british, american] of BRITISH) {
        if (new RegExp(`\\b${british}`, 'i').test(copy)) {
          fail(rel, `${event.id}: "${british}" is British — use "${american}".`);
        }
      }

      // V16 — the same voice rules, on the catalog this time.
      //
      // The first version of V16 ran over SOURCE FILES only, because that is
      // where 0211b's rewrite started. It passed clean while the catalog still
      // held the exact line the product owner had quoted back — "Reinstalled
      // the app, met somebody for a coffee, and neither of you texted after" —
      // and "It was not a disaster, which is a low bar cleared."
      //
      // That is CORE_RULES 13.23 inside the rule written to enforce 13.23: a
      // check that sees half the game is half a check, and the half it could
      // not see is where four hundred of the game's five hundred player-facing
      // lines live.
      for (const [expanded, contracted] of EXPANDED) {
        if (new RegExp(`\\b${expanded}\\b`, 'i').test(copy)) {
          fail(
            rel,
            `${event.id}: "${expanded}" reads as written rather than spoken — ` +
              `use "${contracted}".`,
          );
        }
      }
      for (const vague of VAGUE) {
        if (vague.test(copy)) {
          fail(
            rel,
            `${event.id}: "${copy.match(vague)?.[0]}" is a summary rather than a ` +
              `thing that happened — name a real detail.`,
          );
        }
      }

      // V15 — a word the Americanisation swept in, in a place it cannot go.
      //
      // Reading a played life found "Tripped on a completely APARTMENT surface",
      // "said okay in a completely APARTMENT voice", and "Attempted A BANGS with
      // kitchen scissors". All three are 0207d's blanket source sweep — flat →
      // apartment, fringe → bangs — landing on the wrong sense of the word, and
      // all three shipped because the OUTPUT is impeccable American English and
      // every rule was looking for British English.
      //
      // The check is narrow on purpose: a replacement word directly after an
      // -ly adverb (where only an adjective fits) or after "a" (where only a
      // singular fits). It cannot catch every bad substitution and it catches
      // the shape this sweep actually produced.
      for (const match of copy.matchAll(SWEPT_IN)) {
        fail(
          rel,
          `${event.id}: "${match[0]}" — a word the Americanisation pass swapped ` +
            `in, in a place its other sense cannot go.`,
        );
      }

      // V13 — a token that renders lowercase cannot start a sentence.
      //
      // Reading the built app found "…ten minutes before class. he's asking you
      // as a friend." `{kidThey}` renders "he"/"she"/"they" and `{siblingRel}`
      // renders "brother"/"sister", both lowercase. The capitalized form
      // (`{KidThey}`) has existed since 0203 and resolves to the same value
      // sentence-cased — these two lines simply did not use it, and nothing
      // was checking.
      for (const match of copy.matchAll(/[.!?]\s+\{([a-z][A-Za-z0-9]*)\}/g)) {
        const token = match[1];
        if (/They|Them|Their|Rel$/i.test(token) || LOWERCASE_TOKENS.has(token)) {
          fail(
            rel,
            `${event.id}: "{${token}}" renders lowercase and starts a sentence — ` +
              `use "{${token.charAt(0).toUpperCase()}${token.slice(1)}}".`,
          );
        }
      }

      // V11 — a parenting event says it needs a child (Ticket 0208).
      //
      // The same rule as V8's age gate, learned from `partnered` one ticket
      // earlier: eleven events reading "your kid spiked a fever at 2am" went in
      // with nothing stopping them firing at somebody who has never had a
      // child. Checked by id prefix on purpose — a prefix is a promise the
      // author makes, and this is what holds them to it.
      if (event.id.startsWith('parent.') && event.eligibility?.hasChildren !== true) {
        fail(
          rel,
          `${event.id}: a parenting event must declare hasChildren: true, or it ` +
            `fires at somebody who has never had a child.`,
        );
      }

      // V9 — a choice label says what pressing it does (Ticket 0207d).
      //
      // Review, after playing the 0207 build: "'Tell them something' and 'Have
      // it out with them' does not make sense to everyone. Please make them say
      // what they mean." The rule that came out of it is that a label has to be
      // readable WITHOUT the prompt above it, because the standing menus — the
      // person page, the Love screen — have no prompt at all, and a player
      // scanning a decision card reads the buttons before the paragraph.
      //
      // Machine-checkable in two ways only, and both are worth having: a label
      // needs a verb and an object rather than a bare gesture, and the specific
      // constructions review rejected are blocked by name so they cannot come
      // back through a later edit.
      for (const choice of choices) {
        const label = (choice.label ?? '').trim();
        const bare = label.replace(/\{[a-zA-Z]+\}/g, 'them').toLowerCase();

        for (const banned of VAGUE_LABELS) {
          if (bare === banned) {
            fail(
              rel,
              `${event.id}: choice label "${label}" says nothing on its own. ` +
                `A label has to be readable without the prompt above it.`,
            );
          }
        }
        // One word is a gesture, not an instruction. "Go", "Pass", "Coast".
        if (bare.split(/\s+/).filter(Boolean).length < 2) {
          fail(rel, `${event.id}: choice label "${label}" is a single word. Say what it does.`);
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
