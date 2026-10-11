/**
 * Ticket 0507 — auctions.
 *
 * Spec 41 and 1899: two general houses (Hartwell & Finch, Crane Brothers),
 * each attended up to twice a year, each with its own stock and a credibility
 * that varies year to year and is shown in words; a storage-auction yard that
 * can be visited six times a year; and private sales for the wealthy (spec
 * 1478: soft gates, well below billionaire). The rules are
 * `@yearafter/finance`'s `auctions.ts`; this is the sale itself.
 *
 * A SALE IS DERIVED, NOT STORED. Attending is the only thing written: the
 * diary counts visits (so the yearly limit holds) and remembers which lots
 * were bid on (so a lot cannot be bid on twice). The lots of a visit come from
 * the seed, the year, the venue and the visit number, the same way homes, cars
 * and shop counters do (CORE_RULES 13.19). So does what everybody else would
 * have bid: the room's top bid is drawn from a key, not a stream, so looking
 * at a lot does not change it.
 *
 * WHAT COMES FROM WHERE. A general house sells pieces from the valuables
 * catalog and, one lot in five, a car from the vehicles catalog. The private
 * room sells the dear end of both — and, very rarely, something legendary. A
 * storage unit is a size and what you can see from the door; its contents are
 * drawn when it is won.
 *
 * NO DOOR. Going to auctions is a hobby a player chooses.
 */

import {
  payPurchase,
  purchaseEligibility,
  paymentNote,
  PAYMENT_REFUSAL_LABELS,
  type PurchasePayment,
  type PaymentRefusal,
} from '@yearafter/finance';

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type TimelineEntry,
} from '@yearafter/character';
import {
  AUCTION_VENUES,
  BODY_LABELS,
  STORAGE_JUNK,
  STORAGE_PEEKS,
  VALUABLES,
  VEHICLE_MODELS,
  findAuctionVenue,
  findValuable,
  findVehicleTrim,
  vehicleName,
  type AuctionVenue,
  type Valuable,
} from '@yearafter/content';
import { dollars, err, mixedUnit, ok, type Result } from '@yearafter/core';
import {
  BUYERS_PREMIUM,
  CREDIBILITY_EFFECTS,
  STORAGE_ROOM_MEAN,
  STORAGE_ROOM_SPREAD,
  UNIT_SIZES,
  credibilityFrom,
  defectFor,
  estimateFor,
  expectedCondition,
  historyFrom,
  junkValueFor,
  maxBidFor,
  post,
  resaleAtPurchase,
  resolveBid,
  roomTopBid,
  usualPriceFor,
  vehicleValueOf,
  type BidTier,
  type Credibility,
  type Estimate,
  type OwnedValuable,
  type OwnedVehicle,
  type UnitSize,
} from '@yearafter/finance';
import type { AuctionDiary, GameState } from './game-state';
import { articled, shoppingMeansOf } from './shopping';

/** Adults only: an auction is a contract. */
export const AUCTIONS_FROM_AGE = 18;
/** A sale never lists a lot dearer than this many times somebody's means. */
export const AUCTION_REACH = 1.5;
/** Storage yards charge less on top than salerooms do. */
export const STORAGE_PREMIUM = 0.1;
/** Spec 1249: legendary objects are extremely rare. Per private lot. */
export const PRIVATE_LEGEND_CHANCE = 0.002;
/** And per storage unit, rarer still. */
export const STORAGE_LEGEND_CHANCE = 0.0003;

/* -------------------------------------------------------------------------- */
/* The diary                                                                   */
/* -------------------------------------------------------------------------- */

const emptyDiary = (year: number): AuctionDiary => ({ year, visits: {}, bids: [] });

/** This year's diary. Last year's means nothing has been attended yet. */
export const diaryOf = (state: GameState): AuctionDiary =>
  state.auctions && state.auctions.year === state.world.year
    ? state.auctions
    : emptyDiary(state.world.year);

export const visitsUsed = (state: GameState, venueId: string): number =>
  diaryOf(state).visits[venueId] ?? 0;

export function visitsLeft(state: GameState, venueId: string): number {
  const venue = findAuctionVenue(venueId);
  return venue ? Math.max(0, venue.visits - visitsUsed(state, venueId)) : 0;
}

/** The venues this character would be shown. The private room only behind its gate. */
export const openVenues = (state: GameState): readonly AuctionVenue[] =>
  state.player.age < AUCTIONS_FROM_AGE
    ? []
    : AUCTION_VENUES.filter((venue) => shoppingMeansOf(state) >= venue.means);

/**
 * A house's standing this year. The same for every life, the way the housing
 * market is: a house with a bad year has it for everybody.
 */
export const credibilityOf = (venue: AuctionVenue, year: number): Credibility =>
  venue.type === 'private'
    ? 'well'
    : credibilityFrom(mixedUnit(`auction-house:${venue.id}:${year}`));

/* -------------------------------------------------------------------------- */
/* Lots                                                                        */
/* -------------------------------------------------------------------------- */

interface LotBase {
  /** `lot:<year>:<venue>:<visit>:<slot>`. Becomes the owned thing's id. */
  readonly id: string;
  readonly venueId: string;
  readonly name: string;
  readonly description: string;
  /** What the room's bidding usually reaches, or the house's printed estimate. */
  readonly estimate: Estimate;
  /** Hidden: what it would fetch. */
  readonly value: number;
  /** Hidden: everybody else's top bid. */
  readonly roomTop: number;
}

export interface ValuableLot extends LotBase {
  readonly kind: 'valuable';
  readonly itemId: string;
  /** Hidden: not what the catalog says. */
  readonly fake: boolean;
}

export interface CarLot extends LotBase {
  readonly kind: 'car';
  readonly trimId: string;
  readonly modelYear: number;
  readonly condition: number;
  readonly history: OwnedVehicle['history'];
  readonly accident: boolean;
  /** Hidden: a house that talks has been known to sell a car with a problem. */
  readonly defective: boolean;
}

export interface UnitLot extends LotBase {
  readonly kind: 'unit';
  readonly size: UnitSize;
}

export type Lot = ValuableLot | CarLot | UnitLot;

const unitFor = (state: GameState, key: string) => mixedUnit(`${state.rng.getSeed()}:${key}`);

function pick<T>(items: readonly T[], u: number): T | undefined {
  return items.length === 0
    ? undefined
    : items[Math.min(items.length - 1, Math.floor(u * items.length))];
}

function valuableLot(
  state: GameState,
  venue: AuctionVenue,
  key: string,
  id: string,
  credibility: Credibility,
  ceiling: number,
): ValuableLot | undefined {
  const legendary =
    venue.type === 'private' &&
    venue.kinds.includes('mythical') &&
    unitFor(state, `${key}:legend`) < PRIVATE_LEGEND_CHANCE;
  const pool = VALUABLES.filter((item) =>
    legendary
      ? item.kind === 'mythical'
      : item.kind !== 'mythical' &&
        venue.kinds.includes(item.kind) &&
        item.price <= ceiling &&
        // The private room sells the dear end; the general houses everything else.
        (venue.type === 'private' ? item.price >= 20_000 : item.price < 1_000_000),
  );
  const item = pick(pool, unitFor(state, `${key}:item`));
  if (!item) return undefined;
  // Second-hand: some come in better shape or with a better story than others.
  const value = Math.max(
    20,
    Math.round(resaleAtPurchase(item, item.price) * (0.85 + 0.35 * unitFor(state, `${key}:shape`))),
  );
  return {
    kind: 'valuable',
    id,
    venueId: venue.id,
    name: item.name,
    description: item.blurb || descriptionFor(item),
    estimate: estimateFor(value, credibility, unitFor(state, `${key}:estimate`)),
    value,
    roomTop: roomTopBid(value, `${state.rng.getSeed()}:${key}:room`),
    itemId: item.id,
    fake: !legendary && unitFor(state, `${key}:fake`) < CREDIBILITY_EFFECTS[credibility].fakeChance,
  };
}

const descriptionFor = (item: Valuable): string =>
  item.brand ? `${item.brand}, from a private collection.` : 'From a private collection.';

function carLot(
  state: GameState,
  venue: AuctionVenue,
  key: string,
  id: string,
  credibility: Credibility,
  ceiling: number,
): CarLot | undefined {
  const pool = VEHICLE_MODELS.flatMap((model) =>
    venue.cars.includes(model.market)
      ? model.trims.filter((trim) => trim.price <= ceiling).map((trim) => ({ model, trim }))
      : [],
  );
  const choice = pick(pool, unitFor(state, `${key}:car`));
  if (!choice) return undefined;
  const { model, trim } = choice;
  const classic = model.market === 'classic';
  const year = state.world.year;
  const modelYear = classic
    ? (model.year as number)
    : year - (3 + Math.floor(unitFor(state, `${key}:age`) * 15));
  const history = historyFrom(unitFor(state, `${key}:history`));
  const condition = classic
    ? 50 + Math.round(unitFor(state, `${key}:condition`) * 45)
    : Math.max(
        10,
        Math.min(
          100,
          Math.round(
            expectedCondition(year - modelYear) + (unitFor(state, `${key}:condition`) - 0.5) * 24,
          ),
        ),
      );
  const accident = unitFor(state, `${key}:accident`) < 0.1;
  const value = vehicleValueOf({ model, trim, modelYear, condition, history, accident }, year);
  return {
    kind: 'car',
    id,
    venueId: venue.id,
    name: classic ? vehicleName(model, trim) : `${modelYear} ${vehicleName(model, trim)}`,
    description: `${BODY_LABELS[model.body]}. ${model.blurb}`.trim(),
    estimate: estimateFor(value, credibility, unitFor(state, `${key}:estimate`)),
    value,
    roomTop: roomTopBid(value, `${state.rng.getSeed()}:${key}:room`),
    trimId: trim.id,
    modelYear,
    condition,
    history,
    accident,
    defective: unitFor(state, `${key}:fake`) < CREDIBILITY_EFFECTS[credibility].fakeChance,
  };
}

function unitLot(state: GameState, venue: AuctionVenue, key: string, id: string): UnitLot {
  const u = unitFor(state, `${key}:size`);
  const size: UnitSize = u < 0.45 ? 'small' : u < 0.8 ? 'medium' : 'large';
  const peek = pick(STORAGE_PEEKS[size], unitFor(state, `${key}:peek`)) ?? '';
  const usual = usualPriceFor(size);
  return {
    kind: 'unit',
    id,
    venueId: venue.id,
    name: `${size.charAt(0).toUpperCase()}${size.slice(1)} unit`,
    description: peek,
    estimate: { low: Math.round(usual * 0.85), high: Math.round(usual * 1.15) },
    value: usual,
    roomTop: roomTopBid(
      usual,
      `${state.rng.getSeed()}:${key}:room`,
      STORAGE_ROOM_MEAN,
      STORAGE_ROOM_SPREAD,
    ),
    size,
  };
}

/** The lots of one visit to a venue. Same answer every time it is asked. */
export function lotsFor(state: GameState, venueId: string, visit: number): readonly Lot[] {
  const venue = findAuctionVenue(venueId);
  if (!venue || visit < 1) return [];
  const credibility = credibilityOf(venue, state.world.year);
  const ceiling = Math.max(10_000, shoppingMeansOf(state) * AUCTION_REACH);
  const lots: Lot[] = [];
  for (let slot = 0; slot < venue.lots; slot += 1) {
    const key = `${state.world.year}:${venue.id}:${visit}:${slot}`;
    const id = `lot:${state.world.year}:${venue.id}:${visit}:${slot}`;
    const lot =
      venue.type === 'storage'
        ? unitLot(state, venue, key, id)
        : unitFor(state, `${key}:is-car`) < venue.carShare
          ? (carLot(state, venue, key, id, credibility, ceiling) ??
            valuableLot(state, venue, key, id, credibility, ceiling))
          : valuableLot(state, venue, key, id, credibility, ceiling);
    if (lot) lots.push(lot);
  }
  return lots;
}

/** The sale they are at: the lots of their latest visit this year, or none. */
export const currentLots = (state: GameState, venueId: string): readonly Lot[] =>
  lotsFor(state, venueId, visitsUsed(state, venueId));

export const hasBidOn = (state: GameState, lotId: string): boolean =>
  diaryOf(state).bids.includes(lotId);

/* -------------------------------------------------------------------------- */
/* Going, and bidding                                                          */
/* -------------------------------------------------------------------------- */

export type AttendError = 'no-such-venue' | 'not-open' | 'no-visits-left';

export const ATTEND_ERROR_LABELS: Readonly<Record<AttendError, string>> = {
  'no-such-venue': "There's no sale there.",
  'not-open': "You aren't on their list.",
  'no-visits-left': "That's all their sales for this year.",
};

/** Go to the next sale. Spec 41's limit is counted here, and only here. */
export function attendAuction(state: GameState, venueId: string): Result<GameState, AttendError> {
  const venue = findAuctionVenue(venueId);
  if (!venue) return err('no-such-venue');
  if (!openVenues(state).some((open) => open.id === venueId)) return err('not-open');
  if (visitsLeft(state, venueId) <= 0) return err('no-visits-left');
  const diary = diaryOf(state);
  return ok({
    ...state,
    auctions: {
      ...diary,
      visits: { ...diary.visits, [venueId]: (diary.visits[venueId] ?? 0) + 1 },
    },
  });
}

export type BidError = 'no-such-lot' | 'already-bid' | 'cannot-cover' | PaymentRefusal;

export const BID_ERROR_LABELS: Readonly<Record<BidError, string>> = {
  ...PAYMENT_REFUSAL_LABELS,
  'no-such-lot': "That lot isn't in this sale.",
  'already-bid': 'That one has gone.',
  'cannot-cover': "You couldn't pay that if you won it.",
};

export interface BidOutcome {
  readonly state: GameState;
  readonly won: boolean;
  /** Where the bidding stopped. */
  readonly hammer: number;
  /** What they paid, premium included. Zero if they lost. */
  readonly paid: number;
  /** One sentence for the result card. */
  readonly text: string;
  readonly entry?: TimelineEntry;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

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

const listJunk = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? 'nothing much')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

/**
 * Bid on a lot at the sale they are attending. The ceiling is the tier's
 * reach on the estimate (or, for a storage unit, on what units like it usually
 * go for); the room's top bid was drawn when the lot was. Somebody who
 * couldn't pay their own ceiling isn't allowed to raise a paddle.
 */
export function bidOn(
  state: GameState,
  lotId: string,
  tier: BidTier,
  payment: PurchasePayment = { kind: 'cash' },
): Result<BidOutcome, BidError> {
  const venueId = lotId.split(':')[2] ?? '';
  const venue = findAuctionVenue(venueId);
  const lot = currentLots(state, venueId).find((candidate) => candidate.id === lotId);
  if (!venue || !lot) return err('no-such-lot');
  if (hasBidOn(state, lotId)) return err('already-bid');
  const premium = lot.kind === 'unit' ? STORAGE_PREMIUM : BUYERS_PREMIUM;
  const ceiling = maxBidFor(lot.estimate, tier);
  const refusal = purchaseEligibility(
    state.player.cash,
    state.cards,
    dollars(Math.ceil(ceiling * (1 + premium))),
    payment,
  );
  if (refusal) return err(refusal === 'payment-cash-short' ? 'cannot-cover' : refusal);

  const diary = diaryOf(state);
  const marked: GameState = { ...state, auctions: { ...diary, bids: [...diary.bids, lot.id] } };
  const result = resolveBid(ceiling, lot.roomTop);
  if (!result.won) {
    return ok({
      state: marked,
      won: false,
      hammer: result.hammer,
      paid: 0,
      text: `It went to somebody else for ${money(result.hammer)}.`,
    });
  }
  const paid = Math.round(result.hammer * (1 + premium));
  // The confirmed quote is the ceiling including premium; only the winning price is charged.
  const actualPayment: PurchasePayment =
    payment.kind === 'card' ? { kind: 'card', productId: payment.productId } : { kind: 'cash' };
  const paymentResult = payPurchase(
    state.finance,
    state.cards,
    state.world.year,
    state.player.age,
    dollars(paid),
    'property',
    lot.kind === 'unit' ? `A storage unit at ${venue.name}` : `Won ${lot.name} at ${venue.name}`,
    actualPayment,
  );
  if (!paymentResult.ok) return err(paymentResult.error);
  const charged: GameState = {
    ...marked,
    finance: paymentResult.value.ledger,
    cards: paymentResult.value.cards,
    player: { ...marked.player, cash: paymentResult.value.ledger.balance },
  };
  return ok(
    lot.kind === 'unit'
      ? wonUnit(charged, lot, result.hammer, paid, payment)
      : wonLot(charged, venue, lot, result.hammer, paid, payment),
  );
}

function wonLot(
  state: GameState,
  venue: AuctionVenue,
  lot: ValuableLot | CarLot,
  hammer: number,
  paid: number,
  payment: PurchasePayment,
): BidOutcome {
  const books = { ledger: state.finance };
  let next: GameState = {
    ...state,
    finance: books.ledger,
    player: { ...state.player, cash: books.ledger.balance },
  };
  if (lot.kind === 'valuable') {
    const owned: OwnedValuable = {
      id: lot.id,
      itemId: lot.itemId,
      boughtYear: state.world.year,
      purchasePrice: dollars(paid),
      value: dollars(lot.value),
      ...(lot.fake ? { fake: true } : {}),
    };
    next = { ...next, valuables: [...next.valuables, owned] };
  } else {
    const found = findVehicleTrim(lot.trimId);
    const defect =
      lot.defective && found
        ? defectFor(
            found.model,
            found.trim,
            mixedUnit(`${lot.id}:part`),
            mixedUnit(`${lot.id}:size`),
          )
        : undefined;
    const owned: OwnedVehicle = {
      id: lot.id,
      trimId: lot.trimId,
      modelYear: lot.modelYear,
      boughtYear: state.world.year,
      purchasePrice: dollars(paid),
      value: dollars(lot.value),
      condition: lot.condition,
      history: lot.history,
      accident: lot.accident,
      ...(defect ? { defect } : {}),
      behindYears: 0,
    };
    next = { ...next, vehicles: [...next.vehicles, owned] };
  }
  const legendary = lot.kind === 'valuable' && findValuable(lot.itemId)?.kind === 'mythical';
  const text = legendary
    ? `Won ${lot.name} at ${venue.name} for ${money(paid)}. The room went quiet.`
    : `Won ${lot.name} at ${venue.name} for ${money(paid)}, with the premium.`;
  const entry = line(
    next,
    text + paymentNote(payment),
    `auction:won:${lot.id}`,
    legendary ? 'milestone' : 'passive',
  );
  return {
    state: {
      ...next,
      player: {
        ...next.player,
        timeline: appendToTimeline(next.player.timeline, entry),
        records:
          legendary && lot.kind === 'valuable'
            ? appendRecord(
                next.player.records,
                stampRecord(
                  { category: 'property', label: `Owned ${lot.name}`, referenceId: lot.itemId },
                  next.player.age,
                  next.world.year,
                ),
              )
            : next.player.records,
      },
    },
    won: true,
    hammer,
    paid,
    text: text + paymentNote(payment),
    entry,
  };
}

/** A storage unit's contents: some junk sold off as a lot, and now and then something worth keeping. */
export function contentsOf(
  seed: string,
  lot: UnitLot,
): { readonly junk: readonly string[]; readonly junkValue: number; readonly treasure?: Valuable } {
  const key = `${seed}:${lot.id}`;
  const count = 2 + Math.floor(mixedUnit(`${key}:count`) * 3);
  const junk: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const item = pick(STORAGE_JUNK, mixedUnit(`${key}:junk:${i}`));
    if (item && !junk.includes(item)) junk.push(item);
  }
  const junkValue = junkValueFor(lot.size, `${key}:value`);
  let treasure: Valuable | undefined;
  if (mixedUnit(`${key}:legend`) < STORAGE_LEGEND_CHANCE) {
    treasure = pick(
      VALUABLES.filter((item) => item.kind === 'mythical'),
      mixedUnit(`${key}:which-legend`),
    );
  } else if (mixedUnit(`${key}:treasure`) < UNIT_SIZES[lot.size].treasure) {
    treasure = pick(
      VALUABLES.filter(
        (item) =>
          item.kind !== 'mythical' &&
          item.kind !== 'art' &&
          item.price <= UNIT_SIZES[lot.size].cap &&
          item.holds !== 'fashion',
      ),
      mixedUnit(`${key}:which`),
    );
  }
  return { junk, junkValue, ...(treasure ? { treasure } : {}) };
}

function wonUnit(
  state: GameState,
  lot: UnitLot,
  hammer: number,
  paid: number,
  payment: PurchasePayment,
): BidOutcome {
  const contents = contentsOf(state.rng.getSeed(), lot);
  let books = { ledger: state.finance };
  books = post(books.ledger, state.world.year, state.player.age, {
    category: 'property',
    amount: dollars(contents.junkValue),
    source: 'Sold what was in the storage unit',
  });
  const treasure = contents.treasure;
  const owned: OwnedValuable | undefined = treasure
    ? {
        id: lot.id,
        itemId: treasure.id,
        boughtYear: state.world.year,
        purchasePrice: dollars(0),
        value: dollars(resaleAtPurchase(treasure, treasure.price)),
      }
    : undefined;
  const legendary = treasure?.kind === 'mythical';
  const text =
    `Won a storage unit for ${money(paid)}. Inside: ${listJunk(contents.junk)}, sold off for ${money(contents.junkValue)}.` +
    (treasure
      ? legendary
        ? ` And at the very back, ${articled(treasure)}.`
        : ` And at the back, ${articled(treasure)}, which you kept.`
      : '');
  const next: GameState = {
    ...state,
    finance: books.ledger,
    valuables: owned ? [...state.valuables, owned] : state.valuables,
    player: { ...state.player, cash: books.ledger.balance },
  };
  const entry = line(
    next,
    text + paymentNote(payment),
    `auction:unit:${lot.id}`,
    legendary ? 'milestone' : 'passive',
  );
  return {
    state: {
      ...next,
      player: { ...next.player, timeline: appendToTimeline(next.player.timeline, entry) },
    },
    won: true,
    hammer,
    paid,
    text: text + paymentNote(payment),
    entry,
  };
}

/* -------------------------------------------------------------------------- */
/* Found out                                                                   */
/* -------------------------------------------------------------------------- */

/** The year's lines for fakes an appraiser found: anything that was `fake` and is now a reproduction. */
export function foundOut(
  before: readonly OwnedValuable[],
  after: readonly OwnedValuable[],
): readonly string[] {
  return after
    .filter((piece) => piece.reproduction && before.some((was) => was.id === piece.id && was.fake))
    .map((piece) => {
      const name = findValuable(piece.itemId)?.name ?? 'a piece';
      return `An appraiser looked at the ${name.replace(/^(A|An|The) /, '')}. It's a reproduction.`;
    });
}
