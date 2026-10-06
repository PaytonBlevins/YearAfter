# Ticket 0501 — a place of your own

The first ticket of v0.05 Ownership. The measurement behind it is in
`claude/v005-ownership-measurement.md`. In short: nobody owned anything, rent
was the biggest line in every adult budget, and median net worth was about the
same at sixty as at thirty.

## What was built

**A market.** Eight homes for sale each year in the character's state, cheapest
first, the same eight all year (spec 147). They're generated from seven kinds
in `homes.json`: condo, townhouse, starter house, family house, large house,
luxury home, estate. Each listing has bedrooms, bathrooms, age and condition
drawn within its kind's ranges. Prices come from US asking-price bands, scaled
by the region's cost index (squared, because house prices vary much more
between regions than groceries do). A listing shows exactly spec 145's list:
type, rooms, age, condition, asking price, financing, and one estimated annual
expense. It has no square footage, no market value, and no monthly payment.

**A hidden gate.** Someone with $4,000 isn't shown a mansion, and nothing on the
screen says why. It's spec 1356's rule for businesses, applied here.

**Mortgages.** Three products, all 30 years: conventional (6.5%, 10% down),
starter (6.9%, 3.5% down), jumbo (6.8%, 20% down). The bank puts down 20% if the
buyer can spare it and never takes their last $5,000. Payments, upkeep and other
loans have to stay under 43% of income. A refusal gives the reason that would
actually have to change: deposit, income, credit standing, age, or already
having a mortgage.

**Owning.** Each year the house moves with the market, charges its upkeep, and
may wear down a condition band (8% a year). Nothing restores it yet; that's
renovation, 0506 after the 0502 renumbering. Buying and selling are ledger transfers, not income or
outflow. Home value and mortgage debt go into net worth on the Finances screen,
and home equity goes to the heir.

**Selling** costs 6%. A household two years behind sells under pressure and
keeps what's left. The bank only takes a house that's worth less than what's
owed on it.

**The fifth door.** `home.offer`, the same pattern as college, the first job, a
private life and the sign-up sheet. The game offers it to someone renting their
own place who owns nothing, when the bank would lend on a listing that costs
them no more a year than their rent does now. It runs the real `buyHome`, so the
bank can still say no.

**The Homes screen** is two halves: what you own, then what's for sale. Buying
takes two taps at most.

Save **v32**. The migration gives every older save an empty `homes`, and drops a
`home.offer` that lost its payload, the same repair as the last four doors.

## What the measurement caught while building it

Each of these passed its unit tests and only showed up in the population.

1. **104 of 176 buyers were foreclosed on,** at a median age in the sixties. The
   mortgage was charged on top of a standard of living that still spent like a
   renter's, so retirement turned every owner short. Owners now spend less on
   everything else when the house costs more than rent did, down to
   subsistence. A household that falls behind with equity sells. New rule
   **13.86**.
2. **A $200,000 house was worth $978,000 at sixty-five.** The market drifted at
   a real-world _nominal_ 4% in an economy with no inflation. It now drifts at
   1.2% in real terms, with a spread wide enough for a bad decade. New rule
   **13.85**.
3. **The market rose 6–7% a year for twenty years straight.** `stableUnit` on
   `housing:${year}` gave nearly the same value for consecutive years. New
   `mixedUnit` in core, with a finaliser. New rule **13.84**, roadmap finding 8.

## Results

150 lives, answering every question:

|                                                 | before        | after           |
| ----------------------------------------------- | ------------- | --------------- |
| own a home at 25–34                             | 0%            | ~10%            |
| own a home at 45–54                             | 0%            | 30–40%          |
| own a home at 65–80                             | 0%            | ~60%            |
| median net worth, 55–64 ÷ 25–34                 | 1.2           | 2.1–2.9         |
| median change in each life's net worth, 30 → 60 | $1,700–$3,400 | $27,000–$30,000 |
| short years, owners / renters                   | —             | 0.8% / 1.4%     |
| homes let go                                    | —             | about 5%        |

US homeownership runs about 37% under thirty-five and about 79% at sixty-five
and over, so these are low. That's deliberate for now. The game's households are
poorer than real ones because partners earn nothing (finding 9). Fixing that is
worth more than tuning the door up to hide it.

## Tests

`finance/property.test.ts` (13): mortgages, refusal reasons, the ceiling,
amortisation, a year of owning, wear, selling, regional prices, and the owner's
squeeze. `simulation/homes.test.ts` (9): the population claims above, the
market's drift and independence, pressure sales against foreclosure, and the
buy/sell verbs reconciling. Also a new `core/stable.test.ts`, a persistence
round trip and migration, and `home.offer` added to the one-systemic-question
check in `belonging.test.ts`.

Sabotage-verified. Each of these was switched off or put back the old way, and
each made a test fail: the door off, no squeeze, foreclosing everyone behind, a
nominal market, a correlated market, no pressure sales, and `mixedUnit` without
its finaliser.

## Still rough

- **Ownership is low** for the reason above. Finding 11.
- **Condition only went down in this build.** Renovation shipped in 0506.
- **One home at a time in practice.** The model holds several, but the door
  only asks people who own nothing, and a second home is a rental property,
  which shipped as 0503 after 0502 was inserted.

## Later follow-ups

0502 added partner earnings and reworked household spending; the statement
that partners earn nothing is the pre-0502 explanation. 0503 built rental
property and 0506 built renovations. Finding 11 still records low young
ownership; this notes pass does not replace the original calibration tables.
