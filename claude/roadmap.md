# YearAfter — roadmap from here

**Where we are:** v0.03 Financial Life and v0.04 Career & Education Depth are
complete; v0.05 tickets 0501–0507 are built, with 0508 Will & Estate deferred by
Payton. The 0601–0606 and 0701–0704 engines are on `origin/main` at
`0d23cc5`. The 0605/0606 screens and native-device checks remain open; v0.07
screens are unassigned, and 0705/0706 are not built. Save **v41**.
**Agent B's order:** existing notes, 0605 screens, 0606 screens, then new notes
from Payton. Agent A owns every other ticket end to end; Payton decides the
next ticket. See `claude/HANDOFF.md` §0 and §7.
**Source:** `specs/MASTER_SPEC.md` §1285–1404. Everything below is quoted or
derived from it; where the spec stops itemising tickets, that is marked.

---

## Done

|                           |                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sprint Zero** 0001–0009 | Repo, Expo app, core types, seeded RNG, save schema + migrations, SQLite, CI, specs, dev screen                                                                                                                  |
| **v0.01** 0101–0114       | Theme, header, five-world navigation, timeline, Advance, stat bars, world shells, UI kit, icons                                                                                                                  |
| **v0.02** 0201–0212       | Character generator, family, events, school, stress, friends, love, children, NPC parents, employment, college, aging and health, a full-catalog voice pass, and **death, mortal NPCs and dynasty continuation** |

Later completed milestones: **v0.03** (0301–0310) and **v0.04** (0401–0417).
**v0.05** has 0501–0507 shipped, with 0508 deferred; **v0.06** has the
0601–0606 engines shipped, with the 0605/0606 screens open. **v0.07** has
0701–0704 engines shipped, with screens unassigned and 0705/0706 still future
work. Their ticket tables below remain the detailed status record.

The following is the historical v0.02 verification snapshot: **644 tests across
31 files, 27/27 turbo tasks**, 374 events, 49 jobs across 11 ladders, 66
employers, 8 majors, 12 health conditions, 25 activities and 13 gigs; save v17.
It is not the current build's count or schema version.

Current repository status is summarized above and in the v0.05/v0.06 tables.
`claude/build-status.md` is a separate Claude Project document, absent from this
checkout. Payton confirmed that other referenced notes absent from the repo
also live in the Project and are not lost. Their contents and synchronization
have not been verified in this pass.
The reconciliation record is `claude/notes-reconciliation.md`. Ticket measurements
and test totals below describe their respective builds, not a new calibration.

---

## v0.02 is closed — what 0212 actually shipped

Full write-up in `claude/0212-death-and-continuation.md`. The short version,
because two thirds of it was not the death screen:

- **NPCs are mortal.** New `phases/kin.ts`, the only phase ever prepended.
  97% of characters lose a parent, 36% are widowed, 9% outlive a child. Before
  this, the median surviving parent of a 73-year-old was **105**.
- **`character.records` is written**, eleven tickets after it was declared for
  this exact screen. An active life produces 10–17.
- **The death screen** is spec 1284's seven fields and no eighth — no net
  worth, no score. Plus burial / cremation / donation to science.
- **Children live their own years**, so continuing as one promotes a life
  rather than inventing one.

Two new rules came out of it: **13.36** (a field nothing writes is not state —
`droppedOut`, `alive` and `records` are the same bug three times) and **13.37**
(a state object holding a live cursor is not a value).

---

## v0.03 Financial Life — 10 tickets — COMPLETE

The spec's own build sequence (§1282–1284) is **Shell → Life → Money → Careers**.
We did Careers first, and the cost of that is visible: 0210's cost-of-living
model is a labelled placeholder that 0303 deletes, and every price in the game
is a share-of-what-you-hold rather than a real number. This milestone pays that
back. Full detail — including the market destroying value permanently, the
$430,000 illiquidity subsidy, and the financial pages — is in
`claude/build-status.md`.

| Ticket                       | What it covers                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **0301 Financial Ledger**    | Backend transaction categories — salary, commission, tax, living expense, housing, vehicles, gifts, debt, asset income, investments        |
| **0302 Reconciliation**      | opening cash + in − out = closing cash. Any mismatch **fails validation**                                                                  |
| **0303 Living Expenses**     | Inferred from income, wealth, family, location, circumstances. No lifestyle selector. **Deletes `livingCostOf`**                           |
| **0304 Finance Dashboard**   | Balance, Income, Tax Rate, Monthly Outflow, Assets, Liabilities, Net Worth, Investments, Credit Cards                                      |
| **0305 Credit System**       | Simplified underwriting. Explicitly _not_ a credit-bureau simulation                                                                       |
| **0306 Credit Cards**        | Max 5 active, up to 8 products; limit, APR, balance, payment, rewards, application                                                         |
| **0307 Loan Engine**         | Personal, secured, business/SBA, line of credit, wealth/private. Mortgage and auto use simplified eligibility with an instant result       |
| **0308 Investments**         | Stocks, funds, bonds, crypto. Buy/sell/hold, annual movement. Purchases are **transfers, not outflow** — plus the 0308b/0308c/0308d rounds |
| **0309 Advisors**            | Buy/Hold/Sell/Reduce/Rebalance recommendations                                                                                             |
| **0310 Retirement Benefits** | Employer match, contributions, pensions — rolled into Investments/Assets                                                                   |

**Three debts 0303 inherits, all labelled in code:**

- `livingCostOf` — deleted rather than stacked on top of (CORE_RULES 13.8).
- **Treatment is free.** Pricing healthcare against a placeholder cost model
  would make it either free in practice or unreachable for exactly the poor
  characters it matters most to.
- **Inheritance is "the cash that was left"**, because there is no debt, no
  will and no trust in the build to net it against. 0212 did what it could
  honestly do and labelled the rest.

> _"v0.03 gets aggressive financial integrity testing."_

---

## v0.04 Career & Education Depth — COMPLETE (0401–0417)

The spec stops numbering here and describes the milestone as a block. Ticket
breakdown was proposed, then measured, in `claude/v004-career-measurement.md`.

> _"Expand to roughly 150–250 distinct job titles initially, without showing huge
> listing inventories. Build reusable salary/commission/trade/government/
> professional/management templates. Give performance careers such as Sales,
> Real Estate, Stockbroker/Financial roles broad earnings distributions. Display
> concise benefits. Add career opportunities and permissive plausible
> switching."_

- **0401 Reachability** — `reachOf`, the effective rung a job's gate reads
  instead of the raw held one. Jobs seen in one life 13 → 22–24 of 49.
  `claude/0401-reachability.md`.
- **0402 Career opportunities** — offers that arrive rather than being applied
  for, the first decision the game has ever asked an adult. `decide` gained a
  systemic-vs-authored branch. `claude/v004-career-measurement.md`.
- **0403 Catalog expansion** — 49 jobs across 11 tracks → **147 across 16**,
  five new fields (tech, finance, legal, medicine, hospitality). Two rules came
  out of the reachability guard catching real starvation as the catalog grew:
  13.61 (a rung competes with itself first) and 13.62 (coverage is a
  population question). `claude/0403-catalog-expansion.md`.
- **0405 College offer** — the education half of this milestone's name.
  College now arrives as a systemic decision, the same door 0402 built for a
  job, instead of requiring a player to find the College screen: certain the
  year a character leaves school, a standing 35% chance every eligible year
  after, answered through the exact same `applyToCollege` roll the screen
  always used. The reachability guard's credential-gated blind spot — 33 of
  147 jobs never shown to anybody, which 0210b first measured and 0403
  flagged — is now **0/147**. Also found and fixed two dormant bugs in OTHER
  tests that a much larger passing-through-college population finally
  exercised (CORE_RULES 13.63). `claude/0405-college-offer.md`.

- **0406 Programs and licenses** — the review after 0405: _"This seems pretty
  bare. I dont see medical school, dentist, vet school, law school, postgrad,
  anything like that."_ It was: 0403 grew the catalog to sixteen tracks and
  nobody came back to 0210b's eight majors, so five tracks — medicine, legal,
  tech, finance, hospitality — had **no program pointing at them at all**.
  Eight majors → **53 programs in three tiers** (14 trade certificates, 24
  bachelor's, 15 graduate and professional). Four new career tracks so the new
  schools lead somewhere: veterinary, dental, pharmacy, architecture. 147 jobs
  → **169**. And a **license**, orthogonal to the education ladder, which is
  both a wall nothing substitutes for (a fine-arts master's was a valid medical
  qualification for three tickets, because `meetsLevel` is an ordered compare
  and an ordered compare cannot refuse) and a ladder you are credited with
  having climbed (trade school buys the apprenticeship on a trades ladder that
  needs no qualification at all). Save v27 → v28. New rule 13.64.
  `claude/0406-programs-and-licenses.md`.

- **0407 A way in** — found by 0406's own baseline rather than by review: **a
  passive player never got a job, 0 of 250 lives.** `withAnyOffer` opened with
  `if (!held) return state` — 0402 built a POACHING offer, correctly refused to
  fire it for somebody with nothing to be poached from, and was the only
  systemic career door in the game. 11,419 idle adult years with six listings
  going in every one of them; 248 of 250 died with nothing; and of the 91
  decisions ever raised to an adult, every one was 0405's college offer. Now
  247/250 work, 4/250 die broke, and postgraduate reach goes 0 → 21 because the
  education ceiling was downstream of the employment floor all along. One door
  with two entry conditions (`fromJobId` optional), not a second offer. The
  chance reads education, so a dropout idles 4.4 years a life against a
  postgraduate's 0.6. Save v28 → v29. Also fixed three real listing defects
  0401's starvation guard caught — every character alive in a year saw the SAME
  six jobs, a license did not surface its own profession, and `prefers` was
  charged twice. New rule 13.65. `claude/0407-a-way-in.md`.

- **0408 A varied population** — school performance at sixteen had a floor of
  50 across 500 lives. The mechanism was not character generation: every stat
  delta runs through 0203's `curvedDelta`, full strength at 50 and tapering to
  nothing at 100, and school pushed a flat +1 Smarts at everybody for thirteen
  years, so the weakest students gained the most. Floor 26 and sd 17.4 now.
  New rule 13.66. `claude/0408-a-varied-population.md`.

- **0409 An adult life the catalog had heard of** — events able to fire at
  forty went from 26 of 374 to 93 of 444, and from zero authored decisions to
  thirteen. The gates had to be added first: `employed`, `jobTrackAny`,
  `hasCondition`, `bereavedWithin` and the rest, because an event cannot be
  about a job if eligibility cannot say "has one". New rule 13.67.
  `claude/0409-an-adult-life.md`.

- **0410 A private life** — 0409 left `family` and `friendship` named as the
  last thin adult categories. They were not thin. Measured across 90 lives and
  4,828 adult years, a passive player **never met anybody, never married and
  never had a child — zero, zero, zero** — because `romanticMove`, `tryForBaby`
  and `applyToAdopt` are only ever called by a button. All eleven `family`
  events that can fire at forty are 0208's parenting events gated on
  `hasChildren`, and not one had ever fired: dead content behind a door nobody
  had built, the same shape as 0405's credential-gated jobs and 0407's unclaimed
  listings. Now 86/90 partner, 78/90 marry, 56/90 have a child, and `family`
  events fire in 25.8% of adult years.

  The bigger find was not in this ticket's code. Every systemic door opened with
  `if (state.pending.length > 0) return state`, which 0402 recorded as free
  because _"an adult year contains zero authored decisions"_ — a sentence 0409
  made false from another package. Measured, **59.4% of adult years already held
  an authored decision**, so all three doors were shut in three years out of
  five. Fixing that is most of the ticket, and it un-throttles 0405 and 0407 as
  much as 0410. Save v29 → v30. New rules 13.68 and 13.69.
  `claude/0410-a-private-life.md`.

- **0411 An adult who develops** — roadmap finding 2, open since 0211. It was
  exact rather than approximate: Discipline ran p10 50 / median 65 / p90 83 and
  **sd 12.0 at eighteen, thirty and forty-five**, the same three numbers, because
  nothing wrote the stat after school. The stat adult events DO move was worse —
  Charisma sd collapsed 9.7 → 6.5 → **3.8**, because of the 91 events that can
  fire at forty the effects run Smarts +14/−0, Discipline +1/−0, Charisma +26/−0,
  Looks +0/−0. A one-way ratchet, so everybody climbed until the curve stopped
  them and it stopped everybody in the same place: at forty-five all seven
  commonest tracks produced charisma between 89 and 92. And **Looks was 52 at
  eighteen, 52 at thirty and 52 at forty-five** — a visible bar nothing had ever
  written.

  `TRACK_WANTS`, the table `hireChance` reads to decide what a kind of work is
  made of, is now also what a year of that work builds in you — and what it does
  not want, you get out of practice at. Discipline sd 12.0 → **14.5** by
  forty-five, Charisma 3.8 → 8.3, and a logistics lifer and a tech lifer are
  finally different people. Looks follows age, gated on health, in the health
  package where the age curve lives. New rules 13.70 and 13.71.
  `claude/0411-an-adult-who-develops.md`.

- **0412 A friend you actually have** — roadmap item 5b, and both of its findings
  were narrower than what was there. Finding 2b's _"trough at twenty"_ is a
  **sawtooth**: 84.4% of fourteen-year-olds, 88.9% of nineteen-year-olds and
  87.8% of twenty-year-olds had no friend at all, because a friendship here was a
  function of how long the current room had been open and the build empties the
  room at eleven, fourteen and eighteen. Fourteen and nineteen are the same hole,
  two rooms apart.

  And at the other end of the same mechanism, the half no finding had noticed:
  **warmth was the one number in this build that never went through a curve.**
  `remember` added raw and so did the year-in-the-same-room step, which runs at
  everybody in a room every year — and a job is a room that can stay open for
  thirty years. At forty-five, p10, median and p90 of a character's closest
  friend were **all 100**, with 90.9% pinned at exactly the cap; pooled, the
  distribution was bimodal at 34 and 100. This build had no decent-but-not-best
  adult friend. CORE_RULES 13.70 in a third system.

  `curvedWarmth` fixes the ceiling (0% at the cap now, p10/med/p90 84/95/96) and
  `keeping-up.ts` fixes the floor: once a year, unprompted, you keep up with the
  people a year of silence would cost — running the real `resolveInteraction`,
  reaching exactly the complement of the room, and worth less than a tap. No
  friend at 14/19/20 is now 31.1% / 51.1% / 60.0%. Also the four friend
  predicates the catalog has never had, which is what the content half needs.
  Five tests broke and none of them was this ticket's code. New rules 13.72
  and 13.73. `claude/0412-a-friend-you-actually-have.md`.

- **0413 The year after school** — the content half of 5b, and finding 2d was
  true while pointing at the wrong place. Six adult friendship events, all
  romance: correct. What nobody had measured is that **an ordinary eighteen-
  year-old had SEVEN reachable events and five of them were
  `adult.placeholder.*`**, against ninety-nine at seventeen. In play, 98.6% of
  everything that fired at eighteen was a placeholder, across six distinct ids in
  ninety lives. 0409 measured at forty, so the cliff was invisible to it.

  Forty-five events and eight decisions, weighted into the desert: reachable at
  18 goes 7 → 18, friendship at 40 goes 5 → 32, adult friendship decisions 0 → 7
  (every decision the game had ever raised to an adult was career, health or
  loss). Placeholder share at eighteen 98.6% → 17.5%.

  Three things had to be built first — `{kid}` binding friends before
  acquaintances (a gate that promises a friend and a token that names a colleague
  is 0207's `partnered` bug one level down), `FX` being able to author `bond` at
  all, and the predicates reaching the Python generator. And the tranche reopened
  the curve 0412 had just closed: thirty-nine events carrying happiness, and
  `bondFromOutcome` derives warmth from happiness, so content about having
  friends was making it impossible not to have them. New rules 13.74, 13.75 and
  13.76. `claude/0413-the-year-after-school.md`.

- **0414 The family you came from** — finding 2e, and what was left after 0413
  was bigger than what 0413 had closed. The `family` category has **ninety-one
  events** and is the second largest in the catalog; eighty carry an `ageMax`
  under eighteen and the other eleven are gated on `hasChildren`, with no third
  group. So for a childless adult — **56.3% of every adult year in this build** —
  the reachable family catalog was **exactly zero across 4,367 years**, while
  **69.8% of those years had a living parent** who ages in the save and gets a
  funeral and never once a line before it.

  Four previous measurements missed it: 0409 counted at forty where parents
  carry the number, 0410 "fixed family" by building the door to having children,
  0413 measured by category total. Family events ran 0% at eighteen and 12.4% at
  forty, and every point of that rise was people having children rather than
  people having families.

  Twenty-nine family events, four decisions (adult family decisions were zero)
  and twenty-four ordinary-life events for the category that was nothing but
  placeholders. Childless adult years holding a family event **0% → 47.2%**;
  placeholder share across 18–30 **17.5% → 2.8%**; and the largest single
  category share of an adult year **46.9% → 31.3%**, which resolves 2e's second
  half by filling the other categories rather than re-weighting friendship. No
  new predicates were needed — `requires` has meant a LIVING parent since 0212.
  Catalog ceiling raised 500 → 700 (13.68). New rules 13.77 and 13.78.
  `claude/0414-the-family-you-came-from.md`.

- **0415 A life that shapes you** — finding 2c, and one of its four was wrong:
  study already moves a person (+2 Smarts a year since 0210b; +4.0 against −2.3
  for adults who studied). The other two were exact. Paired per life from
  twenty-five to fifty, eight years raising a small child left discipline at
  −3.0 against −2.8 for the childless, and five years seriously ill left
  willpower at +12.2 against +12.9. Nobody was changed by either.

  Measuring it found the bigger thing: **Willpower was collapsing** — sd 11.4 at
  eighteen, **2.8 at sixty**, p10 at sixty 88, and not one life in 150 lower at
  forty-five than at eighteen. 0411's Charisma collapse, on the stat 0411 didn't
  list. The adult catalog held **71 willpower gains and no losses**, more than
  half of what was paid out came from 0413's and 0414's content, and they sat on
  both outcomes of hard choices — the branch where it went wrong paid the same as
  the one where it went right. Five years struggling measured as MORE willpower
  than a calm life (+15.7 against +11.9).

  Two halves, both needed. The catalog: 39 willpower edits across 33 events,
  71/0 → 37 gains / 5 losses. The system: `shaping.ts`, three two-sided rules —
  a small child builds Discipline in a year you held together and costs
  Willpower in one you didn't; a serious illness hardens somebody who meets it
  well and wears somebody who doesn't (not keyed on treatment, which only a
  button sets); a second struggling year in a row costs Willpower. The catalog
  audit alone left a second struggling year paying the same as a calm one; with
  both, −0.59 a year against +0.30. Willpower sd at sixty 2.8 → **8.1**, p10 88 →
  70; parents' discipline +0.8 against −2.8. A class test now checks that no
  trait collapses with age, all five at once. New rule 13.79. The hobby can't be
  built yet — there's no adult state for it to be — and is finding 2g.
  `claude/0415-a-life-that-shapes-you.md`.

- **0416 Something to belong to** — finding 2g, and it was wider than adults.
  Across 120 lives answering every question the game asks, **nobody ever joined
  anything, at any age — 0 of 120**. Every joining verb sits behind the Clubs &
  Teams screen, so 0204's activities, 0206b's tryouts, seasons and teammates,
  0209's parent paying and 0210's "something you still do" meeting door were
  built, tested and unreachable. It's the fourth door of that shape after 0405,
  0407 and 0410. And an adult had no list at all: graduation emptied it forever.

  Ten adult pursuits (a rec league, a choir, an evening class, a book club...),
  a `SchoolStageId` of `adult`, and a systemic sign-up that runs the real
  `tryOut` and `askToJoin`, asked last of the four doors. The adult year charges
  fees through the ledger off the household standard (not the current account,
  13.53), lets people put things down, and builds the trait a pursuit is about
  for its first five seasons — the hobby half of 2c. Lives ever in anything
  0 → 120/120; adult years in a sport 0% → 7.0%; people met as adults through
  something they do 0 → 730; **no friend at twenty 58% → 30%**. Save v31.

  Five tests broke and none was this ticket's code: a dormant fee line repeating
  every year for twelve tickets, a one-seed harness, two extreme-value
  instruments that moved because the sample grew (13.80), and a 3% band sitting
  inside its own 7-point noise when the signal it guards is 35% (13.81).
  `claude/0416-something-to-belong-to.md`.

- **0417 A body that gets old** — finding 1b's leftover, and the Gompertz curve
  was not the cause. Measured on 300 lives: median death 72, **3% reached
  eighty-five**, and old people died five to six times faster than a US life
  table (125, 191 and 313 per thousand a year at 70, 75 and 80, against about 20,
  31 and 51). Two causes. Healing was a flat 3.4 a year against illness that got
  likelier every year, so from the sixties the deficit only grew — median 25 at
  seventy, more than half of all the health lost by then (13.83). And frailty
  read raw health, which falls with age, so age was charged once by Gompertz and
  again by a multiplier every seventy-five-year-old maxed out (13.82).

  Healing now takes a share of what's owed and a strong constitution heals
  faster; frailty reads a body for its age. No Gompertz constant changed. Median
  death 72 → 82, reached 85 3% → 41%, deaths across the seventies 134 → 40 per
  thousand, frailest-to-strongest fifth 70/76 → 77/85. NPCs follow through the
  same `deathChance`; their constitution range widened to [30, 100] to keep their
  spread honest. `claude/0417-a-body-that-gets-old.md`.

More jobs now also means richer lives for NPC children, since `runOffspringYear`
draws their careers from the same catalog.

---

## v0.05 Ownership

> Houses, duplexes, 5/10/25-unit apartments, commercial property, simple
> mortgages, rental applicants, rent changes, automatic renewals, management
> agencies, mass tenant search, renovations. New/Used/Online/Luxury vehicle
> markets, **150–250 initial vehicle entries**, hidden used-car issues,
> modifications, jewelry/watches, two general auction houses + storage +
> high-end/private auctions.

Vehicles must follow the recognisable-fictional-analogue rule with real-world
pricing references. Depends on 0307 (mortgages) and 0301 (asset ledger).

Measured before it was ticketed — `claude/v005-ownership-measurement.md`. Nobody
owned anything, rent was the largest line in every adult budget, and median net
worth at sixty was about what it was at thirty. So homes go first.

|                                    |                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **0501 Homes**                     | **DONE.** Listings, mortgages, owning, selling, the fifth door                                                                                |
| **0502 A household of two**        | **DONE.** Partners earn; a date is not a household; spending per member                                                                       |
| **0503 A landlord**                | **DONE.** Duplexes and apartment buildings, tenants, rent, renewals, agents, mass search. Commercial moves to v0.06 (spec 1708)               |
| **0504 Vehicles**                  | **DONE.** New / Used / Online / Luxury, 247 entries, hidden used-car issues, inspection, instant finance, the sixth door                      |
| **0505 Vehicle modifications**     | **DONE.** Spec 184's ten slots, three wraps, priced by the car, part recovered at resale, and Tarbus                                          |
| **0506 Renovations & collections** | **DONE.** Nineteen renovations and the seventh door, 151 valuables, five stores, a collection that sorts itself, heirlooms                    |
| **0507 Auctions**                  | **DONE.** Two general houses with credibility in words, a storage yard, private sales behind a gate; bargains possible, never a living        |
| 0508 Will & Estate                 | **DEFERRED by Payton, 3 October 2026 — still to be built, after v0.06.** An estate that settles property, debt and the portfolio (finding 10) |

- **0501 A place of your own** — a market of eight listings a year in the
  character's state, three mortgage products with real underwriting, a year of
  owning (market, upkeep, wear), selling, and `home.offer`, the fifth door.
  Three defects found only in the population: 104 of 176 buyers foreclosed
  on because owners still spent like renters (13.86); a nominal 4% market in a
  constant-dollar economy (13.85); and a market hash that rose for twenty years
  straight (13.84). Ownership 0 → ~10% at 25–34 and ~60% at 65+; each life's
  median gain from thirty to sixty $1,700–3,400 → $27,000–30,000. Save v32.
  `claude/0501-a-place-of-your-own.md`.

- **0502 A household of two** — finding 9. A partner cost half again and earned
  nothing: median net worth at 35–44 was $2,900 with a partner and $108,000
  without. Partners now work (an earning power fixed for life, the age curve,
  stretches out of work with a baby at home, a pension), a date no longer
  shares the household, and the standard of living is set per household member
  — feeding a second income into the old formula counted the household twice
  (13.87). That exposed 0501's `OWNER_SHARE` of 0.45, which had been balancing
  the overspend (13.88); it is 0.7 now, and the home door reaches owning costs
  up to 1.5× the roof. Partnered ÷ single at 55–64: 0.18–0.35 → 0.98–1.04.
  Median net worth by age now sits near the US SCF figures from 25 to 74.
  No save change. `claude/0502-a-household-of-two.md`.

- **0503 A landlord** — duplexes and 5/10/25-unit apartment buildings listed
  apart from homes, any house letable, tenants with spec 157's indicators and
  no score, six rent settings tuned so the going rate is the best answer
  (13.89), automatic renewals, a letting agent and a fill-every-unit search,
  an investment mortgage that counts 75% of rent, and a household that falls
  behind on what it lets before the home it lives in. A managed Ohio duplex:
  95% let, ~3% evictions a unit-year, 4.7% net on value (California 2.8%);
  ~7% real unlevered in total. Save v33. `claude/0503-a-landlord.md`.

- **0504 Vehicles** — nobody had ever owned a car. 247 trims across 104
  recognisable fictional models and 28 brands, priced on 2025 US references;
  seven lots in four markets (two new, two used, one online, two luxury behind
  a hidden gate); value from age, model, condition, a hidden service history,
  accidents and rarity, never mileage; maintenance and repairs as one line;
  hidden issues out in the first year, commonest online; a $200 inspection
  that takes a fault off the price; three instant car loans; and `vehicle.offer`,
  the sixth door. An owner's living bill drops by the car share (8.5%) and a
  dear car squeezes the rest. Car ownership 71–73% at 25–34 and 93–96% from 55;
  net worth by age within the noise of the two samples before it. Home
  ownership first fell eight points at 35–54 because the home door read a
  living bill the car had shrunk (13.90); now 3–5. Three of seventeen sabotages
  passed first time (13.91). Save v34. `claude/0504-vehicles.md`.

- **0505 Vehicle modifications** — no car could be changed at all. Nineteen
  options across spec 184's ten slots (wheels, paint and three wraps, tint,
  exhaust, intake, suspension, tune, brakes, engine), priced on the log of the
  car's price so forged wheels are $4,300 on a Hondo and $13,000 on a
  Ferrano. A mod adds 0–35% of its cost to the car's worth, which then ages
  with the car; a classic loses 4% for every change. A tune works the car
  harder; better brakes cut crashes. Tarbus converts Merceda and Porsha
  models for 40% of the car, covers the engine side, recovers 70% and puts
  its name on the car. No door: a hobby is the player's choice. Save v35.
  `claude/0505-vehicle-modifications.md`.

- **0506 Renovations, jewelry and watches, collections, shopping** — homes
  only ever wore down, so 72–88% of homes lived in past forty-five were in
  poor condition. Nineteen renovations (spec 153's list): refreshes lift
  condition and can be redone once aged; additions are once and recover part
  of their cost; and `home.renovate`, the seventh door, asks about the cheapest
  fix you can pay for. Poor homes at 45–64 fell to 26–30%, net worth
  unchanged. Then 151 pieces — watches from a $70 Casiot to a $650,000 Patrek,
  gold and diamonds by carat, art by invented artists, antiques, curios and six
  legends — in five stores under Assets → Shopping, one behind a hidden gate.
  Each holds value by its kind (fashion falls, sought watches trade over
  retail, art swings), the collection shelves itself, one sale button, and
  heirlooms pass to a child as things with whose they were. Two of seventeen
  sabotages passed first time (13.91, 13.92). Save v36.
  `claude/0506-renovations-and-collections.md`.

- **0507 Auctions** — Hartwell & Finch and Crane Brothers (two sales a year
  each, five lots, a car one lot in five), Lock & Key Storage (six sales,
  blind units: what the door shows, junk sold off, now and then something
  kept) and Ashcombe Private Sales behind a $1M gate. A sale is derived; only
  a diary of visits and bids is saved. Credibility is a house's standing this
  year, in words, and decides how many fakes and how fat the estimates; a
  fake is found out the next year. Three bid buttons, you pay where the room
  stopped plus a 25% premium. Measured before building: with the room centred
  on value, careful bids won 11% per win. Centred 20% over value, a careful
  bid at a good house is within ±2% per lot and everything else loses — spec
  1390's "bargains possible, not guaranteed". Save v37.
  `claude/0507-auctions.md`.

## v0.06 Business & Advanced Wealth

> Reusable business engine: startup cost, supplier, COGS, pricing, payroll tier,
> employees, demand, brand reputation, profit, expansion, valuation, sale.
> Business marketplace financially gated **without visible wealth-tier labels**.
> Private investments and commercial real estate integration.

Measured before it was ticketed — `claude/v006-business-measurement.md`. The pre-0601 sample reaches about four in
five holding $25,000 from age 45; nobody in that sample holds $2,000,000; nobody passive will
start a business, so this block has no doors. 0508 Will & Estate was **skipped
on Payton's say-so on 3 October 2026** and is still to be built; it moves after
this block.

|                                    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0601 The business engine**       | **DONE.** Opening, supplier / COGS, a price slider, four payroll tiers, automatic staffing, demand, brand reputation, profit, valuation and sale; twelve businesses; Assets → Businesses. 0604 narrowed five-year survival from 81.5% to 78.7% against BLS 51%; the remaining gap is recorded, not forced                                                                                                                                                                                                          |
| **0602 Catalog and expansion**     | **DONE.** Nineteen more businesses (thirty-one of spec 396's thirty-seven; six wait on music, acting, gambling, sports and private lending), a marketplace gated on net worth, and up to four locations per business. Fixed three 0601 calibration holes found on the way (price slider, pay level, staffing speed)                                                                                                                                                                                                |
| **0603 Business finance**          | **DONE.** Two business loans (Small Business, Commercial Term) written straight into an opening, a new door or a purchase and never paid out as cash; a for-sale list of established businesses priced above their worth; the business pays its own loan. Private Lending Firm remains unbuilt; 0605b is only a proposal if wanted                                                                                                                                                                                 |
| **0604 Business events and heirs** | **DONE.** Nineteen weighted events a year at most (half the years are quiet), a rival that opens in crowded trades and fades over three years, the economy's effect said out loud, and an heir who keeps the business and its lender. Five-year survival 81.5% → 78.7% (BLS 51%); recorded, not forced                                                                                                                                                                                                             |
| **0605 Private investments**       | **ENGINE DONE; Agent B screen patch prepared but not merged.** Six kinds of deal (start-up, private loan, local-business stake, property syndicate, growth company, fund), offered to the soft wealth bands (from $15,000 liquid to $750,000), money away for 1–10 years, an outcome fixed at the cheque, capacity limits on every cheque, early sale only where the kind allows it, tax through the ordinary progressive rate, sold on into the estate at a death. Save v40. `claude/0605-private-investments.md` |
| **0606 Commercial real estate**    | **ENGINE DONE; Agent B screens open.** Four kinds (corner shop building, shopping strip, warehouse, office building) let to businesses of matching trades on 3-7 year leases at a fixed rent, a commercial lender (7.25%, 25 years, 30% down, to $8M), tenants that fail and applicants that thin out with the economy, net yields 5.7-7.4%. No save bump. `claude/0606-commercial-real-estate.md`                                                                                                                 |

- **0601 The business engine** — nobody could own anything but a home, cars
  and a collection; Assets → Businesses had said "not built yet" since 0108.
  Twelve businesses from a $20,000 cleaning company to a $5.2 million hotel,
  shown by what you hold (60% of the startup), never by tier. A year is
  demand × capacity: maturity, the economy, reputation, your skill, a luck
  drawn at opening and a shock that is bigger while young, against price over
  quality; goods, pay and overhead come out, a three-month reserve stays in the
  till and the rest is paid to you as taxed `business` income. Losses come from
  the till, then you, then the doors close. A manager staffs it unless you
  take over. Valuation, a yearly buyer, Sell and Close; businesses count in net
  worth and initially passed to an heir as cash; 0604 subsequently added adult
  heirs keeping the business. Eighteen sabotages, two passed first time.
  Known gap: 0604 added causes and narrowed survival slightly; the remaining gap is recorded, not forced. Save v38.
  `claude/0601-business-engine.md`.

- **0602 Catalog and expansion** — nineteen businesses added to twelve: a law
  firm to a $14 million resort, manufacturing, trucking and vehicle rental.
  The six that need systems not built yet (investment firm, private lender,
  record label, talent agency, casino, racing team) wait, by name. The
  marketplace now reads net worth, as spec 912 and 0601's own comment said it
  should. A business that has traded two years and earned can open up to three
  more doors, each at 65% of the cost, 72% mature on day one, bringing in less
  than the one before and sharing one owner; the second usually pays and later
  ones less, and in a few trades it is a loss. Writing the larger catalog
  showed 0601's price slider had a dominant end once the manager staffed to
  the price (best price at 125–135% for half the catalog); elasticity is now
  derived from costs. Also fixed: pay mattering as much at a car-rental lot as
  at a law firm, and a manager that took a decade to staff a resort. Three of
  eighteen sabotages passed first time. Save v39.
  `claude/0602-catalog-and-expansion.md`.

- **0603 Business finance** — the `business` loan type spec 1857 lists and 0307
  left open, and buying a business that already runs. A business loan is never
  cash: it is offered when you open, add a door to, or buy a business, and goes
  straight into that purchase, so it cannot be spent on anything else. Two
  products, Small Business (8.75%, up to $750,000, 70% of a startup and 80% of
  the rest, fair credit) and Commercial Term (7.25%, up to $15 million, only
  for a business that already earns, good credit). They lend to what repays
  them: half of wages plus what the businesses clear plus what the one being
  bought clears, less every payment already owed. Four businesses are for sale
  each year, drawn from the same net-worth gate, asking 8–28% over what the
  formula says they are worth, with the seller's books polished by up to a fifth
  and customers wary of a new owner. Buying and selling the same one in the
  same year loses money on every draw. Measuring a financed purchase end to end
  found the first version broke: serviced from the owner's wages with the till
  full, it put owners in arrears for eleven to twenty-four of twenty years. The
  business now pays its own loan, the owner steps in for a shortfall, a sale
  pays the bank first, and so does a death. Thirty-eight sabotages, one passed first time. No save
  bump. `claude/0603-business-finance.md`.

- **0604 Business events and heirs** — a year can now have something in it:
  nineteen events by weight (a big order, a breakdown, a key person leaving, a
  supplier's price rise, the landlord, a rival opening or closing), in about
  half of all years, good and bad about even, tilted by the economy and harder
  on a new business. A rival takes 4–15% of the custom, bigger and likelier in
  a crowded trade (cleaning) than an expensive one (a resort), fades over three
  years, and is held off by a good name. The economy's existing effect on
  demand is now recorded and said. At a death the businesses are handed to an
  adult heir with their lenders (a child's are sold, as before), and the
  end-of-life card asks "Hand it on / Sell it". Measured first: five-year
  survival 81.5% against BLS 51%; after, 78.7%. That gap is recorded rather than
  forced, because closing it needs unavoidable disasters and the spec says
  not to have them. Profit still swings by the same amount among survivors
  (margin arithmetic), but now with a cause. The people rule in the events did
  nothing until a mutation test found it. Forty-nine sabotages, three passed
  first time. No save bump. `claude/0604-business-events-and-heirs.md`.

## v0.07 Creator & Fame

> Long-form video, streaming, photo/lifestyle, short-form, podcasting,
> subscription platforms. Category-aware growth, visible trends, #1000→#1
> rankings, collaborations, creator groups, **one visible Fame bar**, and the
> two-stage celebrity interaction system.

Six tickets, built one at a time with a stop between each. Anyone 14 or older
can open a channel (a podcast or newsletter needs 16); talent helps growth but
is never a gate. Measured against real creator figures (vidIQ July 2026,
Twitch/Substack/podcast industry data) before any code.

| Ticket                                     | What it covers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0701 Fame and the creator foundation**   | **DONE (engine).** Six platforms, fifteen categories, channels with a luck draw fixed at opening, long-tail audiences, income per platform, upkeep, tax on the net, one Fame bar 0–100, save v41. `claude/0701-fame-and-creator-foundation.md`                                                                                                                                                                                                                                                         |
| **0702 Video, streaming, podcasts**        | **DONE (engine).** Own curves for streaming and podcasts, charts #1000→#1, trends you can read, sponsorship offers (Accept / Request More / Decline), and an hours cost for effort (resolves finding 47). `claude/0702-video-streaming-podcasts.md`                                                                                                                                                                                                                                                    |
| **0703 Photo, short-form, subscription**   | **DONE (engine).** Brand deals on all six platforms, viral posts on short-form and photo, a paid tier with a chosen price, conversion that falls with list size and payers who build up slowly, and Request More as a fair gamble. `claude/0703-photo-shortform-subscription.md`                                                                                                                                                                                                                       |
| **0704 Collaborations and creator groups** | **DONE (engine).** Collaborations with friends, peers and bigger names (a repeat is worth half), creator groups that take 10–30% for faster growth, and a manager or an agent, never both. `claude/0704-collaborations-groups-representation.md`                                                                                                                                                                                                                                                       |
| **0705 The celebrity world**               | **DONE (engine).** A persistent roster of fictional public figures (derived from the seed, nothing saved), a rare yearly chance meeting, six things to do to a stranger, a second menu for people you now know, and a warm connection becoming an ordinary friend. Save v42. `claude/0705-the-celebrity-world.md`                                                                                                                                                                                      |
| **0706 Fame and creator events**           | **DONE (engine).** Twenty-three events (good, bad and about being known, one a year at most, about half of years), a per-platform rank lift so a player's channel is not an average abandoned one, and higher connection chances for a celebrity answered well. No save bump. `claude/0706-fame-and-creator-events.md`                                                                                                                                                                                 |
| **0707 Fame opportunities**                | **DONE (engine).** A photoshoot, a commercial, a talk show and a guest-star part, each offered once a year from a level of fame, paid by the going rate for a post at that fame (anchored to influencer tiers and the SAG-AFTRA day rate), settled with the year's creator income. Save v43. `claude/0707-fame-opportunities.md`                                                                                                                                                                       |
| **0708 Social Media and Fame screens**     | **DONE.** The first screens for any of 0701–0707: a Social Media screen (channels, sponsorships, collaborations, groups, manager or agent), one-channel and start-a-channel screens, a Fame screen (exact fame, this year's offers, people you know) with the second menu for one famous person, a Fame bar on the Life screen once fame is above 0, and the card for a chance meeting. No engine or save change. Mobile 81 → 200 tests; 170 mutations. `claude/0708-social-media-and-fame-screens.md` |

## v0.08 Entertainment & Sports

> Acting (talent, lessons, character development, agent, roles, career
> reputation, fame, awards, simple negotiation), Music (labels, releases, tours,
> collaborations, awards, release caps), Modeling, and a reusable sports engine.
> Initial sports: Basketball, Football, Baseball, Soccer, Hockey, Golf, Tennis,
> Boxing, MMA, then approved Olympic categories. Coaching/commentary routes.

Coach and teammate relationships stay inside sports — spec 1305–1309, the same
rule that put colleagues on the Career screen. 0416 already added adult
recreational pursuits, including sports, and feeds those participants into the
health phase's athlete branch. v0.08's professional sports engine remains future
work; the school-only adult-athlete gap recorded by 0211 is historical.

**6 October 2026: measured and a breakdown proposed (0801–0809), nothing built.**
No professional sports or entertainment job exists among the 169, and athletic talent
has no door after eighteen. Waiting for Payton to approve the order and five decisions.
See `claude/v008-entertainment-measurement.md`.

## v0.09 Military, Intelligence, Politics & Crime

> Military branches/ranks/pay/benefits/deployments/discharges. FBI/CIA/military-
> intelligence progression **rather than a detached secret-agent career**.
> Politics with campaigns and random debate/donor/endorsement/corruption events.
> General crime, Crime talent integration, independent dealer progression,
> organized crime, courts/prison/parole/escape minigame.

## v0.10 World Integration

> Upgrade NPC simulation, family dynasties with resilient legacy, hidden world
> economy, persistent fictional celebrity world, and large event-library
> expansion — **roughly 2,000–5,000+ event text variants** by pre-beta.

0212 laid the first stone of this: NPCs age and die, children live reduced
lives, and `world.generation` increments. "Family dynasties with resilient
legacy" is the full version of what 0212 made minimally real.

## v0.20+ → v1.0

Content, balancing, expansion. Launch targets 200–400+ job titles and a
correspondingly large event library.

---

## Unticketed work that should slot in

Findings from 0209 through 0212 that are real defects but belong to no ticket
yet. Each one makes the game measurably flatter than it should be.

**1. This build cannot produce a poor student.** — **DONE in 0408.** The
diagnosis in the original finding was half right: character generation was the
floor under it (birth stats ran sd 9 on a 63-point band), but the mechanism was
downstream. Every stat delta goes through 0203's `curvedDelta`, which is full
strength at 50 and tapers to nothing at 100, and school pushed a flat +1 Smarts
a year at everybody for thirteen years — so the weakest students gained the most
and the population converged. Smarts at eighteen had a **minimum of 56 across
500 lives**. Now: school performance at sixteen has a floor of 26 and sd 17.4
(was 50 and 7.7), dropouts 13 → 36 per 500, and 38 per 500 finish with no
qualification at all (was 14). New rule 13.66.
`claude/0408-a-varied-population.md`.

**1b. And it barely produced a varied BODY either.** — **DONE in 0417** (0408 did
the generation half). The lifespan half was not the Gompertz term: healing
ratcheted after sixty and age was counted twice. Constitution is now worth about
eight years and 41% reach eighty-five. The historical 0408 finding follows; its remaining lifespan gap was resolved by 0417.
**At 0408: PARTLY DONE.**
Birth health now runs sd 15 rather than 9, and `frailtyFactor` is two-sided so a
strong constitution is worth something rather than merely not being a penalty.
But the outcome it was supposed to buy did not arrive: median age at death still
moves only about four years across the whole range of birth health. Health at
sixty-five differentiates strongly (23 for the frailest fifth against 57 for the
most robust) — every quintile is simply below the healthy-adult mark by then, so
the original diagnosis attributed the limit to the Gompertz term. At that point
it was assigned to the mortality model, not generation; 0417 found and fixed
the healing ratchet and double counting of age instead.

**1c. A passive player never sees a doctor.** — **CLOSED by decision** after
0417: check-ups stay button-only (spec 531). See `claude/approved-decisions.md`,
which also closes 0417's other two leftovers — serious conditions stay as they
are, and the health ceiling at twenty-six is accepted.

**2. Smarts and Discipline never move after eighteen.** — **DONE in 0411.** The
original finding blamed the social phase; the measurement found a one-way
ratchet. Nothing wrote Discipline or Looks after school at all, and the one stat
adult events did move converged on a plateau (Charisma sd 9.7 → 3.8) rather than
developing anybody. A year of work now builds what the track hires for and lets
the rest go. New rule 13.70.

**2b. Warmth is grown by a button, and there is a trough at twenty.** — **DONE
in 0412**, and the finding was measured at the wrong scale twice. It is not a
hole at twenty, it is a sawtooth with a tooth at every change of room: 84.4% of
FOURTEEN-year-olds had no friend either, for exactly the same reason. And the
half neither 0410 nor 0411 looked at was worse — warmth never went through a
curve, so 90.9% of forty-five-year-olds had a closest friend at exactly 100 and
the population of adult friendships was bimodal at 34 and 100.

**2b-leftover. Twenty is still the loneliest year in the game** — **mostly DONE in
0416**: no friend at twenty 58% → 30%, still the peak because an eighteen-year-old
has only just been asked anything. The historical pre-0416 finding: at 60–67% with
no friend against 87.8% before. The remaining cause is not social: a character
who has left school has work and the street and nothing else, because
`education.activities` only exists while they are AT school. That is the same
gap 0211 measured as _"nobody over eighteen is an athlete in this build"_, it
belongs to v0.08's sports engine or to a smaller ticket that lets an adult join
something, and until then the post-school years have two doors instead of
three.

**2c. And nothing OUTSIDE a job develops anybody.** — **DONE in 0415**, for
parenting, illness and hard years; **the hobby followed in 0416**. Study was already there (0210b's college year). A small child
and a serious illness now shape a person, both ways, and so does a second year
running on empty. It found the larger defect underneath: Willpower was a one-way
ratchet in the adult catalog (71 gains, 0 losses) and collapsed to sd 2.8 by
sixty. Finding 2g records the hobby work shipped in 0416.

**2d. And the `friendship` category has six events for an adult, all of them
about romance.** — **DONE in 0413**, and the finding was true while pointing at
the wrong place. The hole is not spread across adulthood, it is a **cliff at
eighteen**: an ordinary school-leaver had seven reachable events and five of
them were placeholders, against ninety-nine the year before. Friendship at forty
is 5 → 32 and adult friendship decisions 0 → 7.

**2e. The cliff is only half filled, and the rest is not friendship.** — **DONE
in 0414**, and the remainder was a bigger hole than the one 0413 closed: the
`family` category was a total zero for childless adults, 56.3% of all adult
years. Largest single category share of an adult year is now 31.3% against
46.9%, reached by filling the other categories rather than re-weighting.

**2f. Nothing an adult is good at exists.** 0414's leftover, and the third
total-zero of this shape. All **fifty-eight** talent events carry an `ageMax`
below eighteen, so talent is **0.0% of what fires at every adult age** — whatever
a character was good at stops existing the day they leave school. 0414 left it
alone deliberately: adult talent is what **v0.07 Creator & Fame** and **v0.08
Entertainment & Sports** are for. 0416 later added recreational adult athletics;
the adult talent-event tranche and professional careers remain future work. Writing thirty adult
talent events now would pre-empt two milestones and make them harder. **This
belongs to v0.07/v0.08 rather than to a content ticket.**

**2g. An adult cannot join anything.** — **DONE in 0416**, and it was nobody, at
any age: 0 of 120 lives ever joined anything. The original, pre-0416 finding follows.
0415's leftover, and it is three findings
with one cause. `education.activities` only exists while a character is at
school, so an adult has no hobby for 2c to develop them through, no third door
besides work and the street for 2b's loneliest year, and — 0211's finding — no
way to be an athlete after eighteen. The mechanism is one thing: an adult who
can take something up and keep it. **Small enough to be its own ticket**, and
v0.08's sports engine would build on it rather than replace it.

**2h. Mind & Body's self-development rows point at a finished milestone.** Gym,
Meditation, Books/Library, Diet and Walk are spec 1355's and carry a `v0.04`
label written as a guess in 0308c. v0.04 is complete and none of them was built.
They are actions (a tap a year, like Practice) rather than a door, and nothing
owns them. Left unlabelled-by-guess on purpose: this needs a decision on where
they belong, not another guess.

**2i. School activities pay a flat stat effect every year.** 0204's design, and
harmless while nobody could reach it. 0416 made it reachable and school
performance at sixteen rose (p10 43 → 55); Smarts at eighteen still runs sd 12.6
and 0408's guards are green. The 13.66 shape, now live — worth banding the way
0411 and 0416 banded work and pursuits the next time a ticket touches school.

**3. Nothing in the event catalog is about work.** — **DONE in 0409.** 26 work
events including seven decisions, gated on `employed`, `jobTrackAny` and
`jobYearsAtLeast` — which had to be added to the predicate language first,
because an event cannot be about a job if eligibility cannot say "has one".

**4. Nothing in the catalog is about being ill, either.** — **DONE in 0409.** 22
health events including three decisions, gated on `hasCondition` and
`conditionAny`.

**4b. And nothing in the catalog is about losing somebody.** — **DONE in 0409.**
19 loss events including two decisions, gated on `bereavedWithin`. Needed a
`loss` variant on `LifeRecordCategory` so the question could be asked of the
structure rather than by reading labels for the word "Lost" — which `eulogy.ts`
was already doing.

**5. The adult event library is thin.** — **DONE in 0409 and 0410.** 0409 did
the writing; 0410 found that the part 0409 could not explain — `family` stuck at
eleven events at forty — was never a writing problem. All eleven are gated on
`hasChildren` and nobody in this build had ever had a child. Adult years holding
a `family` event went 0% → 25.8% without a single new event being written.

_(0409's half, for the record)_ Events able
to fire at forty went from **26 to 93**, and from zero decisions to thirteen.
Repetition inside a single adult life went from **50% to 23%**. What remains is
`family` and `friendship`, still at twelve and six events at forty: an adult's
parents, siblings and friends are now as thin as their job used to be, and that
was the next content gap at 0409. Friendship was expanded in 0413 and the
childless-adult family library in 0414. New rule 13.67. `claude/0409-an-adult-life.md`.

_(original finding, for the record)_
The voice pass rewrote 180 strings, and reading a played decade afterwards still
shows lines recurring inside a single character's twenties. Eight labelled
placeholder lines, six adult romance events and eleven parenting events cannot
cover sixty adult years no matter how well written they are. **Better copy
raised the floor; only more copy widens the range.**

**6. The crush rows on the Love screen all read the same sentence.** CORE_RULES
13.26 by its own terms; left alone in 0210c because differentiating it needs a
per-person signal that does not exist yet.

**7. The token-guard table lives in four places** — the generator (Python), the
content test, the validator and the renderer. 0209's 13.23 noted three and did
not consolidate. The Python/TypeScript split is arguably deliberate (independent
verification of the same rule), but four copies is one more than anybody keeps
in sync.

**8. `stableUnit` correlates keys that differ only at the end** (13.84). Found by
0501's market; `mixedUnit` fixes new callers. Audit any existing caller that keys
a sequence on it (`…:${year}`, `…:${index}`). It can't be changed in place,
because every save depends on it.

**9. Partners earn nothing.** — **DONE in 0502.** A partner added half again to
the household's costs and never brought in income, so a married household was
strictly poorer than a single one.

**10. Inheritance ignores the portfolio and the pension.** 0501 added home equity
to what an heir receives; investments and retirement accounts still vanish.
Belongs in 0508.

**11. Young ownership is low** — about 10% at 25–34 against a US figure near
37%, while 55+ matches. The door asks 30% of eligible renters a year and the
deposit is what binds. 0503 rentals now exist; no later ownership recalibration is recorded here, so
this finding remains open.

**12. Nobody spends down in old age.** — **Payton: return to this.** Median
net worth keeps climbing past 75 (~$500,000 against ~$335,000 in the US). The
standard of living has no sense of a shorter horizon, so older characters
never draw their savings down.

**13. A partner's earnings don't depend on the player's.** — **Payton: return
to this.** A partner's earning power is drawn independently of what the player
earns; in the world the two correlate at about 0.3–0.4 (people tend to partner
with people in similar work and income).

**14. Mortgage rates are nominal in a constant-dollar economy.** 6.5–7.25% with
no inflation is a real rate nearly double the world's, so leverage on property
is worse than it should be — 13.85 applied to the lenders. Left because the
rates on screen look right; worth a decision.

**15. Nobody passive becomes a landlord.** 0503 built no door: letting property
is a choice a minority make. Deliberate, but worth confirming.

**16. A partner's earnings are too narrow and too fixed.** — **Payton: return
to this. Direction given after 0503.** 0502 gave every partner one earning
power fixed for life, centred on a $52,000 peak (p10 ~$29,000, p90 ~$92,000),
moved only by an age curve and stretches out of work. Payton's direction:
that is not how real life is. Partners should NOT earn a fixed amount for life,
and the peak should not be anchored at $50,000. Real partners range from about
$20,000 to $250,000 and beyond; some move between jobs and their pay goes up
and down; some keep the same work and pay their whole career. The rework should
give a partner a real working life — a much wider spread of earnings, careers
that can rise, stall or fall, job changes, and some who stay put — rather than
one number scaled by age. Pairs naturally with finding 13.

### Payton's playtest notes, after 0503

Logged before 0504 started. Each one was checked against the code so the note
says what is actually there.

**17. College has no screen of its own.** — **Payton: return to this.** Once
you're enrolled, "Study something" disappears from the Career tab and nothing
replaces it. Study Harder and Leave the program do exist, but only as two rows
in the Career tab's "What you can do" card, and Payton didn't find them. A
student should get a screen for the program they're in: the program, the year
they're in out of how many, grades, what it costs and how it's paid, Study
Harder, and Leave. Spec 1821: "major + Study Harder is generally enough".

**18. Graduating passes without a moment.** — **Payton: return to this.**
Finishing a degree writes a life record ("Graduated — Nursing") and a feed line,
and that's all. No popup, no screen. Finishing years of school should be marked
when it happens. A graduation popup (what you earned, what it opens up, any loan
still owed) fits the outcome popup the game already has.

**19. Monthly outflow can't be opened.** — **Payton: return to this. Needs a
decision against the spec.** The row isn't tappable. Spec 20 says "Do not create
a full expense-breakdown section" and puts costs on the thing that causes them
(a car, a child, a property). Payton wants to tap it and see where the money
goes. One option that keeps the spirit of spec 20: tapping it lists each cause
as a link (living costs, tax, loans, cards, children, homes, cars) rather than a
month-by-month statement.

A10 update, 6 October: Payton selected linked cost sources, keeping detailed
costs on their existing entity screens under spec 20. Built on
`feat/playtest-outflow-sources`; review/device checks pending. The total remains
recorded spending in the current game year divided by twelve, not a forecast.
See `claude/playtest-outflow-sources.md`.

Payton's case was $60,000 a year, renting, no car, and about $5,000 a month
going out. Measured on 150 lives, a single renter on $55,000–$65,000 runs about
**$4,700 a month**. About **$1,100 of that is income tax**, which the outflow
figure counts. The other **~$3,600 is living costs** (rent plus everyday
spending), which the game sets from income, so take-home of about $3,900 a month
leaves ~$300. Partnered households on the same salary run much higher (median
~$6,600) because the partner's pay raises the household's spending, and the
partner's tax is counted too. So there's no hidden charge, but nothing on screen
explains the number, and counting tax as "outflow" while "income" is pre-tax
confuses the picture. Worth deciding whether outflow should mean spending only.

**20. Debt is hard to find.** — **Payton: return to this.** Loans live on one
row of the Finances screen ("Loans", under the balance). There's no debt or
liabilities view that gathers loans and card balances together, and nothing on
the Career tab says a student loan is building up while you study. A student
loan is only taken when cash can't cover tuition. In the sample above, no
passive life had any loan payment, so Payton's $5,000 most likely had no debt in
it. Wherever debt ends up living, a student should see what they owe.

**21. Twelve job listings a year, not six.** — **Payton: return to this.**
`LISTINGS = 6` in `careers/openings.ts`. Doubling it is one constant, but
0401's reachability numbers and the starvation guards were measured at six, so
it needs a re-measure (more listings means more of the 169 jobs seen in a life,
and may change first-job timing). **P5 measurement:** played-life median jobs seen rises
93 → 96, but passive first-job age stays median 17 in 250 paired lives. Twelve listings alone
still often show fewer than two study/training matches. Reservations and the approved scarce-pool rule are built in `playtest-p5-career-listings.md`; review is pending.

### Found by 0504

**22. NPC parents never buy their child a car.** Spec 61 and 1197 keep it as
something a parent may do unprompted. Needs a decision on who pays the upkeep
while a teenager has no income.

**23. A repossession's shortfall is written off.** When the auction fetches
less than the loan, the rest vanishes. In the world it stays as debt.

**24. Cars are mostly bought for cash.** 25–30% are financed, against about
80% of new and 35–40% of used cars in the US, because the car door pays cash
whenever that leaves three months of living in hand.

### Found by 0506

**25. The gift system is unbuilt.** Spec 64 and 1816: $, $$ and $$$ tiers of
real items, flowers to a watch to a car. 0506's catalog is most of what it
needs.

**26. Renovations are cash only.** No home-equity loan, so a household without
savings lets the house go to poor. That's most of the quarter of homes still
poor at 45+.

**27. Wedding rings aren't jewelry.** 0207's ring is a `spending` line, not a
piece in the collection.

### Payton's playtest notes, after 0507

Logged on 2 October 2026, before 0508. Each was checked against the code, so
each note says what is actually there. None of these are fixed yet.

**28. Advisors push too hard.** — **Payton: return to this.** With $86,000 in
the bank, the bank's advisor says to invest $74,000 of it. That's the idle-cash
rule in `finance/advisors.ts`: `amount = cash − IDLE_FLOOR`, with `IDLE_FLOOR =
12,000`. It leaves a buffer of one small emergency fund and asks for everything
else, whatever the person earns or spends. Payton has seen other extreme asks
too. The single-stock ideas use `SLICE = 0.34` of cash, which is a third of
the account on one name. Wanted: softer, more realistic advice. A buffer that
scales with what the life costs a year (say six months to a year of living,
now that 0303 knows the number), a share of the rest rather than all of it,
and wording that reads as a suggestion. The "idle cash" line should also stay
quiet when a goal is in sight (a deposit for a home, a car). Needs a re-measure:
0308b's finding was that no cash buffer meant happiness of 20 against 78, so
any softening has to be checked against that and against 0309's measured advisor
returns.

**29. Remove the odds labels from people.** — **Payton: return to this.** The
tab on a person's actions ends with a word ("Safe", "Likely", "Even",
"Unlikely", "Long shot"): `oddsLabel` in `PersonScreen.tsx`, fed by
`chanceOf` for a compliment and the other interactions. Payton doesn't want
to see how likely a compliment is to land. Let it be natural: show the action
and not the odds, and let the result tell them what happened. The same word
list is repeated in `JobsScreen.tsx` and `JobOfferScreen.tsx` ("Apply for this
position · Likely"), and `CollegeScreen.tsx` has its own list ("You will get in",
"A reach"). Payton named only friendships and relationships. Jobs and college
are a separate decision, so ask before changing those. The simulation still
needs `chanceOf`; this is only about what the screen shows.

**30. "Property: what your home is worth now" shows when there's no home.**
— **Found by Payton; the cause is mine, from 0504 and 0506.**
`FinancesScreen.tsx` shows the Property row when `books.assets > 0` and labels
it "What your home is worth now". Since 0504 and 0506, `assets` also counts
cars and the collection, so someone with a car or a watch and no house gets a
row saying their home is worth that. The fix is to total only homes for that
row (and send it to Homes), and give cars and valuables their own rows, or
rename the row "Things you own" and send it to the Assets screen. Net worth is
unaffected.

**31. Credit cards lack an explicit purchase-payment choice.** — **Payton:
return to this.** The original note said balances could only come from fees and
interest; that conflicts with the existing code. `advanceYear` calculates the
year's uncovered costs, calls `drawFrom` on available cards before posting the
bills, and records the advance as a `debt` row ("Put on the … card"). Cards do
cover ordinary shortfalls automatically; `finance/cards.ts` updates their balances.
There is still no per-purchase "Pay with card" control for a car, store,
auction or renovation. Payton's request that cards be a real way to pay remains
open; this correction does not choose a new payment model. The original options
were explicit purchase payment or automatic ordinary-living charges. Any change
needs its credit/utilization and reward effects measured. Related to findings
24 (cars mostly cash) and 26 (renovations cash only).

**32. Living costs scale with income to an absurd degree.** — **Payton: return
to this. He has said lifestyle tiers are acceptable if that is what it takes.**
Payton's life: $250,000 a year, no house, no spouse, no children, a car costing
$5,500 a year, and a monthly outflow near $20,000.

The number is the model working as written, and the model is the problem.
`finance/living.ts` sets what a person "is used to spending" as a standard that
rises with after-tax income: `SUBSISTENCE` $18,600 plus 92% of each dollar up
to $120,000, 74% of each dollar above, plus 1.8% of everything held
(`WEALTH_PULL`). For $250,000 a year (about $175,000 after tax) that is roughly
$18,600 + $93,000 + $41,000 ≈ **$153,000**, and about $170,000 once a
seven-figure balance adds its pull. That's about **$13,000–$14,000 a month of
living costs for one person with no house and no family**, with income tax of
about $6,000 a month on top, and the car. That matches Payton's $20,000.

The shape is that spending is a fixed share of income and nothing the person
chooses. A single renter on $250,000 doesn't spend $150,000; in the real world
spending rises well under proportionally with income, and most of the rise is
things the game already models as owned things (homes, cars, valuables,
children). The wealthy single person's savings rate should be high.

Three options, to decide before the fix:

1. **Lifestyle tiers** (what Payton offered): frugal / comfortable / lavish,
   picked by the player, each with a multiplier on the standard and a happiness
   or status effect, with a default that follows income only mildly. Spec 1166
   removes a tier selector by name, so this needs Payton's spec call. It gives
   the player the thing they asked for: control.
2. **Fix the curve without tiers**: a much lower marginal spend above the median
   (for example 0.92 up to $60,000, 0.45 up to $120,000, 0.2 beyond), so $250,000
   lives on something like $75,000–$90,000. No new UI. The standard still
   creeps with wealth, but only a little.
3. **Both**: fix the curve so the default is sane, then add tiers as a way to
   spend more on purpose (and have it show up as something: a nicer place, a
   better-feeling year).

My recommendation is 3, but tiers are a real design change. Any change re-opens
the economy calibration: 0303/0304 tuned `MARGINAL_SPEND` against the median
balance by age, and 0502 and 0504 each had to re-tune because of it
(CORE_RULES 13.88, 13.90). The test is to measure net worth by age against the
two samples again. Note 19 is closely related: the monthly outflow figure counts
income tax, which makes a high earner's number look larger still.

**P2 implementation:** Payton approved the measured default and explicit Frugal / Comfortable /
Lavish choices. Built on `feat/playtest-p2-living-costs` (save v45), with a Lifestyle screen linked
from Living costs, paid-year happiness effects and immediately saved preferences. Measured actual
$250,000 gross pay leaves $165,000 after $85,000 tax; settled Comfortable living is $82,238 at zero
liquid wealth and $87,930 at $1m, rather than the historical estimate above. Both 150-life samples
remain within the existing 55–64 and 65–74 net-worth bands. Details: `playtest-p2-living-costs.md`.
The explicit tier-selector override is recorded in approved-decisions; no full expense breakdown.

**33. Check the "car cost" while in there.** Payton's car costs $5,500 a year
and the outflow is $20,000. The car is not the problem (finding 32), but it's
worth confirming that the $5,500 isn't also being left inside the living bill.
`VEHICLE_SHARE = 0.085` is taken out of the bill for car owners, and at a high
standard that share is about $14,000, which is more than the car costs. So a
rich owner's bill drops by more than the car adds. That's a second reason
the high-income number is wrong, in the other direction. It should be a
dollar amount scaled to the car's real running cost, not a share of the whole bill.

**P2 implementation of 33:** Removed VEHICLE_SHARE. Owning a car replaces an embedded dollar
allowance capped at actual running costs and $1,600 scaled by location, household and housing,
independent of income/tier. Expensive car commitments add their real dollars; the living model
no longer hides the full extra car payment by squeezing it out of generic spending. Mortgage
squeeze and hardship protection remain. Literal tests replace the superseded 8.5% contract.

### Found by P2

- **Old-age accumulation remains for P15.** At 75+, the two passive samples still have median net
  worth $497,442 and $447,058. P2 does not introduce a retirement spending horizon.
- **Business-finance tests coupled quotes to a car-purchase history.** The changed living curve
  moved a seeded car purchase and introduced an auto loan, changing the business marketplace and
  lender obligations. P2 stabilizes those tests' original $47,353 cash and debt-free $11,200 car
  fixture; every literal business quote, loan and ledger assertion stays intact.
- **Project mirroring and device checks remain open.** No project_write or native device runtime
  is available in this session; repo docs and real-store component checks are complete.

### Found by the v0.06 measurement and 0601

**34. Income readers keep separate category lists.** Found in
`claude/v006-business-measurement.md`. `incomeOf` counts positive non-debt rows,
while `earnedIncomeOf`, the summary's tax denominator and business underwriting
read their own definitions. 0601 added business draw where needed and 0603 kept
sale proceeds out of business underwriting; the broader consistency audit remains
open. Historical migration rules describe their own save versions and should not
be rewritten merely to match today's categories.

**35. Sale proceeds can be read as income.** Also recorded in the v0.06
measurement. `incomeOf` counts positive `property` transfers, including a home
or business sale. The finance summary excludes transfers, and car/business
underwriting use other readers, but the home buyer still uses `incomeOf`.
Finding 39 records that remaining mortgage seam. This restores the original
finding number; it does not introduce a new balance decision.

**36. `advanceYear` is not pure over its state.** Found while writing 0601's
determinism test: two calls from the same state object differ from the second
year on, because `state.rng` carries live streams the first call mutates. A game
built fresh the same way twice is identical. The original note's claim that a
save persists only the seed is incorrect: `toSave` writes `rng.snapshot()`
(seed and every live stream), and `fromSave` calls `Rng.restore(save.rng)`.
`persistence.test.ts` already compares one year's continued timeline entries
before and after a save. That test does not establish input immutability or a
full multi-year state replay, so those parts of the finding remain open before
undo, a preview or replay is built.

### Found by 0603 and 0604

**37. A mature business's profit swings a lot from year to year.** Found while
tracing a financed roofing company in 0603: $117,000, $121,000, $24,000,
$121,000, $167,000, −$67,000, $137,000, −$15,000. Under the first loan design a
single bad draw missed a payment and sent the balance on a climb; with the
business paying its own loan out of a till that holds three months it survives,
but a typical owner will still see a business that clears six figures one year
and loses money the next, with no event to explain it in the pre-0604 build. 0604 subsequently added
events and competition; its measured update follows.

_0604: partly answered._ The swings now have named causes the player can read.
Their size is unchanged (log sd 1.0–1.1 among survivors, before and after): a
10% swing in revenue is an 80% swing in profit at a 12% margin. Shrinking the
base volatility didn't help and was taken out. Left as it is unless it shows in
play.

**38. The smallest businesses earn far more than they cost to start.** A
$20,000 cleaning company, once established, is worth $200,000–$540,000 to a
buyer (a median 12.5 times its startup, paying back in about four years), and
the same arithmetic puts most of the small trades at 3–10 times their startup.
It is 0601's margins and revenue scale, not 0603's pricing, and it means
starting a small business beats nearly everything else a young adult can do
with $20,000. 0604's survival and competition pass did not resolve the proportion; its
measured update follows. No catalog change is chosen by this note.

_0604: still open._ Competition is hardest on the crowded trades and the median
five-year pay of a cleaning company fell 13% (2.38 → 2.07 times its startup), but
it is still about twice its startup a year. The cause is a catalog proportion
($300,000 of revenue on a $20,000 startup), and the fix is raising the smallest
few startups, which moves the net-worth gate and 0603's listing literals.
Decide with the catalog.

**39. The home lender still reads `incomeOf`.** 0603's business lender counts
only wages, commission and a partner's pay plus what the businesses clear
(`earnedOf`), so selling a business does not raise what anybody can borrow for
the next one. The car lender already reads `earnedIncomeOf` (0504 hit this
exact problem). A mortgage taken the year somebody sells a business or a house
still reads `incomeOf` and counts the proceeds as income (finding 35).
`buyerOf` in `homes.ts` should read `earnedIncomeOf`; the two functions
disagree on a business owner's draw and on rent, so decide which is right once
and use it in all three places.

**40. A minor who inherits a business gets the sale, not the business.** At a death
an heir under 18 takes the old rule (sold, lender paid, the rest as cash). Whether
a child should hold a business under management until 18 is a will-and-estate
question; 0508 owns it.

**41. Raising the smallest startups would move a lot at once.** Finding 38's fix
(raise the startup of cleaning, marketing, accounting, landscaping) also moves
the net-worth gate (60% of the startup) and 0603's listing literals. Decide with
the catalog, not inside an events ticket.

---

### Found by 0605

**42. A plain index fund beats every private deal, and idle cash earns nothing.**
Measured on 150 forty-year-olds given $500,000 and played to seventy: holding
the money in cash ends at a median of $765,000; putting it in the first
broad index fund ends at $3.4 million; taking every private deal offered at
the largest cheque allowed ends at $1.7 million (p90 $4.6 million). Deals are
capped by the round and by half the person's money, so most of the capital
sits idle in the deals-only run, and cash earns 0%. Neither is a 0605
defect: the deal tables give 8–13% a year on the illiquid kinds after the
tuning, and the capacity limit is spec 1383's. But a player who finds the
index fund never needs a private deal, and nothing in the game makes cash
cost anything. Belongs to a rates/economy ticket; recorded rather than forced.

**43. Dividends and coupons are still untaxed.** `assetIncome` from the
portfolio is posted with no tax row; 0605's deal interest and gains are taxed
through the progressive rate. The two are now inconsistent. Fix in the same
ticket as 42.

### Found by 0606

**44. Rent is only half of what a landlord's tenant owes.** Property tax and
upkeep are charged as a share of value, so a commercial building's expense does
not rise when its tenants fail or leave, and a vacant building costs no more
than a full one (no empty-unit utilities, insurance or leasing costs). The
yields were set net of the kind's expense rate only. Belongs to a tenant-costs
pass if landlords come out too safe in play.

**45. A severe recession and a recession cost an office the same first year.**
The empty time after a new lease is capped at one year, and an office's
unclamped gap is already close to it. Failures and applicant counts still
separate the two states; the first-year share does not. Recorded, not forced.

**46. Commercial buildings cannot be renovated, and the player's own businesses
cannot rent from them.** Both are natural next steps (a business with a
location in your warehouse pays you rent) and neither is in spec 0606's scope.

### Found by 0701–0704

**47. Effort has no cost except upkeep, so heavy effort always wins.** _(Partly resolved in
0702 and 0706.)_ A channel's hours (light 2, regular 5, heavy 9 a week) now reach the
hidden workload, so one channel is livable and four heavy ones are a bad year. 0706
measured it for one video channel over six years: mean net light 3,000–5,900 dollars,
regular 27,000–32,000, heavy 75,000–88,000. Heavy costs about 11 happiness points over the
six years (41.8 against 52.6) and it alone can have the burnout event. It still wins on
money by about 2.7 times, so for the money alone light and regular are never the right
choice. Left as a trade between money and happiness; not changed.

**48. Fame feeds nothing yet.** _(Partly resolved in 0705.)_ Fame now raises how often a
famous stranger crosses your path (`1 + fame/25`), how well your answers land (up to +35
points) and how often a good answer leaves a connection (up to double). Nothing else
reads it: 0706's seven events about being known read it (fame 8 and up), and 0707's four
opportunities read it (6 and up). The bar has its screen since 0708: the Fame bar on the Life screen
opens the Fame screen.

**49. A child can earn what a retiree cannot.** A lucky 14-year-old channel pays
real money with no guardian, trust or tax rule beyond the ordinary self-
employment tax. Measured: a 3-million-subscriber channel nets about $1.75M a
year and its household's standard of living follows. It is rare (about one
channel in 700 ever reaches a million), but it is reachable.

**50. The top places are very rare.** A channel's luck is fixed at opening, so
number one needs a draw near one in four million on video. Measured over six
years at quality 1: 0.005% of video channels reach the top 100, 0.075% of
streams. Spec 949 wants strong play to make the top more attainable; right now
play moves a channel only along its own curve. Revisited in 0705: ranks matter
only to the player's own platforms, and fame is low for nearly everyone (finding 64), so the
top places stay rare. 0706 lifted a player's luck by rank, which barely touches the very
top by design (a draw of 0.99 is moved by about 7%); the top places are as rare as before.

**51. The podcast tail runs under its anchors.** After six years the model sits
roughly 10–25% under the published download percentiles at the top. Left as is:
podcasts are the platform where a small, loyal show is the point.

**52. Request More is always worse than Accept.** _(Resolved in 0703.)_ It is now
65% for +60%, worth 1.04 of the offer on average, on every platform's deals.

**53. Taking a deal costs almost nothing.** Trust is a flat 1.5% (0.5% for a
podcast) of the audience, which beside a deal worth thousands is small, so
Accept is nearly always right. Brand fit, the category and repeated deals in a
year are the natural prices. 0706 did not add them (its events do not touch trust);
still open.

**54. Photo, short-form and subscription audiences are not measured.** No usable
population curve was found for Instagram or TikTok creators; the available
samples are of big accounts (Mention: 24% past 10,000; Pew: creators Americans
follow). The three keep 0701's curve scaled by `discover`. Measured at six years,
quality 1: 0.10% of photo channels pass a million, 0.23% of short-form, 0.06% of
subscriptions. Revisit if a real distribution turns up.

**55. Photo brand money is counted twice.** A photo channel's income already
includes 20 routine brand posts a year at the going rate; a named campaign adds
four posts at 1.5 times it on top, about 30% more. Cutting `BRAND_POSTS` would fix
it but moves 0701's pinned photo income. 0706 left it: the lift already moved photo
income and a second change would have confused the measurement. Still open.

**56. The newsletter sponsorship rate is a guess.** $30 per thousand readers an
issue is set near the podcast's $25. No source was found.

**57. Retention only shapes the lag.** The share who pay settles at the
conversion rate whatever the retention is, so retention changes how fast payers
build up and how fast they collapse when a list shrinks, but not what a settled
list earns. Real newsletters are held up by a flow of new readers. A flow model
would make churn matter in steady state; it needs a flow of new readers per year,
which the audience model does not have.

**58. Two sources disagree about conversion.** Substack's median is 3%; a 2026
publisher sample has 0.62%. Conversion here is 3% for lists up to 10,000, falling
25% per tenfold past it, never under 1.2%.

**59. The 0704 numbers are a judgement inside sourced ranges.** The manager's 15%
and the agent's 10% sit in the market's 15–20% and 10–20%; the group cuts of 10, 20
and 30% sit in the range for networks. The effects they buy (a manager grows a
channel 1.2 times, a group `1 + 1.3 × cut`, an agent's deals pay 1.1 times and come
1.3 times as often, 30% off what strangers charge) have no source. They were set so
that each is a real trade, and measured (below). The agent's cut applies only to
deals, which is an assumption about how agents are paid.

**60. A group is about money-neutral by design.** Growth times what is left after the
cut comes to 0.95–1.06 across 10–30%. Measured over six years it is +3% at 10%, +2%
at 20% and -2% at 30% on mean net income, and +14% to +40% on median audience. It
is worth taking for the audience and the brand calls and costs money at the top
cut. If it should be worth taking for the money too, raise `GROUP_GROWTH_PER_CUT`.

**61. Manager against agent is untested end to end.** A manager is +3.5–4% on mean
net income and gives back 30% of the week; an agent adds 5–24% of channel income
through deals if every offer is taken, more as deals are a bigger share of the
income (short-form). The comparison was computed from separate runs, not one
character living both ways, and trust costs of taking every deal were not counted.
0706 did not revisit it; the events now add brand jobs, which both pay commission
(a manager's cut applies to a brand job; an agent's applies only to deals), so the
comparison has moved slightly. Still open.

**62. What a stranger charges to appear, and the size of a friend's following, are
guesses.** Strangers are 0.3 to 5 times the channel, charging $0.015 a follower of
theirs above 1.5 times its size, never under $25. A friend's following is 100 to
50,000, drawn once per friend; most real friends are not creators at all. Only the
direction (collaborations help small channels most, repeats help less) is sourced.

**63. A creator house is only a label.** No shared household, no co-residence, and
nothing on the Relationships screen, which stays a private world (spec 1316). If a
house should matter to where the character lives, it is a 0705 or 0706 question.

**64. Fame is low for nearly everybody, so little reads it.** Measured in 0705: a dedicated
video creator's 90th-percentile fame was 18 and none of 80 reached the chart. A player's
fame rarely lifts a meeting or an answer enough to notice. If fame should matter in a normal
life, how fame is earned has to rise (it is the audience curve, B6 in the playtest
backlog), not what reads it. 0706 lifted how often a channel pays but not how audience
becomes fame: fame at year 6 is still median 1–14, 90th percentile 3–25, so the seven events
about being known fire in only about 2.5% of creator-years. If fame should matter in an
ordinary life, `fameTarget` (20·log10 of reach) is the lever, and it is not changed.

**65. A famous friend is only an ordinary friend, and takes a seat.** Once warmth reaches 60
they join the circle (`context 'fame'`, not in the room) and from then on the circle's own
rules apply: they cool with no contact and can move on like anyone. They also count as one of
the `ADULT_CIRCLE` (4) peers the circle tops up to, so a famous friend is one fewer new
friend met in the ordinary way. That is probably right (a real friend is a real friend) but
it was not measured. They do die as dead (`alive: false`).

**66. There are no screens for any of it.** _(Resolved in 0708.)_ No encounter prompt, no connection list, no
second menu and no Social Media tab existed. 0708 built the meeting card, the people-you-know list, the
second menu and the Social Media screen, and the Activities row is open.

**67. Connection rate is judged, not sourced, and the mix a player chooses was not
measured.** _(Raised in 0706.)_ 0705's 0.27 connections a life was from every meeting answered
with a compliment and felt low. 0706 raised the connect chances (compliment 0.5, flirt 0.55,
autograph 0.1, picture 0.2). Per meeting at fame 0 (n = 147, so ±4 points): compliment 36%
(was 20%), picture 14% (11%), autograph 7.5% (3%), flirt 7%. At 1.7 meetings a life, a
compliment-only life makes about 0.6 connections. What a real player picks was not measured.

**68. Romance with a famous friend is untested end to end.** The second menu refuses to flirt
with a friend and points at the ordinary friends list. Whether the ordinary romance machinery
accepts a person with `context 'fame'` and a `celebrityId` was not exercised. It would be
simple to find out by starting a romance with one in a test.

**69. The rank lift is a judgement.** Video 1.5, stream 2.5, photo 1.5, short-form 2.0,
podcast 2.5, subscription 1.2, fading out above the top quarter. The spec says "more common
than real life, not extremely overinflated" and nothing gives the size. Measured: ever
net-positive in six years went video 48→65%, stream 10→28%, photo 42→56%, short-form
14→40%, podcast 8→30%, subscription 62→69%. A living wage is still 0–5%. If playtests
still say it is too hard (or too easy), these six numbers are the dial.

**70. The event rates and sizes have no source.** The chance (45% a year), the weights, and
every share (an audience, a year's income, a start-up cost) were set so that about half of
years are quiet, good and bad weigh about 57 to 43, and no event decides a life. Only the
direction is sourced (spec 725–770, 1334). A census (48% of creator-years) is what was
checked, not realism.

**71. Events read the channel and the fame, and nothing else about the person.** Burnout
checks the effort and not the character's job, age or health; a brand job does not care
whether the character is a child (finding 49); a shout-out does not know about the
character's collaborations. They are simple on purpose; deeper reads belong with the screens.

**72. Nothing shows an event but its line on the timeline.** There is no event screen and no
history of past events. A player sees one sentence in the year's summary. See finding 66.

**73. The fame opportunities are anchored, but their size is a judgement.** The going rate for a
post follows published influencer tiers and the multiples (6, 12, 1 and 4 posts' worth), the
floors, the levels (6, 12, 20, 28) and the chances (35%, rising a point a point of fame, to 85%) are
set so the middle is a supplement and the top is large. Only the day-performer floor ($1,283) and the
per-post tiers are sourced.

**74. From fame 60 up, work pays about 0.8 times what the channel earns, and is not capped.**
Measured over 100 ten-year creators: 0.3 times the channel's net at fame 30–49, and at 50 and up
(19 creator-years, a few past 80) $975,563 a year against $337,827. Spec 1372 says not to cap
success, only a mechanic that prints money; this is once a year each and four things, but it is the
biggest single income at the very top. Watch it if a playtest finds a famous life too easy.

**75. Opportunities cost nothing and cannot go wrong.** A week on a set takes no time from anything
else, a talk show cannot go badly, and nothing is refused for a better offer. They are a yes-or-no
once a year. If fame work should be a choice with a price (a conflict with a job, a bad appearance
that costs fame), it is a design decision the engine would need.

**76. Acting, modeling and music will overlap.** v0.08 gives careers their own roles, agents and
reputations. 0707 is what a creator's name alone is offered; v0.08 should reuse the floors and the
rate (`postRate`) rather than invent a second scale, and decide whether a guest-star part here and a
role there are the same thing.

**77. The meeting cannot be postponed.** The card shows over whatever screen the player is on and the
only way off it is one of the six answers (ignoring is one). That matches the decision card, but there is
no "later". It is lost at the year's turn.

**78. Collaborate, invite and endorse choose for the player.** The engine takes a target and the screen
does not ask, so it is the biggest channel or the first business. Add a picker if a playtest finds it matters.

**79. The Fame bar is on the Life screen only**, as asked, so Career and Assets do not show it.

**80. A channel shows what it has earned in all, before costs, and not what it earned last year.** That is
the only figure the channel stores; a year's income is in the ledger rows and no screen shows it by channel.

**81. Creator hours are hidden** (spec 661), so four channels at heavy effort reads as "takes a lot of your
week" and not as a second job.

**82. Nothing shows the 0706 events or the 0705 history.** The Fame screen lists the people you know now,
not everyone you have met, and an event is still one line on the timeline (finding 72).

## Suggested order

This is the historical delivery order with current status annotations, not an
authorization to start the next ticket. Agent B follows HANDOFF §7; Payton sets
Agent A's next ticket.

1. **Character-generation fix** (findings 1 and 1b) — _(shipped as 0408 for the
   aptitude half; the lifespan half shipped as 0417, see finding 1b)_
2. **0301 → 0303** — the ledger and real living expenses, which retire 0210's
   placeholder, make every existing price real, give treatment a cost and give
   inheritance something to inherit. _(shipped)_
3. **0304 → 0310** — the rest of Financial Life. _(shipped)_
4. **0401 → 0407** — career and education depth: reachability, systemic career
   offers, the catalog tripled, college's own systemic offer, the professional
   and vocational tiers with the license that makes them mean something, and a
   first job that arrives on its own. _(shipped)_
5. **Adult event volume** (findings 3, 4, 4b and 5) — _(shipped as 0409 for
   work, health and loss, and 0410 for `family`, which turned out to be a door
   rather than a catalog)_
   5b. **Adult friendship** (findings 2b and 2d) — _(DONE: 0412 built the
   mechanism — the curve warmth never had, and the systemic side of
   `interact.ts` — and 0413 wrote the content and found the cliff at eighteen
   underneath it. Finding 2e's other-category gap then shipped as 0414.)_
   5c. **An adult who develops** (finding 2) — _(shipped as 0411 for work and 0415
   for a child, illness and hard years; the hobby shipped in 0416 (finding 2g))_
   5d. **An adult who can join something** (finding 2g, with 2b's leftover and
   0211's adult-athlete gap) — _(shipped as 0416, for everybody rather than
   adults: nobody at any age had ever joined anything)_
6. **Why a wide body buys a narrow lifespan** (finding 1b's leftover) — _(shipped
   as 0417: not the Gompertz term, but a healing ratchet after sixty and age
   counted twice. Nobody got old, and now two in five reach eighty-five.)_
7. **v0.05 onward** in spec order. _(0501–0507 shipped; 0508 is deferred by Payton.)_
8. **Partners' income** (finding 9) — _(shipped as 0502, A household of two.)_
9. **0503 → 0508.** _(0503 A landlord, 0504 Vehicles, 0505 Vehicle modifications, 0506 Renovations & collections and 0507 Auctions shipped. 0508 Will & Estate, which closes v0.05, was deferred by Payton on 3 October and moves after v0.06.)_
10. **0601 → 0606.** _(0601 The business engine, 0602 Catalog and expansion, 0603 Business finance and 0604 Business events and heirs shipped. 0605 Private investments' and 0606 Commercial real estate's engines shipped (0605 screen patch prepared but not merged; 0606 screens open), then 0508 Will & Estate whenever Payton wants it.)_

11. **0701 → 0708.** _(0701–0707 shipped; 0708 built the screens for all of v0.07.
    The next ticket is chosen by Payton.)_

    **6 October Social Media playtest follow-up:** Payton assigned Agent B free
    account creation, real platform display names, manual platform-specific posts
    and lower small-audience fame. Built on `feat/manual-social-posting`; see
    `playtest-manual-social-posting.md`. Engine and optional save-field changes
    are explicitly authorized for this request. Review/device checks pending;
    twelve actions per account/year and new fame anchors need playtesting.
    General life-event wording remains deferred until last.
    **Playtest A3 — business failure warnings (6 October).** Existing-rule warnings
    are built on `feat/playtest-business-warnings`, pending review/device checks.
    They show loss/reserve and loan scenarios and confirmed exit actions. B1's
    accept/decline rescue engine and survival measurement remain open with Agent A;
    a pre-failure decision is not implemented. See `claude/playtest-business-warnings.md`.

## Playtest P1 — business rescue choices (7 October 2026)

Built on `feat/playtest-p1-business-rescue`, pending merge. One yearly review lists all troubled
businesses, with a separate inject-or-close answer for each. No automatic draw on personal
cash for losses or loan shortfalls. Existing half-reserve rescue buffer and business balance
numbers retained. Save v44 carries the unresolved quote; the lender's interest is accrued
once. Declining uses the normal closure path, subtracts the trading hole, pays the lender
first and keeps unpaid debt. Death winds down troubled businesses; healthy ones can pass
on, and closed-business debt reduces the liquid estate before inheritance.

Measured cohort: 9,300 owners across 31 types, five years. Baseline / rescue-if-affordable
survival both 82.1%; decline-all 63.0%; 37.0% ever need the review. All 7,515 measured
answers reconcile. This cohort differs from 0604's historical 78.7% (BLS comparison 51%);
no calibration claim against BLS is made. See `claude/playtest-p1-business-rescue.md`.

**Found by P1:** Other personal debts and division of the estate remain 0508 work;
P1 only nets debt of closed businesses from liquid inheritance, without building wills.
Native device checks remain pending. P2 awaits Payton's go-ahead.

### Playtest P3 — approved social-success change built (7 October 2026)

New-account rank lifts are video/photo 3, stream/podcast 5, short-form 3, subscription 2,
including Kick/Facebook/X aliases. Payton approved them after measurement. Manual annual
settlement now uses full existing negative drift above target and leaves breakout rolls to actual
posts. Existing saved luck is preserved and malformed luck rejected. Save stays v45, TICKET 0708.
Free accounts, manual choices, twelve-post cap, income rates, source curves, top-quarter fade and
small-audience fame anchors are retained. Existing screens consume the engine changes.
All 15 typechecks and 2,598 tests pass; 28 independent mutations caught, none missed. Nine baseline
catalog mismatches and 22 historical-note formatting failures remain.
PR #15: https://github.com/PaytonBlevins/YearAfter/pull/15 (depends on P1 #13 then P2 #14).
See `playtest-p3-social-success.md`.

### Found by P3

- **B6 is not uniformly low.** Manual discovery makes small recurring payments attainable;
  early income, lifetime traction and full-time earnings are distinct measures. After the approved
  change, ordinary six-year YouTube pay reaches 100%, TikTok 43.5%; deliberate strong play reaches
  the $30,000 yearly creator-income benchmark in 9.25% / 2.25%, respectively. A wage here is any
  year before personal tax and bills, not sustained take-home pay.
- **A six-year check missed mature viral compounding.** Before P3, four-post TikTok lives reached
  the wage benchmark in 83% of the shared-calendar sample, against 12% for twelve posts; varied
  calendars still reversed the incentive (40% against 8%). Full downward drift and removing the
  extra annual breakout resolve that retention interaction. In the final shared-calendar hobby
  sample, four/twelve posts reach recurring pay in 80% / 98.33% of lives and wage in 0% / 1.67%.
- **Streaming and podcast full-time careers remain especially rare.** Strong six-year play reaches
  wage in 3% on Twitch and 0.5% on podcasts. The approved moderate lifts improve side income;
  larger tested lifts did not convincingly improve the small tail sample. This remains a known
  balance limitation, not a new unapproved tuning pass.
- **Findings 64/69:** keep Payton’s 1,400 → 0 / 10,000 → 3 fame anchors and preserve saved luck.
  Native device checks, Project mirroring and PR review remain open. P4 was subsequently authorized; see its measurement note below.

### Playtest P4 — approved economy reduction built (7 October 2026)

Full-cyclicality business demand effects are now severe recession −13%, recession −6.5%, slowdown
−2.5%, normal 0%, growth +2.5%, **strong expansion +9% unchanged**, as Payton requested. The
lower ledger/screen/timeline thresholds keep contextual explanations visible. Saved historical
records stay as they were. Industry cyclicality, named events, world transitions, independent
shocks, business controls and P1 rescue choices remain. No save bump; save v45 and TICKET 0708.

Revised production measurement, 9,300 paired owners across 31 trades: five-year rescue-policy
survival 82.11% → 83.85% in the harsh cycle, 83.44% → 83.59% under ordinary transitions. The
paired mature severe profit hit is −8.75% → −4.28% of catalog revenue; boom benefit stays +2.71%.
All 15 typechecks and 2,633 tests pass; full verify hits nine baseline catalog comparisons.
PR #16: https://github.com/PaytonBlevins/YearAfter/pull/16 (depends on P1 #13, P2 #14 and P3 #15).
Full method, prior proposal, approved exception, tests and sabotage: `playtest-p4-business-economy.md`.

### Found by P4

- **General profit volatility remains (finding 37).** Harsh-cycle mature normalized profit swings
  shrink slightly; ordinary-transition swings remain similar. This fixes the economy's influence
  without promising to remove all independent business risk. Cheap-trade startup/profit ratios
  (finding 38) and acquisition economics are not retuned.
- **A lower coefficient can leave its explanation behind.** Ordinary growth tops out at +2.5%;
  its old +5% yearly threshold would hide it even though the boom still has +9%. Ledger, screen
  and timeline thresholds are now shared/pinned. The exact 1.5% screen boundary and half-percent
  rounding exposed floating-point cancellation; both signs and neighboring values are tested.
- Native device checks, Project mirroring and PR review remain open. P5 was subsequently authorized; see below.

### Playtest P5 — approved career listings built (7 October 2026)

Claim published on `feat/playtest-p5-career-listings`, following P4 PR #16 while main remains
`beff25a`. Built twelve listings, reserving two eligible study/training matches and filling
the rest from the existing weighted general pool. The played-life median sees 93 → 96 of 169
jobs; a passive life still gets its first job at median age 17. Across all 53 programs and
5,300 paired new-graduate contexts, fewer than two matching rows drops from 57.38% to 1.89%;
the remaining 100 cases all have only one eligible architecture job. With ten years' work,
the same 5,300-context check has zero misses. The preliminary prototype was restored before final implementation.
Measurement, methods and acceptance: `playtest-p5-career-listings.md`. No save change: v45 and TICKET 0708. Full verification and sabotage results are recorded there;
All 15 typechecks and 2,670 tests pass; full verify has the nine baseline catalog mismatches.
Thirty mutation trials caught all 29 behavioral defects after two gap repairs; one equivalent
survivor is explained. P5 files pass formatting; 22 old notes still block the full format gate.
PR #17: https://github.com/PaytonBlevins/YearAfter/pull/17 (depends on #13–#16).
Implementation CI run 100 confirms the same 22 historical formatting failures, skipping later gates.
Review, Project mirroring and native-device checks remain. P6 was subsequently authorized; see below.

### Found by P5

- **One eligible match cannot fill two distinct slots.** A new Architectural Studies graduate
  can apply for Architectural drafter; Junior designer requires career reach as well as the
  degree. Recommend showing all available matches when fewer than two are eligible, leaving
  the qualification/experience gates intact. Payton approved this exception; no gate or catalog change was needed.
- **More listings do not automatically mean an earlier first job (finding 21).** First-offer
  chance and the education-ending trigger already govern that door. Paired passive quantiles
  stay 16 / 17 / 18 even though lifetime board coverage improves.
- **Reservations change the starvation ruler.** The existing linear weight-share proxy was
  not an exact selection probability. P5 uses conservative ranking-event probability bounds
  for the matching/general pools, retaining the zero-reach / 95% single-life intent.
- **The saved major is current/last, not a history of degree subjects.** The implementation uses
  that existing information plus all held licenses. It cannot promise every old subject after
  another enrolment overwrites `majorId` without a separate save/history design.

### Playtest P6 — approved adult and school work built (8 October 2026 UTC)

Claim published separately on `feat/playtest-p6-school-work`, following P5 #17 while main
remains `beff25a`. Six manual adult gigs now remain available from 18 with no upper-age cutoff;
all 10,212 observed age-23–64 and 4,258 older years have six choices. Four existing school
shifts are explicitly discoverable. Approved retail/kitchen pay is $6,000–$10,000 and
$7,000–$12,000; fixed two-job cap removed under canonical hidden-workload policy.
Graduation/college/adult payout and hours gaps are repaired; adult work enters existing tax,
living and subsequent income stacks. No new stress/grade coefficient or save shape.

Paired retail median graduation cash $9,926→$18,369; one shift barely changes median grades,
two retain stress 49/performance 78 at 17. All-six adult work at 30 has median five-year gross
$215,949, final stress 100 and happiness 21; workload consequences remain real. All 15
typechecks and 2,713 tests pass; full verify has nine baseline catalog mismatches and full
format has 22 old-note failures. Method, sabotage, acceptance and publication:
`playtest-p6-school-work.md`. PR #18: https://github.com/PaytonBlevins/YearAfter/pull/18
(targets main, depends on #13–#17). Implementation CI run 107 confirms the same 22-note format
failure and skips later gates. Save v45 and TICKET 0708 unchanged. P7 subsequently authorized.

### Found by P6

- **B8 was a catalog cutoff, not low odds.** All old gigs ended by 22; adult choices are a manual
  menu, not a random offer roll. Six appropriate rows fix availability without RNG enrollment.
- **B9 already had four shift ids from 16.** Reuse them with clear discovery and their real gates.
- **Early returns skipped work.** Graduation and college missed pay, adults missed hours. A single
  annual producer now covers all stages and preserves the paid year's hours before age-out.
- **Income readers missed gig earnings.** Tax/living, subsequent income bases and loan/dashboard
  readers now include the real ledger producer, without double posting.
- **The two-gig cap contradicted CORE_RULES 13.5.** Payton approved removal and explicit replacement
  of its old assertion; workload, not a menu quota, owns overload.
- **Stacked gigs can outgross lower-paid careers but carry costs.** All six at 30 pushes median
  stress to 100. Older working lives have substantial baseline stress; this is not a measurement
  of purely retired people. Approved pay and existing capacity stay; retirement spending is P15.
- **Brief reference 0208 is stale.** School workload belongs to 0204/0205 and lesson 0408 / 13.66;
  0208 names Children. No parenting work is included.
- Review, native-device checks and Claude Project mirroring remain open.

### Playtest P7 — approved engine, save and screens built (8 October 2026 UTC)

Claim published separately before measurement, stacked on P6 #18 while main remains
`beff25a`. Payton approved 20% smaller investor shocks, a six-month recurring-bill reserve
(minimum $12,000) plus explicit purchase goal, correct risk targets and index reallocation,
and a goal section on the existing Advisor screen. He amended every advisor investment to
**15% of spare cash**, including funds and reinvestment. All built; manual amounts stay.
Save v46 owns the optional goal with no-RNG migration; TICKET 0708 stays. Hired-advisor
reload omission repaired. 53 new tests; 2,766 total and 15 typechecks pass; 28 distinct
sabotage mutations caught after one test gap repair. Full verify still has nine baseline
catalog mismatches, full format 22 old notes. PR #19: https://github.com/PaytonBlevins/YearAfter/pull/19
(targets main, depends on #13–#18; mergeable when checked). Implementation CI run 113
fails the same 22-note format checks and skips later gates. Actual measurements
and stronger controls: `playtest-p7-investments-advisors.md`. P8 waits.

### Found by P7

- **A risk reduction can increase risk.** The command sells the largest overall holding even
  when the recommendation names a sector or speculative holdings. Real probes sold a safe
  bond fund and increased the offending allocation. Correct applicable targets are needed.
- **Lowest volatility is not broadest exposure.** The fund helper chooses Government Bond
  Fund. Explicit `fd.broadindex` routing materially changes advisor results.
- **Smaller cheques alone do not fix advisor performance.** Scratch controlled comparisons
  improve after targeting/reallocation fixes, but the full-life paid median still trails random
  picks. B12 remains open; controlled returns cannot stand in for household outcomes.
- **Old happiness figures are historical.** Current P2/P6-stack all-index versus buffered
  happiness medians are 69 versus 72, p10 38 versus 54; do not repeat 20 versus 78 as current.
- **The living estimate excludes separately billed commitments.** A reserve based on it
  alone understates home/vehicle/debt costs. The combined reader now includes real separately billed commitments, with no
  double-counting or business-account leakage; signed orphan debt counts personally.
- The explicit purchase goal now has Set/Clear on the existing Advisor screen and a no-RNG
  v46 migration. Advisor and goal both survive the real state constructor; native checks
  and Claude Project mirroring remain open.

### Playtest P8 — approved real-model catalog expansion built (8 October 2026 UTC)

Payton reduced the 48-addition draft to 15–20, clarified actual model families and
no invented movements, and requested a very expensive Jacob & Co. equivalent.
Built eighteen additions (37 → 55 watches; 26 → 27 fictional makers), including
Jakob & Co. Billionaire Timeless Treasure at $20m. Old 151 entries and stores are
unchanged. Generator serialization now reproduces tracked valuables bytes without
mass reformat. Actual twenty-year Watch Room median discovery rises 27 → 39 at
$10k+ means; mixed-auction dilution and real-model/source mapping are documented.
28 new tests; all 2,794 tests and 15 typechecks pass, eight baseline generator
mismatches remain; 25 sabotage mutations caught, none missed, MD5 restored.
`feat/playtest-p8-watch-catalog` follows P7 #19 while main remains `beff25a`.
Save v46/TICKET 0708 stay; no screen/save/selection/icing change. P9 waits.
PR #20 targets main, depends on #13–#19 and was mergeable when checked. Implementation
CI run 119 failed the same 22 old-note formatting checks and skipped later gates; details: `playtest-p8-watch-catalog.md`.

### Found by P8

The content validator restores only the generator's declared primary output.
The vehicle generator also writes vehicle-mods, leaving a formatting-only dirty
secondary output after full verification. Exact tracked bytes were restored;
secondary-output restoration is a separate open finding, not a P8 implementation.

### Playtest P9 — approved renovation expansion built (8 October 2026 UTC)

Payton approved the separately claimed, measured proposal on `feat/playtest-p9-renovations`.
Built nine additions for 28 total, all approved costs/upkeep/recovery and kind gates,
aggregate space budgets, derived +3 yearly residence comfort with hardship/final-shortfall
suppression. Existing catalog fields/paid work and saved bedrooms/value preserved;
zero-space maintenance stays available. No immediate stats and no rental/second-home
comfort. Renovate displays full value/upkeep, capped marginal comfort and space, then
explicit cash/card payment through the shared published PR #10 contract. Summary
classifies borrowing as a transfer, preserving P6 earned-income rules. Renovations'
owned generator now matches. Save v46/TICKET 0708 unchanged. Stacked on P8 #20 and
PRs #13–#19 while main remains `beff25a`. All 15 typechecks and 2,867 tests pass;
28 sabotage mutations caught, none missed; seven old catalog mismatches and 22 historical
format failures remain. Owned formatting passes; PR #21 targets main and is mergeable when checked. Implementation CI 125 fails
the same 22 historical-note formatting checks and skips later gates.
Details: `playtest-p9-renovations.md`. P10 and life-event wording wait.

### Found by P9

A pool already prevents later installing an infinity pool because both are once-only
additions in the same group. The indoor pool shares that constraint; replacement
pricing is not quietly added. Annual renovation expense also includes the home's
expense rate on recovered value, beyond the catalog upkeep; previews must use the reader.

### Playtest P10 — approved iced-out watch choices built (8 October 2026 UTC)

Payton approved the full per-watch proposal; built on `feat/playtest-p10-iced-watches`,
following P9 #21. Both Original/Iced-out choices consume the same offered stock slot.
Collection customization previews current resale before/after and charges the fixed
work cost through an explicit cash/card choice. All 55 base catalog entries remain
unchanged; 53 accept work, Jakob is factory-set and Orchard excluded. The one-time
current-value effect and subsequent precious yearly market match the approved
100-seed ten-year probes for all 53 models; both paid paths agree and reconcile.
Save v47 preserves legacy values/RNG and persists paid work without duplicating the
base purchase price. Descendants, counterfeit appraisal, sale/estate and actual
mobile/store/autosave paths are covered. Results: `playtest-p10-iced-watches.md`. All 15 typechecks and 3,014 tests pass
(147 new); 31 sabotage mutations caught, none missed. Full verification retains
seven inherited generator mismatches and full formatting 22 historical notes.
PR #22: https://github.com/PaytonBlevins/YearAfter/pull/22 (main, depends on #13–#21,
mergeable when checked). Implementation CI run 132 failed the same 22 historical-note format checks and skipped
later gates.
P11 and life-event wording wait.

### Found by P10

The eleven original sought entries currently resell for 115% of paid retail, including
an instant original-watch markup. Preserve that approved rule, but never apply it to
an iced invoice's custom-work cost. The existing $20m Jakob's factory diamonds are
not aftermarket work. Original watches can keep their current yearly market; a cheap
iced watch should not drift to the bare-watch fashion floor after gemstones were paid
for. Payton approved the precious reader for paid aftermarket work. The seven inherited
catalog-generator mismatches and 22 historical-note formatting failures still block
verification/CI; native checks and Project mirroring remain open. No unrelated catalog
rewrite or life-event wording work is included.

### Playtest P11 — approved servicing built (9 October 2026 UTC)

Payton approved with a 5–10-year longer-life target. Built on
`feat/playtest-p11-car-servicing`, stacked on P10 #22 after refreshing main (`beff25a`).
Separately reserved save v48 before production edits; old cars remain unserviced and
values/financial history/RNG stay intact. Optional extra preventive work has one
invoice, cash/card confirmation and last-service/renewal status on the owned-car
screen. Price is half next year's mean maintenance, nearest $10/minimum $100. Normal
wear ×0.63, classic wear ×0.75 and ordinary repair chance ×0.8 expire after one advance.
Ordinary bills, accidents, hidden faults, history and loan/modification rules stay.
Production reproduces all 4,200 paired paths, with 5–10 extra median remaining years
for the measured cars. Thirty mutations caught after strengthening one missed RNG
comparison. Details/final verification/PR: `playtest-p11-car-servicing.md`.
PR #23: https://github.com/PaytonBlevins/YearAfter/pull/23 (main, depends on #13–#22,
mergeable when checked). Implementation CI 139 fails the same 22 old-note format checks;
later gates skip. P12–P16 and life-event wording wait.

### Found by P11

Ordinary annual maintenance already includes servicing, so the player action clearly
identifies extra preventive work. Hidden old service history does not become perfect
records after one paid visit. Age-18 replacement offers can still appear for a well-kept
car; no silent retune here. The classic-specific multiplier avoids an accidental
nineteen-year extension. Same-object post-call RNG comparisons hide draws; immutable
before-call snapshots now protect that boundary. Seven inherited generator mismatches,
22 old-note format failures, native checks and unavailable Project mirroring remain open.

### Playtest P12 — approved supplier pitches built (9 October 2026 UTC)

Payton approved all proposed terms, including per-business five-search quota shared
across branches. Save v49 separately reserved before production work on
`feat/playtest-p12-supplier-pitches`, stacked on P11 #23 while refreshed main remains
`beff25a`. Built one fictional named pitch, Accept/Pass/Search, fixed accepted quotes,
low/medium/high loyalty softening only the supplier-hike surcharge 0%/25%/50%, and
spoken owned-screen/store/autosave. Current generic suppliers retain old economics;
old unrestricted grade command now refuses. Preserve contracts and usage through
acquisition/inheritance, reset search availability next year without replacing terms.
Actual production commands reproduce 60,000 quote cases and 12,000 reconciled annual
settlements. 3,139 tests and all 15 typechecks pass; 26 mutations caught after one
stale-Pass test repair. Details/final verification/PR: `playtest-p12-supplier-pitches.md`.
PR #24 targets main, depends on #13–#23 and was mergeable when checked.
CI 146 fails the same 22 historical-note format checks; later gates skip. Payton authorized P13 next; P14–P16
and life-event wording wait.

### Found by P12

Payton settled the ambiguous quota scope per business. Supplier price is a per-unit
COGS factor, not a signup invoice. Small quality/cost changes can move a whole worker;
individual operating profit falls as well as rises. Median best-five perfect-information
bound is only 0.420 mature-revenue points on the production sample; it is not a promised
return. Conditional hike protection is not an annual rebate. A replaced Pass ID needs
its own negative test while a new pitch is pending. Seven inherited generator mismatches,
22 old-note format failures, native checks and unavailable Project mirroring remain open.

### Playtest P13 — measured agent levels and pricing check (9 October 2026 UTC)

Payton authorized P13 after P12 closeout. Separately claimed and published on
`feat/playtest-p13-agent-levels`, stacked on P12 #24 while refreshed main stays
`beff25a`. Current catalog has one explicit agent business, Real Estate Brokerage.
All 31 actual owned-business price commands work and demand responds; missing B3
exception is real estate. Measured 54 cost/client-flow configurations at 36 fixed
contexts and three tiers = 5,832 counterfactual points. Proposed team Low/Mid/High
at 90/100/115% labor cost and potential client demand, independent of current
payroll, with a real-estate-only fixed 100% rate and save v50. Details and concrete
approval choices: `playtest-p13-agent-levels.md`. No production edits or version
reservation before approval; P14–P16 and life-event wording wait.

### Found by P13

Do not mistake every “Agency” or supplier-free company for a brokerage. Current
pricing already changes demand; real estate's excluded control is the missing
piece. The gaming company still favors the maximum in a mature manager/reputation
probe; this is a margin finding, not disconnected demand. Log it without rebuilding
pricing. Commission-like variable costs must not shrink when a capacity probe
changes benchmark revenue, and agent cost must not grant another payroll-quality
boost. Whole-person staffing can oscillate; compare a tail mean rather than one
favorable terminal year. Baseline verification/format, native/device checks and
unavailable Project mirroring remain open.
