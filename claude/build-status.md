# YearAfter — build status

**Repo:** `~/dev/yearafter` on the Mac (`mac-lan`). Moved out of `~/Documents`
because macOS TCC protects that folder and blocks build tooling from reading its
own working directory.
**Milestone:** v0.03 Financial Life, in progress. Tickets 0301–0308 complete,
plus the 0308b/0308c/0308d rounds. v0.02 Living Character is CLOSED (0201–0212).
**Next:** Ticket 0309 — Advisors, which now has something to advise on.
**Spec:** `specs/MASTER_SPEC.md` in the repo is the source of truth (v0.3).

> This file went four milestones stale between 0211c and 0308d — its header
> still said v0.02 was in progress and that the build had no ledger, while
> 0301–0308 were shipping. `roadmap.md` and the per-ticket docs stayed current;
> this one did not, because nothing points at it. Worth knowing about any
> document that is nobody's job.

---

## Complete

**Sprint Zero (0001–0009)** — monorepo, Expo app, core types, seeded RNG, save
schema with migrations, SQLite persistence, CI, `/specs`, developer screen.

**v0.01 Playable Shell (0101–0114)** — theme, character header, five-world
navigation, life timeline, Advance, grid stat bars, all world shells and hub
submenus, shared UI kit, original drawn icon set, close buttons.

**v0.02 Living Character (0201–0212)** — character generator, starting family,
the childhood event library, school, stress, friends and teachers, love, adult
social life, children, NPC parent autonomy, employment, college, aging and
health, a full-catalog voice pass, and **death, mortal NPCs and dynasty
continuation**. Plus the 0203b/0204b/0206b/0207b/0207c/0207d/0210b/0210c/
0211a/0211b/0211c rounds. Detail on every one of these is below.

**v0.03 Financial Life (0301–0308d)** — a real ledger, reconciliation,
living expenses, the finance dashboard, credit, credit cards, loans, and
investments. Detail below.

**827 tests across 14 packages**, validator green at 9 catalogs and 797 content
ids. 374 events, 49 jobs across 11 career ladders, 66 employers, 8 college
majors, 12 health conditions, 25 activities, 13 gigs, **89 investable
instruments** and **128 financial headlines**. Save at **v23**.

## Stack as built

Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript 6.0.3, pnpm 10 +
Turborepo, Vitest, expo-sqlite, react-native-svg.

Packages: `core`, `character`, `content`, `relationships`, `events`, `education`,
`social`, `stress`, `parenting`, `careers`, `health`, `finance`, `simulation`,
`persistence`, plus `apps/mobile` and `tools/content-validator`.

---

## v0.03 Financial Life in detail

The spec's own build sequence (§1282–1284) is Shell → Life → Money → Careers.
We did Careers first, and this milestone paid that back: 0210's cost-of-living
model was a labelled placeholder, and every price in the game was a share of
what the character happened to be holding rather than a real number.

**0301 Financial Ledger.** Backend transaction categories. Found four million
dollars the game could never account for.

**0302 Reconciliation.** Opening cash + in − out = closing cash, enforced as a
validation failure rather than a warning.

**0303 Living Expenses.** Inferred from income, wealth, family and location. No
lifestyle selector. **`livingCostOf` deleted** rather than kept alongside, per
CORE_RULES 13.8.

**0304 Finance Dashboard.** Balance, income, tax rate, outflow, assets,
liabilities, net worth.

**0305 Credit System.** Simplified underwriting, deliberately not a credit
bureau simulation.

**0306 Credit Cards.** Limit, APR, balance, payment, rewards, application.

**0307 Loan Engine.** Personal, secured, business, line of credit and private
lending. Full write-up in `claude/0307-loan-engine.md`. Two rules came out of
it: **13.49** (a gate that has never been the binding one has not been tested)
and **13.50** (if waiting is free, no loan can ever be worth taking). Its worst
defect was in the measurement rather than the engine — a harness that never
applied for a job and checked a field that does not exist reported 93% arrears,
and a no-borrowing control through the same harness is what found it.

**0308 Investments**, then three rounds on top of it:

- **0308b** — bond maturities, and the hardship subsidy closed. **13.52** was
  written and then corrected in place: the liquidity trap it described did not
  exist, because the signals that "proved" it were zero by construction.
  **13.53** and **13.54** came out of chasing the $430,000 subsidy that let a
  character invest everything and live cheaper for it — one bug in two places,
  three lines apart, both reading a field called `wealth` that held only cash.
- **0308c** — the instrument catalog. 89 named instruments, a market with real
  sector correlation, twelve years of price history and a chart. Full write-up
  in `claude/0308c-instrument-catalog.md`.
- **0308d** — the market retune, typed amounts and the financial pages. Below.

## Ticket 0308d in detail

Four things, and the first one is the largest.

**The market destroyed value permanently.** An index of every stock, rebased to
100 the year before a severe recession, went
`100 → 58 → 53 → 52 → 51 → 53 → 55 → 57 → 59 → 62 → 64 → 67 → 69` — twelve years
later, still at 69. The market state moved the growth RATE for a year and the
next year carried on from the lower base; nothing remembered the price had ever
been higher, so nothing could give it back.

The tell was not in the returns, it was in the player's incentives: **buying
during a crash returned 1.44x over ten years against 2.02x for buying in a
boom.** The screen told the player what kind of year it was and the only correct
use of that information was to ignore it. Fixed with mean reversion anchored on
the price history already in the save — no new state, no migration. Crypto and
penny stocks are exempt, because reversion is a claim that a thing has a value
to come back to. **CORE_RULES 13.55.**

Fixing it broke `diversification.test.ts`, which had been passing for the wrong
reason: it concentrated in TECHNOLOGY, the highest-drift sector, so two errors
were cancelling. Now pooled over all seven sectors.

**The market, measured.** 18,000 simulated years, total return:

| | median | p10 | p90 | down years |
|---|---|---|---|---|
| one stock | 7.8% | −22.8% | 37.3% | 36% |
| one fund | 6.6% | −9.6% | 23.0% | 24% |
| one bond | 5.6% | 2.4% | 9.1% | 1% |
| one coin | 0.2% | −43.7% | 55.1% | 35% |
| one penny stock | 0.0% | −50.0% | 53.8% | 35% |
| the whole stock market | 8.3% | −8.8% | 22.3% | 24% |

Real S&P down years are about 26%. Weather comes out 39% ordinary, 25% good,
20% slowdown, 8% recession, 7.5% boom, **0.4% crash**. Picking the six
highest-drift names over thirty years returns 6.00x median against 3.80x for the
six worst — picking pays, and luck still dominates any single life.

**The player types the amount.** Every amount in the build had been a choice
from a menu of three — loan sizes, repayments, a quarter/half/all of a holding.
That is defensible while the amount is incidental and indefensible on an
investment screen, where the amount IS the decision. New `AmountField`, and
`previewBuy`/`previewSell` in the engine so the live readout is computed by the
same functions that execute the trade: $5,000 into a $1,040 bond buys four and
spends $4,160, and the screen says so before the button is pressed rather than
in the receipt.

**The financial pages.** A folded newspaper on the investments screen, modelled
on the reference app's Headlines popup. 128 headlines across four slots, and
every story is keyed to a condition that actually held — the reference app runs
lines like "Bonds To Remain A Safe Haven For Investors", true in every possible
year and therefore information in none of them. Below the fold, one line about
the reader's own holdings and a standing primer, because the build models three
rules a player cannot discover by tapping and a game may keep a secret but may
not charge for one.

**Two holes in the validator, both found by planting a defect on purpose.**

- **Four catalogs had never had a word of their copy checked.** V10, V15 and
  V16 all live inside the events-catalog block, bound to `event.text`; the
  source sweep walks `.ts` and `.tsx` and every other catalog is authored in
  Python. Planting "The market does not care about the corridor" in
  `headlines.json` produced a clean pass. The general sweep caught twenty real
  defects on its first run, three of them shipping since 0308c. CORE_RULES
  13.23 for the fifth time.
- **`instruments.json` could not be reproduced by its own generator.** The bond
  suffix had been changed from "Money back in 10." to "Money back in 10 years."
  and nobody re-ran the script, so its self-check — which fails on five
  over-length blurbs — never fired. Every catalog in this build has triple
  enforcement and all three check the OUTPUT; none checked that the output is
  what the input produces. The validator now runs every generator and diffs.

---

## Key engineering decisions

Documented in code; listed here so they are not silently reversed.

- **Save is one versioned JSON document per row.** Now at **v23**. Migrations
  must be pure — no RNG, no clock — or the save stops replaying from its seed.
  v13 adds `employment`; v14 DERIVES `credentials` from the existing stage; v15
  de-duplicates timeline ids again and renames `inClass` → `inRoom`; v16 adds
  `health`; v17 adds continuation; the v0.03 run adds the ledger, cards, loans
  and the portfolio; **v23 turns dollar-blob holdings into units at a price**,
  reading the live catalog rather than a frozen table so a retuned price gives a
  different unit count and the same value.
- **RNG uses isolated per-domain streams.**
- **A birth is one weighted draw over cities,** not nested country→region→city.
- **Cities carry a mix of naming traditions,** so US births produce varied names.
- **No two people in one household — or one class — share a first name,** and
  that set contains the PLAYER as well as the NPCs.
- **Personality traits each need a named consumer.** Six today.
- **Events are data; the engine never names one.** No `switch` on an event id in
  `@yearafter/events`, ever.
- **A decision's people are bound once, when it is raised,** so the prompt and
  the outcome mean the same person across a save.
- **A childhood has a cast, not a name generator** (CORE_RULES 13.10).
- **Being in the same room is contact.** Four rooms: the class, a team you are
  still on, the street you live on, and work. Since 0211a, `inRoom` names which
  one, and every consumer asks that field rather than inferring it.
- **`{they}/{them}/{their}` are the PLAYER's pronouns.** Every other named
  person has their own, including `{siblingThey}` since 0211c.
- **A character's status line is DERIVED, never read from a stored field,** and
  that derivation is ONE function (`occupationFor`) called by both the header
  and the Career screen, because two derivations disagree eventually.
- **Domain packages never import `@yearafter/simulation`.**
- **`@yearafter/finance` re-exports the instrument catalog as a facade,** so
  persistence and the rest do not each take a dependency on `@yearafter/content`
  to ask what `bd.cald10` is — one edge in the graph instead of five.
- **Stat deltas go through a growth curve (`nudgeStats`),** not raw addition.
- **A pending decision stops time,** and pending decisions are part of the save.
- **Money is integer cents throughout,** branded, with `dollars()` and `cents()`.
- **An investment purchase is a TRANSFER, not outflow** (spec 44–46). The row
  exists so reconciliation balances; `summariseFinances` takes `investment` rows
  out of the outflow figure and adds the portfolio back into net worth.
- **Nothing auto-liquidates.** When cash runs short `advanceYear` draws on a
  card; it never reaches into the portfolio. Selling to cover a year is
  something the PLAYER does.
- **Systems attach to `advanceYear` as phase modules.** Order is kin →
  education → social → family → employment → living → events → stress → health,
  and every step of that order is load-bearing.
- **Hand-written navigator** rather than React Navigation.
- **`node-linker=hoisted`** in `.npmrc`; Metro cannot resolve Expo's transitive
  deps under pnpm's default strict linking.
- **`src/root/`, not `src/app/`** — Expo 57 auto-detects `src/app` as a router root.
- **Catalog scripts write their file BEFORE printing their report,** and since
  0308d the validator re-runs every one of them and diffs the result.

### The rules, in one line each

Full text and the defect behind each in `specs/CORE_RULES.md`.

| | |
|---|---|
| 13.4 | A decision is a scene |
| 13.5 | A menu never refuses because you are busy |
| 13.6 | Any change to money names its source AND its amount |
| 13.7 | A system nobody can trigger is not a system |
| 13.8 | Two systems never bill the same account |
| 13.9 | A place worth having is earned, not clicked |
| 13.10 | A childhood has a cast, not a name generator |
| 13.11 | A limit is a year that wears out, not a wall |
| 13.12 | A timeline entry's id is unique, forever — including in the save |
| 13.13 | An event never spends money the character does not have |
| 13.14 | Stress is backend, and escapable |
| 13.15 | A gate guards what it hands back, not only what it lets through |
| 13.16 / 13.21 | Do not gate a system on a system that has not shipped |
| 13.17 | Repeatable copy needs more lines than repeats, and a stable index |
| 13.18 | A relationship the player can only improve is not a relationship |
| 13.19 | A person leaving takes their relationships with them |
| 13.20 | A negative filter over an enum is a bug with a delay on it |
| 13.22 | A rotation cannot fix a base that is redrawn |
| 13.23 | A rule that only sees half the game is half a rule |
| 13.24 | A ticket number is not player-facing copy |
| 13.25 | Measure the population, not the concept |
| 13.26 | A column that says the same thing on every row is not information |
| 13.27 | Answer the player where they pressed |
| 13.28 | A tap is not a decision |
| 13.29 | A subtitle that reads the same every time is decoration |
| 13.30 | A cap the player can see is a cap they play against |
| 13.31 | An invariant kept in sixteen places is sixteen promises |
| 13.32 | A room is not a door |
| 13.33 | A budget kept per writer is not a budget |
| 13.34 | Health is a condition, not a resource |
| 13.35 | A rule scoped to a word instead of a sense writes the bug itself |
| 13.36 | A field nothing writes is not state |
| 13.37 | A state object holding a live cursor is not a value |
| 13.48 | A stat you can raise by tapping is a stat the player will tap for |
| 13.49 | A gate that has never been the binding one has not been tested |
| 13.50 | If waiting is free, no loan can ever be worth taking |
| 13.51 | A test that pins a list catches a wrong deletion and never a missing one |
| 13.52 | Nothing in this build ever needs cash by a date (corrected in place) |
| 13.53 | Running out of money is a discount, and a zero you did not derive is not a measurement |
| 13.54 | Ask which account a rule reads, not just which number |
| 13.55 | A model with no memory of a peak can never give one back |

---

## v0.02 in detail

### Ticket 0204 — School progression

School is deliberately lightweight (spec 75). The whole interaction is Study
Harder plus Clubs & Teams. Found by reading output while the suite was green:
behaviour pinned at 96–100 so alternative school was unreachable; 80% graduating
with a C; and the feed claiming $216 was paid beside a balance of $0.

### Ticket 0203b — Event rewrite

Full write-up in `claude/event-rewrite-plan.md`. All 59 decisions rewritten as
scenes with named people and 3–4 different tactics; 176 weighted outcomes, up
from 83; cash effects `{ delta, source }` with the amount in the visible text.

### Ticket 0204b — Review round

Grades that tracked inconsistently; competitive activities joinable by clicking
(now a tryout); parents referred to by first name (now Mom and Dad).

Found by reading output: "You told Lucía exactly what you thought of him" (36
lines rewritten); a six-year-old's report card reading "F · 0.7 GPA"; and a
graduation event firing at seventeen.

### Ticket 0205 — Stress foundation

**Study Harder is one button.** **Stress** is a backend system with no screen,
shown as an eighth cell only while it is doing something (spec 1094).

Found by measuring: `hiddenLoad` was zero in all 3,400 simulated years; stress
was unreachable in 300 ambient lives; and an overcommitted fourteen-year-old
finished with Health at 29 because two systems billed health for one schedule.

### Ticket 0206 — Friends, classmates and teachers

A childhood has a cast: **five classmates by name at a time and one teacher a
year**. Events bind `{kid}` and `{adult}` to them, and what happens becomes a
memory on their page (spec 771–785). Save v9.

Found by reading output: the class turned over completely every September; 99%
of childhoods ended with no friends at all; no friendship made before middle
school survived to seventeen (exactly zero across 120 childhoods).

### Ticket 0206b — Review round

The one-action-per-classmate-per-year cap removed; teacher interactions innocent
AND mischievous; tryouts for teams; freelance gigs; team standing with practice;
Study Harder twice.

Found by reading output: teammates arrived only for direct joins; practice could
never reach "star" because a symmetric pull ate the work every year; a gig aged
out before it paid. Then a user-reported duplicate React key, fixed with repeat
counters in ids.

### Ticket 0207 — Love

Romance built **on** the person model rather than beside it. **Age is a hard
rule** with four enforcement points: `stagesFor` returns nothing below 13 and
never engaged/married below 18; `canAdvanceTo` guards forward motion;
`holdableStage` guards the value handed back; and the catalog is gated by the
generator self-check and validator V8.

**Found by reading 150 simulated lives:**

- **Marriage was unreachable.** $9,000 wedding in a build whose median
  thirty-year-old held **thirteen dollars** — 0% ever married.
- **98% of lives ended at thirty with the classmate they asked out at thirteen.**
- **73% of lives contained exactly one relationship, ever.**
- **The same sentence four times in a year** — and the identical latent bug in
  the 0206 friendship copy, four tickets after it shipped.
- **The earliest wedding was nineteen,** with 61% under twenty-one.

**Found by reading the built app:** "Had dinner at Marcus's. Their parents asked
what you wanted to do with your life" — about a classmate the character had
never spoken to. Events can now declare `partnered`.

### Ticket 0207b — Adult social life

`changedSchool` was `atSchool && stage !== previousStage`, so **the year a
character graduated it was false** — nobody's `inClass` was cleared and
`driftPerson` exempts anybody `inClass`. The same five high-school classmates
were a character's entire social world at thirty-five.

Fixing it produced the opposite failure, then a third: everybody evaporating
within a year of being met (at thirty, the earliest person known had been met at
29.7), then nobody ever leaving so the circle filled at nineteen and locked.

Then the 0207 invariant test caught the real regression: **graduating ended the
PERSON while leaving their romance live**, so the player picked up a second
partner. `endPerson` is now the only thing that may end somebody (13.19).

**The dating app**: 18+, once a year, and it comes back with nobody more often
than not. A player who does not pair up at school meets somebody at eighteen and
marries around twenty-four.

### Ticket 0207c — Duplicate timeline ids

The duplicate React key `t:2012:study`, reported twice — the second time AFTER
0206b fixed the producer. That is the interesting one: no code in the build can
emit a bare `t:2012:study` any more, so the duplicates were written by the
pre-fix build and sit in the save, where a fixed producer can never reach them.

Migration v10 → v11 de-duplicates timeline ids by position. Pure, so the same
save always migrates identically and a life still replays from its seed. The
first holder of an id keeps it and repaired ids end `:dup1`. Seven tests,
verified to fail when the migration body is neutered.

CORE_RULES 13.12 now says the invariant covers stored data, not just producers:
**a save outlives the bug that wrote it.**

### Ticket 0207d — Clarity pass

Review, after playing 0207: *"I need ALL of the options throughout the app to
sound much more natural like something a real human would say… 'Tell them
something' and 'Have it out with them' does not make sense to everyone."*

The report-card prompt is the whole lesson. **Old:** "The report is in your bag,
it is not good, and Mom has not asked about it yet." **New:** "Mom is asking to
see your report card, but your grades aren't good this time. What do you do?"
Both describe the same moment; the first makes the player assemble it. It is
nicer to read and worse to play.

- All 61 decision prompts rewritten: plain words, contractions, visible stakes.
- Every label held to one test — readable WITHOUT the prompt above it, because
  the standing menus have none.
- American English throughout: *wind them up, fortnight, maths, pavement,
  corridor, apologise, solicitors, fringe, trial* all gone.

Enforced as validator **V9**, **V10** and a social test for the menus that live
in code, plus a width cap after the rewrite clipped two blurbs.

Two self-inflicted defects found while doing it: a blanket source sweep renamed
five event ids and a choice id — silently breaking any save that recorded one —
and the first British check listed whole words, so "apologising" sailed past
`\bapologise` into shipped copy.

**And that sweep kept producing casualties for three more tickets.** 0210 read a
played life and found *"Tripped on a completely APARTMENT surface"*, *"said okay
in a completely APARTMENT voice"* and *"Attempted A BANGS with kitchen
scissors"* — all three reading as perfect American English to every rule looking
for British English, which is why **V15** checks grammar rather than vocabulary.
Then 0211c found the fourth, *"treated it as a public vacation"*, grammatical
and so invisible to V15 as well. That one produced **13.35**.

### Ticket 0208 — Children

Spec 61 removes six things from the player-as-parent **by name** — paying for
activities, discipline, funding college, refusing assistance, buying a vehicle,
providing housing — and adds exactly one, Kick Out of House. In their place:
children **ask**, and the player approves or denies (spec 1147).

New `@yearafter/parenting`; a fifth phase module ages them between social and
events. Save **v12**. Fertility is a curve, not a flag: flat through the
twenties, falling through the thirties, gone by forty-six. Pressing every year
from 22 gives 3.8 children; from 38, 1.2 with 12% having none.

**Found by measuring 90 played families, all invisible to a green suite:**

- **The one parenting decision the spec asks for was unreachable.** Child asks
  priced at $90–$650 in a build with no income: children asked 702 times and the
  parent could say yes **zero** times. 13.16 for the SECOND time, so 13.21
  restates it with teeth.
- **Every family therefore ended estranged**, mean closeness 24.
- **Fixed, closeness still only reached 51:** the model read "nobody asked you
  for anything" as neglect. A quiet year now settles rather than drains.
- **The gestation year slowed nothing**, because the family phase runs before
  the player acts — one child a YEAR, mean family 4.2, 38% with five or more.
- **The same child asked to join the swim team twice**, four years apart.

Eleven parenting events, gated on actually having a child — enforced as
validator **V11**.

### Ticket 0209 — NPC parent autonomy

The exact mirror of 0208. The player's only verb is **asking**. Six things you
can ask for and six things they do unprompted. Grounding moves **school
standing** — the same field events already move — rather than a parallel one. A
parent page shows a **mood** ("Probably", "Unlikely") rather than a percentage,
because a child does not have a calibrated model of their own parents.

**Measured before it was tuned, for the first time**, which caught two defects at
design time: help with college at 4% for 48% of all families, and a $300 school
trip a struggling family and a wealthy one answered within three points of each
other.

**Then reading a played childhood found eleven more, all with a green suite,**
and each class became a rule: **13.22**, **13.23** and **13.24**.

Five new checks: **V12**, **V13**, **V14**, the bare-pronoun-beside-`{parent}`
rule, and a blurb width cap.

### Ticket 0210 — Employment

New `@yearafter/careers`, 49 jobs across **eleven career ladders**, a sixth
phase module, a real Career screen, openings, colleagues, and save **v13**.

**The measurement came first, and it changed the ticket.** Cash was p10 $28,
median $135, p90 $1,175 — the SAME three numbers at eighteen, twenty-two,
twenty-five, thirty and forty. And 100% of characters graduated while 0% left
school early, because nothing in the codebase had ever written `droppedOut`.

**Eleven defects, every one with a green suite**, including: ZERO of twelve
entry-level jobs would hire a median school leaver (`reached` started at -1); an
81% hire rate that did not move between a driven player and one who barely
tried; being let go 0.1 times in a thirty-two-year career (**13.25**); a
character on a median salary holding $226,000 at fifty; work demand reaching the
stress model as a divisor of zero; and six openings all reading "Worth a shot"
(**13.26**).

### Ticket 0210b — College, job offers, and answers where you pressed

Five imperative fixes after playing 0210, all of them right: result popups
(**13.27**), college and graduate school, no auto-hire (**13.28**), real degree
requirements, and the tax arithmetic on screen.

Measured before shipping, which caught three: college tuition unpayable in
2,282 of 300 lives' attempts; 56% getting a master's; and a passive player
getting 0 degrees in 200 of 200 lives.

### Ticket 0210c — Career screen cleanup

Four cleanup items: subtext removed from rows that DO something (**13.29**), the
money moved behind a tap, the visible press counters removed with the effect
still capped (**13.30**), and three cards instead of five.

Found by reading the built app afterwards: the job row read "$25k" over a popup
saying $27,602, because `job.pay` is the ADVERTISED salary.

### Ticket 0211a — The third duplicate key, and work as a room

**CORE_RULES 13.31** — sixteen producers wrote timeline entries and three of
them had the duplicate-id bug over five tickets. `appendToTimeline` is now the
only supported way in, and it does not trust its caller.

**Colleagues and classmates**: four separate bugs, one root cause — **work was a
door, not a room** (**13.32**). `inClass` became `inRoom` in save **v15**.

### Ticket 0211 — Aging & Basic Health

**Health is a condition, not a resource** (**13.34**). The bar is derived from
vitality (age on a fixed curve) and deficit (what illness took). v1 rolled them
into one number and produced a **median death at 64**.

New `@yearafter/health`, a seventh phase module, twelve conditions, save **v16**.
The Doctor screen has exactly two verbs, which is spec 531/1165/1974 enforced.

**Found by measuring:** `frailtyFactor` used 70 as a healthy adult when the
population sits at 66 (13.25 for the third time); permanent injuries filtered to
non-minor severity, making three conditions unreachable (13.20 again); an
unweighted condition draw killed 5% of characters before forty; and the year
line budget broke because seven writers each kept their own (**13.33**).

### Ticket 0211b — The voice pass

*"These texts are so awkward. 'A steady year. The kind that does not make it into
the telling.' Nobody talks like that."*

The diagnosis matters more than the fix: lines **summarized the year and passed
judgment on it** instead of naming something that happened. 180 strings
rewritten and 38 expanded forms contracted. New rules 10 and 11 in
`claude/event-writing-rules.md`, enforced as validator **V16**.

**Three defects in my own tooling, all found by reading output:** the extractor
dropped every `text: [...]` ARRAY, so 593 of 868 strings were never rewritten
and the first pass reported success while the exact line quoted back was still
in the catalog; V16 ran on source files only (13.23 for the fourth time); and
the literal-detection regex required a space inside the string.

### Ticket 0211c — Reading the built app again

Full write-up in **`claude/0211c-review-round.md`**. Four defects found by
playing 0211b, each interesting for why the checks could not see it: "a public
vacation" (**13.35**), a sibling called "him" through the player's pronoun
token, "Crime · Ticket 0901" on a screen (V14 matched the literal a developer
types, not the interpolation a player reads), and the Doctor's "How you are"
section, which was a caption for a number already on every screen.

**The pattern, said once:** all four were found by reading the output of a played
life — never by the suite, because in each case the suite asserts the rule that
caused the defect.

### Ticket 0212 — Death & Continuation

Full write-up in `claude/0212-death-and-continuation.md`. Two thirds of it was
not the death screen: **NPCs became mortal** (new `phases/kin.ts`, the only
phase ever prepended — 97% of characters lose a parent, 36% are widowed, 9%
outlive a child, where before this the median surviving parent of a
seventy-three-year-old was **105**); **`character.records` is written**, eleven
tickets after it was declared; the death screen is spec 1284's seven fields and
no eighth; and **children live their own years**, so continuing as one promotes
a life rather than inventing one. Rules **13.36** and **13.37**.

---

## Known findings for a later ticket

Not defects — things earlier measurements exposed upstream. Full list with
recommended sequencing in `claude/roadmap.md`.

- **This build cannot produce a poor student.** School performance at sixteen is
  p10 67, median 78, minimum **50** across 500 lives. The fix is upstream in
  character generation.
- **And it barely produces a varied body either** — generated health is p10 38 /
  median 52 / p90 63, for a stat that decides how long a life is.
- **Smarts and Discipline never move after eighteen.**
- **Nothing in the event catalog is about work, about being ill, or about
  money.** All three systems write their own lines; no authored event has ever
  heard of any of them.
- **The adult event library is thin, and 0211b proved rewriting it is not
  enough.** A played decade still repeats.
- **The crush rows on the Love screen all read the same sentence** — 13.26 by
  its own terms.
- **The token-guard table now lives in four places** — the generator (Python),
  the content test, the validator and the renderer.
- **Education has no clock** (13.50). Nothing in the build ever needs money by a
  date except a bond's maturity.
- **The happiness floor runs through event gating nobody wrote for that
  purpose** (13.52's annotation) — thirty-four stress-relieving events are
  `cashAtLeast`-gated, which is what actually punishes a broke character. It is
  a good floor and nobody designed it; worth deciding whether to make it
  deliberate.
- **Card rewards are declared and never paid.**
- **`currentLocation` never changes.**

## Known placeholders, labelled in code

- **Treatment is free.** 0303 gave the build a real cost model; healthcare still
  has not been priced against it.
- **`EndOfLifeCard` is a minimal placeholder that 0212 replaced** for the death
  screen, but the card itself is still the old shape in one path.
- **Rows that say "Not built yet" are the clearest map of what v0.04–v0.10 still
  owes the player** — and since 0308d the validator fails when one of them names
  a ticket that has already shipped. It found seven on its first run.
- **The five Mind & Body rows are labelled v0.04, and that is a guess at a
  schedule rather than a decision.**
- **Nobody over eighteen is an athlete.** `education.activities` only exists at
  school. Closed by v0.08's sports engine.
- `coasting` remains a reachable effort level but nothing sets it yet.
- Getting back together with an ex is deliberately not modelled.
- Children age and ask, but nothing else happens to them.

## Running it

```bash
cd ~/dev/yearafter
pnpm install
pnpm mobile:clear
```

Then press `i`. Paste commands one at a time — interactive zsh does not treat
`#` as a comment. Use `mobile:clear` after any build pushed to the Mac, since
extracting over a running Metro invalidates its cache.

`pnpm install` is only strictly needed when a ticket adds a workspace package or
a workspace dependency — 0210 added `@yearafter/careers`, 0211 added
`@yearafter/health`, and **0308c made `@yearafter/finance` depend on
`@yearafter/content`**. It is harmless otherwise.

The full gate is `pnpm verify` (typecheck, tests, validator). Note that the
bridge shell used to push builds to the Mac runs Linux against a macOS
`node_modules`, so rollup, turbo and pnpm cannot run there — **anything with a
native dependency has to be run from the Mac's own terminal.**
