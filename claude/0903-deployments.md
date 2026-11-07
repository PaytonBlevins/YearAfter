# 0903 — Deployments

**Status: DONE (engine).** No screens: they are 0906's. **No minigame:** nothing in the game plays one yet, so no life
deploys until something opens the gate (finding 182). **Save change: v60 → v61.** Agent B's saves must start at **v62**
(`CLAIMS.md`). Third ticket of v0.09 Military, stacked on 0902 (`0902-branches-specialties-and-officers.md`) on
`integrate/sports-on-main`. It reads the `danger` tag 0902 left unread (finding 178 closed for `danger`; `skill` is still 0904's).

Payton's answers (November 2026):

- **Orders:** orders come, and refusing them costs something.
- **Tempo:** a steady level that varies by branch and job. No wars on a calendar.
- **Danger:** higher than the real rate, but **a player must not simply go and die.** "The deployments will be mini
  games, so the player must 'fail' or make a mistake in the game to suffer an injury or death."
- **What lasts:** a real injury leaves a lasting condition; mental strain after combat; awards and decorations. (A strain on
  the partner or the children was offered and not chosen.)
- **The minigame:** "Engine only, no stand-in." A deployment waits for a minigame's result and nothing invents one.

## What changed in the engine

A life that never deploys replays exactly as it did: every draw is a hash of the seed, the generation and a name
(`service:<seed>:<generation>:deploy:…`), so no random stream is touched, and a life with the gate closed is the same
object it was (a test compares a gate-open life that is sent nowhere with a gate-closed one, field for field).

### The gate

`military.deploymentsOpen` is a saved flag and **no code sets it.** `openDeployments(state)` and `closeDeployments(state)`
(`simulation/src/military-deployments.ts`) are what a minigame, or a host that has one, calls. With it off, no orders are
ever raised, and the ordinary-life harness (which always takes the first answer) never meets a deployment. That is how
"engine only, no stand-in" is kept: the machinery exists, is tested through the helper, and is unreachable in play.

### Orders

For a serving member (not in training, not already deployed, at least a year in) of an open life, the year can bring
orders. The yearly chance is the branch's tempo times the job's danger tag (`DEPLOY_TEMPO`, `DANGER_TEMPO` in
`content/src/military-deployments.ts`):

| Branch       | Yearly chance (danger 2) | Usual months |
| ------------ | ------------------------ | ------------ |
| Army         | 20%                      | 9            |
| Marine Corps | 20%                      | 7            |
| Navy         | 17%                      | 6            |
| Air Force    | 11%                      | 4            |
| Coast Guard  | 5%                       | 4            |

A danger-1 job is sent 0.8 times as often and a danger-3 job 1.2 times. The length is the branch's months, a month
shorter on a low draw and a month longer on a high one. The place is a made-up theater, and how near the fighting it is
comes from the job: a danger-1 job goes to the rear 70% of the time and never to the front, a danger-3 job to the front 40%.

| Tier    | Incidents | Hostile fire pay |
| ------- | --------- | ---------------- |
| rear    | 1         | none             |
| forward | 2         | $225 a month     |
| front   | 3         | $225 a month     |

The orders are a question with two answers, **Go** and **Refuse the orders**. Going makes a deployment that is `ordered`;
the next year is the deployment. **Refusing costs:** reputation −15, performance −10, happiness −3, no promotion in the
year after, and the member is **not asked to stay when the term ends** (at twenty years or more that is a retirement).
A record line says it. A member cannot retire or apply for a commission while a deployment stands.

### The year away

The deployment's year pays the member's base pay as usual, plus **hostile fire pay of $225 a month** (real) at the forward and
front tiers, and **a combat zone tax exclusion**: an enlisted member's base pay for the months away and the hostile pay are
not taxed; an officer's exclusion is capped at the highest enlisted monthly pay (`OFFICER_EXCLUSION_CAP`, E-9 at twenty-six
years in the game's table, standing in for the Sergeant Major of the Army's, which the table does not have). The year's
tax is on the pay minus that, and `advance.ts` posts the ledger under the branch's own name (a fix to 0901 and 0902, which
labelled every branch "Army pay"; finding 192). The term question is **not asked while the member is away**; it comes the
year they are home, so a term can run longer than its four years by the length of a deployment.

### The incidents

The year raises the first incident as a pending decision, `military.mission`, titled "(1 of 3)" and so on. Its choices
are the four ways it came out: **clean, close, mistake, disaster**, under generic labels ("It went clean", "It was a close
call", "You made a mistake", "It went badly wrong") until a minigame replaces the buttons and calls `decide` with the result
it played. Each answer applies its effects and raises the next incident or ends the deployment.

| Outcome  | Reputation | Happiness | Stress | Hurt?                       | Dies?     | Trauma (before tier scale) |
| -------- | ---------- | --------- | ------ | --------------------------- | --------- | -------------------------- |
| clean    | +2         | +1        | 0      | **never**                   | **never** | 0                          |
| close    | +1         | −1        | 6      | **never**                   | **never** | 2%                         |
| mistake  | −3         | −3        | 10     | **25%**, a minor wound      | **never** | 8%                         |
| disaster | −6         | −8        | 20     | **always**, a serious wound | **25%**   | 35%                        |

**This is the rule Payton set: harm only follows failure.** There is no draw that hurts a member whose incident came out
clean or close, and none that kills one whose came out a mistake or better; a test runs four hundred lives through each
and checks. Trauma is scaled by how near the fighting the place is (rear 0.5, forward 1, front 1.5).

A **wound** takes health (14 for a minor one, 30 for a serious one) as a deficit the health layer pays back over time, holds
the health stat to the ceiling of any lasting condition, and **may leave one:** minor wounds 30% of the time, from
shrapnel that never came out, hearing loss, a bad knee or a bad back; serious wounds 75%, from a blast injury, a lost limb,
a brain injury, burns or a serious back injury. A lost limb is untreatable and never clears. Six conditions are new in
`health/src/conditions.ts` and tagged `from: 'service'`, so the injury and illness pools the health year draws from are
unchanged and a life that never deploys is not touched. **Post-traumatic stress** is one serious condition (ceiling 68,
treatable, can clear on its own) that any incident but a clean one can leave.

**Death** ends the life in service: `player.alive` is false, the cause is "Killed in action" or "Killed in an accident on
deployment" (a death at the rear), the career becomes a past service with the ending `killed` and an honorable discharge,
the deployment is kept as a past one (wounded), and the member is honored: the Purple Heart for a death forward or at the
front, a Bronze Star a quarter of the time, the Medal of Honor 2% of the time.

### What a completed deployment earns

When the last incident is in, the deployment is written down (`PastDeployment`: the age, theater, months, tier, the worst
incident and whether anyone was hurt), a record line says "Deployed — <theater>", and decorations are awarded by rule and
chance (`DECORATION_CHANCE`):

| Decoration               | Rule                                 | Chance |
| ------------------------ | ------------------------------------ | ------ |
| Deployment Service Medal | a deployment forward or at the front | 100%   |
| Purple Heart             | wounded                              | 100%   |
| Commendation Medal       | no mistake and no disaster           | 40%    |
| Combat Action Badge      | at the front, and not all clean      | 60%    |
| Bronze Star              | at the front, the worst a close one  | 20%    |
| Medal of Honor           | (only posthumous, above)             | 2%     |

They are kept for life in `military.decorations`. Nothing reads them yet (0906 shows them).

## Measured

**Orders frequency** (3,000 lives a branch, each a career of nineteen years on the branch's own jobs in turn, each a
different seed):

| Branch       | Deployed at least once in the first term (4 years) | Mean deployments in 19 years | Mean for those who deployed in 8 years | Mean months | Rear / forward / front |
| ------------ | -------------------------------------------------- | ---------------------------- | -------------------------------------- | ----------- | ---------------------- |
| Army         | 57%                                                | 3.65                         | 1.91                                   | 9.0         | 39 / 45 / 16           |
| Navy         | 50%                                                | 3.13                         | 1.75                                   | 6.0         | 37 / 51 / 12           |
| Marine Corps | 59%                                                | 3.81                         | 1.96                                   | 7.0         | 33 / 45 / 22           |
| Air Force    | 32%                                                | 1.72                         | 1.35                                   | 4.0         | 61 / 36 / 3            |
| Coast Guard  | 18%                                                | 0.91                         | 1.19                                   | 4.0         | 38 / 45 / 18           |

RAND (2009) found the average deployed member of the post-9/11 force deployed about twice, which the Army, Navy and
Marines match over eight years. The branch shares are named judgements (finding 180).

**Harm under a reference player** (12,000 deployments across all three danger tags, an Army career; a player whose
incidents come out 88% clean, 9% close, 2.5% a mistake and 0.5% a disaster, which is `REFERENCE_OUTCOMES`, a stand-in
for "makes occasional mistakes" and not a measurement of anybody):

| Per deployment | Wounded | Killed | Lasting physical condition | Post-traumatic stress |
| -------------- | ------- | ------ | -------------------------- | --------------------- |
| All            | 2.07%   | 0.22%  | 1.02%                      | 1.12%                 |
| Rear (36%)     | 0.97%   | 0.02%  |                            |                       |
| Forward (46%)  | 2.19%   | 0.27%  |                            |                       |
| Front (18%)    | 3.95%   | 0.46%  |                            |                       |

**Against the real rate:** 52,340 wounded in action and 6,836 dead in Iraq and Afghanistan from 2001 to 2014 (NDU Press,
"Annex A", as of June 2015), over about 5.4 million deployments (a widely cited count of 2.77 million members; **the
denominator was not re-fetched this session**), is about 1.0% wounded and 0.13% killed per deployment. The reference
player is wounded about **twice** as often and killed about **1.7 times** as often. That is Payton's "higher than real". The
real counts are combat wounds and war deaths; the game's also include an accident at the rear. Decorations: 78% of
deployments earn at least one (the service medal on 64%, a commendation on 37%, the Purple Heart on 2%, the Combat Action
Badge on 3.5%, the Bronze Star on 0.9%); the Medal of Honor is posthumous only and did not appear in 12,000.

## Findings (roadmap 180–195)

180. **The tempo dials are judgements.** Orders chance and tier shares are tuned against RAND's "about two"; no figure by
     branch and job was found. Months are from Pew (2011) for the Army, Navy, Marines and Air Force where it gave them;
     the Coast Guard's is a guess. Dials: `DEPLOY_TEMPO`, `DANGER_TEMPO`, `TIER_ODDS`. There is no calendar of wars.
181. **The danger rates are Payton's "higher than real" by a stand-in player.** The reference outcomes are an assumption.
     The real measure is the minigame's, and `INJURY_ON_MISTAKE` and `DEATH_ON_DISASTER` (both 25%) move with whatever it turns out to do.
182. **No minigame exists, and nothing sets the gate.** No life in the game deploys. A minigame ticket must call
     `openDeployments` and turn its result into one of the four outcomes passed to `decide` (`military.mission`).
183. **The four incident buttons are generic** ("It went clean" and the rest) so the engine can be driven and tested. They are
     scaffolding, to be replaced and not to ship.
184. **Refusing orders is a game option; in the real services it is a crime.** The cost is a judgement (−15 reputation,
     −10 performance, a year with no promotion, not asked to stay). Discharge types for it are 0904.
185. **The combat zone exclusion applies to every deployment, rear included**, because the game has no map of designated zones;
     the officer cap (E-9 at 26 years) stands in for the Sergeant Major of the Army's rate, and `OFFICER_EXCLUSION_CAP` reads
     the game's own table.
186. **No other allowances or special pays are built.** Hostile fire pay ($225 a month) is the only one; no separation or
     hardship pay, no bonus.
187. **No strain on a partner or children** (not chosen). The world does carry on while a member is away (spec 1795):
     the year runs, other people's events still come, and the family is not touched.
188. **A seriously wounded member keeps serving.** There is no medical discharge until 0904.
189. **One condition stands for all combat stress** and the health stat is held to its ceiling at once (68), a heavy cost
     for a close call that left it.
190. **The honors on a death are judgements** (a posthumous Bronze Star 25%, the Medal of Honor 2%).
191. **Decorations and past deployments are kept and not shown or used.** 0906 shows them; 0904 may use them (a veteran's
     standing).
192. **Fixed 0901/0902 bug: every branch's pay and tax were posted as "Army pay".** The ledger now names the branch.
193. **A term question waits for the year a member is home,** so a term runs as long as its deployment. A member who is never
     asked is not a case: a deployment ends in the year it is served.
194. **`AWARD_CHANCE` was taken by acting;** this ticket's is `DECORATION_CHANCE` (CORE_RULES 13.216).
195. **0903 took save v61.** Agent B's saves are v62 and onward; `CLAIMS.md`, `HANDOFF.md` and the brief say so.

## Files

- `content/src/military-deployments.ts` (new): the tempo, tiers, hostile pay, theaters, the four outcomes and their
  dials, wounds, trauma, refusal, decorations and every line pool.
- `health/src/conditions.ts`: `from` takes `'service'`; six new conditions (shrapnel, blast injury, lost limb, brain
  injury, burns, post-traumatic stress).
- `simulation/src/military-state.ts`: `Deployment`, `PastDeployment`, `Decoration`, the `orders` offer, `noRiseAtAge`,
  `refusedTerm`, the `killed` ending, `deploymentsOpen`.
- `simulation/src/military-deployments.ts` (new): the gate, the orders, the year away, the incidents, the end and a death.
- `simulation/src/military.ts`: the hooks (the orders at a year's end, the deployment's year, no promotion after a refusal, the
  term question held while away, `deployed` errors for retiring and a commission, a career that ends dropping orders).
- `simulation/src/decide.ts`, `game-state.ts`, `advance.ts`, `index.ts`: the route for `military.mission`, `hasSystemicOffer`
  for an active deployment, the tax on pay minus the exclusion and the branch's ledger names, the export.
- `persistence`: save v61, migration 60 to 61 (the version only), and a validator for every new field.
- `finance/src/summary.ts`, `tools/content-validator/validate.mjs`: `TICKET = '0903'`.
- `simulation/src/military-0903.test.ts` (new, 113 tests), `persistence/src/military-0903.test.ts` (new, 11);
  `military-0902.test.ts` (the labels, `deployed`), `health.test.ts` (the reachability test exempts service conditions, which only a
  deployment can leave), `persistence.test.ts` and the 0902 save test (the version).
- `specs/CORE_RULES.md` 13.213–13.219.

## Tests and sabotage

**Tests.** 113 in the simulation and 11 in persistence: every table pinned (tempo ordering, the danger scaling and its
clamps, months and the two-month floor, the tier cuts, incidents by tier, hostile pay, the dials Payton's rule rests on, the
six decorations), the gate (no orders over 600 members of every branch with it closed, a fifteen-year life that never
deploys, a gate-open life sent nowhere replaying a gate-closed one, a civilian life unchanged), the orders (the draw on
each side of the chance, training and years, a deployment standing, the place and tier from their own draws, an unknown
job's middle danger), go and refuse (each cost, the floor at zero, no promotion the next year, the term ending in a
retirement at twenty years), the year away (hostile pay by tier, the exclusion for an enlisted member, a junior officer and
an O-6 against the cap, the ledger by branch, tax less than the same year at home, the term question held), every
incident outcome over hundreds of seeds (no harm after clean or close, a mistake hurting at the draw, never killing, a
disaster always wounding and killing at a quarter over a thousand lives), the lasting condition by list and its ceiling,
trauma by outcome and tier, the end of a deployment, every decoration rule, a death, and the guards while deployed.
Firing seeds were found by computing the hash first (`seedWith`). The save tests cover every field accepted exactly
and every field the engine could not have written refused.

**Sabotage by hand.** 164 deliberate breaks, each run against the tests for its package (a separate copy of the
tree, one worker, per CORE_RULES 13.207): the gate (ignored, the standing-deployment check, training, the minimum years, the
chance's edge, the danger default, the theater and tier and months draws), the orders' prompt and labels, the year away (hostile
pay for every tier, for twelve months, the officer cap's direction and absence, the exclusion without hostile pay or for twelve
months, the cap's source rate), going and refusing (each cost, the age and results the deployment starts with, the offer left
pending), every incident rule (the status check, the dedupe, the outcome check, mood, stress, reputation, a disaster's
wound size, a mistake always hurting, a close one hurting, the wrong draw key, the lasting draw forced on and off, the pick
index, the deficit, the stat, the ceiling, trauma forced on, off and from the wrong tier, the ceiling after trauma, its line,
the wounded flag, death after any outcome, death on every disaster, the wrong draw), the end (finishing early and late,
the entry kind, the reputation, the pending question, the next incident not raised), every award rule and its chance, the
past deployment and decoration lists, a death (the tier's wording, the Purple Heart at the rear, the posthumous chances, alive
kept, the cause, the age, the ending, the pending left, the service and deployment left on, the record), the hooks in the
year (no-promotion year, the refused term, the term question while away, the pay, the exclusion, the line, the
deployment, the orders raised in training and while deployed, the career that ends dropping orders, both guards, the
mission raised by `withMilitaryOffer`, its alive check, the orders' route, choices and prompt), `advance.ts` (the tax on
the whole pay, "Army pay" for every branch), `hasSystemicOffer` twice, a dozen dials, and the save (the migration's version,
the schema's, the new ending, and thirty validator conditions). **Seven survived at first and got tests:** the
training-stage check (hidden behind the years check, so it needed a member in officer training with five years), the
danger default for a job the table does not know, the theater and tier draws (each needed seeds at both ends), and in
the save the array checks on past deployments and decorations and the minimum of one incident. **All 164 are caught.**
No equivalent mutants were left.

## Open

Payton may want to move: the tempo and tier shares (180), the two 25% dials (181), the cost of refusing (184), and whether the
exclusion should be limited to forward and front (185). Next is 0904 (discharge, benefits and veterans); it is not started.
A minigame ticket (and the screens, 0906) is what turns the gate on. Device checks do not apply: there are no screens.
