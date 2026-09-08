#!/usr/bin/env python3
"""
Ticket 0210b — who you would actually be working for.

Review asked for the job card BitLife shows, and it names an employer. A listing
that says "Sales associate, $27k" is a row in a spreadsheet; one that says
"Sales associate at Kellerman & Fisk" is a job.

Employers are drawn per TRACK and stably per (year, job), so the same opening
is at the same company every time the player looks at it, and next year's
opening for the same title is somewhere else. Nothing else depends on them —
they are texture, not state, which is why they are not stored on the save.

All fictional. Spec forbids borrowed branding; every one of these is invented.

Run: python3 scripts/generate-employers.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "packages/content/data/employers.json"

CATALOG_VERSION = 1

EMPLOYERS: dict[str, list[str]] = {
    "retail": [
        "Marlow & Pine", "Halcott Stores", "The Bramble Group", "Verity Home",
        "Ashgrove Retail", "Ninth Street Supply",
    ],
    "food": [
        "The Copper Kettle", "Solano's", "Birchwood Tavern", "Fig & Ash",
        "The Weathervane", "Muroto Kitchen",
    ],
    "trades": [
        "Fenwick Contracting", "Bright Line Electric", "Aldergate Builders",
        "Rusk & Sons", "Cardinal Mechanical", "Stonebridge Works",
    ],
    "office": [
        "Kellerman & Fisk", "Arbor Analytics", "Whitlock Partners",
        "Meridian Consulting", "Pellham Group", "Coastwise Advisory",
    ],
    "care": [
        "St. Alder Medical", "Willowbrook Care", "Havenridge Health",
        "Marian Hollis Hospital", "Cedar County Health", "Northgate Clinic",
    ],
    "logistics": [
        "Tannerman Freight", "Blue Ridge Logistics", "Overland Haulage",
        "Pratt Distribution", "Redfern Warehousing", "Cross Creek Transport",
    ],
    "sales": [
        "Quill & Marchant", "Aspen Realty Partners", "Devereaux Financial",
        "Halstead Brokers", "Ironwood Capital", "The Ferris Agency",
    ],
    "creative": [
        "Fable & Grain", "Studio Verhoek", "The Wren Collective",
        "Ostrander Design", "Bright Fold", "Marrow Creative",
    ],
    "public": [
        "City of Rockhaven", "Dunmore County", "Office of the City Clerk",
        "Fairhaven Municipal", "State Records Bureau", "Talbot County",
    ],
    "education": [
        "Ridgeview Public Schools", "St. Brendan's Academy", "Lakemont Unified",
        "Harrowgate School District", "Beckett Elementary", "Pinehurst Schools",
    ],
    "safety": [
        "Rockhaven Police Department", "Dunmore County Sheriff",
        "Fairhaven PD", "Talbot County Emergency",
        "Rockhaven Fire & Rescue", "Metro Dispatch Center",
    ],
}


def check() -> None:
    problems: list[str] = []
    seen: set[str] = set()
    jobs = json.loads((ROOT / "packages/content/data/jobs.json").read_text())
    tracks = {job["track"] for job in jobs["entries"]}

    for track in sorted(tracks):
        if track not in EMPLOYERS:
            problems.append(f"track {track!r} has no employers — its listings would be nameless")

    for track, names in EMPLOYERS.items():
        if len(names) < 4:
            problems.append(f"{track}: only {len(names)} employers — the same name every year")
        for name in names:
            if name in seen:
                problems.append(f"duplicate employer name {name!r}")
            seen.add(name)
            # The card renders this on one line beside a label.
            if len(name) > 30:
                problems.append(f"{name!r} is {len(name)} chars and will clip on the job card")

    if problems:
        print(f"{len(problems)} problem(s) in the employer catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def main() -> None:
    check()
    payload = {"version": CATALOG_VERSION, "byTrack": EMPLOYERS}
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"{sum(len(v) for v in EMPLOYERS.values())} employers across {len(EMPLOYERS)} tracks")


if __name__ == "__main__":
    main()
