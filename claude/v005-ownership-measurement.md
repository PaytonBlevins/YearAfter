# v0.05 Ownership — measured before it was ticketed

The spec's list for v0.05 (§1285–1404) is long: houses, duplexes, apartment
buildings, commercial property, mortgages, tenants, renovations, a vehicle
market of 150–250 entries, modifications, jewelry, and three kinds of auction.
Before splitting it into tickets, I played 150 lives answering every question
the game asked, and looked at what a life ends up holding.

## What a life held before 0501

| age                       | 25   | 30   | 45  | 55   | 65   |
| ------------------------- | ---- | ---- | --- | ---- | ---- |
| median cash + investments | $21k | $14k | $9k | $20k | $21k |

- **Nobody owned anything.** Not a house, not a car, not a watch. The Ownership
  screen was four rows marked "not built yet".
- **Median net worth was flat across forty working years:** $18,000 at 25–34
  and $20,000 at 55–64. Each life's own change from thirty to sixty was
  $1,700 on one sample of 150 and $3,400 on another.
- **Rent was the reason.** An adult paid $18,000–$29,000 a year for a roof they
  would never own, and it was the largest line in every budget. Rent is the
  only housing cost that builds nothing. So a working life ended where it
  started.

That makes the order obvious. Homes first, because it's the one thing on the
list that changes where every life ends up. Everything else on the list is
something to spend money on. A home is the first thing that holds its value.

## The breakdown

| ticket   | what                                                                                                                                                                  | spec                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **0501** | **Homes** — a market of listings, mortgages, owning, selling, a systemic offer                                                                                        | houses, simple mortgages       |
| **0502** | **A household of two** — partners earn, a date isn't a household, spending per household member                                                                       | finding 9, found here          |
| **0503** | **A landlord** — duplexes, 5/10/25-unit buildings; applicants, rent changes, renewals, management agencies, mass tenant search (commercial moved to v0.06, spec 1708) | landlord half                  |
| **0504** | **Vehicles** — New, Used, Online and Luxury markets, 150–250 entries, hidden used-car issues                                                                          | vehicle markets                |
| **0505** | **Vehicle modifications**                                                                                                                                             | modifications                  |
| **0506** | **Renovations, jewelry and watches, valuable collections, shopping**                                                                                                  | renovations, jewelry           |
| **0507** | **Auctions** — two general houses, storage auctions, high-end and private sales                                                                                       | auctions                       |
| 0508     | Will & Estate — an estate that settles property, debt and the portfolio                                                                                               | the row 0212 deferred to v0.05 |

0502 was inserted after the breakdown was first written, so everything from
rentals on moved down one.

Vehicles follow the recognisable-fictional-analogue rule with real-world price
references, like every other catalog.

## Findings the measurement turned up that aren't ownership

- **8. `stableUnit` correlates keys that differ only at the end.** Found by
  0501's market (CORE_RULES 13.84). `mixedUnit` fixes it for new callers. The
  old helper is left alone because every save depends on it, but any caller
  that keys a _sequence_ on it (`…:${year}`, `…:${index}`) should be audited.
- **9. Partners earn nothing.** — **DONE in 0502.** A partner counted toward
  the household's costs and never brought in income, so a married household
  was strictly poorer than a single one.
- **10. Inheritance ignores the portfolio and the pension.** 0501 added home
  equity to what an heir receives. Investments and retirement accounts still
  vanish at death. That belongs in 0508.
