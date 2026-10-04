#!/usr/bin/env python3
"""
Ticket 0601 — the businesses a character can start.

Authoring source for `packages/content/data/businesses.json`. Edit here, run it,
commit both.

0602 ADDS NINETEEN (the MORE list below), making thirty-one of spec 396's
thirty-seven; the other six wait on systems that do not exist yet (DEFERRED).

A REPRESENTATIVE TWELVE, NOT THE CATALOG. Spec 1356–1360: "start with a
representative business catalog and expand". Twelve spans the range the engine
has to handle — a cleaning company a nurse could open with a year's savings, a
restaurant that takes a house deposit, a software company whose year is mostly
luck, a hotel nobody in the game can afford yet. Spec 396's other twenty-odd
types arrive in 0602; none of the fourteen it removed ever appear.

WHAT A BUSINESS IS, AS NUMBERS. Every row is a year at MATURITY, selling at the
going price, with a standard supplier, medium pay and an owner who works there
full time, in an ordinary year:

    revenue     what it sells, in dollars
    cogs        what the stuff it sells costs, as a share of revenue
    staff       the headcount that serves that revenue, the owner not counted
    wage        what one of them costs a year, payroll tax and all
    overhead    rent, insurance, the lease on the van — owed however it sells
    startup     what it takes to open the doors: fittings and a float

Profit is what is left, and it is the owner's pay. The figures are benchmarked
to what small businesses of each kind take in (SBA Office of Advocacy and BLS
Business Employment Dynamics; margins around 6–20% after the owner's labour,
the high end for trades and services, the low end for food), so a player who
knows what a café does reads this one as a real one.

THE REST ARE DIALS FOR THE ENGINE IN `@yearafter/finance`:

    elasticity   how fast customers leave when the price goes up (spec 400). A firm's
                 customers can go elsewhere, so this is far above the market's own: it is
                 set so the best price for an ordinary business is about the going rate
    cyclical     how much of a bad economy a business feels (spec 1222)
    volatility   how far a year can land from the last (spec 413: weighted, not
                 punishing)
    headroom     how far past its normal year a good one can go with the same
                 people (0602): 1 for anything made or served by hand, higher for
                 a game or a publication that sells the thousandth copy for free
    ramp         years a new business takes to find its customers
    productShare how much of quality is what it buys, not who serves; zero means
                 there is no supplier to choose (spec 393: "relevant product
                 businesses")
    skills       the two visible stats that help an owner here
    valueMultiple what a buyer pays, in years of profit (spec 398's valuation)
    assetShare   how much of the startup is fittings that keep some value

Usage:  python3 scripts/generate-businesses.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "packages" / "content" / "data" / "businesses.json"

CATALOG_VERSION = 2

BUSINESSES: list[dict] = [
    {
        "id": "biz.cleaning",
        "name": "Cleaning Company",
        "sector": "Services",
        "blurb": "Offices and homes, cleaned on a schedule. Cheap to open, hard on the owner.",
        "startup": 20_000,
        "revenue": 300_000,
        "cogs": 0.08,
        "staff": 6,
        "staffMin": 2,
        "wage": 33_000,
        "overhead": 32_000,
        "assetShare": 0.30,
        "elasticity": 3.0,
        "cyclical": 0.25,
        "volatility": 0.08,
        "ramp": 1.2,
        "productShare": 0.25,
        "supplier": True,
        "skills": ["discipline", "charisma"],
        "valueMultiple": 2.4,
        "names": ["Brightside Cleaning", "Tidy Hands", "Fresh Start Maintenance", "Clean Slate Co.", "Harbor Janitorial", "Spotless & Sons"],
    },
    {
        "id": "biz.landscaping",
        "name": "Landscaping Company",
        "sector": "Services",
        "blurb": "Lawns, hedges and the odd patio. A truck, a trailer and a crew.",
        "startup": 55_000,
        "revenue": 360_000,
        "cogs": 0.12,
        "staff": 7,
        "staffMin": 2,
        "wage": 32_000,
        "overhead": 43_000,
        "assetShare": 0.75,
        "elasticity": 3.0,
        "cyclical": 0.35,
        "volatility": 0.10,
        "ramp": 1.4,
        "productShare": 0.25,
        "supplier": True,
        "skills": ["discipline", "willpower"],
        "valueMultiple": 2.4,
        "names": ["Greenway Lawn & Garden", "Evergreen Outdoor", "Cedar Ridge Landscaping", "Two Oaks Grounds", "Stonebridge Landscapes", "The Mow Crew"],
    },
    {
        "id": "biz.salon",
        "name": "Salon & Barbershop",
        "sector": "Personal services",
        "blurb": "Chairs, mirrors and regulars. The owner cuts hair too.",
        "startup": 70_000,
        "revenue": 240_000,
        "cogs": 0.15,
        "staff": 3,
        "staffMin": 1,
        "wage": 34_000,
        "overhead": 42_000,
        "assetShare": 0.65,
        "elasticity": 2.2,
        "cyclical": 0.30,
        "volatility": 0.08,
        "ramp": 1.5,
        "productShare": 0.30,
        "supplier": True,
        "skills": ["charisma", "looks"],
        "valueMultiple": 2.2,
        "names": ["The Sharp Edge", "Studio Lorne", "Copper & Comb", "Main Street Cuts", "Velvet Chair", "Little Rose Salon"],
    },
    {
        "id": "biz.cafe",
        "name": "Café",
        "sector": "Food",
        "blurb": "Coffee, pastries and a lunch crowd. Early mornings, thin margins.",
        "startup": 150_000,
        "revenue": 480_000,
        "cogs": 0.33,
        "staff": 6,
        "staffMin": 3,
        "wage": 31_000,
        "overhead": 70_000,
        "assetShare": 0.70,
        "elasticity": 3.2,
        "cyclical": 0.50,
        "volatility": 0.13,
        "ramp": 1.6,
        "productShare": 0.60,
        "supplier": True,
        "skills": ["charisma", "discipline"],
        "valueMultiple": 2.3,
        "names": ["The Daily Grind", "Corner Bean", "Linden Street Café", "Morning Light", "Copperpot Coffee", "The Quiet Cup"],
    },
    {
        "id": "biz.fitness",
        "name": "Fitness Studio",
        "sector": "Personal services",
        "blurb": "Classes and memberships. The lease is the big cost; the members are the business.",
        "startup": 190_000,
        "revenue": 520_000,
        "cogs": 0.06,
        "staff": 5,
        "staffMin": 2,
        "wage": 33_000,
        "overhead": 240_000,
        "assetShare": 0.60,
        "elasticity": 1.7,
        "cyclical": 0.45,
        "volatility": 0.12,
        "ramp": 1.8,
        "productShare": 0.0,
        "supplier": False,
        "skills": ["health", "charisma"],
        "valueMultiple": 2.8,
        "names": ["Ironworks Fitness", "Peak Studio", "Cadence Training", "Foundry Gym", "North Star Fitness", "Pulse Collective"],
    },
    {
        "id": "biz.autorepair",
        "name": "Auto Repair Shop",
        "sector": "Trades",
        "blurb": "Brakes, oil and the check-engine light. People need cars fixed in any economy.",
        "startup": 230_000,
        "revenue": 640_000,
        "cogs": 0.30,
        "staff": 6,
        "staffMin": 2,
        "wage": 44_000,
        "overhead": 103_000,
        "assetShare": 0.70,
        "elasticity": 3.0,
        "cyclical": 0.20,
        "volatility": 0.08,
        "ramp": 1.8,
        "productShare": 0.45,
        "supplier": True,
        "skills": ["smarts", "discipline"],
        "valueMultiple": 3.0,
        "names": ["Cornerstone Auto", "Dependable Garage", "Route 9 Automotive", "Ironhorse Repair", "Fairmont Auto Care", "Blue Wrench"],
    },
    {
        "id": "biz.restaurant",
        "name": "Restaurant",
        "sector": "Food",
        "blurb": "A dining room, a kitchen and a staff of a dozen. The classic way to lose a house deposit.",
        "startup": 380_000,
        "revenue": 900_000,
        "cogs": 0.31,
        "staff": 13,
        "staffMin": 7,
        "wage": 31_000,
        "overhead": 130_000,
        "assetShare": 0.75,
        "elasticity": 3.5,
        "cyclical": 0.60,
        "volatility": 0.15,
        "ramp": 2.0,
        "productShare": 0.65,
        "supplier": True,
        "skills": ["charisma", "discipline"],
        "valueMultiple": 2.1,
        "names": ["The Long Table", "Salt & Ember", "Harvest Kitchen", "Olive & Vine", "The Copper Spoon", "Tavola"],
    },
    {
        "id": "biz.clothing",
        "name": "Clothing Store",
        "sector": "Retail",
        "blurb": "A storefront, a stockroom and the season's racks. Fashion sells until it doesn't.",
        "startup": 150_000,
        "revenue": 560_000,
        "cogs": 0.50,
        "staff": 4,
        "staffMin": 2,
        "wage": 30_000,
        "overhead": 102_000,
        "assetShare": 0.45,
        "elasticity": 3.1,
        "cyclical": 0.70,
        "volatility": 0.14,
        "ramp": 1.8,
        "productShare": 0.70,
        "supplier": True,
        "skills": ["looks", "charisma"],
        "valueMultiple": 2.2,
        "names": ["Thread & Needle", "Maple Street Apparel", "The Fitting Room", "Wren & Co.", "Northside Outfitters", "Second Skin"],
    },
    {
        "id": "biz.hvac",
        "name": "HVAC Company",
        "sector": "Trades",
        "blurb": "Heating and cooling, installed and repaired. Busy in every heat wave and cold snap.",
        "startup": 140_000,
        "revenue": 900_000,
        "cogs": 0.30,
        "staff": 8,
        "staffMin": 3,
        "wage": 50_000,
        "overhead": 112_000,
        "assetShare": 0.65,
        "elasticity": 3.3,
        "cyclical": 0.30,
        "volatility": 0.10,
        "ramp": 1.8,
        "productShare": 0.40,
        "supplier": True,
        "skills": ["smarts", "discipline"],
        "valueMultiple": 3.2,
        "names": ["Comfort Zone Heating & Air", "Summit HVAC", "Four Seasons Climate", "Cooper & Daughters Air", "Northwind Mechanical", "ClearAir Services"],
    },
    {
        "id": "biz.software",
        "name": "Software Company",
        "sector": "Technology",
        "blurb": "A few good engineers and a product. Most years are modest; a few are enormous.",
        "startup": 60_000,
        "revenue": 700_000,
        "cogs": 0.05,
        "staff": 5,
        "staffMin": 1,
        "wage": 95_000,
        "overhead": 83_000,
        "assetShare": 0.10,
        "elasticity": 3.2,
        "cyclical": 0.50,
        "volatility": 0.28,
        "ramp": 2.5,
        "productShare": 0.0,
        "supplier": False,
        "skills": ["smarts", "willpower"],
        "valueMultiple": 3.8,
        "names": ["Lattice Labs", "Northpoint Software", "Kestrel Systems", "Bright Loop", "Parallel Works", "Quill & Code"],
    },
    {
        "id": "biz.accounting",
        "name": "Accounting Firm",
        "sector": "Professional services",
        "blurb": "Books, taxes and a client list. Quiet, steady and slow to build.",
        "startup": 45_000,
        "revenue": 450_000,
        "cogs": 0.02,
        "staff": 4,
        "staffMin": 1,
        "wage": 70_000,
        "overhead": 70_000,
        "assetShare": 0.15,
        "elasticity": 2.6,
        "cyclical": 0.15,
        "volatility": 0.07,
        "ramp": 2.0,
        "productShare": 0.0,
        "supplier": False,
        "skills": ["smarts", "discipline"],
        "valueMultiple": 2.8,
        "names": ["Hartley & Ross CPAs", "Meridian Tax & Advisory", "Clearbook Accounting", "Fairweather Financial", "Ledgerwood & Co.", "Steele Lane Accounting"],
    },
    {
        "id": "biz.hotel",
        "name": "Hotel",
        "sector": "Hospitality",
        "blurb": "A hundred rooms and a lobby. Property, payroll and a long wait for the first profit.",
        "startup": 5_200_000,
        "revenue": 2_600_000,
        "cogs": 0.14,
        "staff": 26,
        "staffMin": 14,
        "wage": 42_000,
        "overhead": 570_000,
        "assetShare": 0.90,
        "elasticity": 2.2,
        "cyclical": 0.90,
        "volatility": 0.14,
        "ramp": 2.5,
        "productShare": 0.20,
        "supplier": True,
        "skills": ["charisma", "smarts"],
        "valueMultiple": 7.0,
        "names": ["The Harborview Hotel", "Lindenhall Inn", "Bellwether Suites", "The Alder House", "Crestline Hotel", "Marrow Point Lodge"],
    },
]


def sized(margin: float, **b) -> dict:
    """
    A 0602 entry. Overhead is not typed: it is whatever leaves the owner a
    stated margin at maturity, so a mistyped wage cannot silently turn a law
    firm into a charity. (The twelve of 0601 were tuned by hand and keep their
    typed numbers.)
    """
    b["overhead"] = round(
        (b["revenue"] * (1 - b["cogs"]) - b["staff"] * b["wage"] - margin * b["revenue"]) / 1000
    ) * 1000
    b["supplier"] = b["productShare"] > 0
    return b


# 0602: the rest of spec 396 that the build has a world for. Six wait on
# something that does not exist yet and are listed in DEFERRED, so the
# validator and the roadmap can say so.
MORE: list[dict] = [
    sized(0.22,
        id="biz.law", name="Law Firm", sector="Professional",
        blurb="A handful of attorneys and the people who keep them organized. Slow to build a name, hard to leave.",
        startup=90_000, revenue=780_000, cogs=0.03, staff=5, staffMin=1, wage=115_000,
        assetShare=0.10, elasticity=2.6, cyclical=0.35, volatility=0.16, ramp=3.0, productShare=0.0,
        skills=["smarts", "charisma"], valueMultiple=2.0,
        names=["Hale & Ward", "Pryor Dunmore LLP", "Calloway Law", "Stone Harbor Legal", "Reyes & Finch", "Ashby Counsel"]),
    sized(0.16,
        id="biz.marketing", name="Marketing Agency", sector="Professional",
        blurb="Campaigns for clients who cut the budget first when money is tight.",
        startup=40_000, revenue=520_000, cogs=0.10, staff=5, staffMin=1, wage=72_000,
        assetShare=0.10, elasticity=3.0, cyclical=0.75, volatility=0.22, ramp=2.2, productShare=0.0,
        skills=["charisma", "smarts"], valueMultiple=2.6,
        names=["Loud & Clear", "Brightline Creative", "Signal Fire", "Open Door Media", "Tall Grass Studio", "Fieldnote Agency"]),
    sized(0.10,
        id="biz.realestate", name="Real Estate Brokerage", sector="Professional",
        blurb="Agents on commission and a name on the signs. When the housing market stops, so do you.",
        startup=60_000, revenue=900_000, cogs=0.55, staff=4, staffMin=1, wage=52_000,
        assetShare=0.15, elasticity=2.8, cyclical=1.00, volatility=0.25, ramp=2.5, productShare=0.0,
        skills=["charisma", "smarts"], valueMultiple=2.2,
        names=["Keystone Realty", "Bluebird Homes", "Hearthstone Brokers", "Oak & Ledger Realty", "Northgate Properties", "Doorstep Realty"]),
    sized(0.08,
        id="biz.jewelry", name="Jewelry Store", sector="Retail",
        blurb="Cases of stock worth more than the shop. Customers come for an occasion and leave with a story.",
        startup=350_000, revenue=900_000, cogs=0.52, staff=4, staffMin=2, wage=42_000,
        assetShare=0.65, elasticity=2.6, cyclical=0.80, volatility=0.12, ramp=2.0, productShare=0.80,
        skills=["looks", "charisma"], valueMultiple=2.4,
        names=["Gilded Lane", "Marlowe & Daughters", "The Setting", "Carat & Co.", "Ellis Fine Jewelers", "Amber Row"]),
    sized(0.055,
        id="biz.electronics", name="Electronics Store", sector="Retail",
        blurb="Thin margins on things that are cheaper online by spring. Service is the only edge.",
        startup=280_000, revenue=1_400_000, cogs=0.72, staff=6, staffMin=3, wage=38_000,
        assetShare=0.50, elasticity=3.4, cyclical=0.75, volatility=0.14, ramp=1.8, productShare=0.60,
        skills=["smarts", "charisma"], valueMultiple=2.0,
        names=["Circuit & Co.", "Plug In", "Volt Street", "The Gadget Bench", "Ampere Electronics", "Signal & Wire"]),
    sized(0.08,
        id="biz.furniture", name="Furniture Store", sector="Retail",
        blurb="A showroom, a warehouse and long gaps between sales. Every one of them is big.",
        startup=400_000, revenue=1_200_000, cogs=0.50, staff=7, staffMin=3, wage=40_000,
        assetShare=0.55, elasticity=2.7, cyclical=0.85, volatility=0.13, ramp=1.6, productShare=0.70,
        skills=["looks", "charisma"], valueMultiple=2.2,
        names=["Hearth & Timber", "The Showroom Floor", "Larkspur Furnishings", "Daybreak Home", "Corbel & Cane", "Plank Road Furniture"]),
    sized(0.09,
        id="biz.specialty", name="Specialty Retail", sector="Retail",
        blurb="One thing sold well to people who care about it: bikes, books, bait, board games.",
        startup=120_000, revenue=480_000, cogs=0.55, staff=3, staffMin=1, wage=34_000,
        assetShare=0.50, elasticity=3.0, cyclical=0.60, volatility=0.13, ramp=1.8, productShare=0.60,
        skills=["charisma", "willpower"], valueMultiple=2.1,
        names=["The Spoke Shop", "Corner Curiosity", "Fine Print Books", "Tackle & Trade", "Roll for Initiative", "The Last Aisle"]),
    sized(0.19,
        id="biz.resort", name="Resort", sector="Hospitality",
        blurb="A destination: rooms, a pool, a restaurant, a staff of seventy. A bad season is a bad year for a whole town.",
        startup=14_000_000, revenue=8_400_000, cogs=0.16, staff=72, staffMin=38, wage=46_000,
        assetShare=0.90, elasticity=2.2, cyclical=0.95, volatility=0.15, ramp=3.0, productShare=0.20,
        skills=["charisma", "smarts"], valueMultiple=7.5,
        names=["Cove Point Resort", "The Aspen Hollow", "Saltwater Pines", "Stillwater Lodge & Spa", "Vista Ridge Resort", "Wildflower Springs"]),
    sized(0.13,
        id="biz.electrical", name="Electrical Company", sector="Trades",
        blurb="Panels, wiring and the odd emergency at midnight. Licensed work that needs licensed people.",
        startup=110_000, revenue=620_000, cogs=0.27, staff=5, staffMin=2, wage=62_000,
        assetShare=0.35, elasticity=2.8, cyclical=0.50, volatility=0.10, ramp=1.8, productShare=0.30,
        skills=["smarts", "discipline"], valueMultiple=2.5,
        names=["Bright Current Electric", "Ohm Sweet Home", "Live Wire Services", "Ridgeline Electric", "Joule & Sons", "Safe Circuit Co."]),
    sized(0.14,
        id="biz.plumbing", name="Plumbing Company", sector="Trades",
        blurb="Nobody shops around at 2 a.m. with water on the floor. The calls come in any economy.",
        startup=95_000, revenue=560_000, cogs=0.25, staff=5, staffMin=2, wage=56_000,
        assetShare=0.35, elasticity=2.6, cyclical=0.30, volatility=0.09, ramp=1.6, productShare=0.30,
        skills=["discipline", "health"], valueMultiple=2.5,
        names=["Flowright Plumbing", "Trusty Pipe & Drain", "Copperline Services", "Rapid Rooter", "Leakproof Co.", "Hollis Plumbing"]),
    sized(0.12,
        id="biz.roofing", name="Roofing Company", sector="Trades",
        blurb="Crews on ladders and a calendar run by the weather. A hail storm is a good year.",
        startup=130_000, revenue=780_000, cogs=0.33, staff=8, staffMin=3, wage=48_000,
        assetShare=0.35, elasticity=2.9, cyclical=0.60, volatility=0.16, ramp=2.0, productShare=0.50,
        skills=["health", "discipline"], valueMultiple=2.3,
        names=["Highpoint Roofing", "Peak & Shingle", "Stormguard Roofing", "Overhead Pros", "Ridgecap Roofing", "True North Exteriors"]),
    sized(0.12,
        id="biz.gaming", name="Gaming Company", sector="Technology",
        blurb="A small studio and a game. Most never earn back their year; one in a long while is a hit.",
        startup=150_000, revenue=900_000, cogs=0.04, staff=7, staffMin=2, wage=95_000,
        assetShare=0.10, elasticity=2.0, cyclical=0.50, volatility=0.55, ramp=3.5, productShare=0.0,
        skills=["smarts", "willpower"], valueMultiple=4.0,
        names=["Pixel Harbor", "Lanternfish Games", "Tenth Floor Studios", "Moth & Ember", "Offbeat Interactive", "Cardinal Games"], headroom=1.7),
    sized(0.10,
        id="biz.media", name="Media Company", sector="Media",
        blurb="Publications, podcasts and the advertisers who pay for them, until they don't.",
        startup=200_000, revenue=1_100_000, cogs=0.22, staff=8, staffMin=3, wage=68_000,
        assetShare=0.25, elasticity=2.2, cyclical=0.75, volatility=0.24, ramp=2.4, productShare=0.0,
        skills=["charisma", "smarts"], valueMultiple=2.4,
        names=["Daily Ledger Media", "Northlight Network", "The Long Table", "Field & Stream Digital", "Common Ground Media", "Harbor Press"], headroom=1.4),
    sized(0.09,
        id="biz.production", name="Production Company", sector="Media",
        blurb="Shoots for brands, networks and the occasional feature. Every project is a new small business.",
        startup=450_000, revenue=1_900_000, cogs=0.45, staff=8, staffMin=2, wage=70_000,
        assetShare=0.40, elasticity=2.8, cyclical=0.60, volatility=0.26, ramp=2.0, productShare=0.0,
        skills=["charisma", "looks"], valueMultiple=2.2,
        names=["Third Act Pictures", "Greenroom Films", "Wide Lens Productions", "Slate & Sparrow", "Midnight Reel", "Golden Hour Studio"]),
    sized(0.08,
        id="biz.apparelmfg", name="Apparel Manufacturing", sector="Manufacturing",
        blurb="Cut, sewn and shipped. Contracts are won on price and lost to anyone cheaper overseas.",
        startup=1_100_000, revenue=3_600_000, cogs=0.52, staff=30, staffMin=12, wage=36_000,
        assetShare=0.70, elasticity=3.4, cyclical=0.80, volatility=0.15, ramp=2.8, productShare=0.60,
        skills=["discipline", "smarts"], valueMultiple=2.6,
        names=["Stitchworks Mfg.", "Loom & Line", "Bolt Street Apparel", "Northmill Garments", "Selvedge Co.", "Cutting Room Mfg."]),
    sized(0.075,
        id="biz.electronicsmfg", name="Electronics Manufacturing", sector="Manufacturing",
        blurb="Boards and assemblies for other people's products. One lost customer is a quarter of the plant.",
        startup=2_800_000, revenue=9_000_000, cogs=0.60, staff=55, staffMin=25, wage=52_000,
        assetShare=0.70, elasticity=3.2, cyclical=0.90, volatility=0.18, ramp=3.5, productShare=0.50,
        skills=["smarts", "discipline"], valueMultiple=3.0,
        names=["Meridian Assembly", "Solder & Sons", "Fieldstone Electronics", "Pinnacle Circuits", "Anode Manufacturing", "Redline Electronics"]),
    sized(0.10,
        id="biz.specialtymfg", name="Specialty Manufacturing", sector="Manufacturing",
        blurb="Parts and products made in small runs for customers who cannot get them elsewhere.",
        startup=1_600_000, revenue=4_600_000, cogs=0.48, staff=28, staffMin=12, wage=50_000,
        assetShare=0.70, elasticity=2.6, cyclical=0.60, volatility=0.14, ramp=3.0, productShare=0.50,
        skills=["smarts", "discipline"], valueMultiple=3.0,
        names=["Ironbridge Fabrication", "Precision Hollow Works", "Greystone Specialty", "Tolerance & Co.", "Kiln & Forge", "Brightmetal Industries"]),
    sized(0.07,
        id="biz.trucking", name="Trucking Company", sector="Transport",
        blurb="A yard of trucks and the drivers to run them. Fuel, insurance and a bad week on the road.",
        startup=900_000, revenue=3_200_000, cogs=0.32, staff=22, staffMin=8, wage=62_000,
        assetShare=0.75, elasticity=3.4, cyclical=0.75, volatility=0.12, ramp=1.5, productShare=0.0,
        skills=["discipline", "health"], valueMultiple=2.4,
        names=["Long Haul Freight", "Redwood Carriers", "Ironhorse Trucking", "Open Road Transport", "Blue Mile Logistics", "Summit Freight Lines"]),
    sized(0.15,
        id="biz.vehiclerental", name="Vehicle Rental Business", sector="Transport",
        blurb="A lot of cars, vans and trucks, rented by the day. Utilization is the whole business.",
        startup=1_400_000, revenue=2_200_000, cogs=0.18, staff=9, staffMin=3, wage=38_000,
        assetShare=0.80, elasticity=3.0, cyclical=0.80, volatility=0.13, ramp=1.2, productShare=0.0,
        skills=["charisma", "discipline"], valueMultiple=3.0,
        names=["Easy Wheels Rental", "Roadrunner Rentals", "Keys & Co.", "Open Lot Car Hire", "Drive Time Rentals", "Pickup Point"]),
]

# Spec 396 names these and the build has no world for them yet. Each waits for
# the ticket that makes it more than a name on a list.
DEFERRED: dict[str, str] = {
    "Investment Firm": "0605 (private investments)",
    # 0602 put this one on 0603. 0603 built the lending TO a business, not a
    # business that lends: its income is interest on a book of loans that go
    # bad, which is not the demand-and-capacity shape every type here shares,
    # and it is the same kind of thing as an Investment Firm — capital put to
    # work, with a risk of losing it. They belong in one ticket.
    "Private Lending Firm": "0605 (private investments)",
    "Record Label": "v0.08 (music)",
    "Talent Agency": "v0.08 (acting)",
    "Casino": "gambling",
    "Racing Team": "v0.08 (sports)",
}


def elasticity_of(b: dict) -> float:
    """
    How fast customers leave when the price goes up, from the business's own
    costs rather than typed in (0602).

    The profit-maximising price of a firm that can add or shed staff as custom
    comes and goes is  p* = e / (e - 1) * mc,  where mc is what one more sale
    costs: the goods, and the share of a worker it takes. Set e so p* lands at
    the going price (a hair above), and a player who moves the slider is making
    a real trade-off in either direction. 0601 typed these and checked them
    against a fixed headcount; with the manager free to staff to the price, the
    typed numbers put the best price at 125-135% for half the catalog.
    """
    # A game or a publication sells more per head, so a head costs less per sale.
    mc = b["cogs"] + b["staff"] * b["wage"] / b["revenue"] / b.get("headroom", 1.0)
    return round(min(5.0, max(1.6, 0.95 / (1 - mc))), 2)


def profit_of(b: dict) -> float:
    return (
        b["revenue"] * (1 - b["cogs"])
        - b["staff"] * b["wage"]
        - b["overhead"]
    )


def main() -> None:
    BUSINESSES.extend(MORE)
    for b in BUSINESSES:
        # How far past its normal year a hit can take it with the same people.
        # Digital goods scale without staff; almost nothing else does.
        b.setdefault("headroom", 1.0)
        b["elasticity"] = elasticity_of(b)
    ids = [b["id"] for b in BUSINESSES]
    assert len(ids) == len(set(ids)), "duplicate id"
    for b in BUSINESSES:
        assert b["staffMin"] <= b["staff"], b["id"]
        assert 0 < b["cogs"] < 0.8, b["id"]
        assert 0 <= b["productShare"] <= 1, b["id"]
        assert b["supplier"] == (b["productShare"] > 0), b["id"]
        assert len(b["names"]) >= 6, b["id"]
        p = profit_of(b)
        # The owner's pay at maturity is the profit. Anything outside this band
        # is a number that has been mistyped, not a design.
        assert p / b["revenue"] > 0.05, (b["id"], p)
        assert p / b["revenue"] < 0.30, (b["id"], p)
        # What the startup earns each year, as a share of what it cost.
        assert p / b["startup"] > 0.10, (b["id"], p / b["startup"])
        b["gate"] = round(b["startup"] * 0.6)
    OUT_PATH.write_text(json.dumps({"version": CATALOG_VERSION, "entries": BUSINESSES}, indent=2) + "\n")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}: {len(BUSINESSES)} businesses")
    for b in BUSINESSES:
        p = profit_of(b)
        print(
            f"  {b['id']:<16} startup {b['startup']:>9,}  revenue {b['revenue']:>9,}  "
            f"owner's pay {p:>8,.0f}  margin {p / b['revenue'] * 100:4.1f}%  return {p / b['startup'] * 100:5.1f}%"
        )


if __name__ == "__main__":
    main()
