# YearAfter

A mobile life-simulation game. React Native + Expo, with the entire simulation
engine in plain TypeScript packages that run and test in Node.

The product source of truth is [`specs/MASTER_SPEC.md`](specs/MASTER_SPEC.md).
Before writing code, read [`specs/CORE_RULES.md`](specs/CORE_RULES.md) and
[`specs/AI_CODING_INSTRUCTIONS.md`](specs/AI_CODING_INSTRUCTIONS.md).

**Status:** v0.01 Playable Shell. Sprint Zero (0001–0009) and tickets 0101–0114
are complete. Next milestone is v0.02 Living Character, starting at Ticket 0201.

---

## Getting started

Requires Node 20+ and pnpm 10+.

```bash
pnpm install
pnpm verify          # typecheck + tests + content validation
pnpm mobile          # start Expo; press i for iOS, a for Android
```

`pnpm mobile` runs Expo Go. For a development build with native modules:

```bash
cd apps/mobile
npx expo run:ios
```

To look at the shell quickly in a browser without a simulator:

```bash
cd apps/mobile
npx expo start --web
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
packages/simulation      Seeded RNG, GameState, year advancement, new-game.
packages/persistence     SaveGameV1, migrations, memory + expo-sqlite repositories.
tools/content-validator  Catalog and canonical-rule validation. Runs in CI.
specs/                   MASTER_SPEC, CORE_RULES, ARCHITECTURE, AI_CODING_INSTRUCTIONS.
```

Packages listed in spec 1191–1203 that have no ticket yet (`world`, `events`,
`finance`, `careers`, `assets`, and the rest) are created when their milestone
starts — see [`specs/ARCHITECTURE.md`](specs/ARCHITECTURE.md).

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

## Where things are wired

- Year advancement: `packages/simulation/src/advance.ts`. New systems attach as
  phase modules — the list of upcoming phases is in that file's header.
- Save shape: `packages/persistence/src/save-schema.ts`. Changing it means a
  version bump and a migration in `migrations.ts`, with tests.
- Theme: `apps/mobile/src/theme/theme.ts`. Every colour and dimension in the app
  comes from there; no component hard-codes a value.
- Game state binding: `apps/mobile/src/stores/gameStore.tsx`. The only place the
  UI touches the simulation.

## Open decisions for the v0.01 review gate

1. **Stat bar layout (Ticket 0106).** Three prototypes ship — `compact`, `grid`,
   `inline`. Switch between them in the developer screen (gear icon, top right).
   Once chosen, delete the other two.
2. **Feed density.** The compact layout gives roughly four timeline entries per
   screen; grid and inline give six to eight. This is the main feel tradeoff.
3. **Icons.** Text glyphs stand in for real artwork so the shell does not borrow
   a recognisable third-party icon set. Drawn icons are a v0.20 identity task.
4. **App identity.** Name, logo, colour and typography are placeholders pending
   the identity pass. The accent green and paper background are a starting point,
   not a decision.
