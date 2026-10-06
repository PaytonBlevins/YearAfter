# Ticket 0305 — Credit System

**Spec 1685:** *"simplified approved underwriting; no overbuilt real
credit-bureau simulation."*

No save migration. No `pnpm install`.

---

## The spec is mostly a list of things not to build

| | |
|---|---|
| Spec 1685 | No credit-bureau simulation |
| Spec 1867 | **No generic risk score** |
| Spec 25 | Do not model account age, account history or past defaults as inputs |
| Spec 25 | Stay simplified around utilisation, payment behaviour, debt load, income, assets, obligations |
| Spec 1381 | Credit should be **useful, not universally punitive** |

So **there is no number.** Credit is a standing — Excellent, Good, Fair, Poor,
None yet — and the arithmetic behind it never reaches a screen. That is the same
call 0209 made for a parent's mood: *"a parent page shows a mood ('Probably',
'Unlikely') rather than a percentage, because a child does not have a calibrated
model of their own parents."* A person does not have a calibrated model of their
own underwriting either.

Spec 1867 is what confirms this is the shape the spec wants rather than a dodge:
it rules out a generic risk score in the same breath as allowing *"credit
quality"* to be shown. A band is quality; 724 is a score.

**"Past defaults forbidden" and "payment behaviour required" is not a
contradiction.** A bureau records a default as a dated event that sits on a file
for seven years. Spec 25 asks whether you are *keeping up* — so trouble fades
linearly over six years and then counts for nothing at all. That is also the
only reading that satisfies "not universally punitive": one bad year at
twenty-two does not follow a character to sixty.

**No new save state.** Every input is already written down — the ledger records
what came in, what went out and every shortfall, each with a year on it. A
stored standing would be a second derivation of facts the save already holds.

---

## Measured before building

Across 100 played lives:

| | p10 | median | p90 |
|---|---|---|---|
| Income | $29,280 | $75,216 | $145,817 |
| Obligations | $21,700 | $65,065 | $144,189 |
| Obligations / income | 55% | 91% | 116% |
| Savings held | $20,140 | $131,052 | $436,978 |

Shortfalls: **3.4% of adult years, and 48 of 100 lives were short at least
once** — so payment behaviour has a real producer and genuinely varies.

Four of spec 25's six inputs exist today. Utilisation needs a card to be using
and debt load needs a debt, so both are named in `CREDIT_INPUTS_NOT_YET_BUILT`
rather than folded in as silent zeroes — a model that zeroed them would be
quietly asserting every character has perfect utilisation and no debts. A test
asserts the list, so 0306 and 0307 each have to delete a line.

## It has a consumer this ticket

`credit` came off 0304's `NOT_YET_OWNED` list, which is that list doing its job.
The dashboard row opens a Credit screen that says **why** — a band with nothing
under it is exactly the opaque score the spec dislikes, and worse, gives a
player nothing to act on.

---

## Three defects, and none came from a test

### 13.46 — a term that rewards the absence of activity

A character who **never takes a job** came out **Fair** — holding nothing,
earning nothing, owing nothing. They had never come up short, because 0303's
living phase contracts a household rather than letting a bill go unpaid. The
heaviest term in the model was handing out full marks for having no financial
life at all.

The record now counts only as far as there was something to keep up with — a
lender calls that a thin file, and a thin file is not a good file. After:
a life that never works is **95% "none", 5% "poor"**, and nothing else.

Every assertion about the term had been true. It was the *distribution* that was
wrong, and only a hundred played lives showed it.

### 13.47 — four reasons is a wall, two is an explanation

The screen listed every reason that crossed a threshold. A real played life at
nineteen read:

```
Poor
- You have no record to go on
- You do not earn much
- Your costs take nearly everything
- You have nothing put by
```

Four negatives, no positives, for the crime of being nineteen. Every line true
and the screen still wrong: a player cannot tell which of the four to act on, so
they act on none. Two of those lines also fired for nearly everybody, because
their thresholds were tuned against bars that later moved.

Capped at two a side, ordered by what actually moved the standing. Across 4,638
adult years it now averages **1.7 in favour and 0.65 against**, showing both
sides in 48% of years.

### The top band distinguished nobody

First pass put the income bar just above the median and savings at $60,000, and
**65% of working characters were Excellent at forty-five.** Both bars saturated
in an ordinary career. Set at the top of the distribution instead:

| | Excellent | Good | Fair | Poor |
|---|---|---|---|---|
| Takes work | 26% | 51% | 20% | 3% |
| At 22 | 0% | 60% | 40% | 0% |
| At 45 | 33% | 60% | 7% | 0% |
| Never works | — | — | — | 5% (95% "none") |

A median life passes through **four** distinct standings; 1 in 100 never moves.

### And two from the screenshot

A **fourth clipped subtitle** — mine, one row below the one I fixed in 0304 — and
"Where you stand" appearing twice on one screen. Balance, net worth and credit
are three answers to one question, so they are three rows of one card now.

## Follow-on

- `atLeast(standing, floor)` is the contract 0306 and 0307 get: a lender knows
  "better than fair", never "0.61".
- `none` is the bottom of the order, so a floor of "poor" correctly excludes a
  child — 0306 must refuse them a card for the right reason.
- Spec 26 says card availability also varies by employment and fame/status.
  Those are 0306's to weigh; standing is the credit-behaviour part only.
