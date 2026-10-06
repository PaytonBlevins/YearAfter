# 0801 — The sports engine, with basketball

**Status: DONE (engine).** No screens: they are 0809's (Payton chose "engine now, screens in 0809").
Save version 43 → 44: `sports`. A v43 save migrates to no sporting life.

Until now a school team was the end of the road. Measured on 240 passive lives before this ticket, 22 had
athletics talent and none of them could be recruited, drafted, signed or paid. This builds the missing ladder,
once, for any sport: a sport is a row in `content/src/sports.ts`, and basketball is the first.

## The ladder

```
school team → a scholarship offer when you graduate → college seasons → the draft
→ a contract (Accept / Ask for more / Turn it down) → pro seasons → retirement
```

| Rung             | What happens                                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| School team      | The existing 0206b team (`act.basketball`). The year it is played, seasons and hard-working seasons are counted (a season counts when two or three of the year's three practice sessions went in).                                                                              |
| Graduating       | If they were on the team in their last year, a draw decides whether a college wants them. If one does, the game asks (a pending decision, `sports.offer`): a full or partial scholarship, a team, and a degree chosen for them. Time does not pass until it is answered.        |
| College          | Taking it enrols them (no admission roll), puts them on the college team and pays the scholarship's share of tuition each year. A season a year, a chance of injury, and a hidden `form`.                                                                                       |
| The draft        | When college ends (graduating or leaving), a second draw decides whether anyone picks them. If so, the career's whole shape is fixed then: its best tier, how many seasons until it gets there, the age it ends at, and the pick. If not, it ends and is kept as a past career. |
| A first contract | Accept / Ask for more (once; it may or may not come up) / Turn it down (ends it). Signing ends any job they held: a first contract is a full-time one.                                                                                                                          |
| Pro seasons      | A tier (fringe, role player, starter, star, superstar), a year's pay, a chance of injury (minor, a lost season, or the end), a chance of a title, a reputation, and fame. A rookie is a step below the peak until the breakout. Near the end, a step down again.                |
| Renewal          | When a contract runs out: Sign it / Ask for more / Test free agency. Free agency signs with another team at about the same money for a role player or better, and ends a fringe player's career if they walk.                                                                   |
| Retirement       | At the age set at the draft, or an injury that ends it sooner. Kept as a `PastCareer` (the rung reached, best tier, seasons, titles, reputation, how it ended) for coaching and commentary access in 0804. Fame fades as it does for anyone.                                    |

## The odds

Payton's numbers, as he gave them (6 October 2026), among players on their teams. "Get in" means reach the
pros, after college.

| Who                          | Reach the pros | Become a star (of those who do) |
| ---------------------------- | -------------- | ------------------------------- |
| Natural talent and hard work | 95%            | 45%                             |
| Talent, no hard work         | 75%            | 20%                             |
| No talent, hard work         | 60%            | 10%                             |
| No talent and no hard work   | about 3%       | **0.5% (nobody gave this)**     |

The two filters are sized to multiply back to the table: recruited = reach<sup>0.4</sup>, drafted = reach<sup>0.6</sup>
(the draft is the harder door). A star is one in four a superstar. Everything else about the career follows
from the best tier the draft fixes.

**Hard work** is a thing the player does: a season counts when at least two of the year's three practice
sessions went in (the 0206b button at school, `trainSport` in college and the pros), and someone is a hard
worker when half their seasons count and at least one does.

### Measured

Lives that try out for the team each year from twelve; "on the team" is being on it at seventeen. 1,500 lives
(124 with athletics talent), then separate runs of 1,600 lives with other seeds that agree.

| Who (on the team at 17)  | Asked for | Reached the draft and a contract                          | Of those, stars or superstars                                |
| ------------------------ | --------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Talent, works hard       | 95%       | 112 of 119 = **94%**                                      | 123 of 885 pros overall: 13.9% (14.4% expected from the mix) |
| Talent, does not work    | 75%       | 84 of 116 = **72%** (179 of 254 = 70.5% over two samples) | 22 of 126: 17.5%                                             |
| No talent, works hard    | 60%       | 773 of 1,304 = **59%**                                    |                                                              |
| No talent, does not work | about 3%  | 42 of 1,294 = **3.2%**                                    |                                                              |

**A life that only presses Advance** (2,000 lives, played to 45): 180 with talent, **26 ever on a basketball
team (1.3%)**, 10 recruited, 5 drafted, **5 went pro (0.25%)**. **This is the honest result of the odds above:
they make going pro common for someone who makes the team, and the gate is the team.** My own rough
estimate before building, 6%, was wrong by a factor of twenty (CORE_RULES 13.134). Real life, for comparison,
is about 0.04% from high school.

**What a career is** (lives that worked hard; the `bestTier` of every pro career):

| Best tier   | Pros (of 883) | Median pro seasons | Median pay over the career | Median fame | Median titles | Ended by injury |
| ----------- | ------------- | ------------------ | -------------------------- | ----------- | ------------- | --------------- |
| Fringe      | 271           | 6                  | $7.7 million               | 4           | 0             | 8               |
| Role player | 289           | 8                  | $21.9 million              | 10          | 0             | 13              |
| Starter     | 200           | 10                 | $88 million                | 24          | 0             | 7               |
| Star        | 88            | 12                 | $266 million               | 56          | 1             | 2               |
| Superstar   | 35            | 14                 | $627 million               | 88          | 2             | 2               |

Pay is gross over the whole career; tax came to 41.6% of it. Real league minimums anchor the floor (NBA rookie
minimum $1,272,870 for 2025-26; the game's fringe tier is $1.3 million) and the top is uncapped by design
(spec 949). Real careers last about four and a half seasons; the game's are longer, which is the same
"better than real life" dial as the odds.

**What it does to fame** (500 lives that went through the school team, playing to 50): in 2,381 pro years,
0.91 fame offers (0707) a year were on the table, and 47% of pro years had at least one; in 16,389 non-pro
years there were none. The yearly chance of meeting a famous stranger (0705) was 9.3% in a pro year against
1.5% otherwise. How many were actually met is not measured: the harness never answers a meeting, so the
count is zero everywhere. Among all lives, anyone with any fame went from 0 of 240 to 5 of 2,000, so the
effect on the passive population is negligible and on a pro is large, which is the intended result.

## Design

- **Every draw is a hash, not a stream.** `sportUnit(seed, generation, name…)` is a hash of the seed, the
  generation and a name (recruit, draft, star, rank, pick, breakout, retire, and per year: injury, severity,
  title). Nothing is drawn from the shared random stream, so a life that never plays a sport replays exactly
  as it did before this ticket, and a life that does plays the same career every time.
- **Saved state** (`sports`, always present from v44): `career?` (stage, seasons, hard seasons, hidden form,
  training this year, reputation, titles, and the college or pro fields), `past[]`, and `offer?` (the
  scholarship or contract the game is asking about, frozen when raised). Skills are not saved; they are
  derived from `form` and shown only while playing (spec 9 and 343).
- **Where it runs.** `runSportsYear` runs straight after school in `advanceYear`. It reads the state the year
  _started_ in (graduation clears the school team, CORE_RULES 13.135) and the school year's result. Its pay and
  tax are settled with the creator income.
- **Money.** A contract is `salary` in the ledger ("Playing for the Harbor City Gulls"), so every place that
  reads earned income already counts it. The tax is `businessTaxOn` on top of everything else earned that year,
  "Tax on playing pay" (finding 86).
- **Aid.** A scholarship is `aid` in dollars a year on the career. `collegeSupportOf` adds it (so the
  affordability gate sees it) and `runEducation` adds it to the parents' support (so the year's bill sees it).
  A scholarship the player cannot take up for want of the rest is made up by the program.
- **Fame.** A pro's fame is held at its tier (4, 10, 24, 52, 84), plus 4 a title up to 15; `fame` is the higher of
  that and the creator figure. When the career ends it fades as any fame does.
- **The header** says "Professional basketball player" while a pro, ahead of any job.
- **Doors.** The question is raised by `withSportsOffer`, innermost of the systemic doors; `hasSystemicOffer`
  reads `sports.offer`, so no other offer is raised behind it. No job is offered to a pro.
- **An heir starts with none of it.** `createGameState` defaults to `EMPTY_SPORTS` and `continue.ts` does not
  pass any.

## What it is not

- **No screens.** `skillsOf`, `careerOf`, `careerLabel`, `reputationOf`, `trainSport` and the pending question
  are what 0809 reads.
- **No other sport.** Football, baseball, soccer and hockey are 0802: a row of data each, with its own road in.
- **No coaches, teammates or trades.** The team is a name. Spec 1305–1309's relationships are not built.
- **No salary cap, minor league or overseas route.** An undrafted player's career ends.
- **No early declaration.** The draft draw happens when college ends, however it ends. Leaving a degree early is
  the only way to go early, and the game does not say so (finding 88).
- **Nothing reads the past careers yet.** Coaching and commentary access is 0804.

## Files

- `content/src/sports.ts` (new, exported): the sport, its teams and skills, the odds table, the tiers, pay,
  fame, injury, title and retirement tables, and the pure helpers (`categoryOf`, `peakTierFor`, `draftPickFor`).
- `simulation/src/sports-state.ts` (new, exported): the saved types, with no imports.
- `simulation/src/sports.ts` (new, exported): the year, the scholarship and the draft, training, the question,
  its answer, and the reads.
- `simulation/src/game-state.ts` (`sports`, `hasSystemicOffer`), `advance.ts` (the phase, the tax, the pay,
  fame, the header, records, the door), `decide.ts` (routing), `college.ts` and `phases/education.ts` (aid),
  `offers.ts` (no job offers for a pro).
- Persistence v44: `save-schema.ts`, `serialize.ts`, `migrations.ts` (migration 43 and `sportsOk`).
- `TICKET` is '0801' in `finance/src/summary.ts` and `tools/content-validator/validate.mjs`. The Activities
  shells now point Acting Lessons at 0805, Martial Arts at 0803 and Instruments at 0806, the numbers
  v0.08's breakdown gives them.

## Tests and sabotage

- 50 simulation tests (`sports.test.ts`): the arithmetic of the odds (the filters multiply back to the table, the
  table itself, categories, hard work, stars and superstars, rookie pay, tiers), a life with no team, the school
  team's tracking and the one-session case, the scholarship question and its answers (accept, decline, an answer
  that is not a choice), aid through the real year and through the affordability gate, a partial scholarship the
  program makes up, the draft, a first contract (accept, ask once, turn down, ending a job), pay and tax in the
  ledger, fame, the header, no job offers, skills only while playing, training three a year, renewal, free
  agency, a fringe player finding nobody, retirement, titles on the record, injury and title rates in a
  season and in college, no title in a lost season, form after thirty, the same career every time, and the odds
  through the game for players who work and players who do not.
- 4 persistence tests: v43 opens with no sporting life and keeps the rest, a career already there is kept, a
  round trip of a career with a contract on the table and a past career, and fourteen malformed shapes.
- **Sabotage:** 46 deliberate breakages. 38 were caught the first time; 8 survived, and each pointed at a fixture
  that could not reach the line (13.137): a partial scholarship the parents happened to cover, 400 seasons with
  no injured title, a career with no title, a control life never offered a job, a lenient assertion on how a
  career ended, nothing pinning age after thirty, nothing pinning a title's fame, and nothing for a school
  career lapsing. Each has a test now and all 46 are caught.
- **A bug found by reading a printed life, not by any test:** a player who had taken a job in college signed a
  contract and kept drawing both salaries (13.138). Signing now ends the job.
- The Mobile typecheck, the app's tests and the content validator are part of `pnpm verify`.

## Open (see roadmap findings 83–89)

Going pro is common for anyone on the team and the gate is the team (83). The star share for a player with no
talent who does not work is 0.5% because it was not given (84). The pay ladder, career lengths, injury and title
rates, the hard-work threshold, the scholarship cut-off and the 0.4/0.6 split are judgements (85). Pay is taxed
at the business rate, which is slightly high at the top (86). The Career screen can still hire a pro (87).
