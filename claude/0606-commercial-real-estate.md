# 0606 — Commercial real estate

**Status: ENGINE DONE. Screens and on-device checks are the second agent's.**
Save version unchanged (v40): the three new tenant fields are optional.

## What it is

Four new kinds of building, let to businesses on leases of several years:
a corner shop building (2 units), a shopping strip (5), a warehouse (3) and an
office building (8). They are bought from their own list, financed by their own
lender, and let through 0503's verbs (rent out, set the rent level, hire an
agent, sign a tenant, fill every empty unit). What changes is who the tenants
are, how long they stay, and what the economy does to them.

## Measured first (before any code)

Real anchors, 2025: net cap rates for shopping centers 6.0–6.5%, prime
industrial 5.0–5.75%, prime office 7.5–8%; national vacancy office 20.7%,
industrial 7.1%, retail 5.7%. A commercial mortgage runs 25 years at 30%
down and about three quarters of a point over an investment-property loan.
Wealth reach (who can see which kind): corner shop from about $100k of means,
strip $280k, warehouse $400k, office $700k.

## Design

- **Catalog** (`scripts/generate-homes.py`, catalog version 3). Every kind now
  carries `commercial`, `vacancy` and `leaseYears`. Residential kinds are
  `false`, `0`, `[1, 1]`; a catalog check enforces it. Commercial kinds are
  also `rental: true`, so a building is never lived in and starts empty.
- **Who rents** (`content/commercial.ts`). `COMMERCIAL_TRADES` maps each kind
  to the business types that take that space: shops are cafes and salons, the
  warehouse is trucking and manufacturing, the office is law and accounting.
  Tenant names are the business catalog's own names.
- **Lease** (`finance/commercial.ts`). A tenant is a `Tenant` with `trade`,
  `leaseEnds` and `rent`. The rent is fixed for the term and reset to the
  going rate at renewal (so a rising market is not shared and a falling one is
  cushioned). A tenant leaves only at the end of its lease, with 1.5 times the
  residential yearly leave chance, or by failing.
- **Failure and the economy.** A business fails with the chance its credit and
  history give, times 3 / 2 / 1.3 / 1 / 0.8 / 0.6 for severe recession /
  recession / slowdown / normal / growth / strong expansion. Half the year is
  paid, then the unit is empty.
- **Empty time.** A new lease pays part of its first year (fit-out, empty weeks),
  sized so a kind's `vacancy` is what it comes to, then lengthened 2 / 1.5 /
  1.2 / 1 / 0.85 / 0.7 by the economy. Capped at a whole year.
- **Applicants** follow the economy too (0.4 to 1.3 times the rent level's
  count; at least one unless the rent is out of reach).
- **Lender** (`property.ts`). `mortgage.commercial`: 7.25%, 25 years, 30%
  down, up to $8M, good credit. Purpose `commercial` lends on commercial
  property only and counts 70% of the rent toward the income test (a house
  loan counts 75%). Purposes `home` and `rental` cannot use it.
- **Listings.** Two commercial listings a year (`commercialListings`), behind
  the same hidden means gate as homes. The residential and rental lists are
  unchanged, so their picks are unchanged.
- **Economy plumbing.** `runHomesYear` gained a `market` argument, passed from
  `advanceYear`. Applicants take it from `state.market`.
- **Ledger and tax.** Rent is `assetIncome`, the agent's cut and upkeep are
  `housing`, as for any rental. A commercial building is a home in the estate.

## Calibration (150 buildings x 50 years, agent-run, going rate, through `runHomesYear`)

| Kind                 | Occupancy | Net yield on value | Recession | Severe |
| -------------------- | --------- | ------------------ | --------- | ------ |
| Corner shop building | 92.0%     | 6.8%               | 88%       | 84%    |
| Shopping strip       | 90.0%     | 6.4%               | 86%       | 80%    |
| Warehouse            | 88.9%     | 5.7%               | 85%       | 80%    |
| Office building      | 84.5%     | 7.4%               | 82%       | 79%    |

Occupancy sits 3-4 points under each kind's `vacancy` (a failed tenant pays
half a year, an agent re-lets at year end, a new lease starts rent-light). Gross
yields are set from this measured occupancy with the agent's 8% taken out:
corner shop 9.5%, strip 9.3%, warehouse 8.2%, office 11.8%.

## Tests

- `finance/commercial.test.ts` (20): the economy's tables, leases, first-year
  share, tenants, a unit's year, the lender.
- `simulation/commercial.test.ts` (22): the catalog, listings, buying, tenants,
  lease rent, renewal, failure, first year, a life's economy reaching the
  building, occupancy and net yield per kind.
- `persistence.test.ts` (+1): a lease survives a save.
- Sabotage: 51 mutations across `finance/commercial.ts`, `property.ts`,
  `homes.ts`, `rentals.ts`, `advance.ts`. First run caught 39; twelve survivors,
  all fixed by a test (none by removing code): a crash emptying the listing, the
  leave factor, two pieces of the gap's sizing, poor-credit defaults, the
  reliability floor, the investment loan reaching a house, the rent count, a
  single trade, and three places the economy was not threaded through (the
  screen's applicants, the mass search, `advanceYear`). Final run: 51 of 51.

## For the screens (second agent)

New contract: `HomeListing.commercial`; `commercialListings(state)`;
`purposeOf(...)` may return `'commercial'`; `Tenant.trade`, `Tenant.leaseEnds`,
`Tenant.rent`; `isCommercialKind(home)`; `COMMERCIAL_TRADES`;
`firstYearShare`, `leaveAtLeaseEnd` for explaining a lease. A tenant who is a
business shows its trade (`findBusinessType(trade).name`), its revenue
(`income`), staff (`household`), and the lease end; `work === 'new'` reads as
"opened recently". Timeline lines the engine writes: a business "went under and
stopped paying rent at the X", "didn't renew at the X".

## Not done

- The character's own businesses do not rent from their buildings.
- Commercial buildings cannot be renovated (the renovation lists are explicit).
- At the clamp (a whole year of no rent) a severe recession and a recession
  cost an office's first year the same; failure and applicant counts still
  separate them.
- Leveraged returns (a mortgage at 7.25% against a 6-7% net yield) are not
  measured against the index fund; finding 42 stands.
- Screens and on-device checks.
