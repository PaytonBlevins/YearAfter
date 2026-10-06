# 0706 — Fame and creator events

**Status: ENGINE DONE. No screens yet (v0.07 screens are not assigned).**
No save bump (still version 42): an event is derived from the seed, the generation and the
year, and only what it changed is saved (an audience, a row on the books, a point of fame, a
nudge to happiness).

This is the last ticket of the v0.07 block. It does two things: it adds the events the block
was missing, and it re-tunes a few numbers the 0705 playtest and the roadmap findings said were
too hard. It does not fix everything on that list; the last section says what it left.

## What it adds

1. **Twenty-three events** (`content/src/creator-events.ts`): nine good and seven bad things
   that happen to one of the character's channels, and seven about being known. At most one a
   year. About one creator-year in two has one.
2. **A rank lift for a player's channel** (`finance/src/creators.ts`, `Platform.lift`). The
   audience curves are fitted to every channel there is, and most are abandoned. A player's is
   not. The luck draw is lifted in rank, not in audience, so the top stays as rare as before.
3. **Higher connection chances** for a celebrity answered well (`content/src/celebrity.ts`).

## Measured first

All of these are the game's own numbers, six years of a creator, regular effort unless
stated.

- **"Ever net-positive" by platform before the lift** (n = 50): video 48%, stream 10%,
  photo 42%, short-form 14%, podcast 8%, subscription 62%. This is backlog B6: "social
  success rates too low".
- **After** (n = 120): video 65%, stream 28%, photo 56%, short-form 40%, podcast 30%,
  subscription 69%. A living wage (net 30,000 dollars or more in year 6) is still 0–5%.
  Platform "monetized by year 6" against a channel drawn the sourced way: video 41→60%,
  stream 20→50%, photo 44→65%, short-form 19→37%, podcast 8→14%, subscription 51→62%.
- **The top:** the best-luck channels barely move. A draw of 0.99 on a lift of 3 comes out
  at 0.01/1.08 of the channels doing better, instead of 0.01 (pinned).
- **Fame** at year 6 stays low: median 1–14, 90th percentile 3–25. The lift does not change
  that, and the fame events need fame 8 or more, so they fire in only about 2.5% of
  creator-years (finding 64).
- **Effort** (video, six-year mean net): light 2,999–5,862 dollars; regular 27,000–32,000;
  heavy 75,000–88,000. Heavy costs about 11 happiness points over the six years (41.8 against
  52.6) plus the burnout event. Heavy still wins on money by about 2.7 times.
- **Event census:** 48% of creator-years have one; about 57% of events are good and 43% bad.
- **Connections per meeting** (fame 0, a player with money, n = 147 meetings, so ±4 points):
  compliment 36% (was 20%), picture 14% (was 11%), autograph 7.5% (was 3%), flirt 7% (a flirt
  lands only 15% of the time). At 1.7 meetings a life, a compliment-only life makes about 0.6
  connections (was 0.27). The mix a real player chooses was not measured (finding 67).

## Design

### The rank lift

A channel's luck is a draw fixed when it opens. `luckDraw(seed, id)` is the raw draw, as
before; `liftedLuck(draw, lift)` moves it up:

    share  = 1 - draw                      the share of channels that did better
    lifted = share / (1 + (lift - 1) × min(1, share / 0.25))
    luck   = 1 - lifted

Below the top quarter the full lift applies; above it fades to nothing at the very top. Each
platform has its own lift, because the platforms whose curves are steepest at the bottom need
more to be felt: video 1.5, stream 2.5, photo 1.5, short-form 2.0, podcast 2.5, subscription
1.2. A channel not opened through `newChannel` (the sourced population the tests measure
against) uses the raw draw.

This is a judgement. The size of each lift was set so a player's odds of ever getting paid
sit between "real life, where most channels never do" and "everybody makes it". The spec
asks for "more common than real life, not extremely overinflated" and no source says by how
much, so it was not forced to a number.

### The events

One event a year at most. `EVENT_CHANCE` is 0.45: when something could happen, it does in
45% of years. Which one is a weighted pick from what fits this year. Fitting is by platform,
category, audience size, past the platform's paying threshold (`paid`), effort (burnout is
heavy effort only), and for the fame events a range of fame. A famous mention also needs a
figure of fame 20 or more in the world that year, picked in proportion to their fame.

- **Good, on a channel:** shout-out, famous mention, featured by the platform, brand call,
  press link, fan clip, tips, a first fan, a letter that says it got somebody through a hard
  year.
- **Bad, on a channel:** an algorithm change, gear that fails, burnout (heavy effort only), a
  copyright claim, backlash, a change to the platform's pay rules, a copycat.
- **About being known** (fame 8 to 100, by event): recognized, asked for a picture, fan mail,
  an interview, a tabloid story, no privacy, an invitation. Mostly pleasant (spec 1334): the
  two that are not (a tabloid story, no privacy) weigh less than half of the ones that are,
  and neither costs more than two points of happiness.

An audience event moves a share of the channel's audience; a loss never takes more than it
has. Money moves as a share of the year's channel income (with a floor in dollars), or, for
gear and paperwork, as a share of the platform's start-up cost. A claim does both: it holds
back part of the year's pay and costs the paperwork. A famous mention brings what
`collabGain` gives for a following of 30% of that figure's, the same formula as 0704's
collaborations. Fame moves by whole points and happiness by the event's mood, through the
same yearly nudge as everything else.

**Where it sits in the year:** after every channel has had its year (what happens depends on
how big each channel is now and what it earned), before the manager's cut, so a brand job
pays commission like any other money. Money lands on the books as `creator` rows, so tax,
the ledger and the manager's cut see it. Fame is calculated on the channels after the event.

Everything is derived, nothing is drawn from the shared random stream, and an heir gets
their own luck because the generation is in the key.

### Connection chances

A good answer to a stranger leaves a connection with a chance of its own. Compliment 0.5
(was lower), flirt 0.55, autograph 0.1, picture 0.2. The 0705 doc has the rest of the model.

## What it is not

- **No screens.** The Social Media row on the Activities screen now points at 0801 so it
  stays shut (0706 is the current ticket and a door pointing at now would open).
- **No change to the sourced audience curves.** The lift moves who gets which luck, not
  what an audience of a given luck is.
- **No fix for 53, 55, 61** (below).
- **Fame did not get easier to earn.** The lift helps a channel become monetized; it does not
  change how audience becomes fame.

## Files

- `content/src/creator-events.ts` (new), exported from `content/src/index.ts`.
- `simulation/src/creator-events.ts` (new): eligibility, the draw, the effect.
- `simulation/src/creators.ts` (`runCreatorsYear` takes `seed` and `generation`, returns
  `mood` and `event`), `simulation/src/advance.ts` (passes them, adds the mood to the year's
  happiness nudge).
- `finance/src/creators.ts` (`luckDraw`, `liftedLuck`, `LUCK_LIFT`, `LUCK_LIFT_BELOW`),
  `content/src/creators.ts` (`Platform.lift`), `content/src/celebrity.ts` (connect values).
- `TICKET` is now '0706' in `finance/src/summary.ts` and `tools/content-validator/validate.mjs`.
  The Social Media row in `apps/mobile/src/screens/shells.tsx` moved to 0801.

## Tests and sabotage

- 46 simulation tests for the events (eligibility boundaries, the draw's rate and weights,
  every effect's range and cap, the year's wiring, the mood through a real life), 10 content
  tests (including a written-out table of every event's numbers), 125 finance creator tests
  (the lift: exact values, monotonic, the top barely touched, literal per-platform pins), 8
  celebrity content tests (the four connect values). The simulation suite is 805+ tests.
- **Sabotage:** 93 deliberate breakages. 65 were caught the first time; 28 survived. Of those,
  13 were real gaps (the fame clamp, the fame an event leaves, the manager's cut on a brand
  job, which channel an event changes, whether a peak rises, how gear costs spread, a token the
  line does not know, the role of a famous figure, which figure is picked, an unknown platform)
  and each now has a test. Fifteen remain and none can change behaviour: five only rename a
  hash key (the channel pick, the draw for whether anything happens, the creator-event key,
  and the unit names for audience and income); seven are guards nothing reaches (an empty
  roster or empty plan, a floor that is always at least a hundred dollars, an audience loss
  that cannot exceed 14% so the cap never bites, rounding that cannot reach zero at the
  smallest eligible audience); two are `>` against `>=` on a continuous draw or on a fame
  that is never exactly the boundary; and one adds a mood of zero to a nudge.
- **Bugs the tests found:** a gear line printed `$0` because it used `{amount}` for a cost
  (found by the new content test that matches each token to what the event supplies); three
  of 0701's tests pinned the sourced population and broke when a new channel's luck was
  lifted (they now use an explicit unlifted path, `luckDraw`).

## Open (see roadmap findings 47, 53, 55, 61, 64, 67 and 69–72)

Not done, and not claimed: the photo brand double count (55), the deal trust cost (53), the
manager against the agent end to end (61). Fame is still low (64). Heavy effort still wins on
money (47). The size of the lift and the event rates are judgements.
