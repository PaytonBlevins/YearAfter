/** P1 — one annual review, individual choices, no owner money without consent. */
import { appendToTimeline, createTimelineEntry, type TimelineEntry } from '@yearafter/character';
import { dollars, err, ok, type Result } from '@yearafter/core';
import {
  post,
  settleYear,
  BUSINESS_LOAN_PRODUCTS,
  yearlyPaymentFor,
  type HeldLoan,
} from '@yearafter/finance';
import type { GameState } from './game-state';
import { closeBusiness } from './businesses';
import { pruneBusinessRescue } from './business-rescue-state';

export const BUSINESS_RESCUE_EVENT_ID = 'business.rescue';
export interface BusinessRescueCase {
  readonly businessId: string;
  /** Whole dollars: trading hole + existing half-reserve buffer + uncovered loan payment. */
  readonly amount: number;
  readonly loanPayment: number;
  readonly loanProductId?: string;
  /** Cents after this year's interest, before the missing payment. */
  readonly loanBalance?: number;
  /** The already quoted paid result. Absent when the payment clears the loan. */
  readonly fundedLoan?: HeldLoan;
}
export interface BusinessRescue {
  readonly year: number;
  readonly cases: readonly BusinessRescueCase[];
}
export type BusinessRescueError = 'no-such-choice' | 'stale-rescue' | 'cannot-afford';
type Answer = Result<
  { readonly state: GameState; readonly entry: TimelineEntry },
  BusinessRescueError
>;
const money = (amount: number) => `$${amount.toLocaleString('en-US')}`;
export const businessRescueChoice = (id: string, action: 'inject' | 'close') => `${action}:${id}`;

export function withBusinessRescue(
  state: GameState,
  cases: readonly BusinessRescueCase[],
): GameState {
  if (cases.length === 0) return state;
  const reviewed: GameState = { ...state, businessRescue: { year: state.world.year, cases } };
  // A deceased owner cannot consent. Wind down first; the estate still owes any remainder.
  if (!state.player.alive) {
    return cases.reduce((current, row) => {
      const closed = declineBusinessRescue(current, row.businessId);
      return closed.ok ? closed.value.state : current;
    }, reviewed);
  }
  return {
    ...reviewed,
    pending: [
      {
        eventId: BUSINESS_RESCUE_EVENT_ID,
        category: 'random',
        age: state.player.age,
        year: state.world.year,
        prompt:
          'Your businesses need a decision. Put money into each one you want to keep, or close its doors.',
        names: {},
        choices: cases.flatMap((row) => [
          {
            id: businessRescueChoice(row.businessId, 'inject'),
            label: `Put in ${money(row.amount)}`,
          },
          { id: businessRescueChoice(row.businessId, 'close'), label: 'Close the business' },
        ]),
      },
      ...state.pending,
    ],
  };
}

function caseFor(state: GameState, businessId: string) {
  const review = state.businessRescue;
  if (!review || review.year !== state.world.year) return undefined;
  const row = review.cases.find((candidate) => candidate.businessId === businessId);
  const business = state.businesses.find((candidate) => candidate.id === businessId);
  return row && business ? { row, business } : undefined;
}

function answered(state: GameState, businessId: string): GameState {
  if (!state.businessRescue) return state;
  const cases = state.businessRescue.cases.filter((row) => row.businessId !== businessId);
  if (cases.length > 0) {
    const choices = state.pending
      .find((decision) => decision.eventId === BUSINESS_RESCUE_EVENT_ID)
      ?.choices.filter(
        (choice) =>
          ![
            businessRescueChoice(businessId, 'inject'),
            businessRescueChoice(businessId, 'close'),
          ].includes(choice.id),
      );
    return {
      ...state,
      businessRescue: { ...state.businessRescue, cases },
      pending: state.pending.map((decision) =>
        decision.eventId === BUSINESS_RESCUE_EVENT_ID && choices
          ? { ...decision, choices }
          : decision,
      ),
    };
  }
  return pruneBusinessRescue({ ...state, businessRescue: { ...state.businessRescue, cases: [] } });
}

export function injectIntoBusinessRescue(state: GameState, businessId: string): Answer {
  const found = caseFor(state, businessId);
  if (!found || !state.player.alive) return err('stale-rescue');
  const { row, business } = found;
  if (
    !business.last ||
    business.last.year !== state.world.year ||
    !Number.isSafeInteger(row.amount) ||
    row.amount <= 0 ||
    !Number.isSafeInteger(row.loanPayment) ||
    row.loanPayment < 0
  )
    return err('stale-rescue');
  const till = Number(business.cash) / 100;
  const needed =
    settleYear(till, 0, business.last.costs).needed +
    Math.max(0, row.loanPayment - Math.max(0, till));
  if (needed !== row.amount) return err('stale-rescue');
  const held = state.loans.find(
    (loan) => loan.productId === row.loanProductId && loan.businessId === businessId,
  );
  if (
    row.loanPayment > 0 &&
    (!held || held.businessId !== businessId || Number(held.balance) !== row.loanBalance)
  )
    return err('stale-rescue');
  if (row.loanPayment > 0 && held) {
    const product = BUSINESS_LOAN_PRODUCTS.find((product) => product.id === held.productId);
    if (
      !product ||
      yearlyPaymentFor(product, Number(held.balance) / 100, held.termLeft) !== row.loanPayment
    )
      return err('stale-rescue');
    const balance = Math.max(0, Math.round(Number(held.balance) / 100 - row.loanPayment));
    const expected =
      balance > 0
        ? {
            ...held,
            balance: dollars(balance),
            termLeft: Math.max(0, held.termLeft - 1),
            inArrears: false,
          }
        : undefined;
    const funded = row.fundedLoan;
    if (
      expected
        ? !funded ||
          funded.businessId !== expected.businessId ||
          funded.productId !== expected.productId ||
          funded.principal !== expected.principal ||
          funded.balance !== expected.balance ||
          funded.termLeft !== expected.termLeft ||
          funded.inArrears !== false
        : funded !== undefined
    )
      return err('stale-rescue');
  }
  if (Number(state.finance.balance) < row.amount * 100) return err('cannot-afford');
  const books = post(state.finance, state.world.year, state.player.age, {
    category: 'property',
    amount: dollars(-row.amount),
    source: `Put money into ${business.name} to keep it going`,
  }).ledger;
  const entry = createTimelineEntry({
    id: `t:${state.world.year}:rescue:${businessId}`,
    age: state.player.age,
    year: state.world.year,
    kind: 'passive',
    text: `Put ${money(row.amount)} into ${business.name} to keep it going${row.loanPayment > 0 ? `, including ${money(row.loanPayment)} for its lender` : ''}.`,
    sequence: state.player.timeline.filter((line) => line.year === state.world.year).length,
  });
  return ok({
    entry,
    state: answered(
      {
        ...state,
        finance: books,
        loans:
          row.loanPayment > 0
            ? [
                ...state.loans.filter(
                  (loan) =>
                    !(loan.productId === row.loanProductId && loan.businessId === businessId),
                ),
                ...(row.fundedLoan ? [row.fundedLoan] : []),
              ]
            : state.loans,
        businesses: state.businesses.map((candidate) =>
          candidate.id === businessId
            ? {
                ...candidate,
                cash: dollars(Number(candidate.cash) / 100 + row.amount - row.loanPayment),
                invested: dollars(Number(candidate.invested) / 100 + row.amount),
                ...(candidate.last
                  ? {
                      last: {
                        ...candidate.last,
                        injected: row.amount,
                        repaid: (candidate.last.repaid ?? 0) + row.loanPayment,
                      },
                    }
                  : {}),
              }
            : candidate,
        ),
        player: {
          ...state.player,
          cash: books.balance,
          timeline: appendToTimeline(state.player.timeline, entry),
        },
      },
      businessId,
    ),
  });
}

export function declineBusinessRescue(state: GameState, businessId: string): Answer {
  if (!caseFor(state, businessId)) return err('stale-rescue');
  const closed = closeBusiness(state, businessId);
  if (!closed.ok) return err('stale-rescue');
  return ok({ state: answered(closed.value.state, businessId), entry: closed.value.entry });
}

export function answerBusinessRescue(state: GameState, choiceId: string): Answer {
  for (const row of state.businessRescue?.cases ?? []) {
    if (choiceId === businessRescueChoice(row.businessId, 'inject'))
      return injectIntoBusinessRescue(state, row.businessId);
    if (choiceId === businessRescueChoice(row.businessId, 'close'))
      return declineBusinessRescue(state, row.businessId);
  }
  return err('no-such-choice');
}
