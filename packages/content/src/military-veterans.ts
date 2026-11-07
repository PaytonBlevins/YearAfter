/**
 * Ticket 0904 — discharge, benefits and veterans.
 *
 * What a service life leaves behind. A discharge has a character (honorable, general, medical or dishonorable; a recruit
 * who did not finish training has an entry-level one), and the character decides what comes after: twenty years earns a
 * pension for life, an honorable or medical discharge earns the GI Bill, and an honorable or general one earns a
 * preference when the person applies for a public or safety job.
 *
 * Real: the retirement formula of the Blended Retirement System (2% of the average of the highest 36 months of basic
 * pay, for each year of service, so 40% at twenty years); the Post-9/11 GI Bill (tuition up to a yearly cap, a monthly
 * housing allowance, thirty-six months of benefit, and a percentage by how long somebody served: 100% at 36 months or
 * more, 90% at 30 to 35, 80% at 24 to 29, 70% at 18 to 23, 60% at 6 to 17, 50% at 3 to 5; a discharge for a service
 * connected disability pays the full 100%; the 2026-27 tuition cap is $30,908.34 and the national average monthly
 * housing allowance is $2,396); veterans' preference (five points for qualifying service, ten for a disability, given
 * to somebody discharged under honorable conditions, which includes a general discharge; an enlisted member needs 24
 * months of service unless a disability ended it). Not real: how often each discharge comes. The shares of honorable,
 * general and other discharges were not found in a source the game could cite, so `GENERAL_BELOW`, `MISCONDUCT_CHANCE`
 * and the medical-board chance are judgements, set so most people leave honorably, a few leave under a cloud, and
 * almost nobody is dishonorably discharged. The ticket doc names the dials and the measurements.
 *
 * The retired pay here is for the Blended Retirement System only; it leaves out the thrift savings plan match, the
 * continuation pay and disability compensation (Payton's call). The preference is a bonus to the odds, not a quota
 * and not a shut door. American spelling, spoken-style contractions.
 */

import { RETIRE_ELIGIBLE_YEARS } from './military';
import { annualBasePay, type ServiceTrack } from './military-pay';

/* -------------------------------------------------------------------------- */
/* Discharges                                                                  */
/* -------------------------------------------------------------------------- */

export type Discharge = 'honorable' | 'general' | 'medical' | 'dishonorable' | 'entry-level';

export const DISCHARGE_LABELS: Readonly<Record<Discharge, string>> = {
  honorable: 'Honorable',
  general: 'General, under honorable conditions',
  medical: 'Medical',
  dishonorable: 'Dishonorable',
  'entry-level': 'Entry-level separation',
};

/** The discharges that earned the GI Bill. Honorable, and a medical one (a service-connected disability). */
export const GI_BILL_DISCHARGES: readonly Discharge[] = ['honorable', 'medical'];

/** The discharges that earn veterans' preference. A general discharge is "under honorable conditions". */
export const PREFERENCE_DISCHARGES: readonly Discharge[] = ['honorable', 'general', 'medical'];

/**
 * A service reputation under this ends a term with a general discharge and not an honorable one. A judgement, set
 * from a measurement: a service reputation starts at 55 and follows the year's performance, which aims at about 46
 * and moves 14 either way with the person's aptitude, so in 355 simulated lives it ended between 47 and 55 (a tenth of
 * them under 50, the median 51). The first dial, 40, was never reached by any of them. 50 catches the bottom tenth.
 */
export const GENERAL_BELOW = 50;

/**
 * Not asked to stay, with a reputation under this, is a general discharge. A refusal of the next term is one too.
 * Above the median on purpose: a member the service chose not to keep was, nearly always, a weak performer.
 */
export const NOT_RETAINED_GENERAL_BELOW = 52;

/**
 * Somebody this undisciplined and this poorly thought of may be court-martialed, a year, while serving at home.
 * A judgement, set so it is rare.
 */
export const MISCONDUCT_DISCIPLINE_BELOW = 35;
export const MISCONDUCT_REPUTATION_BELOW = 50;
export const MISCONDUCT_CHANCE = 0.05;

/** A member holding a serious injury from service is sent before a medical board, a year, with this chance. */
export const MEDICAL_BOARD_CHANCE = 0.4;

export interface DischargeCase {
  /** How the service ended (`PastService['how']`). */
  readonly how: string;
  /** The service reputation, 0 to 100, when it ended. */
  readonly reputation: number;
  /** The member turned the next term down when orders for it were put to them. */
  readonly refused?: boolean;
}

/** The character of a discharge. Pure, so the table above and this rule are read together. */
export function dischargeOf(row: DischargeCase): Discharge {
  switch (row.how) {
    case 'washed-out':
      return 'entry-level';
    case 'medical':
      return 'medical';
    case 'misconduct':
      return 'dishonorable';
    case 'retired':
    case 'killed':
      return 'honorable';
    case 'not-retained':
      return row.refused === true || row.reputation < NOT_RETAINED_GENERAL_BELOW
        ? 'general'
        : 'honorable';
    default:
      return row.reputation < GENERAL_BELOW ? 'general' : 'honorable';
  }
}

/* -------------------------------------------------------------------------- */
/* Retired pay                                                                 */
/* -------------------------------------------------------------------------- */

/** 2% of the average of the highest 36 months of basic pay, for each year of service. */
export const PENSION_PER_YEAR = 0.02;

/** The most a pension can be of the average: the formula's own ceiling. */
export const PENSION_CEILING = 0.75;

export interface PensionCase {
  readonly track: ServiceTrack;
  readonly finalGrade: number;
  readonly years: number;
  readonly how: string;
}

/**
 * A year of retired pay, whole dollars. Zero for anybody who did not retire with twenty years in. The highest 36
 * months of basic pay are the last three years, at the final grade.
 */
export function retiredPayFor(row: PensionCase): number {
  if (row.how !== 'retired' || row.years < RETIRE_ELIGIBLE_YEARS) return 0;
  let sum = 0;
  for (let back = 0; back < 3; back += 1) {
    sum += annualBasePay(row.finalGrade, Math.max(0, row.years - back), row.track);
  }
  const average = sum / 3;
  const share = Math.min(PENSION_CEILING, PENSION_PER_YEAR * row.years);
  return Math.round(average * share);
}

/* -------------------------------------------------------------------------- */
/* The GI Bill                                                                 */
/* -------------------------------------------------------------------------- */

/** Months of benefit, in all. Four academic years of nine months. */
export const GI_MONTHS_ENTITLED = 36;

/** Months of the benefit a year at college uses. */
export const GI_MONTHS_PER_YEAR = 9;

/** The most tuition the benefit pays in a year, at 100%. The 2026-27 figure, whole dollars. */
export const GI_TUITION_CAP = 30_908;

/** The monthly housing allowance at 100%: the national average for 2026-27. */
export const GI_HOUSING_MONTHLY = 2_396;

/** The shares by months of service, longest first. Real. */
export const GI_TIERS: readonly { readonly months: number; readonly percent: number }[] = [
  { months: 36, percent: 1 },
  { months: 30, percent: 0.9 },
  { months: 24, percent: 0.8 },
  { months: 18, percent: 0.7 },
  { months: 6, percent: 0.6 },
  { months: 3, percent: 0.5 },
];

/** The share of the benefit that so many months of service earn. Zero under three. */
export function giPercentFor(months: number): number {
  return GI_TIERS.find((tier) => months >= tier.months)?.percent ?? 0;
}

/* -------------------------------------------------------------------------- */
/* Veterans' preference                                                        */
/* -------------------------------------------------------------------------- */

/** Public and safety jobs are the ones that give the preference. */
export const PREFERENCE_TRACKS: readonly string[] = ['public', 'safety'];

/** Added to the odds of being hired on those tracks. A judgement: about a rung's worth of experience. */
export const PREFERENCE_BONUS = 0.15;

/** An enlisted or officer member needs this many years for the preference, unless a medical discharge ended it. */
export const PREFERENCE_MIN_YEARS = 2;

/* -------------------------------------------------------------------------- */
/* Lines                                                                       */
/* -------------------------------------------------------------------------- */

export const MEDICAL_BOARD_LINES: readonly string[] = [
  "A medical board looked at what you'd come home with and found you unfit to serve. %Branch% discharged you as a %title%.",
  "The doctors signed the papers. You couldn't stay in %branch% with what you carried, and you left as a %title%.",
];

export const MISCONDUCT_LINES: readonly string[] = [
  'A court-martial found you guilty. %Branch% threw you out as a %title%, with a dishonorable discharge.',
  "You'd stopped following orders and you'd stopped caring who knew it. %Branch% court-martialed you and sent you home as a %title%.",
];

export const GENERAL_DISCHARGE_NOTES: readonly string[] = [
  "Your discharge was general, under honorable conditions. It's not the one you'd wanted.",
  "They gave you a general discharge, not an honorable one. You'd been a poor fit for a while.",
];

export const PENSION_START_LINES: readonly string[] = [
  "Your first retired pay arrived. It's about $%pay% a year, for life.",
  'The first retirement check came through from %branch%: roughly $%pay% a year, for the rest of your life.',
];

export const GI_BILL_START_LINES: readonly string[] = [
  "The GI Bill is paying for school: %percent% of your tuition and a housing allowance each month you're enrolled.",
  "You enrolled on the GI Bill. It covers %percent% of what's allowed for tuition, and pays you to live.",
];

export const GI_BILL_USED_UP_LINES: readonly string[] = [
  'The last of your GI Bill is spent. From here the tuition is yours to pay.',
  "Your GI Bill ran out. You'd used every month of it.",
];
