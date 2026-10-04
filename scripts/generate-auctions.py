#!/usr/bin/env python3
"""
Ticket 0507 — the auctions.

Authoring source for `packages/content/data/auctions.json`. Edit here, run it,
commit both.

Spec 41 and 1899: two general auction houses, each visitable up to twice a
year, with separate inventory and independently varying credibility; one
storage-auction yard that can be visited several times a year; and private /
high-end sales for the wealthy. Spec 1390: "Bargains are possible but
repeated instant buy-resell profit should not be guaranteed."

What is sold comes from the catalogs already built — the valuables (0506) and
the cars (0504). This file is the venues, and the words for storage units:
what you can see through the door, and what turns out to be inside.

`kinds` on a venue are valuable kinds; `cars` are vehicle market tiers.
`means` is the hidden gate (spec 1478: soft eligibility, well below
billionaire). `visits` is the yearly limit.

Usage:  python3 scripts/generate-auctions.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "packages" / "content" / "data" / "auctions.json"

CATALOG_VERSION = 1

GENERAL_KINDS = ["watch", "ring", "necklace", "chain", "bracelet", "earrings", "art", "antique", "historical", "curio"]

VENUES = [
    {
        "id": "auction.hartwell", "name": "Hartwell & Finch", "type": "general", "visits": 2, "lots": 5,
        "means": 0, "kinds": GENERAL_KINDS, "cars": ["classic", "luxury", "mainstream"], "carShare": 0.2,
        "blurb": "Paddles, a gavel, and a man in a bow tie who talks very fast.",
    },
    {
        "id": "auction.crane", "name": "Crane Brothers Auctioneers", "type": "general", "visits": 2, "lots": 5,
        "means": 0, "kinds": GENERAL_KINDS, "cars": ["classic", "luxury", "mainstream"], "carShare": 0.2,
        "blurb": "Three generations of Cranes. Coffee and donuts at the back.",
    },
    {
        "id": "auction.storage", "name": "Lock & Key Storage Auctions", "type": "storage", "visits": 6, "lots": 3,
        "means": 0, "kinds": [], "cars": [], "carShare": 0,
        "blurb": "Unpaid units, sold as they are. Five minutes to look from the door.",
    },
    {
        "id": "auction.private", "name": "Ashcombe Private Sales", "type": "private", "visits": 2, "lots": 4,
        "means": 1_000_000, "kinds": ["watch", "ring", "necklace", "bracelet", "art", "antique", "historical", "mythical"],
        "cars": ["exotic", "classic"], "carShare": 0.3,
        "blurb": "By invitation. Champagne, a catalog with your name on it, and phone bidders from three continents.",
    },
]

# What you can see from the door, by unit size.
PEEKS = {
    "small": [
        "Boxes, a bike, and a lamp with no shade.",
        "A mattress on its side and a stack of plastic tubs.",
        "Garden tools, a cooler, and a box marked FRAGILE.",
        "Suitcases, a fan, and a framed print facing the wall.",
    ],
    "medium": [
        "A couch on its end, boxes, and a tarp over something square.",
        "A dresser, a TV, and a lot of bags tied shut.",
        "Gym equipment, a desk, and a trunk with a padlock.",
        "Kitchen chairs, a filing cabinet, and boxes to the ceiling.",
    ],
    "large": [
        "Furniture to the ceiling, a dresser, and something long under a moving blanket.",
        "A dining set, a piano, and boxes nobody has opened in years.",
        "Racks of clothes, a motorcycle cover with nothing visible under it, and crates.",
        "An entire house, packed in, with a grandfather clock at the front.",
    ],
}

# What else turns out to be inside, sold off as a lot.
JUNK = [
    "boxes of paperbacks", "a rowing machine", "three boxes of Christmas decorations", "a box of VHS tapes",
    "a toolbox", "a dining set", "a drum kit", "a crib", "a set of golf clubs", "a stack of vinyl records",
    "a sewing machine", "camping gear", "a treadmill that doesn't work", "a box of old phones",
    "kitchen things", "a mini fridge", "a recliner", "a bread maker still in the box", "a karaoke machine",
    "fishing rods", "a futon", "a box of baseball cards", "a typewriter", "a croquet set",
]


def main() -> None:
    ids = [v["id"] for v in VENUES]
    assert len(ids) == len(set(ids))
    types = {v["type"] for v in VENUES}
    assert {"general", "storage", "private"} <= types
    assert sum(1 for v in VENUES if v["type"] == "general") == 2, "spec 41: two general houses"
    OUT_PATH.write_text(json.dumps({"version": CATALOG_VERSION, "entries": VENUES, "peeks": PEEKS, "junk": JUNK}, indent=2) + "\n")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}: {len(VENUES)} venues, {sum(len(v) for v in PEEKS.values())} peeks, {len(JUNK)} junk lines")


if __name__ == "__main__":
    main()
