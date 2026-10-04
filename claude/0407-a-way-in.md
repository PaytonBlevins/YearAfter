# Ticket 0407 — the way in

0406's baseline measurement, not a review: **a passive player never gets a job.
Ever. 0 of 250 lives.**

`withAnyOffer` opened with

```ts
const held = state.employment.job;
if (!held) return state;
```

0402 built a POACHING mechanic — a better offer for somebody who already works
— and it was correct to refuse firing for somebody with nothing to be poached
from. It was also the only systemic career door the game had, so nothing in the
build ever put a FIRST job in front of a player who did not go to the Career
screen and apply.

## What that cost

|                                           | before      | after    |
| ----------------------------------------- | ----------- | -------- |
| passive lives that ever held a job        | **0/250**   | 247/250  |
| idle adult years (18–64)                  | 11,419      | 365      |
| listings going, unclaimed, in those years | 68,514      | 2,190    |
| died with nothing                         | **248/250** | 4/250    |
| median cash at death                      | $0          | $113,941 |
| reached a university degree               | 38/250      | 204/250  |
| reached postgraduate                      | **0**       | 21/250   |

One probed life reached **age 60 with no job, $0, and no credentials**, while
six listings sat available in every one of its adult years.

And the sharpest number: of the 91 decisions the game raised to an adult across
all 250 lives, **every single one was 0405's college offer**. It was the only
question the game asked a grown-up.

The postgraduate row is the downstream half. 0406 recorded zero passive lives
reaching graduate school and said it was not that ticket's doing; this is why.
Graduate tuition runs $12,000–$34,000 a year with no parental support, and a
population that never earns anything cannot fund it. The education ceiling was
downstream of the employment floor the whole time.

## What it is

**One door with its other half built**, not a second offer. `JobOffer.fromJobId`
became optional — absent means "you have no job" — and everything else is
shared: the same `answerOffer`, the same `career.offer` event id, the same
`decide` branch, the same save field. Only the copy and the resignation record
differ. A second offer type would have been a second thing to keep in step for
no gain.

It is **an offer, not a job**. It can be turned down, and `cannotApply` decides
what may be offered exactly as it decides what may be applied for — the game
does not route around its own gate to be generous.

**What is offered is one of the jobs that were actually going.** `openings` is
the six listings that character would have seen on the Career screen that year,
already gated and already weighted. Drawing from that same list means the
systemic door and the screen can never disagree about what was available, and it
costs no RNG: `openings` draws with `stableUnit`.

**The chance reflects employability.** A flat 50% was built first and measured
first. It worked — 247 of 250 found work — and it worked _identically for a
dropout and a postgraduate_, which makes the entire education system irrelevant
to the one outcome it should matter most for. So it reads what an employer
reads:

| education reached | idle years per life | ever worked |
| ----------------- | ------------------- | ----------- |
| none              | **4.4**             | 21/23       |
| high school       | 1.1                 | 23/23       |
| university        | 1.3                 | 325/325     |
| postgraduate      | **0.6**             | 29/29       |

Unemployment stays reachable on purpose. 0303's living model has real
consequences for a character with no income and they should be possible to meet.

Save **v28 → v29**, no migration content: a v28 save cannot hold an offer
without a `fromJobId`, because the build that wrote it never made one.

## Four things this broke, and what each one turned out to be

Every one was a population shift, and only one was a bound that needed moving.

- **A test was asserting the bug.** `offers.test.ts` had _"never arrives for
  somebody with no job, or somebody who has stopped"_ — a guarantee that an
  unemployed adult would never be offered work. True, deliberate in 0402, and
  the exact line that left 250 of 250 unemployable. A test can pin a defect in
  place as firmly as it pins a feature, and the more precisely it is worded the
  harder it is to see which one it is doing. The retirement half survives; the
  other half is now asserted the right way up.

- **And its retirement half had never run.** Rewriting it with a sabotage guard
  showed no life in twenty ever retires — retiring is an action the player
  presses, and a harness that answers decisions never presses it. So that half
  was green because the state it describes never occurred. It is asserted
  directly now.

- **A real producer collision.** `careers.test.ts`'s job-hop invariant found six
  `:dup` ids in one life. A character can now be offered a job, resign from it,
  be hired back into the same job and resign again inside one year, and
  `t:<year>:resign:<jobId>` is written twice. The `:dup` suffix is a net for
  React, not permission to collide (13.22). Career entry ids now carry the
  sequence.

- **Adoption became unreachable.** `family.test.ts` reached it incidentally —
  some seeds simply failed to find a partner and fell through. Romantic moves
  are priced, so a population with income is a population that pairs off, and
  nobody was single at twenty-four any more. The test was borrowing somebody
  else's bad luck. It now plays a cohort that never pursues anyone, which is
  what "the route that needs nobody" actually claims.

## And three real defects in the listings, found by 0401's guard

0407 got enough characters working to climb ladders, which made far more of them
eligible for the top of one — and 0401's starvation guard (no job may be
eligible to somebody and unreachable by the listings) went red. All three were
genuine.

- **Every character alive in a given year saw the same six jobs.** The draw was
  `stableUnit(year:jobId)`, so a job that drew badly was invisible to the entire
  population at once rather than to one unlucky person. The key now includes the
  character. This makes no single job likelier for any single person; it
  decorrelates the population, so a rare job is rare rather than absent.

- **A license did not put its own profession on your noticeboard.** Senior
  associate, Practice owner, Pharmacy manager and Director of pharmacy were
  eligible to somebody and listed to nobody. A licensed pharmacist competing for
  six slots against a hundred rows they merely qualify for is not how holding a
  license works. Licensed tracks now weight ×2.4, stacking with the step-up.

- **`prefers` was charged twice.** VP of marketing (`requires: none`,
  `prefers: university`) was eligible to a non-graduate who had climbed office to
  rung three, and listed to nobody — the one top job they could reach was the
  one the draw penalised them for reaching. `hireChance` already charges −0.24
  for a soft credential; halving the listing weight as well is the same lever
  twice, which is the objection `reachOf`'s own docblock raises. The penalty now
  applies to cold starts only, not to a ladder you have climbed.

I also tried two fixes that the measurement rejected, which is worth recording:
raising the sample from 250 to 420 lives made starvation **worse** (four jobs,
not two — so it was not a coverage problem), and scoping the guard to "eligible
for at least three years" did not clear it either. The first version of that
scoping was also wrong in a way worth naming: it summed eligibility years across
the population, so three people with one year each read as three years of
exposure. It is the longest single life that matters.

## Verified

- `pnpm typecheck` — 15/15.
- `pnpm test` — 929/929.
- `node tools/content-validator/validate.mjs` — 10 catalogs, 962 ids, clean.
- `offers.test.ts` — two new assertions, sabotage-verified: restoring the one
  line `if (!held) return state` turns both red.
- 0401's starvation guard back to zero.

## Still open

The passive numbers above are a player who answers **yes to everything**, which
is what `choices[0]` means. 204 of 250 reaching a university degree is that
harness, not a realistic population — the game now offers college and offers
work, and this measurement accepts both every time. What a real passive player
does is a different question and a better one; it needs a harness that sometimes
declines, and that belongs with the balance pass rather than here.
