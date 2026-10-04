#!/usr/bin/env python3
"""
Ticket 0210 — the job catalog. Ticket 0403 triples it.

Spec 1670 asks for "25-50 representative jobs initially". Spec 1699 grows that
to 150-250 in v0.04 and spec 1736 to 200-400 at launch, so the shape here has to
scale by adding rows and nothing else — which is why a job is data with a
template on it rather than a class with behaviour in it (spec 1461).

WHAT DECIDES THE CATALOG'S SHAPE

Every track is a LADDER, and a ladder is the whole design. Spec 1670 lists
"promotion" as a first-class verb, and a promotion needs somewhere to go; a flat
list of jobs cannot have one. So each track has three to five rungs, you enter
at or near the bottom, and you climb. A rung can hold more than one job — food
has held two rung-0 jobs since 0210 — and 0403 leans on that harder than 0210
did: most rungs below the top now carry two or three PARALLEL titles rather
than one, because that is volume that does not lengthen any single ladder. A
longer ladder is a rarer promotion; a wider rung is a different door into the
same one.

Professional work needing a degree is a real gate since 0210b, not the "no
degree requirement" 0210 shipped — the build has had college since then. Five
whole new fields (tech, finance, legal, medicine, hospitality) are added
alongside deepening the original eleven, because 150-250 titles spread only
eleven tracks wider than "office worker with different business cards" can
honestly stretch, and the real economy has software engineers and physicians in
it. `legal` and `medicine` are deliberately SHORT ladders — three to five rungs
that get expensive fast — because a lawyer or a doctor is not something a
character backs into the way they back into a store manager job; both are
gated on `postgraduate` from the rung where the license would actually be
required, same principle 0210b used for nursing and teaching.

0403's binding constraint was measured before a single row here was written
(`claude/v004-career-measurement.md`): the catalog's SIZE was never what kept a
player from seeing most of it, the GATE was — `reachOf` reading the held rung
instead of the effective one. 0401 fixed that and left a guard behind
(`packages/simulation/src/reachability.test.ts`) that asserts no job may ever
be eligible to somebody and unreachable by the listings, written before this
ticket rather than after it. That guard is what actually decided how wide any
one rung could get here — a rung with six parallel titles competing for the
same six-listing draw would starve some of them, so most rungs stayed at two or
three.

Pay is a real annual salary, because spec 1827 asks for realistic ranges. What
reaches the character's bank balance is savings, not salary — see `pay.ts`.

Run: python3 scripts/generate-jobs.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "packages/content/data/jobs.json"

CATALOG_VERSION = 2

JOBS: list[dict] = []

TRACKS = {
    "retail", "food", "trades", "office", "care", "logistics", "sales",
    "creative", "public", "education", "safety",
    # New in 0403.
    "tech", "finance", "legal", "medicine", "hospitality",
    # New in 0406. Four professions the catalogue named nowhere, each of which
    # now has a school in front of it — a vet school with no veterinarian to
    # become would have been a door onto a wall.
    "veterinary", "dental", "pharmacy", "architecture",
}
TEMPLATES = {
    "salary", "performance", "trade", "government", "professional", "management",
}
# Mirrors EducationLevel in @yearafter/education. `requires` is a HARD floor —
# you legally cannot be a nurse without the license — and `prefers` is a door
# that is heavier without it, never shut (spec 119 keeps reinvention open).
LEVELS = {"none", "highSchool", "university", "postgraduate"}
LEVEL_ORDER = ["none", "highSchool", "university", "postgraduate"]
# Ticket 0406. Mirrors LICENSES in @yearafter/education. A license is the door
# `requires` could never describe: it is not ordered, so no amount of schooling
# substitutes for it. Only rows that legally need one carry one.
LICENSES = {
    "lic.md", "lic.jd", "lic.dvm", "lic.dds", "lic.pharmd", "lic.architect",
    "lic.np", "lic.cpa", "lic.lcsw",
    "lic.electrical", "lic.plumbing", "lic.hvac", "lic.welding", "lic.cdl",
    "lic.automotive", "lic.cosmetology", "lic.hygiene", "lic.lpn",
    "lic.culinary", "lic.paralegal", "lic.paramedic", "lic.pharmtech",
    "lic.network",
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
    requires: str = "none",
    prefers: str = "none",
    license: str | None = None,
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
            "requires": requires,
            "prefers": prefers,
            **({"license": license} if license else {}),
            "demand": demand,
            "blurb": blurb,
        }
    )


# ---------------------------------------------------------------------------
# Retail — the widest front door in the game. Rung 0 needs nothing at all.
# ---------------------------------------------------------------------------
J("job.retail.floor", "Sales associate", "retail", 0, "salary", 27_000,
  "Shifts on the floor, and the rest.", demand=38)
J("job.retail.stock", "Stock associate", "retail", 0, "salary", 26_000,
  "Truck days, tags, and the back room.", demand=36)
J("job.retail.keyholder", "Keyholder", "retail", 1, "salary", 34_000,
  "You open, you close, you lock up.", demand=44)
J("job.retail.visual", "Visual merchandiser", "retail", 1, "salary", 35_000,
  "The windows, the layout, the look.", demand=40)
J("job.retail.inventory", "Inventory associate", "retail", 1, "salary", 33_000,
  "Counts, and counts again.", demand=40)
J("job.retail.assistant", "Assistant manager", "retail", 2, "management", 46_000,
  "The rota, the till, everyone's problems.", demand=54)
J("job.retail.lossprevention", "Loss prevention lead", "retail", 2, "salary", 47_000,
  "Cameras, tags, and quiet exits.", demand=50)
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
J("job.food.host", "Host", "food", 0, "salary", 24_000,
  "The door, the wait, first impressions.", demand=36)
J("job.food.line", "Line cook", "food", 1, "trade", 34_000,
  "One station, every ticket, all night.", demand=55)
J("job.food.baker", "Baker", "food", 1, "trade", 36_000,
  "Dough before sunrise, every single day.", demand=50)
J("job.food.prep", "Prep cook", "food", 1, "trade", 33_000,
  "Chopped, portioned, ready by open.", demand=50)
J("job.food.sous", "Sous chef", "food", 2, "trade", 48_000,
  "You run the pass when he is out.", demand=64)
J("job.food.pastry", "Pastry chef", "food", 2, "trade", 49_000,
  "Sugar work, and it has to be perfect.", demand=66)
J("job.food.head", "Head chef", "food", 3, "management", 68_000,
  "The menu is yours. So is the blame.", demand=74)
J("job.food.grill", "Grill cook", "food", 1, "trade", 35_000,
  "The heat, the smoke, and the rush.", demand=52)

# ---------------------------------------------------------------------------
# Trades — the ladder that pays properly without a classroom in it.
# ---------------------------------------------------------------------------
J("job.trades.laborer", "General laborer", "trades", 0, "trade", 32_000,
  "Whatever needs carrying, in any weather.", demand=52)
J("job.trades.handyman", "Handyman", "trades", 0, "trade", 33_000,
  "Small jobs, every day, different house.", demand=48)
J("job.trades.apprentice", "Apprentice electrician", "trades", 1, "trade", 39_000,
  "Learning it properly, slowly.", demand=54)
J("job.trades.apprenticeplumber", "Apprentice plumber", "trades", 1, "trade", 39_000,
  "Copper, PVC, and someone watching you.", demand=54)
J("job.trades.electrician", "Electrician", "trades", 2, "trade", 61_000,
  "Your own van and your own jobs.", demand=58)
J("job.trades.plumber", "Plumber", "trades", 2, "trade", 60_000,
  "Pipes, and whatever is behind the wall.", demand=58)
# Rung 2 stops at two parallel titles rather than the four first tried here
# (electrician/plumber/HVAC/carpenter). Measured: the reachability guard
# starved the ladder's OWN rung 4 (`General contractor`) once rung 2 got that
# wide, because a stepUp candidate deep in one track was competing against
# three same-weight siblings just to be the one shown — before it ever got to
# compete with anything from another track. Two-wide leaves the funnel to the
# top of the ladder as open as the other rungs are.
J("job.trades.foreman", "Site foreman", "trades", 3, "management", 82_000,
  "Twenty people and the weather.", demand=66)
J("job.trades.masterplumber", "Master plumber", "trades", 3, "trade", 79_000,
  "Your license, your crew, your name.", demand=68)
# Rung 4 stays a single title. A second one here — "Electrical contractor" —
# was tried and measured: the reachability guard in
# `packages/simulation/src/reachability.test.ts` caught it starving General
# Contractor across 60 played lives, because the top of a ladder is the rung
# fewest characters ever reach in the first place, and splitting that already
# small population between two parallel titles left the six-listing draw
# unable to surface both. Every other rung in this file can carry two or three
# parallel jobs; the last one cannot.
J("job.trades.contractor", "General contractor", "trades", 4, "performance", 105_000,
  "You bid the work. Some years it lands.", spread=0.6, demand=72)

# ---------------------------------------------------------------------------
# Office — the ladder toward professional work, with a degree track and a
# non-degree track climbing it side by side.
# ---------------------------------------------------------------------------
J("job.office.reception", "Receptionist", "office", 0, "salary", 30_000,
  "The front desk and everyone's parcels.", prefers="highSchool", demand=36)
J("job.office.dataentry", "Data entry clerk", "office", 0, "salary", 29_000,
  "Spreadsheets nobody reads twice.", demand=34)
J("job.office.mailroom", "Mailroom clerk", "office", 0, "salary", 28_000,
  "Packages, and knowing where things go.", demand=30)
J("job.office.admin", "Office administrator", "office", 1, "salary", 40_000,
  "The place runs because you do.", prefers="highSchool", demand=42)
J("job.office.hrcoord", "HR coordinator", "office", 1, "salary", 41_000,
  "Paperwork, and everyone's questions.", prefers="highSchool", demand=44)
J("job.office.analyst", "Analyst", "office", 2, "professional", 58_000,
  "Numbers, and what they mean.", requires="university", demand=52)
J("job.office.marketingcoord", "Marketing coordinator", "office", 2, "salary", 55_000,
  "Campaigns, deadlines, shared inbox.", prefers="highSchool", demand=50)
J("job.office.execassistant", "Executive assistant", "office", 2, "salary", 57_000,
  "The calendar that runs the office.", prefers="university", demand=50)
J("job.office.senior", "Senior analyst", "office", 3, "professional", 79_000,
  "The work nobody else can check.", requires="university", demand=58)
J("job.office.hrmanager", "HR manager", "office", 3, "management", 77_000,
  "Hiring, firing, and everything between.", prefers="university", demand=56)
J("job.office.marketingmanager", "Marketing manager", "office", 3, "management", 80_000,
  "The budget, the brand, the blame.", prefers="university", demand=58)
J("job.office.director", "Operations director", "office", 4, "management", 118_000,
  "A department and a budget.", requires="university", demand=70)
J("job.office.vpmarketing", "VP of marketing", "office", 4, "management", 120_000,
  "The whole story the company tells.", prefers="university", demand=68)

# ---------------------------------------------------------------------------
# Care and health — nursing and support work. `medicine` below is doctors.
# ---------------------------------------------------------------------------
J("job.care.aide", "Care aide", "care", 0, "salary", 28_000,
  "Twelve-hour shifts, and they need you.", demand=56)
J("job.care.homehealth", "Home health aide", "care", 0, "salary", 27_000,
  "In someone's home, doing the care.", demand=50)
J("job.care.tech", "Care technician", "care", 1, "salary", 37_000,
  "The parts of it nobody films.", prefers="highSchool", demand=60)
J("job.care.pharmtech", "Pharmacy technician", "care", 1, "salary", 38_000,
  "Counting pills, and getting it right.", prefers="highSchool", demand=58)
J("job.care.medbiller", "Medical biller", "care", 1, "salary", 39_000,
  "Codes, claims, and getting paid.", demand=50)
J("job.care.nurse", "Practical nurse", "care", 2, "professional", 54_000,
  "Nights, and you are the one they ask.", requires="university", demand=68)
J("job.care.ptaide", "Physical therapy aide", "care", 2, "professional", 55_000,
  "Helping people move again, slowly.", requires="university", demand=64)
J("job.care.charge", "Charge nurse", "care", 3, "professional", 76_000,
  "The floor, and every bad call.", requires="university", demand=74)
J("job.care.dental", "Dental assistant", "care", 1, "salary", 39_000,
  "Cleanings, x-rays, and calming nerves.", prefers="highSchool", demand=54)

# ---------------------------------------------------------------------------
# Logistics — steady, physical, and there is always more of it.
# ---------------------------------------------------------------------------
J("job.logistics.picker", "Warehouse picker", "logistics", 0, "salary", 29_000,
  "A headset and eleven miles a shift.", demand=50)
J("job.logistics.loader", "Freight loader", "logistics", 0, "salary", 28_000,
  "Trucks in, trucks out, all shift.", demand=48)
J("job.logistics.driver", "Delivery driver", "logistics", 1, "salary", 38_000,
  "Your route, and a lot of time alone.", demand=52)
J("job.logistics.dispatcher", "Route dispatcher", "logistics", 1, "salary", 39_000,
  "Every driver, every route, on time.", demand=50)
J("job.logistics.forklift", "Forklift operator", "logistics", 1, "salary", 37_000,
  "Pallets, all shift, careful hands.", demand=48)
J("job.logistics.haul", "Long-haul driver", "logistics", 2, "trade", 55_000,
  "Four nights a week in the cab.", demand=72)
J("job.logistics.fleetmech", "Fleet mechanic", "logistics", 2, "trade", 54_000,
  "Keeping the trucks alive, and moving.", demand=60)
J("job.logistics.super", "Warehouse supervisor", "logistics", 3, "management", 68_000,
  "Three shifts and forty people.", demand=64)
J("job.logistics.coordinator", "Logistics coordinator", "logistics", 2, "salary", 56_000,
  "Every load, tracked, every day.", demand=58)

# ---------------------------------------------------------------------------
# Sales — spec 1394 asks for wide outcomes here by name. No quota UI (spec 104).
# ---------------------------------------------------------------------------
J("job.sales.retail", "Commission sales", "sales", 0, "performance", 30_000,
  "Small base. The rest is what you sell.", spread=0.7, demand=48)
J("job.sales.insurance", "Insurance sales", "sales", 0, "performance", 31_000,
  "A base that barely covers rent.", spread=0.65, demand=46)
J("job.sales.account", "Account executive", "sales", 1, "performance", 52_000,
  "A patch, a list, and a number.", spread=0.85, demand=58)
J("job.sales.auto", "Auto sales", "sales", 1, "performance", 48_000,
  "The lot, the walk-around, the close.", spread=0.8, demand=56)
J("job.sales.territory", "Territory rep", "sales", 1, "performance", 50_000,
  "Your patch, and your commission.", spread=0.7, demand=54)
J("job.sales.realestate", "Real estate agent", "sales", 2, "performance", 62_000,
  "Some years are extraordinary.", spread=1.05, demand=60)
J("job.sales.pharma", "Pharmaceutical sales", "sales", 2, "performance", 68_000,
  "Doctors' offices, and a strict script.", spread=0.75, prefers="university", demand=62)
J("job.sales.broker", "Financial broker", "sales", 3, "performance", 88_000,
  "Other people's money, and a cut.", spread=1.15, demand=70)
J("job.sales.engineer", "Sales engineer", "sales", 3, "performance", 90_000,
  "You sell what you can actually explain.", spread=0.7, prefers="university", demand=68)
J("job.sales.director", "Sales director", "sales", 4, "management", 130_000,
  "You carry the team's number now.", spread=0.5, demand=76)

# ---------------------------------------------------------------------------
# Creative — reachable, badly paid at the bottom, and wide at the top.
# ---------------------------------------------------------------------------
J("job.creative.assistant", "Studio assistant", "creative", 0, "salary", 26_000,
  "Everybody's coffee, and sometimes more.", demand=44)
J("job.creative.production", "Production assistant", "creative", 0, "salary", 25_000,
  "Everyone's coffee, plus the timesheet.", demand=42)
J("job.creative.illustrator", "Junior illustrator", "creative", 0, "salary", 25_000,
  "Somebody else's brief, in your style.", demand=40)
J("job.creative.designer", "Graphic designer", "creative", 1, "salary", 44_000,
  "Somebody else's brief, six times over.", demand=50)
J("job.creative.social", "Social media manager", "creative", 1, "salary", 46_000,
  "The brand's whole voice, every day.", demand=52)
J("job.creative.videoeditor", "Video editor", "creative", 1, "salary", 45_000,
  "Somebody else's footage, made to work.", demand=50)
J("job.creative.senior", "Art director", "creative", 2, "professional", 72_000,
  "It is your name on how it looks.", demand=58)
J("job.creative.brand", "Brand strategist", "creative", 2, "professional", 74_000,
  "The idea behind the idea.", demand=60)
J("job.creative.ux", "UX designer", "creative", 2, "professional", 73_000,
  "How it works, not just how it looks.", requires="university", demand=60)
# Going out on your own is a step UP in what the year can pay and a step down in
# what it will. The base is above an art director's because the ladder check is
# right that a promotion has to be worth taking; the spread is what makes a bad
# year genuinely worse than the salaried job you left.
J("job.creative.freelance", "Freelance creative", "creative", 3, "performance", 78_000,
  "No boss, no floor, no ceiling.", spread=1.15, demand=54)
J("job.creative.copywriter", "Copywriter", "creative", 1, "salary", 44_000,
  "Words that have to sell something.", demand=48)

# ---------------------------------------------------------------------------
# Public service — slow, safe, pensioned. Spec 1836's realistic pay and ranks.
# ---------------------------------------------------------------------------
J("job.public.clerk", "Records clerk", "public", 0, "government", 33_000,
  "The filing of a small city.", demand=36)
J("job.public.permit", "Permit technician", "public", 0, "government", 34_000,
  "Applications, stamps, and long lines.", demand=38)
J("job.public.inspector", "Building inspector", "public", 1, "government", 52_000,
  "Sixty sites a month, clipboard in hand.", prefers="highSchool", demand=48)
J("job.public.compliance", "Compliance officer", "public", 1, "government", 51_000,
  "Knocking on doors nobody answers.", prefers="highSchool", demand=46)
J("job.public.zoning", "Zoning technician", "public", 1, "government", 50_000,
  "Maps, codes, and disagreeing neighbors.", prefers="highSchool", demand=46)
J("job.public.manager", "Department manager", "public", 2, "government", 71_000,
  "A department, and never enough budget.", prefers="highSchool", demand=58)
J("job.public.parks", "Parks supervisor", "public", 2, "government", 69_000,
  "Fields, trails, and a mowing schedule.", demand=54)
J("job.public.city", "City administrator", "public", 3, "government", 104_000,
  "Budgets, council, and a long horizon.", requires="university", demand=62)

# ---------------------------------------------------------------------------
# Education and public safety are their OWN ladders, not rungs of public
# service. The catalog check found why: a teacher was sitting one rung above a
# police officer and being paid less, so the "promotion" the model would offer
# was a pay cut. Two jobs that are not steps toward each other do not belong on
# one ladder however similar their employer is.
# ---------------------------------------------------------------------------
J("job.school.aide", "Teaching assistant", "education", 0, "salary", 29_000,
  "Thirty children and one of you.", demand=52)
J("job.school.substitute", "Substitute teacher", "education", 0, "salary", 28_000,
  "Someone else's lesson plan, cold.", prefers="highSchool", demand=46)
J("job.school.teacher", "Teacher", "education", 1, "professional", 56_000,
  "Thirty of them, and the marking after.", requires="university", demand=66)
J("job.school.counselor", "School counselor", "education", 1, "professional", 58_000,
  "Every kid's worst week, some weeks.", requires="university", demand=60)
J("job.school.librarian", "Librarian", "education", 1, "professional", 55_000,
  "Every kid who needs somewhere quiet.", requires="university", demand=52)
J("job.school.head", "Department head", "education", 2, "professional", 70_000,
  "Your subject and six teachers.", requires="university", demand=68)
J("job.school.curriculum", "Curriculum lead", "education", 2, "professional", 72_000,
  "What gets taught, and to whom.", requires="university", demand=62)
J("job.school.principal", "School principal", "education", 3, "management", 88_000,
  "The building, and every parent in it.", requires="postgraduate", demand=74)

J("job.safety.dispatch", "Emergency dispatcher", "safety", 0, "government", 42_000,
  "The voice on somebody's worst call.", demand=64)
J("job.safety.guard", "Security guard", "safety", 0, "government", 38_000,
  "Rounds, cameras, and a long night.", demand=56)
J("job.safety.officer", "Police officer", "safety", 1, "government", 58_000,
  "A radio, and everybody's worst night.", prefers="highSchool", demand=70)
J("job.safety.firefighter", "Firefighter", "safety", 1, "government", 54_000,
  "Fires, wrecks, and whatever else calls.", prefers="highSchool", demand=72)
J("job.safety.detective", "Detective", "safety", 2, "government", 74_000,
  "The ones that stay with you.", prefers="highSchool", demand=72)
J("job.safety.firecaptain", "Fire captain", "safety", 2, "government", 71_000,
  "The crew, the truck, the call-outs.", prefers="highSchool", demand=74)
J("job.safety.sergeant", "Sergeant", "safety", 3, "management", 91_000,
  "A shift of them, and their decisions.", prefers="highSchool", demand=74)
J("job.safety.firechief", "Fire chief", "safety", 3, "management", 93_000,
  "Every station, every budget line.", prefers="highSchool", demand=78)

# ---------------------------------------------------------------------------
# Tech — new in 0403. The one field where the ladder is short and the pay is
# not: a career here compounds fast, which is the real thing about software.
# ---------------------------------------------------------------------------
J("job.tech.itsupport", "IT support technician", "tech", 0, "salary", 42_000,
  "Password resets, and the printer.", demand=44)
J("job.tech.qa", "QA tester", "tech", 0, "salary", 44_000,
  "Breaking it before the customer does.", demand=42)
J("job.tech.developer", "Software developer", "tech", 1, "professional", 68_000,
  "Building it, and then fixing it again.", prefers="university", demand=56)
J("job.tech.sysadmin", "Systems administrator", "tech", 1, "professional", 64_000,
  "Nothing works until it works.", prefers="university", demand=54)
J("job.tech.dataanalyst", "Data analyst", "tech", 1, "professional", 66_000,
  "The dashboard everyone checks first.", prefers="university", demand=54)
J("job.tech.senior", "Senior engineer", "tech", 2, "professional", 98_000,
  "The hard bugs land on your desk.", requires="university", demand=64)
J("job.tech.devops", "DevOps engineer", "tech", 2, "professional", 102_000,
  "If it's down at 3am, it's you.", requires="university", demand=66)
J("job.tech.engmanager", "Engineering manager", "tech", 3, "management", 138_000,
  "Your team's code, and your team's week.", requires="university", demand=72)
J("job.tech.architect", "Solutions architect", "tech", 3, "professional", 142_000,
  "The whole system, drawn out first.", requires="university", demand=68)
J("job.tech.vp", "VP of engineering", "tech", 4, "management", 195_000,
  "Every team that ships, reports to you.", requires="university", demand=82)

# ---------------------------------------------------------------------------
# Finance — new in 0403. `performance` where the job is genuinely commission,
# `professional` where it is genuinely a credential doing the work.
# ---------------------------------------------------------------------------
J("job.finance.teller", "Bank teller", "finance", 0, "salary", 34_000,
  "Counting drawers, twice a day.", demand=40)
J("job.finance.bookkeeper", "Bookkeeper", "finance", 0, "salary", 38_000,
  "Every receipt, filed somewhere sane.", demand=42)
J("job.finance.loanofficer", "Loan officer", "finance", 1, "performance", 52_000,
  "Approvals, denials, and the paperwork.", spread=0.5, prefers="university", demand=52)
J("job.finance.payroll", "Payroll specialist", "finance", 1, "salary", 46_000,
  "Everyone's paycheck, on time, always.", prefers="university", demand=48)
J("job.finance.credit", "Credit analyst", "finance", 1, "professional", 60_000,
  "Deciding who gets the loan.", requires="university", demand=52)
J("job.finance.accountant", "Accountant", "finance", 2, "professional", 66_000,
  "The numbers, reconciled, every month.", requires="university", demand=56)
J("job.finance.analyst", "Financial analyst", "finance", 2, "professional", 72_000,
  "What the numbers mean, by Friday.", requires="university", demand=58)
J("job.finance.senioraccountant", "Senior accountant", "finance", 3, "professional", 92_000,
  "The close nobody else can sign off on.", requires="university", demand=62)
J("job.finance.portfolio", "Portfolio manager", "finance", 3, "performance", 105_000,
  "Other people's retirement, your call.", spread=0.9, requires="university", demand=68)
J("job.finance.director", "Finance director", "finance", 4, "management", 148_000,
  "The whole budget, and the board.", requires="university", demand=76)

# ---------------------------------------------------------------------------
# Legal — new in 0403. Short on purpose: an attorney is not backed into the way
# a store manager is, and `requires="postgraduate"` starts where the license
# actually would.
# ---------------------------------------------------------------------------
J("job.legal.assistant", "Legal assistant", "legal", 0, "salary", 34_000,
  "Filings, deadlines, and the copier.", demand=44)
J("job.legal.secretary", "Legal secretary", "legal", 0, "salary", 31_000,
  "Calendars, calls, and every deadline.", demand=40)
J("job.legal.paralegal", "Paralegal", "legal", 1, "salary", 48_000,
  "The research nobody else has time for.", prefers="university", demand=52)
J("job.legal.researcher", "Legal researcher", "legal", 1, "salary", 46_000,
  "Case law, and a deadline tomorrow.", prefers="university", demand=50)
J("job.legal.associate", "Associate attorney", "legal", 2, "professional", 92_000,
  "Billable hours, watched the whole time.", requires="postgraduate", demand=64, license="lic.jd")
J("job.legal.senior", "Senior associate", "legal", 3, "professional", 138_000,
  "Your name on the brief now.", requires="postgraduate", demand=70, license="lic.jd")
J("job.legal.partner", "Partner", "legal", 4, "performance", 220_000,
  "Some of the firm's name is yours now.", spread=0.9, requires="postgraduate", demand=78, license="lic.jd")

# ---------------------------------------------------------------------------
# Medicine — new in 0403. `care` is nursing and support work; this ladder is
# doctors, and it is gated on `postgraduate` from the rung where the license
# actually starts, same principle 0210b used everywhere else.
# ---------------------------------------------------------------------------
J("job.medicine.scribe", "Medical scribe", "medicine", 0, "salary", 32_000,
  "Every word the doctor says, typed live.", demand=50)
J("job.medicine.assistant", "Medical assistant", "medicine", 0, "salary", 33_000,
  "Vitals, charts, and the waiting room.", demand=48)
J("job.medicine.phlebotomist", "Phlebotomist", "medicine", 0, "salary", 34_000,
  "Blood draws, all day, steady hands.", demand=52)
J("job.medicine.pa", "Physician assistant", "medicine", 1, "professional", 82_000,
  "Diagnosing and prescribing, supervised.", requires="university", demand=64)
J("job.medicine.clinical", "Clinical coordinator", "medicine", 1, "professional", 75_000,
  "Every schedule, every referral.", requires="university", demand=58)
J("job.medicine.physician", "Physician", "medicine", 2, "professional", 195_000,
  "Diagnoses, and the weight of it.", requires="postgraduate", demand=78, license="lic.md")
J("job.medicine.attending", "Attending physician", "medicine", 3, "professional", 245_000,
  "Residents ask you when it matters.", requires="postgraduate", demand=82, license="lic.md")
J("job.medicine.chief", "Department chief", "medicine", 4, "management", 295_000,
  "The whole department answers to you.", requires="postgraduate", demand=88, license="lic.md")

# ---------------------------------------------------------------------------
# Hospitality — new in 0403. Front-of-house service work, `management`-heavy
# at the top the way a hotel actually runs.
# ---------------------------------------------------------------------------
J("job.hospitality.frontdesk", "Front desk agent", "hospitality", 0, "salary", 27_000,
  "Check-ins, complaints, and a smile.", demand=40)
J("job.hospitality.housekeeping", "Housekeeping lead", "hospitality", 0, "salary", 29_000,
  "Every room, checked, before checkout.", demand=44)
J("job.hospitality.nightauditor", "Night auditor", "hospitality", 1, "salary", 33_000,
  "The books, and the lobby, at 3am.", demand=42)
J("job.hospitality.concierge", "Concierge", "hospitality", 1, "salary", 35_000,
  "Reservations, and a few miracles.", prefers="highSchool", demand=46)
J("job.hospitality.guestservices", "Guest services agent", "hospitality", 1, "salary", 34_000,
  "Complaints, upgrades, calm voice.", demand=44)
J("job.hospitality.supervisor", "Hotel supervisor", "hospitality", 2, "management", 47_000,
  "Every shift, and every complaint.", demand=52)
J("job.hospitality.agm", "Asst. general manager", "hospitality", 3, "management", 68_000,
  "Everything the GM doesn't get to.", demand=60)
J("job.hospitality.gm", "General manager", "hospitality", 4, "management", 98_000,
  "The whole property, and every review.", demand=72)



# ---------------------------------------------------------------------------
# Veterinary — Ticket 0406.
#
# SHORT AND EXPENSIVE AT THE TOP, the same shape 0403 gave medicine and legal
# for the same reason: nobody backs into being a veterinarian. The bottom two
# rungs are genuinely open — a kennel assistant needs nothing — and then the
# license is a wall, because it is one.
# ---------------------------------------------------------------------------
J("job.veterinary.kennel", "Kennel assistant", "veterinary", 0, "salary", 26_000,
  "Runs, feeds, and the hose afterwards.", demand=34)
J("job.veterinary.assistant", "Veterinary assistant", "veterinary", 0, "salary", 30_000,
  "Holding still animals that won't be.", demand=38)
J("job.veterinary.tech", "Veterinary technician", "veterinary", 1, "professional", 44_000,
  "Anaesthesia, bloods, and the hard calls.", requires="university", demand=52)
J("job.veterinary.vet", "Veterinarian", "veterinary", 2, "professional", 118_000,
  "Somebody's whole family, on the table.", requires="postgraduate", license="lic.dvm", demand=74)
J("job.veterinary.surgeon", "Veterinary surgeon", "veterinary", 3, "professional", 165_000,
  "The referrals nobody else will take.", requires="postgraduate", license="lic.dvm", demand=80)
J("job.veterinary.owner", "Practice owner", "veterinary", 4, "performance", 205_000,
  "The practice, the staff, and the lease.", spread=0.8, requires="postgraduate",
  license="lic.dvm", demand=84)

# ---------------------------------------------------------------------------
# Dental — Ticket 0406.
#
# The hygienist rung is the interesting one: it pays well, it needs a LICENCE
# and no degree, and it is the clearest answer in the catalogue to "what is
# trade school actually for".
# ---------------------------------------------------------------------------
J("job.dental.reception", "Dental receptionist", "dental", 0, "salary", 30_000,
  "The diary, and everybody who is late.", demand=36)
J("job.dental.assistant", "Dental assistant", "dental", 0, "salary", 39_000,
  "Suction, trays, and steady nerves.", demand=42)
J("job.dental.hygienist", "Dental hygienist", "dental", 1, "professional", 74_000,
  "Good pay. Nobody is glad to see you.", license="lic.hygiene", demand=62)
J("job.dental.dentist", "Dentist", "dental", 2, "professional", 155_000,
  "Small margins, in somebody's mouth.", requires="postgraduate", license="lic.dds", demand=76)
J("job.dental.ortho", "Orthodontist", "dental", 3, "professional", 225_000,
  "Years of it, a fraction at a time.", requires="postgraduate", license="lic.dds", demand=80)
J("job.dental.owner", "Practice owner", "dental", 4, "performance", 280_000,
  "Six chairs and a payroll.", spread=0.8, requires="postgraduate", license="lic.dds", demand=84)

# ---------------------------------------------------------------------------
# Pharmacy — Ticket 0406.
# ---------------------------------------------------------------------------
J("job.pharmacy.clerk", "Pharmacy clerk", "pharmacy", 0, "salary", 28_000,
  "The till, and the line behind it.", demand=36)
J("job.pharmacy.tech", "Pharmacy technician", "pharmacy", 1, "salary", 45_000,
  "Counting, checking, counting again.", license="lic.pharmtech", demand=50)
J("job.pharmacy.pharmacist", "Pharmacist", "pharmacy", 2, "professional", 128_000,
  "The last person who checks.", requires="postgraduate", license="lic.pharmd", demand=70)
J("job.pharmacy.manager", "Pharmacy manager", "pharmacy", 3, "management", 152_000,
  "The rota, the stock, and the inspection.", requires="postgraduate",
  license="lic.pharmd", demand=78)
J("job.pharmacy.director", "Director of pharmacy", "pharmacy", 4, "management", 188_000,
  "Every dispensary in the system.", requires="postgraduate", license="lic.pharmd", demand=84)

# ---------------------------------------------------------------------------
# Architecture — Ticket 0406.
# ---------------------------------------------------------------------------
J("job.architecture.drafter", "Architectural drafter", "architecture", 0, "salary", 44_000,
  "Somebody else's lines, drawn properly.", demand=42)
J("job.architecture.designer", "Junior designer", "architecture", 1, "professional", 58_000,
  "Models, and competitions nobody wins.", requires="university", demand=54)
J("job.architecture.architect", "Architect", "architecture", 2, "professional", 92_000,
  "Your name on the drawings at last.", requires="postgraduate",
  license="lic.architect", demand=68)
J("job.architecture.project", "Project architect", "architecture", 3, "professional", 128_000,
  "The site, the client, and the budget.", requires="postgraduate",
  license="lic.architect", demand=76)
J("job.architecture.principal", "Principal", "architecture", 4, "performance", 185_000,
  "The practice, and whose work it is.", spread=0.8, requires="postgraduate",
  license="lic.architect", demand=82)


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
        if job["requires"] not in LEVELS:
            problems.append(f"{jid}: unknown requires {job['requires']!r}")
        if job["prefers"] not in LEVELS:
            problems.append(f"{jid}: unknown prefers {job['prefers']!r}")
        if LEVEL_ORDER.index(job["prefers"]) > LEVEL_ORDER.index(job["requires"]) and job["requires"] != "none":
            problems.append(f"{jid}: prefers more than it requires, which is two rules for one thing")
        if job["pay"] <= 0:
            problems.append(f"{jid}: pay must be positive")
        if job["spread"] > 0 and job["template"] not in ("performance", "trade", "management"):
            problems.append(f"{jid}: only a performance-ish template should have a spread")
        if job["template"] == "performance" and job["spread"] <= 0:
            problems.append(
                f"{jid}: a performance job with no spread is a salary job wearing a hat "
                f"— spec 1394 asks these for wide outcome distributions"
            )
        if job.get("license") is not None and job["license"] not in LICENSES:
            problems.append(f"{jid}: unknown license {job['license']!r}")
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
    open_doors = [job for job in JOBS if job["rung"] == 0 and job["requires"] == "none" and job["prefers"] == "none"]
    if len(open_doors) < 5:
        problems.append(
            f"only {len(open_doors)} job(s) need neither experience nor a diploma — "
            f"a character who left school early has nowhere to start"
        )

    # 0210 asked for 25-50. 0403 grows that to spec 1699's 150-250 — the upper
    # bound is spec 1736's launch target (200-400), kept as a ceiling here so a
    # runaway generator run fails loudly rather than shipping four hundred rows
    # nobody measured reachability against.
    if not 100 <= len(JOBS) <= 260:
        problems.append(f"{len(JOBS)} jobs — spec 1699 asks for 150-250 in v0.04")

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
        print(f"  {track:<12} {len(jobs)} jobs   {pay}")
    doors = [job for job in JOBS if job["rung"] == 0 and job["requires"] == "none" and job["prefers"] == "none"]
    print(f"\n{len(doors)} way(s) in with no diploma and no experience")
    for level in LEVEL_ORDER:
        reachable = [
            job for job in JOBS
            if LEVEL_ORDER.index(job["requires"]) <= LEVEL_ORDER.index(level)
        ]
        top = max(job["pay"] for job in reachable)
        print(f"  with {level:<13} {len(reachable):>3} jobs reachable, best ${top // 1000}k")


if __name__ == "__main__":
    main()
