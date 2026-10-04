# Ticket 0413 — the year after school

The content half of roadmap item 5b, and the finding that named it was true and
pointing at the wrong place.

Finding 2d: _"the `friendship` category has six events for an adult, all of them
about romance."_ Exactly right — `love.set-up`, `love.app`, `love.moved-in`,
`love.quiet-year`, `love.wedding-guest`, `love.the-one-that-got-away`, and for a
single character only five of those. But measuring where the hole actually sits
found something the roadmap had never looked at.

## An eighteen-year-old had seven things that could happen to them

An ordinary character — employed, single, childless, not bereaved, well:

| age    | reachable events | of which `adult.placeholder.*` |
| ------ | ---------------- | ------------------------------ |
| 12     | 140              | 0                              |
| 17     | **99**           | 0                              |
| **18** | **7**            | **5**                          |
| 20     | 19               | 5                              |
| 40     | 40               | 7                              |

**The year a character leaves school, this game lost 92% of its content.** In
play that is:

- **98.6% of everything that fired at eighteen was a placeholder**, across
  **six distinct event ids in ninety lives** (against 104 at seventeen);
- 35.2% of everything fired between eighteen and twenty-two;
- the four commonest things a twenty-year-old read were `adult.placeholder.2`,
  `.3`, `.5` and `.1`;
- 1.59 events fired a year, against 3.06 at seventeen — the pool was too thin for
  the selector to fill the year at all.

And the placeholder copy is the writer saying there was nothing to write:
_"Nothing happened this year worth telling anybody about."_ _"You'd struggle to
name one thing that happened this year."_ _"Kept meaning to call people back and
mostly didn't"_ — that last one describing, by accident, the exact mechanism 0412
had just built.

**0409 measured at forty.** Its headline was events-at-forty going 26 → 93, and
by that instrument the cliff at eighteen is invisible. Nobody had asked the
catalog what an eighteen-year-old could see.

## And zero questions about a friend, ever

Measured across ninety lives, every decision the game has ever raised to an adult
was **career (3,029), health (392) or loss (119)** — the three categories 0409
wrote. A child gets thirteen friendship decisions. An adult had none.

## What it is

**Forty-five events and eight decisions**, weighted into the desert rather than
spread flat, and gated on the predicates 0412 built:

|                                                    | before    | after     |
| -------------------------------------------------- | --------- | --------- |
| reachable at 18                                    | **7**     | **18**    |
| reachable at 22                                    | 24        | 49        |
| reachable at 40                                    | 40        | 65        |
| friendship events at 18                            | **0**     | 11        |
| friendship events at 40                            | 5         | 32        |
| adult friendship decisions                         | **0**     | 7         |
| placeholder share of what fires at 18              | **98.6%** | **17.5%** |
| placeholder share, 18–22                           | 35.2%     | 11.0%     |
| distinct events fired at 18                        | **6**     | 20        |
| distinct events fired at 40                        | 64        | 89        |
| feed lines in 18–30 the character has already read | 6.9%      | 3.7%      |

The events that could not exist before are the ones that justify the ticket: an
old friend (`friendshipYearsAtLeast`), a crowd (`friendsAtLeast: 3`), the one
person you'd call (`friendsAtMost: 1`), and a year with nobody in it at all
(`hasFriend: false`) — which is half of what this category is for and which the
language literally could not ask for until 0412.

**The placeholders keep their ids.** A save records what fired, and ids are
stable forever (CORE_RULES 13). They were never the defect — a quiet year is real
content and `love.quiet-year` is deliberate. The defect was the _denominator_.
Their weight drops from 6 to 4, and five lines that broke writing rule 10 —
"never summarize the year, name a thing that happened" — are rewritten. The
validator's VAGUE table never caught them because it was built from lines the
product owner quoted back, and he never saw these: they were buried under a
childhood's worth of better content until the year he left school.

## Three things that had to be built first

- **`{kid}` now binds friends first.** 0412 made a gate that could require a
  friend; the token still named whoever the draw landed on, and for a working
  adult the circle is mostly colleagues — so _"you and {kid} have been friends
  since school"_ would have named somebody met eleven months ago. That is 0207's
  `partnered` bug one level down. Narrowing the existing token beat adding a
  `{friend}` one: five lines against four token tables and the four-places
  problem the roadmap has had open since 0209. New rule **13.74**, and it is
  better content everywhere else too — every event that names somebody now names
  the person the character actually knows.
- **`FX` can author `bond`.** The engine has read `effects.bond` since 0206 and
  the generator has never had a parameter for it, so all 444 events silently took
  the derived value: happiness × 0.7. See below.
- **The four predicates reach the Python generator**, which is the mechanical
  half of 13.67 and easy to forget: a gate the catalog cannot write is a gate
  nothing uses.

## The content reopened the curve 0412 had just closed

This is the ticket's real find and 0412's tests caught it.

Thirty-nine new events about friends, every one carrying a happiness effect, and
`bondFromOutcome` derives warmth from happiness when nothing authors it. So the
catalog turned out to be the second door into exactly the failure 0412 had spent
a ticket closing:

|                                 | 0412 shipped | 0413 first draft | 0413    |
| ------------------------------- | ------------ | ---------------- | ------- |
| closest friend at 55, p10 / p90 | 82 / 97      | **90 / 97**      | 86 / 97 |
| spread at 55                    | 15           | **7**            | 11      |
| adults with no friends at all   | 2.4%         | **0.8%**         | 1.7%    |
| closest friend at exactly 100   | 0%           | 0%               | 0%      |

The cap never came back — 0412's curve holds — but the population was converging
again from below, and the second row is the one that matters: content _about_
having friends was making it impossible _not_ to have them, which quietly
unreaches every `hasFriend: false` event in the same tranche.

**Thirty-one of the thirty-nine now author `bond=0`.** An event about a
friendship's weather should move the year's happiness and leave the number that
says how close two people are to the things they actually did — which is 0412's
keeping-up step and the People screen. Eight keep a bond because something
happened between two people: a favour asked, somebody covering for you, standing
up at a wedding, and a friendship going quiet (`bond=-7`). New rule **13.75**.

## The test that could not see what it was asserting

The first gate test checked, for every gated event that fired, that the character
had a friend that year. It flagged `friend.their-kids` at seventy-three — and the
context it was actually selected against said **two**, both of whom drifted under
the line later in the same year, which at seventy-three is drift working. Widened
to "either end of the year", it flagged `d.friend.needs-a-room` at twenty-two,
where the warmth crossed 50 inside the year in the other direction.

The engine reads its context in the MIDDLE of a year. A test outside `advanceYear`
sees two ends and never the middle, so widening it could only ever stop it
failing. **Two widenings in a row is the signal that the instrument cannot
reach.** New rule **13.76**.

Split three ways, each observable: `matchesCondition` against all four predicates
as a unit test; the count reaching the context equalling the circle's real one, on
states from played lives; and reachability as a population test. Each fails under
its own sabotage, which the blurred one did not.

## Verified

- Generator self-checks pass; `pnpm typecheck` — 15/15; `pnpm test` —
  **983/983**; validator — **1,079 ids**, clean.
- The generator caught six problems as they were written: two events moving money
  without naming the amount, two labels too long for a phone, and two more amounts
  missing from outcome text. The validator then caught "is not" for "isn't" and a
  "fortnight" — and, in 0412's test file, a banned unseeded random in a comment.
- Five assertions in `after-school.test.ts`, sabotage-verified: removing the new
  events turns four red; unwiring the friend count turns three.
- Three in `binding.test.ts`; reverting the friends-first bind turns two red.
- One in `events.test.ts` covering all four predicates; ignoring any of them in
  `matchesCondition` turns it red.

## Still rough

**Eighteen is still eighteen events against ninety-nine at seventeen.** Most of
the adult catalog is gated on things an eighteen-year-old does not have yet — a
career history, children, a condition, a bereavement — so the pool cannot be
filled by writing more friendship events. It is better than seven and it is not
solved, and the honest fix is content for the other adult categories at that age
rather than more of this one.

**Friendship is 37% of what fires at forty and 49% at twenty.** Childhood runs
22–28%. That is not this tranche being over-weighted — the weights were measured
down twice — it is that friendship is now the only adult category that can _see_
a twenty-year-old. `family` at that age is eleven parenting events gated on
`hasChildren`; `random` is the placeholders. **The next content ticket is the
other categories in the same window**, and it has this ticket's measurement ready
to use.

And the colleague of fifteen years still has a thin page. 0412's keeping-up step
reaches the complement of the room by design, and this tranche names whoever is
bound rather than specifically the person you see every day — so what happens
between two people who share a room all year is still mostly unwritten.
