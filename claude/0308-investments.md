# Ticket 0308 — Investments

Save goes to **v22**. No new workspace dependencies, so no `pnpm install`.

**Commit is pending** — the tarball is extracted into `~/dev/yearafter` but the
bridge dropped before the commit landed. The working tree has the change; it
needs `git add -A && git commit`.

## What it is

Spec 1691's four classes, seven products, ordered safest to wildest because the
screen is read top to bottom and that ordering is the information.

| product | class | drift | spread | pays out | opens at |
|---|---|---|---|---|---|
| Government Bonds | bonds | 0.5% | 0.02 | 3.1% | $500 |
| Corporate Bonds | bonds | 0.9% | 0.04 | 4.6% | $1,000 |
| Index Fund | funds | 5.8% | 0.11 | 1.5% | $500 |
| Managed Fund | funds | 4.9% | 0.14 | 1.2% | $2,500 |
| Blue Chip Shares | stocks | 5.3% | 0.16 | 2.6% | $2,000 |
| Growth Shares | stocks | 6.7% | 0.29 | — | $2,000 |
| Crypto | crypto | 7.2% | 0.58 | — | $100 |

Buy and sell are buttons. **Hold is not** — it is what happens when the player
does nothing, which is the right shape for a verb meaning "leave it alone".

A six-state market drives returns (spec 1222), measured over 200,000 years:
severe recession **0.47%**, recession 8.1%, slowdown 20.4%, normal 38.7%, growth
24.7%, boom 7.7%. Severe recessions cannot follow each other. `nextMarketState`
is pure and takes its roll, so the unticketed economy (spec 706-724) can drive
it later rather than replace it.

`assetIncome` and `investment` both get their first producer, leaving
`UNWRITTEN_CATEGORIES` at two. `NOT_YET_OWNED` is down to `assets` alone.
`wealthPrivate` comes off `LOAN_TYPES_NOT_YET_BUILT`.

## Measured before building

Cash held, 100 lives each, by age:

| age | careerist median | drifter median |
|---|---|---|
| 20 | $13,180 | $8,616 |
| 30 | $42,833 | $27,291 |
| 50 | $144,806 | $75,698 |
| 70 | $195,870 | $47,158 |

The exact opposite of 0307's finding. There, cash at eighteen was $0 at every
percentile including the maximum, and the ticket bridged a gap nobody could
cross. Here the money is already there and does nothing for fifty years. 99/100
ever hold over $10,000; 94/100 careerists hold over $50,000.

## The ladder, and whether it is a decision at all

The worry going in was 13.50 in the mirror. That rule says an instrument which
buys *time* is worthless when waiting is free; investments reward waiting, so
the risk is that they become a ratchet — if returns are positive and certain,
putting everything in immediately is strictly dominant and Buy/Sell/Hold is one
button.

$10,000 a year for a working life, 3,000 runs each:

| | p10 | median | p90 | max |
|---|---|---|---|---|
| Government Bonds | **$455,849** | $500,260 | $546,700 | $634,629 |
| Index Fund | $522,726 | **$1,534,813** | $4,424,637 | $23,654,885 |
| Growth Shares | $186,336 | $1,044,826 | **$7,171,318** | $146,015,094 |
| Crypto | $35,855 | $276,779 | $3,920,754 | **$829,585,860** |

Nothing dominates. Bonds have the narrowest spread of anything here and win the
floor outright at a **fifteen-year** horizon ($147,523 against the index fund's
$127,634) — which is their honest use: a late starter, or somebody who wants the
money in a decade. The index fund takes the median. Growth trades floor and
median for the tail. Crypto has the worst median of the four and the biggest
tail by two orders of magnitude, which is volatility drag working correctly.

Growth and crypto drift were both cut during calibration (8.2% → 6.7%, 12% →
7.2%) because the first pass had growth beating the index fund at the median
*and* the tail, which is not a trade-off.

## 13.51 — the not-built device has never worked

0307 built cards and loans and left `{ key: 'liabilities', arrives: '0307' }`
sitting in `NOT_YET_OWNED`. For a whole ticket the dashboard told players
liabilities had not been built while showing their card balance two rows below,
and `netWorth` returned the bare cash balance with `onlyCash` hard-coded `true`.
A character with $40,000 of cash and $30,000 of card debt was shown a net worth
of $40,000 and told underneath they owned nothing and owed nothing.

Every test passed the whole time, and that is the point:

| | |
|---|---|
| a line deleted when it should not have been | red |
| a line left behind that should have gone | **green** |

The device has been described as "the ticket that builds one has to come here
and delete a line" four times across four files, and it cannot enforce that.
Each entry already carried its arrival date and nothing ever compared it to
anything. Now `stillAhead(row.arrives)` runs on every such list, so a line
waiting on a shipped ticket fails.

Net worth is also fixed: cash + portfolio − (cards + loans), with `onlyCash` now
computed from what the character holds rather than hard-coded.

## 13.52 — the liquidity trap does not exist

The engine was designed around one, and the module header said so in confident
prose: nothing auto-liquidates, so a character with $200,000 invested and $0 in
the bank starts paying card interest to hold shares.

It is not true. Across 800 lives — five strategies, two player types, 80 seeds
— two of which hold literally zero cash by construction:

| | shortfall years | card-debt years | years at $0 cash |
|---|---|---|---|
| every strategy, careerist | **0%** | **0%** | 3% |
| every strategy, drifter | **0%** | **0%** | 8% |

Characters do run out of money and it costs them nothing, because a year's
income is posted before that year's costs are paid. Being broke on the first of
January is free.

That is the same missing thing as 13.50, seen from the other side. **Nothing in
this build ever needs cash by a date.** Because waiting is free, no instrument
that buys time is worth its interest — every loan is dominated. Because being
broke is free, no instrument that keeps money liquid is worth its lower return —
holding cash for safety is a cost with no benefit. One fix upstream (a deadline
and a floor) would make both halves work; it belongs to neither ticket.

The header now says what was measured, including what it used to claim. A design
note that quietly becomes false is worse than no note.

## The private line, which makes 13.49's gate real

It shipped in 0307 as a `lineOfCredit` wanting $140,000 a year — the top rung of
an income ladder and nothing else. It is now `wealthPrivate`, secured on the
portfolio: 40% of everything non-crypto, nothing below $75,000, income test down
to $25,000. Crypto is not collateral, because a bank lending against something
that can halve in a year is not running a product.

13.49 recorded a credit gate that had never once been the binding constraint —
26,550 of 26,550 refusals would have failed the income gate behind it — and
noted it would stay untested until something decoupled assets from income.
Credit standing now counts the portfolio in its assets term, and a borrower with
$300,000 invested and a $45,000 salary gets a different answer from the income
gate for the first time in the build.

## Two defects from reading the built screen

**A character with $0 got seven refusals**, each naming a minimum they could not
reach by any amount — "Takes $500 to open" under a balance of nothing. Seven
true sentences, not one of them the reason. Now: an empty-handed character gets
one sentence (the CardsScreen fix from 0306 in a new place), and a refusal names
*both* numbers — "Opens at $2,500, and you have $600" — so it can never be the
wrong one.

**"pays out yearly" was on five of seven rows**, including an index fund at 1.5%
next to corporate bonds at 4.6%, implying they were the same kind of thing. A
tag on most of a list is not telling anyone which ones differ. Threshold is now
2.5%, where a yield stops being a rounding error and becomes a reason to hold.

## A harness that could not do the job, again

The browser harness drove every life to thirty-four, unemployed, with $0 — so
the buy flow was unreachable and only the empty state could be read. That is the
harness, not the game; it is the same shape as 0307's measurement bug, where a
population that never applied for a job made every number downstream worthless.

After two failed attempts I stopped and used the routine the 0306 write-up
recorded as the one that works: build a real state through the engine and assert
what the screen *would* say. `packages/simulation/src/investing.test.ts` is that,
and it is better than a screenshot in one way that matters — it stays.

It immediately caught **five of seven product subtitles over the 48-character
budget** for a row that also carries a value. That is the clipped-subtitle
defect that has shipped in four consecutive tickets, and the first time it was
found before shipping rather than after. The length is now a test.

The validator also caught "have not" (needs a contraction) and "realised"
(British), both in my own copy — the same two rules that caught me in 0307.

## Still open

- **Deadlines and a floor (13.52).** The single upstream gap behind both 13.50
  and 13.52. Until it exists, every time-buying and every liquidity-preserving
  instrument in the game is dominated.
- Education has no clock (13.50).
- Card rewards are declared and never paid.
- Weddings, rings and adoption still priced `min(price, cash)`.
- `currentLocation` never changes.
- Crypto's tail reaches $829m at 1-in-3,000 over 45 years of maximum
  contributions. Measured and bounded per year rather than capped outright —
  worth a look if spec 1478's wealth bands need a ceiling.
