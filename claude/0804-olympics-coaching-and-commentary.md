# 0804 — Olympics, coaching and commentary

**Status: DONE (engine).** No screens: they are 0809's. **Save change: v45 → v46.** Agent B's saves are now
v47 and onward (`CLAIMS.md`). Five Olympic sports with a Games every fourth year, medals that pay, and a
coaching or commentary post after any career in any sport from 0801–0804.

Payton's answers (7 October 2026):

- **The road:** train a discipline from childhood, qualify at 16 or older. The Games are every four years.
- **Five groups only:** track and field, swimming, gymnastics, wrestling, boxing. No judo, weightlifting, winter
  events or rotating slot.
- **Money:** a modest stipend, and a big sponsorship and prize for medalists. Medals feed fame and post-career access.
- **After a career:** coaching (college, pro, overseas) and commentary, for every sport 0801–0804, with access and
  pay set by the quality of the career.

## What changed in the engine

A sport's `format` gains a fourth value, `olympic`.

|                | Team                                | Tour                            | Combat                           | Olympic                                               |
| -------------- | ----------------------------------- | ------------------------------- | -------------------------------- | ----------------------------------------------------- |
| Road in        | School team, scholarship, draft     | School team, college, tour card | Study an art from ten            | **Study a discipline from ten**, three seasons        |
| Question asked | Contract                            | Take the card / Turn it down    | Turn pro / Not now               | **Join the program / Not now**                        |
| Pro life       | Team, contract, peak, end age       | No team, no contract            | A gym, a record                  | A training center, a stipend, no record, no contract  |
| A year         | Tier moves on a drawn breakout      | Tier moves on a year's results  | Tier moves on a season of fights | Tier moves on a year's results; **a Games every 4th** |
| Pay            | Salary                              | Prize money                     | Fight purses                     | Stipend; **prize and sponsors on a medal**            |
| Ends           | Retired, injury, declined, unsigned | Retired, injury, lost the card  | Retired, injury, released        | Retired, injury, **cut from the program**             |

### The three disciplines and the road in

Track and field ($400 a year), swimming ($1,200) and gymnastics ($2,400) are studied through the same machinery
as the six martial arts (`STUDIES` is the six arts plus these three; `MARTIAL_ARTS` stays six, and
`findMartialArt` looks in `STUDIES`). Same rules: from ten, two at once, three sessions a year, a level that
drifts toward what the character is, the same training ceiling, readable only while studied. Style is `athletic`.
Wrestling and boxing, already arts, now also feed the Olympic programs.

After three seasons (`MIN_ART_SEASONS`) the national federation looks (`nationalTeamOffer`). **One hash draw per
life per sport**, against `REACH_NATIONAL` 0.5 / 0.3 / 0.2 / 0.01 for talent and work, talent, work and
neither, with the category rising with hard work under the same draw (CORE_RULES 13.145). Windows
(`OLYMPIC_WINDOW`): track 16–30, swimming 16–26, gymnastics 16–22, wrestling and boxing 18–30. Accepting puts the
athlete at stage `pro`, tier `fringe`, with the program's training center, the arts that fed the sport removed, and the day job kept
(a fringe stipend is not a living). Turning it down is the answer; it is not asked again.

**Boxing and wrestling reach the Games only after the pro question.** 0803's pro offer is checked first, and the
Olympic offer is raised only when no pro offer is open, which is after a boxer declines to turn pro or fails the pro
draw. That keeps every 0803 odd and test as it was. A boxer who is now in the national program has no boxing art
left, so cannot then go pro (finding 111).

### A season and the Games

A season is tour-shaped: performance is form plus a hash draw of ±12 (`TOUR_NOISE`), and the tier moves one rung
toward it. A fringe athlete well below the fringe line after the first season is **cut**. The stipend is the
tier's figure times a spread of 0.75–1.25.

Every fourth year (`isGamesYear`: year divisible by four), an athlete at **role or above** (`GAMES_TEAM_TIER`) who
is not injured out goes to the Games. The Games performance is the year's performance plus a hash draw of ±8
(`GAMES_NOISE` 16), read at three lines (`MEDAL_LINE`): **gold 98, silver 92, bronze 86**; 62 or more without a
medal is a final (`FINAL_LINE`). A lower athlete is told they did not make the team; an injured one is told the
injury kept them out. A medal:

| Medal  | Prize (real) | Sponsorship (judgement) | Total    |
| ------ | ------------ | ----------------------- | -------- |
| Gold   | $37,500      | $250,000                | $287,500 |
| Silver | $22,500      | $100,000                | $122,500 |
| Bronze | $15,000      | $40,000                 | $55,000  |

It is added to that year's stipend, counts as a title (+1 titles, +6 reputation, +6 mood), and writes a life record
("Olympic gold medal in swimming, 2024"). The prize amounts are what the US Olympic and Paralympic Committee pays; the
sponsorship amounts are invented and are the dial (finding 108).

### The stipends and the programs

Fictional federations and twelve fictional training centers (`OLYMPIC_CENTERS`); no real governing body's letters.

| Sport          | Federation                           | Fringe | Role | Starter | Star  | Superstar | Retires | Injuries |
| -------------- | ------------------------------------ | ------ | ---- | ------- | ----- | --------- | ------- | -------- |
| Track          | National Track Federation (NTF)      | $8k    | $25k | $50k    | $120k | $400k     | 29      | ×1.0     |
| Swimming       | National Aquatics Federation (NAF)   | $7k    | $22k | $45k    | $110k | $350k     | 26      | ×0.7     |
| Gymnastics     | National Gymnastics Federation (NGF) | $6k    | $20k | $40k    | $100k | $300k     | 21      | ×1.5     |
| Wrestling      | National Wrestling Federation (NWF)  | $5k    | $15k | $30k    | $80k  | $220k     | 28      | ×1.4     |
| Amateur boxing | Amateur Boxing Union (ABU)           | $6k    | $18k | $35k    | $90k  | $250k     | 27      | ×1.3     |

"Retires" is the age the decline begins and the career ends around. Full time is from `star`: below it the day job
stays and job offers keep coming. The ledger source is "Stipend and sponsors, <federation>".

### After the career: coaching and commentary

`sports-post.ts`. For any retired athlete of any sport (0801–0804), one post is offered in a life.

- **Which career.** The best past career by `pastScore` (tier, then titles, then pro seasons). A school team that
  went nowhere is not one.
- **When.** One to three years after that career ended, up to age 62 (`POST_OFFER_MAX_AGE`), if a single hash draw
  for the life is under `postChance`: 0.12 + 0.14 per tier rung for a pro (0.08 for a college-only career), plus
  0.03 a title up to eight, capped at 0.92. The draw is fixed, so a better chance never re-rolls.
- **What.** `postLevelsFor` gives the best the career opens. Coach: pro if starter or better (or three titles),
  overseas from role, college otherwise. Commentary: national if star or better (or three titles), local otherwise.
  When both are open, 65% of lives are offered coaching.
- **Pay** (`POST_JOBS`), rising 3% a year to 1.6 times (`POST_RAISE`, `POST_RAISE_CAP`):

| Post                 | Pay at the start | Full time |
| -------------------- | ---------------- | --------- |
| College coach        | $55,000          | yes       |
| Overseas coach       | $95,000          | yes       |
| Pro coach            | $160,000         | yes       |
| Local commentator    | $48,000          | no        |
| National commentator | $240,000         | yes       |

A full-time post resigns the day job and suppresses job offers (`isPostFullTime`); the header reads, for
example, "College basketball coach". A local chair is done beside a job. It ends at 68 (`POST_END_AGE`) with a line,
and can be left, which ends it for good. Turning it down is the answer and it is not asked again. The ledger
source is "<post title> pay", e.g. "College basketball coach pay". Real anchors: the BLS median for coaches and
scouts is $47,320 and for announcers about $47,340; the ladder is a game ladder above those floors.

## Measured

120 lives per cell, played to the end of the career, the discipline worked at every year for "work", the talent
flag set by the test. "Oly" is reaching the national program; "at Games" is the share of those who went to a
Games; "medalist" is **any medal over the whole career**, of those who joined; "star+" is star or superstar of those
who joined.

| Sport          | Who             | Oly | At Games | Medalist | Star+ | Median seasons | Median pay (career) |
| -------------- | --------------- | --- | -------- | -------- | ----- | -------------- | ------------------- |
| Track          | Talent and work | 51% | 93%      | 23%      | 59%   | 22             | $734k               |
| Track          | Talent only     | 24% | 83%      | 3%       | 24%   | 21             | $386k               |
| Track          | Work only       | 14% | 71%      | 0%       | 6%    | 19             | $267k               |
| Swimming       | Talent and work | 48% | 98%      | 21%      | 60%   | 20             | $581k               |
| Swimming       | Talent only     | 33% | 85%      | 0%       | 15%   | 18             | $247k               |
| Swimming       | Work only       | 22% | 77%      | 0%       | 4%    | 17             | $141k               |
| Gymnastics     | Talent and work | 47% | 86%      | 5%       | 43%   | 14             | $220k               |
| Gymnastics     | Talent only     | 30% | 61%      | 0%       | 3%    | 12             | $98k                |
| Gymnastics     | Work only       | 23% | 41%      | 0%       | 0%    | 11             | $57k                |
| Wrestling      | Talent and work | 48% | 98%      | 26%      | 58%   | 21             | $365k               |
| Wrestling      | Talent only     | 33% | 82%      | 8%       | 23%   | 19             | $159k               |
| Wrestling      | Work only       | 21% | 72%      | 0%       | 4%    | 20             | $116k               |
| Amateur boxing | Talent and work | 24% | 93%      | 31%      | 55%   | 19             | $389k               |
| Amateur boxing | Talent only     | 22% | 96%      | 0%       | 8%    | 18             | $137k               |
| Amateur boxing | Work only       | 11% | 62%      | 0%       | 0%    | 18             | $140k               |

The "neither" rows reach the program in 0–2% of lives and say nothing about the ladder. Amateur boxing is lower
because a boxer is asked the pro question first and most of those who would qualify go pro instead (finding 111).
Of the talent-and-work athletes who joined, retired / injured / cut: track 52 / 9 / 0, swimming 54 / 3 / 0,
gymnastics 52 / 4 / 0, wrestling 55 / 2 / 0, boxing 29 / 0 / 0. A medal, once the lines were set at 98/92/86, is a
careers-long chance for the best athletes (about one in four or five) and nearly nobody else: the first lines I tried
(90/82/74) made more than half of them medalists.

Post offers, per 120 lives, for those who took the road: track 36 (23 coaching, 13 commentary) at talent-and-work,
swimming 30, gymnastics 22, wrestling 27, boxing 15; roughly 60% coaching in each.

## Findings (roadmap 106–113)

106. **The Olympic program's table is lower than the pros'.** Payton's 95 / 75 / 60 / 3 table is for a pro card. The
     national program uses 50 / 30 / 20 / 1 (`REACH_NATIONAL`), a judgement: a federation takes far fewer than a
     gym does. Measured, 47–51% of talent-and-work students reach it (24% for boxing, see 111). If the same table is
     wanted, raise `REACH_NATIONAL`.
107. **"Medalist" counts any medal over several Games.** An athlete who stays to 29 sees up to three Games. The 21–31%
     medalist share of talent and work is a share of careers, not of Games, and is still far above real (a medalist
     is about one athlete in several hundred who ever trained). The dials are `MEDAL_LINE` and `GAMES_NOISE`.
108. **Prizes are real; sponsorships and ladders are judgement.** The USOPC pays $37,500, $22,500 and $15,000 for
     gold, silver and bronze. The sponsor amounts and the five stipend ladders are mine and are the dials.
109. **A post's pay ladder is a game ladder above the BLS medians** (coaches $47,320, announcers about $47,340).
     College coach $55k and a national commentator $240k are inventions. `POST_JOBS` is the dial.
110. **Training starts at ten, and gymnasts start much earlier in real life.** Disciplines share the arts' age limit
     of ten and two at a time. A child who begins at five is not modelled.
111. **Boxing and wrestling reach the Games only after the pro question,** and joining the national program removes
     the boxing art that was its base, so such a boxer cannot then go pro. A boxer who declines the pro card may be offered
     the program the next year. This preserved every 0803 odd and test; the cost is the lower amateur-boxing rate.
112. **Careers are still long.** Median seasons 11–22. Gymnastics is shortest (14) and track longest (22). The dials
     are `retireAge` and `declineFrom` per sport, and the same finding as 99.
113. **Save v46.** 0804 took it for `SportsState.post`, the `national-team` and `post-job` offers and the `cut`
     ending. Agent B's saves are v47 and onward; the brief, `CLAIMS.md` and `HANDOFF.md` say so.

## Files

- `content/src/sports.ts`: five Olympic ids and rows, `OLYMPIC_CENTERS`, five economies, `OLYMPIC_SPORTS`,
  `OLYMPIC_DISCIPLINES`, `STUDIES`, `OLYMPIC_WINDOW`, `REACH_NATIONAL`, `isGamesYear`, `GAMES_NOISE`, `MEDAL_LINE`,
  `FINAL_LINE`, `GAMES_TEAM_TIER`, `medalFor`, `MEDAL_PRIZE`, `MEDAL_SPONSORSHIP`, `olympicCareersFor`, and the post
  section (`POST_JOBS`, `pastScore`, `postLevelsFor`, `postChance`, `postPay`, `POST_END_AGE`, `POST_OFFER_MAX_AGE`).
- `simulation/src/sports-post.ts` (new): the offer of a post, a post's year, leaving it, its title and header.
- `simulation/src/sports-individual.ts`: the national-team offer, the olympic base arts, the Games in a season.
- `simulation/src/sports.ts`, `sports-state.ts`, `sports-core.ts`, `advance.ts`, `offers.ts`: the olympic branch, the
  two offers and their answers, the post year and ledger, a full-time post that ends a day job.
- `persistence`: save v46, migration 45 → 46, validation of `post` and the two offers.
- `finance/src/summary.ts` and `tools/content-validator/validate.mjs`: `TICKET = '0804'`.
- `simulation/src/sports-0804.test.ts` (new, 81 tests); `sports-0803.test.ts` (about 20 added in the 0803 pass);
  `persistence.test.ts` (three new tests).
- `specs/CORE_RULES.md` 13.147–13.149.

## Tests and sabotage

81 tests: the five rows and their anchors, the three disciplines, the road to the program (window, once per sport,
one draw), boxing and wrestling after the pro question, the national-team question, a season and the Games (the
ceiling, the medal's pay, record, reputation and mood, the injury, the cut), an Olympic life through the game, what
a past career opens, the offer of a post (delay, level, once, one draw, the coaching share), a post through the game (day
job, header, ledger, leaving, ending at 68), and that a life that goes near none of it replays as it did.

**Sabotage:** 49 deliberate breakages. The first run killed 36 and left 12 survivors and 1 that did not match.
Of the 12 survivors, one was equivalent and one was a redundant line (deleted); the other ten pointed at things that were not held: the low-form Games test (it used a form that is always cut), the gold
ceiling, the six reputation and mood points of a medal, the one-to-three-year delay, a school-stage career with an
open question, the two new offers in the save validator, and the coach/commentary split. Each now has a test and all
are caught. **The equivalent survivor remains** (`finalist` without its `medal === undefined` half: a finalist line is only read when there is no medal).

## Open

Payton may want to move: the national program's table (106), the medal lines and sponsorships (107, 108), the long
careers (112) and the lower amateur-boxing rate (111). Next is 0805 (Acting); 0809 is the screens. Neither is started.
