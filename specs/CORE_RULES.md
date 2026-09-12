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
  since 0205, written by nothing. The comment beside it said *"a member who is
  `alive: false` is somebody who died while the player watched"*, which had
  never once been true.
- **`character.records`** (found here) — declared in Sprint Zero with the
  comment *"structured history for dynasty records and the death summary"*,
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
claimed to prove that mashing a spent button does not spend a draw — *"the seed
still means something"* — and did it by advancing one state, then mashing that
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

Spec 1678 says *"opening cash + cash in − cash out = closing cash. Any mismatch
fails validation."* So I wrote a function that walked the ledger a year at a
time, computed each year's opening, inflow and outflow from the transactions,
added them up, and checked the identity held.

It held. It would have held for **every ledger that has ever existed or ever
will**, including a corrupt one, because all four numbers came from the same
rows. Opening plus in minus out *is* closing when you define all four by summing
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

The control test in the same file — *"lets an honest year through"* — would have
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

|  | Excellent | Good | Fair |
|---|---|---|---|
| never applies | 31% | 43% | 21% |
| takes every card | **44%** | 46% | **5%** |

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
