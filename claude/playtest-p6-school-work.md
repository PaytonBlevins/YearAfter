# Playtest P6 — adult odd jobs and high-school part-time work

**Status:** built after Payton approved the measured proposal on 8 October 2026 UTC
(7 October Pacific). Branch `feat/playtest-p6-school-work`, stacked on P5 #17 and P1–P4
#13–#16; main remains `beff25a`. P7 has not started.

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
follows canonical CORE_RULES 13.5. Payton explicitly approved superseding the old cap test with the canonical hidden-workload
contract below; every other old test remains. Tax uses existing curves rather than introducing a new tax model.
**Save:** existing held gig ids already save in `education.gigs`. The catalog metadata
and derived screen sections need no new saved field. Save v45 and TICKET 0708 stay; no new save
version is reserved. Round-trip and malformed-held-id tests confirm that the existing shape suffices.

### Requirement

Adults can choose appropriate odd jobs throughout adulthood, including alongside a regular
job. High-school students can find and hold part-time shifts. Work is selected deliberately,
paid during the annual advance with a named ledger source and amount, and contributes to the
existing hidden workload and school consequences. No weekly turn, visible capacity budget or
new stat. Fix the existing graduation/college/adult wiring gaps as part of making work usable.

### Acceptance

- [x] Adult work remains available after 22 and into retirement; no automatic enrollment.
- [x] Age-appropriate school shifts are clearly discoverable from Career.
- [x] Held work pays exactly once during ordinary school, graduation, college/trade school and adulthood.
- [x] Hours reach stress in all stages; school consequences are observable without double-counting hours.
- [x] Taxes/net income and living-cost inputs use the real ledger producers; reconciliation holds.
- [x] Direct command gates, taking/quitting, component flows, save/load and seeded replay tests.
- [x] Re-measure grades/stress/earnings, including stacked work and older adults.
- [x] At least fifteen independent sabotage mutations, tar backups and restored MD5 hashes.
- [x] Changed-file formatting and full `pnpm verify`; report baseline blockers and actual CI.
- [x] PR into main; Payton merges; stop before P7.

## What the pre-P6 code actually did

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

## Approved proposal (preserved for review)

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

## Built behavior and final measurement

Six manual adult options have no upper-age cutoff. Four shifts are separately labeled; taking
and quitting work remain deliberate commands. The screen shows annual gross before tax and
weekly hours. Existing age and parental gates remain. Regular work and freelance work share
one annual payout producer in every education stage; the paid year's hours survive age-out.
College uses its existing performance drift and overload penalty. Salary plus shift wages
enter the existing ordinary tax curve; freelance follows with the existing self-employment
premium. Subsequent business, creator and deal income sees that tax base. Living costs,
loan underwriting and the finance summary count the real work income. Under-18 tax treatment
stays. No scheduler, RNG enrollment, new workload coefficient or save migration.

The following repeats the baseline's 250 seeds, save-cloned paired teen states and first-choice
policy. Each measured annual advance reconciles. With no manually selected work, all 10,212
observed age-23–64 years and all 4,258 older years now show exactly six available adult choices.
All 1,240 age-18–22 years retain work, averaging eleven choices with the legacy options included.
Menu availability is not a random offer rate or automatic enrollment rate.

### School shifts (238 paired lives)

All values are p10 / median / p90. Capacity and the Smarts-at-18 distribution remain unchanged:
capacity 21.12 / 23.44 / 25.82 hours/week; Smarts 52 / 83 / 91.

| Work    | Pay at 17                   | Pay at graduation (18)      | Performance at 17 | Stress at 17 | Cash at 18                  |
| ------- | --------------------------- | --------------------------- | ----------------- | ------------ | --------------------------- |
| None    | $0 / $0 / $0                | $0 / $0 / $0                | 51 / 85 / 99      | 3 / 11 / 28  | $0 / $6,927 / $38,845       |
| Retail  | $7,600 / $8,867 / $9,800    | $7,667 / $8,867 / $9,867    | 51 / 84 / 98      | 7 / 22 / 51  | $7,428 / $18,369 / $50,148  |
| Kitchen | $9,500 / $10,917 / $11,917  | $9,500 / $11,000 / $12,000  | 50 / 84 / 98      | 9 / 26 / 56  | $11,239 / $21,412 / $53,367 |
| Both    | $18,034 / $19,700 / $21,000 | $18,217 / $19,766 / $21,000 | 44 / 78 / 92      | 30 / 49 / 82 | $25,860 / $33,918 / $64,428 |

Graduation previously paid zero. Retail's median cash at 18 rises from $9,926 to $18,369;
kitchen $10,680 to $21,412; both $13,394 to $33,918. This combines the approved higher pay and
repairing the graduation gap. Hours at 17 are unchanged: none 3 / 7 / 12, retail 15 / 19 / 24,
kitchen 17 / 21 / 26, both 29 / 33 / 38. One shift barely changes median grades; two retain the
existing meaningful school/stress consequence. The college integration tests use affordable
real program ids and prove pay, degree-plus-work hours and the existing performance penalty.

### Adult work alongside the played life

Clone the same living snapshots at 30 or 65, retain their real jobs/families/activities, choose
none, repairs, repairs plus pet care, or all six gigs, then play five years with the same first
choices. This is a side-work comparison, not a population of unemployed or purely retired
adults. Gross is five-year cumulative pay; stress/happiness/cash are final-state quantiles.

| Age 30→35 (247 lives) | Five-year gross, p10 / median / p90 | Final stress   | Final happiness | Final cash                   | Years at stress ≥30 |
| --------------------- | ----------------------------------- | -------------- | --------------- | ---------------------------- | ------------------- |
| None                  | $0 / $0 / $0                        | 4 / 16 / 56    | 45 / 70 / 83    | $3,926 / $36,420 / $194,297  | 30.53%              |
| Repairs               | $33,450 / $50,550 / $57,000         | 9 / 32 / 81    | 33 / 67 / 81    | $5,500 / $46,938 / $206,373  | 49.64%              |
| Repairs + pet care    | $50,175 / $76,050 / $85,500         | 21 / 50 / 98   | 23 / 59 / 78    | $8,641 / $52,700 / $205,013  | 71.50%              |
| All six               | $184,208 / $215,949 / $236,309      | 97 / 100 / 100 | 12 / 21 / 36    | $21,149 / $90,485 / $207,887 | 99.84%              |

All four scenarios have 1,235 person-years and no deaths. Across the entire cohort side-work
taxes total $0, $4,007,651, $6,081,722 and $19,491,378 respectively. These totals are not per-life.

| Age 65→70 (224 lives) | Five-year gross, p10 / median / p90 | Final stress    | Final happiness | Final cash                    | Years at stress ≥30 |
| --------------------- | ----------------------------------- | --------------- | --------------- | ----------------------------- | ------------------- |
| None                  | $0 / $0 / $0                        | 23 / 61 / 100   | 25 / 61 / 79    | $3,701 / $58,760 / $478,769   | 73.30%              |
| Repairs               | $27,750 / $47,700 / $57,750         | 60 / 100 / 100  | 19 / 34 / 62    | $4,022 / $74,168 / $500,766   | 94.73%              |
| Repairs + pet care    | $41,625 / $71,550 / $86,625         | 86 / 100 / 100  | 15 / 28 / 50    | $10,341 / $82,528 / $511,407  | 98.00%              |
| All six               | $178,467 / $205,600 / $230,174      | 100 / 100 / 100 | 12 / 20 / 28    | $25,123 / $132,547 / $578,066 | 100.00%             |

None has 1,101 person-years and 18 deaths; each working variant 1,100 and 19 deaths. Cohort
side-work taxes are $0, $3,721,987, $5,637,254 and $17,957,384. Do not infer causal mortality
from a one-person difference. Existing age-related capacity and retained regular work explain
why added work is especially costly here; P6 does not recalibrate retirement spending (P15).

**Judgment and remaining findings:** the approved six jobs can outgross some low-paid careers
when stacked, but the real hidden workload makes doing all six costly rather than free income.
At 30, median stress rises 16→100 and happiness 70→21. Adult gig hours previously never reached
stress, so this is a wiring repair using existing coefficients. Older working lives already
have substantial stress without added gigs. Keep those findings visible; do not silently retune
approved pay, workload or retirement parameters. P7 is untouched.

## Tests and sabotage

43 new tests: education 16, simulation 13, mobile 11, persistence 2, finance 1. They cover real
commands, underage/unknown/duplicate gates, taking a third job, quitting, every school stage,
final-year pay/hours, school and college overload, adult stress, real annual tax/living inputs,
subsequent income bases, source/amount text, ledger reconciliation, finance/loan readers,
full screen menus and actions, v45 round-trip, malformed ids and seeded continuation.

Only the old two-not-three cap assertion was superseded, as explicitly approved. It now proves
canonical third-job selection; all other legacy tests remain. The original idle-graduate
identity assertion was preserved by avoiding unnecessary state allocation. New screen fixtures
use the existing uppercase heading renderer; tax-base spies target the actual owning module.

All 32 independent behavioral mutations were caught after adding the missing held-work case; **none missed**. Each trial starts from
the same tar-backed source bytes; all ten source MD5 hashes were asserted restored. Compiler or
import failures do not count. Two detections use explicit test-helper runtime errors (third job
refused and missing Career row), not a matcher assertion. One meaningful screen case was added after the extra held-subset mutation survived. Native-device checks and Claude Project
mirroring remain unavailable: no emulator/device or `project_write` capability is exposed.

## Verification and publication

All fifteen packages typecheck; the full suite passes 2,713 tests. `pnpm verify` reaches content
validation and fails nine existing generated-catalog comparisons: activities, advice, auctions,
businesses, events-childhood, homes, renovations, valuables and vehicles. No catalog is rewritten
to hide that environment/baseline issue. Restore the validator's incidental vehicle-mods rewrite.
Changed files pass Prettier; full formatting still reports the same 22 historical notes.
Save v45 and both earlier migrations remain; TICKET stays 0708 in both owners.

PR #18: https://github.com/PaytonBlevins/YearAfter/pull/18 (targets main; depends on P1 #13
through P5 #17). Published implementation `e9b387f` matches the locally verified file tree.
Actual implementation CI run 107
(https://github.com/PaytonBlevins/YearAfter/actions/runs/37739157071) fails formatting on the same
22 historical notes listed by the local full-format check. Its typecheck, tests and content
validation steps are skipped. The local full verification above ran those gates; CI is not green. Payton merges the stacked PRs. P7 waits for go-ahead.

### Sabotage-verification report

| #   | Independent mutation                   | Result                                |
| --- | -------------------------------------- | ------------------------------------- |
| 1   | adult work ages out at 22              | Caught                                |
| 2   | drop direct minimum age                | Caught                                |
| 3   | restore a two-job menu cap             | Caught                                |
| 4   | allow duplicate take                   | Caught                                |
| 5   | skip work in early-return years        | Caught                                |
| 6   | college drops paid work                | Caught                                |
| 7   | adult work hours are zero              | Caught                                |
| 8   | college omits work hours               | Caught                                |
| 9   | college ignores overload penalty       | Caught                                |
| 10  | drop the last year payout              | Caught                                |
| 11  | tax child earnings                     | Caught                                |
| 12  | shifts pay no incremental tax          | Caught                                |
| 13  | freelance pays no tax                  | Caught                                |
| 14  | ignore wages in the side tax stack     | Caught                                |
| 15  | living misses net side income          | Caught                                |
| 16  | living misses gross side income        | Caught                                |
| 17  | business tax base misses work          | Caught                                |
| 18  | creator tax base misses work           | Caught                                |
| 19  | deal tax base misses work              | Caught                                |
| 20  | do not post the side tax               | Caught                                |
| 21  | underwriting misses work income        | Caught                                |
| 22  | dashboard tax denominator misses work  | Caught                                |
| 23  | duplicate ids pay twice                | Caught                                |
| 24  | work ledger pays a negative amount     | Caught                                |
| 25  | shift wages classified as freelance    | Caught                                |
| 26  | screen truncates available work        | Caught                                |
| 27  | screen takes wrong id                  | Caught                                |
| 28  | quit retakes the job                   | Caught                                |
| 29  | screen hides part-time section         | Caught                                |
| 30  | Career hides the part-time entry label | Caught                                |
| 31  | child parental gate removed            | Caught                                |
| 32  | Screen truncates held work             | Caught after adding all-six-held case |

An additional held-subset truncation mutation initially survived: the screen tests exercised
all six available options, but not all six held together. Added a case that holds all six,
requires every row to be a Quit action and verifies each real id. The same mutation is now
caught. The available-menu truncation remains a separate mutation, using a type-valid slice.
Final result: all 32 caught, none missed; one initial test gap repaired without weakening tests.
