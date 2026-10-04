/**
 * Ticket 0412 acceptance tests — the population half.
 *
 * Roadmap findings 2b and 2d. 2b said *"warmth is grown by a button, and there
 * is a trough at twenty"*; measuring found the trough is real, is not about
 * adulthood, and happens three times. And it found a second failure at the
 * other end that no finding had noticed at all.
 *
 * A player who answers every question the game raises and never opens a screen,
 * 90 lives:
 *
 * | | before | after |
 * |---|---|---|
 * | share with NO friend at 14 | **84.4%** | 31.1% |
 * | share with NO friend at 19 | **88.9%** | 51.1% |
 * | share with NO friend at 20 | **87.8%** | 60.0% |
 * | closest friend at 45, p10 / med / p90 | **100 / 100 / 100** | 84 / 95 / 96 |
 * | closest friend at 45 pinned at the cap | **90.9%** | **0%** |
 *
 * Both halves come from the same fact: a friendship was kept alive by being in
 * a room and by nothing else. Every change of room reset the cast to strangers
 * (fourteen and nineteen are the same hole, two rooms apart), and a room that
 * stayed open — a job, for thirty years — handed out `PROXIMITY_WARMTH` raw
 * every single year until everybody hit the ceiling.
 *
 * These assert SPREAD and the WORST YEAR rather than any median, because a
 * median moving is what the old model already did.
 */

import { describe, expect, it } from 'vitest';
import { isCurrent, isFriend } from '@yearafter/social';
import { advanceYear } from './advance';
import { buildEventContext } from './phases/events';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const LIVES = 90;

function answerEverything(state: GameState): GameState {
  let next = state;
  let guard = 0;
  while (next.pending.length > 0 && (guard += 1) < 16) {
    const decision = next.pending[0];
    const choice = decision?.choices[0];
    if (!decision || !choice) break;
    const answered = decide(next, decision.eventId, choice.id);
    if (!answered.ok) break;
    next = answered.value.state;
  }
  return next;
}

interface YearRow {
  readonly age: number;
  readonly friends: number;
  /** Warmth of the closest person the character is not involved with, 0 if none. */
  readonly closest: number;
  /** Warmth of every friend they have (Ticket 0416 — see the spread assertion). */
  readonly everyFriend: readonly number[];
  /** Was anybody met before leaving school still around? */
  readonly heldFromSchool: boolean;
  /** Memories written about anybody this year, by any writer. */
  readonly memories: number;
  /** What the event engine would be told about this character's friends. */
  readonly saidFriends: number;
  readonly saidYears: number;
}

function playALife(seed: string): readonly YearRow[] {
  let state: GameState = createNewGame({ seed });
  const rows: YearRow[] = [];
  let guard = 0;
  while (state.player.alive && (guard += 1) < 110) {
    state = answerEverything(advanceYear(state).state);
    const age = state.player.age;
    const live = state.circle.people.filter((p) => isCurrent(p) && p.kind === 'peer');
    const platonic = live.filter((p) => p.romance === undefined);
    const context = buildEventContext(state, age, state.world.year, state.events);
    rows.push({
      age,
      friends: platonic.filter(isFriend).length,
      closest: platonic.reduce((m, p) => Math.max(m, Number(p.relationship)), 0),
      everyFriend: platonic.filter(isFriend).map((p) => Number(p.relationship)),
      heldFromSchool: live.some((p) => p.metAtAge < 17),
      memories: state.circle.people.reduce(
        (n, p) => n + p.memories.filter((m) => m.age === age).length,
        0,
      ),
      saidFriends: context.friends,
      saidYears: context.friendshipYears,
    });
  }
  return rows;
}

const LIVES_PLAYED = Array.from({ length: LIVES }, (_, i) => playALife(`friend-${i}`));
const ALL = LIVES_PLAYED.flat();
const at = (age: number) => ALL.filter((row) => row.age === age);
const share = (rows: readonly YearRow[], of: (row: YearRow) => boolean) =>
  rows.length === 0 ? 0 : rows.filter(of).length / rows.length;
const pctile = (xs: number[], p: number) => {
  const sorted = xs.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
};

describe('0412 — a friend you actually have', () => {
  it('leaves no year of a life where most characters have nobody', () => {
    /*
      THE SAWTOOTH. Before this ticket, three separate ages had more than
      four fifths of the population holding no friend at all — 84.4% at
      fourteen, 88.9% at nineteen, 87.8% at twenty — because a friendship took
      three or four years of proximity to cross the line at 50 and the build
      emptied the room at eleven, fourteen and eighteen.

      Asserted across EVERY age rather than at the three that were worst, so a
      future ticket that moves a school stage or a working age cannot open the
      same hole somewhere else and pass.
    */
    let worst = { age: 0, none: 0 };
    for (let age = 12; age <= 60; age += 1) {
      const rows = at(age);
      if (rows.length < 30) continue;
      const none = share(rows, (row) => row.friends === 0);
      if (none > worst.none) worst = { age, none };
    }
    console.log(
      `worst year for friendlessness: age ${worst.age}, ${(worst.none * 100).toFixed(1)}%`,
    );
    expect(worst.none, `age ${worst.age} leaves most characters with nobody`).toBeLessThan(0.75);
  });

  it('does not hand everybody the same best friend', () => {
    /*
      THE RATCHET, and it is the half no roadmap finding had noticed. Warmth was
      the one number in this build that never went through a curve: `remember`
      and the year-in-the-same-room step both added raw, and a job is a room
      that can stay open for thirty years. At forty-five the closest friend of
      90.9% of characters sat at exactly 100, and p10, median and p90 were all
      100 — this build had no such thing as a decent-but-not-best adult friend.
    */
    for (const age of [30, 40, 45, 55]) {
      const rows = at(age).filter((row) => row.closest > 0);
      expect(rows.length, `too few lives at ${age}`).toBeGreaterThan(30);
      expect(
        share(rows, (row) => row.closest >= 100),
        `age ${age}: closest friends pinned at the ceiling`,
      ).toBeLessThan(0.05);
      /*
        THE SPREAD, MEASURED ON EACH LIFE'S TYPICAL FRIENDSHIP RATHER THAN ITS
        CLOSEST (Ticket 0416, CORE_RULES 13.80). This took p90 − p10 of the
        closest friend per life, and 0416 turned it red at fifty-five (8, against
        a line of 8) without moving any friendship toward the ceiling: the door
        to something to join took the median adult from three friends to four,
        and the warmest of four is warmer than the warmest of three even when
        all of them come from the same distribution. The maximum moved because
        the sample grew.

        The first replacement — spread across every friendship, pooled — could
        not see the thing it was for: with 0412's raw warmth restored it still
        read wide, because a pool always holds somebody met last year. So it is
        each life's MEDIAN friendship now, which does not care whether there are
        three or four: at fifty-five it runs 74/96 with this ticket, 79/96
        without, and 97/100 with raw warmth restored — which turns this red.
      */
      const typical = at(age)
        .filter((row) => row.everyFriend.length > 0)
        .map((row) => pctile([...row.everyFriend], 0.5));
      expect(
        pctile(typical, 0.9) - pctile(typical, 0.1),
        `age ${age}: every life's friendships look the same`,
      ).toBeGreaterThan(12);
    }
  });

  it('lets a friendship survive a change of room, without making it the rule', () => {
    /*
      Both ends, because each is a failure mode the other hides. Nothing held a
      friendship together outside a room before this, so a school friendship
      could not survive school; and a version of this step that ran before the
      drift rather than after it bought total drift immunity with one phone call
      a year, and then EVERYBODY kept their primary-school friend to twenty-six.
      `adult-social.test.ts` carries the turnover half of this claim.
    */
    const held = share(at(26), (row) => row.heldFromSchool);
    console.log(
      `lives still holding somebody from before seventeen at 26: ${(held * 100).toFixed(1)}%`,
    );
    expect(held, 'a school friendship can never survive school').toBeGreaterThan(0.15);
    expect(held, 'everybody keeps one, which is a frozen cast').toBeLessThan(0.8);
  });

  it('makes an adult year about somebody, rather than about nobody', () => {
    /*
      `interact.ts` writes the memory that makes a relationship a relationship
      rather than a row — and it is only ever called by a tap, so before this
      ticket an adult's social life was about nobody. Memories written per year
      ran 0.82 in childhood, where events bind to classmates, and **0.20** after
      twenty-two.
    */
    const adult = ALL.filter((row) => row.age >= 25 && row.age <= 55);
    const named = share(adult, (row) => row.memories > 0);
    const per = adult.reduce((n, row) => n + row.memories, 0) / Math.max(1, adult.length);
    console.log(
      `adult years naming somebody: ${(named * 100).toFixed(1)}%, ${per.toFixed(2)} memories a year`,
    );
    /*
      A SHARE OF YEARS rather than a mean count, because the mean is the wrong
      instrument twice over: it is pulled by the rare year with three, and the
      childhood figure it would naturally be compared against ALSO rose — this
      step helps an eleven-year-old keep their primary-school friend just as
      much as it helps a forty-year-old, so the child/adult ratio measures how
      much the fix helped children and not whether adulthood is fixed.

      Before this ticket 19.5% of adult years named anybody, and every one of
      those was an event that happened to bind to a person. It is 33% now, and
      the bound sits clear of both.

      THE REST OF THIS GAP IS THE NEXT TICKET'S, and it is worth naming here so
      the number is not mistaken for the target: this step reaches the people a
      year of silence would cost, which is the complement of the room. The
      colleague of fifteen years sitting at 95 warmth gets no memory from it,
      because nothing in the build says what happens between two people who see
      each other every day — that is the event catalog's job, and the
      `friendship` category has six adult events, all of them about romance.
    */
    expect(named, 'an adult year still names nobody').toBeGreaterThan(0.28);
    expect(per, 'and nothing much happens in the years that do').toBeGreaterThan(0.3);
  });

  it('tells the event engine something true and varied about the friends', () => {
    /*
      CORE_RULES 13.36, pre-emptively: a field nothing writes is not state, it is
      a promise, and these three are the language the NEXT ticket writes adult
      friendship content against. So this asserts they are populated, that they
      disagree across a population, and that `friendshipYears` can actually
      reach the "an old friend" range the predicate exists for.
    */
    const adult = ALL.filter((row) => row.age >= 30);
    expect(
      share(adult, (row) => row.saidFriends > 0),
      'hasFriend: true is reachable',
    ).toBeGreaterThan(0.6);
    expect(
      share(adult, (row) => row.saidFriends === 0),
      'hasFriend: false is reachable',
    ).toBeGreaterThan(0.01);
    expect(
      share(adult, (row) => row.saidFriends >= 3),
      'friendsAtLeast: 3 is reachable',
    ).toBeGreaterThan(0.2);
    expect(
      share(adult, (row) => row.saidYears >= 10),
      'friendshipYearsAtLeast: 10 is reachable',
    ).toBeGreaterThan(0.2);
    // And the count it reports is the one the circle actually holds.
    for (const row of adult.slice(0, 200)) expect(row.saidFriends).toBe(row.friends);
  });
});
