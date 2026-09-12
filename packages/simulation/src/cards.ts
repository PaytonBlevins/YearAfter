/**
 * Ticket 0306 — what a player can DO about a credit card.
 *
 * Three verbs, and the list is short on purpose. Spec 1126–1136's Low-Friction
 * Realism Test asks whether a decision is interesting, and most of what a card
 * does is not a decision at all:
 *
 *   APPLY      which product, and whether they will have you. A real choice —
 *              eight products, different rates, fees and limits, and the one
 *              you qualify for says something about the life you have had.
 *   PAY DOWN   how fast to clear a balance against keeping cash. The ongoing
 *              one, and the only reason APR matters.
 *   CLOSE      stop holding one.
 *
 * AND NOTHING ELSE. There is no "put this on the card" button, because there is
 * no decision in it: a character who cannot cover the year and holds a card
 * with room on it uses the card, the way people do. `advanceYear` draws against
 * the shortfall before it posts, so the ledger says "Put on the Everyday Cash
 * card" rather than "you could not pay for this". Asking a player to confirm
 * that every year would be a chore with one sensible answer, which is the exact
 * shape spec 1165 removes elsewhere.
 *
 * Spec 28 also rules out the rest of the furniture: no statements, no due
 * dates, no payment-history screen, no opened dates.
 */

import { dollars, err, ok, type Result } from '@yearafter/core';
import {
  applyForCard,
  creditReport,
  findProduct,
  limitFor,
  offersFor,
  payTowards,
  utilisation,
  type Applicant,
  type CreditReport,
  type HeldCard,
  type RefusedBecause,
} from '@yearafter/finance';
import { moveMoney, withCash } from './money';
import type { GameState } from './game-state';

/**
 * Where this character stands, with everything that feeds it.
 *
 * THE ONE PLACE `creditReport` IS CALLED FROM. It takes four arguments and the
 * fourth is utilisation, which only exists once 0306 gives somebody cards —
 * so every call site that forgot it would quietly report a DIFFERENT standing
 * from the one a lender uses. Two screens did exactly that for about five
 * minutes: the dashboard said Good and the application said Fair, for the same
 * character, in the same year.
 *
 * An invariant kept at three call sites is three promises (CORE_RULES 13.31).
 * This is the door.
 */
export const standingFor = (state: GameState): CreditReport =>
  creditReport(state.finance, state.world.year, state.player.age, utilisation(state.cards));

/**
 * What a lender sees when this character asks.
 *
 * Built in ONE place so the application screen and the decision itself cannot
 * disagree — a screen that computes its own view of an applicant is a second
 * derivation of the answer (CORE_RULES 13.23), and the failure mode is the
 * cruellest kind: a row that says you qualify and a button that says you do not.
 */
export function applicantFrom(state: GameState): Applicant {
  const report = standingFor(state);
  // Spec 26 says availability varies by income among other things. Last year's
  // actual take-home, because that is what a lender asks for and what the
  // ledger can prove.
  const lastYear = state.finance.transactions.filter(
    (entry) => entry.year === state.world.year && entry.amount > 0,
  );
  const income = Math.round(lastYear.reduce((sum, entry) => sum + Number(entry.amount), 0) / 100);
  return {
    standing: report.standing,
    income,
    savings: Math.round(Number(state.player.cash) / 100),
    employed: state.employment.job !== undefined,
    cards: state.cards,
  };
}

export type CardError = RefusedBecause | 'noSuchProduct' | 'noSuchCard' | 'nothingOwed' | 'noCash';

export interface CardOutcome {
  readonly state: GameState;
  readonly title: string;
  readonly body: string;
  readonly good: boolean;
}

/** Every product, and what a lender would say about each today. */
export const cardOffers = (state: GameState) => offersFor(applicantFrom(state));

/**
 * Apply.
 *
 * A refusal is an OUTCOME, not an error the screen has to translate — the
 * player pressed something and gets an answer where they pressed (CORE_RULES
 * 13.27). It says which of spec 26's tests they failed, because "declined" with
 * no reason is the opaque score 0305 exists to avoid, one screen over.
 */
export function applyForNewCard(
  state: GameState,
  productId: string,
): Result<CardOutcome, CardError> {
  const product = findProduct(productId);
  if (!product) return err('noSuchProduct');

  const applicant = applicantFrom(state);
  const decision = applyForCard(product, applicant);

  if (!decision.approved) {
    return ok({
      state,
      title: 'Declined',
      body: refusalFor(decision.because, product.name),
      good: false,
    });
  }

  const card: HeldCard = {
    productId: product.id,
    limit: decision.limit,
    balance: dollars(0),
    status: 'open',
  };

  /*
    A secured card takes its deposit now. `applyForCard` has already refused
    anybody who cannot cover it, so this never floors — but it goes through
    `moveMoney` like every other movement in the build, because a balance
    written any other way is the one defect 0301 and 0302 exist to prevent.
  */
  const deposit = product.securedBy;
  const moved =
    deposit > 0
      ? moveMoney(state, {
          category: 'debt',
          amount: dollars(-deposit),
          source: `${product.name} — security deposit`,
        })
      : undefined;

  return ok({
    state: {
      ...state,
      ...(moved ? { player: withCash(state.player, moved), finance: moved.finance } : {}),
      cards: [...state.cards, card],
    },
    title: 'Approved',
    body:
      deposit > 0
        ? `The ${product.name} is yours. You put up ${money(deposit * 100)} and that is your limit, at ${Math.round(product.apr * 100)}%.`
        : `The ${product.name} is yours, with a ${money(Number(decision.limit))} limit at ${Math.round(product.apr * 100)}%.`,
    good: true,
  });
}

function refusalFor(because: RefusedBecause | undefined, name: string): string {
  switch (because) {
    case 'tooManyCards':
      return 'You already hold as many cards as anybody will give you. Close one first.';
    case 'alreadyHeld':
      return `You already have a ${name}.`;
    case 'standing':
      return "Your credit isn't where it needs to be for this one yet.";
    case 'income':
      return "You don't earn enough for this card.";
    case 'tooMuchOwed':
      return 'You have as much credit as they will extend you across everything you hold.';
    case 'noDeposit':
      return "This one is secured — you put up the limit yourself, and you can't.";
    default:
      return "They said no, and didn't say much else.";
  }
}

/**
 * Pay something off.
 *
 * Takes an amount rather than paying it all, because the decision IS the
 * amount: a character with $4,000 and a $3,000 balance can clear it and have
 * nothing left, or pay half and keep a cushion. Clearing it for them would be
 * making that decision on their behalf.
 */
export function payCard(
  state: GameState,
  productId: string,
  amount: number,
): Result<CardOutcome, CardError> {
  const held = state.cards.find((card) => card.productId === productId);
  if (!held) return err('noSuchCard');
  if (Number(held.balance) <= 0) return err('nothingOwed');

  const cash = Math.round(Number(state.player.cash) / 100);
  if (cash <= 0) return err('noCash');

  const wanted = Math.max(0, Math.min(Math.round(amount), cash));
  const { card, paid } = payTowards(held, wanted);
  if (paid <= 0) return err('noCash');

  const product = findProduct(productId);
  const moved = moveMoney(state, {
    category: 'debt',
    amount: dollars(-paid),
    source: `${product?.name ?? 'Card'} — payment`,
  });

  const cards = state.cards.map((row) => (row.productId === productId ? card : row));
  const owed = Number(card.balance);
  return ok({
    state: {
      ...state,
      player: withCash(state.player, moved),
      finance: moved.finance,
      cards,
    },
    title: owed <= 0 ? 'Cleared' : 'Paid',
    body:
      owed <= 0
        ? `Paid ${money(paid * 100)} and the ${product?.name ?? 'card'} is clear.`
        : `Paid ${money(paid * 100)}. ${money(owed)} still on it.`,
    good: true,
  });
}

/**
 * Close one.
 *
 * REFUSED WHILE ANYTHING IS OWED, which is not the game being awkward: closing
 * a card with a balance would delete a debt, and a system where the way out of
 * money you owe is a Close button is the circular exploit spec 1381 asks to be
 * prevented, in its simplest form.
 */
export function closeCard(state: GameState, productId: string): Result<CardOutcome, CardError> {
  const held = state.cards.find((card) => card.productId === productId);
  if (!held) return err('noSuchCard');
  const product = findProduct(productId);
  if (Number(held.balance) > 0) {
    return ok({
      state,
      title: 'Still owing',
      body: `You owe ${money(Number(held.balance))} on the ${product?.name ?? 'card'}. Clear it and it closes.`,
      good: false,
    });
  }
  // A secured card gives the deposit back, which is what secured means and
  // what makes tying the money up a decision rather than a loss.
  const refund = product?.securedBy ?? 0;
  const moved =
    refund > 0
      ? moveMoney(state, {
          category: 'debt',
          amount: dollars(refund),
          source: `${product?.name ?? 'Card'} — deposit returned`,
        })
      : undefined;

  return ok({
    state: {
      ...state,
      ...(moved ? { player: withCash(state.player, moved), finance: moved.finance } : {}),
      cards: state.cards.filter((card) => card.productId !== productId),
    },
    title: 'Closed',
    body:
      refund > 0
        ? `The ${product?.name ?? 'card'} is closed and your ${money(refund * 100)} is back.`
        : `The ${product?.name ?? 'card'} is closed.`,
    good: true,
  });
}

/** What a limit would be, for a product they do not hold. For the offers list. */
export const limitIfApproved = (state: GameState, productId: string): number => {
  const product = findProduct(productId);
  return product ? Number(limitFor(product, applicantFrom(state))) : 0;
};

const money = (amountInCents: number): string =>
  `$${Math.round(amountInCents / 100).toLocaleString('en-US')}`;
