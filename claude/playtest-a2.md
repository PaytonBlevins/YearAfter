# Playtest A2 — explain business suppliers

Payton authorized working through the playtest notes on 6 October. This follows
A4 and A12 on `feat/playtest-a4-a12`, PR #3. Claimed before implementation in
commit `80e39f1`.

**Spec sections:** 389–400 (business quality, suppliers and pricing), 849–878
(business dashboard). **Allowed files:** mobile screen/tests and notes.
**Protected areas touched:** none.

## Observed and changed

The business screen offered Budget, Standard and Premium under "What you buy
in", without explaining any option. The engine already trades supplier cost
against quality; customers weigh quality against price, and staff also affect
the finished product or service. Better supplies do not guarantee profit.

The section is now called "Suppliers". Each choice has a visible description:
Budget is cheaper but lower quality and may lose customers; Standard is the
middle ground; Premium improves supplies and costs more, with no promise that
extra sales cover it. "Chosen" identifies the current grade. Every choice
calls the existing supplier command. Supplier-free businesses still omit the
section. No prices, demand, supplier effects or save fields were changed.

## Verification

Five new component tests use real catalog types and `newBusiness` fixtures.
They cover cost/quality/customer explanations, the chosen grade, the role of
staff, all three command callbacks, and the absence of choices on a business
without suppliers. Together with A4/A12 there are 14 passing mobile tests.

Sabotage verification caught all five independent mutations: replace the
explanations with vague copy, send every selection to Standard, offer suppliers
on businesses without them, mark every grade Chosen, and remove the explanation
that staff affect quality. None missed; original files were restored with
SHA-256 checks.

Final `pnpm verify` passed all typecheck and test tasks (1,868 tests). It
failed on the same nine catalog/generator mismatches as untouched main, with
identical validator output. The generated vehicle-mods side effect was
restored. All changed files pass formatting; global formatting still has
23 unrelated Markdown failures recorded in the A4/A12 report. Native-device
layout and taps remain unchecked. These descriptions explain the current
model; individual supplier pitches and loyalty remain Agent A's B2 work.
