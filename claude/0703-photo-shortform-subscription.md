# 0703 — Photo, short-form and subscription

**Status: ENGINE DONE. No screens yet (v0.07 screens are not assigned).**
No save version change: `paid`, `tier` and `viralYear` are optional fields on a
channel, so a v41 save loads as it is.

## What it adds

1. **Brand deals on all six platforms.** 0702's three offer kinds now cover photo
   (a run of posts), short-form (a set of clips) and subscription (sponsored
   issues).
2. **Viral posts** on short-form and photo: a one-year audience surge that fades.
3. **A paid tier on subscriptions:** a price the character chooses, a conversion
   rate that falls as a list grows, and paying readers who build up slowly and
   fall quickly.
4. **Request More is a fair gamble** on every deal (decided with Payton).

## Measured first

- **Sponsored post rates** (Influencer Marketing Hub, 2026), per post: under
  10,000 followers $10–100; 10–100k $100–500; 100–500k $500–5,000; 500k–1M
  $5,000–10,000; over 1M $10,000+. Influencer CPMs run $5–25. The model's going
  rate of $0.01 a follower (rising 30% a decade) is $1,300 a post at 100,000, and
  $10,000 at a million: inside every band.
- **Newsletters.** Substack's median free-to-paid conversion is about 3%
  (Really Good Business Ideas). A 2026 sample of publisher newsletters (Press
  Gazette) has a median of 0.62%, a typical price of $10 a month, monthly churn
  of 7.8–13.3%, and a subscriber lasting 6 to 20 months. The two disagree because
  the second is big publisher lists and the first is small, engaged ones, so
  conversion here falls with list size.
- **Short-form pay per thousand views:** Shorts $0.01–0.33, TikTok Creator Rewards
  $0.40–2.00 (AIR Media-Tech). The model's $0.09 is unchanged and inside the
  range.
- **Not found:** a usable population curve for Instagram or TikTok creators. What
  exists is biased toward big accounts (Mention's Instagram sample says 24% pass
  10,000; Pew's TikTok data is of creators Americans follow). So photo, short-form
  and subscription keep 0701's curve scaled by how hard they are to be found. See
  finding 54.

## Design

- **Viral** (`Platform.viral`, `viralGain`). Short-form: 12% of channels a year at
  regular effort and quality 1, surge up to 3 times the audience. Photo: 4%, 1.5
  times. Effort scales the chance (light ×0.5, regular ×1, heavy ×1.6), and so does
  quality squared. The size is 20–100% of the surge, on at least 500 people. Drawn
  from the seed, the channel and the year, so a reload cannot reroll it, and
  independent of luck. The gain is added after the year's drift; next year it
  falls back toward where the channel is headed at the platform's churn (50% of
  the excess on short-form). A fall right after a hit is not written as a slump
  (`viralYear`). A line is written the year it happens, with the number of people.
- **Brand deals** (`sponsorPay`). Photo: 4 posts at 1.5 times the going rate per
  post. Short-form: 5 clips, each seen by 30% of the followers, at $15 per
  thousand views. Subscription: 6 issues at $30 per thousand readers (an
  assumption, set beside the podcast's $25). All times the category's `pays` and a
  rate of 0.6–1.4. Interest, the $50 minimum, two offers a year, answers, trust
  cost and payment through the year's income are unchanged from 0702.
- **Pinned:** photo lifestyle 100,000 followers $7,800 (1 million $96,000);
  short-form comedy 1 million $20,250; newsletter writing 10,000 readers $1,440.
- **Request More:** 65% for +60%, worth 1.04 of the offer on average (it was
  0.585). Applies to all six platforms, 0702's included.
- **Paying readers** (`paidShare`, `paidNext`, `memberIncome`).
  - Three prices a month: $5, $8, $15 (`setPaidTier`; standard by default).
  - The share who pay at the category's expected price is 3%, and conversion
    peaks there: `3% × size × e^(1 − price ÷ expected)`, where the category
    expects $8 times its `pays`. So income per reader is highest at the expected
    price. Business expects $14.40, music $5.60.
  - Size: 3% up to 10,000 readers, 25% lower per tenfold above, never under 40%
    of that.
  - Each year the payers who stay are 40% of last year's (about 8% lost a month),
    and the rest close on the share of the new audience: `paid = old × 0.4 +
audience × share × 0.6`. A year is paid on the average of the start and end,
    after the platform's 13%. Nobody pays before the platform's 100-reader
    threshold, but the payers build up anyway.
  - What each price earns settled, on 10,000 readers: education $27,240 / $33,342 /
    $33,463; business $30,081 / $39,078 / $45,063; music $17,431 / $16,322 / $8,768;
    a $1.00 category $22,785 / $25,056 / $19,584. Standard is best for the middle,
    premium for business, cheap for music. `tierIncomes(channel)` gives a screen
    these numbers.

## Measured after (20,000 channels, quality 1, six years)

| Platform     | ≥1k   | ≥10k  | ≥100k | ≥1M   | Channels with a hit in 6 years |
| ------------ | ----- | ----- | ----- | ----- | ------------------------------ |
| Photo        | 35.9% | 6.9%  | 1.03% | 0.10% | 21.5%                          |
| Short-form   | 47.3% | 10.8% | 1.93% | 0.23% | 53.6%                          |
| Subscription | 20.4% | 3.7%  | 0.54% | 0.06% | none (it has no viral)         |

Hits per channel-year: photo 0.040, short-form 0.120, as set. A lucky business
newsletter at premium price, quality 1.2, went from 43,000 readers and 628 payers
the first year to 132,000 and 2,585 by the sixth: $49,000 then $387,000 a year.
The first year pays 13% of what a settled list of the same size would.

## The one test for each reader of a new rule (13.113 again)

Nothing new reads income: deals and subscriptions pay through `owed` and the
creator category, both already carried by 0701's readers.

## Tests

- `finance/creators.test.ts` (117 with the 0703 sections): tier prices, the pinned
  income of each tier by category, the best tier by category, conversion by list
  size, the payers' arithmetic, the lag and the collapse, below-threshold build-up,
  viral rates by platform, effort and quality, size range, ceiling, determinism,
  the line, slump suppression, income, the threshold edge.
- `finance/sponsorships.test.ts` (34): the new pays, offers from each threshold,
  brands, trust cost, the fair gamble.
- `simulation/creators.test.ts` (57): `setPaidTier` and its refusals, one channel
  only, a year at the set price, the tier kept through the years, the viral line
  with its figure, a deal on each platform.
- `persistence.test.ts`: the new fields survive a save.

## Sabotage

67 mutations: 58 caught first time, 9 survivors. Fixed: income was never tested at
a non-standard tier; the payment threshold was written twice (extracted to
`paysFrom`); the viral size range was only bounded on one side; a small photo
deal's rate floor; and the viral line's number. One dead clamp (room under a
ceiling) removed. Two equivalent mutants remain: `>=` against `>` on a continuous
draw, and the order of a viral note and a chart note, which never share a
platform.

## Open

Findings 52 (resolved), 53, and 54–58 in the roadmap.
