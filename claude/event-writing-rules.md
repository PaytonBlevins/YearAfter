# YearAfter — event and decision writing rules

Approved by the product owner on 2026-08-31, after playing the Ticket 0203
build; extended on 2026-09-06 after playing 0207; extended again on 2026-09-09
after playing 0211 (Ticket 0211b, the voice pass). **These are settled.** They
apply to every event in the library, existing and future, and to every system
that raises a pop-up or a menu from here on.

---

## 1. Decisions must be specific, not abstract

The failure this replaces, verbatim from the shipped build:

> "You have been rehearsing a conversation with somebody for four months."
> — [Say something] [Say nothing]
> → "You said it. They were kind about it. It still took months."

Nothing in that is a scene. Nobody is named, nothing happens, and the outcome is
a summary of a feeling rather than an event.

The approved shape, in the product owner's own words:

> "You have had a crush on Nancy June for months and here's your chance to talk
> to her" — [Compliment her outfit] [Ask about her day] [Make a silly joke]
> → results may vary: "Nancy cringed at your joke" / "Nancy laughed at your
> joke" / "Nancy was flattered by the compliment" / "Nancy was creeped out"

Rules that follow:

- **Name the other person.** Use the incidental-name tokens so the name comes
  from the character's own naming tradition, and carry the same name through the
  prompt, every choice and every outcome of that decision.
- **Set a scene.** The prompt says where you are and what is happening, not what
  you have been feeling.
- **Three or more options wherever the situation plausibly offers them.** Two is
  for genuine binaries (own up / stay silent). "Do it / don't" is not a decision.
- **Options must be different approaches, not different intensities.** Compliment
  / ask about her day / make a joke — three tactics, three failure modes.
- **Outcomes are concrete and varied.** The same choice must be able to land
  well or badly, and the text says what actually happened to whom. "It still
  took months" is a verdict, not an outcome.

## 2. Do not force artificial exclusivity

The product owner, on the school-activities decision:

> "I had an opportunity to join an activity at school and my options were to try
> out for a sport or some other activities but only limited me to one. I don't
> want that. I want to keep workload realistic but say something like 'Your
> school has activities available to join — See what they offer, pass.'"

So: an event that opens a menu should open a menu, and the constraint on how much
a character can take on should come from realistic workload — time, stress,
parental permission, money — not from the pop-up arbitrarily allowing one pick.

## 3. Decisions must move Happiness and Health

Explicitly requested. Every decision's outcomes should touch Happiness where the
fiction supports it, and Health wherever anything physical, exhausting,
dangerous or restful is involved. A decision that moves neither is probably not
worth interrupting the player for.

## 4. Money must say where it came from

The product owner: *"My character keeps receiving money but I only know where it
came from from one instance."*

Any effect that changes cash must be accompanied by timeline text naming the
source and, where natural, the amount — "Won the raffle at the school fair, $40"
rather than a silent balance change. This applies to passive events and decision
outcomes alike. If a line cannot say where the money came from, the money should
not move.

## 5. Parents are Mom and Dad, not first names

The product owner, after playing the 0203b build:

> "When notifications pop up, it refers to my parents by their first names. 90%
> of kids do not do that. It's mom, mother, dad, father, etc."

`{mother}`, `{father}`, `{parent}` and `{parents}` render as what a child
actually calls them — "Mom", "Dad", "Mom and Dad". They work at the start of a
sentence and mid-sentence, because they are being used as names.

`{motherName}` and `{fatherName}` still give the first name, for the rare line
where a child genuinely would use one — overhearing adults, reading a form, a
hospital hallway. The Family screen is unaffected and shows real names.

A test asserts that no parent's first name appears anywhere in the shipped
catalog's rendered output.

## 6. Never write a pronoun for a person the engine named

Shipped in 0203b and caught by reading output:

> "You told Lucía exactly what you thought of him."

Incidental names are drawn from the culture's male **and** female lists, so a
written-in "he" or "she" is wrong about half the time. Copy that names one of
these people must use their own pronoun tokens:

| Token | Renders |
| --- | --- |
| `{kidThey}` / `{kidThem}` / `{kidTheir}` | he/she, him/her, his/her — resolved from the bound name |
| `{kid2They}` / `{kid2Them}` / `{kid2Their}` | the same, for the second child |
| `{adultThey}` / `{adultThem}` / `{adultTheir}` | resolved from the adult's title |

`{they}`, `{them}` and `{their}` remain the **player's** pronouns and are never
used for anybody else. A capitalised token — `{KidThey}` — is the same token at
the start of a sentence.

Three checks enforce this: the generator refuses to write the catalog, the
content validator fails the build, and a package test fails, on any line that
names an incidental person and then writes a bare he/him/his/she/her.

---

## 7. Say the situation, not its shadow

Added 2026-09-06, after playing the 0207 build. The product owner, on this
shipped prompt:

> "The report is in your bag, it is not good, and Mom has not asked about it
> yet."
>
> — *"Just say something simple like your mom is asking to see your report card,
> but your grades aren't up to par. What should you do. That's an example."*

Both sentences describe the same moment. The first one makes the player assemble
it: *the report* (what report?), *it is not good* (my grades are bad), *has not
asked yet* (so I could hide it). The second one just says what is happening.

The first version is more evocative to read and worse to play, and playing is
what this is for. A prompt is the interface to a decision — the player has to
understand the situation and the stakes in one pass, at a glance, on a phone.
Atmosphere that costs a beat of decoding is not atmosphere, it is friction.

So, for every prompt:

- **State the situation in plain words.** Who wants what, and what is at stake.
- **Use the words a person would use.** "Your grades aren't good this time",
  not "it is not good". "Tryouts", not "trials". "Two weeks", not "a fortnight".
- **Use contractions.** "It's", "you're", "aren't", "won't". Their absence is
  most of what made the old copy sound written rather than spoken.
- **Keep the voice.** Plain is not flat. "{kid} has been bullying you all year.
  Now {kidThey}'s blocking your way in an empty hallway, and nobody else is
  around" is plain AND it is a scene. Rule 1 still applies in full.

## 8. A label says what pressing it does

The same review, on the standing interaction menu:

> "'Tell them something' and 'Have it out with them' does not make sense to
> everyone. Please make them say what they mean. Much more clear please."

Those became **"Tell them a secret"** and **"Start an argument"**.

A choice label must be readable **without** the prompt above it. This is not a
nicety — the person page and the Love screen are standing menus with no prompt
at all, and even on a decision card the player reads the buttons before the
paragraph.

- **A verb and an object.** "Go", "Pass", "Coast", "Move up" and "Something
  drastic" are gestures, not instructions. One word is never enough.
- **No in-jokes and no understatement.** "The loudest one on the table" is a
  good line and a bad button.
- **Say the cost.** If pressing it spends money or ends a relationship, the
  label or its blurb says so: "Go on a date · Spend an evening together. Costs
  money."
- **The blurb explains, it does not wink.** "Go first, and hope" became "Say
  sorry first, before they do."

Enforced in three places: content-validator **V9** blocks the rejected labels by
name and rejects any single-word label, a `@yearafter/social` test applies the
same rule to the menus that live in code rather than the catalog, and this file
is the standard both point at.

## 9. American English

The game is written in American English. Shipped copy contained "wind them up",
"have it out with them", "a fortnight", "maths", "pavement", "corridor",
"apologise" and "solicitors" — every one of which costs a US player the same
beat of decoding rule 7 exists to remove.

Content-validator **V10** checks the rendered catalog for a list of these, and
the social package test checks the menu labels.

It checks the **rendered catalog and never the generator source**, and that is
load-bearing: several event ids legitimately contain `favourite` and
`neighbour`. A blanket find-and-replace over the source renamed five content ids
and one choice id, which silently breaks every save that recorded one, because
ids are stable forever (CORE_RULES 13). Fix the copy; never the id.

---

## 10. Never summarize the year — name a thing that happened

Added 2026-09-09, after playing the 0211 build. The product owner, on shipped
timeline lines:

> "'A steady year. The kind that does not make it into the telling.' Nobody
> talks like that. 'Reinstalled the app. Met somebody for coffee, and neither of
> you texted after.' I know what you're getting at but again it is really
> awkward how it's worded. Honestly, almost all of those are."

And on the Doctor screen's "How you are" section, which read "Not what you were":

> "That is odd for real life people to read. There probably doesn't even need to
> be anything there."

And on the check-up result, which read *"Bloods, blood pressure, the usual
questions. Nothing they want to see you about."*:

> "That's odd, just have it say 'You do not need to visit the doctor' or 'You
> had a checkup and everything was fine'."

The common failure is not length or tone. It is that the line steps back from
the year and passes judgment on it — *steady*, *the kind that*, *not what you
were* — instead of saying one thing that actually occurred. A verdict reads as
written; an event reads as lived.

The product owner's direction, in his words: *"Concrete and specific, but
emphasize that there is nothing wrong with showing personality. It is NEEDED
bad. But those vague and awkward texts are what's dragging it down."*

So:

- **Name a real detail.** "You had a routine and you mostly stuck to it" beats
  "A steady year." "Made $43,297. Living took most of it and left $2,737" beats
  a mood.
- **Personality lives in the detail, not in the framing.** "The year went fast.
  They'd started doing that" keeps a voice and still says something happened.
  Cut the framing device, never the character.
- **No line that only evaluates.** "The kind that does not make it into the
  telling", "It still took months", "Not what you were" — these are the writer
  narrating the writing. Cut them; if nothing happened worth a line, print
  nothing (CORE_RULES 13.29: a subtitle that reads the same every time is
  decoration).
- **A result says the result.** "You had a check-up and everything looked fine."
  If something was found, the line names it and says what to press next.

Content-validator **V16** carries a **VAGUE** table of the constructions this
rule bans and fails the build on them, in the generator source **and** the
rendered catalog — the first version checked source files only and passed clean
while the catalog still held the exact line the product owner quoted. Half a
rule is not a rule (CORE_RULES 13.31).

## 11. Contractions are mandatory, and the slang is ordinary

Rule 7 already said "Use contractions." Nothing enforced it, and 38 expanded
forms shipped anyway. A rule with no check is a preference.

- **Contract everywhere**, including screen copy, buttons, error labels and
  popup bodies — not just event text. "You've already been this year", not "You
  have already been this year."
- **Loose, ordinary spoken slang is welcome** — the product owner asked for it
  by name. The test is whether a person would say it out loud in a kitchen this
  year and in ten years. "Went over well", "took most of it", "nobody's
  pretending it'll go away" all pass.
- **Nothing that dates the copy.** No platform-specific memes, no phrase whose
  meaning depends on a trend. The game covers eighty years of a life and will be
  read years after it is written.
- **Plain names for plain things.** Health conditions are "A bad back", "Chest
  trouble", "A stroke" — what a person calls them, not a chart heading.

Content-validator **V16** carries an **EXPANDED** table of 13 contraction pairs
and fails on any of them.

Two mechanical lessons from the pass itself, both worth keeping:

- The extractor that fed the rewrite matched `text: "..."` and silently dropped
  every `text: [...]` **array** — 593 of 868 strings were never touched, and the
  gap was only found by playing a decade and seeing a quoted line still there.
  Verify a sweep by reading its output, not by counting its edits.
- A blanket `apologise` → `apologize` replace corrupted a **test's own** regex,
  making it assert that "Apologize" is British. Never run a find-and-replace
  across test files that assert on the very strings being replaced.

---

## Scope

These apply **across the board** — the whole existing catalog is held to this
standard, not just new events. Rules 10 and 11 were applied in one pass over
everything (the product owner's instruction: *"Everything, one pass"*).
