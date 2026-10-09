# Playtest P16 — partners' working lives

Payton authorized P16 on 9 October 2026, after P15. Claimed in its own commit
`7483088` before measurement on `feat/playtest-p16-partner-careers`. Refreshed
`origin/main` remains `beff25a`; the branch follows P15 #27 and #13–#26. P15's
explicit preapproval applied to that ticket, not new P16 product values.
**Measurement/proposal only; no production engine or save changes yet.**

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
household income. **Save v51 is reserved for P16** if the proposed stateful model
is approved; P13 owns v50 and P14/P15 leave it unchanged. No save code changed.

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

## Proposed persistence/UI contract, awaiting approval

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

## Acceptance after approval

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

## Open status

Measurement and proposal are complete and await Payton's approval, especially the
log-pay interpretation. No implementation, new acceptance
tests, sabotage or fresh full verify claimed yet. Last completed P15 gate: all
3,306 tests and 15 typechecks pass, seven inherited generator byte mismatches and
22 historical-note formatting failures remain. Native/device checks and unavailable
Claude Project mirroring remain open. Life-event wording stays deferred.
