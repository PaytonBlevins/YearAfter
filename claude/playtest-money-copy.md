# Playtest A5 — spoken money and business copy

Payton selected the money/business pass on 6 October UTC, then asked to resume
the build. Branch `feat/playtest-money-copy` follows PR #6. The claim preceded
code in local commit `4ef7c3f`; its equivalent claim is published on the branch.

**Spec sections:** 25–28 (credit cards), 1126–1136 (automatic scheduled
payments), 849–878 and 1331 (business dashboard), 1857 (loan types).
**Allowed files:** CardsScreen, LoansScreen, BusinessesScreen, their component
tests and notes. **Protected areas touched:** none. No engine, store, save,
balance, content catalogs, CORE_RULES or approved-decisions changes.

## Requirement and result

Make the existing money/business explanations and refusals easier to understand
in one read. Preserve amounts, thresholds, choices, eligibility, disabled
controls and callbacks. This is one concrete A5 batch, not completion of all
commentary across the game.

| Before                                       | After                                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| “Dearer… thins every sale”                   | Higher prices bring in more per sale, but fewer customers buy; lower prices attract more customers but bring in less per sale |
| “A second door brings in more custom”        | Another location brings in customers and needs its own lease and staff                                                        |
| “Cash in the till” / “Doors open”            | Business cash / Open locations                                                                                                |
| “A manager hires and lets go”                | Let a manager handle staffing                                                                                                 |
| “Wants … a year coming in”                   | Requires at least the product's actual yearly income threshold                                                                |
| “You have four running already”              | You already have four active loans                                                                                            |
| “You cannot put up the deposit”              | You don't have enough cash for the deposit                                                                                    |
| “The yearly payment comes out with the rent” | Your scheduled payment comes out automatically each year; you can choose to pay extra                                         |

Card refusals use contractions and name the credit, income, deposit or total
credit limit involved. Loan refusals name the loan, education cost, existing
debt or investment security involved, retaining the per-product credit and
income thresholds. Held-loan copy names payments and years remaining.

Business explanations name profit, staffing limits, customer demand, prices and
locations directly. Startup-payment copy acknowledges the existing choice of
cash and a purchase loan; it no longer says the entire startup cost always
comes from cash. The income, demand and financing rules are unchanged.

## Acceptance and checks

Twenty new mobile component tests cover all six card refusal reasons and nine
loan refusal reasons, disabled actions, card age gating, successful application,
loan amount selection, automatic payment explanation, startup financing copy,
price/location explanations and the staffing toggle. Fake lender responses
exercise screen branches; they do not substitute for underwriting tests. Real
business fixtures and real business calculations are used for business screens.

Sabotage first exposed a weak fixture: the initial loan product required zero
income, so replacing its threshold with zero was missed. The fixture now uses
a product with a nonzero income requirement and catches that mutation. This
finding is recorded rather than counting the initial run as a success.

| Mutation                                | Final result |
| --------------------------------------- | ------------ |
| card deposit refusal loses reason       | caught       |
| card refusal becomes actionable         | caught       |
| card application dispatch lost          | caught       |
| loan requirement uses wrong income      | caught       |
| loan credit requirement lost            | caught       |
| loan quarter choice borrows full amount | caught       |
| business startup copy implies cash only | caught       |
| business price tradeoff reversed        | caught       |
| business manager callback lost          | caught       |

Final run: all nine mutations caught; none missed after the fixture correction.
Mutated files were restored with SHA-256 checks. A TypeScript AST comparison
confirms the three screens changed only text, preserving identifiers, numbers,
expressions and control flow. All 72 mobile tests pass. Final `pnpm verify`
passes all 15 typecheck and 15 test tasks (2,056 tests), then fails on the same
nine generator/catalog mismatches with output identical to untouched main
`5330478`. The validator's vehicle-mods side effect was restored. Changed-file
formatting passes; unrelated global Markdown formatting failures remain outside
this batch.

## Review and remaining scope

Review after PR #6 (merge order #3 → #4 → #5 → #6 → this batch). Native-device
layout and tapping remain pending. Additional event/social commentary remains
open under A5; this pass does not claim to cover those sources.

A1 still waits for 0705/0706, A3 needs B1's business-failure contract, and A10
needs a decision against spec 20. Purchase-card selection still needs Agent A's
payment contract for all eligible purchases, including future vacations, up to
available credit. No new payment or business-failure mechanics were implemented.
