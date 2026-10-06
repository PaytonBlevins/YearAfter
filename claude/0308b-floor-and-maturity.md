# Ticket 0308b — Bond maturities, and the floor

Commits `effb1d9` (measurement) and `3ef9940` (the fix). No save change —
still v22. 234 simulation tests, 135 finance tests, 29/29 tasks, validator green.

This was meant to be the bridge between the investment system and 13.52's
deadline gap. It found that the floor already existed, that the rule describing
its absence was wrong, and that the real defect was a subsidy pointing the other
way.

## Bonds have a date

The first instrument in this build where money is genuinely away until a date.

- Government bonds run **8 years**, corporate **5**.
- On the date the principal comes back as cash at **what it is worth**, not at
  what was put in. Redeeming at face value would silently delete every coupon
  and every point of market movement it earned on the way.
- Leaving early costs **12%** (`EARLY_EXIT`) — the discount a secondary buyer
  demands, and the only reason a term is a decision rather than a label. Without
  it a ten-year bond is an eight-year bond you can leave whenever.
- Topping up **resets the clock**, because adding to a bond you hold is buying a
  new one. Keeping the earlier date would let a player run a permanent
  eight-year bond that matures next year.
- A matured principal posts as an `investment` row, not `assetIncome` — it is
  money coming back across the line it went out on (spec 44-46). Calling it
  income would tell the dashboard a character earned $80,000 the year their bond
  came due. The coupon is income and stays where it was.

## The subsidy: one mistake, made twice, three lines apart

13.53 measured that a character who invests every spare dollar spends **$430,000
less** on a lifetime of living than one who never invests, and ends up twelve
times richer. Being broke paid.

The cause was two functions reading the same badly-named field:

```ts
standardTargetFor(input.afterTaxIncome, input.wealth)   // what life you drift toward
const affordable = input.afterTaxIncome + input.wealth  // what you can pay for it
```

`wealth` was the **cash balance**. So a character with $2,000,000 in an index
fund and an empty current account was treated as destitute by both: they drifted
toward the standard of living of somebody with nothing, *and* got 0303's
hardship cap on what they were charged.

Fixing only the affordability test moved the gap from $430,000 to **$189,251**
and stopped there. Fixing both took it to **-$183,925** — the all-in player now
spends *more*, which is right. A millionaire lives like a millionaire wherever
they keep it.

| | lifetime living | net worth (med) | happiness | subsistence yrs |
|---|---|---|---|---|
| never invests | $2,546,159 | $201,238 | 78 | 4% |
| keeps a buffer | $2,604,554 | $705,403 | 78 | 3% |
| invests every dollar | $2,730,084 | $1,418,485 | 23 | 3% |
| all into bonds | $2,556,281 | $597,716 | 20 | 3% |

**The destitute character is untouched.** Their portfolio is zero, so 0303's
hardship cliff still catches them. A test asserts it, because widening who gets
charged in full is exactly how the original unpayable-bills defect would come
back — the one 0303 measured at 5,789 of 5,789 adult years in shortfall.

## The floor was already there, and 13.52 was wrong about it

0308's 13.52 concluded that being broke is free, from two signals: `shortfall`
years at 0% and card-debt years at 0%, across 800 lives. **Both are zero by
construction.** 0303's hardship branch caps the year's charge at what the
household has, so a shortfall can never be written; the card draw is computed
from that already-capped figure, so a card is never asked for. Eight hundred
lives of evidence for a proposition no number of lives could have disconfirmed.

What being broke actually costs, traced this ticket: **`cashAtLeast` gates
events, and 34 of the gated ones relieve stress** — the arcade, going out, small
treats. An empty account locks a character out of all of them, stress
accumulates unrelieved, and stress costs happiness. Median happiness runs **78**
for a character who keeps a buffer against **20** for one who does not.

Nobody designed that as a floor and it is a good one: being broke does not bill
you, it shuts you out of the things that make a life bearable.

The deadline half of 13.52 still stands — waiting is free, education has no
clock, and no instrument that buys time is worth its interest. Bonds are now the
one exception, and only for the money inside them.

## New rules

- **13.53** — running out of money was a discount; and a zero you did not derive
  is not a measurement. A large sample makes a broken metric more convincing,
  not less.
- **13.54** — ask which account a rule reads, not just which number. A variable
  named for a quantity hides where it came from, and a fix that moves a number
  partway is usually the same bug at a second call site.

## What this changes for 0308c

The catalog work is unaffected — this was all engine and living-phase. Two
things it hands forward:

- **Bond maturities are now real**, so when bonds become named issuers with
  3–10 year terms in the catalog, the mechanic behind them already exists and is
  tested.
- **The liquidity decision finally has teeth.** Selling to cover a year is now
  something a player does rather than something the game quietly did for them,
  which is what the Investments screen's sell flow is for.

## Still open

- Education has no clock (13.50). Unchanged, and still the reason loans are
  dominated.
- Card rewards are declared and never paid.
- Weddings, rings and adoption still priced `min(price, cash)`.
- `currentLocation` never changes.
- The happiness mechanism is load-bearing but accidental. Worth deciding whether
  to make it deliberate — right now the main cost of a bad financial strategy
  runs through event gating nobody wrote for that purpose.
