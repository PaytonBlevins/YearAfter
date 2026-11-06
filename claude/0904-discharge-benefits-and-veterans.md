# 0904 — Discharge, benefits and veterans

**Status: DONE (engine).** No screens: they are 0906's. **Save change: v61 → v62.** Agent B's saves must start at **v63**
(`CLAIMS.md`). Fourth ticket of v0.09 Military, stacked on 0903 (`0903-deployments.md`) on `integrate/sports-on-main`. It
closes finding 166 (a retiree paid nothing) and the "discharge types" and "no medical discharge" halves of findings 184 and 188.

Payton's answers (November 2026):

- **Discharges:** fewer. **Honorable, general, medical, dishonorable** (and the entry-level separation a washed-out recruit
  already had). No other-than-honorable, no bad-conduct.
- **Retirement pay:** a **pension at twenty years** and nothing else: no thrift savings plan, no continuation pay, no VA
  disability pay.
- **GI Bill:** **tuition and housing through college.**
- **The civilian road:** **veterans' preference on public and safety jobs** and nothing else: no skills that carry over, no
  job bars for a bad discharge.

## What changed in the engine

A life that never serves replays exactly as it did: every draw is a hash of the seed, the generation and a name
(`service:<seed>:<generation>:medical:<age>` and `…:misconduct:<age>`), so no random stream is touched, and every new row, line
and field is absent for a life with no service (a test compares one field for field).

### The character of a discharge

A career that ends is a past service with a `how` and now a `discharge` that follows from it
(`dischargeOf` in `content/src/military-veterans.ts`, used by `military.ts` where a career ends):

| Ending                                   | Discharge                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| washed out of basic or officer training  | entry-level (as before)                                                                |
| retired (twenty years or more, or at 65) | honorable, always                                                                      |
| killed in service                        | honorable, always                                                                      |
| a medical board sent them home           | **medical**                                                                            |
| a court-martial                          | **dishonorable**                                                                       |
| a term ended by choice, or an officer passed over | honorable, or **general** with a service reputation under **50**               |
| not asked to stay                        | **general** with a reputation under **52**, or if they refused the orders that term; else honorable |

A general discharge adds a line to the feed saying so.

**A medical board** looks at a serving member, at home and not in training, who holds a **serious injury that came from
service** (the blast injury, lost limb, brain injury, burns and post-traumatic stress 0903 added; shrapnel, a minor one, is
not enough). Each year they are sent home with a **40%** chance. With **twenty years or more** in, a medical board sends them
home on a retirement instead, with the pension. A medical discharge is the full GI Bill whatever the time served.

**A court-martial** can reach a member at home, not in training, with **discipline under 35 and a service reputation under 50**,
at **5% a year**. It is a dishonorable discharge and nothing else: no jail and no criminal record (Crime has its own
breakdown later). It loses the GI Bill, the preference and any pension at once.

### Retired pay

Real: the Blended Retirement System pays **2% of the average of the highest 36 months of basic pay for each year of
service**, so 40% at twenty years. Here, for a past service that ended `retired` with twenty years or more: 2% × the years
(never above 75%) × the average of the last three years' basic pay at the final grade, whole dollars a year, from the year
after the career ended and for life. With more than one pension earned, the largest is paid. It posts as `assetIncome`
("Military retired pay"), untaxed here as the civilian pension is, and counts as the household's income for the year's
living costs. A line in the feed says it began. Nothing else is built (no match, continuation pay or disability pay).

### The GI Bill

Real: the Post-9/11 GI Bill pays tuition up to a yearly cap and a monthly housing allowance, for thirty-six months, at a
share set by how long somebody served (100% at 36 months, 90% at 30 to 35, 80% at 24 to 29, 70% at 18 to 23, 60% at 6 to 17,
50% at 3 to 5), and a discharge for a service-connected disability pays the full 100%. The 2026–27 figures: tuition up to
**$30,908** and **$2,396** a month of housing. Here:

- It is for an **honorable or medical discharge** (`how` not `killed`), the months of every earning service added, and not for
  somebody still serving. It is for **a first degree or a trade school**, never graduate school (the 0210b rule that parents
  don't pay for it holds for the GI Bill too).
- A year at college uses **nine months** of the thirty-six, so four years use them all. The last year's aid and allowance are
  prorated to the months left.
- It pays **its share of the tuition** (`collegeSupportOf` and the school year both read it, so the affordability gate and the
  bill agree) and a **housing allowance** for nine months at its share, posted as a `gift` ("GI Bill housing allowance"),
  untaxed. A year the character left for want of money doesn't count as attended; a year they failed out of does.
- `military.giBillMonthsUsed` is saved. A line says it began and one says it ran out.

### Veterans' preference

Real: a person discharged under honorable conditions gets points added to a federal application (5 for qualifying service,
10 for a disability); an enlisted member needs 24 months of service unless a disability ended it. Here, `hireChance` adds
**0.15** to the odds on the **`public` and `safety` tracks** and nowhere else, for a past service with an honorable, general or
medical discharge and two years or a medical discharge, when no career is going. It never opens a job the person lacks the
education or license for (the hard gates still return zero first).

## Measured

**Discharges** (simulated careers on the branch's own first specialty, 80 starts a branch, a seed each, a 70% chance of
staying at each term's end; the rest taken from the hash):

| Population                                                   | Lives | Honorable | General | Dishonorable | Entry-level |
| ------------------------------------------------------------ | ----- | --------- | ------- | ------------ | ----------- |
| Typical (discipline 40–85, smarts 30–80, health 55–90)       | 394   | 83.5%     | 2.5%    | 0%           | 14.0%       |
| Weak as well (discipline 15–85, smarts 15–85)                | 355   | 63.7%     | 16.9%   | 0.6%         | 18.9%       |

The service reputation these lives ended with (not counting wash-outs) ran from **47 to 55**, the median **51** and a tenth
under 50. That is why the dials are where they are (finding 196). Of the typical lives 17% retired at twenty years or more,
the policy's doing and not a finding.

**Retired pay at twenty years** (basic pay at the 2026 table, final grade held for the last three years):

| Grade   | E-5     | E-6     | E-7     | E-8     | E-9     | O-3     | O-4     | O-5     | O-6     |
| ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |
| A year  | $21,224 | $25,285 | $29,761 | $32,988 | $37,706 | $43,220 | $50,448 | $56,737 | $63,971 |

At thirty years: an E-9 $66,729 (60%), an O-6 $109,358.

**GI Bill, a year at college** (the game's tuition is $9,400, under the cap, so the cap doesn't bite): at 100% the aid is
**$9,400 of tuition plus $21,564 of housing, $30,964 a year**, $123,856 over the four years against a civilian's $37,600 of
tuition. At 60% (one year served): $5,640 of tuition and $12,938 of housing, the student paying $3,760.

**Preference, the same life with and without service** (a high-school graduate with a little work behind them): the first
rung of public service 0.39 → 0.54, of safety 0.43 → 0.58, retail 0.55 → 0.55 and trades 0.39 → 0.39.

## Findings (roadmap 196–207)

196. **The discharge dials are judgements, set from a measurement.** No source for the shares of honorable and general
     discharges was found. A service reputation starts at 55 and follows a performance that aims at 46 ± 14, so it ended
     between 47 and 55 in every life measured. The first dials (general under 40, 55 for not asked to stay) were never reached
     (0 general or dishonorable discharges in 197 lives) and were moved to **50 and 52**; the court-martial's reputation line
     went from 40 to 50 and its chance from 4% to 5%. Dials: `GENERAL_BELOW`, `NOT_RETAINED_GENERAL_BELOW`,
     `MISCONDUCT_*`, `MEDICAL_BOARD_CHANCE`.
197. **The service reputation has a narrow range** (47–55). A general discharge, a court-martial and the others that read it
     turn on a few points. A wider reputation is a 0901 change and wasn't made here.
198. **A medical discharge cannot happen in play yet.** The injuries that send a member before a board only come from a
     deployment, and nothing opens the gate (finding 182). The board is tested by giving a member the condition directly.
199. **A court-martial is a draw and a label.** No trial, sentence or prison, and no criminal record. One dishonorable discharge
     stands for every bad one.
200. **There is no other-than-honorable or bad-conduct discharge, and no appeal or upgrade** (Payton's "fewer").
201. **The pension is the Blended Retirement System's formula only.** No thrift savings plan, continuation pay or disability
     pay. It is untaxed and is not raised for inflation (the economy is constant-dollar). A member medically retired under
     twenty years gets no pension (the real rules give one for a high disability rating; there is no rating here).
202. **The GI Bill is tuition and housing only.** No books stipend, no housing rate by place, no transfer to a family
     member, no Yellow Ribbon top-up, no graduate school. The allowance ($21,564 a year at 100%) is paid whatever the
     student's rent is, so a veteran at college is better off than a working civilian of the same age.
203. **Veterans' preference is a flat +0.15 on two tracks.** The real thing is points on a federal application, with a larger
     one for a disability. No skills carry over and no discharge closes a door (Payton's choice).
204. **0901's not-retained discharge changed.** It was always honorable and is now general below a reputation of 52. One 0901
     test was updated to give its member a good reputation.
205. **No effect on the world's view of a veteran** beyond the hiring odds: no standing, no stigma for a bad discharge.
206. **Finding 165 is still open.** Events gated on "has a job" still read a serving member as unemployed. Not touched.
207. **0904 took save v62.** Agent B's saves are v63 and onward.

## Files

- `content/src/military-veterans.ts` (new): the discharges, the dials, `dischargeOf`, `retiredPayFor`, the GI Bill tiers and
  amounts, the preference's tracks and bonus, and the line pools.
- `simulation/src/military-veterans.ts` (new): `holdsServiceInjury`, the retired pay and its start, the GI Bill's share, months
  left, tuition aid and housing, `veteranPreference`, and `runVeteransYear` (the year's pay, months and lines).
- `simulation/src/military-state.ts`: two new endings (`medical`, `misconduct`), the five discharges, `giBillMonthsUsed`.
- `simulation/src/military.ts`: a discharge for every ending (`dischargeOf`), the medical board and the court-martial in
  `runMilitaryYear`.
- `simulation/src/advance.ts`: the retired-pay and housing rows, both in the household's income, the months stored, the lines.
- `simulation/src/college.ts`, `phases/education.ts`, `education/src/progression.ts`: the GI Bill's tuition in a year's
  support; `collegeEnding` exposed so a year left for want of money isn't counted.
- `careers/src/employment.ts`, `simulation/src/careers.ts`: `Applicant.veteran`, the bonus, `chanceOf` setting it.
- `persistence`: save v62, migration 61 to 62 (the version only), a validator for the new endings, the only discharges each
  ending can carry, and the months used (a whole number, at most 36).
- `finance/src/summary.ts`, `tools/content-validator/validate.mjs`: `TICKET = '0904'`.
- `simulation/src/military-0904.test.ts` (new, 75 tests), `persistence/src/military-0904.test.ts` (new, 6);
  `military-0901.test.ts` (one test, a good reputation), `military-0903.test.ts` and `persistence.test.ts` (the version).
- `specs/CORE_RULES.md` 13.220–13.222.

## Tests and sabotage

**Tests.** 75 in the simulation and 6 in persistence: the real figures pinned (the 2% and the 40%, the pension at twenty and
past it and its ceiling, every GI Bill tier at both edges, the cap, the housing, the preference's rules), every branch of
`dischargeOf` at its edge, the medical board (the draw on each side, serious and from service only, away and in training,
twenty years or more, the full GI Bill after it), the court-martial (the draw, both conditions at their edges, the reputation
as it stands after the year, away and in training), every way a career ends and the discharge it gets, the pension in the
ledger (the year after, untaxed, each year, not before, not for nineteen years), the GI Bill at college (tuition, housing,
nine months a year, the last partial year, none for a discharge that didn't earn it, none for graduate school, a trade
school, a year left for want of money), the hiring odds on every track, and a life with no service unchanged. The save tests
cover every ending paired with every discharge the engine writes and refuse every pair it can't.

**Sabotage by hand.** 68 deliberate breaks, each run against the tests for its package (the discharge rule at each edge, the
pension's year, years and ceiling, the tiers, the cap, the share of a year, who earns the GI Bill, who is serving, the board's
and the court-martial's conditions and edges, the row's category, the months stored, the preference's gates, the save's pairs
and its count). **Eight survived at first and got tests:** the end of the GI Bill repeating its line, a recorded zero of months
used, the general note leaking onto other discharges, the discharge using the year's start reputation, the trade-school stage,
the pension counting as the household's income, and a year left for want of money counting as attended (twice). **One showed a
dead argument** (a refusal passed where it could never matter) and the argument was removed. **Six are equivalent** and left:
the guard against nothing earned (the tier is zero anyway), the share check twice (the product is zero anyway), the
percent-and-months test (months are zero when the share is), and the two `<` against `<=` on a hash draw (a draw is never
exactly the line).

## Open

Payton may want to move: the discharge dials and the reputation range behind them (196, 197), the board's 40% and the
court-martial's 5% (196), the 75% ceiling and the pension's reach (201), the housing allowance's size (202) and the
preference's 0.15 (203). Next is 0905 (military intelligence and the agencies); it is not started. Device checks do not
apply: there are no screens.
