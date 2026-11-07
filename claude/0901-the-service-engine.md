# 0901 — The service engine, with the Army

**Status: DONE (engine); two rules here were changed by 0902 (see the last section).** No screens: they are 0906's. **Save change: v58 → v59.** Agent B's saves must start at
**v60** (`CLAIMS.md`). First ticket of v0.09 (Military, Intelligence, Politics, Crime); this one is Military, stacked on
`integrate/sports-on-main`. The measurement and breakdown that led here are `v009-military-measurement.md`.

Payton's answers (29 October 2026):

- **The breakdown:** 0901 the service engine with the Army; 0902 other branches, specialties and officers; 0903
  deployments; 0904 discharge, benefits and veterans; 0905 military intelligence and the agencies; 0906 screens, last.
  Politics and Crime get their own breakdown later.
- **The road in:** enlist from **17 to 35**, by a recruiter's offer or by applying. **No draft.**
- **Danger:** rare death and real injuries in service. That is 0903; 0901 has neither.
- **Branches:** Army, Navy, Marine Corps, Air Force and Coast Guard, four or five specialties each. **No Space Force.**
  0901 builds the Army only.
- **Terms:** a **four-year term, then a choice** (re-enlist or leave). Basic training can wash out.
- **Promotion:** by time in service **and** a yearly performance read from **Discipline, Smarts and Health. Charisma is
  left out.** The existing **Work Harder** button feeds service performance; there is **no new "Volunteer" action.**
- **Pay:** **base pay on the real 2026 table, with housing provided.**

## What changed in the engine

A character gains a service life, `GameState.military`, empty until somebody enlists. **A life that never goes near a
recruiter replays exactly as it did before:** every draw is a hash of the seed, the generation and a name, so no RNG
stream is touched, and the offer test spends nothing when it fails.

### Getting in

- **A recruiter's offer.** Each year, somebody who meets the standards and is not in school is offered enlistment at a
  chance set by age: **2.2% a year to 24, 1.0% to 29, 0.3% to 35**, and none outside 17–35. Turned down, none is raised
  the next year. One question a year (spec 1233): if another field raised a question that same year, the recruiter's
  offer waits.
- **Applying.** The same standards, no roll: the office takes or turns away. One visit a year.
- **The standards** (the only gate): age 17–35, **not in school**, a **diploma or an equivalent**, **Health 50 or more**,
  **Smarts 30 or more**, and no other full-time career (pro sports, a coaching job, acting, music or modeling as a living).
  A refusal says which one, in words.
- **Joining.** A held job is resigned, as signing a contract does. The timeline gets a milestone, the life record a
  line. Nothing is paid until the year runs.

### Basic training

The first year is basic training. **12.6% of recruits of middling fitness do not finish** (real: the GAO's FY1993 cohort
lost 13.6% in the first six months). The chance is `0.145 + (58 − fit) × 0.004`, clamped to 4%–35%, where fit is
Discipline × 0.5 + Health × 0.35 + Smarts × 0.15. Charisma is not in it. Somebody who does not finish goes home with six
months of E-1 pay and an **entry-level** discharge, and a record line, and a bad mood. Somebody who does finish is a
**private first class (E-3)** and is serving.

### Grades and pay

Nine enlisted grades with the Army's titles (Private, Private First Class, Specialist, Sergeant, Staff Sergeant,
Sergeant First Class, Master Sergeant, Sergeant Major). The first three are certain; after that a grade needs time in
service **and** a chance a year:

| Grade | Title                | Years first | Chance a year, at a 60 |
| ----- | -------------------- | ----------- | ---------------------- |
| E-4   | Specialist           | 2           | 85%                    |
| E-5   | Sergeant             | 3           | 55%                    |
| E-6   | Staff Sergeant       | 6           | 30%                    |
| E-7   | Sergeant First Class | 10          | 20%                    |
| E-8   | Master Sergeant      | 14          | 10%                    |
| E-9   | Sergeant Major       | 18          | 6%                     |

The chance is scaled by the year's performance (a 60 is the table, 100 is 1.8 times, 20 is a fifth) and is never above
95%. **A grade is never skipped.** Pay is the **2026 enlisted basic pay table** (a 3.8% raise from 1 January 2026), by
grade and years served, twelve months of it: E-1 $28,886, E-3 at four years $38,376, E-5 at four years $47,362, E-7 at
twenty years $74,948, E-9 at twenty years $97,261. **Housing and food are provided and are not a row.** The household's
living cost is read at the at-home share while a single person with nobody at home serves; a person with a partner or a
child at home pays the whole household's.

### Performance

Each year performance moves towards a target the way a civilian job's does: **46 for an ordinary year, 70 once Work
Harder has stuck**, moved up or down by up to 14 by aptitude (Discipline 0.45, Health 0.30, Smarts 0.25). **Charisma
does nothing here.** A service reputation of its own is kept (spec 11), never shown as a number.

**Work Harder** is the same button as at a desk. Pressed in uniform it moves this year's performance most of the time
and makes the effort stick; two presses a year count and later ones change nothing and cost nothing. Its draws are
hashes, not a stream.

### The end of a term

A term is four years. At the end of one, **somebody whose work has been middling or better is asked: stay four more
years, or leave.** Somebody whose performance sits under 47 **is not asked** and goes home honorably. **Twenty years is
retirement** (no question). Leaving keeps what the career was (`PastService`: branch, years, final grade, how it ended,
the discharge) and a record line; 0904 grows discharges and what follows one.

### Money, stats, the feed

- **Pay** is taxed on top of everything else the year earned (the same chain as sports, acting, music and modeling) and
  posted as two ledger rows, **Army pay** and **Tax on Army pay**.
- **Stats.** A serving member does not get the idle-years drift a person with no job gets; the service's own year is
  what moves them: basic gives +2 Discipline and +2 Health, the rest of a first term +1 Discipline.
- **The header** is the rank while it lasts ("Sergeant, Army"); job offers stop for somebody in uniform (as for a pro).
- **The feed** gets a line a year, a milestone for a rise, a wash-out, the end of a term and retirement.

## Measured

150 lives to fifty or death, the ordinary answers (`ordinaryChoice`), under three policies; and 4,000 recruits of middling
fitness run through the service year by year.

| Policy (150 lives)                | Offered | Served | Endings             | Median years | Final grade q10 / q50 / q90   | Median cash at end |
| --------------------------------- | ------- | ------ | ------------------- | ------------ | ----------------------------- | ------------------ |
| Ordinary (declines the offer)     | 18      | 0      | —                   | —            | —                             | $66,087            |
| Accepts and re-enlists to the end | 18      | 18     | 17 retired          | 20           | 7 / 8 / 9 (before the retune) | $67,493            |
| Accepts and leaves at four years  | 18      | 18     | 18 left at the term | 4            | 4 / 5 / 5                     | $65,944            |

**12% of lives are offered enlistment** at some point, at a median age of 22 (q10 19, q90 30). A player who takes every
offer serves in about one life in eight, against roughly one US adult in fourteen who is a veteran; a player who declines
some lands near it. Median cash at fifty is within 2% across the three policies, so service is not a money machine.

After the retune (promotion times 10 / 14 / 18 years for the top three grades, chances 30% / 20% / 10% / 6%), 4,000
recruits who re-enlist to the end: **12.6% wash out of basic; 4.8% of enlistees are not asked to stay; of those who
retire at twenty years, 3% retire as E-5, 25% as E-6, 50% as E-7, 20% as E-8 and 2% as E-9.** (The first calibration
had 10% retiring as E-9 and 34% as E-8, which is far above the real force; real figures for the grade of retirees were
not found, so these are named judgements.)

## Findings (roadmap 160–168)

160. **Only the pay table, the force profile, the first-term attrition and the Army titles are real.** The pay table is a
     third-party reading of the DFAS chart and **has not been checked against DFAS**; the first-term attrition is a 1998
     cohort. Everything else is a game dial: the offer rates, the standards, the promotion times and chances, the
     performance targets, the training pass rate and the retention floor. Each is a named constant in
     `content/src/military.ts` and pinned in the tests.
161. **The share who serve is generous.** 12% are offered; taking every offer serves one life in eight. Dials:
     `enlistOfferChance`.
162. **A dropout cannot enlist.** The standard asks for a high-school credential, and the game has no GED, so a character
     who dropped out has no way in. The real Army takes a small share of people without a diploma. Fixing it is a GED
     ticket, not this one.
163. **First terms end in three ways here, not the real mix.** In 0901 a first term ends by washing out of basic (12.6%),
     by not being asked to stay (4.8%) or by choice. The real first-term attrition (35.8% in 48 months, mostly misconduct,
     medical and performance) needs discharges, injuries and deployments; they come with 0903 and 0904.
164. **A serving member can still be raised an acting, music or modeling offer.** `withAnyOffer` stops job offers for
     somebody in uniform, but those engines raise their own offers with no guard, and a taken one would run beside
     service. It is rare (neither field is common in a soldier's years) and untouched here. 0902 should add the guard.
165. **Events gated on "has a job" read a service member as unemployed.** The employment event gates look at
     `employment.job`, which a soldier does not have. Nothing in 0901 reads them as a job; a pass over the work events
     belongs with 0904, when a veteran's work history matters.
166. **A 20-year retiree is paid no pension.** Retirement ends the service and starts nothing: no pension, no TSP, no GI
     Bill. The Blended Retirement System (40% of the high-three at 20 years), the TSP match and the GI Bill are 0904.
167. **Performance is never shown.** The service reads it, a screen will say a word, and the number is not a field a screen
     can read (spec 1107). The reputation word is `serviceReputationWord`.
168. **Save v59.** 0901 took it for `military`. Agent B's saves are v60 and onward; `CLAIMS.md`, `HANDOFF.md` and the
     brief say so.

## Files

- `content/src/military.ts` (new): the branch row (the Army and five made-up posts), the standards, `enlistOfferChance`,
  the nine grades with the promotion table, `riseChance`, `washOutChance`, `serviceFit`, `servicePerformanceTarget`,
  `RETAIN_PERFORMANCE_FLOOR`, the 2026 pay table with `monthlyBasePay`, `annualBasePay` and `washOutPay`, and the lines.
- `simulation/src/military-state.ts` (new): the saved types (`ServiceCareer`, `PastService`, `MilitaryOffer`,
  `MilitaryState`, `EMPTY_MILITARY`).
- `simulation/src/military.ts` (new): reading a service life, the standards, applying, the offer and its answer,
  `runMilitaryYear`, `withMilitaryOffer`, `militaryOccupation`.
- `simulation/src/military-work.ts` (new): Work Harder in uniform and its two-a-year cap.
- `simulation/src/careers.ts`: `workHarder` and `pushesLeft` hand over to the service when somebody serves.
- `simulation/src/phases/living.ts`: a `housingProvided` input, read at the at-home share for a single person with no
  children, that does not change the address the household remembers.
- `simulation/src/game-state.ts`, `advance.ts`, `offers.ts`, `decide.ts`, `ordinary-answers.ts`, `index.ts`: the field,
  the year (pay, tax, ledger rows, stats, living, header, records, the one-question-a-year rule, the offer), the job
  guard, the answer route, the harness declining `military.offer`, and exports.
- `persistence`: save v59, migration 58 to 59 (an empty service), validation of `military`.
- `finance/src/summary.ts`, `tools/content-validator/validate.mjs`: `TICKET = '0901'`.
- `apps/mobile/src/screens/shells.tsx`: the Crime and Gambling placeholder rows named the old numbers 0901 and 0902, which
  now mean something else; Crime now says `v0.09` and Gambling `v0.10` (the label is never shown; the player reads "Not
  built yet"). Gambling's real home is not in the roadmap, so `v0.10` is a holding label, not a decision.
- `simulation/src/military-0901.test.ts` (new, 128 tests), `persistence/src/military-0901.test.ts` (new, 9 tests);
  `persistence.test.ts` (two tests moved to v59).
- `specs/CORE_RULES.md` 13.204–13.207.

## Tests and sabotage

**Tests.** 128 in the simulation (the standards one by one, applying, the offer and its answer, basic training and the
wash-out, grades and the promotion table, pay against literal 2026 figures, performance, Work Harder and its cap, the
end of a term, retirement, the housing rule for single, married and parent households, the one-question-a-year rule,
another full-time career standing in the way, the ledger rows and tax, and replay of a life that never meets a
recruiter) and 9 in persistence (v59 round trip, the migration from v58, validation of every field of a service life, an
offer and a past service). Fixtures that start from a played life state the gate's inputs (diploma, not in school) so a
test cannot pass by accident. The firing seeds were found by computing the hash first, not by trying.

**Sabotage by hand.** 31 deliberate breaks, each run against the suite: the wash-out test inverted, a recruit's grade
jumping in training, no minimum years for a grade, retiring late, never asking the not-retained, re-enlisting one year
off, leaving recorded as retiring, the health floor `>` to `>=`, no resignation of a held job, the turned-down window,
pay read from the next year's row, Charisma in the fit, the push cap, effort not sticking, housing not provided, the
idle-years drift for soldiers, no tax, the offer ignoring the one-question rule, job offers while serving, a partner or
a child paying the at-home share, the pay table, offer ages swapped, Work Harder not routed (in `workHarder`,
`pushesLeft` and `decide`), the occupation, the recruiter's offer dropped, the validators, the migration overwriting and
the serializer dropping the field. **31 of 31 are caught** (five were not at first and got tests: the training grade
jump, Charisma in the fit, the idle drift, job offers while serving and the recruiter's offer dropped).

**Sabotage by machine.** A line mutator over the three new simulation files and the content file (186 mutants after the
ones the hand pass already killed): 171 caught, 15 survived. Five of those were real holes and got tests (another career
being the whole year: sports, a post, acting and music, and a rise year having exactly one line); all five are now caught
on their own. **Ten survivors are equivalent and named:** the `<` against `<=` edge of a hash draw (the offer, the
wash-out, the rise and the Work Harder success: a hash is a float that never lands on the edge), the flat E-1 and E-2
rows with the array one longer or shorter (the same pay at every year), `let step = 0` starting at 0 or 1 (the loop
overwrites it), and `washOutPay` with years 1 (E-1 pay is flat). None can change a result a player could see.

## Open

Payton may want to move: the share who serve (161), the dropout bar (162), the promotion table, which is mine (160), and
what a retiree receives, which is 0904 (166). Next is 0902 (the other branches, specialties and officers); it is not
started. Device checks do not apply: there are no screens.

## Changed by 0902

0902 (`0902-branches-specialties-and-officers.md`) builds on this engine and changes three things written above.
**Twenty years is no longer a forced retirement:** from twenty years a member may retire whenever they choose, the
question at the end of every term becomes Retire or Stay, and the only hard stop is age 65. **Army only is no longer
true:** all five branches run on this engine, and the recruiter's offer is a three-step question (a branch, then a
ladder for somebody with a degree, then a job) instead of a yes or a no. **The enlisted pay table is shown beside the
real officer table**, which was read from DFAS itself. The promotion table, the basic-training rate and the standards
above are unchanged, and a life that never meets a recruiter still replays exactly.
