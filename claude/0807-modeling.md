# 0807 — Modeling

**Status: DONE (engine).** No screens: they are 0809's. **Save change: v48 → v49.** Agent B's saves are now v50
and onward (`CLAIMS.md`). Six rungs from a test shoot to the face of a fashion house; a job is a day rate, days and a
usage fee; work comes by being seen, by going to castings, or through an agency that takes the most New York allows;
an age window; brand deals on the creators' own sponsor rules; a network backstage that brings actors and artists
closer; and an award.

Payton's answers (7 October 2026):

- **Core model:** rungs and bookings, like acting. A rung, jobs offered to a model who has been seen or applied for
  from six castings a year, Take / Ask for more / Pass.
- **Talent:** looks and charisma, **no new talent.** Craft is read off the character (looks 0.5, charisma 0.3,
  discipline 0.15, smarts 0.05). Nobody is "talented at modeling" in the way 0805 and 0806 read a talent.
- **Agency:** **helps, never required.** 20% commission (the New York Fashion Workers Act cap), more slots, better
  odds, better rungs, and more brand calls. A model can be offered work and can apply on their own.
- **Extras (all three):** an **age window**; **brand deals** reuse 0702's sponsor rules; **celebrity networking**.
  The extra Payton did **not** choose was a Modeling Agency business, so the catalog stays at **33** types.

## What changed in the engine

A character gains a modeling life, `GameState.modeling`, which is empty until the character shoots a portfolio, goes to
a casting, is asked for a job or signs. **A life that does none of these replays exactly as it did before** (draws are
hashes; no RNG stream is touched).

### The six rungs

| Rung | Name                       | From (age / jobs / craft / name) | Day rate        | Days | Usage fee | Hit line | Fame |
| ---- | -------------------------- | -------------------------------- | --------------- | ---- | --------- | -------- | ---- |
| 1    | Test shoots and local work | 14 / 0 / 0 / 0                   | $0–250          | 1–3  | 0         | 42       | 0    |
| 2    | Catalogue and e-commerce   | 16 / 0 / 28 / 0                  | $500–1,500      | 8–30 | 10%       | 52       | 2    |
| 3    | Commercial and print       | 18 / 4 / 40 / 5                  | $1,200–4,000    | 4–15 | 35%       | 58       | 6    |
| 4    | Runway and editorial       | 18 / 10 / 52 / 15                | $1,500–8,000    | 3–10 | 15%       | 64       | 15   |
| 5    | Campaigns for major brands | 18 / 20 / 72 / 35                | $6,000–30,000   | 3–8  | 90%       | 72       | 38   |
| 6    | The face of a house        | 18 / 40 / 86 / 60                | $30,000–150,000 | 4–12 | 150%      | 82       | 65   |

A job is a **day rate × days + a usage fee** (a share of the day-rate bill for the right to run the pictures). A rate is
quoted to $25, $100, $500 or $5,000 by size, a fee to $100, $1,000 or $10,000. Each job is the face of the work, a
featured spot or part of a group (fee 1 / 0.55 / 0.25, days 1 / 0.8 / 0.6), and the rung's mix sets which. A name that
is known pays up to 15% either side of the going rate. A year has **150 shoot days**; a job that would not fit is
refused ("Couldn't fit … The year was already full.").

### How work comes

- **Asked.** A model who has been seen (a portfolio sent round, or a job worked, in the last three years) is offered
  up to four jobs for the year to come: a few slots a year by the rung (0.5 and 0.2 at the first rung down to 0.6, 0.35
  and 0.1 at the top), scaled by a name (0.6 to 1.2), an agency (1.2, and one more slot at 40%) and age. Each is at
  the model's rung or one either side, 20% / 70% / 10% (agency 15% / 55% / 30%). A rung above is only offered if
  the model is ready for it and is at or under thirty.
- **Applied for.** Six castings a year are open to anyone from fourteen: the rung, one below, or one above if the
  model is ready. The chance is 80% / 55% / 28% by reach, plus craft, a name, an agency (12 points) and the placement.
  Three applications a year, five with an agency. A denial is a line and nothing else.
- **A portfolio.** Once a year from fourteen. It is how a model is _seen_ for the offers above. An adult on their own
  pays $900; a child's parents do. **Castings do not need it** (finding 134).
- **An agency.** From two credits. Takes 20%, always: the year's jobs and the brand money. **Never required.**

### Craft, hits and rising

Craft is 50 plus 2.4 times the distance of a weighted stat sum from 66.5 (looks run lower than the other stats, so the
centre is lower than acting's). It drifts toward what the character is plus the work (0.3 a credit, up to six points)
by a third of the gap up and a tenth down, never past the natural craft plus ten. A shoot's **performance** is the craft
plus a draw of ±15 against the rung's hit line: at or over the line is a hit (a name +3 and a rise toward the next rung
counted), more than 25 under is a flop. Two or more hits (three at the middle rungs, four at campaign) at a rung
move the model up if they are ready; three idle years in a row move them down one.

### Brand deals, the age window, the network

- **Brand deals** are 0702's rules with the model as a photo feed about fashion: Threadbare & Co., Muse Cosmetics,
  Linen Lane. Accept / Request more (65% for +60%) / Decline, a 1.5% trust cost on the following, paid with the next
  year's income. The agency's 20% comes off at settlement.
- **The age window** is three dials, not one: slots decay by 6% a year after 26 (floor 30%); no rung above is offered
  after thirty; and the looks stat itself ages, which moves craft. No job is refused for age.
- **The network.** A model with six jobs and not three idle years meets famous people 25% more often, and actors and
  artists are 1.5 times likelier to be the ones. There is a new scene line for it ("Backstage at a show…").
- **An award** (the fictional **Atelier Awards**) from the editorial rung up for a performance of 82 or better:
  Model of the Year, Best Runway Presence or Breakout Model of the Year by placement. +8 name, +6 mood.
- **Modeling for a living.** A year of $30,000 or more, lately, and the header says **Model**, day-job offers stop, and
  the year it becomes a living a held job ends with "Modeling is the living now. That was the end of the day job."

## Measured

40 lives per cell, played to fifty or death, from fourteen: every casting applied for (three a year, best odds first),
every offer taken, every brand deal accepted. "A living" is a year paying $30,000 or more at least once. Peaks are the
highest rung reached in the life.

| Policy                      | Test | Catalogue | Commercial | Editorial | Campaign | Face | Ever a living | Median lifetime pay | Top lifetime pay |
| --------------------------- | ---- | --------- | ---------- | --------- | -------- | ---- | ------------- | ------------------- | ---------------- |
| Castings only               | 6    | 8         | 11         | 10        | 3        | 2    | 26 of 40      | $593k               | $84M             |
| Portfolio and castings      | 6    | 8         | 11         | 10        | 3        | 2    | 26 of 40      | $606k               | $84M             |
| Portfolio, castings, agency | 6    | 10        | 10         | 9         | 3        | 2    | 33 of 40      | $1.28M              | $182M            |

By looks (a third of the lives each, portfolio and castings): the low third (looks about 32) averages a peak of
0.8 rungs and $169k, the middle (about 46) 1.9 rungs and $532k, the high (about 70) 3.4 rungs and $14.6M. **Looks
are the gate in practice, not the rule.** At 25, 17 of 39 lives are still at the first rung and 5 (one in eight) are at
campaign or above.

Most modeling careers are short and small, and a face of a house is one life in twenty. A living wage is likelier than
not for a committed model, which is generous (finding 131).

## Findings (roadmap 130–137)

130. **The ladder is a game ladder; only the median and the cap are real.** Real: BLS models May 2025 median $23.30 an
     hour ($48,470 a year), about 4,200 jobs, a −2% outlook, mostly part-time; the New York Fashion Workers Act caps
     an agency's commission at 20%. **Everything else is a game judgement:** the six thresholds, day rates, days,
     usage shares, the odds, the age curve, the brand pay and the $30,000 line for a living. Each is a named constant
     in `content/src/modeling.ts` and pinned in the tests, so a change is a decision.
131. **A living is likelier than not, which is generous.** 26 of 40 committed models have a $30,000 year (33 with an
     agency). Real modeling is mostly part-time with a median under $50,000. The dials are `MODEL_LIVING_WAGE`, the
     day rates and `MODEL_YEAR_DAYS`.
132. **Looks are the gate in practice.** Craft is read off the character, so the low third by looks peaks, on average, under the second rung (0.8) and
     the high third near the fourth (3.4). That follows from Payton's choice of looks and charisma, but
     nothing here lets a plain face earn a name another way. Dials: the craft centre (66.5) and slope (2.4).
133. **The first calibration left 35% of lives at craft 0–20.** The looks stat runs far below the others (median 57,
     p10 39, p90 70 at 26), so a weighted sum centred at acting's 72 put a third of lives under the first rung's bar.
     Re-centred at 66.5, the hit lines and bars lowered, and the agency softened (slots 0.4, multiplier 1.2, weights
     15 / 55 / 30). CORE_RULES 13.188.
134. **A casting does not need to have been seen.** A model who goes to a casting is judged on craft, name and odds only;
     the portfolio and the agency matter for _asked_ work. That is why "castings only" and "portfolio and castings"
     measure the same. If a portfolio should gate castings, it is a one-line check in `modelCalls`.
135. **Casting fallback differs from acting's.** When a rung's casting is above what the model is ready for, modeling
     takes the **highest ready rung**; 0805's takes the **lowest**. Modeling's is the one meant. 0805 is unchanged;
     decide whether to align it.
136. **Not modelled:** an agency contract term, the 45-day payment lag Fashion Workers Act caps, a model's body
     changing in the same job market, and the other half of the real industry (influencer-model crossover beyond the
     brand-deal channel). The brand deals use a pseudo-channel, not the player's own channel; a real Fashion channel
     gets a quarter of the people a model's work brings.
137. **Save v49.** 0807 took it for `modeling`. Agent B's saves are v50 and onward; the brief, `CLAIMS.md` and
     `HANDOFF.md` say so. Awards use a fictional ceremony.

## Files

- `content/src/modeling.ts` (new): `MODEL_TIERS`, `MODEL_TIER_ROWS` (the table above), the clients (five invented
  per rung), placements, `modelDayRate`, `modelJobDays`, `modelUsageFee`, `modelRoundRate`, `modelRoundFee`,
  `modelPlacementFor`, `naturalModelCraft`, `modelAgeScale`, `modelFameOf`, `modelReputationWord`, `MODEL_RISE_LINES`,
  the odds, slots, awards and the brand and network constants.
- `content/src/celebrity.ts`: a `'modeling'` network (acting and music fields), a `scene:modeling` pair of lines.
- `simulation/src/modeling-state.ts` (new): the saved types (`ModelingState`, `Job`, `BookedJob`, `EMPTY_MODELING`).
- `simulation/src/modeling.ts` (new): reading a model, offers and castings, the portfolio, the agency, answering an
  offer, brand deals, `runModelingYear`, `nextModelCraft`, `withModelAudience`, `makeModelJob`, `modelAskChance`.
- `simulation/src/game-state.ts`, `advance.ts`, `offers.ts`, `decide.ts`, `celebrity.ts`, `index.ts`: the field, the
  year (pay, the agency's share, tax on top of everything else earned, the portfolio, leaving a day job, mood, records,
  fame, header, the fashion channel), the day-job guard, the answer route, the network and exports.
- `persistence`: save v49, migration 48 to 49 (an empty model), validation of `modeling` and its jobs.
- `finance/src/summary.ts`, `tools/content-validator/validate.mjs`: `TICKET = '0807'`.
- `simulation/src/modeling-0807.test.ts` (new, 261 tests), `modeling-tax.test.ts` (new, 6 tests: modeling is taxed over a business, a channel, a pro contract, a part and a record, one at a time) and
  `modeling-mood.test.ts` (new, one test);
  `celebrity.test.ts` (both packages) and `persistence.test.ts` (four new tests, with the edge values of a name, a craft and a day's work).
- `specs/CORE_RULES.md` 13.188–13.191.

## Tests and sabotage

The modeling tests cover the six rungs and their real figures, a job's worth, craft, the age window, fame and the
words for a name, being seen, living, readiness, days, slots, the rung a draw lands on, an offer's decision, castings and
applying, the portfolio (who pays), the agency, answering an offer to the dollar, an empty year, booked-job pay, a name,
a mood and a following, rises and falls, an idle year, an award, brand deals (offers, answers, pay), the fashion channel,
the network, the wiring into `advanceYear` (ledger rows, tax over a day job, acting and music pay, a deal's tax, the
portfolio, a day job ending, offers stopping), and that a life that goes near none of it replays unchanged. The save
tests cover migration, a round trip and rejection of a bad model.

**Sabotage:** Every line of the new simulation and content code, the wiring in `advance.ts`, `decide.ts`, `game-state.ts`, `offers.ts`
and `celebrity.ts`, and the persistence validator were mutated (comparison and boundary flips, `&&`/`||`, `+`/`-`,
`*`/`/`, rounding and min/max swaps, off-by-one literals, dropped negations, and hand-written wiring mutants that remove
or redirect one wire at a time). The first full pass over 571 mutants left 76 survivors; they were closed by simplifying
code (a dead block, a dead `standard` input, two merged idle branches, shared rounders) and about fifty tests. The
final full pass (574 mutants in the modeling code, 51 wiring mutants, 95 persistence mutants) ended with **0 survivors
apart from 14 named equivalents**: the `<`/`<=` edge of a hash draw (the slot, delta, landed, ask and award draws, where
equality has probability zero) and the `<`/`<=` edge of a rounding step in `modelRoundRate`/`modelRoundFee` and the
placement bucket, where either side of the edge rounds to the same value. The last survivors were wiring (the tax base
terms, the living line, its kind, the records, fame, the game-state option, the answer route's error, the year handed
to the model's year) and five persistence edges (a day's work, a name and a craft of 0 and 100, a craft of 101); each
is now killed by a named test. No mutant was left unmatched.

## Open

Payton may want to move: how common a living is (131), looks being the gate (132), a portfolio not gating castings
(134), the casting fallback difference from acting (135), and the ladder's numbers (130), which are mine. Next is 0808
(and 0809 is the screens); neither is started.
