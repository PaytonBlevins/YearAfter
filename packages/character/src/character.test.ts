import { describe, expect, it } from 'vitest';
import { asCharacterId, dollars } from '@yearafter/core';
import { createCharacter, defaultOccupationFor, fullName, lifeStageFor } from './character';
import { adjustStats, createStats, VISIBLE_STAT_KEYS } from './stats';
import { activeTalents, createTalents, TALENT_KEYS } from './talents';
import { createTimelineEntry, groupByAge } from './timeline';

const birthLocation = { countryCode: 'US', regionCode: 'CA', cityId: 'us-ca-riverside' };

describe('visible stats', () => {
  it('exposes exactly the seven canonical stats', () => {
    // Spec 828-838 fixes this list. A change here needs a spec revision.
    expect([...VISIBLE_STAT_KEYS]).toEqual([
      'happiness',
      'health',
      'smarts',
      'looks',
      'charisma',
      'willpower',
      'discipline',
    ]);
  });

  it('defaults every stat to 50 and clamps supplied values', () => {
    const stats = createStats({ happiness: 140, health: -20 });
    expect(stats.happiness).toBe(100);
    expect(stats.health).toBe(0);
    expect(stats.smarts).toBe(50);
  });

  it('adjusts without mutating and stays clamped', () => {
    const stats = createStats({ happiness: 95 });
    const adjusted = adjustStats(stats, { happiness: 20, smarts: -80 });
    expect(stats.happiness).toBe(95);
    expect(adjusted.happiness).toBe(100);
    expect(adjusted.smarts).toBe(0);
  });
});

describe('talents', () => {
  it('exposes the canonical Boolean talent set including Crime', () => {
    // Spec 1069: Athletics, Acting, Music, Writing, Academics, Inventive, Crime.
    expect([...TALENT_KEYS].sort()).toEqual(
      ['academics', 'acting', 'athletics', 'crime', 'inventive', 'music', 'writing'].sort(),
    );
  });

  it('is Boolean only — no numeric strength (spec 1070)', () => {
    const talents = createTalents(['music']);
    for (const key of TALENT_KEYS) {
      expect(typeof talents[key]).toBe('boolean');
    }
    expect(activeTalents(talents)).toEqual(['music']);
  });

  it('supports a character with no talents at all', () => {
    expect(activeTalents(createTalents())).toEqual([]);
  });
});

describe('character', () => {
  it('defaults current location to birth location', () => {
    const character = createCharacter({
      id: asCharacterId('c1'),
      firstName: 'Nadia',
      lastName: 'Vaughn',
      sex: 'female',
      birthYear: 2000,
      birthLocation,
    });
    expect(character.currentLocation).toEqual(birthLocation);
    expect(fullName(character)).toBe('Nadia Vaughn');
    expect(character.age).toBe(0);
    expect(character.alive).toBe(true);
    expect(character.cash).toBe(dollars(0));
  });

  it('maps ages to life stages', () => {
    expect(lifeStageFor(1)).toBe('infant');
    expect(lifeStageFor(8)).toBe('child');
    expect(lifeStageFor(15)).toBe('teen');
    expect(lifeStageFor(22)).toBe('youngAdult');
    expect(lifeStageFor(38)).toBe('adult');
    expect(lifeStageFor(55)).toBe('middleAge');
    expect(lifeStageFor(80)).toBe('senior');
  });
});

describe('timeline grouping', () => {
  it('groups by age newest first and orders entries within an age', () => {
    const entries = [
      createTimelineEntry({ age: 1, year: 2001, kind: 'passive', text: 'a', sequence: 0 }),
      createTimelineEntry({ age: 2, year: 2002, kind: 'passive', text: 'c', sequence: 1 }),
      createTimelineEntry({ age: 2, year: 2002, kind: 'passive', text: 'b', sequence: 0 }),
    ];
    const grouped = groupByAge(entries);
    expect(grouped.map((group) => group.age)).toEqual([2, 1]);
    expect(grouped[0]?.entries.map((entry) => entry.text)).toEqual(['b', 'c']);
  });

  it('handles an empty timeline', () => {
    expect(groupByAge([])).toEqual([]);
  });
});

describe('occupation placeholder', () => {
  it('tracks life stage instead of staying "Newborn"', () => {
    expect(defaultOccupationFor(0)).toBe('Newborn');
    expect(defaultOccupationFor(10)).toBe('Child');
    expect(defaultOccupationFor(15)).toBe('Student');
    expect(defaultOccupationFor(30)).toBe('Unemployed');
    expect(defaultOccupationFor(70)).toBe('Retired');
  });
});
