# CORE_RULES

Non-negotiables. Every ticket is checked against this file. If a ticket appears to
require breaking one of these, stop and raise it with the product owner — do not
implement around it.

Source of truth is `specs/MASTER_SPEC.md`. Where this file and the master spec
disagree, the master spec wins and this file is wrong and must be corrected.

---

## 1. The product rule

> **The game should simulate more than it asks the player to manage.**

Before exposing any mechanic, apply the Low-Friction Realism Test:

| Question                                                   | Answer                 |
| ---------------------------------------------------------- | ---------------------- |
| Does it create an interesting decision?                    | Expose it.             |
| Does it improve realism but create no meaningful decision? | Keep it backend.       |
| Is it mainly maintenance work?                             | Simplify or remove it. |

Do not add hidden chore systems. Do not add a mechanic because it is realistic.

## 2. Financial conservation — absolute

```
opening cash + cash inflows − cash outflows = ending cash
```

Any discrepancy is an engineering bug, not a balance issue, and blocks release.

- Money is stored as **integer cents**. Never floats. Format only at the UI boundary.
- Investments are **transfers** between asset classes, not expenses.
- Non-cash gifts are **ownership transfers** — not income, not outflow.
- Cash gifts move cash but are **not earned income**.
- Money never vanishes without a recorded ledger reason.
- The full ledger is backend truth. The player never sees a month-by-month ledger.

## 3. Visible variables — exactly seven

Happiness, Health, Smarts, Looks, Charisma, Willpower, Discipline.

Plus **Fame** (one bar, contextual) and **Stress** (shown only when relevant).

Adding an eighth permanent bar requires a spec revision. Popularity, relevance,
momentum, sentiment, mental health, and prestige are **internal only**. There is
no weight/body-condition system and no second mental-health stat.

## 4. Talents are Boolean

Canonical set: `athletics, acting, music, writing, academics, inventive, crime`.

- Assigned **at birth**, persistent for life, never "discovered" later.
- **No numeric talent strength.** Impact emerges from the flag interacting with
  attributes, experience, career skills, reputation, opportunity and randomness.
- A character may have zero, one, or several.

## 5. Randomness is centralised and seeded

- **`Math.random()` is banned in game logic.** The one legitimate use is
  `generateSeed()`.
- All draws go through `Rng.stream(domain)` from `@yearafter/simulation`.
- Domain streams are isolated: adding randomness to one system must not shift
  the sequence another system sees.
- A seed fully determines a life. Golden-life tests depend on this.
- Probabilities are clamped into `[0, 1]`.

## 6. Reputation is career-specific

There is no global reputation stat. Basketball reputation, acting reputation,
music-industry reputation, business reputation, political reputation and
organized-crime reputation are separate and only affect their own domain.
Random standalone crime does **not** use reputation at all.

## 7. Geography

Birth country / region / city are stored but **backend-only after creation**.
Current country / region / city are player-facing. Citizenship is never shown as
a profile field. There is no family ID.

## 8. Navigation and screen rules

Five worlds: **Career, Assets, Advance/Life (centre), Relationships, Activities.**

- Relationships contains **only Family and Friends**. Professional NPCs live
  inside their own worlds (coaches in sports, agents in acting, employees in
  business, tenants in property).
- Hub features go on top-level menus; leaf actions live inside hubs.
- Activities targets roughly 10–16 broad rows, not 40+ leaf actions.
- Single scrollable screens are preferred over paging.
- Search fields must not be required in normal play. Curate inventories instead
  (a dealership shows 8–15 cars from a catalog of hundreds).
- Roughly 6–9 rows per phone screen is the density target.

## 9. Universal negotiation pattern

**Accept / Request More / Decline.** The backend decides whether a better offer
comes. Never ask the player to type an amount or judge whether $10M vs $100M is
fair. Auditions and loan applications are **offer/denied** and
**approved/denied** — no callback trees, no rate shopping.

## 10. Errors and results

Expected gameplay failures — a denied mortgage, a failed audition, an
unaffordable purchase — are typed `Result` values, never thrown exceptions.
Exceptions mean an engineering bug.

## 11. State and derivation

Never duplicate canonical state. Net worth, monthly outflow, equity, liabilities
and available credit are **derived** from source state, never stored alongside it.

## 12. Saves

Explicit schema version, tested migrations, old dynasties stay loadable. Never
repurpose or narrow an existing field — add a field, bump the version, write the
migration. Multi-step operations are atomic: calculate → validate → commit.

## 13. Content is data

Cars, jobs, gifts, jewelry, businesses, colleges, locations, brands and event
text are versioned content catalogs with stable IDs. **Logic never depends on
display names.** Content expands without code changes.

## 14. Branding

Fictional analogues must be recognisable but original, with identifiable model
families and multiple variants — `Royata GT4 100`, not "luxury sedan". Benchmark
prices against real-world references. Final names and trade dress require legal
review before release.

## 15. Balance philosophy

Do not cap wealth, fame, or success. Balance prevents one repeatable mechanic
from printing unlimited money — it does not stop legitimate achievement.
Extraordinary outcomes should be **materially more attainable than in real life**
through skilled play. Living expenses must not secretly consume most gains.

## 16. Performance

Annual processing under ~250 ms for an ordinary life. Background NPCs are
compressed. Large catalogs load lazily.

## 17. Engineering discipline

- TypeScript strict. No `any`.
- No cross-module imports of internal implementation files — use the package's
  public API.
- **Never delete or weaken a test to make code pass.**
- No unrequested feature invention. No silent scope reduction. No placeholder
  logic reported as complete.
- Every product-owner correction becomes a spec rule, a test, or both.

## 18. Protected contracts

Changes to these require explicit product-owner approval:

- character state (`@yearafter/character`)
- time advancement (`advanceYear`)
- the financial ledger
- the save format and migrations
- event interfaces
- RNG
- shared economic and world contracts

AI may author these. The restriction is oversight, not authorship.
