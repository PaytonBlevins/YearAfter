/**
 * Ticket 0307 — the loan engine.
 *
 * WHAT ANYBODY WOULD ACTUALLY BORROW FOR, measured before a line was written.
 * 0306's cards already cover a few thousand dollars, so the question was
 * whether a loan has any demand left at all (CORE_RULES 13.7). Across 110 lives
 * with cards in play:
 *
 *   still unpaid after cards   median $2,116   p90 $4,836
 *   tuition out of pocket      median $7,436   p90 and max $13,200   n=216
 *   cash at eighteen           $0 at p10, median, p90 AND max
 *
 * That last line is the ticket. An eighteen-year-old in this build has NOTHING
 * — they have just moved out and the living phase has taken everything — no
 * income, so no card, and a college place costs them $7,436 a year. There is
 * exactly one instrument in the world for that, and it is why the first product
 * here is a student loan.
 *
 * SPEC 1857'S FIVE TYPES, and only some of them can exist yet:
 *
 *   personal        BUILT — a student loan and a personal loan.
 *   lineOfCredit    BUILT — revolving, cheaper than a card, harder to get.
 *   wealthPrivate   BUILT IN 0308 — a private line secured on the portfolio,
 *                   and the first product here that anybody can reach without
 *                   a large salary.
 *   secured         NOT YET. Needs something to secure it against, which is
 *                   v0.05's property and vehicles.
 *   business        BUILT IN 0603 — see "Business loans" below. It is the one
 *                   type that is not a product you apply for from the Loans
 *                   screen, because the money is for one thing.
 *
 * Declared in `LOAN_TYPES_NOT_YET_BUILT` rather than shipped empty, the same
 * device as `UNWRITTEN_CATEGORIES`, `NOT_YET_OWNED` and
 * `CREDIT_INPUTS_NOT_YET_BUILT` — and the same tests, so the ticket that builds
 * one has to come here and delete a line.
 *
 * Spec 1858's mortgage and auto applications ("simple instant approve/deny")
 * are v0.05's, for the same reason `secured` is: there is nothing to buy.
 *
 * PROCEEDS ARE CASH. Spec 1846's canonical accounting lists "loan proceeds"
 * among the things that increase cash, so a loan lands in the balance as a
 * positive `debt` row and is spent on whatever the character spends it on. No
 * earmarking, no escrow, no "this loan may only be used for tuition" — that
 * would be a chore, and spec 1126–1136 removes chores.
 */

import { cents, dollars, type Money } from '@yearafter/core';
import type { CreditStanding } from './credit';
import { atLeast } from './credit';

/* -------------------------------------------------------------------------- */
/* Types and products                                                          */
/* -------------------------------------------------------------------------- */

/** Spec 1857's list, verbatim. */
export type LoanType = 'personal' | 'secured' | 'business' | 'lineOfCredit' | 'wealthPrivate';

export interface LoanTypeNotYetBuilt {
  readonly type: LoanType;
  readonly needs: string;
  readonly arrives: string;
}

/**
 * EMPTY AT LAST. `secured` came off in Ticket 0501 (a mortgage is secured on
 * the home it buys and lives in `property.ts`), `wealthPrivate` in 0308, and
 * `business` in 0603. The list stays, empty, because the same two tests guard
 * it for the next type spec 1857 grows.
 */
export const LOAN_TYPES_NOT_YET_BUILT: readonly LoanTypeNotYetBuilt[] = [];

export interface LoanProduct {
  readonly id: string;
  readonly name: string;
  readonly lender: string;
  readonly type: LoanType;
  readonly apr: number;
  /** Years to repay. A line of credit has none — it revolves. */
  readonly termYears: number;
  readonly needs: CreditStanding;
  readonly needsIncome: number;
  /** The most anybody can borrow on this product. */
  readonly maxPrincipal: number;
  /** Only while enrolled in education. */
  readonly needsStudying: boolean;
  /**
   * Ticket 0308. Bounded by the portfolio rather than by income, and refused
   * outright to anybody with nothing to pledge.
   */
  readonly needsCollateral?: boolean;
  /**
   * Ticket 0603. A business loan: the share of a purchase it will finance, by
   * what is being bought. Absent for a kind means they will not lend for it.
   */
  readonly financesShare?: Readonly<Partial<Record<PurchaseKind, number>>>;
  /**
   * Nothing is repaid while the character is studying.
   *
   * Interest still accrues, because an unsubsidised student loan is the common
   * one and a loan that quietly costs nothing for four years would make the
   * decision to take it free — and a decision with no cost is not one.
   */
  readonly defersWhileStudying: boolean;
  readonly blurb: string;
}

/**
 * Six products across the two types that can exist.
 *
 * The student loan sits first and is the only one with no income test and no
 * credit test, which is exactly how student lending works and the only reason
 * an eighteen-year-old with nothing can use this system at all. Without it the
 * ladder starts above the ground — the mistake 0306 made and the $9,000 wedding
 * made before that.
 */
export const LOAN_PRODUCTS: readonly LoanProduct[] = [
  {
    id: 'loan.student',
    name: 'Student Loan',
    lender: 'Federal Student Aid',
    type: 'personal',
    apr: 0.061,
    termYears: 10,
    needs: 'none',
    needsIncome: 0,
    maxPrincipal: 40_000,
    needsStudying: true,
    defersWhileStudying: true,
    blurb: 'Nothing to pay while you study. It waits for you.',
  },
  {
    id: 'loan.starter',
    name: 'Small Personal Loan',
    lender: 'Northgate Bank',
    type: 'personal',
    apr: 0.189,
    termYears: 3,
    needs: 'fair',
    needsIncome: 18_000,
    maxPrincipal: 8_000,
    needsStudying: false,
    defersWhileStudying: false,
    blurb: 'A few thousand, back inside three years.',
  },
  // DECLARATION ORDER IS THE LADDER, since the screen shows each refusal's own
  // income bar and a player reads the column top to bottom. Consolidation sits
  // above the personal loan because it asks for less ($30,000 against
  // $38,000), and a rung out of order reads as noise rather than as a route.
  // A test below holds the order monotone so a seventh product cannot quietly
  // break it.
  {
    id: 'loan.consolidation',
    name: 'Consolidation Loan',
    lender: 'Meridian',
    type: 'personal',
    apr: 0.109,
    termYears: 5,
    needs: 'good',
    needsIncome: 30_000,
    maxPrincipal: 40_000,
    needsStudying: false,
    defersWhileStudying: false,
    blurb: 'Cheap, if what you already owe is expensive.',
  },
  {
    id: 'loan.personal',
    name: 'Personal Loan',
    lender: 'Meridian',
    type: 'personal',
    apr: 0.129,
    termYears: 5,
    needs: 'good',
    needsIncome: 38_000,
    maxPrincipal: 30_000,
    needsStudying: false,
    defersWhileStudying: false,
    blurb: 'Bigger, cheaper, and they want to see the payslips.',
  },
  {
    id: 'loan.creditline',
    name: 'Line of Credit',
    lender: 'Halcyon',
    type: 'lineOfCredit',
    apr: 0.144,
    termYears: 0,
    needs: 'good',
    needsIncome: 45_000,
    maxPrincipal: 25_000,
    needsStudying: false,
    defersWhileStudying: false,
    blurb: 'Take what you need, pay what you use. Cheaper than any card.',
  },
  /*
    Ticket 0308 — SECURED ON THE PORTFOLIO, and that is what makes it the first
    product in the game somebody can qualify for without a large salary.

    It shipped in 0307 as a `lineOfCredit` wanting $140,000 a year, which made
    it the top rung of an income ladder and nothing more. Spec 1857 calls this
    type `wealthPrivate` and the distinction is real: a private bank lends
    against what you HAVE. So the income test comes down to something a retired
    or self-employed character can meet, and the ceiling is the collateral —
    `pledgeableAgainst` in `investments.ts`, which is 40% of the non-crypto
    portfolio and nothing at all below $75,000.

    This is also the fix CORE_RULES 13.49 asked for. That rule recorded a credit
    gate which had never once been the binding constraint, because everybody who
    cleared the income bar had already earned the standing on the way past. A
    borrower with $300,000 invested and a $45,000 salary now passes on assets
    and is bounded by collateral, which is a different answer from the income
    gate for the first time in the build.
  */
  {
    id: 'loan.privateline',
    name: 'Private Line',
    lender: 'Ashcroft Private',
    type: 'wealthPrivate',
    apr: 0.089,
    termYears: 0,
    needs: 'good',
    needsIncome: 25_000,
    maxPrincipal: 400_000,
    needsStudying: false,
    defersWhileStudying: false,
    needsCollateral: true,
    blurb: 'Borrows against what you hold instead of what you earn.',
  },
];

export const findLoanProduct = (id: string): LoanProduct | undefined =>
  LOAN_PRODUCTS.find((product) => product.id === id) ??
  BUSINESS_LOAN_PRODUCTS.find((product) => product.id === id);

/* -------------------------------------------------------------------------- */
/* A loan somebody holds                                                       */
/* -------------------------------------------------------------------------- */

/**
 * NO OPENED DATE, for the same reason a card has none (spec 28). `termLeft` is
 * a countdown rather than a date, which is what amortisation needs and is not a
 * history of anything.
 */
export interface HeldLoan {
  readonly productId: string;
  /** What was originally borrowed. Caps how far the balance can run away. */
  readonly principal: Money;
  readonly balance: Money;
  /** Years of the term remaining. Zero for a revolving line. */
  readonly termLeft: number;
  /** True once a payment has been missed and not caught up. */
  readonly inArrears: boolean;
  /**
   * Ticket 0603. The business this was borrowed to buy, or to enlarge, for a
   * business loan; absent for every other kind. One business, one loan: a
   * second purchase for the same business tops the first up.
   */
  readonly businessId?: string;
}

export const MAX_ACTIVE_LOANS = 4;

export const totalBorrowed = (loans: readonly HeldLoan[]): Money =>
  cents(loans.reduce((sum, loan) => sum + Number(loan.balance), 0));

export const isBusinessLoan = (loan: Pick<HeldLoan, 'productId'>): boolean =>
  findLoanProduct(loan.productId)?.type === 'business';

/** The loans a person takes for themselves. A business loan is the business's, not theirs. */
export const personalLoans = (loans: readonly HeldLoan[]): readonly HeldLoan[] =>
  loans.filter((loan) => !isBusinessLoan(loan));

/**
 * What is owed on the loans a lender weighs against a salary. A business loan
 * is left out for the reason a mortgage is: it is secured on the thing it
 * bought and the thing pays it, and counting it against wages would stop the
 * people the product exists for from ever borrowing a second time.
 */
export const personalBorrowed = (loans: readonly HeldLoan[]): Money =>
  totalBorrowed(personalLoans(loans));

/**
 * The same ceiling a card has, and it is here because 0306 shipped without one.
 *
 * A frozen card compounded a $200 balance into $1.6 billion across a working
 * life, which nobody noticed until a population was run for sixty years rather
 * than six. A loan in arrears has exactly the same shape, so it gets the rule
 * at birth instead of after the fact.
 */
export const LOAN_BALANCE_CEILING = 2;

/* -------------------------------------------------------------------------- */
/* Borrowing                                                                   */
/* -------------------------------------------------------------------------- */

export interface Borrower {
  readonly standing: CreditStanding;
  readonly income: number;
  readonly employed: boolean;
  readonly studying: boolean;
  readonly age: number;
  readonly loans: readonly HeldLoan[];
  /** What is already owed on cards — spec 1381's "obligations". */
  readonly cardDebt: number;
  /**
   * Ticket 0308. What a private bank would lend against the portfolio, in whole
   * dollars — 40% of everything held that is not crypto, and zero below
   * $75,000. See `pledgeableAgainst`.
   */
  readonly pledgeable: number;
  /**
   * Tuition still ahead of them, in whole dollars, or zero for somebody with
   * no degree left to take.
   *
   * THE CAP ON A STUDENT LOAN, and it is here because the first version had a
   * deadlock and then an exploit. The deadlock: the product required the
   * borrower to be studying, but enrolment is blocked by cash and cash is what
   * the loan is for — a system gated on a system (CORE_RULES 13.16), so nobody
   * could ever take one.
   *
   * Opening it to anybody ELIGIBLE to study fixed that and bought an exploit:
   * the cheapest money in the game, 6.1% with no income test, available to
   * every character who never went to college, at any age, to spend on
   * anything. Capping the principal at the tuition actually ahead of them is
   * the honest bound — a student loan is for tuition — and it needs no
   * arbitrary age cut-off.
   */
  readonly tuitionAhead: number;
}

export type LoanRefusal =
  | 'tooManyLoans'
  | 'alreadyHeld'
  | 'standing'
  | 'income'
  | 'notStudying'
  | 'tooMuchOwed'
  /*
    A STUDENT LOAN RUNS OUT FOR A DIFFERENT REASON THAN EVERYTHING ELSE, and
    reading the built screen is what separated them. A character who had drawn
    the whole cost of their degree was told "You owe as much as they think you
    can carry" — a sentence about debt capacity, offered to somebody whose debt
    capacity was never tested, because a student loan has no income gate and no
    credit gate. What actually ran out was the tuition.

    Same code for two situations is a refusal that has stopped explaining
    anything (CORE_RULES 13.47's sibling: a reason shared between unlike causes
    is not a reason).
  */
  | 'fullyDrawn'
  /** Ticket 0308: nothing to secure it against. */
  | 'noCollateral'
  /** Ticket 0603: a business loan is only ever written for a purchase. */
  | 'forABusiness'
  | 'tooYoung';

export interface LoanDecision {
  readonly approved: boolean;
  readonly because?: LoanRefusal;
  /** The most they could borrow on this product today. */
  readonly offered: Money;
  /** What a full year of repaying it would cost. */
  readonly yearlyPayment: Money;
}

/**
 * Total borrowing against income, across every debt.
 *
 * SPEC 1381: *"underwriting considers obligations and collateral"* and
 * *"prevent circular credit/loan exploits internally"*. Card balances count
 * here, which is what stops the obvious loop — borrow to pay a card, then
 * borrow again against the freed-up limit. One ceiling over everything owed.
 *
 * A student loan is exempt from the income half of this and nothing else: a
 * student has no income by definition, and testing them against one would make
 * the product unreachable by exactly the people it exists for.
 */
export const DEBT_CEILING = 1.6;
export const STUDENT_FLOOR = 12_000;

export const CAN_BORROW_FROM_AGE = 18;

export function borrowingRoom(product: LoanProduct, borrower: Borrower): number {
  const owed = Number(personalBorrowed(borrower.loans)) / 100 + borrower.cardDebt;
  if (product.needsStudying) {
    /*
      Bounded by the TUITION AHEAD, less what has already been borrowed for it —
      not by income, because a student has none, and not by a flat cap.

      The flat cap was the first version and it produced a specific, readable
      failure: a character took $12,000 at eighteen against a four-year degree
      costing $37,600, ran out in the second year and dropped out. A student
      loan that cannot cover a degree is a system that hands somebody half a
      bridge. Borrowing tops up year by year, which is also how it actually
      works — nobody takes four years of tuition in one cheque.
    */
    const already = borrower.loans
      .filter((loan) => findLoanProduct(loan.productId)?.needsStudying)
      .reduce((sum, loan) => sum + Number(loan.balance) / 100, 0);
    return Math.max(0, Math.min(product.maxPrincipal, borrower.tuitionAhead) - already);
  }
  /*
    A SECURED LINE IS BOUNDED BY THE COLLATERAL, not by the income multiple.
    That is the whole difference between this product and every other one here,
    and it is why a character with a modest salary and a large portfolio can
    reach it.
  */
  if (product.needsCollateral) {
    return Math.max(0, Math.min(product.maxPrincipal, borrower.pledgeable - owed));
  }
  return Math.max(0, Math.min(product.maxPrincipal, borrower.income * DEBT_CEILING - owed));
}

/** The smallest loan worth writing. Below this a lender says no instead. */
export const MINIMUM_LOAN = 500;

/**
 * A year of repaying, amortised.
 *
 * The standard annuity formula, annual because the game is annual. A revolving
 * line has no term, so it asks for a share of the balance the way a card does —
 * the two instruments differ in price and in how you draw on them, not in the
 * shape of what they want back.
 */
export const LINE_MINIMUM_SHARE = 0.2;

export function yearlyPaymentFor(product: LoanProduct, balance: number, termLeft: number): number {
  if (balance <= 0) return 0;
  if (product.termYears <= 0) {
    return Math.min(balance, Math.max(200, Math.round(balance * LINE_MINIMUM_SHARE)));
  }
  const years = Math.max(1, termLeft);
  const rate = product.apr;
  if (rate <= 0) return Math.round(balance / years);
  const factor = (1 + rate) ** years;
  return Math.min(balance * (1 + rate), Math.round((balance * rate * factor) / (factor - 1)));
}

export function applyForLoan(product: LoanProduct, borrower: Borrower): LoanDecision {
  const none: LoanDecision = { approved: false, offered: cents(0), yearlyPayment: cents(0) };
  // Cash from this door would be the cheapest credit in the game (see "Business
  // loans" below), so the door is shut here rather than trusted to a screen.
  if (product.type === 'business') return { ...none, because: 'forABusiness' };
  if (borrower.age < CAN_BORROW_FROM_AGE) return { ...none, because: 'tooYoung' };
  if (personalLoans(borrower.loans).length >= MAX_ACTIVE_LOANS) {
    return { ...none, because: 'tooManyLoans' };
  }
  // A student loan TOPS UP rather than being one-and-done: a degree is paid
  // for a year at a time and the room left is `tuitionAhead` less what has
  // already been drawn. Everything else is one to a customer.
  if (!product.needsStudying && borrower.loans.some((loan) => loan.productId === product.id)) {
    return { ...none, because: 'alreadyHeld' };
  }
  // "Studying" means in education OR with a place still to take up — see
  // `tuitionAhead` for why this is not just `isInSchool`.
  if (product.needsStudying && !borrower.studying) return { ...none, because: 'notStudying' };
  /*
    INCOME BEFORE STANDING, and the order is a measurement rather than a taste.

    Built the other way round, and then counted: across 120 lives and roughly
    5,000 adult years, the standing gate refused 26,550 rows and every single
    one of them — 26,550 of 26,550 — would have been refused by the income gate
    standing behind it. Not most. All of them. The credit check has never once
    been the binding constraint in this build, because `creditReport` weights
    income heavily enough that anybody clearing $140,000 has already earned an
    excellent band on the way past.

    So the player was being told "your credit is not there yet" — a thing that
    takes a decade — when the true answer was "you do not earn enough", a thing
    they can fix next year. Reporting the gate that fires first is only honest
    if it is the one actually holding the door.

    The standing check stays: 0308's portfolio decouples the two, and somebody
    with assets and a modest income will eventually fail income while passing
    standing. Until then it is a gate nobody has tested (CORE_RULES 13.49).
  */
  if (product.needsCollateral && borrower.pledgeable <= 0) {
    return { ...none, because: 'noCollateral' };
  }
  if (!product.needsStudying && borrower.income < product.needsIncome) {
    return { ...none, because: 'income' };
  }
  if (!atLeast(borrower.standing, product.needs)) return { ...none, because: 'standing' };

  const room = Math.round(borrowingRoom(product, borrower) / 100) * 100;
  if (room < MINIMUM_LOAN) {
    return { ...none, because: product.needsStudying ? 'fullyDrawn' : 'tooMuchOwed' };
  }
  return {
    approved: true,
    offered: dollars(room),
    yearlyPayment: dollars(yearlyPaymentFor(product, room, product.termYears)),
  };
}

export const loanOffersFor = (
  borrower: Borrower,
): readonly { readonly product: LoanProduct; readonly decision: LoanDecision }[] =>
  LOAN_PRODUCTS.map((product) => ({ product, decision: applyForLoan(product, borrower) }));

/* -------------------------------------------------------------------------- */
/* A year of owing                                                             */
/* -------------------------------------------------------------------------- */

export interface LoanCharge {
  readonly amount: Money;
  readonly source: string;
}

export interface LoanYear {
  readonly loans: readonly HeldLoan[];
  readonly charges: readonly LoanCharge[];
  readonly interest: number;
  /** Products that fell into arrears this year. */
  readonly missed: readonly string[];
  /** Products cleared this year. */
  readonly settled: readonly string[];
}

/**
 * Interest, then the year's payment out of whatever is left.
 *
 * Paid in the same position as a card and for the same reason: after the rent,
 * the tax and the food. A lender is not paid before the household eats, and
 * spec 32's precedent for cards — the consequence of missing is the account
 * going bad, not a court — is the one applied here too.
 */
export function runLoanYear(
  loans: readonly HeldLoan[],
  canPay: number,
  studying: boolean,
): LoanYear {
  const charges: LoanCharge[] = [];
  const missed: string[] = [];
  const settled: string[] = [];
  let interest = 0;
  let purse = Math.max(0, canPay);

  const next: HeldLoan[] = [];
  for (const loan of loans) {
    const product = findLoanProduct(loan.productId);
    if (!product) {
      next.push(loan);
      continue;
    }

    let owed = Number(loan.balance) / 100;
    if (owed <= 0) {
      settled.push(loan.productId);
      continue;
    }

    const charge = Math.round(owed * product.apr);
    owed += charge;
    interest += charge;

    // The 0306 lesson, applied at birth rather than after sixty years of
    // compounding: a debt cannot grow past twice what was lent.
    const ceiling = (Number(loan.principal) / 100) * LOAN_BALANCE_CEILING;
    owed = Math.min(owed, Math.max(ceiling, Number(loan.balance) / 100));

    // Studying defers everything on a product that defers. The balance still
    // grows, which is what makes taking one a decision rather than a freebie.
    if (studying && product.defersWhileStudying) {
      next.push({ ...loan, balance: dollars(Math.round(owed)) });
      continue;
    }

    const wanted = yearlyPaymentFor(product, owed, loan.termLeft);
    if (purse >= wanted && wanted > 0) {
      purse -= wanted;
      charges.push({ amount: dollars(-wanted), source: `${product.name} — payment` });
      const after = Math.max(0, Math.round(owed - wanted));
      if (after <= 0) {
        settled.push(loan.productId);
        continue;
      }
      next.push({
        ...loan,
        balance: dollars(after),
        termLeft: Math.max(0, loan.termLeft - 1),
        inArrears: false,
      });
      continue;
    }

    if (!loan.inArrears) missed.push(loan.productId);
    next.push({ ...loan, balance: dollars(Math.round(owed)), inArrears: true });
  }

  return { loans: next, charges, interest, missed, settled };
}

/** Pay extra off a loan, which is the player's one ongoing decision about one. */
export function payTowardsLoan(
  loan: HeldLoan,
  amount: number,
): { readonly loan: HeldLoan; readonly paid: number } {
  const owed = Number(loan.balance) / 100;
  const paid = Math.max(0, Math.min(owed, Math.round(amount)));
  return { loan: { ...loan, balance: dollars(Math.round(owed - paid)) }, paid };
}

export const EMPTY_LOANS: readonly HeldLoan[] = [];

/**
 * Everything owed, on cards and loans together.
 *
 * Spec 25's `debtLoad`, which has been the last unbuilt entry in
 * `CREDIT_INPUTS_NOT_YET_BUILT` since 0305. Expressed against income, because
 * what matters to a lender is not the size of a debt but whether this person
 * can carry it.
 */
export const debtLoad = (owed: number, income: number): number | undefined =>
  income <= 0 ? (owed > 0 ? 1 : undefined) : Math.min(1, owed / Math.max(1, income * DEBT_CEILING));

/* -------------------------------------------------------------------------- */
/* Business loans (ticket 0603)                                                */
/* -------------------------------------------------------------------------- */

/*
  SPEC 1857'S "BUSINESS / SBA-STYLE", AND WHY IT IS NOT A BUTTON ON THE LOANS
  SCREEN.

  Every other loan here is cash. Spec 1846 lists "loan proceeds" among the
  things that increase cash, and 0307 decided against earmarking because a
  rule that follows money around is a chore (spec 1126–1136). A business loan
  is the one place that decision cannot stand, and the reason is the exploit
  rather than the realism: at 7–9% and up to $15,000,000, money a player could
  take as cash and put in a portfolio, a home or a card balance would be the
  cheapest credit in the game by a distance, and "prevent circular credit/loan
  exploits internally" (spec 954) is a sentence about exactly that.

  So the money never reaches the player. It is offered at the moment of a
  purchase — opening a business, opening another door of one, buying one that
  exists — and goes straight into that purchase, the way a real lender writes
  the cheque to the seller. There is no earmarking to administer because there
  is no cash to earmark.

  WHAT IT LENDS ON. Not income alone, because a startup has none; not
  collateral alone, because that is `wealthPrivate`. The test is whether the
  business, and the owner, can pay it back: a share of what is being bought
  (the lender wants the owner to have something in it), and a payment no bigger
  than half of what the owner earns plus what their businesses and the one
  being bought clear. That second bound is the scale limit. Nobody leverages
  into a trucking company on a clerk's wages, and everybody who has built
  something that earns can borrow for the next step — which is the shape the
  spec asks for in 1392 ("starting and acquisition economics must prevent
  trivial scale exploits") without a cap on how big anyone may become (spec
  1372).
*/

export type PurchaseKind = 'open' | 'expand' | 'buy';

export const PURCHASE_LABELS: Readonly<Record<PurchaseKind, string>> = {
  open: 'opening it',
  expand: 'opening another door',
  buy: 'buying it',
};

export const BUSINESS_LOAN_PRODUCTS: readonly LoanProduct[] = [
  {
    id: 'loan.smallbiz',
    name: 'Small Business Loan',
    lender: 'Redwood Community Bank',
    type: 'business',
    apr: 0.0875,
    termYears: 10,
    needs: 'fair',
    needsIncome: 0,
    maxPrincipal: 750_000,
    needsStudying: false,
    defersWhileStudying: false,
    // A startup has no record, so a lender wants more of the owner's own money
    // in it than it does for something that already earns.
    financesShare: { open: 0.7, expand: 0.8, buy: 0.8 },
    blurb: 'Government-backed, for people starting out. You put money in too.',
  },
  {
    id: 'loan.commercial',
    name: 'Commercial Term Loan',
    lender: 'Ashcroft Commercial',
    type: 'business',
    apr: 0.0725,
    termYears: 10,
    needs: 'good',
    needsIncome: 0,
    maxPrincipal: 15_000_000,
    needsStudying: false,
    defersWhileStudying: false,
    // No `open`: they lend against earnings, and a business not yet opened has
    // none. That is the line between the two products and the reason the
    // cheaper one is harder to reach.
    financesShare: { expand: 0.8, buy: 0.75 },
    blurb: 'Cheaper, for businesses that already earn. They read the books.',
  },
];

/** Half of what the owner and the businesses clear may go on repaying. */
export const COVER_SHARE = 0.5;

export interface BusinessPurchase {
  readonly kind: PurchaseKind;
  /** What it costs, in whole dollars, before any borrowing. */
  readonly cost: number;
  /** What the thing being bought or enlarged clears in a year, on average. Zero for a new one. */
  readonly targetProfit: number;
  /** The business that already holds a loan, if this is a top-up. */
  readonly topUp?: { readonly businessId: string; readonly productId: string };
}

export interface BusinessBorrower {
  readonly standing: CreditStanding;
  readonly age: number;
  /** Wages, commission and a partner's pay, last year — not what a business paid, which is counted below. */
  readonly earned: number;
  /** What the businesses already owned clear in a year, on average, never below zero. */
  readonly businessProfit: number;
  /** Every yearly payment already committed: loans, mortgages, cars. */
  readonly obligations: number;
}

export type BusinessLoanRefusal =
  'tooYoung' | 'standing' | 'noRecord' | 'otherLender' | 'cover' | 'tooSmall';

export const BUSINESS_LOAN_REFUSALS: Readonly<Record<BusinessLoanRefusal, string>> = {
  tooYoung: 'Nobody lends to somebody your age.',
  standing: "Your credit isn't there yet for this one.",
  noRecord: 'They lend against what a business earns, and this one has no record yet.',
  otherLender: "This business already borrows from somebody else, and they won't share.",
  cover: "What you earn wouldn't cover the repayments on top of what you already owe.",
  tooSmall: "It's too small for them to bother with.",
};

export interface BusinessLoanDecision {
  readonly approved: boolean;
  readonly because?: BusinessLoanRefusal;
  /** The most they will lend for this purchase, whole dollars. */
  readonly offered: number;
  /** What a full year of repaying that would cost, whole dollars. */
  readonly yearlyPayment: number;
}

/** The yearly payment on one dollar borrowed at this rate over this many years. */
export const paymentFactor = (apr: number, years: number): number =>
  apr <= 0 ? 1 / Math.max(1, years) : apr / (1 - (1 + apr) ** -Math.max(1, years));

export function businessLoanFor(
  product: LoanProduct,
  purchase: BusinessPurchase,
  borrower: BusinessBorrower,
): BusinessLoanDecision {
  const none = (because: BusinessLoanRefusal): BusinessLoanDecision => ({
    approved: false,
    because,
    offered: 0,
    yearlyPayment: 0,
  });
  if (borrower.age < CAN_BORROW_FROM_AGE) return none('tooYoung');
  if (purchase.topUp && purchase.topUp.productId !== product.id) return none('otherLender');
  const share = product.financesShare?.[purchase.kind];
  if (share === undefined) return none('noRecord');
  if (!atLeast(borrower.standing, product.needs)) return none('standing');

  const cover =
    (borrower.earned + borrower.businessProfit + Math.max(0, purchase.targetProfit)) * COVER_SHARE -
    borrower.obligations;
  const byCover = cover > 0 ? cover / paymentFactor(product.apr, product.termYears) : 0;
  // To the cent first: 0.7 of $45,000 is 31499.999999999996 in floating point, and a loan
  // written $100 short of the stated share is a bug a player would see as a rounding error.
  const byCost = Math.round(purchase.cost * share * 100) / 100;
  const room = Math.floor(Math.min(product.maxPrincipal, byCost, byCover) / 100) * 100;
  // It is the earnings that fall short, rather than the purchase, when they are the smaller of the two.
  if (room < MINIMUM_LOAN) return none(byCover < byCost ? 'cover' : 'tooSmall');
  return {
    approved: true,
    offered: room,
    yearlyPayment: yearlyPaymentFor(product, room, product.termYears),
  };
}

export const businessLoanOffersFor = (
  purchase: BusinessPurchase,
  borrower: BusinessBorrower,
): readonly { readonly product: LoanProduct; readonly decision: BusinessLoanDecision }[] =>
  BUSINESS_LOAN_PRODUCTS.map((product) => ({
    product,
    decision: businessLoanFor(product, purchase, borrower),
  }));

/** The yearly payments a lender sees on loans already held, business ones included. */
export const loanPaymentsOf = (loans: readonly HeldLoan[]): number =>
  loans.reduce((sum, loan) => {
    const product = findLoanProduct(loan.productId);
    return product
      ? sum + yearlyPaymentFor(product, Number(loan.balance) / 100, loan.termLeft)
      : sum;
  }, 0);

/**
 * Borrow for a purchase: the loan as it will be held afterwards. A top-up
 * merges into the one the business already has, as a student loan does, so a
 * business never carries two.
 */
export function withBusinessLoan(
  loans: readonly HeldLoan[],
  product: LoanProduct,
  businessId: string,
  amount: number,
): readonly HeldLoan[] {
  const existing = loans.find((loan) => loan.businessId === businessId);
  if (!existing) {
    return [
      ...loans,
      {
        productId: product.id,
        principal: dollars(amount),
        balance: dollars(amount),
        termLeft: product.termYears,
        inArrears: false,
        businessId,
      },
    ];
  }
  return loans.map((loan) =>
    loan === existing
      ? {
          ...loan,
          principal: dollars(Math.round(Number(loan.principal) / 100) + amount),
          balance: dollars(Math.round(Number(loan.balance) / 100) + amount),
          termLeft: Math.max(loan.termLeft, product.termYears),
        }
      : loan,
  );
}
