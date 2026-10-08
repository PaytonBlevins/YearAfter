# Playtest P9 — approved renovation expansion

Status: authorized, separately claimed, measured and approved by Payton on 8 October
2026 UTC; implementation built and verified;
[PR #21](https://github.com/PaytonBlevins/YearAfter/pull/21) targets main and is mergeable
when checked. Implementation commit `3ee8226`; depends on P1–P8 #13–#20 and shares
PR #10 payment helpers. Main remains `beff25a`. Branch `feat/playtest-p9-renovations`
is stacked on P8 PR #20 while main remains `beff25a`.

## Scope and existing contract

P9/B16 requests pools, sauna, infinity pool, basketball court, patio, game room,
private study, hedge maze, front-yard fountain and a few more, with costs, upkeep,
value and happiness effects, and a size limit by home. The playtest brief authorizes
engine/save/balance work but says new product numbers must be proposed and approved.

The current nineteen entries already include Pool, Infinity Pool, Basketball Court
and Maze (its phrase and description already identify a hedge maze). Keep those IDs,
prices, recovery and annual upkeep. Do not duplicate them under a new ID. Add the
five missing named options, plus four realistic options from MASTER_SPEC 153–154:
guest house, recording studio, indoor pool and outdoor kitchen. Proposed total: 28.
P10 watch icing, P11 servicing, v0.08 and life-event wording remain out of scope.

MASTER_SPEC excludes flooring, exterior and landscaping micromanagement. P9
explicitly authorizes patio and front-yard fountain despite the older catalog test's
patio ban. Make that a named exception; retain the bans on roof/flooring/landscaping
menus. No broad exterior editor, square-foot floor plan or new property-selection UI.

## Measured baseline using actual functions

Scratch harness `p9-checkpoints/measure.ts`, outside git. For each of the seven
lived-in home kinds, created a $500k, good-condition, Ohio home (cost index 0.9),
funded the ledger through a prior-year posting, read `renovationOptionsFor`, then
attempted all nineteen entries through the actual `renovate` command. The controlled
fixture isolates capability; it is not a passive-life or real-world construction survey.

| Home kind      | Options visible | Successful installation commands | Held non-refresh entries | Immediate happiness change |
| -------------- | --------------- | -------------------------------- | ------------------------ | -------------------------- |
| home.condo     | 6               | 6                                | 1                        | +0                         |
| home.townhouse | 9               | 9                                | 4                        | +0                         |
| home.starter   | 11              | 11                               | 6                        | +0                         |
| home.family    | 12              | 12                               | 7                        | +0                         |
| home.large     | 14              | 14                               | 9                        | +0                         |
| home.luxury    | 18              | 17                               | 12                       | +0                         |
| home.estate    | 19              | 18                               | 13                       | +0                         |

Refresh upgrades replace their earlier group, so successful command count is not
held-entry count. The engine has no renovation happiness reader or settlement effect.
There is no aggregate capacity: every eligible once-only group fits on a home.
The existing kind gates correctly keep a pool out of a condo and a maze on estates.

The Ohio pool is $58,500, adds $26,325 of home value and $3,421–$3,605 to total
annual expense depending on the home kind. Its catalog upkeep is $3,000; the rest
is the existing expense rate applied to the added home value. A quoted expense
increase must use the actual reader, not display catalog upkeep alone. No P9
change to that existing value-based expense mechanism is proposed.

A current pool blocks an infinity pool forever because both share group `pool`
and additions are once-only. Proposed Indoor Pool uses that same mutually exclusive
group. This proposal does not introduce demolish/replace/upgrade pricing; keeping
that limitation is explicit. An infinity pool can still be chosen first on eligible homes.

## Proposed nine additions

Whole-dollar costs below are at cost index 1.00 in the game's constant-dollar model.
Existing region scaling and $500 price rounding remain. Recovery is the fraction
of the paid project cost added to the home's value, never a guaranteed real resale
return. Upkeep is the existing fixed annual catalog amount, plus the additional
value-based home expense calculated by the current reader. No resale profit loop.

| Addition            | Base cost | Annual catalog upkeep | Value recovery | Annual happiness | Space units | Eligible homes           |
| ------------------- | --------- | --------------------- | -------------- | ---------------- | ----------- | ------------------------ |
| Sauna               | $12,000   | $300                  | 25%            | +1               | 1           | Townhouse and houses     |
| Patio               | $15,000   | $300                  | 50%            | +1               | 1           | Starter house and larger |
| Game Room           | $25,000   | $300                  | 20%            | +1               | 1           | Townhouse and houses     |
| Private Study       | $18,000   | $0                    | 35%            | +1               | 1           | All lived-in home kinds  |
| Front-yard Fountain | $20,000   | $600                  | 15%            | +1               | 1           | Family house and larger  |
| Guest House         | $180,000  | $2,000                | 50%            | +1               | 4           | Luxury home or estate    |
| Recording Studio    | $45,000   | $600                  | 15%            | +1               | 2           | Large house and larger   |
| Indoor Pool         | $250,000  | $8,000                | 30%            | +2               | 4           | Luxury home or estate    |
| Outdoor Kitchen     | $20,000   | $500                  | 35%            | +1               | 1           | Family house and larger  |

The Guest House is a family/guest amenity, not a separate rent-earning unit; it
adds neither household bedrooms nor rental-unit count in this slice. A future
ADU/rental expansion would need its own contract. Other new additions add no beds.
Existing bedroom additions, restrictions and prerequisite remain unchanged.

Calibration sources checked 8 October:

- [NAR/NALP outdoor remodeling report, 2023](https://www.nar.realtor/sites/default/files/documents/2023-03-remodeling-impact-outdoor-features-03-17-2023.pdf)
  and [NAR/NARI 2025 remodeling report](https://www.nari.org/NARI/media/Assets/2025-Remodeling-Impact-Report_Final-4-9-25.pdf):
  construction cost, resale recovery and homeowner satisfaction are distinct quantities.
- [Finnleo custom indoor saunas](https://www.finnleo.com/custom-saunas): installed
  projects include site layout and heating/electrical work; a room kit is not an
  all-in installed project quote. $12k is proposed game calibration, not a maker MSRP.
- [Housable](https://www.housable.com/) publishes a California development estimate
  around $202k/unit; the proposed $180k base guest amenity scales by the existing region
  index. It is not a universal California ADU quote or a legal/permitting simulation.

All proposed upkeep, recovery and happiness figures are balance choices, not empirical
claims of exact real-world costs or stat gains. Approval is for these gameplay numbers.

## Proposed happiness rule

Derive comfort from installed amenities on `residenceOf(state.homes)` only. Each
new row contributes the table's +1 or +2 annually; existing Pool and Infinity Pool
contribute +2, and existing Spa, Gym, Home Theater, Wine Cellar, Basketball Court,
Tennis Court, Bowling Alley, Observatory and Maze contribute +1 each. Refreshes,
Security System and bedroom additions contribute zero under this amenity rule.

Cap the combined renovation contribution at **+3 happiness per settled year**.
Keep normal stat nudging/clamping and all existing activity, creator, lifestyle and
stress effects. Do not overwrite those sources. No immediate stat reward on the
purchase tap, no bonus from rentals/second homes, and no positive comfort contribution
in a year the settlement reports hardship or any final cash shortfall. Selling,
letting, losing or changing the lived-in home recomputes the effect; no saved bonus.
P2's lifestyle contribution remains separate. No health/energy/smarts benefit from
an amenity without a separate approved rule.

## Proposed size limit

Use an abstract space budget derived from the home kind. This is not a square-foot
claim; larger installations use several units. Enforce both existing home-kind
eligibility and total remaining space in the real command as well as the screen.

| Lived-in kind | Capacity units |
| ------------- | -------------- |
| Condo         | 2              |
| Townhouse     | 4              |
| Starter house | 6              |
| Family house  | 8              |
| Large house   | 12             |
| Luxury home   | 20             |
| Estate        | 30             |

New weights are in the table. Existing weights: Gym, Home Theater, Spa and Wine
Cellar 1 each; Pool 3; Infinity Pool 4; Basketball Court 3; Tennis Court 4; Bowling
Alley 3; Observatory 2; Maze 4. Refreshes, Security System and bedrooms use zero.
Existing rental/commercial buildings keep their existing refresh/structural options;
new leisure options do not go onto those buildings. No player-facing wealth tier.

These capacities accommodate all currently eligible amenity groups at once, subject
to the existing pool-group choice: current estate amenities take 23 units with Pool,
24 with Infinity Pool. They leave room for some new amenities without allowing
unlimited room/court additions. Every new option fits at least one eligible kind.

Grandfather any saved installed work even if a future catalog/capacity change makes
it over budget. Never delete/reprice a saved renovation, reduce bedrooms or confiscate
value. An over-capacity home cannot install another positive-space addition; zero-space
refreshes/structural work retain their existing rules. Unknown legacy IDs must not
crash or silently erase the holding. No removal flow is proposed.

## Screen, save and verification plan after approval

Reuse the existing Renovate screen. Keep its Fix it up/Add to it/Done structure;
add one space-used/remaining row and show the real value, annual expense and comfort
effect before confirmation. At the happiness cap, preview the marginal gain as zero;
for a non-residence, do not advertise a personal comfort bonus. Explain size refusal
in plain language, such as “There isn't room for that addition here.” Keep explicit
one-tap confirmation and use the existing purchase-payment contract when wiring actions.

Saved `home.renovations` already carries stable `renovationId`, paid `cost` and `year`.
Catalog metadata plus derived capacity/happiness can implement this without a new
saved field. Tentatively keep save v46 and TICKET 0708; reserve no version. If actual
implementation reveals a necessary saved shape change, claim the next version and
add a no-RNG migration before changing it. No invented migration just for new catalog IDs.

Tests must cover old holdings and costs, all new model fields, no value loop,
current pool-group behavior, region rounding, full annual expense preview, capacity
boundary and stale command refusal, grandfathered saves, residence-only/yearly/capped
comfort, hardship/shortfall suppression, mood-source merging, resale/rental value and
round-trip/replay. Update only the expressly superseded patio content guard. At least
15 distinct sabotage mutations with tar backup and exact restoration, then full
`pnpm verify`, owned-file formatting and a PR targeting main. Do not silently fix
unrelated eight generator mismatches or 22 historical-note format failures. Fix
renovations' own generator reproducibility without mass reformat as part of this catalog work.

Device checks and Claude Project mirroring remain unavailable here; do not report
them complete. Stop after P9; P10 needs another instruction.

## Implementation after approval

All nine additions are built with the exact approved manifest; 28 entries total.
The original nineteen entries retain every original field (a frozen canonical hash
checks this), apart from new derived space/comfort metadata. Renovation generator
output now matches the checked-in JSON byte for byte while preserving its original short-list layout. The content validator checks integral nonnegative space and bounded
comfort; zero-space structural/refresh work cannot acquire amenity benefits.

The real command refuses insufficient space before payment, and preserves unknown
legacy work and over-capacity holdings. Duplicate saved groups count once for space
and comfort. Pool, infinity pool and indoor pool still exclude each other. Guest
house adds no beds, rented units or rent income. The seventh door remains refresh-only.

Annual settlement derives comfort from the current residence after the homes year,
adds it to existing activity/creator/lifestyle mood, keeps normal nudging and caps,
and suppresses it during hardship or final cash shortfall. Purchases do not alter
stats. Another property gives no personal comfort preview. The screen quotes actual
value/expense changes, capped marginal comfort and remaining space before payment.

The published PR #10 shared payment helper/selector is reused on this stack because
PR #10 is not on main yet. Only renovation is wired in this slice. Both cash and the
selected held card are supported, with quoted-price, status and available-credit
checks repeated at command time. Positive debt funding remains a transfer rather
than income in the existing summary; P6 odd-job earned-income accounting is preserved.
Save v46/TICKET 0708 remain unchanged: no new saved shape and no migration is needed.

### Actual after-build seven-home probe

Repeated the same real-function sequential-install probe from the baseline. Order
is existing catalog first, then new additions; blocked additions may fit when chosen
instead of earlier amenities. This is a capability check, not a passive purchase policy.

| Kind      | Visible options | Successful commands | Held non-refresh groups | Immediate happiness gain |
| --------- | --------------- | ------------------- | ----------------------- | ------------------------ |
| Condo     | 7               | 7                   | 2                       | 0                        |
| Townhouse | 12              | 11                  | 6                       | 0                        |
| Starter   | 15              | 11                  | 6                       | 0                        |
| Family    | 18              | 14                  | 9                       | 0                        |
| Large     | 21              | 16                  | 11                      | 0                        |
| Luxury    | 27              | 18                  | 13                      | 0                        |
| Estate    | 28              | 24                  | 19                      | 0                        |

Annual tests separately run real settlement with independent same-seed states,
including a zero-upkeep study to isolate mood without changing annual finances.
They check bounded contribution, activity/lifestyle merging, hardship/shortfall,
no health/smarts benefit, full ledger reconciliation and replay after save reload.
All nine additions are also sold through the real command with exact sale proceeds;
the rental quote uses recovered home value without creating another rented unit.
A controlled creator-mood reader checks that comfort adds to that source too.
A reused mutable RNG fixture initially spoiled two paired comparisons; fresh games
on each side repaired the fixture before verification. Save tests preserve an
already over-capacity condo, paid costs, bedrooms, value and RNG without deletion.

### Verification

All 28 distinct sabotage mutations were caught by behavioral tests: **none missed**.
Tar backup and MD5 comparison restored every mutated file exactly. Full `pnpm verify`
passes all 15 typechecks and **2,867 tests** (73 more than P8), then exits nonzero on
seven pre-existing catalog-generator mismatches: activities, advice, auctions,
businesses, childhood events, homes and vehicles. Renovations now reproduces exactly.
Full formatting has 22 historical-note failures; all owned files pass formatting and
`git diff --check`. The validator's known secondary vehicle-mods layout side effect
is restored only after checking semantic equality to tracked bytes; it is not committed. Native-device checks and Claude
Project mirroring remain unavailable. P10 has not started.
Implementation CI run 125 (`37859490031`), job `113591559479`, failed the format
step on the same 22 historical notes; typecheck, unit tests and content validation
were skipped. The job log confirms the 22-file format failure. CI is not green. The complete local results above were read from the final
release log after all tests and content validation finished.

### Sabotage audit

| #   | Mutation                                      | Suite       | Result |
| --- | --------------------------------------------- | ----------- | ------ |
| 1   | Sauna price changed                           | content     | Caught |
| 2   | Patio recovery raised to 99%                  | content     | Caught |
| 3   | Indoor pool upkeep disappears                 | content     | Caught |
| 4   | Guest house adds main bedrooms                | content     | Caught |
| 5   | Recording studio fits condos                  | content     | Caught |
| 6   | Study annual comfort doubled                  | content     | Caught |
| 7   | Existing pool uses no space                   | content     | Caught |
| 8   | Existing pool repriced                        | content     | Caught |
| 9   | Indoor pool separate group                    | content     | Caught |
| 10  | Condo capacity raised from 2 to 200           | finance     | Caught |
| 11  | Space reader omits installed amenities        | simulation  | Caught |
| 12  | Space gate absent                             | simulation  | Caught |
| 13  | Exact capacity boundary rejects               | simulation  | Caught |
| 14  | Comfort cap removed                           | simulation  | Caught |
| 15  | Legacy groups counted twice                   | simulation  | Caught |
| 16  | Unknown saved work erased                     | simulation  | Caught |
| 17  | Preview omits value-based expenses            | simulation  | Caught |
| 18  | Preview uncapped gain                         | simulation  | Caught |
| 19  | Non-residence preview grants personal comfort | simulation  | Caught |
| 20  | No hardship suppression                       | simulation  | Caught |
| 21  | No shortfall suppression                      | simulation  | Caught |
| 22  | Second homes add comfort                      | simulation  | Caught |
| 23  | Annual comfort unwired                        | simulation  | Caught |
| 24  | Card balance result lost                      | simulation  | Caught |
| 25  | Renovation charge doubled                     | simulation  | Caught |
| 26  | Store drops chosen payment                    | mobile      | Caught |
| 27  | Saved work omitted on load                    | persistence | Caught |
| 28  | Borrowed funds counted as income              | payment     | Caught |

The first scratch harness stopped after trial 26 because its backup-loop variable
shadowed the serializer path; no test survivor. The harness was fixed, all 28 trials
were rerun against the final guest-house wording, and exact restoration succeeded.
Backup/logs remain outside git. No weakened assertion or engine fix was needed to
make the 28 behavioral defects fail their acceptance tests.
