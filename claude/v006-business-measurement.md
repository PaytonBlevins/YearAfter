# v0.06 Business & Advanced Wealth — measured before it was ticketed

The spec's block 6 is spec 393–413 (operations, catalog, display, demand,
pricing, hiring, events), 1356–1360 (the milestone), 1331 (the dashboard), 1392
(what performance depends on) and the Business & Entrepreneurship rules near the
end. It also asks for private investments (1383) and commercial real estate
(1708, moved here from v0.05 by 0503).

Before splitting it into tickets, I played 150 lives answering every question
the game asked and looked at who could start a business, with what money.

## What a life could put into a business

Liquid money is cash plus the portfolio plus the pension, in dollars, at the
end of each year. The "working" column counts a year with any earned income.

| age          | 20–24   | 25–34   | 35–44   | 45–54   | 55–64   | 65+     |
| ------------ | ------- | ------- | ------- | ------- | ------- | ------- |
| liquid p25   | 10,785  | 15,519  | 20,062  | 30,648  | 34,063  | 30,097  |
| liquid p50   | 22,093  | 35,716  | 54,005  | 74,682  | 88,921  | 93,965  |
| liquid p75   | 37,629  | 74,375  | 112,460 | 170,256 | 229,431 | 230,580 |
| liquid p90   | 65,183  | 147,096 | 232,553 | 283,900 | 380,767 | 365,664 |
| liquid p99   | 105,088 | 241,752 | 400,569 | 624,341 | 736,119 | 748,943 |
| ≥ $25,000    | 44%     | 62%     | 71%     | 79%     | 81%     | 80%     |
| ≥ $100,000   | 1%      | 19%     | 28%     | 40%     | 47%     | 48%     |
| ≥ $500,000   | 0%      | 0%      | 0%      | 3%      | 6%      | 6%      |
| ≥ $2,000,000 | 0%      | 0%      | 0%      | 0%      | 0%      | 0%      |
| earned p50   | 32,659  | 42,215  | 68,852  | 97,356  | 91,600  | 79,165  |
| earned p99   | 82,762  | 115,128 | 151,433 | 172,215 | 193,163 | 146,053 |

What that says:

- **A low-capital business is reachable by most lives, and a high-capital one
  by nobody.** The baseline has 62% holding $25,000 at 25–34 and about four in five
  from 45 onward; no life in this sample reaches $2,000,000 liquid. A hotel behind a wealth gate is a
  gate nobody opens, until a business, an investment or a creator income
  produces the money. That is what the spec wants: "extreme success is
  intended content", and these are the tickets that make it reachable.
- **There is no high earner to start from.** The top 1% earns $190,000 at its
  best. Anyone who builds real wealth will do it through the thing in this
  block, so the engine has to be able to build wealth, slowly, for the player
  who runs a good one, and not for a player who just opens things.
- **Nobody passive will own a business.** The first-choice answer never asks
  for one. Like landlording (finding 15), a business is a choice a minority
  make, so it has no door. The same goes for the rest of this block.

## What the real world says (to calibrate against)

| fact                                                 | figure                           | source                              |
| ---------------------------------------------------- | -------------------------------- | ----------------------------------- |
| Establishments still open after 1 / 2 / 5 / 10 years | 79.6% / 68.9% / 50.6% / 34.7%    | BLS, establishments born March 2013 |
| Firms with no employees                              | 81.9% of 34.75M small businesses | SBA Office of Advocacy FAQ 2024     |
| Firms with paid employees                            | 18.1%, 6.27M                     | same                                |
| Share of private-sector workers at small businesses  | 45.9%                            | same                                |
| Self-employed, 65 and over                           | 16.3% (2023), up from 13.0%      | same                                |
| Self-employed, under 30                              | 10.5% (2023)                     | same                                |

Two targets follow. A new business should have about an even chance of
reaching year five. Most of the failures are early: a fifth gone in the first
year, a third by the end of the second.

## Findings the measurement turned up that are not business

- **34. Everything that reads income has its own list of categories.**
  `incomeOf` (cards.ts) counts every positive non-debt row, which will include
  a business draw by itself, but `earnedIncomeOf` (vehicles.ts), `summary.ts`'s
  tax rate and the persistence migration that rewrites old salary rows each
  name `salary` and `commission` explicitly. A new income category has to be
  added to each, or a business owner's tax rate reads as zero and their car
  prices wrongly. CORE_RULES 13.90 again: a reader of a shared quantity has to
  measure the whole.
- **35. The whole of an income can be counted twice.** `incomeOf` counts the
  proceeds of selling a home as income. It has done since 0501, and it will
  count the sale of a business the same way unless 0601 keeps them apart. Not
  fixed here; the sale goes through a `property` transfer like everything else
  sold, and the underwriting quirk stays logged.

## The breakdown

| ticket                         | what                                                                                                                                                                                                                   | spec                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **0601 The business engine**   | Opening, supplier and COGS, a price slider, Low / Medium / High / Big Bucks payroll, automatic staffing, demand, brand reputation, profit, valuation and sale. A representative catalog of twelve. Assets → Businesses | 393, 398–400, 404, 849–878, 1356 |
| 0602 Catalog and expansion     | The rest of spec 396's list, a real wealth gate, expanding a business                                                                                                                                                  | 396, 912, 1356                   |
| 0603 Business finance          | The `business` loan type 0307 left open, buying an existing business, acquisition economics that stop scale exploits                                                                                                   | 1857, 1392                       |
| 0604 Business events and heirs | Weighted events tuned for fun, competition that never dominates, the economy's effect on demand, a business at a death                                                                                                 | 413, 1392, 1222                  |
| 0605 Private investments       | Large returns that can fail or lock the money up, opportunity capacity, scaled to wealth                                                                                                                               | 1383, 1860                       |
| 0606 Commercial real estate    | Retail, office and warehouse space, integrated with 0503's landlord                                                                                                                                                    | 1708, 1863                       |

0601 takes valuation and sale because an engine without a way out is a trap. It
takes a representative twelve rather than the whole catalog because the spec
says "start with a representative business catalog and expand".

A decision recorded for the whole block: the spec's repository sketch lists
`packages/business`, but vehicles (spec's `packages/assets`) went into
`finance`, `content` and `simulation`, and a new package is a lockfile change
on every machine. The business engine does the same.

## What 0601 turned up afterwards

Calibration, not measurement, so it lives in `0601-business-engine.md`: survival
at five years comes out around 81% against 51% (BLS), because nothing yet puts
competitors or a lost lease into a business's life. 0604 subsequently added
those causes; its measured gap is recorded below rather than forced. Finding 36
(`advanceYear` is not pure over its state) was found while testing and is in the
roadmap.

## Measured again for 0602: net worth, not cash

150 lives, net worth (cash + portfolio + homes + cars + valuables + business,
less debts), dollars, at the end of each year:

| age          | 20–24   | 25–34   | 35–44   | 45–54   | 55–64     | 65+       |
| ------------ | ------- | ------- | ------- | ------- | --------- | --------- |
| p50          | 29,797  | 51,009  | 105,672 | 237,996 | 376,100   | 499,563   |
| p90          | 69,748  | 139,935 | 278,120 | 494,757 | 737,497   | 948,116   |
| p99          | 123,497 | 231,403 | 393,454 | 696,533 | 1,017,667 | 1,267,864 |
| ≥ $500,000   | 0%      | 0%      | 0%      | 10%     | 35%       | 50%       |
| ≥ $1,000,000 | 0%      | 0%      | 0%      | 0%      | 1%        | 7%        |
| ≥ $3,000,000 | 0%      | 0%      | 0%      | 0%      | 0%        | 0%        |

A typical 35–44-year-old (about $105,000) sees businesses opening at up to
$175,000. Nobody without a business reaches the manufacturing, trucking or
rental tier ($900,000 and up), the resort ($14 million) or the hotel ($5.2
million): they are for the person a smaller business made rich, which is what
the spec means by "extreme success is intended content". 0603 (business loans)
is what makes a step up possible without already having the cash.

## Measured for 0603: what a loan does to a life

Eight lives, bought at thirty-five and followed to fifty-five (`0603` doc has the
whole table). Of the six that had a business they could afford, five finished
ahead of the same life that never bought, one behind, and a chain of purchases
(three businesses, a loan for each) beat the control in five lives of eight,
lost in three and went to −$298,000 in one. That is the shape spec 949 asks for.

The first version of the loan, serviced from the owner's wages, put owners into
arrears for eleven to twenty-four of the next twenty years. The business holds
the till, so the business pays: the same lives went from −$129,980 to +$387,857
at forty-five.

What is for sale, over 200 draws a type: the asking price is 1.06–1.16 times
what the formula values the business at, the seller's reported profit is
10–28% of the ask, it pays back in 3.5–10 years, and the first year under the
buyer earns 82–92% of what the books said. The smallest trades are priced at
3–13 times their startup (finding 38), which is 0601's margins showing, not a
mistake in the pricing.

## Measured for 0604: events, a rival, and the gap that stayed

Thirty-one types, 300 businesses a type, ten years, a spread of economies
(8% strong expansion, 17% growth, 50% normal, 12% slowdown, 9% recession, 4%
severe), and an owner who covers a loss out of half the startup.

|                         | 1 year | 2    | 5    | 10   |
| ----------------------- | ------ | ---- | ---- | ---- |
| BLS                     | 80%    | 69%  | 51%  | 35%  |
| 0603 engine             | 96.3   | 88.9 | 81.5 | 78.5 |
| with events and a rival | 96.0   | 87.7 | 78.7 | 75.3 |

The gap to BLS did not close. Four things were tried to close it (more
events, larger losses, a lost-client event, a lost lease) and survival stayed in
the high seventies to low eighties, because failing here means a loss bigger
than the till and the owner's cover, and typical margins are 10–25%. BLS counts
owners who stop. Closing it would take unavoidable disasters, which spec 413,
414 and 1952 say not to have.

What did move: law, restaurant and trucking at ten years (70% → 62%, 89% → 82%,
76% → 71%); the median pay five years in (cleaning 2.38 → 2.07 times its
startup); and the share of years with news (about half), with good and bad
about even (the bad share is 30–62% for every type). A mature owner's pay with
events averaged in is 0.99 of what it was.

Year-on-year change in a survivor's profit is a log sd of 1.0–1.1 before and
after, so the swing is not smaller, only explained.
