# 0604 — Business events and heirs

**Status: DONE (4 October 2026). No save bump (v39).** Fourth ticket of v0.06.
Spec 413, 414, 1200, 1222, 1392, 1952–1953.

## What it does

**Things happen to a business, with names.** Once a year at most, a business
has something happen to it, drawn by weight from nineteen events. About half
of all years are quiet (spec 413: "constant disasters should not be normal");
of the years with news, the good weighs about as much as the bad.

| good                           | bad                           |
| ------------------------------ | ----------------------------- |
| a big order                    | a slow stretch                |
| a good write-up                | something breaks              |
| regulars send friends          | a key person leaves           |
| a steady customer renews       | a supplier puts its prices up |
| a better price from a supplier | a bad run of reviews          |
| the landlord cuts the rent     | theft and damage              |
| a one-off job that pays well   | a dispute that costs          |
| a competitor closes            | a big client lost             |
|                                | the lease isn't renewed       |
|                                | the rent goes up              |
|                                | a rival opens                 |

Each does one or two of five things to the year: multiplies demand, the goods,
or the lease, adds a one-off cost (or brings money in) sized to the business
and its doors, and moves reputation by a few points once the year closes. Who
it can happen to depends on the trade: a supplier can raise prices only on a
business that buys goods, something can break only where there are fittings, a
person can leave or sue only where wages are a quarter of revenue (a shop whose
stock is the business doesn't have one).

The odds, not the damage, follow the world:

- A recession makes a slow stretch likelier (×1.25 in a slowdown, ×1.6 in a
  recession, ×2.2 in a severe one), fewer people open a rival and more shut
  one, and a big order is rarer. A boom does the reverse.
- A new business has less to fall back on: its bad draws weigh up to half again
  as much in the first year, fading over about four.
- Nothing happens in the part-year a business opens.

Drawn from the business's own id, year and the save's seed, so the same year is
the same year however often it's played and one business's news doesn't move
another's.

**A rival.** Spec 414: "competition matters, but should not be a huge/dominant
factor." One at a time. A rival takes 4–15% of the custom at the start, three
quarters of that the year after it opens, half the year after, a quarter the
year after that, and then it's spent. A good name keeps most of it (at
reputation 80 the loss is under half what it is at the opening name). How
often one opens, and how big a bite, follow how crowded the trade is, which is
computed from what it costs to get into on a log scale (a $20,000 cleaning
company is the most crowded; a $14 million resort the least) rather than typed
against thirty-one types, for the reason 0602 derived elasticity. A competitor
can also close, which is the good-news version.

**The economy, said out loud.** The demand effect of spec 1222's states has been
in the engine since 0601; the player never saw it. The ledger now records it,
and the business screen says "The economy took about 11% of your custom last
year" (or brought it). The year's lines say it when it took 6% or more, or brought 5% or more.

**Why last year went the way it did.** The business screen gets three rows when
they have something to say: what happened, the rival, the economy. A quiet year
looks quiet.

**An heir keeps the business.** At a death the businesses are, by default,
handed on rather than sold (spec 1200: families can have "long-lived
businesses"). The business is the same business: its till, crew, name in town,
doors, rival and lender all go with it, the lender included, so it goes on
paying the bank and the heir isn't asked to. What changes is the hands on it
from the next year, and the town's doubts about a new owner (reputation falls
the same four points as when one is bought). Not for a child: someone under 18
doesn't run a trucking company, and for them it's sold, the lender paid first,
the rest to the heir, as 0601 and 0603 had it. The end-of-life card asks
"Hand it on / Sell it" only when there's a business and an heir old enough.
"Invested" for an inherited business is its worth when it came to them. Other
debts are still dropped at a death (0508's).

## Calibration

Measured first, on the engine as 0603 left it, with a harness that owns each
type for ten years under a spread of economies and an owner who covers a loss
out of half the startup (300 businesses a type, 31 types):

|             | 1 year | 2    | 5        | 10       |
| ----------- | ------ | ---- | -------- | -------- |
| BLS         | 80%    | 69%  | 51%      | 35%      |
| 0603 engine | 96.3   | 88.9 | 81.5     | 78.5     |
| **0604**    | 96.0   | 87.7 | **78.7** | **75.3** |

Events cost a mature owner **under 1%** of pay on average, with a rival not
counted (0.99 of what it earned without them, from an even sweep of every
draw), and a rival adds a little to that. Pay five years in, against startup,
at the median: cleaning 2.38 → 2.07, café 0.31 → 0.28, law 1.50 → 1.40.

**What this didn't do, and why it's recorded plainly.**

1. **Survival barely moved, and I'm not going to force it.** Five-year
   survival is 81.5% → 78.7% where the BLS table says 51%. I tried the levers
   that would have closed it: more events, bigger losses, a lost-client event,
   a lost lease, scaling the base volatility down and then back, and the
   survival rate stayed in the high seventies to low eighties. A business in
   this game fails when its loss is more than its till and its owner can cover,
   and the margins on a typical trade are 10–25%. The BLS number counts every
   closure, including owners who simply stop, and this game doesn't quit for
   you. To hit 51% an ordinary trade would need unavoidable disasters, which
   is what spec 413, 414 and 1952 say not to have. The gap is the spec's tone
   against a table, and the spec wins. What does hit is the leveraged, the
   capital-heavy and the thin-margined: law, restaurant and trucking fall to
   62–74% at ten years.
2. **Profit still swings by about the same amount year to year (finding 37).**
   Among survivors the typical year-on-year change in profit is still about a
   factor of e (log sd 1.0–1.1, before and after). That is margin arithmetic: a
   10% swing in revenue is an 80% swing in profit on a 12% margin. What changed
   is that swings now have a cause the player can read. I tried shrinking the
   base volatility to take some of it out; it left survival and the swing
   where they were and moved the median demand of high-volatility types
   enough to break the price-slider test, so I took it out again.
3. **The cheap trades are still very profitable when they survive (finding
   38).** A $20,000 cleaning company still pays about twice its startup a year
   by year five. Competition is hardest on the crowded trades and the
   median fell 13%, but a six-person firm with $300,000 of revenue on a $20,000
   startup is a catalog proportion, not an event problem. Raising the startup
   of the smallest few types is the fix (a catalog change, and it moves the
   gate and 0603's literals); not done here.

## What broke, and why it was found

Three things the numbers and the mutation run found, not the first draft:

- **The people rule did nothing.** "A key person left" and "a dispute" needed
  wages to be at least 15% of revenue. Every one of the thirty-one types
  cleared that, so the rule excluded nothing, and a sabotage removing it
  survived. It is 25% now, which excludes the shops where the stock is the
  business (electronics, jewelry, furniture, clothing, specialty retail, real
  estate, vehicle rental), and a test asserts the line falls through the
  catalog.
- **The first set of events cost an owner about 7% of pay.** Bad events had
  bigger sizes than the good ones could repay. Rebalanced (smaller breakdowns,
  a bigger one-off job, a renewed contract) to 0.99 of what it earned.
- **An inherited business's "invested" was untested.** A sabotage keeping the
  parent's number survived; the test now pins it to the worth at inheritance.

## Not done, and why

- **A will, estate tax, or choosing which business goes to which heir** is
  0508's. All businesses go to the one heir who is carried on as, or none do.
- **A manager for a business the heir can't run.** A child's inheritance is sold.
- **Tax-loss offsets** against a salary (0601's gap) remain. A loss after
  interest does not reduce the tax on a job.
- **Finding 38** (see above) is open.
- **The end-of-life card and the business screen were not run on a device.**
  Typechecked only.

## Findings added

40. An heir who can't keep (a child) takes the sale and nothing is held for them
    when they come of age; whether a minor should inherit a business under
    management until 18 is 0508's call.
41. Raising the smallest startups (finding 38) would also change the net-worth
    gate and 0603's listing literals; decide with the catalog, not here.

## Tests

`finance/business-events.test.ts` (29, new), `simulation/business-events.test.ts`
(25, new), `persistence` +1; two death tests in 0601 and 0603 now ask for the
sale explicitly. Finance 289 → 318, simulation 491 → 516, persistence 78 → 79.

**Forty-nine sabotages, three passed first time** (the people rule that did
nothing, the unpinned basis of an inherited business, and a redundant guard
that turned out to be an equivalent mutation and was removed). Every other
mutation was caught the first time: the crowding scale, the rival ceiling,
the name's shield, a rival living an extra year or never fading or never
expiring or never closing or stacking, each of the four "can it happen to this
trade" rules, the event chance, the youth and economy weights, every modifier
(demand, goods, lease, a one-off and its sign and its sizing to doors), the
reputation change, the part-year, one key for every business, each field
written to the ledger, the lines for an event and for a downturn and a boom,
the rival state not updated, and the heir's side: a child keeping a business,
keeping only when asked, a new owner at no cost, every debt handed on, a
business kept and sold too, and not sold when sold.
