/**
 * Ticket 0605 — the private deals a wealthy-enough character is offered.
 *
 * A table of what exists, in the same spirit as `businesses.ts`: the engine in
 * `@yearafter/finance` depends on the ids and the numbers, never the names.
 * Spec 1383: private investments "can generate large returns but may fail or
 * remain illiquid", and "opportunity capacity prevents implausibly placing
 * unlimited capital into tiny deals". Spec 1140: soft eligibility bands.
 *
 * Every figure below is a PROPOSAL (product judgment) calibrated in
 * `claude/0605-private-investments.md`. Outcome tables are anchored on the
 * Angel Resource Institute's study of 245 completed angel exits (just under
 * 70% returned less than the money put in, just under 10% returned 10x or
 * more, mean 2.5x, mean hold 4.5 years); the other kinds are set so their
 * average yearly return lands in the range reported for that asset class.
 */

export type DealKindId = 'startup' | 'lending' | 'localBusiness' | 'realEstate' | 'growth' | 'fund';

/** One way a deal can end: a share of all deals, and what comes back per dollar put in. */
export interface DealOutcome {
  readonly weight: number;
  /** Multiple of the money put in, returned at the end. 0 is a total loss. */
  readonly multiple: readonly [number, number];
}

export interface DealKind {
  readonly id: DealKindId;
  readonly label: string;
  readonly blurb: string;
  /** Whole dollars. The smallest cheque anybody can write. */
  readonly minTicket: number;
  /** Whole dollars of liquid money before the deal is shown (soft: three cheques). */
  readonly gate: number;
  /** Years the money is away. Fixed when the deal is made. */
  readonly lockYears: readonly [number, number];
  /** Whole dollars. How much the whole round is raising, as a multiple of minTicket. */
  readonly roundMultiple: readonly [number, number];
  /** The most of a round one person can take (spec 1383's capacity). */
  readonly maxShareOfRound: number;
  /** Paid each year on the money put in, as it goes. 0 for deals that pay at the end. */
  readonly yearlyYield: number;
  /** Whether the money can be sold on to someone else before the end, at a discount. */
  readonly canSellEarly: boolean;
  /** How the deal ends, weights summing to 1. */
  readonly outcomes: readonly DealOutcome[];
}

export const DEAL_KINDS: readonly DealKind[] = [
  {
    id: 'startup',
    label: 'Early-stage startup',
    blurb: 'A small stake in a company that has only just begun. Most go nowhere; a few change everything.',
    minTicket: 5_000,
    gate: 15_000,
    lockYears: [3, 6],
    roundMultiple: [40, 400],
    maxShareOfRound: 0.15,
    yearlyYield: 0,
    canSellEarly: false,
    outcomes: [
      { weight: 0.45, multiple: [0, 0] },
      { weight: 0.25, multiple: [0.1, 0.9] },
      { weight: 0.12, multiple: [1, 3] },
      { weight: 0.08, multiple: [3, 8] },
      { weight: 0.1, multiple: [10, 26] },
    ],
  },
  {
    id: 'lending',
    label: 'Private loan',
    blurb: 'Money lent to a borrower the banks passed on. It pays every year, and now and then a borrower doesn't pay back.',
    minTicket: 10_000,
    gate: 30_000,
    lockYears: [1, 5],
    roundMultiple: [20, 120],
    maxShareOfRound: 0.25,
    yearlyYield: 0.09,
    canSellEarly: true,
    outcomes: [
      { weight: 0.04, multiple: [0, 0.5] },
      { weight: 0.96, multiple: [1, 1] },
    ],
  },
  {
    id: 'localBusiness',
    label: 'A stake in a local business',
    blurb: 'A share of a business in town, with a say in nothing and a claim on some of the profit when it is sold.',
    minTicket: 25_000,
    gate: 75_000,
    lockYears: [3, 6],
    roundMultiple: [8, 60],
    maxShareOfRound: 0.3,
    yearlyYield: 0,
    canSellEarly: true,
    outcomes: [
      { weight: 0.3, multiple: [0, 0] },
      { weight: 0.15, multiple: [0.2, 0.9] },
      { weight: 0.3, multiple: [1, 2] },
      { weight: 0.2, multiple: [2, 4] },
      { weight: 0.05, multiple: [4, 8] },
    ],
  },
  {
    id: 'realEstate',
    label: 'A property syndicate',
    blurb: 'A share of a building bought by a group. Rent is reinvested; you are paid when it is sold.',
    minTicket: 25_000,
    gate: 75_000,
    lockYears: [5, 7],
    roundMultiple: [20, 200],
    maxShareOfRound: 0.2,
    yearlyYield: 0,
    canSellEarly: true,
    outcomes: [
      { weight: 0.08, multiple: [0.4, 0.9] },
      { weight: 0.45, multiple: [1.1, 1.5] },
      { weight: 0.4, multiple: [1.5, 2.2] },
      { weight: 0.07, multiple: [2.2, 3] },
    ],
  },
  {
    id: 'growth',
    label: 'A growing private company',
    blurb: 'A stake in a company with real customers that is raising money to get bigger.',
    minTicket: 100_000,
    gate: 300_000,
    lockYears: [5, 8],
    roundMultiple: [15, 120],
    maxShareOfRound: 0.15,
    yearlyYield: 0,
    canSellEarly: false,
    outcomes: [
      { weight: 0.1, multiple: [0, 0] },
      { weight: 0.15, multiple: [0.5, 1] },
      { weight: 0.35, multiple: [1, 2] },
      { weight: 0.3, multiple: [2, 4] },
      { weight: 0.1, multiple: [4, 8] },
    ],
  },
  {
    id: 'fund',
    label: 'A private fund',
    blurb: 'Money pooled with other investors and run by a firm. Ten years, and no way to ask for it back.',
    minTicket: 250_000,
    gate: 750_000,
    lockYears: [8, 10],
    roundMultiple: [40, 400],
    maxShareOfRound: 0.05,
    yearlyYield: 0,
    canSellEarly: false,
    outcomes: [
      { weight: 0.05, multiple: [0.4, 0.8] },
      { weight: 0.1, multiple: [0.9, 1.1] },
      { weight: 0.35, multiple: [1.4, 2.2] },
      { weight: 0.35, multiple: [2.2, 3.4] },
      { weight: 0.15, multiple: [3.4, 5.6] },
    ],
  },
] as const;

export const findDealKind = (id: string): DealKind | undefined =>
  DEAL_KINDS.find((kind) => kind.id === id);
