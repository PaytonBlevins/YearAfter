# Ticket 0503 — a landlord

The landlord half of v0.05: spec 145 (duplexes hold two renters, apartment
complexes 5, 10 or 25), 149–150 (the monthly payment and the maintenance appear
only in the rental flow), 157 (tenant screening shows concrete indicators and
no risk score), 160 (leases renew on their own, and the player may raise or
lower the rent) and 954–978 ("Real estate returns derive from rent, mortgage,
expense, appreciation, and vacancy. Very high rent reduces applicants; low rent
trades profit for occupancy").

**Commercial property is not here.** Spec 1708 puts "commercial real estate
integration" with the business engine in v0.06, and it needs that engine's
idea of a business tenant to mean anything.

## Before

Nobody could let anything. There were no rental buildings, a house was always
lived in, and property had never written a line of income.

## What was built

**Rental buildings.** Four new kinds in `homes.json`: a duplex (2 units) and
small, medium and large apartment buildings (5, 10 and 25 units), each with a
price band, an upkeep rate and a **rent yield**. Up to three are listed a year,
in their own section under the homes, behind the same hidden gate as homes:
someone who could never afford one never sees an empty heading. A listing
shows spec 145's fields and nothing about rent.

**The going rate.** A unit's rent is the kind's yield on the building's
*current* value, adjusted for region. Rent follows a place's cost of living
roughly in step while prices follow it squared, so yields are lower where
houses are dear. A duplex in Ohio pays; one in California mostly doesn't.

**Any house can be let.** "Rent it out" on the home you live in moves you out
into a rented place, from the next year. A second house is the same. A house
that's let and empty can be moved back into if you have nowhere else. There's
still no primary-residence mechanic: a house with no letting is where you live,
and a building is never lived in.

**Tenants.** An empty unit gets applicants. How many depends on the rent. Each
one shows spec 157's indicators: income, credit, work history, household size,
and past evictions when there are any. There's no score. Behind them is a
hidden chance of paying the year, built from those same indicators. A tenant
who stops paying is evicted, having paid about half the year. Leases renew on
their own, and tenants leave in their own time.

**The rent setting.** Six steps from 20% under the going rate to 30% over it,
not a number to type. Higher rent means fewer applicants, tenants who leave
sooner and longer gaps between them. The table is tuned so the going rate is
about the best a landlord can do (see Results).

**The agent and the mass search.** A letting agent re-lets every empty unit at
the end of each year to the applicant most likely to pay, for 8% of the rent.
"Fill every empty unit" does the same in one tap for a building you run
yourself. Without either, an empty unit stays empty.

**Money.** Rent is `assetIncome` (its first property producer). The agent's fee,
and a building's upkeep and mortgage, are `housing` rows on that building. The
home you live in is the only one whose cost the living phase fits your life
around. A household that falls short falls behind on the property it lets
first, so the duplex is sold before the house.

**An investment mortgage.** 7.25%, 25% down, up to $5 million. A lender counts
75% of the expected rent as income, which is ordinary US underwriting. A second
house is financed this way too. There's room for five mortgaged properties at
once.

**Screens.** The Homes screen splits into *Your home*, *Your property* and two
for-sale sections. A new Rental screen holds the rental flow: rent per unit,
let count, mortgage a month, upkeep, the agent's cut, and what a year leaves
as it stands. It also has the rent setting, the agent, and every unit with
its tenant or "Find a tenant".

Save **v33**: a home may carry a `letting`. Nothing earlier could, so the
migration only bumps the version.

## Results

Synthetic: 200 duplexes per setting, 25 years each, through the same
`runHomesYear` a life calls. Two seed sets agreed to within 0.1 points.

| rent setting | let | rent a unit-year |
|---|---|---|
| 20% under | 98% | $20,300 |
| 10% under | 97% | $22,600 |
| **going rate** | **95%** | **$24,700** |
| 10% over | 81% | $23,300 |
| 20% over | 50% | $15,800 |
| 30% over | 0% | $0 |

At the going rate in Ohio, with an agent: 95% let, evictions in about 3% of
unit-years, and **4.7% net of everything on what the building is worth**
(California: 2.8%). US small-multifamily cap rates run about 5–7%. Left to
itself, a building with no agent and nobody finding tenants is 8% let after
twenty-five years.

In a life (300 lives, a landlord's strategy: buy the cheapest listed building
between 38 and 55 with a mortgage and hire an agent): 95% occupancy, 2.5%
evictions per unit-year, about 6% net yield on the purchase price, 1.4%
appreciation, and median cash flow after the mortgage of about +$3,000 a year.
That's +$5,600 in cheap states, about +$1,000 in average ones and −$16,600 in
dear ones. Unlevered, about 7% real a year in total: in line with the long-run
real return on housing, and a little above the game's stock market drift. So
it's a real alternative, not a money printer.

## Tests

- `finance/rental.test.ts` (18): regional yield, the rent table's
  monotonicity, applicant indicators (and that nothing reads as a score),
  incomes, evictions following credit, reliability, a unit's year (stays,
  moves in mid-year, evicted, leaves, empty), the rental flow's arithmetic,
  and the investment mortgage (25% down, counts rent, never for a home, the
  cap).
- `simulation/rentals.test.ts` (13): the synthetic economics above (occupancy
  band, evictions above zero and below 5%, net return band, cheap vs dear, the
  whole rent table, neglect, determinism), plus every verb in a life: buying a
  building, signing a tenant who pays next year into the ledger, fill-all and
  the agent, the rent step, letting the home you live in and moving back,
  falling behind on rentals first, and a rental's costs never being your roof.
- `persistence` (+1): a let building with a tenant and an empty unit
  round-trips, and a v32 save migrates.

Sabotage-verified: each piece was switched off or broken on purpose, and a test
failed every time. That covers the agent never filling, the rent setting doing
nothing, every home's cost counted as the roof, falling behind on the home
first, no regional yield, the lender ignoring rent, nobody ever evicted,
applicants changing each look, and a building counting as a home.

## Still rough

- **Nobody in the passive population becomes a landlord.** No door was built:
  owning rental property is a choice a minority make (roughly one US household
  in ten), and one the game shouldn't make for anybody. Worth deciding
  deliberately.
- **Mortgage rates are nominal in a constant-dollar economy.** A 6.5–7.25%
  rate with no inflation is a real rate nearly double the real world's, which
  makes leverage worse than it should be (13.85 applies here too). The rates
  look right on screen, which is why they were left. Logged as a finding.
- **Tenants are never people.** Spec 1316 keeps tenants inside property, so
  they're names on the Rental screen and nothing more. No memories, no events.
