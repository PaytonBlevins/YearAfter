# November playtest — career control, classes, fame and sponsorship

## Authority and scope

Payton requested these changes directly in the November playtest. This supersedes earlier automatic class removal, rank-based sports retirement, recurring four-year military questions, and fixed positive fame-work rewards. Boolean talents stay Boolean; hidden per-activity aptitude is a separate deterministic potential, not a visible eighth stat. No new save fields or save version reservation.

Touched: sports/class simulation, military exit controls, fame aggregation and appearances, sponsorship pricing, save restoration, mobile Activities/classes/sports/service screens, and their regression tests. Main/integration remain untouched until review.

## Behavior

- All tiers in a sport now use its established star retirement-age band, rather than forcing fringe players out years earlier. Existing saved early endAge values no longer force retirement. Normal contract decisions, poor-result releases, and career-ending injuries remain meaningful exits. A player can retire/leave from Sports; the career history is kept and independent classes remain enrolled.
- Hidden aptitude is independently seeded per life and activity; racing shares karting's aptitude. No reroll on reload or calendar advance. Untalented potential interpolates 0→20, 40→50, 60→65, 80→95, 100→100. Talented potential is100. Extra training is85% as effective without talent (rounded to whole skill points). Existing above-cap skills are not abruptly reset.
- Annual growth moves12% of the remaining gap toward natural form, within potential. Additional age loss is0.15 per year past the sport's decline age, capped at3 points annually; classes start age loss at40. No extra work costs1 point of maintenance. Serious injuries still affect form and can end careers.
- Four-year military term renewals no longer ask a question. End term appears after4 completed service years; Retire replaces it at20. The20-year decision is deferred if away, then asks once. Continuing retains a retirement button with no repeated retirement prompts. Age65 remains compulsory. Legacy routine term popups are removed when loading a save. Poor performance, misconduct, and medical discharge remain distinct involuntary outcomes.
- Activities → Activity classes provides sports/martial arts/karting and acting/music enrollment or quitting. Turning professional no longer deletes the prerequisite classes or blocks enrolling in them. Classes share an annual affordability budget: the larger of cash on hand and household spending above subsistence; a low lifestyle alone cannot remove a class when cash covers it. Household-funded classes remain free to children/adults living at home. Tuition is settled once through the existing ledger.
- Fame work resolves audience reception immediately, using a stable draw with relevant attributes/craft. Poor/weak appearances lose3/1 fame; positive appearances gain the catalog amount; excellent ones add2. Talk-show and guest-role audiences can also leave after poor reception. Accepted fees still settle annually. New work receipts carry zero unsettled fame, avoiding double awards; old receipts retain their historical settlement behavior.
- Career recognition now recovers15% of the gap each year instead of imposing an instant fame floor. Music/model-related channels are excluded from duplicate career audience contributions. Ordinary creator decay remains.

## Sponsorship research and decisions

Sources inspected November8,2026:

- Collabstr, first-party2025 marketplace report: https://collabstr.com/2025-influencer-marketing-report . 15,000+ collaborations, about$202 average spend; actual platform averages about$212 Instagram,$418 YouTube,$200 TikTok,$119 Twitch. Usage rights increased average quotes about40%. This marketplace sample describes mostly smaller collaborations, not all celebrity contracts.
- Collabstr2026 comparison: https://collabstr.com/blog/influencer-costs-2025 . Reported paid averages roughly$193 Instagram,$255 YouTube,$186 TikTok,$127 Twitch; about80% below$300.
- Forbes2026 original estimates: https://tollbit.forbes.com/sites/brettknight/2026/05/22/the-worlds-10-highest-paid-athletes-2026/ . Ohtani's estimated$125m off-field comprises many partnerships and other business earnings, not one commercial. It is an upper-tail annual reference, not a per-booking rate.

Game calibration (not a claim these are universal market prices): stream campaigns fall from$15 to$2 per average viewer per stream; at100k gaming followers the three-stream package changes$21,600→$2,880. Four-post usage multiplier changes1.5→1.4 ($7,800→$7,280 at100k lifestyle followers). Above1m followers, effective campaign reach scales with exponent0.85. Initial campaign quotes cap at$5m; successful negotiation retains the existing uplift. Photo/commercial/talk-show/guest-role booking caps are$2m/$10m/$25k/$150k respectively. Team business sponsorship and sports salaries are separate economics and are unchanged.

## Test expectation changes

Old assertions that classes must disappear on turning pro, professional athletes cannot enroll, lower-ranked athletes must retire earlier, every military term raises a popup, every media appearance gains followers/fame, and career fame instantly establishes a floor are obsolete under the explicit request. They are replaced by assertions for retention, same retirement band, quiet renewals, signed reception outcomes, and gradual recognition. Cashless fixtures now explicitly have no cash rather than relying on a low lifestyle. Historical prompt-answer tests remain to cover older clients.

New regression coverage: deterministic per-activity aptitude and example caps, effort/age decline, old endAge handling, manual sports exit preserving classes, cash-funded class retention,4/20/65 military boundaries, old prompt cleanup, positive and negative fame reception without double settlement, and actual mobile enrollment/quit/retire buttons.

## Validation

All 15 package typechecks and 5,601 tests passed (including 856 mobile tests). Content validation passed: 17 catalogs and 1,524 content IDs. The first validation pass caught three uncontracted phrases; those were corrected and content validation rerun successfully. Deliberately suppressing immediate fame changes and restoring four-year military popups each failed the new regression suite; original code was restored and all nine targeted tests passed again. Changed-file formatting and diff checks passed. Mobile button interactions are covered by rendered-component tests; physical-device visual inspection has not been performed.

The gameplay branch is stacked on artwork PR #39, which was still open when this follow-up was prepared. Review/merge that dependency first, then retarget this PR to `integrate/sports-on-main` if GitHub has not done so automatically.
