# 0707 — Fame opportunities

**Status: DONE.** The engine shipped here; the Social Media and Fame screens that use it shipped in 0708 (`claude/0708-social-media-and-fame-screens.md`).
Save version 42 → 43: `celebrities.work`. A v42 save migrates to nothing said yes to.

Payton asked for a Fame screen where the player sees their exact fame and can take photoshoots,
commercials, talk shows and guest-star parts. None of those existed (0705 has only a guest spot with
a famous friend), so this ticket builds the engine behind them and 0708 builds the screens.

## What it adds

Four things a person with a name is offered (`content/src/fame-work.ts`), each once a year at most:

| Thing           | Offered from fame | Pays                            | Fame | Happiness | Audience                    |
| --------------- | ----------------- | ------------------------------- | ---- | --------- | --------------------------- |
| Photoshoot      | 6                 | 6 posts' worth, at least $200   | +1   | +1        | —                           |
| Commercial      | 12                | 12 posts' worth, at least $800  | +1   | 0         | —                           |
| Talk show       | 20                | 1 post's worth, at least $500   | +2   | +1        | 3–8% of the biggest channel |
| Guest-star part | 28                | 4 posts' worth, at least $1,283 | +3   | +2        | 2–6% of the biggest channel |

"A post's worth" is the going rate for one post at the character's fame: `10 ^ ((fame + 18) / 20)`
dollars. Offers are for somebody sixteen or older and alive.

## Measured

- **What the rate is anchored to.** Influencer rates per post (Neal Schaffer's 2026 survey): nano
  (1k–10k followers) $10–100, micro (10k–100k) $100–1,000, macro (100k–1M) $1,000–10,000, mega
  (1M+) $10,000–100,000+. The game's fame is `20 × log10(1 + reach/1000)`, so fame 22 is a following
  of ten thousand and 60 is a million. The rate formula gives $100 at fame 22, $794 at 40, $7,943 at
  60 and $79,433 at 80, which sits in those tiers. A day on set is SAG-AFTRA's 2026–27 day-performer
  minimum, $1,283 (a week is $4,456); that is the guest part's floor.
- **Who gets offered** (100 dedicated video creators, ten years each, answering yes to everything;
  989 creator-years): 27% of creator-years had at least one offer, 0.41 offers a year, and 55 of the
  100 were offered something at some point. Of 409 offers, photoshoots were 201, commercials 106, talk shows 70 and guest parts 32. Fame of these creators by year, median/90th percentile: year 1 2/9, year 3 6/22, year 5
  7/28, year 9 8/38.
- **What it pays against the channel,** by the fame the year ended at: under 10, $11 against a
  channel net of −$127; 10–19, $232 against $887; 20–29, $1,035 against $3,284; 30–49, $6,187 against
  $18,273; 50 and up, $975,563 against $337,827 (19 creator-years, a few of them past fame 80). So
  work is about a third of a channel's net in the middle and about 0.8 times a channel's own income
  from fame 60 up, where the rate formula and the platforms' own curves are both steep.

## Design

- **Derived, not saved.** Whether a thing is offered is a hash of the seed, the generation, the year
  and the thing, against a chance of 35% at its level plus a point for every point of fame past it,
  capped at 85%. Which outlet asks, and what the offer says, are hashes too.
  Nothing is drawn from the shared random stream.
- **What is saved** is only what was said yes to (`celebrities.work`: the year, and for each thing the
  outlet, pay, fame and mood it was worth when agreed). It stops a thing being done twice in a year and
  carries the pay to the year's settling. A record from an earlier year is ignored and replaced.
- **Saying yes** (`doFameWork`) records it, writes a line on the timeline, and brings the audience at
  once (a talk show and a guest part point a share of the audience at the biggest channel, ties broken
  by id). Nothing moves in the books yet: no money, no fame, no happiness.
- **Settling** is in the year (`runCreatorsYear`'s new `work` input): the pay is added to the year's
  creator income so it is taxed with it, a manager takes their cut of it like any creator money, and each
  thing is a `creator` row named for what it was and who it was for ("Photoshoot: Juniper Row
  magazine"). Its fame is added to the year's fame (with the events', clamped to 0–100) and its
  happiness to the year's.
- **Nothing is cut off when the channel is.** A person with fame and no channel left is still offered
  work and still paid.
- **Outlets are invented** (a clothing label, a coffee brand, a talk show), so no real company or person
  is named.

## What it is not

- **No screens.** `fameOffers(state)` lists what is on the table, `doFameWork(state, id)` says yes, and
  `workToSettle` is what the year pays. 0708 uses them.
- **No choice beyond yes or not now.** No haggling, no refusing for a better offer, no way to fail.
- **No time cost.** A week on a set costs the character nothing else that week.
- **No career.** Acting, modeling and music (v0.08) will have their own roles, agents and reputations;
  this is what a creator's name alone gets them.

## Files

- `content/src/fame-work.ts` (new, exported from `content/src/index.ts`): the four things, their
  outlets and every line.
- `simulation/src/fame-work.ts` (new, exported): offers, saying yes, what to settle.
- `simulation/src/celebrity-state.ts` (`FameWorkDone`, `FameWorkState`, `CelebrityState.work`),
  `simulation/src/creators.ts` (settling), `simulation/src/advance.ts` (passes `work`),
  `simulation/src/celebrity.ts` (a meeting kept losing the new field; fixed with a spread).
- Persistence v43: `save-schema.ts`, `migrations.ts` (migration 42 and `workOk`).
- `TICKET` is '0707' in `finance/src/summary.ts` and `tools/content-validator/validate.mjs`; the Social
  Media row on the Activities screen now points at 0708.

## Tests and sabotage

- 30 simulation tests (the constants and the pay table written out, who is offered what and at what
  rate, saying yes, settling through a real year, an heir, a meeting keeping the record), 6 content
  tests, persistence tests for the round trip, the v41 and v42 migrations, and 13 more malformed shapes.
- **Sabotage:** 84 deliberate breakages. 73 were caught the first time; 9 survived. Five were real gaps
  and each now has a test (a tie between channels broken by the wrong rule, a talk show for a tiny
  channel giving nobody, an old year's record carried into this one, the mood of a thing recorded as
  zero, and a ledger row's category; the last one was the harness changing the wrong line). Four cannot
  change behaviour: a `>` against `>=` on a draw, two hashes renamed (the outlet and the audience
  size), and an array check the next check makes redundant. Two more breakages did not match after
  Prettier reformatted the code, were re-pointed, and were caught.
- **A bug the work found before any test did:** 0705 rebuilt the record by hand when a stranger was
  answered, which would have wiped `work` the first time a famous stranger was answered. It now spreads
  the old record.

## Open (see roadmap findings 73–76)

The multiples, floors, levels and chances are judgements on sourced anchors. Work pays about 0.8 times
a channel's own income from fame 60 up, which is a lot and is not capped. There is no time cost and no
way to fail. 0708's screens read all of this.
