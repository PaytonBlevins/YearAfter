# v0.04 — what the career system actually exposes (measured before building)

The roadmap says v0.04 is **"mostly content volume"**: 49 jobs → 150–250.

That was a guess, and it is wrong. Measured across 100–120 played lives with a
temporary harness (`packages/simulation/src/measure-careers.test.ts`, deleted
before anything ships), the binding constraint is not the size of the catalog.
It is how little of it can ever reach a player.

## The coverage numbers

Picking a random one of the six listings each time the character is jobless
(140-year lives, 100 runs, catalog of 49 jobs across 11 tracks):

| | p10 | median | p90 | max |
|---|---|---|---|---|
| jobs **seen** in one life | 12 | **13** | 15 | 17 |
| jobs **held** in one life | 3 | 4 | 6 | 9 |
| track switches in a life | — | **0** | 1 | — |

- One life sees **26.5% of the catalog** at the median.
- Across all 100 lives, only **29 of 49 jobs were ever shown to anybody**.
- **20 jobs were never shown to a single character in 100 lives.**
- **35 jobs were ever *held* but only 29 were ever *shown*.** Six jobs are
  entered by promotion that are never advertised to anyone.

### The picker matters, and it caught a bad conclusion

The first version of this harness took `openings(state)[0]`, which is the
**cheapest** listing — the list is sorted by pay ascending so it reads as a
ladder. Every "which tracks get held" figure was really a figure about which
track has the lowest-paid entry job. Taking the **highest**-paid listing
instead, 120 lives worked exactly **two** templates (government, management) and
saw only 17/49 jobs. The three-picker sweep is the control; **"seen" is the only
figure that survives all three**, so it is the only one quoted above.

## Why the 20 are invisible — and it is not the sampler

Every job was classified per life-year as *eligible* or *blocked, with the
reason*:

```
GATE-BLOCKED (never eligible to anybody): 32   <- of which 20 are rung>=1
DRAW-STARVED (eligible, never listed):     0
```

**Zero draw-starved.** The draw is not hiding anything. Confirming it directly:
the listing key is `${year}:opening:${jobId}` — no seed, no character, so every
life born in the same world year shares one ordering. Re-keying it per life
changes coverage **not at all** (12 eligible → 12 ever listed, either way).
That suspect is cleared.

What blocks them is `cannotApply`, in two flavours:

- **`out-of-reach`** — `job.rung > reached[track] + 1`. A rung-2 job does not
  exist to you until you have held the rung-1 job. 20 of the invisible jobs.
- **`needs-education`** — 12 more, all university/postgraduate.

## The ladder works, but the player is not climbing it

120 lives, random picker:

```
highest rung reached:  0 -> 0.8%   1 -> 8.3%   2 -> 14.2%   3 -> 75.8%   4 -> 0.8%
rungs above 0 entered: by promotion 351    by applying 5
jobs ended:            promoted 351   laid-off 41   fired 5   resigned 0
```

76% of lives reach rung 3, so the ladder is not broken. But **promotion is the
whole of it**, and a promotion is not a decision — `phases/employment.ts` picks
`promotionFrom(job)` and moves you. (The 351-to-5 is partly a harness fact: this
harness only applies when jobless. The honest version is the next table.)

### What the six listings contain while you already have a job

3,020 employed life-years:

```
a step UP on a ladder you are on:   1.30 of 6
a cold start at rung 0 elsewhere:   4.69 of 6
in the track you already work in:   1.00 of 6
```

**The career screen is mostly offering to start you over at the bottom of
something else.** That is spec 119's permissive switching working exactly as
written — and it is also why a bigger catalog makes the screen worse rather than
better: 200 more jobs is 200 more cold starts crowding out the one step up.

## Where lives start, which is lopsided

Rung-0 jobs ever held across 120 lives: care 75, education 42, safety 14,
food 10, trades 5, logistics 4, creative 3, retail 3, public 2, sales 2,
office 1.

## The half of the spec that is already done

Spec 1339–1344 asks performance careers for **broad earnings distributions**.
Measured across every working year:

| template | p10 | median | p90 | p90/p10 |
|---|---|---|---|---|
| performance | $26,065 | $33,127 | $99,660 | **3.82** |
| professional | $58,664 | $84,001 | $143,435 | 2.45 |
| management | $76,535 | $112,394 | $167,200 | 2.18 |
| government | $44,833 | $64,903 | $88,072 | 1.96 |
| trade | $34,850 | $49,242 | $63,783 | 1.83 |
| salary | $29,131 | $35,351 | $44,218 | 1.52 |

Performance is the widest by a distance and salary the narrowest, which is the
shape the spec asks for. **This half of the milestone needs nothing.**

## What this changes about the milestone

Writing 200 job titles against this funnel produces 200 more jobs nobody sees.
The reachability work has to come first, and it has an acceptance number
attached: **jobs seen per life, median 13 of 49 today.** A catalog ticket should
not start until that number can move.

This is CORE_RULES 13.49 — a gate that has never been the binding one has not
been tested — applied before the content instead of after it.
