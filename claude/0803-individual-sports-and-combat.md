# 0803 — Individual sports and combat

**Status: DONE (engine).** No screens: they are 0809's. **Save change: v44 → v45.** Agent B's saves are now
v46 and onward (`CLAIMS.md`). Golf and tennis are a tour, boxing and MMA are a fight card, and the road to a
fight card runs through six martial arts studied from ten.

Payton's answers (7 October 2026):

- **Golf and tennis** share the team sports' ladder (school team, scholarship, college), then the pro step is a
  tour card instead of a draft.
- **Boxing and MMA** come from training a martial art in Mind & Body. Training may start at about ten; turning
  pro is at eighteen.
- **Six arts:** boxing, Muay Thai, Brazilian jiu-jitsu, wrestling, karate, taekwondo. No judo.
- **Wrestling** is only an art here. An Olympic wrestling career is 0804.
- **Fights are decided by skill**, not a minigame: a ranked tour rather than a roster, with purses.

## What changed in the engine

A sport now has a `format`: `team` (0801/0802, untouched), `tour` (golf, tennis) or `combat` (boxing, MMA).

|                | Team                                 | Tour                                             | Combat                                                             |
| -------------- | ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------ |
| Road in        | School team, scholarship, draft      | School team, scholarship, college, **tour card** | Study an art from ten, three seasons, **a gym puts you on a card** |
| Question asked | Contract: Accept / Ask for more / No | Take the card / Turn it down (no ask-for-more)   | Turn pro / Not now                                                 |
| Pro life       | Team, contract, peak, end age        | No team, no contract, no peak, no end age        | A gym, a record, no contract, no peak                              |
| A year         | Tier moves on a drawn breakout       | Tier moves on a year's results                   | Tier moves on a season of fights                                   |
| Pay            | Salary                               | Prize money (ledger: "Prize money, <league>")    | Fight purses (ledger: "Fight purses, <league>")                    |
| Ends           | Retired, injury, declined, unsigned  | Retired, injury, **lost the card**               | Retired, injury, **released**                                      |

### The fights

A fighter fights `FIGHTS_PER_YEAR[sport][tier]` times a year (boxing 4, 3, 3, 2, 2 from fringe to superstar; MMA 2, 2, 3, 3, 2). Each fight is a hash draw against
`fightWinChance(form, tier, opponent)`: a logistic on form minus an opponent drawn from the field at that tier
(±8), `FIGHT_SCALE` 9. Nothing touches a random stream. The year's **performance** is form plus
`FIGHT_LUCK` (10) times (wins − expected wins), so luck moves a fighter up or down a rung and form does the rest.
The tier follows performance one rung a year (`tierForPerformance`), against fields of 42, 53, 64, 78 and 92.
A fringe fighter well below the fringe field (`OUT_MARGIN` 9) after the first pro season is **released**.
Moving up into star or superstar on a card is a **belt** (a title, a record line, 25% on the purse).
A tour year is the same shape with no fights: performance is form plus a hash draw of ±12 (`TOUR_NOISE` 24),
`TOUR_TITLE_CHANCE` by tier for an event win, and a lost card where a fighter would be released.

### The arts

Six `MARTIAL_ARTS` rows, each with a style (striking or grappling), an annual cost and its source, four skills
and a start and stop line. Rules (`sports-individual.ts`):

- From age ten (`MARTIAL_ART_MIN_AGE`), at most two at once, three sessions a year, each worth a little less.
- A level starts at 20 and drifts each year toward what the character is (`naturalForm`), up faster than down,
  and wears 1.2 a year after forty.
- **Work alone cannot take a level past what the character is plus 7** (`TRAINING_CAP`). Without it the school
  scale let a hard worker reach 100 (CORE_RULES 13.142).
- Three seasons in an art is what a gym needs to see (`MIN_ART_SEASONS`), and the game says so on the third year.
- **Boxing** is boxing studied; **MMA** needs a striking art and a grappling art and starts at their average;
  a tie goes to MMA. Any single art but boxing leads nowhere on its own: MMA needs a striking and a grappling art (finding 105).
- Dues: an adult not living with family pays `annualCost`, posted as spending; a tight year drops the art and
  says so. Children and adults still at home are not billed.
- Readable only while studied (spec 9 and 343): stopping an art takes the level and its skills with it.

| Art       | Style     | Dues a year | Source of the cost                      |
| --------- | --------- | ----------- | --------------------------------------- |
| Boxing    | striking  | $900        | gym dues and hand wraps                 |
| Muay Thai | striking  | $1,300      | Muay Thai gym dues and shin guards      |
| BJJ       | grappling | $1,500      | jiu-jitsu academy dues and a gi         |
| Wrestling | grappling | $500        | a wrestling club and shoes              |
| Karate    | striking  | $1,100      | dojo dues and a uniform                 |
| Taekwondo | striking  | $1,100      | taekwondo school dues and sparring gear |

### Turning pro

Checked every year from eighteen to thirty while there is no career and no question open (`turnProOffer`). **One
hash draw per life** against `REACH_PROS[category]` (95 / 75 / 60 / 3, Payton's table), and the category rises
with hard work under the same draw, so a late bloomer is real and re-rolling is not (CORE_RULES 13.145). Accepting
puts the fighter at stage `pro`, tier `fringe`, 0–0, with the base arts gone and the day job resigned only if the
career is full-time (it is not, at the bottom of a card). The question is asked once per sport; turning it down
is the answer.

### The money and the years

Sources are real purses and prize money (PGA Tour, ATP/WTA, boxing and UFC pay); the ladder is a game ladder
above a real floor, as in 0801.

| Sport  | League                     | Fringe | Role  | Starter | Star  | Superstar | Career ends at (fringe → superstar) | Injuries |
| ------ | -------------------------- | ------ | ----- | ------- | ----- | --------- | ----------------------------------- | -------- |
| Golf   | Continental Golf Tour      | $450k  | $1.3m | $3.2m   | $9m   | $30m      | 29–34 → 40–50                       | ×0.5     |
| Tennis | World Tennis Circuit       | $120k  | $450k | $1.6m   | $6m   | $19m      | 24–28 → 31–37                       | ×1.0     |
| Boxing | Atlantic Boxing Federation | $20k   | $90k  | $400k   | $3m   | $30m      | 28–33 → 34–40                       | ×1.5     |
| MMA    | Ironcage Fighting League   | $30k   | $110k | $350k   | $1.6m | $8m       | 27–32 → 32–38                       | ×1.6     |

Pay each year is the tier's figure times a spread of 0.75–1.25, plus 25% for a title or a belt, and a quarter of
it if a serious injury cost the season. Prize money and purses are gross: travel, coach and caddie are not
modelled (finding 101). Full-time is from `fringe` for a tour and `role` for a card (`isFullTime`): below it the
day job stays and job offers keep coming. Fictional leagues and twelve fictional gyms; no real league's letters.
Golf and tennis decline from 38 and 29, boxing and MMA from 31 (`declineFrom`).

## Measured

150 lives per cell, played to the end of the career, the arts or the sport worked at every year for "work", the
talent flag set by the test. "Pro" is reaching the pro stage (taking the card); "star+" is stars and
superstars **of those who reached the pros**.

| Sport  | Who             | Pro | Star+ of pros | Superstar | Median pro seasons | Median career pay | Median record |
| ------ | --------------- | --- | ------------- | --------- | ------------------ | ----------------- | ------------- |
| Boxing | Talent and work | 95% | 73%           | 4%        | 17                 | $10.7m            | 32–13         |
| Boxing | Talent only     | 69% | 39%           | 0%        | 16                 | $2.7m             | 32–15         |
| Boxing | Work only       | 55% | 7%            | 0%        | 14                 | $1.0m             | 29–16         |
| MMA    | Talent and work | 95% | 65%           | 15%       | 15                 | $6.1m             | 25–13         |
| MMA    | Talent only     | 69% | 35%           | 2%        | 14                 | $2.3m             | 18–12         |
| MMA    | Work only       | 55% | 6%            | 0%        | 13                 | $0.8m             | 15–11         |
| Golf   | Talent and work | 90% | 73%           | 13%       | 19                 | $76.8m            | —             |
| Golf   | Talent only     | 71% | 44%           | 2%        | 18                 | $40.0m            | —             |
| Golf   | Work only       | 50% | 5%            | 0%        | 15                 | $20.4m            | —             |
| Tennis | Talent and work | 90% | 61%           | 10%       | 10                 | $20.0m            | —             |
| Tennis | Talent only     | 71% | 21%           | 0%        | 8                  | $6.0m             | —             |
| Tennis | Work only       | 56% | 4%            | 0%        | 7                  | $2.5m             | —             |

The "neither" rows (3–5% reach the pros) have one to seven professionals out of 150 and say nothing about the
ladder: a boxer who got there that way ran one season of star results, which is a sample of one.

**How the ends fall out** (talent and work): boxing 125 retired, 17 by injury, 1 released; MMA 126 / 17 / 0; golf
130 / 5 / 0 (2 lost a card with talent only); tennis 126 / 9 / 0. Work-only fighters are the ones who get let
go: 21 of 150 boxers and 15 of 150 MMA fighters.

**Against Payton's odds.** Reaching the pros comes out where it was asked: 95 / 69–71 / 50–56 / 3–5. The star
share does not, and that is a finding and not a fix (97).

## Findings (roadmap 97–105)

97. **The star share is measured, not set, and it runs above the table.** A tier here is the result of a year's
    performance against a field, not a draw, so there is no dial that says 45%. Talent and work gives 61–73%
    against 45%; talent only 21–44% against 20%; work only 4–7% against 10%. Boxing's and MMA's work-only is
    under the ask; everything with talent is over. If the table is wanted, the dial is `FIELD_STRENGTH` (raise the
    top two fields) or `TRAINING_CAP`.
98. **Save v45.** 0803 took it for `SportsState.arts`, `SportCareer.wins/losses/best` and the two new offers.
    Agent B's saves are v46 and onward; the brief and `CLAIMS.md` say so.
99. **Careers are still two to three times real length.** Median pro seasons: boxing 17, golf 19, MMA 15, tennis 10. Fighters decline from 31 and retire at 28–40; the length comes from stars lasting. The dials are
    `retireAge` and `declineFrom`.
100.  **Martial-art training has no effect on a character and costs no hours.** It is a road to a career and
      nothing else. Mind & Body effects (health, discipline, stress, a workload) belong to v0.10.
101.  **Prize money and purses are gross.** Travel, coach, caddie, camp and manager cuts are not modelled.
102.  **A fringe fighter keeps a day job; from role up it is a living.** The job is not resigned at the bottom of
      the card, and job offers keep coming until the second rung.
103.  **A child's lessons are not billed, and an adult at home pays nothing.** Dues start when an adult pays for
      their own roof.
104.  **A life that never studies an art never reaches a card.** The passive-life pro rate is 3.4%, unchanged by
      fighters, and golf and tennis add about five of twenty-four. A passive life does not start an art.
105.  **A fighter who turns the card down is not asked again.** And any one art but boxing (Muay Thai, karate,
      taekwondo, wrestling or BJJ on its own) has no pro path; MMA needs a striking and a grappling art together.

## Files

- `content/src/sports.ts`: four sports ids, `SportFormat`, the rows and economies, `MARTIAL_ARTS`,
  `fightCareerFor`, `FIELD_STRENGTH`, `TRAINING_CAP`, `TOUR_NOISE`, `FIGHT_LUCK`, `OUT_MARGIN`, `tierForPerformance`,
  `isOut`, `TOUR_TITLE_CHANCE`, `PURSE_SPREAD`, `TITLE_PURSE_SHARE`, `MISSED_SEASON_PURSE`, `WORLD_RANK_BAND`,
  `FIGHTS_PER_YEAR`, `fightWinChance`, `worldRankFor`, `TEAM_SPORTS`/`TOUR_SPORTS`/`COMBAT_SPORTS`.
- `simulation/src/sports-core.ts` (new): the shared hashes and injury helpers, moved out of `sports.ts`.
- `simulation/src/sports-individual.ts` (new): the arts, the road in, the tour card, the individual season.
- `simulation/src/sports.ts`, `sports-state.ts`, `advance.ts`, `offers.ts`: the individual branch, the offers,
  dues in the ledger, a pro who is full time.
- `persistence`: save v45, migration 44 → 45, validation of `arts` and the two new offers.
- `scripts/generate-activities.py` and `content/data/activities.json` (regenerated): Golf and Tennis.
- `finance/src/summary.ts` and `tools/content-validator/validate.mjs`: `TICKET = '0803'`.
- `apps/mobile/src/screens/shells.tsx`: the Martial Arts row now points at 0809.
- `simulation/src/sports-0803.test.ts` (new, 70 tests); `sports-0802.test.ts` and `sports.test.ts` read
  `TEAM_SPORTS` where they meant the five team sports; `persistence.test.ts` (three new tests).
- `specs/CORE_RULES.md` 13.142–13.146.

## Tests and sabotage

70 new tests in the 0803 file: the rows and their real anchors, the six arts and every rule on them, what a set
of arts is a base for, the road to a card (age window, once per sport, one draw for the life), a fighter's year,
a tour year, golf and tennis through the whole game, boxing and MMA through the game, and that a life that goes
near none of it replays as it did before.

**Sabotage:** 50 deliberate breakages. The first run killed 33 and 17 survived. Every survivor but one pointed at
something that was not held: the third-year line, the age wear after forty, the 18–30 window, the once-per-sport
rule, boxing's own base art, the tour-card draw, the rung lost to a serious injury, luck in a fighter's year, the
belt's threshold, the training ceiling on a new card and the cap's value, the day job at the bottom of a card,
the record and the best tier kept when a career ends, the dues in the ledger, and a job offer for a fringe
fighter. Each now has a test and all are caught. **One survivor remains and is equivalent:** the
`sports.offer === undefined` half of the gym's guard, which cannot be false while there is no career, because an
open offer always comes with one.

## Open

The star share (97), careers twice real length (99) and that training has no character effects (100) are the
three Payton may want to move. Next is 0804 (Olympic and amateur sports), and 0809 is the screens. Neither is
started.
