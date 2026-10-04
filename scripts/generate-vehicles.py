#!/usr/bin/env python3
"""
Ticket 0504 — the vehicles a character can buy.

Authoring source for `packages/content/data/vehicles.json`. Edit here, run it,
commit both.

MODELS AND TRIMS, NOT CARS. A listing on a lot is generated from a trim each
year (spec 849–878: listings refresh once a game year): the model year, the
condition and the hidden service history are drawn when the lot is stocked, and
the price comes from the trim's reference price and how a car of that kind
holds its value. So the catalog is a table of what exists, and no two years'
lots are the same.

SPEC 1088 AND 1456 — RECOGNISABLE FICTIONAL ANALOGUES. Every brand and model
here is invented and every one of them is meant to be recognised: "Royata
GT4 100" is the spec's own example. Trims are the real shape of each family
(a base, a volume trim, a sporty or luxury top trim), and every price is
benchmarked to the comparable real-world MSRP band (2025, whole dollars) so a
player who knows cars reads the market as a real one. Final branding is subject
to legal review (spec 2004); the names live here and nowhere in logic.

Spec 1329 and 1877: four markets — New, Used, Online and Luxury — with up to two
lots in each broad new/used bracket and two smaller luxury lots. The lots are
defined here too, so their names are content.

Spec 141: no mileage. A car's value comes from its age, its model, its
condition, a hidden service history, accident history where it matters, and
rarity. `retention` is how a model holds its value (a Royata holds it, a big
German sedan does not); `collectible` marks the few that stop falling and
start rising (spec 1387: "select collector/exotic cars can appreciate").
Classics are listed at a collector's price, not off a depreciation curve.

`reliability` scales maintenance and the chance of trouble. 1.0 is ordinary.

Usage:  python3 scripts/generate-vehicles.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "packages" / "content" / "data" / "vehicles.json"
MODS_PATH = ROOT / "packages" / "content" / "data" / "vehicle-mods.json"

# Version 2 (Ticket 0505): `tarbus` on the models the elite modifier house
# converts, and the modification catalog in `vehicle-mods.json`.
CATALOG_VERSION = 2

MODELS: list[dict] = []

# How a body type reads in a sentence and on a listing.
BODIES = {
    "sedan": "Sedan",
    "hatch": "Hatchback",
    "suv": "SUV",
    "truck": "Pickup",
    "minivan": "Minivan",
    "coupe": "Coupe",
    "convertible": "Convertible",
    "wagon": "Wagon",
    "van": "Van",
}

# market: mainstream (New and Used lots, Online), luxury (Luxury lots, and
# Used/Online once they are older), exotic (Luxury lots only), classic
# (the collector lot only).
MARKETS = ("mainstream", "luxury", "exotic", "classic")
RETENTION = ("strong", "average", "weak", "exotic")


def M(
    brand: str,
    model: str,
    body: str,
    market: str,
    retention: str,
    reliability: float,
    trims: list[tuple[str, int]],
    *,
    electric: bool = False,
    collectible: bool = False,
    year: int | None = None,
    blurb: str = "",
) -> None:
    assert body in BODIES, body
    assert market in MARKETS, market
    assert retention in RETENTION, retention
    slug = f"{brand}-{model}".lower()
    for ch in " '.&/":
        slug = slug.replace(ch, "-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    slug = slug.strip("-")
    entry = {
        "id": f"car.{slug}",
        "brand": brand,
        "model": model,
        "body": body,
        "market": market,
        "retention": retention,
        "reliability": reliability,
        "electric": electric,
        "collectible": collectible or market == "classic",
        "trims": [
            {
                "id": f"car.{slug}.{t.lower().replace(' ', '-').replace('/', '-').replace('.', '')}",
                "name": t,
                "price": p,
            }
            for t, p in trims
        ],
        "blurb": blurb,
    }
    if year is not None:
        entry["year"] = year
    MODELS.append(entry)


# --------------------------------------------------------------------------- #
# Mainstream — what most people drive                                         #
# --------------------------------------------------------------------------- #

# Royata (the Toyota analogue). Holds its value better than anything.
M("Royata", "Corvana", "sedan", "mainstream", "strong", 0.85,
  [("LE", 23_500), ("SE", 26_000), ("XSE", 29_000)],
  blurb="The car everybody's aunt has, for good reason.")
M("Royata", "Camden", "sedan", "mainstream", "strong", 0.85,
  [("LE", 29_000), ("SE", 31_500), ("XSE", 35_000)],
  blurb="Beige, quiet, and still starting every morning at two hundred thousand.")
M("Royata", "RAV-5", "suv", "mainstream", "strong", 0.85,
  [("LE", 29_800), ("XLE", 32_000), ("Limited", 38_000)],
  blurb="The default answer to 'what should I buy?'")
M("Royata", "Highrider", "suv", "mainstream", "strong", 0.9,
  [("LE", 40_000), ("XLE", 45_000), ("Platinum", 52_000)],
  blurb="Three rows, soccer practice, no drama.")
M("Royata", "Tacora", "truck", "mainstream", "strong", 0.9,
  [("SR", 32_000), ("TRD Sport", 38_000), ("TRD Pro", 64_000)],
  blurb="Mid-size pickup that refuses to lose value.")
M("Royata", "Tundro", "truck", "mainstream", "strong", 0.95,
  [("SR5", 45_000), ("Limited", 56_000), ("Capstone", 80_000)])
M("Royata", "Prion", "hatch", "mainstream", "strong", 0.85,
  [("LE", 28_500), ("XLE", 32_000), ("Limited", 36_000)],
  blurb="Sips fuel. Looks better than it used to.")
M("Royata", "GT4", "coupe", "mainstream", "strong", 0.95,
  [("Base", 29_500), ("Premium", 32_500), ("100", 35_000)],
  blurb="Small, light, rear-wheel drive and a lot of fun.")
M("Royata", "Land Crusader", "suv", "mainstream", "strong", 0.9,
  [("1958", 57_000), ("Land Crusader", 68_000)],
  blurb="Built to cross a continent. Mostly crosses parking lots.")

# Hondo (Honda).
M("Hondo", "Civix", "sedan", "mainstream", "strong", 0.85,
  [("LX", 25_000), ("Si", 31_000), ("Type S", 46_000)],
  blurb="A first car for a lot of people, and a last one for some.")
M("Hondo", "Accordia", "sedan", "mainstream", "strong", 0.85,
  [("LX", 29_000), ("Sport Hybrid", 33_500), ("Touring", 39_500)])
M("Hondo", "CR-W", "suv", "mainstream", "strong", 0.85,
  [("LX", 30_000), ("EX-L", 35_000), ("Sport Touring Hybrid", 41_000)],
  blurb="Sensible shoes, but they fit.")
M("Hondo", "Pilote", "suv", "mainstream", "strong", 0.9,
  [("Sport", 41_000), ("EX-L", 45_000), ("Elite", 54_000)])
M("Hondo", "Odysse", "minivan", "mainstream", "strong", 0.9,
  [("EX-L", 43_000), ("Elite", 52_000)])

# Fard (Ford).
M("Fard", "F-160", "truck", "mainstream", "average", 1.0,
  [("XL", 38_000), ("XLT", 48_000), ("Raptor-X", 80_000)],
  blurb="The best-selling truck in the country, forty years running.")
M("Fard", "Mestang", "coupe", "mainstream", "average", 1.05,
  [("EcoBoost", 32_000), ("GT", 45_000), ("Dark Steed", 62_000)],
  blurb="A V8 and a long hood. Nothing else is quite it.")
M("Fard", "Bronc", "suv", "mainstream", "strong", 1.05,
  [("Base", 40_000), ("Badlands", 52_000), ("Raptor-X", 81_000)],
  blurb="The doors come off. People actually do it.")
M("Fard", "Escapa", "suv", "mainstream", "average", 1.1,
  [("Active", 29_000), ("ST-Line", 32_000), ("Platinum", 39_000)])
M("Fard", "Maveric", "truck", "mainstream", "strong", 1.0,
  [("XL", 28_000), ("Lariat", 36_000)],
  blurb="A small, cheap pickup. They sold out for two years.")

# Chevlon (Chevrolet).
M("Chevlon", "Silverwood 1500", "truck", "mainstream", "average", 1.05,
  [("WT", 38_000), ("LT", 50_000), ("High Country", 65_000)])
M("Chevlon", "Equina", "suv", "mainstream", "average", 1.05,
  [("LT", 30_000), ("RS", 33_000), ("Activ", 34_500)])
M("Chevlon", "Tahoma", "suv", "mainstream", "average", 1.05,
  [("LS", 59_000), ("Z71", 67_000), ("High Country", 80_000)])
M("Chevlon", "Traxa", "suv", "mainstream", "average", 1.0,
  [("LS", 21_500), ("RS", 24_500)],
  blurb="About the cheapest new car you can still buy.")
M("Chevlon", "Corvetta", "coupe", "mainstream", "average", 1.1,
  [("Stingray", 70_000), ("E-Ray", 106_000), ("Z07", 112_000)],
  blurb="Mid-engined now, and a supercar for the price of a truck.")

# Nissun (Nissan).
M("Nissun", "Rogo", "suv", "mainstream", "average", 1.05,
  [("S", 30_000), ("SV", 32_000), ("Platinum", 41_000)])
M("Nissun", "Frontiera", "truck", "mainstream", "average", 1.0,
  [("S", 32_000), ("PRO-4X", 41_000)])

# Hyundal (Hyundai).
M("Hyundal", "Elantro", "sedan", "mainstream", "average", 0.95,
  [("SE", 22_500), ("SEL", 24_000), ("N", 34_500)])
M("Hyundal", "Tucsan", "suv", "mainstream", "average", 0.95,
  [("SE", 29_000), ("SEL", 32_000), ("Limited", 39_000)])
M("Hyundal", "Santa Fey", "suv", "mainstream", "average", 0.95,
  [("SE", 35_000), ("Limited", 45_000), ("Calligrafia", 49_000)])
M("Hyundal", "Ionix 5", "suv", "mainstream", "weak", 0.9,
  [("SE", 43_000), ("Limited", 54_000)], electric=True,
  blurb="Looks like a concept car that escaped.")

# Kiya (Kia).
M("Kiya", "Sportago", "suv", "mainstream", "average", 0.95,
  [("LX", 29_000), ("EX", 32_000), ("X-Pro", 40_000)])
M("Kiya", "Tellura", "suv", "mainstream", "strong", 0.95,
  [("LX", 38_000), ("SX", 47_000), ("SX-Prestige X-Pro", 54_000)],
  blurb="The one that won every award the year it came out.")

# Subaro (Subaru).
M("Subaro", "Outbacker", "wagon", "mainstream", "strong", 1.0,
  [("Base", 30_000), ("Premium", 33_000), ("Wilderness", 42_000)],
  blurb="Every trailhead parking lot in the country has three.")
M("Subaro", "Forestor", "suv", "mainstream", "strong", 1.0,
  [("Base", 31_000), ("Sport", 36_000), ("Touring", 40_000)])
M("Subaro", "Crossway", "hatch", "mainstream", "strong", 1.0,
  [("Base", 26_500), ("Premium", 28_500), ("Limited", 32_500)])
M("Subaro", "WRZ", "sedan", "mainstream", "strong", 1.1,
  [("Base", 34_000), ("TR", 45_000)],
  blurb="A rally car for the drive to school.")

# Mazdo (Mazda).
M("Mazdo", "Three", "hatch", "mainstream", "average", 0.9,
  [("S", 24_500), ("Premium", 31_000), ("Turbo", 35_000)])
M("Mazdo", "MX-6 Miyata", "convertible", "mainstream", "strong", 0.85,
  [("Sport", 30_000), ("Club", 35_000), ("Grand Touring", 36_000)],
  blurb="The answer, whatever the question was.")

# Volkswerk (Volkswagen).
M("Volkswerk", "Jetto", "sedan", "mainstream", "average", 1.1,
  [("S", 23_000), ("SEL", 30_000), ("GLI", 33_000)])
M("Volkswerk", "Golfer", "hatch", "mainstream", "average", 1.1,
  [("GTi S", 33_000), ("GTi Autobahn", 40_000), ("R", 48_000)],
  blurb="The hot hatch every other hot hatch is measured against.")

# Jepp (Jeep) and Raam (Ram).
M("Jepp", "Wranglar", "suv", "mainstream", "strong", 1.2,
  [("Sport", 34_000), ("Rubicoon", 50_000), ("392", 90_000)],
  blurb="Squeaks, rattles and holds its value anyway.")
M("Raam", "1600", "truck", "mainstream", "average", 1.1,
  [("Tradesman", 42_000), ("Laramie", 58_000), ("TRX-R", 95_000)])

# Teslo (Tesla). Electric, and they fall fast.
M("Teslo", "Model Tri", "sedan", "mainstream", "weak", 0.95,
  [("RWD", 42_500), ("Long Range", 48_000), ("Performance", 55_000)], electric=True,
  blurb="Fast, quiet, and the screen is the dashboard.")
M("Teslo", "Model Wy", "suv", "mainstream", "weak", 0.95,
  [("RWD", 45_000), ("Long Range", 49_000), ("Performance", 52_000)], electric=True)
M("Teslo", "Cyberhauler", "truck", "mainstream", "weak", 1.1,
  [("AWD", 80_000), ("Cyberbeast", 100_000)], electric=True,
  blurb="Stainless steel and sharp corners. People stare.")

# --------------------------------------------------------------------------- #
# Luxury — the Luxury lots when new, the ordinary lots once they're older     #
# --------------------------------------------------------------------------- #

# RBW (BMW) — spec 1456's "RBW 5-series-class family".
M("RBW", "3 Line", "sedan", "luxury", "weak", 1.25,
  [("331i", 46_000), ("341i", 59_000), ("R3", 78_000)],
  blurb="The sports sedan everybody else copies.")
M("RBW", "5 Line", "sedan", "luxury", "weak", 1.25,
  [("531i", 59_000), ("541i", 66_000), ("R5", 121_000)])
M("RBW", "RX5", "suv", "luxury", "weak", 1.25,
  [("sDrive41i", 67_000), ("xDrive51e", 74_000), ("RX5 R", 123_000)])
M("RBW", "R4", "coupe", "luxury", "average", 1.25,
  [("Coupe", 80_000), ("Competition", 88_000)])

# Merceda (Mercedes-Benz).
M("Merceda", "C-Line", "sedan", "luxury", "weak", 1.25,
  [("C 310", 49_000), ("C 46 AMR", 65_000)])
M("Merceda", "E-Line", "sedan", "luxury", "weak", 1.25,
  [("E 360", 63_000), ("E 460", 70_000)])
M("Merceda", "S-Line", "sedan", "luxury", "weak", 1.3,
  [("S 590", 121_000), ("Maybeck S 690", 195_000)],
  blurb="Where the chauffeur sits is optional.")
M("Merceda", "GLX", "suv", "luxury", "weak", 1.25,
  [("GLX 360", 63_000), ("GLX 460", 70_000), ("GLX 63 AMR", 125_000)])
M("Merceda", "Gelander", "suv", "luxury", "strong", 1.3,
  [("G 560", 148_000), ("G 63 AMR", 185_000)],
  blurb="A forty-year-old army truck with a $150,000 price tag. Somehow worth it.")

# Audo (Audi).
M("Audo", "B4", "sedan", "luxury", "weak", 1.2,
  [("Premium", 45_000), ("Prestige", 54_000), ("SB4", 55_000)])
M("Audo", "QX5", "suv", "luxury", "weak", 1.2,
  [("Premium", 48_000), ("Prestige", 58_000), ("SQX5", 63_000)])

# Lexon (Lexus) — luxury that holds its value.
M("Lexon", "EZ 350", "sedan", "luxury", "strong", 0.85,
  [("Base", 44_000), ("300h", 46_000), ("F Sport", 50_000)])
M("Lexon", "RZ 350", "suv", "luxury", "strong", 0.85,
  [("Base", 50_000), ("F Sport", 59_000), ("500h", 65_000)])
M("Lexon", "LZ 600", "suv", "luxury", "strong", 0.9,
  [("Premium", 107_000), ("Ultra Luxury", 133_000)])

# Cadillon (Cadillac).
M("Cadillon", "Escalada", "suv", "luxury", "weak", 1.2,
  [("Luxury", 93_000), ("Sport Platinum", 126_000), ("V", 155_000)],
  blurb="The car you hire for a wedding, and then sometimes buy.")

# Rangeland (Land Rover).
M("Rangeland", "Sport", "suv", "luxury", "weak", 1.45,
  [("SE", 85_000), ("Dynamic SE", 93_000), ("SV", 185_000)])
M("Rangeland", "Defendr", "suv", "luxury", "average", 1.4,
  [("110 S", 62_000), ("110 X", 93_000), ("Octa", 150_000)])
M("Rangeland", "Rangeland", "suv", "luxury", "weak", 1.45,
  [("SE", 110_000), ("Autobiography", 185_000)],
  blurb="Beautiful, enormous, and on a first-name basis with the service desk.")

# Porsha (Porsche).
M("Porsha", "Makan", "suv", "luxury", "average", 1.1,
  [("Base", 63_000), ("S", 85_000), ("Turbo", 106_000)], electric=True)
M("Porsha", "Cayenna", "suv", "luxury", "average", 1.15,
  [("Base", 86_000), ("S", 102_000), ("Turbo GT", 200_000)])
M("Porsha", "Taycon", "sedan", "luxury", "weak", 1.1,
  [("Base", 100_000), ("4S", 123_000), ("Turbo S", 210_000)], electric=True)
M("Porsha", "912", "coupe", "exotic", "strong", 1.05,
  [("Carrera", 122_000), ("GTS", 166_000),
   ("Turbo S", 232_000), ("GT3 RS", 243_000)],
  collectible=True,
  blurb="Rear-engined since forever. The good ones never really lose money.")

# --------------------------------------------------------------------------- #
# Exotic — the Luxury lots only                                               #
# --------------------------------------------------------------------------- #

M("Ferrano", "Rona", "coupe", "exotic", "exotic", 1.4,
  [("Coupe", 250_000), ("Spider", 275_000)])
M("Ferrano", "298", "coupe", "exotic", "exotic", 1.4,
  [("GTB", 340_000), ("GTS", 370_000)])
M("Ferrano", "Purosango", "suv", "exotic", "exotic", 1.4,
  [("V12", 400_000)])
M("Ferrano", "Dodici Cilindri", "coupe", "exotic", "exotic", 1.4,
  [("Coupe", 430_000), ("Spider", 470_000)])
M("Ferrano", "SF-92", "coupe", "exotic", "exotic", 1.4,
  [("Stradale", 530_000), ("XX", 800_000)], collectible=True,
  blurb="A plug-in hybrid with a thousand horsepower. Mostly the second part.")
M("Lambor", "Uros", "suv", "exotic", "exotic", 1.35,
  [("S", 240_000), ("Performante", 270_000)])
M("Lambor", "Hurakan", "coupe", "exotic", "exotic", 1.4,
  [("Tecnica", 240_000), ("STO", 340_000)], collectible=True)
M("Lambor", "Revolto", "coupe", "exotic", "exotic", 1.45,
  [("V12", 610_000)], collectible=True,
  blurb="Doors that go up, and a waiting list that went out the door.")
M("McLarren", "Artura", "coupe", "exotic", "exotic", 1.5,
  [("Coupe", 250_000), ("Spider", 275_000)])
M("McLarren", "760S", "coupe", "exotic", "exotic", 1.5,
  [("Coupe", 330_000), ("Spider", 350_000)])
M("Bentlee", "Continent GT", "coupe", "exotic", "weak", 1.35,
  [("V8", 300_000), ("Speed", 340_000)])
M("Bentlee", "Bentayo", "suv", "exotic", "weak", 1.35,
  [("V8", 210_000), ("EWB Azure", 260_000)])
M("Rowland", "Ghostt", "sedan", "exotic", "weak", 1.3,
  [("Ghostt", 350_000), ("Black Badge", 410_000)])
M("Rowland", "Cullinon", "suv", "exotic", "weak", 1.3,
  [("Cullinon", 400_000), ("Black Badge", 470_000)])
M("Rowland", "Phantasm", "sedan", "exotic", "weak", 1.3,
  [("Phantasm", 480_000), ("Extended", 560_000)],
  blurb="Quiet enough to hear the clock. The clock costs more than your first car.")
M("Ashton Marlin", "DB-13", "coupe", "exotic", "weak", 1.5,
  [("Coupe", 250_000), ("Volante", 265_000)])
M("Ashton Marlin", "Vantaj", "coupe", "exotic", "weak", 1.5,
  [("Coupe", 195_000), ("Roadster", 210_000)])
M("Ashton Marlin", "DBX-8", "suv", "exotic", "weak", 1.5,
  [("707", 250_000)])
M("Nissun", "GT-Z", "coupe", "exotic", "average", 1.15,
  [("Premium", 122_000), ("Nismoh", 222_000)], collectible=True,
  blurb="Godzilla, they called it. It earned the name.")

# --------------------------------------------------------------------------- #
# Classic — the collector lot. Priced as a collector would, in good condition #
# --------------------------------------------------------------------------- #

M("Fard", "Mestang '67 Fastback", "coupe", "classic", "exotic", 1.6,
  [("289", 65_000), ("GT 390", 95_000)], year=1967,
  blurb="The one from the film. Well, one like it.")
M("Chevlon", "Bel Aire '57", "sedan", "classic", "exotic", 1.6,
  [("Two-Door", 70_000), ("Convertible", 110_000)], year=1957)
M("Chevlon", "Corvetta '63 Split-Window", "coupe", "classic", "exotic", 1.6,
  [("327", 150_000), ("Z06", 300_000)], year=1963)
M("Chevlon", "Camaron '69", "coupe", "classic", "exotic", 1.6,
  [("RS", 55_000), ("SS 396", 85_000)], year=1969)
M("Plymond", "Hemi Cuda '70", "coupe", "classic", "exotic", 1.7,
  [("Hardtop", 250_000)], year=1970)
M("Datsan", "240-Z '72", "coupe", "classic", "exotic", 1.5,
  [("Series I", 45_000)], year=1972)
M("Volkswerk", "Beetel '67", "coupe", "classic", "exotic", 1.4,
  [("1500", 18_000), ("Cabriolet", 28_000)], year=1967,
  blurb="Everybody's first restoration project.")
M("Volkswerk", "Microbus '66", "van", "classic", "exotic", 1.5,
  [("21-Window", 90_000), ("23-Window Samba", 120_000)], year=1966)
M("Jepp", "CJ-5 '78", "suv", "classic", "exotic", 1.4,
  [("Renegade", 25_000)], year=1978)
M("Merceda", "280 SL '69", "convertible", "classic", "exotic", 1.6,
  [("Pagoda", 120_000)], year=1969)
M("Porsha", "912 '73 RS", "coupe", "classic", "exotic", 1.5,
  [("Touring", 600_000)], year=1973)
M("Porsha", "912 '86 Carrera", "coupe", "classic", "exotic", 1.3,
  [("Coupe", 65_000), ("Targa", 70_000)], year=1986)
M("RBW", "R3 '88", "sedan", "classic", "exotic", 1.4,
  [("Sport Evolution", 110_000)], year=1988)
M("Royata", "Supreme '98", "coupe", "classic", "exotic", 1.1,
  [("Turbo", 120_000)], year=1998,
  blurb="A whole generation's poster on the bedroom wall.")
M("Hondo", "NSZ '93", "coupe", "classic", "exotic", 1.1,
  [("Coupe", 140_000)], year=1993)
M("Ferrano", "Testa Rosa '86", "coupe", "classic", "exotic", 1.6,
  [("Coupe", 160_000)], year=1986)
M("Lambor", "Countash '88", "coupe", "classic", "exotic", 1.7,
  [("25th Anniversary", 500_000)], year=1988)
M("Ferrano", "F-41 '90", "coupe", "classic", "exotic", 1.6,
  [("Berlinetta", 2_800_000)], year=1990,
  blurb="There were about thirteen hundred. There are fewer now.")

# --------------------------------------------------------------------------- #
# Lots                                                                        #
# --------------------------------------------------------------------------- #

# Spec 1877: up to two lots in each broad new/used bracket, two smaller luxury
# lots, and the online marketplace. `markup` is on top of what the car is
# worth; `defectChance` is the hidden-issue rate (spec 1387: uncommon;
# spec 1329: online rarely). Ages are model years back from this one.
LOTS = [
    {"id": "lot.new-1", "name": "Northgate Auto Group", "market": "new", "size": 6,
     "markets": ["mainstream"], "age": [0, 0], "markup": 1.0, "defectChance": 0.0,
     "blurb": "Plastic bunting, free coffee, a man called Dale."},
    {"id": "lot.new-2", "name": "Valley Motor Mall", "market": "new", "size": 6,
     "markets": ["mainstream"], "age": [0, 0], "markup": 1.0, "defectChance": 0.0,
     "blurb": "Eight brands and one enormous parking lot."},
    {"id": "lot.used-1", "name": "Second Street Pre-Owned", "market": "used", "size": 6,
     "markets": ["mainstream", "luxury"], "age": [1, 9], "markup": 1.08, "defectChance": 0.03,
     "blurb": "Inspected, warrantied, and priced like it."},
    {"id": "lot.used-2", "name": "Budget Auto Sales", "market": "used", "size": 6,
     "markets": ["mainstream"], "age": [5, 14], "markup": 1.05, "defectChance": 0.05,
     "blurb": "Cash, finance, trade-ins. Everybody drives today."},
    {"id": "lot.online", "name": "AutoTrove", "market": "online", "size": 8,
     "markets": ["mainstream", "luxury"], "age": [2, 16], "markup": 0.95, "defectChance": 0.1,
     "blurb": "Private sellers. Cheaper, and you only see the photos."},
    {"id": "lot.luxury-1", "name": "Prestige Motorcars", "market": "luxury", "size": 4,
     "markets": ["luxury", "exotic"], "age": [0, 0], "markup": 1.0, "defectChance": 0.0,
     "blurb": "Appointment preferred. The coffee comes in a cup and saucer."},
    {"id": "lot.luxury-2", "name": "Heritage Collector Cars", "market": "luxury", "size": 4,
     "markets": ["exotic", "classic"], "age": [3, 20], "markup": 1.06, "defectChance": 0.02,
     "blurb": "Climate-controlled, documented, and not in a hurry to sell."},
]


# --------------------------------------------------------------------------- #
# Ticket 0505 — modifications                                                  #
# --------------------------------------------------------------------------- #

# Spec 1043–1059: "Brabus-like modifier → Tarbus". Spec 1329/1885: an elite
# modifier house "for suitable luxury vehicles". Suitable is what the real
# house is known for: the big German luxury cars and the rear-engined coupe.
TARBUS_MODELS = {
    "car.merceda-c-line",
    "car.merceda-e-line",
    "car.merceda-s-line",
    "car.merceda-glx",
    "car.merceda-gelander",
    "car.porsha-912",
    "car.porsha-taycon",
}
for _model in MODELS:
    if _model["id"] in TARBUS_MODELS:
        _model["tarbus"] = True
assert {m["id"] for m in MODELS if m.get("tarbus")} == TARBUS_MODELS

# Spec 184's list, verbatim, and nothing else: wheels, paint, limited wraps,
# tint, exhaust, intake, suspension, ECU tune, brakes and engine upgrades. No
# body kits, no interiors (spec 1885 removes them by name). One option per
# slot on a car; fitting another replaces it. Paint and a wrap share the
# `finish` slot, because a wrap goes over the paint.
#
# `price` is [on a $20,000 car, on a $400,000 car], 2025 US shop prices, and a
# car in between is priced on the log of its reference price — forged wheels
# for a Royata and for a Ferrano are not the same wheels.
#
# `recovery` is the share of what was paid that the car is worth more for it
# the day it is fitted (spec 1387: "most modifications recover only part of
# cost at resale"). It depreciates with the car after that. A tune recovers
# nothing: a buyer reads it as a voided warranty.
#
# `strain` multiplies a year's maintenance and the chance of a big repair;
# `grip` multiplies the chance of an accident.
SLOTS = ["wheels", "finish", "tint", "exhaust", "intake", "suspension", "ecu", "brakes", "engine", "tarbus"]
MODS: list[dict] = []


def MOD(id: str, slot: str, name: str, low: int, high: int, recovery: float, *,
        strain: float = 1.0, grip: float = 1.0, combustion: bool = False,
        luxury: bool = False, blurb: str = "") -> None:
    assert slot in SLOTS, slot
    assert 0 <= recovery <= 1, id
    MODS.append({
        "id": id, "slot": slot, "name": name, "price": [low, high], "recovery": recovery,
        "strain": strain, "grip": grip,
        # Only a car with an engine can have its engine, exhaust, intake or
        # tune changed. Only a luxury or exotic car is offered carbon brakes.
        "combustionOnly": combustion, "luxuryOnly": luxury, "blurb": blurb,
    })


MOD("mod.wheels.alloy", "wheels", "Alloy wheels", 1_200, 6_000, 0.35,
    blurb="A set of aftermarket alloys and new tires.")
MOD("mod.wheels.forged", "wheels", "Forged wheels", 3_500, 14_000, 0.35,
    blurb="Lighter, stronger, and the first thing anybody notices.")
MOD("mod.finish.respray", "finish", "Full respray", 3_000, 15_000, 0.3,
    blurb="A new color, done properly, door jambs and all.")
MOD("mod.finish.candy", "finish", "Custom candy paint", 6_000, 25_000, 0.2,
    blurb="Deep, layered, and impossible to match after a scrape.")
# Spec 184 and 1885: "wrap options should be intentionally limited". Three.
MOD("mod.finish.wrap-matte-black", "finish", "Matte black wrap", 2_800, 7_000, 0.1,
    blurb="Comes off in an afternoon if you change your mind.")
MOD("mod.finish.wrap-satin-gray", "finish", "Satin gray wrap", 2_800, 7_000, 0.1,
    blurb="Comes off in an afternoon if you change your mind.")
MOD("mod.finish.wrap-stripes", "finish", "Racing stripes", 600, 2_500, 0.1,
    blurb="Two stripes, hood to trunk.")
MOD("mod.tint.windows", "tint", "Window tint", 250, 700, 0.1,
    blurb="Darker glass all around, to the legal limit.")
MOD("mod.exhaust.cat-back", "exhaust", "Cat-back exhaust", 900, 6_000, 0.25, combustion=True,
    blurb="Louder on purpose.")
MOD("mod.intake.cold-air", "intake", "Cold air intake", 300, 1_200, 0.1, combustion=True,
    blurb="A little more air, and a lot more noise under the hood.")
MOD("mod.suspension.lowering", "suspension", "Lowering springs", 400, 1_500, 0.15,
    blurb="An inch and a half lower. Speed bumps become a concern.")
MOD("mod.suspension.coilovers", "suspension", "Coilovers", 1_500, 6_000, 0.25, grip=0.95,
    blurb="Adjustable ride height and damping. Firmer everywhere.")
MOD("mod.ecu.stage-1", "ecu", "Stage 1 tune", 500, 2_500, 0.0, strain=1.08, combustion=True,
    blurb="More power from the same engine, and a warranty that won't cover it.")
MOD("mod.ecu.stage-2", "ecu", "Stage 2 tune", 1_200, 5_000, 0.0, strain=1.15, combustion=True,
    blurb="Needs the intake and exhaust to breathe. Works the engine hard.")
MOD("mod.brakes.big-brake", "brakes", "Big brake kit", 1_800, 7_000, 0.3, grip=0.8,
    blurb="Bigger rotors, six-piston calipers. Stops like it means it.")
MOD("mod.brakes.carbon", "brakes", "Carbon-ceramic brakes", 8_000, 18_000, 0.35, grip=0.75, luxury=True,
    blurb="Fade-free, dust-free, and the price of a used car.")
MOD("mod.engine.turbo", "engine", "Turbo upgrade", 4_000, 20_000, 0.3, strain=1.15, combustion=True,
    blurb="A bigger turbo and everything it needs to survive it.")
MOD("mod.engine.rebuild", "engine", "Performance rebuild", 7_000, 35_000, 0.35, strain=1.1, combustion=True,
    blurb="Forged internals, built by hand. More power and built to take it.")
# Spec 1885: "a fictional elite luxury modifier analogous in role to Brabus".
# Priced as a share of the car rather than a band: a Tarbus conversion is the
# engine, exhaust, suspension, wheels and badges, and it costs like a second
# car. It holds its value far better than anything a shop fits.
MODS.append({
    "id": "mod.tarbus", "slot": "tarbus", "name": "Tarbus conversion", "price": [0, 0],
    "priceShare": 0.4, "recovery": 0.7, "strain": 1.05, "grip": 0.85,
    "combustionOnly": False, "luxuryOnly": True,
    "covers": ["wheels", "exhaust", "intake", "suspension", "ecu", "engine"],
    "blurb": "Shipped to the Tarbus works and returned with their engine, their wheels and their badge.",
})


def main() -> None:
    ids = [m["id"] for m in MODELS]
    assert len(ids) == len(set(ids)), [i for i, c in Counter(ids).items() if c > 1]
    trims = [t for m in MODELS for t in m["trims"]]
    trim_ids = [t["id"] for t in trims]
    assert len(trim_ids) == len(set(trim_ids)), [i for i, c in Counter(trim_ids).items() if c > 1]
    for m in MODELS:
        assert len(m["trims"]) >= 1, m["id"]
        if m["market"] != "classic":
            assert len(m["trims"]) >= 1
    assert 150 <= len(trims) <= 250, len(trims)

    OUT_PATH.write_text(
        json.dumps({"version": CATALOG_VERSION, "lots": LOTS, "entries": MODELS}, indent=2) + "\n"
    )
    mod_ids = [m["id"] for m in MODS]
    assert len(mod_ids) == len(set(mod_ids))
    assert set(SLOTS) == {m["slot"] for m in MODS}, "every slot spec 184 names has an option"
    for mod in MODS:
        low, high = mod["price"]
        assert mod["slot"] == "tarbus" or 0 < low < high, mod["id"]
    MODS_PATH.write_text(json.dumps({"version": 1, "entries": MODS}, indent=2) + "\n")
    print(f"wrote {MODS_PATH.relative_to(ROOT)}: {len(MODS)} modifications across {len(SLOTS)} slots")
    by_market = Counter(m["market"] for m in MODELS)
    trims_by_market = Counter(m["market"] for m in MODELS for _ in m["trims"])
    brands = sorted({m["brand"] for m in MODELS})
    print(f"wrote {OUT_PATH.relative_to(ROOT)}: {len(MODELS)} models, {len(trims)} trims, {len(brands)} brands")
    print("  models by market:", dict(by_market))
    print("  trims by market: ", dict(trims_by_market))


if __name__ == "__main__":
    main()
