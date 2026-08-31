# AI coding instructions

Read this before starting any ticket. Spec 1247–1263 requires every ticket to
carry its spec sections, allowed files, protected areas, acceptance tests and
expected result.

## Before writing code

1. Read the ticket's cited spec sections in `specs/MASTER_SPEC.md`.
2. Read `specs/CORE_RULES.md`.
3. **Inspect the existing code first.** Most tickets extend something that
   already exists. Find it before writing a parallel version of it.
4. If the ticket conflicts with CORE_RULES or the master spec, stop and raise it.
   Do not implement around a canonical rule.

## Ticket template

```markdown
## Ticket NNNN — <title>

**Spec sections:** <numbers from MASTER_SPEC>
**Milestone:** v0.0N
**Allowed files:** <paths>
**Protected areas touched:** <none | which contract, and why>

### Requirement

<what this must do>

### Acceptance

- [ ] <observable, testable outcome>
- [ ] typecheck, tests and content validation pass

### Out of scope

<what this ticket deliberately does not do, and which ticket owns it>
```

## While writing code

- TypeScript strict. No `any`. No non-null assertions to silence the compiler.
- Small functions, small files, descriptive names. Booleans read naturally
  (`hasGraduated`, not `gradFlag`).
- Each domain exposes a small public API through its `index.ts`. Never import
  another package's internal file path.
- No magic numbers. Tunable values go in documented config.
- Never call `Math.random()`. Take a stream from the RNG registry.
- Expected failures return `Result`, they do not throw.
- Derive; do not duplicate. Net worth is computed, never stored.
- Comment the _why_, not the _what_. A comment explaining a spec constraint or a
  non-obvious tradeoff earns its place; a comment restating the line below it
  does not.

## Definition of done

A feature is not complete until it has all of:

- data model
- simulation logic
- UI
- save/load support (including a migration if the save shape changed)
- tests
- balance configuration
- relevant content
- acceptance checks passing

## Testing

- Unit tests for deterministic logic.
- Integration tests for cross-system flows.
- Acceptance tests for canonical spec rules — a test that fails if someone
  quietly adds an eighth stat bar is worth more than ten trivial tests.
- Golden-life tests: a fixed seed produces a byte-identical life.
- Statistical tests for probabilistic systems, with enough trials that the
  assertion is not flaky. Rare-event rates may need very large runs.

**Never delete or weaken a test to make code pass.** If a test is wrong, say so
explicitly and explain why in the change summary.

## Git

- `main` stays stable. Short-lived feature branches.
- Conventional prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `content:`,
  `balance:`, `docs:`.
- Small, descriptive commits.

## Change summary

Every meaningful change reports:

1. What was implemented.
2. What tests were added and what they cover.
3. Which systems were impacted.
4. **Anything requiring product judgment** — balance values, pacing, wording,
   visual choices. Propose a specific value; do not ask the owner to invent one.
5. Open issues and known gaps.

## Prohibited

- Unrequested feature invention.
- Silent scope reduction.
- Placeholder logic reported as complete. If something is a placeholder, say so
  in the code comment _and_ in the summary, and name the ticket that replaces it.
- Changing a protected contract without flagging it for approval.
