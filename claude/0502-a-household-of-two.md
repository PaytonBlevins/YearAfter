# Ticket 0502 — a household of two

Roadmap finding 9, recommended ahead of the rest of v0.05 because every
ownership ticket after 0501 is priced against what a household earns.

## Measured first: a partner made you poorer

150 played lives, answering every question, before this ticket:

| age   | with a partner |     | without  |
| ----- | -------------- | --- | -------- |
| 25–34 | $2,000         |     | $44,000  |
| 35–44 | $2,900         |     | $108,000 |
| 45–54 | $12,500        |     | $68,000  |
| 55–64 | $32,000        |     | $91,000  |

(median net worth)

A partner added half again to what the household cost (`PARTNER_SHARE`, since 0303) and brought nothing in. Somebody with a partner was strictly poorer than
somebody without one at every working age. Two in three partnered years at
45–54 rented. In the world it runs the other way: two incomes are most of why
couples own homes.

There was a second, smaller fault underneath. **Somebody who was only dating
paid for a household of two.** The living phase charged for any partner at all,
including someone the character had just started seeing.

## What changed

**A partner works** (`careers/partner.ts`). Each partner has an earning power
fixed for life: median $52,000 at their peak, about $29,000 at p10 and $92,000
at p90. It follows the ordinary age–earnings curve. In most years they're
working; with a child under six at home it's less likely, and the people who
step out are always the same ones. Being in or out of work comes in three-year
stretches, not coin flips. They retire between 62 and 67 on about 40% of what
they earned. Their pay goes into the ledger under their name as a new
`partner` category, with the tax on it as an ordinary `tax` row. It's all
derived from the partner's id, age and the year, so there's no new save field
and no migration. A partner who leaves or dies takes their income with them.

**Only a partner you live with shares the household.** "Together", "engaged"
and "married" share a roof, its costs and their income. "Seeing" shares none of
it (`householdPartnerOf`).

**A household spends like a household.** This is the part that turned out to
matter most. The standard of living follows income, and the bill is that
standard times the size of the household. Once a partner's pay was in the
income, the household got counted twice. Couples on $87,000 ran up bills of
$95,000, fell into the hardship cliff, and climbed back out to do it again. The
standard is now set from income per household member: the ordinary equivalence
scale. A single person is untouched. New rule **13.87**.

**And that exposed a 0501 constant.** `OWNER_SHARE` was 0.45, which said the
roof was more than half of what a renting household spends. It had been
balancing the overspend above: once that was fixed, the median 65–74-year-old
was worth $722,000. Shelter is nearer a quarter to a third of US household
spending, so it's now 0.7. With the roof a realistic size, a first home almost
always costs more than the rent it replaces, so the home offer now reaches
people whose owning costs are up to 1.5× their roof (was 1.0). The lender's
43% ceiling still applies. New rule **13.88**.

**On screen:** the Person screen for somebody you live with says whether
they're working, not working or retired, and what that brings in a year. The
Finances screen's income already includes it.

## Results

Two disjoint sets of 150 lives (median net worth, all characters):

| age   | after             | US (SCF 2022)       |
| ----- | ----------------- | ------------------- |
| 25–34 | $41,000–$46,000   | ~$39,000 (under 35) |
| 35–44 | $85,000–$103,000  | ~$135,000           |
| 45–54 | $178,000–$197,000 | ~$247,000           |
| 55–64 | $294,000–$331,000 | ~$364,000           |
| 65–74 | $379,000–$415,000 | ~$410,000           |
| 75+   | ~$500,000         | ~$335,000           |

|                                                  | before         | after             |
| ------------------------------------------------ | -------------- | ----------------- |
| partnered ÷ single, median net worth at 55–64    | 0.18–0.35      | 0.98–1.04         |
| partnered median net worth at 55–64              | $34,000        | $275,000–$352,000 |
| partnered years at 45–54 owning a home           | ~21% (pay off) | 65–72%            |
| working-age partnered years with a partner's pay | 0%             | 77–79%            |

Home ownership by age now reads about 10% / 40% / 64% / 77% / 81% / 85% across
25–34 / 35–44 / 45–54 / 55–64 / 65–74 / 75+. The US figures are about 37% / 62%
/ 70% / 76% / 79% / 79%. Older ages match. **Young ownership is still low**,
logged as a finding below. Short years stay around 1%.

## Tests

- `careers/partner.test.ts` (7): earning power spread, determinism, the
  baby effect and who it hits, three-year stretches, tax and pension,
  retirement ages, nothing for a minor.
- `social/romance.test.ts` (+1): a date isn't a household.
- `simulation/household.test.ts` (7): the population claims above; a date
  costs nothing (same household a year on, seeing vs single, identical living
  bill); the books reconcile; the pay and its tax are posted under the
  partner's name; income stops when the partner is gone.
- `simulation/living-household.test.ts` (3): a settled household of any shape
  spends less than it takes home; a family still costs more than a person;
  two incomes live better than one.
- `simulation/homes.test.ts` (+1): owning a home isn't a fortune (median net
  worth at 65–74 under $550,000; measured $342,000–$415,000, $659,000–$722,000
  with the old roof share).

Two existing tests moved, each with the reason in place:

- `careers.test.ts`'s upper bound on cash at fifty went from $250,000 to
  $400,000. Its harness works harder every year; with a partner's pay that
  household's median went from $145,000 to $275,000.
- `investing.test.ts`'s net-worth formula now includes homes. It had left them
  out since 0501, and a sample that now owns one found it.

Sabotage-verified: each piece was switched off or put back the old way, and a
test failed every time. That covers partner income off, dates sharing a
household, the standard left un-equivalised, partner income left out of
living, `householdPartnerOf` returning any partner, no baby effect, no tax on
the partner's pay, and `OWNER_SHARE` back to 0.45.

**Full gate: 1,074 tests across 70 files, typecheck clean, validator green.**

## Renumbered

Rental property moves from 0502 to 0503, and the rest of v0.05 shifts by one:
0504 vehicles, 0505 modifications, 0506 renovations and collections, 0507
auctions, 0508 Will & Estate. The Ownership screen's placeholder rows were
relabelled to match.

## Still rough

- **Young ownership is low** (10% at 25–34 against about 37%). The door asks
  30% of eligible renters a year and the deposit is the binding constraint.
  Worth a look once rentals exist.
- **Partners' earnings are too narrow and too fixed** — roadmap finding 16,
  flagged by Payton to return to: one earning power for life around a $52,000
  peak is not how real life is. Real partners run from about $20,000 to
  $250,000+, some change jobs and their pay moves, some keep the same work for
  a whole career.
- **Nobody spends down in old age.** Median net worth keeps rising past 75
  ($500,000 against about $335,000). The standard of living doesn't respond to
  a shorter horizon.
- **No assortative matching.** A partner's earning power is independent of the
  player's. In the world they correlate at about 0.3–0.4. (Finding 13, flagged
  to return to.)
- **A partner's death leaves no estate to the player** beyond the pooled cash.
  Belongs in 0508.

## Later follow-ups

0503 rentals now exist; no later young-ownership recalibration is recorded
here, so finding 11 remains open. The partner-earnings and old-age findings
remain decisions for Payton/Agent A, and 0508 Will & Estate is still deferred.
