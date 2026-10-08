# Playtest P9 — renovation expansion proposal

Status: authorized and separately claimed 8 October 2026 UTC; measured proposal
awaits Payton's approval. No production P9 changes. Branch `feat/playtest-p9-renovations`
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
