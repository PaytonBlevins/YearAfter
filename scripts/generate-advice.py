#!/usr/bin/env python3
"""
Ticket 0309 — what an advisor says, and why.

WHY THIS IS A CATALOG. A player with an advisor reads these lines every year for
fifty years. That is CORE_RULES 13.17 territory — repeatable copy needs more
lines than repeats — and the build has been caught by it twice, once in 0206's
friendship copy and again in 0207's romance replies. Four sentences and a
rotation is a system that reads as broken by thirty.

WHY EVERY LINE NAMES ITS REASON. Spec 1383: advisors "improve quality but never
guarantee prediction". An advisor who says "Buy Halcyon Systems" and is right
two thirds of the time is a slot machine with a suit on. An advisor who says
"Halcyon is trading a third below where its own history says it should be" has
told the player something they can check, disagree with, and learn from — and
when it goes wrong, they can see WHICH part of the reasoning failed.

So a recommendation is never a bare verb. It carries the reason it exists, and
the reasons are the taxonomy below.

THE REASONS, AND WHICH ONES ARE PREDICTIONS.

Only two of these seven are forecasts. The rest are statements about what the
player is already holding, and they are true whether or not the advisor is any
good — which is the whole reason a cheap advisor can be worth paying.

    belowTrend    PREDICTION. Priced under its own history.
    strongEarner  PREDICTION. Earns more than most, which is a weak signal.
    aboveTrend    PREDICTION. Run ahead of itself.
    concentrated  FACT. Too much of one sector.
    noFloor       FACT. Too much in things that can go to nothing.
    idleCash      FACT. Money doing nothing.
    steady        FACT. Nothing worth doing, said out loud.

Run: python3 scripts/generate-advice.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "packages/content/data/advice.json"

CATALOG_VERSION = 1

# An advice line sits in a row that also carries a verb chip and an amount. The
# 0304-0308 rows kept clipping at 48; this one wraps, so it gets more room — but
# not unlimited, because two lines is a row and four is a paragraph.
MAX_LINE = 108

ENTRIES: list[dict] = []


def line(reason: str, verb: str, *texts: str) -> None:
    for index, text in enumerate(texts):
        ENTRIES.append(
            {
                "id": f"ad.{reason}.{index + 1}",
                "reason": reason,
                "verb": verb,
                "text": text,
            }
        )


# ---------------------------------------------------------------------------
# PREDICTIONS — the two thirds-right ones. Hedged in the language on purpose.
# ---------------------------------------------------------------------------

line(
    "belowTrend",
    "buy",
    "{firm} is trading about {gap} under where its own history says it should sit. I'd buy some.",
    "The market has marked {firm} down {gap} below its trend. Nothing I can see explains it.",
    "{firm} looks cheap to me — roughly {gap} below where it has spent the last decade.",
    "I like {firm} at this price. It's {gap} off its own trend and the business hasn't changed.",
    "If you're adding anything this year, I'd make it {firm}. It's {gap} below trend.",
    "{firm} has been beaten up — {gap} under trend. That usually mends. It doesn't always.",
    "Worth a look at {firm}. About {gap} cheaper than its history would suggest.",
    "{firm} is the one I'd put new money into. It's {gap} below where it ought to be.",
)

line(
    "strongEarner",
    "buy",
    "{firm} earns more than most of what's on the board. That's worth owning through a dull patch.",
    "I keep coming back to {firm}. The business throws off more than its neighbors do.",
    "If you want something to hold and forget, {firm} earns its keep better than most.",
    "{firm} isn't exciting, but it compounds faster than the rest of its sector.",
    "For a long hold I'd take {firm}. Better earnings than almost anything near its price.",
    "{firm} is the quality name in that sector. You pay for it, and usually it's worth it.",
)

line(
    "aboveTrend",
    "reduce",
    "{firm} has run {gap} ahead of its own trend. I'd take some off the table.",
    "You're up a long way on {firm} — {gap} above where its history sits. Trim it.",
    "{firm} is {gap} over trend. I'm not calling a top, but I'd bank part of that.",
    "Nothing wrong with {firm}, it's just {gap} expensive against its own record. Take some out.",
    "I'd sell down {firm}. It's {gap} above trend and that gap tends to close.",
    "{firm} has had its run — {gap} over trend. Leaving it all in is a bet, not a hold.",
)

# ---------------------------------------------------------------------------
# FACTS — true whether or not the advisor is any good.
# ---------------------------------------------------------------------------

line(
    "concentrated",
    "rebalance",
    "{share} of your money is in {sector}. One bad year there takes most of it.",
    "You're {share} {sector}. That's not a portfolio, it's one bet in six pieces.",
    "Everything you own moves together — {share} of it is {sector}. Spread it out.",
    "If {sector} has a bad year you lose {share} of everything. I'd fix that before anything else.",
    "{share} in a single sector. Names in the same sector fall together, and they will.",
    "Your {sector} position is {share} of the lot. Good year so far. Bad way to hold it.",
    "I'd move some of that {sector} money elsewhere. {share} in one sector is too much.",
)

line(
    "noFloor",
    "reduce",
    "{share} of your money is in things with no floor under them. They can go to nothing.",
    "You're {share} in coins and penny stocks. Those don't come back the way shares do.",
    "I'd trim the speculative end. {share} of everything you own can genuinely reach zero.",
    "Keep the coins if you like them, but {share} is more than I'd have anybody carry.",
    "{share} in names with no earnings behind them. That's a lot to leave to chance.",
    "The risky end is {share} of your money. Halve it and you'd sleep better.",
)

line(
    "idleCash",
    "buy",
    "You've got {amount} sitting in the bank doing nothing. Put some of it to work.",
    "{amount} in cash. It's safe and it's going backwards. Some of that should be invested.",
    "There's {amount} idle. I'm not saying spend it all — I am saying don't leave it there.",
    "{amount} in the account. At your age that's money not working.",
    "You're carrying {amount} in cash. A buffer is sensible; that's past a buffer.",
    "Cash is {amount}. Keep what you need for a bad year and invest the rest.",
)

line(
    "steady",
    "hold",
    "Nothing worth doing this year. Leave it alone.",
    "I'd sit on your hands. The portfolio is fine and there's nothing cheap enough to chase.",
    "No changes from me. Not every year has a trade in it.",
    "You're well placed. Doing nothing is a position, and this year it's the right one.",
    "Nothing to fix and nothing obvious to buy. That's a good year, not a boring one.",
    "Hold. If I made something up to justify the fee you'd be worse off for it.",
)

# ---------------------------------------------------------------------------
# ADVISORS — three, and they differ in WHAT THEY CAN SEE, not how loud they are.
#
# Measured before this list existed: tiering an advisor on how accurately they
# read a hidden fundamental does not work. Across skill 0 to perfect the mean
# year moved 6.3% to 7.4% and the odds of a single call going up stayed pinned
# at 61%. Drift spans 0.02-0.082 and volatility spans 0.12-0.95, so on a
# one-year view the fundamental is a rounding error and the tier would have been
# a label on nothing.
#
# So the ladder is CATEGORICAL. The cheap one only tells you things that are
# already true about what you hold — no forecasting at all, which is why it can
# be cheap and still worth having. The expensive ones add calls.
# ---------------------------------------------------------------------------

# THE LADDER, AND WHY IT CLIMBS THE WAY IT DOES.
#
# Measured before this list existed, and it came out against the obvious design
# twice.
#
# TIERING ON A HIDDEN FUNDAMENTAL DOES NOT WORK. The first plan was that a
# better advisor reads `drift` more accurately. Swept from no skill to perfect,
# the mean year moved 6.3% to 7.4% and the odds of a single call going up stayed
# pinned at 61% throughout. Drift spans 0.02-0.082 and volatility spans
# 0.12-0.95, so across one year the fundamental is a rounding error.
#
# AND THERE IS ONLY ONE REAL EDGE IN THIS MARKET. Of every signal tested, one
# beats random: a name trading below its own trend, restricted to the tiers that
# actually mean-revert. So the ladder cannot be "more edges" — it has to be
# ACCESS TO THE ONE EDGE. `sharpness` is the gap an advisor needs before they
# will call it, so a dearer advisor sees an opportunity the cheaper one is still
# waiting on rather than seeing a different kind of thing.
#
# FEES ARE SET AGAINST WHAT THE PICKS ARE WORTH, not by what sounds plausible.
# Forty years of following the independent at 50 basis points returned 0.90x a
# plain-fund benchmark and the wealth manager at 100bp returned 0.75x — and
# (1-0.005)^40 = 0.82 and (1-0.01)^40 = 0.67, so the fee explained ALL of the
# gap and the picks were quietly adding 9-12% back on top. Priced at 20 and 40
# basis points the advice is worth roughly what it costs, which is the only
# honest place to put it: hiring one is a judgement call rather than an obvious
# yes or an obvious no.
ADVISORS = [
    {
        "id": "adv.branch",
        "name": "A planner at your bank",
        "blurb": "Free with the account. Will tell you what you're holding wrong, and nothing else.",
        "feeBasis": 0,
        "flatFee": 0,
        "minimumPortfolio": 0,
        "reasons": ["concentrated", "noFloor", "idleCash", "steady"],
        "picks": 2,
        "sharpness": 0,
        # The bars a portfolio has to cross before they say anything.
        "concentratedAt": 0.45,
        "speculativeAt": 0.30,
    },
    {
        "id": "adv.independent",
        "name": "An independent advisor",
        "blurb": "A fifth of a percent a year. Actual opinions about actual companies.",
        "feeBasis": 20,
        "flatFee": 0,
        "minimumPortfolio": 10_000,
        # `strongEarner` is the LONG-HOLD pick, and it is last on purpose.
        # Measured on a one-year view, drift is a rounding error against
        # volatility — no advisor should sell it as this year's idea. Measured
        # over thirty (0308d), the six highest-drift names returned 6.00x
        # against 3.80x for the six lowest. So it is real, on a horizon no
        # single year can show, and it only appears in a year with nothing
        # nearer to hand.
        "reasons": [
            "concentrated",
            "noFloor",
            "idleCash",
            "belowTrend",
            "aboveTrend",
            "strongEarner",
            "steady",
        ],
        "picks": 3,
        # Only calls it when it is glaring.
        "sharpness": 0.22,
        "concentratedAt": 0.38,
        "speculativeAt": 0.22,
    },
]

# THE PRIVATE WEALTH MANAGER IS NOT HERE, AND THAT IS A MEASUREMENT, NOT AN
# OVERSIGHT.
#
# It was built, priced at 40 basis points, and cut. Across 500 forty-year lives
# it returned 1.23x a stock-picking player against 1.31x for the FREE planner —
# strictly worse, at a fee. Every attempt to give it a mechanism failed against
# the market this build actually has:
#
#   Spotting an opportunity sooner did nothing. Moving its threshold from 0.18
#   to 0.38 changed the forty-year outcome by zero, because the best
#   opportunity in a year is either glaring or absent and no bar in between
#   discriminates.
#
#   Making more calls made it worse, because the extra calls are the weaker
#   ones and each is another single name where a fund would do.
#
#   Holding a tighter leash moved the floor from 1.40x to 1.42x. Real, and not
#   worth double the fee.
#
# The honest reading is that this market contains ONE edge and the free advisor
# already captures it. A third tier whose only genuine difference is a larger
# fee is a worse deal in a nicer suit, and shipping it would be the "system
# nobody should ever use" mirror of CORE_RULES 13.7.
#
# What a wealth manager would actually have to sell is ACCESS — spec 1860's
# "private investment opportunities scale with wealth and may be illiquid or
# fail" — and that arrives with v0.06. It comes back then, with something to
# offer.
NOT_YET_BUILT = [
    {
        "id": "adv.private",
        "label": "A private wealth manager",
        "needs": "private deals worth their fee",
        "arrives": "v0.06",
    },
]

REASONS = ["belowTrend", "strongEarner", "aboveTrend", "concentrated", "noFloor", "idleCash", "steady"]

# Which tokens each reason is allowed to bind. A line that asks for a token its
# reason cannot supply renders a brace on somebody's screen.
TOKENS = {
    "belowTrend": {"{firm}", "{gap}"},
    "strongEarner": {"{firm}"},
    "aboveTrend": {"{firm}", "{gap}"},
    "concentrated": {"{share}", "{sector}"},
    "noFloor": {"{share}"},
    "idleCash": {"{amount}"},
    "steady": set(),
}

VERBS = {"buy", "hold", "reduce", "sell", "rebalance"}


def check() -> None:
    problems: list[str] = []

    ids = [e["id"] for e in ENTRIES]
    if len(ids) != len(set(ids)):
        problems.append("duplicate advice ids")

    texts = [e["text"] for e in ENTRIES]
    if len(texts) != len(set(texts)):
        dupes = sorted({t for t in texts if texts.count(t) > 1})
        problems.append(f"duplicate advice text: {dupes}")

    from collections import Counter

    per_reason = Counter(e["reason"] for e in ENTRIES)

    for reason in REASONS:
        # CORE_RULES 13.17. A player with an advisor reads one of these every
        # year for fifty years; six is the floor at which a line does not come
        # back inside half a decade.
        if per_reason[reason] < 6:
            problems.append(f"{reason} has {per_reason[reason]} lines; needs at least 6")

    for entry in ENTRIES:
        if len(entry["text"]) > MAX_LINE:
            problems.append(f"{entry['id']} is {len(entry['text'])} chars (max {MAX_LINE})")
        if entry["verb"] not in VERBS:
            problems.append(f"{entry['id']} has verb {entry['verb']!r}, which is not one of {VERBS}")
        used = set(re.findall(r"\{[a-zA-Z]+\}", entry["text"]))
        allowed = TOKENS[entry["reason"]]
        if not used <= allowed:
            problems.append(f"{entry['id']} binds {used - allowed}, which {entry['reason']} cannot supply")
        # A line about a specific company that never names it is a line about
        # nothing — the reference app's whole problem, one rung down.
        if "{firm}" in allowed and "{firm}" not in used:
            problems.append(f"{entry['id']} is about a company and never names it")

    # Every reason an advisor claims to handle needs lines to say it with.
    for advisor in ADVISORS:
        for reason in advisor["reasons"]:
            if reason not in REASONS:
                problems.append(f"{advisor['id']} reads unknown reason {reason!r}")
            elif per_reason[reason] == 0:
                problems.append(f"{advisor['id']} reads {reason} and there are no lines for it")
        if advisor["picks"] < 1:
            problems.append(f"{advisor['id']} makes no recommendations at all")

    # The free one must not be able to forecast, or the ladder means nothing.
    free = next(a for a in ADVISORS if a["feeBasis"] == 0 and a["flatFee"] == 0)
    for reason in ["belowTrend", "aboveTrend", "strongEarner"]:
        if reason in free["reasons"]:
            problems.append(f"the free advisor ({free['id']}) makes {reason} calls; it must not")

    # And the ladder has to actually climb.
    fees = [a["feeBasis"] for a in ADVISORS]
    if fees != sorted(fees):
        problems.append("advisors are not ordered cheapest first")
    if len({len(a["reasons"]) for a in ADVISORS}) != len(ADVISORS):
        problems.append("two advisors see exactly the same number of things; the tier is a label")
    if len(ADVISORS) < 2:
        problems.append("a ladder needs at least two rungs")

    # EVERY REASON NEEDS A READER. Cutting the wealth manager orphaned six
    # `strongEarner` lines — content that ships, validates, and can never
    # appear. A catalog nobody reads from is the CORE_RULES 13.7 shape one
    # level down, and the only reason it was caught is that the cut happened
    # in the same sitting.
    read = {r for a in ADVISORS for r in a["reasons"]}
    for reason in REASONS:
        if reason not in read:
            problems.append(f"{reason} has lines and no advisor who can say them")
    # A deferred advisor must not collide with a live one.
    live_ids = {a["id"] for a in ADVISORS}
    for row in NOT_YET_BUILT:
        if row["id"] in live_ids:
            problems.append(f"{row['id']} is both shipped and not built")

    # A DEARER ADVISOR HAS TO HOLD A TIGHTER LEASH, or paying more buys nothing.
    #
    # This check replaced one that asserted a dearer advisor spots an
    # opportunity SOONER. That was the design until it was measured: moving the
    # threshold from 0.18 to 0.38 changed the forty-year outcome by nothing at
    # all, because the best opportunity in a year is either glaring or absent
    # and no bar in between discriminates. What did move the numbers was the
    # risk bars, so that is what the ladder is made of now.
    for field in ["concentratedAt", "speculativeAt"]:
        bars = [a[field] for a in ADVISORS]
        if bars != sorted(bars, reverse=True):
            problems.append(
                f"{field} does not tighten as the fee rises; paying more buys nothing"
            )
        for advisor in ADVISORS:
            if not 0 < advisor[field] < 1:
                problems.append(f"{advisor['id']} has a nonsense {field} of {advisor[field]}")
    for advisor in ADVISORS:
        if advisor["feeBasis"] == 0 and advisor["sharpness"] != 0:
            problems.append(f"{advisor['id']} is free and still claims to forecast")
        if advisor["feeBasis"] > 0 and not 0 < advisor["sharpness"] < 1:
            problems.append(f"{advisor['id']} charges a fee and cannot forecast at all")

    if problems:
        print(f"{len(problems)} problem(s) in the advice catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def main() -> None:
    # Check, WRITE, then report.
    check()
    payload = {
        "version": CATALOG_VERSION,
        "entries": ENTRIES,
        "advisors": ADVISORS,
        "notYetBuilt": NOT_YET_BUILT,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"{len(ENTRIES)} advice lines, {len(ADVISORS)} advisors")
    from collections import Counter

    for reason, count in Counter(e["reason"] for e in ENTRIES).most_common():
        print(f"  {reason:<14} {count}")


if __name__ == "__main__":
    main()
