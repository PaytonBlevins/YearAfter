#!/usr/bin/env python3
"""
Ticket 0506 — what can be done to a home.

Authoring source for `packages/content/data/renovations.json`. Edit here, run
it, commit both.

Spec 153–154 and 1875, verbatim: Modern Kitchen, Luxury Kitchen, Modern
Bathroom, Luxury Bathroom, Pool, Additional Bedroom 1, Additional Bedroom 2
where supported, Luxury Finishes, Spa, Infinity Pool, Wine Cellar, Maze,
Observatory, Security System, Home Theater, Tennis Court, Basketball Court, Gym
and Bowling Alley, plus the nine approved P9 amenities. Patio and front-yard
fountain are explicit exceptions; no broad flooring/exterior/landscaping editor.

TWO KINDS OF RENOVATION.

  `refresh`  — the kitchens, the bathrooms and the finishes. Each lifts the
               home's condition one step, and that is where its value comes
               from (the condition multiplier a listing already prices). They
               wear out like the rooms they are, so each can be done again
               once `redoAfter` years have passed.

  addition   — everything else. Done once. It adds `recovery` of its cost to
               what the home is worth (spec 1385: "renovations can increase
               value/desirability but need not always return more than their
               cost") and some add a yearly cost to run.

`kinds` is where a renovation is possible, by home kind. A condo has no
garden for a pool; only an estate has room for a maze.

COSTS are 2025 US figures at cost index 1.00 (Remodeling's Cost vs. Value
and ordinary contractor ranges). A refresh is a share of the home's value with
a floor — a kitchen in a $1.3M house is not the kitchen in a $230k condo. An
addition is a fixed price, scaled by the region's cost index.

Usage:  python3 scripts/generate-renovations.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "packages" / "content" / "data" / "renovations.json"

CATALOG_VERSION = 1

ALL = ["home.condo", "home.townhouse", "home.starter", "home.family", "home.large", "home.luxury",
       "home.estate", "home.duplex", "home.apartments-small", "home.apartments-medium",
       "home.apartments-large"]
LIVED = ["home.condo", "home.townhouse", "home.starter", "home.family", "home.large", "home.luxury", "home.estate"]
ATTACHED = ["home.townhouse", "home.starter", "home.family", "home.large", "home.luxury", "home.estate"]
HOUSES = ["home.starter", "home.family", "home.large", "home.luxury", "home.estate"]
ROOMY = ["home.family", "home.large", "home.luxury", "home.estate"]
BIG = ["home.large", "home.luxury", "home.estate"]
GRAND = ["home.luxury", "home.estate"]

ENTRIES: list[dict] = []


def refresh(id: str, name: str, group: str, share: float, floor: int, recovery: float, redo: int, blurb: str) -> None:
    ENTRIES.append({
        "id": id, "name": name, "group": group, "refresh": True,
        "share": share, "floor": floor, "cost": 0, "recovery": recovery,
        "upkeep": 0, "beds": 0, "redoAfter": redo, "kinds": ALL, "blurb": blurb,
    })


def addition(id: str, name: str, group: str, cost: int, recovery: float, upkeep: int, kinds: list[str],
             blurb: str, beds: int = 0, needs: str | None = None) -> None:
    entry = {
        "id": id, "name": name, "group": group, "refresh": False,
        "share": 0, "floor": 0, "cost": cost, "recovery": recovery,
        "upkeep": upkeep, "beds": beds, "redoAfter": 0, "kinds": kinds, "blurb": blurb,
    }
    if needs:
        entry["needs"] = needs
    ENTRIES.append(entry)


# Refreshes: a share of the home's value, a floor, and the condition step. The
# luxury versions also add a little on top, and replace the modern one.
refresh("reno.kitchen-modern", "Modern Kitchen", "kitchen", 0.10, 25_000, 0.0, 15,
        "New cabinets, counters and appliances.")
refresh("reno.kitchen-luxury", "Luxury Kitchen", "kitchen", 0.20, 75_000, 0.2, 15,
        "Stone counters, an island, and a range nobody needs.")
refresh("reno.bath-modern", "Modern Bathroom", "bath", 0.07, 15_000, 0.0, 15,
        "New tile, fixtures and a shower that works.")
refresh("reno.bath-luxury", "Luxury Bathroom", "bath", 0.14, 40_000, 0.2, 15,
        "A soaking tub, heated floors and double sinks.")
refresh("reno.finishes", "Luxury Finishes", "finishes", 0.15, 50_000, 0.15, 20,
        "Hardwood, millwork and lighting through the whole place.")

# Additions: once each. `recovery` is what a buyer pays for it.
addition("reno.bedroom-1", "Additional Bedroom", "bedroom-1", 90_000, 0.65, 0, ATTACHED,
         "Another bedroom, built on.", beds=1)
addition("reno.bedroom-2", "Second Additional Bedroom", "bedroom-2", 110_000, 0.6, 0, ROOMY,
         "Room for one more, where the lot allows it.", beds=1, needs="reno.bedroom-1")
addition("reno.security", "Security System", "security", 12_000, 0.3, 600, LIVED,
         "Cameras, sensors and a monitored alarm.")
addition("reno.gym", "Home Gym", "gym", 35_000, 0.2, 0, ATTACHED,
         "A room of machines you will use more in January.")
addition("reno.theater", "Home Theater", "theater", 50_000, 0.25, 0, ATTACHED,
         "A projector, real seats and the good speakers.")
addition("reno.spa", "Spa", "spa", 15_000, 0.3, 1_200, HOUSES,
         "A hot tub on the deck.")
addition("reno.pool", "Pool", "pool", 65_000, 0.45, 3_000, HOUSES,
         "An in-ground pool. Summer is different now.")
addition("reno.infinity-pool", "Infinity Pool", "pool", 180_000, 0.4, 6_000, GRAND,
         "The edge disappears into the view.")
addition("reno.wine-cellar", "Wine Cellar", "wine-cellar", 60_000, 0.35, 0, BIG,
         "Racks for a thousand bottles, kept at fifty-five degrees.")
addition("reno.basketball", "Basketball Court", "basketball", 45_000, 0.3, 800, BIG,
         "A half court, lights and a real hoop.")
addition("reno.tennis", "Tennis Court", "tennis", 90_000, 0.3, 2_500, GRAND,
         "A full court, fenced and lit.")
addition("reno.bowling", "Bowling Alley", "bowling", 200_000, 0.15, 3_000, GRAND,
         "Two lanes in the basement. Nobody believes you until they see it.")
addition("reno.observatory", "Observatory", "observatory", 250_000, 0.2, 3_000, GRAND,
         "A dome on the roof and a telescope worth more than a car.")
addition("reno.maze", "Maze", "maze", 120_000, 0.15, 8_000, ["home.estate"],
         "A hedge maze. Somebody has to trim it.")


# P9: approved additions. All are amenities, not separately rented units.
addition("reno.sauna", "Sauna", "sauna", 12_000, 0.25, 300, ATTACHED,
         "A warm room for a quiet end to the day.")
addition("reno.patio", "Patio", "patio", 15_000, 0.5, 300, HOUSES,
         "A paved spot to sit outside and eat with friends.")
addition("reno.game-room", "Game Room", "game-room", 25_000, 0.2, 300, ATTACHED,
         "A room for games, with space to leave the table set up.")
addition("reno.study", "Private Study", "study", 18_000, 0.35, 0, LIVED,
         "A quiet room with shelves and a desk of your own.")
addition("reno.fountain", "Front-yard Fountain", "fountain", 20_000, 0.15, 600, ROOMY,
         "Running water by the front walk. The pump needs care.")
addition("reno.guest-house", "Guest House", "guest-house", 180_000, 0.5, 2_000, GRAND,
         "A small place for visiting family and friends. It isn't a rental unit.")
addition("reno.studio", "Recording Studio", "studio", 45_000, 0.15, 600, BIG,
         "A sound-treated room to make recordings without waking the house.")
addition("reno.indoor-pool", "Indoor Pool", "pool", 250_000, 0.3, 8_000, GRAND,
         "A pool under a roof. Heating and ventilation are year-round bills.")
addition("reno.outdoor-kitchen", "Outdoor Kitchen", "outdoor-kitchen", 20_000, 0.35, 500, ROOMY,
         "A grill, counters and a sink for cooking outside.")

# Space and comfort are catalog metadata. They never change existing paid costs.
AMENITIES = {
    "gym": (1, 1), "theater": (1, 1), "spa": (1, 1), "pool": (3, 2),
    "infinity-pool": (4, 2), "wine-cellar": (1, 1), "basketball": (3, 1),
    "tennis": (4, 1), "bowling": (3, 1), "observatory": (2, 1), "maze": (4, 1),
    "sauna": (1, 1), "patio": (1, 1), "game-room": (1, 1), "study": (1, 1),
    "fountain": (1, 1), "guest-house": (4, 1), "studio": (2, 1),
    "indoor-pool": (4, 2), "outdoor-kitchen": (1, 1),
}
for entry in ENTRIES:
    entry["space"], entry["happiness"] = AMENITIES.get(entry["id"].removeprefix("reno."), (0, 0))


# How each one reads in a sentence: "Had a new kitchen put in at the condo."
PHRASES = {
    "reno.kitchen-modern": "a new kitchen",
    "reno.kitchen-luxury": "a luxury kitchen",
    "reno.bath-modern": "a new bathroom",
    "reno.bath-luxury": "a luxury bathroom",
    "reno.finishes": "new finishes throughout",
    "reno.bedroom-1": "another bedroom",
    "reno.bedroom-2": "one more bedroom",
    "reno.security": "a security system",
    "reno.gym": "a home gym",
    "reno.theater": "a home theater",
    "reno.spa": "a hot tub",
    "reno.pool": "a pool",
    "reno.infinity-pool": "an infinity pool",
    "reno.wine-cellar": "a wine cellar",
    "reno.basketball": "a basketball court",
    "reno.tennis": "a tennis court",
    "reno.bowling": "a bowling alley",
    "reno.observatory": "an observatory",
    "reno.maze": "a hedge maze",
    "reno.sauna": "a sauna", "reno.patio": "a patio", "reno.game-room": "a game room",
    "reno.study": "a private study", "reno.fountain": "a front-yard fountain",
    "reno.guest-house": "a guest house", "reno.studio": "a recording studio",
    "reno.indoor-pool": "an indoor pool", "reno.outdoor-kitchen": "an outdoor kitchen",
}
for _entry in ENTRIES:
    _entry["phrase"] = PHRASES[_entry["id"]]


def catalog_text() -> str:
    """Stable authored layout with canonical JSON numbers."""
    text = json.dumps({"version": CATALOG_VERSION, "entries": ENTRIES}, indent=2)
    text = re.sub(r'(?<=: )([0-9]+)\.0(?=,|\n)', r'\1', text)
    # Match the original short kinds lists; keep longer lists on separate lines.
    def kinds_layout(match: re.Match) -> str:
        compact = match[1] + json.dumps(json.loads(match[2])) + ","
        return compact if len(compact) <= 100 else match[0]
    return re.sub(r'^( +"kinds": )(\[\n(?:\s*"[^"\n]+",?\n)+\s*\]),',
                  kinds_layout, text, flags=re.MULTILINE) + "\n"


def main() -> None:
    ids = [e["id"] for e in ENTRIES]
    assert len(ids) == len(set(ids))
    for e in ENTRIES:
        assert 0 <= e["recovery"] < 1, e["id"]
        assert isinstance(e["space"], int) and e["space"] >= 0, e["id"]
        assert isinstance(e["happiness"], int) and 0 <= e["happiness"] <= 2, e["id"]
        if "needs" in e:
            assert e["needs"] in ids, e["id"]
    OUT_PATH.write_text(catalog_text())
    print(f"wrote {OUT_PATH.relative_to(ROOT)}: {len(ENTRIES)} renovations")


if __name__ == "__main__":
    main()
