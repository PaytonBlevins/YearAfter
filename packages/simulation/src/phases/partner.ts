/**
 * P16 — a saved partner career's year of work, as household income.
 *
 * Career and shared participation rules are in `@yearafter/careers`; this knows
 * who the partner is and what the household looks like this year. It posts
 * nothing itself. Like every phase since 0301 it RETURNS transactions and
 * `advanceYear` commits them — with the income, ahead of every outgoing.
 */

import { dollars } from '@yearafter/core';
import {
  startPartnerCareer,
  advancePartnerCareer,
  findJob,
  partnerCareerText,
  type PartnerCareers,
  type PartnerCareer,
  type PartnerYear,
} from '@yearafter/careers';
import type { NewTransaction } from '@yearafter/finance';
import { childrenAtHome } from '@yearafter/parenting';
import { npcAge } from '@yearafter/relationships';
import { householdPartnerOf, type Acquaintance } from '@yearafter/social';

/** A child this young keeps one parent home more often than not. */
export const YOUNG_CHILD_UNDER = 6;

export interface PartnerPhaseInput {
  readonly people: readonly Acquaintance[];
  readonly worldYear: number;
  /** The ages of the children living at home. */
  readonly childAges: readonly number[];
  readonly seed?: string;
  readonly careers?: PartnerCareers;
  readonly playerPay?: number;
}

export interface PartnerPhaseOutput {
  readonly partner?: Acquaintance;
  readonly year?: PartnerYear;
  readonly transactions: readonly NewTransaction[];
  /** What reached the household after tax, whole dollars. */
  readonly net: number;
  /** Before tax, whole dollars — what a lender counts. */
  readonly gross: number;
  readonly careers: PartnerCareers;
  readonly career?: PartnerCareer;
  readonly jobTitle?: string;
  readonly changeText?: string;
}

const NONE: PartnerPhaseOutput = { transactions: [], net: 0, gross: 0, careers: {} };

export function partnerIncomeFor(input: PartnerPhaseInput): PartnerPhaseOutput {
  const partner = householdPartnerOf(input.people);
  const careers = input.careers ?? {};
  if (!partner || !partner.alive || npcAge(partner, input.worldYear) < 18)
    return { ...NONE, careers };
  const careerInput = {
    id: String(partner.id),
    age: npcAge(partner, input.worldYear),
    youngChild: input.childAges.some((age) => age < YOUNG_CHILD_UNDER),
    seed: input.seed ?? '',
    worldYear: input.worldYear,
    playerPay: input.playerPay ?? 0,
  };
  const previous = careers[String(partner.id)];
  const career = previous
    ? advancePartnerCareer(careerInput, previous)
    : startPartnerCareer(careerInput);
  return incomeResult(partner, career, { ...careers, [String(partner.id)]: career });
}

function incomeResult(
  partner: Acquaintance,
  career: PartnerCareer,
  careers: PartnerCareers,
): PartnerPhaseOutput {
  const year = career.last;
  const details = {
    partner,
    career,
    year,
    careers,
    jobTitle: findJob(career.jobId)?.title,
    changeText: partnerCareerText(career),
  };
  if (year.gross <= 0) return { ...NONE, ...details };

  const whose = `${partner.firstName}'s`;
  const transactions: NewTransaction[] = [
    {
      category: 'partner',
      amount: dollars(year.gross),
      source: year.status === 'retired' ? `${whose} pension` : `${whose} pay`,
    },
  ];
  if (year.tax > 0) {
    transactions.push({
      category: 'tax',
      amount: dollars(-year.tax),
      source: `Tax on ${whose} income`,
    });
  }
  return { ...details, transactions, net: year.net, gross: year.gross };
}

/**
 * The same answer for the screen, read off a whole game state.
 *
 * One derivation for the engine and the Person screen (CORE_RULES 13.23): the
 * screen asks what the partner is doing THIS year, which is the year the
 * engine last posted.
 */
export function partnerIncomeOf(state: {
  readonly circle: { readonly people: readonly Acquaintance[] };
  readonly world: { readonly year: number };
  readonly family: Parameters<typeof childrenAtHome>[0];
  readonly partnerCareers: PartnerCareers;
}): PartnerPhaseOutput {
  const partner = householdPartnerOf(state.circle.people);
  const career = partner && state.partnerCareers[String(partner.id)];
  if (!partner || !partner.alive || !career || career.year !== state.world.year)
    return { ...NONE, careers: state.partnerCareers, ...(partner?.alive ? { partner } : {}) };
  return incomeResult(partner, career, state.partnerCareers);
}
