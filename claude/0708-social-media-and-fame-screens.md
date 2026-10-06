# 0708 — Social Media and Fame screens

**Status: DONE.** No engine change and no save change (still version 43). The mobile app had no
creator or celebrity screen at all before this ticket, so this is the first time any of 0701–0707 can
be played.

Payton asked for: Social Media as its own screen; a Fame bar on the Life screen once fame is above
0 ("since you can become famous in many different ways"); a Fame screen with the exact percentage
where a player takes photoshoots, commercials, talk shows and celebrity guest-star parts; and a card
after the year turns for a chance meeting with a famous person.

## What it adds

| Where                          | What                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Life screen                    | A **Fame bar**, pinned above the feed, only while fame is above 0. It shows the exact percentage and opens the Fame screen. It is not an eighth stat (CORE_RULES 3 keeps the stats at seven) and has its own colour.                                                                                                                                                                    |
| Fame screen (`fame`)           | The exact percentage in a large bar, a phrase for how known you are, **offers this year** (`fameOffers`, each a row that says yes with one press), what was done this year with its pay, what opens next ("A commercial opens up at 12%."), **people you know** (opens one), and a row to Social Media.                                                                                 |
| One famous person              | The 0705 second menu (`connectionMenu`): catch up, compliment, get together, flirt, collaborate, invite, endorse. What cannot be done stays on the list, greyed, with the reason in words.                                                                                                                                                                                              |
| Social Media (`socialMedia`)   | Your channels (audience, platform, chart place or group), **Start a channel**, this year's **sponsorships** (take it, ask for more, pass), **collaborations** (what they charge or that it is a friend or a swap, and how many people it brings), **groups** (what they keep), and **who looks after you** (manager or agent, one or the other). A Fame row shows once fame is above 0. |
| One channel (`channel`)        | How it is going (audience, best, earned so far, chart place, what is in fashion, paying readers), **effort** (light, regular, heavy), **price** for a newsletter, leave a group, and close it (asks first).                                                                                                                                                                             |
| Start a channel (`newChannel`) | Two steps on one screen: a platform with what getting set up costs, then what to make there. A category that cannot be started says why (already have one, not enough money, too many).                                                                                                                                                                                                 |
| The meeting card               | `MeetingCard`: who, in a phrase ("a recording artist, well known"), where it happened, and the six things to do. Flirt is on the card but greyed with a reason when it cannot be done. The answer comes back as the usual `OutcomeCard`.                                                                                                                                                |
| Activities                     | The Social Media row is open (it said "Not built yet" for ticket 0708).                                                                                                                                                                                                                                                                                                                 |

## How it is built

- **Pure functions, then a thin store.** `stores/fameActions.ts` holds every verb as a function from a
  state to a state and the card that answers it (`applyCreatorAction`, `applyFameWork`,
  `applyConnection`, `applyMeeting`). `gameStore.tsx` has one shared `commit` and four actions
  (`creating`, `doFameWork`, `connectWith`, `meetThem`). The writing the engine already does goes on the
  timeline, the Life feed picks it up, and the game saves after each.
- **A refusal is a card, in words.** "You need $600 for that, and you don't have it." One table
  (`refusalText`) turns the engine's refusal kinds into sentences; a refusal never goes to `saveError`.
- **Derived, not stored.** The meeting is `encounterFor(state)`, a fixed draw for the year, so it stays
  on the table until answered and reloading can neither lose nor repeat it. Offers are the same.
- **The card's place in the stack.** It waits behind a pending decision, an answer and a breakdown, and
  sits under the graduation notice so an earned milestone is read first.
- **View helpers** (`screens/fameView.ts`) say things as a person would: the exact percentage, "In the top
  100", "Comedy: cooling off".
- **Hours are not shown** (spec 661). Effort is described in words only.

## Tests

- 33 in `stores/fameActions.test.ts`: every verb and every refusal on real states from the real engine
  (rolls swept by generation or channel id until each outcome has happened, with the count of cases
  that reached an assertion asserted).
- 13 in `screens/fameView.test.ts` (written-out tables), 17 in `FameScreens.test.tsx`, 31 in
  `SocialMediaScreen.test.tsx`, 18 in `components/MeetingCard.test.tsx` (the card, when it appears, the
  Fame bar and its place on the Life screen), 7 in `root/FameWiring.test.tsx` (the Activities door,
  and that every new route is in the shell's table).
- Mobile went from 81 tests to 200.
- **Sabotage:** 170 mutations across the logic and the screens. 140 were caught first time, 24 gaps
  were closed with new tests (untested copy, defaults and boundaries, a fixture that never reached the
  branch), and 6 are equivalent: an unreachable fallback string (`wrote`), whole-dollar rounding of
  values that are always whole (`dollarsText`), an unreachable category-name fallback (`trendLine`),
  an age guard that only matters for a child with a channel (`SocialMediaScreen`), a React `key`, and
  an alive-check the engine repeats (`MeetingNotice`).

## What the tests found

- **The words for a refusal collided** (13.132). Two engine unions both have `tooYoung`: a channel
  needs an age, a flirt does not. The first table said "You have to be 14 to start one here" on a
  twelve-year-old's flirt button. Caught by rendering the card for a child.

## Findings

**77. The meeting cannot be postponed.** It shows over whatever screen the player is on and the only
way off it is one of the six answers (ignoring is one). That matches the decision card, but a player
in the middle of something has no "later". The meeting is on the table until answered and lost at the
year's turn, which is a fixed draw for the year.

**78. Collaborate, invite and endorse choose for the player.** The engine takes a target channel or
business and the screen does not ask, so it is always the biggest channel (or the first business).
Add a picker if a playtest finds a player with two channels or two businesses wants to choose.

**79. The Fame bar is on the Life screen only**, as asked. Every other world shows the seven stats and
not fame. A player in Career or Assets does not see it.

**80. A channel shows what it has earned in all, before costs, and not what it earned last year.** That
is the only figure the channel stores. A year's income is in the ledger rows, which no screen shows by
channel. A per-year figure would be new engine state.

**81. Creator hours are hidden.** Spec 661 keeps the workload invisible, so the effort rows say
"Takes a lot of your week", not hours. A player cannot see that four channels at heavy effort is a
second job.

**82. Nothing shows the 0706 events or the 0705 history.** An event is one line on the timeline
(finding 72), and the Fame screen lists the people you know now and not everyone you have met.
