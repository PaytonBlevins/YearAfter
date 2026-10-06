# Playtest A10 — linked monthly-outflow sources

Payton selected **Linked cost sources** for A10: explain the total and link to
existing screens, keeping detailed costs on the entities that produce them.
This resolves the previously recorded design gate without changing spec 20 or
introducing an expense ledger. Life-event wording remains deferred until last.

Branch `feat/playtest-outflow-sources` was claimed before code in local commit
`64d7266`, rebased as `ccd6d54` onto main `14144ca` after the preceding batches
merged. An equivalent claim is published on the branch.

**Spec sections:** 19–21 (finance dashboard, contextual costs, no monthly
ledger), 849–878 (finance/entity UI). **Allowed files:** FinancesScreen,
OutflowScreen, navigation and shell route wiring, component tests and notes.
**Protected areas touched:** none. No engine, store, save, balance, content,
CORE_RULES or approved-decisions changes.

## Requirement and result

Monthly outflow opens a new screen even when the total is zero. Its amount uses
the same public `summariseFinances` and `estateOf` functions as the dashboard;
there is no second calculation of spending.

The explanation identifies it as recorded outgoing money in the current game
year divided by twelve, rather than a forecast or next month's bill. It includes
tax, living costs, repayments and occasional spending; purchases recorded as
investment/property transfers are excluded by the existing summary rules.
Living costs and tax have explanatory rows with no amounts or invented controls.

Contextual links appear for the character's current holdings and commitments:

| Link                                           | Existing destination                                 |
| ---------------------------------------------- | ---------------------------------------------------- |
| Borrowing, when cards or loans are held        | Debt and its payment screens                         |
| Children, when a child is on the family roster | Family, then the individual child                    |
| Homes, when owned                              | Homes and individual rental costs                    |
| Vehicles, when owned                           | Vehicles and individual running/loan costs           |
| Your program, when enrolled                    | Program tuition, family help and personal share      |
| Businesses, when owned                         | Businesses; costs paid from business cash stay there |

These links describe where to check **current** details. They do not claim to
reconcile all historical spending: sold assets, completed programs and one-off
spending can be in the recorded total without a corresponding current entity.
Copy explains this distinction. No category amount table, transaction sources,
monthly statement, visible budget or lifestyle selector is added.

## Acceptance and checks

Twelve new component tests use real finance summaries, public ledger posting,
and real screens. They cover dashboard navigation with and without spending,
the same $2,000 total on both screens, transfer and prior-year exclusions,
no exposed transaction sources or per-category amounts, zero spending,
automatic-cost explanations, all five entity/debt destinations and all three
program stages. Native hosts and store/navigation hooks alone are mocked.

| Mutation                                | Result |
| --------------------------------------- | ------ |
| outflow dashboard route lost            | caught |
| monthly amount displayed in cents       | caught |
| summary reads the wrong year            | caught |
| context rows become an amount breakdown | caught |
| links dispatch lost                     | caught |
| vehicle link routes to homes            | caught |
| program link hidden                     | caught |
| forecast distinction omitted            | caught |

All eight mutations caught; none missed. Each source was restored with SHA-256
checks. No engine code or engine tests were mutated. Final `pnpm verify` passes
all 15 typecheck and 15 test tasks (2,253 tests, including 93 mobile tests), then
fails on the same nine generator/catalog mismatches with output identical to
an untouched archive of current main `14144ca`. The validator's vehicle-mods
side effect was restored. Changed-file formatting passes. Global
`pnpm format:check` fails on 22 unrelated Markdown files; each is byte-for-byte
identical to current main.

## Review and remaining work

The preceding batches are merged; this PR targets current main directly.
Native-device layout and tapping remain pending. A1 waits for 0705/0706, A3 needs
B1's business-failure contract, and purchase-card choices need Agent A's payment
contract. Life-event wording remains last. Rules/B items remain Agent A's work.
