# Claims

One line per ticket and per save version. Edit in its own small commit to `main`
before starting work. A = every ticket end to end (engine, save, calibration, tests, own docs). B = all notes, plus the 0605 and 0606 screens only.

| Ticket                      | Agent A                                  | Agent B                                                           | Status                                           |
| --------------------------- | ---------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| 0605 Private investments    | Claude (engine, save, calibration; done) | second agent (screens, wording)                                   | engine done; screens open                        |
| 0606 Commercial real estate | Claude (engine, calibration; done)       | second agent (screens, wording)                                   | engine done; screens open                        |
| Notes, existing and new     | —                                        | Codex / Agent B (`docs/notes-reconciliation`; all notes and docs) | repo reconciliation ready; Project notes pending |
| Notes, existing and new     | —                                        | Codex / Agent B (`docs/card-purchase-options`)                    | card-purchase clarification recorded; PR ready   |

## Playtest work authorized by Payton on 6 October

| Item                              | Agent           | Branch                             | Status                                 |
| --------------------------------- | --------------- | ---------------------------------- | -------------------------------------- |
| A4 People-action odds labels      | Codex / Agent B | `feat/playtest-a4-a12`             | implemented; review pending            |
| A12 Property row without a home   | Codex / Agent B | `feat/playtest-a4-a12`             | implemented; review pending            |
| A2 Business supplier explanations | Codex / Agent B | `feat/playtest-a4-a12`             | implemented; review pending            |
| A6 Clear investment headlines     | Codex / Agent B | `feat/playtest-news-debt`          | implemented; review pending            |
| A11 Findable debt overview        | Codex / Agent B | `feat/playtest-news-debt`          | implemented; review pending            |
| A8 Enrolled-program screen        | Codex / Agent B | `feat/playtest-college-graduation` | implemented; review pending            |
| A9 Graduation moment              | Codex / Agent B | `feat/playtest-college-graduation` | implemented; review pending            |
| A7 Visible rental costs           | Codex / Agent B | `feat/playtest-rental-costs`       | built; review/device pending; B15 open |

| A5 Money/business spoken copy | Codex / Agent B | `feat/playtest-money-copy` | money/business pass built; review pending |

| A5 People-screen spoken copy | Codex / Agent B | `feat/playtest-people-copy` | people pass built; events deferred; review pending |

| A10 Linked outflow sources | Codex / Agent B | `feat/playtest-outflow-sources` | built; linked sources selected; review/device pending |

| Save version | Held by | Ticket                   |
| ------------ | ------- | ------------------------ |
| v39          | shipped | 0604 (no bump)           |
| v40          | shipped | 0605 (0606 adds no bump) |

| Social Media playtest changes | Codex / Agent B | `feat/manual-social-posting` | built: free accounts, real platform names, lower small-audience fame and manual platform-specific posting; required engine/persistence integration; review/device checks pending |
| A3 Business failure warnings | Codex / Agent B | `feat/playtest-business-warnings` | screen warnings built; review/device pending; B1 rescue-choice engine built by Agent B in P1; review/device pending |

| Playtest rules and "return to this" notes (P1–P16, `claude/playtest-rules-brief.md`) | — (paused on this list) | Codex / Agent B (`feat/purchase-payment-choices` first, then one branch per ticket) | assigned 6 Oct, engine authorized for this list only; P1–P3 built; P4 built with approved strong-expansion exception; P5 built with approved scarce-match exception; P6 approved and built; P7 approved and built with universal 15% sizing; P8 approved and built; P9 approved and built; P10 approved and built; P11 approved and built with 5–10-year longevity target; P12 approved and built; P13 approved and built; P14 approved and built; P15–P16 await go-ahead |

| P1 Business rescue choices | — | Codex / Agent B (`feat/playtest-p1-business-rescue`) | built; one yearly review, explicit rescue/closure, save v44; tests and sabotage verified; PR pending |
| v44 | Codex / Agent B | P1 business rescue choices; reserved before implementation, migration and tests built |

| P2 Living costs and lifestyle tiers | — | Codex / Agent B (`feat/playtest-p2-living-costs`) | built with approved curve, tiers and car allowance; save v45; stacked on P1 pending merge; 2,567 tests and 29 sabotages pass; baseline content/format blockers recorded; PR #14 targets main, depends on P1 PR #13 |
| v45 | Codex / Agent B | P2 living costs and lifestyle tiers; migration and tests built after P1 v44 |

| P3 Social media success rates | — | Codex / Agent B (`feat/playtest-p3-social-success`) | built after Payton approved measured rank lifts and manual settlement correction; saved luck preserved and validated; save v45 unchanged; 2,598 tests and 28 sabotages pass; baseline content/format blockers recorded; PR #15 targets main, depends on P1 PR #13 then P2 PR #14; review pending |

| P4 Economy effect on businesses | — | Codex / Agent B (`feat/playtest-p4-business-economy`) | built with approved demand reductions, strong expansion kept +9%, lower context thresholds; 2,633 tests and 15 typechecks pass; 26 sabotage mutations caught, none missed; PR #16 targets main, depends on P1 #13, P2 #14 and P3 #15; baseline catalog/format blockers remain; stacked on P3 PR #15; save v45 unchanged |

| P5 Degree-matched career listings | — | Codex / Agent B (`feat/playtest-p5-career-listings`) | built 7 Oct with Payton-approved scarce-match exception; twelve distinct eligible listings, two reserved study/training matches when available; 37 new tests and 30 mutation trials (29 behavioral defects caught, one equivalent survivor); all 15 typechecks and 2,670 tests pass; nine baseline catalog failures and 22 historical format failures remain; PR #17, details in playtest-p5-career-listings.md; stacked on P4 PR #16 while main remains beff25a; save v45 unchanged, TICKET 0708 |

| P6 Adult odd jobs and high-school part-time work | — | Codex / Agent B (`feat/playtest-p6-school-work`) | claimed separately, measured and approved 8 Oct UTC; built six adult options without an upper-age cutoff, labeled school shifts, approved pay/cap correction and annual payout/hours/tax/living wiring; PR #18 targets main (depends on #13–#17); 43 new tests, 2,713 total pass, 15 typechecks pass; 32 mutations caught after one gap repair, none missed; full verify has nine baseline catalog mismatches; stacked on P5 #17 while main remains beff25a; save v45/TICKET 0708 unchanged; P7 subsequently authorized |

| P7 Investments and advisors | — | Codex / Agent B (`feat/playtest-p7-investments-advisors`) | claimed separately 8 Oct, approved with universal 15% spare-cash sizing for all advisor investments; built softer investor shocks, derived bill reserve, saved purchase goal, corrected risk/index routing and advisor reload; save v46 owns goal, TICKET 0708 unchanged; 53 new tests, 2,766 total and 15 typechecks pass; 28 distinct sabotage mutations caught after one gap repair; full verification has nine baseline catalog mismatches and full format 22 old notes; stacked on P6 #18 while main remains beff25a; stronger self-directed performance remains an explicit finding; PR #19 targets main (depends on #13–#18), mergeable when checked; implementation CI run 113 fails the same 22 old-note formatting checks and skips later gates; P8 waits |

| P8 Bigger watch catalog | — | Codex / Agent B (`feat/playtest-p8-watch-catalog`) | claimed 8 Oct after Payton authorized the next ticket; Payton approved with amendments: only 15–20 additions, real model equivalents across existing makers, no invented movements, plus a very expensive Jacob & Co. equivalent; built 18 additions (55 watches), existing 151 entries/stores untouched; 28 new tests, 2,794 total and 15 typechecks pass; 25 mutations caught, none missed; eight old catalog mismatches remain, valuables now matches generator; PR #20 targets main and depends on #13–#19, mergeable when checked; implementation CI 119 failed the same 22 historical-note formatting checks and skipped later gates; native checks open; no P9/P10 work; append stable fictional watch ids and preserve current saved pieces; stacked on P7 #19 while main remains beff25a; no save bump expected (v46/TICKET 0708 stay), no version reserved; no P9 renovations, P10 icing or life-event wording |

| P9 More renovations | — | Codex / Agent B (`feat/playtest-p9-renovations`) | claimed after Payton authorized P9 on 8 October; measured and approved, then built nine additions (28 total), aggregate space and bounded annual residence comfort; cash/card confirmation and save compatibility tested; 73 new tests, 2,867 total and 15 typechecks pass; 28 mutations caught, none missed; seven baseline catalog mismatches and 22 historical format failures remain; preserve old saved IDs/paid work; save v46/TICKET 0708 unchanged; PR #21 targets main and is mergeable when checked; implementation CI 125 fails the same 22 old-note format checks and skips later gates; stacked on P8 #20 while main remains beff25a; P10 and life-event wording wait |

| P10 Iced-out watches | — | Codex / Agent B (`feat/playtest-p10-iced-watches`) | separately claimed before measurement; full proposal approved by Payton, save v47 reserved before production edits; built all 53 per-model aftermarket policies, factory/smartwatch exclusions, same-slot ready purchase and owned customization, atomic cash/card payment, provenance and no-RNG migration; 147 new tests, 3,014 total and 15 typechecks pass; 31 sabotage mutations caught, none missed; approved 100-seed ten-year production probe matches for all 53; seven baseline generator mismatches and 22 historical formatting failures remain; stacked on P9 #21 while main is beff25a; PR #22 targets main and is mergeable when checked, implementation CI run 132 failed the same 22 historical-note format checks and skipped later gates; native checks/Project mirroring open; P11 and life-event wording wait |

| P11 Manual car servicing | — | Codex / Agent B (`feat/playtest-p11-car-servicing`) | separately claimed and measured; Payton approved with 5–10 extra years under annual renewal; save v48 separately reserved (P10 owns v47); built optional service, exact cash/card invoice, once-year marker/expiry and spoken owned-screen status; 4,200 production pairs match amended calibration, seven cars gain 5–10 median years; 66 new tests, 3,080 total and 15 typechecks pass; 30 sabotage cases caught after strengthening one initially missed RNG check; seven inherited generator mismatches and 22 old-note formatting failures remain; stacked on P10 #22 while main is beff25a; PR #23 targets main, depends on #13–#22 and is mergeable when checked; implementation CI 139 fails the same 22 old-note format checks, later gates skip; native checks and Project mirroring open; P12–P16 and life-event wording wait |

| P12 Supplier pitches | — | Codex / Agent B (`feat/playtest-p12-supplier-pitches`) | complete approved engine/save v49/screen; five searches per business/year with fixed quoted terms and hike-only loyalty; 60,000 production quote cases/12,000 reconciled annual settlements; 3,139 tests, 15 typechecks; 26 mutations caught after one stale-Pass test repair; seven inherited content mismatches and 22 old-note format failures remain; PR #24 targets main, depends on #13–#23, mergeable when checked; CI 146 fails the same 22 historical-note format checks; later gates skip; stacked on P11 #23 while main is beff25a; native/Project mirroring open; Payton authorized P13 next; P14–P16 and life-event wording wait |
| v49 | Codex / Agent B | P12 supplier pitches; separately reserved in d9a7418 before production edits; migration and validation built; P11 owns v48 |

| P13 Agent levels and B3 pricing check | — | Codex / Agent B (`feat/playtest-p13-agent-levels`) | approved and built; save v50 separately reserved before production; brokerage Low/Mid/High 90/100/115% team pay/client flow, independent payroll/headcount, fixed prospective 100% price and scoped migration; 81 new tests, 27 valid mutations caught with exact restoration; 108 production points match measurement, 3,000 real commands/annual settlements reconcile; 3,220 tests and 15 typechecks pass; seven inherited content mismatches and 22 old-note format failures remain; PR #25 targets main, depends on #13–#24, mergeable when checked; CI 154 fails the same 22 old-note format checks and skips later gates; later docs-run unobserved; stacked on P12 #24 and #13–#23 while main remains beff25a; native/Project open; P14–P16 and life-event wording wait |

| v50 | Codex / Agent B | P13 agent levels and real-estate price exclusion; approved and reserved before production edits; P12 owns v49 |

| P14 Landlord returns and B15/finding 44 | — | Codex / Agent B (`feat/playtest-p14-landlord-returns`) | separately claimed/published before measurement, approved and built residential rent ×1.15, fixed 50%-down investment choice and operating/cash projection with signed commercial rents; 110,000 production pricing years match, real commands/annual ledgers and 480 generated-life strategies reconcile; 55 new tests, 24 valid sabotage mutations caught after one boundary-gap repair and invalid no-op correction, source restored exactly; save v50/TICKET unchanged; stacked on P13 #25 and #13–#24 while refreshed main stays beff25a; 3,275 tests and 15 typechecks pass; seven inherited catalog and 22 old-note format failures remain; PR #26 targets main (depends on #13–#25), mergeable when checked; CI 160 fails the same 22 historical-note format checks and skips later gates; docs-closeout CI unobserved; native/Project open; finding 44 remains a separate commercial cost omission; P15–P16 and life-event wording wait |
