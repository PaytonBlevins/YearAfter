/**
 * Ticket 0808 — the awards across fields, and who else is famous.
 *
 * Acting, music and modeling each hand out their own award inside their own year. This is the layer above them: the
 * one yearly roll-up that reads what those years did, adds the ceremony sports and racing never had, and lets the
 * 0705 roster of famous people win the same awards and fill the same charts as the player.
 *
 * Nothing here is saved. A roster athlete's sport, a year's winner and a chart are all pure functions of the world's
 * seed, the year and the player's own records, so a reload, a continued life and a second device all agree. Every draw
 * is a hash, no random stream is touched, and a life that is near none of it replays exactly as before.
 */

import {
  CEREMONIES,
  CHART_NAMES,
  CHART_SIZE,
  CHART_TOP,
  LAUREL_ATHLETE,
  LAUREL_CEREMONY,
  LAUREL_CHANCE,
  LAUREL_DRIVER,
  LAUREL_FAME_CAP,
  LAUREL_FAME_EACH,
  LAUREL_MOOD,
  LAUREL_TITLE_MULTIPLE,
  NOMINEE_CHANCE,
  NOMINEE_FAME,
  NOMINEE_MOOD,
  REPEAT_WINS,
  ROSTER_AWARD_FLOOR,
  ROSTER_SPORT_WEIGHTS,
  SWEEP_FIELDS,
  SWEEP_MOOD,
  AWARD_CEREMONY,
  MODEL_AWARD_CEREMONY,
  MUSIC_AWARD_CEREMONY,
  findSport,
  type CeremonyId,
  type SportId,
  type SportTier,
} from '@yearafter/content';
import type { LifeRecord, NewLifeRecord } from '@yearafter/character';
import { mixedUnit } from '@yearafter/core';
import {
  NOTABLE_FAME,
  displayFigure,
  fameIn,
  isWorking,
  notablesIn,
  type Figure,
} from './celebrity-world';
import type { GameState } from './game-state';
import type { SportCareer } from './sports-state';

/** A [0, 1) draw about one life, keyed on the seed and a name. No RNG stream is touched. */
export const awardUnit = (
  seed: string,
  generation: number,
  ...parts: readonly (string | number)[]
): number => mixedUnit(`award:${seed}:${generation}:${parts.join(':')}`);

export const CEREMONY_NAMES: Readonly<Record<CeremonyId, string>> = {
  acting: AWARD_CEREMONY,
  music: MUSIC_AWARD_CEREMONY,
  modeling: MODEL_AWARD_CEREMONY,
  sports: LAUREL_CEREMONY,
};

/* -------------------------------------------------------------------------- */
/* The roster                                                                  */
/* -------------------------------------------------------------------------- */

const ROSTER_SPORT_TOTAL = ROSTER_SPORT_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

/**
 * The sport an athlete on the roster plays. The roster has no facts but fame, so this is a fresh hash per figure on a
 * part name nothing else uses. Anybody who is not an athlete plays none.
 */
export function sportOfFigure(seed: string, figure: Figure): SportId | undefined {
  if (figure.field !== 'athletics') return undefined;
  let point = mixedUnit(`${seed}:celeb:${figure.id}:sport`) * ROSTER_SPORT_TOTAL;
  // Every sport but the last takes its share in turn; whatever is left is the last's.
  for (const [sportId, weight] of ROSTER_SPORT_WEIGHTS.slice(0, -1)) {
    if (point < weight) return sportId;
    point -= weight;
  }
  return ROSTER_SPORT_WEIGHTS[ROSTER_SPORT_WEIGHTS.length - 1]![0];
}

export type RosterField = 'acting' | 'music' | 'athletics';

/** Who is in the running for a roster award: working, famous enough, and in the right field (and sport). */
export function rosterContenders(
  seed: string,
  year: number,
  field: RosterField,
  sports?: (sport: SportId) => boolean,
): readonly { readonly figure: Figure; readonly fame: number }[] {
  return notablesIn(seed, year)
    .filter((figure) => figure.field === field && isWorking(figure, year))
    .filter((figure) => {
      if (sports === undefined) return true;
      const sport = sportOfFigure(seed, figure);
      return sport !== undefined && sports(sport);
    })
    .map((figure) => ({ figure, fame: fameOf(figure, year) }))
    .filter((entry) => entry.fame >= ROSTER_AWARD_FLOOR);
}

const fameOf = fameIn;

/** A weighted pick, fame squared: a household name wins far more often than a name on the rise. */
export function pickByFame(
  seed: string,
  key: string,
  list: readonly { readonly figure: Figure; readonly fame: number }[],
): Figure | undefined {
  if (list.length === 0) return undefined;
  const total = list.reduce((sum, entry) => sum + entry.fame * entry.fame, 0);
  let point = mixedUnit(`${seed}:${key}`) * total;
  // Every figure but the last takes a share in turn; whatever is left is the last's.
  for (const entry of list.slice(0, -1)) {
    const weight = entry.fame * entry.fame;
    if (point < weight) return entry.figure;
    point -= weight;
  }
  return list[list.length - 1]!.figure;
}

/** Racing is its own award; everything else an athlete plays is Athlete of the Year. */
const isRacing = (sport: SportId): boolean => sport === 'racing';

/** The roster figure who wins a ceremony's award in a year, if the roster has anybody for it. */
export function rosterWinner(
  seed: string,
  year: number,
  ceremony: CeremonyId,
  racing = false,
): Figure | undefined {
  const field = CEREMONIES.find((entry) => entry.id === ceremony)?.field;
  if (field === undefined) return undefined;
  const list =
    field === 'athletics'
      ? rosterContenders(seed, year, field, racing ? isRacing : (sport) => !isRacing(sport))
      : rosterContenders(seed, year, field);
  return pickByFame(seed, `award:${ceremony}${racing ? ':racing' : ''}:${year}`, list);
}

/**
 * The champion of a sport in a year: the roster athlete who won it, unless the player did (`player` names the
 * player's own claim and is returned as undefined here, so the caller shows themselves).
 */
export function championOf(
  seed: string,
  year: number,
  sportId: SportId,
  playerWon = false,
): Figure | undefined {
  if (playerWon) return undefined;
  return pickByFame(
    seed,
    `champion:${sportId}:${year}`,
    rosterContenders(seed, year, 'athletics', (sport) => sport === sportId),
  );
}

/* -------------------------------------------------------------------------- */
/* Charts                                                                      */
/* -------------------------------------------------------------------------- */

export interface ChartEntry {
  readonly rank: number;
  readonly name: string;
  readonly fame: number;
  /** The player, when they are on it. */
  readonly player: boolean;
  /** A roster id; absent for the player. */
  readonly id?: string;
}

export type ChartField = 'acting' | 'music' | 'sports';

export function chartName(field: ChartField, sportId?: SportId): string {
  if (field !== 'sports') return CHART_NAMES[field];
  const sport = sportId === undefined ? undefined : findSport(sportId);
  return sport === undefined ? 'the sports rankings' : `the ${sport.leagueShort} rankings`;
}

/**
 * The most famous people in a field in a year, best first, the player among them when they are famous enough. Ties go
 * to the roster, then to the lower id, so a chart never reorders between loads. `sportId` narrows sports to one sport.
 */
export function chartOf(
  seed: string,
  year: number,
  field: ChartField,
  playerFame: number,
  sportId?: SportId,
): readonly ChartEntry[] {
  const rosterField: RosterField = field === 'sports' ? 'athletics' : field;
  const rows: { name: string; fame: number; player: boolean; id?: string }[] = notablesIn(
    seed,
    year,
  )
    .filter((figure) => figure.field === rosterField)
    .filter(
      (figure) =>
        sportId === undefined || field !== 'sports' || sportOfFigure(seed, figure) === sportId,
    )
    .map((figure) => ({
      name: displayFigure(figure),
      fame: fameOf(figure, year),
      player: false,
      id: figure.id,
    }));
  rows.sort((a, b) => b.fame - a.fame || (a.id ?? '').localeCompare(b.id ?? ''));
  // The player stands behind every roster name of the same fame.
  if (playerFame >= NOTABLE_FAME) {
    const ahead = rows.findIndex((row) => row.fame < playerFame);
    rows.splice(ahead === -1 ? rows.length : ahead, 0, {
      name: 'You',
      fame: playerFame,
      player: true,
    });
  }
  return rows.slice(0, CHART_SIZE).map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Where the player stands on a chart, 1-based, or undefined when they are not on it. */
export function playerRank(
  seed: string,
  year: number,
  field: ChartField,
  playerFame: number,
  sportId?: SportId,
): number | undefined {
  return chartOf(seed, year, field, playerFame, sportId).find((entry) => entry.player)?.rank;
}

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

export interface AwardsFieldInput {
  /** Awards the field's own year handed out this year. */
  readonly won: number;
  /** The fame the field's own year holds the player at. 0 when they are not working in it. */
  readonly fame: number;
}

export interface AwardsSportsInput {
  readonly sportId?: SportId;
  /** The tier a pro career ended the year in; absent when there is no pro career. */
  readonly tier?: SportTier;
  /** A title, medal or championship in the season just played. */
  readonly titled: boolean;
  readonly fame: number;
}

export interface AwardsYearInput {
  readonly seed: string;
  readonly generation: number;
  /** The year that has just come in. */
  readonly year: number;
  readonly acting: AwardsFieldInput;
  readonly music: AwardsFieldInput;
  readonly modeling: AwardsFieldInput;
  readonly sports: AwardsSportsInput;
  /** The player's records BEFORE this year's. */
  readonly records: readonly LifeRecord[];
}

/** What the four fields' own years just did, as the awards layer reads it. */
export interface AwardsPieces {
  readonly acting: { readonly acting: { readonly awards: number }; readonly fame: number };
  readonly music: { readonly music: { readonly awards: number }; readonly fame: number };
  readonly modeling: { readonly modeling: { readonly awards: number }; readonly fame: number };
  readonly sports: {
    readonly sports: { readonly career?: SportCareer | undefined };
    readonly fame: number;
  };
}

/**
 * The awards layer's input from the year that has just been played: the awards each field handed out (the change in
 * its count), the fame it holds the player at, and, for sports, the pro career they ended the year in and whether the
 * season won a title. `state` is the state BEFORE the year; `year` is the year that has just come in.
 */
export function awardsInputOf(
  state: GameState,
  year: number,
  pieces: AwardsPieces,
): AwardsYearInput {
  const career = pieces.sports.sports.career;
  const was = state.sports.career;
  const pro = career?.stage === 'pro';
  return {
    seed: state.rng.getSeed(),
    generation: state.world.generation,
    year,
    acting: { won: pieces.acting.acting.awards - state.acting.awards, fame: pieces.acting.fame },
    music: { won: pieces.music.music.awards - state.music.awards, fame: pieces.music.fame },
    modeling: {
      won: pieces.modeling.modeling.awards - state.modeling.awards,
      fame: pieces.modeling.fame,
    },
    sports: {
      ...(pro ? { sportId: career.sportId as SportId, tier: career.tier } : {}),
      titled:
        career !== undefined &&
        was !== undefined &&
        career.sportId === was.sportId &&
        career.titles > was.titles,
      fame: pieces.sports.fame,
    },
    records: state.player.records,
  };
}

export interface AwardsYearLine {
  readonly kind: 'passive' | 'milestone';
  readonly text: string;
}

export interface AwardsYearOutput {
  readonly lines: readonly AwardsYearLine[];
  readonly records: readonly NewLifeRecord[];
  readonly mood: number;
  /** The fame a pro career holds at, with the Laurels it has won added; 0 when there is none. */
  readonly fame: number;
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How many awards a ceremony has given the player, from the records alone. */
export function winsAt(records: readonly LifeRecord[], ceremony: string): number {
  const ending = new RegExp(`, ${escape(ceremony)}, \\d{4}$`);
  return records.filter((record) => record.category === 'award' && ending.test(record.label))
    .length;
}

/** Fame the Laurels a player has won add to a sports career, capped. */
export const laurelFame = (wins: number): number =>
  Math.min(LAUREL_FAME_CAP, wins * LAUREL_FAME_EACH);

export const laurelName = (racing: boolean): string => (racing ? LAUREL_DRIVER : LAUREL_ATHLETE);

const ORDINALS = ['', 'one', 'two', 'three', 'four'] as const;

export function runAwardsYear(input: AwardsYearInput): AwardsYearOutput {
  const { seed, generation, year, records } = input;
  const lines: AwardsYearLine[] = [];
  const out: NewLifeRecord[] = [];
  let mood = 0;

  const has = (label: string): boolean => records.some((record) => record.label === label);
  const sportId = input.sports.sportId;
  const racing = sportId === 'racing';

  /* The Laurels: a pro who is good enough, more likely in a year they won something. */
  const tier = input.sports.tier;
  let laurel = false;
  if (tier !== undefined) {
    const chance = LAUREL_CHANCE[tier] * (input.sports.titled ? LAUREL_TITLE_MULTIPLE : 1);
    laurel = awardUnit(seed, generation, 'laurel', year) < chance;
  }
  if (laurel) {
    const name = laurelName(racing);
    mood += LAUREL_MOOD;
    lines.push({ kind: 'milestone', text: `Named ${name} at ${LAUREL_CEREMONY}.` });
    out.push({ category: 'award', label: `${name}, ${LAUREL_CEREMONY}, ${year}` });
  }

  /* Wins across fields in one year. */
  const wins: readonly (readonly [CeremonyId, number])[] = [
    ['acting', input.acting.won],
    ['music', input.music.won],
    ['modeling', input.modeling.won],
    ['sports', laurel ? 1 : 0],
  ];
  const fields = wins.filter(([, count]) => count > 0).length;
  if (fields >= SWEEP_FIELDS) {
    mood += SWEEP_MOOD;
    const label = `Won awards in ${ORDINALS[fields] ?? fields} fields in ${year}`;
    lines.push({
      kind: 'milestone',
      text: `A year of awards in ${ORDINALS[fields] ?? fields} fields.`,
    });
    out.push({ category: 'award', label });
  }

  /* The third win at one ceremony is remembered. */
  for (const [ceremony, count] of wins) {
    if (count === 0) continue;
    const name = CEREMONY_NAMES[ceremony];
    const before = winsAt(records, name);
    if (before < REPEAT_WINS && before + count >= REPEAT_WINS) {
      const label = `Three-time winner at ${name}`;
      lines.push({ kind: 'milestone', text: `${label}.` });
      out.push({ category: 'award', label });
    }
  }

  /* Charts: the first time in the top ten, and the first time at the top. */
  const standings: readonly (readonly [ChartField, number, SportId | undefined])[] = [
    ['acting', input.acting.fame, undefined],
    ['music', input.music.fame, undefined],
    ['sports', input.sports.fame, sportId],
  ];
  for (const [field, fame, sport] of standings) {
    if (fame < NOTABLE_FAME) continue;
    const rank = playerRank(seed, year, field, fame, sport);
    if (rank === undefined) continue;
    const name = chartName(field, sport);
    const topTen = `Entered the top ${CHART_TOP} of ${name}`;
    const first = `Reached No. 1 on ${name}`;
    if (rank <= CHART_TOP && !has(topTen)) {
      lines.push({ kind: 'milestone', text: `${topTen}.` });
      out.push({ category: 'career', label: topTen });
    }
    if (rank === 1 && !has(first)) {
      lines.push({ kind: 'milestone', text: `${first}.` });
      out.push({ category: 'career', label: first });
    }
  }

  /* Up for it and lost: one line a year, at the first ceremony it happened at. */
  const contending: readonly (readonly [CeremonyId, number, boolean])[] = [
    ['acting', input.acting.fame, input.acting.won > 0],
    ['music', input.music.fame, input.music.won > 0],
    ['sports', input.sports.fame, laurel],
  ];
  for (const [ceremony, fame, won] of contending) {
    if (won || fame < NOMINEE_FAME) continue;
    if (ceremony === 'sports' && tier === undefined) continue;
    if (awardUnit(seed, generation, 'nominee', ceremony, year) >= NOMINEE_CHANCE) continue;
    const winner = rosterWinner(seed, year, ceremony, ceremony === 'sports' && racing);
    if (winner === undefined) continue;
    const what = ceremony === 'sports' ? laurelName(racing) : 'an award';
    lines.push({
      kind: 'passive',
      text: `You were up for ${what} at ${CEREMONY_NAMES[ceremony]}. ${displayFigure(winner)} took it.`,
    });
    mood += NOMINEE_MOOD;
    break;
  }

  const sportsWins = winsAt(records, LAUREL_CEREMONY) + (laurel ? 1 : 0);
  const fame =
    input.sports.fame > 0 ? Math.min(100, input.sports.fame + laurelFame(sportsWins)) : 0;
  return { lines, records: out, mood, fame };
}
