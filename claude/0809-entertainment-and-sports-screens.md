# 0809 — Entertainment and Sports screens

**Status: DONE.** Mobile screens for 0801–0808. No engine behaviour change and **no save change (still
version 50)**. The engine package gets two export additions (`sports-individual`, `sports-post` and
`tierWords` are now exported from `@yearafter/simulation`) so the app can use the engines' own labels
and verbs. Until this ticket the app showed none of the sports, acting, music, modeling or racing work
beyond the cards the engines raise on their own (a scholarship, a contract, a part, a record deal, a job).

Payton chose: build on the 0808 stack (`feat/0809-entertainment-and-sports-screens` on
`feat/0808-racing-and-the-world`); **one hub reached from Activities**; **a career screen per field plus
a year recap card**; **awards and charts folded into each career screen**; **the Racing Team inside the
business screen**.

## What it adds

| Where                                     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activities → **Sports and Entertainment** | The hub (`entertainment`): five rows (Sports, Martial Arts and Karting, Acting, Music, Modeling), each with one line of where you are and, once there is one, the standing. A field the player is too young for is greyed with "From age N". The hub tells the player that offers (a scholarship, a contract, a part, a record deal, a job) arrive as a question when the year turns.                                                                           |
| **Sports** (`sports`)                     | Empty state with a way to Clubs & Teams. Otherwise the career in words (team, standing, contract with years left, seasons, reputation as a phrase, titles or championships, a fighter's record and day job), the sport's skills as bars, **Put the work in** (three a year, greyed when used up), the **job in the game** (coach or commentator) with **Leave the job**, awards and chart, and **Before** (finished careers with how they ended).               |
| **Martial Arts and Karting** (`studies`)  | Every study with its yearly cost, the age it starts, the two-at-a-time limit, and for the ones being studied: seasons in, whether it now counts towards a fight career, its skills as bars, **Put the work in** and **Stop**.                                                                                                                                                                                                                                   |
| **Acting** (`acting`)                     | Where the actor is (the rung and its blurb), reputation as a phrase, credits, hits, the agent; **booked** roles with their pay; the **six casting calls** (fee, chance, how far above or below you it is), **Apply** with the applications left; lessons, **Work on a character**, agent; awards and the Marquee List.                                                                                                                                          |
| **Music** (`music`)                       | Where the act is, listeners, reputation, tours; the label deal if any; **next year's plan** per kind (single, EP, album) against its cap and cost ("Your label pays" under a deal); **Plan a tour** with what it would bring and the weeks it uses; **Send a demo** with its odds; **collaborations** asked for; lessons; awards and the Silverline Chart.                                                                                                      |
| **Modeling** (`modeling`)                 | Where the model is, reputation, jobs, following, agency; booked jobs; **castings** (client, placement, fee, chance); **brand deals** (take it, ask for more, pass); **New pictures** (with the bill when it is the player's own); agency; awards.                                                                                                                                                                                                               |
| **Business screen → Racing Team**         | A racing team replaces the customers-and-shop sections with its own: series, seasons run, championships, the driver (in words, never a skill number), last season; **Hire a driver** (the three looking for a seat), **Drive for your own team** (only for a pro driver), **Hand the car to a hired driver**; **Developing the car** (lean, steady, heavy); **Move up** (through the same payment panel every purchase uses, with the loans) and **Step down**. |
| **The year recap** (`YearRecapNotice`)    | One card when the year turns, if sports, acting, music, modeling, awards or a racing team wrote a line for it. A single field titles the card with its name; several are "The year in your work" with each field named. It waits behind a pending question, an answer or a breakdown, and a graduation is read first.                                                                                                                                           |

## How it is built

- **Pure functions, then a thin store** (the 0708 shape). `stores/entertainmentActions.ts` holds every
  verb as a function from a state to a state and the card that answers it (`applyEntertainment`); the
  store has one new action, `entertain(action)`, over the shared `commit`. A refusal is a card in words,
  never a code. The engines' own label tables are used wherever one exists (`TRAIN_`, `ART_`, `APPLY_`,
  `MODEL_APPLY_`, `ACTING_`, `MUSIC_`, `MODELING_`, `PLAN_` and `FINANCE_ERROR_LABELS`); the racing team's
  refusals are written in mobile (finding 152).
- **Views choose the words** (`screens/entertainmentView.ts`, pure, derived from the state): a skill is a
  bar, a reputation is a phrase, no form number and no hours (spec 9, 343, 661); a driver is "quick" or
  "solid"; a chart shows the top ten with the player marked, and the player is added below it when they
  are not on it. Nothing is saved, so a reload shows exactly what it showed.
- **Offers are not rebuilt.** The scholarship, contract, tour card, national team, turn-pro, post, acting
  role, label deal and modeling job already reach the player through `decide.ts` and the generic decision
  card (accept / more / decline). These screens cover everything the player does between them.
- **The recap reads what the engines already wrote.** Year-turn lines have ids
  `t:YEAR:(sports|acting|music|modeling|awards|biz):N`; the recap groups the ones for the year that has
  just turned. A business line counts only when it is about a racing team the player runs (by the
  business's type, finding 150). The card's place in the stack is the same previous-state pattern as the
  graduation notice.
- **Field ages come from the engines**, not guesses: sports from the first middle-school age
  (`stageForGrade`), karting 8 and martial arts 10 (`STUDIES`), music lessons from 7
  (`MUSIC_LESSONS_MIN_AGE`), acting and modeling from their first rung's `minAge`.

## Tests

- 97 in `screens/entertainmentView.test.ts`: every view per stage and per field, written-out tables
  (ages, how a career ended, the three reach words), the chart row for row against the engine, awards,
  the racing team, and the recap grouping.
- 41 in `stores/entertainmentActions.test.ts`: every verb ok and refused, with the exact words; planning
  verbs write no card; rolls (an audition, a demo, a brand) swept until each outcome has happened.
- 64 in `screens/EntertainmentScreens.test.tsx`, 17 in `screens/RacingTeamPanel.test.tsx`, 10 in
  `components/YearRecapNotice.test.tsx` (including the recap made from the **real** year turn), 12 in
  `root/EntertainmentWiring.test.tsx` (the Activities door, the three Mind & Body rows, and that every
  new route is in the shell's table and the navigator).
- Mobile went from 231 tests to 472.
- **Sabotage:** 708 distinct mutations across the views, the actions, the screens, the recap notice and
  the racing panel. 568 were caught first time; 140 survived, 111 of those were real gaps and were closed
  with new tests (or by fixing the code), and 29 are equivalent (listed below). `test/wellFormed.ts` holds
  the three checks every screen state now passes: rows and hairlines alternate with no empty card, a row
  that says it can be pressed can be (and the reverse), and every button has a style that exists.

## What the tests found

- **The hub opened sports at age 6.** The first version used a guess for each field's age. The mutation
  pass changed it and nothing failed, because the test read the same constant it was checking. School
  teams start in middle school (11). All five ages now come from the engines, and a test pins the
  numbers (13.197).
- **A "not ready" note could never show.** Casting calls and modeling castings are generated only for
  rungs the actor is ready for (`castingCalls` falls back to what they can do), so the note was dead.
  Removed, and a test pins that no call is ever listed as not ready.
- **"Step down" was offered when the engine would refuse it.** Stepping down a series, like moving up,
  needs a finished season at the current level. The screen now offers it only then (13.200).
- **Headings were invisible to the text helper.** `SectionHeading` renders through a component, so a
  helper that scans text found none of them and every "this heading is not shown" assertion passed
  without looking. Headings are now read from the component (13.198).
- **Three screens had rows with no hairline between them.** The hire-a-driver list, an opened martial
  art's skill bars, and nothing else were found by the shared well-formed check once it ran on every state
  of every screen, not just the first. Fixed (13.203).
- **The recap counted a racing team by whether the engine had stored one.** A team the engine has not
  yet played has no stored state. Real play was fine (the first season stores it), but the rule now uses
  the business type.

## Findings (149–159)

**149. Sports open at middle school.** The hub row is greyed below 11 (the first age a school team can
exist), karting from 8, martial arts from 10, music from 7, acting from 11 and modeling from 14. All come
from the engines.

**150. The recap is a read of the Life feed.** It only knows what the engines wrote, so a field with no
line for a year has no recap, and a graduation in the same turn takes the card (the recap is dropped, not
queued). Music planning, a tour plan and car development write no card; the row changes in place.

**151. Engines never list a call you are not ready for.** `castingCalls` and `modelCalls` fall back to
what the actor can do, so there is no "not ready" state to show. If a later ticket lets a player see
roles above them, the note will need to come back.

**152. The racing team's refusal words live in the app.** `RACING_ERROR_LABELS` is written in mobile
because the engine returns codes (`too-soon`, `bottom-rung`, `no-such-driver`) and no sentences. Move the
table into the engine, as the other fields do, if another front end is ever built.

**153. There is no verb to retire.** A pro career ends only by the engine's own rules (an offer declined,
an injury, retirement age), and a booked role or job cannot be withdrawn from. The sports screen can leave
a coaching or commentary post and nothing else. Add `retireFromSport` and a withdraw verb if a playtest
wants them.

**154. Modeling has no chart.** The 0705 roster has no models, so there are no Atelier Awards winners to
rank against. The Modeling screen shows awards won and no chart.

**155. A sports chart is short.** The roster holds about six figures per sport, so the player's best rank
is among the first seven and the "player below the top ten" row is only ever used on the acting and music
charts.

**156. Stepping down and moving up are one step a season.** Moving up needs a season at the level and so
does stepping down; neither can be done twice in one year.

**157. The Homes screen shows two cash options for a purchase when the player holds a card.** Seen while
merging Agent B's payment work, not part of 0809; it is minor and left for the playtest list.

**158. A save is still v50.** Agent B's chain is on v51. Folding the stack onto Agent B's main is a
separate step (the save version, the migrations 46–49, `gameStore.tsx` conflicts), and the 0809 changes
are additive to it.

**159. Device checks are open.** Nothing in this ticket has been looked at on a phone. The long screens
(Music, Acting) are the ones to look at for spacing, and the recap card for how long it reads.

## Equivalent mutants

Twenty-nine mutants survive; each changes nothing a player can see or a test can reach.

- **Type-only edits** (`Outcome['…']`, `useState<'…'>`, `toggle = (panel: '…')`, the `as` casts on a sport id
  and on a series key): the compiler erases them.
- **Ordinal suffixes** (`rest >= 10 && rest <= 13`, `>= 11 && <= 14`): 10 and 14 take the default "th" anyway.
- **`firstAge` starting at 1**: no field opens at age 0, so the first age tried is never the answer.
- **`fee > 1`** on a collaboration: the engine's fee is at least its floor, never 1.
- **`next && cost !== undefined`** against `||`: the engine gives a next series and a cost together or neither.
- **`lines.length >= 0`** in the recap: a field is only in the map once a line has been added to it.
- **`facts.length > 1`, `skills.length > 1`** on the sports screen: a career has several facts and five skills.
- **`'ZZ-US'` for `'en-US'`** on listeners and following: an unknown locale falls back to the default, which is en-US here.
- **Three fallback sentences** (a refusal code the label tables do not know, and "Done." when a collaboration or a
  brand answer wrote no line): the types and the engines make them unreachable.

## Files

New: `stores/entertainmentActions.ts`, `screens/entertainmentView.ts`, `screens/EntertainmentScreens.tsx`,
`components/YearRecapNotice.tsx`, `test/entertainmentFixtures.ts` and the seven test files above.
Changed: `stores/gameStore.tsx` (`entertain`), `screens/BusinessesScreen.tsx` (the racing panel),
`screens/shells.tsx` (the Activities row, three Mind & Body rows), `navigation/navigation.tsx` (six keys),
`root/Shell.tsx` (six routes and the recap), `packages/simulation/src/index.ts` (three exports).
