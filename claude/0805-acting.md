# 0805 — Acting

**Status: DONE (engine).** No screens: they are 0809's. **Save change: v46 → v47.** Agent B's saves are now v48
and onward (`CLAIMS.md`). Six rungs of acting work from student films to prestige pictures, three ways in (be seen, apply,
an agent) of which none is required, lessons and character development, a negotiation, awards, fame, and the Talent
Agency business that 0602 left out.

Payton's answers (7 October 2026):

- **The road in:** lessons, community and school theatre; a director can offer a part, or you can apply to castings
  and auditions yourself. An agent is a help, **not a requirement**.
- **Parts:** about six rungs (the spec's eleven, folded together). Clear whether a part is **offered** or **applied
  for**, and whether it is a **lead, a supporting part or a bit part**. A few offers a year, more at a higher standing.
- **Pay:** real day rates, with fame from the work.
- **Extras (all four):** an agent that reuses 0704's idea, negotiation (Accept / Ask for more / Pass), awards, the
  Talent Agency business.

## What changed in the engine

A character gains an acting life, `GameState.acting`, which is empty until the character goes near a stage, takes
lessons, applies for a part or is offered one. A life that does none of these replays exactly as it did before.

### The six rungs

| Rung | Work                                | From age | Credits | Craft | Name | Fee range (per lead part) | Fame |
| ---- | ----------------------------------- | -------- | ------- | ----- | ---- | ------------------------- | ---- |
| 1    | Student films and community stage   | 11       | 0       | 0     | 0    | $0–$600                   | 0    |
| 2    | Commercials and background work     | 16       | 0       | 35    | 0    | $1,283–$12,000            | 3    |
| 3    | Bit parts and small TV              | 18       | 3       | 45    | 0    | $2,566–$21,000            | 8    |
| 4    | Supporting roles in TV and film     | 20       | 10      | 58    | 10   | $20,000–$150,000          | 20   |
| 5    | Leading roles                       | 22       | 25      | 72    | 30   | $150,000–$2,000,000       | 42   |
| 6    | Prestige and franchise films        | 25       | 50      | 84    | 55   | $2,000,000–$25,000,000    | 70   |

Every part is also a **lead, a supporting part or a bit part**, and that decides what it pays (a lead's fee, 55% of it
for a supporting part, 25% for a bit part) and how long it takes (110, 40 or 5 days on set; small work is a fraction).
A year has 180 days to give, so no actor shoots three leads in one. Each rung has its own mix: bit parts are the
work of rung 3 (70%), and rungs 5 and 6 are leads and supporting parts only.

### Being seen, applying, an agent

- **Being seen.** Years in a drama club or a community theatre, acting lessons, a part worked, or an agent put an
  actor in front of directors for four years after the last of them. A seen actor is offered a few parts a year: each
  rung has two or three slots (a good name raises them from 0.6x to 1.2x, a talent 1.25x, an agent 1.3x plus an extra
  slot, age from 55 thins them to a floor of 0.3x). At most four offers wait at a time, and the year's days limit them.
  An offer is at the actor's rung or one either side, and a rung above only if the actor is ready for it.
- **Applying.** Six casting calls a year, the same each time they are read, at the actor's rung and one either side.
  Each shows the part (lead / supporting / bit), the medium, the fee, the days and **the odds**. The actor may send
  in two applications a year (four with an agent). An application is **Offer or Denied** by one draw (spec 279), and
  an offer goes onto the table like any other. No agent, stage or lessons needed.
- **An agent.** Wants two credits and the second rung before anybody signs. Takes ten percent of every fee (0704's
  figure) and adds a slot, a better chance on an application, a better chance to bargain, and two applications.
  The agent is a **separate** acting agent, not the creator representation. Left at any time.

### Lessons and character development

Lessons from ten ($1,800 a year to an adult living away from family, free for a child, and the first thing to go in a
tight year) lift what craft can reach by four. Character development (spec 274) is three sessions a year from twelve,
each a smaller gain, never past the ceiling (natural craft plus ten). **Health and stress are not inputs** (spec 280).

### Craft

`naturalCraft` is 50 plus 2.2 times the distance of a weighted stat sum (charisma 0.4, looks 0.2, smarts 0.15,
discipline 0.25) from 72, plus 12 for the acting talent. It drifts each year toward what the character is plus the
work, a stage and lessons (up by a third of the gap, down by a tenth).

### A part, answered

The offer is a question: **Take the part / Ask for more / Pass.** The prompt says whether it is an offer or a part the
actor got by applying, what it is (a lead, supporting part or bit part, in what, with its title), what it pays and
how many days. **Ask for more** appears for $5,000 and over, once per part; it is won by a draw that a name and an
agent help, and a win raises the fee 10–25%; a loss holds it and **never loses the part.** Accepting books it for the year
to come.

### A year of work

Each booked part is shot, judged and paid in the year it is for. The actor's craft against the rung's hit line, with
noise, makes a hit, an "it came and went", or a flop (reviews that aren't kind). Pay is the whole fee less the agent's
tenth. A hit adds a name and mood, a flop takes some of each. A first part is a record. Enough hits at the rung (two, two, three,
three, five) or a hit on a part a rung up, and the actor is ready for it, rises. Three years with no part drops a rung.
Awards (the fictional Marquee Awards) are from the supporting rung up, for work good enough to be noticed. Fame is
held at the rung's level while the work is coming and halved in a quiet year.

A supporting actor or better who has worked lately has **"Actor"** as their header, stops being offered day jobs
(`offers.ts`), and in the year they become one **leaves a day job they hold** (`advance.ts`). Pay goes to the ledger as salary ("Acting work") and is taxed ("Tax on acting pay"); lessons are
spending.

### The Talent Agency business

0602 deferred the Talent Agency to acting. It is now a row in the business catalog (`biz.talentagency`, Professional):
$80,000 to open, about $600,000 a year at maturity on a 14% margin, four staff. **It is a catalog row only**: it does not
yet represent the player's own acting clients, or manage clients that rise and fall. The catalog now has 32 types, and
four tests pinned to the old count or the old hash picks were updated (finding 118).

## Measured

120 lives per cell (150 for the last row), played to 70 or death, every offer taken. "Acted" is any credit. "Lead+" is
having reached the lead or star rung; "star" is the sixth rung. Pay is career acting pay, before tax, median of those who
acted. "Passive" is a life that **took the first answer to every question**, so a child who is offered a drama club joins it.

| Who                                         | Acted | Working+ | Supporting+ | Lead+ | Star | Award | Median credits | Median pay |
| ------------------------------------------- | ----- | -------- | ----------- | ----- | ---- | ----- | -------------- | ---------- |
| Passive, first answers (150)                | 21%   | 11%      | 8%          | 5%    | 0%   | 3%    | 8              | $13k       |
| Talent, school and community stage only     | 100%  | 92%      | 86%         | 49%   | 10%  | 38%   | 75             | $2.9M      |
| Talent, applies only                        | 98%   | 92%      | 82%         | 32%   | 4%   | 25%   | 148            | $4.4M      |
| Talent, stage, lessons, applies, agent      | 100%  | 98%      | 94%         | 67%   | 28%  | 56%   | 204            | $46.8M     |
| Talent, stage, lessons, applies, no agent   | 99%   | 99%      | 98%         | 74%   | 23%  | 59%   | 152            | $44.0M     |
| No talent, stage only                       | 100%  | 59%      | 46%         | 18%   | 1%   | 11%   | 34             | $92k       |
| No talent, applies only                     | 98%   | 63%      | 44%         | 12%   | 1%   | 10%   | 104            | $284k      |
| No talent, stage, lessons, applies, agent   | 99%   | 96%      | 84%         | 31%   | 3%   | 26%   | 238            | $5.9M      |

Of the passive lives that reached lead, the first credit came at 21, 27, 30, 38, 39, 48 and 49: late entrants are
real (finding 116). The agent column is the proof that **an agent is not required**: without one, the committed talented
actor reaches lead or better more often (74% against 67%), because the agent's tenth is a cost and its slot is a help that the
actor does without by applying more. A character with no talent and no work of any kind does not act.

## Findings (roadmap 114–121)

114. **The ladder above the SAG floor is a game ladder.** Real: SAG-AFTRA's day rate $1,283 and weekly $4,456 (2026–27,
     already used in 0707), BLS actors 2025 median $29.05 an hour, 67,500 jobs, part-time common, 23% self-employed.
     The fees above the first two rungs, the sponsorship-like top, and the six ranges are mine. The dials are the
     `fee` ranges in `ACTING_TIER_ROWS`.
115. **Stars are far too common for real life and about right for a game that rewards a talent and a lot of work.** The
     talented and committed reach the sixth rung in 23–28% of lives; median career pay is $44–47M, the top tenth over
     $430M. Real stars are a handful in thousands. If that is wrong for the game, raise `minCraft` or `HITS_TO_RISE.lead`
     (5), or lower the star slots.
116. **There is no upper age on rising, only on offers (a slow thinning from 55).** A first-timer of 48 reached lead
     in a passive life. If that is wrong, the dial is `minAge` per rung or a ceiling on `AGEING_FLOOR`.
117. **Passive lives now sometimes become actors.** 21% of lives that take first answers get some credit: school
     drama and community theatre are offered like any activity, and a seen actor is offered parts that the first
     answer ("Take the part") accepts. This is the opposite of "acting is something you choose". If wanted
     otherwise, the offers need a gate on a deliberate step.
118. **The Talent Agency is a catalog row only.** It moved 0602's deferral off the list and changed two pinned
     expectations: the count (31 to 32) and the four businesses for sale in 2030 (one is now `autorepair`, not
     `electronics`) because the catalog is hashed by its size. It does not represent the player's own acting clients.
119. **Taking every offer makes the credit count long.** Median 150–240 credits over a career for the committed. Nothing
     limits a year but its 180 days. The dial is the number of slots and `MAX_OFFERS` (4).
120. **Acting for a living ends a day job, as playing does.** The year an actor reaches the supporting rung with work
     behind them, a job they hold is ended with a milestone line ("That was the end of the day job"), the header says
     Actor, and day-job offers stop. `pnpm verify` found this: the first version left the job, and the header said
     "Actor" while the death screen said "Care aide" (0212's header-versus-eulogy bug again).
121. **Save v47.** 0805 took it for `acting`. Agent B's saves are v48 and onward; the brief, `CLAIMS.md`
     and `HANDOFF.md` say so. Awards use a fictional ceremony ("the Marquee Awards"), a deliberate choice.

## Files

- `content/src/acting.ts` (new): `ACTING_TIERS`, `ACTING_TIER_ROWS` (the table above), `BILLINGS`, `SAG_DAY_RATE`,
  `SAG_WEEK_RATE`, `naturalCraft`, `roleFee`, `roleDays`, `billingFor`, `ROLE_TITLES` (30 fictional), the offer, apply,
  agent, bargaining, year, ageing and award constants, `actingFameOf`, `TIER_RISE_LINES`, `actingReputationWord`.
- `simulation/src/acting-state.ts` (new): the saved types (`Role`, `BookedRole`, `ActingState`, `EMPTY_ACTING`).
- `simulation/src/acting.ts` (new): reading a life (`craftOf`, `isSeen`, `notReadyFor`, `freeDays`), the offers a year
  raises (`offerSlots`, `slotScale`, `tierDrawn`), the casting calls and `applyForCasting`, lessons, development and an
  agent, the offer as a question and its answers, `runActingYear`, `nextCraft`.
- `simulation/src/game-state.ts`, `advance.ts`, `offers.ts`, `decide.ts`, `index.ts`: the field, the year (pay, tax, lessons, leaving a day job,
  mood, records, fame, header), the day-job guard, the answer route and exports.
- `persistence`: save v47, migration 46 to 47 (an empty acting life), validation of `acting`, its parts and its offers.
- `scripts/generate-businesses.py` and `content/data/businesses.json`: the Talent Agency (32 types).
- `finance/src/summary.ts`, `tools/content-validator/validate.mjs`: `TICKET = '0805'`. `apps/mobile/src/screens/shells.tsx`: the
  "Acting Lessons" placeholder now names 0809, where the screens are.
- `simulation/src/acting-0805.test.ts` (new, 134 tests); `persistence.test.ts` (4 new); the business tests and one pinned list updated.
- `specs/CORE_RULES.md` 13.150–13.153.

## Tests and sabotage

134 acting tests: the six rungs and their real anchors, a part's fee, days and billing, craft from a character (and that
health and stress do not matter), fame, being seen, readiness, the offers a year raises (shape, reach, the cap of four,
the days, no repeated title, nothing from the random streams), the casting calls and the odds (clamped, ready-for, the
two a year), lessons, development, an agent, answering and bargaining an offer, a year of work (pay with the agent's
share, hits and flops, tier rises and falls, awards), a living, an acting life through the game (including that acting for a living ends a day job), and that a life that goes
near none of it replays unchanged. The save tests cover migration, a round trip and rejection of a bad acting life.

**Sabotage:** 94 deliberate breakages. The first run killed 66, left **27 survivors** and 1 that did not match. Three of
the survivors were lines nothing could fail (the award rung check that the zero chance already did, a craft cap that is
always under the headroom, an application list cleared and kept at the same age); each was **deleted** (13.153). The
others pointed at things not held: the agent's multiplier and slot, the cap of four offers, the title repeat, the clamp
on the odds, the bargaining decay, the flop's cost to a name, which hits count toward a rise, and the three-year fall. A bigger
finding was that the test helper `adult()` was silently returning a child who had died at twelve (13.152). All of those
now have tests, and the helper fails when it cannot build a living adult. **The final run: 89 killed, 3 unmatched
(their lines were deleted), 0 survivors.**

## Open

Payton may want to move: stars being this common for the committed (115), late first careers (116), passive lives
turning into actors (117), long credit counts (119), and the Talent Agency doing nothing with the player's acting (118).
Next is 0806 (Music); 0809 is the screens. Neither is started.
