Authoring and maintenance scripts.

| Script                 | What it generates                                    |
| ---------------------- | ---------------------------------------------------- |
| `generate-catalogs.py` | `packages/content/data/names.json`, `locations.json` |
| `generate-events.py`   | `packages/content/data/events-childhood.json`        |

These are the authoring source for catalogs too large to review as raw JSON.
Edit the script, run it, and commit both the script and the generated file.

Each one self-checks before it writes: duplicate ids, dangling cross-references,
unreachable conditions, thin coverage. A failing check exits non-zero and writes
nothing, so a broken catalog never reaches the repo.

```bash
python3 scripts/generate-events.py
```

The same invariants are re-checked at build time by `tools/content-validator`
and by the package tests, because the JSON is what ships and it can be edited by
hand.

`generate-events.py` also enforces the decision-writing rules from
`claude/event-writing-rules.md`: three options unless the situation is a genuine
binary, options that are different tactics rather than one tactic at two
volumes, happiness always moving and able to move down, money that names its
source and its amount, and every person a decision mentions declared so the
prompt and the outcome name the same one.

Each script writes its output BEFORE printing its report. Piping one through
`head` closes the pipe and kills the process on the next print; with the report
first, the file silently never got written.
