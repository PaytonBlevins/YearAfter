# Ticket 0414 — the family you came from

Roadmap finding 2e, which 0413 left behind: the cliff at eighteen was only half
filled and what remained was not friendship. Measuring what remained found a
hole larger than the one 0413 had just closed.

## A category with ninety-one events that a majority of characters cannot see

For an ordinary character — employed, single, childless, not bereaved, well:

| category   | at 12 | at 17 | at 18                | at 40                |
| ---------- | ----- | ----- | -------------------- | -------------------- |
| family     | 6     | 5     | **0**                | **0**                |
| random     | 48    | 37    | 5 (all placeholders) | 7 (all placeholders) |
| talent     | 2     | 2     | **0**                | **0**                |
| friendship | 38    | 38    | 11                   | 32                   |

`family` is the second-biggest category in the catalog and it was **a total zero
by construction**. Of its ninety-one events, eighty carry an `ageMax` below
eighteen and the other eleven are 0208's parenting events gated on
`hasChildren`. There is no third group.

Measured across eighty played lives:

- **56.3% of every adult year in this build is childless**, and **0.0% of those
  years held a family event.** Not thin — zero, across 4,367 adult years.
- **69.8% of those years had a living parent.** She is in the save, she ages,
  and 0212 will eventually kill her, and between the character's eighteenth
  birthday and her funeral the catalog had not one line about her.
- 64.4% of adult years had a living sibling, with the same silence.

And the shape gives it away: family events ran **0% at eighteen, 1.9% at thirty,
12.4% at forty** — a curve that rises with exactly one variable, because every
point of it is people having children rather than people having families.

Four previous measurements missed this, each defensibly. 0409 counted events at
forty, where parents-of-children carry the number. 0410 "fixed family" by
building the door to _having_ children. 0413 measured the cliff by category
total. New rule **13.77**: measure a category against the population it serves,
not against the catalog.

## No new predicates, for once

`requires: ["mother"]` has meant a **living** mother since 0212 made NPCs mortal
— `Boolean(mother(family)?.alive)` — and `relationshipAtLeast` /
`relationshipAtMost` already read her warmth. The last three tickets each had to
extend the language first. This one didn't: it was ready and nobody had written
against it.

## What it is

**Twenty-nine family events and four decisions** about the family a character
came from, and **twenty-four ordinary-life events** for the category that was
nothing but placeholders.

|                                                | before                       | after                 |
| ---------------------------------------------- | ---------------------------- | --------------------- |
| childless adult years holding a family event   | **0.0%**                     | **47.2%**             |
| family share of what fires at 18 / 30 / 40     | 0% / 1.9% / 12.4%            | 18.1% / 22.5% / 25.8% |
| placeholder share across 18–30                 | 17.5% at 18                  | **2.8%**              |
| adult family decisions                         | **0**                        | 4 (33+ firings)       |
| distinct events fired at 18 / 40               | 20 / 89                      | **31 / 111**          |
| largest single category share of an adult year | **46.9%** (friendship at 20) | **31.3%**             |

That last row is finding 2e's own second half, and it is fixed the right way
round. After 0413, friendship was 49% of everything that fired at twenty against
childhood's 22–28% — not because the tranche was over-weighted (it was measured
down twice) but because **friendship was the only adult category that could see a
twenty-year-old**. Filling the other categories brought it to 21–30% without
touching a single friendship weight.

The adult mix now reads like childhood's:

| age | family | friendship | career | health | loss | random |
| --- | ------ | ---------- | ------ | ------ | ---- | ------ |
| 12  | 16.5%  | 27.4%      | —      | —      | —    | 27.4%  |
| 20  | 24.0%  | 21.2%      | 20.3%  | 0.9%   | —    | 33.6%  |
| 30  | 22.5%  | 26.4%      | 20.3%  | 6.6%   | 1.8% | 22.5%  |
| 40  | 25.8%  | 23.6%      | 17.9%  | 8.3%   | 3.1% | 21.4%  |

## Two things the checks found

- **The token-guard table had been wrong for eleven tickets.** One line —
  _"{father} slipped you $200 at the car and told you not to tell
  {motherName}"_ — was accepted by the generator and rejected by the content
  test, because the generator has known `{motherName}` and `{fatherName}` since
  0203b and the TypeScript copy never had them. Roadmap finding 7 has named this
  table as living in four places since 0209; this is what it costs. A duplicated
  table does not fail when it drifts, it fails when somebody finally uses the
  drifted entry. New rule **13.78**.
- **`{parent}` is not `{mother}`.** The generator refused eleven lines that said
  `{mother}` under `requires: ["anyParent"]` — correctly, because that
  requirement guarantees _a_ parent and not _which_. They read `{parent}` now
  ("Mom" or "Dad" as the household has it) with `{parentThey}` pronouns, which is
  precisely what that token exists for and what the 0203b pronoun work built.

## The ceiling

The catalog is **543 events** and the approved target since 0203 has been
250–500, enforced in the generator and in a package test.

Raised to 700, with the reasoning written down in both places. The ceiling is
from a ticket where this catalog was a childhood and 500 was more than anybody
could review; the spec's own v0.10 target is _"roughly 2,000–5,000+ event text
variants by pre-beta"_, so a number that stops the build at 543 is stopping it
doing the thing it is for. That is CORE_RULES 13.68 — a guard whose
justification expired. What keeps a catalog this size honest is the generator's
self-checks, the validator and the reachability tests, and all three scale. The
floor is untouched.

## Verified

- Generator self-checks pass; `pnpm typecheck` — 15/15; `pnpm test` —
  **988/988**; validator — **1,131 ids**, clean.
- The generator caught 31 problems as they were written, the validator two more
  after that (a "fortnight" and a "was not"), and the package test the token
  drift above.
- Five assertions in `kin-and-life.test.ts`, sabotage-verified four ways:
  removing the family tranche turns three red, removing the ordinary-life
  tranche turns the fourth, re-gating the family tranche on `hasChildren` — the
  exact pre-ticket shape — turns two red, and running the whole file against the
  0413 catalog turns **all five** red with friendship back at 46.9% at twenty.

## Still rough

**Talent is zero for an adult, and this ticket deliberately did not fix it.** All
fifty-eight talent events carry an `ageMax` below eighteen, so whatever a
character is good at stops existing the day they leave school — measured at
**0.0% of what fires at every adult age**. It is the same total-zero shape as
family was, and it is left alone on purpose: adult talent is what v0.07 Creator
& Fame and v0.08 Entertainment & Sports are _for_, and 0211 already recorded that
adult athletics is blocked on `education.activities` being school-only. Writing
thirty adult talent events now would pre-empt two milestones and make them
harder. It is logged as finding 2f.

**Eighteen is still thinner than seventeen** — 31 distinct events fired against
about a hundred. `career` needs a job history, `health` needs a condition and
`loss` needs a bereavement, and an eighteen-year-old has none of the three. That
is structural rather than a content gap, and the three categories that CAN reach
that age now all do.

## Later follow-ups

0416 subsequently added recreational adult pursuits, including sports. Adult
talent events and professional creator/entertainment/sports careers remain
future milestone work; adding pursuits did not author that talent tranche.
