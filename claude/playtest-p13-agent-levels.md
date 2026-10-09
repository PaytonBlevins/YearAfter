# Playtest P13 — agent levels and B3 pricing check

Status: Payton authorized P13 on 8 October local / 9 October 2026 UTC after P12
closeout. Separately claimed and published on `feat/playtest-p13-agent-levels`
before measurement. Refreshed main remains `beff25a`; stacked on P12 PR #24,
which depends on #13–#23. **Measured proposal only; no production edits.** Current
save v49; proposed v50 is not reserved until approval. P14–P16 and life-event wording wait.

## Requirement and contracts

P13/B4: real estate and other agent businesses hire high/mid/low level agents,
with cost against results. P13/B3: check existing player pricing, except broad
industries such as real estate; demand must respond. Do not rebuild the price slider.
Read playtest brief, backlog B3/B4, 0601 business engine, 0602 catalog/expansion,
actual catalog/generator/finance pricing-payroll-demand/staff/reputation and simulation
commands. Binding spec headings 393, 398–400, 404, 849–878/1331, 979–1030/1392,
1043–1059 and 1108–1140; CORE 13.93–13.95 and 13.159. Approved-decisions stays settled.

Allowed after approval: business agent/price-gate helpers, finance annual computation,
simulation commands/readers/public exports and tests, current owned-business Employees
and Price sections/store/tests, persistence version/migration/validation/tests, ticket,
CLAIMS/HANDOFF/roadmap/CORE lesson. Protected contracts: business/save shape, price
command eligibility and real-estate annual interpretation. The brief authorizes these
for P13, with new product choices approved before implementation. No unrelated business
catalog/generator rewrite, new business type, estate/career/creator agent overhaul,
P12 supplier change, macro retune, payroll tier replacement, expansion/P1 rescue
change, TICKET 0708, P14 or life-event wording.

## Actual current behavior

The current 31-type catalog has **one explicitly agent-based business: Real Estate
Brokerage** (`biz.realestate`). It has four baseline staff, a $52,000 per-head wage
anchor, $900,000 benchmark mature revenue, 55% variable cost share and $107,000 fixed
overhead. The variable costs already include money that leaves with each sale; they
must not accidentally become cheaper merely because a more capable team sells more.
A Marketing Agency is an advertising service, not a real-estate/insurance/talent
brokerage. No insurance/talent brokerage business exists in the current catalog.
Use explicit type IDs for agent eligibility; do not infer it from a name containing
“agency” or from every supplier-free type. Future actual agent businesses can join
that gate when implemented; do not create extra companies for this ticket.

Payroll already has Low/Medium/High/Big Bucks, affects pay/retention/service quality,
and manager staffing responds to demand. There is no agent skill-level field,
command or owned-screen selection. A new agent level must represent client-generating
ability separately from the existing pay policy; do not relabel the old payroll dial
and report a new mechanic as built.

B3's price control is implemented at 70–140% of going rate in five-point steps.
Actual `setPrice` commands work for all 31 owned types, including real estate;
all are free, reconcile and leave an immutable before-call RNG snapshot unchanged.
`businessYear` uses `(price / quality)^−elasticity`, and revenue/cost/reputation
respond. Measured demand at 140 is below demand at 70 for **all 31 types**.
The missing requested exclusion is real estate, where the generic Price section and
command still allow the owner to set that rate. Ordinary product/service pricing
should stay in the existing system.

A 60-iteration mature manager/reputation sweep at all fifteen prices puts 30/31
best prices inside the endpoints. Examples: café 90, restaurant 95, cleaning 120,
real estate 110. Real estate operating profit is $69,738 at 100, $92,188 at 110
and −$14,972 at 140 in the normalized probe. These are annual operating points,
not household payouts or valuations. **Gaming is the exception:** 140 remains its
best point in this mature probe ($197,107 vs $60,263 at 100). Demand still falls;
that is a profitability/low-cost margin finding, not missing demand wiring. Existing
shorter-horizon tests do not establish every mature endpoint. Log it and preserve
its curve here rather than silently rebuilding/retuning the catalog under B3.

## External sanity check

[BLS Occupational Outlook Handbook, Real Estate Brokers and Sales Agents](https://www.bls.gov/ooh/sales/real-estate-brokers-and-sales-agents.htm),
read 9 October UTC: May 2025 median employee wages are $52,830 for sales agents
and $73,220 for brokers. Most agent income is commission-based; wage data exclude
self-employed workers, who are the majority. The game’s $52,000 per-head anchor is
therefore a broad scale check, **not** an empirically derived salary for every agent.
BLS does not provide this game's three tier multipliers or client-flow bonuses;
those below are proposed game values. No real-world deal probability or commission
rate is claimed.

## Proposed choices — approval required

**One saved team-level choice** on each eligible owned brokerage: Low/Mid/High.
It applies to the agent team including later hiring and branches. Keep existing
manual headcount and automatic manager, not an individual named employee roster.
Generic/legacy/startup brokerage defaults to Mid with exactly old economics.
Selection is free and deterministic; there is no signing invoice/card selector,
rerolled lucky agent, annual search quota, immediate revenue/stat/reputation reward
or guarantee of better profit. Pay remains part of annual business costs.

| Level | Agent pay cost vs current payroll | Potential client flow vs current brokerage | Medium-pay base wage anchor per head |
| ----- | --------------------------------- | ------------------------------------------ | ------------------------------------ |
| Low   | 90%                               | 90%                                        | $46,800                              |
| Mid   | 100%                              | 100%                                       | $52,000                              |
| High  | 115%                              | 115%                                       | $59,800                              |

Client flow multiplies potential demand before staff capacity; it is not a revenue
payout or a bonus to the whole sale price. The cost multiplier applies to existing
rounded labor cost, including payroll/turnover effects, then rounds whole dollars.
Keep the 55% variable cost rate, fixed overhead, owner contribution, per-worker
capacity, price sensitivity parameter, staffing caps, events and macro unchanged.
Payroll continues to affect its current quality/retention; agent pay must not feed
back into `serviceNoticedIn` and grant a second accidental payroll-quality bonus.
There is no direct new reputation bonus; existing customer-service/rush response
still determines reputation. More leads can require more staff and raise costs.

**Pricing exception:** show a spoken market-led explanation instead of the Price
selector on Real Estate Brokerage only. Its prospective business price uses the
ordinary 100% anchor; `setPrice`/`nudgePrice` refuse this type, while all other types
keep the existing slider. Ignore an old non-100 saved brokerage price in the annual
reader, and normalize that current field to 100 in the migration; preserve historical
books, profits, cash, prior records and P12 supplier data. This is the intended B3
exception, not a new commission-negotiation game. No other broad-industry exception
is silently inferred. Gaming's measured maximum-price finding remains logged.

**Owned screen:** an Agent level choice in the Employees section, with Low/Mid/High
rows explaining quoted pay cost and client-flow tradeoff and current selection.
Keep payroll and manual hire/fire visible as separate existing controls. Show the
current per-head pay and staffing context through domain helpers, with spoken
refusals for dead/minor/unsupported/not-owned/rescue-pending. Store command persists
accepted level without changing bank/stats/RNG. Buying/inheritance/branches preserve
it; irrelevant businesses show no agent-level selector.

**Proposed save v50:** optional `agentLevel: 'low' | 'mid' | 'high'` on held eligible
businesses, defaults to Mid via reader without granting a benefit. A pure v49 migration
normalizes only the current brokerage price to 100; it invents no agent, cost,
financial transaction or RNG draw. Validate allowed level and applicable type,
round-trip, older saves, malformed levels and P12 search/contract preservation.
Reserve v50 in a separate claim after approval before production edits; P12 owns v49.

## Counterfactual measurement, limitations and rejected probes

Scratch harness outside git actually opens each of the 31 types and exercises current
price commands, then sweeps 15 prices using the actual kernel with 60 manager/reputation
iterations. Normalized mature, single location, luck 1, stat 50, owner full-time,
no named event, ordinary market/shock where specified. It does not simulate a played
household or predict taxes, survival, borrowing or inherited wealth.

Before selecting the proposed values, tested 54 cost/client-flow configurations at
four payrolls × three market conditions × three fixed shocks = 36 contexts each,
three levels each: **5,832 counterfactual operating points**. Each uses actual annual
demand/service/capacity/manager/reputation, modifies only agent client demand and
rounded labor cost, and iterates the manager/reputation for 60 steps, comparing the mean of the last twenty. It is an isolated prospective
counterfactual, not a production agent command; implementation must reproduce it
and test actual advance/settlement/P1/save/store flows after approval.

For the proposed 90%/100%/115% pair, Low has the highest operating profit in 17/36
contexts, Mid in 14/36, High in 5/36. These equally weighted fixed contexts are a
comparison grid, not empirical frequencies or a game-population probability.
Compare the average of the last twenty iterations, not an arbitrary terminal year.
107/108 selected points have unchanged manager staffing/reputation at iteration 60;
Mid/Big Bucks in a normal market at fixed +1 shock has unsettled reputation
at step 60 while headcount remains seven. The averaging retains that cost rather than claiming universal convergence.

| Neutral market, medium payroll | Low      | Mid (current baseline) | High       |
| ------------------------------ | -------- | ---------------------- | ---------- |
| Operating revenue              | $785,076 | $872,306               | $1,003,152 |
| Operating profit               | $100,619 | $69,738                | $96,249    |
| Staff                          | 3        | 4                      | 4          |

Low can win because the manager needs one fewer whole agent; more expensive agents
may sell more without yielding more profit. High still wins in some other contexts.
Do not freeze headcount to force a universal ranking or promise High is automatically
the best choice. Earlier richer skill/capacity probes were rejected: changing
benchmark revenue to emulate capacity must **not divide the variable-cost rate**;
that would gift a hidden commission discount. A pay-cost probe must also preserve
original payroll-quality weighting rather than altering it with the test type.
Only the isolated client-flow/labor counterfactual above supports this proposal.

## Acceptance after approval

Test literal tier cost/flow values independently of config, default-Mid equality,
all eligibility/refusal gates and no money/RNG mutation, manual/automatic staffing,
branches, transfer and real annual settlement including P1 shortfalls. Assert other
businesses and payroll/supplier/event economics stay unchanged. Price exception must
hold through direct command, nudge, stale legacy saves, annual calculation and owned
screen; ordinary price demand remains responsive. Save v50 no-RNG migration,
round-trip/malformed records and real mobile store/autosave are required.
At least fifteen independent sabotage mutations with backup/exact restored hashes;
strengthen survivors, then full `pnpm verify`, changed-file formatting, docs/CORE,
PR into main and stop before P14.

## Open items

Approval needed for the complete concrete choices above: aggregate team-level
selection, 90%/100%/115% pay/client flow, real-estate-only price exclusion at 100 and
legacy normalization, owned-screen shape and v50. No production code/save bump yet.
P12 baseline: all 15 typechecks and 3,139 tests pass; seven inherited generator
mismatches and 22 historical-note format failures still block full verification/CI.
P12 PR #24 is published, depends on #13–#23 and was mergeable when checked;
implementation CI 146 installed but failed the same old-note formatting checks.
Native/device checks and unavailable Claude Project mirroring remain open.
