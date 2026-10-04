/**
 * Ticket 0207b acceptance tests.
 *
 * 0207 shipped a romance system on top of a social world that stopped at
 * seventeen, and measuring after the fact found the failure: `changedSchool`
 * was `atSchool && stage !== previousStage`, so the year a character graduated
 * it was false, nobody's `inRoom` was ever cleared, and `driftPerson` exempts
 * anybody `inRoom`. The same five high-school classmates were a character's
 * entire social world at thirty-five — a mean of 4.9 available people at every
 * adult age, none of them met after seventeen.
 *
 * Fixing it produced the opposite failure immediately, and then a third one,
 * both caught by measuring rather than by reasoning:
 *
 *  - adult acquaintances arrive near 28 warmth, drift costs 5.6 a year and the
 *    floor is 22, so every one evaporated within a year: at thirty, the
 *    earliest person a character knew had been met at 29.7;
 *  - once neighbours counted as contact they never left either, so the circle
 *    filled at nineteen and locked — a frozen cast formed two years later.
 *
 * These tests assert the shape that survived all three, loosely enough to tune
 * against and tightly enough that any of the three coming back fails.
 */

import { describe, expect, it } from 'vitest';
import { isCurrent, isFriend, partnerOf } from '@yearafter/social';
import { advanceYear } from './advance';
import { datingAppUsedThisYear, useDatingApp } from './dating';
import { decide } from './decide';
import type { GameState } from './game-state';
import { LEAVING_AGE } from '@yearafter/education';
import { createNewGame } from './new-game';

const LIVES = 80;
const SAMPLE_AGES = [18, 22, 26, 30, 35] as const;

interface Snapshot {
  readonly age: number;
  readonly around: number;
  readonly earliestMetAt: number;
  /**
   * The same, counting nobody the character is or was involved with.
   *
   * Ticket 0410. `earliestMetAt` alone stopped answering the question this file
   * asks the moment the game started pairing people off on its own: somebody
   * who married a classmate at twenty-four legitimately still has that one
   * person at thirty-five, and one person who stayed is not a frozen cast. The
   * relative claim below still reads the whole circle, because a partner moves
   * both ends of it; the absolute one reads this.
   */
  readonly earliestFriendMetAt: number;
  readonly friends: number;
  /**
   * How much of the circle was met after school, and how big it is.
   *
   * Ticket 0412. Both absolute claims in this file were made with
   * `min(metAtAge)` — the age of the single longest-standing person — and that
   * is an extreme-value statistic standing in for a claim about a whole
   * circle. 0412 gave the engine a way to keep up with somebody without the
   * player pressing anything, so about two lives in five now hold ONE person
   * from before seventeen at twenty-six, which dragged the mean of the minimum
   * under the threshold while the thing the threshold is about got better:
   * 89% of the circle at twenty-six is people met since school.
   *
   * A lifelong friend is not 0207b's bug. 0207b's bug was that there was no
   * turnover at all — *"a mean of 4.9 available people at every adult age, none
   * of them met after seventeen"* — and this pair of numbers says that
   * directly instead of by proxy. CORE_RULES 13.63, and see the sabotage note
   * on the assertion below.
   */
  readonly metSinceSchool: number;
  readonly circleSize: number;
}

function playALife(seed: string): readonly Snapshot[] {
  let state: GameState = createNewGame({ seed });
  const snapshots: Snapshot[] = [];

  for (let year = 0; year < 36; year += 1) {
    state = advanceYear(state).state;
    let guard = 0;
    while (state.pending.length > 0 && (guard += 1) < 12) {
      const decision = state.pending[0];
      const choice = decision?.choices[0];
      if (!decision || !choice) break;
      const answered = decide(state, decision.eventId, choice.id);
      if (!answered.ok) break;
      state = answered.value.state;
    }

    const age = state.player.age;
    if (!SAMPLE_AGES.includes(age as (typeof SAMPLE_AGES)[number])) continue;
    const live = state.circle.people.filter(isCurrent).filter((p) => p.kind === 'peer');
    const platonic = live.filter((p) => p.romance === undefined);
    snapshots.push({
      age,
      around: live.length,
      earliestMetAt: live.length > 0 ? Math.min(...live.map((p) => p.metAtAge)) : age,
      earliestFriendMetAt: platonic.length > 0 ? Math.min(...platonic.map((p) => p.metAtAge)) : age,
      friends: live.filter(isFriend).length,
      metSinceSchool: live.filter((p) => p.metAtAge >= LEAVING_AGE).length,
      circleSize: live.length,
    });
  }
  return snapshots;
}

const LIVES_PLAYED = Array.from({ length: LIVES }, (_, i) => playALife(`adult-${i}`));
const at = (age: number) => LIVES_PLAYED.flatMap((life) => life.filter((s) => s.age === age));
/** What share of the whole population's circles at this age was met since school. */
const shareSinceSchool = (age: number): number => {
  const rows = at(age);
  const total = rows.reduce((n, row) => n + row.circleSize, 0);
  return total === 0 ? 0 : rows.reduce((n, row) => n + row.metSinceSchool, 0) / total;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

describe('an adult has a social life', () => {
  it('does not leave adults with nobody', () => {
    for (const age of SAMPLE_AGES) {
      const rows = at(age);
      expect(rows.length, `no lives reached ${age}`).toBeGreaterThan(20);
      const empty = rows.filter((s) => s.around === 0).length / rows.length;
      expect(empty, `age ${age}: share of lives with nobody at all`).toBeLessThan(0.25);
      expect(mean(rows.map((s) => s.around)), `age ${age}`).toBeGreaterThan(1.5);
    }
  });

  it('does not let the circle churn completely every year', () => {
    // The second failure: everybody evaporating within a year of being met.
    // At thirty, somebody in the circle should have been known for a while.
    const rows = at(30);
    const held = mean(rows.map((s) => 30 - s.earliestMetAt));
    expect(held, 'years since the earliest person still around was met').toBeGreaterThan(3);
  });

  it('does not freeze the circle either', () => {
    // The first and third failures, which look identical from here: if nobody
    // ever leaves, the earliest person known stops moving with age. It has to
    // keep advancing, or the cast is frozen at whatever age it filled.
    const early = mean(at(22).map((s) => s.earliestMetAt));
    const late = mean(at(35).map((s) => s.earliestMetAt));
    expect(late, 'the earliest person known must get more recent as life goes on').toBeGreaterThan(
      early,
    );
    // And specifically: at thirty-five, the people you are not involved with
    // are overwhelmingly not the class you were in at school. Measured as a
    // SHARE OF THE CIRCLE rather than as the age of its oldest member — see
    // `metSinceSchool`, and the note on the assertion below.
    expect(shareSinceSchool(35), 'share of the circle at 35 met since school').toBeGreaterThan(0.8);
  });

  it('lets school friendships end when school does', () => {
    /*
      THIRD INSTRUMENT FOR THE SAME CLAIM, and the first two were both proxies
      (Ticket 0412).

      0207's version counted heads at twenty-six against heads at eighteen.
      0408 replaced it with `min(metAtAge)`, correctly noting that a headcount
      stops measuring "the whole class is still present" the moment adults can
      make friends at a decent rate. Then 0412 let the engine keep up with
      somebody unprompted, about two lives in five kept ONE person from before
      seventeen, and the mean of the minimum fell to 14.4 while the share of the
      circle met since school ROSE to 89%.

      So the instrument changes once more, to the thing the sentence actually
      says. The claim is not "no friendship survives school" — that is false of
      real lives and this ticket exists to make it false here. The claim is that
      the adult circle is mostly adult.

      SABOTAGE-VERIFIED against the bug it inherits. Restoring 0207's defect —
      `changedSchool` never true on the year school ends, so nobody's `inRoom`
      is ever cleared and `driftPerson` exempts them all — takes this share to
      **50.8%** here and **55.1%** at thirty-five, so both bounds go red,
      because the five classmates never leave and the adult circle has to fit
      around them.
    */
    const share = shareSinceSchool(26);
    console.log(`share of the circle at 26 met since school: ${(share * 100).toFixed(1)}%`);
    expect(share, 'at twenty-six the circle is still the class').toBeGreaterThan(0.75);
    // And the circle is not merely small: a turnover claim is empty if there is
    // nobody there to have turned over.
    expect(mean(at(26).map((s) => s.circleSize)), 'circle size at 26').toBeGreaterThan(2);
  });

  it('and the longest-standing person keeps getting more recent', () => {
    /*
      The 0408 instrument, kept as the TREND it can honestly support rather than
      the absolute threshold it was (Ticket 0412). 0408's own note is worth
      keeping: its predecessor compared headcounts, failed by 0.6%, and *"0.6%
      is the size of `this assertion is measuring the wrong thing`"*. The same
      was true of the absolute form of this one two tickets later.

      A mean that climbs with age cannot happen if the cast is frozen, and it
      does not care how many characters keep one friend from school.
    */
    const younger = mean(at(26).map((s) => s.earliestMetAt));
    const older = mean(at(35).map((s) => s.earliestMetAt));
    console.log(
      `earliest peer still around: ${younger.toFixed(1)} at 26, ${older.toFixed(1)} at 35`,
    );
    expect(older, 'the longest-standing person must get more recent').toBeGreaterThan(younger);
    /*
      The absolute half — "past childhood by twenty-six", a mean over each
      life's EARLIEST person — is gone (Ticket 0416, CORE_RULES 13.80). It is a
      minimum per life, and 0416 gave children somewhere to meet people (teams,
      clubs, and the two teammates each one brings) so the sample it is the
      minimum of grew: 71% of twenty-six-year-olds now keep somebody from before
      seventeen, against about 40%, and the mean earliest dropped from past 12
      to 10.6. That is the population keeping a childhood friend, which people
      do, not a frozen cast. What a frozen cast would look like is asserted by
      share, where it can be seen: most of the circle at twenty-six met since
      school (above, 76.7%) and "everybody keeps one" (`friendship.test.ts`,
      under 80%). Restoring 0207's never-cleared room still turns both red.
    */
  });
});

describe('the dating app (spec 1664)', () => {
  /*
    A SINGLE twenty-two-year-old, found rather than hoped for (13.72). This used
    one seed and assumed whoever it produced would be single at twenty-two, which
    held until 0416 gave adults somewhere to meet people — then 'app-life' was
    in a relationship, the app correctly refused, and the test read that as the
    app being broken. The claim is about the app; the harness has to supply the
    person the claim is about.
  */
  const adult = (): GameState => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      let state = createNewGame({ seed: attempt === 0 ? 'app-life' : `app-life-${attempt}` });
      while (state.player.alive && state.player.age < 22) {
        state = advanceYear(state).state;
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const d = state.pending[0];
          const c = d?.choices[0];
          if (!d || !c) break;
          const answered = decide(state, d.eventId, c.id);
          if (!answered.ok) break;
          state = answered.value.state;
        }
      }
      if (state.player.alive && !partnerOf(state.circle.people)) return state;
    }
    throw new Error('no single twenty-two-year-old in thirty lives');
  };

  it('is not available to a minor', () => {
    const child = createNewGame({ seed: 'app-child' });
    const result = useDatingApp(child);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('too-young');
  });

  it('is once a year', () => {
    const state = adult();
    const first = useDatingApp(state);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(datingAppUsedThisYear(first.value.state)).toBe(true);
    const second = useDatingApp(first.value.state);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('already-this-year');
  });

  it('often comes back with nobody', () => {
    // An app that always produces somebody is a vending machine. Run it across
    // many seeds and check both outcomes actually happen.
    let empty = 0;
    let found = 0;
    for (let i = 0; i < 60; i += 1) {
      let state = createNewGame({ seed: `app-${i}` });
      while (state.player.age < 22) {
        state = advanceYear(state).state;
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const d = state.pending[0];
          const c = d?.choices[0];
          if (!d || !c) break;
          const answered = decide(state, d.eventId, c.id);
          if (!answered.ok) break;
          state = answered.value.state;
        }
      }
      const result = useDatingApp(state);
      if (!result.ok) continue;
      if (result.value.met.length === 0) empty += 1;
      else found += 1;
    }
    expect(empty, 'a month that came to nothing must be a real outcome').toBeGreaterThan(5);
    expect(found, 'and so must meeting somebody').toBeGreaterThan(5);
  });

  it('writes a line either way, and never an empty one', () => {
    for (let i = 0; i < 40; i += 1) {
      let state = createNewGame({ seed: `app-text-${i}` });
      while (state.player.age < 24) {
        state = advanceYear(state).state;
        let guard = 0;
        while (state.pending.length > 0 && (guard += 1) < 12) {
          const d = state.pending[0];
          const c = d?.choices[0];
          if (!d || !c) break;
          const answered = decide(state, d.eventId, c.id);
          if (!answered.ok) break;
          state = answered.value.state;
        }
      }
      const result = useDatingApp(state);
      if (!result.ok) continue;
      const text = result.value.entry.text;
      expect(text.length).toBeGreaterThan(20);
      expect(text).not.toContain('{');
      expect(text).not.toContain('undefined');
      // A line naming somebody must name somebody who exists.
      for (const person of result.value.met) {
        expect(result.value.state.circle.people.some((p) => p.id === person.id)).toBe(true);
      }
    }
  });
});
