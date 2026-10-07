# 0806 — Music

**Status: DONE (engine).** No screens: they are 0809's. **Save change: v47 → v48.** Agent B's saves are now v49
and onward (`CLAIMS.md`). Six rungs from a local act to a superstar, all read off one number (monthly listeners);
releases a year inside the spec's caps; a back catalogue that keeps paying; labels that call or take a demo; tours;
collaborations; a manager or an agent; an award; and the Record Label business that 0602 left waiting.

Payton's answers (7 October 2026):

- **Core model:** releases and a catalogue. Yearly releases within the caps (2 albums, 3 EPs, 15 singles), quality from
  craft, a back catalogue that keeps paying, rungs from local to superstar.
- **Labels:** offered or submitted, **indie by default.** A self-release is always possible; a label can call, or you
  can send a demo. An advance and reach for a lower royalty after the advance is paid back. Accept / Ask for more /
  Pass. **Never required.**
- **Extras (all four):** tours, collaborations (0704's rules), awards (a fictional ceremony), and a manager or an
  agent (0704's: 15% and 10%, never both, never required).
- **Links (both):** the Record Label business row, and releases feed the existing Music creator channel. Streams pay at
  real per-stream rates (about $0.004, with the distributor's 15% off).

## What changed in the engine

A character gains a music life, `GameState.music`, which is empty until the character goes near a stage, takes
lessons, plans a release or is signed. **A life that does none of these replays exactly as it did before.**

### The six rungs

The rung is the number of people who play the artist's music in a month (listeners). Everything else on the row
follows from it.

| Rung | Name            | From (listeners) | Venues             | Room   | Ticket | Shows a tour | Night cost | Fame | Label calls | Major share | Award chance |
| ---- | --------------- | ---------------- | ------------------ | ------ | ------ | ------------ | ---------- | ---- | ----------- | ----------- | ------------ |
| 1    | Local act       | 0                | bars, coffeehouses | 100    | $10    | 8            | $250       | 0    | 0           | 0           | 0            |
| 2    | Club circuit    | 2,000            | clubs              | 300    | $18    | 20           | $1,000     | 2    | 12%         | 0           | 0            |
| 3    | Regional act    | 25,000           | theaters           | 1,200  | $35    | 24           | $8,000     | 8    | 18%         | 30%         | 0            |
| 4    | National act    | 300,000          | large theaters     | 3,000  | $55    | 28           | $45,000    | 22   | 22%         | 55%         | 10%          |
| 5    | Arena headliner | 3,000,000        | arenas             | 15,000 | $80    | 40           | $250,000   | 48   | 25%         | 80%         | 16%          |
| 6    | Superstar       | 25,000,000       | stadiums           | 50,000 | $140   | 60           | $1,500,000 | 78   | 25%         | 90%         | 22%          |

### Releases

A year has 52 weeks. A single takes 2, an EP 6 and an album 14. The caps are **15 singles, 3 EPs and 2 albums a
year**, and what a label has committed counts against them. The artist plans the year ahead (`planReleases`); the plan
is refused for a child under twelve, a count that is not a whole number, a cap, the weeks, or the money (a self-release
costs $300, $2,500 or $9,000 to record). Fewer is always allowed. In the year, the plan is run biggest first, a label's
own first (they are not the artist's to refuse), and anything that no longer fits the weeks or the bank is dropped
with a line.

**Quality** is the artist's craft, plus the label's polish (indie +3, major +6), plus a noise of ±12. **What a release
brings** is a share of people who find it (singles 120, EPs 350, albums 900, scaled by reach) plus a share of the
audience already there (4%, 8%, 15%), times a quality factor (0 at quality 35, 1 at 65, never more than 3), times 0.85
for each earlier release that year, times the room left under the ceiling (below). A viral release (a draw from a
base of 1.5% rising with quality over 70, only above 40) brings eight times as much and breaks the ceiling for the
year.

**The back catalogue** is the sum of what each release was worth (albums count six, EPs three, singles one). It is
what keeps the audience: each year **86% of the listeners stay, plus up to 10 more points** as the catalogue grows to 30,
**less 7 points in a year with nothing out and no tour.**

### The ceiling and one fixed luck

**What the work can hold is a ceiling** (`audienceCeiling`): ten to the power of 3.3, plus 0.05 for each point of quality
over 50, times a factor from one **luck draw fixed for the life** (ten to the 2.6 times luck cubed, less 0.3, so most
lives sit under it and a few far over), times the label's reach. Room falls to zero as the audience nears it; an
audience over it falls back a quarter of the excess a year; no audience passes 120 million. This is the whole
reason a life can end anywhere on the ladder (finding 125).

### Craft

`musicCraft` is 50 plus 2.2 times the distance of a weighted stat sum (discipline 0.3, charisma 0.3, smarts 0.25,
looks 0.15) from 72, plus 12 for the music talent. It drifts each year toward what the character is plus the work (a
tenth of a point per release, up to six points, and three for a stage), a lesson's four, up by a third of the gap and down by a
tenth, never past the ceiling (natural craft plus ten). Lessons from seven ($2,000 a year to an adult living away from
family, free for a child and for somebody at home, and the first thing to go in a tight year). **A school band, a choir
or a jazz band is a stage year** and counts as being in the music.

### Labels, a demo, a deal

- **A label calls.** Each year the chance is the rung's (12% at a club up to 25%), half as likely in a year with
  nothing new out, a third more with an agent, and **never** under craft 45, at the local rung, with nothing put out, or
  while signed or while a deal is on the table. The offer is a decision that holds time until it is answered.
- **A demo.** From twelve, once a year, with something out and craft 45 or over, and not while signed or with an offer
  waiting. One draw against 12% plus craft and a name, never under 3% or over 60%.
- **The deal.** An **indie** (2 years, 40% royalty, commits 2 singles and an EP a year) at any rung from a club up; a
  **major** (3 years, 18%, commits 3 singles and an album) from the regional rung, with the major's share of calls rising
  by rung. The advance sits in a table by rung (indie $3,000–$15,000 at a club up to $150,000–$500,000 at the top;
  major $30,000–$120,000 regional up to $2–8 million). **The advance and what the label spends on each release are repaid out of the
  royalty; whatever is still owed at the end of the term is forgiven.** The artist is paid the advance in the first
  year and the royalty share of the streams after that.
- **Answering.** **Sign / Ask for more / Pass.** Asking is once, won by a draw (45% plus a name and a representative,
  never over 90%): a win raises the advance 15–40% and the royalty three points (never past 50% indie or 25% major); a
  loss holds the terms and **never loses the offer.**

### Streams

A listener is 36 streams a year at **$0.004 a stream** (real: Spotify and others pay roughly $0.003–$0.005). Self-released
music pays that less the **distributor's 15%.** With a label, the royalty share of the gross repays the advance and the
label's costs first.

### The road

A tour is planned (`planTour`) from a rung and 300 listeners, at sixteen; it takes weeks of the year (a tour is a show
three times a week; at least four shows). A tour **loses money small and makes it big** (Lowery's 2016 figures: a small
act nets almost nothing after the venue, agent, manager and crew), runs in the year if the weeks are still there, and
a tenth of the people who bought tickets become listeners. Its size comes from the quality of the year's records, not
the craft alone. A loss goes to costs, **not off the pay.**

### A manager or an agent

0704's: a manager takes 15% of all music pay and speeds growth; an agent takes 10% of the tour door and the advance and
brings more calls; **never both, never required.** A musician at the club rung (2,000 listeners) can hire either.

### Collaborations, awards, fame, the channel

- **Collaborations** reuse 0704's rules with the artist as the channel; the listeners come over at once, a fee is a
  spending row, and repeats count for less.
- **Awards** (the fictional **Silverline Music Awards**) are for a record of quality 82 or more at the national rung or
  higher, to the best record of the year, worth eight points of a name and six of mood.
- **Fame** is held at the rung's level while the work is coming and goes after three years with none.
- **The Music creator channel** gets a quarter of the people who found the year's records, if the character has one.

### Music for a living

A year of $30,000 or more, lately, and the header says **Musician**, day-job offers stop, and the year it becomes a
living **a job they hold ends** with "Music is the living now. That was the end of the day job." (as playing and acting
do).

### The Record Label business

0602 left the Record Label for this ticket. It is now a row in the catalog (33 types); like the Talent Agency it
**does not yet sign the player's own deals.**

## Measured

40 lives per cell, played to 65 or death, every label's offer taken (the first answer). Policies, from fourteen: **light** is two
singles a year; **normal** is four singles and an EP, touring when it pays; **heavy** is eight singles, an EP and an
album, touring, with lessons from sixteen. "Living" is a year paying $30,000 or more at least once. Counts are at age 64, of
those who were alive.

| Who                    | Local | Club | Regional | National | Headliner | Superstar | Ever a living | Median lifetime pay | Top lifetime pay |
| ---------------------- | ----- | ---- | -------- | -------- | --------- | --------- | ------------- | ------------------- | ---------------- |
| No talent, light (38)  | 19    | 14   | 4        | 1        | 0         | 0         | 4 of 40       | $9.8k               | $1.5M            |
| No talent, normal (36) | 10    | 14   | 10       | 2        | 0         | 0         | 11 of 40      | $148k               | $13.4M           |
| No talent, heavy (37)  | 11    | 14   | 8        | 2        | 2         | 0         | 14 of 40      | $258k               | $22.3M           |
| Talent, light (37)     | 7     | 16   | 10       | 3        | 1         | 0         | 11 of 40      | $51k                | $17.0M           |
| Talent, normal (36)    | 1     | 12   | 15       | 7        | 1         | 0         | 25 of 40      | $993k               | $60.4M           |
| Talent, heavy (37)     | 1     | 11   | 15       | 7        | 2         | 1         | 27 of 40      | $1.49M              | $238M            |

Most music careers end in a club or a regional act, **a superstar is one life in forty** for a committed talent, and
a living from music is likelier than not only for the talented who commit. A talent is a help, not a gate: one life in
three with no talent and a heavy plan has a living year.

## Findings (roadmap 122–129)

122. **The ladder is a game ladder; only the money per stream and the cuts are real.** Real, as researched for this
     ticket: BLS musicians and singers 2025 median $47.80 an hour, 170,400 jobs, 48% self-employed; streaming pays roughly
     $0.003–$0.005 a stream; a distributor keeps about 15%; a major's royalty after the advance is paid back is 15–25%;
     a small act's tour nets almost nothing (Lowery). **Everything else is a game judgement:** the six thresholds, the
     venue sizes, ticket prices and night costs, the advances, the 36 streams a listener, the craft, the odds of a call,
     a demo or an award. Each is a named constant in `content/src/music.ts` and is pinned in the tests, so a change is a
     decision.
123. **The 86% retention and the catalogue are the whole of "old records keep paying".** Real reporting says most of the
     biggest earners' streams come from older records; the figure here is mine, and a life that stops releasing
     loses seven points a year on top of a ten-point swing from the catalogue.
124. **A superstar is rare, a living is not.** One life in forty with a talent and the heaviest plan reaches the top
     rung, but 25–27 of 40 talented lives that commit have a year of $30,000 or more. Real musicians' median is
     nearer part-time. If wanted lower, the dials are `MUSIC_LIVING_WAGE`, the ceiling, and `STREAM_PAYOUT`.
125. **The first model compounded and ran away.** Listeners found listeners, a lucky life reached a number that no longer
     fit in a safe integer, and a quarter of lives topped the ladder. The fix is **a ceiling set by quality and a single
     luck draw fixed for the life**, room that falls to zero as an audience nears it, and a fall back of a quarter of the
     excess a year. The dials are `AUDIENCE_BASE_LOG` (3.3), `AUDIENCE_PER_POINT` (0.05), `LUCK_SPREAD` (2.6),
     `LUCK_SHIFT` (−0.3), `VIRAL_CEILING` (5), `OVERSHOOT_FALL` (0.25) and `LISTENER_CAP` (120 million). CORE_RULES 13.155.
126. **A talent is not required.** One life in three with none and a heavy plan has a living year, and 12 of 37
     reach regional or better. If a talent should be a gate, raise `LABEL_MIN_CRAFT` or lower what craft can reach.
127. **Music for a living ends a day job,** as playing (0801) and acting (0805, finding 120) do, with the same
     header-versus-eulogy check.
128. **The Record Label is a catalog row only** (33 types), as the Talent Agency is: it does not sign the player's deal.
     `businesses.test.ts` moved from 32 to 33, and the four businesses for sale in 2030 changed (the second is now the `recordlabel`, not `autorepair`) because the catalog is hashed by its size, as in 0805 (finding 118).
129. **Save v48.** 0806 took it for `music`. Agent B's saves are v49 and onward; the brief, `CLAIMS.md` and `HANDOFF.md`
     say so. Awards use a fictional ceremony ("the Silverline Music Awards"), a deliberate choice.

## Files

- `content/src/music.ts` (new): `MUSIC_TIERS`, `MUSIC_TIER_ROWS` (the table above), the caps, weeks and costs of a
  release, quality, reach and the audience constants, `audienceCeiling`, `musicCraft`, `qualityFactor`, `LABEL_ROWS`,
  `LABEL_NAMES`, the bargaining and demo constants, the reputation and award constants, `musicFameOf`,
  `musicReputationWord`, `tourFor`, `RELEASE_TITLES` (40 fictional), `MUSIC_RISE_LINES`.
- `simulation/src/music-state.ts` (new): the saved types (`MusicState`, `LabelDeal`, `LabelOffer`, `MusicPlan`, `EMPTY_MUSIC`).
- `simulation/src/music.ts` (new): reading a musician, planning a year, lessons, labels (offers, a demo, answering),
  collaborations, `runMusicYear`, `nextMusicCraft`, `withMusicAudience`.
- `simulation/src/game-state.ts`, `advance.ts`, `offers.ts`, `decide.ts`, `network.ts`, `index.ts`: the field, the year
  (pay, tax, tours and recording as costs, lessons, leaving a day job, mood, records, fame, header, the creator channel),
  the day-job guard, the answer route, a manager or an agent for a club-sized act, and exports.
- `finance/src/representation.ts`: `whyNotRepresented(…, traction)`.
- `persistence`: save v48, migration 47 to 48 (an empty music life), validation of `music`, its deal, its offer and plan.
- `scripts/generate-businesses.py` and `content/data/businesses.json`: the Record Label (33 types).
- `finance/src/summary.ts`, `tools/content-validator/validate.mjs`: `TICKET = '0806'`. `apps/mobile/src/screens/shells.tsx`: the
  "Instruments" placeholder now names 0809, where the screens are.
- `simulation/src/music-0806.test.ts` (new) and `music-mood.test.ts` (new, one test); `persistence.test.ts` (new tests); the
  business tests updated.
- `specs/CORE_RULES.md` 13.154–13.157.

## Tests and sabotage

The music tests cover the six rungs and their real figures, a character's craft, quality and the audience a body of work can hold,
a tour, fame, planning a year (the caps, the weeks, the money, to the exact week and dollar), lessons, a year with nothing
in it and a year of first records, what streams and a label pay, the road, an award, craft over a year, a label calling, a
demo, a deal on the table, collaborations, a manager or an agent, the Music channel, music as a living, a musician
through the game (including that the draws take nothing from the random streams), and that a life that goes near none
of it replays unchanged. The save tests cover migration, a round trip and rejection of a bad music life.

**Sabotage:** 265 deliberate breakages. The first run killed 216 and left **49 survivors.** Five were lines nothing
could fail, and each was **deleted** (13.153): a one-part branch in the deal's wording that no label's row could reach,
a royalty cap that could never bind, a saved field nothing read (`seenAge`, 13.157), and two clauses of "involved in music"
that the craft clause already covered. The rest pointed at things not held: the age and cash edges of planning (sixteen,
eighteen, twelve, the exact dollar, the exact week), the order a label's releases come in, the hit and flop lines, a
middling release going viral, the award line and the rung it is judged at, a tour's size from the year's records, a loss
on the road leaving the pay alone, the ceiling's polish and reach, and four wires into `advanceYear` (the standard of
living, the deal tax, the lessons row, the creator channel). A fifth wire, a year's mood reaching the character's
spirits, could not be seen from a finished life at all (adjacent crafts ended at happiness 10, 22, 13, 21), so it has its
own test that swaps the music year for itself with a fixed mood (13.156). **The final run: 264 breakages, 264 killed, 0
survivors, 0 unmatched.**

## Open

Payton may want to move: how common a living is (124), a talent not being a gate (126), the Record Label doing nothing
with the player's own deal (128), and the ladder's numbers (122) and ceiling (125), which are mine. Next is 0807; 0809
is the screens. Neither is started.
