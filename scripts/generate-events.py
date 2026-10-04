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
  {siblingThey} {siblingThem} {siblingTheir}
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
CATEGORIES = {"family", "school", "friendship", "random", "talent", "career", "health", "loss"}
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
# For {parent}, which renders "Mom" or "Dad": a bare "they" is as wrong as a
# bare "she", because the household has one of them and it is not plural.
ANY_PRONOUN_RE = re.compile(r"\b(he|him|his|she|her|hers|they|them|their)\b", re.IGNORECASE)


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
    # The pronoun of whichever parent {parent} resolved to. Same guard as
    # {parent} itself: the copy cannot say "she" about somebody the eligibility
    # did not guarantee exists. Reading the built app found "You told Mom the
    # truth and they did not know what to do with it" — a hardcoded pronoun
    # beside a token that renders "Mom".
    "parentThey": {"mother", "father", "anyParent", "bothParents", "singleParent"},
    "parentThem": {"mother", "father", "anyParent", "bothParents", "singleParent"},
    "parentTheir": {"mother", "father", "anyParent", "bothParents", "singleParent"},
    "parents": {"bothParents"},
    "sibling": {"sibling", "siblings2", "olderSibling"},
    "siblingRel": {"sibling", "siblings2", "olderSibling"},
    # The sibling's own pronouns. Ticket 0211b: {siblingRel} renders the
    # RELATION ("sister"), and shipped copy used it where a possessive pronoun
    # belonged — "out of sister's own allowance" — while another line reached for
    # {them}, the PLAYER's pronoun, and called a girl "him". Same guard as
    # {sibling}: the copy cannot say "she" about somebody eligibility did not
    # guarantee.
    "siblingThey": {"sibling", "siblings2", "olderSibling"},
    "siblingThem": {"sibling", "siblings2", "olderSibling"},
    "siblingTheir": {"sibling", "siblings2", "olderSibling"},
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
    bond: int | None = None,
) -> dict:
    """
    An event's consequences. `cash` must come from CASH().

    `stress` is Ticket 0205's content hook. Positive for a year that kept
    happening at the character; NEGATIVE for the things that genuinely help — a
    long summer, a grandparent's house, a week with the power out. Both
    directions are required, or stress is a ratchet and every character ends
    childhood pinned at the top of it.

    Ticket 0415, and the same rule for `willpower`: it is earned by carrying
    something and it is spent by carrying too much. It does not go on an event
    about warmth (a friend saying yes is a good year, not a stronger person), and
    it does not go on BOTH outcomes of a hard choice — if the branch where it
    went wrong pays the same as the branch where it went right, the number is a
    fee for being asked (CORE_RULES 13.79). The adult catalog had seventy-one
    willpower gains and no losses and the stat collapsed to sd 2.8 by sixty.
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
            # Ticket 0413 — what this did to the PERSON it named, as opposed to
            # what it did to the character's mood.
            #
            # `bondFromOutcome` has read `effects.bond` since 0206 and has always
            # fallen back to happiness x 0.7 because nothing could author it: the
            # engine had the field and the generator had no way to write it, so
            # every event in the catalog took the derived value. That was fine
            # while events about people were a childhood thing, and it stopped
            # being fine the moment this ticket added thirty-odd adult events
            # that name a friend — a year with several warm friendship events in
            # it was quietly handing that friendship twelve or fifteen points.
            #
            # Measured: closest-friend spread (p90 - p10) at fifty-five fell from
            # 11 to 7 and the share of adults with nobody fell under 1%, which
            # makes `hasFriend: false` content unreachable. 0412 curved the
            # proximity gain for exactly this failure and the catalog was the
            # other door into it.
            #
            # So an event that is ABOUT a friendship rather than an interaction
            # with one authors `bond=0`: the year still moves happiness, and the
            # number that says how close two people are stays where the two of
            # them left it.
            "bond": bond,
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
    partnered: bool | None = None,
    has_children: bool | None = None,
    # Ticket 0409. Work, the body, and loss.
    employed: bool | None = None,
    job_track_any: list[str] | None = None,
    job_years_at_least: int | None = None,
    job_years_at_most: int | None = None,
    has_condition: bool | None = None,
    condition_any: list[str] | None = None,
    bereaved_within: int | None = None,
    # Ticket 0412. Friends — the predicate the language never had, and the
    # reason the whole adult `friendship` library was about romance: it could
    # say "is seeing somebody" and could not say "has a friend".
    has_friend: bool | None = None,
    friends_at_least: int | None = None,
    friends_at_most: int | None = None,
    friendship_years_at_least: int | None = None,
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
            "employed": employed,
            "jobTrackAny": job_track_any,
            "jobYearsAtLeast": job_years_at_least,
            "jobYearsAtMost": job_years_at_most,
            "hasCondition": has_condition,
            "conditionAny": condition_any,
            "bereavedWithin": bereaved_within,
            "friendsAtLeast": friends_at_least,
            "friendsAtMost": friends_at_most,
            "friendshipYearsAtLeast": friendship_years_at_least,
            # Ticket 0207. `prune` drops None but keeps False, which is what
            # this field needs: "must NOT be seeing anybody" is a real
            # constraint and is not the same as no constraint at all.
            "partnered": partnered,
            # Ticket 0208. Like `partnered`, False is a real constraint.
            "hasChildren": has_children,
            # Ticket 0412. Same again: "must NOT have a friend" is the whole
            # point of half the copy this gate exists for, and `prune` keeps
            # False while dropping None.
            "hasFriend": has_friend,
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
    "Slept through the night for the first time. The whole house acted like it was a national holiday.",
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
    "{sibling} wasn't consulted about your arrival and made that position clear.",
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
    "Formed an unbreakable attachment to one specific object and wouldn't be reasoned with.",
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
    "There was shouting downstairs that everyone pretended in the morning hadn't happened.",
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
    "The family pet died. It was explained gently and it didn't help much.",
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
    "An actual vacation. Sunburn, a rental car, and photos that get better every year you look at them.",
], age_min=4, age_max=17, requires=["anyParent"], weight=10, cooldown=4,
   wealth_any=["comfortable", "affluent", "wealthy"],
   effects=FX(stats={"happiness": 4}, relationship={"family": 2}))

E("family.mc.camping", "family", [
    "A camping trip that went wrong in four separate ways and is now the family's favorite story.",
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
    "{parent} taught you to drive in an empty parking lot and aged five years doing it.",
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
    "With this many siblings, dinner was a negotiation and the bathroom was a line.",
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
    "Won the spelling bee. The trophy was small and the feeling wasn't.",
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
    "Got the lead in the school play and didn't fumble a single line.",
], age_min=8, age_max=17, weight=8, rarity="uncommon",
   effects=FX(stats={"charisma": 4, "happiness": 3}),
   modifiers=[MOD(2.5, talents_any=["acting"]), MOD(1.4, stat_at_least={"looks": 65})])

E("school.forgot-homework", "school", [
    "Discovered that homework doesn't do itself, several times, at cost.",
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
    "A field trip where somebody threw up on the bus and it wasn't you.",
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
    "Picked last for teams, consistently, for years, by people who weren't wrong.",
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
    "Hit the wall in math and spent a year quietly convinced everyone else had been told something.",
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
    "Got a yearbook quote in that hasn't aged well.",
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
    "Developed a crush that was total, silent, and known to your entire grade.",
], age_min=10, age_max=16, weight=13, cooldown=3,
   effects=FX(stats={"happiness": 2, "charisma": 1}))

E("friend.crush-returned", "friendship", [
    "The crush turned out to be mutual, and that was scarier than being turned down.",
], age_min=12, age_max=17, weight=9, rarity="uncommon", stat_at_least={"looks": 55},
   effects=FX(stats={"happiness": 5, "charisma": 2}))

E("friend.rejected", "friendship", [
    "Asked. Was turned down kindly, which didn't help at all.",
], age_min=12, age_max=17, weight=11, cooldown=3,
   effects=FX(stats={"happiness": -3, "willpower": 2, "charisma": 1}))

E("friend.first-date", "friendship", [
    "A first date at a movie theater. Neither of you can name the film.",
], age_min=14, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": 4, "charisma": 2}))

# -----------------------------------------------------------------------------
# PARENTING (Ticket 0208)
#
# The ordinary business of having children, which spec 1986 otherwise abstracts.
# These are the "meaningful event" half of that rule: not the school run, the
# night the fever spiked.
#
# All gated at 18+ like everything else adult, and written to the 0207d clarity
# rules — plain words, contractions, and nothing that needs decoding.
# -----------------------------------------------------------------------------

E("parent.first-night", "family", [
    "First night home with the baby. Nobody slept and nobody minded.",
    "The first week was a blur. You have almost no memory of it and you were never happier.",
], age_min=19, weight=11, cooldown=4,
   effects=FX(stats={"happiness": 6, "health": -3}), has_children=True)

E("parent.fever", "family", [
    "Your kid spiked a fever at 2am and you sat up the whole night watching them breathe.",
], age_min=19, weight=11, cooldown=3,
   effects=FX(stats={"health": -3, "happiness": -2, "willpower": 1}), has_children=True)

E("parent.school-run", "family", [
    "You did the school run every morning for a year and got very good at the radio.",
], age_min=23, weight=10, cooldown=4,
   effects=FX(stats={"discipline": 2, "happiness": 2}), has_children=True)

E("parent.recital", "family", [
    "Sat through a school concert that was mostly terrible and cried anyway.",
    "Watched your kid play a tree in the school play. Best tree there.",
], age_min=24, weight=11, cooldown=3,
   effects=FX(stats={"happiness": 5}), has_children=True)

E("parent.sick-day", "family", [
    "Took a day off you couldn't spare because there was nobody else to take it.",
], age_min=22, weight=10, cooldown=3,
   effects=FX(stats={"happiness": -1, "willpower": 1}), has_children=True)

E("parent.first-day", "family", [
    "Dropped your kid at school and cried in the car, which you had promised yourself you wouldn't do.",
], age_min=24, weight=10, cooldown=5,
   effects=FX(stats={"happiness": 3}), has_children=True)

E("parent.teenager", "family", [
    "Your teenager stopped talking to you for most of a year. Nobody could say why.",
    "Had the same argument with your teenager about the same thing eleven times.",
], age_min=32, weight=11, cooldown=3,
   effects=FX(stats={"happiness": -4, "willpower": -1}), has_children=True)

E("parent.proud", "family", [
    "Your kid did something genuinely kind when nobody was watching, and somebody told you.",
], age_min=26, weight=10, cooldown=4,
   effects=FX(stats={"happiness": 7}), has_children=True)

E("parent.money", "family", [
    "The kids needed shoes, again, and something else had to wait.",
], age_min=23, weight=10, cooldown=3,
   effects=FX(stats={"happiness": -3}), has_children=True)

E("parent.driving", "family", [
    "Taught your kid to drive. You have never gripped anything so hard in your life.",
], age_min=36, weight=10, cooldown=6,
   effects=FX(stats={"happiness": 3, "health": -1}), has_children=True)

E("parent.quiet-house", "family", [
    "The house got quiet. You had been looking forward to it and it wasn't what you expected.",
], age_min=40, weight=10, cooldown=5,
   effects=FX(stats={"happiness": -2}), has_children=True)

# -----------------------------------------------------------------------------
# ROMANCE (Ticket 0207)
#
# The texture around the Love menu, the way the friendship events are the
# texture around the friendship menu. What the player DOES is on the person's
# page; these are the things that happen to them.
#
# Two rules on top of the usual ones, and neither is negotiable:
#
#   1. Nothing romantic fires below thirteen. `age_min` is the enforcement and
#      the self-check below asserts it, because an event catalog is exactly the
#      place a rule like this gets broken by somebody adding one entry.
#   2. Under eighteen, the register is the one the existing line already sets —
#      "A first date at a movie theater. Neither of you can name the film." Corridors,
#      buses, and not knowing what to say. Nothing else.
# -----------------------------------------------------------------------------

E("love.note", "friendship", [
    "Somebody put a note in your bag. It wasn't signed and you have a theory.",
    "A note went round the class about you and {kid}, and it wasn't unkind, which was worse.",
], age_min=13, age_max=16, weight=11, cooldown=3,
   effects=FX(stats={"happiness": 3, "charisma": 1}), partnered=False)

E("love.corridor", "friendship", [
    "You and {kid} have started taking the long way to the same lesson.",
], age_min=13, age_max=17, weight=11, cooldown=2,
   effects=FX(stats={"happiness": 3, "charisma": 1}), partnered=False)

E("love.overheard", "friendship", [
    "Somebody told {kid} you liked them. It was true, and you haven't decided whether to be grateful.",
], age_min=13, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": 2, "willpower": 1}), partnered=False)

E("love.first-kiss", "friendship", [
    "First kiss. Neither of you had a plan and it showed.",
    "Kissed {kid} at a party, badly, and thought about nothing else for a two weeks.",
], age_min=14, age_max=17, weight=10, cooldown=6, rarity="uncommon",
   effects=FX(stats={"happiness": 6, "charisma": 3}))

E("love.dumped-by-text", "friendship", [
    "It ended over a message that took four minutes to send and nine words to say.",
], age_min=14, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": -6, "willpower": 3}), partnered=True)

E("love.friends-again", "friendship", [
    "You and {kid} went back to being friends, and it very nearly worked.",
], age_min=14, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": -1, "charisma": 2}), partnered=True)

E("love.parents-met", "friendship", [
    "Had dinner at {kid}'s. Their parents asked what you wanted to do with your life.",
], age_min=15, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"charisma": 2, "happiness": 2}), partnered=True)

E("love.long-distance", "friendship", [
    "{kid} moved away. You both said you would keep it going.",
], age_min=15, age_max=17, weight=9, rarity="uncommon", cooldown=5,
   effects=FX(stats={"happiness": -4, "willpower": 2}), partnered=True)

E("love.mixtape", "friendship", [
    "Spent a whole evening making {kid} a playlist and then didn't send it.",
], age_min=13, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": 1, "willpower": 1}), partnered=False)

E("love.dance", "friendship", [
    "The school dance. You stood near {kid} for two hours and said eleven words.",
    "Danced with {kid} once, to the slow one, and left immediately afterwards.",
], age_min=14, age_max=17, weight=11, cooldown=2,
   effects=FX(stats={"happiness": 3, "charisma": 2}))

E("love.someone-else", "friendship", [
    "{kid} started going out with somebody else. You found out from a group chat.",
], age_min=13, age_max=17, weight=10, cooldown=3,
   effects=FX(stats={"happiness": -5, "willpower": 2}), partnered=False)

E("love.summer", "friendship", [
    "A whole summer with {kid} that neither of you called anything.",
], age_min=15, age_max=17, weight=10, cooldown=4,
   effects=FX(stats={"happiness": 5, "charisma": 2}), partnered=True)

# ---- adult ------------------------------------------------------------------
#
# The adult library proper arrives with its own tickets. These are here because
# the year loop does not stop at eighteen and a thirty-year-old's feed should
# not be silent about the largest thing in most people's lives.

E("love.set-up", "friendship", [
    "A friend set you up with somebody. It went fine. Nobody followed up.",
    "A friend set you up. You both laughed about it after and left it there.",
    "Got set up with a friend of a friend. You had one good hour and no second date.",
], age_min=19, weight=10, cooldown=3,
   effects=FX(stats={"charisma": 2, "happiness": 2}), partnered=False)

E("love.app", "friendship", [
    "Spent a month on the apps. Met three people and liked one of them.",
    "Matched with somebody funny and it fizzled out over two weeks of texting.",
    "Downloaded the app again. Met someone for coffee. Neither of you texted after.",
    "Went on four first dates and there was no second one.",
], age_min=19, weight=11, cooldown=2,
   effects=FX(stats={"happiness": 1, "charisma": 1}), partnered=False)

E("love.moved-in", "friendship", [
    "Moved in together. It took two days and a van and one argument about a chair.",
], age_min=20, weight=9, rarity="uncommon", cooldown=8,
   effects=FX(stats={"happiness": 5}), partnered=True)

E("love.wedding-guest", "friendship", [
    "Went to a wedding alone and had way more fun than you expected.",
    "Went to a wedding solo, got seated with strangers, and stayed till the end.",
], age_min=22, weight=10, cooldown=3,
   effects=FX(stats={"happiness": 3, "charisma": 2}), partnered=False)

E("love.the-one-that-got-away", "friendship", [
    "Ran into an ex at the store. You were both polite and you thought about it all week.",
    "Bumped into somebody you used to date. Five awkward minutes, then a week of thinking.",
], age_min=24, weight=10, cooldown=5,
   effects=FX(stats={"happiness": -2}))

E("love.quiet-year", "friendship", [
    "Nobody this year. You got pretty good at being on your own.",
    "No dates, no drama. You cooked a lot and slept fine.",
], age_min=21, weight=10, cooldown=3,
   effects=FX(stats={"willpower": 1, "happiness": 1}), partnered=False)

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
    "Discovered an arcade with {kid} and fed $25 of pocket money into one machine over a two weeks.",
], age_min=8, age_max=16, weight=10, cooldown=3,
   effects=FX(stats={"happiness": 2}, cash=CASH(-25, "a two weeks at the arcade")))

E("friend.borrowed-never-returned", "friendship", [
    "Lent {kid} something you loved. It hasn't come back and it isn't going to.",
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
    "Grew four inches in one year and spent all of it apologizing to furniture.",
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
    "Decided on becoming an astronaut and researched it more thoroughly than any homework.",
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
    "Found $20 on the sidewalk outside the laundromat and told nobody, ever.",
], age_min=5, age_max=17, weight=9, cooldown=4,
   effects=FX(cash=CASH(20, "$20 found on the sidewalk"), stats={"happiness": 2}))

E("random.snow-day", "random", [
    "A snow day. The greatest single institution in human history.",
], age_min=5, age_max=16, weight=11, cooldown=3,
   effects=FX(stats={"happiness": 3}))

E("random.embarrassment", "random", [
    "Called a teacher 'mom' in front of everybody and has never fully recovered.",
    "Tripped on a completely flat surface in front of your entire grade.",
    "Waved at somebody who was waving at the person behind you.",
], age_min=6, age_max=17, weight=12, cooldown=2,
   effects=FX(stats={"happiness": -2, "charisma": 1}))

E("random.magic-phase", "random", [
    "Learned three card tricks and performed them at anyone who slowed down.",
], age_min=7, age_max=13, weight=10,
   effects=FX(stats={"charisma": 2, "smarts": 1}))

E("random.bad-haircut-self", "random", [
    "Attempted bangs with kitchen scissors. The regrowth took eleven months.",
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
    "The phone was confiscated for a two weeks. Life became medieval.",
], age_min=11, age_max=17, weight=10, cooldown=2, flags_all=["has.phone"],
   requires=["anyParent"],
   effects=FX(stats={"happiness": -3, "discipline": 1}, relationship={"parents": -2}))

E("random.sunburn", "random", [
    "Got a sunburn shaped exactly like a t-shirt and wore it for a week.",
], age_min=4, age_max=17, weight=9, cooldown=4,
   effects=FX(stats={"health": -1, "looks": -1}))

E("random.library-card", "random", [
    "Got a library card and treated it as a license to print money.",
], age_min=6, age_max=14, weight=10,
   effects=FX(stats={"smarts": 3, "happiness": 1}),
   modifiers=[MOD(1.9, talents_any=["academics", "writing"])])

E("random.first-funeral-suit", "random", [
    "Wore a proper suit for the first time, for a sad reason, and it didn't fit.",
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
    "Saw a meteor shower from a roof at two in the morning and didn't tell anyone about being up there.",
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
    "Made a team two age groups up and wasn't the worst player on it.",
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
    "Got a part in a real production at a real theater with real strangers watching.",
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
    "Formed a band in a garage with {kid} and {kid2}. It was loud and it wasn't good yet.",
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
    "Played a recital from memory without a single mistake, and couldn't sleep afterwards.",
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
    "Learned chess properly and beat an adult who hadn't been trying, and then one who was.",
], age_min=7, age_max=17, weight=11, talents_any=["academics"], cooldown=4,
   effects=FX(stats={"smarts": 3, "discipline": 1}))

# ---- inventive ---------------------------------------------------------------

E("talent.inv.dismantled", "talent", [
    "Took apart a household appliance to see inside. It didn't go back together.",
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
    "Took something small from a shop and wasn't caught, which was the worst possible outcome.",
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
    "Was the lookout. Was good at it. Didn't enjoy discovering that.",
], age_min=11, age_max=17, weight=10, talents_any=["crime"], cooldown=4,
   effects=FX(stats={"willpower": 2, "happiness": -1}))

E("talent.cri.older-crew", "talent", [
    "An older crowd started including you in things they didn't explain in advance.",
], age_min=13, age_max=17, weight=9, talents_any=["crime"], rarity="uncommon",
   effects=FX(stats={"charisma": 2, "discipline": -2}, set_flags=["cri.crew"]))

E("talent.cri.walked-away", "talent", [
    "Was there when it went wrong, and was the one who walked away before it did.",
], age_min=13, age_max=17, weight=8, talents_any=["crime"], flags_all=["cri.crew"],
   effects=FX(stats={"willpower": 4, "smarts": 2}))

# ---- talentless characters get their own thread ------------------------------

E("talent.none.searching", "talent", [
    "Tried four different clubs looking for the thing, and didn't find it this year.",
], age_min=8, age_max=16, weight=11, cooldown=3,
   talents_none=["athletics", "acting", "music", "writing", "academics", "inventive", "crime"],
   effects=FX(stats={"charisma": 1, "willpower": 2}))

E("talent.none.grafted", "talent", [
    "Wasn't the best at anything and got better at everything by simply not stopping.",
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
    "{kid} is standing alone at the water fountain and there are a few minutes before class. You've liked {kidThem} since September.",
    "{kid} is sitting alone by the bike racks. You've wanted to talk to {kidThem} for months and nobody else is around.",
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
        OUT(6, "{kid} talked all six minutes about {kidTheir} sister's dog. You were late to class and didn't care.",
            FX(stats={"happiness": 5, "charisma": 2})),
        OUT(4, "{kid} said 'fine.' That was the entire conversation.",
            FX(stats={"happiness": -3})),
    ]),
    C("joke", "Make a dumb joke", outcomes=[
        OUT(4, "{kid} laughed so hard {kidThey} snorted water out of {kidTheir} nose and then couldn't look at you.",
            FX(stats={"happiness": 7, "charisma": 4})),
        OUT(6, "{kid} cringed. You replayed it in your head every night for a week.",
            FX(stats={"happiness": -6, "willpower": 2})),
    ]),
    C("nothing", "Walk past", text="You walked past {kid} right as the bell rang. Nothing happened. That was the point.",
      effects=FX(stats={"happiness": -2, "willpower": -1})),
], age_min=11, age_max=17, weight=14, cooldown=3, person_tokens=["kid"],
   modifiers=[MOD(1.5, stat_at_least={"looks": 65}), MOD(1.4, stat_at_least={"charisma": 68})])

# REPLACES d.school.club, which allowed exactly one pick, forever. Now it points
# at the real menu — see Ticket 0204's Clubs & Teams screen.
D("d.school.signup-table", "school", [
    "There's a sign-up table in the gym at lunch. You could join a school club or team.",
    "Sign-up sheets for clubs and teams are posted outside the office. You could put your name down.",
], [
    C("see", "See what they offer", opens="activities",
      text="You took a real look at what the school actually offered.",
      effects=FX(stats={"happiness": 2})),
    C("ask-around", "Ask {kid} what {kidThey} does", outcomes=[
        OUT(6, "{kid} talked you into the same thing {kidThey} does, and it turned out to be your year.",
            FX(stats={"happiness": 4, "charisma": 3})),
        OUT(4, "{kid} said all of it was for losers, which you believed at the time.",
            FX(stats={"happiness": -2, "charisma": 1})),
    ]),
    C("pass", "Say no thanks",
      text="You walked past the sign-up table. The gym smelled like floor polish.",
      effects=FX(stats={"happiness": -2})),
], age_min=8, age_max=17, weight=16, cooldown=2, person_tokens=["kid"],
   school_stage_any=["elementary", "middle", "high"])


# ---- family -----------------------------------------------------------------

D("d.family.broken-bowl", "family", [
    "{sibling} just broke {mother}'s favorite bowl and is begging you not to say anything. {mother} is in the next room and will ask who did it.",
], [
    C("own", "Say you did it", outcomes=[
        OUT(6, "You took the blame. {mother} grounded you for a week, and {sibling} left a candy bar on your pillow.",
            FX(stats={"happiness": -2, "willpower": 3}, relationship={"siblings": 9, "mother": -3})),
        OUT(4, "You took the blame. {mother} didn't buy it for a second and grounded {sibling} anyway.",
            FX(stats={"happiness": -3, "charisma": -1}, relationship={"siblings": 4})),
    ]),
    C("tell", "Tell {mother} what happened",
      text="You told {mother} the truth. {sibling} got grounded and didn't speak to you for three days.",
      effects=FX(stats={"happiness": -3, "discipline": 2}, relationship={"siblings": -9, "mother": 4})),
    C("glue", "Glue it before anyone notices", outcomes=[
        OUT(5, "You and {sibling} glued the bowl badly. {mother} found out and was madder about the glue than the bowl.",
            FX(stats={"happiness": -5}, relationship={"mother": -6, "siblings": 3})),
        OUT(5, "You and {sibling} glued the bowl and {mother} never noticed. It's still on the shelf.",
            FX(stats={"happiness": 6, "smarts": 1}, relationship={"siblings": 8})),
    ]),
    C("cat", "Blame the cat",
      text="{mother} pointed out the cat had been at the vet since Tuesday.",
      effects=FX(stats={"happiness": -5, "charisma": -2}, relationship={"mother": -5})),
], age_min=6, age_max=16, weight=13, requires=["sibling", "mother"], person_tokens=[])

D("d.family.birthday-money", "family", [
    "It's your birthday. {sibling} gave you $25 saved up from {siblingTheir} own allowance. What do you do with it?",
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
      text="Gave {sibling} back half the birthday money, $12. {SiblingThey} tried to refuse and you made {siblingThem} take it.",
      effects=FX(cash=CASH(-12, "half the birthday money, given back to {sibling}"),
                 stats={"happiness": 5}, relationship={"siblings": 10})),
], age_min=7, age_max=16, weight=12, cooldown=6, requires=["sibling"],
   effects=FX(cash=CASH(25, "birthday money from {sibling}")))

D("d.family.yard", "family", [
    "{father} has been working double shifts and the yard is a mess. He hasn't asked you to help, but he clearly needs it.",
], [
    C("mow", "Mow it before anybody gets home", outcomes=[
        OUT(5, "You mowed the whole yard in July heat and threw up behind the shed. {father} hugged you anyway.",
            FX(stats={"health": -4, "happiness": 5, "willpower": 3}, relationship={"father": 9})),
        OUT(5, "{father} got home to a mowed yard and sat on the back step looking at it for a long time.",
            FX(stats={"health": -1, "happiness": 5}, relationship={"father": 8})),
    ]),
    C("ask", "Ask him what he needs", outcomes=[
        OUT(6, "You asked what {father} needed. The answer was 'company', so you sat out there till dark.",
            FX(stats={"happiness": 6}, relationship={"father": 9})),
        OUT(4, "You asked what {father} needed and got snapped at. The apology came an hour later.",
            FX(stats={"happiness": -3}, relationship={"father": 1})),
    ]),
    C("leave", "Leave the yard alone",
      text="The yard stayed long all summer. Nobody said a word about it, which was worse than being yelled at.",
      effects=FX(stats={"happiness": -3}, relationship={"father": -3})),
], age_min=9, age_max=17, weight=12, cooldown=5, requires=["father"], physical=True)

D("d.family.chore-money", "family", [
    "{parent} will pay you $30 to clean out the garage this weekend. It's a big, dirty job.",
], [
    C("take", "Take the job",
      text="You cleared the garage over two days, found a dead mouse, and got your $30.",
      effects=FX(cash=CASH(30, "clearing out the garage"),
                 stats={"discipline": 4, "health": -1, "happiness": 1}, relationship={"parents": 4})),
    C("negotiate", "Ask for more money", outcomes=[
        OUT(5, "You talked {parent} up to $50, and it earned you a little quiet respect.",
            FX(cash=CASH(50, "clearing the garage, after negotiating"),
               stats={"charisma": 4, "happiness": 3}, relationship={"parents": 3})),
        OUT(5, "You pushed, the offer got pulled, and {sibling} did it instead for the original $30.",
            FX(stats={"charisma": 1, "happiness": -4}, relationship={"parents": -3}),
            ),
    ], requires=COND(requires=["sibling"])),
    C("free", "Do it for free",
      text="You did the garage and wouldn't take the money. {parent} brought it up for years.",
      effects=FX(stats={"happiness": 3, "willpower": 3}, relationship={"parents": 8})),
    C("refuse", "Say no",
      text="You had better things to do that weekend, and you did them.",
      effects=FX(stats={"happiness": 3}, relationship={"parents": -4})),
], age_min=9, age_max=17, requires=["anyParent"], weight=13, cooldown=4, physical=True)

D("d.family.sibling-secret", "family", [
    "{sibling} did something bad and asked you to keep it secret. Your parents are going to find out eventually.",
], [
    C("keep", "Keep quiet", outcomes=[
        OUT(6, "You kept it. It never came out, and {sibling} hasn't forgotten that you did.",
            FX(stats={"happiness": 2, "willpower": 3}, relationship={"siblings": 10})),
        OUT(4, "You kept it, it came out anyway, and you were standing next to {sibling} when it did.",
            FX(stats={"happiness": -5}, relationship={"siblings": 4, "parents": -5})),
    ]),
    C("tell", "Tell {parent}",
      text="You told {parent}. It was probably the right call, and it didn't feel like one for a month.",
      effects=FX(stats={"happiness": -4, "discipline": 3}, relationship={"siblings": -10, "parents": 4})),
    C("make-fix", "Make {sibling} fix it", outcomes=[
        OUT(5, "You talked {sibling} into owning up before anyone found out. It went way better than it should've.",
            FX(stats={"happiness": 4, "charisma": 5}, relationship={"siblings": 6})),
        OUT(5, "{sibling} swore it was handled, and it wasn't, and both of you got dragged in.",
            FX(stats={"happiness": -4}, relationship={"siblings": -4, "parents": -3})),
    ]),
], age_min=8, age_max=17, requires=["sibling", "anyParent"], weight=13)

D("d.family.report-card", "family", [
    "{parent} is asking to see your report card, but your grades aren't good this time. What do you do?",
], [
    C("hand-over", "Hand it over", outcomes=[
        OUT(6, "You handed it over. It was a bad hour and a much better month.",
            FX(stats={"happiness": -2, "discipline": 4}, relationship={"parents": 4}, behaviour=4)),
        OUT(4, "You handed it over and it blew up worse than the report deserved. Nobody talked at dinner for a week.",
            FX(stats={"happiness": -6, "willpower": 3}, relationship={"parents": -6})),
    ]),
    C("hide", "Lose the report card", outcomes=[
        OUT(5, "It never turned up. You spent four months expecting it to.",
            FX(stats={"happiness": -3, "discipline": -3})),
        OUT(5, "It came out in March, and by then it was a much bigger deal than it was in October.",
            FX(stats={"happiness": -6}, relationship={"parents": -9}, behaviour=-6)),
    ]),
    C("preempt", "Tell {parent} before {parentThey} asks",
      text="You handed it over with a plan already written down. {parent} was too surprised to shout.",
      effects=FX(stats={"happiness": 2, "discipline": 5, "charisma": 3}, relationship={"parents": 5})),
], age_min=9, age_max=17, requires=["anyParent"], weight=13, cooldown=3,
   modifiers=[MOD(1.8, stat_at_most={"discipline": 45})])

D("d.family.parent-asks", "family", [
    "{parent} sat down on your bed and asked if you're doing okay. You haven't been.",
], [
    C("honest", "Tell them the truth", outcomes=[
        OUT(7, "You told {parent} the truth. {ParentThey} listened better than you'd expected {parentThem} to.",
            FX(stats={"happiness": 7, "health": 1}, relationship={"parents": 9})),
        OUT(3, "You told {parent} the truth and {parentThey} didn't know what to do with it. {ParentThey} tried anyway.",
            FX(stats={"happiness": 2}, relationship={"parents": 3})),
    ]),
    C("deflect", "Say you're fine",
      text="You said you were fine. {parent} knew, and let it go, and turned the light off.",
      effects=FX(stats={"happiness": -3, "willpower": 1}, relationship={"parents": -2})),
    C("turn-it", "Ask them the same thing", outcomes=[
        OUT(6, "You asked {parent} the same question back. {ParentThey} sat there a long time before answering.",
            FX(stats={"happiness": 4, "charisma": 3}, relationship={"parents": 7})),
        OUT(4, "You asked {parent} the same question back and {parentThey} laughed it off and left.",
            FX(stats={"happiness": -2, "charisma": 1})),
    ]),
], age_min=11, age_max=17, requires=["anyParent"], weight=12, cooldown=4,
   modifiers=[MOD(2.0, stat_at_most={"happiness": 40})])

D("d.family.holiday-choice", "family", [
    "The family is picking where to go on vacation, and for once they're asking what you want.",
], [
    C("push", "Push for what you want", outcomes=[
        OUT(5, "You got your way and it was a great week. Everybody said so, more than once.",
            FX(stats={"happiness": 6, "charisma": 3, "health": 1}, relationship={"family": 3})),
        OUT(5, "You got your way and it rained for six days, which was mentioned at every meal.",
            FX(stats={"happiness": -4, "charisma": 1}, relationship={"family": -4})),
    ]),
    C("defer", "Let {sibling} pick",
      text="You let {sibling} pick, and you cashed that favor in about six months later.",
      effects=FX(stats={"happiness": 1, "willpower": 2}, relationship={"siblings": 8})),
    C("stay", "Argue for staying home",
      text="You argued for staying home. You got eleven days on your own street and zero photos.",
      effects=FX(stats={"happiness": 3, "charisma": -1}, relationship={"family": -2})),
], age_min=8, age_max=16, requires=["anyParent", "sibling"], weight=11, cooldown=5)

D("d.family.parent-favour", "family", [
    "{parent} needs your help all day Saturday, but you already made plans with {kid}.",
], [
    C("help", "Cancel and help",
      text="You canceled on {kid} and helped. It took nine hours and was never mentioned again.",
      effects=FX(stats={"happiness": -2, "discipline": 3, "health": -1}, relationship={"parents": 9})),
    C("plans", "Stick to your plans",
      text="You went out with {kid}. A good day, except for the one thing neither of you mentioned.",
      effects=FX(stats={"happiness": 3}, relationship={"parents": -5})),
    C("both", "Try to do both", outcomes=[
        OUT(4, "You did half of each and somehow got away with it.",
            FX(stats={"happiness": 3, "charisma": 3, "health": -2})),
        OUT(6, "You did half of each badly, and both {parent} and {kid} noticed.",
            FX(stats={"happiness": -4, "health": -2}, relationship={"parents": -3})),
    ]),
], age_min=10, age_max=17, requires=["anyParent"], weight=12, cooldown=4, person_tokens=["kid"])

D("d.family.grandparent", "family", [
    "Your grandparent is in the hospital for a week. Visiting means missing something you'd been looking forward to.",
], [
    C("visit", "Go sit with them",
      text="You went. Ten awkward minutes, then they told you a story nobody else in the family knew.",
      effects=FX(stats={"happiness": 3, "willpower": 2}, relationship={"family": 6})),
    C("bring", "Bring something in for them", outcomes=[
        OUT(7, "You carried in the paper and the hard candy every day that week.",
            FX(stats={"happiness": 5, "health": -1, "willpower": 4}, relationship={"family": 10})),
        OUT(3, "You brought things by and sat there while they slept through most of it.",
            FX(stats={"happiness": -2, "willpower": 4}, relationship={"family": 6})),
    ]),
    C("skip", "Skip the visit",
      text="You didn't go. Nobody said anything about it, and that was worse than being asked.",
      effects=FX(stats={"happiness": -5}, relationship={"family": -4})),
], age_min=9, age_max=17, weight=10, rarity="uncommon")

D("d.family.pet", "family", [
    "You want a dog. {parent} says yes only if you'll actually take care of it, and keeps repeating the word responsibility.",
], [
    C("promise", "Promise everything", outcomes=[
        OUT(6, "You promised everything, got the dog, and did about half of it. The dog didn't mind.",
            FX(stats={"happiness": 7, "health": 2, "discipline": 1}, relationship={"parents": -2})),
        OUT(4, "You promised everything and, to everybody's shock, actually did all of it for four years.",
            FX(stats={"happiness": 7, "health": 3, "discipline": 5}, relationship={"parents": 6})),
    ]),
    C("honest", "Be honest about it",
      text="You admitted you probably wouldn't stick with it. The answer was no, and that was fair.",
      effects=FX(stats={"happiness": -3, "willpower": 3}, relationship={"parents": 5})),
    C("trial", "Offer a trial run", outcomes=[
        OUT(6, "You pitched fostering first. It worked, and the foster dog never left.",
            FX(stats={"happiness": 6, "smarts": 2, "health": 2}, relationship={"parents": 5})),
        OUT(4, "You pitched fostering first, and after three weeks the dog went to somebody else.",
            FX(stats={"happiness": -5, "willpower": 2})),
    ]),
], age_min=6, age_max=14, requires=["anyParent"], weight=12, physical=True)

D("d.family.sibling-broke-it", "family", [
    "{sibling} took something of yours without asking and broke it, and is standing in your doorway holding the pieces.",
], [
    C("shout", "Yell at {sibling}", outcomes=[
        OUT(6, "You lost it completely. {sibling} got grounded and the house stayed sour for months.",
            FX(stats={"happiness": -4, "willpower": -2}, relationship={"siblings": -9})),
        OUT(4, "You lost it, and somehow you were the one in trouble, just for being loud.",
            FX(stats={"happiness": -5}, relationship={"siblings": -5, "parents": -4}, behaviour=-3)),
    ]),
    C("let-go", "Let {sibling} off",
      text="You said it was fine. {sibling} knew you didn't mean it, which was the whole point.",
      effects=FX(stats={"happiness": -1, "willpower": 4}, relationship={"siblings": 7})),
    C("make-pay", "Make {sibling} replace it", outcomes=[
        OUT(5, "{sibling} paid you back over four months out of {siblingTheir} own allowance. $18, in coins.",
            FX(cash=CASH(18, "{sibling} paying you back for what {siblingThey} broke"),
               stats={"happiness": 2, "discipline": 2}, relationship={"siblings": -2})),
        OUT(5, "{sibling} agreed to pay you back and never did, and you brought it up for years.",
            FX(stats={"happiness": -3}, relationship={"siblings": -5})),
    ]),
], age_min=6, age_max=16, requires=["sibling"], weight=13, cooldown=4,
   modifiers=[MOD(1.5, stat_at_most={"willpower": 40})])

D("d.family.move-away", "family", [
    "Your family is moving away from {city}. They're actually asking how you feel about it.",
], [
    C("support", "Say you're fine with it",
      text="You said you were fine with it. Some of that was even true.",
      effects=FX(stats={"happiness": -3, "willpower": 3}, relationship={"parents": 6})),
    C("fight", "Argue against moving", outcomes=[
        OUT(3, "You made enough of a case to push the move back a year.",
            FX(stats={"happiness": 5, "charisma": 5}, relationship={"parents": -2})),
        OUT(7, "You lost the argument, the move happened on schedule, and you'd said all that for nothing.",
            FX(stats={"happiness": -6, "willpower": 2}, relationship={"parents": -5})),
    ]),
    C("terms", "Ask for something in return", outcomes=[
        OUT(6, "You agreed to the move on one condition, and {parent} actually stuck to it.",
            FX(stats={"happiness": 2, "charisma": 4, "smarts": 2}, relationship={"parents": 3})),
        OUT(4, "You agreed to the move for one promise. By August, nobody remembered making it.",
            FX(stats={"happiness": -5, "charisma": 2}, relationship={"parents": -4})),
    ]),
], age_min=8, age_max=16, requires=["anyParent"], weight=9, rarity="uncommon")


# ---- school -----------------------------------------------------------------

D("d.school.cheat", "school", [
    "{kid} moved {kidTheir} math test so you can see the answers. {adult} is looking out the window and hasn't noticed.",
], [
    C("copy", "Copy {kidTheir} answers", outcomes=[
        OUT(5, "You copied {kid}'s answers and got an 88. {KidThey} got an 84.",
            FX(stats={"happiness": 2, "discipline": -2})),
        OUT(5, "You copied and {adult} saw it happen. You both got zeros and a phone call home.",
            FX(stats={"happiness": -6, "discipline": -3}, relationship={"parents": -6}, behaviour=-16)),
    ]),
    C("own-work", "Look away and do your own",
      text="You looked away and got a 61 that was entirely yours.",
      effects=FX(stats={"happiness": -2, "willpower": 4, "discipline": 2})),
    C("warn", "Whisper at {kidThem} to move it",
      text="You hissed at {kid} to move {kidTheir} paper. {KidThey} did, and {kidThey} never sat near you again.",
      effects=FX(stats={"happiness": -3, "charisma": -2, "discipline": 2}, behaviour=2)),
], age_min=9, age_max=17, weight=13, person_tokens=["kid", "adult"],
   modifiers=[MOD(1.7, talents_any=["crime"]), MOD(0.5, stat_at_least={"discipline": 70})])

D("d.school.study-hard", "school", [
    "Finals are two months away and you just bombed a practice test. {adult} handed it back without saying anything.",
], [
    C("grind", "Study hard for it", outcomes=[
        OUT(7, "You worked. Something clicked around week five and the real paper was easy.",
            FX(stats={"smarts": 5, "discipline": 4, "happiness": 2, "health": -1})),
        OUT(3, "You worked your tail off and still landed square in the middle.",
            FX(stats={"discipline": 4, "willpower": 3, "happiness": -3, "health": -1})),
    ]),
    C("ask-help", "Ask {adult} for help", outcomes=[
        OUT(6, "{adult} gave you an hour a week for two months and you've never forgotten it.",
            FX(stats={"smarts": 5, "happiness": 4, "charisma": 2}, behaviour=6)),
        OUT(4, "{adult} said {adultThey}'d help, then was out sick for a month.",
            FX(stats={"happiness": -3, "willpower": 2})),
    ]),
    C("coast", "Don't bother studying",
      text="You coasted. It was a great couple of months and the grades came back mediocre.",
      effects=FX(stats={"happiness": 4, "health": 1, "smarts": -1, "discipline": -3})),
], age_min=12, age_max=17, weight=13, cooldown=3, person_tokens=["adult"])

D("d.school.bully-response", "school", [
    "{kid} has been bullying you all year. Now {kidThey}'s blocking your way in an empty hallway, and nobody else is around.",
], [
    C("fight", "Fight {kidThem}", outcomes=[
        OUT(5, "You hit {kid}. It stopped completely, and you were suspended for a week.",
            FX(stats={"willpower": 5, "happiness": 3, "health": -1}, relationship={"parents": -4},
               behaviour=-18, clear_flags=["school.bullied"])),
        OUT(5, "You hit {kid}, lost, and it got a whole lot worse before it got better.",
            FX(stats={"health": -4, "happiness": -5, "willpower": 3}, behaviour=-12)),
    ]),
    C("tell", "Tell {adult}", outcomes=[
        OUT(6, "{adult} handled it quietly and it was over inside two weeks.",
            FX(stats={"happiness": 5}, behaviour=4, clear_flags=["school.bullied"])),
        OUT(4, "{adult} handled it badly, and suddenly the whole school knew.",
            FX(stats={"happiness": -5, "willpower": 2})),
    ]),
    C("endure", "Put up with it",
      text="You said nothing and waited {kid} out. It took another year.",
      effects=FX(stats={"willpower": 5, "happiness": -6, "health": -1})),
    C("disarm", "Get {kidThem} laughing", outcomes=[
        OUT(3, "You made {kid} laugh, and by Christmas you were something close to friends.",
            FX(stats={"charisma": 6, "happiness": 6}, clear_flags=["school.bullied"])),
        OUT(7, "You tried to make {kid} laugh and handed {kidThem} three new things to make fun of you for.",
            FX(stats={"happiness": -5, "charisma": 1})),
    ]),
], age_min=8, age_max=17, weight=16, flags_all=["school.bullied"],
   person_tokens=["kid", "adult"], physical=True)

D("d.school.blame", "school", [
    "A window got broken and {adult} is asking the class who did it. You know it was {kid}.",
], [
    C("own", "Admit it was you",
      text="You owned it. The punishment was smaller than the silence would've been.",
      effects=FX(stats={"willpower": 4, "discipline": 3, "happiness": -2}, behaviour=5)),
    C("silent", "Say nothing", outcomes=[
        OUT(6, "Nobody said anything, so the whole class got kept after school. It never came up again.",
            FX(stats={"happiness": -2, "charisma": 2})),
        OUT(4, "{kid} gave your name up the next day, and waiting for it made it worse.",
            FX(stats={"happiness": -5}, relationship={"parents": -3}, behaviour=-12)),
    ]),
    C("blame", "Blame {kid}",
      text="You gave {adult} {kid}'s name. It worked, and it cost you a friend who figured out why.",
      effects=FX(stats={"charisma": -3, "happiness": -4, "discipline": -2}, behaviour=-4)),
], age_min=8, age_max=16, weight=12, person_tokens=["kid", "adult"])

D("d.school.speech", "school", [
    "{adult} signed you up to give a speech in front of the whole school. You can say no, but it would look bad.",
], [
    C("do", "Get up and do it", outcomes=[
        OUT(6, "You did it, and two teachers who'd never spoken to you brought it up after.",
            FX(stats={"charisma": 6, "happiness": 5, "willpower": 3}, behaviour=5)),
        OUT(4, "You did it, it went badly, and you lived. That was the actual lesson.",
            FX(stats={"charisma": 2, "willpower": 5, "happiness": -4})),
    ]),
    C("refuse", "Get out of the speech",
      text="You found a way out of it and felt the relief for about an hour.",
      effects=FX(stats={"happiness": -2, "charisma": -3})),
    C("rewrite", "Wing it without the script", outcomes=[
        OUT(4, "You threw out the script {adult} gave you and wrote your own. The hall went quiet in the good way.",
            FX(stats={"charisma": 7, "happiness": 6, "smarts": 2})),
        OUT(6, "You threw out the script and bombed. {adult} wasn't happy about either half of that.",
            FX(stats={"charisma": 1, "happiness": -4}, behaviour=-4)),
    ]),
], age_min=10, age_max=17, weight=12, cooldown=4, person_tokens=["adult"],
   modifiers=[MOD(1.6, talents_any=["acting"]), MOD(1.4, stat_at_least={"charisma": 65})])

D("d.school.reading-group", "school", [
    "{adult} says you're good enough for the advanced class. You'd be the youngest kid in there by a year.",
], [
    C("move", "Join the advanced class", outcomes=[
        OUT(6, "You moved up a level and kept up all year. Nobody made a thing of it.",
            FX(stats={"smarts": 5, "discipline": 3, "happiness": 2})),
        OUT(4, "You moved up a level and struggled, in front of everybody, for two semesters.",
            FX(stats={"smarts": 2, "happiness": -5, "willpower": 4})),
    ]),
    C("stay", "Stay where you are",
      text="You stayed put with your friends and coasted for a year. No complaints.",
      effects=FX(stats={"happiness": 3, "charisma": 2, "smarts": -1})),
    C("trial", "Ask to try one term",
      text="You asked {adult} for a semester to try it. {AdultThey} clearly hadn't been asked before, and said yes.",
      effects=FX(stats={"smarts": 3, "charisma": 3, "discipline": 2, "happiness": 2})),
], age_min=6, age_max=11, weight=12, person_tokens=["adult"],
   modifiers=[MOD(1.8, talents_any=["academics"])])

D("d.school.team-tryout", "school", [
    "Tryouts for the school team are Thursday. {kid} has been talking about them for two weeks straight.",
], [
    C("try", "Go to the tryouts", outcomes=[
        OUT(5, "You made the team. Not a starter, but you made it, and {kid} didn't.",
            FX(stats={"health": 4, "charisma": 3, "happiness": 5})),
        OUT(5, "You were cut on the first day, in front of everyone, and {kid} made the team.",
            FX(stats={"happiness": -6, "willpower": 4, "health": 1})),
    ]),
    C("train-first", "Train for a month first", outcomes=[
        OUT(6, "You trained for a month before tryouts and made the team easily.",
            FX(stats={"health": 5, "discipline": 5, "happiness": 5})),
        OUT(4, "You trained for a month, pulled something in week three, and missed tryouts entirely.",
            FX(stats={"health": -4, "happiness": -5, "discipline": 3})),
    ]),
    C("skip", "Skip the tryouts",
      text="You didn't go. It was the smart call, and it ate at you for about a year.",
      effects=FX(stats={"happiness": -3, "willpower": -1})),
], age_min=8, age_max=16, weight=13, cooldown=4, person_tokens=["kid"], physical=True,
   modifiers=[MOD(2.4, talents_any=["athletics"]), MOD(0.6, stat_at_most={"health": 45})])

D("d.school.instrument", "school", [
    "{adult} is handing out instruments in band class. Whatever you pick, you're stuck with it for years.",
], [
    C("loud", "Pick the loudest one",
      text="You picked the loudest thing on the table and never once regretted it.",
      effects=FX(stats={"happiness": 5, "charisma": 3, "discipline": 1})),
    C("serious", "Pick the hardest one",
      text="You picked the hard one and practiced like it mattered, and after two years it did.",
      effects=FX(stats={"discipline": 5, "smarts": 2, "happiness": 2})),
    C("none", "Don't take one",
      text="You didn't take one, and spent three years of assemblies watching other people play.",
      effects=FX(stats={"happiness": -2, "charisma": -1})),
], age_min=7, age_max=13, weight=12, person_tokens=["adult"],
   modifiers=[MOD(2.0, talents_any=["music"])])

D("d.school.detention-clash", "school", [
    "{adult} gave you detention on Thursday — the same night as the one thing you've been waiting all year for.",
], [
    C("serve", "Take the detention",
      text="You sat out the detention and heard about that night secondhand for a month.",
      effects=FX(stats={"happiness": -4, "discipline": 3}, behaviour=7)),
    C("skip", "Skip it and go", outcomes=[
        OUT(5, "You skipped detention, showed up anyway, and nobody ever brought it up.",
            FX(stats={"happiness": 6}, behaviour=-7)),
        OUT(5, "You skipped detention, and that turned into a way bigger deal than detention.",
            FX(stats={"happiness": -5}, behaviour=-16, relationship={"parents": -4})),
    ]),
    C("ask", "Ask {adult} to move it", outcomes=[
        OUT(4, "{adult} moved it to Monday, which nobody expected including you.",
            FX(stats={"charisma": 5, "happiness": 5}, behaviour=3)),
        OUT(6, "{adult} said that was pretty much the whole point of detention.",
            FX(stats={"charisma": 1, "happiness": -3})),
    ]),
], age_min=11, age_max=17, weight=12, cooldown=4, person_tokens=["adult"],
   school_stage_any=["middle", "high"])


# ---- friendship -------------------------------------------------------------

D("d.friend.dare", "friendship", [
    "{kid} dared you to jump off the bike shed roof. About nine kids are watching to see if you'll do it.",
], [
    C("do-it", "Take the dare", outcomes=[
        OUT(5, "You made it. You were a legend for about six weeks.",
            FX(stats={"charisma": 6, "happiness": 6, "willpower": 2, "health": -1})),
        OUT(4, "You didn't make it. There was blood, an adult, and a story that outlived the injury.",
            FX(stats={"health": -5, "charisma": 3, "happiness": -2})),
        OUT(2, "You didn't make it. Somebody's parents got called, and yours came to get you.",
            FX(stats={"health": -6, "happiness": -5}, relationship={"parents": -5}, behaviour=-8)),
    ]),
    C("refuse", "Back out of the dare",
      text="You said no. It cost you a couple of friends and nothing else.",
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
    "There's a new kid, {kid}, eating lunch alone. You already have a seat with your friends.",
], [
    C("invite", "Bring {kid} over", outcomes=[
        OUT(7, "You brought {kid} over. It stuck, and you're still friends years later.",
            FX(stats={"charisma": 4, "happiness": 6})),
        OUT(3, "You brought {kid} over and it didn't take. You were still glad you did.",
            FX(stats={"charisma": 3, "happiness": 2})),
    ]),
    C("sit-there", "Sit with {kid} instead",
      text="You took your tray over to {kid} instead. Your own table noticed, and said so.",
      effects=FX(stats={"charisma": 2, "happiness": 4, "willpower": 3})),
    C("leave", "Stay out of it",
      text="You left it. Somebody else did it a week later and you remember that too.",
      effects=FX(stats={"happiness": -3})),
], age_min=7, age_max=17, weight=13, cooldown=5, person_tokens=["kid"])

D("d.friend.exclusion", "friendship", [
    "Your friends have decided to stop talking to {kid2}. {kid} is watching to see whose side you take.",
], [
    C("join", "Go along with it",
      text="You went along with it. Easy at the time, and you still think about it.",
      effects=FX(stats={"charisma": 2, "happiness": -5, "willpower": -2})),
    C("refuse", "Refuse to go along with it", outcomes=[
        OUT(5, "You refused, and the whole thing broke up within a week.",
            FX(stats={"willpower": 5, "charisma": 3, "happiness": 4})),
        OUT(5, "You said no, and got frozen out right alongside {kid2}.",
            FX(stats={"willpower": 5, "charisma": -4, "happiness": -5})),
    ]),
    C("quiet", "Say nothing, sit with {kid2}", outcomes=[
        OUT(6, "You didn't argue. You just sat with {kid2} every lunch until it stopped mattering.",
            FX(stats={"willpower": 4, "happiness": 3, "charisma": 1})),
        OUT(4, "You sat with {kid2} and lost {kid} over it. Neither of you ever said a word about it.",
            FX(stats={"willpower": 3, "happiness": -3, "charisma": -2})),
    ]),
], age_min=9, age_max=17, weight=13, person_tokens=["kid", "kid2"])

D("d.friend.stand-up", "friendship", [
    "{kid} is being made fun of in front of the whole cafeteria and nobody is helping.",
], [
    C("step-in", "Step in and defend {kid}", outcomes=[
        OUT(6, "You stepped in, and it stopped. Nobody ever mentioned it again.",
            FX(stats={"willpower": 5, "charisma": 4, "happiness": 5})),
        OUT(4, "You stepped in, and it turned on you for the rest of the school year.",
            FX(stats={"willpower": 6, "happiness": -5, "charisma": -2, "health": -1})),
    ]),
    C("laugh", "Laugh along with them",
      text="You laughed with everyone else. {kid} saw you do it.",
      effects=FX(stats={"charisma": 1, "happiness": -5, "willpower": -3})),
    C("after", "Find {kid} afterward",
      text="You didn't step in, but you found {kid} by the lockers after and stayed a while.",
      effects=FX(stats={"happiness": 2, "charisma": 2, "willpower": 1})),
    C("leave", "Walk out of the cafeteria",
      text="You left the room. Not brave, not in on it, and you never quite forgot it.",
      effects=FX(stats={"happiness": -2, "willpower": 1})),
], age_min=9, age_max=17, weight=13, person_tokens=["kid"])

D("d.friend.betrayal", "friendship", [
    "{kid} repeated something mean you said about {kid2}. Now {kid2} won't talk to you, and {kid} is acting like nothing happened.",
], [
    C("apologize", "Apologize to {kid2}", outcomes=[
        OUT(5, "You apologized to {kid2} at {kid2Their} locker. {Kid2They} said 'okay', and things weren't normal until March.",
            FX(stats={"happiness": -2, "charisma": 2, "willpower": 3})),
        OUT(5, "You apologized, {kid2} cried and hugged you, and {kid} was furious you'd made {kidThem} look bad.",
            FX(stats={"happiness": 5, "charisma": 3})),
    ]),
    C("confront", "Confront {kid}", outcomes=[
        OUT(5, "You told {kid} exactly what you thought of {kidThem} in front of six people. {KidThey} didn't deny it.",
            FX(stats={"happiness": -3, "willpower": 4, "charisma": 1})),
        OUT(5, "You confronted {kid} and {kidThey} cried, which you hadn't seen coming at all.",
            FX(stats={"happiness": -2, "charisma": 2})),
    ]),
    C("blow-over", "Let it blow over",
      text="It blew over by Easter. {kid2} never really trusted you again, and never said so.",
      effects=FX(stats={"happiness": -5, "charisma": -1})),
], age_min=9, age_max=17, weight=12, person_tokens=["kid", "kid2"])

D("d.friend.homework", "friendship", [
    "{kid} wants to copy your homework ten minutes before class. {KidThey}'s asking you as a friend.",
], [
    C("give", "Hand it over",
      text="You handed it over. {kid} copied it word for word, including a mistake, and {adult} noticed.",
      effects=FX(stats={"charisma": 2, "discipline": -2, "happiness": -1}, behaviour=-5)),
    C("explain", "Explain it instead",
      text="You walked {kid} through it in eight minutes and were late to your own lesson.",
      effects=FX(stats={"smarts": 3, "charisma": 4, "happiness": 3})),
    C("refuse", "Say no",
      text="You said no. {kid} found somebody else in about a minute, and it was weird for two weeks.",
      effects=FX(stats={"discipline": 3, "charisma": -3, "happiness": -2})),
], age_min=9, age_max=17, weight=13, cooldown=3, person_tokens=["kid", "adult"])

D("d.friend.party", "friendship", [
    "{kid} is having a party Saturday night. You already asked {parent} twice and got a no both times.",
], [
    C("sneak", "Go anyway", outcomes=[
        OUT(5, "You went, climbed back in the window at one, and nobody ever found out.",
            FX(stats={"happiness": 6, "charisma": 4, "health": -1, "discipline": -1})),
        OUT(5, "You went, and {parent} was sitting in the kitchen with the light on when you got back.",
            FX(stats={"happiness": -4, "charisma": 2}, relationship={"parents": -8})),
    ]),
    C("stay", "Stay home",
      text="You stayed home and heard about {kid}'s party for a month.",
      effects=FX(stats={"charisma": -3, "discipline": 3, "happiness": -3}, relationship={"parents": 4})),
    C("negotiate", "Talk {parent} into it", outcomes=[
        OUT(4, "You made a real case and got a curfew instead of a no.",
            FX(stats={"charisma": 5, "happiness": 5}, relationship={"parents": 3})),
        OUT(6, "You asked again, and the no just got louder.",
            FX(stats={"charisma": 1, "happiness": -3})),
    ]),
    C("host", "Ask to host instead", outcomes=[
        OUT(5, "{parent} said yes to hosting. Eleven people came and nothing got broken.",
            FX(stats={"happiness": 6, "charisma": 5}, relationship={"parents": 2})),
        OUT(5, "{parent} said yes to hosting. Something got broken, and it wasn't cheap.",
            FX(stats={"happiness": -2, "charisma": 3}, relationship={"parents": -6})),
    ]),
], age_min=13, age_max=17, requires=["anyParent"], weight=14, cooldown=3, person_tokens=["kid"])

D("d.friend.birthday-clash", "friendship", [
    "{kid} and {kid2} are having birthday parties at the same time, and both invited you.",
], [
    C("close", "Go to {kid}'s",
      text="You went to {kid}'s. {kid2} noticed, and mentioned it in February.",
      effects=FX(stats={"happiness": 3, "charisma": -1})),
    C("new", "Show up at {kid2}'s",
      text="You went to {kid2}'s, which surprised everybody including you, and it was the better party.",
      effects=FX(stats={"charisma": 3, "happiness": 4})),
    C("both", "Split the day between both", outcomes=[
        OUT(5, "You did an hour at each, and both of them were glad you'd bothered.",
            FX(stats={"charisma": 5, "happiness": 4, "health": -1})),
        OUT(5, "You did an hour at each and managed to annoy both of them.",
            FX(stats={"charisma": -2, "happiness": -4})),
    ]),
    C("neither", "Stay home",
      text="You skipped both and stayed home. It didn't fix anything.",
      effects=FX(stats={"happiness": -4, "charisma": -3})),
], age_min=7, age_max=15, weight=12, cooldown=5, person_tokens=["kid", "kid2"])

D("d.friend.cover", "friendship", [
    "{kid} broke something expensive at your house. Nobody else knows it happened.",
], [
    C("cover", "Take the blame yourself",
      text="You took it. {kid} knew you did, and things were never quite the same after.",
      effects=FX(stats={"willpower": 4, "happiness": -3}, relationship={"parents": -5})),
    C("truth", "Tell the truth",
      text="You told the truth. It was the right call, and it ended the friendship.",
      effects=FX(stats={"discipline": 3, "happiness": -5, "charisma": -2})),
    C("together", "Make {kid} come with you", outcomes=[
        OUT(6, "You made {kid} come and own it with you. {parent} was more impressed than angry.",
            FX(stats={"charisma": 5, "willpower": 4, "happiness": 2}, relationship={"parents": 2})),
        OUT(4, "You made {kid} come with you and {kidThey} denied everything on the doorstep.",
            FX(stats={"happiness": -5, "charisma": -2}, relationship={"parents": -4})),
    ]),
], age_min=9, age_max=17, requires=["anyParent"], weight=11, person_tokens=["kid"])

D("d.friend.gift", "friendship", [
    "{kid}'s birthday is Saturday and you only have $12.",
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
        OUT(4, "You made {kid} a present and {kidTheir} cousin asked out loud why you hadn't just bought one.",
            FX(stats={"happiness": -5, "willpower": 2})),
    ]),
    C("nothing", "Show up empty-handed",
      text="You went to {kid}'s with nothing. Nobody said a word about it and you thought about it all night.",
      effects=FX(stats={"happiness": -5})),
], age_min=8, age_max=16, weight=11, cooldown=5, person_tokens=["kid"])

D("d.friend.late-night", "friendship", [
    "You're sleeping over at {kid}'s and {kidTheir} parents are out. {KidThey} wants to stay up all night watching movies.",
], [
    C("all-night", "Stay up all night", outcomes=[
        OUT(6, "You stayed up until six at {kid}'s and slept through Saturday entirely.",
            FX(stats={"health": -4, "happiness": 6, "charisma": 2})),
        OUT(4, "You stayed up all night at {kid}'s and had nightmares for a month.",
            FX(stats={"health": -4, "happiness": -5})),
    ]),
    C("two", "Go to sleep around two",
      text="You fell asleep at two on {kid}'s floor. Good night, no wreckage.",
      effects=FX(stats={"health": -1, "happiness": 5})),
    C("home", "Go home",
      text="You went home at eleven. {kid} brought it up for years.",
      effects=FX(stats={"health": 3, "happiness": -2, "charisma": -2})),
], age_min=10, age_max=17, weight=12, cooldown=3, person_tokens=["kid"], physical=True)

O("o.friend.mentor", "friendship", [
    "{kid} is three years older and has started treating you like a real friend, which almost never happens.",
], [
    C("stick", "Stick with {kid}", outcomes=[
        OUT(7, "{kid} taught you more in a year than school managed in three.",
            FX(stats={"smarts": 4, "charisma": 4, "discipline": 4, "happiness": 5})),
        OUT(3, "{kid} wasn't the influence anybody hoped for, and the year got away from you.",
            FX(stats={"charisma": 4, "discipline": -4, "happiness": 2}, behaviour=-8)),
    ]),
    C("distance", "Keep your distance",
      text="You stopped answering. By spring you'd stopped thinking about it too.",
      effects=FX(stats={"willpower": 2, "happiness": -1})),
    C("ask", "Ask {kid} outright why",
      text="You asked {kid} why {kidThey} bothered with you. {KidThey} said you reminded {kidThem} of {kidThem}self.",
      effects=FX(stats={"charisma": 3, "smarts": 2, "happiness": 3})),
], age_min=10, age_max=17, weight=10, person_tokens=["kid"])


# ---- random -----------------------------------------------------------------

D("d.random.wallet", "random", [
    "You found a wallet on the sidewalk outside the store. There's $60 inside and a driver's license with an address.",
], [
    C("hand-in", "Hand it in at the counter", outcomes=[
        OUT(6, "You handed it in at Trujillo's. The owner came back for it and gave you $20.",
            FX(cash=CASH(20, "a reward for handing in a found wallet"),
               stats={"happiness": 6, "willpower": 3})),
        OUT(4, "You left the wallet at the Trujillo's counter and never heard another word about it.",
            FX(stats={"happiness": 3, "willpower": 3})),
    ]),
    C("keep", "Keep the $60", outcomes=[
        OUT(7, "You took the $60 and left the wallet on the sidewalk. Nobody ever came looking.",
            FX(cash=CASH(60, "cash taken from a wallet you found"),
               stats={"happiness": -3, "discipline": -3})),
        OUT(3, "You took the $60, and two weeks later the owner's son recognized you from the photo on the license.",
            FX(cash=CASH(60, "cash taken from a wallet you found"),
               stats={"happiness": -6, "charisma": -4})),
    ]),
    C("find-owner", "Go to the address on the license", outcomes=[
        OUT(6, "You walked the wallet to the address on the license. They gave you $20 and a slice of cake.",
            FX(cash=CASH(20, "a reward for returning a wallet in person"),
               stats={"happiness": 7, "charisma": 3, "willpower": 2})),
        OUT(4, "You walked to the address on the license and nobody answered, three times.",
            FX(stats={"happiness": -2, "willpower": 3, "health": -1})),
    ]),
    C("leave", "Leave it where it is",
      text="You left the wallet on the sidewalk. Somebody else got to it within the hour.",
      effects=FX(stats={"happiness": -3})),
], age_min=8, age_max=17, weight=12, modifiers=[MOD(1.8, talents_any=["crime"])])

D("d.random.stray-dog", "random", [
    "A dog with no collar followed you home from the store and won't leave.",
], [
    C("keep", "Take it home", outcomes=[
        OUT(6, "{parent} said no for two days and then came home with a bowl.",
            FX(stats={"happiness": 7, "health": 2}, relationship={"parents": 3})),
        OUT(4, "The owner nearly cried and pushed $20 into your hand.",
            FX(cash=CASH(20, "a reward from the dog's owner"), stats={"happiness": 3})),
    ], requires=COND(requires=["anyParent"])),
    C("owner", "Look for the owner",
      text="You knocked on doors for two hours till you found the right one. The owner teared up.",
      effects=FX(stats={"charisma": 3, "willpower": 3, "happiness": 4, "health": -1})),
    C("shelter", "Walk it to the shelter",
      text="You walked the dog two miles to the shelter and didn't stick around to watch.",
      effects=FX(stats={"happiness": -2, "willpower": 3, "health": -1})),
    C("leave", "Leave the dog there",
      text="You left it outside the store. You thought about it for weeks after.",
      effects=FX(stats={"happiness": -4, "willpower": 1})),
], age_min=6, age_max=15, weight=11, physical=True)

D("d.random.first-cigarette", "random", [
    "{kid} pulled out a pack of cigarettes behind the gym and is offering you one.",
], [
    C("try", "Smoke one",
      text="You tried it, coughed for a solid minute, and acted like you hadn't all afternoon.",
      effects=FX(stats={"health": -3, "charisma": 3, "discipline": -2, "happiness": 1})),
    C("decline", "Say no thanks",
      text="You passed. {kid} noticed, and held it against you for a couple of weeks.",
      effects=FX(stats={"willpower": 4, "health": 2, "charisma": -2, "happiness": -1})),
    C("take-and-not", "Take one, don't smoke it",
      text="You took one, held it the whole time, and put it in your pocket unlit. Nobody checked.",
      effects=FX(stats={"willpower": 3, "charisma": 2, "happiness": 1})),
], age_min=12, age_max=17, weight=12, person_tokens=["kid"], physical=True,
   modifiers=[MOD(1.6, talents_any=["crime"]), MOD(0.5, stat_at_least={"discipline": 70})])

D("d.random.first-drink", "random", [
    "There's alcohol going around at {kid}'s party and somebody handed you a cup.",
], [
    C("drink", "Drink it", outcomes=[
        OUT(6, "You drank it, hated it, and pretended otherwise the rest of the night.",
            FX(stats={"health": -2, "charisma": 3, "happiness": 2})),
        OUT(4, "You drank way more than that, and the night ended on {kid}'s lawn in front of everybody.",
            FX(stats={"health": -4, "happiness": -5, "charisma": -3})),
    ]),
    C("pour", "Put it down somewhere",
      text="You set the cup down behind a potted plant and nobody noticed either way.",
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
    "{kid} and {kid2} are jumping off the train bridge into the river. {kid} says it's twelve feet down. It looks more like twenty.",
], [
    C("jump", "Jump off the bridge", outcomes=[
        OUT(5, "You jumped off the bridge and came up whooping. {kid2} wouldn't do it.",
            FX(stats={"health": -2, "happiness": 8, "charisma": 4, "willpower": 3})),
        OUT(5, "You jumped and hit the water flat. Your whole back was purple for a week.",
            FX(stats={"health": -7, "happiness": 2, "charisma": 2})),
    ]),
    C("swim", "Swim in from the bank",
      text="You swam from the bank while {kid} and {kid2} jumped. Good afternoon, nothing broken.",
      effects=FX(stats={"health": 3, "happiness": 5})),
    C("say-no", "Say it's too high", outcomes=[
        OUT(5, "You said it was too high. {kid} quietly agreed with you an hour later.",
            FX(stats={"willpower": 4, "happiness": 3})),
        OUT(5, "You said it was too high and {kid2} gave you a name that stuck until spring.",
            FX(stats={"willpower": 3, "happiness": -6, "charisma": -3})),
    ]),
], age_min=9, age_max=17, weight=11, person_tokens=["kid", "kid2"], physical=True)

D("d.random.sore-throat", "random", [
    "You woke up with a sore throat, and today is the school aquarium trip you've been excited about.",
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
        OUT(5, "{parent} said you'd live. You did, and you got to see the rays.",
            FX(stats={"health": -2, "happiness": 4}, relationship={"parents": 1})),
    ], requires=COND(requires=["anyParent"])),
], age_min=7, age_max=15, weight=11, physical=True)

D("d.random.savings", "random", [
    "You've saved $150, and there's something you really want in a store window downtown.",
], [
    C("buy", "Spend the $150 on it",
      text="You spent the whole $150 in one afternoon and had an excellent two weeks.",
      effects=FX(cash=CASH(-150, "the thing in the store window"),
                 stats={"happiness": 7, "discipline": -3})),
    C("wait", "Keep saving",
      text="You left the $150 where it was. It was hard, and the pile got bigger.",
      effects=FX(stats={"discipline": 5, "willpower": 4, "happiness": -2})),
    C("cheaper", "Find a cheaper version",
      text="You found a worse one for $75 and put the rest back. It did the job for two years.",
      effects=FX(cash=CASH(-75, "a cheaper version of the thing"),
                 stats={"happiness": 3, "smarts": 2, "discipline": 2})),
], age_min=10, age_max=17, weight=11, cooldown=4)

D("d.random.charity", "random", [
    "School is collecting money for a family who lost their home. You have $40 saved for something you wanted.",
], [
    C("donate", "Put the whole $40 in",
      text="You put the whole $40 in the envelope. Nobody knew how much it was, which was the point.",
      effects=FX(cash=CASH(-40, "the school collection"),
                 stats={"happiness": 5, "willpower": 3}, behaviour=5)),
    C("help", "Help run the collection instead",
      text="You kept your $40 and spent two weeks of lunches watching everybody else spend theirs.",
      effects=FX(stats={"happiness": -1, "discipline": 4, "charisma": 3}, behaviour=6)),
    C("keep", "Keep your $40",
      text="You kept the $40 and bought it. It was great for about a month, then it broke.",
      effects=FX(cash=CASH(-40, "the thing you had been saving for"),
                 stats={"happiness": -2, "discipline": -1})),
], age_min=8, age_max=16, weight=11, cooldown=5)

D("d.random.haircut", "random", [
    "You're in the barber's chair and {adult} is waiting to hear how you want your hair cut.",
], [
    C("bold", "Cut it all off", outcomes=[
        OUT(5, "It was a triumph. Three people asked where you had it done.",
            FX(stats={"looks": 6, "charisma": 4, "happiness": 6})),
        OUT(5, "It was a catastrophe, and hair grows about half an inch a month.",
            FX(stats={"looks": -6, "happiness": -5, "willpower": 3})),
    ]),
    C("same", "Do what you always do",
      text="You had the usual. It was fine. It's always fine.",
      effects=FX(stats={"happiness": 1})),
    C("ask-her", "Ask {adult} what {adultThey}'d do", outcomes=[
        OUT(7, "{adult} did what {adultThey} thought suited you and {adultThey} was completely right.",
            FX(stats={"looks": 5, "happiness": 5, "charisma": 2})),
        OUT(3, "{adult} did what {adultThey} thought suited you and {adultThey} wasn't even close.",
            FX(stats={"looks": -3, "happiness": -3})),
    ]),
], age_min=9, age_max=17, weight=12, cooldown=3, person_tokens=["adult"])

D("d.random.online-argument", "random", [
    "Somebody posted something mean about you online. It's midnight and you're staring at the reply box.",
], [
    C("fire-back", "Send an angry reply", outcomes=[
        OUT(5, "You trashed them in front of everybody, and it followed you around for a year.",
            FX(stats={"charisma": 2, "happiness": -4, "health": -1})),
        OUT(5, "You fired back, badly, and somebody screenshotted it before you could delete it.",
            FX(stats={"charisma": -4, "happiness": -6, "willpower": 2})),
    ]),
    C("ignore", "Close the app",
      text="You put the phone face down. The whole thing died out in two days.",
      effects=FX(stats={"willpower": 5, "happiness": 2, "health": 1})),
    C("dm", "Message them privately", outcomes=[
        OUT(6, "You messaged the person directly. Turned out it was a misunderstanding, and the post came down.",
            FX(stats={"charisma": 4, "happiness": 4, "smarts": 2})),
        OUT(4, "You messaged the person directly, and your message got screenshotted and passed around.",
            FX(stats={"happiness": -5, "charisma": -2})),
    ]),
], age_min=12, age_max=17, weight=12, flags_all=["has.phone"], cooldown=3)

D("d.random.late-night", "random", [
    "It's one in the morning and you're nowhere close to finishing what you're working on.",
], [
    C("push-on", "Stay up and finish",
      text="You kept going until four in the morning and paid for it every day that week.",
      effects=FX(stats={"health": -3, "discipline": 3, "happiness": 3})),
    C("sleep", "Go to bed",
      text="You went to bed. It was still there in the morning, but it didn't feel as heavy.",
      effects=FX(stats={"health": 3, "discipline": 2, "happiness": 1})),
    C("alarm", "Sleep and get up early", outcomes=[
        OUT(5, "You set an alarm for five and it worked, which surprised you more than anyone.",
            FX(stats={"discipline": 5, "happiness": 3, "health": -1})),
        OUT(5, "You set an alarm for five and slept straight through it.",
            FX(stats={"health": 2, "happiness": -4, "discipline": -2})),
    ]),
], age_min=11, age_max=17, weight=12, cooldown=3, physical=True)

D("d.random.summer", "random", [
    "School's out for eleven weeks and you have no plans at all.",
], [
    C("work", "Take a summer job",
      text="You worked at the garden center all summer. It was dull, it paid $1,100, and it made the fall easier.",
      effects=FX(cash=CASH(1100, "a summer at the garden center"),
                 stats={"discipline": 4, "health": -1, "happiness": -1})),
    C("train", "Train for one thing",
      text="You spent all summer getting good at one thing, and people noticed when you got back.",
      effects=FX(stats={"discipline": 4, "health": 3, "willpower": 3, "happiness": 2})),
    C("nothing", "Do absolutely nothing",
      text="You did nothing for eleven weeks. Still one of the best summers you've had.",
      effects=FX(stats={"happiness": 7, "health": 2, "discipline": -3})),
    C("kid", "Spend it with {kid}",
      text="You spent all eleven weeks with {kid} and can't remember one specific day of it now.",
      effects=FX(stats={"happiness": 6, "charisma": 4})),
], age_min=13, age_max=17, weight=13, cooldown=2, person_tokens=["kid"], physical=True)

D("d.random.appearance", "random", [
    "You've decided you want to look different by the time school starts again.",
], [
    C("effort", "Work on how you look", outcomes=[
        OUT(6, "It worked. People noticed and mostly didn't say so.",
            FX(stats={"looks": 6, "charisma": 3, "discipline": 3, "happiness": 4})),
        OUT(4, "It half worked. At that age that's about as good as it gets.",
            FX(stats={"looks": 2, "discipline": 3, "happiness": 1})),
    ]),
    C("fit", "Get fit instead",
      text="You started running, hated it for six weeks, and then didn't.",
      effects=FX(stats={"health": 6, "discipline": 4, "looks": 3, "happiness": 3})),
    C("drop", "Decide not to care", outcomes=[
        OUT(6, "You decided not to care. That took way more work than caring would've.",
            FX(stats={"willpower": 5, "happiness": 4})),
        OUT(4, "You told people you'd stopped caring. Nobody had asked.",
            FX(stats={"willpower": 2, "happiness": -4, "charisma": -2})),
    ]),
], age_min=12, age_max=17, weight=12, cooldown=3, physical=True)

D("d.random.found-note", "random", [
    "There's a $20 bill sitting on the kitchen counter. It's been there three days and nobody has mentioned it.",
], [
    C("take", "Take the money", outcomes=[
        OUT(7, "You took the $20. Nobody ever said anything, which somehow wasn't a relief.",
            FX(cash=CASH(20, "$20 taken off the kitchen counter"),
               stats={"happiness": -2, "discipline": -2})),
        OUT(3, "You took the $20. {parent} knew exactly how much had been there.",
            FX(cash=CASH(20, "$20 taken off the kitchen counter"),
               stats={"happiness": -5}, relationship={"parents": -7})),
    ]),
    C("ask", "Ask about it",
      text="You asked. Turns out the $20 was yours anyway — {parent} had left it out for you.",
      effects=FX(cash=CASH(20, "$20 {parent} had left out for you"),
                 stats={"happiness": 4, "willpower": 3}, relationship={"parents": 3})),
    C("leave", "Leave it there",
      text="You left the $20 where it was. It was gone by Friday and you never found out where.",
      effects=FX(stats={"willpower": 3, "happiness": -1})),
], age_min=8, age_max=16, requires=["anyParent"], weight=11,
   modifiers=[MOD(1.8, talents_any=["crime"]), MOD(1.6, wealth_any=["struggling"])])

O("o.random.neighbour", "random", [
    "Your neighbor {adult} offered to teach you something {adultThey} is really good at. You barely know {adultThem}.",
], [
    C("accept", "Take {adultThem} up on it",
      text="You said yes to {adult}. It became a Saturday habit that lasted four years.",
      effects=FX(stats={"smarts": 4, "discipline": 4, "happiness": 5})),
    C("decline", "Turn it down politely",
      text="You told {adult} no thanks. Nobody ever asked you again.",
      effects=FX(stats={"happiness": -2})),
    C("once", "Try it once",
      text="You went once to be polite and stayed four hours.",
      effects=FX(stats={"smarts": 2, "charisma": 3, "happiness": 3})),
], age_min=8, age_max=16, weight=10, person_tokens=["adult"])

O("o.random.competition", "random", [
    "There's a contest with a $600 prize. The entry form has been sitting on the kitchen table for a week.",
], [
    C("enter", "Enter the contest", outcomes=[
        OUT(2, "You won the $600. Nobody was more surprised than the people who knew you.",
            FX(cash=CASH(600, "a competition prize"),
               stats={"happiness": 8, "charisma": 4})),
        OUT(8, "You didn't win. Signing up took more nerve than the result makes it sound.",
            FX(stats={"willpower": 4, "happiness": -2})),
    ]),
    C("with-kid", "Team up with {kid}", outcomes=[
        OUT(2, "You and {kid} won and split the prize down the middle. $300 each.",
            FX(cash=CASH(300, "half a competition prize, split with {kid}"),
               stats={"happiness": 8, "charisma": 5})),
        OUT(8, "You and {kid} didn't win and still had a better week than the people who did.",
            FX(stats={"happiness": 3, "charisma": 3})),
    ]),
    C("bin", "Skip the contest",
      text="The form stayed on the table until somebody threw it out with the junk mail.",
      effects=FX(stats={"happiness": -2})),
], age_min=8, age_max=17, weight=11, rarity="uncommon", cooldown=6, person_tokens=["kid"])

O("o.school.exchange", "school", [
    "Someone dropped out of the school trip abroad and {adult} is offering you their spot.",
], [
    C("go", "Take the spot", outcomes=[
        OUT(7, "Three weeks away, and your own town looked tiny when you got back.",
            FX(stats={"smarts": 5, "charisma": 5, "happiness": 6, "health": -1})),
        OUT(3, "You were homesick for all three weeks and still didn't want to leave at the end.",
            FX(stats={"willpower": 5, "charisma": 2, "happiness": -3})),
    ]),
    C("ask-parents", "Ask {parent} first", outcomes=[
        OUT(6, "{parent} found the money somewhere and never said where.",
            FX(stats={"smarts": 4, "charisma": 4, "happiness": 5}, relationship={"parents": 6})),
        OUT(4, "{parent} couldn't make it work, and was more upset about it than you were.",
            FX(stats={"happiness": -4}, relationship={"parents": 2})),
    ], requires=COND(requires=["anyParent"])),
    C("decline", "Turn it down",
      text="You turned {adult} down. Good reasons, and it still nagged at you for years.",
      effects=FX(stats={"happiness": -3})),
], age_min=13, age_max=17, weight=10, rarity="uncommon", person_tokens=["adult"],
   wealth_any=["modest", "comfortable", "affluent", "wealthy"])


# ---- talent -----------------------------------------------------------------

D("d.talent.commit", "talent", [
    "{adult} asked if you're serious about the thing you're good at. Getting better would take four evenings a week.",
], [
    C("commit", "Go all in on it", outcomes=[
        OUT(6, "You went all in. Your grades slipped a whole letter and it stopped being a hobby.",
            FX(stats={"discipline": 5, "smarts": -2, "happiness": 5, "health": -1},
               set_flags=["talent.committed"])),
        OUT(4, "You went all in and burned out by spring. It came back two years later.",
            FX(stats={"willpower": 4, "happiness": -5, "health": -3})),
    ]),
    C("balance", "Keep it a hobby",
      text="You split your time between both and ended up second-best at each. Didn't bother you.",
      effects=FX(stats={"discipline": 3, "smarts": 2, "happiness": 2})),
    C("drop", "Give up on it",
      text="You told {adult} you were done. It was a relief for about a year.",
      effects=FX(stats={"happiness": 3, "discipline": -2, "willpower": -2})),
], age_min=12, age_max=17, weight=14, person_tokens=["adult"], physical=True,
   talents_any=["athletics", "acting", "music", "writing", "academics", "inventive"])

D("d.talent.rival", "talent", [
    "{kid} is better than you at the one thing you're good at, and just got picked for something you didn't.",
], [
    C("train", "Practice harder than {kid}", outcomes=[
        OUT(5, "You out-worked {kid}. It took two years, and it stuck.",
            FX(stats={"discipline": 6, "willpower": 5, "happiness": 4, "health": -1})),
        OUT(5, "You out-worked {kid} and {kid} stayed better anyway. That was worth finding out early.",
            FX(stats={"discipline": 5, "willpower": 4, "happiness": -5, "health": -1})),
    ]),
    C("learn", "Ask {kid} how",
      text="You asked {kid} how it was done. {kid} just told you, and you both got better at it.",
      effects=FX(stats={"smarts": 3, "charisma": 4, "discipline": 3, "happiness": 3})),
    C("quit", "Find something else",
      text="You switched to something with less competition and were quietly a lot happier.",
      effects=FX(stats={"happiness": 3, "willpower": -2})),
], age_min=10, age_max=17, weight=12, person_tokens=["kid"], physical=True,
   talents_any=["athletics", "acting", "music", "writing", "academics", "inventive", "crime"])

D("d.talent.show-off", "talent", [
    "You have a chance to perform in front of a room full of people who've never seen what you can do.",
], [
    C("perform", "Try the hard version", outcomes=[
        OUT(6, "It landed. A few people looked at you differently after that, {kid} included.",
            FX(stats={"charisma": 5, "happiness": 6})),
        OUT(4, "It didn't land. Somebody coughed, and that was the whole reaction.",
            FX(stats={"charisma": -2, "willpower": 4, "happiness": -5})),
    ]),
    C("small", "Play it safe",
      text="You did the version you couldn't get wrong. It was fine, and nobody remembered it.",
      effects=FX(stats={"charisma": 1, "happiness": -1})),
    C("decline", "Keep it to yourself",
      text="You kept it to yourself, and nobody ever asked.",
      effects=FX(stats={"willpower": 2, "happiness": -2})),
], age_min=8, age_max=17, weight=12, cooldown=4, person_tokens=["kid"],
   talents_any=["athletics", "acting", "music", "writing", "inventive"])

O("o.talent.audition", "talent", [
    "A real audition is coming to {city}, which basically never happens. It's on a Tuesday, during school.",
], [
    C("go", "Go to the audition", outcomes=[
        OUT(3, "You got it. It changed what you thought was possible.",
            FX(stats={"charisma": 6, "happiness": 8, "discipline": 3},
               set_flags=["talent.breakthrough"])),
        OUT(7, "You didn't get it, but an hour in that room taught you plenty.",
            FX(stats={"charisma": 3, "willpower": 4, "happiness": -3})),
    ]),
    C("prepare", "Spend a month preparing first", outcomes=[
        OUT(5, "You prepared for a month and walked in knowing exactly what you were doing.",
            FX(stats={"charisma": 5, "discipline": 5, "happiness": 6, "health": -1},
               set_flags=["talent.breakthrough"])),
        OUT(5, "You prepped for a month and rehearsed it so much it came out flat.",
            FX(stats={"discipline": 4, "happiness": -4, "health": -1})),
    ]),
    C("skip", "Skip the audition",
      text="You didn't go. It's one of the ones you still think about.",
      effects=FX(stats={"happiness": -4, "willpower": -2})),
], age_min=11, age_max=17, weight=11, rarity="rare", talents_any=["acting", "music"])

O("o.talent.trial", "talent", [
    "A team two hours away invited you to try out. Someone would have to drive you there and back.",
], [
    C("go", "Go to the tryout", outcomes=[
        OUT(4, "You were offered a place. The next three years got harder and better.",
            FX(stats={"health": 4, "discipline": 5, "happiness": 7},
               set_flags=["talent.breakthrough"])),
        OUT(6, "You didn't make it. You were a lot closer than it looked.",
            FX(stats={"health": 2, "willpower": 5, "happiness": -4})),
    ]),
    C("ask-parent", "Ask {parent} to take you", outcomes=[
        OUT(6, "{parent} took the day off work to drive you. You've never known what to do with that.",
            FX(stats={"health": 3, "discipline": 4, "happiness": 6}, relationship={"parents": 7})),
        OUT(4, "{parent} couldn't get the day off, and neither of you brought it up again.",
            FX(stats={"happiness": -5}, relationship={"parents": -2})),
    ]),
    C("skip", "Give up on it",
      text="It was too far and nobody was free to drive. That was the whole reason.",
      effects=FX(stats={"happiness": -5, "willpower": 1})),
], age_min=11, age_max=17, requires=["anyParent"], weight=11, rarity="rare",
   talents_any=["athletics"], physical=True)

O("o.talent.scholarship", "talent", [
    "A school you'd never thought about wrote to you. They're offering a spot and money to cover it.",
], [
    C("apply", "Apply for the spot", outcomes=[
        OUT(4, "You got in. The commute was brutal and the teaching was extraordinary.",
            FX(stats={"smarts": 7, "discipline": 5, "happiness": -1, "health": -2},
               set_flags=["talent.breakthrough"])),
        OUT(6, "You didn't get in, but writing the application taught you how to write about yourself.",
            FX(stats={"smarts": 3, "willpower": 4, "happiness": -2})),
    ]),
    C("visit", "Go look at it first", outcomes=[
        OUT(5, "You visited, hated the feel of the place, and didn't apply. Good instinct.",
            FX(stats={"smarts": 2, "willpower": 3, "happiness": 2})),
        OUT(5, "You visited, loved it, applied late, and missed the deadline by four days.",
            FX(stats={"happiness": -6, "discipline": 2})),
    ]),
    C("stay", "Stay where you are",
      text="You stayed. Your friends were there, and that's a good enough reason.",
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
    "The name was decided in the parking lot. It wasn't the first choice, or the second.",
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
    "Wouldn't go anywhere without a specific blanket that was, by then, mostly holes.",
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
    "Learned the alphabet as a song and couldn't say it any other way for years.",
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
    "Got moved to the front of the class, which was framed as a compliment and wasn't one.",
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
    "There was a locker search. Yours was fine, which wasn't true of everybody's.",
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
    "You weren't in anything this year. The afternoons were long and entirely your own.",
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
# They are deliberately few and low-weight. The adult libraries arrive with the
# systems that give an adult year its shape — school leaving and work
# (0204/0210), health and ageing (0211), money (0301). When those land, this
# block should shrink, not grow.
#
# TICKET 0211b REWROTE ALL OF THESE, and they are the reason the ticket exists.
# The product owner screenshotted his feed at twenty-eight and every line he
# quoted came from this block:
#
#   "A steady year. The kind that does not make it into the telling."
#   "Kept mostly to a routine this year."
#   "Another year went by without much fanfare."
#
# — *"Nobody talks like that."* He was right. Every one of them described the
# SHAPE of a year rather than anything in it, which is the failure the whole
# voice pass is about (writing rules 10).
#
# They are also the most-read lines in the game. An adult year usually has
# nothing else in it, so these eight fire over and over for sixty years — which
# is why each one now carries three variants rather than one. Eight lines on a
# two-year cooldown is the same handful forever; twenty-four is a life.
# =============================================================================

# Ticket 0413 — the quiet-year events, which were doing a job they were never
# written for.
#
# These are labelled placeholders and the roadmap has listed them as a hole
# since 0209. What nobody measured until 0412 is how much of a life they were
# carrying: **98.6% of everything that fired at eighteen, and 35.2% of
# everything between eighteen and twenty-two**, because the adult catalog barely
# existed that early and the selector draws from what is there.
#
# A quiet year is real content — `love.quiet-year` is deliberate and good. The
# defect was the denominator, so the fix is the friendship tranche below rather
# than deleting these: the ids stay (a save records what fired, CORE_RULES 13),
# the weight comes down to what a quiet year is worth against a year with
# something in it, and five lines that broke writing rule 10 are rewritten.
#
# Rule 10 is "never summarize the year — name a thing that happened", and
# "Nothing happened this year worth telling anybody about" is the purest
# possible violation of it: it is the writer saying there was nothing to write.
# The validator's VAGUE table did not catch these because it was built from the
# lines the product owner quoted, and he never saw these — they were buried
# under a childhood's worth of better content until the year he left school.
E("adult.placeholder.1", "random", [
    "Same job, same apartment, same weekends.",
    "Renewed the lease without reading it and stayed another year.",
    "You meant to do more with the year than you did.",
], age_min=18, weight=4, cooldown=2)

E("adult.placeholder.2", "random", [
    "Same coffee, same walk, most mornings.",
    "Ate lunch at the same desk about two hundred times.",
    "You had a routine and you mostly stuck to it.",
], age_min=18, weight=4, cooldown=2)

E("adult.placeholder.3", "random", [
    "Quiet year. After the last few, you'd take it.",
    "Got through twelve months without one phone call you dreaded.",
    "Nobody needed anything from you in a hurry, all year.",
], age_min=18, weight=4, cooldown=2)

E("adult.placeholder.4", "random", [
    "Read four books and abandoned nine, which is about your average.",
    "Started three things and finished one.",
    "Went out less than last year and didn't really miss it.",
], age_min=18, weight=4, cooldown=2)

E("adult.placeholder.5", "random", [
    "Made a bunch of plans and kept about half of them.",
    "Said yes to things you meant to say no to.",
    "Kept meaning to call people back and mostly didn't.",
], age_min=18, weight=4, cooldown=2)

E("adult.placeholder.6", "random", [
    "The year went fast. They'd started doing that.",
    "You looked up and it was somehow October.",
    "Blinked and it was over.",
], age_min=25, weight=4, cooldown=2)

E("adult.placeholder.7", "random", [
    "Spent the year pretty much like the last one, and that was fine.",
    "Realized you'd been doing the same thing for four years. Didn't hate it.",
    "Bought the same brand of everything you bought last year.",
], age_min=25, weight=4, cooldown=2)

E("adult.placeholder.8", "random", [
    "Slower year. You noticed more of it.",
    "Started going to bed early and sleeping better for it.",
    "Less happened, and you didn't mind that either.",
], age_min=55, weight=5, cooldown=2)


# =============================================================================
# ADULT LIFE — Ticket 0409.
#
# WHAT WAS HERE BEFORE: eight events named `adult.placeholder.1` through `.8`,
# twenty-four lines total, covering ages eighteen to death. Measured across
# sixty played lives, HALF of every adult's feed was a line that character had
# already seen — "Same job, same apartment, same weekends" six times in one
# life. Twenty-six of the catalog's 374 events could fire at forty, all of them
# passive, none of them about work, a diagnosis, or anybody dying.
#
# The three holes the roadmap named (findings 3, 4 and 4b) were never really
# about writing. They were about the predicate language: an event cannot be
# about a job if `eligibility` has no way to say "has one", and 0207 and 0208
# had already learned that twice — `partnered` and `hasChildren` were both added
# AFTER events shipped that presupposed a relationship or a child and fired at
# people who had neither. 0409 added `employed`, `jobTrackAny`, `jobYearsAtLeast`,
# `hasCondition`, `conditionAny` and `bereavedWithin` first, and then wrote to
# them.
#
# Every event below is held to `claude/event-writing-rules.md` in full: a named
# person and a real scene, three or more approaches rather than intensities,
# outcomes that can land well or badly and say what happened to whom,
# contractions throughout, and no line that only passes judgment on a year.
# =============================================================================

# ---- work: the decisions an adult never got ---------------------------------

D("career.late-again", "career", [
    "{adult} catches you at five and asks you to stay late again. It's the third time this month, and you already had plans.",
], choices=[
    C("stay", "Stay and get it done", outcomes=[
        OUT(5, "You stayed until nine. {adult} noticed, said so in front of people, and the work was genuinely better for it.",
            FX(stats={"happiness": -2}, stress=4)),
        OUT(4, "You stayed until nine and {adult} had already gone home by seven. Nobody mentioned it again.",
            FX(stats={"happiness": -6}, stress=6)),
    ]),
    C("say-no", "Tell {adultThem} you can't tonight", outcomes=[
        OUT(5, "You said you had something on. {adult} said fine, and meant it — you'd never said no before, so it landed as a fact rather than a problem.",
            FX(stats={"happiness": 4, "willpower": 3})),
        OUT(3, "You said no. {adult} said 'sure' in a way that wasn't sure, and gave the next good piece of work to somebody else.",
            FX(stats={"happiness": -4})),
    ]),
    C("half", "Offer to finish it in the morning", outcomes=[
        OUT(6, "You offered to come in early instead. {adult} took it, and you got the whole thing done by ten with a clear head.",
            FX(stats={"happiness": 2, "smarts": 1}, stress=1)),
        OUT(3, "You offered the morning. It turned out it genuinely had to be that night, and somebody else did it badly.",
            FX(stats={"happiness": -3}, stress=2)),
    ]),
], age_min=19, employed=True, person_tokens=["adult"], weight=10, cooldown=4)

D("career.credit", "career", [
    "{adult} presented your work in a meeting and said 'we' the whole way through. Two people afterwards congratulated {adultThem} on it.",
], choices=[
    C("private", "Talk to {adultThem} privately", outcomes=[
        OUT(6, "You caught {adultThem} at the coffee machine and said it plainly. {AdultThey} went red, and sent a correction to the whole thread within the hour.",
            FX(stats={"happiness": 5, "charisma": 3, "willpower": 2})),
        OUT(4, "{adult} said you were being sensitive and that it was a team effort. You'd been the team.",
            FX(stats={"happiness": -6}, stress=3)),
    ]),
    C("boss", "Take it to your manager", outcomes=[
        OUT(4, "Your manager already knew whose it was, told you so, and started sending you to the meetings directly.",
            FX(stats={"happiness": 7, "charisma": 2})),
        OUT(5, "Your manager said to sort it out between you. Now two people were annoyed with you instead of one.",
            FX(stats={"happiness": -7}, stress=5)),
    ]),
    C("nothing", "Let it go and keep the receipts", outcomes=[
        OUT(6, "You said nothing and quietly started copying yourself on everything. It came in useful in March.",
            FX(stats={"willpower": 3, "smarts": 2}, stress=3)),
        OUT(4, "You said nothing, and it happened twice more. By the third time you'd stopped bringing your good ideas to that room.",
            FX(stats={"happiness": -8}, stress=4)),
    ]),
], age_min=21, employed=True, person_tokens=["adult"], weight=9, cooldown=6)

D("career.mistake", "career", [
    "You got a number wrong and it went out to a client. {adult} spotted it before anybody else did, and is looking at you.",
], choices=[
    C("own", "Own it and tell your manager yourself", outcomes=[
        OUT(7, "You walked in and said it before anybody asked. Your manager fixed it in a phone call and told you that owning it was the whole reason they'd keep you.",
            FX(stats={"happiness": 3, "willpower": 4, "charisma": 2}, stress=3)),
        OUT(3, "You owned it. It still cost the company money, and it followed you around for about six months.",
            FX(stats={"happiness": -6, "willpower": 1}, stress=6)),
    ]),
    C("fix", "Fix it quietly before anybody notices", outcomes=[
        OUT(5, "You fixed it, resent it, and nobody ever knew. You also didn't sleep much that week.",
            FX(stats={"happiness": -2, "smarts": 2}, stress=6)),
        OUT(4, "You tried to fix it quietly and the client had already read the first one. Getting caught covering it up was worse than the mistake.",
            FX(stats={"happiness": -9}, stress=8)),
    ]),
    C("ask", "Ask {adult} what to do", outcomes=[
        OUT(6, "{adult} had made the same mistake in {adultTheir} first year, walked you through the fix, and never brought it up again.",
            FX(stats={"happiness": 4, "smarts": 3, "charisma": 2}, stress=2)),
        OUT(3, "{adult} told the manager before you got there. Technically that's what you asked for.",
            FX(stats={"happiness": -5}, stress=5)),
    ]),
], age_min=19, employed=True, person_tokens=["adult"], weight=9, cooldown=6)

D("career.train", "career", [
    "They've hired {adult}, who is new and about twelve, and asked you to show {adultThem} how everything works. It's on top of your own work.",
], choices=[
    C("properly", "Teach {adultThem} properly", outcomes=[
        OUT(7, "You gave it real time. Six months later {adult} was good, said so to your manager, and you found you liked explaining things.",
            FX(stats={"happiness": 6, "charisma": 4, "smarts": 2}, stress=3)),
        OUT(3, "You gave it real time and {adult} left in April for somewhere that paid more.",
            FX(stats={"happiness": -4}, stress=3)),
    ]),
    C("minimum", "Show {adultThem} the basics", outcomes=[
        OUT(6, "You did the tour, handed over the login, and kept your afternoons. {adult} worked it out fine.",
            FX(stats={"happiness": 1})),
        OUT(4, "You did the minimum and {adult} made a mess of something in week three that took you two days to undo.",
            FX(stats={"happiness": -4}, stress=5)),
    ]),
    C("push-back", "Say you have no hours", outcomes=[
        OUT(5, "Your manager agreed, moved two things off your plate, and gave the training to somebody with room for it.",
            FX(stats={"happiness": 4, "willpower": 3})),
        OUT(4, "Your manager said everybody's busy. You did it anyway, later, and resented it.",
            FX(stats={"happiness": -5}, stress=6)),
    ]),
], age_min=23, employed=True, job_years_at_least=2, person_tokens=["adult"], weight=8, cooldown=8)

D("career.leaving-drinks", "career", [
    "{adult} is leaving on Friday after eleven years. There's a card going around and drinks after, and you've got an early start.",
], choices=[
    C("go", "Go to the drinks", outcomes=[
        OUT(7, "You went. {adult} told a story about the old building that you'd never heard, and you ended up talking to people you'd sat near for years.",
            FX(stats={"happiness": 7, "charisma": 3})),
        OUT(3, "You went, stayed an hour, and spent most of it in a loud room next to somebody from a floor you'd never visited.",
            FX(stats={"happiness": -1})),
    ]),
    C("card", "Sign the card and head home", outcomes=[
        OUT(6, "You wrote something real in the card rather than 'all the best'. {adult} emailed you about it a week later.",
            FX(stats={"happiness": 3, "charisma": 1})),
        OUT(4, "You signed it, went home, and felt odd about it for a couple of days.",
            FX(stats={"happiness": -2})),
    ]),
    C("lunch", "Take {adultThem} to lunch instead", outcomes=[
        OUT(7, "You took {adultThem} out on the Thursday, just the two of you. {AdultThey} said it was the only part of the week {adultThey}'d actually enjoyed.",
            FX(stats={"happiness": 8, "charisma": 3})),
    ]),
], age_min=25, employed=True, job_years_at_least=3, person_tokens=["adult"], weight=7, cooldown=10)

# ---- work: the years in between ---------------------------------------------

E("career.long-tenure", "career", [
    "Somebody asked how long you'd been there and the number surprised you both.",
    "You're now the person who knows where everything's kept.",
    "New people started asking you how things work before they ask anybody else.",
], age_min=26, employed=True, job_years_at_least=6, weight=9, cooldown=3,
   effects=FX(stats={"charisma": 1}))

E("career.bad-week", "career", [
    "Two people quit in the same week and their work landed on your desk.",
    "The system went down on a Tuesday and stayed down. Everyone ate lunch at their desks.",
    "Spent most of a month on something that got cancelled in a ten-minute meeting.",
], age_min=20, employed=True, weight=8, cooldown=2,
   effects=FX(stats={"happiness": -3}, stress=5))

E("career.good-week", "career", [
    "Finished something hard and nobody had to fix it afterward.",
    "Got an email from somebody senior who'd noticed. Read it more than once.",
    "Had a run of about three weeks where the work just went well.",
], age_min=20, employed=True, weight=8, cooldown=2,
   effects=FX(stats={"happiness": 4}, stress=-2))

E("career.commute", "career", [
    "The commute got worse, and it turned out that's most of how a day feels.",
    "Started walking part of the way in. It added twenty minutes and took the edge off.",
    "Moved desks. It shouldn't matter and it did.",
], age_min=20, employed=True, weight=6, cooldown=3)

E("career.care.hard", "career", [
    "A bad one came in on your shift and you thought about it for weeks.",
    "You got good at the part of the job nobody warns you about.",
], age_min=20, employed=True, job_track_any=["care", "medicine", "safety", "veterinary"],
   weight=9, cooldown=3, effects=FX(stats={"happiness": -3}, stress=4))

E("career.trades.hands", "career", [
    "Came home filthy most days and slept like a stone.",
    "Somebody's heating worked because of you, and they were oddly emotional about it.",
], age_min=19, employed=True, job_track_any=["trades", "logistics"],
   weight=9, cooldown=3, physical=True, effects=FX(stats={"health": -1, "happiness": 2}))

E("career.office.meetings", "career", [
    "Counted the meetings one week and then wished you hadn't.",
    "Learned which emails you could leave until Monday.",
], age_min=20, employed=True, job_track_any=["office", "finance", "legal", "tech"],
   weight=8, cooldown=3)

# ---- the body ---------------------------------------------------------------

D("health.appointment", "health", [
    "The only appointment they had is on a Thursday afternoon, and Thursday afternoon is when everything happens at work.",
], choices=[
    C("go", "Take the afternoon and go", outcomes=[
        OUT(7, "You went. They changed one thing about the treatment and it made a real difference by the summer.",
            FX(stats={"health": 4, "happiness": 3})),
        OUT(3, "You went, waited ninety minutes, and were told to carry on as you were.",
            FX(stats={"happiness": -2})),
    ]),
    C("rebook", "Push it to next month", outcomes=[
        OUT(5, "You pushed it. Next month came and you pushed it again.",
            FX(stats={"health": -3}, stress=3)),
        OUT(4, "You pushed it a month and went then. It was fine, and you'd spent four weeks assuming it wouldn't be.",
            FX(stats={"happiness": -2}, stress=2)),
    ]),
    C("tell", "Tell work where you're going", outcomes=[
        OUT(7, "You just said it out loud. Nobody blinked, and two people told you about theirs.",
            FX(stats={"happiness": 5, "health": 3, "willpower": 2})),
        OUT(3, "You said it and somebody made a joke about it that you didn't enjoy.",
            FX(stats={"happiness": -3, "health": 2})),
    ]),
], age_min=25, has_condition=True, employed=True, weight=10, cooldown=4)

D("health.advice", "health", [
    "{adult} heard what you've got and has a lot of thoughts about a thing {adultTheir} cousin did that apparently cured it.",
], choices=[
    C("polite", "Thank {adultThem} and move on", outcomes=[
        OUT(7, "You said thanks and asked about {adultTheir} weekend. {AdultThey} took the hint and it never came up again.",
            FX(stats={"happiness": 1, "charisma": 2})),
    ]),
    C("honest", "Say you'd rather not", outcomes=[
        OUT(5, "You said it kindly and plainly. {adult} apologized, and afterward treated you like a person rather than a case.",
            FX(stats={"happiness": 5, "willpower": 3})),
        OUT(4, "{adult} was hurt and said {adultThey} was only trying to help. You spent a week feeling like the difficult one.",
            FX(stats={"happiness": -5})),
    ]),
    C("look", "Actually look into it", outcomes=[
        OUT(3, "You looked it up. There was something in it, you asked your doctor, and they adjusted one thing.",
            FX(stats={"health": 3, "smarts": 2, "happiness": 3})),
        OUT(7, "You lost an evening to it and came out the other side knowing it was nonsense.",
            FX(stats={"happiness": -2, "smarts": 1})),
    ]),
], age_min=25, has_condition=True, person_tokens=["adult"], weight=8, cooldown=6)

E("health.living-with-it", "health", [
    "You worked out which mornings are the bad ones and stopped scheduling anything before ten.",
    "Got a better chair, which felt like giving in until the second week.",
    "Learned the difference between a bad day and a bad week, and stopped panicking at the first one.",
    "Keep the tablets by the kettle now, because that's the one thing you never forget to do.",
], age_min=28, has_condition=True, weight=10, cooldown=2,
   effects=FX(stats={"smarts": 1}, stress=-2))

E("health.back", "health", [
    "Picked something up wrong and paid for it for two weeks.",
    "Found the one way of sitting that doesn't hurt, and defended that chair.",
], age_min=28, condition_any=["cond.back", "cond.spine"], weight=9, cooldown=2,
   physical=True, effects=FX(stats={"happiness": -3}))

E("health.breath", "health", [
    "Stopped taking the stairs at work and hoped nobody noticed.",
    "Got winded doing something you did without thinking about five years ago.",
], age_min=30, condition_any=["cond.chest", "cond.lungs", "cond.heart"], weight=9, cooldown=2,
   physical=True, effects=FX(stats={"happiness": -3}))

E("health.good-stretch", "health", [
    "Had a good run of months where you barely thought about it.",
    "A checkup came back better than the last one, and you read the letter twice.",
], age_min=28, has_condition=True, weight=7, cooldown=3,
   effects=FX(stats={"happiness": 5, "health": 2}, stress=-3))

# ---- losing somebody --------------------------------------------------------

D("loss.the-house", "loss", [
    "The house has to be cleared by the end of the month, and nobody else is going to do it.",
], choices=[
    C("alone", "Do it yourself, slowly", outcomes=[
        OUT(6, "You took four weekends over it. You found a shoebox of photographs you'd never seen and sat on the floor with it until it got dark.",
            FX(stats={"happiness": 3, "willpower": 3}, stress=4)),
        OUT(4, "You did it alone and it took everything you had. You didn't want to talk to anybody for about a month afterward.",
            FX(stats={"happiness": -6}, stress=8)),
    ]),
    C("help", "Ask people to help", outcomes=[
        OUT(7, "Four people turned up on the Saturday. It was done by three, and somebody brought sandwiches, and it was almost a good day.",
            FX(stats={"happiness": 6, "charisma": 3}, stress=2)),
        OUT(3, "Two people said yes and one turned up. You noticed which was which for a long time afterward.",
            FX(stats={"happiness": -4}, stress=5)),
    ]),
    C("pay", "Pay somebody to clear it", outcomes=[
        OUT(6, "Paid a firm $1,400 to clear it. Done in a day, and you were fine about that right up until you weren't.",
            FX(stats={"happiness": -2}, cash=CASH(-1400, "clearing the house"), stress=3)),
    ]),
], age_min=22, bereaved_within=1, weight=12, cooldown=10)

D("loss.the-anniversary", "loss", [
    "It's a year this week. {adult} from work has no idea and has asked you to something on exactly that day.",
], choices=[
    C("say", "Tell {adultThem} why you can't", outcomes=[
        OUT(7, "You told {adultThem}. {adult} was gentle about it, moved the whole thing, and checked on you that Friday.",
            FX(stats={"happiness": 5, "charisma": 2})),
        OUT(3, "You told {adultThem} and {adultThey} didn't know what to say, so {adultThey} said nothing, and it was awkward for a week.",
            FX(stats={"happiness": -3})),
    ]),
    C("go", "Go anyway", outcomes=[
        OUT(5, "You went. It was a decent distraction and you were glad you hadn't sat at home.",
            FX(stats={"happiness": 3})),
        OUT(5, "You went and spent the whole evening somewhere else in your head.",
            FX(stats={"happiness": -5}, stress=4)),
    ]),
    C("alone", "Make an excuse and keep the day", outcomes=[
        OUT(7, "You said you were busy and spent the day the way you wanted to. It was a hard day and it was yours.",
            FX(stats={"happiness": 2, "willpower": 3}, stress=2)),
    ]),
], age_min=22, bereaved_within=2, person_tokens=["adult"], weight=9, cooldown=8)

E("loss.the-first-year", "loss", [
    "Went to call them about something small before you remembered.",
    "Their handwriting turned up on the back of an envelope in a drawer.",
    "Somebody asked how you were and you said fine, which was mostly true by then.",
    "Caught yourself telling one of their stories as though it were yours.",
], age_min=20, bereaved_within=1, weight=12, cooldown=1,
   effects=FX(stats={"happiness": -4}, stress=3))

E("loss.later", "loss", [
    "Cooked something the way they used to and got it nearly right.",
    "Realized you'd gone a whole week without thinking about it, and felt strange about that.",
    "Started answering the phone the way they did, which everybody noticed except you.",
], age_min=22, bereaved_within=6, weight=8, cooldown=3,
   effects=FX(stats={"happiness": 1}))

# ---- work, continued --------------------------------------------------------

D("career.raise", "career", [
    "You've been on the same money for three years and you know what {adult} makes for the same work. Your review is on Tuesday.",
], choices=[
    C("number", "Ask for a specific number", outcomes=[
        OUT(6, "You named a figure and then shut up. They came back with most of it, and you wished you'd asked sooner.",
            FX(stats={"happiness": 8, "charisma": 4, "willpower": 3})),
        OUT(4, "You named a figure. They said the budget was set in March and they'd revisit it. They didn't.",
            FX(stats={"happiness": -6}, stress=3)),
    ]),
    C("hint", "Hint that you're underpaid", outcomes=[
        OUT(7, "You danced around it. They said they'd look into it, and that was the end of that.",
            FX(stats={"happiness": -4})),
        OUT(3, "You hinted and your manager, to their credit, finished the sentence for you and fixed it.",
            FX(stats={"happiness": 6, "charisma": 2})),
    ]),
    C("offer", "Go and get another offer first", outcomes=[
        OUT(5, "You interviewed elsewhere, got an offer, and took it back. They matched it in a day, which told you something.",
            FX(stats={"happiness": 6, "smarts": 3, "willpower": 3}, stress=5)),
        OUT(4, "You got the other offer and they let you go take it. It was better anyway.",
            FX(stats={"happiness": 4, "willpower": 4}, stress=6)),
        OUT(3, "You spent four months interviewing, got nothing, and came back to the same desk quieter than you left it.",
            FX(stats={"happiness": -7}, stress=7)),
    ]),
], age_min=23, employed=True, job_years_at_least=3, person_tokens=["adult"], weight=9, cooldown=8)

D("career.friend-let-go", "career", [
    "They let {adult} go on Wednesday with no warning. You sat opposite {adultThem} for years, and nobody's saying anything about it.",
], choices=[
    C("call", "Call {adultThem} that night", outcomes=[
        OUT(8, "You called. {AdultThey} hadn't told anybody yet and talked for an hour. You stayed friends long after you'd both left that place.",
            FX(stats={"happiness": 5, "charisma": 4})),
    ]),
    C("ask", "Ask your manager what happened", outcomes=[
        OUT(5, "You asked straight out. Your manager told you more than they should have, and you understood the place better afterward.",
            FX(stats={"smarts": 3, "happiness": -2})),
        OUT(5, "You asked and got a wall of phrases about restructuring. You went quiet in meetings for a month.",
            FX(stats={"happiness": -6}, stress=5)),
    ]),
    C("head-down", "Keep your head down", outcomes=[
        OUT(6, "You said nothing and got on with it. It was the sensible thing and it sat badly for a while.",
            FX(stats={"happiness": -4}, stress=4)),
    ]),
], age_min=24, employed=True, person_tokens=["adult"], weight=8, cooldown=9)

E("career.first-day", "career", [
    "First week somewhere new. Spent most of it working out where the mugs are and who to ask about anything.",
    "Started a new job and came home exhausted from doing almost nothing.",
], age_min=18, employed=True, job_years_at_most=0, weight=12, cooldown=1,
   effects=FX(stats={"happiness": 3}, stress=4))

E("career.second-year", "career", [
    "Stopped needing to think about how to do most of it, which freed up room to notice other things.",
    "Got fast enough at the job that people started giving you more of it.",
], age_min=19, employed=True, job_years_at_least=1, job_years_at_most=3, weight=9, cooldown=2,
   effects=FX(stats={"smarts": 1, "charisma": 1}))

E("career.reorg", "career", [
    "There was a reorganization. Your job was the same afterward with a different word on it.",
    "Got a new manager, the third in two years. Explained your whole job again from the start.",
], age_min=22, employed=True, weight=8, cooldown=3,
   effects=FX(stats={"happiness": -3}, stress=4))

E("career.friend-at-work", "career", [
    "Made an actual friend at work, which you'd stopped expecting to happen.",
    "There's one person there you'd still see if you both left, and you both know it.",
], age_min=20, employed=True, job_years_at_least=2, weight=8, cooldown=4,
   effects=FX(stats={"happiness": 6, "charisma": 2}, stress=-2))

E("career.thankless", "career", [
    "Did the part of the job that only gets noticed when it goes wrong. It didn't go wrong.",
    "Fixed something nobody knew was broken and told nobody about it.",
], age_min=20, employed=True, weight=7, cooldown=3)

E("career.money-tight", "career", [
    "The paycheck stopped covering what it used to and nothing about the job had changed.",
    "Worked out what you actually earn per hour and put the calculator away.",
], age_min=20, employed=True, weight=7, cooldown=4,
   effects=FX(stats={"happiness": -4}, stress=4))

E("career.retail.shift", "career", [
    "Somebody shouted at you about something that wasn't yours to fix, and you were fine, and then you weren't.",
    "Learned which regulars to greet and which to leave alone.",
], age_min=18, employed=True, job_track_any=["retail", "food", "hospitality", "sales"],
   weight=9, cooldown=3, effects=FX(stats={"happiness": -2, "charisma": 2}))

E("career.teach.year", "career", [
    "One of them finally got it in March, and you thought about that for the rest of the year.",
    "Spent your own money on things for the room again and didn't mention it.",
], age_min=22, employed=True, job_track_any=["education"], weight=9, cooldown=3,
   effects=FX(stats={"happiness": 4}))

E("career.creative.work", "career", [
    "Made something you were proud of and somebody changed it before it went out.",
    "Got a brief so vague you invented the whole thing, and they loved it.",
], age_min=20, employed=True, job_track_any=["creative"], weight=9, cooldown=3,
   effects=FX(stats={"happiness": 2}))

E("career.public.work", "career", [
    "Spent a year on something that will take another four, and explained that to a room that wanted it in one.",
    "A thing you'd worked on for years finally opened, and almost nobody knew you'd been near it.",
], age_min=22, employed=True, job_track_any=["public", "safety"], weight=9, cooldown=3,
   effects=FX(stats={"happiness": 2, "willpower": 1}))

E("career.out-of-work", "career", [
    "Nothing came of any of the applications. You stopped counting them around forty.",
    "Had two interviews and heard back from neither.",
    "Filled the days with things that didn't cost anything.",
], age_min=20, age_max=64, employed=False, weight=10, cooldown=1,
   effects=FX(stats={"happiness": -5}, stress=5))

E("career.out-of-work-ok", "career", [
    "Not working turned out to suit you for a while. You got a lot of sleep and read more than you had in years.",
    "Took the year off on purpose and only felt strange about it in the evenings.",
], age_min=22, age_max=64, employed=False, weight=6, cooldown=4,
   effects=FX(stats={"happiness": 3, "health": 2}, stress=-4))

# ---- the body, continued ----------------------------------------------------

D("health.the-diagnosis", "health", [
    "They've told you what it is, and they've given you a leaflet, and you're standing in the parking lot holding it.",
], choices=[
    C("read", "Read everything you can find", outcomes=[
        OUT(6, "You read for three weeks and came out understanding it. Your next appointment was a conversation between two people who both knew the subject.",
            FX(stats={"smarts": 4, "happiness": 2, "willpower": 3}, stress=2)),
        OUT(4, "You read until two in the morning most nights and frightened yourself with things that were never going to happen to you.",
            FX(stats={"happiness": -7}, stress=8)),
    ]),
    C("tell", "Tell the people close to you", outcomes=[
        OUT(7, "You told them. It was a hard evening and you slept properly for the first time in a week afterward.",
            FX(stats={"happiness": 5, "charisma": 2}, stress=-3)),
        OUT(3, "You told them and then spent months managing how they felt about it, which wasn't what you needed.",
            FX(stats={"happiness": -4}, stress=5)),
    ]),
    C("carry-on", "Say nothing and carry on", outcomes=[
        OUT(5, "You told nobody and got on with it. It worked, right up until the day it didn't.",
            FX(stats={"willpower": -2, "happiness": -3}, stress=6)),
    ]),
], age_min=28, has_condition=True, weight=10, cooldown=12)

E("health.tired", "health", [
    "Tired in a way that sleeping didn't fix.",
    "Cancelled things twice in a row and hated doing it.",
], age_min=28, has_condition=True, weight=9, cooldown=2,
   effects=FX(stats={"happiness": -3}, stress=3))

E("health.adjust", "health", [
    "They changed the dose and it took about six weeks to feel like yourself again.",
    "Swapped to a different one that doesn't make you sleep all afternoon.",
], age_min=28, has_condition=True, weight=8, cooldown=3,
   effects=FX(stats={"health": 2}))

E("health.knee", "health", [
    "Gave up running. Bought a bike instead and grudgingly liked it.",
    "Worked out which stairs in your own house are the bad ones.",
], age_min=30, condition_any=["cond.knee", "cond.back"], weight=8, cooldown=3,
   physical=True, effects=FX(stats={"happiness": -2}))

E("health.hearing", "health", [
    "Started sitting with your back to the wall in restaurants so you could hear people.",
    "Missed a whole conversation and nodded through it.",
], age_min=40, condition_any=["cond.hearing"], weight=9, cooldown=2,
   effects=FX(stats={"happiness": -3}))

E("health.stomach", "health", [
    "Worked out the short list of things you can eat without regretting it.",
    "Kept a note on your phone of what set it off, which isn't how you wanted to spend a year.",
], age_min=28, condition_any=["cond.stomach", "cond.sugar"], weight=8, cooldown=3,
   effects=FX(stats={"happiness": -2, "smarts": 1}))

E("health.checkup-good", "health", [
    "Had a check-up and everything looked fine.",
    "The doctor said to carry on doing what you're doing, which was nothing in particular.",
], age_min=30, has_condition=False, weight=7, cooldown=4,
   effects=FX(stats={"happiness": 3}))

E("health.aging", "health", [
    "Something started hurting that hadn't before, and then quietly stopped.",
    "Needed glasses for reading and held out about eight months longer than you should have.",
    "Started warming up before doing things you used to just do.",
], age_min=42, weight=9, cooldown=2, physical=True,
   effects=FX(stats={"happiness": -1}))

E("health.good-shape", "health", [
    "Got into the habit of walking after dinner and kept it up all year.",
    "Slept properly for months on end and forgot what the other thing felt like.",
], age_min=25, has_condition=False, weight=8, cooldown=3,
   effects=FX(stats={"health": 3, "happiness": 4}, stress=-3))

E("health.scare", "health", [
    "Had a scare, had it looked at, and it was nothing. You were oddly shaky about it for a week.",
    "Spent four days waiting on a result and did almost nothing else with them.",
], age_min=32, weight=7, cooldown=5,
   effects=FX(stats={"happiness": -4}, stress=6))

E("health.dentist", "health", [
    "Went to the dentist for the first time in years. $380 to fix what that cost you.",
    "Got the tooth sorted that you'd been chewing around since spring. $380.",
], age_min=22, weight=6, cooldown=5,
   effects=FX(cash=CASH(-380, "the dentist"), stats={"health": 1}))

E("health.winter", "health", [
    "Got whatever went round the office and were flat for a week.",
    "Spent February indoors feeling about sixty percent.",
], age_min=20, weight=8, cooldown=2,
   effects=FX(stats={"health": -2, "happiness": -2}))

E("health.walked-it-off", "health", [
    "Did something to your shoulder and decided it would sort itself out. It mostly did.",
    "Hurt your back lifting something stupid and moved carefully for a month.",
], age_min=24, weight=8, cooldown=3, physical=True,
   effects=FX(stats={"health": -2}))

E("health.quit", "health", [
    "Cut out the thing you'd been meaning to cut out, and it stuck this time.",
    "Stopped drinking during the week. Slept better almost immediately and were annoyed about how obvious it was.",
], age_min=25, weight=6, cooldown=6,
   effects=FX(stats={"health": 4, "happiness": 2, "willpower": 3}))

E("health.old-injury", "health", [
    "The old injury turned up again out of nowhere, said hello, and left.",
    "Weather got cold and you found out which parts of you remember things.",
], age_min=45, weight=7, cooldown=3, physical=True,
   effects=FX(stats={"happiness": -2}))

E("health.pace", "health", [
    "Worked out how much you can do in a day and stopped pretending it was more.",
    "Started saying no to the second thing in an evening.",
], age_min=35, weight=7, cooldown=4,
   effects=FX(stats={"smarts": 1}, stress=-3))

E("health.sleep", "health", [
    "Stopped sleeping through and never really got it back.",
    "Woke at four most nights for a couple of months and then it passed.",
], age_min=38, weight=8, cooldown=3,
   effects=FX(stats={"health": -1, "happiness": -2}, stress=3))

E("health.eyes", "health", [
    "Moved the phone further away for a year, then gave in: $210 for reading glasses.",
    "Got your eyes tested and came out $210 lighter with a prescription and a mild grievance.",
], age_min=40, weight=7, cooldown=5,
   effects=FX(cash=CASH(-210, "new glasses")))

# ---- loss, continued --------------------------------------------------------

D("loss.the-things", "loss", [
    "There's a box of their things and one of them should probably go to {adult}, who hasn't asked and won't.",
], choices=[
    C("give", "Take it to {adultThem}", outcomes=[
        OUT(8, "You drove it over. {AdultThey} cried in the doorway and then made you tea, and you stayed three hours.",
            FX(stats={"happiness": 6, "charisma": 3})),
    ]),
    C("keep", "Keep it yourself", outcomes=[
        OUT(6, "You kept it. It's on the shelf where you can see it, and you've stopped feeling guilty about that.",
            FX(stats={"happiness": 3})),
        OUT(4, "You kept it and felt bad about keeping it every time you looked at it.",
            FX(stats={"happiness": -4})),
    ]),
    C("ask", "Ask {adultThem} what {adultThey} wants", outcomes=[
        OUT(7, "You asked. {AdultThey} wanted something completely different and much smaller, and was glad to be asked.",
            FX(stats={"happiness": 5, "charisma": 2})),
    ]),
], age_min=22, bereaved_within=2, person_tokens=["adult"], weight=9, cooldown=10)

E("loss.the-funeral", "loss", [
    "Stood up and said something at the funeral and got through most of it.",
    "Didn't speak at the funeral and thought about what you'd have said for a long time after.",
    "People you hadn't seen in fifteen years turned up, and that helped more than you'd have guessed.",
], age_min=18, bereaved_within=0, weight=14, cooldown=1,
   effects=FX(stats={"happiness": -6}, stress=6))

E("loss.the-paperwork", "loss", [
    "Spent the winter on paperwork nobody warns you about.",
    "Sat on hold for two hours to tell a company that somebody had died.",
], age_min=20, bereaved_within=1, weight=10, cooldown=2,
   effects=FX(stats={"happiness": -4}, stress=5))

E("loss.the-family-after", "loss", [
    "Saw more of your family that year than the five before it.",
    "Somebody in the family said something at the wake that won't be forgotten quickly.",
    "Started calling {sibling} on Sundays, and kept it up.",
], age_min=20, bereaved_within=2, requires=["sibling"], weight=9, cooldown=3,
   effects=FX(stats={"happiness": 2}, relationship={"siblings": 4}))

E("loss.the-date", "loss", [
    "Their birthday came round and you didn't know what to do with the day.",
    "Went to the grave for the first time since, and it was easier than you expected.",
], age_min=20, bereaved_within=4, weight=9, cooldown=2,
   effects=FX(stats={"happiness": -3}))

E("loss.carrying-it", "loss", [
    "Kept their number in your phone. You know you won't delete it.",
    "Found a voicemail you'd never got round to clearing and didn't play it.",
    "Played the voicemail. Twice.",
], age_min=20, bereaved_within=5, weight=8, cooldown=3,
   effects=FX(stats={"happiness": -2}))

E("loss.somebody-else", "loss", [
    "Went to another funeral and found you knew how all of it worked now.",
    "Somebody else lost a parent and came to you about it, because you'd been there.",
], age_min=30, bereaved_within=20, weight=7, cooldown=4,
   effects=FX(stats={"charisma": 2, "happiness": -1}))

E("loss.the-house-sold", "loss", [
    "The house sold. You drove past it once afterward and then stopped doing that.",
    "New people moved in and put a different door on it.",
], age_min=22, bereaved_within=3, weight=8, cooldown=4,
   effects=FX(stats={"happiness": -3}))

E("loss.grateful", "loss", [
    "Realized you'd started doing a thing exactly the way they did it.",
    "Told somebody a story about them and got the whole way through laughing.",
    "Their handwriting turned up in a cookbook and you left the page open for a week.",
], age_min=22, bereaved_within=10, weight=8, cooldown=3,
   effects=FX(stats={"happiness": 2}))

E("loss.the-empty-chair", "loss", [
    "First holiday without them. Everyone was very careful with each other.",
    "Set the table for one more out of habit and left it there.",
], age_min=20, bereaved_within=1, weight=10, cooldown=2,
   effects=FX(stats={"happiness": -5}, stress=4))

E("loss.talking-about-it", "loss", [
    "Told somebody the whole thing properly for the first time, start to finish.",
    "Somebody asked how you were actually doing and waited for the real answer.",
], age_min=20, bereaved_within=3, weight=8, cooldown=3,
   effects=FX(stats={"happiness": 4, "charisma": 2}, stress=-4))

E("loss.harder-than-expected", "loss", [
    "It hit hardest about eight months in, which nobody had mentioned was a thing.",
    "Had a bad few weeks a year after and couldn't have told you why that month.",
], age_min=20, bereaved_within=2, weight=9, cooldown=3,
   effects=FX(stats={"happiness": -6}, stress=6))

E("loss.the-others", "loss", [
    "Started worrying about the ones who are still here, in a way you hadn't before.",
    "Called your family more than you used to and didn't explain why.",
], age_min=22, bereaved_within=4, requires=["anyParent"], weight=8, cooldown=3,
   effects=FX(stats={"happiness": -1}, relationship={"mother": 3, "father": 3}))

E("loss.money-after", "loss", [
    "Paid $2,100 for the headstone out of your own account and didn't tell anybody.",
    "The headstone came to $2,100. Nobody asked and you wouldn't have said.",
], age_min=22, bereaved_within=2, weight=7, cooldown=4,
   effects=FX(cash=CASH(-2100, "the headstone"), stats={"happiness": -2}))

E("loss.moving-on", "loss", [
    "Gave the coat away, finally, to somebody who'd get the wear out of it.",
    "Took the last box down from the spare room and got through it in an afternoon.",
], age_min=22, bereaved_within=6, weight=8, cooldown=4,
   effects=FX(stats={"happiness": 3, "willpower": 2}, stress=-3))

E("loss.young", "loss", [
    "Everybody your age still had both of theirs, and you'd stopped bringing it up.",
    "Found out you were the only one in the room who knew what any of it was like.",
], age_min=20, age_max=35, bereaved_within=5, weight=8, cooldown=4,
   effects=FX(stats={"happiness": -4}))

# ---- friendship, after school ------------------------------------------------
#
# Ticket 0413. 0412 measured the hole this fills and it was not the one the
# roadmap named. Finding 2d said the `friendship` category had six adult events,
# all of them romance, and that is exactly true. What nobody had measured is
# WHERE the hole is:
#
#   an ordinary eighteen-year-old — employed, single, childless, not bereaved,
#   well — had SEVEN reachable events, and five of them were the
#   `adult.placeholder.*` entries. At seventeen they had ninety-nine.
#
# In play that is 98.6% of everything that fired at eighteen being a placeholder,
# six distinct event ids across ninety lives, and 35.2% of everything fired
# between eighteen and twenty-two. The top four things a twenty-year-old read
# were placeholder.2, placeholder.3, placeholder.5 and placeholder.1 — whose text
# includes "Nothing happened this year worth telling anybody about" and "Kept
# meaning to call people back and mostly didn't."
#
# 0409 wrote sixty-seven adult events and took the catalog at forty from 26 to
# 93. It measured at forty, so the cliff at eighteen was invisible to it: the
# year a character leaves school, this game still loses 92% of its content.
#
# So these are weighted into the desert rather than spread flat, and most of them
# are gated on the predicates 0412 added — `hasFriend`, `friendsAtLeast`,
# `friendsAtMost`, `friendshipYearsAtLeast`. An event cannot be about a friend if
# eligibility cannot say "has one" (13.67), and it cannot be about an OLD friend
# if eligibility cannot say how long.

# The year everybody scattered. Weighted hard into 18-22, which is the hole.
E("friend.everybody-left", "friendship", [
    "Everybody went somewhere else in September. You got three texts in October and one in December.",
    "The group that ate lunch together for five years managed one goodbye and then nothing.",
    "{kid} went to another state, two more went to college, and you stayed. That was the year.",
], age_min=18, age_max=26, weight=16, cooldown=5,
   effects=FX(stats={"happiness": -5}, stress=4, bond=0),
   modifiers=[MOD(1.8, age_max=21)])

E("friend.the-one-who-stayed", "friendship", [
    "{kid} stayed in town too. You started getting coffee on Saturdays because there was nobody else to get it with.",
    "You and {kid} were the two who didn't leave, and that turned out to be enough to build something on.",
], age_min=18, age_max=28, has_friend=True, weight=14, cooldown=6,
   effects=FX(stats={"happiness": 6, "charisma": 2}, stress=-4, bond=0),
   modifiers=[MOD(1.7, age_max=22)])

E("friend.saturday-nobody", "friendship", [
    "Had a free Saturday and went through your phone twice without finding anybody to ring.",
    "Sat in the car outside the apartment for a while because going in meant the evening was over.",
], age_min=18, age_max=30, has_friend=False, weight=15, cooldown=3,
   effects=FX(stats={"happiness": -6}, stress=5, bond=0),
   modifiers=[MOD(1.8, age_max=23)])

E("friend.work-friend", "friendship", [
    "{kid} from work turned into somebody you'd text on a Sunday, which is a different thing entirely.",
    "Realized you'd told {kid} at work more about your year than you'd told anybody from school.",
], age_min=18, employed=True, has_friend=True, weight=10, cooldown=5,
   effects=FX(stats={"happiness": 5, "charisma": 2}, stress=-3, bond=0),
   modifiers=[MOD(1.6, age_max=26)])

E("friend.first-place", "friendship", [
    "Spent most of the spring on {kid}'s floor because your own place had nothing in it yet.",
    "You and {kid} split a couch off the sidewalk and carried it eleven blocks. It was a bad couch.",
], age_min=18, age_max=27, has_friend=True, weight=13, cooldown=6,
   effects=FX(stats={"happiness": 5}, stress=-2, bond=0),
   modifiers=[MOD(1.6, age_max=23)])

E("friend.group-chat-died", "friendship", [
    "The group chat went from forty messages a day to somebody posting a photo in March.",
    "Somebody left the group chat and nobody said anything about it, including you.",
], age_min=18, age_max=32, weight=12, cooldown=4,
   effects=FX(stats={"happiness": -4}, stress=2, bond=0),
   modifiers=[MOD(1.6, age_max=24)])

E("friend.knew-you-then", "friendship", [
    "{kid} still calls you by the nickname from ninth grade, and you'd be sorry if {kidThey} stopped.",
    "Spent an evening with {kid} not explaining anything, because {kidThey} was already there for all of it.",
], age_min=22, has_friend=True, friendship_years_at_least=8, weight=8, cooldown=5,
   effects=FX(stats={"happiness": 7}, stress=-5, bond=0))

E("friend.old-friend-visit", "friendship", [
    "{kid} came through town for two days and it was like no time had gone by at all.",
    "Hadn't seen {kid} in four years and you both said the same thing in the parking lot.",
], age_min=24, has_friend=True, friendship_years_at_least=10, weight=8, cooldown=5,
   effects=FX(stats={"happiness": 8}, stress=-6, bond=0))

E("friend.helped-move", "friendship", [
    "Gave up a whole Saturday to carry {kid}'s furniture up three flights. Got pizza and a story out of it.",
    "{kid} showed up with a van at eight in the morning and didn't complain once.",
], age_min=18, has_friend=True, weight=8, cooldown=4, physical=True,
   effects=FX(stats={"happiness": 4, "health": -1, "charisma": 2}, stress=2, bond=2))

E("friend.the-favor", "friendship", [
    "Asked {kid} for something big, and {kidThey} said yes before you'd finished the sentence.",
    "{kid} drove two hours to sit with you for an afternoon, and never brought it up again.",
], age_min=20, has_friend=True, friends_at_least=1, weight=8, cooldown=6,
   effects=FX(stats={"happiness": 8}, stress=-8, bond=3))

E("friend.wedding-guest-friend", "friendship", [
    "Stood at the back of {kid}'s wedding, $180 down on the gift and the room, and got choked up during a reading about nothing.",
    "{kid} got married and put you at the good table. The gift and the hotel came to $180 and you'd have paid double.",
], age_min=23, age_max=45, has_friend=True, weight=7, cooldown=4,
   effects=FX(cash=CASH(-180, "the gift and the hotel"), stats={"happiness": 6}, stress=-2, bond=0),
   modifiers=[MOD(1.5, age_max=32)])

E("friend.stood-up-for-them", "friendship", [
    "{kid} asked you to stand up at the wedding. You wrote the speech nine times and it landed.",
    "{kid} asked you to be the one at the front. You said yes and then panicked for four months.",
], age_min=24, age_max=48, has_friend=True, friendship_years_at_least=6, weight=6,
   rarity="uncommon", cooldown=12,
   effects=FX(stats={"happiness": 9, "charisma": 4}, stress=6, bond=4))

E("friend.their-kids", "friendship", [
    "{kid}'s kid is old enough to remember your name now, which makes you somebody's uncle by adoption.",
    "Spent an afternoon at {kid}'s being climbed on by somebody who wasn't born last time you visited.",
], age_min=27, has_friend=True, weight=7, cooldown=4,
   effects=FX(stats={"happiness": 5}, stress=-3, bond=0))

E("friend.nights-out-stopped", "friendship", [
    "Nobody said the nights out were over. They just moved to lunch, and then to every few months.",
    "Realized the last big night was two years ago and nobody had called it the last one.",
], age_min=26, age_max=42, weight=7, cooldown=5,
   effects=FX(stats={"happiness": -4}, stress=2, bond=0))

E("friend.the-one-you-tell", "friendship", [
    "Something happened and {kid} was the first call, before family, without thinking about it.",
    "You told {kid} before you told anybody, and {kidThey} kept it exactly as long as you needed.",
], age_min=21, has_friend=True, weight=8, cooldown=5,
   effects=FX(stats={"happiness": 7}, stress=-7, bond=2))

E("friend.dinner-at-theirs", "friendship", [
    "Went to {kid}'s for dinner and stayed until one in the morning arguing about something neither of you cared about.",
    "{kid} cooked badly and it was one of the better evenings of the year.",
], age_min=22, has_friend=True, weight=8, cooldown=3,
   effects=FX(stats={"happiness": 5}, stress=-4, bond=0))

E("friend.neighbor-became", "friendship", [
    "The neighbor you'd nodded at for two years turned into somebody you actually knew.",
    "Ended up in {kid}'s kitchen after a power cut and kept going round after the lights came back.",
], age_min=20, has_friend=True, weight=7, cooldown=6,
   effects=FX(stats={"happiness": 5, "charisma": 2}, stress=-3, bond=0))

E("friend.standing-thing", "friendship", [
    "You and {kid} have a Thursday now. Neither of you arranged it and neither of you misses it.",
    "The five-a-side turned into the same eight people every week for a year.",
], age_min=21, has_friend=True, friends_at_least=2, weight=8, cooldown=4, physical=True,
   effects=FX(stats={"happiness": 6, "health": 2}, stress=-5, bond=0))

E("friend.comparing", "friendship", [
    "{kid} bought a house and you spent a week doing arithmetic you didn't enjoy.",
    "Everybody's year looked better than yours from the outside, which is where you were standing.",
], age_min=24, has_friend=True, weight=7, cooldown=4,
   effects=FX(stats={"happiness": -5}, stress=5, bond=0))

E("friend.quietly-drifted", "friendship", [
    "You and {kid} didn't fall out. The last message just sat there for eight months.",
    "Went to text {kid} and realized you didn't know what {kidTheir} life looked like any more.",
], age_min=22, weight=8, cooldown=4,
   effects=FX(stats={"happiness": -5}, stress=3, bond=-7))

E("friend.the-call", "friendship", [
    "{kid} called at eleven at night, which {kidThey} never does, and you were up until three.",
    "The phone went at a strange hour with {kid}'s name on it and you knew before you answered.",
], age_min=22, has_friend=True, weight=7, cooldown=5,
   effects=FX(stats={"happiness": -3, "willpower": 1}, stress=7, bond=0))

E("friend.their-good-news", "friendship", [
    "{kid} got the thing {kidThey} had been after for years, and you were happy about it with no asterisk.",
    "{kid} called with good news and you shouted in a parking lot like somebody much younger.",
], age_min=21, has_friend=True, weight=8, cooldown=4,
   effects=FX(stats={"happiness": 7}, stress=-4, bond=0))

E("friend.covered-for-you", "friendship", [
    "{kid} covered for you without being asked and then wouldn't let you thank {kidThem} properly.",
    "You dropped something badly and {kid} picked it up before anybody else noticed it was down.",
], age_min=20, has_friend=True, weight=7, cooldown=5,
   effects=FX(stats={"happiness": 6}, stress=-6, bond=3))

E("friend.no-effort", "friendship", [
    "You and {kid} went six months without speaking and picked it up mid-sentence.",
    "{kid} is the one who needs no keeping up, and you'd struggle to say why it works.",
], age_min=26, has_friend=True, friendship_years_at_least=12, weight=7, cooldown=5,
   effects=FX(stats={"happiness": 6}, stress=-5, bond=0))

E("friend.only-one", "friendship", [
    "Worked out you had exactly one person you'd call in an emergency, and {kidThey} lives four hours away.",
    "You have {kid}, and after {kid} the list stops. Some years that's fine.",
], age_min=22, friends_at_most=1, has_friend=True, weight=8, cooldown=4,
   effects=FX(stats={"happiness": -3}, stress=4, bond=0))

E("friend.crowded-year", "friendship", [
    "Four separate people wanted the same Saturday and you were pleased about the problem.",
    "Spent the year turning things down, which was new and which you didn't hate.",
], age_min=22, friends_at_least=3, weight=7, cooldown=4,
   effects=FX(stats={"happiness": 6, "charisma": 2}, stress=3, bond=0))

E("friend.nobody-new", "friendship", [
    "Didn't meet one new person all year. Not a bad year, just a closed one.",
    "Went through the whole year seeing the same four people and nobody else at all.",
], age_min=25, has_friend=False, weight=8, cooldown=3,
   effects=FX(stats={"happiness": -4}, stress=3, bond=0))

E("friend.reconnected", "friendship", [
    "{kid} messaged out of nowhere after years and it turned into a standing phone call.",
    "Ran into {kid} in a supermarket and you were both still there forty minutes later.",
], age_min=28, weight=7, cooldown=6,
   effects=FX(stats={"happiness": 7, "charisma": 2}, stress=-5, bond=4))

E("friend.advice-ignored", "friendship", [
    "Told {kid} exactly what was going to happen. It happened, and you didn't say anything about it.",
    "{kid} asked what you thought, listened properly, and then did the other thing.",
], age_min=23, has_friend=True, weight=7, cooldown=5,
   effects=FX(stats={"happiness": -3, "smarts": 1}, stress=3, bond=-2))

E("friend.older-friend", "friendship", [
    "{kid} is fifteen years older and treats you like an equal, which is most of why you keep going round.",
    "Ended up with a friend old enough to have done all of it already, and generous about saying so.",
], age_min=21, has_friend=True, weight=7, cooldown=6,
   effects=FX(stats={"happiness": 5, "smarts": 2}, stress=-4, bond=0))

E("friend.funeral-of-a-friend", "friendship", [
    "Buried somebody your own age and spent the drive home doing sums you didn't want the answers to.",
    "{kid}'s service was full of people who all knew a different version of {kidThem}.",
], age_min=40, has_friend=True, weight=6, rarity="uncommon", cooldown=8,
   effects=FX(stats={"happiness": -9, "health": -1}, stress=12, bond=0))

E("friend.last-ones-left", "friendship", [
    "Two of you left who remember the house on the corner, and one of you isn't well.",
    "Worked out you're the last person alive who was in that room, which is a strange job to have.",
], age_min=62, weight=7, cooldown=5,
   effects=FX(stats={"happiness": -5}, stress=5, bond=0))

E("friend.late-life-friend", "friendship", [
    "Made a proper friend at seventy, which you'd assumed was finished as a thing that happens.",
    "{kid} started sitting at your table and it turned into the best part of the week.",
], age_min=66, weight=8, cooldown=6,
   effects=FX(stats={"happiness": 8}, stress=-6, bond=0))


# The situations an eighteen-year-old actually has, which is the thinnest year in
# the game: nine reachable events before this ticket, five of them placeholders.
# A character this age has no career history, no children and no conditions, so
# most of the adult catalog cannot see them — what they DO have is the year they
# left school, and until now nothing in the catalog was about it.

E("friend.summer-after", "friendship", [
    "The summer after school went on forever and ended all at once, and nobody arranged anything.",
    "Everybody was around for one more summer and you all knew it, so nobody said it.",
], age_min=18, age_max=20, weight=17, cooldown=3,
   effects=FX(stats={"happiness": 2}, stress=-3, bond=0))

E("friend.first-paycheck-out", "friendship", [
    "Spent most of a first paycheck taking {kid} out, because there was finally money to do it with.",
    "Got paid properly for the first time and blew $120 of it on a night with the people still in town.",
], age_min=18, age_max=24, employed=True, has_friend=True, weight=14, cooldown=4,
   effects=FX(cash=CASH(-120, "a night out with friends"), stats={"happiness": 6, "charisma": 2}, stress=-4, bond=0))

E("friend.still-at-home", "friendship", [
    "Still in your old room while half your year posted photos from somewhere else.",
    "Everybody who left came back at Christmas with new accents and you met them at the same bar.",
], age_min=18, age_max=23, weight=15, cooldown=3,
   effects=FX(stats={"happiness": -4}, stress=4, bond=0))

E("friend.gas-station", "friendship", [
    "Ran into {kid} at the gas station. You'd sat next to {kidThem} for four years and had nothing to say.",
    "Saw three people from your year in one afternoon and did the same ninety-second conversation each time.",
], age_min=18, age_max=26, weight=14, cooldown=3,
   effects=FX(stats={"happiness": -2}, stress=2, bond=0))

E("friend.nobody-checks", "friendship", [
    "Nobody takes attendance any more. You could have gone two weeks without speaking to anybody and did.",
    "Worked out that if you stopped turning up anywhere, it would be a while before anybody noticed.",
], age_min=18, age_max=28, has_friend=False, weight=14, cooldown=4,
   effects=FX(stats={"happiness": -6}, stress=6, bond=0))

E("friend.new-crowd", "friendship", [
    "The people you see every week now are nobody you knew a year ago, and you like most of them.",
    "Your whole circle turned over inside eighteen months and you only noticed when somebody asked.",
], age_min=19, age_max=30, has_friend=True, weight=9, cooldown=5,
   effects=FX(stats={"happiness": 5, "charisma": 2}, stress=-2, bond=0))


# ---- friendship: the decisions an adult never got ---------------------------
#
# ZERO before this ticket, against thirteen for a child. Measured across ninety
# lives, every decision ever raised to an adult was career (3,029), health (392)
# or loss (119) — the three categories 0409 wrote. Nobody has ever been asked a
# question about a friend after seventeen.

D("d.friend.loan", "friendship", [
    "{kid} asked to borrow $400 and was embarrassed about asking. You've got it, and you know what these turn into.",
], choices=[
    C("lend", "Lend {kidThem} the $400", outcomes=[
        OUT(6, "You lent {kid} the $400 and got it back in three pieces over five months, with a thank-you each time.",
            FX(cash=CASH(-400, "a loan to a friend"), stats={"happiness": 4, "charisma": 2}, stress=2)),
        OUT(4, "You lent {kid} the $400. Neither of you has mentioned it since, and now you can't.",
            FX(cash=CASH(-400, "a loan to a friend"), stats={"happiness": -5}, stress=6)),
    ]),
    C("give", "Give {kidThem} the $400 outright", outcomes=[
        OUT(6, "You told {kid} to forget it, that the $400 wasn't a loan. {KidThey} cried a bit and so did you, later.",
            FX(cash=CASH(-400, "money given to a friend"), stats={"happiness": 6}, stress=-3)),
        OUT(3, "You made the $400 a gift so it couldn't sour. {kid} took it and got strange with you anyway.",
            FX(cash=CASH(-400, "money given to a friend"), stats={"happiness": -3}, stress=4)),
    ]),
    C("no", "Tell {kidThem} you can't", outcomes=[
        OUT(5, "You said no as kindly as you could manage. {kid} said of course, and meant about half of it.",
            FX(stats={"happiness": -4}, stress=5)),
        OUT(4, "You said you couldn't. {kid} sorted it another way and told you about that, once, pointedly.",
            FX(stats={"happiness": -5}, stress=4)),
    ]),
], age_min=21, has_friend=True, person_tokens=["kid"], weight=8, cooldown=7)

D("d.friend.moving-away", "friendship", [
    "{kid} is moving across the country in six weeks. There's a leaving thing on a Friday you're already booked for.",
], choices=[
    C("go", "Cancel the other thing and go", outcomes=[
        OUT(7, "You went. It ran until two, you both said the true things, and the goodbye was a proper one.",
            FX(stats={"happiness": 6, "charisma": 2}, stress=-4)),
        OUT(3, "You went and it was forty people deep. You got nine minutes with {kid} and a hug at the door.",
            FX(stats={"happiness": 1}, stress=2)),
    ]),
    C("own-thing", "Take {kidThem} out on your own instead", outcomes=[
        OUT(7, "You took {kid} for dinner the week before, just the two of you. That's the evening you both remember.",
            FX(stats={"happiness": 8}, stress=-5)),
        OUT(3, "You arranged your own goodbye and {kid} had to move it twice. It happened in a rush at the end.",
            FX(stats={"happiness": 2}, stress=3)),
    ]),
    C("skip", "Keep your plans and text {kidThem}", outcomes=[
        OUT(5, "You sent a long message instead. {kid} replied warmly and you've spoken twice since.",
            FX(stats={"happiness": -3}, stress=2)),
        OUT(5, "You didn't go. That turned out to be the last time everybody was going to be in one room.",
            FX(stats={"happiness": -7}, stress=5)),
    ]),
], age_min=18, has_friend=True, person_tokens=["kid"], weight=14, cooldown=6,
   modifiers=[MOD(1.7, age_max=25)])

D("d.friend.taking-sides", "friendship", [
    "{kid} and {kid2} have fallen out properly, and both of them have now told you their version and waited.",
], choices=[
    C("stay-out", "Stay out of it", outcomes=[
        OUT(6, "You said you weren't picking. It was awkward for a year and you still have both of them.",
            FX(stats={"happiness": -2, "willpower": 4}, stress=6)),
        OUT(4, "You refused to pick and they both decided that was its answer. You saw less of each.",
            FX(stats={"happiness": -6}, stress=7)),
    ]),
    C("pick", "Say who you think is right", outcomes=[
        OUT(5, "You said what you thought. {kid} took it badly for a month and then said you'd been right.",
            FX(stats={"happiness": 3, "charisma": 2, "willpower": 3}, stress=5)),
        OUT(5, "You said what you thought and lost {kid2} over it, cleanly and for good.",
            FX(stats={"happiness": -7}, stress=8)),
    ]),
    C("fix-it", "Try to get them in a room", outcomes=[
        OUT(4, "You got them both to a table. It was terrible for twenty minutes and then it wasn't.",
            FX(stats={"happiness": 8, "charisma": 5}, stress=6)),
        OUT(6, "You tried to fix it and became the third person in the argument. Nobody thanked you.",
            FX(stats={"happiness": -6}, stress=10)),
    ]),
], age_min=22, friends_at_least=2, person_tokens=["kid", "kid2"], weight=7, cooldown=8)

D("d.friend.needs-a-room", "friendship", [
    "{kid} needs somewhere to stay for a few weeks and asked you, which {kidThey} clearly hated doing.",
], choices=[
    C("yes", "Tell {kidThem} to bring a bag", outcomes=[
        OUT(6, "{kid} stayed five weeks, cooked most nights, and left the place better than {kidThey} found it.",
            FX(stats={"happiness": 5, "charisma": 2}, stress=5)),
        OUT(4, "{kid} stayed four months. You love {kidThem} and you were extremely glad when it ended.",
            FX(stats={"happiness": -3, "willpower": -1}, stress=14)),
    ]),
    C("short", "Say yes, but give {kidThem} a date", outcomes=[
        OUT(7, "You said yes with an end date. {kid} was out by it, and the friendship came through clean.",
            FX(stats={"happiness": 4, "willpower": 3}, stress=4)),
        OUT(3, "You set a date and had to enforce it, which neither of you has completely got over.",
            FX(stats={"happiness": -4}, stress=8)),
    ]),
    C("no", "Say you can't have anybody staying", outcomes=[
        OUT(5, "You said no and sent {kid} $250 instead. {KidThey} took the money and not the couch.",
            FX(cash=CASH(-250, "helping a friend out"), stats={"happiness": -2}, stress=4)),
        OUT(5, "You said no. {kid} sorted something out and has never asked you for anything since.",
            FX(stats={"happiness": -6}, stress=5)),
    ]),
], age_min=22, has_friend=True, person_tokens=["kid"], weight=7, cooldown=9)

D("d.friend.lost-touch", "friendship", [
    "{kid}'s name came up and you worked out it's been nine years. You still have the number.",
], choices=[
    C("call", "Call {kidThem} out of nowhere", outcomes=[
        OUT(6, "You rang. It was strange for ninety seconds and then it was completely normal for two hours.",
            FX(stats={"happiness": 8, "charisma": 3}, stress=-5)),
        OUT(4, "You rang and {kidThey} was polite and busy. You left it at that, and it was still worth knowing.",
            FX(stats={"happiness": -2}, stress=3)),
    ]),
    C("write", "Write {kidThem} a proper message", outcomes=[
        OUT(6, "You wrote a long one and sent it. {kid} wrote a longer one back a week later.",
            FX(stats={"happiness": 6, "smarts": 1}, stress=-3)),
        OUT(4, "You wrote it, sent it, and watched it sit unread for two months.",
            FX(stats={"happiness": -4}, stress=4)),
    ]),
    C("leave", "Leave it where it is", outcomes=[
        OUT(5, "You decided some things get to stay finished. It sat with you for a few weeks.",
            FX(stats={"happiness": -3}, stress=2)),
        OUT(5, "You didn't ring. {kid} rang you eight months later and said {kidThey} had nearly not bothered.",
            FX(stats={"happiness": 5}, stress=-2)),
    ]),
], age_min=28, friendship_years_at_least=5, person_tokens=["kid"], weight=8, cooldown=10)

D("d.friend.said-something", "friendship", [
    "{kid} said something about you at a table of six people, as a joke, and nobody else noticed it land.",
], choices=[
    C("now", "Say something about it there and then", outcomes=[
        OUT(4, "You said it lightly and straight. {kid} apologized properly and the table moved on.",
            FX(stats={"happiness": 4, "charisma": 3, "willpower": 3}, stress=4)),
        OUT(6, "You said something and it went cold for an hour. You were right and it cost you the evening.",
            FX(stats={"happiness": -4}, stress=8)),
    ]),
    C("later", "Bring it up with {kidThem} another day", outcomes=[
        OUT(7, "You raised it a week later, on a walk. {kid} hadn't realized, and hasn't done it again.",
            FX(stats={"happiness": 5, "charisma": 2, "willpower": 2}, stress=-2)),
        OUT(3, "You brought it up later and {kid} couldn't remember saying it, which was worse somehow.",
            FX(stats={"happiness": -4}, stress=5)),
    ]),
    C("nothing", "Let it go", outcomes=[
        OUT(6, "You let it go and it genuinely went. {kid} has been a friend for years and gets one.",
            FX(stats={"happiness": 1}, stress=2)),
        OUT(4, "You let it go and then heard it again in March. It stopped being a joke around then.",
            FX(stats={"happiness": -6}, stress=6)),
    ]),
], age_min=21, has_friend=True, person_tokens=["kid"], weight=8, cooldown=7)

D("d.friend.in-trouble", "friendship", [
    "{kid} is in real trouble and hasn't asked for anything. You can see it from where you're standing.",
], choices=[
    C("turn-up", "Turn up at {kidTheir} door", outcomes=[
        OUT(7, "You drove over without arranging it. {kid} let you in, and that was the week it turned.",
            FX(stats={"happiness": 5, "willpower": 3}, stress=9)),
        OUT(3, "You turned up and {kid} wasn't ready to be seen. {KidThey} thanked you for it a year later.",
            FX(stats={"happiness": -3, "willpower": 2}, stress=10)),
    ]),
    C("ask", "Ask {kidThem} straight what's going on", outcomes=[
        OUT(6, "You asked the direct question and waited through the silence. {kid} told you all of it.",
            FX(stats={"happiness": 3, "charisma": 3, "willpower": 2}, stress=8)),
        OUT(4, "You asked and got 'I'm fine' twice. You said you'd ask again, and you did.",
            FX(stats={"happiness": -2, "willpower": 3}, stress=7)),
    ]),
    C("wait", "Stay close and wait to be asked", outcomes=[
        OUT(5, "You stayed in touch and said nothing. {kid} came to you in the end, on {kidTheir} own terms.",
            FX(stats={"happiness": 2, "willpower": 2}, stress=6)),
        OUT(5, "You waited. It got worse first, and you've thought about that year since.",
            FX(stats={"happiness": -8}, stress=12)),
    ]),
], age_min=23, has_friend=True, person_tokens=["kid"], weight=8, cooldown=8)

D("d.friend.nobody-here", "friendship", [
    "You've been in this city a year and know nobody. There's a thing on Thursday full of strangers.",
], choices=[
    C("go-alone", "Go on your own and talk to people", outcomes=[
        OUT(5, "You went alone, talked to four people badly and one person well. That one stuck.",
            FX(stats={"happiness": 6, "charisma": 4, "willpower": 3}, stress=5)),
        OUT(5, "You went, stood near the food for an hour and left. Nobody was unkind and nothing happened.",
            FX(stats={"happiness": -4, "willpower": -1}, stress=6)),
    ]),
    C("join", "Join a weekly thing", outcomes=[
        OUT(7, "You paid $240 for a year of something that met every week. It took two months and then you had people.",
            FX(cash=CASH(-240, "joining something local"), stats={"happiness": 7, "charisma": 3, "health": 1}, stress=-3)),
        OUT(3, "You paid the $240 and went four times. Friendly people, and none of them ever became anything.",
            FX(cash=CASH(-240, "joining something local"), stats={"happiness": -2}, stress=3)),
    ]),
    C("stay-in", "Give it a miss",
      text="You stayed in. It was a good evening and a bad year, and you knew it at the time.",
      effects=FX(stats={"happiness": -5}, stress=4)),
], age_min=18, has_friend=False, weight=14, cooldown=5,
   modifiers=[MOD(1.8, age_max=27)])


# ---- family: the one you came from ------------------------------------------
#
# Ticket 0414, roadmap finding 2e. 0413 filled the cliff at eighteen with
# friendship and named what was left; this is what was left, and it is not a
# thin patch, it is a total zero by construction.
#
# The `family` category has NINETY-ONE events. Eighty of them carry an `ageMax`
# below eighteen and the other eleven are 0208's parenting events gated on
# `hasChildren`. **There is no third group.** So for a childless adult the
# reachable family catalog is exactly nothing, and measured across eighty lives:
#
#   - **56.3% of every adult year in this build is childless**, and
#     **0.0% of those years hold a family event**;
#   - **69.8% of them have a living parent** — she is in the save, she ages, and
#     0212 will eventually kill her, and between the character's eighteenth
#     birthday and her funeral the catalog has not one line about her;
#   - 64.4% of adult years have a living sibling, with the same silence.
#
# The shape of the curve says it plainly: family events run 0% at eighteen, 1.9%
# at thirty and 12.4% at forty, and that rise is ENTIRELY people having children.
# "Family" in this build has meant "you are a parent" and nothing else.
#
# No new predicate was needed, which is a change from the last three tickets:
# `requires` already means a LIVING mother (`Boolean(mother(family)?.alive)`),
# and `relationshipAtLeast` / `relationshipAtMost` already read her warmth. The
# language was ready and nobody had written against it.

E("kin.sunday-call", "family", [
    "{mother} calls most Sundays and you've both got the rhythm of it down to about eleven minutes.",
    "The Sunday call with {mother} went forty minutes because {parentThey} had actual news for once.",
], age_min=18, requires=["mother"], weight=13, cooldown=3,
   effects=FX(stats={"happiness": 3}, relationship={"mother": 2}, stress=-2),
   modifiers=[MOD(1.5, age_max=26)])

E("kin.moved-out-properly", "family", [
    "Came back for a weekend and your room had become the place the ironing lives.",
    "They turned your room into an office inside four months, which was fair and still stung.",
], age_min=18, age_max=30, requires=["anyParent"], weight=15, cooldown=4,
   effects=FX(stats={"happiness": -2}, stress=2),
   modifiers=[MOD(1.8, age_max=23)])

E("kin.first-holiday-back", "family", [
    "Went back for the holidays as a guest rather than somebody who lives there, and felt every bit of it.",
    "Spent four days back at the house and remembered why you left and why you keep going back.",
], age_min=18, age_max=40, requires=["anyParent"], weight=13, cooldown=3,
   effects=FX(stats={"happiness": 2}, relationship={"parents": 2}, stress=2),
   modifiers=[MOD(1.6, age_max=26)])

E("kin.money-from-home", "family", [
    "{mother} put $200 in your account and wrote 'for groceries' like you wouldn't know what it meant.",
    "{father} slipped you $200 at the car and told you not to tell {motherName}.",
], age_min=18, age_max=32, requires=["bothParents"], weight=12, cooldown=4,
   effects=FX(cash=CASH(200, "money from home"), stats={"happiness": 4}, relationship={"parents": 3}, stress=-3),
   modifiers=[MOD(1.7, age_max=24), MOD(0.4, wealth_any=["struggling"])])

E("kin.parent-as-person", "family", [
    "{parent} told you something about {parentTheir} twenties you had genuinely never heard before.",
    "Had a conversation with {parent} where {parentThey} was a person rather than a parent, and it stuck.",
], age_min=20, requires=["anyParent"], weight=12, cooldown=5,
   effects=FX(stats={"happiness": 5, "smarts": 1}, relationship={"parents": 5}, stress=-3))

E("kin.advice-not-taken", "family", [
    "{parent} had opinions about your life and got through every one across one dinner.",
    "{parent} asked about your plans in the voice that means the notes are already written.",
], age_min=18, requires=["anyParent"], weight=12, cooldown=3,
   effects=FX(stats={"happiness": -3}, relationship={"parents": -2}, stress=4),
   modifiers=[MOD(1.5, age_max=28)])

E("kin.parent-getting-older", "family", [
    "{parent} needed help with something {parentThey} used to do without thinking, and neither of you mentioned it.",
    "Noticed {parent} taking the stairs one at a time, and pretended you hadn't.",
], age_min=28, requires=["anyParent"], weight=13, cooldown=3,
   effects=FX(stats={"happiness": -4}, stress=6),
   modifiers=[MOD(1.6, age_min=40)])

E("kin.the-house", "family", [
    "Drove past the old house. Somebody's painted it a color you have feelings about.",
    "The people in your old house have taken the tree out. You sat in the car about it for a minute.",
], age_min=22, weight=11, cooldown=5,
   effects=FX(stats={"happiness": -2}, stress=2))

E("kin.sibling-drift", "family", [
    "You and {sibling} went most of the year without talking and neither of you meant anything by it.",
    "Realized you know what {sibling} does for work and almost nothing else about {siblingTheir} life.",
], age_min=20, requires=["sibling"], weight=12, cooldown=4,
   effects=FX(stats={"happiness": -3}, relationship={"siblings": -3}, stress=2))

E("kin.sibling-close", "family", [
    "{sibling} is the one who gets the joke without the setup, and this was the year you noticed that was rare.",
    "You and {sibling} text nonsense most days, which is more than most people get.",
], age_min=19, requires=["sibling"], rel_at_least={"sibling": 55}, weight=12, cooldown=4,
   effects=FX(stats={"happiness": 6}, relationship={"siblings": 3}, stress=-4))

E("kin.sibling-doing-better", "family", [
    "{sibling} announced something big at dinner and you were happy about it in a complicated way.",
    "Everybody asked {sibling} about {siblingTheir} year first, and you noticed the order.",
], age_min=22, requires=["sibling"], weight=11, cooldown=4,
   effects=FX(stats={"happiness": -4}, relationship={"siblings": -2}, stress=4))

E("kin.sibling-needs-you", "family", [
    "{sibling} called about something real and you dropped what you were doing.",
    "{sibling} turned up at eleven at night and stayed on the couch for three days.",
], age_min=21, requires=["sibling"], weight=11, cooldown=5,
   effects=FX(stats={"happiness": 2}, relationship={"siblings": 6}, stress=7))

E("kin.only-one-left", "family", [
    "{sibling} is the only person alive who remembers the kitchen, and you called about nothing for an hour.",
    "You and {sibling} are what's left of that house, and it changed how you talk to each other.",
], age_min=45, requires=["sibling"], bereaved_within=8, weight=10, cooldown=6,
   effects=FX(stats={"happiness": 3}, relationship={"siblings": 7}, stress=-2))

E("kin.the-cousins", "family", [
    "Went to a family thing and spent it catching up with cousins you see once every four years.",
    "Somebody's wedding put the whole extended family in one room and it was better than expected.",
], age_min=20, weight=11, cooldown=4,
   effects=FX(stats={"happiness": 4, "charisma": 2}, stress=-2))

E("kin.family-group-chat", "family", [
    "The family group chat produced two arguments and one genuinely useful piece of information.",
    "{mother} discovered a new way to forward things and used it forty times in a week.",
], age_min=19, requires=["mother"], weight=11, cooldown=3,
   effects=FX(stats={"happiness": 2}, stress=1))

E("kin.cold-with-parent", "family", [
    "Went the whole year without calling {parent}, and the not-calling took more effort than calling would have.",
    "You and {parent} were civil at a funeral and that was the year's contact.",
], age_min=20, requires=["anyParent"], rel_at_most={"mother": 35}, weight=11, cooldown=4,
   effects=FX(stats={"happiness": -5}, stress=6))

E("kin.parent-proud", "family", [
    "{parent} told somebody else what you do for a living and you heard {parentTheir} voice change.",
    "{parent} kept the clipping. You found it in a drawer years later and had to sit down.",
], age_min=22, requires=["anyParent"], rel_at_least={"mother": 55}, weight=11, cooldown=5,
   effects=FX(stats={"happiness": 8}, relationship={"parents": 4}, stress=-5))

E("kin.becoming-them", "family", [
    "Caught yourself saying a thing {parent} says, in the voice {parentThey} says it in.",
    "Did the sigh {parent} does, at the same kind of moment, and stood there with it.",
], age_min=26, requires=["anyParent"], weight=11, cooldown=5,
   effects=FX(stats={"happiness": 1}, stress=1))

E("kin.holiday-alone", "family", [
    "Spent the holiday on your own and told everybody it was fine, which it mostly was.",
    "Worked the holiday for the extra pay and ate something microwaved at nine at night.",
], age_min=19, age_max=45, has_children=False, weight=12, cooldown=4,
   effects=FX(stats={"happiness": -5}, stress=5),
   modifiers=[MOD(1.5, age_max=27)])

E("kin.nobody-to-tell", "family", [
    "Something good happened and you got halfway through dialing before working out who to tell.",
    "Had news worth sharing and it sat in your phone for two days.",
], age_min=20, has_children=False, weight=11, cooldown=4,
   effects=FX(stats={"happiness": -4}, stress=4))

E("kin.the-asking", "family", [
    "{parent} asked when you're going to settle down, in front of people, for the fourth year running.",
    "Somebody at a family thing asked about kids and the table waited for the answer.",
], age_min=25, age_max=45, has_children=False, requires=["anyParent"], weight=12, cooldown=3,
   effects=FX(stats={"happiness": -4}, stress=6))

E("kin.chosen-family", "family", [
    "Did the holiday with people you're not related to and it was the best one in years.",
    "The table was six people who all had somewhere else they could have been.",
], age_min=22, has_friend=True, weight=11, cooldown=4,
   effects=FX(stats={"happiness": 7}, stress=-6, bond=0))

E("kin.parent-moved", "family", [
    "The house sold and they moved somewhere smaller, and the address you grew up at stopped being one.",
    "{parent} moved closer to {parentTheir} sister and you had to drive four hours to see {parentThem} now.",
], age_min=28, requires=["anyParent"], weight=10, cooldown=8,
   effects=FX(stats={"happiness": -3}, stress=4))

E("kin.taking-care", "family", [
    "You're the one who handles {parentTheir} appointments now, and nobody decided that out loud.",
    "Started driving over twice a week to do things {parent} would once have done before lunch.",
], age_min=38, requires=["anyParent"], weight=12, cooldown=3,
   effects=FX(stats={"happiness": -3, "willpower": -1}, relationship={"parents": 5}, stress=12),
   modifiers=[MOD(1.5, age_min=48)])

E("kin.last-good-visit", "family", [
    "Had a completely ordinary afternoon with {parent} and it turned out to be one worth having had.",
    "{parent} was on good form all weekend. You didn't know it was the last of those.",
], age_min=40, requires=["anyParent"], weight=9, rarity="uncommon", cooldown=8,
   effects=FX(stats={"happiness": 5}, relationship={"parents": 6}, stress=-3))


# ---- family: the questions a grown child gets --------------------------------
#
# Adult family decisions before this ticket: ZERO. Every decision the game had
# ever raised to an adult was career, health, loss, or — since 0413 — friendship.

D("d.kin.parent-needs-money", "family", [
    "{parent} needs $900 and asked you, which {parentThey} has never once done before.",
], choices=[
    C("send", "Send the $900", outcomes=[
        OUT(6, "You sent the $900 and said not to mention it again. {Parent} mentioned it every time you spoke.",
            FX(cash=CASH(-900, "helping a parent out"), stats={"happiness": 3},
               relationship={"parents": 8}, stress=4)),
        OUT(4, "You sent the $900. It turned out to be the first of several, and nobody ever called it that.",
            FX(cash=CASH(-900, "helping a parent out"), stats={"happiness": -3},
               relationship={"parents": 4}, stress=9)),
    ]),
    C("some", "Send what you can spare", outcomes=[
        OUT(6, "You sent $300 and said it was what you had. {Parent} said that was plenty and meant it.",
            FX(cash=CASH(-300, "helping a parent out"), stats={"happiness": 2, "willpower": 3},
               relationship={"parents": 4}, stress=3)),
        OUT(4, "You sent $300 of the $900. It wasn't enough and the gap sat between you for a year.",
            FX(cash=CASH(-300, "helping a parent out"), stats={"happiness": -4},
               relationship={"parents": -3}, stress=7)),
    ]),
    C("ask", "Ask what it's actually for", outcomes=[
        OUT(5, "You asked properly. The real number was smaller and the real problem was bigger.",
            FX(stats={"happiness": -2, "smarts": 2}, relationship={"parents": 3}, stress=8)),
        OUT(5, "You asked and {parent} went quiet and said forget it. {ParentThey} meant that too.",
            FX(stats={"happiness": -6}, relationship={"parents": -6}, stress=9)),
    ]),
], age_min=24, requires=["anyParent"], weight=11, cooldown=8)

D("d.kin.move-them-closer", "family", [
    "{parent} can't really manage the house on {parentTheir} own any more, and the conversation has to happen this year.",
], choices=[
    C("in", "Ask {parentThem} to move in with you", outcomes=[
        OUT(5, "{Parent} moved in. It was harder than you'd pictured and you'd do it again.",
            FX(stats={"happiness": 2, "willpower": 3}, relationship={"parents": 10}, stress=16)),
        OUT(5, "{Parent} moved in, and two adults who love each other found out about sharing a kitchen.",
            FX(stats={"happiness": -6}, relationship={"parents": -4}, stress=20)),
    ]),
    C("nearby", "Find {parentThem} somewhere near you", outcomes=[
        OUT(7, "You found {parentThem} a place ten minutes away for $2,400 in moving costs. Everybody kept their own front door.",
            FX(cash=CASH(-2400, "the move and the deposit"), stats={"happiness": 5, "smarts": 2},
               relationship={"parents": 8}, stress=9)),
        OUT(3, "The move cost $2,400 and {parentThey} hated the new place, and said so, for about a year.",
            FX(cash=CASH(-2400, "the move and the deposit"), stats={"happiness": -4},
               relationship={"parents": -2}, stress=12)),
    ]),
    C("stay", "Leave {parentThem} in the house", outcomes=[
        OUT(5, "You left {parentThem} in the house and drove over a lot. {ParentThey} stayed {parentTheir}self in it.",
            FX(stats={"happiness": 1, "willpower": 2}, relationship={"parents": 5}, stress=14)),
        OUT(5, "You left it. There was a fall in March and you'd already known the house was the problem.",
            FX(stats={"happiness": -9}, relationship={"parents": -2}, stress=18)),
    ]),
], age_min=40, requires=["anyParent"], weight=10, cooldown=12)

D("d.kin.sibling-fallout", "family", [
    "{sibling} said something at a family thing that you're still turning over three weeks later.",
], choices=[
    C("call", "Call {siblingThem} about it", outcomes=[
        OUT(6, "You rang and said it plainly. {SiblingThey} apologized inside two minutes and you both felt stupid.",
            FX(stats={"happiness": 5, "charisma": 2}, relationship={"siblings": 7}, stress=-3)),
        OUT(4, "You rang and it turned into a bigger argument with older material in it.",
            FX(stats={"happiness": -6}, relationship={"siblings": -10}, stress=11)),
    ]),
    C("wait", "Wait for {siblingThem} to raise it", outcomes=[
        OUT(5, "You waited. {SiblingThey} brought it up at Christmas, awkwardly, and that was that.",
            FX(stats={"happiness": 2, "willpower": 1}, relationship={"siblings": 3}, stress=4)),
        OUT(5, "You waited and so did {siblingThey}, and the two of you are still waiting.",
            FX(stats={"happiness": -5}, relationship={"siblings": -6}, stress=6)),
    ]),
    C("parent", "Tell {parent} about it", outcomes=[
        OUT(4, "{Parent} handled it and it was sorted by the weekend, which made you both about twelve again.",
            FX(stats={"happiness": 3}, relationship={"siblings": 2, "parents": -2}, stress=3)),
        OUT(6, "{Parent} took a side. It wasn't the side you expected and now there were three of you in it.",
            FX(stats={"happiness": -7}, relationship={"siblings": -5, "parents": -5}, stress=12)),
    ]),
], age_min=22, requires=["sibling", "anyParent"], weight=10, cooldown=8)

D("d.kin.going-home-for-good", "family", [
    "There's a reason to move back to where you grew up this year, and a reason not to, and both are good ones.",
], choices=[
    C("go", "Move back", outcomes=[
        OUT(5, "You went back, $1,800 down on the move. It was smaller than you remembered and easier than you'd feared.",
            FX(cash=CASH(-1800, "the move back"), stats={"happiness": 5}, relationship={"parents": 7}, stress=8)),
        OUT(5, "You moved back for $1,800 and spent two years explaining to people why you had.",
            FX(cash=CASH(-1800, "the move back"), stats={"happiness": -5}, relationship={"parents": 5}, stress=11)),
    ]),
    C("stay", "Stay where you are", outcomes=[
        OUT(6, "You stayed. It was the right call and you still think about the other one some weeks.",
            FX(stats={"happiness": 2, "willpower": 3}, relationship={"parents": -3}, stress=5)),
        OUT(4, "You stayed, and missed a year at home that turned out to be the last ordinary one.",
            FX(stats={"happiness": -7}, relationship={"parents": -5}, stress=9)),
    ]),
    C("half", "Go back but keep your place", outcomes=[
        OUT(5, "Six months back home with your lease still running cost you $3,200. Exactly right anyway.",
            FX(cash=CASH(-3200, "keeping two places going"), stats={"happiness": 4, "smarts": 2},
               relationship={"parents": 6}, stress=10)),
        OUT(5, "Running two places cost $3,200 and you spent the year in a car, belonging properly to neither.",
            FX(cash=CASH(-3200, "keeping two places going"), stats={"happiness": -4}, stress=15)),
    ]),
], age_min=20, age_max=45, requires=["anyParent"], weight=11, cooldown=12)


# ---- ordinary adult life -----------------------------------------------------
#
# The `random` category is 92 events and EIGHT of them are available to an adult
# — `adult.placeholder.1` through `.8`, which is to say the whole of an adult's
# ordinary life texture was the labelled placeholders 0413 turned the weight down
# on. At twelve the same category offers forty-eight.
#
# These are the things that are not your job, your friends, your family or your
# body: the flat, the car, the street, the small mishaps and the small pleasures.
# Weighted into the twenties, where the cliff still is after 0413.

E("life.first-place-own", "random", [
    "Signed a lease on your own for the first time and stood in the empty room for a while.",
    "Your first place had a broken window latch and a view of a wall and you loved it.",
], age_min=18, age_max=30, weight=15, cooldown=6,
   effects=FX(stats={"happiness": 6}, stress=-2),
   modifiers=[MOD(1.8, age_max=24)])

E("life.terrible-apartment", "random", [
    "The heating worked in two rooms and neither was the bedroom. You wore a coat indoors until April.",
    "Something lived in the walls all winter and the landlord kept saying he'd look into it.",
], age_min=18, age_max=35, weight=14, cooldown=4,
   effects=FX(stats={"happiness": -4, "health": -1}, stress=6),
   modifiers=[MOD(1.7, age_max=26)])

E("life.the-car", "random", [
    "The car made a noise for eight months and then stopped making it, which you chose to take as good news.",
    "Spent $640 on the car to find out it needed $900 of work.",
], age_min=18, weight=13, cooldown=3,
   effects=FX(cash=CASH(-640, "the garage"), stats={"happiness": -3}, stress=5),
   modifiers=[MOD(1.5, age_max=28)])

E("life.learned-to-cook", "random", [
    "Worked out how to cook about six things properly and ate them on rotation for a year.",
    "Got good at one dish and made it for everybody who came round, whether they wanted it or not.",
], age_min=18, age_max=40, weight=13, cooldown=6,
   effects=FX(stats={"happiness": 4, "health": 2, "smarts": 1}, stress=-3),
   modifiers=[MOD(1.6, age_max=25)])

E("life.the-neighbors", "random", [
    "The people upstairs moved furniture at odd hours all year and you never once said anything.",
    "Met the neighbor properly for the first time when a package went to the wrong door.",
], age_min=18, weight=12, cooldown=3,
   effects=FX(stats={"happiness": -1}, stress=2))

E("life.own-money-first", "random", [
    "Bought something you actually wanted with money nobody had given you, and it was a strange feeling.",
    "Spent $180 on something impractical and have never regretted it for a second.",
], age_min=18, age_max=28, employed=True, weight=13, cooldown=5,
   effects=FX(cash=CASH(-180, "something impractical"), stats={"happiness": 6}, stress=-3),
   modifiers=[MOD(1.7, age_max=22)])

E("life.paperwork", "random", [
    "Spent a whole Saturday on hold and got one thing resolved out of three.",
    "Found out you'd been paying for something you cancelled two years ago.",
], age_min=19, weight=12, cooldown=3,
   effects=FX(stats={"happiness": -3}, stress=6))

E("life.new-city", "random", [
    "Moved somewhere new and spent the first month getting the bus wrong in both directions.",
    "Learned a whole city well enough to take a shortcut, which took about eighteen months.",
], age_min=18, age_max=40, weight=12, cooldown=7,
   effects=FX(stats={"happiness": 3, "smarts": 2}, stress=5),
   modifiers=[MOD(1.6, age_max=27)])

E("life.the-hobby", "random", [
    "Got properly into something nobody at work knows about and it fixed about a third of the year.",
    "Spent $220 on the gear for a new thing and used it more than anybody expected, including you.",
], age_min=19, weight=13, cooldown=5,
   effects=FX(cash=CASH(-220, "gear for a new hobby"), stats={"happiness": 6}, stress=-7))

E("life.quit-the-hobby", "random", [
    "The thing you were into is in a cupboard now and you're not going to pretend otherwise.",
    "Went four months without touching it and stopped calling it a hobby.",
], age_min=21, weight=11, cooldown=5,
   effects=FX(stats={"happiness": -3}, stress=2))

E("life.long-drive", "random", [
    "Drove six hours for something that lasted two, $430 of gas and rooms, and would do it again.",
    "Took a $430 trip you couldn't really afford and it was the part of the year you kept.",
], age_min=19, weight=12, cooldown=4,
   effects=FX(cash=CASH(-430, "a trip you couldn't really afford"), stats={"happiness": 7}, stress=-8))

E("life.small-disaster", "random", [
    "Locked yourself out at eleven at night and paid a man $160 to open a door in ninety seconds.",
    "Dropped your phone in exactly the wrong place and spent $310 on the same phone again.",
], age_min=18, weight=12, cooldown=3,
   effects=FX(cash=CASH(-160, "a locksmith"), stats={"happiness": -4}, stress=5))

E("life.the-routine", "random", [
    "Found a coffee place that knows your order and got unreasonably attached to it.",
    "Walked the same route so many times you stopped seeing it, and then one day saw it again.",
], age_min=20, weight=12, cooldown=3,
   effects=FX(stats={"happiness": 3}, stress=-3))

E("life.sorting-yourself-out", "random", [
    "Got your paperwork, your cupboards and your head into roughly the same order for about six weeks.",
    "Threw out four bags of things you'd moved twice without opening.",
], age_min=20, weight=12, cooldown=4,
   effects=FX(stats={"happiness": 4, "discipline": 2}, stress=-5))

E("life.up-all-night", "random", [
    "Stayed up until it got light for no particular reason and felt it for two days.",
    "Slept badly for a month and blamed everything except the obvious.",
], age_min=18, age_max=45, weight=12, cooldown=3,
   effects=FX(stats={"health": -2, "happiness": -2}, stress=5))

E("life.a-good-week", "random", [
    "Had a week in June where everything lined up, and you noticed at the time, which is the rare part.",
    "Nothing in particular happened in April and it was somehow the best month of the year.",
], age_min=18, weight=12, cooldown=3,
   effects=FX(stats={"happiness": 7}, stress=-8))

E("life.the-news", "random", [
    "Something happened in the world that everybody talked about for two weeks and then stopped.",
    "Gave up following the news for three months and felt better and slightly worse informed.",
], age_min=20, weight=11, cooldown=4,
   effects=FX(stats={"happiness": -2, "smarts": 1}, stress=3))

E("life.old-photos", "random", [
    "Found a box of photos of people you can no longer name and kept them anyway.",
    "Went through your phone from four years ago and sat with it longer than you meant to.",
], age_min=25, weight=11, cooldown=5,
   effects=FX(stats={"happiness": 2}, stress=1))

E("life.the-thing-you-fixed", "random", [
    "Fixed something yourself that you'd have paid somebody for a year ago.",
    "Watched twenty minutes of video and did a job that quotes at $400. It's still holding.",
], age_min=20, weight=12, cooldown=4,
   effects=FX(stats={"happiness": 5, "smarts": 2}, stress=-3))

E("life.getting-fit", "random", [
    "Went three times a week from January to about March, which is longer than last year.",
    "Started running and got to the point where it stopped being awful, which took eleven weeks.",
], age_min=18, weight=12, cooldown=4, physical=True,
   effects=FX(stats={"health": 4, "happiness": 3, "discipline": 2}, stress=-5))

E("life.let-it-slide", "random", [
    "Stopped going in February and kept paying until October, $304 for eight months of nothing.",
    "Paid $304 to a gym you drove past all year and ate whatever was quickest.",
], age_min=20, weight=12, cooldown=4,
   effects=FX(cash=CASH(-304, "a gym you stopped going to"), stats={"health": -3, "happiness": -2}, stress=3))

E("life.the-grey-year", "random", [
    "Went through a stretch where nothing was wrong and nothing was interesting either.",
    "Had a flat few months and came out of them without ever working out what it was.",
], age_min=20, weight=12, cooldown=4,
   effects=FX(stats={"happiness": -5}, stress=6))

E("life.stranger-kindness", "random", [
    "A stranger did something small and completely unnecessary for you and you think about it still.",
    "Somebody let you go first at a moment you badly needed somebody to let you go first.",
], age_min=18, weight=10, cooldown=6,
   effects=FX(stats={"happiness": 5}, stress=-4))


# =============================================================================
# Self-checks. A catalog this size makes these mistakes inevitable; the point of
# generating it is that they fail here rather than in a player's timeline.
# =============================================================================

TOKEN_RE = re.compile(r"\{([a-zA-Z0-9]+)\}")

# Ticket 0207. Mirrors CRUSH_AGE in `@yearafter/social`. Kept as a plain number
# here because the generator is Python and cannot import it — the content
# validator checks the same floor, so the two cannot drift silently.
ROMANCE_AGE_FLOOR = 13

MIN_EVENTS = 250
# Ticket 0414 raised this from 500.
#
# The ceiling is from ticket 0203, when the catalog was a childhood and 500 was
# more than anyone could review. It is now a guard whose justification has
# expired (CORE_RULES 13.68): the spec's own v0.10 target is *"roughly
# 2,000-5,000+ event text variants by pre-beta"* and v0.20 wants "a
# correspondingly large event library", so a number that stops the build at 543
# is stopping it from doing the thing it is for.
#
# What actually keeps a catalog this size honest is not the count — it is the
# checks below, the content validator, and the reachability tests, all of which
# scale. The floor stays where it is and still means something.
MAX_EVENTS = 700
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

    # Ticket 0211b — the same rule, for the sibling.
    #
    # {sibling} is a real person with a known sex and was not in PERSON_OF, so
    # the check above never looked at it. Two lines shipped: "Sister tried to
    # refuse and you made him take it" — {them}, the PLAYER's pronoun, about a
    # girl — and "out of sister's own allowance", which used the RELATION word
    # where a possessive pronoun belongs. Neither contains a bare "him" or
    # "her", so every guard in the build was blind to both: a wrong TOKEN is
    # invisible to a rule that only reads words (CORE_RULES 13.35).
    if "sibling" in tokens and tokens & PLAYER_PRONOUNS:
        problems.append(
            f"{event['id']}: {where} names {{sibling}} AND uses a player pronoun — "
            f"{{they}}/{{them}}/{{their}} are the player's. Use {{siblingThey}}, "
            f"{{siblingThem}} or {{siblingTheir}}."
        )
    if "sibling" in tokens and BARE_PRONOUN_RE.search(TOKEN_RE.sub(" ", text)):
        problems.append(
            f"{event['id']}: {where} names {{sibling}} and then writes a bare "
            f"'he'/'she'/'him'/'her'. A sibling can be either — use "
            f"{{siblingThey}}/{{siblingThem}}/{{siblingTheir}}."
        )

    # A relation word is not a pronoun.
    #
    # {siblingRel} renders "brother" or "sister". Two shapes are always wrong
    # and neither can appear in correct copy, which is why they are checked
    # exactly rather than by judgement:
    #   {siblingRel}'s  — a possessive pronoun's job. "out of sister's own
    #                     allowance" reads as a stranger's allowance.
    #   {SiblingRel}    — a sentence subject's job. "Sister tried to refuse."
    for rel in ("siblingRel",):
        if f"{{{rel}}}'s" in text:
            problems.append(
                f"{event['id']}: {where} writes {{{rel}}}'s, but {{{rel}}} renders a "
                f"relation ('sister'), not a name. Use {{siblingTheir}}."
            )
        if f"{{{rel[0].upper()}{rel[1:]}}}" in text:
            problems.append(
                f"{event['id']}: {where} opens a sentence with {{{rel[0].upper()}{rel[1:]}}}, "
                f"which renders 'Sister'. Use {{SiblingThey}}."
            )

    # A line that says {parent} cannot then write a bare "she" or "they".
    #
    # {parent} renders "Mom" or "Dad" depending on which the household has, so
    # the copy does not know the sex. Reading the built app found "You told Mom
    # the truth and they did not know what to do with it" and four more like it,
    # all of them shipped and none of them checked. {mother} and {father} are
    # exempt: those DO know, and "she" beside {mother} is correct.
    if "parent" in tokens and not tokens & {"parents", "mother", "father"}:
        if ANY_PRONOUN_RE.search(TOKEN_RE.sub(" ", text)):
            problems.append(
                f"{event['id']}: {where} says {{parent}} and then writes a bare "
                f"'he'/'she'/'they'. {{parent}} renders Mom or Dad depending on the "
                f"household, so the copy cannot know — use {{parentThey}}, "
                f"{{parentThem}} or {{parentTheir}}."
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

    # Ticket 0207. Nothing romantic may fire below the crush age, and the
    # catalog is exactly where that gets broken by somebody adding one entry —
    # a bare `E(...)` with no `age_min` defaults to being eligible from birth.
    # Asserted here rather than remembered, and mirrored in the content
    # validator so it holds for hand-edited JSON too.
    for event in EVENTS:
        if not event["id"].startswith("love."):
            continue
        floor = event["eligibility"].get("ageMin")
        if floor is None or floor < ROMANCE_AGE_FLOOR:
            problems.append(
                f"{event['id']}: a romance event needs ageMin >= {ROMANCE_AGE_FLOOR}, got {floor!r}"
            )

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
        # shared verb has too many honest collisions ("Go sit with them" and
        # "Go to the address on the license" are different tactics that both
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

        # Anything that spends has to be gated on having the money. Derived by
        # apply_cash_gates; checked here so a hand-edit cannot remove it.
        biggest_spend = 0
        for source in [event.get("effects")] + [
            *(choice.get("effects") for choice in choices),
            *(
                outcome.get("effects")
                for choice in choices
                for outcome in choice.get("outcomes", [])
            ),
        ]:
            delta = ((source or {}).get("cash") or {}).get("delta", 0)
            if delta < 0:
                biggest_spend = max(biggest_spend, -delta)
        if biggest_spend > 0:
            gate = event["eligibility"].get("cashAtLeast", 0)
            if gate < biggest_spend:
                problems.append(
                    f"{eid}: can spend ${biggest_spend} but is only gated on ${gate}. "
                    f"An event that spends what the character does not have floors the "
                    f"balance at zero and tells them they spent it."
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


def apply_cash_gates() -> None:
    """
    An event that SPENDS must require the money to be there.

    Reading output found a fourteen-year-old holding $60 told "the coffee can
    under your bed has $150 in it", spending it, and finishing on $0 — the
    balance floored and the sentence lying about it. That is CORE_RULES 13.6
    broken from the other direction: money that moves without the prose being
    true about it.

    Derived rather than hand-authored, because hand-authoring it means the next
    event to spend money forgets. The gate is the LARGEST amount any branch can
    spend: an event whose prompt presumes the money presumes it before the
    player picks, so gating per choice would still show the prompt to somebody
    who cannot afford the thing it describes.
    """
    for event in EVENTS:
        spends = [0]
        effects = event.get("effects") or {}
        if effects.get("cash", {}).get("delta", 0) < 0:
            spends.append(-effects["cash"]["delta"])
        for choice in event.get("choices", []):
            choice_effects = choice.get("effects") or {}
            if choice_effects.get("cash", {}).get("delta", 0) < 0:
                spends.append(-choice_effects["cash"]["delta"])
            for outcome in choice.get("outcomes", []):
                outcome_effects = outcome.get("effects") or {}
                if outcome_effects.get("cash", {}).get("delta", 0) < 0:
                    spends.append(-outcome_effects["cash"]["delta"])
        most = max(spends)
        if most > 0:
            event["eligibility"] = {**event["eligibility"], "cashAtLeast": most}


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
    apply_cash_gates()
    check()
    payload = {"version": CATALOG_VERSION, "entries": EVENTS}
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(ROOT)}")
    report()


if __name__ == "__main__":
    main()
