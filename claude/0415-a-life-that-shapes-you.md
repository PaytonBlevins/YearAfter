# Ticket 0415 — a life that shapes you

Roadmap finding 2c, 0411's leftover: _"study, a hobby, raising a child and being
ill are all things that change a person, and none of them touch a stat in
adulthood."_

## Measured first, paired per life from twenty-five to fifty

200 played lives, each character compared against their own twenty-five-year-old
self so this measures development and not who ends up where (0411's cohort
mistake):

|                                    | willpower | discipline |
| ---------------------------------- | --------- | ---------- |
| eight+ years raising a small child | +13.1     | −3.0       |
| never                              | +12.4     | −2.8       |
| five+ years seriously ill          | +12.2     | −4.3       |
| never                              | +12.9     | −2.3       |
| five+ years running on empty       | **+15.7** | −0.8       |
| never                              | +11.9     | −3.3       |

Raising a child for a decade and being seriously ill for five years left a person
exactly where they would have been anyway. And the last row is backwards: five
years of struggling left a character with **more** willpower than a calm life.

**One of the four was wrong.** Study already moves a person — `runCollegeYear`
has paid +2 Smarts a year since 0210b, and adults who studied gained +4.0 Smarts
against −2.3 for those who didn't. Nothing to build there.

## The bigger finding: willpower was collapsing

Measuring that last row showed why it was backwards. **Willpower** — the stat
`resilience` reads to decide how hard a year lands — was a one-way ratchet in
adulthood:

| willpower          | 18       | 30       | 45       | 60           |
| ------------------ | -------- | -------- | -------- | ------------ |
| p10 / median / p90 | 54/71/85 | 67/79/89 | 78/88/92 | **88/92/94** |
| sd                 | 11.4     | 8.6      | 5.3      | **2.8**      |

**Not one life in 150 had lower willpower at forty-five than at eighteen.** That's
0411's Charisma collapse (sd 9.7 → 3.8) again, on the one stat 0411 didn't list.

The cause was in the catalog: **seventy-one willpower effects in the adult
catalog, not one of them a loss**, and more than half the willpower actually paid
out came from the last two tickets' content (0413's friendship tranche and 0414's
family and ordinary-life events). The tell was where they sat — on both outcomes
of a hard choice:

- _"You set a date and had to enforce it, which neither of you has completely got
  over"_ — +3.
- _"You told nobody and got on with it. It worked, right up until the day it
  didn't"_ — +4.
- _"{kid} stayed four months. You love {kidThem} and you were extremely glad when
  it ended"_ — +2.

When the hard thing works and when it fails pay the same number, the number isn't
measuring what happened. It's a fee for being asked, and a fee paid every year is
a ratchet. New rule **13.79**.

## What it is

**Two halves, and measurement says both are needed.**

**The catalog.** 39 edits across 33 events, willpower only (verified by diffing
the regenerated JSON with willpower stripped: zero other changes). The adult
catalog goes from **71 gains / 0 losses** to **37 gains / 5 losses**:

- Warmth events stop paying endurance — a friend saying yes before you finished
  asking is a good year, not a stronger person (13.75's `bond` rule, one stat
  over).
- The branch where the hard thing didn't work stops paying the same as the one
  where it did.
- Five outcomes that describe being worn down now cost something: carrying it
  alone until the day it doesn't work (−2), four months of a friend on your couch,
  a year your teenager didn't speak to you, becoming the one who handles a
  parent's appointments, going to a room alone and nothing happening (−1 each).
- The generator's `FX` docstring now says this, next to 0205's stress rule.

**The system.** New `packages/simulation/src/shaping.ts`, three pure two-sided
rules applied at the end of the year, through `nudgeStats`, after the health
phase:

- **A small child** (under six, at home) builds Discipline, in a year you held
  together. The same child in a year you were running on empty costs Willpower
  instead. Nothing past thirteen.
- **A serious illness**, in years one to six of living with it, hardens somebody
  who meets it well (willpower ≥ 60) and wears somebody who doesn't (< 45), and
  wears anybody in a year they were struggling. **Deliberately not keyed on
  treatment**, because only the Doctor button sets `treated`, and a rule that
  paid on it would be 0410's button-only door again.
- **The second struggling year in a row** costs Willpower. The first doesn't —
  one hard year is ordinary, and the stress phase already bills happiness for it.

"Struggling" is the existing `stressBand`, not a new threshold. Every loss floors
at 0411's `RUSTY_FLOOR` — imported, not restated (13.78). And a year that goes
wrong three ways is billed once: the three rules share a cause, so the year's
total is held to one point per stat.

## Measured

Same 200 seeds:

|                                                  | before               | after                |
| ------------------------------------------------ | -------------------- | -------------------- |
| willpower sd at 18 / 45 / 60                     | 11.4 / 5.3 / **2.8** | 11.4 / 9.4 / **8.1** |
| willpower p10 at 60                              | 88                   | **70**               |
| willpower gain 18→45, median                     | +16                  | +7                   |
| lives with lower willpower at 45 than at 18      | **0%**               | 4%                   |
| discipline 25→50: raising a small child vs never | −3.0 vs −2.8         | **+0.8 vs −2.8**     |
| willpower 25→50: five+ strained years vs none    | **+15.7 vs +11.9**   | +5.2 vs +7.6         |
| willpower 25→50: five+ years ill vs never        | +12.2 vs +12.9       | +5.8 vs +7.1         |

And per year, on the test file's own 150 lives:

| willpower per year                 | catalog audit alone | both halves      |
| ---------------------------------- | ------------------- | ---------------- |
| a second struggling year           | +0.26               | **−0.59**        |
| a calm year                        | +0.28               | +0.30            |
| discipline 25→50, raising vs never | −2.6 vs −1.0        | **+2.5 vs −1.1** |

The middle column shows why both halves are needed. Fixing the catalog stopped
hard years paying _more_, but they still paid the same as easy ones; only the
system can take something away.

Smarts, Charisma and Discipline spreads at sixty move by less than a point either
way (Discipline 16.3 → 15.8, the others up slightly). Looks isn't touched.

## Verified

- `pnpm typecheck` — 15/15. `pnpm test` — **1,002/1,002**. Validator — 1,131 ids,
  clean. Nothing that existed broke.
- Nine assertions in `shaping.test.ts` on the pure rules. Sabotage-verified three
  ways: removing the fraying branch, removing the one-point cap and removing the
  floor each turn one red.
- Five in `shaped-life.test.ts` on 150 played lives. Sabotage-verified five ways:
  the pre-audit catalog turns two red (a trait collapsing, and willpower's floor
  at sixty); removing the strain rule turns two red; removing the parenting rule
  turns two red; breaking how long a condition has been held turns the plumbing
  test red; unwiring shaping from `advanceYear` turns three red.
- **"No trait collapses" is written for every trait**, not for willpower. 0411
  fixed Charisma, and the next stat a content ticket turned into a ratchet was
  one it hadn't listed — so this checks all five traits at once (13.72).

## One mistake of my own

**The first population illness test couldn't see what it was asserting.** It
compared willpower per year for ill characters above the hardening line against
those below the fraying line — and fewer than ten adult years across 150 lives
start a serious illness below 45 willpower. Replaced it rather than widening it
(13.76): the rule is proven as numbers in the unit test, and the population file
now proves the plumbing — the severity lookup, the years held and the children's
ages reaching `lifeShaping` from real played states.

## Still rough

- **The hobby, the fourth of 2c's four, isn't here — and it can't be yet.**
  There's nothing in adult state for a hobby to be. `education.activities` only
  exists while a character is at school, which is the same gap as 2b's leftover
  ("twenty is still the loneliest year": an adult has work and the street and no
  third door) and 0211's _"nobody over eighteen is an athlete."_ Three findings,
  one missing mechanism: **an adult who can join something.** Logged as finding
  2g.
- **The fraying half of illness rarely fires**, because hardly anybody is below
  45 willpower as an adult. The rule is right, but the population it serves is
  small — 4% of lives lower at forty-five than at eighteen.
- **Willpower still contracts** — sd 11.4 → 8.1 by sixty, about 30% — and its
  median still rises. The rise is defensible (people do steady with age); the
  contraction is the closest of the five traits to the guard's line. If a later
  content ticket moves it, the class test will say so.
- **Charisma's median still climbs** 76 → 90 across a life, with sd holding
  because 0411's neglect works. It's the same shape as willpower, just held in
  check. Worth the 13.79 audit the next time a content ticket touches it.
