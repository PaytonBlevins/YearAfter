# Ticket 0308c — The instrument catalog

**Save goes to v23.** **Shipped** as `224c7af` on `mac-lan`, working tree clean.

**You should still run `pnpm install`** — `@yearafter/finance` now depends on
`@yearafter/content` for the catalog, the first new workspace dependency since
the finance milestone started. I created the one symlink pnpm would have created
(`packages/finance/node_modules/@yearafter/content -> ../../../content`) so the
build resolves without it, but the lockfile change should be installed properly
from your own terminal rather than left to a hand-made link.

29/29 tasks, 240 simulation tests, 110 finance tests, 59 persistence tests,
validator green at 8 catalogs / 669 content ids.

## The architectural change

0308 shipped seven **products** — "Index Fund", "Growth Shares", "Crypto" —
categories with a drift and a spread. You could hold a *kind of thing*, never a
thing, and nothing had a price you could recognise.

0308c ships **89 named instruments**, each with a ticker, a sector, a price per
unit and a rolling twelve-year history. A holding is now "412 shares of
Northline Freight at $103.25", not "$42,000 of stocks".

| tier | count | price range |
|---|---|---|
| stocks | 42, across 7 sectors | $12.80 – $391.80 |
| penny stocks | 12 | $0.48 – $6.90 |
| crypto | 14 | $0.04 – $18,400 |
| funds | 8 | $45.75 – $340.90 |
| government bonds | 13, across 5 issuers, 3–10 years | $1,000 par |

Names follow the house voice from `employers.json` — Marlow & Pine, Halcott
Stores, Ninth Street Supply. Deliberately not the reference app's register,
which runs to PrawnHub Group and DeepCoin (BALZ); that is a different game's
sense of humour and would sit badly against this build's copy. Crypto is allowed
to be a little sillier because real crypto naming genuinely is.

## Three things it does that the reference app does not

**Sectors are a correlation, not a heading.** Instruments sharing a sector take
one shared shock each year. Holding six technology names is not six decisions.

**Your position is shown while browsing.** The reference app's market list tells
you what everything costs and never what you already own, so the one number you
need to decide with is on a different screen.

**The chart marks what you paid.** A price line says what the market did; a line
with your own entry on it says what *you* did.

And one thing it refuses to copy: that app puts "1-Yr Return: 13.0%" directly
above a chart showing the coin falling from $2,200 to $1,712 over five years — a
backward-looking number placed where a reader takes it for a forecast. The
change is shown once, as a change, next to a chart that carries its own context.

## The correlation was nearly inert, and a passing test hid it

`SECTOR_WEIGHT` started at 0.55 against a sector shock of 0.14. The
portfolio-level test passed: six technology names came out visibly wider than
six spread across sectors (band 7.91 against 4.81), which looked like the
mechanic working.

It was not. Measured directly, the correlation of annual returns was:

| | correlation |
|---|---|
| two technology names | 0.276 |
| technology vs consumer | 0.246 |

**A gap of three hundredths.** The portfolio test was passing because technology
names have higher drift and wider spreads than one-per-sector picks — a property
of the catalog, not of the correlation, and the test could not tell those apart.

Redistributing the variance rather than adding to it (`SECTOR_SHOCK` 0.26,
`SECTOR_WEIGHT` 0.85, and each instrument's own spread scaled by
`IDIOSYNCRATIC` 0.62, so a single holding is about as volatile as before):

| | before | after |
|---|---|---|
| two technology names | 0.276 | **0.707** |
| technology vs consumer | 0.246 | **0.164** |
| gap | 0.030 | **0.543** |

And the portfolio outcomes are now the right shape — same middle, better floor,
worse ceiling:

| | p10 | median | p90 | band |
|---|---|---|---|---|
| spread across six sectors | 0.65x | 2.03x | 5.37x | 4.72 |
| all six in one sector | **0.33x** | 2.19x | **9.13x** | **8.81** |

The medians converged from a 23% gap to 8%, which is the tell that the band
difference is now the correlation rather than the catalog.

**The lesson worth keeping:** a mechanic that only shows up in an aggregate can
be entirely absent and still pass an aggregate test. Measure the mechanism
itself, not a consequence that has other causes.

## Two defects the tests caught

**A dangling id in the migration.** The v22→v23 mapping pointed `inv.govbonds`
at `bd.cald8` — a Caldonian eight-year bond. Caldonian issues three, five and
ten. Nothing complained: a holding whose instrument cannot be found simply has
no price, so **every government bond a player owned would have silently become
worthless.** The content validator walks catalogs, not the code that refers to
them. There are now four migration tests, and the one that caught it checked the
*money* rather than the shape.

**A price that decays to zero.** The 5%-of-value floor rounds to zero on
anything cheap: a four-cent coin floors at `round(0.2)` = 0, decays to 2¢, then
1¢, then nothing — and a price of zero makes every holding worthless and every
future purchase a division by zero. Caught by a test that simply asserted no
instrument is ever priced at zero. Floor is now `max(1, …)` everywhere.

Also caught before shipping: five of seven product subtitles over the 48-char
budget (0308's), thirteen bond blurbs that were five sentences repeated
(13.26), and "12 years" printed twice a line apart on the instrument screen —
caption and scale row saying the same thing.

## The Assets tab still said "Not built yet", and six other rows lied too

Reported after 0308b: *"the investments are only available when I click on the
finance tab. The investment tab still says not built yet."*

Exactly right. `shells.tsx` carried two rows pointing at investments — one on
Finance, wired to the screen, and one on Assets, still carrying
`ticket: '0308'` and therefore rendering as a placeholder for a ticket that had
already shipped. Two places holding the same fact, and one of them was wrong.

The fix is the check, not the row. **Validator section 7** now scans `shells.tsx`
for `ticket: 'NNNN'` and `<ComingSoon ticket="…">` and fails when the named
ticket is at or behind the current one. It immediately found **six more stale
placeholders**: five Mind & Body rows (Gym, Meditation, Books / Library, Diet,
Walk) labelled `0205`, which shipped four milestones ago, and Will & Estate
labelled `0212`, which shipped in v0.02.

Those seven were relabelled to the milestone that actually owes them (`v0.04`
and `v0.05`). The v0.04 assignment is flagged in a code comment as **a guess at
a schedule rather than a decision** — it is honest about the date being unknown,
which the old label was not.

This is **CORE_RULES 13.51** paying for itself in the ticket after the one that
wrote it: a test that pins a list catches a wrong deletion and never a missing
one. The 28-row "Not built yet" list had a test asserting its contents; that
test passed the whole time, because the row was present and the *label* was the
lie.

## Migration

v22 holdings are dollar blobs; v23 holdings are units at a price. Each old
product maps to the named instrument that best stands for it, and **units come
from the target's price**, not a frozen table — the first version held the *old*
product's price and made a $21,000 crypto holding fifteen times too valuable.

Reading the live catalog rather than freezing is deliberate: if a price is
retuned later, a save migrating afterwards gets a different unit count and the
**same value**, and value is the invariant that matters to whoever owns it.

Bond terms carry across. Nothing is refunded to cash — that would turn a market
position into a bank balance behind the player's back.

## Screens

- **Investments hub** — portfolio chart first, then holdings with the gap, then
  five market tiers each with a health bar. The reference app shows that bar on
  two of its five tiers and not the other three, which reads as a bug.
- **Market** — stocks grouped by sector (with per-sector health), bonds by
  issuer. Grouping by issuer is what stops the reference app's list problem: ten
  rows reading "Swedish Government Bond (3-Yr)", "(5-Yr)", "(10-Yr)" is one
  sentence with a number changed.
- **Instrument** — price, change, chart with your entry marked, blurb, position,
  buy and sell.
- **PriceChart** — inline SVG, coloured by direction, no axes or tooltips. A
  chart that needs a legend at phone size is doing too much.

## Why nothing shipped after 0308b

Worth recording, because it will happen again. The bridge to the Mac dropped
mid-push, so the 0308c tarball never landed and the repo sat at `3ef9940` with a
clean tree — which looks identical to "up to date" from the Mac's side. A clean
tree is not evidence that a push arrived; the test is whether a file the ticket
adds exists (`packages/content/data/instruments.json`, here).

Two further limits found while fixing it, both worth knowing:

- **The bridge shell is Linux; the repo's `node_modules` is macOS.** Rollup,
  turbo and pnpm all ship native binaries, so I cannot run the test suite or
  `pnpm install` from the bridge at all. The content validator runs because it is
  pure JS. **Anything with a native dependency has to be run by you.**
- **`turbo` needs the pnpm binary** even when its own binary resolves, so the
  whole gate is gated on the one tool that is not installed there.

## Still open

- Education has no clock (13.50). Unchanged.
- The happiness floor runs through event gating nobody wrote for that purpose
  (13.52's annotation) — worth deciding whether to make it deliberate.
- Card rewards are declared and never paid.
- `currentLocation` never changes.
- The v0.04 label on the five Mind & Body rows is a guess, not a decision.
- 0309 Advisors is next in the roadmap, and now has something to advise on.
