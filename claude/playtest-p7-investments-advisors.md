# Playtest P7 — investments and advisors

**Status:** approved P7 engine/save/screens built, verified; publication in progress,
8 October 2026 UTC. Payton approved the proposal with **15% for investing in general**, not
just one stock. Every advisor buy, including funds and reinvestment, uses 15% of spare cash.
The initial 25% idle-cash prototype below is historical, not the final calibration. P8 waits.
**Branch:** `feat/playtest-p7-investments-advisors`, stacked on P6 PR #18 and #13–#17;
`origin/main` remains `beff25a`. Claim published separately before measurements.
**Spec sections:** 949–978 (balance/economy), 1043–1059 (reconciliation), 1108–1140
(save/annual cadence), 1222–1246 (financial persistence), 1383 (advisor), 1691 onward (0308/0309).
**Allowed files:** finance advisors/market and their tests; simulation investments/state and tests;
persistence schema/migrations/serialization and save tests; mobile Advisor screen/store and tests;
this doc, HANDOFF, CLAIMS, roadmap, approved decisions and CORE_RULES lessons.
**Protected areas touched:** explicit approved investment balance, advisory sizing and optional
save goal. No business macro retune, private deals, retirement spending, tier/fee changes or
life-event wording. Existing tests remain; old current-save-v45 literals now assert the current
version, with an explicit P7 v46 guard. Historical migration inputs keep their old versions.
**Save:** v46 claimed and built; old lives get no invented goal and no RNG draw. TICKET stays 0708. `approved-decisions.md` records the actual approval. Native checks and Claude Project
mirroring remain unavailable in this session.

## Findings from the actual commands

- `SLICE = 0.34` uses total cash, not cash after a household reserve. At $86,000 with an empty
  portfolio the paid advisor suggests $74,000 for idle cash and $29,240 on one stock.
  Those are separate recommendations; they are not simultaneous executed transfers.
- `actOnAdvice` recomputes recommendations, but a reduction without an instrument sells the
  largest holding overall. With $40,000 crypto and a $50,000 Government Bond Fund holding,
  the $20,200 speculative reduction sells the bond fund. Crypto's share rises from 44.4%
  to 57.3%. A technology-sector rebalance similarly sells the unrelated bond fund and
  raises technology's share from 41.9% to 43.5%.
- A reduction can stop at one holding even when its stated amount spans several holdings.
  A rebalance currently leaves proceeds as cash, rather than reallocating them.
- `broadestFund()` chooses the lowest-volatility fund: **Government Bond Fund**, not the
  **Broad Market Index**. Broad Market Index is `fd.broadindex`; an initial exploratory
  harness inherited this naming mistake. All final index comparisons below use that exact id.
- Paid forecasts can emit a zero-dollar buy at zero cash. Suppress unexecutable buys.
- No explicit saved purchase goal exists. Home/car ownership is not evidence that a player
  wants to save for another purchase. Do not silently invent a goal.

## Market measurement

250 seeded paths, 40 years each: 10,000 market-years with shared market draws, sector draws
and one instrument draw per catalog entry. Table pools individual instrument-years. It
measures annual price changes, excluding coupons and dividends; rounded quantiles are not
portfolio returns. Current production is compared with a scratch copy multiplying broad
market effects, sector shocks and individual shocks by **0.80**. Drift, payouts, reversion,
market transitions, tiers, floors and caps are unchanged.

| Kind        | Observations | Current price-change SD | Prototype SD | Current loss >20% | Prototype loss >20% |
| ----------- | -----------: | ----------------------: | -----------: | ----------------: | ------------------: |
| Stock       |      420,000 |                  23.39% |       18.80% |            13.74% |               8.95% |
| Penny stock |      120,000 |                  39.35% |       32.31% |            25.65% |              23.74% |
| Crypto      |      140,000 |                  37.67% |       30.95% |            20.94% |              18.36% |
| Fund        |       80,000 |                  14.67% |       11.82% |             4.81% |               2.73% |
| Bond        |      130,000 |                   2.25% |        1.80% |                0% |                  0% |

Current → prototype mean price changes: stocks 5.45% → 5.36%, penny 2.60% → 1.54%,
crypto 5.78% → 5.23%, funds 4.63% → 4.64%, bonds 0.384% → 0.384%. The penny change
reflects clipping and cent-price rounding even with unchanged drift; this must remain visible
in the final calibration, not be described as identical expected returns.

A separate 6,000-year matched-draw correlation probe gives same-sector stock correlation
0.727 → 0.726 and cross-sector 0.206 → 0.205. Existing diversification and floor/maturity
contracts remain binding. A neutral-draw crash/recession/slowdown path recovers its starting
stock-price average in year 9 currently and year 7 in the prototype. This is a deterministic
fixture, not a population estimate of recovery time. Crash-buy versus boom-buy and longer
horizons must be remeasured after the real implementation.

## Advisor comparison: controlled investing

500 matched seeds, 40 years, $12,000 initial cash reserve and $10,000 added per year.
Each year, the self policy invests cash above $12,000 into a separately seeded random
non-bond name. Advisor policies make that same initial purchase, then execute that year's
recommendations. The index reference purchases `fd.broadindex`. Shared market prices,
actual buy/sell commands, actual hiring gates, holding income/maturity and the paid advisor's
0.2% annual portfolio fee are included. Every year's ledger reconciles. Final wealth is
cash plus portfolio, after fees. Living costs, taxes and life choices are excluded here.
This compares with a specified picking policy, not every possible human strategy.

Prototype advice uses 25% of spare cash for idle cash, 15% for a single name, a protected
$12,000 reserve in this $24,000-cost fixture, applicable holdings for risk reductions and
an explicit Broad Market Index destination for surplus reduction proceeds. The tables
are experiments outside production, not shipped behavior.

| Policy / model                        | Final wealth p10 |     Median |        p90 | Paired wins over self | Median cumulative fees |
| ------------------------------------- | ---------------: | ---------: | ---------: | --------------------: | ---------------------: |
| Current self                          |         $509,284 | $1,141,359 | $3,294,884 |                     — |                     $0 |
| Current free advisor                  |         $595,375 | $1,217,954 | $2,913,416 |                 65.4% |                     $0 |
| Current paid advisor                  |         $654,210 | $1,410,100 | $3,121,125 |                 66.8% |                $32,651 |
| Current Broad Market Index            |       $1,212,521 | $2,180,927 | $3,655,341 |                 88.0% |                     $0 |
| Prototype free advice, current market |         $719,274 | $1,440,686 | $3,201,491 |                 82.0% |                     $0 |
| Prototype paid advice, current market |         $822,193 | $1,605,178 | $3,252,070 |                 85.6% |                $39,641 |
| Softer market self                    |         $662,639 | $1,271,623 | $3,010,150 |                     — |                     $0 |
| Softer market + prototype free        |         $852,909 | $1,512,802 | $2,860,102 |                 81.2% |                     $0 |
| Softer market + prototype paid        |         $974,879 | $1,659,204 | $2,938,281 |                 84.8% |                $40,469 |
| Softer market Broad Market Index      |       $1,478,792 | $2,294,629 | $3,341,586 |                 89.4% |                     $0 |

The repaired advice improves this controlled comparison even without a volatility change.
Index-only still has the higher median. Do not sell an advisor as beating every strategy,
repeat the old 0309 percentages as current, or claim a forecast guarantees a return.

Rejected exploratory variants: smaller buys with the old sale/routing logic yielded only
42.4% paid wins under the softer market. Correct targets but retaining the mistaken bond-fund
destination yielded 51.4% at 15% single-name sizing. Sweeps at 10%, 20% and 25%, and looser
concentration/speculation thresholds, did not justify changing the existing risk bars or fee.
Simply reducing cheque sizes is insufficient.

## Whole-life check: a remaining acceptance problem

100 seeds `p7-life-0`…`p7-life-99`, first-choice passive policy through 18, cloned through the
actual v45 save loader for each strategy, actual annual engine through 55 or death. Age-45–54
living snapshots supply 980 observations (983 for all-index). All ledger years reconcile.
Cash-gated events can change later paths: outcomes are not identical-state causal comparisons.

| Current policy                        | Median net worth at 45–54 | Happiness p10 / median | Post-year cash <$1, all observed adult years |
| ------------------------------------- | ------------------------: | ---------------------: | -------------------------------------------: |
| No investing                          |                  $163,904 |                54 / 72 |                                        4.57% |
| Invest all cash in index              |                  $637,495 |                38 / 69 |                                       28.22% |
| Index with fixed $12,000 reserve      |                  $363,149 |                54 / 72 |                                       27.86% |
| Random picks with fixed reserve       |                  $246,020 |                54 / 71 |                                       27.31% |
| Current free advisor                  |                  $245,365 |                54 / 73 |                                       22.99% |
| Current paid advisor                  |                  $250,036 |                50 / 71 |                                       20.61% |
| Prototype free advice, current market |                  $245,237 |                55 / 71 |                                       25.01% |
| Prototype paid advice, current market |                  $228,381 |                54 / 71 |                                       22.31% |

The last two policies use the larger dynamic reserve for their initial purchases and the
prototype actions. They are an affordability-policy comparison, not isolated advisor alpha.
Their cost input uses the existing living estimate only; it omits separately billed owned-home,
vehicle and debt payments. The production proposal below corrects this underestimate and
therefore needs another measured pass. These rows do **not** establish that the proposed
advisor beats picking alone throughout a real life. The paid median is lower. Do not mark
B12 complete based on the controlled table alone.

The historical happiness 20 versus 78 from 0308b does not reproduce on this P2/P6 stack:
current all-index median 69 versus buffered 72, with a substantial p10 difference 38 versus 54. Keep the cash consequences; do not retune happiness to recreate an old headline.
Current paid cumulative fees through 55 have p10/median/p90 $846/$5,275/$20,232;
prototype $878/$4,204/$19,490. Life spending and opportunity effects must be reported
alongside return metrics when the actual combined model is rerun.

## Historical proposal (approved with universal 15% amendment)

1. **20% smaller investor shocks:** use the 0.80 market/sector/individual shock multipliers
   above. Preserve market-state probabilities, drift, payout, reversion, floors, caps and
   business P4 coefficients. Keep penny/crypto visibly riskier than ordinary diversified funds.
2. **Protect six months of recurring bills, with a $12,000 minimum**, plus the player's
   explicit purchase goal. Use shared bill calculators: current living estimate plus separately
   billed residence expenses/mortgage, vehicle running costs/payments and personal scheduled
   debt/card minimums. Exclude income tax, purchase prices, gifts and business/rental operating
   accounts; no duplicate housing/car allowance or business-loan payment. This is an estimate
   at today's commitments, not a promise about emergencies. Do not count invested wealth or
   available card credit as cash. No automatic liquidation or prohibition on manual purchases.
3. **Suggest 25% of spare cash for idle cash and 15% for one stock**, instead of all cash above
   $12,000 and 34% of total cash. Suppress buy suggestions under $1,000, recompute after each
   tap and enforce the current reserve in the command, including stale-screen actions.
   Preserve the existing idle-cash portfolio multiple, advisor risk thresholds and paid fee.
4. **Make reductions target what their explanation names**, spanning applicable holdings when
   necessary. Fund the reserve first, then reallocate surplus sale proceeds into the explicit
   Broad Market Index. A sector reduction touches that sector; speculative reduction touches
   crypto/penny; a named trend reduction touches that name. Show source, destination and
   estimated cash retained before the player presses the action. Preserve player initiation;
   advisors do not trade each year automatically. Index transfer is a proposal, not an existing
   guaranteed consequence of the word “rebalance”.
5. **A small “Saving for a purchase” section on the existing Advisor screen**, present both
   before and after hiring: optional dollar target, Set/Clear, and a plain breakdown of protected
   bill money, purchase target and spare cash. No inferred home/car goal and no new wealth
   dashboard. Persist only the optional cash target with a no-RNG migration defaulting to none;
   malformed/negative/nonfinite values are rejected. Proposed next save version v46 if free.
   A goal remains until the player changes/clears it; it is not automatically spent or cleared.

Examples from the scratch recommendation function, $86,000 cash, no holdings:

| Annual bill estimate |    Goal | Protected cash | Idle-cash suggestion | Single-name suggestion |
| -------------------- | ------: | -------------: | -------------------: | ---------------------: |
| $24,000              |      $0 |        $12,000 |              $18,500 |                $11,100 |
| $45,000              |      $0 |        $22,500 |              $15,875 |                 $9,525 |
| $90,000              |      $0 |        $45,000 |              $10,250 |                 $6,150 |
| $45,000              | $65,000 |        $87,500 |                 None |                   None |

These are alternative recommendations from one snapshot, not an instruction to execute both
amounts unchanged. With the goal covered and surplus remaining, only that surplus is eligible;
idle cash is quiet when the target and reserve leave no meaningful spare money.

Approval authorizes building and calibrating this candidate; it does not waive the whole-life
performance requirement. If the corrected full-life model still fails, report it and propose
any additional product dial instead of silently changing risk, fees or promising superiority.

## Implementation acceptance

- [x] Engine and screens use one derived recurring-bill/reserve calculation without duplicated charges.
- [x] No advisory buy crosses protected cash; zero/sub-minimum buys suppressed; stale ids rechecked.
- [x] Goal set/clear, rejection language, both screen branches and purchase-goal silence tested.
- [x] Correct sector/speculative/named-sale targets, multiple holdings and explicit index transfer tested.
- [x] Actual command reruns reproduce positive paid net-of-fee controlled results and a convincing
      whole-life comparison; report distributions, paired wins, spending, cash, happiness and stress.
- [x] Market risk hierarchy, correlations, concentrated/spread comparisons, crashes, horizons,
      coupons/maturities and floor guarantees remain; no weaker/deleted tests.
- [x] Save version claimed, no-RNG migration, round-trip, malformed shape and seeded replay tests.
- [x] At least fifteen independent sabotage mutations; fix survivors, restore and verify hashes.
- [x] Full `pnpm verify`, changed-file formatting, full format and actual CI reported honestly.
- [x] Final docs, approved decisions, CORE_RULES lessons, roadmap, PR into main; stop before P8.

Initial measurements used scratch harnesses; final actual-command runs and verification are recorded below. The P6 full-check baseline was 2,713 tests and 15 typechecks passing, nine
catalog validation mismatches and 22 historical-note formatting failures. Recheck on the
implemented P7 branch; do not rewrite catalogs or old notes as an incidental fix.

## Final implementation and measurements

The 15% rule applies to every advisor buy, including idle cash and index transfers from a
reduction. A transfer takes at most the smaller of sale proceeds and 15% of spare cash after
funding the reserve; the remaining sale proceeds stay in cash. Existing manual investment
amounts are unchanged. No annual auto-trading was introduced. Cash-goal Set/Clear checks
alive/adult/pending gates and safe nonnegative whole-dollar amounts, changes no money or RNG,
and is saved immediately. Zero clears it. Goals stay until explicitly changed/cleared.

The recurring-bill reader adds separate residence, vehicle, loan and card payments to the
existing living estimate after its allowances. Active-business operating payments stay
outside; debt signed for a closed business is now a household commitment. Student loan
deferral and card interest/minimum calculations come from the actual settlement routines.
Neither bill estimates nor previews post money or consume RNG. Each trade rechecks live
advice and the reserve. The screen previews actual source/destination/cash retention through
the same pure command, distinguishes forecasts, and removes stale statistical sales claims.

Save tests found an additional existing bug: `fromSave` passed the hired advisor to a state
constructor that dropped it. Both advisor and purchase goal now survive that constructor.
An heir begins a new personal goal/advisor state; no inherited purchase target is invented.

### Final controlled returns: universal 15%, actual commands

Same 500-seed, forty-year $10,000 annual contribution/$12,000 starting-buffer design as above.
Production market and advisor functions, actual hiring and 0.2% fees; every year reconciles.

| Policy             |      Final wealth p10 / median / p90 | Paired wins over random picking | Median cumulative fee |
| ------------------ | -----------------------------------: | ------------------------------: | --------------------: |
| Self               |   $662,639 / $1,271,623 / $3,010,150 |                               — |                    $0 |
| Free advisor       |   $793,763 / $1,398,076 / $2,750,567 |                           71.0% |                    $0 |
| Paid advisor       |   $868,511 / $1,497,794 / $2,612,332 |                           73.6% |               $36,319 |
| Broad Market Index | $1,478,792 / $2,294,629 / $3,341,586 |                           89.4% |                    $0 |

Paid median is 17.8% above matched random picking after fees; free is 9.9% above. Universal
15% retains more cash than the initial larger-reinvestment prototype and therefore has lower
controlled returns. Actual measured price SDs reproduce the softer-market column above.

### Whole lives: following advice, with stronger controls disclosed

300 seeds `p7-life-0`…`p7-life-299`, actual engine and save cloning, first-choice passive
life policy, to 55/death. Strategies share the dynamic bill reserve. Random15 makes one
yearly purchase of 15% of spare cash into a seeded non-bond name; RandomThree15 makes three
successive such cheques into that year's same name. Index15 makes one index cheque.
Free/paid follow their real recommendations; paid bootstraps with one random15 purchase
until its existing $10,000 hiring gate is met. No free capital or fee waiver.

| Policy        | Age-45–54 wealth p10 / median / p90 | Happiness median | Stress median | Post-year cash <$1 |
| ------------- | ----------------------------------: | ---------------: | ------------: | -----------------: |
| Random15      |       $50,014 / $209,824 / $671,046 |               73 |            15 |             16.48% |
| RandomThree15 |       $56,161 / $247,171 / $800,538 |               73 |            15 |             19.63% |
| Index15       |       $56,414 / $243,178 / $847,911 |               74 |            15 |             16.82% |
| Free advice   |       $55,710 / $221,074 / $674,931 |               74 |            15 |             16.28% |
| Paid advice   |       $52,323 / $240,514 / $849,002 |               73 |            15 |             15.70% |

292 paired living-at-50 seeds: free beats Random15 in 199 (68.2%), paid in 226 (77.4%).
Paid beats RandomThree15 in 151 (51.7%) and Index15 in 136 (46.6%); those are **not** a
convincing advantage over the stronger policies. Paid wealth median is 14.6% above one
Random15 purchase, but 2.7% below RandomThree15 and 1.1% below Index15. Its p10 is only
4.6% above Random15. Report that weaker tail honestly; do not substitute the controlled floor.
Paid lifetime fee p10/median/p90: $304/$3,474/$18,444. Median cumulative living spend:
Random15 $1,474,328; RandomThree15 $1,512,599; Index15 $1,499,103; free $1,499,976; paid
$1,490,025. Outcome snapshots overlap within lives and cash-gated events can diverge, so these
are descriptive policy comparisons, not independent individual-year causal estimates.

A separate 100-life aggressive hybrid control invests **all** surplus manually before adding
advice. Age-band random median $248,427, free $238,656, paid $212,717; paid happiness 74
versus random 71 and zero-cash share 20.0% versus 26.1%. Advice improves liquidity and
happiness there but lowers net worth. B12's measured advantage applies to the stated picking
policies; superiority over active/aggressive self-directed investing remains an open finding.
No further risk/fee/return dial was silently changed to remove that limitation.

### Verification and sabotage

53 new tests cover universal fund/stock sizing, goal/reserve boundaries and repeated taps,
actual sale targets and multiple holdings, named forecasts, previews, household/operating
account separation, orphan debt, command gates, migration, malformed goals, replay and
real store/repository screen flows. Existing behavior tests remain.

28 distinct behavior-changing mutations tested. Initial goal-input omission survived because
the command refused the buy even though the generator still suggested it. Added actual
generator-silence assertion; rerun catches it. Every other mutation caught immediately;
rechecked the business-loan mutation after adding orphan handling. **Final: none missed.**

| Mutations | Coverage                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 01–06     | 34% sizing, missing cash floor/bill scaling/goal, tiny buys and spending all spare cash                                               |
| 07–13     | ignored saved goal, wrong fund, safe/incorrect-sector sales, single-position truncation, wrong destination and unlimited reinvestment |
| 14–16     | negative goal and missing alive/adult gates                                                                                           |
| 17–20     | invented migrated goal, omitted serialized/loaded goal and dropped hired advisor                                                      |
| 21–26     | old volatility, missing home/car/card bills, business-loan leakage and malformed-save acceptance                                      |
| 27–28     | ignored named-stock target and omitted orphan-loan payments                                                                           |

Tar backups and MD5 before/after checks restored all mutated source files exactly. Rerun
logs distinguish assertion failures from build errors; no compilation error counts as a catch.
Final full verification, formatting and actual PR/CI results follow publication below.

### Final full checks

`pnpm verify`: all **15 typechecks and 2,766 tests pass** (53 new). It then stops on the
same nine generator/catalog mismatches: activities, advice, auctions, businesses,
events-childhood, homes, renovations, valuables and vehicles. P6 reproduced these in a fresh
`origin/main` archive; main is still `beff25a`. No catalogs were rewritten.
`pnpm format:check` reports the same 22 historical Claude notes; all P7-owned files pass
Prettier and `git diff --check`. Final 300-life rerun after orphan-debt handling reproduces
every recorded result exactly. Native checks and Claude Project mirroring remain open.
PR targets main and depends on #13–#18; Payton merges. Actual CI status will be appended.
