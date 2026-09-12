import { describe, expect, it } from 'vitest';
import {
  CITIES,
  NAME_CULTURES,
  costIndexOf,
  describeCity,
  findCity,
  findNameCulture,
} from './index';

describe('location catalog', () => {
  it('has stable unique ids', () => {
    const ids = CITIES.map((city) => city.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CITIES.length).toBeGreaterThan(100);
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
  it('carries at least a dozen naming traditions', () => {
    expect(NAME_CULTURES.length).toBeGreaterThanOrEqual(12);
  });

  it('has stable unique culture ids', () => {
    const ids = NAME_CULTURES.map((culture) => culture.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every culture enough names to avoid obvious repetition', () => {
    for (const culture of NAME_CULTURES) {
      expect(culture.male.length, `${culture.id} male`).toBeGreaterThanOrEqual(28);
      expect(culture.female.length, `${culture.id} female`).toBeGreaterThanOrEqual(28);
      expect(culture.surnames.length, `${culture.id} surnames`).toBeGreaterThanOrEqual(32);
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

describe('Ticket 0303 — every city knows what it costs to live there', () => {
  /*
    The third of the three enforcement points, and the one that runs in the
    package that will actually read the field. The generator refuses to emit a
    city without an index and the validator checks the rendered catalog; this
    checks the thing a consumer imports.

    Three checks look redundant and are not. 0211b's V16 ran over source files
    and not the rendered catalog and missed 593 strings — a rule that checks the
    input and not the output is half a rule (CORE_RULES 13.23) — and 0207c's
    migration test passed against a migration that had been neutered, because
    nothing proved the assertion could go red.
  */
  it('gives every city an index, and `costIndexOf` finds it', () => {
    for (const city of CITIES) {
      expect(typeof city.costIndex, city.id).toBe('number');
      expect(costIndexOf(city.id), city.id).toBe(city.costIndex);
    }
  });

  it('falls back to the national baseline for a city nobody knows', () => {
    // A save can outlive a catalog entry — that is 0207c's whole lesson — and a
    // character whose birth city was renamed between builds should keep playing
    // at an average cost rather than crash on load.
    expect(costIndexOf('xx-nowhere')).toBe(1);
  });

  it('varies enough for location to be one of the things that matters', () => {
    // CORE_RULES 13.7: a system nobody can trigger is not a system. A catalog
    // where every city sat at 1.00 would satisfy every other check here and
    // mean the spec's first named input does nothing.
    const indices = CITIES.map((city) => city.costIndex);
    expect(Math.max(...indices) - Math.min(...indices)).toBeGreaterThan(0.4);
    expect(new Set(indices).size).toBeGreaterThan(20);
  });

  it('costs more to live in San Francisco than in Memphis', () => {
    // Stated as a sanity check a person can read, because a spread test passes
    // happily on a catalog where the numbers are shuffled.
    expect(costIndexOf('us-ca-san-francisco')).toBeGreaterThan(costIndexOf('us-tn-memphis'));
    expect(costIndexOf('gb-eng-london')).toBeGreaterThan(costIndexOf('gb-sct-glasgow'));
  });
});
