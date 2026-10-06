# Ticket 0303 — Living Expenses

**Spec 191–193:** *"Remove selectable lifestyle levels. Living costs are
automatically calculated from location, household size, wealth/income, housing
circumstances, family circumstances… Lifestyle creep may occur implicitly as
wealth rises."*

Save **v19**. `pnpm install` needed — this one adds a workspace dependency.

---

## The measurement that shaped the ticket

Taken before anything was built, across 120 lives:

> **A character who never takes a job is charged nothing, for their whole life.**
> 6,357 adult years, none of them costed. They hold $100 at thirty, $100 at
> fifty and $100 the day they die.

0210 shipped `livingCostOf` as a labelled placeholder that took a **share of
after-tax pay**. It solved the problem it was built for — a salary compounding
into a fortune — and it had one structural consequence nobody had looked for:
the cost of living was attached to the **paycheck**, not to the **life**. So
unemployment was free, retirement was free, and living off savings was free.

It also meant four of the five inputs the spec names could not possibly matter.
Location, housing, wealth and family circumstances have no way to reach a number
defined as a percentage of a wage. The model had one input wearing the name of
five.

That became **CORE_RULES 13.43 — a cost attached to income is not a cost, it is
a deduction.**

---

## What shipped

```
cost = standard × location × household × housing
```

A number of dollars, charged every adult year, whether or not anybody was paid.

| Term | Spec input | Notes |
|---|---|---|
| `standard` | wealth/income | What they're used to spending. **Creeps up fast (0.34/yr) and down slow (0.12/yr)** — the memory is the feature |
| `location` | location | Cost index on all 107 cities |
| `household` | household size | OECD-ish equivalence scale: 1 + 0.5 partner + 0.3/child |
| `housing` | housing circumstances | At home vs. paying for a roof — the largest single term |

**`livingCostOf` and `livingShare` are deleted**, as 0210 promised they would be
rather than being kept alongside (CORE_RULES 13.8). `payBreakdown` lost `living`
and `saved`; employment now reports what the job paid and what tax took, and the
new ninth phase charges the household.

**The standard had to become saved state.** A number recomputed from this year's
income has no memory, and the memory is what makes losing a job hurt: the lease
is signed and the habits are set, so costs carry on at nearly the old size while
nothing is coming in.

### Everything else the ticket owed

- **A cost index for all 107 cities.** US cities get real relative numbers
  (San Francisco 1.68, Memphis 0.86); everywhere else sits in a narrower band,
  because every salary and price in the build is US-benchmarked and a true index
  would hand a character a US wage against a fifth of a US cost. Triple-enforced:
  generator self-check, validator **V19**, package test — including that the
  spread is real, since a catalog where every city cost 1.00 would pass every
  other check and mean location does not exist.
- **0209's `kicked-you-out` finally does something.** It had written five
  sentences about being put out of the house and changed nothing for four
  tickets — CORE_RULES 13.36 from the other side, an *event* that writes no
  state. It moves you out now, and can only fire on somebody who actually lives
  at home.
- **Treatment has a price**, the debt 0211 took on explicitly. Anchored to
  subsistence rather than typed out of the air, charged yearly while treatment
  runs. Measured: **39% of characters can't cover the first year.** They're
  treated anyway and carry a `shortfall` — which is what 0307 will lend against.
- **Hardship.** A household that cannot pay contracts: the standard drops to
  subsistence at once, they move back to family if there is family, and if there
  is still not enough they live on what they have. Without it, the first version
  had the jobless in shortfall in 5,789 of 5,789 adult years.

---

## Four bugs, three of mine

### 13.44 — a threshold with no hysteresis will oscillate

Found by **reading a played life**, not by any test. One character moved out at
eighteen, was told to leave again at twenty-six and again at twenty-nine, and
moved house four times. Measured across ninety lives: **86 of 154 housing
changes happened one year after the previous one**, and one character moved
fifteen times.

The loop, once seen: they move out because savings cover a year → the standard
creeps toward their income → the year goes short → hardship moves them home and
resets the standard → subsistence is affordable → they move straight back out.
Every step correct, the system nonsense.

Fixed by testing the **sticky** quantity rather than the volatile one —
affordability asks about income, not income plus savings, because savings can
pay for a move but not for a life — plus `movedBackAt`, which holds the door
shut for two years regardless of the arithmetic. Now 81 of 90 lives change at
most once, and 2 of 20 changes are within a year.

### Rent was being charged before tax

The living phase was spread into the year's postings at the front, which put
rent ahead of tax among the outgoings. A broke character paid the landlord out
of money the government was going to take, tax floored to zero, and one measured
life came out of forty years having paid **$1.6 million of salary and no tax at
all**. The books balanced perfectly — every shortfall was recorded — which is
exactly why it needed a test that looked at what the categories came to rather
than whether they added up.

### `post` wrote a $0 row for every unpayable charge

Never surfaced before, because living costs were a share of pay and there was
always pay to take them from. Charging a household regardless produced 47 zero
rows in one measured life. A charge that moved nothing is not a transaction —
the `shortfall` row already says more than a zero could.

### "$0 is what even looks like"

Caught by the careers invariant test. Exactly-nothing-left is common now
(hardship spends what there is, to the dollar) and the tight-year copy was
written for "$300 left, which isn't much". It has its own five lines.

---

## Where the numbers landed

| | before 0303 | after |
|---|---|---|
| Cash at 40 (works at it) | $65,936 | $101,059 |
| Cash at death | $372,342 | ~$296,000 |
| Adult years never charged | 2.0% | 0% |
| A jobless life's cash at 30/50/death | $100 / $100 / $100 | $0, and spent |
| Shortfall years | 0% | 0% (hardship contracts instead) |
| Median age moved out | — | 19 (p90 41) |
| Adult years living at parents' | — | 14% |

`MARGINAL_SPEND` and `TAPER_SPEND` were swept over three settings and tuned to
0.84 / 0.60 — the same discipline as CORE_RULES 13.25, against the population
the build actually makes.

## Follow-on

- **A jobless adult has no income at all, ever.** No benefits, no odd work, no
  partner's earnings — so they sit at exactly $0 for sixty years. Flat for a
  better reason than before, but still flat.
- **Money does not reach the stress model.** Being broke costs a character
  nothing but money.
- **Accumulation still runs late**: most of a lifetime's balance appears after
  forty, because there is no house, no retirement and no investments to absorb
  it. v0.05, 0308 and 0310 are where that goes.
- **`currentLocation` is still written once at birth and never again.** Nobody
  ever moves city. Location varies across characters and not within a life.
- `UNWRITTEN_CATEGORIES` still lists five; `housing` and `vehicle` become real
  in v0.05.
