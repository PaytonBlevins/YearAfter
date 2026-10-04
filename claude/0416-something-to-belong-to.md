# Ticket 0416 — something to belong to

Roadmap finding 2g, from 0415: *"An adult cannot join anything."* Three findings
had one cause: 2c's hobby had nothing to be, 2b's "twenty is the loneliest year"
left an adult with two ways to meet people instead of three, and 0211 found
nobody over eighteen was an athlete.

## Measured first: nobody joined anything, ever

120 played lives, answering every question the game asks:

| | before |
|---|---|
| lives that EVER joined anything, at any age | **0 of 120** |
| share in an activity, at any age from 0 to 85 | **0%** |
| adult years in a sport | **0%** |
| people met as an adult "through something you do" | **0** |

The finding said adults. It was everybody. Every verb in `joining.ts` and
`tryout.ts` sits behind the Clubs & Teams screen, and nothing ever calls them on
a player's behalf. So everything these systems built was out of reach for a
player who never opened that screen:

- 0204's twenty-five activities;
- 0206b's tryouts, practice, seasons and teammates;
- 0209's parent paying for it;
- 0210's "something you still do" meeting door.

It's the fourth door of this shape, after 0405 (college), 0407 (a first job) and
0410 (a private life).

An adult was worse off still: there was no list to join from. Graduation emptied
`education.activities`, and nothing could ever fill it again.

## What it is

**An adult list.** Ten ordinary pursuits:

- a Sunday rec league and a running club;
- a community choir, a community theater (by audition) and a band;
- an evening class and a book club;
- a quiz team, volunteering and a community garden plot.

Three have fees. Gym, meditation and martial arts are left out on purpose: spec
1355 gives those to Mind & Body. `SchoolStageId` gains `adult`, meaning anybody
eighteen or over who isn't in K-12 — at college, working, or neither.

**The door.** A `PendingDecision`, the same shape as the other four doors:

- **Frequency:** a child is asked 25% of years with nothing and 10% with one
  thing. An adult is asked 14% and 5%. Nobody is asked with two already.
- **It runs the real verb.** Saying yes calls `tryOut` for a team or an
  audition, and `askToJoin` when a parent has to pay. A child can be cut, or
  told no, exactly as a tap would allow.
- **It asks last.** One systemic question a year has been the rule since 0410.
  A league sign-up should never be why a job, a college place or a wedding went
  unasked.
- **Talent pulls the draw.** A child with athletics is asked about sport three
  times as often.

**The adult year** (`pursuits.ts`) is small, because almost everything an
activity does was already wired to that list and simply never reached:

- **Already wired:** the teammates on joining, the warmth of sharing a room,
  0210's meeting door, the health phase's athletes, and the stress phase's hours.
- **New: the fees.** They go through the ledger as `spending`. Affordability is
  read off the household's standard of living, never the current account — a
  player with everything in a fund is not someone who can't afford a league
  (13.53's rule).
- **New: people put things down.** A pursuit lapses 10% of years, or 30% in a
  year spent struggling, and the leave line says so.

**The hobby half of 2c.** A pursuit builds the one trait it is most about, one
point a year for its first five seasons, in a year you held together, plus a
point of happiness in any year you did. This runs through 0415's `lifeShaping`
and its one-point-per-stat cap.

**The app.** Clubs & Teams now appears for adults too.

**Save v30 → v31** adds `pursuitOffer`. The migration repairs a v30 save holding
an unanswerable `activity.offer`, the same as v30 did for 0410.

## Measured

Same 120 seeds, door on and off:

| | before | after |
|---|---|---|
| lives ever in anything | **0 / 120** | 120 / 120 |
| in something at 12 / 14 / 16 | 0% | 77% / 70% / 75% |
| adults in a pursuit at 30 / 40 / 60 | 0% | 31% / 41% / 39% |
| adult years in a sport | **0%** | 7.0% |
| people met as an adult through something they do | **0** | 730 |
| no friend at 14 / 19 / 20 | 23% / 53% / **58%** | 11% / 28% / **30%** |
| adult years spent struggling | 14.0% | 14.6% |

On the test file's own 100 lives, adult pursuits end at 13.5% per year held.
Hours from a pursuit barely move adult stress.

**Twenty was the loneliest year in the game**, and it's half as lonely now. It is
still the peak, because an eighteen-year-old has only just been offered anything.

## Five tests broke, and none of them was this ticket's code

- **`guardians.test.ts` found a real bug, dormant for twelve tickets.** The
  standing activity-fee line printed *"Another $70 went on scout dues"* every
  year from a child's second season. It also re-announced a paid club's fees as
  news the year after joining a free one. Neither had ever been reached, because
  no life a test played had joined anything. It now rotates by age, and "first
  year" means a year a costed thing was new.
- **`adult-social.test.ts` "is once a year"** used one seed and assumed the
  character would be single at twenty-two. Now that adults have somewhere to meet
  people, that seed wasn't single. The harness now finds a single adult rather
  than hoping for one (13.72).
- **Two extreme-value instruments** — each life's *closest* friend and each
  life's *earliest* person. More friends makes the maximum higher and the minimum
  lower, whatever happens to each friendship. Every friendship at fifty-five was
  actually *wider* than before. Replaced by each life's median friendship and a
  share. New rule **13.80**. The first replacement couldn't see 0412's bug when
  it was restored, so it was replaced again before shipping.
- **`floor.test.ts`'s 3% band was sitting inside its own noise.** Two disjoint
  samples of the same build differ by seven or eight points. Restoring the
  subsidy it guards reads −35%. At 200 lives this ticket moves the number 0.4
  points. The band is now 10%, with both measurements written next to it. New
  rule **13.81**.

## Verified

- `pnpm typecheck` — 15/15. `pnpm test` — **1,018/1,018**. Validator — **1,141
  ids**, clean. It caught "theatre" and "are not" in the new pursuits; the id is
  `act.adult.theater` from birth.
- **Nine tests in `pursuits.test.ts`.** One caught a bug in my own copy: the
  "still going" line indexed on age plus seasons. Both climb by one a year, so
  every third season moved the index by six — zero modulo three. That meant the
  same sentence every time, for as long as somebody kept going.
- **Six in `belonging.test.ts`**, each turned red by at least one of four
  sabotages:
  - switching the door off turns five red;
  - pursuits that never lapse turn two red;
  - ignoring the one-question rule turns one red;
  - unwiring the growth turns one red.
- **The persistence round-trip and the v30 repair** each go red when their line
  is removed.

## Still rough

- **Children are asked more than reality would bear**: 70–77% of a yes-to-
  everything population is in something by twelve, against roughly 57%
  nationally. A real player declines some, and the rates are written as not
  tuned, but it's the high side.
- **School activities still pay a flat stat effect every year**, which is 0204's
  design. Now that it's reachable, school performance at sixteen rises (p10 43 →
  55). Smarts at eighteen still runs sd 12.6 with a minimum of 33, and 0408's
  guards stay green. It's the 13.66 shape, reachable for the first time, so it's
  worth watching.
- **Mind & Body's Gym, Meditation, Books/Library, Diet and Walk rows are
  labelled `v0.04`**, which is now finished. Nothing owns them. Logged as a
  finding rather than relabelled with another guess.
- **A dropout of sixteen can join nothing**: too old for the school's list and
  too young for the adult one. It's a small, honest gap.
