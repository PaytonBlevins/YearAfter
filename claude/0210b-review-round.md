# Ticket 0210b — review round after playing 0210

Five things review reported. All five were right, and two of them were things
the build had been quietly missing since 0206.

---

## 1. A result popup, where the player pressed

> *"When I tried out for the basketball team, the result landed on the homepage
> as it should, but I want a pop up result for things like that. Use this
> picture as a reference. Please make this common across important,
> entertaining, and interactive moments in the game (life)."*

Every interactive moment in this game resolved **silently into the Life feed**,
from 0206 onward. A player could tap Try Out, or Work Harder, or ask a parent
for money, and get no answer at all until they navigated somewhere else and
scrolled. Ten call sites, the same omission, repeated across five tickets —
because each one wrote a timeline entry and stopped, and a timeline entry is not
a reply.

New `OutcomeCard`, wired into **tryouts, job applications, college applications,
Work Harder, Study Harder, asking a parent, romance moves and friend
interactions**. Three tones (it went well, it did not, it happened), an optional
meter, an optional figure.

The rule that came out of it, **CORE_RULES 13.27**: *if the player pressed it and
it had an outcome, they are told in a card, where they pressed it.* A year
passing still writes to the feed and always will — spec 725–770 makes the feed
the story of a life, and a modal in front of every passive line would be a
slideshow. The distinction is who initiated it.

## 2. College and graduate school

> *"When you graduate from highschool, there is no college or post graduate
> options. Those are Necessary!"*

They were. Spec 1820 lists "college/university, majors" among the required
systems and 0204 shipped without them, so every character left education at
eighteen — and a job that wanted a degree was gated on a door that did not
exist.

**What it is:** eight majors, four years, tuition per year, admission, failing
out, leaving, and a two-year graduate degree on top. Save **v14**.

**What it deliberately is not:** spec 1822 and section 79 remove *test
performance and school quality* from admission **by name**, so there is no exam,
no essay, no ranking and no acceptance minigame. What decides admission is the
academic record Study Harder has been building since the character was six —
which is the point of that button having existed for twelve in-game years.

Spec 1821 — "major + Study Harder is generally enough" — kept the whole thing to
one choice and one button.

## 3. Tapping a job no longer hires you

> *"When I click on a job, it automatically hires me. That should not be the
> case. Use the relevant picture as reference. Remember what we determined each
> job should show (salary, requirements, benefits)."*

It did, and it was wrong twice: a tap that commits a decision with no
confirmation is not a decision, and the player never saw what they were applying
for.

A listing now opens a card — **title, field, employer, salary, the hard
qualification, the soft one, experience, benefits** — and applying is a separate
deliberate press. When it cannot happen the button says *why* rather than being
greyed out with no reason.

No Workload line and no Travel line (spec 97 removes both from job listings by
name), and no quota (spec 104).

**CORE_RULES 13.28**: opening a thing and committing to a thing are different
gestures and must be different taps. Not a confirmation dialog — those ask "are
you sure?" and imply the player erred — but the information they needed in order
to choose, shown before the choice rather than after it.

## 4. Realistic degree requirements

> *"Please make it realistic as to what jobs require college degrees and what
> not."*

Nine jobs are now **hard-gated** — licensed and credentialed work only: nurse,
charge nurse, teacher, department head, principal (graduate degree), analyst,
senior analyst, operations director, city administrator.

Everything else is a *preference* at most. The highest-paying job in the catalog
(sales director, $130k) is still reachable with no diploma at all, because spec
119 keeps reinvention open and spec 1405 keeps major life paths unlocked.

The catalog's own check now prints what each education level can reach, so a
future edit that locks somebody out fails at generation time.

## 5. "$44k and only got paid a few grand"

> *"I selected a job for $44k and only got paid a few grand. Im not sure if that
> is in a later ticket, if so that is fine, but that needs addressed for sure."*

Not a bug — the salary is gross and what reaches the bank is what is left after
tax and after the cost of living — but **a model nobody can see is
indistinguishable from a broken one**, and a correct number was being read as a
fault.

The Career screen now shows the whole arithmetic on the screen that produced it:

| | |
|---|---|
| Salary | $44,000 |
| Tax | −$8,400 |
| Living | −$32,700 |
| **What you keep** | **$2,900** |

Spec 1323 puts income and tax rate on the finance overview and says "specific
expenses/income live on the entity that produces them" — the job produces the
salary, so this is where the arithmetic belongs. When 0301's ledger and 0303's
living expenses land, this card reads from them and `livingCostOf` is **deleted**
rather than kept alongside (CORE_RULES 13.8).

---

## What measuring changed

Twice, before anything shipped.

**Tuition was priced against money an eighteen-year-old does not have.** At
$9,400 a year against a school leaver holding $150, `cannot-afford` blocked
enrolment **2,282 times in 300 lives**, and **78 characters ran out of money
part-way through a degree they had already been accepted onto**. CORE_RULES
13.16 for the sixth time.

Parents fund college — spec 61 and spec 1197 both say so, and 0209 already built
the request. So `help-with-college` became a **yearly commitment** rather than a
one-off payment, which is what funding somebody's education actually is, and it
makes the difference between a family that can and one that cannot into the
class divide it should be.

**Then that commitment carried into graduate school** and put 56% of a
determined player through a master's, which is a conveyor belt rather than a
life. It covers the first degree only now — you pay for the second one out of
what the first one earned you.

**And a passive player got nothing.** Somebody who simply pressed "apply to
college" at eighteen without knowing to ask their parents first was blocked by
cost in **200 of 200 lives**, told only "You cannot cover the first year". A
path whose entrance is a menu the player has not thought to open is not a path.
Spec 1197 lets NPC parents fund college unprompted, so now they do.

Where it landed:

| | degree | graduate degree |
|---|---|---|
| Determined player (applies every year, asks parents) | 71% | 32% |
| Passive player (one application at 18, asks nobody) | 10.5% | — |

Knowing to ask your parents is worth **seven times** your chance of a degree.
9 in 300 fail out academically; 52 run out of money mid-degree.

---

## Still open

- **This build cannot produce a poor student.** School performance at sixteen is
  p10 67, median 78, minimum 50 across 500 lives — Smarts alone is p10 70 by
  eighteen. Grades barely vary, Study Harder moves an already-high number, and
  leaving school early only reaches 2–3% even with the floors set to the real
  population. The fix is upstream in character generation.
- **Smarts and Discipline never move after eighteen.** Only Charisma changes in
  adulthood.
- **Nothing in the event catalog is about work yet** — now the most obvious gap
  in the feed.
