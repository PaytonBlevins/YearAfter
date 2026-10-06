# Ticket 0212 — Death & Continuation

**v0.02 Living Character is complete.** A life is now playable start to finish,
and the line carries on past it.

Committed as `0ee7df4` on the Mac (`c5e2d30` in the cloud). 644 tests, 27/27
turbo tasks, validator clean. Save **v17**.

---

## The measurement came first, and it tripled the ticket

400 played lives, before a line of code:

- The player dies at a median of **73**. The median **surviving parent** is
  **105 years old**. The oldest is 135.
- Nothing in eleven tickets had ever written `alive: false` to an NPC.
- `character.records` — declared in Sprint Zero with the comment *"structured
  history for dynasty records and the death summary"* — was `[]` in every save.
- A passive player reaches death with no partner and no children. An active one
  has a living child 100% of the time, and that child's median age is **43**.

Spec 1284 asks the death screen for "family survived by" and "3–5 major
highlights". Both were fiction. So 0212 is a death screen sitting on top of two
systems that had to be built first.

---

## CORE_RULES 13.36 — a field nothing writes is not state

Three instances of one bug, and they are worth listing together:

| Field | Declared | Read by | Written by | Found in |
|---|---|---|---|---|
| `droppedOut` | 0204 | five places | nothing | 0210 |
| `alive` on an NPC | 0202 | the stress model, since 0205 | nothing | 0212 |
| `character.records` | Sprint Zero | the death screen | nothing | 0212 |

Each was written in good faith for a ticket that had not happened yet. Each
looked like progress. In every case the bill was paid by whichever ticket
finally needed the field — which discovered, late, that it was not building a
feature but building the thing the feature had been assuming.

**The rule:** a field a ticket does not populate does not ship in that ticket.
If the shape is genuinely worth agreeing early, the comment says NOT WRITTEN YET
and names the ticket that will write it — the way `livingCostOf` names 0303.

**And the corollary that cost the most here:** when a ticket adds the writer,
re-measure everything downstream. A constant that was never exercised is not a
tuned constant; it is an untested guess that has been sitting still.

---

## Everybody is mortal now

New `@yearafter/health/npc` and an eighth phase module, `phases/kin.ts` — the
only phase ever **prepended** to the order rather than appended. Every other
phase went last because it depended on what came before it; this one goes first
because it is the only phase that changes **who exists**. Run it last and
somebody who died in January would still have been flirted with, named by an
event and promoted alongside the player, and would then stop existing at the
bottom of the same year.

NPCs go through the **same `deathChance`** the player does, with an empty
condition list plus a morbidity term standing in for the illnesses nobody
simulates. That is deliberate: one curve moves the whole world, and a later
ticket that makes eighty-year-olds live longer moves everybody.

An NPC's constitution is `stableUnit(id)` — no RNG spent, nothing stored, the
same on every load, and two seventy-year-olds are not equally likely to see
seventy-one.

**Measured after:** 97% of characters lose a parent (median at 41), 36% are
widowed (median at 70), 9% outlive a child. Only 5% still have a parent alive
when they die.

**Two numbers that were wrong and got swept:**

- The first constitution range gave a spread in life expectancy of **4.9
  years** across a thousand people — which is another way of saying constitution
  did not exist. Widened until it was eleven.
- Without the morbidity term, NPCs reached a median of 80 while the player
  reached 73, so every character would have systematically died before their
  neighbours and outliving somebody would barely happen.

---

## Making people mortal broke the stress model

The single worst constant in the build, and it was invisible until this ticket.

Bereavement had been a **flat 22 points, charged forever**. Fine while nobody
could die. The moment they could, every character over forty carried permanent
stress about something in another decade — which raised the illness roll, which
pulled the player's own **p10 age at death from 62 to 55**. A model that made
the player die younger because their mother had died is not a model of grief.

Grief now fades over five years and costs an adult less than a child.
`diedWhenPlayerWas` is the one genuinely new field in the save, and it exists
entirely so that this can fade. Lifespan is back to 59/73.

Three new tests exist specifically to stop it coming back.

---

## CORE_RULES 13.37 — a state object holding a live cursor is not a value

`careers.test.ts` claimed to prove that mashing a spent button consumes no
randomness — *"the seed still means something"* — and did it by advancing one
state, then mashing that same state and advancing it again.

But `rng` is a live `Rng` with mutable streams, held by **reference**. So the
test was comparing year N with year N+1. It passed for two tickets because,
with seven writers, the two years happened to produce the same sentences.
Adding an eighth moved the cursor and the assertion came apart.

**The eighth writer did not break that test. It revealed it.**

Rewritten with `snapshot`/`restore`, which is what a comparison of two branches
of one life actually requires. The rule generalises past RNG: anything reachable
from a state object that is not itself a value — a cache, a cursor, a handle —
makes "the same state" a lie, and the lie is invisible until something changes
how much of it gets used.

---

## `records` is finally written

Through **one door** (`appendRecord` / `stampRecord`, the `appendToTimeline`
pattern from 0211a), from six producers, stamped in `advanceYear` and in the two
player actions that produce one.

**Derived from STRUCTURE, never from text.** The education phase reads
`before.stage !== after.stage`; the health phase reads `severity === 'grave'`.
Nothing matches on the word "Graduated" — which matters because 0211b rewrote a
hundred and eighty sentences, and a text-matching record would have found a
different history depending on which build last touched the save.

An active life now produces **10–17 records**: first job, promotions, being let
go, a marriage, each child, making a team, a grave diagnosis, who was lost.

---

## The death screen

Spec 1284's seven fields and deliberately **no eighth**. No net worth, no
prestige score, no grade — the spec forbids the first two by name, and the
reason for the third is its own framing: death should conclude a story, and a
number out of a hundred at the end turns eighty years of play into a high-score
attempt. A test asserts that nothing on the assembled eulogy is a score.

**Records are history. Highlights are a selection.** The most important
distinction in the file. Losing a parent belongs in structured history; it is
not a highlight of what somebody *did*. A passive life's raw record list is a
graduation and two funerals, so a screen that printed it in order would
summarise every quiet life as an obituary of other people. Losses rank last, and
the heading is **"What happened"** — not "What you did", which is what it said
until a played life showed "Lost Mom" underneath it.

The empty case is a sentence, not a hidden section: *"Nobody. You were the last
of them."* A passive character dies with a median of **zero** survivors, so that
is a common ending rather than an edge case.

**Burial, cremation, donation to science, or whatever the family does.** It
changes nothing, and that is the point: the same spec sentence that asks for the
choice also says death must not become an estate-administration chore. It is
recorded, so a dynasty five generations on can say what was done with each of
them. That is the whole feature and it is enough.

---

## Continuation: "They should have a simulated life"

Asked how to hand over a 43-year-old child — generated backstory, start as their
newborn, or an honestly blank slate — the answer was four words, and it was a
correction rather than a choice off the list.

A backstory assembled at the moment of takeover is the game asserting
forty-three years of facts it never simulated; the first time a player notices
an entire history appearing at once, none of it means anything.

So children **live their years as they happen**. `runOffspringYear` in
`@yearafter/parenting` is a reduced model — school, a leaving qualification,
maybe a degree, a job and its promotions, a partner, their own children, a
retirement, and about twenty lines of their own timeline. It deliberately does
NOT give them friends by name, decisions, stress, conditions or the event
catalog: those exist to be played, and running them for an NPC costs a save
file's worth of state per person to produce detail nobody can see.

The line is drawn at **what a parent would plausibly know**. You know your
daughter is a nurse, that she married Tom, that she has two children. You do not
know the name of every colleague she has ever had.

`continueAsChild` then **promotes** that life rather than inventing one. The
character who just died becomes a dead parent. The grandchildren — whose birth
*years* were simulated, so they are real people with real ages — become the
children. The world year, the seed and the naming tradition carry on;
`generation + 1`. Friends, colleagues, conditions, stress and cooldowns are
dropped, because a cooldown belongs to whoever used the event and a body belongs
to whoever lived in it.

Two things are honestly made up and say so in the source: the heir's six visible
stats (never simulated for an NPC — stable on their id so backing out and
retrying cannot re-roll them) and the grandchildren's first names. A name is a
label; the person is what had to be real.

**Estate** is the cash that was left, and nothing more. There is no ledger until
0301 and no debt anywhere in the build. CORE_RULES 13.21 — do not gate a system
on one that has not shipped, and do not pretend to one either.

---

## Found by reading the built app, as usual

- **The header said "75 · Retired" over a death screen saying "From Atlanta,
  GA"** — about the same man, at the same moment. That is 0210's header defect
  for the third time: two derivations of one fact disagree eventually, and
  "eventually" was the same afternoon. Identity now routes through
  `occupationFor`, with a test.
- **A child being "promoted" to the job they already had, every year forever**,
  because the ladder lookup falls back to the top rung when the next one does
  not exist.
- **"Mom died, of their health"** — a relation word where a possessive pronoun
  belongs, which is 0211c's sibling defect in a new place. Fixed the same way:
  by not needing a pronoun at all.
- **Six of eight death notices reading "of a long illness"** — CORE_RULES 13.17
  for the eighth time. Four sets of sentence shapes now, indexed on the dead
  person's own id.
- **V16 fired on my own copy.** "You do not write the rest of this down", for a
  child's death — writing rule 10 in its purest form, caught by the validator
  0211b built. The first time it has flagged a line written *after* the rule
  existed. It was right, and the fix was to stop writing and say what happened.

---

## Housekeeping

Two build tarballs were tracked in the repo — one since Ticket **0206b** — and
0212 nearly committed a third. Both removed, `*.tgz` and `*.tar.gz` ignored.

A stale `.git/index.lock` from Sep 9, left by a git process that crashed when
the bridge dropped mid-push, had been blocking commits on the Mac.
