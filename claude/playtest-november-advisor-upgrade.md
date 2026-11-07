# November playtest — advisor tiers and investment questions

Note 15. No save migration. The player can search by name, ticker or asset
class under Advice, then ask the hired advisor about a particular stock,
fund, bond, coin or penny stock. The answer is Buy, Hold, Reduce or Sell with
a reason. It never places a trade. Risk answers use the actual holdings;
bonds show their coupon and term. The free tier discusses risk without price
forecasts. The paid tiers can use the same stock and fund trend signal as
their unsolicited advice. Crypto and penny stocks do not get trend forecasts.

Portfolio advice previously allowed another 15% of remaining spare cash
each time. This update shares a yearly budget across advisor purchases and
reinvestment. The base is current cash plus actual purchases already made
through advice that year, less the bills reserve and purchase goal. New cash
can increase it, spending or increasing the goal can decrease it, and no
purchase can use cash inside the reserve. Executed purchases are counted
from their ledger rows, so switching advisors and reloading cannot reset
the budget. Manual purchases remain under the player's control; earlier
builds did not tag advisor purchases, so those old rows are not counted.

| Tier           | Minimum invested | Annual fee | What it adds                                                      |
| -------------- | ---------------: | ---------: | ----------------------------------------------------------------- |
| Bank planner   |               $0 |       Free | Cash and portfolio risk review                                    |
| Independent    |          $10,000 |       0.2% | Stock and fund trend calls; stricter risk review                  |
| Private wealth |         $250,000 |       0.4% | Tighter sector and speculative limits; up to four recommendations |

At $250,000 invested, the independent and private tiers cost $500 and $1,000
respectively. Across the same 40 seeded 12-year histories, the replay scored
163 of 236 independent buy calls and 164 of 239 private buy calls as right.
That is roughly 69% for both, before fees; it is a replay of buy signals,
not a portfolio return or evidence that the higher fee buys better picks.
The screen compares fees and replay history before the player confirms a hire
or switch.
