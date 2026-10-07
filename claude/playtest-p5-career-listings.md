# Playtest P5 — twelve career listings and study matches

**Status:** built and verified on 7 October 2026; PR publication below. Payton authorized P5.
Twelve listings and at least two study/training matches are already requested. Payton approved showing all available matches when qualification gates leave fewer than two.
The preliminary prototypes were restored byte for byte before the final implementation.

## Ticket P5 — twelve listings that reflect studies and training

**Spec sections:** MASTER_SPEC 97, 104, 113–119, 1095–1107, 1108–1140, 1327–1338
(curated yearly inventories), 1339–1344 and the Education / Ordinary Careers amendments.
**Milestone:** authorized playtest rules before v0.08; B7 and roadmap finding 21.
**Allowed files:** careers openings, exposure calibration and tests; simulation career-context wiring, reachability /
first-job tests and the business-finance, vehicle, household and shaped-life integration test fixtures;
mobile Jobs screen and component tests; persistence replay tests;
this doc, CLAIMS, HANDOFF, roadmap, backlog, approved decisions and relevant CORE_RULES lessons.
**Protected areas:** career listing selection and its measured starvation contract. P1–P16's
brief authorizes those engine changes. No hard qualification gate or hiring-odds change. The invalid linear starvation probability proxy is explicitly superseded below; its coverage and effect thresholds remain. No save-shape change: save v45 and TICKET 0708 remain.

### Behavior and implementation

- Twelve distinct eligible jobs a year, or the whole eligible pool when it is smaller.
- Reserve two slots from eligible jobs whose tracks match the existing major's `opens` or a
  held license's tracks. Use the existing weighted stable draw inside that matching pool.
- Fill the remaining slots from the existing weighted general pool, without duplicates;
  matching jobs can also win those slots. Keep the final list sorted by pay.
- Continue excluding the current job and honoring age, education, license and rung gates.
  The list is a place to apply, not a guaranteed hire. No new hiring bonus or first-offer chance.
- Keep the same year/character/job key and consume no RNG to render the board. Use the same
  board for the screen and the systemic first-job offer.
- The existing Jobs screen can render twelve rows; no new screen, search or filter is needed.
  Add concise context about studies/training and test every row and its navigation.

**Exception approved by Payton:** when fewer than two matching jobs are eligible, show
all available matches and fill the rest with other eligible jobs. Do not duplicate a job or
show a job the player cannot apply for just to claim there are two.

### Acceptance

- [x] Twelve listings with no duplicates and no ineligible/current jobs.
- [x] At least two matches whenever two eligible matches exist; scarce-pool behavior approved.
- [x] Study fields and held licenses reach the selector through the real simulation context.
- [x] Career switching, stable replay, untouched RNG and actual hiring gates are preserved.
- [x] Component rendering/navigation and save/load board replay tests.
- [x] Updated reachability ruler and first-job timing guard; no weakened/deleted tests.
- [x] Thirty independent sabotage mutations, restored source hashes checked.
- [x] Full `pnpm verify` run, changed-file formatting, PR into main, then stop before P6 (baseline blockers below).

## Measurement method

Read 0401, 0402 and the existing careers, education, first-job offer and Jobs screen code first.
`origin/main` fetched from the real repo remains `beff25a`. P5 branches from P4's published
`1ea1dc0`, following P1 #13, P2 #14, P3 #15 and P4 #16. No claim of those PRs being merged.
The separate P5 claim was published first at `85da889`.

Throwaway harnesses and backup stayed outside the repo. Three configurations were measured:
current six listings, twelve listings only, and twelve with two reserved matches. The prototype
used the existing `majorOpens(state)` in `atTheDoor` and `licenseReach` for held-license matches.
Both modified production files were restored from a tar backup and their MD5 hashes checked
against the pre-measurement bytes. An early partial prototype failed its unique-edit assertion;
that run was discarded, the files restored, and the complete prototype rerun for all tables below.

**Played reachability:** the existing 250-life `catalog-0` through `catalog-249` harness, up to
140 advances/death, settling first choices, applying once when unemployed using its existing
non-cheapest picker and using Work Harder when employed. It measures what was seen over a
life rather than pooled coverage alone. Each configuration ran all four existing assertions.

**Passive lives:** 250 seeds `0407-guard-0` through `0407-guard-249`, up to 140 advances/death,
answering the first choice until the pending queue clears (guard 12), with no manual job
applications or Work Harder. Count the first held job, openings seen before retirement and
unemployed adult years from 18 through 64. First-job waiting time starts at working age 16;
it is not time since graduation. All three cohorts find work, so these quantiles omit nobody.

**Study/training exposure:** all 53 actual programs × 100 separate seeds/world years, 5,300
contexts for new graduates and another 5,300 with ten completed years in food work. Each is age
30 with the real program's granted license and undergraduate/graduate credential level as
appropriate; high school is held. No job is currently held. `p5-${major.id}-${yearIndex}` seeds
and world years 2030–2129 stay paired across configurations. Match tracks come from the program
and held licenses; eligibility is the actual `cannotApply(atTheDoor(state))`. This equally
weights programs to catch an absent field; it is not a claim about how common each degree is
in generated lives. The experienced group qualifies for more unrelated jobs, exposing dilution.

## Results

| Played 250-life reachability                    |          Six |   Twelve only | Twelve + two matches |
| ----------------------------------------------- | -----------: | ------------: | -------------------: |
| Jobs seen, p10 / median / p90 (169-job catalog) | 85 / 93 / 99 | 90 / 96 / 102 |        90 / 96 / 102 |
| Step-ups per employed year                      |    3.20 of 6 |    6.34 of 12 |           6.30 of 12 |
| Jobs unseen by the whole cohort                 |           12 |             9 |                   11 |
| Existing starvation assertion failures          |            0 |             0 |                    0 |

The unseen rows are credential-gated professional work: legal, medical, veterinary, dental,
pharmacy or architecture, varying with which careers the changed lists lead lives into.
They are not eleven jobs proven unreachable by the new selector. All four existing tests pass
in all configurations; individual lifetime medians alone do not prove the new reservation rule.

| Passive 250-life measurement      |             Six |     Twelve only | Twelve + two matches |
| --------------------------------- | --------------: | --------------: | -------------------: |
| Ever worked                       |       250 / 250 |       250 / 250 |            250 / 250 |
| First-job age, p10 / median / p90 |    16 / 17 / 18 |    16 / 17 / 18 |         16 / 17 / 18 |
| Wait from 16, p10 / median / p90  | 0 / 1 / 2 years | 0 / 1 / 2 years |      0 / 1 / 2 years |
| Adult idle / total years          |    295 / 11,463 |    300 / 11,463 |         298 / 11,463 |
| Jobs seen, p10 / median / p90     |    84 / 90 / 95 |    88 / 92 / 98 |         88 / 92 / 98 |

**Finding 21's “a passive player gets work sooner” is not supported here.** The first-offer
chance/education-ending trigger are unchanged, and a draw from six already finds a job to offer.
A bigger board changes the chosen work and later career, not necessarily when that door opens.

| Program exposure (5,300 contexts per experience group) |            Six |    Twelve only | Twelve + two matches |
| ------------------------------------------------------ | -------------: | -------------: | -------------------: |
| New graduates: fewer than two shown matches            | 3,041 (57.38%) | 1,736 (32.75%) |          100 (1.89%) |
| New graduates: mean matches                            |          1.502 |          2.873 |                3.301 |
| Ten years' experience: fewer than two shown matches    | 4,232 (79.85%) | 2,798 (52.79%) |                    0 |
| Ten years' experience: mean matches                    |          0.807 |          1.611 |                2.349 |

All 100 new-graduate exceptions are **Architectural Studies**, which qualifies for just
**Architectural drafter ($44,000, rung 0)** without work experience. **Junior designer ($58,000,
rung 1)** needs a university degree and career reach: the degree alone does not supply that
reach. Architect and higher roles need a postgraduate qualification and `lic.architect`.
After ten years of any work, transferable reach makes a second match eligible. Two reserved
slots cannot manufacture a second eligible row. Keeping the current job out of its own
listings can create the same scarcity after a fresh graduate takes the drafter job.

## Found by P5 / resolved choices and limitations

1. **Scarce matching pools need a stated rule.** Show all available matches when fewer
   than two exist, preserving the gates. Payton approved that exception; qualifications, career reach and catalog stay unchanged.
2. **The starvation ruler needs attention with reservations.** The existing guard estimates
   annual share with `min(1, LISTINGS * weight / totalWeight)`. That is a weight-share proxy,
   not the exact inclusion probability of sorting uniform draws divided by weights; reserving
   slots also changes the pool/available slots. Its four passes above are baseline/prototype
   evidence, not final P5 verification. Final P5 replaces it with `listingChanceFloors`: conservative sufficient-event bounds
   for ranking in the matching quota or in the general-slot budget. Cantelli bounds the
   other candidates ahead of a threshold. Take the maximum of those overlapping lower
   bounds, not their sum. This corrects an invalid probability estimate, retaining the
   zero-reach and 95% single-life intent and all old coverage/step-up assertions. No old
   test was deleted; the invalid linear approximation is explicitly superseded.
3. **Save stores one current/last `majorId`, not degree-subject history.** Licenses are retained
   together. The built rule reads the same major information the existing hiring odds read,
   plus every held license. Starting another program overwrites that major; matching every
   previously earned degree would require a separate save/history design. That is not promised
   by this implementation. Study-based curation never substitutes for holding a required credential.

## Final implementation and tests

`LISTINGS = 12`, `STUDY_LISTINGS = 2`. `fitsStudy` shares the existing major-track or held-license
match. `atTheDoor` passes the same major information used by hiring; it gains no saved field.
The selector reserves the highest existing weighted matches, then fills from unreserved
eligible rows, and sorts by salary. Scarce pools show all matches. The Jobs screen uses this
real board and explains the study/training influence while retaining salary, hiring-odds labels,
sent applications, detail navigation and age refusals. No direct hiring occurs on a row tap.

New tests: 23 careers (21 listing/exposure and two scarce-catalog tests), seven simulation, one persistence and six mobile component tests: 37 additions. They
cover all 53 programs under hostile draws, held/multiple licenses, one/zero matches, gate
preservation including direct underage commands, duplicates when matching winners also lead the general draw, count/order, weighted reserved choices, refresh and every eligible
job winning a place. Simulation checks real boundary fields, zero render RNG, year/character
keys, unchanged unrelated hiring odds, and first-offer/actual hire using the same board.
Persistence checks v45 reconstruction, no derived fields saved, board/RNG replay and identical
continuation. The fixture first normalizes RNG words through the existing loader: new-game
streams may use signed words, while restored snapshots use the same bits unsigned. The initial
new test compared those different representations and was corrected to use a normalized fixture;
production RNG/save code is unchanged. Mobile tests render/navigate every real row, including the
twelfth, and distinguish current from last-year applications, age refusal and no loaded game.

The existing passive 120-life offer guard additionally measures first-job ages and asserts a
median from 16 through 20, a broad reachability bound around the measured 17. It retains both
old employment and unemployment assertions. The existing 250-life reachability guard retains
its coverage floor of 20, step-ups greater than two, zero-reach failures and 95% single-life
starvation threshold. Its revised conservative probability ruler passes; final visibility is
90 / 96 / 102 at p10 / median / p90, step-ups 6.30 of twelve, eleven credential-gated jobs unseen.

## Integration fixtures and protected assertions

The first full run found nine failures in existing integration tests because changing the job
board changes the played seeds' earnings, purchases and cohort membership. No production
business, car, household or parenting balance was changed to repair those tests:

- Four business-finance assertions depend on a literal underwriting fixture. The same seed
  now earns $67,517 and owns condo equity instead of the former $52,451 renter. Fix the stated
  earned income with a booked transaction/cash correction and remove that incidental home,
  retaining $47,353 cash, the $11,200 car, every literal quote/deposit/loan assertion and all
  ledger checks. This stabilizes the fixture instead of changing expected quotes.
- Three vehicle assertions need the described ordinary working, debt-free renter below the
  unchanged luxury-means threshold. Select those conditions explicitly from played lives;
  do not select on whether a quote succeeds. All financing/refusal assertions remain.
- The household comparison previously compared posted payments, which shortfall clamping
  can make differ even when bills are identical. Capture the real annual living phase's
  charged bill with the same $40,000 income for both cases; assert the actual caller's
  `partnered` flag is false and retain exact date-versus-single bill equality. Other household
  income assertions remain. This explicitly corrects the payment-versus-cost comparison.
- Parenting's prior discipline test compared within-person age-25-to-50 changes across two
  different parent/nonparent cohorts. The new careers change those cohorts. Keep both cohort
  counts and diagnostics, then use each parent's same age-25 state for a counterfactual replay
  with only parenting's shaping contribution suppressed. Keep the greater-than-two-point
  effect floor and more-than-30-lives requirement. Measured effect is 3.30 across 91 paired
  lives. Assert the controlled shaping caller executes. This supersedes the confounded
  cross-cohort comparison; no shaping parameter or effect threshold was reduced.

These changes preserve the rules being tested. Extra sabotage below removes salary from
underwriting, gives dating a household bill, and removes parenting growth; each revised
integration guard fails.

## Sabotage-verification

Thirty independent source mutations were run with tar backups and MD5 restoration checks.
Initial survivors at 9 and 27 exposed missing tests; those tests were added and both mutations
rerun successfully. All 29 behavior-changing mutations are caught in the final suite. One
survivor (14) is equivalent with the actual catalog, explained below. **No remaining
behavior-changing misses.** The report does not count compilation/import errors as catches;
each caught run reports an assertion failure.

|   # | Mutation                                              | Final result                                                                                                        |
| --: | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
|   1 | Six listings                                          | Caught                                                                                                              |
|   2 | No reserved slots                                     | Caught                                                                                                              |
|   3 | Three reserved slots                                  | Caught                                                                                                              |
|   4 | Ignore studied fields                                 | Caught                                                                                                              |
|   5 | Ignore held training                                  | Caught                                                                                                              |
|   6 | Read only the first license                           | Caught                                                                                                              |
|   7 | Reserve unrelated rows                                | Caught                                                                                                              |
|   8 | Reserve in catalog order instead of weighted order    | Caught                                                                                                              |
|   9 | Allow reserved rows again in the general pool         | Initially missed; added favorable-match uniqueness check; caught on rerun                                           |
|  10 | Fill twelve general slots in addition to reservations | Caught                                                                                                              |
|  11 | Reverse salary order                                  | Caught                                                                                                              |
|  12 | Drop eligibility filter                               | Caught                                                                                                              |
|  13 | List the current job                                  | Caught                                                                                                              |
|  14 | Remove the board's early working-age return           | Equivalent survivor: all 169 jobs have minimum age 16 and the independent eligibility filter still rejects children |
|  15 | Omit studied fields at simulation boundary            | Caught                                                                                                              |
|  16 | Omit licenses at simulation boundary                  | Caught                                                                                                              |
|  17 | Omit year from the stable key                         | Caught                                                                                                              |
|  18 | Omit character from the stable key                    | Caught                                                                                                              |
|  19 | Spend career RNG while rendering                      | Caught                                                                                                              |
|  20 | Add overlapping exposure event probabilities          | Caught                                                                                                              |
|  21 | Ignore general slots displaced by reservations        | Caught                                                                                                              |
|  22 | Exposure ruler reserves only one match                | Caught                                                                                                              |
|  23 | Screen shows only six rows                            | Caught                                                                                                              |
|  24 | Screen opens the wrong job                            | Caught                                                                                                              |
|  25 | Screen disables every listing                         | Caught                                                                                                              |
|  26 | Screen disables last year's applications              | Caught                                                                                                              |
|  27 | Remove actual job minimum-age gate                    | Initially missed; added direct eligibility/application age checks; caught on rerun                                  |
|  28 | Remove parenting discipline growth                    | Caught by revised paired guard                                                                                      |
|  29 | Treat a date as a household in annual advance         | Caught by real-caller household guard                                                                               |
|  30 | Exclude salary from business underwriting             | Caught with fixed original-income fixture                                                                           |

The early working-age guard and job-specific eligibility gate are independent. Removing only
the former produces no changed output with today's catalog, so 14 is not reported as a detected
behavioral defect. Removing the actual gate in 27 would let a direct application bypass the
board; the new command tests catch that. Mutation edits were restored before ordinary testing.

## Final verification and publication

All 15 package typechecks and **2,670 tests** pass, including 37 added for P5 (23 careers,
seven simulation, one persistence and six mobile). The full `pnpm verify` runs those gates,
then fails the same nine content-generator comparisons as the untouched-main archive:
activities, advice, auctions, businesses, events-childhood, homes, renovations, valuables
and vehicles. Its failure text is identical to the preserved main validation log. No catalog
or generator is changed; the validator's incidental vehicle-mods rewrite was restored.

Every changed file passes Prettier and `git diff --check`. Full `pnpm format:check` still
fails the same 22 untouched historical notes: 0210b, 0211c, 0212, 0301–0307, 0308,
0308b, 0308c, 0309, 0310, 0401–0403, build-status, event-rewrite-plan,
event-writing-rules and v004-career-measurement. They remain outside P5's edits.
Neither full verification nor repository formatting is reported green.

Fetched real `origin/main` again before publication; it remains `beff25a`, already an ancestor.
P5 is stacked on P1 #13, P2 #14, P3 #15 and P4 #16. Payton merges; no main push or
rewriting of published history. PR and actual Actions result will be recorded after publication.
Native-device checks and Claude Project mirroring remain unavailable; `project_write` is not
exposed in this session. No device check or Project mirror is claimed. P6 has not started.
