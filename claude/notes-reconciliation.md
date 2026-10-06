# Existing notes reconciliation

Agent B, 6 October 2026. Reviewed all 32 existing `claude/*.md` files against
`origin/main` at `d64f507`. This is a documentation pass, not a new calibration
or an independent rerun of the engine mutation audit.

## What changed

- Updated the handoff and roadmap to the shipped 0605/0606 engines, save v40,
  and the current division of work. The 0605 screen patch is prepared but
  unmerged; latest-engine integration and device checks remain open. The 0606
  screens remain open.
- Kept historical measurements and test totals as historical snapshots. Added
  later follow-ups to older reports where subsequent tickets delivered their
  proposed next work; retained unresolved gaps rather than declaring them done.
- Restored roadmap findings 34 and 35 from the business measurement note and
  put existing finding identifiers in order without renumbering them.
- Corrected factual descriptions: saves contain live RNG stream snapshots,
  cards already cover annual cash shortfalls, and business interest reduces
  the draw even though losses do not offset salary tax.
- Reconciled the private-deal description with the engine: offer probability
  is per slot, $500 rounding applies to caps, eligibility includes the public
  portfolio but cheques spend cash, and successful lenders receive interest
  in the maturity year. Distinguished 40 combined mutation survivors from 42
  per-file coverage misses; Agent A's subsequent fixes remain attributed to A.
- Corrected the business baseline's prose to match its unchanged table: 62%
  hold $25,000 at 25–34; about four in five do so from 45 onward.

No product values, approved decisions, engine bodies, save schema, catalog
data, `specs/CORE_RULES.md`, or root `roadmap.md` were changed.

## Evidence checked

| Description                                        | Source                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save version and live RNG state                    | `packages/persistence/src/save-schema.ts`, `packages/persistence/src/serialize.ts`, `packages/simulation/src/rng/rng.ts`, persistence continuation test |
| Automatic card borrowing for annual shortfalls     | `packages/simulation/src/advance.ts`                                                                                                                    |
| Private offers, caps, placement, maturity interest | `packages/finance/src/private-deals.ts`, `packages/simulation/src/deals.ts`                                                                             |
| Screens remain unmerged                            | Investments, Homes and Rental screens on `d64f507`                                                                                                      |
| Deferred business types                            | Business catalog generator and 0605's explicit exclusions                                                                                               |
| Findings 34–35 and baseline percentages            | `claude/v006-business-measurement.md`                                                                                                                   |

## Still needs Payton's input or access

1. **Claude Project reconciliation and mirroring.** There is no available
   Project connector or local copy of `claude/build-status.md`. Repository
   reconciliation is ready; Project-only notes and mirroring remain pending.
   Please supply those notes or a supported way to access them.
2. **Missing referenced notes.** This checkout also lacks
   `claude/event-writing-rules.md`, `claude/0212-death-and-continuation.md`,
   `claude/0401-reachability.md`, `claude/0403-catalog-expansion.md` and
   `claude/v004-career-measurement.md`. Their references were retained; their
   contents were not reconstructed. Are these Project-only copies?
3. **Protected planning line.** `claude/approved-decisions.md` still ends with
   a next-ticket reference to 0201. The file was left byte-for-byte unchanged
   because the handoff explicitly protects it. Its planning line is stale,
   not evidence that its product decisions should be reopened.
4. **Previously flagged test deletion.** The handoff's question about the
   absent `packages/finance/src/investments.test.ts` remains unanswered; this
   pass neither restores it nor assumes the deletion was intentional.

Open product and calibration findings in the roadmap remain open. Proposed
0605b lending/investment businesses are not approved work. The next Agent B
implementation work is 0605 screens, then 0606 screens, under the handoff.

## Validation

- Documentation-only scope check passed. `approved-decisions.md` is identical
  to `origin/main`; historical measurement-table cells are unchanged, and
  roadmap findings 1–46 each occur once.
- Prettier was run only on changed Markdown notes; `git diff --check` passed.
- `pnpm verify`: typechecking and all 1,535 tests passed. Content validation
  failed on nine catalog/generator comparisons: activities, advice, auctions,
  businesses, childhood events, homes, renovations, valuables and vehicles.
  Running the validator in a separate untouched `origin/main` worktree at
  `d64f507` reproduced all nine identical failures. No catalog repair was
  included; the validator's vehicle-mods generation side effect was restored.
