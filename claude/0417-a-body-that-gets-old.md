# Ticket 0417 — a body that gets old

Roadmap finding 1b's leftover, open since 0408: *"median age at death still moves
only about four years across the whole range of birth health... the Gompertz age
term dominates whatever the multiplier says."*

The finding was right about the symptom and wrong about the cause. The Gompertz
curve wasn't too strong. The model was counting age twice, and a debt that was
supposed to heal never did after sixty.

## Measured first: nobody got old

300 played lives, answering every question:

| | before |
|---|---|
| median age at death | 72 |
| reached eighty-five | **3%** |
| median death, frailest fifth / most robust fifth | 70 / 76 |
| median health at seventy | **28** (the age curve alone said 55) |
| median deficit — illness not yet healed — at seventy | **25** |
| deaths per thousand a year at 70 / 75 / 80 | **125 / 191 / 313** |

A US period life table puts those last three at roughly 20, 31 and 51, and about
two in five twenty-year-olds reach eighty-five. The game was killing its old
people five to six times faster than the world does. And because every body went
through the same collapse, it didn't matter what body you were born with.

## Two causes

**1. Healing was a ratchet from sixty.** 0211 gave health a flat 3.4 points of
healing a year and wrote in its docblock that without it *"the model would be a
ratchet, and a ratchet reaches zero."* But illness gets likelier every year from
thirty-five and flat healing doesn't. Somewhere in the sixties the two cross, and
the deficit only grows from there:

| age | 40 | 50 | 60 | 70 | 80 |
|---|---|---|---|---|---|
| median deficit | 4 | 8 | 15 | 25 | 33 |

More than half the health a seventy-year-old had lost was illness that never
healed, and the arithmetic was the same for every body. New rule **13.83**: a
flat counterweight to a rising load is a ratchet that hasn't started yet.

**2. Age was counted twice.** Death odds were Gompertz (age) × frailty (health) ×
conditions. But frailty read raw health, which falls with age for everybody. So
an ordinary eighty-year-old paid for being eighty in the curve, and again through
a frailty multiplier their own age had pushed up. By seventy-five every quintile's
multiplier was pinned high, the strong and the frail were charged alike, and the
whole population died between seventy and seventy-six. New rule **13.82**.

## What changed

All of it is in the health package, and all of it is small:

- **Healing takes a share of what's owed** (`naturalRecovery`): the old 3.4 base,
  plus 30% of the deficit. A bigger debt comes down faster, so the deficit
  settles at a level under any steady load instead of climbing forever.
- **Frailty reads a body for its age** (`healthForAge`): health plus what the years
  alone would have taken. The Gompertz term carries age exactly once. An ordinary
  eighty-year-old now carries the same multiplier as an ordinary forty-year-old.
- **A strong constitution heals faster** (`constitutionOf`): the body's peak, read
  back from its vitality and age, scales healing between 0.5× and 1.4×.

Nothing about the Gompertz constants changed. Once age stopped being counted
twice, the population landed near the life table without tuning.

## Measured

The test file's 300 seeds, old model against new:

| | before | after |
|---|---|---|
| median age at death | 72 | **82** |
| p10 / p90 | 61 / 81 | 67 / 94 |
| reached eighty-five | **3%** | **41%** |
| median death, frailest / most robust fifth | 70 / 76 | 77 / 85 |
| median health at seventy | 31 | 44 |
| median deficit at seventy | 23 | 8 |
| deaths a year per thousand, across the seventies | 134 | 40 |
| deaths a year per thousand, across the eighties | too few reached them | 89 |
| life table, roughly (seventies / eighties) | 25 / 75 | |

Still a little high in the seventies — the player collects real conditions, and
the multiplier they carry is genuine. But it's now about 1.5× the world's rate,
not five times.

**Constitution is now worth about eight years**, where it was worth about five.
On a second, separate set of 300 lives the gaps were 4 before and 9 after.

**Nobody outlives their money.** I checked, since forty more years of old age is
forty more years of bills: no shortfall years in any decade from sixty to a
hundred, and fewer lives under $1,000 in their nineties than in their sixties.

## NPCs moved too, on purpose

NPCs die through the same `deathChance`, so they followed the fix — which is the
point of 0212's design. It did turn `npc.test.ts` red. An NPC's frailty used to
drift into the steep end as their health fell with age, which bought free spread.
Reading their body for its age made frailty a constant of constitution, and the
p10-to-p90 lifespan span fell from 11 to 7.5 years.

`NPC_PEAK_HEALTH` widened from [40, 98] to [30, 100], which puts NPCs where the
player's own lives land: median 84, frailest tenth 76, strongest 87, against the
player's 82 and 77-to-87. NPC death rates now run about 6, 19, 59 and 148 per
thousand at sixty, seventy, eighty and ninety, against roughly 9, 20, 51 and 147
in the life table.

## Two things I measured before believing

- **A fourth mechanism was built and removed.** I also made illness
  likelier for a frail body as it aged. Knocked out, it moved nothing — gap 10
  with it, 10 without — so it isn't in the build.
- **The constitution half of healing nearly went the same way.** On one sample it
  moved the constitution gap by one year and looked like noise. On two samples it
  was consistent: 8 and 9 years with it, 7 and 7 without, against the old build's
  6 and 4. Without it the fix sat exactly on the line it has to clear. One sample
  couldn't tell a small real effect from nothing — 13.81 again, the day after it
  was written.

## Verified

- `pnpm typecheck` — 15/15. `pnpm test` — **1,029/1,029**. Validator clean.
  Nothing that already existed broke, apart from the NPC spread above.
- **Seven new unit tests in the health package**, each turned red by the matching
  sabotage:
  - flat healing turns two red;
  - absolute frailty turns two red;
  - dropping constitution from healing turns one red;
  - removing the healing bounds turns one red.
- **Four population tests in `old-age.test.ts`**: the old model turns all four red
  on both samples. Flat healing alone turns three red; absolute frailty alone
  turns two red.
- **The constitution line (≥ 7 years) was set by measuring both builds on two
  samples**, as 13.81 asks. The old build reads 6 and 4, this one 8 and 9.
- **The mortality bands use ten-year age groups.** Five-year groups were inside
  their own noise: two samples of this build read 56 and 37 per thousand at
  seventy-five.

## Still rough — all three closed by decision

After review, the product owner closed all three items below: serious conditions
stay as they are (disabling consequences would be neither realistic to play nor
fun), the ceiling at twenty-six is accepted, and check-ups stay button-only. See
`claude/approved-decisions.md`. Kept here as the record of what was measured.

- **The gap between the frail and the strong is about eight years, not twelve.**
  What's left is conditions. A robust seventy-eight-year-old holds as many
  serious ones as a frail one — more, because they're still alive to collect
  them — and a stroke is a stroke. Making a frail body likelier to get ill was
  tried and did nothing, so the lever isn't there. It may be in which conditions
  arrive, not how often.
- **The top of birth health still hits the ceiling by twenty-six.** Everybody
  born above about 77 reaches vitality 100 and the difference is gone. I tried
  letting vitality hold a hidden reserve above the displayed 100; it moved
  nothing measurable, so it isn't here.
- **The passive player never sees a doctor** — check-ups per adult year are
  exactly 0.00. It's the same shape as 0405, 0407, 0410 and 0416, a verb only a
  button calls. Spec 531 says preventive care should matter little and never
  become a chore, so this may be correct as it stands, but it's now worth a
  deliberate decision rather than an accident. Logged as finding 1c.
