# 0902 — The other branches, specialties and officers

**Status: DONE (engine).** No screens: they are 0906's. **Save change: v59 → v60.** Agent B's saves must start at
**v61** (`CLAIMS.md`). Second ticket of v0.09 Military, stacked on 0901 (`0901-the-service-engine.md`) on
`integrate/sports-on-main`. It also closes finding 164 (a serving member could still be raised an acting, music or
modeling offer).

Payton's answers (November 2026):

- **Officers:** a bachelor's degree and a commission, **or** promotion from the ranks by a board. Ranks **O-1 to O-6 on the
  real 2026 officer pay table.** No warrant officers and no generals or admirals (named gaps below).
- **Branches:** the same engine with different tables. **Army, Navy, Marine Corps, Air Force and Coast Guard,** four or
  five specialties each, no Space Force.
- **Choices:** the player chooses **both** the branch and the specialty.
- **Twenty years:** "Make the hard stop at like 65 and let them retire by choice anytime after 20." This replaces 0901's
  forced retirement at twenty years.

## What changed in the engine

A life that never goes near a recruiter still replays exactly as it did: every new draw is a hash of the seed, the
generation and a name (`ocs`, `orise`, `board`, beside 0901's `basic`, `rise`, `offer`, `post`), so no random stream is
touched.

### Five branches, one engine

Each branch is a table row (`content/src/military-branches.ts`): its name and what a member is called, its word for
basic training and how long it runs, the school that makes an officer, its enlisted and officer titles (the Navy's
petty officers and the Army's sergeants are the same grade), the age and the Smarts at its door, and five made-up posts.

| Branch       | Basic training                   | Officer school            | Oldest enlistment (real 2026 / game) | Oldest commission | Smarts |
| ------------ | -------------------------------- | ------------------------- | ------------------------------------ | ----------------- | ------ |
| Army         | basic training, 10 weeks         | Officer Candidate School  | 42 / **35**                          | 33                | 30     |
| Navy         | boot camp, 8 weeks               | Officer Candidate School  | 41 / **35**                          | 33                | 30     |
| Marine Corps | boot camp, 13 weeks              | Officer Candidates School | 28 / 28                              | 28                | 30     |
| Air Force    | basic military training, 8 weeks | Officer Training School   | 42 / **35**                          | 33                | 30     |
| Coast Guard  | boot camp, 8 weeks               | Officer Candidate School  | 31 / 31                              | 31                | **40** |

The game's ceiling on enlistment stays at 35, which Payton set in 0901; the real Army, Navy and Air Force take people
older. The age and aptitude limits are the door, one standard per branch, and a refusal says which one in words. All
five pay from the same two tables, so pay does not depend on the branch.

### Twenty-five specialties

Four or five a branch (`SPECIALTIES`): Army Infantry, Combat Medic, Vehicle Mechanic, Signal Support, Military Police;
Navy Boatswain's Mate, Hospital Corpsman, Machinist's Mate, Information Systems Technician, Aviation Mechanic; Marine
Rifleman, Combat Engineer, Motor Transport, Radio Operator, Aviation Ordnance; Air Force Logistics Readiness, Aircraft
Maintenance, Security Forces, Cyber Systems, Aerospace Medical Service; Coast Guard Boatswain's Mate, Machinery
Technician, Maritime Enforcement, Health Services Technician, Aviation Survival Technician. Each asks for Smarts,
Health or Discipline of its own (35 to 60 Smarts, or 50 Discipline for the police and security jobs, and the Coast
Guard's aviation survival technician asks Health 70 and Discipline 55), and **the first job of each branch asks for nothing**, so anybody who
passes the door has a choice. Each carries a `danger` (1–3) and a `skill` tag; **nothing reads either yet** (0903 reads
danger, 0904 skill). A specialty sets the yearly line's flavor and nothing else this ticket: pay, promotion and risk
are the same in every job.

### Getting in, in steps

A recruiter's offer is now a question asked in steps, each with a way to say no:

1. **Which branch?** Only the branches whose door the person fits through are listed, and the recruiter's own words
   come first.
2. **Which ladder?** Asked only of a graduate who passes the officer bar (a degree, and the commission age for the
   branch they chose): enlist, or apply for a commission. Somebody without a degree goes straight on.
3. **Which job?** Only the jobs the person has the aptitude for.

Every step's choices are stored on the offer when it is raised (a screen that was open for a year still shows the same
list), a step the list does not contain is refused, and the ordinary-life harness declines at any step, which is what
`ordinaryChoice` already does. `applyToEnlist(state, branch, specialty, track)` is the application route: the same
standards, no roll, one visit a year, and **no visit while any field has a question standing** (a contract, a part, a
record deal, a modeling job, or the service's own).

### Officers

- **Two ways in.** A graduate may apply for a commission at the recruiter's table, or an **enlisted member with a degree**
  may put in a package to a board (`applyForCommission`: one package a year, at least a year served, a degree, under the
  branch's commission age, healthy).
- **The board** picks at **30% for somebody performing at 60, a point of performance moving it a point, kept between 5%
  and 60%.** A pick starts officer training; a pass costs the year's package.
- **Officer training** is the first year, like basic. A direct candidate fails at **8% at a middling fit** (0.3 points a
  point of fit, between 2% and 25%) and goes home with half a year of O-1 pay and an entry-level discharge. **An enlisted
  member who fails goes back to the ranks exactly as they were** (the grade and term they had, a year older, a bad mood
  and no discharge on record). Somebody who finishes is a second lieutenant (an ensign in the sea services) and is
  paid, through the training year, as what they were.
- **The ladder** is O-1 to O-6 (second lieutenant to colonel, ensign to captain), the real 2026 DFAS table. **Promotion
  counts commissioned years; pay counts all years served**, so an officer who was a sergeant for six years is paid on
  all of it. O-1 to O-3 come on time (2, 4 years). O-4 needs ten commissioned years and then a chance a year (35% at
  60), O-5 sixteen years (28%), O-6 twenty-two years (**3%**), scaled by performance exactly as the enlisted chances are.
- **Up or out.** An officer still a captain (O-3) thirteen commissioned years in has been passed over for the last time
  and must leave (retiring, if twenty years are in). The shape of DOPMA's two looks, as one rule.

### Retirement, now a choice

- **From twenty years** the question at the end of every term becomes **Retire or Stay four more years**, and a member
  can retire by choice **at any time after twenty years** (`retireFromService`; not during training). Somebody whose
  performance is under the retention floor at twenty years or more is retired, not turned away.
- **At 65 the service ends for everybody**, with an honorable discharge and a line saying why.
- 0904 grows what retirement pays. 0902 pays nothing after it.

### One life at a time

A serving member's year no longer raises a sports contract, an acting part, a record deal or a modeling job
(`simulation/src/military-guard.ts`; finding 164 closed). The guard is a function from each field's year to the year it
should be, and a life that is not serving gets the same object back, so nothing replays differently.

## Measured

120 lives at twenty-two, each run through 6–7 careers on different hash draws in the **Army** (the others share the
engine and differ in names, doors and jobs; they were not measured separately), under the two policies a player can
take: retire at twenty years, or stay to 65. 780 careers per row.

| Road in, policy              | End                                                                                     | Reached (of those who did the road)         |
| ---------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------- |
| Enlisted, retire at 20       | 90.6% retired, 9.4% washed out of basic                                                 | E-7 69%, E-9 2.3%                           |
| Enlisted, stay to 65         | same                                                                                    | E-7 90%, **E-9 40%**                        |
| Direct officer, retire at 20 | 67% retired, **29% passed over**, 4% washed out of OCS                                  | O-4 67%, O-5 47%, O-6 0%                    |
| Direct officer, stay to 65   | same                                                                                    | O-4 67%, **O-5 67%**, O-6 26% (39% of O-5s) |
| From the ranks, retire at 20 | 83% of degree-holders who apply every year become officers; 3.3% wash back to the ranks | O-4 91%, O-5 66%, O-6 9%                    |
| From the ranks, stay to 65   | same                                                                                    | O-4 91%, O-5 82%, O-6 29%                   |

**Against DoD's DOPMA guidance** (70–90% to O-4, 60–80% of those to O-5, 40–60% of those to O-6): of direct officers who
finish training, 70% reach O-4 (67/96), 70% of those reach O-5 (47/67 by twenty years), and 39% of O-5s reach O-6 by 65. The first two are on target. **The "stay" rows are not the real force:** with no high-year-of-tenure rule (finding 174) every patient officer eventually reaches O-5, and four in ten enlisted members who stay to 65 are sergeants major.
I first had O-6 at 9% a year and 52% of all direct officers reached colonel; cutting it to 3% brought it to 26%.

## Findings (roadmap 169–179)

169. **The enlisted pay table is still checked against a third-party reading of DFAS, not DFAS** (0901 finding 160).
     The officer table, O-1 to O-6 across all fifteen steps, was read from DFAS's own page for 1 January 2026.
170. **Real enlistment limits are higher than the game's ceiling.** Army 42, Navy 41 and Air Force 42 in 2026 against
     the game's 35 (Payton's 0901 call). Dial: `ENLIST_MAX_AGE`.
171. **No officer-training attrition was found.** The 8% wash-out is a judgement; the one old figure (1949 Army OCS
     classes graduated about half) is not a modern number.
172. **O-1E, O-2E and O-3E are not built.** Real officers with more than four years of earlier enlisted service are paid
     more at those grades; the rates were not on the page read. A prior-enlisted officer is paid on the ordinary O-1 to
     O-3 rows with all of their years.
173. **No warrant officers and no generals or admirals.** The ladder tops out at O-6.
174. **There is no high-year-of-tenure limit.** An officer a board passed over for O-4 and who is not at O-3 can stay
     until 65, an O-5 is never forced out, and an enlisted member can reach E-9 by staying forty years. Real services
     force members out (about 28 and 30 years for O-5 and O-6). Payton's rule was a hard stop at 65, so the dials
     (`OFFICER_GRADES`, the enlisted table) were tuned for careers that end at twenty years.
175. **The retire question comes only at term ends.** `retireFromService` is open at any time after twenty years, but
     the question the engine asks is at the end of a term (every four years from the enlistment or commission). A
     screen should offer the button (0906).
176. **All officers share the enlisted specialty list.** An Army officer is "Infantry" or "Combat Medic", not a branch
     of the officer corps; that is the finest the tables get. Real officer jobs are separate and are not built.
177. **The board is generous to persistent applicants.** 83% of degree-holders who apply every year become officers
     (30% a year at a performance of 60). It is a judgement; no figure was found.
178. **`danger` and `skill` are labelled and unread** until 0903 and 0904.
179. **Save v60.** 0902 took it. Agent B's saves are v61 and onward; `CLAIMS.md`, `HANDOFF.md` and the brief say so.

## Files

- `content/src/military-pay.ts` (new): the two pay tables (enlisted from 0901 moved here; officer from DFAS),
  `monthlyBasePay`, `annualBasePay`, `washOutPay`, `officerWashOutPay`, the two top grades.
- `content/src/military-branches.ts` (new): the five branch rows, rank titles, the 25 specialties and the bar each asks.
- `content/src/military-officers.ts` (new): the officer grades and their promotion table, up-or-out, the board and
  wash-out chances, and the lines.
- `content/src/military.ts`: branch and pay code moved out; retirement is `RETIRE_ELIGIBLE_YEARS` and
  `MANDATORY_RETIRE_AGE`; per-branch age and Smarts limits; lines use placeholders (`%title%`, `%branch%`, …).
- `simulation/src/military-state.ts`, `military.ts`: five branches, two tracks, steps in the offer, officer training,
  officer promotion, up-or-out, the commission board, `retireFromService`, age 65.
- `simulation/src/military-guard.ts` (new) and `advance.ts`: the one-life-at-a-time guard.
- `persistence`: save v60, migration 59 to 60 (every service life becomes Army, enlisted, Infantry; an enlist offer
  becomes the branch step with only the Army on it), and a validator for the new fields.
- `finance/src/summary.ts`, `tools/content-validator/validate.mjs`: `TICKET = '0902'`.
- `simulation/src/military-0902.test.ts` (new, 90 tests), `persistence/src/military-0902.test.ts` (new, 8);
  `military-0901.test.ts` updated in both packages for five branches, the new offer shape, and retirement as a choice.
- `specs/CORE_RULES.md` 13.208–13.212.

## Tests and sabotage

**Tests.** 90 in the simulation: every table pinned against its source (officer pay against literal DFAS cells, the
branch limits, every rank title in all five branches, every specialty and the bar it asks), the door at each edge
(Marines 28/29, Coast Guard 31/32 and Smarts 39/40, commission 33/34), applying with each branch, job and ladder and every
refusal in its order, the offer in steps (frozen options, a decline at each step, a step the list never offered, the
`decide` route, the harness), the term question at nineteen and twenty years, officer training (pay, wash-out, a
prior-enlisted wash-out back to the ranks, a commission), promotion on commissioned years, up-or-out at each year edge,
age 65, `retireFromService` at each edge, the board at its limits and every refusal, the guard on all four fields
alone and through a full year of an actor and a model, and that no line leaves a placeholder in it for any branch,
ladder or grade a year can reach. Firing seeds were found by computing the hash first. A test that I wrote to check
`yearPayOf` for a trainee found a real bug: the pay a screen would show for an enlisted member in officer training
was the officer rate, while the year paid the enlisted one. It is fixed.

**Sabotage by hand.** 129 deliberate breaks, each run against the tests for its package (a separate copy of the tree,
one worker, per CORE_RULES 13.207): the door (age `>` to `>=`, no degree check, the health and Smarts edges, the
officer age limit read from the enlisted one), applying (the specialty bar, the branch of the job, the visit marker),
the offer's steps (no ladder question, the wrong bar for it, the turned-down window), retirement (`<` to `<=` at twenty
years, allowed in training, the 65 edge, the Retire label and prompt), the board (a fixed performance, no degree check,
the applied-age check, the term, the commissioning year, the grade and term kept for a wash-out), officer training
(a fixed fit, the wash-out pay, the return to the ranks in years, mood, grade and term, the stat deltas, the
trainee's pay), promotion (the commissioned offset, `>=` to `>`, the record threshold, a fixed performance), up-or-out at
each edge, the term question, all four fields of the guard and the `advance` flag, every officer table constant, the
board and wash-out dials, a cell in each officer row, the officer top grade, the branch limits, and the save (the
migration's defaults, order and version, and twenty validator conditions). **Four survived at first and got tests:** the
effort of a sergeant carrying into officer training, the rise into captain not being on the record, a fixed 60 standing
in for the year's performance in an officer's rise draw, and a re-enlistment counting from the day it was answered and
not from where the term ended. **128 of 129 are caught; one is equivalent and named:** the migration's `...row` spread
before or after its `track` and `specialty` defaults (a v59 service row has neither field, so the order cannot change a
migrated save).

**Sabotage by line.** The yearly lines, the prompts and the training and promotion lines are content; the tests pin that
no line leaves a `%` in it for any branch, ladder or grade, that a line is drawn from the right pool, and the places a
line carries a rank, a school or a number. They do not pin the wording itself, by design, so a changed word is not a
mutant they would catch.

## Open

Payton may want to move: the board's chance (177), whether to build a high-year-of-tenure rule against his 65 stop
(174), the real enlistment ceilings (170), and real officer jobs (176). Next is 0903 (deployments); it is not started.
Device checks do not apply: there are no screens.
