/**
 * Ticket 0306 — credit cards.
 *
 * THE FIRST THING IN THIS BUILD THAT LETS A CHARACTER SPEND MONEY THEY DO NOT
 * HAVE. Everything before it floored at zero: `post` clamps a charge to the
 * balance and writes the unpaid part down as a `shortfall` row, because there
 * was nowhere to fall. A card is the somewhere.
 *
 * MEASURED FIRST, across 120 played lives:
 *
 *   58 of 120 lives come up short at least once   (3.5% of adult years)
 *   the unpaid amount   p10 $1,488   median $3,333   p90 $4,870   max $10,418
 *   what for            living costs (162), treatment (98)
 *   when                spread across every decade of adult life
 *
 * So the demand is real and it is small — a few thousand dollars, usually a bad
 * year rather than a habit. That sets the limits: a starter card at $1,200
 * covers a third of them and a good card at $18,000 covers all of them, which
 * is what makes which card you hold a thing that matters.
 *
 * WHAT THE SPEC ALLOWS AND FORBIDS
 *
 *   Spec 26: five active cards, eight products in the game, availability varies
 *            by income, credit, net worth, debt, employment and status.
 *   Spec 28: card product, issuer, limit, balance, available credit, APR,
 *            minimum payment, rewards type, annual fee, status — and DO NOT
 *            store or display an opened date or a payment-history timeline.
 *   Spec 32: no litigation as a consequence of delinquency.
 *   Spec 1381: prevent circular credit exploits internally.
 *
 * `HeldCard` therefore has no `openedAt` and no history array, and a test
 * asserts that it never grows one — the field is easy to add and impossible to
 * remove once a save has written it (0207c).
 *
 * A MONTHLY INSTRUMENT IN A YEARLY GAME, and spec 21 forbids showing
 * month-by-month accounting. So everything here is annual: interest is a year's
 * interest, the minimum payment is a year of minimums, and there is no
 * statement, no due date and no schedule. The player's decisions are which card
 * to hold and how fast to pay it down; the rest happens to them.
 */

import { cents, dollars, type Money } from '@yearafter/core';
import type { CreditStanding } from './credit';
import { atLeast } from './credit';

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* -------------------------------------------------------------------------- */

/** Spec 28's "rewards type". Four kinds, and one of them is none. */
export type Rewards = 'none' | 'cashback' | 'points' | 'miles';

export const REWARD_LABELS: Readonly<Record<Rewards, string>> = {
  none: 'No rewards',
  cashback: 'Cash back',
  points: 'Points',
  miles: 'Air miles',
};

export interface CardProduct {
  readonly id: string;
  readonly name: string;
  /** Spec 28. A recognisable fictional analogue, per the build's naming rule. */
  readonly issuer: string;
  /** Annual rate, as a share. Worse credit pays more, which is the whole idea. */
  readonly apr: number;
  /** Charged every year the card is open, whether or not it is used. */
  readonly annualFee: number;
  readonly rewards: Rewards;
  /** Share of what was spent that comes back. Zero when `rewards` is none. */
  readonly rewardRate: number;
  /** The floor the applicant's standing has to clear. */
  readonly needs: CreditStanding;
  /** And the income, in whole dollars. */
  readonly needsIncome: number;
  /** Base limit before income and standing are taken into account. */
  readonly baseLimit: number;
  /**
   * A deposit that backs the limit, in whole dollars. Zero for a normal card.
   *
   * THE BOTTOM RUNG OF THE LADDER, and it exists because the first version did
   * not have one: a character with poor standing and no income was approved for
   * nothing at all, because every limit is sized against income and theirs was
   * zero. That is CORE_RULES 13.16 — the ladder starting above the ground — and
   * it is the same failure as the $9,000 wedding in a build where nobody had
   * $9,000.
   *
   * A secured card is not underwritten, it is BACKED: the money is yours, tied
   * up, and you get it back when you close the card. So its limit ignores the
   * income ceiling entirely, and what it costs is not being able to spend the
   * deposit — which is a real decision rather than a free card with no downside.
   */
  readonly securedBy: number;
  /** One short line for the application screen. */
  readonly blurb: string;
}

/**
 * Eight products, which is spec 26's ceiling exactly.
 *
 * Ordered from the card anybody can get to the one almost nobody can. That
 * order is the progression: a character with nothing starts on a secured card
 * at 29% and works up, and the difference between the top and the bottom of
 * this table is about eleven thousand dollars of limit and eighteen points of
 * APR. Spec 1381 asks for credit that is useful rather than punitive, and the
 * useful part is that the ladder exists.
 *
 * Names are fictional analogues rather than real issuers, which is the same
 * rule v0.05 applies to vehicles.
 */
export const CARD_PRODUCTS: readonly CardProduct[] = [
  {
    id: 'card.secured',
    name: 'Secured Card',
    issuer: 'Northgate Bank',
    apr: 0.29,
    annualFee: 39,
    rewards: 'none',
    rewardRate: 0,
    needs: 'poor',
    needsIncome: 0,
    baseLimit: 1_200,
    securedBy: 1_200,
    blurb: 'You put up the limit yourself and get it back when you close it.',
  },
  {
    id: 'card.starter',
    name: 'Starter Card',
    issuer: 'Northgate Bank',
    apr: 0.265,
    annualFee: 0,
    rewards: 'none',
    rewardRate: 0,
    needs: 'fair',
    needsIncome: 14_000,
    baseLimit: 2_400,
    securedBy: 0,
    blurb: 'No fee, no rewards, and it does the job.',
  },
  {
    id: 'card.everyday',
    name: 'Everyday Cash',
    issuer: 'Meridian',
    apr: 0.234,
    annualFee: 0,
    rewards: 'cashback',
    rewardRate: 0.012,
    needs: 'fair',
    needsIncome: 26_000,
    baseLimit: 5_000,
    securedBy: 0,
    blurb: 'A little back on everything you spend.',
  },
  {
    id: 'card.points',
    name: 'Rewards Card',
    issuer: 'Meridian',
    apr: 0.219,
    annualFee: 0,
    rewards: 'points',
    rewardRate: 0.015,
    needs: 'good',
    needsIncome: 38_000,
    baseLimit: 9_000,
    securedBy: 0,
    blurb: 'Points on everything, and no fee to hold it.',
  },
  {
    id: 'card.travel',
    name: 'Travel Card',
    issuer: 'Halcyon',
    apr: 0.205,
    annualFee: 95,
    rewards: 'miles',
    rewardRate: 0.02,
    needs: 'good',
    needsIncome: 55_000,
    baseLimit: 14_000,
    securedBy: 0,
    blurb: 'Miles worth having, if you spend enough to cover the fee.',
  },
  {
    id: 'card.business',
    name: 'Business Card',
    issuer: 'Halcyon',
    apr: 0.199,
    annualFee: 0,
    rewards: 'cashback',
    rewardRate: 0.018,
    needs: 'good',
    needsIncome: 62_000,
    baseLimit: 16_000,
    securedBy: 0,
    blurb: 'Meant for a business. They rarely check.',
  },
  {
    id: 'card.premium',
    name: 'Premium Card',
    issuer: 'Halcyon',
    apr: 0.185,
    annualFee: 450,
    rewards: 'miles',
    rewardRate: 0.028,
    needs: 'excellent',
    needsIncome: 95_000,
    baseLimit: 25_000,
    securedBy: 0,
    blurb: 'A large fee and a larger limit. The metal is the point.',
  },
  {
    id: 'card.private',
    name: 'Private Client Card',
    issuer: 'Ashcroft Private',
    apr: 0.109,
    annualFee: 750,
    rewards: 'points',
    rewardRate: 0.025,
    needs: 'excellent',
    needsIncome: 180_000,
    baseLimit: 45_000,
    securedBy: 0,
    blurb: 'By invitation, which in practice means by balance.',
  },
];

export const findProduct = (id: string): CardProduct | undefined =>
  CARD_PRODUCTS.find((product) => product.id === id);

/* -------------------------------------------------------------------------- */
/* A card somebody holds                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Spec 28's "account status", and there are only three.
 *
 * `frozen` is what delinquency does here. Spec 32 removes litigation as a
 * consequence, and the honest remaining one is that the card stops working:
 * the limit is still there, the balance is still owed, and nothing new goes on
 * it until it is brought back under control. No lawyers, no collections
 * minigame, no letters.
 */
export type CardStatus = 'open' | 'frozen';

/**
 * NOTE WHAT IS NOT HERE: no opened date, no payment history, no statement list.
 * Spec 28 rules all three out by name, and a test asserts this shape so that a
 * later ticket cannot add one by habit — a field is easy to add and impossible
 * to remove once saves have written it (0207c's whole lesson).
 */
export interface HeldCard {
  readonly productId: string;
  readonly limit: Money;
  readonly balance: Money;
  readonly status: CardStatus;
}

export const MAX_ACTIVE_CARDS = 5;

export const availableOn = (card: HeldCard): Money =>
  cents(Math.max(0, Number(card.limit) - Number(card.balance)));

/** What can actually be drawn: nothing on a frozen card. */
export const drawableOn = (card: HeldCard): Money =>
  card.status === 'frozen' ? cents(0) : availableOn(card);

export const totalOwed = (cards: readonly HeldCard[]): Money =>
  cents(cards.reduce((sum, card) => sum + Number(card.balance), 0));

export const totalLimit = (cards: readonly HeldCard[]): Money =>
  cents(cards.reduce((sum, card) => sum + Number(card.limit), 0));

export const totalDrawable = (cards: readonly HeldCard[]): Money =>
  cents(cards.reduce((sum, card) => sum + Number(drawableOn(card)), 0));

/**
 * Utilisation: what is owed as a share of what could be.
 *
 * Spec 25 names this as one of the six things credit is made of, and until this
 * ticket it was the first entry in `CREDIT_INPUTS_NOT_YET_BUILT` — there was
 * nothing to utilise. A character with no cards has no utilisation rather than
 * perfect utilisation, which is why this returns undefined rather than zero:
 * zero would quietly tell the credit model that everybody with no cards is
 * running a flawless one.
 */
export function utilisation(cards: readonly HeldCard[]): number | undefined {
  const limit = Number(totalLimit(cards));
  if (limit <= 0) return undefined;
  return Math.max(0, Math.min(1, Number(totalOwed(cards)) / limit));
}

/* -------------------------------------------------------------------------- */
/* Getting one                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What a lender is looking at. Spec 26's list, minus the parts that do not
 * exist: net worth is the balance, debt is what is already on cards, and
 * fame/status waits for v0.07.
 */
export interface Applicant {
  readonly standing: CreditStanding;
  /** Whole dollars a year. */
  readonly income: number;
  readonly savings: number;
  readonly employed: boolean;
  readonly cards: readonly HeldCard[];
}

export type RefusedBecause =
  'tooManyCards' | 'alreadyHeld' | 'standing' | 'income' | 'tooMuchOwed' | 'noDeposit';

export interface Decision {
  readonly approved: boolean;
  readonly because?: RefusedBecause;
  /** The limit they would get, when approved. */
  readonly limit: Money;
}

/**
 * How much of their income a lender will let ride on cards in total.
 *
 * SPEC 1381'S CIRCULAR-EXPLOIT GUARD, and it is the important one in this file.
 * Without a ceiling on total exposure, five cards each sized against income
 * would hand a character five times their income in credit, and a card that
 * covers a shortfall makes the next year's shortfall bigger rather than
 * smaller. This is what stops the spiral: every card after the first is sized
 * against the room left under one ceiling, not against income afresh.
 */
export const TOTAL_CREDIT_CEILING = 0.55;

/** Base limit is scaled by income and by standing, then capped by the ceiling. */
export function limitFor(product: CardProduct, applicant: Applicant): Money {
  // A secured card is backed by the applicant's own money, so income and the
  // total-credit ceiling have nothing to say about it. The limit IS the deposit.
  if (product.securedBy > 0) return dollars(product.securedBy);
  const room = Math.max(
    0,
    applicant.income * TOTAL_CREDIT_CEILING - Number(totalLimit(applicant.cards)) / 100,
  );
  const byIncome = Math.min(
    2.2,
    Math.max(0.4, applicant.income / Math.max(1, product.needsIncome)),
  );
  const byStanding = atLeast(applicant.standing, 'excellent')
    ? 1.25
    : atLeast(applicant.standing, 'good')
      ? 1
      : 0.7;
  const wanted = product.baseLimit * byIncome * byStanding;
  // Rounded to the nearest hundred, because no lender in the world issues a
  // limit of $4,137 and a player reading one would wonder what it meant.
  return dollars(Math.max(0, Math.round(Math.min(wanted, room) / 100) * 100));
}

/** The smallest limit worth issuing. Below this a lender says no instead. */
export const MINIMUM_LIMIT = 500;

export function applyForCard(product: CardProduct, applicant: Applicant): Decision {
  const open = applicant.cards.length;
  if (open >= MAX_ACTIVE_CARDS)
    return { approved: false, because: 'tooManyCards', limit: cents(0) };
  if (applicant.cards.some((card) => card.productId === product.id)) {
    return { approved: false, because: 'alreadyHeld', limit: cents(0) };
  }
  if (!atLeast(applicant.standing, product.needs)) {
    return { approved: false, because: 'standing', limit: cents(0) };
  }
  if (applicant.income < product.needsIncome) {
    return { approved: false, because: 'income', limit: cents(0) };
  }
  if (product.securedBy > 0 && applicant.savings < product.securedBy) {
    return { approved: false, because: 'noDeposit', limit: cents(0) };
  }
  const limit = limitFor(product, applicant);
  if (Number(limit) / 100 < MINIMUM_LIMIT) {
    // They clear the bar on paper and there is no room left under the ceiling.
    return { approved: false, because: 'tooMuchOwed', limit: cents(0) };
  }
  return { approved: true, limit };
}

/** Every product, with what a lender would say about it today. */
export const offersFor = (
  applicant: Applicant,
): readonly { readonly product: CardProduct; readonly decision: Decision }[] =>
  CARD_PRODUCTS.map((product) => ({ product, decision: applyForCard(product, applicant) }));

/* -------------------------------------------------------------------------- */
/* A year of holding one                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The share of a balance a lender wants back each year.
 *
 * A real card asks for 1–3% a month, which is 12–36% a year and would clear a
 * balance in three or four years if nothing else went on it. Annual because the
 * game is annual; there is no schedule and no due date, because spec 21 forbids
 * putting month-by-month accounting in front of the player.
 */
export const MINIMUM_SHARE = 0.22;
export const MINIMUM_FLOOR = 300;

export function minimumOn(card: HeldCard): Money {
  const owed = Number(card.balance) / 100;
  if (owed <= 0) return cents(0);
  return dollars(Math.min(owed, Math.max(MINIMUM_FLOOR, Math.round(owed * MINIMUM_SHARE))));
}

export const minimumDue = (cards: readonly HeldCard[]): Money =>
  cents(cards.reduce((sum, card) => sum + Number(minimumOn(card)), 0));

export interface CardCharge {
  /** Signed cents, as the ledger wants it. Negative is money leaving. */
  readonly amount: Money;
  readonly source: string;
}

export interface CardYear {
  readonly cards: readonly HeldCard[];
  readonly charges: readonly CardCharge[];
  /** Whole dollars of interest added to balances this year. */
  readonly interest: number;
  /** Cards that went delinquent this year, by product id. */
  readonly frozen: readonly string[];
  /** Cards that came back into good standing this year. */
  readonly unfrozen: readonly string[];
}

/**
 * Interest and fees, and what the year asks for back.
 *
 * INTEREST CAPITALISES ONTO THE BALANCE rather than being charged to cash, and
 * that is the whole reason a card can get away from somebody. A character who
 * cannot pay is not billed for interest they also cannot pay — the balance
 * simply grows, which is what actually happens and what makes the minimum
 * payment worth making.
 *
 * The annual fee is charged to the BALANCE too, for the same reason and because
 * it is how a card works: the fee goes on the card.
 */
export function runCardYear(cards: readonly HeldCard[], canPay: number): CardYear {
  const charges: CardCharge[] = [];
  const frozen: string[] = [];
  const unfrozen: string[] = [];
  let interest = 0;
  let purse = Math.max(0, canPay);

  const next = cards.map((card) => {
    const product = findProduct(card.productId);
    if (!product) return card;

    let owed = Number(card.balance) / 100;
    // Fee first, then interest on what is owed including it — a fee posted on
    // day one accrues like anything else, and a fee that did not would be a
    // rounding kindness the player never asked for.
    if (product.annualFee > 0) owed += product.annualFee;
    const charge = owed > 0 ? Math.round(owed * product.apr) : 0;
    owed += charge;
    interest += charge;

    const withCharges: HeldCard = { ...card, balance: dollars(Math.round(owed)) };
    const minimum = Number(minimumOn(withCharges)) / 100;

    /*
      Spec 32: delinquency is NOT litigation. A card that cannot be paid is
      frozen — the balance stays, the limit stays, and nothing new goes on it.
      Nobody sues, nobody calls, and there is no collections minigame. It comes
      back the year the minimum is met again, because credit that can never be
      repaired is punitive in exactly the way spec 1381 rules out.
    */
    if (minimum <= 0) {
      if (card.status === 'frozen') unfrozen.push(card.productId);
      return { ...withCharges, status: 'open' as const };
    }
    if (purse >= minimum) {
      purse -= minimum;
      charges.push({
        amount: dollars(-minimum),
        source: `${product.name} — payment`,
      });
      const after = Math.max(0, Math.round(owed - minimum));
      if (card.status === 'frozen') unfrozen.push(card.productId);
      return { ...withCharges, balance: dollars(after), status: 'open' as const };
    }
    if (card.status !== 'frozen') frozen.push(card.productId);
    return { ...withCharges, status: 'frozen' as const };
  });

  return { cards: next, charges, interest, frozen, unfrozen };
}

/**
 * Put money on a card, cheapest rate first.
 *
 * Cheapest first because that is what a person does and because the alternative
 * — first in the list — would make the order cards were opened in a hidden
 * mechanic. Frozen cards are skipped: that is what frozen means.
 */
export function drawFrom(
  cards: readonly HeldCard[],
  wanted: number,
): {
  readonly cards: readonly HeldCard[];
  readonly drawn: number;
  readonly onto: readonly string[];
} {
  let left = Math.max(0, wanted);
  const onto: string[] = [];
  const order = [...cards]
    .map((card, index) => ({ card, index, apr: findProduct(card.productId)?.apr ?? 1 }))
    .sort((a, b) => a.apr - b.apr);

  const next = [...cards];
  for (const row of order) {
    if (left <= 0) break;
    const room = Number(drawableOn(row.card)) / 100;
    if (room <= 0) continue;
    const take = Math.min(room, left);
    left -= take;
    next[row.index] = {
      ...row.card,
      balance: dollars(Math.round(Number(row.card.balance) / 100 + take)),
    };
    onto.push(row.card.productId);
  }
  return { cards: next, drawn: Math.max(0, wanted) - left, onto };
}

/** Pay a chosen amount off a chosen card. The player's one ongoing decision. */
export function payTowards(
  card: HeldCard,
  amount: number,
): { readonly card: HeldCard; readonly paid: number } {
  const owed = Number(card.balance) / 100;
  const paid = Math.max(0, Math.min(owed, Math.round(amount)));
  return { card: { ...card, balance: dollars(Math.round(owed - paid)) }, paid };
}

export const EMPTY_CARDS: readonly HeldCard[] = [];
