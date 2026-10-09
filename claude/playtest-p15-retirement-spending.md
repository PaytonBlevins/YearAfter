# Playtest P15 — spending from savings in later retirement

Payton authorized P15 after P14 closeout on 9 October 2026 and explicitly
**preapproved the eventual measured proposal**, asking for the final choices to
be relisted at completion. No additional balance-approval stop is required.
Claim published separately as `5cc3709` before measurement on
`feat/playtest-p15-retirement-spending`, following P14 #26 and #13–#25. Refreshed
main remains `beff25a`. P16 and life-event wording wait.

## Contract and scope

Brief P15 / roadmap finding 12, interaction with P2. Binding MASTER_SPEC sections
20–22 (private ledger/contextual costs, with P2's approved lifestyle exception),
163/1851 (retirement folded into assets), 1695 (retirement benefits), 1043–1059
(measurement/reconciliation), 1060–1066 (protected contracts), 1108–1140
(save/RNG) and CORE 13.43–13.45, 13.53, 13.57, 13.85, 13.88–13.91 and 13.149.
Read 0303/0304, 0310, 0502, current P2 policy and actual living/retirement/annual
settlement, debt/net-worth and mobile readers.

Allowed: finance living target/config/tests; simulation living phase, annual
retirement-income wiring/tests; persistence compatibility tests; existing
Lifestyle/Retirement screen wording and tests; this ticket, claims, handoff,
roadmap and CORE lesson. Protected contracts touched: prospective living balance
and retirement income availability within annual advancement, authorized by the
P1–P16 brief and explicit P15 preapproval. Expected save v50 stays: policy can
read existing age, retirement flag, holdings/debts and remembered living standard.
No new version reserved; return to the save contract if that changes.

No forced retirement, automatic asset sale, new retirement product, medical/care
subsystem, altered longevity/illness, pension benefit/draw rate/market retune,
P2 lifestyle multiplier/mood change, tax change, P16 partner earnings or life-event
wording. TICKET stays 0708. Approved-decisions is left settled.

## Baseline: the original diagnosis is incomplete

Two independent 150-life samples (`veh-0`…`veh-299`) on actual P14 production,
full `advanceYear`, first-choice decisions with last-choice fallback, every annual
ledger reconciled. Passive policies do not retire: around 97–98% of 75–84
observations still have a job and none has the retirement flag. Wealth growth
includes wages and property appreciation, not just unspent retirement savings.
Do not treat a continuously employed passive sample as a retired population.

| Policy / cohort             | 65–74 worth | 75–84 worth | 85+ worth | Same survivors, median 75→85 change |
| --------------------------- | ----------: | ----------: | --------: | ----------------------------------: |
| Passive A                   |    $418,562 |    $478,679 |  $572,701 |                       +$75,373 (58) |
| Passive B                   |    $350,910 |    $417,433 |  $513,507 |                       +$78,945 (58) |
| Attempt retirement at 65, A |    $371,545 |    $368,936 |  $364,868 |                        −$4,635 (67) |
| Attempt retirement at 65, B |    $305,329 |    $316,768 |  $333,656 |                        −$1,811 (65) |

Explicit retirement already gives falling total wealth to 58%/51% of the paired
75→85 survivors. Nevertheless, median liquid cash rises $121k→$148k in A and
$75k→$138k in B across the oldest bands; current standard has no shorter savings
horizon. Cross-sectional medians mix different survivors and are not a within-life
spending rate. Track both statistics, cash, hardship and actual paid bills.

Reading the annual producer also found a related concrete defect: living runs
before `drawYear`, so the player's state/earned pension does not reach its income
input, and the account's cash withdrawal does not reach current available cash.
The ledger pays all three later. A partner's pension already feeds living via
`partnerIncomeFor`. Fix the player's consuming reader; do not invent new pension
benefits, call a principal transfer earned income or pay any row twice.

## External anchors and their limits

[Federal Reserve 2022 SCF, table 2](https://www.federalreserve.gov/publications/october-2023-changes-in-us-family-finances-from-2019-to-2022.htm),
read 9 October 2026, reports median family net worth $409,900 at 65–74 and
$335,600 at 75+ in 2022 dollars. This is a cross-sectional household reference,
not evidence that every same person must lose exactly that amount; game dollars,
selection, survivor composition and skilled play differ.

[SSA 2023 period life table, 2026 Trustees Report](https://www.ssa.gov/oact/STATS/table4c6.html),
read 9 October, reports remaining life expectancy at 75 of 11.42 male/13.10 female
years. A conservative common spending horizon is a game policy, not a predicted
death date, a sex-specific price or personal financial advice. It must retain a
minimum horizon for long-lived characters and a bill reserve.

## Candidate calibration

Throwaway harnesses outside git compare prospective savings horizons on actual
retired lives, with the pension/withdrawal consuming-reader correction. No
production files or save shapes are edited during the measurement. Candidates
start at 75 only after the player has chosen retirement, plan toward ages
95/100/105 and keep at least eight years in every case. Reserve the larger of
$12,000 and half the ordinary comfortable living + home/car commitment bill.
Count liquid cash and portfolio, subtract personal card/loan debt; do not spend
home equity, business tills, undrawn retirement balances or credit limits.
Normalize the annual allowance back through household/location/housing factors;
apply it via the existing 34% up / 12% down creep, then existing tier, mortgage
squeeze and hardship.

## Acceptance

- Literal start/eligibility/horizon/reserve, debt, geography/household normalization.
- Existing pre-75 and nonretired P2 targets unchanged; floor/tiers/mood preserved.
- Real advance recognizes existing pension income and released principal once;
  withdrawal stays a transfer and the ledger reconciles.
- Old/current saves replay deterministically without money/history/RNG edits.
- Existing screens explain behavior and estimates, with actual store/tier saves.
- Paired production/lifetime calibration, at least 15 independent valid sabotage
  mutations with exact restoration, full verify/changed-file formatting.
- Docs/CORE and PR into main, stop before P16.

## Final preapproved choices and production calibration

- Only player-selected retirement at age **75+** gets the added allowance.
- Plan toward age **100**, with a minimum **eight-year** horizon; no death prediction.
- Spread **half** the remaining net liquid savings over that horizon each year.
- Reserve the larger of **$12,000** or **six months** of the ordinary comfortable
  living plus housing/car commitments. Reserve does not depend on the selected tier.
- Count cash, portfolio and this year's released retirement principal; deduct
  personal card/loan balances. Exclude home equity, business tills/debt, unused
  credit and undrawn retirement accounts. No automatic sale or extra withdrawal.
- Normalize the allowance once through household/location/housing factors and
  add it to the P2 income-only target, retaining at least the ordinary P2 target.
  Existing 34% upward/12% downward standard creep, Frugal/Comfortable/Lavish
  80/100/150%, floor, mortgage squeeze, hardship and paid-year mood stay.
- Feed existing state/earned pension to current living income and released
  principal to available cash. Principal remains an investment transfer, posted
  once; retirement benefits, 1/22 draw rate, market/RNG order and tax policy stay.
- Existing Lifestyle/Retirement screens explain this. Save **v50** stays, with no
  migration/field change, no new expense breakdown and no longevity change.

Literal example: a retired 75-year-old with $512,000 liquid funds, no debt and a
$12,000 reserve has $500,000 spendable. Half divided by 25 years gives a $10,000
annual target allowance before existing standard creep and tier selection. The
reserve limits extras; it is **not** a guaranteed bank floor. Basic needs and
other bills can still exhaust cash, and securities must be sold by the player.

Measured 1,800 candidate retired lives (whole-pool horizons 95/100/105, half-pool
100/105 and a near-zero-allowance pension-reader control). Whole-pool 100 brought
85+ worth to $112k/$101k and annual shortfalls to 33%/28%; rejected as too aggressive.
Half-pool 100 retains a longer horizon and reserve while reducing later cash
accumulation. Then ran **300 actual production lives**, without candidate spies;
every recorded age-band and paired statistic matches the selected candidate exactly.

| Selected production cohort | 65–74 worth | 75–84 worth | 85+ worth | Paired 75→85 median change | Paired share losing wealth |
| -------------------------- | ----------: | ----------: | --------: | -------------------------: | -------------------------: |
| A                          |    $358,959 |    $269,776 |  $180,872 |    −$67,474 (67 survivors) |                     80.60% |
| B                          |    $295,183 |    $231,864 |  $150,019 |    −$42,497 (64 survivors) |                     81.25% |

75–84 → 85+ median cash falls $133,224→$93,638 / $146,357→$92,342;
paid living falls $29,297→$24,045 / $29,738→$24,744. These are survivor bands,
not identical households. Pre-retirement 55–64 worth stays exactly $349,032/$280,393
and existing P2 acceptance tests pass unchanged. Pension input is corrected from
retirement onward, so 65–74 is intentionally affected; the extra allowance starts 75.

**Material limitation:** baseline retired 85+ shortfall rates were 4.58%/7.80%,
versus **27.86%/21.91%** under production. Most increase comes from fixing the
previously suppressed pension-based living bill: the pension-reader-only control
already has 27.10%/20.85% shortfalls and paired median declines $45,643/$33,099.
The savings allowance adds further spending. This is not a promise of comfortable
retirement for poorly funded lives; no forced liquidation or hidden subsidy is
introduced. The B paired count changes 65→64 with the corrected financial-stress
path, so neither this nor a cross-sectional US household median proves a pure
same-person causal effect. Keep retirement selection and underfunded-retiree
hardship as explicit follow-up findings rather than forcing a wealth benchmark.

## Acceptance and sabotage results

31 new tests: finance 13, real annual simulation 8, persistence 4, real-store
mobile components 4, paired lifetime balance 2. Literal boundary/normalization,
retirement income and principal ledger classification, excluded debt, saved tiers,
v49 migration/current-v50 replay, hardship/mood and both 150-life retired cohorts
are covered. Every generated annual ledger reconciles.

**23 valid independent production mutations caught; none missed.** Each ran against
focused acceptance tests with production source restored byte-for-byte afterwards:

1. Start allowance at 74.
2. Give working elders the retirement allowance.
3. Plan to 95 rather than 100.
4. Collapse the minimum horizon to one year.
5. Spend the whole pool rather than half.
6. Remove the $12,000 reserve.
7. Remove the half-year commitments reserve.
8. Ignore personal debt.
9. Allow a negative spendable pool.
10. Count location twice in the allowance.
11. Omit P2 income from the target.
12. Bypass retirement planning in the living phase.
13. Bypass remembered-standard creep.
14. Ignore the actual lifestyle tier.
15. Omit state pension from living income.
16. Omit earned government pension from living income.
17. Treat withdrawn principal as earned income.
18. Exclude released principal from available living cash.
19. Deduct business borrowing from personal savings.
20. Treat unused card limits as debt.
21. Post principal as income in the ledger.
22. Show active later-retirement wording to workers.
23. Falsely imply investments need not be sold to pay bills.

An initial #23 text replacement did not match the formatted source; it never
applied a mutation and is excluded. Corrected injection applied and failed its
assertion test. No valid survivor or test weakening; original source restored.

## Verification and open checks

Full `pnpm verify`: **3,306 tests and all 15 typechecks pass**. It then fails on the
same seven inherited generator/catalog byte mismatches (activities, advice,
auctions, businesses, childhood events, homes and vehicles). Full format reports
exactly the same 22 historical Claude-note files; changed-file format and diff
checks are recorded at closeout. Validator's incidental vehicle-mod formatting
was semantically equal and restored exactly; no catalog edits are included.
Native/device checks and unavailable Claude Project mirroring remain open.
PR #27: https://github.com/PaytonBlevins/YearAfter/pull/27 targets main, depends on #13–#26, and is mergeable when checked. Implementation `867086f` published; CI 165 fails the same 22 historical-note format checks, verified against logs; install passes and later gates skip. Docs-closeout CI will be unobserved. P16 and life-event wording wait for Payton.
