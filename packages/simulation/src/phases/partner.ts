/**
 * Ticket 0502 — a partner's year of work, as money the household receives.
 *
 * The rules are in `@yearafter/careers/partner`; this is the part that knows
 * who the partner is and what the household looks like this year. It posts
 * nothing itself. Like every phase since 0301 it RETURNS transactions and
 * `advanceYear` commits them — with the income, ahead of every outgoing.
 */

import { dollars } from '@yearafter/core';
import { partnerYear, type PartnerYear } from '@yearafter/careers';
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
}

export interface PartnerPhaseOutput {
  readonly partner?: Acquaintance;
  readonly year?: PartnerYear;
  readonly transactions: readonly NewTransaction[];
  /** What reached the household after tax, whole dollars. */
  readonly net: number;
  /** Before tax, whole dollars — what a lender counts. */
  readonly gross: number;
}

const NONE: PartnerPhaseOutput = { transactions: [], net: 0, gross: 0 };

export function partnerIncomeFor(input: PartnerPhaseInput): PartnerPhaseOutput {
  const partner = householdPartnerOf(input.people);
  if (!partner || !partner.alive) return NONE;
  const year = partnerYear({
    id: String(partner.id),
    age: npcAge(partner, input.worldYear),
    youngChild: input.childAges.some((age) => age < YOUNG_CHILD_UNDER),
  });
  if (year.gross <= 0) return { ...NONE, partner, year };

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
  return { partner, year, transactions, net: year.net, gross: year.gross };
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
}): PartnerPhaseOutput {
  return partnerIncomeFor({
    people: state.circle.people,
    worldYear: state.world.year,
    childAges: childrenAtHome(state.family, state.world.year).map(
      (child) => state.world.year - child.birthYear,
    ),
  });
}
