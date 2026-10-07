# Playtest P1 — business rescue choices

Built by Agent B on `feat/playtest-p1-business-rescue`, against `origin/main` `beff25a`.
Payton authorized P1 after the PR #10 rebase report. PR #10 remained unmerged on this base;
its purchase-payment commands are independent of annual business settlement. P2 is not started.

## Contract and decisions

Brief: `playtest-rules-brief.md`, P1 / B1, behind A3's business warnings. Relevant spec:
`MASTER_SPEC.md` sections 393/398/400/404 (management and dashboard), 725–770 (meaningful
questions without popup overload), 818–827 (death/continuation without estate chores),
1043–1059 (balance measurement and absolute reconciliation), 1060–1066 (protected
contracts), 1078–1094 (ledger truth), 1108–1140 (save migration and seeded RNG), and
684–696 (family continuity). Payton's explicit choice overrides the old automatic-rescue
policy in 0603/0604; it does not retune their economic model.

Payton answered the two product questions before implementation:

- One annual review contains every affected business, with a separate inject-or-close choice.
  Answering one keeps the same review open for the others. There is no fifth rescue card for
  four businesses, and no dismissal that lets time advance.
- If the owner dies in that year, troubled businesses wind down without an injection. Lenders
  get paid before the estate; remaining business debt stays owed. Healthy businesses can pass
  to an adult heir under the existing continuation choice.

No balance numbers changed. The rescue retains the old trading hole plus half the normal
working reserve. A loan-only shortfall asks for the payment less the positive cash already in
its till, without adding a working reserve it didn't previously require. When both apply,
the quote combines them without counting the same cash twice. A rescue uses bank cash only;
credit-financed rescue is not part of this ticket.

## What ships

- `runBusinessesYear` settles healthy businesses normally, paying their lenders from their own
  tills. A trading deficit **or** an unpaid loan payment holds that business for review. Neither
  affordability nor the legacy `available` measurement input causes a personal withdrawal or
  an automatic closure. No owner draw is paid from a business awaiting rescue.
- `businessRescue` stores the year and unresolved cases. Each case has the total contribution,
  the full missing loan payment, and the already accrued and paid loan states where applicable.
  The systemic `business.rescue` decision goes first in the pending queue and prevents another
  systemic offer that year. Other pending questions survive every rescue answer.
- `injectIntoBusinessRescue` debits the actual quote, updates the till and invested cost,
  records injected/repaid money, replaces the loan with its already calculated paid result,
  and resolves only that case. It draws no RNG and accrues no more interest. Exact available
  cash is accepted; a cent less refuses without changing state. Stale year, business or loan
  quotes refuse. `declineBusinessRescue` runs the existing closure path.
- Closure subtracts a negative trading till from fittings proceeds before the lender is paid.
  The lender is paid first; the owner receives only the residue. Unpaid debt remains attached
  to the closed business id and becomes household debt in subsequent living years. Ordinary
  selling/closing also prunes the affected review case so the player cannot be trapped by a
  business that has already gone.
- On death, actual annual advance winds down troubled businesses, retains closure records and
  respects the seven-line annual feed budget. At continuation, outstanding debt of closed
  businesses reduces **all liquid inheritance**, including other estate sale proceeds, before
  the heir receives it. Healthy inherited businesses still carry their own lenders.
- Mobile uses one scrollable review, names each business, shows exact cash needed and bank
  cash, explains lender priority and debt left over, and disables unaffordable injections.
  Refusals use plain language. Existing business warning screens now describe the choice;
  their repeat-year calculations remain explicitly hypothetical.

Protected contracts changed within Payton's P1 authorization: annual settlement/pending
integration, business exit and closed-business estate accounting, and save format. Integer
cents, deterministic annual draws, reconciliation and the pending advance barrier remain.
`TICKET` remains `0708` in both copies. `approved-decisions.md` is unchanged.

## Save v44

Claimed in a separate commit before implementation. Adds optional `businessRescue` to state,
save, serialization and restore. Migration v43→v44 copies the legacy save without generating
a review or consuming RNG. Current-save validation rejects orphaned decisions, stale years,
duplicate/missing business ids, empty/oversized reviews, malformed amounts and mismatched
loan balances, principals, products, terms and quoted paid states. The negative till is
preserved through a JSON round trip, and either answer is identical after reload.

## Measurement before and after

Throwaway TypeScript harnesses ran outside the repo. Reproduce: use all 31 business types,
300 owners each, opening year 2030, luck 1, stat 50, no other job, id
`biz:2030:${type.id}:${i}`, seed `p1-baseline-${i}`. Run 2031–2035 with markets normal,
recession, strong expansion, normal, severe recession; household support budget each year is
half that type's startup price. This is an isolated business cohort, not a whole-life income
forecast. After P1, run the same annual inputs and answer real commands, injecting only if
affordable or always declining. Each answer reconciles the real ledger.

| Policy                                | Owners | Survive five years | Survival |                        Owners ever asked |   Review years |
| ------------------------------------- | -----: | -----------------: | -------: | ---------------------------------------: | -------------: |
| Main baseline: automatic help/closure |  9,300 |              7,636 |   82.11% | Not asked; 1,878 received automatic help | Not applicable |
| P1: rescue when affordable            |  9,300 |              7,636 |   82.11% |                           3,437 (36.96%) |          4,078 |
| P1: decline every rescue              |  9,300 |              5,863 |   63.04% |                           3,437 (36.96%) |          3,437 |

Baseline automatic help reached 20.19%; the new review also reaches owners whose businesses
would previously close for lack of money, explaining the higher share. All **7,515** measured
answers reconcile. Loan shortfalls and arrears are separately covered by literal loan tests
and full annual-advance tests. There is no calibration to conceal a survival change.

0604 recorded 78.7% five-year survival against the BLS 51% comparator. This harness does not
replicate its luck/population mix; the valid before/after comparison is 82.11% against
82.11% on this identical cohort. Declining every rescue measures the player's exit policy,
not a new forced failure rate.

## Verification

- All **2,598 tests** pass (868 simulation, 126 persistence, 233 mobile); all 15 package
  typechecks pass. P1 adds 15 engine, 23 save and 2 store-driven UI tests. Existing rescue
  tests now require explicit consent; none were deleted or loosened. One older migration
  test's save-version assertion is updated from 43 to 44.
- Full `pnpm verify` reaches content validation and exits with the **same nine baseline
  reproducibility mismatches**: activities, advice, auctions, businesses, events-childhood,
  homes, renovations, valuables and vehicles. A fresh `git archive origin/main` at `beff25a`
  reproduced exactly those nine failures. Independently generating them in that throwaway
  archive produced identical parsed JSON for all nine: the difference is byte formatting.
  No catalog reformat is committed; the validator's incidental vehicle-mod rewrite was restored.
- Global `pnpm format:check` flags **22 unchanged historical Markdown files**. Prettier checks
  every P1 changed/new file successfully. `git diff --check` passes.
- GitHub's connector reports no returned Actions runs/statuses for base `beff25a`; its run
  reader only includes pull-request-triggered runs. A green main Actions run is not claimed.

### Sabotage verification

Twenty separate mutations were tested against the P1 engine/save/UI tests. Each changed one
uniquely matched production expression; backups were verified before mutation and source
hashes verified after restoration. P14 was rerun with an explicit payload-presence assertion
so deleting the remaining review fails an assertion rather than only a property access.
**All 20 caught; none missed.**

| Mutation                                                  | Result |
| --------------------------------------------------------- | ------ |
| P01: losses never raise a review                          | caught |
| P02: ignore an unpaid loan                                | caught |
| P03: draw owner money automatically                       | caught |
| P04: double the working buffer                            | caught |
| P05: pay the owner while rescue is pending                | caught |
| P06: skip full-year review integration                    | caught |
| P07: never wind down on death                             | caught |
| P08: forgive trading loss on closure                      | caught |
| P09: pay no lender on exit                                | caught |
| P10: rescue is free to the owner                          | caught |
| P11: loan payment stays in the till too                   | caught |
| P12: injection does not raise cost basis                  | caught |
| P13: reject exact available balance                       | caught |
| P14: one answer discards all other cases                  | caught |
| P15: forgive debt of a closed business at inheritance     | caught |
| P16: serialize without pending rescue payload             | caught |
| P17: accept any malformed rescue save                     | caught |
| P18: enable unaffordable injection in UI                  | caught |
| P19: UI injection closes instead                          | caught |
| P20: do not protect serviced business loan from household | caught |

Allowed files: simulation `businesses`, `business-rescue`, `business-rescue-state`, `advance`,
`decide`, `game-state`, `continue`, their tests and barrel; persistence schema, migrations,
serialization, rescue validation and tests; mobile review component/tests, Shell, store and
business warning copy/tests; this doc, CLAIMS, HANDOFF, backlog, roadmap and CORE_RULES.
Economic constants, other catalogs, other engines, approved decisions and ticket gates are untouched.

## Open items

- Native device checks are pending: no emulator or attached device is available in this
  environment. The mobile review is exercised through the real game store and save repository.
- General personal-debt/will/division rules remain 0508 work. P1 only prevents closed-business
  debt from being forgiven in liquid inheritance; it does not build an estate screen or carry
  an insolvent estate's unpaid personal obligations into the heir's own ledger.
- The Claude Project `project_write` capability is unavailable here. Repo docs are updated;
  Project mirroring is not claimed.
- P2 waits for Payton's explicit go-ahead.
