# Ticket 0306 — Credit Cards

**Spec 1687:** max 5 active, up to 8 relevant products, limit/APR/balance/
payment/rewards/application.

Save **v20**. No `pnpm install`.

---

## The first thing in this build you can buy without the money

Everything before it floored at zero: `post` clamps a charge to the balance and
writes the unpaid part down as a `shortfall` row, because there was nowhere to
fall. A card is the somewhere.

### Measured first, across 120 lives

| | |
|---|---|
| Lives that come up short at least once | **58 of 120** (3.5% of adult years) |
| The unpaid amount | p10 $1,488 · **median $3,333** · p90 $4,870 · max $10,418 |
| What for | living costs (162), treatment (98) |
| When | spread across every decade of adult life |

Real demand, and small — a bad year rather than a habit. That is what sets the
limits: a secured card at $1,200 covers a third of them and a good card at
$14,000 covers all of them, which is what makes *which* card you hold matter.

### What the spec allows and forbids

- **Spec 26:** 8 products, 5 active. Both are exact and both are tested.
- **Spec 28:** product, issuer, limit, balance, available credit, APR, minimum
  payment, rewards, annual fee, status — and **no opened date, no
  payment-history timeline.** `HeldCard` has neither, asserted *on the shape* so
  a later ticket cannot add one by habit. A field is easy to add and impossible
  to remove once saves have written it (0207c).
- **Spec 32:** delinquency freezes the card. The balance stays, the limit stays,
  nothing new goes on it, and nobody sues. It thaws the year the minimum is met
  again, because credit that can never be repaired is punitive in the way spec
  1381 rules out.
- **Spec 21:** a card is a monthly instrument in a yearly game, so everything is
  annual and there is no statement, no due date and no schedule.

### Where the draw happens is the design

The obvious place is *after* posting: let the year fall short, see the shortfall
rows, then advance the money. That produces a ledger saying a character both
failed to pay for something and paid for it, in the same year.

So the draw runs **against the shortfall the year is about to have**. Every phase
has already reported what it moves, so the arithmetic is available before a
single row is posted. The advance is then just another positive row and the
ledger reads the way the year actually went. **0302's reconciliation invariants
validated the whole integration for free.**

### Two lists got shorter

`debt` came off `UNWRITTEN_CATEGORIES`; `utilization` came off
`CREDIT_INPUTS_NOT_YET_BUILT`. Both tests failed on the first full run, which is
those tests doing exactly their job.

---

## Three defects, none from a test

### 13.48 — a stat you can raise by tapping

Measured a deliberately greedy player (takes every card on offer, every year)
against one who never applies:

| | Excellent | Good | Fair |
|---|---|---|---|
| Never applies | 31% | 43% | 21% |
| Takes every card | **44%** | 46% | **5%** |

Holding cards you never use made you creditworthy. No money changed hands, no
decision was made, and a fifth of a credit standing was available for pressing a
button eight times — spec 1381's circular exploit in its purest form.

Utilisation is a **penalty only** now: running a card near its limit costs you,
and not running one is worth nothing. The two populations now score identically
(30/43/21 either way).

*The average player would never have shown this. The test that finds an exploit
is the one that tries to commit it.*

### The ladder started above the ground

A character with poor standing and no income was approved for **nothing** —
every limit is sized against income, and theirs was zero. That is the
$9,000-wedding failure again (13.16), the third time in this build.

The bottom rung is a secured card, backed by the applicant's own deposit rather
than by an income they do not have. It takes the deposit on open and returns it
on close, which also makes it a real decision instead of a free card with no
downside. And somebody with *literally* nothing still gets nothing, which is
true — a secured card is secured by something.

### Eight rows saying the same thing

The screenshot at age zero: all eight products declined with the identical
subtitle *"Your credit is not there yet."* Third screen in three tickets to
repeat one line down a column (13.26). The reason is the same for all eight and
has nothing to do with credit — they are a child. One sentence now.

---

## The numbers after

| | Never applies | Takes every card |
|---|---|---|
| Cash at death (median) | $189,581 | $183,640 |
| Most ever owed (p90) | $0 | $3,079 |
| Shortfall years | 0.8% | 0.7% |
| Frozen-card years | 0% | 1.8% |
| Ever held a card | 0/100 | 96/100 |

No wealth exploit, carrying debt costs a little, and delinquency is reachable
without being oppressive.

## Follow-on

- **Rewards are declared and not yet paid.** Every product carries a
  `rewards` type and a `rewardRate`, and nothing spends them — the cashback a
  card earns is not yet credited. 0308 or a later pass.
- Weddings, rings and adoption fees are still priced as `min(price, cash)` from
  the pre-income era, so they never produce a shortfall and never reach a card.
  Converting them to real prices is what would make a card genuinely tempting.
- `debtLoad` is the last entry in `CREDIT_INPUTS_NOT_YET_BUILT`, waiting for
  0307.
