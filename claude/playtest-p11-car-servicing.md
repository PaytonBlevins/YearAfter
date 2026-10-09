# Playtest P11 — approved manual car servicing

Status: Payton approved the measured proposal on 8 October local / 9 October 2026 UTC,
with one amendment: target 5–10 extra years rather than 3–5. Separately reserved save
v48 before production edits. Built on `feat/playtest-p11-car-servicing`, stacked on
P10 PR #22 while refreshed main remains `beff25a`. The calibration below implements
that approved target; verification is recorded below. P12–P16 and
life-event wording wait.

## Requirement and boundaries

P11/B10: a yearly player choice with a price and an effect on reliability or lifespan.
Read 0504/0505, the actual vehicle finance/year reader, purchase/loan/modification paths,
owned screen/store, persistence contracts and the playtest brief. Spec 141 excludes mileage;
179–182 keep maintenance and repairs in one car bill; 1877–1885 preserve curated lots,
hidden used history/faults, financing and concise modifications. Spec 1043–1059 and 1088
require measured balance; 1108–1140 protect saves and RNG. CORE 13.90–13.92 require
actual committed costs, measured mechanism size and literal bounds. The low-friction
spec remains relevant: expose a useful decision without making every year a mandatory chore.

Approved implementation scope: finance vehicles/types/public exports/tests;
simulation vehicle command/year integration/public exports/tests; mobile owned-car
screen/store/tests; persistence schema/migration/tests; this doc, CLAIMS, HANDOFF,
roadmap and a CORE lesson. No change to catalog IDs/prices/reliability, repair bills,
accident rules, loan terms, inherited liquidation, replacement offers, life-event wording,
other payment flows or TICKET 0708. Save shape and shared payment boundary are protected
contracts; the playtest brief authorizes changes here with Payton's approval here.

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

## Approved choice, amended longevity target

Keep the existing ordinary annual maintenance bill. Add optional **Extra preventive
service** on the existing owned-car screen. It is additional work to preserve condition,
not another charge for the ordinary work already in the annual bill. Skipping this
button leaves today's wear/repair rules intact. No annual prompt or auto-renewal.

- Once per owned car per world year, available to a living adult aged 18 or older.
- Price: 50% of the upcoming year's mean ordinary maintenance, including the car's
  existing modification strain, rounded to the nearest $10 with a $100 minimum.
  Use upcoming age and current condition; exclude loan payments and surprise repairs.
- For the next annual advance only: multiply normal wear by 0.63 (0.75 for classics) and ordinary big-repair
  chance by 0.80. These mean 37% less normal wear, 25% less classic wear and 20% lower
  repair chance, not 20 percentage
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

Save v48: an optional held-car service record containing the paid world year
and whole-dollar cost. Eligibility is exact paid-year === incoming-year − 1; retaining
last service for display must not renew it. A no-RNG migration leaves v47 and older
cars unserviced. Round-trip, malformed, unknown/legacy trim, future-year markers,
current-year repeat, autosave and actual descendant liquidation are explicitly tested. v48 was claimed
separately before production edits; P10 owns v47. No other version reservation conflicts.

## Amended calibration and actual production measurement

Seven real offers × 600 paired paths = 4,200 pairs, with disjoint A/B seed groups of
300 each (`p11-asset:A:0..299`, `p11-asset:B:0..299`). Retain actual stock IDs,
2030 purchase year, held records and the existing keyed random inputs. Baseline runs
actual `runVehiclesYear`. After the amendment, an isolated counterfactual transformed
wear/repair rolls to identify the new multipliers, then all 4,200 paired paths were
rerun through actual `serviceVehicle` payment and `runVehiclesYear`. The summaries
match the amended counterfactual exactly in both A/B groups: lifespan, costs, repairs,
resale and survival. Each annual renewal uses the actual whole invoice/record rather
than an injected free marker. Candidate pays before each upcoming year until scrapping.
All keyed inputs, upkeep, repair size, crashes, history, loans and mods retain the
actual reader's rules; every ledger reconciles. This is the production asset probe,
not a full-population simulation of players choosing cards/renewals.

| Real purchased car           | First extra service | Median remaining years, baseline → annually serviced | First ten years median outgoings, baseline → serviced | Ordinary repairs across 600 paths, first ten years |
| ---------------------------- | ------------------- | ---------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Camden SE, new               | $230                | 26 → 36                                              | $8,600 → $11,620                                      | 550 → 441                                          |
| Camden SE, used (no history) | $430                | 10 → 15                                              | $14,340 → $19,400                                     | 954 → 803                                          |
| Civix LX, online             | $320                | 21 → 30                                              | $10,600 → $14,280                                     | 826 → 651                                          |
| RBW 531i, new luxury         | $540                | 20 → 27                                              | $20,200 → $27,340                                     | 881 → 709                                          |
| Teslo Tri RWD, new electric  | $310                | 24 → 33                                              | $11,720 → $15,680                                     | 682 → 552                                          |
| Ferrano Rona, new exotic     | $2,070              | 19 → 25                                              | $77,300 → $104,860                                    | 914 → 729                                          |
| Testa Rosa, 1986 classic     | $2,690              | 32 → 42                                              | $80,550 → $101,410                                    | 2053 → 1621                                        |

Remaining years means from this purchase, not total age at scrapping. Probe horizon is
60 years; one serviced classic survives that horizon and is right-censored. No baseline
path is censored. First-ten-year outgoings stop when scrapped and exclude replacement,
initial purchase and card interest. This is a retained single-car analysis, not the
normal replacement-offer policy or an engine forecast shown to the player.

Disjoint A/B median remaining years agree for Camden new (26/25 → 36/36), used
(10/10 → 15/15), Civix (21/21 → 30/30), Teslo (24/24 → 33/33) and classic
(32/32 → 42/42). RBW is 20/20 → 28/27; Rona 19/19 → 25/25. Ordinary repair
counts fall in both groups for all seven offers. The used Camden's ten-year survival
rises from 32.3% to 97.5%. Additional work costs more than it saves in repair bills;
its benefit is keeping the car longer. No promise of free upkeep or a profitable resale flip.

All 247 trims were quoted without modifying the catalog. Healthy newly purchased
mainstream cars quote $200–$690, luxury $300–$1,540, exotic $830–$4,860,
classic $570–$9,030. At age ten/condition 60, upcoming quotes are $410–$1,400,
$620–$3,160, $1,690–$9,940 and the same classic range. Fitted strain and condition
below 40 can increase those quotes; these are not universal hard caps.

Calibration sources: [Toyota's manufacturer maintenance schedule](https://www.toyota.com/owners/maintenance-schedule)
connects routine preventive care with long-term reliability, but does not establish
our gameplay multipliers. [S&P Global's 2025 fleet report](https://press.spglobal.com/2025-05-21-U-S-Vehicle-Age-Rises-Again-to-12-8-Years-in-2025,-According-to-S-P-Global-Mobility)
reports mean US light-vehicle age 12.8 years. Fleet age is not total useful lifespan;
do not force new-car scrapping to 12.8 years. Preserve the current game's baseline
longevity; the measured change here is optional paid care.

## Implemented boundaries and verification coverage

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

P11 engine, payment/store/screen and save changes are built. Final verification is
recorded below. P10's measured baseline was 3,014 tests/15 typechecks passing, with
seven inherited generator mismatches and 22 historical-note formatting failures.
Do not repair those catalogs or old notes in this ticket. Native/device checks and
Claude Project mirroring remain unavailable here and open; the repo docs are canonical.

Found by P11: baseline automatic maintenance already includes routine servicing.
Removing it would make a new mandatory chore; charging again without distinguishing
extra work would misrepresent the bill. Approved extra preventive work is explicit.
The existing replacement offer opens at age 18 even if condition remains good; this
proposal does not quietly retune that separate door. A classic's current low ordinary
wear already allows long remaining life. No retrospective history certification,
restoration or guarantee of cheap luxury ownership is being added.

## Sabotage-verification report

Thirty independent behavioral mutations were run against the actual finance,
simulation, persistence and owned-screen/store tests. The first pass caught 29.
An unnecessary RNG draw was initially missed: the test compared the result with the
same mutable RNG object after the call. Replaced that comparison with an immutable
snapshot captured before the command, also checking refusals. The draw mutation now
fails an assertion. Final outcome: all 30 caught, none left missed. Every mutated
production file was restored byte-for-byte; restoration hashes were checked.

| Mutation                                  | Result                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| 1. wrong upcoming quote age               | Caught                                                            |
| 2. missing modification strain            | Caught                                                            |
| 3. loan balance included in service price | Caught                                                            |
| 4. minimum price removed                  | Caught                                                            |
| 5. wrong price rounding                   | Caught                                                            |
| 6. wrong price share                      | Caught                                                            |
| 7. wrong normal wear strength             | Caught                                                            |
| 8. classic receives normal multiplier     | Caught                                                            |
| 9. effect in wrong year                   | Caught                                                            |
| 10. coverage never expires                | Caught                                                            |
| 11. no ordinary repair protection         | Caught                                                            |
| 12. all ordinary repairs prevented        | Caught                                                            |
| 13. servicing prevents crashes            | Caught                                                            |
| 14. hidden fault bill discounted          | Caught                                                            |
| 15. history recertified                   | Caught                                                            |
| 16. immediate condition restoration       | Caught                                                            |
| 17. immediate resale restoration          | Caught                                                            |
| 18. paid marker omitted                   | Caught                                                            |
| 19. same-year repeats allowed             | Caught                                                            |
| 20. minor gate removed                    | Caught                                                            |
| 21. dead life gate removed                | Caught                                                            |
| 22. zero invoice charged                  | Caught                                                            |
| 23. service classified as asset transfer  | Caught                                                            |
| 24. card debt not committed               | Caught                                                            |
| 25. unnecessary RNG draw                  | Initially missed; strengthened before-call snapshot catches rerun |
| 26. future marker accepted on load        | Caught                                                            |
| 27. zero service cost accepted on load    | Caught                                                            |
| 28. free service invented in migration    | Caught                                                            |
| 29. store autosave omitted                | Caught                                                            |
| 30. screen dispatch omitted               | Caught                                                            |

The caught cases cover the price/effect/expiry, history/crash/defect boundaries,
refusal/payment atomicity, save validation/migration, and actual UI/store/autosave.
The RNG miss changed a test, not the gameplay rule. No production mutation is retained.

## Final local verification

Full `pnpm verify` was run after restoring all sabotage changes and strengthening the
RNG check. All 15 typechecks and all 3,080 tests pass (66 new P11 tests: finance 18,
simulation 20, persistence 22, mobile 6). Four existing save tests now assert current
v48 instead of v47; their complete migration/legacy preservation checks are retained.
Production asset measurement exactly matches the amended A/B counterfactual summaries
for all seven purchases/all 4,200 pairs. The owned screen reaches the real store,
command and autosave for both cash and card. Actual annual advance and actual descendant
liquidation are covered. No claim of a completed native/device run.

`pnpm verify` exits nonzero only at the seven inherited generator checks: activities,
advice, auctions, businesses, childhood events, homes and vehicles. Full Prettier check
fails on the same 22 historical Claude notes; every changed file passes formatting.
The validator rewrites the secondary vehicle-mod catalog; compared parsed values with
HEAD (identical) and restored exact original bytes. No catalog or generator rewrite
is committed. TICKET 0708 stays unchanged. Native checks and unavailable Claude Project
mirroring remain open. PR/CI details are recorded when published; P12–P16 wait.
