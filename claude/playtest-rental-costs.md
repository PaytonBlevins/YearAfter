# Playtest A7 — visible rental costs

Payton authorized the next batch on 6 October UTC. Branch
`feat/playtest-rental-costs` follows PR #5. The claim preceded code in local
commit `201b8cd`; its equivalent claim is also published on the branch.

**Spec sections:** 145–160 (rental flow and landlord costs), 849–878 (owned
property screens). **Allowed files:** rental and owned-property screens,
component tests and notes. No engine, store, save, balance, content catalog,
CORE_RULES or approved-decisions changes.

## What changed

The rental flow already exposes the engine's costs, but mixed monthly rent and
mortgage payments with annual upkeep, tax and agent fees. Both the pre-rental
preview and an existing rental now identify rent as gross and show expenses
on a monthly basis. Tax and upkeep remain one whole-property amount because
that is what the contract provides; annual totals remain visible as context.
Mortgage payments retain the existing monthly figure. Agent fees show monthly
and annual estimates at current occupancy.

The pre-rental preview shows rent after property costs assuming full occupancy,
without an agent. Existing rentals show the projected result at quoted rent and
current occupancy, with a plain shortfall message when it is negative. Copy
explains property costs, empty units, missed payments and income tax. The owned
Homes summary also labels rent gross. Existing rental commands are unchanged.

This completes A7's **visibility** option independently of B15. It does not make
rentals more profitable, change advertised rent, or change property expenses.
B15's pricing and return measurement remain Agent A's work.

## Contract limits

`economicsOf` is a static estimate: quoted rent times currently occupied units,
minus the existing mortgage, combined upkeep/tax and agent fee. It does not
forecast future vacancy or missed rent. Its quote also does not substitute
stored fixed commercial lease rents. The screen says **quoted rent**, **projected**
and **before income tax**; it must not be treated as actual collected profit.
Commercial lease accounting remains a separate engine/screens finding.

## Tests and sabotage

Ten new component tests exercise real screens and real rental economics with
owned-property fixtures; only native hosts and store/navigation hooks are
mocked. They cover gross labels, $800 monthly versus $9,600 annual whole-property
costs, full-occupancy preview, partial occupancy, agent fees, mortgages, losses,
positive results, rent-out/rent/agent commands and the owned-property summary.

All ten independent mutations were caught:

| Mutation                                                         | Result |
| ---------------------------------------------------------------- | ------ |
| Annual upkeep labeled monthly                                    | caught |
| Gross label lost                                                 | caught |
| Full preview ignores costs                                       | caught |
| Whole-property upkeep charged per unit                           | caught |
| Annual agent fee labeled monthly                                 | caught |
| Negative warning hidden                                          | caught |
| Rent-out dispatch lost                                           | caught |
| Projection uses full occupancy for a partially occupied property | caught |
| Mortgage omitted                                                 | caught |
| Owned-property gross label lost                                  | caught |

None missed. Each mutated source was restored with SHA-256 checks. No engine
or engine tests were mutated. All 52 mobile tests pass. Native-device layout
and tapping remain pending. Final `pnpm verify` passes all 15 typecheck and
15 test tasks (2,036 tests), then fails on the same nine generator/catalog
mismatches, with output identical to untouched main `5330478`. The validator's
vehicle-mods side effect was restored. Changed-file formatting passes. Existing
unrelated global Markdown formatting failures remain outside this batch.

## Review order

Merge PR #3, #4 and #5 before this batch. All target main; later branches include
preceding unmerged commits. Remaining screen notes require inputs/contracts:
A1 (0705/0706), A3 (B1), A5 (specific wording), A10 (spec 20 decision). B15 remains
open for rental profitability, and other rules/B items remain Agent A's work.
