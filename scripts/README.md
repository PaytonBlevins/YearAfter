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
