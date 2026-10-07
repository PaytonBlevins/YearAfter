# P4 — Economy effect on businesses: approved change

**Status: approved with strong expansion kept at +9%; built and verified; PR pending, baseline content/format gates remain blocked.**
Agent B, `feat/playtest-p4-business-economy`, 7 October 2026. Claim published separately before
measurement. Latest `origin/main` is still `beff25a`; this branch follows P1 #13, P2 #14 and P3 #15.
Payton approved the proposal with one exception: strong expansion keeps its original +9% demand
bonus. The other reductions and contextual thresholds are applied; no save shape/version change.

## Ticket contract

**Brief:** P4 / backlog B5: the economy should matter less to a business, with some effect retained.
**Spec sections:** MASTER_SPEC 393, 398–400, 404, 413–414; 706–724 (world economy), 849–878
(business dashboard), 979–1030 (performance and acquisition constraints), 1043–1059 (measurement
and reconciliation), 1060–1066 (protected contracts), 1108–1140 (save and RNG).
Historical 0604 references 1222 and 1392 are the line numbers of those economy/performance passages.
**Allowed files:** finance business/economy configuration and readers, simulation business settlement
and its contextual output, existing mobile business readers, relevant tests, P4 docs and CORE_RULES.
**Protected areas proposed:** business-only economy balance and thresholds for contextual explanations,
within the P1–P16 exception. No whole-world transition, investment/property balance, business catalog,
price/payroll/supplier/rescue rule, unrelated volatility, save shape or TICKET change.

### Acceptance after approval

- [x] Apply the exact approved values and retain differentiated industry sensitivity.
- [x] Normal-economy business output remains identical; bad/good conditions still matter.
- [x] Ledger, screen and timeline agree on the reduced effect without a new economy dashboard.
- [x] P1’s explicit rescue/closure behavior and lender priority remain intact.
- [x] Preserve saved business records; deterministic continuation and reconciliation pass.
- [x] Repeat calibration on production, tests and at least fifteen independent sabotage mutations.
- [ ] Update findings and CORE_RULES, format changed files, run full `pnpm verify`, PR to main, stop.

## What the code already does

There are two paths. `economyFor` multiplies demand by 1 + (state multiplier − 1) × the type’s
cyclicality. The strongest cyclical type feels all of a state; the least cyclical feels 15%.
Separately, named events tilt their odds with market conditions: a recession makes slow stretches
likelier, rivals open less often and close more often, and a big order is less likely. Event damage,
event chance (55%), and each year’s independent business shock are different rules.

The screen already explains the direct effect from the actual ledger. Its display threshold is
3%; the yearly downturn/boom lines start at 6% loss / 5% gain. The ledger stores an economy value
from a 0.5% effect. Halving demand effects while retaining those thresholds would make the positive
annual economy branch unreachable in the original all-halved proposal: even a fully cyclical boom would add only 4.5%. The proposal
therefore halves the explanation thresholds too, keeping reduced effects legible in existing context. Strong expansion remains unchanged in
demand but uses the approved lower context thresholds, so more booming trades can have an explanation.
No line wording change or new economy screen is proposed.

## Approved values — applied

Halve **severe recession, recession, slowdown and growth** direct effects. Keep strong expansion
at **+9%**, as Payton requested. Retain type cyclicality,
named-event odds/damage, market-state transitions, volatility, all other business controls and
P1 rescue choices. Apply to existing and new businesses from their next annual settlement.
Historical ledger records keep what actually happened in those years. Save stays v45; TICKET 0708.

| Economy state    | Current full-sensitivity demand effect | Approved effect     |
| ---------------- | -------------------------------------- | ------------------- |
| Severe recession | −26%                                   | −13%                |
| Recession        | −13%                                   | −6.5%               |
| Slowdown         | −5%                                    | −2.5%               |
| Normal           | 0%                                     | 0%                  |
| Growth           | +5%                                    | +2.5%               |
| Strong expansion | +9%                                    | **+9% (unchanged)** |

A cleaner still feels one quarter of those amounts: severe recession becomes −3.25%, rather than
−6.5%. A hotel feels 90%: −11.7%, rather than −23.4%. Demand is not necessarily actual revenue:
capacity can cap sales, and fixed costs amplify the effect on profit.

Corresponding explanation thresholds: ledger **0.5% → 0.25%**, screen **3% → 1.5%**, annual
loss line **6% → 3%**, annual gain line **5% → 2.5%**. Percentages remain derived from the actual
result. Market context stays visible in the same eligible years without extra timeline wording.
The ordinary 1× effect is retained as the control; 0.75×, 0.5×, 0.25× and 0× were measured.
0× is a diagnostic control, not recommended: some direct influence should remain.

## Method and limits

Throwaway harnesses are outside the repo. Each cohort contains **9,300 owners**: all 31 types,
300 per type, one location, no job, no loan, average stats 50, default pricing/supplier/payroll,
automatic staffing. Same `p1-baseline-${i}` seeds, `biz:2030:${type.id}:${i}` ids and opening year
2030 as P1. Follow ten years; stop a business at closure. Rescue-if-affordable offers a fresh
half-startup support budget each year; decline-all closes on any shortfall. This isolates business
performance, not a household cash/wealth forecast. Business draws do not replenish that budget.

Three economy controls:

- P1’s deliberately harsh cycle: normal, recession, strong expansion, normal, severe recession,
  repeated. Luck fixed at 1. Severe conditions occupy 20% of years here; this is a stress test,
  not the world’s ordinary severe-recession rate.
- Always normal: same draws and luck, verifying all candidate results are identical when neutral.
- Ordinary transitions: real `nextMarketState`, starting normal, keyed by
  `${seed}:p4-market:${year}`. Draw opening luck with the actual bounded log-normal rule from
  `${seed}:${id}:luck`. These are 300 market paths shared across the 31 trades, not 9,300
  independent world histories. The world RNG registry itself is not retuned.

The isolated candidate changes only the type’s direct cyclicality by the tested scale, algebraically
equivalent to scaling the business-only state effect. Event weights keep the original type and
market. Annual state includes real event/modifier, rival, staffing, cash, reserve and reputation
functions. **444,207 baseline annual business results exactly match `runBusinessesYear`.** Baseline
rescues are answered with real inject/decline commands; **23,171 answers reconcile**, and injected
businesses exactly match the harness’s resulting records. This establishes the candidate harness
against the production control; candidate code has not been installed in production.

Mature swing is measured in years 6–10. Absolute year-on-year profit change is divided by the
catalog’s mature annual revenue, which stays meaningful at a loss. Log SD uses consecutive
positive-profit pairs only; its survivor/positive selection differs between treatments. A lower
log SD is not guaranteed by this change. Five-year historical 0604 survival was 78.7%; this harness
reproduces P1’s 82.11% control, not 0604’s different population. The historical BLS comparison is
not a target that justifies forcing closures.

## Pre-approval candidate calibration

Harsh-cycle, rescue-if-affordable, 9,300 paired owners each:

| Direct strength | Five-year survival | Ten-year survival | Ever need review in ten years | Median mature absolute profit change / catalog revenue | Positive-profit log SD |
| --------------- | ------------------ | ----------------- | ----------------------------- | ------------------------------------------------------ | ---------------------- |
| 1×              | 82.11%             | 78.77%            | 40.27%                        | 7.48%                                                  | 1.179                  |
| 0.75×           | 82.99%             | 79.91%            | 37.77%                        | 7.18%                                                  | 1.193                  |
| 0.5×            | 83.71%             | 80.77%            | 36.04%                        | 6.96%                                                  | 1.168                  |
| 0.25×           | 84.35%             | 81.38%            | 34.58%                        | 6.80%                                                  | 1.166                  |
| 0×              | 84.71%             | 81.73%            | 33.81%                        | 6.73%                                                  | 1.127                  |

The proposed half-strength cycle improves five-year survival by 1.60 percentage points and
reduces median normalized mature profit swings about 6.9%. Ten-year review share falls from
40.27% to 36.04%. These are ten-year review shares; P1’s 36.96% control was five years.
Decline-all five-year survival goes from 63.04% to 66.84%; explicit player choices remain important.

Ordinary transitions with drawn opening luck:

| Policy               | Current five-year survival | Half-strength five-year survival | Current ten-year survival | Half-strength ten-year survival |
| -------------------- | -------------------------- | -------------------------------- | ------------------------- | ------------------------------- |
| Rescue if affordable | 83.44%                     | 83.55%                           | 80.43%                    | 80.67%                          |
| Decline all          | 65.17%                     | 65.54%                           | 62.34%                    | 62.84%                          |

Under ordinary transitions, rescue-policy median mature absolute profit change is 6.82% → 6.79%
of catalog revenue; positive-profit log SD is 1.111 → 1.126. General volatility remains similar,
which is expected: independent shocks, staffing and fixed costs are not changed. P4 softens the
economy-caused swing; it does not promise to resolve all of finding 37’s profit volatility.
Always-normal candidates exactly match: five-year survival 84.66% rescue / 69.31% decline.

## Pre-approval direct effect, separated from event odds

15,500 paired mature observations per candidate: 31 types × 500 identical shock draws, reputation
50, normal catalog staffing, one location, luck 1. Compare the same record in normal / severe
recession / strong expansion; no event modifiers here. Values below are changes in profit divided
by catalog annual revenue, not percentage losses of profit itself.

| Strength | Median severe-recession profit change / revenue | Median boom profit change / revenue | Median direct severe demand loss |
| -------- | ----------------------------------------------- | ----------------------------------- | -------------------------------- |
| 1×       | -8.75%                                          | +2.71%                              | 15.6%                            |
| 0.75×    | -6.49%                                          | +2.06%                              | 11.7%                            |
| 0.5×     | -4.28%                                          | +1.39%                              | 7.8%                             |
| 0.25×    | -2.11%                                          | +0.71%                              | 3.9%                             |
| 0×       | 0.00%                                           | +0.00%                              | 0%                               |

At half strength the median severe profit hit roughly halves (8.75% → 4.28% of catalog revenue),
as does the boom benefit (2.71% → 1.39%). The proposal’s ordinary-world survival change is small
because severe conditions are rare; it is not a global free-profit multiplier.

Event-odds control, age five, no live rival, averaged equally across 31 types. Expected share of
all years, including quiet ones: a slow stretch is 5.72% in normal conditions, 9.39% in recession,
12.12% in severe recession; a big order is 5.50% normal, 3.97% severe, 6.77% strong expansion.
These remain unchanged. A difficult economy still has consequences through those events and the
reduced direct demand effect. Event damage, youth weighting and competition remain as 0604 left them.

## Approved production calibration

The pre-approval tables above include a halved boom and remain historical measurement, not
what was shipped. The final production control repeats the same seeds, ages, budgets and policies
with severe/recession/slowdown/growth halved and strong expansion unchanged. All **448,189**
annual comparison records match `runBusinessesYear`; all **21,940** real rescue answers reconcile.

| Economy/policy                              | Before: five-year survival | Approved: five-year survival | Before: ten-year survival | Approved: ten-year survival |
| ------------------------------------------- | -------------------------- | ---------------------------- | ------------------------- | --------------------------- |
| Harsh cycle / rescue if affordable          | 82.11%                     | 83.85%                       | 78.77%                    | 80.77%                      |
| Harsh cycle / decline all                   | 63.04%                     | 67.16%                       | 59.73%                    | 64.15%                      |
| Always normal / rescue if affordable        | 84.66%                     | 84.66%                       | 81.72%                    | 81.72%                      |
| Always normal / decline all                 | 69.31%                     | 69.31%                       | 66.45%                    | 66.45%                      |
| Ordinary transitions / rescue if affordable | 83.44%                     | 83.59%                       | 80.43%                    | 80.76%                      |
| Ordinary transitions / decline all          | 65.17%                     | 65.61%                       | 62.34%                    | 62.96%                      |

Harsh-cycle rescue-policy median mature absolute profit change is 7.48% → 7.01% of catalog
revenue; positive-profit log SD 1.179 → 1.167. Ordinary-transition figures are 6.82% → 6.83% and
1.111 → 1.123. General volatility remains similar; the change softens economic influence.
Harsh-cycle ten-year review share falls 40.27% → 35.85%, ordinary transitions 37.66% → 37.04%.

The final 15,500 paired mature observations retain the original median boom profit benefit:
**+2.71% of catalog revenue**, unchanged. Median severe-recession profit change is **−4.28%**,
compared with the original −8.75%. Direct severe demand loss at median cyclicality is 7.8%,
compared with 15.6%. Neutral years and named-event odds/damage are unchanged.

## Implementation and tests

Only the business-specific demand coefficients change. Shared finance readers hold the approved
context thresholds; simulation records the actual multiplier and uses it for loss text, and the
existing screen reads the saved ledger. No new economy dashboard, save fields, migration, RNG
draws or world transition changes. Past ledger entries are not recomputed.

A boundary check exposed subtraction rounding: `1.015 - 1` can be slightly below 0.015, hiding
an exact 1.5% effect. Visibility compares the multiplier with `1 ± threshold` directly. Whole-percent
copy adds one machine epsilon before rounding, so an exact 1.5% says about 2%, not 1%. Positive
and negative boundaries and neighboring values are pinned. This is display precision, not another
balance change. Thresholds remain halved as approved; the +9% strong-expansion coefficient is not.

**35 new tests:** finance 14, simulation 11, persistence 2, mobile 8. They pin all six coefficients,
industry sensitivity including zero exposure, literal revenue/cost/profit, unchanged normal/boom
fixtures, threshold boundaries/rounding, live ledger and context, modest growth and ledger effects,
actual advance using its next market, deterministic replay, explicit rescue and closure with
reconciliation, historical-save preservation and current-rule continuation, and rendered rows.

Two old assertions described the superseded balance: restaurant recession below 0.95 and severe
recession between 0.7 and 0.9. They now pin exact approved multipliers **0.961** and **0.922**.
Strong-expansion assertions and all other controls remain. No tests were deleted or weakened.

## Findings and open checks

- General profit volatility (finding 37) remains; P4 does not promise to resolve every cause.
- Cheap-trade startup/profit proportions (finding 38), agents/suppliers, catalog and acquisition
  economics remain outside P4. Rescue policy and debt accounting are unchanged.
- Existing and new businesses use the new coefficients at settlement. Historical records keep
  old values. Save v45 and TICKET 0708 stay; no new version is reserved.
- Full verification and sabotage results are recorded below. PR review remains open.
- Native device checks and Claude Project `project_write` remain unavailable. P5 is not started.

## Full verification

`pnpm verify`: all 15 package typechecks and **2,633 tests** pass (P3 baseline 2,598 plus 35).
It ends with the same nine generator/catalog byte mismatches as unchanged `origin/main`:
activities, advice, auctions, businesses, events-childhood, homes, renovations, valuables and
vehicles. No catalog reformat is included; the validator’s incidental vehicle-mods rewrite is
restored. Global format still has the 22 historical-note baseline; changed files are checked
individually. Actual CI results are recorded after opening the PR.

The first save test imported content directly, which persistence does not depend on. Its fixture
now gets the real type through the public simulation market, with a consistent funded adult
ledger. Dependencies and lockfile remain unchanged. The full passing run includes that correction.

## Independent sabotage verification

Tar backup before mutation; each change isolated, tests run, production restored after each.
All five source files’ final MD5s match their backups. **All 26 mutations caught; none missed
in the final run.** One initially survived: a negative owner payout. The unfunded fixtures had
no owner draws, so they could not catch it. Added a funded-owner case that pins a positive income
transaction, household ledger change and business-plus-owner cash conservation; the same mutation
then failed an assertion. No production workaround or weaker assertion was used.

A screen-percentage selector initially matched both signs; the uniqueness guard stopped it before
mutation. It was narrowed to the loss phrase and tested. Every reported catch is an assertion failure,
not a compiler failure. Selected baseline suites all pass after restoration.

| Mutation                                           | Result |
| -------------------------------------------------- | ------ |
| 1. wrong severeRecession demand                    | Caught |
| 2. wrong recession demand                          | Caught |
| 3. wrong slowdown demand                           | Caught |
| 4. wrong normal demand                             | Caught |
| 5. wrong growth demand                             | Caught |
| 6. wrong strongExpansion demand                    | Caught |
| 7. restore old ledger threshold                    | Caught |
| 8. restore old screen threshold                    | Caught |
| 9. restore old loss threshold                      | Caught |
| 10. restore old gain threshold                     | Caught |
| 11. discard industry cyclicality                   | Caught |
| 12. reverse demand sign                            | Caught |
| 13. exclude exact visibility boundaries            | Caught |
| 14. use subtraction for visibility boundary        | Caught |
| 15. remove half-percent rounding tolerance         | Caught |
| 16. force normal live business market              | Caught |
| 17. omit economy from ledger                       | Caught |
| 18. restore old downturn trigger in live output    | Caught |
| 19. restore old growth trigger in live output      | Caught |
| 20. invent 26 percent loss text                    | Caught |
| 21. remove annual independent shock                | Caught |
| 22. pay negative owner draws                       | Caught |
| 23. restore old screen threshold at call site      | Caught |
| 24. invent screen percent rather than ledger value | Caught |
| 25. remove severe slow-stretch event tilt          | Caught |
| 26. erase historical ledger economy during save    | Caught |

CORE_RULES lessons 13.142–13.143 cover contextual thresholds and exact-boundary precision.
P5 and general life-event wording remain unstarted.
