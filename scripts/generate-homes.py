#!/usr/bin/env python3
"""
Ticket 0501 — the homes a character can buy and live in.

Authoring source for `packages/content/data/homes.json`. Edit here, run it,
commit both.

Kinds, not houses. A listing is generated from a kind each year (spec 147:
refresh once per game year) — bedrooms, bathrooms, age and condition drawn
inside the kind's ranges, the price from its band scaled by the region. So the
catalog stays small and readable while no two years' listings are the same.

Prices are benchmarked to US ordinary-market asking prices at a cost index of
1.00 (spec 1088: price datasets reference real-world bands).

Ticket 0503 added rental property: duplexes (spec 145: two renter units) and
apartment complexes fixed at 5, 10 or 25 units. They are `rental` kinds — a
character owns them to let them, never to live in them — and they are listed
separately from homes so a year's eight homes stay eight homes.

`rentYield` is a year's rent at the going rate as a share of the price, at
cost index 1.00. Rent follows a place's cost of living roughly in step while
prices follow it squared (`PRICE_ELASTICITY`), so the yield in a dear region
is lower and in a cheap one higher — which is the real pattern, and the
reason a duplex in Ohio pays and one in California mostly does not. Bands are
set against ordinary US gross yields at an average cost of living: about
6–7% for a house and 8–9% for small multifamily, reaching 10–11% in the
cheapest states and 5–6% in the dearest. Rental economics are never shown on a listing (spec 145); they
appear once a character sets out to let a place (spec 149–150).

Spec 145 decides what a listing may say and it is short on purpose: type,
bedrooms, bathrooms, age, condition, asking price, financing, and an estimated
annual expense. Nothing here produces a square footage, a market value, a tax
line or a rental estimate, so no screen can show one by accident.

`means` is the hidden gate. Spec 1356's rule for the business marketplace —
"financially gated without visible wealth-tier labels" — is the right one for
homes too: a character with $4,000 is not shown a mansion, and nothing on the
screen says why. It is a floor on what the character could plausibly afford,
in whole dollars, read against their cash plus a multiple of their income.

Usage:  python3 scripts/generate-homes.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "packages" / "content" / "data" / "homes.json"

CATALOG_VERSION = 2

KINDS: list[dict] = []


def K(
    id: str,
    name: str,
    noun: str,
    *,
    beds: tuple[int, int],
    baths: tuple[int, int],
    price: tuple[int, int],
    expense: float,
    age: tuple[int, int],
    weight: int,
    means: int = 0,
    units: int = 1,
    rental: bool = False,
    rent_yield: float,
    blurbs: list[str],
) -> None:
    """
    One kind of home.

    `price`   asking-price band at cost index 1.00, whole dollars.
    `expense` what a year of owning it costs as a share of its value — taxes,
              insurance and upkeep folded into one number, because spec 151
              removes insurance and HOA as mechanics and spec 145 asks for a
              single "estimated annual expense".
    `means`   the hidden gate, see the module docstring.
    `units`   how many households it lets to. One for a house.
    `rental`  owned to let, never lived in (0503).
    `rent_yield` a year's rent at the going rate over the price, index 1.00.
    """
    KINDS.append(
        {
            "id": id,
            "name": name,
            "noun": noun,
            "beds": list(beds),
            "baths": list(baths),
            "price": list(price),
            "expenseRate": expense,
            "age": list(age),
            "weight": weight,
            "means": means,
            "units": units,
            "rental": rental,
            "rentYield": rent_yield,
            "blurbs": blurbs,
        }
    )


# Where most people start. Cheapest to buy and the dearest to keep per dollar,
# because the building's upkeep is shared and billed.
K("home.condo", "Condo", "a condo",
  beds=(1, 2), baths=(1, 2), price=(190_000, 330_000), expense=0.026, age=(2, 45), weight=5,
  rent_yield=0.065,
  blurbs=["A unit on the fourth floor with a view of the next building.",
          "Two rooms and a balcony nobody has used since it was built.",
          "Ground floor, next to the laundry room, very quiet."])

K("home.townhouse", "Townhouse", "a townhouse",
  beds=(2, 3), baths=(1, 3), price=(260_000, 420_000), expense=0.022, age=(0, 40), weight=4,
  rent_yield=0.063,
  blurbs=["End of a terrace, with a yard the size of a parking space.",
          "Three floors and a lot of stairs.",
          "Shares a wall with somebody who plays the cello."])

# Old and honest about it — the price is the age.
K("home.starter", "Starter House", "a small house",
  beds=(2, 3), baths=(1, 2), price=(230_000, 380_000), expense=0.023, age=(25, 80), weight=5,
  rent_yield=0.07,
  blurbs=["Small, old, and in better shape than the listing photos.",
          "A porch, a garden gone to seed, and a boiler with opinions.",
          "Two bedrooms and a kitchen from another decade."])

K("home.family", "Family House", "a family house",
  beds=(3, 4), baths=(2, 3), price=(360_000, 620_000), expense=0.02, age=(5, 60), weight=5,
  rent_yield=0.06,
  blurbs=["A proper yard and a street where kids still ride bikes.",
          "Four bedrooms, one of them currently full of boxes.",
          "Close to a school, far from anything exciting."])

K("home.large", "Large House", "a large house",
  beds=(4, 5), baths=(3, 4), price=(600_000, 1_100_000), expense=0.019, age=(0, 40), weight=2,
  means=120_000,
  rent_yield=0.05,
  blurbs=["A double garage and a room nobody has decided what to use for.",
          "Big enough that you could lose somebody in it for an afternoon.",
          "A kitchen island you could land a plane on."])

K("home.luxury", "Luxury Home", "a luxury home",
  beds=(5, 6), baths=(4, 6), price=(1_300_000, 3_200_000), expense=0.017, age=(0, 25), weight=1,
  means=600_000,
  rent_yield=0.04,
  blurbs=["Glass on three sides and a pool that runs off the edge of the view.",
          "Gated, with a drive long enough to need a second opinion.",
          "A name on the gatepost instead of a number."])

K("home.estate", "Estate", "an estate",
  beds=(6, 9), baths=(6, 10), price=(4_000_000, 14_000_000), expense=0.016, age=(0, 100), weight=1,
  means=4_000_000,
  rent_yield=0.03,
  blurbs=["Acres, a gatehouse, and staff quarters that are nicer than most homes.",
          "A house with wings, and a map in the hall to find them.",
          "Old money built it. It still smells faintly of it."])


# =============================================================================
# Rental property (Ticket 0503). Owned to let, never to live in.
# =============================================================================

K("home.duplex", "Duplex", "a duplex",
  beds=(4, 6), baths=(2, 4), price=(330_000, 620_000), expense=0.024, age=(10, 90), weight=4,
  means=150_000, units=2, rental=True, rent_yield=0.078,
  blurbs=["Two front doors, two meters, one roof to worry about.",
          "Upstairs and downstairs, with a shared yard nobody mows.",
          "A side-by-side on a quiet street, both halves let before."])

K("home.apartments-small", "Small Apartment Building", "a small apartment building",
  beds=(5, 10), baths=(5, 7), price=(780_000, 1_350_000), expense=0.026, age=(15, 80), weight=3,
  means=350_000, units=5, rental=True, rent_yield=0.082,
  blurbs=["Five apartments over a laundromat that isn't part of the sale.",
          "A brick walk-up with five buzzers and one working.",
          "Five units around a courtyard with a fig tree in it."])

K("home.apartments-medium", "Apartment Building", "an apartment building",
  beds=(10, 20), baths=(10, 14), price=(1_500_000, 2_600_000), expense=0.026, age=(10, 70), weight=2,
  means=800_000, units=10, rental=True, rent_yield=0.084,
  blurbs=["Ten units, a parking lot and a dumpster with a reputation.",
          "Three floors, ten doors and an elevator inspected last year.",
          "A tidy block of ten with a long waiting list, or so the agent says."])

K("home.apartments-large", "Apartment Complex", "an apartment complex",
  beds=(25, 50), baths=(25, 35), price=(3_800_000, 6_500_000), expense=0.027, age=(5, 60), weight=1,
  means=2_000_000, units=25, rental=True, rent_yield=0.087,
  blurbs=["Twenty-five units, a pool, and a sign out front waiting for a new name.",
          "Two buildings facing each other across a parking lot.",
          "A complex with its own mailroom and a maintenance shed."])


# =============================================================================
# Self-checks
# =============================================================================


def check() -> None:
    problems: list[str] = []
    ids = [k["id"] for k in KINDS]
    for kid, count in Counter(ids).items():
        if count > 1:
            problems.append(f"duplicate home kind {kid!r}")
    for k in KINDS:
        kid = k["id"]
        if not kid.startswith("home."):
            problems.append(f"{kid}: ids start with 'home.'")
        for field in ("beds", "baths", "price", "age"):
            low, high = k[field]
            if low > high:
                problems.append(f"{kid}: {field} range is inverted")
        if k["price"][0] < 50_000:
            problems.append(f"{kid}: a home under $50,000 is not a home in this catalog")
        if not (0.005 <= k["expenseRate"] <= 0.05):
            problems.append(f"{kid}: expense rate {k['expenseRate']} is outside 0.5%-5%")
        if k["rental"] and k["units"] not in (1, 2, 5, 10, 25):
            problems.append(f"{kid}: spec 145 fixes rental buildings at 2, 5, 10 or 25 units")
        if not k["rental"] and k["units"] != 1:
            problems.append(f"{kid}: a home somebody lives in is one household")
        if not (0.02 <= k["rentYield"] <= 0.12):
            problems.append(f"{kid}: rent yield {k['rentYield']} is outside 2%-12%")
        if k["baths"][1] > k["beds"][1] * 2:
            problems.append(f"{kid}: more than two bathrooms a bedroom")
        if len(k["blurbs"]) < 3:
            problems.append(f"{kid}: needs at least 3 blurbs so listings do not repeat")
        for blurb in k["blurbs"]:
            if blurb.strip()[-1] not in ".!?":
                problems.append(f"{kid}: blurb is unpunctuated: {blurb!r}")
            if len(blurb) > 80:
                problems.append(f"{kid}: blurb is {len(blurb)} chars; keep it under 80 for a phone")
    # Somebody with nothing has to be able to see something.
    if not any(k["means"] == 0 and k["price"][0] <= 250_000 and not k["rental"] for k in KINDS):
        problems.append("nothing an ordinary first-time buyer could be shown")
    if problems:
        print(f"\n{len(problems)} problem(s) in the home catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def main() -> None:
    check()
    OUT_PATH.write_text(
        json.dumps({"version": CATALOG_VERSION, "entries": KINDS}, indent=2, ensure_ascii=False)
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"{len(KINDS)} kinds of home")
    for k in KINDS:
        print(f"  {k['id']:<16} ${k['price'][0]:>10,} - ${k['price'][1]:>10,}  means ${k['means']:>9,}")


if __name__ == "__main__":
    main()
