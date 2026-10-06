# 0702 — Video, streaming and podcasts

**Status: ENGINE DONE. No screens yet (v0.07 screens are not assigned).**
No save version change: `bestRank`, `owed` and `answered` are optional fields on a
channel, so a v41 save loads as it is.

## What it adds

On the three long-form platforms (video, streaming, podcast) a channel now has:

1. **Its own curve.** Streaming and podcasts settle on curves fitted to their own
   published figures instead of borrowing video's.
2. **Charts.** Where a channel stands among everything else on its platform, from
   #1,000 down to #1, with a line the first time it reaches a new tier.
3. **Fashions you can read.** A category's fashion lasts several years, and the
   game says it in words (hot, warm, steady, cool, cold) and whether it is rising.
4. **Sponsorship offers.** Up to two a year per channel, answered Accept, Request
   More or Decline.
5. **A cost for effort.** A channel's hours reach the hidden workload, so a pile of
   heavy channels is a way to have a bad year. This resolves roadmap finding 47.

## Design

- **Curves** (`content/creators.ts`, `Platform.settle`). Each is a list of
  `[share of channels, audience]` points read log-log, like 0701's.
  Stream: 5 followers for everyone, 830 at 5%, 28,000 at 0.79%, 500,000 at
  0.079%, 15 million for the luckiest. Podcast: 3 listeners for everyone, 409 at
  10%, 4,579 at 1%, 400,000 at 0.01%, 2.5 million for the luckiest. A platform
  with `settle` is read as written; one without keeps 0701's curve scaled by
  `discover`.
- **Charts** (`finance/creators.ts`). `chartRank = ceil(chart × share of the
platform at or above this audience)`, undefined past 1,000. Each platform
  carries the size of its chart: video 4,000,000, streaming 127,000, podcast
  110,000. The thousandth place is about 5.6 million video subscribers, 28,000
  stream followers and 5,000 podcast listeners. Number one is reachable on all
  three. Tiers worth a line are 1,000, 100, 10 and 1; `bestRank` remembers the
  best and only a better tier speaks.
- **Trends** (`trendOf`). This year's fashion is a mix of the last four years'
  draws, each weighing half the one after it, so a rising fashion is still
  rising next year. `trendWord` turns how far into its swing a fashion is into a
  word at 0.45 / 0.15 / -0.15 / -0.45 of the swing. Categories that barely move
  (swing under 0.12) are always steady. `trendsFor(platform, year)` lists them
  hottest first with a rising flag.
- **Workload.** Light 2, regular 5, heavy 9 discretionary hours a week per
  channel, added to the job's and school's in `runStress`. Never shown (spec 661).
- **Sponsorships** (`finance/sponsorships.ts`).
  - Derived from the seed, the year and the channel; only answers are saved
    (`answered`, and `owed` for money agreed).
  - A brand wants a channel from the platform's pay threshold up: 35% of the time
    at the threshold, plus 15 points for each tenfold of audience, capped at 90%.
  - Pay is a campaign: three videos at $25 per thousand views (0.4 views per
    subscriber), three streams at $15 per average viewer (0.6% of followers), or
    eight host-read podcast episodes at $25 per thousand listeners, times the
    category's `pays` and a rate of 0.6–1.4 the brand offers. Deals under $50 are
    not offered.
  - Pinned: video 100,000 gaming at the going rate $2,400; 1 million $24,000;
    stream 100,000 $21,600; podcast 5,000 comedy $900.
  - Accept books the money as `owed`, paid with the year's income, so it is taxed
    as creator income. It costs some trust: 1.5% of the audience on video and
    streams, 0.5% on a podcast.
  - Request More: 45% it works and the pay rises 30%; otherwise the brand walks.
  - Decline costs nothing. All four answers write a line on the timeline.
- **Ledger and tax.** Unchanged from 0701; an agreed deal arrives as part of the
  year's creator income.

## Measured (20,000 channels, quality 1, six years through `channelYear`)

| Platform | ≥1k   | ≥10k  | ≥100k | ≥1M   | On the chart | Top 100 |
| -------- | ----- | ----- | ----- | ----- | ------------ | ------- |
| Video    | 30.7% | 5.9%  | 0.93% | 0.14% | 0.030%       | 0.005%  |
| Stream   | 3.6%  | 1.06% | 0.23% | 0.03% | 0.575%       | 0.075%  |
| Podcast  | 3.6%  | 0.23% | 0.01% | 0.00% | 0.645%       | 0.045%  |

Video is lower than 0701's table because this one fixes quality at 1; 0701 spread
it 0.6–1.4. The streaming and podcast columns are shares of all channels opened
in a six-year run, so they are far smaller than video's at the same mark, as
those platforms' own figures are.

## Tests

- `finance/creators.test.ts` (123 with the sponsorship file): per-platform curves,
  chart thresholds and number one on every chart, the rounding of a place and
  exactly place 1,000, tiers and the line rule, best place kept after a worse
  year and after falling off, trend persistence, the words at their edges,
  hours.
- `finance/sponsorships.test.ts`: interest, pay pinned for each platform,
  offers (derived, capped, not repeated, seed-dependent), the brand's own draw,
  answers, trust cost, owed paid once.
- `simulation/creators.test.ts` (51): offers listed for the year it is, an answer
  touches one channel only, the timeline line for each of the four answers (and
  the figure it says), owed paid and taxed with the year's income and cleared,
  chart and trend views, channel hours raising stress by how many and how hard.
- `content/creators.test.ts`: the new line tokens.

## Sabotage

89 mutations: 60 caught first time, 29 survivors. Closed by: two dead clamps
removed (`brandInterest` lower bound, `chartRank` floor of 1); a tie-break in the
trend sort removed (the sort is stable); `leanWord` and `worthOffering`
extracted so their edges could be called; the stray `bestRank` ternary simplified
(`rest` already carried it). Tests added for: the offer year, one-channel
answers, each answer's timeline wording, and channel hours reaching stress.
Five equivalent mutants remain, all `<` against `<=` on a continuous value at one
exact point.

## Open

See roadmap findings 50–53 and the resolution of 47.
