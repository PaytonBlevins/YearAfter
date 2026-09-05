/**
 * Ticket 0207 acceptance tests.
 *
 * The first block is not a balance test and must never be relaxed to make a
 * balance test pass. It sweeps every age from 0 to 40 against every stage and
 * every move in the catalog and asserts that nothing romantic exists below
 * `CRUSH_AGE` and that nothing adult is reachable below `ADULT_AGE` — through
 * `stagesFor`, through `canAdvanceTo`, through `movesFor`, or through
 * `resolveMove` called directly with a roll that always succeeds.
 *
 * That last one matters most: `movesFor` is what the screen uses, so testing
 * only `movesFor` would prove the menu is safe and prove nothing about the
 * engine underneath it. A gate with one enforcement point is a gate a careless
 * caller walks around.
 */

import { describe, expect, it } from 'vitest';
import { createPersonality } from '@yearafter/character';
import { asNpcId } from '@yearafter/core';
import {
  ADULT_AGE,
  CRUSH_AGE,
  ROMANCE_MOVES,
  ROMANCE_TROUBLE,
  canAdvanceTo,
  compatibility,
  costOf,
  crushesOf,
  endPerson,
  exesOf,
  isRomantic,
  movesFor,
  partnerOf,
  resolveMove,
  romanceChance,
  romanceYear,
  stagesFor,
  type Acquaintance,
  type Romance,
  type RomanceStage,
} from './index';

const ALL_STAGES: readonly RomanceStage[] = [
  'interested',
  'seeing',
  'together',
  'engaged',
  'married',
];
const ADULT_ONLY: readonly RomanceStage[] = ['engaged', 'married'];
const RICH = 100_000_000;

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
  inClass: true,
  ...overrides,
});

const at = (stage: RomanceStage, since = 14): Romance => ({ stage, since });

/* -------------------------------------------------------------------------- */
/* The age gate                                                                */
/* -------------------------------------------------------------------------- */

describe('age is the first rule', () => {
  it('has no romance system at all below the crush age', () => {
    for (let age = 0; age < CRUSH_AGE; age += 1) {
      expect(stagesFor(age)).toEqual([]);
      for (const stage of ALL_STAGES) expect(canAdvanceTo(stage, age)).toBe(false);
      // Not even for somebody the player is as close to as the model allows.
      expect(movesFor(peer({ relationship: 100 }), age, RICH)).toEqual([]);
    }
  });

  it('never lists an adult stage for a minor, at any age below eighteen', () => {
    for (let age = CRUSH_AGE; age < ADULT_AGE; age += 1) {
      for (const stage of ADULT_ONLY) {
        expect(stagesFor(age)).not.toContain(stage);
        expect(canAdvanceTo(stage, age)).toBe(false);
      }
    }
  });

  it('offers a minor no move that leads anywhere adult, from any stage', () => {
    for (let age = CRUSH_AGE; age < ADULT_AGE; age += 1) {
      for (const stage of ALL_STAGES) {
        const person = peer({ relationship: 100, romance: at(stage) });
        for (const move of movesFor(person, age, RICH)) {
          expect(move.to === undefined || !ADULT_ONLY.includes(move.to)).toBe(true);
        }
      }
    }
  });

  it('refuses to advance a minor into an adult stage even called directly', () => {
    // Bypassing the menu entirely: every move, every stage, with a roll of zero
    // so the draw always succeeds and money is never the thing stopping it.
    for (let age = 0; age < ADULT_AGE; age += 1) {
      for (const stage of ALL_STAGES) {
        for (const move of ROMANCE_MOVES) {
          const person = peer({ relationship: 100, romance: at(stage) });
          const result = resolveMove(move, person, age, 1, 0, 0.5, 'Wren');
          expect(result.stage === undefined || !ADULT_ONLY.includes(result.stage)).toBe(true);
        }
      }
    }
  });

  it('opens the adult stages at eighteen and not before', () => {
    expect(stagesFor(ADULT_AGE - 1)).not.toContain('engaged');
    expect(stagesFor(ADULT_AGE)).toContain('engaged');
    expect(stagesFor(ADULT_AGE)).toContain('married');
  });

  it('only ever offers moves about a peer', () => {
    const teacher = peer({ kind: 'teacher', relationship: 100 });
    for (let age = CRUSH_AGE; age <= 40; age += 1) {
      expect(movesFor(teacher, age, RICH)).toEqual([]);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The menu                                                                    */
/* -------------------------------------------------------------------------- */

describe('what is on the menu', () => {
  it('starts a teenager with flirting and nothing else', () => {
    const ids = movesFor(peer({ relationship: 40 }), 14, RICH).map((move) => move.id);
    expect(ids).toEqual(['flirt']);
  });

  it('does not offer to ask somebody out who barely knows you', () => {
    const shy = peer({ relationship: 20, romance: at('interested') });
    expect(movesFor(shy, 15, RICH).map((move) => move.id)).not.toContain('ask-out');
  });

  it('offers ending it to somebody going out with them', () => {
    const going = peer({ relationship: 70, romance: at('together') });
    expect(movesFor(going, 16, RICH).map((move) => move.id)).toContain('break-up');
  });

  it('hides a fixed-price move the character cannot pay for', () => {
    // CORE_RULES 13.13. An evening out has a price a shop sets, so it is simply
    // not offered to somebody with nothing.
    const going = peer({ relationship: 70, romance: at('together', 20) });
    expect(movesFor(going, 22, 0).map((move) => move.id)).not.toContain('date');
    expect(movesFor(going, 22, RICH).map((move) => move.id)).toContain('date');
  });

  it('lets a broke character marry, and charges only what they have', () => {
    // The defect this encodes: priced at a flat $9,000, marriage was unreachable
    // in a build whose median thirty-year-old holds thirteen dollars, and 0% of
    // 150 lives ever got there. A wedding is what you can afford.
    const engaged = peer({ relationship: 90, romance: at('engaged', 24) });
    const marry = ROMANCE_MOVES.find((move) => move.id === 'marry')!;
    expect(movesFor(engaged, 26, 1000).map((move) => move.id)).toContain('marry');

    for (const cash of [0, 1000, 500_000, 100_000_000]) {
      expect(costOf(marry, cash)).toBeLessThanOrEqual(cash);
      const wedding = resolveMove(marry, engaged, 26, 0.9, 0, 0.5, 'Wren', 0, cash);
      expect(wedding.spent).toBeLessThanOrEqual(cash);
    }
    // And it is capped, so a fortune does not vanish into one day.
    expect(costOf(marry, 100_000_000)).toBe(marry.costCap);
  });

  it('does not charge for a proposal that was turned down', () => {
    const together = peer({ relationship: 80, romance: at('together', 20) });
    const propose = ROMANCE_MOVES.find((move) => move.id === 'propose')!;
    const no = resolveMove(propose, together, 24, 0.4, 0.99, 0.5, 'Wren', 0, 1_000_000);
    expect(no.spent).toBe(0);
    const yes = resolveMove(propose, together, 24, 0.9, 0, 0.5, 'Wren', 0, 1_000_000);
    expect(yes.spent).toBeGreaterThan(0);
  });

  it('will not let somebody propose five minutes after they got together', () => {
    // `minYearsAtStage`. Without it the mean wedding landed at 20.9 with 71% of
    // them before twenty-one, because nothing in the model knew a relationship
    // takes time.
    const fresh = peer({ relationship: 95, romance: at('together', 24) });
    expect(movesFor(fresh, 24, RICH).map((move) => move.id)).not.toContain('propose');
    expect(movesFor(fresh, 25, RICH).map((move) => move.id)).not.toContain('propose');
    expect(movesFor(fresh, 26, RICH).map((move) => move.id)).toContain('propose');
  });

  it('has nothing to offer about somebody it is already over with', () => {
    const ex = peer({
      relationship: 40,
      romance: { stage: 'together', since: 15, endedAtAge: 17, endedBecause: 'broke up' },
    });
    expect(movesFor(ex, 18, RICH)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Resolution                                                                  */
/* -------------------------------------------------------------------------- */

describe('how it goes', () => {
  it('can be turned down', () => {
    const move = ROMANCE_MOVES.find((entry) => entry.id === 'ask-out')!;
    const person = peer({ relationship: 60, romance: at('interested') });
    const no = resolveMove(move, person, 15, 0.4, 0.99, 0.5, 'Wren');
    expect(no.worked).toBe(false);
    expect(no.warmth).toBeLessThan(0);
    // Being told no leaves you where you were, not further back than that.
    expect(no.stage).toBe('interested');
  });

  it('does not end what you already had when a step forward fails', () => {
    const move = ROMANCE_MOVES.find((entry) => entry.id === 'make-official')!;
    const person = peer({ relationship: 60, romance: at('seeing') });
    const no = resolveMove(move, person, 16, 0.4, 0.99, 0.5, 'Wren');
    expect(no.ended).toBe(false);
    expect(no.stage).toBe('seeing');
  });

  it('ends it when the player decides to, and does not roll for it', () => {
    const move = ROMANCE_MOVES.find((entry) => entry.id === 'break-up')!;
    const person = peer({ relationship: 80, romance: at('together') });
    for (const roll of [0, 0.5, 0.999]) {
      const over = resolveMove(move, person, 16, 0.5, roll, 0.5, 'Wren');
      expect(over.ended).toBe(true);
      expect(over.stage).toBeUndefined();
      expect(over.endedBecause).toBe('broke up');
    }
  });

  it('pays for the evening whether or not it went well', () => {
    const move = ROMANCE_MOVES.find((entry) => entry.id === 'date')!;
    const person = peer({ relationship: 60, romance: at('together') });
    const good = resolveMove(move, person, 16, 0.9, 0.1, 0.5, 'Wren');
    const bad = resolveMove(move, person, 16, 0.9, 0.99, 0.5, 'Wren');
    expect(good.spent).toBe(move.cost);
    expect(bad.spent).toBe(move.cost);
  });

  it('says so rather than quietly doing nothing when a light move is worn out', () => {
    const move = ROMANCE_MOVES.find((entry) => entry.id === 'flirt')!;
    const person = peer({ relationship: 60, romance: at('interested') });
    const worn = resolveMove(move, person, 15, 0.9, 0, 0.5, 'Wren', 9);
    expect(worn.worn).toBe(true);
    expect(worn.warmth).toBe(0);
    expect(worn.text.length).toBeGreaterThan(10);
  });

  it('never renders a line with an unfilled token or an empty body', () => {
    for (const move of ROMANCE_MOVES) {
      for (const age of [14, 16, 22, 34]) {
        for (const worked of [0, 0.99]) {
          for (const variant of [0, 0.34, 0.67, 0.99]) {
            const person = peer({ relationship: 80, romance: at(move.from[0] as RomanceStage) });
            const text = resolveMove(move, person, age, 0.5, worked, variant, 'Wren').text;
            expect(text).toBeTruthy();
            expect(text).not.toContain('{');
            expect(text).not.toContain('undefined');
          }
        }
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The model underneath                                                        */
/* -------------------------------------------------------------------------- */

describe('whether it would work', () => {
  it('rates two similar people above two opposite ones', () => {
    const quiet = createPersonality({ extraversion: 20, loyalty: 80, temper: 30 });
    const alsoQuiet = createPersonality({ extraversion: 26, loyalty: 76, temper: 34 });
    const loud = createPersonality({ extraversion: 92, loyalty: 20, temper: 88 });
    expect(compatibility(quiet, alsoQuiet)).toBeGreaterThan(compatibility(quiet, loud));
  });

  it('does not decide compatibility on looks', () => {
    const mine = createPersonality({ extraversion: 50, loyalty: 50, temper: 50 });
    const plain = romanceChance(peer({ relationship: 50 }), mine, 50, 5, 0.4);
    const striking = romanceChance(peer({ relationship: 50 }), mine, 50, 95, 0.4);
    // Looks help, and they are the smallest of the three inputs by a distance.
    expect(striking - plain).toBeLessThan(0.16);
    expect(striking).toBeGreaterThan(plain);
  });

  it('is warmer towards somebody who already likes you', () => {
    const mine = createPersonality();
    const stranger = romanceChance(peer({ relationship: 10 }), mine, 50, 50, 0.4);
    const friend = romanceChance(peer({ relationship: 90 }), mine, 50, 50, 0.4);
    expect(friend).toBeGreaterThan(stranger);
  });

  it('never reaches certainty or impossibility', () => {
    const mine = createPersonality({ extraversion: 100, loyalty: 100, temper: 0 });
    const best = romanceChance(peer({ relationship: 100, personality: mine }), mine, 100, 100, 0.9);
    const worst = romanceChance(peer({ relationship: 0 }), mine, 0, 0, 0.05);
    expect(best).toBeLessThanOrEqual(0.95);
    expect(worst).toBeGreaterThanOrEqual(0.05);
  });

  it('cools a badly matched couple and warms a well matched one', () => {
    const mine = createPersonality({ extraversion: 20, loyalty: 80, temper: 30 });
    const suited = peer({
      relationship: 60,
      personality: createPersonality({ extraversion: 24, loyalty: 78, temper: 28 }),
    });
    const not = peer({
      relationship: 60,
      personality: createPersonality({ extraversion: 96, loyalty: 12, temper: 92 }),
    });
    expect(romanceYear(suited, mine)).toBeGreaterThan(60);
    expect(romanceYear(not, mine)).toBeLessThan(60);
  });

  it('lets a first relationship fail on its own over a few years', () => {
    // The point of the drift: a fifteen-year-old's badly matched first
    // relationship should be in trouble by eighteen without anybody pressing
    // anything, because that is what actually happens.
    const mine = createPersonality({ extraversion: 15, loyalty: 85, temper: 25 });
    let them = peer({
      relationship: 55,
      personality: createPersonality({ extraversion: 95, loyalty: 15, temper: 90 }),
    });
    for (let year = 0; year < 4; year += 1) {
      them = { ...them, relationship: romanceYear(them, mine) };
    }
    expect(them.relationship).toBeLessThan(ROMANCE_TROUBLE + 8);
  });
});

describe('who is who', () => {
  it('separates a crush from a partner from an ex', () => {
    const crush = peer({ id: asNpcId('npc:a'), romance: at('interested') });
    const partner = peer({ id: asNpcId('npc:b'), romance: at('together') });
    const ex = peer({
      id: asNpcId('npc:c'),
      romance: { stage: 'seeing', since: 14, endedAtAge: 15, endedBecause: 'broke up' },
    });
    const plain = peer({ id: asNpcId('npc:d') });
    const people = [crush, partner, ex, plain];

    expect(partnerOf(people)?.id).toBe(partner.id);
    expect(crushesOf(people).map((person) => person.id)).toEqual([crush.id]);
    expect(exesOf(people).map((person) => person.id)).toEqual([ex.id]);
    expect(isRomantic(ex)).toBe(false);
    expect(isRomantic(plain)).toBe(false);
  });
});

/**
 * Ticket 0207b. The one-way rule between the two records.
 *
 * A ROMANCE may end while the person stays — that is what an ex is. A PERSON
 * may not end while their romance stays live, because `partnerOf` skips people
 * who are gone: the two records would then disagree about whether the player is
 * seeing anybody, and the player picks up a second partner. That is exactly
 * what happened when 0207b made graduating end the class, and it is the failure
 * mode putting romance on the person record was meant to make impossible.
 */
describe('a person and their romance cannot disagree', () => {
  it('ends the romance when the person goes', () => {
    for (const because of ['drifted', 'fell out', 'moved away', 'moved on'] as const) {
      for (const stage of ALL_STAGES) {
        const going = peer({ relationship: 80, romance: at(stage, 15) });
        const gone = endPerson(going, 19, because);
        expect(gone.endedAtAge).toBe(19);
        expect(gone.romance?.endedAtAge, `${because} / ${stage}`).toBe(19);
        expect(isRomantic(gone)).toBe(false);
        expect(partnerOf([gone])).toBeUndefined();
      }
    }
  });

  it('leaves somebody with no romance alone apart from ending them', () => {
    const plain = peer({ relationship: 40 });
    const gone = endPerson(plain, 19, 'drifted');
    expect(gone.endedAtAge).toBe(19);
    expect(gone.romance).toBeUndefined();
  });

  it('does not overwrite an ending that already happened', () => {
    const already = peer({
      relationship: 30,
      endedAtAge: 15,
      endedBecause: 'moved on',
      romance: { stage: 'seeing', since: 14, endedAtAge: 15, endedBecause: 'broke up' },
    });
    const again = endPerson(already, 20, 'drifted');
    expect(again.endedAtAge).toBe(15);
    expect(again.romance?.endedBecause).toBe('broke up');
  });
});
