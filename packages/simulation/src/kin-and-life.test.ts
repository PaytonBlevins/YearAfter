/**
 * Ticket 0414 acceptance tests — the rest of a life after school.
 *
 * Roadmap finding 2e, which 0413 left behind: the cliff at eighteen was only
 * half filled, and what remained was not friendship. Measured before this
 * ticket, for an ordinary character:
 *
 * | category | reachable at 18 | at 40 |
 * |---|---|---|
 * | family | **0** | **0** |
 * | random | 5 (all placeholders) | 7 (all placeholders) |
 * | talent | **0** | **0** |
 *
 * `family` was a total zero BY CONSTRUCTION. Of its ninety-one events, eighty
 * carry an `ageMax` below eighteen and the other eleven are gated on
 * `hasChildren`; there was no third group. So:
 *
 *  - **56.3% of every adult year in this build was childless**, and **0.0% of
 *    those years held a family event**;
 *  - **69.8% of them had a living parent** — in the save, ageing, and eventually
 *    killed by 0212 — and the catalog had nothing to say about her until the
 *    funeral;
 *  - 64.4% of adult years had a living sibling, with the same silence.
 *
 * Family events ran 0% at eighteen, 1.9% at thirty and 12.4% at forty, and that
 * rise was entirely people having children. "Family" meant "you are a parent".
 */

import { describe, expect, it } from 'vitest';
import { CHILDHOOD_EVENTS } from '@yearafter/content';
import { livingParents, siblings } from '@yearafter/relationships';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const LIVES = 80;
const BY_ID = new Map(CHILDHOOD_EVENTS.map((event) => [event.id, event]));
const categoryOf = (id: string) => BY_ID.get(id)?.category;

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
  readonly fired: readonly string[];
  readonly childless: boolean;
  readonly livingParents: number;
  readonly livingSiblings: number;
}

function playALife(seed: string): readonly YearRow[] {
  let state: GameState = createNewGame({ seed });
  const rows: YearRow[] = [];
  let guard = 0;
  let last: Record<string, number> = {};
  while (state.player.alive && (guard += 1) < 110) {
    state = answerEverything(advanceYear(state).state);
    const now = state.events.lastFired;
    rows.push({
      age: state.player.age,
      fired: Object.keys(now).filter((id) => now[id] !== last[id]),
      childless: !state.family.members.some((member) => member.role === 'child'),
      livingParents: livingParents(state.family).length,
      livingSiblings: siblings(state.family).filter((member) => member.alive).length,
    });
    last = { ...now };
  }
  return rows;
}

const ALL = Array.from({ length: LIVES }, (_, i) => playALife(`kin-${i}`)).flat();
const adult = (from = 18, to = 100) => ALL.filter((row) => row.age >= from && row.age <= to);
const shareHolding = (rows: readonly YearRow[], category: string) =>
  rows.length === 0
    ? 0
    : rows.filter((row) => row.fired.some((id) => categoryOf(id) === category)).length /
      rows.length;
const mixAt = (age: number) => {
  const fired = ALL.filter((row) => row.age === age).flatMap((row) => [...row.fired]);
  const counts = new Map<string, number>();
  for (const id of fired) {
    const category = categoryOf(id);
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return { counts, total: fired.length };
};

describe('0414 — the rest of a life after school', () => {
  it('says something about the family a childless adult came from', () => {
    /*
      THE ASSERTION THAT MATTERS, and it went from an exact zero. Measured on
      the population that had NO family content at all: childless adults, 56% of
      every adult year in the build.

      Asserted on childless years specifically rather than on all adult years,
      because the eleven `hasChildren` events would otherwise carry the number
      and hide the hole — which is exactly how this survived 0409 and 0410.
    */
    const childless = adult().filter((row) => row.childless);
    const holding = shareHolding(childless, 'family');
    console.log(
      `childless adult years: ${childless.length}, holding a family event: ${(holding * 100).toFixed(1)}%`,
    );
    expect(childless.length, 'no childless adult years to measure').toBeGreaterThan(1000);
    expect(holding, 'a childless adult still has no family').toBeGreaterThan(0.25);
  });

  it('lets a living parent and a living sibling exist in the feed', () => {
    /*
      The people are in the save and always were — `requires: ["mother"]` has
      meant a LIVING mother since 0212 made NPCs mortal. Nothing had ever been
      written against it, so this is not a plumbing test; it is a reachability
      one, and the two populations are checked separately because a character
      can easily have one and not the other.
    */
    const withParent = adult().filter((row) => row.livingParents > 0);
    const withSibling = adult().filter((row) => row.livingSiblings > 0);
    expect(withParent.length, 'nobody has a living parent as an adult').toBeGreaterThan(800);
    expect(withSibling.length, 'nobody has a living sibling as an adult').toBeGreaterThan(800);
    expect(
      shareHolding(withParent, 'family'),
      'a living parent is never in the feed',
    ).toBeGreaterThan(0.25);
    expect(
      shareHolding(withSibling, 'family'),
      'a living sibling is never in the feed',
    ).toBeGreaterThan(0.25);
  });

  it('asks a grown child a question, which it never had', () => {
    // Adult family decisions before this: zero. Every decision the game had ever
    // raised to an adult was career, health, loss or — since 0413 — friendship.
    const decisions = adult().flatMap((row) =>
      row.fired.filter((id) => BY_ID.get(id)?.type !== 'passive'),
    );
    const family = decisions.filter((id) => categoryOf(id) === 'family');
    expect(
      family.length,
      'not one adult decision is about the family you came from',
    ).toBeGreaterThan(30);
  });

  it('gives an adult an ordinary life that is not the placeholders', () => {
    /*
      `random` is the catch-all for everything that is not your job, your
      friends, your family or your body — and for an adult it was EIGHT events,
      all eight of them `adult.placeholder.*`. At twelve the same category offers
      forty-eight. 0413 turned their weight down and named this; this fills it.
    */
    const window = adult(18, 30);
    const fired = window.flatMap((row) => [...row.fired]);
    const placeholders = fired.filter((id) => id.startsWith('adult.placeholder')).length;
    const share = placeholders / Math.max(1, fired.length);
    console.log(`placeholder share across 18-30: ${(share * 100).toFixed(1)}%`);
    expect(share, 'the placeholders are still carrying an adult life').toBeLessThan(0.08);
    expect(shareHolding(window, 'random'), 'no ordinary life at all').toBeGreaterThan(0.25);
  });

  it('leaves no adult year dominated by one category', () => {
    /*
      0413's own leftover, and the reason it is a defect rather than a taste:
      after that ticket friendship was 49% of everything that fired at twenty
      against childhood's 22-28%, NOT because the tranche was over-weighted — it
      was measured down twice — but because friendship was the only adult
      category that could see a twenty-year-old.

      So this is asserted as a shape rather than against friendship by name: no
      category may own an adult year, at any adult age, whichever one it is.
      Filling the other categories is the only thing that satisfies it.
    */
    for (const age of [20, 25, 30, 40, 55]) {
      const { counts, total } = mixAt(age);
      expect(total, `nothing fires at ${age}`).toBeGreaterThan(100);
      let worst = { category: 'none', share: 0 };
      for (const [category, n] of counts) {
        if (n / total > worst.share) worst = { category, share: n / total };
      }
      console.log(
        `age ${age}: ${worst.category} is ${(worst.share * 100).toFixed(1)}% of the year`,
      );
      expect(worst.share, `age ${age} is mostly ${worst.category}`).toBeLessThan(0.4);
    }
  });
});
