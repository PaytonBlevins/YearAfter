# Playtest P12 — measured supplier-pitch proposal

Status: Payton approved the complete proposal on 8 October local / 9 October
2026 UTC, including per-business quotas. Built on `feat/playtest-p12-supplier-pitches`,
stacked on P11 PR #23 while refreshed main remains `beff25a`. Save v49 was reserved
in separate published commit `d9a7418` before production edits. P13–P16 and
life-event wording wait. The measured pre-approval proposal is retained below;
implementation/results supersede its approval-pending statements.

## Requirement and scope

P12/B2: suppliers pitched one at a time, each with quality, a price point and loyalty;
five new searches a year. Keep A2's explanations where they fit. Read 0601/0602/A2,
actual finance quality/COGS/staff/reputation and event readers, simulation opening,
supplier command and annual settlement, mobile section/store and persistence boundary.

Spec 393 (quality/COGS), 1331 (business dashboard), 1392 (pricing, payroll, demand,
reputation, economy and weighted events), 1708 and the current Business & Entrepreneurship
interface. CORE 13.93–13.95 require comparing suppliers while the manager/reputation
respond; 13.158 requires a before-call RNG snapshot. Spec 1043–1059 and 1108–1140
protect reconciliation, save compatibility and deterministic replay.

Allowed after approval: finance business/supplier rules and event integration/tests;
simulation supplier commands/readers/public exports/tests; small TS supplier-name
content/public exports/tests if needed; current BusinessesScreen/store/component tests;
persistence schema/migration/tests; ticket/CLAIMS/HANDOFF/roadmap/CORE lesson. Protected
contracts: held business supplier/save shape, existing supplier command and annual
settlement. The playtest brief authorizes these changes here subject to approval.
No business catalog/generator rewrite, new business type, agent tiers/P13, pricing-slider
rebuild, payroll/expansion change, macro retune, P1 rescue change, TICKET 0708 or life-event
wording. Existing named supplier-event receipt must still describe its actual amount.

## Actual baseline

There are 31 business types: 20 use suppliers, 11 do not. The exclusions are fitness,
software, accounting, law, marketing, real estate, gaming, media, production, trucking
and vehicle rental. The catalog's supplier gate remains authoritative.

The current command instantly selects Budget/Standard/Premium, freely and repeatedly.
The three cost multipliers are 0.78/1/1.22 and goods-quality multipliers 0.88/1/1.12.
Goods quality is weighted by each type's product share; staff/pay also affect finished
quality. COGS varies with units sold, not simply a fixed annual subscription price.
There is no named supplier, search counter, offer, loyalty or contractual history.

Baseline scratch harness `p12-checkpoints/measure.ts`, kept outside git: actually opened
all 20 relevant types through `openBusiness` with a prior-year posted $100m access
fixture, then called real `setSupplier` for all three grades. All 60 changes are free,
reconcile and leave a captured-before-call RNG snapshot unchanged. The funded adult
isolates catalog access; it does not represent ordinary business affordability.

Mature kernel comparison uses actual `newBusiness`, `businessYear` and `autoStaffFor`.
Neutral market, ordinary price 100, medium payroll, stat 50, full-time owner, luck 1,
one mature location, no one-off event. Iterate staffing and reputation 40 times, rather
than freezing them. These are normalized mature operating results, not observed owner
cash draws, tax, loans, survival or a played household. Whole-head staffing can be lumpy;
all 60 baseline grade/type comparisons have unchanged staff and reputation at step 40.
Counterfactual outcomes remain measured operating points, not a convergence guarantee
for every possible custom contract.

| Type           | Budget profit | Standard profit | Premium profit |
| -------------- | ------------- | --------------- | -------------- |
| Cleaning       | $40,335       | $37,693         | $66,619        |
| Café           | $59,205       | $55,919         | $50,032        |
| Restaurant     | $68,693       | $98,103         | $103,209       |
| Clothing store | $39,657       | $50,769         | $10,935        |
| Hotel          | $650,463      | $641,960        | $618,504       |

No grade wins everywhere. Prices were also swept across the existing 70–140 slider
in steps of five; supplier effects interact with price and the manager. P13 owns the
requested agent/pricing review, so this ticket does not silently retune it.

## Approved product choices

- **Five free searches per owned business per world year**, shared by all its branches.
  Payton approved the per-business interpretation, including separate quotas for
  owners with multiple businesses.
  Opening or loading the screen never consumes a search. An accepted supplier is not
  another search. Only a successful request for a new pitch increments the counter.
- Search presents exactly one named fictional supplier. Accept, pass or search again;
  another search replaces the pending pitch. No bank of earlier pitches or side-by-side
  shortlist. Accepting clears it; replaying an old/passed/accepted ID refuses.
- Grades are equally likely Budget/Standard/Premium. Keep their existing economic
  anchors, with independent quoted variation: price multiplier ×0.97–1.03 and goods
  quality multiplier ×0.98–1.02, both rounded to two decimal places. Resulting price/
  quality ranges are Budget 0.76–0.80 / 0.86–0.90, Standard 0.97–1.03 / 0.98–1.02,
  Premium 1.18–1.26 / 1.10–1.14. They are quoted terms, not yearly rerolls.
- Loyalty is independently Low/Medium/High with equal odds. It softens only the existing
  supplier price-hike event's **extra surcharge** by 0%/25%/50%. Thus the current event's
  5–10% hike stays 5–10%, becomes 3.75–7.5%, or becomes 2.5–5%. It does not discount the
  whole annual goods bill or remove the event. Event chance, selection weights, other
  effects and favorable supplier-price events remain unchanged.
- Loyalty is a supplier trait meaning willingness to hold terms, not a new player stat,
  relationship meter, annual grind, tenure bonus or chance of abandoning the business.
  An accepted agreement retains its quality, cost and loyalty until replaced. No signing
  fee, switching charge, cashback, income, immediate reputation/stat benefit or card
  selector; the business pays for goods through its existing annual settlement.
- Startups and legacy holdings keep their existing supplier grade and exact old economics
  until accepting a pitch. Their generic current supplier has no newly granted loyalty
  protection. Buying/inheriting a business preserves accepted terms and its same-world-year
  search usage; branches do not each receive another quota. No forced annual replacement.
- Living adult owner, relevant business, no pending P1 rescue, valid owned ID and quota
  required. Invalid, stale or unavailable requests leave state, money and RNG unchanged.
  Supplier-free businesses retain no section or search. Unknown legacy types remain loadable
  but refuse this new command. Once a new year begins, five searches are available and an
  unaccepted prior-year pitch expires; an accepted contract remains active.

Use stable derived seed/business/year/search keys, not domain-stream draws. The same
save/reload retains the same one pitch and count; search ordinal advances only on success.
The existing unrestricted grade command must not bypass the new search/accept path:
replace its player-facing wiring, document its changed contract and update the old
API-specific tests without removing economic or refusal assertions.

## Proposed screen and save

Inside the current business screen's Suppliers section: current supplier name/grade,
quoted goods quality, supply price relative to ordinary supplies, loyalty and a plain
explanation. Preserve A2's cost/quality/customer tradeoff and the role of staff. A
Search button shows searches left. The one pending pitch card exposes the same three
traits plus Accept and Pass; no purchase is made just by viewing it. Replace the three
unrestricted grade taps with this flow. No new top-level row or navigation world.
Show spoken refusals, including exhausted searches and stale offers. Relative quoted
COGS is not a promise of a fixed yearly bill or profit.

Proposed save v49: optional accepted agreement on each held business (stable ID/name,
grade, quality/cost factors, loyalty, accepted year), and an optional search record
(world year, successful searches used, one pending pitch). Preserve the existing grade
field as the legacy economic anchor, not as an alternative free selection path.
No-RNG migration adds no offer, spending or loyalty, preserving all old prices, staff,
reputation, till, books and P11 service records. Validate bounds, integer counts 0–5,
IDs/year consistency, duplicate acceptance, malformed/future records and legacy grades.
Reserve v49 in a separate claim after approval before production edits; P11 owns v48.

## Counterfactual measurement

Two disjoint groups of 300 seed keys (`p12-pitch:A:0..299`, `p12-pitch:B:0..299`),
five offers each: 3,000 pitches, applied across all 20 types = 60,000 type/pitch cases.
This is an isolated algebraic counterfactual on the actual kernel, not a production
supplier command. Medium payroll stays fixed; transform product weight using logarithms
and the budget-quality anchor to produce the proposed goods quality, and use the COGS
modifier to produce quoted cost. The transformed baseline exactly matches actual grade
results before any variation. Do not persist these transformed catalog inputs.

At ordinary price, compared with the same current grade, median profit change is
0.000/0.041 percentage points of type benchmark mature revenue for A/B. Individual
cases range from −9.320 to +9.246 points, partly from whole-person staffing changes.
Even a small quality shift is not a guaranteed profit improvement.

A perfect-information bound compares the best of five pitches with the best of today's
three grades and allows retaining that old best contract. Median improvement is
0.393/0.373 revenue points; maximum 5.645 points. This is a bound, not a forecast of
what a player picking by the displayed traits will earn. It excludes loyalty events,
startups, death, taxes, loans and rescue decisions; production integration must still
be measured after approval.

Budget was missing from five offers in 42/48 out of 300 search sequences (14%/16%).
No promised grade or forced lucky search. High-loyalty pitches numbered 502/501 out
of 1,500 per group. Real weighted `drawEvent` over 120,000 neutral-market business-years
per group produced 4,256/4,438 supplier hikes (3.55%/3.70% of years). The event contexts use ages 0–19 and no existing rival; they are independent contexts,
not a played history where a prior rival event changes later selection. A separate conditional
7.5% hike probe gives median savings of $3,553/$3,394 across all types/grades/loyalty
pitches; those are **when a hike occurs**, not every year's rebate or owner income.
No empirical supplier-loyalty percentages are claimed: these are proposed game values
calibrated against the existing engine, not imported real-world industry guarantees.

## Implementation and checks after approval

Test exactly five successful searches and sixth refusal; read-only browsing; independent
businesses and shared branch quota; pass/replace/accept/stale ID; next-year reset and
expiry; preserved contract; eligible/dead/minor/rescue/unsupported gates; before-call
RNG snapshots; save/reload/round-trip/no-RNG migration; actual acquisition/descendant
handoff; yearly quality/demand/COGS/staff/reputation and loyalty event propagation;
no cash/stat/reputation reward; old grade setter cannot bypass the flow; actual owned
screen/store/command/autosave. Re-run the counterfactual comparisons through the real
commands/annual reader, with reconciled settlement, after approval.

Sabotage at least fifteen separate behaviors: quota 4/6; search on browsing; hidden
extra offer; lost search count; stream RNG draw; accepting stale/passed/used offers;
wrong grade price/quality bounds; omitted quality/COGS; loyalty discounts the whole bill
or shields all events; old API bypass; forced annual replacement; free legacy loyalty;
malformed save accepted; store dispatch/autosave omitted. Restore exact backed-up source,
strengthen missed tests, run full `pnpm verify` and formatting, document CORE/findings,
open PR into main and stop before P13.

## Findings and current open checks

Found by P12: loyalty does not exist yet, and suppliers without individual contracts
can currently be changed without limit. Five searches is settled but its scope across
multiple businesses needs approval. Supplier price is a per-unit COGS factor, not an
up-front fee. Tiny quote changes can alter a whole worker's staffing cost; do not report
only average uplift or promise better goods always produce more profit. Long-lived
agreements must not be rerolled merely because the year changes.

No feature tests/sabotage/full verify are claimed for this proposal; production is
unchanged. P11's final baseline is 3,080 tests/15 typechecks passing, seven inherited
generator mismatches and 22 historical-note formatting failures; CI confirms the
format failures and skips later gates. Native checks and unavailable Claude Project
mirroring remain open. No catalog or old-note reformat is included.

## Implemented engine, screen and save

Public `searchSupplier`, `acceptSupplier` and `passSupplier` return typed refusals
and an updated game state. The search record stores one offer and successful usage;
viewing uses a read-only current-year reader. ID binds business/year/search ordinal.
Search and acceptance leave bank, stats, reputation and domain streams unchanged.
An unrelated business has its own quota; every branch of the same business shares it.
Dead/minor/foreign/unsupported/rescue-pending requests refuse before mutation.
The deprecated `setSupplier` now refuses grade changes rather than exposing a free
bypass. Its old API-specific assertion was changed to the approved refusal contract;
finance economic tests are preserved. A2 tests still cover all three grades’ cost,
quality/customer tradeoffs and staff wording, now through current-pitch acceptance.

`businessYear` reads actual accepted goods quality and COGS cost. Annual simulation
applies loyalty only when the selected event ID is `supplier-hike`; all other
modifiers, event weights and settlement/P1 rescue rules stay intact. Current generic
suppliers use the old grade anchors with no loyalty. Accepted agreements survive
annual advance, acquisitions and actual descendant continuation; same-world-year
usage is preserved. Suppliers are fictional named wholesalers, not real endorsements.

The owned business Suppliers section shows current and pitched name/grade, relative
supply cost, goods quality, loyalty and what it protects. Search/Accept/Pass call
real store commands and autosave; quota and stale refusals use spoken language.
There is no up-front invoice or card selector for free selection. Actual goods
remain an annual business expense. The screen has no supplier section for unsupported
types and does not make profit promises.

Save v49 keeps optional `supplierAgreement` and `supplierSearch` on each held
business. A pure v48 migration grants no contract, loyalty, spending or search.
Validation enforces grade/rounded quote bounds, named IDs, years, successful count,
current pending ordinal and no simultaneous accepted/pending ID. Retired legacy
business types remain readable and refuse new searches. Current-version expectations
in earlier save tests were advanced to v49 without changing their old input fixtures.

## Production calibration after approval

Scratch harness uses two disjoint groups of 300 seeds, actual opening of each of
the 20 relevant types, real search/accept commands and stable same-business keys.
Five pitches per seed are applied to all types: **60,000 search/accept cases**,
**60,000 exact matches** to the approved algebraic quote counterfactual, plus
**12,000 annual settlements**. Opening uses funded adult access fixtures; the
mature kernel normalizes luck/pay/price/location/reputation and lets the manager
respond for 40 iterations. These are operating probes, not a forecast of household
wealth or survival. Each command checks unchanged money and before-call RNG;
annual payouts are posted and reconciled, with shortfalls retained for explicit P1 review.

| Measure                                                          | Group A          | Group B          |
| ---------------------------------------------------------------- | ---------------- | ---------------- |
| Budget / Standard / Premium pitches                              | 547 / 488 / 465  | 497 / 487 / 516  |
| Five-pitch sequences without Budget                              | 31/300           | 40/300           |
| High-loyalty pitches                                             | 503/1,500        | 539/1,500        |
| Median same-grade profit shift, mature-revenue percentage points | 0.087            | 0.118            |
| Individual profit shift range, same units                        | −9.320 to +8.964 | −9.228 to +9.246 |
| Median perfect-information best-five bound above best old grade  | 0.420            | 0.420            |
| Largest best-five bound                                          | 5.645            | 5.645            |
| Median conditional 7.5% hike operating-profit protection         | $3,027           | $4,388           |

The bound permits retaining the best legacy grade and knows future operating
results; it is not a promised player return. Conditional hike protection is measured
only when a hike happens, with mature manager response; it is not an annual discount.
The pre-approval 240,000 weighted event contexts still establish hike rarity; selection
weights are unchanged and real weighted-hike annual tests cover all three loyalties.
Production keys include the business identity, so these seed outputs intentionally
supersede the proposal’s isolated counterfactual sample rather than pretending its
previous exact distribution was a contractual guarantee.

## Sabotage verification

Tar backup preceded mutation; every mutated source was restored and both MD5 and
SHA-256 checked. **26 distinct behavioral defects are caught, none missed after
repair.** First pass caught 25; allowing Pass with a replaced pitch ID survived.
The tests already refused stale acceptance but only tested stale Pass after clearing
the offer. Added an explicit old-ID Pass check while a new offer is pending; rerunning
that mutation fails. This was a test gap, not a production-code defect left in place.

Caught cases: four searches; six searches; browsing inflates usage; count resets;
stream RNG consumed; replaced-ID acceptance; replaced-ID Pass; acceptance alters cost;
acceptance leaves pending; acceptance spends another search; next-year quota never
resets; goods quality ignored; quoted COGS ignored; loyalty discounts whole bill;
loyalty shields every event; annual reader drops loyalty; deprecated grade bypass;
unvaried cost; unvaried quality; dead owner allowed; minor owner allowed; supplier-free
type allowed; rescue ignored; malformed save accepted; missing store dispatch;
missing autosave. This is targeted behavioral mutation testing, not exhaustive proof.

## Verification and open checks

All **15 typechecks and 3,139 tests pass** (59 net additions, including updated A2
coverage). Full `pnpm verify` ran; the first run found two new uncontracted screen
phrases, corrected to spoken contractions, alongside the seven inherited generator
mismatches. The final full `pnpm verify` passes all 15 typechecks and all 3,139 tests;
content validation fails only the seven inherited generator mismatches. PR/CI are
recorded below when checked.
Full formatting still reports the same 22 inherited historical notes; changed files
are formatted. Validator rewrites of the secondary vehicle-mod catalog were restored
only after semantic equality with HEAD was checked; no catalog rewrite is committed.
Native/device checks and unavailable Claude Project mirroring remain open. No edits
to `approved-decisions.md`, TICKET 0708, event wording, P13 or unrelated rules.
