#!/usr/bin/env python3
"""
Ticket 0210 — the job catalog.

Spec 1670 asks for "25-50 representative jobs initially". Spec 1699 grows that
to 150-250 in v0.04 and spec 1736 to 200-400 at launch, so the shape here has to
scale by adding rows and nothing else — which is why a job is data with a
template on it rather than a class with behaviour in it (spec 1461).

WHAT DECIDES THE CATALOG'S SHAPE

Every track is a LADDER, and a ladder is the whole design. Spec 1670 lists
"promotion" as a first-class verb, and a promotion needs somewhere to go; a flat
list of jobs cannot have one. So each track has three to five rungs, you enter
at or near the bottom, and you climb.

There is NO DEGREE REQUIREMENT anywhere in this file, deliberately. The build
has no college — 0204 shipped preschool through high school and stops — so a
job gated on a degree would be gated on a system that has not shipped, which is
CORE_RULES 13.16 for the fourth time. Professional work is at the TOP of a
ladder instead of behind a door, which is also spec 119: the game should allow
unlikely reinvention.

Pay is a real annual salary, because spec 1827 asks for realistic ranges. What
reaches the character's bank balance is savings, not salary — see `pay.ts`.

Run: python3 scripts/generate-jobs.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "packages/content/data/jobs.json"

CATALOG_VERSION = 1

JOBS: list[dict] = []

TRACKS = {
    "retail", "food", "trades", "office", "care", "logistics", "sales",
    "creative", "public", "education", "safety",
}
TEMPLATES = {
    "salary", "performance", "trade", "government", "professional", "management",
}


def J(
    job_id: str,
    title: str,
    track: str,
    rung: int,
    template: str,
    pay: int,
    blurb: str,
    *,
    spread: float = 0.0,
    min_age: int = 16,
    wants_diploma: bool = False,
    demand: int = 40,
) -> None:
    """
    One rung on one ladder.

    `blurb` is the whole listing. Spec 97 removes Workload and Travel lines from
    job listings by name, and spec 104 removes Quota — so a listing is a title,
    a salary and one sentence about what the work is actually like.
    """
    JOBS.append(
        {
            "id": job_id,
            "title": title,
            "track": track,
            "rung": rung,
            "template": template,
            "pay": pay,
            "spread": spread,
            "minAge": min_age,
            "wantsDiploma": wants_diploma,
            "demand": demand,
            "blurb": blurb,
        }
    )


# ---------------------------------------------------------------------------
# Retail — the widest front door in the game. Rung 0 needs nothing at all.
# ---------------------------------------------------------------------------
J("job.retail.floor", "Sales associate", "retail", 0, "salary", 27_000,
  "Shifts on the floor, and the rest.", demand=38)
J("job.retail.keyholder", "Keyholder", "retail", 1, "salary", 34_000,
  "You open, you close, you lock up.", demand=44)
J("job.retail.assistant", "Assistant manager", "retail", 2, "management", 46_000,
  "The rota, the till, everyone's problems.", demand=54)
J("job.retail.manager", "Store manager", "retail", 3, "management", 63_000,
  "The store, and a number to hit.", demand=62)
J("job.retail.district", "District manager", "retail", 4, "management", 92_000,
  "Eleven stores and a lot of driving.", demand=70)

# ---------------------------------------------------------------------------
# Food and drink — the other front door. Hard, badly paid, and always hiring.
# ---------------------------------------------------------------------------
J("job.food.crew", "Kitchen crew", "food", 0, "salary", 25_000,
  "Hot, loud, over at midnight.", demand=45)
J("job.food.server", "Server", "food", 0, "performance", 26_000,
  "The money is in what they leave you.", spread=0.55, demand=44)
J("job.food.line", "Line cook", "food", 1, "trade", 34_000,
  "One station, every ticket, all night.", demand=55)
J("job.food.sous", "Sous chef", "food", 2, "trade", 48_000,
  "You run the pass when he is out.", demand=64)
J("job.food.head", "Head chef", "food", 3, "management", 68_000,
  "The menu is yours. So is the blame.", demand=74)

# ---------------------------------------------------------------------------
# Trades — the ladder that pays properly without a classroom in it.
# ---------------------------------------------------------------------------
J("job.trades.laborer", "General laborer", "trades", 0, "trade", 32_000,
  "Whatever needs carrying, in any weather.", demand=52)
J("job.trades.apprentice", "Apprentice electrician", "trades", 1, "trade", 39_000,
  "Learning it properly, slowly.", demand=54)
J("job.trades.electrician", "Electrician", "trades", 2, "trade", 61_000,
  "Your own van and your own jobs.", demand=58)
J("job.trades.foreman", "Site foreman", "trades", 3, "management", 82_000,
  "Twenty people and the weather.", demand=66)
J("job.trades.contractor", "General contractor", "trades", 4, "performance", 105_000,
  "You bid the work. Some years it lands.", spread=0.6, demand=72)

# ---------------------------------------------------------------------------
# Office — the ladder toward professional work, with no degree in the way.
# ---------------------------------------------------------------------------
J("job.office.reception", "Receptionist", "office", 0, "salary", 30_000,
  "The front desk and everyone's parcels.", wants_diploma=True, demand=36)
J("job.office.admin", "Office administrator", "office", 1, "salary", 40_000,
  "The place runs because you do.", wants_diploma=True, demand=42)
J("job.office.analyst", "Analyst", "office", 2, "professional", 58_000,
  "Numbers, and what they mean.", wants_diploma=True, demand=52)
J("job.office.senior", "Senior analyst", "office", 3, "professional", 79_000,
  "The work nobody else can check.", wants_diploma=True, demand=58)
J("job.office.director", "Operations director", "office", 4, "management", 118_000,
  "A department and a budget.", wants_diploma=True, demand=70)

# ---------------------------------------------------------------------------
# Care and health — the top rung a build with no college can honestly reach.
# ---------------------------------------------------------------------------
J("job.care.aide", "Care aide", "care", 0, "salary", 28_000,
  "Twelve-hour shifts, and they need you.", demand=56)
J("job.care.tech", "Care technician", "care", 1, "salary", 37_000,
  "The parts of it nobody films.", wants_diploma=True, demand=60)
J("job.care.nurse", "Practical nurse", "care", 2, "professional", 54_000,
  "Nights, and you are the one they ask.", wants_diploma=True, demand=68)
J("job.care.charge", "Charge nurse", "care", 3, "professional", 76_000,
  "The floor, and every bad call.", wants_diploma=True, demand=74)

# ---------------------------------------------------------------------------
# Logistics — steady, physical, and there is always more of it.
# ---------------------------------------------------------------------------
J("job.logistics.picker", "Warehouse picker", "logistics", 0, "salary", 29_000,
  "A headset and eleven miles a shift.", demand=50)
J("job.logistics.driver", "Delivery driver", "logistics", 1, "salary", 38_000,
  "Your route, and a lot of time alone.", demand=52)
J("job.logistics.haul", "Long-haul driver", "logistics", 2, "trade", 55_000,
  "Four nights a week in the cab.", demand=72)
J("job.logistics.super", "Warehouse supervisor", "logistics", 3, "management", 68_000,
  "Three shifts and forty people.", demand=64)

# ---------------------------------------------------------------------------
# Sales — spec 1394 asks for wide outcomes here by name. No quota UI (spec 104).
# ---------------------------------------------------------------------------
J("job.sales.retail", "Commission sales", "sales", 0, "performance", 30_000,
  "Small base. The rest is what you sell.", spread=0.7, demand=48)
J("job.sales.account", "Account executive", "sales", 1, "performance", 52_000,
  "A patch, a list, and a number.", spread=0.85, demand=58)
J("job.sales.realestate", "Real estate agent", "sales", 2, "performance", 62_000,
  "Some years are extraordinary.", spread=1.05, demand=60)
J("job.sales.broker", "Financial broker", "sales", 3, "performance", 88_000,
  "Other people's money, and a cut.", spread=1.15, demand=70)
J("job.sales.director", "Sales director", "sales", 4, "management", 130_000,
  "You carry the team's number now.", spread=0.5, demand=76)

# ---------------------------------------------------------------------------
# Creative — reachable, badly paid at the bottom, and wide at the top.
# ---------------------------------------------------------------------------
J("job.creative.assistant", "Studio assistant", "creative", 0, "salary", 26_000,
  "Everybody's coffee, and sometimes more.", demand=44)
J("job.creative.designer", "Graphic designer", "creative", 1, "salary", 44_000,
  "Somebody else's brief, six times over.", demand=50)
J("job.creative.senior", "Art director", "creative", 2, "professional", 72_000,
  "It is your name on how it looks.", demand=58)
# Going out on your own is a step UP in what the year can pay and a step down in
# what it will. The base is above an art director's because the ladder check is
# right that a promotion has to be worth taking; the spread is what makes a bad
# year genuinely worse than the salaried job you left.
J("job.creative.freelance", "Freelance creative", "creative", 3, "performance", 78_000,
  "No boss, no floor, no ceiling.", spread=1.15, demand=54)

# ---------------------------------------------------------------------------
# Public service — slow, safe, pensioned. Spec 1836's realistic pay and ranks.
# ---------------------------------------------------------------------------
J("job.public.clerk", "Records clerk", "public", 0, "government", 33_000,
  "The filing of a small city.", demand=36)
J("job.public.inspector", "Building inspector", "public", 1, "government", 52_000,
  "Sixty sites a month, clipboard in hand.", wants_diploma=True, demand=48)
J("job.public.manager", "Department manager", "public", 2, "government", 71_000,
  "A department, and never enough budget.", wants_diploma=True, demand=58)
J("job.public.city", "City administrator", "public", 3, "government", 104_000,
  "Budgets, council, and a long horizon.", wants_diploma=True, demand=62)

# ---------------------------------------------------------------------------
# Education and public safety are their OWN ladders, not rungs of public
# service. The catalog check found why: a teacher was sitting one rung above a
# police officer and being paid less, so the "promotion" the model would offer
# was a pay cut. Two jobs that are not steps toward each other do not belong on
# one ladder however similar their employer is.
# ---------------------------------------------------------------------------
J("job.school.aide", "Teaching assistant", "education", 0, "salary", 29_000,
  "Thirty children and one of you.", demand=52)
J("job.school.teacher", "Teacher", "education", 1, "professional", 56_000,
  "Thirty of them, and the marking after.", wants_diploma=True, demand=66)
J("job.school.head", "Department head", "education", 2, "professional", 70_000,
  "Your subject and six teachers.", wants_diploma=True, demand=68)
J("job.school.principal", "School principal", "education", 3, "management", 88_000,
  "The building, and every parent in it.", wants_diploma=True, demand=74)

J("job.safety.dispatch", "Emergency dispatcher", "safety", 0, "government", 42_000,
  "The voice on somebody's worst call.", demand=64)
J("job.safety.officer", "Police officer", "safety", 1, "government", 58_000,
  "A radio, and everybody's worst night.", wants_diploma=True, demand=70)
J("job.safety.detective", "Detective", "safety", 2, "government", 74_000,
  "The ones that stay with you.", wants_diploma=True, demand=72)
J("job.safety.sergeant", "Sergeant", "safety", 3, "management", 91_000,
  "A shift of them, and their decisions.", wants_diploma=True, demand=74)


def check() -> None:
    problems: list[str] = []
    seen: set[str] = set()
    by_track: dict[str, list[dict]] = {}

    for job in JOBS:
        jid = job["id"]
        if jid in seen:
            problems.append(f"duplicate job id {jid!r}")
        seen.add(jid)
        if job["track"] not in TRACKS:
            problems.append(f"{jid}: unknown track {job['track']!r}")
        if job["template"] not in TEMPLATES:
            problems.append(f"{jid}: unknown template {job['template']!r}")
        if job["pay"] <= 0:
            problems.append(f"{jid}: pay must be positive")
        if job["spread"] > 0 and job["template"] not in ("performance", "trade", "management"):
            problems.append(f"{jid}: only a performance-ish template should have a spread")
        if job["template"] == "performance" and job["spread"] <= 0:
            problems.append(
                f"{jid}: a performance job with no spread is a salary job wearing a hat "
                f"— spec 1394 asks these for wide outcome distributions"
            )
        if not 0 <= job["demand"] <= 100:
            problems.append(f"{jid}: demand out of range")
        blurb = job["blurb"]
        if blurb.strip()[-1] not in ".!?":
            problems.append(f"{jid}: blurb does not end in punctuation: {blurb!r}")
        # Spec 97 and 104 remove these from listings by name.
        low = blurb.lower()
        for banned in ("quota", "workload", "travel:"):
            if banned in low:
                problems.append(f"{jid}: blurb mentions {banned!r}, which spec 97/104 removes")
        # MEASURED ON A SCREENSHOT, not guessed. At 58 every one of the six
        # visible listings clipped — "Twelve-hour shifts…", "Small base. The
        # r…", "The front desk, th…" — because the row also carries a salary
        # and a mood word. The 0209 lesson about the parent menu, in a new
        # place, which is CORE_RULES 13.23.
        if len(blurb) > 40:
            problems.append(f"{jid}: blurb is {len(blurb)} chars and will clip on the row")
        if len(job["title"]) > 22:
            problems.append(f"{jid}: title is {len(job['title'])} chars and will clip")
        by_track.setdefault(job["track"], []).append(job)

    for track, jobs in by_track.items():
        rungs = sorted(job["rung"] for job in jobs)
        if rungs[0] != 0:
            problems.append(f"track {track!r} has no rung 0 — there is no way into it")
        # A ladder with a hole in it is a promotion that can never happen.
        expected = set(range(0, max(rungs) + 1))
        if not expected.issubset(set(rungs)):
            missing = sorted(expected - set(rungs))
            problems.append(f"track {track!r} is missing rung(s) {missing} — the ladder has a gap")
        # Climbing has to be worth it, at every step.
        by_rung: dict[int, list[dict]] = {}
        for job in jobs:
            by_rung.setdefault(job["rung"], []).append(job)
        for rung in sorted(by_rung)[:-1]:
            here = max(job["pay"] for job in by_rung[rung])
            above = max(job["pay"] for job in by_rung[rung + 1])
            if above <= here:
                problems.append(
                    f"track {track!r}: rung {rung + 1} pays no more than rung {rung} "
                    f"— a promotion nobody would want is not a promotion"
                )

    # A school leaver with nothing has to have somewhere to go, or the whole
    # system is unreachable for the population the build actually produces.
    # CORE_RULES 13.16: this is the check that would have caught the $9,000
    # wedding and the $650 school play.
    open_doors = [job for job in JOBS if job["rung"] == 0 and not job["wantsDiploma"]]
    if len(open_doors) < 5:
        problems.append(
            f"only {len(open_doors)} job(s) need neither experience nor a diploma — "
            f"a character who left school early has nowhere to start"
        )

    if not 25 <= len(JOBS) <= 50:
        problems.append(f"{len(JOBS)} jobs — spec 1670 asks for 25-50 initially")

    if problems:
        print(f"{len(problems)} problem(s) in the job catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def main() -> None:
    # Check, WRITE, then report. Same order as every other catalog script here,
    # for the same reason: piping this through `head` must not be able to kill
    # the process before the file lands.
    check()
    payload = {"version": CATALOG_VERSION, "entries": JOBS}
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    print(f"{len(JOBS)} jobs across {len({job['track'] for job in JOBS})} tracks")
    for track in sorted({job["track"] for job in JOBS}):
        jobs = sorted((job for job in JOBS if job["track"] == track), key=lambda j: j["rung"])
        pay = " -> ".join(f"${job['pay'] // 1000}k" for job in jobs)
        print(f"  {track:<10} {len(jobs)} rungs   {pay}")
    doors = [job for job in JOBS if job["rung"] == 0 and not job["wantsDiploma"]]
    print(f"\n{len(doors)} way(s) in with no diploma and no experience")


if __name__ == "__main__":
    main()
