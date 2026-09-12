/**
 * Ticket 0306 acceptance tests — credit cards.
 *
 * Three things worth asserting here, in descending order of how expensive they
 * would be to discover late: the spec's caps and prohibitions, the exploit
 * loops spec 1381 asks to be prevented, and the arithmetic of a year.
 */

import { describe, expect, it } from 'vitest';
import { dollars } from '@yearafter/core';
import {
  CARD_PRODUCTS,
  MAX_ACTIVE_CARDS,
  MINIMUM_LIMIT,
  TOTAL_CREDIT_CEILING,
  applyForCard,
  availableOn,
  drawFrom,
  findProduct,
  limitFor,
  minimumOn,
  runCardYear,
  totalLimit,
  totalOwed,
  utilisation,
  type Applicant,
  type HeldCard,
} from './cards';

const card = (productId: string, limit: number, balance: number, frozen = false): HeldCard => ({
  productId,
  limit: dollars(limit),
  balance: dollars(balance),
  status: frozen ? 'frozen' : 'open',
});

const applicant = (over: Partial<Applicant> = {}): Applicant => ({
  standing: 'good',
  income: 60_000,
  savings: 10_000,
  employed: true,
  cards: [],
  ...over,
});

describe('what the spec caps and forbids', () => {
  it('ships eight products and no more', () => {
    // Spec 26: "Maximum card products/types available in the game: 8."
    expect(CARD_PRODUCTS).toHaveLength(8);
    expect(new Set(CARD_PRODUCTS.map((product) => product.id)).size).toBe(8);
  });

  it('lets nobody hold more than five', () => {
    // Spec 26 again, and the refusal says which rule it was.
    const full = CARD_PRODUCTS.slice(0, MAX_ACTIVE_CARDS).map((product) =>
      card(product.id, 2_000, 0),
    );
    expect(MAX_ACTIVE_CARDS).toBe(5);
    const decision = applyForCard(
      CARD_PRODUCTS[7]!,
      applicant({ cards: full, income: 400_000, standing: 'excellent' }),
    );
    expect(decision.approved).toBe(false);
    expect(decision.because).toBe('tooManyCards');
  });

  it('stores no opened date and no payment history', () => {
    /*
      Spec 28, by name: "Do not store/display opened date or payment-history
      timeline." Asserted on the SHAPE rather than trusted to review, because a
      field is easy to add and impossible to remove once saves have written it
      — which is the whole of 0207c.
    */
    const held = card('card.everyday', 5_000, 1_200);
    expect(Object.keys(held).sort()).toEqual(['balance', 'limit', 'productId', 'status']);
  });

  it('carries every field spec 28 does ask for', () => {
    for (const product of CARD_PRODUCTS) {
      expect(product.issuer.length, product.id).toBeGreaterThan(0);
      expect(product.apr, product.id).toBeGreaterThan(0);
      expect(product.annualFee, product.id).toBeGreaterThanOrEqual(0);
      expect(product.rewards, product.id).toBeTruthy();
      expect(product.baseLimit, product.id).toBeGreaterThan(0);
    }
    const held = card('card.everyday', 5_000, 1_200);
    expect(Number(availableOn(held))).toBe(dollars(3_800));
    expect(Number(minimumOn(held))).toBeGreaterThan(0);
  });

  it('freezes a card it cannot collect on, and never sues', () => {
    /*
      Spec 32: "Remove litigation as a standard consequence." The honest
      remaining consequence is that the card stops working — the balance stays,
      the limit stays, and nothing new goes on it.
    */
    const year = runCardYear([card('card.everyday', 5_000, 3_000)], 0);
    expect(year.frozen).toEqual(['card.everyday']);
    expect(year.cards[0]?.status).toBe('frozen');
    // And it is recoverable, because credit that cannot be repaired is
    // punitive in exactly the way spec 1381 rules out.
    const back = runCardYear(year.cards, 5_000);
    expect(back.unfrozen).toEqual(['card.everyday']);
    expect(back.cards[0]?.status).toBe('open');
  });
});

describe('the exploit loops spec 1381 asks to be prevented', () => {
  it('caps total credit against income, however many cards are held', () => {
    /*
      THE IMPORTANT ONE. Without a ceiling on total exposure, five cards each
      sized against income would hand a character five times their income in
      credit — and since a card covers a shortfall, that makes next year's
      shortfall bigger rather than smaller. Every card after the first is sized
      against the room left under one ceiling.
    */
    const income = 60_000;
    let held: HeldCard[] = [];
    for (const product of CARD_PRODUCTS) {
      const decision = applyForCard(
        product,
        applicant({ income, cards: held, standing: 'excellent' }),
      );
      if (decision.approved) held = [...held, card(product.id, Number(decision.limit) / 100, 0)];
      if (held.length >= MAX_ACTIVE_CARDS) break;
    }
    expect(held.length).toBeGreaterThan(1);
    expect(Number(totalLimit(held)) / 100).toBeLessThanOrEqual(income * TOTAL_CREDIT_CEILING + 100);
  });

  it('refuses a card rather than issuing a limit of nothing', () => {
    // At the ceiling, the honest answer is no. A $50 limit would be a card
    // that exists to be disappointing.
    const maxed = [card('card.everyday', 33_000, 0)];
    const decision = applyForCard(CARD_PRODUCTS[3]!, applicant({ income: 60_000, cards: maxed }));
    expect(decision.approved).toBe(false);
    expect(decision.because).toBe('tooMuchOwed');
    expect(MINIMUM_LIMIT).toBeGreaterThan(0);
  });

  it('never draws on a frozen card', () => {
    // Frozen has to mean frozen, or a delinquent character simply keeps
    // spending and the consequence is decorative.
    const result = drawFrom([card('card.everyday', 5_000, 0, true)], 2_000);
    expect(result.drawn).toBe(0);
    expect(Number(result.cards[0]?.balance)).toBe(0);
  });

  it('never draws more than the room available', () => {
    const result = drawFrom([card('card.starter', 2_400, 2_000)], 5_000);
    expect(result.drawn).toBe(400);
    expect(Number(totalOwed(result.cards)) / 100).toBe(2_400);
  });
});

describe('utilisation', () => {
  it('is undefined for somebody with no cards, not zero', () => {
    /*
      CORE_RULES 13.46, which this build learned one ticket ago with payment
      behaviour. Zero utilisation is the BEST possible value, so reporting zero
      for a character with no cards would award everybody in the game a flawless
      credit behaviour they have never demonstrated.
    */
    expect(utilisation([])).toBeUndefined();
    expect(utilisation([card('card.everyday', 5_000, 0)])).toBe(0);
  });

  it('is what is owed over what could be', () => {
    expect(utilisation([card('card.everyday', 5_000, 2_500)])).toBeCloseTo(0.5, 6);
    expect(
      utilisation([card('card.everyday', 5_000, 5_000), card('card.starter', 5_000, 0)]),
    ).toBeCloseTo(0.5, 6);
  });
});

describe('a year of holding one', () => {
  it('capitalises interest onto the balance rather than billing it', () => {
    /*
      The reason a card can get away from somebody. A character who cannot pay
      is not billed for interest they also cannot pay — the balance grows, which
      is what actually happens and what makes the minimum worth making.
    */
    const product = findProduct('card.everyday')!;
    const year = runCardYear([card('card.everyday', 5_000, 1_000)], 0);
    expect(Number(year.cards[0]?.balance) / 100).toBeCloseTo(1_000 * (1 + product.apr), 0);
    expect(year.charges).toHaveLength(0);
    expect(year.interest).toBeGreaterThan(0);
  });

  it('takes the minimum when there is money for it, as a real ledger charge', () => {
    const year = runCardYear([card('card.everyday', 5_000, 4_000)], 10_000);
    expect(year.charges).toHaveLength(1);
    expect(Number(year.charges[0]?.amount)).toBeLessThan(0);
    expect(Number(year.cards[0]?.balance)).toBeLessThan(dollars(4_000 * 1.234));
  });

  it('charges the annual fee to the card, not to the character', () => {
    // A fee goes on the card, which is how a card works, and means a broke
    // character is not pushed further into shortfall by holding one.
    const withFee = runCardYear([card('card.premium', 25_000, 0)], 0);
    expect(Number(withFee.cards[0]?.balance) / 100).toBeGreaterThan(400);
  });

  it('clears rather than overshooting, and never goes below zero', () => {
    const year = runCardYear([card('card.starter', 2_400, 40)], 50_000);
    expect(Number(year.cards[0]?.balance)).toBeGreaterThanOrEqual(0);
  });

  it('asks a bigger balance for more, with a floor so a small one still clears', () => {
    const small = Number(minimumOn(card('card.starter', 2_400, 400)));
    const large = Number(minimumOn(card('card.travel', 14_000, 9_000)));
    expect(large).toBeGreaterThan(small);
    // Never more than is owed: a minimum payment bigger than the debt would
    // have a character paying a card that owes them money.
    expect(Number(minimumOn(card('card.starter', 2_400, 90)))).toBe(dollars(90));
  });
});

describe('who gets what', () => {
  it('puts every product behind a standing and an income', () => {
    // Spec 26: availability varies by income, credit and the rest. A product
    // anybody can get at any time is not a product, it is a default.
    const broke = applicant({ standing: 'poor', income: 0, savings: 0, employed: false });
    const approved = CARD_PRODUCTS.filter((product) => applyForCard(product, broke).approved);
    expect(approved.length).toBeLessThanOrEqual(1);
  });

  it('gives somebody at the bottom exactly one way in', () => {
    /*
      CORE_RULES 13.7 and spec 1381: credit that is useful rather than punitive
      needs a first rung, or the ladder starts above the ground — which is what
      the first version of this file did. Every limit is sized against income,
      so a character with poor standing and no income was approved for NOTHING,
      the same shape as the $9,000 wedding in a build where nobody had $9,000.

      The rung is a secured card, backed by the applicant's own deposit rather
      than by an income they do not have.
    */
    const bottom = applicant({ standing: 'poor', income: 0, savings: 2_000, employed: false });
    const approved = CARD_PRODUCTS.filter((product) => applyForCard(product, bottom).approved);
    expect(approved).toHaveLength(1);
    expect(approved[0]?.id).toBe('card.secured');
  });

  it('and gives somebody with literally nothing no way in, which is the truth', () => {
    // Not a gap in the ladder. A secured card is secured BY something, and a
    // character with no income and no savings has nothing to secure it with.
    // Pretending otherwise would make the deposit decorative.
    const nothing = applicant({ standing: 'poor', income: 0, savings: 0, employed: false });
    for (const product of CARD_PRODUCTS) {
      expect(applyForCard(product, nothing).approved, product.id).toBe(false);
    }
    expect(applyForCard(CARD_PRODUCTS[0]!, nothing).because).toBe('noDeposit');
  });

  it('hands the deposit back as a limit, and only the secured card has one', () => {
    const secured = CARD_PRODUCTS.filter((product) => product.securedBy > 0);
    expect(secured).toHaveLength(1);
    expect(Number(limitFor(secured[0]!, applicant({ income: 0, savings: 5_000 }))) / 100).toBe(
      secured[0]!.securedBy,
    );
  });

  it('gives a better earner a bigger limit on the same product', () => {
    const product = findProduct('card.everyday')!;
    const modest = Number(limitFor(product, applicant({ income: 30_000 })));
    const comfortable = Number(limitFor(product, applicant({ income: 90_000 })));
    expect(comfortable).toBeGreaterThan(modest);
  });

  it('rounds a limit to something a lender would actually say', () => {
    for (const product of CARD_PRODUCTS) {
      const limit = Number(limitFor(product, applicant({ income: 77_777 }))) / 100;
      expect(limit % 100, product.id).toBe(0);
    }
  });
});
