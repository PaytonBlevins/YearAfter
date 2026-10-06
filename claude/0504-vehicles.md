# Ticket 0504 — vehicles

Spec 141 (value from age, model, condition, a hidden service history,
accident history and rarity, with no mileage), 179–182 (the costs are the loan
payment and maintenance, with repairs merged in, and no fuel or registration),
1088 and 1456 (recognisable fictional brand and model families with real
trims, priced against real-world bands), 1329 and 1877 (New, Used, Online and
Luxury markets, two lots in each new/used bracket, two smaller luxury lots,
rare hidden issues online, an optional inspection, instant finance), 1387
(ordinary cars lose value, a few collector cars gain it) and 1703 (150–250
entries).

**Modifications are 0505.** No field for them exists until something writes
one (CORE_RULES 13.36).

## Measured first

Two disjoint sets of 150 played lives, answering every question: **nobody had
ever owned a car, at any age.** Getting around was already paid for inside the
living bill (0303's `SUBSISTENCE` names it), so a car was something the bill
bought invisibly and nothing the Ownership screen could show.

## What was built

**The catalog** (`scripts/generate-vehicles.py` → `vehicles.json`). 247 trims
across 104 models and 28 brands: mainstream (Royata, Hondo, Fard, Chevlon,
Nissun, Hyundal, Kiya, Subaro, Mazdo, Volkswerk, Jepp, Raam, Teslo), luxury
(RBW, Merceda, Audo, Lexon, Cadillon, Rangeland, Porsha), exotic (Ferrano,
Lambor, McLarren, Bentlee, Rowland, Ashton Marlin) and 25 classic trims priced
as a collector would. The spec's own example, the Royata GT4 100, is in it.
Every price is a 2025 US reference price. Each model has a body, how it holds
its value, how reliable it is, whether it's electric, and whether it's a
collectible.

**Seven lots** in four markets. New: Northgate Auto Group and Valley Motor Mall.
Used: Second Street Pre-Owned (one to nine years old, 3% hidden issues) and
Budget Auto Sales (five to fourteen, 5%). Online: AutoTrove (private sellers,
2–16 years old, about 5% under what the car is worth where dealers ask 5–8%
over, 10% hidden issues). Luxury: Prestige
Motorcars (new luxury and exotics) and Heritage Collector Cars (exotics and
classics). Stock is derived from the seed, the year and the lot, so it's the
same all year and new the next, with no save field. The Luxury market is
behind a hidden gate (means of $120,000), and a luxury lot shows nothing over
1.5× those means.

**What a car is worth.** Each model holds its value one of four ways. After
five years a Royata keeps about 60%, an ordinary car about half and a big
German sedan about a third. Exotics fall slowly. Driving a new car off the lot
costs 6–12% at once. A car in better shape than its age is worth more, worse
shape less; full records add 3%, none take 7%, and an accident takes 15%.
Collectibles stop falling at twelve years and gain 2% a year after that.
Classics gain 1.5% a year in real terms. There's no mileage field anywhere.

**A year of owning one.** It wears more as it ages and more if it was
neglected. Maintenance and repairs are one line (spec 179–182), by the kind of
car, its age and how reliable the model is. There's a yearly chance of a
bigger repair and a 3% chance of an accident (the insurance, which lives in
the living bill, pays; the $1,000 deductible doesn't). A hidden issue the
seller didn't mention comes out in the first year as a repair bill. A car worn
past fixing with nothing owed on it goes to the junkyard for $400.

**Inspection.** $200 on any used or online car. It shows the service history,
the accident record and any fault, and the seller knocks the fault's cost off
the price. A dealer shows the accident report anyway; online, it's unknown
until inspected.

**Finance.** Spec 1329's instant answer, three products: new-car finance
(6.9%, 6 years, 10% down, fair credit), a used-car loan (11%, 5 years) and a
second-chance loan (16.9%, 5 years, 15% down, no credit needed, up to
$35,000), which is how most first cars are bought. A lender caps the payment
at 20% of income and all loan payments at 50%. Two short years in a row with
a loan on it and the lender takes the car back and sells it at auction.

**Selling.** A dealer pays 88% of what it's worth, less the loan. A car worth
less than is owed needs the difference in cash.

**Money.** Buying and selling are `property` transfers, like a house. The car
payment, maintenance and repairs, and an inspection are the first producers of
the `vehicle` category (`UNWRITTEN_CATEGORIES` is now empty). A car's value
counts in assets and its loan in liabilities. An heir receives what the cars
sell for, after their loans.

**The living bill stops buying a car for somebody who owns one.** BLS puts
buying and keeping a car at about 8.5% of household spending (`VEHICLE_SHARE`).
An owner's bill drops by that share, and a car that costs more than the share
squeezes everything else, the same way a mortgage does (13.86).

**The sixth door** (`vehicle.offer`). An adult with no car, or whose car is in
poor shape or 18+ years old, with an income or $8,000 in cash, is asked 35% of
eligible years. The offer is a car from the New and Used lots priced near what
people on that income pay (about a third of a year's gross earnings), paid in
cash if that leaves three months of living in hand, otherwise on the lender's
real answer. An old car is the trade-in. It's fifth of six, after a home and
before a club. Its price reads earned income only, so the year somebody sells
a house isn't the year they look at a Bentlee.

**Screens.** Ownership → Vehicles: what you drive (each with its monthly cost,
spec 20) and the four markets. A market shows its lots. A listing shows the
year, body, condition, service history, accidents, an inspection button, the
lender's answer in a sentence ("$2,140 down, then $388 a month for 5 years at
11.0%"), and Finance it / Pay cash. An owned car shows what it costs a month,
what it's worth, what was paid, what's owed, its condition, its service
history, an ordinary year's maintenance, and what a dealer would give.

Save **v34**: `vehicles`, `vehicleOffer` and `inspected`. Older saves get no
cars, and a `vehicle.offer` without its payload is dropped.

## Results

Two disjoint sets of 150 lives, answering every question:

| age   | owns a car | median net worth, before | after (cars and car loans counted) |
| ----- | ---------- | ------------------------ | ---------------------------------- |
| 18–24 | 33–36%     | $20,000–$23,000          | $19,000–$23,000                    |
| 25–34 | 71–73%     | $41,000–$46,000          | $41,000–$45,000                    |
| 35–44 | 78–79%     | $85,000–$103,000         | $95,000–$100,000                   |
| 45–54 | 84–86%     | $178,000–$197,000        | $189,000–$203,000                  |
| 55–64 | 93–94%     | $294,000–$331,000        | $287,000–$316,000                  |
| 65–74 | 93–96%     | $379,000–$415,000        | $362,000–$368,000                  |
| 75+   | 91–93%     | $498,000–$514,000        | $515,000–$528,000                  |

About nine US households in ten have a car. A life buys about four, a third of
them new, at a median of $22,000 (p10 $11,000, p90 $40,000). About 25–30% are
financed. 2–3% of financed cars are repossessed and 2–3% of purchases carry a
hidden issue. Most cars end at the junkyard. Short years stay at 1%.

**Home ownership dipped slightly**, by 3–5 points at 35–54 (34–37% and 59–61%,
against 39–40% and 64%). A car competes with a deposit, which is real. The
first version made it eight points; see 13.90.

## Tests

- `content/vehicles.test.ts` (8): 150–250 entries, no real brand name anywhere
  a player reads, multiple trims, prices in band for each tier, classics dated
  and collectible, the seven lots, hidden issues commonest online.
- `finance/vehicles.test.ts` (20): depreciation by curve and the first-year
  drop, five-year retention bands, collectibles and classics gaining value,
  condition/history/accident in the price, maintenance by age and reliability,
  a loan paying down every year and clearing in six, a hidden issue surfacing
  once, wearing out, the monthly cost, every lender answer, selling and owing,
  and the living bill's car share and squeeze.
- `simulation/vehicles.test.ts` (20): the lots (same all year, new next year,
  new vs used ages, no mileage, the luxury gate, nothing for a child, defect
  and accident visibility), inspection (fee, reveal, price cut, not on a new
  car), buying for cash and on finance, payments the next year, selling and
  being underwater, too young at fifteen, falling behind and repossession, the
  living bill end to end, and the population claims above.
- `persistence` (+1): a financed car with a known fault, an open offer and an
  inspection round-trip; a v33 save gets no cars.

Two existing tests moved, each with the reason in place:

- `homes.test.ts` measures the house a rich character buys as what it added
  to their assets. They usually own a car by then.
- `ledger.test.ts`'s inheritance test counts a car sale among what the heir is
  given.

**Sabotage.** Seventeen pieces were broken on purpose. Three passed the first
time and their tests were tightened until they failed: living not told about
the car (the car's own costs squeezed the bill the same direction), a loan
that never paid down (it still cleared on its last year), and repossession
after one short year (inside a loose band). That's new rule **13.91**. All
seventeen now fail a test.

**Full gate: 1,155 tests, typecheck clean, validator green (12 catalogs, 1,256
ids).**

## Still rough

- **NPC parents never buy their child a car.** Spec 61 and 1197 keep it as
  something a parent may do. It needs a decision on who pays for a car's
  upkeep while a teenager has no income.
- **A repossession's shortfall is written off.** If the auction fetches less
  than is owed, the rest vanishes. In the world it stays as debt.
- **Cars are mostly bought for cash.** 25–30% are financed, against roughly
  80% of new and 35–40% of used cars in the US, because the door pays cash
  whenever cash leaves a cushion.
- **Car loan rates are nominal**, the same as finding 14 for mortgages.
- **Gifts ($$$ vehicle, spec 64)** don't exist yet.

## Later follow-ups

0505 subsequently added the `mods` field, shop flow and modification effects.
The opening "no field" statement is scoped to the 0504 build. Its financing,
parent-gift and repossession-shortfall findings remain open.
