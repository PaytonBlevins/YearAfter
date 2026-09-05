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
/** People the engine invents. A decision must declare these to bind them once. */
const INCIDENTAL = new Set(['kid', 'kid2', 'adult']);
/**
 * An incidental person's own pronoun tokens, mapped to the person they belong
 * to. Review found "You told Lucía exactly what you thought of him" — the names
 * come from both lists, so their pronouns have to be resolved, not written.
 */
const PERSON_OF = new Map<string, string>([...INCIDENTAL].map((token) => [token, token]));
for (const person of INCIDENTAL) {
  for (const grammaticalCase of ['They', 'Them', 'Their']) {
    PERSON_OF.set(`${person}${grammaticalCase}`, person);
  }
}
const FREE_TOKENS = new Set(['me', 'city', 'they', 'them', 'their', ...PERSON_OF.keys()]);
/** {they}/{them}/{their} are the PLAYER's pronouns, never an incidental person's. */
const PLAYER_PRONOUNS = new Set(['they', 'them', 'their']);
/** Bare gendered pronouns, which a line naming an incidental person must not use. */
const BARE_PRONOUN = /\b(he|him|his|she|her|hers)\b/i;
/** A capitalised token is the same token at the start of a sentence. */
const norm = (token: string): string => token.charAt(0).toLowerCase() + token.slice(1);
const LABEL_NOISE = new Set(['the', 'a', 'an', 'to', 'for', 'it', 'them', 'your', 'my', 's']);

/** Opening phrase of a choice label, for the intensity check (V2). */
function labelStem(label: string): string {
  return label
    .replace(/\{[a-zA-Z0-9]+\}/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z]/g, ''))
    .filter((word) => word && !LABEL_NOISE.has(word))
    .slice(0, 2)
    .join(' ');
}

function isDecision(event: EventDefinition): boolean {
  return event.type === 'decision' || event.type === 'opportunity';
}

/** Every result a decision can produce, with the choice's own effects folded in. */
function resultsOf(event: EventDefinition) {
  const results: { text: string; effects?: EventDefinition['effects'] }[] = [];
  for (const choice of event.choices ?? []) {
    if (choice.text) results.push({ text: choice.text, effects: choice.effects });
    for (const outcome of choice.outcomes ?? []) {
      results.push({
        text: outcome.text,
        effects: { ...choice.effects, ...outcome.effects },
      });
    }
  }
  return results;
}
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
          const token = norm(match[1] as string);
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
        // Labels wrap on the decision card rather than truncating, so two
        // lines is survivable and an essay is not.
        expect(choice.label.length, `${event.id}/${choice.id}`).toBeLessThanOrEqual(38);
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

  it('gives every decision three real options, or says why not (V1)', () => {
    // "Do it / don't" is not a decision. Some situations genuinely have two
    // answers, and those declare `binaryOk` rather than being padded with a
    // third option nobody would ever take.
    for (const event of CHILDHOOD_EVENTS) {
      if (!isDecision(event)) continue;
      const count = (event.choices ?? []).length;
      if (count < 3) {
        expect(event.binaryOk, `${event.id} has ${count} options`).toBe(true);
      }
    }
  });

  it('offers different tactics, not one tactic at two volumes (V2)', () => {
    for (const event of CHILDHOOD_EVENTS) {
      if (!isDecision(event)) continue;
      const stems = (event.choices ?? []).map((choice) => labelStem(choice.label));
      const seen = new Set<string>();
      for (const stem of stems) {
        if (!stem) continue;
        expect(seen.has(stem), `${event.id}: two options open with "${stem}"`).toBe(false);
        seen.add(stem);
      }
    }
  });

  it('moves happiness, and can always land badly (V3)', () => {
    // A decision every branch of which is neutral-or-better is not a decision,
    // it is a reward with extra steps.
    for (const event of CHILDHOOD_EVENTS) {
      if (!isDecision(event)) continue;
      const happiness = resultsOf(event).map((result) => result.effects?.stats?.happiness ?? 0);
      expect(
        happiness.some((value) => value !== 0),
        `${event.id} never moves happiness`,
      ).toBe(true);
      expect(Math.min(...happiness), `${event.id} cannot land badly`).toBeLessThan(0);
      if (event.physical) {
        const health = resultsOf(event).map((result) => result.effects?.stats?.health ?? 0);
        expect(
          health.some((value) => value !== 0),
          `${event.id} is physical but health never moves`,
        ).toBe(true);
      }
    }
  });

  it('names the amount in the line the player reads, whenever money moves (V4)', () => {
    const check = (
      cash: { delta: number; source: string } | undefined,
      text: string,
      where: string,
    ) => {
      if (!cash) return;
      expect(cash.source.trim().length, `${where} moves money with no source`).toBeGreaterThan(0);
      const amount = Math.abs(cash.delta);
      const written = [`$${amount}`, `$${amount.toLocaleString('en-US')}`];
      expect(
        written.some((form) => text.includes(form)),
        `${where} moves $${amount} but the text does not say so: ${text}`,
      ).toBe(true);
    };

    for (const event of CHILDHOOD_EVENTS) {
      check(event.effects?.cash, event.text.join(' '), event.id);
      for (const choice of event.choices ?? []) {
        if (choice.text) check(choice.effects?.cash, choice.text, `${event.id}/${choice.id}`);
        for (const outcome of choice.outcomes ?? []) {
          check(
            { ...choice.effects, ...outcome.effects }.cash,
            outcome.text,
            `${event.id}/${choice.id} outcome`,
          );
        }
      }
    }
  });

  it('declares every person a decision names, so one name carries through (V5)', () => {
    for (const event of CHILDHOOD_EVENTS) {
      if (!isDecision(event)) continue;
      const declared = new Set(event.personTokens ?? []);
      const used = new Set<string>();
      const collect = (text: string) => {
        for (const match of text.matchAll(TOKEN)) {
          const token = norm(match[1] as string);
          const person = PERSON_OF.get(token);
          if (person) used.add(person);
        }
      };
      event.text.forEach(collect);
      for (const choice of event.choices ?? []) {
        collect(choice.label);
        if (choice.text) collect(choice.text);
        for (const outcome of choice.outcomes ?? []) collect(outcome.text);
      }
      for (const token of used) {
        expect(declared.has(token), `${event.id} uses {${token}} without declaring it`).toBe(true);
      }
      for (const token of declared) {
        expect(used.has(token), `${event.id} declares {${token}} but never uses it`).toBe(true);
      }
    }
  });

  it('never uses a player pronoun for somebody else', () => {
    // "You asked {kid} how {they} did it" renders the PLAYER's gender for the
    // other person. Incidental people have no gender; they get named.
    for (const event of CHILDHOOD_EVENTS) {
      for (const { text } of textsOf(event)) {
        const tokens = new Set([...text.matchAll(TOKEN)].map((match) => norm(match[1] as string)));
        const namesSomeone = [...tokens].some((token) => PERSON_OF.has(token));
        const usesPronoun = [...tokens].some((token) => PLAYER_PRONOUNS.has(token));
        expect(namesSomeone && usesPronoun, `${event.id}: ${text}`).toBe(false);
      }
    }
  });

  it('never assumes the sex of a person whose name it drew', () => {
    // "You told Lucía exactly what you thought of him." The pool is male AND
    // female, so a bare pronoun is wrong half the time. {kidThey} and friends
    // are resolved from the name that was actually bound.
    for (const event of CHILDHOOD_EVENTS) {
      for (const { text } of textsOf(event)) {
        const tokens = new Set([...text.matchAll(TOKEN)].map((match) => norm(match[1] as string)));
        if (![...tokens].some((token) => PERSON_OF.has(token))) continue;
        expect(BARE_PRONOUN.test(text.replace(TOKEN, ' ')), `${event.id}: ${text}`).toBe(false);
      }
    }
  });

  it('never spends money the character might not have (V7)', () => {
    // Reading output found a fourteen-year-old holding $60 told "the coffee can
    // under your bed has $150 in it", spending it, and finishing on $0 — the
    // balance floored and the prose lying about it.
    for (const event of CHILDHOOD_EVENTS) {
      let biggest = 0;
      const consider = (effects?: { cash?: { delta: number } }) => {
        const delta = effects?.cash?.delta ?? 0;
        if (delta < 0) biggest = Math.max(biggest, -delta);
      };
      consider(event.effects);
      for (const choice of event.choices ?? []) {
        consider(choice.effects);
        for (const outcome of choice.outcomes ?? []) consider(outcome.effects);
      }
      if (biggest > 0) {
        expect(
          event.eligibility.cashAtLeast ?? 0,
          `${event.id} spends $${biggest}`,
        ).toBeGreaterThanOrEqual(biggest);
      }
    }
  });

  it('lets stress go down as well as up (V6)', () => {
    // A catalog whose stress effects are all positive makes stress a ratchet —
    // a second health bar every character loses by eighteen, which is the
    // separate visible mental-health system spec 1030 forbids under a new name.
    let up = 0;
    let down = 0;
    for (const event of CHILDHOOD_EVENTS) {
      const collect = (effects?: { stress?: number }) => {
        const stress = effects?.stress;
        if (stress === undefined) return;
        expect(stress, event.id).not.toBe(0);
        expect(stress, event.id).toBeGreaterThanOrEqual(-25);
        expect(stress, event.id).toBeLessThanOrEqual(40);
        if (stress > 0) up += 1;
        else down += 1;
      };
      collect(event.effects);
      for (const choice of event.choices ?? []) {
        collect(choice.effects);
        for (const outcome of choice.outcomes ?? []) collect(outcome.effects);
      }
    }
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThanOrEqual(Math.max(4, up / 4));
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
