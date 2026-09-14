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
    "Markets Post Worst Year In Living Memory",
    "Panic Selling Wipes Out A Decade Of Gains",
    "The Crash Nobody Wanted To Name Has A Name Now",
    "Savers Wake Up To Half The Money They Went To Bed With",
    "Trading Floors Empty As The Bottom Keeps Moving",
    "A Generation Learns What A Real Crash Looks Like",
    "Every Sector Red, And No Floor In Sight",
    "The Year The Market Stopped Pretending",
)

head(
    "lead",
    "recession",
    "bad",
    "Markets Slide As The Downturn Takes Hold",
    "Investors Head For The Exits",
    "A Bruising Year Ends With Little Cheer",
    "Recession Bites, And Portfolios Feel It",
    "Losses Mount As Buyers Stay Home",
    "The Market Gives Back What It Spent Two Years Earning",
    "Bad News Keeps Arriving On Schedule",
    "Nobody Is Calling The Bottom Yet",
)

head(
    "lead",
    "slowdown",
    "bad",
    "Growth Cools And Markets Drift Lower",
    "A Flat Year With A Downward Lean",
    "Momentum Stalls Across The Board",
    "Traders Call It A Pause. Others Call It Worse",
    "The Rally Runs Out Of Road",
    "Slower Everywhere, Broken Nowhere",
    "A Year Of Small Disappointments",
    "Confidence Thins Without Quite Breaking",
)

head(
    "lead",
    "normal",
    "flat",
    "An Ordinary Year, And Nobody Complains",
    "Markets Grind Higher Without Much Drama",
    "A Quiet Year On The Exchange",
    "No Crisis, No Boom, No Headlines",
    "Steady As She Goes, Say The Optimists",
    "The Market Ends Roughly Where It Started",
    "A Year That Won't Make The History Books",
    "Dull Isn't The Same As Bad",
)

head(
    "lead",
    "growth",
    "good",
    "Markets Climb Through A Confident Year",
    "Gains Broaden Out Across The Exchange",
    "A Good Year, And Most Of It Earned",
    "Buyers Return And Prices Follow",
    "Optimism Is Back, And So Are The Numbers",
    "A Solid Year Nobody Wants To Jinx",
    "Growth Shows Up In The Places It Should",
    "Portfolios End The Year Fatter",
)

head(
    "lead",
    "strongExpansion",
    "good",
    "Markets Roar Through A Record Year",
    "The Boom Arrives, And Everyone Is Early",
    "Record Highs, And The Champagne To Match",
    "A Year Of Fortunes Made In Twelve Months",
    "Everything Is Up, Which Worries The Careful",
    "The Best Year On The Exchange In Decades",
    "Money Pours In And Prices Cannot Keep Up",
    "Nobody Wants To Be The One Who Sold",
)

# ---------------------------------------------------------------------------
# SECTOR — {sector} is bound to the sector that moved most.
# ---------------------------------------------------------------------------

head(
    "sector",
    "up",
    "good",
    "{sector} Leads The Market Higher",
    "Money Floods Into {sector}",
    "A Banner Year For {sector}",
    "{sector} Outruns Everything Else On The Board",
    "Analysts Fall In Love With {sector} All Over Again",
    "{sector} Posts The Year's Biggest Gains",
    "Everyone Suddenly Owns {sector}",
    "{sector} Rewards The Patient",
    "The {sector} Trade Works, For Once",
    "{sector} Ends The Year On Top",
)

head(
    "sector",
    "down",
    "bad",
    "{sector} Takes The Year's Heaviest Losses",
    "The Bottom Falls Out Of {sector}",
    "{sector} Investors Count The Damage",
    "Nobody Wants {sector} At Any Price",
    "{sector} Drags The Whole Market Down With It",
    "A Miserable Year For Anyone Holding {sector}",
    "{sector} Gives Back Everything And More",
    "The {sector} Story Falls Apart",
    "{sector} Ends The Year At The Bottom Of The Table",
    "Hard Lessons For The {sector} Faithful",
)

# ---------------------------------------------------------------------------
# MOVER — {firm} is a real name from the catalog, {pct} its year.
# ---------------------------------------------------------------------------

head(
    "mover",
    "up",
    "good",
    "{firm} Climbs {pct} And Nobody Saw It Coming",
    "{firm} Is The Year's Biggest Winner, Up {pct}",
    "A {pct} Year For {firm}",
    "{firm} Shareholders Have A Very Good Year",
    "{firm} Up {pct}, And The Analysts Are Scrambling",
    "The {firm} Story Everyone Wants A Piece Of",
    "{firm} Rewrites Its Own Ceiling, Up {pct}",
    "Late To {firm}? So Was Almost Everyone",
    "{firm} Adds {pct} And Keeps Going",
    "Quiet Until Now: {firm} Gains {pct}",
)

head(
    "mover",
    "down",
    "bad",
    "{firm} Falls {pct} In A Brutal Twelve Months",
    "The Wheels Come Off At {firm}",
    "{firm} Down {pct}, And The Questions Start",
    "A {pct} Fall Leaves {firm} Fighting",
    "{firm} Is The Year's Biggest Loser",
    "Financial Rebound Not In The Cards For {firm}",
    "{firm} Sheds {pct} And Its Chief Executive",
    "What Went Wrong At {firm}",
    "{firm} Holders Learn A Hard Lesson, Down {pct}",
    "Nobody Is Buying The {firm} Turnaround",
)

# ---------------------------------------------------------------------------
# TIER — one tier's year. Four lines each, two directions, five tiers.
# ---------------------------------------------------------------------------

head(
    "tier",
    "crypto.up",
    "good",
    "Coins Go Vertical, And So Do The Arguments",
    "Crypto Has Another One Of Those Years",
    "The Coin Crowd Is Insufferable Again",
    "Digital Money Doubles, Skeptics Regroup",
)
head(
    "tier",
    "crypto.down",
    "bad",
    "The Coin Market Folds In On Itself",
    "Crypto Gives It All Back, Again",
    "A Long Quiet Winter For Digital Money",
    "The Coins Nobody Mentions At Dinner Anymore",
)
head(
    "tier",
    "penny.up",
    "good",
    "Small Companies Have Their Moment",
    "The Cheap End Of The Market Catches Fire",
    "Penny Stocks Pay Off For The Reckless",
    "Small Names, Big Numbers, For Now",
)
head(
    "tier",
    "penny.down",
    "bad",
    "Another Year Of Failures At The Cheap End",
    "Small Companies Fold In Numbers",
    "Penny Stocks Do What Penny Stocks Do",
    "The Small End Of The Market Thins Out",
)
head(
    "tier",
    "bond.up",
    "good",
    "Bondholders Collect And Sleep Soundly",
    "Government Debt Has A Comfortable Year",
    "Boring Money Beats Clever Money",
    "The Safe End Of The Market Earns Its Keep",
)
head(
    "tier",
    "bond.down",
    "bad",
    "Even The Bond Market Has A Bad Year",
    "Rates Move And Bondholders Pay For It",
    "The Safe End Of The Market Isn't Safe This Year",
    "Government Debt Loses Its Shine",
)
head(
    "tier",
    "fund.up",
    "good",
    "Funds Post Their Best Year In A Decade",
    "Owning A Bit Of Everything Works Out",
    "The Patient Money Comes Out Ahead",
    "A Good Year To Have Owned The Whole Market",
)
head(
    "tier",
    "fund.down",
    "bad",
    "Funds Cannot Hide From A Year Like This",
    "Spreading The Money Only Helped So Much",
    "Even The Broad Funds End The Year Down",
    "A Year Where Diversifying Softened The Blow",
)
head(
    "tier",
    "stock.up",
    "good",
    "Shares Are Where The Money Was This Year",
    "A Strong Year For Anyone Who Owned Companies",
    "The Exchange Has A Year Worth Framing",
    "Company Shares Outrun Everything Safer",
)
head(
    "tier",
    "stock.down",
    "bad",
    "A Hard Year To Have Owned Shares",
    "Companies Struggle And Shareholders Pay",
    "The Exchange Would Rather Forget This One",
    "Shares Lose Ground Almost Everywhere",
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
