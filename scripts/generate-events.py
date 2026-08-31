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
  {olderSibling} {city} {kid} {kid2} {they} {them} {their}

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

# Which family requirement each person-token needs before it may be used.
TOKEN_GUARDS = {
    "mother": {"mother", "bothParents"},
    "father": {"father", "bothParents"},
    "parent": {"mother", "father", "anyParent", "bothParents", "singleParent"},
    "parents": {"bothParents"},
    "sibling": {"sibling", "siblings2", "olderSibling"},
    "siblingRel": {"sibling", "siblings2", "olderSibling"},
    "olderSibling": {"olderSibling"},
}
FREE_TOKENS = {"me", "city", "kid", "kid2", "they", "them", "their"}


def prune(mapping: dict) -> dict:
    return {key: value for key, value in mapping.items() if value not in (None, {}, [])}


def FX(
    stats: dict | None = None,
    relationship: dict | None = None,
    cash: int | None = None,
    set_flags: list[str] | None = None,
    clear_flags: list[str] | None = None,
) -> dict:
    """An event's consequences."""
    return prune(
        {
            "stats": stats,
            "relationship": relationship,
            "cash": cash,
            "setFlags": set_flags,
            "clearFlags": clear_flags,
        }
    )


def COND(
    age_min: int | None = None,
    age_max: int | None = None,
    sex: str | None = None,
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
    effects: dict | None = None,
    outcomes: list[dict] | None = None,
    follow_up: dict | None = None,
    requires: dict | None = None,
) -> dict:
    return prune(
        {
            "id": id,
            "label": label,
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
    "Started getting an allowance, tied loosely to work actually performed.",
], age_min=7, age_max=14, requires=["anyParent"], weight=10, cooldown=4,
   wealth_any=["modest", "comfortable", "affluent", "wealthy"],
   effects=FX(cash=60, stats={"discipline": 1}))

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
    "{parent} picked up a second job. You saw a lot less of them, and understood why.",
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
   effects=FX(stats={"smarts": 3, "happiness": 2, "willpower": 1}))

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
   effects=FX(stats={"discipline": 2, "happiness": 1}))

E("school.detention", "school", [
    "Detention, for something that had seemed extremely funny at the time.",
], age_min=8, age_max=17, weight=12, cooldown=2,
   effects=FX(stats={"discipline": -1, "charisma": 1}),
   modifiers=[MOD(1.9, talents_any=["crime"]), MOD(0.4, stat_at_least={"discipline": 70})])

E("school.suspended", "school", [
    "Suspended for three days. The house was very quiet about it.",
], age_min=10, age_max=17, weight=7, rarity="uncommon", requires=["anyParent"],
   effects=FX(stats={"discipline": -2, "happiness": -2}, relationship={"parents": -4}),
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
    "Took a weekend job that paid badly and taught more than a year of school did.",
], age_min=14, age_max=17, weight=11, cooldown=2,
   wealth_any=["struggling", "modest", "comfortable"],
   effects=FX(cash=900, stats={"discipline": 3, "charisma": 1}))

E("school.summer-camp", "school", [
    "Summer camp. Came back with a lanyard, a sunburn and three new opinions.",
], age_min=8, age_max=16, weight=9, cooldown=3,
   wealth_any=["comfortable", "affluent", "wealthy"],
   effects=FX(stats={"charisma": 2, "happiness": 2, "health": 1}))

E("school.summer-nothing", "school", [
    "Spent the whole summer on one street with three other kids and no plans at all.",
], age_min=7, age_max=14, weight=12, cooldown=3,
   effects=FX(stats={"happiness": 3, "charisma": 1}))

E("school.graduation", "school", [
    "Finished school. Somebody's parent cried, and it was not necessarily yours.",
], age_min=17, age_max=17, weight=20,
   effects=FX(stats={"happiness": 4, "discipline": 1}))


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
    "A new kid, {kid}, showed up mid-term and you were the one who talked to them first.",
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
    "{kid} told everyone the one thing you had asked them not to.",
], age_min=9, age_max=17, weight=9, rarity="uncommon",
   effects=FX(stats={"happiness": -5, "charisma": 1, "willpower": 2}))

E("friend.defended", "friendship", [
    "{kid} stood up for you in front of everybody, at real cost to themselves.",
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
    "Discovered an arcade with {kid} and lost a genuinely irresponsible amount of pocket money.",
], age_min=8, age_max=16, weight=10, cooldown=3,
   effects=FX(stats={"happiness": 2}, cash=-25))

E("friend.borrowed-never-returned", "friendship", [
    "Lent {kid} something you loved. It has not come back and it is not going to.",
], age_min=7, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": -2, "smarts": 1}))

E("friend.first-fight", "friendship", [
    "An actual fistfight in a playground, over nothing, lasting eleven seconds.",
], age_min=8, age_max=15, weight=9, cooldown=4,
   effects=FX(stats={"health": -1, "willpower": 2, "charisma": 1}),
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
    "Lost a tooth and negotiated hard on the going rate.",
], age_min=5, age_max=9, weight=12, cooldown=2,
   effects=FX(cash=5, stats={"charisma": 1}))

E("random.swimming", "random", [
    "Learned to swim, badly, in a pool that smelled of chlorine and fear.",
], age_min=4, age_max=11, weight=11,
   effects=FX(stats={"health": 2, "willpower": 1}))

E("random.storm", "random", [
    "A storm took out the power for three days and it was the best week of the year.",
], age_min=4, age_max=15, weight=9, cooldown=5,
   effects=FX(stats={"happiness": 2, "willpower": 1}))

E("random.found-money", "random", [
    "Found money on the pavement and told nobody, ever.",
], age_min=5, age_max=17, weight=9, cooldown=4,
   effects=FX(cash=20, stats={"happiness": 2}))

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
    "{parent} let you scratch the lottery ticket. It won eight dollars and was celebrated for days.",
], age_min=6, age_max=14, weight=8, requires=["anyParent"], rarity="uncommon",
   effects=FX(cash=8, stats={"happiness": 2}))

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
    "Did a commercial for a regional furniture shop. It paid, and it aired, relentlessly.",
], age_min=9, age_max=17, weight=7, rarity="rare", talents_any=["acting"],
   effects=FX(cash=800, stats={"charisma": 3, "happiness": 3}))

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
    "Placed in a writing competition that had a genuinely large number of entrants.",
], age_min=10, age_max=17, weight=9, talents_any=["writing"], rarity="uncommon",
   effects=FX(stats={"smarts": 3, "happiness": 4}, cash=100))

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
    "Started tutoring kids a year below for cash, and turned out to be good at it.",
], age_min=13, age_max=17, weight=10, talents_any=["academics"], cooldown=2,
   effects=FX(cash=350, stats={"smarts": 2, "charisma": 2, "discipline": 2}))

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
    "Word got round the street that you could fix things, and it stopped being a favour.",
], age_min=10, age_max=17, weight=10, talents_any=["inventive"], cooldown=3,
   effects=FX(cash=180, stats={"charisma": 2, "smarts": 2}))

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
    "Ran a small and profitable trade in banned goods at school.",
], age_min=9, age_max=17, weight=12, talents_any=["crime"], cooldown=3,
   effects=FX(cash=140, stats={"charisma": 3, "smarts": 2, "discipline": -1}))

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
# Spec 725-770 caps a year at roughly three of these, and the engine starts
# offering them at FIRST_DECISION_AGE. Two rules held throughout:
#   - no choice is strictly correct. Every option buys something and costs
#     something, so the player is choosing a person rather than a number.
#   - uncertain choices use weighted outcomes. Talents shift the odds; they
#     never guarantee the result (spec 725-770).
# =============================================================================

D("d.school.cheat", "school", [
    "The kid next to you has left their test paper at exactly the right angle.",
], [
    C("copy", "Copy it", outcomes=[
        OUT(6, "You copied, got the grade, and spent a fortnight waiting to be called to an office.",
            FX(stats={"smarts": -1, "happiness": -2, "discipline": -2})),
        OUT(4, "You copied and were caught within the hour. The grade became the least of it.",
            FX(stats={"happiness": -4, "discipline": -3}, relationship={"parents": -4})),
    ]),
    C("own-work", "Do your own work", text="You did your own work and got what you got.",
      effects=FX(stats={"willpower": 3, "discipline": 2})),
], age_min=9, age_max=17, weight=13,
   modifiers=[MOD(1.7, talents_any=["crime"]), MOD(0.5, stat_at_least={"discipline": 70})])

D("d.school.club", "school", [
    "Sign-up sheets went up for after-school clubs and you can only realistically do one.",
], [
    C("sport", "Sports team", text="You went with the team. Three evenings a week, all year.",
      effects=FX(stats={"health": 4, "charisma": 2, "discipline": 2})),
    C("study", "Academic club", text="You took the quiet room with the good teacher in it.",
      effects=FX(stats={"smarts": 4, "discipline": 2, "charisma": -1})),
    C("arts", "Drama or music", text="You picked the one with a stage at the end of it.",
      effects=FX(stats={"charisma": 4, "happiness": 2})),
    C("none", "Skip it", text="You went home instead, and got very good at having spare time.",
      effects=FX(stats={"happiness": 2, "discipline": -1})),
], age_min=8, age_max=17, weight=14, cooldown=4)

D("d.school.study-hard", "school", [
    "Exams are eight weeks out and there is a real decision to be made about the next eight weeks.",
], [
    C("grind", "Work for it", outcomes=[
        OUT(7, "You worked, and it showed. Something clicked around week five.",
            FX(stats={"smarts": 4, "discipline": 3, "happiness": -1})),
        OUT(3, "You worked hard and the results were middling anyway, which was its own lesson.",
            FX(stats={"discipline": 3, "willpower": 2, "happiness": -2})),
    ]),
    C("coast", "Coast", text="You coasted. It was a good couple of months and a mediocre set of results.",
      effects=FX(stats={"happiness": 3, "smarts": -1, "discipline": -2})),
], age_min=12, age_max=17, weight=13, cooldown=3)

D("d.school.bully-response", "school", [
    "The kid who has been making your year difficult is standing in front of you again.",
], [
    C("fight", "Hit back", outcomes=[
        OUT(5, "You hit back. It stopped completely, and you were suspended for a week.",
            FX(stats={"willpower": 4, "happiness": 2, "discipline": -2},
               relationship={"parents": -3}, clear_flags=["school.bullied"])),
        OUT(5, "You hit back, lost, and it got worse before it got better.",
            FX(stats={"health": -3, "happiness": -3, "willpower": 3})),
    ]),
    C("tell", "Tell an adult", outcomes=[
        OUT(6, "An adult handled it, quietly and well. It ended.",
            FX(stats={"happiness": 3, "charisma": -1}, clear_flags=["school.bullied"])),
        OUT(4, "The adult handled it badly and it became a much more public problem.",
            FX(stats={"happiness": -3, "willpower": 2})),
    ]),
    C("endure", "Ride it out", text="You said nothing and waited it out. It took another year.",
      effects=FX(stats={"willpower": 4, "happiness": -4})),
], age_min=8, age_max=17, weight=16, flags_all=["school.bullied"])

D("d.school.detention-blame", "school", [
    "Something got broken and the teacher is asking, in a general way, who did it.",
], [
    C("own", "Own up", text="You owned it. The punishment was smaller than the silence would have been.",
      effects=FX(stats={"willpower": 3, "discipline": 2, "happiness": -1})),
    C("silent", "Say nothing", outcomes=[
        OUT(6, "Nobody said anything and the whole class was kept back. It was never mentioned again.",
            FX(stats={"charisma": 1, "happiness": -1})),
        OUT(4, "Somebody named you within a day, and it landed much harder for the delay.",
            FX(stats={"happiness": -3, "discipline": -1}, relationship={"parents": -2})),
    ]),
    C("blame", "Blame someone else",
      text="You gave them a name. It worked, and it cost you a friend who worked out why.",
      effects=FX(stats={"charisma": -2, "happiness": -2, "discipline": -1})),
], age_min=8, age_max=16, weight=12)

D("d.family.chore-money", "family", [
    "{parent} has offered actual money for a genuinely unpleasant weekend of work.",
], [
    C("take", "Take the job", text="You did it, badly at first and then properly, and got paid.",
      effects=FX(cash=120, stats={"discipline": 3}, relationship={"parents": 3})),
    C("negotiate", "Negotiate first", outcomes=[
        OUT(5, "You negotiated up, which was noticed and quietly respected.",
            FX(cash=200, stats={"charisma": 3}, relationship={"parents": 2})),
        OUT(5, "You negotiated, the offer was withdrawn, and the job was done by somebody else.",
            FX(stats={"charisma": 1, "happiness": -1}, relationship={"parents": -2})),
    ]),
    C("refuse", "Refuse", text="You had better things to do, and did them.",
      effects=FX(stats={"happiness": 2}, relationship={"parents": -3})),
], age_min=9, age_max=17, requires=["anyParent"], weight=13, cooldown=4)

D("d.family.sibling-secret", "family", [
    "{sibling} has done something that is going to come out eventually, and has asked you to sit on it.",
], [
    C("keep", "Keep quiet", outcomes=[
        OUT(6, "You kept it. It never came out, and {sibling} has not forgotten.",
            FX(relationship={"siblings": 8}, stats={"willpower": 2})),
        OUT(4, "You kept it, it came out anyway, and you were standing next to it when it did.",
            FX(relationship={"siblings": 4, "parents": -4}, stats={"happiness": -2})),
    ]),
    C("tell", "Tell a parent", text="You told. It was probably the right call and it did not feel like it.",
      effects=FX(relationship={"siblings": -8, "parents": 3}, stats={"discipline": 2})),
], age_min=8, age_max=17, requires=["sibling", "anyParent"], weight=13)

D("d.family.move-away", "family", [
    "The family is moving away from {city}, and you have been asked what you think, which is new.",
], [
    C("support", "Say you're fine with it",
      text="You said you were fine with it. Some of that was even true.",
      effects=FX(relationship={"parents": 5}, stats={"willpower": 2, "happiness": -2})),
    C("fight", "Fight it", outcomes=[
        OUT(3, "You made enough of a case that the move was delayed a year.",
            FX(stats={"charisma": 4, "happiness": 3}, relationship={"parents": -2})),
        OUT(7, "You lost the argument, and the move happened on schedule anyway.",
            FX(stats={"happiness": -4, "willpower": 2}, relationship={"parents": -4})),
    ]),
], age_min=8, age_max=16, requires=["anyParent"], weight=9, rarity="uncommon")

D("d.family.grandparent-visit", "family", [
    "A grandparent has been in hospital, and visiting means giving up something you had planned.",
], [
    C("go", "Go", text="You went. It was awkward for ten minutes and mattered for years.",
      effects=FX(stats={"happiness": 1, "willpower": 2}, relationship={"family": 4})),
    C("skip", "Skip it", text="You didn't go. Nobody said anything about it, which was worse.",
      effects=FX(stats={"happiness": -3}, relationship={"family": -3})),
], age_min=9, age_max=17, weight=10, rarity="uncommon")

D("d.friend.dare", "friendship", [
    "{kid} has proposed something that is obviously a bad idea and everybody is watching.",
], [
    C("do-it", "Do it", outcomes=[
        OUT(5, "It worked. You were a legend for about six weeks.",
            FX(stats={"charisma": 4, "happiness": 3, "willpower": 1})),
        OUT(4, "It did not work. There was blood, and an adult, and a story that outlived the injury.",
            FX(stats={"health": -3, "charisma": 2, "happiness": -1})),
        OUT(2, "It went badly enough that somebody's parents were called.",
            FX(stats={"health": -2, "happiness": -3}, relationship={"parents": -3})),
    ]),
    C("refuse", "Refuse", text="You said no. It cost something socially and nothing else.",
      effects=FX(stats={"willpower": 3, "charisma": -2})),
], age_min=7, age_max=17, weight=14, cooldown=4,
   modifiers=[MOD(1.6, talents_any=["athletics", "crime"]), MOD(0.5, stat_at_least={"discipline": 72})])

D("d.friend.new-kid", "friendship", [
    "There is a new kid eating lunch alone, and a table you already have a seat at.",
], [
    C("invite", "Bring them over", outcomes=[
        OUT(7, "You brought them over. It turned into one of the good ones.",
            FX(stats={"charisma": 3, "happiness": 4})),
        OUT(3, "You brought them over and it did not take. You were still glad you did.",
            FX(stats={"charisma": 2, "happiness": 1})),
    ]),
    C("leave", "Leave it", text="You left it. Somebody else did it a week later.",
      effects=FX(stats={"happiness": -1})),
], age_min=7, age_max=17, weight=13, cooldown=5)

D("d.friend.exclusion", "friendship", [
    "The group has decided to freeze somebody out, and is waiting to see what you do.",
], [
    C("join", "Go along with it", text="You went along with it. It was easy, and you remember it.",
      effects=FX(stats={"charisma": 2, "happiness": -3, "willpower": -1})),
    C("refuse", "Refuse", outcomes=[
        OUT(5, "You refused, and it broke the whole thing up within a week.",
            FX(stats={"willpower": 4, "charisma": 2, "happiness": 2})),
        OUT(5, "You refused, and were frozen out alongside them.",
            FX(stats={"willpower": 4, "charisma": -3, "happiness": -3})),
    ]),
], age_min=9, age_max=17, weight=12)

D("d.friend.confession", "friendship", [
    "You have been rehearsing a conversation with somebody for four months.",
], [
    C("ask", "Say something", outcomes=[
        OUT(4, "You said it. They said it back. The year improved considerably.",
            FX(stats={"happiness": 6, "charisma": 3})),
        OUT(6, "You said it. They were kind about it. It still took months.",
            FX(stats={"happiness": -3, "willpower": 3, "charisma": 1})),
    ]),
    C("wait", "Say nothing", text="You said nothing, all year, and thought about it constantly.",
      effects=FX(stats={"happiness": -2, "willpower": -1})),
], age_min=12, age_max=17, weight=13, cooldown=4,
   modifiers=[MOD(1.5, stat_at_least={"looks": 65}), MOD(1.4, stat_at_least={"charisma": 68})])

D("d.friend.party", "friendship", [
    "There is a party this weekend that {parent} has specifically said no to.",
], [
    C("sneak", "Go anyway", outcomes=[
        OUT(5, "You went, got back in through a window, and were never found out.",
            FX(stats={"happiness": 4, "charisma": 3, "discipline": -1})),
        OUT(5, "You went, and {parent} was sitting in the kitchen when you got back.",
            FX(stats={"happiness": -2, "charisma": 2}, relationship={"parents": -6})),
    ]),
    C("stay", "Stay home", text="You stayed home and heard about it for a month.",
      effects=FX(stats={"charisma": -2, "discipline": 2}, relationship={"parents": 3})),
    C("ask-again", "Try to talk them round", outcomes=[
        OUT(4, "You made a real case and got a curfew instead of a no.",
            FX(stats={"charisma": 4, "happiness": 3}, relationship={"parents": 2})),
        OUT(6, "The answer stayed no, and got firmer for the asking.",
            FX(stats={"charisma": 1, "happiness": -2})),
    ]),
], age_min=13, age_max=17, requires=["anyParent"], weight=14, cooldown=3)

D("d.friend.blame-friend", "friendship", [
    "{kid} broke something expensive and the two of you are the only ones who know.",
], [
    C("cover", "Cover for them", text="You took it. They knew, and it changed the friendship.",
      effects=FX(stats={"willpower": 3, "happiness": -2}, relationship={"parents": -3})),
    C("truth", "Tell the truth", text="You told the truth. It was the correct thing and it ended the friendship.",
      effects=FX(stats={"discipline": 2, "happiness": -3, "charisma": -1})),
], age_min=9, age_max=17, weight=11)

D("d.random.stray-dog", "random", [
    "There is a dog outside with no collar, and it has decided to follow you home.",
], [
    C("keep", "Take it home", outcomes=[
        OUT(6, "{parent} said no for two days and then bought a bowl.",
            FX(stats={"happiness": 5}, relationship={"parents": 2})),
        OUT(4, "It had an owner, who was extremely relieved and gave you twenty dollars.",
            FX(cash=20, stats={"happiness": 1})),
    ], requires=COND(requires=["anyParent"])),
    C("owner", "Look for the owner",
      text="You knocked on doors until you found the right one. They were in tears about it.",
      effects=FX(stats={"charisma": 2, "willpower": 2, "happiness": 2})),
    C("leave", "Leave it", text="You left it. You thought about it for a long time afterwards.",
      effects=FX(stats={"happiness": -2, "willpower": 1})),
], age_min=6, age_max=15, weight=11)

D("d.random.found-wallet", "random", [
    "There is a wallet on the pavement with more cash in it than you have ever held.",
], [
    C("keep", "Keep it", outcomes=[
        OUT(7, "You kept it. Nobody ever came looking, and you did not enjoy the money much.",
            FX(cash=90, stats={"happiness": -1, "discipline": -2})),
        OUT(3, "You kept it, and somebody worked out it was you.",
            FX(cash=90, stats={"charisma": -3, "happiness": -3})),
    ]),
    C("return", "Hand it in", outcomes=[
        OUT(6, "You handed it in. The owner turned up with a reward and a handshake.",
            FX(cash=25, stats={"happiness": 3, "willpower": 2})),
        OUT(4, "You handed it in and heard nothing more about it, ever.",
            FX(stats={"willpower": 3, "happiness": 1})),
    ]),
], age_min=8, age_max=17, weight=12,
   modifiers=[MOD(1.8, talents_any=["crime"])])

D("d.random.first-cigarette", "random", [
    "Somebody has produced a packet behind the sports hall and is offering it round.",
], [
    C("try", "Try it", text="You tried it, coughed for a minute, and pretended otherwise.",
      effects=FX(stats={"health": -2, "charisma": 2, "discipline": -1})),
    C("decline", "Pass", text="You passed. It was noted, and briefly held against you.",
      effects=FX(stats={"willpower": 3, "health": 1, "charisma": -1})),
], age_min=12, age_max=17, weight=12,
   modifiers=[MOD(1.6, talents_any=["crime"]), MOD(0.5, stat_at_least={"discipline": 70})])

D("d.random.savings", "random", [
    "You have saved up, slowly, and there is now a real decision about what it is for.",
], [
    C("spend", "Spend it now", text="You spent it immediately and had an excellent fortnight.",
      effects=FX(cash=-150, stats={"happiness": 5, "discipline": -2})),
    C("save", "Keep saving", text="You left it alone. It was hard and the pile got bigger.",
      effects=FX(stats={"discipline": 4, "willpower": 2, "happiness": -1})),
], age_min=10, age_max=17, weight=11, cooldown=4)

D("d.random.summer", "random", [
    "Summer is eleven weeks long and completely undecided.",
], [
    C("work", "Get a job", text="You worked. It was dull, it paid, and it made the autumn easier.",
      effects=FX(cash=1100, stats={"discipline": 3, "happiness": -1})),
    C("train", "Train or practise", text="You spent the summer getting better at one thing.",
      effects=FX(stats={"discipline": 3, "health": 2, "willpower": 2})),
    C("nothing", "Do absolutely nothing",
      text="You did nothing for eleven weeks and it remains one of the great summers.",
      effects=FX(stats={"happiness": 5, "discipline": -2})),
], age_min=13, age_max=17, weight=13, cooldown=2)

D("d.random.appearance", "random", [
    "You have decided that something about how you look is going to change this year.",
], [
    C("effort", "Put real effort in", outcomes=[
        OUT(6, "It worked. People noticed, and did not always say so.",
            FX(stats={"looks": 5, "charisma": 2, "discipline": 2})),
        OUT(4, "It half worked, which is roughly what happens at that age.",
            FX(stats={"looks": 2, "discipline": 2})),
    ]),
    C("gym", "Get fit instead", text="You started running, hated it for six weeks, then didn't.",
      effects=FX(stats={"health": 5, "discipline": 3, "looks": 2})),
    C("drop", "Decide not to care", text="You decided not to care. It took more willpower than the alternative.",
      effects=FX(stats={"willpower": 4, "happiness": 2})),
], age_min=12, age_max=17, weight=12, cooldown=3)

D("d.talent.commit", "talent", [
    "The thing you are good at now wants more time than you have, and something has to give.",
], [
    C("commit", "Go all in", outcomes=[
        OUT(6, "You went all in. School slipped and the thing got serious.",
            FX(stats={"discipline": 4, "smarts": -2, "happiness": 3}, set_flags=["talent.committed"])),
        OUT(4, "You went all in and burned out by spring. It came back later.",
            FX(stats={"willpower": 3, "happiness": -3})),
    ]),
    C("balance", "Keep it balanced", text="You kept it balanced, which meant being second-best at both.",
      effects=FX(stats={"discipline": 2, "smarts": 1, "happiness": 1})),
    C("drop", "Let it go", text="You let it go. It was a relief for about a year.",
      effects=FX(stats={"happiness": 2, "discipline": -1, "willpower": -1})),
], age_min=12, age_max=17, weight=14,
   talents_any=["athletics", "acting", "music", "writing", "academics", "inventive"])

D("d.talent.rival", "talent", [
    "Somebody your age is visibly better at your thing than you are.",
], [
    C("train", "Out-work them", outcomes=[
        OUT(5, "You out-worked them. It took two years and it took.",
            FX(stats={"discipline": 5, "willpower": 4, "happiness": 2})),
        OUT(5, "You out-worked them and they stayed better. That was worth knowing early.",
            FX(stats={"discipline": 4, "willpower": 3, "happiness": -3})),
    ]),
    C("learn", "Learn from them", text="You asked them how. They told you, and you both got better.",
      effects=FX(stats={"smarts": 2, "charisma": 3, "discipline": 2})),
    C("quit", "Find something else", text="You moved on to something with less competition in it.",
      effects=FX(stats={"happiness": 1, "willpower": -2})),
], age_min=10, age_max=17, weight=12,
   talents_any=["athletics", "acting", "music", "writing", "academics", "inventive", "crime"])

O("o.talent.audition", "talent", [
    "A letter arrived about an audition for something that does not usually come to {city}.",
], [
    C("go", "Go", outcomes=[
        OUT(3, "You got it. It changed what you thought was possible.",
            FX(stats={"charisma": 5, "happiness": 6, "discipline": 2}, set_flags=["talent.breakthrough"])),
        OUT(7, "You did not get it, and the room itself was an education.",
            FX(stats={"charisma": 2, "willpower": 3, "happiness": -2})),
    ]),
    C("skip", "Don't go", text="You did not go. It is one of the ones you still think about.",
      effects=FX(stats={"happiness": -3, "willpower": -1})),
], age_min=11, age_max=17, weight=11, rarity="rare", talents_any=["acting", "music"])

O("o.talent.trial", "talent", [
    "A club two hours away has invited you to trial, and somebody would have to drive you.",
], [
    C("go", "Go to the trial", outcomes=[
        OUT(4, "You were offered a place. Everything about the next three years got harder and better.",
            FX(stats={"health": 3, "discipline": 5, "happiness": 5}, set_flags=["talent.breakthrough"])),
        OUT(6, "You did not make it. You were closer than the result suggested.",
            FX(stats={"health": 2, "willpower": 4, "happiness": -3})),
    ]),
    C("skip", "Let it go", text="It was too far and there was nobody free to drive. That was the whole reason.",
      effects=FX(stats={"happiness": -4, "willpower": 1})),
], age_min=11, age_max=17, requires=["anyParent"], weight=11, rarity="rare",
   talents_any=["athletics"])

O("o.aca.scholarship", "talent", [
    "A school you had not considered has written to you directly about a place and a bursary.",
], [
    C("apply", "Apply", outcomes=[
        OUT(4, "You got in. The commute was brutal and the teaching was extraordinary.",
            FX(stats={"smarts": 6, "discipline": 4, "happiness": -1}, set_flags=["talent.breakthrough"])),
        OUT(6, "You did not get in, and the application itself taught you how to write about yourself.",
            FX(stats={"smarts": 2, "willpower": 3})),
    ]),
    C("stay", "Stay where you are", text="You stayed. Your friends were there, and that was a real reason.",
      effects=FX(stats={"happiness": 3, "charisma": 2})),
], age_min=10, age_max=16, weight=11, rarity="rare", talents_any=["academics"])

O("o.random.stranger-kindness", "random", [
    "A neighbour you barely know has offered to teach you something they are very good at.",
], [
    C("accept", "Take them up on it", text="You said yes. It became a Saturday habit for four years.",
      effects=FX(stats={"smarts": 3, "discipline": 3, "happiness": 3})),
    C("decline", "Politely decline", text="You said no thanks, and the offer was never repeated.",
      effects=FX(stats={"happiness": -1})),
], age_min=8, age_max=16, weight=10, rarity="uncommon")

O("o.random.competition-entry", "random", [
    "There is a competition with a real prize, and the entry form is sitting on the kitchen table.",
], [
    C("enter", "Enter it", outcomes=[
        OUT(2, "You won. Nobody was more surprised than the people who knew you.",
            FX(cash=600, stats={"happiness": 6, "charisma": 3})),
        OUT(8, "You did not win, and the entry itself took more nerve than the result required.",
            FX(stats={"willpower": 3, "happiness": -1})),
    ]),
    C("bin", "Leave it", text="The form stayed on the table until somebody threw it out.",
      effects=FX(stats={"happiness": -1})),
], age_min=8, age_max=17, weight=11, rarity="uncommon", cooldown=6)

D("d.family.parent-asks", "family", [
    "{parent} has asked, directly and without warning, whether you are all right.",
], [
    C("honest", "Tell them the truth", outcomes=[
        OUT(7, "You told them. They listened better than you expected.",
            FX(stats={"happiness": 4}, relationship={"parents": 6})),
        OUT(3, "You told them, and they did not know what to do with it. They tried.",
            FX(stats={"happiness": 1}, relationship={"parents": 2})),
    ]),
    C("deflect", "Say you're fine", text="You said you were fine. They knew, and let it go.",
      effects=FX(stats={"willpower": 1, "happiness": -2}, relationship={"parents": -1})),
], age_min=11, age_max=17, requires=["anyParent"], weight=12, cooldown=4,
   modifiers=[MOD(2.0, stat_at_most={"happiness": 40})])

D("d.school.speech", "school", [
    "You have been asked to speak in front of the whole school. It is optional in theory only.",
], [
    C("do", "Do it", outcomes=[
        OUT(6, "You did it, and it went well enough that two teachers mentioned it afterwards.",
            FX(stats={"charisma": 5, "happiness": 3, "willpower": 2})),
        OUT(4, "You did it, and it went badly, and you survived it, which was the actual lesson.",
            FX(stats={"charisma": 2, "willpower": 4, "happiness": -3})),
    ]),
    C("refuse", "Get out of it", text="You found a way out of it and felt the relief for about an hour.",
      effects=FX(stats={"happiness": -1, "charisma": -2})),
], age_min=10, age_max=17, weight=12, cooldown=4,
   modifiers=[MOD(1.6, talents_any=["acting"]), MOD(1.4, stat_at_least={"charisma": 65})])


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
# MORE DECISIONS
#
# Decision density matters more than passive density: a year with a real choice
# in it is the year a player remembers. These fill the gaps by age band, so a
# character is being asked things from FIRST_DECISION_AGE onwards.
# =============================================================================

D("d.school.reading-group", "school", [
    "You have been offered a move up to the harder reading group, where you would be the youngest.",
], [
    C("move", "Move up", outcomes=[
        OUT(6, "You moved up and kept pace, quietly, all year.",
            FX(stats={"smarts": 4, "discipline": 2})),
        OUT(4, "You moved up and struggled, in public, for two terms.",
            FX(stats={"smarts": 2, "happiness": -3, "willpower": 3})),
    ]),
    C("stay", "Stay where you are", text="You stayed put, with your friends, and coasted comfortably.",
      effects=FX(stats={"happiness": 2, "charisma": 1})),
], age_min=6, age_max=11, weight=12,
   modifiers=[MOD(1.8, talents_any=["academics"])])

D("d.school.instrument", "school", [
    "The school is handing out instruments. Whatever you pick, you are stuck with for years.",
], [
    C("loud", "Something loud", text="You picked the loudest option available and never regretted it.",
      effects=FX(stats={"happiness": 3, "charisma": 2, "discipline": 1})),
    C("serious", "Something serious", text="You picked the difficult one and practised like it mattered.",
      effects=FX(stats={"discipline": 4, "smarts": 2})),
    C("none", "Don't take one", text="You did not take one. Somebody in the house was relieved.",
      effects=FX(stats={"happiness": 1})),
], age_min=7, age_max=13, weight=12,
   modifiers=[MOD(2.0, talents_any=["music"])])

D("d.school.team-tryout", "school", [
    "Trials for the school team are on Thursday, and half your year is going.",
], [
    C("try", "Try out", outcomes=[
        OUT(5, "You made the squad. Not the first eleven, but the squad.",
            FX(stats={"health": 3, "charisma": 2, "happiness": 3})),
        OUT(5, "You were cut on the first day, in front of everyone.",
            FX(stats={"happiness": -4, "willpower": 3, "health": 1})),
    ]),
    C("skip", "Don't bother", text="You did not go. It was the sensible call and it sat badly.",
      effects=FX(stats={"happiness": -1, "willpower": -1})),
], age_min=8, age_max=16, weight=13, cooldown=4,
   modifiers=[MOD(2.4, talents_any=["athletics"]), MOD(0.6, stat_at_most={"health": 45})])

D("d.family.pet-responsibility", "family", [
    "There is a serious family conversation about a pet, and the word 'responsibility' has been used four times.",
], [
    C("promise", "Promise everything", outcomes=[
        OUT(6, "You promised everything, got the pet, and did about half of it.",
            FX(stats={"happiness": 5, "discipline": 1}, relationship={"parents": -1})),
        OUT(4, "You promised everything and, to universal surprise, did all of it.",
            FX(stats={"happiness": 5, "discipline": 4}, relationship={"parents": 4})),
    ]),
    C("honest", "Be honest about it",
      text="You said you probably wouldn't keep it up. The answer was no, and it was fair.",
      effects=FX(stats={"willpower": 2, "happiness": -2}, relationship={"parents": 3})),
], age_min=6, age_max=14, requires=["anyParent"], weight=12)

D("d.family.holiday-choice", "family", [
    "The family holiday is being decided at the table and, unusually, you get a vote.",
], [
    C("push", "Push for what you want", outcomes=[
        OUT(5, "You got your way and it was a great week.",
            FX(stats={"happiness": 4, "charisma": 2})),
        OUT(5, "You got your way and it rained for six days, which was noted repeatedly.",
            FX(stats={"happiness": -2, "charisma": 1}, relationship={"family": -2})),
    ]),
    C("defer", "Let someone else pick", text="You let {sibling} pick, which bought you something later.",
      effects=FX(relationship={"siblings": 5}, stats={"charisma": 1})),
], age_min=8, age_max=16, requires=["anyParent", "sibling"], weight=11, cooldown=5)

D("d.family.parent-favour", "family", [
    "{parent} needs a hand with something all Saturday, and you had plans.",
], [
    C("help", "Cancel and help", text="You cancelled and helped. It took nine hours and was never mentioned again.",
      effects=FX(relationship={"parents": 6}, stats={"discipline": 2, "happiness": -1})),
    C("plans", "Keep your plans", text="You went out. It was a good day with a shadow on it.",
      effects=FX(relationship={"parents": -4}, stats={"happiness": 2})),
], age_min=10, age_max=17, requires=["anyParent"], weight=12, cooldown=4)

D("d.family.sibling-fight", "family", [
    "{sibling} has taken something of yours and broken it, and is standing right there.",
], [
    C("shout", "Lose it", outcomes=[
        OUT(6, "You lost it completely. They were punished and it stayed sour for months.",
            FX(relationship={"siblings": -7}, stats={"happiness": -2, "willpower": -1})),
        OUT(4, "You lost it, and were the one who ended up in trouble for the noise.",
            FX(relationship={"siblings": -4, "parents": -3}, stats={"happiness": -3})),
    ]),
    C("let-go", "Let it go", text="You let it go. They noticed, which was the point.",
      effects=FX(relationship={"siblings": 5}, stats={"willpower": 3})),
], age_min=6, age_max=16, requires=["sibling"], weight=13, cooldown=4,
   modifiers=[MOD(1.5, stat_at_most={"willpower": 40})])

D("d.friend.share-answer", "friendship", [
    "{kid} wants the homework, ten minutes before it is due, and is asking as a friend.",
], [
    C("give", "Hand it over", text="You handed it over. They copied it word for word, including a mistake.",
      effects=FX(stats={"charisma": 2, "discipline": -1})),
    C("explain", "Explain it instead", text="You walked them through it and were late to your own lesson.",
      effects=FX(stats={"smarts": 2, "charisma": 3, "happiness": 1})),
    C("refuse", "Say no", text="You said no. They found somebody else within a minute.",
      effects=FX(stats={"discipline": 2, "charisma": -2})),
], age_min=9, age_max=17, weight=13, cooldown=3)

D("d.friend.birthday-clash", "friendship", [
    "Two birthdays, same afternoon, and both of them have asked directly.",
], [
    C("close", "Go to the closer friend's", text="You picked the obvious one. The other noticed.",
      effects=FX(stats={"happiness": 2, "charisma": -1})),
    C("new", "Go to the newer friend's", text="You went to the other one, which surprised everybody including you.",
      effects=FX(stats={"charisma": 3, "happiness": 1})),
    C("neither", "Go to neither", text="You went to neither and stayed home, which solved nothing.",
      effects=FX(stats={"happiness": -3, "charisma": -2})),
], age_min=7, age_max=15, weight=12, cooldown=5)

D("d.friend.stand-up", "friendship", [
    "Somebody is being humiliated in front of thirty people and nobody has moved.",
], [
    C("step-in", "Step in", outcomes=[
        OUT(6, "You stepped in. It stopped, and it cost you nothing you can measure.",
            FX(stats={"willpower": 4, "charisma": 3, "happiness": 3})),
        OUT(4, "You stepped in, and it turned on you for the rest of term.",
            FX(stats={"willpower": 5, "happiness": -4, "charisma": -1})),
    ]),
    C("laugh", "Laugh along", text="You laughed with everyone else. It is one of the ones that stayed.",
      effects=FX(stats={"charisma": 1, "happiness": -3, "willpower": -2})),
    C("leave", "Walk away", text="You left the room. Not brave, not complicit, and not forgotten either.",
      effects=FX(stats={"happiness": -1, "willpower": 1})),
], age_min=9, age_max=17, weight=13)

D("d.random.money-found", "random", [
    "There is a twenty on the kitchen counter and nobody in the house has mentioned it for three days.",
], [
    C("take", "Take it", outcomes=[
        OUT(7, "You took it. Nothing was ever said, which was somehow not a relief.",
            FX(cash=20, stats={"happiness": -1, "discipline": -1})),
        OUT(3, "You took it, and {parent} had known exactly how much was there.",
            FX(cash=20, relationship={"parents": -5}, stats={"happiness": -3})),
    ]),
    C("ask", "Ask about it", text="You asked. It was yours anyway, and you got to keep it cleanly.",
      effects=FX(cash=20, stats={"willpower": 2}, relationship={"parents": 2})),
], age_min=8, age_max=16, requires=["anyParent"], weight=11,
   modifiers=[MOD(1.8, talents_any=["crime"]), MOD(1.6, wealth_any=["struggling"])])

D("d.random.late-night", "random", [
    "It is one in the morning and you are not remotely finished with what you are doing.",
], [
    C("push-on", "Keep going", text="You kept going until four and paid for it all week.",
      effects=FX(stats={"health": -2, "discipline": 2, "happiness": 2})),
    C("sleep", "Go to bed", text="You went to bed. It was still there in the morning.",
      effects=FX(stats={"health": 2, "discipline": 2})),
], age_min=11, age_max=17, weight=12, cooldown=3)

D("d.random.first-drink", "random", [
    "There is alcohol at a party and somebody has handed you a cup without asking.",
], [
    C("drink", "Drink it", outcomes=[
        OUT(6, "You drank it, disliked it, and pretended otherwise for the rest of the night.",
            FX(stats={"health": -1, "charisma": 2, "happiness": 1})),
        OUT(4, "You drank rather more than that, and the night ended badly and publicly.",
            FX(stats={"health": -3, "happiness": -3, "charisma": -2})),
    ]),
    C("pour", "Quietly put it down", text="You put it down somewhere and nobody noticed either way.",
      effects=FX(stats={"willpower": 3, "health": 1})),
], age_min=14, age_max=17, weight=13,
   modifiers=[MOD(1.5, talents_any=["crime"]), MOD(0.6, stat_at_least={"discipline": 72})])

D("d.random.online-argument", "random", [
    "Somebody has said something about you online and there is a reply box open.",
], [
    C("fire-back", "Fire back", outcomes=[
        OUT(5, "You destroyed them, publicly, and it followed you for a year.",
            FX(stats={"charisma": 2, "happiness": -3})),
        OUT(5, "You fired back badly and it was screenshotted before you could delete it.",
            FX(stats={"charisma": -3, "happiness": -4, "willpower": 1})),
    ]),
    C("ignore", "Close the app", text="You closed the app. It died within two days, as they do.",
      effects=FX(stats={"willpower": 4, "happiness": 1})),
], age_min=12, age_max=17, weight=12, flags_all=["has.phone"], cooldown=3)

D("d.random.charity", "random", [
    "There is a collection at school and you have exactly enough money for the thing you have been saving for.",
], [
    C("give", "Give it", text="You gave it. Nobody knew how much it was, which was the whole point.",
      effects=FX(cash=-40, stats={"happiness": 3, "willpower": 2})),
    C("keep", "Keep it", text="You kept it and bought the thing. It was excellent, briefly.",
      effects=FX(cash=-40, stats={"happiness": 3, "discipline": -1})),
], age_min=8, age_max=16, weight=11, cooldown=5)

D("d.talent.show-off", "talent", [
    "There is a chance to do your thing in front of people who have never seen it.",
], [
    C("perform", "Do it properly", outcomes=[
        OUT(6, "It landed. Several people looked at you differently afterwards.",
            FX(stats={"charisma": 4, "happiness": 4})),
        OUT(4, "It did not land, and the silence afterwards lasted a geological age.",
            FX(stats={"charisma": -1, "willpower": 3, "happiness": -3})),
    ]),
    C("decline", "Keep it to yourself", text="You kept it to yourself, which is also a choice you can make.",
      effects=FX(stats={"willpower": 1, "happiness": -1})),
], age_min=8, age_max=17, weight=12, cooldown=4,
   talents_any=["athletics", "acting", "music", "writing", "inventive"])

O("o.friend.older-mentor", "friendship", [
    "Somebody several years above has decided, for no clear reason, to take you seriously.",
], [
    C("accept", "Stick with them", outcomes=[
        OUT(7, "They taught you more in a year than school managed in three.",
            FX(stats={"smarts": 3, "charisma": 3, "discipline": 3, "happiness": 3})),
        OUT(3, "They were not the influence anybody had hoped for.",
            FX(stats={"charisma": 3, "discipline": -3, "happiness": 1})),
    ]),
    C("keep-distance", "Keep your distance", text="You kept your distance, politely, and it faded out.",
      effects=FX(stats={"willpower": 2})),
], age_min=10, age_max=17, weight=10)

O("o.school.exchange", "school", [
    "There is a place left on an exchange trip, and it is being offered to you because somebody dropped out.",
], [
    C("go", "Take the place", outcomes=[
        OUT(7, "Three weeks somewhere else rearranged your sense of how big things are.",
            FX(stats={"smarts": 4, "charisma": 4, "happiness": 4})),
        OUT(3, "You were homesick for the entire trip and learned something anyway.",
            FX(stats={"willpower": 4, "charisma": 2, "happiness": -2})),
    ]),
    C("decline", "Turn it down", text="You turned it down. The reasons were good and it still nags.",
      effects=FX(stats={"happiness": -2})),
], age_min=13, age_max=17, weight=10, rarity="uncommon",
   wealth_any=["modest", "comfortable", "affluent", "wealthy"])

D("d.family.report-card", "family", [
    "The report is in your bag, it is not good, and nobody has asked about it yet.",
], [
    C("hand-over", "Hand it over", outcomes=[
        OUT(6, "You handed it over. It was a bad hour and a much better month.",
            FX(relationship={"parents": 3}, stats={"discipline": 3, "happiness": -2})),
        OUT(4, "You handed it over and it went far worse than the report deserved.",
            FX(relationship={"parents": -4}, stats={"happiness": -4, "willpower": 2})),
    ]),
    C("hide", "Lose it", outcomes=[
        OUT(5, "It was never found. You spent four months waiting for it to be.",
            FX(stats={"happiness": -2, "discipline": -2})),
        OUT(5, "It was found in March, which made it a much larger problem than it had been.",
            FX(relationship={"parents": -7}, stats={"happiness": -4})),
    ]),
], age_min=9, age_max=17, requires=["anyParent"], weight=13, cooldown=3,
   modifiers=[MOD(1.8, stat_at_most={"discipline": 45})])

D("d.random.haircut-decision", "random", [
    "You have been sitting in the chair for two minutes and the question has been asked twice.",
], [
    C("bold", "Something drastic", outcomes=[
        OUT(5, "It was a triumph. Three people asked where you had it done.",
            FX(stats={"looks": 4, "charisma": 3, "happiness": 3})),
        OUT(5, "It was a catastrophe, and it grows about a centimetre a month.",
            FX(stats={"looks": -4, "happiness": -3, "willpower": 2})),
    ]),
    C("same", "The usual", text="You had the usual. It was fine. It is always fine.",
      effects=FX(stats={"happiness": 1})),
], age_min=9, age_max=17, weight=12, cooldown=3)


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


def check_text(problems: list[str], event: dict, text: str, where: str, choice=None) -> None:
    if not text.strip():
        problems.append(f"{event['id']}: empty text in {where}")
        return
    if text.strip()[-1] not in ".!?\"'":
        problems.append(f"{event['id']}: {where} does not end in punctuation: {text!r}")
    if len(text) > 220:
        problems.append(f"{event['id']}: {where} is {len(text)} chars — spec 725-770 says concise")
    have = guaranteed_requirements(event, choice)
    for token in TOKEN_RE.findall(text):
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


def check_effects(problems: list[str], event_id: str, effects: dict | None, where: str) -> None:
    if not effects:
        return
    for key in effects.get("stats", {}):
        if key not in STATS:
            problems.append(f"{event_id}: unknown stat {key!r} in {where} effects")
    for key in effects.get("relationship", {}):
        if key not in {"mother", "father", "parents", "siblings", "family"}:
            problems.append(f"{event_id}: unknown relationship target {key!r} in {where}")


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
        check_effects(problems, eid, event.get("effects"), "event")

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

        seen_choices = set()
        for choice in choices:
            if choice["id"] in seen_choices:
                problems.append(f"{eid}: duplicate choice id {choice['id']!r}")
            seen_choices.add(choice["id"])
            if not choice.get("text") and not choice.get("outcomes"):
                problems.append(f"{eid}/{choice['id']}: choice needs `text` or `outcomes`")
            if choice.get("text") and choice.get("outcomes"):
                problems.append(f"{eid}/{choice['id']}: choice has both `text` and `outcomes`")
            if len(choice["label"]) > 26:
                problems.append(
                    f"{eid}/{choice['id']}: label {choice['label']!r} is too long for a phone"
                )
            if choice.get("text"):
                check_text(problems, event, choice["text"], f"choice {choice['id']}", choice)
            check_effects(problems, eid, choice.get("effects"), f"choice {choice['id']}")
            if choice.get("requires"):
                check_condition(problems, eid, choice["requires"], f"choice {choice['id']}")
            for index, outcome in enumerate(choice.get("outcomes", [])):
                if outcome["weight"] <= 0:
                    problems.append(f"{eid}/{choice['id']}: outcome {index} has no weight")
                check_text(problems, event, outcome["text"], f"choice {choice['id']} outcome {index}", choice)
                check_effects(problems, eid, outcome.get("effects"), f"choice {choice['id']} outcome")

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
                for key in (
                    "requires",
                    "talentsAny",
                    "wealthAny",
                    "statAtLeast",
                    "statAtMost",
                    "flagsAll",
                    "relationshipAtLeast",
                    "relationshipAtMost",
                    "sex",
                )
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
            if not any(
                key in event["eligibility"]
                for key in ("requires", "talentsAny", "wealthAny", "statAtLeast",
                            "statAtMost", "flagsAll", "relationshipAtLeast",
                            "relationshipAtMost", "sex")
            )
        ]
        print(f"    age {age:>2}: {len(window):>3} / {len(plain):>3}")


def main() -> None:
    check()
    report()
    payload = {"version": CATALOG_VERSION, "entries": EVENTS}
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
