# YearAfter — handoff for a second coding agent

Written 4 October 2026. State: everything through ticket 0604 is on `origin/main`
(`08632af`), save version v39, 427 tracked files. Repo:
https://github.com/PaytonBlevins/YearAfter.git (public).

## 1. What this is

A mobile, tap-by-tap life simulation (BitLife-style taxonomy, original visual
identity). Expo / React Native app over a pure-TypeScript engine. Monorepo,
pnpm 10.28 + Turborepo, node >= 20.

## 2. Read these first, in this order

1. `specs/AI_CODING_INSTRUCTIONS.md` — how to work. Binding.
2. `specs/ARCHITECTURE.md` — package layout and dependency direction.
3. `claude/approved-decisions.md` — settled product decisions. Do not reopen.
4. `claude/roadmap.md` — the roadmap (reproduced in full below the handoff in
   the copy you were given). Findings 1–41 and the order list are at its end.
5. The ticket doc for the area you touch (`claude/06xx-*.md`, most recent first).
6. `specs/CORE_RULES.md` (~2,700 lines, numbered rules 13.x are lessons from
   earlier tickets). Grep it by topic; the last ones (13.99–13.101) are the
   freshest.
7. `specs/MASTER_SPEC.md` — the source of truth; every ticket cites line ranges.

## 3. Architecture in brief

- `apps/mobile` is the only place React Native lives. Screens read through the
  store (`apps/mobile/src/stores/gameStore.tsx`); the engine never imports UI.
- Packages (acyclic): core <- character <- relationships <- content <- events /
  education <- simulation <- persistence <- apps/mobile. Also finance, health,
  careers, social, parenting, stress. `tools/content-validator` checks content.
- `advanceYear` is calculate -> validate -> commit, in phase modules.
- Saves are a versioned JSON document with tested migrations (now v39). Any
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

- Next in order: **0605 Private investments**, then 0606 Commercial real estate.
  Do not start either without Payton's go-ahead. **0508 Will & Estate** was
  deferred by Payton and is still to be built (after v0.06).
- Open findings: 28–36 (playtest after 0507) and 37–41 (business calibration:
  survival 78.7% vs BLS 51%, profit swings, cheap trades too profitable, a
  child's inherited business). See roadmap.
- CI `pnpm format:check` is probably red until Prettier is run and committed:
  `pnpm exec prettier --write "**/*.{ts,tsx,js,mjs,json,md,yml}"`.
- `packages/finance/src/investments.test.ts` is deleted in the tree; intent not
  confirmed with Payton. Ask before restoring or relying on it.
- Mobile screens for 0602–0604 are typechecked but not run on a device.
- `pnpm mobile -- --clear` starts Expo with a clean cache (not `pnpm mobile clear`).

## 7. Git and coordination (two agents, one repo)

Rules
- `main` stays green and stable. Never force-push `main`. Never rewrite pushed history.
- One ticket = one short-lived branch = one PR. Branch names:
  `feat/0605-private-investments`, `fix/…`, `refactor/…`, `test/…`,
  `content/…`, `balance/…`, `docs/…`.
- Commit messages use the same prefixes: `feat(finance): 0605 …`.
- Pull request into `main`; Payton merges (or approves a merge).

Avoiding conflicts
- Split work by ticket and package, and agree it before starting. Suggested:
  the content/event/catalog tickets go to one agent, engine and screens to the
  other. Do not both edit the same ticket.
- Shared hot files — `specs/CORE_RULES.md`, `claude/roadmap.md`,
  `packages/*/src/index.ts`, `apps/mobile/src/stores/gameStore.tsx`, the save
  migrations, `tools/content-validator/validate.mjs` (and `TICKET` in
  `packages/finance/src/summary.ts`) — touch them in small, separate commits and
  rebase often. Only one agent bumps the save version at a time; claim v40
  before using it.
- Docs for each ticket go in the PR, never straight on `main`.

Day to day
```
git clone https://github.com/PaytonBlevins/YearAfter.git && cd YearAfter
pnpm install
git switch main && git pull --ff-only
git switch -c feat/0605-private-investments
# ...work...
pnpm format:check && pnpm typecheck && pnpm test      # quick gate
pnpm verify                                           # full gate before the PR
git add -A && git commit -m "feat(finance): 0605 private investments"
git fetch origin && git rebase origin/main            # stay current
git push -u origin HEAD
gh pr create --base main
```
Gotchas
- A stale `.git/index.lock` after an interrupted git command: delete it with
  `rm -f .git/index.lock` once you're sure nothing else is running.
- Don't pass literal `<placeholder>` text into zsh commands.
- Don't commit the `_to_delete/` folder or `node_modules`.
- CI runs on every push and on PRs: checkout, install `--frozen-lockfile`,
  format:check, typecheck, test, validate:content. The pnpm version comes from
  `packageManager` (don't add `version:` to the action).
- Update `pnpm-lock.yaml` in the same commit as any dependency change.

## 8. The Claude Project

Ticket docs also live in the Claude Project "YearAfter" (`claude/…` paths).
After finishing a ticket the doc, roadmap and CORE_RULES are mirrored there.
`claude/build-status.md` exists only in the Project.

