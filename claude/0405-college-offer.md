# Ticket 0405 — the question the game never asked you

0403's own reachability report named this one: 33 of 147 jobs are
credential-gated, and every single one of them was invisible to a player who
never navigated to the College screen — because nothing in this build had
ever called `applyToCollege` on anybody's behalf. 0402 built the door for
exactly this shape of problem on the career side (`packages/simulation/src
/offers.ts`, the reserved id its own docblock left for school); 0405 uses it.

## What "passive" actually meant

0210b measured a passive player as "one application at eighteen, never asks
a parent" and got 10.5% degrees against 71% for a player who applied every
year. Re-measured today, before this ticket, that same definition returns
54.3% degrees, 0% postgraduate — 0307's student loans and 0210b's own
automatic parental funding closed most of that gap already, for anybody who
at least pressed Apply once.

The number that matters is a different one: a player who never opens the
College screen **at all** gets a degree **0% of the time, forever**, on
every build up to and including 0403's. That is the population 0405 is
about, and it is also 0402's own population — the whole premise of a
systemic offer is that no screen has to be found for the question to be
asked.

## What it is

`packages/simulation/src/college-offer.ts`, built to the same shape as
`offers.ts`:

- `COLLEGE_OFFER_EVENT_ID` (`'education.offer'`) is a new reserved decision
  id, resolved through the same `decide()` branch 0402 added rather than
  through `@yearafter/events` — a major cannot be authored content any more
  than a job can.
- `withCollegeOffer`, called at the end of `advanceYear`, ahead of
  `withAnyOffer`. **Certain the year a character leaves school**
  (`education.finishedAtAge === player.age` — true whether that is a
  high-school graduation or a finished bachelor's making postgrad the next
  question), because that is the actual moment somebody is asked "so what's
  next." A **standing 35% chance every year after**, for anybody who stayed
  eligible and either declined or was turned down — real enough to matter,
  not certain enough to read as an annual summons. Both numbers are the same
  shape 0402 used (a certain trigger, a bounded chance elsewhere) rather than
  new levers invented for this ticket.
- Answering "Apply" hands straight to the existing `applyToCollege` —
  **the exact same admission roll a player who found the screen would have
  gotten**, with a major drawn per-character from the RNG stream rather than
  duplicating any admission math. This decision is about being asked, not
  about getting in for free.
- `CollegeOffer` (`game-state.ts`, beside `JobOffer` for the same reason:
  `@yearafter/events` must never learn what a major is) rides alongside the
  pending decision, freezing the drawn major so an answer given on a later
  day matches the question that was asked.
- Save **v26 → v27**. One optional field, no migration content, for the same
  reason 0402's `offer` field needed none: a save from before this door
  existed was never asked its question.

## Measured

The reachability guard's own acceptance number, `reachability.test.ts`:

|                                                         | before 0405 | after     |
| ------------------------------------------------------- | ----------- | --------- |
| credential-gated jobs never shown to anybody, 250 lives | 33/147      | **0/147** |

And the passive-vs-determined gap, re-measured with the systemic door wired
in and a player who always answers with whatever the game leads with (the
honest model of "passive" — not manually seeking the screen out, not
declining out of caution either):

|                                                                             | degree | postgraduate |
| --------------------------------------------------------------------------- | ------ | ------------ |
| determined (still applies manually every eligible year, on top of the door) | 95.3%  | 92.0%        |
| passive (only ever answers the systemic offer)                              | 94.3%  | 88.0%        |

The gap 0210b measured at 60.5 points is now under 4.

## Two tests broke, and only one of them was this ticket

Routing most of two other harnesses' populations through college for the
first time found real bugs — in the tests, not the mechanic. Full account in
CORE_RULES 13.63; the short version:

- **`health.test.ts` inverted its athlete-vs-idle injury ratio.** A hurt-line
  regex matched college.ts's "starting in the **fall**" (the season), a line
  that used to be too rare to move an 8,000-year denominator. The same
  harness also hardcoded `stage: 'middle'` when asking what activities were
  available, which `isInSchool` never rejected for a character now enrolled
  in college — so twenty-year-olds started "joining" middle-school
  basketball and carrying the athlete flag for the rest of their charted
  life. Both fixed in the test: a negative-lookbehind on `fall`, and passing
  the character's real stage (or nothing, outside elementary/middle/high)
  instead of a literal.
- **`careers.test.ts`'s "a third of lives top out" bound moved to 52%, on
  purpose.** This harness auto-answers every pending decision, so an
  "optimal" life now also finishes a degree close to the 95% rate above, and
  a real share of rung-4 jobs are credential-gated. More people legitimately
  qualifying for the top of a ladder they could not previously reach is this
  ticket working. Bound raised to 65%, with the reasoning inline.

## Verified

- `pnpm typecheck` — 15/15.
- `pnpm test` — 292/292, including both fixed harnesses and the unchanged
  0308b floor guard.
- `node tools/content-validator/validate.mjs` — 10 catalogs, 940 ids, clean.
- Reachability guard: 0/147 jobs unreached, down from 33/147.

## One rule

- **13.63** — A test's own shortcuts (a regex, a hardcoded parameter, a
  stubbed context) are a measurement choice, correct only for the population
  that has exercised them so far. A ticket that changes population
  composition can make one wrong without touching the system under test —
  and a dormant bug in a test is still a bug; the population that finally
  reaches it did not create it.
