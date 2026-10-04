# Ticket 0406 — schools, and the paper they hand you

Review, after playing 0405: *"This seems pretty bare. I dont see medical
school, dentist, vet school, law school, postgrad, anything like that. I dont
have any engineering options, trade schools, anything."*

All true, and the shape of it was worse than the list. 0403 grew the job
catalogue to sixteen tracks and nobody came back to the eight majors 0210b
shipped, so **five tracks had no program pointing at them at all** —
medicine, legal, tech, finance, and hospitality, the last of which had a major
named after it that opened `food` and `retail` instead. The four richest
ladders in the game could only be entered as an off-major applicant eating the
0.2 relevance penalty.

And `requires: 'postgraduate'` was the only gate on Physician. A master's in
fine arts qualified you to practice medicine, for three tickets, because
`meetsLevel` is an ordered comparison and an ordered comparison cannot refuse.

## What it is

**53 programs in three tiers**, replacing the eight majors:

| tier | count | length | what finishing gives you |
|---|---|---|---|
| Trade & certificate | 14 | 1–2 yrs | a license, and no change of level |
| Undergraduate | 24 | 4 yrs | `university` |
| Graduate & professional | 15 | 1–4 yrs | `postgraduate`, and often a license |

Medical, veterinary, dental and pharmacy school, law school, architecture,
MBA, MSW, MPA, MEd, MFA, an engineering master's, nurse practitioner, public
health, and the CPA year. Electrical, plumbing, HVAC, welding, automotive,
CDL, culinary, cosmetology, practical nursing, dental hygiene, paramedic,
pharmacy tech, paralegal and IT certification. Every one of the twenty tracks
now has at least one program aimed at it.

**Four new career tracks**, because a vet school with no veterinarian to
become is a door onto a wall: `veterinary`, `dental`, `pharmacy`,
`architecture`. 147 jobs → **169**.

**The license**, which is the actual mechanism and does two jobs at once:

- A **wall** nothing substitutes for. `lic.md` is why a fine-arts master's is
  no longer a medical qualification. 20 of the 169 jobs sit behind one.
- A **ladder** you are credited with having climbed. The trades ladder needs
  no qualification at all and never will (spec 119, spec 1405), so a trade
  license could not prove itself by opening a door — the door was never shut.
  What it buys is the apprenticeship: `reachOf` treats the holder as somebody
  who has already stood on rung 1, so they apply straight to the journeyman
  job instead of serving the years. Taken as a floor, so a licensed
  electrician with fifteen years on the tools still reads as fifteen years.

Deliberately **not** on the `EducationLevel` ladder. Writing that up as a rule:
CORE_RULES 13.64.

Save **v27 → v28**. `credentials.licenses` is optional and absent means "holds
none", which is true of everybody who lived before trade school existed, so
there is no migration content. The migration explicitly does **not** grant
`lic.md` to physicians a v27 save already holds — a migration that hands out
credentials is a migration that invents history. They keep the job; the gate
only ever runs on the next one.

## The screen

Spec 1336: *"Do not make inventories so large that search/filtering is
necessary. Use curated inventories, contextual gating, and yearly refreshes
instead."* So not the dropdown the review asked for — a dropdown is a filter
with the filtering left to the player. Two things instead:

- **`programsOpenTo` gates the list** before it reaches the screen. Nobody
  scrolls past medical school at sixteen or past a bachelor's they hold.
- **Grouped by field, not by tier.** Tier-first makes the player answer "how
  long do I want to study" before "what do I want to do", and buries dental
  hygiene three screens from dentistry. Field-first puts every road into one
  profession in one block: somebody who wants to work in health sees the
  one-year practical nursing certificate and the four-year medical degree
  together, at their real prices, and picks their depth.

Money moved from the header onto each row. 0210b quoted one tuition figure
because there was one; there are now nineteen, from $3,600 to $34,000 a year,
and a header quoting one of them would be wrong about eighteen.

## Measured

A player who pursues one profession, 60 lives each, student loan taken when
short:

| | qualified | ended up working that track |
|---|---|---|
| doctor | 21/60 | 22/60 |
| lawyer | 39/60 | 19/60 |
| dentist | 27/60 | 10/60 |
| veterinarian | 27/60 | 8/60 |
| pharmacist | 32/60 | 4/60 |
| architect | 44/60 | 3/60 |
| electrician | 57/60 | — |
| dental hygienist | 58/60 | — |

The trade rows qualify almost always and rarely end up in the trade, which is
the harness rather than the game: it only applies for work while unemployed,
so it takes whatever it can get at eighteen and never moves again.

Passive lives (300, answering only what the game raises) went from 39/250
degrees to 56/300, and 26 of 300 now hold a license — a thing that could not
happen at all before. **Zero reach postgraduate**, which is not this ticket's
doing: see below.

`reachability.test.ts`'s print went from 0/147 to 18/169 never shown. Fifteen
of those are the professional tier, and that is the design working — 0403's
own note says a doctor "is not something a character backs into". The
assertion that matters (no job eligible to somebody and unreachable by the
listings) is still zero.

## Four bugs found on the way, two of them mine

- **`cannotEnrol` started disagreeing with itself.** While every program
  cost the same, "can you enrol" and "can you enrol in THIS" were one
  question. They are not: a character with $5,000 can start a welding
  certificate and cannot start medical school. Leaving it as one function with
  an optional argument meant a caller could ask the loose question, get a yes,
  and be refused one line later — CORE_RULES 13.15. Split into
  `cannotEnrolAnything` (is the College row worth showing) and `cannotEnrol`
  (does this application go through). Cost an afternoon in `floor.test.ts`
  before it was named.

- **The four new tracks were silently dropped for an hour.** `widen` returns
  `undefined` for a track not in `TRACK_LABELS`, so all 22 new jobs vanished
  between the catalog and the game with no error anywhere. Caught by a probe
  printing `20/169` as `6/147`. Same class as 13.51: a total that looks
  plausible hides an absent mechanic.

- **`floor.test.ts` cycled `MAJORS[i % MAJORS.length]`** — invisible while
  `MAJORS` was eight interchangeable bachelor's degrees at one price, and wrong
  the moment it was 53 programs across three tiers. A quarter of the seeds
  were handed a graduate program a school leaver can never start. It
  presented as the `allin` cohort spending 12% less on living than `never`
  while holding eight times the net worth — indistinguishable from the
  $430,000 subsidy that test exists to catch, and neither. CORE_RULES 13.63,
  the entry 0405 wrote, second outing.

- **`investing.test.ts`'s `working()` returned an unsettled state.** It broke
  on `untilAge` before answering that year's decisions, which was harmless
  until something started raising decisions at 45. `advanceYear` refuses to
  advance while a decision is pending, so every test calling it got a silent
  no-op year and the failure pointed at the advisor. That one also exposed a
  real design fault above it — see the next section.

## One design fault this ticket created and fixed

Removing the `nothing-left-to-study` ceiling (so a postgraduate can still
learn a trade) handed 0405's systemic offer a population it was never built
for. A forty-five-year-old with a master's and a career was being asked about
cosmetology school every third year until they died — the annual-summons
failure 0405's own comment warns against.

The recurring 35% chance now stops at the first degree. The certain trigger is
untouched, so the year you finish a bachelor's you are still asked about
graduate school whether or not you ever opened the screen. What the systemic
offer is for is the player who never found the door; somebody holding a degree
has demonstrably found it.

## Verified

- `pnpm typecheck` — 15/15.
- `pnpm test` — 925/925.
- `node tools/content-validator/validate.mjs` — 10 catalogs, 962 ids, clean.
  It caught four rows that would clip on the listing, four tracks with no
  employers (their listings would have been nameless), and five British
  spellings including my own `license`/`program` throughout. All fixed at
  source rather than by loosening the check.
- `packages/careers/src/licenses.test.ts` — new, 5 assertions,
  sabotage-verified: removing either half of the license mechanism turns three
  of them red.

## One rule

- **13.64** — An ordered credential cannot express "this specific paper".
  Before extending an ordered enum to cover a new case, check whether the new
  case has an order at all; if arguing about where it sorts has no correct
  answer, it is a second dimension and belongs beside the first. And the new
  dimension needs its own reachability guard — a credential nothing grants is
  worse than a missing job, because the game shows the row and believes the
  player could have had it.

## The bigger thing, which is NOT this ticket

Measuring the baseline for this ticket turned up something larger, and it is
the recommended next ticket.

**A passive player never gets a job. Ever. 0/250 lives.**

0402's `withAnyOffer` opens with:

```ts
const held = state.employment.job;
if (!held) return state;
```

It is a poaching mechanic — a better offer for somebody who already works —
not a way in. Nothing in the build has ever put a first job in front of a
player who did not go to the Career screen and apply. One probed life reached
**age 60 with no job, $0, and no credentials at all**, while 144 job listings
sat available across ages 16–40 and not one decision was ever raised about
any of them. The only decisions a passive adult receives are childhood random
events.

This is also why passive lives reach `postgraduate` zero times out of 300:
graduate tuition runs $12,000–$34,000 a year with no parental support, and a
population that never earns anything cannot fund it. The education ceiling is
downstream of the employment floor.

0405 built the college door for exactly this shape of problem. The career side
still has no equivalent, and it is the more load-bearing of the two — a
character with no job has no money, no living standard, no credit, and nothing
for the finance systems 0301–0310 to act on.
