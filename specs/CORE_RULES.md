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

This extends to labels the UI shows. A character's status line — "8th Grader",
"High School Graduate" — is derived at render time from education state and age
by `statusLabel`, not read from the stored `player.occupation`. A stored label is
only rewritten when a year advances, so a resumed or migrated save shows a stale
one, and two screens reading it disagree about the same character. That is
exactly what review reported: "when my character was 11, it simply said I was in
public school, now that I am 13, it says that I am in 8th grade." The stored copy
survives only for the save-list summary, which needs a value without loading a
whole save, and is written from the same function.

A field with a value is not the same as a fact. `schoolType` is `'public'` from
birth because the field is not optional; rendering it unconditionally announced a
newborn's enrolment at a public school. Ask whether the fact applies before
showing the field.

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

`{they}`, `{them}` and `{their}` are the PLAYER's pronouns and are never used
for anybody else. An incidental person has their OWN pronoun tokens —
`{kidThey}`, `{kidThem}`, `{kidTheir}` and the `kid2`/`adult` forms — which are
resolved from the name that was actually bound.

Copy must never write a bare "he", "him", "his", "she" or "her" in an event that
names a person the engine drew. Their names come from the culture's male AND
female lists, so a written-in pronoun is wrong half the time: 0203b shipped "You
told Lucía exactly what you thought of him." A capitalised token — `{KidThey}` —
is the same token at the start of a sentence, so correct pronouns never cost a
correct capital letter.

The person tokens a decision declares cover its pronouns too: a line using only
`{kidThem}` counts as a use of `kid`.

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

### 13.7 A system nobody can trigger is not a system

Any model with a threshold gets its inputs MEASURED across simulated lives
before it ships, and the measurement goes in a comment beside the constant.

Three times now a model has passed every test while never once running:
behaviour sat at 96–100 for every character, so alternative school (spec 73) was
unreachable; `hiddenLoad` was zero in all 3,400 simulated years measured for
0205, so 0204's overload penalties and the whole workload half of stress had
never fired; and the aptitude formula was fitted at the top of a stat curve it
was applied to from age five. Tests do not catch this, because a test compares a
character to the same formula that produced them.

The fix each time was the same: measure the input distribution, then set the
threshold inside it. `packages/stress/src/stress.ts` reads workload as PRESSURE
against capacity rather than as overflow past it, for exactly this reason.

### 13.8 Two systems never bill the same account

An overcommitted fourteen-year-old finished two years with Health at 29, because
0204's overload penalty and 0205's stress consequences were both charging health
for one busy schedule. Spec 1079 names what commitments influence — Stress,
Happiness, Performance — and each of those has ONE owner. Health belongs to
events and to the physical part of overload, and stress does not touch it.

Before adding a consequence, find what already charges for the same cause.

### 13.9 A place worth having is earned, not clicked

A competitive activity carries a `tryout` and cannot be joined directly. It is
attempted, it can be failed, and it may be attempted again the following school
year — once per year, so the button is not a slot machine. The draw comes from
`RngDomains.Education`, so a life still replays from its seed. Being cut writes a
timeline line exactly as making it does: a screen that silently does nothing on
failure teaches the player that the button is broken.

Review, on the first version: "I was able to join the basketball team just by
clicking on it. I should have to tryout for things like that."

### 13.10 A childhood has a cast, not a name generator

Events name people from the character's actual class, not from a list. Before
0206 every person in an event was invented for that line and discarded — a
childhood produced sixty different names and no relationships, which is the
opposite of what a life feels like.

Five classmates by name at a time, one teacher a year, and they persist across
the years of a school stage. `{kid}` and `{adult}` bind to them, and what
happens becomes a memory on that person's page (spec 771–785). The
invented-name path stays, because it is the whole of early childhood and of any
character out of school.

Being in the same room is CONTACT. Anybody `inClass` neither drifts nor needs
the player to press anything — the first version drifted classmates at seven
points a year against a floor of twenty-two and turned the entire class over
every September. Friendship outside that room has to be kept up, and that is
what makes keeping it up mean something.

### 13.11 A limit is a year that wears out, not a wall

Review, on the first version of the interaction menu: "I don't like how you can
only perform one action with your classmate per year." Right — a hard wall after
one tap is a rule the player runs into rather than a life they are living.

So light things repeat and are worth steadily less, and stop with a sentence
rather than a dead button. Only the things nobody could honestly do twice in a
year stay once a year: telling somebody your secret, having it out with them,
going first to fix it, asking a teacher to put a word in.

Where a cap is genuinely right — three afternoons of practice, two terms of
studying — the screen says how many are left BEFORE the player presses, and says
why when they are gone.

### 13.12 A timeline entry's id is unique, forever

The Life screen keys its rows on the entry id. Two entries sharing one makes
React drop or duplicate rows, so a piece of somebody's life silently vanishes
from the feed — and it logs a duplicate-key error at whoever is running the app.

Anything REPEATABLE puts its repeat counter in the id. Both bugs of this kind so
far were created by making something repeatable — Study Harder going to two
terms a year, and the interaction cap being lifted — and both reached a player's
terminal. `advance.test.ts` now plays a life pressing every repeatable action to
its limit and asserts no id repeats, so the next thing to become repeatable
fails the build instead.


Fixing the PRODUCER is only half of it, and Ticket 0207c is why this paragraph
exists. 0206b put a repeat counter in every repeatable action's id and added a
test that plays a whole life pressing all of them, and the same React duplicate-
key warning came back — because no code in the build could still emit the bad
id. The duplicates had been written by the pre-fix build and were sitting in the
save, where a fixed producer can never reach them.

A save outlives the bug that wrote it. So an invariant on stored data needs a
MIGRATION as well as a guard at the point of writing, and "forever" in the
heading means saves too. The migration stays pure like every other one — repair
by position, never by a fresh draw — or the life stops replaying from its seed.

### 13.13 An event never spends money the character does not have

Anything with a negative cash effect carries `cashAtLeast` covering the largest
amount any branch can spend, derived by the generator and checked by the
validator and the catalog tests. Reading output found a fourteen-year-old
holding $60 told "the coffee can under your bed has $150 in it", spending it,
and finishing on $0 — the balance floored and the prose lying about it. That is
13.6 broken from the other direction: money that moves without the sentence
being true about it.

### 13.14 Stress is backend, and it is escapable

Spec 1660, 661, 1824 and 1986 together: stress comes from workload and
relationships, there is no visible time budget or capacity allocator, and the
player may overcommit rather than being blocked. So there is no stress screen —
the player reads what went wrong in the feed, in a sentence, and sees a stress
bar beside the seven canonical stats only while it has something to say (spec
1094, "Stress when relevant"). Stress is NOT in `VISIBLE_STAT_KEYS`, which stays
canonical at seven.

Stress must go DOWN as well as up, in the model and in the catalog. A catalog
whose stress effects are all positive makes stress a ratchet, and a ratchet is a
second health bar every character loses by eighteen — which is precisely the
"separate visible mental-health system" spec 1030 forbids, wearing a new name.
The validator fails a build where too few events relieve it.

This is enforced structurally, not by writing discipline: the generator, the
content validator and the catalog tests each fail a build on unsourced money, on
an amount the prose never mentions, on a stress catalog that only goes one way,
and on the other rules above.

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

### 13.15 A gate guards what it hands back, not only what it lets through

Ticket 0207 built an age gate for romance and tested it by advancing a minor
towards an adult stage, which it correctly refused. Writing the tests found the
other half missing: every path that leaves a relationship WHERE IT WAS — a
refusal, a bad evening, a repeated light move — handed the existing stage
straight back without looking at the age. The gate would have stopped a
fifteen-year-old getting married and would have carried a marriage a fifteen-
year-old somehow already had, which is exactly the case a gate exists for.

So a gate is a function over the value being returned, not a check on the
transition. And it needs more than one enforcement point: the menu builder is
what a screen calls, so testing only the menu proves the menu is safe and proves
nothing about the engine underneath it. A gate with one enforcement point is a
gate one careless caller walks around.

### 13.16 Do not gate a system on a system that has not shipped

0207 priced a wedding at $9,000 and an engagement ring at $1,800. Both numbers
are reasonable. The median thirty-year-old in the build holds THIRTEEN DOLLARS,
because careers do not exist yet — so across 150 simulated lives, 1% got engaged
and 0% ever married. The feature was complete, tested, and unreachable.

A fixed price is a dependency on the income system. Until that ships, a cost
that is a SHARE of what the character has is both reachable and truer: a wedding
is what you can afford, and broke means a registry office and two witnesses,
which is a real wedding and a better story than a locked button. When income
arrives the same rule produces expensive weddings with no retuning.

This is 13.7 (measure the inputs before setting a threshold) applied to money,
and it is the third time that rule has been broken by not measuring first.

### 13.17 Repeatable copy needs more lines than repeats, and a stable index

0206b removed the one-action-per-year cap, so a light action can land four times
in a year. Reading a year of output found "Shared chips with Diya on a wall"
four times, twice of them consecutively, and then again every year for
seventeen years.

Two rules, and BOTH are needed:

- The line is chosen by the phrasing draw ROTATED by how many times the action
  has already been used this year, so a repeat cannot land on the same sentence.
- The phrasing draw must be STABLE within the year — derived from
  (year, person, action), not drawn fresh each press. A re-drawn index landing
  one lower cancels the rotation exactly as often as it helps, which is why the
  first fix did not work and the output still repeated.

It follows that every set a repeatable action can draw from needs at least as
many lines as the action can be used in a year. That is invisible by inspection
and trivial to break by writing copy, so it is asserted in a test rather than
remembered. The same latent bug was found in the 0206 friendship copy, four
tickets after it shipped.

### 13.18 A relationship the player can only improve is not a relationship

Warmth is the number the player can pump: four evenings out a year is +23, more
than any drift can take back. With leaving driven by warmth alone, 98% of lives
ended at thirty with the classmate the player asked out at thirteen, and nobody
was ever left by anybody. A life sim in which spending money on somebody
guarantees they stay forever is saying something false and fairly bleak.

So the thing that ends a relationship reads what the player CANNOT buy —
compatibility, which is hidden and found out by living it (spec 786–795) — and
the model knows that people change between thirteen and their early twenties.
Both were missing, and each one alone was not enough: with only the first, 73%
of lives still contained exactly one relationship, ever.

More generally: any system where the player has a monotonic lever needs a term
that lever does not reach, or the optimal play is to hold the lever down.

### 13.19 A person leaving must take their relationships with them

0207 put romance on the person record precisely so there could not be two places
that disagree about whether you still speak to somebody. 0207b broke it within
an hour: making graduation end the class set `endedAtAge` on the PERSON while
leaving their `romance` live, `partnerOf` skips people who are gone, and the
invariant test found a character with two partners at once.

So there is exactly one function that may end somebody — `endPerson` — and it
closes everything hanging off them. A second place that sets an ending is a bug
waiting for the next ticket to find. The reverse is not symmetric and must stay
that way: a romance ends without the person leaving, because that is what an ex
is.

More generally, when one record is derived from a filter over another
(`partnerOf` reads "people who are still here"), every writer of the underlying
field has to maintain the invariant. Funnel them through one function rather
than trusting each caller to remember.

### 13.20 A negative filter over an enum is a bug with a delay on it

`parents(household)` was `members.filter(m => m.role !== 'sibling')`, which was
correct for three roles and silently wrong the moment Ticket 0208 added a
fourth. Every child the player ever had would have counted as one of their own
parents — in `parents`, in `livingParents`, and therefore in the `anyParent`
event requirement that decides whether an event about Mom or Dad may fire.
Nothing would have thrown: a forty-year-old with two kids and both parents dead
would simply have started getting events about their mother again.

So a query over a closed set names what it wants, never what it excludes. The
same applies to a `Record` keyed on a subset of an enum — TypeScript catches
that one, which is how the Family screen's role labels were found in the same
hour, and is the argument for exhaustive `switch` over a lookup table.

### 13.21 Gating on a system that has not shipped, twice

CORE_RULES 13.16 was written after Ticket 0207 priced a wedding at $9,000 in a
build whose median thirty-year-old holds thirteen dollars. Ticket 0208 then
priced a child's school play at $90 and a computer at $650, and reading 90
played families found children asking for things 702 times and the parent able
to say yes ZERO times — with the knock-on that every family in the game ended
estranged, because the closeness model drains when nobody ever answers.

Writing the rule down did not prevent the second occurrence. What would have is
the measurement: both times the defect was invisible to a green suite and
obvious the moment output was read. So 13.7's requirement is restated here with
teeth — **any price, threshold or gate is measured against what characters
actually have before it ships**, and the measurement goes in a comment beside
the constant. A number nobody has checked against real output is a guess, and
this project has now shipped that guess twice.

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
