# Ticket 0310 — Retirement Benefits

**v0.03 Financial Life is COMPLETE.** 0301 through 0310.

**Save goes to v25.** No new workspace dependencies, so `pnpm install` is
optional.

**Shipped** as `83453a8` on `mac-lan`, working tree clean, validator green on
the Mac itself, web bundle verified.

907 tests across 14 packages, validator green at 10 catalogs / 842 content ids.

> The bridge was down at build time and the push failed three times; it landed a
> few minutes later once the Mac woke. Worth recording because 0309 sat
> unshipped for a day in exactly this situation. The check that works is
> verifying a file the ticket **adds** exists on disk — a clean tree looks
> identical to "up to date".

## The measurement changed what the ticket was

Spec 1695 asks for "employer match/contributions/pensions; roll into
Investments/Assets". Straightforward — until the population got measured.

| age | alive | still working | median cash | median pay |
|---|---|---|---|---|
| 40 | 96.7% | 100% | $158,702 | $60,403 |
| 55 | 90.8% | 100% | $166,175 | $91,200 |
| 65 | 83.3% | 100% | $155,687 | $103,547 |
| 70 | 71.7% | 100% | $162,307 | $112,001 |
| 75 | 47.5% | **100%** | $205,499 | **$126,789** |

**Nobody in this build had ever retired.** A seventy-five-year-old was still
clocking in and still getting raises. The cause was one clamp in
`capacityFor(stats, personality, age)`: it computed `(age − 8) / 8` bounded to
[0,1], so capacity rose until sixteen and was then **flat forever**. A
seventy-five-year-old had exactly the same capacity for work as a sixteen-year-
old. Working into your nineties was free, so stopping was strictly worse than
not stopping and the decision did not exist.

A retirement account in that world is a savings product bolted to a life nobody
ever stops living — CORE_RULES 13.7 in the mirror. So the ticket became three
things: something to build up, something to live on, and a reason to stop.

## The lever was inert, and the reason is the rule

Adding a capacity decline of 0.42 hours a year looked right and did nothing.
Verified against a control with the decline switched off:

| age | stress *with* | stress *without* |
|---|---|---|
| 65 | 9 | 2 |
| 70 | 13 | 1 |
| 75 | **23** | 1 |

Real — and worthless. **`RELEVANCE_THRESHOLD` in `@yearafter/stress` is 30**,
below which stress costs exactly nothing by design, so that an ordinary
childhood is never quietly taxed. The lever was moving a number the consuming
system deliberately ignores. Happiness read 81 against 82.

At 0.9 hours a year, still working against stopped at sixty:

| age | stress w/r | happiness w/r |
|---|---|---|
| 60 | 11 / 11 | 81 / 81 |
| 65 | 32 / 1 | 80 / 82 |
| 68 | 50 / 1 | 74 / 82 |
| 70 | 70 / 1 | **62 / 82** |
| 72 | 84 / 1 | **42 / 83** |

Working into the early sixties costs nothing; past sixty-seven it gets steadily
worse. **1.2 was tested and rejected** — it reaches a happiness of 25 by
seventy, which does not make retiring a choice, it makes carrying on impossible.
That is the same missing decision from the other side. **CORE_RULES 13.57.**

## And now it is a real trade

Eighty lives, each played five ways from the same seed, to death:

| plan | median worth | median happiness | final pot |
|---|---|---|---|
| never stops, saves nothing | $284,793 | **35** | $0 |
| saves 6%, never stops | $554,916 | **35** | $389,260 |
| saves 6%, stops at 65 | $343,963 | **81** | $199,598 |
| **saves 12%, stops at 62** | **$447,034** | **82** | $294,728 |
| saves nothing, stops at 65 | $48,820 | 81 | $0 |

Never stopping costs **46 points of happiness**. Stopping costs about
**$210,000**. Saving 6% roughly **doubles** what a character ends with, because
the match and the market are both real. And the best row does both — which is
spec 1375's "deliberate skilled play should meaningfully increase access to"
good outcomes, showing up in a measurement rather than in a claim.

## It makes two old promises true

`BENEFITS` in `@yearafter/careers` has advertised **"Retirement match, paid time
off"** on salaried and professional roles and **"Pension, and it is a real one"**
on government ones **since 0210**. Both were display strings with nothing behind
them for two milestones — CORE_RULES 13.36 (a field nothing writes is not state)
in copy form, and nothing ever failed, because a promise the game never keeps
still renders.

`BENEFIT_BY_TEMPLATE` is those strings honoured, and it is deliberately matched
to them rather than to a fresh idea:

| template | match | pension |
|---|---|---|
| salary | 50c on the first 6% | — |
| professional | 50c on the first 6% | — |
| management | 50c on the first 8% | — |
| government | — | 1.6% of final pay per year of service |
| performance | — | — |
| trade | — | — |

Performance and trade get nothing, which is not an oversight: their benefit
strings promise a cut of the business and overtime, and both already arrive as
pay. Inventing a match would make the advertised benefits wrong the other way.

## Design decisions worth not reversing

**The match is what pays for the lock.** CORE_RULES 13.50 says an instrument
that merely buys time is worthless here, because waiting is free — so a locked
account with an ordinary return would be strictly worse than the same money in a
fund. An instant 50% on the way in is what no fund offers. The cost on the other
side is real too, and 0308b measured it: a character holding no cash is locked
out of thirty-four stress-relieving events and ends at a happiness of 20
against 78.

**The account rides the real market**, including 0308d's crashes. A character
who retires the year after a crash feels it, which is the single most important
thing a retirement account can teach.

**The match never touches the bank**, so it gets no ledger row — posting it as
income and again as outflow would inflate the year's earnings by money that
never reached the character's hands. Reconciliation would still balance and the
dashboard would be lying. The employee's own contribution **is** a row, as an
`investment` transfer, for exactly the reason a share purchase is one.

**The contribution comes out of cash rather than pre-tax pay.** The one
simplification here, labelled rather than hidden: modelling pre-tax would mean
making `payBreakdown` in careers conditional on a finance concept, and the
effect across whole-year turns is a few per cent.

**It never gets its own line.** Spec 163 and 1851 both say retirement rolls into
Assets. `estateOf` folds the balance into `investments`, so every screen that
asks what somebody is worth gets the right answer through the one derivation
they all already use (13.23), and none of them has to learn retirement exists.

**Retiring is one-way.** A player who could un-retire every time the market
dipped would be playing a different game.

**The row is on the Career screen**, not two levels deep. Stopping work is a
career decision before it is a money one — and 0309 put advisors inside
Investments and the first thing that happened was somebody looking for them and
not finding them.

## The restated list, and the guard for it

`BENEFIT_BY_TEMPLATE` is keyed by a union **written out by hand** in
`@yearafter/finance`, because that package does not depend on
`@yearafter/careers` and adding the edge would cost everyone a `pnpm install`
for a type check.

A copied list is exactly what went wrong with `UNWRITTEN_CATEGORIES` in 0309, so
the guard is derived rather than pinned: a test in the simulation package — which
can see both — asserts that **every template any real job uses has a benefit**,
and that every benefit is for a template that exists. That cannot go stale the
way a copied list can.

## Where to find it in the app

**Career → Retirement**, in the "Elsewhere" card. The row's subtitle is live
state: what is in the account, what the contribution is doing, or why the Retire
button is not there yet.

The screen carries three things in the order a player meets them — what you
have, what you are putting in, and when you stop. The contribution is a stepper
across the full 0–15% range rather than a menu of three, for the reason 0308d
replaced the canned buy amounts.

## Still open

- Education has no clock (13.50). Unchanged.
- Card rewards are declared and never paid.
- `currentLocation` never changes.
- The v0.04 label on the five Mind & Body rows is a guess, not a decision.
- **Retiring frees capacity that nothing then consumes.** A retired character
  has hours and nothing to spend them on, because adult activities do not exist
  yet ("nobody over eighteen is an athlete"). Retirement currently buys the
  absence of a cost rather than the presence of anything. v0.08's sports engine
  and the adult activity gap are where that gets fixed.
- **v0.04 Career & Education Depth** is the next milestone: 49 jobs → 150–250,
  plus career opportunities that arrive rather than being applied for.
