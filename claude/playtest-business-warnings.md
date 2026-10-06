# A3 — Business failure warnings

Built 6 October 2026 on `feat/playtest-business-warnings`, from main `14144ca`, then integrated with main `9925d30` (0707/0708).
Screen warnings are implemented; the B1 rescue-choice engine is still open.

**Spec sections:** MASTER_SPEC 398–413 and 849–878 (business dashboard).
**Allowed files:** mobile components/screens/tests and these implementation notes.
**Protected areas touched:** none. No engine, balance, save, catalog or event changes.

## Behavior

The owned-business list flags a cash warning. The dashboard places an explanation
beneath the headline financials when recorded trading profit is negative, the
owner covered a trading loss last year, the loan is in arrears, or the business
could not cover its next loan payment from current cash plus last recorded profit.
A newly opened business with no trading history uses current cash alone for that
loan check and says so. Healthy, adequately funded businesses have no warning.

The trading illustration uses the existing public `settleYear` reader. It shows
what another year with the same trading result would require from the owner,
including the existing half-reserve restoration. Exactly enough business cash
requires no rescue; exactly enough personal cash is affordable. The loan check
previews the held loan through public `runLoanYear`, including newly accrued interest and displays its funding gap separately. Those
figures are not added into a fabricated combined bill. They are scenarios based
on existing records, not next year's hidden draw or a guaranteed survival cost.

The warning explains the current automatic bank withdrawal and closure rules,
points to price/supplier/staffing controls, and opens the existing sale or closure
panel. Neither review action executes an exit; a separate button confirms it.
The screen scrolls to that panel after its size changes. The sale button now
shows proceeds after the loan, rather than promising the gross receipt to the
owner. The text explains lender priority and remaining personal debt on both
sale and closure.

## B1 contract still missing

Payton wants a chance to inject money or decline, without the business taking
money from the player's bank automatically. Main does not expose an injection
command, a pending rescue decision, or a warning/pause before an actual year's
closure. A3's screens therefore describe the rules honestly and offer existing
management/exit choices; they do not label a scenario “on the brink of bankruptcy”
as if next year's outcome were known. The B1 engine and its survival measurement
remain Agent A's work. When it exists, the warning should present its actual
rescue amount and accept/decline commands, including loan shortfalls. That needs
an engine contract, not a fake screen-only toggle.

The current loan-gap scenario excludes future household income/expenses, other
businesses and new events. It cannot guarantee that the personal bank balance
shown now is what will be available when the year settles.

## Verification

Fourteen new tests execute real public finance/simulation readers and the real
shared controls. Only native hosts, store and navigation boundaries are mocked.
They cover loss/reserve arithmetic, business/personal exact cash boundaries,
positive-profit loan gaps, arrears, prior rescues, no history, healthy states,
hub navigation, loan-adjusted sale receipts and separate exit confirmations.

All workspace typechecks and 2,412 tests pass (mobile 214), including the new main Social Media/Fame work. `pnpm verify` then
fails on nine existing generator/catalog mismatches, the same baseline failures
already recorded for earlier batches. The validator's incidental vehicle-mods
rewrite is restored. Changed TypeScript and this note pass Prettier; unrelated
Markdown baseline formatting remains outside this batch.

Sabotage results are recorded after the mutation run below. Native scrolling,
layout and tap checks remain pending; no simulator/device is available here.

Thirteen deliberate mutations were caught; none missed. They hid the trading loss,
arrears, loan gap, hub warning or previous rescue; omitted the working reserve;
rejected the exact personal-cash boundary; ignored positive profit when checking
the loan; invented history for a new business; displayed gross sale proceeds;
omitted interest from the next loan payment; and executed sale or closure from the review button. Source hashes were restored
and the unmodified tests rerun after the mutation checks.

The integration check found a reader difference: `viewOf` quotes a payment on
current principal, whereas `runLoanYear` adds interest before quoting. The warning
uses the latter so a business that can just afford the dashboard quote still
warns about the interest gap. The existing dashboard loan reader is unchanged.
