# Playtest P16 — partners' working lives

Payton authorized P16 on 9 October 2026, after P15. Claimed in its own commit
`7483088` before measurement on `feat/playtest-p16-partner-careers`. Refreshed
`origin/main` remains `beff25a`; the branch follows P15 #27 and #13–#26. P15's
explicit preapproval applied to that ticket, not new P16 product values.
**Payton approved the measured proposal in full, including the log-pay metric,
on 9 October 2026. Implementation is now authorized; save v51 is reserved to P16.**

## Contract and scope

Brief P16, roadmap findings 13 and 16. Read the brief, handoff, settled decisions,
AI coding instructions, architecture, backlog, 0502 and relevant CORE lessons
13.23, 13.81, 13.84, 13.87–13.88, 13.90 and 13.130. MASTER_SPEC sections 20–22,
674–683 (important NPC autonomy), 771–785 (continuity), 1043–1059 (measured
balance/reconciliation), 1060–1077 (protected contracts), 1095–1107 (data-driven
careers), 1108–1140 (save/RNG/atomic annual processing) and 1141–1179 (approval).

Expected allowed files after approval: careers partner rules/config/public API
and tests; simulation partner phase, annual caller, state/serialization and
household-income readers/tests; persistence schema/migrations/validation/tests;
existing Person screen and real-store component tests; this note, claims,
handoff, roadmap, backlog and a CORE lesson at implementation closeout.
Protected changes: persistent NPC career state, prospective partner pay and annual
household income. **Save v51 is reserved for P16 and now implemented under Payton's
approval**; P13 owns v50 and P14/P15 leave it unchanged. TICKET 0708 is unchanged.

Out of scope: managing a partner's job, a new NPC career tab, changing dating odds
or relationship stages, changing the player's jobs/pay, NPC business/wealth
simulation, partner estates (0508), tax/rate/product changes, P15 retirement
spending/longevity, unrelated tickets and general life-event wording. TICKET
0708 and approved-decisions remain settled.

## Baseline on actual production

Two disjoint 150-life samples, `veh-0`…`veh-299`, full `advanceYear`, first choice
with last-choice fallback. Every adult annual ledger reconciles. Count partner
age 25–61; pay correlations below use **dual-earner** observations with positive
player salary/commission and partner wages, excluding pensions. Repeated years
are not independent couples and the two samples give a meaningful noise warning.

| Cohort | Working partner years | Dual-earner years | Partner p10 |  Median |     p90 |      p99 | Raw pay correlation | Log-pay correlation |
| ------ | --------------------: | ----------------: | ----------: | ------: | ------: | -------: | ------------------: | ------------------: |
| A      |                 2,988 |             2,936 |     $27,275 | $50,820 | $87,050 | $136,075 |              −0.028 |               0.006 |
| B      |                 2,992 |             2,916 |     $26,551 | $48,194 | $81,138 | $119,348 |               0.130 |               0.169 |

No sampled working year exceeds $250,000. Directly measuring 10,000 independent
partner IDs gives peak earning power p10 $28,956 / median $51,783 / p90 $92,340 /
p99 $150,219; only 0.05% reaches $250,000. The note is directionally right but
"fixed pay" needs precision: gross already changes with the common age curve and
three-year work breaks. What is fixed is earning power; all working people share
the same progression, and all dual-working 45/54 comparisons have identical pay.
There is no actual job, raise, setback or job-change state.

The 169 existing catalog jobs already span $20k-class entry jobs to $295,000 base
pay; catalog median $54,000 and p90 $138,000. Use that catalog rather than inventing
a second fixed $50k peak or fictional professions. An unweighted catalog draw is
**not** an employment-weighted census distribution.

| Cohort | 55–64 worth | 65–74 worth | Partnered 55–64 worth | Single 55–64 worth | Partnered 45–54 home ownership |
| ------ | ----------: | ----------: | --------------------: | -----------------: | -----------------------------: |
| A      |    $349,032 |    $418,562 |              $381,105 |           $155,527 |                          65.4% |
| B      |    $280,393 |    $350,910 |              $273,092 |           $299,958 |                          64.6% |

## Real-world references and metric limits

[BLS May 2025 occupational wage release](https://www.bls.gov/news.release/ocwage.htm),
read 9 October 2026, distinguishes a $69,770 all-occupation annual **mean** from
very different occupations: fast-food/counter workers $32,150, registered nurses
$101,420 and chief executives $269,630. It supports a broad catalog, not equal
occupation weights or a mandatory median for game partners.

[Frémeaux and Lefranc, Assortative Mating and Earnings Inequality in France](https://roiw.org/2020/n4/roiw12450.pdf),
Review of Income and Wealth (2020), studies France 2004–2011. Its dual-earner
annual correlation is around 0.3, full-time-equivalent around 0.35, while the
overall annual measure is around 0.17. This is **not** a universal US number.
The paper also distinguishes correlation in wage levels from log wages (table 4
uses the latter). The brief's 0.3–0.4 remains Payton's game target; it does not
specify the metric. **Propose log-pay correlation for the game, disclose raw-dollar
correlation alongside it, and ask for that choice explicitly.** Neither measure
here is age-adjusted, full-time-equivalent or a selection-corrected econometric
estimate, so do not claim exact replication of that study.

## Candidate measurement, not shipped rules

Throwaway harnesses outside git keep independent per-person career snapshots and
replace the partner phase's reported pay; real annual finance, tax, living,
housing, family, decisions and ledger settlement still run. No production source
or saved shape is edited. Prototypes do not yet implement actual save migration,
household-command initialization, heirs/catch-up or UI; those are acceptance work
after approval, not claimed completed by a spy-based calibration.

Initial jobs come from age-eligible existing catalog entries. A geometric blend
of independent background job pay and the player's pay influences the initial
job quote, with seeded quote variation. This is frozen once: later player raises
do not directly reprice a partner. No-job players retain independent matching;
retired partners do not anchor to a working player's wages. Tested blend weights
0.35/0.50/0.65/0.80/0.95/1.00. Each corrected policy runs two independent
150-life cohorts (1,800 valid candidate lives), followed by a disjoint 1,000-life
holdout for 0.95 (2,800 total valid candidate lives).
Career snapshots are isolated per life, and new career draws include master seed
plus NPC identity. Existing participation and retirement-age rules stay unchanged.

Prototypes give 20% steady, 60% ordinary and 20% mobile career styles. Steady
careers retain job and pay. Ordinary/mobile careers have 1%/1.5% annual real
raises, 4%/8% job-move chances, 3% promotion chances and 3% setbacks (6–15% cut).
Moves/promotions use actual same-track catalog jobs and the initialized job's
credential ceiling. The final three candidates also enforce the initialized
job's license ceiling. Initial salary quotes vary around the selected job by a
seeded 12% log-normal spread. Annual adjustments use a $20,000 floor and a
1.9× catalog-quote ceiling, not guaranteed income when out of work. Same-title
employer changes count as moves; promotions count separately at implementation.
Existing work-participation/baby/three-year-spell rules, age-62–67 retirement and
40% partner pension share remain. Pension uses the partner's own final career
pay, not a new draw from the player's salary or a universal peak.

**Excluded exploratory runs:** the first harness used incorrect strings for
education ordering. More importantly, all pre-isolation candidate runs held one
career map per cohort. NPC IDs such as `npc:work:<job>:<year>:<seat>` repeat across
different games, so this accidentally reused careers between unrelated lives.
Those results are invalid and discarded, including stronger/shared-track trials.
The production baseline has no such mutable map and remains valid. Corrected
candidate state is cleared per life and draws include its seed; no production
test or engine source was altered. Final results below use only the isolated run.

## Measured recommendation — approval required

Choose initial log-pay blend **0.95**, no forced shared-track branch. The other
5% comes from a seeded independent background job, plus the initial 20% log-normal
target variation and 12% job-quote variation. The score selects a real catalog
job, not a salary equal to the player's. Limit matching context to gross job
salary/commission, clipped to $20k–$400k; no-job/retired cases use independent
background matching. No wealth/investment/credit matching. This strong initial
context is a product judgment: after freezing it, each partner's career evolves
independently and may diverge substantially. New spouses can start above or below
the player; the match is not updated whenever player pay changes.

Use **log-pay correlation around 0.35**, measured among positive-pay dual-earner
years with partner age 25–61, as the proposed matching acceptance metric. Keep
raw-dollar correlation visible. That is an explicit interpretation for Payton to
approve, **not** a claim that raw-dollar correlation has reached 0.3–0.4.

| Sample / selected policy                    | Working years | Partner p10 |  Median |     p90 |      p99 | Log-pay correlation | Raw-dollar correlation |
| ------------------------------------------- | ------------: | ----------: | ------: | ------: | -------: | ------------------: | ---------------------: |
| A, 150 lives                                |         2,881 |     $30,343 | $48,740 | $88,257 | $148,200 |               0.357 |                  0.303 |
| B, 150 lives                                |         2,880 |     $29,046 | $46,183 | $94,734 | $280,734 |               0.372 |                  0.234 |
| Holdout C, 500 lives (`veh-300`…`veh-799`)  |         9,704 |     $30,553 | $50,042 | $90,895 | $210,066 |               0.352 |                  0.276 |
| Holdout D, 500 lives (`veh-800`…`veh-1299`) |         9,706 |     $31,514 | $49,131 | $88,360 | $157,497 |               0.393 |                  0.289 |

There is **no $50,000 median/peak constant** in this model. A resulting median
near that amount comes from jobs and this population's pay; it is not the old
lifelong earning-power anchor. $250k+ is a real but small tail: none in A,
1.91% of working observations in B, 0.062% in C and 0.422% in D. These are
observation shares, not independent-person success odds. Do not promise a rich
partner or present a sample with no rare case as evidence that the tail is absent.

C/D model 654/644 distinct life-scoped careers: 120/127 have the steady style,
326/315 have at least one job move/promotion, and 272/271 have at least one pay
cut. Some careers enter late or retire immediately, so whole-life stay-put
percentages are not simply the 20% configured style probability.

| Sample | 55–64 worth | 65–74 worth | 55–64 shortfall years | 65–74 shortfall years | Partnered 45–54 ownership |
| ------ | ----------: | ----------: | --------------------: | --------------------: | ------------------------: |
| A      |    $325,540 |    $451,120 |                 1.06% |                 0.78% |                     65.5% |
| B      |    $294,441 |    $368,547 |                 0.91% |                 1.01% |                     65.5% |
| C      |    $336,225 |    $438,978 |                 0.70% |                 0.79% |                     66.1% |
| D      |    $361,604 |    $446,296 |                 1.08% |                 0.51% |                     66.3% |

All four retain the unchanged P2 literal wealth bounds ($220k–$420k at 55–64,
$280k–$520k at 65–74); every measured adult annual ledger reconciles. These are
prospective new-game prototypes, not proof about old-save migration or actual
saved-game replay. P15's explicitly retired-life cohort must still be rerun with
the actual P16 implementation; the passive elder sample mostly continues work.

The requested decision is the complete policy above: catalog-backed persistent
careers; 20/60/20 styles and their measured annual rates; one-time 0.95 initial
matching with the disclosed log-pay target; existing participation/retirement
rules, pension based on final own career pay; v51 legacy-preserving migration;
and the existing Person-row extension below. Do not silently substitute a
raw-dollar target or change the profile/rates when implementing approved values.

## Approved persistence/UI contract

Maintain a compact career per modeled person, keyed by NPC identity within its
game and randomized using master seed plus identity, not a new
duplicate partner record. Retain job, pay, tenure, career style, previous-year
pay/status, last processed year, initial credential/license ceiling and retirement
pay base. No full duplicate work
history or new NPC bank account. A departing/dead partner contributes no income;
changing partners cannot transfer the old career. Catch-up must advance that
person's own history without paying missed years to the current household.

v50→v51 migration preserves current established partner wages/pension, cash,
historical ledger, names/romance, other fields and RNG. Infer only prospective
career state from legacy earnings; do not retroactively claim an unobserved job
history or force an established spouse onto new assortative pay. New adult
households use matching at initialization; minors earn nothing. All manual,
systemic and loaded-save routes must share the same initializer and annual reader.
Screen reads never draw or progress the career.

Extend the existing Person screen's work row with their catalog job/current
gross annual pay and a short actual-change subtitle (raise, pay cut, changed
jobs, returned to work, retired). No job-management controls or extra stats.
Finances, living, borrowing, housing eligibility and the screen read the same
settled pay, with gross/net/tax kept distinct and every row posted once.

## Approved acceptance

- New partners include $20k-class work and a genuine $250k+ tail, with rising,
  stalled and falling careers, job changes and meaningful stay-put careers.
- Two independently measured actual-life cohorts and a larger fixed seeded
  cohort guard the explicitly approved correlation metric/target; report raw and
  log pay separately, not a hard match per pair.
- P2 age-band bounds, household ratios/ownership, hardship and P15 retired-life
  calibration are rerun without weakening existing tests to admit bad economics.
- Exact gross/net/tax/ledger, living and loan/home/vehicle readers agree; no
  income after death/departure, dates do not share a household, no minor wages.
- Same-year/idempotent processing, independent RNG, immutable inputs, old/current
  saves, malformed career validation and actual descendant handoff are tested.
- Real-store Person screen, at least 15 valid sabotage mutations with exact
  restoration, full verify/format, CORE lesson, docs and PR into main.

## Implementation and production measurement

Payton approved the complete measured policy and explicit log-pay definition on
9 October. Careers now retain a catalog job, own full-time salary, style, initial
credential/license ceiling, job-since year, last processed year and last settled
gross/net/tax/status/change. The frozen salary itself is the retirement pay base;
no redundant pension account, prior-pay history or second person record is stored.
Participation is shared with 0502, while its old earning-power calculation is used
only for migration. All annual rates, quote/matching variation, floors/ceilings
and pension share remain as approved above.

Every adult household stage settles through one annual phase: manual romance,
systemic formation and loaded games do not have separate earnings rules. New
households initialize on their first annual settlement using that year's actual
player salary/commission. Before that, the Person row says household pay starts
with the next year. The screen reads only saved, current-year results: no quote
draws or career progression while rendering, and no stale departing spouse's
career is shown as a new year's pay. Out-of-work years retain wage potential;
departures retain personal career state but post nothing. A returning person
catches up their own career and receives only the current year's pay, no backpay.
Moves can mean a new employer with the same title; promotion remains distinct.

v50 migration preserves the entire old save except version and the added career
map. A current adult household partner retains exact legacy wages/pension and
status, with job tenure starting now rather than invented historical experience.
No assortative reprice is applied to an established spouse. Existing pensions
remain exactly unchanged after subsequent years; non-earners retain prospective
wage potential without inventing current pay. v51 validates job, qualifications,
license, style, whole-dollar pay/taxes, timestamps and status before loading.
Serialization restores all career state. Actual descendant continuation starts
with an empty map and no inherited spouse/career; no estate model was expanded.

Production checkpoint `p16-checkpoints/production.test.ts` ran **1,300 actual
new-game lives with no substituted phases**: A/B each 150, C/D disjoint 500.
Every adult annual ledger reconciles. Checked-in
`partner-careers-balance-p16.test.ts` guards A/B's approved log-pay interval,
unchanged P2 age-band bounds, household ownership and a genuine high-pay tail.

| Sample | Working years | Dual-earner years | Median partner pay |      p99 | Over $250k | Log correlation | Raw correlation |
| ------ | ------------: | ----------------: | -----------------: | -------: | ---------: | --------------: | --------------: |
| A      |         2,881 |             2,825 |            $48,740 | $148,200 |         0% |        0.357262 |        0.302975 |
| B      |         2,880 |             2,821 |            $46,183 | $280,734 |    1.9097% |        0.372285 |        0.233955 |
| C      |         9,704 |             9,490 |            $50,042 | $210,066 |    0.0618% |        0.351739 |        0.275666 |
| D      |         9,706 |             9,553 |            $49,131 | $157,497 |    0.4224% |        0.392886 |        0.289297 |

The wealth, ownership, p10/p90/p99 and career-count results reproduce the selected
proposal table. C's production pay correlations differ slightly (log 0.351739
versus prototype 0.351764, raw 0.275666 versus 0.275733): production retains the
approved **initial** qualification ceiling across moves, while the prototype
inferred it anew from the current job. No rates were retuned. C/D still have
654/644 careers, 120/127 steady styles, 326/315 job changes and 272/271 pay cuts.
These remain observation shares and sample results, not guaranteed earnings or
a claim that raw-dollar correlation is always 0.3–0.4.

## Sabotage verification

31 independent, applicable mutations were run against the real production files
and acceptance tests. Initially **30 caught, one missed**: lowering the $20k annual
salary floor to $10k. The original ordinary-pay sample never reached the floor.
Added a real low-initial-quote cohort, then reran that mutation: **caught**.
Final outstanding missed mutations: **none**. Every affected source file was
restored byte-for-byte and hashes checked after both runs. Syntax/import failures
were not counted as catches.

| Mutation                                | Result                                           |
| --------------------------------------- | ------------------------------------------------ |
| Omit master seed from career keys       | Caught                                           |
| Alter initial matching weight           | Caught                                           |
| Alter initial matching sigma            | Caught                                           |
| Alter catalog quote sigma               | Caught                                           |
| Lower player-context ceiling            | Caught                                           |
| Raise player-context floor              | Caught                                           |
| Match retirees to player pay            | Caught                                           |
| Change steady share                     | Caught                                           |
| Change mobile share                     | Caught                                           |
| Raise ordinary growth                   | Caught                                           |
| Raise mobile growth                     | Caught                                           |
| Halve ordinary move chance              | Caught                                           |
| Halve mobile move chance                | Caught                                           |
| Increase promotion chance               | Caught                                           |
| Increase setback chance                 | Caught                                           |
| Reduce the pay cut                      | Caught                                           |
| Lower annual salary floor               | Initially missed; caught after boundary coverage |
| Lower annual salary ceiling             | Caught                                           |
| Let steady wages grow                   | Caught                                           |
| Change pension share                    | Caught                                           |
| Remove young half-time adjustment       | Caught                                           |
| Skip catch-up years                     | Caught                                           |
| Let careers grow past retirement        | Caught                                           |
| Pay dates                               | Caught                                           |
| Pay dead partners                       | Caught                                           |
| Omit partner tax row                    | Caught                                           |
| Post net as gross                       | Caught                                           |
| Omit careers from saves                 | Caught                                           |
| Omit restored careers                   | Caught                                           |
| Rematch established spouse in migration | Caught                                           |
| Accept malformed career maps            | Caught                                           |

## Actual retired-life remeasurement

300 more real lives chose retirement at 65 and reconcile throughout, using the
unchanged P15 policy. This is separate from the mostly wage-earning passive elder
cohort above. The original P15 acceptance bounds were rerun without edits.

| Sample | Paired 75→85 survivors | Median wealth change | Share declining | 65–74 worth | 75–84 worth | 85–94 worth | 85–94 shortfall years |
| ------ | ---------------------: | -------------------: | --------------: | ----------: | ----------: | ----------: | --------------------: |
| A      |                     67 |             −$60,614 |           83.6% |    $364,872 |    $304,659 |    $214,204 |                21.10% |
| B      |                     66 |             −$39,183 |           81.8% |    $297,449 |    $252,353 |    $149,449 |                26.55% |

P15 alone measured −$67,474/−$42,497 and 85+ shortfalls 27.86%/21.91%.
P16 changes spouse earnings/pensions, so individual outcomes and shortfalls
change without retuning P15. This preserves meaningful wealth decline, not a
promise that every retiree succeeds. Native checks are still needed.

## Verification and delivery status

- 48 new P16 tests: careers 8, simulation command/settlement/continuation 6,
  simulation two-cohort balance 1, persistence 24, actual-store Person UI 9.
- Full `pnpm verify`: **all 3,354 tests and 15 typechecks pass**. Content validation
  reaches only seven inherited generator/catalog byte mismatches: activities,
  advice, auctions, businesses, events-childhood, homes and vehicles. No catalog
  source or generator was changed; the validator's incidental vehicle-mods
  formatting rewrite was proven JSON-equivalent and restored to original bytes.
- Prior migration tests retain exact field assertions, updating only the current
  save-version expectations to 51. No P2/P15 economic bounds were weakened.
- 31 valid sabotage mutations caught after the documented initial floor miss;
  no outstanding misses, exact source restoration checked. Production/retired
  checkpoints plus checked-in balance tests use real annual settlement.
- Implementation `5fb3465` published. PR #28:
  https://github.com/PaytonBlevins/YearAfter/pull/28 targets main and depends on
  P15 #27 and #13–#26 while refreshed main remains `beff25a`.
- Touched files pass formatting. Full `pnpm format:check` retains the same 22
  historical-note failures as P15. Implementation CI run **171**, job
  `113963907460`, fails exactly those same 22 files, checked against local warnings
  and the job log. Frozen install passes; typecheck/tests/content steps skip.
  The PR is mergeable when checked. Documentation-closeout CI will be unobserved.
- Native/device checks and unavailable Claude Project mirroring remain open.

Life-event wording and unrelated work stay deferred. Stop after this report and
PR; no new ticket is authorized automatically by finishing P16.
