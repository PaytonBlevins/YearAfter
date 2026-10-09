/**
 * Ticket 0501 — owning the place you live in.
 *
 * WHY HOMES COME FIRST IN v0.05, measured before a line was written (150 played
 * lives, see `claude/v005-ownership-measurement.md`):
 *
 *   cash plus portfolio, median     $21k at 25, $14k at 30, $9k at 45, $20k at 55
 *   the roof, median, a year        $18k at 25, $23k at 30, $29k at 45
 *
 * The median character holds almost nothing at any age, and the single largest
 * thing they pay for every year of their adult life is a roof that is gone the
 * moment it is paid for. That is what renting is, and in this build it was the
 * only thing there was. For most real households the house is the savings
 * account — the mortgage is what turns rent into something they own at the
 * end. Nothing in the game could do that, so nothing in the game could make
 * an ordinary life end with anything in it.
 *
 * WHAT THIS FILE IS. Pure rules, no state and no randomness: the mortgage
 * products and their underwriting, what a year of owning a home costs, what it
 * is worth, and what selling it returns. `simulation/homes.ts` decides when
 * those things happen.
 *
 * WHAT IT DELIBERATELY IS NOT. No primary-residence mechanic (spec 153–154
 * removes it by name): a character who owns a home lives in it, and nothing
 * asks which. No insurance and no HOA (spec 151): one annual expense. No
 * monthly figures on a listing (spec 149–150). Renting homes out is 0503,
 * in `rental.ts`; what it adds here is the `letting` on a home and the
 * investment mortgage.
 */

import { cents, dollars, type Money } from '@yearafter/core';
import type { CreditStanding } from './credit';
import { atLeast } from './credit';
import type { Letting } from './rental';
import { findRenovation } from '@yearafter/content';

/* -------------------------------------------------------------------------- */
/* What a home is                                                              */
/* -------------------------------------------------------------------------- */

/** Spec 145 lists condition among what a listing shows. Four words, no score. */
export const HOME_CONDITIONS = ['poor', 'fair', 'good', 'excellent'] as const;
export type HomeCondition = (typeof HOME_CONDITIONS)[number];

export const HOME_CONDITION_LABELS: Readonly<Record<HomeCondition, string>> = {
  poor: 'Needs work',
  fair: 'Lived in',
  good: 'Good',
  excellent: 'Like new',
};

/** What condition does to the price. */
export const CONDITION_PRICE: Readonly<Record<HomeCondition, number>> = {
  poor: 0.82,
  fair: 0.93,
  good: 1,
  excellent: 1.08,
};

/** And to the upkeep. A house that needs work costs more to keep standing. */
export const CONDITION_UPKEEP: Readonly<Record<HomeCondition, number>> = {
  poor: 1.35,
  fair: 1.12,
  good: 1,
  excellent: 0.92,
};

/**
 * How a region's cost of living becomes a price.
 *
 * SQUARED, because houses are where a place's cost is concentrated: a city that
 * is 55% dearer to live in is not 55% dearer to buy in, it is two or three
 * times. At 1.55 (New York) a starter condo lands around $450,000–$800,000; at
 * 0.80 around $120,000–$210,000. Both are the right order of magnitude.
 */
export const PRICE_ELASTICITY = 2;
export const priceIndexFor = (regionCostIndex: number): number =>
  Math.max(0.2, regionCostIndex) ** PRICE_ELASTICITY;

export interface Mortgage {
  readonly productId: string;
  readonly principal: Money;
  readonly balance: Money;
  /** Years left to run. */
  readonly termLeft: number;
}

export interface OwnedHome {
  /** Stable forever: `home:<year>:<slot>`, from the listing it was bought as. */
  readonly id: string;
  readonly kindId: string;
  readonly beds: number;
  readonly baths: number;
  readonly builtYear: number;
  readonly condition: HomeCondition;
  /** Where it is — a state/region key and the name to show. */
  readonly regionKey: string;
  readonly regionName: string;
  readonly purchasePrice: Money;
  readonly boughtYear: number;
  /** What it is worth now. Moves every year; never shown on a listing. */
  readonly value: Money;
  /** The share of value a year costs to keep, from the kind. */
  readonly expenseRate: number;
  readonly mortgage?: Mortgage;
  /**
   * Consecutive years the household could not meet the year while owning it.
   * `FORECLOSE_AFTER` of them and the house goes. On the HOME, not the
   * mortgage: a paid-off house can still cost more than a pension carries, and
   * the first version tracked only mortgaged ones — so 22% of years past
   * sixty-five were short, forever, for owners of houses nobody would sell.
   */
  readonly behindYears: number;
  /**
   * Ticket 0503. Present when the place is let: its rent setting, whether an
   * agent runs it, and who lives in each unit. A duplex or an apartment
   * building always has one; a house has one only while the character rents
   * it out, and a house with none is where they live.
   */
  readonly letting?: Letting;
  /**
   * Ticket 0506. What has been done to it, one per group (spec 1327: an owned
   * home shows its renovations). Absent on a home nobody has touched.
   */
  readonly renovations?: readonly HomeRenovation[];
}

/** Ticket 0506. One renovation on one home. */
export interface HomeRenovation {
  readonly renovationId: string;
  /** Whole dollars paid. */
  readonly cost: number;
  /** The world year it was done. */
  readonly year: number;
}

export const EMPTY_HOMES: readonly OwnedHome[] = [];

/**
 * What a year of keeping it costs, whole dollars. Spec 145's "estimated annual
 * expense". Ticket 0506: plus what the renovations cost to run — a pool, a
 * maze somebody has to trim.
 */
export function annualExpenseOf(
  home: Pick<OwnedHome, 'value' | 'expenseRate' | 'condition'> & {
    readonly renovations?: readonly HomeRenovation[];
  },
): number {
  const extra = (home.renovations ?? []).reduce(
    (sum, done) => sum + (findRenovation(done.renovationId)?.upkeep ?? 0),
    0,
  );
  return Math.round(
    (Number(home.value) / 100) * home.expenseRate * CONDITION_UPKEEP[home.condition] + extra,
  );
}

/* -------------------------------------------------------------------------- */
/* Mortgages (spec 1857's `secured`, and spec 149–150's flow)                  */
/* -------------------------------------------------------------------------- */

export interface MortgageProduct {
  readonly id: string;
  readonly name: string;
  readonly lender: string;
  readonly apr: number;
  readonly termYears: number;
  /** The smallest down payment, as a share of the price. */
  readonly minDown: number;
  readonly needs: CreditStanding;
  /** The most it will lend, whole dollars. */
  readonly maxPrincipal: number;
  /**
   * Ticket 0503. Lends on a place the borrower will not live in. A lender
   * prices that higher and asks a quarter down; ordinary home mortgages are
   * for the home itself.
   */
  readonly investment?: boolean;
  /** Ticket 0606. Lends on commercial property only, and on nothing else. */
  readonly commercial?: boolean;
}

/**
 * Three, in the order a lender would try them for a borrower: the cheapest
 * money first. Rates are set against ordinary US thirty-year fixed rates in
 * the mid-2020s; the starter product is the low-deposit government-backed
 * shape that exists precisely so that people with little saved can buy at all.
 */
export const MORTGAGE_PRODUCTS: readonly MortgageProduct[] = [
  {
    id: 'mortgage.conventional',
    name: 'Fixed Mortgage',
    lender: 'Northgate Bank',
    apr: 0.065,
    termYears: 30,
    minDown: 0.1,
    needs: 'good',
    maxPrincipal: 800_000,
  },
  {
    id: 'mortgage.starter',
    name: 'First-Home Mortgage',
    lender: 'Meridian',
    apr: 0.069,
    termYears: 30,
    minDown: 0.035,
    needs: 'fair',
    maxPrincipal: 500_000,
  },
  {
    id: 'mortgage.jumbo',
    name: 'Private Mortgage',
    lender: 'Ashcroft Private',
    apr: 0.068,
    termYears: 30,
    minDown: 0.2,
    needs: 'excellent',
    maxPrincipal: 6_000_000,
  },
  /*
    Ticket 0503. Investment-property loans run about three quarters of a point
    above an ordinary mortgage and want 25% down; past four units they are
    commercial loans in life, which this one stands in for up to its limit.
  */
  {
    id: 'mortgage.investment',
    name: 'Investment Property Loan',
    lender: 'Northgate Bank',
    apr: 0.0725,
    termYears: 30,
    minDown: 0.25,
    needs: 'good',
    maxPrincipal: 5_000_000,
    investment: true,
  },
  /*
    Ticket 0606. A commercial mortgage runs shorter, wants 30% down and prices about
    three quarters of a point over an investment-property loan. It lends on shops,
    warehouses and offices, which the investment loan was only standing in for.
  */
  {
    id: 'mortgage.commercial',
    name: 'Commercial Mortgage',
    lender: 'Ashcroft Commercial',
    apr: 0.0725,
    termYears: 25,
    minDown: 0.3,
    needs: 'good',
    maxPrincipal: 8_000_000,
    commercial: true,
  },
];

/**
 * Ticket 0503. Mortgaged properties a lender will let one borrower carry at
 * once. Ordinary US lending stops at ten financed properties; five keeps a
 * life from becoming a portfolio of debt without being a wall anybody meets
 * by accident.
 */
export const MAX_MORTGAGES = 5;

/**
 * Ticket 0503. The share of a rental's rent a lender counts as income. US
 * underwriting uses 75%, leaving a quarter for vacancy and upkeep.
 */
export const RENT_COUNTED = 0.75;

/** Ticket 0606. A commercial lender counts less of the rent: a unit stands empty longer. */
export const COMMERCIAL_RENT_COUNTED = 0.7;

export const findMortgageProduct = (id: string): MortgageProduct | undefined =>
  MORTGAGE_PRODUCTS.find((product) => product.id === id);

/**
 * What a year of this mortgage costs, amortised. Same annuity as 0307's loans.
 */
export function mortgagePaymentFor(apr: number, balance: number, termLeft: number): number {
  if (balance <= 0) return 0;
  const years = Math.max(1, termLeft);
  if (apr <= 0) return Math.round(balance / years);
  const factor = (1 + apr) ** years;
  return Math.round((balance * apr * factor) / (factor - 1));
}

/**
 * Housing costs against gross income, the one test that matters to a mortgage
 * lender. 43% is the long-standing ordinary ceiling in the US: the payment, the
 * upkeep and what is already owed on other loans, together.
 */
export const HOUSING_DEBT_CEILING = 0.43;

/** A buffer the down payment will not touch: somebody moving in with $0 left is one repair from trouble. */
export const KEEP_IN_HAND = 5_000;

/** The deposit a buyer aims for when they can: the point at which the cheapest money opens. */
export const TARGET_DOWN = 0.2;

export const BUY_FROM_AGE = 18;

export interface HomeBuyer {
  readonly age: number;
  readonly standing: CreditStanding;
  /** Money in last year, gross, whole dollars. */
  readonly income: number;
  /** Cash in hand, whole dollars. The down payment comes from here. */
  readonly cash: number;
  /** What other loans already cost them a year, whole dollars. */
  readonly otherPayments: number;
  /** Whether the home they live in is mortgaged. One home mortgage at a time. */
  readonly mortgaged: number;
  /** Ticket 0503. Every mortgage they carry, homes and rentals together. */
  readonly mortgages?: number;
}

/** Ticket 0503. What the buyer means to do with it. */
export type MortgagePurpose = 'home' | 'rental' | 'commercial';
/** P14: fixed investment preset; primary-home deposits stay automatic. */
export type MortgageDeposit = 'usual' | 'half';
export const HALF_INVESTMENT_DEPOSIT = 0.5;

export type MortgageRefusal =
  | 'tooYoung'
  | 'deposit'
  | 'standing'
  | 'income'
  | 'tooLarge'
  | 'alreadyMortgaged'
  | 'tooManyMortgages'
  | 'invalidDeposit'
  | 'lifeEnded';

export const MORTGAGE_REFUSAL_LABELS: Readonly<Record<MortgageRefusal, string>> = {
  lifeEnded: 'This life has ended.',
  invalidDeposit: "That deposit choice isn't available for this property.",
  tooYoung: "Not until you're eighteen.",
  deposit: "You don't have enough for the deposit.",
  standing: "Your credit isn't strong enough for this one.",
  income: 'The payments would be more than your income can carry.',
  tooLarge: 'No lender you can reach will go this high.',
  alreadyMortgaged: "You're already paying off one home.",
  tooManyMortgages: 'No lender will take on another property of yours.',
};

export interface MortgageOffer {
  readonly approved: boolean;
  readonly because?: MortgageRefusal;
  readonly product?: MortgageProduct;
  /** Whole dollars. */
  readonly down: number;
  readonly principal: number;
  readonly yearlyPayment: number;
}

/**
 * Apply → Approved/Denied (spec 149). One answer, with the best product the
 * buyer qualifies for and the down payment chosen for them.
 *
 * THE DOWN PAYMENT IS NOT A SLIDER. A player asked to choose a deposit is being
 * handed a spreadsheet; what a person actually does is put down what they can
 * sensibly spare, up to the point where it stops buying a better rate. So:
 * everything above `KEEP_IN_HAND`, capped at `TARGET_DOWN`, and never less
 * than the product's floor.
 *
 * P14 adds an approved fixed half-deposit preset for investment property, with
 * the same rates and underwriting. It commits more cash to reduce debt.
 * The refusal names what would actually have to change — see the note inside.
 */
export function mortgageFor(
  price: number,
  buyer: HomeBuyer,
  expense: number,
  purpose: MortgagePurpose = 'home',
  rentYear = 0,
  deposit: MortgageDeposit = 'usual',
): MortgageOffer {
  const none = { approved: false, down: 0, principal: 0, yearlyPayment: 0 } as const;
  if ((deposit !== 'usual' && deposit !== 'half') || (deposit === 'half' && purpose === 'home'))
    return { ...none, because: 'invalidDeposit' };
  if (buyer.age < BUY_FROM_AGE) return { ...none, because: 'tooYoung' };
  if (purpose === 'home' && buyer.mortgaged > 0) return { ...none, because: 'alreadyMortgaged' };
  if ((buyer.mortgages ?? buyer.mortgaged) >= MAX_MORTGAGES) {
    return { ...none, because: 'tooManyMortgages' };
  }
  // Ticket 0503: a rental's own rent helps carry it, at the lender's discount.
  const income =
    buyer.income +
    (purpose === 'rental'
      ? rentYear * RENT_COUNTED
      : purpose === 'commercial'
        ? rentYear * COMMERCIAL_RENT_COUNTED
        : 0);

  /*
    Each product either approves or fails for one reason, and the refusal
    reported is the one from the product this buyer is CLOSEST to — the one
    whose limit fits the loan and whose credit bar they already clear. Its
    failure (a deposit, or income) is the thing that would actually have to
    change. Only if no product they could qualify on credit would take the
    loan is credit the answer; only if none would lend this much at all is the
    house too large. The first version reported the last product tried, which
    was the private bank, and told a buyer on $20,000 that their credit was
    the problem.
  */
  const spare = Math.max(0, buyer.cash - KEEP_IN_HAND);
  let closest: MortgageRefusal | undefined;
  let closestDown = Infinity;
  let fitsSomewhere = false;
  const note = (reason: MortgageRefusal, minDown: number) => {
    // The product asking least up front is the one they are nearest to.
    if (minDown < closestDown) {
      closest = reason;
      closestDown = minDown;
    }
  };
  for (const product of MORTGAGE_PRODUCTS) {
    // A commercial loan lends on commercial property only; a commercial property takes nothing else.
    if ((product.commercial ?? false) !== (purpose === 'commercial')) continue;
    if (!product.commercial && (product.investment ?? false) !== (purpose === 'rental')) continue;
    const floor = Math.ceil(price * product.minDown);
    const down =
      deposit === 'half'
        ? Math.ceil(price * HALF_INVESTMENT_DEPOSIT)
        : Math.max(floor, Math.min(Math.round(price * TARGET_DOWN), spare));
    const principal = price - down;
    if (principal > product.maxPrincipal) continue;
    fitsSomewhere = true;
    if (!atLeast(buyer.standing, product.needs)) continue;
    if (down > buyer.cash) {
      note('deposit', product.minDown);
      continue;
    }
    const yearlyPayment = mortgagePaymentFor(product.apr, principal, product.termYears);
    const load = yearlyPayment + expense + buyer.otherPayments;
    if (load > income * HOUSING_DEBT_CEILING) {
      note('income', product.minDown);
      continue;
    }
    return { approved: true, product, down, principal, yearlyPayment };
  }
  return { ...none, because: closest ?? (fitsSomewhere ? 'standing' : 'tooLarge') };
}

/* -------------------------------------------------------------------------- */
/* A year of owning                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The housing market, one number a year for the whole world.
 *
 * Supplied by the caller from a stable key on the world year, so every life
 * living through 2031 lives through the same 2031 — a crash is a crash for
 * everybody, which is what makes it one.
 *
 * IN REAL TERMS, because this build has no inflation: salaries, prices and
 * the market's own drifts are all constant dollars (a broad index fund drifts
 * at 5.8%, which is a real equity return). The first version used 4%, the
 * nominal US record, and measured what that does in a world where wages never
 * rise: owners' median equity at sixty-five was $978,000 on homes bought for
 * about $200,000. Real US house prices have grown roughly 1% a year over the
 * long run, with real falls of a third in a bad decade — so 1.2%, and a
 * spread that allows one.
 */
export const MARKET_MEAN = 0.012;
export const MARKET_SPREAD = 0.06;
export const marketMoveFrom = (unit: number): number =>
  MARKET_MEAN + (unit - 0.5) * 2 * MARKET_SPREAD;

/**
 * Condition slips with age and use. The chance a year drops one band.
 *
 * Nothing restores it in this ticket — that is renovation, 0505 in the
 * breakdown. A house bought in good condition and never touched reaches "needs
 * work" in a couple of decades, which is about right.
 */
export const WEAR_CHANCE = 0.08;

export interface HomeYearResult {
  readonly home: OwnedHome;
  /** Whole dollars. */
  readonly expense: number;
  /** What the mortgage wants this year, whole dollars. Zero if none or paid off. */
  readonly payment: number;
  /** The payment's interest share, for the record. */
  readonly interest: number;
  readonly worn: boolean;
  readonly paidOff: boolean;
}

/**
 * One year of a home, as a pure function: it gets older, the market moves it,
 * it costs what it costs, and the mortgage takes its payment.
 *
 * Whether the household can actually pay is not decided here — the payment is
 * a committed outgoing like rent, charged through the same books, and a year
 * that falls short is seen by `advanceYear` (see `missedYears`).
 */
export function homeYear(home: OwnedHome, marketMove: number, wearRoll: number): HomeYearResult {
  const worn = wearRoll < WEAR_CHANCE && home.condition !== 'poor';
  const condition: HomeCondition = worn
    ? HOME_CONDITIONS[HOME_CONDITIONS.indexOf(home.condition) - 1]!
    : home.condition;
  const moved = (Number(home.value) / 100) * (1 + marketMove);
  const value = Math.max(
    10_000,
    Math.round(moved * (CONDITION_PRICE[condition] / CONDITION_PRICE[home.condition])),
  );

  let mortgage = home.mortgage;
  let payment = 0;
  let interest = 0;
  let paidOff = false;
  if (mortgage) {
    const product = findMortgageProduct(mortgage.productId);
    const balance = Number(mortgage.balance) / 100;
    const apr = product?.apr ?? 0.065;
    interest = Math.round(balance * apr);
    payment = Math.min(balance + interest, mortgagePaymentFor(apr, balance, mortgage.termLeft));
    const after = Math.max(0, Math.round(balance + interest - payment));
    if (after <= 0) {
      paidOff = true;
      mortgage = undefined;
    } else {
      mortgage = {
        ...mortgage,
        balance: dollars(after),
        termLeft: Math.max(0, mortgage.termLeft - 1),
      };
    }
  }

  const next: OwnedHome = { ...home, condition, value: dollars(value) };
  if (mortgage) (next as { mortgage?: Mortgage }).mortgage = mortgage;
  else delete (next as { mortgage?: Mortgage }).mortgage;

  return { home: next, expense: annualExpenseOf(home), payment, interest, worn, paidOff };
}

/* -------------------------------------------------------------------------- */
/* Selling                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What selling costs: agents, closing, the lot. Six percent is the ordinary
 * US figure, and it is what stops a house being a thing you can flip every
 * spring for free.
 */
export const SELLING_COST = 0.06;

/** Two short years in a row and the bank takes it. */
export const FORECLOSE_AFTER = 2;
/** A forced sale fetches less. */
export const FORCED_SALE = 0.85;

export interface HomeSale {
  /** Whole dollars the sale fetched before anything came off it. */
  readonly price: number;
  readonly costs: number;
  /** Whole dollars that went to the lender. */
  readonly repaid: number;
  /** What the owner is left with. Can be zero; never negative (the lender eats it). */
  readonly proceeds: number;
}

export function saleOf(home: OwnedHome, forced = false): HomeSale {
  const price = Math.round((Number(home.value) / 100) * (forced ? FORCED_SALE : 1));
  const costs = Math.round(price * SELLING_COST);
  const owed = home.mortgage ? Number(home.mortgage.balance) / 100 : 0;
  const repaid = Math.min(owed, Math.max(0, price - costs));
  return { price, costs, repaid, proceeds: Math.max(0, price - costs - repaid) };
}

/** Everything the homes are worth, and everything still owed on them. */
export const homesValue = (homes: readonly OwnedHome[]): Money =>
  cents(homes.reduce((sum, home) => sum + Number(home.value), 0));

export const mortgagesOwed = (homes: readonly OwnedHome[]): Money =>
  cents(homes.reduce((sum, home) => sum + Number(home.mortgage?.balance ?? 0), 0));
