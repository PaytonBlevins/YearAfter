# Playtest P6 — adult odd jobs and high-school part-time work

**Status:** claimed and measured 8 October 2026 UTC (7 October Pacific). Payton authorized
starting P6. Gameplay values and the screen proposal below await his approval; production
code remains unchanged. P7 has not started.

## Ticket P6 — adult odd jobs and high-school part-time work

**Spec sections:** MASTER_SPEC 61, 74–75, 85, 97, 661, 1043–1059, 1108–1140,
1247–1263, 1820–1824 and Time & Workload. Playtest brief P6, backlog B8/B9,
CORE_RULES 13.5–13.8, 13.6, 13.27–13.28 and 13.66.
**Milestone:** authorized P1–P16 work before v0.08.
**Allowed files:** gig generator and its generated catalog; content gig types/validator;
education gig selection, progression, college performance and workload wiring; simulation gig
commands, annual settlement, tax/living inputs and tests; mobile gig screen, Career links and
component tests; persistence replay tests; this doc, CLAIMS, HANDOFF, roadmap, approved decisions
when approved, and relevant CORE_RULES lessons.
**Protected areas touched:** gig availability/pay and annual settlement; hidden capacity and
school-performance wiring; removing the existing two-gig cap conflicts with its old test but
follows canonical CORE_RULES 13.5. That rule/test change is proposed explicitly below, not
silently implemented. Tax uses existing curves rather than introducing a new tax model.
**Save:** existing held gig ids already save in `education.gigs`. The proposed catalog metadata
and derived screen sections need no new saved field. Save v45 and TICKET 0708 stay; no new save
version is reserved. If implementation reveals a new saved shape is needed, revisit the design.

### Requirement

Adults can choose appropriate odd jobs throughout adulthood, including alongside a regular
job. High-school students can find and hold part-time shifts. Work is selected deliberately,
paid during the annual advance with a named ledger source and amount, and contributes to the
existing hidden workload and school consequences. No weekly turn, visible capacity budget or
new stat. Fix the existing graduation/college/adult wiring gaps as part of making work usable.

### Acceptance, after approval

- [ ] Adult work remains available after 22 and into retirement; no automatic enrollment.
- [ ] Age-appropriate school shifts are clearly discoverable from Career.
- [ ] Held work pays exactly once during ordinary school, graduation, college/trade school and adulthood.
- [ ] Hours reach stress in all stages; school consequences are observable without double-counting hours.
- [ ] Taxes/net income and living-cost inputs use the real ledger producers; reconciliation holds.
- [ ] Direct command gates, taking/quitting, component flows, save/load and seeded replay tests.
- [ ] Re-measure grades/stress/earnings, including stacked work and older adults.
- [ ] At least fifteen independent sabotage mutations, tar backups and restored MD5 hashes.
- [ ] Changed-file formatting and full `pnpm verify`; report baseline blockers and actual CI.
- [ ] PR into main; Payton merges; stop before P7.

## What the current code actually does

`gigOffers` is a manual catalog menu, not a random offer roll or a systemic event. Every
eligible gig is shown whenever the player opens it. Career exposes Odd Jobs at every age.
The catalog has 13 entries, all with an upper age bound of 22 or younger. Thus adults after
22 are not unlucky: their eligible catalog is empty.

Four existing shift jobs already start at 16: weekend retail (12 hours/week), kitchen (14),
lifeguarding (12) and seasonal camp work (20). Retail currently pays $1,200–$3,800 per year;
kitchen pays $1,400–$4,200. They are buried in the child-oriented Odd Jobs screen, whose footer
says these precede a real job. `canWork` defers the regular-job UI during school below 18;
part-time shifts correctly use the separate gig commands and do not replace that career.

`MAX_GIGS = 2` blocks a third work choice with `hands-full`. CORE_RULES 13.5 instead says:
“lets them take as much as they want,” with hidden workload handling overcommitment.
The existing education test explicitly asserts two and not three. Removing that cap needs
an explicit product decision and a superseding canonical-rule test, not weakening the old
assertion without saying why.

## Baseline measurement

Throwaway harness outside the repo; no production edits. 250 seeds `p6-0` through `p6-249`,
up to 140 annual advances or death, answering first choices until the pending queue clears
(guard 16), no manually selected work. Availability is evaluated at each adult snapshot with
no held gigs, using the actual family for any parental gate. These counts measure menu
availability, not how often a player opens it or a random offer chance.

| Adult age | Observed life-years | Years with available work | Available rows / year |
| --------- | ------------------: | ------------------------: | --------------------: |
| 18–22     |               1,240 |              1,240 (100%) |          5.00 average |
| 23–64     |              10,212 |                         0 |                     0 |
| 65+       |               4,258 |                         0 |                     0 |

238 of those lives supply a living high-school state at 16. Each is cloned through the existing
v45 save serializer/loader for independent paired runs. Select no work, retail, kitchen, or
both, then advance through 17 and 18 with the same first-choice policy. All other starting
inputs are held constant; year 18 is graduation in this population. No Work Harder or new study
presses are added. Annual hours/capacity are read from the actual education phase at 17.

| Existing work | Pay at 17, p10 / median / p90 | Performance at 17 | Stress at 17 | Hours/week at 17 |
| ------------- | ----------------------------: | ----------------: | -----------: | ---------------: |
| None          |                  $0 / $0 / $0 |      51 / 85 / 99 |  3 / 11 / 28 |       3 / 7 / 12 |
| Retail        |      $2,240 / $3,063 / $3,670 |      51 / 84 / 98 |  7 / 22 / 51 |     15 / 19 / 24 |
| Kitchen       |      $2,753 / $3,593 / $4,153 |      50 / 84 / 98 |  9 / 26 / 56 |     17 / 21 / 26 |
| Both          |      $5,586 / $6,610 / $7,410 |      44 / 78 / 92 | 30 / 49 / 82 |     29 / 33 / 38 |

Capacity p10 / median / p90: **21.12 / 23.44 / 25.82 hours/week** for the same students.
One shift is usually manageable; stacking both causes a visible consequence. The existing
capacity/performance/stress curves need no new multiplier to make this tradeoff matter.
All three working variants pay **zero at 18**, revealing the graduation early return.

Direct phase probes first used one real teen snapshot advanced to a constructed age/stage.
A second independent set explicitly rules out unaffordable tuition as the explanation: a
new-game fixture at age 20, $100,000 available cash, held retail, real program ids
(`major.nursing`, `voc.electrical`, `grad.md`), college year zero and appropriate constructed
credentials; call `runEducation` at 21. These are branch fixtures, not claims about typical
medical-school enrollment at 20. All enrolled cases actually pay tuition and remain enrolled.

| Education stage | Odd-job gross |   Reported hours | Tuition charged | Held retail id |
| --------------- | ------------: | ---------------: | --------------: | -------------- |
| Graduated       |        $3,670 |                0 |              $0 | Retained       |
| College         |            $0 | 16 (degree only) |          $9,400 | Retained       |
| Vocational      |            $0 | 16 (degree only) |          $5,200 | Retained       |
| Postgraduate    |            $0 | 16 (degree only) |         $34,000 | Retained       |

These isolate the current early returns even during an affordable year. They do not establish
final P6 effects. No fixture cash or credential construction is a production change.

## Found by P6

1. **B8 is a catalog cutoff, not a low probability.** No job survives past 22; there is no random
   adult gig-offer system to turn up. Build appropriate manual adult choices.
2. **B9 has an existing engine path.** Four shifts already start at 16, with saving, income and
   school workload. Make them explicitly part-time and repair the gaps rather than building a
   second employment engine or adding salary/promotion benefits to a gig.
3. **Graduation skips the paycheck.** `runSchoolYear` returns before running gigs in the diploma
   year. Held work still exists afterward, making the lost year particularly misleading.
4. **College/trade/postgraduate work never settles.** Those branches retain gig ids but return
   no earnings and report only degree hours. Adult out-of-school branches pay but report zero
   gig hours. Simply adding adult rows would therefore produce stress-free side income.
5. **Adult odd-job income is missing from living/tax inputs.** It is posted as `oddJob` but not
   included in the annual income stack used by living costs or the existing income-tax curve.
   New adult earnings must enter that stack and be taxed once; unrelated income parameters stay.
6. **The two-gig cap contradicts the canonical workload policy.** Ask for an explicit ruling;
   the old test cannot quietly be relaxed while claiming every contract remains unchanged.

7. **The brief’s “0208” school-performance reference is stale.** MASTER_SPEC names 0208
   Children. School progression/overload lives in 0204, study/stress in 0205, and the population
   variation lesson is 0408 / CORE_RULES 13.66. P6 follows those actual owners; no parenting
   change is proposed.

## Concrete proposal for Payton

### Adult choices and income

Add six manual freelance options from **18 onward with no upper-age cutoff**. These are new
adult ids, so child pay/parental gates do not leak into adulthood. No random availability roll;
a player can deliberately choose work. Annual ranges use the existing stat/talent pay function.
They are proposed game-balance values, not researched real-world wage claims.

| Adult odd job               | Hours/week | Annual gross range | Existing pay input                                   |
| --------------------------- | ---------: | -----------------: | ---------------------------------------------------- |
| Pet sitting and dog walking |          4 |      $1,500–$6,000 | Discipline                                           |
| Yard work                   |          5 |      $2,000–$7,000 | Willpower                                            |
| Babysitting                 |          6 |      $2,500–$9,000 | Charisma                                             |
| Tutoring                    |          4 |     $2,500–$10,000 | Smarts; existing Academics talent premium            |
| Art commissions             |          4 |      $1,500–$8,000 | Looks; existing commissions' talent mapping retained |
| Small household repairs     |          6 |     $3,000–$12,000 | Discipline                                           |

Keep the existing deterministic ability scaling and 35% relevant-talent premium; no new
hiring chance, equipment purchase, licensing subsystem or freelance promotion ladder.
Tax adult freelance income using the current income curve and existing self-employment
premium; ordinary shift income uses the existing income curve. Count net adult work income
in the same year's living inputs, and stack subsequent business/creator/deal tax against it.
Under-18 small-gig tax treatment stays as currently implemented. Reconciliation remains absolute.

### High-school shifts and capacity

Reuse the four existing shift ids from 16. Keep their hours and age ranges and the seasonal
lifeguard/camp pay. Propose retail **$6,000–$10,000** and kitchen **$7,000–$12,000** annual gross,
so regular shifts reward a year of work more meaningfully than the current $2,000–$4,000.
These changes must be re-measured through whole lives before shipping, including graduation
cash and college affordability. No new capacity, stress or grade coefficients.

Remove the fixed two-gig cap in favor of the existing hidden workload consequences, as
CORE_RULES 13.5 requires. Taking a third job should succeed when its age/parental gates pass;
its hours then matter. Replace the old cap assertion with that approved canonical behavior and
add integration guards that prove overload still has a cost. Do not reduce any consequence floor.

Settle held work exactly once regardless of school stage, including the year spent graduating.
Carry the paid year's hours before age-out removes a job. College work contributes to stress
and academic performance through the existing overload penalties; it gets no new penalty
constant. Keep the existing final-year payment-before-age-out contract.

### Screen

Reuse the existing screen and commands. Career links to **Part-time & Odd Jobs** from 16,
with separate **Part-time shifts**, **Odd jobs**, and **Work you're doing** sections. Younger
children keep Odd Jobs. Rows show the work, expected annual gross, weekly commitment, take/quit
and plain refusal reasons; held work is visibly confirmed immediately and saves through the
existing store. No visible capacity budget, scheduler or automatic job selection. Change the
footer so adults are not told they are only working before a real job.

## Verification and next step

Only inspection and measurement are complete. Initial harness attempts used the serializer's
wrong call shape; those failed runs were discarded before the complete measurement above.
No implementation tests, sabotage or full verification are claimed for P6. No production source
or catalog was edited to obtain these results. Native-device checks and Claude Project mirroring
remain unavailable; `project_write` is not exposed.

Claim published first on `feat/playtest-p6-school-work`, stacked on P5 #17 (and P1–P4 #13–#16).
Fetched real main still points at `beff25a`; no claim that those PRs merged. Save v45 and TICKET
0708 stay. Payton's brief requires approval for new game values/screen shape, so the proposal
above awaits approval before implementation. P7 has not started.
