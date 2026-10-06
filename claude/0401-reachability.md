# Ticket 0401 — Reachability

The first ticket of v0.04, and it is not the one the roadmap proposed. The
roadmap called this milestone *"mostly content volume: 49 jobs → 150–250"*.
Measured first, that was wrong: a life saw **13 of the 49 jobs that already
existed**, and **20 of the 49 were never shown to a single character across 100
played lives**. Writing 200 more would have written 200 more that nobody sees.

Full pre-ticket measurement: `claude/v004-career-measurement.md`.

## What was actually blocking

Every job was classified per life-year as eligible, or blocked with the reason:

```
GATE-BLOCKED (never eligible to anybody): 32   <- 20 of them rung >= 1
DRAW-STARVED (eligible, never listed):     0
```

**The draw was cleared before anything was changed.** The listing key is
`${year}:opening:${jobId}` — no seed, no character — so every life born in the
same world year shares one ordering, which looked like the culprit. It is not:
zero jobs were eligible-and-never-listed, and re-keying the draw per life
changed coverage not at all (12 eligible → 12 ever listed, either way).

What blocked them was `cannotApply`, in two flavours: **`out-of-reach`**
(`job.rung > reached[track] + 1`, where `reached` is written only by *holding* a
job — so a rung-1 job does not exist to you until you have worked rung 0 of that
same track) and **`needs-education`**.

## The levers, measured over one fixed corpus

3,471 working life-years from 60 played lives, every variant evaluated over the
same corpus so the player's choices are held fixed:

| lever | distinct shown | eligible/yr | up-moves/6 | cold/6 | per life |
|---|---|---|---|---|---|
| CONTROL (shipped) | 30 | 13.4 | 1.29 | 4.19 | 15 |
| A reserved step-up slots | 30 | 13.4 | 1.33 | 4.16 | 15 |
| B a degree opens a ladder | 30 | 13.4 | 1.29 | 4.19 | 15 |
| C `REACH = 2` | 35 | 22.9 | 1.11 | 2.47 | 24 |
| **D transferable experience** | **31** | **21.0** | **3.25** | **2.55** | **24** |
| **E reach 2 at standing 65** | **32** | **13.8** | 1.45 | 4.05 | 15 |
| D + E | 33 | 21.4 | 3.29 | 2.50 | 24 |

- **A was inert** because there is usually no step-up in the eligible set to
  reserve a slot *for*. A weight cannot beat a count, and neither can a slot
  reserved for something absent.
- **B was inert for a better reason** — it was untestable on that corpus. 94.7%
  of the life-years sat at `highSchool`, 5.3% at `none`, and the number where a
  major opened any track was **zero**. That is **CORE_RULES 13.58**.
- **C matched D on coverage and lost on shape.** It buys reach by letting anyone
  skip a rung, which *lowers* the up-moves in the list — it opens jumps that
  bypass the ladder rather than putting the player on it.

So: **D and E, not A, B or C.**

## What shipped

One new function in `@yearafter/careers`, `reachOf(context, track)` — *the
highest rung this character counts as having stood on, for the purposes of what
they may APPLY TO*:

```ts
export const TRANSFERABLE_AFTER = 8;
export const EARNED_REACH_STANDING = 65;

export function reachOf(context: OpeningsContext, track: string): number {
  const held = context.reached[track] ?? -1;
  if (held < 0) {
    // Never worked this track. A long career anywhere is worth the front step.
    return context.experience >= TRANSFERABLE_AFTER ? 0 : -1;
  }
  const standing = context.standing[track] ?? 50;
  return standing >= EARNED_REACH_STANDING ? held + 1 : held;
}
```

**Eight years of work anywhere opens the first step up everywhere**, and
**standing of 65 on a track you are on opens the one two above**. Standing was
already per-track (spec 113–118) and until now bought only hiring odds; this is
the first thing career reputation unlocks.

### The part that is a design decision, not a tuning

**`reachOf` is deliberately not wired into `hireChance`.** The gate stops saying
no; the odds go on saying it is a stretch. A career changer with fifteen years
behind them may now apply for the first step up in a trade they have never
worked — and `hireChance` still charges them the `-0.3` for the gap and pays
back only what their experience and standing are actually worth.

Letting the effective rung into the odds as well would have been the same lever
applied twice, and the ladder would have stopped meaning anything. There is a
test for exactly that leak, in the simulation package beside the caller where
the leak would happen; with the leak in place both chances come out at 0.7212.

`OpeningsContext` gained `experience` and `standing`. The three places that
built one by hand are now one `atTheDoor(state)` — three literals were three
places to forget a field, which is 13.51 waiting, and this ticket exists because
a gate was reading one field too few.

## Acceptance, with a control

| | before | after |
|---|---|---|
| jobs **seen** in one life (of 49) | 13 (26.5%) | **22–24 (49%)** |
| never shown to anybody, 60 lives | 20 | **9** |
| distinct jobs ever shown | 29 | 39 |
| step-ups among the six, while employed | 1.30 of 6 | **3.09 of 6** |
| cold starts among the six | 4.69 of 6 | 2.48 of 6 |

The control was run by reverting `reachOf` to the held rung behind an env switch
and re-running the identical harness.

**All nine jobs still invisible are credential-gated** — Analyst, Senior analyst,
Operations director, Practical nurse, Charge nurse, City administrator, Teacher,
Department head, School principal. Every job in the catalog that does not need a
degree now reaches somebody. The nine are 0405's, not this ticket's: a passive
player earns no degree, which 0210b already measured.

## The guards, and why these ones

`packages/careers/src/reach.test.ts` (11) and
`packages/simulation/src/reachability.test.ts` (4). The measurement harness was
not deleted — it was made to assert, because the number it prints is what gates
the catalog ticket.

- **`median jobs seen >= 20`.** Not the measured 22 — pinning the measured value
  makes a tripwire on tuning rather than a floor on reachability. The pre-0401
  value of 13 fails it.
- **No job may be eligible to somebody and never listed to anybody.** Derived,
  and it is the guard that matters when the catalog grows: six listings drawn
  from four hundred eligible rows would starve most of them. **Written before
  0403 rather than after it.**
- **Step-ups among the six > 2.** A floor on "the list contains a career"; the
  pre-0401 figure of 1.30 fails it.
- Sabotage-verified: reverting `reachOf` to the held rung fails 5 of the 11
  careers tests and 2 of the 4 simulation ones. The six that survive are the
  invariants that must hold either way — a stranger stays a stranger, experience
  never substitutes for a credential, the odds do not move.

## Two rules

- **13.58** — A lever measured on a population it cannot apply to has not been
  measured. An identical-to-the-control result is a different signal from a
  small one.
- **13.59** — When the gate moves, the ruler moves with it. The composition
  counter kept the old definition and read as the mechanic collapsing. Caught
  only because the buckets stopped summing to six.

## Still open

- **The nine credential-gated jobs**, above. 0405.
- **Track entry is lopsided**: of the rung-0 jobs ever held across 120 lives,
  care 71 and education 41, against office 2, trades 2, sales 3, public 3.
  Nobody has measured why.
- **Applying up a ladder is still rare in practice.** Entries onto a rung above
  0 went 5 → 11 out of ~356, because promotion still supplies the rest — and a
  promotion is not a decision. That is 0402's job, not a defect in this one.
- **Resigning never happens** in any harness, so "leaving a good job for a
  better one" has never been measured at all.
