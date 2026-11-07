# 0906 — Military screens

**Status: DONE.** Mobile screens for 0901–0905 (the service, the veteran, the FBI and the CIA). **No save change (still
version 63).** One engine change, and only because a screen exposed it: finding 216 (the living phase wrote "no work all
year" over a year in uniform that paid). The simulation package also gets one export (`military-veterans`) so the app can
use the engines' own retired-pay and GI Bill readers.

Payton chose: build on the 0905 stack (`feat/0906-military-screens` on `feat/0905-military-intelligence-and-agencies`);
**a hub on the Career page, not Activities** (Agent B's November work then moved the special careers into a tab on that page, so the card sits in **Special careers**); buttons for **Enlist** (branch, then job, with an application for a commission),
**Retire from service** and **Put the work in** (two a year); **words and bars with no numbers** (pay, years and GI Bill
months are real figures and stay); **extend the year recap card**; **a discharge card** when a service ends (how, the
discharge, retired pay, the GI Bill); and **fix finding 216**. He did not choose to show decorations or past deployments.

He then decided the agencies: **the FBI and the CIA are separate agencies with their own screens, not intertwined with a
military career.** A degree is a way in as well as a clearance, and nobody has to have served. That is how it is built.

## What it adds

| Where                                                      | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Career → **Special careers** tab → **Public service** card | Three rows: Military, FBI and CIA, each with one line of where you are (rank and branch, title and agency, "Not in uniform", "Left the Army after 6 years"). An agency below its minimum age is shut with the age (CIA 21, FBI 23); the other agency is shut with who you work for. Nothing shows under 17.                                                                                                                                                                |
| **Military** (`military`)                                  | A small hub: **Service** and **Veteran**. Veteran stays shut ("Once you have served") until a service has ended.                                                                                                                                                                                                                                                                                                                                                           |
| **Service** (`service`)                                    | In uniform: rank (with track and branch), job, posting (or the training word for the branch), this term (years left, "Up this year"), time in uniform, pay a year, your name as a phrase, clearance when held, and **How it is going** (a phrase and a bar). **Put the work in**, **Apply for a commission** (enlisted members) and **Retire from service**, each greyed with the reason when the engine would refuse it. Out of uniform: "Not in uniform" and **Enlist**. |
| **The recruiter** (`recruiter`)                            | The 0902 offer as a table: branch first (with what each begins with), then, for a graduate, enlisted or officer, then the job (with how dangerous it is, in words). A branch or job the person does not qualify for is shut with the reason. A start closes the table and a card says what happened; a refusal leaves the player there.                                                                                                                                    |
| **Veteran** (`veteran`)                                    | Retired pay (a real figure and since when, or what it takes), the GI Bill (share in words, months left, tuition cap, housing), the hiring preference, and **Before**: each past service with how it ended and its discharge.                                                                                                                                                                                                                                               |
| **FBI** and **CIA** (`fbi`, `cia`)                         | Each agency has its own screen. A member sees title, posting, years, pay, name, clearance and **How it is going**, with **Put the work in** and a leave button that reads "Retire from the agency" when twenty years and the age are in (otherwise "Leave the agency"). A non-member sees **What it asks** (age window, degree, experience, clearance), a line on what counts for them (years in intelligence, an existing clearance) and **Apply to the FBI / CIA**.      |
| **Honours**                                                | A short list of names, shown on the Service screen when any decoration exists. Names only; no dates, no deployments.                                                                                                                                                                                                                                                                                                                                                       |
| **The year recap** (`YearRecapNotice`)                     | Three new groups from the year-turn lines: **Your service**, **Your agency**, **Your benefits** (the first retired-pay year).                                                                                                                                                                                                                                                                                                                                              |
| **The discharge card**                                     | One card whenever a service ends, however it ends: a title for how (You retired, Your term ended, Passed over, A medical discharge, Court-martialed, You left the service), then how long and in which branch, the discharge, retired pay and when it starts, the GI Bill ("all of it, with 36 months to use"), and the hiring preference. Read first; the year's service lines are taken out of the recap behind it.                                                      |

## How it is built

- **Pure functions, then a thin store** (the 0809 shape). `militaryView.ts` holds every view as a pure function of the
  state; `militaryActions.ts` holds every verb as a function from a state to a state and the card that answers it
  (`applyMilitary`); the store has one new action, `serve(action)`, over the shared `commit`. A refusal is a card in words.
- **The screen asks the engine whether it would refuse** (13.226): Retire, Apply for a commission and Apply to an agency are
  run on the state and the result discarded, so a greyed button and the engine can never disagree. The words are the
  screen's; the rules are the engine's.
- **The discharge card is read from the change** (13.228): `dischargeOutcome(before, after)` needs a service before and none
  after, a new row in the past and a living player. That covers the Retire button, an answer to "stay or leave" at the end of
  a term, and a year turning. The Retire verb therefore writes no card of its own.
- **Notices are a queue.** `YearRecapNotice` shows the discharge card, then the recap, one at a time, and waits behind an
  outcome, a decision or a detail card. A state change that brings nothing new does not drop what is still to be read.
- **Year-turn lines have ids** `t:YEAR:military:N` (Your service), `t:YEAR:intel:N` (Your agency) and
  `t:YEAR:veteran:N` (Your benefits). Lines a player's own verb wrote carry a tag in the id and are left out.
- **Words and bars, no numbers.** Standing is a phrase from the performance and a bar; reputation is a phrase; the GI Bill
  share is a phrase; danger is a phrase. Pay, years, months left and retired pay are real figures, as chosen.
- **The enlist flow is local state.** The recruiter's table keeps the branch and the track in the screen, not in the save; the
  engine's own stepped offer (for a recruiter's call) is still the generic decision card.

## Finding 216 (the engine change)

`runLiving` writes the year's money line from a job title and the gross pay. Somebody in uniform or in an agency has no
civilian job, so it had no title and wrote "No work all year. $10,280 went out and nothing came in" next to the real pay.
`advance.ts` now passes the rank (or the agent's title) as the job and the year's gross pay as what it earned, **only when
there is no civilian job and the pay is above zero**. Every other life is handed exactly what it was before. Nine tests in
`living-0906.test.ts`: the plain no-income control still writes the old line; a soldier's and an agent's year read as pay
with the gross figure in the line; the living phase is handed the rank or title and the pay (a spy on `runLiving`); a life
with neither is handed no title and zero; a life with a job is handed the job's title and earnings; a life with a job and a
service row keeps the job's title and is not credited the pay twice; a recruit in basic training is paid too.

## Tests

- **262 new in mobile** (580 → 842), 9 in the simulation package.
  - 139 in `screens/militaryView.test.ts`: every door row per age and per situation, the standing and GI Bill words
    written out, every view in every state, every refusal in words, the discharge card for each ending, the recap lines.
  - 44 in `stores/militaryActions.test.ts`: every verb ok and refused with the exact words; rolls (a board, an agency
    application) swept until each outcome has happened; every verdict puts every line the engine wrote on the card.
  - 48 in `screens/MilitaryScreens.test.tsx`, 17 in `root/MilitaryWiring.test.tsx` (the Career card, six routes in the
    shell's table and the navigator), 14 in `components/YearRecapMilitary.test.tsx` (the recap from the **real** year turn,
    the discharge card for a year turn and for an answer given in place, the queue).
  - `test/wellFormed.ts` (rows and hairlines alternate, a row that says it can be pressed can be, every button has a style)
    runs on every state of every new screen.
- **Sabotage:** 267 distinct breakages across the views, the screens, the actions, the recap notice, the Career card and
  the engine fix (`mutool/run0906.py`; each one edits the source one way and runs the suites). **247 were caught first
  time. 20 were not: 18 survivors and 2 whose anchors did not match (re-anchored and both caught).** Of the 18 survivors,
  **11 were real gaps** and were closed with tests, and **7 are equivalent** (below).

## What the tests found

- **A test whose comment was backwards passed for the wrong reason.** "Stays open when only some branches turn the person
  away" said smarts 35 was under the Army's floor and over the Coast Guard's. It is the other way round, and `toEqual({})`
  treats `{ closed: undefined }` as `{}`, so breaking the check left the test green. Probed every branch (age and smarts),
  corrected the comment, asserted the key is absent, and added a case where the first and last branch give different
  reasons (13.227).
- **The recruiter's own question was not tested as a reason to shut.** Only a question of the game's (`pending`) was; a
  recruiter's open `military.offer` was not.
- **Pay on both screens was only checked as a pattern** (`$` and digits). The sabotage replaced the engine's yearly pay with
  last year's recorded pay and nothing failed. Both are now compared with `yearPayOf` and `agencyPayOf`.
- **Four boundaries had no test**: the age retired pay "starts" (`since` against `from`), exactly the years it takes for the
  preference with the wrong discharge, a service gone with no row added (not a discharge), and which of several past rows the
  discharge card reads.
- **Cards still to read were dropped.** A later state change with nothing to say replaced the queue with an empty one. A
  test now keeps the discharge card, then the recap, across an unrelated change.
- **The civilian-job guard in the engine fix was not tested.** A life with a job and a service row must keep the job's title
  and must not be credited the pay twice.

## Findings (221–229)

**221. The FBI and the CIA are their own screens, as Payton chose.** They do not live under Military. The Career page's
"Public service" card holds Military, FBI and CIA side by side; an agency's screen has its own Apply, Put the work in and
Leave. A degree opens an agency without a day in uniform, and the screen says what counts for you (years in intelligence,
a clearance).

**222. Finding 216 is fixed for service members and agents only.** The same "No work all year… nothing came in" line is
still written for any other life with an income and no civilian job: a pro athlete, an actor, a musician, a model, and a
retired veteran or agent drawing a pension. Reproduced with a pro basketball life and a retired veteran. The fix for them is
the same shape (a title and a gross figure for every non-job income) and wants a decision, because it touches the feed of
every such life.

**223. Decorations are shown by name only, and past deployments not at all.** Payton did not choose either. The Service
screen lists names under "Honours" when any exist; this is the one place the original "awards" wording was leaned on. Dates,
the deployment history and what each decoration was for are kept in the save and unseen (finding 191, partly).

**224. Finding 175 is closed.** `retireFromService` has a button; it is open any time after twenty years and not in training
or while deployed. Its refusal words (`RETIRE_ERROR_LABELS`) live in mobile because the engine returns codes, as with 152.

**225. Findings 165 and 215 are still open.** Events gated on "has a job" still read a serving member or an agent as
unemployed (165), and the Career screen's Apply is still not blocked for somebody in uniform or an agency (215). Neither is a
screen problem.

**226. The recruiter's table is a local flow.** Leaving it half-way forgets the branch. The engine's own stepped offer (the
recruiter's call) is unaffected and is still the generic decision card.

**227. The Career card is hidden under 17.** A child sees nothing; at 17 the service is open and each agency is shut with its
age.

**228. A mission, a deployment and the gate still do nothing.** `deploymentsOpen` and `intel.missionsOpen` are off in every
life (182, 217), so no screen shows a deployment in progress or a mission waiting; the incident and mission cards are the
generic scaffolding of 183 and 217.

**229. Device checks are open and a save is still v63.** Nothing here has been looked at on a phone; the Service and
Recruiter screens are the long ones, and the discharge card is long. Agent B's chain is on v64 or later.

## Equivalent mutants

Seven survive; each changes nothing a player can see or a test can reach.

- **`bars.every` against `bars.some`** in the recruiter's door: `ENLIST_ERROR_LABELS[undefined]` is `undefined`, and in the
  game's data every branch is barred together or the Army, the first one listed, is open when anyone is.
- **`workHarder` spent returning `result.value.state`**: the engine returns the same state it was given.
- **`agent ?? serving` against `serving ?? agent`** on the Work card's meter: nobody can be in uniform and in an agency
  (the engines bar each for the other).
- **`wrote(...)` against `entry.text`** on an agency card: the engine writes one line for each verdict.
- **A graduation in the same turn** (`graduationOutcome` first): the 0809 guard, not touched by this ticket.
- **`military:\d*` against `\d+`** in the recap line pattern: no line is written without its number.
- **`publicEarned >= 0`** in the engine fix: a service or an agency always pays something.

## Files

New: `screens/militaryView.ts`, `screens/MilitaryScreens.tsx`, `stores/militaryActions.ts`, `test/militaryFixtures.ts`, the
five test files above and `packages/simulation/src/living-0906.test.ts`.
Changed: `components/YearRecapNotice.tsx` (the queue and the discharge card), `screens/entertainmentView.ts` (three recap
groups), `screens/EntertainmentScreens.tsx` (`FactRows` exported), `screens/shells.tsx` (the Public service card),
`stores/gameStore.tsx` (`serve`), `navigation/navigation.tsx` (six keys), `root/Shell.tsx` (six routes),
`packages/simulation/src/advance.ts` (finding 216) and `packages/simulation/src/index.ts` (one export).

## Merged with Agent B's November work

After 0906 was built, Agent B's November branches (PRs #29–#36 on `integrate/sports-on-main`, tip `df103b5`: card payments and
accessibility, fame and music, national campaigns, business previews, live auctions, the illustrated interface, venture
portfolios and advisor tiers) were merged into this stack. They do not touch the save, so it is still v63. Five files
conflicted and were resolved by hand:

- `advance.ts` — the import lists (his `MODEL_CHANNEL_CATEGORIES`, my `agencyRow` and `agencyTitle`) were joined.
- `YearRecapNotice.tsx` — his "Yearly updates" groups (a new illness, a tenant who left, the annual business report) come
  first, then the year's work groups with the service lines left out when a discharge card says them. The queue and the
  discharge card are unchanged.
- `shells.tsx` — he split the Career page into **Work & study** and **Special careers** tabs; the Public service card now
  sits in **Special careers**, under the sports and entertainment rows. The wiring tests open that tab first and one more
  test pins that the card is not on Work & study.
- `CLAIMS.md` and `CORE_RULES.md` — both sides appended. His rule 13.204 (tenant continuity and exact card payoff) is
  renumbered **13.229**, after Agent A's 13.204–13.228.
