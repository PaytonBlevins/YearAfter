#!/usr/bin/env python3
"""
Ticket 0203 — childhood event library.

This file is the authoring source for `packages/content/data/events-childhood.json`.
Edit here, run it, commit both. Writing 300+ events straight into JSON would be
unreviewable; here an event is one readable call, and the self-checks at the
bottom catch the mistakes that a catalog of this size makes inevitable —
duplicate ids, unreachable age windows, tokens the eligibility does not
guarantee, decisions with one button, thin coverage at a particular age.

Spec 725-770 is the contract:
  - four event types: passive timeline, decision, opportunity, consequence
  - each record carries id, category, eligibility, base weight, modifiers,
    cooldown, text variants, choices, consequences, follow-ups
  - a typical year holds several passive developments and 0-3 decisions
  - concise and conversational; light events can be funny, serious ones are
    respectful

Product owner override (recorded here because it contradicts the spec line):
the spec asks for "roughly 75-150 approved events"; the approved target for this
ticket is 250-500. See the assertion in `check()`.

Text tokens available, all resolved in packages/events/src/text.ts:
  {me} {mother} {father} {parent} {parents} {sibling} {siblingRel}
  {olderSibling} {city} {kid} {kid2} {adult} {they} {them} {their}
  {motherName} {fatherName}

{mother} and {father} render as "Mom" and "Dad" — what a child actually calls
them. Review: "90% of kids do not [use first names]. It's mom, mother, dad."
Use {motherName}/{fatherName} only where a child genuinely would say the name.

A token naming a person MUST be guaranteed by the event's own eligibility —
`{mother}` needs requires=["mother"], `{sibling}` needs requires=["sibling"].
The checker enforces it.

Usage:  python3 scripts/generate-events.py
"""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "packages" / "content" / "data" / "events-childhood.json"

CATALOG_VERSION = 1

EVENTS: list[dict] = []

TALENTS = {"athletics", "acting", "music", "writing", "academics", "inventive", "crime"}
STATS = {
    "happiness",
    "health",
    "smarts",
    "looks",
    "charisma",
    "willpower",
    "discipline",
}
CATEGORIES = {"family", "school", "friendship", "random", "talent"}
RARITIES = {"common", "uncommon", "rare", "veryRare", "exceptional", "legendary"}
REQUIREMENTS = {
    "mother",
    "father",
    "anyParent",
    "bothParents",
    "singleParent",
    "sibling",
    "siblings2",
    "olderSibling",
    "onlyChild",
}
WEALTH = {"struggling", "modest", "comfortable", "affluent", "wealthy"}
SCHOOL_STAGES = {"preschool", "elementary", "middle", "high", "graduated", "droppedOut"}
# Screens a choice may open. The engine treats `opens` as opaque; this is the
# list the app actually knows how to navigate to.
OPENABLE = {"activities"}

# Which family requirement each person-token needs before it may be used.
# `kid`, `kid2` and `adult` are incidental people the engine invents, so they
# need no eligibility guarantee — but a DECISION must declare them in
# `person_tokens` so the same person is named in the prompt and the outcome.
INCIDENTAL_TOKENS = {"kid", "kid2", "adult"}

# An incidental person's own pronouns, and who each one belongs to.
#
# Review found "You told Lucía exactly what you thought of him." The copy had
# been written with a bare "him" on the assumption that incidental people are
# genderless — but their names come from the culture's male AND female lists, so
# half the time the line misgendered the person it had just named. A pronoun for
# one of these people now has to be a token, so it can be resolved from the
# name that was actually drawn.
PERSON_OF = {token: token for token in INCIDENTAL_TOKENS}
for _person in ("kid", "kid2", "adult"):
    for _case in ("They", "Them", "Their"):
        PERSON_OF[f"{_person}{_case}"] = _person

# Bare gendered pronouns. Fine in a line about Mom; wrong in a line about a
# person whose name the engine drew, which is what this rule covers.
BARE_PRONOUN_RE = re.compile(r"\b(he|him|his|she|her|hers)\b", re.IGNORECASE)


def norm_token(token: str) -> str:
    """
    A token capitalised is the same token at the start of a sentence.

    "{KidThey} did not deny any of it." The renderer capitalises the resolved
    value; every checker here compares the lowered form, so copy never has to
    choose between a correct pronoun and a correct capital letter.
    """
    return token[:1].lower() + token[1:]

TOKEN_GUARDS = {
    "mother": {"mother", "bothParents"},
    "father": {"father", "bothParents"},
    "motherName": {"mother", "bothParents"},
    "fatherName": {"father", "bothParents"},
    "parent": {"mother", "father", "anyParent", "bothParents", "singleParent"},
    "parents": {"bothParents"},
    "sibling": {"sibling", "siblings2", "olderSibling"},
    "siblingRel": {"sibling", "siblings2", "olderSibling"},
    "olderSibling": {"olderSibling"},
}
FREE_TOKENS = {"me", "city", "they", "them", "their"} | set(PERSON_OF)


def prune(mapping: dict) -> dict:
    return {key: value for key, value in mapping.items() if value not in (None, {}, [])}


def CASH(delta: int, source: str) -> dict:
    """
    Money moving, and where it came from.

    The source is not optional and never can be. A bare number was the original
    shape and it produced exactly the bug the product owner reported: cash
    arriving with no explanation anywhere in the feed. The checker additionally
    requires the player-visible text to name the amount, so the audit trail
    lives in the prose rather than in a field nobody reads.
    """
    if delta == 0:
        raise ValueError("CASH with a delta of zero is not a thing that happened")
    if not source or not source.strip():
        raise ValueError(f"CASH({delta}) needs a source phrase")
    return {"delta": delta, "source": source}


def FX(
    stats: dict | None = None,
    relationship: dict | None = None,
    cash: dict | None = None,
    behaviour: int | None = None,
    stress: int | None = None,
    set_flags: list[str] | None = None,
    clear_flags: list[str] | None = None,
) -> dict:
    """
    An event's consequences. `cash` must come from CASH().

    `stress` is Ticket 0205's content hook. Positive for a year that kept
    happening at the character; NEGATIVE for the things that genuinely help — a
    long summer, a grandparent's house, a week with the power out. Both
    directions are required, or stress is a ratchet and every character ends
    childhood pinned at the top of it.
    """
    if cash is not None and not isinstance(cash, dict):
        raise TypeError("cash must be CASH(delta, source), not a bare number")
    return prune(
        {
            "stats": stats,
            "relationship": relationship,
            "cash": cash,
            "behaviour": behaviour,
            "stress": stress,
            "setFlags": set_flags,
            "clearFlags": clear_flags,
        }
    )


def COND(
    age_min: int | None = None,
    age_max: int | None = None,
    sex: str | None = None,
    school_stage_any: list[str] | None = None,
    activities_at_least: int | None = None,
    activities_at_most: int | None = None,
    requires: list[str] | None = None,
    talents_any: list[str] | None = None,
    talents_none: list[str] | None = None,
    wealth_any: list[str] | None = None,
    stat_at_least: dict | None = None,
    stat_at_most: dict | None = None,
    rel_at_least: dict | None = None,
    rel_at_most: dict | None = None,
    flags_all: list[str] | None = None,
    flags_none: list[str] | None = None,
) -> dict:
    return prune(
        {
            "ageMin": age_min,
            "ageMax": age_max,
            "sex": sex,
            "schoolStageAny": school_stage_any,
            "activitiesAtLeast": activities_at_least,
            "activitiesAtMost": activities_at_most,
            "requires": requires,
            "talentsAny": talents_any,
            "talentsNone": talents_none,
            "wealthAny": wealth_any,
            "statAtLeast": stat_at_least,
            "statAtMost": stat_at_most,
            "relationshipAtLeast": rel_at_least,
            "relationshipAtMost": rel_at_most,
            "flagsAll": flags_all,
            "flagsNone": flags_none,
        }
    )


def MOD(multiply: float, **condition) -> dict:
    return {"when": COND(**condition), "multiply": multiply}


def OUT(weight: int, text: str, effects: dict | None = None, follow_up: dict | None = None) -> dict:
    return prune({"weight": weight, "text": text, "effects": effects, "followUp": follow_up})


def C(
    id: str,
    label: str,
    text: str | None = None,
    opens: str | None = None,
    effects: dict | None = None,
    outcomes: list[dict] | None = None,
    follow_up: dict | None = None,
    requires: dict | None = None,
) -> dict:
    return prune(
        {
            "id": id,
            "label": label,
            "opens": opens,
            "text": text,
            "effects": effects,
            "outcomes": outcomes,
            "followUp": follow_up,
            "requires": requires,
        }
    )


def FOLLOW(event_id: str, in_years: int, chance: float | None = None) -> dict:
    return prune({"eventId": event_id, "inYears": in_years, "chance": chance})


def E(
    id: str,
    category: str,
    text: list[str],
    *,
    type: str = "passive",
    rarity: str = "common",
    weight: int = 10,
    cooldown: int | None = None,
    effects: dict | None = None,
    choices: list[dict] | None = None,
    modifiers: list[dict] | None = None,
    follow_up: dict | None = None,
    person_tokens: list[str] | None = None,
    binary_ok: bool = False,
    physical: bool = False,
    **condition,
) -> None:
    EVENTS.append(
        prune(
            {
                "id": id,
                "category": category,
                "type": type,
                "rarity": rarity,
                "eligibility": COND(**condition),
                # Declared so the engine can bind these people ONCE when the
                # decision is raised, and name the same person in the prompt and
                # in the outcome.
                "personTokens": person_tokens,
                "binaryOk": binary_ok or None,
                "physical": physical or None,
                "weight": weight,
                "modifiers": modifiers,
                "cooldown": cooldown,
                "text": text,
                "effects": effects,
                "choices": choices,
                "followUp": follow_up,
            }
        )
    )


def D(id: str, category: str, text: list[str], choices: list[dict], **kwargs) -> None:
    """A decision. Same record, different default type — most decisions repeat
    less often than passives, so they default to once per life."""
    kwargs.setdefault("type", "decision")
    E(id, category, text, choices=choices, **kwargs)


def O(id: str, category: str, text: list[str], choices: list[dict], **kwargs) -> None:
    """An opportunity: a decision the character could not have gone looking for."""
    kwargs.setdefault("type", "opportunity")
    kwargs.setdefault("rarity", "uncommon")
    E(id, category, text, choices=choices, **kwargs)


# =============================================================================
# FAMILY — the household from Ticket 0202 is what most of childhood is about.
# =============================================================================

# ---- infancy (0-2) ----------------------------------------------------------

E("family.inf.first-word", "family", [
    "Said a first word. Nobody agrees on which word it was.",
    "Produced a sound everyone decided was a word, and celebrated accordingly.",
], age_min=1, age_max=2, weight=14, effects=FX(stats={"smarts": 1}))

E("family.inf.first-word-mother", "family", [
    "First word: something close enough to {mother} that she is still telling people.",
], age_min=1, age_max=2, requires=["mother"], weight=10,
   effects=FX(stats={"smarts": 1}, relationship={"mother": 3}))

E("family.inf.first-word-father", "family", [
    "First word was some version of {father}, which he took as a verdict on the whole family.",
], age_min=1, age_max=2, requires=["father"], weight=8,
   effects=FX(stats={"smarts": 1}, relationship={"father": 3}))

E("family.inf.first-steps", "family", [
    "Walked. Immediately went somewhere nobody wanted you to go.",
    "Took a few steps, fell over, and looked around to see whether it counted.",
], age_min=1, age_max=2, weight=14, effects=FX(stats={"health": 1, "willpower": 1}))

E("family.inf.slept-through", "family", [
    "Slept through the night for the first time. The household treated it as a public holiday.",
], age_min=0, age_max=1, requires=["anyParent"], weight=12,
   effects=FX(stats={"health": 1}, relationship={"parents": 2}))

E("family.inf.colic", "family", [
    "Cried for three months straight for reasons that were never established.",
], age_min=0, age_max=1, requires=["anyParent"], weight=8, rarity="uncommon",
   effects=FX(stats={"health": -1}, relationship={"parents": -2}))

E("family.inf.photographed", "family", [
    "Photographed constantly. There is more documentation of this year than of most decades.",
], age_min=0, age_max=2, weight=10, effects=FX(stats={"happiness": 1}))

E("family.inf.sibling-jealous", "family", [
    "{sibling} was not consulted about your arrival and made that position clear.",
    "{sibling} asked, politely, when you were going back.",
], age_min=0, age_max=2, requires=["sibling"], weight=12,
   effects=FX(relationship={"siblings": -3}))

E("family.inf.sibling-guard", "family", [
    "{sibling} appointed themselves your personal security detail.",
], age_min=0, age_max=2, requires=["olderSibling"], weight=10,
   effects=FX(relationship={"siblings": 4}, stats={"happiness": 1}))

E("family.inf.grandparents", "family", [
    "Spent a lot of the year being handed between relatives like a casserole.",
], age_min=0, age_max=2, weight=10, effects=FX(stats={"charisma": 1, "happiness": 1}))

E("family.inf.teething", "family", [
    "Got teeth. Everybody suffered.",
], age_min=0, age_max=1, weight=10, effects=FX(stats={"health": -1}))

E("family.inf.favourite-toy", "family", [
    "Formed an unbreakable attachment to one specific object and would not be reasoned with.",
], age_min=1, age_max=3, weight=12, effects=FX(stats={"happiness": 2}))

E("family.inf.lost-toy", "family", [
    "The beloved object was lost in a parking lot. A replacement was purchased and immediately rejected.",
], age_min=1, age_max=4, weight=8, rarity="uncommon", effects=FX(stats={"happiness": -2, "willpower": 1}))

# ---- early childhood (3-6) --------------------------------------------------

E("family.ec.bedtime-story", "family", [
    "{mother} read the same book every night for a year and never once skipped a page.",
    "{mother} did the voices. All of them. Every night.",
], age_min=3, age_max=7, requires=["mother"], weight=12, cooldown=4,
   effects=FX(stats={"smarts": 2, "happiness": 1}, relationship={"mother": 2}))

E("family.ec.bedtime-story-dad", "family", [
    "{father} read the same book every night and started inventing extra chapters out of boredom.",
], age_min=3, age_max=7, requires=["father"], weight=10, cooldown=4,
   effects=FX(stats={"smarts": 2, "happiness": 1}, relationship={"father": 2}))

E("family.ec.fridge-drawing", "family", [
    "A drawing went on the fridge and stayed there long past its artistic peak.",
], age_min=3, age_max=8, requires=["anyParent"], weight=12, cooldown=3,
   effects=FX(stats={"happiness": 2}, relationship={"parents": 1}))

E("family.ec.why-phase", "family", [
    "Asked why about two hundred times a day. Roughly six of the answers held up.",
], age_min=3, age_max=5, requires=["anyParent"], weight=12,
   effects=FX(stats={"smarts": 2}, relationship={"parents": -1}))

E("family.ec.imaginary-friend", "family", [
    "Had an imaginary friend with strong opinions and a difficult name.",
    "Insisted a seat be left at dinner for someone nobody else could see.",
], age_min=3, age_max=7, weight=10, effects=FX(stats={"smarts": 1, "happiness": 2}))

E("family.ec.family-car-trip", "family", [
    "A long car trip. Somebody was sick, somebody cried, and it is remembered fondly anyway.",
], age_min=3, age_max=12, requires=["anyParent"], weight=12, cooldown=4,
   effects=FX(stats={"happiness": 2}, relationship={"family": 1}))

E("family.ec.kitchen-help", "family", [
    "Helped {mother} cook, in the sense of being handed the least dangerous task available.",
], age_min=4, age_max=10, requires=["mother"], weight=10, cooldown=3,
   effects=FX(stats={"discipline": 1, "happiness": 1}, relationship={"mother": 2}))

E("family.ec.garage-help", "family", [
    "Held the flashlight for {father} for two hours and pointed it in the wrong direction the whole time.",
], age_min=4, age_max=11, requires=["father"], weight=10, cooldown=3,
   effects=FX(stats={"smarts": 1}, relationship={"father": 2}),
   modifiers=[MOD(1.6, talents_any=["inventive"])])

E("family.ec.haircut-disaster", "family", [
    "Cut your own hair. The correction was worse than the crime.",
], age_min=3, age_max=8, weight=9, effects=FX(stats={"looks": -3, "happiness": -1}))

E("family.ec.wall-mural", "family", [
    "Decorated a wall in permanent marker. It was described as a phase.",
], age_min=3, age_max=6, requires=["anyParent"], weight=10,
   effects=FX(relationship={"parents": -2}, stats={"happiness": 1}))

E("family.ec.tantrum-supermarket", "family", [
    "Lay down on a supermarket floor over a principle nobody could later identify.",
], age_min=2, age_max=5, requires=["anyParent"], weight=10,
   effects=FX(relationship={"parents": -2}, stats={"willpower": 1}))

E("family.ec.parents-argue", "family", [
    "There was shouting downstairs that everyone pretended in the morning had not happened.",
], age_min=3, age_max=17, requires=["bothParents"], weight=9, cooldown=4, rarity="uncommon",
   effects=FX(stats={"happiness": -3}, relationship={"parents": -2}))

E("family.ec.parent-late-shifts", "family", [
    "{parent} worked late most of the year. Dinner was often a note on the counter.",
], age_min=4, age_max=16, requires=["singleParent"], weight=11, cooldown=4,
   wealth_any=["struggling", "modest"],
   effects=FX(stats={"happiness": -2, "discipline": 2}))

E("family.ec.hand-me-downs", "family", [
    "Everything you wore this year had belonged to {sibling} first.",
], age_min=3, age_max=13, requires=["olderSibling"], weight=10, cooldown=3,
   wealth_any=["struggling", "modest"],
   effects=FX(stats={"looks": -1, "willpower": 1}))

E("family.ec.new-house", "family", [
    "The family moved across {city} into a house with better light and a worse kitchen.",
], age_min=3, age_max=15, requires=["anyParent"], weight=8, cooldown=6, rarity="uncommon",
   wealth_any=["comfortable", "affluent", "wealthy"],
   effects=FX(stats={"happiness": 1}))

E("family.ec.moved-again", "family", [
    "Moved apartments again. You have learned not to unpack the second box.",
], age_min=3, age_max=16, requires=["anyParent"], weight=9, cooldown=3,
   wealth_any=["struggling"],
   effects=FX(stats={"happiness": -2, "willpower": 2}))

E("family.ec.big-birthday", "family", [
    "A birthday party with a bouncy castle, forty children and one exhausted adult.",
], age_min=4, age_max=11, requires=["anyParent"], weight=9, cooldown=5,
   wealth_any=["affluent", "wealthy"],
   effects=FX(stats={"happiness": 3, "charisma": 1}))

E("family.ec.small-birthday", "family", [
    "A birthday with a homemade cake, four guests and a great deal of effort behind it.",
], age_min=4, age_max=12, requires=["anyParent"], weight=10, cooldown=5,
   wealth_any=["struggling", "modest"],
   effects=FX(stats={"happiness": 2}, relationship={"parents": 2}))

E("family.ec.pet-arrives", "family", [
    "A dog arrived. It chose {sibling}, which was never fully accepted.",
], age_min=3, age_max=13, requires=["sibling"], weight=8, cooldown=8,
   effects=FX(stats={"happiness": 2}, relationship={"siblings": 1}))

E("family.ec.pet-arrives-solo", "family", [
    "A cat arrived and made it clear that you now lived in its house.",
], age_min=3, age_max=14, requires=["anyParent"], weight=8, cooldown=8,
   effects=FX(stats={"happiness": 3}))

E("family.ec.pet-dies", "family", [
    "The family pet died. It was explained gently and it did not help much.",
], age_min=5, age_max=17, weight=6, rarity="uncommon", flags_none=["pet.gone"],
   effects=FX(stats={"happiness": -4, "willpower": 2}, set_flags=["pet.gone"]))

# ---- middle childhood and teens (7-17) --------------------------------------

E("family.mc.chores-list", "family", [
    "A chore chart went up on the fridge. It was followed for eleven days.",
], age_min=6, age_max=14, requires=["anyParent"], weight=10, cooldown=4,
   effects=FX(stats={"discipline": 2}))

E("family.mc.allowance", "family", [
    "Started getting an allowance — $5 a week, tied loosely to work actually performed. $60 by Christmas.",
], age_min=7, age_max=14, requires=["anyParent"], weight=10, cooldown=4,
   wealth_any=["modest", "comfortable", "affluent", "wealthy"],
   effects=FX(cash=CASH(60, "a year of allowance"), stats={"discipline": 1}))

E("family.mc.sibling-war", "family", [
    "You and {sibling} conducted a border dispute over the back seat that lasted the whole year.",
    "You and {sibling} fought about everything, including which of you started it.",
], age_min=5, age_max=15, requires=["sibling"], weight=12, cooldown=3,
   effects=FX(relationship={"siblings": -3}, stats={"charisma": 1}))

E("family.mc.sibling-alliance", "family", [
    "You and {sibling} formed a temporary alliance against a shared parental injustice.",
], age_min=6, age_max=16, requires=["sibling"], weight=11, cooldown=3,
   effects=FX(relationship={"siblings": 4}, stats={"happiness": 1}))

E("family.mc.sibling-covered", "family", [
    "{sibling} took the blame for something that was entirely your fault, and never brought it up again.",
], age_min=7, age_max=17, requires=["sibling"], weight=8, rarity="uncommon",
   effects=FX(relationship={"siblings": 6}, stats={"happiness": 2}))

E("family.mc.grandparent-close", "family", [
    "Spent most weekends at a grandparent's house, being fed more than strictly necessary.",
], age_min=4, age_max=15, weight=11, cooldown=4,
   effects=FX(stats={"happiness": 2, "smarts": 1}))

E("family.mc.grandparent-dies", "family", [
    "A grandparent died. It was the first funeral, and the first time the adults looked small.",
], age_min=6, age_max=17, weight=7, rarity="uncommon", flags_none=["grandparent.gone"],
   effects=FX(stats={"happiness": -5, "willpower": 3}, relationship={"family": 2},
              set_flags=["grandparent.gone"]))

E("family.mc.money-tight", "family", [
    "Money was tight in a way the adults tried and failed to hide.",
], age_min=5, age_max=17, requires=["anyParent"], weight=12, cooldown=3,
   wealth_any=["struggling"],
   effects=FX(stats={"happiness": -2, "discipline": 2, "willpower": 1}))

E("family.mc.second-job", "family", [
    "{parent} picked up a second job. Dinner moved to nine o'clock and you understood why.",
], age_min=5, age_max=17, requires=["singleParent"], weight=10, cooldown=4,
   wealth_any=["struggling", "modest"],
   effects=FX(stats={"happiness": -1, "discipline": 2}, relationship={"parents": 1}))

E("family.mc.family-holiday", "family", [
    "A proper holiday. Sunburn, a rented car, and photographs that get better with age.",
], age_min=4, age_max=17, requires=["anyParent"], weight=10, cooldown=4,
   wealth_any=["comfortable", "affluent", "wealthy"],
   effects=FX(stats={"happiness": 4}, relationship={"family": 2}))

E("family.mc.camping", "family", [
    "A camping trip that went wrong in four separate ways and is now the family's favourite story.",
], age_min=5, age_max=17, requires=["anyParent"], weight=10, cooldown=5,
   effects=FX(stats={"happiness": 3, "health": 1}, relationship={"family": 2}))

E("family.mc.parent-illness", "family", [
    "{parent} was unwell for months. The house got quiet and everyone got older.",
], age_min=6, age_max=17, requires=["anyParent"], weight=6, rarity="uncommon", cooldown=8,
   effects=FX(stats={"happiness": -4, "willpower": 3}, relationship={"parents": 3}))

E("family.mc.divorce", "family", [
    "{parents} sat you down at the kitchen table. Afterwards there were two addresses.",
], age_min=4, age_max=16, requires=["bothParents"], weight=8, rarity="uncommon",
   flags_none=["family.divorced"],
   effects=FX(stats={"happiness": -6, "willpower": 3}, relationship={"parents": -4},
              set_flags=["family.divorced"]))

E("family.mc.post-divorce-weekends", "family", [
    "Weekends belonged to one parent and weeknights to the other. You got good at packing.",
], age_min=5, age_max=17, flags_all=["family.divorced"], weight=12, cooldown=2,
   effects=FX(stats={"discipline": 2, "happiness": -1}))

E("family.mc.step-parent", "family", [
    "Somebody new started coming to dinner, and then started staying for it.",
], age_min=6, age_max=17, flags_all=["family.divorced"], flags_none=["family.step-parent"],
   weight=8, rarity="uncommon",
   effects=FX(stats={"happiness": -1, "charisma": 2}, set_flags=["family.step-parent"]))

E("family.mc.family-business", "family", [
    "Spent weekends helping at the family business, unpaid, and learned the till by nine.",
], age_min=8, age_max=17, requires=["anyParent"], weight=8, cooldown=3, rarity="uncommon",
   effects=FX(stats={"discipline": 3, "charisma": 2}))

E("family.mc.late-sibling", "family", [
    "A new baby arrived. Your standing in the household was quietly revised.",
], age_min=3, age_max=13, requires=["anyParent"], weight=7, rarity="uncommon",
   flags_none=["family.new-baby"],
   effects=FX(stats={"happiness": -1, "discipline": 2}, set_flags=["family.new-baby"]))

E("family.mc.parent-proud", "family", [
    "{parent} told somebody about you at a party, loudly, while you were standing right there.",
], age_min=7, age_max=17, requires=["anyParent"], weight=10, cooldown=3,
   effects=FX(stats={"happiness": 2, "charisma": 1}, relationship={"parents": 2}))

E("family.mc.grounded", "family", [
    "Grounded for two weeks. Served eleven days before the sentence quietly lapsed.",
], age_min=8, age_max=17, requires=["anyParent"], weight=11, cooldown=3,
   effects=FX(stats={"happiness": -2, "discipline": 1}, relationship={"parents": -2}),
   modifiers=[MOD(1.8, talents_any=["crime"])])

E("family.mc.curfew-broken", "family", [
    "Came home ninety minutes late and found {parent} sitting in the dark, which was worse than shouting.",
], age_min=13, age_max=17, requires=["anyParent"], weight=11, cooldown=2,
   effects=FX(relationship={"parents": -3}, stats={"charisma": 1}))

E("family.mc.driving-lesson", "family", [
    "{parent} taught you to drive in an empty car park and aged five years doing it.",
], age_min=15, age_max=17, requires=["anyParent"], weight=12,
   effects=FX(stats={"discipline": 2, "happiness": 2}, relationship={"parents": 2}))

E("family.mc.first-car-gift", "family", [
    "There was a used car in the driveway with a bow on it that fooled nobody.",
], age_min=16, age_max=17, requires=["anyParent"], weight=8, rarity="uncommon",
   wealth_any=["affluent", "wealthy"],
   effects=FX(stats={"happiness": 5}, relationship={"parents": 4}))

E("family.mc.teen-silence", "family", [
    "Communicated with the household exclusively in one-word answers for about eight months.",
], age_min=13, age_max=16, requires=["anyParent"], weight=12, cooldown=2,
   effects=FX(relationship={"parents": -3}, stats={"happiness": -1}))

E("family.mc.reconnect", "family", [
    "You and {parent} started talking properly again, over dishes, about nothing much.",
], age_min=14, age_max=17, requires=["anyParent"], weight=9, cooldown=3,
   rel_at_most={"mother": 55},
   effects=FX(relationship={"parents": 5}, stats={"happiness": 2}))

E("family.mc.older-sibling-leaves", "family", [
    "{olderSibling} moved out. The house got bigger and much less interesting.",
], age_min=10, age_max=17, requires=["olderSibling"], weight=8, rarity="uncommon",
   effects=FX(stats={"happiness": -2}, relationship={"siblings": -1}))

E("family.mc.only-child-quiet", "family", [
    "Being an only child meant a quiet house and an unusually adult vocabulary.",
], age_min=5, age_max=13, requires=["onlyChild"], weight=10, cooldown=4,
   effects=FX(stats={"smarts": 2, "charisma": -1}))

E("family.mc.house-full", "family", [
    "With this many siblings, dinner was a negotiation and the bathroom was a queue.",
], age_min=5, age_max=17, requires=["siblings2"], weight=10, cooldown=3,
   effects=FX(stats={"charisma": 2, "happiness": 1}))


# =============================================================================
# SCHOOL — 0204 owns enrollment, grades and graduation. These are the texture
# around it: what school felt like, not what it recorded.
# =============================================================================

E("school.first-day", "school", [
    "First day of school. Cried at the gate, then forgot about it by lunch.",
    "First day of school. Walked in without looking back, which one parent has never forgiven.",
], age_min=5, age_max=6, weight=16, effects=FX(stats={"charisma": 1, "smarts": 1}))

E("school.nap-mat", "school", [
    "Refused to nap at nap time on principle, and lay there furious about it.",
], age_min=4, age_max=6, weight=11, effects=FX(stats={"willpower": 2}))

E("school.learned-to-read", "school", [
    "Something clicked and the letters turned into words. It never stopped after that.",
], age_min=5, age_max=7, weight=13, effects=FX(stats={"smarts": 4}),
   modifiers=[MOD(2.0, talents_any=["academics", "writing"])])

E("school.reading-struggle", "school", [
    "Reading came slowly and loudly, in front of everyone, one word at a time.",
], age_min=6, age_max=9, weight=10, stat_at_most={"smarts": 45},
   effects=FX(stats={"happiness": -2, "willpower": 2}))

E("school.favourite-teacher", "school", [
    "Had a teacher who noticed you. It made more difference than they will ever know.",
], age_min=6, age_max=17, weight=12, cooldown=4,
   effects=FX(stats={"smarts": 3, "happiness": 2, "willpower": 1}, behaviour=5))

E("school.hated-teacher", "school", [
    "Had a teacher who had clearly decided about you in week one.",
], age_min=6, age_max=17, weight=11, cooldown=4,
   effects=FX(stats={"happiness": -2, "willpower": 1}))

E("school.spelling-bee", "school", [
    "Went out of the spelling bee on a word you can still spell perfectly today.",
], age_min=7, age_max=13, weight=10,
   effects=FX(stats={"smarts": 1, "happiness": -1}))

E("school.spelling-bee-win", "school", [
    "Won the spelling bee. The trophy was small and the feeling was not.",
], age_min=7, age_max=13, weight=8, rarity="uncommon", stat_at_least={"smarts": 60},
   effects=FX(stats={"smarts": 2, "happiness": 4, "charisma": 1}),
   modifiers=[MOD(2.2, talents_any=["academics"])])

E("school.science-fair", "school", [
    "Entered the science fair with a volcano. So did four other people.",
], age_min=8, age_max=14, weight=11, cooldown=3,
   effects=FX(stats={"smarts": 2}),
   modifiers=[MOD(1.8, talents_any=["inventive", "academics"])])

E("school.science-fair-win", "school", [
    "Won the science fair with something that genuinely should not have worked.",
], age_min=9, age_max=15, weight=8, rarity="uncommon", talents_any=["inventive", "academics"],
   effects=FX(stats={"smarts": 4, "happiness": 3}))

E("school.class-play", "school", [
    "Cast as a tree in the class play. Delivered the performance of a lifetime anyway.",
], age_min=5, age_max=10, weight=11,
   effects=FX(stats={"charisma": 2, "happiness": 1}))

E("school.class-play-lead", "school", [
    "Got the lead in the school play and did not fumble a single line.",
], age_min=8, age_max=17, weight=8, rarity="uncommon",
   effects=FX(stats={"charisma": 4, "happiness": 3}),
   modifiers=[MOD(2.5, talents_any=["acting"]), MOD(1.4, stat_at_least={"looks": 65})])

E("school.forgot-homework", "school", [
    "Discovered that homework does not do itself, several times, at cost.",
], age_min=7, age_max=17, weight=13, cooldown=2,
   stat_at_most={"discipline": 50},
   effects=FX(stats={"discipline": 1, "happiness": -1}))

E("school.perfect-attendance", "school", [
    "Perfect attendance. The certificate is somewhere in a drawer to this day.",
], age_min=7, age_max=17, weight=9, cooldown=3, stat_at_least={"discipline": 62},
   effects=FX(stats={"discipline": 2, "happiness": 1}, behaviour=6))

E("school.detention", "school", [
    "Detention, for something that had seemed extremely funny at the time.",
], age_min=8, age_max=17, weight=12, cooldown=2,
   effects=FX(stats={"discipline": -1, "charisma": 1}, behaviour=-8),
   modifiers=[MOD(1.9, talents_any=["crime"]), MOD(0.4, stat_at_least={"discipline": 70})])

E("school.suspended", "school", [
    "Suspended for three days. The house was very quiet about it.",
], age_min=10, age_max=17, weight=7, rarity="uncommon", requires=["anyParent"],
   effects=FX(stats={"discipline": -2, "happiness": -2}, relationship={"parents": -4},
              behaviour=-20),
   modifiers=[MOD(2.4, talents_any=["crime"])])

E("school.bullied", "school", [
    "A group of older kids made a project out of you for most of the year.",
], age_min=7, age_max=15, weight=9, rarity="uncommon", flags_none=["school.bullied"],
   effects=FX(stats={"happiness": -5, "willpower": 3}, set_flags=["school.bullied"]),
   follow_up=FOLLOW("school.bullied.after", 2, 0.7))

E("school.bullied.after", "school", [
    "The kids who made your life difficult moved on to somebody else. The relief was uncomfortable.",
], type="followUp", age_min=8, age_max=17, weight=10,
   effects=FX(stats={"happiness": 3, "willpower": 1}, clear_flags=["school.bullied"]))

E("school.new-school", "school", [
    "Changed schools mid-year and had to learn a new set of unwritten rules from scratch.",
], age_min=6, age_max=16, weight=9, cooldown=4,
   effects=FX(stats={"charisma": 2, "happiness": -2, "willpower": 1}))

E("school.field-trip", "school", [
    "A field trip to a museum, remembered mostly for the bus.",
    "A field trip where somebody was sick on the coach and it was not you.",
], age_min=6, age_max=14, weight=12, cooldown=2,
   effects=FX(stats={"smarts": 1, "happiness": 2}))

E("school.sports-day", "school", [
    "Sports day. Came somewhere in the middle of everything and enjoyed it enormously.",
], age_min=6, age_max=13, weight=12, cooldown=2,
   effects=FX(stats={"health": 1, "happiness": 2}),
   modifiers=[MOD(0.5, talents_any=["athletics"])])

E("school.sports-day-win", "school", [
    "Won three events on sports day and was carried around a field about it.",
], age_min=6, age_max=14, weight=9, talents_any=["athletics"], cooldown=3,
   effects=FX(stats={"health": 2, "happiness": 3, "charisma": 2}))

E("school.picked-last", "school", [
    "Picked last for teams, consistently, for years, by people who were not wrong.",
], age_min=7, age_max=14, weight=10, cooldown=3, talents_none=["athletics"],
   stat_at_most={"health": 55},
   effects=FX(stats={"happiness": -2, "willpower": 2}))

E("school.school-photo", "school", [
    "The school photo this year is the one the family keeps bringing out.",
], age_min=5, age_max=17, weight=11, cooldown=3,
   effects=FX(stats={"happiness": 1}))

E("school.school-photo-bad", "school", [
    "The school photo captured a haircut that everyone had agreed to forget.",
], age_min=6, age_max=16, weight=10, cooldown=3, stat_at_most={"looks": 50},
   effects=FX(stats={"looks": -1, "happiness": -1}))

E("school.reading-list", "school", [
    "Read every book in the class library, then started on the year above.",
], age_min=7, age_max=13, weight=8, stat_at_least={"smarts": 62},
   effects=FX(stats={"smarts": 3}),
   modifiers=[MOD(2.4, talents_any=["academics", "writing"])])

E("school.maths-wall", "school", [
    "Hit the wall in maths and spent a year quietly convinced everyone else had been told something.",
], age_min=10, age_max=16, weight=11, stat_at_most={"smarts": 58},
   effects=FX(stats={"happiness": -2, "willpower": 1}))

E("school.top-of-class", "school", [
    "Finished top of the class. Somebody's parent said something about it at pick-up.",
], age_min=8, age_max=17, weight=9, stat_at_least={"smarts": 70}, cooldown=3,
   effects=FX(stats={"smarts": 2, "happiness": 3}),
   modifiers=[MOD(1.9, talents_any=["academics"])])

E("school.group-project", "school", [
    "Did the entire group project. Four names went on it.",
], age_min=10, age_max=17, weight=12, cooldown=3, stat_at_least={"discipline": 55},
   effects=FX(stats={"discipline": 2, "happiness": -1}))

E("school.group-project-coast", "school", [
    "Contributed a title page to a group project and accepted the shared grade without comment.",
], age_min=10, age_max=17, weight=11, cooldown=3, stat_at_most={"discipline": 48},
   effects=FX(stats={"charisma": 1, "discipline": -1}))

E("school.locker", "school", [
    "Got a locker. Spent the first week opening it for no reason.",
], age_min=11, age_max=13, weight=11,
   effects=FX(stats={"happiness": 1}))

E("school.exam-panic", "school", [
    "Revised the wrong chapter for an important exam and found out in the room.",
], age_min=13, age_max=17, weight=11, cooldown=3,
   effects=FX(stats={"happiness": -2, "discipline": 2}))

E("school.debate-club", "school", [
    "Joined the debate team and discovered a genuine talent for being irritating with structure.",
], age_min=12, age_max=17, weight=9, stat_at_least={"charisma": 58},
   effects=FX(stats={"charisma": 3, "smarts": 2}))

E("school.school-band", "school", [
    "Played in the school band. The concert was long and the parents were heroic.",
], age_min=9, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"discipline": 2, "happiness": 1}),
   modifiers=[MOD(2.2, talents_any=["music"])])

E("school.yearbook", "school", [
    "Got a yearbook quote in that has not aged well.",
], age_min=15, age_max=17, weight=9,
   effects=FX(stats={"happiness": 1, "charisma": 1}))

E("school.prom", "school", [
    "Went to the dance. The photographs are terrible and everybody looks delighted.",
], age_min=15, age_max=17, weight=11,
   effects=FX(stats={"happiness": 3, "charisma": 2}))

E("school.prom-skipped", "school", [
    "Skipped the dance and had a much better night doing nothing much with two friends.",
], age_min=15, age_max=17, weight=9, stat_at_most={"charisma": 45},
   effects=FX(stats={"happiness": 2}))

E("school.part-time-job", "school", [
    "Took a weekend job that paid badly and taught more than a year of school did. It came to about $900.",
], age_min=14, age_max=17, weight=11, cooldown=2, physical=True,
   wealth_any=["struggling", "modest", "comfortable"],
   effects=FX(cash=CASH(900, "a year of weekend shifts"),
              stats={"discipline": 3, "charisma": 1, "health": -1}))

E("school.summer-camp", "school", [
    "Summer camp. Came back with a lanyard, a sunburn and three new opinions.",
], age_min=8, age_max=16, weight=9, cooldown=3,
   wealth_any=["comfortable", "affluent", "wealthy"],
   effects=FX(stats={"charisma": 2, "happiness": 2, "health": 1}))

E("school.summer-nothing", "school", [
    "Spent the whole summer on one street with three other kids and no plans at all.",
], age_min=7, age_max=14, weight=12, cooldown=3,
   effects=FX(stats={"happiness": 3, "charisma": 1}))

# NOT an event: graduation belongs to the education phase, which writes
# "Graduated from high school with a B average." at eighteen and knows the
# grade. This catalog once carried its own "Finished school." line at
# SEVENTEEN, so a senior read about finishing a year before they did, and then
# finished again the following year. One system owns a milestone.


# =============================================================================
# FRIENDSHIP — 0206 builds real friend NPCs. Until then these are the shape of
# childhood friendship rather than named relationships, and use {kid} so the
# names still sound like they come from where the character lives.
# =============================================================================

E("friend.first", "friendship", [
    "Made a first real friend, {kid}, over a shared and specific hatred of naps.",
    "Became inseparable from {kid} for reasons neither of you could explain.",
], age_min=3, age_max=7, weight=14, effects=FX(stats={"charisma": 3, "happiness": 3}))

E("friend.next-door", "friendship", [
    "{kid} lived four doors down, which was the entire basis of the friendship and it was enough.",
], age_min=4, age_max=12, weight=13, cooldown=4,
   effects=FX(stats={"charisma": 2, "happiness": 2}))

E("friend.best-friend", "friendship", [
    "You and {kid} became a unit. Teachers stopped saying the names separately.",
], age_min=6, age_max=15, weight=12, cooldown=5,
   effects=FX(stats={"charisma": 2, "happiness": 4}))

E("friend.sleepover", "friendship", [
    "A sleepover at {kid}'s. Nobody slept and everybody claimed they did.",
], age_min=6, age_max=14, weight=13, cooldown=2,
   effects=FX(stats={"happiness": 2, "charisma": 1}))

E("friend.club", "friendship", [
    "Founded a club with {kid} and {kid2}. It had rules, a password, and no purpose.",
], age_min=6, age_max=12, weight=12, cooldown=3,
   effects=FX(stats={"charisma": 2, "happiness": 2, "smarts": 1}))

E("friend.fort", "friendship", [
    "Built a fort with {kid} that was structurally unsound and defended to the last.",
], age_min=5, age_max=12, weight=12, cooldown=3,
   effects=FX(stats={"happiness": 3}))

E("friend.fell-out", "friendship", [
    "Fell out with {kid} over something enormous that nobody can now remember.",
], age_min=6, age_max=16, weight=12, cooldown=3,
   effects=FX(stats={"happiness": -3, "willpower": 1}))

E("friend.made-up", "friendship", [
    "Made up with {kid} without either of you ever mentioning what happened.",
], age_min=6, age_max=17, weight=11, cooldown=3,
   effects=FX(stats={"happiness": 3, "charisma": 1}))

E("friend.moved-away", "friendship", [
    "{kid} moved away. There were promises to write, and two letters.",
], age_min=5, age_max=16, weight=11, cooldown=4,
   effects=FX(stats={"happiness": -4, "willpower": 2}))

E("friend.new-kid", "friendship", [
    "A new kid, {kid}, showed up mid-term and you were the one who talked to {kidThem} first.",
], age_min=7, age_max=16, weight=11, cooldown=3,
   effects=FX(stats={"charisma": 3, "happiness": 2}))

E("friend.left-out", "friendship", [
    "Found out about the party afterwards, from photographs.",
], age_min=8, age_max=17, weight=11, cooldown=3, stat_at_most={"charisma": 52},
   effects=FX(stats={"happiness": -4, "willpower": 1}))

E("friend.popular", "friendship", [
    "Ended up at the middle of things without ever quite deciding to.",
], age_min=9, age_max=17, weight=10, cooldown=3, stat_at_least={"charisma": 68},
   effects=FX(stats={"charisma": 3, "happiness": 2}))

E("friend.loner", "friendship", [
    "Spent most break times reading on a wall, and largely preferred it.",
], age_min=7, age_max=17, weight=11, cooldown=3, stat_at_most={"charisma": 42},
   effects=FX(stats={"smarts": 2, "happiness": -1, "willpower": 1}))

E("friend.group", "friendship", [
    "Landed in a group of five who did everything together for three straight years.",
], age_min=11, age_max=17, weight=11, cooldown=4,
   effects=FX(stats={"charisma": 3, "happiness": 3}))

E("friend.betrayed", "friendship", [
    "{kid} told everyone the one thing you had asked {kidThem} not to.",
], age_min=9, age_max=17, weight=9, rarity="uncommon",
   effects=FX(stats={"happiness": -5, "charisma": 1, "willpower": 2}))

E("friend.defended", "friendship", [
    "{kid} stood up for you in front of everybody, at real cost to {kidThem}self.",
], age_min=8, age_max=17, weight=8, rarity="uncommon",
   effects=FX(stats={"happiness": 5, "charisma": 1}))

E("friend.first-crush", "friendship", [
    "Developed a crush that was total, silent, and known to the entire year group.",
], age_min=10, age_max=16, weight=13, cooldown=3,
   effects=FX(stats={"happiness": 2, "charisma": 1}))

E("friend.crush-returned", "friendship", [
    "The crush turned out to be mutual, which was somehow more alarming than the alternative.",
], age_min=12, age_max=17, weight=9, rarity="uncommon", stat_at_least={"looks": 55},
   effects=FX(stats={"happiness": 5, "charisma": 2}))

E("friend.rejected", "friendship", [
    "Asked. Was turned down kindly, which did not help at all.",
], age_min=12, age_max=17, weight=11, cooldown=3,
   effects=FX(stats={"happiness": -3, "willpower": 2, "charisma": 1}))

E("friend.first-date", "friendship", [
    "A first date at a cinema. Neither of you can name the film.",
], age_min=14, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": 4, "charisma": 2}))

E("friend.rival", "friendship", [
    "{kid} became a rival about something extremely small, and it lasted years.",
], age_min=8, age_max=17, weight=10, cooldown=4,
   effects=FX(stats={"willpower": 3, "discipline": 1}))

E("friend.online", "friendship", [
    "Made a friend online who lived somewhere you had to look up.",
], age_min=11, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"charisma": 2, "smarts": 1, "happiness": 2}))

E("friend.sport-team", "friendship", [
    "The team became the friend group, which is how it usually works.",
], age_min=8, age_max=17, weight=10, cooldown=3, talents_any=["athletics"],
   effects=FX(stats={"charisma": 2, "health": 1, "happiness": 2}))

E("friend.sleepover-host", "friendship", [
    "Hosted the sleepover. Somebody broke something and nobody admitted it.",
], age_min=7, age_max=14, weight=10, cooldown=3, requires=["anyParent"],
   effects=FX(stats={"charisma": 2, "happiness": 2}, relationship={"parents": -1}))

E("friend.bike-summer", "friendship", [
    "Spent an entire summer riding bikes with {kid} and {kid2} and being home by dark.",
], age_min=7, age_max=14, weight=13, cooldown=3,
   effects=FX(stats={"health": 2, "happiness": 3, "charisma": 1}))

E("friend.arcade", "friendship", [
    "Discovered an arcade with {kid} and fed $25 of pocket money into one machine over a fortnight.",
], age_min=8, age_max=16, weight=10, cooldown=3,
   effects=FX(stats={"happiness": 2}, cash=CASH(-25, "a fortnight at the arcade")))

E("friend.borrowed-never-returned", "friendship", [
    "Lent {kid} something you loved. It has not come back and it is not going to.",
], age_min=7, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": -2, "smarts": 1}))

E("friend.first-fight", "friendship", [
    "An actual fistfight in a playground, over nothing, lasting eleven seconds.",
], age_min=8, age_max=15, weight=9, cooldown=4,
   effects=FX(stats={"health": -1, "willpower": 2, "charisma": 1}, behaviour=-11),
   modifiers=[MOD(1.8, talents_any=["athletics", "crime"])])

E("friend.peer-pressure-resisted", "friendship", [
    "Everybody was doing something stupid and you were the one who didn't. It cost you socially.",
], age_min=11, age_max=17, weight=10, cooldown=3, stat_at_least={"willpower": 62},
   effects=FX(stats={"willpower": 3, "charisma": -1, "discipline": 2}))

E("friend.older-crowd", "friendship", [
    "Started spending time with a much older crowd who found you funny.",
], age_min=13, age_max=17, weight=9, cooldown=3,
   effects=FX(stats={"charisma": 3, "happiness": 1, "discipline": -1}))

E("friend.group-collapse", "friendship", [
    "The group broke apart over the summer and reassembled without you in it.",
], age_min=12, age_max=17, weight=9, rarity="uncommon",
   effects=FX(stats={"happiness": -5, "willpower": 3}))

E("friend.pen-pal", "friendship", [
    "Had a pen pal for two years. The letters are still in a shoebox.",
], age_min=8, age_max=15, weight=8, cooldown=5,
   effects=FX(stats={"smarts": 2, "happiness": 2}),
   modifiers=[MOD(1.8, talents_any=["writing"])])


# =============================================================================
# RANDOM — humour and the ordinary weirdness of being a person. This category
# carries the "quiet year" fillers too, which is why it is the biggest: a year
# must never come back empty, at any age, in any household.
# =============================================================================

# ---- always-available fillers, one band each. Low weight, short cooldown. ----

E("random.filler.infant.1", "random", [
    "Slept a great deal. It was, by every available measure, a good year.",
], age_min=0, age_max=2, weight=6, cooldown=2)

E("random.filler.infant.2", "random", [
    "Learned that dropping things makes adults pick them up. Tested this finding thoroughly.",
], age_min=0, age_max=2, weight=6, cooldown=2, effects=FX(stats={"smarts": 1}))

E("random.filler.infant.3", "random", [
    "Was largely carried from place to place and had opinions about the itinerary.",
], age_min=0, age_max=2, weight=6, cooldown=2)

E("random.filler.child.1", "random", [
    "An unremarkable year, spent mostly outside.",
], age_min=3, age_max=12, weight=5, cooldown=3, effects=FX(stats={"health": 1}))

E("random.filler.child.2", "random", [
    "Became extremely serious about one cartoon for about seven months.",
], age_min=3, age_max=12, weight=6, cooldown=3, effects=FX(stats={"happiness": 1}))

E("random.filler.child.3", "random", [
    "Nothing much happened. It was fine. Most years are fine.",
], age_min=3, age_max=12, weight=5, cooldown=3)

E("random.filler.teen.1", "random", [
    "Stayed up too late all year and felt completely fine about it.",
], age_min=13, age_max=17, weight=6, cooldown=3, effects=FX(stats={"health": -1}))

E("random.filler.teen.2", "random", [
    "A quiet year. School, sleep, and an unreasonable amount of time on a screen.",
], age_min=13, age_max=17, weight=5, cooldown=3)

E("random.filler.teen.3", "random", [
    "Started caring what people thought. Unclear whether this counted as progress.",
], age_min=12, age_max=17, weight=6, cooldown=3, effects=FX(stats={"charisma": 1}))

# ---- ordinary childhood ------------------------------------------------------

E("random.cardboard", "random", [
    "Spent a summer building something ambitious out of cardboard.",
], age_min=4, age_max=11, weight=11, cooldown=4,
   effects=FX(stats={"smarts": 2, "happiness": 1}),
   modifiers=[MOD(1.8, talents_any=["inventive"])])

E("random.lunch-trades", "random", [
    "Traded lunches at school all year and came out comfortably ahead.",
], age_min=6, age_max=13, weight=11, cooldown=3,
   effects=FX(stats={"charisma": 2, "smarts": 1}))

E("random.bike-crash", "random", [
    "Fell off a bike. Got back on the bike.",
    "Came off a bike at speed and still has the scar to prove the story.",
], age_min=5, age_max=14, weight=12, cooldown=3,
   effects=FX(stats={"health": -1, "willpower": 2}))

E("random.broken-arm", "random", [
    "Broke an arm doing something that had been described as a bad idea in advance.",
], age_min=5, age_max=16, weight=8, rarity="uncommon", cooldown=6,
   effects=FX(stats={"health": -3, "willpower": 2}))

E("random.stitches", "random", [
    "Needed stitches. The waiting room was worse than the injury.",
], age_min=4, age_max=16, weight=9, cooldown=5,
   effects=FX(stats={"health": -2, "willpower": 1}))

E("random.chickenpox", "random", [
    "Caught chickenpox and was told roughly nine hundred times not to scratch.",
], age_min=2, age_max=10, weight=10,
   effects=FX(stats={"health": -1, "happiness": -1}))

E("random.glasses", "random", [
    "Got glasses and discovered that trees had been individual leaves the whole time.",
], age_min=6, age_max=15, weight=9, flags_none=["has.glasses"],
   effects=FX(stats={"smarts": 1, "looks": -1}, set_flags=["has.glasses"]))

E("random.braces", "random", [
    "Got braces. Ate soup for a week and complained about it for two years.",
], age_min=10, age_max=16, weight=10, flags_none=["has.braces"],
   wealth_any=["modest", "comfortable", "affluent", "wealthy"],
   effects=FX(stats={"looks": -2, "happiness": -1}, set_flags=["has.braces"]),
   follow_up=FOLLOW("random.braces.off", 3))

E("random.braces.off", "random", [
    "The braces came off. There was a mirror moment that everybody gets exactly once.",
], type="followUp", age_min=12, age_max=17, weight=10,
   effects=FX(stats={"looks": 5, "happiness": 4, "charisma": 2}, clear_flags=["has.braces"]))

E("random.growth-spurt", "random", [
    "Grew four inches in one year and spent all of it apologising to furniture.",
], age_min=11, age_max=16, weight=11,
   effects=FX(stats={"health": 2, "looks": 1, "charisma": -1}))

E("random.late-bloom", "random", [
    "Everyone else grew. You waited. It was a long year.",
], age_min=12, age_max=15, weight=10,
   effects=FX(stats={"happiness": -2, "willpower": 2}))

E("random.haircut-good", "random", [
    "Got a haircut that worked, for the first time, entirely by accident.",
], age_min=8, age_max=17, weight=10, cooldown=4,
   effects=FX(stats={"looks": 3, "happiness": 2}))

E("random.fashion-phase", "random", [
    "Went through a phase. There are photographs, and they are being kept deliberately.",
], age_min=11, age_max=17, weight=11, cooldown=3,
   effects=FX(stats={"looks": -1, "charisma": 2, "happiness": 1}))

E("random.video-games", "random", [
    "Got extremely good at one game and completely useless at everything around it.",
], age_min=7, age_max=17, weight=12, cooldown=3,
   effects=FX(stats={"smarts": 1, "happiness": 2, "discipline": -1}))

E("random.collection", "random", [
    "Started a collection. It grew fast, peaked, and was abandoned within eighteen months.",
], age_min=6, age_max=14, weight=11, cooldown=3,
   effects=FX(stats={"discipline": 1, "happiness": 2}))

E("random.dinosaurs", "random", [
    "Knew every dinosaur. Would tell you. Would keep telling you.",
], age_min=4, age_max=9, weight=11,
   effects=FX(stats={"smarts": 3, "charisma": -1}))

E("random.space-phase", "random", [
    "Decided on becoming an astronaut and researched it with genuine rigour.",
], age_min=5, age_max=11, weight=10,
   effects=FX(stats={"smarts": 3}),
   modifiers=[MOD(1.7, talents_any=["academics", "inventive"])])

E("random.stray-cat", "random", [
    "Fed a stray cat in secret for eight months. It was eventually discovered by everyone.",
], age_min=6, age_max=15, weight=9, cooldown=5,
   effects=FX(stats={"happiness": 3}))

E("random.lost-in-shop", "random", [
    "Got lost in a shop for four minutes that were experienced as several hours.",
], age_min=3, age_max=8, weight=10, requires=["anyParent"],
   effects=FX(stats={"happiness": -2, "willpower": 1}))

E("random.tooth-fairy", "random", [
    "Lost a tooth and negotiated the going rate up to $5, which was considered outrageous.",
], age_min=5, age_max=9, weight=12, cooldown=2,
   effects=FX(cash=CASH(5, "a tooth, renegotiated"), stats={"charisma": 1}))

E("random.swimming", "random", [
    "Learned to swim, badly, in a pool that smelled of chlorine and fear.",
], age_min=4, age_max=11, weight=11,
   effects=FX(stats={"health": 2, "willpower": 1}))

E("random.storm", "random", [
    "A storm took out the power for three days and it was the best week of the year.",
], age_min=4, age_max=15, weight=9, cooldown=5,
   effects=FX(stats={"happiness": 2, "willpower": 1}))

E("random.found-money", "random", [
    "Found $20 on the pavement outside the laundromat and told nobody, ever.",
], age_min=5, age_max=17, weight=9, cooldown=4,
   effects=FX(cash=CASH(20, "$20 found on the pavement"), stats={"happiness": 2}))

E("random.snow-day", "random", [
    "A snow day. The greatest single institution in human history.",
], age_min=5, age_max=16, weight=11, cooldown=3,
   effects=FX(stats={"happiness": 3}))

E("random.embarrassment", "random", [
    "Called a teacher 'mum' in front of everybody and has never fully recovered.",
    "Tripped on a completely flat surface in front of the entire year group.",
    "Waved at somebody who was waving at the person behind you.",
], age_min=6, age_max=17, weight=12, cooldown=2,
   effects=FX(stats={"happiness": -2, "charisma": 1}))

E("random.magic-phase", "random", [
    "Learned three card tricks and performed them at anyone who slowed down.",
], age_min=7, age_max=13, weight=10,
   effects=FX(stats={"charisma": 2, "smarts": 1}))

E("random.bad-haircut-self", "random", [
    "Attempted a fringe with kitchen scissors. The regrowth took eleven months.",
], age_min=8, age_max=16, weight=9, cooldown=5,
   effects=FX(stats={"looks": -3, "happiness": -1}))

E("random.food-refusal", "random", [
    "Ate nothing but one specific food for most of a year and thrived inexplicably.",
], age_min=3, age_max=9, weight=10,
   effects=FX(stats={"health": -1, "willpower": 2}))

E("random.first-concert", "random", [
    "First concert. Ears rang for two days and it was completely worth it.",
], age_min=12, age_max=17, weight=10, cooldown=4,
   effects=FX(stats={"happiness": 4}),
   modifiers=[MOD(1.8, talents_any=["music"])])

E("random.first-phone", "random", [
    "Got a phone, along with a speech about responsibility that lasted nine minutes.",
], age_min=10, age_max=15, weight=12, requires=["anyParent"], flags_none=["has.phone"],
   effects=FX(stats={"charisma": 2, "happiness": 3}, set_flags=["has.phone"]))

E("random.phone-confiscated", "random", [
    "The phone was confiscated for a fortnight. Life became medieval.",
], age_min=11, age_max=17, weight=10, cooldown=2, flags_all=["has.phone"],
   requires=["anyParent"],
   effects=FX(stats={"happiness": -3, "discipline": 1}, relationship={"parents": -2}))

E("random.sunburn", "random", [
    "Got a sunburn shaped exactly like a t-shirt and wore it for a week.",
], age_min=4, age_max=17, weight=9, cooldown=4,
   effects=FX(stats={"health": -1, "looks": -1}))

E("random.library-card", "random", [
    "Got a library card and treated it as a licence to print money.",
], age_min=6, age_max=14, weight=10,
   effects=FX(stats={"smarts": 3, "happiness": 1}),
   modifiers=[MOD(1.9, talents_any=["academics", "writing"])])

E("random.first-funeral-suit", "random", [
    "Wore a proper suit for the first time, for a sad reason, and it did not fit.",
], age_min=8, age_max=17, weight=7, rarity="uncommon",
   effects=FX(stats={"willpower": 2, "happiness": -2}))

E("random.talent-show-flop", "random", [
    "Entered the talent show with no discernible talent and went through with it anyway.",
], age_min=7, age_max=14, weight=9, talents_none=["music", "acting", "athletics"],
   effects=FX(stats={"charisma": 2, "willpower": 2, "happiness": -1}))

E("random.celebrity-sighting", "random", [
    "Saw somebody genuinely famous in an airport and said nothing at all.",
], age_min=6, age_max=17, weight=8, rarity="rare", cooldown=8,
   effects=FX(stats={"happiness": 3, "charisma": 1}))

E("random.lottery-scratch", "random", [
    "{parent} let you scratch the lottery ticket. It won $8 and was celebrated for days.",
], age_min=6, age_max=14, weight=8, requires=["anyParent"], rarity="uncommon",
   effects=FX(cash=CASH(8, "a winning scratch card"), stats={"happiness": 2}))

E("random.attic-find", "random", [
    "Found a box in the attic with somebody's whole life in it and read all of it.",
], age_min=8, age_max=17, weight=7, rarity="uncommon",
   effects=FX(stats={"smarts": 2, "happiness": 2}))

E("random.meteor", "random", [
    "Saw a meteor shower from a roof at two in the morning and did not tell anyone about being up there.",
], age_min=9, age_max=17, weight=6, rarity="rare",
   effects=FX(stats={"happiness": 4, "smarts": 1}))

E("random.viral-clip", "random", [
    "A short clip of you doing something ordinary was shared far beyond anyone's intentions.",
], age_min=11, age_max=17, weight=6, rarity="rare", flags_all=["has.phone"],
   effects=FX(stats={"charisma": 4, "happiness": -1}))

E("random.heirloom", "random", [
    "Was given a watch that had belonged to somebody two generations up, and told not to lose it.",
], age_min=10, age_max=17, weight=5, rarity="rare",
   effects=FX(stats={"happiness": 3, "discipline": 1}))

E("random.perfect-day", "random", [
    "There was one day this year that was, without qualification, perfect. No particular reason.",
], age_min=5, age_max=17, weight=6, rarity="uncommon", cooldown=6,
   effects=FX(stats={"happiness": 6}))


# =============================================================================
# TALENT — spec 725-770: talents "unlock or improve access to event pools but do
# not guarantee outcomes". So these are gated on the Boolean talent (0201) and
# describe it being noticed, not rewarded. A talent that nobody ever remarks on
# is invisible to the player, which is the same as not existing.
# =============================================================================

# ---- athletics ---------------------------------------------------------------

E("talent.ath.fast", "talent", [
    "Turned out to be the fastest kid in the year, by an embarrassing margin.",
], age_min=5, age_max=12, weight=14, talents_any=["athletics"],
   effects=FX(stats={"health": 3, "happiness": 3, "charisma": 1}))

E("talent.ath.first-team", "talent", [
    "Made a team two age groups up and was not the worst player on it.",
], age_min=8, age_max=16, weight=13, talents_any=["athletics"], cooldown=3,
   effects=FX(stats={"health": 2, "charisma": 2, "discipline": 2}))

E("talent.ath.coach", "talent", [
    "A coach took you aside and used the word 'serious'. Training changed after that.",
], age_min=9, age_max=17, weight=11, talents_any=["athletics"],
   effects=FX(stats={"discipline": 4, "health": 2}, set_flags=["ath.coached"]))

E("talent.ath.injury", "talent", [
    "An injury took a whole season. Watching from the side taught more than playing would have.",
], age_min=11, age_max=17, weight=9, talents_any=["athletics"], rarity="uncommon",
   effects=FX(stats={"health": -4, "willpower": 4}))

E("talent.ath.championship", "talent", [
    "Won something with a trophy attached and a photograph in a local paper.",
], age_min=10, age_max=17, weight=10, talents_any=["athletics"], cooldown=4,
   effects=FX(stats={"happiness": 5, "charisma": 3, "discipline": 1}))

E("talent.ath.scout", "talent", [
    "Somebody with a clipboard was at the game, and afterwards asked for a phone number.",
], age_min=14, age_max=17, weight=8, rarity="uncommon", talents_any=["athletics"],
   flags_all=["ath.coached"],
   effects=FX(stats={"happiness": 4, "discipline": 2}, set_flags=["ath.scouted"]))

E("talent.ath.early-mornings", "talent", [
    "Trained before school, in the dark, most of the year, and stopped finding it remarkable.",
], age_min=11, age_max=17, weight=11, talents_any=["athletics"], cooldown=2,
   effects=FX(stats={"discipline": 3, "health": 2, "happiness": -1}))

# ---- acting ------------------------------------------------------------------

E("talent.act.noticed", "talent", [
    "Was the only convincing person on stage at the nativity, aged six.",
], age_min=4, age_max=9, weight=14, talents_any=["acting"],
   effects=FX(stats={"charisma": 3, "happiness": 2}))

E("talent.act.drama-club", "talent", [
    "Joined drama club and found the one room in the school that made sense.",
], age_min=8, age_max=17, weight=12, talents_any=["acting"], cooldown=4,
   effects=FX(stats={"charisma": 3, "happiness": 3}))

E("talent.act.impressions", "talent", [
    "Did an impression of a teacher so accurate it became a minor political problem.",
], age_min=8, age_max=17, weight=11, talents_any=["acting"], cooldown=3,
   effects=FX(stats={"charisma": 3, "discipline": -1}))

E("talent.act.local-stage", "talent", [
    "Got a part in a real production at a real theatre with real strangers watching.",
], age_min=11, age_max=17, weight=9, talents_any=["acting"], rarity="uncommon",
   effects=FX(stats={"charisma": 4, "happiness": 4}, set_flags=["act.staged"]))

E("talent.act.commercial", "talent", [
    "Did a commercial for a regional furniture shop. It paid $800, and it aired, relentlessly.",
], age_min=9, age_max=17, weight=7, rarity="rare", talents_any=["acting"],
   effects=FX(cash=CASH(800, "a regional furniture commercial"),
              stats={"charisma": 3, "happiness": 3}))

E("talent.act.stage-fright", "talent", [
    "Froze completely on stage for nine seconds that have never fully ended.",
], age_min=8, age_max=17, weight=9, talents_any=["acting"], rarity="uncommon",
   effects=FX(stats={"happiness": -4, "willpower": 3}))

E("talent.act.teacher-push", "talent", [
    "A drama teacher said you should be doing this properly, and clearly meant it.",
], age_min=12, age_max=17, weight=9, talents_any=["acting"],
   effects=FX(stats={"charisma": 2, "discipline": 2, "happiness": 2}))

# ---- music -------------------------------------------------------------------

E("talent.mus.piano", "talent", [
    "Sat down at a piano and worked out a tune by ear, to general alarm.",
], age_min=4, age_max=11, weight=14, talents_any=["music"],
   effects=FX(stats={"smarts": 2, "happiness": 3}))

E("talent.mus.lessons", "talent", [
    "Started lessons. Scales for a year, then suddenly something that sounded like music.",
], age_min=6, age_max=15, weight=12, talents_any=["music"],
   wealth_any=["modest", "comfortable", "affluent", "wealthy"],
   effects=FX(stats={"discipline": 4, "smarts": 2}, set_flags=["mus.trained"]))

E("talent.mus.self-taught", "talent", [
    "Taught yourself on a borrowed instrument with three working strings.",
], age_min=7, age_max=17, weight=12, talents_any=["music"], wealth_any=["struggling", "modest"],
   effects=FX(stats={"discipline": 3, "willpower": 3}, set_flags=["mus.trained"]))

E("talent.mus.band", "talent", [
    "Formed a band in a garage with {kid} and {kid2}. It was loud and it was not good yet.",
], age_min=12, age_max=17, weight=11, talents_any=["music"],
   effects=FX(stats={"charisma": 3, "happiness": 3}, set_flags=["mus.band"]))

E("talent.mus.first-gig", "talent", [
    "Played a first proper gig to about thirty people, eleven of whom were related to somebody.",
], age_min=13, age_max=17, weight=9, talents_any=["music"], flags_all=["mus.band"],
   effects=FX(stats={"charisma": 4, "happiness": 5}))

E("talent.mus.wrote-song", "talent", [
    "Wrote a song. It was terrible and finishing it changed something anyway.",
], age_min=11, age_max=17, weight=10, talents_any=["music"], cooldown=3,
   effects=FX(stats={"happiness": 3, "discipline": 2}))

E("talent.mus.recital", "talent", [
    "Played a recital from memory without a single mistake, and could not sleep afterwards.",
], age_min=9, age_max=17, weight=9, talents_any=["music"], flags_all=["mus.trained"],
   effects=FX(stats={"discipline": 3, "charisma": 2, "happiness": 3}))

E("talent.mus.quit", "talent", [
    "Quit the instrument for two years. Came back to it. Everybody does.",
], age_min=12, age_max=17, weight=8, talents_any=["music"], flags_all=["mus.trained"],
   rarity="uncommon",
   effects=FX(stats={"happiness": -1, "willpower": 2}))

# ---- writing -----------------------------------------------------------------

E("talent.wri.stories", "talent", [
    "Filled a notebook with stories about a world with its own maps and laws.",
], age_min=6, age_max=14, weight=14, talents_any=["writing"], cooldown=3,
   effects=FX(stats={"smarts": 3, "happiness": 2}))

E("talent.wri.essay-read-out", "talent", [
    "A teacher read your essay out to the class, which was both the best and worst thing possible.",
], age_min=8, age_max=17, weight=12, talents_any=["writing"],
   effects=FX(stats={"smarts": 2, "charisma": 2, "happiness": 2}))

E("talent.wri.school-paper", "talent", [
    "Wrote for the school paper and learned that a deadline is a real physical object.",
], age_min=12, age_max=17, weight=11, talents_any=["writing"],
   effects=FX(stats={"discipline": 3, "smarts": 2}, set_flags=["wri.published"]))

E("talent.wri.competition", "talent", [
    "Placed in a writing competition with a large number of entrants. The prize was $100.",
], age_min=10, age_max=17, weight=9, talents_any=["writing"], rarity="uncommon",
   effects=FX(stats={"smarts": 3, "happiness": 4},
              cash=CASH(100, "a writing competition prize")))

E("talent.wri.journal", "talent", [
    "Kept a journal every single day for a year, which nobody has ever been allowed to read.",
], age_min=10, age_max=17, weight=11, talents_any=["writing"], cooldown=4,
   effects=FX(stats={"discipline": 3, "willpower": 2}))

E("talent.wri.rejected", "talent", [
    "Sent something off to a magazine. The reply was a form letter and it was kept anyway.",
], age_min=13, age_max=17, weight=9, talents_any=["writing"], flags_all=["wri.published"],
   effects=FX(stats={"willpower": 3, "happiness": -1}))

E("talent.wri.novel-attempt", "talent", [
    "Started a novel. Got to page sixty. Page sixty is further than most people get.",
], age_min=13, age_max=17, weight=10, talents_any=["writing"],
   effects=FX(stats={"discipline": 2, "smarts": 2}))

# ---- academics ---------------------------------------------------------------

E("talent.aca.grade-skip", "talent", [
    "Skipped a year. Academically fine. Socially, a long twelve months.",
], age_min=6, age_max=13, weight=10, talents_any=["academics"], rarity="uncommon",
   effects=FX(stats={"smarts": 4, "charisma": -2, "happiness": -1}))

E("talent.aca.maths-olympiad", "talent", [
    "Went to a regional competition and came back with a certificate and a new set of rivals.",
], age_min=10, age_max=17, weight=11, talents_any=["academics"], cooldown=3,
   effects=FX(stats={"smarts": 3, "discipline": 2}))

E("talent.aca.encyclopedia", "talent", [
    "Read reference books for pleasure and had to be told this was unusual.",
], age_min=6, age_max=13, weight=12, talents_any=["academics"], cooldown=4,
   effects=FX(stats={"smarts": 3, "charisma": -1}))

E("talent.aca.tutor", "talent", [
    "Started tutoring kids a year below at $15 an hour. About $350 over the year.",
], age_min=13, age_max=17, weight=10, talents_any=["academics"], cooldown=2,
   effects=FX(cash=CASH(350, "a year of tutoring at $15 an hour"),
              stats={"smarts": 2, "charisma": 2, "discipline": 2}))

E("talent.aca.scholarship-track", "talent", [
    "A guidance counsellor started using the word 'scholarship' in the present tense.",
], age_min=15, age_max=17, weight=10, talents_any=["academics"], stat_at_least={"smarts": 70},
   effects=FX(stats={"discipline": 3, "happiness": 3}, set_flags=["aca.scholarship-track"]))

E("talent.aca.burnout", "talent", [
    "Ran out of interest completely for a term, and nobody had a framework for that.",
], age_min=13, age_max=17, weight=9, talents_any=["academics"], rarity="uncommon",
   effects=FX(stats={"happiness": -4, "discipline": -2, "willpower": 2}))

E("talent.aca.chess", "talent", [
    "Learned chess properly and beat an adult who had not been trying, and then one who was.",
], age_min=7, age_max=17, weight=11, talents_any=["academics"], cooldown=4,
   effects=FX(stats={"smarts": 3, "discipline": 1}))

# ---- inventive ---------------------------------------------------------------

E("talent.inv.dismantled", "talent", [
    "Took apart a household appliance to see inside. It did not go back together.",
], age_min=5, age_max=12, weight=14, talents_any=["inventive"], requires=["anyParent"],
   effects=FX(stats={"smarts": 3}, relationship={"parents": -2}))

E("talent.inv.rebuilt", "talent", [
    "Took apart a household appliance, and — to universal astonishment — put it back working.",
], age_min=8, age_max=17, weight=11, talents_any=["inventive"],
   effects=FX(stats={"smarts": 4, "discipline": 2}))

E("talent.inv.first-code", "talent", [
    "Wrote something that ran. It printed a rude word forty thousand times, but it ran.",
], age_min=8, age_max=17, weight=12, talents_any=["inventive"],
   effects=FX(stats={"smarts": 4, "happiness": 2}, set_flags=["inv.code"]))

E("talent.inv.robotics", "talent", [
    "Joined a robotics team and spent every weekend in a room that smelled of solder.",
], age_min=11, age_max=17, weight=10, talents_any=["inventive"],
   wealth_any=["modest", "comfortable", "affluent", "wealthy"],
   effects=FX(stats={"smarts": 3, "discipline": 3, "charisma": 1}))

E("talent.inv.fixed-neighbours", "talent", [
    "Word got round that you could fix things. It stopped being a favour and started being $180.",
], age_min=10, age_max=17, weight=10, talents_any=["inventive"], cooldown=3,
   effects=FX(cash=CASH(180, "fixing things for people on the street"),
              stats={"charisma": 2, "smarts": 2}))

E("talent.inv.patent-idea", "talent", [
    "Had an idea that was, on inspection, already a product. It was still a good idea.",
], age_min=12, age_max=17, weight=9, talents_any=["inventive"], cooldown=4,
   effects=FX(stats={"smarts": 2, "happiness": -1, "willpower": 2}))

E("talent.inv.fire", "talent", [
    "An experiment produced smoke, an alarm, and a permanent household rule.",
], age_min=8, age_max=16, weight=9, talents_any=["inventive"], requires=["anyParent"],
   rarity="uncommon",
   effects=FX(stats={"smarts": 2, "health": -1}, relationship={"parents": -3}))

# ---- crime -------------------------------------------------------------------

E("talent.cri.shoplift", "talent", [
    "Took something small from a shop and was not caught, which was the worst possible outcome.",
], age_min=8, age_max=17, weight=13, talents_any=["crime"], cooldown=3,
   effects=FX(stats={"willpower": 1, "discipline": -2}, set_flags=["cri.first"]))

E("talent.cri.caught", "talent", [
    "Was caught. A shop manager, a phone call, and a very long car journey home.",
], age_min=9, age_max=17, weight=10, talents_any=["crime"], requires=["anyParent"],
   flags_all=["cri.first"],
   effects=FX(stats={"happiness": -4, "discipline": 1}, relationship={"parents": -6}))

E("talent.cri.forged-note", "talent", [
    "Forged a signature convincingly enough that it was used for two years.",
], age_min=10, age_max=17, weight=11, talents_any=["crime"], cooldown=4,
   effects=FX(stats={"smarts": 2, "discipline": -1}))

E("talent.cri.playground-economy", "talent", [
    "Ran a trade in banned goods at school. It cleared about $140 before anyone noticed.",
], age_min=9, age_max=17, weight=12, talents_any=["crime"], cooldown=3,
   effects=FX(cash=CASH(140, "selling banned goods at school"),
              stats={"charisma": 3, "smarts": 2, "discipline": -1}, behaviour=-7))

E("talent.cri.lookout", "talent", [
    "Was the lookout. Was good at it. Did not enjoy discovering that.",
], age_min=11, age_max=17, weight=10, talents_any=["crime"], cooldown=4,
   effects=FX(stats={"willpower": 2, "happiness": -1}))

E("talent.cri.older-crew", "talent", [
    "An older crowd started including you in things they did not explain in advance.",
], age_min=13, age_max=17, weight=9, talents_any=["crime"], rarity="uncommon",
   effects=FX(stats={"charisma": 2, "discipline": -2}, set_flags=["cri.crew"]))

E("talent.cri.walked-away", "talent", [
    "Was there when it went wrong, and was the one who walked away before it did.",
], age_min=13, age_max=17, weight=8, talents_any=["crime"], flags_all=["cri.crew"],
   effects=FX(stats={"willpower": 4, "smarts": 2}))

# ---- talentless characters get their own thread ------------------------------

E("talent.none.searching", "talent", [
    "Tried four different clubs looking for the thing, and did not find it this year.",
], age_min=8, age_max=16, weight=11, cooldown=3,
   talents_none=["athletics", "acting", "music", "writing", "academics", "inventive", "crime"],
   effects=FX(stats={"charisma": 1, "willpower": 2}))

E("talent.none.grafted", "talent", [
    "Was not the best at anything and got better at everything by simply not stopping.",
], age_min=10, age_max=17, weight=10, cooldown=3,
   talents_none=["athletics", "acting", "music", "writing", "academics", "inventive", "crime"],
   effects=FX(stats={"discipline": 3, "willpower": 3}))



# =============================================================================
# DECISIONS AND OPPORTUNITIES
#
# Rewritten wholesale for Ticket 0203b, to the standard in
# claude/event-writing-rules.md. The product owner rejected the first version as
# "extremely boring", and the example he gave is the standard:
#
#   BEFORE  "You have been rehearsing a conversation with somebody for four
#            months." [Say something] [Say nothing]
#            -> "You said it. They were kind about it. It still took months."
#
#   AFTER   a named person, a place, something happening right now, three or four
#           different TACTICS, and outcomes that can land badly.
#
# The rules, applied to every entry below:
#   - Name the other person. `person_tokens` binds them once, so the prompt and
#     the outcome mean the same person.
#   - Set a scene. Never "you have been feeling X for N months".
#   - Three or more options unless the situation genuinely has two answers
#     (binary_ok=True), and options must be different approaches, not the same
#     approach at two volumes.
#   - Outcomes are concrete. The test: could you film it? "It still took months"
#     is a verdict. "{kid} laughed so hard she snorted water" is an event.
#   - Happiness always moves, and not every outcome may be positive.
#   - Health wherever it is physical, exhausting, dangerous or restful.
#   - Money only ever with CASH(), and the text names the amount.
# =============================================================================

# ---- the two the product owner called out ----------------------------------

# REPLACES d.friend.confession, the "rehearsing a conversation" decision.
D("d.friend.crush", "friendship", [
    "{kid} is at the water fountain on {kidTheir} own and the bell is not for six minutes. You have had a crush on {kidThem} since September.",
    "{kid} is sitting on the wall by the bike racks alone. You have thought about talking to {kidThem} since September.",
], [
    C("compliment", "Compliment {kidTheir} jacket", outcomes=[
        OUT(5, "{kid} was flattered — {kidThey} said nobody ever notices that jacket, and asked where you sit at lunch.",
            FX(stats={"happiness": 6, "charisma": 3})),
        OUT(3, "{kid} said 'okay' in a completely flat voice. You heard about it from three different people by Friday.",
            FX(stats={"happiness": -5, "charisma": -1})),
        OUT(2, "{kid} was visibly creeped out and moved to the other fountain.",
            FX(stats={"happiness": -6, "charisma": -3})),
    ]),
    C("ask-day", "Ask about {kidTheir} day", outcomes=[
        OUT(6, "{kid} talked for the full six minutes about {kidTheir} sister's dog. You were late to class and did not care.",
            FX(stats={"happiness": 5, "charisma": 2})),
        OUT(4, "{kid} said 'fine.' That was the entire conversation.",
            FX(stats={"happiness": -3})),
    ]),
    C("joke", "Make a silly joke", outcomes=[
        OUT(4, "{kid} laughed so hard {kidThey} snorted water out of {kidTheir} nose, and then could not look at you.",
            FX(stats={"happiness": 7, "charisma": 4})),
        OUT(6, "{kid} cringed. You replayed it in your head every night for a week.",
            FX(stats={"happiness": -6, "willpower": 2})),
    ]),
    C("nothing", "Walk past", text="You walked past {kid} and the bell went. Nothing happened, which was the point.",
      effects=FX(stats={"happiness": -2, "willpower": -1})),
], age_min=11, age_max=17, weight=14, cooldown=3, person_tokens=["kid"],
   modifiers=[MOD(1.5, stat_at_least={"looks": 65}), MOD(1.4, stat_at_least={"charisma": 68})])

# REPLACES d.school.club, which allowed exactly one pick, forever. Now it points
# at the real menu — see Ticket 0204's Clubs & Teams screen.
D("d.school.signup-table", "school", [
    "A folding table went up in the gym at lunch with a clipboard on it. Your school has activities available to join.",
    "Sign-up sheets went up outside the office. Somebody has already written a fake name at the top of every one.",
], [
    C("see", "See what they offer", opens="activities",
      text="You went and had a proper look at what the school had on offer.",
      effects=FX(stats={"happiness": 2})),
    C("ask-around", "Ask {kid} what {kidThey} does", outcomes=[
        OUT(6, "{kid} talked you into the same thing {kidThey} does, and it turned out to be a good year for it.",
            FX(stats={"happiness": 4, "charisma": 3})),
        OUT(4, "{kid} said all of it was for losers, which you believed at the time.",
            FX(stats={"happiness": -2, "charisma": 1})),
    ]),
    C("pass", "Pass",
      text="You walked past the sign-up table. The gym smelled like floor polish.",
      effects=FX(stats={"happiness": -2})),
], age_min=8, age_max=17, weight=16, cooldown=2, person_tokens=["kid"],
   school_stage_any=["elementary", "middle", "high"])


# ---- family -----------------------------------------------------------------

D("d.family.broken-bowl", "family", [
    "{sibling} knocked {mother}'s ceramic bowl off the counter and it broke into four pieces. {sibling} is staring at you. {mother} is in the next room.",
], [
    C("own", "Say you did it", outcomes=[
        OUT(6, "You took the blame. {mother} grounded you for a week, and {sibling} left a candy bar on your pillow.",
            FX(stats={"happiness": -2, "willpower": 3}, relationship={"siblings": 9, "mother": -3})),
        OUT(4, "You took the blame and {mother} did not believe you for a second. She grounded {sibling} anyway.",
            FX(stats={"happiness": -3, "charisma": -1}, relationship={"siblings": 4})),
    ]),
    C("tell", "Tell {mother} what happened",
      text="You told {mother} the truth. {sibling} got grounded and did not speak to you for three days.",
      effects=FX(stats={"happiness": -3, "discipline": 2}, relationship={"siblings": -9, "mother": 4})),
    C("glue", "Glue it before she notices", outcomes=[
        OUT(5, "You and {sibling} glued the bowl badly. {mother} found out a week later and was angrier about the glue than the bowl.",
            FX(stats={"happiness": -5}, relationship={"mother": -6, "siblings": 3})),
        OUT(5, "You and {sibling} glued the bowl and {mother} never noticed. It is still on the shelf.",
            FX(stats={"happiness": 6, "smarts": 1}, relationship={"siblings": 8})),
    ]),
    C("cat", "Blame the cat",
      text="{mother} pointed out that the cat has been at the vet since Tuesday.",
      effects=FX(stats={"happiness": -5, "charisma": -2}, relationship={"mother": -5})),
], age_min=6, age_max=16, weight=13, requires=["sibling", "mother"], person_tokens=[])

D("d.family.birthday-money", "family", [
    "It is your birthday and {sibling} handed you an envelope with $25 in it, saved out of {siblingRel}'s own allowance.",
], [
    C("spend", "Spend it all today", outcomes=[
        OUT(6, "Blew the whole $25 on comics and candy at the corner store in one afternoon. Worth it.",
            FX(cash=CASH(-25, "comics and candy at the corner store"),
               stats={"happiness": 6, "health": -1, "discipline": -2})),
        OUT(4, "Spent the $25 on a toy that broke the same afternoon.",
            FX(cash=CASH(-25, "a toy that broke the same day"),
               stats={"happiness": -5, "smarts": 1})),
    ]),
    C("save", "Put it away",
      text="Put the $25 birthday money in the coffee can under your bed and left it there.",
      effects=FX(stats={"happiness": 2, "discipline": 4, "willpower": 2})),
    C("split", "Give half back to {sibling}",
      text="Gave {sibling} back half the birthday money, $12. {siblingRel} tried to refuse and you made {them} take it.",
      effects=FX(cash=CASH(-12, "half the birthday money, given back to {sibling}"),
                 stats={"happiness": 5}, relationship={"siblings": 10})),
], age_min=7, age_max=16, weight=12, cooldown=6, requires=["sibling"],
   effects=FX(cash=CASH(25, "birthday money from {sibling}")))

D("d.family.yard", "family", [
    "{father} has been on double shifts and the yard has got away from him. He has not asked you to do anything about it.",
], [
    C("mow", "Mow it before he gets home", outcomes=[
        OUT(5, "You mowed the whole yard in July heat and threw up behind the shed. {father} hugged you anyway.",
            FX(stats={"health": -4, "happiness": 5, "willpower": 3}, relationship={"father": 9})),
        OUT(5, "You mowed the yard before {father} got home. He sat on the back step and looked at it for a long time.",
            FX(stats={"health": -1, "happiness": 5}, relationship={"father": 8})),
    ]),
    C("ask", "Ask him what he needs", outcomes=[
        OUT(6, "You asked {father} what he needed. He said 'company', and you sat out there until it got dark.",
            FX(stats={"happiness": 6}, relationship={"father": 9})),
        OUT(4, "You asked {father} what he needed and he snapped at you. He apologised an hour later.",
            FX(stats={"happiness": -3}, relationship={"father": 1})),
    ]),
    C("leave", "Leave it",
      text="The yard stayed long all summer. Nobody said a word about it, which was somehow worse.",
      effects=FX(stats={"happiness": -3}, relationship={"father": -3})),
], age_min=9, age_max=17, weight=12, cooldown=5, requires=["father"], physical=True)

D("d.family.chore-money", "family", [
    "{parent} has offered $30 for a genuinely unpleasant weekend of clearing out the garage.",
], [
    C("take", "Take the job",
      text="You cleared the garage over two days, found a dead mouse, and got your $30.",
      effects=FX(cash=CASH(30, "clearing out the garage"),
                 stats={"discipline": 4, "health": -1, "happiness": 1}, relationship={"parents": 4})),
    C("negotiate", "Try for more", outcomes=[
        OUT(5, "You talked {parent} up to $50, which was noticed and quietly respected.",
            FX(cash=CASH(50, "clearing the garage, after negotiating"),
               stats={"charisma": 4, "happiness": 3}, relationship={"parents": 3})),
        OUT(5, "You pushed, the offer was withdrawn, and {sibling} did it instead for the original $30.",
            FX(stats={"charisma": 1, "happiness": -4}, relationship={"parents": -3}),
            ),
    ], requires=COND(requires=["sibling"])),
    C("free", "Do it for nothing",
      text="You did the garage without taking the money. {parent} brought it up for years afterwards.",
      effects=FX(stats={"happiness": 3, "willpower": 3}, relationship={"parents": 8})),
    C("refuse", "Refuse",
      text="You had better things to do that weekend, and you did them.",
      effects=FX(stats={"happiness": 3}, relationship={"parents": -4})),
], age_min=9, age_max=17, requires=["anyParent"], weight=13, cooldown=4, physical=True)

D("d.family.sibling-secret", "family", [
    "{sibling} has done something that is going to come out eventually, and has just asked you to sit on it.",
], [
    C("keep", "Keep quiet", outcomes=[
        OUT(6, "You kept it. It never came out, and {sibling} has not forgotten that you did.",
            FX(stats={"happiness": 2, "willpower": 3}, relationship={"siblings": 10})),
        OUT(4, "You kept it, it came out anyway, and you were standing next to {sibling} when it did.",
            FX(stats={"happiness": -5}, relationship={"siblings": 4, "parents": -5})),
    ]),
    C("tell", "Tell {parent}",
      text="You told {parent}. It was probably the right call and it did not feel like one for a month.",
      effects=FX(stats={"happiness": -4, "discipline": 3}, relationship={"siblings": -10, "parents": 4})),
    C("make-fix", "Make {sibling} fix it", outcomes=[
        OUT(5, "You talked {sibling} into owning up before anyone found out. It went far better than it should have.",
            FX(stats={"happiness": 4, "charisma": 5}, relationship={"siblings": 6})),
        OUT(5, "{sibling} agreed to sort it out and then did not, and it landed on both of you.",
            FX(stats={"happiness": -4}, relationship={"siblings": -4, "parents": -3})),
    ]),
], age_min=8, age_max=17, requires=["sibling", "anyParent"], weight=13)

D("d.family.report-card", "family", [
    "The report is in your bag, it is not good, and {parent} has not asked about it yet.",
], [
    C("hand-over", "Hand it over", outcomes=[
        OUT(6, "You handed it over. It was a bad hour and a much better month.",
            FX(stats={"happiness": -2, "discipline": 4}, relationship={"parents": 4}, behaviour=4)),
        OUT(4, "You handed it over and it went far worse than the report deserved. Nobody spoke at dinner for a week.",
            FX(stats={"happiness": -6, "willpower": 3}, relationship={"parents": -6})),
    ]),
    C("hide", "Lose it", outcomes=[
        OUT(5, "It was never found. You spent four months waiting for it to be.",
            FX(stats={"happiness": -3, "discipline": -3})),
        OUT(5, "It surfaced in March, which made it a much larger problem than it had ever been in October.",
            FX(stats={"happiness": -6}, relationship={"parents": -9}, behaviour=-6)),
    ]),
    C("preempt", "Get in first with a plan",
      text="You handed it over with a plan already written down. {parent} was too surprised to shout.",
      effects=FX(stats={"happiness": 2, "discipline": 5, "charisma": 3}, relationship={"parents": 5})),
], age_min=9, age_max=17, requires=["anyParent"], weight=13, cooldown=3,
   modifiers=[MOD(1.8, stat_at_most={"discipline": 45})])

D("d.family.parent-asks", "family", [
    "{parent} sat down on the end of your bed and asked, without warning, whether you are all right.",
], [
    C("honest", "Tell them the truth", outcomes=[
        OUT(7, "You told {parent} the truth. They listened better than you had expected them to.",
            FX(stats={"happiness": 7, "health": 1}, relationship={"parents": 9})),
        OUT(3, "You told {parent} the truth and they did not know what to do with it. They tried, which counted.",
            FX(stats={"happiness": 2}, relationship={"parents": 3})),
    ]),
    C("deflect", "Say you're fine",
      text="You said you were fine. {parent} knew, and let it go, and turned the light off.",
      effects=FX(stats={"happiness": -3, "willpower": 1}, relationship={"parents": -2})),
    C("turn-it", "Ask them the same thing", outcomes=[
        OUT(6, "You asked {parent} the same question back. They sat there a long time before answering.",
            FX(stats={"happiness": 4, "charisma": 3}, relationship={"parents": 7})),
        OUT(4, "You asked {parent} the same question back and they laughed it off and left.",
            FX(stats={"happiness": -2, "charisma": 1})),
    ]),
], age_min=11, age_max=17, requires=["anyParent"], weight=12, cooldown=4,
   modifiers=[MOD(2.0, stat_at_most={"happiness": 40})])

D("d.family.holiday-choice", "family", [
    "The family holiday is being decided at the kitchen table and, unusually, you have been given a vote.",
], [
    C("push", "Push for what you want", outcomes=[
        OUT(5, "You got your way and it was a great week. Everybody said so, more than once.",
            FX(stats={"happiness": 6, "charisma": 3, "health": 1}, relationship={"family": 3})),
        OUT(5, "You got your way and it rained for six days, which was mentioned at every meal.",
            FX(stats={"happiness": -4, "charisma": 1}, relationship={"family": -4})),
    ]),
    C("defer", "Let {sibling} pick",
      text="You let {sibling} pick, which bought you something you cashed in months later.",
      effects=FX(stats={"happiness": 1, "willpower": 2}, relationship={"siblings": 8})),
    C("stay", "Argue for staying home",
      text="You argued for staying home. You got eleven days on your own street and no photographs at all.",
      effects=FX(stats={"happiness": 3, "charisma": -1}, relationship={"family": -2})),
], age_min=8, age_max=16, requires=["anyParent", "sibling"], weight=11, cooldown=5)

D("d.family.parent-favour", "family", [
    "{parent} needs a hand with something all Saturday, and you had plans with {kid}.",
], [
    C("help", "Cancel and help",
      text="You cancelled on {kid} and helped. It took nine hours and was never mentioned again.",
      effects=FX(stats={"happiness": -2, "discipline": 3, "health": -1}, relationship={"parents": 9})),
    C("plans", "Keep your plans",
      text="You went out with {kid}. It was a good day with a shadow on it.",
      effects=FX(stats={"happiness": 3}, relationship={"parents": -5})),
    C("both", "Try to do both", outcomes=[
        OUT(4, "You did half of each and somehow got away with it.",
            FX(stats={"happiness": 3, "charisma": 3, "health": -2})),
        OUT(6, "You did half of each badly, and both {parent} and {kid} noticed.",
            FX(stats={"happiness": -4, "health": -2}, relationship={"parents": -3})),
    ]),
], age_min=10, age_max=17, requires=["anyParent"], weight=12, cooldown=4, person_tokens=["kid"])

D("d.family.grandparent", "family", [
    "A grandparent is in hospital for a week, and visiting means giving up the one thing you had planned.",
], [
    C("visit", "Go and sit with them",
      text="You went. It was awkward for ten minutes and then they told you a story nobody else in the family had heard.",
      effects=FX(stats={"happiness": 3, "willpower": 2}, relationship={"family": 6})),
    C("bring", "Take something in for them", outcomes=[
        OUT(7, "You took in the newspaper and the boiled sweets they liked, every day that week.",
            FX(stats={"happiness": 5, "health": -1, "willpower": 4}, relationship={"family": 10})),
        OUT(3, "You took things in and they were asleep for most of it. You sat there anyway.",
            FX(stats={"happiness": -2, "willpower": 4}, relationship={"family": 6})),
    ]),
    C("skip", "Skip it",
      text="You did not go. Nobody said anything about it, which was worse than if they had.",
      effects=FX(stats={"happiness": -5}, relationship={"family": -4})),
], age_min=9, age_max=17, weight=10, rarity="uncommon")

D("d.family.pet", "family", [
    "There is a serious conversation happening about a dog, and {parent} has used the word 'responsibility' four times.",
], [
    C("promise", "Promise everything", outcomes=[
        OUT(6, "You promised everything, got the dog, and did about half of it. The dog did not mind.",
            FX(stats={"happiness": 7, "health": 2, "discipline": 1}, relationship={"parents": -2})),
        OUT(4, "You promised everything and, to universal astonishment, did all of it for four years.",
            FX(stats={"happiness": 7, "health": 3, "discipline": 5}, relationship={"parents": 6})),
    ]),
    C("honest", "Be honest about it",
      text="You said you probably would not keep it up. The answer was no, and it was fair.",
      effects=FX(stats={"happiness": -3, "willpower": 3}, relationship={"parents": 5})),
    C("trial", "Offer a trial run", outcomes=[
        OUT(6, "You proposed fostering first. It worked, and the foster dog never left.",
            FX(stats={"happiness": 6, "smarts": 2, "health": 2}, relationship={"parents": 5})),
        OUT(4, "You proposed fostering first, and after three weeks the dog went to somebody else.",
            FX(stats={"happiness": -5, "willpower": 2})),
    ]),
], age_min=6, age_max=14, requires=["anyParent"], weight=12, physical=True)

D("d.family.sibling-broke-it", "family", [
    "{sibling} has taken something of yours and broken it, and is standing in your doorway holding both halves.",
], [
    C("shout", "Lose it", outcomes=[
        OUT(6, "You lost it completely. {sibling} was punished and the house stayed sour for months.",
            FX(stats={"happiness": -4, "willpower": -2}, relationship={"siblings": -9})),
        OUT(4, "You lost it, and you were the one who ended up in trouble, for the noise.",
            FX(stats={"happiness": -5}, relationship={"siblings": -5, "parents": -4}, behaviour=-3)),
    ]),
    C("let-go", "Let it go",
      text="You said it was fine. {sibling} noticed that you had, which was the entire point.",
      effects=FX(stats={"happiness": -1, "willpower": 4}, relationship={"siblings": 7})),
    C("make-pay", "Make {sibling} replace it", outcomes=[
        OUT(5, "{sibling} paid you back over four months out of {siblingRel}'s own allowance. $18, in coins.",
            FX(cash=CASH(18, "{sibling} paying you back for what {siblingRel} broke"),
               stats={"happiness": 2, "discipline": 2}, relationship={"siblings": -2})),
        OUT(5, "{sibling} agreed to pay you back and never did, and you brought it up for years.",
            FX(stats={"happiness": -3}, relationship={"siblings": -5})),
    ]),
], age_min=6, age_max=16, requires=["sibling"], weight=13, cooldown=4,
   modifiers=[MOD(1.5, stat_at_most={"willpower": 40})])

D("d.family.move-away", "family", [
    "The family is leaving {city}, and you have been asked what you think about it, which has never happened before.",
], [
    C("support", "Say you're fine with it",
      text="You said you were fine with it. Some of that was even true.",
      effects=FX(stats={"happiness": -3, "willpower": 3}, relationship={"parents": 6})),
    C("fight", "Fight it", outcomes=[
        OUT(3, "You made enough of a case that the move was put back a year.",
            FX(stats={"happiness": 5, "charisma": 5}, relationship={"parents": -2})),
        OUT(7, "You lost the argument and the move happened on schedule, and you had said all of that for nothing.",
            FX(stats={"happiness": -6, "willpower": 2}, relationship={"parents": -5})),
    ]),
    C("terms", "Ask for something in return", outcomes=[
        OUT(6, "You agreed to the move in exchange for one condition, and {parent} kept to it.",
            FX(stats={"happiness": 2, "charisma": 4, "smarts": 2}, relationship={"parents": 3})),
        OUT(4, "You agreed to the move in exchange for a promise that was quietly forgotten by August.",
            FX(stats={"happiness": -5, "charisma": 2}, relationship={"parents": -4})),
    ]),
], age_min=8, age_max=16, requires=["anyParent"], weight=9, rarity="uncommon")


# ---- school -----------------------------------------------------------------

D("d.school.cheat", "school", [
    "{kid} has slid {kidTheir} maths test an inch to the left so you can see it. {adult} is at the window.",
], [
    C("copy", "Copy it", outcomes=[
        OUT(5, "You copied {kid}'s answers and got an 88. {KidThey} got an 84.",
            FX(stats={"happiness": 2, "discipline": -2})),
        OUT(5, "You copied and {adult} saw it happen. You both got zeros and a phone call home.",
            FX(stats={"happiness": -6, "discipline": -3}, relationship={"parents": -6}, behaviour=-16)),
    ]),
    C("own-work", "Look away",
      text="You looked away and got a 61 that was entirely yours.",
      effects=FX(stats={"happiness": -2, "willpower": 4, "discipline": 2})),
    C("warn", "Hiss at {kidThem} to move it",
      text="You hissed at {kid} to move {kidTheir} paper. {KidThey} did, and {kidThey} never sat near you again.",
      effects=FX(stats={"happiness": -3, "charisma": -2, "discipline": 2}, behaviour=2)),
], age_min=9, age_max=17, weight=13, person_tokens=["kid", "adult"],
   modifiers=[MOD(1.7, talents_any=["crime"]), MOD(0.5, stat_at_least={"discipline": 70})])

D("d.school.study-hard", "school", [
    "Exams are eight weeks out and {adult} has just handed back a practice paper with a number on it you did not expect.",
], [
    C("grind", "Work for it", outcomes=[
        OUT(7, "You worked. Something clicked around week five and the real paper was easy.",
            FX(stats={"smarts": 5, "discipline": 4, "happiness": 2, "health": -1})),
        OUT(3, "You worked hard and the results were middling anyway, which was its own lesson.",
            FX(stats={"discipline": 4, "willpower": 3, "happiness": -3, "health": -1})),
    ]),
    C("ask-help", "Ask {adult} for help", outcomes=[
        OUT(6, "{adult} gave you an hour a week for two months and you have never forgotten it.",
            FX(stats={"smarts": 5, "happiness": 4, "charisma": 2}, behaviour=6)),
        OUT(4, "{adult} said {adultThey} would help and then was off sick for a month.",
            FX(stats={"happiness": -3, "willpower": 2})),
    ]),
    C("coast", "Coast",
      text="You coasted. It was a very good couple of months and a mediocre set of results.",
      effects=FX(stats={"happiness": 4, "health": 1, "smarts": -1, "discipline": -3})),
], age_min=12, age_max=17, weight=13, cooldown=3, person_tokens=["adult"])

D("d.school.bully-response", "school", [
    "{kid} has been making your year difficult since October, and is standing in front of you in an empty corridor.",
], [
    C("fight", "Hit {kidThem}", outcomes=[
        OUT(5, "You hit {kid}. It stopped completely, and you were suspended for a week.",
            FX(stats={"willpower": 5, "happiness": 3, "health": -1}, relationship={"parents": -4},
               behaviour=-18, clear_flags=["school.bullied"])),
        OUT(5, "You hit {kid}, lost, and it got considerably worse before it got better.",
            FX(stats={"health": -4, "happiness": -5, "willpower": 3}, behaviour=-12)),
    ]),
    C("tell", "Tell {adult}", outcomes=[
        OUT(6, "{adult} handled it quietly and well, and it ended within a fortnight.",
            FX(stats={"happiness": 5}, behaviour=4, clear_flags=["school.bullied"])),
        OUT(4, "{adult} handled it badly, and it became a much more public problem than it had been.",
            FX(stats={"happiness": -5, "willpower": 2})),
    ]),
    C("endure", "Ride it out",
      text="You said nothing and waited {kid} out. It took another year.",
      effects=FX(stats={"willpower": 5, "happiness": -6, "health": -1})),
    C("disarm", "Get {kidThem} laughing", outcomes=[
        OUT(3, "You made {kid} laugh, and by Christmas you were something close to friends.",
            FX(stats={"charisma": 6, "happiness": 6}, clear_flags=["school.bullied"])),
        OUT(7, "You tried to make {kid} laugh and gave {kidThem} three new things to use.",
            FX(stats={"happiness": -5, "charisma": 1})),
    ]),
], age_min=8, age_max=17, weight=16, flags_all=["school.bullied"],
   person_tokens=["kid", "adult"], physical=True)

D("d.school.blame", "school", [
    "A window in the science block is broken and {adult} is asking the whole class, in a general sort of way, who did it.",
], [
    C("own", "Own up",
      text="You owned it. The punishment was smaller than the silence would have been.",
      effects=FX(stats={"willpower": 4, "discipline": 3, "happiness": -2}, behaviour=5)),
    C("silent", "Say nothing", outcomes=[
        OUT(6, "Nobody said anything and the whole class was kept back. It was never mentioned again.",
            FX(stats={"happiness": -2, "charisma": 2})),
        OUT(4, "{kid} named you within a day, and it landed much harder for the delay.",
            FX(stats={"happiness": -5}, relationship={"parents": -3}, behaviour=-12)),
    ]),
    C("blame", "Blame {kid}",
      text="You gave {adult} {kid}'s name. It worked, and it cost you a friend who worked out why.",
      effects=FX(stats={"charisma": -3, "happiness": -4, "discipline": -2}, behaviour=-4)),
], age_min=8, age_max=16, weight=12, person_tokens=["kid", "adult"])

D("d.school.speech", "school", [
    "{adult} has put your name down to speak in front of the whole school. It is optional in theory only.",
], [
    C("do", "Get up and do it", outcomes=[
        OUT(6, "You did it, and two teachers who had never spoken to you mentioned it afterwards.",
            FX(stats={"charisma": 6, "happiness": 5, "willpower": 3}, behaviour=5)),
        OUT(4, "You did it, it went badly, and you survived it — which was the actual lesson.",
            FX(stats={"charisma": 2, "willpower": 5, "happiness": -4})),
    ]),
    C("refuse", "Get out of it",
      text="You found a way out of it and felt the relief for about an hour.",
      effects=FX(stats={"happiness": -2, "charisma": -3})),
    C("rewrite", "Throw out the script", outcomes=[
        OUT(4, "You threw out the script {adult} gave you and wrote your own. The hall went quiet in the good way.",
            FX(stats={"charisma": 7, "happiness": 6, "smarts": 2})),
        OUT(6, "You threw out the script and it did not land, and {adult} was not pleased about either half.",
            FX(stats={"charisma": 1, "happiness": -4}, behaviour=-4)),
    ]),
], age_min=10, age_max=17, weight=12, cooldown=4, person_tokens=["adult"],
   modifiers=[MOD(1.6, talents_any=["acting"]), MOD(1.4, stat_at_least={"charisma": 65})])

D("d.school.reading-group", "school", [
    "{adult} has offered you a move up to the harder reading group, where you would be the youngest by a year.",
], [
    C("move", "Move up", outcomes=[
        OUT(6, "You moved up and kept pace, quietly, all year.",
            FX(stats={"smarts": 5, "discipline": 3, "happiness": 2})),
        OUT(4, "You moved up and struggled, in public, for two terms.",
            FX(stats={"smarts": 2, "happiness": -5, "willpower": 4})),
    ]),
    C("stay", "Stay where you are",
      text="You stayed put with your friends and coasted comfortably for a year.",
      effects=FX(stats={"happiness": 3, "charisma": 2, "smarts": -1})),
    C("trial", "Ask to try it for a term",
      text="You asked {adult} for a term's trial. {AdultThey} had not been asked that before and said yes.",
      effects=FX(stats={"smarts": 3, "charisma": 3, "discipline": 2, "happiness": 2})),
], age_min=6, age_max=11, weight=12, person_tokens=["adult"],
   modifiers=[MOD(1.8, talents_any=["academics"])])

D("d.school.team-tryout", "school", [
    "Trials for the school team are on Thursday and {kid} has been going on about them for a fortnight.",
], [
    C("try", "Try out", outcomes=[
        OUT(5, "You made the squad. Not the first eleven, but the squad, and {kid} did not.",
            FX(stats={"health": 4, "charisma": 3, "happiness": 5})),
        OUT(5, "You were cut on the first day, in front of everyone, and {kid} made the team.",
            FX(stats={"happiness": -6, "willpower": 4, "health": 1})),
    ]),
    C("train-first", "Train for a month first", outcomes=[
        OUT(6, "You trained for a month before the trial and walked it.",
            FX(stats={"health": 5, "discipline": 5, "happiness": 5})),
        OUT(4, "You trained for a month, pulled something in week three, and missed the trial entirely.",
            FX(stats={"health": -4, "happiness": -5, "discipline": 3})),
    ]),
    C("skip", "Don't bother",
      text="You did not go. It was the sensible call and it sat badly for about a year.",
      effects=FX(stats={"happiness": -3, "willpower": -1})),
], age_min=8, age_max=16, weight=13, cooldown=4, person_tokens=["kid"], physical=True,
   modifiers=[MOD(2.4, talents_any=["athletics"]), MOD(0.6, stat_at_most={"health": 45})])

D("d.school.instrument", "school", [
    "{adult} is handing out instruments, and whatever you pick you are stuck with for years.",
], [
    C("loud", "The loudest one on the table",
      text="You picked the loudest thing on the table and never once regretted it.",
      effects=FX(stats={"happiness": 5, "charisma": 3, "discipline": 1})),
    C("serious", "The hard one",
      text="You picked the hard one and practised like it mattered, and after two years it did.",
      effects=FX(stats={"discipline": 5, "smarts": 2, "happiness": 2})),
    C("none", "Don't take one",
      text="You did not take one, and spent three years of assemblies watching other people play.",
      effects=FX(stats={"happiness": -2, "charisma": -1})),
], age_min=7, age_max=13, weight=12, person_tokens=["adult"],
   modifiers=[MOD(2.0, talents_any=["music"])])

D("d.school.detention-clash", "school", [
    "{adult} has given you detention on Thursday, and Thursday is the one evening you had wanted all year.",
], [
    C("serve", "Serve it",
      text="You sat out the detention and heard about the evening secondhand for a month.",
      effects=FX(stats={"happiness": -4, "discipline": 3}, behaviour=7)),
    C("skip", "Skip it and go", outcomes=[
        OUT(5, "You skipped detention, went anyway, and nobody ever followed it up.",
            FX(stats={"happiness": 6}, behaviour=-7)),
        OUT(5, "You skipped detention and it became a much bigger thing than the detention had been.",
            FX(stats={"happiness": -5}, behaviour=-16, relationship={"parents": -4})),
    ]),
    C("ask", "Ask {adult} to move it", outcomes=[
        OUT(4, "{adult} moved it to Monday, which nobody expected including you.",
            FX(stats={"charisma": 5, "happiness": 5}, behaviour=3)),
        OUT(6, "{adult} said that was rather the point of a detention.",
            FX(stats={"charisma": 1, "happiness": -3})),
    ]),
], age_min=11, age_max=17, weight=12, cooldown=4, person_tokens=["adult"],
   school_stage_any=["middle", "high"])


# ---- friendship -------------------------------------------------------------

D("d.friend.dare", "friendship", [
    "{kid} has proposed jumping the gap between the bike shed roof and the wall, and about nine people are watching.",
], [
    C("do-it", "Do it", outcomes=[
        OUT(5, "You made it. You were a legend for roughly six weeks.",
            FX(stats={"charisma": 6, "happiness": 6, "willpower": 2, "health": -1})),
        OUT(4, "You did not make it. There was blood, and an adult, and a story that outlived the injury.",
            FX(stats={"health": -5, "charisma": 3, "happiness": -2})),
        OUT(2, "You did not make it, and somebody's parents were called, and yours came to get you.",
            FX(stats={"health": -6, "happiness": -5}, relationship={"parents": -5}, behaviour=-8)),
    ]),
    C("refuse", "Refuse",
      text="You said no. It cost you something socially and nothing else.",
      effects=FX(stats={"willpower": 5, "charisma": -3, "happiness": -2})),
    C("counter", "Dare {kid} instead", outcomes=[
        OUT(5, "You told {kid} to go first. {KidThey} did, badly, and nobody mentioned your turn again.",
            FX(stats={"charisma": 5, "happiness": 4, "willpower": 2})),
        OUT(5, "You told {kid} to go first. {KidThey} did it perfectly, and then everybody looked at you.",
            FX(stats={"charisma": -2, "happiness": -4, "willpower": 1})),
    ]),
], age_min=7, age_max=17, weight=14, cooldown=4, person_tokens=["kid"], physical=True,
   modifiers=[MOD(1.6, talents_any=["athletics", "crime"]), MOD(0.5, stat_at_least={"discipline": 72})])

D("d.friend.new-kid", "friendship", [
    "There is a new kid, {kid}, eating lunch alone by the recycling bins, and you already have a seat at a table.",
], [
    C("invite", "Bring {kid} over", outcomes=[
        OUT(7, "You brought {kid} over. It turned into one of the good ones — years of it.",
            FX(stats={"charisma": 4, "happiness": 6})),
        OUT(3, "You brought {kid} over and it did not take. You were still glad you had.",
            FX(stats={"charisma": 3, "happiness": 2})),
    ]),
    C("sit-there", "Sit with {kid} instead",
      text="You took your tray over to {kid} instead. Your own table noticed, and said so.",
      effects=FX(stats={"charisma": 2, "happiness": 4, "willpower": 3})),
    C("leave", "Leave it",
      text="You left it. Somebody else did it a week later and you remember that too.",
      effects=FX(stats={"happiness": -3})),
], age_min=7, age_max=17, weight=13, cooldown=5, person_tokens=["kid"])

D("d.friend.exclusion", "friendship", [
    "The group has decided to freeze {kid2} out, and {kid} is watching to see what you do about it.",
], [
    C("join", "Go along with it",
      text="You went along with it. It was easy, and it is one of the ones that stayed with you.",
      effects=FX(stats={"charisma": 2, "happiness": -5, "willpower": -2})),
    C("refuse", "Refuse", outcomes=[
        OUT(5, "You refused, and the whole thing broke up within a week.",
            FX(stats={"willpower": 5, "charisma": 3, "happiness": 4})),
        OUT(5, "You refused, and were frozen out alongside {kid2}.",
            FX(stats={"willpower": 5, "charisma": -4, "happiness": -5})),
    ]),
    C("quiet", "Say nothing, sit with {kid2} anyway", outcomes=[
        OUT(6, "You did not argue about it, you just sat with {kid2} every lunchtime until it stopped mattering.",
            FX(stats={"willpower": 4, "happiness": 3, "charisma": 1})),
        OUT(4, "You sat with {kid2} and lost {kid} over it without a word ever being said.",
            FX(stats={"willpower": 3, "happiness": -3, "charisma": -2})),
    ]),
], age_min=9, age_max=17, weight=13, person_tokens=["kid", "kid2"])

D("d.friend.stand-up", "friendship", [
    "{kid} is being humiliated in front of thirty people in the cafeteria and nobody has moved.",
], [
    C("step-in", "Step in", outcomes=[
        OUT(6, "You stepped in. It stopped, and it cost you nothing you could measure.",
            FX(stats={"willpower": 5, "charisma": 4, "happiness": 5})),
        OUT(4, "You stepped in and it turned on you for the rest of term.",
            FX(stats={"willpower": 6, "happiness": -5, "charisma": -2, "health": -1})),
    ]),
    C("laugh", "Laugh along",
      text="You laughed with everyone else. {kid} saw you do it.",
      effects=FX(stats={"charisma": 1, "happiness": -5, "willpower": -3})),
    C("after", "Find {kid} afterwards",
      text="You did not step in, but you found {kid} afterwards by the lockers and stayed a while.",
      effects=FX(stats={"happiness": 2, "charisma": 2, "willpower": 1})),
    C("leave", "Walk out",
      text="You left the room. Not brave, not complicit, and not forgotten either.",
      effects=FX(stats={"happiness": -2, "willpower": 1})),
], age_min=9, age_max=17, weight=13, person_tokens=["kid"])

D("d.friend.betrayal", "friendship", [
    "{kid} told everyone what you said about {kid2}'s house. {kid2} is not speaking to you and {kid} is acting like nothing happened.",
], [
    C("apologise", "Apologise to {kid2}", outcomes=[
        OUT(5, "You apologised to {kid2} at {kid2Their} locker. {Kid2They} said 'okay', and it took until March to be normal.",
            FX(stats={"happiness": -2, "charisma": 2, "willpower": 3})),
        OUT(5, "You apologised and {kid2} cried and hugged you, and {kid} was furious you had made {kidThem} look bad.",
            FX(stats={"happiness": 5, "charisma": 3})),
    ]),
    C("confront", "Have it out with {kid}", outcomes=[
        OUT(5, "You told {kid} exactly what you thought of {kidThem} in front of six people. {KidThey} did not deny any of it.",
            FX(stats={"happiness": -3, "willpower": 4, "charisma": 1})),
        OUT(5, "You confronted {kid} and {kidThey} cried, which you had not expected at all.",
            FX(stats={"happiness": -2, "charisma": 2})),
    ]),
    C("blow-over", "Let it blow over",
      text="It blew over by Easter. {kid2} never quite trusted you again and never said so.",
      effects=FX(stats={"happiness": -5, "charisma": -1})),
], age_min=9, age_max=17, weight=12, person_tokens=["kid", "kid2"])

D("d.friend.homework", "friendship", [
    "{kid} wants the homework ten minutes before it is due, and is asking as a friend.",
], [
    C("give", "Hand it over",
      text="You handed it over. {kid} copied it word for word, including a mistake, and {adult} noticed.",
      effects=FX(stats={"charisma": 2, "discipline": -2, "happiness": -1}, behaviour=-5)),
    C("explain", "Explain it instead",
      text="You walked {kid} through it in eight minutes and were late to your own lesson.",
      effects=FX(stats={"smarts": 3, "charisma": 4, "happiness": 3})),
    C("refuse", "Say no",
      text="You said no. {kid} found somebody else within a minute and it was awkward for a fortnight.",
      effects=FX(stats={"discipline": 3, "charisma": -3, "happiness": -2})),
], age_min=9, age_max=17, weight=13, cooldown=3, person_tokens=["kid", "adult"])

D("d.friend.party", "friendship", [
    "{kid} is having people round on Saturday and {parent} has already said no to it, twice.",
], [
    C("sneak", "Go anyway", outcomes=[
        OUT(5, "You went, got back in through the window at one, and were never found out.",
            FX(stats={"happiness": 6, "charisma": 4, "health": -1, "discipline": -1})),
        OUT(5, "You went, and {parent} was sitting in the kitchen with the light on when you got back.",
            FX(stats={"happiness": -4, "charisma": 2}, relationship={"parents": -8})),
    ]),
    C("stay", "Stay home",
      text="You stayed home and heard about {kid}'s party for a month.",
      effects=FX(stats={"charisma": -3, "discipline": 3, "happiness": -3}, relationship={"parents": 4})),
    C("negotiate", "Talk {parent} round", outcomes=[
        OUT(4, "You made a real case and got a curfew instead of a no.",
            FX(stats={"charisma": 5, "happiness": 5}, relationship={"parents": 3})),
        OUT(6, "The answer stayed no, and got firmer for the asking.",
            FX(stats={"charisma": 1, "happiness": -3})),
    ]),
    C("host", "Ask to host instead", outcomes=[
        OUT(5, "{parent} said yes to hosting, and eleven people came, and nothing was broken.",
            FX(stats={"happiness": 6, "charisma": 5}, relationship={"parents": 2})),
        OUT(5, "{parent} said yes to hosting, and something was broken, and it was expensive.",
            FX(stats={"happiness": -2, "charisma": 3}, relationship={"parents": -6})),
    ]),
], age_min=13, age_max=17, requires=["anyParent"], weight=14, cooldown=3, person_tokens=["kid"])

D("d.friend.birthday-clash", "friendship", [
    "{kid} and {kid2} are having birthdays on the same afternoon and both have asked you directly.",
], [
    C("close", "Go to {kid}'s",
      text="You went to {kid}'s. {kid2} noticed, and mentioned it in February.",
      effects=FX(stats={"happiness": 3, "charisma": -1})),
    C("new", "Turn up at {kid2}'s",
      text="You went to {kid2}'s, which surprised everybody including you, and it was the better party.",
      effects=FX(stats={"charisma": 3, "happiness": 4})),
    C("both", "An hour at each", outcomes=[
        OUT(5, "You did an hour at each and both of them were pleased you had bothered.",
            FX(stats={"charisma": 5, "happiness": 4, "health": -1})),
        OUT(5, "You did an hour at each and managed to annoy both of them.",
            FX(stats={"charisma": -2, "happiness": -4})),
    ]),
    C("neither", "Stay home",
      text="You went to neither and stayed home, which solved nothing at all.",
      effects=FX(stats={"happiness": -4, "charisma": -3})),
], age_min=7, age_max=15, weight=12, cooldown=5, person_tokens=["kid", "kid2"])

D("d.friend.cover", "friendship", [
    "{kid} broke something expensive at your house and the two of you are the only people who know.",
], [
    C("cover", "Take it yourself",
      text="You took it. {kid} knew you had, and the friendship changed shape after that.",
      effects=FX(stats={"willpower": 4, "happiness": -3}, relationship={"parents": -5})),
    C("truth", "Tell the truth",
      text="You told the truth. It was the correct thing to do and it ended the friendship.",
      effects=FX(stats={"discipline": 3, "happiness": -5, "charisma": -2})),
    C("together", "Make {kid} come with you", outcomes=[
        OUT(6, "You made {kid} come and own it with you. {parent} was more impressed than angry.",
            FX(stats={"charisma": 5, "willpower": 4, "happiness": 2}, relationship={"parents": 2})),
        OUT(4, "You made {kid} come with you and {kidThey} denied everything on the doorstep.",
            FX(stats={"happiness": -5, "charisma": -2}, relationship={"parents": -4})),
    ]),
], age_min=9, age_max=17, requires=["anyParent"], weight=11, person_tokens=["kid"])

D("d.friend.gift", "friendship", [
    "{kid}'s birthday is Saturday and you have $12 to your name.",
], [
    C("buy", "Buy {kidThem} something", outcomes=[
        OUT(5, "You spent the $12 on a present {kid} already had one of.",
            FX(cash=CASH(-12, "a birthday present for {kid}"), stats={"happiness": -3})),
        OUT(5, "You spent the $12 on a present {kid} carried around for the whole afternoon.",
            FX(cash=CASH(-12, "a birthday present for {kid}"), stats={"happiness": 5, "charisma": 2})),
    ]),
    C("make", "Make {kidThem} something", outcomes=[
        OUT(6, "You made {kid} a comic about the two of you. It went on {kidTheir} wall and stayed there.",
            FX(stats={"happiness": 6, "charisma": 3, "smarts": 1})),
        OUT(4, "You made {kid} a present and {kidTheir} cousin asked out loud why you had not just bought one.",
            FX(stats={"happiness": -5, "willpower": 2})),
    ]),
    C("nothing", "Turn up empty-handed",
      text="You went to {kid}'s with nothing. Nobody said a word about it and you thought about it all night.",
      effects=FX(stats={"happiness": -5})),
], age_min=8, age_max=16, weight=11, cooldown=5, person_tokens=["kid"])

D("d.friend.late-night", "friendship", [
    "{kid}'s parents are out and {kidThey} wants to stay up for the whole horror marathon.",
], [
    C("all-night", "Stay up all night", outcomes=[
        OUT(6, "You stayed up until six at {kid}'s and slept through Saturday entirely.",
            FX(stats={"health": -4, "happiness": 6, "charisma": 2})),
        OUT(4, "You stayed up all night at {kid}'s and had nightmares for a month.",
            FX(stats={"health": -4, "happiness": -5})),
    ]),
    C("two", "Turn in around two",
      text="You fell asleep at two on {kid}'s floor. Good night, no wreckage.",
      effects=FX(stats={"health": -1, "happiness": 5})),
    C("home", "Go home",
      text="You went home at eleven. {kid} brought it up for years.",
      effects=FX(stats={"health": 3, "happiness": -2, "charisma": -2})),
], age_min=10, age_max=17, weight=12, cooldown=3, person_tokens=["kid"], physical=True)

O("o.friend.mentor", "friendship", [
    "{kid}, who is three years above you and has no reason to, has started taking you seriously.",
], [
    C("stick", "Stick with {kid}", outcomes=[
        OUT(7, "{kid} taught you more in a year than school managed in three.",
            FX(stats={"smarts": 4, "charisma": 4, "discipline": 4, "happiness": 5})),
        OUT(3, "{kid} was not the influence anybody had hoped for, and the year got away from you.",
            FX(stats={"charisma": 4, "discipline": -4, "happiness": 2}, behaviour=-8)),
    ]),
    C("distance", "Keep your distance",
      text="You kept your distance, politely, and it faded out by spring.",
      effects=FX(stats={"willpower": 2, "happiness": -1})),
    C("ask", "Ask {kid} outright why",
      text="You asked {kid} why {kidThey} bothered with you. {KidThey} said you reminded {kidThem} of {kidThem}self, which was a lot to carry.",
      effects=FX(stats={"charisma": 3, "smarts": 2, "happiness": 3})),
], age_min=10, age_max=17, weight=10, person_tokens=["kid"])


# ---- random -----------------------------------------------------------------

D("d.random.wallet", "random", [
    "There is a wallet on the pavement outside Trujillo's Market with $60 in it and a driver's licence.",
], [
    C("hand-in", "Hand it in at the counter", outcomes=[
        OUT(6, "You handed it in at Trujillo's. The owner came back for it and gave you $20.",
            FX(cash=CASH(20, "a reward for handing in a found wallet"),
               stats={"happiness": 6, "willpower": 3})),
        OUT(4, "You left the wallet at the Trujillo's counter and never heard another word about it.",
            FX(stats={"happiness": 3, "willpower": 3})),
    ]),
    C("keep", "Take the cash", outcomes=[
        OUT(7, "You took the $60 and left the wallet on the pavement. Nobody ever came looking.",
            FX(cash=CASH(60, "cash taken from a wallet you found"),
               stats={"happiness": -3, "discipline": -3})),
        OUT(3, "You took the $60, and two weeks later the owner's son recognised you from the photo on the licence.",
            FX(cash=CASH(60, "cash taken from a wallet you found"),
               stats={"happiness": -6, "charisma": -4})),
    ]),
    C("find-owner", "Go to the address on the licence", outcomes=[
        OUT(6, "You walked the wallet to the address on the licence. They gave you $20 and a slice of cake.",
            FX(cash=CASH(20, "a reward for returning a wallet in person"),
               stats={"happiness": 7, "charisma": 3, "willpower": 2})),
        OUT(4, "You walked to the address on the licence and nobody answered, three times.",
            FX(stats={"happiness": -2, "willpower": 3, "health": -1})),
    ]),
    C("leave", "Leave it where it is",
      text="You left the wallet on the pavement. Somebody else got to it within the hour.",
      effects=FX(stats={"happiness": -3})),
], age_min=8, age_max=17, weight=12, modifiers=[MOD(1.8, talents_any=["crime"])])

D("d.random.stray-dog", "random", [
    "There is a dog outside the corner shop with no collar, and it has decided to follow you home.",
], [
    C("keep", "Take it home", outcomes=[
        OUT(6, "{parent} said no for two days and then came home with a bowl.",
            FX(stats={"happiness": 7, "health": 2}, relationship={"parents": 3})),
        OUT(4, "It had an owner, who was extremely relieved, and pressed $20 on you.",
            FX(cash=CASH(20, "a reward from the dog's owner"), stats={"happiness": 3})),
    ], requires=COND(requires=["anyParent"])),
    C("owner", "Look for the owner",
      text="You knocked on doors for two hours until you found the right one. They were in tears about it.",
      effects=FX(stats={"charisma": 3, "willpower": 3, "happiness": 4, "health": -1})),
    C("shelter", "Walk it to the shelter",
      text="You walked the dog two miles to the shelter and did not stay to watch them take it in.",
      effects=FX(stats={"happiness": -2, "willpower": 3, "health": -1})),
    C("leave", "Leave it",
      text="You left it outside the shop. You thought about it for a long time afterwards.",
      effects=FX(stats={"happiness": -4, "willpower": 1})),
], age_min=6, age_max=15, weight=11, physical=True)

D("d.random.first-cigarette", "random", [
    "{kid} has produced a packet behind the sports hall and is offering it round.",
], [
    C("try", "Try it",
      text="You tried it, coughed for a full minute, and pretended otherwise for the rest of the afternoon.",
      effects=FX(stats={"health": -3, "charisma": 3, "discipline": -2, "happiness": 1})),
    C("decline", "Pass",
      text="You passed. {kid} noted it, and it was briefly held against you.",
      effects=FX(stats={"willpower": 4, "health": 2, "charisma": -2, "happiness": -1})),
    C("take-and-not", "Take one and not smoke it",
      text="You took one, held it the whole time, and put it in your pocket unlit. Nobody checked.",
      effects=FX(stats={"willpower": 3, "charisma": 2, "happiness": 1})),
], age_min=12, age_max=17, weight=12, person_tokens=["kid"], physical=True,
   modifiers=[MOD(1.6, talents_any=["crime"]), MOD(0.5, stat_at_least={"discipline": 70})])

D("d.random.first-drink", "random", [
    "There is a bottle going round at {kid}'s and somebody has put a cup in your hand without asking.",
], [
    C("drink", "Drink it", outcomes=[
        OUT(6, "You drank it, disliked it, and pretended otherwise for the rest of the night.",
            FX(stats={"health": -2, "charisma": 3, "happiness": 2})),
        OUT(4, "You drank rather more than that, and the night ended badly and publicly on {kid}'s lawn.",
            FX(stats={"health": -4, "happiness": -5, "charisma": -3})),
    ]),
    C("pour", "Put it down somewhere",
      text="You put the cup down behind a plant pot and nobody noticed either way.",
      effects=FX(stats={"willpower": 4, "health": 1})),
    C("drive-home", "Get everyone home", outcomes=[
        OUT(7, "You stayed sober and got three people home. Two of them still bring it up.",
            FX(stats={"willpower": 5, "charisma": 4, "happiness": 3, "health": -1})),
        OUT(3, "You stayed sober and spent the night holding somebody's hair back.",
            FX(stats={"willpower": 4, "happiness": -3, "health": -1})),
    ]),
], age_min=14, age_max=17, weight=13, person_tokens=["kid"], physical=True,
   modifiers=[MOD(1.5, talents_any=["crime"]), MOD(0.6, stat_at_least={"discipline": 72})])

D("d.random.bridge", "random", [
    "{kid} and {kid2} are jumping off the train bridge into the river. {kid} says it is twelve feet. It is closer to twenty.",
], [
    C("jump", "Jump", outcomes=[
        OUT(5, "You jumped off the bridge and came up whooping. {kid2} would not do it.",
            FX(stats={"health": -2, "happiness": 8, "charisma": 4, "willpower": 3})),
        OUT(5, "You jumped and hit the water flat. Your whole back was purple for a week.",
            FX(stats={"health": -7, "happiness": 2, "charisma": 2})),
    ]),
    C("swim", "Swim from the bank",
      text="You swam from the bank while {kid} and {kid2} jumped. Good afternoon, nothing broken.",
      effects=FX(stats={"health": 3, "happiness": 5})),
    C("say-no", "Say it is too high", outcomes=[
        OUT(5, "You said it was too high. {kid} quietly agreed with you an hour later.",
            FX(stats={"willpower": 4, "happiness": 3})),
        OUT(5, "You said it was too high and {kid2} gave you a name that stuck until spring.",
            FX(stats={"willpower": 3, "happiness": -6, "charisma": -3})),
    ]),
], age_min=9, age_max=17, weight=11, person_tokens=["kid", "kid2"], physical=True)

D("d.random.sore-throat", "random", [
    "You woke up with a sore throat on the morning of the aquarium trip.",
], [
    C("go", "Go anyway", outcomes=[
        OUT(5, "You went to the aquarium with a fever and slept on the bus both ways.",
            FX(stats={"health": -5, "happiness": -3})),
        OUT(5, "You went, felt fine by ten, and got to put your hand in the ray tank.",
            FX(stats={"health": -1, "happiness": 6})),
    ]),
    C("stay", "Stay home",
      text="You stayed home from the aquarium trip and slept eleven hours.",
      effects=FX(stats={"health": 5, "happiness": -3})),
    C("ask", "Let {parent} decide", outcomes=[
        OUT(5, "{parent} took one look and sent you back to bed, and was right.",
            FX(stats={"health": 5, "happiness": -1}, relationship={"parents": 3})),
        OUT(5, "{parent} said you would live, and you did, and you saw the rays.",
            FX(stats={"health": -2, "happiness": 4}, relationship={"parents": 1})),
    ], requires=COND(requires=["anyParent"])),
], age_min=7, age_max=15, weight=11, physical=True)

D("d.random.savings", "random", [
    "The coffee can under your bed has $150 in it, and there is something in a shop window in {city}.",
], [
    C("buy", "Buy the thing",
      text="You spent the whole $150 in one afternoon and had an excellent fortnight.",
      effects=FX(cash=CASH(-150, "the thing in the shop window"),
                 stats={"happiness": 7, "discipline": -3})),
    C("wait", "Leave it alone",
      text="You left the $150 where it was. It was hard, and the pile got bigger.",
      effects=FX(stats={"discipline": 5, "willpower": 4, "happiness": -2})),
    C("cheaper", "Find a cheaper version",
      text="You found a worse one for $75 and put the rest back. It did the job for two years.",
      effects=FX(cash=CASH(-75, "a cheaper version of the thing"),
                 stats={"happiness": 3, "smarts": 2, "discipline": 2})),
], age_min=10, age_max=17, weight=11, cooldown=4)

D("d.random.charity", "random", [
    "There is a collection at school for a family who lost their house, and you have $40 saved for something else.",
], [
    C("donate", "Put the whole $40 in",
      text="You put the whole $40 in the envelope. Nobody knew how much it was, which was the point.",
      effects=FX(cash=CASH(-40, "the school collection"),
                 stats={"happiness": 5, "willpower": 3}, behaviour=5)),
    C("help", "Help run the collection instead",
      text="You kept your $40 and spent two weeks of lunchtimes counting other people's.",
      effects=FX(stats={"happiness": -1, "discipline": 4, "charisma": 3}, behaviour=6)),
    C("keep", "Keep it",
      text="You kept the $40 and bought the thing. It was excellent, briefly, and then it was not.",
      effects=FX(cash=CASH(-40, "the thing you had been saving for"),
                 stats={"happiness": -2, "discipline": -1})),
], age_min=8, age_max=16, weight=11, cooldown=5)

D("d.random.haircut", "random", [
    "You have been in the chair two minutes and {adult} has asked the same question twice.",
], [
    C("bold", "Something drastic", outcomes=[
        OUT(5, "It was a triumph. Three people asked where you had it done.",
            FX(stats={"looks": 6, "charisma": 4, "happiness": 6})),
        OUT(5, "It was a catastrophe, and hair grows about a centimetre a month.",
            FX(stats={"looks": -6, "happiness": -5, "willpower": 3})),
    ]),
    C("same", "The usual",
      text="You had the usual. It was fine. It is always fine.",
      effects=FX(stats={"happiness": 1})),
    C("ask-her", "Ask {adult} what {adultThey}'d do", outcomes=[
        OUT(7, "{adult} did what {adultThey} thought suited you and {adultThey} was completely right.",
            FX(stats={"looks": 5, "happiness": 5, "charisma": 2})),
        OUT(3, "{adult} did what {adultThey} thought suited you and {adultThey} was not right at all.",
            FX(stats={"looks": -3, "happiness": -3})),
    ]),
], age_min=9, age_max=17, weight=12, cooldown=3, person_tokens=["adult"])

D("d.random.online-argument", "random", [
    "Somebody has posted something about you and there is a reply box open on your phone at midnight.",
], [
    C("fire-back", "Fire back", outcomes=[
        OUT(5, "You destroyed them, publicly, and it followed you around for a year.",
            FX(stats={"charisma": 2, "happiness": -4, "health": -1})),
        OUT(5, "You fired back badly and it was screenshotted before you could delete it.",
            FX(stats={"charisma": -4, "happiness": -6, "willpower": 2})),
    ]),
    C("ignore", "Close the app",
      text="You put the phone face down. It died within two days, the way they do.",
      effects=FX(stats={"willpower": 5, "happiness": 2, "health": 1})),
    C("dm", "Message them privately", outcomes=[
        OUT(6, "You messaged them directly. It turned out to be a misunderstanding and they took the post down.",
            FX(stats={"charisma": 4, "happiness": 4, "smarts": 2})),
        OUT(4, "You messaged them directly and the message itself got screenshotted.",
            FX(stats={"happiness": -5, "charisma": -2})),
    ]),
], age_min=12, age_max=17, weight=12, flags_all=["has.phone"], cooldown=3)

D("d.random.late-night", "random", [
    "It is one in the morning and you are nowhere near finished with what you are doing.",
], [
    C("push-on", "Keep going",
      text="You kept going until four and paid for it every day that week.",
      effects=FX(stats={"health": -3, "discipline": 3, "happiness": 3})),
    C("sleep", "Go to bed",
      text="You went to bed. It was still there in the morning and it was easier.",
      effects=FX(stats={"health": 3, "discipline": 2, "happiness": 1})),
    C("alarm", "Sleep and get up early", outcomes=[
        OUT(5, "You set an alarm for five and it worked, which surprised you more than anyone.",
            FX(stats={"discipline": 5, "happiness": 3, "health": -1})),
        OUT(5, "You set an alarm for five and slept straight through it.",
            FX(stats={"health": 2, "happiness": -4, "discipline": -2})),
    ]),
], age_min=11, age_max=17, weight=12, cooldown=3, physical=True)

D("d.random.summer", "random", [
    "Summer is eleven weeks long and, as of this afternoon, completely undecided.",
], [
    C("work", "Take a summer job",
      text="You worked at the garden centre all summer. It was dull, it paid $1,100, and it made the autumn easier.",
      effects=FX(cash=CASH(1100, "a summer at the garden centre"),
                 stats={"discipline": 4, "health": -1, "happiness": -1})),
    C("train", "Train for one thing",
      text="You spent the whole summer getting better at one thing and came back visibly different.",
      effects=FX(stats={"discipline": 4, "health": 3, "willpower": 3, "happiness": 2})),
    C("nothing", "Do absolutely nothing",
      text="You did nothing for eleven weeks and it remains one of the great summers.",
      effects=FX(stats={"happiness": 7, "health": 2, "discipline": -3})),
    C("kid", "Spend it with {kid}",
      text="You spent all eleven weeks with {kid} and cannot now remember a single specific day of it.",
      effects=FX(stats={"happiness": 6, "charisma": 4})),
], age_min=13, age_max=17, weight=13, cooldown=2, person_tokens=["kid"], physical=True)

D("d.random.appearance", "random", [
    "You have decided that something about how you look is going to be different by September.",
], [
    C("effort", "Put real effort in", outcomes=[
        OUT(6, "It worked. People noticed and mostly did not say so.",
            FX(stats={"looks": 6, "charisma": 3, "discipline": 3, "happiness": 4})),
        OUT(4, "It half worked, which is roughly what happens at that age.",
            FX(stats={"looks": 2, "discipline": 3, "happiness": 1})),
    ]),
    C("fit", "Get fit instead",
      text="You started running, hated it for six weeks, and then did not.",
      effects=FX(stats={"health": 6, "discipline": 4, "looks": 3, "happiness": 3})),
    C("drop", "Decide not to care", outcomes=[
        OUT(6, "You decided not to care. It took more willpower than the alternative would have.",
            FX(stats={"willpower": 5, "happiness": 4})),
        OUT(4, "You said you had stopped caring, out loud, several times, to people who had not asked.",
            FX(stats={"willpower": 2, "happiness": -4, "charisma": -2})),
    ]),
], age_min=12, age_max=17, weight=12, cooldown=3, physical=True)

D("d.random.found-note", "random", [
    "There is a twenty on the kitchen counter and nobody in the house has mentioned it for three days.",
], [
    C("take", "Take it", outcomes=[
        OUT(7, "You took the $20. Nothing was ever said, which was somehow not a relief.",
            FX(cash=CASH(20, "$20 taken off the kitchen counter"),
               stats={"happiness": -2, "discipline": -2})),
        OUT(3, "You took the $20, and {parent} had known exactly how much was there.",
            FX(cash=CASH(20, "$20 taken off the kitchen counter"),
               stats={"happiness": -5}, relationship={"parents": -7})),
    ]),
    C("ask", "Ask about it",
      text="You asked. The $20 was yours anyway — {parent} had left it out for you — and you kept it cleanly.",
      effects=FX(cash=CASH(20, "$20 {parent} had left out for you"),
                 stats={"happiness": 4, "willpower": 3}, relationship={"parents": 3})),
    C("leave", "Leave it there",
      text="You left the $20 where it was. It was gone by Friday and you never found out where.",
      effects=FX(stats={"willpower": 3, "happiness": -1})),
], age_min=8, age_max=16, requires=["anyParent"], weight=11,
   modifiers=[MOD(1.8, talents_any=["crime"]), MOD(1.6, wealth_any=["struggling"])])

O("o.random.neighbour", "random", [
    "{adult} next door, who you barely know, has offered to teach you something {adultThey} is very good at.",
], [
    C("accept", "Take {adultThem} up on it",
      text="You said yes to {adult}. It became a Saturday habit that lasted four years.",
      effects=FX(stats={"smarts": 4, "discipline": 4, "happiness": 5})),
    C("decline", "Politely decline",
      text="You said no thanks to {adult}, and the offer was never made again.",
      effects=FX(stats={"happiness": -2})),
    C("once", "Try it once",
      text="You went once to be polite and stayed four hours.",
      effects=FX(stats={"smarts": 2, "charisma": 3, "happiness": 3})),
], age_min=8, age_max=16, weight=10, person_tokens=["adult"])

O("o.random.competition", "random", [
    "There is a competition with a $600 prize and the entry form has been on the kitchen table for a week.",
], [
    C("enter", "Enter it", outcomes=[
        OUT(2, "You won the $600. Nobody was more surprised than the people who knew you.",
            FX(cash=CASH(600, "a competition prize"),
               stats={"happiness": 8, "charisma": 4})),
        OUT(8, "You did not win, and the entry took more nerve than the result required.",
            FX(stats={"willpower": 4, "happiness": -2})),
    ]),
    C("with-kid", "Team up with {kid}", outcomes=[
        OUT(2, "You and {kid} won and split the prize down the middle. $300 each.",
            FX(cash=CASH(300, "half a competition prize, split with {kid}"),
               stats={"happiness": 8, "charisma": 5})),
        OUT(8, "You and {kid} did not win, and had a much better week than the winners.",
            FX(stats={"happiness": 3, "charisma": 3})),
    ]),
    C("bin", "Leave it",
      text="The form stayed on the table until somebody threw it out with the junk mail.",
      effects=FX(stats={"happiness": -2})),
], age_min=8, age_max=17, weight=11, rarity="uncommon", cooldown=6, person_tokens=["kid"])

O("o.school.exchange", "school", [
    "Somebody has dropped out of the exchange trip and {adult} is offering you the place.",
], [
    C("go", "Take it", outcomes=[
        OUT(7, "Three weeks somewhere else rearranged your sense of how big things are.",
            FX(stats={"smarts": 5, "charisma": 5, "happiness": 6, "health": -1})),
        OUT(3, "You were homesick for the entire three weeks and learned something anyway.",
            FX(stats={"willpower": 5, "charisma": 2, "happiness": -3})),
    ]),
    C("ask-parents", "Ask {parent} first", outcomes=[
        OUT(6, "{parent} found the money from somewhere and did not say where.",
            FX(stats={"smarts": 4, "charisma": 4, "happiness": 5}, relationship={"parents": 6})),
        OUT(4, "{parent} could not make it work, and was more upset about it than you were.",
            FX(stats={"happiness": -4}, relationship={"parents": 2})),
    ], requires=COND(requires=["anyParent"])),
    C("decline", "Turn it down",
      text="You turned {adult} down. The reasons were good and it nagged for years.",
      effects=FX(stats={"happiness": -3})),
], age_min=13, age_max=17, weight=10, rarity="uncommon", person_tokens=["adult"],
   wealth_any=["modest", "comfortable", "affluent", "wealthy"])


# ---- talent -----------------------------------------------------------------

D("d.talent.commit", "talent", [
    "The thing you are good at now wants four evenings a week, and {adult} has asked you straight out whether you are serious about it.",
], [
    C("commit", "Go all in", outcomes=[
        OUT(6, "You went all in. School slipped a grade and the thing got serious.",
            FX(stats={"discipline": 5, "smarts": -2, "happiness": 5, "health": -1},
               set_flags=["talent.committed"])),
        OUT(4, "You went all in and burned out by spring. It came back two years later.",
            FX(stats={"willpower": 4, "happiness": -5, "health": -3})),
    ]),
    C("balance", "Keep it balanced",
      text="You kept it balanced, which meant being second-best at both and fine about it.",
      effects=FX(stats={"discipline": 3, "smarts": 2, "happiness": 2})),
    C("drop", "Let it go",
      text="You told {adult} you were done. It was a relief for about a year.",
      effects=FX(stats={"happiness": 3, "discipline": -2, "willpower": -2})),
], age_min=12, age_max=17, weight=14, person_tokens=["adult"], physical=True,
   talents_any=["athletics", "acting", "music", "writing", "academics", "inventive"])

D("d.talent.rival", "talent", [
    "{kid} is visibly better at your thing than you are, and has just been picked for something you were not.",
], [
    C("train", "Out-work {kid}", outcomes=[
        OUT(5, "You out-worked {kid}. It took two years and it took.",
            FX(stats={"discipline": 6, "willpower": 5, "happiness": 4, "health": -1})),
        OUT(5, "You out-worked {kid} and {kid} stayed better anyway. That was worth finding out early.",
            FX(stats={"discipline": 5, "willpower": 4, "happiness": -5, "health": -1})),
    ]),
    C("learn", "Ask {kid} how",
      text="You asked {kid} how it was done. {kid} told you, and you both got better for it.",
      effects=FX(stats={"smarts": 3, "charisma": 4, "discipline": 3, "happiness": 3})),
    C("quit", "Find something else",
      text="You moved on to something with less competition in it and were quietly happier.",
      effects=FX(stats={"happiness": 3, "willpower": -2})),
], age_min=10, age_max=17, weight=12, person_tokens=["kid"], physical=True,
   talents_any=["athletics", "acting", "music", "writing", "academics", "inventive", "crime"])

D("d.talent.show-off", "talent", [
    "There is a chance to do your thing in front of a room of people who have never seen you do it.",
], [
    C("perform", "Go for the hard version", outcomes=[
        OUT(6, "It landed. Several people looked at you differently afterwards, including {kid}.",
            FX(stats={"charisma": 5, "happiness": 6})),
        OUT(4, "It did not land, and the silence afterwards lasted a geological age.",
            FX(stats={"charisma": -2, "willpower": 4, "happiness": -5})),
    ]),
    C("small", "Play it safe",
      text="You did the version you could not get wrong. It was fine and nobody remembered it.",
      effects=FX(stats={"charisma": 1, "happiness": -1})),
    C("decline", "Keep it to yourself",
      text="You kept it to yourself, which is also a choice a person can make.",
      effects=FX(stats={"willpower": 2, "happiness": -2})),
], age_min=8, age_max=17, weight=12, cooldown=4, person_tokens=["kid"],
   talents_any=["athletics", "acting", "music", "writing", "inventive"])

O("o.talent.audition", "talent", [
    "A letter came about an audition that does not usually come to {city}, and it is on a Tuesday.",
], [
    C("go", "Go", outcomes=[
        OUT(3, "You got it. It changed what you thought was possible.",
            FX(stats={"charisma": 6, "happiness": 8, "discipline": 3},
               set_flags=["talent.breakthrough"])),
        OUT(7, "You did not get it, and the room itself was an education.",
            FX(stats={"charisma": 3, "willpower": 4, "happiness": -3})),
    ]),
    C("prepare", "Spend a month preparing first", outcomes=[
        OUT(5, "You prepared for a month and walked in knowing exactly what you were doing.",
            FX(stats={"charisma": 5, "discipline": 5, "happiness": 6, "health": -1},
               set_flags=["talent.breakthrough"])),
        OUT(5, "You prepared for a month and over-rehearsed it into something stiff.",
            FX(stats={"discipline": 4, "happiness": -4, "health": -1})),
    ]),
    C("skip", "Don't go",
      text="You did not go. It is one of the ones you still think about.",
      effects=FX(stats={"happiness": -4, "willpower": -2})),
], age_min=11, age_max=17, weight=11, rarity="rare", talents_any=["acting", "music"])

O("o.talent.trial", "talent", [
    "A club two hours away has invited you to trial, and somebody would have to drive you there and back.",
], [
    C("go", "Go", outcomes=[
        OUT(4, "You were offered a place. The next three years got harder and better.",
            FX(stats={"health": 4, "discipline": 5, "happiness": 7},
               set_flags=["talent.breakthrough"])),
        OUT(6, "You did not make it, and you were closer than the result suggested.",
            FX(stats={"health": 2, "willpower": 5, "happiness": -4})),
    ]),
    C("ask-parent", "Ask {parent} to take you", outcomes=[
        OUT(6, "{parent} took the day off work to drive you. You have never quite squared that.",
            FX(stats={"health": 3, "discipline": 4, "happiness": 6}, relationship={"parents": 7})),
        OUT(4, "{parent} could not get the day off, and neither of you brought it up again.",
            FX(stats={"happiness": -5}, relationship={"parents": -2})),
    ]),
    C("skip", "Let it go",
      text="It was too far and there was nobody free to drive. That was the whole reason.",
      effects=FX(stats={"happiness": -5, "willpower": 1})),
], age_min=11, age_max=17, requires=["anyParent"], weight=11, rarity="rare",
   talents_any=["athletics"], physical=True)

O("o.talent.scholarship", "talent", [
    "A school you had not considered has written to you directly about a place and a bursary.",
], [
    C("apply", "Apply", outcomes=[
        OUT(4, "You got in. The commute was brutal and the teaching was extraordinary.",
            FX(stats={"smarts": 7, "discipline": 5, "happiness": -1, "health": -2},
               set_flags=["talent.breakthrough"])),
        OUT(6, "You did not get in, and writing the application taught you how to write about yourself.",
            FX(stats={"smarts": 3, "willpower": 4, "happiness": -2})),
    ]),
    C("visit", "Go and look at it first", outcomes=[
        OUT(5, "You visited, hated the feel of the place, and did not apply. Good instinct.",
            FX(stats={"smarts": 2, "willpower": 3, "happiness": 2})),
        OUT(5, "You visited, loved it, applied late, and missed the deadline by four days.",
            FX(stats={"happiness": -6, "discipline": 2})),
    ]),
    C("stay", "Stay where you are",
      text="You stayed. Your friends were there, and that was a real reason.",
      effects=FX(stats={"happiness": 4, "charisma": 3})),
], age_min=10, age_max=16, weight=11, rarity="rare", talents_any=["academics"])


# =============================================================================
# EARLY YEARS DEPTH
#
# Ages 0-5 were thin on the first pass, and thin means repetitive: the opening
# five Advances are the first five things a new player ever sees. These are
# deliberately unconditional so they are available to every household shape.
# =============================================================================

E("early.born-quiet", "random", [
    "Arrived three weeks early and in a considerable hurry.",
    "Arrived nine days late, which several people took personally.",
], age_min=0, age_max=0, weight=13, effects=FX(stats={"health": 1}))

E("early.name-argument", "family", [
    "The name was decided in the car park. It was not the first choice, or the second.",
], age_min=0, age_max=0, requires=["anyParent"], weight=11)

E("early.first-laugh", "family", [
    "Laughed for the first time at something nobody could reproduce afterwards.",
], age_min=0, age_max=1, weight=13, effects=FX(stats={"happiness": 2}))

E("early.hair", "random", [
    "Was born with a startling amount of hair and lost most of it within a year.",
], age_min=0, age_max=1, weight=10, effects=FX(stats={"looks": 1}))

E("early.bald", "random", [
    "Stayed entirely bald until well past the point anyone expected.",
], age_min=0, age_max=2, weight=10)

E("early.crawl-backwards", "random", [
    "Learned to crawl backwards first, and spent two months reversing into furniture.",
], age_min=0, age_max=1, weight=12, effects=FX(stats={"smarts": 1}))

E("early.stairs", "random", [
    "Discovered stairs. A gate was fitted within the week.",
], age_min=1, age_max=2, weight=12, effects=FX(stats={"health": -1, "willpower": 1}))

E("early.no", "random", [
    "Learned the word no and applied it universally, including to things you wanted.",
], age_min=1, age_max=3, weight=13, effects=FX(stats={"willpower": 2}))

E("early.mud", "random", [
    "Located every puddle within a half-mile radius and stood in all of them.",
], age_min=2, age_max=5, weight=12, effects=FX(stats={"happiness": 2, "health": 1}))

E("early.songs", "random", [
    "Learned one song and performed it approximately nine hundred times.",
], age_min=2, age_max=5, weight=12, effects=FX(stats={"charisma": 1, "happiness": 1}),
   modifiers=[MOD(1.8, talents_any=["music"])])

E("early.dressing", "random", [
    "Insisted on dressing yourself. The results were bold and internally consistent.",
], age_min=2, age_max=6, weight=12, effects=FX(stats={"willpower": 2, "looks": -1}))

E("early.animal-phase", "random", [
    "Spent about four months answering only to the name of a specific animal.",
], age_min=2, age_max=6, weight=11, effects=FX(stats={"happiness": 2}))

E("early.playgroup", "friendship", [
    "Playgroup twice a week. Shared nothing, learned everything.",
], age_min=1, age_max=4, weight=13, effects=FX(stats={"charisma": 2}))

E("early.bit-someone", "friendship", [
    "Bit another child at playgroup. There was a note home and a difficult conversation.",
], age_min=1, age_max=4, weight=10, effects=FX(stats={"charisma": -1, "willpower": 1}))

E("early.shared-toy", "friendship", [
    "Shared a toy, voluntarily, once, and it was talked about for weeks.",
], age_min=2, age_max=5, weight=11, effects=FX(stats={"charisma": 2, "happiness": 1}))

E("early.shy", "friendship", [
    "Hid behind an adult's leg at every social occasion for about two years.",
], age_min=2, age_max=6, weight=12, effects=FX(stats={"charisma": -1, "willpower": 1}))

E("early.talkative", "friendship", [
    "Talked to absolutely everybody, including strangers, at length, about nothing.",
], age_min=2, age_max=6, weight=12, effects=FX(stats={"charisma": 3}))

E("early.blanket", "random", [
    "Would not go anywhere without a specific blanket that was, by then, mostly holes.",
], age_min=1, age_max=5, weight=12, effects=FX(stats={"happiness": 2}))

E("early.bath-refusal", "family", [
    "Objected to baths on grounds that were never made clear.",
], age_min=1, age_max=4, requires=["anyParent"], weight=11,
   effects=FX(relationship={"parents": -1}, stats={"willpower": 1}))

E("early.slept-in-bed", "family", [
    "Migrated into {parent}'s bed most nights for a solid two years.",
], age_min=1, age_max=5, requires=["anyParent"], weight=11,
   effects=FX(stats={"happiness": 2}, relationship={"parents": 2}))

E("early.nursery", "school", [
    "Started nursery. There were tears at drop-off, none of them yours.",
], age_min=2, age_max=4, weight=13, effects=FX(stats={"charisma": 2, "smarts": 1}))

E("early.counting", "school", [
    "Learned to count to twenty, skipping fifteen, permanently.",
], age_min=2, age_max=5, weight=12, effects=FX(stats={"smarts": 2}))

E("early.alphabet", "school", [
    "Learned the alphabet as a song and could not say it any other way for years.",
], age_min=3, age_max=6, weight=12, effects=FX(stats={"smarts": 2}))

E("early.paint", "school", [
    "Discovered paint. So did the carpet.",
], age_min=2, age_max=6, weight=12, effects=FX(stats={"happiness": 2}))

E("early.telly", "random", [
    "Watched one specific film so many times the tape wore out.",
], age_min=2, age_max=7, weight=12, effects=FX(stats={"happiness": 2}))

E("early.doctor-visit", "random", [
    "A trip to the doctor over something that turned out to be entirely normal.",
], age_min=0, age_max=5, weight=11, effects=FX(stats={"health": 1}))

E("early.ear-infection", "random", [
    "A run of ear infections that made most of one winter a write-off.",
], age_min=0, age_max=4, weight=10, effects=FX(stats={"health": -2}))

E("early.talked-late", "random", [
    "Said almost nothing until three, then started in full sentences.",
], age_min=2, age_max=4, weight=9, rarity="uncommon", effects=FX(stats={"smarts": 3}))

E("early.walked-early", "random", [
    "Walked at ten months, which was widely reported as a sign of something.",
], age_min=0, age_max=2, weight=9, rarity="uncommon", effects=FX(stats={"health": 2}))

E("early.beach", "family", [
    "First trip to the sea. Deeply suspicious of the sea.",
], age_min=1, age_max=6, weight=11, effects=FX(stats={"happiness": 2}))

E("early.snow-first", "random", [
    "Saw snow for the first time and found the whole business unacceptable.",
], age_min=1, age_max=5, weight=11, effects=FX(stats={"happiness": 1}))

E("early.zoo", "family", [
    "Went to a zoo and spent forty minutes looking at a duck.",
], age_min=2, age_max=7, weight=11, effects=FX(stats={"happiness": 2, "smarts": 1}))



# =============================================================================
# SCHOOL PROGRESSION (Ticket 0204)
#
# The education phase already writes the milestones — starting kindergarten,
# moving up to high school, graduating, the year you took on too much. These are
# the texture around those, and the ones that move school STANDING, which is
# what routes a character into an alternative school (spec 73). Before events
# could touch behaviour, every character in 300 test lives finished on 96-100
# and that branch of the spec was unreachable.
# =============================================================================

E("school.front-of-class", "school", [
    "Got moved to the front of the class, which was framed as a compliment and was not one.",
], age_min=7, age_max=15, weight=10, cooldown=3,
   school_stage_any=["elementary", "middle"],
   effects=FX(stats={"happiness": -2, "smarts": 1}, behaviour=-5))

E("school.teacher-vouched", "school", [
    "A teacher went out of their way to say something good about you to somebody who mattered.",
], age_min=8, age_max=17, weight=10, cooldown=4,
   school_stage_any=["elementary", "middle", "high"],
   effects=FX(stats={"happiness": 3, "charisma": 1}, behaviour=8))

E("school.principal-office", "school", [
    "Spent enough time outside the principal's office this year to know the receptionist's name.",
], age_min=9, age_max=17, weight=9, cooldown=2,
   school_stage_any=["middle", "high"],
   effects=FX(stats={"charisma": 1, "happiness": -2}, behaviour=-12),
   modifiers=[MOD(2.0, talents_any=["crime"])])

E("school.fresh-start", "school", [
    "A new year, a new set of teachers, and nobody in the building holding last year against you.",
], age_min=11, age_max=17, weight=8, cooldown=4,
   school_stage_any=["middle", "high"],
   effects=FX(stats={"happiness": 3}, behaviour=10))

E("school.alt.settling", "school", [
    "Smaller classes at the new school, and a teacher who had clearly seen worse than you.",
    "The new school had fifteen kids in a room and an adult who actually looked at you when you talked.",
], age_min=11, age_max=17, weight=12, cooldown=2,
   effects=FX(stats={"happiness": 2, "willpower": 2}, behaviour=9))

E("school.locker-search", "school", [
    "There was a locker search. Yours was fine, which was not true of everybody's.",
], age_min=12, age_max=17, weight=9, cooldown=3,
   school_stage_any=["middle", "high"],
   effects=FX(stats={"happiness": -1}))

E("school.fundraiser", "school", [
    "Sold wrapping paper door to door for the school fundraiser and came second in the year.",
], age_min=8, age_max=14, weight=9, cooldown=4,
   school_stage_any=["elementary", "middle"],
   effects=FX(stats={"charisma": 3, "discipline": 2}))

E("school.busy-year", "school", [
    "Between everything you had signed up for, the year went past in one long blur.",
], age_min=10, age_max=17, weight=11, cooldown=2,
   activities_at_least=3,
   effects=FX(stats={"charisma": 2, "discipline": 2, "health": -1}))

E("school.empty-afternoons", "school", [
    "You were not in anything this year. The afternoons were long and entirely your own.",
], age_min=10, age_max=17, weight=10, cooldown=3,
   activities_at_most=0,
   school_stage_any=["middle", "high"],
   effects=FX(stats={"happiness": 1, "health": 1, "charisma": -2}))

E("school.team-photo", "school", [
    "The team photo went up in the hallway with your name printed under it, spelled wrong.",
], age_min=10, age_max=17, weight=10, cooldown=3,
   activities_at_least=1,
   effects=FX(stats={"happiness": 3, "charisma": 1}))

# =============================================================================
# ADULTHOOD — PLACEHOLDER
#
# Ticket 0203 is the CHILDHOOD library. But the year loop does not stop at
# eighteen, and `advanceYear` throws on a year with nothing in it, so an adult
# character must still have something to read. These are the v0.01 adult
# placeholder lines, moved out of advance.ts and into content where they belong.
#
# They are deliberately few, low-weight and vague. The adult libraries arrive
# with the systems that give an adult year its shape — school leaving and work
# (0204/0210), health and ageing (0211), money (0301). When those land, this
# block should shrink, not grow.
# =============================================================================

E("adult.placeholder.1", "random", [
    "Another year went by without much fanfare.",
], age_min=18, weight=6, cooldown=2)

E("adult.placeholder.2", "random", [
    "Kept mostly to a routine this year.",
], age_min=18, weight=6, cooldown=2)

E("adult.placeholder.3", "random", [
    "Nothing remarkable happened, which was its own kind of relief.",
], age_min=18, weight=6, cooldown=2)

E("adult.placeholder.4", "random", [
    "A steady year. The kind that does not make it into the telling.",
], age_min=18, weight=6, cooldown=2)

E("adult.placeholder.5", "random", [
    "Made a few plans this year and kept about half of them.",
], age_min=18, weight=6, cooldown=2)

E("adult.placeholder.6", "random", [
    "The year passed quickly, in the way they start to.",
], age_min=25, weight=6, cooldown=2)

E("adult.placeholder.7", "random", [
    "Spent the year much as you spent the last one, and did not mind.",
], age_min=25, weight=6, cooldown=2)

E("adult.placeholder.8", "random", [
    "Slower year. Less happened and more of it was noticed.",
], age_min=55, weight=8, cooldown=2)


# =============================================================================
# Self-checks. A catalog this size makes these mistakes inevitable; the point of
# generating it is that they fail here rather than in a player's timeline.
# =============================================================================

TOKEN_RE = re.compile(r"\{([a-zA-Z0-9]+)\}")

MIN_EVENTS = 250
MAX_EVENTS = 500
CHILDHOOD_AGES = range(0, 18)
# Sampled beyond childhood too: the year loop does not stop at eighteen, and an
# adult year with nothing in it throws in advanceYear.
ADULT_SAMPLE_AGES = (18, 25, 40, 60, 80, 100)
MIN_UNCONDITIONAL_PER_AGE = 4

# Eligibility keys that make an event conditional on something a given character
# might not have. Coverage is measured over events with NONE of these, because
# those are the ones guaranteed to be available to anybody at that age.
GATE_KEYS = (
    "requires",
    "talentsAny",
    "wealthAny",
    "statAtLeast",
    "statAtMost",
    "flagsAll",
    "relationshipAtLeast",
    "relationshipAtMost",
    "sex",
    "schoolStageAny",
    "activitiesAtLeast",
    "activitiesAtMost",
)


def guaranteed_requirements(event: dict, choice: dict | None = None) -> set[str]:
    """Family requirements the player is certain to have when this text renders."""
    requirements = set(event["eligibility"].get("requires", []))
    if choice:
        requirements |= set((choice.get("requires") or {}).get("requires", []))
    if "bothParents" in requirements:
        requirements |= {"mother", "father", "anyParent"}
    if requirements & {"mother", "father", "singleParent", "bothParents"}:
        requirements.add("anyParent")
    if "siblings2" in requirements or "olderSibling" in requirements:
        requirements.add("sibling")
    return requirements


PLAYER_PRONOUNS = {"they", "them", "their"}

# Words that carry no tactical meaning at the start of a choice label.
LABEL_NOISE = {"the", "a", "an", "to", "for", "it", "them", "your", "my", "s"}


def label_stem(label: str) -> str:
    """
    The opening phrase of a choice label, for the intensity check.

    Tokens, punctuation and leading filler are stripped, then the first two
    meaningful words are kept. Two options that agree on that much are almost
    always the same tactic at two volumes.
    """
    plain = TOKEN_RE.sub(" ", label).lower()
    words = [re.sub(r"[^a-z]", "", word) for word in plain.split()]
    words = [word for word in words if word and word not in LABEL_NOISE]
    return " ".join(words[:2])


def check_text(problems: list[str], event: dict, text: str, where: str, choice=None) -> None:
    """
    Validate one line of player-visible copy.

    Note the pronoun rule below. `{they}/{them}/{their}` are the PLAYER's
    pronouns. Writing "You asked {kid} how {they} did it" reads fine and renders
    the wrong person's gender — the same class of mistake as drawing the
    player's own first name for a friend, which only turned up in review.
    Incidental people have no gender, so they are referred to by name.
    """
    if not text.strip():
        problems.append(f"{event['id']}: empty text in {where}")
        return
    if text.strip()[-1] not in ".!?\"'":
        problems.append(f"{event['id']}: {where} does not end in punctuation: {text!r}")
    if len(text) > 220:
        problems.append(f"{event['id']}: {where} is {len(text)} chars — spec 725-770 says concise")
    # {adult} renders with its own title ("Mrs. Okafor"), so copy must not add
    # one — "Mr. {adult}" printed "Mr. Mr. Conti" at the player.
    if re.search(r"(Mr\.|Mrs\.|Miss|Ms\.)\s*\{adult\}", text):
        problems.append(
            f"{event['id']}: {where} puts a title in front of {{adult}}, which already has one"
        )

    tokens = {norm_token(token) for token in TOKEN_RE.findall(text)}
    if tokens & set(PERSON_OF) and tokens & PLAYER_PRONOUNS:
        problems.append(
            f"{event['id']}: {where} names an incidental person AND uses a player "
            f"pronoun — {{they}}/{{them}}/{{their}} are the player's, so this "
            f"renders the wrong person's gender. Use {{kidThey}} and friends."
        )
    if tokens & set(PERSON_OF) and BARE_PRONOUN_RE.search(TOKEN_RE.sub(" ", text)):
        problems.append(
            f"{event['id']}: {where} names an incidental person and then writes a bare "
            f"'he'/'she'/'him'/'her'. The name is drawn from both lists, so the copy "
            f"cannot know the sex — use {{kidThey}}/{{kidThem}}/{{kidTheir}} "
            f"(or the kid2/adult forms), which are resolved from the name."
        )

    have = guaranteed_requirements(event, choice)
    for token in tokens:
        if token in FREE_TOKENS:
            continue
        guard = TOKEN_GUARDS.get(token)
        if guard is None:
            problems.append(f"{event['id']}: unknown text token {{{token}}} in {where}")
        elif not (guard & have):
            problems.append(
                f"{event['id']}: {where} uses {{{token}}} but eligibility does not "
                f"guarantee it (needs one of {sorted(guard)})"
            )


def check_condition(problems: list[str], event_id: str, condition: dict, where: str) -> None:
    for key in condition.get("requires", []):
        if key not in REQUIREMENTS:
            problems.append(f"{event_id}: unknown family requirement {key!r} in {where}")
    for key in condition.get("schoolStageAny", []):
        if key not in SCHOOL_STAGES:
            problems.append(f"{event_id}: unknown school stage {key!r} in {where}")
    for key in condition.get("wealthAny", []):
        if key not in WEALTH:
            problems.append(f"{event_id}: unknown wealth band {key!r} in {where}")
    for key in condition.get("talentsAny", []) + condition.get("talentsNone", []):
        if key not in TALENTS:
            problems.append(f"{event_id}: unknown talent {key!r} in {where}")
    for group in ("statAtLeast", "statAtMost"):
        for key in condition.get(group, {}):
            if key not in STATS:
                problems.append(f"{event_id}: unknown stat {key!r} in {where}.{group}")
    low, high = condition.get("ageMin"), condition.get("ageMax")
    if low is not None and high is not None and low > high:
        problems.append(f"{event_id}: inverted age window {low}..{high} in {where}")
    if condition.get("sex") not in (None, "male", "female"):
        problems.append(f"{event_id}: unknown sex {condition.get('sex')!r} in {where}")


def check_effects(
    problems: list[str],
    event_id: str,
    effects: dict | None,
    where: str,
    visible_text: str = "",
) -> None:
    if not effects:
        return
    cash = effects.get("cash")
    if cash is not None:
        # V4. CASH() already refuses a missing source; this is the half that
        # matters to the player — the amount has to appear in the line they
        # actually read, or the money still arrives unexplained.
        amount = abs(cash["delta"])
        written = {f"${amount}", f"${amount:,}"}
        if visible_text and not any(form in visible_text for form in written):
            problems.append(
                f"{event_id}: {where} moves ${amount} but the text does not say so: "
                f"{visible_text!r}"
            )
    for key in effects.get("stats", {}):
        if key not in STATS:
            problems.append(f"{event_id}: unknown stat {key!r} in {where} effects")
    for key in effects.get("relationship", {}):
        if key not in {"mother", "father", "parents", "siblings", "family"}:
            problems.append(f"{event_id}: unknown relationship target {key!r} in {where}")
    behaviour = effects.get("behaviour")
    if behaviour is not None and not (-40 <= behaviour <= 40):
        problems.append(f"{event_id}: behaviour change {behaviour} in {where} is out of range")
    stress = effects.get("stress")
    if stress is not None and not (-25 <= stress <= 40):
        problems.append(f"{event_id}: stress change {stress} in {where} is out of range")
    if stress == 0:
        problems.append(f"{event_id}: stress of 0 in {where} — omit it instead")


def check() -> None:
    problems: list[str] = []
    ids = [event["id"] for event in EVENTS]
    by_id = {event["id"]: event for event in EVENTS}

    for event_id, count in Counter(ids).items():
        if count > 1:
            problems.append(f"duplicate event id {event_id!r} ({count} times)")

    for event in EVENTS:
        eid = event["id"]
        if event["category"] not in CATEGORIES:
            problems.append(f"{eid}: unknown category {event['category']!r}")
        if event["rarity"] not in RARITIES:
            problems.append(f"{eid}: unknown rarity {event['rarity']!r}")
        if event["weight"] <= 0:
            problems.append(f"{eid}: weight must be positive")
        check_condition(problems, eid, event["eligibility"], "eligibility")
        check_effects(problems, eid, event.get("effects"), "event", " ".join(event["text"]))

        for modifier in event.get("modifiers", []):
            check_condition(problems, eid, modifier["when"], "modifier")
            if modifier["multiply"] < 0:
                problems.append(f"{eid}: negative modifier multiplier")

        for text in event["text"]:
            check_text(problems, event, text, "text")

        choices = event.get("choices", [])
        is_decision = event["type"] in ("decision", "opportunity")
        if is_decision and len(choices) < 2:
            problems.append(f"{eid}: a {event['type']} needs at least two choices")
        if choices and not is_decision:
            problems.append(f"{eid}: type {event['type']!r} should not carry choices")

        # A choice can be hidden by its own `requires`; at least two must always
        # be available or the player gets a dialog with one button.
        unconditional = [choice for choice in choices if not choice.get("requires")]
        if is_decision and len(unconditional) < 2:
            problems.append(
                f"{eid}: needs at least two choices with no `requires`, or it can "
                f"collapse to a single button"
            )

        # --- V1: three options, unless this genuinely has two answers --------
        # "Do it / don't" is not a decision. Some situations really do have two
        # answers (own up or stay silent), and those say so with binary_ok.
        if is_decision and len(choices) < 3 and not event.get("binaryOk"):
            problems.append(
                f"{eid}: only {len(choices)} options. Three or more, or set "
                f"binary_ok=True if this genuinely has two answers"
            )

        # --- V2: options are approaches, not intensities ---------------------
        # Two labels sharing an opening PHRASE are usually the same tactic at two
        # volumes ("Give it" / "Give some of it"), which is a choice of slider
        # position rather than a choice of person.
        #
        # Compares the first two significant words, not the first word: a single
        # shared verb has too many honest collisions ("Go and sit with them" and
        # "Go to the address on the licence" are different tactics that both
        # start with "go"). Articles, possessives and tokens are stripped first.
        heads = [label_stem(choice["label"]) for choice in choices]
        repeated = {head for head in heads if head and heads.count(head) > 1}
        if is_decision and repeated:
            problems.append(
                f"{eid}: options {sorted(repeated)} open the same way — these read as "
                f"one approach at two volumes rather than as different tactics"
            )

        # --- V3: happiness moves, and it can go badly ------------------------
        if is_decision:
            results = []
            for choice in choices:
                if choice.get("text"):
                    results.append(choice.get("effects") or {})
                for outcome in choice.get("outcomes", []):
                    merged = dict(choice.get("effects") or {})
                    merged.update(outcome.get("effects") or {})
                    results.append(merged)
            happiness = [(r.get("stats") or {}).get("happiness", 0) for r in results]
            if not any(happiness):
                problems.append(f"{eid}: no result moves happiness — spec 0203b requires it")
            if happiness and min(happiness) >= 0:
                problems.append(
                    f"{eid}: every result is happiness-neutral or better. A decision that "
                    f"cannot land badly is not a decision"
                )
            if event.get("physical"):
                if not any((r.get("stats") or {}).get("health", 0) for r in results):
                    problems.append(
                        f"{eid}: marked physical but no result moves health"
                    )

        seen_choices = set()
        for choice in choices:
            if choice["id"] in seen_choices:
                problems.append(f"{eid}: duplicate choice id {choice['id']!r}")
            seen_choices.add(choice["id"])
            if not choice.get("text") and not choice.get("outcomes"):
                problems.append(f"{eid}/{choice['id']}: choice needs `text` or `outcomes`")
            if choice.get("text") and choice.get("outcomes"):
                problems.append(f"{eid}/{choice['id']}: choice has both `text` and `outcomes`")
            if choice.get("opens") and choice["opens"] not in OPENABLE:
                problems.append(
                    f"{eid}/{choice['id']}: opens {choice['opens']!r}, which no screen handles"
                )
            # Labels wrap on the card rather than truncating, so two lines is
            # survivable and an essay is not.
            if len(choice["label"]) > 38:
                problems.append(
                    f"{eid}/{choice['id']}: label {choice['label']!r} is too long for a phone"
                )
            if choice.get("text"):
                check_text(problems, event, choice["text"], f"choice {choice['id']}", choice)
            check_effects(
                problems,
                eid,
                choice.get("effects"),
                f"choice {choice['id']}",
                choice.get("text") or "",
            )
            if choice.get("requires"):
                check_condition(problems, eid, choice["requires"], f"choice {choice['id']}")
            for index, outcome in enumerate(choice.get("outcomes", [])):
                if outcome["weight"] <= 0:
                    problems.append(f"{eid}/{choice['id']}: outcome {index} has no weight")
                check_text(problems, event, outcome["text"], f"choice {choice['id']} outcome {index}", choice)
                check_effects(
                    problems,
                    eid,
                    outcome.get("effects"),
                    f"choice {choice['id']} outcome",
                    outcome["text"],
                )

        declared = set(event.get("personTokens", []))
        used: set[str] = set()

        def people_in(text: str) -> set[str]:
            # A pronoun token counts as a use of the person it belongs to, so a
            # decision that says "{kid} ... {kidThem}" declares `kid` once.
            return {
                PERSON_OF[norm_token(token)]
                for token in TOKEN_RE.findall(text)
                if norm_token(token) in PERSON_OF
            }

        for text in event["text"]:
            used |= people_in(text)
        for choice in choices:
            used |= people_in(choice["label"])
            if choice.get("text"):
                used |= people_in(choice["text"])
            for outcome in choice.get("outcomes", []):
                used |= people_in(outcome["text"])
        # Within one event, every line is about the SAME bound people — a choice
        # label reads as a continuation of the prompt. So "Compliment her
        # jacket" is wrong for exactly the reason the outcome copy was: the
        # person it is about might be a boy. Once an event names anybody the
        # engine drew, nothing in it may write a bare gendered pronoun.
        if used:
            for line in [*event["text"], *[choice["label"] for choice in choices]] + [
                text
                for choice in choices
                for text in ([choice["text"]] if choice.get("text") else [])
                + [outcome["text"] for outcome in choice.get("outcomes", [])]
            ]:
                if BARE_PRONOUN_RE.search(TOKEN_RE.sub(" ", line)):
                    problems.append(
                        f"{eid}: {line!r} is part of an event about a person the engine "
                        f"named, so a bare 'he'/'she' is wrong half the time. Use "
                        f"{{kidThey}}/{{kidThem}}/{{kidTheir}} (or the kid2/adult forms)."
                    )

        if is_decision and used - declared:
            problems.append(
                f"{eid}: uses {sorted(used - declared)} but does not declare them in "
                f"person_tokens, so the prompt and the outcome would name different people"
            )
        if is_decision and declared - used:
            problems.append(f"{eid}: declares {sorted(declared - used)} but never uses them")

        for follow in follow_ups(event):
            target = by_id.get(follow["eventId"])
            if target is None:
                problems.append(f"{eid}: follow-up points at unknown event {follow['eventId']!r}")
            elif target["type"] != "followUp":
                problems.append(
                    f"{eid}: follow-up target {follow['eventId']!r} must have type 'followUp'"
                )
            if follow["inYears"] < 1:
                problems.append(f"{eid}: follow-up must be at least one year out")

    # Every follow-up event must be reachable, or it is dead content.
    scheduled = {follow["eventId"] for event in EVENTS for follow in follow_ups(event)}
    for event in EVENTS:
        if event["type"] == "followUp" and event["id"] not in scheduled:
            problems.append(f"{event['id']}: type 'followUp' but nothing ever schedules it")

    # Coverage: a year must never come back empty, for any character, at any age.
    for age in list(CHILDHOOD_AGES) + list(ADULT_SAMPLE_AGES):
        available = [
            event
            for event in EVENTS
            if event["type"] == "passive"
            and event["eligibility"].get("ageMin", 0) <= age <= event["eligibility"].get("ageMax", 130)
            and not any(
                key in event["eligibility"]
                for key in GATE_KEYS
            )
        ]
        if len(available) < MIN_UNCONDITIONAL_PER_AGE:
            problems.append(
                f"age {age}: only {len(available)} passive events are available to every "
                f"character (need {MIN_UNCONDITIONAL_PER_AGE}) — a life could render an empty year"
            )

    if not MIN_EVENTS <= len(EVENTS) <= MAX_EVENTS:
        problems.append(
            f"catalog holds {len(EVENTS)} events; the approved target for ticket 0203 "
            f"is {MIN_EVENTS}-{MAX_EVENTS}"
        )

    if problems:
        print(f"\n{len(problems)} problem(s) in the event catalog:\n")
        for problem in problems:
            print(f"  - {problem}")
        raise SystemExit(1)


def follow_ups(event: dict) -> list[dict]:
    found = []
    if event.get("followUp"):
        found.append(event["followUp"])
    for choice in event.get("choices", []):
        if choice.get("followUp"):
            found.append(choice["followUp"])
        for outcome in choice.get("outcomes", []):
            if outcome.get("followUp"):
                found.append(outcome["followUp"])
    return found


def report() -> None:
    by_category = Counter(event["category"] for event in EVENTS)
    by_type = Counter(event["type"] for event in EVENTS)
    by_rarity = Counter(event["rarity"] for event in EVENTS)
    variants = sum(len(event["text"]) for event in EVENTS)
    choices = sum(len(event.get("choices", [])) for event in EVENTS)
    outcomes = sum(
        len(choice.get("outcomes", []))
        for event in EVENTS
        for choice in event.get("choices", [])
    )

    print(f"{len(EVENTS)} events, {variants} text variants, {choices} choices, {outcomes} outcomes")
    print("  by category: " + ", ".join(f"{k} {v}" for k, v in sorted(by_category.items())))
    print("  by type:     " + ", ".join(f"{k} {v}" for k, v in sorted(by_type.items())))
    print("  by rarity:   " + ", ".join(f"{k} {v}" for k, v in sorted(by_rarity.items())))

    print("  eligible per age (all events / available to everyone):")
    for age in CHILDHOOD_AGES:
        window = [
            event
            for event in EVENTS
            if event["eligibility"].get("ageMin", 0) <= age <= event["eligibility"].get("ageMax", 130)
        ]
        plain = [
            event
            for event in window
            if not any(key in event["eligibility"] for key in GATE_KEYS)
        ]
        print(f"    age {age:>2}: {len(window):>3} / {len(plain):>3}")


# =============================================================================
# TICKET 0205 — which years cost, and which years help
# =============================================================================
#
# Stress is a backend system with no screen (spec 661, 1824, 1986). The only
# way a player learns what wore a character down is that the things which wore
# them down were things they read about. So the catalog has to be opinionated
# about which years were hard.
#
# Kept as ONE table rather than scattered through the event definitions, for two
# reasons: it can be read as a whole and argued with, and the balance of
# positive to negative is visible at a glance. Both directions are required —
# stress that only ever goes up is a second health bar every character loses by
# eighteen, which is the separate mental-health system spec 1030 forbids.
#
# Values are points added to the year's total, before the character's own
# resilience. A grandparent dying is worth roughly three months of being
# overcommitted; a long empty summer pays back most of a bad term.

STRESS_BY_EVENT: dict[str, int] = {
    # --- years that cost -----------------------------------------------------
    "family.mc.divorce": 24,
    "family.mc.parent-illness": 18,
    "school.bullied": 20,
    "family.ec.parents-argue": 12,
    "family.ec.new-house": 6,
    "family.ec.moved-again": 9,
    "family.ec.pet-dies": 8,
    "family.mc.grandparent-dies": 18,
    "family.mc.money-tight": 14,
    "family.ec.parent-late-shifts": 6,
    "family.inf.lost-toy": 3,
    "family.mc.second-job": 7,
    "family.mc.grounded": 5,
    "family.mc.curfew-broken": 4,
    "family.mc.older-sibling-leaves": 6,
    "school.detention": 4,
    "school.suspended": 14,
    "school.exam-panic": 9,
    "school.front-of-class": 4,
    "school.reading-struggle": 8,
    "school.hated-teacher": 9,
    "school.new-school": 11,
    "school.picked-last": 7,
    "school.maths-wall": 8,
    "school.principal-office": 8,
    "friend.moved-away": 9,
    "friend.first-fight": 6,
    "friend.group-collapse": 14,
    "friend.fell-out": 7,
    "friend.left-out": 8,
    "friend.betrayed": 12,
    "friend.rejected": 6,
    "friend.borrowed-never-returned": 3,
    "random.broken-arm": 9,
    "random.stitches": 6,
    "random.phone-confiscated": 4,
    "random.late-bloom": 7,
    "random.embarrassment": 4,
    "random.first-funeral-suit": 8,
    "talent.act.stage-fright": 9,
    "talent.aca.burnout": 12,
    "talent.cri.caught": 15,
    # --- years that help -----------------------------------------------------
    "family.ec.bedtime-story": -3,
    "family.ec.bedtime-story-dad": -3,
    "family.mc.grandparent-close": -7,
    "family.mc.family-holiday": -9,
    "family.mc.camping": -6,
    "school.summer-camp": -6,
    "school.summer-nothing": -8,
    "friend.bike-summer": -7,
    "friend.fort": -4,
    "friend.loner": -4,
    "random.filler.teen.2": -6,
    "random.snow-day": -4,
    "random.library-card": -3,
    "random.stray-cat": -3,
    "random.cardboard": -4,
    "random.perfect-day": -10,
    "random.lunch-trades": -3,
    "random.attic-find": -4,
    "talent.wri.journal": -4,
    "talent.ath.championship": -6,
    "talent.mus.first-gig": -5,
    "friend.defended": -8,
    "friend.crush-returned": -6,
    "family.ec.big-birthday": -4,
    "family.ec.small-birthday": -4,
    "family.ec.pet-arrives": -5,
    "family.ec.pet-arrives-solo": -5,
    "family.mc.first-car-gift": -6,
    "school.reading-list": -3,
    "friend.first": -6,
    "friend.arcade": -4,
    "random.filler.infant.1": -4,
    "early.zoo": -3,
}


def apply_stress() -> None:
    """
    Fold the table above into the events it names.

    An unknown id is a hard error rather than a warning: an event renamed out
    from under this table would silently drop its stress and nothing would fail,
    which is precisely the class of bug that only shows up in a screenshot
    eighteen simulated years later.
    """
    by_id = {event["id"]: event for event in EVENTS}
    missing = sorted(set(STRESS_BY_EVENT) - set(by_id))
    if missing:
        raise SystemExit(f"STRESS_BY_EVENT names events that do not exist: {missing}")
    for event_id, points in STRESS_BY_EVENT.items():
        event = by_id[event_id]
        effects = dict(event.get("effects") or {})
        effects["stress"] = points
        event["effects"] = effects


def main() -> None:
    # Order matters: check, WRITE, then report. Reporting first means piping this
    # through `head` closes the pipe, the next print kills the process, and the
    # file is silently never written — which cost real time twice.
    apply_stress()
    check()
    payload = {"version": CATALOG_VERSION, "entries": EVENTS}
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    report()


if __name__ == "__main__":
    main()
