# Playtest P8 — bigger watch catalog

Status: claimed 8 October 2026 UTC; catalog proposal awaiting Payton's approval.
Branch: `feat/playtest-p8-watch-catalog`, stacked on P7 PR #19. Main is `beff25a`.
No product content has changed. P9 renovations and P10 icing are separate tickets.

## Contract and baseline

P8/B13 calls for more references and models per maker, including fictional equivalents
of Rolex, Patek, F.P. Journe, Tissot, Citizen, Omega, Vacheron Constantin and Tudor.
The brief says a real product choice, including a gameplay number, must be proposed
and approved. The table below is that proposal, not an approved price sheet.

There are 37 watches among 151 valuables, across 26 makers; 19 makers have only one
watch. Citizen and F.P. Journe have no equivalents. Authoring lives in
`scripts/generate-valuables.py`, not handwritten generated JSON. Its entries and
stores are logically identical to the current JSON; its serialization is not
byte-identical. The known validator mismatch therefore predates P8.

Watch Room shows six pieces per year, Maison five pieces mixed with jewelry.
Eligibility uses existing store affiliation, means gates and a price ceiling of
max($2,000, 1.5 times means). The catalog expansion must not change those rules.
Auctions pick from eligible valuables, so increasing the watch pool also increases
watch representation in mixed auctions. Measure that before implementation is
reported complete; do not quietly retune auction probabilities.

## Proposed expansion — 48 additions, 85 watches total

Keep all 37 existing watches and their IDs, prices, holds, stores and descriptions.
Keep all 114 non-watch entries. Add two fictional makers: Civitan and F.P. Jorin.
This gives 28 watch makers. References differ by model, function, material or size;
they are not a list of dial-color duplicates. New prices are proposed game values
in constant 2025 dollars, calibrated to the existing catalog's bands; they are not
claims about exact current real-world retail prices. Existing $70–$650,000 limits
stay intact; additions range from $95 to $110,000.

Every model and price below is fictional. `fashion`, `watch` and `sought` use the
existing resale classes without changes. Ordinary pieces are not automatically
investments. In particular, no new F.P. Jorin model is assigned above-retail resale.

| Maker                | Proposed references and whole-dollar prices                                                                                                  | Holds                                                             | Store               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------- |
| Rolux                | Explorer 36 $7,500; Explorer II $10,200; Air Voyager $7,700; Sea Explorer $13,900; Yacht Voyager $12,300; Perpetual 36 $6,500                | sought for Explorer 36 and Perpetual 36; watch for the other four | Watch Room + Maison |
| Patrek Phillon       | Aquanote $25,000; World Traveller $58,000; Annual Calendar $55,000; Ellipse $36,000; Pilot Travel $60,000                                    | sought for Aquanote; watch for the other four                     | Maison              |
| F.P. Jorin           | Blue Chronometer $40,000; Reserve Chronometer $55,000; Calendar $75,000; Resonance $110,000                                                  | watch                                                             | Maison              |
| Tissoe               | PRZ Quartz 40 $395; Gentleperson $825; Heritage 1938 $995; Seastar 1000 $795                                                                 | fashion for PRZ Quartz; watch for the other three                 | Watch Room          |
| Civitan              | Solar Everyday $250; Solar Promaster Diver $395; Tsukiya Automatic $450; Series Eight $1,295                                                 | fashion for both solar models; watch for both automatics          | Watch Room          |
| Omegon               | Aquaterra $6,800; Planet Ocean $7,800; Seamaster Heritage $7,100; Speedmeister Racing $10,000; Constellation $7,000; Deville Prestige $4,800 | watch                                                             | Watch Room + Maison |
| Vacheran Constantine | Patrimony $25,000; Traditionelle $28,000; Historiques Square $39,000; Fiftysix $13,000                                                       | watch                                                             | Maison              |
| Tudar                | Black Cove 58 $4,000; Pelagos $5,100; Ranger $3,300; Royal $2,800                                                                            | watch                                                             | Watch Room          |
| Seyko                | Five Sports $325; Alpinist $725                                                                                                              | watch                                                             | Watch Room          |
| Grand Seyko          | Birch $9,100; Heritage Spring $6,000                                                                                                         | watch                                                             | Watch Room + Maison |
| Hamiltone            | Khaki Mechanical $595; Ventura $995                                                                                                          | watch                                                             | Watch Room          |
| Longinez             | Legend Diver $3,200; Master Calendar $3,000                                                                                                  | watch                                                             | Watch Room          |
| Cartrier             | Ballon $6,200; Panthere Quartz $4,250                                                                                                        | watch for Ballon; fashion for Panthere Quartz                     | Watch Room + Maison |
| Casiot               | Field Digital $95                                                                                                                            | fashion                                                           | Watch Room          |

Counts: eight requested makers receive 37 additions; the remaining six makers
receive 11. New resale mix: 5 fashion, 40 watch, 3 sought. Existing resale
coefficients, annual drift, floor, tax treatment and estate handling stay unchanged.
All sought additions are recognizable scarce sports references, not every expensive
watch. Prices and store placement keep a broad affordable/midrange/luxury mix.

The names above are draft authoring labels. Stable IDs will be assigned once at
implementation; do not change or recycle existing IDs. Fictional naming still
requires the project's eventual legal review, just as the original catalog does.

## Shelf measurements before approval

Actual `storeStock` was run for 250 seeds (`p8-0` through `p8-249`), years
2000–2019, at age 30 and each listed whole-dollar means level. Funds were posted
in the prior year to avoid counting the measurement gift twice as current income.
No purchases were made. The proposal run appended 48 fixture items to the content
array in that process only; repository content was untouched. Fixture IDs/descriptions
are placeholders, so these are visibility measurements, not purchase/save tests.

| Means    | Distinct Watch Room references across 5,000 counters, old → draft | Median distinct references seen over 20 years, old → draft | Median makers per counter, old → draft |
| -------- | ----------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| $1,000   | 9 → 22                                                            | 9 → 22                                                     | 5 → 4                                  |
| $10,000  | 27 → 62                                                           | 27 → 54                                                    | 6 → 5                                  |
| $50,000  | 27 → 62                                                           | 27 → 54                                                    | 6 → 5                                  |
| $250,000 | 27 → 62                                                           | 27 → 54                                                    | 6 → 5                                  |

All 20,000 counters had six pieces in each run. Maison remained correctly hidden
below $150,000 means. More models improve long-run reference discovery, while
makers with more references naturally appear more often; this reduces median
maker diversity on a single counter by one. The proposal retains this existing
uniform-reference selection rule rather than introducing a maker quota.

Mixed-auction eligible-pool shares (conditional on a non-car, non-legendary lot;
not a measured realized lot rate) follow the actual venue filters:

| Venue                      | Means   | Watch share before | Watch share with draft |
| -------------------------- | ------- | ------------------ | ---------------------- |
| Hartwell & Finch           | $10,000 | 27/100 (27.0%)     | 63/136 (46.3%)         |
| Crane Brothers Auctioneers | $10,000 | 27/100 (27.0%)     | 63/136 (46.3%)         |

| Ashcombe Private Sales | $1,000,000 | 8/33 (24.2%) | 20/45 (44.4%) |

This dilution of other valuables is an explicit catalog-expansion consequence for
approval. Car-share and legendary-roll constants remain unchanged.

## Implementation and acceptance after approval

- Append entries through the generator; generated JSON must reproduce byte-for-byte.
  Preserve existing row formatting and values rather than reformat unrelated catalogs.
- Keep current shopping and collections screens. No new screen, filters, search,
  retailer checkout rules or automatic purchases. New models appear on existing shelves.
- Confirm affordability, maker/model variety, determinism, distinct shelf IDs,
  ownership filtering, purchases, resale, tax and estate behavior with actual functions.
- Measure shelves by means band and seed/year, and watch representation in mixed
  auctions. Distinguish catalog breadth from the handful visible in a single year.
- Test all existing IDs/entries survive, both requested new maker equivalents exist,
  every new piece has legal catalog fields and reachable stores, and the stated
  count/price/resale mix is exact. Verify old saves still resolve their owned items.
- At least 15 distinct behavioral sabotage trials, repair surviving test gaps and
  restore source exactly before final verification. Record every missed mutation.
- Run full `pnpm verify` and owned-file formatting. Report existing global failures
  separately; no unrelated catalog rewrite or old-note format cleanup.

No save migration is expected: holdings already save stable catalog item IDs.
Save v46 and TICKET 0708 remain. Unpurchased offers are derived from a catalog pool,
so an expanded pool can change shelves for the current year on upgrade; owned
pieces remain stable. No promise of preserving an old unpurchased quote.

Native device verification and Claude Project mirroring remain unavailable here;
do not report either as completed. Stop after P8; P9 requires a new instruction.
