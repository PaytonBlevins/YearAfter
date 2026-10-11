/**
 * Ticket 0808 acceptance tests — a racing team's season (finance side).
 *
 * A season is a pace against a field, a finishing place, and what the place is worth: a share of a prize fund and
 * sponsors who pay by the result. Each pin that is a real figure says so; the rest is game judgement and the ticket
 * document says that too. The tests re-derive a season's money from the constants rather than pinning a number
 * that a retune would move, so they hold the intent (who pays what, in what order) and not the dial.
 */

import { describe, expect, it } from 'vitest';
import { mixedUnit } from '@yearafter/core';
import {
  CAR_DRIFT,
  CREW_SKILL,
  DRIVER_FIRST_NAMES,
  DRIVER_LAST_NAMES,
  DEVELOPMENTS,
  DEVELOPMENT_CAR,
  DEVELOPMENT_COST,
  DRIVER_CANDIDATES,
  DRIVER_DECLINE,
  DRIVER_DECLINE_FROM,
  DRIVER_HOLD,
  DRIVER_PAY_EXPONENT,
  DRIVER_RETIRE_AGE,
  DRIVER_RISE,
  DRIVER_RISE_UNTIL,
  FIELD_SPREAD,
  INCIDENT_CHANCE,
  INCIDENT_COST,
  MERCH_SHARE,
  NEW_RUNG_CAR_GAP,
  PURSE_CURVE,
  RACING_TEAM_TYPE_ID,
  SEASON_LUCK,
  SERIES,
  SERIES_RUNGS,
  SHOP_SHARE,
  SPONSOR_DEAL_SPREAD,
  SPONSOR_FLOOR,
  SPONSOR_NAME,
  SPONSOR_SLOPE,
  TEAM_REPUTATION_PULL,
  TEAM_WEIGHTS,
  TITLE_PURSE_BONUS,
  driverPayFor,
  findBusinessType,
  type SeriesRung,
} from '@yearafter/content';
import { NO_MODIFIERS } from './business-events';
import { PAYROLL_EFFECTS, REPLACEMENT_SHARE, newBusiness, type OwnedBusiness } from './businesses';
import {
  defaultTeam,
  driverAfter,
  driverCandidates,
  driverSkillOf,
  paceOf,
  placeOf,
  racingNormal,
  racingYear,
  standingOf,
  teamOf,
} from './racing';
import type { RacingTeam, TeamDriver } from './racing-state';

const TYPE = findBusinessType(RACING_TEAM_TYPE_ID)!;
const SEED = 'racing-test';

const business = (over: Partial<OwnedBusiness> = {}): OwnedBusiness => ({
  ...newBusiness(TYPE, 'biz:2030:racing:0', 'Redshift Racing', 2030, 1),
  reputation: 50,
  ...over,
});

const hired = (skill: number, age = 28): TeamDriver => ({
  kind: 'hired',
  id: 'drv:test',
  name: 'Test Driver',
  skill,
  age,
});

const teamAt = (rung: SeriesRung, over: Partial<RacingTeam> = {}): RacingTeam => ({
  rung,
  car: SERIES[rung].strength,
  driver: hired(SERIES[rung].strength),
  development: 'steady',
  titles: 0,
  best: rung,
  seasons: 0,
  ...over,
});

const season = (
  team: RacingTeam,
  over: Partial<Parameters<typeof racingYear>[0]> = {},
  biz: OwnedBusiness = business(),
) =>
  racingYear({
    business: biz,
    type: TYPE,
    team,
    year: 2031,
    seed: SEED,
    market: 'normal',
    ...over,
  });

/* -------------------------------------------------------------------------- */
/* The ladder                                                                  */
/* -------------------------------------------------------------------------- */

describe('the ladder of series', () => {
  it('has five rungs, each a bigger world than the last', () => {
    expect(SERIES_RUNGS).toEqual([1, 2, 3, 4, 5]);
    for (const rung of SERIES_RUNGS) expect(SERIES[rung].rung).toBe(rung);
    for (const key of [
      'strength',
      'budget',
      'crew',
      'purse',
      'sponsor',
      'driverPay',
      'upgrade',
    ] as const) {
      for (const rung of [2, 3, 4, 5] as const) {
        expect(SERIES[rung][key], `${key} ${rung}`).toBeGreaterThan(
          SERIES[(rung - 1) as SeriesRung][key],
        );
      }
    }
    expect(SERIES[1].upgrade).toBe(0);
    expect(new Set(SERIES_RUNGS.map((rung) => SERIES[rung].series)).size).toBe(5);
  });

  it('prices each rung at the real figure it is anchored to', () => {
    // An entry-level open-wheel season costs about $200,000 (a 2013 industry report).
    expect(SERIES[2].budget).toBeGreaterThanOrEqual(150_000);
    expect(SERIES[2].budget).toBeLessThanOrEqual(250_000);
    // A sports-car team runs about $1 million a season (2015).
    expect(SERIES[3].budget).toBeGreaterThanOrEqual(600_000);
    expect(SERIES[3].budget).toBeLessThanOrEqual(1_200_000);
    // An IndyCar costs $3 million to $8 million a car (2016).
    expect(SERIES[4].budget).toBeGreaterThanOrEqual(3_000_000);
    expect(SERIES[4].budget).toBeLessThanOrEqual(8_000_000);
    // A NASCAR Cup car, about $20 million a season before the driver (2024).
    expect(SERIES[5].budget).toBeGreaterThanOrEqual(15_000_000);
    expect(SERIES[5].budget).toBeLessThanOrEqual(25_000_000);
  });

  it('pays sponsors more than the prize fund at every rung, and the fund less than the running cost', () => {
    for (const rung of SERIES_RUNGS) {
      expect(SERIES[rung].sponsor).toBeGreaterThan(SERIES[rung].purse * 2);
      expect(SERIES[rung].purse).toBeLessThan(SERIES[rung].budget);
    }
  });

  it('weighs the driver most, then the car, then the crew, and the weights are one', () => {
    expect(TEAM_WEIGHTS.driver + TEAM_WEIGHTS.car + TEAM_WEIGHTS.crew).toBeCloseTo(1, 10);
    expect(TEAM_WEIGHTS.driver).toBeGreaterThan(TEAM_WEIGHTS.car);
    expect(TEAM_WEIGHTS.car).toBeGreaterThan(TEAM_WEIGHTS.crew);
  });

  it('is the catalog row, a Motorsport business that starts small', () => {
    expect(TYPE.name).toBe('Racing Team');
    expect(TYPE.sector).toBe('Motorsport');
    expect(TYPE.startup).toBe(150_000);
  });
});

/* -------------------------------------------------------------------------- */
/* Drivers                                                                     */
/* -------------------------------------------------------------------------- */

describe('the driver market', () => {
  it('is the same handful however often it is asked, and a different one in another year', () => {
    const a = driverCandidates(SEED, 'b1', 2031, 2);
    expect(a).toHaveLength(DRIVER_CANDIDATES);
    expect(driverCandidates(SEED, 'b1', 2031, 2)).toEqual(a);
    expect(driverCandidates(SEED, 'b1', 2032, 2)).not.toEqual(a);
    expect(driverCandidates(SEED, 'b2', 2031, 2)).not.toEqual(a);
    expect(driverCandidates('other', 'b1', 2031, 2)).not.toEqual(a);
    expect(driverCandidates(SEED, 'b1', 2031, 3)).not.toEqual(a);
  });

  it('puts people of the series’ own standard in it, ages 19 to 37, with ids that carry year, rung and slot', () => {
    for (const rung of SERIES_RUNGS) {
      for (let year = 2030; year < 2060; year += 1) {
        driverCandidates(SEED, 'b1', year, rung).forEach((driver, slot) => {
          expect(driver.kind).toBe('hired');
          expect(driver.id).toBe(`drv:${year}:${rung}:${slot}`);
          expect(driver.name).toMatch(/^\S+ \S+$/);
          expect(driver.age).toBeGreaterThanOrEqual(19);
          expect(driver.age).toBeLessThanOrEqual(37);
          expect(driver.skill).toBeGreaterThanOrEqual(Math.max(10, SERIES[rung].strength - 14));
          expect(driver.skill).toBeLessThanOrEqual(Math.min(98, SERIES[rung].strength + 14));
        });
      }
    }
  });

  it('has the whole range in it: a bargain and a ringer turn up', () => {
    const skills: number[] = [];
    for (let year = 2030; year < 2130; year += 1) {
      for (const driver of driverCandidates(SEED, 'b1', year, 3)) skills.push(driver.skill);
    }
    expect(Math.min(...skills)).toBeLessThan(SERIES[3].strength - 8);
    expect(Math.max(...skills)).toBeGreaterThan(SERIES[3].strength + 8);
    const names = new Set<string>();
    for (let year = 2030; year < 2130; year += 1) {
      for (const driver of driverCandidates(SEED, 'b1', year, 3)) names.add(driver.name);
    }
    expect(names.size).toBeGreaterThan(40);
  });

  it('pays by skill: the series’ figure at fifty, more above and less below, rounded to the half-thousand', () => {
    for (const rung of SERIES_RUNGS) {
      expect(driverPayFor(rung, 50)).toBe(Math.round(SERIES[rung].driverPay / 500) * 500);
      expect(driverPayFor(rung, 80)).toBeGreaterThan(driverPayFor(rung, 50));
      expect(driverPayFor(rung, 20)).toBeLessThan(driverPayFor(rung, 50));
      expect(driverPayFor(rung, 63) % 500).toBe(0);
    }
    const exact = (SERIES[2].driverPay * Math.pow(80 / 50, DRIVER_PAY_EXPONENT)) / 500;
    expect(driverPayFor(2, 80)).toBe(Math.round(exact) * 500);
    // A driver with no skill still costs something: the floor is a skill of five.
    expect(driverPayFor(3, 0)).toBe(driverPayFor(3, 5));
    expect(driverPayFor(3, 5)).toBeGreaterThan(0);
  });

  it('pins the pay at the floor and at points where rounding down would show', () => {
    // Skill five is the floor and six is the first skill above it: the two are different prices from the third rung up.
    expect([driverPayFor(3, 5), driverPayFor(3, 6)]).toEqual([4_000, 5_500]);
    expect([driverPayFor(4, 5), driverPayFor(4, 6)]).toEqual([20_000, 27_000]);
    expect([driverPayFor(5, 5), driverPayFor(5, 6)]).toEqual([113_000, 151_500]);
    expect(driverPayFor(2, 0)).toBe(1_500);
    // The half-thousand is the nearest one, not the one below.
    expect(driverPayFor(3, 9)).toBe(Math.round((160_000 * Math.pow(9 / 50, 1.6)) / 500) * 500);
    expect(driverPayFor(3, 9)).toBeGreaterThan(
      Math.floor((160_000 * Math.pow(9 / 50, 1.6)) / 500) * 500,
    );
    expect(driverPayFor(4, 10)).toBe(61_000);
    expect(driverPayFor(5, 30)).toBe(1_987_500);
  });
});

describe('a new team', () => {
  it('starts in club racing with an ordinary car, a journeyman and a steady programme', () => {
    const team = defaultTeam(SEED, 'b1', 2030);
    expect(team.rung).toBe(1);
    expect(team.car).toBe(SERIES[1].strength);
    expect(team.development).toBe('steady');
    expect(team.titles).toBe(0);
    expect(team.best).toBe(1);
    expect(team.seasons).toBe(0);
    expect(team.last).toBeUndefined();
    expect(team.driver.kind).toBe('hired');
    if (team.driver.kind === 'hired') {
      const found = driverCandidates(SEED, 'b1', 2030, 1)[0]!;
      expect(team.driver.name).toBe(found.name);
      expect(team.driver.age).toBe(found.age);
      // A journeyman: close to the field, pulled most of the way in from wherever the market put them.
      const expected = Math.round(
        Math.max(
          10,
          Math.min(98, SERIES[1].strength - 2 + (found.skill - SERIES[1].strength) * 0.4),
        ),
      );
      expect(team.driver.skill).toBe(expected);
      expect(Math.abs(team.driver.skill - SERIES[1].strength)).toBeLessThanOrEqual(8);
    }
  });

  it('is built lazily and identically: a business with no team gets the default from when it opened', () => {
    const b = business();
    expect(teamOf(b, SEED)).toEqual(defaultTeam(SEED, b.id, 2030));
    const own = teamAt(3);
    expect(teamOf({ ...b, racing: own }, SEED)).toBe(own);
  });
});

/* -------------------------------------------------------------------------- */
/* Pace and place                                                              */
/* -------------------------------------------------------------------------- */

describe('pace', () => {
  it('is zero for a team exactly as fast as the series, and is the weighted sum of what is above it', () => {
    for (const rung of SERIES_RUNGS) {
      const s = SERIES[rung].strength;
      expect(paceOf(teamAt(rung), s, 50)).toBeCloseTo(0, 10);
      expect(paceOf(teamAt(rung, { car: s + 10 }), s, 50)).toBeCloseTo(TEAM_WEIGHTS.car * 10, 10);
      expect(paceOf(teamAt(rung), s + 10, 50)).toBeCloseTo(TEAM_WEIGHTS.driver * 10, 10);
      expect(paceOf(teamAt(rung), s, 60)).toBeCloseTo(TEAM_WEIGHTS.crew * 10, 10);
      expect(paceOf(teamAt(rung), s - 20, 30)).toBeCloseTo(
        -20 * TEAM_WEIGHTS.driver - 20 * TEAM_WEIGHTS.crew,
        10,
      );
    }
  });

  it('judges the crew against an ordinary crew and the driver and car against the series', () => {
    // The same crew at a higher rung is not slower for it.
    expect(paceOf(teamAt(1), 40, 60)).toBeCloseTo(paceOf(teamAt(5), 82, 60), 10);
  });

  it('reads the driver: the hired one’s skill, or the owner’s form (nothing if they are not driving)', () => {
    expect(driverSkillOf(teamAt(2, { driver: hired(61) }), 90)).toBe(61);
    expect(driverSkillOf(teamAt(2, { driver: { kind: 'owner' } }), 72)).toBe(72);
    expect(driverSkillOf(teamAt(2, { driver: { kind: 'owner' } }), undefined)).toBe(0);
  });
});

describe('a finishing place', () => {
  it('stays on the grid and improves with pace', () => {
    for (const rung of SERIES_RUNGS) {
      const field = SERIES[rung].field;
      let last = field + 1;
      for (let pace = -40; pace <= 40; pace += 2) {
        const place = placeOf(rung, pace, 0);
        expect(place).toBeGreaterThanOrEqual(1);
        expect(place).toBeLessThanOrEqual(field);
        expect(place).toBeLessThanOrEqual(last);
        last = place;
      }
      expect(placeOf(rung, 60, 0)).toBe(1);
      expect(placeOf(rung, -60, 0)).toBe(field);
    }
  });

  it('puts an average team in the middle, and counts luck as pace', () => {
    for (const rung of SERIES_RUNGS) {
      const field = SERIES[rung].field;
      const middle = placeOf(rung, 0, 0);
      expect(middle).toBeGreaterThan(field * 0.35);
      expect(middle).toBeLessThan(field * 0.7);
      expect(placeOf(rung, 4, 3)).toBe(placeOf(rung, 7, 0));
      expect(placeOf(rung, -5, 5)).toBe(placeOf(rung, 0, 0));
    }
    // The curve follows the field spread: one spread ahead is a clear improvement.
    expect(placeOf(2, FIELD_SPREAD, 0)).toBeLessThan(placeOf(2, 0, 0) - 2);
  });

  it('reads a standing from a place: the title is one, last is one over the field', () => {
    for (const rung of SERIES_RUNGS) {
      expect(standingOf(rung, 1)).toBe(1);
      expect(standingOf(rung, SERIES[rung].field)).toBeCloseTo(1 / SERIES[rung].field, 10);
      expect(standingOf(rung, 4)).toBeCloseTo(1 - 3 / SERIES[rung].field, 10);
    }
  });
});

describe('a driver through the years', () => {
  it('improves while young, holds in the middle, and gives it back late', () => {
    const young = driverAfter({
      kind: 'hired',
      id: 'a',
      name: 'A',
      skill: 50,
      age: DRIVER_RISE_UNTIL - 1,
    });
    expect(young.skill).toBe(50 + DRIVER_RISE);
    expect(young.age).toBe(DRIVER_RISE_UNTIL);
    const prime = driverAfter({
      kind: 'hired',
      id: 'a',
      name: 'A',
      skill: 50,
      age: DRIVER_RISE_UNTIL,
    });
    expect(prime.skill).toBe(Math.round(50 + DRIVER_HOLD));
    const lastPrime = driverAfter({
      kind: 'hired',
      id: 'a',
      name: 'A',
      skill: 50,
      age: DRIVER_DECLINE_FROM - 1,
    });
    expect(lastPrime.skill).toBe(Math.round(50 + DRIVER_HOLD));
    const old = driverAfter({
      kind: 'hired',
      id: 'a',
      name: 'A',
      skill: 50,
      age: DRIVER_DECLINE_FROM,
    });
    expect(old.skill).toBe(50 - DRIVER_DECLINE);
    expect(old.age).toBe(DRIVER_DECLINE_FROM + 1);
    expect(old.id).toBe('a');
    expect(old.name).toBe('A');
  });

  it('never leaves the scale', () => {
    expect(driverAfter({ kind: 'hired', id: 'a', name: 'A', skill: 99, age: 20 }).skill).toBe(100);
    expect(driverAfter({ kind: 'hired', id: 'a', name: 'A', skill: 100, age: 20 }).skill).toBe(100);
    expect(driverAfter({ kind: 'hired', id: 'a', name: 'A', skill: 1, age: 40 }).skill).toBe(0);
    expect(driverAfter({ kind: 'hired', id: 'a', name: 'A', skill: 0, age: 40 }).skill).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* A season                                                                    */
/* -------------------------------------------------------------------------- */

const unit = (b: OwnedBusiness, year: number, part: string): number =>
  mixedUnit(`racing:${SEED}:${b.id}:${year}:${part}`);

describe('a season’s money', () => {
  it('is the same year however often it is played', () => {
    const a = season(teamAt(3));
    expect(season(teamAt(3))).toEqual(a);
    expect(season(teamAt(3), { year: 2032 }).result).not.toEqual(a.result);
    expect(season(teamAt(3), { seed: 'other' }).result).not.toEqual(a.result);
    expect(season(teamAt(3), {}, business({ id: 'biz:2030:racing:1' })).result).not.toEqual(
      a.result,
    );
  });

  it('adds up: sponsors, prize and merchandise against running cost, crew, driver and shop', () => {
    for (const rung of SERIES_RUNGS) {
      for (let year = 2031; year < 2060; year += 1) {
        const b = business();
        const team = teamAt(rung);
        const out = season(team, { year }, b);
        const row = SERIES[rung];
        const standing = standingOf(rung, out.season.place);
        // Sponsors: half this year's standing and half last year's, which with no last year is this year's.
        const deal =
          SPONSOR_DEAL_SPREAD[0] +
          unit(b, year, 'deal') * (SPONSOR_DEAL_SPREAD[1] - SPONSOR_DEAL_SPREAD[0]);
        const name = SPONSOR_NAME[0] + (SPONSOR_NAME[1] - SPONSOR_NAME[0]) * (b.reputation / 100);
        const sponsors = row.sponsor * (SPONSOR_FLOOR + SPONSOR_SLOPE * standing) * name * deal;
        const prize =
          row.purse *
          Math.pow(standing, PURSE_CURVE) *
          (1 + (out.season.title ? TITLE_PURSE_BONUS : 0));
        expect(out.result.revenue).toBe(Math.round(sponsors + prize + sponsors * MERCH_SHARE));

        const running = Math.round(
          row.budget * DEVELOPMENT_COST.steady * (0.9 + 0.2 * unit(b, year, 'ops')),
        );
        const crew =
          row.crew *
          PAYROLL_EFFECTS.medium.wage *
          (1 + (1 - PAYROLL_EFFECTS.medium.retention) * REPLACEMENT_SHARE);
        const driverCost = driverPayFor(rung, row.strength);
        const incident = unit(b, year, 'incident') < INCIDENT_CHANCE;
        expect(out.season.incident).toBe(incident);
        expect(out.result.cogs).toBe(running);
        expect(out.result.labor).toBe(Math.round(crew + driverCost));
        expect(out.result.overhead).toBe(Math.round(row.budget * SHOP_SHARE));
        expect(out.result.extra).toBe(Math.round(incident ? row.budget * INCIDENT_COST : 0));
        expect(out.result.costs).toBe(
          out.result.cogs + out.result.labor + out.result.overhead + out.result.extra,
        );
        expect(out.result.profit).toBe(out.result.revenue - out.result.costs);
      }
    }
  });

  it('remembers last year with the sponsors: half the standing is last season’s', () => {
    const b = business();
    const fresh = teamAt(3);
    const winning = teamAt(3, {
      last: { year: 2030, rung: 3, place: 1, field: 18, title: true, incident: false },
    });
    const losing = teamAt(3, {
      last: { year: 2030, rung: 3, place: 18, field: 18, title: false, incident: false },
    });
    const w = season(winning, {}, b);
    const l = season(losing, {}, b);
    // The same car, driver and luck: the place is the same, and only the sponsors’ memory differs.
    expect(w.season.place).toBe(l.season.place);
    expect(w.result.revenue).toBeGreaterThan(l.result.revenue);
    const row = SERIES[3];
    const standing = standingOf(3, w.season.place);
    const deal =
      SPONSOR_DEAL_SPREAD[0] +
      unit(b, 2031, 'deal') * (SPONSOR_DEAL_SPREAD[1] - SPONSOR_DEAL_SPREAD[0]);
    const name = SPONSOR_NAME[0] + (SPONSOR_NAME[1] - SPONSOR_NAME[0]) * (b.reputation / 100);
    const expectFor = (remembered: number): number => {
      const s =
        row.sponsor * (SPONSOR_FLOOR + SPONSOR_SLOPE * ((standing + remembered) / 2)) * name * deal;
      const prize =
        row.purse *
        Math.pow(standing, PURSE_CURVE) *
        (1 + (w.season.title ? TITLE_PURSE_BONUS : 0));
      return Math.round(s + prize + s * MERCH_SHARE);
    };
    expect(w.result.revenue).toBe(expectFor(standingOf(3, 1)));
    expect(l.result.revenue).toBe(expectFor(standingOf(3, 18)));
    expect(fresh.last).toBeUndefined();
  });

  it('remembers last year’s standing at last year’s field size, not this year’s', () => {
    const b = business();
    // A team that was fifth of twenty-four at the bottom rung, now in the second.
    const moved = teamAt(2, {
      last: { year: 2030, rung: 1, place: 5, field: 24, title: false, incident: false },
    });
    const out = season(moved, {}, b);
    const row = SERIES[2];
    const standing = standingOf(2, out.season.place);
    const deal =
      SPONSOR_DEAL_SPREAD[0] +
      unit(b, 2031, 'deal') * (SPONSOR_DEAL_SPREAD[1] - SPONSOR_DEAL_SPREAD[0]);
    const name = SPONSOR_NAME[0] + (SPONSOR_NAME[1] - SPONSOR_NAME[0]) * 0.5;
    const s =
      row.sponsor *
      (SPONSOR_FLOOR + SPONSOR_SLOPE * ((standing + standingOf(1, 5)) / 2)) *
      name *
      deal;
    const prize =
      row.purse *
      Math.pow(standing, PURSE_CURVE) *
      (1 + (out.season.title ? TITLE_PURSE_BONUS : 0));
    expect(out.result.revenue).toBe(Math.round(s + prize + s * MERCH_SHARE));
  });

  it('pays the title a bonus on the prize fund', () => {
    const strong = teamAt(2, { car: 100, driver: hired(100) });
    let found = 0;
    for (let year = 2031; year < 2200 && found < 3; year += 1) {
      const out = season(strong, { year });
      if (!out.season.title) continue;
      found += 1;
      expect(out.season.place).toBe(1);
      expect(out.team.titles).toBe(1);
    }
    expect(found).toBe(3);
  });

  it('lets a better crew cost more and a worse one less, at every level of pay', () => {
    const base = season(teamAt(2), {}, business({ payroll: 'medium' }));
    for (const payroll of ['low', 'high', 'bigBucks'] as const) {
      const other = season(teamAt(2), {}, business({ payroll }));
      const level = PAYROLL_EFFECTS[payroll];
      const crew = SERIES[2].crew * level.wage * (1 + (1 - level.retention) * REPLACEMENT_SHARE);
      expect(other.result.labor).toBe(Math.round(crew + driverPayFor(2, SERIES[2].strength)));
      if (payroll === 'low') expect(other.result.labor).toBeLessThan(base.result.labor);
      else expect(other.result.labor).toBeGreaterThan(base.result.labor);
    }
    expect(CREW_SKILL.low).toBeLessThan(CREW_SKILL.medium);
    expect(CREW_SKILL.medium).toBeLessThan(CREW_SKILL.high);
    expect(CREW_SKILL.high).toBeLessThan(CREW_SKILL.bigBucks);
  });

  it('puts a better crew faster: the same team finishes no worse with a higher payroll', () => {
    let better = 0;
    let worse = 0;
    for (let year = 2031; year < 2131; year += 1) {
      const low = season(teamAt(3), { year }, business({ payroll: 'low' })).season.place;
      const top = season(teamAt(3), { year }, business({ payroll: 'bigBucks' })).season.place;
      if (top < low) better += 1;
      if (top > low) worse += 1;
    }
    expect(worse).toBe(0);
    expect(better).toBeGreaterThan(10);
  });

  it('charges more for heavy development and less for lean, on the running cost only', () => {
    const steady = season(teamAt(3));
    const heavy = season(teamAt(3, { development: 'heavy' }));
    const lean = season(teamAt(3, { development: 'lean' }));
    expect(heavy.result.cogs).toBe(
      Math.round(steady.result.cogs * (DEVELOPMENT_COST.heavy / DEVELOPMENT_COST.steady)),
    );
    expect(lean.result.cogs).toBe(
      Math.round(steady.result.cogs * (DEVELOPMENT_COST.lean / DEVELOPMENT_COST.steady)),
    );
    expect(heavy.result.labor).toBe(steady.result.labor);
    expect(heavy.result.overhead).toBe(steady.result.overhead);
  });

  it('settles the car a third of the way to where its spending puts it', () => {
    for (const development of DEVELOPMENTS) {
      for (const car of [20, 50, 80]) {
        const out = season(teamAt(3, { car, development }));
        const target = SERIES[3].strength + DEVELOPMENT_CAR[development];
        expect(out.team.car).toBe(Math.round(car + CAR_DRIFT * (target - car)));
      }
    }
    expect(season(teamAt(3, { car: 100, development: 'heavy' })).team.car).toBeLessThanOrEqual(100);
    expect(season(teamAt(3, { car: 0, development: 'lean' })).team.car).toBeGreaterThanOrEqual(0);
    expect(DEVELOPMENT_CAR.lean).toBeLessThan(DEVELOPMENT_CAR.steady);
    expect(DEVELOPMENT_CAR.heavy).toBeGreaterThan(DEVELOPMENT_CAR.steady);
    expect(DEVELOPMENT_COST.lean).toBeLessThan(DEVELOPMENT_COST.steady);
    expect(DEVELOPMENT_COST.heavy).toBeGreaterThan(DEVELOPMENT_COST.steady);
  });

  it('moves the team’s name a share of the way to where the standing puts it', () => {
    for (const reputation of [10, 50, 90]) {
      const b = business({ reputation });
      const out = season(teamAt(3), {}, b);
      const standing = standingOf(3, out.season.place);
      const target = 20 + 70 * standing;
      expect(out.result.reputation).toBe(
        Math.round(reputation + TEAM_REPUTATION_PULL * (target - reputation)),
      );
    }
    expect(
      season(teamAt(3), {}, business({ reputation: 100 })).result.reputation,
    ).toBeLessThanOrEqual(100);
    expect(
      season(teamAt(3), {}, business({ reputation: 0 })).result.reputation,
    ).toBeGreaterThanOrEqual(0);
  });

  it('makes a bigger name worth more to sponsors', () => {
    const lowName = season(teamAt(3), {}, business({ reputation: 0 })).result.revenue;
    const highName = season(teamAt(3), {}, business({ reputation: 100 })).result.revenue;
    expect(highName).toBeGreaterThan(lowName);
  });

  it('keeps count: seasons, titles, the last result, and the rest of the team as it was', () => {
    const team = teamAt(3, { seasons: 4, titles: 1, best: 3 });
    const out = season(team);
    expect(out.team.seasons).toBe(5);
    expect(out.team.titles).toBe(1 + (out.season.title ? 1 : 0));
    expect(out.team.rung).toBe(3);
    expect(out.team.best).toBe(3);
    expect(out.team.development).toBe('steady');
    expect(out.team.last).toEqual(out.season);
    expect(out.season).toEqual({
      year: 2031,
      rung: 3,
      place: out.season.place,
      field: SERIES[3].field,
      title: out.season.place === 1,
      incident: out.season.incident,
    });
  });

  it('ages the hired driver a year and leaves the owner as the owner', () => {
    const out = season(teamAt(3, { driver: hired(60, 22) }));
    expect(out.team.driver).toEqual({
      kind: 'hired',
      id: 'drv:test',
      name: 'Test Driver',
      skill: 60 + DRIVER_RISE,
      age: 23,
    });
    const own = season(teamAt(3, { driver: { kind: 'owner' } }), { ownerForm: 65 });
    expect(own.team.driver).toEqual({ kind: 'owner' });
    expect(own.replaced).toBeUndefined();
  });

  it('pays the owner-driver nothing, and uses the owner’s form as the driver’s skill', () => {
    const b = business();
    const own = season(
      teamAt(3, { driver: { kind: 'owner' } }),
      { ownerForm: SERIES[3].strength },
      b,
    );
    const paid = season(teamAt(3), {}, b);
    expect(paid.result.labor - own.result.labor).toBe(driverPayFor(3, SERIES[3].strength));
    // Same skill, same car, same luck: the same place.
    expect(own.season.place).toBe(paid.season.place);
    const fast = season(teamAt(3, { driver: { kind: 'owner' } }), { ownerForm: 95 }, b);
    expect(fast.season.place).toBeLessThanOrEqual(own.season.place);
  });

  it('finds a driver when the owner stops driving, and says so', () => {
    const b = business();
    const out = season(teamAt(3, { driver: { kind: 'owner' } }), {}, b);
    const found = driverCandidates(SEED, b.id, 2031, 3)[0]!;
    expect(out.replaced).toEqual(found);
    expect(out.lines).toEqual([`${b.name} needed a new driver. ${found.name} got the seat.`]);
    // The new driver ran the season and has been aged for the next.
    expect(out.team.driver).toEqual({
      ...found,
      skill: Math.round(
        found.skill +
          (found.age < DRIVER_RISE_UNTIL
            ? DRIVER_RISE
            : found.age < DRIVER_DECLINE_FROM
              ? DRIVER_HOLD
              : -DRIVER_DECLINE),
      ),
      age: found.age + 1,
    });
    expect(out.result.labor).toBeGreaterThan(Math.round(SERIES[3].crew));
  });

  it('retires a driver at the retiring age, not before, and says so', () => {
    const b = business();
    const young = season(teamAt(3, { driver: hired(60, DRIVER_RETIRE_AGE - 1) }), {}, b);
    expect(young.replaced).toBeUndefined();
    expect(young.lines).toEqual([]);
    const old = season(teamAt(3, { driver: hired(60, DRIVER_RETIRE_AGE) }), {}, b);
    const found = driverCandidates(SEED, b.id, 2031, 3)[0]!;
    expect(old.replaced).toEqual(found);
    expect(old.lines).toEqual([`Test Driver retired from the car. ${found.name} took the seat.`]);
  });

  it('feels the economy through sponsors, and the year’s events through demand, shop and extras', () => {
    const b = business();
    const base = season(teamAt(3), {}, b);
    const boom = season(teamAt(3), { modifiers: { ...NO_MODIFIERS, demand: 1.2 } }, b);
    expect(boom.result.revenue).toBeGreaterThan(base.result.revenue);
    expect(boom.season.place).toBe(base.season.place);
    const shop = season(teamAt(3), { modifiers: { ...NO_MODIFIERS, overhead: 2 } }, b);
    expect(shop.result.overhead).toBe(Math.round(SERIES[3].budget * SHOP_SHARE * 2));
    const extra = season(teamAt(3), { modifiers: { ...NO_MODIFIERS, extra: 0.1 } }, b);
    expect(extra.result.extra - base.result.extra).toBe(
      Math.round(
        SERIES[3].budget * 0.1 + (base.season.incident ? SERIES[3].budget * INCIDENT_COST : 0),
      ) - Math.round(base.season.incident ? SERIES[3].budget * INCIDENT_COST : 0),
    );
    const slump = season(teamAt(3), { market: 'recession' }, b);
    expect(slump.result.economy).toBeLessThan(1);
    expect(slump.result.revenue).toBeLessThan(base.result.revenue);
    expect(base.result.economy).toBe(1);
  });

  it('has no customers and no idle capacity: the staffing logic reads zeros', () => {
    const out = season(teamAt(2)).result;
    expect(out.turnedAway).toBe(0);
    expect(out.idle).toBe(0);
    expect(out.rivalTook).toBe(0);
    expect(out.demand).toBe(out.revenue);
    expect(out.capacity).toBe(out.revenue);
  });
});

describe('what a season is worth, measured', () => {
  const run = (team: RacingTeam, years = 150) => {
    const margins: number[] = [];
    const places: number[] = [];
    for (let year = 2031; year < 2031 + years; year += 1) {
      const out = season(team, { year }, business({ id: `biz:${year}:racing:0` }));
      margins.push(out.result.profit / out.result.revenue);
      places.push(out.season.place);
    }
    return { margins, places };
  };
  const mean = (list: readonly number[]): number => list.reduce((a, b) => a + b, 0) / list.length;

  it('lets an ordinary team make a modest living at every rung, with a bad year in it', () => {
    for (const rung of SERIES_RUNGS) {
      const { margins } = run(teamAt(rung));
      expect(mean(margins), `rung ${rung}`).toBeGreaterThan(0.0);
      expect(mean(margins), `rung ${rung}`).toBeLessThan(0.3);
      expect(Math.min(...margins), `rung ${rung}`).toBeLessThan(0.05);
    }
  });

  it('pays a stronger driver back, and a weaker one worse', () => {
    const base = mean(run(teamAt(3)).margins);
    const strong = mean(run(teamAt(3, { driver: hired(SERIES[3].strength + 15) })).margins);
    const weak = mean(run(teamAt(3, { driver: hired(SERIES[3].strength - 15) })).margins);
    expect(strong).toBeGreaterThan(base);
    expect(weak).toBeLessThan(base);
  });

  it('wins the odd title with a very good team and almost never with a bad one', () => {
    const great = run(teamAt(2, { car: 90, driver: hired(95) }), 300).places.filter(
      (p) => p === 1,
    ).length;
    const poor = run(teamAt(2, { car: 20, driver: hired(15) }), 300).places.filter(
      (p) => p === 1,
    ).length;
    expect(great).toBeGreaterThan(30);
    expect(poor).toBeLessThan(3);
  });

  it('makes a luck spread that shows: the same team finishes in many places', () => {
    const { places } = run(teamAt(3), 200);
    expect(new Set(places).size).toBeGreaterThan(6);
    expect(SEASON_LUCK).toBeGreaterThan(0);
  });

  it('keeps the new-rung car a little slower than the series', () => {
    expect(NEW_RUNG_CAR_GAP).toBeGreaterThan(0);
    expect(NEW_RUNG_CAR_GAP).toBeLessThan(15);
  });
});

/* -------------------------------------------------------------------------- */
/* Pinned: the draws, the exact money, and the dials                           */
/* -------------------------------------------------------------------------- */

describe('the hashes behind a season', () => {
  it('draws a normal from two hash units, Box–Muller, and nothing else', () => {
    for (let index = 0; index < 40; index += 1) {
      const a = Math.max(1e-9, mixedUnit(`racing:${SEED}:k${index}:a`));
      const b = mixedUnit(`racing:${SEED}:k${index}:b`);
      expect(racingNormal(SEED, `k${index}`)).toBeCloseTo(
        Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b),
        12,
      );
    }
  });

  it('is a standard normal over many draws: centred on nothing, one wide', () => {
    const draws = Array.from({ length: 4000 }, (_, i) => racingNormal(SEED, 'spread', i));
    const mean = draws.reduce((x, y) => x + y, 0) / draws.length;
    const sd = Math.sqrt(draws.reduce((x, y) => x + (y - mean) ** 2, 0) / draws.length);
    expect(Math.abs(mean)).toBeLessThan(0.06);
    expect(sd).toBeGreaterThan(0.94);
    expect(sd).toBeLessThan(1.06);
    expect(draws.filter((d) => d > 1.96).length / draws.length).toBeGreaterThan(0.015);
    expect(draws.filter((d) => d > 1.96).length / draws.length).toBeLessThan(0.035);
  });

  it('builds a driver from named hashes: the name from each pool, a skill around the field, an age from 19', () => {
    for (const rung of SERIES_RUNGS) {
      for (let slot = 0; slot < DRIVER_CANDIDATES; slot += 1) {
        const year = 2040 + slot;
        const key = `b9:${year}:${rung}:${slot}`;
        const u = (part: string): number => mixedUnit(`racing:${SEED}:${key}:${part}`);
        const driver = driverCandidates(SEED, 'b9', year, rung)[slot]!;
        const first = DRIVER_FIRST_NAMES[Math.floor(u('first') * DRIVER_FIRST_NAMES.length)]!;
        const last = DRIVER_LAST_NAMES[Math.floor(u('last') * DRIVER_LAST_NAMES.length)]!;
        expect(driver).toEqual({
          kind: 'hired',
          id: `drv:${year}:${rung}:${slot}`,
          name: `${first} ${last}`,
          skill: Math.round(SERIES[rung].strength + (u('skill') - 0.5) * 28),
          age: 19 + Math.floor(u('age') * 19),
        });
      }
    }
  });

  it('gives a new owner a journeyman: two under the field, and forty percent of the way to the market’s man', () => {
    for (let year = 2030; year < 2060; year += 1) {
      const found = driverCandidates(SEED, 'b1', year, 1)[0]!;
      const team = defaultTeam(SEED, 'b1', year);
      expect(team.driver).toEqual({
        ...found,
        skill: Math.round(SERIES[1].strength - 2 + (found.skill - SERIES[1].strength) * 0.4),
      });
    }
  });
});

describe('exact money', () => {
  const rounded = (n: number): number => Math.round(n);

  it('pays a title the bonus on the prize fund, to the dollar', () => {
    const strong = teamAt(2, { car: 100, driver: hired(100) });
    let checked = 0;
    for (let year = 2031; year < 2300 && checked < 4; year += 1) {
      const b = business();
      const out = season(strong, { year }, b);
      if (!out.season.title) continue;
      checked += 1;
      const row = SERIES[2];
      const deal =
        SPONSOR_DEAL_SPREAD[0] +
        unit(b, year, 'deal') * (SPONSOR_DEAL_SPREAD[1] - SPONSOR_DEAL_SPREAD[0]);
      const name = SPONSOR_NAME[0] + (SPONSOR_NAME[1] - SPONSOR_NAME[0]) * 0.5;
      const sponsors = row.sponsor * (SPONSOR_FLOOR + SPONSOR_SLOPE * 1) * name * deal;
      const prize = row.purse * (1 + TITLE_PURSE_BONUS);
      expect(out.result.revenue).toBe(rounded(sponsors + prize + sponsors * MERCH_SHARE));
      expect(TITLE_PURSE_BONUS).toBe(0.5);
    }
    expect(checked).toBe(4);
  });

  it('rounds crew, driver, shop and extras to whole dollars as the rounded sum, not the cut one', () => {
    const fractional = { labor: 0, shop: 0, extra: 0 };
    for (const payroll of ['low', 'medium', 'high', 'bigBucks'] as const) {
      for (const rung of SERIES_RUNGS) {
        for (const overhead of [1, 1.3337, 1.9173]) {
          for (const extra of [0, 0.017333, 0.044477]) {
            const b = business({ payroll });
            const team = teamAt(rung);
            const out = season(team, { modifiers: { ...NO_MODIFIERS, overhead, extra } }, b);
            const level = PAYROLL_EFFECTS[payroll];
            const crew =
              SERIES[rung].crew * level.wage * (1 + (1 - level.retention) * REPLACEMENT_SHARE);
            const driverCost = driverPayFor(rung, SERIES[rung].strength);
            const incident = unit(b, 2031, 'incident') < INCIDENT_CHANCE;
            if (crew + driverCost - Math.floor(crew + driverCost) >= 0.5) fractional.labor += 1;
            expect(out.result.labor).toBe(rounded(crew + driverCost));
            const shop = SERIES[rung].budget * SHOP_SHARE * overhead;
            if (shop - Math.floor(shop) >= 0.5) fractional.shop += 1;
            expect(out.result.overhead).toBe(rounded(shop));
            const raw =
              (incident ? SERIES[rung].budget * INCIDENT_COST : 0) + extra * SERIES[rung].budget;
            if (raw - Math.floor(raw) >= 0.5) fractional.extra += 1;
            expect(out.result.extra).toBe(rounded(raw));
          }
        }
      }
    }
    // The sweep reaches cases where rounding up and cutting differ, for each of the three.
    for (const count of Object.values(fractional)) expect(count).toBeGreaterThan(3);
  });

  it('moves the name toward the standing’s target, by the pull, in every year', () => {
    for (let year = 2031; year < 2081; year += 1) {
      for (const reputation of [0, 13, 50, 87, 100]) {
        const b = business({ reputation });
        const out = season(teamAt(3), { year }, b);
        const target = 20 + 70 * standingOf(3, out.season.place);
        expect(out.result.reputation).toBe(
          Math.round(reputation + TEAM_REPUTATION_PULL * (target - reputation)),
        );
        expect(out.result.reputation).toBeGreaterThanOrEqual(0);
        expect(out.result.reputation).toBeLessThanOrEqual(100);
      }
    }
  });

  it('settles the car toward its target in every year, and keeps it on the scale', () => {
    for (const development of DEVELOPMENTS) {
      for (const rung of SERIES_RUNGS) {
        for (let car = 0; car <= 100; car += 7) {
          const out = season(teamAt(rung, { car, development }));
          expect(out.team.car).toBe(
            Math.round(
              car + CAR_DRIFT * (SERIES[rung].strength + DEVELOPMENT_CAR[development] - car),
            ),
          );
          expect(out.team.car).toBeGreaterThanOrEqual(0);
          expect(out.team.car).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('the dials', () => {
  it('are the numbers the tuning settled on, so changing one is a decision', () => {
    expect(SERIES_RUNGS.map((rung) => [SERIES[rung].field, SERIES[rung].strength])).toEqual([
      [24, 40],
      [20, 50],
      [18, 60],
      [26, 70],
      [20, 82],
    ]);
    expect(SERIES_RUNGS.map((rung) => SERIES[rung].budget)).toEqual([
      38_000, 190_000, 800_000, 4_200_000, 21_000_000,
    ]);
    expect(SERIES_RUNGS.map((rung) => SERIES[rung].crew)).toEqual([
      14_000, 60_000, 220_000, 900_000, 3_800_000,
    ]);
    expect(SERIES_RUNGS.map((rung) => SERIES[rung].purse)).toEqual([
      18_000, 70_000, 260_000, 1_500_000, 7_000_000,
    ]);
    expect(SERIES_RUNGS.map((rung) => SERIES[rung].sponsor)).toEqual([
      70_000, 340_000, 1_390_000, 7_400_000, 39_000_000,
    ]);
    expect(SERIES_RUNGS.map((rung) => SERIES[rung].driverPay)).toEqual([
      14_000, 50_000, 160_000, 800_000, 4_500_000,
    ]);
    expect(SERIES_RUNGS.map((rung) => SERIES[rung].upgrade)).toEqual([
      0, 90_000, 400_000, 2_200_000, 12_000_000,
    ]);
    expect(TEAM_WEIGHTS).toEqual({ driver: 0.5, car: 0.35, crew: 0.15 });
    expect([FIELD_SPREAD, SEASON_LUCK]).toEqual([9, 7]);
    expect(CREW_SKILL).toEqual({ low: 38, medium: 50, high: 60, bigBucks: 68 });
    expect(DEVELOPMENT_COST).toEqual({ lean: 0.85, steady: 1, heavy: 1.25 });
    expect(DEVELOPMENT_CAR).toEqual({ lean: -6, steady: 0, heavy: 9 });
    expect([CAR_DRIFT, NEW_RUNG_CAR_GAP, PURSE_CURVE, TITLE_PURSE_BONUS]).toEqual([
      0.35, 6, 2.2, 0.5,
    ]);
    expect([SPONSOR_FLOOR, SPONSOR_SLOPE, MERCH_SHARE]).toEqual([0.5, 0.9, 0.04]);
    expect([SPONSOR_NAME, SPONSOR_DEAL_SPREAD]).toEqual([
      [0.8, 1.2],
      [0.85, 1.15],
    ]);
    expect([INCIDENT_CHANCE, INCIDENT_COST, SHOP_SHARE, TEAM_REPUTATION_PULL]).toEqual([
      0.16, 0.12, 0.05, 0.35,
    ]);
    expect([DRIVER_RISE_UNTIL, DRIVER_DECLINE_FROM, DRIVER_RETIRE_AGE]).toEqual([25, 34, 41]);
    expect([
      DRIVER_RISE,
      DRIVER_HOLD,
      DRIVER_DECLINE,
      DRIVER_PAY_EXPONENT,
      DRIVER_CANDIDATES,
    ]).toEqual([2, 0.5, 2, 1.6, 3]);
  });
});
