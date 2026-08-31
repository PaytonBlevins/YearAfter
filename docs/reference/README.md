# Market reference

Screenshots of a shipping text-first life simulator, captured by the product
owner and kept here as a running reference for structure and content breadth.

**What these are for:** menu taxonomy, hub grouping, row anatomy, how much
content a mature version of this genre carries, and what players already expect
to find. When a ticket asks "what belongs on the Doctor hub" or "how deep does
the crime list go", look here before inventing an answer.

**What these are NOT for.** Spec 828–838 is explicit: familiar life-simulator
_conventions_ are allowed, but visual identity, typography, colours, icons,
spacing, animation and exact layouts must be **original**. Spec 1043–1059 adds
that recognisable analogues need legal review before release.

So the line is:

| Take from these                                        | Do not take                             |
| ------------------------------------------------------ | --------------------------------------- |
| Which hubs exist, and what sits inside each            | Colour palette, header treatment, type  |
| Content breadth — how many crimes, how many doctors    | Emoji as the icon system                |
| Interaction conventions (a hub navigates, a leaf acts) | Exact screen layouts, verbatim copy     |
| Where players expect to find a feature                 | Brand names, product names, trade dress |

These files are reference material, not a target to match pixel for pixel. If a
change would only make sense as "because that's how they did it", it does not
belong in this codebase.

---

## Files

| File                          | Screen                                             |
| ----------------------------- | -------------------------------------------------- |
| `01-life-main.png`            | Main life feed, centre age control, stat bars      |
| `02-occupation-upper.png`     | Career: current job, performance and stress inline |
| `03-occupation-lower.png`     | Career: education, gigs, recruiter, jobs, military |
| `04-assets-upper.png`         | Assets: finances, premium assets                   |
| `05-assets-lower.png`         | Assets: collectibles, real estate, vehicles, misc  |
| `06-activities-favorites.png` | Activities: favourites and premium sections        |
| `07-activities-all-start.png` | Activities: the flat "All" list begins             |
| `08-activities-all-mid.png`   | Activities: All, continued                         |
| `09-activities-all-late.png`  | Activities: All, continued                         |
| `10-activities-all-end.png`   | Activities: All, end                               |
| `11-hub-mind-and-body.png`    | Mind & Body hub                                    |
| `12-hub-doctors.png`          | Doctors hub                                        |
| `13-hub-love.png`             | Love hub                                           |
| `14-hub-crime.png`            | Crime hub                                          |

---

## What these confirm about our approved structure

**Mind & Body** — theirs holds Acting Lessons, Book, Diet, Garden, Gym,
Instruments, Library, Martial Arts, Meditate, Memory Test. Ours (Ticket 0111) is
Gym, Meditation, Martial Arts, Instruments, Acting Lessons, Books/Library, Diet,
Walk. Near-identical shape, arrived at independently from spec 879–943. Garden
and Memory Test are plausible later additions.

**Martial arts belongs inside Mind & Body,** not at top level. Theirs agrees.

**Assets is the ownership world,** with shopping reached from it. Theirs groups
Finances / Premium Assets / Collectibles / Real Estate / Vehicles / Misc and puts
a persistent "Go Shopping" action at the foot. Our spec 1363 says the same thing.

**Career shows performance inline.** Their occupation screen puts a performance
bar on the current job row and a stress bar on the schedule row, rather than
sending you to a stats page. That matches our contextual-variable rule.

**Disabled rows stay visible and greyed** rather than being hidden. Ours does the
same for unbuilt systems.

---

## Where we deliberately diverge

These are not oversights. Each is a canonical rule we are keeping.

**Activities is a flat 40+ row list in theirs.** Sections named Favorites,
Premium Activities and All, alphabetised, several screens long. Spec 879–943
explicitly targets **10–16 broad rows** for Activities, with leaf actions inside
hubs. Ours has 15. Do not let Activities grow into their shape — when something
new needs a home, it goes inside an existing hub.

**They surface a search-free but very long inventory.** Spec 879–943 asks for
curated inventories and yearly refreshes instead of length. Same intent, and we
hold the shorter line.

**Their centre control is `+ Age` with a satellite `− Age`** for paid time
reversal. Ours is one control. Time reversal is a permanent unlock in spec
1031–1042, and when it ships it should not clutter the primary control.

**Their Doctors hub is broad** — alternative doctor, blood donation, plasma
donation, optometrist, witch doctor. Spec 531 says routine preventive care must
stay backend and never become a chore, so ours stays at general care, fertility,
rehab and treatment.

**Emoji as icons.** They use system emoji throughout. We use an original drawn
set (`apps/mobile/src/theme/icons.tsx`) because spec 828–838 requires original
visual identity.

---

## One convention worth considering

Their rows carry two different affordances, and the distinction is consistent:

- **`>` chevron** — the row navigates into a sub-screen (Properties, Investments,
  Mind & Body, Martial Arts).
- **`…` ellipsis** — the row performs an action or opens a sheet in place
  (Donate Blood, Pickpocket, Meditate, Lottery).

Our `ListRow` currently shows a chevron for anything pressable, so a player
cannot tell a menu from an action until they tap it. Adopting the split would be
a small change to one component and would make every list more readable.

**Not implemented.** This is an observation for the product owner, not an
approved change. Raise it as a ticket if wanted.
