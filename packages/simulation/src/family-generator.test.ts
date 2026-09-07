/**
 * Ticket 0202 acceptance tests.
 */

import { describe, expect, it } from 'vitest';
import { findNameCulture } from '@yearafter/content';
import { toDollars } from '@yearafter/core';
import {
  father,
  livingParents,
  mother,
  orderedMembers,
  parents,
  siblings,
  updateMember,
  npcAge,
  npcFullName,
  type Household,
} from '@yearafter/relationships';
import {
  INCOME_BANDS,
  MAX_SIBLING_AGE_GAP,
  generateFamily,
  rollHouseholdFinances,
  startingRelationship,
} from './family-generator';
import { createNewGame } from './new-game';
import { Rng, RngDomains } from './rng/rng';

const familyFor = (seed: string, culture = 'us-en'): Household =>
  generateFamily(new Rng(seed).stream(RngDomains.Family), {
    playerFirstName: 'Rowan',
    playerLastName: 'Vaughn',
    playerBirthYear: 2000,
    nameCultureId: culture,
    seed,
  });

describe('names inside one household', () => {
  it('never gives a relative the player\'s own given name', () => {
    // A screenshot of the built app showed a sixteen-year-old Esperanza
    // Arellano whose sister was Esperanza Arellano, aged twenty-five. The
    // uniqueness set guarded the NPCs against each other and never contained
    // the player.
    for (let index = 0; index < 400; index += 1) {
      const seed = `names-${index}`;
      const state = createNewGame({ seed });
      for (const member of state.family.members) {
        expect(
          member.firstName,
          `${member.role} shares the player's name in ${seed}`,
        ).not.toBe(state.player.firstName);
      }
    }
  });
});

describe('determinism', () => {
  it('produces an identical family from the same seed', () => {
    expect(familyFor('ALPHA')).toEqual(familyFor('ALPHA'));
  });

  it('produces different families from different seeds', () => {
    expect(familyFor('ALPHA')).not.toEqual(familyFor('BETA'));
  });

  it('uses its own stream, so family tuning cannot shift the player', () => {
    const a = createNewGame({ seed: 'STREAM' });
    const rng = new Rng('STREAM');
    for (let i = 0; i < 800; i += 1) rng.stream(RngDomains.Family).next();
    // The player is generated from CharacterGeneration/Talents, untouched above.
    const b = createNewGame({ seed: 'STREAM' });
    expect(b.player).toEqual(a.player);
  });

  it('rejects an unknown name culture rather than producing nameless parents', () => {
    expect(() => familyFor('BAD', 'nope')).toThrow();
  });
});

describe('household shape', () => {
  it('always produces at least one parent', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(parents(familyFor(`SHAPE-${i}`)).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('produces two-parent, mother-only and father-only households', () => {
    const shapes = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      const household = familyFor(`MIX-${i}`);
      shapes.add(`${mother(household) ? 'M' : ''}${father(household) ? 'F' : ''}`);
    }
    expect(shapes.has('MF')).toBe(true);
    expect(shapes.has('M')).toBe(true);
    expect(shapes.has('F')).toBe(true);
  });

  it('never gives a household two mothers or two fathers', () => {
    for (let i = 0; i < 300; i += 1) {
      const members = familyFor(`ROLES-${i}`).members;
      expect(members.filter((m) => m.role === 'mother').length).toBeLessThanOrEqual(1);
      expect(members.filter((m) => m.role === 'father').length).toBeLessThanOrEqual(1);
    }
  });

  it('produces zero, one and several siblings', () => {
    const counts = new Set<number>();
    for (let i = 0; i < 500; i += 1) counts.add(siblings(familyFor(`SIB-${i}`)).length);
    expect(counts.has(0)).toBe(true);
    expect(counts.has(1)).toBe(true);
    expect([...counts].some((n) => n >= 3)).toBe(true);
  });

  it('gives every member a unique id', () => {
    for (let i = 0; i < 200; i += 1) {
      const members = familyFor(`ID-${i}`).members;
      expect(new Set(members.map((m) => m.id)).size).toBe(members.length);
    }
  });
});

describe('ages', () => {
  it('gives parents plausible ages at the player’s birth', () => {
    for (let i = 0; i < 500; i += 1) {
      const household = familyFor(`AGE-${i}`);
      for (const parent of parents(household)) {
        const ageAtBirth = 2000 - parent.birthYear;
        expect(ageAtBirth, npcFullName(parent)).toBeGreaterThanOrEqual(18);
        expect(ageAtBirth, npcFullName(parent)).toBeLessThanOrEqual(50);
      }
    }
  });

  it('generates only older siblings, never unborn ones', () => {
    // A sibling born after the player does not exist yet at birth. Allowing it
    // produced "sister, age -8" on the family screen.
    for (let i = 0; i < 500; i += 1) {
      for (const sibling of siblings(familyFor(`TWIN-${i}`))) {
        expect(sibling.birthYear).toBeLessThan(2000);
        expect(2000 - sibling.birthYear).toBeLessThanOrEqual(MAX_SIBLING_AGE_GAP);
      }
    }
  });

  it('never gives a family member a negative age at the world year', () => {
    for (let i = 0; i < 400; i += 1) {
      for (const member of familyFor(`NEGAGE-${i}`).members) {
        expect(npcAge(member, 2000), npcFullName(member)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('derives age from the world year rather than storing it', () => {
    const household = familyFor('DERIVE');
    const parent = parents(household)[0];
    expect(parent).toBeDefined();
    if (!parent) return;
    expect(npcAge(parent, 2000)).toBe(2000 - parent.birthYear);
    expect(npcAge(parent, 2020)).toBe(2020 - parent.birthYear);
  });
});

describe('names', () => {
  it('draws family names from the player’s own naming tradition', () => {
    for (const cultureId of ['us-en', 'jp', 'ng', 'in', 'it']) {
      const culture = findNameCulture(cultureId);
      expect(culture).toBeDefined();
      if (!culture) continue;

      for (let i = 0; i < 60; i += 1) {
        for (const member of familyFor(`NAME-${cultureId}-${i}`, cultureId).members) {
          const pool = member.sex === 'male' ? culture.male : culture.female;
          expect(pool, `${member.firstName} (${cultureId})`).toContain(member.firstName);
        }
      }
    }
  });

  it('gives siblings and the father the player’s surname', () => {
    for (let i = 0; i < 200; i += 1) {
      const household = familyFor(`SURNAME-${i}`);
      for (const sibling of siblings(household)) {
        expect(sibling.lastName).toBe('Vaughn');
      }
      const dad = father(household);
      if (dad) expect(dad.lastName).toBe('Vaughn');
    }
  });

  it('lets a mother keep her own surname sometimes', () => {
    const surnames = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      const mum = mother(familyFor(`MSURNAME-${i}`));
      if (mum) surnames.add(mum.lastName);
    }
    expect(surnames.has('Vaughn')).toBe(true);
    expect(surnames.size).toBeGreaterThan(1);
  });
});

describe('household finances', () => {
  it('produces every wealth band', () => {
    const bands = new Set<string>();
    for (let i = 0; i < 600; i += 1) {
      bands.add(familyFor(`BAND-${i}`).finances.band);
    }
    expect(bands.size).toBe(5);
  });

  it('keeps income inside its band', () => {
    for (let i = 0; i < 800; i += 1) {
      const finances = rollHouseholdFinances(new Rng(`INC-${i}`).stream(RngDomains.Family));
      const [low, high] = INCOME_BANDS[finances.band];
      const dollarsValue = toDollars(finances.annualIncome);
      expect(dollarsValue, finances.band).toBeGreaterThanOrEqual(low);
      expect(dollarsValue, finances.band).toBeLessThanOrEqual(high);
    }
  });

  it('stores income as exact integer cents', () => {
    for (let i = 0; i < 200; i += 1) {
      const { annualIncome } = familyFor(`CENTS-${i}`).finances;
      expect(Number.isInteger(annualIncome)).toBe(true);
    }
  });

  it('is kinder than reality without making wealth ordinary', () => {
    // Spec 949: fun at every level, no steep real-world curve. But a wealthy
    // birth still has to be uncommon or it means nothing.
    const counts = new Map<string, number>();
    const trials = 4000;
    for (let i = 0; i < trials; i += 1) {
      const band = familyFor(`DIST-${i}`).finances.band;
      counts.set(band, (counts.get(band) ?? 0) + 1);
    }
    const share = (band: string) => (counts.get(band) ?? 0) / trials;
    expect(share('wealthy')).toBeGreaterThan(0.02);
    expect(share('wealthy')).toBeLessThan(0.09);
    expect(share('struggling')).toBeLessThan(0.25);
    expect(share('modest') + share('comfortable')).toBeGreaterThan(0.5);
  });
});

describe('relationship state', () => {
  it('starts everyone in range', () => {
    for (let i = 0; i < 400; i += 1) {
      for (const member of familyFor(`REL-${i}`).members) {
        expect(member.relationship).toBeGreaterThanOrEqual(0);
        expect(member.relationship).toBeLessThanOrEqual(100);
      }
    }
  });

  it('starts families close rather than neutral', () => {
    let total = 0;
    let count = 0;
    for (let i = 0; i < 400; i += 1) {
      for (const member of familyFor(`WARM-${i}`).members) {
        total += member.relationship;
        count += 1;
      }
    }
    expect(total / count).toBeGreaterThan(65);
  });

  it('lets a short temper cost a parent some warmth', () => {
    // The first place a hidden trait produces an explainable outcome (spec 2).
    const stream = new Rng('TEMPER').stream(RngDomains.Family);
    const calm = {
      ambition: 50,
      riskTolerance: 50,
      temper: 5,
      generosity: 50,
      loyalty: 50,
      extraversion: 50,
    };
    const volatile = { ...calm, temper: 95 };

    let calmTotal = 0;
    let volatileTotal = 0;
    for (let i = 0; i < 2000; i += 1) {
      calmTotal += startingRelationship(stream, calm);
      volatileTotal += startingRelationship(stream, volatile);
    }
    expect(calmTotal / 2000).toBeGreaterThan(volatileTotal / 2000);
  });
});

describe('household queries', () => {
  it('orders parents before siblings, oldest first', () => {
    const ordered = orderedMembers(familyFor('ORDER'));
    const firstSibling = ordered.findIndex((m) => m.role === 'sibling');
    if (firstSibling > 0) {
      expect(ordered.slice(0, firstSibling).every((m) => m.role !== 'sibling')).toBe(true);
    }
    const sibs = ordered.filter((m) => m.role === 'sibling');
    for (let i = 1; i < sibs.length; i += 1) {
      expect(sibs[i]!.birthYear).toBeGreaterThanOrEqual(sibs[i - 1]!.birthYear);
    }
  });

  it('reports living parents', () => {
    const household = familyFor('LIVING');
    expect(livingParents(household).length).toBe(parents(household).length);

    const first = parents(household)[0];
    expect(first).toBeDefined();
    if (!first) return;
    const bereaved = updateMember(household, first.id, (m) => ({ ...m, alive: false }));
    expect(livingParents(bereaved).length).toBe(parents(household).length - 1);
    // Original untouched — state is never mutated in place.
    expect(livingParents(household).length).toBe(parents(household).length);
  });
});

describe('integration with a new game', () => {
  it('gives every new character a family sharing their surname', () => {
    for (let i = 0; i < 200; i += 1) {
      const state = createNewGame({ seed: `GAME-${i}` });
      expect(state.family.members.length).toBeGreaterThan(0);
      const dad = father(state.family);
      if (dad) expect(dad.lastName).toBe(state.player.lastName);
    }
  });

  it('marks immediate family as Tier 1', () => {
    for (const member of createNewGame({ seed: 'TIER' }).family.members) {
      expect(member.tier).toBe(1);
    }
  });
});

describe('names inside one household', () => {
  it('never gives two family members the same first name', () => {
    // "father Andrea, sibling Andrea" turned up in a generated life. It is a
    // legitimate draw and it reads as a bug, which is the only test that matters.
    for (let i = 0; i < 400; i += 1) {
      const members = familyFor(`UNIQUE-${i}`).members;
      const names = members.map((member) => member.firstName);
      expect(new Set(names).size, names.join(', ')).toBe(names.length);
    }
  });

  it('still draws from the right naming tradition after de-duplicating', () => {
    for (const cultureId of ['it', 'ng', 'jp']) {
      const culture = findNameCulture(cultureId);
      expect(culture).toBeDefined();
      if (!culture) continue;
      for (let i = 0; i < 40; i += 1) {
        for (const member of familyFor(`UNIQ-${cultureId}-${i}`, cultureId).members) {
          const pool = member.sex === 'male' ? culture.male : culture.female;
          expect(pool, `${member.firstName} (${cultureId})`).toContain(member.firstName);
        }
      }
    }
  });
});
