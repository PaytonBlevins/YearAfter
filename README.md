# YearAfter

A mobile life-simulation game. React Native + Expo, with the entire simulation
engine in plain TypeScript packages that run and test in Node.

The product source of truth is [`specs/MASTER_SPEC.md`](specs/MASTER_SPEC.md).
Before writing code, read [`specs/CORE_RULES.md`](specs/CORE_RULES.md) and
[`specs/AI_CODING_INSTRUCTIONS.md`](specs/AI_CODING_INSTRUCTIONS.md).

**Status:** v0.02 Living Character, in progress. Sprint Zero (0001–0009),
v0.01 (0101–0114), Tickets 0201 (character generator), 0202 (starting family),
0203 (childhood event library, revised in 0203b) and 0204 (school progression)
are complete. Next is Ticket 0205, the stress foundation.

---

## Getting started

> **Paste these one line at a time.** Interactive zsh does not treat `#` as a
> comment, so a line with a trailing explanation will try to run the explanation
> as a command. Every code block below is paste-safe as written.

### 1. Install pnpm

This is a pnpm workspace. `npm install` will not work — the packages depend on
each other through the `workspace:*` protocol, and `.npmrc` sets a pnpm-specific
linker that Metro needs.

Check Node first; it must be 20 or newer.

```bash
node -v
```

Then install pnpm:

```bash
npm install -g pnpm@10
```

If that fails with a permissions error, this installer needs no admin rights:

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

It edits your shell profile, so **open a new terminal tab** afterwards. Confirm:

```bash
pnpm -v
```

To avoid a global install entirely, prefix every command below with `npx`:
`npx pnpm@10 install`, `npx pnpm@10 mobile`.

### 2. Install dependencies

```bash
cd ~/Documents/yearafter
```

```bash
pnpm install
```

### 3. Check everything passes

```bash
pnpm verify
```

That runs typecheck, tests and content validation — the same three things CI runs.

## Running it in the iOS simulator

One-time setup:

1. Install **Xcode** from the App Store (it is large — budget the download).
2. Open Xcode once and accept the licence.
3. In Xcode: **Settings → Platforms**, install the **iOS** platform if it is not
   already there. That is what provides the simulator.
4. If command line tools are missing, run `xcode-select --install`.

Then, every time:

```bash
cd ~/Documents/yearafter
```

```bash
pnpm mobile
```

With the dev server running, **press `i`** in that terminal. It boots the
simulator, installs Expo Go into it if needed, and loads the app. Press `a` for
Android, `r` to reload, `j` to open the debugger, `Ctrl-C` to stop.

Every library this app uses is bundled in Expo Go, so no native build is needed
yet. Edits to any file — app or package — hot-reload.

If it misbehaves:

| Symptom                         | Fix                                                                        |
| ------------------------------- | -------------------------------------------------------------------------- |
| `zsh: command not found: pnpm`  | Install it — see step 1 above                                              |
| `zsh: command not found: press` | You pasted a line with a trailing `#` comment. Paste one command at a time |
| "No simulator available"        | Xcode → Settings → Platforms → install iOS                                 |
| Stale screen after an edit      | Press `r`, or restart with `npx expo start --clear`                        |
| Metro cannot resolve a package  | Run `pnpm install` from the repo root, not from `apps/mobile`              |

Later, when a library that is not in Expo Go is added, switch to a development
build — `cd apps/mobile && npx expo run:ios`. That compiles a native project and
takes several minutes the first time. It is not needed today.

To glance at the shell in a browser instead, without a simulator:

```bash
cd apps/mobile && npx expo start --web
```

Web is a review convenience only — saves are in-memory there
(`src/stores/repository.web.ts`). iOS and Android are the shipping targets.

## Commands

| Command                 | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `pnpm verify`           | Everything CI runs. Use this before pushing.       |
| `pnpm typecheck`        | Strict TypeScript across all packages and the app. |
| `pnpm test`             | Vitest across all packages.                        |
| `pnpm validate:content` | Content catalogs plus canonical-rule checks.       |
| `pnpm format`           | Prettier write.                                    |
| `pnpm mobile`           | Start the Expo dev server.                         |

## Layout

```
apps/mobile              Expo app. The only place React Native lives.
packages/core            IDs, Money, Percentage, Location, Result.
packages/character       Character state, the seven visible stats, Boolean talents, timeline.
packages/content         Versioned content catalogs — names, locations, events.
packages/relationships   NPCs, tiers, the family model.
packages/events          The event engine: eligibility, weights, cooldowns, chains.
packages/education       Schooling: enrolment, grades, behaviour, extracurriculars.
packages/simulation      Seeded RNG, GameState, year advancement, new-game, decisions.
packages/persistence     SaveGameV1, migrations, memory + expo-sqlite repositories.
tools/content-validator  Catalog and canonical-rule validation. Runs in CI.
specs/                   MASTER_SPEC, CORE_RULES, ARCHITECTURE, AI_CODING_INSTRUCTIONS.
```

Packages listed in spec 1191–1203 that have no ticket yet (`world`, `finance`,
`careers`, `assets`, and the rest) are created when their milestone starts — see
[`specs/ARCHITECTURE.md`](specs/ARCHITECTURE.md).

## Rules worth knowing before your first change

These are the ones that bite. The full list is in `CORE_RULES.md`.

- **Never call `Math.random()`.** Take a stream:
  `state.rng.stream(RngDomains.Events).chance(0.2)`. A seed must fully determine
  a life; the golden-life tests enforce it and the content validator fails the
  build on a stray call.
- **Money is integer cents.** `dollars(12.50)`, never `12.50`. Format only at the
  UI boundary with `formatMoney`.
- **Exactly seven visible stats.** Happiness, Health, Smarts, Looks, Charisma,
  Willpower, Discipline. An eighth needs a spec revision, and a test plus the
  validator will both fail if one appears.
- **Talents are Boolean.** No numeric strength, ever.
- **Expected failures return `Result`,** they do not throw.
- **Derive, do not store.** Net worth, monthly outflow and equity are computed
  from source state.
- **Never weaken a test to make code pass.**
- **Events are data.** No `switch` on an event id, ever. Add events to
  `scripts/generate-events.py`, run it, commit the script and the JSON.
- **Stat changes go through `nudgeStats`,** not raw addition — see the growth
  curve in `packages/character/src/stats.ts` and CORE_RULES 13.2.
- **A menu never refuses because you are busy.** Extracurriculars are limited by
  hours against capacity, in the background — never by the UI allowing one pick.
  There is no workload bar; the consequences arrive in the feed (CORE_RULES 13.4).
- **Money says where it came from.** A cash effect is `{ delta, source }`, and
  the amount must appear in the line the player reads (CORE_RULES 13.6).
- **A decision is a scene.** Named people, three or more different tactics,
  outcomes that can land badly (CORE_RULES 13.4). The people are bound once, when
  the decision is raised, so the prompt and the outcome mean the same person.

## Where things are wired

- Year advancement: `packages/simulation/src/advance.ts`. New systems attach as
  phase modules under `src/phases/` — the list of upcoming phases is in that
  file's header, and `phases/events.ts` is the worked example.
- Events: `packages/events` is the engine, `packages/content/data/events-*.json`
  is the library, and `scripts/generate-events.py` is how the library is edited.
- School: `packages/education` is the system, `packages/content/data/activities.json`
  is the club catalog, and `scripts/generate-activities.py` edits it.
- Save shape: `packages/persistence/src/save-schema.ts`. Changing it means a
  version bump and a migration in `migrations.ts`, with tests.
- Theme: `apps/mobile/src/theme/theme.ts`. Every colour and dimension in the app
  comes from there; no component hard-codes a value.
- Game state binding: `apps/mobile/src/stores/gameStore.tsx`. The only place the
  UI touches the simulation.

## Settled by the product owner

- **Name: YearAfter.** Set in `apps/mobile/app.json`.
- **Palette: the current one is accepted for now** — warm paper ground, near-black
  ink, a single green accent carrying the Advance control and active navigation.
  All of it lives in `src/theme/theme.ts`; nothing hard-codes a colour.
- **Stat bar layout: grid.** Two columns, four rows, with numeric values. The
  compact and inline prototypes are deleted, not left behind.
- **Icons: an original drawn set** in `src/theme/icons.tsx` — line icons on one
  24x24 geometry at a single stroke weight. The full set renders in the developer
  screen's icon sheet. Adding one: keep it inside the 20x20 optical area, inherit
  the stroke weight, and prefer three or four strokes to an accurate silhouette.
- **Row affordances.** Chevron opens a screen, ellipsis acts in place, nothing
  means informational. Canonical in CORE_RULES §8.
- **No advance icon.** The centre control is the affordance.
- **Talent probability: 9% per talent.** Roughly half of characters are born with
  none.
- **Event library size: 250–500** across family, school, friendship, humour and
  talent contexts — an explicit override of the spec's 75–150 (spec 1656). The
  catalog currently holds 346, and the count is asserted in two places.
- **Extracurriculars are not exclusive.** Join as many as you like; the limit is
  a hidden workload model, not the menu. Rejected in review: the pop-up that
  allowed exactly one club, forever.

## Still open

- **Logo and typography** pending the identity pass.
- **Tab label for Relationships** reads "People" only because "Relationships"
  truncates at a fifth of a phone's width.
