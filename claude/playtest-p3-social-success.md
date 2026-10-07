# P3 — Social media success rates: approved change built

**Status: Payton approved the measured proposal; implementation and verification complete, PR #15 open for review.**
Agent B, `feat/playtest-p3-social-success`, 7 October 2026. Main remains `beff25a`; this branch
is stacked on P2 PR #14 and P1 PR #13. The claim is its own published commit.
PR: https://github.com/PaytonBlevins/YearAfter/pull/15 (targets main; merge P1 #13 then P2 #14 first).

**Spec sections:** MASTER_SPEC 236–237, 251, 255–259, 879–943, 944–953 (especially revised 949),
1361–1372, and the Fame, Public Figures & Creator Economy appendix. Payton’s manual-posting
request remains the explicit exception to the old automatic-output model.

**Allowed files:** creator configuration, finance and simulation creator/posting APIs, relevant
mobile/persistence readers and tests if needed, and P3 tracking docs/CORE_RULES lessons.
**Protected areas:** creator growth and balance are authorized by the P1–P16 brief. The approved
values below are applied. Save stays v45 on this stack. TICKET stays 0708. Existing screens use the
engine changes without new controls.

## Definitions and method

The throwaway harnesses live outside the repo. Accounts start free at the first permitted age:
14 on most platforms, 16 for podcasts and newsletters. No follower purchases, starting audience,
sponsor acceptance, collaborations or representation. Traction means reaching 1,000 people at
least once; this is a common audience milestone, not the platform’s monetization gate. First paid
year means recurring platform income above zero, reported conditional on ever earning it. One-off
payments are tracked separately. “Living wage” retains 0706’s $30,000 yearly creator income
benchmark, before personal income tax and household bills; it is not $30,000 take-home.

- Controlled six-year runs: 400 seeds per platform and posting policy (1, 4, 12 explicit posts a
  year), average quality 1 and regular effort, first supported category/format. The low-level
  publication and live manual annual settlement functions are used. Events are excluded here.
- Strong-play runs: 400 seeds per platform, twelve manual posts, heavy effort, quality 1.3,
  suitable high-paying categories on video/podcast/newsletter/short-form, and the format with
  the best discovery × successful-reaction share. No talent or manager. The stats supporting
  this quality are 87.5: this is attainable deliberate play, not an ordinary generated life.
- Both controlled samples were repeated across 24 start years (2020–2043) to check calendar
  sensitivity. Candidate luck is recalculated with the same seed/id and the proposed rank lift;
  it is not a favorable seed search.
- End-to-end lives: 60 generated seeds for each of nine platforms, zero/four/twelve posts,
  actual childhood, evolving stats/talents, pending choices resolved with the first accepted
  answer, and annual advance asserted. Followed until death or age 110. Median exposure is
  about 68–70 account-years. Household cash, school, work, taxes, health and creator events
  remain live. These are simple hobby policies, not active career optimization.

Historical 0702/0703 published anchors and the source-population curves are retained. This
measurement is of the game, not a new claim about real services’ success rates. A 400-seed tail
has limited precision: differences of one or two creators are not meaningful calibration gains.

## Pre-change early outcomes

Across varied calendars, regular effort and twelve posts, six years:

| Platform              | Ever recurring pay | Median first paid year among paid | Ever $30k/year | Median year-six income |
| --------------------- | ------------------ | --------------------------------- | -------------- | ---------------------- |
| YouTube               | 86.75%             | 3                                 | 1.75%          | $386                   |
| Twitch                | 100%               | 1                                 | 1.25%          | $743                   |
| Instagram             | 88.5%              | 2                                 | 1%             | $506                   |
| TikTok                | 37.25%             | 3                                 | 0%             | $0                     |
| Amazon Music Podcasts | 100%               | 2                                 | 0%             | $879                   |
| Substack              | 100%               | 1                                 | 6%             | $3,758                 |
| Kick                  | 100%               | 1                                 | 0.25%          | $728                   |
| Facebook              | 84%                | 2                                 | 1.5%           | $422                   |
| X (Twitter)           | 85%                | 2                                 | 1.25%          | $453                   |

Getting _some_ pay is not generally rare anymore. The manual discovery floor can carry even
low-luck persistent accounts over small partner thresholds. Full-time income remains a tail.
This corrects B6’s unchecked assertion; the old automatic-output figures are not the live game.

## Pre-change generated-life outcomes

All 540 idle-account lives have zero traction and zero recurring income. Every actively posting
life reaches 1,000 audience and some recurring income eventually, but this takes decades for
some casual TikTok accounts. This illustrates why lifetime “ever succeeded” alone is misleading.
The table is the actual generated-life sample, 60 seeds/platform/policy, with the original
shared birth year 2000; the varied-calendar follow-up below tests its largest anomaly.

| Platform              | Four posts: median first recurring paid year | Twelve posts: median first recurring paid year | Four posts: ever $30k/year | Twelve posts: ever $30k/year |
| --------------------- | -------------------------------------------- | ---------------------------------------------- | -------------------------- | ---------------------------- |
| YouTube               | 5                                            | 3                                              | 0%                         | 0%                           |
| Twitch                | 1                                            | 1                                              | 0%                         | 1.67%                        |
| Instagram             | 4                                            | 2                                              | 3.33%                      | 5%                           |
| TikTok                | 15                                           | 6                                              | 83.33%                     | 11.67%                       |
| Amazon Music Podcasts | 4                                            | 2                                              | 0%                         | 0%                           |
| Substack              | 1                                            | 1                                              | 6.67%                      | 15%                          |
| Kick                  | 1                                            | 1                                              | 0%                         | 0%                           |
| Facebook              | 5                                            | 2                                              | 5%                         | 3.33%                        |
| X (Twitter)           | 3                                            | 2                                              | 1.67%                      | 1.67%                        |

## Lifetime issue found before recommending higher rates

The fixed-calendar sample’s four-post TikTok policy reached $30k in 83.33% of lives, despite none
in its first six years. Varying birth years reduces that to 40%, still far above the twelve-post
policy’s 8.33%. Thus “post less” can win long-term.

Two live interactions cause this: settlement scales both positive growth **and negative drift**
by post count, so an account posting four times retains much more of a viral spike. It also grants
a second annual viral roll on top of each explicitly published post’s viral roll. The annual roll
has no life seed in its key: accounts with the same id/calendar share it. Strong effort and quality
multiply that extra roll. A six-year-only calibration misses the compound effect over decades.

In an isolated finance copy, using full ordinary downward drift and viral rolls only on actual
manual publications changes the varied-calendar TikTok lifetime sample as follows. Rank lift is
still the current 2 here:

| Policy            | Current: ever $30k | Isolated correction: ever $30k | Current median peak | Corrected median peak |
| ----------------- | ------------------ | ------------------------------ | ------------------- | --------------------- |
| Four posts/year   | 40%                | 0%                             | 1,189,942           | 14,688                |
| Twelve posts/year | 8.33%              | 0%                             | 137,601             | 36,965                |

Corrected recurring-pay shares are 55% / 81.67%; first paid year among those who pay is 7 / 5.
All still reach the 1,000-person traction milestone over a life. These corrections do not cap
success, confiscate existing audiences or remove their ordinary platform income. Positive annual
spread still scales to actual posting. Idle accounts retain ordinary churn and earn no output
income. Contracted payments remain owed. The old low-level automatic model remains available
for its source calibration.

## Approved values — applied after Payton’s approval

1. Keep free accounts, manual choices, twelve-post cap, format discovery/risk, platform income
   rates, and the fame anchors (1,400 → 0; 10,000 → 3). No fameTarget change.
2. Use full existing downward drift for an active account above its target, regardless of posting
   count. Only positive spreading scales with output count. This removes the low-effort retention
   advantage without inventing a new churn rate.
3. In live manual settlement, use the viral opportunities already rolled when the player posts;
   do not give a second automatic annual viral opportunity. Per-post probabilities stay unchanged.
4. Rank lifts: YouTube **1.5 → 3**, Twitch/Kick **2.5 → 5**, Instagram/Facebook/X **1.5 → 3**,
   TikTok **2 → 3**, podcasts **2.5 → 5**, Substack **1.2 → 2**. Keep the top-quarter fade (0.25),
   source curves, and extreme-success ceilings. Applies to new accounts; existing saved luck stays
   fixed, and existing accounts still receive the settlement corrections.

The combined isolated proposal below uses the settlement correction in **both** columns so the
lift’s benefit is distinguished from removing runaway growth. Strong-play six-year runs, across
24 calendars, 400 seeds per platform; wage share means any year, not a permanently sustained wage:

| Platform              | Current lift: ever $30k | Proposed lift: ever $30k | Current median year-six income | Proposed median year-six income |
| --------------------- | ----------------------- | ------------------------ | ------------------------------ | ------------------------------- |
| YouTube               | 5.5%                    | 9.25%                    | $2,556                         | $5,794                          |
| Twitch                | 2.75%                   | 3%                       | $1,601                         | $2,034                          |
| Instagram             | 4%                      | 5.5%                     | $1,405                         | $3,384                          |
| TikTok                | 1.5%                    | 2.25%                    | $928                           | $1,642                          |
| Amazon Music Podcasts | 0.5%                    | 0.5%                     | $2,879                         | $3,711                          |
| Substack              | 11%                     | 17%                      | $6,556                         | $9,981                          |
| Kick                  | 0.25%                   | 0.5%                     | $1,564                         | $1,903                          |
| Facebook              | 5.25%                   | 7.25%                    | $1,330                         | $3,115                          |
| X (Twitter)           | 3.75%                   | 5.75%                    | $1,361                         | $3,446                          |

This improves deliberate play without making a normal hobby a salary. Streaming and podcast
full-time careers remain especially rare: the lifts mostly improve side income. Testing an even
larger lift (8 for streams, 12 for podcasts) did not give a convincing six-year tail improvement;
I recommend the moderate values rather than treating bigger numbers as a solution.

The combined proposal was also tested through the varied-calendar TikTok lives. Four/twelve
posts give 80% / 100% ever recurring pay, a median first paid year of 5 / 5 among paid lives,
and median peaks of 24,776 / 59,017. None of these 60-seed hobby lives reaches $30k; that is
a small tail sample, not evidence of an unreachable career (the strong-play cohort does).

## Final production calibration

Repeated with the real production functions after implementation. Controlled runs use
`p3-control-${i}`, 400 seeds/platform, starts 2020 + i % 24, twelve posts per year for six years.
Generated lives use `p3-life-${i}`, 60 seeds/platform/policy, default birth year 2000 and the actual
advance pipeline through death or age 110. These are the same paired seed policies as above;
no favorable-seed search. Six-year income is the year-six amount; wage is any year at $30,000
before personal tax and living bills, not a guaranteed ongoing career.

| Platform              | Regular: recurring pay | Regular: first paid year | Regular: ever $30k | Regular: year-six median | Strong: ever $30k | Strong: year-six median |
| --------------------- | ---------------------- | ------------------------ | ------------------ | ------------------------ | ----------------- | ----------------------- |
| YouTube               | 100%                   | 2                        | 1.75%              | $687                     | 9.25%             | $5,794                  |
| Twitch                | 100%                   | 1                        | 1.25%              | $848                     | 3%                | $2,034                  |
| Instagram             | 100%                   | 1                        | 1%                 | $913                     | 5.5%              | $3,384                  |
| TikTok                | 43.5%                  | 3                        | 0%                 | $0                       | 2.25%             | $1,642                  |
| Amazon Music Podcasts | 100%                   | 2                        | 0%                 | $978                     | 0.5%              | $3,711                  |
| Substack              | 100%                   | 1                        | 6.75%              | $4,844                   | 17%               | $9,981                  |
| Kick                  | 100%                   | 1                        | 0.25%              | $823                     | 0.5%              | $1,903                  |
| Facebook              | 100%                   | 1                        | 1.25%              | $860                     | 7.25%             | $3,115                  |
| X (Twitter)           | 100%                   | 1                        | 1%                 | $900                     | 5.75%             | $3,446                  |

The strong-play final figures reproduce the approved proposal. Generated-life results:

| Platform              | Four posts: traction | Four: recurring pay | Four: first paid year | Four: ever $30k | Twelve: traction | Twelve: recurring pay | Twelve: first paid year | Twelve: ever $30k | Twelve: median peak |
| --------------------- | -------------------- | ------------------- | --------------------- | --------------- | ---------------- | --------------------- | ----------------------- | ----------------- | ------------------- |
| YouTube               | 100%                 | 100%                | 3                     | 0%              | 100%             | 100%                  | 2                       | 0%                | 6,966               |
| Twitch                | 41.67%               | 100%                | 1                     | 0%              | 100%             | 100%                  | 1                       | 1.67%             | 1,421               |
| Instagram             | 100%                 | 100%                | 2                     | 0%              | 100%             | 100%                  | 1                       | 5%                | 17,245              |
| TikTok                | 100%                 | 80%                 | 14                    | 0%              | 100%             | 98.33%                | 6                       | 1.67%             | 72,649              |
| Amazon Music Podcasts | 100%                 | 100%                | 3                     | 0%              | 100%             | 100%                  | 2                       | 0%                | 3,016               |
| Substack              | 100%                 | 100%                | 1                     | 6.67%           | 100%             | 100%                  | 1                       | 23.33%            | 4,980               |
| Kick                  | 40%                  | 100%                | 1                     | 0%              | 100%             | 100%                  | 1                       | 0%                | 1,481               |
| Facebook              | 100%                 | 100%                | 2                     | 0%              | 100%             | 100%                  | 1                       | 3.33%             | 15,090              |
| X (Twitter)           | 100%                 | 100%                | 2                     | 0%              | 100%             | 100%                  | 1                       | 1.67%             | 16,009              |

All 540 idle accounts still have zero traction and zero recurring pay. With twelve posts all
platforms reach the traction milestone; 59/60 TikTok lives eventually get recurring pay, compared
with 48/60 at four posts. First-paid medians are conditional on earning: TikTok is six years at
twelve posts versus fourteen at four. First-paid time can be long in ordinary generated lives;
these are hobby policies without deliberate optimization. Four-post streams often earn a small
amount without reaching 1,000 followers. The lifetime and short-run definitions are not interchangeable.

The fixed-calendar final TikTok wage shares are 0% / 1.67% for four/twelve posts, compared with
83.33% / 11.67% before the correction. The earlier varied-calendar approved-proposal sample
was 0% / 0%; it is a separate cohort. Small tail counts do not establish a stable population rate.

## Implementation and regression coverage

The production result matches the approved isolated proposal. New accounts draw luck with the
new lifts; existing saved luck is not recalculated. Manual settlement scales only positive spread
by output count and uses full existing downward drift above target. It no longer rolls a second
annual breakout. Seeded explicit publication rolls, risks, ceilings and immediate discovery remain.
Idle accounts churn without output income; contracted sponsor payments are still owed exactly once.
The old low-level automatic model remains available for historical source calibration.

No save shape, migration or version change was needed. Round-trip tests exposed a pre-existing
validator gap: saved luck could be a string, nonfinite number or outside [0, 1]. Validation now
rejects those corrupt values and accepts both valid endpoints without retuning them. The v40
carried-channel test had an id-only fake channel; it now carries a valid real channel and retains
its exact preservation assertions.

There are **31 new tests**: finance 19, simulation 4, persistence 8. They cover literal lifts and
alias values, saved luck, above-target downward drift for one/four/twelve posts, scaled growth and
pay, idle churn, sponsor payment, historical peak, explicit seeded breakouts, ceiling, deterministic
replay, outcome bands, live manual integration, tax/ledger reconciliation and save continuation.
Existing mobile suites still pass; no screen or store changes were needed.

Existing 0706 lift assertions were updated to the approved values. Its statistical player/source
ratio bands are tighter measured P3 bounds (video 2.4–2.5, stream 4.6–4.8, short-form 2.9–3.1,
podcast 4.8–5.1); source calibration and upper-tail guards remain. The old automatic annual viral
integration case now tests an explicit post breakout, its timeline, unchanged money at posting,
and no second annual breakout. These changes reflect the approved manual contract; no test was
removed or assertion weakened.

## Independent sabotage verification

A tar backup was made before mutation. Each mutation was applied alone, selected tests run, and
production bytes restored. All 28 were caught by test assertions, not merely a compiler error.
The final MD5s of all five source files matched their pre-mutation backups. **None missed.**

| Mutation                               | Result |
| -------------------------------------- | ------ |
| 1. revert video lift                   | Caught |
| 2. revert stream lift                  | Caught |
| 3. revert photo lift                   | Caught |
| 4. revert shortform lift               | Caught |
| 5. revert podcast lift                 | Caught |
| 6. revert subscription lift            | Caught |
| 7. revert Kick lift                    | Caught |
| 8. revert Facebook lift                | Caught |
| 9. revert X lift                       | Caught |
| 10. shelter spikes with fewer posts    | Caught |
| 11. full spread from one post          | Caught |
| 12. restore extra annual viral roll    | Caught |
| 13. read wrong publishing year         | Caught |
| 14. pay full output for one post       | Caught |
| 15. stop idle churn                    | Caught |
| 16. pay sponsors twice                 | Caught |
| 17. erase historical peak              | Caught |
| 18. reroll saved luck                  | Caught |
| 19. automatic live settlement          | Caught |
| 20. omit seed from explicit viral roll | Caught |
| 21. double explicit viral chance       | Caught |
| 22. remove explicit surge              | Caught |
| 23. remove publication ceiling         | Caught |
| 24. pay on publication                 | Caught |
| 25. allow thirteenth post              | Caught |
| 26. accept nonfinite saved luck        | Caught |
| 27. reject valid upper luck endpoint   | Caught |
| 28. accept invalid saved luck          | Caught |

## Verification and open checks

Full `pnpm verify`: all 15 typecheck tasks and all **2,598 tests** passed (P2 baseline 2,567
plus 31). It then failed nine byte-for-byte generator/catalog comparisons: activities, advice,
auctions, businesses, events-childhood, homes, renovations, valuables and vehicles. A fresh
`origin/main` archive at `beff25a` produces the exact same nine failures in this environment.
No catalog reformat is included; the validator’s incidental vehicle-mods rewrite was restored.

`pnpm format:check` fails on 22 untouched historical Claude notes, the same baseline documented
by P2. Every P3 changed file is formatted and checked individually. P3 CI status is reported in
the PR; local full verification is not described as green. The implementation commit’s CI run 88
(https://github.com/PaytonBlevins/YearAfter/actions/runs/37691253117) fails Format check on exactly those
22 historical notes; typecheck, tests and content validation are skipped in CI. Those checks did
run locally as reported above. Runtime pnpm is 11.25 rather than the
repo’s pinned 10.28, so dependency auto-refresh was disabled for the verify command; dependencies
and lockfile were not changed.

CORE_RULES lessons 13.139–13.141 record the low-output windfall, lifetime calibration and corrupt
saved-draw findings. No fame, free-account, manual-post cap, source curve, income-rate, TICKET or
save-version change beyond the approved P3 values. Native device checks and Claude Project
mirroring remain unavailable. PR review and merge remain open. P4 and general life-event wording
have not started.
