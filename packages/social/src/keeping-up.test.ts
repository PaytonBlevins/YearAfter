/**
 * Ticket 0412 acceptance tests — the model, asserted where it lives.
 *
 * The population half is in `packages/simulation/src/friendship.test.ts`. These
 * assert the pure functions, because a claim about a curve is cheaper and
 * sharper to make against the curve than against ninety played lives (0409's
 * lesson, and 0411 followed it too).
 */

import { describe, expect, it } from 'vitest';
import { createPersonality, type Personality } from '@yearafter/character';
import { asNpcId, clampStat, type StatValue } from '@yearafter/core';
import {
  BARELY,
  DRIFT_OUT_THRESHOLD,
  FRIENDSHIP_THRESHOLD,
  INTERACTIONS,
  KEEP_UP_CHANCE,
  UNCHOSEN,
  WORTH_KEEPING,
  curvedWarmth,
  driftRate,
  inOrderOfClosest,
  keepUpOdds,
  keepableWith,
  keptUpWarmth,
  ordinaryWay,
  resolveInteraction,
  warmedBy,
  worthSaying,
  type Acquaintance,
} from './index';

const flat: Personality = createPersonality();

// A counter rather than a random id. The unseeded random built into the
// language is banned build-wide and the validator enforces it by scanning
// source, so it cannot be named here either — not even in a comment.
let made = 0;
const peer = (over: Partial<Acquaintance> = {}): Acquaintance => ({
  id: asNpcId(`npc:p${(made += 1)}`),
  firstName: 'Wren',
  lastName: 'Ash',
  sex: 'female',
  tier: 3,
  birthYear: 2000,
  alive: true,
  kind: 'peer',
  context: 'school',
  metAtAge: 10,
  lastContactAge: 17,
  memories: [],
  inRoom: false,
  personality: flat,
  relationship: clampStat(55) as StatValue,
  ...over,
});

describe('0412 — the curve warmth never had', () => {
  it('tapers a gain towards the ceiling and stops at it', () => {
    /*
      THE ASSERTION THAT MATTERS. Measured before this ticket, the closest
      friend of a forty-five-year-old ran p10 100 / median 100 / p90 100, with
      90.9% pinned at exactly the cap, because `remember` and the
      year-in-the-same-room step both added their delta raw. Every other number
      in this build goes through `curvedDelta` and its reason applies here word
      for word: a stat everyone maxes is a stat that says nothing.
    */
    expect(curvedWarmth(20, 8), 'full strength below fifty').toBe(8);
    expect(curvedWarmth(50, 8), 'still full strength at fifty').toBe(8);
    expect(curvedWarmth(75, 8)).toBeLessThan(8);
    expect(curvedWarmth(95, 8)).toBeLessThan(curvedWarmth(75, 8));
    expect(curvedWarmth(100, 8), 'nothing left at the ceiling').toBe(0);
  });

  it('leaves a loss alone, which is not an oversight', () => {
    /*
      One-sided on purpose, and the reason is two other mechanisms. `driftRate`
      already owns the cooling curve and it has the OPPOSITE shape — a
      friendship that has cooled cools faster from there — so curving a loss
      here would be a second opinion about the same thing. And `fall-out` exists
      to be able to end something (-26), which a taper would quietly disarm.
    */
    for (const at of [10, 40, 60, 90]) {
      expect(curvedWarmth(at, -6), `loss at ${at}`).toBe(-6);
    }
  });

  it('is the only place warmth changes, so two places cannot disagree', () => {
    // `warmedBy` is what `remember` and the proximity step both call.
    const cool = peer({ relationship: clampStat(30) as StatValue });
    const warm = peer({ relationship: clampStat(92) as StatValue });
    expect(warmedBy(cool, 6) - 30).toBeGreaterThan(warmedBy(warm, 6) - 92);
    expect(warmedBy(peer({ relationship: clampStat(99) as StatValue }), 40)).toBeLessThanOrEqual(
      100,
    );
  });
});

describe('0412 — who a year of silence would cost', () => {
  it('is exactly the people the room is not already keeping', () => {
    /*
      The complement of the room, and that is the whole design. Anybody `inRoom`
      is already getting proximity warmth every year; handing them this as well
      would double-count the one thing that was never in short supply and make
      the ratchet above worse rather than better.
    */
    const people = [
      peer({ id: asNpcId('npc:out'), relationship: clampStat(60) as StatValue }),
      peer({ id: asNpcId('npc:in'), inRoom: true, relationship: clampStat(60) as StatValue }),
      peer({
        id: asNpcId('npc:love'),
        relationship: clampStat(60) as StatValue,
        romance: { stage: 'together', since: 16 },
      }),
      peer({ id: asNpcId('npc:teach'), kind: 'teacher', relationship: clampStat(60) as StatValue }),
      peer({ id: asNpcId('npc:cold'), relationship: clampStat(WORTH_KEEPING - 1) as StatValue }),
      peer({ id: asNpcId('npc:gone'), relationship: clampStat(60) as StatValue, endedAtAge: 17 }),
      peer({
        id: asNpcId('npc:seen'),
        relationship: clampStat(60) as StatValue,
        lastContactAge: 18,
      }),
    ];
    const keepable = keepableWith(people, 18).map((person) => String(person.id));
    expect(keepable).toEqual(['npc:out']);
  });

  it('leaves a floor low enough that somebody can still drift all the way out', () => {
    // If `WORTH_KEEPING` sat at `DRIFT_OUT_THRESHOLD` this function would be a
    // floor under every acquaintance the player ever made, and the circle would
    // stop turning over — which is 0207b's frozen cast in this ticket's
    // clothes, and the first version of this step measured exactly like that.
    expect(WORTH_KEEPING).toBeGreaterThan(DRIFT_OUT_THRESHOLD);
  });

  it('rings the person who matters most, far more often than the one who does not', () => {
    const close = peer({ relationship: clampStat(90) as StatValue });
    const barely = peer({ relationship: clampStat(WORTH_KEEPING + 1) as StatValue });
    expect(keepUpOdds(close, 50, 50)).toBeGreaterThan(keepUpOdds(barely, 50, 50) * 2);
    // And the floor is unlikely rather than impossible.
    expect(keepUpOdds(barely, 50, 50)).toBeGreaterThan(0);
    expect(keepUpOdds(barely, 50, 50)).toBeLessThan(KEEP_UP_CHANCE * (BARELY + 0.1));
    // A sociable character holds on to people a solitary one loses.
    expect(keepUpOdds(close, 85, 85)).toBeGreaterThan(keepUpOdds(close, 20, 20));
  });

  it('spends a capped year on the people who mean something', () => {
    const order = inOrderOfClosest([
      peer({ id: asNpcId('npc:a'), relationship: clampStat(40) as StatValue }),
      peer({ id: asNpcId('npc:b'), relationship: clampStat(80) as StatValue }),
      peer({ id: asNpcId('npc:c'), relationship: clampStat(60) as StatValue }),
    ]).map((person) => String(person.id));
    expect(order).toEqual(['npc:b', 'npc:c', 'npc:a']);
  });
});

describe('0412 — what an unchosen year is worth', () => {
  it('is less than a tap, and never nothing in the direction it went', () => {
    const hangOut = INTERACTIONS.find((entry) => entry.id === 'hang-out')!;
    expect(keptUpWarmth(hangOut.onGood)).toBeLessThan(hangOut.onGood);
    expect(keptUpWarmth(hangOut.onGood)).toBeGreaterThan(0);
    // A rounding floor of zero would leave this doing nothing at exactly the
    // small values it is made of.
    expect(keptUpWarmth(1)).toBe(1);
    expect(keptUpWarmth(-1)).toBe(-1);
    expect(keptUpWarmth(0)).toBe(0);
    expect(UNCHOSEN).toBeLessThan(1);
  });

  it('beats the drift where a friendship is decided and loses to it higher up', () => {
    /*
      THE NUMBER THIS TICKET TURNS ON, and it is the sentence "the room is what
      makes a best friend and keeping up makes a good one" written as an
      inequality. Sabotage-verified: at `UNCHOSEN = 0.4` the first half fails,
      and at 1.2 the second does.
    */
    const hangOut = INTERACTIONS.find((entry) => entry.id === 'hang-out')!;
    const gained = (at: number) => curvedWarmth(at, keptUpWarmth(hangOut.onGood));

    expect(
      gained(FRIENDSHIP_THRESHOLD),
      'at the friendship line, ringing holds it',
    ).toBeGreaterThan(driftRate(FRIENDSHIP_THRESHOLD));
    expect(gained(85), 'and at eighty-five it cannot hold it').toBeLessThan(driftRate(85));
  });

  it('never does anything the People screen would not have offered', () => {
    /*
      0410's rule, and the assertion its own tests make: a door that decides for
      itself what happened is a second system that can disagree with the first.
      Light verbs only — you do not accidentally tell somebody your secret, and
      the heavy half of the menu is where the player's judgement lives.
    */
    for (const warmth of [30, 45, 60, 80, 100]) {
      const person = peer({ relationship: clampStat(warmth) as StatValue });
      for (const roll of [0, 0.24, 0.49, 0.74, 0.99]) {
        const way = ordinaryWay(person, roll);
        expect(way, `nothing available at ${warmth}`).toBeDefined();
        if (!way) continue;
        expect(way.weight, `${way.id} is heavy`).toBe('light');
        expect(way.kind === 'peer' || way.kind === 'both').toBe(true);
        if (way.minRelationship !== undefined)
          expect(warmth).toBeGreaterThanOrEqual(way.minRelationship);
        if (way.maxRelationship !== undefined)
          expect(warmth).toBeLessThanOrEqual(way.maxRelationship);
      }
    }
  });

  it('tells the feed about the year that mattered rather than only the bad one', () => {
    // The first version said something only when it went WRONG, which is a
    // biased feed: the player would read that it went badly several times a
    // decade and never once read that it went well.
    const crossed = worthSaying(FRIENDSHIP_THRESHOLD - 2, FRIENDSHIP_THRESHOLD + 2, true);
    const wrong = worthSaying(70, 68, false);
    const ordinary = worthSaying(70, 73, true);
    expect(crossed).toBeGreaterThan(wrong);
    expect(wrong).toBeGreaterThan(ordinary);
  });
});

describe('0412 — a memory says who it is about', () => {
  it('names the person in every line the menu can write', () => {
    /*
      Found by this ticket and four lines were wrong, since 0206. `remember`
      stores the rendered text as that person's memory, and 0206's own note says
      why: *"the person it names has to read the same way in ten years as it did
      the day it happened."* A page that says "It was fine. It was exactly fine,
      all afternoon, and you both felt it" does not say who.
      `advance.test.ts` asserts this invariant on played lives and could never
      see it, because until 0412 nothing but a button ever wrote one of these
      memories and a simulated life never presses a button.
    */
    for (const interaction of INTERACTIONS) {
      const person = peer({
        kind: interaction.kind === 'teacher' ? 'teacher' : 'peer',
        title: 'Ms.',
        relationship: clampStat(interaction.minRelationship ?? 55) as StatValue,
      });
      for (const roll of [0, 0.999]) {
        for (const variant of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
          for (const rotate of [0, 1, 2, 3]) {
            const result = resolveInteraction(
              interaction,
              person,
              50,
              'Wren',
              roll,
              variant,
              0,
              rotate,
            );
            expect(result.text, `${interaction.id} @${variant}/${rotate}`).toContain('Wren');
          }
        }
      }
    }
  });

  it('cannot render the same line two years running for one friendship', () => {
    /*
      `guardians.test.ts` states the rule — the base holds still for the life and
      age does all the moving — and this is the mechanism that lets the systemic
      caller obey it. Rotation had to be separated from wear: passing the age as
      `alreadyDone` would have returned `worn` from the fourth year of every
      friendship in the game.
    */
    const person = peer({ relationship: clampStat(60) as StatValue });
    for (const interaction of INTERACTIONS.filter((entry) => entry.weight === 'light')) {
      for (const worked of [0, 0.999]) {
        for (const base of [0.05, 0.37, 0.61, 0.93]) {
          for (let age = 10; age < 60; age += 1) {
            const now = resolveInteraction(interaction, person, 50, 'Wren', worked, base, 0, age);
            const next = resolveInteraction(
              interaction,
              person,
              50,
              'Wren',
              worked,
              base,
              0,
              age + 1,
            );
            expect(now.worn, 'a once-a-year contact is never worn out').toBe(false);
            expect(next.text, `${interaction.id} at ${age} and ${age + 1}`).not.toBe(now.text);
          }
        }
      }
    }
  });
});
