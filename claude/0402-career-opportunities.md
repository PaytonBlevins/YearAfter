# Ticket 0402 — Career opportunities that arrive

0401 widened what a player may apply to. It did not change **who decides**: 345
of 356 moves onto a rung above 0 were still promotions, and a promotion is not a
decision — `phases/employment.ts` picks `promotionFrom(job)` and moves you.

Spec 1700 asks for "career opportunities". Spec 1230 lists an Opportunity event.
This ticket delivers one. It also found something much larger on the way in.

## The finding that reframed the ticket

Spec 1233 caps a year at "roughly 0–3 meaningful decisions" and warns that busy
characters must not be bombarded. So the first measurement was how full an adult
year already is. Across **4,257 adult years in 80 played lives**:

```
decisions raised in an adult year:  p10 0   median 0   p90 0   max 0
years with no question at all:      4,257  (100.0%)
```

Zero is the kind of number that is usually a broken harness, so it was probed by
age:

```
age  8   40 lives   33 decisions
age 12   40 lives   42 decisions
age 16   39 lives   32 decisions
age 20 … 84                     0
```

It is real. **The game asks a player nothing between seventeen and death.** The
cause is in the catalog: of 374 events, **25 can fire for an adult and all 25
are `passive`**. Every one of the 59 decision and opportunity entries carries
`ageMax: 17`. The file is called `events-childhood.json` and that is the literal
truth. `EventCategory` was childhood-shaped too — family, school, friendship,
random, talent — with no category for work.

So spec 1233 is not a constraint on this ticket. There is nothing to displace.
**0402 is the first arriving decision an adult has ever had in this build.**

## What an offer is worth

Across 4,279 employed years:

- **50.2%** had a better-paying job the character was eligible for that the six
  listings never showed them
- median raise of the best missed one: **$19,000**
- their real odds of being hired into it: median **0.46**
- **68.8%** of missed jobs are on a ladder they are already on — so an offer has
  merit to point at rather than needing a coincidence

## What shipped

**`packages/careers/src/offers.ts`** — the pure model. `offerChance(standing,
performance, yearsInJob)` and `offerFor(eligible, current, draw)`.

Three inputs and no fourth: whether your field thinks well of you, whether this
year went well, and whether you have been there long enough for either to mean
anything. Deliberately not a function of pay, ambition or luck — an offer you got
for being ambitious is one the player cannot work toward. It needs
`NOTICED_AT_STANDING = 58` and `SETTLED_FOR_YEARS = 2`, which makes this the
first thing Work Harder has ever bought that is not a promotion.

`offerFor` draws among the better-paying eligible jobs weighted toward the
better-paid rather than always naming the top one — 13.26, a row that says the
same thing every time is a row players stop reading.

**`packages/simulation/src/offers.ts`** — it arrives the way a decision arrives.
Pushed into `state.pending` as an ordinary `PendingDecision` and answered through
`decide`, with the structured payload beside it in `state.offer` because a
`PendingDecision` carries strings and `@yearafter/events` must not learn what a
job is to deliver one.

**This is why `decide` has a branch in it now**, and the branch is honest rather
than a shortcut. There are two kinds of decision in this build: authored ones
resolved out of the content catalog, and **systemic** ones a phase module raises
because something happened in a system it owns. 0405 will want the same door for
school. `EventCategory` gained `career` for the same reason.

The payoff of delivering it through the pending queue: **the app renders it with
zero UI changes.** Verified in the exported web bundle.

Save **v26**, with a migration that deliberately adds nothing — a save made
before offers existed was never asked one, and inventing a pending offer would
put a question in front of a player about a year that already happened.

### The rate, swept — and not on the median

| ceiling | median offers/life | p90 | never offered anything |
|---|---|---|---|
| 0.16 | 1 | 4 | **37.5%** |
| **0.24** | **2** | **5** | **25.8%** |
| 0.32 | 3 | 7 | 21.7% |

The obvious reading is offers per career, and by that reading 0.16 was fine. The
number that decided it is how many players never meet this feature at all: at
0.16 more than a third of lives never see the only question the game asks an
adult. 0.32 barely improves on 0.24 — the remaining fifth never reach
`NOTICED_AT_STANDING` and are supposed not to — while pushing a busy career to
eleven offers, which is the slot machine spec 1233 forbids.

## The price, and the fact that the documented one was wrong

An offer is only a decision if both answers can be right, so: paired seeds, the
same life lived twice, answering every offer the opposite way.

| across 176 offers taken | taking | declining |
|---|---|---|
| let go | 53 | 46 |
| **promoted** | **173** | **306** |

The designed cost — performance resets to a stranger's 38–52 — was worth **seven
extra firings across 176 job changes**. Inert. `firingChance` does not notice two
soft years.

The cost that bites was in the same table and nobody designed it: **taking an
offer costs about three quarters of a promotion**, because `since` resets and
`promotionChance` scales with years served. The real trade is *a raise now
against the ladder you were already on* — so the prompt was rewritten to say
that. A prompt naming the wrong price is worse than one naming none: a player
who learns "changing jobs is risky at first" from this build learns something
false and misplays every future offer on it. **CORE_RULES 13.60.**

### Is it a real choice?

| paired, 93 seeds | take | decline |
|---|---|---|
| net worth p10 | $52,207 | $55,457 |
| net worth median | **$317,803** | $255,569 |
| net worth p90 | $837,426 | $600,177 |
| ended richer | 70 (75.3%) | 23 (24.7%) |

Split by what was offered: mostly same-track offers were worth a median
**+$60,916** and taking won 50/64; mostly cross-track offers **+$21,837**, taking
won 20/29.

**Taking wins 75% of paired seeds, and that is allowed to be true.** An offer you
earned through standing should usually be worth taking, or it is a trap wearing a
compliment. It is not a coin flip and nothing in the code pretends otherwise.

## The guards

`packages/careers/src/offers.test.ts` (10) and
`packages/simulation/src/offers.test.ts` (7). Both harnesses deleted.

- **`offerChance` never exceeds its ceiling at any input** — swept across the
  whole domain, not three spot checks, because the ceiling is the number the
  rate was tuned on.
- **An offer never names a job the player could not have applied for.** Derived,
  and the guard that matters most: an offer is the one route into a job that
  does not go through `applyFor`, so it is the one place the gate could be
  walked past. Every job an offer named is re-judged against the same door.
- **Taking costs promotions** — the paired experiment, kept as an assertion. If
  that stops being true the prompt is lying to the player.
- **An offer arrives at all, and not to everybody.**

**Sabotage-verified, and it caught three vacuous tests.** With `withAnyOffer`
stubbed out, three tests still passed: each began `if (!state.offer) return
expect(life.offers).toBe(0)`, so the assertion that ran was that nothing had
happened — 13.51 with a different face. They now go through a helper that
searches seeds and **throws** if none produces an offer: *the setup is broken,
not the test*. Six of seven now catch the sabotage; the seventh is an invariant
that must hold either way.

## Still open

- **The adult event catalog is empty of decisions**, and this ticket only put one
  thing in it. Every authored decision and opportunity stops at `ageMax: 17`.
  That is now the largest single gap in the build.
- **Cross-track offers are barely distinguishable from same-track ones** in
  outcome (taking won 69% against 78%). The prompt tells the player which kind
  it is; the game does not yet make that distinction matter much.
- **Nobody ever resigns** in any harness, so "leaving a good job for a better
  one" outside an offer has still never been measured.
- The nine credential-gated jobs from 0401 remain unreachable. 0405.
