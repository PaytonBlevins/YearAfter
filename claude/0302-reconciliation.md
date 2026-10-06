# Ticket 0302 — Reconciliation

**Spec 1678:** *"opening cash + cash in − cash out = closing cash. Any mismatch
fails validation."*

0301 built the ledger and made `post` the only function that can move money.
0302 is the ticket that makes that claim **enforceable** — three checks, at
three different moments, each catching something the other two cannot.

---

## What shipped

### One structural fix, found by the opening audit

`continueAsChild` derived the heir's money **twice**: it set
`cash: state.player.cash` and separately built `inheritedLedger` from the same
input. Two derivations of one fact (CORE_RULES 13.23), agreeing only because
both happened to read the same source. Nothing was wrong today and nothing would
be until 0307 gives an estate a debt, or 0310 a pension — at which point one of
the two would learn about it and the other would not.

The ledger is now built first and the cash comes out of it:

```ts
const finance = inheritedLedger(state, heir.lastName, age);
// ...
cash: cashFrom(finance),
```

That was the only real bypass in the build. 0301's single-door design held.

### Three checks

| | Runs when | Catches | Cannot catch |
|---|---|---|---|
| **V18**, validator | Before anything is played | Cash arithmetic outside the ledger | A defect that never reaches source |
| **`advanceYear`** | Every committed year | A drift, and names its year | A save written by an older build |
| **`validateCurrentSave`** | Every load | A corrupt document | Anything, until somebody loads it |

**V18** targets the operation, not the word. All six pre-0301 producers had the
same shape — `add(state.player.cash, wage)`, `subtract(player.cash, fee)` — so
the rule looks for arithmetic on a cash field and exempts `@yearafter/finance`
and `simulation/src/money.ts` by path. It deliberately does **not** fire on the
many honest lines that mention cash: a type, a parameter, or a read into dollars
for an event context. A rule that fires on correct code is a rule somebody
deletes (13.35), so all four defect forms and all four honest forms were run
through it.

**`advanceYear`** throws on three conditions, each naming the year and the
amount in dollars. A throw rather than a repair: a ledger that silently corrects
itself hides the bug that needed correcting.

**`validateCurrentSave`** returns `corrupt` with a readable detail, per spec
1224–1246 — an unreadable save is an expected outcome, not a crash. It is also
the only place the `player.cash` mirror check means anything (below).

### Three properties, not one written out three times

- **`reconcile`** — the transactions add up to the balance. Anchored by
  `balance`, which `post` maintains independently.
- **`reconcileByYear().firstBadYear`** — no year closed below zero. Catches
  drift-then-clamp: a life that dipped $40,000 and climbed back ends on a
  correct balance and hides the decade it was wrong in.
- **`yearsOutside(ledger, from, to)`** — no row is stamped outside the life.
  The span comes from the caller, because a ledger cannot tell you its own years
  are wrong.

Each corruption in the test suite is chosen to leave the other two checks
perfectly satisfied. That is what makes them three checks.

---

## Two defects in my own work, both worth the write-up

### 13.41 — the first `reconcileByYear` was a tautology

It computed each year's opening, inflow and outflow **from the transactions**,
added them up, and checked the identity held. It held — and would have held for
every ledger that has ever existed, including a corrupt one, because all four
numbers came from the same rows. Opening + in − out *is* closing when you define
all four by summing the same list.

Rewritten to chain the years and compare the final closing against
`ledger.balance`, which is an independent record.

Then the **second** draft of the comment overclaimed in the opposite direction:
it said the walk caught a row stamped with a wrong year. It does not — the year
list is derived from the transactions, so a row stamped 19700 does not fall
outside the walk, it *adds a year to it*. `reconcileByYear(l).ok` is
arithmetically identical to `reconcile(l).ok`, and there is now a test asserting
exactly that, because the honest claim belongs where the flattering one was.

Catching the wrong-year defect needed an anchor the ledger has not got. That is
`yearsOutside`, and it is a third function.

**Ask what could make it false. If nothing can, it is a definition.**

### 13.42 — a test that hands the engine a state it refuses to act on

Three tests corrupted a ledger three ways and asserted `advanceYear` threw. Two
went red as intended. The third stayed green, and not because the check worked:
`advanceYear` returns early when a decision is pending, and that seed happened
to have an open question. The corruption was never examined.

The control test in the same file — *"lets an honest year through"* — would have
passed for precisely the same empty reason, and it is the test whose whole job
is to prove the others are not passing vacuously.

The helper now refuses to return a state with a question open or an empty
ledger, and says which. It also plays **until money has moved** rather than for
a fixed six years, because "play six years" was doing two jobs and only
announced when it failed at the first.

### And one carried over from 0301

`reconcile` was being called in `advance.ts` without being imported. It
type-checked in CI because that package's typecheck was cached. Found while
wiring 0302 — and it is the reason the wiring tests exist as their own file
rather than being folded into the finance package: the gap between "the function
is correct" and "the function runs" is real, and a test that only exercises
`reconcile` directly would have been green throughout.

---

## Where the mirror check went

`player.cash` is a mirror of `finance.balance`. The obvious place to check it is
`advanceYear` — and it is a **tautology** there. Both numbers come out of the
same `postYear` call and cannot differ. I wrote that check, watched it be
unfalsifiable, and moved it.

On a **save** they are two numbers that were serialized separately and can
genuinely disagree: a dropped field, a torn write, a migration that missed one,
or a build that had the bug this ticket prevents. That is where it lives now,
and there is a test that plants the disagreement and watches the save refuse to
load.

---

## Verification

- **Every check watched failing.** 10 tests in `packages/finance`, 4 in
  `packages/simulation` (the wiring), 7 in `packages/persistence` (the save),
  plus V18 run against four defect forms and four honest ones.
- **No false positives.** 200 lives, **14,267 played years**, zero throws.
- **Web export clean**, zero console errors in a played childhood.
- Full suite, typecheck and validator green.

## Follow-on

- `UNWRITTEN_CATEGORIES` still lists five: `housing`, `vehicle`, `debt`,
  `assetIncome`, `investment`. The list is asserted so it shrinks visibly.
- The year rows `reconcileByYear` produces are what 0304's dashboard reads.
- A `shortfall` row is what 0307's loan engine should look at rather than
  inventing its own notion of being short.
- The $22-date pricing bug is still open and belongs to **0303**.
