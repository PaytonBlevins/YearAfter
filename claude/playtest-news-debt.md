# Playtest A6 and A11 — investment news and debt

Payton authorized this next batch on 5 October (Pacific time; 6 October UTC).
Branch: `feat/playtest-news-debt`, based on the first batch's PR #3. Claims were
committed before implementation in `8d8e347`.

**Spec sections:** 19–23 (finance, contextual expenses), 706–724 (economy in
context), 849–878 (finance/property UI). **Allowed files:** mobile screens,
route wiring and tests; headline text, its Python generator and content tests;
notes. **Protected areas touched:** none. No engine, save, balance, CORE_RULES
or approved-decisions edits.

## A6: investment news

Observed: sector stories said "Money Floods Into Consumer", some lines invented
CEO changes or records, and a market-state lead could claim all investments
fell even when particular prices rose. The available inputs are the current
economic state and recorded price changes; they do not include company news.

Rewrote all 128 lines. Sector and investment-type stories name the category,
say its average rose or fell, and point readers to their actual holdings.
Every individual mover names the investment and its percentage change. Lead
stories describe the economic backdrop instead of asserting realized returns.
There are no invented CEO changes, historic records, doubled prices, or
promises of a rebound.

The newspaper explains where the stories come from, that a sector groups
individual investments rather than being something the player buys here,
that averages can hide different results, and that price/history should be
checked before a purchase or sale. It keeps the existing forecast caveat.

All ids, conditions, tones, entry order, catalog version and ten mastheads are
unchanged. The generator and regenerated JSON match; the generator's logic and
62-character template limit are unchanged. Never ran Prettier over the JSON.

**Limit:** "why" can explain the economic backdrop and how a price story was
selected. A specific earnings announcement, management change or other cause
cannot be reported truthfully because the engine does not record it. This pass
does not invent such causes or add investment recommendations to the engine.

## A11: findable debt

Finances now has a Debt row with the current total. It opens a debt overview
that uses the same `estateOf(state).liabilities` as net worth. Cards, loans,
mortgages and car loans show their existing balances and link to the screens
that already handle them. Loans also appear individually, including student
loans, business names where available, unknown-product fallbacks and arrears.

The studying card on Career now shows Student loan, including a clear $0 when
no tuition was borrowed. Other loans do not inflate that figure. The balance
opens the overview, and its description explains that interest adds to it while
studying. Repayment, approvals, interest, fees and cash are unchanged.

Measured with component fixtures: $2,000 card debt + $10,000 tuition debt +
$50,000 mortgage + $3,000 car loan produces $65,000 total debt on both screens.
Frozen cards still count. Students with a job still see tuition debt. A tuition loan plus a personal loan still shows only
the tuition balance on Career. A debt-free life shows $0, not a placeholder.

## Tests and sabotage

130 new content assertions cover every line's readability, supported direction,
explicit category/percentage/average, stable ids and pools, and rejection of
invented company events and records. Nine new mobile tests render actual
screens and shared components, mocking only native hosts and store/navigation
hooks. They cover combined debt, all category links, debt-free state, unknown
products/arrears, frozen cards, tuition-only balances and the news explanation.

All twelve independent mutations were caught:

| Mutation                                    | Result |
| ------------------------------------------- | ------ |
| Sector line loses its average qualifier     | caught |
| Individual mover loses its percentage       | caught |
| Stable headline id renamed                  | caught |
| Untracked CEO story restored                | caught |
| Total debt erased                           | caught |
| Car loans left out                          | caught |
| Mortgages link to the wrong debt screen     | caught |
| Tuition balance includes other loans        | caught |
| Student debt removed from Career            | caught |
| Finances Debt row routes to Credit          | caught |
| Newspaper stops distinguishing company news | caught |

None missed. Each file was restored with a SHA-256 check after its mutation.
Engine files and engine tests were not mutated.

## Verification and review

Focused checks pass: mobile typecheck, 23 mobile tests (nine new) and 187
content tests (130 new). Final `pnpm verify` passes all 15 typecheck and 15 test tasks (2,007 tests).
Content validation still fails on nine unrelated generator/catalog mismatches,
with output identical to untouched main `5330478`. The edited headline catalog
is not among them. The validator's vehicle-mods side effect was restored.
Changed-file formatting passes; the 23 unrelated Markdown formatting failures
from the first batch remain outside this change.
Native-device layout and tapping remain unchecked. The next batch builds on
PR #3 so that it reuses the mobile component-test infrastructure; review and
merge the first batch first.

A3 still needs Agent A's B1 warning/failure contract; A7 needs B15's rental-cost
decision; A5 needs examples; A10 needs its spec decision. Next independent
screen candidates are A8 (enrolled-program screen) and A9 (graduation moment).
