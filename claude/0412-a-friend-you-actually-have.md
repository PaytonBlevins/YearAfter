# Ticket 0412 — a friend you actually have

Roadmap item 5b, recommended next by 0411, and made of two findings: **2b**
_"warmth is grown by a button, and there is a trough at twenty"_ and **2d** _"the
`friendship` category has six events for an adult, all of them about romance."_

2d is exactly true. 2b is true and was measured too narrowly — the trough is not
about being twenty, and it happens three times. And at the other end of the same
mechanism there was a second failure nothing had noticed at all.

## The trough is a sawtooth

A player who answers every question the game raises and never opens a screen,
90 lives:

| age    | share with NO friend | closest friend, median |
| ------ | -------------------- | ---------------------- |
| 12     | 10.0%                | 57                     |
| **14** | **84.4%**            | 44                     |
| 17     | 11.1%                | 56                     |
| 18     | 31.1%                | 52                     |
| **19** | **88.9%**            | 44                     |
| **20** | **87.8%**            | 42                     |
| 21     | 68.9%                | 47                     |
| 22     | 37.8%                | 51                     |
| 25     | 11.1%                | 67                     |

Three teeth, not one. The cause is not adulthood: **a friendship in this build
was a function of how long the current room had been open.** A new cast starts at
26–46 warmth and needs three or four years of proximity to cross the friendship
line at 50 — and the build empties the room at eleven, at fourteen, and at
eighteen. Fourteen and nineteen are the same hole, two rooms apart. 2b spotted
the one that happens to fall next to adulthood.

`interact.ts` is the only thing that keeps a friendship alive outside a room and
it is called by a tap and nothing else, so for a passive player there was
nothing between "in the same room" and gone.

## And everybody's best friend was a 100

The half no finding had noticed, at the other end of the same mechanism:

| closest platonic friend | p10     | median  | p90     | at exactly 100 |
| ----------------------- | ------- | ------- | ------- | -------------- |
| age 22                  | 42      | 51      | 61      | 0%             |
| age 30                  | 66      | 93      | 100     | 32.2%          |
| **age 40**              | **100** | **100** | **100** | **91.0%**      |
| age 45                  | 100     | 100     | 100     | 90.9%          |

**Warmth was the one number in this build that never went through a curve.**
`remember` added its delta raw and so did the year-in-the-same-room step, which
runs `PROXIMITY_WARMTH` at everybody in a room every year for as long as the room
is open — and since 0211a a job is a room, which can stay open for thirty years.

Pooled across every platonic relationship at forty the distribution was bimodal,
p10 **34** and median **100**: this build had no such thing as a
decent-but-not-best adult friend. You were in the room or you were nobody.

That is CORE_RULES 13.70 in a third system. 13.66 caught the flat push through
`curvedDelta` in school; 0411 caught the one-way ratchet in the event catalog;
this is the same shape in `relationship`, and `curvedDelta`'s own note is the
argument against it word for word — _a stat everyone maxes is a stat that says
nothing._

## And the catalog

Finding 2d, confirmed exactly. Of the six `friendship` events that can fire at
forty, every one is a `love.*` entry, and `love.the-one-that-got-away` alone
fired 295 times across 90 lives. **Zero adult friendship decisions**, against
thirteen for a child.

The reason is one line below, and it is 0409's lesson again: `EventCondition`
could say `partnered`, `hasChildren`, `employed` and `hasCondition`, and could
say **nothing whatsoever about a friend.** An event cannot be about a thing
eligibility cannot ask about, so the category's whole adult library is about the
one relationship the language could express.

## What it is

Three things, and the first two are one mechanism seen from both ends.

**A curve on warmth** (`curvedWarmth`), the same shape as `curvedDelta`: full
strength at or below 50, tapering to nothing at 100. One-sided, and the asymmetry
is the point rather than an omission — a loss stays at full strength because
`driftRate` already owns the cooling curve with the _opposite_ shape on purpose
(a friendship that has cooled cools faster), and because softening a loss would
quietly disarm `fall-out`, whose whole job is to be able to end something. Not
applied to `romanceYear`, which has had its own pivot since 0207.

**A systemic side to `interact.ts`** (`keeping-up.ts`), the way 0410 was the
systemic side of `romance.ts`. Once a year, without being asked, you keep up with
the people a year of silence would cost — and it runs the REAL verb:
`resolveInteraction` then `remember`, so the odds are the menu's odds, the line
is the menu's line, and the memory lands on the same page a tapped one would.

- **Exactly the complement of the room.** Anybody `inRoom` is already getting
  proximity warmth; giving them this as well would double-count the one thing
  that was never in short supply.
- **Light verbs only.** You do not accidentally tell somebody your secret, and
  you certainly do not accidentally have it out with them. The heavy half of the
  menu is where the player's judgement lives and it stays theirs.
- **Worth less than a tap** (`UNCHOSEN = 0.75`), and the number is measured
  rather than chosen: it has to beat `driftRate` at the warmths where a
  friendship is decided and fail to beat it higher up. At 50, ringing somebody
  gains 6 against a drift of 4.5; at 85 it gains 2 against 3.9. **The room is
  what makes a best friend and keeping up makes a good one**, and that sentence
  is the whole of why the constant is 0.75.

**A friend the catalog can see**: `hasFriend`, `friendsAtLeast`, `friendsAtMost`
and `friendshipYearsAtLeast` on `EventCondition`, with `friends` and
`friendshipYears` on the event context, counted off the circle and excluding
anybody the character is or was involved with. Nothing uses them yet — they are
the language the content ticket is written against, and they had to exist first
(13.67). `friendship.test.ts` asserts all four values are reachable in a
population, so they are state rather than a promise (13.36).

## The two orderings, and the one that was wrong

The step went in **before** the drift step, on the reasoning that keeping up with
somebody is contact and `driftPerson` must see it as contact. That is true and it
was still the wrong place: `driftPerson` exempts anybody whose `lastContactAge`
is the current age, so **one phone call a year bought total drift immunity.** It
measured exactly like that — the earliest peer still in the circle at twenty-six
had been met at **eleven**, which is 0207b's frozen cast wearing this ticket's
clothes.

Running it **after** the drift step, the year is charged first and keeping up
claws some of it back. That is also the version in which the arithmetic above
means anything.

And the first version handed out **one warmth-weighted lottery slot a year**,
which could not clear either failure: before the drift it froze the cast, after
it the trough barely moved (77.8% at twenty against 87.8% before), because a
nineteen-year-old has three or four people out of the room and one slot meant
three of them drifted every year regardless of who they were. One lottery is
also the wrong shape for the thing: whether you keep up with somebody is not a
competition between your friends, it is a fact about each friendship. Every
keepable person gets their own roll now, closeness is most of it, and what bounds
the step is the arithmetic rather than the slot.

## Measured

Same 90 seeds, before and after:

|                                                    | before              | after            |
| -------------------------------------------------- | ------------------- | ---------------- |
| share with no friend at 14                         | **84.4%**           | **31.1%**        |
| share with no friend at 19                         | **88.9%**           | **51.1%**        |
| share with no friend at 20                         | **87.8%**           | **60.0%**        |
| closest friend at 45, p10 / med / p90              | **100 / 100 / 100** | **84 / 95 / 96** |
| closest friend at 45 pinned at the cap             | **90.9%**           | **0.0%**         |
| pooled platonic warmth at 40, p10 / med            | 34 / **100**        | 35 / **83**      |
| pooled at 40, share at or above 90                 | 64.9%               | 33.4%            |
| adult years naming somebody                        | 19.5%               | 33.1%            |
| share of the circle at 26 met since school         | —                   | 89.2%            |
| lives still holding somebody from before 17, at 26 | —                   | 46.0%            |

The turnover numbers have no "before" because the question could not arise: a
friendship that had left the room had nothing holding it, so there was almost
nothing to still be holding. The pair of them is now the instrument
`adult-social.test.ts` uses, and restoring 0207b's original bug takes the first
from 89.2% to **50.8%**.

## Five tests broke, and none of them was this ticket's code

0412 changes what a year does to warmth, which shifts the Relationships stream,
which shifts every downstream draw in every played life. Four of these were
latent defects that a different set of lives finally exercised.

- **`advance.test.ts` found five interaction lines that never name the person.**
  _"It was fine. It was exactly fine, all afternoon, and you both felt it."_ —
  on somebody's page, as their memory of you. Wrong since 0206, and invisible for
  six tickets because nothing but a button had ever written one of these memories
  and a simulated life never presses a button. Two of the five also broke writing
  rule 10 (a line that only evaluates the year). `keeping-up.test.ts` now asserts
  the invariant over every line the menu can write, at every phrasing and
  rotation, which is where it belongs.
- **`guardians.test.ts` caught the seventh occurrence of the same repeat bug**,
  and this one was a whole subsystem rather than one writer: the event selector
  drew its phrasing with a fresh `random.pick` every year, for all 444 events.
  Correct for five tickets, because nothing could fire two years running until
  0409 wrote four events with `cooldown: 1` — so an unemployed character had a
  **one-in-three chance every year** of reading the same sentence about the same
  applications twice. New rule **13.73**, and the fix is the one that file's own
  comment already states: the base holds still for the life and age does all the
  moving.
- **`investing.test.ts` had the 0409/0410/0411 shortcut in two more costumes**,
  and nine tests failed at `invest(...).ok` with nothing whatever wrong near the
  market. One was `invested()` — one seed, stopped at a birthday, hoping — and
  the other was a **local `richEnough` shadowing the fixed module-level one and
  doing the old thing under the fixed one's name.** That is the worst version of
  it, because the name is what a reader checks. New rule **13.72**.
- **`life-offer.test.ts` asserted the wrong wedding floor, and 0410 wrote it.**
  It reasoned _"one year at seeing, two at together, one at engaged, all counted
  from adulthood"_ and concluded 22. The ladder's real floor is **21**: `together`
  is a stage a sixteen-year-old may hold, so `yearsShort` counts that year from
  `since` rather than from adulthood and a couple can arrive at eighteen having
  already served it. It passed for two tickets because no school couple had ever
  reached a wedding. `romance.test.ts` now pins both ends against `movesFor`
  itself — a minimum over sixty lives is an extreme-value statistic and the worst
  possible instrument for a hard floor.
- **`adult-social.test.ts` was measuring a circle with the age of its oldest
  member.** Both its absolute claims used `min(metAtAge)`, and about two lives in
  five now keep ONE person from before seventeen — so the mean of the minimum
  fell to 14.4 while the thing the threshold is about got _better_: 89.2% of the
  circle at twenty-six is people met since school. A lifelong friend is not
  0207b's bug; 0207b's bug was that there was no turnover at all. Third
  instrument for that claim, the first two both proxies, and this one is
  sabotage-verified against the original defect.

## Verified

- `pnpm typecheck` — 15/15. `pnpm test` — **974/974**. Validator — 1,032 ids,
  clean. The validator earned its keep on this ticket's own test file, twice.
- Thirteen assertions in `keeping-up.test.ts` against the pure functions,
  sabotage-verified six ways: removing the curve turns three red; `UNCHOSEN` at
  0.4 and at 1.2 each turn one; dropping the in-room filter turns one; putting
  heavy verbs on the menu turns one; reverting the rotation parameter turns one.
- Five in `friendship.test.ts` against 90 played lives, sabotage-verified five
  ways: removing the step entirely turns two red, un-curving the proximity gain
  turns the ratchet red, running the step before the drift turns the ratchet and
  the frozen-cast bound red, and writing no memory turns the naming one red.
- The trough assertion is made across **every** age from 12 to 60 rather than at
  the three that were worst, so a future ticket that moves a school stage cannot
  open the same hole somewhere else and pass.

## Still rough

**Twenty is still the loneliest year in the game, at 60–67% with no friend.** It
is a 28-point improvement and it is not solved. The remaining cause is real and
out of scope: a character who has left school has work and the street and nothing
else, because `education.activities` only exists while they are at school — the
same gap 0211 measured as _"nobody over eighteen is an athlete in this build"_.
Until an adult can join something, the years between the class ending and the
work crew warming up have two doors instead of three.

**Nothing says what happens between two people who see each other every day.**
The step reaches the complement of the room, so the colleague of fifteen years
sitting at 95 warmth has an empty page. That is why adult years naming somebody
is 33% and not 70%, and it is the content half of this roadmap item rather than a
defect in this one: **six adult `friendship` events, all romance, and no adult
friendship decision at all.** The predicates to write them against now exist, and
that is the next ticket.

A long friendship still converges near the top — closest friend at sixty-five
runs p10 80 / median 96. The curve makes the ceiling asymptotic rather than
absolute (a +4 gain rounds to nothing above about 95, while a failed year still
costs), which is what holds it at 96 instead of 100, but somebody you have been
in a room with for forty years will end up close to the cap. That reads as
honest rather than broken, and it is worth watching if `WORK_CREW` tenure grows.

## Later follow-ups

The adult friendship content shipped in 0413. Adult pursuits shipped in 0416,
which measured no friend at twenty falling from 58% to 30% on its sample. The
"next ticket" and school-only activity limit above describe the 0412 build.
The thin in-room colleague page remains a recorded limitation.
