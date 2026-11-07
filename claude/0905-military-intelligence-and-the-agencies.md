# 0905 — Military intelligence and the agencies

**Status: DONE (engine, no minigame).** No screens: they are 0906's. **Save change: v62 → v63.** Agent B's saves must start at
**v64** (`CLAIMS.md`). Fifth ticket of v0.09 Military, stacked on 0904 (`0904-discharge-benefits-and-veterans.md`) on
`integrate/sports-on-main`.

Payton's answers (November 2026):

- **Clearance:** **three levels, no compartments** (Confidential, Secret, Top Secret).
- **Organizations:** **military intelligence, the FBI and the CIA.**
- **Entry:** **either door**: serve and come out with a clearance, or hold a degree and apply.
- **Missions:** **quiet yearly outcomes with real stakes**, built the same way as a deployment's incidents (a gate, a question
  answered with how it came out) so a minigame can sit on top later. Nothing is invented now. Failure can cost the clearance,
  the job or, rarely, a life, and **only after a mistake or a failure, never on a bare roll**.

## What changed in the engine

A life that never meets any of this replays exactly as it did: every draw is a hash of the seed, the generation and a name
(`intel:<seed>:<generation>:<parts>`, and `intelwork:…` for Work Harder), so no random stream is touched, and every new field,
row and line is absent for a life with no clearance, no agency and no service in an intelligence job (a test compares the
whole intelligence state before and after a year).

### The clearance

Three levels, one `Clearance` per life (`level`, `grantedAge`, `idleSince`). A higher level covers a lower job. What wants
which level is a judgement (`SKILL_CLEARANCE`): **intelligence work wants Top Secret, security and technical work Secret,
logistics Confidential**; nothing else wants one. Both the FBI and the CIA want Top Secret.

- **Getting one.** A military recruit's investigation runs at the end of the **training year** for a specialty that wants one
  (reciprocity: nothing is run if a clearance that covers it is already held). An agency applicant is investigated if hired
  without a covering clearance. Real processing times are in the lines: **243 days for Top Secret, 197 for Secret**, and a
  Confidential is the Secret investigation.
- **Being denied.** The chance is a function of the level, the person's Discipline, the worst discharge they have and whether a
  clearance was taken away before them (`denialChance`): base **3% / 6% / 10%**, plus **0.8 points per point of Discipline under
  50** (at most 30), **+15** for a general discharge, **+50** after a revocation, and **95%** for a dishonorable discharge,
  never under 1% or over 95%. A recruit denied for an **intelligence** specialty is reclassified to the branch's open
  specialty; one denied for another kind of work only has no clearance.
- **Keeping it.** The clearance is held while the work that needs it lasts and for **two years after** (the real reinstatement
  window is 24 months): `idleSince` starts the clock, a new job that needs it stops it, and a year past the grace it is gone
  with a line. A revocation sets `revokedAge` and every later investigation weighs it.

### The agencies

The FBI and the CIA are rows in `content/src/intel.ts` (`AGENCIES`); the CIA is the harder to enter, the FBI the better paid.
Intelligence is **not** in the shared careers catalog: it has its own engine, state and guards, so no other life's listings or
draws move.

|                                                  | FBI                            | CIA                    |
| ------------------------------------------------ | ------------------------------ | ---------------------- |
| Age at the door                                  | 23 to 36 (real)                | 21 to 45               |
| Degree                                           | bachelor's (real)              | bachelor's (real)      |
| Experience                                       | 2 years, service counts (real) | none                   |
| Training                                         | 19 weeks at Quantico (real)    | 40 weeks at "the Farm" |
| Starting grade                                   | GS-10                          | GS-9                   |
| Lifted for a clearance and 3+ intelligence years | +1                             | +2                     |
| Availability pay                                 | 25% on top of base (real)      | none                   |
| Compulsory retirement                            | 57 (real)                      | 65 (the military's)    |

- **The door.** Open to an adult with a degree, the age, the experience, a health of 50 or more, who is not in school, not in
  uniform, not already in an agency, and not held by another full-time career. One application a year. The hire is a draw
  against `hireChance`: the agency's base (30% FBI, 20% CIA) plus **one point per point of fit** over 55 (a weighting of Smarts,
  Discipline and Health, different for each agency), plus **2/6/12 points for a Confidential/Secret/Top Secret clearance
  held**, plus **2 points per year of intelligence service** (at most five), between 3% and 85%. A hire without a covering
  clearance is investigated; denial rejects the hire and is remembered. A hire resigns any civilian job held.
- **The academy.** The first year is training: it has a wash-out chance (`academyWashOutChance`, 3% to 30%, about 9% for a
  typical recruit), with the clearance kept and half a year's pay; a recruit who finishes gains Discipline, Health and Smarts.
- **The ladder.** General Schedule grades **9 to 15**, each with a title. A rise needs a number of years in the grade below
  and a draw against a table scaled by how the year went (a 60 is the table's own number, the same scale the officer ladder
  uses): 10 and 11 at 85%, 12 at 80%, 13 at 50% after two years, **14 at 2.5% after four, 15 at 2% after five**.
- **Pay.** Real: the **2026 General Schedule for Washington, step 1** (GS-9 $70,623 … GS-15 $169,279), about 3% a step over nine
  steps (one step a year served), base pay held to the **$197,200** cap, and the FBI's 25% availability pay on top.
- **Being let go.** Two years running with performance under **45** ends the career (`AGENCY_RETAIN_FLOOR`; see measured).
  A career also ends at the compulsory age, by resignation, by a lost clearance after a mission or by a death.
- **Retired pay.** A federal law-enforcement style pension: **1.7% of the average of the last three years' pay for each of the
  first twenty years, 1% for each after**, from fifty with twenty years in, paid for life from the year after the career ended.
  It posts as `assetIncome` ("Federal retired pay"), untaxed here as the military pension is, and counts as the household's
  income for living costs.
- **Work Harder** hands over to an agency version of itself, with the same two presses a year, and an agent is not offered a
  contract, part, deal or recruiter's offer.
- **The year.** An agency career holds the whole year as a service life does; its pay and the tax on it post as "FBI pay" and
  "Tax on FBI pay" (or the CIA's), its title is the occupation, its mood is added to the year's, and its lines go in the feed.

### Missions

Built the way 0903's deployments are, and no more. A **gate** (`intel.missionsOpen`) is off in every life and nothing sets it.
When it is open, a member who is eligible (an agent of grade 10 or more who was serving at the year's start; a military
intelligence member with a Top Secret clearance and a year of service, not away on a deployment) is given a mission with a
yearly chance (military 25%, FBI 30%, CIA 35%). The mission is a **decision** (`intel.mission`) the game waits on, answered
with how it came out: **clean, close, mistake or disaster**. A minigame will call `openMissions` and pass its result to
`decide`.

| Outcome  | Standing | Performance | Mood | Stress | Clearance lost | Death                       |
| -------- | -------- | ----------- | ---- | ------ | -------------- | --------------------------- |
| Clean    | +4       | +3          | +2   | 0      | never          | never                       |
| Close    | +1       | 0           | 0    | +4     | never          | never                       |
| Mistake  | −8       | −8          | −3   | +8     | 25%            | never                       |
| Disaster | −18      | −15         | −7   | +16    | 70%            | military 3%, FBI 5%, CIA 8% |

**Harm only follows failure.** A clean or close mission cannot cost a clearance or a life, whatever the draw (a test runs 400
seeds a source for each). A lost clearance **separates an agent** (the career ends, `clearance-lost`) and **moves a
service member to the branch's open specialty**; a death ends the life with a cause named for the source and the career
recorded as `killed`. Each mission is kept (`missions`) for a screen later.

## Measured

**Investigations** (4,000 each, Top Secret, a random Discipline): a typical life (40–85) is **granted 87.6%**, a weak one
(10–85) **82.3%**.

**Hire odds** (the draw's chance, `hireChance`):

| Person                 | FBI, degree door | CIA, degree door | FBI, service door (TS, 4 years) | CIA, service door |
| ---------------------- | ---------------- | ---------------- | ------------------------------- | ----------------- |
| Weak (50 / 50 / 60)    | 0.28             | 0.17             | 0.48                            | 0.37              |
| Typical (60 / 60 / 70) | 0.38             | 0.27             | 0.58                            | 0.47              |
| Strong (80 / 80 / 85)  | 0.56             | 0.46             | 0.76                            | 0.66              |
| Top (95 / 95 / 95)     | 0.70             | 0.60             | 0.85                            | 0.80              |

Starting grade: FBI GS-10, CIA GS-9; with a clearance and three or more intelligence years, FBI GS-11 and CIA GS-11.

**Careers** (600 lives each, a hire at 27 and played to the end; the draws from the hash):

|             | Washed out | Let go | Reached the end | Mean GS at 5 / 10 / 20 years | Final grade 13 / 14 / 15 | Mean pay at 10 years |
| ----------- | ---------- | ------ | --------------- | ---------------------------- | ------------------------ | -------------------- |
| FBI typical | 4.7%       | 0.0%   | 95.3%           | 12.0 / 12.9 / 13.2           | 68% / 29% / 3%           | $190,692             |
| FBI weak    | 9.3%       | 4.7%   | 86.0%           | 12.0 / 12.8 / 13.1           | 73% / 25% / 3%           | $188,360             |
| CIA typical | 6.7%       | 0.0%   | 93.3%           | 11.4 / 12.7 / 13.1           | 57% / 37% / 6%           | $147,561             |
| CIA weak    | 11.7%      | 2.5%   | 85.8%           | 11.3 / 12.7 / 13.1           | 62% / 32% / 6%           | $146,223             |

(The final-grade shares are of the lives that reached the end of the career.) **An agent's performance after years ranges only 42–54.**
That decided three dials (finding 209): the retention floor sits at 45 (a typical agent is never let go, a weak one is
in about one life in twenty-one), the rises to GS-14 and GS-15 are rare, and the academy is gentle.

**Missions** (answered 3,000 times per cell): a mistake costs the clearance in 24.5–25.1% of cases and kills in none; a disaster
costs the clearance (and the job, for an agent) of a life that goes on in **64.9–66.8%** of cases and kills **2.9% (military),
5.3% (FBI) and 8.7% (CIA)**; a clean or a close mission harmed nobody in any source.

## Findings (roadmap 208–220)

208. **The dials are judgements.** No source was found for how often a clearance is denied, for the agencies' hire shares, the
     rises in the GS ladder, the academy's attrition or any mission's odds. What is real and pinned: the investigation times,
     the 24-month window, the FBI's age window, degree, experience, training weeks, availability pay and retirement age, the
     2026 General Schedule and its cap, and the pension's two rates. Dials: `DENIAL_*`, `HIRE_*`, `AGENCY_RISES`,
     `academyWashOutChance`, `MISSION_CHANCE`, `CLEARANCE_LOSS_*`, `INTEL_DEATH_ON_DISASTER`.
209. **A performance after years ranges 42–54, so three first dials were dead or wrong.** The first retain floor (40) was
     never reached (0 let go in 1,200 careers), the first rises to GS-14 and GS-15 sent 83% of careers to the top two
     grades, and the first academy wash-out was too hard. They were moved to 45, to 2.5% and 2%, and to a floor of 3%
     and a ceiling of 30% with about 9% for a typical recruit, and re-measured. Same lesson as finding 197.
210. **Hire odds are far above real selectivity.** A typical FBI applicant here is hired 38% of the time (58% from the
     service); the real figure is a small fraction. It is the game's choice that the door is a door, not a lottery.
211. **No compartments, and no other agencies.** No NSA, DIA, DEA, ATF, Secret Service or Marshals (Payton's list).
212. **A recruit cannot change specialty after enlisting.** One reclassified for a denial moves to the branch's open specialty
     and has no road back to intelligence.
213. **A clearance denial for a non-intelligence job costs nothing but the clearance.** The member keeps the job.
214. **The agencies' money is simplified.** Availability pay is a flat 25% on a capped base; the pension averages the last three
     years of gross pay, availability included (the real one reads base pay); nothing for a locality, bonus or federal
     retirement system's other parts.
215. **The Career screen can still hire a civilian job for somebody in an agency** (and for a serving member). The same
     unfixed gap as finding 87: `applyFor` isn't blocked.
216. **The living phase tells the wrong story about an agent's year, and a service member's.** It writes "No work all year.
     $10,280 went out and nothing came in" (or a sibling line) for anybody with no civilian job, because it reads only the
     civilian job. It is pre-existing since 0901, shows up for a service member and for an agent alongside the real pay, and
     is worse for an agent. Not changed here: the fix touches the feed of every life with a non-job income (service, sports,
     acting, music, modeling) and wants a decision.
217. **No minigame exists, and nothing sets the gate.** No mission is ever raised in play. The four buttons are scaffolding
     (the same as finding 183).
218. **A mission can end an agent's career but only move a service member.** A lost clearance separates an agent; a member of
     the service stays in the branch under its open specialty.
219. **Finding 165 is still open.** Events gated on "has a job" read an agent as unemployed, as they do a service member.
220. **0905 took save v63.** Agent B's saves are v64 and onward.

## Files

- `content/src/intel.ts` (new): the levels, labels and grace; the investigation times; `SKILL_CLEARANCE`; the denial dials and
  `denialChance`; the agencies and their rows; the hire dials, `hireChance`, `agencyFit`, `startingGrade`,
  `academyWashOutChance`; the General Schedule, `agencyYearPay`, `AGENCY_RISES`, `AGENCY_RETAIN_FLOOR`, the pension and
  `agencyPensionFor`; the mission tables; and the line pools.
- `content/src/military-branches.ts`: the `intelligence` skill and five intelligence specialties, one a branch (30 in all);
  `military-officers.ts`: the officer line for it.
- `simulation/src/intel-state.ts`, `intel-clearance.ts`, `intel-work.ts` (new leaves): the state, the investigation, the
  clearance's holding and keeping, and Work Harder at an agency.
- `simulation/src/intel.ts` (new): applying, the bar, leaving, the year (investigation, academy, ladder, pay, ending,
  clearance upkeep, a mission raised), and answering a mission.
- `simulation/src/military.ts`: the investigation at the end of a training year and the reclassification; `advance.ts`: the
  intelligence year (pay and its tax, retired pay, the household's income, mood, occupation, records, lines, the held year),
  `decide.ts`: the mission's route; `game-state.ts`, `careers.ts`, `offers.ts`, `index.ts`.
- `persistence`: save v63, migration 62 to 63 (an empty intelligence state), a validator for every field, and the pairing the
  engine can write.
- `finance/src/summary.ts`, `tools/content-validator/validate.mjs`: `TICKET = '0905'`.
- `simulation/src/intel-0905.test.ts` (new, 138 tests), `persistence/src/intel-0905.test.ts` (new, 11);
  `military-0902.test.ts` (30 specialties), `persistence.test.ts` and `military-0904.test.ts` (the version).
- `specs/CORE_RULES.md` 13.223–13.225.

## Tests and sabotage

**Tests.** 138 in the simulation and 11 in persistence: the real figures pinned (the three levels, the investigation times, the
24-month window, the General Schedule table and cap, availability pay, the FBI's age, degree, experience and training weeks, the
pension at twenty and past it, under fifty and by resignation), the denial dials at each edge, the investigation (the same
answer however often it is asked, Discipline, discharges, a revocation, a training year, reciprocity, a reclassification), the
grace (held, idle, lapsed, reinstated), the door (each bar at its edge, one application a year, the clearance, the resignation of a
job held, the door a person came through), the academy, the ladder (years in grade at the edge, scaled by performance for the
strong and the weak, the top), letting go, retiring and resigning at the edges, Work Harder, the gate, a mission raised (each
source's chance, each bar, a deployment that ended this year), a mission answered (each outcome's effects, harm only after
failure across 400 seeds a source, each source's death chance, an agent separated and a member moved), and the year (ledger
rows, tax, the household's living, mood, the occupation, offers kept away across whole years, a life with none of it unchanged).
The save tests refuse every value the engine cannot write.

**Sabotage by hand.** 146 deliberate breaks, each run against the tests for its package. **Nineteen survived at first and got
tests:** the middle of the hire's fit, a negative count of service years, the same-level clearance being kept, Discipline in an
investigation, the busy bar (the first test accepted either answer), the door for a clearance without service, the years in
grade at their edge, the rise scaled by performance, the retirement's two edges, the grade and the years a mission opens at,
a deployment that ended this year, each source's own death chance, an agent's held year, the household's income, the year's
mood, the deals' income base and a standing mission as a systemic question. **Two specs had the wrong text** (a duplicate and a
line that prettier had joined) and were fixed. A second pass of the nineteen and the three academy constants after the
recalibration **killed every one**; no survivor is left and none was equivalent.

## Open

Payton may want to move: the denial, hire and rise dials (208–210), the agencies' pay simplifications (214), and the
no-road-back for a reclassified recruit (212). **Finding 216 wants a decision**: the living phase's feed line for anybody whose
income isn't a civilian job. Next is 0906, the military screens, and a later ticket for the minigame that opens the gates
(deployments and missions); it is not started. Politics and Crime get their own breakdown after Military. Device checks do not
apply: there are no screens.
