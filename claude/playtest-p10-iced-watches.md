# Playtest P10 — approved iced-out watches

Status: Payton approved the full proposal on 8 October 2026. Built on
`feat/playtest-p10-iced-watches`, stacked on P9 PR #21 while main remains `beff25a`.
The separate approval/claim commit reserves save v47 before production edits.
The measurement and proposal below document what was approved; implementation,
verification and remaining checks are recorded at the end. P11 and life-event wording wait.

## Requirement and binding scope

P10/B14 in `playtest-rules-brief.md` and `playtest-backlog.md`: buy an iced-out watch
or customize an owned watch; the value effect belongs to each watch's catalog entry
and customization belongs to the held piece. Watches that lose their collector value
should lose it; basic watches such as a G-Shock should gain value from the added stones.

Spec 140 (asset treatment), 199 (collector demand), 1043–1059 (recognizable analogues,
balance and reconciliation), 1078–1088 (catalog/pricing), 1108–1140 (saves/RNG),
1281 (provenance), 1363–1366 (curated Shopping under Assets) and 1890–1893
(automatic collection shelves, one general sale button). Read the existing 0506
contract, current finance/simulation shopping, held fields, annual readers, screens
and inheritance handoff. No extra stat, fame benefit, movement specification,
manufacturer model, auction mode, catalog search or manual collection management.

Allowed implementation files after approval: valuables authoring source/data and
content type/tests; finance valuables and tests; simulation shopping and tests;
mobile ShoppingScreen, store and screen tests; persistence schema/migrations/tests;
owned validator rules, public exports and P10/docs/CORE_RULES. Protected contracts:
held-valuable save shape and financial command wiring, authorized by the playtest
brief subject to approval here. TICKET 0708 remains protected and unchanged.

## Actual baseline, before any production change

Scratch `p10-checkpoints/measure.ts` outside git. Actual `storeStock`, `buyValuable`,
`collectionOf`, `estateOf`, `sellValuable`, `reconcile` and `runValuablesYear` were used,
not stub offers. A fixed-seed adult with $100m of prior-year posted funds isolates
catalog access, including the existing $20m piece. Searched successive annual
counters until each of the 55 actual watches was offered. Each was bought and sold
through the real commands. This is a capability/valuation probe, not a passive life
or a claim that ordinary players buy a $20m watch.

All 55 purchases/sales reconcile, use the held resale value for sale/estate/collection,
leave immediate stats unchanged and consume no RNG stream draws. There are five
fashion watches, 39 ordinary watch entries and eleven sought entries. No held
piece has an icing field or custom action. The existing purchase path is cash-only
on this stack; PR #10's general payment work is still unmerged. P9 provides the
shared payment helper/selector that P10 can reuse for the total invoice.

Ordinary fashion/watch/sought purchase recovery is 35%/75%/115%. The eleven sought
pieces therefore already allow an immediate 15% original-watch markup. Preserve
that approved original-watch rule; P10 must not silently rebalance it. There are
55 existing watch models, not 55 new models to invent. The Jakob & Co. Billionaire
Timeless Treasure is already factory-set with yellow diamonds and must not receive
an aftermarket penalty or be charged to be iced again.

For each held piece, the actual annual reader was then run for ten years across
100 independent seed keys. Market years and stock ID are held fixed per watch;
this measures asset-value paths, not income/household/death outcomes. The same ID,
market years and seed keys are retained for the candidate comparison below.

| Watch                                     | Actual paid | Initial resale | Ten-year median resale, original |
| ----------------------------------------- | ----------- | -------------- | -------------------------------- |
| Casiot G-Shok                             | $120        | $42            | $17                              |
| Tissoe PRZ                                | $710        | $533           | $586                             |
| Rolux Subaquatic                          | $10,400     | $11,960        | $18,588                          |
| Rolux Day-Date President                  | $38,490     | $28,868        | $31,689                          |
| Richard Millon RM 35                      | $248,950    | $286,293       | $437,036                         |
| Jakob & Co. Billionaire Timeless Treasure | $19,604,860 | $14,703,645    | $15,825,233                      |

## Approved product rule and numbers

Keep the 55 model IDs, names, prices, rarity, stores and original holds unchanged.
Add explicit per-watch metadata for eligibility, fixed custom-work cost and value
effect. Engine readers use those fields rather than maker/name matching. Proposed
53 customizable models, one factory-set model and one excluded smartwatch (Orchard
Watch Ultra). A diamond-covered accessory is not a new smart-watch model in this slice.

Proposed costs are whole dollars in the existing constant-dollar economy. They are
balance choices, not maker MSRPs or empirically measured jeweler quotes. Each current
watch receives its exact fixed cost below; no hidden player wealth tier or price slider.

| Original catalog retail | Custom-work cost | Current eligible models |
| ----------------------- | ---------------- | ----------------------- |
| Below $1,000            | $2,500           | 11                      |
| $1,000–$9,999           | $5,000           | 24                      |
| $10,000–$49,999         | $10,000          | 16                      |
| $50,000–$249,999        | $25,000          | 0                       |
| $250,000 and above      | $50,000          | 2                       |

The unused $25k band does not add a model or a player-facing tier. The full explicit
manifest below is what would be authored, not a runtime price derived from the name.

One-time value effect, applied to the piece's **current resale value**, never to
catalog retail or all the money spent:

- Four basic fashion watches (Casiot G-Shok, Casiot Gold Digital, Timexa Weekender,
  Fossell Chronograph): retain current value and recover **40% of custom-work cost**.
  That adds $1,000 at the proposed $2,500 price. It raises what the watch can fetch
  while still costing $1,500 of net worth. This is Payton's requested positive case,
  not a claim that every modified Casio has a guaranteed real-world resale premium.
- Thirty-eight ordinary mechanical-watch entries: retain **80% of current value**;
  no extra resale recovery of customization cost. The loss is 20%, in addition to
  paying for the work.
- Eleven sought collector entries: retain **65% of current value**; no extra
  recovery of customization cost. The 35% loss removes much of their original-piece
  collector premium. No repeated annual penalty.
- Existing factory-set Jakob: unchanged; display its factory-set status. No second
  custom-work charge. Orchard smartwatch: no aftermarket icing option.

Aftermarket pieces use the existing **precious** annual market/drift (mean +0.5%,
spread 8%, $1 minimum) rather than continuing an original-watch collector premium
or shrinking a diamond-set basic watch toward the bare-watch fashion floor. This
is an explicit additional balance proposal. Original and factory-set watches retain
all current annual rules. The aftermarket switch happens only after a paid action,
not while migrating or merely viewing an old save. No new inflation or demand model.

### Candidate comparison, using existing readers

Scratch `candidate.ts` applies these proposed one-shot values and calls the actual
`valuableYear` with a precious-market catalog clone. This is **not** a production
icing command or a finished feature. All 53 hypothetical modifications lower net
worth immediately after paying; none creates an instant modification profit.

| Watch                    | Custom cost | Resale before | Resale after | Immediate net-worth change | Ten-year median after icing |
| ------------------------ | ----------- | ------------- | ------------ | -------------------------- | --------------------------- |
| Casiot G-Shok            | $2,500      | $42           | $1,042       | −$1,500                    | $1,258                      |
| Tissoe PRZ               | $2,500      | $533          | $426         | −$2,607                    | $513                        |
| Rolux Subaquatic         | $10,000     | $11,960       | $7,774       | −$14,186                   | $8,406                      |
| Rolux Day-Date President | $10,000     | $28,868       | $23,094      | −$15,774                   | $27,529                     |
| Richard Millon RM 35     | $50,000     | $286,293      | $186,090     | −$150,203                  | $213,050                    |

The loss on a sought piece is intentionally larger. A ready-iced purchase must
compute original resale on the **base watch price**, then apply the same modifier;
never apply 115% recovery to a total invoice that includes diamond work.

## Buying, customizing and payment

Reuse the existing StoreScreen and CollectionsScreen; no new screen/nav route.
On an offered eligible watch, expand the row to choose **Original** or **Iced-out**.
Show the base price, custom-work price, total and actual resulting resale before
payment. The ready-iced option is a purchasable configuration of the same offered
watch, not a fabricated new maker reference. Buying either consumes the same stable
stock slot so both variants cannot be bought from it. Keep existing store/age/means
gates, sizes, stock order and RNG keys; no new random icing rarity or broad catalog growth.

On an owned eligible watch's expanded collection row, retain the general Sell action
and add **Have it iced out**, with cost and resale before/after. The next explicit
payment button performs the action. Show aftermarket/factory-set status and paid
year/cost in the holding's description. No re-icing, reversal/removal or stat reward.
An already modified piece gets a plain reason such as “This one's already iced out.”
The proposed configuration/action shape is part of this approval request.

Use the shared cash/card contract already present after P9. Charge the full invoice
on the explicitly selected eligible method, rechecking current quote, ownership,
watch eligibility, already-done status, card status and available credit before
posting. No funded intermediate save and no cash fallback. Original purchases are
still backward compatible but their existing screen gains the same cash/card selector
needed for a ready-iced purchase. Classify funding as debt transfer and acquisition/
customization as property, consistent with existing watch purchases. No change to
card limits, unrelated purchase flows or tax rules.

Proposed held field: optional `icing: { cost: Money, year: number }` for paid aftermarket
work. Retain `purchasePrice` as the **base watch component** for both paths and track
custom-work cost separately. Ready-iced UI/receipt must show the full total; acquisition
spend is derived from base purchasePrice plus icing.cost, never stored twice or added
twice. For later customization, preserve original boughtYear/price and show the work's
own year/cost. `value` remains the one canonical sale/estate/collection appraisal;
only the successful command revalues it, and normal annual settlement moves it later.
Factory setting is catalog metadata and does not require rewriting an old holding.

Known reproductions cannot be customized. Hidden counterfeit flags remain hidden and
unchanged: customizing does not certify a watch, clear fake/reproduction flags or
bypass its normal next-year appraisal loss. The existing counterfeit appraisal can
still cut the modified piece's value; no separate gemstone salvage valuation is
invented. Preserve inheritedFrom and stable IDs through customization and descendants.
Unknown legacy catalog IDs remain safely held at their existing value and cannot be
customized without known eligible metadata.

## Save and verification plan after approval

Propose save **v47**, reserve it in CLAIMS before production edits if still the next
unused version. Upgrade v46 without random draws, changing balances or repricing any
held watch; absent icing stays absent. Validate integral nonnegative cost, valid year
(inherited work can predate the child's birth), eligible held shape and provenance.
Old saves including the existing factory-set Jakob remain untouched in value/status.
No version has been reserved or schema edited during this measurement pass.

Tests: all per-watch fields/eligibility and protected original catalog fields, byte
reproducible generator, same-stock original/iced exclusion, full price/resale previews,
one-time current-value effect, all 53 no instant modification profit, no 115%-of-total
invoice bug, normal/iced/factory annual readers and floors, no repeat penalty/charge,
plain refusals, stale/missing/frozen/short-credit atomicity, original receipt compatibility,
real mobile/store/save command paths, counterfeit appraisal flags, estate/sale value,
provenance/descendant handoff, no-RNG migration, old/new save round trips and identical
replay. At least 15 distinct behavioral sabotage trials with tar backup/exact MD5
restoration, then full pnpm verify, owned formatting and a PR into main. Preserve
seven current pre-existing generator mismatches and 22 old-note formatting failures
as explicit blockers rather than silently changing them.

Native-device checks and Claude Project mirroring remain unavailable. The proposal
was measured before production edits; see the completed implementation results below.

## Calibration references and limits

- [Rolex guarantee](https://www.rolex.com/en-us/buying-a-rolex/the-rolex-guarantee):
  materially modified non-genuine components are distinguished from an original
  manufacturer watch. This supports separating aftermarket and original status;
  it does **not** establish an exact 20% or 35% resale penalty.
- [Jacob & Co., Billionaire Timeless Treasure](https://jacobandco.com/news/billionaire-timeless-treasure)
  and [official Japanese model page](https://jacobandco.jp/timepieces/billionaire-timeless-treasure/):
  a gem-set manufacturer creation already exists. The existing P8 model and $20m
  catalog price stay; no invented movement or new factory reference is added.

All custom-work prices, recovery fractions and the precious-market switch above are
proposed gameplay calibration. There is no defensible universal aftermarket appraisal
percentage from these sources. The G-Shok increase follows Payton's requested game
rule; it is not an investment recommendation or a verified market arbitrage.

## Full proposed per-watch manifest

| Catalog ID                        | Watch                                     | Proposed custom cost | Current-value share | Custom-cost recovery | Policy               |
| --------------------------------- | ----------------------------------------- | -------------------- | ------------------- | -------------------- | -------------------- |
| val.watch.casiot-g-shok           | Casiot G-Shok                             | $2,500               | 100%                | 40%                  | Aftermarket          |
| val.watch.casiot-gold             | Casiot Gold Digital                       | $2,500               | 100%                | 40%                  | Aftermarket          |
| val.watch.timexa-weekender        | Timexa Weekender                          | $2,500               | 100%                | 40%                  | Aftermarket          |
| val.watch.fossell-chrono          | Fossell Chronograph                       | $2,500               | 100%                | 40%                  | Aftermarket          |
| val.watch.seyko-presago           | Seyko Presago                             | $2,500               | 80%                 | 0%                   | Aftermarket          |
| val.watch.seyko-diver             | Seyko Prospect Diver                      | $2,500               | 80%                 | 0%                   | Aftermarket          |
| val.watch.tissoe-prx              | Tissoe PRZ                                | $2,500               | 80%                 | 0%                   | Aftermarket          |
| val.watch.hamiltone-khaki         | Hamiltone Khaki Field                     | $2,500               | 80%                 | 0%                   | Aftermarket          |
| val.watch.apple-ish               | Orchard Watch Ultra                       | —                    | —                   | —                    | no aftermarket icing |
| val.watch.tagg-carrara            | Tagg Heuser Carrara                       | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.tagg-monako             | Tagg Heuser Monako                        | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.tudar-black-cove        | Tudar Black Cove                          | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.longinez-spirit         | Longinez Spirit                           | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.oris-diver              | Orys Aquis Diver                          | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.breitlong-navigator     | Breitlong Navigator                       | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.grand-seyko-snowflake   | Grand Seyko Snowflake                     | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.omegon-speedmeister     | Omegon Speedmeister Moonwatch             | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.omegon-seamarine        | Omegon Seamarine 300                      | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.cartrier-tanque         | Cartrier Tanque                           | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.cartrier-santo          | Cartrier Santo                            | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.rolux-datesure          | Rolux Datesure 41                         | $5,000               | 65%                 | 0%                   | Aftermarket          |
| val.watch.rolux-subaquatic        | Rolux Subaquatic                          | $10,000              | 65%                 | 0%                   | Aftermarket          |
| val.watch.rolux-gmt               | Rolux GMT-Voyager                         | $10,000              | 65%                 | 0%                   | Aftermarket          |
| val.watch.rolux-daytonna          | Rolux Daytonna                            | $10,000              | 65%                 | 0%                   | Aftermarket          |
| val.watch.rolux-day-date          | Rolux Day-Date President                  | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.iwc-pilot               | IWK Big Pilot                             | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.jaeger-reverso          | Jaegar-LeCoultray Reverso                 | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.panerai-luminor         | Panarai Luminor                           | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.zenith-chrono           | Zenyth El Primero                         | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.blancpain-fifty         | Blancpane Fifty Fathoms                   | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.ap-royal-ash            | Audemar Pigot Royal Ash                   | $10,000              | 65%                 | 0%                   | Aftermarket          |
| val.watch.patrek-calatrova        | Patrek Phillon Calatrova                  | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.patrek-nautilos         | Patrek Phillon Nautilos                   | $10,000              | 65%                 | 0%                   | Aftermarket          |
| val.watch.vacheran-overseas       | Vacheran Constantine Overseas             | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.langer-lange1           | A. Langer & Sohn Lange 1                  | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.millon-rm               | Richard Millon RM 35                      | $50,000              | 65%                 | 0%                   | Aftermarket          |
| val.watch.patrek-grand-comp       | Patrek Phillon Grand Complication         | $50,000              | 65%                 | 0%                   | Aftermarket          |
| val.watch.rolux-yacht-voyager     | Rolux Yacht-Voyager                       | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.rolux-perpetual         | Rolux Oyster Perpetual 36                 | $5,000               | 65%                 | 0%                   | Aftermarket          |
| val.watch.rolux-explorer          | Rolux Explorer 36                         | $5,000               | 65%                 | 0%                   | Aftermarket          |
| val.watch.seyko-alpinist          | Seyko Alpinist                            | $2,500               | 80%                 | 0%                   | Aftermarket          |
| val.watch.tissoe-gentleperson     | Tissoe Gentleperson                       | $2,500               | 80%                 | 0%                   | Aftermarket          |
| val.watch.hamiltone-ventura       | Hamiltone Ventura Auto                    | $2,500               | 80%                 | 0%                   | Aftermarket          |
| val.watch.grand-seyko-birch       | Grand Seyko White Birch                   | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.tudar-pelagos           | Tudar Pelagos                             | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.longinez-legend-diver   | Longinez Legend Diver                     | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.orys-pointer-date       | Orys Big Crown Pointer Date               | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.omegon-aquaterra        | Omegon Aquaterra                          | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.cartrier-ballon         | Cartrier Ballon Bleu                      | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.breitlong-superocean    | Breitlong Superocean 42                   | $5,000               | 80%                 | 0%                   | Aftermarket          |
| val.watch.ap-royal-ash-offshore   | Audemar Pigot Royal Ash Offshore          | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.patrek-aquanote         | Patrek Phillon Aquanote                   | $10,000              | 65%                 | 0%                   | Aftermarket          |
| val.watch.vacheran-patrimony      | Vacheran Constantine Patrimony            | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.langer-saxonia          | A. Langer & Sohn Saxonia Thin             | $10,000              | 80%                 | 0%                   | Aftermarket          |
| val.watch.jakob-timeless-treasure | Jakob & Co. Billionaire Timeless Treasure | —                    | —                   | —                    | factory-set          |

## Implementation and release checks (9 October 2026 UTC)

Built the approved manifest for all 55 existing watches without changing any original
catalog field. Fifty-three policies are aftermarket, one factory-set, one unavailable.
The generator reproduces exact tracked bytes; content validation checks policy shape,
positive integral cost and bounded shares. Existing catalog membership, store sizes,
selection keys, rarity and stock IDs remain unchanged.

`buyValuable` remains backward compatible and accepts explicit payment and finish.
Both configurations consume the same stock slot. `valuablePurchaseQuote` values the
base watch first; `iceValuable` uses the held watch's current appraisal, preserves
base price/year, provenance and hidden counterfeit flags, and refuses repeat work
and known reproductions before payment. The full invoice is charged atomically through
`payPurchase`; card funding remains debt transfer and work/acquisition remains property.
`valuableIcingQuote` supplies the same cost/resale preview to the collection screen.
Original non-watch purchases gain the existing payment selector on that same screen.

The actual GameProvider/store actions persist purchases and work, and report spoken
refusals. Existing screens show Original/Iced-out choices, full invoice and resale,
work cost/year, base acquisition year/price and total paid once. Factory diamonds are
labeled separately. The general Sell action stays available. No new route, stat reward,
reversal, grading control, mythical-watch model or unrelated purchase flow was added.

Save v47 was reserved in its own claim commit before implementation. Its v46 migration
changes only the version, without RNG, balance changes, repricing or invented work.
Validation requires integral nonnegative paid cents, valid work/acquisition years and
eligible known catalog pieces; historical work can predate an heir's birth. Unknown
retired IDs preserve their held data/value. Paid work survives serialization, reload,
actual annual appraisal and real descendant handoff. Factory-set legacy holdings are
unchanged. Existing P7–P9 current-version assertions now expect 47, while historical
migration fixtures remain historical. P8's frozen legacy catalog hash excludes only
the newly approved metadata; every original catalog field remains hash-protected.

Post-build scratch `production.ts` used real offers and both paid commands on all 53
eligible references. The paid paths produce identical holdings, all transactions
reconcile, all initial values/net-worth losses match the proposal, and all ten-year
p10/median/p90 values match the approved candidate across the same 100 seed keys.
This is the same focused asset probe as the pre-build measurement, not a new passive
population model. All 53 modifications lower immediate net worth; the original 115%
sought-watch recovery remains a separate existing finding.

### Independent sabotage verification

Tar backup of all ten mutated source/data files before trials. Each trial restored
original bytes, introduced one behavioral mutation, ran the real targeted Vitest suite,
and required assertion failures rather than a compile/import failure to count as
caught. Final restoration checked every original MD5. A descendant-patch harness
anchor was corrected before running that trial; it is not counted as a mutation.
**31 distinct behavioral mutations caught; none missed.** Screens, engine, catalog,
payment helper, migration validation, serialization and actual inheritance are covered.

| Trial | Behavioral mutation                                  | Result |
| ----- | ---------------------------------------------------- | ------ |
| 1     | G-Shok cost changed                                  | Caught |
| 2     | G-Shok recovers all custom spend                     | Caught |
| 3     | Subaquatic retains original collector value          | Caught |
| 4     | Factory watch offered aftermarket work               | Caught |
| 5     | Smartwatch offered aftermarket work                  | Caught |
| 6     | Modifier uses retail rather than current value       | Caught |
| 7     | Modifier drops gemstone recovery                     | Caught |
| 8     | Aftermarket yearly precious switch absent            | Caught |
| 9     | Original and factory watches switch yearly market    | Caught |
| 10    | Iced fashion still has bare-watch floor              | Caught |
| 11    | Customization penalty repeated annually              | Caught |
| 12    | Counterfeit avoids ordinary appraisal                | Caught |
| 13    | Ready purchase charges base watch only               | Caught |
| 14    | Ready purchase saves full invoice as base price      | Caught |
| 15    | 115 percent resale applied to full custom invoice    | Caught |
| 16    | Owned customization can be repeated                  | Caught |
| 17    | Known reproduction can be customized                 | Caught |
| 18    | Ready card debt result discarded                     | Caught |
| 19    | Customization card debt result discarded             | Caught |
| 20    | Customization revalues all held watches              | Caught |
| 21    | Customization erases inherited and hidden fake flags | Caught |
| 22    | Saved work discarded on reload                       | Caught |
| 23    | Save work accepts negative cost                      | Caught |
| 24    | Save work accepts future year                        | Caught |
| 25    | Descendant loses paid work                           | Caught |
| 26    | Purchase store ignores finish and payment            | Caught |
| 27    | Customization store ignores card selection           | Caught |
| 28    | Store screen ignores iced configuration              | Caught |
| 29    | Payment accepts stale invoice                        | Caught |
| 30    | Payment accepts frozen card                          | Caught |
| 31    | Payment accepts insufficient card credit             | Caught |

### Validation and open work

Release checks: 147 new P10 tests; 3,014 tests total and all 15 typechecks pass.
Full `pnpm verify` reaches content validation, then exits nonzero on the same seven
inherited generator mismatches: activities, advice, auctions, businesses,
events-childhood, homes and vehicles. No P10-owned validation failure remains.
The validator's secondary vehicle-mods formatting output was restored only after
confirming identical parsed JSON (CORE_RULES 13.155). Full formatting still fails on
22 historical notes; all changed files pass. No existing test was deleted or weakened.

Native/on-device checks and Claude Project `project_write` mirroring are unavailable
in this environment and remain explicitly open. The branch follows P9 PR #21 and
depends on P1–P9 PRs #13–#21; main is still `beff25a` after refreshing origin. Payton
merges the stack. TICKET 0708 stays untouched. P11 and life-event wording wait.

### Published PR

[P10 PR #22](https://github.com/PaytonBlevins/YearAfter/pull/22) targets main and is
mergeable when checked, following P9 #21 and depending on P1–P9 #13–#21. Production
commit `917e729` is published. Implementation CI run 132
([Actions](https://github.com/PaytonBlevins/YearAfter/actions/runs/37862995155)) is
confirmed failed at formatting on exactly the same 22 historical Claude notes.
Install succeeded; typecheck, unit tests and content validation were skipped after
formatting failed. The job logs were read, not inferred from local results. Local
release results and inherited blockers are recorded above. Checkout and published tree match exactly.
