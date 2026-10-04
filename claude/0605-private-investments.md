# 0605 — Private investments

**Status: IN PROGRESS. Contract commit only (types, catalog, save v40, stubs).**
Engine, calibration and screens follow. Spec 1383, 1140, 1860, 1233, 912.

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

Stubs return `[]` / `notBuilt` until the engine commit.

## Not yet done

Engine bodies, `advanceYear` integration, ledger/tax lines (finding 34: a
lender's interest is not earned income), estate, net-worth wiring, the
`INVESTMENTS_NOT_YET_BUILT` 'private' row, the screen, calibration and the
sabotage run.
