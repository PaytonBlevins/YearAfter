# Playtest P5 — career listings, measurement and proposed rule

**Status:** claimed and measured on 7 October 2026; not implemented. Payton authorized P5.
Twelve listings and at least two study/training matches are already requested. One uncovered
case needs a decision: what to show when the qualification gates leave fewer than two matches.
All prototype source changes were restored byte for byte; no prototype is shipped.

## Ticket P5 — twelve listings that reflect studies and training

**Spec sections:** MASTER_SPEC 97, 104, 113–119, 1095–1107, 1108–1140, 1327–1338
(curated yearly inventories), 1339–1344 and the Education / Ordinary Careers amendments.
**Milestone:** authorized playtest rules before v0.08; B7 and roadmap finding 21.
**Allowed files:** careers openings and tests; simulation career-context wiring and reachability /
first-job tests; mobile Jobs screen and component tests; persistence replay tests if needed;
this doc, CLAIMS, HANDOFF, roadmap, backlog, approved decisions and relevant CORE_RULES lessons.
**Protected areas:** career listing selection and its measured starvation contract. P1–P16's
brief authorizes those engine changes. No hard qualification gate or hiring-odds change is
proposed. No save-shape change is planned: save v45 and TICKET 0708 remain.

### Requested behavior and proposed implementation

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

**Proposed exception, awaiting Payton:** when fewer than two matching jobs are eligible, show
all available matches and fill the rest with other eligible jobs. Do not duplicate a job or
show a job the player cannot apply for just to claim there are two.

### Acceptance still to build

- [ ] Twelve listings with no duplicates and no ineligible/current jobs.
- [ ] At least two matches whenever two eligible matches exist; scarce-pool behavior approved.
- [ ] Study fields and held licenses reach the selector through the real simulation context.
- [ ] Career switching, stable replay, untouched RNG and actual hiring gates are preserved.
- [ ] Component rendering/navigation and save/load board replay tests.
- [ ] Updated reachability ruler and first-job timing guard; no weakened/deleted tests.
- [ ] At least fifteen independent sabotage mutations, restored source hashes checked.
- [ ] Full `pnpm verify`, changed-file formatting, PR into main, then stop before P6.

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

## Found by P5 / implementation questions

1. **Scarce matching pools need a stated rule.** Recommend all available matches when fewer
   than two exist, preserving the gates. Await Payton's approval of that exception rather than
   changing qualifications, career reach or the catalog silently.
2. **The starvation ruler needs attention with reservations.** The existing guard estimates
   annual share with `min(1, LISTINGS * weight / totalWeight)`. That is a weight-share proxy,
   not the exact inclusion probability of sorting uniform draws divided by weights; reserving
   slots also changes the pool/available slots. Its four passes above are baseline/prototype
   evidence, not final P5 verification. Update it to account for selection before shipping;
   keep the zero-reach and 95% single-life intent, and document any superseded approximation.
3. **Save stores one current/last `majorId`, not degree-subject history.** Licenses are retained
   together. The proposed rule reads the same major information the existing hiring odds read,
   plus every held license. Starting another program overwrites that major; matching every
   previously earned degree would require a separate save/history design. That is not promised
   by this proposal. Study-based curation never substitutes for holding a required credential.

## Verification and next step

Measurement only: four existing reachability assertions pass in each of the three paired
configurations. Production restored; no tests weakened or deleted. Implementation tests,
component/save checks, sabotage-verification and full `pnpm verify` remain to do. The previous
P4 report's nine environment catalog comparisons and historical format blockers are not
claimed newly checked by this docs pass. No native-device check or Claude Project mirror is
claimed. `project_write` is not available in this session.

After the scarce-pool decision, build and verify P5 on this branch, open a PR into main and
stop. P6 has not been started. Do not alter approved decisions before Payton answers.
