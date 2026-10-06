# Playtest A8 and A9 — enrolled program and graduation

Payton authorized the next batch on 5 October Pacific time (6 October UTC).
Branch `feat/playtest-college-graduation` follows PR #4. Claims preceded code in
commit `9055142`.

**Spec sections:** 74–79 (lightweight education), 786–795 (contextual outcomes),
849–878 (education UI), 1820–1822 (program choices). **Allowed files:** mobile
screens, components, route wiring and component tests; notes.
**Protected areas touched:** none. No store, engine, save, balance, CORE_RULES,
content catalogs or approved-decisions changes.

## A8 — the program you are in

Observed: Career named a student's program but its row was read-only. Study
Harder and leaving were loose rows in the root action card. A working student
had no program row at all, because the job card took priority.

Career now opens the enrolled-program screen, including for working students.
The screen shows the actual program name, description, current year out of its
real length, letter grade and GPA. Costs use the existing `tuitionDue`,
`collegeSupportOf` and `outOfPocket` functions: yearly tuition, family help
(capped at the bill), and the player's yearly share. Tuition debt remains
visible through the preceding batch's Student loan row.

The payment explanation says cash comes first, then a student loan if eligible;
it does not promise approval or family support. Study Harder calls the existing
command. Leaving opens a separate confirmation that explains the qualification
will not be earned and existing debt remains; the player can stay instead.
Career's old immediate leave action is replaced with Open your program. School
Study Harder is unchanged. The application screen is still College; the
`program` route is for somebody already enrolled.

A program that has ended shows Not enrolled and a link to available programs,
rather than stale study or leave actions. Legacy missing program metadata uses
the existing engine fallbacks for duration and tuition.

## A9 — graduation gets a moment

The shared shell mounts a graduation notice using the existing OutcomeCard.
It observes a one-year transition for the same living character and checks
newly earned qualifications. It names the diploma, program/degree and any
professional license, describes relevant career paths without guaranteeing a
job, and shows remaining tuition debt (excluding unrelated personal loans).

**Important contract detail:** both failure and lack of tuition money set the
education stage to `graduated`. Stage alone cannot identify completion. The
notice therefore requires a new diploma/degree age or new program license.
Real `runCollegeYear` success, failure and insufficient-money results are used
in the tests. It does not parse timeline wording or change any engine state.

The notice waits behind a decision, another outcome or a detail card. It keeps
its own transient state, so it does not overwrite those overlays. Dismissal
does not replay on rerender; loading an already graduated save does not pop it
up again. Changing characters or dying clears it. Nothing new is saved.

## Tests and sabotage

19 new mobile tests cover all three program tiers, real duration and tuition,
grades and Study Harder, family help and outstanding debt, leave/stay
confirmation, working-student access, ended programs, actual degree/license
completion, actual failure and insufficient money, diploma and tuition-only
debt, overlay priority, dismissal, save-load behavior and character changes.

All eleven independent mutations were caught:

| Mutation                              | Result |
| ------------------------------------- | ------ |
| Program year off by one               | caught |
| Family help overstates tuition        | caught |
| Study callback lost                   | caught |
| Leave happens before confirmation     | caught |
| Career program routes to applications | caught |
| Stage alone treated as graduation     | caught |
| Undergraduate qualification ignored   | caught |
| Tuition debt includes personal loans  | caught |
| Graduation covers a pending decision  | caught |
| Graduation replays after dismissal    | caught |
| Professional license omitted          | caught |

None missed. Mutated files were restored with SHA-256 checks. No engine files
or engine tests were mutated. Focused mobile typecheck and all 42 mobile tests
pass. Final `pnpm verify` passes all 15 typecheck and 15 test tasks (2,026 tests),
then fails on the same nine unrelated generator/catalog mismatches, with output
identical to untouched main `5330478`. The validator's vehicle-mods side effect
was restored. Changed-file formatting passes; existing global Markdown
formatting failures remain outside this batch. Native-device layout
and tapping remain pending.

## Review order and remaining notes

Merge PR #3, then PR #4, then this batch. All branches target main and later
batches currently include the preceding unmerged commits.

Remaining screen notes need inputs: A1 waits for 0705/0706; A3 needs B1's failure
contract; A5 needs concrete copy examples; A7 needs the B15 rental-cost decision;
A10 needs its decision against spec 20. Rules/backlog B items remain Agent A's.
Explicit purchase-card choices need that agent's payment contract and must
support all eligible purchases, including future vacations, up to available
credit. These have not been reported as built.
