# 0808 — Racing team and the world

**Status: DONE (engine).** No screens: they are 0809's. **Save change: v49 → v50.** Agent B's saves are now v51 and
onward (`CLAIMS.md`). Two things in one ticket, because Payton asked for the awards to be the same layer everywhere:

1. **Motor racing.** A driver's career in the sports engine (karting from eight, a seat offered at sixteen to thirty,
   five rungs, a championship, a team that may not renew), **and** a Racing Team to own: the 34th business type,
   whose year is a season with a field, a purse and sponsors who pay by the result. The player can run a team, or drive
   for their own, or both.
2. **The world around the player.** One awards layer across acting, music, modeling and sports (a new ceremony for
   sports and racing, the sweep, the third win, the charts), and the 0705 roster winning the same awards and filling
   the same charts as the player. All of it is derived from the seed, the year and the records. Nothing about the
   world is saved.

Payton's answers (11 October 2026):

- **Order:** start 0808 now in the cloud copy; ship one combined 0807 + 0808 package later, committed as two stacked
  branches.
- **Racing Team:** seasons with sponsors and prize money, **plus** the player can drive their own team (a driver career
  in the sports engine).
- **Awards:** **one shared awards-ceremony layer** across fields, not one per field.
- **The roster:** the 0705 roster **wins the same awards and fills the same charts** as the player.
- **Save:** 0808 takes v50. Agent B's saves become v51 and onward.

## What changed in the engine

A life that owns no team, never races and is never famous enough to be on a chart **replays exactly as it did
before.** Every draw is a hash (`mixedUnit`), no RNG stream is touched, and every new field is optional.

### A driver's career (the sports engine, `format: 'racing'`)

- **Karting** is a new study, the same as a martial art or an art: from **eight**, two studies at once at most, and the seasons count once there are enough of them (`MIN_ART_SEASONS`). It is refused to a driver who is racing for a living (it is their career).
- **A seat is offered, not applied for.** From sixteen to thirty, one hash draw per life against `REACH_SEAT`:
  **0.35** with talent and hard work, 0.18 talent only, 0.12 work only, 0.005 neither. It is the narrowest road of
  any individual sport. The offer is the same Take the seat / Not now question as a pro contract (kind `turn-pro`)
  from one of twelve fictional teams, and a seat turned down is a past with `how: 'declined'` that does not come back.
- **A season** is tour-like (`runIndividualSeason`): form plus a draw of `RACING_NOISE` (26, a touch wider than a
  tour's) sets the performance, which sets the rung. The result is a **place in the standings**, never a win-loss
  line. A title is a hash against `RACING_TITLE_CHANCE` (0 / 3% / 9% / 22% / 40% by tier) and needs a healthy
  season; a title is place 1, a milestone, a championship record and +4 mood. `RACING_PLACE_BAND` keeps the place
  inside the tier's band (a superstar finishes 1 to 3, a fringe driver 11 to 24).
- **A team may not renew.** A fringe driver who has had more than one pro season and has a poor year is released
  ("{team} didn't renew your seat after a poor year."). Nobody higher up loses the seat for one year.
- **Words of the grid:** "A better team wants you. You are … on the grid now." and "Dropped to a slower car after a
  poor run." Injuries are 40% likelier than the average sport (`injuryFactor` 1.4) and have their own lines.
- **Pay** is a game ladder: $40,000 / $150,000 / $600,000 / $4M / $25M by tier. A living from the third rung.
- **Retirement:** fringe 27–33, role 30–37, starter 33–41, star 36–45, superstar 38–47. The line counts titles.

### The Racing Team (business 34, `biz.racing`)

A team is the one business whose year is a **season**, not a till. `racingYear` (`finance/src/racing.ts`) returns the
generic `BusinessYearResult`, so the till, the owner's draw, a loan, a valuation and the ledger work unchanged.

| Rung | Series (fictional)      | Field | Field strength | Running budget | Crew     | Purse    | Sponsor money | Hired driver (skill 50) | Move up into it |
| ---- | ----------------------- | ----- | -------------- | -------------- | -------- | -------- | ------------- | ----------------------- | --------------- |
| 1    | Coastline Club Racing   | 24    | 40             | $38,000        | $14,000  | $18,000  | $70,000       | $14,000                 | —               |
| 2    | Atlas Junior Formula    | 20    | 50             | $190,000       | $60,000  | $70,000  | $340,000      | $50,000                 | $90,000         |
| 3    | Continental GT Series   | 18    | 60             | $800,000       | $220,000 | $260,000 | $1.39M        | $160,000                | $400,000        |
| 4    | Meridian Premier Series | 26    | 70             | $4.2M          | $900,000 | $1.5M    | $7.4M         | $800,000                | $2.2M           |
| 5    | Global Grand Prix       | 20    | 82             | $21M           | $3.8M    | $7M      | $39M          | $4.5M                   | $12M            |

- **Pace.** Driver 50%, car 35%, crew 15% of the team's pace against the series average (the crew is judged against
  an ordinary crew, not against the series). A **luck** draw of ±`SEASON_LUCK` (7, a normal draw) is added; the
  place is a logistic over the field (`FIELD_SPREAD` 9). First place is the title.
- **Money.** Revenue is **sponsors + prize + merchandise (4% of sponsors)**. Sponsors pay by the standing, half by
  this year's and half by last year's (0.5 to 1.4 of the going rate), by the team's name (0.8 to 1.2), the economy
  and a negotiation (±15%). The prize is the purse × standing^2.2, +50% for a title. Costs are the running budget
  (±10%, times the development programme: lean 0.85, steady 1, heavy 1.25), the crew's pay, a hired driver's pay,
  a shop and insurance share (5%) and an **incident** (16% a season, 12% of the running budget).
- **The car** drifts a third of the way a year to where the programme puts it (lean −6, steady 0, heavy +9 from the
  series' strength). **The name** moves a third of the way toward 20 + 70 × the standing.
- **Drivers** come from a market of three a year. A hired driver rises 2 a year until 25, holds (+0.5) until 34,
  loses 2 after, and retires at 41; the team finds a replacement. They are paid by skill (`driverPayFor`, exponent 1.6,
  to the nearest $500).
- **Commands:** `hireDriver`, `setDevelopment` (lean / steady / heavy), `moveUpSeries` (one rung a season, only after
  a season at the level, paid in cash or by an expansion loan sized to the car — `upgradeOffers` lists them),
  `dropDownSeries` (the car is sold for **40%** of what stepping up cost), `driveOwnTeam` and `stopDrivingOwnTeam`.
  `racingViewOf` is the one read a screen needs (the team, its series, the candidates, the cost of moving up, whether
  the owner can drive).
- **An owner who drives.** A player who is a pro driver can sit in their own car. They are then the team's driver at
  their own form, **the team pays no driver for them** (the sports career pays them), and a championship record is
  written **only for a title the owner won as the driver** (finding 141).

### The awards across fields (`content/src/awards.ts`, `simulation/src/awards.ts`)

Acting, music and modeling hand out their own awards in their own years (0805–0807), and those are **not touched**.
The layer reads what they did:

- **The Laurel Sports Awards** (fictional): Athlete of the Year for a pro in any sport, **Driver of the Year** for a
  driver. A pro in the top three tiers is named at **4% / 12% / 25%** a season by the tier they finished in (starter /
  star / superstar), **×2.5** in a year they won a title. +6 mood; each Laurel adds **+3** to the sports career's
  fame, up to +12.
- **A sweep:** wins in **two** fields in one year ("A year of awards in two fields."), +4 mood and a record.
- **The third win at one ceremony** is remembered ("Three-time winner at the Marquee Awards"). One Laurel counts as
  one win.
- **The charts:** the most famous 25 in a field in a year: the Marquee List (acting), the Silverline Chart (music)
  and "{league} rankings" for sports, one per sport. The player is on a chart when their fame is at least 12
  (`NOTABLE_FAME`); a tie goes to the roster. Records for **the first year in the top ten** and **the first time at
  No. 1**, once each.
- **Losing.** A player of fame **40** or more in a field, in a year the roster picked a winner, loses the award one
  year in two, and is told once a year (−1 mood): "You were up for …".
- **The roster** (0705) wins the same awards. A working notable with fame **35** or more is in the running; the
  winner is a fame-squared weighted pick (a household name wins far more often than a name on the rise). The roster
  carries no sport, so each athlete's sport is a fresh hash against `ROSTER_SPORT_WEIGHTS` (basketball 17, football
  17, baseball 11, soccer 13, hockey 7, golf 6, tennis 6, boxing 4, MMA 4, track 4, swimming 3, gymnastics 2, wrestling 1,
  racing 5; **a new sport goes at the end**). A sport has a champion each year, the same for every load.
- **Nothing is saved.** The roster winners, the champions and the charts are pure functions of (seed, year, records).
  The player's own wins are records, as before.

## Measured

Racing teams, 600 seasons per cell, a hired driver, a steady programme, medium pay, a name of 50, a normal economy,
the car at the series' strength. "+8" and "+15" are the driver's skill above the series' strength.

| Rung | Driver | Margin (mean) | Margin p10 / p90 | Median place | Titles | Loss years |
| ---- | ------ | ------------- | ---------------- | ------------ | ------ | ---------- |
| 1    | +0     | 5.8%          | −39% / 40%       | 13 of 24     | 0.5%   | 36%        |
| 1    | +8     | 16.1%         | −24% / 42%       | 8 of 24      | 3.2%   | 21%        |
| 1    | +15    | 22.4%         | −9% / 43%        | 5 of 24      | 9.0%   | 14%        |
| 3    | +0     | 4.7%          | −39% / 38%       | 10 of 18     | 1.2%   | 38%        |
| 3    | +8     | 15.6%         | −22% / 41%       | 6 of 18      | 4.8%   | 21%        |
| 3    | +15    | 22.6%         | −6% / 43%        | 4 of 18      | 13.3%  | 14%        |
| 5    | +0     | 4.7%          | −40% / 38%       | 11 of 20     | 1.0%   | 39%        |
| 5    | +8     | 14.6%         | −24% / 40%       | 7 of 20      | 4.2%   | 22%        |
| 5    | +15    | 21.4%         | −9% / 41%        | 4 of 20      | 11.5%  | 14%        |

(Rungs 2 and 4 sit within a point of these.) A middling team is a small business with a big variance: it loses money
in more than a third of its years. A driver 15 points above the series is worth about +17 points of margin and
multiplies the chance of a title by ten or more (1% to 11–13%). **Every rung has the same shape on purpose**, so moving up is about size and risk, not
about a better business.

Drivers, 300 lives per cell from birth to fifty, karting from eight (the three that studied it; "no karting" is the
control), every seat offered taken:

| Life                       | Held a seat | Peak: fringe | role | starter | star | superstar | Titles per seat holder |
| -------------------------- | ----------- | ------------ | ---- | ------- | ---- | --------- | ---------------------- |
| Athletic talent, hard work | 91 of 300   | 1            | 7    | 52      | 30   | 1         | 1.1                    |
| Talent, no hard work       | 46 of 300   | 1            | 0    | 24      | 21   | 0         | 1.4                    |
| Hard work, no talent       | 40 of 300   | 1            | 14   | 25      | 0    | 0         | 0.5                    |
| Never karted               | 0 of 300    | —            | —    | —       | —    | —         | —                      |

A seat is held by 30% of lives with talent and work (the table says 35% before the window, the death rate and the
offer being declined), 15% with talent alone and 13% with work alone. About a third of seat holders reach star. That is
generous (finding 140).

## Findings (roadmap 138–148)

138. **The ladder is a game ladder; only the anchors are real.** Real: an entry-level open-wheel season costs about
     $200,000 (a 2013 industry report); a sports-car team runs about $1 million (2015); an IndyCar is $3–8 million a
     car (2016); a NASCAR Cup car about $20 million a season before the driver (a team owner, 2024); the Indy 500 prize
     fund has run about $13 million with about $2 million to the winner, and IndyCar's Leader's Circle program has paid
     $1 million for each full-time entry. The running budgets sit on those anchors ($190,000, $800,000, $4.2M, $21M).
     **Everything else is a game judgement**, each a named constant in `content/src/racing.ts` and pinned: the field
     sizes and strengths, crew and driver pay, the purses and sponsor money, the incident rate, the upgrade costs, the
     driver-market numbers, `REACH_SEAT`, the driver pay ladder, `RACING_TITLE_CHANCE`, `RACING_NOISE`, the roster sport
     weights and every number in the awards layer.
139. **A middling team loses money in more than a third of its years** (36–39%), with a mean margin of about 5%. Skill
     is what moves it: +8 points of driver is about +10 points of margin. That is the game, not the world: real
     teams are far more often funded than profitable. Dials: `TEAM_WEIGHTS`, `SPONSOR_FLOOR`/`SPONSOR_SLOPE`, the budgets.
140. **The driver road is narrow but the top is generous.** 30% of lives with talent and work hold a seat, and a third
     of those reach star. Reaching a premier series is far rarer in real life. This follows Payton's rule
     that strong play should make success "more attainable than in real life" (spec 949), as 0803 did (finding 97).
     Dials: `REACH_SEAT`, the performance thresholds shared with the tours.
141. **An owner who drives is paid once.** The sports career pays them; the team pays no driver, so the team's costs
     fall by the seat. A championship record is written only for an owner's title, not for a title won by a hired driver
     (that is the business's, in its own line). If the owner's career ends, the team finds a driver in the market.
142. **Buying a listed racing team gives a default rung-1 team.** The business market can list a racing team; the
     buyer gets a club team with an ordinary car and a journeyman, whatever the seller's series.
143. **Awards are derived, not saved.** The player's wins are records, as they were. The roster's winners, the
     champions and every chart are recomputed from (seed, year). **If the roster's generation (0705) is ever changed,
     past winners change with it.** That is the price of saving nothing; the tests pin the draws.
144. **The awards numbers are all judgement** (finding 138 lists them). The rates are low on purpose: a superstar is
     named about one year in four, a starter one in twenty-five.
145. **A Laurel raises fame** (+3 each, to +12 a career), and fame feeds 0705's meetings and 0707's opportunities. It
     can make a very good athlete's name larger than a sports career alone would. It is capped.
146. **Losing is told once a year.** A player up for several awards in a year gets one "You were up for …" line, at the
     first ceremony it happened at, not one per field.
147. **Not modelled:** two cars, a constructors' championship, drivers who change teams with a negotiation, a driver
     market that bids for the player's own driver, a team that buys out another, an engine or chassis supplier, pit
     strategy, and safety rules. The roster has no models, so Atelier Awards have no roster winner.
148. **Save v50.** 0808 took it for `racing` on an owned business. Agent B's saves are v51 and onward; the brief,
     `CLAIMS.md` and `HANDOFF.md` say so.

## Files

- `content/src/sports.ts`: the `racing` sport, `RACING_STUDIES` (karting), `RACING_WINDOW`, `REACH_SEAT`,
  `RACING_TITLE_CHANCE`, `RACING_PLACE_BAND`, `RACING_NOISE`, the twelve teams and the racing economy.
- `content/src/racing.ts` (new): the five series, `TEAM_WEIGHTS`, the dials, `driverPayFor` and the driver names and
  lines. `content/src/awards.ts` (new): the ceremonies, the Laurel numbers, the roster sport weights and the charts.
- `finance/src/racing-state.ts` (new): `RacingTeam`, `SeasonResult` and the driver types. `finance/src/racing.ts`
  (new): `racingYear`, `paceOf`, `placeOf`, `standingOf`, `driverAfter`, `defaultTeam`, `driverCandidates`,
  `racingNormal`. `finance/src/businesses.ts`: `OwnedBusiness.racing?`.
- `simulation/src/businesses.ts`: the commands above, `racingViewOf`, `upgradeOffers`, `ownerDriving`.
- `simulation/src/sports-individual.ts`, `sports.ts`, `sports-core.ts`: the racing season, the seat offer, the words.
- `simulation/src/awards.ts` (new): `runAwardsYear`, `rosterWinner`, `championOf`, `chartOf`, `playerRank`, `winsAt`,
  `laurelFame`, `rosterContenders`, `pickByFame`. `simulation/src/advance.ts`: the awards year (lines, mood, records
  and fame), after modeling and before health.
- `scripts/generate-businesses.py`, `content/data/businesses.json`: 34 types. `finance/src/summary.ts`,
  `tools/content-validator/validate.mjs`: `TICKET = '0808'`.
- `persistence`: save v50, migration 49 to 50 (nothing to add: the field is optional), validation of a team's rung,
  car, programme, driver and last season (`racingTeamOk`).
- Tests: `finance/src/racing.test.ts` (new), `simulation/src/racing-0808.test.ts` (new),
  `simulation/src/awards-0808.test.ts` (new), changes to `sports-0804.test.ts`, `business-finance.test.ts`,
  `finance/src/businesses.test.ts`, `simulation/src/businesses.test.ts` and `persistence.test.ts`.
- `specs/CORE_RULES.md` 13.192–13.196.

## Tests and sabotage

The racing tests cover the karting study and its age floor, the seat offer (the hash draw against the reach, the 16–30
window, the work-and-talent split in the seat table), taking and refusing a seat, a released driver, the racing season
in `runIndividualSeason` (standings line, titles, tier moves), driver pay to the dollar, the Racing Team business (the
year, sponsors, prize money, a driver the player can be, moving up and dropping down a series, a bad season, the
incident line), and the save tests (migration 49 to v50, a round trip, rejection of a bad team). The awards tests cover
the ceremony names, the Laurel chance by tier and title, a sweep, a third win at one ceremony, the three charts
(size, order, ties, where the player lands, fame floor), the nominee-loss line, the roster winner (fame-weighted, working
notables only), the roster sport weights summing to 100, `awardsInputOf`, and the wiring into `advanceYear` (ledger
rows before health, mood, records last, fame). A life that never touches racing replays unchanged. `pnpm verify` ended
`EXIT=0`: 1837 simulation tests, 676 finance, 211 content, 131 persistence, 231 mobile, and the content validator on
17 catalog files and 1491 content ids.

**Sabotage:** Every line of the new finance, content, awards, racing and persistence code and the 0808 wiring in
`advance.ts`, `businesses.ts` and `sports-individual.ts` was mutated (comparison and boundary flips, `&&`/`||`, `+`/`-`,
`*`/`/`, rounding and min/max swaps, off-by-one literals, dropped negations, and hand-written wiring mutants that remove
or redirect one wire at a time), in groups run one at a time (finance racing, content racing, awards, advance wiring,
businesses and sports racing, persistence). Closing survivors took simplifying dead code (a dead clamp and a dead
`chance > 0` guard in awards, a dead `?? 0` default, an inline racing ordinal) and about thirty more tests, several
checked against their specific mutant by hand. The final pass ended with **0 survivors** apart from named equivalents:
`Math.round` against `Math.floor` on a whole-dollar value that is already whole (`businesses.ts` drop-down return), and
generic lines that 0808 did not write (an older `roleOk` check in `migrations.ts`, the generic "of it borrowed" line in
`businesses.ts`), which are out of scope.

**Lesson:** two sabotage runs against one tree contaminate each other, and some early "kills" were false for that reason;
the groups were rerun one at a time, and the earlier kills re-checked.

## Open items

- **Screens are 0809.** The team (`racingViewOf`), a driver's season, the Laurel and the charts are what it reads.
- Payton to decide whether a failing racing team (negative cash, three bad years) should have a pre-failure
  decision of its own, as B1's rescue engine would give other businesses. Nothing here adds one.
- The leagues the roster's athletes play in are only ever used for awards and charts; a roster athlete does not
  appear in a sport's standings. If the screens want a league table, 0809 would need a roster-per-league ticket.
