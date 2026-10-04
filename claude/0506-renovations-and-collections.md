# Ticket 0506 — renovations, jewelry and watches, collections, shopping

Spec 153–154 and 1875 (the renovation list), 1385 ("renovations can increase
value/desirability but need not always return more than their cost. Prevent
repeated renovation-value loops"), 1327 (an owned home shows its
renovations), 1890–1893 (watches, chains, bracelets, rings, gold, silver,
platinum and diamonds; diamonds by size and broad quality; art, antiques,
historical, humorous and mythical collectibles; collections that organize
themselves; one sale button), 197 and 1249 (a few mythical objects, extremely
rare), 199 (demand moves value, backend only), 1281 (heirlooms and provenance
across generations) and 1363–1366 (shopping under Assets, a curated handful,
no search).

**The gift system (spec 64 and 1816) is not here.** It's a relationship
feature built on the same goods, and fits better beside the people it's for.
Auctions are 0507.

## Measured first

Two disjoint sets of 150 lives:

- **The homes people lived in were falling apart.** At 45–64, 72–76% were in
  poor condition; past 65, 86–88%. Wear only went one way (8% a year, a step
  down, and nothing ever lifted one), so a home bought became a home in poor
  shape, costing 35% more to keep and worth 18% less. Owned kinds were condos,
  starter houses and townhouses only.
- **Nobody owned jewelry, a watch or a painting.** Shopping and Valuable
  Collections had said "not built yet" since 0108. About half of everybody
  past 45 held $100,000+ in cash. Only 0–4% were worth a million.

## What was built

### Renovations

**Nineteen renovations**, spec 153's and 1875's list and no flooring, exterior
or landscaping. Two kinds:

- **Refreshes** (modern or luxury kitchen, modern or luxury bathroom, luxury
  finishes) lift the home's condition one step. The value moves the way
  condition always moved it. They cost a share of the home's value with a
  floor (a modern kitchen is 10%, at least $25,000). Each can be redone once
  it has aged 15–20 years. A modern kitchen can be upgraded to a luxury one at
  any time.
- **Additions** (bedrooms, security, gym, theater, spa, pool, infinity pool,
  wine cellar, basketball, tennis, bowling, observatory, maze) are done once.
  They're priced by the region's cost index and add 15–65% of their cost to
  the value. A pool costs $3,000 a year to run; the maze $8,000.

`kinds` decides what a home has room for: no pool for a condo, and the maze
for an estate only. Nothing returns its whole cost. The loop is closed by
"once" for additions, by time for refreshes, and by the condition scale
having a top.

**The seventh door** (`home.renovate`): when the home you live in is in poor
or fair condition, 35% of years, the game offers the cheapest refresh you can
pay for out of savings while keeping six months of living in hand. Example:
"Something else broke at the small house this week. A new bathroom would be
$14,000." It's sixth of the seven doors, after a car and before a club.

### Jewelry, watches and collections

**151 pieces** across eleven kinds:

- **Watches (37):** from a $70 Casiot to a $650,000 Patrek Phillon Grand
  Complication, with Rolux, Omegon, Tagg Heuser, Cartrier and the rest.
- **Jewelry (42):** rings, necklaces, chains, bracelets and earrings in
  silver, gold and platinum. Diamonds are given as carats and good or
  excellent, nothing more.
- **Art (23):** by invented artists, from a $450 signed print to a $9.5M
  canvas.
- **Antiques (14), historical pieces (15) and curiosities (14).**
- **Legends (6):** Poseidon's Trident, Pandora's Box, the Diamond Pickaxe, the
  Golden Fleece, the Philosopher's Stone, and a sword pulled from a stone.

**How each holds its value** (`holds`), the thing that decides whether buying
it is spending or saving (spec 140):

- Fashion pieces are worth about a third the day they're bought and fall to a
  tenth.
- Gold and diamonds are worth about 60% and follow a precious-metals market.
- Good watches are worth 75% and drift up slowly.
- The waiting-list Rolux and Patrek pieces are worth 115% of retail.
- Art is worth 70% and swings hard.
- Antiques are worth 75% and rise steadily.
- Curios are worth half, and whatever someone will pay.
- Legends are worth full price and rise.

Each kind has one market a year, shared by every life, plus each piece's own
swing (spec 199).

**Five stores** under Assets → Shopping:

- Halden & Rowe Jewelers.
- The Watch Room.
- Northlight Gallery.
- Old Hollow Antiques & Curiosities.
- Maison Vellard: appointment only, behind a $150,000 hidden gate.

Each shows 5–7 pieces a year, derived from the seed, and never anything over
1.5× your means. A legend can turn up in one antiques slot in 5,000.

**Money.** Buying and selling are `property` transfers, like a house or a car.
A piece counts in net worth at what it would fetch. One sale button sells it
for that.

**The collection sorts itself** onto six shelves (watches, jewelry, art,
antiques and history, curiosities, legendary), dearest first, with each
shelf's worth.

**Heirlooms.** Continuing as a child, the house and cars are sold and the
money passes on, but the watches, rings and paintings pass on as things. There
is no ledger row: a non-cash gift isn't income (spec 1848). Each piece
remembers whose it was ("Was Ruth Calder's").

### Screens

- **Assets:** the Valuable Collections and Shopping rows are live.
- **Homes:** each owned home has a Renovate row, with what's been done.
- **Renovate:** the home's worth, condition and yearly cost, then "Fix it up"
  (refreshes) and "Add to it" (additions). Each option shows its price, what
  the home would be worth afterwards, and the yearly cost to run it.
- **Shopping:** the stores, then a store's counter. Tapping a piece opens its
  one Buy button.
- **Collections:** the shelves. Tapping a piece opens its one Sell button.

Save **v36**: `valuables` and `renovationOffer`, and a home may carry
`renovations`. Older saves get an empty collection.

## Results

Two disjoint sets of 150 lives:

|                                       | before            | after             |
| ------------------------------------- | ----------------- | ----------------- |
| homes lived in, poor condition, 45–64 | 72–76%            | 26–30%            |
| the same, 65+                         | 86–88%            | 24–26%            |
| median net worth, 45–64               | $236,000–$254,000 | $243,000–$261,000 |
| median net worth, 65+                 | $440,000–$454,000 | $436,000–$465,000 |
| median home value, 45–64              | $291,000–$295,000 | $318,000–$320,000 |

Homes now sit mostly at good or fair. Net worth is unchanged within the noise:
the work costs money, and the condition it buys keeps the value.

## Tests

- `content/ownership-0506.test.ts` (6): the spec's renovation list and nothing
  else, recovery under cost, grand things in grand homes; the valuables kinds,
  151 pieces, diamonds by carat, spec 197's three legends, no real brand or
  artist name, every store stocked.
- `finance/ownership-0506.test.ts` (9): refresh and addition pricing,
  condition and value lifted together, never past the top, additions
  recovering less than cost, no loops (once, aged, upgrade allowed), room
  rules, a pool's yearly cost; resale at purchase by kind, fashion to its
  floor, art far more volatile than antiques, one market a year.
- `simulation/ownership-0506.test.ts` (10): poor homes cut below 45% at 45–64
  and 65+, net worth held, renovating by hand (housing row, partial value, no
  repeat), the same counter all year, the hidden gate, buying as a counted
  transfer and selling with one button, shelves sorted, values moving a year
  on, legends rare, heirlooms passed with provenance and no ledger row.
- `persistence` (+1): a collection, a renovated home and an open renovation
  question round-trip; a v35 save gets an empty collection.

**Sabotage.** Seventeen pieces were broken on purpose. Two passed the first
time:

- Legends made common still passed: the test's bound was written in terms of
  the constant it was guarding, so it moved with it.
- Valuables left out of net worth still passed: the test asserted net worth
  fell on a purchase, which it does either way.

Both now assert the size, not the direction (13.91). All seventeen fail a
test.

**Full gate: 1,198 tests, typecheck clean, validator green (15 catalogs, 1,445
ids).**

## Still rough

- **Nobody passive ever buys jewelry or art.** No door, deliberately: taste is
  the player's. Wedding rings are still a 0207 `spending` line, not a piece in
  the collection.
- **The gift system** (spec 64: $, $$, $$$ tiers of real items) is unbuilt,
  and is the natural next use of this catalog.
- **Heirloom discoveries** (spec 1281: finding a grandmother's ring) don't
  exist; only inheritance passes pieces on.
- **Renovations are cash only.** There's no home-equity loan, so a household
  with no savings lets the house go to poor, which is what still accounts for
  most of the remaining quarter.
- **Rental buildings get refreshes too**, but nothing asks a landlord about
  them.
