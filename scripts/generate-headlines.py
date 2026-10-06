#!/usr/bin/env python3
"""
Ticket 0308d — the financial pages.

WHY THIS EXISTS. The reference app has a Headlines popup: a folded newspaper
with three stories on it, under a masthead naming the character's city. It is
the best thing on its investment screen, and it is the one piece of that screen
this build had no answer to.

WHAT IT GETS RIGHT is the shape. A market is a thing that HAPPENS TO YOU, and a
column of prices does not say that; a front page does. It is also the only place
in a life-sim where the world gets to have an opinion about the thing you just
did with your money.

WHAT IT APPEARS TO GET WRONG, and the reason this is a generator rather than a
list of jokes: its headlines do not seem to be ABOUT anything. "Bonds To Remain
A Safe Haven For Investors" is a sentence that is true in every possible year,
which makes reading it a habit rather than information — and a player who
notices that stops opening the popup. Compare the third line on the same page,
"Financial Rebound Not In The Cards For BALZ": that one names something and says
what happened to it, and it is the only line on the page worth the tap.

SO EVERY HEADLINE HERE IS KEYED TO A CONDITION and the screen only prints the
ones whose condition held this year. There is no evergreen slot. If nothing
interesting happened, the page says a quiet year happened, which is also
information.

Four slots, because four is what a year actually produces:

    LEAD    the broad market, keyed to the market state
    SECTOR  the sector that moved most, up or down, with {sector} bound
    MOVER   the single biggest name of the year, with {firm} and {pct} bound
    TIER    one tier's year — crypto, bonds, penny stocks and the rest

Spec 706-724 forbids an economy dashboard and asks for market conditions to be
surfaced where they land. A newspaper on the investments screen is exactly that
reading: no numbers a player did not ask for, no second screen of charts, and
the state of the world in the register a person actually meets it in.

CORE_RULES 13.17 — repeatable copy needs more lines than repeats, and a stable
index. A sixty-year life opens this page sixty times, so every condition carries
enough lines that the same one does not come back inside a decade, and the
screen picks by YEAR rather than by roll so the page holds still while it is
open.

Run: python3 scripts/generate-headlines.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "packages/content/data/headlines.json"

CATALOG_VERSION = 1

# A headline has to fit two lines on a phone at heading size. Measured against
# the reference app's longest ("Industrials Sector Sees Uptick In Value As
# Market Pivots", 56) and rounded down, because ours carry bound names that are
# longer than the placeholder.
MAX_HEADLINE = 62

ENTRIES: list[dict] = []


def head(slot: str, when: str, tone: str, *lines: str) -> None:
    for index, text in enumerate(lines):
        ENTRIES.append(
            {
                "id": f"hl.{slot}.{when}.{index + 1}",
                "slot": slot,
                "when": when,
                "tone": tone,
                "text": text,
            }
        )


# ---------------------------------------------------------------------------
# LEAD — the broad market. One condition per market state.
# ---------------------------------------------------------------------------

head(
    "lead",
    "severeRecession",
    "bad",
    "Deep Recession Puts Pressure On Shares And Funds",
    "Shares Face A Deep Recession; Check Your Holdings",
    "Deep Recession Raises The Stakes For Stockholders",
    "Stock And Fund Holders Face A Severe Downturn",
    "A Severe Downturn Tests Share And Fund Holdings",
    "Deep Recession: Compare Your Investments With Cash",
    "A Deep Slump Makes Stock And Fund Risk Matter More",
    "Severe Recession: Review What Your Funds Hold",
)

head(
    "lead",
    "recession",
    "bad",
    "Recession Puts Pressure On Shares And Funds",
    "Shares Face A Downturn; Check Your Own Results",
    "Recession Tests Stock And Fund Holdings",
    "A Downturn Makes Investment Risk Worth A Look",
    "Stockholders Face A Recession; Review Your Holdings",
    "Recession: Compare Your Funds With Your Cash",
    "An Economic Slump Weighs On Shares And Funds",
    "Recession Sets A Tough Backdrop For Stock Prices",
)

head(
    "lead",
    "slowdown",
    "bad",
    "Slower Growth Weighs On Share And Fund Prices",
    "Economic Growth Cools; Check Your Shares And Funds",
    "Stockholders Face A Slower Economy",
    "A Slowdown Tests Stock And Fund Returns",
    "Slower Growth: Compare Your Investment Results",
    "Shares And Funds Face A Cooling Economy",
    "A Cooler Economy Leaves Less Support For Shares",
    "Growth Slows; Your Holdings Still Have Their Own Year",
)

head(
    "lead",
    "normal",
    "flat",
    "A Normal Economy; Check How Your Holdings Did",
    "Shares And Funds Face An Ordinary Economic Year",
    "No Boom Or Slump; Compare Your Investment Results",
    "A Normal Year Still Leaves Stockholders With Risk",
    "An Ordinary Economy; Your Funds Have Their Own Results",
    "Steady Conditions; Check Your Shares Against Your Funds",
    "Normal Growth Sets The Backdrop For Your Investments",
    "No Economic Shock; Individual Holdings Can Still Swing",
)

head(
    "lead",
    "growth",
    "good",
    "Growing Economy Supports Share And Fund Prices",
    "Economic Growth Helps Shares; Check Your Own Returns",
    "Shares And Funds Get Support From Economic Growth",
    "Growth Improves The Backdrop For Stockholders",
    "A Growing Economy Helps Shares, Without A Guarantee",
    "Growth Supports Funds; Their Holdings Still Matter",
    "A Stronger Economy Gives Shares More Support",
    "Growth: Compare Your Shares And Funds With Cash",
)

head(
    "lead",
    "strongExpansion",
    "good",
    "A Booming Economy Supports Shares And Funds",
    "Strong Growth Helps Shares; Check Your Own Results",
    "Shares And Funds Get A Strong Economic Tailwind",
    "A Boom Helps Stockholders, But Risk Remains",
    "Strong Expansion: Review Your Share And Fund Holdings",
    "Boom Helps Share Prices; Gains Aren't Guaranteed",
    "An Economic Boom Helps Shares; Each Holding Can Differ",
    "Strong Growth: Compare Your Investments With Cash",
)

# ---------------------------------------------------------------------------
# SECTOR — {sector} is bound to the sector that moved most.
# ---------------------------------------------------------------------------

head(
    "sector",
    "up",
    "good",
    "{sector} Holdings Rise On Average; Check Yours",
    "Average {sector} Prices Rise; Individual Results Vary",
    "{sector} Investments Gain On Average This Year",
    "{sector} Holdings Gain On Average; Review Your Mix",
    "Average Prices In {sector} Climb This Year",
    "{sector} Prices Rise On Average; Check What You Own",
    "Holdings In {sector} Gain On Average",
    "{sector} Gains On Average; Look At Individual Prices",
    "Average {sector} Prices Climb; Your Holdings May Differ",
    "{sector} Rises On Average; Compare Your Own Returns",
)

head(
    "sector",
    "down",
    "bad",
    "{sector} Holdings Fall On Average; Check Yours",
    "Average {sector} Prices Fall; Individual Results Vary",
    "{sector} Investments Lose Value On Average This Year",
    "{sector} Falls On Average; Review Your Investment Mix",
    "Average Prices In {sector} Drop This Year",
    "{sector} Prices Fall On Average; Check What You Own",
    "Holdings In {sector} Lose Value On Average",
    "{sector} Falls On Average; Look At Individual Prices",
    "Average {sector} Prices Drop; Your Holdings May Differ",
    "{sector} Drops On Average; Compare Your Own Returns",
)

# ---------------------------------------------------------------------------
# MOVER — {firm} is a real name from the catalog, {pct} its year.
# ---------------------------------------------------------------------------

head(
    "mover",
    "up",
    "good",
    "{firm} Rises {pct}; Check Your Holding",
    "{firm} Gains {pct} In The Year Just Finished",
    "{firm} Ends The Year Up {pct}",
    "{firm} Gains {pct}; Review Its Price History",
    "{firm} Rises {pct}; Past Gains Aren't A Forecast",
    "{firm} Adds {pct}; Check How Much You Hold",
    "{firm} Up {pct}; Compare It With Your Other Holdings",
    "{firm} Gains {pct}; New Buyers Pay The New Price",
    "{firm} Climbs {pct}; Its Own Price Moved",
    "{firm} Up {pct}; Check Your Own Return",
)

head(
    "mover",
    "down",
    "bad",
    "{firm} Falls {pct}; Check Your Holding",
    "{firm} Loses {pct} In The Year Just Finished",
    "{firm} Ends The Year Down {pct}",
    "{firm} Drops {pct}; Review Its Price History",
    "{firm} Falls {pct}; A Rebound Isn't Guaranteed",
    "{firm} Loses {pct}; Check How Much You Hold",
    "{firm} Down {pct}; Compare It With Your Other Holdings",
    "{firm} Drops {pct}; A Lower Price Still Carries Risk",
    "{firm} Falls {pct}; Its Own Price Moved",
    "{firm} Down {pct}; Check Your Own Return",
)

# ---------------------------------------------------------------------------
# TIER — one tier's year. Four lines each, two directions, five tiers.
# ---------------------------------------------------------------------------

head(
    "tier",
    "crypto.up",
    "good",
    "Crypto Prices Rise On Average; Check Your Holdings",
    "Crypto Holdings Gain On Average This Year",
    "Average Crypto Prices Climb; Individual Returns Vary",
    "Crypto Prices Up On Average; Compare What You Own",
)
head(
    "tier",
    "crypto.down",
    "bad",
    "Crypto Prices Fall On Average; Check Your Holdings",
    "Crypto Holdings Lose Value On Average This Year",
    "Average Crypto Prices Drop; Individual Returns Vary",
    "Crypto Prices Down On Average; Compare What You Own",
)
head(
    "tier",
    "penny.up",
    "good",
    "Penny Stock Prices Rise On Average; Check Your Holdings",
    "Penny Stock Holdings Gain On Average This Year",
    "Average Penny Stock Prices Climb; Individual Returns Vary",
    "Penny Stock Prices Up On Average; Compare What You Own",
)
head(
    "tier",
    "penny.down",
    "bad",
    "Penny Stock Prices Fall On Average; Check Your Holdings",
    "Penny Stock Holdings Lose Value On Average This Year",
    "Average Penny Stock Prices Drop; Individual Returns Vary",
    "Penny Stock Prices Down On Average; Compare What You Own",
)
head(
    "tier",
    "bond.up",
    "good",
    "Bond Prices Rise On Average; Check Your Holdings",
    "Bond Holdings Gain On Average This Year",
    "Average Bond Prices Climb; Individual Returns Vary",
    "Bond Prices Up On Average; Compare What You Own",
)
head(
    "tier",
    "bond.down",
    "bad",
    "Bond Prices Fall On Average; Check Your Holdings",
    "Bond Holdings Lose Value On Average This Year",
    "Average Bond Prices Drop; Individual Returns Vary",
    "Bond Prices Down On Average; Compare What You Own",
)
head(
    "tier",
    "fund.up",
    "good",
    "Fund Prices Rise On Average; Check Your Holdings",
    "Fund Holdings Gain On Average This Year",
    "Average Fund Prices Climb; Individual Returns Vary",
    "Fund Prices Up On Average; Compare What You Own",
)
head(
    "tier",
    "fund.down",
    "bad",
    "Fund Prices Fall On Average; Check Your Holdings",
    "Fund Holdings Lose Value On Average This Year",
    "Average Fund Prices Drop; Individual Returns Vary",
    "Fund Prices Down On Average; Compare What You Own",
)
head(
    "tier",
    "stock.up",
    "good",
    "Stock Prices Rise On Average; Check Your Holdings",
    "Stock Holdings Gain On Average This Year",
    "Average Stock Prices Climb; Individual Returns Vary",
    "Stock Prices Up On Average; Compare What You Own",
)
head(
    "tier",
    "stock.down",
    "bad",
    "Stock Prices Fall On Average; Check Your Holdings",
    "Stock Holdings Lose Value On Average This Year",
    "Average Stock Prices Drop; Individual Returns Vary",
    "Stock Prices Down On Average; Compare What You Own",
)

# ---------------------------------------------------------------------------
# MASTHEADS — the paper's name, picked by the character's city.
# ---------------------------------------------------------------------------

MASTHEADS = [
    "The {city} Journal",
    "The {city} Ledger",
    "The {city} Chronicle",
    "The {city} Herald",
    "The {city} Observer",
    "The {city} Gazette",
    "The {city} Tribune",
    "The {city} Record",
    "The {city} Post",
    "The {city} Sentinel",
]


def check() -> None:
    problems: list[str] = []

    ids = [e["id"] for e in ENTRIES]
    if len(ids) != len(set(ids)):
        problems.append("duplicate headline ids")

    texts = [e["text"] for e in ENTRIES]
    if len(texts) != len(set(texts)):
        duplicated = sorted({t for t in texts if texts.count(t) > 1})
        problems.append(f"duplicate headline text: {duplicated}")

    for entry in ENTRIES:
        if len(entry["text"]) > MAX_HEADLINE:
            problems.append(f"{entry['id']} is {len(entry['text'])} chars (max {MAX_HEADLINE})")
        # A headline that ends in a period is a sentence pretending to be a
        # headline. Newspapers do not do it and neither does the reference app.
        if entry["text"].endswith("."):
            problems.append(f"{entry['id']} ends in a period")

    # CORE_RULES 13.17. Sixty years of opening this page, four slots a year: any
    # condition with fewer than four lines will repeat inside one decade.
    from collections import Counter

    per_condition = Counter((e["slot"], e["when"]) for e in ENTRIES)
    for (slot, when), count in per_condition.items():
        if count < 4:
            problems.append(f"{slot}/{when} has only {count} lines; needs at least 4")

    # Every market state needs a lead, or a year exists with no front page.
    for state in ["severeRecession", "recession", "slowdown", "normal", "growth", "strongExpansion"]:
        if per_condition[("lead", state)] < 6:
            problems.append(f"lead/{state} has {per_condition[('lead', state)]} lines; needs 6")

    # Tokens have to be ones the renderer binds, or a player reads a brace.
    allowed = {"{sector}", "{firm}", "{pct}"}
    import re

    for entry in ENTRIES:
        for token in re.findall(r"\{[a-zA-Z]+\}", entry["text"]):
            if token not in allowed:
                problems.append(f"{entry['id']} uses unknown token {token}")

    # And each slot binds only the tokens it HAS. A lead has no firm.
    for entry in ENTRIES:
        used = set(re.findall(r"\{[a-zA-Z]+\}", entry["text"]))
        if entry["slot"] in {"lead", "tier"} and used:
            problems.append(f"{entry['id']} is a {entry['slot']} line and cannot bind {used}")
        if entry["slot"] == "sector" and used != {"{sector}"}:
            problems.append(f"{entry['id']} must bind exactly {{sector}}, binds {used}")
        if entry["slot"] == "mover" and not used <= {"{firm}", "{pct}"}:
            problems.append(f"{entry['id']} binds {used}")
        if entry["slot"] == "mover" and "{firm}" not in used:
            problems.append(f"{entry['id']} is a mover line that never names the mover")

    for masthead in MASTHEADS:
        if "{city}" not in masthead:
            problems.append(f"masthead {masthead!r} has no city in it")

    if problems:
        print(f"{len(problems)} problem(s) in the headline catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def main() -> None:
    # Check, WRITE, then report — piping through `head` must not be able to kill
    # the process before the file lands.
    check()
    payload = {"version": CATALOG_VERSION, "entries": ENTRIES, "mastheads": MASTHEADS}
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"{len(ENTRIES)} headlines, {len(MASTHEADS)} mastheads")
    from collections import Counter

    for slot, count in Counter(e["slot"] for e in ENTRIES).most_common():
        print(f"  {slot:<8} {count}")


if __name__ == "__main__":
    main()
