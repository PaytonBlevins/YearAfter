# Explicit purchase payments — engine and mobile integration

Payton authorized Agent B to implement the engine on 6 October, overriding the
HANDOFF section 0 engine boundary for this feature. Work is on
`feat/purchase-payment-choices`, [PR #10](https://github.com/PaytonBlevins/YearAfter/pull/10),
based on main `14144ca`. The initial UI claim preceded code; engine ownership
was claimed in a separate commit after authorization.

**Spec sections:** 25–32 (cards), 41 (auctions), 44–46 (asset transfers),
1043–1059 (financial reconciliation), 1213–1223 (integer money).
**Allowed files:** finance payment helpers/summary, simulation purchase commands,
mobile purchase screens/store, tests and these ownership/status notes.
**Protected changes:** purchase-command optional payment arguments, explicitly
authorized by Payton. No save shape, catalog prices, balance constants or rewards
changed. `approved-decisions.md` and CORE_RULES are unchanged.

## Requirement and measurement

Cards must be an explicit way to pay for any eligible purchase up to their
available credit. Watches and art were examples, not a whitelist. Future
vacations use this same contract when that feature exists.

Before this build, `buyValuable` with zero cash and an open card still returned
`cannot-afford`. Homes/cars accepted cash or their existing financing, while
renovations, auctions and business purchases had no selected-card path.
`drawFrom` serves annual shortfalls in APR order; it cannot express a chosen
purchase card. No calibration values are needed for the new path: the charge
is the actual existing quoted price, and available credit is limit minus balance.

## Engine contract

`@yearafter/finance` exports:

```ts
type PurchasePayment =
  | { readonly kind: 'cash'; readonly expectedTotal?: Money }
  | { readonly kind: 'card'; readonly productId: string; readonly expectedTotal?: Money };
```

`purchaseEligibility(cash, cards, total, payment)` returns a typed refusal or
`undefined`. `payPurchase(ledger, cards, year, age, total, category, source, payment)`
returns a `Result` containing the new ledger and cards. It doesn't know item
kinds and imposes no additional purchase cap. Existing commands default to cash.

The purchase command validates its current item, price and domain rules before
calling the payment helper. A selected card must still be held, have a known
product, be open and have sufficient available credit. Equality succeeds; one
cent above fails. It increases only that card's balance by the charge. A positive
`debt` funding entry and the normal negative purchase entry are posted atomically;
no intermediate funded state can be saved or returned. Cash remains unchanged
for a full card purchase, and the ledger reconciles exactly.

The UI sends `expectedTotal` on confirmation. A changed price refuses the
purchase and asks the player to review it again. Card/loan combinations are
refused; existing mortgage and business/car loan paths keep their own rules.
There is no split across cards or automatic selection of the cheapest card.

`PaymentRefusal` labels are plain spoken language. Purchase source and timeline
text name the card. Commands with object-shaped errors return
`{ kind: 'payment', reason: PaymentRefusal }`. The existing card balance is saved,
so no migration is needed. Ordinary interest, minimum payments, credit utilization,
freezing and repayments continue through the existing card engine.

## Integrated routes

| Purchase                               | Engine argument                                             | Mobile integration                                     |
| -------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| Watches, art, collectibles             | `buyValuable(state, stockId, payment?)`                     | Store counter selector                                 |
| Homes, rentals and commercial listings | `buyHome(state, listingId, how, payment?)`                  | Outright selector beside mortgage                      |
| Vehicles                               | `buyVehicle(state, listingId, how, tradeInId?, payment?)`   | Vehicle selector beside loan                           |
| Mechanic inspection                    | `inspectVehicle(state, listingId, payment?)`                | Inspection selector                                    |
| Vehicle modifications                  | `fitVehicleMod(state, vehicleId, modId, payment?)`          | Mod selector                                           |
| Renovations                            | `renovate(state, homeId, renovationId, payment?)`           | Builder selector                                       |
| Auctions                               | `bidOn(state, lotId, tier, payment?)`                       | Each bid tier offers payment choices                   |
| Business opening/buying/expansion      | Existing arguments plus `payment?` after `finance?`         | Shared business purchase panel beside loans            |
| Public investments                     | `invest(state, instrumentId, amount, payment?)`             | Amount entry, actual-unit quote, then selector         |
| Private deals                          | `placeInDeal(state, offerId, amount, payment?)`             | Engine ready; 0605 screen integration remains separate |
| Creator startup                        | `openChannel(state, platformId, categoryId, payment?)`      | Engine ready for the other agent's screens             |
| Paid collaborations                    | `answerCollabOffer(state, offerId, answer, payment?)`       | Engine ready for the other agent's screens             |
| Vacations/future purchases             | Call shared eligibility/payment helpers after domain checks | Future feature owner reuses this contract              |

Auction eligibility covers the maximum bid **including premium**. A losing bid
marks the bid but posts no payment. A winning bid charges only the actual final
premium-inclusive price. Storage-unit contents sold afterwards remain real cash
proceeds. The auction button says “Bid up to”; it doesn't promise to charge the
ceiling or charge a losing bid. Attendance has no fee in the existing engine.

Vehicle trade-in proceeds are applied first. The selected card pays only the
remaining price; an unsuccessful purchase returns no sale or charge. Investment
units also round under existing rules, so only units actually bought are charged.
`quoteInvestment` reads that total without requiring cash or fabricating funds.

Access, age, ownership, expansion maturity/profit, offer limits and other domain
gates remain in place. Payment doesn't bypass them or add new items to catalogs.
Annual bills continue their existing billing; this feature introduces explicit
purchase choices rather than a new billing schedule. Life-event wording stays last.

## Accounting correction

The payment integration exposed an existing summary bug: positive `debt` rows
were counted as income. Borrowed funds are now excluded from summary income;
negative debt payments keep their existing outflow treatment. Property and
investment purchases remain transfers. A test checks that buying a watch on a
card adds neither income nor transfer outflow.

## Acceptance and verification

- Real zero-cash shopping can charge the explicitly selected card, give the
  originally quoted item and persist the receipt, asset and debt.
- Cash purchases still work; default engine calls never choose a card.
- Missing/frozen/insufficient cards, stale prices, age/ownership gates and replay
  refuse without changing the full state.
- A second card remains untouched; exact limits and cents work without a kind
  whitelist or purchase cap.
- Auctions, trade-ins, investment rounding, business expansion and paid creator
  collaborations have real engine integration checks.
- Save/load preserves card balances, assets, timeline and reconciled ledger;
  normal next-year interest and freezing still apply.

The existing MoneyCopy test pinned the old cash-and-loan-only startup sentence.
Its expectation now explicitly requires the authorized cash/card/loan wording;
no test was deleted or weakened.

Final verification: all typechecks and **2,298 tests** pass (102 mobile,
628 finance, 835 simulation and 92 persistence). The final `pnpm verify` then
stops at the same nine pre-existing content generator/catalog mismatches
reproduced on untouched main. Content data wasn't changed; the validator's
vehicle-mods rewrite was restored. New/changed TypeScript and the implementation
note pass Prettier; `git diff --check` passes. Existing global Markdown formatting
issues weren't rewritten as part of this feature.

Sabotage verification: **16 mutations caught; none missed**. Each mutation was
run independently and every original source SHA-256 was restored:

| Mutation                                              | Result |
| ----------------------------------------------------- | ------ |
| Total limit substituted for available credit          | Caught |
| Frozen card allowed                                   | Caught |
| Exact-limit payment refused                           | Caught |
| Wrong card charged                                    | Caught |
| Card debt update omitted                              | Caught |
| Funding ledger entry omitted                          | Caught |
| Asset transfer changed to spending                    | Caught |
| Stale confirmation quote ignored                      | Caught |
| Borrowing counted as income                           | Caught |
| Shopping discarded updated cards                      | Caught |
| Auction charged its ceiling rather than winning price | Caught |
| Losing auction bid charged                            | Caught |
| Investment charged requested budget instead of units  | Caught |
| Vehicle trade-in credit ignored                       | Caught |
| UI omitted confirmed quote                            | Caught |
| Store discarded the chosen payment                    | Caught |

Native-device checks remain pending: this environment has neither Android device
tools nor an iOS simulator. Creator/private-deal screen ownership remains as
listed above; the engine arguments are ready for those integrations.
