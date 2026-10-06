/**
 * Ticket 0705 — who is famous.
 *
 * Spec 697: the world holds persistent fictional public figures across acting,
 * music, athletics, creator media, business and politics. They age, rise,
 * decline, retire, die and are replaced across long saves.
 *
 * None of it is saved. A figure is a pure function of the world's seed and an
 * id of the form `field:birthYear:slot`, and fame is a pure function of the figure and the
 * year, so a reload, a continued life and a second device all agree on who was
 * a household name in 2041, and a descendant a century on meets the same
 * actor's grown children's generation of stars without anything being stored.
 * What is saved is only what the player did about them (see `celebrity.ts`).
 */

import {
  CELEBRITY_FIELD_CATALOG,
  NAME_CULTURES,
  findCelebrityField,
  type CelebrityField,
  type CelebrityFieldId,
} from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';
import type { Sex } from '@yearafter/character';

/** The most people a field produces in one birth year. */
export const SLOTS_PER_YEAR = 3;
/** Under this a figure is not a name anybody would know. */
export const NOTABLE_FAME = 12;
/** Fame at the start of a career, against their peak. */
export const BREAKTHROUGH_SHARE = 0.15;
/** What a career settles to when it winds down, against the peak. */
export const LEGACY_SHARE = 0.6;
/** A legend loses this share of what is left each year they are away. */
export const LEGACY_FADE = 0.06;
/** The chance of dying young, before the ordinary span. */
export const EARLY_DEATH = 0.04;

export interface Figure {
  /** `field:birthYear:slot`. Stable forever, and enough to rebuild everything below. */
  readonly id: string;
  readonly field: CelebrityFieldId;
  readonly firstName: string;
  readonly lastName: string;
  readonly sex: Sex;
  readonly birthYear: number;
  /** Ages. */
  readonly debut: number;
  readonly rise: number;
  readonly hold: number;
  readonly retire: number;
  readonly dies: number;
  /** The highest fame they reach, 12–100. */
  readonly peak: number;
}

const between = (range: readonly [number, number], unit: number): number =>
  Math.round(range[0] + (range[1] - range[0]) * unit);

/** A weighted pick of a name culture: home markets weigh most, but the world is wide. */
const CULTURE_POOL = NAME_CULTURES.flatMap((culture) =>
  culture.id === 'us-en' ? [culture, culture, culture] : [culture],
);

/** Whether this slot in this birth year holds a person at all. */
const exists = (seed: string, field: CelebrityField, birthYear: number, slot: number): boolean =>
  mixedUnit(`${seed}:celeb:${field.id}:${birthYear}:${slot}:exists`) <
  field.density / SLOTS_PER_YEAR;

function build(seed: string, field: CelebrityField, birthYear: number, slot: number): Figure {
  const id = `${field.id}:${birthYear}:${slot}`;
  const unit = (part: string): number => mixedUnit(`${seed}:celeb:${id}:${part}`);
  const culture = CULTURE_POOL[Math.floor(unit('culture') * CULTURE_POOL.length)]!;
  const sex: Sex = unit('sex') < 0.5 ? 'male' : 'female';
  const firsts = sex === 'male' ? culture.male : culture.female;
  const debut = between(field.debut, unit('debut'));
  const early = unit('early') < EARLY_DEATH;
  return {
    id,
    field: field.id,
    firstName: firsts[Math.floor(unit('first') * firsts.length)]!,
    lastName: culture.surnames[Math.floor(unit('last') * culture.surnames.length)]!,
    sex,
    birthYear,
    debut,
    rise: between(field.rise, unit('rise')),
    hold: between(field.hold, unit('hold')),
    retire: between(field.retire, unit('retire')),
    dies: early ? between([28, 55], unit('earlyAge')) : between([66, 94], unit('age')),
    // A few superstars and a long tail of working names.
    peak: Math.round(NOTABLE_FAME + (100 - NOTABLE_FAME) * unit('peak') ** 2.2),
  };
}

/** Rebuild a figure from its id, alive or dead, or undefined if the id is not one. */
export function figureById(seed: string, id: string): Figure | undefined {
  const [fieldId, birth, slot] = id.split(':');
  const field = fieldId === undefined ? undefined : findCelebrityField(fieldId);
  const birthYear = Number(birth);
  const slotNumber = Number(slot);
  if (
    field === undefined ||
    !Number.isInteger(birthYear) ||
    !Number.isInteger(slotNumber) ||
    slotNumber < 0 ||
    slotNumber >= SLOTS_PER_YEAR ||
    !exists(seed, field, birthYear, slotNumber)
  ) {
    return undefined;
  }
  return build(seed, field, birthYear, slotNumber);
}

/** The year they die in. */
export const deathYearOf = (figure: Figure): number => figure.birthYear + figure.dies;

/** The age a career's decline ends at; after it they are a legend, not a name in the news. */
export const careerEndOf = (figure: Figure): number =>
  Math.max(figure.retire, figure.debut + figure.rise + figure.hold);

/**
 * How famous they are in a year, 0–100. Nothing before they break through or after
 * they die; a climb, a stay near the top, a slow decline to the end of a career, and
 * after it a legend's fame that fades a little each year.
 */
export function fameIn(figure: Figure, year: number): number {
  const age = year - figure.birthYear;
  if (age < figure.debut || age > figure.dies) return 0;
  const into = age - figure.debut;
  const topFrom = figure.rise;
  const declineFrom = figure.rise + figure.hold;
  const end = careerEndOf(figure) - figure.debut;
  let share: number;
  if (into < topFrom) {
    // Slow at the start, quick in the middle: nobody is a star in their first year.
    const along = into / topFrom;
    share = BREAKTHROUGH_SHARE + (1 - BREAKTHROUGH_SHARE) * along * along * (3 - 2 * along);
  } else if (into <= declineFrom) {
    share = 1;
  } else if (into <= end) {
    share = 1 - (1 - LEGACY_SHARE) * ((into - declineFrom) / Math.max(1, end - declineFrom));
  } else {
    share = LEGACY_SHARE * (1 - LEGACY_FADE) ** (into - end);
  }
  return Math.round(figure.peak * share);
}

/** Whether they are still working: past their debut, before the end of a career. */
export const isWorking = (figure: Figure, year: number): boolean => {
  const age = year - figure.birthYear;
  return age >= figure.debut && age <= careerEndOf(figure) && age <= figure.dies;
};

export const isAlive = (figure: Figure, year: number): boolean => year <= deathYearOf(figure);

/** Oldest anybody lives to, so the search for people in a year is bounded. */
const OLDEST = 94;
/** Youngest anybody breaks through. */
const YOUNGEST = 16;

const cache = new Map<string, readonly Figure[]>();

/**
 * Everybody the world has heard of in a year, in a stable order. Cached, because the
 * same year is asked about many times and the answer cannot change.
 */
export function notablesIn(seed: string, year: number): readonly Figure[] {
  const key = `${seed}|${year}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const found: Figure[] = [];
  for (const field of CELEBRITY_FIELD_CATALOG) {
    for (let birthYear = year - OLDEST; birthYear <= year - YOUNGEST; birthYear += 1) {
      for (let slot = 0; slot < SLOTS_PER_YEAR; slot += 1) {
        if (!exists(seed, field, birthYear, slot)) continue;
        const figure = build(seed, field, birthYear, slot);
        if (fameIn(figure, year) >= NOTABLE_FAME) found.push(figure);
      }
    }
  }
  // Bounded: a long run of years never holds more than a few at once.
  if (cache.size > 48) cache.clear();
  cache.set(key, found);
  return found;
}

export const displayFigure = (figure: Figure): string => `${figure.firstName} ${figure.lastName}`;
