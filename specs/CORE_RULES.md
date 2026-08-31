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
- **Leaving a screen never costs the player a year.** Every world screen offers
  a close (✕) that returns to Life without advancing. Advancing time is one
  control — the centre button — and nothing else may trigger it, directly or as
  a side effect of navigation.
- **A row's right-hand marker states what pressing it does, before it is
  pressed.** Chevron = opens a sub-screen. Ellipsis = acts, or opens a sheet, in
  place. Nothing = informational. Every `ListRow` declares an `affordance`; a
  chevron on a row that fires an action is a bug.

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

### 13.1 Events are data, and the engine never names one

There is no `switch` on an event id anywhere in `@yearafter/events`, and there
must never be one. Everything an event knows about itself — when it may fire,
how likely it is, what it says, what it costs, what it schedules next — is a
field in `packages/content/data/events-*.json`. That is the line between a
library that can grow to thousands of entries and one that cannot.

Two rules follow, and both are enforced by the content validator and by tests:

- **A person named in event text must be guaranteed by that event's own
  eligibility.** `{mother}` needs `requires: ["mother"]`. Falling back to "your
  mom" is a safety net for a content bug, not a licence to skip the requirement.
- **Every character, at every age, in every household shape, must have events
  available.** `advanceYear` throws on a year with nothing in it, because a
  blank year in the feed reads to the player as a broken button.

### 13.2 Stats move along a curve, not by addition

Event and system stat deltas are applied through `nudgeStats`, never by raw
addition: a gain is at full strength at or below 50 and tapers to nothing at
100, and a loss mirrors it. Applying childhood's forty-odd events at face value
put every character at eighteen with happiness pinned at 100 and +20 on four
other bars. A stat everyone maxes is a stat that says nothing.

### 13.3 A pending decision stops time

`advanceYear` is a no-op while `state.pending` is non-empty, and the Advance
control is disabled. Advancing past an unanswered question would either discard
it or answer it on the player's behalf. Pending decisions are part of the save:
a question asked on a phone at a bus stop is still there on a tablet that night.

### 13.4 A decision is a scene, not a prompt

Every decision names the people in it, puts them somewhere, and asks about
something happening now — never "you have been feeling X for N months". Three or
more options unless the situation genuinely has two answers, and the options are
different TACTICS rather than one tactic at two volumes. Outcomes are concrete
and can land badly: a decision every branch of which is neutral-or-better is a
reward with extra steps. Happiness always moves; Health moves wherever the thing
is physical, exhausting, dangerous or restful.

The people are bound ONCE, when the decision is raised, and stored on it. A
prompt naming a girl at the water fountain and an outcome naming somebody else
were two independent draws before this, which is what shipped in 0203 and what
review rejected.

`{they}`, `{them}` and `{their}` are the PLAYER's pronouns. Incidental people
have no gender and are referred to by name.

### 13.5 A menu never refuses because you are busy

Anything a character can sign up for — clubs, teams, later jobs and courses —
lists everything, lets them take as much as they want, and shows what each thing
costs in hours and money before they commit. What stops overcommitment is a
hidden workload model: committed hours run against a capacity that varies by
character, and past it the year costs grades, health and happiness on its own.

There is no workload bar, capacity meter or time budget anywhere in the UI (spec
661, 1824). The player learns the limit by living a year that went badly and
reading why, in a sentence, in the feed.

Rows that genuinely cannot be joined are shown with the reason rather than
hidden. "Nobody free to drive you home" is a fact about that character's life.

### 13.6 Any change to money names its source

A cash effect is `{ delta, source }`, never a bare number, and the amount must
appear in the line the player actually reads. A silent balance change is
unrepresentable rather than merely discouraged.

This is enforced structurally, not by writing discipline: the generator, the
content validator and the catalog tests each fail a build on unsourced money, on
an amount the prose never mentions, and on the other four rules above.

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
