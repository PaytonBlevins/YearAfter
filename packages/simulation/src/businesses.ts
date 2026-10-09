/**
 * Ticket 0601 — businesses.
 *
 * The rules live in `@yearafter/finance`'s `businesses.ts`; this is where they
 * meet a life: what is on the marketplace for somebody with this much, opening
 * one, the choices spec 393 and 400 give an owner (supplier, price, payroll,
 * staff), what a year of it does, asking what it is worth, selling it and
 * closing it.
 *
 * NO DOOR. Nobody passive starts a business. It is a choice a minority make,
 * like landlording (finding 15) and modifying a car, and a systemic offer would
 * ask the question of lives that have never wanted to run anything.
 *
 * DERIVED, NOT STORED. How a year goes is drawn from the seed, the business and
 * the year, so it is the same however often anything asks. A buyer's offer is
 * drawn once a year and an appraiser's range once a year: asking again and again
 * until the number is a good one is not a strategy the game offers.
 */

import {
  appendRecord,
  appendToTimeline,
  createTimelineEntry,
  stampRecord,
  type NewLifeRecord,
  type TimelineEntry,
} from '@yearafter/character';
import { BUSINESS_TYPES, findBusinessType, type BusinessType } from '@yearafter/content';
import { dollars, err, mixedUnit, ok, type Result } from '@yearafter/core';
import type { BusinessRescueCase } from './business-rescue';
import { pruneBusinessRescue } from './business-rescue-state';
import { taxRate } from '@yearafter/careers';
import {
  BUSINESS_ECONOMY_LEDGER_THRESHOLD,
  BUSINESS_ECONOMY_LOSS_THRESHOLD,
  BUSINESS_ECONOMY_GAIN_THRESHOLD,
  BUSINESS_LOAN_PRODUCTS,
  BUSINESS_LOAN_REFUSALS,
  LISTINGS_PER_YEAR,
  MAX_BUSINESSES,
  MINIMUM_LOAN,
  OPEN_FROM_AGE,
  PRICE_STEP,
  PAYROLL_LABELS,
  SUPPLIER_LABELS,
  autoStaffFor,
  branchCostFor,
  branchWindDownOf,
  businessAppraisalFor,
  businessBought,
  businessLoanFor,
  businessLoanOffersFor,
  businessSaleOf,
  businessValueFor,
  businessYear,
  businessEconomyVisible,
  businessEconomyPercent,
  clampPrice,
  hasBusinessPriceControl,
  drawEvent,
  eventLineFor,
  expansionRefusal,
  footprintFor,
  goingConcernFor,
  handsOn,
  listingFor,
  locationAttention,
  locationsOf,
  luckFrom,
  supplierModifiers,
  newBusiness,
  ownerFactor,
  portfolioWorth,
  post,
  reportedProfitOf,
  reputationChangeOf,
  reputationWord,
  rivalAfter,
  runLoanYear,
  settleYear,
  staffCeilingFor,
  startupCostFor,
  totalFor,
  visibleTo,
  yearlyPaymentFor,
  windDownOf,
  withBranch,
  withBusinessLoan,
  withProfit,
  withoutBranch,
  type BusinessAppraisal,
  type BusinessBorrower,
  type BusinessListing,
  type BusinessLoanDecision,
  type BusinessLoanRefusal,
  type BusinessPurchase,
  type BusinessLedgerYear,
  type BusinessSale,
  type ExpandRefusal,
  type NewTransaction,
  type OpenRefusal,
  type HeldLoan,
  type LoanProduct,
  type OwnedBusiness,
  type Payroll,
  type PurchaseKind,
  type SupplierGrade,
} from '@yearafter/finance';
import type { MarketState } from '@yearafter/finance';
import type { GameState } from './game-state';
import { standingFor } from './cards';
import { estateOf } from './investments';
import { otherPaymentsOf } from './vehicles';

/* -------------------------------------------------------------------------- */
/* Small things                                                                */
/* -------------------------------------------------------------------------- */

const money = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

/** A standard normal draw from a stable key (Box–Muller). */
function normalFrom(key: string): number {
  const u1 = Math.max(1e-9, mixedUnit(`${key}:a`));
  const u2 = mixedUnit(`${key}:b`);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** What somebody could put into a business: cash and the portfolio, whole dollars. */
export function liquidOf(state: GameState): number {
  const cash = Number(state.player.cash) / 100;
  const invested = Number(portfolioWorth(state.prices, state.portfolio)) / 100;
  return Math.max(0, Math.floor(cash + invested));
}

/**
 * Everything owned less everything owed, whole dollars. What spec 912's gate
 * reads: a home, a portfolio and a business all count, because a person who
 * owns them is not somebody the list should treat as a beginner.
 */
export function netWorthOf(state: GameState): number {
  const estate = estateOf(state);
  return Math.round(
    (Number(state.player.cash) +
      Number(estate.investments) +
      Number(estate.assets ?? 0) -
      Number(estate.liabilities)) /
      100,
  );
}

/** What spec 912's marketplace shows: nothing tells anybody which "tier" they are. */
export function businessMarket(state: GameState): readonly BusinessType[] {
  if (state.player.age < OPEN_FROM_AGE) return [];
  const worth = netWorthOf(state);
  return [...BUSINESS_TYPES]
    .filter((type) => visibleTo(type, worth))
    .sort((a, b) => a.startup - b.startup);
}

const holdsJob = (state: GameState): boolean => state.employment.job !== undefined;

/** The average of the two stats that help an owner of this kind of business. */
export function averageStat(stats: Readonly<Record<string, number>>, type: BusinessType): number {
  return ((Number(stats[type.skills[0]]) || 50) + (Number(stats[type.skills[1]]) || 50)) / 2;
}

export const statFor = (state: GameState, type: BusinessType): number =>
  averageStat(state.player.stats as unknown as Record<string, number>, type);

export const findBusiness = (state: GameState, id: string): OwnedBusiness | undefined =>
  state.businesses.find((business) => business.id === id);

/** How much of themselves an owner gives to each, across everything they run. */
export const handsFor = (state: GameState): number =>
  handsOn(Math.max(1, state.businesses.length), holdsJob(state));

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

/* -------------------------------------------------------------------------- */
/* Tax                                                                         */
/* -------------------------------------------------------------------------- */

/** An owner pays both halves of the payroll taxes on what a business pays them. */
export const SELF_EMPLOYMENT_TAX = 0.0765;

/**
 * Tax on what a business paid its owner, on top of a wage if they have one: the
 * extra the whole income costs, and the payroll taxes on the business's share.
 * Whole dollars.
 */
export function businessTaxOn(salary: number, drawn: number): number {
  if (drawn <= 0) return 0;
  const whole = salary + drawn;
  const extra = taxRate(whole) * whole - taxRate(salary) * salary;
  return Math.max(0, Math.round(extra + drawn * SELF_EMPLOYMENT_TAX));
}

/* -------------------------------------------------------------------------- */
/* What the screen needs                                                       */
/* -------------------------------------------------------------------------- */

/** Spec 398's Customer Demand, in words. */
export type DemandWord = 'plenty' | 'about right' | 'slow';

export const DEMAND_LABELS: Readonly<Record<DemandWord, string>> = {
  plenty: 'More customers than you can serve',
  'about right': 'About right for what you can serve',
  slow: 'Quiet — the staff are not busy enough',
};

export interface BusinessView {
  readonly business: OwnedBusiness;
  readonly type: BusinessType;
  /** Spec 398's Brand Reputation, in words. */
  readonly reputation: string;
  readonly demand: DemandWord | undefined;
  /** Worth to its owner, whole dollars, till included. */
  readonly worth: number;
  readonly canHire: boolean;
  readonly canLetGo: boolean;
  readonly supplierLabel: string;
  readonly payrollLabel: string;
  /** The owner's share of themselves in it: 1 is all of them. */
  readonly hands: number;
  /** Ticket 0602. How many doors it has, and what another would cost and why not. */
  readonly locations: number;
  readonly branchCost: number;
  readonly expansion: ExpandRefusal | undefined;
  /** The same, ignoring whether there is cash for it: what a loan could not fix. */
  readonly expansionBase: ExpandRefusal | undefined;
  /** Ticket 0603: what is borrowed against it, if anything. */
  readonly loan: BusinessLoanView | undefined;
}

export interface BusinessLoanView {
  readonly name: string;
  readonly apr: number;
  readonly owed: number;
  readonly yearly: number;
  readonly termLeft: number;
  readonly behind: boolean;
}

export function viewOf(state: GameState, business: OwnedBusiness): BusinessView | undefined {
  const type = findBusinessType(business.typeId);
  if (!type) return undefined;
  const last = business.last;
  const demand: DemandWord | undefined = !last
    ? undefined
    : last.turnedAway > 0.1
      ? 'plenty'
      : last.idle > 0.2
        ? 'slow'
        : 'about right';
  return {
    business,
    type,
    reputation: reputationWord(business.reputation),
    demand,
    worth: businessValueFor(business, type, state.world.year),
    canHire: business.staff < staffCeilingFor(type, locationsOf(business)),
    canLetGo: business.staff > type.staffMin * locationsOf(business),
    supplierLabel: SUPPLIER_LABELS[business.supplier],
    payrollLabel: PAYROLL_LABELS[business.payroll],
    hands: handsFor(state),
    locations: locationsOf(business),
    branchCost: branchCostFor(type),
    expansion: expansionRefusal(business, type, state.world.year, Number(state.player.cash) / 100),
    expansionBase: expansionRefusal(business, type, state.world.year, Number.POSITIVE_INFINITY),
    loan: loanViewOf(state, business),
  };
}

function loanViewOf(state: GameState, business: OwnedBusiness): BusinessLoanView | undefined {
  const held = state.loans.find((loan) => loan.businessId === business.id);
  const product = held
    ? BUSINESS_LOAN_PRODUCTS.find((row) => row.id === held.productId)
    : undefined;
  if (!held || !product) return undefined;
  const owed = Math.round(Number(held.balance) / 100);
  return {
    name: product.name,
    apr: product.apr,
    owed,
    yearly: yearlyPaymentFor(product, owed, held.termLeft),
    termLeft: held.termLeft,
    behind: held.inArrears,
  };
}

/** Spec 398's Request Valuation: an appraiser's range, the same for a year. */
export function appraise(state: GameState, id: string): BusinessAppraisal | undefined {
  const business = findBusiness(state, id);
  const type = business ? findBusinessType(business.typeId) : undefined;
  if (!business || !type) return undefined;
  return businessAppraisalFor(
    goingConcernFor(business, type, state.world.year),
    mixedUnit(`${state.rng.getSeed()}:${id}:${state.world.year}:appraisal`),
  );
}

/** What a buyer would pay this year. Drawn once a year per business. */
export function offerFor(state: GameState, id: string): BusinessSale | undefined {
  const business = findBusiness(state, id);
  const type = business ? findBusinessType(business.typeId) : undefined;
  if (!business || !type) return undefined;
  return businessSaleOf(
    business,
    type,
    state.world.year,
    normalFrom(`${state.rng.getSeed()}:${id}:${state.world.year}:offer`),
  );
}

/* -------------------------------------------------------------------------- */
/* Borrowing to buy (ticket 0603)                                              */
/* -------------------------------------------------------------------------- */

/** Wages, commission and a partner's pay last year, whole dollars. What a business paid its owner is counted through the business. */
export function earnedOf(state: GameState): number {
  const year = state.world.year;
  return Math.round(
    (Number(totalFor(state.finance, 'salary', year)) +
      Number(totalFor(state.finance, 'commission', year)) +
      Number(totalFor(state.finance, 'oddJob', year)) +
      Number(totalFor(state.finance, 'partner', year)) +
      // Ticket 0701: what a channel paid, net of keeping it going.
      Math.max(0, Number(totalFor(state.finance, 'creator', year)))) /
      100,
  );
}

/** What the businesses already owned clear in a year, on average, each counted no lower than nothing. */
export function businessProfitOf(state: GameState): number {
  return Math.round(
    state.businesses.reduce((sum, business) => {
      const history = business.profits.filter((profit) => Number.isFinite(profit));
      if (history.length === 0) return sum;
      return sum + Math.max(0, history.reduce((a, b) => a + b, 0) / history.length);
    }, 0),
  );
}

/** What a business lender sees. One place, for the reason `borrowerFrom` gives. */
export function businessBorrowerFrom(state: GameState): BusinessBorrower {
  return {
    standing: standingFor(state).standing,
    age: state.player.age,
    earned: earnedOf(state),
    businessProfit: businessProfitOf(state),
    obligations: otherPaymentsOf(state),
  };
}

export interface FinancingOffer {
  readonly product: LoanProduct;
  readonly decision: BusinessLoanDecision;
}

function purchaseFor(
  state: GameState,
  kind: PurchaseKind,
  cost: number,
  targetProfit: number,
  businessId?: string,
): BusinessPurchase {
  const held = businessId ? state.loans.find((loan) => loan.businessId === businessId) : undefined;
  return {
    kind,
    cost,
    targetProfit,
    ...(held && businessId ? { topUp: { businessId, productId: held.productId } } : {}),
  };
}

const offersFor = (state: GameState, purchase: BusinessPurchase): readonly FinancingOffer[] =>
  businessLoanOffersFor(purchase, businessBorrowerFrom(state));

/** What a lender would put up for opening this type, today. */
export function openingOffers(state: GameState, typeId: string): readonly FinancingOffer[] {
  const type = findBusinessType(typeId);
  return type ? offersFor(state, purchaseFor(state, 'open', startupCostFor(type), 0)) : [];
}

/** ...for another location of one already owned. */
export function expansionOffers(state: GameState, id: string): readonly FinancingOffer[] {
  const business = findBusiness(state, id);
  const type = business ? findBusinessType(business.typeId) : undefined;
  return business && type
    ? offersFor(state, purchaseFor(state, 'expand', branchCostFor(type), 0, id))
    : [];
}

/** ...for a business that is for sale. */
export function purchaseOffers(state: GameState, listingId: string): readonly FinancingOffer[] {
  const listing = businessesForSale(state).find((row) => row.id === listingId);
  return listing
    ? offersFor(state, purchaseFor(state, 'buy', listing.ask, reportedProfitOf(listing)))
    : [];
}

/** How much to borrow, and from whom. The amount is the decision (see `takeLoan`). */
export interface Financing {
  readonly productId: string;
  readonly amount: number;
}

export type FinanceError = BusinessLoanRefusal | 'no-such-product';

export const FINANCE_ERROR_LABELS: Readonly<Record<FinanceError, string>> = {
  ...BUSINESS_LOAN_REFUSALS,
  'no-such-product': "That isn't a loan anybody offers.",
};

interface Borrowed {
  readonly ledger: GameState['finance'];
  readonly loans: GameState['loans'];
  readonly amount: number;
  readonly product?: LoanProduct;
}

/**
 * The loan, written straight into a purchase: the money is booked as borrowed
 * and spent in the same breath, so it never sits in cash. A request for more
 * than the lender offered is brought down to the offer, as `takeLoan` does.
 */
function borrowed(
  state: GameState,
  purchase: BusinessPurchase,
  businessId: string,
  source: string,
  finance: Financing | undefined,
): Result<Borrowed, FinanceError> {
  const none: Borrowed = { ledger: state.finance, loans: state.loans, amount: 0 };
  if (!finance || finance.amount <= 0) return ok(none);
  const product = BUSINESS_LOAN_PRODUCTS.find((row) => row.id === finance.productId);
  if (!product) return err('no-such-product');
  const decision = businessLoanFor(product, purchase, businessBorrowerFrom(state));
  if (!decision.approved) return err(decision.because ?? 'cover');
  const amount = Math.floor(Math.min(Math.round(finance.amount), decision.offered));
  if (amount < MINIMUM_LOAN) return err('tooSmall');
  const books = post(state.finance, state.world.year, state.player.age, {
    category: 'debt',
    amount: dollars(amount),
    source: `${product.name} — ${source}`,
  });
  return ok({
    ledger: books.ledger,
    loans: withBusinessLoan(state.loans, product, businessId, amount),
    amount,
    product,
  });
}

/**
 * What a lender is owed when a business goes: paid out of what the sale or the
 * wind-down brings, before the owner sees any of it. Whatever is left unpaid
 * stays owed.
 */
function settledOnExit(
  state: GameState,
  ledger: GameState['finance'],
  businessId: string,
  proceeds: number,
): {
  readonly ledger: GameState['finance'];
  readonly loans: GameState['loans'];
  readonly paid: number;
} {
  const held = state.loans.find((loan) => loan.businessId === businessId);
  if (!held || proceeds <= 0) return { ledger, loans: state.loans, paid: 0 };
  const owed = Math.round(Number(held.balance) / 100);
  const paid = Math.min(owed, proceeds);
  if (paid <= 0) return { ledger, loans: state.loans, paid: 0 };
  const product = BUSINESS_LOAN_PRODUCTS.find((row) => row.id === held.productId);
  const books = post(ledger, state.world.year, state.player.age, {
    category: 'debt',
    amount: dollars(-paid),
    source: `${product?.name ?? 'Business loan'} — settled on the sale`,
  });
  return {
    ledger: books.ledger,
    loans:
      paid >= owed
        ? state.loans.filter((loan) => loan !== held)
        : state.loans.map((loan) =>
            loan === held ? { ...loan, balance: dollars(owed - paid) } : loan,
          ),
    paid,
  };
}

/* -------------------------------------------------------------------------- */
/* Opening                                                                     */
/* -------------------------------------------------------------------------- */

export interface OpenedBusiness {
  readonly state: GameState;
  readonly business: OwnedBusiness;
  readonly entry: TimelineEntry;
}

/** A name from the type's pool that nothing owned is already using. */
function nameFor(state: GameState, type: BusinessType): string {
  const taken = new Set(state.businesses.map((business) => business.name));
  const start = Math.floor(
    mixedUnit(
      `${state.rng.getSeed()}:${type.id}:${state.world.year}:${state.businesses.length}:name`,
    ) * type.names.length,
  );
  for (let step = 0; step < type.names.length; step += 1) {
    const candidate = type.names[(start + step) % type.names.length]!;
    if (!taken.has(candidate)) return candidate;
  }
  return `${type.names[start]!} II`;
}

export function openBusiness(
  state: GameState,
  typeId: string,
  finance?: Financing,
): Result<OpenedBusiness, OpenRefusal | FinanceError> {
  const type = findBusinessType(typeId);
  if (!type || !businessMarket(state).some((row) => row.id === type.id)) {
    return state.player.age < OPEN_FROM_AGE ? err('too-young') : err('no-such-type');
  }
  if (state.businesses.length >= MAX_BUSINESSES) return err('too-many');
  const cost = startupCostFor(type);

  const name = nameFor(state, type);
  const id = `biz:${state.world.year}:${type.id.replace('biz.', '')}:${state.businesses.length}`;
  const loan = borrowed(state, purchaseFor(state, 'open', cost, 0), id, `to open ${name}`, finance);
  if (!loan.ok) return err(loan.error);
  if (Number(state.player.cash) / 100 + loan.value.amount < cost) return err('cannot-afford');

  const luck = luckFrom(normalFrom(`${state.rng.getSeed()}:${id}:luck`));
  const business = newBusiness(type, id, name, state.world.year, luck);

  const books = post(loan.value.ledger, state.world.year, state.player.age, {
    category: 'property',
    amount: dollars(-cost),
    source: `Opened ${name}`,
  });
  const first =
    state.businesses.length === 0 && !state.player.records.some((r) => r.category === 'business');
  const entry = line(
    state,
    `Opened ${name}, a ${type.name.toLowerCase()}. It took ${money(cost)} to open the doors${
      loan.value.amount > 0 ? `, ${money(loan.value.amount)} of it borrowed` : ''
    }.`,
    `biz:opened:${id}`,
    'milestone',
  );
  const next: GameState = {
    ...state,
    finance: books.ledger,
    loans: loan.value.loans,
    businesses: [...state.businesses, business],
    player: {
      ...state.player,
      cash: books.ledger.balance,
      timeline: appendToTimeline(state.player.timeline, entry),
      records: appendRecord(
        state.player.records,
        stampRecord(
          {
            category: 'business',
            label: first ? `Opened a first business — ${name}` : `Opened ${name}`,
            referenceId: type.id,
          },
          state.player.age,
          state.world.year,
        ),
      ),
    },
  };
  return ok({ state: next, business, entry });
}

/* -------------------------------------------------------------------------- */
/* An owner's choices                                                          */
/* -------------------------------------------------------------------------- */

export type ChoiceError = 'no-such-business' | 'no-such-choice' | 'at-limit' | 'market-priced';

const patch = (
  state: GameState,
  id: string,
  change: (business: OwnedBusiness, type: BusinessType) => OwnedBusiness | ChoiceError,
): Result<GameState, ChoiceError> => {
  const business = findBusiness(state, id);
  const type = business ? findBusinessType(business.typeId) : undefined;
  if (!business || !type) return err('no-such-business');
  const changed = change(business, type);
  if (typeof changed === 'string') return err(changed);
  return ok({
    ...state,
    businesses: state.businesses.map((row) => (row.id === id ? changed : row)),
  });
};

/** Spec 400's slider. */
export const setPrice = (state: GameState, id: string, price: number) =>
  patch(state, id, (business, type) =>
    hasBusinessPriceControl(type.id) ? { ...business, price: clampPrice(price) } : 'market-priced',
  );

export const nudgePrice = (state: GameState, id: string, steps: number) =>
  patch(state, id, (business, type) =>
    hasBusinessPriceControl(type.id)
      ? {
          ...business,
          price: clampPrice(business.price + steps * PRICE_STEP),
        }
      : 'market-priced',
  );

/** P12: deprecated grade setter cannot bypass the named pitch acceptance command. */
export const setSupplier = (
  state: GameState,
  id: string,
  _supplier: SupplierGrade,
): Result<GameState, ChoiceError> => patch(state, id, () => 'no-such-choice');

/** Spec 393's Low / Medium / High / Big Bucks. */
export const setPayroll = (state: GameState, id: string, payroll: Payroll) =>
  patch(state, id, (business) => ({ ...business, payroll }));

/** Spec 404: manual hiring. It turns the manager off — the owner is running it now. */
export const hireStaff = (state: GameState, id: string) =>
  patch(state, id, (business, type) =>
    business.staff >= staffCeilingFor(type, locationsOf(business))
      ? 'at-limit'
      : { ...business, staff: business.staff + 1, autoStaff: false },
  );

/** Spec 404: manual firing. Never below what the doors need. */
export const letStaffGo = (state: GameState, id: string) =>
  patch(state, id, (business, type) =>
    business.staff <= type.staffMin * locationsOf(business)
      ? 'at-limit'
      : { ...business, staff: business.staff - 1, autoStaff: false },
  );

export const setAutoStaff = (state: GameState, id: string, on: boolean) =>
  patch(state, id, (business) => ({ ...business, autoStaff: on }));

/* -------------------------------------------------------------------------- */
/* Expanding (ticket 0602)                                                     */
/* -------------------------------------------------------------------------- */

export type ExpandError = ExpandRefusal | FinanceError | 'no-such-business';

export interface Expanded {
  readonly state: GameState;
  readonly entry: TimelineEntry;
}

/** Open another door: its own fittings, its own crew, a name already known. A transfer, not an expense. */
export function expandBusiness(
  state: GameState,
  id: string,
  finance?: Financing,
): Result<Expanded, ExpandError> {
  const business = findBusiness(state, id);
  const type = business ? findBusinessType(business.typeId) : undefined;
  if (!business || !type) return err('no-such-business');
  // Everything but the money first, so a loan is asked about only for something that could happen.
  const refusal = expansionRefusal(business, type, state.world.year, Number.POSITIVE_INFINITY);
  if (refusal) return err(refusal);

  const cost = branchCostFor(type);
  const loan = borrowed(
    state,
    purchaseFor(state, 'expand', cost, 0, id),
    id,
    `to open another ${business.name}`,
    finance,
  );
  if (!loan.ok) return err(loan.error);
  if (Number(state.player.cash) / 100 + loan.value.amount < cost) return err('cannot-afford');

  const books = post(loan.value.ledger, state.world.year, state.player.age, {
    category: 'property',
    amount: dollars(-cost),
    source: `Opened another ${business.name}`,
  });
  const grown = withBranch(business, type, state.world.year);
  const entry = line(
    state,
    `Opened another location of ${business.name}. It took ${money(cost)} to fit out and staff${
      loan.value.amount > 0 ? `, ${money(loan.value.amount)} of it borrowed` : ''
    }.`,
    `biz:expanded:${business.id}:${grown.branches.length}`,
    'milestone',
  );
  return ok({
    state: {
      ...state,
      finance: books.ledger,
      loans: loan.value.loans,
      businesses: state.businesses.map((row) => (row.id === id ? grown : row)),
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
    entry,
  });
}

export interface ClosedLocation {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  readonly proceeds: number;
}

/** Close the newest location: its fittings go for a fraction, and the business shrinks to fit. */
export function closeLocation(
  state: GameState,
  id: string,
): Result<ClosedLocation, 'no-such-business' | 'only-one'> {
  const business = findBusiness(state, id);
  const type = business ? findBusinessType(business.typeId) : undefined;
  if (!business || !type) return err('no-such-business');
  if (locationsOf(business) <= 1) return err('only-one');
  const proceeds = branchWindDownOf(business, type, state.world.year);
  const books =
    proceeds > 0
      ? post(state.finance, state.world.year, state.player.age, {
          category: 'property',
          amount: dollars(proceeds),
          source: `Closed a location of ${business.name}`,
        })
      : { ledger: state.finance };
  const shrunk = withoutBranch(business, type);
  const entry = line(
    state,
    `Closed a location of ${business.name}.${proceeds > 0 ? ` The fittings brought ${money(proceeds)}.` : ''}`,
    `biz:shrunk:${business.id}:${shrunk.branches.length}`,
    'milestone',
  );
  return ok({
    state: {
      ...state,
      finance: books.ledger,
      businesses: state.businesses.map((row) => (row.id === id ? shrunk : row)),
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
      },
    },
    entry,
    proceeds,
  });
}

/* -------------------------------------------------------------------------- */
/* Businesses for sale (ticket 0603)                                           */
/* -------------------------------------------------------------------------- */

/** A name from the type's pool that is not on a business already owned. */
function listedNameFor(state: GameState, type: BusinessType, key: string): string {
  const taken = new Set(state.businesses.map((business) => business.name));
  const start = Math.floor(mixedUnit(`${key}:name`) * type.names.length);
  for (let step = 0; step < type.names.length; step += 1) {
    const candidate = type.names[(start + step) % type.names.length]!;
    if (!taken.has(candidate)) return candidate;
  }
  return `${type.names[start]!} II`;
}

/**
 * What is for sale this year. Drawn from the seed and the year, so the same
 * four businesses are there however often anybody looks; a different four next
 * year. Cheaper kinds come up more often than dear ones, because there are
 * more people selling a bin-cleaning round than a resort. Which kinds can come
 * up follows the same gate as opening (spec 912).
 */
export function businessesForSale(state: GameState): readonly BusinessListing[] {
  const pool = businessMarket(state);
  if (pool.length === 0) return [];
  const seed = state.rng.getSeed();
  const year = state.world.year;
  const owned = new Set(state.businesses.map((business) => business.id));
  const listings: BusinessListing[] = [];
  for (let n = 0; n < LISTINGS_PER_YEAR; n += 1) {
    const key = `${seed}:sale:${year}:${n}`;
    const type =
      pool[Math.min(pool.length - 1, Math.floor(mixedUnit(`${key}:type`) ** 1.6 * pool.length))]!;
    const id = `biz:${year}:${type.id.replace('biz.', '')}:for${n}`;
    // Bought already: it is no longer for sale.
    if (owned.has(id)) continue;
    listings.push(
      listingFor(type, id, listedNameFor(state, type, key), year, {
        age: mixedUnit(`${key}:age`),
        doors: mixedUnit(`${key}:doors`),
        reputation: mixedUnit(`${key}:reputation`),
        premium: mixedUnit(`${key}:premium`),
        dressing: mixedUnit(`${key}:dressing`),
        luck: normalFrom(`${key}:luck`),
        trend: normalFrom(`${key}:trend`),
        noise: [normalFrom(`${key}:n0`), normalFrom(`${key}:n1`), normalFrom(`${key}:n2`)],
      }),
    );
  }
  return listings;
}

/** An appraiser's range on a business that is for sale: the same one for the whole year. */
export function appraiseListing(state: GameState, listing: BusinessListing): BusinessAppraisal {
  return businessAppraisalFor(
    listing.worth,
    mixedUnit(`${state.rng.getSeed()}:${listing.id}:${state.world.year}:appraisal`),
  );
}

export type BuyRefusal =
  'too-young' | 'too-many' | 'cannot-afford' | 'no-such-listing' | FinanceError;

export const BUY_REFUSAL_LABELS: Readonly<Record<BuyRefusal, string>> = {
  'too-young': "You're too young to buy a business.",
  'too-many': "You can't run more than three at once.",
  'cannot-afford': "You don't have enough to buy it.",
  'no-such-listing': "That one isn't for sale any more.",
  ...FINANCE_ERROR_LABELS,
};

export function buyBusiness(
  state: GameState,
  listingId: string,
  finance?: Financing,
): Result<OpenedBusiness, BuyRefusal> {
  if (state.player.age < OPEN_FROM_AGE) return err('too-young');
  if (state.businesses.length >= MAX_BUSINESSES) return err('too-many');
  const listing = businessesForSale(state).find((row) => row.id === listingId);
  const type = listing ? findBusinessType(listing.typeId) : undefined;
  if (!listing || !type) return err('no-such-listing');

  const loan = borrowed(
    state,
    purchaseFor(state, 'buy', listing.ask, reportedProfitOf(listing)),
    listing.id,
    `to buy ${listing.name}`,
    finance,
  );
  if (!loan.ok) return err(loan.error);
  if (Number(state.player.cash) / 100 + loan.value.amount < listing.ask)
    return err('cannot-afford');

  const business = businessBought(listing);
  const books = post(loan.value.ledger, state.world.year, state.player.age, {
    category: 'property',
    amount: dollars(-listing.ask),
    source: `Bought ${listing.name}`,
  });
  const first =
    state.businesses.length === 0 && !state.player.records.some((r) => r.category === 'business');
  const entry = line(
    state,
    `Bought ${listing.name}, a ${type.name.toLowerCase()} that had been trading for ${listing.years} years, for ${money(listing.ask)}${
      loan.value.amount > 0 ? `, ${money(loan.value.amount)} of it borrowed` : ''
    }.`,
    `biz:bought:${listing.id}`,
    'milestone',
  );
  return ok({
    state: {
      ...state,
      finance: books.ledger,
      loans: loan.value.loans,
      businesses: [...state.businesses, business],
      player: {
        ...state.player,
        cash: books.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
        records: appendRecord(
          state.player.records,
          stampRecord(
            {
              category: 'business',
              label: first ? `Bought a first business — ${listing.name}` : `Bought ${listing.name}`,
              referenceId: type.id,
            },
            state.player.age,
            state.world.year,
          ),
        ),
      },
    },
    business,
    entry,
  });
}

/* -------------------------------------------------------------------------- */
/* Selling and closing                                                         */
/* -------------------------------------------------------------------------- */

export interface LeftBusiness {
  readonly state: GameState;
  readonly entry: TimelineEntry;
  readonly proceeds: number;
  /** What went to a lender first, whole dollars. */
  readonly repaid: number;
}

function without(state: GameState, id: string): readonly OwnedBusiness[] {
  return state.businesses.filter((business) => business.id !== id);
}

function parted(
  state: GameState,
  business: OwnedBusiness,
  type: BusinessType,
  proceeds: number,
  source: string,
  text: string,
  key: string,
  label: string,
): LeftBusiness {
  const sold =
    proceeds > 0
      ? post(state.finance, state.world.year, state.player.age, {
          category: 'property',
          amount: dollars(proceeds),
          source,
        }).ledger
      : state.finance;
  // A lender is paid out of the proceeds, first (ticket 0603).
  const settled = settledOnExit(state, sold, business.id, proceeds);
  const entry = line(
    state,
    settled.paid > 0 ? `${text} ${money(settled.paid)} of it went to the bank.` : text,
    key,
    'milestone',
  );
  return {
    state: pruneBusinessRescue({
      ...state,
      finance: settled.ledger,
      loans: settled.loans,
      businesses: without(state, business.id),
      player: {
        ...state.player,
        cash: settled.ledger.balance,
        timeline: appendToTimeline(state.player.timeline, entry),
        records: appendRecord(
          state.player.records,
          stampRecord(
            { category: 'business', label, referenceId: type.id },
            state.player.age,
            state.world.year,
          ),
        ),
      },
    }),
    entry,
    proceeds,
    repaid: settled.paid,
  };
}

/** Spec 398's sale: a buyer's offer, less the broker, with the till handed over. */
export function sellBusiness(
  state: GameState,
  id: string,
): Result<LeftBusiness, 'no-such-business'> {
  const business = findBusiness(state, id);
  const type = business ? findBusinessType(business.typeId) : undefined;
  const sale = business ? offerFor(state, id) : undefined;
  if (!business || !type || !sale) return err('no-such-business');
  return ok(
    parted(
      state,
      business,
      type,
      sale.proceeds,
      `Sold ${business.name}`,
      `Sold ${business.name} for ${money(sale.price)}. After the broker, ${money(sale.proceeds)} came to you.`,
      `biz:sold:${business.id}`,
      `Sold ${business.name}`,
    ),
  );
}

/** Closing the doors: the fittings go for a fraction, and what is in the till is yours. */
export function closeBusiness(
  state: GameState,
  id: string,
): Result<LeftBusiness, 'no-such-business'> {
  const business = findBusiness(state, id);
  const type = business ? findBusinessType(business.typeId) : undefined;
  if (!business || !type) return err('no-such-business');
  const proceeds = Math.max(
    0,
    windDownOf(business, type, state.world.year) + Math.min(0, Number(business.cash) / 100),
  );
  return ok(
    parted(
      state,
      business,
      type,
      proceeds,
      `Closed ${business.name}`,
      `Closed ${business.name}. The fittings and what was in the till came to ${money(proceeds)}.`,
      `biz:closed:${business.id}`,
      `Closed ${business.name}`,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* A year of owning                                                            */
/* -------------------------------------------------------------------------- */

export interface BusinessesYearInput {
  readonly businesses: readonly OwnedBusiness[];
  /** Every loan the household holds. The business loans among them are serviced here (ticket 0603). */
  readonly loans?: readonly HeldLoan[];
  readonly year: number;
  readonly seed: string;
  readonly market: MarketState;
  /** Legacy measurement input, whole dollars. P1 never spends it automatically. */
  readonly available: number;
  readonly holdsJob: boolean;
  readonly stat: (type: BusinessType) => number;
}

export interface BusinessesYear {
  readonly businesses: readonly OwnedBusiness[];
  readonly transactions: readonly NewTransaction[];
  readonly lines: readonly string[];
  readonly records: readonly NewLifeRecord[];
  /** Paid out to the owner, whole dollars, before tax. */
  readonly drawn: number;
  /** Ticket 0603. The loans after the businesses that hold them have paid what they owed. */
  readonly loans: readonly HeldLoan[];
  /** The businesses whose loan was serviced here, and so is not the household's to service as well. */
  readonly serviced: readonly string[];
  readonly rescues: readonly BusinessRescueCase[];
}

/**
 * The year of every business: what it sold, what it cost, what was left, where
 * that went. A loss comes out of the till. P1 holds a shortfall for the owner to answer.
 */
export function runBusinessesYear(input: BusinessesYearInput): BusinessesYear {
  if (input.businesses.length === 0) {
    return {
      businesses: [],
      transactions: [],
      lines: [],
      records: [],
      drawn: 0,
      loans: input.loans ?? [],
      serviced: [],
      rescues: [],
    };
  }
  let loans: readonly HeldLoan[] = input.loans ?? [];
  const serviced: string[] = [];
  const transactions: NewTransaction[] = [];
  const lines: string[] = [];
  const records: NewLifeRecord[] = [];
  const next: OwnedBusiness[] = [];
  const rescues: BusinessRescueCase[] = [];
  let drawnTotal = 0;
  const hands = handsOn(input.businesses.length, input.holdsJob);

  for (const business of input.businesses) {
    const type = findBusinessType(business.typeId);
    if (!type) {
      next.push(business);
      continue;
    }
    /*
      Ticket 0604. Something may have happened to it this year. Drawn from the
      business's own key, so the same year is the same year however many times
      it is played, and one business's news does not move another's. The first
      year is a part-year and is not played, so nothing happens in it.
    */
    const age = input.year - business.openedYear - 1;
    const key = `${input.seed}:${business.id}:${input.year}:event`;
    const happened =
      age < 0
        ? undefined
        : drawEvent(
            type,
            { year: input.year, market: input.market, age, rival: business.rival },
            {
              happens: mixedUnit(`${key}:happens`),
              pick: mixedUnit(`${key}:pick`),
              size: mixedUnit(`${key}:size`),
            },
          );
    const result = businessYear(business, type, {
      year: input.year,
      market: input.market,
      shock: normalFrom(`${input.seed}:${business.id}:${input.year}:shock`),
      stat: input.stat(type),
      hands,
      modifiers: supplierModifiers(business, happened),
    });
    const rival = rivalAfter(business.rival, happened, type, input.year, mixedUnit(`${key}:bite`));
    const reputation = Math.max(0, Math.min(100, result.reputation + reputationChangeOf(happened)));
    const cash = Number(business.cash) / 100;

    // P1: service from the till only. Quote the fully paid result now, so answering
    // a rescue cannot accrue a second year's interest or reroll anything.
    const held = loans.find((loan) => loan.businessId === business.id);
    const onHand = Math.max(0, Math.round(cash + result.profit));
    const servicedYear = held ? runLoanYear([held], onHand, false) : undefined;
    const fundedYear = held ? runLoanYear([held], Number.MAX_SAFE_INTEGER, false) : undefined;
    const paid = servicedYear
      ? Math.round(
          servicedYear.charges.reduce((sum, charge) => sum - Number(charge.amount), 0) / 100,
        )
      : 0;
    const due = fundedYear
      ? Math.round(fundedYear.charges.reduce((sum, charge) => sum - Number(charge.amount), 0) / 100)
      : 0;
    const loanGap = Math.max(0, due - paid);
    const settled = settleYear(cash, result.profit - paid, result.costs);
    const needsReview = settled.needed > 0 || loanGap > 0;
    const drawn = needsReview ? 0 : settled.drawn;
    const till = needsReview ? cash + result.profit - paid : settled.cash;
    if (needsReview) {
      const amount = settled.needed + Math.max(0, loanGap - Math.max(0, till));
      rescues.push({
        businessId: business.id,
        amount,
        loanPayment: loanGap,
        ...(held && loanGap > 0
          ? {
              loanProductId: held.productId,
              loanBalance: Number(servicedYear!.loans[0]!.balance),
              ...(fundedYear!.loans[0] ? { fundedLoan: fundedYear!.loans[0] } : {}),
            }
          : {}),
      });
      lines.push(
        `${business.name} needs ${money(amount)} to carry on. You have a decision to make.`,
      );
    }
    if (drawn > 0) {
      transactions.push({
        category: 'business',
        amount: dollars(drawn),
        source: `${business.name} — profit`,
      });
      drawnTotal += drawn;
    }
    if (held && servicedYear) {
      loans = [...loans.filter((loan) => loan !== held), ...servicedYear.loans];
      serviced.push(business.id);
      if (servicedYear.settled.length > 0) lines.push(`${business.name} paid off its loan.`);
    }

    const locations = locationsOf(business);
    const growth =
      footprintFor(business, type, input.year + 1) /
      Math.max(0.01, footprintFor(business, type, input.year));
    const staff = business.autoStaff
      ? autoStaffFor(
          type,
          business.staff,
          result,
          growth,
          hands * locationAttention(locations),
          locations,
        )
      : business.staff;
    const last: BusinessLedgerYear = {
      year: input.year,
      revenue: result.revenue,
      costs: result.costs,
      profit: result.profit,
      drawn,
      injected: 0,
      turnedAway: result.turnedAway,
      idle: result.idle,
      ...(paid > 0 ? { repaid: paid } : {}),
      ...(happened ? { event: happened.event.id } : {}),
      ...(businessEconomyVisible(result.economy, BUSINESS_ECONOMY_LEDGER_THRESHOLD)
        ? { economy: result.economy }
        : {}),
      ...(result.rivalTook > 0 ? { rivalTook: result.rivalTook } : {}),
    };
    const { rival: _was, ...bare } = business;
    next.push({
      ...bare,
      ...(rival ? { rival } : {}),
      cash: dollars(Math.round(till)),
      invested: business.invested,
      staff,
      reputation,
      profits: withProfit(business.profits, result.profit),
      last,
    });

    if (happened) lines.push(eventLineFor(happened.event, business.name));
    if (result.economy <= 1 - BUSINESS_ECONOMY_LOSS_THRESHOLD) {
      lines.push(
        `The downturn took about ${businessEconomyPercent(result.economy)}% of ${business.name}'s custom.`,
      );
    } else if (result.economy >= 1 + BUSINESS_ECONOMY_GAIN_THRESHOLD) {
      lines.push(`The good economy sent more custom ${business.name}'s way.`);
    }

    const roll = mixedUnit(`${input.seed}:${business.id}:${input.year}:line`);
    if (needsReview) continue;
    if (result.profit < 0) {
      lines.push(
        `${business.name} lost ${money(result.profit)} this year, out of its own savings.`,
      );
    } else if (drawn > 0) {
      lines.push(
        roll < 0.5
          ? `${business.name} had a year. It paid you ${money(drawn)}.`
          : `${business.name} cleared ${money(result.profit)}, and ${money(drawn)} of it came to you.`,
      );
    } else {
      lines.push(`${business.name} made ${money(result.profit)} and kept it in the till.`);
    }
  }
  return {
    businesses: next,
    transactions,
    lines,
    records,
    drawn: drawnTotal,
    loans,
    serviced,
    rescues,
  };
}

/** The owner's knack, for a screen that wants to say whether they are good at this. */
export const knackOf = (state: GameState, type: BusinessType): number =>
  ownerFactor(statFor(state, type), handsFor(state));
