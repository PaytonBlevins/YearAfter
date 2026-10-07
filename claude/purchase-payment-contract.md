# Purchase payment choices — UI ready; engine contract required

Payton asked Agent B to proceed on 6 October. The request applies to **all
purchases that fit the chosen card's available credit**, including future
vacations. Watches and art were examples, not a whitelist.

Branch `feat/purchase-payment-choices` is based on main `14144ca`. The selector
was claimed before code in commit `f0db08c`.

**Spec sections:** 25–32 (card fields, limits, freezing and repayments),
44–46 (asset transfers), 1043–1059 (reconciliation), 1213–1223 (integer money).
**Allowed files for this pass:** shared mobile payment component, component
tests and notes. **Protected areas touched:** none. Engine work remains assigned
to Agent A by HANDOFF section 0; this pass does not implement engine rules.

## Current blocker, checked against main

`buyValuable(state, stockId)` checks cash and posts a property purchase.
`buyHome` takes cash/mortgage; `buyVehicle` takes cash/loan. Renovations and
auction bids also use cash. None accepts a selected card. `drawFrom` covers
ordinary yearly shortfalls using cards in APR order; it is not a selected-card
purchase command. Calling it from a screen would move engine policy into UI
and could charge the wrong card or leave a failed purchase partially funded.

The shared selector is therefore **not mounted in live purchase screens yet**.
No existing purchase has acquired working card payment in this PR. Its callback
hands a choice to a future purchase command; it does not post money or update
cards. This is concrete UI preparation, not a completed payment feature.

## UI behavior ready for integration

`PurchasePaymentChoices` accepts a purchase name, exact-cent total, cash,
held cards and a confirmation callback. It offers cash and each held card.
Each card shows its product name, APR, limit and available credit. Frozen,
unknown and insufficient-credit cards are disabled with plain reasons.

Choosing a method does not purchase anything. A separate button names the
amount and selected method before handing the choice back. It revalidates cash,
card presence, balance and price on rerender and before dispatch. Cards are not
combined automatically. No purchase-kind whitelist or separate purchase cap is
introduced. The callback contract is proposed, not an existing engine export:

```ts
type PurchasePayment =
  { readonly kind: 'cash' } | { readonly kind: 'card'; readonly productId: string };
```

## Concrete engine contract proposed for Agent A

Export a shared eligibility reader for an exact-cent amount and an atomic
purchase-payment command. Every caller passes the selected method; existing
calls default to cash. Readers and commands must use the same card rules.

1. Validate the purchase, current price, age, ownership, slot limits and all
   existing domain rules first. A payment method must not bypass these gates.
2. For cash, require the full price. For a card, require that exact held card,
   known product, open status and sufficient **available** credit. Equality
   at the available-credit boundary succeeds; one cent above fails.
3. On success, increase only the selected card's balance by the purchase total.
   Cash stays unchanged for a full card purchase. Existing finance entries must
   reconcile exactly and preserve asset-transfer versus spending categories.
   If the ledger records an advance plus purchase, both commit atomically;
   no temporary funded state may escape to UI, saving or a failed purchase.
4. A refusal changes no cash, card, ledger, asset, answer or timeline state.
   An already bought or vanished item cannot charge a card on replay.
5. Name the method, total and source in the outcome/timeline. Keep existing
   interest, minimum-payment, freezing and credit-utilization behavior; do not
   promise interest-free purchases or introduce unmeasured rewards.
6. Return typed refusal reasons. The screen reads eligibility before presenting
   a choice, but the command checks again when the player confirms.

Use the existing saved card balance and ledger shape if possible. Any necessary
save change belongs to Agent A and requires its usual migration checks.

## Integration inventory

| Purchase area                            | Existing command or owner                                                | Expected integration                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Stores, watches, art and collectibles    | `buyValuable`                                                            | Full quoted price, cash or chosen card                               |
| Homes                                    | `buyHome`                                                                | Add full card purchase beside cash and existing mortgage option      |
| Vehicles                                 | `buyVehicle`                                                             | Card for the actual payable total; preserve trade-in and loan rules  |
| Renovations                              | `renovate`                                                               | Current quoted renovation total                                      |
| Auctions                                 | `bidOn`, `attendAuction`                                                 | Validate the full payable bid/fees, not an understated headline bid  |
| Business startup, purchase and expansion | `openBusiness`, `buyBusiness`, `expandBusiness`                          | Explicit selected-card path; preserve existing loan financing        |
| Other priced actions                     | Creator startup/collaboration, paid services and other purchase commands | Reuse the shared contract; do not add item-type exclusions           |
| Investment/deal purchases                | Existing investment and private-deal purchase commands                   | Preserve their domain gates while applying the same payment contract |
| Vacations and future purchases           | Future feature owner                                                     | Shared eligibility/payment contract from the start                   |

Financed purchase down-payments and any split-payment UI are separate from the
proposed first implementation: cash or one card pays the full actual total.
Existing loan/mortgage choices continue under their current rules. This does
not limit what can be purchased outright on a card that can cover the total.

## Acceptance required for the completed feature

- A real store purchase works on the selected card with insufficient cash.
- Every integrated purchase route accepts an eligible card without a kind
  whitelist. Future vacation code uses the shared contract.
- Available credit, frozen cards, changed prices and vanished items are checked
  at confirmation; failures leave the whole state unchanged.
- Multiple cards charge only the chosen card; no automatic cheapest-card choice.
- Amounts, ledger reconciliation, asset value, cash and debt are correct.
- The purchase survives save/load; later card interest, repayments and freezing
  still work; cash/loan/mortgage paths continue to work.
- Component, engine/integration, sabotage and full verification checks run.

## UI verification and remaining work

Fifteen component tests cover separate selection/confirmation, generic purchase
names (including vacations), exact limits, cents, available versus total credit,
a second selected card, no automatic aggregation, freezing, insufficient cash,
no cards, changed balance/price and removed cards. Fake held-card fixtures
exercise the real public card readers; no engine purchase success is claimed.

Live purchase wiring, engine integration, full end-to-end purchase tests and
native-device checks are pending. The selector is ready for review while the
engine contract is assigned. Life-event wording remains last.

### Verification results

- `pnpm verify`: all typechecks and **2,256 tests** pass, including 96 mobile
  tests. Content validation then fails with the same nine generator/catalog
  mismatches already reproduced on untouched main. No content data was changed;
  the validator's vehicle-mods rewrite was restored.
- Sabotage verification: eight mutations caught by component assertions; none
  missed. Mutations used total limit instead of available credit, allowed frozen
  cards, rejected the exact credit boundary, bypassed cash affordability,
  charged on selection, dispatched cash for a card, removed the stale-confirmation
  guard, and imposed a $5,000 card-purchase cap. Original source SHA-256 restored.
- Changed-file formatting and `git diff --check` pass.
- Native-device checks and real engine purchase tests remain pending. These
  checks establish selector behavior only, not working card-funded purchases.
