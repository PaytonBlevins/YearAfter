# 0704 — Collaborations, creator groups, a manager or an agent

**Status: ENGINE DONE. No screens yet (v0.07 screens are not assigned).**
No save version change: `group` and `collabs` are optional fields on a channel and
`representation` is an optional field on the save, so a v41 save loads as it is.
Heirs start with none of it, like channels and fame.

## What it adds

1. **Collaborations.** Up to two offers a channel a year to appear with somebody:
   a friend (free), a creator your size (a swap, free), or a bigger name (they
   charge). Taking one brings people over now and is remembered, so the same
   person works half as well the second time.
2. **Creator groups.** A house, a team, a group or a network signs a channel that
   is already paying its way, for 10, 20 or 30% of what the channel earns. In
   return the channel grows faster, brands call more, and the group's own people
   guest for nothing. You can leave.
3. **A manager or an agent, never both.** Whoever takes you on needs a channel that
   has reached its platform's paying threshold. A manager takes 15% of everything,
   grows every channel 20% faster and gives back 30% of the week. An agent takes
   10% of each deal, makes deals pay 10% more, brings about 30% more of them and
   takes 30% off what strangers charge to collaborate.

## Measured first

- **Collaborations** (YouTube data in the comments of `finance/collaborations.ts`):
  collaborations raised subscriber gains by about 30% and a collaboration video's
  views by about a third; the effect is large under 10,000 subscribers, small by
  100,000 and negligible past that. Channels that collaborate work with the same
  partner 2.3 times on average, so a repeat is a repeat (spec 1396).
- **Representation:** a manager's usual take is 15–20% of gross; an agent's, 10–20%
  of the deals they land. Podcast networks keep about 30%; multi-channel networks
  10–40%.
- **Not found:** what a stranger charges to appear (no usable fee data), and any
  figure for how much faster a manager or a group makes a channel grow. Those are
  judgements. See findings 59 and 62.

## Design

- **Collaboration offers** (`collabOffersFor`). Two slots a channel a year, each
  happening half the time, from 100 followers up. A slot is a friend 35% of the time
  when the character has friends (a friend has a following of their own, from 100 to
  50,000, drawn once per friend), otherwise one of six strangers who keep coming
  round, each 0.3 to 5 times the channel's size. Derived from the seed, the year and
  the channel; only the answer and the repeat count are saved.
  - **What it brings:** `min(partner × 4%, channel × 35%) × reach × 0.5^repeats`.
    Reach is all of it to 10,000 followers, a third at 100,000 and a fifth at a
    million (`1 ÷ (1 + 2·log10(audience ÷ 10,000))`). Under 5 people is not offered.
  - **What it costs:** nothing from a friend, from anyone up to 1.5 times your size,
    or from anyone in your group. A bigger stranger charges $0.015 a follower of
    theirs, never under $25, and 30% less with an agent. Paid in cash at once as a
    `spending` row (not deductible, like 0701's start-up cost), refused if you
    cannot afford it.
- **Groups** (`groupOfferFor`). A channel at three times its platform's paying
  threshold is wanted 35% of the time a year; the group's kind follows the platform
  (video group, stream team, podcast network, photo and short-form house;
  subscriptions have none). Joining makes it part of the channel. It takes its cut
  of that channel's income as a negative `creator` row, so it comes off what is
  taxed. Growth is `1 + 1.3 × cut` (a 20% cut is 26% faster) and brand interest
  rises 15 points.
- **Manager and agent** (`hireRepresentation`, `dropRepresentation`). Needs one
  channel at its threshold. A manager's share is one negative `creator` row, 15% of
  the year's gross; their hours effect reaches the stress model through
  `creatorWeek` (36 hours a week of heavy channels is 25.2). An agent's share is
  taken off each deal when you accept it, so the line and the ledger show the pay in
  full and the owed amount net of the agent. What an agent has already taken stays
  taken if you let them go.
- **Timeline lines** for every answer, hire, drop and leave, with the figures in
  them.

## Measured after

Six years, 3,000 channels a case, quality 0.8, the group or manager in place from
the start (this skips the entry rule, so it measures the effect and not the odds of
getting in). Mean net income after every share and cost, dollars; median final
audience.

| Video / gaming | Mean net | Median final audience |
| -------------- | -------- | --------------------- |
| Nothing        | 2,947    | 96                    |
| Manager        | 3,050    | 115                   |
| Group, 10%     | 3,032    | 109                   |
| Group, 20%     | 3,010    | 122                   |
| Group, 30%     | 2,887    | 134                   |
| Manager + 30%  | 2,690    | 161                   |

Photo / lifestyle: nothing 8,735, manager 9,077, group 10% 8,997, 20% 9,005, 30%
8,757. Podcast and streaming give the same shape at lower levels. A manager is
worth about 4% more money than nothing and a third of the week; a group is about
money-neutral at 10–20% and costs money at 30%, so it is worth it for the audience
(+40% median at 30%) and the brand calls, not the arithmetic.

An agent only matters for deals. Accepting every offer a year at 100,000 followers,
an agent adds about 5% of the channel's income on video, 7% on streaming, 11% on
podcasts, 14% on photo and 24% on short-form. So the agent beats the manager on
money almost everywhere a deal exists, and the manager beats the agent on time and
reach. The trade is real; neither is a free win. See finding 61.

## The one test for each reader of a new rule (13.113 again)

Every share is a negative `creator` row, so nothing that already reads `creator`
income (tax, the household, the summary) needed to change. The manager's hours
reach stress through `creatorWeek`. The agent's cut is not a ledger row at all: it
is netted from `owed`, which is paid with the year's income as before.

## Tests

- `finance/collaborations.test.ts` (31): reach, gain, repeat fade, the fee and its
  edge, the audience floor, offer rate, friend share, friends free at any size, the
  stranger pool and size range, groups free, agent discount, answers.
- `finance/groups.test.ts` (30): who a group wants and how often, kinds and names,
  boost, share, interest, join, leave, neutral-money check, the boost in the growth
  target, manager and agent rules and arithmetic, hours, the agent's effect on deals.
- `simulation/network.test.ts` (37): friends, every answer and refusal for each
  of the three, two channels, a year with a manager and with a group, hours, heirs.
- `persistence.test.ts` (+3): group and collabs, representation round trip, a
  corrupt representation refused.

## Sabotage

127 mutations. 94 caught first time; 31 survived and 2 patterns did not match (both then survived). Fixed: thirteen constants were
asserted against themselves (13.120); a manager's growth was never checked (the
year only compared against an `>=`); declining a paid collaboration was never tried
with a paid one; the agent's offer list was never compared with the finance
function's; the hours effect was hidden behind money (13.122, extracted
`creatorWeek`); the minimum useful gain was extracted (`worthCollab`) to test its
edge; a dead floor on a stranger's size was removed. One real bug was found by the
round-trip test, not the mutation pass: `createGameState` dropped `representation`
(13.121). One equivalent mutant remains: the `platform === undefined` guard in
`groupOfferFor` is only there for the compiler, because an unknown platform has no
group kind.

## Open

Findings 59–63 in the roadmap.
