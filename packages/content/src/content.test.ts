import { describe, expect, it } from 'vitest';
import { CITIES, NAME_CULTURES, describeCity, findCity, findNameCulture } from './index';

describe('location catalog', () => {
  it('has stable unique ids', () => {
    const ids = CITIES.map((city) => city.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CITIES.length).toBeGreaterThan(20);
  });

  it('gives every city a positive birth weight', () => {
    for (const city of CITIES) {
      expect(city.weight).toBeGreaterThan(0);
    }
  });

  it('references only name cultures that exist', () => {
    // A dangling reference here would throw at character generation, so it is
    // worth catching in a test as well as in the content validator.
    for (const city of CITIES) {
      expect(city.nameCultures.length).toBeGreaterThan(0);
      for (const entry of city.nameCultures) {
        expect(findNameCulture(entry.culture), `${city.id} -> ${entry.culture}`).toBeDefined();
        expect(entry.weight).toBeGreaterThan(0);
      }
    }
  });

  it('carries region and country on every city', () => {
    for (const city of CITIES) {
      expect(city.city.length).toBeGreaterThan(0);
      expect(city.regionCode.length).toBeGreaterThan(0);
      expect(city.countryCode.length).toBeGreaterThan(0);
      expect(city.country.length).toBeGreaterThan(0);
    }
  });

  it('formats US and non-US places differently', () => {
    expect(describeCity('us-ny-nyc')).toBe('New York City, NY');
    expect(describeCity('jp-13-tokyo')).toBe('Tokyo, Japan');
    expect(describeCity('nope')).toBe('Unknown');
  });

  it('looks up by id', () => {
    expect(findCity('ng-la-lagos')?.city).toBe('Lagos');
    expect(findCity('nope')).toBeUndefined();
  });
});

describe('name catalog', () => {
  it('has stable unique culture ids', () => {
    const ids = NAME_CULTURES.map((culture) => culture.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every culture enough names to avoid obvious repetition', () => {
    for (const culture of NAME_CULTURES) {
      expect(culture.male.length, `${culture.id} male`).toBeGreaterThanOrEqual(10);
      expect(culture.female.length, `${culture.id} female`).toBeGreaterThanOrEqual(10);
      expect(culture.surnames.length, `${culture.id} surnames`).toBeGreaterThanOrEqual(10);
    }
  });

  it('has no duplicate names inside a culture', () => {
    for (const culture of NAME_CULTURES) {
      for (const list of [culture.male, culture.female, culture.surnames]) {
        expect(new Set(list).size, culture.id).toBe(list.length);
      }
    }
  });

  it('has no empty strings', () => {
    for (const culture of NAME_CULTURES) {
      for (const name of [...culture.male, ...culture.female, ...culture.surnames]) {
        expect(name.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
