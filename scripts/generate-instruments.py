#!/usr/bin/env python3
"""
Ticket 0308c — the instrument catalog.

WHY THIS EXISTS. 0308 shipped seven PRODUCTS: "Index Fund", "Growth Shares",
"Crypto". Categories with a drift and a spread. You could not hold a thing, only
a kind of thing, and nothing had a price you could remember or watch move.

The reference point is a screen showing "Bitizen Broadcasting Corporation (BBC),
$41.87 (down 0.85), Communication Sector". That is not a polish gap, it is an
architectural one: an instrument has a NAME, a TICKER, a SECTOR, a PRICE PER
UNIT and a HISTORY, and everything engaging about an investment screen follows
from those five things. You own 570 of something at $1,712.29, not "some crypto".

NAMING FOLLOWS THE HOUSE VOICE, which is `employers.json`: "Marlow & Pine",
"Halcott Stores", "The Bramble Group", "Ninth Street Supply". Dry, plausible,
faintly English. Deliberately NOT the reference app's register — its catalog
runs to PrawnHub Group and DeepCoin (BALZ), which is a different game's sense of
humour and would sit badly against this build's copy. Crypto is allowed to be a
little sillier than the rest because real crypto naming genuinely is.

Spec 1213-1223: content is data, not code.

Run: python3 scripts/generate-instruments.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "packages/content/data/instruments.json"

CATALOG_VERSION = 1

ENTRIES: list[dict] = []

# Sectors a stock can belong to. Instruments in the same sector move together
# (the engine applies one shock per sector per year), which is the mechanic the
# reference app displays and does not appear to model.
SECTORS = [
    "technology",
    "health",
    "finance",
    "energy",
    "consumer",
    "industrial",
    "communication",
]


def add(**row: object) -> None:
    ENTRIES.append(dict(row))


def stock(
    ident: str,
    name: str,
    ticker: str,
    sector: str,
    price: float,
    drift: float,
    spread: float,
    beta: float,
    dividend: float,
    blurb: str,
) -> None:
    add(
        id=f"eq.{ident}",
        name=name,
        ticker=ticker,
        kind="stock",
        sector=sector,
        priceCents=round(price * 100),
        drift=drift,
        spread=spread,
        beta=beta,
        payout=dividend,
        termYears=0,
        blurb=blurb,
    )


def penny(ident: str, name: str, ticker: str, sector: str, price: float, blurb: str) -> None:
    """
    A separate tier rather than a cheap stock.

    Wider than anything else in the catalog, no dividend, and a real chance of
    going to nothing — which the engine enforces with a floor of a cent rather
    than the 5%-of-value floor the rest of the catalog gets. Spec calls these
    "local companies" and that is exactly the right register: small, specific,
    and one bad year from the wall.
    """
    add(
        id=f"pny.{ident}",
        name=name,
        ticker=ticker,
        kind="penny",
        sector=sector,
        priceCents=round(price * 100),
        drift=0.02,
        spread=0.72,
        beta=1.6,
        payout=0.0,
        termYears=0,
        blurb=blurb,
    )


def coin(ident: str, name: str, ticker: str, price: float, drift: float, spread: float, blurb: str) -> None:
    add(
        id=f"cx.{ident}",
        name=name,
        ticker=ticker,
        kind="crypto",
        priceCents=round(price * 100),
        drift=drift,
        spread=spread,
        beta=2.1,
        payout=0.0,
        termYears=0,
        blurb=blurb,
    )


def fund(
    ident: str,
    name: str,
    ticker: str,
    price: float,
    drift: float,
    spread: float,
    beta: float,
    payout: float,
    blurb: str,
    sector: str | None = None,
) -> None:
    row: dict = dict(
        id=f"fd.{ident}",
        name=name,
        ticker=ticker,
        kind="fund",
        priceCents=round(price * 100),
        drift=drift,
        spread=spread,
        beta=beta,
        payout=payout,
        termYears=0,
        blurb=blurb,
    )
    # A sector fund IS correlated with its sector, which is the whole point of
    # owning one and the whole risk of owning only one.
    if sector is not None:
        row["sector"] = sector
    ENTRIES.append(row)


def bond(issuer: str, ident: str, term: int, coupon: float, blurb: str) -> None:
    """
    Bonds are priced at a $1,000 par, which is both the real convention and the
    reason "8 bonds" is a sentence a player can hold in their head.

    0308b already built the mechanic: `termYears` puts a clock on the holding,
    the principal comes back on the date at what it is worth, and leaving early
    costs 12%. This is that mechanic finally given issuers and terms to vary.
    """
    add(
        id=f"bd.{ident}",
        name=f"{issuer} {term}-Year",
        ticker=f"{ident[:4].upper()}{term}",
        kind="bond",
        issuer=issuer,
        priceCents=100_000,
        drift=0.004,
        # Longer paper swings more when rates move. A ten-year bond is not a
        # three-year bond with a bigger number on it.
        spread=round(0.012 + term * 0.004, 4),
        beta=round(0.05 + term * 0.012, 4),
        payout=coupon,
        termYears=term,
        blurb=f"{blurb} Money back in {term} years.",
    )


# ---------------------------------------------------------------------------
# Stocks — six or seven to a sector, so a sector is a real choice
# ---------------------------------------------------------------------------

stock("halcyonsys", "Halcyon Systems", "HLC", "technology", 214.40, 0.071, 0.24, 1.30, 0.004,
      "Sells the software everything else is quietly built on.")
stock("verrell", "Verrell Compute", "VRL", "technology", 88.15, 0.082, 0.31, 1.45, 0.0,
      "Data centers, and the electricity bill to match.")
stock("aldermere", "Aldermere Labs", "ALD", "technology", 41.02, 0.064, 0.28, 1.38, 0.0,
      "Chip design. Brilliant, expensive, three years from revenue.")
stock("pellowsoft", "Pellow & Co", "PLW", "technology", 132.77, 0.055, 0.19, 1.12, 0.011,
      "Accounting software nobody loves and nobody leaves.")
stock("tarnsley", "Tarnsley Robotics", "TRN", "technology", 27.60, 0.078, 0.35, 1.52, 0.0,
      "Warehouse arms. Sells well when wages rise.")
stock("bellweather", "Bellweather Data", "BWD", "technology", 305.90, 0.060, 0.22, 1.24, 0.006,
      "Knows more about you than your mother does.")

stock("cadmoor", "Cadmoor Health", "CDM", "health", 96.30, 0.049, 0.17, 0.82, 0.019,
      "Hospital supplies. Dull, enormous, everywhere.")
stock("lindorne", "Lindorne Pharma", "LDP", "health", 178.55, 0.058, 0.26, 0.95, 0.014,
      "One drug carrying the whole company on its back.")
stock("prescott", "Prescott Devices", "PSD", "health", 64.20, 0.052, 0.21, 0.88, 0.012,
      "Pacemakers, pumps, and a very long wait for approval.")
stock("marchbank", "Marchbank Clinics", "MBC", "health", 38.75, 0.041, 0.19, 0.79, 0.024,
      "Runs the clinics your insurer has heard of.")
stock("windover", "Windover Genomics", "WNG", "health", 19.85, 0.069, 0.38, 1.41, 0.0,
      "Sequencing. Either the future or a lab with a lease.")
stock("okonjo", "Okonjo Biologics", "OKB", "health", 112.40, 0.061, 0.29, 1.06, 0.0,
      "Two trials from being worth a great deal more.")

stock("ashcroft", "Ashcroft Private", "ACP", "finance", 268.10, 0.051, 0.20, 1.08, 0.028,
      "Looks after money that already knows how to behave.")
stock("northgate", "Northgate Bank", "NGB", "finance", 54.65, 0.043, 0.18, 1.15, 0.035,
      "A high street bank with a high street bank's problems.")
stock("meridianfin", "Meridian Financial", "MRD", "finance", 87.90, 0.047, 0.19, 1.11, 0.031,
      "Lends to everybody and worries about it later.")
stock("solvay", "Solvay Assurance", "SVA", "finance", 143.25, 0.039, 0.15, 0.76, 0.033,
      "Insurance. Makes money slowly and loses it fast.")
stock("keelworth", "Keelworth Capital", "KWC", "finance", 391.80, 0.066, 0.27, 1.34, 0.016,
      "Buys companies, tidies them, sells them on.")
stock("tilbury", "Tilbury Exchange", "TBX", "finance", 76.40, 0.057, 0.23, 1.19, 0.018,
      "Takes a sliver of every trade anybody makes.")

stock("brackwell", "Brackwell Energy", "BKE", "energy", 61.55, 0.036, 0.25, 1.09, 0.042,
      "Oil and gas, and no apologies about it.")
stock("caltrow", "Caltrow Petroleum", "CTP", "energy", 118.70, 0.033, 0.27, 1.14, 0.046,
      "Enormous, unfashionable, and pays like clockwork.")
stock("sunmarch", "Sunmarch Renewables", "SMR", "energy", 23.90, 0.074, 0.36, 1.48, 0.0,
      "Solar farms, subsidies, and a lot of optimism.")
stock("pennyfeather", "Pennyfeather Grid", "PFG", "energy", 84.15, 0.031, 0.12, 0.55, 0.048,
      "Owns the wires. Nobody is building a second set.")
stock("driscoll", "Driscoll Drilling", "DRL", "energy", 16.45, 0.029, 0.42, 1.55, 0.011,
      "Rigs for hire. Feast one year, famine the next.")
stock("halbrook", "Halbrook Nuclear", "HLB", "energy", 147.30, 0.045, 0.23, 0.91, 0.020,
      "Four reactors and a very patient balance sheet.")

stock("bramble", "The Bramble Group", "BRM", "consumer", 72.85, 0.044, 0.16, 0.84, 0.025,
      "Supermarkets. Thin margins, unkillable demand.")
stock("marlowpine", "Marlow & Pine", "MLP", "consumer", 189.60, 0.056, 0.21, 1.03, 0.017,
      "Sells things people want rather than need.")
stock("verityhome", "Verity Home", "VTH", "consumer", 45.30, 0.040, 0.24, 1.12, 0.022,
      "Furniture. Does badly whenever nobody is moving house.")
stock("kestrelbrands", "Kestrel Brands", "KSB", "consumer", 96.70, 0.048, 0.15, 0.72, 0.029,
      "Owns forty labels you have used without noticing.")
stock("ninthstreet", "Ninth Street Supply", "NSS", "consumer", 31.15, 0.037, 0.26, 1.18, 0.019,
      "Discount retail. Quietly excellent in a bad year.")
stock("odell", "Odell Leisure", "ODL", "consumer", 58.40, 0.063, 0.30, 1.36, 0.008,
      "Hotels and cruises. First thing anybody cancels.")

stock("northline", "Northline Freight", "NLF", "industrial", 103.25, 0.042, 0.20, 1.10, 0.023,
      "Runs freight terminals nobody thinks about.")
stock("garrowsteel", "Garrow Steel", "GRW", "industrial", 39.80, 0.034, 0.31, 1.29, 0.026,
      "Steel. Moves with everything else and harder.")
stock("thackery", "Thackery Aerospace", "THK", "industrial", 226.55, 0.059, 0.24, 1.07, 0.013,
      "Parts for aircraft, and a defence order book.")
stock("bexhill", "Bexhill Construction", "BXC", "industrial", 67.10, 0.046, 0.28, 1.31, 0.015,
      "Builds what the council finally approved.")
stock("stroudwater", "Stroudwater Marine", "SWM", "industrial", 28.95, 0.038, 0.33, 1.27, 0.021,
      "Shipping. Rates are either wonderful or a disaster.")
stock("candermill", "Candermill Chemical", "CDC", "industrial", 155.40, 0.041, 0.22, 1.06, 0.027,
      "Makes the ingredient in the thing in the thing.")

stock("bitizen", "Bitizen Broadcasting", "BZB", "communication", 44.60, 0.035, 0.23, 1.13, 0.024,
      "Television, in an age that stopped watching it.")
stock("legacycell", "Legacy Cellular", "LCN", "communication", 21.35, 0.028, 0.17, 0.81, 0.052,
      "Ageing network, enormous dividend, no growth left.")
stock("harewood", "Harewood Media", "HWM", "communication", 137.90, 0.067, 0.29, 1.39, 0.005,
      "Streaming. Spends everything it earns on content.")
stock("quilling", "Quilling Telecom", "QLG", "communication", 63.75, 0.032, 0.16, 0.86, 0.044,
      "Fibre in the ground and a regulator on the phone.")
stock("ardenpress", "Arden Press", "ARP", "communication", 12.80, 0.021, 0.27, 1.02, 0.038,
      "Newspapers. Profitable, shrinking, nobody's future.")
stock("vaneflight", "Vane Networks", "VNE", "communication", 88.45, 0.054, 0.25, 1.22, 0.012,
      "Sells advertising against everybody else's work.")

# ---------------------------------------------------------------------------
# Penny stocks — "invest in local companies"
# ---------------------------------------------------------------------------

penny("cobbet", "Cobbet Mining", "CBB", "energy", 0.62, "A license, a hole, and a great deal of hope.")
penny("stannard", "Stannard Timber", "STD", "industrial", 1.85, "Sawmill. One contract from either outcome.")
penny("drumlin", "Drumlin Brewing", "DRB", "consumer", 3.40, "Four pubs and a rented brewery.")
penny("westerby", "Westerby Diagnostics", "WBD", "health", 0.94, "One test, one patent, one customer.")
penny("hollowell", "Hollowell Freight", "HWF", "industrial", 2.15, "Eleven lorries and a fuel bill.")
penny("marrable", "Marrable Software", "MRB", "technology", 5.70, "Six people and a product two firms use.")
penny("pinch", "Pinch Street Coffee", "PSC", "consumer", 1.30, "Nine shops. Wants to be ninety.")
penny("ottershaw", "Ottershaw Marine", "OTS", "industrial", 0.48, "Boatyard. The lease is the real asset.")
penny("wrenfield", "Wrenfield Organics", "WRF", "consumer", 4.25, "Farm shop chain with national ambitions.")
penny("calloway", "Calloway Salvage", "CWS", "industrial", 0.77, "Buys wrecks, sells parts, owes money.")
penny("tremaine", "Tremaine Solar", "TMS", "energy", 6.90, "Installs panels. Lives entirely on grants.")
penny("byfleet", "Byfleet Logistics", "BYL", "industrial", 3.05, "A warehouse and an app that nearly works.")

# ---------------------------------------------------------------------------
# Crypto
# ---------------------------------------------------------------------------

coin("meridiancoin", "Meridian", "MRDN", 18_400.00, 0.075, 0.52, "The first one. Everything else is measured against it.")
coin("etheline", "Etheline", "ETL", 1_240.00, 0.081, 0.58, "Runs the contracts the rest of them settle on.")
coin("sable", "Sable", "SBL", 172.30, 0.070, 0.64, "Fast, cheap, and has fallen over twice.")
coin("lumen", "Lumen", "LMN", 0.84, 0.066, 0.71, "Billions in circulation, cents apiece.")
coin("orrery", "Orrery", "ORY", 44.15, 0.072, 0.67, "Promises to connect every other chain.")
coin("kestrelcoin", "Kestrel", "KSC", 9.60, 0.058, 0.75, "Had a moment in one particular year.")
coin("tallow", "Tallow", "TLW", 0.04, 0.040, 0.92, "A joke that briefly made people rich.")
coin("nimbus", "Nimbus", "NMB", 320.75, 0.077, 0.61, "Storage, allegedly. Mostly speculation.")
coin("vellum", "Vellum", "VLM", 2.45, 0.063, 0.78, "For paying people, which nobody does with it.")
coin("marrow", "Marrow", "MRW", 61.20, 0.055, 0.83, "Anonymous. Popular for reasons it avoids stating.")
coin("pendle", "Pendle", "PDL", 0.19, 0.049, 0.88, "Gaming tokens. Depends on one game.")
coin("stack", "Stack", "STK", 1.00, 0.001, 0.04, "Pegged to a dollar. Usually holds. Usually.")
coin("hollis", "Hollis", "HLS", 780.40, 0.069, 0.69, "Institutional money likes this one, apparently.")
coin("quire", "Quire", "QRE", 0.05, 0.038, 0.95, "Launched last year. Could be anything.")

# ---------------------------------------------------------------------------
# Funds
# ---------------------------------------------------------------------------

fund("broadindex", "Broad Market Index", "BMI", 214.80, 0.058, 0.11, 1.00, 0.016,
     "Owns a slice of everything and charges almost nothing.")
fund("meridianbalanced", "Meridian Balanced", "MBF", 88.40, 0.044, 0.08, 0.68, 0.021,
     "Shares and bonds in one wrapper. Deliberately dull.")
fund("keelworthactive", "Keelworth Active", "KWA", 156.25, 0.049, 0.14, 1.08, 0.012,
     "Somebody picks the holdings and charges you for it.")
fund("ashcroftincome", "Ashcroft Income", "AIF", 62.15, 0.031, 0.09, 0.62, 0.041,
     "Built to pay out rather than to grow.")
fund("bondfund", "Government Bond Fund", "GBF", 104.60, 0.012, 0.05, 0.18, 0.034,
     "Bonds without the date. Sell it whenever you like.")
fund("techsector", "Halcyon Technology Fund", "HTF", 340.90, 0.070, 0.23, 1.34, 0.003,
     "Every technology name at once, for better or worse.", sector="technology")
fund("energysector", "Brackwell Energy Fund", "BEF", 71.30, 0.038, 0.24, 1.11, 0.037,
     "The whole sector, including the parts you dislike.", sector="energy")
fund("smallcap", "Ninth Street Small Cap", "NSC", 45.75, 0.064, 0.19, 1.27, 0.007,
     "Smaller companies. More room up, longer way down.")

# ---------------------------------------------------------------------------
# Government bonds — issuers and terms
# ---------------------------------------------------------------------------

BOND_BLURB = {
    "Caldonian Government": "Home paper, and the safest thing here.",
    "Rhenish Federal": "A large, boring, solvent neighbor.",
    "Vasterby Kingdom": "Small, rich, pays more than it needs to.",
    "Auralia Republic": "Pays well. There's a reason for that.",
    "Sorrento States": "Fine, if you read the politics pages.",
}

BONDS = [
    ("Caldonian Government", "cald", [(3, 0.031), (5, 0.038), (10, 0.046)]),
    ("Rhenish Federal", "rhen", [(3, 0.034), (7, 0.044), (10, 0.051)]),
    ("Vasterby Kingdom", "vast", [(5, 0.049), (8, 0.058)]),
    ("Auralia Republic", "aura", [(3, 0.062), (5, 0.071), (10, 0.084)]),
    ("Sorrento States", "sorr", [(5, 0.055), (8, 0.064)]),
]

for issuer, slug, terms in BONDS:
    for term, coupon in terms:
        bond(issuer, f"{slug}{term}", term, coupon, BOND_BLURB[issuer])


# ---------------------------------------------------------------------------
# Self-check — triple enforcement, same as every other catalog in this build
# ---------------------------------------------------------------------------


def check() -> None:
    problems: list[str] = []

    ids = [e["id"] for e in ENTRIES]
    if len(ids) != len(set(ids)):
        dupes = {i for i in ids if ids.count(i) > 1}
        problems.append(f"duplicate ids: {sorted(dupes)}")

    tickers = [e["ticker"] for e in ENTRIES]
    if len(tickers) != len(set(tickers)):
        dupes = {t for t in tickers if tickers.count(t) > 1}
        problems.append(f"duplicate tickers: {sorted(dupes)}")

    for e in ENTRIES:
        where = e["id"]
        if len(e["blurb"]) > 64:
            problems.append(f"{where}: blurb is {len(e['blurb'])} chars, max 64")
        if e["priceCents"] < 1:
            # Money in this build is integer cents, so a sub-cent price rounds
            # to nothing and a unit becomes free. Real coins do trade below a
            # cent; representing that would mean a finer money unit everywhere,
            # which is not worth it for two rows of catalog.
            problems.append(f"{where}: price rounds to zero cents")
        if not 1 <= len(e["ticker"]) <= 6:
            problems.append(f"{where}: ticker {e['ticker']!r} must be 1-6 characters")
        if e["kind"] == "stock" and e.get("sector") not in SECTORS:
            problems.append(f"{where}: sector {e.get('sector')!r} is not one of {SECTORS}")
        if e["kind"] == "bond" and e["termYears"] <= 0:
            problems.append(f"{where}: a bond needs a term")
        if e["kind"] != "bond" and e["termYears"] != 0:
            problems.append(f"{where}: only bonds carry a term")
        if e["spread"] <= 0 or e["spread"] > 1:
            problems.append(f"{where}: spread {e['spread']} is out of range")

    # Every sector needs enough names that holding "the sector" is a real choice
    # rather than a euphemism for holding one company.
    for sector in SECTORS:
        n = len([e for e in ENTRIES if e.get("sector") == sector and e["kind"] == "stock"])
        if n < 5:
            problems.append(f"sector {sector} has only {n} stocks; needs at least 5")

    # And every tier has to be worth opening.
    for kind, least in [("stock", 30), ("penny", 10), ("crypto", 10), ("fund", 6), ("bond", 10)]:
        n = len([e for e in ENTRIES if e["kind"] == kind])
        if n < least:
            problems.append(f"only {n} {kind} entries; needs at least {least}")

    # A price ladder the whole population can reach. 0308 measured cash at
    # $13,180 median at twenty — if the cheapest unit costs more than that, the
    # catalog opens above the ground (CORE_RULES 13.16, yet again).
    cheapest = min(e["priceCents"] for e in ENTRIES)
    if cheapest > 5_000:
        problems.append(f"cheapest unit is ${cheapest / 100:,.2f}; nothing a young character can buy")

    if problems:
        print(f"{len(problems)} problem(s) in the instrument catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def main() -> None:
    # Check, WRITE, then report — piping through `head` must not be able to kill
    # the process before the file lands.
    check()
    payload = {"version": CATALOG_VERSION, "entries": ENTRIES}
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"{len(ENTRIES)} instruments")
    for kind in ["stock", "penny", "crypto", "fund", "bond"]:
        rows = [e for e in ENTRIES if e["kind"] == kind]
        lo = min(e["priceCents"] for e in rows) / 100
        hi = max(e["priceCents"] for e in rows) / 100
        print(f"  {kind:>7}: {len(rows):>3}   ${lo:,.2f} – ${hi:,.2f}")
    print("  sectors:")
    for sector in SECTORS:
        n = len([e for e in ENTRIES if e.get("sector") == sector])
        print(f"    {sector:<15} {n}")


if __name__ == "__main__":
    main()
