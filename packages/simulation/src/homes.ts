/**
 * Ticket 0501 — a place of your own.
 *
 * The rules live in `@yearafter/finance`'s `property.ts`; this is where they
 * meet a life: what is for sale this year, buying one, selling one, a year of
 * owning them, and the question the game asks a character who has never
 * thought to look (`withHomeOffer`).
 *
 * LISTINGS ARE DERIVED, NOT STORED. Spec 147 refreshes the market once a game
 * year, and a list that can be recomputed from the seed, the year and the
 * region has no reason to be in the save (CORE_RULES 13.19). Every call in the
 * same year returns the same eight homes; next year returns eight new ones.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type TimelineEntry,
} from '@yearafter/character';
import {
  findHomeKind,
  HOME_KINDS,
  regionCostIndex,
  regionCostIndexOf,
  regionOf,
  type HomeKind,
} from '@yearafter/content';
import { applicantsAt, askingRentOf, isCommercialKind, residenceOf } from './rentals';
import { dollars, err, mixedUnit, ok, type Result } from '@yearafter/core';
import {
  CONDITION_PRICE,
  FORECLOSE_AFTER,
  HOME_CONDITIONS,
  annualExpenseOf,
  homeYear,
  marketMoveFrom,
  mortgageFor,
  mortgagePaymentFor,
  findMortgageProduct,
  portfolioWorth,
  post,
  priceIndexFor,
  saleOf,
  type HomeBuyer,
  type HomeCondition,
  type MortgageOffer,
  type MortgagePurpose,
  type NewTransaction,
  type OwnedHome,
} from '@yearafter/finance';
import {
  emptyLetting,
  goingRentOf,
  unitYear,
  bestApplicant,
  AGENT_SHARE,
  commercialUnitYear,
  firstYearShare,
  leaseLengthOf,
  type MarketState,
  type Tenant,
} from '@yearafter/finance';
import { findLoanProduct, yearlyPaymentFor } from '@yearafter/finance';
import type { PendingDecision } from '@yearafter/events';
import { incomeOf, standingFor } from './cards';
import { hasSystemicOffer, type GameState, type HomeOffer } from './game-state';

/* -------------------------------------------------------------------------- */
/* This year's market                                                          */
/* -------------------------------------------------------------------------- */

/** Spec 849–878: curated, not a catalog to scroll. */
export const LISTINGS_A_YEAR = 8;

export interface HomeListing {
  /** `home:<year>:<slot>`. Becomes the owned home's id, so it is stable forever. */
  readonly id: string;
  readonly kindId: string;
  readonly name: string;
  readonly noun: string;
  readonly beds: number;
  readonly baths: number;
  /** Years since it was built. */
  readonly age: number;
  readonly condition: HomeCondition;
  /** Whole dollars. */
  readonly askingPrice: number;
  /** Whole dollars a year — spec 145's estimated annual expense. */
  readonly annualExpense: number;
  readonly blurb: string;
  readonly regionKey: string;
  readonly regionName: string;
  readonly expenseRate: number;
  /** Ticket 0503. Households it lets to: one for a house. */
  readonly units: number;
  /** Ticket 0503. A duplex or an apartment building, owned to let. */
  readonly rental: boolean;
  /** Ticket 0606. A shop, warehouse or office, let to businesses. Also `rental`. */
  readonly commercial: boolean;
}

/**
 * What a character could plausibly bring to a purchase, whole dollars. The
 * hidden gate on which kinds are shown at all — never displayed.
 *
 * Cash and investments, plus three years of income, which is roughly what a
 * lender's debt ceiling turns an income into. Somebody with nothing saved and
 * a good salary is shown what the salary could carry.
 */
export function meansOf(state: GameState): number {
  const cash = Number(state.player.cash) / 100;
  const invested = Number(portfolioWorth(state.prices, state.portfolio)) / 100;
  return Math.max(0, cash + invested + incomeOf(state) * 3);
}

const unit = (state: GameState, key: string) =>
  mixedUnit(`${state.rng.getSeed()}:${state.world.year}:${key}`);

function between([low, high]: readonly [number, number], u: number): number {
  return Math.round(low + u * (high - low));
}

function conditionFor(age: number, u: number): HomeCondition {
  // Newer homes are likelier to be in better shape. Anything can need work.
  const newness = Math.max(0, 1 - age / 60);
  const shifted = Math.min(0.999, u * (0.75 + newness * 0.5));
  return HOME_CONDITIONS[Math.floor(shifted * HOME_CONDITIONS.length)] as HomeCondition;
}

/** Ticket 0503. Rental buildings for sale a year, beside the eight homes. */
export const RENTAL_LISTINGS_A_YEAR = 3;

function listingsOf(
  state: GameState,
  kinds: readonly HomeKind[],
  count: number,
  slotPrefix: string,
): readonly HomeListing[] {
  if (state.player.age < 18) return [];
  const cityId = state.player.currentLocation.cityId;
  const region = regionOf(cityId);
  const index = priceIndexFor(regionCostIndex(cityId));
  const means = meansOf(state);
  const open = kinds.filter((kind) => kind.means <= means);
  if (open.length === 0) return [];
  const total = open.reduce((sum, kind) => sum + kind.weight, 0);

  const listings: HomeListing[] = [];
  for (let slot = 0; slot < count; slot += 1) {
    const key = `${region.key}:home:${slotPrefix}${slot}`;
    let pick = unit(state, `${key}:kind`) * total;
    let kind: HomeKind = open[open.length - 1] as HomeKind;
    for (const candidate of open) {
      pick -= candidate.weight;
      if (pick < 0) {
        kind = candidate;
        break;
      }
    }
    const age = between(kind.age, unit(state, `${key}:age`));
    const condition = conditionFor(age, unit(state, `${key}:condition`));
    const raw =
      between(kind.price, unit(state, `${key}:price`)) * index * CONDITION_PRICE[condition];
    const askingPrice = Math.max(10_000, Math.round(raw / 1_000) * 1_000);
    const listing: HomeListing = {
      id: `home:${state.world.year}:${slotPrefix}${slot}`,
      kindId: kind.id,
      name: kind.name,
      noun: kind.noun,
      beds: between(kind.beds, unit(state, `${key}:beds`)),
      baths: between(kind.baths, unit(state, `${key}:baths`)),
      age,
      condition,
      askingPrice,
      annualExpense: annualExpenseOf({
        value: dollars(askingPrice),
        expenseRate: kind.expenseRate,
        condition,
      }),
      blurb: kind.blurbs[Math.floor(unit(state, `${key}:blurb`) * kind.blurbs.length)] as string,
      regionKey: region.key,
      regionName: region.name,
      expenseRate: kind.expenseRate,
      units: kind.units,
      rental: kind.rental,
      commercial: kind.commercial,
    };
    listings.push(listing);
  }
  // Cheapest first, so the list reads as a ladder the way the jobs list does.
  return listings.sort((a, b) => a.askingPrice - b.askingPrice);
}

/** This year's homes for sale in the character's state. Same answer all year. */
export const homeListings = (state: GameState): readonly HomeListing[] =>
  listingsOf(
    state,
    HOME_KINDS.filter((kind) => !kind.rental),
    LISTINGS_A_YEAR,
    '',
  );

/**
 * Ticket 0503. This year's rental buildings — duplexes and apartment
 * buildings — behind the same hidden gate. Listed apart from homes so the
 * eight places to live stay eight, and so a character who has never had the
 * means for one is never shown an empty section.
 */
export const rentalListings = (state: GameState): readonly HomeListing[] =>
  listingsOf(
    state,
    HOME_KINDS.filter((kind) => kind.rental && !kind.commercial),
    RENTAL_LISTINGS_A_YEAR,
    'r',
  );

/** Ticket 0606. Commercial buildings for sale a year, apart from the homes and the rentals. */
export const COMMERCIAL_LISTINGS_A_YEAR = 2;

/**
 * Ticket 0606. This year's shops, warehouses and offices, behind the same
 * hidden gate. Their own list, so the residential lists keep their size and
 * their picks, and nobody is shown a warehouse they could never afford.
 */
export const commercialListings = (state: GameState): readonly HomeListing[] =>
  listingsOf(
    state,
    HOME_KINDS.filter((kind) => kind.commercial),
    COMMERCIAL_LISTINGS_A_YEAR,
    'c',
  );

const anyListing = (state: GameState, listingId: string): HomeListing | undefined =>
  [...homeListings(state), ...rentalListings(state), ...commercialListings(state)].find(
    (candidate) => candidate.id === listingId,
  );

/* -------------------------------------------------------------------------- */
/* Buying                                                                      */
/* -------------------------------------------------------------------------- */

export function buyerOf(state: GameState): HomeBuyer {
  const otherPayments = state.loans.reduce((sum, loan) => {
    const product = findLoanProduct(loan.productId);
    if (!product) return sum;
    return sum + yearlyPaymentFor(product, Number(loan.balance) / 100, loan.termLeft);
  }, 0);
  return {
    age: state.player.age,
    standing: standingFor(state).standing,
    income: incomeOf(state),
    cash: Math.floor(Number(state.player.cash) / 100),
    otherPayments,
    // One mortgage on the home they live in; every mortgage, for the lender's cap.
    mortgaged: residenceOf(state.homes)?.mortgage ? 1 : 0,
    mortgages: state.homes.filter((home) => home.mortgage !== undefined).length,
  };
}

/**
 * Ticket 0503. What a purchase is FOR, as a lender asks it: a rental
 * building, or a second house while they already have a home, is an
 * investment. The first house they live in is a home.
 */
export const purposeOf = (state: GameState, listing: HomeListing): MortgagePurpose =>
  listing.commercial
    ? 'commercial'
    : listing.rental || residenceOf(state.homes) !== undefined
      ? 'rental'
      : 'home';

/** The going rent a lender would count on a listing, all units, whole dollars a year. */
const listedRentOf = (listing: HomeListing): number => {
  const kind = findHomeKind(listing.kindId);
  if (!kind) return 0;
  return (
    goingRentOf(
      dollars(listing.askingPrice),
      kind.rentYield,
      regionCostIndexOf(listing.regionKey),
      kind.units,
    ) * kind.units
  );
};

/** What a lender would say about this listing, today. Spec 145's "financing availability". */
export const mortgageOfferFor = (state: GameState, listing: HomeListing): MortgageOffer =>
  mortgageFor(
    listing.askingPrice,
    buyerOf(state),
    listing.annualExpense,
    purposeOf(state, listing),
    listedRentOf(listing),
  );

export type BuyHomeError =
  'no-such-listing' | 'already-owned' | 'cannot-afford' | 'mortgage-refused';

export const BUY_HOME_ERROR_LABELS: Readonly<Record<BuyHomeError, string>> = {
  'no-such-listing': "That one isn't for sale any more.",
  'already-owned': 'You already own it.',
  'cannot-afford': "You don't have enough to pay for it outright.",
  'mortgage-refused': 'The bank said no.',
};

export interface BoughtHome {
  readonly state: GameState;
  readonly home: OwnedHome;
  readonly entry: TimelineEntry;
}

function line(
  state: GameState,
  text: string,
  key: string,
  kind: 'milestone' | 'passive',
): TimelineEntry {
  const sequence = state.player.timeline.filter((entry) => entry.age === state.player.age).length;
  return createTimelineEntry({
    age: state.player.age,
    year: state.world.year,
    kind,
    text,
    id: `t:${state.world.year}:${key}`,
    sequence,
  });
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Buy a listed home, outright or with a mortgage.
 *
 * `with: 'mortgage'` runs spec 149's Apply → Approved/Denied and nothing else:
 * the product and the deposit are chosen by `mortgageFor`, not by the player.
 * The deposit leaves the account as a `property` transfer; the mortgage never
 * passes through cash at all, because the lender pays the seller.
 */
export function buyHome(
  state: GameState,
  listingId: string,
  how: 'cash' | 'mortgage',
): Result<BoughtHome, BuyHomeError> {
  const listing = anyListing(state, listingId);
  if (!listing) return err('no-such-listing');
  if (state.homes.some((home) => home.id === listing.id)) return err('already-owned');

  let paid = listing.askingPrice;
  let mortgage: OwnedHome['mortgage'];
  if (how === 'mortgage') {
    const offer = mortgageOfferFor(state, listing);
    if (!offer.approved || !offer.product) return err('mortgage-refused');
    paid = offer.down;
    mortgage = {
      productId: offer.product.id,
      principal: dollars(offer.principal),
      balance: dollars(offer.principal),
      termLeft: offer.product.termYears,
    };
  } else if (Number(state.player.cash) / 100 < listing.askingPrice) {
    return err('cannot-afford');
  }

  const home: OwnedHome = {
    id: listing.id,
    kindId: listing.kindId,
    beds: listing.beds,
    baths: listing.baths,
    builtYear: state.world.year - listing.age,
    condition: listing.condition,
    regionKey: listing.regionKey,
    regionName: listing.regionName,
    purchasePrice: dollars(listing.askingPrice),
    boughtYear: state.world.year,
    value: dollars(listing.askingPrice),
    expenseRate: listing.expenseRate,
    ...(mortgage ? { mortgage } : {}),
    behindYears: 0,
    // Ticket 0503. A rental building starts empty, at the going rate, unmanaged.
    ...(listing.rental ? { letting: emptyLetting(listing.units) } : {}),
  };

  const books = post(state.finance, state.world.year, state.player.age, {
    category: 'property',
    amount: dollars(-paid),
    source: mortgage
      ? `Deposit on ${listing.noun} in ${listing.regionName}`
      : `${listing.name} in ${listing.regionName}, bought outright`,
  });

  const first =
    state.homes.length === 0 && !state.player.records.some((r) => r.category === 'property');
  const text = mortgage
    ? `Bought ${listing.noun} for ${money(listing.askingPrice)}, with ${money(paid)} down and a mortgage for the rest.`
    : `Bought ${listing.noun} for ${money(listing.askingPrice)}, outright.`;
  const entry = line(state, text, `home:bought:${listing.id}`, 'milestone');

  const next: GameState = {
    ...state,
    finance: books.ledger,
    homes: [...state.homes, home],
    player: {
      ...state.player,
      cash: books.ledger.balance,
      timeline: appendToTimeline(state.player.timeline, entry),
      records: first
        ? appendRecord(
            state.player.records,
            stampRecord(
              {
                category: 'property',
                label: `Bought a first home — ${listing.name}`,
                referenceId: listing.kindId,
              },
              state.player.age,
              state.world.year,
            ),
          )
        : state.player.records,
    },
  };
  return ok({ state: next, home, entry });
}

/* -------------------------------------------------------------------------- */
/* Selling                                                                     */
/* -------------------------------------------------------------------------- */

export type SellHomeError = 'no-such-home';

export interface SoldHome {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  readonly proceeds: number;
}

/** Spec 211's one Sell action. What it fetches is what it is worth now, less costs and the mortgage. */
export function sellHome(state: GameState, homeId: string): Result<SoldHome, SellHomeError> {
  const home = state.homes.find((candidate) => candidate.id === homeId);
  if (!home) return err('no-such-home');
  return ok(sold(state, home, false));
}

function sold(state: GameState, home: OwnedHome, forced: boolean, pressed = false): SoldHome {
  const sale = saleOf(home, forced);
  const noun = findHomeKind(home.kindId)?.noun ?? 'the house';
  const books =
    sale.proceeds > 0
      ? post(state.finance, state.world.year, state.player.age, {
          category: 'property',
          amount: dollars(sale.proceeds),
          source: forced ? `What was left after the bank sold ${noun}` : `Sold ${noun}`,
        })
      : { ledger: state.finance };
  const text = forced
    ? sale.proceeds > 0
      ? `The bank took ${noun} and sold it. ${money(sale.proceeds)} came back to you.`
      : `The bank took ${noun} and sold it. Nothing came back.`
    : pressed
      ? `Sold ${noun} because the payments had become more than the year could carry. ${money(sale.proceeds)} was left after the mortgage.`
      : sale.repaid > 0
        ? `Sold ${noun} for ${money(sale.price)}. After the mortgage and the fees, ${money(sale.proceeds)} was yours.`
        : `Sold ${noun} for ${money(sale.price)}. After the fees, ${money(sale.proceeds)} was yours.`;
  const entry = line(
    state,
    text,
    `home:${forced ? 'taken' : pressed ? 'let-go' : 'sold'}:${home.id}`,
    'milestone',
  );
  return {
    state: {
      ...state,
      finance: books.ledger,
      homes: state.homes.filter((candidate) => candidate.id !== home.id),
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
    entry,
    proceeds: sale.proceeds,
  };
}

/* -------------------------------------------------------------------------- */
/* A year of owning                                                            */
/* -------------------------------------------------------------------------- */

/** One number a year for the whole world, so a crash is a crash for everybody. */
export const marketMoveIn = (year: number): number => marketMoveFrom(mixedUnit(`housing:${year}`));

export interface HomesYear {
  readonly homes: readonly OwnedHome[];
  readonly transactions: readonly NewTransaction[];
  /** What the year said about them — a paid-off mortgage, a house showing its age. */
  readonly lines: readonly string[];
  /**
   * Ticket 0503. What the home they LIVE IN cost this year, whole dollars —
   * its mortgage and upkeep, and nothing for the places they let. The living
   * phase fits the rest of the life around this one number.
   */
  readonly residenceCost: number;
}

/**
 * The year of every home the character owns: the market, the wear, the upkeep
 * and the mortgage payment, as committed outgoings posted with everything else
 * — and, since 0503, the year's rent from every unit that is let.
 *
 * A home already `FORECLOSE_AFTER` years behind is not here — `advanceYear`
 * takes it first, through `foreclose`, so it is not charged for a year it was
 * never going to see out.
 */
export function runHomesYear(
  homes: readonly OwnedHome[],
  year: number,
  seed: string,
  market: MarketState = 'normal',
): HomesYear {
  const move = marketMoveIn(year);
  const transactions: NewTransaction[] = [];
  const lines: string[] = [];
  const next: OwnedHome[] = [];
  const lived = residenceOf(homes);
  let residenceCost = 0;
  for (const home of homes) {
    const result = homeYear(home, move, mixedUnit(`${seed}:${home.id}:${year}:wear`));
    const noun = findHomeKind(home.kindId)?.noun ?? 'your home';
    const name = noun.replace(/^an? /, '');
    if (result.expense > 0) {
      transactions.push({
        category: 'housing',
        amount: dollars(-result.expense),
        source: `Taxes and upkeep on the ${name}`,
      });
    }
    if (result.payment > 0) {
      transactions.push({
        category: 'housing',
        amount: dollars(-result.payment),
        source: `Mortgage on the ${name}`,
      });
    }
    if (home.id === lived?.id) residenceCost = result.expense + result.payment;
    if (result.paidOff) lines.push(`Made the last payment on the ${name}. It's yours, all of it.`);
    if (result.worn && result.home.condition === 'poor') {
      lines.push(`The ${name} is starting to show its age. Everything needs doing at once.`);
    }
    const let_ = home.letting
      ? lettingYear({ ...result.home, letting: home.letting }, year, seed, name, market)
      : undefined;
    if (let_) {
      transactions.push(...let_.transactions);
      if (let_.line) lines.push(let_.line);
      next.push({ ...result.home, letting: let_.letting });
    } else {
      next.push(result.home);
    }
  }
  return { homes: next, transactions, lines, residenceCost };
}

/**
 * Ticket 0503 — a year of letting one property.
 *
 * Every tenant either pays the year at the current rent or stops paying and is
 * evicted having paid half; then the ones who are leaving leave. Leases renew
 * on their own (spec 160) — there is no prompt. With an agent, every empty
 * unit is re-let at the end of the year to the applicant most likely to pay,
 * and the agent takes their share of what was collected. Without one, an
 * empty unit stays empty until the player finds somebody.
 */
function lettingYear(
  home: OwnedHome & { readonly letting: NonNullable<OwnedHome['letting']> },
  year: number,
  seed: string,
  name: string,
  market: MarketState,
): { letting: NonNullable<OwnedHome['letting']>; transactions: NewTransaction[]; line?: string } {
  const rentYear = askingRentOf(home);
  if (isCommercialKind(home)) return commercialLettingYear(home, year, seed, name, market);
  let collected = 0;
  let left = 0;
  let evicted = 0;
  const tenants: (Tenant | null)[] = home.letting.tenants.map((tenant, index) => {
    const result = unitYear({
      tenant,
      year,
      rentYear,
      level: home.letting.level,
      payRoll: mixedUnit(`${seed}:${home.id}:${index}:${year}:pays`),
      leaveRoll: mixedUnit(`${seed}:${home.id}:${index}:${year}:leaves`),
    });
    collected += result.collected;
    if (result.outcome === 'left') left += 1;
    if (result.outcome === 'evicted') evicted += 1;
    return result.outcome === 'stayed' ? tenant : null;
  });

  if (home.letting.managed) {
    tenants.forEach((tenant, index) => {
      if (tenant !== null) return;
      const best = bestApplicant(applicantsAt(seed, home, index, year), rentYear);
      if (best) tenants[index] = best;
    });
  }

  const transactions: NewTransaction[] = [];
  if (collected > 0) {
    transactions.push({
      category: 'assetIncome',
      amount: dollars(collected),
      source: `Rent from the ${name}`,
    });
    if (home.letting.managed) {
      const fee = Math.round(collected * AGENT_SHARE);
      if (fee > 0) {
        transactions.push({
          category: 'housing',
          amount: dollars(-fee),
          source: `Letting agent for the ${name}`,
        });
      }
    }
  }

  const units = home.letting.tenants.length;
  const many = units > 1;
  const line =
    evicted > 0
      ? many
        ? `Had to evict ${evicted === 1 ? 'a tenant' : `${evicted} tenants`} at the ${name}. They'd stopped paying.`
        : `Had to evict the tenant at the ${name}. They'd stopped paying.`
      : !home.letting.managed && left > 0
        ? many
          ? `${left === 1 ? 'A tenant' : `${left} tenants`} moved out of the ${name}.`
          : `The tenant at the ${name} moved out.`
        : undefined;
  return { letting: { ...home.letting, tenants }, transactions, ...(line ? { line } : {}) };
}

/**
 * Ticket 0606 — a year of letting a shop, a warehouse or an office.
 *
 * Rent is the lease's own until it ends. A business that fails stops paying
 * having paid half the year and is gone; one that reaches the end of its lease
 * renews at today's rent or leaves. A new lease pays a part of its first year
 * (fit-out, empty weeks) that the economy lengthens. An agent re-lets at the
 * end of the year, for the same share of what was collected.
 */
function commercialLettingYear(
  home: OwnedHome & { readonly letting: NonNullable<OwnedHome['letting']> },
  year: number,
  seed: string,
  name: string,
  market: MarketState,
): { letting: NonNullable<OwnedHome['letting']>; transactions: NewTransaction[]; line?: string } {
  const kind = findHomeKind(home.kindId);
  const rentYear = askingRentOf(home);
  const lease = kind?.leaseYears ?? [3, 5];
  const share = firstYearShare(
    kind?.vacancy ?? 0,
    (lease[0] + lease[1]) / 2,
    market,
    home.letting.level,
  );
  let collected = 0;
  let left = 0;
  let failed = 0;
  let lastLeft: string | undefined;
  let lastFailed: string | undefined;
  const tenants: (Tenant | null)[] = home.letting.tenants.map((tenant, index) => {
    const result = commercialUnitYear({
      tenant,
      year,
      rentYear,
      level: home.letting.level,
      firstShare: share,
      market,
      payRoll: mixedUnit(`${seed}:${home.id}:${index}:${year}:pays`),
      renewRoll: mixedUnit(`${seed}:${home.id}:${index}:${year}:renews`),
    });
    collected += result.collected;
    if (result.outcome === 'left') {
      left += 1;
      lastLeft = tenant?.name;
    }
    if (result.outcome === 'failed') {
      failed += 1;
      lastFailed = tenant?.name;
    }
    if (result.outcome === 'renewed' && tenant) {
      const length = leaseLengthOf(lease, mixedUnit(`${seed}:${home.id}:${index}:${year}:term`));
      return { ...tenant, rent: rentYear, leaseEnds: year + length };
    }
    return result.outcome === 'stayed' ? tenant : null;
  });

  if (home.letting.managed) {
    tenants.forEach((tenant, index) => {
      if (tenant !== null) return;
      const best = bestApplicant(applicantsAt(seed, home, index, year, market), rentYear);
      if (best) tenants[index] = best;
    });
  }

  const transactions: NewTransaction[] = [];
  if (collected > 0) {
    transactions.push({
      category: 'assetIncome',
      amount: dollars(collected),
      source: `Rent from the ${name}`,
    });
    if (home.letting.managed) {
      const fee = Math.round(collected * AGENT_SHARE);
      if (fee > 0) {
        transactions.push({
          category: 'housing',
          amount: dollars(-fee),
          source: `Letting agent for the ${name}`,
        });
      }
    }
  }

  const many = home.letting.tenants.length > 1;
  const line =
    failed > 0
      ? many && failed > 1
        ? `${failed} businesses at the ${name} went under and stopped paying.`
        : `${lastFailed ?? 'A tenant'} went under and stopped paying rent at the ${name}.`
      : !home.letting.managed && left > 0
        ? many && left > 1
          ? `${left} tenants didn't renew at the ${name}.`
          : `${lastLeft ?? 'A tenant'} didn't renew at the ${name}.`
        : undefined;
  return { letting: { ...home.letting, tenants }, transactions, ...(line ? { line } : {}) };
}

/**
 * After the books close: a household that ended the year short is a year
 * behind on every home it owns; one that did not is caught up.
 */
export function markMissed(homes: readonly OwnedHome[], short: boolean): readonly OwnedHome[] {
  /*
    Ticket 0503: a household that owns property it does not live in falls
    behind on THAT first. Somebody whose duplex is costing more than it lets
    for sells the duplex, not the house their children sleep in; only once
    there is nothing else does the home itself start to slip.
  */
  const home = residenceOf(homes);
  const others = homes.some((candidate) => candidate.id !== home?.id);
  return homes.map((candidate) => ({
    ...candidate,
    behindYears: short && (candidate.id !== home?.id || !others) ? candidate.behindYears + 1 : 0,
  }));
}

/**
 * A household `FORECLOSE_AFTER` years behind lets the house go — and almost
 * always SELLS it, rather than having it taken.
 *
 * The first version foreclosed: the bank sold at 85% and kept what it was
 * owed. Measured on 150 lives, 104 of 176 purchases ended that way, at a
 * median age of 63 — people who bought at forty-eight on a thirty-year term,
 * retired, and could no longer carry the payment. That is not what happens to
 * them. A household with equity that cannot keep up puts the house on the
 * market, pays off the lender and moves somewhere cheaper, which is the same
 * thing 0303's hardship branch does for a renter: the lease ends, the life
 * contracts, nobody carries an unpaid bill for a decade.
 *
 * So the bank only takes a house worth less than is owed on it — the one case
 * where selling cannot get anybody out, and the case real foreclosures are.
 */
export function foreclose(state: GameState): GameState {
  let next = state;
  for (const home of state.homes) {
    if (home.behindYears < FORECLOSE_AFTER) continue;
    const underwater = saleOf(home).proceeds <= 0;
    next = sold(next, home, underwater, !underwater).state;
  }
  return next;
}

/* -------------------------------------------------------------------------- */
/* The question nobody asked (the fifth door)                                  */
/* -------------------------------------------------------------------------- */

/**
 * A place that came up.
 *
 * The same shape as the four doors before it — 0405's college, 0407's first
 * job, 0410's private life, 0416's sign-up sheet — and for the same measured
 * reason: every verb in this file sits behind the Homes screen, so a player who
 * answers what the game asks would rent for eighty years and die owning
 * nothing. It runs the real verb (`buyHome`) with the real underwriting, so the
 * bank can still say no.
 *
 * WHO IS ASKED. Somebody who owns nothing, is not living with their parents,
 * and could actually get a mortgage on one of this year's homes whose yearly
 * cost is within reach of what their roof costs them now. The listing offered
 * is the cheapest one the bank would lend on — a first home is a small one.
 */
export const HOME_EVENT_ID = 'home.offer';
export const PUT_IN_AN_OFFER = 'yes';
export const NOT_YET = 'skip';
export const HOME_OFFER_CHANCE = 0.3;
/**
 * Yearly cost of owning against the roof they pay now, at most.
 *
 * Ticket 0502 raised it from 1.0. With `OWNER_SHARE` corrected the roof is
 * the quarter-to-a-third of spending it is in life, and a first home almost
 * always costs more than the rent it replaces; the lender's 43% ceiling is the
 * real limit, and it still applies. At 1.0 ownership fell to 3% at 25–34 and
 * 19% at 35–44; at 1.5 it reads about 10% and 40%.
 */
export const WITHIN_REACH = 1.5;

export const isHomeOfferDecision = (eventId: string): boolean => eventId === HOME_EVENT_ID;

export function withHomeOffer(state: GameState, alive: boolean, roof: number): GameState {
  if (!alive) return state;
  if (hasSystemicOffer(state)) return state;
  // Ticket 0503: owning a rental building is not owning a home to live in.
  if (residenceOf(state.homes) !== undefined) return state;
  if (state.household.housing !== 'ownPlace') return state;
  if (!(unit(state, 'home-offer:ask') < HOME_OFFER_CHANCE)) return state;

  const candidate = homeListings(state).find((listing) => {
    const offer = mortgageOfferFor(state, listing);
    if (!offer.approved) return false;
    return offer.yearlyPayment + listing.annualExpense <= Math.max(roof, 1) * WITHIN_REACH;
  });
  if (!candidate) return state;

  const offer: HomeOffer = {
    listingId: candidate.id,
    age: state.player.age,
    eventId: HOME_EVENT_ID,
  };
  const prompts = [
    `${cap(candidate.noun)} came up for ${money(candidate.askingPrice)}. The bank would lend on it.`,
    `You looked at ${candidate.noun} for ${money(candidate.askingPrice)} and couldn't stop thinking about it.`,
    `There's ${candidate.noun} for sale at ${money(candidate.askingPrice)}, and you could get a mortgage.`,
  ];
  const decision: PendingDecision = {
    eventId: HOME_EVENT_ID,
    category: 'random',
    age: state.player.age,
    year: state.world.year,
    prompt: prompts[state.player.age % prompts.length] as string,
    choices: [
      { id: PUT_IN_AN_OFFER, label: 'Put in an offer' },
      { id: NOT_YET, label: 'Keep renting for now' },
    ],
    names: {},
  };
  return { ...state, homeOffer: offer, pending: [...state.pending, decision] };
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export type HomeOfferError = 'no-offer' | 'no-such-choice';

export function answerHomeOffer(
  state: GameState,
  choiceId: string,
): Result<{ readonly state: GameState; readonly entry: TimelineEntry }, HomeOfferError> {
  const offer = state.homeOffer;
  if (!offer) return err('no-offer');
  if (choiceId !== PUT_IN_AN_OFFER && choiceId !== NOT_YET) return err('no-such-choice');
  const cleared: GameState = {
    ...state,
    pending: state.pending.filter((candidate) => !isHomeOfferDecision(candidate.eventId)),
  };
  delete (cleared as { homeOffer?: HomeOffer }).homeOffer;

  const note = (text: string) => {
    const entry = line(cleared, text, 'home:offer', 'passive');
    return ok({
      state: {
        ...cleared,
        player: { ...cleared.player, timeline: appendToTimeline(cleared.player.timeline, entry) },
      },
      entry,
    });
  };
  if (choiceId === NOT_YET) return note('Looked at a place to buy, and kept renting.');
  const bought = buyHome(cleared, offer.listingId, 'mortgage');
  if (!bought.ok) return note('Put in an offer on a place. The bank said no.');
  return ok({ state: bought.value.state, entry: bought.value.entry });
}

/** What the payments on a listing would be, for the screen. */
export const yearlyCostOf = (listing: HomeListing, offer: MortgageOffer): number =>
  offer.yearlyPayment + listing.annualExpense;

/** The years left and the yearly payment on an owned home's mortgage, for the screen. */
export function mortgageLineOf(
  home: OwnedHome,
): { readonly payment: number; readonly termLeft: number } | undefined {
  if (!home.mortgage) return undefined;
  const product = findMortgageProduct(home.mortgage.productId);
  return {
    payment: mortgagePaymentFor(
      product?.apr ?? 0.065,
      Number(home.mortgage.balance) / 100,
      home.mortgage.termLeft,
    ),
    termLeft: home.mortgage.termLeft,
  };
}
