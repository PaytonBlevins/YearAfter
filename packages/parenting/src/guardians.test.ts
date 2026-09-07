/**
 * Ticket 0209 acceptance tests.
 *
 * The model was measured before it was tuned, which is CORE_RULES 13.7 and
 * 13.21 and is the third ticket in a row to need it. These tests hold the
 * SHAPE that measurement produced, loosely enough to tune against:
 *
 *  - money moves the answer only where money is involved;
 *  - where it is, the household's finances matter by a visible margin;
 *  - nothing is ever certain in either direction.
 *
 * Two defects it caught along the way, both invisible without measuring: help
 * with college priced at a flat $12,000 sat at 4% for 48% of all families, and
 * a $300 school trip — the most common ask in the game — came out within three
 * points for a struggling family and a wealthy one.
 */

import { describe, expect, it } from 'vitest';
import { createPersonality } from '@yearafter/character';
import { asNpcId, dollars } from '@yearafter/core';
import type { FamilyMember, Household, WealthBand } from '@yearafter/relationships';
import {
  IN_TROUBLE,
  PARENT_ACTS,
  PARENT_REQUESTS,
  actChance,
  costAt,
  costFor,
  findRequest,
  likeliestYes,
  moodLabel,
  requestsAt,
  willThey,
} from './index';

const parent = (overrides: Partial<FamilyMember> = {}): FamilyMember => ({
  id: asNpcId('npc:mother'),
  role: 'mother',
  firstName: 'Ada',
  lastName: 'Bello',
  sex: 'female',
  birthYear: 1975,
  alive: true,
  tier: 1,
  personality: createPersonality(),
  relationship: 74,
  ...overrides,
});

const house = (band: WealthBand, income: number): Household => ({
  members: [parent()],
  finances: { band, annualIncome: dollars(income) },
});

const POOR = house('struggling', 28_000);
const MIDDLE = house('modest', 95_000);
const RICH = house('wealthy', 253_000);

const req = (id: string) => findRequest(id)!;

/* -------------------------------------------------------------------------- */
/* Age                                                                         */
/* -------------------------------------------------------------------------- */

describe('what a child of this age may ask for', () => {
  it('offers a toddler nothing', () => {
    expect(requestsAt(3)).toEqual([]);
  });

  it('does not offer a ten-year-old a car or college', () => {
    const ids = requestsAt(10).map((request) => request.id);
    expect(ids).not.toContain('a-car');
    expect(ids).not.toContain('help-with-college');
  });

  it('opens the car at sixteen and college at seventeen', () => {
    expect(requestsAt(15).map((r) => r.id)).not.toContain('a-car');
    expect(requestsAt(16).map((r) => r.id)).toContain('a-car');
    expect(requestsAt(16).map((r) => r.id)).not.toContain('help-with-college');
    expect(requestsAt(17).map((r) => r.id)).toContain('help-with-college');
  });

  it('stops offering pocket money to an adult', () => {
    expect(requestsAt(22).map((r) => r.id)).not.toContain('pocket-money');
  });
});

/* -------------------------------------------------------------------------- */
/* Money                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Ticket 0209 — a blurb that clips is a blurb that did not explain.
 *
 * The same rule 0207d wrote for the friendship menu, and it did not cover this
 * table. A screenshot of the built parent screen read "They would have to give
 * up their eveni…" and "The trip, the kit, the thing everyone els…".
 *
 * The cap is TIGHTER here than the friendship menu's 44: this row also carries
 * a mood word ("Probably") and a chevron, and the screenshot puts the real
 * limit between 38 and 40 characters.
 */
describe('the ask menu fits the row it renders in', () => {
  const BLURB_LIMIT = 38;
  const LABEL_LIMIT = 30;

  it('never writes a blurb or label that would be truncated', () => {
    for (const request of PARENT_REQUESTS) {
      expect(request.blurb.length, `${request.id}: "${request.blurb}"`).toBeLessThanOrEqual(
        BLURB_LIMIT,
      );
      expect(request.label.length, `${request.id}: "${request.label}"`).toBeLessThanOrEqual(
        LABEL_LIMIT,
      );
      // A blurb is a sentence, not a fragment — the 0207d rule.
      expect(request.blurb.trim().endsWith('.'), `${request.id}`).toBe(true);
    }
  });
});

describe('what the household can afford', () => {
  it('does not let pocket money depend on being rich, at any age', () => {
    // Band-blind, correctly. A parent's answer to "can I have some money" is
    // about them, not about their tax bracket — and it stays that way as the
    // amount grows from $6 to $39 across a childhood.
    for (const age of [6, 12, 17]) {
      const poor = willThey(req('pocket-money'), parent(), POOR, 50, age);
      const rich = willThey(req('pocket-money'), parent(), RICH, 50, age);
      expect(Math.abs(poor - rich)).toBeLessThan(0.05);
    }
  });

  it('makes paying for something a different question in a struggling family', () => {
    // Measured at the original weight, these came out within three points.
    const poor = willThey(req('pay-for-it'), parent(), POOR, 50, 17);
    const rich = willThey(req('pay-for-it'), parent(), RICH, 50, 17);
    expect(rich - poor).toBeGreaterThan(0.08);
  });

  it('asks a smaller question of the same family when the child is smaller', () => {
    // Reading a played childhood found $300 at eight and $300 at seventeen.
    // The eight-year-old is asking for a school trip and the seventeen-year-old
    // for a laptop, and a struggling household should not be asked the same
    // question for a decade. See `costPerYear`.
    const small = costAt(req('pay-for-it'), 8);
    const large = costAt(req('pay-for-it'), 17);
    expect(large).toBeGreaterThan(small * 3);
    const young = willThey(req('pay-for-it'), parent(), POOR, 50, 8);
    const old = willThey(req('pay-for-it'), parent(), POOR, 50, 17);
    expect(young).toBeGreaterThan(old);
  });

  it('never closes college to a family that is not rich', () => {
    // The defect: a flat $12,000 put this at 4% for 48% of all families.
    const poor = willThey(req('help-with-college'), parent(), POOR);
    expect(poor).toBeGreaterThan(0.15);
    expect(willThey(req('help-with-college'), parent(), RICH)).toBeGreaterThan(poor);
  });

  it('scales what a family actually gives to what they have', () => {
    const poor = costFor(req('help-with-college'), POOR);
    const rich = costFor(req('help-with-college'), RICH);
    expect(rich).toBeGreaterThan(poor);
    expect(poor).toBeGreaterThan(0);
    // Capped, so a fortune does not produce an absurd number.
    expect(costFor(req('help-with-college'), house('wealthy', 5_000_000))).toBe(
      req('help-with-college').costCap,
    );
  });

  it('leaves a request that costs no money alone', () => {
    expect(costFor(req('a-lift'), POOR)).toBe(0);
    expect(willThey(req('a-lift'), parent(), POOR)).toBeCloseTo(
      willThey(req('a-lift'), parent(), RICH),
      2,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Who they are                                                                */
/* -------------------------------------------------------------------------- */

describe('who the parent is', () => {
  it('makes generosity the widest input', () => {
    const mean = parent({ personality: createPersonality({ generosity: 12 }) });
    const kind = parent({ personality: createPersonality({ generosity: 92 }) });
    const gap =
      willThey(req('pay-for-it'), kind, MIDDLE) - willThey(req('pay-for-it'), mean, MIDDLE);
    expect(gap).toBeGreaterThan(0.3);
  });

  it('counts how the two of you stand, but less', () => {
    const close = parent({ relationship: 95 });
    const distant = parent({ relationship: 30 });
    const gap =
      willThey(req('pay-for-it'), close, MIDDLE) - willThey(req('pay-for-it'), distant, MIDDLE);
    expect(gap).toBeGreaterThan(0.05);
    expect(gap).toBeLessThan(0.35);
  });

  it('makes a year of trouble cost you', () => {
    const good = willThey(req('pay-for-it'), parent(), MIDDLE, 80);
    const bad = willThey(req('pay-for-it'), parent(), MIDDLE, 20);
    expect(good).toBeGreaterThan(bad);
  });

  it('is never certain in either direction', () => {
    const saint = parent({
      personality: createPersonality({ generosity: 100, temper: 0 }),
      relationship: 100,
    });
    const ogre = parent({
      personality: createPersonality({ generosity: 0, temper: 100 }),
      relationship: 0,
    });
    for (const request of PARENT_REQUESTS) {
      expect(willThey(request, saint, RICH, 100)).toBeLessThanOrEqual(0.94);
      expect(willThey(request, ogre, POOR, 0)).toBeGreaterThanOrEqual(0.04);
    }
  });

  it('sends the child to the parent likelier to say yes', () => {
    const soft = parent({
      id: asNpcId('npc:dad'),
      role: 'father',
      personality: createPersonality({ generosity: 90 }),
    });
    const hard = parent({ personality: createPersonality({ generosity: 15 }) });
    expect(likeliestYes(req('pay-for-it'), [hard, soft], MIDDLE)?.id).toBe(soft.id);
  });
});

/* -------------------------------------------------------------------------- */
/* What they do unprompted                                                     */
/* -------------------------------------------------------------------------- */

describe('parents act on their own (spec 61, spec 1197)', () => {
  const act = (id: string) => PARENT_ACTS.find((entry) => entry.id === id)!;

  it('does not ground a child who has done nothing wrong', () => {
    expect(actChance(act('grounded-you'), parent(), MIDDLE, IN_TROUBLE)).toBe(0);
    expect(actChance(act('grounded-you'), parent(), MIDDLE, 20)).toBeGreaterThan(0);
  });

  it('has a struggling family saying "we cannot afford it" more often', () => {
    expect(actChance(act('could-not-afford-it'), parent(), POOR, 60)).toBeGreaterThan(
      actChance(act('could-not-afford-it'), parent(), RICH, 60),
    );
  });

  it('has a wealthy family buying more surprises', () => {
    expect(actChance(act('bought-you-something'), parent(), RICH, 60)).toBeGreaterThan(
      actChance(act('bought-you-something'), parent(), POOR, 60),
    );
  });

  it('keeps being thrown out rare, and rarer when you are close', () => {
    // Measured at 0.06 a year, which compounds to two players in five by
    // twenty-four for the harshest thing in the game.
    const distant = actChance(act('kicked-you-out'), parent({ relationship: 20 }), POOR, 30);
    const close = actChance(act('kicked-you-out'), parent({ relationship: 95 }), POOR, 30);
    expect(distant).toBeLessThan(0.12);
    expect(close).toBeLessThan(distant);
  });

  it('never runs away with a probability', () => {
    for (const entry of PARENT_ACTS) {
      for (const household of [POOR, MIDDLE, RICH]) {
        for (const generosity of [0, 50, 100]) {
          const chance = actChance(
            entry,
            parent({ personality: createPersonality({ generosity }) }),
            household,
            20,
          );
          expect(chance).toBeGreaterThanOrEqual(0);
          expect(chance).toBeLessThanOrEqual(0.75);
        }
      }
    }
  });
});

describe('what the player is shown', () => {
  it('never puts a number on how a parent feels', () => {
    for (const chance of [0.04, 0.3, 0.6, 0.94]) {
      expect(moodLabel(chance)).not.toMatch(/\d/);
    }
  });

  it('gives every request a label that says what it does', () => {
    // The 0207d rule, applied to a third menu.
    for (const request of PARENT_REQUESTS) {
      expect(request.label.split(/\s+/).length).toBeGreaterThanOrEqual(2);
      expect(request.blurb.length).toBeGreaterThan(15);
      expect(request.blurb.length).toBeLessThanOrEqual(48);
    }
  });
});
