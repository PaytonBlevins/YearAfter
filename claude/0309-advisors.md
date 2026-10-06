# Ticket 0309 — Advisors

**Save goes to v24.** No new workspace dependencies, so `pnpm install` is
optional (it will be a no-op).

**Shipped** as `761e944` on `mac-lan`, working tree clean, web bundle verified.

857 tests across 14 packages, validator green at 10 catalogs / 842 content ids.

## Where to find it in the app

**Finance tab → Investments → the "Advice" section**, which is the second block
on the screen, directly under the portfolio. The row reads *"Nobody is advising
you"* until somebody is hired, and after that it shows the advisor's name, this
year's fee, and their first recommendation as its subtitle.

The Investments hub is also reachable from **Assets → Investments** (wired in
0308d). Both doors land on the same screen.

## It did not ship the first time, and the failure is worth recording

The bridge to the Mac dropped during the push, exactly as it did between 0308b
and 0308c. I told the user the tarball was in the chat and that I would push it
when the bridge returned — and then the session ended without pushing. He
extracted nothing, reasonably believed he had shipped, and went looking for a
screen that was not on his machine. The repo sat at `9292d67` with a clean tree.

**A clean tree is not evidence that a push arrived.** That was the lesson
written down in the 0308c doc and it did not stop the same thing happening
again, because the check has to run at the *end* of a ticket rather than at the
start of the next one. The test is whether a file the ticket adds exists —
`packages/content/data/advice.json` here — and it belongs in the shipping
routine, not in a document.

## The constraint that shaped everything

Spec 1383: advisors may recommend Buy, Hold, Reduce, Sell and Rebalance,
"including crypto", and **"better advisors improve quality but never guarantee
prediction"**.

That second clause is a constraint on a number nobody had measured. A
recommendation engine is the easiest place in a game to build an oracle by
accident: if doing what you are told is reliably right, the investment screen
collapses into one button and 0308c's eighty-nine instruments become scenery.
So the measurement came first, and it came out against the obvious design three
separate times.

## Finding 1 — the obvious advisor rule is actively harmful

"Recommend what is trading below its own trend" is the natural design, and
0308d's mean reversion is the exact mechanism that should make it pay.

Measured over 6,000 market years, **it loses to a coin flip**:

| picked by | single call goes up |
|---|---|
| drift (hidden fundamental) | 65.0% |
| **cheapness (below trend)** | **41.9%** |
| at random | 56.0% |

The cause took a second experiment. Reversion is applied to stocks and funds and
deliberately **not** to crypto or penny stocks, because those have no value to
revert to. A name sits far below its anchor mostly because its spread is
enormous — and the two widest tiers are the two exempt ones.

> **The naive top six was 94.2% crypto and penny stocks.**

The signal was selecting precisely the names where the thing that makes it work
does not run. Restricted to the reverting tiers:

| | mean year | beats random |
|---|---|---|
| cheapest, all tiers | 5.1% | 45.5% |
| **cheapest, reverting tiers only** | **11.4%** | **63.7%** |
| random | 6.4% | — |

Same rule, opposite sign, one filter apart. **CORE_RULES 13.56.**

## Finding 2 — tiers cannot be built on a hidden fundamental

The first plan was that a better advisor reads `drift` more accurately. Swept
from no skill to perfect:

| skill | mean year | single call goes up |
|---|---|---|
| 0 | 6.3% | 60.2% |
| 0.25 | 7.0% | 62.0% |
| 0.5 | 7.2% | 62.1% |
| 1 | 7.4% | 61.5% |

Drift spans 0.02–0.082; volatility spans 0.12–0.95. Across one year the
fundamental is a rounding error, and a tier built on it would have been a label
with nothing behind it — one that would have passed every test that did not
compare it against a control.

## Finding 3 — market timing is not advice

Buying after a recession year returns **−4.5% over the next year**, even though
0308d measured the same move at 2.32x over ten years. Both are true. The advisor
runs on a yearly cadence, so the one thing a player most expects from an advisor
is the one thing this market cannot support at that resolution. It makes no
timing calls.

## What the advice is actually worth

The first three versions of this harness measured advisors against "everything
into one broad fund" — and lost, every time, because a fund is already maximally
diversified with the lowest volatility drag on the board. That is the wrong
question. A plain-fund player does not hire an advisor; the player this system
exists for is the one **picking**, which is what 0308c's market screen invites.

500 lifetimes, $10,000 a year, forty years, same seeds:

| | p10 | median | p90 | beats picking alone |
|---|---|---|---|---|
| one fund, forever *(reference)* | $1,172,494 | $2,186,898 | $3,519,176 | 70% |
| picks their own, no advice | $541,521 | $1,311,785 | $3,334,581 | — |
| buys whatever is priciest | $121,081 | $645,702 | $6,092,935 | 36% |
| **picks, plus the bank planner** | **$843,392** | **$1,721,232** | $3,450,664 | **87%** |
| picks, plus the independent | $765,561 | $1,710,810 | $3,477,019 | 86% |

Advice adds **31% at the median and 56% at the floor**, and comes out ahead in 87
of every 100 lives. Almost all of that is the boring half — being told you hold
too much of one sector, or too much with no floor under it.

**And a plain index fund beat every advisor.** That is true in real life too, and
it is printed on the hiring screen, because a game that charges for something
should say what the something is worth.

## The wealth manager was built and cut

A third tier existed at 40 basis points. Across the same 500 lifetimes it
returned **1.23x a stock-picking player against 1.31x for the FREE planner** —
strictly worse, at a fee. Every attempt to give it a mechanism failed:

- **Spotting an opportunity sooner did nothing.** Moving its threshold from 0.18
  to 0.38 changed the forty-year outcome by zero, because the best opportunity
  in a year is either glaring or absent and no bar in between discriminates.
- **More calls made it worse**, because the extra calls are the weaker ones and
  each is another single name where a fund would do.
- **A tighter leash moved the floor from 1.40x to 1.42x.** Real, and not worth
  double the fee.

This market contains one edge and the free advisor already captures it. A tier
whose only genuine difference is a larger fee is a worse deal in a nicer suit —
the "system nobody should ever use" mirror of CORE_RULES 13.7. What a wealth
manager would actually have to sell is **access** (spec 1860: "private
investment opportunities scale with wealth and may be illiquid or fail"), and
that arrives with v0.06. It comes back then, with something to offer.

## How it stays honest

Three things, and none of them is a disclaimer:

**Every recommendation carries its reasoning.** Not "Buy Halcyon Systems" but
"Halcyon is trading a third below where its own history says it should sit." A
player can disagree with that. Nobody can disagree with a verb.

**Facts and forecasts are labelled as such.** Five of the seven reasons are
statements about what the player already holds and are never wrong; two are
predictions and are wrong about a third of the time. Each row says which it is.
Facts are always ordered first — a player with 80% in one sector has a problem
no stock pick can outrun.

**The track record is on the same screen, and it is derived.** Because a
recommendation is a pure function of prices and the save already carries twelve
years of history, `howTheyHaveDone` replays what the advisor *would* have said in
each past year and scores it against what happened. No new save field, no
migration, and it cannot flatter itself — it is the same code path that makes
today's calls. A test asserts that across enough histories the record reports
both hits **and misses**; an advisor who is never wrong is an oracle.

## Two defects found on the way

**`UNWRITTEN_CATEGORIES` had been lying for two milestones.** It still listed
`assetIncome` and `investment` as having no producer, when 0308 gave both of them
one. The test guarding it asserted the array *equalled* four specific names, so
it passed the whole time — **CORE_RULES 13.51, in the file next door to where
13.51 was written.**

The fix was a derived guard, and the first attempt at it was **vacuous**: the
check went into `ledger.test.ts`, where no life ever buys anything, so no
investment category could appear however wrong the list was. Found by putting
`assetIncome` back and watching the suite stay green. A category is only
reachable where somebody reaches it; the guard now lives in `investing.test.ts`
where a character actually invests, and it has been verified to fail.

**The position sizing, not the picks, was the bug.** The first version left
`amount` off the buy forecasts, so a player following the advice put every spare
dollar into one name — forty years of that returned 0.90x a fund benchmark. Same
defect as 0307's "pay some off" button that spent the whole balance: an
instruction that says SOME and moves EVERYTHING. A stock idea now asks for a
third of spare cash, and the size is part of the advice.

## What shipped

- `scripts/generate-advice.py` — 45 advice lines across 7 reasons, 2 advisors,
  and a self-check that asserts the free one cannot forecast, that the ladder
  tightens as the fee rises, and that no reason has lines without a reader.
- `packages/finance/src/advisors.ts` — the signals, the recommendation engine,
  the fee, and the replayed track record.
- `packages/simulation/src/investments.ts` — hire, dismiss, this year's advice,
  and acting on one.
- `apps/mobile/src/screens/AdvisorScreen.tsx` — the hire list with the real
  numbers on it, the recommendations with their reasoning and forecast labels,
  and the track record.
- The fee is charged in `advanceYear` as an ordinary ledger row with the
  advisor's name on it, counted toward what the year owes, so a character who
  cannot cover it draws on a card like they would for rent.
- Save **v24**: `advisorId`, absent by default. The fourth migration in a row to
  refuse to invent a decision — 21 gave nobody a loan, 22 gave nobody a
  portfolio, 23 refused to refund one to cash, and this one hires nobody.

## Still open

- **The advisor sits two levels deep**, inside Investments. Defensible while it
  only advises on investments; worth revisiting when 0310's retirement accounts
  give it a second thing to talk about, since it would then belong beside
  Investments rather than inside it.
- Education has no clock (13.50). Unchanged.
- Card rewards are declared and never paid.
- `currentLocation` never changes.
- The v0.04 label on the five Mind & Body rows is a guess, not a decision.
- **0310 Retirement Benefits** is the last ticket of v0.03.
