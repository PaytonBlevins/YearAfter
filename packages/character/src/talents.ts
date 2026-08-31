/**
 * Natural talents.
 *
 * PROTECTED CONTRACT (spec 1060–1066): character state.
 *
 * Spec 1069–1070, canonical: talents are BOOLEAN, assigned at birth, persistent.
 * There is deliberately no numeric talent strength — overall impact emerges from
 * the flag interacting with attributes, experience, career skills, reputation,
 * opportunity and controlled randomness. A character may have zero, one, or
 * several talents (spec 0201).
 *
 * Spec 8 removed the narrower Mathematics / Science / Singing / Technical
 * talents; Academics and Music are broad, Inventive replaced Technical.
 */

export const TALENT_KEYS = [
  'athletics',
  'acting',
  'music',
  'writing',
  'academics',
  'inventive',
  'crime',
] as const;

export type TalentKey = (typeof TALENT_KEYS)[number];

/** Boolean only. Do not add a strength number here (spec 1070). */
export type Talents = { readonly [K in TalentKey]: boolean };

export const TALENT_LABELS: Readonly<Record<TalentKey, string>> = {
  athletics: 'Athletics',
  acting: 'Acting',
  music: 'Music',
  writing: 'Writing',
  academics: 'Academics',
  inventive: 'Inventive',
  crime: 'Crime',
};

export const TALENT_DESCRIPTIONS: Readonly<Record<TalentKey, string>> = {
  athletics: 'Physical aptitude across sports and combat disciplines.',
  acting: 'Screen presence and range.',
  music: 'Singing, instruments, composition and production.',
  writing: 'Prose, scripts, lyrics and long-form work.',
  academics: 'Faster learning and access to intellectually demanding paths.',
  inventive: 'Invention, engineering intuition and product insight.',
  crime: 'Instinct for the illegitimate economy.',
};

export function createTalents(active: Iterable<TalentKey> = []): Talents {
  const set = new Set(active);
  const result = {} as { [K in TalentKey]: boolean };
  for (const key of TALENT_KEYS) {
    result[key] = set.has(key);
  }
  return result;
}

export const hasTalent = (talents: Talents, key: TalentKey): boolean => talents[key];

export const activeTalents = (talents: Talents): TalentKey[] =>
  TALENT_KEYS.filter((key) => talents[key]);
