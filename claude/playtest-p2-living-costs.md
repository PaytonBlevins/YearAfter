# Playtest P2 — living costs and lifestyle tiers

Built by Agent B on `feat/playtest-p2-living-costs`. P2 was claimed in its own commit after
Payton's go-ahead; Payton then approved the measured proposal before production changes.
This branch follows P1 while origin/main remains `beff25a`; save v45 follows P1 v44.
PR: https://github.com/PaytonBlevins/YearAfter/pull/14, targeting main. P1 PR #13 must merge first;
then rebase P2 onto main and drop the already-merged P1 commits from the comparison.
P3 does not begin without Payton's next go-ahead.

## Contract, scope and approval

Brief: P2, roadmap findings 32/33, related outflow finding 19 and cash-buffer finding 0308b.
MASTER_SPEC sections 20/21/22 (contextual costs, private ledger, living model), 1043–1059 (measurement
and reconciliation), 1060–1066 (protected contracts), 1108–1140 (saves/RNG). The brief's “spec 1166”
is the interface passage removing lifestyle tiers; section 22 also removes them. Payton explicitly
approved overriding both removals, recorded in `approved-decisions.md`. Sections 20–21 remain.

Allowed files: finance living/config and its tests; simulation living/annual commit/public command
and measurement tests; persistence schema/migration/tests; mobile screen/navigation/store and
contextual child-cost reader/tests; this doc, roadmap, HANDOFF, CLAIMS, approved-decisions and
CORE_RULES. Protected contracts touched: living balance, annual mood integration and save format,
within Payton's P1–P16 engine/save/balance authorization. No tax, vehicle engine, business engine,
credit, retirement, volatility or content catalogs change. Both TICKET copies remain 0708.

## Approved values and behavior

- The comfortable standard still has memory: 34% upward creep and 12% downward, with an $18,600
  index-1 single-person floor. Marginal after-tax spending is 92% between the floor and $50,000,
  40% from $50,000 to $120,000, and 15% above. Wealth pull remains 1.8% through $100,000 liquid
  wealth; above that its base is `sqrt(100,000 × wealth)`. Cash and portfolio both count; household
  income and wealth are divided by the household scale before the bill scales back up.
- Frugal / Comfortable / Lavish spend 80% / 100% / 150% of discretionary spending above basic
  needs. The remembered standard is not overwritten by the tier, so switching cannot compound a
  luxury multiplier. Comfortable is the new-game and legacy-save default.
- Annual happiness nudges are −1 / 0 / +2, through the existing stat curve. They apply only above
  the actual basic-needs bill, outside hardship. Lavish gets no reward when the final annual ledger
  has unpaid money. Mortgage-squeezed floor spending does not buy a bonus. Activity/creator mood
  keeps its existing behavior before the lifestyle contribution; no new stat bar or event copy.
- Selection is free and immediate, changes only the preference, draws no RNG and saves through
  the real store. The next annual advance applies it. Under-18, dead and pending-question states
  refuse in plain language, without mutation. There is no switching limit because switching buys
  nothing immediately; repeated presses cannot farm money, stats or a year.
- Cars replace a $1,600 embedded annual transport allowance per index-1 single renter, multiplied
  by the same household, location and housing factors. Replacement is capped at actual vehicle
  running costs, never income or lifestyle. A zero-cost car gets no discount. A $5,500 car replaces
  $1,600 and adds a net $3,900 at index 1. The actual car ledger still pays the whole $5,500.
  An expensive car no longer removes its entire payment from generic living. Mortgage squeeze,
  actual separate bills, the basic-needs floor and hardship contraction remain.
- Living costs opens a single Lifestyle screen with three choices, selected state, estimated annual
  living costs and plain cost/mood explanations. Estimates use today's remembered standard,
  location, household, residence cost and ordinary car upkeep/payments, sharing `livingCostFor`.
  They explicitly exclude tax, mortgages, cars and other separate bills and do not forecast next
  year's income/repairs/hardship. The child page reads the chosen standard for its existing contextual
  cost estimate; no full expense-breakdown or monthly ledger is exposed.

## Save v45

Adds required `household.lifestyle`, retains standard/housing and move history. Pure v44→v45
migration supplies Comfortable and preserves money, history and RNG. Current-save validation
rejects missing/unknown tiers, non-object/array households, non-finite or below-floor standards,
unknown housing, and malformed move ages. JSON round trips preserve each tier and the next real
annual advance is byte-identical after reload. Both v43→v44 P1 and v44→v45 P2 migrations remain.

## Measurement: before and after

Harnesses ran outside the repo. Two disjoint samples: seeds `veh-0` through `veh-149`, then
`veh-150` through `veh-299`. Create a new game, advance until death or 110 years, resolve pending
questions by first choice, falling back to the last only if that first choice refuses (P1 rescue
may be unaffordable). Record every adult year. Use the public `netWorthOf` in whole dollars,
including estate assets/liabilities; medians pool age-band observations. This is a passive policy,
not an investor optimizing jobs. Baseline is the P1 branch before P2 balance changes; after is the
finished production implementation, not the candidate copy.

| Age   | Sample 1 before | Sample 1 P2 | Sample 2 before | Sample 2 P2 |
| ----- | --------------: | ----------: | --------------: | ----------: |
| 18–24 |         $27,675 |     $26,817 |         $22,054 |     $21,452 |
| 25–34 |         $44,731 |     $40,728 |         $40,354 |     $36,438 |
| 35–44 |        $100,062 |     $90,253 |         $75,723 |     $60,979 |
| 45–54 |        $208,157 |    $183,148 |        $149,820 |    $131,536 |
| 55–64 |        $345,476 |    $325,917 |        $275,364 |    $260,929 |
| 65–74 |        $423,799 |    $418,854 |        $346,595 |    $345,520 |
| 75+   |        $514,379 |    $497,442 |        $484,655 |    $447,058 |

Both samples stay inside existing 0504 literal bounds: 55–64 $220k–$420k and 65–74 $280k–$520k.
Fixing the car subsidy reduces savings while the gentler income/wealth curve increases them; this
is why the two were measured together. P2 does not solve the shorter spending horizon in old age;
P15 owns that, recorded as Found by P2 in roadmap.

### The reported $250,000 earner and outflow

Single, index 1, no owned home/children; compare the settled target, not the first year of creep.
The actual careers tax model takes $85,000, leaving $165,000. The roadmap's $175,000 take-home was
an approximation; P2 does not change tax. With $0 / $1m liquid wealth:

| Figure                                 | Before, $0 |  P2, $0 | Before, $1m | P2, $1m |
| -------------------------------------- | ---------: | ------: | ----------: | ------: |
| Comfortable living without a car       |   $145,188 | $82,238 |    $163,188 | $87,930 |
| Embedded car discount                  |    $12,341 |  $1,600 |     $13,871 |  $1,600 |
| Living plus a real $5,500 car          |   $138,347 | $86,138 |    $154,817 | $91,830 |
| Monthly outflow, including $85,000 tax |    $18,612 | $14,262 |     $19,985 | $14,736 |

At zero wealth with no car, chosen yearly living is $69,510 Frugal / $82,238 Comfortable /
$114,057 Lavish. Outflow still includes tax and one-off spending: an annual lifestyle estimate is
not a replacement for the dashboard's recorded total. The existing outflow test independently
pins recorded living + tax + one-offs, excluding investments/property transfers.

### Cash-buffer and tier comparison

Same 80 paired `hard-0`…`hard-79` seeds and undergraduate-major cycling as `floor.test.ts`/0308b.
Four existing policies: never invest; keep $40k then invest the rest in the broad index; invest all
spare money in that index; invest it in the ten-year bond. Existing career/college/card/systemic
choices remain identical across policies. For the tier cohorts hold one tier through adulthood;
this measures preferences, not a player timing switches. Terminal happiness and worth are at death,
which includes old-age health effects. Working happiness is the median of each life's 40–64 years,
then the cohort median. Investment cohorts are active graduate policies, not the passive age-band
calibration population; their large terminal fortunes are not the default calibration target.

| Policy            | Baseline terminal happiness | P2 Comfortable terminal | P2 Comfortable working |
| ----------------- | --------------------------: | ----------------------: | ---------------------: |
| Never invest      |                          16 |                      15 |                     67 |
| Cash buffer/index |                          16 |                      16 |                     67 |
| All-in index      |                          14 |                      14 |                     33 |
| All-in bonds      |                          13 |                      14 |                     29 |

The buffer advantage survives: terminal 16 versus 14 and working 67 versus 33/29. The historical
0308b values 78 versus 20 describe its earlier build, not this one; P2 reports both before and after
on the current cohort instead of copying them as current measurements. Existing floor guards stay,
and a new assertion pins the buffer's terminal happiness advantage over both illiquid policies.

| Tier        | Cash-buffer working happiness | Cash-buffer terminal worth | Annual living per adult year, median |
| ----------- | ----------------------------: | -------------------------: | -----------------------------------: |
| Frugal      |                            62 |                $12,515,992 |                              $52,633 |
| Comfortable |                            67 |                 $8,504,952 |                              $58,357 |
| Lavish      |                            69 |                 $4,041,729 |                              $76,865 |

The approved choice is visible: Frugal saves more and forgoes comfort; Lavish spends more for a
better-feeling working life. Lavish buffer happiness still exceeds all-in index/bonds (63/58).
No new balance numbers were chosen after approval.

## Tests and sabotage verification

New finance tests pin literal income/wealth targets, tier spending/floors/nudges, mortgage squeeze,
and actual-dollar car replacement across zero/below/at/above-cap costs and wealthy/lavish lives.
Simulation tests cover refusals, age 18, idempotent free choice, annual bill and mood, hardship,
mortgage floor, unpaid illiquid spending, saved history, the car-free housing quote, actual annual
cash/reconciliation, preview and simultaneous activity/lifestyle mood. Persistence tests cover
migration purity, malformed shape and deterministic round trips. Mobile uses the real store and
in-memory save repository to select/save tiers, show estimates/limits and surface each refusal.

Explicitly superseded tests: 0504's 8.5% discount/automatic full car squeeze is replaced by literal
P2 dollars and combined-cost checks; A10's non-pressable Living costs row becomes the approved link;
current-version assertions advance to v45. These were obsolete contracts, not weakened guards.
A seeded 0603 business fixture changed its car after the balance change, changing business listings
and lender obligations. Its original $47,353 cash and debt-free $11,200 car are now explicit; every
literal purchase price, down payment, borrowed amount, lender and ledger assertion remains unchanged.

Each mutation was applied alone, tested against the relevant finance/simulation/persistence or
real-store mobile suite, then restored. Only failed assertions counted as caught; syntax/import
failures did not. **29 mutations caught; none missed.**

| #   | Mutation                                | Result |
| --- | --------------------------------------- | ------ |
| 1   | middle income spend back to 74%         | Caught |
| 2   | upper income spend back to 74%          | Caught |
| 3   | linear wealth pull                      | Caught |
| 4   | Frugal does not save                    | Caught |
| 5   | Lavish has free comforts                | Caught |
| 6   | tier cuts basic needs                   | Caught |
| 7   | large car allowance                     | Caught |
| 8   | discount exceeds actual car cost        | Caught |
| 9   | car no longer affects living            | Caught |
| 10  | mortgage no longer squeezes spending    | Caught |
| 11  | annual bill ignores selected tier       | Caught |
| 12  | year forgets the saved tier             | Caught |
| 13  | hardship still rewards Lavish           | Caught |
| 14  | mortgage floor still rewards comforts   | Caught |
| 15  | seventeen year old may choose           | Caught |
| 16  | dead life may choose                    | Caught |
| 17  | pending question may be bypassed        | Caught |
| 18  | tier switch immediately farms happiness | Caught |
| 19  | annual tier mood is disconnected        | Caught |
| 20  | unpaid Lavish year gets a bonus         | Caught |
| 21  | Comfortable erases activity happiness   | Caught |
| 22  | migration defaults old saves to Lavish  | Caught |
| 23  | save accepts arbitrary tier             | Caught |
| 24  | save accepts below-subsistence standard | Caught |
| 25  | screen always chooses Comfortable       | Caught |
| 26  | store does not save the choice          | Caught |
| 27  | screen hides separate bills             | Caught |
| 28  | move-out gate ignores the chosen life   | Caught |
| 29  | preview ignores the chosen tier         | Caught |

## Verification and remaining checks

- Full `pnpm verify`: all **15 package typechecks** and **2,567 tests** pass. This includes the
  two disjoint 150-life calibration tests, real-store mobile tests (239 total), migration/reload,
  ledger reconciliation, determinism and the unchanged household/home/car/floor guards.
- Content validation fails on **nine pre-existing generator byte mismatches**: activities, advice,
  auctions, businesses, events-childhood, homes, renovations, valuables and vehicles. A fresh
  archive of origin/main `beff25a` reproduces all nine. Each generator exits successfully and its
  parsed JSON is identical to the catalog; only bytes differ. No catalogs are committed or
  reformatted. The validator's incidental vehicle-mods rewrite was restored.
- Every changed/added file passes Prettier. Global `pnpm format:check` still flags **22 untouched
  historical claude notes**, the same set reported for P1. No mass formatting is included.
- GitHub's available status/run readers return no statuses or pull-request workflow runs for
  main `beff25a`; a green current-main Actions run cannot be confirmed. Do not call local verify
  green or claim that CI cleared the byte-format issue.
- No `project_write` tool is exposed, so the changed docs cannot be mirrored to the Claude Project
  here. Repo docs are authoritative for this work. Native/on-device checks are unavailable; screen
  behavior is verified through the real game provider and repository, not claimed device-tested.
- P15 retains the old-age spending-horizon finding. No P3 work starts after this ticket.
