/**
 * Ticket 0808 acceptance tests — the awards across fields, and the roster that wins them.
 *
 * Acting, music and modeling already hand out their own awards (0805–0807, untouched). This is the layer above:
 * the Laurel Sports Awards for athletes and drivers, a year with awards in more than one field, the third win at one
 * ceremony, the charts, and the 0705 roster winning the same awards and filling the same charts as the player.
 * Every number in it is game judgement and the ticket document says so. Nothing is saved: all of it is derived.
 */

import { describe, expect, it } from 'vitest';
import {
  AWARD_CEREMONY,
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
  MODEL_AWARD_CEREMONY,
  MUSIC_AWARD_CEREMONY,
  NOMINEE_CHANCE,
  NOMINEE_FAME,
  NOMINEE_MOOD,
  REPEAT_WINS,
  ROSTER_AWARD_FLOOR,
  ROSTER_SPORT_WEIGHTS,
  SPORTS,
  SWEEP_FIELDS,
  SWEEP_MOOD,
  findSport,
  type SportTier,
} from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';
import type { LifeRecord } from '@yearafter/character';
import { advanceYear } from './advance';
import {
  CEREMONY_NAMES,
  awardUnit,
  awardsInputOf,
  championOf,
  chartName,
  chartOf,
  laurelFame,
  laurelName,
  pickByFame,
  playerRank,
  rosterContenders,
  rosterWinner,
  runAwardsYear,
  sportOfFigure,
  winsAt,
  type AwardsYearInput,
} from './awards';
import { NOTABLE_FAME, displayFigure, fameIn, isWorking, notablesIn } from './celebrity-world';
import { decide } from './decide';
import type { GameState } from './game-state';
import { createNewGame } from './new-game';

const SEED = 'awards-0808';

const NOTHING: AwardsYearInput = {
  seed: SEED,
  generation: 0,
  year: 2040,
  acting: { won: 0, fame: 0 },
  music: { won: 0, fame: 0 },
  modeling: { won: 0, fame: 0 },
  sports: { titled: false, fame: 0 },
  records: [],
};

const record = (
  label: string,
  category: LifeRecord['category'] = 'award',
  year = 2030,
): LifeRecord => ({
  id: `r:${year}:${category}:${label}`,
  category,
  age: 30,
  year,
  label,
});

const wins = (ceremony: string, n: number): LifeRecord[] =>
  Array.from({ length: n }, (_, index) => record(`Best Something, ${ceremony}, ${2020 + index}`));

const run = (over: Partial<AwardsYearInput>) => runAwardsYear({ ...NOTHING, ...over });

/** A year in which the draw `part` falls under `chance` (or over it), so a rule is read off a year that got there. */
function yearWhere(pick: (year: number) => boolean, from = 2000, to = 2400): number {
  for (let year = from; year < to; year += 1) if (pick(year)) return year;
  throw new Error('no year satisfied the test');
}

/* -------------------------------------------------------------------------- */
/* The rows                                                                    */
/* -------------------------------------------------------------------------- */

describe('the ceremonies', () => {
  it('are four, one for each field that has a prize, with the older three named as they already were', () => {
    expect(CEREMONIES.map((row) => row.id)).toEqual(['acting', 'music', 'modeling', 'sports']);
    expect(CEREMONY_NAMES).toEqual({
      acting: AWARD_CEREMONY,
      music: MUSIC_AWARD_CEREMONY,
      modeling: MODEL_AWARD_CEREMONY,
      sports: LAUREL_CEREMONY,
    });
    expect(AWARD_CEREMONY).toBe('the Marquee Awards');
    expect(MUSIC_AWARD_CEREMONY).toBe('the Silverline Music Awards');
    expect(MODEL_AWARD_CEREMONY).toBe('the Atelier Awards');
    expect(LAUREL_CEREMONY).toBe('the Laurel Sports Awards');
    expect(new Set(Object.values(CEREMONY_NAMES)).size).toBe(4);
  });

  it('give the roster three of them: models are not on the roster', () => {
    expect(CEREMONIES.find((row) => row.id === 'acting')!.field).toBe('acting');
    expect(CEREMONIES.find((row) => row.id === 'music')!.field).toBe('music');
    expect(CEREMONIES.find((row) => row.id === 'sports')!.field).toBe('athletics');
    expect(CEREMONIES.find((row) => row.id === 'modeling')!.field).toBeUndefined();
  });

  it('never promise more than a sure thing, even in a year with a title', () => {
    for (const chance of Object.values(LAUREL_CHANCE)) {
      expect(chance * LAUREL_TITLE_MULTIPLE).toBeLessThanOrEqual(1);
    }
  });

  it('chances rise with the tier, and only the top three tiers are ever named', () => {
    const tiers: SportTier[] = ['fringe', 'role', 'starter', 'star', 'superstar'];
    expect(LAUREL_CHANCE.fringe).toBe(0);
    expect(LAUREL_CHANCE.role).toBe(0);
    for (let i = 3; i < tiers.length; i += 1) {
      expect(LAUREL_CHANCE[tiers[i]!]).toBeGreaterThan(LAUREL_CHANCE[tiers[i - 1]!]);
    }
    expect(LAUREL_CHANCE.starter).toBeGreaterThan(0);
    expect(LAUREL_TITLE_MULTIPLE).toBeGreaterThan(1);
    expect(LAUREL_CHANCE.superstar * LAUREL_TITLE_MULTIPLE).toBeLessThanOrEqual(1);
    expect(LAUREL_MOOD).toBeGreaterThan(0);
    expect(SWEEP_FIELDS).toBe(2);
    expect(SWEEP_MOOD).toBeGreaterThan(0);
    expect(REPEAT_WINS).toBe(3);
    expect(NOMINEE_MOOD).toBeLessThan(0);
    expect(NOMINEE_CHANCE).toBeGreaterThan(0);
    expect(NOMINEE_CHANCE).toBeLessThan(1);
    expect(LAUREL_FAME_CAP).toBeGreaterThanOrEqual(LAUREL_FAME_EACH);
  });

  it('name the athlete’s prize and the driver’s', () => {
    expect(LAUREL_ATHLETE).toBe('Athlete of the Year');
    expect(LAUREL_DRIVER).toBe('Driver of the Year');
    expect(laurelName(false)).toBe(LAUREL_ATHLETE);
    expect(laurelName(true)).toBe(LAUREL_DRIVER);
  });
});

describe('the roster’s sports', () => {
  it('weigh every sport once, racing last, with only sports that exist', () => {
    const ids = ROSTER_SPORT_WEIGHTS.map(([id]) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.at(-1)).toBe('racing');
    expect(ids).toHaveLength(14);
    for (const id of ids) expect(findSport(id), id).toBeDefined();
    const missing = SPORTS.filter((sport) => !ids.includes(sport.id as never)).map((row) => row.id);
    // The Olympic boxing program is the same athletes as boxing, so the roster has no row of its own for it.
    expect(missing).toEqual(['olympic-boxing']);
    for (const [, weight] of ROSTER_SPORT_WEIGHTS) expect(weight).toBeGreaterThan(0);
    const racing = ROSTER_SPORT_WEIGHTS.find(([id]) => id === 'racing')![1];
    const total = ROSTER_SPORT_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
    expect(racing / total).toBeGreaterThan(0.02);
    expect(racing / total).toBeLessThan(0.1);
  });
});

/* -------------------------------------------------------------------------- */
/* The roster                                                                  */
/* -------------------------------------------------------------------------- */

const athletes = (year: number) =>
  notablesIn(SEED, year).filter((figure) => figure.field === 'athletics');

describe('a roster athlete’s sport', () => {
  it('is a hash of the figure, the same every time, and nothing for anybody who is not an athlete', () => {
    for (const figure of notablesIn(SEED, 2040)) {
      const sport = sportOfFigure(SEED, figure);
      expect(sportOfFigure(SEED, figure)).toBe(sport);
      if (figure.field === 'athletics') expect(sport).toBeDefined();
      else expect(sport).toBeUndefined();
    }
  });

  it('follows the weights to the point: the weights sum to a hundred and each figure lands where its draw says', () => {
    expect(ROSTER_SPORT_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0)).toBe(100);
    // The cumulative edges, written out by hand: basketball up to 17, football to 34, and so on to racing at the end.
    const edges: readonly (readonly [number, string])[] = [
      [17, 'basketball'],
      [34, 'football'],
      [45, 'baseball'],
      [58, 'soccer'],
      [65, 'hockey'],
      [71, 'golf'],
      [77, 'tennis'],
      [81, 'boxing'],
      [85, 'mma'],
      [89, 'track'],
      [92, 'swimming'],
      [94, 'gymnastics'],
      [95, 'wrestling'],
      [100, 'racing'],
    ];
    let checked = 0;
    for (const seed of [SEED, 'roster-a', 'roster-b']) {
      for (const year of [2040, 2055, 2070]) {
        for (const figure of notablesIn(seed, year).filter((row) => row.field === 'athletics')) {
          const point = mixedUnit(`${seed}:celeb:${figure.id}:sport`) * 100;
          const expected = edges.find(([edge]) => point < edge)![1];
          expect(sportOfFigure(seed, figure), `${seed} ${figure.id}`).toBe(expected);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(150);
  });

  it('differs with the world’s seed', () => {
    const years = [2040, 2060];
    let differ = 0;
    for (const year of years) {
      for (const figure of athletes(year)) {
        if (sportOfFigure('another-world', figure) !== sportOfFigure(SEED, figure)) differ += 1;
      }
    }
    expect(differ).toBeGreaterThan(5);
  });

  it('follows the weights over a whole world of athletes, and the big sports lead', () => {
    const seen = new Map<string, number>();
    let total = 0;
    const done = new Set<string>();
    for (let year = 1950; year < 2250; year += 1) {
      for (const figure of athletes(year)) {
        if (done.has(figure.id)) continue;
        done.add(figure.id);
        const sport = sportOfFigure(SEED, figure)!;
        seen.set(sport, (seen.get(sport) ?? 0) + 1);
        total += 1;
      }
    }
    expect(total).toBeGreaterThan(250);
    const weightTotal = ROSTER_SPORT_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [id, weight] of ROSTER_SPORT_WEIGHTS) {
      const expected = weight / weightTotal;
      const share = (seen.get(id) ?? 0) / total;
      expect(Math.abs(share - expected), id).toBeLessThan(0.08);
    }
    expect(seen.get('basketball')!).toBeGreaterThan(seen.get('wrestling') ?? 0);
    expect(seen.get('racing') ?? 0).toBeGreaterThan(0);
  });
});

describe('who is in the running', () => {
  it('is every working figure of the field whose fame is at least the floor, none below it, and no one else', () => {
    let edge = 0;
    for (let year = 1960; year < 2260; year += 1) {
      for (const field of ['acting', 'music', 'athletics'] as const) {
        const list = rosterContenders(SEED, year, field);
        const expected = notablesIn(SEED, year).filter(
          (figure) =>
            figure.field === field &&
            isWorking(figure, year) &&
            fameIn(figure, year) >= ROSTER_AWARD_FLOOR,
        );
        expect(list.map((row) => row.figure.id)).toEqual(expected.map((figure) => figure.id));
        for (const row of list) {
          expect(row.fame).toBe(fameIn(row.figure, year));
          if (row.fame === ROSTER_AWARD_FLOOR) edge += 1;
        }
      }
    }
    // The floor itself is in the running: the sweep reaches a figure at exactly that fame.
    expect(edge).toBeGreaterThan(0);
  });

  it('keeps a sport apart from the rest of its field', () => {
    for (let year = 2000; year < 2100; year += 1) {
      const all = rosterContenders(SEED, year, 'athletics');
      const racing = rosterContenders(SEED, year, 'athletics', (sport) => sport === 'racing');
      const rest = rosterContenders(SEED, year, 'athletics', (sport) => sport !== 'racing');
      expect(racing.length + rest.length).toBe(all.length);
      for (const row of racing) expect(sportOfFigure(SEED, row.figure)).toBe('racing');
    }
  });
});

describe('a pick weighted by fame squared', () => {
  const figure = (id: string) => ({ id }) as never;
  it('picks the first of two equals when the draw is under a half, and the second after', () => {
    const list = [
      { figure: figure('a'), fame: 1 },
      { figure: figure('b'), fame: 1 },
    ];
    let first = 0;
    let second = 0;
    for (let index = 0; index < 300; index += 1) {
      const u = mixedUnit(`${SEED}:pick${index}`);
      const picked = pickByFame(SEED, `pick${index}`, list) as unknown as { id: string };
      expect(picked.id).toBe(u * 2 < 1 ? 'a' : 'b');
      if (picked.id === 'a') first += 1;
      else second += 1;
    }
    expect(first).toBeGreaterThan(100);
    expect(second).toBeGreaterThan(100);
  });

  it('weighs a name by the square of its fame: twice the fame is four times the chance', () => {
    const list = [
      { figure: figure('a'), fame: 10 },
      { figure: figure('b'), fame: 20 },
    ];
    for (let index = 0; index < 300; index += 1) {
      const u = mixedUnit(`${SEED}:sq${index}`);
      const picked = pickByFame(SEED, `sq${index}`, list) as unknown as { id: string };
      expect(picked.id).toBe(u * 500 < 100 ? 'a' : 'b');
    }
  });

  it('picks nobody from nobody and the one from one', () => {
    expect(pickByFame(SEED, 'none', [])).toBeUndefined();
    const only = figure('only');
    expect(pickByFame(SEED, 'one', [{ figure: only, fame: 40 }])).toBe(only);
  });
});

describe('who wins a roster award', () => {
  it('is one working figure of the right field, famous enough, the same every time', () => {
    let found = 0;
    for (let year = 2000; year < 2100; year += 1) {
      for (const ceremony of ['acting', 'music'] as const) {
        const winner = rosterWinner(SEED, year, ceremony);
        expect(rosterWinner(SEED, year, ceremony)).toBe(winner);
        if (!winner) continue;
        found += 1;
        expect(winner.field).toBe(ceremony);
        expect(isWorking(winner, year)).toBe(true);
        expect(fameIn(winner, year)).toBeGreaterThanOrEqual(ROSTER_AWARD_FLOOR);
      }
    }
    expect(found).toBeGreaterThan(100);
  });

  it('gives sports to athletes and racing to drivers, and never the other way about', () => {
    let drivers = 0;
    let others = 0;
    for (let year = 1990; year < 2200; year += 1) {
      const athlete = rosterWinner(SEED, year, 'sports');
      if (athlete) {
        others += 1;
        expect(athlete.field).toBe('athletics');
        expect(sportOfFigure(SEED, athlete)).not.toBe('racing');
        expect(fameIn(athlete, year)).toBeGreaterThanOrEqual(ROSTER_AWARD_FLOOR);
      }
      const driver = rosterWinner(SEED, year, 'sports', true);
      if (driver) {
        drivers += 1;
        expect(driver.field).toBe('athletics');
        expect(sportOfFigure(SEED, driver)).toBe('racing');
        expect(isWorking(driver, year)).toBe(true);
      }
    }
    expect(others).toBeGreaterThan(100);
    expect(drivers).toBeGreaterThan(5);
    expect(drivers).toBeLessThan(others);
  });

  it('has no model winner, because the roster has no models', () => {
    for (let year = 2000; year < 2060; year += 1)
      expect(rosterWinner(SEED, year, 'modeling')).toBeUndefined();
  });

  it('has nobody to give it to in a year with no working driver of fame', () => {
    const year = yearWhere((y) => rosterWinner(SEED, y, 'sports', true) === undefined, 1990, 2400);
    expect(rosterWinner(SEED, year, 'sports', true)).toBeUndefined();
    const none = yearWhere((y) => championOf(SEED, y, 'wrestling') === undefined, 1990, 2400);
    expect(championOf(SEED, none, 'wrestling')).toBeUndefined();
  });

  it('favours the famous: winners are more famous than the field they were picked from', () => {
    let winnerFame = 0;
    let fieldFame = 0;
    let n = 0;
    for (let year = 2000; year < 2200; year += 1) {
      const winner = rosterWinner(SEED, year, 'acting');
      if (!winner) continue;
      const pool = notablesIn(SEED, year).filter(
        (figure) =>
          figure.field === 'acting' &&
          isWorking(figure, year) &&
          fameIn(figure, year) >= ROSTER_AWARD_FLOOR,
      );
      winnerFame += fameIn(winner, year);
      fieldFame += pool.reduce((sum, figure) => sum + fameIn(figure, year), 0) / pool.length;
      n += 1;
    }
    expect(n).toBeGreaterThan(100);
    expect(winnerFame / n).toBeGreaterThan(fieldFame / n + 3);
  });

  it('is a different winner in different years and in different worlds', () => {
    const names = new Set<string>();
    for (let year = 2000; year < 2060; year += 1) {
      const winner = rosterWinner(SEED, year, 'music');
      if (winner) names.add(winner.id);
    }
    expect(names.size).toBeGreaterThan(10);
    const other = new Set<string>();
    for (let year = 2000; year < 2060; year += 1) {
      const winner = rosterWinner('another-world', year, 'music');
      if (winner) other.add(winner.id);
    }
    expect([...other].filter((id) => names.has(id))).not.toEqual([...other]);
  });

  it('has a champion for every sport, the same each year, who plays it, unless the player won', () => {
    let found = 0;
    for (let year = 1990; year < 2200; year += 1) {
      const champion = championOf(SEED, year, 'basketball');
      expect(championOf(SEED, year, 'basketball')).toBe(champion);
      if (champion) {
        found += 1;
        expect(sportOfFigure(SEED, champion)).toBe('basketball');
        expect(isWorking(champion, year)).toBe(true);
      }
      expect(championOf(SEED, year, 'basketball', true)).toBeUndefined();
    }
    expect(found).toBeGreaterThan(50);
    let racing = 0;
    for (let year = 1990; year < 2200; year += 1) {
      const champion = championOf(SEED, year, 'racing');
      if (champion) {
        racing += 1;
        expect(sportOfFigure(SEED, champion)).toBe('racing');
      }
    }
    expect(racing).toBeGreaterThan(3);
    expect(racing).toBeLessThan(found);
  });
});

/* -------------------------------------------------------------------------- */
/* Charts                                                                      */
/* -------------------------------------------------------------------------- */

describe('a chart', () => {
  const YEAR = 2045;

  it('is named for its field, and for the league in a sport', () => {
    expect(chartName('acting')).toBe('the Marquee List');
    expect(chartName('music')).toBe('the Silverline Chart');
    expect(chartName('sports', 'racing')).toBe('the ARS rankings');
    expect(chartName('sports', 'basketball')).toBe(
      `the ${findSport('basketball')!.leagueShort} rankings`,
    );
    expect(chartName('sports')).toBe('the sports rankings');
    expect(chartName('sports', 'nonsense' as never)).toBe('the sports rankings');
    expect(CHART_NAMES.acting).toBe('the Marquee List');
  });

  it('is the most famous people in the field, best first, ranked from one, at most twenty-five', () => {
    for (const field of ['acting', 'music', 'sports'] as const) {
      const rows = chartOf(SEED, YEAR, field, 0);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(CHART_SIZE);
      rows.forEach((row, index) => {
        expect(row.rank).toBe(index + 1);
        expect(row.player).toBe(false);
        expect(row.fame).toBeGreaterThanOrEqual(NOTABLE_FAME);
        if (index > 0) expect(row.fame).toBeLessThanOrEqual(rows[index - 1]!.fame);
      });
      expect(chartOf(SEED, YEAR, field, 0)).toEqual(rows);
    }
    expect(CHART_TOP).toBe(10);
    expect(CHART_SIZE).toBe(25);
  });

  it('is filled by the roster’s own people, by name and id', () => {
    const rows = chartOf(SEED, YEAR, 'acting', 0);
    const actors = notablesIn(SEED, YEAR).filter((figure) => figure.field === 'acting');
    for (const row of rows) {
      const figure = actors.find((candidate) => candidate.id === row.id)!;
      expect(figure).toBeDefined();
      expect(row.name).toBe(displayFigure(figure));
      expect(row.fame).toBe(fameIn(figure, YEAR));
    }
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it('puts the player on it, among them, once they are famous enough, and ranks them by fame', () => {
    const base = chartOf(SEED, YEAR, 'music', 0);
    const middle = base[Math.floor(base.length / 2)]!.fame;
    const rows = chartOf(SEED, YEAR, 'music', middle + 1);
    const you = rows.find((row) => row.player)!;
    expect(you.name).toBe('You');
    expect(you.id).toBeUndefined();
    expect(you.fame).toBe(middle + 1);
    expect(rows.indexOf(you)).toBeLessThan(base.length / 2 + 1);
    expect(rows.filter((row) => row.player)).toHaveLength(1);
    expect(playerRank(SEED, YEAR, 'music', middle + 1)).toBe(you.rank);
    // A fame above everybody on the chart is the top of it.
    expect(chartOf(SEED, YEAR, 'music', 101)[0]!.player).toBe(true);
    expect(playerRank(SEED, YEAR, 'music', 101)).toBe(1);
  });

  it('puts the player behind a roster name of the same fame', () => {
    const top = chartOf(SEED, YEAR, 'acting', 0)[0]!;
    const rows = chartOf(SEED, YEAR, 'acting', top.fame);
    const you = rows.find((row) => row.player)!;
    expect(rows.indexOf(you)).toBeGreaterThan(0);
    expect(rows[0]!.player).toBe(false);
    expect(rows[you.rank - 2]!.fame).toBeGreaterThanOrEqual(you.fame);
  });

  it('adds the player to the roster rows and takes none of them away', () => {
    let seen = 0;
    for (let year = 2040; year < 2060 && seen < 6; year += 1) {
      const base = chartOf(SEED, year, 'sports', 0, 'wrestling');
      if (base.length === 0 || base.length >= CHART_SIZE) continue;
      for (const fame of [NOTABLE_FAME, 50, 101]) {
        const rows = chartOf(SEED, year, 'sports', fame, 'wrestling');
        expect(rows).toHaveLength(base.length + 1);
        expect(rows.filter((row) => !row.player).map((row) => row.id)).toEqual(
          base.map((row) => row.id),
        );
      }
      seen += 1;
    }
    expect(seen).toBeGreaterThan(2);
  });

  it('puts the player behind every roster name of the same fame, whichever fame that is', () => {
    let ties = 0;
    for (const field of ['acting', 'music', 'sports'] as const) {
      for (const year of [YEAR, YEAR + 7, YEAR + 19]) {
        const base = chartOf(SEED, year, field, 0);
        for (const fame of new Set(base.map((row) => row.fame))) {
          if (fame < NOTABLE_FAME) continue;
          const rows = chartOf(SEED, year, field, fame);
          const you = rows.findIndex((row) => row.player);
          if (you === -1) continue;
          ties += 1;
          for (let index = 0; index < rows.length - 1; index += 1) {
            expect(rows[index]!.fame, `${field} ${year} at ${fame}`).toBeGreaterThanOrEqual(
              rows[index + 1]!.fame,
            );
          }
          rows.forEach((row, index) => {
            if (row.fame === fame && !row.player) expect(index).toBeLessThan(you);
          });
          // Roster names of the same fame keep the order of their ids.
          const same = rows.filter((row) => row.fame === fame && !row.player).map((row) => row.id!);
          expect(same).toEqual([...same].sort((a, b) => a.localeCompare(b)));
        }
      }
    }
    expect(ties).toBeGreaterThan(20);
  });

  it('leaves the player off when they are not known, or not near the top twenty-five', () => {
    expect(chartOf(SEED, YEAR, 'acting', NOTABLE_FAME - 1).some((row) => row.player)).toBe(false);
    // A chart with room on it takes a player at exactly the fame that counts as known.
    const room = chartOf(SEED, YEAR, 'sports', 0, 'wrestling');
    expect(room.length).toBeLessThan(CHART_SIZE);
    expect(chartOf(SEED, YEAR, 'sports', NOTABLE_FAME, 'wrestling').some((row) => row.player)).toBe(
      true,
    );
    expect(
      chartOf(SEED, YEAR, 'sports', NOTABLE_FAME - 1, 'wrestling').some((row) => row.player),
    ).toBe(false);
    expect(chartOf(SEED, YEAR, 'acting', 0).some((row) => row.player)).toBe(false);
    expect(playerRank(SEED, YEAR, 'acting', 0)).toBeUndefined();
    const full = chartOf(SEED, YEAR, 'acting', 0);
    if (full.length === CHART_SIZE) {
      expect(
        playerRank(SEED, YEAR, 'acting', Math.max(NOTABLE_FAME, full.at(-1)!.fame - 1)),
      ).toBeUndefined();
    }
  });

  it('can be narrowed to one sport, and then only that sport’s athletes are on it', () => {
    let seen = 0;
    for (let year = 1995; year < 2100; year += 5) {
      const rows = chartOf(SEED, year, 'sports', 0, 'basketball');
      for (const row of rows) {
        seen += 1;
        const figure = notablesIn(SEED, year).find((candidate) => candidate.id === row.id)!;
        expect(sportOfFigure(SEED, figure)).toBe('basketball');
      }
    }
    expect(seen).toBeGreaterThan(20);
    const all = chartOf(SEED, 2045, 'sports', 0);
    const racing = chartOf(SEED, 2045, 'sports', 0, 'racing');
    expect(racing.length).toBeLessThan(all.length);
    // A sport filter is for sports only: acting ignores it.
    expect(chartOf(SEED, 2045, 'acting', 0, 'racing')).toEqual(chartOf(SEED, 2045, 'acting', 0));
  });
});

/* -------------------------------------------------------------------------- */
/* Counting wins                                                               */
/* -------------------------------------------------------------------------- */

describe('counting the awards at a ceremony', () => {
  it('counts the awards by their ceremony and year, from the labels', () => {
    const records = [
      ...wins(AWARD_CEREMONY, 2),
      ...wins(MUSIC_AWARD_CEREMONY, 1),
      record(`Athlete of the Year, ${LAUREL_CEREMONY}, 2031`),
    ];
    expect(winsAt(records, AWARD_CEREMONY)).toBe(2);
    expect(winsAt(records, MUSIC_AWARD_CEREMONY)).toBe(1);
    expect(winsAt(records, LAUREL_CEREMONY)).toBe(1);
    expect(winsAt(records, MODEL_AWARD_CEREMONY)).toBe(0);
    expect(winsAt([], AWARD_CEREMONY)).toBe(0);
  });

  it('ignores records that only mention a ceremony: a milestone, a championship, a label with no year', () => {
    const records = [
      record(`Three-time winner at ${AWARD_CEREMONY}`),
      record(`Best Actor, ${AWARD_CEREMONY}, 2030`, 'championship'),
      record(`Best Actor, ${AWARD_CEREMONY}`),
      record(`Best Actor, ${AWARD_CEREMONY}, 2030 extra`),
      record(`Won awards in two fields in 2033`),
    ];
    expect(winsAt(records, AWARD_CEREMONY)).toBe(0);
  });

  it('reads a ceremony name as a name, not a pattern', () => {
    expect(winsAt([record('Best, the (Odd) Awards, 2030')], 'the (Odd) Awards')).toBe(1);
    expect(winsAt([record('Best, the xOddx Awards, 2030')], 'the .Odd. Awards')).toBe(0);
    expect(winsAt([record('Best, the x Awards, 2030')], 'the . Awards')).toBe(0);
  });

  it('adds fame for the Laurels won, three each, to a cap', () => {
    expect(laurelFame(0)).toBe(0);
    expect(laurelFame(1)).toBe(LAUREL_FAME_EACH);
    expect(laurelFame(2)).toBe(2 * LAUREL_FAME_EACH);
    expect(laurelFame(100)).toBe(LAUREL_FAME_CAP);
    expect(laurelFame(LAUREL_FAME_CAP / LAUREL_FAME_EACH)).toBe(LAUREL_FAME_CAP);
    expect(laurelFame(LAUREL_FAME_CAP / LAUREL_FAME_EACH + 1)).toBe(LAUREL_FAME_CAP);
  });
});

/* -------------------------------------------------------------------------- */
/* The year                                                                    */
/* -------------------------------------------------------------------------- */

describe('a year with nothing to it', () => {
  it('says nothing, writes nothing, moves nothing', () => {
    expect(run({})).toEqual({ lines: [], records: [], mood: 0, fame: 0 });
  });

  it('is the same year however often it is played, and a different draw in another life or generation', () => {
    const input = {
      sports: {
        tier: 'superstar' as const,
        titled: true,
        fame: 70,
        sportId: 'basketball' as const,
      },
    };
    expect(run(input)).toEqual(run(input));
    expect(awardUnit('a', 0, 'laurel', 2040)).toBe(awardUnit('a', 0, 'laurel', 2040));
    expect(awardUnit('a', 0, 'laurel', 2040)).not.toBe(awardUnit('b', 0, 'laurel', 2040));
    expect(awardUnit('a', 0, 'laurel', 2040)).not.toBe(awardUnit('a', 1, 'laurel', 2040));
    expect(awardUnit('a', 0, 'laurel', 2040)).not.toBe(awardUnit('a', 0, 'laurel', 2041));
    expect(awardUnit('a', 0, 'laurel', 2040)).not.toBe(awardUnit('a', 0, 'nominee', 2040));
  });
});

describe('the Laurel Sports Awards', () => {
  const laurelYears = (tier: SportTier, titled: boolean, n = 600): number => {
    let count = 0;
    for (let year = 2000; year < 2000 + n; year += 1) {
      const out = run({ year, sports: { tier, titled, fame: 0, sportId: 'basketball' } });
      if (out.records.some((row) => row.label.includes(LAUREL_CEREMONY))) count += 1;
    }
    return count / n;
  };

  it('are never given below the starter rung, and at the tier’s rate above it, more often after a title', () => {
    expect(laurelYears('fringe', true)).toBe(0);
    expect(laurelYears('role', true)).toBe(0);
    for (const tier of ['starter', 'star', 'superstar'] as const) {
      const plain = laurelYears(tier, false);
      const titled = laurelYears(tier, true);
      expect(Math.abs(plain - LAUREL_CHANCE[tier]), tier).toBeLessThan(0.06);
      expect(Math.abs(titled - LAUREL_CHANCE[tier] * LAUREL_TITLE_MULTIPLE), tier).toBeLessThan(
        0.07,
      );
      expect(titled).toBeGreaterThan(plain);
    }
  });

  it('are never given to anybody without a pro career', () => {
    for (let year = 2000; year < 2200; year += 1) {
      const out = run({ year, sports: { titled: true, fame: 80 } });
      expect(out.records.some((row) => row.label.includes(LAUREL_CEREMONY))).toBe(false);
    }
  });

  it('name an athlete, with a line, a record and a lift in mood', () => {
    const year = yearWhere(
      (y) =>
        run({
          year: y,
          sports: { tier: 'superstar', titled: true, fame: 0, sportId: 'basketball' },
        }).records.length > 0,
    );
    const out = run({
      year,
      sports: { tier: 'superstar', titled: true, fame: 0, sportId: 'basketball' },
    });
    expect(out.records).toEqual([
      { category: 'award', label: `Athlete of the Year, the Laurel Sports Awards, ${year}` },
    ]);
    expect(out.lines).toEqual([
      { kind: 'milestone', text: 'Named Athlete of the Year at the Laurel Sports Awards.' },
    ]);
    expect(out.mood).toBe(LAUREL_MOOD);
  });

  it('name a driver Driver of the Year', () => {
    const year = yearWhere(
      (y) =>
        run({ year: y, sports: { tier: 'superstar', titled: true, fame: 0, sportId: 'racing' } })
          .records.length > 0,
    );
    const out = run({
      year,
      sports: { tier: 'superstar', titled: true, fame: 0, sportId: 'racing' },
    });
    expect(out.records).toEqual([
      { category: 'award', label: `Driver of the Year, the Laurel Sports Awards, ${year}` },
    ]);
    expect(out.lines).toEqual([
      { kind: 'milestone', text: 'Named Driver of the Year at the Laurel Sports Awards.' },
    ]);
  });

  it('draw from the life’s own hash: one life is named in a year another is not', () => {
    let differ = 0;
    for (let year = 2000; year < 2100; year += 1) {
      const a = run({ seed: 'life-a', year, sports: { tier: 'star', titled: false, fame: 0 } });
      const b = run({ seed: 'life-b', year, sports: { tier: 'star', titled: false, fame: 0 } });
      if (a.records.length !== b.records.length) differ += 1;
    }
    expect(differ).toBeGreaterThan(3);
    let gens = 0;
    for (let year = 2000; year < 2100; year += 1) {
      const a = run({ generation: 0, year, sports: { tier: 'star', titled: false, fame: 0 } });
      const b = run({ generation: 1, year, sports: { tier: 'star', titled: false, fame: 0 } });
      if (a.records.length !== b.records.length) gens += 1;
    }
    expect(gens).toBeGreaterThan(3);
  });

  it('add fame to a career that holds some, three for each, up to a cap, and none to one that holds none', () => {
    const sports = {
      tier: 'star' as const,
      titled: false,
      fame: 50,
      sportId: 'basketball' as const,
    };
    const laurel = (y: number): boolean =>
      run({ year: y, sports }).records.some((r) => r.label.includes(LAUREL_CEREMONY));
    const quiet = yearWhere((y) => !laurel(y));
    const base = run({
      sports,
      year: quiet,
    });
    expect(base.fame).toBe(50);
    const one = run({
      sports,
      records: wins(LAUREL_CEREMONY, 1),
      year: quiet,
    });
    expect(one.fame).toBe(50 + LAUREL_FAME_EACH);
    const many = run({
      sports,
      records: wins(LAUREL_CEREMONY, 9),
      year: quiet,
    });
    expect(many.fame).toBe(50 + LAUREL_FAME_CAP);
    const high = run({
      sports: { ...sports, fame: 98 },
      records: wins(LAUREL_CEREMONY, 9),
      year: quiet,
    });
    expect(high.fame).toBe(100);
    expect(run({ sports: { ...sports, fame: 0 }, records: wins(LAUREL_CEREMONY, 9) }).fame).toBe(0);
    // A career holding a fame of one is still a career with fame: the Laurels add to it.
    expect(
      run({ sports: { ...sports, fame: 1 }, records: wins(LAUREL_CEREMONY, 2), year: quiet }).fame,
    ).toBe(1 + 2 * LAUREL_FAME_EACH);
    // The year’s own award counts at once.
    const year = yearWhere(laurel);
    expect(run({ sports, year }).fame).toBe(50 + LAUREL_FAME_EACH);
    expect(run({ sports, year, records: wins(LAUREL_CEREMONY, 2) }).fame).toBe(
      50 + 3 * LAUREL_FAME_EACH,
    );
  });
});

describe('a year of awards in more than one field', () => {
  it('is nothing for one field and a sweep for two, three or four, with a lift and a record', () => {
    const one = run({ acting: { won: 1, fame: 0 } });
    expect(one.records).toEqual([]);
    expect(one.mood).toBe(0);
    const two = run({ acting: { won: 1, fame: 0 }, music: { won: 1, fame: 0 } });
    expect(two.records).toEqual([{ category: 'award', label: 'Won awards in two fields in 2040' }]);
    expect(two.lines).toEqual([{ kind: 'milestone', text: 'A year of awards in two fields.' }]);
    expect(two.mood).toBe(SWEEP_MOOD);
    const three = run({
      acting: { won: 1, fame: 0 },
      music: { won: 2, fame: 0 },
      modeling: { won: 1, fame: 0 },
    });
    expect(three.records.map((row) => row.label)).toEqual(['Won awards in three fields in 2040']);
    expect(three.lines.map((row) => row.text)).toEqual(['A year of awards in three fields.']);
  });

  it('counts a Laurel as a field, and four fields as four', () => {
    const sports = { tier: 'superstar' as const, titled: true, fame: 0 };
    const year = yearWhere((y) => run({ year: y, sports }).records.length > 0);
    const out = run({ year, sports, acting: { won: 1, fame: 0 } });
    expect(out.records.map((row) => row.label)).toEqual([
      `Athlete of the Year, the Laurel Sports Awards, ${year}`,
      `Won awards in two fields in ${year}`,
    ]);
    expect(out.mood).toBe(LAUREL_MOOD + SWEEP_MOOD);
    const four = run({
      year,
      sports,
      acting: { won: 1, fame: 0 },
      music: { won: 1, fame: 0 },
      modeling: { won: 1, fame: 0 },
    });
    expect(four.records.map((row) => row.label)).toContain(`Won awards in four fields in ${year}`);
  });

  it('counts a field by the awards it gave, not by how many of them', () => {
    const out = run({ acting: { won: 3, fame: 0 } });
    expect(out.records.some((row) => /fields/.test(row.label))).toBe(false);
    const twice = run({ acting: { won: 3, fame: 0 }, music: { won: 0, fame: 0 } });
    expect(twice.records.some((row) => /fields/.test(row.label))).toBe(false);
  });
});

describe('the third win at one ceremony', () => {
  it('is remembered when it comes, and not before or after', () => {
    const third = (
      previous: number,
      won: number,
      ceremony = AWARD_CEREMONY,
      field: 'acting' | 'music' | 'modeling' = 'acting',
    ) =>
      run({ [field]: { won, fame: 0 }, records: wins(ceremony, previous) }).records.map(
        (row) => row.label,
      );
    const label = `Three-time winner at ${AWARD_CEREMONY}`;
    expect(third(0, 1)).toEqual([]);
    expect(third(1, 1)).toEqual([]);
    expect(third(2, 1)).toEqual([label]);
    expect(third(3, 1)).toEqual([]);
    expect(third(7, 1)).toEqual([]);
    expect(third(1, 2)).toEqual([label]);
    expect(third(0, 3)).toEqual([label]);
    expect(third(0, 5)).toEqual([label]);
    expect(third(2, 0)).toEqual([]);
    expect(third(2, 1, MUSIC_AWARD_CEREMONY, 'music')).toEqual([
      `Three-time winner at ${MUSIC_AWARD_CEREMONY}`,
    ]);
    expect(third(2, 1, MODEL_AWARD_CEREMONY, 'modeling')).toEqual([
      `Three-time winner at ${MODEL_AWARD_CEREMONY}`,
    ]);
    // Another ceremony’s wins are not this one’s.
    expect(third(2, 1, MUSIC_AWARD_CEREMONY, 'acting')).toEqual([]);
  });

  it('says so in the feed, as a milestone', () => {
    const out = run({ acting: { won: 1, fame: 0 }, records: wins(AWARD_CEREMONY, 2) });
    expect(out.lines).toEqual([
      { kind: 'milestone', text: `Three-time winner at ${AWARD_CEREMONY}.` },
    ]);
  });

  it('counts the Laurels as sports’ wins', () => {
    const sports = { tier: 'superstar' as const, titled: true, fame: 0 };
    const year = yearWhere((y) => run({ year: y, sports }).records.length > 0);
    const out = run({ year, sports, records: wins(LAUREL_CEREMONY, 2) });
    expect(out.records.map((row) => row.label)).toEqual([
      `Athlete of the Year, the Laurel Sports Awards, ${year}`,
      `Three-time winner at ${LAUREL_CEREMONY}`,
    ]);
    const fourth = run({ year, sports, records: wins(LAUREL_CEREMONY, 3) });
    expect(fourth.records).toHaveLength(1);
    // One Laurel is one win: a second one is not the third.
    const second = run({ year, sports, records: wins(LAUREL_CEREMONY, 1) });
    expect(second.records.map((row) => row.label)).toEqual([
      `Athlete of the Year, the Laurel Sports Awards, ${year}`,
    ]);
  });

  it('is not counted again by its own record', () => {
    const records = [...wins(AWARD_CEREMONY, 3), record(`Three-time winner at ${AWARD_CEREMONY}`)];
    expect(winsAt(records, AWARD_CEREMONY)).toBe(3);
    expect(run({ acting: { won: 1, fame: 0 }, records }).records).toEqual([]);
  });
});

describe('the charts, for the player', () => {
  const YEAR = 2045;
  const top = chartOf(SEED, YEAR, 'acting', 0)[0]!.fame;

  it('record the first time in the top ten, and the first time at the top, once each', () => {
    const entered = `Entered the top 10 of ${chartName('acting')}`;
    const first = `Reached No. 1 on ${chartName('acting')}`;
    const ten = run({ year: YEAR, acting: { won: 0, fame: top - 1 } });
    const rank = playerRank(SEED, YEAR, 'acting', top - 1)!;
    expect(rank).toBeLessThanOrEqual(CHART_TOP);
    expect(ten.records.map((row) => row.label)).toContain(entered);
    expect(ten.lines.map((row) => row.text)).toContain(`${entered}.`);
    expect(ten.records.find((row) => row.label === entered)).toEqual({
      category: 'career',
      label: entered,
    });
    if (rank > 1) expect(ten.records.map((row) => row.label)).not.toContain(first);

    const best = run({ year: YEAR, acting: { won: 0, fame: 101 } });
    expect(best.records.map((row) => row.label)).toEqual([entered, first]);
    expect(best.lines.filter((row) => row.kind === 'milestone').map((row) => row.text)).toEqual([
      `${entered}.`,
      `${first}.`,
    ]);

    const again = run({
      year: YEAR,
      acting: { won: 0, fame: 101 },
      records: [record(entered, 'career'), record(first, 'career')],
    });
    expect(again.records).toEqual([]);
    const half = run({
      year: YEAR,
      acting: { won: 0, fame: 101 },
      records: [record(entered, 'career')],
    });
    expect(half.records.map((row) => row.label)).toEqual([first]);
  });

  it('count the tenth place as the top ten and the eleventh as outside it', () => {
    let tenths = 0;
    let elevenths = 0;
    for (const field of ['acting', 'music'] as const) {
      for (let year = 2040; year < 2075; year += 1) {
        const entered = `Entered the top 10 of ${chartName(field)}`;
        const at = (fame: number) =>
          run({ year, [field]: { won: 0, fame } }).records.map((row) => row.label);
        for (let fame = 0; fame <= 100; fame += 1) {
          const rank = playerRank(SEED, year, field, fame);
          if (rank === CHART_TOP) {
            expect(at(fame), `${field} ${year} ${fame}`).toContain(entered);
            tenths += 1;
          }
          if (rank === CHART_TOP + 1) {
            expect(at(fame), `${field} ${year} ${fame}`).not.toContain(entered);
            elevenths += 1;
          }
        }
      }
    }
    expect(tenths).toBeGreaterThan(5);
    expect(elevenths).toBeGreaterThan(5);
  });

  it('count a player at exactly the fame that makes a name known', () => {
    // A small chart, so that the first place on it is within the ten.
    let checked = 0;
    for (const sport of SPORTS) {
      for (let year = 2040; year < 2060 && checked < 3; year += 1) {
        if (playerRank(SEED, year, 'sports', NOTABLE_FAME, sport.id) === undefined) continue;
        if (playerRank(SEED, year, 'sports', NOTABLE_FAME, sport.id)! > CHART_TOP) continue;
        const label = `Entered the top 10 of ${chartName('sports', sport.id)}`;
        const labels = (fame: number) =>
          run({ year, sports: { sportId: sport.id, titled: false, fame } }).records.map(
            (row) => row.label,
          );
        expect(labels(NOTABLE_FAME)).toContain(label);
        expect(labels(NOTABLE_FAME - 1)).not.toContain(label);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('wait for a fame worth a place on it', () => {
    const out = run({ year: YEAR, acting: { won: 0, fame: NOTABLE_FAME - 1 } });
    expect(out.records).toEqual([]);
  });

  it('rank a music career on the Silverline Chart and a sports career in its own league', () => {
    const music = run({ year: YEAR, music: { won: 0, fame: 101 } });
    expect(music.records.map((row) => row.label)).toEqual([
      `Entered the top 10 of ${chartName('music')}`,
      `Reached No. 1 on ${chartName('music')}`,
    ]);
    const sports = run({ year: YEAR, sports: { sportId: 'racing', titled: false, fame: 101 } });
    expect(sports.records.map((row) => row.label)).toEqual([
      `Entered the top 10 of the ARS rankings`,
      `Reached No. 1 on the ARS rankings`,
    ]);
    const otherLeague = run({
      year: YEAR,
      sports: { sportId: 'basketball', titled: false, fame: 101 },
    });
    expect(otherLeague.records.map((row) => row.label)).toEqual([
      `Entered the top 10 of ${chartName('sports', 'basketball')}`,
      `Reached No. 1 on ${chartName('sports', 'basketball')}`,
    ]);
  });

  it('are ranked on the fame the field’s own year holds, so a model has none', () => {
    const out = run({ year: YEAR, modeling: { won: 0, fame: 101 } });
    expect(out.records).toEqual([]);
  });
});

describe('being up for it and losing', () => {
  const nominated = (over: Partial<AwardsYearInput>, from = 2000) =>
    yearWhere((y) => {
      const out = run({ year: y, ...over });
      return out.lines.some((line) => /You were up for/.test(line.text));
    }, from);

  it('is a quiet line with the roster’s winner named, and a small sting', () => {
    const over = { acting: { won: 0, fame: NOMINEE_FAME } };
    const year = nominated(over);
    const winner = rosterWinner(SEED, year, 'acting')!;
    const out = run({ year, ...over });
    expect(out.lines).toEqual([
      {
        kind: 'passive',
        text: `You were up for an award at the Marquee Awards. ${displayFigure(winner)} took it.`,
      },
    ]);
    expect(out.mood).toBe(NOMINEE_MOOD);
    expect(out.records).toEqual([]);
  });

  it('needs enough fame, and a year in which the player did not win', () => {
    const over = { acting: { won: 0, fame: NOMINEE_FAME } };
    const year = nominated(over);
    expect(
      run({ year, acting: { won: 0, fame: NOMINEE_FAME - 1 } }).lines.some((l) =>
        /up for/.test(l.text),
      ),
    ).toBe(false);
    expect(
      run({ year, acting: { won: 1, fame: NOMINEE_FAME } }).lines.some((l) =>
        /up for/.test(l.text),
      ),
    ).toBe(false);
    expect(run({ year, acting: { won: 0, fame: 0 } }).lines).toEqual([]);
  });

  it('happens about as often as its chance, among the years that could', () => {
    let up = 0;
    let n = 0;
    for (let year = 2000; year < 2400; year += 1) {
      if (!rosterWinner(SEED, year, 'acting')) continue;
      n += 1;
      if (run({ year, acting: { won: 0, fame: 60 } }).lines.some((l) => /up for/.test(l.text)))
        up += 1;
    }
    expect(n).toBeGreaterThan(200);
    expect(Math.abs(up / n - NOMINEE_CHANCE)).toBeLessThan(0.09);
  });

  it('needs somebody to have won it: a year with no working driver of fame has no loser to name', () => {
    const over = {
      sports: { tier: 'star' as const, titled: false, fame: 60, sportId: 'racing' as const },
    };
    let checked = 0;
    for (let year = 1990; year < 2400; year += 1) {
      if (rosterWinner(SEED, year, 'sports', true) !== undefined) continue;
      const out = run({ year, ...over });
      checked += 1;
      expect(out.lines.some((l) => /up for/.test(l.text))).toBe(false);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('is told once a year, at the first ceremony it happened at', () => {
    for (let year = 2000; year < 2300; year += 1) {
      const out = run({
        year,
        acting: { won: 0, fame: 70 },
        music: { won: 0, fame: 70 },
        sports: { tier: 'star', titled: false, fame: 70, sportId: 'racing' },
      });
      const lost = out.lines.filter((l) => /up for/.test(l.text));
      expect(lost.length).toBeLessThanOrEqual(1);
      if (lost.length === 1)
        expect(out.mood).toBe(
          NOMINEE_MOOD + (out.records.some((r) => /Laurel/.test(r.label)) ? LAUREL_MOOD : 0),
        );
    }
  });

  it('is told for music as for acting, and not in a year a music award was won', () => {
    const up = (won: number, year: number) =>
      run({ year, music: { won, fame: NOMINEE_FAME } }).lines.some((line) =>
        /^You were up for an award at the Silverline Music Awards\./.test(line.text),
      );
    let told = 0;
    for (let year = 2000; year < 2300; year += 1) {
      if (up(0, year)) told += 1;
      for (const won of [1, 2]) expect(up(won, year), `${won} in ${year}`).toBe(false);
    }
    expect(told).toBeGreaterThan(30);
  });

  it('names the same roster winner for an acting prize whether or not the player is a driver', () => {
    const over = {
      acting: { won: 0, fame: NOMINEE_FAME },
      sports: { tier: 'star' as const, titled: false, fame: 0, sportId: 'racing' as const },
    };
    let checked = 0;
    for (let year = 2000; year < 2400 && checked < 5; year += 1) {
      const line = run({ year, ...over }).lines.find((l) => /up for an award/.test(l.text));
      if (!line) continue;
      expect(line.text).toBe(
        `You were up for an award at the Marquee Awards. ${displayFigure(rosterWinner(SEED, year, 'acting')!)} took it.`,
      );
      checked += 1;
    }
    expect(checked).toBe(5);
  });

  it('names the sports prize, and Driver of the Year for a driver, and only for a pro', () => {
    const over = {
      sports: { tier: 'star' as const, titled: false, fame: 60, sportId: 'racing' as const },
    };
    let said = '';
    for (let year = 2000; year < 2600 && !said; year += 1) {
      const line = run({ year, ...over }).lines.find((l) => /up for/.test(l.text));
      if (line) said = line.text;
    }
    expect(said).toMatch(
      /^You were up for Driver of the Year at the Laurel Sports Awards\. .* took it\.$/,
    );
    let amateur = false;
    for (let year = 2000; year < 2600; year += 1) {
      if (
        run({ year, sports: { titled: false, fame: 60, sportId: 'racing' } }).lines.some((l) =>
          /up for/.test(l.text),
        )
      )
        amateur = true;
    }
    expect(amateur).toBe(false);
    let athlete = '';
    for (let year = 2000; year < 2600 && !athlete; year += 1) {
      const line = run({
        year,
        sports: { tier: 'star', titled: false, fame: 60, sportId: 'basketball' },
      }).lines.find((l) => /up for/.test(l.text));
      if (line) athlete = line.text;
    }
    expect(athlete).toMatch(/^You were up for Athlete of the Year at the Laurel Sports Awards\./);
  });

  it('never names a model’s loss: models have no roster to lose to', () => {
    for (let year = 2000; year < 2100; year += 1) {
      expect(run({ year, modeling: { won: 0, fame: 90 } }).lines).toEqual([]);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Through the year                                                            */
/* -------------------------------------------------------------------------- */

function answerOthers(state: GameState): GameState {
  let current = state;
  for (let guard = 0; guard < 12; guard += 1) {
    const open = current.pending[0];
    const choice =
      open?.eventId === 'activity.offer'
        ? open.choices.find((row) => row.id === 'skip')
        : open?.choices[0];
    if (!open || !choice) break;
    const result = decide(current, open.eventId, choice.id);
    if (!result.ok) break;
    current = result.value.state;
  }
  return current;
}

describe('what the year hands the awards layer', () => {
  const base = createNewGame({ seed: 'awards-input' });
  const before: GameState = {
    ...base,
    acting: { ...base.acting, awards: 3 },
    music: { ...base.music, awards: 5 },
    modeling: { ...base.modeling, awards: 7 },
    player: { ...base.player, records: [record('A thing, 2020', 'career')] },
  };
  const proCareer = (over: Record<string, unknown> = {}) =>
    ({
      sportId: 'racing',
      stage: 'pro',
      startedAge: 9,
      seasons: 4,
      hardSeasons: 4,
      form: 60,
      trainedAtAge: -1,
      trainedCount: 0,
      reputation: 10,
      titles: 2,
      tier: 'star',
      ...over,
    }) as never;
  const pieces = (over: Record<string, unknown> = {}) =>
    ({
      acting: { acting: { awards: 4 }, fame: 21 },
      music: { music: { awards: 5 }, fame: 22 },
      modeling: { modeling: { awards: 9 }, fame: 23 },
      sports: { sports: { career: proCareer() }, fame: 24 },
      ...over,
    }) as never;
  const withCareer = (career: Record<string, unknown> | undefined): GameState => ({
    ...before,
    sports: { ...before.sports, career: career === undefined ? undefined : proCareer(career) },
  });

  it('is the seed, the generation, the year that came in and the records before it', () => {
    const out = awardsInputOf(before, 2041, pieces());
    expect(out.seed).toBe(before.rng.getSeed());
    expect(out.generation).toBe(before.world.generation);
    expect(out.year).toBe(2041);
    expect(out.records).toBe(before.player.records);
    const later = awardsInputOf(
      { ...before, world: { ...before.world, generation: before.world.generation + 2 } },
      2041,
      pieces(),
    );
    expect(later.generation).toBe(before.world.generation + 2);
  });

  it('reads each field’s awards as the change in its count, and its fame as it stands', () => {
    const out = awardsInputOf(before, 2041, pieces());
    expect(out.acting).toEqual({ won: 1, fame: 21 });
    expect(out.music).toEqual({ won: 0, fame: 22 });
    expect(out.modeling).toEqual({ won: 2, fame: 23 });
    expect(out.sports.fame).toBe(24);
  });

  it('gives sports only a pro career, with its sport and the tier the year ended in', () => {
    expect(awardsInputOf(before, 2041, pieces()).sports).toMatchObject({
      sportId: 'racing',
      tier: 'star',
    });
    const school = awardsInputOf(
      before,
      2041,
      pieces({ sports: { sports: { career: proCareer({ stage: 'school' }) }, fame: 0 } }),
    );
    expect(school.sports.sportId).toBeUndefined();
    expect(school.sports.tier).toBeUndefined();
    const none = awardsInputOf(before, 2041, pieces({ sports: { sports: {}, fame: 0 } }));
    expect(none.sports).toEqual({ titled: false, fame: 0 });
  });

  it('calls a season titled only when the same career has more titles than it did', () => {
    const titled = (
      now: Record<string, unknown> | undefined,
      was: Record<string, unknown> | undefined,
    ) =>
      awardsInputOf(
        withCareer(was),
        2041,
        pieces({
          sports: { sports: { career: now === undefined ? undefined : proCareer(now) }, fame: 5 },
        }),
      ).sports.titled;
    expect(titled({ titles: 3 }, { titles: 2 })).toBe(true);
    expect(titled({ titles: 2 }, { titles: 2 })).toBe(false);
    expect(titled({ titles: 1 }, { titles: 2 })).toBe(false);
    // Another sport’s titles are not this one’s, and a career with nothing before it has no season to compare.
    expect(titled({ titles: 5, sportId: 'golf' }, { titles: 1, sportId: 'racing' })).toBe(false);
    expect(titled({ titles: 1 }, undefined)).toBe(false);
    expect(titled({ titles: 0 }, undefined)).toBe(false);
    expect(titled(undefined, { titles: 2 })).toBe(false);
  });
});

describe('through advanceYear', () => {
  it('names a superstar driver Driver of the Year, in the feed and the records, with the mood and fame it earns', () => {
    const base = createNewGame({ seed: 'awards-drive' });
    let state: GameState = {
      ...base,
      player: { ...base.player, age: 24, talents: { ...base.player.talents, athletics: true } },
      sports: {
        ...base.sports,
        career: {
          sportId: 'racing',
          stage: 'pro',
          startedAge: 9,
          seasons: 12,
          hardSeasons: 10,
          form: 98,
          trainedAtAge: -1,
          trainedCount: 0,
          reputation: 60,
          titles: 3,
          tier: 'superstar',
          best: 'superstar',
          peak: 'superstar',
          breakout: 1,
          proSeasons: 6,
          endAge: 60,
          team: 'Redline Motorsport',
        },
      },
    };
    let named: GameState | undefined;
    for (let index = 0; index < 20 && state.player.alive && !named; index += 1) {
      state = answerOthers(advanceYear(answerOthers(state)).state);
      if (state.player.records.some((row) => row.label.includes(LAUREL_CEREMONY))) named = state;
    }
    expect(named).toBeDefined();
    const row = named!.player.records.find((r) => r.label.includes(LAUREL_CEREMONY))!;
    expect(row.category).toBe('award');
    expect(row.label).toBe(`Driver of the Year, ${LAUREL_CEREMONY}, ${row.year}`);
    const entry = named!.player.timeline.find(
      (e) => e.text === 'Named Driver of the Year at the Laurel Sports Awards.',
    );
    expect(entry).toBeDefined();
    expect(entry!.id).toMatch(/^t:\d{4}:awards:\d+$/);
    expect(entry!.kind).toBe('milestone');
    expect(named!.fame).toBeGreaterThanOrEqual(LAUREL_FAME_EACH);
  });

  it('puts the records last in the year, so no earlier record’s id moves', () => {
    const base = createNewGame({ seed: 'awards-order' });
    const before = JSON.stringify(base.player.records);
    const after = advanceYear(base).state;
    expect(JSON.stringify(after.player.records.slice(0, base.player.records.length))).toBe(before);
  });

  it('leaves a life that is near none of it exactly as it was', () => {
    const play = (): GameState => {
      let state = createNewGame({ seed: 'awards-passive' });
      for (let index = 0; index < 20; index += 1)
        state = answerOthers(advanceYear(answerOthers(state)).state);
      return state;
    };
    const a = play();
    const b = play();
    expect(JSON.stringify(a.player.records)).toBe(JSON.stringify(b.player.records));
    expect(
      a.player.records.some((r) => /Laurel|Three-time|fields in|top 10|No\. 1/.test(r.label)),
    ).toBe(false);
    expect(a.player.timeline.some((e) => /^t:\d{4}:awards:/.test(e.id))).toBe(false);
  });
});
