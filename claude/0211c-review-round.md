# Ticket 0211c — reading the built app again

Committed as `b80da2e`. 27/27 turbo tasks, 622 tests, validator clean.

0211b was the voice pass. This is what playing 0211b found. Four defects, and
each one is worth keeping for **why the checks could not see it**, not for the
line it fixed.

---

## 1. "The household treated it as a public vacation."

Nobody wrote that sentence. The American English table said `holiday` →
`vacation`, 0207d's sweep obeyed it, and "public holiday" became "public
vacation".

That is the **fourth** casualty of that one table. `flat` → `apartment` gave us
"tripped on a completely apartment surface". `fringe` → `bangs` gave us
"attempted a bangs with kitchen scissors". Both shipped for three tickets, and
**V15** was written for them — it catches a noun after "completely" and a plural
after "a", because both of those are ungrammatical.

"Public vacation" is grammatical. V15 could never have seen it.

**New rule — CORE_RULES 13.35: a rule scoped to a word instead of a sense writes
the bug itself.** `holiday` has two senses and only one is British: a trip you
take is, a day the country takes off is not. A rule that names the WORD rejects
the correct use along with the wrong one — and because a sweep trusts the rule,
it then produces copy that is wrong in a new way the rule cannot see.

The table already knew this. It declines to flag `trial`, in a comment written
three tickets ago, for exactly this reason. Nobody generalised it.

**Fixed:** `holiday` is scoped to the phrases where the British sense actually
lives — `on holiday`, `summer holidays`, `school holidays`, `family holiday`,
`holiday home` — never the bare stem. `SWEPT_IN` gains a collocation arm
(`public|bank|national|federal|legal vacation`, `vacation season|spirit|cheer`).
`summer vacation` and `school vacation` are deliberately absent: those are
ordinary American English, and a rule that fires on correct copy is a rule
somebody deletes.

---

## 2. "Cristina paid you back out of sister's own allowance."

And, on the next line: **"Sister tried to refuse and you made him take it."**

Two shapes of one hole.

- `{siblingRel}` renders the **relation** — "brother" or "sister" — and was used
  where a possessive pronoun belongs.
- `{them}` is the **player's** pronoun and was used about a girl.

Neither line contains a bare "him" or "her". Every guard in the build was
looking for a pronoun typed into the copy, and **a wrong TOKEN is invisible to a
rule that only reads words.** The existing check ("names an incidental person
AND uses a player pronoun") covers `{kid}`, `{kid2}` and `{adult}` — a sibling
is family, so it was never in that set.

**Fixed:** siblings have their own pronouns now — `{siblingThey}`,
`{siblingThem}`, `{siblingTheir}` — resolved from `sibling.sex`, like every
other named person. Three new generator checks:

1. `{sibling}` + a player pronoun in the same line.
2. `{sibling}` + a bare he/she/him/her.
3. `{siblingRel}'s` (the relation used as a possessive) and `{SiblingRel}` (the
   relation opening a sentence) — both exact shapes that cannot appear in
   correct copy.

Verified by reverting one line and watching the check fire, then restoring it.

**Still open:** the token-guard table now exists in **four** places — the
generator, the content test, the validator and the renderer. 0209's 13.23 noted
three and did not consolidate. The duplication between the Python generator and
the TypeScript test is arguably deliberate (independent verification of the same
rule), but four copies is one more than anybody is going to keep in sync.

---

## 3. "Crime · Ticket 0901"

On the Activities screen. To a forty-year-old character.

**V14** matches `Ticket \d{4}` — the string a developer types. The screen renders
`` `Ticket ${row.ticket}` ``, which contains no digits. So twenty-eight unbuilt
rows across Activities, Assets and Mind & Body printed ticket numbers straight
at the player, **six tickets after 13.24 was written about one instance of
exactly this.**

Three more notes-to-a-reviewer were printed under player menus:

> "15 rows — within the 10–16 target (spec 879–943)."
> "Martial Arts lives here, not as a top-level activity (spec 879–943)."
> "Professional relationships stay in their own worlds — coaches in sports,
> agents in acting, employees in business, tenants in property."

**Fixed:** unbuilt rows read **"Not built yet"**. The `ticket` field stays in the
data — it is for us — and is no longer rendered. V14 now matches the
interpolation as well as the literal. New **V17** fails on a spec reference that
survives comment-stripping in anything under `apps/`, with the developer screen
exempt by path. The three notes moved into comments.

---

## 4. The Doctor screen's "How you are" section is gone, not rewritten

The product owner's note was the shortest of the whole review:

> "At the doctor, where it says 'how you are' it says things like 'Not how you
> used to be'. That is odd for real life people to read. **There probably
> doesn't even need to be anything there.**"

0211b rewrote the words — "Not what you were" became "You're getting older" —
and kept the row. That was the wrong half of the note.

The Health bar sits at the bottom of **every screen in the game**. The row was a
caption for a number the player was already looking at, and no wording fixes
that. It is gone. `HealthBand`, `bandOf()` and `HEALTH_LABELS` went with it
rather than sitting in the package unreachable — a five-value enum with one dead
consumer is 13.7 waiting to happen.

Also gone: the paragraph under the button explaining, at length, that there was
nothing here to keep on top of. A screen with two rows has already demonstrated
that (13.29).

**What the screen is now:** *What's wrong* (the conditions, or one row reading
"Nothing's wrong with you right now") and *What you can do* (one button). The
empty state is a sentence rather than a hidden section, because a heading that
disappears when the answer is "nothing" makes a player wonder whether the screen
is broken.

If 0212's life summary wants health in words, it should write the words for that
screen rather than resurrect a general-purpose vocabulary nobody asked for.

---

## Also

Two more Britishisms, both shipping since 0203b and on no list, both found the
same way — by reading a played childhood:

- "in front of the entire **year group**" → "in front of your entire grade"
- "somebody was sick **on the coach**" → "somebody threw up on the bus"

Added as `year group`, `on the coach` and `by coach`. The **bare** word `coach`
is deliberately not flagged: a sports coach is the commoner sense in this game,
and 13.35 is about exactly that trade.

---

## The pattern, said once

All four defects, and all six Britishisms across three tickets now, were found
by **reading the output of a played life**. None of them could have been found
by running the suite, because in each case the suite is asserting the rule that
caused the defect.

The tooling for this is a web export, a static server and a Playwright script
that plays a life by clicking Advance and answering whatever it is asked. It
takes about four minutes. It should run at the end of every ticket.
