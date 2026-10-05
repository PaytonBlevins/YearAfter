/**
 * Ticket 0503 — letting property.
 *
 * The rules are in `@yearafter/finance`'s `rental.ts`. This is where they meet
 * a life: whose home is whose, who answers a listing, signing a tenant, the
 * agent, the rent, and a year of it.
 *
 * APPLICANTS ARE DERIVED, NOT STORED, like 0501's listings: the same people
 * answer for the same unit all year, and next year different ones do. Only a
 * tenant who has actually signed is in the save.
 *
 * NO PRIMARY-RESIDENCE MECHANIC (spec 153–154). Nothing asks where the
 * character lives. A house with no letting on it is lived in; a house that is
 * let is not; a duplex or an apartment building is never lived in. When a
 * character owns two houses and lets neither, the first is home and the
 * second stands empty, costing its upkeep — which is true.
 */

import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import {
  COMMERCIAL_TRADES,
  NAME_CULTURES,
  findBusinessType,
  findHomeKind,
  regionCostIndexOf,
} from '@yearafter/content';
import { err, mixedUnit, ok, stablePick, type Result } from '@yearafter/core';
import {
  GOING_RATE,
  annualExpenseOf,
  bestApplicant,
  commercialApplicantCount,
  commercialTraits,
  emptyLetting,
  leaseLengthOf,
  goingRentOf,
  rentLevelOf,
  rentalEconomics,
  stepRent,
  applicantTraits,
  findMortgageProduct,
  mortgagePaymentFor,
  type Letting,
  type MarketState,
  type OwnedHome,
  type RentalEconomics,
  type Tenant,
} from '@yearafter/finance';
import type { GameState } from './game-state';

/* -------------------------------------------------------------------------- */
/* Whose home is whose                                                         */
/* -------------------------------------------------------------------------- */

/** A duplex or an apartment building: owned to let, never lived in. */
export const isRentalKind = (home: Pick<OwnedHome, 'kindId'>): boolean =>
  findHomeKind(home.kindId)?.rental ?? false;

/** Ticket 0606. A shop, warehouse or office: let to businesses on leases. */
export const isCommercialKind = (home: Pick<OwnedHome, 'kindId'>): boolean =>
  findHomeKind(home.kindId)?.commercial ?? false;

/** The home the character lives in, if they own one. */
export const residenceOf = (homes: readonly OwnedHome[]): OwnedHome | undefined =>
  homes.find((home) => home.letting === undefined && !isRentalKind(home));

/** Everything they own that is not where they live. */
export const otherPropertyOf = (homes: readonly OwnedHome[]): readonly OwnedHome[] => {
  const home = residenceOf(homes);
  return homes.filter((candidate) => candidate.id !== home?.id);
};

/** The going rate for one unit of this home, whole dollars a year. */
export function goingRentFor(home: Pick<OwnedHome, 'kindId' | 'value' | 'regionKey'>): number {
  const kind = findHomeKind(home.kindId);
  if (!kind) return 0;
  return goingRentOf(home.value, kind.rentYield, regionCostIndexOf(home.regionKey), kind.units);
}

/** What one unit is let for at the home's current setting, whole dollars a year. */
export const askingRentOf = (home: OwnedHome): number =>
  Math.round(goingRentFor(home) * rentLevelOf(home.letting?.level ?? GOING_RATE).level);

/* -------------------------------------------------------------------------- */
/* Who answers                                                                 */
/* -------------------------------------------------------------------------- */

function nameFrom(key: string): string {
  const culture = NAME_CULTURES[Math.floor(mixedUnit(`${key}:culture`) * NAME_CULTURES.length)];
  if (!culture) return 'A tenant';
  const firsts = mixedUnit(`${key}:sex`) < 0.5 ? culture.male : culture.female;
  const first = firsts[Math.floor(mixedUnit(`${key}:first`) * firsts.length)] ?? 'Sam';
  const last =
    culture.surnames[Math.floor(mixedUnit(`${key}:last`) * culture.surnames.length)] ?? '';
  return `${first} ${last}`.trim();
}

/**
 * Who answers the listing for one empty unit in `year`, for a lease starting
 * the year after. How many is the rent setting's to decide (spec 954–978:
 * very high rent reduces applicants).
 *
 * Ticket 0606: for a commercial building they are businesses, signing a lease
 * of several years at today's rent, and how many answer follows the economy.
 */
export function applicantsAt(
  seed: string,
  home: OwnedHome,
  unitIndex: number,
  year: number,
  market: MarketState = 'normal',
): readonly Tenant[] {
  const level = rentLevelOf(home.letting?.level ?? GOING_RATE);
  const rentYear = askingRentOf(home);
  const kind = findHomeKind(home.kindId);
  if (kind?.commercial) {
    const trades = COMMERCIAL_TRADES[kind.id] ?? [];
    const found: Tenant[] = [];
    const count = commercialApplicantCount(level.level, market);
    for (let i = 0; i < count; i += 1) {
      const key = `${seed}:${home.id}:${unitIndex}:${year}:applicant:${i}`;
      const trade = stablePick(trades, `${key}:trade`) ?? 'biz.specialty';
      const names = findBusinessType(trade)?.names ?? [];
      found.push({
        id: `tenant:${home.id}:${unitIndex}:${year}:${i}`,
        name: stablePick(names, `${key}:name`) ?? 'A local business',
        since: year + 1,
        ...commercialTraits(rentYear, [
          mixedUnit(`${key}:income`),
          mixedUnit(`${key}:credit`),
          mixedUnit(`${key}:work`),
          mixedUnit(`${key}:household`),
          mixedUnit(`${key}:evictions`),
        ]),
        trade,
        rent: rentYear,
        leaseEnds: year + leaseLengthOf(kind.leaseYears, mixedUnit(`${key}:lease`)),
      });
    }
    return found;
  }
  const out: Tenant[] = [];
  for (let i = 0; i < level.applicants; i += 1) {
    const key = `${seed}:${home.id}:${unitIndex}:${year}:applicant:${i}`;
    const traits = applicantTraits(rentYear, [
      mixedUnit(`${key}:income`),
      mixedUnit(`${key}:credit`),
      mixedUnit(`${key}:work`),
      mixedUnit(`${key}:household`),
      mixedUnit(`${key}:evictions`),
    ]);
    out.push({
      id: `tenant:${home.id}:${unitIndex}:${year}:${i}`,
      name: nameFrom(key),
      since: year + 1,
      ...traits,
    });
  }
  return out;
}

/** This year's applicants for an empty unit, for the screen and the verbs. */
export function applicantsFor(
  state: GameState,
  homeId: string,
  unitIndex: number,
): readonly Tenant[] {
  const home = state.homes.find((candidate) => candidate.id === homeId);
  if (!home?.letting || home.letting.tenants[unitIndex] !== null) return [];
  return applicantsAt(state.rng.getSeed(), home, unitIndex, state.world.year, state.market);
}

/* -------------------------------------------------------------------------- */
/* The verbs                                                                   */
/* -------------------------------------------------------------------------- */

export type RentalError =
  | 'no-such-home'
  | 'not-let'
  | 'already-let'
  | 'lived-in'
  | 'rental-building'
  | 'unit-taken'
  | 'no-such-applicant'
  | 'still-tenanted'
  | 'have-a-home';

export const RENTAL_ERROR_LABELS: Readonly<Record<RentalError, string>> = {
  'no-such-home': "You don't own that any more.",
  'not-let': "That place isn't being let.",
  'already-let': "It's already being let.",
  'lived-in': 'You live there.',
  'rental-building': 'Nobody lives in a building you let out.',
  'unit-taken': 'Somebody already lives there.',
  'no-such-applicant': 'That person found somewhere else.',
  'still-tenanted': 'There are still tenants living there.',
  'have-a-home': 'You already have somewhere to live.',
};

export interface RentalChange {
  readonly state: GameState;
  readonly entry?: TimelineEntry;
}

function line(state: GameState, text: string, key: string): TimelineEntry {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind: 'passive',
    text,
    id: `t:${state.world.year}:${key}`,
    sequence,
  });
}

const nameOf = (home: OwnedHome) =>
  (findHomeKind(home.kindId)?.noun ?? 'the place').replace(/^an? /, '');

function withHome(state: GameState, home: OwnedHome, entry?: TimelineEntry): RentalChange {
  const homes = state.homes.map((candidate) => (candidate.id === home.id ? home : candidate));
  return {
    state: {
      ...state,
      homes,
      player: entry
        ? { ...state.player, timeline: appendToTimeline(state.player.timeline, entry) }
        : state.player,
    },
    ...(entry ? { entry } : {}),
  };
}

const find = (state: GameState, homeId: string) =>
  state.homes.find((candidate) => candidate.id === homeId);

/**
 * Let a house out. If it is where they live, they move out — into a rented
 * place, which the living phase charges from next year like any renter's.
 */
export function rentOut(state: GameState, homeId: string): Result<RentalChange, RentalError> {
  const home = find(state, homeId);
  if (!home) return err('no-such-home');
  if (home.letting) return err('already-let');
  const wasHome = residenceOf(state.homes)?.id === home.id;
  const next: OwnedHome = { ...home, letting: emptyLetting(findHomeKind(home.kindId)?.units ?? 1) };
  const text = wasHome
    ? `Moved out of the ${nameOf(home)} and put it up for rent.`
    : `Put the ${nameOf(home)} up for rent.`;
  return ok(withHome(state, next, line(state, text, `home:let:${home.id}`)));
}

/** Move back into a house that is let but empty — only if they have nowhere else. */
export function moveBackIn(state: GameState, homeId: string): Result<RentalChange, RentalError> {
  const home = find(state, homeId);
  if (!home) return err('no-such-home');
  if (!home.letting) return err('not-let');
  if (isRentalKind(home)) return err('rental-building');
  if (home.letting.tenants.some((tenant) => tenant !== null)) return err('still-tenanted');
  if (residenceOf(state.homes)) return err('have-a-home');
  const { letting: _gone, ...rest } = home;
  return ok(
    withHome(
      state,
      rest,
      line(state, `Moved back into the ${nameOf(home)}.`, `home:back:${home.id}`),
    ),
  );
}

/** One step up or down the rent table. Applies to everybody at renewal (spec 160). */
export function changeRent(
  state: GameState,
  homeId: string,
  direction: 1 | -1,
): Result<RentalChange, RentalError> {
  const home = find(state, homeId);
  if (!home) return err('no-such-home');
  if (!home.letting) return err('not-let');
  return ok(
    withHome(state, {
      ...home,
      letting: { ...home.letting, level: stepRent(home.letting.level, direction) },
    }),
  );
}

/** Hire a letting agent, or let them go. */
export function setAgent(
  state: GameState,
  homeId: string,
  managed: boolean,
): Result<RentalChange, RentalError> {
  const home = find(state, homeId);
  if (!home) return err('no-such-home');
  if (!home.letting) return err('not-let');
  return ok(withHome(state, { ...home, letting: { ...home.letting, managed } }));
}

function signed(letting: Letting, unitIndex: number, tenant: Tenant): Letting {
  return {
    ...letting,
    tenants: letting.tenants.map((current, index) => (index === unitIndex ? tenant : current)),
  };
}

/** Sign one of this year's applicants to an empty unit. They move in next year. */
export function signTenant(
  state: GameState,
  homeId: string,
  unitIndex: number,
  applicantId: string,
): Result<RentalChange, RentalError> {
  const home = find(state, homeId);
  if (!home) return err('no-such-home');
  if (!home.letting) return err('not-let');
  if (home.letting.tenants[unitIndex] !== null) return err('unit-taken');
  const applicant = applicantsFor(state, homeId, unitIndex).find(
    (candidate) => candidate.id === applicantId,
  );
  if (!applicant) return err('no-such-applicant');
  const text = `Signed a lease with ${applicant.name} for the ${nameOf(home)}.`;
  return ok(
    withHome(
      state,
      { ...home, letting: signed(home.letting, unitIndex, applicant) },
      line(state, text, `home:lease:${home.id}:${unitIndex}`),
    ),
  );
}

/**
 * Spec 145's mass tenant search: every empty unit filled at once with the
 * applicant most likely to pay, the same choice an agent would make. One tap
 * for twenty-five doors, which is the whole point.
 */
export function fillEmptyUnits(
  state: GameState,
  homeId: string,
): Result<RentalChange, RentalError> {
  const home = find(state, homeId);
  if (!home) return err('no-such-home');
  if (!home.letting) return err('not-let');
  const rentYear = askingRentOf(home);
  let letting = home.letting;
  let filled = 0;
  home.letting.tenants.forEach((tenant, index) => {
    if (tenant !== null) return;
    const best = bestApplicant(
      applicantsAt(state.rng.getSeed(), home, index, state.world.year, state.market),
      rentYear,
    );
    if (!best) return;
    letting = signed(letting, index, best);
    filled += 1;
  });
  if (filled === 0) return ok({ state });
  const text =
    filled === 1
      ? `Found a tenant for the ${nameOf(home)}.`
      : `Found ${filled} tenants for the ${nameOf(home)}.`;
  return ok(withHome(state, { ...home, letting }, line(state, text, `home:filled:${home.id}`)));
}

/* -------------------------------------------------------------------------- */
/* What it would make — the screen's numbers                                   */
/* -------------------------------------------------------------------------- */

export function economicsOf(home: OwnedHome): RentalEconomics {
  const units = findHomeKind(home.kindId)?.units ?? 1;
  const letting = home.letting ?? emptyLetting(units);
  return rentalEconomics({
    units,
    let: letting.tenants.filter((tenant) => tenant !== null).length,
    goingRent: goingRentFor(home),
    level: letting.level,
    managed: letting.managed,
    mortgageYear: home.mortgage
      ? mortgagePaymentFor(
          findMortgageProduct(home.mortgage.productId)?.apr ?? 0.065,
          Number(home.mortgage.balance) / 100,
          home.mortgage.termLeft,
        )
      : 0,
    upkeepYear: annualExpenseOf(home),
  });
}
