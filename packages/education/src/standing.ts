/**
 * Ticket 0206b — how you are actually doing in the thing you joined.
 *
 * Review: "Please monitor sports team performance and have buttons to practice
 * and raise performance and interact with peers."
 *
 * Before this, joining a team was a row that said you were on it and a small
 * stat effect every year. Nothing tracked whether you were any good, nothing
 * the player did could change it, and a season passed without comment. Being on
 * the team was a fact rather than a story.
 *
 * So every joined activity now carries a STANDING — 0–100, where you sit in
 * that squad or that cast — and every year it plays a season and says how it
 * went. The player raises it by practising, which costs hours like everything
 * else and therefore feeds workload and stress.
 *
 * The number is never shown. Spec 786–795: outcomes are explained through
 * context, not formulas. What the player sees is "Made the starting five" and
 * "Rode the bench all season", which is what a person would actually say.
 */

import type { Talents, VisibleStats } from '@yearafter/character';
import { clampStat, type StatValue } from '@yearafter/core';
import type { Activity, ActivityKind } from '@yearafter/content';
import type { TalentKey } from '@yearafter/character';
import type { EnrolledActivity } from './school';

/** Where a newcomer starts: in the squad, and nowhere near the front of it. */
export const STARTING_STANDING = 40;

/** Practice sessions the player can put in per activity per year. */
export const PRACTICE_SESSIONS = 3;

/** What one session is worth, before who is doing it. */
export const PRACTICE_GAIN = 7;

/**
 * How much of the year's standing is decided by the character rather than the
 * work they put in.
 *
 * Talent and the relevant stat set a level the character tends towards; effort
 * moves them off it. Without the pull, practice would be the only input and
 * every character who pressed the button would end up identical.
 *
 * ASYMMETRIC, and that is the whole point. Rising to your natural level is fast
 * — a talented kid who turns up gets good quickly. Being dragged back DOWN from
 * a level you earned is slow, because you earned it. Reading output with a
 * symmetric pull found six years of practising three times a year taking a
 * character from 40 to 71 and never to genuinely good: the pull ate the work
 * every single year, and the button the review asked for did not really do
 * anything.
 */
export const NATURAL_PULL_UP = 0.3;
export const NATURAL_PULL_DOWN = 0.1;

const KIND_TALENT: Readonly<Record<ActivityKind, TalentKey | undefined>> = {
  sport: 'athletics',
  arts: 'acting',
  academic: 'academics',
  service: undefined,
  social: undefined,
};

/**
 * The level this character tends towards in this activity, left alone.
 *
 * Deliberately generous at the bottom: spec 949 wants the game fun at every
 * level, and being permanently terrible at the one thing you joined is not a
 * story anybody plays twice.
 */
export function naturalStanding(activity: Activity, stats: VisibleStats, talents: Talents): number {
  const stat = activity.tryout?.stat ?? 'discipline';
  const talent = KIND_TALENT[activity.kind];
  const talented = talent ? talents[talent] : false;
  const base = 32 + (stats[stat] - 50) * 0.55 + (stats.discipline - 50) * 0.2;
  return clampStat(Math.round(base + (talented ? 16 : 0)));
}

/** Practice sessions already used on this activity this year. */
export const practisedThisYear = (entry: EnrolledActivity, age: number): number =>
  entry.practisedAtAge === age ? entry.practiceCount : 0;

export const practiceLeft = (entry: EnrolledActivity, age: number): number =>
  Math.max(0, PRACTICE_SESSIONS - practisedThisYear(entry, age));

/**
 * What one session of practice is worth to this character.
 *
 * Discipline and willpower decide how much of an afternoon is actually
 * practice, and each session inside one year is worth less than the last —
 * three afternoons in a week is a good week, and the tenth is a plateau.
 */
export function practiceGain(
  stats: VisibleStats,
  standing: number,
  sessionsAlready: number,
): number {
  const effort = 1 + (stats.discipline - 50) / 140 + (stats.willpower - 50) / 180;
  const repeat = 1 - sessionsAlready * 0.22;
  // Getting better is hardest when you are already good, which is true and also
  // stops three afternoons a year taking anybody to 100.
  const headroom = 0.35 + ((100 - standing) / 100) * 0.85;
  const gain = PRACTICE_GAIN * effort * Math.max(0.2, repeat) * headroom;
  return Math.max(1, Math.round(gain));
}

/** A year of the season pulling standing back towards the character's level. */
export function driftStanding(
  standing: number,
  activity: Activity,
  stats: VisibleStats,
  talents: Talents,
): StatValue {
  const natural = naturalStanding(activity, stats, talents);
  const pull = natural > standing ? NATURAL_PULL_UP : NATURAL_PULL_DOWN;
  return clampStat(Math.round(standing + (natural - standing) * pull));
}

/* -------------------------------------------------------------------------- */
/* What the player reads                                                       */
/* -------------------------------------------------------------------------- */

export type StandingBand = 'benched' | 'squad' | 'regular' | 'star';

export function standingBand(standing: number): StandingBand {
  if (standing >= 82) return 'star';
  if (standing >= 60) return 'regular';
  if (standing >= 35) return 'squad';
  return 'benched';
}

/**
 * Where you sit, in words, by the kind of thing it is.
 *
 * A cast and a squad do not use the same nouns, and a player reading "second
 * string" about the school play would notice immediately.
 */
export function standingLabelFor(activity: Activity, standing: number): string {
  const band = standingBand(standing);
  if (activity.kind === 'sport') {
    return {
      star: 'One of the best on the team',
      regular: 'In the starting side',
      squad: 'In the squad, not the first eleven',
      benched: 'Mostly on the bench',
    }[band];
  }
  if (activity.kind === 'arts') {
    return {
      star: 'They build it around you',
      regular: 'A real part, every time',
      squad: 'In it, somewhere near the back',
      benched: 'Helping with the chairs',
    }[band];
  }
  return {
    star: 'The one they ask first',
    regular: 'Carrying your share and then some',
    squad: 'Turning up and doing the work',
    benched: 'On the list, and not much more',
  }[band];
}

/**
 * The season, in one line, at the end of the year.
 *
 * This is the whole of what "monitor sports team performance" means to a
 * player: not a table, a sentence about how the year went — which is spec
 * 786–795 applied to a scoreboard.
 */
export function seasonLine(
  activity: Activity,
  standing: number,
  seasons: number,
  roll: number,
): string {
  const band = standingBand(standing);
  const noun = activity.name.toLowerCase();

  if (band === 'star') {
    return roll < 0.5
      ? `Carried ${noun} this season. People who do not follow it knew your name.`
      : `Best season yet at ${noun}. There was talk, and some of it was serious.`;
  }
  if (band === 'regular') {
    return roll < 0.5
      ? `A solid season at ${noun}. In every week, and missed when you were not.`
      : `Held your place at ${noun} all year without ever quite taking it over.`;
  }
  if (band === 'squad') {
    // A first year in the squad reads differently from a fourth.
    if (seasons <= 1) return `First season at ${noun}. Mostly learning where to stand.`;
    return roll < 0.5
      ? `Another season at ${noun}, somewhere in the middle of it.`
      : `Stuck around at ${noun}. Not the best, and not going anywhere.`;
  }
  return roll < 0.5
    ? `Barely got on at ${noun} this season. It was a long year of watching.`
    : `Turned up to everything at ${noun} and played almost none of it.`;
}
