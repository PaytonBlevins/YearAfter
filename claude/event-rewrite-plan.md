# YearAfter — event & decision rewrite (Ticket 0203b)

**Status: DONE.** Shipped 2026-08-31 at commit `73b2fd6`, after Ticket 0204.
This document was the plan; what follows is what was actually built, kept because
the reasoning behind the engine change and the validator rules is worth having.

The 2026-08-31 03:40 scheduled run could not reach the Mac and produced a plan
only. The work was done in a later session with the repo in hand.

---

## What shipped

All 59 decisions and opportunities rewritten to the standard in
`claude/event-writing-rules.md`. 176 weighted outcomes, up from 83. The catalog
holds 346 events, inside the approved 250–500 band.

### The engine change — one name, carried

People are bound ONCE, when a decision is raised, and stored on it:

1. An event declares `personTokens: ["kid", "adult"]`. Eligibility already
   guarantees whatever the tokens need; this only says which bindings the text
   depends on. The engine reads the field and still never names an event.
2. `toPendingDecision` calls `bindPersonNames` and stores the map on
   `PendingDecision.names`.
3. `renderEventText(template, context, source, bindings)` — bindings win where
   present; without them, incidental names are drawn per render, which is safe
   for passive events because they are a single line.
4. `decide()` renders the outcome with the stored map, so the answer names the
   person the prompt named — even days later on another device.
5. Save v5 → v6. An already-open decision gets `names: {}`, which means "resolve
   per render" — the behaviour it already had. The migration must not draw
   names: a migration that consumes RNG stops the save replaying from its seed.

Added an `{adult}` token producing "Mrs. Okafor" — a surname and a title, since
reusing a child's given-name pool for a forty-year-old is the wrong register.

### Money made structural

`EventEffects.cash` is now `{ delta, source }`, never a bare number, and the
validator additionally requires the amount to appear in the player-visible text.
The audit trail lives in the prose, where it is actually read. Eleven passive
events were moving money silently; all now say where it came from.

### The five rules

Enforced in `scripts/generate-events.py`, `tools/content-validator` AND the
catalog tests, because the JSON ships and can be hand-edited.

| # | Rule | Notes |
|---|---|---|
| V1 | Three options, or `binaryOk` | "Do it / don't" is not a decision |
| V2 | Options open differently | Compares the first two significant words, not the first verb — a single shared verb had too many honest collisions |
| V3 | Happiness moves, and can move down | Plus health on anything `physical` |
| V4 | Money names source and amount | |
| V5 | Every person a decision names is declared | |

V2 and V3 earned their keep immediately: four genuine "give it / give some of
it" intensity pairs, and three decisions where every branch was neutral-or-better.

## Found by reading the output

The suite was green through all four of these.

- **"Mr. Mr. Conti"** — 33 lines put a title in front of `{adult}`, which
  already has one. Now a validator rule.
- **"You asked {kid} how {they} did it"** rendered the PLAYER's gender for
  someone else. `{they}/{them}/{their}` are the player's; incidental people have
  no gender and get named. Now a validator rule.
- **"father Andrea, sibling Andrea"** — one household, one name, twice. Unisex
  names make this likelier than it looks; the family generator now de-duplicates.
- **The generator printed its report before writing its file**, so piping it
  through `head` closed the pipe, killed the process on the next print, and
  silently skipped the write. It cost real time twice. Both catalog scripts now
  write first.

## Verification

Two full childhoods read line by line, then 120 more swept: 1,273 decisions
raised across 58 distinct events, zero unresolved tokens, zero doubled titles.
Stat distributions unchanged, nothing pinned at 100. A four-option card
screenshotted at 390pt — it fits, and long labels wrap rather than truncate.

286 tests.

## Not done, deliberately

The plan proposed converting other "pick one from a menu" events to opportunity
screens. Only the school-activities one existed, and Ticket 0204 already
converted it. If another appears, §4.1 of the original plan describes the shape.
