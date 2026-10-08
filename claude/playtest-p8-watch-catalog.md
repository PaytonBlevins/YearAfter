# Playtest P8 — more real watch model equivalents

Status: approved amendments implemented 8 October 2026 UTC; verification and sabotage report below.
Branch `feat/playtest-p8-watch-catalog`, stacked on P7 PR #19. Main remains `beff25a`.

## Payton's decision and scope

The initial 48-addition proposal was superseded. Payton asked for only 15–20 additions,
approved the remaining price/resale/store approach, then clarified he meant real model
families (Submariner, Yacht-Master, Oyster Perpetual, etc.), not invented variants or
movements. He also requested a very expensive Jacob & Co. equivalent and confirmed
that direction. Built 18 additions: 37 → 55 watches, 26 → 27 fictional makers, 151 →
169 valuables. Seventeen additions broaden fifteen existing makers; the eighteenth
introduces Jakob & Co. There is no promise to add a model to all 26 existing makers
within eighteen slots. No fabricated calibers, hairsprings or reserve specifications.

P9 renovations, P10 watch modification/icing and life-event wording remain separate.
The Jakob piece has its real model's gem-set identity in catalog content; it does not
add an icing action, a modification flag or a resale modifier.

All old 151 entries, including their order, IDs, prices, resale categories, stores,
rarities and blurbs, remain exactly the same. Five store definitions, stock-selection
rules, purchase commands, valuation/tax/estate rules and screens are unchanged.
Existing Shopping/Collections readers automatically display the new models.

## Model mapping, prices and stores

Fictional brands stay under the existing 0506/MASTER_SPEC 1043–1059 contract. Real
model names or close recognizable equivalents identify the family; no invented
movement specifications are presented. Official maker sources were checked on
8 October. Some regional product pages were unavailable or robots-blocked (notably
Omega's main site); no detailed technical claim is built from those inaccessible pages.
Descriptions are short visual/function summaries rather than a technical spec sheet.
Prices are rounded game calibrations in constant 2025 dollars alongside existing
catalog bands, not a promise of today's exact retail price. The Jacob anchor is the
maker's announced $20 million model, an explicit exception to the old $650,000 watch
ceiling requested by Payton. Current ordinary resale means 75% of paid cost, not a
claim about a real collectible's auction appraisal. Only three new scarce sports
references use the existing 115% `sought` class. No resale coefficient changes.

| Stable ID suffix (`val.watch.`) | In-game model                             | Real model/source                                                                                                                           | Price       | Holds  | Stores              |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ------------------- |
| rolux-yacht-voyager             | Rolux Yacht-Voyager                       | [Rolex Yacht-Master](https://newsroom.rolex.com/watches/oyster-collection/yacht-master)                                                     | $12,300     | watch  | Watch Room + Maison |
| rolux-perpetual                 | Rolux Oyster Perpetual 36                 | [Rolex Oyster Perpetual 36](https://newsroom.rolex.com/watches/oyster-collection/oyster-perpetual)                                          | $6,500      | sought | Watch Room + Maison |
| rolux-explorer                  | Rolux Explorer 36                         | [Rolex Explorer 36](https://newsroom.rolex.com/watches/oyster-collection/explorer)                                                          | $7,500      | sought | Watch Room + Maison |
| seyko-alpinist                  | Seyko Alpinist                            | [Seiko Prospex Alpinist SPB121](https://www.seikowatches.com/us-en/products/prospex/alpinist-design)                                        | $725        | watch  | Watch Room          |
| tissoe-gentleperson             | Tissoe Gentleperson                       | [Tissot Gentleman](https://www.tissotwatches.com/en-us/T1274071103100.html)                                                                 | $825        | watch  | Watch Room          |
| hamiltone-ventura               | Hamiltone Ventura Auto                    | [Hamilton Ventura Auto H24515551](https://www.hamiltonwatch.com/en-us/h24515551-ventura-auto.html)                                          | $995        | watch  | Watch Room          |
| grand-seyko-birch               | Grand Seyko White Birch                   | [Grand Seiko White Birch SLGH005](https://www.grand-seiko.com/us-en/collections/slgh005g)                                                   | $9,100      | watch  | Watch Room + Maison |
| tudar-pelagos                   | Tudar Pelagos                             | [Tudor Pelagos](https://www.tudorwatch.com/en/watch-family/pelagos)                                                                         | $5,100      | watch  | Watch Room          |
| longinez-legend-diver           | Longinez Legend Diver                     | [Longines Legend Diver](https://www.longines.com/en-us/p/watch-longines-legend-diver-l3-764-4-50-9)                                         | $3,200      | watch  | Watch Room          |
| orys-pointer-date               | Orys Big Crown Pointer Date               | [Oris Big Crown Pointer Date](https://www.oris.ch/en-US/product/watch/big-crown/big-crown-pointer-date/01-754-7741-4065-07-5-20-63)         | $2,200      | watch  | Watch Room          |
| omegon-aquaterra                | Omegon Aquaterra                          | [Omega Seamaster Aqua Terra](https://www.omegawatches.com/watches/seamaster/aqua-terra-150m/catalog)                                        | $6,800      | watch  | Watch Room + Maison |
| cartrier-ballon                 | Cartrier Ballon Bleu                      | [Cartier Ballon Bleu](https://www.cartier.com/en-us/watches/collections/ballon-de-cartier/ballon-bleu-de-cartier-watch-CRWSBB0027.html)     | $6,200      | watch  | Watch Room + Maison |
| breitlong-superocean            | Breitlong Superocean 42                   | [Breitling Superocean Automatic 42](https://www.breitling.com/us-en/watches/superocean/superocean-automatic-42/A17366D81C1A1/)              | $4,900      | watch  | Watch Room          |
| ap-royal-ash-offshore           | Audemar Pigot Royal Ash Offshore          | [Audemars Piguet Royal Oak Offshore 26420SO](https://www.audemarspiguet.com/us/en/watch-collection/royal-oak-offshore/26420SO.OO.A002CA.01) | $39,000     | watch  | Maison              |
| patrek-aquanote                 | Patrek Phillon Aquanote                   | [Patek Philippe Aquanaut 5167A](https://www.patek.com/en/collection/aquanaut/5167a-001)                                                     | $25,000     | sought | Maison              |
| vacheran-patrimony              | Vacheran Constantine Patrimony            | [Vacheron Constantin Patrimony](https://www.vacheron-constantin.com/ww/en/collections/patrimony/81180-000r-b518.html)                       | $25,000     | watch  | Maison              |
| langer-saxonia                  | A. Langer & Sohn Saxonia Thin             | [A. Lange & Söhne Saxonia Thin](https://www.alange-soehne.com/gb-en/timepieces/saxonia/saxonia-thin)                                        | $23,000     | watch  | Maison              |
| jakob-timeless-treasure         | Jakob & Co. Billionaire Timeless Treasure | [Jacob & Co. Billionaire Timeless Treasure](https://jacobandco.com/news/billionaire-timeless-treasure)                                      | $20,000,000 | watch  | Maison              |

New mix: 15 ordinary mechanical-watch-class entries, three sought entries, no new
fashion watch. Jakob is `very rare`, Maison only, $20,000,000 retail and $15,000,000
initial resale. Rarity does not weight retail stock: the existing means gate and
price ceiling restrict visibility. Maison needs $150,000 means and any piece must
cost no more than max($2,000, 1.5 times means). Thus the $20m model needs at least
$13,333,333.34 means to enter the pool; seeing it does not imply having enough cash
to buy it. Do not claim it has a special one-off/limited-production simulation.

## Baseline and built measurements

Actual `storeStock`, 250 seeds (`p8-0`…`p8-249`), twenty years (2000–2019), age 30,
exact means fixtures funded through a prior-year ledger posting. No purchases;
these measure shelves, not demand or lifetime ownership. 5,000 counters per means
level, 20,000 per catalog. The earlier 48-item fixture run is historical only and
is not the implemented result.

| Means    | Distinct Watch Room references, old → built | Median references seen in 20 years, old → built | Median makers per counter, old → built |
| -------- | ------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| $1,000   | 9 → 12                                      | 9 → 12                                          | 5 → 5                                  |
| $10,000  | 27 → 40                                     | 27 → 39                                         | 6 → 5                                  |
| $50,000  | 27 → 40                                     | 27 → 39                                         | 6 → 5                                  |
| $250,000 | 27 → 40                                     | 27 → 39                                         | 6 → 5                                  |

Every counter still has six pieces. At $10k+ means, built twenty-year p10/median/p90
reference discovery is 37/39/40 versus baseline 26/27/27. Maison is correctly hidden
at $1k/$10k/$50k and open at $250k. More models also make those makers occur more
often; no maker-quota or selection-algorithm change was introduced.

Actual `lotsFor` was measured with the same seeds and twenty years, visit 1, using
baseline and built catalog arrays inside the scratch process (no checkout mutation).
Watch share below is among valuable lots, excluding cars; total lot and car counts
were exactly unchanged within each matched fixture. Car-share and legendary-roll
constants are unchanged. Catalog growth naturally dilutes other valuable kinds.

| Venue                  | Means       | Watch share among valuable lots, old → built | Distinct watch models, old → built |
| ---------------------- | ----------- | -------------------------------------------- | ---------------------------------- |
| Hartwell & Finch       | $10,000     | 26.9% → 35.6%                                | 27 → 40                            |
| Hartwell & Finch       | $1,000,000  | 26.1% → 34.1%                                | 37 → 54                            |
| Ashcombe Private Sales | $1,000,000  | 24.1% → 32.3%                                | 8 → 12                             |
| Hartwell & Finch       | $50,000,000 | 26.1% → 34.1%                                | 37 → 54                            |
| Ashcombe Private Sales | $50,000,000 | 22.3% → 31.6%                                | 8 → 13                             |

At $50m means, Jakob appeared in 330 of 20,000 private-sale lots (1.65% overall).
At $1m it appeared zero times. General houses exclude pieces priced $1m or more;
their pool never included Jakob. This is actual current selection, not a new
rarity promise. All eighteen additions also passed actual retail offer/purchase
coverage, including a $14m cash fixture that can see Jakob but cannot pay for it.

## Generator reproducibility and compatibility

The baseline Python entries/stores matched JSON semantically, but serialization
expanded string arrays and therefore failed byte-level validation. P8 adds a
`catalog_text()` writer that compacts only string lists while preserving original
ASCII escaping and object layout. Its output reproduced the pre-P8 catalog exactly
before additions. No Prettier write over catalog data, no unrelated catalog edit.
The generator now reproduces the new tracked JSON byte for byte; existing JSON
rows remain byte-for-byte intact and the eighteen new rows append at the end.
Catalog metadata stays version 1. Save stays v46, TICKET stays 0708: holdings already
save stable item IDs. No schema or migration edits. All 55 models round-trip through
real persistence; a pre-P8 37-watch collection survives the existing v45 migration.
One real settlement year preserves IDs/provenance and replays identically after load.
Unpurchased derived shelves can change when a pool grows; owned IDs do not change.

The existing RNG loader normalizes signed state words to unsigned equivalents.
The save fixture is canonicalized once through that existing loader before asserting
an exact round trip; this is unrelated to catalog additions and no RNG code changed.

## Tests and verification

28 new tests: content 5, simulation 20, persistence 3. Frozen pre-P8 hashes protect
all old entries/stores; an explicit approved manifest protects price/resale/count
and ID coverage. Actual commands check affordability, ledger reconciliation,
initial resale, estate asset inclusion, ownership filtering, repeat-purchase refusal,
collection shelves, sale proceeds, deterministic counters and no RNG consumption.
The save tests assert valuation movement for every held model after a real year.
The existing real-brand guard now includes Jacob & Co.

Full `pnpm verify`: all 15 typechecks and all 2,794 tests pass. Content validation
fails only the eight previously recorded generator mismatches: activities, advice,
auctions, businesses, childhood events, homes, renovations and vehicles. Valuables
now passes. No unrelated data rewrite or weakened/deleted test.

## Sabotage verification

Twenty-five distinct mutations, each against a passing targeted baseline. All caught
on the first pass; none missed. The generator was regenerated for catalog mutations
so a mismatching JSON/source pair was not the only thing that could catch them.
The deliberate generator-layout defect was checked without changing tracked JSON.

| Mutation                       | Catching suite | Result |
| ------------------------------ | -------------- | ------ |
| underprice Jacob               | content        | caught |
| Jacob above-retail resale      | content        | caught |
| Jacob at ordinary counter      | content        | caught |
| Jacob common rarity            | content        | caught |
| real Jacob brand               | content        | caught |
| empty model description        | content        | caught |
| invented caliber description   | content        | caught |
| remove added model             | content        | caught |
| added model is jewelry         | content        | caught |
| Oyster loses scarce class      | content        | caught |
| Aquanaut price drift           | content        | caught |
| reprice old Submariner         | content        | caught |
| rename old saved ID            | content        | caught |
| change store slot count        | content        | caught |
| unstable generator layout      | content        | caught |
| ordinary resale coefficient    | simulation     | caught |
| purchase values at retail      | simulation     | caught |
| purchase costs no money        | simulation     | caught |
| sale credits twice value       | simulation     | caught |
| allows repeat purchase         | simulation     | caught |
| estate drops watches           | simulation     | caught |
| cannot afford check absent     | simulation     | caught |
| all owned yearly values freeze | persistence    | caught |
| loaded collection dropped      | persistence    | caught |
| serialized provenance dropped  | persistence    | caught |

Before mutations, six source/catalog files were tarred. Every file was restored
in a finally block and its MD5 compared to the original, including engine files
that have no production P8 edits. No mutation or scratch harness ships.

## Verification side effect found

`generate-vehicles.py` also writes `vehicle-mods.json`, while the validator restores
only the declared primary `OUT_PATH` on a mismatch. Full verification therefore
left an unrelated formatting-only modification to the secondary output. Confirmed
semantic equality and restored its exact tracked bytes. Do not commit that accidental
change. Validator secondary-output restoration is an open follow-up, not a P8 fix.

## Final review status

Full format check fails the same 22 historical Claude notes. All P8-owned files
pass formatting, and `git diff --check` is clean. Targeted content/simulation/save
suites passed again after restoration. Full verification results above are from
the restored-equivalent production tree. PR and observed CI details will be added
after publishing. No native-device or Project-mirroring claim.
Native device checks and Claude Project mirroring remain unavailable here; neither
is reported complete. Scratch harnesses, logs and backup tar stay outside git.
Stop after P8; P9 needs Payton's next instruction.
