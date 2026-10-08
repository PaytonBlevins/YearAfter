#!/usr/bin/env python3
"""
Ticket 0206b — odd jobs.

Review: "I also want to be able to perform freelance jobs at appropriate ages."

These are NOT employment. Ticket 0210 builds real jobs with salaries, promotion
paths and a career. These are the things a child can actually do for money —
a lemonade stand at eight, babysitting at twelve, a weekend shift at sixteen —
and the whole point of them is the age gate. A ten-year-old cannot get a job;
a ten-year-old can absolutely walk a neighbour's dog.

Every gig names what it pays for. CORE_RULES 13.6: any change to money names
its source AND its amount, and a gig whose line cannot say where the money came
from is a gig that does not belong in the catalog.

Run: python3 scripts/generate-gigs.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "packages/content/data/gigs.json"

CATALOG_VERSION = 2

GIGS: list[dict] = []


def G(
    gig_id: str,
    name: str,
    blurb: str,
    age_min: int,
    age_max: int | None,
    pay_low: int,
    pay_high: int,
    hours: float,
    source: str,
    lines: list[str],
    stat: str = "discipline",
    talent: str | None = None,
    needs_parent: bool = False,
    kind: str = "oddJob",
) -> None:
    """
    One deliberate work option, with age gates and an annual payout.

    `source` is the phrase the feed uses, and `pay_low`/`pay_high` are what a
    year of it is worth — not one afternoon, because the game's unit of time is
    a year and pretending otherwise would mean inventing a calendar.
    """
    GIGS.append(
        {
            "id": gig_id,
            "name": name,
            "blurb": blurb,
            "ageMin": age_min,
            **({"ageMax": age_max} if age_max is not None else {}),
            "kind": kind,
            "payLow": pay_low,
            "payHigh": pay_high,
            "hoursPerWeek": hours,
            "source": source,
            "stat": stat,
            **({"talent": talent} if talent else {}),
            **({"needsParent": True} if needs_parent else {}),
            "lines": lines,
        }
    )


# --- small children -----------------------------------------------------------
G("gig.lemonade", "Lemonade stand", "A table, a jug, and an inflated sense of business.",
  7, 11, 12, 45, 1, "the lemonade stand",
  ["Ran a lemonade stand all summer and took ${amount}. Overheads were somebody else's problem.",
   "The lemonade stand cleared ${amount}, most of it from one very generous neighbor."],
  stat="charisma")

G("gig.dog-walking", "Walking a neighbor's dog", "Every day after school, in all weathers.",
  9, 15, 60, 220, 2, "walking the Hallidays' dog",
  ["Walked the neighbor's dog every day after school and made ${amount} doing it.",
   "The dog-walking money came to ${amount} over the year, and the dog liked you best."],
  stat="discipline")

G("gig.car-wash", "Washing cars", "Bucket, sponge, and the whole street.",
  10, 16, 70, 260, 2, "washing cars on the street",
  ["Washed cars up and down the street most weekends and made ${amount}.",
   "Made ${amount} washing cars, and got very good at the wheels nobody else does."],
  stat="willpower")

# --- twelve and up ------------------------------------------------------------
G("gig.paper-round", "Paper round", "Before school. Every morning. In the dark half the year.",
  12, 16, 180, 420, 4, "the paper round",
  ["Did the paper round all year, in the dark half of it, and made ${amount}.",
   "The paper round paid ${amount} and cost every single morning."],
  stat="discipline")

G("gig.babysitting", "Babysitting", "Somebody else's children, after their bedtime.",
  12, 18, 150, 600, 3, "babysitting",
  ["Babysat most Fridays and made ${amount} watching other people's television.",
   "Babysitting brought in ${amount}, and one family asked for you specifically."],
  stat="charisma", needs_parent=True)

G("gig.lawns", "Mowing lawns", "Hot work, and the money is real.",
  12, 18, 200, 700, 4, "mowing lawns",
  ["Mowed lawns all summer and came out ${amount} up.",
   "Made ${amount} on lawns. Your hands looked like somebody else's by August."],
  stat="willpower")

G("gig.tutoring", "Tutoring a younger kid", "An hour a week, explaining what you already know.",
  13, 18, 180, 650, 2, "tutoring",
  ["Tutored a younger kid all year and made ${amount}, which felt like stealing.",
   "Tutoring paid ${amount}, and the kid actually got better, which was the surprise."],
  stat="smarts", talent="academics")

G("gig.busking", "Busking", "A pitch, an hour, and whoever walks past.",
  13, 18, 90, 800, 3, "busking",
  ["Played on the street most Saturdays and made ${amount} in a hat.",
   "Busking brought in ${amount}, and somebody filmed you once, which was terrifying."],
  stat="charisma", talent="music")

G("gig.commissions", "Drawing things for people", "Ten dollars a head, thirty for a pet.",
  13, 18, 120, 700, 3, "drawings people asked for",
  ["Drew things for people all year and made ${amount} at it.",
   "Took ${amount} in drawing commissions, and got faster than you got better."],
  stat="looks", talent="writing")

# --- sixteen and up -----------------------------------------------------------
G("gig.retail", "Weekend shifts in a shop", "A name badge, a till, and a manager called Dave.",
  16, 22, 6000, 10000, 12, "weekend shifts",
  ["Worked weekends in a shop all year and made ${amount}. It was mostly fine.",
   "The weekend job paid ${amount} and took every Saturday you had."], kind="partTime")

G("gig.food", "Kitchen shifts", "Hot, loud, and the best people you will ever work with.",
  16, 22, 7000, 12000, 14, "kitchen shifts",
  ["Worked in a kitchen most nights and made ${amount}. You have never been so tired.",
   "The kitchen paid ${amount} and taught you to work faster than you thought you could."],
  stat="willpower", kind="partTime")

G("gig.lifeguard", "Lifeguarding", "Sun, chlorine, and forty minutes of genuine responsibility.",
  16, 22, 1300, 3600, 12, "lifeguarding",
  ["Lifeguarded all summer and made ${amount} watching people not drown.",
   "Lifeguarding paid ${amount} and cost you an entire summer of being anywhere else."],
  stat="health", kind="partTime")

G("gig.camp", "Camp counsellor", "Six weeks, twelve children, no signal.",
  16, 22, 900, 2600, 20, "the camp job",
  ["Did six weeks as a camp counsellor and came back ${amount} up and completely changed.",
   "Camp paid ${amount}, which worked out at about nothing an hour, and was worth it anyway."],
  stat="charisma", kind="partTime")


# P6: chosen side work throughout adulthood. None means no upper-age cutoff.
G("gig.adult.pet-care", "Pet sitting and dog walking", "Regular walks and a spare key for weekends away.",
  18, None, 1500, 6000, 4, "pet sitting and dog walking",
  ["Looked after pets all year and made ${amount}. A few owners started asking for you by name.",
   "Pet care brought in ${amount}. You knew which dogs needed the long way home."])
G("gig.adult.yard-work", "Yard work", "Lawns, weeds, and neighbors who would rather pay somebody.",
  18, None, 2000, 7000, 5, "yard work",
  ["Kept yards tidy around the neighborhood and made ${amount} doing it.",
   "Yard work paid ${amount}. Most of it happened on somebody else's Saturday."], stat="willpower")
G("gig.adult.babysitting", "Babysitting", "Evenings with other people's children, on your own terms.",
  18, None, 2500, 9000, 6, "babysitting",
  ["Babysitting brought in ${amount}. A few families kept your number handy.",
   "Watched children for local families and made ${amount} over the year."], stat="charisma")
G("gig.adult.tutoring", "Tutoring", "Explain it until it clicks, then do it again next week.",
  18, None, 2500, 10000, 4, "tutoring",
  ["Tutored students through the year and made ${amount}. Some of them started enjoying it.",
   "Tutoring paid ${amount}. You learned which explanations actually worked."], stat="smarts", talent="academics")
G("gig.adult.art", "Art commissions", "People send a reference and ask what you would charge.",
  18, None, 1500, 8000, 4, "art commissions",
  ["Finished art commissions for people and made ${amount} over the year.",
   "Commission work brought in ${amount}. One customer came back for another."], stat="looks", talent="writing")
G("gig.adult.repairs", "Small household repairs", "Shelves, loose handles, and the little things people put off.",
  18, None, 3000, 12000, 6, "small household repairs",
  ["Fixed little things around people's homes and made ${amount} doing it.",
   "Household repair work paid ${amount}. Word got around that you showed up."])


def check() -> None:
    problems: list[str] = []
    seen: set[str] = set()
    for gig in GIGS:
        gid = gig["id"]
        if gid in seen:
            problems.append(f"duplicate gig id {gid!r}")
        seen.add(gid)
        if "ageMax" in gig and gig["ageMin"] > gig["ageMax"]:
            problems.append(f"{gid}: inverted age range")
        if gig["payLow"] > gig["payHigh"]:
            problems.append(f"{gid}: inverted pay range")
        if gig["payLow"] <= 0:
            problems.append(f"{gid}: pay must be positive")
        if not gig["source"]:
            problems.append(f"{gid}: money with no source (CORE_RULES 13.6)")
        for line in gig["lines"]:
            # The amount has to appear in the line the player actually reads.
            if "${amount}" not in line:
                problems.append(f"{gid}: line never says the amount: {line!r}")
            if line.strip()[-1] not in ".!?":
                problems.append(f"{gid}: line does not end in punctuation: {line!r}")
            if len(line) > 200:
                problems.append(f"{gid}: line is {len(line)} chars — spec 725-770 says concise")

    # Every childhood age from the first gig on must have something available,
    # or a player who opens the screen finds an empty list and learns not to.
    for age in range(7, 18):
        if not [g for g in GIGS if g["ageMin"] <= age <= g.get("ageMax", float("inf"))]:
            problems.append(f"no gig available at age {age}")

    if problems:
        print(f"{len(problems)} problem(s) in the gig catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def main() -> None:
    # Check, WRITE, then report — piping this through `head` must not be able to
    # kill the process before the file lands. This cost real time twice.
    check()
    payload = {"version": CATALOG_VERSION, "entries": GIGS}
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"{len(GIGS)} gigs")
    for age in range(7, 19, 2):
        available = [g for g in GIGS if g["ageMin"] <= age <= g.get("ageMax", float("inf"))]
        print(f"  age {age:>2}: {len(available)} available")


if __name__ == "__main__":
    main()
