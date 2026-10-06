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

| Save version | Held by | Ticket                   |
| ------------ | ------- | ------------------------ |
| v39          | shipped | 0604 (no bump)           |
| v40          | shipped | 0605 (0606 adds no bump) |
