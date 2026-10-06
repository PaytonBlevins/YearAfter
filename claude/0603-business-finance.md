# 0603 — Business finance

**Status: DONE (3 October 2026). No save bump (v39).** Third ticket of v0.06.
Spec 954, 1372, 1392, 1689, 1857.

## What it does

**Business loans, the type spec 1857 lists and 0307 left open.** Two products:

|                                 | Small Business Loan                     | Commercial Term Loan                                     |
| ------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| lender, rate, term              | Redwood Community Bank, 8.75%, 10 years | Ashcroft Commercial, 7.25%, 10 years                     |
| credit needed                   | fair                                    | good                                                     |
| most it will ever lend          | $750,000                                | $15,000,000                                              |
| share of the price it will lend | 70% to open, 80% to add a door or buy   | 80% to add a door, 75% to buy; **will not lend to open** |

The Commercial loan is cheaper because it lends against earnings, and a
business not yet opened has none. That is the one line between the two.

**It is never cash.** It is offered at the moment of a purchase (opening a
business, opening another door of one, buying one that exists) and written
straight into that purchase: booked as borrowed and spent in the same breath,
so the balance never rises. The Loans screen says so, and `applyForLoan`
refuses a business product outright, so the control is in the engine and not
in a screen choosing not to show it. Without that, 7–9% money up to $15 million
that a player could put in a portfolio would be the cheapest credit in the
game by a distance, and spec 954 says to prevent circular credit and loan
exploits. See CORE_RULES 13.96.

**What they lend on.** Not wages alone (a startup has none) and not collateral
alone (that is `wealthPrivate`). A lender asks whether the owner and the
business can pay it back:

- a share of the price, so the owner has something in it; and
- a yearly payment no bigger than **half of** wages, commission and a
  partner's pay, **plus** what the businesses already owned clear (the last
  three years' profit, each counted no lower than nothing), **plus** what the
  business being bought clears on its seller's books, **less** every payment
  already committed (loans, mortgages, cars).

That second bound is the scale limit. A clerk cannot leverage into a trucking
company, and anybody who has built something that earns can borrow for the
next step. Spec 1372's "do not cap business size" holds; nothing here caps how
big anyone may become, only how fast what they earn lets them go.

One business, one loan: a second purchase for the same business (another
door) tops the first up, as a student loan does, and the lender cannot be
changed halfway. Business loans do not count toward the four loans a person
may hold, and are not weighed against a salary in credit standing or in how
much more somebody can borrow personally, for the reason a mortgage is not.

**The business pays its own loan.** See _What broke_, below. Each year the
business pays interest and a year of principal out of its till (and this
year's profit) before the owner is paid anything. The draw is what is left, so
a loan makes an owner's year smaller and the tax on it smaller too. If the
till cannot cover it the owner steps in for the shortfall, as they do for a
loss, because they signed for it. If they cannot either, the loan falls behind
and grows. If the business goes under, the loan stays and becomes the
person's, paid from their own money like any other.

**Buying a business that already runs.** Four are for sale each year, from the
same net-worth gate as opening (cheaper kinds come up more often). Each shows
its age, doors, reputation, the seller's last three years of profit, its crew,
how much is in the till, and an appraiser's range. The same four are there
however often anybody looks; next year, four different ones.

Four things stop buying from being a shortcut to a bigger business, and each
has a test that fails without it:

1. **It asks more than it is worth.** Never less than 8% over what the same
   formula values it at; usually 10–28%. The measured median is 1.06–1.16
   times worth, till included.
2. **The books are the seller's.** The last three years of profit are polished
   by up to a fifth, mostly by nothing (the polish is cubed, so half-way along
   the dial is 2.5%). What the business earns from here is what the engine
   says it earns, so a dressed-up set of books is an overpayment found out in
   the second year. Lenders read the same books.
3. **A change of hands.** Reputation drops four points and rebuilds. Four was
   chosen from eight: eight cost a third of the first year's profit (margins
   magnify demand), which was punishing to the point of making buying pointless.
4. **A buyer's offer is capped at two and a half standard deviations of
   haggling.** Unclamped, by the arithmetic about one draw in a hundred and
   fifty put a buyer's offer above what a seller had asked. With the cap, buying and selling the same
   business in the same year loses money on every draw, which a test walks
   through at z = 2.5, 4 and 100 for every one of the thirty-one types.

**Getting out with a lender to pay.** A sale or a wind-down pays the bank
first, out of the proceeds; the owner gets what is left. A loan bigger than
the proceeds takes the whole of them and leaves the rest owed. So does a death:
the estate sells a business as it always has, and what is owed on it comes out
of what the heir is handed. (Without it, borrowing to buy and then dying would
have wiped the debt and left the heir the whole business. Debts of every other
kind are still dropped at a death, as before; that is 0508's.)

## Calibration

### What is for sale (finance only, 200 draws a type)

|                                                                       | range across the 31 types |
| --------------------------------------------------------------------- | ------------------------- |
| asking price against what the formula says it is worth, till included | 1.06–1.16                 |
| seller's reported profit as a share of the asking price               | 10–28%                    |
| years to pay back at reported profit                                  | 3.5–10                    |
| first year's profit under the buyer against reported                  | 0.82–0.92                 |

At the top end the hotel and the resort pay back in nine and ten years; the
small trades (cleaning, law, salon, accounting) in three to five.

### What a financed purchase does to a life (eight lives, bought at thirty-five)

Net worth at fifty-five, in dollars. _Control_: never buys. _One_: buys the
best-yielding business it can afford, at thirty-five, with the largest loan on
offer. _Chain_: does that and buys again each time there is room, up to three.

| life | control | one                  | chain                                             |
| ---- | ------- | -------------------- | ------------------------------------------------- |
| 0    | 162,026 | 340,451              | 543,209                                           |
| 2    | 678,339 | 759,178              | 943,798                                           |
| 3    | 362,712 | 443,358              | **−298,361** (17 years behind, one business lost) |
| 4    | 76,206  | 483,356              | 813,722                                           |
| 5    | 312,218 | 384,706              | 294,982                                           |
| 7    | 307,933 | (nothing affordable) | 232,343 (one lost)                                |
| 8    | 41,286  | (nothing affordable) | 218,007 (two lost)                                |
| 9    | 343,856 | 304,860              | 384,290 (two lost)                                |

Five of the six lives that could buy one did better for it; the chain beat the
control in five of eight, lost to it in three, and in one went deeply negative.
That is what spec 949 asks for: deliberate play can reach a million, and
reaching for it can go wrong. Nothing here prints money. What caps the climb is
that nobody holds more than three businesses and four doors each, that every
purchase costs 8–28% over its worth and four points of reputation, and that
the lender bounds a loan by what can pay it back.

### What broke, and why it was found

The first version passed every test and failed this table. The loan was
serviced out of the owner's wages, as every other loan in the game is, while
the business sat on a full till. A typical financed purchase put the owner in
arrears for **eleven to twenty-four of the next twenty years** and the balance
climbed to the two-times ceiling; at forty-five, owners were as much as
$335,000 below the control. Nothing about the approval
maths was wrong. Moving the payer (the business pays, the owner steps in for a
shortfall) took the same lives from −$129,980 to +$387,857 at forty-five and
removed the arrears. CORE_RULES 13.97.

## Not done, and why

- **Private Lending Firm.** 0602 said this arrives with 0603. 0603 built
  lending _to_ a business, not a business that lends: its income is interest on
  a book of loans that go bad, which is not the demand-and-capacity shape
  every type here shares, and it is the same kind of thing as an Investment
  Firm (capital put to work, with a risk of losing it). 0605 subsequently built private deals rather than either business type.
  Both remain unbuilt; 0605b is a proposal if wanted, not an approved ticket.
  Thirty-one of spec 396's thirty-seven are built; six still wait on those
  lending/investment businesses, v0.08 and gambling.
- **No tax-loss offset against salary.** The business pays interest out of its till
  before the draw, which lowers the taxable draw, so it is deductible in effect;
  but no tax-loss offset against a salary exists (0601's gap), so a business
  that loses money after interest does not reduce the tax on a job.
- **A negotiation.** The price is the price. Spec 1392 asks for no scale
  exploit, and a haggling game is a place for one.
- **An heir who keeps the business running** was 0604's, and is built there:
  an adult heir takes it with its lender; a child's inheritance is still sold,
  with the lender paid first.
- **Competition and events** were 0604's, and are built there (finding 37 got a
  cause, not a smaller swing).

## Findings added

37, 38 and 39 in the roadmap: a mature business's profit swings too much with
no event to explain it; the smallest businesses earn many times what they cost
to start; and the home lender still reads `incomeOf` where the business and car
lenders do not.

## Tests

`finance/business-finance.test.ts` (24, new), `simulation/business-finance.test.ts`
(25, new), `persistence` +1, `finance/loans.test.ts` two guards updated (the
not-built list is now empty). The simulation's earlier 466 and the finance's
265 pass unchanged.

**Thirty-eight sabotages, one passed first time** (a test of clearing one
business loan did not check that a second business's loan of the same product
survived). Every other mutation was caught the first time: the shut door, the
cover share, obligations ignored, each share of cost, the credit check, the
second lender, the ask premium, the haggle cap, the change of hands, the
polish and its skew, the till, the basis, a loan never recorded, a lender not
paid on exit, the business not paying from its till, the owner never stepping
in, a loan serviced twice, a bought business staying for sale, buying without
money, the dashboard loan, a sale read as earnings, a loss that subtracts, an
orphaned loan nobody pays, a business loan counted against credit, paying
the wrong business's loan, and a death that wipes the debt.

One bug the tests found on the way and the code did not: `0.7 × 45,000` is
`31499.999999999996`, so a loan floored to the hundred came out $100 under the
share on exactly the round prices a player reads off the screen. CORE_RULES
13.98.
