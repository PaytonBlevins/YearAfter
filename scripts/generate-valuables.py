#!/usr/bin/env python3
"""
Ticket 0506 — jewelry, watches and valuable collections.

Authoring source for `packages/content/data/valuables.json`. Edit here, run it,
commit both.

Spec 1890–1893: "Watches, men's necklaces, chains, bracelets, rings,
gold/silver/platinum/diamond goods. Diamonds need only simple size and perhaps
broad quality, not exhaustive grading. Collectibles include art, antiques,
historical items, humorous pieces, and rare mythical/easter-egg objects."
Spec 197: Poseidon's Trident, Diamond Pickaxe, Pandora's Box "and similar".
Spec 1088/1456: recognisable fictional brands (a Rolux is meant to be read as
what it is), priced against 2025 retail. Final names need legal review.

HOW EACH ONE HOLDS ITS VALUE (`holds`), the thing that decides whether buying
it is spending or saving (spec 140: "Jewelry, watches, and vehicles count as
meaningful investment-style assets only when sufficiently valuable/
collectible"):

  fashion    — sold at a retail markup and worth little once worn: about a
               third back the day you buy it, falling after.
  precious   — gold, platinum and diamonds: about 60% back, then moves with
               the precious-metals market.
  watch      — a good mechanical watch: about 75% back, drifting slowly up.
  sought     — the handful of steel sports watches with waiting lists: they
               trade above retail.
  art        — about 70% back, then volatile. Most of it drifts; some of it
               takes off; some of it doesn't.
  antique    — about 75% back, steady and slowly rising.
  curio      — the humorous pieces: half back, and whatever somebody will pay.
  mythical   — easter eggs. Full value, rising, and almost never seen.

`store` is where it is sold. Spec 1363 puts shopping under Assets → Shopping.
A store shows a curated handful a year, never the whole list (spec 1366).

Usage:  python3 scripts/generate-valuables.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "packages" / "content" / "data" / "valuables.json"

CATALOG_VERSION = 1

KINDS = ["watch", "ring", "necklace", "chain", "bracelet", "earrings", "art", "antique", "historical", "curio", "mythical"]
HOLDS = ["fashion", "precious", "watch", "sought", "art", "antique", "curio", "mythical"]

# Store ids, and the hidden gate on each (spec 1356: "without visible
# wealth-tier labels"): somebody whose means are under `means` never sees it.
STORES = [
    {"id": "store.jeweler", "name": "Halden & Rowe Jewelers", "kinds": ["ring", "necklace", "chain", "bracelet", "earrings"],
     "size": 6, "means": 0, "blurb": "A glass counter, a bell over the door, and a man who knows your ring size by looking."},
    {"id": "store.watches", "name": "The Watch Room", "kinds": ["watch"],
     "size": 6, "means": 0, "blurb": "Every brand under one roof, and a waiting list for the ones people want."},
    {"id": "store.maison", "name": "Maison Vellard", "kinds": ["watch", "ring", "necklace", "bracelet", "earrings"],
     "size": 5, "means": 150_000, "blurb": "Appointment only. They bring the pieces to you."},
    {"id": "store.gallery", "name": "Northlight Gallery", "kinds": ["art"],
     "size": 6, "means": 0, "blurb": "White walls, small labels, and prices you have to ask for."},
    {"id": "store.antiques", "name": "Old Hollow Antiques & Curiosities", "kinds": ["antique", "historical", "curio", "mythical"],
     "size": 7, "means": 0, "blurb": "Three floors of other people's things. The owner says everything has a story."},
]

ENTRIES: list[dict] = []


def V(id: str, kind: str, name: str, price: int, holds: str, *, brand: str = "", stores: list[str], blurb: str = "",
      rarity: str = "common") -> None:
    assert kind in KINDS, kind
    assert holds in HOLDS, holds
    ENTRIES.append({
        "id": f"val.{id}", "kind": kind, "name": name, "brand": brand, "price": price, "holds": holds,
        "stores": stores, "rarity": rarity, "blurb": blurb,
    })


W = ["store.watches"]
WL = ["store.watches", "store.maison"]
ML = ["store.maison"]
J = ["store.jeweler"]
JL = ["store.jeweler", "store.maison"]
G = ["store.gallery"]
A = ["store.antiques"]

# --------------------------------------------------------------------------- #
# Watches                                                                      #
# --------------------------------------------------------------------------- #

V("watch.casiot-g-shok", "watch", "Casiot G-Shok", 120, "fashion", brand="Casiot", stores=W,
  blurb="Survives anything. Including fashion.")
V("watch.casiot-gold", "watch", "Casiot Gold Digital", 70, "fashion", brand="Casiot", stores=W,
  blurb="Gold-tone, a calculator's worth of buttons.")
V("watch.timexa-weekender", "watch", "Timexa Weekender", 90, "fashion", brand="Timexa", stores=W)
V("watch.fossell-chrono", "watch", "Fossell Chronograph", 180, "fashion", brand="Fossell", stores=W)
V("watch.seyko-presago", "watch", "Seyko Presago", 550, "watch", brand="Seyko", stores=W,
  blurb="An automatic movement for the price of a dinner out.")
V("watch.seyko-diver", "watch", "Seyko Prospect Diver", 750, "watch", brand="Seyko", stores=W)
V("watch.tissoe-prx", "watch", "Tissoe PRZ", 725, "watch", brand="Tissoe", stores=W)
V("watch.hamiltone-khaki", "watch", "Hamiltone Khaki Field", 595, "watch", brand="Hamiltone", stores=W)
V("watch.apple-ish", "watch", "Orchard Watch Ultra", 800, "fashion", brand="Orchard", stores=W,
  blurb="Tells the time, your heart rate, and everyone your messages.")
V("watch.tagg-carrara", "watch", "Tagg Heuser Carrara", 5_500, "watch", brand="Tagg Heuser", stores=W)
V("watch.tagg-monako", "watch", "Tagg Heuser Monako", 7_450, "watch", brand="Tagg Heuser", stores=W,
  blurb="The square one from the racing film.")
V("watch.tudar-black-cove", "watch", "Tudar Black Cove", 4_200, "watch", brand="Tudar", stores=W)
V("watch.longinez-spirit", "watch", "Longinez Spirit", 2_700, "watch", brand="Longinez", stores=W)
V("watch.oris-diver", "watch", "Orys Aquis Diver", 2_400, "watch", brand="Orys", stores=W)
V("watch.breitlong-navigator", "watch", "Breitlong Navigator", 9_000, "watch", brand="Breitlong", stores=W)
V("watch.grand-seyko-snowflake", "watch", "Grand Seyko Snowflake", 6_200, "watch", brand="Grand Seyko", stores=W,
  blurb="A dial like fresh snow, and a second hand that glides.")
V("watch.omegon-speedmeister", "watch", "Omegon Speedmeister Moonwatch", 7_600, "watch", brand="Omegon", stores=WL,
  blurb="The one that went to the Moon.")
V("watch.omegon-seamarine", "watch", "Omegon Seamarine 300", 5_900, "watch", brand="Omegon", stores=WL)
V("watch.cartrier-tanque", "watch", "Cartrier Tanque", 3_400, "watch", brand="Cartrier", stores=WL)
V("watch.cartrier-santo", "watch", "Cartrier Santo", 7_950, "watch", brand="Cartrier", stores=WL)
V("watch.rolux-datesure", "watch", "Rolux Datesure 41", 9_400, "sought", brand="Rolux", stores=WL,
  blurb="The one people mean when they say \"a Rolux.\"")
V("watch.rolux-subaquatic", "watch", "Rolux Subaquatic", 10_250, "sought", brand="Rolux", stores=WL,
  blurb="A two-year waiting list. Worth more the day it's on your wrist.")
V("watch.rolux-gmt", "watch", "Rolux GMT-Voyager", 10_900, "sought", brand="Rolux", stores=WL)
V("watch.rolux-daytonna", "watch", "Rolux Daytonna", 15_100, "sought", brand="Rolux", stores=ML,
  blurb="Nobody walks in and buys one. Somehow you did.")
V("watch.rolux-day-date", "watch", "Rolux Day-Date President", 38_500, "watch", brand="Rolux", stores=ML)
V("watch.iwc-pilot", "watch", "IWK Big Pilot", 13_900, "watch", brand="IWK", stores=WL)
V("watch.jaeger-reverso", "watch", "Jaegar-LeCoultray Reverso", 9_100, "watch", brand="Jaegar-LeCoultray", stores=WL,
  blurb="It flips over. Polo players needed that once.")
V("watch.panerai-luminor", "watch", "Panarai Luminor", 8_700, "watch", brand="Panarai", stores=WL)
V("watch.zenith-chrono", "watch", "Zenyth El Primero", 9_800, "watch", brand="Zenyth", stores=WL)
V("watch.blancpain-fifty", "watch", "Blancpane Fifty Fathoms", 17_500, "watch", brand="Blancpane", stores=ML)
V("watch.ap-royal-ash", "watch", "Audemar Pigot Royal Ash", 31_000, "sought", brand="Audemar Pigot", stores=ML,
  blurb="Eight screws on an octagon bezel. Recognized across a room.")
V("watch.patrek-calatrova", "watch", "Patrek Phillon Calatrova", 33_000, "watch", brand="Patrek Phillon", stores=ML)
V("watch.patrek-nautilos", "watch", "Patrek Phillon Nautilos", 35_000, "sought", brand="Patrek Phillon", stores=ML,
  blurb="Retail is a formality. Resale is the price.")
V("watch.vacheran-overseas", "watch", "Vacheran Constantine Overseas", 29_900, "watch", brand="Vacheran Constantine", stores=ML)
V("watch.langer-lange1", "watch", "A. Langer & Sohn Lange 1", 42_000, "watch", brand="A. Langer & Sohn", stores=ML)
V("watch.millon-rm", "watch", "Richard Millon RM 35", 250_000, "sought", brand="Richard Millon", stores=ML,
  blurb="Weighs nothing. Costs a house.")
V("watch.patrek-grand-comp", "watch", "Patrek Phillon Grand Complication", 650_000, "sought", brand="Patrek Phillon", stores=ML,
  blurb="A perpetual calendar, a minute repeater, and a two-year build.")

# --------------------------------------------------------------------------- #
# Jewelry — spec 1891: necklaces, chains, bracelets, rings, earrings, in      #
# gold, silver, platinum and diamonds. Diamonds by size and broad quality.    #
# --------------------------------------------------------------------------- #

V("ring.silver-band", "ring", "Sterling silver band", 120, "fashion", stores=J)
V("ring.gold-band-14k", "ring", "14k gold band", 650, "precious", stores=J)
V("ring.platinum-band", "ring", "Platinum wedding band", 1_800, "precious", stores=JL)
V("ring.signet-gold", "ring", "18k gold signet ring", 2_400, "precious", stores=J,
  blurb="Engraved with your initials, if you want them.")
V("ring.solitaire-05-good", "ring", "Diamond solitaire, ½ carat, good", 1_600, "precious", stores=J)
V("ring.solitaire-1-good", "ring", "Diamond solitaire, 1 carat, good", 4_200, "precious", stores=J)
V("ring.solitaire-1-exc", "ring", "Diamond solitaire, 1 carat, excellent", 7_800, "precious", stores=JL)
V("ring.solitaire-2-exc", "ring", "Diamond solitaire, 2 carats, excellent", 28_000, "precious", stores=JL)
V("ring.solitaire-3-exc", "ring", "Diamond solitaire, 3 carats, excellent", 62_000, "precious", stores=ML)
V("ring.solitaire-5-exc", "ring", "Diamond solitaire, 5 carats, excellent", 180_000, "precious", stores=ML,
  blurb="Heavy enough to notice when you shake hands.")
V("ring.tiffard-setting", "ring", "Tiffard & Co. Setting, 1 carat", 18_500, "precious", brand="Tiffard & Co.", stores=JL,
  blurb="The little blue box does a lot of the work.")
V("ring.cartrier-juste", "ring", "Cartrier Juste un Clou ring", 2_900, "precious", brand="Cartrier", stores=JL,
  blurb="A gold nail, bent into a ring.")
V("ring.sapphire", "ring", "Sapphire and diamond ring", 6_500, "precious", stores=JL)
V("ring.emerald", "ring", "Emerald cocktail ring", 14_000, "precious", stores=ML)
V("necklace.silver-pendant", "necklace", "Silver pendant necklace", 140, "fashion", stores=J)
V("necklace.pearl-strand", "necklace", "Cultured pearl strand", 1_900, "precious", stores=J)
V("necklace.gold-pendant", "necklace", "14k gold cross pendant", 480, "precious", stores=J)
V("necklace.diamond-pendant-05", "necklace", "Diamond pendant, ½ carat", 1_700, "precious", stores=J)
V("necklace.diamond-pendant-1", "necklace", "Diamond pendant, 1 carat", 5_200, "precious", stores=JL)
V("necklace.tennis", "necklace", "Diamond tennis necklace, 10 carats", 38_000, "precious", stores=ML,
  blurb="Ten carats, in a line, all the way around.")
V("necklace.vancleaf-alhambra", "necklace", "Van Cleaf Alhambra necklace", 5_800, "precious", brand="Van Cleaf", stores=JL,
  blurb="Four-leaf clovers in gold and onyx.")
V("necklace.iced-pendant", "necklace", "Iced-out custom pendant", 24_000, "precious", stores=ML,
  blurb="Your name, in diamonds, the size of your palm.")
V("chain.silver-curb", "chain", "Sterling silver curb chain", 150, "fashion", stores=J)
V("chain.gold-rope-14k", "chain", "14k gold rope chain, 22 inch", 1_400, "precious", stores=J)
V("chain.gold-cuban-14k", "chain", "14k gold Cuban link, 8mm", 4_600, "precious", stores=J)
V("chain.gold-cuban-18k", "chain", "18k gold Cuban link, 12mm", 14_500, "precious", stores=JL,
  blurb="Heavy. You feel it when you turn your head.")
V("chain.diamond-cuban", "chain", "Diamond Cuban link chain", 42_000, "precious", stores=ML)
V("chain.platinum-box", "chain", "Platinum box chain", 3_200, "precious", stores=JL)
V("chain.gold-franco", "chain", "10k gold Franco chain", 1_100, "precious", stores=J)
V("bracelet.silver-cuff", "bracelet", "Sterling silver cuff", 180, "fashion", stores=J)
V("bracelet.charm", "bracelet", "Silver charm bracelet", 95, "fashion", stores=J)
V("bracelet.gold-link", "bracelet", "14k gold link bracelet", 1_600, "precious", stores=J)
V("bracelet.tennis-3", "bracelet", "Diamond tennis bracelet, 3 carats", 6_400, "precious", stores=JL)
V("bracelet.tennis-10", "bracelet", "Diamond tennis bracelet, 10 carats", 26_000, "precious", stores=ML)
V("bracelet.cartrier-amour", "bracelet", "Cartrier Amour bracelet", 7_350, "precious", brand="Cartrier", stores=JL,
  blurb="Screws shut. Comes with its own little screwdriver.")
V("bracelet.beaded", "bracelet", "Beaded bracelet", 40, "fashion", stores=J)
V("earrings.silver-hoops", "earrings", "Silver hoops", 85, "fashion", stores=J)
V("earrings.gold-hoops", "earrings", "14k gold hoops", 420, "precious", stores=J)
V("earrings.studs-05", "earrings", "Diamond studs, ½ carat total", 1_100, "precious", stores=J)
V("earrings.studs-1", "earrings", "Diamond studs, 1 carat total", 3_300, "precious", stores=J)
V("earrings.studs-2-exc", "earrings", "Diamond studs, 2 carats, excellent", 12_000, "precious", stores=JL)
V("earrings.pearl", "earrings", "Pearl drop earrings", 600, "precious", stores=J)

# --------------------------------------------------------------------------- #
# Art — invented artists. Spec: art is a collectible; demand moves it.        #
# --------------------------------------------------------------------------- #

V("art.print-signed", "art", "Signed print, edition of 200", 450, "art", stores=G)
V("art.emerging-harbor", "art", "Maren Holt — Harbor at Dusk (oil)", 3_800, "art", stores=G)
V("art.emerging-field", "art", "Tobias Wren — Field Notes No. 4", 2_600, "art", stores=G)
V("art.emerging-portrait", "art", "Ines Varga — Portrait of a Neighbor", 6_500, "art", stores=G)
V("art.emerging-ceramic", "art", "Kofi Asante — Vessel, glazed stoneware", 1_800, "art", stores=G)
V("art.emerging-photo", "art", "Lena Park — Night Bus (photograph)", 2_200, "art", stores=G)
V("art.emerging-abstract", "art", "Dario Fenn — Untitled (blue)", 9_500, "art", stores=G)
V("art.emerging-sculpture", "art", "Hana Okafor — Standing Figure (bronze)", 14_000, "art", stores=G)
V("art.mid-landscape", "art", "Walter Brede — Valley in October", 28_000, "art", stores=G)
V("art.mid-city", "art", "Rosa Achterberg — City Grid II", 45_000, "art", stores=G)
V("art.mid-still-life", "art", "Paul Severin — Still Life with Lemons", 36_000, "art", stores=G)
V("art.mid-collage", "art", "Ayo Bankole — Market Day (collage)", 52_000, "art", stores=G)
V("art.mid-neon", "art", "Jun Takeda — I Was Here (neon)", 64_000, "art", stores=G,
  blurb="It glows pink and hums slightly.")
V("art.mid-tapestry", "art", "Olga Meret — Tapestry for a Long Winter", 75_000, "art", stores=G)
V("art.mid-drawing", "art", "Henrik Lund — Studies of Hands (ink)", 18_000, "art", stores=G)
V("art.est-canvas", "art", "Clara Moss — Red Interior", 180_000, "art", stores=G)
V("art.est-sculpture", "art", "Bruno Kessel — Iron Horse", 260_000, "art", stores=G)
V("art.est-abstract", "art", "Nadia Orel — Composition in Ochre", 340_000, "art", stores=G)
V("art.est-photo", "art", "Samuel Ide — The Long Table (photograph)", 120_000, "art", stores=G)
V("art.est-pop", "art", "Vic Dorrance — Soup Can Sunrise", 420_000, "art", stores=G,
  blurb="Bright, flat and instantly familiar. That's the point.")
V("art.blue-chip-1", "art", "Émile Rousseaux — Bathers at Noon", 2_400_000, "art", stores=G, rarity="rare")
V("art.blue-chip-2", "art", "Helene Voss — Black Square, Small", 4_800_000, "art", stores=G, rarity="rare")
V("art.blue-chip-3", "art", "Marco Bellandi — The Orchard Wall", 9_500_000, "art", stores=G, rarity="very rare")

# --------------------------------------------------------------------------- #
# Antiques, historical pieces, curios and the mythical                         #
# --------------------------------------------------------------------------- #

V("antique.mantel-clock", "antique", "French mantel clock, 1880s", 2_800, "antique", stores=A)
V("antique.secretary-desk", "antique", "Mahogany secretary desk, 1810", 18_000, "antique", stores=A)
V("antique.grandfather-clock", "antique", "Grandfather clock, 1790s", 12_500, "antique", stores=A)
V("antique.tea-service", "antique", "Silver tea service, 1900", 6_400, "antique", stores=A)
V("antique.oriental-rug", "antique", "Hand-knotted Persian rug, 1920s", 9_000, "antique", stores=A)
V("antique.qing-vase", "antique", "Qing dynasty porcelain vase", 48_000, "antique", stores=A, rarity="uncommon")
V("antique.chandelier", "antique", "Crystal chandelier, 1890s", 22_000, "antique", stores=A)
V("antique.rocking-horse", "antique", "Victorian rocking horse", 3_600, "antique", stores=A)
V("antique.sea-chest", "antique", "Ship captain's sea chest", 4_200, "antique", stores=A)
V("antique.globe", "antique", "Library globe, 1860s", 15_500, "antique", stores=A)
V("antique.quilt", "antique", "Hand-stitched quilt, 1880s", 1_400, "antique", stores=A)
V("antique.typewriter", "antique", "Cast-iron typewriter, 1910s", 900, "antique", stores=A)
V("antique.armoire", "antique", "Walnut armoire, 1850s", 7_800, "antique", stores=A)
V("antique.samurai-armor", "antique", "Samurai armor, Edo period", 85_000, "antique", stores=A, rarity="rare")
V("historical.civil-war-sword", "historical", "Civil War officer's sword", 6_800, "antique", stores=A)
V("historical.first-edition", "historical", "First edition novel, 1925, signed", 38_000, "antique", stores=A, rarity="uncommon")
V("historical.revolutionary-letter", "historical", "Letter signed by a Revolutionary War general", 26_000, "antique", stores=A, rarity="uncommon")
V("historical.mission-patch", "historical", "Mission patch flown to the Moon", 14_000, "antique", stores=A, rarity="uncommon")
V("historical.gold-rush-nugget", "historical", "Gold Rush nugget, 1849", 11_000, "antique", stores=A)
V("historical.titanic-menu", "historical", "Dinner menu from an ocean liner, 1912", 18_500, "antique", stores=A, rarity="uncommon")
V("historical.pony-express", "historical", "Pony Express letter, 1860", 9_500, "antique", stores=A)
V("historical.roman-coin", "historical", "Roman silver denarius", 650, "antique", stores=A)
V("historical.greek-coin", "historical", "Athenian owl tetradrachm", 3_900, "antique", stores=A)
V("historical.baseball-1927", "historical", "Signed baseball, 1927 season", 42_000, "antique", stores=A, rarity="uncommon")
V("historical.movie-prop", "historical", "Screen-used movie prop, 1980s", 16_000, "antique", stores=A)
V("historical.telephone", "historical", "Early telephone, 1890s", 5_200, "antique", stores=A)
V("historical.map-1700s", "historical", "Hand-drawn map of the colonies, 1700s", 34_000, "antique", stores=A, rarity="uncommon")
V("historical.dinosaur-tooth", "historical", "Tyrannosaur tooth", 22_000, "antique", stores=A, rarity="uncommon",
  blurb="Sixty-six million years old, and still sharp.")
V("historical.meteorite", "historical", "Iron meteorite, 4 lb", 3_300, "antique", stores=A)
V("curio.rubber-chicken", "curio", "Rubber chicken, signed by a famous comedian", 350, "curio", stores=A,
  blurb="The signature is on the beak.")
V("curio.parking-ticket", "curio", "Framed parking ticket, 1958", 120, "curio", stores=A)
V("curio.jackalope", "curio", "Mounted jackalope", 480, "curio", stores=A,
  blurb="The seller swore it was real. The seller winked.")
V("curio.lava-lamps", "curio", "Collection of 40 lava lamps", 1_600, "curio", stores=A)
V("curio.twine-ball", "curio", "Ball of twine, 300 lb", 900, "curio", stores=A)
V("curio.gnome", "curio", "Garden gnome that toured the world", 650, "curio", stores=A,
  blurb="Comes with an album of it at forty landmarks.")
V("curio.toaster", "curio", "Toast with a face in it, preserved", 2_800, "curio", stores=A)
V("curio.bigfoot-cast", "curio", "Plaster cast of a Bigfoot footprint", 1_200, "curio", stores=A)
V("curio.arcade", "curio", "Arcade cabinet, 1981", 3_500, "curio", stores=A)
V("curio.jukebox", "curio", "Chrome jukebox, 1956", 9_500, "curio", stores=A)
V("curio.ufo-photo", "curio", "Signed UFO photograph, 1966", 750, "curio", stores=A)
V("curio.trophy", "curio", "World's Okayest Boss trophy, solid bronze", 1_100, "curio", stores=A)
V("curio.pinball", "curio", "Pinball machine, 1978", 6_200, "curio", stores=A)
V("curio.mannequin", "curio", "Department store mannequin named Gerald", 400, "curio", stores=A)

# Spec 197 and 1281: novelty and collection content, never a stat. Spec 1249:
# "Mythical collectibles/easter eggs are extremely rare."
V("mythical.trident", "mythical", "Poseidon's Trident", 1_200_000, "mythical", stores=A, rarity="mythical",
  blurb="Always slightly damp. Nobody can explain it.")
V("mythical.pandoras-box", "mythical", "Pandora's Box", 250_000, "mythical", stores=A, rarity="mythical",
  blurb="Still closed. Keep it that way.")
V("mythical.diamond-pickaxe", "mythical", "Diamond Pickaxe", 40_000, "mythical", stores=A, rarity="mythical",
  blurb="Mines through anything, apparently.")
V("mythical.golden-fleece", "mythical", "The Golden Fleece", 800_000, "mythical", stores=A, rarity="mythical")
V("mythical.philosophers-stone", "mythical", "The Philosopher's Stone", 2_000_000, "mythical", stores=A, rarity="mythical",
  blurb="It turns nothing into gold. You've tried.")
V("mythical.excalibur", "mythical", "A sword pulled from a stone", 1_500_000, "mythical", stores=A, rarity="mythical",
  blurb="The stone came too. It's in the garage.")


def main() -> None:
    ids = [e["id"] for e in ENTRIES]
    dupes = [i for i, c in Counter(ids).items() if c > 1]
    assert not dupes, dupes
    store_ids = {s["id"] for s in STORES}
    for e in ENTRIES:
        assert e["stores"] and set(e["stores"]) <= store_ids, e["id"]
        assert e["price"] > 0, e["id"]
    for s in STORES:
        assert any(s["id"] in e["stores"] for e in ENTRIES), s["id"]
    OUT_PATH.write_text(json.dumps({"version": CATALOG_VERSION, "stores": STORES, "entries": ENTRIES}, indent=2) + "\n")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}: {len(ENTRIES)} valuables in {len(STORES)} stores")
    print("  by kind:", dict(Counter(e["kind"] for e in ENTRIES)))


if __name__ == "__main__":
    main()
