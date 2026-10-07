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
| Purchase payment selector | Codex / Agent B | `feat/purchase-payment-choices` | engine and UI integration claimed; Payton authorized engine work on 6 October |

| Save version | Held by | Ticket                   |
| ------------ | ------- | ------------------------ |
| v39          | shipped | 0604 (no bump)           |
| v40          | shipped | 0605 (0606 adds no bump) |

| Social Media playtest changes | Codex / Agent B | `feat/manual-social-posting` | built: free accounts, real platform names, lower small-audience fame and manual platform-specific posting; required engine/persistence integration; review/device checks pending |
| A3 Business failure warnings | Codex / Agent B | `feat/playtest-business-warnings` | screen warnings built; review/device pending; B1 rescue-choice engine remains with Agent A |

| Playtest rules and "return to this" notes (P1–P16, `claude/playtest-rules-brief.md`) | — (paused on this list) | Codex / Agent B (`feat/purchase-payment-choices` first, then one branch per ticket) | assigned 6 Oct, engine authorized by Payton for this list only; nothing started |
