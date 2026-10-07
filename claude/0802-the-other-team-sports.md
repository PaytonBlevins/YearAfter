# 0802 — The other team sports

**Status: DONE (engine).** No screens: they are 0809's. **No save change**: the save stays at v44, so Agent B's
saves are still v45 onward. Football, baseball, soccer and hockey are four more rows on 0801's engine, and the
engine itself changed in three small places (below).

Payton's answers (7 October 2026):

- **First rung.** Baseball and hockey get school teams, beside basketball, football and soccer.
- **Odds.** The same table as basketball: reaching the pros from a team is 95% with talent and hard work, 75%
  with talent, 60% with hard work and about 3% with neither; 45%, 20% and 10% of those become stars.
- **Road in.** One shared ladder (school team, scholarship, college, draft, pro) with each sport's own data.
- **Positions.** A label only.

## What a sport is now

A row in `content/src/sports.ts`. 0801's row had the name, the league, the teams and five skills; 0802 adds two
things to every row:

| Added       | What it is                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `positions` | The positions a life is drawn into, a label and nothing more.                                                                                             |
| `economy`   | The pay ladder, the ages a career ends at, the size of the draft, how many picks make a first round, the top pick's first-year pay, and an injury factor. |

Everything else about a career is shared: the odds, the ladder, the tiers, fame, titles, reputation and the
question the game asks (scholarship, contract, renewal).

### The five rows

| Sport      | League                            | Skills                                                     | Positions                                                                                                                         |
| ---------- | --------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Basketball | Premier Basketball Association    | Shooting, Ball handling, Defence, Athleticism, Court sense | Point guard, shooting guard, small forward, power forward, center                                                                 |
| Football   | National Gridiron League (NGL)    | Speed, Strength, Hands, Tackling, Playbook                 | Quarterback, running back, wide receiver, tight end, offensive lineman, defensive lineman, linebacker, cornerback, safety, kicker |
| Baseball   | Continental Baseball League (CBL) | Hitting, Power, Fielding, Arm, Plate discipline            | Pitcher (twice), catcher, first, second, shortstop, third, outfielder (twice)                                                     |
| Soccer     | American Soccer Alliance (ASA)    | Passing, Shooting, Dribbling, Defending, Stamina           | Goalkeeper, defender (twice), midfielder (twice), forward                                                                         |
| Hockey     | Frontier Hockey League (FHL)      | Skating, Shot, Stickhandling, Checking, Vision             | Center, left wing, right wing, defenseman (twice), goaltender                                                                     |

Each has 24–25 fictional pro teams (none a real league's or a real team's name) and shares the 12 fictional
colleges. No league's letters are a real one's (NFL, MLB, NHL, NBA, MLS, CFL and USL are checked for in a test).
A position listed twice is twice as likely: it is the way to make a pitcher more common than a catcher without
a weights table.

### The money and the years

The bottom of every pay ladder is the real league minimum, and the figures above it are a game ladder, as in 0801. Sources: league minimums from legalclarity.org's summary of the collective agreements (NFL 2026: $885,000
rookie and $1.3 million for a veteran of seven seasons; MLB 2026: $780,000, flat; NHL 2025-26: $775,000, rising
to $850,000 in 2026-27) and MLS's own 2026 roster rules (senior minimum $113,400, reserve $88,025). NCAA to the
pros (2025): football 1.4%, baseball 4.9%, hockey 7.5%; men's soccer is not given, because the NCAA says there are
too many professional routes to count. Career lengths: about three years in the NFL, four to five in MLB, five in
the NHL, about four and a half in the NBA (CBS Minnesota, "How long can athletes stay in the game"; RunRepeat for
the NFL's 3.3 years and 27.6 average retirement age).

| Sport      | Fringe | Role player | Starter | Star | Superstar | First pick, first year | Draft (picks / first round) | Career ends at (fringe → superstar) | Injuries |
| ---------- | ------ | ----------- | ------- | ---- | --------- | ---------------------- | --------------------------- | ----------------------------------- | -------- |
| Basketball | $1.3m  | $3.2m       | $11m    | $32m | $55m      | $12m                   | 60 / 30                     | 26–29 → 33–38                       | ×1.0     |
| Football   | $900k  | $2.0m       | $6.5m   | $24m | $55m      | $12m                   | 224 / 32 (7 rounds)         | 24–27 → 32–37                       | ×1.6     |
| Baseball   | $780k  | $2.5m       | $9m     | $30m | $55m      | $1.5m                  | 600 / 30 (20 rounds)        | 27–30 → 35–40                       | ×0.9     |
| Soccer     | $115k  | $400k       | $1.2m   | $5m  | $20m      | $450k                  | 90 / 30                     | 26–29 → 34–38                       | ×1.0     |
| Hockey     | $850k  | $2.0m       | $5.5m   | $11m | $15m      | $950k                  | 224 / 32 (7 rounds)         | 25–28 → 34–38                       | ×1.2     |

A rookie's pay runs from the top pick's down to a fifth of it by the end of the first round and the league
minimum after, and never below the minimum (hockey's top pick, $950,000, is about the real rookie scale's cap of
$975,000). A first-round pick gets four years and anyone later two. The draft's pick ranges were written for 60 and
are stretched in proportion to the size of the draft, so a superstar goes early in a draft of 224 as in one of 60.
Basketball's numbers are exactly what 0801 shipped (tested: pick 1 is $12 million, pick 30 is $2.4 million, pick 31
is the minimum).

## Measured

Lives that try out for the sport each year from twelve, with the answer to "join another team?" always no (see
CORE_RULES 13.140). The talent flag is set by the test so each category fills. "On the team" is being on it at
seventeen. About 460 lives on a team per cell.

**Reached the pros, of those on the team** (asked for 95 / 75 / 60 / 3):

| Who             | Basketball | Football | Baseball | Soccer | Hockey |
| --------------- | ---------- | -------- | -------- | ------ | ------ |
| Talent and work | 93.1%      | 93.1%    | 94.0%    | 94.7%  | 92.3%  |
| Talent only     | 69.0%      | 70.8%    | 75.1%    | 74.7%  | 75.4%  |
| Work only       | 59.1%      | 56.8%    | 57.4%    | 54.9%  | 58.7%  |
| Neither         | 3.4%       | 5.3%     | 2.3%     | 1.9%   | 2.4%   |

**Stars and superstars, of those who reach the pros** (asked for 45 / 20 / 10):

| Who             | Basketball | Football | Baseball | Soccer | Hockey |
| --------------- | ---------- | -------- | -------- | ------ | ------ |
| Talent and work | 43%        | 43%      | 45%      | 45%    | 45%    |
| Talent only     | 24%        | 20%      | 22%      | 17%    | 21%    |
| Work only       | 9%         | 11%      | 8%       | 10%    | 9%     |

Every cell is within two or three points of the same cell in every other sport, which is what the odds being
sport-independent means: the draws are hashes keyed on the sport's id, and nothing in them knows which sport it is.
The two cells that look most off (football "talent only" 70.8%, "neither" 5.3%) are 2 to 2.7 standard deviations
from the ask in samples of 460, in a table of 20 cells.

**A career** (talent and hard work; gross pay, over concluded careers):

| Sport      | Median pro seasons | Median career pay | Ended by injury | By best tier: median pro seasons (fringe, role, starter, star, superstar) |
| ---------- | ------------------ | ----------------- | --------------- | ------------------------------------------------------------------------- |
| Basketball | 10                 | $74.2 million     | 19 of 430       | 6, 8, 10, 12, 14                                                          |
| Football   | 8                  | $24.9 million     | 23 of 433       | 4, 6, 8, 10, 13                                                           |
| Baseball   | 11                 | $69.8 million     | 18 of 431       | 6, 9, 11, 14, 15                                                          |
| Soccer     | 10                 | $7.6 million      | 18 of 446       | 6, 8, 11, 12, 15                                                          |
| Hockey     | 10                 | $37.5 million     | 20 of 420       | 5, 7, 10, 12, 15                                                          |

Football is the short career, as it is in real life, but at 8 seasons it is still 2.4 times the real 3.3, and
basketball's 10 is twice the real 4.5 (finding 92). Soccer pays by far the least, the way the real league does.

**Injuries, in a season, with health held at 50** (4,000 seasons each, a starter): football 21.5%, hockey 16.0%,
basketball 13.1%, soccer 13.1%, baseball 12.0% (a test asserts the order and the ends). In college (7% a season
before the factor) football's rate is at least 1.2 times baseball's in a test; I did not measure the exact figure.

**A life that only presses Advance and says yes to everything** (700 lives, played to 50, every question answered with its
first choice, which joins every team offered). This is the number that matters most, and it is not the one 0801 had:

| What                                   | Lives (of 700) |
| -------------------------------------- | -------------- |
| With athletics talent                  | 68 (9.7%)      |
| Ever on a school sport team            | 160 (22.9%)    |
| Ever recruited or in college on a team | 54             |
| **Became a pro**                       | **23 (3.3%)**  |
| Of those, a star or superstar          | 3              |

By sport, ever on the team / became a pro: soccer 62 / 10, baseball 71 / 9, hockey 14 / 3, basketball 12 / 0,
football 1 / 1. In 0801 the same kind of life gave **0.25%** (5 of 2,000): the gate was a basketball team, which
1.3% of lives joined. Soccer and baseball are open from elementary school and cost $95 and $180 a year, so a
passive child ends up on one far more often, and the odds you gave (75% for talent alone) then take over.
**Going pro is now about one life in thirty for somebody who never trains and says yes to every team**, against
the NCAA's roughly one in 2,500 for a high-school basketball player. That is the odds multiplied by how easy a team is to join; either can be the
dial (finding 96).

## The three changes to 0801's engine

1. **One of five.** 0801 took the first sport team in the list (`activities.find`). With five sports a life can
   be on two teams, and the one joined first would win whatever they were best at. The road now follows the sport
   the life has been playing (a school career already begun), and if there is none yet, the one they are best at
   (the higher standing). Two tests: the standing that disagrees with the order, and the held team that wins over
   a better standing. CORE_RULES 13.139.
2. **Pure helpers for the draft.** `rookiePay`, `draftPickFor`, `rookieYears`, `roundOf` (content) and
   `rookieDeal`, `draftedWords` (simulation) take the sport's economy and size, with basketball's values as the
   defaults, so each is tested alone and the call sites cannot silently go back to 60 and 30.
3. **The draft line says the position.** "Drafted number 14 by the Harbor City Gulls, as a point guard." Nothing
   else reads the position. It is derived from a hash of the seed, the generation and the sport, never saved
   (positions are not on `SportCareer`), which is why this ticket needs no save change. `positionOf(state)` is
   what 0809 reads for a header.

Also: two school activities, **Baseball** (elementary to high school; $180 a year, league fees and a glove) and
**Hockey** (middle and high school; $1,500 a year, ice time, a team fee and pads), added in
`scripts/generate-activities.py` and regenerated, not by hand (CORE_RULES 13.141). The validator's ticket is
`0802`.

## Side effects on older tests

Adding two catalog activities changes which activity a child is offered in a year, so a seeded life that a test
picked by seed is a different life now. Five tests that leaned on a particular seed's luck failed on the full run
and not in the sports files; none was a bug in the new code, and each is now chosen by its condition (13.137):

- `celebrity.test.ts` (two tests): the "connected" life needed a partner by luck. There is a `PARTNERED` life
  found by searching for one.
- `creators.test.ts`: one year of one life claimed a light channel stresses at least as much as none. Over six
  lives it did not (five points below), so that claim is dropped and heavy over light and over none stays.
- `guardians.test.ts` found two real things. **An answer wrote two lines:** signing a first contract with a day job
  wrote "Quit..." and "Signed with..." (`resign` writes its own line), breaking the one-answer-one-line budget; the
  signing line now carries it. And **a college rejection line repeated across years:** "Turned down. They said the
  year was competitive..." had no `{major}`, so two rejections for different majors read the same; it now names
  the major (`college.ts`).

## Files

- `content/src/sports.ts`: `SportId` (five), `SportEconomy`, the four new rows, `positions` on every row,
  `TIER_PAY` and `RETIRE_AGE` kept as basketball's under their old names, `rookiePay(pick, economy)`,
  `rookieYears`, `roundOf`, `draftPickFor(peak, unit, draftSize)`.
- `simulation/src/sports.ts`: the sport picked by held-else-best, the economy read from the sport (pay, retirement,
  injury factor, first round, draft size), `positionIn`, `positionOf`, `rookieDeal`, `draftedWords`.
- `scripts/generate-activities.py` and `content/data/activities.json` (regenerated): Baseball and Hockey.
- `simulation/src/sports-0802.test.ts` (new, 30 tests), `sports.test.ts` (one assertion: five sports).
- `finance/src/summary.ts` and `tools/content-validator/validate.mjs`: `TICKET = '0802'`.
- `simulation/src/college.ts` (one line of copy), and the three older test files above.
- No change to persistence, `game-state`, `advance` or the screens.

## Tests and sabotage

30 new tests: the five rows (real floors within 15% of the real minimum, a ladder that only goes up, football the
short and the injury-prone, baseball the long, retirement ranges that never run backwards), the rookie scale and
pick ranges in every sport (including the real $975,000 hockey cap), rounds and their words (1st through 23rd), the
position label (same every time, from the list, independent across sports, never touching a stream), each
sport played through the whole ladder on its own teams at its own pay in its own league, the 95% case in each
sport, the renewal offer at the sport's own pay, injuries by sport (pro and college), two teams, and the real
draft sizes.

**Sabotage:** 31 deliberate breakages. 29 were tried first: 20 were caught, 8 survived and one pattern did not
match; I added two more after fixing them. Each survivor pointed at something untested rather than at a dead line: the college injury
factor, the draft size argument, the first-round line (hard-coded 30), the round words past seventh, the ending of
11th/12th/13th, the position hash's key, the stretch of the pick ranges, and the held-team rule. Each has a test now
and all 31 are caught.

## Open (roadmap findings 90–96)

Positions have no screen and no effect (90). The real roads (baseball's minors, hockey's junior route, soccer's
academy and overseas) are not modelled and soccer's "draft" is fiction (91). Careers are two to three times real
length in every sport (92). A life on two teams follows one sport (93). Everything above each sport's real
minimum is a judgement (94). Hockey's $1,500 a year may keep poorer lives off the team; it is not measured (95). A life that says yes to every
team goes pro about one time in thirty (96).
