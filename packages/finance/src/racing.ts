/**
 * Ticket 0808 — a racing team's season.
 *
 * The generic business year (`businessYear`) is demand and capacity: customers come, the shop serves them. A racing
 * team has no customers. Its year is a SEASON: how fast the team was against the field it ran in, where that put it
 * in the standings, and what the standings are worth (a share of the prize fund, and sponsors who pay by the result).
 *
 * The result is returned in the shape of the generic year (`BusinessYearResult`), so everything after it — the till,
 * the owner's draw, a loan, a valuation, the ledger — works unchanged and a racing team needs no branch there.
 *
 * Every draw is a hash, keyed on the business and the year, so the same year is the same year however often it is
 * played and one team's luck never moves another's.
 */

import {
  CAR_DRIFT,
  CREW_SKILL,
  DEVELOPMENT_CAR,
  DEVELOPMENT_COST,
  DRIVER_CANDIDATES,
  DRIVER_DECLINE,
  DRIVER_DECLINE_FROM,
  DRIVER_FIRST_NAMES,
  DRIVER_HOLD,
  DRIVER_LAST_NAMES,
  DRIVER_RETIRE_AGE,
  DRIVER_RISE,
  DRIVER_RISE_UNTIL,
  FIELD_SPREAD,
  INCIDENT_CHANCE,
  INCIDENT_COST,
  MERCH_SHARE,
  PURSE_CURVE,
  SEASON_LUCK,
  SERIES,
  SHOP_SHARE,
  SPONSOR_DEAL_SPREAD,
  SPONSOR_FLOOR,
  SPONSOR_NAME,
  SPONSOR_SLOPE,
  TEAM_REPUTATION_PULL,
  TEAM_WEIGHTS,
  TITLE_PURSE_BONUS,
  driverPayFor,
  type BusinessType,
} from '@yearafter/content';
import { mixedUnit } from '@yearafter/core';
import {
  PAYROLL_EFFECTS,
  REPLACEMENT_SHARE,
  economyFor,
  type BusinessYearResult,
  type OwnedBusiness,
} from './businesses';
import { NO_MODIFIERS, type YearModifiers } from './business-events';
import type { RacingTeam, SeasonResult, TeamDriver, TeamRung } from './racing-state';

const unit = (seed: string, ...parts: (string | number)[]): number =>
  mixedUnit(`racing:${seed}:${parts.join(':')}`);

/** A standard normal draw from two hash units (Box–Muller). Exported so the draw itself can be pinned. */
export function racingNormal(seed: string, ...parts: (string | number)[]): number {
  const a = Math.max(1e-9, unit(seed, ...parts, 'a'));
  const b = unit(seed, ...parts, 'b');
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

const clamp = (low: number, high: number, value: number): number =>
  Math.max(low, Math.min(high, value));

/* -------------------------------------------------------------------------- */
/* Drivers                                                                     */
/* -------------------------------------------------------------------------- */

type Hired = Extract<TeamDriver, { kind: 'hired' }>;

/** One person in the driver market, from a hash of the team, the year and a slot. */
function candidateAt(
  seed: string,
  businessId: string,
  year: number,
  rung: TeamRung,
  slot: number,
): Hired {
  const key = `${businessId}:${year}:${rung}:${slot}`;
  const first =
    DRIVER_FIRST_NAMES[Math.floor(unit(seed, key, 'first') * DRIVER_FIRST_NAMES.length)]!;
  const last = DRIVER_LAST_NAMES[Math.floor(unit(seed, key, 'last') * DRIVER_LAST_NAMES.length)]!;
  const strength = SERIES[rung].strength;
  return {
    kind: 'hired',
    id: `drv:${year}:${rung}:${slot}`,
    name: `${first} ${last}`,
    // Around the field, a little wider than it is: the market has a bargain and a ringer in it.
    skill: Math.round(strength + (unit(seed, key, 'skill') - 0.5) * 28),
    age: 19 + Math.floor(unit(seed, key, 'age') * 19),
  };
}

/** Who is for hire this year at this level: a handful, the same handful however often it is asked. */
export function driverCandidates(
  seed: string,
  businessId: string,
  year: number,
  rung: TeamRung,
): readonly Hired[] {
  return Array.from({ length: DRIVER_CANDIDATES }, (_, slot) =>
    candidateAt(seed, businessId, year, rung, slot),
  );
}

/** The team a new owner starts with: club racing, an ordinary car, a journeyman in it. */
export function defaultTeam(seed: string, businessId: string, year: number): RacingTeam {
  const row = SERIES[1];
  const found = candidateAt(seed, businessId, year, 1, 0);
  return {
    rung: 1,
    car: row.strength,
    driver: {
      ...found,
      skill: Math.round(row.strength - 2 + (found.skill - row.strength) * 0.4),
    },
    development: 'steady',
    titles: 0,
    best: 1,
    seasons: 0,
  };
}

export const teamOf = (business: OwnedBusiness, seed: string): RacingTeam =>
  business.racing ?? defaultTeam(seed, business.id, business.openedYear);

/* -------------------------------------------------------------------------- */
/* A season                                                                    */
/* -------------------------------------------------------------------------- */

export interface RacingYearInput {
  readonly business: OwnedBusiness;
  readonly type: BusinessType;
  readonly team: RacingTeam;
  readonly year: number;
  readonly seed: string;
  readonly market: Parameters<typeof economyFor>[0];
  readonly modifiers?: YearModifiers;
  /** The owner's own driving form, 0–100, when they are a pro driver (they can sit in their own car). */
  readonly ownerForm?: number;
}

export interface RacingYearOutput {
  readonly result: BusinessYearResult;
  readonly team: RacingTeam;
  readonly season: SeasonResult;
  readonly lines: readonly string[];
  /** The driver the team had to find this year, if the one in the car left or retired. */
  readonly replaced?: Hired;
}

/** How good the driver in the car is this year, on the field's scale. */
export const driverSkillOf = (team: RacingTeam, ownerForm: number | undefined): number =>
  team.driver.kind === 'owner' ? (ownerForm ?? 0) : team.driver.skill;

/**
 * The team's pace against the field this year, in points: positive is faster than the average car in the series.
 * Pure of luck. The driver counts most, then the car, then the crew.
 */
export function paceOf(team: RacingTeam, driverSkill: number, crewSkill: number): number {
  const strength = SERIES[team.rung].strength;
  return (
    TEAM_WEIGHTS.driver * (driverSkill - strength) +
    TEAM_WEIGHTS.car * (team.car - strength) +
    // The crew is judged against an ordinary crew, not against the series: it is the same people at every rung.
    TEAM_WEIGHTS.crew * (crewSkill - 50)
  );
}

/** A finishing place from a pace and a season's luck: a logistic curve over the field. */
export function placeOf(rung: TeamRung, pace: number, luck: number): number {
  const z = (pace + luck) / FIELD_SPREAD;
  const fraction = 1 / (1 + Math.exp(1.7 * z));
  const field = SERIES[rung].field;
  return clamp(1, field, 1 + Math.floor(fraction * field));
}

/** How high a place stands, 1 for the title down to just over 0 for last. */
export const standingOf = (rung: TeamRung, place: number): number =>
  1 - (place - 1) / SERIES[rung].field;

/** Where a driver's skill goes in a year, by age. */
export function driverAfter(driver: Hired): Hired {
  const change =
    driver.age < DRIVER_RISE_UNTIL
      ? DRIVER_RISE
      : driver.age < DRIVER_DECLINE_FROM
        ? DRIVER_HOLD
        : -DRIVER_DECLINE;
  return {
    ...driver,
    age: driver.age + 1,
    skill: Math.round(clamp(0, 100, driver.skill + change)),
  };
}

export function racingYear(input: RacingYearInput): RacingYearOutput {
  const { business, team: before, year, seed } = input;
  const key = `${business.id}:${year}`;
  const modifiers = input.modifiers ?? NO_MODIFIERS;
  const lines: string[] = [];
  const row = SERIES[before.rung];

  /* ---- the driver: the owner, a hired one, or a replacement ------------------- */
  let driver: TeamDriver = before.driver;
  let replaced: Hired | undefined;
  if (driver.kind === 'owner' && input.ownerForm === undefined) {
    // The owner stopped driving (retired, hurt, left the sport): the team finds somebody.
    replaced = candidateAt(seed, business.id, year, before.rung, 0);
    driver = replaced;
    lines.push(`${business.name} needed a new driver. ${replaced.name} got the seat.`);
  } else if (driver.kind === 'hired' && driver.age >= DRIVER_RETIRE_AGE) {
    replaced = candidateAt(seed, business.id, year, before.rung, 0);
    lines.push(`${driver.name} retired from the car. ${replaced.name} took the seat.`);
    driver = replaced;
  }
  const skill = driverSkillOf({ ...before, driver }, input.ownerForm);

  /* ---- the season ------------------------------------------------------------- */
  const crewSkill = CREW_SKILL[business.payroll];
  const pace = paceOf({ ...before, driver }, skill, crewSkill);
  const luck = racingNormal(seed, key, 'luck') * SEASON_LUCK;
  const place = placeOf(before.rung, pace, luck);
  const title = place === 1;
  const standing = standingOf(before.rung, place);
  const incident = unit(seed, key, 'incident') < INCIDENT_CHANCE;

  /* ---- what it earned --------------------------------------------------------- */
  const economy = economyFor(input.market, input.type.cyclical);
  const [dealLow, dealHigh] = SPONSOR_DEAL_SPREAD;
  const deal = dealLow + unit(seed, key, 'deal') * (dealHigh - dealLow);
  const [nameLow, nameHigh] = SPONSOR_NAME;
  const name = nameLow + (nameHigh - nameLow) * (business.reputation / 100);
  // A sponsor's deal runs more than a season: they pay half by last year's result and half by this one's.
  const remembered = before.last ? standingOf(before.last.rung, before.last.place) : standing;
  const sponsorStanding = (standing + remembered) / 2;
  const sponsors =
    row.sponsor *
    (SPONSOR_FLOOR + SPONSOR_SLOPE * sponsorStanding) *
    name *
    deal *
    economy *
    modifiers.demand;
  const prize = row.purse * Math.pow(standing, PURSE_CURVE) * (1 + (title ? TITLE_PURSE_BONUS : 0));
  const merch = sponsors * MERCH_SHARE;
  const revenue = sponsors + prize + merch;

  /* ---- what it cost ----------------------------------------------------------- */
  const level = PAYROLL_EFFECTS[business.payroll];
  const running =
    row.budget * DEVELOPMENT_COST[before.development] * (0.9 + 0.2 * unit(seed, key, 'ops'));
  const crew = row.crew * level.wage * (1 + (1 - level.retention) * REPLACEMENT_SHARE);
  const driverCost = driver.kind === 'owner' ? 0 : driverPayFor(before.rung, driver.skill);
  const shop = row.budget * SHOP_SHARE * modifiers.overhead;
  const extra = Math.round(
    (incident ? row.budget * INCIDENT_COST : 0) + modifiers.extra * row.budget,
  );
  const cogs = Math.round(running);
  const labor = Math.round(crew + driverCost);
  const overhead = Math.round(shop);
  const costs = cogs + labor + overhead + extra;

  /* ---- the name, the car, the driver after the year ---------------------------- */
  const target = 20 + 70 * standing;
  // The target is between 20 and 90, so a name that starts on the scale stays on it.
  const reputation = Math.round(
    business.reputation + TEAM_REPUTATION_PULL * (target - business.reputation),
  );
  const carTarget = row.strength + DEVELOPMENT_CAR[before.development];
  // Likewise the car: it moves toward a target between 34 and 91.
  const car = Math.round(before.car + CAR_DRIFT * (carTarget - before.car));
  const aged: TeamDriver = driver.kind === 'hired' ? driverAfter(driver) : driver;

  const season: SeasonResult = {
    year,
    rung: before.rung,
    place,
    field: row.field,
    title,
    incident,
  };
  const team: RacingTeam = {
    ...before,
    car,
    driver: aged,
    titles: before.titles + (title ? 1 : 0),
    seasons: before.seasons + 1,
    last: season,
  };

  const revenueWhole = Math.round(revenue);
  return {
    result: {
      revenue: revenueWhole,
      cogs,
      labor,
      overhead,
      costs,
      profit: revenueWhole - costs,
      // A team has no customers to turn away and no idle capacity: the staffing logic reads these and stays put.
      turnedAway: 0,
      idle: 0,
      reputation,
      demand: revenueWhole,
      capacity: revenueWhole,
      extra,
      economy,
      rivalTook: 0,
    },
    team,
    season,
    lines,
    ...(replaced ? { replaced } : {}),
  };
}
