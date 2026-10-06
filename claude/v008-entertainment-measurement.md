# v0.08 Entertainment & Sports — measurement and proposed tickets

**Status: PROPOSAL (6 October 2026). Nothing is built. Waiting for Payton to approve the breakdown and
the five decisions at the end.** Same shape as `v005-ownership-measurement.md` and
`v006-business-measurement.md`: what the spec asks for, what the build has today, real figures to
anchor against, and a ticket list.

## What the spec asks for

Spec 1369–1376: Acting (talent, lessons, character development, agent, roles, career reputation,
fame, awards, simple negotiation), Music (general Music talent, labels, releases, tours,
collaborations, awards, release caps), Modeling, and **a reusable sports engine**. Initial sports:
basketball, football, baseball, soccer, hockey, golf, tennis, boxing, MMA, then curated Olympic
groups. Coaches and teammates stay inside sports (spec 1305–1309). Add coaching and commentary
routes. The rules that bind every ticket below:

- Talents are Boolean and never a strength number (spec 1070). Athletic talent helps development and
  guarantees nothing.
- Reputation is per career: basketball, acting and music-industry reputation do not carry over (spec 11).
- Sport-specific skills are visible and trainable only while the character is in that sport (spec 9, 343).
- Negotiation is Accept / Request More / Decline (spec 289). An audition result is Offer or Denied, with no
  callback tree (spec 279). Acting does not read health or stress (spec 280).
- Music release caps a year: 2 LPs, 3 EPs, 15 singles (spec 979–1030).
- Injuries are meaningful and not constant. Individual excellence does not guarantee a championship.
  A strong pro career improves access to coaching and commentary afterwards (spec 979–1030).
- Extreme success is intended and uncapped, and strong play should make it **more attainable than in real
  life** (spec 949). That matters for the odds below.

## What the build has today

Measured on 240 passive lives (always taking the first answer, never pressing a button), played to 45.

| What                                                     | Result                                                                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Professional entertainment or sports jobs in the catalog | **0 of 169.** The nearest are the `creative` track's Studio assistant and Production assistant.                                       |
| Team sports                                              | 7 school teams (cross-country, basketball, football, swimming, soccer, wrestling, track) and 2 adult clubs (rec league, running club) |
| Lives with athletics talent                              | 22 of 240 (9%). Acting 21 (9%), music 15 (6%). 56 (23%) have at least one of the three.                                               |
| Ever on a sports team                                    | 107 of 240 (45%). On one at 19 or older: 56 (23%); the only sports an adult can join are 0416's two clubs.                            |
| Athletics talent, ever on a team                         | 15 of 22. Still on one at 19 or older: 7 of 22 (so, in a rec league).                                                                 |
| Best standing ever reached on a team                     | Talented players: p10 40, median 51, **p90 66**. Others: p10 40, median 44, p90 54. Standing is never shown as a number.              |
| Acting talent, ever joined a drama activity              | 13 of 21. Music talent, ever joined a band or choir: 8 of 15.                                                                         |
| Lives with any fame at all (passive)                     | **0 of 240.** Fame comes only from a creator channel (0701–0704).                                                                     |

What that means: the school ladder (tryouts, seasons, standing, practice) works and talent shows in
it, but it **ends at 18 with no next rung**. Nobody can be recruited, drafted, signed or cast.
Athletics talent moves the top of the standing range from 54 to 66, which is a real signal and nowhere
near a star. Talent in acting and music has no door at all after school.

**Reusable parts already in the build:**

- `education/src/activities.ts` and `standing.ts`: tryouts, seasons and standing. 0206b.
- `simulation/src/pursuits.ts` and `pursuit-offer.ts`: adult clubs and the systemic sign-up. 0416.
- `finance/src/representation.ts`: manager or agent, never both (0704). Acting and music agents can use it.
- `content/src/fame-work.ts` and `postRate` (0707): the going rate for a post at a given fame, plus the
  SAG-AFTRA day-rate floor. Finding 76 says v0.08 reuses the rate and does not invent a second scale.
- `content/src/celebrity.ts`, `simulation/src/celebrity-world.ts`: the persistent roster already has
  acting, music and athletics fields (0705), so famous strangers in those fields already exist.
- `simulation/src/careers.ts`, `offers.ts`: offers that arrive on their own (the systemic doors).
- `finance/src/businesses.ts`: 0602 left **Record Label, Talent Agency and Racing Team** in its
  deferred table, waiting for this milestone.

## Real-world figures

Sources fetched on 6 October 2026. Not every figure is current, and the dates are shown.

**The road to professional sport** (NCAA, participation progression, 2024-25; the NCAA says its
high-school figures "should be considered approximations"):

| Sport (men's unless stated) | High school to NCAA | NCAA to major pro                   | High school to pro (product) |
| --------------------------- | ------------------- | ----------------------------------- | ---------------------------- |
| Basketball                  | 3.6%                | 1.0%                                | about 0.04%                  |
| Football                    | 8.1%                | 1.4%                                | about 0.11%                  |
| Baseball                    | 8.8%                | 4.9%                                | about 0.43%                  |
| Ice hockey                  | 14.1%               | 7.5%                                | about 1.06%                  |
| Soccer                      | 5.9%                | not published (pro routes are many) | n/a                          |
| Women's basketball          | 4.7%                | 0.8%                                | about 0.04%                  |

At those odds, even if all 107 team players in the sample had played basketball, about 0.04 of them would reach the pros. The spec wants
strong play to reach elite outcomes more easily than that (spec 949), so the real odds are the
anchor and not the target. 0706 did the same for creator ranks (finding 69: a lift and a dial).

**League minimum salaries** (Legal Clarity summary): NFL $885,000 for a rookie, 2026 season. NBA
$1,272,870 for a rookie, 2025-26. MLB $780,000 on the 40-man roster, 2026. NHL $775,000 in 2025-26,
rising to $850,000 in 2026-27. These are the floor of a contract. Most of the game's pro
players would sit near them, with stars far above.

**Acting.** BLS counts 18,980 employed actors with a median wage of $16.70 an hour (May 2022, via
USAFacts). That is the figure for people who are employed as actors at all, and it hides how many work
a few days a year. 0707 already anchors a day rate on the SAG-AFTRA floor ($1,283).

**Music.** A UK Intellectual Property Office study (September 2021, data 2014-2020) found about
**0.4%** of musicians could make a living from streaming alone, needing about a million monthly streams
for an extended period, and 65-75% of the top earners' streams came from back catalogue. Of musicians who
depended entirely on music income, 43% earned £20,000 or less. It is UK data and now five years old.

**Not sourced yet:** modeling pay and agency terms, golf and tennis tour earnings by rank, boxing and
MMA purses, Olympic funding, coaching and commentary salaries. Each ticket that needs one will source
it before building, as 0701 did.

## Proposed tickets

Built one at a time with a stop between each, as v0.07 was. Engine tickets come first and the screens
follow in one ticket, which is what you chose for 0707 and 0708. The sports engine goes first because
acting, music and modeling can reuse its shape (a ladder, a contract, a reputation, a career length),
and the spec calls it reusable.

| Ticket                                      | What it covers                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **0801 The sports engine, with basketball** | A career ladder past school (high school, college, pro), the road in (recruiting, a draft, a signing), sport-specific skills that exist only while playing, contracts with Accept / Request More / Decline, injuries, a career that peaks and ends, a basketball reputation, and a standings table. One sport proves the engine. Measured against the NCAA and league figures above. |
| **0802 The other team sports**              | Football, baseball, soccer and hockey as data on the 0801 engine, each with its own skills and its own road in. Real odds as the anchor, with the dial set against them.                                                                                                                                                                                                             |
| **0803 Individual sports and combat**       | Golf, tennis, boxing and MMA (with multiple martial arts). A ranked tour rather than a roster, purses, and fights that are decided by skill and not by a minigame.                                                                                                                                                                                                                   |
| **0804 Olympics, coaching and commentary**  | The curated Olympic groups kept general (track and field, swimming, gymnastics, wrestling, boxing, weightlifting, winter events and a rotating few; no judo, as the spec's sports summary says). After a career: college, pro and overseas coaching and commentary, where a better career gives better access.                                                                       |
| **0805 Acting**                             | Lessons, character development, an agent (reusing 0704), eleven role tiers from student films to blockbusters (spec 276), offer or denied, simple negotiation, an acting reputation, fame, awards, and a Talent Agency business.                                                                                                                                                     |
| **0806 Music**                              | The independent path, label deals, releases with the 2 / 3 / 15 caps, tours, collaborations, awards, and the Record Label business 0602 left waiting.                                                                                                                                                                                                                                |
| **0807 Modeling**                           | Agencies, campaigns, sponsorship crossover and celebrity networking. Spec detail here is thin (one paragraph), so this is the smallest ticket and the one to combine if you prefer.                                                                                                                                                                                                  |
| **0808 Racing team and the world**          | The Racing Team business, awards across fields, and the 0705 roster's athletes, actors and musicians acting on what 0801–0807 built.                                                                                                                                                                                                                                                 |
| **0809 Entertainment and Sports screens**   | Career screens for each field, a way to follow a season, the contract and audition cards, and whatever Fame-screen changes the engines need. Same pattern as 0708.                                                                                                                                                                                                                   |

Save versions: 0801 will need a state field for the career and probably bumps the save, and each
later ticket will say so in its own document.

## Findings so far

**A. Athletic talent has no effect after eighteen.** 22 talented lives, 7 still on a team at 19 or
older, all in a rec league. Not a defect in 0416; it is the missing rung, and it is what 0801 is for.

**B. Real odds would leave the pro leagues empty.** About 0.04 expected pro basketball players
among the 107 lives that joined any team. The spec's "more attainable than real life" needs a lift, and so a dial, and a decision on
its size. This is the same issue as finding 69 (rank lift) and finding 50 (the top places are very rare).

**C. Fame is zero for every passive life.** A character who plays pro sport or acts would have fame for
the first time without ever opening a channel, so 0705's meetings (which already scale with fame) and
0707's opportunities (which read it) will begin to fire for people who are not creators. That is the
intended result, and it will also change how often those fire, so 0801 should re-measure both.

**D. Two things may overlap.** 0707's guest-star part pays a creator for a day on a set, and 0805 will
have a role. Finding 76 asks whether they are the same thing. This document recommends keeping 0707
as what a name alone gets you, and letting a career's own roles be separate, but it is your call.

## Decisions for Payton before 0801

1. **Order.** Sports first (recommended, because the engine is reusable), or acting or music first?
2. **How generous.** Real odds as the anchor and a lift that makes elite outcomes more reachable for a
   player who plays well (recommended, like 0706's rank lift), or exactly the real odds?
3. **College sports.** Should the road to pro run through college teams, scholarships and the 0405
   college offer (recommended, since that is how most real pros arrive), or go straight from high
   school to a signing to keep 0801 smaller?
4. **Screens.** One screens ticket at the end (0809, as v0.07 did), or screens with each engine ticket?
5. **Modeling.** Its own ticket (0807), or folded into acting (0805) because the spec gives it one paragraph?

## Sources

- NCAA, [Probability of Competing Beyond High School](http://www.ncaa.org/student-athletes/probability-of-competing-beyond-high-school/), 2024-25.
- Legal Clarity, [League minimum salaries: NFL, NBA, MLB and NHL](https://legalclarity.org/league-minimum-salaries-nfl-nba-mlb-and-nhl/).
- USAFacts, [How much do actors and writers make?](https://usafacts.org/articles/how-much-do-actors-and-writers-make/), BLS data for May 2022.
- Mixmag, [Only 0.4% of musicians could potentially make a living from streaming](https://mixmag.net/read/artists-streaming-income-livelihood-news), reporting the UK Intellectual Property Office's September 2021 study.
