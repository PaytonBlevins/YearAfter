/**
 * Ticket 0803 — what every kind of sporting year shares.
 *
 * The draws, the injury roll, the way form moves, and the words for money and rank. They sat inside
 * `sports.ts` until the individual sports (`sports-individual.ts`) needed them too; moving them here
 * is the only way both files can use them without importing each other.
 *
 * Nothing here knows about a draft, a contract or a tour. Every draw is a hash of the seed, the
 * generation and a name, so no RNG stream is touched and a life that plays no sport replays exactly.
 */

import {
  CAREER_ENDING_SHARE,
  SERIOUS_SHARE,
  naturalForm,
  type Sport,
  type SportTier,
} from '@yearafter/content';
import { mixedUnit, stablePick } from '@yearafter/core';
import type { GameState } from './game-state';
import type { CareerTier, SportCareer } from './sports-state';

/** A [0, 1) draw about one life, keyed on the seed and a name. No RNG stream is touched. */
export const sportUnit = (
  seed: string,
  generation: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`sport:${seed}:${generation}:${parts.join(':')}`);

/**
 * The position a life plays, a label only (0802): drawn from the sport's list by
 * a hash of the life, so it is the same every time, costs no save field, and
 * has no effect on the odds, the pay or the skills.
 */
export function positionIn(seed: string, generation: number, sport: Sport): string {
  const list = sport.positions;
  return list[Math.floor(sportUnit(seed, generation, 'position', sport.id) * list.length)] ?? '';
}

export const money = (dollars: number): string => {
  if (dollars >= 1_000_000) {
    const millions = dollars / 1_000_000;
    return `$${millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10} million`;
  }
  return `$${Math.round(dollars).toLocaleString('en-US')}`;
};

/** CORE_RULES 13.22: the base holds still for the life, the key moves it. */
export function pick(lines: readonly string[], key: string): string {
  return stablePick(lines, key) ?? lines[0] ?? '';
}

export const tierRank = (tier: CareerTier): number =>
  (['fringe', 'role', 'starter', 'star', 'superstar'] as const).indexOf(tier);

export const tierWords = (tier: CareerTier): string =>
  ({
    fringe: 'on the edge of the roster',
    role: 'a role player',
    starter: 'a starter',
    star: 'a star',
    superstar: 'a superstar',
  })[tier];

export function bestTierOf(career: SportCareer): CareerTier {
  // The peak is what the career reached, so long as it got there; a career cut short is what it was.
  if (!career.peak) return career.tier ?? 'fringe';
  return (career.proSeasons ?? 0) >= (career.breakout ?? 1)
    ? career.peak
    : (career.tier ?? 'fringe');
}

export function healthAdjusted(chance: number, health: number): number {
  return Math.max(0.03, Math.min(0.4, chance + (50 - health) * 0.0015));
}

export type Injury = 'none' | 'minor' | 'serious' | 'ending';

export function injuryOf(seed: string, gen: number, year: number, chance: number): Injury {
  if (sportUnit(seed, gen, 'injury', year) >= chance) return 'none';
  const severity = sportUnit(seed, gen, 'severity', year);
  if (severity < CAREER_ENDING_SHARE) return 'ending';
  if (severity < CAREER_ENDING_SHARE + SERIOUS_SHARE) return 'serious';
  return 'minor';
}

/** The age a body starts to give back what it has built, unless a sport says otherwise. */
export const DEFAULT_DECLINE_FROM = 30;

/** How good they are next year: a pull towards what health and discipline allow, and the years catching up. */
export function nextForm(
  before: GameState,
  career: SportCareer,
  age: number,
  declineFrom: number = DEFAULT_DECLINE_FROM,
): number {
  const natural = naturalForm(
    before.player.stats.health,
    before.player.stats.discipline,
    before.player.talents.athletics,
  );
  const pull = natural > career.form ? 0.3 : 0.1;
  const ageing = career.stage === 'pro' ? Math.max(0, age - declineFrom) * 1.2 : 0;
  return Math.max(
    0,
    Math.min(100, Math.round(career.form + (natural - career.form) * pull - ageing)),
  );
}

export type { SportTier };

export const MINOR_INJURY_LINES: readonly string[] = [
  'A sprained ankle cost you a few games.',
  'Missed two weeks with a bruised knee.',
  'Played through a sore shoulder, and it showed.',
];

export const SERIOUS_LINES: readonly string[] = [
  'Tore something in your knee and missed the rest of the season.',
  'A broken foot ended your season in December.',
  'Surgery in the spring, and a long summer of rehab.',
];

export const COLLEGE_SERIOUS_LINES: readonly string[] = [
  'An injury ended your season early.',
  'Missed most of the year with a bad knee.',
];

/** A tour player's injuries: a body that swings the same motion ten thousand times a year. */
export const TOUR_MINOR_LINES: readonly string[] = [
  'A sore wrist cost you two events.',
  'Withdrew from a tournament with a strained back.',
  'Played through a bad shoulder and finished where it showed.',
];

export const TOUR_SERIOUS_LINES: readonly string[] = [
  'Surgery on your shoulder, and the rest of the season gone.',
  'A stress fracture in your back ended the season in the summer.',
  'Elbow surgery, and a long winter of rehab.',
];

/** A fighter's: cuts, hands, and the knees nobody ever mentions. */
export const COMBAT_MINOR_LINES: readonly string[] = [
  'A cut over the eye cost you a camp.',
  'Broke a knuckle in sparring and fought the next card on tape.',
  'Three weeks out with bruised ribs.',
];

export const COMBAT_SERIOUS_LINES: readonly string[] = [
  'A broken hand, and the fight was off.',
  'Tore a knee in camp. Surgery in the spring.',
  'A fractured orbital bone ended your year.',
];

/** An Olympic athlete's: the hamstring, the shoulder and the knee (ticket 0804). */
export const OLYMPIC_MINOR_LINES: readonly string[] = [
  'A tight hamstring cost you a meet.',
  'Pulled out of a qualifier with a sore shoulder.',
  'A sprained ankle kept you off the mat for a month.',
];

export const OLYMPIC_SERIOUS_LINES: readonly string[] = [
  'A torn ligament ended the season in the spring.',
  'Surgery on your knee, and a year of rehab.',
  'A stress fracture, and the season was gone.',
];
