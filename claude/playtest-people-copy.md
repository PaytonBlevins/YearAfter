# Playtest A5 — people-screen copy; life events deferred

Payton instructed Agent B to leave life-event wording until last and begin the
next available batch on 6 October UTC. Main remains `5330478`; waiting engine
contracts have not landed. This pass follows PR #7 on
`feat/playtest-people-copy`. The claim preceded code in local commit `7cbc281`,
with an equivalent claim published on the branch.

**Spec sections:** 771–785 (NPC memories), 786–795 (contextual explanations),
839–848 (relationship UI). **Allowed files:** PersonScreen, PeopleScreen,
LoveScreen, their component tests and notes. **Protected areas touched:** none.
No engine, social mechanics, store, save, balance, content catalog, event,
timeline or saved-memory wording changes. Life-event wording is explicitly last.

## What changed

Person's unavailable friendship and romance rows explain that this year's
interaction limit has been used and say to try again next year. A spent light
interaction names the person; a spent heavy interaction names the shared
once-a-year interaction allowance. Existing eligibility checks, callbacks and
disabled controls are unchanged. The screen no longer describes absent people
in terms of save internals. The past-contact explanation says their memories
remain available; the stored memories themselves are rendered verbatim.

People's empty-friends row now directs the player to open somebody's page to
get to know them. Its footer explains yearly limits and keeping in touch,
replacing “as often as you like,” which conflicted with the disabled rows.
The empty school/social screen uses a direct sentence.

Love's age gate, used-dating-app reason, crush heading note and empty state use
direct wording and contractions. Existing romantic stages, partner history,
contact grouping and availability logic are unchanged. Interaction labels and
blurbs supplied by the social package, and all event/outcome prose, were left
alone.

## Acceptance and verification

Nine new component tests exercise the real screens and social APIs; only native
hosts and store/navigation hooks are mocked. They cover contacts guidance and
navigation, empty contacts, both annual-limit branches, disabled callbacks,
available friendship/romance commands, preserved saved memories, retained past
contacts, missing contacts, dating age gating and adult meeting guidance.

The existing A4 acceptance test's refusal regex was updated to the new words;
its disabled-action and missing-callback assertions were preserved. This is a
copy expectation update, not a weakened eligibility check.

| Mutation                                        | Result |
| ----------------------------------------------- | ------ |
| exhausted-action timing removed                 | caught |
| blocked friendship becomes actionable           | caught |
| friendship callback lost                        | caught |
| romance callback lost                           | caught |
| saved memory text replaced                      | caught |
| people guidance promises unlimited interactions | caught |
| person navigation lost                          | caught |
| adult meeting explanation removed               | caught |

All eight mutations caught; none missed. Sources restored with SHA-256 checks.
A TypeScript AST comparison confirms the three screens changed only text;
identifiers, numbers, expressions and control flow are preserved. All 81 mobile
tests pass. Final `pnpm verify` passes all 15 typecheck and 15 test tasks
(2,065 tests), then fails on the same nine generator/catalog mismatches with
output identical to untouched main `5330478`. The validator's vehicle-mods
side effect was restored. Changed-file formatting passes; unrelated global
Markdown formatting failures remain outside this batch.

## Review and next work

Review after PR #7, following merge order #3 → #4 → #5 → #6 → #7 → this batch.
Native-device layout and tapping remain pending. A5's life-event wording is
explicitly deferred until last; this screen pass does not mark it complete.
A1 still waits for 0705/0706, A3 needs B1's business-failure contract, A10 needs
a decision against spec 20, and purchase-card choices need Agent A's payment
contract. All rules/B items remain Agent A's work.
