# November playtest — live auction counterbids

Follow-up to business controls (PR #32). The previous screen asked for a
maximum once and immediately resolved the lot. The venue now quotes an
opening bid, then shows each rival counter and the next raise. Passing
closes that lot without charging anything. A counter does not reserve cash,
increase card balances, or grant the lot. A win charges the quoted hammer
plus the venue's premium via the existing cash/card purchase path.

The opening is 60% of the low estimate, rounded to a whole dollar with a
$1 minimum. The player's next raise is one step (6% of the low estimate,
minimum $1) above the rival's shown bid. The rival starts at the same step
and can skip ahead farther in later rounds, up to the same seeded room
ceiling used before. This keeps a contested lot moving without making the
player's own raise grow. The final payment is the player's accepted bid,
not a hidden ceiling. Storage salvage credits are still separate from
the purchase charge.

Each visit now fixes the catalogue's buying-power limit, so cash or
credit changes cannot swap the item under a live bid. An open counter
survives reload and can be reopened on the venue screen. You can bid on
another lot or leave the screen; the next sale at that venue waits until
its open lots are won or passed. Next year starts a new diary. An older
save can still use its current visit; the catalogue locks when it first
bids live. The two optional diary fields are validated and old diaries
still load at v58.

The bid token pins the lot identity, round and hammer quote. Payment
also checks the expected total and current cash or available credit.
A stale or repeated confirmation cannot accept a higher bid or buy
the same lot twice. The old proxy bid command is kept for historical
balance callers and cannot close a lot currently in live bidding.

## Playtest measurement

Across 150 deterministic visits per venue, with every tested lot
affordable under the old maximum-bid rule, both strategies had the same
old Determined hammer limit. The live strategy passed if its next
quoted hammer exceeded the limit. Each lot was evaluated independently.

| Venue            | Lots | Old wins | Live wins | Two or more counters | Most counters | Median winning hammer above old room price |
| ---------------- | ---: | -------: | --------: | -------------------: | ------------: | -----------------------------------------: |
| Hartwell & Finch |  743 |      439 |       407 |                  741 |             5 |                                       4.8% |
| Storage          |  450 |      349 |       336 |                  420 |             5 |                                       5.1% |

All measured live wins reconcile. The small rise in hammer comes from
having to beat the counter by a visible increment; some lots therefore
go over the old limit. No premium rate or attendance limit changed.

Tests cover multiple counters, exact cash and card wins, no movement
on counters or passes, stale and unaffordable raises, frozen lot identity,
and the actual mobile store and save/load path. Native device checks
remain open.
