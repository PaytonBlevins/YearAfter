# Ticket 0307 — Loan Engine

Committed `ca359ae`. Save stays at **v21**. No new workspace dependencies, so
no `pnpm install` needed.

## What it is

Six products across spec 1857's two buildable types, plus the three that can't
exist yet named on the screen rather than left out.

| product | rate | term | wants | ceiling |
|---|---|---|---|---|
| Student Loan | 6.1% | 10y | a degree still ahead of you | $40,000 |
| Small Personal Loan | 18.9% | 3y | $18,000 a year | $8,000 |
| Consolidation Loan | 10.9% | 5y | $30,000 a year | $40,000 |
| Personal Loan | 12.9% | 5y | $38,000 a year | $30,000 |
| Line of Credit | 14.4% | revolving | $45,000 a year | — |
| Private Line | 8.9% | revolving | $140,000 a year | — |

`LOAN_TYPES_NOT_YET_BUILT` holds secured (v0.05, needs collateral), business
(v0.06) and wealth/private (0308, needs a portfolio) — same device as
`UNWRITTEN_CATEGORIES` and `NOT_YET_OWNED`, with a test that forces the ticket
retiring one to come and delete the line.

The scheduled repayment is **not a verb**. It comes out of `advanceYear` with
the rent and the tax, after the household eats. The two decisions are *borrow*
and *pay more than they asked*.

`CREDIT_INPUTS_NOT_YET_BUILT` is now **empty** — all six of spec 25's credit
inputs have a producer.

## The ticket's reason for existing

Measured before a line was written: cash at eighteen is **$0 at p10, median,
p90 and the maximum** — they have just moved out and the living phase has taken
everything — and a college place costs $7,436 a year. That is the gap, and a
student loan is the only instrument in the world for it.

Which made the hard part reachability, not maths. A student has no income and
no credit record, so testing either makes the product unreachable by exactly
the people it exists for (CORE_RULES 13.16, fourth time in this build). It
tests neither. Its bound is the tuition ahead of them, drawn a year at a time
and merged into one loan — a flat cap was the first version and it sent a
character into a $37,600 degree with $12,000, who ran out in year two and
dropped out.

## Two findings, both from measuring rather than testing

### 13.49 — the credit gate had never once mattered

Underwriting has two gates. Both real, both wired up, both with passing tests.
Then the population was asked which one was actually stopping anybody:

| | rows refused |
|---|---|
| refused on credit standing | 26,550 |
| ...that would also have failed the income gate behind it | **26,550** |

All of them. Across 120 lives and ~5,000 adult years, the credit check was
never the thing holding the door — `creditReport` weights income heavily
enough that anybody clearing $140,000 has earned an excellent band on the way
past. It was the income gate wearing a different label, and the label was the
harmful part: the player was told *"your credit is not there yet"* — a decade
of work — when the true answer was *"you do not earn enough"*, fixable next
year.

Income now reports first. The gate stays because 0308's portfolio decouples
the two, but until then it is untested rather than tested.

### The refusal column, caught by reading the real screen

At nineteen the built screen showed five rows all saying **"Your credit is not
there yet"** — the fourth screen in four tickets to print one sentence down a
column and call it information. Reordering the gates alone would have printed
*"You do not earn enough"* five times instead.

What differs row to row is the **number**. Each refusal now carries its own
threshold, and the products are declared in ascending order of it, so the
column reads as a ladder:

```
Small Personal Loan    Wants $18,000 a year coming in
Consolidation Loan     Wants $30,000 a year coming in
Personal Loan          Wants $38,000 a year coming in
Line of Credit         Wants $45,000 a year coming in
Private Line           Wants $140,000 a year coming in
```

Two more defects came out of driving the screen for real: a row labelled *"Pay
some off"* that spent every cent the character had (it now offers three
amounts, symmetric with borrowing), and a funded student told *"You owe as much
as they think you can carry"* — a debt-capacity sentence offered to somebody
whose debt capacity is never tested. That has its own refusal code now.

### 13.50 — the student loan makes its own target worse off

Same 120 seeds played twice, scored only on the 112 lives where money was
genuinely the thing in the way:

| | any degree | postgraduate | cash at death | first enrolled |
|---|---|---|---|---|
| no loan available | 100 | 88 | $20,709 | age 21 |
| loan available | **91** | **73** | **$10,801** | age 18 |

Paired, same people — not composition. (The first, unpaired comparison showed
68 → 56 and looked like the same finding; most of that was composition, because
offering a loan changes who goes to college at all. Only the paired run was
evidence.)

The mechanism is the last column. Blocked at eighteen and offered nothing, a
character waits three years, saves, and enrols at twenty-one — and **this build
charges nothing for the delay.** Enrolling at 28 costs exactly what enrolling
at 18 costs: no lost earning years, no admissions penalty, no life stage in the
way. The loan sells three years that are worth nothing, at 6.1% over ten years.

No re-pricing fixes this. A loan cannot beat free, and waiting is free.

**The loan engine is correct.** What the measurement exposed is that education
has no time cost, and that belongs to education's ticket — not to tuning this
instrument until the gap stops showing.

## Numbers, careerist vs drifter

| | degreed /100 | most ever owed (med / max) | arrears | cash at death (med) |
|---|---|---|---|---|
| careerist, no loans | 94 | — | — | $212,805 |
| careerist, ordinary borrowing | 94 | $11,911 / $47,726 | 1% | $187,700 |
| careerist, greedy | 94 | $42,462 / $63,541 | 2% | $203,649 |
| drifter, no loans | 80 | — | — | $32,518 |
| drifter, ordinary borrowing | 75 | $27,433 / $96,000 | 16% | $11,668 |

Balances stay bounded even for a greedy player over a full life — that is
`LOAN_BALANCE_CEILING`, put in from the start because 0306's cards compounded
$200 into $1.28bn and nobody noticed until a population was run for sixty
years. The same ceiling was retrofitted onto cards in this ticket.

## A harness bug worth remembering

The first measurement reported 93% of adult years in arrears and everybody
dying broke. Both numbers were mine, not the engine's: the harness never
applied for a job, so the population never earned a cent, and it checked
`state.player.dead`, which does not exist — death is `health.diedAtAge` — so
characters kept being simulated for decades past death. A no-borrowing baseline
run in the same harness is what exposed it, since it showed the same ruin with
no loans in play.

**Always run the control through the same harness.** A number with no baseline
cannot tell you whether it is measuring the system or the measurement.

## Still open

- Card **rewards are declared and never paid**.
- Weddings, rings and adoption still priced `min(price, cash)`, so they never
  reach a card or a loan.
- `currentLocation` never changes.
- Education has no clock (13.50). Until it does, every time-buying instrument
  in the game is dominated.
