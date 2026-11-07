# November playtest — business controls and valuation

Follow-up to fame offers (PR #31). This pass makes the current business
decisions easier to compare, and makes recent performance count in a sale
or valuation. No save migration.

## Operating plan

The owned dashboard shows next year's estimated sales, costs, operating
profit, slower and busier scenarios, and unused capacity or unserved demand.
These use the production business-year model with the current market and
owner inputs. The typical scenario uses a zero demand shock; the other two
use −1 and +1. All three omit one-off events, financing and tax. They are
examples, not bounds on what can happen or a preview of any seeded rolls.
If all three profits match, the screen shows one figure instead of a
zero-width range.

Adjacent allowed price steps, hiring or letting one employee go, and the
pending supplier pitch show the typical profit and the difference from
today's plan. The preview uses the same validated choice as the button,
on a temporary state. It spends nothing and does not save. Brokerages
keep market prices, staffing limits still apply, and racing keeps its own
season model. Owner attention, annual shocks, and management rules have
not been retuned in this pass.

A mature café example with one initial team is constrained by capacity.
The typical projection is $42,343; one price step down is $26,759, one
step up is $57,928, and hiring is $62,389. The slower and busier scenarios
both reach the same capacity at the original settings. This is an example
from the production model, not a recommendation that every café raise
prices or hire.

## Broker's value

Three annual profits are weighted oldest-to-newest 1:2:3. With fewer years,
the prior average applies. A record with three positive years whose latest
profit is at least as high as the earlier two can earn two bounded premiums:
up to 20% for growth and 20% for reputation above 50. They are applied to
the existing industry multiple and reputation factor. A recent downturn
receives no such premium. If earnings value is low, the business is still
worth at least the fittings under the old asset rule.

Sample accounting firms have the same fittings, no cash included, and
reputation 85 unless noted:

| Profit history                | Old operating value | New operating value |
| ----------------------------- | ------------------: | ------------------: |
| $80k each year, reputation 50 |            $224,000 |            $224,000 |
| $80k each year, reputation 85 |            $247,520 |            $282,173 |
| $50k → $80k → $110k           |            $247,520 |            $373,136 |
| $110k → $80k → $50k           |            $247,520 |            $216,580 |
| $110k → $110k → −$50k         |            $175,327 |             $92,820 |

The same operating value feeds the appraisal, buyer, owned worth and
estate. Business cash is separate from the operating value; a buyer's
discount, broker fee and debt repayment remain distinct. The owned
appraisal explains which value basis was used and lists cash separately.
Seller listings use the same valuation; fixed-seed purchase fixtures
therefore show new asks and loan caps. Settlement checks still pin the
cash, debt, invested amount and property rows, and existing marketplace
tests check that buying and reselling immediately cannot profit.

Still open: live auction counterbids, performance across multiple
businesses/accounts, and advisor tiers and instrument questions.
