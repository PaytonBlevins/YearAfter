/**
 * Ticket 0305 — credit standing.
 *
 * THE SPEC IS MOSTLY A LIST OF THINGS NOT TO BUILD, and it is worth quoting
 * before anything else, because every decision here is downstream of it:
 *
 *   Spec 1685: *"simplified approved underwriting; no overbuilt real
 *   credit-bureau simulation."*
 *   Spec 25: *"Do not explicitly take age/history of account or past defaults
 *   into account as separate modeled inputs. Credit should stay simplified
 *   around utilization, payment behavior, debt load, income, assets, and
 *   obligations."*
 *   Spec 1867: *"No generic risk score."*
 *   Spec 1381: *"Credit should be useful, not universally punitive."*
 *
 * SO THERE IS NO NUMBER. Credit is a STANDING — a word — and the arithmetic
 * behind it is never shown, exactly as 0209 decided for a parent's mood: *"a
 * parent page shows a mood ('Probably', 'Unlikely') rather than a percentage,
 * because a child does not have a calibrated model of their own parents."* A
 * person does not have a calibrated model of their own underwriting either.
 *
 * Spec 1867 is the one that confirms this is the shape the spec wants rather
 * than a dodge: it rules out a generic risk score in the same breath as
 * allowing "credit quality" to be shown. A band is quality; 724 is a score.
 *
 * PAST DEFAULTS ARE FORBIDDEN AND PAYMENT BEHAVIOUR IS REQUIRED, which looks
 * like a contradiction and is not. A bureau records a default as a dated event
 * that sits on a file for seven years. What spec 25 asks for is whether you are
 * KEEPING UP — so this reads recent years and lets older trouble fade out
 * completely, which is also the only reading that satisfies "useful, not
 * universally punitive". One bad year at twenty-two does not follow a character
 * to sixty.
 *
 * NO NEW SAVE STATE. Every input is already written down: the ledger records
 * what came in, what went out, and every shortfall, with a year on each. A
 * credit standing that had to be stored would be a second derivation of facts
 * the ledger already holds (CORE_RULES 13.23), and would need a migration to
 * say something the save can already answer.
 */

import type { Ledger } from './ledger';
import { flows, transactionsIn } from './ledger';

/* -------------------------------------------------------------------------- */
/* What credit is made of, and what is not built yet                           */
/* -------------------------------------------------------------------------- */

/**
 * Spec 25's six inputs, and which of them have a producer today.
 *
 * Measured across 100 played lives before any of this was written:
 *
 *   income        p10 $29,280   median $75,216   p90 $145,817
 *   obligations   p10 $21,700   median $65,065   p90 $144,189
 *   obl./income   p10 55%       median 91%       p90 116%
 *   savings       p10 $20,140   median $131,052  p90 $436,978
 *   shortfalls    3.4% of adult years; 48 of 100 lives were short at least once
 *
 * Four of the six vary across the population and can carry a model. The other
 * two cannot exist yet — utilisation needs a card to be using, debt load needs
 * a debt — so they are named here rather than folded in as silent zeroes, the
 * same device as `UNWRITTEN_CATEGORIES` and `NOT_YET_OWNED`. A test asserts the
 * list, so 0306 and 0307 each have to come here and delete a line.
 */
export const CREDIT_INPUTS_NOT_YET_BUILT = [
  { key: 'utilization', arrives: '0306' },
  { key: 'debtLoad', arrives: '0307' },
] as const;

/** How many years back payment trouble is still visible. */
export const TROUBLE_FADES_OVER = 6;

/*
  Measured constants. CORE_RULES 13.25: set against the distribution the build
  actually produces, at the point the rule fires — not against what the words
  mean in the world. A real underwriter's numbers would put every character in
  this game in the same band, because the game's wages are the game's wages.
*/
/**
 * Income at which the income term is fully earned — around the ninetieth
 * percentile, not the median, and that was a correction.
 *
 * The first pass put it just above the median ($90,000) and savings at $60,000,
 * and measured the result: **65% of working characters were Excellent at
 * forty-five**. Both bars saturated in an ordinary career, so the top band
 * stopped distinguishing anybody from anybody — CORE_RULES 13.26 with a word
 * instead of a column. Set at the top of the distribution, the population
 * spreads across all four bands with Good as the common case, which is what
 * spec 1381's "useful, not universally punitive" should look like.
 */
export const INCOME_STRONG = 130_000;
/** Below this, income is contributing nothing. Around the tenth percentile. */
export const INCOME_WEAK = 25_000;
/** Savings at which the assets term is fully earned. Above the median holding. */
export const SAVINGS_STRONG = 150_000;
/** Committed outgoings as a share of income: comfortable, and stretched. */
export const OBLIGATIONS_EASY = 0.7;
export const OBLIGATIONS_TIGHT = 1.05;

const span = (value: number, low: number, high: number): number =>
  high === low ? 0 : Math.max(0, Math.min(1, (value - low) / (high - low)));

/* -------------------------------------------------------------------------- */
/* Standing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Five words, and one of them means "not applicable yet".
 *
 * `none` is not a bad standing, it is the absence of one — a twelve-year-old
 * has no credit rather than poor credit, and a lender told "poor" would be
 * being told something false. It matters because 0306 must refuse a card to a
 * child for the right reason.
 */
export type CreditStanding = 'excellent' | 'good' | 'fair' | 'poor' | 'none';

export const CREDIT_LABELS: Readonly<Record<CreditStanding, string>> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  none: 'None yet',
};

export interface CreditReport {
  readonly standing: CreditStanding;
  readonly label: string;
  /** One plain sentence. Never a number. */
  readonly summary: string;
  /** What is working in their favour, in the player's words. */
  readonly helping: readonly string[];
  /** What is counting against them. */
  readonly hurting: readonly string[];
}

/** The age below which a character simply has no credit. */
export const CREDIT_FROM_AGE = 18;

/**
 * Work out where somebody stands.
 *
 * Four terms today, weighted so that KEEPING UP dominates. That is what credit
 * is about, and it is also what makes the standing move in response to
 * something the player did rather than to something the generator rolled: a
 * character's income is mostly their job, but whether they covered the year is
 * the consequence of choices they made.
 */
export function creditReport(ledger: Ledger, year: number, age: number): CreditReport {
  if (age < CREDIT_FROM_AGE) {
    return {
      standing: 'none',
      label: CREDIT_LABELS.none,
      summary: 'Nobody lends to somebody your age. This starts when you do.',
      helping: [],
      hurting: [],
    };
  }

  /*
    A three-year window on income and obligations rather than this year alone.

    One year is noise: a character between jobs for a single year is not
    suddenly a bad risk, and one enormous commission year does not make them a
    good one. Three is long enough to describe a situation and short enough that
    it is still THEIR situation.
  */
  let earned = 0;
  let spent = 0;
  for (let back = 0; back < 3; back += 1) {
    const flow = flows(ledger, year - back);
    earned += Number(flow.in);
    spent += Number(flow.out);
  }

  const income = earned / 3 / 100;
  const obligations = spent / 3 / 100;
  const savings = Math.max(0, Number(ledger.balance) / 100);

  /*
    Payment behaviour, and the shape of it is the spec's rule rather than mine.

    Recent years count for more and old years count for nothing at all, because
    spec 25 forbids past defaults as a modelled input while requiring payment
    behaviour — the difference between "are you keeping up" and a file that
    remembers 2031. A shortfall six years ago is invisible here.
  */
  let trouble = 0;
  for (let back = 0; back < TROUBLE_FADES_OVER; back += 1) {
    const short = transactionsIn(ledger, year - back).filter(
      (entry) => entry.category === 'shortfall',
    ).length;
    if (short === 0) continue;
    // Linear fade: this year counts full, the sixth year back counts nothing.
    trouble += Math.min(1, short) * (1 - back / TROUBLE_FADES_OVER);
  }
  const keepingUp = Math.max(0, 1 - trouble / 2.2);

  /*
    AN UNTESTED RECORD IS NOT A GOOD RECORD, and the first version of this file
    got that wrong in a way worth writing down.

    `keepingUp` rewards never having come up short. A character with no job has
    never come up short — the living phase contracts their household instead of
    letting a bill go unpaid — so they scored full marks on the heaviest term in
    the model and came out FAIR while holding nothing, earning nothing and
    owning nothing. The term was rewarding the absence of activity.

    So the record only counts to the extent there was something to keep up
    with. Somebody who has never had money to fail with has not demonstrated
    anything, which is the honest answer and also the real one: a lender calls
    that a thin file, and a thin file is not a good file.
  */
  const tested = Math.min(1, income / INCOME_WEAK);
  const record = keepingUp * tested;

  const incomeTerm = span(income, INCOME_WEAK, INCOME_STRONG);
  const assetsTerm = span(savings, 0, SAVINGS_STRONG);
  const roomTerm =
    income <= 0 ? 0 : 1 - span(obligations / income, OBLIGATIONS_EASY, OBLIGATIONS_TIGHT);

  /*
    A character with no financial life at all has no standing, rather than a
    poor one. An eighteen-year-old who has never been paid and never spent
    anything is not a bad risk; they are an unknown one, and saying "Poor" would
    be the game inventing a history it does not have.
  */
  if (earned === 0 && spent === 0 && savings === 0) {
    return {
      standing: 'none',
      label: CREDIT_LABELS.none,
      summary: 'Nothing to go on yet. Earn something, or spend something.',
      helping: [],
      hurting: [],
    };
  }

  const quality = record * 0.4 + incomeTerm * 0.24 + roomTerm * 0.22 + assetsTerm * 0.14;

  const standing: CreditStanding =
    quality >= 0.8 ? 'excellent' : quality >= 0.58 ? 'good' : quality >= 0.36 ? 'fair' : 'poor';

  /*
    AT MOST TWO OF EACH, ordered by how much the term actually moved the
    standing — and that was a correction made by reading the built screen.

    The first version pushed every reason that crossed a threshold, and a real
    played life came out like this at nineteen:

        Poor
        - You have no record to go on
        - You do not earn much
        - Your costs take nearly everything
        - You have nothing put by

    Four negatives, no positives, for the crime of being nineteen. That is a
    wall rather than an explanation, and it is what spec 1381 means by "not
    universally punitive": the player cannot tell which of the four to do
    something about, so they do nothing about any of them. The thresholds had
    also never been re-tuned after the bars moved, so two of those lines fired
    for very nearly everybody (CORE_RULES 13.26).

    Two is enough to explain a standing and short enough to act on. Capping
    hides nothing that matters, because the two shown are the two that moved it.
  */
  const reasons: { text: string; weight: number; good: boolean }[] = [];

  if (tested < 0.5) {
    /*
      A thin record is the WHOLE story, and the rest are consequences of it.
      Somebody who has barely earned anything does not also need telling that
      they do not earn much and have nothing put by — that is one fact three
      times, and it reads as the game piling on.
    */
    reasons.push({ text: 'You have no record to go on', weight: 1, good: false });
  } else {
    if (trouble > 0) {
      reasons.push({
        text: 'You have come up short recently',
        weight: 0.4 * Math.min(1, trouble),
        good: false,
      });
    } else {
      reasons.push({ text: 'You have covered everything you owed', weight: 0.4, good: true });
    }

    if (incomeTerm >= 0.55) {
      reasons.push({ text: 'You earn well', weight: 0.24 * incomeTerm, good: true });
    } else if (incomeTerm <= 0.2) {
      reasons.push({ text: 'You do not earn much', weight: 0.24 * (1 - incomeTerm), good: false });
    }

    if (roomTerm >= 0.55) {
      reasons.push({ text: 'Your costs leave you room', weight: 0.22 * roomTerm, good: true });
    } else if (roomTerm <= 0.2) {
      reasons.push({
        text: 'Your costs take nearly everything',
        weight: 0.22 * (1 - roomTerm),
        good: false,
      });
    }

    if (assetsTerm >= 0.45) {
      reasons.push({ text: 'You have savings behind you', weight: 0.14 * assetsTerm, good: true });
    } else if (assetsTerm <= 0.08) {
      reasons.push({
        text: 'You have nothing put by',
        weight: 0.14 * (1 - assetsTerm),
        good: false,
      });
    }
  }

  const pick = (good: boolean): string[] =>
    reasons
      .filter((reason) => reason.good === good)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 2)
      .map((reason) => reason.text);

  const helping = pick(true);
  const hurting = pick(false);

  return {
    standing,
    label: CREDIT_LABELS[standing],
    summary: summaryFor(standing),
    helping,
    hurting,
  };
}

/**
 * One sentence, said the way a person would say it.
 *
 * Not "your credit utilisation ratio is favourable". Writing rule 10 and
 * CORE_RULES 13.29: say what it means for them, or say nothing.
 */
function summaryFor(standing: CreditStanding): string {
  switch (standing) {
    case 'excellent':
      return 'Anybody would lend to you, and on good terms.';
    case 'good':
      return 'You would get most things you applied for.';
    case 'fair':
      return "You'd get something, but not the good rates.";
    case 'poor':
      return 'Most lenders would say no right now.';
    case 'none':
      return 'Nothing to go on yet.';
  }
}

/**
 * The standing as a number between 0 and 1, for systems that need to compare.
 *
 * FOR 0306 AND 0307, NEVER FOR A SCREEN. Card availability (spec 26) varies by
 * credit among other things, and an eligibility rule needs something it can put
 * a threshold on. Exposing the band's ordinal rather than the internal quality
 * keeps the model's arithmetic private and the contract narrow: a lender knows
 * "better than fair", not "0.61".
 */
export const STANDING_ORDER: readonly CreditStanding[] = [
  'none',
  'poor',
  'fair',
  'good',
  'excellent',
];

export const atLeast = (standing: CreditStanding, floor: CreditStanding): boolean =>
  STANDING_ORDER.indexOf(standing) >= STANDING_ORDER.indexOf(floor);
