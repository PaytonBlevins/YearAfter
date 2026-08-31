/**
 * Ticket 0203 — catalog integrity.
 *
 * `scripts/generate-events.py` checks all of this before it writes the file, but
 * the JSON is the thing that ships and it can be hand-edited. These tests run
 * against the shipped catalog, so an edit that skips the generator still fails.
 */

import { describe, expect, it } from 'vitest';
import { TALENT_KEYS, VISIBLE_STAT_KEYS } from '@yearafter/character';
import { WEALTH_BANDS } from '@yearafter/relationships';
import {
  CHILDHOOD_EVENTS,
  EVENT_CATEGORIES,
  RARITY_WEIGHT,
  SELECTABLE_EVENTS,
  findEvent,
  type EventCondition,
  type EventDefinition,
} from './events';

const TOKEN = /\{([a-zA-Z0-9]+)\}/g;
const FREE_TOKENS = new Set(['me', 'city', 'kid', 'kid2', 'they', 'them', 'their']);
const TOKEN_GUARDS: Record<string, string[]> = {
  mother: ['mother', 'bothParents'],
  father: ['father', 'bothParents'],
  parent: ['mother', 'father', 'anyParent', 'bothParents', 'singleParent'],
  parents: ['bothParents'],
  sibling: ['sibling', 'siblings2', 'olderSibling'],
  siblingRel: ['sibling', 'siblings2', 'olderSibling'],
  olderSibling: ['olderSibling'],
};

function guaranteed(event: EventDefinition, extra: EventCondition | undefined): Set<string> {
  const required = new Set<string>([
    ...(event.eligibility.requires ?? []),
    ...(extra?.requires ?? []),
  ]);
  if (required.has('bothParents')) {
    required.add('mother');
    required.add('father');
  }
  if (required.has('siblings2') || required.has('olderSibling')) required.add('sibling');
  if (['mother', 'father', 'bothParents', 'singleParent'].some((key) => required.has(key))) {
    required.add('anyParent');
  }
  return required;
}

function textsOf(event: EventDefinition): { text: string; extra?: EventCondition }[] {
  const all: { text: string; extra?: EventCondition }[] = event.text.map((text) => ({ text }));
  for (const choice of event.choices ?? []) {
    if (choice.text) all.push({ text: choice.text, extra: choice.requires });
    for (const outcome of choice.outcomes ?? []) {
      all.push({ text: outcome.text, extra: choice.requires });
    }
  }
  return all;
}

describe('the childhood catalog', () => {
  it('holds the number of events the product owner approved for 0203', () => {
    // Spec 1656 asks for 75-150; the approved target for this ticket is 250-500.
    expect(CHILDHOOD_EVENTS.length).toBeGreaterThanOrEqual(250);
    expect(CHILDHOOD_EVENTS.length).toBeLessThanOrEqual(500);
  });

  it('gives every event a unique id', () => {
    const ids = CHILDHOOD_EVENTS.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every category', () => {
    for (const category of EVENT_CATEGORIES) {
      const count = CHILDHOOD_EVENTS.filter((event) => event.category === category).length;
      expect(count, category).toBeGreaterThanOrEqual(20);
    }
  });

  it('uses only known categories, rarities, stats, talents and wealth bands', () => {
    const stats = new Set<string>(VISIBLE_STAT_KEYS);
    const talents = new Set<string>(TALENT_KEYS);
    const bands = new Set<string>(WEALTH_BANDS);

    const checkCondition = (condition: EventCondition, where: string) => {
      for (const key of Object.keys(condition.statAtLeast ?? {})) {
        expect(stats.has(key), `${where} statAtLeast.${key}`).toBe(true);
      }
      for (const key of Object.keys(condition.statAtMost ?? {})) {
        expect(stats.has(key), `${where} statAtMost.${key}`).toBe(true);
      }
      for (const key of [...(condition.talentsAny ?? []), ...(condition.talentsNone ?? [])]) {
        expect(talents.has(key), `${where} talent ${key}`).toBe(true);
      }
      for (const band of condition.wealthAny ?? []) {
        expect(bands.has(band), `${where} wealth ${band}`).toBe(true);
      }
    };

    for (const event of CHILDHOOD_EVENTS) {
      expect(EVENT_CATEGORIES).toContain(event.category);
      expect(Object.keys(RARITY_WEIGHT)).toContain(event.rarity);
      expect(event.weight, event.id).toBeGreaterThan(0);
      checkCondition(event.eligibility, `${event.id} eligibility`);
      for (const modifier of event.modifiers ?? []) {
        checkCondition(modifier.when, `${event.id} modifier`);
        expect(modifier.multiply, event.id).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('never uses a person token the eligibility does not guarantee', () => {
    // This is the bug that renders "{mother} read to you" as "your mom read to
    // you" in a household with no mother — technically handled, quietly wrong.
    for (const event of CHILDHOOD_EVENTS) {
      for (const { text, extra } of textsOf(event)) {
        const have = guaranteed(event, extra);
        for (const match of text.matchAll(TOKEN)) {
          const token = match[1] as string;
          if (FREE_TOKENS.has(token)) continue;
          const guard = TOKEN_GUARDS[token];
          expect(guard, `${event.id}: unknown token {${token}}`).toBeDefined();
          expect(
            guard?.some((requirement) => have.has(requirement)),
            `${event.id}: {${token}} in ${JSON.stringify(text)}`,
          ).toBe(true);
        }
      }
    }
  });

  it('gives every decision at least two choices that are always available', () => {
    for (const event of CHILDHOOD_EVENTS) {
      const isDecision = event.type === 'decision' || event.type === 'opportunity';
      if (!isDecision) {
        expect(event.choices ?? [], event.id).toHaveLength(0);
        continue;
      }
      const choices = event.choices ?? [];
      expect(choices.length, event.id).toBeGreaterThanOrEqual(2);
      expect(choices.filter((choice) => !choice.requires).length, event.id).toBeGreaterThanOrEqual(
        2,
      );
      expect(new Set(choices.map((choice) => choice.id)).size, event.id).toBe(choices.length);
      for (const choice of choices) {
        expect(Boolean(choice.text) !== Boolean(choice.outcomes), `${event.id}/${choice.id}`).toBe(
          true,
        );
        expect(choice.label.length, `${event.id}/${choice.id}`).toBeLessThanOrEqual(26);
        for (const outcome of choice.outcomes ?? []) {
          expect(outcome.weight, `${event.id}/${choice.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('points every follow-up at a real event that can only be reached that way', () => {
    const scheduled = new Set<string>();
    const followUps = (event: EventDefinition) => [
      ...(event.followUp ? [event.followUp] : []),
      ...(event.choices ?? []).flatMap((choice) => [
        ...(choice.followUp ? [choice.followUp] : []),
        ...(choice.outcomes ?? []).flatMap((o) => (o.followUp ? [o.followUp] : [])),
      ]),
    ];

    for (const event of CHILDHOOD_EVENTS) {
      for (const follow of followUps(event)) {
        const target = findEvent(follow.eventId);
        expect(target, `${event.id} -> ${follow.eventId}`).toBeDefined();
        expect(target?.type, follow.eventId).toBe('followUp');
        expect(follow.inYears).toBeGreaterThanOrEqual(1);
        scheduled.add(follow.eventId);
      }
    }

    for (const event of CHILDHOOD_EVENTS) {
      if (event.type === 'followUp') {
        expect(scheduled.has(event.id), `${event.id} is never scheduled`).toBe(true);
      }
    }
  });

  it('keeps follow-ups out of the randomly selectable pool', () => {
    expect(SELECTABLE_EVENTS.every((event) => event.type !== 'followUp')).toBe(true);
    expect(SELECTABLE_EVENTS.length).toBeLessThan(CHILDHOOD_EVENTS.length);
  });

  it('has no unreachable age window', () => {
    for (const event of CHILDHOOD_EVENTS) {
      const { ageMin, ageMax } = event.eligibility;
      if (ageMin !== undefined && ageMax !== undefined) {
        expect(ageMin, event.id).toBeLessThanOrEqual(ageMax);
      }
    }
  });

  it('offers every age enough events that no household runs dry', () => {
    // The engine throws on an empty year; this is what stops that being possible.
    // Adult ages are sampled too: the year loop does not stop at eighteen, and
    // the adult placeholder block in the catalog is what keeps it honest until
    // the adult libraries land.
    const ages = [...Array.from({ length: 18 }, (_, age) => age), 18, 25, 40, 60, 80, 100];
    for (const age of ages) {
      const universal = CHILDHOOD_EVENTS.filter((event) => {
        const e = event.eligibility;
        if (event.type !== 'passive') return false;
        if ((e.ageMin ?? 0) > age || (e.ageMax ?? 130) < age) return false;
        return (
          !e.requires &&
          !e.talentsAny &&
          !e.wealthAny &&
          !e.statAtLeast &&
          !e.statAtMost &&
          !e.flagsAll &&
          !e.relationshipAtLeast &&
          !e.relationshipAtMost &&
          !e.sex
        );
      });
      expect(universal.length, `age ${age}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps the writing concise and finished', () => {
    for (const event of CHILDHOOD_EVENTS) {
      for (const { text } of textsOf(event)) {
        expect(text.trim().length, event.id).toBeGreaterThan(0);
        expect(text.length, `${event.id}: ${text}`).toBeLessThanOrEqual(220);
        expect(text.trim().slice(-1), `${event.id}: ${text}`).toMatch(/[.!?"']/);
      }
    }
  });
});
