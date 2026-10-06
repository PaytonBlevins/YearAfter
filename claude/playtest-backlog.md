# Payton's playtest backlog — end of build

Compiled 6 October 2026 from two places: the "Payton: return to this" findings
already in `claude/roadmap.md`, and the list Payton sent on 6 October. **Payton authorized work through this list on 6 October.** It was originally
the pile for the end of the build (after v0.10 and 0508), except where an item
blocks something earlier and says so. Implementation and review status are
recorded below; engine changes remain with Agent A.

Items marked **(unchecked)** were stated by Payton and have not been compared
with the code yet. When one is picked up, read the code and measure first, as
every ticket does, and correct the note here if the code says something else.

**Who can take what.** _Screens and copy_ change what the player sees and not
what the simulation does, so a second agent can do them without touching
`packages/simulation`, `finance`, `careers` or the save. _Rules_ change numbers,
state or the save and belong with the main build, one ticket at a time. _Save_
means a migration is likely.

---

## A. Screens and copy

| #   | Note                                                                                                                                                                                                                                                                                                                          | Where                                         | Save |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---- |
| A1  | **A Social Media tab.** The creator and fame block has engines and no screen. Needs channels, followers, income, offers, collaborations, groups, manager or agent. Waits for 0705 and 0706 so it is built once.                                                                                                               | `apps/mobile`, row is a shell in `shells.tsx` | no   |
| A2  | **The business screen is vague.** It shows "the level you buy" and cannot be told apart from quality. Say what each level means (quality of product or service, cost, effect on customers).                                                                                                                                   | business screens                              | no   |
| A3  | **Warn before a business goes under.** Something like "you are on the brink of bankruptcy", with what it will cost and what the player can do. Pairs with B1.                                                                                                                                                                 | business screens                              | no   |
| A4  | **Odds labels on people.** Remove "Safe / Likely / Even / Unlikely / Long shot" from the action tab on a person (`oddsLabel` in `PersonScreen.tsx`). Roadmap finding 29. Jobs and college have the same word lists; Payton named only friendships and relationships, so ask before touching those.                            | `PersonScreen.tsx`                            | no   |
| A5  | **More natural commentary.** (unchecked) Which text is not yet known; Payton to say which screens or lines.                                                                                                                                                                                                                   | ?                                             | no   |
| A6  | **Investments newspaper: clearer and more directional.** "Money floods into consumer" is not actionable: not everyone can invest in a sector, and it says nothing about what to do. Say what moved, why, and which kind of holding is affected. 128 headlines across four slots, each keyed to a condition that held (0308c). | `headlines.json`, generator                   | no   |
| A7  | **Rental price should include, or visibly exclude, property tax and upkeep.** Today the advertised monthly price leaves them out and a player cannot profit. Either fold them into the quoted figure or show them up front. Needs a rules decision too (B15).                                                                 | property screens                              | no   |
| A8  | College has no screen of its own. Roadmap finding 17.                                                                                                                                                                                                                                                                         |                                               | no   |
| A9  | Graduation has no moment. Roadmap finding 18.                                                                                                                                                                                                                                                                                 |                                               | no   |
| A10 | Monthly outflow can't be opened. Roadmap finding 19. **Needs a decision against spec 20.**                                                                                                                                                                                                                                    |                                               | no   |
| A11 | Debt is hard to find. Roadmap finding 20.                                                                                                                                                                                                                                                                                     |                                               | no   |
| A12 | The Property row shows when there's no home. Roadmap finding 30.                                                                                                                                                                                                                                                              | `FinancesScreen.tsx`                          | no   |

## B. Rules and simulation

| #   | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Save  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| B1  | **A business must not draw from the player's bank when it fails.** Today the owner steps in for a shortfall (0603, a design choice of the build, not a note of Payton's). Replace with a warning (A3), a chance to inject money or not, and an actual failure (closure, sale) when they decline. Measure what this does to the 78.7% five-year survival (0604).                                                                                                                                         | maybe |
| B2  | **Suppliers, pitched one at a time.** Each pitch has a quality, a price point and a loyalty level. **Five new searches a year.** Today supply is a single "level you buy".                                                                                                                                                                                                                                                                                                                              | yes   |
| B3  | **The player sets the price of their product or service**, except in broad industries where it doesn't apply (real estate). Demand must respond, or the player just sets the maximum.                                                                                                                                                                                                                                                                                                                   | yes   |
| B4  | **Real estate and other agent businesses: hire high, mid or low level agents** (cost against results).                                                                                                                                                                                                                                                                                                                                                                                                  | yes   |
| B5  | **Business success weighted less on the economy.** Keep some effect, tone it down. 0604 already records the economy's effect on demand.                                                                                                                                                                                                                                                                                                                                                                 | no    |
| B6  | **Social media success rates are too low** (unchecked, Payton has not played it). Wants it more common than real life: not inflated, but a fun game. Measure the 0701–0704 population against what a player would feel (share of 14+ lives that get any traction, time to the first paid year, share that reach a living wage) and raise the luck and first-year numbers if they are low. Compare 0702's sourced medians before changing them (roadmap findings 49–51, 54–63 already list the guesses). | no    |
| B7  | **A degree should point at some jobs.** Not every job needs to match, but at least a couple of each year's listings should fit what the player studied or trained for. Related to 0401 reachability and finding 21.                                                                                                                                                                                                                                                                                     | no    |
| B8  | **Adults almost never get odd jobs.** (unchecked) Measure how often an adult is offered one.                                                                                                                                                                                                                                                                                                                                                                                                            | maybe |
| B9  | **A part-time job in high school.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | maybe |
| B10 | **Manual car servicing** so a car lasts longer. A yearly choice with a cost and an effect on reliability or lifespan. 0504 and 0505 own the car model; roadmap finding 33 is also about car costs.                                                                                                                                                                                                                                                                                                      | yes   |
| B11 | **Investments a little less volatile.** Re-measure against 0308b's cash-buffer finding and 0309's advisor returns.                                                                                                                                                                                                                                                                                                                                                                                      | no    |
| B12 | **Advisors worth paying for.** Advice has to genuinely beat doing it yourself on the measured population, not merely be gentler. Roadmap finding 28 (advisors push too hard) is the same area.                                                                                                                                                                                                                                                                                                          | no    |
| B13 | **Watches: a bigger catalog.** More references and more models per maker (Rolex, Patek, F.P. Journe, Tissot, Citizen, Omega, Vacheron Constantin, Tudor and more), mixed up rather than a few tiers. "Not too crazy." Lives in the 0506 collection catalog.                                                                                                                                                                                                                                             | no    |
| B14 | **Iced-out watches.** Buy one, or have a watch you own iced out. It lowers the value of watches that normally lose by it and **raises** the value of ones that would not normally get the treatment (a G-Shock). Needs a per-watch "iced-out effect" in the catalog and a state field on a held watch.                                                                                                                                                                                                  | yes   |
| B15 | **Rentals should be profitable for a landlord who plays well.** Property tax and upkeep eat the rent (roadmap finding 44 and 0503). Decide the pricing and re-measure landlord returns.                                                                                                                                                                                                                                                                                                                 | maybe |
| B16 | **More renovations.** Pool, sauna, infinity pool, basketball court, patio, game room, private study, hedge maze, front-yard fountain, and a few more. They need prices, upkeep, effects on value and happiness, and a size limit by home. 0506 owns the renovation catalog.                                                                                                                                                                                                                             | yes   |

## C. Carried over from the roadmap (already logged, Payton marked each "return to this")

12 nobody spends down in old age · 13 and 16 partner earnings · 21 twelve job
listings, not six · 28 advisors push too hard · 31 cards can be applied for but
not used · 32 living costs scale with income (Payton accepts lifestyle tiers if
that is the fix; needs a spec call) · 33 the car's yearly cost. See the roadmap
for each one's measurements.

## Suggested order, when the time comes

1. **Decide first** (no code): A10 outflow (spec 20), B3 pricing, B1 how failure
   works, finding 32's lifestyle tiers.
2. **Cheap and visible:** A4, A12, A2, A3, A6, A7, then the screens A8–A11.
3. **Economy and feel:** B6, B5, B7–B9, B11, B12.
4. **Content that grows catalogs:** B13, B14, B16, then B10.
5. **The larger model changes with a save bump:** B1, B2, B3, B4.

A1 goes with 0705 and 0706, not with this list.

## Review status — 6 October

- **A4:** Implemented on `feat/playtest-a4-a12`; people actions retain their descriptions, refusals and commands without odds labels. Jobs and college are unchanged.
- **A12:** Implemented on the same branch; Property uses the combined current value of owned properties and stays hidden when there are none. Other assets still count toward net worth.
- Both await PR review and a native-device check. Verification and remaining gates: `claude/playtest-a4-a12.md`.
- **A2:** Implemented on the same branch; each supplier grade now explains cost, quality and the effect on customers, with the current choice marked. See `claude/playtest-a2.md`.
- **A3** needs B1's failure/warning contract; **A7** cost visibility can proceed independently; profitability pairs with **B15**, not the iced-out watches in B14. **A5** now has a money/business copy pass selected by Payton; broader commentary still needs examples. **A10** still needs the spec decision already recorded above.
- Explicit card payment options apply to every eligible purchase, including future vacations, up to the card's available credit. This is recorded in PR #2; it needs Agent A's purchase/payment contract before screens can offer it.

### Next batch — investment news and debt

- **A6:** All 128 headline texts rewritten on `feat/playtest-news-debt`, preserving ids and conditions. Stories identify average or individual price direction and the relevant holding; the newspaper explains sectors, evidence and the forecast limit. Specific company causes are unavailable in the engine and are not invented.
- **A11:** Debt overview gathers cards, loans, mortgages and car loans. Finances opens it; Career shows a student's tuition-loan balance and a link. Existing payment screens and rules are unchanged.
- Both await review and native-device checks. Detailed results: `claude/playtest-news-debt.md`. The branch follows PR #3; next independent candidates are A8 and A9.

### Next batch — college and graduation

- **A8:** Enrolled-program screen on `feat/playtest-college-graduation`: actual length, progress, grades, tuition, family help, personal share, tuition debt, Study Harder and confirmed leaving. Career opens it for working students too.
- **A9:** Graduation notice celebrates newly earned diplomas, degrees and licenses; names career paths and tuition debt; waits behind other overlays and does not replay a loaded save. A stage change alone is not success: failing out and insufficient tuition also set `graduated`.
- Both await review and native-device checks. Detailed results: `claude/playtest-college-graduation.md`. Review after PR #4.
- Remaining screen notes need input/contracts: A1 (0705/0706), A3 (B1), A5 (additional commentary examples), A10 (spec 20 decision). Rules/B items stay with Agent A.

### Next batch — rental cost visibility

- **A7:** Gross rent is explicit in Rentals and the owned Homes summary. Tax/upkeep and agent fees appear monthly with annual context, alongside the mortgage. Pre-rental preview assumes full occupancy; existing rentals show quoted-rent/current-occupancy results and a shortfall warning. Commands and rules are unchanged.
- Visibility is built on `feat/playtest-rental-costs`, pending review and native-device checks. B15 pricing/profitability remains open with Agent A. Details: `claude/playtest-rental-costs.md`. Review after PR #5.

### Next batch — spoken money and business copy

- **A5:** Payton selected a money/business pass. Card and loan refusals use direct wording and keep actual requirements. Business text names price tradeoffs, staffing limits, locations and startup financing plainly. Mechanics and commands are unchanged.
- This pass is built on `feat/playtest-money-copy`, pending review and native-device checks. Further commentary remains open; this is not a sweep of every event or social screen. Details: `claude/playtest-money-copy.md`. Review after PR #6.
