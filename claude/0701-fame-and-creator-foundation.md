# 0701 — Fame and the creator foundation

**Status: ENGINE DONE. No screens yet (v0.07 screens are not assigned).**
Save version 40 → **41**: `channels` and `fame`.

## What it is

A character of fourteen or older can open a **channel**: one thing made for one
platform in one category. Six platforms (video, streaming, photo and lifestyle,
short-form video, podcast, subscription), fifteen categories. Each year a
channel's audience moves toward where it is headed, it pays what that audience
is worth on that platform, and keeping it going costs upkeep. What it nets is
taxed as self-employment. The character's **Fame** (0–100) follows the total
audience across all their channels: up quickly, down slowly.

Talent helps and is never a gate (decided with Payton): anyone 14+ may open a
channel; a podcast or newsletter needs 16.

## Measured first (before any code)

vidIQ, July 2026, long-form video: **40.6%** of channels pass 1,000
subscribers, **7.9%** pass 10,000, **1.3%** pass 100,000, **0.13%** pass a
million. The median channel under 100 subscribers grows about 15% a year; over a
million, about 3%. Twitch: roughly one concurrent viewer per hundred followers.
Podcasts: a median episode gets about 421 downloads. Substack: about 3% of free
readers pay. YouTube Shorts: about $0.09 per thousand views.

## Design

- **Catalog** (`content/creators.ts`, `creator-lines.ts`). Platforms carry the
  age, start-up cost, threshold at which they start paying, how hard it is to be
  found (`discover`), a soft ceiling, churn, and how much their audience counts
  toward fame (`reach`). Categories carry their two stats, an optional talent,
  `crowding`, `swing` (how far fashions move it), and `pays` (what an audience is
  worth to a buyer, 0.7 for music to 1.8 for business).
- **Luck is drawn once.** `newChannel` draws `luck` in [0, 1) from the seed and
  the channel id (`ch:<year>:<platform>:<category>`) and never again, so a
  reload cannot reroll it, and closing and reopening in the same year gives the
  same channel. A later year is a new draw.
- **Where it settles.** `settledAudience(luck)` reads a log-log curve through the
  vidIQ anchors, ending at 3 people for the unluckiest and 30 million for the
  luckiest.
- **Where it is headed.** `targetAudience = settled × discover × quality² ×
effort × fashion × noise ÷ √crowding`, softly capped by the platform ceiling.
  Quality runs 0.6 to 1.4 on the category's two stats, plus 0.15 for the talent
  the category names. Fashion is `1 ± swing`, shared by everyone making that
  category in the year. Noise is 0.9–1.1 per channel-year.
- **How fast.** A channel closes 30% of the gap to its target a year at regular
  effort (21% light, 37.5% heavy). Above the target it falls back by the
  platform's churn × 2.5 (25% a year on video, 50% on short clips).
- **Income** by how each platform pays, from the audience at the middle of the
  year, nothing under the platform's threshold:
  - video: 70 views per subscriber × $4 per thousand
  - streaming: 0.6% of followers watching live × $200 a year each
  - photo: $0.01 a follower a post, rising 30% a decade, 20 sponsored posts
  - short-form: 400 views per follower × $0.09 per thousand
  - podcast: 52 episodes × listeners × $30 per thousand
  - subscription: 3% pay $8 a month, platform keeps 13%
    Each is multiplied by the category's `pays` and by the year's output.
- **Upkeep** is a quarter of the start-up cost a year at regular effort (half
  that light, 1.6× heavy). Start-up is a `spending` row.
- **Ledger.** New category `creator`: income is a positive row, upkeep a
  negative one, so the net is what counts.
- **Tax.** `businessTaxOn(wages + business draw, creator net)` (progressive
  tax over everything else plus 15.3% self-employment), posted as "Tax on
  creator income". A loss year is never a negative tax base.
- **Fame.** `20 × log10(1 + reach/1000)` where reach is audience × the
  platform's weight, clamped to 100 (1,000 followers is 6; a million is 60). It
  climbs by half the gap (rounded up) and falls by a seventh (at least 1).
- **Heirs** start with no channels and no fame.

## The readers of income (CORE_RULES 13.90 / 13.113)

One test each: the summary's tax rate (`summary.ts`), the car dealer
(`earnedIncomeOf`), the loan officer (`earnedOf`), the tax stacking order, the
deals' tax base, the household's standard of living (`afterTaxIncome`), a
lender's `incomeOf` (counts every positive non-debt row, so it needed no
change), and the timeline.

## Calibration (20,000 education channels, quality 0.6–1.4, through `channelYear`)

| Years     | ≥1k   | ≥10k | ≥100k | ≥1M    |
| --------- | ----- | ---- | ----- | ------ |
| 3         | 35.5% | 7.1% | 1.05% | 0.095% |
| 6         | 40.6% | 8.9% | 1.43% | 0.145% |
| 10        | 41.3% | 9.3% | 1.50% | 0.155% |
| Published | 40.6% | 7.9% | 1.3%  | 0.13%  |

A little above the source from ten thousand up, as people who keep making
things are better off than channels abandoned after a week.

Income at 100,000 followers: video $22,400 (gaming), streaming $96,000,
photo $26,000, short-form $3,240, podcast $140,400, subscription $350,784.
A million followers pays ten times the video figure, and 12.3 times the photo
figure.

A 3-million-subscriber channel netted $1.75M and paid $735k in tax at age 25 on
a $33k wage; the household's living costs rose from $7k to $295k a year with it.

## Tests

- `finance/creators.test.ts` (66): catalog, refusals and their boundaries,
  luck, long tail and the six-year shares, quality, fashion, the target to the
  dollar, growth and churn, pinned income for every platform, upkeep, a year,
  `noteFor` boundaries, fame.
- `simulation/creators.test.ts` (36): opening and closing, no reroll, quality
  from stats and talent, a year of channels, the year in the game (tax over a
  wage, over a deal, standard of living, books, timeline), an heir.
- `persistence.test.ts` (3 new): v40 → v41, round trip, corrupt rejection,
  keeping fields a v40 save already carries.
- `content/creators.test.ts` (3).

## Sabotage

108 mutations: 80 caught first time, 28 survivors. Closed by: dead clamps
removed (quality lower bound, `nextFame` outer max); `noteFor` extracted so its
boundaries could be pinned; an exact target test; a luck-versus-name
independence test; integration tests for every reader of income; a migration
that keeps what a v40 save already carries. Two equivalent mutants remain
(`>=` vs `>` on an exact anchor value).

## Open

See roadmap findings 47 (effort has no cost), 48 (fame feeds nothing yet), 49
(a child can earn a fortune).
