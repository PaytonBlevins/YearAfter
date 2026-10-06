# YearAfter — handoff for the second coding agent (Agent B)

Written 4 October 2026, scope rewritten 5 October 2026. State: the 0605 and 0606
engines are on `origin/main` at `d64f507`; their screens are not merged. Save version v40. Repo:
https://github.com/PaytonBlevins/YearAfter.git (public).

## 0. Your scope (read this first; it replaces the earlier two-agent pipeline)

You are **Agent B**. Your job is narrow and does not include building tickets:

1. **The notes.** All the project's written material: the ticket docs in
   `claude/`, `claude/roadmap.md` (findings and the order list), `claude/build-status.md`
   (Project only), `claude/approved-decisions.md`, this handoff, and anything
   Payton calls "notes" from now on. That means existing notes first (tidy,
   reconcile, fix what contradicts the code or each other, fill gaps you can
   fill from the repo), then every new note Payton hands you.
2. **The 0605 and 0606 screens.** Mobile screens, store wiring and the timeline /
   deal wording for Private investments (0605) and Commercial real estate (0606).
   The engines are finished and tested; the contracts are described in
   `claude/0605-private-investments.md` and `claude/0606-commercial-real-estate.md`
   ("For the screens").

You do **not** build tickets, change engine code, change the save format, or
change balance numbers. **Agent A** (the original Claude session) builds every
other ticket end to end: measurement, engine, save, calibration, tests,
sabotage-verification, its own ticket doc, roadmap row and CORE_RULES lessons,
then `pnpm verify`. There is no per-ticket hand-off any more, no contract commit
for you to wait on, and no cross-review relay. Payton decides what comes next.

If a note or a screen exposes a bug or a design question in the engine, write it
down as a finding (roadmap "Found by …") and tell Payton. Don't fix it in the
engine yourself.

## 1. What this is

A mobile, tap-by-tap life simulation (BitLife-style taxonomy, original visual
identity). Expo / React Native app over a pure-TypeScript engine. Monorepo,
pnpm 10.28 + Turborepo, node >= 20.

## 2. Read these first, in this order

1. `specs/AI_CODING_INSTRUCTIONS.md` — how to work. Binding.
2. `specs/ARCHITECTURE.md` — package layout and dependency direction.
3. `claude/approved-decisions.md` — settled product decisions. Do not reopen.
4. `claude/roadmap.md` — the roadmap. Findings and the order list are at its end.
5. The ticket doc for the area you touch (`claude/06xx-*.md`, most recent first).
6. `specs/CORE_RULES.md` (numbered rules 13.x are lessons from earlier tickets).
   Grep it by topic; the latest rules at `d64f507` are 13.108–13.109.
7. `specs/MASTER_SPEC.md` — the source of truth; every ticket cites line ranges.

## 3. Architecture in brief

- `apps/mobile` is the only place React Native lives. Screens read through the
  store (`apps/mobile/src/stores/gameStore.tsx`); the engine never imports UI.
- Packages (acyclic): core <- character <- relationships <- content <- events /
  education <- simulation <- persistence <- apps/mobile. Also finance, health,
  careers, social, parenting, stress. `tools/content-validator` checks content.
- `advanceYear` is calculate -> validate -> commit, in phase modules.
- Saves are a versioned JSON document with tested migrations (now v40). Any
  change to saved shape needs a version bump and a migration test. Optional
  fields can avoid a bump (0604 did).
- Randomness: never `Math.random()`. Use the RNG registry's domain streams, keyed
  by seed + entity + year.
- Money is integer cents (`dollars()` helper); domain math in whole dollars.
- Expected failures return `Result`; strict TS, no `any`, no magic numbers
  (constants named and documented); derive, don't duplicate.
- Content validator rules: spoken-style contractions ("isn't", "won't"),
  American spelling, no `.cash +` patterns.

## 4. Product decisions (do not reopen)

Five-world nav (Career, Assets, Advance, People, Activities); Advance is the
only centre control; Relationships = Family + Friends only; Activities 10–16
rows; exactly seven visible stats; 9% talent probability; serious health
conditions left as is; health ceiling at 26 accepted; check-ups button-only;
original visual identity. Full text: `claude/approved-decisions.md`.

## 5. The per-ticket loop (how every ticket was built)

1. Read the ticket's spec lines and CORE_RULES; inspect existing code.
2. **Measure first** — write a throwaway harness (keep it out of the repo) that
   reports the current behaviour against real-world numbers.
3. Build: data model, sim logic, UI, save/load + migration, balance config,
   content, tests.
4. **Sabotage-verify the tests**: mutate the code (tar a backup first; assert
   md5 restored) and confirm a test fails. Survivors mean a missing or dead
   test. Never `pkill -f vitest`.
5. Write `claude/NNNN-name.md` (what it does, calibration, what broke, not done,
   findings, tests), update `claude/roadmap.md` and add CORE_RULES lessons.
6. `pnpm verify` (typecheck + test + validate:content, ~5.5 min; run in the
   background with `TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1`).
7. Change summary: implemented, tests, systems impacted, product-judgment items
   (propose a value), open issues. No unrequested features, no silent scope
   reduction, no placeholders reported complete, no weakened or deleted tests,
   no protected-contract changes without approval.

## 6. Current state and open items

- Done on the engine side: everything through **0605 Private investments** (save
  v40) and **0606 Commercial real estate** (no save bump). Screens for both are
  yours (section 7).
- **0508 Will & Estate** was deferred by Payton and is still to be built, by Agent A.
- Open findings: 28–36 (playtest after 0507), 37–41 (business calibration:
  survival 78.7% vs BLS 51%, profit swings, cheap trades too profitable, a
  child's inherited business), 42–43 (0605: an index fund beats private deals,
  portfolio income untaxed) and 44–46 (0606: tenant costs, the first-year clamp,
  no renovation and no own-business tenants). See the roadmap.
- `packages/finance/src/investments.test.ts` is deleted in the tree; intent not
  confirmed with Payton. Ask before restoring or relying on it.
- Mobile screens for 0602–0606 are typechecked but not run on a device.
- `pnpm mobile -- --clear` starts Expo with a clean cache (not `pnpm mobile clear`).
- **Never run Prettier over `packages/content/data`.** `pnpm validate:content`
  requires those JSON files to match their Python generators byte for byte, and
  Prettier rewrites them. Regenerate with `python3 scripts/generate-<name>.py`
  if one was touched.

## 7. What you do, in order

1. **Notes, existing.** Read every `claude/*.md`. Reconcile them with the code
   and with each other (status lines, the ticket table, the "Suggested order",
   stale "next ticket" text, findings numbering). Fix wording, not decisions:
   `approved-decisions.md` and every product value stay as written. Write what
   you changed and anything you could not reconcile as a short note, and ask
   Payton about the latter.
2. **0605 screens.** The Investments screen's deals section (offers, cheque,
   held deals, sell on), store wiring in `gameStore.tsx`, removal of the
   'private' row from `INVESTMENTS_NOT_YET_BUILT`, and deal wording in
   `content/src/deal-lines.ts`. Branch `feat/0605-screens`.
3. **0606 screens.** The commercial listings section on the homes screen, the
   business tenant rows on the rental screen (trade, revenue, staff, lease end),
   and the wording for the new timeline lines. Branch `feat/0606-screens`.
4. **Notes, new.** Whatever Payton gives you. Same rule: you write down what he
   decides; you do not decide.

For 2 and 3: stay inside `apps/mobile`, `packages/content/src/deal-lines.ts` and
docs. If a screen needs an engine function that isn't there, don't write it;
tell Payton and Agent A. Run `pnpm verify` before each PR. The screens' tests
are yours to write and to mutate against (the sabotage loop in section 5, step 4
applies to your tests, not to the engine's).

## 8. Git

- `main` stays green and stable. Never force-push `main`. Never rewrite pushed history.
- One agent per branch. Your branches: `feat/0605-screens`, `feat/0606-screens`,
  `docs/<topic>`. Commit prefixes: `feat(mobile): …`, `docs: …`, `content: …`.
- Pull requests into `main`; Payton merges. Agent A commits engine work to `main`
  directly through Payton; rebase onto `origin/main` before you open a PR.

```
git clone https://github.com/PaytonBlevins/YearAfter.git && cd YearAfter
pnpm install
git switch main && git pull --ff-only
git switch -c feat/0605-screens
# ...work...
pnpm format:check && pnpm typecheck && pnpm test      # quick gate
pnpm verify                                           # full gate before the PR
git add -A && git commit -m "feat(mobile): 0605 private investments screens"
git fetch origin && git rebase origin/main            # stay current
git push -u origin HEAD
gh pr create --base main
```

Gotchas

- A stale `.git/index.lock` after an interrupted git command: `rm -f .git/index.lock`
  once nothing else is running.
- Don't pass literal `<placeholder>` text into zsh commands.
- Don't commit `_to_delete/` or `node_modules`.
- CI runs on every push and PR: checkout, install `--frozen-lockfile`,
  format:check, typecheck, test, validate:content. The pnpm version comes from
  `packageManager` (don't add `version:` to the action).
- Update `pnpm-lock.yaml` in the same commit as any dependency change.
- Shared hot files (`CORE_RULES.md`, `roadmap.md`, `packages/*/src/index.ts`,
  `gameStore.tsx`, save migrations, `tools/content-validator/validate.mjs`,
  `TICKET` in `packages/finance/src/summary.ts`): small separate commits, rebase
  often. You may edit `roadmap.md` and docs; you may not edit `CORE_RULES.md`,
  save migrations, the validator or `TICKET` (Agent A's), except to fix a typo.
- `claude/CLAIMS.md` still records who owns what. Add a row for your screens and
  notes work in its own tiny commit before starting.

## 9. The Claude Project

Ticket docs also live in the Claude Project "YearAfter" (`claude/…` paths). After
each doc change, mirror it there. `claude/build-status.md` exists only in the
Project.
