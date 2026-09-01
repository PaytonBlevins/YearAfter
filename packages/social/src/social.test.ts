/**
 * Ticket 0206 acceptance tests.
 *
 * The failure modes worth guarding are the ones a screenshot would find far too
 * late: a player who ends childhood with thirty best friends, a menu where
 * nothing can go wrong, and people who vanish when you look away.
 */

import { describe, expect, it } from 'vitest';
import { createPersonality } from '@yearafter/character';
import { asNpcId } from '@yearafter/core';
import {
  DRIFT_OUT_THRESHOLD,
  INTERACTIONS,
  MINOR_MEMORY_LIMIT,
  bondOf,
  chanceOf,
  displayName,
  driftPerson,
  interactionsFor,
  isCurrent,
  isFriend,
  remember,
  resolveInteraction,
  type Acquaintance,
} from './index';

const peer = (overrides: Partial<Acquaintance> = {}): Acquaintance => ({
  id: asNpcId('npc:peer-1'),
  firstName: 'Wren',
  lastName: 'Okafor',
  sex: 'female',
  birthYear: 2000,
  alive: true,
  tier: 3,
  personality: createPersonality(),
  relationship: 40,
  kind: 'peer',
  context: 'school',
  metAtAge: 6,
  lastContactAge: 6,
  memories: [],
  inClass: false,
  ...overrides,
});

const teacher = (overrides: Partial<Acquaintance> = {}): Acquaintance =>
  peer({
    id: asNpcId('npc:teacher-1'),
    kind: 'teacher',
    title: 'Mrs.',
    subject: 'English',
    relationship: 55,
    ...overrides,
  });

describe('who people are', () => {
  it('calls a classmate by their first name and a teacher by their title', () => {
    // The same rule the event text follows for {adult}: a child does not call a
    // forty-year-old by their given name.
    expect(displayName(peer({ firstName: 'Wren' }))).toBe('Wren');
    expect(displayName(teacher({ lastName: 'Okafor' }))).toBe('Mrs. Okafor');
  });

  it('derives closeness rather than storing it', () => {
    expect(bondOf(peer({ relationship: 10 }))).toBe('know of them');
    expect(bondOf(peer({ relationship: 55 }))).toBe('friend');
    expect(bondOf(peer({ relationship: 95 }))).toBe('best friend');
  });

  it('does not call a teacher a best friend, however well it is going', () => {
    expect(bondOf(teacher({ relationship: 100 }))).toBe('friend');
    expect(isFriend(teacher({ relationship: 100 }))).toBe(false);
  });
});

describe('memory', () => {
  it('keeps what mattered and lets the small things fade', () => {
    // Spec 771-785: minor memories may decay, major ones persist.
    let person = peer();
    for (let i = 0; i < MINOR_MEMORY_LIMIT + 4; i += 1) {
      person = remember(person, { age: 7 + i, text: `minor ${i}`, major: false, warmth: 1 });
    }
    person = remember(person, { age: 20, text: 'the big one', major: true, warmth: 10 });
    for (let i = 0; i < MINOR_MEMORY_LIMIT + 4; i += 1) {
      person = remember(person, { age: 21 + i, text: `later ${i}`, major: false, warmth: 1 });
    }
    expect(person.memories.map((m) => m.text)).toContain('the big one');
    expect(person.memories.filter((m) => !m.major).length).toBeLessThanOrEqual(MINOR_MEMORY_LIMIT);
    expect(person.memories.map((m) => m.text)).not.toContain('minor 0');
  });

  it('promotes somebody who starts to matter, and never demotes them', () => {
    // Spec 674-683: promotion without rewriting history. A tier only climbs.
    const stranger = peer({ tier: 3 });
    const known = remember(stranger, { age: 8, text: 'sat together', major: false, warmth: 4 });
    expect(known.tier).toBe(2);
    const close = remember(known, { age: 9, text: 'told them', major: true, warmth: 12 });
    expect(close.tier).toBe(1);
    const later = remember(close, { age: 10, text: 'small thing', major: false, warmth: 1 });
    expect(later.tier).toBe(1);
  });

  it('records what an event did, so it can be explained later', () => {
    const person = remember(peer({ relationship: 40 }), {
      age: 9,
      text: 'covered for you',
      major: true,
      warmth: 12,
    });
    expect(person.relationship).toBe(52);
    expect(person.memories[0]?.warmth).toBe(12);
  });
});

describe('drift', () => {
  it('cools a friendship you stop turning up to', () => {
    // Without this a player collects friends the way they collect items, and
    // finishes childhood with thirty of them, all at 90.
    const person = peer({ relationship: 70, lastContactAge: 10 });
    const later = driftPerson(person, 13);
    expect(later.relationship).toBeLessThan(70);
  });

  it('eventually lets somebody out of your life, without deleting them', () => {
    // Spec 771-785 keeps reconciliation possible, and a childhood you can look
    // back on has to include the people who left it.
    let person = peer({ relationship: 40, lastContactAge: 8 });
    person = driftPerson(person, 14);
    expect(person.relationship).toBeLessThanOrEqual(DRIFT_OUT_THRESHOLD);
    expect(isCurrent(person)).toBe(false);
    expect(person.endedBecause).toBe('drifted');
  });

  it('leaves a year you actually spent together alone', () => {
    const person = peer({ relationship: 70, lastContactAge: 12 });
    expect(driftPerson(person, 12).relationship).toBe(70);
  });

  it('does not drift somebody who is in the room every weekday', () => {
    // Reading output found the first version turning the whole class over every
    // September: classmates start around 30, drift costs 7 a year, and the
    // drift-out floor is 22. Being in the same class IS contact.
    const person = peer({ relationship: 30, lastContactAge: 6, inClass: true });
    expect(driftPerson(person, 12).relationship).toBe(30);
    expect(isCurrent(driftPerson(person, 12))).toBe(true);
  });

  it('does not drift a teacher, who leaves rather than fades', () => {
    const person = teacher({ relationship: 60, lastContactAge: 8 });
    expect(driftPerson(person, 14).relationship).toBe(60);
  });
});

describe('interactions', () => {
  it('offers a teacher and a classmate different things', () => {
    const forPeer = interactionsFor(peer()).map((entry) => entry.id);
    const forTeacher = interactionsFor(teacher()).map((entry) => entry.id);
    expect(forPeer).toContain('hang-out');
    expect(forTeacher).not.toContain('hang-out');
    expect(forTeacher).toContain('ask-about-work');
  });

  it('only offers to fix something when there is something to fix', () => {
    expect(interactionsFor(peer({ relationship: 85 })).map((e) => e.id)).not.toContain('make-up');
    expect(interactionsFor(peer({ relationship: 30 })).map((e) => e.id)).toContain('make-up');
  });

  it('does not let you confide in somebody you barely know', () => {
    expect(interactionsFor(peer({ relationship: 20 })).map((e) => e.id)).not.toContain('secret');
    expect(interactionsFor(peer({ relationship: 70 })).map((e) => e.id)).toContain('secret');
  });

  it('can always go badly, at every level of friendship', () => {
    // CORE_RULES 13.4: a menu where every option is neutral-or-better is a
    // reward with extra steps.
    for (const interaction of INTERACTIONS) {
      const close = chanceOf(interaction, peer({ relationship: 100 }), 100);
      expect(close, interaction.id).toBeLessThan(1);
    }
  });

  it('is easier with somebody who already likes you', () => {
    const cold = chanceOf(INTERACTIONS[0]!, peer({ relationship: 10 }), 50);
    const warm = chanceOf(INTERACTIONS[0]!, peer({ relationship: 90 }), 50);
    expect(warm).toBeGreaterThan(cold);
  });

  it('gives charisma something to do', () => {
    const shy = chanceOf(INTERACTIONS[1]!, peer(), 20);
    const easy = chanceOf(INTERACTIONS[1]!, peer(), 90);
    expect(easy).toBeGreaterThan(shy);
  });

  it('names the person in every line it can write', () => {
    for (const interaction of INTERACTIONS) {
      for (const roll of [0, 0.99]) {
        for (const variant of [0, 0.5, 0.99]) {
          const result = resolveInteraction(interaction, peer(), 50, 'Wren', roll, variant);
          expect(result.text, `${interaction.id} ${roll}`).not.toContain('{');
          expect(result.text.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it('costs something when it does not land', () => {
    for (const interaction of INTERACTIONS) {
      const bad = resolveInteraction(interaction, peer(), 50, 'Wren', 0.999, 0);
      expect(bad.worked, interaction.id).toBe(false);
      expect(bad.warmth, interaction.id).toBeLessThan(0);
    }
  });
});
