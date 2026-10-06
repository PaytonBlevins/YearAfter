# 0705 — The celebrity world

**Status: ENGINE DONE. No screens yet (v0.07 screens are not assigned).**
Save version 41 → 42: `celebrities` is a new required field on every save. A v41 save
migrates to nobody met. Heirs start with nobody met, like friends and channels.

## What it adds

1. **A world of fictional public figures**, in acting, music, athletics, creator media,
   business and politics. They break through, climb, hold, decline, retire, die, and are
   replaced by the next birth years. About 150–200 are known in any year, a few dozen of
   them household names (fame 60+) and a handful global stars (85+).
2. **A rare chance meeting, once a year at most.** Most lives meet somebody; some meet
   several. A big city, money, a following, a channel and a business each make it likelier
   (and make it likelier to be somebody from the matching field).
3. **The six things to do to a stranger** (spec 704): compliment, flirt, ask for an
   autograph, ask for a picture, insult, ignore. A good result can leave a real
   connection. Insulting somebody famous is sometimes filmed.
4. **The second menu for somebody you now know** (spec 705): catch up, compliment, get
   together, flirt, collaborate, a guest spot, a mention of your business. Warmth rises
   and falls with what you do; a year without contact cools it; at 60 they become an
   ordinary friend in the circle (context "through your fame"); when they die the
   connection ends and a friend in the circle is ended as dead.

## Measured first

There is no real-world data for how often ordinary people meet famous ones, so the
rates are a judgement, tuned against the spec's rarity order (celebrity encounters are
more common than viral breakthroughs). What was measured is the game's own side:

- **Roster:** 120–230 notable names in any year across 12 seeds and three eras; 8–50 at
  fame 60+; under 16 at 85+. No field is under 6% or over 35% of it.
- **Meetings:** over 70 lives lived to death, 1.7 meetings a life, 76% of lives had at
  least one (target 70–85%). Before the base was lowered from 0.028 to 0.022 it was 88%
  and 2.5 a life, which is not "uncommon".
- **Connections:** 0.27 a life, measured with every meeting answered by a compliment
  and nothing else. The other actions were not measured separately (finding 67).
- **Fame readers:** fame is low for almost every player, so what reads it rarely moves
  (finding 64). A dedicated video creator's 90th-percentile fame was 18 and none of 80
  reached the chart.

## Design

- **A figure is a pure function of `(seed, id)`** where an id is `field:birthYear:slot`
  (`celebrity-world.ts`). Nothing about the roster is saved. A figure's fame in a year is
  a pure function of the figure and the year: a smooth climb from 15% of their peak at
  breakthrough, a stay at the top, a slide to 60% by the end of a career, then a legend's
  fame that fades 6% a year. Peaks are `12 + 88·u^2.2`: a long tail of working names and
  a few superstars. Four in a hundred die young (28–55).
- **A meeting is derived, not saved** (`encounterFor`). A fixed draw for the year, the
  generation and the life decides whether one happens; a weighted pick decides who, by fame,
  by how near their field is to this life, and by whether they are still working (retired
  and dead-but-legendary figures count 0.4). Nobody already met or already known comes
  up again. The chance is `0.022 × hub × wealth × fame × network`, half before sixteen,
  nothing under ten, capped at 0.6.
- **What is saved** (`celebrities`): the connections (`ties`), the last sixty people met
  (`met`) and the year a stranger was last answered (`answeredYear`).
- **The scene** says why it was this person: a city, money, a following, a channel or a
  business, or just chance. It changes the line the player reads and nothing else.
- **Odds are never shown** (finding 29). A stranger's answer lands at the action's base
  chance, eased for how famous they are, helped by looks and charisma (±15 points) and by
  the player's own fame (up to +35). Autograph and picture are easy, flirt is hard.
- **Connecting.** A good answer makes a connection with a chance of its own, up to double
  for somebody with a name of their own. At most twelve are active at once.
- **The second menu.** Social things from the start; get-together, flirt, collaborate and
  the rest unlock at set warmth. Each can be done once a year. Flirting is refused to
  anyone under 18, more than 15 years apart, or taken, and goes through the ordinary
  friends list once they are a friend.
- **Professional things reuse 0704.** A joint piece brings what `collabGain` gives anybody
  of that following size (a repeat is worth half), through `Channel.collabs['c:<id>']`.
  A guest spot counts half the following and needs a talking show. A mention raises a
  business's reputation by `3 + fame/10`.
- **A year** (`runCelebrityYear`) cools an unpromoted connection 3 a year with no contact
  and ends it under 8; ends it when the person dies; and ends a promoted friend's circle
  entry as dead. It draws nothing at random.

## What it is not

- **No screens.** The engine exports everything a screen needs: `encounterFor`,
  `encounterMenu`, `answerEncounter`, `connectionRows`, `connectionMenu`,
  `doConnectionAction`. The Social Media row on the Activities screen now points at
  0706 so it cannot open early.
- **No directory.** Nobody can list everyone in the world (spec 1318); only people the
  player has met are visible.
- **No rank for figures.** The #1000→#1 ranks are for the player's own platforms and
  were built in 0701/0702.
- **No new events.** Fame and creator events are 0706.

## Files

- `content/src/celebrity.ts` — fields, the two menus, every line of text.
- `simulation/src/celebrity-world.ts` — who is famous, and when.
- `simulation/src/celebrity-state.ts` — the saved shape (a leaf, to avoid an import loop).
- `simulation/src/celebrity.ts` — meetings, answers, connections, the year.
- Wired through `game-state.ts`, `advance.ts` (after events), `continue.ts` (heirs start
  empty) and persistence v42 (`serialize`, `save-schema`, `migrations`).
- `social/src/people.ts` — `MeetingContext 'fame'`, `Acquaintance.celebrityId`.

## Tests and sabotage

- 103 simulation tests, 7 content tests, 3 persistence tests (round trip, v41 migration,
  malformed rejection with 18 bad shapes).
- **Sabotage:** 155 deliberate breakages of the new code. The first pass found 60
  survivors. Most were the lesson in 13.120 again (a number asserted against the constant
  that set it) and the rest were loops that pass when nothing happens; each now has a
  test that fails when it is broken. Three are equivalent mutants that cannot change behaviour (`<` against
  `<=` where the two sides are equal at the boundary, and a `connect > 0` guard that a
  zero chance already makes redundant). Everything else is caught.
- Bugs found by writing the tests: a celebrity friend who died was ended in the circle but
  still marked alive (fixed); persistence accepted `met: [3]` and `sex: 'robot'` (fixed).

## Open (see roadmap findings 64–68)

Fame is low so little reads it; no screens; a famous friend is still an ordinary friend,
can drift away like one and takes one of the circle's four seats; connection rate is low from compliments alone; a flirt with a
connection is refused until they are a friend and then belongs to the ordinary romance
rules, which have not been checked against a `'fame'`-context person.
