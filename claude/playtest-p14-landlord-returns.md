# Playtest P14 — landlords can profit

Status: Payton authorized P14 after P13 closeout on 8 October local / 9 October
2026 UTC. Separately claimed and published before measurement on
`feat/playtest-p14-landlord-returns`. Refreshed main remains `beff25a`; stacked on
P13 PR #25 and #13–#24. **Measured proposal, pending approval. No production edits,
new save fields or reserved version.** P15–P16 and life-event wording wait.

## Requirement and contracts

P14/B15: property tax and upkeep should not make capable landlords unable to earn
money. Re-measure against 0503's managed Ohio duplex: about 95% of potential rent
collected and 4.7% net operating yield on current value. Reconcile the reference to
roadmap finding 44 rather than assuming its wording proves a loss.

Read playtest brief, approved-decisions, HANDOFF loop/git, backlog A7/B15, 0501,
0503, 0606 and the A7 rental-costs note; inspected actual rental/commercial,
property/mortgage, annual settlement, underwriting, renovation, catalog/generator
and mobile purchase/rental readers. Binding spec 145, 149–151, 157, 160, 849–878,
954–978, 1043–1059 and 1060–1066; CORE 13.85–13.89, 13.106–13.108 and 13.149.

Allowed after approval: finance rent policy/economics and investment-deposit quote,
simulation shared rent readers/underwriting/purchase and tests, existing Homes
purchase choices and Rental flow/store/tests, compatibility checks, own ticket,
CLAIMS/HANDOFF/roadmap and CORE lesson. Protected contracts touched: prospective
rent economics and investment-property mortgage command/quote. A half-deposit
preset explicitly extends the old automatic-deposit behavior for investments;
primary-home financing retains it. No schema change is proposed because existing
mortgage principal/balance/term and letting already store everything needed.

No new property type, free renovation, tax/insurance/HOA subsystem, vacancy-cost
mechanic, mortgage-rate reduction, property-price/appreciation/condition retune,
TICKET change, P15 or life-event wording. Approved-decisions stays settled.

## What the current build actually does

All fifteen kinds can be let. Going rent is derived from current value, catalog
base yield, region index to the 0.7 power and unit count. The six rent steps already
trade price for applicants, turnover and empty time. Managed Ohio duplexes remain
profitable **before mortgage payments**. Two disjoint 200-property/25-year samples
reproduce 0503: 94.67/94.81% of potential rent collected, 4.65/4.69% operating yield.
California is 94.66/94.81% collected and 2.78/2.82% operating yield.

These collection ratios include missed payments, gaps and commercial lease rent
lag; they are not a literal physical-vacancy measure. Commercial tests use the key
`OH`, which falls back to index 1; actual Ohio is `US:OH`, index 0.9. California is
index 1.3733. Do not treat those commercial fixtures as actual Ohio.

Operating expenses are already one whole-property aggregate: taxes, insurance and
upkeep. Condition increases it, and renovations add recurring upkeep. The annual
reader charges opening-value expenses, then collects rent on the updated property
value. Fees are 8% of collected rent. There is no second property-tax charge hidden
inside the letting function. A residential investment mortgage is 7.25%, 30 years,
25% minimum down; commercial is 7.25%, 25 years, 30% down. The loan picker caps its
automatic target at 20%, so investments take their minimum, even with more cash.
They offer mortgage or cash, with no intermediate larger-deposit choice.

The real issue is **early leveraged cash flow**, not universal negative operating
profit. A $475,000 benchmark managed good-condition Ohio duplex, at the going rate
and 25% down, averages about −$3,300/year in its first five years in two new paired
samples. Appreciating rent and fixed debt payments turn its 25-year mean positive.
California is about −$13,200/year initially and remains negative at 25% down over
this horizon. Luxury/estate homes have intentionally low rental yields and are not
ordinary multifamily investments. Vacancy, condition, debt and location still matter.

Finding 44 describes a different commercial **risk-model omission**: vacancy and
turnover do not add separate utilities/leasing bills beyond the aggregate expense.
It does not say the implemented rent cannot cover taxes/upkeep; its original text
warns landlords might be too safe. Adding an insurance bill would double-count a
cost already included and conflict with spec 151's removal of that mechanic.
Keep that omission logged, without reporting it resolved by a rent adjustment.

Rental receipts currently have no separate income-tax row in actual `advanceYear`.
These results are before personal income tax and household bills, not net after
all taxes. Tax policy is not the cause of the observed shortfall and is not changed
here. Existing mortgage rates remain nominal-like in a constant-dollar model
(CORE 13.85 / 0503's open finding); no hidden rate change is proposed.

## External references and limits

[Census Q2 2026 Housing Vacancies](https://www.census.gov/housing/hvs/current/index.html),
read 9 October UTC, reports national rental vacancy of 7.3%. A managed strategy
choosing reliable applicants may do better than a national passive average; this
is only a scale reference, not equivalence to our rent-collection ratio.

[CBRE H1 2026 Cap Rate Survey](https://www.cbre.com/insights/reports/us-cap-rate-survey-h1-2026),
read 9 October UTC, defines cap rates using net operating income after operating
expenses divided by acquisition price, and stresses property/market differences.
Our yield below uses current-value years, excludes mortgage payments, and is not
identical to that transaction cap rate. 0503's historical 5–7% small-multifamily
anchor remains a broad comparison; no claim that every 2026 market earns it.
The proposed 15% adjustment and half-deposit preset are game choices, not forecast
US rent growth or an empirically derived universal deposit recommendation.

## Concrete proposal — approval required

1. **Residential going rents ×1.15.** A single documented finance policy factor
   for the eleven noncommercial kinds, applied through the shared rent calculation
   to quoted rent, applicants, actual annual receipts and lender expected rent.
   Preserve current catalog base yields; do not rewrite a whole generated catalog
   merely to encode one family-wide policy. All four commercial yields remain
   unchanged: they already earn positive operating returns. Existing residential
   holdings use the new prospective rate; old ledger entries are never rewritten.
   Keep the region elasticity, price steps, applicant/leave/gap table, reliability,
   expenses, agent fee, appreciation, condition and mortgage rates unchanged.
2. **A fixed 50%-down investment mortgage choice.** Keep the usual mortgage option
   (25% residential / 30% commercial) and cash purchase. Add a half-deposit option
   only when the purchase purpose is rental/commercial, including a second house.
   It has a bigger upfront cash commitment and a smaller principal/payment; no
   interest discount or money reward. Preserve age/credit, five-mortgage limit,
   principal caps, income/other-debt tests and 43% ceiling. Quote and command must
   share the same policy, reject unsupported/malformed requests, and recheck cash.
   Primary-home financing remains automatic; this is no deposit slider or number
   entry. Show the actual deposit and spoken refusal in the existing expanded
   listing's purchase actions; do not show rental potential or monthly payments
   on a listing. The lower mortgage payment appears in the existing rental flow.
3. **Separate operating return from mortgage cash flow in Rental.** Preserve gross
   rent and the separate whole-property costs/agent/mortgage rows. Show estimated
   operating profit before debt, then estimated cash left after mortgage payments.
   An existing commercial lease uses its saved signed rent until renewal, rather
   than substituting the current asking rent for every occupied unit. Keep the
   asking-rate row for new leases. Say current occupancy/full-year lease rent,
   estimate and before personal income tax; no guaranteed occupancy/return or
   actual-year profit claim. Empty units and missed payments can reduce receipts.

**Save compatibility:** expected current v50 unchanged. Rent policy is derived;
new deposits use the already saved principal/balance/term. Do not manufacture a
new lease or reprice old commercial contracts, re-amortize existing mortgages,
rewrite past transactions or change RNG state. If implementation reveals a real
new persisted field is needed, return with its concrete proposal and reserve the
next version before touching the schema.

## Counterfactual calibration before approval

Scratch harnesses outside git run the actual annual property/tenant kernel. They
mutate only an in-memory prospective catalog yield for each candidate and restore
it after the case; no source/catalog files are edited. Conditions/appreciation,
tenant keys and expenses stay paired. Two disjoint groups of 100 properties per
case, 25 years, eleven residential kinds × Ohio/California × five factors
(1, 1.10, 1.15, 1.20, 1.25) = **550,000 prospective property-years**. Tenant income
rounding and reliability use the actual reader, not a proportional revenue guess.

| Managed $475,000 duplex             | Current Ohio                  | Proposed Ohio | Current California            | Proposed California |
| ----------------------------------- | ----------------------------- | ------------- | ----------------------------- | ------------------- |
| Operating yield, group A            | 4.69%                         | 5.79%         | 2.81%                         | 3.63%               |
| First-five cash/year, 25% down      | −$3,328                       | +$2,484       | −$13,241                      | −$8,920             |
| First-five cash/year, 50% down      | not a current purchase choice | +$12,295      | not a current purchase choice | +$891               |
| First-five cash/year, cash purchase | profitable                    | +$31,917      | profitable                    | +$20,513            |

Group B confirms proposed Ohio operating yield 5.80%, first-five 25%-down +$2,504
and half-deposit +$12,315; California 3.64%, −$8,899 at 25%, +$912 at 50%. A 10%
rent change leaves only a roughly $500 first-five margin in the Ohio reference;
15% gives room for bad years without moving to the 20/25% candidates' higher
returns. This is a chosen balance target, not a promise of positive cash every year.

At ×1.15, Ohio small/medium/large apartment operating yields are about 5.96–6.44%;
California about 3.70–4.03%. Houses retain their relative differences; a mansion
or estate is still not automatically a good leveraged rental. Choosing above the
going rent must still cost enough occupancy/turnover to prevent a free maximum.
Baseline sweep confirms Ohio collection ratios about 98/97/95/81/50/0% across
0.8/0.9/1/1.1/1.2/1.3, with the going rate earning the most rent per unit-year.

A second harness passes usual/half-deposit mortgage balances through actual
`runHomesYear`/`homeYear` at unchanged products/rates, plus cash ownership. All eight
investment building kinds, two regions, two seed groups, current/proposed
residential rent and unchanged commercial rent: **360,000 annual settlements**.
Every emitted transaction posts to the ledger and reconciles. Cash/deposit is
posted as a property transfer; principal paydown is counted separately, not called
operating profit. These are prospective balance-reader probes: the half-deposit
purchase command does not exist yet. No full household/lifetime forecast is claimed.

## Acceptance after approval

Add literal policy/unchanged commercial tests, all six rent settings and region/
condition comparisons. Exercise actual quote and purchase commands with usual,
half and cash financing, rejections, immutable before-call RNG, correct deposit/
principal/ledger, underwriting and caps; preserve primary-home behavior. Run actual
annual settlement/advance, sale/death/inheritance and old-save replay. Assert current
fixed commercial rents/renewals and no negative-income or double-agent expense.
Test real mobile store/autosave/purchase actions and the gross/operating/cash labels.
Measure production against these paired probes and 0503, including generated
landlord lives under P2; do not silently claim an operating point is lifetime success.

At least fifteen independent sabotage mutations, exact backup/hash restoration,
full `pnpm verify`, changed-file formatting, own docs/CORE/findings and PR into main,
then stop before P15. No weakened/deleted acceptance tests or retuned unrelated
macro, living, tax, property value or mortgage products.

## Open checks

Approval required for all three concrete choices above: ×1.15 residential rents,
a fixed 50%-down investment purchase option and revised rental projections. No
production implementation/test/sabotage claim yet. P13 baseline is 3,220 passing
tests and 15 typechecks; seven inherited generator byte mismatches and 22 old-note
format failures still block full verify/CI. The homes generator and saved catalog
are semantically identical before P14; no catalog reformat is included. Native/
device checks and unavailable Claude Project mirroring remain open. P15–P16 wait.
