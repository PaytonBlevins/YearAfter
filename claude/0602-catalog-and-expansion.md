# 0602 — Catalog and expansion

**Status: DONE (3 October 2026). Save v39.** Second ticket of v0.06. Spec 396,
912, 1331, 1356, 1708.

## What it does

**Nineteen more businesses, thirty-one in all** (`scripts/generate-businesses.py`
→ `packages/content/data/businesses.json`, catalog version 2). Added to 0601's
twelve: law firm, marketing agency, real estate brokerage, jewelry, electronics
and furniture stores, specialty retail, resort, electrical, plumbing and
roofing companies, a gaming company, a media company, a production company,
apparel, electronics and specialty manufacturing, trucking and vehicle rental.
Startups now run from $20,000 to $14 million.

Spec 396 lists thirty-seven. **Six are not built, on purpose**, because each
needs a system that does not exist yet: Investment Firm (0605, private
investments), Private Lending Firm (0603 first said it was this ticket's; 0603 moved it to 0605, see that doc), Record Label and
Talent Agency (v0.08, music and acting), Casino (gambling) and Racing Team
(v0.08, sports). The generator keeps them in a `DEFERRED` table so the list is
one place.

**The marketplace now reads net worth.** 0601 gated on cash plus portfolio; the
comment on `gate` in the content type had always said *net worth*, which is
also what spec 912 says. A person with a home and a business is not a
beginner, and the list should not treat them as one. Gate is still 60% of the
startup, and nothing on screen names a tier. Opening still needs the cash.

**Expansion.** A business that has traded two full years and earned last year
can open another location, up to four doors, from its own screen.

- A branch costs 65% of the first location (the name and the systems are paid
  for), with its fittings and its working capital split the way the first
  one's were. It is a transfer, not an expense; net worth does not move on the
  day.
- It opens with its own minimum crew, at 72% maturity rather than 55% (a known
  name), and grows to full over the type's usual ramp.
- It brings in 90%, 80%, then 70% of what the first door does at maturity:
  the custom is shared, and a second site is never quite the first.
- It pays 75% of the first location's overhead (the lease is its own; the
  insurance and the accountant are not).
- One owner can only be at one door: the owner's presence at each falls with
  the square root of the number of doors.
- The newest door can be closed for 40% of what its fittings are worth.
- A business is sold, valued and inherited with its doors.

## Calibration

Measured in a multi-year simulation, not asserted. With no limit on cash and a
manager who staffs to demand, over twenty years:

| doors | typical result |
|---|---|
| second | pays for itself in nearly every trade, 15–70% more owner money than staying single |
| third | adds less than the second |
| fourth | adds less again, and in a few trades (software, real estate, jewelry, specialty retail) is a loss |

The trades that scale best are the ones where a location is mostly people and
a lease (cleaning, HVAC, roofing, law). Expansion is a good bet for a business
that is already doing well and a poor one for a business that is not; it is
not a way to print money. Three businesses of four doors each is twelve sites
and the owner's attention is a third of what it was.

## Three things the new catalog made me fix

1. **The price slider had a dominant end.** 0601 typed elasticities and
   checked the best price against a *fixed* headcount. Once the manager is free
   to staff to the price (which is what the game does), the typed numbers put
   the best price at 125–135% for half the catalog, worth 60–150% more owner
   pay. Elasticity is now derived from the business's own costs
   (`elasticity_of` in the generator): the price that maximises profit for a
   firm that can add or shed staff is `p* = e/(e−1) · mc`, and `e` is set so
   `p*` lands just above the going price. The best price now falls between
   95% and 135%, is worth at most about thirteen points of revenue over the
   going price, and for a third of the catalog it is the going price itself.
2. **Payroll mattered as much in a car-rental lot as in a law firm.** Pay
   quality moved demand in proportion to a business's elasticity regardless of
   how much of it is people, so Big Bucks added 27 points of margin at a
   vehicle rental. Pay now matters in proportion to wages as a share of
   revenue (`serviceNoticedIn`), capped at a third.
3. **A manager could not staff a big firm.** `autoStaffFor` hired at most three
   a year, so a seventy-person resort with a new second door took ten years to
   fill it. Hiring is now a share of the current headcount (15%, never fewer
   than three; letting go 10%, never fewer than two).

Also new: `headroom` on a type (2 fields, default 1) for games and
publications, which can sell past a normal year with the same people. It is
what makes a gaming company a hit-or-nothing business instead of a sure
salary.

## Known gaps

- Survival at five years is still too kind against BLS (51%) for the small
  trades, and unkindly low for the capital-heavy types that lose money for two
  years (trucking, vehicle rental, furniture, production). A strict "quit after
  two bad years" owner leaves those at 0–30%; the game does not quit for you.
  0604 (events, competition) is where both get tuned.
- License-gated trades (an electrician or an attorney needs one) and
  location-dependent availability are not modelled. A character with no
  qualification can open a law firm. Left for when licenses and the business
  catalog meet; it is a content gate, not an engine change.
- No cap on how many branches a *chain* of three businesses can field beyond
  twelve doors. Spec 1392's "no trivial scale" is held by cost, maturity and the
  owner's attention, not by a hard rule.
- Finding 36 (`advanceYear` not pure) is still open.

## Tests

`finance/businesses.test.ts` 26 → 43, `simulation/businesses.test.ts` 23 → 33,
`persistence` +1. Of eighteen sabotages, three passed first time (the branch
lease share, the branch opening maturity, and the extra crew a branch opens
with) and were tightened until they failed; two of the three read the very
constant they were guarding. See CORE_RULES 13.95, which also covers the
elasticity finding.
