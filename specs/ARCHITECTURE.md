# Architecture

## Shape

A pnpm + Turborepo TypeScript monorepo. The simulation engine is completely
independent of the UI — every package under `packages/` runs in plain Node and is
tested there. React Native appears only in `apps/mobile`.

That separation is what makes the balance tooling possible: running 100,000 lives
(spec 1395–1404) must never require a phone.

```
apps/
  mobile/                 Expo React Native app. The only place RN lives.
packages/
  core/                   IDs, Money, Percentage, Location, Result. Depends on nothing.
  character/              Character state, visible stats, Boolean talents, timeline.
  content/                Versioned catalogs: names, locations, the event library.
  relationships/          NPCs, simulation tiers, the family model.
  events/                 The event engine. Generic — it never names an event.
  simulation/             Seeded RNG, GameState, year advancement, new-game, decisions.
  persistence/            Versioned saves, migrations, repositories (memory + expo-sqlite).
tools/
  content-validator/      Catalog and cross-reference validation. Runs in CI.
specs/                    Source of truth. MASTER_SPEC, CORE_RULES, this file.
tests/                    Cross-package acceptance tests.
```

Packages named in spec 1191–1203 that have no ticket yet — `world`, `finance`,
`education`, `careers`, `assets`, `business`, `creators`, `entertainment`,
`sports`, `military`, `politics`, `crime`, `health`, `shared` — are created when
their milestone starts. Empty workspaces slow every install and typecheck for no
benefit.

## Dependency direction

```
core  <-  character  <-  relationships  <-  content  <-  events  <-  simulation
                                                                        |
                                                        persistence  <--+
                                                        apps/mobile  <--+
```

Strictly acyclic. `core` imports nothing.

The one edge worth explaining is `events` never importing `simulation`, even
though it needs random numbers and reads game state. Instead it declares the
narrow shapes it needs — `EventRandom` for randomness, `EventContext` for state —
and `simulation` supplies both. That keeps the arrow pointing one way, and it is
why the engine's own tests use a small local generator rather than `RandomStream`.

Cross-system effects use defined service interfaces and domain events rather than
direct imports between sibling domain packages.

Distinguish **commands** (a requested action: "apply for this mortgage") from
**events** (something that actually happened: "mortgage denied"). Commands can
fail; events are facts.

## Why the save is a JSON document

`packages/persistence` stores one versioned JSON document per save rather than a
normalised relational schema, with a few columns duplicated out for the save list.

During development the save shape changes weekly. Versioned JSON plus tested
migrations costs one migration function per change; fifty normalised tables cost
a schema migration plus a data migration plus a query rewrite. Spec 1108–1140
requires versions and migrations either way — this makes them cheap enough to
actually keep writing.

If save size becomes a problem in long dynasties, the fix is compressing
background NPC state (spec 771–785), not normalising the schema.

## Why the repository is an interface

`SaveRepository` has two implementations: `MemorySaveRepository` for tests and
tools, `SqliteSaveRepository` for the device. The simulation only knows the
interface, so nothing in the engine can accidentally acquire a native dependency.
`adapters/sqlite.ts` is the only file in the repo that imports `expo-sqlite`.

## Why RNG has domain streams

A single global sequence has a subtle failure mode: adding one random draw to the
health system shifts every subsequent draw in the career system, silently
rebalancing the game and invalidating every golden-life test. Per-domain streams
seeded from the master seed remove that coupling — `stream('events')` produces
the same sequence no matter what else has run.

The whole registry serialises into the save, so a loaded game resumes mid-sequence
rather than restarting its streams.

## The year loop

`advanceYear` is calculate → validate → commit, in memory, atomically. It never
mutates its input. Systems attach as phase modules rather than as inline logic in
the function body — see the phase list in `packages/simulation/src/advance.ts`.

One player-facing turn is one year. Monthly finance is processed internally
inside that single turn (spec 1108–1140) and never surfaced as monthly UI.

## Mobile structure

```
apps/mobile/src/
  app/          Root providers and the shell.
  navigation/   The five-world model and the screen stack.
  screens/      One file per screen.
  components/   Reusable presentation pieces (Ticket 0114).
  theme/        Tokens: color, type, spacing, radii (Ticket 0101).
  stores/       Game state binding and persistence wiring.
  hooks/        Shared behaviour.
```

Screens read game state through a store and never construct simulation objects
themselves. Anything a screen needs to compute from state belongs in a package,
not in the component.
