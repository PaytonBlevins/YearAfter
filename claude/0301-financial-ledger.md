# Ticket 0301 — Financial Ledger

**v0.03 Financial Life has started.** Committed as `6a69c75` on the Mac
(`97bb555` in the cloud). 670 tests, 29/29 turbo tasks, validator clean. Save
**v18**.

---

## The measurement is the ticket

Before a line of code, across played lives:

- An active character earns a **lifetime gross of $4.26 million** and dies
  holding **$138,000**. Four million dollars pass through a life and the game
  records none of it.
- Cash moves in **55 years** of an active life and **2** of a passive one.
- The zero floor binds in **89 of 4,255 played years** (2%).
- A passive player is **never paid at all** — 0 of 60 lives.

And the numbers were never missing. `savedFrom` computes gross pay, then tax,
then the cost of living, and returns ONE number — the remainder:

| gross | kids | tax | living | what the player sees |
|---|---|---|---|---|
| $24,000 | 0 | $4,302 (18%) | $18,504 (94%) | **$1,194** |
| $42,000 | 2 | $8,604 (20%) | $32,647 (98%) | **$749** |
| $68,000 | 0 | $15,873 (23%) | $46,770 (90%) | **$5,357** |
| $240,000 | 2 | $81,600 (34%) | $129,109 (82%) | **$29,291** |

Two of three columns computed correctly, every year, for a whole career, and
discarded on the next line.

**CORE_RULES 13.38 — a number the game computes and discards is a number the
game does not have.** That is a *recording* failure rather than a missing
feature, and the two are worth telling apart: a missing feature is visible
(nobody thinks the game models mortgages), while a discarded number is
invisible until a later ticket asks an obvious question and finds the answer was
available eighty times and kept zero times.

---

## What shipped

**New `@yearafter/finance`.** Spec 21 shapes the entire package in two
sentences: *"Keep the detailed ledger on the backend for correctness and QA. Do
not show month-by-month accounting to the player."* So 0301 ships **no screen**
and is not going to have one. 0304's dashboard reads totals from it.

**`post` is the only function in the build that can move money.** Six producers
each did their own `add(state.player.cash, …)` with their own idea of the zero
floor — CORE_RULES 13.31 in its usual shape, and this build has already watched
that go wrong three times with timeline ids. `player.cash` is now a **mirror** of
`finance.balance`, never a computation, and `reconcile` re-adds every
transaction to prove `post` was the only thing used.

Spec 1678 makes reconciliation build-blocking in 0302. It lands here as a
function and a test so that the ticket which adds the rule is not also the ticket
that discovers the ledger never satisfied it.

**Phases report money; they do not move it.** Education, family, employment and
events return `transactions` alongside `lines` and `records`, and `advanceYear`
posts the year in one place — **income before outgoings**, so the floor sees the
whole year rather than whichever writer happened to run first.

**A shortfall is a real row.** A clamp nobody writes down is a ledger that cannot
reconcile: the books would say a character was charged $10,000 in a year they had
$400, the balance would say $0, and the two would disagree by $9,600 with nothing
to point at. It is also the hook 0307 needs — a shortfall is precisely what a
loan would have covered.

**`payBreakdown` returns four numbers where `savedFrom` returned one**, and a
test asserts they sum to exactly what the old one gave, for every job at every
stage of every career. A ticket that adds bookkeeping must not quietly rebalance
anything, and keeping both is the only way to prove it did not.

### The categories

Spec 1677's ten, verbatim and in its order, plus four the build actually
produces and the spec has no word for:

| | |
|---|---|
| **writing today** | `salary` `commission` `tax` `living` `gift` `oddJob` `tuition` `spending` `windfall` `shortfall` |
| **declared, no producer** | `housing` `vehicle` `debt` `assetIncome` `investment` |

The second row is exactly the bet CORE_RULES 13.36 says not to take, so it is
explicit: `UNWRITTEN_CATEGORIES` is exported and a test asserts the list is
honest. It is meant to shrink.

`commission` is not decoration — 0210's job templates have carried `atRisk`
since the day they were written, and this is the first place in the build that
can tell a salaried job from a commissioned one.

---

## What a life's books now look like

Minato Ueda, died at 62, 246 transactions:

```
lifetime IN  $4,127,879     OUT  $3,920,491     final  $207,388

  salary        $2,073,265  (44 entries)
  commission    $2,033,909  (44 entries)
  tax          -$1,117,943  (44 entries)
  living       -$2,789,713  (44 entries)
  oddJob           $20,425  (15 entries)
  gift                $280  (12 entries)
  spending        -$12,835  (43 entries)

age 15:  oddJob     $188  walking the Hallidays' dog
         oddJob     $235  washing cars on the street
         gift        $33  Dad gave you money

age 45:  salary  $40,182  Freelance creative — pay
         commission $84,819  Freelance creative — commission
         tax    -$35,114  Tax
         living -$83,788  Living costs, 4 at home
```

Every row carries a source, because `Transaction` cannot be constructed without
one. CORE_RULES 13.6 has said since 0203b that money names where it came from;
it was kept by hand in six producers for nine tickets and is now a type error to
forget.

---

## Save v18

The migration had a genuine problem: an existing save has a **balance with no
transactions behind it**, and the two must agree from the first advance or
`reconcile` fails forever. Three options, one honest:

- **Invent a history** by scanning the timeline for money lines. Wrong twice —
  `LifeRecord`'s contract says structured history is never derived by parsing
  feed text, and 0211b rewrote a hundred and eighty of those sentences, so the
  same save would migrate differently depending on which build last touched it.
- **Start at zero** and lose the money. A character who saved $40,000 opening a
  migrated save to find nothing is the worst outcome available.
- **Open the books with one entry** that says what is true: this is what they
  had when the ledger started.

The third. It reconciles by construction, loses nothing, and does not pretend to
a history the save cannot support — the same choice migration 16 made about
`records` and 15 about health conditions.

An heir's books open the same way, with the estate as a single `gift`
transaction naming who left it.

---

## Found on the way

**My own API had `short` signed two ways.** The doc comment said positive, the
code returned negative, and the file's own test caught the disagreement on its
first run. Now pinned and written out, because a value whose sign is a matter of
opinion is one somebody adds when they should subtract.

**A third test was counting the player's actions inside the engine's budget.**
`LINES_PER_YEAR` bounds what `advanceYear` writes; player actions sit on top of
it deliberately. 0211 found two tests that got this wrong. A third survived in
`guardians.test.ts`, which subtracted parent-asks but not answered decisions —
so it was really asserting *"seven, plus however many decisions this seed
happened not to raise."* Moving when money posts changed which events fired, one
seed landed a decision in a busy year, and it failed at 8. **The budget was
never exceeded**: twelve entries, four asks, one answered decision — seven.

**CORE_RULES 13.39 — a test whose subject is one producer must not measure
another producer's output.** The useful corollary: such a test reports nothing
until something unrelated moves. It is not protecting the invariant it names.

**And `-0` is a real value.** `wanted - applied` is negative zero whenever
nothing was short, and it survives into a `Money`, compares equal to `0` under
`===` but not `Object.is`, and prints as `"-0"`. Caught by asserting on a money
type's edges rather than trusting arithmetic that obviously works.

---

## What the ledger found on its first read

This is the QA argument spec 21 makes for keeping one, arriving on day one:

> A forty-five-year-old earning **$125,000** takes their spouse on a **$22**
> date. Every year.

Recurring prices are a share of *cash* (`costShare`), and living costs keep cash
near zero, so the price never grows with the income. The one-off prices are
fine — a wedding at $8,728 on a $27k salary, a ring at $3,205, both working
exactly as 0210 intended. It is the repeating ones that are stuck.

**This belongs to 0303**, which replaces how living costs are calculated and is
where prices stop being a share of a balance. Recorded in the roadmap.

---

## Note for running it

**This ticket needs `pnpm install`** — it adds the `@yearafter/finance`
workspace package. Already run and verified on the Mac: `finance` is linked
under `packages/simulation` and `packages/persistence` and resolves exactly the
way `@yearafter/health` does.
