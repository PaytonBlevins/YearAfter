# P4 — Economy effect on businesses: measured proposal

**Status: claimed and measured; awaiting Payton’s balance-value approval. Not implemented.**
Agent B, `feat/playtest-p4-business-economy`, 7 October 2026. Claim published separately before
measurement. Latest `origin/main` is still `beff25a`; this branch follows P1 #13, P2 #14 and P3 #15.
No production code, balance, save or approved decision has changed for P4.

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

- [ ] Apply the exact approved values and retain differentiated industry sensitivity.
- [ ] Normal-economy business output remains identical; bad/good conditions still matter.
- [ ] Ledger, screen and timeline agree on the reduced effect without a new economy dashboard.
- [ ] P1’s explicit rescue/closure behavior and lender priority remain intact.
- [ ] Preserve saved business records; deterministic continuation and reconciliation pass.
- [ ] Repeat calibration on production, tests and at least fifteen independent sabotage mutations.
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
annual economy branch unreachable: even a fully cyclical boom would add only 4.5%. The proposal
therefore halves the explanation thresholds too, preserving the set of eligible businesses/years for future settlements.
No line wording change or new economy screen is proposed.

## Proposed values — not applied

Halve **both positive and negative direct business demand effects**. Retain type cyclicality,
named-event odds/damage, market-state transitions, volatility, all other business controls and
P1 rescue choices. Apply to existing and new businesses from their next annual settlement.
Historical ledger records keep what actually happened in those years. Save stays v45; TICKET 0708.

| Economy state    | Current full-sensitivity demand effect | Proposed effect |
| ---------------- | -------------------------------------- | --------------- |
| Severe recession | −26%                                   | −13%            |
| Recession        | −13%                                   | −6.5%           |
| Slowdown         | −5%                                    | −2.5%           |
| Normal           | 0%                                     | 0%              |
| Growth           | +5%                                    | +2.5%           |
| Strong expansion | +9%                                    | +4.5%           |

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

## Survival and profit-swing calibration

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

## Direct effect, separated from event odds

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

## Recommendation, findings and next work

Recommend **0.5× direct strength** with matching explanation thresholds. It substantially reduces
the bad/good economy’s immediate profit effect without removing it or retuning the whole business.
The 0.25× candidate removes three quarters of the signal; the 0.75× candidate offers a smaller
reduction. Half strength fits the requested change and preserves ordinary-year economics.

- General year-on-year volatility (finding 37) remains. This is measured, not a hidden follow-up tune.
- Cheap-trade startup/profit proportions (finding 38), agents/suppliers, business catalog and
  acquisition economics remain outside P4. No change to rescue policy or debt accounting.
- Existing and new businesses can use the new coefficient without a save bump; historical records
  keep their original economy values. Save stays v45. No RNG, new fields or migration proposed.
- After approval: production configuration/readers, literal and integration tests, save/replay and
  reconciliation checks, post-change calibration, 15+ sabotage mutations, CORE_RULES, full verify,
  PR into main and stop before P5. None of those implementation checks is claimed complete now.
- Nine catalog byte mismatches and 22 historical-note format failures are the existing P3/main
  baseline. No catalogs or historical notes were reformatted for this measurement pass.
- Native device checks and Claude Project `project_write` remain unavailable.

Payton’s approval is required before applying these new balance values, as specified in
`playtest-rules-brief.md` under “One ticket at a time, then stop.”
