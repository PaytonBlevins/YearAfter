# Playtest P11 — measured manual car servicing proposal

Status: Payton authorized P11 on 9 October 2026 UTC. Separately claimed on
`feat/playtest-p11-car-servicing` before measurement. Stacked on P10 PR #22 while
`origin/main` remains `beff25a`; refreshed and rebased before the claim. Proposal only:
no production rule, screen, save or catalog edits yet. Current save v47; v48 is proposed,
not reserved. P12–P16 and life-event wording wait.

## Requirement and boundaries

P11/B10: a yearly player choice with a price and an effect on reliability or lifespan.
Read 0504/0505, the actual vehicle finance/year reader, purchase/loan/modification paths,
owned screen/store, persistence contracts and the playtest brief. Spec 141 excludes mileage;
179–182 keep maintenance and repairs in one car bill; 1877–1885 preserve curated lots,
hidden used history/faults, financing and concise modifications. Spec 1043–1059 and 1088
require measured balance; 1108–1140 protect saves and RNG. CORE 13.90–13.92 require
actual committed costs, measured mechanism size and literal bounds. The low-friction
spec remains relevant: expose a useful decision without making every year a mandatory chore.

Allowed implementation after approval: finance vehicles/types/public exports/tests;
simulation vehicle command/year integration/public exports/tests; mobile owned-car
screen/store/tests; persistence schema/migration/tests; this doc, CLAIMS, HANDOFF,
roadmap and a CORE lesson. No change to catalog IDs/prices/reliability, repair bills,
accident rules, loan terms, inherited liquidation, replacement offers, life-event wording,
other payment flows or TICKET 0708. Save shape and shared payment boundary are protected
contracts; the playtest brief authorizes changes here subject to this proposal's approval.

## Actual baseline

The engine already deducts ordinary maintenance automatically on each annual advance.
There is no player service command and no paid-year marker. Hidden service history
changes normal wear (full 0.8, patchy 1, none 1.35); it is not a record of player actions.
Maintenance depends on market, capped retail reference, age, condition, model reliability
and fitted modifications. Ordinary wear has no modification-strain multiplier today;
strain already affects upkeep and big-repair chance. Preserve these distinctions.
Accidents and hidden faults have separate outcomes, with defect → accident → repair priority.
Condition below 8 scraps an unfinanced car for $400. An active loan delays scrapping;
it must not become a service eligibility restriction or a way to erase the loan.

Population baseline: 300 actual played lives, two disjoint groups of 150 using
`p11-population:A:0..149` and `p11-population:B:0..149`. Actual `createNewGame`, first
pending choice, `decide` and `advanceYear`, until death or age 115. Every annual ledger
reconciles. No injected wealth in this population. This fixed first-choice policy is a
baseline, not a representation of every possible player policy. Adult ownership is
79.66%/75.71%; median held-car age 11 in both, mean 11.08/10.82; median condition
66/67.1. Annual committed car cost (ordinary upkeep, actual surprises and loan payments)
averages $2,292/$2,416 per held-car-year. There are 70/105 shortfall years and 3/3
repossessions. Actual purchase receipts total 404/348, with 127/125 financed purchases;
161/132 cars are scrapped. Receipt counting observes both decisions and annual steps,
so purchases made while answering a pending event are included. This is a baseline only; it does not show population affordability of the candidate.

The separate asset probe searches real 2030 offers and buys seven actual cars through
`vehicleLots`/`buyVehicle`. A prior-year posted $10m isolates access to luxury lots;
that funded buyer is not used for population affordability. All buys reconcile and
consume no stream draws. The used Camden has no records, age 8 and condition 69;
the online Civix has full records, age 5 and condition 91; the classic is age 44,
patchy and condition 63. Other measured cars are new/full/condition 100. None of these
seven sampled offers has a hidden fault; dedicated fault tests are still required.

## Proposed choice — approval required

Keep the existing ordinary annual maintenance bill. Add optional **Extra preventive
service** on the existing owned-car screen. It is additional work to preserve condition,
not another charge for the ordinary work already in the annual bill. Skipping this
button leaves today's wear/repair rules intact. No annual prompt or auto-renewal.

- Once per owned car per world year, available to a living adult aged 18 or older.
- Price: 50% of the upcoming year's mean ordinary maintenance, including the car's
  existing modification strain, rounded to the nearest $10 with a $100 minimum.
  Use upcoming age and current condition; exclude loan payments and surprise repairs.
- For the next annual advance only: multiply normal wear by 0.75 and ordinary big-repair
  chance by 0.80. These mean 25% less wear and 20% lower repair chance, not 20 percentage
  points and not a guaranteed extra number of years. Pay again next year to renew.
- No immediate condition restoration, resale jump, stats or RNG draws. Existing resale
  responds naturally to the better condition after the annual reader. Do not recertify
  an old car's history, erase accident history or replace its model reliability.
- Crashes, their condition loss/deductible and grip, and hidden faults and their full
  repair bills remain intact. It does not inspect a car or repair a known fault early.
- Explicit cash or chosen-card payment, using the shared atomic purchase helper.
  Available card credit must cover the whole invoice; insufficient cash/credit, missing
  car, unsupported trim, dead/minor player and same-year repeat refuse without mutation.
  A loan or modification does not by itself block service.

Owned-car screen: a compact card beneath Condition/Maintenance. Show the exact price,
explain that ordinary maintenance is already included, and say this extra work reduces
wear and the chance of a major repair next year. Confirm the full invoice with Cash or
an eligible named card. After paying, show “Serviced this year — covers next year” and
disable repeat purchase. After advancing, show the last service year and offer renewal.
Keep normal Condition labels, general sale and modifications. No new route, repair-shop
catalog, service tiers, fuel, mileage or realistic mechanical procedure.

Proposed save v48: an optional held-car service record containing the paid world year
and whole-dollar cost. Eligibility is exact paid-year === incoming-year − 1; retaining
last service for display must not renew it. A no-RNG migration leaves v47 and older
cars unserviced. Round-trip, malformed, unknown/legacy trim, future-year markers,
current-year repeat, autosave and death/handoff behavior need explicit tests. Claim v48
separately after approval before production edits; check that no other agent reserved it.

## Counterfactual measurement of these exact values

Seven real offers × 600 paired paths = 4,200 pairs, with disjoint A/B seed groups of
300 each (`p11-asset:A:0..299`, `p11-asset:B:0..299`). Retain actual stock IDs,
2030 purchase year, held records and the existing keyed random inputs. Baseline runs
actual `runVehiclesYear`; candidate runs actual finance `vehicleYear` with algebraic
wear/repair-roll transforms that implement the proposed multipliers. Candidate pays
half of each upcoming year's mean upkeep before that year, repeatedly until scrapping.
No production command exists yet: these transforms are counterfactual inputs, not
valid RNG draws or proof of screen/payment/save behavior. Upkeep, repair size, crashes,
history, loans and modification logic otherwise remain the actual reader's rules.
Both paths post actual outgoings and scrap credit, reconciling every year.

| Real purchased car           | First extra service | Median remaining years, baseline → annually serviced | First ten years' median outgoings, baseline → serviced | Ordinary big repairs across 600 paths, first ten years |
| ---------------------------- | ------------------- | ---------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Camden SE, new               | $230                | 26 → 31                                              | $8,600 → $11,620                                       | 550 → 441                                              |
| Camden SE, used (no history) | $430                | 10 → 13                                              | $14,340 → $19,730                                      | 954 → 800                                              |
| Civix LX, online             | $320                | 21 → 26                                              | $10,600 → $14,290                                      | 826 → 651                                              |
| RBW 531i, new luxury         | $540                | 20 → 24                                              | $20,200 → $27,340                                      | 881 → 709                                              |
| Teslo Tri RWD, new electric  | $310                | 24 → 29                                              | $11,720 → $15,680                                      | 682 → 552                                              |
| Ferrano Rona, new exotic     | $2,070              | 19 → 23                                              | $77,300 → $104,870                                     | 914 → 729                                              |
| Testa Rosa, 1986 classic     | $2,690              | 32 → 42                                              | $80,550 → $101,410                                     | 2053 → 1621                                            |

Remaining years means from this purchase, not total age at scrapping. Probe horizon is
60 years; one serviced classic survives that horizon and is right-censored. No baseline
path is censored. First-ten-year outgoings stop when scrapped and exclude replacement,
initial purchase and card interest. This is a retained single-car analysis, not the
normal replacement-offer policy or an engine forecast shown to the player.

Disjoint A/B median remaining years agree for Camden new (26/25 → 31/31), used
(10/10 → 13/13), Civix (21/21 → 26/26), Teslo (24/24 → 29/29) and classic
(32/32 → 42/42). RBW is 20/20 → 25/24; Rona 19/19 → 22/23. Ordinary repair
counts fall in both groups for all seven offers. The used Camden's ten-year survival
rises from 32.3% to 84.5%. Additional work costs more than it saves in repair bills;
its benefit is keeping the car longer. No promise of free upkeep or a profitable resale flip.

All 247 trims were quoted without modifying the catalog. Healthy newly purchased
mainstream cars quote $200–$690, luxury $300–$1,540, exotic $830–$4,860,
classic $570–$9,030. At age ten/condition 60, upcoming quotes are $410–$1,400,
$620–$3,160, $1,690–$9,940 and the same classic range. Fitted strain and condition
below 40 can increase those quotes; these are not universal hard caps.

Calibration sources: [Toyota's manufacturer maintenance schedule](https://www.toyota.com/owners/maintenance-schedule)
connects routine preventive care with long-term reliability, but does not establish
our 25%/20% gameplay multipliers. [S&P Global's 2025 fleet report](https://press.spglobal.com/2025-05-21-U-S-Vehicle-Age-Rises-Again-to-12-8-Years-in-2025,-According-to-S-P-Global-Mobility)
reports mean US light-vehicle age 12.8 years. Fleet age is not total useful lifespan;
do not force new-car scrapping to 12.8 years. Preserve the current game's baseline
longevity; the measured change here is optional paid care.

## Implementation and verification after approval

Literal tests for cost rounding/minimum/upcoming age, strain, one paid year, renewal
and expiry, exact wear/chance effects, real keyed annual integration and loan/defect/
crash priority. Tests must prove same input without the marker stays unchanged, and
one purchase gives one year's protection rather than the repeated-care projection.
Actual cash/card commands must reconcile, record the right category, update balance/
debt/available credit and expose spoken refusal reasons without state/RNG mutation.
Test owned screen → store → command → autosave and persistence replay, then real
advance with existing living-expense and shortfall/repossessions logic.

Sabotage at least fifteen independent behaviors: wrong quote age; loan included in
price; missing strain; wrong rounding/minimum; wrong wear multiplier; wrong repair
multiplier; crash protection; hidden-fault discount; record recertification; immediate
condition/value/stat restoration; next-year effect omitted; protection lasting forever;
repeat purchase allowed; partial cash/card mutation; zero/full invoice mismatch;
RNG draw; migration granting free service; malformed/future marker accepted; autosave
or store dispatch omission. Add meaningful tests for any missed mutation, restore all
mutations and rerun. Then full `pnpm verify`, changed-file formatting, production
balance comparison, CORE lesson, docs, PR into main and stop before P12.

## Open checks and findings

No production code has changed, so P11 feature tests, sabotage and full verify are not
yet claimed. P10's last measured baseline is 3,014 tests/15 typechecks passing, with
seven inherited generator mismatches and 22 historical-note formatting failures.
Do not repair those catalogs or old notes in this ticket. Native/device checks and
Claude Project mirroring remain unavailable here and open; the repo docs are canonical.

Found by P11: baseline automatic maintenance already includes routine servicing.
Removing it would make a new mandatory chore; charging again without distinguishing
extra work would misrepresent the bill. Proposed extra preventive work is explicit.
The existing replacement offer opens at age 18 even if condition remains good; this
proposal does not quietly retune that separate door. A classic's current low ordinary
wear already allows long remaining life. No retrospective history certification,
restoration or guarantee of cheap luxury ownership is being added.
