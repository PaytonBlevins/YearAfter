import { summariseFinances } from './summary';
import { describe, expect, it } from 'vitest';
import { cents, dollars } from '@yearafter/core';
import { EMPTY_LEDGER, post, reconcile } from './ledger';
import { minimumOn, runCardYear, type HeldCard } from './cards';
import { payPurchase, purchaseEligibility, type PurchasePayment } from './purchase-payment';
const first: HeldCard = {
  productId: 'card.starter',
  limit: dollars(1000),
  balance: dollars(400),
  status: 'open',
};
const second: HeldCard = {
  productId: 'card.private',
  limit: dollars(50000),
  balance: cents(0),
  status: 'open',
};
const card: PurchasePayment = { kind: 'card', productId: first.productId };
const ledger = post(EMPTY_LEDGER, 2026, 30, {
  category: 'gift',
  amount: dollars(17),
  source: 'Test savings',
}).ledger;

describe('explicit purchase payments', () => {
  it.each(['property', 'investment', 'spending', 'housing', 'vehicle'] as const)(
    'charges the selected card for %s with exact ledger reconciliation and unchanged cash',
    (category) => {
      const result = payPurchase(
        ledger,
        [second, first],
        2026,
        30,
        dollars(600),
        category,
        'A purchase',
        card,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.cards[0]).toBe(second);
      expect(result.value.cards[1]?.balance).toBe(dollars(1000));
      expect(result.value.ledger.balance).toBe(ledger.balance);
      expect(
        result.value.ledger.transactions
          .slice(-2)
          .map(({ category, amount }) => ({ category, amount })),
      ).toEqual([
        { category: 'debt', amount: dollars(600) },
        { category, amount: dollars(-600) },
      ]);
      expect(result.value.ledger.transactions.at(-1)?.source).toContain('Starter Card');
      expect(reconcile(result.value.ledger).ok).toBe(true);
      expect(first.balance).toBe(dollars(400));
      expect(ledger.transactions).toHaveLength(1);
    },
  );
  it('never presents borrowed purchase funds as income or an asset transfer as outflow', () => {
    const result = payPurchase(
      ledger,
      [first],
      2026,
      30,
      dollars(600),
      'property',
      'A watch',
      card,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const summary = summariseFinances(result.value.ledger, 2026);
    expect(summary.income).toBe(dollars(17));
    expect(summary.monthlyOutflow).toBe(cents(0));
  });
  it('keeps exact cents without rounding or a separate purchase cap', () => {
    const result = payPurchase(
      ledger,
      [second],
      2026,
      30,
      cents(4_999_999),
      'spending',
      'A vacation',
      { kind: 'card', productId: second.productId },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cards[0]?.balance).toBe(cents(4_999_999));
    expect(result.value.ledger.balance).toBe(ledger.balance);
  });
  it.each([
    ['payment-credit-short', [first], cents(60001), card],
    ['payment-card-frozen', [{ ...first, status: 'frozen' as const }], dollars(600), card],
    ['payment-card-missing', [], dollars(1), card],
    [
      'payment-card-missing',
      [{ ...first, productId: 'unknown' }],
      dollars(1),
      { kind: 'card', productId: 'unknown' },
    ],
    ['payment-cash-short', [first], dollars(18), { kind: 'cash' }],
    ['payment-invalid-amount', [first], cents(-1), card],
  ] as const)('refuses %s without changing the inputs', (reason, cards, total, payment) => {
    const before = JSON.stringify({ ledger, cards });
    expect(purchaseEligibility(ledger.balance, cards, total, payment)).toBe(reason);
    expect(payPurchase(ledger, cards, 2026, 30, total, 'property', 'A purchase', payment)).toEqual({
      ok: false,
      error: reason,
    });
    expect(JSON.stringify({ ledger, cards })).toBe(before);
  });
  it('refuses a changed confirmation quote before charging', () => {
    const selected = { ...card, expectedTotal: dollars(599) };
    expect(
      payPurchase(ledger, [first], 2026, 30, dollars(600), 'property', 'A purchase', selected),
    ).toEqual({ ok: false, error: 'payment-price-changed' });
    expect(first.balance).toBe(dollars(400));
  });
  it('does not aggregate cash and insufficient cards', () => {
    expect(
      payPurchase(
        ledger,
        [first, { ...second, limit: dollars(600) }],
        2026,
        30,
        dollars(800),
        'spending',
        'A purchase',
        card,
      ).ok,
    ).toBe(false);
  });
  it('defaults to cash and never draws on cards without a choice', () => {
    const result = payPurchase(ledger, [first], 2026, 30, dollars(17), 'spending', 'A purchase');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cards[0]).toBe(first);
    expect(result.value.ledger.balance).toBe(cents(0));
    expect(result.value.ledger.transactions.at(-1)?.amount).toBe(dollars(-17));
    expect(result.value.ledger.transactions).toHaveLength(2);
  });
  it('feeds normal interest, minimum payments and freezing on the next year', () => {
    const result = payPurchase(
      ledger,
      [first],
      2026,
      30,
      dollars(600),
      'spending',
      'A purchase',
      card,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(minimumOn(result.value.cards[0] ?? first)).toBe(dollars(300));
    const next = runCardYear(result.value.cards, 0);
    expect(next.interest).toBe(265);
    expect(next.cards[0]?.balance).toBe(dollars(1265));
    expect(next.cards[0]?.status).toBe('frozen');
  });
});
