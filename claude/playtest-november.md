# November playtest follow-up — 6 November 2026

Payton supplied 15 numbered notes. The build matching the notes is
`integrate/sports-on-main` at `3a60da3`: it includes P1–P16 and the
0801–0809 entertainment and sports stack. At intake, `main` was `9ac5427`
and did not include that stack. This batch is based on the integration branch.
No save version change (v58), new balance constants, or TICKET change.

## Built in the first batch

1. **Paying cards.** Tap a held card with a balance and confirm the amount.
   Pay it in full if affordable; otherwise the action shows the available
   partial amount, or disables itself with an explanation. The existing
   command now calculates and books exact cents, including balances from
   explicit purchase payments. No second debt or cash path.
2. **Homes.** Listings and each owned property have their own tab. The
   existing mortgage, rent, renovation and sale actions apply to the selected
   property. Changing tabs clears an open purchase or sale confirmation.
3. **Tenant departures and renewals.** The yearly recap identifies the tenant
   and the property, including when an agent fills the vacancy immediately.
   Comparing actual tenant IDs avoids confusing full occupancy with renewal.
   Residential renewals already retain the same tenant ID and move-in year;
   verified across consecutive years on the production rental engine. At
   the going rate the existing voluntary leave roll is 28%, separate from
   nonpayment. No blanket one-year term or universal turnover found, and
   no rent or reliability rates changed.
4. **Business reports.** Each settled business is named in the yearly recap
   with revenue, profit or loss, unmet demand, spare capacity, comparative
   demand pressure and recorded rival impact. The demand comparison is
   relative to capacity, so changes in staffing can change it; it does not
   pretend to be a count of customers. It uses actual settled figures and
   shows the economic demand factor when the engine records it.
5. **Special careers.** Career has Work & study and Special careers tabs.
   Music, acting, modeling and sports are reachable there. The martial arts
   training shortcut remains under Mind & Body.
6. **Illness and post feedback.** New illnesses show in the yearly recap,
   with a pointer to Doctor. Continued conditions and loaded saves do not
   replay. Manual posts describe poor, good, great or viral reception and
   the actual audience change. Great describes the top quarter of the
   existing non-viral reach roll; no outcome odds or audience amounts were
   retuned. Posting itself is already free, and the current channel UI does
   not ask the player to choose a spending amount for each post.

The recap waits behind existing decisions and action overlays. If there is a
graduation, the new notices appear with that milestone rather than behind
another modal. Long recaps can scroll.

## Remaining engine and design work

- **5, business control and valuations.** Value currently uses three years of
  earnings, an asset floor, and a relatively narrow reputation adjustment
  to the industry multiple. Propose measuring comparable businesses at
  different profit trajectories, locations, and reputations, then pricing
  durable earnings and market position separately from their cash reserves.
  Expose the controllable price, staffing and supplier tradeoffs before
  settlement. Test sale and inheritance against the same value.
- **6, live auctions.** One bid currently resolves a pre-drawn room ceiling
  and marks the lot used even on a loss. Replace that flow with explicit
  counterbids and Pass/Raise choices. Quote the premium and payment source
  before committing. No charge until a win; preserve visits and prevent
  replaying a settled lot. Define whether an open sale persists on reload.
- **8–9, fame and offers.** Annual fame takes the maximum of the sources;
  it does not combine them. A national musician gets 22 base points plus
  up to 10 for reputation before awards. This explains a plateau near 30
  even with another audience. Measure a bounded blend of distinct audiences
  rather than adding the previous year's fame back each year. Treat awards
  as part of their own field so a win cannot be counted twice. Evaluate
  offer quality and pay at the same fame levels and separate local starter
  offers from the offers established names can actually pursue.
- **10, music growth and income.** National begins at 300,000 listeners;
  the next audience tier begins at 3 million. Growth also slows near a
  ceiling driven by catalogue quality and fixed career luck, independently
  of industry reputation. Use a reproducible 400,000-listener case to
  measure the next ten active years, releases, tours, streaming take-home,
  and reach. Change the route upward before changing the audience labels.
- **11, nominations.** Music wins already require a release quality of 82
  or more plus a tier roll. The cross-career losing-nomination path requires
  field fame of 40, above the ordinary award-free national musician range.
  Design nominations around eligible work and let the result be a separate
  outcome. Verify the national example can reach a nomination through play.
- **12, collaborations.** Music reuses the creator model: up to 4% of a
  partner's audience before audience-overlap and repeat reductions. Model
  release reach separately from conversion to lasting listeners; compare
  a 700,000-listener partner across different audiences and repeat histories.
- **13–14, growth and portfolios.** Fame helping posts, removing upkeep-style
  inputs, and removing the pattern of mostly poor performance across several
  ventures are not in this batch. The current business attention factor
  declines as the portfolio grows and is reduced further by a job. Separate
  operational staffing/management from the owner's personal boost. Compare
  one, three and five competently managed ventures or active accounts before
  changing the calibration; retain losses for bad decisions or weak demand.
- **15, advisors.** The P7 cap is 15% of spare cash, with a reserve and an
  optional cash goal. It is not 15% of the portfolio. Audit cumulative advice
  and repeated actions in a single year, then add a player-selected asset
  question with Buy/Hold/Reduce/Sell reasoning and explicit advisor service
  tiers. Fees and accuracy need to be measured together.

No balance changes, live-auction state, new nomination rules or advisor
tiers are shipped in the first batch. Native-device verification remains open.

## Verification

The full repository gate passed typechecks, tests and content validation on
the integration base plus the feature changes. A subsequent full mobile run
passed after moving the remaining music and acting shortcuts off Mind & Body.
New cases cover actual persisted card payments (full, partial, zero cash),
selection between two owned properties, managed tenant replacement and
multiyear renewal, illness notices without repeats, current-year business
figures, and all four post receptions.

Five independent mutations failed their intended tests: leaving the zero-cash
button enabled, hiding departures at managed properties, ignoring property
selection, rounding payoff to whole dollars, and labelling every ordinary
successful post good. Original source bytes were restored after each one.
