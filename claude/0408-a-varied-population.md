# Ticket 0408 — a population worth simulating

The roadmap has carried this as finding 1 since 0211 and it has been the first
line of the suggested order ever since: *"This build cannot produce a poor
student."* School performance at sixteen ran p10 67, median 78, **minimum 50
across 500 lives**. Everything downstream inherited the flatness, and 0406 and
0407 made it acute — with college offered and work offered, 91% of lives
finished a degree.

The roadmap pointed at character generation. Generation was the floor under it,
but it was not the mechanism.

## What was actually happening

Every stat delta in this build goes through `curvedDelta` (0203): **a gain is
full strength at 50 and tapers to nothing at 100.** That curve exists for a good
reason — a childhood is forty events, and without it every character arrived at
eighteen above average at everything.

School then pushed a flat `+1` Smarts a year, `+3` for working hard, at
everybody, for thirteen years.

Those two together are an equalising machine. The same flat push is worth 1.2×
to a child on forty Smarts and 0.6× to one on seventy, so school handed its
biggest gains to the students least able to use them, every year, for thirteen
years. An equalising curve applied to aptitude equalises aptitude.

| | before | after |
|---|---|---|
| Smarts at birth, p10 / median | 44 / 56 | 38 / 55 |
| **Smarts at eighteen, minimum** | **56** | **34** |
| Smarts at eighteen, p10 | 70 | 54 |
| school performance at 16, minimum | 50 | 26 |
| school performance at 16, sd | 7.7 | **17.4** |
| dropped out | 13/500 | 36/500 |
| failed out of college | 81/500 | 106/500 |
| finished no qualification at all | 14/500 | 38/500 |
| finished a degree | 457/500 | 412/500 |

Nobody in this game was below average as an adult. Now the bottom of the
distribution is a real place.

## What changed

**Two things, and the second is the one that mattered.**

- The birth roll. `aroundCentre` averaged four uniform draws, which puts the
  standard deviation at 0.144 of the band — measured as sd 9 on every stat. The
  number of draws is now a parameter and birth attributes use two, on a slightly
  wider band. sd 9 → 15.
- School's Smarts gain scales with aptitude. Coarse bands rather than a rate,
  because `curvedDelta` rounds to whole points and a fractional rate would
  quietly floor to zero. Effort still moves everybody, and is worth *more* to a
  struggling student than the passage of time is — spec 1821 keeps Study Harder
  as the player's lever.

**And a third, which the measurement turned up on the way.** `frailtyFactor`
returned 1 for anybody at or above the healthy-adult mark: *"being well is not a
bonus, it is the baseline."* That was a reasonable call when nobody was
meaningfully robust. With a wider roll it became the finding instead — across a
sixty-eight point range of birth health, median age at death moved **four
years**, and not monotonically. That is the same shape 0212 recorded for NPCs
(*"4.9 years, which is another way of saying constitution did not exist"*) and
fixed for NPCs only. The multiplier is two-sided now, bounded, and the
sudden-death floor is clamped out of its reach — a strong constitution buys odds
against what accumulates and nothing against a car crash.

## An honest limit

Widening health did **not** buy much lifespan variation: death sd moved 9.4 →
10.3. The stat itself differentiates strongly — median health at sixty-five runs
23 for the frailest fifth against 57 for the most robust — but every quintile is
below the healthy-adult mark by then, so the Gompertz age term dominates and the
frailty multiplier is fighting a doubling every seven and a half years.

That is a finding, not a fix, and it belongs to whoever owns 0211's mortality
model rather than to this ticket. It is written down rather than tuned away.

## A bug of my own, found by measuring

The reachability guard went red on Architect: eligible to somebody for **eleven
years** and never once listed. At its weighting that should have surfaced
repeatedly, so it was not draw luck.

The character held **eight licenses** — culinary, CDL, paramedic, practical
nursing, electrical, IT, HVAC and architecture. 0405's certain trigger fires the
year education ends, which was written when the only things that could end were
school and a degree. 0406 added the vocational tier and made it a treadmill:
finish a certificate, `finishedAtAge` equals your age, an offer is raised that
same year, accept, finish, be offered another.

It then broke the thing it collided with. 0407's license weighting boosts the
listings for a track you are licensed in; somebody licensed in eight tracks gets
the boost on nearly everything, so it stopped discriminating and a genuinely
rare job went invisible.

The certain trigger now fires for the two moments it was written for — leaving
school, and finishing a degree that opens the next one. A certificate leaves the
education level untouched by design (13.64) and leaves this door shut with it.
Licenses held now run median 1, p90 3.

## And one I nearly reported that did not exist

My first probe said *"failed out of college: 0 of 500"* and I had most of a
paragraph written about a dead branch before checking it. The branch fires 195
times in 200 lives. The probe scanned `timeline.slice(-3)` each year — a sliding
three-entry window, and a year can write more than three entries, so it walked
straight past the thing it was looking for.

The pre-0408 figure was 81 in 500, not zero. Measuring the wrong thing
confidently is worse than not measuring, and it nearly went into a ticket
document as a finding.

## Six tests broke, and not one of them was a bug in the game

- **`health.test.ts` asserted the design I changed** — `frailtyFactor(100) === 1`,
  pinned deliberately. Rewritten to assert the shape: baseline at the healthy
  mark, bounded gain above, steeper penalty below. CORE_RULES 13.65's second
  outing.
- **`advance.test.ts` pinned zero maxed stats.** Right while the roll topped out
  at 88 and clustered hard — "inflation is gone" and "nobody is exceptional"
  were the same measurement. Now a proportion, because what 0203 protected
  against is a stat *everybody* maxes.
- **`advance.test.ts` compared two random draws.** "The second term is worth less
  than the first" is not something the model promises: `studyHarder` scales a
  random magnitude, so a lucky second term beats an unlucky first whatever the
  scale is. It passed on seed luck. The scaling is now asserted against the
  function with the draw held fixed.
- **`adult-social.test.ts` used headcount as a proxy** for "the class did not
  stay". A sociable adult legitimately knows more people at twenty-six than at
  school. It failed by 0.6%, which is the size of measuring the wrong thing.
  `earliestMetAt` measures the actual claim, and passes with margin (19).
- **`careers.test.ts`'s insider claim was false at rung one.** An experienced
  stranger and a rung-0 insider are identical there by design —
  `TRANSFERABLE_AFTER` grants a reach floor of 0 to anyone with eight years, so
  `gap` is zero either way. It passed for four tickets because characters used
  to be jobless most of their lives; **0407** gave them careers and 0408 changed
  the seed. Asserted one rung up, where the distinction exists.
- **`careers.test.ts`'s pooled hire rate moved to 78%.** A pooled average cannot
  tell "everybody is hired 78% of the time" from "some walk in and others are
  turned away repeatedly", and those are opposite answers to the question it
  asks. Bound moved, and the spread it was standing in for is now asserted
  directly.

## Verified

- `pnpm typecheck` — 15/15.
- `pnpm test` — 932/932.
- `node tools/content-validator/validate.mjs` — 10 catalogs, 962 ids, clean.
- New guard in `new-game.test.ts`, two assertions pulling against each other —
  sabotage-verified: reverting both changes drops adult Smarts sd from 13.5 to
  5.6 and fails it.

## Still rough

Licenses held peaks at nine in the tail — a character who never earns a degree
can still collect certificates at the standing 35% for decades. Median 1 and p90
3 is a sane distribution and the treadmill's driver is gone, so this is noted
rather than tuned.

Degree attainment is still 82%. That is 0405/0406's door and a harness that
accepts every offer, not character generation — a realistic passive player needs
a harness that sometimes declines, which belongs with the balance pass.
