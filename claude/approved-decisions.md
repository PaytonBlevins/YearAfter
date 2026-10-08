# YearAfter — approved decisions

Decisions the product owner has explicitly made. **These are settled.** Do not
reopen, redesign, or quietly drift from them in a later ticket. If a ticket seems
to require breaking one, stop and raise it.

The canonical spec is `specs/MASTER_SPEC.md` in the repo; this file records
decisions made _since_ the spec, during review.

---

## Identity

- **Name: YearAfter.** Set in `apps/mobile/app.json`.
- **Palette accepted for now:** warm paper ground, near-black ink, one green
  accent carrying the Advance control and active navigation. All in
  `apps/mobile/src/theme/theme.ts`; nothing hard-codes a colour.
- Logo and typography still pending an identity pass.

## Navigation

- **Five worlds:** Career, Assets, Advance (centre), People, Activities.
- **Tab labels:** "Activities", not "Do". "People" stands in for Relationships
  because the longer word truncates at a fifth of a phone's width.
- **The centre control is the only advance affordance.** Tapping it advances the
  year. There is **no advance icon** — deleted from the icon set, not merely
  unused — and no text caption. The circle shows the next age and the word AGE.
- **Relationships contains only Family and Friends.** Professional NPCs live in
  their own worlds.
- **Activities stays at 10–16 broad rows** (currently 15). New actions go inside
  an existing hub, never as a new top-level row.

## Rows and visuals

- **Row affordances.** The right-hand marker states what pressing a row does,
  before it is pressed: chevron opens a sub-screen, ellipsis acts or opens a
  sheet in place, nothing means informational. Every `ListRow` declares an
  `affordance`. Canonical in `specs/CORE_RULES.md` §8.
- **Stat bars: grid layout.** Two columns, four rows, numeric value beside each
  label. The compact and inline prototypes were deleted.
- **Icons: an original drawn set** — line icons as SVG paths in
  `apps/mobile/src/theme/icons.tsx`, one 24×24 geometry, single stroke weight,
  round caps, outline only (the ellipsis is the sole filled exception). No emoji,
  no third-party icon font. Adding one: stay inside the 20×20 optical area,
  inherit the stroke weight, prefer three or four strokes to an accurate
  silhouette. Review it rendered at 20px in the developer icon sheet, not as path
  data.
- **Seven visible stats, exactly.** Happiness, Health, Smarts, Looks, Charisma,
  Willpower, Discipline.

## Balance

- **Talent probability: 9% per talent.** Across seven talents that is roughly 52%
  of characters born with no talent, 36% with one, 12% with two or more. A
  distribution test guards it — if that test fails, someone retuned the constant.

## Health (decided after Ticket 0417)

- **Serious conditions stay as they are.** Strokes, cancer, heart trouble and the
  like are not to be made more disabling or more consequential. Real versions of
  these often partly or fully disable a person, which would be neither realistic
  to play through as a normal life nor fun. 0417's leftover — that a robust body
  collects as many serious conditions as a frail one — is **closed, not open**.
- **The health ceiling at twenty-six is accepted.** Characters born above about
  77 reach vitality 100 by twenty-six and the top of the range flattens. Not to
  be revisited.
- **Check-ups stay button-only.** A passive player never seeing a doctor is
  correct (spec 531: preventive care matters little and is never a chore). Not
  to be turned into a systemic door. Roadmap finding 1c is closed.

## Playtest rules work (decided 6 October 2026)

Payton cleared the rules and "return to this" notes in `claude/playtest-backlog.md` to be worked
before v0.08 and 0508, one ticket at a time with a stop between each. The brief is
`claude/playtest-rules-brief.md`. Agent B (Codex) builds it, engine and save included, for this list only.

- **A failing business asks each time (B1).** A warning card says what rescuing costs and the player
  chooses to put money in or not; declining means the business closes or is sold. The automatic draw
  on the player's bank when a business fails (0603) is to be removed.
- **Living costs: fix the curve, then add lifestyle tiers (finding 32).** The default becomes sensible
  first. Frugal / Comfortable / Lavish follow, as a way to spend more on purpose. **This overrides
  spec 1166's removal of a tier selector by name.** The car's yearly cost becomes a dollar amount
  scaled to the car and no longer a share of the living bill (finding 33).
  **P2 proposal approved by Payton:** Comfortable is the default; Frugal buys 80% of discretionary
  spending above basic needs, Comfortable 100%, Lavish 150%. Annual happiness nudges are −1 / 0 / +2,
  through the existing stat curve, with no effect at basic needs or in hardship and no Lavish bonus
  for an unpaid year. Selection itself changes no money, time or stats. The approved default uses
  marginal after-tax spending of 92% up to $50,000, 40% to $120,000 and 15% above, with wealth pull
  tapering above $100,000. The embedded car allowance is $1,600 per index-1 single renter, scaled to
  household/location/housing and capped at real car costs. Lifestyle opens from the Living costs row
  with three options and annual estimates. This explicitly overrides MASTER_SPEC section 22 and
  its interface passage removing a tier selector (the brief's “spec 1166”); sections 20–21 still keep
  contextual costs and the backend ledger. See `playtest-p2-living-costs.md`.
- **P3 social-media proposal approved by Payton:** new-account rank lifts are YouTube 3,
  Twitch/Kick 5, Instagram/Facebook/X 3, TikTok 3, podcasts 5 and Substack 2. Existing saved
  luck stays fixed; source curves and the top-quarter fade remain. Active accounts above their
  target take ordinary downward drift regardless of post count; only positive annual spread
  scales to output. Explicit publications retain their viral rolls, and live annual settlement
  does not give another automatic viral opportunity. Free accounts, manual posting, the twelve-post
  cap, platform income rates and the small-audience fame anchors remain. See
  `playtest-p3-social-success.md` for measurements and verification.
- **P4 business-economy change approved by Payton, with strong expansion retained:** halve
  direct severe-recession, recession, slowdown and growth effects to −13%, −6.5%, −2.5% and
  +2.5% at full cyclicality. Normal stays neutral; **strong expansion stays +9%**. Type
  cyclicality, named-event odds/damage, world transitions, other business controls and P1 rescue
  choices remain. Context thresholds halve as proposed: ledger 0.25%, screen 1.5%, annual loss
  3% and annual gain 2.5%. Existing records retain historical values; future settlements use
  the new coefficients. No save bump. See `playtest-p4-business-economy.md`.
- **P5 scarce study/training matches approved by Payton:** show twelve eligible listings,
  reserving two matching the existing studied-major tracks or held-license tracks. When fewer
  than two matching jobs qualify, show every available match and fill the remaining places
  with other eligible work. Never duplicate a row or bypass age, education, license or career
  reach to fill the quota. Hiring odds and first-job offer chance stay. The current/last major
  and all held licenses supply matching information; no degree-subject history is promised.
  See `playtest-p5-career-listings.md`.
- **P6 adult and school work proposal approved by Payton (8 October UTC):** six deliberate
  freelance choices from 18 without an upper-age cutoff: pet care 4 h/$1,500–$6,000; yard work
  5 h/$2,000–$7,000; babysitting 6 h/$2,500–$9,000; tutoring 4 h/$2,500–$10,000; art commissions
  4 h/$1,500–$8,000; repairs 6 h/$3,000–$12,000. Amounts are annual gross; keep existing
  ability scaling and talent premium. Retail is $6,000–$10,000, kitchen $7,000–$12,000; their
  hours and age gates stay. Other child/seasonal pay stays. Remove the two-gig cap and supersede
  its assertion under CORE_RULES 13.5; existing hidden workload owns overload. Every education
  stage settles work once with paid hours; college uses existing overload performance penalties.
  Adult shift wages use the existing ordinary income curve; freelance uses the existing
  self-employment premium, feeding living and subsequent income bases. Under-18 tax treatment
  stays. Career shows Part-time & Odd Jobs from 16, with shift/odd-job/held-work sections and
  take/quit. No save bump. See `playtest-p6-school-work.md`.
- **Card payment on every purchase is wanted (A13, B17)** and PR #10 is merged first, keeping free
  account creation for channels.

- **P7 proposal approved by Payton (8 October), with universal 15% sizing:** investor-only
  market/sector/individual shocks are 20% smaller; preserve drift, payout, reversion, floors,
  caps, macro transition odds and P4 business coefficients. Advisors protect six months of
  current recurring household bills, minimum $12,000, plus an explicit purchase savings goal.
  Every advisor buy suggestion uses **15% of spare cash**, including funds and reinvestment
  of reductions; there is no 25% idle-cash or one-stock-only exception. Under-$1,000 buys
  stay quiet. Reduce applicable sector/speculative/named holdings, retain needed cash and
  put up to that same 15% limit into Broad Market Index. Existing tiers, risk bars and the
  0.2% paid fee stay. An optional whole-dollar purchase target has Set/Clear on the existing
  Advisor screen, before and after hiring, and migrates from older saves as no goal.
  Goal protection applies to advice, not manual trades or purchases. Save v46 is P7's;
  TICKET remains 0708. See `playtest-p7-investments-advisors.md` for measured policy limits.

- **P8 approved with amendments by Payton (8 October):** reduce the proposed 48 additions
  to 15–20. Add recognizable actual model families across existing fictional makers,
  not invented variants, movements or technical specifications. Keep the approved
  price/resale/store approach and existing holdings unchanged. Include a very expensive
  Jacob & Co. equivalent. Agent B selected eighteen total, including Jakob & Co.'s
  Billionaire Timeless Treasure equivalent at $20m, fifteen ordinary watch-class entries
  and three sought entries. No new screen, save shape, icing action or selection rules.
  Full real-model/source mapping: `playtest-p8-watch-catalog.md`.

- **P9 renovations, approved 8 October 2026:** Payton approved the measured proposal in
  `playtest-p9-renovations.md`: nine additions (28 total), the listed costs/upkeep/recovery,
  kind-derived space budgets and residence-only annual comfort capped at +3, suppressed
  during hardship or a final cash shortfall. Preserve existing work, use explicit cash/card
  payment, keep save v46 and stop after P9.

## Reference material

BitLife screenshots supplied by the product owner, saved at
`docs/reference/life-sim-market/` with analysis in `docs/reference/README.md`.

**Take:** menu taxonomy, hub grouping, content breadth, where players expect to
find a feature.
**Do not take:** palette, typography, emoji icons, exact layouts, copy, brand or
trade dress. Spec 828–838 requires an original visual identity; 1043–1059
requires legal review of recognisable analogues before release.

Deliberate divergences are recorded in the analysis — most importantly, their
Activities screen is a flat 40+ row list and ours is not.

## Still open

- Logo and typography.
- Nothing else outstanding from the v0.01 gate. Next is v0.02, Ticket 0201.
