# Ticket 0409 — an adult life the catalog has heard of

Roadmap findings 3, 4, 4b and 5, which have been open since 0211 and had
compounded: 0407 gave characters careers and 0408 gave them varied lives, and
the event catalog had never heard of either.

## What was there

| | before | after |
|---|---|---|
| events that can fire at age 40 | **26** of 374 | **93** of 444 |
| of those, decisions | **0** | 13 |
| about work | **0** | 26 |
| about a diagnosis | **0** | 22 |
| about losing somebody | **0** | 19 |
| adult feed lines that repeat inside one life | **50%** | 23% |

The entire adult library was eight events named `adult.placeholder.1` through
`.8` — twenty-four lines covering ages eighteen to death. Measured across sixty
lives, half of every adult's feed was a line that character had already seen:
*"Same job, same apartment, same weekends"* six times in one life, *"Quiet
year"* four times. And an adult was never asked an authored question at all —
the only decisions they got were the systemic doors 0402, 0405 and 0407 built.

## The part that was not about writing

None of the three named holes could be written until the predicate language
could express them. `EventCondition` had no way to say "has a job", no way to
say "has this condition", no way to say "lost somebody recently" — so a work
event would have fired at the unemployed, which is a bug this codebase has
already shipped twice and fixed twice:

> `partnered` (0207), added after a romance event that presupposed a
> relationship fired about a classmate the character had never spoken to.
> `hasChildren` (0208), added after eleven parenting events went in reading
> "Your kid spiked a fever at 2am" and could fire at somebody who had never had
> a child.

Both were found by reading the built app. So 0409 added the gates **first**:
`employed`, `jobTrackAny`, `jobYearsAtLeast/AtMost`, `hasCondition`,
`conditionAny`, `bereavedWithin` — and `EventContext` learned the matching
facts, which is the deliberate, visible decision its own docblock asks for.

**Bereavement needed a structural signal.** `LifeRecord`'s rule is "structured,
queryable history. Never derived by parsing timeline text", and the only way to
ask "was this character bereaved" was to look for labels starting `Lost `. That
is also what `eulogy.ts` was doing, one rewritten label away from promoting
every funeral to a life highlight. `LifeRecordCategory` grew a `loss` variant —
the same move 0212 made for `health` and 0210 made for `TimelineKind` — and both
readers now ask the category.

## The content

Written to `claude/event-writing-rules.md` in full. Thirteen new adult
decisions, each with three genuinely different approaches rather than three
intensities, and outcomes that can land well or badly:

- **Work.** Being asked to stay late again; somebody presenting your work as
  theirs; an expensive mistake; training the new hire; leaving drinks after
  eleven years; asking for a raise; a work friend let go with no warning. Plus
  track-flavored years — a bad one on your shift in `care`, coming home filthy
  in `trades`, counting the meetings in `office`.
- **The body.** The appointment that clashes with work; somebody's cousin's
  cure; the afternoon you were handed a leaflet in a parking lot. Plus living
  with it: the chair, the bad mornings, the tablets by the kettle.
- **Loss.** Clearing the house; the anniversary nobody at work knows about; the
  box of things that should probably go to somebody. Plus the first year —
  going to call them before you remember, their handwriting on an envelope.

The generator and validator rejected eleven drafts between them: five labels too
long for a phone, three money effects whose text did not name the amount, a
`{adultThey}` starting a sentence, a VAGUE construction, and *"fortnight"* —
which rule 7 names explicitly and I wrote anyway. All fixed at source.

## Verified

- `pnpm typecheck` — 15/15. `pnpm test` — **936/936**. Validator — 1,032 ids,
  clean.
- Four new gate assertions in `events.test.ts`, sabotage-verified: removing the
  `employed` or `conditionAny` check turns two of them red.
- Gate audit across sixty played lives: **zero** work events at the jobless,
  **zero** loss events at the unbereaved.

A played-population audit was tried first for the health gate and could not
answer it: the health phase runs *after* events in the same year and can clear a
condition, so a character legitimately asked about their diagnosis in March
reads as perfectly well in December. That is a measurement artifact, not a leak,
and the gate is asserted where it lives instead.

## Four tests broke, and the best one was a measurement I improved

- **`health.test.ts` inverted its athlete-injury ratio again.** It detected
  injuries with a regex — `hurt|fall|accident|came off` — standing in for "the
  health phase reported one". 0405 caught that regex matching *"starting in the
  fall"* in a college acceptance. 0409 wrote the first adult injury lines
  ("Hurt your back lifting something stupid") and every one landed in the bucket
  labelled *"a classmate who joined nothing"*.

  Two things came out of fixing it. The regex is gone — `HURT_LINES` is exported
  from the health phase and the test matches the phase's own lines, so copy
  edits move both sides together. And bucketing all eighty years of a life under
  a test called *"a school athlete... a classmate"* was itself the shortcut:
  restricting it to school years revealed that the old, comfortable 14.8× ratio
  was partly an artifact of 7,600 injury-free adult years padding the
  denominator. The honest signal is cleaner than the old one — **40 injuries in
  1,675 sport-years against 3 in 960 without**, where the regex had been
  reporting 74 against 32.

- **`retirement.test.ts`'s harness returned an unsettled state**, so
  `advanceYear` silently no-opped and the retirement pot read as broken. 0406
  found the identical shortcut in `investing.test.ts`; it was harmless here for
  exactly as long as the catalog had nothing to ask an adult.

- **`investing.test.ts` hoped a seed had $20,000.** It did, until adult events
  changed what a life spends its RNG on. Fabricating the balance was tried and
  was worse — setting `player.cash` by hand puts it out of step with the ledger
  0302 reconciles against, and the buy then emptied the account. The life is
  played to an age where it has earned something and the amounts are a share of
  what it actually holds.

- **`events.test.ts` requires 20 events per category**, and the first pass gave
  `career` 12. Written up to strength rather than down to the bound — volume is
  the ticket.

## Still open

Repetition is 23%, not zero, and it should not be zero: an adult year that
genuinely resembles the last one is a real thing and the eight placeholder
events still cover it. What has changed is that it is no longer the *only*
thing. The remaining repeats are concentrated in `random`, which is the category
0409 did not touch.

`family` and `friendship` still stop at twelve and six events able to fire at
forty. An adult's parents, siblings and friends are as thin as their job was
before this ticket, and that is the next content gap rather than a new one.
