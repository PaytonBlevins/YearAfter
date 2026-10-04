#!/usr/bin/env python3
"""
Ticket 0204 — the extracurricular catalog.

Authoring source for `packages/content/data/activities.json`. Edit here, run it,
commit both.

This is the content half of the fix the product owner asked for: the shipped
0203 build put activities behind a pop-up that allowed exactly ONE pick, forever.
He rejected that — "I want to keep workload realistic" — so the menu is now a
menu, joining several is allowed, and what stops a character taking on too much
is `hoursPerWeek` against their capacity (packages/education/src/workload.ts),
not the UI refusing.

Every field earns its place:
  hoursPerWeek  the real constraint. Feeds the hidden workload model.
  cost          money, ALWAYS with a source line — an unexplained balance
                change was the other thing he called out.
  requires      age, school stage, wealth band, talent, or a stat floor.
  effects       what a year of it does.

Usage:  python3 scripts/generate-activities.py
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "packages" / "content" / "data" / "activities.json"

CATALOG_VERSION = 1

ACTIVITIES: list[dict] = []

STATS = {"happiness", "health", "smarts", "looks", "charisma", "willpower", "discipline"}
STAGES = {"elementary", "middle", "high", "adult"}
TALENTS = {"athletics", "acting", "music", "writing", "academics", "inventive", "crime"}
WEALTH = {"struggling", "modest", "comfortable", "affluent", "wealthy"}
KINDS = {"sport", "arts", "academic", "service", "social"}


def prune(mapping: dict) -> dict:
    return {k: v for k, v in mapping.items() if v not in (None, {}, [])}


def A(
    id: str,
    name: str,
    kind: str,
    hours: float,
    *,
    blurb: str,
    stages: list[str],
    age_min: int | None = None,
    age_max: int | None = None,
    annual_cost: int = 0,
    cost_source: str | None = None,
    wealth_any: list[str] | None = None,
    talents_any: list[str] | None = None,
    stat_at_least: dict | None = None,
    needs_parent: bool = False,
    tryout: str | None = None,
    tryout_stat: str | None = None,
    tryout_text: str | None = None,
    cut_text: str | None = None,
    effects: dict | None = None,
    join_text: str | None = None,
    leave_text: str | None = None,
    in_sentence: str | None = None,
) -> None:
    """
    One joinable activity. `hours` is the only thing that limits how MANY.

    `tryout` is a different thing entirely: some places you cannot simply decide
    to be in. Review, on the first version: "I was able to join the basketball
    team just by clicking on it. I should have to tryout for things like that."
    A tryout is an attempt that can fail, scored against `tryout_stat` and the
    relevant talent, and it can be attempted again the next school year.
    """
    ACTIVITIES.append(
        prune(
            {
                "id": id,
                "name": name,
                "kind": kind,
                "blurb": blurb,
                "hoursPerWeek": hours,
                # Money never moves without a sentence saying where it went.
                "annualCost": annual_cost or None,
                "costSource": cost_source,
                "requires": prune(
                    {
                        "stages": stages,
                        "ageMin": age_min,
                        "ageMax": age_max,
                        "wealthAny": wealth_any,
                        "talentsAny": talents_any,
                        "statAtLeast": stat_at_least,
                        # Late finishes need somebody able to collect you.
                        "needsParent": needs_parent or None,
                    }
                ),
                # Places you have to earn, not just decide on.
                "tryout": prune({"label": tryout, "stat": tryout_stat}) or None,
                "tryoutText": tryout_text,
                "cutText": cut_text,
                "effects": effects or {},
                "joinText": join_text,
                "leaveText": leave_text,
                # Ticket 0416: how it reads in the middle of a sentence, for the
                # lines an adult year writes ("another year of the choir").
                "inSentence": in_sentence,
            }
        )
    )


# =============================================================================
# Sports — the big hours, the real health gains, the real injuries.
# =============================================================================

A("act.cross-country", "Cross-Country", "sport", 6,
  blurb="Six miles before most people are awake.",
  stages=["middle", "high"],
  tryout="Try out", tryout_stat="health",
  tryout_text="Made the cross-country team. First practice was at six in the morning.",
  cut_text="Didn't make the cross-country squad by about ninety seconds.",
  effects={"health": 5, "discipline": 3, "willpower": 2},
  join_text="Joined the cross-country team. First practice was at six in the morning.",
  leave_text="Stopped running cross-country. Slept in for the first time since September.")

A("act.basketball", "Basketball", "sport", 8,
  blurb="Practice every night, games on Fridays.",
  stages=["middle", "high"], needs_parent=True,
  tryout="Try out", tryout_stat="health",
  tryout_text="Made the basketball team. Practice every night, games on Fridays.",
  cut_text="Cut from basketball on the second day. The list was on the gym door.",
  effects={"health": 4, "charisma": 3, "discipline": 2},
  join_text="Made the basketball team. Practice every night, games on Fridays.",
  leave_text="Turned in your basketball jersey.")

A("act.football", "Football", "sport", 10,
  blurb="Two-a-days in August. Everyone knows you by October.",
  stages=["high"], needs_parent=True,
  tryout="Try out", tryout_stat="health",
  tryout_text="Made the football team. Two-a-days started in August.",
  cut_text="Cut from football. The coach said to come back a stone heavier.",
  effects={"health": 3, "charisma": 5, "willpower": 3},
  join_text="Made the football team. Two-a-days started in August.",
  leave_text="Quit football. The coach didn't take it well.")

A("act.swimming", "Swim Team", "sport", 7,
  blurb="Chlorine in everything you own.",
  stages=["elementary", "middle", "high"],
  annual_cost=180, cost_source="swim team fees and a season of goggles",
  wealth_any=["modest", "comfortable", "affluent", "wealthy"],
  tryout="Try out", tryout_stat="health",
  tryout_text="Made the swim team. Everything you own smells like chlorine now.",
  cut_text="Missed the swim team's qualifying time by four seconds.",
  effects={"health": 6, "discipline": 3},
  join_text="Joined the swim team. Everything you own smells like chlorine now.",
  leave_text="Left the swim team.")

A("act.soccer", "Soccer", "sport", 6,
  blurb="Saturday mornings, every Saturday, all year.",
  stages=["elementary", "middle", "high"], needs_parent=True,
  annual_cost=95, cost_source="league registration and a pair of cleats",
  tryout="Try out", tryout_stat="health",
  tryout_text="Made the soccer team. Games are Saturday mornings, every Saturday.",
  cut_text="Didn't make the soccer team. Somebody's dad read the list out.",
  effects={"health": 5, "charisma": 2},
  join_text="Signed up for soccer. Games are Saturday mornings, every Saturday.",
  leave_text="Stopped playing soccer.")

A("act.wrestling", "Wrestling", "sport", 9,
  blurb="Cutting weight is a normal Tuesday.",
  stages=["high"],
  tryout="Try out", tryout_stat="health",
  tryout_text="Made the wrestling team. Cutting weight turned out to be most of it.",
  cut_text="Didn't make weight for wrestling, and that was that.",
  effects={"health": 2, "willpower": 6, "discipline": 4},
  join_text="Joined the wrestling team. Cutting weight turned out to be most of it.",
  leave_text="Quit wrestling and ate an entire pizza.")

A("act.track", "Track & Field", "sport", 6,
  blurb="Spring season. Bus rides and a stopwatch.",
  stages=["middle", "high"],
  tryout="Try out", tryout_stat="health",
  tryout_text="Made the track team. Spring meets, long bus rides, one stopwatch.",
  cut_text="Didn't make the track team. The times were posted in the hallway.",
  effects={"health": 4, "discipline": 2, "willpower": 2},
  join_text="Went out for track. Spring meets, long bus rides, one stopwatch.",
  leave_text="Left the track team.")

# =============================================================================
# Arts
# =============================================================================

A("act.band", "Marching Band", "arts", 9,
  blurb="Field practice in full uniform in September heat.",
  stages=["middle", "high"], needs_parent=True,
  annual_cost=216, cost_source="a rented clarinet at $18 a month",
  wealth_any=["modest", "comfortable", "affluent", "wealthy"],
  effects={"discipline": 4, "charisma": 2, "smarts": 2},
  join_text="Joined marching band. Mom rented an instrument at $18 a month.",
  leave_text="Turned in the rented instrument and quit band.")

A("act.school-play", "School Play", "arts", 8,
  blurb="Six quiet weeks, then three of everything at once.",
  stages=["elementary", "middle", "high"], needs_parent=True,
  tryout="Audition", tryout_stat="charisma",
  tryout_text="Got cast in the school play. Rehearsals run late through opening night.",
  cut_text="Auditioned for the school play and got a thank-you and a closed door.",
  effects={"charisma": 5, "happiness": 3},
  join_text="Got cast in the school play. Rehearsals run late through opening night.",
  leave_text="Dropped out of the school play.")

A("act.choir", "Choir", "arts", 4,
  blurb="Two concerts a year and a lot of standing on risers.",
  stages=["elementary", "middle", "high"],
  effects={"charisma": 3, "happiness": 2},
  join_text="Joined choir. Two concerts a year and a great deal of standing on risers.",
  leave_text="Left choir.")

A("act.art-club", "Art Club", "arts", 3,
  blurb="Turpentine, and nobody hurrying you along.",
  stages=["middle", "high"],
  effects={"happiness": 4, "smarts": 1},
  join_text="Joined art club. Thursdays in a room that smells like turpentine.",
  leave_text="Stopped going to art club.")

A("act.jazz-band", "Jazz Band", "arts", 6,
  blurb="Before school, for people who already play.",
  stages=["high"], talents_any=["music"],
  tryout="Audition", tryout_stat="discipline",
  tryout_text="Got into jazz band. Rehearsals before school, twice a week.",
  cut_text="Auditioned for jazz band and was asked to try again next year.",
  effects={"discipline": 3, "charisma": 3, "happiness": 3},
  join_text="Got into jazz band. Rehearsals before school, twice a week.",
  leave_text="Left jazz band.")

# =============================================================================
# Academic
# =============================================================================

A("act.chess", "Chess Club", "academic", 2,
  blurb="Two hours a week and a slow, permanent improvement.",
  stages=["elementary", "middle", "high"],
  effects={"smarts": 4, "discipline": 1},
  join_text="Joined chess club. Two hours a week in the library.",
  leave_text="Stopped going to chess club.")

A("act.science-olympiad", "Science Olympiad", "academic", 5,
  blurb="Regionals in March. Somebody's dad drives.",
  stages=["middle", "high"], stat_at_least={"smarts": 55},
  annual_cost=25, cost_source="Science Olympiad registration, covered by the booster club",
  effects={"smarts": 5, "discipline": 2},
  join_text="Joined Science Olympiad. Registration was $25 and the booster club paid it.",
  leave_text="Left Science Olympiad.")

A("act.debate", "Debate Team", "academic", 6,
  blurb="Weekend tournaments in other schools' cafeterias.",
  stages=["high"], stat_at_least={"charisma": 50},
  needs_parent=True,
  tryout="Try out", tryout_stat="charisma",
  tryout_text="Made the debate team. Tournaments are weekends, in other schools' cafeterias.",
  cut_text="Didn't make the debate team. You were told your rebuttals were thin.",
  effects={"charisma": 5, "smarts": 3, "willpower": 2},
  join_text="Joined the debate team. Tournaments are weekends, in other schools' cafeterias.",
  leave_text="Quit debate.")

A("act.robotics", "Robotics", "academic", 7,
  blurb="Solder, and a competition in April.",
  stages=["middle", "high"],
  annual_cost=140, cost_source="robotics team parts and entry fees",
  wealth_any=["modest", "comfortable", "affluent", "wealthy"],
  effects={"smarts": 5, "discipline": 3},
  join_text="Joined the robotics team. Every weekend in a room that smells like solder.",
  leave_text="Left the robotics team.")

A("act.math-team", "Math Team", "academic", 3,
  blurb="Before school. Nobody knows it exists.",
  stages=["middle", "high"], stat_at_least={"smarts": 60},
  effects={"smarts": 4},
  join_text="Joined the math team. Meets before school; nobody else knows it exists.",
  leave_text="Left the math team.")

# =============================================================================
# Service and social
# =============================================================================

A("act.yearbook", "Yearbook", "service", 4,
  blurb="Deadlines in February that nobody warned you about.",
  stages=["middle", "high"],
  effects={"discipline": 3, "charisma": 2},
  join_text="Joined yearbook staff. The February deadline is the whole year.",
  leave_text="Left the yearbook staff.")

A("act.student-council", "Student Council", "social", 4,
  blurb="You have to be elected. You can lose.",
  stages=["middle", "high"], stat_at_least={"charisma": 58},
  tryout="Run for it", tryout_stat="charisma",
  tryout_text="Won a seat on student council by eleven votes.",
  cut_text="Ran for student council and lost. The posters stayed up for a week.",
  effects={"charisma": 5, "discipline": 2},
  join_text="Won a seat on student council.",
  leave_text="Left student council.")

A("act.newspaper", "School Paper", "service", 5,
  blurb="A deadline every two weeks, forever.",
  stages=["high"],
  effects={"smarts": 3, "discipline": 4, "charisma": 1},
  join_text="Joined the school paper. A deadline every two weeks, forever.",
  leave_text="Left the school paper.")

A("act.volunteering", "Volunteering", "service", 4,
  blurb="Saturday mornings at the food bank.",
  stages=["middle", "high"],
  effects={"happiness": 4, "charisma": 2, "discipline": 2},
  join_text="Started volunteering Saturday mornings at the food bank.",
  leave_text="Stopped volunteering.")

A("act.scouts", "Scouts", "social", 5,
  blurb="Camping trips and a shirt covered in patches.",
  stages=["elementary", "middle"], needs_parent=True,
  annual_cost=70, cost_source="scout dues and a uniform shirt",
  effects={"health": 3, "discipline": 3, "happiness": 2},
  join_text="Joined scouts. Dues were $70 and the shirt came covered in space for patches.",
  leave_text="Left scouts.")

A("act.drama-club", "Drama Club", "arts", 4,
  blurb="Improv games in a carpeted room, twice a week.",
  stages=["middle", "high"],
  effects={"charisma": 4, "happiness": 3},
  join_text="Joined drama club. Improv games in a carpeted room, twice a week.",
  leave_text="Left drama club.")

A("act.reading-club", "Reading Club", "academic", 2,
  blurb="Tuesdays in the library, one box of paperbacks.",
  stages=["elementary", "middle"],
  effects={"smarts": 4, "happiness": 2},
  join_text="Joined the reading club. Tuesdays in the library, one box of donated paperbacks.",
  leave_text="Stopped going to the reading club.")

A("act.gsa", "Community Club", "social", 2,
  blurb="A room at lunch, no explaining required.",
  stages=["middle", "high"],
  effects={"happiness": 4, "charisma": 2},
  join_text="Started going to the club that meets at lunch. Easiest room in the building.",
  leave_text="Stopped going to the lunchtime club.")



# =============================================================================
# After school — Ticket 0416.
#
# Every activity above ends at graduation, and before this ticket nothing began
# after it: `education.activities` was emptied the year a character left school
# and could never be filled again, so an adult had work and the street and no
# third place to be. The social generator has had a door labelled "something
# you still do" since 0210, wired to that list, and it had never once opened
# for anybody over eighteen.
#
# Deliberately ordinary. A Sunday league, a choir in a church hall, an evening
# class — the things people actually take up, and put down again. Nothing here
# is a career (v0.07 and v0.08 are), and the gym, meditation and martial arts
# are Mind & Body's by the spec (1355), so they are not here either.
#
# `effects` is a PROFILE for adults, not a yearly payment. A school activity is
# held for four years at most; a pursuit can be held for forty, and forty years
# of a flat +3 is the equalising machine 0408 and 0411 both had to take apart.
# What an adult pursuit does to a person is decided in `shaping.ts`, banded and
# two-sided, and reads this only to know WHICH stat it builds.
# =============================================================================

A("act.adult.rec-league", "Rec League", "sport", 3,
  blurb="A Sunday league. Somebody always brings oranges.",
  stages=["adult"], age_min=18, in_sentence="the rec league",
  annual_cost=150, cost_source="rec league fees",
  effects={"health": 3, "charisma": 2, "happiness": 3},
  join_text="Signed up for a Sunday rec league. The shirts have a plumber's name on them.",
  leave_text="Stopped turning up to the rec league. Somebody else got your shirt.")

A("act.adult.running-club", "Running Club", "sport", 3,
  blurb="Tuesday nights, and a long one on Sundays.",
  stages=["adult"], age_min=18, in_sentence="running club",
  effects={"health": 4, "willpower": 2, "discipline": 2},
  join_text="Joined a running club. Friendlier than you expected, and faster.",
  leave_text="Stopped going to running club. The shoes are still by the door.")

A("act.adult.choir", "Community Choir", "arts", 2,
  blurb="Tuesdays in a church hall. Nobody checks.",
  stages=["adult"], age_min=18, in_sentence="the choir",
  effects={"happiness": 4, "charisma": 2},
  join_text="Joined a community choir. They put you wherever they were short.",
  leave_text="Left the choir. You still sing the harmony in the car.")

A("act.adult.theater", "Community Theater", "arts", 5,
  blurb="Two shows a year and a set nobody finishes.",
  stages=["adult"], age_min=18, in_sentence="the theater",
  tryout="Audition", tryout_stat="charisma",
  tryout_text="Got a part in the community theater's spring show. A real one, with lines.",
  cut_text="Auditioned for the community theater and got a very kind email.",
  effects={"charisma": 4, "happiness": 3, "willpower": 1},
  join_text="Got a part in the community theater's spring show. A real one, with lines.",
  leave_text="Stepped back from the theater. They still email you about the raffle.")

A("act.adult.band", "Band", "arts", 3,
  blurb="Four people, one garage, almost no gigs.",
  stages=["adult"], age_min=18, in_sentence="the band",
  effects={"happiness": 4, "charisma": 2, "discipline": 1},
  join_text="Started playing in a band with some people you half knew. You aren't good.",
  leave_text="The band stopped. Nobody said so; the garage just filled up with bikes.")

A("act.adult.night-class", "Evening Class", "academic", 3,
  blurb="One night a week at the community college.",
  stages=["adult"], age_min=18, in_sentence="the evening class",
  annual_cost=450, cost_source="evening class fees",
  effects={"smarts": 3, "discipline": 2},
  join_text="Signed up for an evening class. Everybody in it was there for a different reason.",
  leave_text="Finished the evening class and didn't sign up for the next one.")

A("act.adult.book-club", "Book Club", "academic", 1,
  blurb="One book a month, mostly read.",
  stages=["adult"], age_min=18, in_sentence="book club",
  effects={"smarts": 2, "happiness": 2},
  join_text="Joined a book club. About half of them finish the book.",
  leave_text="Quietly stopped going to book club.")

A("act.adult.quiz-team", "Quiz Team", "social", 2,
  blurb="Tuesday trivia at a bar, the same four people.",
  stages=["adult"], age_min=18, in_sentence="the quiz team",
  effects={"charisma": 2, "smarts": 1, "happiness": 3},
  join_text="Got talked into a quiz team. You turned out to be the one who knows rivers.",
  leave_text="The quiz team broke up. Nobody knows who has the trophy.")

A("act.adult.volunteering", "Volunteering", "service", 3,
  blurb="A food bank, Saturday mornings.",
  stages=["adult"], age_min=18, in_sentence="volunteering",
  effects={"happiness": 3, "willpower": 2, "charisma": 1},
  join_text="Started volunteering at the food bank on Saturday mornings.",
  leave_text="Stopped volunteering at the food bank. You still drive past it.")

A("act.adult.garden", "Community Garden", "service", 2,
  blurb="A plot, a hose, and opinions about tomatoes.",
  stages=["adult"], age_min=18, in_sentence="the garden plot",
  annual_cost=60, cost_source="a plot at the community garden",
  effects={"happiness": 3, "discipline": 1},
  join_text="Took a plot at the community garden. The man next door has thoughts.",
  leave_text="Gave up the garden plot. Somebody on the waiting list was thrilled.")

# =============================================================================
# Self-checks
# =============================================================================


def check() -> None:
    problems: list[str] = []
    ids = [a["id"] for a in ACTIVITIES]
    for aid, count in Counter(ids).items():
        if count > 1:
            problems.append(f"duplicate activity id {aid!r}")

    for a in ACTIVITIES:
        aid = a["id"]
        if a["kind"] not in KINDS:
            problems.append(f"{aid}: unknown kind {a['kind']!r}")
        if not (0 < a["hoursPerWeek"] <= 12):
            problems.append(f"{aid}: hoursPerWeek {a['hoursPerWeek']} is outside 0-12")
        tryout = a.get("tryout")
        if tryout:
            if tryout.get("stat") not in STATS:
                problems.append(f"{aid}: tryout scores against unknown stat {tryout.get('stat')!r}")
            if not a.get("tryoutText") or not a.get("cutText"):
                problems.append(f"{aid}: a tryout needs both a made-it and a cut line")
        for field in ("tryoutText", "cutText"):
            text = a.get(field)
            if text and text.strip()[-1] not in ".!?":
                problems.append(f"{aid}: {field} is unpunctuated")

        # Rule 4, structurally: money never moves without a named source.
        if a.get("annualCost") and not a.get("costSource"):
            problems.append(f"{aid}: costs money but does not say where it goes")
        if a.get("costSource") and not a.get("annualCost"):
            problems.append(f"{aid}: names a cost source but costs nothing")
        for key in a["effects"]:
            if key not in STATS:
                problems.append(f"{aid}: unknown stat {key!r} in effects")
        if not a["effects"]:
            problems.append(f"{aid}: does nothing")
        req = a.get("requires", {})
        for stage in req.get("stages", []):
            if stage not in STAGES:
                problems.append(f"{aid}: unknown stage {stage!r}")
        for band in req.get("wealthAny", []):
            if band not in WEALTH:
                problems.append(f"{aid}: unknown wealth band {band!r}")
        for talent in req.get("talentsAny", []):
            if talent not in TALENTS:
                problems.append(f"{aid}: unknown talent {talent!r}")
        for key in req.get("statAtLeast", {}):
            if key not in STATS:
                problems.append(f"{aid}: unknown stat {key!r} in statAtLeast")
        for field in ("joinText", "leaveText", "blurb"):
            text = a.get(field, "")
            if not text or text.strip()[-1] not in ".!?":
                problems.append(f"{aid}: {field} is missing or unpunctuated")
        # One line on a 390pt phone. Longer blurbs truncate mid-word, which
        # review caught in a screenshot rather than in any test.
        if len(a.get("blurb", "")) > 52:
            problems.append(f"{aid}: blurb is {len(a['blurb'])} chars; it truncates past 52")

    # Ticket 0416. An adult pursuit is paid for by the adult, out of their own
    # cash, and nobody has to drive them home — so the two gates that read a
    # PARENT'S household mean nothing here and would silently read the wrong one.
    for a in ACTIVITIES:
        stages = a.get("requires", {}).get("stages", [])
        if "adult" in stages:
            req = a["requires"]
            if len(stages) != 1:
                problems.append(f"{a['id']}: an adult pursuit cannot also be a school activity")
            if req.get("ageMin", 0) < 18:
                problems.append(f"{a['id']}: an adult pursuit needs age_min of at least 18")
            if not a.get("inSentence"):
                problems.append(f"{a['id']}: an adult pursuit needs in_sentence for the lines it writes")
            if req.get("needsParent") or req.get("wealthAny"):
                problems.append(f"{a['id']}: an adult pursuit cannot read a parent's household")

    # Every stage needs enough choice that the menu is worth opening, and
    # enough cheap low-hour options that a struggling household is not shut out.
    for stage in sorted(STAGES):
        available = [a for a in ACTIVITIES if stage in a.get("requires", {}).get("stages", [])]
        if len(available) < 6:
            problems.append(f"stage {stage}: only {len(available)} activities (need 6)")
        free = [
            a
            for a in available
            if not a.get("annualCost") and not a.get("requires", {}).get("wealthAny")
        ]
        if len(free) < 4:
            problems.append(f"stage {stage}: only {len(free)} activities cost nothing (need 4)")

    if problems:
        print(f"\n{len(problems)} problem(s) in the activity catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def report() -> None:
    print(f"{len(ACTIVITIES)} activities")
    print("  by kind:  " + ", ".join(f"{k} {v}" for k, v in sorted(Counter(a["kind"] for a in ACTIVITIES).items())))
    earned = [a["id"] for a in ACTIVITIES if a.get("tryout")]
    print(f"  {len(earned)} need a tryout, {len(ACTIVITIES) - len(earned)} are open sign-ups")
    for stage in ("elementary", "middle", "high", "adult"):
        available = [a for a in ACTIVITIES if stage in a["requires"]["stages"]]
        hours = sum(a["hoursPerWeek"] for a in available)
        print(f"  {stage:<11} {len(available):>2} available, {hours:>5.1f} h/wk if you joined every one")


def main() -> None:
    # Check, WRITE, then report — see the note in generate-events.py.
    check()
    OUT_PATH.write_text(
        json.dumps({"version": CATALOG_VERSION, "entries": ACTIVITIES}, indent=2, ensure_ascii=False)
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    report()


if __name__ == "__main__":
    main()
