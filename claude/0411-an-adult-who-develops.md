# Ticket 0411 — an adult who develops

Roadmap finding 2, open since 0211 and never picked up: _"Smarts and Discipline
never move after eighteen. An adult character does not develop."_

It was not a tendency. Measured on 200 played lives:

| Discipline         | age 18       | age 30       | age 45       |
| ------------------ | ------------ | ------------ | ------------ |
| p10 / median / p90 | 50 / 65 / 83 | 50 / 65 / 83 | 50 / 65 / 83 |
| sd                 | 12.0         | 12.0         | 12.0         |

The same three numbers at every age, to the decimal, because nothing in the
build wrote that stat after eighteen.

## And the stat that _did_ move was worse

Charisma is the one thing adult events touch, and it does not develop a
population, it dissolves one:

| Charisma  | age 18  | age 30  | age 45      |
| --------- | ------- | ------- | ----------- |
| p10 / p90 | 58 / 85 | 73 / 90 | **84 / 94** |
| sd        | 9.7     | 6.5     | **3.8**     |

Everybody climbs until `curvedDelta` stops them, and it stops everybody in the
same place. At forty-five, all seven of the commonest career tracks produced a
character with charisma between **89 and 92**: twenty years of driving a truck
and twenty years of writing software left the same person.

The cause is in the catalog and it is one-sided. Of the 91 events that can fire
at forty: **Smarts +14/−0, Discipline +1/−0, Charisma +26/−0, Looks +0/−0.**
One positive Discipline effect in the whole adult library, and not a single
negative anything. A twelve-year-old has 234 events available offering 70
Discipline gains and 11 losses. An adult has a ratchet.

New rule **13.70**: a one-way ratchet flattens a population as surely as a
damping curve does. 13.66 caught the curve; this is the other half of it.

## And Looks was not a stat at all

**52 at eighteen, 52 at thirty, 52 at forty-five.** Nothing in fourteen tickets
has ever written it — not school, not work, not illness, not one of the 444
events. A bar the player has been looking at since 0106 was a constant after
character generation. CORE_RULES 13.36, for the fourth time.

## What it is

**What a track hires for is what it builds in you.** `TRACK_WANTS` is the table
`hireChance` already reads to decide what a kind of work is made of, every row
summing to about 0.44 so no track is easier overall. `workYearGrowth` uses the
same table as a growth allocator: a stat at or above 0.14 is one the work uses,
at or below 0.08 is one you get out of practice at, and the middle does nothing.
One table, two uses, no new content to keep in step.

- Logistics wants steadiness (0.34) and nothing else. Twenty years of it builds
  Discipline and lets the head work go.
- Tech is the mirror. Care is the only row that wants all three, which is both
  what the table says and true.
- **Banded, not a rate.** 0408's lesson taken as read: `curvedDelta` rounds to
  whole points, so a fractional rate floors to zero and never arrives, and a
  flat push is the equalising machine that flattened school. The able-and-doing-
  well gain two; somebody weak at what the job wants has to have a good year to
  move at all.
- **A bad year teaches nothing**, and a twentieth year in the same chair teaches
  nothing either. A promotion resets the clock, which is the intended reading
  rather than a side effect: a career that goes somewhere keeps developing the
  person.
- **An idle year costs Discipline**, from the second one on. 0407 made
  unemployment reachable on purpose and the only thing it ever cost was money.
  Idle years are derived from `JobPast.to` rather than stored (13.19).
- **Rusty is not incapable.** Neglect floors at 42 — `curvedDelta` would stop it
  on its own at about twenty-five, and a thirty-year tech career should not leave
  somebody unable to hold a conversation.

**And a face that ages.** `looksDrift` lives in the health package, because a
career is not what ages a face and the age curve already lives there. One point
every few years — the interval carries the rate, for the whole-points reason
above — and **health sets the interval**, which is the point of putting it there:
somebody who has kept themselves well ages more slowly, a claim the build can
only make honestly because 0408 gave constitution a real range. Keyed on age, so
it consumes no randomness and a reload cannot change how somebody has aged.

## Measured

| on the same 200 seeds         | before          | after           |
| ----------------------------- | --------------- | --------------- |
| Discipline sd at 18 / 45      | 12.0 / **12.0** | 11.9 / **14.5** |
| Charisma sd at 18 / 45        | 9.7 / **3.8**   | 9.5 / **8.3**   |
| Smarts sd at 45               | 10.0            | 12.0            |
| Looks, median at 18 / 45 / 60 | 52 / 52 / 50    | 52 / 45 / 38    |

And the thing the spread is made of — median stats at forty-five, by the track
they were working:

| track     | before (smarts / disc / char) | after            |
| --------- | ----------------------------- | ---------------- |
| logistics | 81 / 69 / 90                  | **64 / 76 / 76** |
| tech      | 84 / 68 / 91                  | **85 / 50 / 80** |
| trades    | 87 / 73 / 91                  | 87 / **76** / 77 |
| food      | 85 / 70 / 92                  | **67** / 70 / 92 |
| care      | 90 / 67 / 91                  | 90 / 67 / 90     |

Before, every row agreed. After, a logistics lifer is a steady person who has
stopped reading and a tech lifer is the reverse — and care, the one job that
asks for everything, is the one row that barely moves.

## Verified

- `pnpm typecheck` — 15/15. `pnpm test` — **954/954**. Validator — 1,032 ids,
  clean.
- Seven assertions in `growth.test.ts` against the pure function,
  sabotage-verified: removing the neglect branch turns one red, replacing the
  banding with a flat `return 1` turns three red.
- Four in `development.test.ts` against 150 played lives, sabotage-verified:
  not applying the work growth turns three red, not applying the looks drift
  turns the fourth.
- One test broke: `investing.test.ts`'s `richEnough`, which 0410 wrote — see
  below.

## Two mistakes of my own

- **The first version of `development.test.ts` compared cohorts.** Everybody at
  eighteen against the survivors at forty-five — and two of its four assertions
  then passed with the entire mechanism removed, because who lives moves a
  distribution too. The "the job is legible in who they became" one was worse
  than useless: `hireChance` reads Discipline, so disciplined people were always
  likelier to end up in logistics, and comparing levels measured hiring rather
  than development. Both are now paired per life against the character's own
  eighteen-year-old self. Caught by sabotage before it shipped rather than two
  tickets later.

- **0410 shipped a type error, and this ticket found it.** `pnpm typecheck` was
  green, then a persistence test was added, sabotage-verified with `vitest`, and
  pushed. `vitest` does not typecheck, so 942 green tests said nothing about a
  `PendingDecision` literal missing its `category`. The gate ran before the last
  edit rather than after it. New rule **13.71**, and the fixed file is in this
  ticket's push.

- And `richEnough`, the harness 0410 added, had the same shortcut in a third
  costume: it played on until the balance was there and then returned whatever
  it had when it ran out of years. 0411 changed what a career does to Discipline,
  Discipline is what `performanceTarget` reads, and the pay follows performance —
  so it handed back a character holding $4,795 against a request for $250,000.
  It tries other lives now, and returns the best attempt when none of them get
  rich, so the assertion fails on a real number rather than a silent substitution.

## Still open

Smarts still only moves about three points across a working life in the median
case, against Discipline's spread. The tracks that want head work mostly want it
at 0.2–0.34 and the characters in them are usually already at 85, where
`curvedDelta` gives back almost nothing. That is the curve doing its job rather
than a defect, but it means "getting cleverer at work" is a real thing only for
somebody who started ordinary.

Nothing outside a job develops anybody. Study, a hobby, raising a child and
being ill are all things that change a person and none of them touch a stat in
adulthood — the same hole this ticket closed for work, four more times. That is
the honest next step and it is a content ticket rather than a mechanism one now
that the mechanism exists.

## Later follow-ups

0415 checked the outside-work gap: college study already moved Smarts, while
parenting, illness and hard years gained shaping rules. The hobby followed in 0416. The closing list is the pre-0415 finding, not four currently missing systems.
