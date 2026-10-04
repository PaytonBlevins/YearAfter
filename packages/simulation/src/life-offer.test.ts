/**
 * Ticket 0410 acceptance tests.
 *
 * The measurement this ticket opened with, across 90 played lives and 4,828
 * adult years of a player who answers every question and never opens a screen:
 * **zero partnered adult years, zero weddings, zero children.** Every verb in
 * the romance and parenting models lived behind a button, so the whole of both
 * was unreachable — and with it the eleven `family` events that can fire at
 * forty, all of which are gated on `hasChildren`.
 *
 * These assert the door exists, that it does not route around the ladder it
 * borrows, and that the dead content behind it is now reachable.
 */

import { describe, expect, it } from 'vitest';
import { CHILDHOOD_EVENTS } from '@yearafter/content';
import { movesFor, partnerOf } from '@yearafter/social';
import { advanceYear } from './advance';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';
import { isLifeOfferDecision } from './life-offer';
import { isOfferDecision } from './offers';
import { isCollegeOfferDecision } from './college-offer';

const LIVES = 60;

/** A player who answers everything and never opens a screen. */
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

interface Played {
  readonly partnered: boolean;
  readonly married: boolean;
  readonly marriedAt: number;
  readonly hadChild: boolean;
  /** Years a life offer was on the table, over adult years. */
  readonly offeredYears: number;
  readonly adultYears: number;
  /** Years an authored decision and a systemic offer were open together. */
  readonly sharedYears: number;
  /** Any offer whose move `movesFor` would not have offered. */
  readonly illegalMoves: number;
  /** Ids of `hasChildren`-gated events that fired. */
  readonly parentEvents: number;
}

const PARENT_GATED = new Set(
  CHILDHOOD_EVENTS.filter((event) => event.eligibility?.hasChildren === true).map(
    (event) => event.id,
  ),
);

function playALife(seed: string): Played {
  let state: GameState = createNewGame({ seed });
  let partnered = false;
  let married = false;
  let marriedAt = -1;
  let hadChild = false;
  let offeredYears = 0;
  let adultYears = 0;
  let sharedYears = 0;
  let illegalMoves = 0;
  let parentEvents = 0;
  let lastFired: Record<string, number> = {};
  let guard = 0;

  while (state.player.alive && (guard += 1) < 110) {
    const raised = advanceYear(state).state;
    const age = raised.player.age;

    if (age >= 18) {
      adultYears += 1;
      if (raised.lifeOffer) offeredYears += 1;
      const systemic = raised.pending.filter(
        (decision) =>
          isLifeOfferDecision(decision.eventId) ||
          isOfferDecision(decision.eventId) ||
          isCollegeOfferDecision(decision.eventId),
      ).length;
      const authored = raised.pending.length - systemic;
      if (systemic > 0 && authored > 0) sharedYears += 1;
      for (const [id, year] of Object.entries(raised.events.lastFired)) {
        if (lastFired[id] !== year && PARENT_GATED.has(id)) parentEvents += 1;
      }
      lastFired = { ...raised.events.lastFired };
    }

    /*
      THE GATE CHECK, ASSERTED WHERE IT LIVES rather than inferred from a played
      population — 0409's lesson, where a gate audit over a feed produced 140
      false positives because another phase ran after the one being measured.
      Here the question is simply whether the move on the table is one the Love
      screen would have put there, and that is `movesFor`'s answer about the
      state that raised it.
    */
    const offer = raised.lifeOffer;
    if (offer?.kind === 'romance') {
      const person = raised.circle.people.find((candidate) => candidate.id === offer.personId);
      const legal =
        person !== undefined &&
        movesFor(person, raised.player.age, Number(raised.player.cash)).some(
          (move) => move.id === offer.moveId,
        );
      if (!legal) illegalMoves += 1;
    }

    state = answerEverything(raised);
    if (partnerOf(state.circle.people) !== undefined) partnered = true;
    if (!married && state.circle.people.some((person) => person.romance?.stage === 'married')) {
      married = true;
      marriedAt = state.player.age;
    }
    if (state.family.members.some((member) => member.role === 'child')) hadChild = true;
  }

  return {
    partnered,
    married,
    marriedAt,
    hadChild,
    offeredYears,
    adultYears,
    sharedYears,
    illegalMoves,
    parentEvents,
  };
}

const LIVES_PLAYED = Array.from({ length: LIVES }, (_, i) => playALife(`life-offer-${i}`));
const count = (predicate: (life: Played) => boolean) => LIVES_PLAYED.filter(predicate).length;
const sum = (pick: (life: Played) => number) =>
  LIVES_PLAYED.reduce((total, life) => total + pick(life), 0);

describe('0410 — a life happens without opening a screen', () => {
  it('lets a player who never opens the Love screen end up with somebody', () => {
    /*
      THE TICKET. Before this, every one of these was zero across 90 lives —
      not low, zero, because `romanticMove` was only ever called by a button.
      Sabotage-verified: removing `withLifeOffer` from `advanceYear` turns all
      three of these red at once.

      Bounded loosely on purpose. The claim is that the door exists and the
      population reaches the other side of it, not that any particular share
      does — a life where nobody works out is a real life and the numbers here
      are measured rather than aimed at (0410 measured 86/90, 76/90 and 64/90).
    */
    expect(count((life) => life.partnered), 'lives that ever had a partner').toBeGreaterThan(
      LIVES * 0.6,
    );
    expect(count((life) => life.married), 'lives that ever married').toBeGreaterThan(LIVES * 0.4);
    expect(count((life) => life.hadChild), 'lives that ever had a child').toBeGreaterThan(
      LIVES * 0.3,
    );
  });

  it('does not marry anybody off before the ladder allows it', () => {
    /*
      The door borrows the Love screen's moves, so it inherits
      `minYearsAtStage`, and a door that produced a wedding sooner than the
      ladder allows would be running the moves while skipping the clocks.

      THE NUMBER IS 21, and this test said 22 for two tickets (Ticket 0412).
      The arithmetic here counted `make-official`'s year from adulthood as
      well — but `together` is a stage a sixteen-year-old may hold, so that
      year can be served at school, and only `engaged` and `married` start
      their clocks at eighteen. It passed on sixty seeds because no school
      couple had ever reached a wedding; 0412 changed what a year does to
      warmth, which shifted the Relationships stream, and one of them did.
      `romance.test.ts` now pins both ends of this against `movesFor` itself,
      which is where a claim about the ladder belongs — a minimum over sixty
      lives is an extreme-value statistic and the worst possible instrument for
      a hard floor.
    */
    const weddings = LIVES_PLAYED.filter((life) => life.married).map((life) => life.marriedAt);
    expect(weddings.length, 'no weddings to check').toBeGreaterThan(0);
    expect(Math.min(...weddings), 'earliest wedding').toBeGreaterThanOrEqual(21);
  });

  it('never puts a move on the table the Love screen would not offer', () => {
    // Money, age, warmth and the stage clock all live in `movesFor`. This is
    // the assertion that the door asks it rather than reimplementing it.
    expect(sum((life) => life.illegalMoves)).toBe(0);
  });

  it('does not ask every year', () => {
    // A standing chance, not a summons — the failure mode 0402 named and 0406
    // had to go back and fix on the college side.
    const share = sum((life) => life.offeredYears) / sum((life) => life.adultYears);
    expect(share, 'share of adult years holding a life question').toBeLessThan(0.45);
  });

  it('lets an authored decision and a systemic offer share a year', () => {
    /*
      The guard every systemic door opened with was `pending.length > 0`, and
      `advanceYear`'s comment says why that was safe in 0402: an adult year
      contained zero authored decisions. 0409 wrote thirteen of them and made
      the sentence false — measured, 59.4% of adult years already held one, so
      all three doors were shut in three years out of five by a change in a
      different package.

      Sabotage-verified: putting `pending.length > 0` back turns this red.
    */
    expect(sum((life) => life.sharedYears), 'years holding both kinds of question').toBeGreaterThan(
      LIVES * 0.5,
    );
  });

  it('makes the parenting library reachable', () => {
    /*
      THE PAYOFF, and the reason this ticket is filed under content rather than
      under romance. 0208 wrote eleven parenting events; all eleven are gated on
      `hasChildren`; across 4,828 adult years of a passive population not one of
      them had ever fired, because nobody had ever had a child. The roadmap
      recorded that as "the adult family catalog is thin". It was not thin. It
      was behind a door nobody had built.
    */
    expect(PARENT_GATED.size, 'events gated on having children').toBeGreaterThan(8);
    expect(sum((life) => life.parentEvents), 'parenting events that fired').toBeGreaterThan(200);
  });
});
