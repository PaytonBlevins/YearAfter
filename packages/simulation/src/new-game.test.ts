/**
 * Ticket 0201 acceptance tests.
 *
 * The statistical assertions run enough trials that they are not flaky, and
 * their bounds are deliberately wider than the expected value — they exist to
 * catch a generator that has broken or been silently retuned, not to pin exact
 * numbers that would fail on any legitimate balance change.
 */

import { describe, expect, it } from 'vitest';
import {
  PERSONALITY_KEYS,
  TALENT_KEYS,
  VISIBLE_STAT_KEYS,
  activeTalents,
} from '@yearafter/character';
import { CITIES, findNameCulture } from '@yearafter/content';
import {
  BIRTH_ATTRIBUTE_MAX,
  BIRTH_ATTRIBUTE_MIN,
  PERSONALITY_MAX,
  PERSONALITY_MIN,
  TALENT_PROBABILITY,
  createNewGame,
  generateCharacter,
  rollBirthCity,
  rollTalents,
} from './new-game';
import { advanceYear } from './advance';
import { decide } from './decide';
import { Rng, RngDomains } from './rng/rng';

const generate = (seed: string) => generateCharacter(new Rng(seed), { seed });

describe('determinism', () => {
  it('produces an identical character from the same seed', () => {
    expect(generate('ALPHA').character).toEqual(generate('ALPHA').character);
  });

  it('produces different characters from different seeds', () => {
    expect(generate('ALPHA').character).not.toEqual(generate('BETA').character);
  });

  it('never consumes entropy outside the seed', () => {
    // If any part of generation reached for Math.random, running the same seed
    // after other work would drift. Interleaving unrelated draws proves it does not.
    const first = generate('ISOLATED').character;
    const noise = new Rng('NOISE');
    for (let i = 0; i < 500; i += 1) noise.stream(RngDomains.Events).next();
    expect(generate('ISOLATED').character).toEqual(first);
  });

  it('keeps generation streams isolated from each other', () => {
    // Drawing heavily from talents must not change the birthplace or name,
    // otherwise retuning one system silently reshapes another.
    const rngA = new Rng('STREAMS');
    const a = generateCharacter(rngA, { seed: 'STREAMS' });

    const rngB = new Rng('STREAMS');
    for (let i = 0; i < 1000; i += 1) rngB.stream(RngDomains.Health).next();
    const b = generateCharacter(rngB, { seed: 'STREAMS' });

    expect(b.character.firstName).toBe(a.character.firstName);
    expect(b.birthCity.id).toBe(a.birthCity.id);
  });
});

describe('identity', () => {
  it('gives every character a name drawn from its birthplace culture', () => {
    for (let i = 0; i < 1500; i += 1) {
      const { character, birthCity, nameCulture } = generate(`NAME-${i}`);
      const culture = findNameCulture(nameCulture);
      expect(culture, nameCulture).toBeDefined();
      if (!culture) continue;

      const pool = character.sex === 'male' ? culture.male : culture.female;
      expect(pool, `${character.firstName} from ${nameCulture}`).toContain(character.firstName);
      expect(culture.surnames).toContain(character.lastName);
      expect(birthCity.nameCultures.map((entry) => entry.culture)).toContain(nameCulture);
    }
  });

  it('produces both sexes at roughly even rates', () => {
    let male = 0;
    const trials = 4000;
    for (let i = 0; i < trials; i += 1) {
      if (generate(`SEX-${i}`).character.sex === 'male') male += 1;
    }
    expect(male / trials).toBeGreaterThan(0.46);
    expect(male / trials).toBeLessThan(0.54);
  });

  it('honours forced overrides for dev tools and the character editor', () => {
    const rng = new Rng('FORCED');
    const { character, birthCity } = generateCharacter(rng, {
      seed: 'FORCED',
      firstName: 'Payton',
      lastName: 'Blevins',
      sex: 'female',
      birthCityId: 'jp-13-tokyo',
      talents: ['music', 'crime'],
    });
    expect(character.firstName).toBe('Payton');
    expect(character.lastName).toBe('Blevins');
    expect(character.sex).toBe('female');
    expect(birthCity.id).toBe('jp-13-tokyo');
    expect(activeTalents(character.talents).sort()).toEqual(['crime', 'music']);
  });

  it('rejects an unknown forced birthplace rather than silently falling back', () => {
    expect(() =>
      rollBirthCity(new Rng('X').stream(RngDomains.CharacterGeneration), 'nowhere'),
    ).toThrow();
  });
});

describe('birthplace', () => {
  it('records birth geography and starts current location there', () => {
    const { character, birthCity } = generate('PLACE');
    expect(character.birthLocation.cityId).toBe(birthCity.id);
    expect(character.birthLocation.regionCode).toBe(birthCity.regionCode);
    expect(character.birthLocation.countryCode).toBe(birthCity.countryCode);
    expect(character.currentLocation).toEqual(character.birthLocation);
  });

  it('spreads births across many cities and countries', () => {
    const cities = new Set<string>();
    const countries = new Set<string>();
    for (let i = 0; i < 12_000; i += 1) {
      const { birthCity } = generate(`SPREAD-${i}`);
      cities.add(birthCity.id);
      countries.add(birthCity.countryCode);
    }
    // Every catalogued city must be reachable — an unreachable birthplace is
    // content nobody will ever see.
    expect(cities.size).toBe(CITIES.length);
    expect(countries.size).toBeGreaterThanOrEqual(15);
  });

  it('weights births toward the US while the economic content is US-benchmarked', () => {
    let us = 0;
    const trials = 3000;
    for (let i = 0; i < trials; i += 1) {
      if (generate(`US-${i}`).birthCity.countryCode === 'US') us += 1;
    }
    // Wide bounds: this is a content weighting (US_BIAS in the generator script),
    // not a fixed rule. The US should be the plurality without being most lives.
    expect(us / trials).toBeGreaterThan(0.38);
    expect(us / trials).toBeLessThan(0.55);
  });
});

describe('visible attributes', () => {
  it('rolls all seven within the configured birth band', () => {
    for (let i = 0; i < 400; i += 1) {
      const { character } = generate(`STATS-${i}`);
      for (const key of VISIBLE_STAT_KEYS) {
        expect(character.stats[key], key).toBeGreaterThanOrEqual(BIRTH_ATTRIBUTE_MIN);
        expect(character.stats[key], key).toBeLessThanOrEqual(BIRTH_ATTRIBUTE_MAX);
      }
    }
  });

  it('clusters toward the middle rather than spreading flat', () => {
    // The point of aroundCentre: most characters ordinary, few exceptional.
    const values: number[] = [];
    for (let i = 0; i < 3000; i += 1) {
      values.push(generate(`DIST-${i}`).character.stats.smarts);
    }
    const mid = (BIRTH_ATTRIBUTE_MIN + BIRTH_ATTRIBUTE_MAX) / 2;
    const span = BIRTH_ATTRIBUTE_MAX - BIRTH_ATTRIBUTE_MIN;
    const withinQuarter = values.filter((v) => Math.abs(v - mid) < span / 4).length;
    // A flat distribution would put ~50% here; a clustered one puts far more.
    expect(withinQuarter / values.length).toBeGreaterThan(0.68);
  });

  it('does not correlate stats with each other', () => {
    // Independent rolls: a high-Smarts character is not also a good-looking one.
    let bothHigh = 0;
    let smartsHigh = 0;
    const trials = 3000;
    const mid = (BIRTH_ATTRIBUTE_MIN + BIRTH_ATTRIBUTE_MAX) / 2;
    for (let i = 0; i < trials; i += 1) {
      const { stats } = generate(`CORR-${i}`).character;
      if (stats.smarts > mid) {
        smartsHigh += 1;
        if (stats.looks > mid) bothHigh += 1;
      }
    }
    // Given Smarts is high, Looks should still be a coin flip.
    expect(bothHigh / smartsHigh).toBeGreaterThan(0.42);
    expect(bothHigh / smartsHigh).toBeLessThan(0.58);
  });
});

describe('hidden attributes', () => {
  it('rolls every personality trait within the configured band', () => {
    for (let i = 0; i < 400; i += 1) {
      const { character } = generate(`PERS-${i}`);
      for (const key of PERSONALITY_KEYS) {
        expect(character.personality[key], key).toBeGreaterThanOrEqual(PERSONALITY_MIN);
        expect(character.personality[key], key).toBeLessThanOrEqual(PERSONALITY_MAX);
      }
    }
  });

  it('varies personality between characters', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(JSON.stringify(generate(`PVAR-${i}`).character.personality));
    }
    expect(seen.size).toBeGreaterThan(190);
  });
});

describe('talents', () => {
  it('allows zero, one and several', () => {
    const counts = new Set<number>();
    for (let i = 0; i < 600; i += 1) {
      counts.add(rollTalents(new Rng(`T-${i}`)).length);
    }
    expect(counts.has(0)).toBe(true);
    expect(counts.has(1)).toBe(true);
    expect([...counts].some((n) => n >= 2)).toBe(true);
  });

  it('lands near the configured probability per talent', () => {
    const trials = 20_000;
    let total = 0;
    for (let i = 0; i < trials; i += 1) total += rollTalents(new Rng(`P-${i}`)).length;
    const perTalent = total / (trials * TALENT_KEYS.length);
    expect(perTalent).toBeGreaterThan(TALENT_PROBABILITY - 0.015);
    expect(perTalent).toBeLessThan(TALENT_PROBABILITY + 0.015);
  });

  it('holds the approved distribution at 9%', () => {
    // Guards the product-owner decision. If this fails, someone retuned
    // TALENT_PROBABILITY — confirm that was intended before adjusting bounds.
    const trials = 20_000;
    let none = 0;
    let one = 0;
    let several = 0;
    for (let i = 0; i < trials; i += 1) {
      const count = rollTalents(new Rng(`D-${i}`)).length;
      if (count === 0) none += 1;
      else if (count === 1) one += 1;
      else several += 1;
    }
    expect(none / trials).toBeGreaterThan(0.48);
    expect(none / trials).toBeLessThan(0.56);
    expect(one / trials).toBeGreaterThan(0.32);
    expect(one / trials).toBeLessThan(0.4);
    expect(several / trials).toBeGreaterThan(0.08);
    expect(several / trials).toBeLessThan(0.16);
  });

  it('can roll Crime like any other talent', () => {
    let crime = 0;
    for (let i = 0; i < 2000; i += 1) {
      if (rollTalents(new Rng(`C-${i}`)).includes('crime')) crime += 1;
    }
    expect(crime).toBeGreaterThan(100);
  });
});

describe('createNewGame', () => {
  it('starts at age zero in the start year', () => {
    const state = createNewGame({ seed: 'START', startYear: 1994 });
    expect(state.player.age).toBe(0);
    expect(state.player.birthYear).toBe(1994);
    expect(state.world.year).toBe(1994);
    expect(state.world.generation).toBe(1);
    expect(state.player.alive).toBe(true);
    expect(state.player.timeline).toHaveLength(0);
  });
});

describe('Ticket 0408 — the population is varied, and stays varied', () => {
  /*
    THE ROADMAP CARRIED THIS AS FINDING 1 FROM 0211 UNTIL 0408, and it was only
    ever half right. It said "this build cannot produce a poor student" and
    pointed at character generation. Generation was the floor under it, but the
    mechanism was downstream: every stat delta goes through `curvedDelta`, which
    is full strength at 50 and tapers to nothing at 100, and school pushed a
    flat +1/+3 Smarts at everybody every year for thirteen years. An equalising
    curve applied to aptitude equalises aptitude.

    Measured before: Smarts at birth p10 44 / median 56; Smarts at EIGHTEEN p10
    70 / median 76, minimum 56 across 500 lives. Nobody in the game was below
    average as an adult.

    Two assertions, and they pull against each other on purpose — the failure
    modes are opposite and a test that only guards one invites the other.
  */
  const LIVES = 240;
  const grown = Array.from({ length: LIVES }, (_, run) => {
    let state = createNewGame({ seed: `spread-${run}` });
    while (state.player.age < 18 && state.health.diedAtAge === undefined) {
      state = advanceYear(state).state;
      let guard = 0;
      while (state.pending.length > 0 && (guard += 1) < 12) {
        const decision = state.pending[0];
        const choice = decision?.choices[0];
        if (!decision || !choice) break;
        const answered = decide(state, decision.eventId, choice.id);
        if (!answered.ok) break;
        state = answered.value.state;
      }
    }
    return state;
  });

  const spreadOf = (values: number[]) => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  };

  it('does not hand everybody the same head', () => {
    const smarts = grown.map((state) => Number(state.player.stats.smarts));
    const low = Math.min(...smarts);
    const sd = spreadOf(smarts);
    console.log(`smarts at 18: min ${low}  sd ${sd.toFixed(1)}`);

    /*
      A FLOOR ON THE FLOOR. The pre-0408 build could not put an adult below 56
      and this is what would catch that coming back — a build where the least
      able eighteen-year-old in two hundred and forty lives is comfortably
      average has stopped modelling aptitude. Set well above the measured
      minimum so ordinary tuning does not trip it.
    */
    expect(low, 'the least able adult in the sample').toBeLessThan(50);
    // And a spread, because a low minimum with everybody else bunched is the
    // same flatness with one outlier bolted on.
    expect(sd, 'spread of adult Smarts').toBeGreaterThan(8);
  });

  it('does not make everybody hopeless either', () => {
    /*
      THE OPPOSITE FAILURE, and the reason the assertion above is not simply
      "make the numbers wider". 0203's growth curve exists because a childhood
      of forty events used to arrive at eighteen with every stat above average;
      widening the roll and steepening the gains could put it back the other
      way, with a population nobody would want to play.
    */
    const smarts = grown.map((state) => Number(state.player.stats.smarts));
    const median = [...smarts].sort((a, b) => a - b)[Math.floor(smarts.length / 2)]!;
    expect(median, 'median adult Smarts').toBeGreaterThan(60);
    const capable = smarts.filter((value) => value >= 70).length / smarts.length;
    expect(capable, 'share of adults who are genuinely capable').toBeGreaterThan(0.3);
  });
});
