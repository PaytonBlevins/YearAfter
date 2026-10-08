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

### 13.22 A rotation cannot fix a base that is redrawn

Eight times now, in six systems, always with a green suite and always found by
reading output: 0206's drift lines, 0207's romance replies, 0207d's moves,
0208's milestones, 0208's conception lines, 0209's parent acts, 0209's ask
replies, and the stress phase's yearly summary. "Dad came home with something
you had not asked for" at four, five, six AND seven.

The bug is always the same and the first fix is always wrong the same way.
Rotating a line index by a counter looks like it works, and it cannot work while
the base index is a fresh draw each time — a new draw landing one lower cancels
the rotation exactly as often as it helps. So:

- the base holds still for the LIFE — one stable value, from `stableUnit` on a
  key that contains no year and no age;
- AGE does all the moving, so two consecutive years cannot collide by
  construction;
- the key contains the household, not the person acting, wherever two people can
  produce the same sentence — a line that names nobody is not saved by the
  `{parent}` substitution;
- and the set is longer than the number of times it can fire.

`guardians.test.ts` asserts the guarantee over the whole engine-written feed
rather than one system at a time, because eight occurrences in six places is a
class of bug, not six bugs.

### 13.23 A rule that only sees half the game is half a rule

Ticket 0207d added an American-English check and pointed it at the rendered
event catalog, for a good reason: event ids are permanent and several of them
contain `favourite`, so a blanket source rewrite renamed five of them. What that
left unchecked was every copy table written in TypeScript — and 0209 found "a
fortnight", "a corridor", "solicitors", "practised", "centimetre", "rigour" and
"the garden centre" shipping out of them.

The same shape appeared three more times in one ticket: a blurb-width cap that
covered the friendship menu and not the parent menu; a name-uniqueness set that
guarded the NPCs against each other and never contained the player, so a
sixteen-year-old had a sister with her exact name; and a token-guard table that
existed in three separate files, so a new token had to be registered three
times.

When a rule is scoped, the scope is the thing to check next — and every one of
these was found on a screenshot, not by a test.

### 13.24 A ticket number is not player-facing copy

"What your parents decide on their own — activities, money, housing — is Ticket
0209" shipped on the family screen, and was still there after 0209 shipped.
"Real jobs arrive with Ticket 0210" shipped on the gigs screen. Both were honest
notes to a developer that a player reads as the game talking about itself.

A ticket reference belongs in a comment, which is where it stays useful and
where it cannot go stale in front of somebody. The validator now fails on
`Ticket NNNN` surviving comment-stripping anywhere under `apps/`.

### 13.25 Measure the population, not the concept

Ticket 0210 needed characters who had not finished school, so it gated leaving
on "failing and in trouble" — performance under 38, behaviour under 42. It
produced ZERO leavers in five hundred lives, and measuring said why: this build
cannot make a failing student. Performance at sixteen runs p10 67, median 78,
and its minimum across five hundred lives is 50, because Smarts alone is p10 70
by eighteen. A floor at 38 was gating on a distribution that does not exist.

The same mistake, twice more in one ticket. An unpushed worker was let go 0.1
times in a thirty-two-year career, because the population's own Discipline
carried them past the firing floor. And zero of twelve entry-level jobs would
hire a median school leaver, because rung 0 counted as a reach.

So a threshold is measured against the DISTRIBUTION THE BUILD PRODUCES, never
against what the word means in the world. 13.7 says measure before you tune;
this says measure the right thing — the characters that actually exist, at the
age the rule fires.

### 13.26 A column that says the same thing on every row is not information

The openings screen showed six jobs and all six read "Worth a shot". Measuring
found nine of twelve entry-level jobs at EXACTLY 0.56 for the same applicant:
charisma and smarts were weighted for sales and office and everything else
shared one flat coefficient, so which job you applied for did not change your
odds. The label was not broken; the model behind it had nothing to say.

Every track now wants somebody different — the weights sum to about the same
total everywhere, so no field is easier, they are easier for different people —
and the label bands are placed where the measured density actually is rather
than on round numbers. A player who is quick and scattered now genuinely does
better in a restaurant than in a warehouse, and the column earns its width.

### 13.27 Answer the player where they pressed

Review, after playing 0210: _"When I tried out for the basketball team, the
result landed on the homepage as it should, but I want a pop up result for
things like that... Please make this common across important, entertaining, and
interactive moments in the game."_

Every interactive moment in this game resolved silently into the Life feed, from
0206 onward. A player could tap Try Out on the Clubs screen, or Work Harder on
the Career screen, or ask a parent for money, and get NO answer at all until
they navigated somewhere else and scrolled. Ten call sites, one omission,
repeated for five tickets because each one only ever wrote a timeline entry and
a timeline entry is not a reply.

So: **if the player pressed it and it had an outcome, they are told in a card,
where they pressed it.** A year passing still writes to the feed and always
will — spec 725–770 makes the feed the story of a life, and a modal in front of
every passive line would be a slideshow. The distinction is who initiated it.

The corollary is that a new interactive action is not finished when it returns a
`Result`. It is finished when it answers.

### 13.28 A tap is not a decision

Review, in the same pass: _"when I click on a job, it automatically hires me.
That should not be the case."_ Tapping a listing applied for it — no card, no
confirmation, and no chance to see the salary, the requirement or the benefits
before committing.

Opening a thing and committing to a thing are different gestures and must be
different taps. Where a row commits something irreversible, it opens a detail
first; the second press is the decision. This is not a confirmation dialog —
those ask "are you sure?" and imply the player erred — it is the information
they needed in order to choose, shown before the choice rather than after it.

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

### 13.29 A subtitle that reads the same every time is decoration

Review, after playing 0210b: _"Under category tabs like the love, doctor, mind &
body, etc., the subtext is fine. Under general options like work harder, the
subtext is useless and just takes up space. It is also oddly worded and cringy."_

The line is drawn exactly where the player drew it. A row that OPENS something
uses its subtitle to answer "what is behind this?", and that answer is different
per row and changes with the save — how many openings are going, who you know at
work, what a degree would cost. A row that DOES something has already said what
it does in its title, and anything under it is the interface admiring itself.

"A stretch of real effort. It usually shows." sat under Work Harder every year of
every working life and told the player nothing the two words above it had not.
Eight of these were shipped across five tickets, each one written while looking
at a single screen where it read as tone rather than as a line that would repeat
forever.

The test before writing one: would this sentence be different next year, or for a
different player? If not, it is not a subtitle, it is a comment — put it in the
source where it belongs.

State lines are not decoration and stay: a reason a row is disabled, a price, a
cooldown, a catalog blurb describing something the player cannot otherwise
identify. Those change, and a greyed-out row with no reason reads as broken.

### 13.30 A cap the player can see is a cap they play against

Review, in the same pass: _"On options like work harder, it says 2 left, 1 left,
etc. I dont want a visual limit, the buttons can be hit as many times, but I only
want an affect to happen a maximum of 2 times. So, if i hit the button 10x, my
work reputation only went up twice."_

Study Harder, Work Harder and Put the hours in each showed their remaining
presses and then disabled themselves. That turns an in-world action — putting the
hours in — into an allowance to be spent down, and a player optimising a counter
is a player looking at the mechanism instead of the life.

So the model keeps its cap and the screen stops mentioning it. The button is
always live, a press past the cap is a normal outcome rather than an error, and
the popup says plainly that there was nothing more to give.

Two things this must not do. It must not write to the feed — ten taps would be
eight junk lines in a life story. And it must NOT DRAW: the early return sits
above the RNG stream in all three, because a dead button that consumes randomness
would make two identical lives diverge on how often somebody mashed it, and the
seed would quietly stop meaning anything. `careers.test.ts` advances a year after
twenty-five futile presses and asserts the timeline is identical.

### 13.31 An invariant kept in sixteen places is sixteen promises

CORE_RULES 13.12 says a timeline entry's id is unique, forever. Enforcing it in
each producer has now failed three times, and the player reported all three:

- **0206b** — `t:2012:study` twice, because Study Harder became twice a year and
  the id did not carry the term.
- **0207c** — the same id again, this time already written into saves where a
  fixed producer could never reach it.
- **0211a** — `t:2020:work:1` twice, because quitting a job and being hired
  somewhere else in the SAME YEAR resets `pushedThisYear`, and the id carried
  the counter but not the job. Fixing that immediately exposed `t:YEAR:resign`
  doing the same thing, two jobs left in one year.

Two rules come out of it.

**An id has to carry everything that can reset the counter inside it.** The work
id was written in `workHarder` and the counter is reset in `applyFor`, one file
away — so the producer could be read carefully, in full, and still be wrong.
Where a counter lives on an object, the object's id belongs in the key.

**And the invariant gets ONE implementation.** `appendToTimeline` is now the only
supported way into the feed, and it suffixes rather than collides. That is a NET,
not a licence: a `:dup` suffix appearing in a freshly played life means a producer
asked for an id that was taken, and `careers.test.ts` fails on it. The net keeps
React rendering; the test keeps the producers honest.

The migration is the third layer, because a save outlives the bug that wrote it
(13.12) and this is now the second time the same repair has been needed.

### 13.32 A room is not a door

Player report, after playing 0210c: _"on the people page, in the friends tab, it
shows two people in my class, yet I am working a job. It also shows no coworkers
on the job screen when it should. **You will be surrounded by people, its up to
you to build a relationship or not.**"_

That last sentence is the rule. 0206 already had it right for school — five
classmates, every year, whether or not the player pressed anything, exempt from
drift because sharing a room IS contact. 0210 then gave adults a job and made it
a DOOR instead: one of three possible outcomes of a per-year meeting roll, behind
a total-circle cap of four. Measured afterwards, most working characters never
had a single colleague.

A place the character turns up to every week puts people in front of them. Not a
chance to meet somebody — people, already there, with names. What the player does
about them is the game; whether they exist is not.

Two corollaries, both of which were also wrong:

**The room has to be identifiable, or leaving it cannot end it.** A crew keyed on
a job TITLE would follow a character from one kitchen to the next. It is keyed on
the job, and leaving takes them out of the room without ending them — what happens
after that is drift's business, which is the honest test of whether it was a
friendship or a desk.

**And a field named after one room will only ever hold one.** `inClass` is now
`inRoom`. The rename is the fix, not tidying: while the field was called
`inClass`, "surrounded by people" could only mean school, and `changedSchool` was
quietly ending everybody the character worked with. That is 13.23 again, inside
the rule that already carries a warning about it.

### 13.33 A budget kept per writer is not a budget

Spec 725–770 says a busy character should not be bombarded, and until 0211 that
was enforced by every phase keeping itself small — six writers, six separate
promises, no arithmetic anywhere. It held for exactly as long as nobody added a
seventh.

0211 added health. Health took ONE line. A year that was already at the cap went
to eight, and two invariant tests written five tickets apart failed together.
Trimming the health phase to one line did not fix it, and could not have: the
overflow was not health's, it was the year's.

So the cap moved to `advanceYear`, where the year is assembled and where the
total is visible for the first time. Milestones are never dropped — a
graduation, a wedding, a birth and a death are what a life is remembered by, and
a feed that swallowed one to make room for a cold would be worse than a long
year — and the surviving lines are re-sequenced, because leaving the original
gaps sorts correctly and then reads as though something is missing.

The general form: when a rule is about a TOTAL, it cannot be kept by the parts.
Each part is behaving correctly and the sum is still wrong, which is why every
contributor's tests stay green while the thing they were protecting breaks.

The same shape appeared twice more in this ticket, in the tests rather than the
code. A test that counted a year's lines was counting the player's own answers
alongside the year's, and a test that compared two clamped deltas was measuring
the clamp. Both had been right for five tickets and both were measuring
something adjacent to what they claimed.

### 13.34 Health is a condition, not a resource

Ticket 0211 measured before it built, and found health p10 38 / median 52 /
p90 63 at twenty — and the same three numbers at thirty, forty, fifty, sixty,
seventy and eighty. Nothing in the build had written to it since childhood
workload, and 80 of 80 characters were alive at eighty. A bar the player had
been looking at since 0106 had never once meant anything.

Three rules came out of building the fix.

**A stat that does not move cannot carry a rule.** Adding mortality on top of a
frozen number produces a flat hazard — the same chance of dying at twenty-five
as at ninety. Health had to move before death could depend on it, which is why
this ticket is an ageing curve first and a mortality curve second.

**One number cannot be two things.** The first version kept a single health value
that age lowered, illness lowered harder, and recovery raised. Recovery at 2.2 a
year swamped an age curve costing 0.45, so nobody aged, everything that moved
health was a condition ceiling, and the median character died at sixty-four.
Splitting it into VITALITY — what age has done, never given back — and DEFICIT —
what illness took and time returns — made both curves tunable, because each one
then had exactly one job.

**And the baseline is the population's, not the word's.** `frailtyFactor` treated
70 as healthy because seventy sounds healthy. The played population sits at 66.
Every character in the game was therefore frail for their entire adult life.
That is 13.25 for the third time, and it will not be the last.

Spec 531, 1165 and 1974 are what keep this from becoming a management screen:
routine health maintenance is removed BY NAME. So there is one button, once a
year, worth a few points — because a check-up worth ten points makes skipping it
a mistake, and a control you are punished for not pressing every January for
eighty years is the chore the spec deletes.

### 13.35 A rule scoped to a word instead of a sense writes the bug itself

Ticket 0211b, found by reading a played childhood after the voice pass shipped:

> "Slept through the night for the first time. The household treated it as a
> public vacation."

Nobody wrote that. The American English table said `holiday` → `vacation`, the
Americanisation sweep obeyed it, and "public holiday" became "public vacation".
The word has two senses and only one of them is British: a trip you take is,
a day the country takes off is not. A rule that names the WORD rejects the
correct use along with the wrong one — and because a sweep trusts the rule, it
then produces copy that is wrong in a new way the rule cannot see.

This is the **fourth** casualty of that one table. `flat` → `apartment` gave us
"a completely apartment surface", `fringe` → `bangs` gave us "attempted a bangs
with kitchen scissors", and both shipped for three tickets reading as perfect
American English to every check that was looking for British English. **V15**
was written for those two and catches them by grammar. It could never catch this
one, because "public vacation" is grammatical.

So:

- **Scope a copy rule to the sense, not the word.** `on holiday`, `summer
holidays`, `family holiday` — the phrases where the British sense actually
  lives. Never the bare stem when the stem is ambiguous. The table already knew
  this: it declines to flag `trial`, for exactly this reason, in a comment
  written three tickets earlier and not generalised.
- **A rule that fires on correct copy is worse than no rule**, because the
  correction is what ships.
- **Check the output of a sweep, not the exit code of the rule that drove it.**
  All four of these were found by reading a played life. None of them could have
  been found by running the suite, because in each case the suite is asserting
  the rule that caused the defect.

### 13.36 A field nothing writes is not state — it is a comment with a type

Ticket 0212 opened by measuring 400 played lives and found the player dying at a
median of seventy-three **survived by a hundred-and-five-year-old mother**.
Nothing in eleven tickets had ever written `alive: false` to an NPC.

That is the third time, and the three are worth listing because they are the
same bug wearing different clothes:

- **`droppedOut`** (found in 0210) — read in five places, written in zero. A
  whole employment model was built on a distinction between school leavers and
  graduates that the build could not make.
- **`alive: false` on a family member** (found here) — read by the stress model
  since 0205, written by nothing. The comment beside it said _"a member who is
  `alive: false` is somebody who died while the player watched"_, which had
  never once been true.
- **`character.records`** (found here) — declared in Sprint Zero with the
  comment _"structured history for dynasty records and the death summary"_,
  initialized to `[]`, and still empty eleven tickets later. The 3–5 highlights
  spec 1284 asks for were supposed to come from it.

Each was written in good faith, for a ticket that had not happened yet. Each
looked like progress and was a promise. And in every case the cost was paid by
whichever ticket finally needed the field — which discovered, late, that it was
not building a feature but building the thing the feature had been assuming.

So:

- **A field a ticket does not populate does not ship in that ticket.** If the
  shape is genuinely worth agreeing on early, the comment says NOT WRITTEN YET
  and names the ticket that will write it, the way `livingCostOf` names 0303.
- **A reader of a field nobody writes is dead code that tests green.** The stress
  model's bereavement term had unit tests. They passed. They constructed the
  dead parent by hand, because nothing else could.
- **When a ticket adds the writer, re-measure everything downstream.** Making
  NPCs mortal turned the bereavement term — a flat penalty, charged forever —
  into every character over forty carrying twenty-two points of permanent stress
  about something in another decade, and pulled the player's own p10 age at
  death from 62 to 55. A constant that was never exercised is not a tuned
  constant; it is an untested guess that has been sitting still.

### 13.37 A state object holding a live cursor is not a value

`GameState` is treated as immutable everywhere in this build — phases take it,
return a new one, and never write through. Every field obeys that except one:
`rng` is a live `Rng` with mutable per-domain streams, held by reference.

So two calls to `advanceYear(state)` on the same object are **not** two runs from
the same starting point. The second continues on streams the first consumed.

Ticket 0212 found a test asserting exactly the wrong thing because of this. It
claimed to prove that mashing a spent button does not spend a draw — _"the seed
still means something"_ — and did it by advancing one state, then mashing that
same state and advancing it again. It was comparing year N with year N+1. It
passed for two tickets because, with seven writers, the two years happened to
produce the same sentences; adding an eighth moved the cursor and the assertion
came apart. **The eighth writer did not break the test. It revealed it.**

- **To compare two branches of one life, give each a fresh cursor from the same
  seed**: `rng.snapshot()` once, `Rng.restore(snapshot)` into each branch.
- **A test that runs the simulation twice from one state object is testing
  sequence, not determinism**, whatever its name says.
- **The rule generalises past RNG.** Anything reachable from a state object that
  is not itself a value — a cache, a cursor, a handle — makes "the same state"
  a lie, and the lie is invisible until something changes how much of it gets
  used.

### 13.38 A number the game computes and discards is a number the game does not have

Ticket 0301 opened by measuring money and found the thing it was built to fix
already sitting in the code, computed correctly, every year, and thrown away.

`savedFrom` takes a salary and works out the tax, then the cost of living, then
returns the remainder. At $42,000 with two children it calculates $8,604 and
$32,647 and hands back `$749`. Both of the first two numbers are correct. Both
are discarded on the next line. Across a career — a lifetime gross measured at
**$4.26 million** — the game could have told the player where every dollar went
at any moment, and could not answer the question at all.

That is not a missing feature. It is a **recording** failure, and the two are
worth telling apart because they cost different things to fix and one of them
looks like nothing is wrong:

- A missing feature is visible. Nobody thinks the game models mortgages.
- A discarded number is invisible and expensive. The model is right, the
  behaviour is right, and the only symptom is that a later ticket asking an
  obvious question — how much tax has this character paid? — discovers the
  answer was available eighty times and kept zero times.

So:

- **A model that derives an intermediate worth naming returns it.** `payFor`
  returning one number was correct in 0210 and wrong by 0301; `payBreakdown`
  returns four and a test asserts they sum to what the old one gave. A ticket
  that adds bookkeeping must not quietly rebalance anything, and the only way to
  prove that is to keep both and compare them.
- **"We can recompute it later" is usually false.** It is recomputable only
  while every input is still around. The inputs to a year of tax are that year's
  salary, seniority, performance and household — none of which the save keeps
  once the year is over.
- **The cheap version is a log, not a feature.** The ledger has no screen (spec
  21 forbids one) and cost one package. Its first read found a pricing defect
  that had been shipping since 0207: a forty-five-year-old earning $125,000
  taking their spouse on a **$22** date, every year, because recurring prices are
  a share of a balance that living costs keep near zero.

### 13.39 A test that counts what the player did inside a budget the engine keeps is testing the wrong thing

Three times now, and the third one was found by an unrelated ticket.

`LINES_PER_YEAR` bounds what **`advanceYear`** writes. Player actions — studying,
asking a parent, answering a decision — write on top of it, deliberately. A test
of the budget therefore has to subtract everything the player did, and the ones
that got this wrong did not fail: they passed, for tickets at a time, while
asserting `7 + however many decisions this seed happened not to raise`.

- 0211 found two: one counted the player's own decision answers inside the
  year budget, one compared two already-clamped deltas.
- 0301 found a third, in `guardians.test.ts`, which subtracted parent-asks and
  not decisions. Moving when money is posted changed which events fired in which
  year, one seed landed a decision in a busy year, and the test failed at 8. The
  budget had not been exceeded: twelve entries, four asks, one answered
  decision — seven.

The shape is always the same and it is worth recognising directly: **a test
whose subject is one producer must not measure another producer's output.** When
such a test fails after an unrelated change, the first question is whether the
invariant broke or whether the arithmetic was always wrong — and in all three
cases here it was the arithmetic.

The corollary is the useful part: **a test like this reports nothing until
something else moves.** It is not protecting the invariant it names. Rewrite it
so the thing it subtracts is explicit and complete, or it will be rewritten by
whichever ticket it ambushes.

### 13.40 A warning the build prints on every run is a warning nobody reads

Ticket 0301, from a screenshot of the product owner's terminal — not from a test,
a measurement, or anything in this repo:

```
WARN  Require cycle: simulation/src/new-game.ts
   -> simulation/src/family-generator.ts
   -> simulation/src/new-game.ts
Require cycles are allowed, but can result in uninitialized values.
```

Metro had printed that on **every single bundle since Ticket 0202** — nine
tickets, hundreds of runs, scrolling past above the line everybody was actually
reading. It survived four review rounds that were specifically about reading
output.

The cycle was held together by **two constants**. `new-game.ts` declared the
personality band; `family-generator.ts` imported the two numbers back out of it.
That is the entire back-edge, and the fix was to move them beside the type they
describe in `@yearafter/character`, where they belonged anyway.

"Can result in uninitialized values" is not a style note. Whichever module the
bundler enters first gets a partially-evaluated copy of the other, and a `const`
read during module initialisation comes back `undefined`. Here that would have
been `stream.range(undefined, undefined)` for every NPC in the game. It never
fired because both reads sit inside functions rather than at module scope —
which is luck, not design, and luck that any future refactor could spend.

- **A warning that prints every run has stopped being a warning.** It is part of
  the background, and the cost of clearing it is almost always smaller than the
  cost of reading past it for a year.
- **Not every cycle is one.** A scan of all fifteen packages found two more —
  `events/context ↔ events/text` and `social/people ↔ social/romance` — and both
  are `import type` only, erased at compile time, no runtime edge. Metro never
  warned about them and was right not to. Chasing those would have been churn.
- **The check is cheap enough to keep.** Walking relative imports across
  `packages/*/src` and reporting cycles is twenty lines and runs in a second.

### 13.41 A period identity is only a check if something outside the period anchors it

Ticket 0302, and the defect was mine, written while implementing the rule that
was supposed to prevent this class of thing.

Spec 1678 says _"opening cash + cash in − cash out = closing cash. Any mismatch
fails validation."_ So I wrote a function that walked the ledger a year at a
time, computed each year's opening, inflow and outflow from the transactions,
added them up, and checked the identity held.

It held. It would have held for **every ledger that has ever existed or ever
will**, including a corrupt one, because all four numbers came from the same
rows. Opening plus in minus out _is_ closing when you define all four by summing
the same list. It was a tautology with a `ok: boolean` on it, and it would have
sat in the suite looking exactly like coverage.

The rewrite chains the years — each year's closing becomes the next year's
opening — and compares the final closing against `ledger.balance`, which `post`
maintains separately. The chain is what makes it a check: `balance` is an
independent record, and a producer that moved money without posting moves one
and not the other.

Then the second draft of the comment claimed the walk caught a class `reconcile`
could not: a transaction stamped with the wrong year. **It does not.** The year
list is derived from the transactions, so a row stamped 19700 does not fall
outside the walk — it adds a year to it. `reconcileByYear(l).ok` is arithmetically
identical to `reconcile(l).ok` for every ledger, and there is now a test asserting
exactly that, because the honest claim is worth writing down where the flattering
one was.

Catching the wrong-year defect needed an anchor the ledger has not got: the span
of the life, which only the caller knows. That is a third function, and a third
check.

- **Ask what could make it false.** If nothing can, it is a definition, not a
  test. Every term in an identity coming from one source is the warning sign.
- **A check needs a second source of truth.** `balance` anchors the sum; the
  life's span anchors the years; a save anchors the mirror. Where there is only
  one source, there is only arithmetic.
- **Write down what a check does NOT catch**, next to what it does. The comment
  that overclaims is how a real gap gets covered by a green test.

### 13.42 A test that hands the engine a state it refuses to act on is testing the refusal

Ticket 0302, ten minutes after 13.41, in the tests written to prove 13.41's
rewrite actually worked.

Three tests corrupted a ledger three ways and asserted `advanceYear` threw. Two
went red as intended. The third stayed green — and the reason was not the check:
`advanceYear` returns early, unchanged, when a decision is pending, and that
seed happened to have an open question at the year the test stopped. The
corruption was never examined. Nothing in the test said so.

The control test in the same file — _"lets an honest year through"_ — would have
passed for precisely the same empty reason, and it is the test whose entire job
is to prove the other three are not passing vacuously.

- **A guard clause is a second exit.** Any test that calls a function with an
  early return has to establish it got past it. Asserting on the throw is not
  enough; the absence of a throw and the absence of an execution look identical.
- **Assert the preconditions the test depends on.** The helper now refuses to
  return a state with a question open or an empty ledger, and says which. That
  turned a silent pass into a named failure in one run.
- **Fixed counts hide this.** "Play six years" was doing two jobs — reach a state,
  and reach an interesting one — and only announced when it failed at the first.
  "Play until money has moved and nothing is pending, or say why not" does one.

### 13.43 A cost attached to income is not a cost, it is a deduction

Ticket 0303, from the opening measurement, and it is 13.36 wearing different
clothes.

0210 needed to stop a salary compounding into a fortune, so it computed the cost
of living as a SHARE of after-tax pay and subtracted it inside `payBreakdown`.
That worked, and it had one consequence nobody looked for until this ticket
measured for it, across 120 lives:

> A character who never takes a job is charged **nothing**, for their whole
> life. 6,357 adult years, none of them costed. They hold $100 at thirty, $100
> at fifty and $100 the day they die.

Unemployment was free. Retirement was free. Living off savings was free. And
four of the five things spec 191–193 says living costs are inferred from —
location, housing, wealth, family circumstances — could not possibly have
mattered, because none of them can reach a number defined as a percentage of a
wage. The model had one input wearing the name of five.

- **Ask what the cost is a property OF.** Rent is a property of a household, not
  of a job. Anything computed inside the thing that pays for it can only ever be
  charged to people who are being paid.
- **A placeholder's shape outlives its numbers.** 0210 labelled the constants
  and gave them a replacement date, which was right and was not enough: the
  thing that had to be replaced was `share × income`, and no amount of retuning
  the share would have found the character holding $100 for sixty years.
- **Measure the population the system will apply to, not the one it was built
  from.** Every measurement 0210 took was of somebody with a job.

### 13.44 A threshold with no hysteresis will oscillate, and the sim will not tell you

Ticket 0303, found by reading a played life rather than by any test.

A character moved out of their parents' house at eighteen, was told to leave
again at twenty-six and again at twenty-nine, and moved out a total of four
times. Measured across ninety lives: **86 of 154 housing changes happened one
year after the previous one**, and one character moved house fifteen times.

The loop is obvious once seen. They move out because savings cover a year; the
standard of living creeps up toward their income; the year goes short; hardship
moves them home and resets the standard to subsistence; subsistence is
affordable, so they move straight back out. Every step is correct. The system
made of them is nonsense.

Two fixes, and the first is the general one:

- **Test the sticky quantity, not the volatile one.** Affordability now asks
  about INCOME, not income plus savings. Savings can pay for a move; they cannot
  pay for a life. A threshold read against a number that moves every year is a
  threshold that will be crossed every year.
- **Give the state a memory of its own last change.** Somebody who has just
  given up a place does not take another one the following spring, so
  `movedBackAt` holds the door shut for two years regardless of the arithmetic.
- **And the same bug had a cousin**: `kicked-you-out` had existed since 0209
  writing five sentences and changing nothing, so it fired at people who had not
  lived at home for a decade. An event that writes no state cannot be
  contradicted by state, which is exactly why nothing had ever caught it.

**Every green test passed throughout.** The suite asserts the rules; the rules
were each individually right. Reading sixty years of one character's feed took
four minutes and found all of it.

### 13.45 A roster helper is not a definition — ask what the list is FOR

Ticket 0304, found by printing the numbers a screen was about to render.

0303 charged a household for its children, and reached for the obvious function:
`livingChildren(family)`. It returns the children who are alive. What the cost
model needed was the children being SUPPORTED, which is `childrenAtHome` — a
function that has existed since 0208, draws the line at eighteen, and says so in
its one-line comment.

Nothing failed. Every test passed, the books reconciled, and the defect was
invisible in aggregate. It became obvious the moment a screen printed a sentence
a person would read:

> child Tyler (38) costs $1,117 a month

A sixty-seven-year-old was being billed for a thirty-eight-year-old son, and had
been since the year he was born. A household's costs never fell after the
children grew up, which is most of the reason a late career could not save.

- **Two functions over the same collection are two DEFINITIONS.** `livingChildren`
  and `childrenAtHome` differ by one predicate and by the entire question they
  answer. Picking one by name-similarity is picking a definition by accident.
- **Print a sentence, not a total.** The aggregate said "outflow is a bit high";
  the sentence said a specific wrong thing about a specific person. The same
  measurement, rendered for a reader, is a different instrument.
- **And it invalidated a tuning pass.** 0303's `MARGINAL_SPEND` was fitted
  against a game that overcharged, so fixing the bug lifted the median balance
  at forty from $101,000 to $171,000 and the constant had to be set again. A
  number tuned against a defect is a number that comes back for a second visit
  when the defect goes.

### 13.46 A term that rewards the absence of activity is not a measurement

Ticket 0305, caught by measuring the population rather than by any assertion.

Credit standing weights "keeping up" most heavily, which is right: whether
somebody covered what they owed is the thing credit is actually about. Then the
distribution came back and a character who **never takes a job** was landing on
**Fair** — holding nothing, earning nothing, owing nothing.

They had never come up short. They had never come up short because 0303's living
phase contracts a household rather than letting a bill go unpaid, so there was
nothing to fail at. The heaviest term in the model was handing out full marks
for having no financial life at all.

The fix is one line and it is the real-world rule too: the record counts only to
the extent there was something to keep up with. A lender calls that a thin file,
and a thin file is not a good file. Measured after: a life that never works is
95% "none" and 5% "poor", and nothing else.

- **Ask what a perfect score means.** If somebody can top a term by doing
  nothing, the term is measuring absence and calling it virtue.
- **The population finds this; a unit test cannot.** Every assertion about the
  term was true. It was the shape of the distribution that was wrong, and only
  playing a hundred lives showed it.

### 13.47 Four reasons is a wall; two is an explanation

Ticket 0305, from reading the built screen.

The credit screen lists what is helping and what is hurting, which is the whole
point of a standing with no number behind it — a band the player cannot act on
is the opaque score the spec rules out. The first version pushed every reason
that crossed a threshold, and a real played life read:

```
Poor
- You have no record to go on
- You do not earn much
- Your costs take nearly everything
- You have nothing put by
```

Four negatives, no positives, for the crime of being nineteen. Every line was
true and the screen was still wrong: a player cannot tell which of the four to
do something about, so they do nothing about any of them. Spec 1381 asks for
credit that is "useful, not universally punitive", and that is a presentation
requirement as much as a model one.

Capped at two a side, ordered by how much each term actually moved the standing.
Nothing is hidden, because the two shown are the two that mattered. Across 4,638
adult years the screen now averages 1.7 reasons in favour and 0.65 against, and
shows both sides in 48% of years.

- **Thresholds for REASONS drift when the model's bars move.** Two of those four
  lines fired for nearly everybody, because they were tuned against the old bars
  and never revisited — 13.26 arriving through the back door.
- **A thin record is one fact, not four.** Somebody who has barely earned
  anything does not also need telling they do not earn much and have nothing put
  by. Saying it three ways is piling on.

### 13.48 A stat you can raise by tapping is a stat the player will tap for

Ticket 0306, found by measuring a deliberately greedy player.

Credit standing gained a utilisation term the moment cards existed, weighted at
22% of quality and scoring full marks at zero utilisation. That reads fine: an
unused card is a well-managed card. Then a population that applied for every
card on offer, every year, was measured against one that never applied at all:

|                  | Excellent | Good | Fair   |
| ---------------- | --------- | ---- | ------ |
| never applies    | 31%       | 43%  | 21%    |
| takes every card | **44%**   | 46%  | **5%** |

Holding cards you never use made you creditworthy. No money changed hands, no
decision was made, and a fifth of a credit standing was available for pressing a
button eight times. That is spec 1381's circular credit exploit in its purest
form and CORE_RULES 13.28 besides — a tap is not a decision, and a free stat for
tapping is worse than either.

The fix is to make the term a PENALTY ONLY: running a card near its limit costs
you, and not running one is worth nothing. A character with no cards and one
with five empty ones now score identically — 30/43/21 either way — and the value
of a credit line is the line, not a number it buys you.

- **Ask what a zero input scores.** If "absent" and "perfect" are the same value,
  the term rewards acquiring the thing rather than using it well. This is 13.46
  from the other side: that rule was about a term rewarding the absence of
  activity; this one is about a term rewarding the presence of an unused asset.
- **Measure a greedy player, not an average one.** The average player would
  never have shown this. The test that finds an exploit is the one that tries
  to commit it.

### 13.49 A gate that has never been the binding one has not been tested

_Ticket 0307._ Loan underwriting has two gates: a credit standing and an income.
Both were real rules, both were wired up, both had tests, and the tests passed.
Then the population was asked which one was actually stopping anybody:

|                                                          | rows refused |
| -------------------------------------------------------- | ------------ |
| refused on standing                                      | 26,550       |
| ...that would also have failed the income gate behind it | **26,550**   |

Every one. Not most, not 95% — all of them, across 120 lives and roughly 5,000
adult years. The credit gate had never once been the thing holding the door,
because `creditReport` weights income heavily enough that anybody clearing
$140,000 has earned an excellent band on the way past. It was the income gate
wearing a different label, and the label was the harmful part: the player was
told "your credit is not there yet" — a decade of work — when the true answer
was "you do not earn enough", which they could fix next year.

- **A passing test on a gate proves the gate computes, not that it discriminates.**
  Unit tests construct the borrower who fails that specific check. They cannot
  tell you that borrower never occurs.
- **Count which gate fires FIRST against which gates would ALSO have fired.**
  A gate whose refusals are a subset of the next gate's is dead weight, and
  reporting it is reporting the wrong reason.
- **Order the checks so the reported one is the actionable one.** Two true
  refusals are not equally useful. Say the one the player can do something
  about this year.

Keeping the dead gate is fine when something scheduled will decouple it — 0308's
portfolio gives somebody assets without income. But then say so, and know that
until that ticket lands the gate is untested rather than tested.

### 13.50 If waiting is free, no loan can ever be worth taking

_Ticket 0307._ The student loan is the ticket's whole reason for existing:
cash at eighteen is $0 at every percentile including the maximum, and a college
place costs $7,436 a year. It was built, measured, bounded, and it works. Then
the same 120 seeds were played twice — once with the loan available, once
without — and scored only on the 112 lives where money was genuinely the thing
in the way:

|                   | any degree | postgraduate | cash at death | first enrolled |
| ----------------- | ---------- | ------------ | ------------- | -------------- |
| no loan available | 100        | 88           | $20,709       | age 21         |
| loan available    | **91**     | **73**       | **$10,801**   | age 18         |

Borrowing to go to college made people _less_ educated and _half_ as rich. It
is not composition — same seeds, same people, paired.

The mechanism is in the last column. Blocked at eighteen and offered nothing, a
character waits three years, saves, and enrols at twenty-one — and this build
charges them nothing for the delay. Enrolling at 28 costs exactly what enrolling
at 18 costs: no lost earning years, no admissions penalty, no life stage in the
way. So the loan sells three years that are worth nothing, at 6.1% for ten
years, and the interest is pure loss.

No amount of re-pricing fixes this. A loan cannot beat free, and waiting is
free.

- **A cost with no clock is not a cost.** Every instrument that buys TIME —
  loans, financing, anything paid for in interest — is strictly dominated until
  the thing it accelerates has a deadline.
- **Test an instrument by paired runs on the same seeds, not by two
  populations.** The first comparison here showed 68 → 56 and looked like the
  same finding; it was mostly composition, because offering a loan changes who
  goes to college. Only the paired run on the treated group was evidence.
- **The failure was not in the ticket that found it.** The loan engine is
  correct. What the measurement exposed is that education has no time cost, and
  that belongs to education's ticket. Build the instrument, measure it honestly,
  and file the upstream gap rather than tuning the instrument to hide it.

### 13.51 A test that pins a list catches a wrong deletion and never a missing one

_Ticket 0308._ This build guards its unfinished edges with declared lists —
`UNWRITTEN_CATEGORIES`, `NOT_YET_OWNED`, `LOAN_TYPES_NOT_YET_BUILT`,
`CREDIT_INPUTS_NOT_YET_BUILT` — each naming the ticket that retires it, each
with a test asserting its contents so that "the ticket which finally writes one
has to come here and delete a line".

The device has been described that way four times and it does not work. The
test asserts what the list currently holds, so:

|                                             |           |
| ------------------------------------------- | --------- |
| a line deleted when it should not have been | **red**   |
| a line left behind that should have gone    | **green** |

Ticket 0307 built cards and loans and left `{ key: 'liabilities', arrives:
'0307' }` in `NOT_YET_OWNED`. For a whole ticket the dashboard told players
liabilities had not been built while showing their card balance two rows below,
and `netWorth` returned the bare cash balance with `onlyCash` hard-coded true —
so a character with $40,000 of cash and $30,000 of card debt was shown a net
worth of $40,000 and told underneath that they owned nothing and owed nothing.
Every test passed the entire time.

The fix is a second assertion running the other way. Each entry already names
its arrival; a constant names the ticket that has shipped; nothing may still be
waiting on a ticket that is already past:

```ts
for (const row of NOT_YET_OWNED) expect(stillAhead(row.arrives)).toBe(true);
```

- **Ask what a green test would look like if the work had been forgotten.** If
  the answer is "the same", the test is documentation, not a guard.
- **A promise with a date can be checked against the date.** Every not-built
  list in this build already carried one and none of them compared it to
  anything.
- **The bug is invisible from inside the ticket that causes it.** 0307 had no
  reason to open `summary.ts`. Only a rule that fires without being visited
  would have caught it — which is what this now is.

### 13.52 Nothing in this build ever needs cash by a date, and that breaks both sides of finance

> **CORRECTED IN 0308b, AND THE CORRECTION IS THE LESSON.** The measurement
> below watched `shortfall` rows and card debt, found both at 0%, and concluded
> that being broke is free. Both signals are zero BY CONSTRUCTION: 0303's
> hardship branch caps the year's charge at whatever the household actually
> has, so a shortfall can never be recorded and a card is never asked for. The
> conclusion was drawn from two numbers that could not have been anything else.
>
> Being broke is not free. It costs about sixty points of happiness (median 78
> against 17) through stress. What it also does is hand out a $430,000 discount
> on a lifetime of living — see 13.53, which is the defect this rule was
> looking at and mis-described.
>
> The half of this rule that survives is the DEADLINE half: waiting is still
> free, education still has no clock, and no instrument that buys time is worth
> its interest. The liquidity half was wrong.
>
> **What the floor is actually made of, found in 0308b:** `cashAtLeast` gates
> events, and 34 of the gated ones RELIEVE stress — the arcade, going out,
> small treats. A character with an empty account is locked out of all of them,
> stress accumulates unrelieved, and stress costs happiness. Median happiness
> runs 78 for a character who keeps a buffer against 20 for one who does not.
> Nobody designed that as a floor and it is a good one: being broke does not
> bill you, it shuts you out of the things that make a life bearable. 0308b
> also gave bonds a maturity date, which is the first instrument in this build
> where money is genuinely away until a date.

_Ticket 0308, and the other half of 13.50._

That rule found that a student loan makes its own target worse off, because
waiting is free: blocked at eighteen, a character saves and enrols at
twenty-one at no cost, so buying three years at 6.1% is pure loss. This ticket
looked for the mirror — the liquidity trap that was supposed to make "how much
to invest" a real question — and found it does not exist either.

Measured across 800 lives, five strategies, two player types, two of which hold
literally zero cash by construction:

|                           | shortfall years | card-debt years | years at $0 cash |
| ------------------------- | --------------- | --------------- | ---------------- |
| every strategy, careerist | **0%**          | **0%**          | 3%               |
| every strategy, drifter   | **0%**          | **0%**          | 8%               |

Characters do run out of money. It costs them nothing, because a year's income
is posted before that year's costs are paid. Being broke on the first of
January is free.

One missing thing, two broken halves of the same system:

- **because waiting is free**, no instrument that buys TIME can be worth its
  interest — every loan is dominated;
- **because being broke is free**, no instrument that keeps money LIQUID can be
  worth its lower return — the safe asset is dominated, and holding cash for
  safety is a cost with no benefit.

Both were designed around a pressure the build does not apply.

- **A tension you wrote a comment about is not a tension you measured.** The
  module header for this engine asserted the liquidity trap in confident prose
  for several hours before the measurement contradicted it. The comment was
  rewritten to say what was actually found, including what it used to claim —
  a design note that quietly becomes false is worse than no note.
- **Before building a cost, find the thing it bites.** Name the state the
  player ends up in and check the build punishes it. If nothing does, the
  instrument is decoration however carefully it is modelled.
- **This is one fix, not two.** Deadlines and a floor — something that must be
  paid by a date, and a consequence for having nothing — would make loans and
  liquidity both matter at once. It belongs upstream of either ticket.

### 13.53 Running out of money is a discount, and a zero you did not derive is not a measurement

_Ticket 0308b._ Two findings, and the second one is about how the first was
missed for two milestones.

**Hardship pays.** 0303 gives a household that cannot afford its life a cliff:
the standard of living drops to subsistence at once, they move back to family if
there is family, and the year's charge is capped at what they actually have.
Every part of that is right on its own. Together they mean that running out of
money makes life CHEAPER and nothing else. Measured over 80 paired seeds:

|                      | lifetime living cost | standard (med) | net worth (med) | happiness (med) |
| -------------------- | -------------------- | -------------- | --------------- | --------------- |
| never invests        | $2,541,128           | $43,388        | $203,110        | 78              |
| keeps a buffer       | $2,383,415           | $40,092        | $1,049,193      | 78              |
| invests every dollar | **$2,111,197**       | $36,404        | **$2,330,577**  | **17**          |

The player who empties their current account every year spends **$430,000 less
on living across a lifetime** and ends up twelve times richer. Hardship is a
subsidy for the behaviour it should be discouraging, and the loop closes: a
cheaper life frees more cash, which gets invested, which keeps them in hardship.

It is not unpunished — happiness collapses from 78 to 17 through stress, which
is a real cost and the reason this is a trade-off rather than a pure exploit.
But the trade should be _"a cheap miserable life against a comfortable one"_,
not _"a cheap miserable life that also makes you rich"_.

**And the measurement that missed it.** 13.52 concluded being broke was free
from two numbers: `shortfall` years at 0% and card-debt years at 0%, across 800
lives. Both are zero by construction. The hardship branch caps the charge at
what the household has, so a shortfall can never be written; the card draw is
computed from that already-capped figure, so a card is never asked for. Eight
hundred lives of evidence for a proposition that no number of lives could have
disconfirmed.

- **A zero is only evidence if the code could have produced something else.**
  Before believing one, find the line that would have written a non-zero and
  check it is reachable. Both of these were unreachable.
- **Instrument the branch, not its side effects.** `inHardship` was a local
  variable for two milestones. The thing to count was the branch firing; what
  got counted was two downstream signals the branch suppresses.
- **A large sample makes a broken metric more convincing, not less.** 800 lives
  made the wrong answer feel settled. Sample size tests noise, never validity.

### 13.54 Ask which account a rule reads, not just which number

_Ticket 0308b._ 13.53's subsidy — invest everything, live $430,000 cheaper —
turned out to be one mistake made twice, in two functions, three lines apart.
Both read `wealth`, and `wealth` was the cash balance:

```ts
standardTargetFor(input.afterTaxIncome, input.wealth); // what life you drift toward
const affordable = input.afterTaxIncome + input.wealth; // what you can pay for it
```

Fixing only the second took the gap from $430,000 to $189,251 and stopped,
because the first was still quietly deciding that a character with two million
in an index fund should drift toward the standard of living of somebody with
nothing. Fixing both took it to **-$183,925** — the all-in player now spends
_more_, which is correct, because a millionaire lives like a millionaire
wherever they keep it.

|                      | lifetime living | net worth (med) | happiness |
| -------------------- | --------------- | --------------- | --------- |
| never invests        | $2,546,159      | $201,238        | 78        |
| keeps a buffer       | $2,604,554      | $705,403        | 78        |
| invests every dollar | $2,730,084      | $1,418,485      | 23        |
| all into bonds       | $2,556,281      | $597,716        | 20        |

- **A variable named for a quantity hides which account it came from.**
  `wealth` sounds like everything somebody is worth and held only their current
  account. The name is why it survived two milestones and two readings.
- **When a fix moves a number partway, the rest is usually the same bug
  elsewhere.** $430,000 → $189,251 was not "mostly fixed", it was a second
  call site. Partial movement is a signal, not a result.
- **Grep the field, not the concept.** Every reader of `wealth` had to be
  looked at. Reasoning about "does the game know how rich they are" would have
  found the one already in mind and missed the other.

### 13.55 A model with no memory of a peak can never give one back

_Ticket 0308d._ The market shipped in 0308c destroyed value permanently. An
index of every stock, rebased to 100 the year before a severe recession begins:

```
100 → 58 → 53 → 52 → 51 → 53 → 55 → 57 → 59 → 62 → 64 → 67 → 69
```

**Twelve years on it is still at 69.** The cause is one line: the market state
moved the growth RATE for a year, and the following year carried on from the
lower base. Nothing in the model knew the price had ever been higher, so nothing
could return it.

- **A shock to a rate is permanent; a shock to a level is temporary.** Which one
  a system applies decides whether its bad years are weather or amputation, and
  the two are indistinguishable in a single year's output. Only a multi-year
  path shows it, and nothing in the suite was drawing one.
- **The tell was in the player's incentives, not the numbers.** Buying during a
  crash returned 1.44x over ten years against 2.02x for buying in a boom. When
  the screen tells a player what kind of year it is and the correct play is to
  ignore it, the information is not flavour — the model underneath is wrong.
- **Fixing it broke a passing test, and the test had been passing for the wrong
  reason.** `diversification.test.ts` concentrated in TECHNOLOGY, the
  highest-drift sector, and compared it against a six-sector mix. Two errors
  were cancelling: the drift advantage was being eaten by variance drag.
  Reversion reduced the drag, the cancellation stopped, and the median gap went
  to 24%. **A test whose two confounds cancel reports a pass and a number that
  means nothing.** Pooling over all seven sectors removed the confound rather
  than loosening the bound.
- **A tuning constant that changes an incentive needs the incentive measured,
  not the variance.** `REVERSION` was set at 0.14 because that is where buying
  after a crash pays 29% more than buying after a boom (2.32x against 1.80x)
  while a ten-year hold still loses money 5% of the time. At 0.18 the dip becomes
  a cheat code; at 0.10 it barely registers. Neither shows up in a return
  distribution.

### 13.56 A signal is only real where its mechanism runs

_Ticket 0309._ The obvious advisor rule is "recommend what is trading below its
own trend", and 0308d's mean reversion is exactly the mechanism that would make
it pay. Measured over 6,000 market years it **loses to a coin flip**: a single
call goes up 41.9% of the time against 56% for a name picked at random.

The cause is one line of the market model. Reversion is applied to stocks and
funds and deliberately NOT to crypto or penny stocks, because those have no
value to revert to. A name sits far below its anchor mostly because its spread
is enormous — and the two widest tiers are the two exempt ones. **The naive top
six was 94.2% crypto and penny stocks.** The signal was selecting precisely the
names where the thing that makes it work does not happen.

Restricted to the reverting tiers, the same rule returns 11.4% against 6.4% and
beats random 63.7% of the time. Same rule, opposite sign, one filter apart.

- **A signal inherits the scope of its mechanism, and nothing tells you when it
  has left.** `gapToTrend` computes a real number for a coin. It is arithmetic
  all the way down and it means nothing.
- **An exemption written in one file is a constraint on every file that reads
  it.** The `crypto`/`penny` carve-out lives in `market.ts` as four words in a
  condition. Two tickets later it silently invalidated a feature in a different
  package, and only measuring against a control found it.
- **The rule generalises past this build.** Any derived signal — a momentum
  read, a credit score, a relationship trend — is valid only over the population
  its generator actually moves. Before shipping one, ask which rows the
  mechanism skips, because those are the rows the signal will find first.

**And the same measurement killed the design above it.** Advisor tiers were to
be "reads the hidden fundamental more accurately". Swept from no skill to
perfect, the mean year moved 6.3% to 7.4% and the odds of a single call going up
stayed pinned at 61% throughout — drift spans 0.02–0.082 while volatility spans
0.12–0.95, so across one year the fundamental is a rounding error. **A tier
built on it would have been a label with nothing behind it**, and it would have
looked fine in every test that did not compare it against a control.

### 13.57 A lever is inert until it crosses the threshold the consumer applies

_Ticket 0310._ Nobody in this build had ever retired. Measured across 120 played
lives, **100% of characters alive at 65, 70 AND 75 were still holding a job**,
with median pay climbing the whole way from $60,403 at forty to $126,789 at
seventy-five. The cause was one clamp: `capacityFor` ramped a child up to
sixteen and then held capacity flat forever, so working into your nineties was
free and stopping was strictly worse than not stopping.

Adding a decline of 0.42 hours a year looked like the fix and did nothing. A
seventy-year-old's stress went to 17 — and `RELEVANCE_THRESHOLD` in
`@yearafter/stress` is **30**, below which stress costs exactly nothing by
design, so an ordinary childhood is never quietly taxed. The lever was moving a
number the consuming system deliberately ignores.

|                 | stress w/r | happiness w/r |
| --------------- | ---------- | ------------- |
| at 0.42, age 70 | 17 / 1     | 81 / 82       |
| at 0.9, age 70  | 70 / 1     | **62 / 82**   |

- **Reading the lever's own output proves nothing.** Stress moved from 1 to 17,
  which is a seventeenfold change and entirely worthless. The only reading that
  meant anything was the one taken downstream of the threshold.
- **Every consumer has a floor, and floors are invisible from upstream.**
  `capacityFor` cannot see `RELEVANCE_THRESHOLD`; the two live in different
  packages and neither mentions the other. Before tuning a number, find what
  reads it and what that reader ignores.
- **Tune against the incentive, not the magnitude.** The question was never "how
  much stress is realistic for a seventy-year-old" — it was "at what value does
  a player choose to stop". At 1.2 the same table reaches a happiness of 25 by
  seventy, which does not make retiring a choice either: it makes carrying on
  impossible, which is the same missing decision from the other side.
- **And a system's absence can hide behind a full implementation.** The jobs
  catalog has advertised "Retirement match, paid time off" and "Pension, and it
  is a real one" since 0210. Both were display strings with nothing behind them
  for two milestones — 13.36 in copy form, and nothing failed, because a promise
  the game never keeps still renders.

### 13.58 A lever measured on a population it cannot apply to has not been measured

_Ticket 0401._ v0.04's spec asks for 150–250 job titles. Measured first: one
life saw **13 of the 49 jobs that already existed**, and **20 of the 49 were
never shown to a single character across 100 played lives**. So the milestone
was not content volume, and three candidate levers were measured over one fixed
corpus of 3,471 working life-years to decide which one opened the funnel.

Two of the three came back **identical to the control, to the digit**:

| lever                         | distinct shown | eligible/yr | per life (median) |
| ----------------------------- | -------------- | ----------- | ----------------- |
| CONTROL                       | 30             | 13.4        | 15                |
| A reserved step-up slots      | 30             | 13.4        | 15                |
| **B a degree opens a ladder** | **30**         | **13.4**    | **15**            |
| D transferable experience     | 31             | 21.0        | 24                |

Lever A was weak for a reason worth knowing: there is usually no step-up in the
eligible set to reserve a slot for, so reserving one does nothing. Lever B was
not weak at all. It was **untestable on that corpus** — a separate count found
**94.7% of the working life-years at `highSchool`, 5.3% at `none`, and life-years
where a major opened any track: 0**. The harness answers the first choice of
every decision, which never enrolls, so no character in it ever held a degree.
A lever that grants something to graduates, measured on a population with no
graduates, returns the control by construction.

- **An identical result is a different signal from a small one.** A lever that
  moves a number by 2% is weak. A lever that reproduces the control _to the
  digit_ is not being exercised, and the next step is to check its precondition
  rather than to tune it.
- **Check the population before believing the sweep.** One count — how many rows
  the lever could possibly apply to — would have caught it before the table was
  read. It costs one line and it is the same discipline as 13.51's derived
  guard: prove the thing you are measuring is present.
- **The dead lever still said something true.** "No passive life ever earns a
  degree" is a real finding about the build, and it explains exactly which jobs
  stayed invisible after the ticket shipped: the nine credential-gated ones.

### 13.59 When the gate moves, the ruler moves with it

_Ticket 0401, the same afternoon._ The listing-composition counter classified
each of the six openings as a step-up or a cold start by comparing `job.rung`
against the **raw held rung**. 0401 moved the gate onto an _effective_ rung.
Rerunning it, step-ups read **1.30 → 0.61** and cold starts **4.69 → 2.61** — a
mechanic that had apparently made the problem worse. The three buckets no longer
summed to six, which is the only reason it was caught: a rung-1 job on an
untouched track was now neither.

- **A metric that shares a definition with the code under test is not
  independent of it.** It has to be re-derived when that definition changes, and
  there is no warning when it is not.
- **Give every partition a total that must hold.** "The buckets sum to the
  number of listings" is one line and it is what turned a plausible wrong number
  into an obvious broken one. Without it, the honest reading of that table was
  "revert the ticket."

### 13.60 The price you wrote down is not the price that is charged

_Ticket 0402._ An arriving job offer had to cost something or it was a promotion
with a button on it. The cost was designed and documented: taking a job resets
performance to a stranger's 38–52, the same reset `applyFor` charges, which
should mean a rough couple of years and a real risk of being let go. The
docblock said so. The player-facing prompt said so.

Paired seeds — the same life lived twice, answering every offer the opposite
way — said otherwise:

| across 176 offers taken | taking  | declining |
| ----------------------- | ------- | --------- |
| let go                  | 53      | 46        |
| **promoted**            | **173** | **306**   |

**Seven extra firings across 176 job changes.** The designed cost was worth
almost nothing, because `firingChance` does not notice two soft years — 13.57
again, from inside the thing being built rather than from upstream of it.

The cost that actually bites was in the same table and nobody designed it:
taking an offer costs about three quarters of a promotion, because `since`
resets and `promotionChance` scales with years served. The real trade is _a
raise now against the ladder you were already on._

- **A cost is a measurement, not a declaration.** Writing the reset and calling
  it the price is the same error as writing a lever and calling it tuned. The
  only way to know what a choice costs is to make the choice twice.
- **The prompt was teaching the player a rule the game does not run on**, which
  is worse than a prompt that explains nothing: a player who learns "changing
  jobs is risky at first" from this build learns something false, and will
  misplay every future offer on it. The sentence now names the promotion queue.
- **Look for the price you did NOT design.** Both numbers came out of one paired
  run, and the second was only visible because the harness counted promotions
  alongside firings out of habit rather than intent. A paired experiment should
  report everything that differed, not only what the hypothesis was about.

### 13.61 A rung competes with itself before it competes with anything else

_Ticket 0403._ The job catalog tripled — 49 jobs to 147, eleven tracks to
sixteen — mostly by widening rungs rather than lengthening ladders, on the
theory that a wider rung is a different door into the same career and a longer
ladder is a rarer promotion. Trades' rung 2 got widened furthest: electrician,
plumber, HVAC technician, carpenter, four parallel titles competing for the
same six-listing draw. The reachability guard (0401's, written before this
ticket for exactly this) caught the ladder's OWN rung 4 — `General
contractor`, unduplicated, unchanged since 0210 — going unseen by every played
life in the sample.

The instinct was to look outward: more tracks, more competing cold starts,
more crowding from elsewhere in the catalog. Both were tried — a higher
`LISTINGS`, a heavier step-up weight in `openingsFor` — and neither moved the
count without unpredictably starving something else instead, because both
change the ranking of every job simultaneously and the sample is small enough
that the specific starved job just relocates. What actually cleared it was
looking inward: trimming rung 2 back to two parallel titles, so a character
climbing THIS ladder was no longer splitting its own step-up odds four ways
before ever reaching the rung that leads to the top.

- **A rung's own width is a cost paid by the rungs above it**, not just by the
  rungs beside it. Four siblings at rung 2 do not only compete with each other
  for this year's six listings — they thin the population that ever holds a
  rung-2 job long enough to become eligible for rung 3, and thin it again for
  rung 4.
- **When a shared, weighted, capacity-limited draw starves something, check
  the item's own neighborhood before tuning the global knobs.** The global
  knobs move everyone at once; a local fix moves only the thing that was
  actually crowded.
- **"Two or three parallel titles per rung," stated as a design rule while
  writing the catalog, was right, and the one rung that violated it was the
  one that broke.** A rule of thumb earns its place by being checked against,
  not just stated.

### 13.62 A coverage guarantee is a population question, not a weighting one

_Ticket 0403, the same afternoon._ Even after 13.61's fix, one rare job — a
different one each time the catalog or the draw's weights changed — still
went unseen across the reachability guard's 60 played lives. Every candidate
was real: eligible to at least one life, honestly reachable, no duplicate
competing with it. It was simply the kind of event that needs more trials than
60 lives supply once the thing being sampled is a specific rung on a specific
one of sixteen tracks rather than one of eleven.

Raising the sample to 250 lives cleared it outright, with margin. Raising
`LISTINGS` or the step-up weight first — the two levers 13.61 also reached
for — had moved the SAME symptom to a different job each time rather than
reducing it, because both reshape the draw for every eligible character in the
population, which is the wrong lever for a question about how large the
population needs to be before a low-probability, per-life event is seen by
anybody in it.

- **Distinguish a starved job from an under-sampled one.** A starved job is
  structurally disadvantaged — crowded off its own rung, or gated by
  something upstream. An under-sampled one is just rare, and no amount of
  reweighting the draw fixes a sample that is too small to expect to see it.
- **When a fix relocates the symptom instead of shrinking it, the lever was
  probably global and the problem was probably about population size.**
  Tuning a shared weight and watching a DIFFERENT thing break is the tell.
- **The guard's sample size is not a constant — it is sized to what it is
  covering.** Sixteen tracks' worth of rare top-of-ladder events need more
  trials than eleven tracks' worth did, in the same proportion the catalog
  grew.

### 13.63 A test's own shortcuts are measured against a population too

_Ticket 0405._ Giving college a systemic offer — the same door 0402 built for
a job — routed most of two other tests' populations through college for the
first time, and both broke, neither one because the mechanic was wrong.

`health.test.ts`'s injury ratio inverted: a hurt-line regex written for
`packages/simulation/src/phases/health.ts`'s eight `HURT_LINES` also matched
`college.ts`'s "starting in the **fall**" — a line that was rare enough,
before any passive route into college existed, that the false match never
moved a ratio measured over 8,000+ idle years. The same test also hardcoded
`stage: 'middle'` in the context it asked `activityOffers` with, which
`isInSchool` (correctly) never rejected for a character now enrolled in
college — so twenty-year-olds started "joining" middle-school basketball
teams and carrying the athlete classification for the rest of their charted
life. Neither bug was in the game. Both were in a harness whose shortcuts had
never been exercised by a population that reached college before.

`careers.test.ts`'s "a third of lives top out" bound went to 52%, and this
one WAS the ticket working: more people legitimately qualifying for a
credential-gated rung-4 job, because more people now legitimately hold the
credential.

- **A regex, a hardcoded parameter, or a stubbed context is a measurement
  choice, exactly like a sample size or a picker.** It is correct only for
  the population that has exercised it so far, and a ticket that changes
  population composition can make it wrong without touching the system the
  test is actually about.
- **Distinguish the two outcomes the same way 13.62 does for a starved job.**
  A test that breaks because its OWN shortcut was never exercised by this
  shape of life needs the shortcut fixed. A test that breaks because the
  population genuinely changed — more graduates reaching a credentialed rung,
  more income moving a financial gap (13.53's note on 0403) — needs its bound
  moved, with the reason written down, not the population argued with.
- **A dormant bug in a test is still a bug**, and the population that
  finally reaches it did not create it. `health.test.ts` had been asserting a
  ratio computed from a false-positive-contaminated pair of buckets since
  long before this ticket; 0405 did not introduce the contamination, it only
  supplied the first population large enough to make it visible.

### 13.64 An ordered credential cannot express "this specific paper"

`EducationLevel` is a ladder — `none`, `highSchool`, `university`,
`postgraduate` — and `meetsLevel` compares indexes. Every gate built on it can
therefore only ever say "this much schooling **or more**". That is the right
shape for most of what a job wants and the wrong shape for the commonest real
requirement in the professions, which is not an amount of education but a named
license: a medical degree, a bar admission, a journeyman's ticket.

0210b wrote `requires: 'postgraduate'` on Physician and left a docblock saying
"you legally cannot do this job without it". It was not true. A master's in fine
arts cleared that gate exactly as well as a medical degree, for three tickets,
because an ordered comparison has no way to refuse. Nobody noticed because the
catalogue had no second professional track to disagree with the first.

0406 added `Job.license` beside `requires` rather than extending the ladder, and
the two halves of that decision are both the rule:

- **It is not ordered, so nothing substitutes for it.** That is what makes
  medical school a wall rather than an expensive master's.
- **It is not on the ladder, so holding one does not rank you.** A journeyman
  electrician with a high-school diploma is not "less educated" than somebody
  two years into fine arts; they hold a different thing. The obvious build —
  slotting trade school in as an associate tier between `highSchool` and
  `university` — was rejected for exactly this, because it would have ranked a
  plumber's qualification below a dropped-out bachelor's.

The general form: **before extending an ordered enum to cover a new case, check
whether the new case has an order at all.** If it does not, it is a second
dimension and it belongs beside the first, not inside it. The tell is having to
argue about where the new value sorts — an argument that has no correct answer
is an argument that the value is not on that axis.

The corollary is that the new dimension needs its own reachability guard.
`reachability.test.ts` asserts that no job is eligible to somebody and
unreachable by the listings; `licenses.test.ts` asserts the same thing one
dimension over — that no job is gated on a license no program hands out. A
credential nothing grants is worse than a missing job, because the catalogue
shows the row and the game believes the player could have had it.

### 13.65 A test can pin a defect in place as firmly as a feature

`offers.test.ts` carried an assertion called _"never arrives for somebody with
no job, or somebody who has stopped"_. It was precise, it was well commented, it
passed for four tickets, and the first half of it was a guarantee that an
unemployed adult would never be offered work — which was the single line that
left 250 of 250 passive lives unemployable and 248 of them dead with nothing.

The assertion was not wrong about the code. It described 0402's poaching offer
exactly, and 0402 was right to refuse firing for somebody with nothing to be
poached from. What it could not say was that the door it was describing was the
only one in the building.

- **A test states that behaviour is intended. It cannot state that the behaviour
  is sufficient.** Every assertion has an unwritten scope, and the failure mode
  is a correct assertion about a mechanic that should never have been the whole
  mechanism. The better the comment, the more convincing the omission looks.
- **The tell is an absolute about a population.** "Never arrives for X" and
  "always happens to Y" are claims a single life cannot check, so they get
  written from the design rather than measured from the build — and if the
  design has a hole, the test is now the hole's strongest defender. 13.7 says a
  system nobody triggers is not a system; this is its mirror: a refusal nobody
  questions is not a rule.
- **When a ticket makes one of these go red, read it as a question rather than a
  regression.** Is this asserting something the game should still promise? Half
  of the one above was (an offer after retirement would be the game asking
  somebody to un-retire) and half was the bug. Splitting it was the work.

There is a corollary about how such an assertion stays green. The retirement
half of that same test had **never actually run**: retiring is an action the
player presses, and no harness in the suite presses it, so the state it
described never occurred in twenty played lives. It was green because it was
vacuous. A sabotage guard — fail loudly if the branch under test was never
reached — is the only thing that distinguishes "this never happens" from "this
was never looked at", and an absolute about a population needs one.

### 13.66 A curve that damps inflation also damps variation

`curvedDelta` (0203) is one of the better decisions in this build: a gain is
full strength at 50 and tapers to nothing at 100, so a childhood of forty events
stops arriving at eighteen with every bar above average. It was written to kill
inflation and it kills inflation.

It is also, unavoidably, a **regression-to-the-mean machine**, and 0408 found
what that costs when something pushes a whole population through it in one
direction. School added a flat `+1` Smarts a year to everybody for thirteen
years. Through the curve, that push is worth 1.2x to a child on forty and 0.6x
to one on seventy — so the weakest students gained the most, every year, and the
population converged. Smarts at birth ran p10 44 / median 56; Smarts at eighteen
ran p10 70 / median 76 with a **minimum of 56 across 500 lives**. Nobody was
below average as an adult, school performance had a floor of 50, and the
roadmap's "this build cannot produce a poor student" was the visible end of it.

- **A damping curve and a flat push in the same direction are one mechanism, not
  two.** Neither is wrong alone. Together they set a destination, and every
  character walks toward it at a speed proportional to how far away they are —
  which is the definition of convergence.
- **The tell is a stat whose spread SHRINKS between birth and adulthood.**
  Measure the distribution at both ends of the pipeline, not just at the
  generator. 0408 started at the birth roll because that is where the roadmap
  pointed, and the birth roll was the smaller half of the problem: widening it
  alone would have been re-flattened by eighteen.
- **Where the push represents an ABILITY, it has to scale with that ability.**
  A year of school is worth more to a child who can use it; a year of training
  is worth more to somebody with the aptitude for it. A flat push through an
  equalising curve says the opposite, and says it to the whole population at
  once.
- **Exempt what is not a visible stat.** `studyHarder` already sidesteps this
  curve on purpose — "performance is not a visible stat, and a character at the
  top of their class should still be able to hold that position by working".
  That exemption was right and is the pattern: the curve is for bars the player
  watches inflate, not for every number in the model.

The corollary is about one-sided multipliers, found in the same measurement.
`frailtyFactor` returned 1 for anybody at or above the healthy mark — "being
well is not a bonus, it is the baseline" — which can express "this body is
failing" and cannot express "this body is unusually good". A multiplier bounded
at 1 on one side is a floor pretending to be a curve, and it goes unnoticed for
exactly as long as the population has nothing on the other side of it to
measure.

### 13.67 Content cannot be written for a fact the engine cannot read

Three times now, an event has shipped that presupposed something about the
character and fired at somebody it was not true of:

- 0207: a romance event that assumed a relationship, firing about a classmate
  the character had never spoken to. `partnered` was added afterward.
- 0208: eleven parenting events reading "Your kid spiked a fever at 2am", able
  to fire at somebody who had never had a child. `hasChildren` was added
  afterward.
- And it was about to happen a third time. 0409 opened the catalog's three
  largest holes — work, a diagnosis, losing somebody — and `EventCondition` could
  express none of them.

The first two were found by reading the built app. Neither was a writing
mistake; the writing was fine. Both were the predicate language being narrower
than the fiction, and the author having no way to notice.

- **Before writing content about X, check that eligibility can say X.** If it
  cannot, that is the ticket's first task and the content is its second. An
  author who cannot gate on a fact will write as though the gate exists, because
  the sentence reads correctly on its own.
- **Adding to the context is meant to be deliberate and visible.**
  `EventContext`'s own docblock says so: "If a future event needs a fact that is
  not on this interface, adding it here is a deliberate, visible decision." The
  cost of that seam is a small ceremony per fact; the thing it buys is that the
  catalog stays reviewable. Pay it rather than route around it.
- **A gate needs a test where it lives, not where it shows.** 0409's health gate
  looked broken in a played-population audit — twenty-five characters asked
  about a diagnosis they did not have — and was not: the health phase runs after
  events in the same year and can clear a condition, so somebody legitimately
  asked in March reads as well in December. A phase-ordering artifact is
  indistinguishable from a leak at the population level. Assert the predicate
  against the predicate.

The corollary is about what a fact should be derived FROM. Bereavement was
answerable only by reading `LifeRecord` labels for the word "Lost", which
`LifeRecord`'s own docblock forbids — "structured, queryable history. Never
derived by parsing timeline text" — and which `eulogy.ts` was already doing, one
rewritten label away from promoting every funeral to a life highlight. **When
the only way to ask a question is to parse prose, the answer belongs in the
structure instead**: a category, a flag, a field. Prose is written for readers
and gets rewritten for readers.

### 13.68 A guard justified by a measurement expires when the measurement does

Every systemic door in `advanceYear` opened with the same line:

```ts
if (state.pending.length > 0) return state;
```

and 0402 wrote down exactly why it was safe:

> _"Measured, that risks nothing — an adult year contains zero authored
> decisions, because every one in the catalog stops at seventeen."_

That sentence was true when it was written and false eighteen months of tickets
later. 0409 wrote thirteen adult decisions, in a different package, and nothing
anywhere near this line changed. Measured afterwards: **59.4% of adult years
already held an authored decision by the time the doors ran**, so all three
were shut in three years out of five. A guard had become a throttle, and the
comment explaining it was the only place the change was visible — as a sentence
that had quietly stopped being true.

The shape is 13.36's from the other side. There, a field nothing writes is not
state. Here, a condition whose justification has expired is not a guard.

- **A guard whose comment cites a measurement is a guard with a shelf life.**
  The measurement is a claim about another part of the system, and nothing in
  the language will tell you when that part changes. If a comment says "measured,
  this risks nothing", the risk it dismissed is somebody else's to reintroduce.
- **Guard the thing, not a proxy for it.** What that line was for was one
  systemic question a year. `pending.length` was a proxy that happened to equal
  it, once. `hasSystemicOffer` asks the actual question and cannot be made wrong
  by a content ticket.
- **The same applies to thresholds standing in for probabilities.** 0401's
  starvation guard asked "was this job eligible for three years and never
  listed", where three years was a proxy for "the listings had a real run at
  it". 0410 caught it flagging a coin toss: Director of pharmacy was 10.3% of
  one character's six listings for nine independent years, and missing all nine
  happens 37% of the time. A year count cannot tell a hole from bad luck because
  it does not know what a year was worth. The weighting function is exported
  now, and the guard asks it.

### 13.69 When doors share a queue, order is priority — so measure the order

0410 added a third systemic door and put it first, on an argument that sounded
right: the romantic ladder carries `minYearsAtStage` clocks and a fertility
curve underneath it, so a year skipped is subtracted from the far end, while a
college offer stands at 35% every year for decades.

Measured on the same 90 seeds, going first cost **21 degrees and two extra idle
years a life** and bought **two more children and two fewer marriages**. The
argument was wrong about which delays are recoverable: a couple who miss a year
at `together` marry a year later, over a life that runs to eighty; a year not
worked is a rung not climbed, and college's recurring offer switches itself off
at the first degree.

Splitting the door so the child question alone could go first — the one deadline
in the build that genuinely cannot be waited out — was tried too, and bought
nothing (55 lives with a child against 56) while costing five degrees.

- **Ordering is a design decision with a measurable cost, not a formality.**
  Two modules that both check "is anything pending" are not independent; the
  earlier one wins every collision.
- **An argument from mechanism does not settle it.** Both orderings had a good
  story. Only one had numbers.

### 13.70 A one-way ratchet flattens a population as surely as a damping curve

13.66 recorded one half of this: `curvedDelta` is full strength at 50 and tapers
to nothing at 100, so a flat push at everybody hands its biggest gains to
whoever can use them least, and thirteen years of school turned Smarts into a
distribution with a floor of 56.

0411 found the other half, and it is quieter. Of the 91 events that can fire at
forty, the stat effects run **Smarts +14/−0, Discipline +1/−0, Charisma +26/−0,
Looks +0/−0**. Nothing an adult does costs them anything. A twelve-year-old has
234 events available offering 70 Discipline gains and 11 losses; an adult has a
ratchet.

The result is not inflation, because the curve catches that. It is **agreement**:

| Charisma, 200 lives | age 18  | age 30  | age 45      |
| ------------------- | ------- | ------- | ----------- |
| p10 / p90           | 58 / 85 | 73 / 90 | **84 / 94** |
| sd                  | 9.7     | 6.5     | **3.8**     |

Everybody climbs until the curve stops them, and the curve stops everybody in
the same place. At forty-five all seven of the commonest career tracks produced
a character with charisma between 89 and 92 — twenty years of doing a particular
job made no difference to who anybody was. Meanwhile Discipline, which nothing
wrote at all, held sd 12.0 at eighteen, thirty and forty-five: the same three
numbers, exactly.

- **A gain with no matching loss converges at the ceiling.** Check both columns.
  A system that can only add is not generous, it is a plateau with a slope in
  front of it.
- **Variation needs a reason to disagree, not just a reason to move.** 0411's
  gains come out of `TRACK_WANTS`, so two careers pull two characters in
  different directions; that is what makes the spread widen (Discipline sd 12.0
  → 14.5) instead of narrow. A single shared pressure, up or down, would have
  flattened it either way.
- **Measure spread per LIFE, not per cohort.** The first version of
  `development.test.ts` compared everybody at eighteen with the survivors at
  forty-five, and two of its four assertions then passed with the whole
  mechanism removed, because who lived moves a distribution too. Pairing each
  character against their own younger self is the only thing that isolates
  development from survivorship. 13.63, caught in the test before it shipped
  rather than two tickets later.

### 13.71 Run the whole gate after the last edit, not after the last interesting one

0410 shipped a type error to the user's machine. `pnpm typecheck` had been run
and was green; then a persistence test was added, sabotage-verified with
`vitest`, and pushed. `vitest` does not typecheck, so 954 green tests said
nothing about a `PendingDecision` literal missing its `category`, and the error
surfaced a ticket later in an unrelated run.

The failure was not a missed step, it was the ORDER of the steps: the gate ran
before the last change rather than after it.

- **The verification block goes at the end, in one pass, and nothing goes in
  after it.** typecheck, the full suite, the validator — after the final edit,
  including the edits that were "just a test".
- **Green tests are not a green build.** In this repo the test runner and the
  type checker gate different things, and the one that catches a bad literal in
  a test file is the one that does not run the tests.

### 13.72 Fix the class, not the instance — a shortcut survives under a new name

`investing.test.ts` has now been fixed for the same defect in four consecutive
tickets. 0409 fixed six tests in it that reached for `working(seed, 45)` and
hoped the character held enough money, and wrote down exactly why an age is not
a bank balance. 0410 built `richEnough`, which asks for what it needs. 0411 had
to make that ask across several lives. And 0412 found the original shortcut
still there, twice:

- as `invested()`, the same one-seed-and-hope under a different name, feeding
  nine tests;
- and as a **local `richEnough` inside one describe block, shadowing the fixed
  module-level one and doing the old thing under the fixed one's name.**

The second is the dangerous shape, because the name is the thing a reader
checks. Somebody grepping for the shortcut finds the fix.

- **When a fix has a name, sweep the file for the behaviour, not the name.**
  Three tickets each fixed the call sites that were failing that day.
- **A local declaration that shadows a shared helper is a defect on its own.**
  If the local one were correct it would be the shared one.
- **Count the outings.** 13.63's fourth appearance in one file is not four
  coincidences, it is one unfixed class of defect. The same is true of 13.17,
  which arrived for the seventh time in this ticket (see 13.73).

### 13.73 A line-rotation rule belongs to the writer, not to each writer

`guardians.test.ts` asserts that nothing in the feed writes the same line two
years running, "from any writer", and its comment lists six occurrences — drift
lines, romance moves, milestones, parent acts, conception, romance replies. 0412
found the seventh and it was not a writer, it was the **event selector**:
`random.pick(definition.text)`, a fresh draw every year, for all 444 events.

It was correct for five tickets because no event could fire two years running.
0409 wrote the first four that can (`cooldown: 1`), with two, three, three and
four phrasings — so an unemployed character had a one-in-three chance every year
of reading the same sentence about the same applications twice.

- **A rotation rule needs one implementation, at the point every line goes
  through.** Six writers each solving it privately is how the seventh place gets
  missed.
- **`cooldown: 1` is a claim about the copy as well as the pacing.** An event
  that can recur annually needs enough phrasings to recur annually.
- **The fix is always the same, and it is worth stating once: the base holds
  still for the life and the age does all the moving.** A re-drawn base cancels
  an age rotation exactly as often as it helps. In 0412 this also meant
  separating rotation from WEAR in `resolveInteraction` — one parameter was
  doing both jobs, which is fine until a second caller needs one without the
  other.

### 13.74 A gate and the token it guarantees must name the same person

0412 gave eligibility `hasFriend` and `friendshipYearsAtLeast`, so an event could
finally require a friend. 0413 wrote thirty of them — and `{kid}` still bound
whichever peer the draw landed on. For a working adult the circle is mostly
colleagues, so _"you and {kid} have been friends since school"_ would have named
somebody met eleven months ago.

This is 0207's `partnered` bug one level down, and it is the shape to watch every
time a predicate is added: **a gate makes a promise about the world and a token
makes a promise about a person, and nothing in the language ties them together.**

- **When you add a predicate, ask what the copy written against it will NAME.**
  If the answer is a token, the binder has to honour the same definition — from
  the same function, not a second one that agrees today.
- **Prefer narrowing the existing token to adding a new one.** `{kid}` binding
  friends-first fixed this in five lines. A `{friend}` token would have meant
  four token tables, three pronoun forms and the four-places problem the roadmap
  has had open since 0209.
- And the narrowing was better content everywhere else too: every event that
  names somebody now names the person the character actually knows.

### 13.75 Content that grants a number reopens the curve the mechanism just closed

0412 put a curve on warmth because 90.9% of forty-five-year-olds had a closest
friend at exactly 100. 0413 wrote thirty-nine events about friends, every one
carrying a happiness effect — and `bondFromOutcome` derives warmth from happiness
at 0.7 when nothing authors it, so the catalog was the second door into the same
failure. Measured: closest-friend spread at fifty-five fell 15 → 7, and adults
with no friends at all fell under 1%, which quietly made `hasFriend: false`
content unreachable.

The mechanism ticket and the content ticket were each locally right.

- **A mechanism fix is not finished until the content that rides on it is
  measured too.** 0412's own acceptance tests caught this, which is the system
  working — but only because they assert SPREAD rather than a median.
- **`effects.bond` had existed since 0206 and nothing could author it.** The
  engine had the field, the generator had no parameter, so every event in the
  catalog silently took the derived value. A field only one side can write is a
  field that is not really there (13.36's cousin).
- **Most events about a relationship should not move it.** The number that says
  how close two people are belongs to the things they do, not to the weather of
  the year. Thirty-one of the thirty-nine now author `bond=0`.

### 13.76 An assertion that cannot observe its claim gets replaced, not widened

0413's first gate test checked, for every gated event that fired, that the
character had a friend that year. It flagged `friend.their-kids` at seventy-three
— and the context it was selected against said **two**, both of whom drifted
under the line later in the same year. Widened to "either end of the year", it
flagged `d.friend.needs-a-room` at twenty-two, where the warmth crossed 50 inside
the year in the other direction.

The engine reads its context in the MIDDLE of a year. A test standing outside
`advanceYear` can only ever see the two ends, and no amount of widening makes it
able to see the thing — it only makes it stop failing, which is worse than
failing.

- **Two widenings in a row is the signal.** The first looks like tuning; the
  second means the instrument cannot reach.
- **Split the claim to where each half is observable.** The predicate logic went
  to a unit test against `matchesCondition`; the plumbing went to an assertion
  that the count reaching the context equals the circle's real one, on states
  from played lives; reachability stayed a population test. Three sharp
  assertions replaced one blurred one, and each fails under its own sabotage.

### 13.77 A category can be empty for a whole population and still look healthy

The `family` category has ninety-one events and it was the second-biggest in the
catalog. Eighty of them carry an `ageMax` below eighteen; the other eleven are
0208's parenting events gated on `hasChildren`. There is no third group — so for
a **childless adult**, which is 56.3% of every adult year in this build, the
reachable family catalog was exactly zero. Not thin. Zero, across 4,367 years.

Every previous measurement missed it, and each for a defensible reason: 0409
counted events at forty (where parents-of-children carry the number), 0410 fixed
`family` by building the door to having children, and 0413 measured the cliff at
eighteen by category _total_ rather than by what one kind of character can see.

- **Measure a category against the POPULATION it is supposed to serve, not the
  catalog.** "Family has ninety-one events" and "a childless adult has none" are
  both true, and only one of them is about the game.
- **A gate that splits a population splits the content with it.** `hasChildren`
  divides adults roughly in half; every event behind it is invisible to the
  other half, permanently, and a category total hides that perfectly.
- **The give-away is a curve that only ever rises with one variable.** Family
  events ran 0% at eighteen, 1.9% at thirty and 12.4% at forty — and every point
  of that rise was people having children, not people having families.

### 13.78 Four copies of a table is three too many, and the drift is silent

Roadmap finding 7 has been open since 0209: _"the token-guard table lives in four
places — the generator (Python), the content test, the validator and the
renderer."_ 0414 found out what that costs. The generator has known
`{motherName}` and `{fatherName}` since 0203b; the TypeScript test's copy never
had them.

**Eleven tickets of silent disagreement**, and nothing could catch it, because a
table is only exercised by the copy that uses it — and no event had used one of
those two tokens since they were added. One line in this ticket did, and the
generator passed it and the test rejected it.

- **A duplicated table does not fail when it drifts. It fails when somebody
  finally uses the drifted entry**, which can be years.
- **Count the copies when you add an entry.** The fix here was one line in one
  file; the finding is that nothing told anybody for eleven tickets.
- The Python/TypeScript split is arguably deliberate — two independent
  implementations of one rule is a real technique. Four is not that; it is three
  chances to disagree.

### 13.79 If every branch pays it, it is a fee for being asked

0415 went looking for what raising a child and being ill do to a person and
found Willpower — the stat `resilience` reads to decide how hard a year lands —
collapsing in adulthood: **sd 11.4 at eighteen, 2.8 at sixty**, p10 at sixty 88,
and not one life in a hundred and fifty lower at forty-five than at eighteen. 0411
fixed exactly this shape for Charisma and did not list Willpower.

The cause was in how three content tickets authored it. The adult catalog held
**seventy-one willpower effects and not one loss**, and the tell is where they
sat: on BOTH outcomes of a hard choice. _"You set a date and had to enforce it,
which neither of you has completely got over"_ paid +3. _"You told nobody and got
on with it. It worked, right up until the day it didn't"_ paid +4. When the hard
thing works and when it fails pay the same stat, the stat is not measuring what
happened — it is a fee for having been asked, and a fee collected every year is a
ratchet (13.70).

- **Check an effect across the branches of the choice that carries it.** If the
  outcome where it went wrong pays the same number as the outcome where it went
  right, that number belongs to the question, not the answer — and it probably
  does not belong at all.
- **An event about warmth does not pay endurance.** A friend saying yes before
  you finished asking is a good year, not a stronger person. Same rule as 13.75's
  `bond`: a number moves when the event is ABOUT that number.
- **Content cannot supply the losing side on its own.** The catalog audit alone
  still left willpower contracting 45% by sixty, and a second struggling year
  paying the same as a calm one (0.26 against 0.28 a year). The system has to be
  able to take it away — here, the year that does not end.

### 13.80 A maximum moves when the sample grows

0416 gave characters somewhere to meet people, and two assertions went red
without anything they guard having changed:

- `friendship.test.ts` took p90 − p10 of each life's **closest** friend at
  fifty-five and read 8 against a line of 8. Every friendship at that age was
  actually _wider_ than before (p10/p90 61/96 against 71/96, with fewer at the
  ceiling). But the median adult now had four friends instead of three, and the
  warmest of four is warmer than the warmest of three even when all of them come
  from the same distribution.
- `adult-social.test.ts` took the mean of each life's **earliest** person at
  twenty-six and wanted it past twelve. More childhood friends meant more
  childhood friends to keep, and the minimum of a bigger set is lower.

0412 hit this exact shape once, with `min(metAtAge)`, and replaced it with a
share. This ticket hit it twice more.

- **A per-life maximum or minimum measures the sample size as well as the
  thing.** Any ticket that changes how many of something a life holds moves it,
  whatever happened to each one.
- **Measure a typical member, a share, or a fixed rank**, not the extreme.
  Here: each life's MEDIAN friendship (74/96, against 97/100 with 0412's raw
  warmth restored), and "the circle at twenty-six is mostly met since school"
  as a share.
- **And check the replacement against the old bug before trusting it.** The
  first replacement here — every friendship pooled — stayed green with raw
  warmth restored, because a pool always contains somebody met last year. It
  could not see what it was for (13.76), and was replaced again before shipping.

### 13.81 A band tighter than its own noise is a coin flip

`floor.test.ts` guards CORE_RULES 13.53 — being illiquid must not buy a cheaper
life — with a 3% band on the median living cost of eighty lives. 0416 turned it
red at −4.8% without touching money. So both sides of the line were measured:

- **The noise.** Two disjoint samples of the SAME build — the first 80 seeds and
  the next 120 — read −4.8% and +2.2%. With the new door switched off, +3.4% and
  −4.6%. Seven or eight points of swing from nothing except which lives were
  drawn. At 200 lives the two builds read −1.9% and −1.5%: nothing had moved.
- **The signal.** Restoring 13.53 itself reads −35%, at every sample size.

The 3% line had been sitting inside the noise the whole time. It was a coin flip
that happened to land heads for five tickets, and 0403's "1.6% wobble" note was
the first time it nearly didn't.

- **Before setting a band, split the sample and measure the same build twice.**
  The gap between the halves is your noise floor. A line inside it will go red
  for tickets that changed nothing and — worse — train people to widen it.
- **Then sabotage the thing it guards, to measure the signal.** Put the line
  between them, and write both numbers next to it, so the next person to see it
  red can tell which one moved.
- **This is not the widening 13.76 warns about.** That rule is about an
  assertion that cannot see its claim. This one could always see its claim —
  the signal is 35% — and was also seeing noise.

### 13.82 A multiplier that reads the curve's own variable counts it twice

0211's mortality was written as three readable factors — age, how well you are,
what is wrong with you — and the second one quietly contained the first. The
Gompertz term is age. `frailtyFactor` read raw health, and raw health falls
with age for every body in the game. So an ordinary eighty-year-old was charged
for being eighty once in the curve and again through a frailty multiplier their
age had pushed up.

It showed as two things that looked unrelated. Old people died five to six times
faster than a real life table (125, 191 and 313 per thousand a year at seventy,
seventy-five and eighty, against about 20, 31 and 51), and constitution stopped
mattering in old age: by seventy-five every quintile's frailty multiplier was
pinned high, so a strong body and a frail one were charged alike.

- **When a factor multiplies a curve, check it is not a function of the curve's
  own variable.** If it is, subtract what the variable alone would have done
  (`healthForAge`: health for its age) before applying it.
- **The test is an ordinary member at two points on the curve.** An ordinary
  forty-year-old and an ordinary eighty-year-old should differ by the curve's
  ratio and nothing else. `health.test.ts` asserts exactly that now.
- **Readable factors are still right** — this one was found because the model
  was three multipliers instead of one fitted polynomial. The rule is about what
  each factor is allowed to read, not about how many there are.

### 13.83 A flat counterweight to a rising load is a ratchet that has not started yet

0211 gave health a flat 3.4 points of healing a year, and its docblock said
exactly what that was for: _"what makes an acute illness a dip rather than a
debt... without this the model would be a ratchet, and a ratchet reaches
zero."_ True at thirty. But illness gets likelier every year from thirty-five
and the healing does not, so the two lines cross somewhere in the sixties. From
there the deficit only grows: median 4 at forty, 15 at sixty, 25 at seventy, 33
at eighty. The ratchet the comment ruled out was there all along, starting at
the age nobody measured.

- **A constant balancing a quantity that grows will lose to it eventually.**
  Find the crossover before trusting the balance. Here it was one line of
  arithmetic: expected illness cost a year against recovery a year, by age.
- **Proportional beats flat when the thing is a debt.** Healing a share of what
  is owed gives the deficit a level it settles at under any steady load, so
  there is no crossover to find.
- **Measure at the ages the claim is about.** 0211 tuned against a population
  that mostly died before the crossover had done its damage — so the numbers
  looked fine because the people the defect hit were already dead of it.

### 13.84 A hash is not a random number when the keys differ only at the end

0501 drew each year's housing market from ``stableUnit(`housing:${year}`)``.
FNV-1a mixes the last character in once, so keys that differ only in their final
digit land close together and the high bits — the ones dividing by 2^32 reads —
barely move. The values for 2060–2080 all sat near 0.95. The market rose 6–7% a
year for twenty straight years, and a flat bought for $290,000 was worth $1.98
million at eighty-four.

- **A sequence keyed on a counter needs a finaliser.** `mixedUnit` runs the hash
  through murmur3's fmix32, which avalanches every input bit into every output
  bit. Sequential keys come out independent.
- **Do not fix the old helper in place.** Every save already holds values keyed
  on `stableUnit`; changing it would silently rewrite every NPC's constitution
  and every employer name. Add the new one beside it and audit the callers
  (roadmap finding 8).
- **Test the series, not the value.** One draw from a correlated hash looks
  fine. Two hundred in a row, with their lag-one correlation, do not.

### 13.85 A nominal rate in a constant-dollar world compounds into fiction

The first home market appreciated at 4% a year — a real-world nominal figure —
in an economy with no inflation, where every price and wage is in constant
dollars. Owners' median equity at sixty-five was $978,000 on houses bought for
about $200,000. Real US house prices have grown about 1% a year over the long
run, so the drift is now 1.2%.

- **Every rate borrowed from the world has to be converted to the game's
  dollars.** Interest, returns, appreciation, raises: if the world figure
  includes inflation and the game does not, subtract it.
- **Compounding hides the error until late.** Three points a year is invisible
  in any single year and a factor of three over forty. Measure the end of a
  life, not the first decade of it.

### 13.86 A new fixed cost needs the budget it lands on to make room

0501's first owners paid the mortgage on top of a standard of living that still
spent like a renter's. It worked while they worked. At retirement income fell,
the mortgage didn't, and **104 of 176 buyers were foreclosed on** at a median age
in the sixties. Real households don't do that: they spend less on everything
else, and a household that falls behind with equity in the house sells it rather
than waiting for the bank.

- **When a system adds a cost, the spending it competes with has to respond.**
  Owners now spend less on the rest of their life when the house costs more
  than rent did, down to the subsistence floor.
- **Model what people do before the worst case.** Foreclosure is what happens
  to a house worth less than is owed on it. A house with equity gets sold under
  pressure, and the owner keeps what's left.
- **Measure the people the new cost reaches, across their whole life.** The
  buyers looked fine at thirty-five. The failure was at sixty-five.

### 13.87 An income that becomes a household's makes the spending a household's

The standard of living follows income, and the year's bill is that standard
multiplied by the size of the household. While only the player earned, that
was right: one income stretched over two people. 0502 gave the partner a pay
packet and fed the household's income into the same formula, and the
household got counted twice: once in the income that set the standard, and
again in the multiplier. Couples on $87,000 ran up bills of $95,000, fell into
the hardship cliff, reset to subsistence, and climbed back to do it again.

- **When a quantity changes from one person's to a group's, check every formula
  that already scales by the group.** Anything multiplied by household size has
  to be computed per member, or the size is counted twice.
- **The fix is the ordinary equivalence scale.** Divide the household's income
  by its size to set the standard, multiply the standard by its size to bill
  it. A single person is untouched, which is how to tell the change is right
  rather than a re-tune.
- **Flapping is a symptom worth naming.** A household that goes short, resets
  and recovers on a cycle is a formula that disagrees with itself, not bad
  luck.

### 13.88 Two wrong constants can add up to a right answer

0501 set `OWNER_SHARE` at 0.45, which said the roof was more than half of
everything a renting household spends. The population still came out near US
net-worth figures, because couples were overspending (13.87) by about what
owners were being under-charged. Fixing the overspend took the median
sixty-five-to-seventy-four-year-old to $722,000 against a US figure of about
$410,000. Shelter is nearer a quarter to a third of household spending; at
0.7 the same measurement reads $340,000–$415,000.

- **Check each constant against its own reference, not just the total.** An
  aggregate that matches the world can be two errors cancelling. The roof's
  share of spending has a real-world number of its own; 0.45 was never close
  to it.
- **Expect a fix to expose its partner.** When correcting one mechanism moves a
  whole-population number a long way, look for the constant that was quietly
  compensating for it before re-tuning anything else.
- **Write down what a tuned constant was tuned against.** `MARGINAL_SPEND`'s
  docblock already says this (0304): a constant tuned against a bug has to be
  tuned again when the bug goes.

### 13.89 A setting the player can turn needs a cost on both sides

0503 gave the player six rent settings. Sketched with the first numbers that
came to mind (applicants falling, tenants leaving a little faster above the
going rate), 10% and 20% over the going rate both earned MORE than the going
rate: the gap between tenants was too short to cost what the extra rent
brought in. A setting with a free best answer is not a decision. Every player
who found it would set it once and never think about it again, and the ones
who didn't would just be paid less.

- **Work out the payoff of every setting before building the screen.** A
  table that turns knobs into money can be checked in a spreadsheet; do it.
- **Each step must give something up.** Under the going rate: fuller, less
  money. Over it: emptier, more turnover, no more money. At the top, nothing.
  Measured, the going rate now earns the most per unit-year, with one step
  either side a few percent behind.
- **Keep the measurement as a test.** `rentals.test.ts` asserts the whole
  table, so a retune that hands one setting a free win fails.

### 13.90 When a cost moves out of a shared bill, whatever measured against the bill must measure the whole again

0504 took buying and keeping a car out of the living bill and charged it on
the car. The home door measures a mortgage against "the roof", which it reads
as a share of the living bill. Once people owned cars the bill was 8.5%
smaller and the squeeze made it smaller still, so every house looked further
out of reach, and home ownership at 35–54 fell eight points the first time it
was measured. Nothing about houses had changed.

- **Search for every reader of a number before splitting it.** `living.cost`
  had one producer and three readers; only one of them wanted the new meaning.
- **Give the old meaning its own name.** The living phase now reports
  `withoutCar` beside `cost`, and the home door reads that.

### 13.91 A test that checks a direction passes when anything moves it that way

0504's end-to-end test asserted a year with a car costs less to live than the
same year without one. Sabotaged so the living phase never knew about the car,
it still passed: the car's own running costs squeezed the bill down by a few
hundred dollars through a different branch. The direction was right for the
wrong reason.

- **Assert the size the mechanism promises.** The test now asserts the bill
  falls by at least the car's share, which only the mechanism under test can do.
  P2 explicitly superseded that percentage contract: literal actual-cost and
  $1,600-cap tests now pin the dollar replacement at multiple income/tier levels.
- **Sabotage is what finds these.** Three of seventeen sabotages passed the
  first time (this one, a loan that never amortised but still cleared on its
  last year, and repossession after one short year inside a loose band). All
  three tests were tightened until each sabotage failed.

### 13.92 A bound written in terms of the constant it guards moves with it

0506's test that legends stay rare asserted no more than `MYTHICAL_CHANCE × 4`
of the antiques dealer's slots ever held one. Sabotaged from one in 5,000 to
one in 20, it still passed: the bound had grown 250-fold along with the thing
it was there to stop.

- **State the claim as a number.** "About one legend in 2,800 slots, never a
  handful" is the claim; the test now says that, and separately that the
  constant is under one in a thousand.
- **A guard that reads the value it guards guards nothing.** The same shape as
  13.51's pinned list, the other way round: that one never notices a change,
  and this one agrees with every change.

### 13.93 Compare a dial with the system around it settled

0601's first test of "no payroll level dominates" held headcount fixed and
found High pay earning 2.2 times Medium at a software studio. The business is
supposed to hire to its demand; with the manager's headcount, the gap closed.
A test that freezes one part of a system the player cannot freeze measures
something the player never meets.

- **Let the other dials settle** (here: iterate the manager to a fixed point)
  before comparing, and compare an average over types, not a single one: whole
  heads are lumpy, and a four-person firm swings by a quarter of its staff.

### 13.94 A harness that mutates must refuse to run if it cannot restore

The sabotage helper copied each file to a backup path before mutating it. The
path had turned into a plain file, every copy failed silently, and eighteen
mutations were left in the source — each one visible only as a test count that
got worse run by run. Restoring them by hand took a snapshot and a diff.

- **Check the backup before the change.** `cp ... || return`, and a tarball of
  the tree before a batch.
- **A failure count that grows between runs is the tell.** Each sabotage should
  fail the same tests it failed alone.

### 13.95 A constant a formula decides should be the formula

0601 typed a price sensitivity for each business and checked it against a
fixed headcount. The manager hires and fires to the price, so the number that
mattered was never the one that had been checked: for half the catalog the
best price was 125–135% of the going rate, worth 60–150% more pay. Nobody
tuned it wrong; nobody could have seen it from where they were looking.

- **Derive it.** For a firm that can staff to demand the best price is
  `p* = e/(e−1) · mc`; the sensitivity is now computed from cogs, wages and
  headroom in the generator, and a test recomputes it from the catalog.
- **Check a lever with every other lever free to move**, then ask how many
  points of revenue the best setting is worth over the default.
- **13.92 recurred.** Three of eighteen sabotages passed first time, two
  because the test read the constant it guarded (the overhead share, the branch
  opening maturity). Numbers are stated as numbers.

### 13.96 If money must not be spendable on anything else, never let it be money

0307 chose not to earmark a loan: a rule that follows cash around is a chore
(spec 1126–1136). A business loan is where that choice stops holding, and the
fix is not a rule that follows the cash, it is a loan that never becomes cash.
It is offered at the moment of a purchase and written straight into it: booked
as borrowed and spent in the same breath, so the balance never rises. There is
nothing to earmark because there is nothing to spend.

- **A door that must stay shut is shut in the engine.** `applyForLoan` refuses
  a business product outright (`forABusiness`); the Loans screen not offering
  it is a courtesy, not the control.
- **The lender sees what repays it.** Half of wages, plus what the businesses
  clear, plus what the thing being bought clears, less every payment already
  committed. Not `incomeOf`, which counts a sale's proceeds as earnings
  (finding 35).

### 13.97 Measure the whole life of a new instrument, not the approval

The first version of a business loan passed every test and failed the first
population run: serviced out of the owner's wages while the business sat on
its own cash, a typical financed purchase put the owner into arrears for
eleven to twenty-four of the next twenty years and the balance grew to the
two-times ceiling. Nothing about the approval maths was wrong.

- **Take it, service it, get out of it, and do that in a population** before
  calling an instrument built. Arrears-years and net worth against a control
  that never bought are the numbers that show a payer in the wrong pocket.
- **Ask who owns the money.** The business holds the till, so the business
  pays; the owner steps in for a shortfall because they signed for it.

### 13.98 A share of a round number is not a round number

`0.7 × 45,000` is `31499.999999999996`. Floored to the hundred it is a loan
$100 under the stated share, on exactly the prices a player reads off the
screen. The test was a literal number on a round price, which is the only kind
that finds it.

- **Round to the cent before flooring.** And test shares on round prices, not
  on the generated ones that happen to miss.

### 13.99 A rule that excludes nothing is not a rule

"A key person left" needed wages to be 15% of revenue. All thirty-one types
cleared that, so the rule was dead code in a table that looked like it had a
rule in it, and a mutation that deleted it survived. It was found because the
sabotage list included each condition separately.

- **Check a condition against the catalog it filters**: how many of the
  thirty-one does it let through, and is that a number you'd defend? A test
  that asserts the line falls through the population, not just that the code
  ran, is the only thing that keeps a threshold from drifting back to "all".
- **Sabotage each branch of a gate by itself**, not the function as a whole.

### 13.100 Record the gap you couldn't close, and say why

0601 promised that 0604 would close survival to the BLS table. Measured, the
levers the spec allows moved it three points. What would move it further is
unavoidable disaster, which the spec says not to have. The honest result is the
number, the levers tried, and the reason, in the doc and the roadmap, not a
retuned constant that hits 51% by making the game punishing.

- **A target quoted from a table is a question, not an order.** Ask whether the
  table measures what the game models (BLS counts owners who simply stop).
- **Say what was tried and taken out.** Shrinking the base volatility changed
  nothing that mattered and broke a price test; it went back out.

### 13.101 When a thing is handed on, hand on everything that belongs to it

An heir keeps a business only if its till, crew, name, doors, rival and lender
go with it. Handing on the business and dropping the lender would have been the
0603 bug in reverse (an inheritance with the debt wiped). The rule that carried
over is the one 0603 set: whatever is owed on a thing travels with the thing,
and a debt whose thing is gone is personal and dropped as before.

- **Whatever the new owner doesn't choose should still change**: the town's
  doubts about a new owner (four points) and what the thing is carried at
  (its worth, not what the parent put in).
- **A default that changes behavior breaks old tests honestly.** Two death
  tests that assumed a sale now ask for the sale; they were not loosened.

### 13.102 A guard the catalog makes unreachable is not a guard: assert the catalog fact

0605's offers had `if (maxTicket < kind.minTicket) continue;` and the
placement had a one-year-deal check on the warning. The sabotage run removed
each and nothing failed, because no catalog entry could reach either
(a cap is at least 1.5 cheques; a warning needs two years). Same family as
13.99. The fix is not a test that tries to reach the branch, which can't be
written; it is to remove the branch and assert the catalog fact that made it
unreachable, so an edit that breaks the fact fails in the catalog test, in the
place it was done.

- **Two survivors out of fifty were both of this kind.** Count them before
  reaching for a new test.

### 13.103 A test whose loop may be empty proves nothing: assert the loop ran

"A taken offer is never offered again" iterated over the offers of one
seed. That seed had none, so the test passed with the rule deleted. Loop over
many seeds and assert how many cases were actually checked, or the green is
vacuous.

### 13.104 Don't let a warning be a free exit

A deal that shows the player a signal before it fails (0605's "word gets out")
must price a sale after the signal at what the deal will return. Otherwise the
signal is a guaranteed escape and the risk it advertises isn't one. The same
price is used when an estate sells at a death. A test asserts the sale after the
warning never beats holding.

### 13.105 A value threaded through three layers needs a test at the outermost one

0606 passed the economy from `advanceYear` to `runHomesYear` to the lease
rules to the first-year share. Every pure function had a test for it. The
sabotage run still found three places where the argument was dropped (the
screen's applicants, the mass search, `advanceYear` itself) because nothing
exercised the seam. Test through the outermost caller: many lives, group by
the state the economy landed on, and assert the groups differ.

- **Threshold:** the bigger the gap, the stronger the assertion, or the noise
  hides it. A recession's effect through failures alone was too small to see in
  500 lives; the first year of a lease was not.

### 13.106 A filter on a flag is two filters

`mortgageFor` kept products by `(product.investment ?? false) !== (purpose ===
'rental')`. Adding a third purpose meant a commercial product also had to be
kept off houses and a house product off warehouses; one direction of the new
rule was missing for a ticket and no test noticed. When a product has a purpose,
test both directions: each purpose gets only its own product, and its own
product is offered to no other purpose.

### 13.107 Set a yield from what the model realizes, not from the table

0606's kinds list a vacancy. The model realized 3-4 points less occupancy than
the list (failures pay half a year, a re-let takes the agent a year). Yields
set from the table landed a full point under the market's cap rates. Measure
the realized occupancy through the same function a life calls, then set the
yield, and make the test assert the realized net yield, not the table.

### 13.108 Assert the total a convention adds up to, not just the year it is paid

0605's lender interest was asserted year by year (9% in year two, 9% in year
three) and never summed, so the missing payment in the year a loan ends was
invisible: every test passed with a one-year loan paying nothing. The second
agent's pass found it as a mutation that "survived" because the original
behavior was never pinned. For anything paid over a term, add a test that
sums the whole term and compares it with rate × years, including the shortest
term in the catalog.

### 13.109 An independent audit is for correctness, not for every ticket

A second agent re-ran every test against its own mutations and found one real
engine bug and about forty missing assertions. That is worth a pass per
subsystem. It is not worth a relay per ticket: the fixes were quick, the
hand-offs were slow. Audit in batches, after the screens exist.

### 13.110 Pin a fitted distribution to the published shares, not to its own inputs

0701's audiences are drawn from a curve fitted to four published shares of video
channels (41%, 8%, 1.3%, 0.13% past a thousand, ten thousand, a hundred thousand
and a million). Testing the curve at its anchors only proves the arithmetic. The
test that matters runs twenty thousand channels through six years with the real
growth rule and asserts the shares that come out, with bounds a little wider than
the source. Calibrate through the function a life calls (13.107), then assert
what it realizes.

### 13.111 If a rule only differs at a boundary, put it in a function you can call at the boundary

The milestone, monetization and slump notes were first written inline in the
year function. Sabotage changed `<` to `<=` in all of them and nothing failed,
because no whole-year test lands an audience exactly on a mark. Extracting
`noteFor(previous, audience, paysAt)` made every boundary a one-line assertion.
When a mutation on an edge survives, extract the edge before writing a cleverer
integration test.

### 13.112 A clamp whose bound cannot be reached is dead code

Sabotage found two: a lower clamp on quality that skill's own clamp already
made unreachable, and an outer max on a fall that a step never exceeds. A
mutation of the bound survived because there was nothing to catch. Prove the
bound is reachable or delete it, and write the argument in a comment where the
clamp used to be.

### 13.113 A new income is a list of readers

13.90 said that when a new income reaches the household, every reader of income
must be told. 0701 had eight: the summary's tax rate, the car dealer's earned
income, the loan officer's earned income, the tax stacking order, the deals' tax
base, the household's standard of living, the lender's `incomeOf`, and the
timeline. Write the list in the ticket doc, then one test per reader. The
survivors were exactly the readers without one.

### 13.114 "The numbers feed it" is a claim; a test through the whole year is the proof

0702 measured that a channel's hours raised the hidden workload and wrote it in
the plan. Sabotage then deleted the hours from the stress phase, and again from
the call in the year, and every test still passed. Nothing had run a year with
channels and read the stress that came out. Whenever a new input is wired into
an existing phase, the test is two lives that differ only in that input, run
through `advanceYear`, asserting the output moves in the right direction and by
how much more for more.

### 13.115 When a choice never wins, it is not a choice

Sponsorship pay was first a single video's worth, smaller than the trust cost on
a fast-growing channel, so Accept lost money and no one would take it. The deal
became a campaign of three. Then Request More turned out to average 58.5% of an
offer, so it never wins either (roadmap finding 52). Before shipping a decision,
compute what each answer is worth to a player who knows the table. If one
dominates, say so in the ticket, and fix it or have the owner decide.

### 13.116 Two draws that share a key are one draw

A brand and a rate that both read the same hash would always pair the same
brand with the same pay. Sabotage swapped the key and nothing noticed. Pin a
draw by recomputing it in the test from its own key, so a key change fails.

### 13.117 A rule written twice is one rule with a hole

The payment threshold was a comparison in `channelIncome` and a second one,
copied, in the subscription branch of the year. Sabotage changed the second `<`
and nothing failed, because the boundary was tested only through the first. When
the same condition guards two paths, extract it (`paysFrom`) and test the edge
once, on the function both call.

### 13.118 Prove a choice has an interior best by finding two contexts with different answers

A price for a newsletter is only a choice if the best price is not the same
everywhere. 0703 pins the best tier for three categories (business premium, music
cheap, the usual standard) and asserts the argmax differs. A formula that looks
like a trade-off can have a corner solution that always wins; a table of what each
option earns in different places is the test.

### 13.119 A year that did not advance looks like a system at rest

A test advanced two years and found the second year's numbers identical to the
first, which looked like a model that had settled. The second advance had done
nothing: a decision was waiting, and `advanceYear` returns the same state while
one is. Any multi-year test must answer pending decisions between years and
assert that the year moved before it asserts anything about what changed.

### 13.120 A test that checks a constant against itself pins nothing

Thirteen of 0704's first-pass survivors were numbers asserted against the constant
that set them: `expect(offers.length).toBeLessThanOrEqual(MAX_COLLAB_OFFERS)`
cannot fail when someone changes `MAX_COLLAB_OFFERS`. A number that is a design
decision is pinned by writing it out in the test (`toBe(2)`), and a range is pinned
by showing both ends are reached, not only that nothing leaves it. A clamp no
input reaches (a floor of 50 on a partner whose offer needs 113) is dead code:
remove it rather than test it.

### 13.121 A new field on the state must survive `fromSave(toSave(x))`

`representation` was written to the save, read back from it and validated, and the
reload still lost it, because `createGameState` builds the state field by field
and had never heard of it. Only a round trip through the loader finds that. Every
new optional field on `GameState` gets a test that sets it, saves, loads and reads
it back, and a test that an absent one stays absent.

### 13.122 Prove an effect on its own path, not through a total

A manager gives back a third of the week, and the test said a heavy life was less
stressful with one. It still passed with the hours cut disconnected, because a
manager also grows the channels, and more money lowers stress too. When an effect
has a rival explanation, extract the quantity it changes (`creatorWeek`) and test
that directly, then test only that the total moves the right way.

### 13.123 To test a roll, vary the roll's own key, not the state it reads

A test that needs a draw to land, or not to, loops until one does. Looping over years looks
the same and is wrong: a year changes who is famous and how famous, so the thing under
test changes with it. 0705 sweeps `world.generation`, which is in the key of every
meeting and every connection roll and nothing else, and asserts the rate against the odds
(`rate` within a few points of `connectionOdds`) rather than that one draw came up.

### 13.124 Whatever ends a person ends them everywhere they are listed

A celebrity friend who died was ended in the circle (`endedAtAge`, `endedBecause`) and
still `alive: true`, because the one place that does it for relatives, `phases/kin.ts`,
also sets `alive: false` and the new code copied only the call it could see. When a new
path can end a person, read how the existing paths do it and copy all of it, then test the
field that was missed, not the one that was copied.

### 13.125 A fixture borrowed from another record carries that record's state

A death test built its friend from `circle.people[0]` and got back `endedAtAge: 14`,
because that person had already ended at 14 and `endPerson` leaves an ended person alone.
The failure looked like a bug in the engine. Build a fixture from a clean base and set
every field the test reads.

### 13.126 A loop that asserts only when something happened passes when nothing did

`for (trial of trials) { const r = answer(trial); if (r.ok) expect(...) }` passes with zero
results. Several of 0705's first tests survived sabotage this way. Count the cases that
reached the assertion and assert the count is large enough to mean something, and that
both branches (landed and missed, connected and not) were reached.

### 13.127 A line that fills in numbers needs a test that matches each token to what supplies it

A gear-failure line said "Replacing it cost $0" because it used `{amount}` (the income an event
moves) for a cost. No one reads 23 events' worth of lines for this. A content test now takes
every token in every line and checks that the event has the thing that fills it (a cost token
needs a cost, a gain token an audience change), and the simulation test refuses `$0` and
stray braces in what is printed.

### 13.128 When a change lifts what new things start with, say how the old measure still gets its old thing

0706 lifts a new channel's luck so a player's channel is not an average abandoned one. Three of
0701's tests measured the sourced population by opening channels, and moved with the lift. The
fix was an explicit unlifted path (`luckDraw`, the raw draw) for the tests that mean "every
channel there is", not loosening the bounds. A calibration change should leave a way to
reach the thing it calibrated away from.

### 13.129 A boundary test needs a fixture that can reach the boundary

"An event can lift a channel past its best-ever mark" passed with zero cases because the
fixture was above its curve and shrank every year; the peak was never close. Print the
values the assertion reads, and count the cases that reached it (13.126). Here the fix was a
small channel that grows.

### 13.130 When you add a field to saved state, find every place that rebuilds the record by hand

0705 wrote the record of famous people out field by field when a stranger was answered
(`{ ties, met, answeredYear }`). Adding `work` for 0707 compiled everywhere else, and it was
TypeScript's required-field check that found the one place that would have thrown it away the
first time somebody famous was met. Make the new field required, let the compiler list every
literal, and replace any that rebuilds a record with a spread of the old one. Then test that a
neighbouring action keeps the field.

### 13.131 A sabotage harness that matches the first occurrence after a heading mutates what that heading names

`('W06', file, 'Ticket 0707', "category: 'creator'", ...)` mutated the first `category: 'creator'`
after the first mention of "Ticket 0707", which was in the comment on an input field, not in the new
code. It reported a survivor that was really a different line. Scope each breakage to the unique
thing it is about (here `for (const job of input.work`), and when Prettier reformats a line, a
breakage that stops matching must be re-pointed, not dropped.

### 13.132 A table of words keyed by an engine `kind` collides when two unions share one

`tooYoung` is a channel's refusal (it carries the age you need) and a flirt's (it carries nothing, and
can mean either person). One sentence for both said "You have to be 14 to start one here" on a
twelve-year-old's flirt button. When a screen turns refusals into words, render every union that feeds
the table through the screen that shows it, with a state that triggers it, not just the table.

### 13.133 Copy and defaults are behaviour: break them and see

A sabotage run over the 0708 screens found 24 gaps in a suite that passed first time, nearly all of them
a sentence, a default or a boundary nothing pinned: the collaboration text for a friend, a charge and a
swap (three different states needed, not one), "Nobody has asked this year" when only a group has,
rounding of a fractional dollar, age 15 against 16. A line a player reads is pinned by a test that
names the line, and a fixture for a branch is checked to reach it (13.126).

### 13.134 A repeated missed payment can lose its warning without losing its debt

P1 found that `runLoanYear.missed` reports entry into arrears, not every unpaid year.
A rescue gate based on that list ignores a lender already in arrears. Compare the payment
actually made with the fully funded quote, and test an already-arrears business. Hold the
quote after the year's interest so answering a saved choice cannot charge interest twice.

### 13.135 Pausing a failure must preserve the hole and the lender

A held rescue can have a negative till. The old wind-down reader clamps the till to zero,
so closing it without subtracting the trading hole forgives the loss. Apply the hole before
paying the lender, keep unpaid debt, and prove both ledger flows. Test death in the actual
annual advance and the heir's liquid inheritance, not just the rescue answer in isolation.

### 13.136 A percentage discount can buy back more than the thing costs

P2 measured a $5,500 car removing $12,000–$14,000 from a high earner's living bill.
A reference allowance must be denominated in dollars and bounded by the actual
cost it replaces. Income and voluntary luxury spending cannot expand it. Test
zero, below-cap, exact-cap and above-cap costs, and expensive cars' combined cost.
Re-measure the whole-life curve after removing an accidental savings subsidy.

### 13.137 A preference is not a paid benefit

Choosing a lifestyle changes only the saved preference. Its spending and mood
settle during annual advance, once, through the existing stat curve. Check both
the living phase's hardship/floor and the final ledger: a large portfolio can
make living affordable in the phase while an illiquid household still cannot
pay. Never award Lavish for unpaid spending or a mortgage-squeezed basic-needs
bill. Switching repeatedly must not change money, time, stats or RNG.

### 13.138 A new stat contribution must preserve the old contributors

P2's first mood merge overwrote activity happiness even when Comfortable added
zero. Preserve the existing creator/activity contribution before adding the
new annual nudge. Pin the zero-effect default and simultaneous activity plus
lifestyle effects, not only a tier in an otherwise empty life.

### 13.139 Less output must not preserve an unrelated windfall

P3 found that scaling negative audience drift by posting count sheltered viral spikes. Four
posts a year could earn more over a life than twelve. Scale the positive benefit of work to
output; a loss that is about market churn, rather than work, keeps its own rule. Test the same
above-target record at one, four and twelve actions, and pin both audience loss and payment.

### 13.140 A short calibration can hide a reversed lifetime incentive

TikTok looked hard to monetize in P3's six-year check, but the casual policy reached a living
wage in 83% of the shared-calendar lifetime sample. An extra annual viral roll and slow losses
compounded over decades. Measure early traction, time to recurring pay and lifetime tails;
repeat across calendars, and compare action policies on paired seeds. Do not raise success
rates from an early median alone.

### 13.141 Preserving a draw includes rejecting a corrupt draw

A saved channel's luck must survive a balance change unchanged. P3's round-trip test passed,
but invalid numbers and strings also loaded, so the draw was not safe to read. Pin preserved
values, valid endpoints, malformed types and non-finite numbers. A migration-preservation
fixture must carry a real valid record, not only an id that bypasses domain validation.

### 13.142 Follow a balance coefficient through its explanation thresholds

P4's proposed halved positive demand effect made the old +5% growth explanation unreachable.
Keeping the boom at +9% did not restore ordinary growth's message: its new maximum was +2.5%.
Audit ledger inclusion, screen visibility and timeline thresholds together with the coefficient.
Pin a modest positive effect and a reduced negative effect, not only the strongest boom or crash.
The saved result is the account of what happened; never recompute past records with today's dial.

### 13.143 Compare a threshold in the units that define it

At P4's 1.5% display boundary, `1.015 - 1` can be slightly less than `0.015`. Comparing
multipliers with `1 ± threshold` keeps that exact boundary visible. Whole-percent text also
needs a unit of float tolerance around one, so the same 1.5% does not say 1% after rounding.
Test both signs at the boundary and just inside it, and the text as well as the row's presence.
A constant's literal test cannot prove that its caller uses it.

### 13.144 A reserved slot cannot manufacture an eligible choice

P5 found that Architectural Studies graduates had one eligible architecture job, not two.
Count the matching eligible pool before promising a quota. Show all available matches when
it is scarce, as approved, and fill remaining slots without duplicates or bypassing gates.
Use the same study/license matcher for curation and calibration; verify hostile draws where
all unrelated jobs rank ahead of the field, not only favorable random boards.

### 13.145 Weight share is not inclusion probability

Sorting uniform draws divided by weights is a weighted ranking, not a linear slots-times-share
lottery. Reserving places also changes which pools and slots a candidate competes for. P5
replaced the starvation guard's linear proxy with conservative sufficient-event bounds for
both reserved and general selection, retaining the zero-reach and 95% single-life checks.
Take the larger of overlapping event bounds; adding them can claim a probability above one.
Test certain scarce-pool inclusion, displaced general slots and empirical inclusion alongside
the mathematical bound. Preserve historical measurements as measurements, not exact odds.

### 13.146 Exercise both paths through a curated board

Hostile study draws prove that reserved slots survive a crowded general pool. Favorable study
draws prove that those reserved winners are removed before filling the rest. P5 sabotage found
that the first case alone missed duplicate winners in the second. Likewise, a board's early
age return can mask a broken direct-command gate: test eligibility and application commands
without relying on the screen to keep a child out.

### 13.147 Hold a comparison's causes and fixtures constant

Changing a career board changes seeded lives' income, homes and cohort membership. Literal
underwriting tests need explicit original income/assets, not newly tuned expected quotes.
A living-cost comparison should capture the bill before shortfall clamping, with equal income,
and verify the real annual caller. A parenting-effect check should compare the same parent's
state with and without that contribution, not changes across different parent/nonparent groups.
Keep the original effect floors and sabotage the mechanism after repairing the measurement.

### 13.148 Settle chosen work across every annual stage

A shared model can still lose pay in an early return: P6 found graduation and college omitted
held gigs, while graduated adults omitted their hours. Use one settlement producer and test
every stage, including the transition year, with affordable branch fixtures. Preserve the
paid year's hours before removing aged-out work. Validate saved ids and deduplicate payouts;
no save-field change is needed to repair settlement of existing ids.

### 13.149 Follow an income producer through its readers

Posting a correct paycheck is not enough. P6 gig income reconciled yet was absent from taxes,
living inputs, later income tax bases and earned-income readers. Test the actual annual caller,
gross versus net, ordinary wages versus freelance premiums and the existing child treatment.
Sabotage each reader independently; a literal helper test cannot prove its integration.

### 13.150 Overcommitment belongs to the workload model

The canonical policy lets players overcommit and experience consequences. A two-gig menu cap
contradicted it; Payton explicitly approved replacing that cap test. Measure the whole-year
consequences with real hours rather than assuming unlimited choices create free capacity.
Separate older working lives from purely retired lives before attributing their stress.

### 13.151 Risk reductions must target the described risk

An instruction to reduce speculative exposure must not sell an unrelated safe holding merely
because it is the largest. Resolve applicable holdings from the recommendation's reason,
span holdings when needed, and test that unrelated positions survive. “Lowest volatility”
is not “broadest exposure”: use the explicit catalog id for an index destination.

### 13.152 Protect commitments in both advice and its command

A reserve based only on the living row omits separately billed mortgage, car and debt
payments. Reuse settlement calculators, account for student deferral, exclude operating
business accounts but include signed debt after closure, and avoid duplicate allowances.
Recompute after every player tap. Test silence in the generator as well as refusal of stale
commands; a protected goal can otherwise still receive an inappropriate buy suggestion.

### 13.153 Measure the policy, not just the stock signal

Advisor comparisons depend on contribution size, reinvestment, cash goals, fees and household
spending. Match those policies, state the comparator, and disclose stronger controls that
outperform it. Controlled investment returns do not establish superiority over every played
life. Round-trip the hired advisor and goal through the actual state constructor: serializing
a field is insufficient if construction silently drops it.

### 13.154 Catalog growth changes selection probabilities without changing an RNG rule

Uniform draws over eligible references make a maker with more models more common,
and additional watches dilute other kinds in mixed auctions. Measure the actual
reader, disclose those effects, and distinguish multi-year discovery from one
counter's variety. Freeze existing IDs, complete entry values and store definitions
when appending to a catalog used by saves. The authoring generator must reproduce
tracked bytes without reformatting unrelated rows; tests should cover actual
purchase, sale, estate and save readers as well as membership in the catalog.

### 13.155 Verification must restore every output it temporarily generates

A generator can write more than its declared primary output. Comparing and restoring
only that primary file can leave unrelated secondary catalogs dirty even on a reported
failure. In P8, the vehicle generator's secondary vehicle-mods file changed layout
while the validator restored vehicles alone. Check the working tree after verification,
confirm semantic equality before restoring accidental output, and do not commit it
as part of another ticket. The validator restoration gap remains an open follow-up.
