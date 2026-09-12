/**
 * Ticket 0307 — what a player can DO about a loan.
 *
 * Two verbs, one fewer than a card has, and the missing one is the point: you
 * cannot close a loan, you can only finish paying it. A loan is not a thing you
 * hold, it is a thing you owe.
 *
 *   BORROW      which product, how much, and whether they will have you.
 *   PAY EXTRA   how fast to clear it against keeping the cash.
 *
 * The yearly payment is not a verb. It comes out of `advanceYear` along with
 * the rent and the tax, because a scheduled repayment is not a decision — spec
 * 1126–1136 removes exactly that kind of chore, and the decision worth keeping
 * is whether to pay MORE than was asked.
 *
 * Proceeds land as cash (spec 1846: "loan proceeds" increase cash) with no
 * earmarking. A student loan pays tuition because the character then spends it
 * on tuition, not because the game follows it around.
 */

import { dollars, err, ok, type Result } from '@yearafter/core';
import { COLLEGE_YEARS, isInSchool } from '@yearafter/education';
import {
  CREDIT_LABELS,
  applyForLoan,
  findLoanProduct,
  loanOffersFor,
  payTowardsLoan,
  totalOwed,
  yearlyPaymentFor,
  type Borrower,
  type HeldLoan,
  type LoanProduct,
  type LoanRefusal,
} from '@yearafter/finance';
import { incomeOf, standingFor } from './cards';
import { nextDegreeFor, outOfPocket } from './college';
import { moveMoney, withCash } from './money';
import type { GameState } from './game-state';

/**
 * What a lender sees. One place, for the reason `applicantFrom` gives: a screen
 * that builds its own view of a borrower is a second derivation of the answer,
 * and the failure mode is a row that offers what a button then refuses.
 */
export function borrowerFrom(state: GameState): Borrower {
  return {
    standing: standingFor(state).standing,
    income: incomeOf(state),
    employed: state.employment.job !== undefined,
    /*
      In education, OR with a degree still ahead of them. The second half is
      what makes a student loan reachable at all: enrolment is gated on cash
      (`cannotEnrol` returns `cannot-afford`), so a rule of "must already be
      studying" locks out precisely the eighteen-year-old with $0 who the
      product exists for.
    */
    studying: isInSchool(state.education) || nextDegreeFor(state) !== undefined,
    age: state.player.age,
    loans: state.loans,
    // Spec 1381: underwriting considers obligations. Card balances are an
    // obligation, and counting them is what stops the borrow-to-pay-a-card loop.
    cardDebt: Math.round(Number(totalOwed(state.cards)) / 100),
    // What a whole degree would still cost them, after whoever is helping.
    // Zero for anybody with nothing left to study, which is what stops a
    // student loan being cheap money for everybody.
    tuitionAhead:
      nextDegreeFor(state) === undefined ? 0 : Math.max(0, outOfPocket(state)) * COLLEGE_YEARS,
  };
}

export type LoanError = LoanRefusal | 'noSuchProduct' | 'noSuchLoan' | 'nothingOwed' | 'noCash';

export interface LoanOutcome {
  readonly state: GameState;
  readonly title: string;
  readonly body: string;
  readonly good: boolean;
}

export const loanOffers = (state: GameState) => loanOffersFor(borrowerFrom(state));

/**
 * Borrow.
 *
 * Takes an amount rather than always lending the maximum, because the amount is
 * the decision: a character who needs $7,000 of tuition and is offered $20,000
 * should not be handed $20,000 by default. The offer is a ceiling, not a
 * recommendation.
 */
export function takeLoan(
  state: GameState,
  productId: string,
  amount: number,
): Result<LoanOutcome, LoanError> {
  const product = findLoanProduct(productId);
  if (!product) return err('noSuchProduct');

  const decision = applyForLoan(product, borrowerFrom(state));
  if (!decision.approved) {
    return ok({
      state,
      title: 'Declined',
      body: refusalFor(decision.because, product),
      good: false,
    });
  }

  const ceiling = Math.round(Number(decision.offered) / 100);
  const principal = Math.max(0, Math.min(Math.round(amount), ceiling));
  if (principal <= 0) return err('tooMuchOwed');

  /*
    A top-up MERGES into the loan already held rather than opening a second one.
    Four separate student loans would be four rows on a screen describing one
    debt, and `MAX_ACTIVE_LOANS` would stop a character finishing a degree.
  */
  const existing = state.loans.find((row) => row.productId === product.id);
  const loan: HeldLoan = existing
    ? {
        ...existing,
        principal: dollars(Math.round(Number(existing.principal) / 100) + principal),
        balance: dollars(Math.round(Number(existing.balance) / 100) + principal),
        termLeft: Math.max(existing.termLeft, product.termYears),
      }
    : {
        productId: product.id,
        principal: dollars(principal),
        balance: dollars(principal),
        termLeft: product.termYears,
        inArrears: false,
      };

  // Through `moveMoney` like every movement in the build since 0301, so the
  // balance is written in exactly one place and the books still reconcile.
  const moved = moveMoney(state, {
    category: 'debt',
    amount: dollars(principal),
    source: `${product.name} — borrowed`,
  });

  const yearly = yearlyPaymentFor(product, principal, product.termYears);
  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      loans: existing
        ? state.loans.map((row) => (row.productId === product.id ? loan : row))
        : [...state.loans, loan],
    },
    title: 'Approved',
    body:
      product.defersWhileStudying && isInSchool(state.education)
        ? `${money(principal)} at ${pc(product.apr)}. Nothing to pay while you study.`
        : `${money(principal)} at ${pc(product.apr)}, about ${money(yearly)} a year for ${product.termYears} years.`,
    good: true,
  });
}

// Says the same thing the row said, with the same number in it. A sheet that
// gives a vaguer answer than the list it was opened from teaches the player
// that the list was the honest one and the sheet is decoration.
function refusalFor(because: LoanRefusal | undefined, product: LoanProduct): string {
  switch (because) {
    case 'tooYoung':
      return 'Nobody lends to somebody your age.';
    case 'tooManyLoans':
      return 'You have as many loans running as anybody will give you.';
    case 'alreadyHeld':
      return `You already have a ${product.name} running.`;
    case 'standing':
      return `They want ${CREDIT_LABELS[product.needs].toLowerCase()} credit for this one.`;
    case 'income':
      return `They want to see ${money(product.needsIncome)} a year coming in.`;
    case 'notStudying':
      return "This one is for students, and you aren't one.";
    case 'tooMuchOwed':
      return 'You already owe as much as they think you can carry.';
    case 'fullyDrawn':
      return 'You have already borrowed what the degree costs.';
    default:
      return "They said no, and didn't say much else.";
  }
}

/** Pay extra off one. The only ongoing decision a loan offers. */
export function payLoan(
  state: GameState,
  productId: string,
  amount: number,
): Result<LoanOutcome, LoanError> {
  const held = state.loans.find((loan) => loan.productId === productId);
  if (!held) return err('noSuchLoan');
  if (Number(held.balance) <= 0) return err('nothingOwed');

  const cash = Math.round(Number(state.player.cash) / 100);
  if (cash <= 0) return err('noCash');

  const { loan, paid } = payTowardsLoan(held, Math.min(Math.round(amount), cash));
  if (paid <= 0) return err('noCash');

  const product = findLoanProduct(productId);
  const moved = moveMoney(state, {
    category: 'debt',
    amount: dollars(-paid),
    source: `${product?.name ?? 'Loan'} — paid down`,
  });

  const cleared = Number(loan.balance) <= 0;
  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      // A cleared loan is GONE, not a zero row kept for the record. Spec 28's
      // rule about cards applies in spirit: the game does not keep a history of
      // accounts you have finished with.
      loans: cleared
        ? state.loans.filter((row) => row.productId !== productId)
        : state.loans.map((row) => (row.productId === productId ? loan : row)),
    },
    title: cleared ? 'Cleared' : 'Paid down',
    body: cleared
      ? `Paid ${money(paid)} and the ${product?.name ?? 'loan'} is finished.`
      : `Paid ${money(paid)}. ${money(Number(loan.balance) / 100)} still to go.`,
    good: true,
  });
}

const money = (amount: number): string => `$${Math.round(amount).toLocaleString('en-US')}`;
const pc = (rate: number): string => `${Math.round(rate * 1000) / 10}%`;
