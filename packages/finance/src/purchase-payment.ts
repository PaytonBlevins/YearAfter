import { cents, err, ok, type Money, type Result } from '@yearafter/core';
import { drawableOn, findProduct, type HeldCard } from './cards';
import { postAll, type Ledger, type TransactionCategory } from './ledger';

/** One explicit source pays the full purchase; never an automatic card draw. */
export type PurchasePayment =
  | { readonly kind: 'cash'; readonly expectedTotal?: Money }
  | { readonly kind: 'card'; readonly productId: string; readonly expectedTotal?: Money };
export type PaymentRefusal =
  | 'payment-finance-conflict'
  | 'payment-price-changed'
  | 'payment-invalid-amount'
  | 'payment-cash-short'
  | 'payment-card-missing'
  | 'payment-card-frozen'
  | 'payment-credit-short';
export interface PaymentProblem {
  readonly kind: 'payment';
  readonly reason: PaymentRefusal;
}

export const PAYMENT_REFUSAL_LABELS: Readonly<Record<PaymentRefusal, string>> = {
  'payment-finance-conflict': 'Choose either a card or a loan for this purchase.',
  'payment-price-changed': 'The price changed. Check the new total and choose how to pay again.',
  'payment-invalid-amount': "That purchase price isn't available. Try again.",
  'payment-cash-short': "You don't have enough cash for that.",
  'payment-card-missing': "You don't have that card any more.",
  'payment-card-frozen': 'That card is frozen. Catch up on payments before using it.',
  'payment-credit-short': "That card doesn't have enough available credit for the full purchase.",
};

export function purchaseEligibility(
  cash: Money,
  cards: readonly HeldCard[],
  total: Money,
  payment: PurchasePayment,
): PaymentRefusal | undefined {
  if (!Number.isSafeInteger(total) || total < 0) return 'payment-invalid-amount';
  if (payment.expectedTotal !== undefined && payment.expectedTotal !== total)
    return 'payment-price-changed';
  if (payment.kind === 'cash') return cash >= total ? undefined : 'payment-cash-short';
  const card = cards.find((held) => held.productId === payment.productId);
  if (!card || !findProduct(card.productId)) return 'payment-card-missing';
  if (card.status !== 'open') return 'payment-card-frozen';
  return drawableOn(card) >= total ? undefined : 'payment-credit-short';
}

export function paymentNote(payment: PurchasePayment): string {
  return payment.kind === 'card'
    ? ` Paid with ${findProduct(payment.productId)?.name ?? 'your card'}.`
    : '';
}

/**
 * Call after all domain gates and pricing. The advance and purchase are one
 * immutable result, so no funded intermediate state can reach a save or UI.
 * Posting both preserves the existing cash-ledger and transfer categories.
 */
export function payPurchase(
  ledger: Ledger,
  cards: readonly HeldCard[],
  year: number,
  age: number,
  total: Money,
  category: TransactionCategory,
  source: string,
  payment: PurchasePayment = { kind: 'cash' },
): Result<{ readonly ledger: Ledger; readonly cards: readonly HeldCard[] }, PaymentRefusal> {
  const refusal = purchaseEligibility(ledger.balance, cards, total, payment);
  if (refusal) return err(refusal);
  const product = payment.kind === 'card' ? findProduct(payment.productId) : undefined;
  const nextCards =
    payment.kind === 'card'
      ? cards.map((card) =>
          card.productId === payment.productId
            ? { ...card, balance: cents(card.balance + total) }
            : card,
        )
      : cards;
  const books = postAll(ledger, year, age, [
    ...(product && total > 0
      ? [
          {
            category: 'debt' as const,
            amount: total,
            source: `${product.name} — payment for ${source}`,
          },
        ]
      : []),
    {
      category,
      amount: cents(-total),
      source: `${source}${product ? ` — paid with ${product.name}` : ''}`,
    },
  ]);
  return ok({ ledger: books.ledger, cards: nextCards });
}
