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
  MAX_LIGHT_PRESSES,
  ROMANCE_MOVES,
  ROMANCE_STAGE_LABELS,
  MINOR_MEMORY_LIMIT,
  bondOf,
  chanceOf,
  displayName,
  driftPerson,
  findInteraction,
  interactionsFor,
  lightLeft,
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
  inRoom: false,
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
    const person = peer({ relationship: 30, lastContactAge: 6, inRoom: true });
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

  it('lets light things repeat, and heavy things not', () => {
    // Review: "I don't like how you can only perform one action with your
    // classmate per year." The wall is gone; what is left is the handful of
    // things nobody can honestly do twice in a year.
    const light = INTERACTIONS.filter((entry) => entry.weight === 'light').map((e) => e.id);
    const heavy = INTERACTIONS.filter((entry) => entry.weight === 'heavy').map((e) => e.id);
    expect(light).toContain('hang-out');
    expect(light).toContain('compliment');
    expect(heavy).toContain('secret');
    expect(heavy).toContain('fall-out');
  });

  it('makes a repeated afternoon worth less, and eventually nothing', () => {
    const first = resolveInteraction(INTERACTIONS[0]!, peer(), 50, 'Wren', 0, 0, 0);
    const third = resolveInteraction(INTERACTIONS[0]!, peer(), 50, 'Wren', 0, 0, 2);
    expect(third.warmth).toBeLessThan(first.warmth);
    expect(third.warmth).toBeGreaterThan(0);

    // And it stops, in a sentence rather than by the button going dead.
    const worn = resolveInteraction(INTERACTIONS[0]!, peer(), 50, 'Wren', 0, 0, 9);
    expect(worn.worn).toBe(true);
    expect(worn.warmth).toBe(0);
    expect(worn.text).toContain('Wren');
    expect(lightLeft(9)).toBe(0);
  });

  it('gives a teacher an innocent menu and a mischievous one', () => {
    // Review: "I should also be able to interact with my teacher (innocently
    // and mischievously)."
    const menu = interactionsFor(teacher());
    expect(menu.some((entry) => !entry.mischief)).toBe(true);
    expect(menu.some((entry) => entry.mischief)).toBe(true);
    expect(menu.map((e) => e.id)).toContain('talk-back');
  });

  it('makes mischief cost school standing, and nothing else does', () => {
    // Routed through the same field events use, so winding a teacher up all
    // year can genuinely land a character in an alternative school (spec 73).
    for (const interaction of INTERACTIONS) {
      if (interaction.mischief) {
        expect(interaction.behaviour, interaction.id).toBeLessThan(0);
      }
      if (interaction.kind === 'peer') {
        expect(interaction.behaviour, interaction.id).toBeUndefined();
      }
    }
    const caught = resolveInteraction(
      findInteraction('talk-back')!,
      teacher(),
      50,
      'Mrs. X',
      0.99,
      0,
    );
    expect(caught.behaviour).toBeLessThan(0);
  });

  it('costs less standing when you get away with it', () => {
    const away = resolveInteraction(findInteraction('skip-class')!, teacher(), 50, 'Mrs. X', 0, 0);
    const caught = resolveInteraction(
      findInteraction('skip-class')!,
      teacher(),
      50,
      'Mrs. X',
      0.99,
      0,
    );
    expect(Math.abs(away.behaviour)).toBeLessThan(Math.abs(caught.behaviour));
    expect(away.behaviour).toBeLessThan(0);
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
      const subject = interaction.kind === 'teacher' ? teacher() : peer();
      const bad = resolveInteraction(interaction, subject, 50, 'Wren', 0.999, 0);
      expect(bad.worked, interaction.id).toBe(false);
      expect(bad.warmth, interaction.id).toBeLessThan(0);
    }
  });
});

/**
 * Ticket 0207 found this rule in the 0206 copy, four tickets after it shipped.
 *
 * A light interaction can land four times in a year (`repeatScale` reaches zero
 * on the fifth), and `resolveInteraction` rotates its line by how many have
 * gone already so that a repeat reads differently. A set with fewer lines than
 * that wraps, and the player gets the same sentence twice — which is exactly
 * what reading a year of romance output turned up, from a three-line set.
 *
 * The rule is invisible by inspection and trivial to break by writing copy, so
 * it is asserted rather than remembered.
 */
describe('repeatable copy', () => {
  it('gives every repeatable line set enough lines not to wrap', () => {
    const light = INTERACTIONS.filter((entry) => entry.weight === 'light');
    for (const interaction of light) {
      const seen = new Map<boolean, Set<string>>([
        [true, new Set()],
        [false, new Set()],
      ]);
      // Every phrasing draw, at every repeat a year allows.
      for (let repeat = 0; repeat < MAX_LIGHT_PRESSES; repeat += 1) {
        for (const variant of [0, 0.17, 0.34, 0.51, 0.68, 0.85, 0.99]) {
          for (const roll of [0, 0.999]) {
            const result = resolveInteraction(
              interaction,
              peer({ relationship: 55, kind: interaction.kind === 'teacher' ? 'teacher' : 'peer' }),
              50,
              'Wren',
              roll,
              variant,
              repeat,
            );
            if (result.worn) continue;
            seen.get(result.worked)?.add(`${variant}|${result.text}`);
          }
        }
      }
      // For one starting draw, the four presses of a year must be four
      // different sentences.
      for (const worked of [true, false]) {
        const byVariant = new Map<string, Set<string>>();
        for (const entry of seen.get(worked) ?? []) {
          const [variant, ...rest] = entry.split('|');
          const set = byVariant.get(variant as string) ?? new Set<string>();
          set.add(rest.join('|'));
          byVariant.set(variant as string, set);
        }
        for (const [variant, texts] of byVariant) {
          expect(
            texts.size,
            `${interaction.id} (${worked ? 'good' : 'bad'}) at variant ${variant}`,
          ).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('never repeats a sentence across the presses of one year', () => {
    for (const interaction of INTERACTIONS.filter((entry) => entry.weight === 'light')) {
      for (const roll of [0, 0.999]) {
        for (const variant of [0, 0.3, 0.6, 0.9]) {
          const texts = new Set<string>();
          for (let repeat = 0; repeat < MAX_LIGHT_PRESSES; repeat += 1) {
            const result = resolveInteraction(
              interaction,
              peer({ relationship: 55, kind: interaction.kind === 'teacher' ? 'teacher' : 'peer' }),
              50,
              'Wren',
              roll,
              variant,
              repeat,
            );
            if (result.worn) continue;
            expect(texts.has(result.text), `${interaction.id}: "${result.text}"`).toBe(false);
            texts.add(result.text);
          }
        }
      }
    }
  });
});

/**
 * Ticket 0207d — a menu label says what pressing it does.
 *
 * Review, after playing the 0207 build: "'Tell them something' and 'Have it out
 * with them' does not make sense to everyone. Please make them say what they
 * mean. Much more clear please."
 *
 * These labels are harder than an event's, not easier: an event choice sits
 * under a prompt that supplies the situation, and these sit on a standing menu
 * with nothing above them. The content validator enforces the same rule on the
 * catalog (V9/V10); this is the half of the game that lives in code.
 */
describe('menu copy is plain (Ticket 0207d)', () => {
  const VAGUE = [
    'tell them something',
    'have it out with them',
    'wind them up',
    'try to fix it',
    'end it',
    'flirt',
    'propose',
    'take them out',
    'make it official',
    'say something nice',
    'stay behind and ask',
    'offer to help',
    'ask them to put in a word',
    'talk back',
    'make a joke',
  ];
  const BRITISH =
    /\b(apologise|realise|recognise|practise|maths|licence|pavement|corridor|fortnight|neighbour|favourite|colour|whilst|learnt|amongst|solicitor|wind them up)\b/i;

  const everyLabel = [
    ...INTERACTIONS.map((entry) => ({ what: entry.id, label: entry.label, blurb: entry.blurb })),
    ...ROMANCE_MOVES.map((move) => ({ what: move.id, label: move.label, blurb: move.blurb })),
  ];

  it('never uses a label review rejected, or one like it', () => {
    for (const { what, label } of everyLabel) {
      expect(VAGUE, `${what}: "${label}"`).not.toContain(label.toLowerCase());
    }
  });

  it('gives every label a verb and an object', () => {
    for (const { what, label } of everyLabel) {
      // One word is a gesture, not an instruction.
      expect(label.trim().split(/\s+/).length, `${what}: "${label}"`).toBeGreaterThanOrEqual(2);
    }
  });

  it('writes American English', () => {
    for (const { what, label, blurb } of everyLabel) {
      expect(BRITISH.test(label), `${what} label: "${label}"`).toBe(false);
      expect(BRITISH.test(blurb), `${what} blurb: "${blurb}"`).toBe(false);
    }
    for (const stage of Object.values(ROMANCE_STAGE_LABELS)) {
      expect(BRITISH.test(stage), stage).toBe(false);
    }
  });

  it('gives every option a blurb that explains it rather than winking at it', () => {
    for (const { what, blurb } of everyLabel) {
      expect(blurb.length, `${what}`).toBeGreaterThan(15);
      // A blurb that is only a fragment ("Go first, and hope.") tells a player
      // nothing about what the button does.
      expect(blurb.trim().endsWith('.'), `${what}: "${blurb}"`).toBe(true);
    }
  });
});

/**
 * Ticket 0207d — a blurb that clips is a blurb that did not explain.
 *
 * The rewrite made the labels clear and made two blurbs longer than the row,
 * so the screenshot read "Say what you really think. It could end the …" and
 * "Let them know you like them, without saying it o…". A sentence cut off
 * mid-word is exactly the unclear-copy failure this pass exists to remove, so
 * the width is a rule rather than something to notice in a screenshot later.
 *
 * 40 characters is what one row fits at the smallest supported width.
 */
describe('menu copy fits the row it renders in', () => {
  const BLURB_LIMIT = 44;
  const LABEL_LIMIT = 30;

  it('never writes a blurb that would be truncated', () => {
    for (const entry of INTERACTIONS) {
      expect(entry.blurb.length, `${entry.id}: "${entry.blurb}"`).toBeLessThanOrEqual(BLURB_LIMIT);
    }
    for (const move of ROMANCE_MOVES) {
      expect(move.blurb.length, `${move.id}: "${move.blurb}"`).toBeLessThanOrEqual(BLURB_LIMIT);
    }
  });

  it('keeps labels short enough to sit beside the odds', () => {
    for (const entry of INTERACTIONS) {
      expect(entry.label.length, `${entry.id}: "${entry.label}"`).toBeLessThanOrEqual(LABEL_LIMIT);
    }
    for (const move of ROMANCE_MOVES) {
      expect(move.label.length, `${move.id}: "${move.label}"`).toBeLessThanOrEqual(LABEL_LIMIT);
    }
  });
});
