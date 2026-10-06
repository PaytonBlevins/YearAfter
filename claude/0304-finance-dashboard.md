# Ticket 0304 — Finance Dashboard

**Spec 19 / 1843:** Balance, Income, Tax Rate, Monthly Outflow, Assets,
Liabilities, Net Worth, Investments, Credit.

No save migration. No `pnpm install` needed.

---

## The design problem: four of the nine have nothing behind them

Assets arrive with v0.05's property and vehicles, liabilities with 0307's loan
engine, investments with 0308, credit with 0305–0306.

Rendering those as `$0` would be four false statements. **"$0 of liabilities"
tells a player the game looked and found no debts**, when the truth is that the
game does not model debt — CORE_RULES 13.36 pointed at a screen. 0211c already
settled how this build answers that: twenty-eight rows across the app say "Not
built yet", and build-status calls it *"honest and the clearest map of what
v0.05–v0.10 still owes the player."*

So the screen is two halves with a heading between them. Above, four figures
that are true. Below, four rows that say plainly they are not built.

**Net worth is the awkward one.** It equals the balance exactly today, and two
identical numbers on one screen is 13.26 by its own terms. It stays — it becomes
real the moment 0307 lands, and a row that appears later is worse than one that
explains itself — with a subtitle written to *stop being true*: "Nothing owned,
nothing owed" while `onlyCash` holds, "What you own, less what you owe" after.

### What the screen is forbidden to grow into

Spec 20 rules out an expense-breakdown section; spec 21 rules out month-by-month
accounting. The ledger behind this could produce a category table in four lines
and must not. One outflow figure is not accounting; a table is.

Spec 23 asks for **one general income figure** — so income counts everything
that came in, not just wages, because a year's money can arrive as pay, a paper
round or a gift. Tax, though, is rated against **earned** income only: spec 1846
draws the same line ("cash gifts change cash but are not earned income").

---

## The contextual expense the spec names

Spec 20: *"open a child to see that child's monthly cost."* That row has existed
since 0208 and was showing a number from `monthlyCostOf` — a placeholder written
before any ledger existed. By 0303 it had quietly become **a second cost model**:
the page said $420 a month while the living phase charged the household
something else entirely. One fact, two derivations (13.23).

Deleted, the way `livingCostOf` was in 0303. Its one good idea — *"a teenager
costs more than a toddler, which every parent knows and no game ever says"* —
moved into `childShare`, where it now changes what the household is **actually
billed**. A child in San Francisco costs more than one in Memphis, which is true
and which no previous version of the number could say.

---

## Three defects found by measuring, two of them in earlier tickets

### 0301's commission guard could never fail

The employment phase posted a separate `commission` row whenever the variable
part of a year's pay was positive, and the comment said exactly why: *"a ledger
that wrote '$1,400 of commission' for a school administrator every year would be
technically true and misleading."*

Every template in the catalog has a non-zero `atRisk` — a government clerk is at
2% — so the guard was true for every job that has ever existed. Measured:
**a commission row in 5,270 of 5,270 working years.** A guard that cannot fail
is not a guard. It is now a property of the template (`paysCommission`), asked
in one place so the ledger and any screen agree.

### 13.45 — a household charged for a 38-year-old child

0303 reached for `livingChildren` (children who are alive) where
`childrenAtHome` (children being supported, under 18) was meant. Both exist;
they differ by one predicate and by the entire question they answer.

Nothing failed. Every test passed, the books reconciled, and it was invisible in
aggregate — until a screen printed a sentence a person would read:

> child Tyler (38) costs $1,117 a month

A sixty-seven-year-old had been billed for his son since the year he was born.
**A household's costs never fell after the children grew up**, which is most of
why a late career could not save.

### And that invalidated 0303's tuning

Fixing it lifted the median balance at forty from **$101,000 to $171,000** in one
commit. `MARGINAL_SPEND` and `TAPER_SPEND` had been fitted against a game that
overcharged, so they were re-swept and re-set (0.84/0.60 → 0.92/0.74). A constant
tuned against a defect comes back for a second visit when the defect goes.

| | 0303 published | after the fix | after re-tuning |
|---|---|---|---|
| Cash at 30 | — | $73,143 | $67,325 |
| Cash at 40 | $101,059 | $170,797 | $134,997 |
| Cash at death | ~$296,000 | $359,940 | $231,734 |
| Adult years broke | 2.2% | 2.2% | 2.1% |
| Shortfall years | 0% | 0% | 0% |

---

## Three layout defects, from one screenshot

Taken on the finished screen, which is the step that has caught every copy and
layout defect in this build:

- **A clipped subtitle** — "Just your balance, for now. Nothing owned and…" —
  the **third** time this build has shipped one (0209's parent rows, 0210's
  openings list, 0210c's school row). A row with a value on the right has about
  half a line, and copy written without measuring is copy that gets cut.
- **An accent on the wrong element**: it coloured the row's *label* green, not
  the figure.
- **"Not built yet" repeated under a heading that already said it** — four
  identical subtitles, which is 13.29 and 13.26 at once. The heading carries it.

## Follow-on

- `NOT_YET_OWNED` is asserted by a test, so 0305, 0307, 0308 and v0.05 each have
  to come here and delete a line — the same device as `UNWRITTEN_CATEGORIES`.
- The browser harness still stalls on decision sheets (no "N of M" header when
  only one decision is open). Reading the screen's values through the engine
  worked and is what found 13.45 — worth keeping as the routine.
- The rich tail is growing: p90 cash at forty is now $390,000, because a high
  earner has no house, no investments and no retirement to put it in. v0.05,
  0308 and 0310.
