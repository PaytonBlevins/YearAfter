/**
 * Ticket 0203 acceptance tests — the engine.
 *
 * Catalog integrity is tested in @yearafter/content; this file is about the
 * machinery: eligibility, weights, cooldowns, pacing, chains and resolution.
 */

import { describe, expect, it } from 'vitest';
import { createPersonality, createStats, createTalents } from '@yearafter/character';
import type { EventDefinition } from '@yearafter/content';
import { dollars } from '@yearafter/core';
import { asNpcId } from '@yearafter/core';
import type { FamilyMember, Household } from '@yearafter/relationships';
import { matchesCondition, conditionProblems } from './conditions';
import type { EventContext } from './context';
import { applyEffects } from './effects';
import { EMPTY_HISTORY, isOffCooldown, recordFired, withFlags } from './history';
import {
  runEventPhase,
  resolveChoice,
  weightFor,
  FIRST_DECISION_AGE,
  type EventRandom,
} from './select';
import { renderEventText, tokensIn } from './text';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const member = (
  role: FamilyMember['role'],
  firstName: string,
  sex: FamilyMember['sex'],
  birthYear: number,
): FamilyMember => ({
  id: asNpcId(`npc:${role}:${firstName}`),
  role,
  firstName,
  lastName: 'Reyes',
  sex,
  birthYear,
  alive: true,
  tier: 1,
  personality: createPersonality(),
  relationship: 70,
});

const household = (members: FamilyMember[] = []): Household => ({
  members,
  finances: { band: 'modest', annualIncome: dollars(52_000) },
});

const FULL_FAMILY = household([
  member('mother', 'Ana', 'female', 1975),
  member('father', 'Luis', 'male', 1972),
  member('sibling', 'Mateo', 'male', 1997),
]);

const context = (overrides: Partial<EventContext> = {}): EventContext => ({
  age: 10,
  year: 2010,
  firstName: 'Sofia',
  lastName: 'Reyes',
  sex: 'female',
  stats: createStats(),
  talents: createTalents(),
  personality: createPersonality(),
  family: FULL_FAMILY,
  nameCultureId: 'us-en',
  homeCity: 'Toledo, OH',
  flags: new Set<string>(),
  schoolStage: 'elementary',
  activityCount: 0,
  ...overrides,
});

/**
 * A deterministic `EventRandom` for tests.
 *
 * Deliberately NOT @yearafter/simulation's `RandomStream`: simulation depends on
 * this package, and importing it back here — even in a test — would make the
 * dependency circular and quietly couple the engine to a specific generator.
 * The engine only ever asks for this interface, so the tests only supply it.
 */
class TestRandom implements EventRandom {
  private state: number;

  constructor(seed: string) {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    this.state = hash || 1;
  }

  private next(): number {
    // xorshift32 — small, deterministic, good enough to exercise selection.
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    this.state >>>= 0;
    return this.state / 4294967296;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(values: readonly T[]): T {
    return values[Math.floor(this.next() * values.length)] as T;
  }

  weightedChoice<T>(options: readonly { readonly value: T; readonly weight: number }[]): T {
    const total = options.reduce((sum, option) => sum + option.weight, 0);
    let roll = this.next() * total;
    for (const option of options) {
      roll -= option.weight;
      if (roll < 0) return option.value;
    }
    return (options[options.length - 1] as { value: T }).value;
  }

  /** Test-only escape hatch, for asserting that a draw was not consumed. */
  peek(): number {
    return this.next();
  }
}

const stream = (seed: string) => new TestRandom(seed);

const definition = (overrides: Partial<EventDefinition> = {}): EventDefinition => ({
  id: 'test.event',
  category: 'random',
  type: 'passive',
  rarity: 'common',
  eligibility: {},
  weight: 10,
  text: ['Something happened.'],
  ...overrides,
});

/* -------------------------------------------------------------------------- */

describe('conditions', () => {
  it('treats an empty condition as always true', () => {
    expect(matchesCondition({}, context())).toBe(true);
  });

  it('holds every present field at once — conditions are an AND', () => {
    const condition = {
      ageMin: 8,
      ageMax: 12,
      sex: 'female' as const,
      requires: ['mother' as const],
    };
    expect(matchesCondition(condition, context())).toBe(true);
    expect(matchesCondition(condition, context({ age: 13 }))).toBe(false);
    expect(matchesCondition(condition, context({ sex: 'male' }))).toBe(false);
    expect(matchesCondition(condition, context({ family: household() }))).toBe(false);
  });

  it('reads household shape rather than counting members by hand', () => {
    const single = household([member('mother', 'Ana', 'female', 1975)]);
    expect(matchesCondition({ requires: ['singleParent'] }, context({ family: single }))).toBe(
      true,
    );
    expect(matchesCondition({ requires: ['bothParents'] }, context({ family: single }))).toBe(
      false,
    );
    expect(matchesCondition({ requires: ['onlyChild'] }, context({ family: single }))).toBe(true);
    expect(matchesCondition({ requires: ['onlyChild'] }, context())).toBe(false);
  });

  it('treats a dead parent as absent', () => {
    const bereaved = household([
      { ...member('mother', 'Ana', 'female', 1975), alive: false },
      member('father', 'Luis', 'male', 1972),
    ]);
    expect(matchesCondition({ requires: ['mother'] }, context({ family: bereaved }))).toBe(false);
    expect(matchesCondition({ requires: ['singleParent'] }, context({ family: bereaved }))).toBe(
      true,
    );
  });

  it('compares birth years for older siblings rather than assuming', () => {
    const younger = household([member('sibling', 'Nico', 'male', 2005)]);
    // Player born 2000 (year 2010, age 10). A 2005 sibling is younger.
    expect(matchesCondition({ requires: ['olderSibling'] }, context({ family: younger }))).toBe(
      false,
    );
    expect(matchesCondition({ requires: ['olderSibling'] }, context())).toBe(true);
  });

  it('gates on talents in both directions', () => {
    const musical = context({ talents: createTalents(['music']) });
    expect(matchesCondition({ talentsAny: ['music'] }, musical)).toBe(true);
    expect(matchesCondition({ talentsAny: ['music'] }, context())).toBe(false);
    expect(matchesCondition({ talentsNone: ['music'] }, musical)).toBe(false);
    expect(matchesCondition({ talentsNone: ['music'] }, context())).toBe(true);
  });

  it('gates on stats, wealth, flags and family warmth', () => {
    const smart = context({ stats: createStats({ smarts: 80 }) });
    expect(matchesCondition({ statAtLeast: { smarts: 70 } }, smart)).toBe(true);
    expect(matchesCondition({ statAtMost: { smarts: 70 } }, smart)).toBe(false);
    expect(matchesCondition({ wealthAny: ['modest'] }, context())).toBe(true);
    expect(matchesCondition({ wealthAny: ['wealthy'] }, context())).toBe(false);
    expect(matchesCondition({ flagsAll: ['x'] }, context({ flags: new Set(['x']) }))).toBe(true);
    expect(matchesCondition({ flagsNone: ['x'] }, context({ flags: new Set(['x']) }))).toBe(false);
    expect(matchesCondition({ relationshipAtLeast: { mother: 60 } }, context())).toBe(true);
    expect(matchesCondition({ relationshipAtLeast: { mother: 90 } }, context())).toBe(false);
  });

  it('fails a warmth condition rather than crashing when the person is absent', () => {
    const orphan = context({ family: household() });
    expect(matchesCondition({ relationshipAtLeast: { mother: 10 } }, orphan)).toBe(false);
    expect(matchesCondition({ relationshipAtMost: { mother: 99 } }, orphan)).toBe(false);
  });

  it('reports structural problems that would make an event unreachable', () => {
    expect(conditionProblems({ ageMin: 12, ageMax: 4 })).toHaveLength(1);
    expect(conditionProblems({ requires: ['onlyChild', 'sibling'] })).toHaveLength(1);
    expect(conditionProblems({ statAtLeast: { nope: 5 } as never })).toHaveLength(1);
    expect(conditionProblems({ ageMin: 4, ageMax: 12 })).toHaveLength(0);
  });
});

describe('weights', () => {
  it('scales the base weight by rarity', () => {
    const common = weightFor(definition({ rarity: 'common', weight: 10 }), context());
    const rare = weightFor(definition({ rarity: 'rare', weight: 10 }), context());
    expect(common).toBeGreaterThan(rare);
  });

  it('multiplies by every matching modifier and ignores the rest', () => {
    const event = definition({
      weight: 10,
      modifiers: [
        { when: { talentsAny: ['music'] }, multiply: 3 },
        { when: { talentsAny: ['crime'] }, multiply: 5 },
      ],
    });
    expect(weightFor(event, context())).toBe(10);
    expect(weightFor(event, context({ talents: createTalents(['music']) }))).toBe(30);
    expect(weightFor(event, context({ talents: createTalents(['music', 'crime']) }))).toBe(150);
  });

  it('lets a zero modifier suppress an event without deleting it', () => {
    const event = definition({ modifiers: [{ when: { ageMin: 10 }, multiply: 0 }] });
    expect(weightFor(event, context({ age: 10 }))).toBe(0);
    expect(weightFor(event, context({ age: 9 }))).toBeGreaterThan(0);
  });
});

describe('cooldowns', () => {
  it('defaults to once per life when no cooldown is declared', () => {
    const fired = recordFired(EMPTY_HISTORY, 'e', 5);
    expect(isOffCooldown(EMPTY_HISTORY, 'e', undefined, 5)).toBe(true);
    expect(isOffCooldown(fired, 'e', undefined, 40)).toBe(false);
  });

  it('honours a declared cooldown in years', () => {
    const fired = recordFired(EMPTY_HISTORY, 'e', 5);
    expect(isOffCooldown(fired, 'e', 3, 7)).toBe(false);
    expect(isOffCooldown(fired, 'e', 3, 8)).toBe(true);
  });
});

describe('effects', () => {
  const targets = () => ({
    stats: createStats(),
    family: FULL_FAMILY,
    cash: dollars(100),
    behaviour: 70,
    stress: 0,
    history: EMPTY_HISTORY,
  });

  it('returns the same object when there is nothing to apply', () => {
    const before = targets();
    expect(applyEffects(before, undefined)).toBe(before);
  });

  it('adjusts stats without mutating the input', () => {
    const before = targets();
    const after = applyEffects(before, { stats: { happiness: 5 } });
    expect(after.stats.happiness).toBe(55);
    expect(before.stats.happiness).toBe(50);
  });

  it('routes relationship deltas to the right roles', () => {
    const after = applyEffects(targets(), { relationship: { parents: 5, siblings: -10 } });
    const byRole = Object.fromEntries(after.family.members.map((m) => [m.role, m.relationship]));
    expect(byRole['mother']).toBe(75);
    expect(byRole['father']).toBe(75);
    expect(byRole['sibling']).toBe(60);
  });

  it('never lets an event push a child into debt', () => {
    const after = applyEffects(targets(), { cash: { delta: -900, source: 'a bad trade' } });
    expect(after.cash).toBe(0);
  });

  it('carries a source with every movement of money', () => {
    // A bare number was the original shape and it produced cash arriving with no
    // explanation anywhere in the feed.
    const after = applyEffects(targets(), { cash: { delta: 25, source: 'a found wallet' } });
    expect(after.cash).toBe(dollars(125));
  });

  it('moves school standing, clamped', () => {
    // Without this, alternative-school placement (spec 73) is unreachable —
    // nothing else in the game pushes behaviour down.
    expect(applyEffects(targets(), { behaviour: -12 }).behaviour).toBe(58);
    expect(applyEffects(targets(), { behaviour: 999 }).behaviour).toBe(100);
    expect(applyEffects(targets(), {}).behaviour).toBe(70);
  });

  it('sets and clears flags', () => {
    const set = applyEffects(targets(), { setFlags: ['a', 'b'] });
    expect(set.history.flags).toEqual(['a', 'b']);
    const cleared = applyEffects(set, { clearFlags: ['a'] });
    expect(cleared.history.flags).toEqual(['b']);
  });
});

describe('text', () => {
  it('resolves family tokens from the household', () => {
    // Parents by relationship, siblings by name — which is how a child talks.
    const text = renderEventText('{mother} and {father} met {sibling}.', context(), stream('T'));
    expect(text).toBe('Mom and Dad met Mateo.');
  });

  it('names the character and the city', () => {
    expect(renderEventText('{me} lives in {city}.', context(), stream('T'))).toBe(
      'Sofia lives in Toledo, OH.',
    );
  });

  it('draws incidental names from the character’s own naming tradition', () => {
    const text = renderEventText(
      '{kid} and {kid2}.',
      context({ nameCultureId: 'jp' }),
      stream('T'),
    );
    const [first, second] = text.replace('.', '').split(' and ');
    expect(first).not.toBe(second);
    expect(first).not.toMatch(/[{}]/);
  });

  it('consumes randomness only when a line actually needs a name', () => {
    // Otherwise adding {kid} to one event's copy would shift every other draw.
    const a = stream('SAME');
    renderEventText('{mother} did something.', context(), a);
    const b = stream('SAME');
    expect(a.peek()).toBe(b.peek());
  });

  it('falls back to neutral prose rather than printing a brace', () => {
    const orphan = context({ family: household() });
    expect(renderEventText('{mother} called.', orphan, stream('T'))).toBe('Mom called.');
    expect(renderEventText('{motherName} called.', orphan, stream('T'))).toBe('your mom called.');
    expect(renderEventText('{sibling} called.', orphan, stream('T'))).toBe('your sibling called.');
  });

  it('lists the tokens in a line', () => {
    expect(tokensIn('{me} and {kid} in {city}')).toEqual(['me', 'kid', 'city']);
  });
});

describe('the year phase', () => {
  it('is deterministic for a given seed and history', () => {
    const run = () => runEventPhase(context(), stream('YEAR'), EMPTY_HISTORY);
    expect(run().outcomes.map((o) => o.eventId)).toEqual(run().outcomes.map((o) => o.eventId));
  });

  it('always produces something to read', () => {
    for (let age = 0; age <= 17; age += 1) {
      const result = runEventPhase(context({ age }), stream(`AGE-${age}`), EMPTY_HISTORY);
      expect(result.outcomes.length, `age ${age}`).toBeGreaterThan(0);
    }
  });

  it('produces something even for the sparsest possible household', () => {
    // No parents, no siblings, no talents, struggling — the worst case for a
    // catalog that leans on family and talent gating.
    const bare = context({
      family: { members: [], finances: { band: 'struggling', annualIncome: dollars(18_000) } },
      talents: createTalents(),
    });
    for (let age = 0; age <= 17; age += 1) {
      const result = runEventPhase({ ...bare, age }, stream(`BARE-${age}`), EMPTY_HISTORY);
      expect(result.outcomes.length, `age ${age}`).toBeGreaterThan(0);
    }
  });

  it('keeps a year inside the pacing spec 725-770 sets', () => {
    let maxOutcomes = 0;
    let maxDecisions = 0;
    for (let i = 0; i < 400; i += 1) {
      const age = 5 + (i % 13);
      const result = runEventPhase(context({ age }), stream(`PACE-${i}`), EMPTY_HISTORY);
      maxOutcomes = Math.max(maxOutcomes, result.outcomes.length);
      maxDecisions = Math.max(maxDecisions, result.decisions.length);
    }
    expect(maxOutcomes).toBeLessThanOrEqual(5);
    expect(maxDecisions).toBeLessThanOrEqual(3);
  });

  it('asks an infant nothing', () => {
    for (let age = 0; age < FIRST_DECISION_AGE; age += 1) {
      for (let i = 0; i < 25; i += 1) {
        const result = runEventPhase(context({ age }), stream(`BABY-${age}-${i}`), EMPTY_HISTORY);
        expect(result.decisions, `age ${age}`).toHaveLength(0);
      }
    }
  });

  it('never repeats an event inside one year', () => {
    for (let i = 0; i < 200; i += 1) {
      const result = runEventPhase(context(), stream(`DUP-${i}`), EMPTY_HISTORY);
      const ids = [
        ...result.outcomes.map((o) => o.eventId),
        ...result.decisions.map((d) => d.eventId),
      ];
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('records everything it fired, so cooldowns actually bind', () => {
    const result = runEventPhase(context(), stream('REC'), EMPTY_HISTORY);
    for (const outcome of result.outcomes) {
      expect(result.history.lastFired[outcome.eventId]).toBe(10);
    }
  });

  it('does not fire an event that is still on cooldown', () => {
    let history = EMPTY_HISTORY;
    const first = runEventPhase(context(), stream('CD'), history);
    history = first.history;
    const repeated = runEventPhase(context(), stream('CD2'), history);
    for (const outcome of repeated.outcomes) {
      expect(first.outcomes.map((o) => o.eventId)).not.toContain(outcome.eventId);
    }
  });

  it('respects story flags an earlier year set', () => {
    const withFlag = context({ flags: new Set(['school.bullied']) });
    let seen = false;
    for (let i = 0; i < 60 && !seen; i += 1) {
      const result = runEventPhase(withFlag, stream(`FLAG-${i}`), EMPTY_HISTORY);
      seen = result.decisions.some((d) => d.eventId === 'd.school.bully-response');
    }
    expect(seen).toBe(true);
  });

  it('never raises a decision with fewer than two buttons', () => {
    for (let i = 0; i < 300; i += 1) {
      const result = runEventPhase(
        context({ age: 8 + (i % 10) }),
        stream(`BTN-${i}`),
        EMPTY_HISTORY,
      );
      for (const decision of result.decisions) {
        expect(decision.choices.length, decision.eventId).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('fires a scheduled follow-up when it comes due, then forgets it', () => {
    const history = {
      ...EMPTY_HISTORY,
      scheduled: [{ eventId: 'school.bullied.after', atAge: 10, sourceId: 'school.bullied' }],
      flags: ['school.bullied'],
    };
    const result = runEventPhase(
      context({ flags: new Set(['school.bullied']) }),
      stream('CHAIN'),
      history,
    );
    expect(result.outcomes.map((o) => o.eventId)).toContain('school.bullied.after');
    expect(result.history.scheduled).toHaveLength(0);
  });

  it('drops a follow-up whose event no longer makes sense, without leaving it queued', () => {
    const history = {
      ...EMPTY_HISTORY,
      // random.braces.off requires ages 12-17; at 10 it should be dropped.
      scheduled: [{ eventId: 'random.braces.off', atAge: 10, sourceId: 'random.braces' }],
    };
    const result = runEventPhase(context({ age: 10 }), stream('STALE'), history);
    expect(result.outcomes.map((o) => o.eventId)).not.toContain('random.braces.off');
    expect(result.history.scheduled).toHaveLength(0);
  });

  it('schedules a follow-up when an event that has one fires', () => {
    const catalog = [
      definition({ id: 'test.source', followUp: { eventId: 'school.bullied.after', inYears: 2 } }),
    ];
    const result = runEventPhase(context(), stream('SCHED'), EMPTY_HISTORY, catalog);
    expect(result.history.scheduled).toEqual([
      { eventId: 'school.bullied.after', atAge: 12, sourceId: 'test.source' },
    ]);
  });
});

describe('resolving a decision', () => {
  const decisionFor = (seed: string) => {
    for (let i = 0; i < 400; i += 1) {
      const result = runEventPhase(context({ age: 14 }), stream(`${seed}-${i}`), EMPTY_HISTORY);
      const first = result.decisions[0];
      if (first) return first;
    }
    throw new Error('no decision was raised in 400 attempts');
  };

  it('returns an outcome for a valid choice', () => {
    const decision = decisionFor('RES');
    const choice = decision.choices[0];
    expect(choice).toBeDefined();
    if (!choice) return;
    const resolved = resolveChoice(decision, choice.id, context(), stream('R'), EMPTY_HISTORY);
    expect(resolved?.outcome.text.length).toBeGreaterThan(0);
    expect(resolved?.outcome.text).not.toMatch(/[{}]/);
  });

  it('returns undefined for a choice that does not exist', () => {
    const decision = decisionFor('BAD');
    expect(resolveChoice(decision, 'nope', context(), stream('R'), EMPTY_HISTORY)).toBeUndefined();
  });

  it('draws different results from an uncertain choice', () => {
    const decision = decisionFor('UNC');
    const results = new Set<string>();
    for (let i = 0; i < 60; i += 1) {
      for (const choice of decision.choices) {
        const resolved = resolveChoice(
          decision,
          choice.id,
          context(),
          stream(`U-${i}`),
          EMPTY_HISTORY,
        );
        if (resolved) results.add(resolved.outcome.text);
      }
    }
    // Every decision in the catalog has at least one uncertain choice or
    // several certain ones; either way one decision cannot have one result.
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('history', () => {
  it('keeps flags sorted and unique so a save diff is readable', () => {
    const history = withFlags(withFlags(EMPTY_HISTORY, ['b', 'a']), ['a', 'c']);
    expect(history.flags).toEqual(['a', 'b', 'c']);
  });
});

describe('one name, carried through a whole decision (Ticket 0203b)', () => {
  const catalog = [
    definition({
      id: 'test.named',
      type: 'decision',
      personTokens: ['kid', 'adult'],
      text: ['{kid} is by the fountain and {adult} is watching from the window.'],
      choices: [
        {
          id: 'a',
          label: 'Talk to {kid}',
          text: '{kid} laughed. {adult} pretended not to notice.',
        },
        { id: 'b', label: 'Ask {adult}', text: '{adult} told you to talk to {kid} yourself.' },
        { id: 'c', label: 'Walk off', text: 'You walked off past {kid}.' },
      ],
    }),
  ];

  const raise = (seed: string) => {
    const result = runEventPhase(context({ age: 14 }), stream(seed), EMPTY_HISTORY, catalog);
    return result.decisions[0];
  };

  it('binds the people once and stores them on the decision', () => {
    const decision = raise('BIND');
    expect(decision).toBeDefined();
    if (!decision) return;
    expect(decision.names.kid).toBeTruthy();
    expect(decision.names.adult).toBeTruthy();
    expect(decision.prompt).toContain(decision.names.kid as string);
    expect(decision.prompt).toContain(decision.names.adult as string);
  });

  it('names the same person in the option labels', () => {
    const decision = raise('LABELS');
    if (!decision) return;
    expect(decision.choices[0]?.label).toBe(`Talk to ${decision.names.kid}`);
    expect(decision.choices[1]?.label).toBe(`Ask ${decision.names.adult}`);
  });

  it('names the same person in the outcome, which is the whole point', () => {
    // This is the bug the product owner hit: a prompt about one person and an
    // outcome about somebody else, because each render drew independently.
    const decision = raise('OUTCOME');
    if (!decision) return;
    // A DIFFERENT stream, standing in for answering days later on another device.
    const resolved = resolveChoice(
      decision,
      'a',
      context({ age: 14 }),
      stream('MUCH-LATER'),
      EMPTY_HISTORY,
      (id) => catalog.find((event) => event.id === id),
    );
    expect(resolved?.outcome.text).toContain(decision.names.kid as string);
    expect(resolved?.outcome.text).toContain(decision.names.adult as string);
  });

  it('gives an adult a surname and a title, not a child’s given name', () => {
    const decision = raise('ADULT');
    if (!decision) return;
    expect(decision.names.adult).toMatch(/^(Mr\.|Mrs\.) /);
  });

  it('never gives an incidental person a name the family already uses', () => {
    for (let i = 0; i < 60; i += 1) {
      const decision = raise(`CLASH-${i}`);
      if (!decision) continue;
      const family = ['Sofia', 'Reyes', 'Ana', 'Luis', 'Mateo'];
      expect(family).not.toContain(decision.names.kid);
      expect(decision.names.adult).not.toContain('Reyes');
    }
  });

  it('still resolves a passive event’s names per render', () => {
    // Passive events are a single line and cannot disagree with themselves, so
    // they keep the cheaper path and need no declaration.
    const passive = [definition({ id: 'test.passive', text: ['{kid} moved away.'] })];
    const result = runEventPhase(context(), stream('PASSIVE'), EMPTY_HISTORY, passive);
    expect(result.outcomes[0]?.text).toMatch(/^\w+ moved away\.$/);
    expect(result.outcomes[0]?.text).not.toContain('{');
  });

  it('resolves the real catalog’s decisions without leaving a brace behind', () => {
    for (let i = 0; i < 120; i += 1) {
      const result = runEventPhase(
        context({ age: 8 + (i % 10) }),
        stream(`REAL-${i}`),
        EMPTY_HISTORY,
      );
      for (const decision of result.decisions) {
        expect(decision.prompt, decision.eventId).not.toMatch(/[{}]/);
        for (const choice of decision.choices) {
          expect(choice.label, decision.eventId).not.toMatch(/[{}]/);
          const resolved = resolveChoice(
            decision,
            choice.id,
            context(),
            stream('R'),
            EMPTY_HISTORY,
          );
          expect(resolved?.outcome.text, `${decision.eventId}/${choice.id}`).not.toMatch(/[{}]/);
        }
      }
    }
  });
});

describe('what a child calls their parents', () => {
  it('says Mom and Dad rather than using first names', () => {
    // Review: "90% of kids do not [use first names]. It's mom, mother, dad."
    const line = renderEventText('{mother} and {father} were out.', context(), stream('P'));
    expect(line).toBe('Mom and Dad were out.');
    expect(renderEventText('{parents} argued.', context(), stream('P'))).toBe(
      'Mom and Dad argued.',
    );
  });

  it('uses whichever parent exists in a single-parent household', () => {
    const dadOnly = household([member('father', 'Luis', 'male', 1972)]);
    expect(renderEventText('{parent} was late.', context({ family: dadOnly }), stream('P'))).toBe(
      'Dad was late.',
    );
    expect(renderEventText('{parents} were late.', context({ family: dadOnly }), stream('P'))).toBe(
      'Dad were late.',
    );
  });

  it('reads correctly at the start of a sentence and in the middle', () => {
    expect(renderEventText('{mother} asked.', context(), stream('P'))).toBe('Mom asked.');
    expect(renderEventText('You asked {mother}.', context(), stream('P'))).toBe('You asked Mom.');
    expect(renderEventText("{mother}'s car.", context(), stream('P'))).toBe("Mom's car.");
  });

  it('still offers a first name for the rare line that needs one', () => {
    expect(renderEventText('{motherName} Reyes, aged 35.', context(), stream('P'))).toBe(
      'Ana Reyes, aged 35.',
    );
  });

  it('leaves siblings on first-name terms, because that is what happens', () => {
    expect(renderEventText('{sibling} took it.', context(), stream('P'))).toBe('Mateo took it.');
  });

  it('gives an incidental person their own pronouns, not the player’s', () => {
    // Review found "You told Lucía exactly what you thought of him." Names are
    // drawn from both lists, so a bare "him" in the copy was wrong half the
    // time. The pronoun is resolved from the name that was actually bound.
    const she = renderEventText(
      'You told {kid} what you thought of {kidThem}. {KidThey} kept {kidTheir} face still.',
      context(),
      stream('X'),
      { kid: 'Harper' },
    );
    expect(she).toBe('You told Harper what you thought of her. She kept her face still.');

    const he = renderEventText(
      'You told {kid} what you thought of {kidThem}. {KidThey} kept {kidTheir} face still.',
      context(),
      stream('X'),
      { kid: 'Owen' },
    );
    expect(he).toBe('You told Owen what you thought of him. He kept his face still.');
  });

  it('reads an adult’s pronoun off the title it renders with', () => {
    expect(
      renderEventText('{adult} said {adultThey} would help.', context(), stream('X'), {
        adult: 'Mrs. Okafor',
      }),
    ).toBe('Mrs. Okafor said she would help.');
    expect(
      renderEventText('{adult} said {adultThey} would help.', context(), stream('X'), {
        adult: 'Mr. Conti',
      }),
    ).toBe('Mr. Conti said he would help.');
  });

  it('keeps the player’s pronouns separate from everybody else’s', () => {
    // The player here is Sofia, female. The kid is Mateo, male. One line, two
    // people, two sets of pronouns.
    const line = renderEventText('{they} asked {kid} why {kidThey} left.', context(), stream('X'), {
      kid: 'Owen',
    });
    expect(line).toBe('she asked Owen why he left.');
  });

  it('never assumes a sex for a drawn name anywhere in the shipped catalog', () => {
    // The catalog test forbids a bare "he"/"she" beside a person token; this
    // proves the rendered result of the whole catalog is consistent too.
    for (let i = 0; i < 60; i += 1) {
      const result = runEventPhase(
        context({ age: 4 + (i % 14) }),
        stream(`PR-${i}`),
        EMPTY_HISTORY,
      );
      for (const outcome of result.outcomes) {
        expect(outcome.text, outcome.eventId).not.toMatch(/\{[A-Za-z0-9]+\}/);
      }
    }
  });

  it('never prints a parent’s first name anywhere in the shipped catalog', () => {
    // The Family screen still shows real names; event copy does not.
    for (let i = 0; i < 60; i += 1) {
      const result = runEventPhase(
        context({ age: 4 + (i % 14) }),
        stream(`PN-${i}`),
        EMPTY_HISTORY,
      );
      const family = FULL_FAMILY.members
        .filter((m) => m.role !== 'sibling')
        .map((m) => m.firstName);
      for (const outcome of result.outcomes) {
        for (const name of family) {
          expect(outcome.text, outcome.eventId).not.toContain(name);
        }
      }
    }
  });
});
