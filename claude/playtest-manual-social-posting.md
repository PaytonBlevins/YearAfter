# Social Media playtest — free accounts and manual posting

**Requested by Payton:** 6 October 2026. Agent B, branch
`feat/manual-social-posting`, based on main `9925d30` (0708 screens, save v43).
Claim recorded before implementation. This request authorizes the engine and
optional save-field changes needed for these screen behaviors.

**Spec sections:** MASTER_SPEC 849–943 (creator screens and hubs), 661 (hidden
workload), 1361–1372 (creator milestone). The explicit playtest request replaces
mandatory signup charges and automatic posting in the live game.

**Allowed files:** creator content/configuration, creator finance/simulation APIs,
optional channel publishing validation, mobile creator actions/screens, their
tests, and these tracking docs. Approved decisions, CORE_RULES, general event
wording, business logic and unrelated saves remain untouched.

## Built

- Creating an account costs nothing, including when cash is zero. No transaction
  or debt is created. Existing age/category, duplicate and four-account limits
  remain. Replacement equipment prices are separate from signup and retain the
  existing damage-event prices; recurring mandatory equipment upkeep is zero.
- Real display names: YouTube, Twitch, Instagram, TikTok, Amazon Music Podcasts,
  Substack, Kick, Facebook and X (Twitter). Original six platform IDs stay stable;
  three new IDs extend the catalog. Kick uses the Twitch simulation model;
  Facebook and X use the photo model. These are game approximations, not newly
  researched real-platform rates or integrations with the services.
- Each account has a Post activity: choose a format, then explicitly publish.
  Instagram includes family/food photos, memes, dance and challenge videos;
  YouTube has vlogs, tutorials, gameplay, reviews and music; streaming has gaming,
  chatting, cooking and community streams; podcasts have solo/interview/roundtable
  episodes; writing and X have distinct text choices. Menus contain 4–8 choices.
  Existing sponsorships, collaborations, groups and representation remain in
  the Social Media hub. The references informed the variety of choices, not copied
  visuals or unrelated follower-buying/trolling mechanics.
- Publishing immediately reports audience gained, lost or unchanged, writes a
  timeline entry, and saves the selected account's result. Opening or selecting
  a format does not publish. Posts use deterministic seed/account/year/attempt
  keys; choosing another format does not reroll the underlying reaction.
- Advancing a year never creates a post. Idle accounts lose audience to the
  existing churn, have no new output income and add no creator workload. Posts
  the player chose can continue spreading, and income settles annually in
  proportion to the number of posts. Contracted sponsor payments remain owed.
- Fame target uses weighted total audience: 1,400 Instagram followers → 0;
  10,000 → 3; 100,000 → 15; 1m → 40; 10m → 65; 100m → 90; 400m → 100.
  Fame earned elsewhere is preserved. Existing fame falls toward the new target
  through the existing yearly decay; this does not retroactively wipe old fame.

## Pacing and persistence

Initial game choices: twelve meaningful publishing actions per account per game
year; 40 minimum discovery, one-percent audience loss before format adjustment,
and format-specific discovery/risk values in `post-formats.ts`. These values
require playtesting, particularly mature-account growth. The existing annual
growth and viral models remain; active accounts also have a per-post viral roll.
This is not a claim that those models were calibrated against real services.

A throwaway measurement used 100 seeds per platform, quality 0.8, the first
supported category/format, and six years of 0, 1 or 12 explicit posts each year.
Every idle account ended at zero audience and zero gross earnings. Median final
audiences for 1 / 12 posts were YouTube 310 / 1,343; Twitch and Kick 225 / 597;
Instagram, Facebook and X 347 / 1,565; TikTok 588 / 2,981; podcast 238 / 1,115;
Substack 269 / 1,322. All median fame targets stayed zero. Mean six-year gross at
12 posts ranged from $718 for TikTok to $21,400 for Substack, using the existing
monetization curves. These observations support low ordinary reach, not mature
account calibration; boosts, other formats and rare breakout tails need playtests.

Optional `Channel.publishing` saves `{year,count,kind,gained}`. Old v43 channels
without it load as unposted; the validator rejects malformed new metadata. No
required field or save-version bump. Reloading preserves the annual count and
next-post result. Default low-level `channelYear` remains available for existing
model calibration; live `runCreatorsYear` always requests manual publishing.

## Validation

New tests exercise free creation for every platform, platform-specific menus,
different positive/negative reactions across 100 seeds, deterministic replay,
selected-account isolation, annual limits and reset, idle yearly settlement,
legacy save loading and malformed metadata. Mobile tests use the real
GameProvider, commands and memory save repository, mocking native/navigation
boundaries only; they cover choose/confirm, cancel, reload at the limit, tailored
menus, free signup and persisted outcomes.

Existing expectations for signup charges, equipment upkeep and automatic output
were intentionally corrected to match Payton's request. Annual income/tax/group
fixtures now explicitly carry player publication activity; no tests were deleted.
The one opened-account line that claimed a first post happened automatically was
corrected. General life-event wording remains deferred.

`pnpm verify`: all typechecks and 2,432 tests pass; content validation still fails on
the same nine pre-existing generator/catalog mismatches. Changed creator content
tests pass. The validator's vehicle-mod catalog rewrite is restored, not included.
Native device/simulator checks remain pending because this environment has no
Android/iOS simulator.

Fifteen deliberate mutations were exercised and caught: reintroduce a signup cash
gate; deduct signup cash; restore the old small-audience fame curve; allow a
thirteenth post; prevent the yearly budget reset; accept the wrong platform's
format; store a post under the wrong year; grow idle audiences automatically;
disable manual mode in yearly simulation; update the wrong account; erase fame
earned elsewhere; accept a corrupt saved count; discard the UI's format choice;
publish when choosing a format; enable publishing at the UI limit. Initially the
wrong-year mutation survived the persistence suite; explicit current-year and
next-post-count assertions were added and caught it on rerun. None missed in the
final set. Production source was restored byte for byte after each mutation.

## Integration

Purchase-payment PR #10 also edits account opening. When combining it with this
change, keep free account creation and remove its channel signup payment choice;
other purchase payment choices remain valid. Business-warning PR #11 is separate.
