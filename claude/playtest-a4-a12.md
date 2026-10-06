# Playtest A4 and A12 — people actions and Property

Payton authorized starting the playtest notes on 6 October 2026. These are the
first two independent screen fixes, on `feat/playtest-a4-a12`, based on main
`5330478`. Claimed before implementation in commit `4c4eb97`.

**Spec sections:** 786–795 (people actions), 849–878 (finance/property UI).
Payton explicitly requested removing the people-action odds words.
**Allowed files:** mobile screens, mobile test setup/dependencies/lockfile, notes.
**Protected areas touched:** none. No simulation, finance, save, balance,
CORE_RULES, or approved-decisions changes.

## Observed and changed

- A4: Both friendship and romance rows displayed probability bands. Removed
  those values while preserving descriptions, refusal reasons, disabled rows
  and the existing commands. Jobs and college are untouched.
- A12: Property used `books.assets`, which includes vehicles, valuables and
  businesses. A car or watch could therefore produce a Property row. It now
  uses the existing `homesValue(state.homes)` function for visibility and value.
  Multiple properties are included. Net worth retains all assets and debts.

## Checks

Nine mobile component tests render the actual screens and shared components;
only native hosts, the store hook and navigation hook are mocked. Fixtures use
real new-game and social APIs. Tests cover three relationship warmth levels,
friendship/romance commands, spent-contact refusals, no property, car-only and
watch-only ownership, and two homes alongside other assets, including routing.
Mobile typecheck passes. All changed files are formatted.

Sabotage verification caught all seven mutations:

| Mutation                                         | Result |
| ------------------------------------------------ | ------ |
| Restore friendship odds value                    | caught |
| Restore romance odds value                       | caught |
| Enable friendship actions after contact is spent | caught |
| Remove friendship command                        | caught |
| Show Property based on all physical assets       | caught |
| Include other physical assets in Property value  | caught |
| Route Property to Assets instead of Homes        | caught |

None missed. Each mutation was applied independently, then restored with a
SHA-256 check. These are screen tests; no engine tests were mutated for this pass.

## Remaining gates

Full `pnpm verify` passed all 15 typecheck tasks and all 15 test tasks
(1,863 tests, including the nine new mobile tests). It failed at content
validation with nine generator/catalog mismatches, reproduced with identical
output on an untouched archive of main `5330478`: activities, advice, auctions,
businesses, childhood events, homes, renovations, valuables and vehicles.
The validator rewrote vehicle-mods as a side effect; that change was restored.
Global `format:check` reported 24 existing Markdown files before this pass
formatted its edited backlog; 23 remain outside this change. Changed-file
formatting passes. These baseline failures still block a green CI run. Native-device checking is pending: component tests do not verify
layout or tapping on a phone. No placeholders or new game rules were added.

Next independent item is A2. A3 waits for Agent A's B1 warning/failure contract.
A7 needs the B15 rental-cost decision (the backlog originally cited B14 by mistake).
A5 needs concrete wording examples; A10 needs its existing spec decision.
Explicit card purchase options need Agent A's payment contract and must work
across eligible purchases, including future vacations, up to available credit.
