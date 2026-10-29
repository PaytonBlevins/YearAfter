# v0.09 Military — measurement and proposed tickets

**Status (29 October 2026): 0901 is built; 0902–0906 are approved and not started.** Payton chose Military as the first part
of v0.09, stacked on `integrate/sports-on-main`, and approved the breakdown below with these changes: no Space Force (Army,
Navy, Marine Corps, Air Force and Coast Guard, four or five specialties each), enlistment from 17 to 35 by offer or
application with no draft, rare death and real injuries (in 0903), a four-year term then a choice, promotion by time and a
yearly performance read from Discipline, Smarts and Health (no Charisma) with the existing Work Harder feeding it, and
base pay on the real 2026 table with housing provided. See `0901-the-service-engine.md`. v0.09 as a whole (Military,
Intelligence, Politics, Crime) is too big for one plan, so this note covers Military and the military-intelligence door
only. Same shape as `v008-entertainment-measurement.md`: what the spec asks for,
what the build has today, real figures, and a ticket list with the decisions that needed Payton.

## What the spec asks for

Spec 1377–1385 (v0.09): military branches, ranks, pay, benefits, deployments and discharges; "later deployment minigame". The
fuller list at spec 1835–1840 adds specialties, promotions, awards, and **honorable, dishonorable and medical discharge
outcomes**. Spec 120 / 126 says to keep interactive deployment minigames. Intelligence is "earned advanced paths inside relevant
organizations, not a standalone detached career" (spec 1838–1840, 138), with mission minigames. The rules that bind every ticket:

- Realistic pay (spec 1835). Reputation is per career, never one global stat (spec 11). Rank and performance are shown only while relevant (spec 1107).
- Professional relationships stay in their own world (spec 1316): comrades and superiors belong to service, as teammates belong to sports.
- **The world continues while the player is deployed** (spec 1795) and the save keeps military service as structured history (spec 26).
- Career switching stays permissive (spec 405): a veteran can move to any civilian career, helped or not by what they did.
- Extreme success is intended and uncapped (spec 1372); balance exists to stop one repeatable mechanic printing money.
- The spec lists `packages/military` (line 1520). It does not exist yet; sports lives in `packages/simulation` and `packages/content`, so the package question is a decision below.

## What the build has today

Measured on 240 lives, always taking the ordinary answer (`ordinaryChoice`), played to 50. Run on the integrated tree
(`3a60da3`).

| What                                                                | Result                                                                                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Military jobs in the catalog                                        | **0 of 169.** The `safety` track has 8 jobs (dispatcher, guard, police officer, firefighter, detective, fire captain, police sergeant, fire chief); there is no service. |
| Lives with any `military` timeline entry                            | **0 of 240.** The timeline category and the eulogy weight (6) are declared and nothing writes them (CORE_RULES 13.36).                                                   |
| Lives that held any `safety` job                                    | **17 of 240 (7.1%).** None of them was a police officer, so the nearest door is barely used.                                                                             |
| Reached 19                                                          | 237 of 240.                                                                                                                                                              |
| Not in college at 19 (the people who might enlist)                  | **157 of 237 (66%).** This counts trade school, dropouts and school-leavers together, so it is the pool and not a rate.                                                  |
| Health under 50 at 19                                               | 37 of 237 (16%). A physical standard would turn away about one in six before anything else.                                                                              |
| Day jobs at 25 that are `public` or `safety` (top ten tracks at 25) | `public` 12 of 240. `safety` is not in the top ten.                                                                                                                      |
| Existing machinery a service could stand on                         | Sports state beside employment (0801), systemic offers (0402), reach and qualification gates (0401), `licenses`, pensions (0310), the estate and heirs, awards (0808).   |
| What does not exist                                                 | A state that holds a person away from ordinary life for years, a clearance, a pension earned by service, a discharge with an outcome, or veteran benefits.               |

What that means: nothing about service exists, so this is a build from the engine up, not a wiring job. The closest shape in the
game is the sports career (0801): its own state beside employment, a ladder, yearly performance, a pay ladder, an end of career,
and a day job that stops while it lasts. A service career fits that shape. The new parts are the ones no earlier ticket had: a
**term** with an obligation, **deployments** that remove the player's choices for a year, and a **discharge** whose type changes what
comes after.

## Real-world figures

Sources fetched on 29 October 2026. The pay table is a third-party reading of the DFAS 2026 chart and **has not been checked
against DFAS**. The attrition figures are from 1998 and are the only cohort numbers found. Where nothing was found it is said.

**The force** (DoD 2023 Demographics profile, active duty): about **1,273,000** active-duty members; **81.6% enlisted
(1,038,909) and 18.4% officers (234,473)**. Branch shares: Army 35.3%, Navy 25.8%, Marine Corps 13.6%, Air Force and Space Force
together 25.4%. Average age 27.4 for enlisted and 34.3 for officers. 17.7% are women. For enlisted, 77.9% have a high school
diploma, a GED or some college, and 8.5% a bachelor's degree; for officers, 45.3% hold a bachelor's degree. Not found: the
Space Force or Coast Guard counts, and median years of service.

**Pay, 2026** (3.8% raise from 1 January 2026, ustax.tools reading of the DFAS table). Basic pay a month: E-1 $2,407.20 (over four
months; $2,225.70 before that), E-3 $3,198.00 at four years, E-5 $3,946.80 at four years and $4,421.70 at twelve, E-7 $5,135.70 at
eight years and $6,245.70 at twenty, E-9 $8,105.10 at twenty. Officers: O-1 $4,150.20 under two years and $5,222.40 at four, O-3
$7,382.70 at four and $9,004.20 at twenty, O-5 $12,032.70 at twenty, O-7 $16,817.70 at twenty, and O-10 capped at $18,999.90.
A year is twelve of these: E-1 about $28,900, E-5 at four years about $47,400, E-7 at twenty about $74,900, O-1 about $49,800,
O-3 at four about $88,600. Pay is the same in every branch. It does not include housing and food allowances, special pays or
combat pay; none of those were sourced here.

**Retirement** (Blended Retirement System, for anyone who entered on or after 1 January 2018): a lifetime pension of **40% of base
pay at 20 years**, rising 2% a year after that, with no pension for fewer years; everyone gets a Thrift Savings Plan account with a
government match of up to 5% of base pay, kept if they leave; continuation pay at **12 years** in return for four more. The pension
multiplier is on the high-three average of base pay (not sourced on the page fetched; it is the published rule).

**Benefits after service** (Post-9/11 GI Bill): **100%** of the benefit after 36 months of active duty, tiered down to 90%, 80%,
70%, 60%, 50% and **40% at 90 days**, and **an honorable discharge is required**. It pays tuition and fees to the school (public
in-state in full, a national cap for private), a monthly housing allowance, and up to $1,000 a year for books. That connects
straight to 0405's college offer and the `credentials` the education package already holds.

**Leaving early** (GAO, FY1993 cohort tracked to FY1997, 202,908 enlistees): **35.8% did not finish their first term** (48
months), 13.6% of the cohort in the first six months. By service: Army 39.3%, Navy 35.8%, Air Force 32.5%, Marine Corps 31.5%. For men,
misconduct 33.4%, medical or physical problems 15.2%, performance 12.5% and drugs 9.3% of the later separations. This is 30 years
old and predates the current force; it is the anchor for "service is not a sure thing", not for a target. **Not found:** the share
of discharges by characterization (honorable, general, other than honorable, bad conduct, dishonorable), the share of the force
that deploys, and any casualty or injury rate. Those would be named judgements until a source is found.

## Proposed tickets

Built one at a time with a stop between each. Engine tickets come first and the screens follow in one ticket, which is what you
chose for v0.07 and v0.08. Intelligence comes after the service it grows out of, as the spec says.

| Ticket                                             | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0901 The service engine, with the Army**         | A `military` state beside employment: enlisting (a recruiter's offer or an application, a physical standard), basic training, an enlisted ladder E-1 to E-9 on the real 2026 pay table, an initial term, a yearly performance read, promotion, re-enlistment or leaving, and a day job that stops while serving (as sports does). One branch proves the engine. Pay, taxes and the ledger go through the existing money paths. Save change. |
| **0902 The other branches, specialties, officers** | Navy, Marine Corps, Air Force, Space Force and Coast Guard as data on the 0901 engine, each with its own specialties, and the officer road (a degree and a commission, an academy, or from the ranks). Specialties are chosen from a short list and shape pay, risk and what a veteran can do afterwards.                                                                                                                                   |
| **0903 Deployments**                               | A deployment as a year the player is away: orders (accept, or the chance to refuse that costs something), a posting, combat pay and allowances, awards, injury, and the world carrying on without the player (spec 1795). No minigame yet — spec says "later" — but the engine is shaped so one can sit on top.                                                                                                                             |
| **0904 Discharge, benefits and veterans**          | Every way out: honorable, general, other than honorable, bad conduct, dishonorable, medical. Retirement at 20 years under the Blended Retirement System, a TSP account, GI Bill tuition and housing through 0405, a civilian road in (veteran preference in `public` and `safety` jobs), and what each discharge type costs afterwards. Save change.                                                                                        |
| **0905 Military intelligence and the agencies**    | A clearance as earned standing, a military-intelligence specialty, and the FBI/CIA-type federal careers entered through service or through a degree, with missions as quiet yearly outcomes. Not a standalone secret-agent job (spec 138). Mission minigames stay later.                                                                                                                                                                    |
| **0906 Military screens**                          | One hub for service (Activities), a career screen with rank, term, posting and awards, the deployment and discharge cards, and a veteran's benefits. Engines unchanged. No save change.                                                                                                                                                                                                                                                     |

Law enforcement beyond the `safety` jobs, Politics and Crime (spec 1377–1385) are not in this list. They are the rest of v0.09 and
get their own measurement when Military is done.

Save versions: the build is at **v58** after the integration, so 0901 would take **v59** (Agent B's saves would have to start at v60;
Agent B would need telling).

## Decisions needed before 0901

1. **The shape** — the order and number of tickets above, and whether screens stay last (0906) as they did for sports.
2. **The road in** — who can enlist, at what age, how, and the officer route.
3. **How dangerous service is** — whether a character can die or be badly hurt in service, and how mental strain is shown.
4. **How many branches and how deep the specialties go** — six branches and a short specialty list, or fewer.

## What I would do without an answer

Own state like sports (not a catalog job), enlist from 17 to 35 by recruiter offer or application, no draft, one pay table for all
branches, deployment hazards as named judgements and not sourced, no minigames, no new talent (Discipline, Smarts, Health and
Charisma carry the odds), and the same "odds are Payton's" approach as 0801 once he gives them.
