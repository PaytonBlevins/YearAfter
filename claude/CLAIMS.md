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

| Playtest rules and "return to this" notes (P1–P16, `claude/playtest-rules-brief.md`) | — (paused on this list) | Codex / Agent B (`feat/purchase-payment-choices` first, then one branch per ticket) | assigned 6 Oct, engine authorized for this list only; P1–P3 built; P4–P16 await go-ahead |

| P1 Business rescue choices | — | Codex / Agent B (`feat/playtest-p1-business-rescue`) | built; one yearly review, explicit rescue/closure, save v44; tests and sabotage verified; PR pending |
| v44 | Codex / Agent B | P1 business rescue choices; reserved before implementation, migration and tests built |

| P2 Living costs and lifestyle tiers | — | Codex / Agent B (`feat/playtest-p2-living-costs`) | built with approved curve, tiers and car allowance; save v45; stacked on P1 pending merge; 2,567 tests and 29 sabotages pass; baseline content/format blockers recorded; PR #14 targets main, depends on P1 PR #13 |
| v45 | Codex / Agent B | P2 living costs and lifestyle tiers; migration and tests built after P1 v44 |

| P3 Social media success rates | — | Codex / Agent B (`feat/playtest-p3-social-success`) | built after Payton approved measured rank lifts and manual settlement correction; saved luck preserved and validated; save v45 unchanged; 2,598 tests and 28 sabotages pass; baseline content/format blockers recorded; PR #15 targets main, depends on P1 PR #13 then P2 PR #14; review pending |
