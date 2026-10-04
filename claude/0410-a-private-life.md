# Ticket 0410 — nobody in this game ever met anybody

0409 closed with `family` and `friendship` named as the last thin adult
categories: _"An adult's parents, siblings and friends are as thin as their job
was before this ticket."_

They are not thin. Measuring the baseline found something else.

## What was there

A player who answers every question the game raises and never opens a screen,
90 lives, 4,828 adult years:

|                                         | before | after |
| --------------------------------------- | ------ | ----- |
| lives that ever had a partner           | **0**  | 86    |
| lives that ever married                 | **0**  | 78    |
| lives that ever had a child             | **0**  | 56    |
| children born or adopted, in total      | **0**  | 98    |
| partnered adult years                   | **0%** | 65.5% |
| adult years holding a `family` event    | **0%** | 25.8% |
| `family` events that fired in adulthood | **0**  | 1,353 |
| median age at marriage                  | —      | 38    |
| median age at a first child             | —      | 34    |

Zero is the whole finding. `romanticMove`, `tryForBaby` and `applyToAdopt` are
only ever called by a button, so six romance stages, eight moves, a fertility
curve and an adoption queue were unreachable to anybody who did not go looking
for them. This is 0407's finding one system over — _"a passive player never gets
a job, 0 of 250 lives"_ — and it had been true for longer.

**And it is why the adult family catalog looked thin.** Eleven `family` events
can fire at forty. All eleven are 0208's parenting events and all eleven are
gated on `hasChildren`. Not one had ever fired. It was not a content gap; it was
dead content behind a door nobody had built, the same shape as 0405's 33
credential-gated jobs and 0407's 68,514 unclaimed listings.

## What it is

**One door, two questions, one save field.** `romance.offer` asks about the next
step with somebody; `family.offer` asks about a child. Different questions, so
different event ids; only one can be open at a time, so one `lifeOffer` field —
a second would describe a state that cannot occur.

**It runs the real verb.** Answering yes calls `romanticMove`, `tryForBaby` or
`applyToAdopt`. Same odds, same money, same copy, same failures. The ladder's
age gates, its relationship thresholds, its `minYearsAtStage` clocks and its two
share-of-what-you-hold prices all still apply, because the door asks `movesFor`
what is available rather than deciding for itself. A test asserts that directly:
**zero** offers across 60 lives proposed a move the Love screen would not have.

**What it never does:** break anybody up, file for divorce, or offer a single
person an adoption. The first two are the player ending something. The third is
a real route 0208 built deliberately, and an unprompted "have you thought about
adopting" aimed yearly at every unpartnered adult is the annual-summons failure
0402 named and 0406 had to go back and fix.

Save **v29 → v30**, with the repairing migration the 0406 save-brick earned.

## The bug that was not in this ticket's code

The door worked and the population barely moved: 40 marriages, 7 children,
median wedding at **59**. Three measurements found three separate causes, and
the third was the big one.

- **The door kept starting over.** Drawing a candidate from everybody warm
  enough meant a character with eight friends who had already flirted with one
  had a one-in-eight chance of the question being about that person. At forty,
  43 of 90 stood at `interested` with nobody. A crush is already the answer to
  "who is this about", the way a partner is one rung up.
- **The wait was charged twice.** `make-official`, `propose` and `marry` each
  carry a `minYearsAtStage` clock that has already held the couple at that rung
  for a year or two. Putting an independent 55% gate in front of that is not
  pacing, it is 0407's `prefers` objection in a different system — the same
  lever pulled twice. Moves with a clock are now asked every year they are
  available.
- **And every systemic door in the build had been throttled since 0409.**

That last one is the ticket's real find. Every door opened with
`if (state.pending.length > 0) return state`, and `advanceYear`'s comment says
why 0402 thought it was free: _"an adult year contains zero authored decisions,
because every one in the catalog stops at seventeen."_ 0409 wrote thirteen adult
decisions in a different package and made that sentence false. Measured:
**59.4% of adult years already held an authored decision by the time the doors
ran.** All three were shut in three years out of five.

The queue has always been a list — it already carries two decisions in 641 adult
years out of 4,838 and three in 70 — so what that line was actually for is one
_systemic_ question a year. `hasSystemicOffer` asks that. Fixing it is what took
the numbers from 40/7 to 78/56, and it un-throttles 0405's and 0407's doors as
much as this one's.

New rule **13.68**: a guard whose comment cites a measurement has a shelf life,
and nothing in the language tells you when it expires.

## The ordering, which was argued wrongly and then measured

The door went in first, on the argument that this ladder's clocks and the
fertility curve make a skipped year permanent while a college offer stands at
35% for decades. Measured on the same 90 seeds, going first cost **21 degrees
and two extra idle years a life** and bought two more children and two fewer
marriages. The argument had it backwards: a couple who miss a year marry a year
later, but a year not worked is a rung not climbed and college's recurring offer
switches itself off at the first degree.

Splitting the door so the child question alone could go first — the one deadline
in the build that cannot be waited out — was tried and bought nothing: 55 lives
with a child against 56, and five degrees gone. So there is one door, it is at
the back, and inside the year the child question still goes ahead of the next
rung, which does measure.

New rule **13.69**. Both orderings had a good story; only one had numbers.

| on the same 90 seeds        | before 0410 | 0410  |
| --------------------------- | ----------- | ----- |
| reached a degree            | 66          | 67    |
| reached postgraduate        | 1           | 2     |
| ever worked                 | 88          | 88    |
| idle adult years per life   | 2.3         | 1.4   |
| licenses held, median / p90 | 1 / 2       | 1 / 3 |

## Five tests broke, and one of them was a guard flagging a coin toss

- **`reachability.test.ts` starved Director of pharmacy** — eligible to exactly
  one character in 250, for nine years, never listed. `listingWeight` says that
  job was **10.3% of that character's six slots** every one of those years, and
  the draw is independent year to year (0407 put the year in the key), so
  missing all nine happens **37% of the time**. The guard was comparing against
  a three-year threshold, which is a proxy for "the listings had a real run at
  it" and a poor one once the eligible population is one person. The weighting
  formula is exported now and the guard asks it: starved means a 95% cumulative
  chance and nothing shown, or a share of zero with somebody qualified.
  Sabotage-verified in both branches.
- **`careers.test.ts` asserted 20 < 30 < 40 on cash.** The curve now reads $25k,
  $39k, $48k, $51k, **$45k**, $69k — the dip is the late thirties, which is the
  decade with a wedding behind it and young children in it. A model where that
  costs nothing is a model where a family is free. The long arc is asserted and
  the dip is bounded rather than banned.
- **`investing.test.ts` hoped a forty-five-year-old had $5,000.** It had $1,399.
  0409 fixed six tests in this file for the same shortcut and wrote down why; the
  shortcut survived in two more places. `richEnough` plays on until the balance
  is there — still no fabricated cash, because the ledger is the one thing in a
  save that can be provably wrong. The advisor test also had to be made solvent:
  its character put 80% of the balance into a fund and the fee then landed as a
  **shortfall** row, _"$86 of it went unpaid"_, which is the fee system working
  and the test asserting nothing.
- **`floor.test.ts` compared lifetime totals.** A lifetime total is a spending
  rate times a lifespan, and 0410 gave partners and children to a population
  whose lifespans then came apart. It went red while the thing it guards was
  fine in the other direction: per adult year `allin` spent **$80,540** against
  `never`'s **$79,808** — more, which is what its own comment says should
  happen — and the lifetime medians said 4.9% less.
- **`adult-social.test.ts` measured a frozen circle by the earliest person still
  around.** Somebody who married a classmate legitimately still has that one
  person at thirty-five, and one person who stayed is not a frozen cast. The
  relative claim still reads the whole circle; the absolute one counts nobody
  the character is involved with.

And one real content defect the population change made reachable:
`guardians.test.ts` caught _"Failed out. The letter was polite and it didn't
soften anything"_ at twenty-one **and again at twenty-two**, because a character
can now enroll again the next year and fail again. Each tier gets a set indexed
by age rather than drawn — the `NOT_THIS_YEAR` shape, CORE_RULES 13.17.

## Verified

- `pnpm typecheck` — 15/15. `pnpm test` — **942/942**. Validator — 1,032 ids,
  clean.
- Six new assertions in `life-offer.test.ts`, sabotage-verified three ways:
  removing the door turns three red, restoring `pending.length > 0` turns two
  red, and cutting `movesFor` out of the step choice turns five red.
- Two new persistence assertions, both sabotage-verified: dropping the payload
  from `toSave` and gutting the v29 migration each turn the round-trip red.

## Still rough

A wedding at a median of **38** and a first child at **34** are late. The ladder
itself is not the cause — its clocks total four years — and neither is the door.
It is that warmth only grows for a passive player when an event happens to name
somebody: the median twenty-year-old's warmest peer sits at 39, below the 45
`ask-out` needs, and does not clear it until the mid-twenties. `interact.ts` is
the thing that moves warmth and it is a button. **That is the same shape as this
ticket's finding, one level down, and it is the next one.**

A life question is on the table in 37% of adult years. Most of those are a
couple climbing a rung they have waited for, and the door stops asking the
moment the move stops being available — but it is a lot of questions, and it is
the number to watch if the feed starts to feel like a form.

Single-parent adoption stays a screen action by design, so a passive player who
never partners still reaches no children at all. `family.test.ts` covers that
route deliberately and 0407 had to fix it once already for reaching it by
accident.
