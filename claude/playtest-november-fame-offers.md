# November playtest — fame offers at the same score

This follow-up stacks on PR #30. At 30 fame, a national commission replaces
a starter photoshoot or commercial when that slot appears. Photo campaigns
cover taking and using the photos; brand commercials cover filming and ad
use. Both draw from distinct national outlet pools. Talk shows and guest
parts retain their roles and pay.

| Fame | Starter photo formula | National photo campaign | Starter commercial formula | National brand commercial |
| ---: | --------------------: | ----------------------: | -------------------------: | ------------------------: |
|   30 |                $1,510 |                  $4,500 |                     $3,010 |                    $9,000 |
|   32 |                $1,900 |                  $4,500 |                     $3,790 |                    $9,000 |
|   39 |                $4,250 |                  $6,380 |                     $8,500 |                   $11,480 |
|   60 |               $47,660 |                 $59,660 |                    $95,320 |                  $115,320 |

The new minimums are $4,500 and $9,000. Above the minimum, a campaign adds
50% of the ordinary photo fee or 35% of the ordinary commercial fee,
rounded to $10 and capped at $12,000 and $20,000 respectively. These are
game balance choices for a broader commission, not claims about real-world
market rates. At 30 fame, the two existing offer chances are 59% and 53%:
expected gross income from accepting every available one rises from
about $2,486 to $7,425 per year, before tax or representation fees.

No new offer slot or chance change. Taking starter work before crossing
the threshold still uses that slot for the year. Quotes are captured on
acceptance and settle once via the existing income and tax path. The
booked outlet identifies the commission in the result, in Done this year
and in settlement; older bookings keep their original title and pay.
No save bump.

Tests cover the same-score comparison, the cutoff, the premium caps, a
change of fame after acceptance, the actual paid row and second-year
nonpayment, and the action and screen labels. The stacked music holdout
fixture also has an explicit GameState type to make the prior branch's
typecheck reliable.
