# Playtest rule changes and "return to this" — brief for Agent B

**Written 6 October 2026 from a conversation with Payton, addressed to Agent B (Codex). This list is
the only thing you work on until Payton says otherwise.** Do not start 0508 Will & Estate, v0.08
Entertainment & Sports, or any other ticket. Payton chose v0.08 as the next milestone and then
asked for this list to be cleared first, so v0.08 waits (its proposal is in
`claude/v008-entertainment-measurement.md`; do not act on it).

## Your role, and what Payton has authorized

You are **Agent B**. Payton has assigned you this whole list, **including the engine work**. For these
items, and only these, he authorizes you to: change simulation, finance, careers and content engines;
change balance numbers; add save fields, a save-version bump and its migration; add CORE_RULES
lessons; and edit `approved-decisions.md` where a decision below says to. This overrides the limits in
HANDOFF §0 and §8 for P1–P16. It is the same kind of exception he gave you for PR #10 and
`feat/manual-social-posting`. It does **not** extend to anything outside this list, and it does not
authorize editing `TICKET` (see below).

Each item is built end to end: measure first, engine, save, calibration, the screens the player needs
to use it, tests, sabotage-verification (you have done fifteen mutations before; keep doing it), your
own doc, a roadmap note, CORE_RULES lessons, then `pnpm verify`. Follow the loop in `claude/HANDOFF.md`
§5 exactly.

**One ticket at a time, then stop.** After each one, give Payton the short summary (what was built, tests,
what it touches, judgement calls with the value you chose, anything open) and wait for a go-ahead before
the next. He pushes in batches. Where a rule decision is not covered below and is a real product
choice (a number that changes how the game plays, a new screen's shape), **propose the value and ask**,
as you did with the posting limits. Do not decide it silently.

No other agent is building on this list at the same time. Agent A (a Claude session) is paused on it, and
v0.08 waits. If Agent A is asked to do anything on these files in the meantime, `CLAIMS.md` shows it.

## Read these first, in this order

1. `specs/AI_CODING_INSTRUCTIONS.md`, `specs/ARCHITECTURE.md` (binding)
2. `claude/approved-decisions.md` (settled; its "Playtest rules work" section is this brief's decisions)
3. `claude/HANDOFF.md` §2–§9 (layout, per-ticket loop, git, the Claude Project)
4. `claude/playtest-backlog.md` (the notes in Payton's words, sections A, B and C)
5. `claude/roadmap.md` (findings 12, 13, 16, 21, 28, 31, 32, 33 and 44 are the ones named below)
6. The ticket doc and `CORE_RULES.md` entries for the area you touch (grep by topic; the newest
   lessons are 13.132 and 13.133)
7. `specs/MASTER_SPEC.md` for any line a note cites

State of the build when this was written: `origin/main` after the merge of your three
branches on top of 0707 and 0708. **Save v43.** Mobile has 231 tests and the whole repo passes
`pnpm verify`. `packages/finance/src/summary.ts`'s `TICKET` and the validator's copy are
`'0708'`: **leave them alone**. They gate "not built yet" labels by ticket number and v0.08 will
claim 0801 next. Name your tickets **P1, P2, ...** below, and their docs `claude/playtest-pN-name.md`.

## Decisions Payton made (settled, recorded in `approved-decisions.md`)

1. **B1, a failing business: ask each time.** When a business is about to fail, the player gets a
   warning card with a plain account of what it will cost and chooses to put money in or not. If
   they decline, the business closes or is sold. The automatic draw on the player's bank (0603)
   goes. You built the warning **screens** on `feat/playtest-business-warnings`; they
   describe the existing rule and mark their figures as scenarios. Now build the commands,
   the pause before actual failure, and the real failure, and update those screens to match.
2. **Finding 32, living costs: fix the curve and add lifestyle tiers.** First make the default
   sensible, then let the player spend more on purpose. Payton has accepted tiers, which
   **overrides spec 1166's removal of a tier selector by name**; record it in the doc and in
   `approved-decisions.md` when you ship.
3. **PR #10 is merged first**, before P1 (see below).
4. **Order is the backlog's own** (below).

## First job, before any ticket: merge PR #10

Branch `feat/purchase-payment-choices` is your engine and screens for paying with a chosen card
on every purchase (backlog A13 and B17; findings 24, 26 and 31 are related). It is PR #10. Rebase it onto `origin/main` (or merge `main` into it). It conflicts with
`feat/manual-social-posting`, now on `main`:

- `packages/simulation/src/creators.ts` (`openChannel`): **keep free account creation** (opening an
  account costs nothing, with no ledger row). Drop PR #10's signup payment choice for channels.
  Other purchase payment choices stay.
- `packages/finance/src/index.ts`: keep both export lines.
- `claude/CLAIMS.md`: keep both rows.
- Mobile: `NewChannelScreen` (0708) already shows no cost for a free account. Check it after the merge.

Run `pnpm format:check` and the full `pnpm verify`, and fix anything the combination broke without
weakening a test. Update the PR, give Payton the summary and **stop**. Do not start P1 until he says go.

## The tickets, in order

Each line says what the note asks, what to check first, and what to measure against. "Unchecked"
means Payton's note has not been compared with the code; **read the code and measure before building,
and correct the note if the code says something else.**

**Group 1, apply the decisions**

- **P1. A failing business (B1, the rescue choice behind A3's screens).** Commands for injecting money or declining; a pending
  decision (use the systemic-decision machinery of 0402/0405) raised when the settlement would
  overdraw the till and the loan cannot be serviced; declining runs the existing close or sale path
  (the lender is paid first, 0603). Decide where it fires so a player holding four businesses does
  not get four cards a year, and say what you chose. Heirs and a death in the same year need an answer.
  **Measure** the five-year survival it was changed from (78.7% at 0604, BLS 51%), the share of owners
  who ever see the card, and that the ledger still reconciles. Save change likely.
- **P2. Living costs: the curve and the tiers (finding 32, with 33).** Target: $250,000 a year, single, no
  house, no children, should not spend about $150,000; roughly $75,000–$90,000 was the sketch in the
  roadmap, but the target is whatever the net-worth-by-age check says (below). Then
  Frugal / Comfortable / Lavish, with a default that follows income only mildly and an effect the
  player can see (a nicer place or a better-feeling year). Fix finding 33 here: the car's yearly cost is
  a dollar amount scaled to the car's real running cost, not 8.5% of the whole living bill
  (`VEHICLE_SHARE`). **Measure** net worth by age against the two samples that tuned
  `MARGINAL_SPEND` (0303/0304; 0502 and 0504 each had to retune, CORE_RULES 13.88 and 13.90),
  and also against finding 19's note that monthly outflow counts income tax. Re-measure
  happiness against 0308b's cash-buffer finding. Save change likely.

**Group 2, economy and feel**

- **P3. Social media success rates (B6, unchecked).** Payton has not played this. Measure what a
  14-and-over life feels like: the share that gets any traction, time to a first paid year, the share
  that reaches a living wage. He wants it more common than real life, "not extremely overinflated" and fun.
  0706 already added a per-platform rank lift (finding 69). Your `feat/manual-social-posting` made
  small audiences earn **less** fame (1,400 followers is 0, 10,000 is 3) and posts manual; Payton asked
  for that on 6 October, so **do not undo it**. If the numbers are low, the dials are findings 69 and 64's
  `fameTarget`; propose the values and ask before moving anything you set there.
- **P4. The economy matters less to a business (B5).** Keep some effect, tone it down. 0604 records the effect;
  re-measure survival and the swing in profit.
- **P5. A degree should point at some jobs, and twelve listings (B7 with finding 21).** At least a couple of each
  year's listings fit what the player studied or trained for. `LISTINGS = 6` in `careers/openings.ts`
  becomes 12. 0401's reachability numbers and its starvation guards were measured at six, so
  re-measure jobs seen in a life and a passive life's time to its first job.
- **P6. Odd jobs for adults, and a part-time job in high school (B8 unchecked, B9).** Measure how often
  an adult is offered an odd job today (gigs, 0210). Then give a teenager a part-time job. Mind the
  workload and school-performance effects (0208, 13.66).
- **P7. Investments and advisors (B11, B12, finding 28).** Investments a little less volatile; advisors that beat
  doing it yourself on the measured population and are softer and more realistic: a buffer that scales with
  what the life costs, a share of the rest and not all of it, `SLICE = 0.34` is a third on one name, and the
  idle-cash line stays quiet when a goal is in sight. 0308b found no cash buffer means happiness 20
  against 78; 0309 measured advisor returns. Check both.

**Group 3, content that grows catalogs**

- **P8. A bigger watch catalog (B13).** More references and models per maker (Rolex, Patek, F.P. Journe, Tissot,
  Citizen, Omega, Vacheron Constantin, Tudor and more), mixed and "not too crazy". Fictional analogues
  with recognisable spirit, as 0506 did (spec 1043–1059).
- **P9. More renovations (B16).** Pool, sauna, infinity pool, basketball court, patio, game room, private study,
  hedge maze, front-yard fountain, a few more. Prices, upkeep, value and happiness effects, a size limit by
  home. Lives in 0506's catalog. Save likely.
- **P10. Iced-out watches (B14).** Buy one, or have yours iced out. It lowers the value of watches that normally
  lose by it and raises the value of ones that would not normally get it (a G-Shock). A per-watch effect
  in the catalog and a state field on a held watch. Save change.
- **P11. Manual car servicing (B10).** A yearly choice with a cost and an effect on reliability or lifespan. 0504 and
  0505 own the car model. Save change.

**Group 4, larger model changes**

- **P12. Suppliers pitched one at a time (B2).** Each pitch has a quality, a price point and a loyalty level, **five new
  searches a year**. You already rewrote the supplier screen copy (A2) to explain the three levels, so
  keep its wording where it still fits. Save change.
- **P13. Agent levels (B4) and a check on B3.** Real estate and other agent businesses hire a high, mid or low level
  agent (cost against results). **B3 (player sets the price) is probably already built:** 0601 has a price
  slider (`setPrice`, `PRICE_MIN`, `PRICE_MAX`, shown as a row of taps), and 0602 derives elasticity from
  costs. Check it against Payton's note ("except in broad industries where it doesn't apply, like real estate;
  demand must respond or the player just sets the maximum") and report exactly what is missing. Do not
  rebuild it.
- **P14. Landlords can profit (B15, finding 44).** Property tax and upkeep eat the rent. You made the costs
  visible (A7). Decide the pricing and re-measure landlord returns against 0503's figures (95% let, about 4.7%
  net on value in a managed Ohio duplex).
- **P15. Nobody spends down in old age (finding 12).** Median net worth keeps climbing past 75 (about $500,000
  against about $335,000 in the US). The standard of living has no sense of a shorter horizon. Check how it
  interacts with P2.
- **P16. Partners' earnings (findings 13 and 16, together).** They should not earn a fixed amount for life, nor be
  anchored at $50,000. A real partner runs from about $20,000 to $250,000 and beyond, rises, stalls or
  falls, changes jobs, or stays put, and correlates 0.3–0.4 with the player's own pay.

## Rules that bind every ticket

- Measure first; sabotage-verify your tests; no weakened or deleted tests; no placeholders reported
  complete; no protected-contract change without saying so (CORE_RULES, `AI_CODING_INSTRUCTIONS.md`).
- Reconciliation is absolute (spec 1043–1059): opening cash plus inflows minus outflows equals closing cash.
- Do not reopen `approved-decisions.md`. If a note seems to need breaking one (spec 20, spec 1166, talent
  probability, check-ups), stop and ask Payton.
- Never commit a mass reformat of `packages/content/data/*.json`. If `pnpm validate:content` fails in
  your environment, say which checks fail and compare with CI; do not "fix" it by rewriting catalogs.
  Your last report listed nine mismatches and a vehicle-mod catalog rewrite you restored. On `main`
  with 0708 and your three merged branches, validation passed for Agent A (17 catalog files, 1,484
  content ids), so a difference points at your environment or an unmerged change.
- `pnpm format:check` runs in CI. Run `npx prettier --write` on every file you add or change
  (`.prettierrc`: printWidth 100, singleQuote, trailingComma all).
- Save changes: bump `CURRENT_SAVE_VERSION` in `persistence/src/save-schema.ts`, add a migration that draws no RNG,
  and add round-trip and malformed-shape tests. If two of your tickets could bump the save, say which
  version each holds in `CLAIMS.md`.
- Roadmap: add a row or note for each ticket and a "Found by Pn" finding for anything you decide to leave.
  Mirror every changed doc to the Claude Project (`project_write`).
- Git: a branch per ticket (`feat/playtest-pN-name`), rebase onto `origin/main`, pull request into `main`,
  Payton merges. Do not push to `main`. `TICKET` in `packages/finance/src/summary.ts` and
  `tools/content-validator/validate.mjs` stays `'0708'`; Agent A moves it when v0.08 starts.

## Add your claim before starting

Put a row in `claude/CLAIMS.md` in its own small commit before each ticket, as HANDOFF §8 says. The
only open branch at the time of writing is `feat/purchase-payment-choices`.
