# Ticket 0505 — vehicle modifications

Spec 184 (a limited set: wheels, paint, limited wraps, tint, exhaust, intake,
suspension, ECU tune, brakes, engine upgrades, and no body styling or
interiors), 1329 and 1885 ("mods stay concise, with limited wraps and a
fictional elite modifier house for suitable luxury vehicles"), 1043–1059
("Brabus-like modifier → Tarbus"), 1088 (a vehicle record carries its
modifications) and 1387 ("most modifications recover only part of cost at
resale").

## Measured first

No car in the build could be changed at all. Across 0504's two samples (300
lives, about 1,200 cars bought), 92% of cars were mainstream, 8% luxury and
none exotic or classic. The median purchase was $22,000 (p10 $11,000, p90
$40,000). So a modification has to be priced for a $12,000 Hondo and a
$300,000 Ferrano both.

**No door.** Modifying a car is a hobby a few people choose. The game asking
the passive population would be choosing one for them. The same call as
0503's landlords.

## What was built

**The catalog** (`vehicle-mods.json`, from `generate-vehicles.py`). Nineteen
options across spec 184's ten slots. Paint and wraps share one slot, because a
wrap goes over the paint. There are three wraps (matte black, satin gray,
racing stripes), which is the "intentionally limited" the spec asks for. There
are no body kits, spoilers or interiors. One option fits per slot, and fitting
another replaces it.

**Priced for the car it goes on.** Each option has a band from a $20,000 car
to a $400,000 car, read on the log of the car's price:

| | $25k car | $90k car | $300k car | recovers |
|---|---|---|---|---|
| Forged wheels | $4,300 | $8,750 | $13,000 | 35% |
| Full respray | $3,900 | $9,000 | $13,850 | 30% |
| Matte black wrap | $3,100 | $4,900 | $6,600 | 10% |
| Cat-back exhaust | $1,300 | $3,450 | $5,500 | 25% |
| Coilovers | $1,850 | $3,750 | $5,550 | 25% |
| Stage 2 tune | $1,500 | $3,100 | $4,650 | 0% |
| Big brake kit | $2,200 | $4,400 | $6,500 | 30% |
| Turbo upgrade | $5,200 | $12,050 | $18,450 | 30% |

**Tarbus.** The elite modifier house converts the cars it's known for: the
Merceda line (C, E, S, GLX, Gelander) and the Porsha 912 and Taycon. A
conversion costs 40% of the car's price. It covers the engine, exhaust,
intake, suspension, tune and wheels, so nothing else can be fitted there. It
recovers 70% of its cost, and the car carries the name: "2041 Merceda
Gelander G 63 AMR Tarbus".

**What it's worth.** A modification adds its recovery share of the cost to
the car's value the day it's fitted. That part ages with the car from then
on. A tune adds nothing, because a buyer reads it as a voided warranty. A
classic goes the other way: collectors pay most for an original car, so every
change takes 4% off what it's worth.

**What it does.**

- A tune or an engine upgrade works the car harder: maintenance and the
  chance of a big repair rise 8–15% each.
- Better brakes cut the chance of a crash by 20–25%; coilovers by 5%.
- The car's screen shows the higher maintenance, and its monthly cost
  includes it.

**Money.** Cash only, because nobody lends against a set of wheels. A fitting
is a `vehicle` row (spending, not a transfer). What the car is worth more for
it shows in the car's value, and so in net worth, the sale price and an
heir's share.

**Screens.** An owned car gets a Modifications card: what's fitted, with what
was paid and when, and "Take it to a shop". The shop lists each slot this car
can do something in. A slot it can never use is left out: no exhaust on a
Teslo, no Tarbus on a Hondo. Each option shows its price and what the car
would be worth afterwards ("Adds about $1,500 to what it's worth"), or why
not ("Tarbus already did that"). Tapping an option opens one "Fit it" button.

Save **v35**: a car may carry `mods`. Nothing earlier could, so the migration
only bumps the version.

## Tests

- `content/vehicles.test.ts` (+4): spec 184's slots and nothing else, three
  wraps at most, every option recovering under its cost and the Tarbus
  conversion more than any shop part, and Tarbus only on suitable Merceda and
  Porsha models.
- `finance/vehicles.test.ts` (+8): price by the car, what each car refuses and
  why, one thing per slot (a wrap replaces paint, Tarbus clears what it
  covers), the partial value that then ages, Tarbus holding 60%+, a classic
  losing value, strain and grip, and mods carried through a year.
- `simulation/vehicles.test.ts` (+4): fitting is spending and the car is worth
  only part of it more, a year later it's still there, refusals by name and
  cash, a Tarbus conversion (name, coverage, value, sale), and a tuned car's
  maintenance on screen.
- `persistence` (+1): a converted car round-trips, and a v34 save carries
  forward.

**Sabotage.** Sixteen pieces were broken on purpose, and every one fails a
test. The first run found one gap: Tarbus allowed on any car still passed,
because the luxury-only rule also refused it on the Hondo the test used. The
test now also tries an RBW, a luxury car Tarbus doesn't convert (13.91 again).

**Full gate: 1,172 tests, typecheck clean, validator green (13 catalogs, 1,275
ids).**

## Still rough

- **Nothing can be taken off.** A fitted mod stays until it's replaced in its
  slot or the car is sold.
- **No modding effect on the character.** Spending on a car you love doesn't
  touch happiness. That's deliberate (13.48: a stat you can raise by spending
  is a stat the player will spend for), but it's a decision worth confirming.
- **The Luxury market gate means most players never see a Tarbus-capable
  car.** Only Merceda and Porsha models qualify, and those are sold new only
  behind the luxury gate. A used C-Line can turn up on Second Street
  Pre-Owned.
