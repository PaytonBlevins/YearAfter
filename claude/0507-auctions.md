# Ticket 0507 — auctions

Spec 41 (two general houses, each up to twice a year, with separate stock and
independently varying credibility; a storage-auction area visited several
times a year; high-end / private sales for the wealthy; "auction credibility
varies randomly"), 1899 ("hidden/descriptive credibility"), 1390 ("bargains
are possible but repeated instant buy-resell profit should not be
guaranteed") and 1478 (soft wealth bands, well below billionaire).

## Measured first

There was nothing to buy at auction, so the measurement was of the design.
Synthetic, 40,000 lots per cell, before a line of the sale was built:

- **The problem.** With the room's top bid centred on what a lot is worth,
  bidding low makes money. The bids that win are, by definition, the ones the
  room let go cheap. A careful bid at a good house made +11% on every win.
- **The fix.** The room's top bid now centres 20% over what a lot would fetch
  (spread 0.25), and there's a 25% buyer's premium. A careful bid at a
  well-regarded house wins about one lot in eleven and makes about 4% on it,
  around a third of a percent per lot looked at. Every other bid at every
  other house loses money on average.

## What was built

**Four venues** (`auctions.json`):

- **Hartwell & Finch** and **Crane Brothers Auctioneers**, the two general
  houses: two sales a year each, five lots a sale. Lots come from 0506's
  valuables catalog, plus a car from 0504's catalog about one lot in five.
- **Lock & Key Storage Auctions**: six sales a year, three units each.
- **Ashcombe Private Sales**: two a year, four lots, behind a $1,000,000
  hidden gate. It sells the dear end of both catalogs (blue-chip art, sought
  watches, exotic and classic cars), and one lot in 500 is a legend.

**A sale is derived, not stored.** The only thing written is the diary: sales
attended this year, which enforces spec 41's limits, and lots bid on, so
nothing is bid on twice. The lots of a visit come from the seed, year, venue
and visit number. Everybody else's top bid is drawn from a key, so looking at
a lot never changes it.

**Credibility** is the house's standing this year, the same for every life,
and shown as a phrase: "Well regarded", "A decent reputation", "Mixed
reviews" or "People talk". Lower standing means more fakes (1%, 3%, 8%, 15%)
and estimates printed fatter (+0%, +8%, +18%, +30%). The private room is
always well regarded.

**A bid is a tap, not live bidding.** A lot opens three buttons, each showing
how far it goes:

- "Bid carefully": 85% of the estimate's middle.
- "Bid to the estimate".
- "Go after it": 130%.

You win if the room would have stopped below your limit. You pay where it
stopped, plus the premium (25%, or 10% at the storage yard). You can't raise
a paddle you couldn't pay for.

**What you win:**

- **A piece** goes into the collection. A fake is found out the next year
  ("An appraiser looked at the Qing dynasty porcelain vase. It's a
  reproduction."), drops to 5% of its value, and is shown as a reproduction
  from then on.
- **A car** goes into the garage. One sold by a house people talk about may
  hide a defect that comes out in the first year.
- **A storage unit** is a size and what you can see from the door ("A couch
  on its end, boxes, and a tarp over something square."). Win it and the junk
  is sold off as a lot. Its median is well under what units usually go for,
  with a long tail above. Two to five percent of units, by size, hold a piece
  worth keeping, capped by the unit's size. One in about 3,000 holds a legend.

**Money.** Winning is a `property` transfer, like buying in a store. A
storage unit's junk sale is a second `property` row, coming back in.

**Screens.** Shopping gains an Auctions section listing each venue and the
sales left this year. A venue shows its standing, sales left and the premium,
then "Go to the sale". At a sale you see the lots with their estimates, or
"about $X" for a storage unit. Tapping a lot opens its three bid buttons, and
the result arrives as a card ("Sold — to you" / "Outbid"). Collections now
mark a reproduction as one.

Save **v37**: the diary, and a valuable's `fake` and `reproduction`. All new
and optional; the migration only bumps.

## Results

200 simulated years, every lot at every venue bid on at every tier (`auctions
.test.ts`). Return per lot looked at:

- **Careful bids:** a well-regarded house is within ±2%; private sales and
  storage under +2–4%.
- **Fair bids:** lose money everywhere.
- **Determined bids:** lose more than fair, everywhere.
- **A house people talk about** loses at every tier, careful included.

## Tests

- `finance/auctions.test.ts` (8): credibility in words, getting worse in step
  and varying; paying where the room stopped plus the premium; each tier
  reaching further; fatter estimates at a doubtful house; the room drawn once
  and centred over value; storage units that usually disappoint, with a tail.
- `simulation/auctions.test.ts` (11): two general houses, a yard and a private
  room with spec 41's limits; the gate; standing that varies by house and
  year; visits counted and reset next year; the same lots however often you
  look; one bid a lot, never past what you could pay; the economics above;
  a fake found out the next year with a line; a car into the garage; a unit
  emptied.
- `content` (+1) and `persistence` (+1): the venues; the diary and an
  unrevealed fake round-trip, and a v36 save carries forward.

**Sabotage:** thirteen pieces were broken on purpose, and every one fails a
test.

**Full gate: 1,219 tests, typecheck clean, validator green (16 catalogs, 1,449
ids).**

## Still rough

- **Selling at auction isn't built.** Spec 1893 keeps one sale button, so a
  piece is sold where it's sold. Putting your own things into a sale, with a
  seller's commission, could be a later choice.
- **Nobody passive goes.** Deliberate, like shopping.
- **Credibility is a world fact,** the same for everybody in a year. A
  reputation that responded to what the player saw (a fake found, a good
  buy) would be richer.
