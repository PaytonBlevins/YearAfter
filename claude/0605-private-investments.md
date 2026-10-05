# 0605 — Private investments

**Status: ENGINE DONE (4 October 2026); independent sabotage pass DONE (5 October). Save v40.
Screens and deal wording belong to the second agent and are open.** Spec 1383, 1140, 1860, 1233, 912.

## Measured first

Passive lives (first answer to every question), 400 lives, liquid money =
cash + portfolio, whole dollars, on the build as 0604 left it:

| age | n   | p25    | p50     | p75     | p90     | p99     | ≥$50k | ≥$100k | ≥$250k | ≥$500k | ≥$1M |
| --- | --- | ------ | ------- | ------- | ------- | ------- | ----- | ------ | ------ | ------ | ---- |
| 30  | 398 | 18,058 | 38,660  | 76,967  | 140,829 | 230,642 | 41%   | 16%    | 0%     | 0%     | 0%   |
| 40  | 395 | 19,342 | 46,019  | 97,899  | 177,559 | 399,953 | 48%   | 24%    | 6%     | 0%     | 0%   |
| 50  | 389 | 33,391 | 77,939  | 165,762 | 272,192 | 461,176 | 61%   | 42%    | 12%    | 1%     | 0%   |
| 60  | 376 | 40,049 | 107,524 | 240,454 | 358,977 | 705,443 | 71%   | 51%    | 24%    | 5%     | 0%   |
| 70  | 332 | 22,842 | 86,600  | 240,122 | 420,091 | 772,926 | 60%   | 45%    | 24%    | 6%     | 0%   |

Net worth runs about twice liquid money at 50 (p50 $200,745, p99 $653,684).
What that means for the catalog: **a passive life reaches the bottom two rungs
and nothing above them.** Nobody passive holds $1M liquid at any age, and
$500k only after 50 and only 1–6% of the time. The top rungs (growth company,
fund) will be seen by people who built wealth some other way (a business, a
good career); that is spec 949's "materially more attainable through strong
play", not a bug.

Real-world anchors (fetched this session):

- Angel Resource Institute, 245 completed angel exits: just under 70% returned
  less than 1x, just under 10% returned 10x or more, mean 2.5x, median below 1x,
  mean hold 4.5 years; 10% of exits produced 85% of the cash.
- MSCI: venture holding age reached 5.4 years in 2024, the longest on record;
  private credit has outperformed private equity.
- Private-equity funds run about ten years (Goodwin Law, not read in full).
  The non-startup kinds are set to plausible average yearly returns (8–12%) and are
  **product-judgment proposals** — flag them if any feel wrong.

## Design (proposed; Payton to confirm the starred items)

Six kinds in `content/src/deals.ts`: early-stage startup, private loan, stake in
a local business, property syndicate, growing private company, private fund.
Minimum cheques $5k / $10k / $25k / $25k / $100k / $250k; shown when liquid money
is three cheques (soft band, spec 1140).

- **Offers** are derived from the seed and the year, up to `MAX_OFFERS = 2`,
  half of years bring any (`OFFER_CHANCE`). Nothing about them is saved.
- **Capacity** (spec 1383): a round is a multiple of the minimum cheque; one
  person may take at most `maxShareOfRound` of it and `MAX_SHARE_OF_LIQUID` (half)
  of their liquid money. A tiny deal can't absorb a fortune.
- **Lock-up:** money is away until `matures`. Kinds with `canSellEarly` can be
  sold on after a year at `SECONDARY_DISCOUNT` (35%) off; startups, growth
  companies and funds cannot.
- **Outcome fixed at the cheque** (drawn from the seed, the deal id and the year;
  a reload cannot reroll). The screen shows the cheque until the deal ends. Lending
  pays 9% a year as it goes; a default (4%) stops it and returns 0–50%.
- **Failure is real** (spec 1383) but not constant (spec 413's tone): the startup
  table loses money 70% of the time because that is what the data says, and pays
  10x or better 10% of the time.
- **Economy** shifts the odds at the end: a recession lowers the good outcomes'
  weight and can delay an exit a year (engine commit decides the size).
- \* **Net worth** counts a live deal at its cheque (not its hidden outcome). A
  write-off hits net worth only when it happens.
- \* **A death** with live deals sells them on at the secondary discount, whatever
  the kind, and the proceeds are the estate's (like a child's inherited business
  in 0604). An adult heir does not keep them.
- \* **Out of scope here:** the Investment Firm and Private Lending Firm
  _businesses_ (0602/0603 deferred them to this ticket); 0605b if wanted.

## Contract (what the second agent may code against)

- `@yearafter/content`: `DEAL_KINDS`, `findDealKind`, `DealKind`, `DealOutcome`.
- `@yearafter/finance` (`private-deals.ts`): `PrivateDeal`, `DealOffer`,
  `DealRefusal`, `DealYear`, `EMPTY_DEALS`, `MAX_DEALS`, `MAX_OFFERS`,
  `carryingValue`, `dealsValue`, `dealOffersFor`, `placeDeal`, `dealYear`,
  `secondaryOffer`.
- `@yearafter/simulation` (`deals.ts`): `dealMarket(state)`,
  `placeInDeal(state, offerId, amount)`, `sellDealEarly(state, dealId)`.
- `GameState.deals`, save **v40** (migration 39, `deals: []`).

Changes since the contract commit: `placeDeal` takes the `seed`; `DealYear` is
`{deal, interest, returned, note?}`; the timeline wording is `DEAL_LINES` / `dealLine`
in `content/src/deal-lines.ts` (the second agent's file); `DEAL_NAMES` is in
`content/src/deals.ts`; `estateSaleOf` and `defaultYearOf` were added.

## What the engine does

- `dealOffersFor` (finance): up to two offers a year, half of slots, tilted by
  the economy (a crash brings 40% as many, a boom 120%); the kind and size of a
  slot never depend on the person's money, only whether it is shown, so paying
  for one deal doesn't change what the other is. Cheques are in $500 steps, at
  most the lesser of the share of the round and half of what they hold.
- `placeDeal`: refuses below the minimum, above the cap, beyond cash, a full
  book (eight live deals), or an offer already taken. The outcome and
  its multiple are drawn once, from the seed and the offer id.
- `dealYear`: a lender pays 9% a year on the cheque and stops, at its default
  year (half-way), if it was going to default. Others are quiet until the year
  before a bad end, when "word gets out" (one note). At the end the cheque
  comes back at its multiple, the economy scaling the gain only.
- `secondaryOffer`: only for kinds that can be sold on, from a year after the
  cheque, 35% off. Once the warning has been given a buyer prices it at what it
  will return, so the warning is not a free exit (CORE_RULES 13.104).
- Simulation: the cheque and the principal are `investment` rows, interest and
  gains `assetIncome`, tax through `taxRate` on top of wage and business draw
  (`dealTaxOn`). Live deals count in `estateOf` at the cheque. At a death every
  live deal is sold on at the discount into the heir's opening books.

## Calibration

Outcome tables (share of deals, per dollar returned); the start-up row is the
Angel Resource Institute's study of 245 exits, the rest are product judgment.

| kind                 | min   | gate  | lock | mean multiple                           | yearly | notes                                |
| -------------------- | ----- | ----- | ---- | --------------------------------------- | ------ | ------------------------------------ |
| start-up             | $5k   | $15k  | 3–6  | 2.6x                                    | ~23%   | 70% under 1x, 45% wiped, 10% at 10x+ |
| private loan         | $10k  | $30k  | 1–5  | 1.0x + 9% a year (the year it ends too) | 9%     | 4% default, 0–50% back               |
| local-business stake | $25k  | $75k  | 3–6  | 1.75x                                   | ~13%   | 28% wiped                            |
| property syndicate   | $25k  | $75k  | 5–7  | 1.87x                                   | ~11%   | 8% lose part                         |
| growth company       | $100k | $300k | 5–8  | 2.14x                                   | ~12%   | 10% wiped                            |
| fund                 | $250k | $750k | 8–10 | 2.8x                                    | ~12%   | no early exit                        |

Measured after (150 forty-year-olds with $500,000 given, played to seventy,
taking every offer at the largest cheque): net worth median $1.7M, p90 $4.6M,
about 20 deals a life. Cash alone ends at a median $765k; an index fund ends at
$3.4M (finding 42). Nobody prints money, and nobody is pushed into deals either.

## Sabotage

Fifty mutations; forty-two caught the first time, eight survived. Two were
guards the catalog makes unreachable (a cap below the minimum; a warning on a
one-year deal): removed, with the catalog fact asserted instead (13.102). One
was a vacuous loop (13.103). The rest were genuine gaps: the kind skew, the
first-year interest, cash versus portfolio on the cheque, and the tax base
(twice). All now caught.

### Independent pass (second agent, 5 October)

129 mutations: 89 caught, 40 survived (42 distinct changes once I split two
that shared a line). One was a real bug in the engine, not a test gap: **a
lender was paid no interest in the year the loan ended**, so a one-year loan
(1-in-5 of private loans) paid nothing and every loan paid one year short of
what its blurb says. Fixed in `dealYear` (interest, and `paid`, in the
maturity year; none for a default). The rest were gaps in the tests: gate and
cheque boundaries, NaN cheques, ended deals counting against the book, the RNG
keys (pinned with golden offers), the lock-up and round ranges, held name / id
/ kind, selling the deal asked for and settling only that one, input
immutability, tax rounding and double counting, the draw in the tax base, the
economy reaching the offers and the year, the timeline ids / sequence / year,
and the estate (year of repricing, closed deals left out). All 42 are caught by
new tests (finance 33 → 52, simulation 21 → 36 in the deals files).

## Not yet done

The second agent: the Investments screen's deals section, store wiring, the
removal of the 'private' row from `INVESTMENTS_NOT_YET_BUILT`, deal wording in
`content/src/deal-lines.ts`.
Also not done by anyone: the Investment Firm and Private Lending Firm
businesses (0602/0603 deferred them here), and the economy-driven delay of an
exit (outcomes are scaled by the market at the end, not postponed).

## Findings added

42 (index fund versus deals, cash earns nothing) and 43 (portfolio income is
untaxed), in the roadmap.

## Tests

`finance/private-deals.test.ts` (33, new), `simulation/deals.test.ts` (21,
new), `persistence` +1 (v39 to v40). Finance 318 to 351, simulation 516 to 537.
